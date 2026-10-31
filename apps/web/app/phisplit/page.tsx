"use client";

// PhiSplit — interactive visualizer for the recursive φ kernel.
// Enter a gross amount; level 1 splits it into Trust / Members /
// Operations, and level 2 applies splitPhi again to each stream.
// Invariant: trust + members + ops === gross, always — exact bigint
// math, no floats anywhere in the money path.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useMemo, useState } from "react";
import Link from "next/link";
import { splitPhi, type PhiSplit } from "@omega/economic-kernel";
import { logActivity } from "@/lib/activity";

const STREAMS = [
  { key: "trust", label: "Trust", seg: "seg-trust" },
  { key: "members", label: "Members", seg: "seg-members" },
  { key: "ops", label: "Operations", seg: "seg-ops" },
] as const;
type StreamKey = (typeof STREAMS)[number]["key"];

/** Parse a dollar string ("250,000.50") to minor units (bigint cents). */
function parseDollarsToMinor(raw: string): bigint | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return 0n;
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const parts = cleaned.split(".");
  const dollarsPart = parts[0] ?? "";
  const centsPart = parts[1] ?? "";
  const dollars = BigInt(dollarsPart === "" ? "0" : dollarsPart);
  const cents = BigInt((centsPart + "00").slice(0, 2));
  return dollars * 100n + cents;
}

function formatMoney(minor: bigint): string {
  const dollars = (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (minor % 100n).toString().padStart(2, "0");
  return `$${dollars}.${cents}`;
}

/** Exact percentage (7 decimal places) via bigint math — no floats. */
function percentString(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0.0000000%";
  const scaled = (part * 100n * 10_000_000n + whole / 2n) / whole;
  const intPart = scaled / 10_000_000n;
  const fracPart = (scaled % 10_000_000n).toString().padStart(7, "0");
  return `${intPart}.${fracPart}%`;
}

function widthPct(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0%";
  return `${(Number(part) / Number(whole)) * 100}%`;
}

function StreamBar({ split, total }: { split: PhiSplit; total: bigint }) {
  return (
    <div className="split-bar small" aria-hidden="true">
      {STREAMS.map((s) => (
        <div
          key={s.key}
          className={`split-seg ${s.seg}`}
          style={{ width: widthPct(split[s.key], total) }}
        />
      ))}
    </div>
  );
}

export default function PhiSplitPage() {
  const [input, setInput] = useState("250000");
  const gross = parseDollarsToMinor(input);
  const valid = gross !== null;

  const level1: PhiSplit = useMemo(
    () => (valid ? splitPhi(gross) : { trust: 0n, members: 0n, ops: 0n }),
    [gross, valid],
  );
  const level2: Record<StreamKey, PhiSplit> = useMemo(
    () => ({
      trust: splitPhi(level1.trust),
      members: splitPhi(level1.members),
      ops: splitPhi(level1.ops),
    }),
    [level1],
  );

  const reconciles =
    valid && level1.trust + level1.members + level1.ops === gross;

  return (
    <>
      <h1 className="page-title">PhiSplit</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The PhiSplit Economic Kernel routes value by the recursive φ rule:
        Trust takes φ of the gross (61.8033988%), Members take φ of the
        remainder (23.6067976% of gross), and Operations take what is left
        (14.5898036%). The invariant is absolute:{" "}
        <strong>trust + members + ops === gross, always</strong> — exact
        bigint math, no floats, so the streams reconcile to the cent on
        every amount.
      </p>

      <div className="card">
        <h2>Disclosure classification — member/personal console</h2>
        <p style={{ margin: 0 }}>
          <span className="badge badge-gold">Privileged-private</span>{" "}
          This page is the <strong>member/personal console</strong>: the
          full split is legitimately visible here to the member alone,
          because this surface is access-controlled and personal. Public
          surfaces show only the member dispersion total — see the{" "}
          <Link href="/public">Public Platform shell</Link> for exactly
          what a public audience receives.
        </p>
      </div>

      <div className="card">
        <h2>Gross amount</h2>
        <div className="field" style={{ maxWidth: "22rem" }}>
          <label htmlFor="gross-input">Amount in dollars</label>
          <input
            id="gross-input"
            className="input"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {
              if (valid) {
                logActivity("phisplit", `Split ${formatMoney(gross)} by the φ rule`);
              }
            }}
            placeholder="e.g. 250000"
            aria-invalid={!valid}
          />
        </div>
        {!valid && (
          <p style={{ color: "var(--red)", margin: 0 }}>
            Enter a non-negative dollar amount with at most two decimal
            places.
          </p>
        )}
        {valid && (
          <p className="muted" style={{ margin: 0 }}>
            Gross: <strong className="money">{formatMoney(gross)}</strong> (
            {gross.toLocaleString()} minor units) · Reconciliation:{" "}
            {reconciles ? (
              <span className="cell-allow">
                trust + members + ops === gross ✓
              </span>
            ) : (
              <span className="cell-deny">does not reconcile</span>
            )}
          </p>
        )}
      </div>

      {valid && (
        <>
          <div className="card">
            <h2>Level 1 — the φ split</h2>
            <div className="split-bar" aria-hidden="true">
              {STREAMS.map((s) => (
                <div
                  key={s.key}
                  className={`split-seg ${s.seg}`}
                  style={{ width: widthPct(level1[s.key], gross) }}
                />
              ))}
            </div>
            <div className="split-legend">
              {STREAMS.map((s) => (
                <span key={s.key}>
                  <span className={`swatch ${s.seg}`} aria-hidden="true" />
                  {s.label}:{" "}
                  <strong className="money">{formatMoney(level1[s.key])}</strong>{" "}
                  <span className="muted">
                    ({percentString(level1[s.key], gross)})
                  </span>
                </span>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              Operations absorbs the sub-cent rounding remainder, which is
              exactly why the three streams always sum back to the gross.
            </p>
          </div>

          <div className="card">
            <h2>Level 2 — recursion into each stream</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              The same φ rule applied again inside each level-1 stream. Each
              sub-split also reconciles exactly to its parent stream.
            </p>
            <ul className="split-tree">
              {STREAMS.map((parent) => {
                const sub = level2[parent.key];
                const parentTotal = level1[parent.key];
                return (
                  <li key={parent.key}>
                    <h4>
                      {parent.label} —{" "}
                      <span className="money">{formatMoney(parentTotal)}</span>
                    </h4>
                    <StreamBar split={sub} total={parentTotal} />
                    <p className="split-sub" style={{ margin: 0 }}>
                      {STREAMS.map((s) => (
                        <span key={s.key}>
                          {s.label}{" "}
                          <span className="money">{formatMoney(sub[s.key])}</span>{" "}
                          ({percentString(sub[s.key], parentTotal)})
                          {s.key !== "ops" ? " · " : ""}
                        </span>
                      ))}
                      {" — "}
                      {sub.trust + sub.members + sub.ops === parentTotal
                        ? "sums to parent ✓"
                        : "does not reconcile"}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="muted" style={{ fontSize: "0.88rem", marginBottom: 0 }}>
              Nine level-2 leaves, three exact reconciliations per level, one
              invariant at every depth: nothing is created or lost to
              rounding.
            </p>
          </div>
        </>
      )}
    </>
  );
}
