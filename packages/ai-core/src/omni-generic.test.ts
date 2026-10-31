/**
 * @omega/ai-core — generic-goal plan end-to-end (WS2c)
 *
 * Regression coverage for the planner's generic fallback
 * (planner.ts genericSteps): a free-form goal must plan to
 * propose "research-agent" → notes.search → findings.organize,
 * and the run must COMPLETE — the executor's built-in
 * agents.propose handler resolves the definition via
 * getKnownAgentDefinition (KNOWN_AGENT_DEFINITIONS), the policy
 * state registers agent:research-agent as a subject and carries
 * the findings:research resource, and the research agent ends
 * ACTIVE in the registry.
 *
 * The findings.organize handler below mirrors the web app's
 * handler (apps/web lib/omni.tsx handleFindingsOrganize): it
 * builds a findings brief from ONLY the evidence gathered through
 * the gateway earlier in the same run and returns a
 * "findings-brief" artifact.
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { PolicyEngine } from "@omega/policy-engine";

import { OmniExecutor, approvePlan } from "./execution.js";
import type { ActionHandler } from "./execution.js";
import {
  KNOWN_AGENT_DEFINITIONS,
  OMNI_OWNER_ID,
  RESEARCH_AGENT_DEFINITION,
  buildEvidenceGateway,
  buildOmniPolicyState,
  buildOmniRegistry,
  getKnownAgentDefinition,
  getTerraAgentDefinition,
} from "./omni-demo.js";
import { createOfflinePlanner } from "./planner.js";

const PERSON = { id: OMNI_OWNER_ID, kind: "person" as const };

const GENERIC_GOAL = "Research rooftop solar options for the community hall";

describe("generic-goal plan (research-agent)", () => {
  it("definition: research-agent is known, terra lookup stays terra-only", () => {
    expect(RESEARCH_AGENT_DEFINITION.id).toBe("research-agent");
    expect(RESEARCH_AGENT_DEFINITION.name).toBe("Research Agent");
    expect(RESEARCH_AGENT_DEFINITION.policySubjectId).toBe(
      "agent:research-agent",
    );
    expect(RESEARCH_AGENT_DEFINITION.toolAllowlist).toEqual([
      "notes.search",
      "notes.list",
      "notes.get",
    ]);
    expect(RESEARCH_AGENT_DEFINITION.actionAllowlist).toEqual([
      "findings.organize",
    ]);
    expect(RESEARCH_AGENT_DEFINITION.domainScope).toEqual([
      "intellectual-property",
    ]);
    expect(RESEARCH_AGENT_DEFINITION.status).toBe("proposed");
    expect(getKnownAgentDefinition("research-agent")).toBe(
      RESEARCH_AGENT_DEFINITION,
    );
    expect(getKnownAgentDefinition("terra-research")?.id).toBe(
      "terra-research",
    );
    expect(KNOWN_AGENT_DEFINITIONS.map((d) => d.id)).toEqual([
      "terra-research",
      "terra-creator",
      "terra-archivist",
      "research-agent",
    ]);
    // Public API stability: the terra-only lookup is unchanged.
    expect(getTerraAgentDefinition("research-agent")).toBeUndefined();
    expect(getTerraAgentDefinition("terra-research")?.id).toBe(
      "terra-research",
    );
  });

  it("policy state: research subject + findings:research resource exist", () => {
    const state = buildOmniPolicyState();
    expect(
      state.subjects.find((s) => s.id === "agent:research-agent"),
    ).toMatchObject({ kind: "agent", displayName: "Research Agent" });
    expect(
      state.resources.find((r) => r.id === "findings:research"),
    ).toMatchObject({
      domain: "intellectual-property",
      ownerId: OMNI_OWNER_ID,
    });
    expect(
      state.resources.find((r) => r.id === "evidence:notes"),
    ).toBeDefined();
    expect(
      state.resources.find((r) => r.id === "agents:registry"),
    ).toBeDefined();
  });

  it("end-to-end: generic goal runs all 3 steps, research agent active, notes searched, brief produced", async () => {
    const registry = buildOmniRegistry();
    const policy = new PolicyEngine(buildOmniPolicyState());
    const realGateway = buildEvidenceGateway();

    // Spy gateway: record every tool actually invoked through it.
    const toolCalls: string[] = [];
    const gateway: typeof realGateway = {
      registerTool: (tool) => realGateway.registerTool(tool),
      handle: async (request) => {
        const req = request as {
          method?: unknown;
          params?: { name?: unknown };
        } | null;
        if (req?.method === "tools/call" && typeof req.params?.name === "string") {
          toolCalls.push(req.params.name);
        }
        return realGateway.handle(request);
      },
      listReceipts: () => realGateway.listReceipts(),
    };

    // Mirror of the web app's findings.organize handler: the brief
    // is organized from the evidence gathered in THIS run only.
    let briefEvidenceCount = -1;
    const findingsOrganize: ActionHandler = (step, ctx) => {
      const gathered = [...ctx.gathered.values()];
      briefEvidenceCount = gathered.length;
      const titles: string[] = [];
      for (const item of gathered) {
        if (Array.isArray(item)) {
          for (const entry of item) {
            if (
              typeof entry === "object" &&
              entry !== null &&
              "title" in entry &&
              typeof (entry as { title: unknown }).title === "string"
            ) {
              titles.push((entry as { title: string }).title);
            }
          }
        }
      }
      return [
        {
          kind: "findings-brief",
          id: `findings-brief-${step.id}`,
          title: "Findings brief — gathered evidence",
          detail:
            `${gathered.length} evidence results · ` +
            `${titles.length} titled findings`,
        },
      ];
    };

    const executor = new OmniExecutor({
      registry,
      policy,
      gateway,
      ownerId: OMNI_OWNER_ID,
      actionHandlers: { "findings.organize": findingsOrganize },
    });

    const plan = createOfflinePlanner().plan(GENERIC_GOAL);
    // The generic branch — NOT the community-build demo plan.
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(plan.steps.map((s) => s.agentId)).toEqual([
      "oracle",
      "research-agent",
      "research-agent",
    ]);
    expect(plan.steps[0]?.args).toEqual({ agents: ["research-agent"] });

    const run = await executor.execute(approvePlan(plan, PERSON));

    expect(run.status).toBe("completed");
    expect(run.receipts).toHaveLength(3);
    expect(run.receipts.map((r) => r.outcome)).toEqual([
      "executed",
      "executed",
      "executed",
    ]);
    expect(run.receipts.every((r) => r.outcome !== "error")).toBe(true);

    // s1 proposed + approved the research agent: it ends ACTIVE.
    expect(run.receipts[0]?.artifacts.map((a) => a.id)).toEqual([
      "research-agent",
    ]);
    expect(registry.assertActive("research-agent").id).toBe("research-agent");
    expect(registry.assertActive("research-agent").status).toBe("active");

    // s2 actually ran notes.search through the gateway.
    expect(toolCalls).toEqual(["notes.search"]);
    expect(run.receipts[1]?.artifacts[0]).toMatchObject({
      kind: "tool-result",
      id: "notes.search:s2",
    });

    // s3 produced its findings-brief artifact from the gathered
    // evidence (exactly the one gateway result from s2).
    expect(briefEvidenceCount).toBe(1);
    expect(run.receipts[2]?.artifacts).toHaveLength(1);
    expect(run.receipts[2]?.artifacts[0]).toMatchObject({
      kind: "findings-brief",
      id: "findings-brief-s3",
    });
  });
});
