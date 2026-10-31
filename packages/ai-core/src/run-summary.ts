/**
 * @omega/ai-core — Omni run summaries + per-agent run history
 * (Phase 4, Alive Pass)
 *
 * `summarizeRun` reflects on a finished OmniRun. The TEMPLATE path
 * is deterministic and always available: it builds the summary text
 * from the run's receipts alone (executed / vetoed / refused counts,
 * artifacts produced, agents involved) and needs no model and no
 * key. The LIVE path asks a Meta Model client to write 2–3 sentences
 * from the SAME run facts. Honesty rule (docs/ACTIVATION_RUNBOOK.md
 * §3/§5): text is labeled `source: "live"` ONLY when a live model
 * call actually answered with usable text — every failure (no
 * client, offline stub backend, thrown error, empty answer) falls
 * back to the template text with `source: "template"`. Template
 * text is never labeled live.
 *
 * The run input is structural (see RunSummaryInput) so this module
 * does not import execution.ts — the executor's OmniRun satisfies
 * the shape, and its optional `summary` field (added by the
 * coordinator's execution hook) is read defensively by the history
 * helpers below.
 *
 * Creator: David Charles Bourassa
 */

import type { ChatCompletionProvider } from "./meta-model-client.js";
import { MetaModelClient } from "./meta-model-client.js";

export interface RunSummaryArtifactLike {
  kind: string;
  id: string;
  title: string;
}

export interface RunSummaryReceiptLike {
  stepId: string;
  agentId: string;
  outcome: "executed" | "denied" | "vetoed" | "error" | string;
  artifacts: readonly RunSummaryArtifactLike[];
}

export interface RunSummary {
  text: string;
  source: "live" | "template";
  modelId?: string;
  at: string;
}

/** Structural shape of an OmniRun, for summary + history purposes. */
export interface RunSummaryInput {
  id: string;
  planId: string;
  goal: string;
  status: "completed" | "failed" | string;
  receipts: readonly RunSummaryReceiptLike[];
  startedAt: string;
  finishedAt: string;
  /** Attached by the executor's summary hook when it lands. */
  summary?: RunSummary;
}

export interface RunFacts {
  executed: number;
  vetoed: number;
  /** Refused steps: outcomes "denied" + "error". */
  refused: number;
  denied: number;
  error: number;
  total: number;
  artifacts: readonly RunSummaryArtifactLike[];
  /** Agent ids in first-appearance order across the receipts. */
  agents: readonly string[];
}

/** Pure, deterministic facts extracted from a run's receipts. */
export function runFacts(run: RunSummaryInput): RunFacts {
  let executed = 0;
  let vetoed = 0;
  let denied = 0;
  let error = 0;
  const artifacts: RunSummaryArtifactLike[] = [];
  const agents: string[] = [];
  for (const receipt of run.receipts) {
    if (receipt.outcome === "executed") executed += 1;
    else if (receipt.outcome === "vetoed") vetoed += 1;
    else if (receipt.outcome === "denied") denied += 1;
    else if (receipt.outcome === "error") error += 1;
    artifacts.push(...receipt.artifacts);
    if (!agents.includes(receipt.agentId)) agents.push(receipt.agentId);
  }
  return {
    executed,
    vetoed,
    refused: denied + error,
    denied,
    error,
    total: run.receipts.length,
    artifacts,
    agents,
  };
}

/** The deterministic template summary text for a run. Pure. */
export function templateRunSummaryText(run: RunSummaryInput): string {
  const facts = runFacts(run);
  const artifactText =
    facts.artifacts.length > 0
      ? facts.artifacts.map((a) => `${a.title} (${a.kind})`).join("; ")
      : "none";
  const agentText = facts.agents.length > 0 ? facts.agents.join(", ") : "none";
  return (
    `Run ${run.status} for goal "${run.goal}": ` +
    `${facts.executed} of ${facts.total} steps executed, ` +
    `${facts.vetoed} vetoed, ${facts.refused} refused ` +
    `(${facts.denied} denied, ${facts.error} error). ` +
    `Agents involved: ${agentText}. ` +
    `Artifacts produced: ${facts.artifacts.length} — ${artifactText}.`
  );
}

const MAX_SUMMARY_CHARS = 600;

/** Cap text at ~600 chars, truncating on a word boundary when possible. */
export function capSummaryText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_SUMMARY_CHARS) return trimmed;
  const slice = trimmed.slice(0, MAX_SUMMARY_CHARS - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > MAX_SUMMARY_CHARS / 2 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export interface SummarizeRunOptions {
  client?: ChatCompletionProvider;
  modelId?: string;
  now?: Date;
}

/**
 * Summarize a finished run. With a live client the model writes the
 * summary from the run facts; on ANY live failure — and whenever no
 * live client is supplied — the deterministic template text is
 * returned with `source: "template"`.
 */
export async function summarizeRun(
  run: RunSummaryInput,
  opts: SummarizeRunOptions = {},
): Promise<RunSummary> {
  const at = (opts.now ?? new Date()).toISOString();
  const templateText = templateRunSummaryText(run);
  const fallback: RunSummary = { text: templateText, source: "template", at };

  const client = opts.client;
  if (client === undefined) return fallback;
  // A MetaModelClient without a key answers from its offline stub —
  // that is not a live summary, so don't even spend the call.
  if (client instanceof MetaModelClient && !client.isLive) return fallback;

  try {
    const facts = runFacts(run);
    const response = await client.chat({
      ...(opts.modelId !== undefined ? { model: opts.modelId } : {}),
      messages: [
        {
          role: "system",
          content:
            "You summarize a finished Omni agent run for its human owner. " +
            "Write 2–3 plain sentences from the run facts provided — what " +
            "the run set out to do, what actually happened step by step in " +
            "aggregate, and what it produced. Use ONLY the facts given; " +
            "never invent steps, agents, or artifacts. No markdown.",
        },
        {
          role: "user",
          content: [
            `Goal: ${run.goal}`,
            `Status: ${run.status}`,
            `Steps: ${facts.executed} executed, ${facts.vetoed} vetoed, ` +
              `${facts.refused} refused (${facts.denied} denied, ${facts.error} error) ` +
              `of ${facts.total} total`,
            `Agents involved: ${facts.agents.join(", ") || "none"}`,
            `Artifacts produced: ${
              facts.artifacts.length > 0
                ? facts.artifacts.map((a) => `${a.title} (${a.kind})`).join("; ")
                : "none"
            }`,
            `Template summary (facts, for reference): ${templateText}`,
          ].join("\n"),
        },
      ],
    });
    // Only a response the live API actually answered may be labeled
    // live; the offline stub backend never earns the label.
    if (response.backend !== "meta-model-api") return fallback;
    const text = capSummaryText(response.content);
    if (text === "") return fallback;
    return { text, source: "live", modelId: response.model, at };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Per-agent run history (agent memory for the monitor)
// ---------------------------------------------------------------------------

export interface AgentRunHistoryEntry {
  runId: string;
  planId: string;
  goal: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  /** This agent's step outcomes within this run. */
  executed: number;
  vetoed: number;
  denied: number;
  error: number;
  artifacts: readonly RunSummaryArtifactLike[];
  /** The run's summary, when the executor's hook has attached one. */
  summary?: RunSummary;
}

export interface AgentRunHistory {
  agentId: string;
  /** Number of runs this agent participated in. */
  runCount: number;
  executed: number;
  vetoed: number;
  denied: number;
  error: number;
  /** Newest-first (by finishedAt) per-run entries. */
  entries: readonly AgentRunHistoryEntry[];
  /** The newest run's summary, when one is attached. */
  lastSummary?: RunSummary;
}

/**
 * Pure helper: one agent's history across the given runs — only runs
 * where the agent actually has receipts — newest first, with outcome
 * counts and each run's summary when present.
 */
export function historyForAgent(
  runs: readonly RunSummaryInput[],
  agentId: string,
): AgentRunHistory {
  const entries: AgentRunHistoryEntry[] = [];
  let executed = 0;
  let vetoed = 0;
  let denied = 0;
  let error = 0;
  for (const run of runs) {
    const mine = run.receipts.filter((r) => r.agentId === agentId);
    if (mine.length === 0) continue;
    const entry: AgentRunHistoryEntry = {
      runId: run.id,
      planId: run.planId,
      goal: run.goal,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      executed: mine.filter((r) => r.outcome === "executed").length,
      vetoed: mine.filter((r) => r.outcome === "vetoed").length,
      denied: mine.filter((r) => r.outcome === "denied").length,
      error: mine.filter((r) => r.outcome === "error").length,
      artifacts: mine.flatMap((r) => r.artifacts),
      ...(run.summary !== undefined ? { summary: run.summary } : {}),
    };
    executed += entry.executed;
    vetoed += entry.vetoed;
    denied += entry.denied;
    error += entry.error;
    entries.push(entry);
  }
  entries.sort((a, b) =>
    a.finishedAt === b.finishedAt
      ? b.runId.localeCompare(a.runId)
      : b.finishedAt.localeCompare(a.finishedAt),
  );
  const lastSummary = entries.find((e) => e.summary !== undefined)?.summary;
  return {
    agentId,
    runCount: entries.length,
    executed,
    vetoed,
    denied,
    error,
    entries,
    ...(lastSummary !== undefined ? { lastSummary } : {}),
  };
}

/** Group every participating agent's history, keyed by agent id. */
export function historyByAgent(
  runs: readonly RunSummaryInput[],
): Readonly<Record<string, AgentRunHistory>> {
  const agentIds: string[] = [];
  for (const run of runs) {
    for (const receipt of run.receipts) {
      if (!agentIds.includes(receipt.agentId)) agentIds.push(receipt.agentId);
    }
  }
  const out: Record<string, AgentRunHistory> = {};
  for (const agentId of agentIds) {
    out[agentId] = historyForAgent(runs, agentId);
  }
  return out;
}
