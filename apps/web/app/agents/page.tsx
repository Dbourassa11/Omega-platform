"use client";

// Omni-AI Agents — the canonical 8-agent fabric from @omega/ai-core.
// The registry below is rendered FROM AGENT_FABRIC data (no hard-coded
// agent prose), and the console runs canned tasks through the real
// runAgentTask runtime: Intent → Ring → Consent Check → Retrieval →
// Response → Receipt. Every access decision is made inside ai-core /
// consent-core (the Guardian gate calls canAccess) — this page never
// inspects a receipt itself. Demo receipts are synthetic fixtures.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useMemo, useState } from "react";
import {
  AGENT_FABRIC,
  KNOWN_AGENT_DEFINITIONS,
  OfflineStubProvider,
  SEED_SKILLS,
  demoReceiptForRing,
  fabricToOmniDefinition,
  getMetaApiStatus,
  runAgentTask,
} from "@omega/ai-core";
import AgentSkills from "@/components/AgentSkills";
import type {
  AgentFabricId,
  AgentTask,
  AgentTaskResult,
  ConnectorCatalogProvider,
  OracleNodeRef,
} from "@omega/ai-core";
import { RING_TYPES } from "@omega/consent-core";
import type { ConsentReceipt, RingType } from "@omega/consent-core";
import { ADAPTER_CATALOG } from "@omega/mcp-gateway/catalog";

const SUBJECT = "member-demo-001";

/** Synthetic demo receipt fixture for a ring (same shape as the tests). */
function demoReceipt(ring: RingType): ConsentReceipt {
  return {
    id: `demo-receipt-${ring}-001`,
    subjectNodeId: SUBJECT,
    ring,
    purpose: "Agent fabric demo",
    grantedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-agent-fabric",
    adapter: null,
  };
}

const ORACLE_NODES: readonly OracleNodeRef[] = [
  { id: "node-post-001", label: "Launch Announcement", ring: "public", kind: "post" },
  { id: "node-photo-001", label: "Cover Photo", ring: "public", kind: "photo" },
  { id: "node-journal-001", label: "Journal — Demo Member 001", ring: "family", kind: "journal" },
];

/**
 * Connector catalog provider built from the pure ADAPTER_CATALOG
 * subpath — listAdapters / listTools only. There is no execute path,
 * exactly as the Connector agent's contract requires.
 */
const connectorCatalogProvider: ConnectorCatalogProvider = {
  listAdapters: () =>
    ADAPTER_CATALOG.map((adapter) => ({
      id: adapter.id,
      name: adapter.displayName,
      description: `${adapter.displayName} adapter — catalog status: ${adapter.status}`,
      dataCategories: [],
      riskLevel: "low" as const,
    })),
  listTools: (adapterId: string) => {
    const adapter = ADAPTER_CATALOG.find((entry) => entry.id === adapterId);
    if (adapter === undefined) return [];
    return adapter.tools.map((tool) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description,
      dataCategories: [],
      riskLevel: tool.riskLevel,
    }));
  },
};

const DEFAULT_RING: Record<AgentFabricId, RingType> = {
  oracle: "public",
  guardian: "family",
  "memory-curator": "family",
  avatar: "public",
  "legacy-mirror": "family",
  studio: "public",
  connector: "family",
  steward: "public",
};

const CANNED_LABEL: Record<AgentFabricId, string> = {
  oracle: "Canned task: a demo question — “Tell me about Cover Photo”",
  guardian: "Canned task: explain access for the selected ring with a demo receipt",
  "memory-curator": "Canned task: audit the synthetic archive (vault + consistency)",
  avatar: "Canned task: build a public card from a profile carrying private fields",
  "legacy-mirror":
    "Canned task: a supported question — “Tell me about the lighthouse at Port Anselm” (disclosure shown)",
  studio: "Canned task: scaffold a poem draft on “the returning tide”",
  connector:
    "Canned task: prepare a meta-export graph.listPeople call for human approval (preview only, never executes)",
  steward:
    "Canned task: explain a 25,000,000 minor-unit amount for a member (public) audience — only the member dispersion total is returned",
};

function buildTask(agentId: AgentFabricId, ring: RingType): AgentTask {
  switch (agentId) {
    case "oracle":
      return {
        agentId,
        input: { query: "Tell me about Cover Photo" },
        ring,
        receipts: [demoReceipt(ring)],
      };
    case "guardian": {
      const receipt = demoReceipt(ring);
      return {
        agentId,
        input: { ring, subjectId: SUBJECT, receipts: [receipt] },
        ring,
        receipts: [receipt],
      };
    }
    case "memory-curator":
      return { agentId, input: {}, ring, receipts: [demoReceipt(ring)] };
    case "avatar":
      return {
        agentId,
        input: {
          displayName: "Demo Member",
          handle: "@demo",
          publicBio: "Building in public.",
          publicProgramStatus: "simulation",
          email: "demo@example.invalid",
          privateNote: "synthetic private field — must be dropped",
        },
        ring,
        receipts: [],
      };
    case "legacy-mirror":
      return {
        agentId,
        input: { question: "Tell me about the lighthouse at Port Anselm" },
        ring,
        // Demo fixture via ai-core's own legacy demo pattern.
        receipts: [demoReceiptForRing(ring)],
      };
    case "studio":
      return {
        agentId,
        input: { kind: "poem", theme: "the returning tide" },
        ring,
        receipts: [],
      };
    case "connector":
      return {
        agentId,
        input: {
          adapterId: "meta-export",
          tool: "graph.listPeople",
          purpose: "Prepare a ring-scoped people listing for human approval",
          ring,
        },
        ring,
        receipts: [],
      };
    case "steward":
      return {
        agentId,
        input: { amountMinor: "25000000", audience: "public" },
        ring,
        receipts: [],
      };
  }
}

/** Bigint-safe JSON for receipt rendering (never stringify a bigint raw). */
function safeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, entry: unknown) =>
      typeof entry === "bigint" ? `${entry.toString()}n` : entry,
    2,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function capitalize(text: string): string {
  return text.length === 0
    ? text
    : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export default function AgentsPage() {
  const [agentId, setAgentId] = useState<AgentFabricId>("oracle");
  const [ring, setRing] = useState<RingType>("public");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentTaskResult | null>(null);

  // Environment status from ai-core's single signal. An explicit empty
  // env is passed because a browser page has no server env: the badge
  // honestly reads OFFLINE here — "live" would only mean a key is
  // configured, never that a call succeeded.
  const metaStatus = useMemo(() => getMetaApiStatus({}), []);

  const selected = useMemo(
    () => AGENT_FABRIC.find((agent) => agent.id === agentId),
    [agentId],
  );

  // Skills library holders, derived from the same registry/fabric data
  // this page already renders: the fabric mapped through
  // fabricToOmniDefinition plus the known (terra-*/research) definitions.
  const skillHolders = useMemo(() => {
    const holders = new Map<string, string[]>();
    const allDefs = [
      ...AGENT_FABRIC.map((f) => fabricToOmniDefinition(f)),
      ...KNOWN_AGENT_DEFINITIONS,
    ];
    for (const def of allDefs) {
      for (const skillId of def.skillIds ?? []) {
        const list = holders.get(skillId) ?? [];
        list.push(`${def.name} (${def.id})`);
        holders.set(skillId, list);
      }
    }
    return holders;
  }, []);

  function selectAgent(next: AgentFabricId) {
    setAgentId(next);
    setRing(DEFAULT_RING[next]);
    setResult(null);
  }

  async function run() {
    setRunning(true);
    try {
      const outcome = await runAgentTask(buildTask(agentId, ring), {
        chatProvider: new OfflineStubProvider(),
        oracleNodes: ORACLE_NODES,
        connectorCatalog: connectorCatalogProvider,
        env: {},
      });
      setResult(outcome);
    } finally {
      setRunning(false);
    }
  }

  const output = result?.output;
  const stewardTotal =
    isRecord(output) && typeof output.memberDispersionTotal === "bigint"
      ? output.memberDispersionTotal
      : null;
  const legacyDisclosure =
    isRecord(output) && typeof output.disclosure === "string"
      ? output.disclosure
      : null;
  const legacyText =
    isRecord(output) && typeof output.text === "string" ? output.text : null;

  return (
    <>
      <h1 className="page-title">
        Omni-AI Agents <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The Omni-Agentic Core&apos;s canonical agent fabric: eight
        data-driven agents, each scoped to named consent rings, each run
        receipted. The console below runs canned tasks through the real{" "}
        <code>runAgentTask</code> runtime in this browser — consent is
        checked by the Guardian gate inside the fabric before any
        retrieval, and refused tasks retrieve nothing.
      </p>
      <p style={{ marginTop: "0.5rem" }}>
        {metaStatus.mode === "live" ? (
          <span className="badge badge-live">{metaStatus.label}</span>
        ) : (
          <span className="badge badge-offline">{metaStatus.label}</span>
        )}{" "}
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          Environment status: in the browser no Meta Model API key is
          configured, so this reads offline — that is the honest state, and
          the fabric&apos;s deterministic local logic runs the demo.
        </span>
      </p>

      <h2>The fabric — rendered from the registry</h2>
      <div className="card-grid">
        {AGENT_FABRIC.map((agent) => (
          <div className="card" key={agent.id}>
            <h3>{agent.name}</h3>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
              {agent.purpose}
            </p>
            <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
              Guardrail: {agent.guardrail}
            </p>
            <p style={{ margin: "0 0 0.5rem" }}>
              {agent.ringScope.map((scopeRing) => (
                <span key={scopeRing} className="chip" style={{ marginRight: "0.35rem" }}>
                  {scopeRing}
                </span>
              ))}
            </p>
            <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.82rem" }}>
              Tools:{" "}
              {agent.toolAllowlist.length > 0
                ? agent.toolAllowlist.join(", ")
                : "none — retrieval / local projection only"}
            </p>
            <p className="muted" style={{ margin: "0 0 0.6rem", fontSize: "0.82rem" }}>
              Provenance: citations{" "}
              {agent.provenanceRequirements.citations ? "required" : "—"} ·
              disclosure {agent.provenanceRequirements.disclosure ? "required" : "—"}{" "}
              · receipt always · state label{" "}
              {agent.provenanceRequirements.stateLabel ? "required" : "—"}
            </p>
            <AgentSkills definition={fabricToOmniDefinition(agent)} />
            <button
              type="button"
              className={agentId === agent.id ? "btn btn-gold" : "btn"}
              onClick={() => selectAgent(agent.id)}
            >
              {agentId === agent.id ? "Selected for console" : "Load canned task"}
            </button>
          </div>
        ))}
      </div>

      <h2>Skills library</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Skills are data: a named, versioned bundle of gateway tools plus
        the instructions and provenance an agent holding the skill works
        under. At execution a tool step must be covered by BOTH the
        agent&apos;s tool allowlist AND one of its skills — skills compose
        with the allowlist, they never replace it. Rendered from the seed
        library in <code>@omega/ai-core</code>; holders are derived from
        the registry/fabric definitions above plus the known demo agents.
      </p>
      <div className="card-grid">
        {SEED_SKILLS.map((skill) => (
          <div className="card" key={skill.id}>
            <h3>
              {skill.name}{" "}
              <span className="badge badge-offline">v{skill.version}</span>
            </h3>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
              {skill.description}
            </p>
            <p style={{ margin: "0 0 0.5rem" }}>
              {skill.toolIds.map((toolId) => (
                <span key={toolId} className="chip" style={{ marginRight: "0.35rem" }}>
                  {toolId}
                </span>
              ))}
            </p>
            <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.82rem" }}>
              Instructions: {skill.instructionSummary}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Held by:{" "}
              {(skillHolders.get(skill.id) ?? []).length > 0
                ? (skillHolders.get(skill.id) ?? []).join(", ")
                : "no built-in agent yet"}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Agent console — canned tasks, real runtime</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {selected ? CANNED_LABEL[selected.id] : ""} Synthetic demo data
          and demo consent receipts throughout; nothing is sent anywhere,
          and the Connector prepares previews only — it never executes.
        </p>
        <div className="field" style={{ maxWidth: "26rem" }}>
          <label htmlFor="agent-select">Agent</label>
          <select
            id="agent-select"
            className="select"
            value={agentId}
            onChange={(e) => selectAgent(e.target.value as AgentFabricId)}
          >
            {AGENT_FABRIC.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <div
          className="tabs"
          role="radiogroup"
          aria-label="Active consent ring"
        >
          {RING_TYPES.map((ringOption) => (
            <button
              key={ringOption}
              type="button"
              role="radio"
              aria-checked={ring === ringOption}
              className={ring === ringOption ? "tab active" : "tab"}
              onClick={() => setRing(ringOption)}
            >
              {capitalize(ringOption)}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "0.88rem" }}>
          Active ring: <strong>{ring}</strong>
          {selected
            ? ` · ${selected.name} ring scope: ${selected.ringScope.join(", ")} — picking a ring outside the scope is refused by the fabric, which is itself part of the demo.`
            : ""}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={running}
          onClick={() => void run()}
        >
          {running ? "Running…" : `Run ${selected?.name ?? "agent"} task`}
        </button>

        {result !== null && (
          <div style={{ marginTop: "1.1rem" }} aria-live="polite">
            <p style={{ margin: "0 0 0.6rem" }}>
              <span
                className={
                  result.status === "ok"
                    ? "badge badge-live"
                    : result.status === "refused"
                      ? "badge badge-guardian"
                      : "badge badge-offline"
                }
              >
                Status: {result.status}
              </span>{" "}
              <span className="badge badge-offline">
                Mode: {result.mode} (environment)
              </span>
            </p>

            {stewardTotal !== null && (
              <p style={{ fontSize: "0.95rem" }}>
                Member dispersion total (minor units):{" "}
                <strong className="money">{stewardTotal.toString()}</strong>{" "}
                — the only figure a member/public audience receives.
              </p>
            )}
            {legacyDisclosure !== null && (
              <p
                style={{
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "8px",
                  padding: "0.6rem 0.8rem",
                  fontSize: "0.9rem",
                }}
              >
                <strong>Disclosure:</strong> {legacyDisclosure}
              </p>
            )}
            {legacyText !== null && <p style={{ fontSize: "0.92rem" }}>{legacyText}</p>}

            <h3 style={{ color: "var(--gold)" }}>Output</h3>
            <pre style={{ overflowX: "auto", fontSize: "0.85rem", lineHeight: 1.55 }}>
              {safeJson(output)}
            </pre>

            {result.citations !== undefined && result.citations.length > 0 && (
              <>
                <h3 style={{ color: "var(--gold)" }}>Citations</h3>
                <p>
                  {result.citations.map((citation) => (
                    <span
                      key={citation.id}
                      className="chip"
                      style={{ marginRight: "0.4rem" }}
                    >
                      {citation.label} · {citation.ring}
                    </span>
                  ))}
                </p>
              </>
            )}

            <h3 style={{ color: "var(--gold)" }}>Step receipts</h3>
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Step</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Ring</th>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Input hash</th>
                </tr>
              </thead>
              <tbody>
                {result.steps.map((step) => (
                  <tr key={step.id}>
                    <td>{step.step}</td>
                    <td>
                      <span
                        className={
                          step.decision === "allowed"
                            ? "cell-allow"
                            : "cell-deny"
                        }
                      >
                        {step.decision}
                      </span>
                    </td>
                    <td>{step.ring}</td>
                    <td>{step.timestamp}</td>
                    <td>{step.inputHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ color: "var(--gold)" }}>Run receipt</h3>
            <pre style={{ overflowX: "auto", fontSize: "0.85rem", lineHeight: 1.55 }}>
              {safeJson(result.receipt)}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}
