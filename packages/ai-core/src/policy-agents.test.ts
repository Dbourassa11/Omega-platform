/**
 * @omega/ai-core — Directive §6 policy agents suite (Phase 3C, 4b)
 *
 * Builds an engine over createDemoPolicyState() (fictional member June
 * Calloway + doctor / family / friend / coworker / public /
 * archivist-agent subjects), generates audit history through real
 * evaluations — including denials — and asserts the three scoped
 * capabilities report / propose without ever mutating the engine.
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { PolicyEngine, createDemoPolicyState } from "@omega/policy-engine";

import { AGENT_FABRIC } from "./agents.js";
import {
  POLICY_AGENT_CAPABILITIES,
  runPrivacyGuardian,
  runRelationshipIntelligence,
  runSecurityReview,
} from "./policy-agents.js";

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is AnyRecord =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

function idOf(record: AnyRecord): string {
  const id = record["id"];
  if (typeof id !== "string" || id === "") {
    throw new Error(`record has no string id: ${JSON.stringify(record)}`);
  }
  return id;
}

/** Find a fixture record whose serialized form matches a pattern. */
function findByPattern(
  list: readonly AnyRecord[],
  pattern: RegExp,
  label: string,
): AnyRecord {
  const found = list.find((record) => pattern.test(JSON.stringify(record)));
  if (found === undefined) {
    throw new Error(`demo fixture has no ${label} matching ${pattern}`);
  }
  return found;
}

interface DemoWorld {
  engine: PolicyEngine;
  state: AnyRecord;
  coworkerId: string;
  publicId: string;
  archivistId: string;
  performanceReviewId: string;
  personalPostId: string;
  budgetId: string;
}

function demoWorld(): DemoWorld {
  const engine = new PolicyEngine(createDemoPolicyState());
  const state = engine.snapshot() as unknown as AnyRecord;
  const subjects = records(state["subjects"]);
  const resources = records(state["resources"]);

  const performanceReview =
    resources.find((resource) => resource["id"] === "res-performance-review") ??
    findByPattern(resources, /performance.?review/i, "performance review resource");
  const personalPost = findByPattern(
    resources,
    /personal.*post|post.*personal/i,
    "personal post resource",
  );
  const budget = findByPattern(resources, /budget/i, "budget resource");

  return {
    engine,
    state,
    coworkerId: idOf(findByPattern(subjects, /coworker|colleague/i, "coworker subject")),
    publicId: idOf(findByPattern(subjects, /public/i, "public subject")),
    archivistId: idOf(findByPattern(subjects, /archivist/i, "archivist subject")),
    performanceReviewId: idOf(performanceReview),
    personalPostId: idOf(personalPost),
    budgetId: idOf(budget),
  };
}

/**
 * Generate audit history through real evaluations, including the
 * denials named in the workstream brief: coworker → performance
 * review, public → personal post, archivist → budget. The public
 * subject is denied repeatedly (deny-by-default: it holds no grant to
 * a personal post), which is what the probing flag needs.
 */
function engineWithHistory(): DemoWorld {
  const world = demoWorld();
  const { engine } = world;
  engine.evaluate({
    subjectId: world.coworkerId,
    resourceId: world.performanceReviewId,
    action: "view",
  });
  engine.evaluate({
    subjectId: world.coworkerId,
    resourceId: world.performanceReviewId,
    action: "export",
  });
  engine.evaluate({
    subjectId: world.publicId,
    resourceId: world.personalPostId,
    action: "view",
  });
  engine.evaluate({
    subjectId: world.publicId,
    resourceId: world.personalPostId,
    action: "share",
  });
  engine.evaluate({
    subjectId: world.publicId,
    resourceId: world.personalPostId,
    action: "export",
  });
  engine.evaluate({
    subjectId: world.archivistId,
    resourceId: world.budgetId,
    action: "view",
  });
  return world;
}

function snapshotJson(engine: PolicyEngine): string {
  return JSON.stringify(engine.snapshot());
}

describe("POLICY_AGENT_CAPABILITIES — pure-data directive-§6 bindings", () => {
  it("defines exactly the three scoped capabilities, serializable, fabric untouched", () => {
    expect(POLICY_AGENT_CAPABILITIES.map((c) => c.id)).toEqual([
      "privacy-guardian",
      "security-review",
      "relationship-intelligence",
    ]);
    const roundTripped = JSON.parse(
      JSON.stringify(POLICY_AGENT_CAPABILITIES),
    ) as unknown;
    expect(roundTripped).toEqual(
      JSON.parse(JSON.stringify(POLICY_AGENT_CAPABILITIES)),
    );
    for (const capability of POLICY_AGENT_CAPABILITIES) {
      for (const value of Object.values(capability)) {
        expect(typeof value).not.toBe("function");
      }
    }
    // Privacy Guardian maps to the Consent Guardian family; the other
    // two are new scoped capabilities, NOT canonical fabric agents.
    const guardian = POLICY_AGENT_CAPABILITIES.find(
      (c) => c.id === "privacy-guardian",
    );
    expect(guardian?.fabricAgentId).toBe("guardian");
    for (const capability of POLICY_AGENT_CAPABILITIES) {
      if (capability.id !== "privacy-guardian") {
        expect(capability.fabricAgentId).toBeUndefined();
      }
    }
    expect(AGENT_FABRIC).toHaveLength(8);
  });
});

describe("privacy guardian — conflict report", () => {
  it("flags the coworker grant+denial overlap on res-performance-review", () => {
    const world = engineWithHistory();
    const result = runPrivacyGuardian(world.engine);
    const conflict = result.findings.find(
      (finding) =>
        finding.kind === "grant-denial-conflict" &&
        finding.resourceId === world.performanceReviewId &&
        finding.subjectId === world.coworkerId,
    );
    expect(world.performanceReviewId).toBe("res-performance-review");
    expect(conflict).toBeDefined();
    expect(conflict?.grantId).toBeDefined();
    expect(conflict?.denialId).toBeDefined();
    expect(conflict?.severity).toBeDefined();
  });

  it("carries a receipt with an id and mode offline", () => {
    const world = engineWithHistory();
    const result = runPrivacyGuardian(world.engine);
    expect(result.mode).toBe("offline");
    expect(result.capability).toBe("privacy-guardian");
    expect(result.agentId).toBe("guardian");
    expect(result.receipt.id).toBeTruthy();
    expect(result.receipt.mode).toBe("offline");
    expect(JSON.parse(JSON.stringify(result))).toEqual(
      JSON.parse(JSON.stringify(result)),
    );
  });
});

describe("security review — audit-log review", () => {
  it("counts denials and groups them by subject and resource", () => {
    const world = engineWithHistory();
    const result = runSecurityReview(world.engine);
    expect(result.counts.denied).toBeGreaterThanOrEqual(3);
    expect(result.counts.evaluations).toBe(
      result.counts.allowed + result.counts.denied,
    );
    expect(result.denialsBySubject[world.publicId]).toBeGreaterThanOrEqual(2);
    expect(
      result.denialsByResource[world.personalPostId],
    ).toBeGreaterThanOrEqual(2);
    expect(result.denialsByResource[world.performanceReviewId]).toBeDefined();
  });

  it("flags a repeat-denial subject (>= 2 denials) as potential permission probing", () => {
    const world = engineWithHistory();
    const result = runSecurityReview(world.engine);
    const probing = result.findings.filter(
      (finding) => finding.kind === "potential-permission-probing",
    );
    expect(probing.length).toBeGreaterThanOrEqual(1);
    expect(
      probing.some(
        (finding) =>
          finding.subjectId === world.publicId &&
          (finding.count ?? 0) >= 2,
      ),
    ).toBe(true);
    expect(result.receipt.id).toBeTruthy();
    expect(result.mode).toBe("offline");
    expect(result.receipt.mode).toBe("offline");
  });
});

describe("relationship intelligence — proposals only", () => {
  it("returns >= 1 proposal, with the pending coworker export request as a decide-proposal", () => {
    const world = engineWithHistory();
    const requests = records(world.state["requests"]);
    const pendingCoworkerExport = requests.find((request) => {
      const text = JSON.stringify(request).toLowerCase();
      const status = String(request["status"] ?? "").toLowerCase();
      const pending =
        status === "" ||
        status.includes("pending") ||
        status.includes("awaiting") ||
        status === "requested" ||
        status === "open";
      return (
        pending &&
        text.includes(world.coworkerId.toLowerCase()) &&
        text.includes("export")
      );
    });
    expect(
      pendingCoworkerExport,
      "demo fixture must carry a pending coworker export request",
    ).toBeDefined();

    const result = runRelationshipIntelligence(world.engine);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const decide = result.findings.find(
      (proposal) =>
        proposal.kind === "decide-request" &&
        pendingCoworkerExport !== undefined &&
        proposal.requestId === idOf(pendingCoworkerExport),
    );
    expect(decide).toBeDefined();
    expect(result.receipt.id).toBeTruthy();
    expect(result.mode).toBe("offline");
  });
});

describe("hard rule — running all three capabilities mutates nothing", () => {
  it("leaves engine state, audit history, and evaluation outcomes byte-identical", () => {
    const world = engineWithHistory();
    const { engine } = world;
    const probe = {
      subjectId: world.coworkerId,
      resourceId: world.performanceReviewId,
      action: "view",
    } as const;

    const snapshotBefore = snapshotJson(engine);
    const probeBefore = engine.evaluate({ ...probe });
    const auditLengthBefore = engine.auditLog().length;
    // evaluate() itself appends audit events by design; the state
    // snapshot is the policy state the capabilities must not change.
    const snapshotAfterProbe = snapshotJson(engine);
    expect(snapshotAfterProbe).toBe(snapshotBefore);

    const guardian = runPrivacyGuardian(engine);
    const security = runSecurityReview(engine);
    const relationship = runRelationshipIntelligence(engine);
    expect(guardian.receipt.mode).toBe("offline");
    expect(security.receipt.mode).toBe("offline");
    expect(relationship.receipt.mode).toBe("offline");

    // No new audit events were created by the reporting pass.
    expect(engine.auditLog().length).toBe(auditLengthBefore);
    // State is byte-identical (deep-equal via canonical JSON).
    const snapshotAfter = snapshotJson(engine);
    expect(snapshotAfter).toBe(snapshotBefore);
    expect(JSON.parse(snapshotAfter)).toEqual(JSON.parse(snapshotBefore));

    // A probe evaluate returns the same decision, byte-identical on
    // the decision-bearing fields.
    const probeAfter = engine.evaluate({ ...probe });
    expect(probeAfter.decision).toBe(probeBefore.decision);
    expect(probeAfter.reason).toBe(probeBefore.reason);
    expect(probeAfter.matchedGrantId).toBe(probeBefore.matchedGrantId);
    expect(probeAfter.matchedDenialId).toBe(probeBefore.matchedDenialId);
  });
});
