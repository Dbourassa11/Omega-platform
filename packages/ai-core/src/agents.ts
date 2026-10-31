/**
 * @omega/ai-core — Agent Fabric (doc 05: Omni-Agentic Core)
 *
 * The canonical eight-agent fabric for the Omega Platform, plus a local
 * deterministic runtime that implements doc-05's pipeline:
 *
 *   Intent → Active Ring → Consent Check → Source Retrieval
 *          → Grounded Response → Audit Receipt
 *
 * CANONICAL NAMES (v9 blueprint, confirmed in BLUEPRINT_V9_REVIEW.md —
 * these 8 win): Oracle, Consent Guardian, Memory Curator, Avatar,
 * Legacy Mirror, Studio, Connector, Economic Steward.
 *
 * Name mapping from Notion doc 05, which names variants: doc-05's
 * "Creator" is this fabric's Studio, doc-05's "Memory" is the Memory
 * Curator, and doc-05's "Research Assistant" is folded into the Oracle
 * (research is grounded, cited answering — the Oracle's job). The old
 * 6-role AGENT_REGISTRY in index.ts is kept untouched for existing
 * consumers; this fabric supersedes it as the canonical surface.
 *
 * HONESTY: every capability here is deterministic LOCAL logic, labeled
 * offline. The only network-capable backing is the Oracle's Meta Model
 * API client, which is untested against the live API (no key yet) and
 * self-falls-back to a deterministic offline stub. Nothing in this
 * module fakes a live call, and the Connector never executes anything.
 *
 * Creator: David Charles Bourassa
 */

import { canAccess, isReceiptActive } from "@omega/consent-core";
import type { ConsentReceipt, RingType } from "@omega/consent-core";
import { splitPhi } from "@omega/economic-kernel";
import {
  VersionedMemoryVault,
  auditArchive,
  fnv1a32,
} from "@omega/legacy-engine";
import type { ConsistencyReport } from "@omega/legacy-engine";

import { getMetaApiStatus } from "./meta-api-config.js";
import type { MetaApiEnv, MetaApiMode } from "./meta-api-config.js";
import { MetaModelClient } from "./meta-model-client.js";
import type { ChatCompletionProvider } from "./meta-model-client.js";
import { answerOracleQuery } from "./oracle.js";
import type { OracleAnswer, OracleCitation, OracleNodeRef } from "./oracle.js";
import { answerLegacyQuery } from "./legacy/answer.js";
import { SYNTHETIC_LEGACY_MEMORIES } from "./legacy/dataset.js";
import type {
  LegacyAnswer,
  LegacyClaim,
  LegacyMemory,
  LegacyProvenance,
} from "./legacy/types.js";

// ---------------------------------------------------------------------------
// Fabric definitions
// ---------------------------------------------------------------------------

export type AgentFabricId =
  | "oracle"
  | "guardian"
  | "memory-curator"
  | "avatar"
  | "legacy-mirror"
  | "studio"
  | "connector"
  | "steward";

/**
 * What every run of an agent must emit, per its fabric definition.
 * `receipt: true` is universal — every run produces an audit receipt.
 */
export interface AgentProvenanceRequirements {
  citations: boolean;
  disclosure: boolean;
  receipt: true;
  stateLabel: boolean;
}

/**
 * A fabric definition is PURE SERIALIZABLE DATA — no functions — so a
 * future agent-creation system (Phase 3B) and the Review Workstation
 * can author, store, and bind new entries of exactly this shape.
 */
export interface AgentFabricDefinition {
  id: AgentFabricId;
  /** Canonical display name (v9 blueprint). */
  name: string;
  purpose: string;
  primaryInputs: readonly string[];
  /** Doc-05 guardrail for this agent — enforced by the runtime below. */
  guardrail: string;
  /** What actually backs the capability today (honest, no live claims). */
  backing: string;
  /** The rings this agent may operate in; any other ring is refused. */
  ringScope: readonly RingType[];
  /**
   * Tools/capabilities this agent may invoke. Empty means no external
   * tools — retrieval or pure local projection only.
   */
  toolAllowlist: readonly string[];
  /** Provenance every run of this agent must emit. */
  provenanceRequirements: AgentProvenanceRequirements;
}

export const AGENT_FABRIC: readonly AgentFabricDefinition[] = [
  {
    id: "oracle",
    name: "Oracle",
    purpose:
      "Natural-language navigation, search, and summaries answered only " +
      "from consented sources in the active ring, with citations.",
    primaryInputs: ["natural-language query", "active ring", "consented nodes"],
    guardrail: "Grounded answers only — cite consented in-ring sources; never invent.",
    backing:
      "answerOracleQuery over the MetaModelClient (Meta Model API, " +
      "untested live; deterministic offline fallback).",
    ringScope: ["family", "friends", "work", "public"],
    toolAllowlist: [],
    provenanceRequirements: {
      citations: true,
      disclosure: false,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "guardian",
    name: "Consent Guardian",
    purpose:
      "Permissions, consent, and privacy impact: explains access " +
      "decisions and gates every ring-scoped retrieval before it happens.",
    primaryInputs: ["consent receipts", "required ring", "subject id"],
    guardrail: "Least privilege default — deny by default, exact-ring match only.",
    backing:
      "Local deterministic logic over @omega/consent-core " +
      "canAccess / isReceiptActive.",
    ringScope: ["family", "friends", "work", "public"],
    toolAllowlist: ["consent-core.canAccess", "consent-core.isReceiptActive"],
    provenanceRequirements: {
      citations: false,
      disclosure: false,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "memory-curator",
    name: "Memory Curator",
    purpose:
      "Memories, relationships, and timeline context: curates the " +
      "archive, verifies its version chains, and audits consistency.",
    primaryInputs: ["legacy memories", "versioned vault", "archive claims"],
    guardrail: "Ring-scoped retrieval only — nothing is retrieved outside the active ring.",
    backing:
      "Local deterministic logic: @omega/legacy-engine " +
      "VersionedMemoryVault + auditArchive over the synthetic archive.",
    // Memories are private by nature: the Curator never operates in
    // the public ring.
    ringScope: ["family", "friends", "work"],
    toolAllowlist: [
      "legacy-engine.VersionedMemoryVault",
      "legacy-engine.auditArchive",
      "legacy-engine.scoreClaims",
    ],
    provenanceRequirements: {
      citations: false,
      disclosure: false,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "avatar",
    name: "Avatar",
    purpose:
      "Builds the public-facing profile card for a member — the " +
      "deliberately public surface of their presence.",
    primaryInputs: ["member profile"],
    guardrail:
      "Public-safe fields only — private profile fields are dropped, never inferred or leaked.",
    backing: "Local deterministic allowlist projection; no model call.",
    // The Avatar builds the PUBLIC card — public ring only.
    ringScope: ["public"],
    toolAllowlist: [],
    provenanceRequirements: {
      citations: false,
      disclosure: false,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "legacy-mirror",
    name: "Legacy Mirror",
    purpose:
      "Digital Mirror interactions over a member's life archive " +
      "(Eternal Garden): grounded Q&A in the member's recorded voice.",
    primaryInputs: ["question", "viewer ring", "consented archive memories"],
    guardrail:
      "Disclosure + drift control — always disclosed as an AI-generated " +
      "representation; abstains rather than inventing; no fabricated memories.",
    backing:
      "answerLegacyQuery — deterministic local logic over the " +
      "synthetic archive, with citations and abstention.",
    // The bundled archive lives in the family ring (LEGACY_ARCHIVE_RING).
    ringScope: ["family"],
    toolAllowlist: ["ai-core.answerLegacyQuery"],
    provenanceRequirements: {
      citations: true,
      disclosure: true,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "studio",
    name: "Studio",
    purpose:
      "Creative drafting: poems, captions, music prompts, and world " +
      "seeds as assistive drafts for a human author to finish.",
    primaryInputs: ["draft kind", "theme"],
    guardrail:
      "Human-in-the-loop approval — output is a labeled assistive draft; " +
      "human authorship is preserved and approval is required.",
    backing: "Local deterministic template scaffolder; no model call, no live claims.",
    ringScope: ["family", "friends", "work", "public"],
    toolAllowlist: [],
    provenanceRequirements: {
      citations: false,
      disclosure: true,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "connector",
    name: "Connector",
    purpose:
      "Prepares scoped external tool calls (MCP-style adapters) for " +
      "human approval, showing exactly what would be shared.",
    primaryInputs: ["adapter id", "tool", "purpose", "active ring"],
    guardrail:
      "No silent external calls — a consent preview is always produced " +
      "first and a receipt is always required; this fabric never executes.",
    backing:
      "Injected ConnectorCatalogProvider (catalog listing only). " +
      "There is no execute path.",
    ringScope: ["family", "friends", "work", "public"],
    toolAllowlist: [
      "connector-catalog.listAdapters",
      "connector-catalog.listTools",
    ],
    provenanceRequirements: {
      citations: false,
      disclosure: true,
      receipt: true,
      stateLabel: false,
    },
  },
  {
    id: "steward",
    name: "Economic Steward",
    purpose:
      "Explains the platform's phi-split economics in plain language, " +
      "with the simulation/testnet state always labeled.",
    primaryInputs: ["gross amount (integer minor units)", "audience"],
    guardrail:
      "Simulation/testnet/production labeling always — state is named " +
      "on every output; no financial guarantees.",
    backing:
      "Local deterministic logic: @omega/economic-kernel splitPhi " +
      "(bigint integer math only).",
    ringScope: ["family", "friends", "work", "public"],
    toolAllowlist: ["economic-kernel.splitPhi"],
    provenanceRequirements: {
      citations: false,
      disclosure: false,
      receipt: true,
      stateLabel: true,
    },
  },
] as const;

export function getAgentFabricEntry(
  id: AgentFabricId,
): AgentFabricDefinition | undefined {
  return AGENT_FABRIC.find((agent) => agent.id === id);
}

/**
 * Doc-05 §6 prompt guardrail template (paraphrase-tight; the operative
 * rules are verbatim in effect). Any model-backed agent surface must
 * carry this guardrail; the local runtime enforces the same rules in
 * code (ring gate, disclosure, abstention, draft labeling).
 */
export const GUARDRAIL_PROMPT =
  "You are an agent of the Omega Platform, operating inside one active " +
  "consent ring. Use ONLY context consented in the active ring; never " +
  "reveal, reference, or infer anything from outside the active ring, " +
  "and never confirm or deny what another ring contains. When speaking " +
  "as or about the Legacy Mirror, disclose that you are an AI-generated " +
  "representation grounded in approved memories. Treat Official Art " +
  "output as an assistive draft that preserves human authorship — " +
  "never claim the human's authorship as your own. If the consented " +
  "sources do not support an answer, say what is missing and stop: " +
  "never invent memories, citations, legal conclusions, financial " +
  "guarantees, or permissions. When consent is absent, revoked, " +
  "expired, or for a different ring, refuse in the Guardian's voice " +
  "and name the ring that would be required.";

// ---------------------------------------------------------------------------
// Runtime types — doc-05 pipeline
// ---------------------------------------------------------------------------

export interface AgentTask {
  agentId: AgentFabricId;
  input: unknown;
  /** The active ring for this task. Consent never crosses rings. */
  ring: RingType;
  receipts: readonly ConsentReceipt[];
  subjectId?: string;
}

export type AgentTaskStatus = "ok" | "refused" | "unsupported";

/**
 * Audit receipt appended to every task result (the pipeline's final
 * step). `inputHash` is an FNV-1a 32-bit fingerprint — a deterministic
 * integrity check, NOT a cryptographic hash (same construction as
 * @omega/legacy-engine's vault receipts).
 */
export interface AgentAuditReceipt {
  id: string;
  agentId: AgentFabricId;
  /** Alias of agentId, for consumers that read `receipt.agent`. */
  agent: AgentFabricId;
  ring: RingType;
  decision: "allowed" | "refused" | "unsupported";
  subjectId?: string;
  startedAt: string;
  completedAt: string;
  timestamps: { startedAt: string; completedAt: string };
  inputHash: string;
  hashAlgorithm: "fnv1a-32 (non-cryptographic)";
  mode: MetaApiMode;
}

/**
 * One pipeline step, receipt-shaped like the run receipt itself
 * (id / agent / ring / decision / timestamp / input hash, all
 * serializable) so a Review Workstation can bind to steps, not prose.
 */
export interface AgentStepReceipt {
  id: string;
  agent: AgentFabricId;
  ring: RingType;
  step: "ring-scope" | "consent-check" | "capability";
  decision: "allowed" | "refused" | "unsupported";
  timestamp: string;
  inputHash: string;
}

export interface AgentTaskResult {
  status: AgentTaskStatus;
  agentId: AgentFabricId;
  output: unknown;
  citations?: readonly OracleCitation[];
  receipt: AgentAuditReceipt;
  /** Per-step receipts, in pipeline order. */
  steps: readonly AgentStepReceipt[];
  /** From getMetaApiStatus() — "live" only means a key is configured. */
  mode: MetaApiMode;
}

// ---------------------------------------------------------------------------
// Connector catalog provider (injected; listing only — no execute exists)
// ---------------------------------------------------------------------------

export interface ConnectorAdapterInfo {
  id: string;
  name: string;
  description?: string;
  dataCategories?: readonly string[];
  riskLevel?: "low" | "medium" | "high";
}

export interface ConnectorToolInfo {
  id: string;
  name: string;
  description?: string;
  /** Scope string the tool would require, if the catalog names one. */
  scope?: string;
  dataCategories?: readonly string[];
  riskLevel?: "low" | "medium" | "high";
}

/**
 * The ONLY connector surface the fabric accepts: a catalog that can be
 * listed. There is deliberately no execute/run/invoke member — a
 * provider object that happens to carry one is never called.
 */
export interface ConnectorCatalogProvider {
  listAdapters(): readonly ConnectorAdapterInfo[] | Promise<readonly ConnectorAdapterInfo[]>;
  listTools(
    adapterId: string,
  ): readonly ConnectorToolInfo[] | Promise<readonly ConnectorToolInfo[]>;
}

/** Injected providers for runAgentTask. Everything is optional. */
export interface AgentProviders {
  /** Chat provider for the Oracle. Defaults to a MetaModelClient. */
  chatProvider?: ChatCompletionProvider;
  /** Nodes the Oracle may answer from. Defaults to none. */
  oracleNodes?: readonly OracleNodeRef[];
  /** Connector catalog. Without it, connector tasks are "unsupported". */
  connectorCatalog?: ConnectorCatalogProvider;
  /** Evaluation time for consent checks (defaults to now). */
  now?: Date;
  /** Environment override for getMetaApiStatus (defaults to process.env). */
  env?: MetaApiEnv;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic JSON: keys sorted recursively, bigint-safe. */
function stableStringify(value: unknown): string {
  if (typeof value === "bigint") {
    return JSON.stringify(`bigint:${value.toString()}`);
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

/** FNV-1a input fingerprint (non-cryptographic; see AgentAuditReceipt). */
export function agentInputHash(input: unknown): string {
  return fnv1a32(stableStringify(input));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The first receipt in `receipts` that grants `ring` at `now`, if any. */
function grantingReceipt(
  ring: RingType,
  receipts: readonly ConsentReceipt[],
  now: Date,
  subjectId?: string,
): ConsentReceipt | undefined {
  return receipts.find(
    (receipt) =>
      canAccess(ring, receipt, now) &&
      (subjectId === undefined || receipt.subjectNodeId === subjectId),
  );
}

/** Agents whose capability touches ring-scoped data (Guardian pre-gate). */
const RING_SCOPED_AGENTS: ReadonlySet<AgentFabricId> = new Set([
  "oracle",
  "memory-curator",
  "legacy-mirror",
]);

// ---------------------------------------------------------------------------
// Guardian — access explainer
// ---------------------------------------------------------------------------

export interface GuardianExplanation {
  allowed: boolean;
  ring: RingType;
  subjectId?: string;
  /** Id of the receipt that grants access, or null when denied. */
  grantingReceiptId: string | null;
  /** Plain-language decision, naming the granting receipt or the reason. */
  explanation: string;
  /** One reason per receipt considered (empty when none were provided). */
  reasons: readonly string[];
}

export function explainGuardianAccess(args: {
  ring: RingType;
  receipts: readonly ConsentReceipt[];
  subjectId?: string;
  now?: Date;
}): GuardianExplanation {
  const now = args.now ?? new Date();
  const grant = grantingReceipt(args.ring, args.receipts, now, args.subjectId);
  const reasons: string[] = [];
  for (const receipt of args.receipts) {
    if (grant !== undefined && receipt.id === grant.id) {
      reasons.push(
        `Receipt ${receipt.id} grants the '${receipt.ring}' ring and is active.`,
      );
    } else if (receipt.revokedAt !== null) {
      reasons.push(`Receipt ${receipt.id} was revoked at ${receipt.revokedAt}.`);
    } else if (!isReceiptActive(receipt, now)) {
      reasons.push(
        `Receipt ${receipt.id} is expired (expiresAt ${receipt.expiresAt ?? "unknown"}).`,
      );
    } else if (receipt.ring !== args.ring) {
      reasons.push(
        `Receipt ${receipt.id} grants the '${receipt.ring}' ring, not the '${args.ring}' ring — consent does not cross ring boundaries.`,
      );
    } else if (
      args.subjectId !== undefined &&
      receipt.subjectNodeId !== args.subjectId
    ) {
      reasons.push(
        `Receipt ${receipt.id} belongs to subject ${receipt.subjectNodeId}, not ${args.subjectId}.`,
      );
    }
  }
  if (grant !== undefined) {
    return {
      allowed: true,
      ring: args.ring,
      ...(args.subjectId !== undefined ? { subjectId: args.subjectId } : {}),
      grantingReceiptId: grant.id,
      explanation:
        `Access to the '${args.ring}' ring is granted by receipt ` +
        `${grant.id} (purpose: ${grant.purpose}), which is active and ` +
        `matches the required ring exactly.`,
      reasons,
    };
  }
  const why =
    args.receipts.length === 0
      ? "no consent receipts were provided"
      : "no provided receipt is active, unrevoked, unexpired, and for " +
        `the '${args.ring}' ring`;
  return {
    allowed: false,
    ring: args.ring,
    ...(args.subjectId !== undefined ? { subjectId: args.subjectId } : {}),
    grantingReceiptId: null,
    explanation:
      `Access to the '${args.ring}' ring is denied: ${why}. The Guardian ` +
      `defaults to least privilege — access requires an active consent ` +
      `receipt granting exactly the '${args.ring}' ring.`,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Memory Curator — vault ingestion + consistency audit
// ---------------------------------------------------------------------------

export interface CuratorAuditOutput {
  kind: "curator-audit";
  vaultSize: number;
  /** True when every ingested memory's version chain verifies. */
  chainVerified: boolean;
  chainsVerified: number;
  /** auditArchive consistency report over the ingested archive. */
  report: ConsistencyReport;
}

/**
 * Ingest memories into a VersionedMemoryVault, verify every version
 * chain, and return the auditArchive consistency report.
 *
 * Adapter note: NO adapter was needed. @omega/legacy-engine defines
 * its own LegacyMemory locally (packages/legacy-engine/src/types.ts)
 * with a shape identical to this package's, so TypeScript's structural
 * typing accepts the synthetic archive directly with no translation —
 * and legacy-engine stays free of any dependency on this package.
 */
export function auditCuratorArchive(
  memories: readonly LegacyMemory[] = SYNTHETIC_LEGACY_MEMORIES,
  now: Date = new Date(),
): CuratorAuditOutput {
  const vault = new VersionedMemoryVault(memories, {
    actor: "memory-curator",
    timestamp: now.toISOString(),
  });
  let chainsVerified = 0;
  for (const memory of memories) {
    if (vault.verifyChain(memory.id)) {
      chainsVerified += 1;
    }
  }
  return {
    kind: "curator-audit",
    vaultSize: vault.list().length,
    chainVerified: chainsVerified === memories.length,
    chainsVerified,
    report: auditArchive(vault),
  };
}

// ---------------------------------------------------------------------------
// Economic Steward — phi-split explainer
// ---------------------------------------------------------------------------

/** Exact phi-split shares of gross, in percent (display values). */
export const PHI_SPLIT_PERCENTS = {
  trust: 61.8033988,
  members: 23.6067976,
  ops: 14.5898036,
} as const;

export const STEWARD_STATE_NOTE: string =
  "Contracts are unaudited / testnet-grade. This explanation describes " +
  "a simulation split only — it is not a financial guarantee.";

export interface StewardExplanation {
  audience: "internal";
  amountMinor: bigint;
  trustMinor: bigint;
  membersMinor: bigint;
  opsMinor: bigint;
  trustPercent: number;
  membersPercent: number;
  opsPercent: number;
  /** Mandatory state label — present on every steward output. */
  stateLabel: "simulation";
  note: string;
  explanation: string;
}

/**
 * Public disclosure variant (doc-10 public disclosure rule): a public
 * audience receives ONLY the member dispersion total — no trust/ops
 * internals, no percentages, no amounts beyond that single figure.
 */
export interface StewardPublicDisclosure {
  memberDispersionTotal: bigint;
}

export function explainPhiSplit(args: {
  amountMinor: bigint;
  audience?: "internal" | "public";
}): StewardExplanation | StewardPublicDisclosure {
  const split = splitPhi(args.amountMinor);
  if (args.audience === "public") {
    return { memberDispersionTotal: split.members };
  }
  return {
    audience: "internal",
    amountMinor: args.amountMinor,
    trustMinor: split.trust,
    membersMinor: split.members,
    opsMinor: split.ops,
    trustPercent: PHI_SPLIT_PERCENTS.trust,
    membersPercent: PHI_SPLIT_PERCENTS.members,
    opsPercent: PHI_SPLIT_PERCENTS.ops,
    stateLabel: "simulation",
    note: STEWARD_STATE_NOTE,
    explanation:
      `A gross of ${args.amountMinor} minor units splits by the phi ` +
      `rule into trust ${split.trust} (${PHI_SPLIT_PERCENTS.trust}%), ` +
      `member dispersion ${split.members} (${PHI_SPLIT_PERCENTS.members}%), ` +
      `and operations ${split.ops} (${PHI_SPLIT_PERCENTS.ops}%). ` +
      `State: simulation. ${STEWARD_STATE_NOTE}`,
  };
}

function parseAmountMinor(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Connector — consent preview (never executes)
// ---------------------------------------------------------------------------

export interface PrepareToolCallInput {
  adapterId: string;
  tool: string;
  purpose: string;
  ring: RingType;
}

/** Doc-05 §5.5 consent preview. Producing it executes nothing. */
export interface ConnectorConsentPreview {
  connector: string;
  tool: string;
  scope: string;
  purpose: string;
  dataCategories: readonly string[];
  ring: RingType;
  riskLevel: "low" | "medium" | "high";
  receiptRequired: true;
  /** Structural guarantee: this object is a preview, never a call. */
  previewOnly: true;
}

/**
 * Build a consent preview for a would-be tool call, validating the
 * adapter and tool against the injected catalog. Returns null when the
 * adapter or tool is not in the catalog. NEVER executes the tool —
 * the catalog interface has no execute path to call.
 */
export async function prepareToolCall(
  provider: ConnectorCatalogProvider,
  input: PrepareToolCallInput,
): Promise<ConnectorConsentPreview | null> {
  const adapters = await provider.listAdapters();
  const adapter = adapters.find((entry) => entry.id === input.adapterId);
  if (adapter === undefined) {
    return null;
  }
  const tools = await provider.listTools(input.adapterId);
  const tool = tools.find((entry) => entry.id === input.tool);
  if (tool === undefined) {
    return null;
  }
  const dataCategories =
    tool.dataCategories ?? adapter.dataCategories ?? [];
  return {
    connector: adapter.id,
    tool: tool.id,
    scope: tool.scope ?? `${adapter.id}:${tool.id}`,
    purpose: input.purpose,
    dataCategories: [...dataCategories],
    ring: input.ring,
    riskLevel: tool.riskLevel ?? adapter.riskLevel ?? "medium",
    receiptRequired: true,
    previewOnly: true,
  };
}

// ---------------------------------------------------------------------------
// Legacy Mirror — disclosed wrapper over answerLegacyQuery
// ---------------------------------------------------------------------------

/** Disclosure line present on EVERY Legacy Mirror output. */
export const LEGACY_DISCLOSURE_LINE: string =
  "Disclosure: This is an AI-generated representation grounded in " +
  "approved memories from the member's consented archive — a simulated " +
  "reflection, not the person speaking.";

export interface LegacyMirrorOutput {
  kind: LegacyAnswer["kind"];
  disclosure: string;
  text: string;
  claims: readonly LegacyClaim[];
  citations: readonly string[];
  provenance: LegacyProvenance;
  abstained: boolean;
  refused: boolean;
}

export function wrapLegacyAnswer(answer: LegacyAnswer): LegacyMirrorOutput {
  const text = answer.text.includes("AI-generated representation")
    ? answer.text
    : `${LEGACY_DISCLOSURE_LINE} ${answer.text}`;
  return {
    kind: answer.kind,
    disclosure: LEGACY_DISCLOSURE_LINE,
    text,
    claims: answer.claims,
    citations: answer.citations,
    provenance: answer.provenance,
    abstained: answer.abstained,
    refused: answer.refused,
  };
}

// ---------------------------------------------------------------------------
// Studio — deterministic assistive draft scaffolder
// ---------------------------------------------------------------------------

export type StudioDraftKind = "poem" | "caption" | "music-prompt" | "world-seed";

export const STUDIO_DRAFT_KINDS: readonly StudioDraftKind[] = [
  "poem",
  "caption",
  "music-prompt",
  "world-seed",
] as const;

export interface StudioDraft {
  kind: StudioDraftKind;
  theme: string;
  draft: string;
  /** Human authorship framing — the draft assists, the human authors. */
  label: "assistive draft";
  isDraft: true;
  requiresHumanApproval: true;
  approvalRequired: true;
}

export function scaffoldStudioDraft(input: {
  kind: unknown;
  theme: unknown;
}): StudioDraft | null {
  if (
    typeof input.kind !== "string" ||
    !(STUDIO_DRAFT_KINDS as readonly string[]).includes(input.kind) ||
    typeof input.theme !== "string" ||
    input.theme.trim() === ""
  ) {
    return null;
  }
  const kind = input.kind as StudioDraftKind;
  const theme = input.theme.trim();
  const drafts: Record<StudioDraftKind, string> = {
    poem:
      `[DRAFT poem — theme: ${theme}]\n` +
      `On ${theme}, a first light gathers at the edge of the ring,\n` +
      `and what was scattered learns the shape of returning.\n` +
      `(Working draft — the human author shapes the final lines.)`,
    caption:
      `[DRAFT caption — theme: ${theme}] ${theme} — held in the active ` +
      `ring, shared with consent. (Working draft — the human author ` +
      `writes the final caption.)`,
    "music-prompt":
      `[DRAFT music prompt — theme: ${theme}] Slow-building harmonic ` +
      `bed evoking ${theme}: warm odd harmonics, phi-spaced swells, ` +
      `space for a human vocal lead. (Working draft — the human ` +
      `composer makes the final choices.)`,
    "world-seed":
      `[DRAFT world seed — theme: ${theme}] A place where ${theme} is ` +
      `the law of the land: one gate, one garden, one keeper of the ` +
      `ledger. (Working draft — the human author grows the world.)`,
  };
  return {
    kind,
    theme,
    draft: drafts[kind],
    label: "assistive draft",
    isDraft: true,
    requiresHumanApproval: true,
    approvalRequired: true,
  };
}

// ---------------------------------------------------------------------------
// Avatar — public profile card (allowlist projection)
// ---------------------------------------------------------------------------

export interface AvatarPublicCard {
  displayName: string;
  handle: string;
  publicBio?: string;
  publicProgramStatus?: string;
}

/**
 * Project a member profile onto its public card. ONLY the four
 * public-safe fields survive; every other field — emails, ring data,
 * receipts, private notes, anything — is dropped, never copied.
 */
export function buildAvatarPublicCard(
  profile: Record<string, unknown>,
): AvatarPublicCard | null {
  const displayName = stringField(profile, "displayName");
  const handle = stringField(profile, "handle");
  if (displayName === undefined || handle === undefined) {
    return null;
  }
  const publicBio = stringField(profile, "publicBio");
  const publicProgramStatus = stringField(profile, "publicProgramStatus");
  return {
    displayName,
    handle,
    ...(publicBio !== undefined ? { publicBio } : {}),
    ...(publicProgramStatus !== undefined
      ? { publicProgramStatus }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Runtime — Intent → Ring → Consent Check → Retrieval → Response → Receipt
// ---------------------------------------------------------------------------

export async function runAgentTask(
  task: AgentTask,
  providers: AgentProviders = {},
): Promise<AgentTaskResult> {
  const now = providers.now ?? new Date();
  const startedAt = now.toISOString();
  const mode = getMetaApiStatus(providers.env).mode;
  const inputHash = agentInputHash(task.input);
  // Capabilities resolve THROUGH the registry: the fabric entry for
  // the task's id governs ring scope, gating, and dispatch.
  const definition = getAgentFabricEntry(task.agentId);
  const steps: AgentStepReceipt[] = [];
  const recordStep = (
    step: AgentStepReceipt["step"],
    decision: AgentStepReceipt["decision"],
  ): void => {
    steps.push({
      id: `step-${task.agentId}-${step}-${inputHash}`,
      agent: task.agentId,
      ring: task.ring,
      step,
      decision,
      timestamp: startedAt,
      inputHash,
    });
  };

  const finish = (
    status: AgentTaskStatus,
    output: unknown,
    citations?: readonly OracleCitation[],
  ): AgentTaskResult => {
    const completedAt = (providers.now ?? new Date()).toISOString();
    const decision =
      status === "ok" ? "allowed" : status === "refused" ? "refused" : "unsupported";
    recordStep("capability", decision);
    return {
      status,
      agentId: task.agentId,
      output,
      ...(citations !== undefined ? { citations } : {}),
      receipt: {
        id: `audit-${task.agentId}-${startedAt}-${inputHash}`,
        agentId: task.agentId,
        agent: task.agentId,
        ring: task.ring,
        decision,
        ...(task.subjectId !== undefined ? { subjectId: task.subjectId } : {}),
        startedAt,
        completedAt,
        timestamps: { startedAt, completedAt },
        inputHash,
        hashAlgorithm: "fnv1a-32 (non-cryptographic)",
        mode,
      },
      steps: [...steps],
      mode,
    };
  };

  if (definition === undefined) {
    return finish("unsupported", {
      reason: "unknown-agent",
      message: `No agent '${String(task.agentId)}' exists in the fabric.`,
    });
  }

  // Ring Scope — enforced from the registry entry, before anything
  // else: a task whose ring is outside the agent's ringScope is
  // refused, and no capability runs.
  if (!definition.ringScope.includes(task.ring)) {
    recordStep("ring-scope", "refused");
    return finish("refused", {
      reason: "ring-out-of-scope",
      message:
        `Guardian: the ${definition.name} may operate only in the ` +
        `${definition.ringScope.join(", ")} ring(s); a '${task.ring}' ` +
        `ring task is outside its ring scope and is refused.`,
      ringScope: definition.ringScope,
    });
  }
  recordStep("ring-scope", "allowed");

  // Consent Check — the Guardian acts as the pre-retrieval gate for
  // every agent whose capability touches ring-scoped data. Without an
  // active receipt granting the task's ring, nothing is retrieved.
  if (RING_SCOPED_AGENTS.has(definition.id)) {
    const grant = grantingReceipt(task.ring, task.receipts, now, task.subjectId);
    if (grant === undefined) {
      recordStep("consent-check", "refused");
      return finish("refused", {
        reason: "missing-consent",
        message:
          `Guardian: the ${definition.name} requires an active consent ` +
          `receipt granting the '${task.ring}' ring before any retrieval, ` +
          `and none was provided — missing consent for the '${task.ring}' ` +
          `ring. Consent does not cross ring boundaries, and the Guardian ` +
          `defaults to least privilege.`,
        missingRing: task.ring,
      });
    }
    recordStep("consent-check", "allowed");
  }

  switch (definition.id) {
    case "oracle": {
      const query =
        typeof task.input === "string"
          ? task.input
          : isRecord(task.input)
            ? stringField(task.input, "query")
            : undefined;
      if (query === undefined) {
        return finish("unsupported", {
          reason: "invalid-input",
          message: "Oracle input must be a query string or { query: string }.",
        });
      }
      const provider = providers.chatProvider ?? new MetaModelClient();
      const answer: OracleAnswer = await answerOracleQuery(query, {
        activeRing: task.ring,
        nodes: providers.oracleNodes ?? [],
        provider,
      });
      if (answer.refused) {
        return finish("refused", answer, answer.citations);
      }
      return finish("ok", answer, answer.citations);
    }

    case "guardian": {
      const input = isRecord(task.input) ? task.input : {};
      const ring =
        typeof input["ring"] === "string"
          ? (input["ring"] as RingType)
          : task.ring;
      const receipts = Array.isArray(input["receipts"])
        ? (input["receipts"] as readonly ConsentReceipt[])
        : task.receipts;
      const subjectId =
        stringField(input, "subjectId") ?? task.subjectId;
      const explanation = explainGuardianAccess({
        ring,
        receipts,
        ...(subjectId !== undefined ? { subjectId } : {}),
        now,
      });
      return finish("ok", explanation);
    }

    case "memory-curator": {
      const memories =
        isRecord(task.input) && Array.isArray(task.input["memories"])
          ? (task.input["memories"] as readonly LegacyMemory[])
          : SYNTHETIC_LEGACY_MEMORIES;
      return finish("ok", auditCuratorArchive(memories, now));
    }

    case "avatar": {
      if (!isRecord(task.input)) {
        return finish("unsupported", {
          reason: "invalid-input",
          message: "Avatar input must be a member profile object.",
        });
      }
      const card = buildAvatarPublicCard(task.input);
      if (card === null) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            "Avatar profile must carry string displayName and handle " +
            "to build a public card.",
        });
      }
      return finish("ok", card);
    }

    case "legacy-mirror": {
      const question =
        typeof task.input === "string"
          ? task.input
          : isRecord(task.input)
            ? stringField(task.input, "question")
            : undefined;
      if (question === undefined) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            "Legacy Mirror input must be a question string or { question: string }.",
        });
      }
      // The gate above proved an active receipt for the task ring; the
      // Mirror still runs its own consent gate against the archive's
      // ring (family) — a public-ring task is refused there, by design.
      const receipt = grantingReceipt(
        task.ring,
        task.receipts,
        now,
        task.subjectId,
      );
      const answer = answerLegacyQuery(question, {
        viewerRing: task.ring,
        ...(receipt !== undefined ? { receipt } : {}),
        now,
      });
      const wrapped = wrapLegacyAnswer(answer);
      const citations: OracleCitation[] = answer.provenance.sources.map(
        (source) => ({ id: source.id, label: source.title, ring: source.ring }),
      );
      if (answer.refused) {
        return finish("refused", wrapped, citations);
      }
      // Abstention passes through as an ok task with kind "abstained".
      return finish("ok", wrapped, citations);
    }

    case "studio": {
      if (!isRecord(task.input)) {
        return finish("unsupported", {
          reason: "invalid-input",
          message: "Studio input must be { kind, theme }.",
        });
      }
      const draft = scaffoldStudioDraft({
        kind: task.input["kind"],
        theme: task.input["theme"],
      });
      if (draft === null) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            "Studio input requires kind (poem | caption | music-prompt | " +
            "world-seed) and a non-empty theme string.",
        });
      }
      return finish("ok", draft);
    }

    case "connector": {
      if (providers.connectorCatalog === undefined) {
        return finish("unsupported", {
          reason: "no-catalog-bound",
          message:
            "No connector catalog is bound: runAgentTask was called " +
            "without providers.connectorCatalog, so no consent preview " +
            "can be prepared. Nothing was executed.",
        });
      }
      if (!isRecord(task.input)) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            "Connector input must be { adapterId, tool, purpose, ring? }.",
        });
      }
      const adapterId = stringField(task.input, "adapterId");
      const tool = stringField(task.input, "tool");
      const purpose = stringField(task.input, "purpose");
      if (adapterId === undefined || tool === undefined || purpose === undefined) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            "Connector input requires adapterId, tool, and purpose strings.",
        });
      }
      const ring =
        typeof task.input["ring"] === "string"
          ? (task.input["ring"] as RingType)
          : task.ring;
      const preview = await prepareToolCall(providers.connectorCatalog, {
        adapterId,
        tool,
        purpose,
        ring,
      });
      if (preview === null) {
        return finish("unsupported", {
          reason: "not-in-catalog",
          message:
            `Adapter '${adapterId}' or tool '${tool}' is not in the ` +
            `bound connector catalog. Nothing was executed.`,
        });
      }
      return finish("ok", preview);
    }

    case "steward": {
      const input = isRecord(task.input) ? task.input : {};
      const amountMinor = parseAmountMinor(
        isRecord(task.input) ? task.input["amountMinor"] : task.input,
      );
      if (amountMinor === undefined) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            "Steward input requires amountMinor as a bigint or an " +
            "integer string (money math is bigint-only).",
        });
      }
      const audience =
        stringField(input, "audience") === "public" ? "public" : "internal";
      try {
        const output = explainPhiSplit({ amountMinor, audience });
        return finish("ok", output);
      } catch (error) {
        return finish("unsupported", {
          reason: "invalid-input",
          message:
            error instanceof Error
              ? error.message
              : "Steward split failed for the given amount.",
        });
      }
    }
  }
}
