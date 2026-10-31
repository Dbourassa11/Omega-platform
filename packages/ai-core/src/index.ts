/**
 * @omega/ai-core
 *
 * WORKING — the Omni-Agentic Core for the Omega Platform: a local
 * deterministic agent fabric (see agents.ts, the canonical 8-agent
 * surface), a Meta Model API client with an honest offline fallback,
 * a ring-scoped cited Oracle, and a consent-bound Legacy Mirror over
 * a synthetic archive. The original six agent roles below are defined
 * per Implementation Plan Step 5 and kept for existing consumers; the
 * canonical fabric in agents.ts supersedes them.
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

export type AgentRole =
  | "oracle"
  | "creator"
  | "memory"
  | "guardian"
  | "connector"
  | "legacy";

export interface AgentDefinition {
  role: AgentRole;
  purpose: string;
  guardrail: string;
}

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    role: "oracle",
    purpose: "Natural-language navigation, search, summaries",
    guardrail: "Must cite consented sources",
  },
  {
    role: "creator",
    purpose: "Poetry, visuals, music prompts, worlds",
    guardrail: "Must preserve human authorship framing",
  },
  {
    role: "memory",
    purpose: "Memories, relationships, timeline context",
    guardrail: "Ring-scoped retrieval only",
  },
  {
    role: "guardian",
    purpose: "Permissions, consent, privacy impact",
    guardrail: "Defaults to least privilege",
  },
  {
    role: "connector",
    purpose: "MCP tools for external platforms",
    guardrail: "Requires scoped connector approval",
  },
  {
    role: "legacy",
    purpose: "Digital Mirror interactions",
    guardrail: "Requires guardian authorization + drift controls",
  },
] as const;

export interface AgentContext {
  ring: RingType;
  subjectNodeId: string;
}

export const AI_CORE_STATUS = "WORKING" as const;

export const AI_CORE_SCOPE =
  "Local deterministic agent fabric (8 canonical agents, consent-gated runtime with audit receipts) + Meta Model API client (untested live — no key yet; deterministic offline fallback) + ring-scoped cited Oracle + consent-bound Legacy Mirror and Memory Curator over a synthetic archive + phi-split steward explanations (simulation-labeled) + Omni execution layer (agent creation registry with human-only approval, deterministic offline planner emitting the plan schema a live Muse Spark planner will use post-activation, and an approval-gated executor that issues lazy per-step policy passes, runs tools only through the MCP gateway, expires all passes at run end, and writes a vault run record — all offline/local). No live external calls are made by the fabric itself." as const;

export * from "./agents.js";
export * from "./registry.js";
export * from "./planner.js";
export * from "./execution.js";
export * from "./omni-demo.js";
export * from "./policy-agents.js";
export * from "./meta-model-client.js";
export * from "./meta-api-config.js";
export * from "./meta-image-client.js";
export * from "./sam-garden.js";
export * from "./oracle.js";
export * from "./legacy/index.js";
export * from "./skills.js";
export * from "./skill-guard.js";
export * from "./plan-validator.js";
export * from "./live-planner.js";
export * from "./run-summary.js";
