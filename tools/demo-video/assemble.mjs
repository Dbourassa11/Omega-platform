#!/usr/bin/env node
/**
 * Demo-video assembly — turns capture.mjs frames into a SILENT draft:
 * per beat, a 2s title card (with "DRAFT — NOT FINAL" on it) followed
 * by a 4s hold on the captured frame; "DRAFT" is additionally burned
 * into the bottom-right of the whole video. Voiceover is the founder's
 * later call — this draft intentionally has NO audio track.
 *
 * Usage: node assemble.mjs [--frames ./frames] [--out ../../docs/demo-video/draft-demo.mp4]
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
const FRAMES = path.resolve(arg("frames", path.join(HERE, "frames")));
const OUT = path.resolve(arg("out", path.join(HERE, "../../docs/demo-video/draft-demo.mp4")));
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const W = 1280, H = 720, FPS = 30;

function wrap(text, max = 54) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}
function ffmpeg(argsList, label) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...argsList], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${label}`);
}

const manifest = JSON.parse(await readFile(path.join(FRAMES, "manifest.json"), "utf8"));
const work = path.join(FRAMES, "work");
await mkdir(work, { recursive: true });
await mkdir(path.dirname(OUT), { recursive: true });

const segments = [];
for (const frame of manifest.frames) {
  const n = frame.beat;
  // --- title card ---
  const titleFile = path.join(work, `title-${n}.txt`);
  const captionFile = path.join(work, `caption-${n}.txt`);
  await writeFile(titleFile, wrap(`Beat ${n} — ${frame.title}`).join("\n"));
  await writeFile(captionFile, wrap(frame.caption).join("\n"));
  const card = path.join(work, `card-${n}.mp4`);
  ffmpeg([
    "-f", "lavfi", "-i", `color=c=0x05070f:s=${W}x${H}:r=${FPS}:d=2`,
    "-vf",
    [
      `drawtext=fontfile=${FONT_BOLD}:textfile=${titleFile}:fontcolor=0xf0cd5a:fontsize=40:x=(w-text_w)/2:y=250:line_spacing=10`,
      `drawtext=fontfile=${FONT}:textfile=${captionFile}:fontcolor=0xece7d9:fontsize=27:x=(w-text_w)/2:y=360:line_spacing=8`,
      `drawtext=fontfile=${FONT_BOLD}:text='DRAFT — NOT FINAL':fontcolor=0xff8a8a:fontsize=30:x=(w-text_w)/2:y=80`,
      `drawtext=fontfile=${FONT}:text='Eternal Quantum Horizons — Omega Platform':fontcolor=0x9a9585:fontsize=22:x=(w-text_w)/2:y=620`,
    ].join(","),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", card,
  ], `title card ${n}`);
  segments.push(card);

  // --- captured frame hold (or an honest placeholder) ---
  const img = path.join(FRAMES, frame.file);
  const seg = path.join(work, `seg-${n}.mp4`);
  if (existsSync(img)) {
    ffmpeg([
      "-loop", "1", "-t", "4", "-i", img,
      "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x05070f,fps=${FPS}`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", seg,
    ], `frame segment ${n}`);
  } else {
    ffmpeg([
      "-f", "lavfi", "-i", `color=c=0x05070f:s=${W}x${H}:r=${FPS}:d=4`,
      "-vf", `drawtext=fontfile=${FONT}:text='capture missing for this beat':fontcolor=0xece7d9:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", seg,
    ], `placeholder ${n}`);
  }
  segments.push(seg);
}

const listFile = path.join(work, "concat.txt");
await writeFile(listFile, segments.map((s) => `file '${s}'`).join("\n"));
const joined = path.join(work, "joined.mp4");
ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", joined], "concat");

// Final pass: burn DRAFT across the whole draft; strip any audio (silent by design).
ffmpeg([
  "-i", joined,
  "-vf", `drawtext=fontfile=${FONT_BOLD}:text='DRAFT':fontcolor=white@0.35:fontsize=44:x=w-text_w-24:y=h-text_h-20`,
  "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT,
], "watermark/final");
console.log(`draft written: ${OUT}`);
