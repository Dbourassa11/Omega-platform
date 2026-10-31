/**
 * @omega/ai-core — Skills system (Phase 4, Alive Pass — Workstream 3)
 *
 * A Skill is DATA, not code: a named, versioned bundle of gateway
 * tools plus the instruction summary and provenance expectations an
 * agent holding the skill works under. Agents reference skills by id
 * (`OmniAgentDefinition.skillIds`, registry.ts); the executor's skill
 * guard (skill-guard.ts) resolves those ids through a SkillLibrary
 * and requires a tool step's tool to be covered by BOTH the agent's
 * toolAllowlist AND the union of its skills' toolIds — skills compose
 * with the allowlist, they never replace it.
 *
 * Validation is loud (SkillError), mirroring registry.ts:
 * - unknown gateway tool id — validated against the SAME known-tools
 *   source the rest of the Omni layer uses: the @omega/mcp-gateway
 *   adapter catalog (ADAPTER_CATALOG, re-exported from the gateway's
 *   browser entry, exactly as omni-demo.ts / execution.ts import the
 *   gateway). There is deliberately NO second hard-coded tool list in
 *   this module; the catalog-derived set below is computed from that
 *   catalog, and a host may inject a different known-tool set via the
 *   SkillLibrary constructor (the same host-supplied-set pattern
 *   AgentRegistry uses for its own tool validation).
 * - duplicate skill id, empty toolIds, missing/blank version, and
 *   blank id/name/description/instructionSummary all throw.
 *
 * Provenance shape: reuses AgentProvenanceRequirements from agents.ts
 * verbatim — a skill's runs must emit exactly the same citation /
 * disclosure / receipt / state-label commitments a fabric agent's
 * runs must, so no compatible-but-different shape was needed.
 *
 * Import-cycle rule: this module must NOT import registry.ts.
 * Agent-shaped inputs are accepted structurally (SkillBearer), so the
 * registry can import this module without a cycle.
 *
 * Creator: David Charles Bourassa
 */

import { ADAPTER_CATALOG } from "@omega/mcp-gateway/browser";

import type { AgentProvenanceRequirements } from "./agents.js";

export class SkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillError";
  }
}

/**
 * The known gateway tool ids, derived from the gateway's own adapter
 * catalog — the single source of truth for gateway tools. Computed,
 * never hand-listed.
 */
export const KNOWN_GATEWAY_TOOL_IDS: readonly string[] = ADAPTER_CATALOG.flatMap(
  (adapter) => adapter.tools.map((tool) => tool.name),
);

/** A skill: pure serializable data. */
export interface Skill {
  id: string;
  name: string;
  /** Semver-ish version string, e.g. "1.0.0". Required, non-blank. */
  version: string;
  description: string;
  /** Gateway tool ids this skill bundles. Non-empty, all known. */
  toolIds: readonly string[];
  /** What the skill instructs the agent to do (incl. provenance). */
  instructionSummary: string;
  provenanceRequirements: AgentProvenanceRequirements;
}

/** Anything that carries skill ids — structurally, an agent definition. */
export interface SkillBearer {
  id?: string;
  skillIds?: readonly string[];
}

function freezeSkill(skill: Skill): Skill {
  const copy: Skill = {
    ...skill,
    toolIds: [...skill.toolIds],
    provenanceRequirements: { ...skill.provenanceRequirements },
  };
  Object.freeze(copy.toolIds);
  Object.freeze(copy.provenanceRequirements);
  return Object.freeze(copy);
}

export class SkillLibrary {
  readonly #knownToolIds: ReadonlySet<string>;
  readonly #skills = new Map<string, Skill>();

  constructor(opts?: {
    knownToolIds?: Iterable<string>;
    skills?: readonly Skill[];
  }) {
    this.#knownToolIds = new Set(opts?.knownToolIds ?? KNOWN_GATEWAY_TOOL_IDS);
    for (const skill of opts?.skills ?? []) {
      this.register(skill);
    }
  }

  #validate(skill: Skill): void {
    if (typeof skill.id !== "string" || skill.id.trim() === "") {
      throw new SkillError("skill requires a non-empty id");
    }
    if (typeof skill.name !== "string" || skill.name.trim() === "") {
      throw new SkillError(`skill '${skill.id}': requires a non-empty name`);
    }
    if (typeof skill.version !== "string" || skill.version.trim() === "") {
      throw new SkillError(
        `skill '${skill.id}': missing version (a version string such as "1.0.0" is required)`,
      );
    }
    if (typeof skill.description !== "string" || skill.description.trim() === "") {
      throw new SkillError(`skill '${skill.id}': requires a non-empty description`);
    }
    if (
      typeof skill.instructionSummary !== "string" ||
      skill.instructionSummary.trim() === ""
    ) {
      throw new SkillError(
        `skill '${skill.id}': requires a non-empty instructionSummary`,
      );
    }
    if (!Array.isArray(skill.toolIds) || skill.toolIds.length === 0) {
      throw new SkillError(
        `skill '${skill.id}': toolIds must not be empty (a skill bundles at least one gateway tool)`,
      );
    }
    for (const toolId of skill.toolIds) {
      if (!this.#knownToolIds.has(toolId)) {
        throw new SkillError(
          `skill '${skill.id}': unknown gateway tool id '${toolId}' ` +
            `(not in the @omega/mcp-gateway adapter catalog)`,
        );
      }
    }
    if (skill.provenanceRequirements === undefined || skill.provenanceRequirements === null) {
      throw new SkillError(
        `skill '${skill.id}': provenanceRequirements are required`,
      );
    }
  }

  /** Register a skill. Throws SkillError loudly on any invalid skill. */
  register(skill: Skill): Skill {
    this.#validate(skill);
    if (this.#skills.has(skill.id)) {
      throw new SkillError(
        `skill '${skill.id}' is already registered (duplicate skill id)`,
      );
    }
    const stored = freezeSkill(skill);
    this.#skills.set(stored.id, stored);
    return stored;
  }

  get(id: string): Skill | undefined {
    return this.#skills.get(id);
  }

  has(id: string): boolean {
    return this.#skills.has(id);
  }

  list(): readonly Skill[] {
    return [...this.#skills.values()];
  }

  /**
   * Resolve an agent definition's skillIds to skills, in declaration
   * order. An unknown skill id throws SkillError — resolution fails
   * loudly, never silently drops a skill.
   */
  skillsForAgent(definition: SkillBearer): readonly Skill[] {
    const skills: Skill[] = [];
    for (const skillId of definition.skillIds ?? []) {
      const skill = this.#skills.get(skillId);
      if (skill === undefined) {
        throw new SkillError(
          `agent '${definition.id ?? "(unknown)"}': unknown skill id '${skillId}' ` +
            `(not in this skill library)`,
        );
      }
      skills.push(skill);
    }
    return skills;
  }

  /** Union of the toolIds of every skill the agent holds. */
  toolCoverage(definition: SkillBearer): Set<string> {
    const coverage = new Set<string>();
    for (const skill of this.skillsForAgent(definition)) {
      for (const toolId of skill.toolIds) {
        coverage.add(toolId);
      }
    }
    return coverage;
  }
}

// ---------------------------------------------------------------------------
// Seed library — five skills, v1.0.0, built ONLY from real gateway tools
// ---------------------------------------------------------------------------

const SEED_PROVENANCE: AgentProvenanceRequirements = {
  citations: true,
  disclosure: true,
  receipt: true,
  stateLabel: true,
};

export const SEED_SKILLS: readonly Skill[] = [
  {
    id: "evidence-research",
    name: "Evidence Research",
    version: "1.0.0",
    description:
      "Gathers authorized evidence from the notes and files surfaces: " +
      "search first, then read the full text of what the search surfaces, " +
      "so findings rest on retrieved sources rather than titles or " +
      "snippets. This is the research skill behind the demo's evidence " +
      "steps and the generic research agent's note searches.",
    toolIds: ["notes.search", "notes.get", "notes.list", "files.search", "files.list"],
    instructionSummary:
      "Search notes and files for the goal's terms before concluding " +
      "anything; open the full note (notes.get) for every source you " +
      "rely on; inventory with notes.list / files.list when coverage " +
      "is in question. Provenance: cite every retrieved source, " +
      "disclose the offline/demo state, and emit a receipt for the run.",
    provenanceRequirements: { ...SEED_PROVENANCE },
  },
  {
    id: "community-launch",
    name: "Community Launch",
    version: "1.0.0",
    description:
      "Prepares a community launch from the member graph: summarizes " +
      "the graph the community launches into, lists the people in it, " +
      "and searches existing posts so the launch builds on what the " +
      "community already talks about instead of duplicating it.",
    toolIds: ["graph.summary", "graph.listPeople", "graph.searchPosts"],
    instructionSummary:
      "Start from graph.summary for the shape of the community, use " +
      "graph.listPeople to know who is present, and graph.searchPosts " +
      "to check prior conversation on the launch topic before drafting " +
      "anything. Provenance: cite the graph data behind every launch " +
      "claim, disclose the state, and emit a receipt for the run.",
    provenanceRequirements: { ...SEED_PROVENANCE },
  },
  {
    id: "archive-curation",
    name: "Archive Curation",
    version: "1.0.0",
    description:
      "Inventories and organizes an evidence archive: lists the notes " +
      "and files that exist, reads individual notes in full when their " +
      "content decides placement, and cross-checks the people named in " +
      "the archive against the member graph so curation keeps its " +
      "human context attached.",
    toolIds: ["notes.list", "notes.get", "files.list", "graph.listPeople"],
    instructionSummary:
      "Inventory before organizing: notes.list and files.list define " +
      "what exists; notes.get settles any item whose placement depends " +
      "on its content; graph.listPeople resolves people references. " +
      "Provenance: cite the inventory behind every curation decision, " +
      "disclose the state, and emit a receipt for the run.",
    provenanceRequirements: { ...SEED_PROVENANCE },
  },
  {
    id: "findings-writing",
    name: "Findings Writing",
    version: "1.0.0",
    description:
      "Turns gathered evidence into a findings draft: re-reads the " +
      "source notes in full, searches the files for supporting " +
      "material the first pass missed, and checks the note inventory " +
      "so the draft accounts for the whole corpus it claims to cover.",
    toolIds: ["notes.get", "files.search", "notes.list"],
    instructionSummary:
      "Write only from sources you have re-read with notes.get in this " +
      "run; use files.search to fill gaps and notes.list to confirm " +
      "coverage before drafting. Provenance: every claim in the draft " +
      "carries its source citation, the draft is disclosed as " +
      "agent-drafted, and the run emits a receipt.",
    provenanceRequirements: { ...SEED_PROVENANCE },
  },
  {
    id: "graph-analysis",
    name: "Graph Analysis",
    version: "1.0.0",
    description:
      "Analyzes the member graph as evidence: its summary shape, the " +
      "people in it, and what their posts actually say, so research " +
      "and archiving steps can ground social claims in the graph " +
      "itself rather than in assumptions about the community.",
    toolIds: ["graph.summary", "graph.listPeople", "graph.searchPosts"],
    instructionSummary:
      "Anchor every social claim in a graph read from this run: " +
      "graph.summary for totals and shape, graph.listPeople for who " +
      "is present, graph.searchPosts for what was actually posted. " +
      "Provenance: cite the graph reads behind each claim, disclose " +
      "the state, and emit a receipt for the run.",
    provenanceRequirements: { ...SEED_PROVENANCE },
  },
];

/** A fresh SkillLibrary pre-loaded with exactly the seed skills. */
export function createSeedSkillLibrary(opts?: {
  knownToolIds?: Iterable<string>;
}): SkillLibrary {
  return new SkillLibrary({
    ...(opts?.knownToolIds !== undefined
      ? { knownToolIds: opts.knownToolIds }
      : {}),
    skills: SEED_SKILLS,
  });
}

/**
 * Shared seed library instance for read-only resolution (web surfaces,
 * the skill guard's default). Callers that register their own skills
 * should build their own SkillLibrary instead of mutating this one.
 */
export const SEED_SKILL_LIBRARY: SkillLibrary = createSeedSkillLibrary();

/** Standalone coverage helper over an explicit (or the seed) library. */
export function toolCoverageForAgent(
  definition: SkillBearer,
  library: SkillLibrary = SEED_SKILL_LIBRARY,
): Set<string> {
  return library.toolCoverage(definition);
}
