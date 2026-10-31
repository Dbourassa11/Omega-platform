#!/usr/bin/env node
/**
 * FINAL demo-video assembly — turns capture-final.mjs frames into the
 * SILENT final submission video: docs/demo-video/final-demo.mp4.
 *
 * Structure: a ~3s opening title card, then per section a 2s title
 * card (section title + one-line narration) followed by the real
 * captured frames, each held for its manifest duration with a short
 * caption burned into the frame's lower edge, and a ~4s end card.
 * Narration is carried entirely as this text — there is NO audio
 * track, and NO "DRAFT" text or watermark anywhere in the final.
 *
 * Attribution on the title and end cards, exactly:
 *   David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico
 *
 * Usage: node assemble-final.mjs [--frames ./frames-final] [--out ../../docs/demo-video/final-demo.mp4]
 * Requires: ffmpeg on PATH (8.1.2 verified), DejaVu Sans fonts.
 * Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const FRAMES = path.resolve(arg("frames", path.join(HERE, "frames-final")));
const OUT = path.resolve(
  arg("out", path.join(HERE, "../../docs/demo-video/final-demo.mp4")),
);
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const W = 1280,
  H = 720,
  FPS = 30;
const BG = "0x05070f";
const CREATOR =
  "David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico";

function wrap(text, max = 54) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}
function ffmpeg(argsList, label) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", ...argsList],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${label}`);
}

const manifest = JSON.parse(
  await readFile(path.join(FRAMES, "manifest.json"), "utf8"),
);
const work = path.join(FRAMES, "work-final");
await mkdir(work, { recursive: true });
await mkdir(path.dirname(OUT), { recursive: true });

let fileSeq = 0;
async function textFile(name, text, max = 54) {
  const f = path.join(work, `${fileSeq++}-${name}.txt`);
  await writeFile(f, wrap(text, max).join("\n"));
  return f;
}

/** A generated card: big gold title, white subtitle, optional creator line. */
async function makeCard(name, { title, subtitle, creator = false, dur }) {
  const filters = [];
  const titleF = await textFile(`${name}-title`, title, 46);
  filters.push(
    `drawtext=fontfile=${FONT_BOLD}:textfile=${titleF}:fontcolor=0xf0cd5a:fontsize=42:x=(w-text_w)/2:y=250:line_spacing=12`,
  );
  if (subtitle) {
    const subF = await textFile(`${name}-sub`, subtitle, 58);
    filters.push(
      `drawtext=fontfile=${FONT}:textfile=${subF}:fontcolor=0xece7d9:fontsize=27:x=(w-text_w)/2:y=380:line_spacing=9`,
    );
  }
  if (creator) {
    const cF = await textFile(`${name}-creator`, CREATOR, 200);
    filters.push(
      `drawtext=fontfile=${FONT}:textfile=${cF}:fontcolor=0x9a9585:fontsize=22:x=(w-text_w)/2:y=620`,
    );
  }
  const out = path.join(work, `${name}.mp4`);
  ffmpeg(
    [
      "-f",
      "lavfi",
      "-i",
      `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${dur}`,
      "-vf",
      filters.join(","),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      out,
    ],
    `card ${name}`,
  );
  return { file: out, dur };
}

const segments = [];
const report = [];
async function push(seg, label, dur) {
  segments.push(seg.file ?? seg);
  report.push({ label, dur });
}

/* ---- Opening title card (~3s) ---- */
push(
  await makeCard("card-open", {
    title: "Eternal Quantum Horizons Ω — Omega Platform",
    subtitle: "Designed as an overlay for Facebook — design intent",
    creator: true,
    dur: 3,
  }),
  "TITLE CARD",
  3,
);

/* ---- Sections: 2s card + captioned real frames ---- */
let lastSection = null;
for (const frame of manifest.frames) {
  if (frame.section !== lastSection) {
    lastSection = frame.section;
    push(
      await makeCard(`card-${frame.section}`, {
        title: frame.sectionTitle,
        subtitle: frame.sectionNarration,
        dur: 2,
      }),
      `card: ${frame.sectionTitle}`,
      2,
    );
  }
  const img = path.join(FRAMES, frame.file);
  if (!existsSync(img)) {
    throw new Error(`captured frame missing: ${img} — refusing to substitute`);
  }
  const capF = await textFile(`cap-${frame.file}`, frame.caption, 64);
  const seg = path.join(work, `seg-${frame.file}.mp4`);
  ffmpeg(
    [
      "-loop",
      "1",
      "-t",
      String(frame.hold),
      "-i",
      img,
      "-vf",
      [
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`,
        `fps=${FPS}`,
        `drawtext=fontfile=${FONT}:textfile=${capF}:fontcolor=0xffffff:fontsize=24:x=(w-text_w)/2:y=h-text_h-26:box=1:boxcolor=black@0.62:boxborderw=14:line_spacing=6`,
      ].join(","),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      seg,
    ],
    `frame ${frame.file}`,
  );
  push(seg, `${frame.section}: ${frame.file}`, frame.hold);
}

/* ---- End card (~4s) ---- */
push(
  await makeCard("card-end", {
    title: "Built on Facebook. Powered by Meta's own AI stack. Owned by you.",
    subtitle: null,
    creator: true,
    dur: 4,
  }),
  "END CARD",
  4,
);

const listFile = path.join(work, "concat.txt");
await writeFile(listFile, segments.map((s) => `file '${s}'`).join("\n"));
const joined = path.join(work, "joined.mp4");
ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", joined], "concat");

// Final pass: re-encode cleanly, strip any audio (silent by design), faststart.
ffmpeg(
  [
    "-i",
    joined,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    OUT,
  ],
  "final encode",
);

const total = report.reduce((a, r) => a + r.dur, 0);
console.log(`final written: ${OUT}`);
console.log(`planned duration: ${total}s across ${report.length} segments`);
for (const r of report) console.log(`  ${String(r.dur).padStart(4)}s  ${r.label}`);
