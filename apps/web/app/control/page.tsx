"use client";

// Operator Control Plane (Notion Branch E) — system status computed
// from real package state where importable, documented status where
// it is not (contracts), plus a live revocation-and-purge mechanism
// demo over @omega/consent-core's own sync API. Every consent decision
// on this page is made by consent-core itself (revokeConsentAndPurge);
// the page keeps no local copy of any access rule.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useState } from "react";
import { AGENT_FABRIC, AI_CORE_SCOPE, AI_CORE_STATUS } from "@omega/ai-core";
import {
  ContextCache,
  SyncEventLog,
  revokeConsentAndPurge,
} from "@omega/consent-core";
import type {
  ConsentReceipt,
  RevokeConsentAndPurgeResult,
} from "@omega/consent-core";
import { LEGACY_ENGINE_SCOPE, LEGACY_ENGINE_STATUS } from "@omega/legacy-engine";
import { ADAPTER_CATALOG } from "@omega/mcp-gateway/catalog";
import { UI_STATUS } from "@omega/ui";

const ADAPTER_TOTALS = {
  adapters: ADAPTER_CATALOG.length,
  working: ADAPTER_CATALOG.filter((a) => a.status === "working").length,
  sandbox: ADAPTER_CATALOG.filter((a) => a.status === "sandbox").length,
  stub: ADAPTER_CATALOG.filter((a) => a.status === "stub").length,
  tools: ADAPTER_CATALOG.reduce((sum, a) => sum + a.tools.length, 0),
  gatedTools: ADAPTER_CATALOG.reduce(
    (sum, a) => sum + a.tools.filter((t) => t.requiresReceipt).length,
    0,
  ),
};

// ---------------------------------------------------------------------------
// Revocation demo — synthetic fixtures, consent-core does the work
// ---------------------------------------------------------------------------

interface RevocationDemoState {
  receipt: ConsentReceipt;
  log: SyncEventLog;
  aiCache: ContextCache;
  connectorCache: ContextCache;
  result: RevokeConsentAndPurgeResult | null;
}

function buildRevocationDemo(): RevocationDemoState {
  const receipt: ConsentReceipt = {
    id: "demo-receipt-revoke-family-001",
    subjectNodeId: "demo-member-1",
    ring: "family",
    purpose: "Revocation demo — synthetic",
    grantedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-revocation",
    adapter: null,
  };
  const aiCache = new ContextCache();
  aiCache.set({
    scope: "ai",
    ownerId: "oracle-demo",
    ring: "family",
    subjectId: "demo-member-1",
    data: { note: "synthetic AI context for the demo subject (family ring)" },
  });
  aiCache.set({
    scope: "ai",
    ownerId: "oracle-demo",
    ring: "friends",
    subjectId: "demo-member-1",
    data: { note: "same subject, different ring — must survive a family purge" },
  });
  aiCache.set({
    scope: "ai",
    ownerId: "oracle-demo",
    ring: "family",
    subjectId: "demo-member-2",
    data: { note: "unrelated subject — must survive" },
  });
  const connectorCache = new ContextCache();
  connectorCache.set({
    scope: "connector",
    ownerId: "connector-demo",
    ring: "family",
    subjectId: "demo-member-1",
    data: { note: "synthetic connector context for the demo subject (family ring)" },
  });
  connectorCache.set({
    scope: "connector",
    ownerId: "connector-demo",
    ring: "family",
    subjectId: "demo-member-2",
    data: { note: "unrelated subject — must survive" },
  });
  return {
    receipt,
    log: new SyncEventLog(),
    aiCache,
    connectorCache,
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Disclosure classification (Notion doc 14 registry, mapped to our routes)
// ---------------------------------------------------------------------------

const CLASSIFICATION: readonly {
  route: string;
  audience: string;
  level: "public-sanitized" | "member-private" | "privileged-private";
}[] = [
  { route: "/public", audience: "Public — anyone, no account", level: "public-sanitized" },
  { route: "/agents", audience: "Member dashboard (synthetic demo data)", level: "member-private" },
  { route: "/demo", audience: "Member dashboard (synthetic demo data)", level: "member-private" },
  { route: "/", audience: "Member — self only", level: "privileged-private" },
  { route: "/cosmos", audience: "Member — self only", level: "privileged-private" },
  { route: "/import", audience: "Member — self only", level: "privileged-private" },
  { route: "/vault", audience: "Member — self only", level: "privileged-private" },
  { route: "/creative", audience: "Member — self only", level: "privileged-private" },
  { route: "/share", audience: "Member — self only", level: "privileged-private" },
  { route: "/oracle", audience: "Member — self only", level: "privileged-private" },
  { route: "/garden", audience: "Member — self only", level: "privileged-private" },
  { route: "/consent", audience: "Member — self only", level: "privileged-private" },
  { route: "/phisplit", audience: "Member — self only (full split visible to the member)", level: "privileged-private" },
  { route: "/control", audience: "Operator — privileged", level: "privileged-private" },
  { route: "/settings", audience: "Member — self only", level: "privileged-private" },
];

const RUNBOOKS: readonly { name: string; state: string; detail: string }[] = [
  {
    name: "Activation Runbook",
    state: "Exists",
    detail: "docs/ACTIVATION_RUNBOOK.md — the hour the Meta Model API key lands.",
  },
  {
    name: "Licence Decision",
    state: "Exists",
    detail: "docs/LICENSE-DECISION.md — licence options and recommendation; decision is the creator's.",
  },
  { name: "Key rotation", state: "PLANNED", detail: "Planned runbook — not yet written." },
  { name: "Connector revocation", state: "PLANNED", detail: "Planned runbook — not yet written." },
  { name: "Ledger reconciliation", state: "PLANNED", detail: "Planned runbook — not yet written." },
  { name: "AI drift review", state: "PLANNED", detail: "Planned runbook — not yet written." },
];

export default function ControlPage() {
  const [demo, setDemo] = useState<RevocationDemoState>(buildRevocationDemo);

  const beforeAi = 3;
  const beforeConnector = 2;
  const afterAi = demo.result !== null ? demo.aiCache.size : null;
  const afterConnector = demo.result !== null ? demo.connectorCache.size : null;

  function revoke() {
    if (demo.result !== null) return;
    const result = revokeConsentAndPurge({
      receipt: demo.receipt,
      log: demo.log,
      caches: [demo.aiCache, demo.connectorCache],
      now: new Date(),
    });
    setDemo({ ...demo, result });
  }

  return (
    <>
      <h1 className="page-title">
        Operator Control <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The operator control plane: system status computed from the real
        packages where they can be imported, documented status (labeled as
        documentation) where they cannot, the disclosure classification of
        every route, and a live revocation demo. This surface is
        privileged-private — it belongs inside the access-controlled
        dashboard, never on the public shell.
      </p>

      <div className="card">
        <h2>Package status — computed from imports</h2>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Status</th>
              <th scope="col">Scope / detail</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>@omega/ai-core</td>
              <td><span className="cell-allow">{AI_CORE_STATUS}</span></td>
              <td>{AI_CORE_SCOPE}</td>
              <td>Imported constants (AI_CORE_STATUS / AI_CORE_SCOPE)</td>
            </tr>
            <tr>
              <td>Agent fabric</td>
              <td><span className="cell-allow">{AGENT_FABRIC.length} agents</span></td>
              <td>
                {AGENT_FABRIC.map((agent) => agent.name).join(" · ")}
              </td>
              <td>Imported registry (AGENT_FABRIC)</td>
            </tr>
            <tr>
              <td>@omega/legacy-engine</td>
              <td><span className="cell-allow">{LEGACY_ENGINE_STATUS}</span></td>
              <td>{LEGACY_ENGINE_SCOPE}</td>
              <td>Imported constants (LEGACY_ENGINE_STATUS / LEGACY_ENGINE_SCOPE)</td>
            </tr>
            <tr>
              <td>@omega/ui</td>
              <td>{UI_STATUS}</td>
              <td>Canonical type surfaces only — no component library yet.</td>
              <td>Imported constant (UI_STATUS)</td>
            </tr>
            <tr>
              <td>@omega/mcp-gateway — catalog</td>
              <td>
                <span className="cell-allow">
                  {ADAPTER_TOTALS.adapters} adapters
                </span>
              </td>
              <td>
                {ADAPTER_TOTALS.working} working · {ADAPTER_TOTALS.sandbox}{" "}
                sandbox · {ADAPTER_TOTALS.stub} stub · {ADAPTER_TOTALS.tools}{" "}
                tools ({ADAPTER_TOTALS.gatedTools} receipt-gated)
              </td>
              <td>Imported catalog (ADAPTER_CATALOG, pure subpath)</td>
            </tr>
            <tr>
              <td>@omega/consent-core — sync &amp; purge</td>
              <td><span className="cell-allow">WORKING</span></td>
              <td>
                SyncEventLog, ContextCache, and revokeConsentAndPurge are
                imported by this page — the revocation demo below runs on
                them.
              </td>
              <td>Imported classes / function (live demo below)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Adapter table — from the catalog</h2>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Adapter</th>
              <th scope="col">Status</th>
              <th scope="col">Tools</th>
              <th scope="col">Receipt-gated tools</th>
            </tr>
          </thead>
          <tbody>
            {ADAPTER_CATALOG.map((adapter) => (
              <tr key={adapter.id}>
                <td>{adapter.displayName}</td>
                <td style={{ textTransform: "capitalize" }}>{adapter.status}</td>
                <td>{adapter.tools.length}</td>
                <td>{adapter.tools.filter((t) => t.requiresReceipt).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          Source: imported <code>ADAPTER_CATALOG</code> from{" "}
          <code>@omega/mcp-gateway/catalog</code>. “Working” adapters run
          over local, fixture, or sandbox data — no live external accounts.
        </p>
      </div>

      <div className="card">
        <h2>Contracts — documented status</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Source: <strong>documentation</strong> (the status tables in{" "}
          <code>README.md</code> / <code>HACKATHON.md</code> in this
          repository) — not imported code and not a deployment record.
          Nothing here is deployed.
        </p>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Contract</th>
              <th scope="col">Documented status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PhiSplitRouter / ReserveVault / MerkleAnchor</td>
              <td>
                Tested (Foundry suite) · <strong>unaudited</strong> ·
                testnet-grade · not deployed
              </td>
            </tr>
            <tr>
              <td>MemberPool / TreasuryRegistry</td>
              <td>Scaffold stubs · unaudited · not deployed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Revocation demo — revoke &amp; purge</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          A <strong>local mechanism demo over synthetic data</strong>: one
          demo consent receipt (subject demo-member-1, family ring) and two{" "}
          <code>ContextCache</code> instances — AI scope and connector
          scope — pre-populated with entries for that subject and ring,
          plus entries for an unrelated subject (and one same-subject,
          different-ring entry). Pressing the button calls consent-core&apos;s{" "}
          <code>revokeConsentAndPurge</code> — the package makes the
          decision and performs the purge; this page only renders the
          result.
        </p>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Cache</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>AI context cache</td>
              <td>{beforeAi} entries</td>
              <td>{afterAi === null ? "—" : `${afterAi} entries`}</td>
            </tr>
            <tr>
              <td>Connector context cache</td>
              <td>{beforeConnector} entries</td>
              <td>{afterConnector === null ? "—" : `${afterConnector} entries`}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: "0.8rem 0" }}>
          <button
            type="button"
            className="btn btn-gold"
            onClick={revoke}
            disabled={demo.result !== null}
          >
            Revoke &amp; purge
          </button>{" "}
          <button
            type="button"
            className="btn"
            onClick={() => setDemo(buildRevocationDemo())}
          >
            Reset demo
          </button>
        </p>
        {demo.result !== null && (
          <div aria-live="polite">
            <p style={{ margin: "0 0 0.5rem" }}>
              Purged entries:{" "}
              <strong>{demo.result.purgedCount}</strong> — only the demo
              subject&apos;s family-ring entries. The unrelated subject and
              the different-ring entry survive, because the purge is scoped
              to subject + ring by consent-core.
            </p>
            <h3 style={{ color: "var(--gold)" }}>Emitted sync events</h3>
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Ring</th>
                </tr>
              </thead>
              <tbody>
                {demo.result.events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.type}</td>
                    <td>{event.subjectId}</td>
                    <td>{event.ring}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Disclosure classification — every route</h2>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Audience</th>
              <th scope="col">Disclosure level</th>
            </tr>
          </thead>
          <tbody>
            {CLASSIFICATION.map((row) => (
              <tr key={row.route}>
                <td>{row.route}</td>
                <td>{row.audience}</td>
                <td>{row.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          Public surfaces are disclosure-filtered by the Public Disclosure
          Rule; the dashboard — including PhiSplit, where the full split is
          legitimately visible to the member alone — is a member/personal
          console and access-controlled.
        </p>
      </div>

      <div className="card">
        <h2>Runbooks</h2>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Runbook</th>
              <th scope="col">State</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {RUNBOOKS.map((runbook) => (
              <tr key={runbook.name}>
                <td>{runbook.name}</td>
                <td>
                  <span
                    className={
                      runbook.state === "Exists" ? "cell-allow" : undefined
                    }
                  >
                    {runbook.state}
                  </span>
                </td>
                <td>{runbook.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
