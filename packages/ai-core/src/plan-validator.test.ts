import { describe, expect, it } from "vitest";

import {
  KNOWN_AGENT_DEFINITIONS,
  OMNI_GATEWAY_TOOL_IDS,
  getKnownAgentDefinition,
} from "./omni-demo.js";
import { validatePlanCandidate } from "./plan-validator.js";
import type { PlanValidationContext } from "./plan-validator.js";

const ctx: PlanValidationContext = {
  knownAgentIds: ["steward", "oracle", "connector"],
  knownToolIds: OMNI_GATEWAY_TOOL_IDS,
  getKnownAgentDefinition,
  knownAgentDefinitions: KNOWN_AGENT_DEFINITIONS,
};

function validCandidate(): Record<string, unknown> {
  return {
    goal: "Research solar evidence",
    steps: [
      {
        id: "s1",
        agentId: "oracle",
        kind: "action",
        actionId: "agents.propose",
        args: { agents: ["terra-research"] },
        purpose: "Propose the research agent",
        ringScope: "work",
        resourceId: "agents:registry",
        action: "create",
        expectedArtifacts: ["agent-proposals"],
      },
      {
        id: "s2",
        agentId: "terra-research",
        kind: "tool",
        toolId: "notes.search",
        args: { query: "solar" },
        purpose: "Search the evidence notes",
        ringScope: "work",
        resourceId: "evidence:notes",
        action: "view",
        expectedArtifacts: ["evidence-set"],
      },
    ],
  };
}

describe("validatePlanCandidate", () => {
  it("accepts a well-formed candidate, including an agent proposed earlier in the same plan", () => {
    const result = validatePlanCandidate(validCandidate(), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.goal).toBe("Research solar evidence");
      expect(result.plan.steps).toHaveLength(2);
      expect(result.plan.steps[1]?.agentId).toBe("terra-research");
      expect(result.plan.steps[1]?.toolId).toBe("notes.search");
    }
  });

  it("rejects a hallucinated tool id, naming the step index", () => {
    const candidate = validCandidate();
    const steps = candidate.steps as Record<string, unknown>[];
    steps[1]!.toolId = "notes.hack";
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("step 1"))).toBe(true);
      expect(result.errors.some((e) => e.includes("notes.hack"))).toBe(true);
    }
  });

  it("rejects an unknown package action id", () => {
    const candidate = validCandidate();
    const steps = candidate.steps as Record<string, unknown>[];
    steps[0]!.actionId = "community.destroy";
    // Keep the propose semantics out of the way: s2's agent becomes
    // unproposed too, so focus the assertion on the action error.
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.includes("unknown action id")),
      ).toBe(true);
    }
  });

  it("rejects an agent that is neither registered nor proposed", () => {
    const candidate = validCandidate();
    const steps = candidate.steps as Record<string, unknown>[];
    steps[1]!.agentId = "ghost-agent";
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.includes("step 1") && e.includes("ghost-agent"),
        ),
      ).toBe(true);
    }
  });

  it("rejects an agent proposed only by a LATER step", () => {
    const candidate = validCandidate();
    const steps = candidate.steps as Record<string, unknown>[];
    // Swap order: use first, propose second.
    candidate.steps = [steps[1]!, steps[0]!];
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.includes("step 0") && e.includes("terra-research"),
        ),
      ).toBe(true);
    }
  });

  it("rejects a proposed agent with no known definition", () => {
    const candidate = validCandidate();
    const steps = candidate.steps as Record<string, unknown>[];
    steps[0]!.args = { agents: ["invented-agent"] };
    steps[1]!.agentId = "invented-agent";
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.includes("invented-agent")),
      ).toBe(true);
    }
  });

  it("collects ALL errors across steps instead of failing fast", () => {
    const candidate = {
      goal: "x",
      steps: [
        {
          id: "s1",
          agentId: "ghost",
          kind: "tool",
          toolId: "nope.tool",
          purpose: "p",
          ringScope: "dungeon",
          resourceId: "",
          action: "obliterate",
          expectedArtifacts: "not-an-array",
        },
        {
          id: "s2",
          agentId: "also-ghost",
          kind: "action",
          actionId: "nope.action",
          purpose: "p",
          ringScope: "work",
          resourceId: "evidence:notes",
          action: "view",
          expectedArtifacts: [],
        },
      ],
    };
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // step 0: tool, agent, ring, action, resourceId, artifacts = 6
      // step 1: action, agent = 2 → at least 8 distinct errors.
      expect(result.errors.length).toBeGreaterThanOrEqual(8);
      expect(result.errors.some((e) => e.includes("step 0"))).toBe(true);
      expect(result.errors.some((e) => e.includes("step 1"))).toBe(true);
    }
  });

  it("rejects non-object candidates and missing goal/steps shape", () => {
    expect(validatePlanCandidate("plan?", ctx).ok).toBe(false);
    expect(validatePlanCandidate(null, ctx).ok).toBe(false);
    const noGoal = validatePlanCandidate({ steps: [] }, ctx);
    expect(noGoal.ok).toBe(false);
    if (!noGoal.ok) {
      expect(noGoal.errors.some((e) => e.includes("goal"))).toBe(true);
      expect(noGoal.errors.some((e) => e.includes("steps"))).toBe(true);
    }
  });

  it("rejects duplicate step ids and non-string expectedArtifacts entries", () => {
    const candidate = validCandidate();
    const steps = candidate.steps as Record<string, unknown>[];
    steps[1]!.id = "s1";
    steps[1]!.expectedArtifacts = ["ok", 42];
    const result = validatePlanCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("duplicate"))).toBe(true);
      expect(
        result.errors.some((e) => e.includes("expectedArtifacts")),
      ).toBe(true);
    }
  });
});
