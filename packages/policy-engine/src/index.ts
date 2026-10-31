/**
 * @omega/policy-engine
 *
 * Generalized access-policy engine for the Omega Platform
 * (Phase 3C, directive §9): subjects (people and agents), groups,
 * data domains, purpose-limited grants and task passes, explicit
 * denials that win over grants, access requests, legacy directives
 * with a never-public guard, and an append-only audit log.
 *
 * This package COMPOSES @omega/consent-core rather than forking it:
 * revocation purges cached context through consent-core's
 * ContextCache and records the purge through its SyncEventLog /
 * createSyncEvent primitives. Consent-core's ring-exact receipt API
 * is unchanged and remains the load-bearing primitive underneath.
 *
 * Evaluation is deny-by-default and runs in a fixed order
 * (see README.md): unknown subject/resource → explicit denial
 * (deny wins) → legacy never-public guard for public-scoped grants
 * → first matching active, purpose-compatible grant → deny.
 *
 * Creator: David Charles Bourassa
 */

import {
  createSyncEvent,
  type ContextCache,
  type ContextCacheEntry,
  type SyncEventLog,
} from "@omega/consent-core";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type DataDomain =
  | "identity"
  | "family-heritage"
  | "social"
  | "healthcare"
  | "employment"
  | "financial"
  | "intellectual-property"
  | "ai-agents"
  | "legacy"
  | "public-released";

export const DATA_DOMAINS: readonly DataDomain[] = [
  "identity",
  "family-heritage",
  "social",
  "healthcare",
  "employment",
  "financial",
  "intellectual-property",
  "ai-agents",
  "legacy",
  "public-released",
] as const;

export type PolicyAction =
  | "view"
  | "create"
  | "edit"
  | "comment"
  | "contribute"
  | "export"
  | "share"
  | "admin";

export const POLICY_ACTIONS: readonly PolicyAction[] = [
  "view",
  "create",
  "edit",
  "comment",
  "contribute",
  "export",
  "share",
  "admin",
] as const;

export type GroupType =
  | "family"
  | "friends"
  | "work"
  | "public"
  | "healthcare-providers"
  | "employers"
  | "research-collaborators"
  | "public-followers"
  | "trusted-agents"
  | "legacy-stewards";

export const GROUP_TYPES: readonly GroupType[] = [
  "family",
  "friends",
  "work",
  "public",
  "healthcare-providers",
  "employers",
  "research-collaborators",
  "public-followers",
  "trusted-agents",
  "legacy-stewards",
] as const;

export type SubjectKind = "person" | "agent";

export interface PolicySubject {
  id: string;
  kind: SubjectKind;
  displayName: string;
}

export type SensitivityLevel = "public" | "internal" | "sensitive" | "restricted";

export interface PolicyResource {
  id: string;
  ownerId: string;
  domain: DataDomain;
  title: string;
  summary: string;
  sensitivity: SensitivityLevel;
}

export interface RelationshipGroup {
  id: string;
  type: GroupType;
  name: string;
  memberIds: readonly string[];
}

/**
 * A grant (standing permission) or a pass (task-bound, expiring
 * permission). Exactly one of `granteeSubjectId` / `granteeGroupId`
 * must be set, and at least one of `resourceId` / `domain`.
 * `taskCompletedAt` is set on passes by `completeTask`; a completed
 * pass is expired (see {@link grantStatusAt}).
 */
export interface AccessGrant {
  id: string;
  kind: "grant" | "pass";
  granteeSubjectId?: string;
  granteeGroupId?: string;
  resourceId?: string;
  domain?: DataDomain;
  actions: readonly PolicyAction[];
  purpose: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  taskId?: string;
  taskCompletedAt?: string | null;
  revokedAt: string | null;
}

export type GrantStatus = "active" | "expired" | "revoked";

/**
 * Status of a grant at `now`:
 * - "revoked" when `revokedAt` is non-null (revocation wins over expiry);
 * - "expired" when the pass task is completed (`taskCompletedAt`
 *   non-null) or `expiresAt` is present and `<= now` (an unparseable
 *   `expiresAt` is treated as expired, mirroring consent-core's
 *   treatment of unparseable receipt expiries);
 * - otherwise "active".
 */
export function grantStatusAt(grant: AccessGrant, now: Date): GrantStatus {
  if (grant.revokedAt !== null) {
    return "revoked";
  }
  if (grant.taskCompletedAt !== undefined && grant.taskCompletedAt !== null) {
    return "expired";
  }
  if (grant.expiresAt !== undefined) {
    const expiresAtMs = Date.parse(grant.expiresAt);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
      return "expired";
    }
  }
  return "active";
}

/**
 * An explicit denial. Deny wins over any grant. When `actions` is
 * absent the denial covers every action. Scope is resource-or-domain:
 * each present scope field must match.
 */
export interface AccessDenial {
  id: string;
  subjectId: string;
  resourceId?: string;
  domain?: DataDomain;
  actions?: readonly PolicyAction[];
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  subjectId: string;
  resourceId?: string;
  domain?: DataDomain;
  actions: readonly PolicyAction[];
  purpose: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied";
}

/**
 * A member's legacy directive: what may be summarized in life and
 * after death, which domains must never become public, who stewards
 * the legacy, which continuity projects are authorized (and under
 * what attribution rule), and the simulation-disclosure text that
 * must accompany any Mirror-style output.
 */
export interface LegacyDirective {
  memberId: string;
  lifetimeSummary: string;
  postDeathSummary: string;
  neverPublic: readonly DataDomain[];
  stewards: readonly string[];
  memorialization: {
    state: "not-started" | "pending" | "verified";
    verifiedAt?: string;
  };
  continuityAuthorizations: readonly {
    projectId: string;
    projectTitle: string;
    stewardId: string;
    scope: string;
    attributionRule: string;
  }[];
  simulationDisclosure: string;
}

export interface PolicyState {
  subjects: PolicySubject[];
  groups: RelationshipGroup[];
  resources: PolicyResource[];
  grants: AccessGrant[];
  denials: AccessDenial[];
  requests: AccessRequest[];
  legacyDirectives: LegacyDirective[];
}

export interface EvaluationRequest {
  subjectId: string;
  resourceId: string;
  action: PolicyAction;
  purpose?: string;
  context?: unknown;
  now?: Date;
  dryRun?: boolean;
}

export interface PolicyDecision {
  decision: "allow" | "deny";
  reason: string;
  matchedGrantId?: string;
  matchedDenialId?: string;
  subjectId: string;
  resourceId: string;
  action: PolicyAction;
  evaluatedAt: string;
}

export interface PolicyAuditEvent {
  id: string;
  at: string;
  kind:
    | "evaluation"
    | "grant-created"
    | "grant-revoked"
    | "denial-created"
    | "request-created"
    | "request-decided"
    | "emergency"
    | "context-purge"
    | "pass-completed";
  subjectId?: string;
  resourceId?: string;
  action?: PolicyAction;
  decision?: "allow" | "deny";
  reason: string;
  detail?: string;
}

export interface ResourceAccessPreview {
  resource: PolicyResource;
  actions: Record<PolicyAction, PolicyDecision>;
}

/** The one purpose no ordinary grant can satisfy: model training. */
export const TRAINING_PURPOSE = "model-training";

export interface PolicyEngineOptions {
  syncLog?: SyncEventLog;
  contextCaches?: readonly ContextCache[];
}

// ---------------------------------------------------------------------------
// Cloning — the engine owns mutable copies; callers can never mutate
// engine state (or be mutated by it) through a shared reference.
// ---------------------------------------------------------------------------

function cloneSubject(subject: PolicySubject): PolicySubject {
  return { ...subject };
}

function cloneGroup(group: RelationshipGroup): RelationshipGroup {
  return { ...group, memberIds: [...group.memberIds] };
}

function cloneResource(resource: PolicyResource): PolicyResource {
  return { ...resource };
}

function cloneGrant(grant: AccessGrant): AccessGrant {
  return { ...grant, actions: [...grant.actions] };
}

function cloneDenial(denial: AccessDenial): AccessDenial {
  const copy: AccessDenial = { ...denial };
  if (denial.actions !== undefined) {
    copy.actions = [...denial.actions];
  }
  return copy;
}

function cloneRequest(request: AccessRequest): AccessRequest {
  return { ...request, actions: [...request.actions] };
}

function cloneDirective(directive: LegacyDirective): LegacyDirective {
  return {
    ...directive,
    neverPublic: [...directive.neverPublic],
    stewards: [...directive.stewards],
    memorialization: { ...directive.memorialization },
    continuityAuthorizations: directive.continuityAuthorizations.map(
      (authorization) => ({ ...authorization }),
    ),
  };
}

function cloneState(state: PolicyState): PolicyState {
  return {
    subjects: state.subjects.map(cloneSubject),
    groups: state.groups.map(cloneGroup),
    resources: state.resources.map(cloneResource),
    grants: state.grants.map(cloneGrant),
    denials: state.denials.map(cloneDenial),
    requests: state.requests.map(cloneRequest),
    legacyDirectives: state.legacyDirectives.map(cloneDirective),
  };
}

// ---------------------------------------------------------------------------
// PolicyEngine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  #state: PolicyState;
  #audit: PolicyAuditEvent[] = [];
  #auditCounter = 0;
  #syncLog: SyncEventLog | undefined;
  #contextCaches: readonly ContextCache[];

  constructor(state: PolicyState, options?: PolicyEngineOptions) {
    this.#state = cloneState(state);
    this.#syncLog = options?.syncLog;
    this.#contextCaches =
      options?.contextCaches !== undefined ? [...options.contextCaches] : [];
  }

  // -- evaluation -----------------------------------------------------------

  /**
   * Evaluate one access attempt. Semantics, IN THIS ORDER:
   * 1. Unknown resource or subject → deny.
   * 2. Explicit denial match → deny. Deny wins over any grant.
   * 3. Legacy never-public guard: when the resource's domain is in
   *    the owner's verified legacy directive's `neverPublic` list,
   *    a matching grant that is public-group-scoped cannot allow.
   *    (If another, non-public matching grant exists it still
   *    allows — the guard only closes the public path.)
   * 4. First matching active, purpose-compatible grant → allow.
   * 5. Deny-by-default.
   *
   * Every non-dryRun evaluation appends an "evaluation" audit
   * event; a dryRun evaluation appends nothing.
   */
  evaluate(req: EvaluationRequest): PolicyDecision {
    const now = req.now ?? new Date();
    const decision = this.#decide(req, now);
    if (req.dryRun !== true) {
      this.#appendAudit({
        at: decision.evaluatedAt,
        kind: "evaluation",
        subjectId: req.subjectId,
        resourceId: req.resourceId,
        action: req.action,
        decision: decision.decision,
        reason: decision.reason,
        ...(decision.matchedGrantId !== undefined
          ? { detail: `grant:${decision.matchedGrantId}` }
          : decision.matchedDenialId !== undefined
            ? { detail: `denial:${decision.matchedDenialId}` }
            : {}),
      });
    }
    return decision;
  }

  #decide(req: EvaluationRequest, now: Date): PolicyDecision {
    const evaluatedAt = now.toISOString();
    const base = {
      subjectId: req.subjectId,
      resourceId: req.resourceId,
      action: req.action,
      evaluatedAt,
    };

    // (1) Unknown subject or resource → deny.
    const subject = this.#state.subjects.find((s) => s.id === req.subjectId);
    const resource = this.#state.resources.find((r) => r.id === req.resourceId);
    if (subject === undefined || resource === undefined) {
      return {
        ...base,
        decision: "deny",
        reason:
          subject === undefined
            ? `Unknown subject "${req.subjectId}": deny-by-default.`
            : `Unknown resource "${req.resourceId}": deny-by-default.`,
      };
    }

    // (2) Explicit denial match → deny. Deny wins over any grant.
    for (const denial of this.#state.denials) {
      if (denial.subjectId !== req.subjectId) {
        continue;
      }
      if (denial.resourceId !== undefined && denial.resourceId !== resource.id) {
        continue;
      }
      if (denial.domain !== undefined && denial.domain !== resource.domain) {
        continue;
      }
      if (denial.actions !== undefined && !denial.actions.includes(req.action)) {
        continue;
      }
      return {
        ...base,
        decision: "deny",
        reason: `Denied by explicit denial "${denial.id}": ${denial.reason}`,
        matchedDenialId: denial.id,
      };
    }

    // (4, matching) Collect grants that match grantee, scope,
    // action, active status, and the purpose rule.
    const matching: AccessGrant[] = [];
    for (const grant of this.#state.grants) {
      if (!this.#granteeMatches(grant, req.subjectId)) {
        continue;
      }
      const scopeMatches =
        (grant.resourceId !== undefined && grant.resourceId === resource.id) ||
        (grant.domain !== undefined && grant.domain === resource.domain);
      if (!scopeMatches) {
        continue;
      }
      if (!grant.actions.includes(req.action)) {
        continue;
      }
      if (grantStatusAt(grant, now) !== "active") {
        continue;
      }
      // Purpose rule: a stated purpose must equal the grant's
      // purpose exactly. In particular, a request with purpose
      // TRAINING_PURPOSE matches only a grant whose purpose is
      // exactly TRAINING_PURPOSE — ordinary grants never authorize
      // model training. A request stating no purpose is matched on
      // scope/action/status alone.
      if (req.purpose !== undefined && req.purpose !== grant.purpose) {
        continue;
      }
      matching.push(grant);
    }

    // (3) Legacy never-public guard, applied to the matching set:
    // a public-group-scoped grant cannot be the path into a domain
    // the owner directed never-public under a verified directive.
    if (matching.length > 0) {
      const firstOrdinary = matching.find((grant) => !this.#isPublicScoped(grant));
      if (firstOrdinary !== undefined) {
        return {
          ...base,
          decision: "allow",
          reason: `Allowed by grant "${firstOrdinary.id}" (purpose "${firstOrdinary.purpose}").`,
          matchedGrantId: firstOrdinary.id,
        };
      }
      const first = matching[0];
      if (first !== undefined) {
        if (this.#isNeverPublicBlocked(resource)) {
          return {
            ...base,
            decision: "deny",
            reason:
              `Denied by the owner's legacy directive: domain "${resource.domain}" ` +
              `is never-public under a verified directive, and the only matching ` +
              `grant ("${first.id}") is public-scoped.`,
          };
        }
        return {
          ...base,
          decision: "allow",
          reason: `Allowed by grant "${first.id}" (purpose "${first.purpose}").`,
          matchedGrantId: first.id,
        };
      }
    }

    // (5) Deny-by-default.
    return {
      ...base,
      decision: "deny",
      reason: "Denied by default: no matching active grant.",
    };
  }

  #granteeMatches(grant: AccessGrant, subjectId: string): boolean {
    if (grant.granteeSubjectId !== undefined) {
      return grant.granteeSubjectId === subjectId;
    }
    if (grant.granteeGroupId !== undefined) {
      const group = this.#state.groups.find((g) => g.id === grant.granteeGroupId);
      return group !== undefined && group.memberIds.includes(subjectId);
    }
    return false;
  }

  #isPublicScoped(grant: AccessGrant): boolean {
    if (grant.granteeGroupId === undefined) {
      return false;
    }
    const group = this.#state.groups.find((g) => g.id === grant.granteeGroupId);
    return group !== undefined && group.type === "public";
  }

  #isNeverPublicBlocked(resource: PolicyResource): boolean {
    const directive = this.#state.legacyDirectives.find(
      (d) => d.memberId === resource.ownerId,
    );
    return (
      directive !== undefined &&
      directive.memorialization.state === "verified" &&
      directive.neverPublic.includes(resource.domain)
    );
  }

  // -- grants ---------------------------------------------------------------

  /**
   * Register a grant. Throws when:
   * - `grantedBy` is an unknown subject, or resolves to a subject
   *   with kind "agent" (agents can never source grants — no
   *   self-escalation);
   * - `grantedBy === granteeSubjectId` (no self-grant);
   * - the scope is malformed: not exactly one of
   *   granteeSubjectId/granteeGroupId, neither resourceId nor
   *   domain, an unknown grantee/resource, an unknown domain or
   *   action, an empty purpose, no actions, or a duplicate id.
   * Appends a "grant-created" audit event.
   */
  createGrant(grant: AccessGrant): AccessGrant {
    const granter = this.#state.subjects.find((s) => s.id === grant.grantedBy);
    if (granter === undefined) {
      throw new Error(`createGrant: unknown grantedBy subject "${grant.grantedBy}".`);
    }
    if (granter.kind === "agent") {
      throw new Error(
        `createGrant: agent "${grant.grantedBy}" cannot source grants (no self-escalation).`,
      );
    }
    if (grant.granteeSubjectId !== undefined && grant.grantedBy === grant.granteeSubjectId) {
      throw new Error("createGrant: a subject cannot grant to itself (no self-grant).");
    }
    const hasSubjectGrantee = grant.granteeSubjectId !== undefined;
    const hasGroupGrantee = grant.granteeGroupId !== undefined;
    if (hasSubjectGrantee === hasGroupGrantee) {
      throw new Error(
        "createGrant: exactly one of granteeSubjectId / granteeGroupId must be set.",
      );
    }
    if (grant.resourceId === undefined && grant.domain === undefined) {
      throw new Error("createGrant: at least one of resourceId / domain must be set.");
    }
    if (
      hasSubjectGrantee &&
      !this.#state.subjects.some((s) => s.id === grant.granteeSubjectId)
    ) {
      throw new Error(`createGrant: unknown grantee subject "${grant.granteeSubjectId}".`);
    }
    if (
      hasGroupGrantee &&
      !this.#state.groups.some((g) => g.id === grant.granteeGroupId)
    ) {
      throw new Error(`createGrant: unknown grantee group "${grant.granteeGroupId}".`);
    }
    if (
      grant.resourceId !== undefined &&
      !this.#state.resources.some((r) => r.id === grant.resourceId)
    ) {
      throw new Error(`createGrant: unknown resource "${grant.resourceId}".`);
    }
    if (grant.domain !== undefined && !DATA_DOMAINS.includes(grant.domain)) {
      throw new Error(`createGrant: unknown domain "${grant.domain}".`);
    }
    if (grant.actions.length === 0) {
      throw new Error("createGrant: a grant must list at least one action.");
    }
    for (const action of grant.actions) {
      if (!POLICY_ACTIONS.includes(action)) {
        throw new Error(`createGrant: unknown action "${action}".`);
      }
    }
    if (grant.purpose.length === 0) {
      throw new Error("createGrant: a grant must state a purpose.");
    }
    if (this.#state.grants.some((g) => g.id === grant.id)) {
      throw new Error(`createGrant: grant "${grant.id}" already exists.`);
    }

    const stored = cloneGrant(grant);
    this.#state.grants.push(stored);
    this.#appendAudit({
      at: stored.grantedAt,
      kind: "grant-created",
      ...(stored.granteeSubjectId !== undefined
        ? { subjectId: stored.granteeSubjectId }
        : {}),
      ...(stored.resourceId !== undefined ? { resourceId: stored.resourceId } : {}),
      reason: `Grant "${stored.id}" created by "${stored.grantedBy}" for purpose "${stored.purpose}".`,
      ...(stored.granteeGroupId !== undefined
        ? { detail: `group:${stored.granteeGroupId}` }
        : {}),
    });
    return cloneGrant(stored);
  }

  /**
   * Revoke a grant: sets `revokedAt` and appends a "grant-revoked"
   * audit event, THEN runs the consent-core purge hook — for the
   * grantee subject (for a group grant, for each member subject),
   * every provided ContextCache is purged of entries whose
   * subjectId matches; if any purged entry had scope "ai", exactly
   * one `ai.context.purge` sync event is appended to the sync log
   * (via consent-core's createSyncEvent, versioned from the log's
   * own count for that subject) and a "context-purge" audit event
   * is appended. Revoking an already-revoked grant is a no-op that
   * returns the grant unchanged. Returns undefined for unknown ids.
   */
  revokeGrant(grantId: string, now?: Date): AccessGrant | undefined {
    const grant = this.#state.grants.find((g) => g.id === grantId);
    if (grant === undefined) {
      return undefined;
    }
    if (grant.revokedAt !== null) {
      return cloneGrant(grant);
    }
    const nowIso = (now ?? new Date()).toISOString();
    grant.revokedAt = nowIso;
    this.#appendAudit({
      at: nowIso,
      kind: "grant-revoked",
      ...(grant.granteeSubjectId !== undefined
        ? { subjectId: grant.granteeSubjectId }
        : {}),
      ...(grant.resourceId !== undefined ? { resourceId: grant.resourceId } : {}),
      reason: `Grant "${grant.id}" revoked.`,
      ...(grant.granteeGroupId !== undefined
        ? { detail: `group:${grant.granteeGroupId}` }
        : {}),
    });

    // Consent-core purge hook.
    for (const subjectId of this.#granteeSubjectIds(grant)) {
      const purged: ContextCacheEntry[] = [];
      for (const cache of this.#contextCaches) {
        purged.push(...cache.purgeWhere((e) => e.subjectId === subjectId));
      }
      const firstAi = purged.find((entry) => entry.scope === "ai");
      if (firstAi !== undefined) {
        if (this.#syncLog !== undefined) {
          this.#syncLog.append(
            createSyncEvent({
              type: "ai.context.purge",
              subjectId,
              ring: firstAi.ring,
              localVersion: this.#syncLog.countForSubject(subjectId) + 1,
              conflictPolicy: "local_wins",
              createdAt: nowIso,
            }),
          );
        }
        this.#appendAudit({
          at: nowIso,
          kind: "context-purge",
          subjectId,
          reason:
            `Revoking grant "${grant.id}" purged cached context for subject ` +
            `"${subjectId}", including AI context; an ai.context.purge sync ` +
            `event was recorded.`,
          detail: `purged:${purged.length}`,
        });
      }
    }

    return cloneGrant(grant);
  }

  #granteeSubjectIds(grant: AccessGrant): string[] {
    if (grant.granteeSubjectId !== undefined) {
      return [grant.granteeSubjectId];
    }
    if (grant.granteeGroupId !== undefined) {
      const group = this.#state.groups.find((g) => g.id === grant.granteeGroupId);
      return group !== undefined ? [...group.memberIds] : [];
    }
    return [];
  }

  /**
   * Complete a task: every uncompleted pass carrying `taskId` gets
   * `taskCompletedAt` set (a completed pass is expired — see
   * {@link grantStatusAt}) and a "pass-completed" audit event is
   * appended per pass. Returns the passes this call completed.
   */
  completeTask(taskId: string, now?: Date): AccessGrant[] {
    const nowIso = (now ?? new Date()).toISOString();
    const completed: AccessGrant[] = [];
    for (const grant of this.#state.grants) {
      if (grant.kind !== "pass" || grant.taskId !== taskId) {
        continue;
      }
      if (grant.taskCompletedAt !== undefined && grant.taskCompletedAt !== null) {
        continue;
      }
      grant.taskCompletedAt = nowIso;
      completed.push(cloneGrant(grant));
      this.#appendAudit({
        at: nowIso,
        kind: "pass-completed",
        ...(grant.granteeSubjectId !== undefined
          ? { subjectId: grant.granteeSubjectId }
          : {}),
        ...(grant.resourceId !== undefined ? { resourceId: grant.resourceId } : {}),
        reason: `Pass "${grant.id}" completed with task "${taskId}"; the pass is now expired.`,
      });
    }
    return completed;
  }

  // -- denials & requests -----------------------------------------------------

  /** Register an explicit denial. Appends a "denial-created" audit event. */
  createDenial(denial: AccessDenial): AccessDenial {
    const stored = cloneDenial(denial);
    this.#state.denials.push(stored);
    this.#appendAudit({
      at: stored.createdAt,
      kind: "denial-created",
      subjectId: stored.subjectId,
      ...(stored.resourceId !== undefined ? { resourceId: stored.resourceId } : {}),
      reason: `Denial "${stored.id}" created: ${stored.reason}`,
    });
    return cloneDenial(stored);
  }

  /** Register an access request. Appends a "request-created" audit event. */
  createRequest(request: AccessRequest): AccessRequest {
    const stored = cloneRequest(request);
    this.#state.requests.push(stored);
    this.#appendAudit({
      at: stored.requestedAt,
      kind: "request-created",
      subjectId: stored.subjectId,
      ...(stored.resourceId !== undefined ? { resourceId: stored.resourceId } : {}),
      reason: `Access request "${stored.id}" created for purpose "${stored.purpose}".`,
    });
    return cloneRequest(stored);
  }

  /**
   * Decide a pending request. On approval, the corresponding grant
   * is created via {@link createGrant} with `grantedBy` as given
   * (the member/owner deciding the request) — so the agent-source
   * and self-grant guards apply, and a failed grant creation leaves
   * the request pending. Appends a "request-decided" audit event.
   * Returns the updated request, or undefined for an unknown id.
   * Deciding an already-decided request is a no-op.
   */
  decideRequest(
    id: string,
    approve: boolean,
    grantedBy: string,
    now?: Date,
  ): AccessRequest | undefined {
    const request = this.#state.requests.find((r) => r.id === id);
    if (request === undefined) {
      return undefined;
    }
    if (request.status !== "pending") {
      return cloneRequest(request);
    }
    const nowIso = (now ?? new Date()).toISOString();
    if (approve) {
      const grant: AccessGrant = {
        id: `g-from-${request.id}`,
        kind: "grant",
        granteeSubjectId: request.subjectId,
        ...(request.resourceId !== undefined
          ? { resourceId: request.resourceId }
          : {}),
        ...(request.domain !== undefined ? { domain: request.domain } : {}),
        actions: [...request.actions],
        purpose: request.purpose,
        grantedBy,
        grantedAt: nowIso,
        revokedAt: null,
      };
      this.createGrant(grant);
      request.status = "approved";
    } else {
      request.status = "denied";
    }
    this.#appendAudit({
      at: nowIso,
      kind: "request-decided",
      subjectId: request.subjectId,
      ...(request.resourceId !== undefined
        ? { resourceId: request.resourceId }
        : {}),
      decision: approve ? "allow" : "deny",
      reason: `Access request "${request.id}" ${approve ? "approved" : "denied"} by "${grantedBy}".`,
    });
    return cloneRequest(request);
  }

  // -- queries ----------------------------------------------------------------

  /** All grants whose status at `now` (default: now) equals `status`. */
  grantsByStatus(status: GrantStatus, now?: Date): AccessGrant[] {
    const at = now ?? new Date();
    return this.#state.grants
      .filter((grant) => grantStatusAt(grant, at) === status)
      .map(cloneGrant);
  }

  /** All requests still pending a decision. */
  pendingRequests(): AccessRequest[] {
    return this.#state.requests
      .filter((request) => request.status === "pending")
      .map(cloneRequest);
  }

  /** The append-only audit log (copies; mutating them changes nothing). */
  auditLog(): readonly PolicyAuditEvent[] {
    return this.#audit.map((event) => ({ ...event }));
  }

  /** A deep copy of the engine's current policy state. */
  snapshot(): PolicyState {
    return cloneState(this.#state);
  }

  /**
   * Preview: for every resource, the decision for every one of the
   * 8 policy actions for `subjectId`, computed with dryRun
   * evaluations — the audit log does not grow.
   */
  previewAccess(subjectId: string, now?: Date): ResourceAccessPreview[] {
    return this.#state.resources.map((resource) => {
      const actions = {} as Record<PolicyAction, PolicyDecision>;
      for (const action of POLICY_ACTIONS) {
        actions[action] = this.evaluate({
          subjectId,
          resourceId: resource.id,
          action,
          dryRun: true,
          ...(now !== undefined ? { now } : {}),
        });
      }
      return { resource: cloneResource(resource), actions };
    });
  }

  #appendAudit(event: Omit<PolicyAuditEvent, "id">): void {
    this.#audit.push({ ...event, id: `audit-${++this.#auditCounter}` });
  }
}

export { createDemoPolicyState, DEMO_MEMBER_ID, ELIAS_LEGACY_DIRECTIVE } from "./demo-fixture.js";
