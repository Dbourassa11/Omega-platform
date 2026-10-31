/**
 * @omega/policy-engine — directive §9 security-test matrix
 *
 * Every case runs against the June Calloway demo fixture
 * (@see demo-fixture.ts). These tests are the enforcement proof
 * for the demo data paths: purpose-limited grants, deny-wins,
 * expired passes, revocation with the consent-core context purge,
 * task-bound passes, the model-training purpose wall, agent
 * self-escalation guards, deny-by-default, and the legacy
 * never-public directive guard.
 *
 * Creator: David Charles Bourassa
 */

import { ContextCache, SyncEventLog } from "@omega/consent-core";
import { describe, expect, it } from "vitest";

import {
  DEMO_MEMBER_ID,
  PolicyEngine,
  TRAINING_PURPOSE,
  createDemoPolicyState,
  type AccessGrant,
  type PolicyAction,
  type PolicyState,
} from "./index.js";

const NOW = new Date("2026-10-27T12:00:00.000Z");

function engine(state: PolicyState = createDemoPolicyState()): PolicyEngine {
  return new PolicyEngine(state);
}

function decide(
  e: PolicyEngine,
  subjectId: string,
  resourceId: string,
  action: PolicyAction,
  purpose?: string,
): "allow" | "deny" {
  return e.evaluate({
    subjectId,
    resourceId,
    action,
    ...(purpose !== undefined ? { purpose } : {}),
    now: NOW,
  }).decision;
}

describe("§9 — healthcare provider, purpose-limited", () => {
  it("doctor views the medical summary with purpose 'treatment' = allow", () => {
    const decision = engine().evaluate({
      subjectId: "person-doctor",
      resourceId: "res-medical-summary",
      action: "view",
      purpose: "treatment",
      now: NOW,
    });
    expect(decision.decision).toBe("allow");
    expect(decision.matchedGrantId).toBe("g-doctor-medical");
  });

  it("doctor is denied the family chat, the budget, and the patent", () => {
    const e = engine();
    expect(decide(e, "person-doctor", "res-family-chat", "view")).toBe("deny");
    expect(decide(e, "person-doctor", "res-budget", "view")).toBe("deny");
    expect(decide(e, "person-doctor", "res-patent", "view")).toBe("deny");
  });

  it("doctor with purpose 'research' is denied the medical summary (purpose-limited grant)", () => {
    expect(
      decide(engine(), "person-doctor", "res-medical-summary", "view", "research"),
    ).toBe("deny");
  });
});

describe("§9 — family member", () => {
  it("daughter views heritage photos and the memoir", () => {
    const e = engine();
    expect(
      decide(e, "person-daughter", "res-heritage-photos", "view", "family-sharing"),
    ).toBe("allow");
    expect(decide(e, "person-daughter", "res-memoir", "view", "heritage")).toBe(
      "allow",
    );
  });

  it("daughter is denied the performance review", () => {
    expect(decide(engine(), "person-daughter", "res-performance-review", "view")).toBe(
      "deny",
    );
  });
});

describe("§9 — coworker and deny-wins", () => {
  it("coworker contributes to the project plan = allow", () => {
    const decision = engine().evaluate({
      subjectId: "person-coworker",
      resourceId: "res-project-plan",
      action: "contribute",
      purpose: "project-halcyon",
      now: NOW,
    });
    expect(decision.decision).toBe("allow");
    expect(decision.matchedGrantId).toBe("g-work-project");
  });

  it("coworker is denied the medical summary", () => {
    expect(decide(engine(), "person-coworker", "res-medical-summary", "view")).toBe(
      "deny",
    );
  });

  it("coworker viewing the performance review is DENIED by the explicit denial despite the employment domain grant (deny wins)", () => {
    const decision = engine().evaluate({
      subjectId: "person-coworker",
      resourceId: "res-performance-review",
      action: "view",
      purpose: "employment",
      now: NOW,
    });
    expect(decision.decision).toBe("deny");
    expect(decision.matchedDenialId).toBe("d-coworker-review");
    expect(decision.matchedGrantId).toBeUndefined();
  });
});

describe("§9 — friend and public visitor", () => {
  it("friend views the personal post", () => {
    expect(decide(engine(), "person-friend", "res-personal-post", "view", "social")).toBe(
      "allow",
    );
  });

  it("public visitor is denied the personal post but allowed the public essay", () => {
    const e = engine();
    expect(decide(e, "person-public", "res-personal-post", "view")).toBe("deny");
    expect(decide(e, "person-public", "res-public-essay", "view", "public")).toBe(
      "allow",
    );
  });
});

describe("§9 — trusted agent pass", () => {
  it("archivist views and exports the memoir with purpose 'archive-organization' = allow", () => {
    const e = engine();
    expect(
      decide(e, "agent-archivist", "res-memoir", "view", "archive-organization"),
    ).toBe("allow");
    expect(
      decide(e, "agent-archivist", "res-memoir", "export", "archive-organization"),
    ).toBe("allow");
  });

  it("archivist is denied the budget", () => {
    expect(
      decide(engine(), "agent-archivist", "res-budget", "view", "archive-organization"),
    ).toBe("deny");
  });

  it("archivist is denied the memoir with the wrong purpose", () => {
    expect(decide(engine(), "agent-archivist", "res-memoir", "view", "social")).toBe(
      "deny",
    );
  });

  it("task completion expires the pass: archivist export of the memoir denies after completeTask", () => {
    const e = engine();
    expect(
      decide(e, "agent-archivist", "res-memoir", "export", "archive-organization"),
    ).toBe("allow");
    const completed = e.completeTask("task-organize-archive", NOW);
    expect(completed.map((g) => g.id)).toEqual(["pass-agent-archive"]);
    expect(completed[0]?.taskCompletedAt).toBe(NOW.toISOString());
    expect(
      decide(e, "agent-archivist", "res-memoir", "export", "archive-organization"),
    ).toBe("deny");
    expect(e.grantsByStatus("expired", NOW).map((g) => g.id)).toContain(
      "pass-agent-archive",
    );
  });
});

describe("§9 — expired pass", () => {
  it("doctor viewing the medical summary with purpose 'second-opinion' = deny (pass expired; treatment grant is purpose-mismatched)", () => {
    expect(
      decide(engine(), "person-doctor", "res-medical-summary", "view", "second-opinion"),
    ).toBe("deny");
  });
});

describe("§9 — revocation is immediate, and purges cached AI context", () => {
  it("revoking g-family-heritage makes the daughter's family-chat view deny at once", () => {
    const e = engine();
    expect(
      decide(e, "person-daughter", "res-family-chat", "view", "family-sharing"),
    ).toBe("allow");
    const revoked = e.revokeGrant("g-family-heritage", NOW);
    expect(revoked?.revokedAt).toBe(NOW.toISOString());
    expect(
      decide(e, "person-daughter", "res-family-chat", "view", "family-sharing"),
    ).toBe("deny");
    expect(e.grantsByStatus("revoked", NOW).map((g) => g.id)).toContain(
      "g-family-heritage",
    );
  });

  it("revocation purges the grantee's ContextCache entries and appends an ai.context.purge sync event", () => {
    const syncLog = new SyncEventLog();
    const cache = new ContextCache();
    cache.set({
      scope: "ai",
      ownerId: DEMO_MEMBER_ID,
      ring: "family",
      subjectId: "person-daughter",
      data: { summary: "cached family context (synthetic)" },
    });
    cache.set({
      scope: "connector",
      ownerId: DEMO_MEMBER_ID,
      ring: "family",
      subjectId: "person-daughter",
      data: { token: "cached connector context (synthetic)" },
    });
    cache.set({
      scope: "ai",
      ownerId: DEMO_MEMBER_ID,
      ring: "friends",
      subjectId: "person-friend",
      data: { summary: "someone else's context (synthetic)" },
    });

    const e = new PolicyEngine(createDemoPolicyState(), {
      syncLog,
      contextCaches: [cache],
    });
    e.revokeGrant("g-family-heritage", NOW);

    // Both of the daughter's entries are gone; the friend's is untouched.
    expect(cache.size).toBe(1);
    expect(cache.has("ai", DEMO_MEMBER_ID, "family", "person-daughter")).toBe(false);
    expect(cache.has("connector", DEMO_MEMBER_ID, "family", "person-daughter")).toBe(
      false,
    );
    expect(cache.has("ai", DEMO_MEMBER_ID, "friends", "person-friend")).toBe(true);

    // Exactly one ai.context.purge event, for the daughter, on the
    // ring of the purged AI entry, versioned from the log itself.
    const purges = syncLog.byType("ai.context.purge");
    expect(purges.length).toBe(1);
    expect(purges[0]?.subjectId).toBe("person-daughter");
    expect(purges[0]?.ring).toBe("family");
    expect(purges[0]?.localVersion).toBe(1);
    expect(purges[0]?.conflictPolicy).toBe("local_wins");

    // And the engine's own audit log records grant-revoked + context-purge.
    const kinds = e.auditLog().map((event) => event.kind);
    expect(kinds).toContain("grant-revoked");
    expect(kinds).toContain("context-purge");
  });
});

describe("§9 — model training is walled off", () => {
  it("friend with purpose TRAINING_PURPOSE is denied view and export of the personal post even though a social grant exists", () => {
    const e = engine();
    expect(decide(e, "person-friend", "res-personal-post", "view", "social")).toBe(
      "allow",
    );
    expect(decide(e, "person-friend", "res-personal-post", "view", TRAINING_PURPOSE)).toBe(
      "deny",
    );
    expect(
      decide(e, "person-friend", "res-personal-post", "export", TRAINING_PURPOSE),
    ).toBe("deny");
  });
});

describe("§9 — no self-escalation", () => {
  const baseGrant: AccessGrant = {
    id: "g-escalation-attempt",
    kind: "grant",
    granteeSubjectId: "person-friend",
    domain: "financial",
    actions: ["view"],
    purpose: "social",
    grantedBy: DEMO_MEMBER_ID,
    grantedAt: "2026-10-27T00:00:00.000Z",
    revokedAt: null,
  };

  it("createGrant with grantedBy = the archivist agent throws (agents can never source grants)", () => {
    const e = engine();
    expect(() =>
      e.createGrant({ ...baseGrant, grantedBy: "agent-archivist" }),
    ).toThrow(/agent/i);
  });

  it("createGrant as a self-grant (grantedBy === grantee) throws", () => {
    const e = engine();
    expect(() =>
      e.createGrant({
        ...baseGrant,
        grantedBy: "person-friend",
        granteeSubjectId: "person-friend",
      }),
    ).toThrow(/itself|self/);
  });

  it("createGrant with malformed scope throws (both grantees set; neither scope set)", () => {
    const e = engine();
    expect(() =>
      e.createGrant({ ...baseGrant, granteeGroupId: "grp-friends" }),
    ).toThrow(/exactly one/);
    const noScope: AccessGrant = {
      id: "g-no-scope",
      kind: "grant",
      granteeSubjectId: "person-friend",
      actions: ["view"],
      purpose: "social",
      grantedBy: DEMO_MEMBER_ID,
      grantedAt: "2026-10-27T00:00:00.000Z",
      revokedAt: null,
    };
    expect(() => e.createGrant(noScope)).toThrow(/at least one/);
  });
});

describe("§9 — deny-by-default", () => {
  it("an unknown action denies (invalid action cast through)", () => {
    const decision = engine().evaluate({
      subjectId: "person-friend",
      resourceId: "res-personal-post",
      action: "delete" as PolicyAction,
      purpose: "social",
      now: NOW,
    });
    expect(decision.decision).toBe("deny");
  });

  it("an unknown resource denies", () => {
    expect(decide(engine(), "person-friend", "res-does-not-exist", "view")).toBe("deny");
  });

  it("an unknown subject denies", () => {
    expect(decide(engine(), "person-ghost", "res-personal-post", "view")).toBe("deny");
  });
});

describe("§9 — registry queries", () => {
  it("grantsByStatus('expired') contains the second-opinion pass; pendingRequests() has the coworker export request", () => {
    const e = engine();
    expect(e.grantsByStatus("expired", NOW).map((g) => g.id)).toContain(
      "pass-doctor-second-opinion",
    );
    expect(e.grantsByStatus("active", NOW).map((g) => g.id)).toContain(
      "g-doctor-medical",
    );
    expect(e.pendingRequests().map((r) => r.id)).toEqual(["req-coworker-export"]);
  });
});

describe("§9 — audit discipline", () => {
  it("evaluate appends audit events; previewAccess does NOT grow the audit log", () => {
    const e = engine();
    expect(e.auditLog().length).toBe(0);
    e.evaluate({
      subjectId: "person-friend",
      resourceId: "res-personal-post",
      action: "view",
      purpose: "social",
      now: NOW,
    });
    expect(e.auditLog().length).toBe(1);
    expect(e.auditLog()[0]?.kind).toBe("evaluation");
    expect(e.auditLog()[0]?.decision).toBe("allow");

    const preview = e.previewAccess("person-friend", NOW);
    expect(preview.length).toBe(createDemoPolicyState().resources.length);
    expect(e.auditLog().length).toBe(1);
  });
});

describe("§9 — legacy directive never-public guard", () => {
  it("with a verified memorialization directive, a public-group grant on a neverPublic domain does not allow", () => {
    const state = createDemoPolicyState();
    const directive = state.legacyDirectives.find((d) => d.memberId === DEMO_MEMBER_ID);
    if (directive === undefined) {
      throw new Error("fixture is missing June's directive");
    }
    directive.memorialization = {
      state: "verified",
      verifiedAt: "2026-10-27T00:00:00.000Z",
    };
    state.grants.push({
      id: "g-public-healthcare",
      kind: "grant",
      granteeGroupId: "grp-public",
      domain: "healthcare",
      actions: ["view"],
      purpose: "public",
      grantedBy: DEMO_MEMBER_ID,
      grantedAt: "2026-10-27T00:00:00.000Z",
      revokedAt: null,
    });
    const e = new PolicyEngine(state);

    // healthcare ∈ neverPublic and the only matching grant is
    // public-scoped → the guard denies.
    expect(decide(e, "person-public", "res-medical-summary", "view", "public")).toBe(
      "deny",
    );
    // The guard closes only the public path: the doctor's ordinary
    // treatment grant still allows.
    expect(
      decide(e, "person-doctor", "res-medical-summary", "view", "treatment"),
    ).toBe("allow");
  });

  it("before verification, the same public grant would allow (guard is directive-state-bound)", () => {
    const state = createDemoPolicyState();
    state.grants.push({
      id: "g-public-healthcare",
      kind: "grant",
      granteeGroupId: "grp-public",
      domain: "healthcare",
      actions: ["view"],
      purpose: "public",
      grantedBy: DEMO_MEMBER_ID,
      grantedAt: "2026-10-27T00:00:00.000Z",
      revokedAt: null,
    });
    const e = new PolicyEngine(state);
    expect(decide(e, "person-public", "res-medical-summary", "view", "public")).toBe(
      "allow",
    );
  });
});
