/**
 * @omega/ai-core — skills system tests (Phase 4, Workstream 3)
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";
import { ADAPTER_CATALOG } from "@omega/mcp-gateway/browser";

import { AGENT_FABRIC } from "./agents.js";
import {
  KNOWN_AGENT_DEFINITIONS,
  buildOmniRegistry,
} from "./omni-demo.js";
import { AgentRegistry, RegistryError, fabricToOmniDefinition } from "./registry.js";
import type { OmniAgentDefinition } from "./registry.js";
import {
  KNOWN_GATEWAY_TOOL_IDS,
  SEED_SKILLS,
  SkillError,
  SkillLibrary,
  createSeedSkillLibrary,
} from "./skills.js";
import type { Skill } from "./skills.js";

const CATALOG_TOOL_IDS = new Set(
  ADAPTER_CATALOG.flatMap((adapter) => adapter.tools.map((tool) => tool.name)),
);

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    description: "A skill used only by these tests.",
    toolIds: ["notes.search"],
    instructionSummary: "Search the notes and cite what you find.",
    provenanceRequirements: {
      citations: true,
      disclosure: true,
      receipt: true,
      stateLabel: true,
    },
    ...overrides,
  };
}

describe("SkillLibrary registration validation", () => {
  it("unknown gateway tool id throws SkillError", () => {
    const library = new SkillLibrary();
    expect(() =>
      library.register(makeSkill({ toolIds: ["bogus.tool"] })),
    ).toThrow(SkillError);
    expect(() =>
      library.register(makeSkill({ toolIds: ["bogus.tool"] })),
    ).toThrow(/unknown gateway tool id 'bogus\.tool'/);
  });

  it("duplicate skill id throws", () => {
    const library = new SkillLibrary();
    library.register(makeSkill());
    expect(() => library.register(makeSkill())).toThrow(/duplicate skill id/);
  });

  it("empty toolIds throws", () => {
    const library = new SkillLibrary();
    expect(() => library.register(makeSkill({ toolIds: [] }))).toThrow(
      /toolIds must not be empty/,
    );
  });

  it("missing version throws", () => {
    const library = new SkillLibrary();
    expect(() => library.register(makeSkill({ version: "" }))).toThrow(
      /missing version/,
    );
    expect(() => library.register(makeSkill({ version: "   " }))).toThrow(
      SkillError,
    );
  });

  it("registers, gets, lists, and freezes a valid skill", () => {
    const library = new SkillLibrary();
    const stored = library.register(makeSkill());
    expect(library.get("test-skill")).toBe(stored);
    expect(library.has("test-skill")).toBe(true);
    expect(library.list()).toHaveLength(1);
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.toolIds)).toBe(true);
  });

  it("host-injected known-tool set is honored (registry.ts pattern)", () => {
    const library = new SkillLibrary({ knownToolIds: ["notes.search"] });
    expect(() => library.register(makeSkill({ toolIds: ["notes.list"] }))).toThrow(
      /unknown gateway tool id/,
    );
  });
});

describe("seed library integrity", () => {
  it("ships exactly the five required seed skills at v1.0.0", () => {
    expect(SEED_SKILLS.map((s) => s.id).sort()).toEqual([
      "archive-curation",
      "community-launch",
      "evidence-research",
      "findings-writing",
      "graph-analysis",
    ]);
    for (const skill of SEED_SKILLS) {
      expect(skill.version).toBe("1.0.0");
      expect(skill.description.length).toBeGreaterThan(40);
      expect(skill.instructionSummary.length).toBeGreaterThan(40);
    }
    expect(createSeedSkillLibrary().list()).toHaveLength(5);
  });

  it("every seed skill's toolIds are a subset of the REAL gateway catalog", () => {
    // The catalog-derived known set matches ADAPTER_CATALOG exactly —
    // no second hand-maintained tool list in skills.ts.
    expect(new Set(KNOWN_GATEWAY_TOOL_IDS)).toEqual(CATALOG_TOOL_IDS);
    for (const skill of SEED_SKILLS) {
      for (const toolId of skill.toolIds) {
        expect(CATALOG_TOOL_IDS.has(toolId)).toBe(true);
      }
    }
  });

  it("seed skills carry the brief's exact tool bundles", () => {
    const byId = new Map(SEED_SKILLS.map((s) => [s.id, s]));
    expect(byId.get("evidence-research")?.toolIds).toEqual([
      "notes.search", "notes.get", "notes.list", "files.search", "files.list",
    ]);
    expect(byId.get("community-launch")?.toolIds).toEqual([
      "graph.summary", "graph.listPeople", "graph.searchPosts",
    ]);
    expect(byId.get("archive-curation")?.toolIds).toEqual([
      "notes.list", "notes.get", "files.list", "graph.listPeople",
    ]);
    expect(byId.get("findings-writing")?.toolIds).toEqual([
      "notes.get", "files.search", "notes.list",
    ]);
    expect(byId.get("graph-analysis")?.toolIds).toEqual([
      "graph.summary", "graph.listPeople", "graph.searchPosts",
    ]);
  });

  it("every built-in agent's skillIds resolve in the seed library", () => {
    const library = createSeedSkillLibrary();
    const builtIns: readonly OmniAgentDefinition[] = [
      ...AGENT_FABRIC.map((f) => fabricToOmniDefinition(f)),
      ...KNOWN_AGENT_DEFINITIONS,
    ];
    for (const def of builtIns) {
      expect(() => library.skillsForAgent(def)).not.toThrow();
      for (const skillId of def.skillIds ?? []) {
        expect(library.has(skillId)).toBe(true);
      }
    }
  });

  it("fabric + known agents carry the assigned seed skills", () => {
    const fabric = new Map(
      AGENT_FABRIC.map((f) => [f.id, fabricToOmniDefinition(f)]),
    );
    expect(fabric.get("oracle")?.skillIds).toEqual([
      "evidence-research", "graph-analysis",
    ]);
    expect(fabric.get("steward")?.skillIds).toEqual(["community-launch"]);
    expect(fabric.get("connector")?.skillIds).toEqual(["graph-analysis"]);
    expect(fabric.get("memory-curator")?.skillIds).toEqual(["archive-curation"]);
    expect(fabric.get("studio")?.skillIds).toEqual(["findings-writing"]);
    expect(fabric.get("guardian")?.skillIds).toEqual([]);
    expect(fabric.get("avatar")?.skillIds).toEqual([]);
    expect(fabric.get("legacy-mirror")?.skillIds).toEqual([]);
    const known = new Map(KNOWN_AGENT_DEFINITIONS.map((d) => [d.id, d]));
    expect(known.get("terra-research")?.skillIds).toEqual([
      "evidence-research", "graph-analysis",
    ]);
    expect(known.get("terra-archivist")?.skillIds).toEqual([
      "archive-curation", "graph-analysis",
    ]);
    expect(known.get("terra-creator")?.skillIds).toEqual(["findings-writing"]);
    expect(known.get("research-agent")?.skillIds).toEqual([
      "evidence-research", "findings-writing",
    ]);
  });

  it("skillsForAgent throws loudly on an unknown skill id", () => {
    const library = createSeedSkillLibrary();
    expect(() =>
      library.skillsForAgent({ id: "ghost-agent", skillIds: ["no-such-skill"] }),
    ).toThrow(/unknown skill id 'no-such-skill'/);
  });

  it("toolCoverage is the union of the agent's skills' toolIds", () => {
    const library = createSeedSkillLibrary();
    const coverage = library.toolCoverage({
      id: "terra-archivist",
      skillIds: ["archive-curation", "graph-analysis"],
    });
    expect(coverage).toEqual(
      new Set([
        "notes.list", "notes.get", "files.list", "graph.listPeople",
        "graph.summary", "graph.searchPosts",
      ]),
    );
    expect(library.toolCoverage({ id: "none", skillIds: [] }).size).toBe(0);
    expect(library.toolCoverage({ id: "bare" }).size).toBe(0);
  });
});

describe("AgentRegistry skill validation", () => {
  const KNOWN_TOOLS = ["notes.search", "notes.list", "files.read"];

  function makeDefinition(
    overrides: Partial<OmniAgentDefinition> = {},
  ): OmniAgentDefinition {
    return {
      id: "skill-test-agent",
      name: "Skill Test Agent",
      role: "Testing skills",
      ringScope: ["work"],
      toolAllowlist: ["notes.search"],
      actionAllowlist: ["findings.organize"],
      domainScope: ["intellectual-property"],
      policySubjectId: "agent:skill-test-agent",
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

  it("unknown skillId throws RegistryError at propose time", () => {
    const registry = new AgentRegistry({ knownToolIds: KNOWN_TOOLS });
    expect(() =>
      registry.propose(
        makeDefinition({ skillIds: ["no-such-skill"] }),
        "because",
        "omni-planner",
      ),
    ).toThrow(RegistryError);
    expect(() =>
      registry.propose(
        makeDefinition({ skillIds: ["no-such-skill"] }),
        "because",
        "omni-planner",
      ),
    ).toThrow(/unknown skill id 'no-such-skill'/);
  });

  it("unknown skillId throws RegistryError at registerActive time", () => {
    const registry = new AgentRegistry({ knownToolIds: KNOWN_TOOLS });
    expect(() =>
      registry.registerActive(makeDefinition({ skillIds: ["nope"] })),
    ).toThrow(/unknown skill id/);
  });

  it("known skillIds pass, are frozen, and missing skillIds default to []", () => {
    const registry = new AgentRegistry({ knownToolIds: KNOWN_TOOLS });
    const proposal = registry.propose(
      makeDefinition({ skillIds: ["evidence-research"] }),
      "because",
      "omni-planner",
    );
    expect(proposal.definition.skillIds).toEqual(["evidence-research"]);
    expect(Object.isFrozen(proposal.definition.skillIds)).toBe(true);

    const bare = new AgentRegistry({ knownToolIds: KNOWN_TOOLS });
    const seeded = bare.registerActive(makeDefinition());
    expect(seeded.skillIds).toEqual([]);
    expect(Object.isFrozen(seeded.skillIds)).toBe(true);
  });

  it("the founder-seeded demo registry still seeds cleanly with skills", () => {
    const registry = buildOmniRegistry();
    expect(registry.listAgents()).toHaveLength(8);
    expect(registry.assertActive("oracle").skillIds).toEqual([
      "evidence-research", "graph-analysis",
    ]);
  });
});
