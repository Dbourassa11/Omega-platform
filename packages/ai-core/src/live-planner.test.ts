import { describe, expect, it } from "vitest";

import {
  PlanRejectedError,
  createLivePlanner,
  createOmniPlanner,
} from "./live-planner.js";
import { MetaModelClient } from "./meta-model-client.js";
import type { MetaModelFetchFn } from "./meta-model-client.js";
import {
  KNOWN_AGENT_DEFINITIONS,
  OMNI_GATEWAY_TOOL_IDS,
  getKnownAgentDefinition,
} from "./omni-demo.js";
import { createOfflinePlanner } from "./planner.js";
import type { PlanValidationContext } from "./plan-validator.js";

// Dummy fixture string used only to exercise the Authorization header
// shape in tests. It is not a real credential and grants access to nothing.
const TEST_KEY = "test-key-not-a-real-credential";

const ctx: PlanValidationContext = {
  knownAgentIds: ["steward", "oracle", "connector"],
  knownToolIds: OMNI_GATEWAY_TOOL_IDS,
  getKnownAgentDefinition,
  knownAgentDefinitions: KNOWN_AGENT_DEFINITIONS,
};

const VALID_PLAN = {
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

function fetchReturning(content: string): MetaModelFetchFn {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      model: "muse-spark-1.3",
      choices: [{ message: { role: "assistant", content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  });
}

function liveClient(content: string): MetaModelClient {
  return new MetaModelClient({ apiKey: TEST_KEY, fetchFn: fetchReturning(content) });
}

describe("createLivePlanner (mock-fetch)", () => {
  it("accepts a valid live draft as a PROPOSED plan with plannerMode live", async () => {
    const planner = createLivePlanner({
      client: liveClient(JSON.stringify(VALID_PLAN)),
      validationContext: ctx,
    });
    expect(planner.mode).toBe("live");
    const plan = await planner.plan("Research solar evidence");
    expect(plan.plannerMode).toBe("live");
    expect(plan.plannerModelId).toBe("muse-spark-1.3");
    expect(plan.status).toBe("proposed");
    expect(plan.approval).toBeUndefined();
    expect(plan.steps).toHaveLength(2);
    expect(plan.goal).toBe("Research solar evidence");
  });

  it("accepts code-fenced JSON", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_PLAN) + "\n```";
    const planner = createLivePlanner({
      client: liveClient(fenced),
      validationContext: ctx,
    });
    const plan = await planner.plan("Research solar evidence");
    expect(plan.plannerMode).toBe("live");
    expect(plan.steps).toHaveLength(2);
  });

  it("rejects a hallucinated tool id with a PlanRejectedError naming the step", async () => {
    const bad = JSON.parse(JSON.stringify(VALID_PLAN)) as typeof VALID_PLAN;
    (bad.steps[1] as Record<string, unknown>).toolId = "notes.hack";
    const planner = createLivePlanner({
      client: liveClient(JSON.stringify(bad)),
      validationContext: ctx,
    });
    const err = await planner
      .plan("Research solar evidence")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PlanRejectedError);
    const rejected = err as PlanRejectedError;
    expect(rejected.kind).toBe("validation");
    expect(rejected.errors.some((e) => e.includes("step 1"))).toBe(true);
    expect(rejected.errors.some((e) => e.includes("notes.hack"))).toBe(true);
    expect(rejected.message).toContain("Live planner output rejected");
  });

  it("rejects an unknown agent that is neither registered nor proposed", async () => {
    const bad = JSON.parse(JSON.stringify(VALID_PLAN)) as typeof VALID_PLAN;
    (bad.steps[1] as Record<string, unknown>).agentId = "ghost-agent";
    const planner = createLivePlanner({
      client: liveClient(JSON.stringify(bad)),
      validationContext: ctx,
    });
    await expect(planner.plan("Research solar evidence")).rejects.toThrow(
      PlanRejectedError,
    );
    const err = await planner
      .plan("Research solar evidence")
      .catch((e: unknown) => e);
    expect((err as PlanRejectedError).errors.some((e) =>
      e.includes("ghost-agent"),
    )).toBe(true);
  });

  it("rejects malformed JSON with the parse reason — no silent offline fallback", async () => {
    const planner = createLivePlanner({
      client: liveClient("Sure! Here is your plan: (not json)"),
      validationContext: ctx,
    });
    const err = await planner
      .plan("Research solar evidence")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PlanRejectedError);
    expect((err as PlanRejectedError).kind).toBe("parse");
    expect((err as PlanRejectedError).errors[0]).toContain("not valid JSON");
  });
});

describe("createOmniPlanner factory", () => {
  it("with no key configured returns offline mode and the unchanged offline plan", async () => {
    const planner = createOmniPlanner({ validationContext: ctx, env: {} });
    expect(planner.mode).toBe("offline");
    expect(planner.modelId).toBeUndefined();
    const now = new Date("2026-10-27T12:00:00.000Z");
    const goal = "Research the history of tidal energy";
    const plan = await planner.plan(goal, now);
    expect(plan.plannerMode).toBe("offline");
    expect(plan).toEqual(createOfflinePlanner().plan(goal, now));
  });

  it("with a live client returns live mode and live plans", async () => {
    const planner = createOmniPlanner({
      client: liveClient(JSON.stringify(VALID_PLAN)),
      validationContext: ctx,
      env: {},
    });
    expect(planner.mode).toBe("live");
    expect(planner.modelId).toBe("muse-spark-1.3");
    const plan = await planner.plan("Research solar evidence");
    expect(plan.plannerMode).toBe("live");
    expect(plan.status).toBe("proposed");
  });
});
