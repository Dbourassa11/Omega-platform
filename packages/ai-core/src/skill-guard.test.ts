/**
 * @omega/ai-core — skill guard tests (Phase 4, Workstream 3)
 *
 * Includes the DEMO COVERAGE regression: every tool step of the
 * canonical demo plan (and the generic research plan) must pass the
 * guard for its acting agent's known definition, so wiring the guard
 * into the executor cannot break /review/demo's 10/10 run.
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { AGENT_FABRIC } from "./agents.js";
import { getKnownAgentDefinition } from "./omni-demo.js";
import { DEMO_GOAL, createOfflinePlanner } from "./planner.js";
import type { PlanStep } from "./planner.js";
import { fabricToOmniDefinition } from "./registry.js";
import type { OmniAgentDefinition } from "./registry.js";
import { checkStepSkillCoverage } from "./skill-guard.js";
import { createSeedSkillLibrary } from "./skills.js";

const LIBRARY = createSeedSkillLibrary();

function makeAgent(overrides: Partial<OmniAgentDefinition> = {}): OmniAgentDefinition {
  return {
    id: "guard-test-agent",
    name: "Guard Test Agent",
    role: "Testing the guard",
    ringScope: ["work", "public"],
    toolAllowlist: ["notes.search", "notes.list", "graph.summary"],
    actionAllowlist: ["findings.organize"],
    skillIds: ["evidence-research"],
    domainScope: ["intellectual-property"],
    policySubjectId: "agent:guard-test-agent",
    provenanceRequirements: {
      citations: true,
      disclosure: true,
      receipt: true,
      stateLabel: true,
    },
    status: "active",
    ...overrides,
  };
}

function toolStep(toolId: string | undefined): PlanStep {
  return {
    id: "step-tool",
    agentId: "guard-test-agent",
    kind: "tool",
    ...(toolId !== undefined ? { toolId } : {}),
    purpose: "test tool step",
    ringScope: "work",
    resourceId: "evidence:notes",
    action: "view",
    expectedArtifacts: [],
  };
}

function actionStep(): PlanStep {
  return {
    id: "step-action",
    agentId: "guard-test-agent",
    kind: "action",
    actionId: "findings.organize",
    purpose: "test action step",
    ringScope: "work",
    resourceId: "findings:terra-tech",
    action: "create",
    expectedArtifacts: [],
  };
}

describe("checkStepSkillCoverage", () => {
  it("covers a tool step when allowlist AND skill coverage both hold", () => {
    // notes.search ∈ allowlist and ∈ evidence-research.
    expect(
      checkStepSkillCoverage(makeAgent(), toolStep("notes.search"), LIBRARY),
    ).toEqual({ covered: true });
  });

  it("refuses when the skill is missing even if the tool is allowlisted", () => {
    // graph.summary is allowlisted but evidence-research does not cover it.
    const result = checkStepSkillCoverage(
      makeAgent(),
      toolStep("graph.summary"),
      LIBRARY,
    );
    expect(result.covered).toBe(false);
    if (!result.covered) {
      expect(result.reason).toContain("guard-test-agent");
      expect(result.reason).toContain("graph.summary");
      expect(result.reason).toContain("skill");
      expect(result.reason).toContain("coverage check");
    }
  });

  it("refuses an agent holding no skills at all for an allowlisted tool", () => {
    const result = checkStepSkillCoverage(
      makeAgent({ skillIds: [] }),
      toolStep("notes.search"),
      LIBRARY,
    );
    expect(result.covered).toBe(false);
    if (!result.covered) {
      expect(result.reason).toContain("skill coverage check");
    }
  });

  it("refuses when not allowlisted even if a skill covers the tool", () => {
    // files.search ∈ evidence-research but NOT in this agent's allowlist.
    const result = checkStepSkillCoverage(
      makeAgent(),
      toolStep("files.search"),
      LIBRARY,
    );
    expect(result.covered).toBe(false);
    if (!result.covered) {
      expect(result.reason).toContain("guard-test-agent");
      expect(result.reason).toContain("files.search");
      expect(result.reason).toContain("allowlist");
    }
  });

  it("covers action steps (actions stay allowlist-governed)", () => {
    expect(
      checkStepSkillCoverage(makeAgent({ skillIds: [] }), actionStep(), LIBRARY),
    ).toEqual({ covered: true });
  });

  it("refuses a tool step carrying no toolId, naming the agent", () => {
    const result = checkStepSkillCoverage(makeAgent(), toolStep(undefined), LIBRARY);
    expect(result.covered).toBe(false);
    if (!result.covered) {
      expect(result.reason).toContain("guard-test-agent");
      expect(result.reason).toContain("no toolId");
    }
  });

  it("refuses when the agent references an unknown skill id", () => {
    const result = checkStepSkillCoverage(
      makeAgent({ skillIds: ["ghost-skill"] }),
      toolStep("notes.search"),
      LIBRARY,
    );
    expect(result.covered).toBe(false);
    if (!result.covered) {
      expect(result.reason).toContain("unknown skill id 'ghost-skill'");
    }
  });

  it("defaults to the seed library when none is passed", () => {
    expect(checkStepSkillCoverage(makeAgent(), toolStep("notes.search"))).toEqual({
      covered: true,
    });
  });
});

describe("DEMO COVERAGE regression", () => {
  function definitionFor(agentId: string): OmniAgentDefinition {
    const known = getKnownAgentDefinition(agentId);
    if (known !== undefined) return known;
    const fabric = AGENT_FABRIC.find((f) => f.id === agentId);
    if (fabric !== undefined) return fabricToOmniDefinition(fabric);
    throw new Error(`no known definition for agent '${agentId}'`);
  }

  it("every tool step of the canonical demo plan passes the guard", () => {
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    expect(plan.steps).toHaveLength(10);
    const toolSteps = plan.steps.filter((s) => s.kind === "tool");
    // The demo's four tool steps: terra-research ×2, terra-archivist ×2.
    expect(toolSteps.map((s) => s.id)).toEqual(["s3", "s4", "s5", "s6"]);
    for (const step of toolSteps) {
      const result = checkStepSkillCoverage(
        definitionFor(step.agentId),
        step,
        LIBRARY,
      );
      expect(result, `step ${step.id} (${step.toolId})`).toEqual({
        covered: true,
      });
    }
    // And every action step is covered by the guard's action rule.
    for (const step of plan.steps.filter((s) => s.kind === "action")) {
      expect(
        checkStepSkillCoverage(definitionFor(step.agentId), step, LIBRARY),
      ).toEqual({ covered: true });
    }
  });

  it("the generic research plan's tool step passes the guard", () => {
    const plan = createOfflinePlanner().plan("Research passive housing options");
    for (const step of plan.steps.filter((s) => s.kind === "tool")) {
      expect(
        checkStepSkillCoverage(definitionFor(step.agentId), step, LIBRARY),
      ).toEqual({ covered: true });
    }
  });
});
