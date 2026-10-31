import { describe, expect, it } from "vitest";

import { PolicyEngine } from "@omega/policy-engine";
import type { Gateway } from "@omega/mcp-gateway";
import { VersionedMemoryVault } from "@omega/legacy-engine";

import { ExecutionError, OmniExecutor, approvePlan } from "./execution.js";
import type { ActionHandler, ArtifactRef } from "./execution.js";
import {
  OMNI_OWNER_ID,
  TERRA_AGENT_DEFINITIONS,
  buildEvidenceGateway,
  buildOmniPolicyState,
  buildOmniRegistry,
} from "./omni-demo.js";
import { DEMO_GOAL, createOfflinePlanner } from "./planner.js";
import type { OmniPlan } from "./planner.js";
import type { AgentRegistry } from "./registry.js";

const PERSON = { id: OMNI_OWNER_ID, kind: "person" as const };

function simpleArtifact(stepId: string, actionId: string): ArtifactRef {
  return {
    kind: "package-action",
    id: `${actionId}:${stepId}`,
    title: `${actionId} completed`,
  };
}

const DEFAULT_HANDLERS: Readonly<Record<string, ActionHandler>> = {
  "community.create": (step) => [simpleArtifact(step.id, "community.create")],
  "findings.organize": (step) => [simpleArtifact(step.id, "findings.organize")],
  "share.createDraft": (step) => [simpleArtifact(step.id, "share.createDraft")],
  "community.launchChecklist": (step) => [
    simpleArtifact(step.id, "community.launchChecklist"),
  ],
  "cosmos.addNodes": (step) => [simpleArtifact(step.id, "cosmos.addNodes")],
};

function buildAll(gatewayOverride?: Gateway) {
  const registry = buildOmniRegistry();
  const policy = new PolicyEngine(buildOmniPolicyState());
  const gateway = gatewayOverride ?? buildEvidenceGateway();
  const vault = new VersionedMemoryVault();
  const executor = new OmniExecutor({
    registry,
    policy,
    gateway,
    ownerId: OMNI_OWNER_ID,
    actionHandlers: DEFAULT_HANDLERS,
    vault,
  });
  return { registry, policy, gateway, vault, executor };
}

function activateTerra(registry: AgentRegistry, index: number): void {
  const definition = TERRA_AGENT_DEFINITIONS[index];
  if (definition === undefined) throw new Error("missing terra definition");
  const proposal = registry.propose(definition, "demo setup", "omni-planner");
  registry.approve(proposal.id, PERSON);
}

describe("OmniExecutor acceptance", () => {
  it("happy path: unapproved throws; approved runs 10 steps, all executed, terra agents active, vault receipt present", async () => {
    const { registry, executor, vault } = buildAll();
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    await expect(executor.execute(plan)).rejects.toThrow(ExecutionError);

    const approved = approvePlan(plan, PERSON);
    expect(approved.status).toBe("approved");
    expect(plan.status).toBe("proposed"); // original untouched
    expect(Object.isFrozen(approved)).toBe(true);
    expect(Object.isFrozen(approved.steps)).toBe(true);

    const run = await executor.execute(approved);
    expect(run.status).toBe("completed");
    expect(run.planId).toBe(plan.id);
    expect(run.receipts).toHaveLength(10);
    expect(run.receipts.map((r) => r.outcome)).toEqual(
      Array(10).fill("executed"),
    );
    expect(run.receipts.map((r) => r.stepId)).toEqual([
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
    expect(run.receipts[1]?.artifacts.map((a) => a.id)).toEqual([
      "terra-research",
      "terra-creator",
      "terra-archivist",
    ]);
    for (const id of ["terra-research", "terra-creator", "terra-archivist"]) {
      expect(registry.assertActive(id).id).toBe(id);
    }
    expect(run.vaultReceiptId).toBeDefined();
    expect(vault.list()).toHaveLength(1);
    expect(vault.verifyChain(vault.list()[0]?.id ?? "")).toBe(true);
  });

  it("veto: s10 is vetoed, the rest execute, status is completed", async () => {
    const { executor } = buildAll();
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    const approved = approvePlan(plan, PERSON, ["s10"]);
    const run = await executor.execute(approved);
    expect(run.status).toBe("completed");
    expect(run.receipts).toHaveLength(10);
    const s10 = run.receipts.find((r) => r.stepId === "s10");
    expect(s10?.outcome).toBe("vetoed");
    expect(
      run.receipts.filter((r) => r.outcome === "executed"),
    ).toHaveLength(9);
  });

  it("out-of-scope: financial resource for terra-research is denied, gateway never runs, run fails", async () => {
    const realGateway = buildEvidenceGateway();
    let calls = 0;
    const countingGateway: Gateway = {
      registerTool: (tool) => realGateway.registerTool(tool),
      handle: async (request) => {
        calls += 1;
        return realGateway.handle(request);
      },
      listReceipts: () => realGateway.listReceipts(),
    };
    const { registry, executor } = buildAll(countingGateway);
    activateTerra(registry, 0);

    const rawPlan: OmniPlan = {
      id: "plan:out-of-scope",
      goal: "Out of scope probe",
      plannerMode: "offline",
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: "s1",
          agentId: "terra-research",
          kind: "tool",
          toolId: "files.read",
          args: { path: "anything" },
          purpose: "Probe a financial resource outside the agent's domain scope",
          ringScope: "work",
          resourceId: "vault:private-finances",
          action: "view",
          expectedArtifacts: ["evidence-set"],
        },
      ],
      status: "proposed",
    };
    const approved = approvePlan(rawPlan, PERSON);
    const run = await executor.execute(approved);
    expect(run.status).toBe("failed");
    expect(run.receipts).toHaveLength(1);
    expect(run.receipts[0]?.outcome).toBe("denied");
    expect(run.receipts[0]?.reason).toBeDefined();
    expect(run.receipts[0]?.reason).toContain("financial");
    expect(run.receipts[0]?.artifacts).toHaveLength(0);
    expect(calls).toBe(0);
  });

  it("post-run expiry: a run pass no longer allows access after the run", async () => {
    const { policy, executor } = buildAll();
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    const run = await executor.execute(approvePlan(plan, PERSON));
    expect(run.status).toBe("completed");
    const decision = policy.evaluate({
      subjectId: "agent:terra-research",
      resourceId: "evidence:notes",
      action: "view",
    });
    expect(decision.decision).toBe("deny");
  });

  it("self-grant composition: an agent subject cannot source a grant", () => {
    const { policy } = buildAll();
    expect(() =>
      policy.createGrant({
        id: "g-agent-source",
        kind: "grant",
        granteeSubjectId: "agent:terra-research",
        resourceId: "evidence:notes",
        actions: ["view"],
        purpose: "self-escalation probe",
        grantedBy: "agent:terra-research",
        grantedAt: new Date().toISOString(),
        revokedAt: null,
      }),
    ).toThrow(/cannot source grants/);
  });

  it("forged plan: status approved without an approval record throws", async () => {
    const { executor } = buildAll();
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    const forged: OmniPlan = {
      id: plan.id,
      goal: plan.goal,
      plannerMode: "offline",
      createdAt: plan.createdAt,
      steps: plan.steps,
      status: "approved",
    };
    await expect(executor.execute(forged)).rejects.toThrow(ExecutionError);
  });

  it("approvePlan rejects an agent approver and unknown veto ids", () => {
    const plan = createOfflinePlanner().plan(DEMO_GOAL);
    expect(() =>
      approvePlan(plan, { id: "agent:oracle", kind: "agent" }),
    ).toThrow(ExecutionError);
    expect(() => approvePlan(plan, PERSON, ["s99"])).toThrow(/unknown step/);
  });

  it("a step for a not-yet-active agent denies and halts", async () => {
    const { executor } = buildAll();
    const rawPlan: OmniPlan = {
      id: "plan:inactive-agent",
      goal: "Probe inactive agent",
      plannerMode: "offline",
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: "s1",
          agentId: "terra-research",
          kind: "tool",
          toolId: "notes.search",
          args: { query: "solar" },
          purpose: "Search before the agent is approved",
          ringScope: "work",
          resourceId: "evidence:notes",
          action: "view",
          expectedArtifacts: ["evidence-set"],
        },
      ],
      status: "proposed",
    };
    const run = await executor.execute(approvePlan(rawPlan, PERSON));
    expect(run.status).toBe("failed");
    expect(run.receipts[0]?.outcome).toBe("denied");
    expect(run.receipts[0]?.reason).toContain("not active");
  });
});
