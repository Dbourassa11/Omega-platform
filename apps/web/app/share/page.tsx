"use client";

// Share Center — compose a share card locally and export it as a PNG or
// copy its text. DEMO ONLY: nothing is posted to Facebook or anywhere else.
// Drafts arrive from the Creative Suites via @/lib/sharebox (takeShareDraft).
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import { useEffect, useRef, useState } from "react";
import { RING_TYPES } from "@omega/consent-core";
import type { RingType } from "@omega/consent-core";
import { CREATIVE_SUITES } from "@/lib/projects";
import type { CreativeSuite } from "@/lib/projects";
import { takeShareDraft } from "@/lib/sharebox";
import { logActivity } from "@/lib/activity";

const SUITE_LABELS: Record<CreativeSuite, string> = {
  art: "Art",
  music: "Music",
  video: "Video",
  write: "Write",
};

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function capitalize(text: string): string {
  return text.length === 0
    ? text
    : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current !== "") lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last !== undefined && !last.endsWith("…")) {
      lines[maxLines - 1] = `${last.replace(/[\s,.;:!?]+$/, "")}…`;
    }
  }
  return lines;
}

function drawShareCard(
  ctx: CanvasRenderingContext2D,
  input: { title: string; body: string; suite: CreativeSuite; ring: RingType },
) {
  const { width, height } = { width: CARD_WIDTH, height: CARD_HEIGHT };

  // Deep-space background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#050510");
  bg.addColorStop(0.55, "#0b0b26");
  bg.addColorStop(1, "#161038");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(1030, 80, 10, 1030, 80, 460);
  glow.addColorStop(0, "rgba(212, 175, 55, 0.22)");
  glow.addColorStop(1, "rgba(212, 175, 55, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Deterministic star field
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 170; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = rand() * 1.6 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(236, 231, 217, ${0.25 + rand() * 0.55})`;
    ctx.fill();
  }

  // Gold frame
  ctx.strokeStyle = "rgba(212, 175, 55, 0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Ω glyph + eyebrow + suite label
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#d4af37";
  ctx.font = "110px Georgia, 'Times New Roman', serif";
  ctx.fillText("Ω", 64, 152);

  ctx.fillStyle = "#9a9585";
  ctx.font = "20px ui-sans-system, system-ui, sans-serif";
  ctx.fillText("O M E G A   P L A T F O R M", 208, 108);

  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 32px ui-sans-system, system-ui, sans-serif";
  ctx.fillText(`${SUITE_LABELS[input.suite]} Suite`, 208, 150);

  // Title
  ctx.fillStyle = "#ece7d9";
  ctx.font = "bold 52px Georgia, 'Times New Roman', serif";
  const titleText = input.title.trim() || "Untitled";
  const titleLines = wrapLines(ctx, titleText, width - 128, 2);
  let y = 252;
  for (const line of titleLines) {
    ctx.fillText(line, 64, y);
    y += 62;
  }

  // Body excerpt
  ctx.fillStyle = "#cfc9b8";
  ctx.font = "26px ui-sans-system, system-ui, sans-serif";
  const excerpt = input.body.trim().slice(0, 300);
  const bodyLines =
    excerpt === "" ? [] : wrapLines(ctx, excerpt, width - 128, 3);
  y += 14;
  for (const line of bodyLines) {
    ctx.fillText(line, 64, y);
    y += 38;
  }

  // Audience line
  ctx.fillStyle = "#c9b96a";
  ctx.font = "22px ui-sans-system, system-ui, sans-serif";
  ctx.fillText(
    `Audience: ${capitalize(input.ring)} ring`,
    64,
    height - 108,
  );

  // Footer
  ctx.fillStyle = "#ece7d9";
  ctx.font = "22px ui-sans-system, system-ui, sans-serif";
  ctx.fillText(
    "David Charles Bourassa · Quantum Concepts LLC",
    64,
    height - 64,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#9a9585";
  ctx.font = "18px ui-sans-system, system-ui, sans-serif";
  ctx.fillText("DEMO SHARE CARD — NOT POSTED", width - 64, height - 64);
  ctx.textAlign = "left";
}

export default function SharePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [suite, setSuite] = useState<CreativeSuite>("write");
  const [ring, setRing] = useState<RingType>("public");
  const [fromDraft, setFromDraft] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  // Pre-fill from a Creative Suites draft, if one is waiting.
  useEffect(() => {
    const draft = takeShareDraft();
    if (draft === null || draft === undefined) return;
    setTitle(draft.title);
    setBody(draft.body);
    if (CREATIVE_SUITES.includes(draft.suite as CreativeSuite)) {
      setSuite(draft.suite as CreativeSuite);
    }
    if (RING_TYPES.includes(draft.ring as RingType)) {
      setRing(draft.ring as RingType);
    }
    setFromDraft(true);
  }, []);

  // Re-render the share card on every edit.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    drawShareCard(ctx, { title, body, suite, ring });
  }, [title, body, suite, ring]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== undefined) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function shareText(): string {
    return (
      `${title.trim() || "Untitled"}\n\n${body.trim()}\n\n` +
      `— David Charles Bourassa · Quantum Concepts LLC\n` +
      `Omega Platform · ${SUITE_LABELS[suite]} suite · ` +
      `Audience: ${capitalize(ring)} ring`
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText());
      setCopyNote("Copied ✓");
      logActivity(
        "share",
        `Copied share text for "${title.trim() || "Untitled"}" (${ring} ring)`,
      );
    } catch {
      setCopyNote("Copy failed — clipboard is unavailable in this context.");
    }
    if (copyTimerRef.current !== undefined) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopyNote(null), 3000);
  }

  function handleExport() {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    canvas.toBlob((blob) => {
      if (blob === null) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "omega-share.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      logActivity(
        "share",
        `Exported share card PNG for "${title.trim() || "Untitled"}" (${ring} ring)`,
      );
    }, "image/png");
  }

  return (
    <div>
      <h1 className="page-title">Share Center</h1>
      <p className="muted">
        Compose a share card, choose its consent-ring audience, preview it,
        then copy the text or export the card as a PNG.
      </p>
      <p className="honest-banner" role="note">
        <strong>Demo Share Center</strong> — composing and exporting work
        locally; NOTHING is posted to Facebook or anywhere else.
      </p>
      {fromDraft && (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Draft received from the Creative Suites — pick a ring audience,
          review the card, and export when ready.
        </p>
      )}

      <div className="share-layout">
        <section className="card" aria-label="Share composer">
          <div className="form-stack">
            <label className="form-field">
              <span>Title</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Share title"
              />
            </label>
            <label className="form-field">
              <span>Body</span>
              <textarea
                className="textarea"
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What are you sharing?"
              />
            </label>
            <label className="form-field">
              <span>Suite</span>
              <select
                className="select"
                value={suite}
                onChange={(e) => setSuite(e.target.value as CreativeSuite)}
              >
                {CREATIVE_SUITES.map((s) => (
                  <option key={s} value={s}>
                    {SUITE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-field">
              <span>Ring audience</span>
              <div
                className="picker-row"
                role="radiogroup"
                aria-label="Ring audience"
              >
                {RING_TYPES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={ring === r}
                    className={
                      ring === r ? "chip picker-chip is-active" : "chip picker-chip"
                    }
                    onClick={() => setRing(r)}
                  >
                    {capitalize(r)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleCopy()}
              >
                Copy text
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={handleExport}
              >
                Export PNG
              </button>
              {copyNote !== null && (
                <span className="saved-note" role="status">
                  {copyNote}
                </span>
              )}
            </div>
            <p className="muted">
              Exporting downloads <em>omega-share.png</em> to this device.
              Sharing it anywhere from there is a separate, manual step —
              this page never posts on your behalf.
            </p>
          </div>
        </section>

        <section aria-label="Share card preview">
          <div className="share-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              role="img"
              aria-label={`Share card preview: ${title.trim() || "Untitled"}, ${SUITE_LABELS[suite]} suite, audience ${ring} ring, by David Charles Bourassa, Quantum Concepts LLC`}
            />
          </div>
          <p className="project-meta" style={{ marginTop: "0.5rem" }}>
            Preview updates as you type — 1200 × 630 card, rendered locally
            in your browser.
          </p>
        </section>
      </div>
    </div>
  );
}
