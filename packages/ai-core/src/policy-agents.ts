/**
 * @omega/ai-core — Directive §6 policy agents (Phase 3C, Workstream 4b)
 *
 * Scoped capabilities layered over @omega/policy-engine, binding the
 * Universal Access directive §6 agents into this package WITHOUT
 * modifying the canonical AGENT_FABRIC definitions in agents.ts:
 *
 *   - Privacy Guardian → Consent Guardian family (fabric id "guardian").
 *   - Security Review and Relationship Intelligence are new scoped
 *     capabilities, NOT new canonical fabric agents — say exactly that:
 *     they are directive-§6 bindings layered on the canonical fabric,
 *     and the fabric itself is unchanged (still exactly 8 agents).
 *
 * HONESTY: every capability here is deterministic LOCAL logic, labeled
 * offline (mode: "offline"). Nothing calls a model, nothing calls the
 * network, and nothing fakes a live call. Each capability REPORTS or
 * PROPOSES only — none of them mutates the engine:
 *
 *   - Privacy Guardian reports policy conflicts; it never mutates.
 *   - Security Review audits the engine's audit log; it never mutates.
 *   - Relationship Intelligence PROPOSES configuration changes only
 *     (directive §6 + §13). Proposals are data — there is deliberately
 *     NO apply function in this module.
 *
 * Design choice (documented per the workstream brief): each capability
 * is a pure function over a PolicyEngine, reading only its read-only
 * surfaces — snapshot() and auditLog(). No capability calls evaluate()
 * (evaluation appends audit events; a reporting pass must not create
 * the history it reports on), and no capability touches any mutating
 * engine method.
 *
 * Creator: David Charles Bourassa
 */

import type { PolicyEngine } from "@omega/policy-engine";

import { agentInputHash } from "./agents.js";
import type { AgentFabricId } from "./agents.js";

// ---------------------------------------------------------------------------
// Capability definitions — pure serializable data, in the same spirit
// as AgentFabricDefinition (agents.ts). These are NOT fabric entries.
// ---------------------------------------------------------------------------

export type PolicyAgentCapabilityId =
  | "privacy-guardian"
  | "security-review"
  | "relationship-intelligence";

export interface PolicyAgentCapabilityDefinition {
  id: PolicyAgentCapabilityId;
  name: string;
  purpose: string;
  /** Directive §6 / §13 guardrail for this capability. */
  guardrail: string;
  /** What actually backs the capability today (honest, no live claims). */
  backing: string;
  /**
   * Canonical fabric agent this capability belongs to, when one exists.
   * Only the Privacy Guardian has one: it maps to fabric "guardian"
   * (the Consent Guardian family). Security Review and Relationship
   * Intelligence have no fabric entry — they are new scoped
   * capabilities, NOT new canonical fabric agents.
   */
  fabricAgentId?: AgentFabricId;
}

export const POLICY_AGENT_CAPABILITIES: readonly PolicyAgentCapabilityDefinition[] =
  [
    {
      id: "privacy-guardian",
      name: "Privacy Guardian",
      purpose:
        "Evaluates policy conflicts in the engine's current state: " +
        "grant/denial overlaps (deny-wins conflicts worth surfacing), " +
        "over-broad grants touching sensitive domains, and temporary " +
        "passes with no expiry and no task binding.",
      guardrail:
        "Reports only — never mutates policy, never grants or denies " +
        "access itself, and never escalates its own privileges.",
      backing:
        "Local deterministic logic over @omega/policy-engine " +
        "snapshot() (grants, denials, groups, resources). Offline.",
      fabricAgentId: "guardian",
    },
    {
      id: "security-review",
      name: "Security Review",
      purpose:
        "Audits the engine's audit log: allow/deny counts, denials " +
        "grouped by subject and by resource, repeat-denial subjects " +
        "flagged as potential permission probing, and emergency-kind " +
        "events listed for post-hoc review.",
      guardrail:
        "Read-only audit — never mutates the engine or its log, and " +
        "never treats a flag as a finding of intent (probing is a " +
        "pattern to review, not an accusation).",
      backing:
        "Local deterministic logic over @omega/policy-engine " +
        "auditLog(). Offline.",
    },
    {
      id: "relationship-intelligence",
      name: "Relationship Intelligence",
      purpose:
        "Proposes permission-configuration changes for a human to " +
        "decide: ungrouped subjects, expired-pass cleanup, pending " +
        "requests awaiting a decision, and sensitive resources where " +
        "a broad group grant exists with no explicit denial.",
      guardrail:
        "Proposes only — proposals are data, there is no apply path " +
        "in this module, and nothing is applied without approval " +
        "(directive §6 + §13).",
      backing:
        "Local deterministic logic over @omega/policy-engine " +
        "snapshot() (subjects, groups, grants, requests). Offline.",
    },
  ] as const;

export function getPolicyAgentCapability(
  id: PolicyAgentCapabilityId,
): PolicyAgentCapabilityDefinition | undefined {
  return POLICY_AGENT_CAPABILITIES.find((capability) => capability.id === id);
}

// ---------------------------------------------------------------------------
// Result + receipt — mirroring the fabric runtime's provenance pattern
// (agents.ts: AgentAuditReceipt). Every run emits a receipt with an id,
// an FNV-1a input fingerprint (non-cryptographic, same construction as
// the fabric), timestamps, and mode "offline".
// ---------------------------------------------------------------------------

export interface PolicyAgentReceipt {
  id: string;
  /** Fabric id for the Privacy Guardian; the capability id otherwise. */
  agentId: string;
  /** Alias of agentId, mirroring AgentAuditReceipt.agent. */
  agent: string;
  capability: PolicyAgentCapabilityId;
  decision: "allowed";
  startedAt: string;
  completedAt: string;
  timestamps: { startedAt: string; completedAt: string };
  inputHash: string;
  hashAlgorithm: "fnv1a-32 (non-cryptographic)";
  mode: "offline";
}

export interface PolicyAgentResult<Finding> {
  agentId: string;
  capability: PolicyAgentCapabilityId;
  at: string;
  mode: "offline";
  summary: string;
  findings: readonly Finding[];
  receipt: PolicyAgentReceipt;
}

export type PolicyAgentSeverity = "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Defensive structural reads over the engine's state.
//
// The engine contract fixes the top-level shapes (PolicyState fields,
// grant fields, audit-event fields); element records may carry more.
// These helpers read the contracted fields first and tolerate the
// common alias spellings for subject/group/resource references, so the
// logic keys off ids and domains — never off display prose.
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AnyRecord)
    : undefined;
}

function asRecordArray(value: unknown): readonly AnyRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const record = asRecord(item);
    return record === undefined ? [] : [record];
  });
}

function stringField(record: AnyRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value !== "") {
      return value;
    }
  }
  return undefined;
}

function stringArrayField(record: AnyRecord, ...keys: string[]): readonly string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is string => typeof item === "string" && item !== "",
      );
    }
  }
  return [];
}

/** Ids of a group's members, across the plausible membership spellings. */
function groupMemberIds(group: AnyRecord): readonly string[] {
  const direct = stringArrayField(
    group,
    "memberSubjectIds",
    "memberIds",
    "subjectIds",
    "members",
  );
  if (direct.length > 0) {
    return direct;
  }
  const memberships = group["memberships"];
  if (Array.isArray(memberships)) {
    return memberships.flatMap((entry) => {
      if (typeof entry === "string") {
        return [entry];
      }
      const record = asRecord(entry);
      const id =
        record === undefined
          ? undefined
          : stringField(record, "subjectId", "memberSubjectId", "id");
      return id === undefined ? [] : [id];
    });
  }
  return [];
}

interface PolicySnapshotView {
  subjects: readonly AnyRecord[];
  groups: readonly AnyRecord[];
  resources: readonly AnyRecord[];
  grants: readonly AnyRecord[];
  denials: readonly AnyRecord[];
  requests: readonly AnyRecord[];
}

function snapshotView(engine: PolicyEngine): PolicySnapshotView {
  const state = asRecord(engine.snapshot()) ?? {};
  return {
    subjects: asRecordArray(state["subjects"]),
    groups: asRecordArray(state["groups"]),
    resources: asRecordArray(state["resources"]),
    grants: asRecordArray(state["grants"]),
    denials: asRecordArray(state["denials"]),
    requests: asRecordArray(state["requests"]),
  };
}

function auditView(engine: PolicyEngine): readonly AnyRecord[] {
  return asRecordArray(engine.auditLog());
}

/** A grant/denial is "active-looking" when not revoked and not expired. */
function isActiveLooking(record: AnyRecord, now: Date): boolean {
  // A pass whose task is completed is expired (engine semantics).
  const taskCompletedAt = record["taskCompletedAt"];
  if (typeof taskCompletedAt === "string" && taskCompletedAt !== "") {
    return false;
  }
  const revokedAt = record["revokedAt"];
  if (typeof revokedAt === "string" && revokedAt !== "") {
    return false;
  }
  if (revokedAt !== null && revokedAt !== undefined) {
    return false;
  }
  const expiresAt = stringField(record, "expiresAt");
  if (expiresAt !== undefined) {
    const expiryMs = Date.parse(expiresAt);
    if (!Number.isNaN(expiryMs) && expiryMs <= now.getTime()) {
      return false;
    }
  }
  return true;
}

function isExpired(record: AnyRecord, now: Date): boolean {
  const taskCompletedAt = record["taskCompletedAt"];
  if (typeof taskCompletedAt === "string" && taskCompletedAt !== "") {
    return true;
  }
  const expiresAt = stringField(record, "expiresAt");
  if (expiresAt === undefined) {
    return false;
  }
  const expiryMs = Date.parse(expiresAt);
  return !Number.isNaN(expiryMs) && expiryMs <= now.getTime();
}

/** Subjects a grant or denial applies to (direct + via group membership). */
function subjectIdsOf(
  record: AnyRecord,
  view: PolicySnapshotView,
): ReadonlySet<string> {
  const subjects = new Set<string>();
  const direct = stringField(
    record,
    "granteeSubjectId",
    "subjectId",
    "deniedSubjectId",
    "principalId",
  );
  if (direct !== undefined) {
    subjects.add(direct);
  }
  const groupId = stringField(record, "granteeGroupId", "groupId", "deniedGroupId");
  if (groupId !== undefined) {
    for (const group of view.groups) {
      if (stringField(group, "id") === groupId) {
        for (const memberId of groupMemberIds(group)) {
          subjects.add(memberId);
        }
      }
    }
  }
  return subjects;
}

function groupIdsOf(record: AnyRecord): readonly string[] {
  const groupId = stringField(record, "granteeGroupId", "groupId", "deniedGroupId");
  return groupId === undefined ? [] : [groupId];
}

/** Resource ids a grant/denial covers (direct, or every resource in its domain). */
function resourceIdsOf(
  record: AnyRecord,
  view: PolicySnapshotView,
): ReadonlySet<string> {
  const resources = new Set<string>();
  const direct = stringField(record, "resourceId");
  if (direct !== undefined) {
    resources.add(direct);
  }
  const domain = stringField(record, "domain");
  if (domain !== undefined) {
    for (const resource of view.resources) {
      if (stringField(resource, "domain") === domain) {
        const id = stringField(resource, "id");
        if (id !== undefined) {
          resources.add(id);
        }
      }
    }
  }
  return resources;
}

function actionsOf(record: AnyRecord): readonly string[] {
  return stringArrayField(record, "actions", "action");
}

function actionsOverlap(a: AnyRecord, b: AnyRecord): boolean {
  const actionsA = actionsOf(a);
  const actionsB = actionsOf(b);
  // An empty action list is read as unscoped (wildcard) — overlap.
  if (actionsA.length === 0 || actionsB.length === 0) {
    return true;
  }
  if (actionsA.includes("*") || actionsB.includes("*")) {
    return true;
  }
  return actionsA.some((action) => actionsB.includes(action));
}

function intersects<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): T | undefined {
  for (const value of a) {
    if (b.has(value)) {
      return value;
    }
  }
  return undefined;
}

/** Domains the directive treats as sensitive / restricted. */
export const SENSITIVE_DOMAINS: readonly string[] = [
  "healthcare",
  "health",
  "medical",
  "financial",
  "finance",
  "family-heritage",
  "family heritage",
  "heritage",
] as const;

function isSensitiveDomain(domain: string | undefined): boolean {
  if (domain === undefined) {
    return false;
  }
  const normalized = domain.toLowerCase();
  return SENSITIVE_DOMAINS.some(
    (sensitive) => normalized === sensitive || normalized.includes(sensitive),
  );
}

function domainOfResource(
  resourceId: string,
  view: PolicySnapshotView,
): string | undefined {
  for (const resource of view.resources) {
    if (stringField(resource, "id") === resourceId) {
      return stringField(resource, "domain");
    }
  }
  return undefined;
}

/** Groups that represent the unauthenticated / everyone public. */
function publicGroupIds(view: PolicySnapshotView): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const group of view.groups) {
    const id = stringField(group, "id");
    const label =
      `${id ?? ""} ${stringField(group, "name") ?? ""} ${stringField(group, "label") ?? ""} ${stringField(group, "type") ?? ""}`.toLowerCase();
    if (id !== undefined && label.includes("public")) {
      ids.add(id);
    }
  }
  return ids;
}

function makeResult<Finding>(args: {
  capability: PolicyAgentCapabilityDefinition;
  agentId: string;
  at: string;
  input: unknown;
  summary: string;
  findings: readonly Finding[];
}): PolicyAgentResult<Finding> {
  const inputHash = agentInputHash(args.input);
  return {
    agentId: args.agentId,
    capability: args.capability.id,
    at: args.at,
    mode: "offline",
    summary: args.summary,
    findings: args.findings,
    receipt: {
      id: `audit-${args.capability.id}-${args.at}-${inputHash}`,
      agentId: args.agentId,
      agent: args.agentId,
      capability: args.capability.id,
      decision: "allowed",
      startedAt: args.at,
      completedAt: args.at,
      timestamps: { startedAt: args.at, completedAt: args.at },
      inputHash,
      hashAlgorithm: "fnv1a-32 (non-cryptographic)",
      mode: "offline",
    },
  };
}

function capabilityOrThrow(
  id: PolicyAgentCapabilityId,
): PolicyAgentCapabilityDefinition {
  const capability = getPolicyAgentCapability(id);
  if (capability === undefined) {
    throw new Error(`policy capability '${id}' is not defined`);
  }
  return capability;
}

// ---------------------------------------------------------------------------
// 1. Privacy Guardian — policy conflict report (never mutates)
// ---------------------------------------------------------------------------

export type PrivacyGuardianFindingKind =
  | "grant-denial-conflict"
  | "over-broad-grant"
  | "unbounded-pass";

export interface PrivacyGuardianFinding {
  id: string;
  kind: PrivacyGuardianFindingKind;
  severity: PolicyAgentSeverity;
  description: string;
  subjectId?: string;
  resourceId?: string;
  grantId?: string;
  denialId?: string;
  domain?: string;
}

export function runPrivacyGuardian(
  engine: PolicyEngine,
  options: { now?: Date } = {},
): PolicyAgentResult<PrivacyGuardianFinding> {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const view = snapshotView(engine);
  const findings: PrivacyGuardianFinding[] = [];
  const publicGroups = publicGroupIds(view);

  // (a) Grant + explicit denial overlap on the same subject/resource/
  // action scope. Deny wins in the engine; the conflict is still worth
  // surfacing — one of the two records no longer matches intent.
  for (const denial of view.denials) {
    if (!isActiveLooking(denial, now)) {
      continue;
    }
    const denialId = stringField(denial, "id");
    const denialSubjects = subjectIdsOf(denial, view);
    const denialResources = resourceIdsOf(denial, view);
    for (const grant of view.grants) {
      if (!isActiveLooking(grant, now)) {
        continue;
      }
      const grantId = stringField(grant, "id");
      const sharedSubject = intersects(denialSubjects, subjectIdsOf(grant, view));
      if (sharedSubject === undefined) {
        continue;
      }
      const sharedResource = intersects(
        denialResources,
        resourceIdsOf(grant, view),
      );
      if (sharedResource === undefined) {
        continue;
      }
      if (!actionsOverlap(grant, denial)) {
        continue;
      }
      const directResource =
        stringField(grant, "resourceId") !== undefined &&
        stringField(grant, "resourceId") === stringField(denial, "resourceId");
      findings.push({
        id: `guardian-conflict-${grantId ?? "grant"}-${denialId ?? "denial"}-${sharedResource}`,
        kind: "grant-denial-conflict",
        severity: directResource ? "high" : "medium",
        description:
          `Subject ${sharedSubject} holds grant ${grantId ?? "(unknown)"} ` +
          `and explicit denial ${denialId ?? "(unknown)"} that both cover ` +
          `resource ${sharedResource}. Deny wins at evaluation; the ` +
          `overlap means one record no longer matches the owner's intent.`,
        subjectId: sharedSubject,
        resourceId: sharedResource,
        ...(grantId !== undefined ? { grantId } : {}),
        ...(denialId !== undefined ? { denialId } : {}),
        ...(stringField(grant, "domain") !== undefined ||
        domainOfResource(sharedResource, view) !== undefined
          ? {
              domain:
                stringField(grant, "domain") ??
                domainOfResource(sharedResource, view) ??
                "",
            }
          : {}),
      });
    }
  }

  // (b) Over-broad grants over sensitive / restricted domains.
  for (const grant of view.grants) {
    if (!isActiveLooking(grant, now)) {
      continue;
    }
    const grantId = stringField(grant, "id");
    const grantDomain = stringField(grant, "domain");
    const coveredResources = resourceIdsOf(grant, view);
    const sensitiveResource = [...coveredResources].find((resourceId) =>
      isSensitiveDomain(domainOfResource(resourceId, view)),
    );
    const touchesSensitive =
      isSensitiveDomain(grantDomain) || sensitiveResource !== undefined;
    if (!touchesSensitive) {
      continue;
    }
    const domain = grantDomain ?? domainOfResource(sensitiveResource ?? "", view);
    const viaPublicGroup = groupIdsOf(grant).some((groupId) =>
      publicGroups.has(groupId),
    );
    const actions = actionsOf(grant);
    const wildcardScope =
      actions.length === 0 || actions.includes("*") || actions.includes("admin");
    if (viaPublicGroup) {
      findings.push({
        id: `guardian-overbroad-${grantId ?? "grant"}-public`,
        kind: "over-broad-grant",
        severity: "high",
        description:
          `Grant ${grantId ?? "(unknown)"} gives a public group access ` +
          `in the sensitive domain '${domain ?? "unknown"}'. Public-group ` +
          `grants must never touch healthcare, financial, or ` +
          `family-heritage domains.`,
        ...(grantId !== undefined ? { grantId } : {}),
        ...(sensitiveResource !== undefined
          ? { resourceId: sensitiveResource }
          : {}),
        ...(domain !== undefined ? { domain } : {}),
      });
    } else if (wildcardScope) {
      findings.push({
        id: `guardian-overbroad-${grantId ?? "grant"}-wildcard`,
        kind: "over-broad-grant",
        severity: "medium",
        description:
          `Grant ${grantId ?? "(unknown)"} has unscoped or admin actions ` +
          `in the sensitive domain '${domain ?? "unknown"}' (purpose: ` +
          `${stringField(grant, "purpose") ?? "unspecified"}). ` +
          `Sensitive-domain grants should be action- and purpose-limited.`,
        ...(grantId !== undefined ? { grantId } : {}),
        ...(sensitiveResource !== undefined
          ? { resourceId: sensitiveResource }
          : {}),
        ...(domain !== undefined ? { domain } : {}),
      });
    }
  }

  // (c) Temporary passes with no expiry and no task binding — a pass
  // that can never lapse is a standing grant wearing a pass's name.
  for (const grant of view.grants) {
    if (stringField(grant, "kind") !== "pass") {
      continue;
    }
    if (!isActiveLooking(grant, now)) {
      continue;
    }
    const hasExpiry = stringField(grant, "expiresAt") !== undefined;
    const hasTask = stringField(grant, "taskId") !== undefined;
    if (hasExpiry || hasTask) {
      continue;
    }
    const grantId = stringField(grant, "id");
    findings.push({
      id: `guardian-unbounded-pass-${grantId ?? "pass"}`,
      kind: "unbounded-pass",
      severity: "medium",
      description:
        `Pass ${grantId ?? "(unknown)"} has no expiry and no task ` +
        `binding. Temporary passes must expire or be bound to a task.`,
      ...(grantId !== undefined ? { grantId } : {}),
      ...(stringField(grant, "resourceId") !== undefined
        ? { resourceId: stringField(grant, "resourceId") ?? "" }
        : {}),
      ...(stringField(grant, "domain") !== undefined
        ? { domain: stringField(grant, "domain") ?? "" }
        : {}),
    });
  }

  const capability = capabilityOrThrow("privacy-guardian");
  return makeResult({
    capability,
    agentId: "guardian",
    at,
    input: {
      capability: capability.id,
      grants: view.grants.length,
      denials: view.denials.length,
      at,
    },
    summary:
      `Privacy Guardian (offline, report-only): ${findings.length} ` +
      `finding(s) — ${findings.filter((f) => f.kind === "grant-denial-conflict").length} ` +
      `grant/denial conflict(s), ${findings.filter((f) => f.kind === "over-broad-grant").length} ` +
      `over-broad grant(s), ${findings.filter((f) => f.kind === "unbounded-pass").length} ` +
      `unbounded pass(es). Nothing was mutated.`,
    findings,
  });
}

// ---------------------------------------------------------------------------
// 2. Security Review — audit-log review (never mutates)
// ---------------------------------------------------------------------------

export type SecurityReviewFindingKind =
  | "potential-permission-probing"
  | "emergency-event-review"
  | "denied-access-pattern";

export interface SecurityReviewFinding {
  id: string;
  kind: SecurityReviewFindingKind;
  severity: PolicyAgentSeverity;
  description: string;
  subjectId?: string;
  resourceId?: string;
  /** Audit event ids backing this finding. */
  eventIds: readonly string[];
  count?: number;
}

export interface SecurityReviewResult
  extends PolicyAgentResult<SecurityReviewFinding> {
  counts: {
    totalEvents: number;
    evaluations: number;
    allowed: number;
    denied: number;
    emergency: number;
  };
  denialsBySubject: Readonly<Record<string, number>>;
  denialsByResource: Readonly<Record<string, number>>;
}

/** Minimum denials from one subject before probing is flagged. */
export const PROBING_DENIAL_THRESHOLD = 2;

function decisionOf(event: AnyRecord): "allow" | "deny" | undefined {
  const raw = stringField(event, "decision");
  if (raw === undefined) {
    return undefined;
  }
  const normalized = raw.toLowerCase();
  if (normalized.includes("den")) {
    return "deny";
  }
  if (
    normalized.includes("allow") ||
    normalized.includes("grant") ||
    normalized.includes("permit")
  ) {
    return "allow";
  }
  return undefined;
}

function isEmergencyEvent(event: AnyRecord): boolean {
  const haystack =
    `${stringField(event, "kind") ?? ""} ${stringField(event, "reason") ?? ""} ` +
    `${stringField(event, "detail") ?? ""}`.toLowerCase();
  return haystack.includes("emergency");
}

export function runSecurityReview(
  engine: PolicyEngine,
  options: { now?: Date } = {},
): SecurityReviewResult {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const events = auditView(engine);

  let allowed = 0;
  let denied = 0;
  const denialsBySubject = new Map<string, AnyRecord[]>();
  const denialsByResource = new Map<string, number>();
  const emergencyEvents: AnyRecord[] = [];

  for (const event of events) {
    const decision = decisionOf(event);
    if (decision === "allow") {
      allowed += 1;
    }
    if (decision === "deny") {
      denied += 1;
      const subjectId = stringField(event, "subjectId");
      if (subjectId !== undefined) {
        const list = denialsBySubject.get(subjectId) ?? [];
        list.push(event);
        denialsBySubject.set(subjectId, list);
      }
      const resourceId = stringField(event, "resourceId");
      if (resourceId !== undefined) {
        denialsByResource.set(resourceId, (denialsByResource.get(resourceId) ?? 0) + 1);
      }
    }
    if (isEmergencyEvent(event)) {
      emergencyEvents.push(event);
    }
  }

  const findings: SecurityReviewFinding[] = [];

  for (const [subjectId, subjectEvents] of denialsBySubject) {
    if (subjectEvents.length < PROBING_DENIAL_THRESHOLD) {
      continue;
    }
    findings.push({
      id: `security-probing-${subjectId}`,
      kind: "potential-permission-probing",
      severity: subjectEvents.length >= 3 ? "high" : "medium",
      description:
        `Subject ${subjectId} has ${subjectEvents.length} denied ` +
        `evaluations in the audit log — potential permission probing. ` +
        `This is a pattern for human review, not a finding of intent.`,
      subjectId,
      eventIds: subjectEvents.flatMap((event) => {
        const id = stringField(event, "id");
        return id === undefined ? [] : [id];
      }),
      count: subjectEvents.length,
    });
  }

  for (const [resourceId, count] of denialsByResource) {
    if (count < PROBING_DENIAL_THRESHOLD) {
      continue;
    }
    // Skip resources already covered by a probing finding's subject
    // only when the counts coincide — resource patterns stand alone.
    findings.push({
      id: `security-denied-resource-${resourceId}`,
      kind: "denied-access-pattern",
      severity: "low",
      description:
        `Resource ${resourceId} has ${count} denied evaluations in ` +
        `the audit log. Repeated denials against one resource are ` +
        `worth a review of who is asking and why.`,
      resourceId,
      eventIds: events.flatMap((event) => {
        const id = stringField(event, "id");
        return decisionOf(event) === "deny" &&
          stringField(event, "resourceId") === resourceId &&
          id !== undefined
          ? [id]
          : [];
      }),
      count,
    });
  }

  for (const event of emergencyEvents) {
    const eventId = stringField(event, "id");
    findings.push({
      id: `security-emergency-${eventId ?? "event"}`,
      kind: "emergency-event-review",
      severity: "high",
      description:
        `Emergency-kind audit event ${eventId ?? "(unknown)"} requires ` +
        `post-hoc review: emergency access is a governed flow, never ` +
        `a bypass, and every use must be reviewed after the fact.`,
      ...(stringField(event, "subjectId") !== undefined
        ? { subjectId: stringField(event, "subjectId") ?? "" }
        : {}),
      ...(stringField(event, "resourceId") !== undefined
        ? { resourceId: stringField(event, "resourceId") ?? "" }
        : {}),
      eventIds: eventId === undefined ? [] : [eventId],
    });
  }

  const capability = capabilityOrThrow("security-review");
  const base = makeResult({
    capability,
    agentId: "security-review",
    at,
    input: { capability: capability.id, events: events.length, at },
    summary:
      `Security Review (offline, read-only): ${allowed + denied} ` +
      `evaluation(s) in the audit log — ${allowed} allowed, ${denied} ` +
      `denied; ${emergencyEvents.length} emergency event(s) requiring ` +
      `post-hoc review; ${findings.filter((f) => f.kind === "potential-permission-probing").length} ` +
      `repeat-denial subject(s) flagged. Nothing was mutated.`,
    findings,
  });

  return {
    ...base,
    counts: {
      totalEvents: events.length,
      evaluations: allowed + denied,
      allowed,
      denied,
      emergency: emergencyEvents.length,
    },
    denialsBySubject: Object.fromEntries(
      [...denialsBySubject.entries()].map(([subjectId, list]) => [
        subjectId,
        list.length,
      ]),
    ),
    denialsByResource: Object.fromEntries(denialsByResource.entries()),
  };
}

// ---------------------------------------------------------------------------
// 3. Relationship Intelligence — proposals only (directive §6 + §13)
//
// HARD RULE: proposals are data. There is NO apply function in this
// module — no export here accepts a proposal and changes the engine.
// A human (or a separately approved surface) decides; this capability
// only writes the list.
// ---------------------------------------------------------------------------

export type RelationshipProposalKind =
  | "assign-subject-to-group"
  | "cleanup-expired-pass"
  | "decide-request"
  | "scope-broad-grant";

export interface RelationshipProposal {
  id: string;
  kind: RelationshipProposalKind;
  description: string;
  subjectId?: string;
  resourceId?: string;
  grantId?: string;
  requestId?: string;
  groupId?: string;
}

export function runRelationshipIntelligence(
  engine: PolicyEngine,
  options: { now?: Date } = {},
): PolicyAgentResult<RelationshipProposal> {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const view = snapshotView(engine);
  const proposals: RelationshipProposal[] = [];

  // Subjects in no group — relationship structure is missing, so any
  // group-scoped grant silently skips them.
  const groupedSubjects = new Set<string>();
  for (const group of view.groups) {
    for (const memberId of groupMemberIds(group)) {
      groupedSubjects.add(memberId);
    }
  }
  for (const subject of view.subjects) {
    const subjectId = stringField(subject, "id");
    if (subjectId === undefined || groupedSubjects.has(subjectId)) {
      continue;
    }
    proposals.push({
      id: `rel-ungrouped-${subjectId}`,
      kind: "assign-subject-to-group",
      description:
        `Subject ${subjectId} belongs to no relationship group. ` +
        `Proposal only: assign them to the group that matches their ` +
        `relationship, or record a deliberate no-group decision.`,
      subjectId,
    });
  }

  // Expired passes still listed active-looking (not revoked) — cleanup
  // proposals, never cleanup actions.
  for (const grant of view.grants) {
    if (stringField(grant, "kind") !== "pass") {
      continue;
    }
    if (!isExpired(grant, now)) {
      continue;
    }
    const revokedAt = grant["revokedAt"];
    if (typeof revokedAt === "string" && revokedAt !== "") {
      continue;
    }
    const grantId = stringField(grant, "id");
    proposals.push({
      id: `rel-expired-pass-${grantId ?? "pass"}`,
      kind: "cleanup-expired-pass",
      description:
        `Pass ${grantId ?? "(unknown)"} expired at ` +
        `${stringField(grant, "expiresAt") ?? "unknown"} but is still ` +
        `listed unrevoked. Proposal only: archive or revoke the record ` +
        `so active-pass lists stay truthful.`,
      ...(grantId !== undefined ? { grantId } : {}),
      ...(stringField(grant, "resourceId") !== undefined
        ? { resourceId: stringField(grant, "resourceId") ?? "" }
        : {}),
    });
  }

  // Pending requests awaiting a decision — listed as proposals TO
  // DECIDE. This capability does not decide them.
  for (const request of view.requests) {
    const status = stringField(request, "status")?.toLowerCase();
    const isPending =
      status === undefined
        ? request["decidedAt"] === undefined && request["decision"] === undefined
        : status.includes("pending") ||
          status.includes("awaiting") ||
          status === "requested" ||
          status === "open";
    if (!isPending) {
      continue;
    }
    const requestId = stringField(request, "id");
    const requester = stringField(
      request,
      "requesterSubjectId",
      "subjectId",
      "requestedBy",
    );
    const resourceId = stringField(request, "resourceId");
    const action = stringField(request, "action") ?? actionsOf(request)[0];
    proposals.push({
      id: `rel-decide-${requestId ?? "request"}`,
      kind: "decide-request",
      description:
        `Access request ${requestId ?? "(unknown)"}` +
        `${requester !== undefined ? ` from ${requester}` : ""}` +
        `${action !== undefined ? ` to ${action}` : ""}` +
        `${resourceId !== undefined ? ` resource ${resourceId}` : ""} ` +
        `is pending. Proposal only: a human decision is required — ` +
        `this capability does not decide requests.`,
      ...(requestId !== undefined ? { requestId } : {}),
      ...(requester !== undefined ? { subjectId: requester } : {}),
      ...(resourceId !== undefined ? { resourceId } : {}),
    });
  }

  // Sensitive-domain resources with no explicit denial where a broad
  // group grant exists — propose scoping the grant / adding a denial.
  const publicGroups = publicGroupIds(view);
  for (const resource of view.resources) {
    const resourceId = stringField(resource, "id");
    const domain = stringField(resource, "domain");
    if (resourceId === undefined || !isSensitiveDomain(domain)) {
      continue;
    }
    const hasDenial = view.denials.some((denial) =>
      resourceIdsOf(denial, view).has(resourceId),
    );
    if (hasDenial) {
      continue;
    }
    const broadGrant = view.grants.find((grant) => {
      if (!isActiveLooking(grant, now)) {
        return false;
      }
      if (!resourceIdsOf(grant, view).has(resourceId)) {
        return false;
      }
      const actions = actionsOf(grant);
      return (
        groupIdsOf(grant).length > 0 &&
        (actions.length === 0 ||
          actions.includes("*") ||
          actions.includes("admin") ||
          actions.length >= 4 ||
          groupIdsOf(grant).some((groupId) => publicGroups.has(groupId)))
      );
    });
    if (broadGrant === undefined) {
      continue;
    }
    const grantId = stringField(broadGrant, "id");
    proposals.push({
      id: `rel-scope-${resourceId}-${grantId ?? "grant"}`,
      kind: "scope-broad-grant",
      description:
        `Sensitive resource ${resourceId} (domain '${domain ?? "unknown"}') ` +
        `is covered by broad group grant ${grantId ?? "(unknown)"} with ` +
        `no explicit denial scoping it. Proposal only: narrow the ` +
        `grant's actions/purpose or add an explicit denial for the ` +
        `subjects who must not reach it.`,
      resourceId,
      ...(grantId !== undefined ? { grantId } : {}),
      ...(groupIdsOf(broadGrant)[0] !== undefined
        ? { groupId: groupIdsOf(broadGrant)[0] ?? "" }
        : {}),
    });
  }

  const capability = capabilityOrThrow("relationship-intelligence");
  return makeResult({
    capability,
    agentId: "relationship-intelligence",
    at,
    input: {
      capability: capability.id,
      subjects: view.subjects.length,
      requests: view.requests.length,
      at,
    },
    summary:
      `Relationship Intelligence (offline, proposals only): ` +
      `${proposals.length} proposal(s) — ` +
      `${proposals.filter((p) => p.kind === "decide-request").length} ` +
      `pending request(s) to decide, ` +
      `${proposals.filter((p) => p.kind === "assign-subject-to-group").length} ` +
      `ungrouped subject(s), ` +
      `${proposals.filter((p) => p.kind === "cleanup-expired-pass").length} ` +
      `expired-pass cleanup(s), ` +
      `${proposals.filter((p) => p.kind === "scope-broad-grant").length} ` +
      `grant-scoping proposal(s). Proposals are data; nothing was applied.`,
    findings: proposals,
  });
}
