import { describe, expect, it } from "vitest";

import { DEMO_GOAL, createOfflinePlanner } from "./planner.js";

describe("createOfflinePlanner", () => {
  it("is honestly labeled offline", () => {
    const planner = createOfflinePlanner();
    expect(planner.mode).toBe("offline");
    const plan = planner.plan(DEMO_GOAL);
    expect(plan.plannerMode).toBe("offline");
    expect(plan.status).toBe("proposed");
    expect(plan.goal).toBe(DEMO_GOAL);
  });

  it("DEMO_GOAL produces the canonical 10 steps in order", () => {
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    expect(plan.steps).toHaveLength(10);
    expect(plan.steps.map((s) => s.id)).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "s7",
      "s8",
      "s9",
      "s10",
    ]);
    expect(plan.steps.map((s) => s.agentId)).toEqual([
      "steward",
      "oracle",
      "terra-research",
      "terra-research",
      "terra-archivist",
      "terra-archivist",
      "terra-archivist",
      "terra-creator",
      "steward",
      "connector",
    ]);
    const byId = new Map(plan.steps.map((s) => [s.id, s]));
    expect(byId.get("s1")?.actionId).toBe("community.create");
    expect(byId.get("s1")?.args).toEqual({
      name: "Terra Tech Commons",
      topic: "sustainable technology",
    });
    expect(byId.get("s2")?.actionId).toBe("agents.propose");
    expect(byId.get("s2")?.args).toEqual({
      agents: ["terra-research", "terra-creator", "terra-archivist"],
    });
    expect(byId.get("s3")?.toolId).toBe("notes.search");
    expect(byId.get("s3")?.args).toEqual({ query: "solar" });
    expect(byId.get("s4")?.toolId).toBe("files.search");
    expect(byId.get("s5")?.toolId).toBe("notes.list");
    expect(byId.get("s6")?.toolId).toBe("graph.summary");
    expect(byId.get("s7")?.actionId).toBe("findings.organize");
    expect(byId.get("s8")?.actionId).toBe("share.createDraft");
    expect(byId.get("s8")?.args).toEqual({
      title: "Solar, Storage, and the Grid We're Building Toward",
    });
    expect(byId.get("s9")?.actionId).toBe("community.launchChecklist");
    expect(byId.get("s10")?.actionId).toBe("cosmos.addNodes");
    expect(byId.get("s3")?.resourceId).toBe("evidence:notes");
    expect(byId.get("s3")?.action).toBe("view");
    expect(byId.get("s8")?.ringScope).toBe("public");
  });

  it("plan ids are deterministic per goal", () => {
    const planner = createOfflinePlanner();
    expect(planner.plan(DEMO_GOAL).id).toBe(planner.plan(DEMO_GOAL).id);
    expect(planner.plan("something else entirely").id).not.toBe(
      planner.plan(DEMO_GOAL).id,
    );
  });

  it("a generic goal produces the 3-step research plan", () => {
    const plan = createOfflinePlanner().plan(
      "Research the history of tidal energy for a briefing",
    );
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]?.actionId).toBe("agents.propose");
    expect(plan.steps[1]?.toolId).toBe("notes.search");
    expect(plan.steps[1]?.kind).toBe("tool");
    expect(plan.steps[2]?.actionId).toBe("findings.organize");
  });

  it("community shape requires both 'community' and 'agent'", () => {
    const planner = createOfflinePlanner();
    expect(planner.plan("Tell me about community gardens").steps).toHaveLength(3);
    expect(
      planner.plan("Build a community with an agent helper").steps,
    ).toHaveLength(10);
  });
});
