"use client";

// Overview — platform-at-a-glance dashboard for the Omega Platform.
// All figures are computed live from the real packages (cosmos-engine
// demo data, consent-core ring set, economic-kernel splitPhi) or read
// defensively from this browser's local stores. No real member data.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createDemoCosmos } from "@omega/cosmos-engine/data";
import { RING_TYPES } from "@omega/consent-core";
import { splitPhi } from "@omega/economic-kernel";
import { readActivity, type ActivityEntry } from "@/lib/activity";
import { useDataset } from "@/lib/dataset";

const VAULT_INDEX_KEY = "omega.vault.index.v1";
const DEMO_FLOW_MINOR = 250000_00n; // $250,000.00 demo flow

function formatMoney(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const dollars = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${cents}`;
}

/** Exact percentage (7 decimal places) via bigint math — no floats. */
function percentString(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0.0000000%";
  const scaled = (part * 100n * 10_000_000n + whole / 2n) / whole;
  const intPart = scaled / 10_000_000n;
  const fracPart = (scaled % 10_000_000n).toString().padStart(7, "0");
  return `${intPart}.${fracPart}%`;
}

function readVaultCount(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(VAULT_INDEX_KEY);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { items?: unknown }).items)
    ) {
      return (parsed as { items: unknown[] }).items.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

const QUICK_ACTIONS: readonly { href: string; title: string; text: string }[] = [
  { href: "/cosmos", title: "Cosmos", text: "Explore the 3D consent cosmos, the simulated universe, and the speculative multiverse." },
  { href: "/import", title: "Import Archive", text: "Import a Facebook export — parsed locally in this browser, nothing uploaded." },
  { href: "/vault", title: "Vault", text: "Encrypt and store items locally with client-side cryptography." },
  { href: "/creative", title: "Creative Suites", text: "Art, music, video, and writing studios that hand drafts to the Share Center." },
  { href: "/share", title: "Share Center", text: "Publish drafts to a consent ring — exact-ring, deny by default." },
  { href: "/oracle", title: "AI Oracle", text: "Ask the assistant. Runs on the labeled offline fallback / guardian until a live model key is connected." },
  { href: "/consent", title: "Consent Rings", text: "See the four rings and a live access matrix computed by the real consent core." },
  { href: "/phisplit", title: "PhiSplit", text: "Split any amount by the recursive φ rule and watch level-2 recursion reconcile exactly." },
  { href: "/settings", title: "Settings", text: "Profile, connection status, and display preferences for the Cosmos page." },
];

export default function OverviewPage() {
  const { state: datasetState } = useDataset();
  const importedGraph =
    datasetState.kind === "imported" ? datasetState.graph : null;
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [vaultCount, setVaultCount] = useState(0);

  const cosmos = useMemo(() => createDemoCosmos(7, 2000), []);
  const perRing = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of cosmos.nodes) {
      counts.set(node.ring, (counts.get(node.ring) ?? 0) + 1);
    }
    return counts;
  }, [cosmos]);

  const flow = useMemo(() => splitPhi(DEMO_FLOW_MINOR), []);

  useEffect(() => {
    const refresh = () => {
      setActivity(readActivity());
      setVaultCount(readVaultCount());
    };
    refresh();
    window.addEventListener("omega:activity", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("omega:activity", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <>
      <h1 className="page-title">
        Overview <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The Omega Platform dashboard — a consent-first social cosmos, an
        encrypted vault, creative suites, and a φ-proportioned economic
        kernel. Everything below is computed from the real packages or read
        from this browser; all demo data is synthetic.
      </p>

      <div className="card-grid">
        {importedGraph ? (
          <div className="card">
            <span className="stat-label">Active dataset</span>
            <span className="stat-value">Imported archive</span>
            <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
              {importedGraph.ownerName} ·{" "}
              {importedGraph.people.length.toLocaleString()} people ·{" "}
              {importedGraph.summary.postCount.toLocaleString()} posts ·{" "}
              {importedGraph.summary.mediaCount.toLocaleString()} media ·{" "}
              {importedGraph.summary.threadCount.toLocaleString()} threads
              <br />
              <Link href="/import">Open Import Archive →</Link>
            </p>
          </div>
        ) : (
          <div className="card">
            <span className="stat-label">Demo cosmos nodes</span>
            <span className="stat-value">{cosmos.nodes.length.toLocaleString()}</span>
            <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
              {RING_TYPES.map(
                (ring) => `${ring} ${(perRing.get(ring) ?? 0).toLocaleString()}`,
              ).join(" · ")}
            </p>
          </div>
        )}
        <div className="card">
          <span className="stat-label">Consent rings</span>
          <span className="stat-value">{RING_TYPES.length}</span>
          <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
            Family · Friends · Work · Public — exact-ring access, deny by
            default.
          </p>
        </div>
        <div className="card">
          <span className="stat-label">Vault items (this browser)</span>
          <span className="stat-value">{vaultCount.toLocaleString()}</span>
          <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
            Counted from the local vault index. Contents stay encrypted on
            this device.
          </p>
        </div>
        <div className="card">
          <span className="stat-label">PhiSplit demo flow</span>
          <span className="stat-value">{formatMoney(DEMO_FLOW_MINOR)}</span>
          <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
            Trust {formatMoney(flow.trust)} · Members{" "}
            {formatMoney(flow.members)} · Ops {formatMoney(flow.ops)}
          </p>
        </div>
      </div>

      <div className="card">
        <h2>PhiSplit demo flow — {formatMoney(DEMO_FLOW_MINOR)}</h2>
        <div className="split-bar" aria-hidden="true">
          <div
            className="split-seg seg-trust"
            style={{ width: percentString(flow.trust, DEMO_FLOW_MINOR) }}
          />
          <div
            className="split-seg seg-members"
            style={{ width: percentString(flow.members, DEMO_FLOW_MINOR) }}
          />
          <div
            className="split-seg seg-ops"
            style={{ width: percentString(flow.ops, DEMO_FLOW_MINOR) }}
          />
        </div>
        <p style={{ margin: 0, fontSize: "0.92rem" }}>
          Trust <strong className="money">{formatMoney(flow.trust)}</strong> (
          {percentString(flow.trust, DEMO_FLOW_MINOR)}) · Members{" "}
          <strong className="money">{formatMoney(flow.members)}</strong> (
          {percentString(flow.members, DEMO_FLOW_MINOR)}) · Operations{" "}
          <strong className="money">{formatMoney(flow.ops)}</strong> (
          {percentString(flow.ops, DEMO_FLOW_MINOR)}). The three streams
          always sum back to the gross — exact bigint math, no floats.{" "}
          <Link href="/phisplit">Open the interactive visualizer →</Link>
        </p>
      </div>

      <h2>Quick actions</h2>
      <div className="quick-grid">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="quick-card">
            <h3>{action.title}</h3>
            <p>{action.text}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2>Recent activity</h2>
        {activity.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No activity recorded yet in this browser. Actions across the
            platform — cosmos views, vault items, shares, splits — will
            appear here as they happen.
          </p>
        ) : (
          <div>
            {activity.slice(0, 10).map((entry, i) => (
              <div className="feed-item" key={`${entry.ts}-${i}`}>
                <time dateTime={new Date(entry.ts).toISOString()}>
                  {new Date(entry.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <span className="feed-kind">{entry.kind}</span>
                <p>{entry.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>What is working vs scaffold — the honest summary</h2>
        <p style={{ marginBottom: "0.2rem" }}>
          <span className="badge badge-live">Working</span>
        </p>
        <ul className="status-list">
          <li>Cosmos engine — the real Three.js renderer (consent cosmos).</li>
          <li>Universe mode — simulated cosmic web built from the engine&apos;s universe data generator.</li>
          <li>Vault crypto — client-side encryption for local vault items.</li>
          <li>φ kernel — the exact recursive PhiSplit (bigint) used across the platform.</li>
          <li>Consent core — exact-ring, deny-by-default access checks.</li>
          <li>Oracle — offline / guardian mode, clearly labeled wherever it answers.</li>
        </ul>
        <p style={{ marginBottom: "0.2rem" }}>
          <span className="badge">Scaffold</span>
        </p>
        <ul className="status-list">
          <li>MCP gateway — interface scaffold; no live connectors wired yet.</li>
          <li>Legacy engine — preserved scaffold for the legacy garden surface.</li>
        </ul>
        <p style={{ marginBottom: "0.2rem" }}>
          <span className="badge badge-offline">Not connected</span>
        </p>
        <ul className="status-list" style={{ marginBottom: 0 }}>
          <li>Facebook overlay — design intent only; nothing is connected to Facebook.</li>
          <li>Meta Model API — no key connected; the Oracle does not call a live model.</li>
        </ul>
      </div>
    </>
  );
}
