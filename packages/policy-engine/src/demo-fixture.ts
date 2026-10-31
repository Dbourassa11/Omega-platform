/**
 * @omega/policy-engine — demo fixture
 *
 * A fully fictional policy state for one member, June Calloway,
 * used by the §9 security-test matrix and the Phase 3C demo. Every
 * display name and summary that represents a record carries
 * "(synthetic)" labeling: no real person's data appears here.
 *
 * Creator: David Charles Bourassa
 */

import type {
  AccessDenial,
  AccessGrant,
  AccessRequest,
  LegacyDirective,
  PolicyResource,
  PolicyState,
  PolicySubject,
  RelationshipGroup,
} from "./index.js";

export const DEMO_MEMBER_ID = "member-june";

const GRANTED_AT = "2026-01-15T00:00:00.000Z";

function demoSubjects(): PolicySubject[] {
  return [
    { id: DEMO_MEMBER_ID, kind: "person", displayName: "June Calloway (synthetic)" },
    {
      id: "person-doctor",
      kind: "person",
      displayName: "Dr. Priya Nair — healthcare provider (synthetic)",
    },
    {
      id: "person-daughter",
      kind: "person",
      displayName: "Maya Calloway — family member (synthetic)",
    },
    {
      id: "person-friend",
      kind: "person",
      displayName: "Sam Reyes — friend (synthetic)",
    },
    {
      id: "person-coworker",
      kind: "person",
      displayName: "Tom Becker — coworker (synthetic)",
    },
    { id: "person-public", kind: "person", displayName: "Public visitor" },
    { id: "agent-archivist", kind: "agent", displayName: "Digital Archivist Agent" },
  ];
}

function demoGroups(): RelationshipGroup[] {
  return [
    {
      id: "grp-family",
      type: "family",
      name: "Family (synthetic)",
      memberIds: ["person-daughter"],
    },
    {
      id: "grp-friends",
      type: "friends",
      name: "Friends (synthetic)",
      memberIds: ["person-friend"],
    },
    {
      id: "grp-work",
      type: "work",
      name: "Work (synthetic)",
      memberIds: ["person-coworker"],
    },
    {
      id: "grp-healthcare",
      type: "healthcare-providers",
      name: "Healthcare providers (synthetic)",
      memberIds: ["person-doctor"],
    },
    {
      id: "grp-public",
      type: "public",
      name: "Public",
      memberIds: ["person-public"],
    },
    {
      id: "grp-trusted-agents",
      type: "trusted-agents",
      name: "Trusted agents (synthetic)",
      memberIds: ["agent-archivist"],
    },
  ];
}

function demoResources(): PolicyResource[] {
  const ownerId = DEMO_MEMBER_ID;
  return [
    {
      id: "res-profile",
      ownerId,
      domain: "identity",
      title: "Profile and contact details (synthetic)",
      summary: "June Calloway's public-facing profile and contact details (synthetic).",
      sensitivity: "internal",
    },
    {
      id: "res-medical-summary",
      ownerId,
      domain: "healthcare",
      title: "Medical summary (synthetic)",
      summary: "A clinician-written summary of conditions and care plans (synthetic).",
      sensitivity: "restricted",
    },
    {
      id: "res-prescriptions",
      ownerId,
      domain: "healthcare",
      title: "Prescription list (synthetic)",
      summary: "Current prescriptions and refill history (synthetic).",
      sensitivity: "restricted",
    },
    {
      id: "res-family-chat",
      ownerId,
      domain: "family-heritage",
      title: "Family group chat archive (synthetic)",
      summary: "Years of family group-chat messages (synthetic).",
      sensitivity: "sensitive",
    },
    {
      id: "res-heritage-photos",
      ownerId,
      domain: "family-heritage",
      title: "Heritage photo collection (synthetic)",
      summary: "Scanned family photographs across three generations (synthetic).",
      sensitivity: "sensitive",
    },
    {
      id: "res-personal-post",
      ownerId,
      domain: "social",
      title: "Personal post (synthetic)",
      summary: "A personal post shared with friends only (synthetic).",
      sensitivity: "internal",
    },
    {
      id: "res-public-essay",
      ownerId,
      domain: "public-released",
      title: "Public essay (synthetic)",
      summary: "An essay June released publicly (synthetic).",
      sensitivity: "public",
    },
    {
      id: "res-project-plan",
      ownerId,
      domain: "employment",
      title: "Project Halcyon plan (synthetic)",
      summary: "Roadmap and milestones for Project Halcyon (synthetic).",
      sensitivity: "internal",
    },
    {
      id: "res-performance-review",
      ownerId,
      domain: "employment",
      title: "Performance review (synthetic)",
      summary: "June's most recent performance review (synthetic).",
      sensitivity: "restricted",
    },
    {
      id: "res-budget",
      ownerId,
      domain: "financial",
      title: "Household budget (synthetic)",
      summary: "Household budget, accounts overview, and savings goals (synthetic).",
      sensitivity: "restricted",
    },
    {
      id: "res-patent",
      ownerId,
      domain: "intellectual-property",
      title: "Patent draft (synthetic)",
      summary: "Draft patent application for a water-filter mechanism (synthetic).",
      sensitivity: "sensitive",
    },
    {
      id: "res-novel",
      ownerId,
      domain: "intellectual-property",
      title: "Novel manuscript (synthetic)",
      summary: "The unpublished manuscript of June's novel (synthetic).",
      sensitivity: "sensitive",
    },
    {
      id: "res-agent-history",
      ownerId,
      domain: "ai-agents",
      title: "AI agent interaction history (synthetic)",
      summary: "History of June's interactions with her AI agents (synthetic).",
      sensitivity: "internal",
    },
    {
      id: "res-memoir",
      ownerId,
      domain: "legacy",
      title: "Memoir draft (synthetic)",
      summary: "June's memoir draft, kept in the legacy vault (synthetic).",
      sensitivity: "sensitive",
    },
  ];
}

function demoGrants(): AccessGrant[] {
  const grantedBy = DEMO_MEMBER_ID;
  return [
    {
      id: "g-doctor-medical",
      kind: "grant",
      granteeGroupId: "grp-healthcare",
      domain: "healthcare",
      actions: ["view"],
      purpose: "treatment",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-family-heritage",
      kind: "grant",
      granteeGroupId: "grp-family",
      domain: "family-heritage",
      actions: ["view", "comment"],
      purpose: "family-sharing",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-family-legacy",
      kind: "grant",
      granteeGroupId: "grp-family",
      domain: "legacy",
      actions: ["view"],
      purpose: "heritage",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-friends-social",
      kind: "grant",
      granteeGroupId: "grp-friends",
      domain: "social",
      actions: ["view", "comment"],
      purpose: "social",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-work-employment",
      kind: "grant",
      granteeGroupId: "grp-work",
      domain: "employment",
      actions: ["view"],
      purpose: "employment",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-work-project",
      kind: "grant",
      granteeGroupId: "grp-work",
      resourceId: "res-project-plan",
      actions: ["view", "contribute", "comment"],
      purpose: "project-halcyon",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-public-released",
      kind: "grant",
      granteeGroupId: "grp-public",
      domain: "public-released",
      actions: ["view"],
      purpose: "public",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "g-public-profile",
      kind: "grant",
      granteeGroupId: "grp-public",
      resourceId: "res-profile",
      actions: ["view"],
      purpose: "public",
      grantedBy,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    },
    {
      id: "pass-agent-archive",
      kind: "pass",
      granteeSubjectId: "agent-archivist",
      domain: "legacy",
      actions: ["view", "export"],
      purpose: "archive-organization",
      grantedBy,
      grantedAt: GRANTED_AT,
      expiresAt: "2099-01-01T00:00:00.000Z",
      taskId: "task-organize-archive",
      taskCompletedAt: null,
      revokedAt: null,
    },
    {
      id: "pass-doctor-second-opinion",
      kind: "pass",
      granteeSubjectId: "person-doctor",
      resourceId: "res-medical-summary",
      actions: ["view"],
      purpose: "second-opinion",
      grantedBy,
      grantedAt: "2019-12-01T00:00:00.000Z",
      expiresAt: "2020-01-01T00:00:00.000Z",
      revokedAt: null,
    },
  ];
}

function demoDenials(): AccessDenial[] {
  return [
    {
      id: "d-coworker-review",
      subjectId: "person-coworker",
      resourceId: "res-performance-review",
      reason:
        "Individual restriction set by the member — performance review is private even within the work group",
      createdBy: DEMO_MEMBER_ID,
      createdAt: GRANTED_AT,
    },
  ];
}

function demoRequests(): AccessRequest[] {
  return [
    {
      id: "req-coworker-export",
      subjectId: "person-coworker",
      resourceId: "res-project-plan",
      actions: ["export"],
      purpose: "project-halcyon",
      requestedAt: "2026-10-20T00:00:00.000Z",
      status: "pending",
    },
  ];
}

function juneLegacyDirective(): LegacyDirective {
  return {
    memberId: DEMO_MEMBER_ID,
    lifetimeSummary:
      "During June's lifetime, her legacy materials may be summarized for her designated stewards to support continuity planning (synthetic directive).",
    postDeathSummary:
      "After June's death is verified, her memoir and heritage materials may be summarized for family stewards; healthcare, financial, and family-heritage records are never released publicly (synthetic directive).",
    neverPublic: ["healthcare", "financial", "family-heritage"],
    stewards: ["person-daughter"],
    memorialization: { state: "not-started" },
    continuityAuthorizations: [
      {
        projectId: "project-novel-manuscript",
        projectTitle: "Novel manuscript (synthetic)",
        stewardId: "person-daughter",
        scope:
          "The steward may prepare the novel manuscript for posthumous publication, including copy-editing and chapter ordering.",
        attributionRule:
          "The original manuscript is June Calloway's work and is credited to her alone; any subsequent work by the steward (editing, completion of unfinished chapters, new material) must be credited as the steward's subsequent work, never presented as June's original writing.",
      },
    ],
    simulationDisclosure:
      "Mirror responses are simulations generated from archived materials. They are not June Calloway's statements, not her words spoken anew, and not evidence of her continuing consciousness.",
  };
}

function eliasLegacyDirective(): LegacyDirective {
  return {
    memberId: "elias-marlowe",
    lifetimeSummary:
      "During Elias Marlowe's lifetime, Garden archive materials may be summarized only for Elias and his designated stewards.",
    postDeathSummary:
      "After Elias Marlowe's death is verified, Garden archive materials may be summarized for his stewards in accordance with the archive's provenance records; healthcare and financial records are never released publicly.",
    neverPublic: ["healthcare", "financial"],
    stewards: [],
    memorialization: { state: "not-started" },
    continuityAuthorizations: [],
    simulationDisclosure:
      "Any Mirror-style response drawn from the Eternal Garden archive is a simulated reflection assembled from archived records, presented with its provenance — it is not Elias Marlowe's statement, not his literal voice, and not evidence of continuing consciousness.",
  };
}

/**
 * The legacy directive for Elias Marlowe, the member whose archive
 * the Eternal Garden preserves — exported for the Garden archive
 * surface. Treat as read-only; `createDemoPolicyState` embeds a
 * deep copy, never this object.
 */
export const ELIAS_LEGACY_DIRECTIVE: LegacyDirective = eliasLegacyDirective();

/**
 * A fresh demo policy state for June Calloway. Every call builds
 * new objects all the way down — mutating one returned state never
 * affects another, or the exported ELIAS_LEGACY_DIRECTIVE.
 */
export function createDemoPolicyState(): PolicyState {
  return {
    subjects: demoSubjects(),
    groups: demoGroups(),
    resources: demoResources(),
    grants: demoGrants(),
    denials: demoDenials(),
    requests: demoRequests(),
    legacyDirectives: [juneLegacyDirective(), eliasLegacyDirective()],
  };
}
