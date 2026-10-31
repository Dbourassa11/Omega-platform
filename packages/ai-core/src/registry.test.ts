import { describe, expect, it } from "vitest";

import { AGENT_FABRIC } from "./agents.js";
import {
  AgentRegistry,
  OMNI_PACKAGE_ACTIONS,
  RegistryError,
  fabricToOmniDefinition,
} from "./registry.js";
import type { OmniAgentDefinition } from "./registry.js";

const KNOWN_TOOLS = ["notes.search", "notes.list", "files.read"];

function makeDefinition(
  overrides: Partial<OmniAgentDefinition> = {},
): OmniAgentDefinition {
  return {
    id: "test-agent",
    name: "Test Agent",
    role: "Testing agent",
    ringScope: ["work"],
    toolAllowlist: ["notes.search"],
    actionAllowlist: ["findings.organize"],
    domainScope: ["intellectual-property"],
    policySubjectId: "agent:test-agent",
    provenanceRequirements: {
      citations: true,
      disclosure: true,
      receipt: true,
      stateLabel: true,
    },
    status: "proposed",
    ...overrides,
  };
}

function makeRegistry(): AgentRegistry {
  return new AgentRegistry({ knownToolIds: KNOWN_TOOLS });
}

describe("AgentRegistry", () => {
  it("propose validates loudly: unknown tool id throws", () => {
    const registry = makeRegistry();
    expect(() =>
      registry.propose(
        makeDefinition({ toolAllowlist: ["nope.tool"] }),
        "because",
        "omni-planner",
      ),
    ).toThrow(RegistryError);
    expect(() =>
      registry.propose(
        makeDefinition({ toolAllowlist: ["nope.tool"] }),
        "because",
        "omni-planner",
      ),
    ).toThrow(/unknown tool id/);
  });

  it("propose validates loudly: unknown action, empty scopes, duplicate id", () => {
    const registry = makeRegistry();
    expect(() =>
      registry.propose(
        makeDefinition({ actionAllowlist: ["bogus.action"] }),
        "because",
        "omni-planner",
      ),
    ).toThrow(/unknown action id/);
    expect(() =>
      registry.propose(makeDefinition({ ringScope: [] }), "because", "p"),
    ).toThrow(/ringScope/);
    expect(() =>
      registry.propose(makeDefinition({ domainScope: [] }), "because", "p"),
    ).toThrow(/domainScope/);
    registry.propose(makeDefinition(), "because", "omni-planner");
    expect(() =>
      registry.propose(makeDefinition(), "again", "omni-planner"),
    ).toThrow(/already proposed/);
  });

  it("propose normalizes status to proposed in the stored copy", () => {
    const registry = makeRegistry();
    const proposal = registry.propose(
      makeDefinition({ status: "active" }),
      "because",
      "omni-planner",
    );
    expect(proposal.definition.status).toBe("proposed");
    // A proposed agent is NOT active.
    expect(() => registry.assertActive("test-agent")).toThrow(RegistryError);
    expect(registry.getAgent("test-agent")).toBeUndefined();
  });

  it("agent approver throws on approve and on reject", () => {
    const registry = makeRegistry();
    const proposal = registry.propose(makeDefinition(), "because", "omni-planner");
    expect(() =>
      registry.approve(proposal.id, { id: "agent:oracle", kind: "agent" }),
    ).toThrow(/no agent approves agents/);
    expect(() =>
      registry.reject(proposal.id, { id: "agent:oracle", kind: "agent" }),
    ).toThrow(RegistryError);
    expect(registry.listProposals()[0]?.decision).toBeUndefined();
  });

  it("approve activates the agent and records the decision", () => {
    const registry = makeRegistry();
    const proposal = registry.propose(makeDefinition(), "because", "omni-planner");
    const active = registry.approve(proposal.id, {
      id: "member:ada",
      kind: "person",
    });
    expect(active.status).toBe("active");
    expect(registry.assertActive("test-agent").id).toBe("test-agent");
    expect(registry.listAgents()).toHaveLength(1);
    const stored = registry.listProposals()[0];
    expect(stored?.decision?.outcome).toBe("approved");
    expect(stored?.decision?.by).toBe("member:ada");
    // Double-deciding throws.
    expect(() =>
      registry.approve(proposal.id, { id: "member:ada", kind: "person" }),
    ).toThrow(/already decided/);
    expect(() => registry.approve("proposal:nope:99", { id: "x", kind: "person" })).toThrow(
      /unknown proposal/,
    );
  });

  it("reject path: decided, never active, assertActive throws", () => {
    const registry = makeRegistry();
    const proposal = registry.propose(makeDefinition(), "because", "omni-planner");
    const rejected = registry.reject(
      proposal.id,
      { id: "member:ada", kind: "person" },
      "not needed",
    );
    expect(rejected.decision?.outcome).toBe("rejected");
    expect(rejected.decision?.note).toBe("not needed");
    expect(registry.getAgent("test-agent")).toBeUndefined();
    expect(() => registry.assertActive("test-agent")).toThrow(RegistryError);
  });

  it("registerActive seeds and retire deactivates", () => {
    const registry = makeRegistry();
    registry.registerActive(makeDefinition({ status: "proposed" }));
    expect(registry.assertActive("test-agent").status).toBe("active");
    expect(registry.isFounderSeeded("test-agent")).toBe(true);
    registry.retire("test-agent");
    expect(() => registry.assertActive("test-agent")).toThrow(/retired/);
    expect(() => registry.retire("ghost")).toThrow(RegistryError);
  });

  it("OMNI_PACKAGE_ACTIONS is the canonical action set", () => {
    expect(OMNI_PACKAGE_ACTIONS).toContain("agents.propose");
    expect(OMNI_PACKAGE_ACTIONS).toContain("share.createDraft");
    expect(OMNI_PACKAGE_ACTIONS).toHaveLength(6);
  });
});

describe("fabricToOmniDefinition", () => {
  it("maps all 8 fabric agents with principled domain scopes", () => {
    expect(AGENT_FABRIC).toHaveLength(8);
    const byId = new Map(
      AGENT_FABRIC.map((f) => [f.id, fabricToOmniDefinition(f)]),
    );
    expect(byId.get("oracle")?.domainScope).toEqual([
      "social",
      "intellectual-property",
      "public-released",
    ]);
    expect(byId.get("guardian")?.domainScope).toHaveLength(10);
    expect(byId.get("memory-curator")?.domainScope).toEqual([
      "family-heritage",
      "legacy",
      "social",
    ]);
    expect(byId.get("avatar")?.domainScope).toEqual(["identity", "public-released"]);
    expect(byId.get("legacy-mirror")?.domainScope).toEqual([
      "legacy",
      "family-heritage",
    ]);
    expect(byId.get("studio")?.domainScope).toEqual([
      "intellectual-property",
      "social",
      "public-released",
    ]);
    expect(byId.get("connector")?.domainScope).toEqual(["social", "ai-agents"]);
    expect(byId.get("steward")?.domainScope).toEqual(["financial", "social"]);
    for (const def of byId.values()) {
      expect(def.status).toBe("active");
      expect(def.actionAllowlist).toEqual([]);
      expect(def.policySubjectId).toBe(`agent:${def.id}`);
    }
    expect(byId.get("guardian")?.toolAllowlist).toEqual([
      "consent-core.canAccess",
      "consent-core.isReceiptActive",
    ]);
  });
});
