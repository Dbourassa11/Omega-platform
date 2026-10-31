/**
 * @omega/ai-core — Omni plan schema + deterministic offline planner
 * (Phase 3B)
 *
 * The OmniPlan / PlanStep schema below is the SAME schema a live
 * Muse Spark planner will emit post-activation: a goal, an ordered
 * list of steps (each bound to one agent, one gateway tool or one
 * package action, one consent ring, one policy resource + action, and
 * the artifacts the step is expected to produce), and an approval
 * record that only a person can create (see execution.ts approvePlan).
 *
 * `createOfflinePlanner` is the deterministic OFFLINE implementation
 * of the Planner seam — it is labeled honestly (`plannerMode` and
 * `mode` are the literal "offline"), calls no model and no network,
 * and produces the canonical demo plan for community-building goals
 * or a generic 3-step research plan for anything else. Swapping in a
 * live planner changes only the Planner implementation, never the
 * schema, the approval gate, or the executor.
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";
import { fnv1a32 } from "@omega/legacy-engine";
import type { PolicyAction } from "@omega/policy-engine";

export interface PlanStep {
  id: string;
  agentId: string;
  kind: "tool" | "action";
  toolId?: string;
  actionId?: string;
  args?: Record<string, unknown>;
  purpose: string;
  ringScope: RingType;
  resourceId: string;
  action: PolicyAction;
  expectedArtifacts: readonly string[];
}

export interface OmniPlan {
  id: string;
  goal: string;
  plannerMode: "offline" | "live";
  /** Model id that produced the plan — set only for live plans. */
  plannerModelId?: string;
  createdAt: string;
  steps: readonly PlanStep[];
  status: "proposed" | "approved" | "rejected";
  approval?: {
    by: string;
    at: string;
    vetoedStepIds: readonly string[];
  };
}

export interface Planner {
  readonly mode: "offline" | "live";
  plan(goal: string, now?: Date): OmniPlan;
}

export const DEMO_GOAL =
  "Omni, create a sustainable technology community, build three " +
  "specialized research and creator agents, gather authorized " +
  "evidence, organize the findings, create educational content, and " +
  "prepare the community for launch.";

function step(s: PlanStep): PlanStep {
  return s;
}

/** The canonical 10-step demo plan, in execution order. */
function demoSteps(): PlanStep[] {
  return [
    step({
      id: "s1",
      agentId: "steward",
      kind: "action",
      actionId: "community.create",
      args: { name: "Terra Tech Commons", topic: "sustainable technology" },
      purpose: "Create the sustainable technology community shell",
      ringScope: "public",
      resourceId: "community:terra-tech",
      action: "create",
      expectedArtifacts: ["community"],
    }),
    step({
      id: "s2",
      agentId: "oracle",
      kind: "action",
      actionId: "agents.propose",
      args: { agents: ["terra-research", "terra-creator", "terra-archivist"] },
      purpose: "Propose three specialized agents for approval with the plan",
      ringScope: "work",
      resourceId: "agents:registry",
      action: "create",
      expectedArtifacts: ["agent-proposals"],
    }),
    step({
      id: "s3",
      agentId: "terra-research",
      kind: "tool",
      toolId: "notes.search",
      args: { query: "solar" },
      purpose:
        "Gather authorized evidence: search the evidence notes for solar research",
      ringScope: "work",
      resourceId: "evidence:notes",
      action: "view",
      expectedArtifacts: ["evidence-set"],
    }),
    step({
      id: "s4",
      agentId: "terra-research",
      kind: "tool",
      toolId: "files.search",
      args: { query: "solar" },
      purpose: "Gather authorized evidence: search the evidence files",
      ringScope: "work",
      resourceId: "evidence:files",
      action: "view",
      expectedArtifacts: ["evidence-set"],
    }),
    step({
      id: "s5",
      agentId: "terra-archivist",
      kind: "tool",
      toolId: "notes.list",
      args: {},
      purpose: "Inventory the full authorized evidence corpus",
      ringScope: "work",
      resourceId: "evidence:notes",
      action: "view",
      expectedArtifacts: ["evidence-inventory"],
    }),
    step({
      id: "s6",
      agentId: "terra-archivist",
      kind: "tool",
      toolId: "graph.summary",
      args: {},
      purpose: "Summarize the member graph the community launches into",
      ringScope: "work",
      resourceId: "member:graph",
      action: "view",
      expectedArtifacts: ["graph-summary"],
    }),
    step({
      id: "s7",
      agentId: "terra-archivist",
      kind: "action",
      actionId: "findings.organize",
      purpose: "Organize the gathered evidence into a findings brief",
      ringScope: "work",
      resourceId: "findings:terra-tech",
      action: "create",
      expectedArtifacts: ["findings-brief"],
    }),
    step({
      id: "s8",
      agentId: "terra-creator",
      kind: "action",
      actionId: "share.createDraft",
      args: { title: "Solar, Storage, and the Grid We're Building Toward" },
      purpose:
        "Create educational content from the findings brief as a Share Center draft",
      ringScope: "public",
      resourceId: "share:drafts",
      action: "create",
      expectedArtifacts: ["share-draft"],
    }),
    step({
      id: "s9",
      agentId: "steward",
      kind: "action",
      actionId: "community.launchChecklist",
      purpose:
        "Prepare the community for launch: provenance, privacy, and content checklist",
      ringScope: "public",
      resourceId: "community:terra-tech",
      action: "edit",
      expectedArtifacts: ["launch-checklist"],
    }),
    step({
      id: "s10",
      agentId: "connector",
      kind: "action",
      actionId: "cosmos.addNodes",
      purpose: "Add the community and its agents to the knowledge cosmos",
      ringScope: "public",
      resourceId: "cosmos:dataset",
      action: "edit",
      expectedArtifacts: ["cosmos-nodes"],
    }),
  ];
}

/** Generic fallback: propose a research agent → search → organize. */
function genericSteps(goal: string): PlanStep[] {
  const query = goal.trim().slice(0, 80) || "research";
  return [
    step({
      id: "s1",
      agentId: "oracle",
      kind: "action",
      actionId: "agents.propose",
      args: { agents: ["research-agent"] },
      purpose: "Propose a research agent for approval with the plan",
      ringScope: "work",
      resourceId: "agents:registry",
      action: "create",
      expectedArtifacts: ["agent-proposals"],
    }),
    step({
      id: "s2",
      agentId: "research-agent",
      kind: "tool",
      toolId: "notes.search",
      args: { query },
      purpose: "Gather authorized evidence: search the evidence notes",
      ringScope: "work",
      resourceId: "evidence:notes",
      action: "view",
      expectedArtifacts: ["evidence-set"],
    }),
    step({
      id: "s3",
      agentId: "research-agent",
      kind: "action",
      actionId: "findings.organize",
      purpose: "Organize the gathered evidence into a findings brief",
      ringScope: "work",
      resourceId: "findings:research",
      action: "create",
      expectedArtifacts: ["findings-brief"],
    }),
  ];
}

export function createOfflinePlanner(): Planner {
  return {
    mode: "offline",
    plan(goal: string, now?: Date): OmniPlan {
      const normalized = goal.toLowerCase();
      const isCommunityBuild =
        normalized.includes("community") && normalized.includes("agent");
      return {
        // Deterministic per goal: the same goal always plans to the
        // same plan id (FNV-1a fingerprint, non-cryptographic).
        id: `plan:${fnv1a32(normalized.trim())}`,
        goal,
        plannerMode: "offline",
        createdAt: (now ?? new Date()).toISOString(),
        steps: isCommunityBuild ? demoSteps() : genericSteps(goal),
        status: "proposed",
      };
    },
  };
}
