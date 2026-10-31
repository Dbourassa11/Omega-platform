"use client";

// DemoGuide — the clickable step-through of the HACKATHON.md §6
// two-minute demo script. Six beats, one at a time, with the script's
// caption and the exact presenter action for each.
//
// Honesty contract (do not weaken):
//  - Beats 1–3 drive the REAL CosmosCanvas mounted below — its own
//    node-count select, node click → fly-to, and ring switcher are the
//    controls the presenter uses. Nothing is simulated.
//  - Beats 4–5 happen on the Oracle page. That page does not accept
//    query parameters, so this guide does NOT pretend to prefill a
//    question: the step says exactly which chip the presenter clicks
//    there, and deep-links to /oracle.
//  - Beat 6 shows the exact PhiSplit percentages from §6 and links to
//    the live /phisplit visualizer (exact bigint math).
// Everything runs offline; demo data is synthetic and labeled in-product.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useCallback, useState } from "react";
import Link from "next/link";
import CosmosCanvas from "@/components/CosmosCanvas";

export interface DemoStep {
  id: string;
  time: string;
  title: string;
  /** Narration / caption text, from the §6 script. */
  caption: string;
  /** What the presenter actually does — never dressed up as automation. */
  presenterAction: string;
  drive: "cosmos-live" | "presenter-link" | "split-card";
  cta?: { href: string; label: string };
}

export const DEMO_STEPS: readonly DemoStep[] = [
  {
    id: "hook",
    time: "0:00–0:15",
    title: "Hook — your graph, as a cosmos",
    caption:
      "“Your Facebook graph, as a living cosmos you actually own.” Cold open on the cosmos at 2,000 nodes, slow orbit.",
    presenterAction:
      "Presenter: in the live cosmos below, set “Demo nodes” to 2,000 and let it slow-orbit. (It loads at 600; the select is the real engine control.)",
    drive: "cosmos-live",
  },
  {
    id: "fly-to",
    time: "0:15–0:40",
    title: "Fly-through — click a node",
    caption:
      "Cosmos fly-through: nebula, starfield, bloom. Click a node — fly-to-node, inspection panel opens.",
    presenterAction:
      "Presenter: click any node in the cosmos below. The engine flies the camera to it and the inspection panel opens — that click is the demo, nothing is scripted. For scale, the node-count select also offers 5,000.",
    drive: "cosmos-live",
  },
  {
    id: "ring-switch",
    time: "0:40–1:05",
    title: "The ring switch — Public → Family",
    caption:
      "Switch Public → Family. The universe re-lights: ring shells change, nodes outside the ring dim out. What changed is what the AI may see. Consent is visual, not a settings page.",
    presenterAction:
      "Presenter: in the ring switcher below, click “Public”, pause, then click “Family”. Out-of-ring nodes dim and the Family shell brightens — the same switch the Oracle respects in the next beats.",
    drive: "cosmos-live",
  },
  {
    id: "oracle",
    time: "1:05–1:35",
    title: "Ask the Oracle — in-ring answer",
    caption:
      "Ask the Oracle a question. Ring-scoped answer with citations, grounded only in in-ring demo data. Provenance label visible on the answer.",
    presenterAction:
      "Presenter: open the Oracle, set the active ring to Family (to match the previous beat), then click the “Tell me about …” suggestion chip. The answer cites in-ring nodes only. The Oracle page takes no prefilled question from this guide — the chip click is the action. Its badge honestly labels the backend: offline fallback unless a Meta Model API key is connected.",
    drive: "presenter-link",
    cta: { href: "/oracle", label: "Open the Oracle →" },
  },
  {
    id: "guardian",
    time: "1:35–1:50",
    title: "Guardian refusal — the boundary holds",
    caption:
      "Ask a question that reaches outside the current ring. The Guardian refuses — visibly, with the ring boundary named. Cut on the refusal; it is the product.",
    presenterAction:
      "Presenter: on the Oracle page, click the “Try crossing a ring →” chip. The Guardian refuses and names the boundary ring it protected. No data crosses; the refusal is shown in the conversation, not hidden in a log.",
    drive: "presenter-link",
    cta: { href: "/oracle", label: "Open the Oracle →" },
  },
  {
    id: "close",
    time: "1:50–2:00",
    title: "Close — Trust Beacon & PhiSplit",
    caption:
      "Zoom to the Trust Beacon: particle flow showing value moving by design — PhiSplit: Trust 61.8033988% / Members 23.6067976% / Operations 14.5898036%. Final line: “Built on Facebook. Powered by Meta's own AI stack. Owned by you.”",
    presenterAction:
      "Presenter: the Trust Beacon is the gold core at the center of the cosmos (previous steps). The exact split is shown below and computed live — to the cent, exact bigint math — on the PhiSplit page.",
    drive: "split-card",
    cta: { href: "/phisplit", label: "Open PhiSplit →" },
  },
] as const;

const SPLIT_ROWS = [
  { label: "Trust", pct: "61.8033988%", width: "61.8033988%", cls: "demo-seg-trust" },
  { label: "Members", pct: "23.6067976%", width: "23.6067976%", cls: "demo-seg-members" },
  { label: "Operations", pct: "14.5898036%", width: "14.5898036%", cls: "demo-seg-ops" },
] as const;

export default function DemoGuide() {
  const [index, setIndex] = useState(0);
  const step = DEMO_STEPS[index] ?? DEMO_STEPS[0];
  if (step === undefined) return null;
  const go = useCallback(
    (next: number) => {
      setIndex(Math.min(DEMO_STEPS.length - 1, Math.max(0, next)));
    },
    [],
  );

  return (
    <div className="demo-guide">
      <ol className="demo-progress" aria-label="Demo steps">
        {DEMO_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={i === index ? "demo-dot is-active" : "demo-dot"}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => go(i)}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>

      <section className="card demo-step-card" aria-live="polite">
        <p className="demo-step-meta">
          Step {index + 1} of {DEMO_STEPS.length} · {step.time} ·{" "}
          {step.drive === "cosmos-live"
            ? "Live engine below — presenter drives it"
            : step.drive === "presenter-link"
              ? "Presenter action on the linked page"
              : "Exact values — live page linked"}
        </p>
        <h2>{step.title}</h2>
        <p className="demo-caption">{step.caption}</p>
        <p className="demo-action">
          <strong>Do this:</strong> {step.presenterAction}
        </p>
        {step.cta !== undefined && (
          <p>
            <Link className="btn btn-gold" href={step.cta.href}>
              {step.cta.label}
            </Link>
          </p>
        )}
        {step.drive === "split-card" && (
          <div className="demo-split" aria-label="PhiSplit exact percentages">
            <div className="demo-split-bar" aria-hidden="true">
              {SPLIT_ROWS.map((row) => (
                <div
                  key={row.label}
                  className={`demo-split-seg ${row.cls}`}
                  style={{ width: row.width }}
                />
              ))}
            </div>
            <ul className="demo-split-list">
              {SPLIT_ROWS.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span> <strong>{row.pct}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* The real engine, mounted once for beats 1–3 and kept mounted
          while stepping between them. */}
      {step.drive === "cosmos-live" && (
        <div className="demo-cosmos-embed">
          <CosmosCanvas />
        </div>
      )}

      <div className="demo-nav">
        <button
          type="button"
          className="btn"
          aria-label="Previous beat"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <span aria-hidden="true">←</span> Previous beat
        </button>
        <button
          type="button"
          className="btn btn-primary"
          aria-label="Next beat"
          disabled={index === DEMO_STEPS.length - 1}
          onClick={() => go(index + 1)}
        >
          Next beat <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
