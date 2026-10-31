/**
 * @omega/policy-engine — engine unit tests
 *
 * The directive §9 security matrix lives in security.test.ts; this
 * file covers the engine mechanics underneath it: grant status,
 * grant/denial/request lifecycle, state ownership, and the fixture
 * contract.
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import {
  DATA_DOMAINS,
  DEMO_MEMBER_ID,
  ELIAS_LEGACY_DIRECTIVE,
  GROUP_TYPES,
  POLICY_ACTIONS,
  PolicyEngine,
  TRAINING_PURPOSE,
  createDemoPolicyState,
  grantStatusAt,
  type AccessGrant,
} from "./index.js";

const NOW = new Date("2026-10-27T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

function grant(patch?: Partial<AccessGrant>): AccessGrant {
  return {
    id: "g-test",
    kind: "grant",
    granteeSubjectId: "person-friend",
    resourceId: "res-budget",
    actions: ["view"],
    purpose: "budget-help",
    grantedBy: DEMO_MEMBER_ID,
    grantedAt: "2026-10-01T00:00:00.000Z",
    revokedAt: null,
    ...patch,
  };
}

describe("vocabulary exports", () => {
  it("exposes the full domains/actions/groups surface and the training purpose", () => {
    expect(DATA_DOMAINS.length).toBe(10);
    expect(DATA_DOMAINS).toContain("family-heritage");
    expect(POLICY_ACTIONS).toEqual([
      "view",
      "create",
      "edit",
      "comment",
      "contribute",
      "export",
      "share",
      "admin",
    ]);
    expect(GROUP_TYPES.length).toBe(10);
    expect(GROUP_TYPES).toContain("legacy-stewards");
    expect(TRAINING_PURPOSE).toBe("model-training");
  });
});

describe("grantStatusAt", () => {
  it("is active for a plain grant", () => {
    expect(grantStatusAt(grant(), NOW)).toBe("active");
  });

  it("is expired once expiresAt has passed, and exactly at expiresAt", () => {
    expect(grantStatusAt(grant({ expiresAt: "2026-10-27T11:59:59.000Z" }), NOW)).toBe(
      "expired",
    );
    expect(grantStatusAt(grant({ expiresAt: NOW_ISO }), NOW)).toBe("expired");
    expect(grantStatusAt(grant({ expiresAt: "2026-10-27T12:00:01.000Z" }), NOW)).toBe(
      "active",
    );
  });

  it("is expired for a completed pass", () => {
    expect(
      grantStatusAt(
        grant({ kind: "pass", taskId: "t-1", taskCompletedAt: NOW_ISO }),
        NOW,
      ),
    ).toBe("expired");
    expect(
      grantStatusAt(grant({ kind: "pass", taskId: "t-1", taskCompletedAt: null }), NOW),
    ).toBe("active");
  });

  it("revoked wins over expired", () => {
    expect(
      grantStatusAt(
        grant({ revokedAt: NOW_ISO, expiresAt: "2020-01-01T00:00:00.000Z" }),
        NOW,
      ),
    ).toBe("revoked");
  });
});

describe("createGrant", () => {
  it("creates a purpose-limited grant that immediately governs evaluation", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(
      e.evaluate({
        subjectId: "person-friend",
        resourceId: "res-budget",
        action: "view",
        purpose: "budget-help",
        now: NOW,
      }).decision,
    ).toBe("deny");
    const created = e.createGrant(grant());
    expect(created.id).toBe("g-test");
    expect(
      e.evaluate({
        subjectId: "person-friend",
        resourceId: "res-budget",
        action: "view",
        purpose: "budget-help",
        now: NOW,
      }).decision,
    ).toBe("allow");
    expect(
      e.evaluate({
        subjectId: "person-friend",
        resourceId: "res-budget",
        action: "view",
        purpose: "curiosity",
        now: NOW,
      }).decision,
    ).toBe("deny");
    expect(e.auditLog().some((event) => event.kind === "grant-created")).toBe(true);
  });

  it("throws for an unknown granter, unknown grantee, and duplicate id", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(() => e.createGrant(grant({ grantedBy: "person-ghost" }))).toThrow(
      /unknown grantedBy/,
    );
    expect(() => e.createGrant(grant({ granteeSubjectId: "person-ghost" }))).toThrow(
      /unknown grantee/,
    );
    e.createGrant(grant());
    expect(() => e.createGrant(grant())).toThrow(/already exists/);
  });

  it("a request with no stated purpose matches on scope alone", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(
      e.evaluate({
        subjectId: "person-doctor",
        resourceId: "res-medical-summary",
        action: "view",
        now: NOW,
      }).decision,
    ).toBe("allow");
  });
});

describe("createDenial — deny wins, scoped by actions", () => {
  it("a domain denial blocks a granted view; an export-only denial leaves view allowed", () => {
    const blocked = new PolicyEngine(createDemoPolicyState());
    blocked.createGrant(grant());
    blocked.createDenial({
      id: "d-friend-budget",
      subjectId: "person-friend",
      domain: "financial",
      actions: ["view"],
      reason: "Member paused budget sharing (synthetic).",
      createdBy: DEMO_MEMBER_ID,
      createdAt: NOW_ISO,
    });
    const decision = blocked.evaluate({
      subjectId: "person-friend",
      resourceId: "res-budget",
      action: "view",
      purpose: "budget-help",
      now: NOW,
    });
    expect(decision.decision).toBe("deny");
    expect(decision.matchedDenialId).toBe("d-friend-budget");

    const partial = new PolicyEngine(createDemoPolicyState());
    partial.createGrant(grant());
    partial.createDenial({
      id: "d-friend-budget-export",
      subjectId: "person-friend",
      domain: "financial",
      actions: ["export"],
      reason: "Exports paused only (synthetic).",
      createdBy: DEMO_MEMBER_ID,
      createdAt: NOW_ISO,
    });
    expect(
      partial.evaluate({
        subjectId: "person-friend",
        resourceId: "res-budget",
        action: "view",
        purpose: "budget-help",
        now: NOW,
      }).decision,
    ).toBe("allow");
  });
});

describe("requests lifecycle", () => {
  it("approving the pending export request creates a working grant via createGrant", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(
      e.evaluate({
        subjectId: "person-coworker",
        resourceId: "res-project-plan",
        action: "export",
        purpose: "project-halcyon",
        now: NOW,
      }).decision,
    ).toBe("deny");

    const decided = e.decideRequest("req-coworker-export", true, DEMO_MEMBER_ID, NOW);
    expect(decided?.status).toBe("approved");
    expect(e.pendingRequests()).toEqual([]);
    expect(
      e.evaluate({
        subjectId: "person-coworker",
        resourceId: "res-project-plan",
        action: "export",
        purpose: "project-halcyon",
        now: NOW,
      }).decision,
    ).toBe("allow");
    expect(
      e.snapshot().grants.some((g) => g.id === "g-from-req-coworker-export"),
    ).toBe(true);
    expect(e.auditLog().some((event) => event.kind === "request-decided")).toBe(true);
  });

  it("denying a request creates no grant; unknown ids return undefined; re-deciding is a no-op", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    const decided = e.decideRequest("req-coworker-export", false, DEMO_MEMBER_ID, NOW);
    expect(decided?.status).toBe("denied");
    expect(
      e.snapshot().grants.some((g) => g.id === "g-from-req-coworker-export"),
    ).toBe(false);
    expect(e.decideRequest("req-nope", true, DEMO_MEMBER_ID, NOW)).toBeUndefined();
    expect(
      e.decideRequest("req-coworker-export", true, DEMO_MEMBER_ID, NOW)?.status,
    ).toBe("denied");
  });

  it("approval by an agent throws through createGrant and leaves the request pending", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(() =>
      e.decideRequest("req-coworker-export", true, "agent-archivist", NOW),
    ).toThrow(/agent/i);
    expect(e.pendingRequests().map((r) => r.id)).toEqual(["req-coworker-export"]);
  });

  it("createRequest registers a new pending request with an audit event", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    const created = e.createRequest({
      id: "req-friend-patent",
      subjectId: "person-friend",
      resourceId: "res-patent",
      actions: ["view"],
      purpose: "feedback",
      requestedAt: NOW_ISO,
      status: "pending",
    });
    expect(created.status).toBe("pending");
    expect(e.pendingRequests().map((r) => r.id)).toContain("req-friend-patent");
    expect(e.auditLog().some((event) => event.kind === "request-created")).toBe(true);
  });
});

describe("revocation & task edges", () => {
  it("revoking an unknown grant returns undefined; re-revoking adds no audit events", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(e.revokeGrant("g-nope", NOW)).toBeUndefined();
    e.revokeGrant("g-friends-social", NOW);
    const auditLength = e.auditLog().length;
    const again = e.revokeGrant("g-friends-social", NOW);
    expect(again?.revokedAt).toBe(NOW_ISO);
    expect(e.auditLog().length).toBe(auditLength);
  });

  it("revoking a direct-subject grant purges only that subject (no caches provided = no purge events)", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    const revoked = e.revokeGrant("pass-doctor-second-opinion", NOW);
    expect(revoked?.id).toBe("pass-doctor-second-opinion");
    expect(e.auditLog().map((event) => event.kind)).toEqual(["grant-revoked"]);
  });

  it("completeTask on an unknown or already-completed task completes nothing", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    expect(e.completeTask("task-nope", NOW)).toEqual([]);
    e.completeTask("task-organize-archive", NOW);
    expect(e.completeTask("task-organize-archive", NOW)).toEqual([]);
  });
});

describe("state ownership", () => {
  it("the engine owns copies: mutating the seed state after construction changes nothing", () => {
    const state = createDemoPolicyState();
    const e = new PolicyEngine(state);
    const medical = state.grants.find((g) => g.id === "g-doctor-medical");
    if (medical === undefined) {
      throw new Error("fixture grant missing");
    }
    medical.revokedAt = NOW_ISO;
    expect(
      e.evaluate({
        subjectId: "person-doctor",
        resourceId: "res-medical-summary",
        action: "view",
        purpose: "treatment",
        now: NOW,
      }).decision,
    ).toBe("allow");
  });

  it("snapshot() returns deep copies that cannot mutate the engine", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    const snapshot = e.snapshot();
    const medical = snapshot.grants.find((g) => g.id === "g-doctor-medical");
    if (medical === undefined) {
      throw new Error("snapshot grant missing");
    }
    medical.revokedAt = NOW_ISO;
    const family = snapshot.groups.find((g) => g.id === "grp-family");
    if (family !== undefined) {
      (family.memberIds as string[]).length = 0;
    }
    expect(
      e.evaluate({
        subjectId: "person-doctor",
        resourceId: "res-medical-summary",
        action: "view",
        purpose: "treatment",
        now: NOW,
      }).decision,
    ).toBe("allow");
    expect(e.snapshot().groups.find((g) => g.id === "grp-family")?.memberIds).toEqual([
      "person-daughter",
    ]);
  });

  it("dryRun evaluations append no audit events", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    e.evaluate({
      subjectId: "person-friend",
      resourceId: "res-personal-post",
      action: "view",
      dryRun: true,
      now: NOW,
    });
    expect(e.auditLog()).toEqual([]);
  });
});

describe("previewAccess", () => {
  it("returns every resource × all 8 actions with per-action decisions", () => {
    const e = new PolicyEngine(createDemoPolicyState());
    const preview = e.previewAccess("person-public", NOW);
    expect(preview.length).toBe(14);
    for (const entry of preview) {
      expect(Object.keys(entry.actions).sort()).toEqual([...POLICY_ACTIONS].sort());
    }
    const essay = preview.find((entry) => entry.resource.id === "res-public-essay");
    expect(essay?.actions.view.decision).toBe("allow");
    expect(essay?.actions.export.decision).toBe("deny");
    const post = preview.find((entry) => entry.resource.id === "res-personal-post");
    expect(post?.actions.view.decision).toBe("deny");
  });
});

describe("demo fixture contract", () => {
  it("createDemoPolicyState returns fresh deep objects per call", () => {
    const a = createDemoPolicyState();
    const b = createDemoPolicyState();
    expect(a).toEqual(b);
    a.grants.push(grant({ id: "g-injected" }));
    const aDirective = a.legacyDirectives.find((d) => d.memberId === "elias-marlowe");
    if (aDirective !== undefined) {
      (aDirective.neverPublic as string[]).push("legacy");
    }
    expect(b.grants.some((g) => g.id === "g-injected")).toBe(false);
    expect(
      b.legacyDirectives.find((d) => d.memberId === "elias-marlowe")?.neverPublic,
    ).toEqual(["healthcare", "financial"]);
    expect(ELIAS_LEGACY_DIRECTIVE.neverPublic).toEqual(["healthcare", "financial"]);
  });

  it("the fixture carries June's directive and the Elias directive for the Garden archive", () => {
    const state = createDemoPolicyState();
    const june = state.legacyDirectives.find((d) => d.memberId === DEMO_MEMBER_ID);
    expect(june?.neverPublic).toEqual(["healthcare", "financial", "family-heritage"]);
    expect(june?.stewards).toEqual(["person-daughter"]);
    expect(june?.memorialization.state).toBe("not-started");
    expect(june?.simulationDisclosure).toMatch(/simulations/);
    expect(june?.continuityAuthorizations[0]?.attributionRule).toMatch(/subsequent/);

    expect(ELIAS_LEGACY_DIRECTIVE.memberId).toBe("elias-marlowe");
    expect(ELIAS_LEGACY_DIRECTIVE.stewards).toEqual([]);
    expect(ELIAS_LEGACY_DIRECTIVE.simulationDisclosure).toMatch(/provenance/);
    expect(
      state.legacyDirectives.some((d) => d.memberId === "elias-marlowe"),
    ).toBe(true);
  });

  it("every fixture record summary and display name carries (synthetic) labeling where it represents a record", () => {
    const state = createDemoPolicyState();
    for (const resource of state.resources) {
      expect(resource.summary).toContain("(synthetic)");
    }
    for (const subject of state.subjects) {
      if (subject.id === "person-public" || subject.kind === "agent") {
        continue;
      }
      expect(subject.displayName).toContain("(synthetic)");
    }
  });
});
