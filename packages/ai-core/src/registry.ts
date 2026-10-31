/**
 * @omega/ai-core — Omni agent creation registry (Phase 3B)
 *
 * The registry is the ONLY way an agent becomes active in the Omni
 * execution layer:
 *
 *   propose(definition) → human approve() → active
 *                       → human reject()  → decided, never active
 *
 * Activation without approval fails loudly: `assertActive` throws a
 * RegistryError for proposed / rejected / retired / unknown agents,
 * and `approve` throws when the approver is itself an agent (no agent
 * approves agents — mirroring @omega/policy-engine's rule that an
 * agent subject can never source a grant).
 *
 * `registerActive` is the single exception and it exists ONLY for
 * founder-seeded agents — the canonical 8-agent fabric in agents.ts,
 * seeded by the host at startup. It is not a creation path for new
 * agents; new agents go through propose → approve.
 *
 * Validation is loud (RegistryError) on: unknown gateway tool ids,
 * unknown package action ids, unknown skill ids (validated against
 * the seed SkillLibrary from skills.ts, or a host-supplied library),
 * unknown policy domains, empty ring or domain scope, and duplicate
 * agent ids.
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";
import { DATA_DOMAINS } from "@omega/policy-engine";
import type { DataDomain } from "@omega/policy-engine";

import type {
  AgentFabricDefinition,
  AgentProvenanceRequirements,
} from "./agents.js";
import { createSeedSkillLibrary } from "./skills.js";
import type { SkillLibrary } from "./skills.js";

export type { DataDomain };

export type OmniAgentStatus = "proposed" | "approved" | "active" | "retired";

/**
 * A serializable agent definition for the Omni execution layer.
 * Unlike a fabric definition, this binds an agent to the concrete
 * execution surfaces: gateway tool ids it may call, package action
 * ids it may perform, the policy domains it may ever be granted, and
 * the policy-engine subject that passes are issued to.
 */
export interface OmniAgentDefinition {
  id: string;
  name: string;
  role: string;
  ringScope: readonly RingType[];
  /** Gateway tool ids (e.g. "notes.search"). */
  toolAllowlist: readonly string[];
  /** Package action ids (see OMNI_PACKAGE_ACTIONS). */
  actionAllowlist: readonly string[];
  /**
   * Skill ids (skills.ts) this agent holds. Optional on input for
   * backward compatibility with existing definition literals and
   * factories: freezeDefinition materializes a missing value to a
   * frozen [], so every definition the registry stores carries the
   * field. Each id must resolve in the registry's skill library —
   * unknown ids throw RegistryError at propose/registerActive time.
   */
  skillIds?: readonly string[];
  /** Policy domains the agent may ever be granted. */
  domainScope: readonly DataDomain[];
  policySubjectId: string;
  provenanceRequirements: AgentProvenanceRequirements;
  status: OmniAgentStatus;
}

export interface AgentProposal {
  id: string;
  definition: OmniAgentDefinition;
  justification: string;
  proposedBy: string;
  createdAt: string;
  decision?: {
    by: string;
    outcome: "approved" | "rejected";
    at: string;
    note?: string;
  };
}

export interface ApproverRef {
  id: string;
  kind: "person" | "agent";
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

/** Package action ids the Omni execution layer knows how to perform. */
export const OMNI_PACKAGE_ACTIONS = [
  "agents.propose",
  "community.create",
  "findings.organize",
  "share.createDraft",
  "community.launchChecklist",
  "cosmos.addNodes",
] as const;

function freezeDefinition(
  definition: OmniAgentDefinition,
  status: OmniAgentStatus,
): OmniAgentDefinition {
  const copy: OmniAgentDefinition = {
    ...definition,
    ringScope: [...definition.ringScope],
    toolAllowlist: [...definition.toolAllowlist],
    actionAllowlist: [...definition.actionAllowlist],
    skillIds: [...(definition.skillIds ?? [])],
    domainScope: [...definition.domainScope],
    provenanceRequirements: { ...definition.provenanceRequirements },
    status,
  };
  Object.freeze(copy.ringScope);
  Object.freeze(copy.toolAllowlist);
  Object.freeze(copy.actionAllowlist);
  Object.freeze(copy.skillIds);
  Object.freeze(copy.domainScope);
  Object.freeze(copy.provenanceRequirements);
  return Object.freeze(copy);
}

export class AgentRegistry {
  readonly #knownToolIds: ReadonlySet<string>;
  readonly #knownActionIds: ReadonlySet<string>;
  readonly #skillLibrary: SkillLibrary;
  readonly #agents = new Map<string, OmniAgentDefinition>();
  readonly #seededIds = new Set<string>();
  readonly #proposals = new Map<string, AgentProposal>();
  #proposalCounter = 0;

  constructor(opts: {
    knownToolIds: Iterable<string>;
    knownActionIds?: Iterable<string>;
    /**
     * Library skillIds are validated against. Defaults to a fresh
     * seed library (skills.ts) so existing hosts need no change.
     */
    skillLibrary?: SkillLibrary;
  }) {
    this.#knownToolIds = new Set(opts.knownToolIds);
    this.#knownActionIds = new Set(opts.knownActionIds ?? OMNI_PACKAGE_ACTIONS);
    this.#skillLibrary = opts.skillLibrary ?? createSeedSkillLibrary();
  }

  /** The skill library definitions in this registry resolve against. */
  get skillLibrary(): SkillLibrary {
    return this.#skillLibrary;
  }

  #validate(definition: OmniAgentDefinition): void {
    if (typeof definition.id !== "string" || definition.id.trim() === "") {
      throw new RegistryError("agent definition requires a non-empty id");
    }
    if (typeof definition.name !== "string" || definition.name.trim() === "") {
      throw new RegistryError(
        `agent '${definition.id}': definition requires a non-empty name`,
      );
    }
    if (
      typeof definition.policySubjectId !== "string" ||
      definition.policySubjectId.trim() === ""
    ) {
      throw new RegistryError(
        `agent '${definition.id}': definition requires a policySubjectId`,
      );
    }
    if (definition.ringScope.length === 0) {
      throw new RegistryError(
        `agent '${definition.id}': ringScope must not be empty`,
      );
    }
    if (definition.domainScope.length === 0) {
      throw new RegistryError(
        `agent '${definition.id}': domainScope must not be empty`,
      );
    }
    for (const domain of definition.domainScope) {
      if (!(DATA_DOMAINS as readonly string[]).includes(domain)) {
        throw new RegistryError(
          `agent '${definition.id}': unknown policy domain '${domain}'`,
        );
      }
    }
    for (const toolId of definition.toolAllowlist) {
      if (!this.#knownToolIds.has(toolId)) {
        throw new RegistryError(
          `agent '${definition.id}': unknown tool id '${toolId}' ` +
            `(not in the host-supplied known tool set)`,
        );
      }
    }
    for (const actionId of definition.actionAllowlist) {
      if (!this.#knownActionIds.has(actionId)) {
        throw new RegistryError(
          `agent '${definition.id}': unknown action id '${actionId}'`,
        );
      }
    }
    for (const skillId of definition.skillIds ?? []) {
      if (!this.#skillLibrary.has(skillId)) {
        throw new RegistryError(
          `agent '${definition.id}': unknown skill id '${skillId}' ` +
            `(not in the registry's skill library)`,
        );
      }
    }
  }

  #assertNotDuplicate(id: string): void {
    if (this.#agents.has(id)) {
      throw new RegistryError(
        `agent '${id}' is already registered (duplicate agent id)`,
      );
    }
    for (const proposal of this.#proposals.values()) {
      if (
        proposal.definition.id === id &&
        proposal.decision?.outcome !== "rejected"
      ) {
        throw new RegistryError(
          `agent '${id}' is already proposed (duplicate agent id, ` +
            `proposal '${proposal.id}')`,
        );
      }
    }
  }

  /**
   * Register a proposal. The definition's status is normalized to
   * "proposed" in the stored copy — a proposal can never smuggle in
   * an "active" status.
   */
  propose(
    definition: OmniAgentDefinition,
    justification: string,
    proposedBy: string,
    now?: Date,
  ): AgentProposal {
    this.#validate(definition);
    this.#assertNotDuplicate(definition.id);
    if (typeof justification !== "string" || justification.trim() === "") {
      throw new RegistryError(
        `agent '${definition.id}': a proposal requires a justification`,
      );
    }
    if (typeof proposedBy !== "string" || proposedBy.trim() === "") {
      throw new RegistryError(
        `agent '${definition.id}': a proposal requires proposedBy`,
      );
    }
    const createdAt = (now ?? new Date()).toISOString();
    this.#proposalCounter += 1;
    const proposal: AgentProposal = {
      id: `proposal:${definition.id}:${this.#proposalCounter}`,
      definition: freezeDefinition(definition, "proposed"),
      justification,
      proposedBy,
      createdAt,
    };
    this.#proposals.set(proposal.id, proposal);
    return proposal;
  }

  #decide(
    proposalId: string,
    approver: ApproverRef,
    outcome: "approved" | "rejected",
    note: string | undefined,
    now?: Date,
  ): AgentProposal {
    if (approver.kind === "agent") {
      throw new RegistryError(
        `agent '${approver.id}' cannot ${outcome === "approved" ? "approve" : "reject"} ` +
          `agents: no agent approves agents — a person must decide`,
      );
    }
    const proposal = this.#proposals.get(proposalId);
    if (proposal === undefined) {
      throw new RegistryError(`unknown proposal '${proposalId}'`);
    }
    if (proposal.decision !== undefined) {
      throw new RegistryError(
        `proposal '${proposalId}' is already decided ` +
          `(${proposal.decision.outcome} by ${proposal.decision.by})`,
      );
    }
    proposal.decision = {
      by: approver.id,
      outcome,
      at: (now ?? new Date()).toISOString(),
      ...(note !== undefined ? { note } : {}),
    };
    return proposal;
  }

  /** Approve a proposal: the agent enters the registry as "active". */
  approve(
    proposalId: string,
    approver: ApproverRef,
    now?: Date,
  ): OmniAgentDefinition {
    const proposal = this.#decide(proposalId, approver, "approved", undefined, now);
    if (this.#agents.has(proposal.definition.id)) {
      throw new RegistryError(
        `agent '${proposal.definition.id}' is already registered (duplicate agent id)`,
      );
    }
    const active = freezeDefinition(proposal.definition, "active");
    this.#agents.set(active.id, active);
    return active;
  }

  /** Reject a proposal: it is decided and the agent never activates. */
  reject(
    proposalId: string,
    approver: ApproverRef,
    note?: string,
    now?: Date,
  ): AgentProposal {
    return this.#decide(proposalId, approver, "rejected", note, now);
  }

  /**
   * Founder-seeding ONLY: register an already-active definition.
   * This is how the host seeds the canonical fabric
   * (fabricToOmniDefinition over AGENT_FABRIC) at startup. It is not
   * a creation path for new agents — those require propose → approve.
   * Seeded ids are remembered (`isFounderSeeded`) because the fabric
   * definitions carry `actionAllowlist: []` by design: a seeded
   * fabric agent's authority to perform a package action derives from
   * the human-approved plan, not from an allowlist (see execution.ts).
   */
  registerActive(definition: OmniAgentDefinition): OmniAgentDefinition {
    this.#validate(definition);
    this.#assertNotDuplicate(definition.id);
    const active = freezeDefinition(definition, "active");
    this.#agents.set(active.id, active);
    this.#seededIds.add(active.id);
    return active;
  }

  retire(agentId: string): void {
    const existing = this.#agents.get(agentId);
    if (existing === undefined) {
      throw new RegistryError(`cannot retire unknown agent '${agentId}'`);
    }
    this.#agents.set(agentId, freezeDefinition(existing, "retired"));
  }

  getAgent(id: string): OmniAgentDefinition | undefined {
    return this.#agents.get(id);
  }

  listAgents(): readonly OmniAgentDefinition[] {
    return [...this.#agents.values()];
  }

  listProposals(): readonly AgentProposal[] {
    return [...this.#proposals.values()];
  }

  /** True when the agent entered via founder-seeding (registerActive). */
  isFounderSeeded(agentId: string): boolean {
    return this.#seededIds.has(agentId);
  }

  /**
   * The activation gate: returns the definition only when the agent
   * exists with status "active". Proposed, rejected, retired, and
   * unknown agents all throw — activation without approval fails
   * loudly, never silently.
   */
  assertActive(agentId: string): OmniAgentDefinition {
    const agent = this.#agents.get(agentId);
    if (agent === undefined) {
      throw new RegistryError(
        `agent '${agentId}' is not active: it is not registered ` +
          `(never proposed and approved, or never founder-seeded)`,
      );
    }
    if (agent.status !== "active") {
      throw new RegistryError(
        `agent '${agentId}' is not active: its status is '${agent.status}'`,
      );
    }
    return agent;
  }
}

// ---------------------------------------------------------------------------
// Fabric → Omni mapping
// ---------------------------------------------------------------------------

const ALL_DOMAINS: readonly DataDomain[] = DATA_DOMAINS;

/**
 * Principled domain scope per fabric agent — only the domains that
 * agent legitimately touches in its fabric purpose:
 * - guardian evaluates everything, so it scopes all 10 domains;
 * - everyone else scopes exactly the domains its purpose reads/writes.
 */
/**
 * Seed skills per fabric agent (Phase 4 skills system). Skills bundle
 * GATEWAY tools, so only fabric agents whose work is gateway-tool
 * work hold them:
 * - oracle: grounded research + graph grounding for its answers.
 * - steward: community-launch — the demo's launch steps are its
 *   package ACTIONS (community.create / launchChecklist), which the
 *   skill guard leaves allowlist-governed; the skill names the graph
 *   reads its launch preparation draws on.
 * - connector: graph-analysis — it prepares graph tool calls for
 *   human approval.
 * - memory-curator: archive-curation — inventory/organization work.
 * - studio: findings-writing — drafting from gathered evidence.
 * - guardian / avatar / legacy-mirror: [] — their capabilities are
 *   in-package local logic (consent checks, profile projection,
 *   archive Q&A), not gateway tools; a gateway skill would misstate
 *   what they do, and the guard requires allowlist ∩ coverage, so an
 *   unheld skill can never silently widen them.
 */
export const FABRIC_SKILL_IDS: Readonly<Record<string, readonly string[]>> = {
  oracle: ["evidence-research", "graph-analysis"],
  guardian: [],
  "memory-curator": ["archive-curation"],
  avatar: [],
  "legacy-mirror": [],
  studio: ["findings-writing"],
  connector: ["graph-analysis"],
  steward: ["community-launch"],
};

const FABRIC_DOMAIN_SCOPE: Readonly<Record<string, readonly DataDomain[]>> = {
  oracle: ["social", "intellectual-property", "public-released"],
  guardian: ALL_DOMAINS,
  "memory-curator": ["family-heritage", "legacy", "social"],
  avatar: ["identity", "public-released"],
  "legacy-mirror": ["legacy", "family-heritage"],
  studio: ["intellectual-property", "social", "public-released"],
  connector: ["social", "ai-agents"],
  steward: ["financial", "social"],
};

/**
 * Map a canonical fabric entry to an Omni definition (status
 * "active", for founder-seeding via registerActive).
 *
 * - role: the short form of the fabric purpose (its first clause),
 *   falling back to the fabric name.
 * - policySubjectId: `agent:<fabric id>`.
 * - actionAllowlist: [] — fabric definitions name no package actions;
 *   a seeded fabric agent's package-action authority comes from the
 *   human-approved plan (see AgentRegistry.registerActive).
 * - toolAllowlist: the fabric's list as-is. Those entries name
 *   in-package capabilities (e.g. "consent-core.canAccess"), not
 *   gateway tool ids — so the HOST seeding the registry must include
 *   those capability ids in the registry's knownToolIds set, or
 *   seeding validation will (correctly, loudly) refuse them.
 */
export function fabricToOmniDefinition(
  f: AgentFabricDefinition,
): OmniAgentDefinition {
  const shortPurpose = f.purpose.split(",")[0]?.trim() ?? "";
  return {
    id: f.id,
    name: f.name,
    role: shortPurpose !== "" ? shortPurpose : f.name,
    ringScope: [...f.ringScope],
    toolAllowlist: [...f.toolAllowlist],
    actionAllowlist: [],
    skillIds: [...(FABRIC_SKILL_IDS[f.id] ?? [])],
    domainScope: [...(FABRIC_DOMAIN_SCOPE[f.id] ?? ["public-released"])],
    policySubjectId: `agent:${f.id}`,
    provenanceRequirements: { ...f.provenanceRequirements },
    status: "active",
  };
}
