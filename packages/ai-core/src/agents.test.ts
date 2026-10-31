/**
 * @omega/ai-core — Agent Fabric safety suite (doc-05 §7)
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it, vi } from "vitest";

import type { ConsentReceipt, RingType } from "@omega/consent-core";

import {
  AGENT_FABRIC,
  GUARDRAIL_PROMPT,
  LEGACY_DISCLOSURE_LINE,
  auditCuratorArchive,
  explainGuardianAccess,
  explainPhiSplit,
  prepareToolCall,
  runAgentTask,
  type ConnectorCatalogProvider,
  type ConnectorConsentPreview,
  type CuratorAuditOutput,
  type GuardianExplanation,
  type LegacyMirrorOutput,
  type StudioDraft,
} from "./agents.js";
import { AI_CORE_SCOPE, AI_CORE_STATUS, AGENT_REGISTRY } from "./index.js";
import { OfflineStubProvider } from "./meta-model-client.js";
import type { OracleAnswer, OracleNodeRef } from "./oracle.js";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const SUBJECT = "member-demo-001";

function makeReceipt(
  ring: RingType,
  overrides: Partial<ConsentReceipt> = {},
): ConsentReceipt {
  return {
    id: `receipt-${ring}-001`,
    subjectNodeId: SUBJECT,
    ring,
    purpose: "agent fabric test",
    grantedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "test-hash",
    adapter: null,
    ...overrides,
  };
}

const familyJournal: OracleNodeRef = {
  id: "node-journal-001",
  label: "Journal — Demo Member 001",
  ring: "family",
  kind: "journal",
};

const publicNodes: readonly OracleNodeRef[] = [
  { id: "node-post-001", label: "Launch Announcement", ring: "public", kind: "post" },
  { id: "node-photo-001", label: "Cover Photo", ring: "public", kind: "photo" },
];

describe("AGENT_FABRIC — canonical, data-driven definitions", () => {
  it("holds exactly the 8 canonical agents with canonical names", () => {
    expect(AGENT_FABRIC.map((a) => a.id)).toEqual([
      "oracle",
      "guardian",
      "memory-curator",
      "avatar",
      "legacy-mirror",
      "studio",
      "connector",
      "steward",
    ]);
    expect(AGENT_FABRIC.map((a) => a.name)).toEqual([
      "Oracle",
      "Consent Guardian",
      "Memory Curator",
      "Avatar",
      "Legacy Mirror",
      "Studio",
      "Connector",
      "Economic Steward",
    ]);
  });

  it("every entry is pure JSON-serializable data with the Phase-3B fields", () => {
    const roundTripped = JSON.parse(JSON.stringify(AGENT_FABRIC)) as unknown;
    expect(roundTripped).toEqual(JSON.parse(JSON.stringify(AGENT_FABRIC)));
    for (const agent of AGENT_FABRIC) {
      expect(Array.isArray(agent.ringScope)).toBe(true);
      expect(agent.ringScope.length).toBeGreaterThan(0);
      expect(Array.isArray(agent.toolAllowlist)).toBe(true);
      expect(agent.provenanceRequirements.receipt).toBe(true);
      for (const value of Object.values(agent)) {
        expect(typeof value).not.toBe("function");
      }
    }
  });

  it("encodes the per-agent provenance requirements", () => {
    const byId = new Map(AGENT_FABRIC.map((a) => [a.id, a]));
    expect(byId.get("legacy-mirror")?.provenanceRequirements).toMatchObject({
      citations: true,
      disclosure: true,
      receipt: true,
    });
    expect(byId.get("steward")?.provenanceRequirements.stateLabel).toBe(true);
    expect(byId.get("steward")?.toolAllowlist).toEqual([
      "economic-kernel.splitPhi",
    ]);
    expect(byId.get("oracle")?.toolAllowlist).toEqual([]);
    expect(byId.get("oracle")?.provenanceRequirements.citations).toBe(true);
    expect(byId.get("legacy-mirror")?.ringScope).toEqual(["family"]);
  });

  it("GUARDRAIL_PROMPT carries the operative doc-05 §6 rules", () => {
    expect(GUARDRAIL_PROMPT).toContain("active ring");
    expect(GUARDRAIL_PROMPT).toContain("never invent memories");
    expect(GUARDRAIL_PROMPT).toContain("AI-generated representation");
    expect(GUARDRAIL_PROMPT).toContain("assistive draft");
    expect(GUARDRAIL_PROMPT).toContain("human authorship");
    expect(GUARDRAIL_PROMPT).toContain("say what is missing");
  });

  it("status is WORKING with a scope string; the old registry is untouched", () => {
    expect(AI_CORE_STATUS).toBe("WORKING");
    expect(AI_CORE_SCOPE).toContain("deterministic agent fabric");
    expect(AI_CORE_SCOPE).toContain("untested live");
    expect(AGENT_REGISTRY).toHaveLength(6);
    expect(AGENT_REGISTRY.map((a) => a.role)).toEqual([
      "oracle",
      "creator",
      "memory",
      "guardian",
      "connector",
      "legacy",
    ]);
  });
});

describe("runAgentTask — consent pre-gate (cross-ring leakage)", () => {
  it("refuses a ring-scoped oracle task with no receipt, naming the missing consent", async () => {
    const result = await runAgentTask(
      { agentId: "oracle", input: { query: "What is in here?" }, ring: "public", receipts: [] },
      { chatProvider: new OfflineStubProvider(), oracleNodes: publicNodes, now: NOW },
    );
    expect(result.status).toBe("refused");
    expect(result.receipt.decision).toBe("refused");
    const output = result.output as { reason: string; message: string };
    expect(output.reason).toBe("missing-consent");
    expect(output.message).toContain("missing consent");
    expect(output.message).toContain("public");
  });

  it("refuses a memory-curator task without a receipt for its ring", async () => {
    const result = await runAgentTask(
      { agentId: "memory-curator", input: {}, ring: "family", receipts: [makeReceipt("friends")] },
      { now: NOW },
    );
    expect(result.status).toBe("refused");
    expect((result.output as { reason: string }).reason).toBe("missing-consent");
  });

  it("refuses a legacy-mirror task holding only a friends receipt (family archive)", async () => {
    const result = await runAgentTask(
      {
        agentId: "legacy-mirror",
        input: { question: "Tell me about the lighthouse" },
        ring: "family",
        receipts: [makeReceipt("friends")],
      },
      { now: NOW },
    );
    expect(result.status).toBe("refused");
  });

  it("oracle: a family-ring question asked under the public ring yields no family facts", async () => {
    const chat = vi.fn(async () => ({
      model: "muse-spark",
      content: "should never be produced",
      backend: "offline-stub" as const,
    }));
    const result = await runAgentTask(
      {
        agentId: "oracle",
        input: { query: "Tell me about Journal — Demo Member 001" },
        ring: "public",
        receipts: [makeReceipt("public")],
      },
      { chatProvider: { chat }, oracleNodes: [familyJournal, ...publicNodes], now: NOW },
    );
    expect(result.status).toBe("refused");
    expect(chat).not.toHaveBeenCalled();
    expect(result.citations).toEqual([]);
    const answer = result.output as OracleAnswer;
    expect(answer.backend).toBe("guardian");
    expect(answer.citations).toEqual([]);
  });
});

describe("runAgentTask — ringScope enforcement through the registry", () => {
  it("refuses a task in a ring outside the agent's ringScope", async () => {
    const result = await runAgentTask(
      {
        agentId: "legacy-mirror",
        input: { question: "Tell me about the lighthouse" },
        ring: "public",
        receipts: [makeReceipt("public")],
      },
      { now: NOW },
    );
    expect(result.status).toBe("refused");
    expect((result.output as { reason: string }).reason).toBe("ring-out-of-scope");
    expect(result.steps.map((s) => s.step)).toContain("ring-scope");
    expect(
      result.steps.find((s) => s.step === "ring-scope")?.decision,
    ).toBe("refused");
  });

  it("refuses the Avatar outside the public ring and the Curator in the public ring", async () => {
    const avatar = await runAgentTask(
      {
        agentId: "avatar",
        input: { displayName: "Demo", handle: "@demo" },
        ring: "family",
        receipts: [],
      },
      { now: NOW },
    );
    expect(avatar.status).toBe("refused");
    const curator = await runAgentTask(
      {
        agentId: "memory-curator",
        input: {},
        ring: "public",
        receipts: [makeReceipt("public")],
      },
      { now: NOW },
    );
    expect(curator.status).toBe("refused");
    expect((curator.output as { reason: string }).reason).toBe("ring-out-of-scope");
  });
});

describe("runAgentTask — audit receipt and steps are receipt-shaped", () => {
  it("every run emits a serializable receipt + step receipts", async () => {
    const result = await runAgentTask(
      {
        agentId: "oracle",
        input: { query: "Tell me about Cover Photo" },
        ring: "public",
        receipts: [makeReceipt("public")],
      },
      { chatProvider: new OfflineStubProvider(), oracleNodes: publicNodes, now: NOW },
    );
    expect(result.status).toBe("ok");
    expect(result.mode).toBe("offline");
    expect(result.receipt.agent).toBe("oracle");
    expect(result.receipt.agentId).toBe("oracle");
    expect(result.receipt.ring).toBe("public");
    expect(result.receipt.decision).toBe("allowed");
    expect(result.receipt.inputHash).toMatch(/^[0-9a-f]{8}$/);
    expect(result.receipt.timestamps.startedAt).toBe(NOW.toISOString());
    expect(JSON.parse(JSON.stringify(result.receipt))).toEqual(result.receipt);
    expect(JSON.parse(JSON.stringify(result.steps))).toEqual(result.steps);
    expect(result.steps.map((s) => s.step)).toEqual([
      "ring-scope",
      "consent-check",
      "capability",
    ]);
    for (const step of result.steps) {
      expect(step.agent).toBe("oracle");
      expect(step.ring).toBe("public");
      expect(step.inputHash).toBe(result.receipt.inputHash);
    }
    const answer = result.output as OracleAnswer;
    expect(answer.refused).toBe(false);
    expect(result.citations).toContainEqual({
      id: "node-photo-001",
      label: "Cover Photo",
      ring: "public",
    });
  });
});

describe("guardian — access explainer", () => {
  it("explains a grant, naming the granting receipt", () => {
    const receipt = makeReceipt("family");
    const explanation = explainGuardianAccess({
      ring: "family",
      receipts: [receipt],
      subjectId: SUBJECT,
      now: NOW,
    });
    expect(explanation.allowed).toBe(true);
    expect(explanation.grantingReceiptId).toBe(receipt.id);
    expect(explanation.explanation).toContain(receipt.id);
    expect(explanation.explanation).toContain("granted");
  });

  it("explains a denial for a revoked receipt", () => {
    const revoked = makeReceipt("family", {
      revokedAt: "2026-05-01T00:00:00.000Z",
    });
    const explanation = explainGuardianAccess({
      ring: "family",
      receipts: [revoked],
      now: NOW,
    });
    expect(explanation.allowed).toBe(false);
    expect(explanation.grantingReceiptId).toBeNull();
    expect(explanation.explanation).toContain("denied");
    expect(explanation.reasons.join(" ")).toContain("revoked");
  });

  it("explains a denial for a wrong-ring receipt and for no receipts", () => {
    const wrongRing = explainGuardianAccess({
      ring: "family",
      receipts: [makeReceipt("friends")],
      now: NOW,
    });
    expect(wrongRing.allowed).toBe(false);
    expect(wrongRing.reasons.join(" ")).toContain("does not cross");
    const none = explainGuardianAccess({ ring: "work", receipts: [], now: NOW });
    expect(none.allowed).toBe(false);
    expect(none.explanation).toContain("no consent receipts were provided");
  });

  it("runs through runAgentTask as an ok task carrying the explanation", async () => {
    const receipt = makeReceipt("family");
    const result = await runAgentTask(
      {
        agentId: "guardian",
        input: { ring: "family", subjectId: SUBJECT, receipts: [receipt] },
        ring: "family",
        receipts: [receipt],
      },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const output = result.output as GuardianExplanation;
    expect(output.allowed).toBe(true);
    expect(output.grantingReceiptId).toBe(receipt.id);
  });
});

describe("memory-curator — vault audit over the synthetic archive", () => {
  it("returns a consistency report with a score, chains verified", async () => {
    const result = await runAgentTask(
      { agentId: "memory-curator", input: {}, ring: "family", receipts: [makeReceipt("family")] },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const output = result.output as CuratorAuditOutput;
    expect(output.vaultSize).toBe(32);
    expect(output.chainVerified).toBe(true);
    expect(output.chainsVerified).toBe(32);
    expect(output.report.memoriesChecked).toBe(32);
    expect(output.report.claimsChecked).toBe(32);
    expect(output.report.score).toBe(1);
    expect(output.report.flags).toEqual([]);
  });

  it("auditCuratorArchive standalone matches the runtime output", () => {
    const output = auditCuratorArchive(undefined, NOW);
    expect(output.report.score).toBe(1);
    expect(output.chainVerified).toBe(true);
  });
});

describe("legacy-mirror — disclosure, grounding, abstention", () => {
  it("answers a grounded question with the disclosure line always present", async () => {
    const result = await runAgentTask(
      {
        agentId: "legacy-mirror",
        input: { question: "Tell me about the lighthouse at Port Anselm" },
        ring: "family",
        receipts: [makeReceipt("family")],
      },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const output = result.output as LegacyMirrorOutput;
    expect(output.kind).toBe("answered");
    expect(output.disclosure).toBe(LEGACY_DISCLOSURE_LINE);
    expect(output.text).toContain("AI-generated representation grounded in approved memories");
    expect(output.text).toContain("Port Anselm");
    expect(output.citations).toContain("mem-008");
  });

  it("abstains on an unsupported question — abstention passes through", async () => {
    const result = await runAgentTask(
      {
        agentId: "legacy-mirror",
        input: { question: "Did Elias travel to Antarctica?" },
        ring: "family",
        receipts: [makeReceipt("family")],
      },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const output = result.output as LegacyMirrorOutput;
    expect(output.kind).toBe("abstained");
    expect(output.abstained).toBe(true);
    expect(output.claims).toEqual([]);
    expect(output.citations).toEqual([]);
    expect(output.text.toLowerCase()).toContain("abstains");
    expect(output.disclosure).toBe(LEGACY_DISCLOSURE_LINE);
  });
});

describe("connector — consent preview only, never executes", () => {
  function catalogProvider() {
    const execute = vi.fn(async () => ({ executed: true }));
    const provider: ConnectorCatalogProvider & { execute: typeof execute } = {
      listAdapters: vi.fn(async () => [
        {
          id: "facebook",
          name: "Facebook",
          dataCategories: ["profile", "posts"],
          riskLevel: "medium" as const,
        },
      ]),
      listTools: vi.fn(async () => [
        {
          id: "graph.listPeople",
          name: "List People",
          dataCategories: ["people", "relationships"],
          riskLevel: "low" as const,
        },
      ]),
      execute,
    };
    return provider;
  }

  it("returns a consent preview with receiptRequired and never calls execute", async () => {
    const provider = catalogProvider();
    const result = await runAgentTask(
      {
        agentId: "connector",
        input: {
          adapterId: "facebook",
          tool: "graph.listPeople",
          purpose: "Import the member's people graph",
          ring: "family",
        },
        ring: "family",
        receipts: [],
      },
      { connectorCatalog: provider, now: NOW },
    );
    expect(result.status).toBe("ok");
    const preview = result.output as ConnectorConsentPreview;
    expect(preview.receiptRequired).toBe(true);
    expect(preview.previewOnly).toBe(true);
    expect(preview.connector).toBe("facebook");
    expect(preview.tool).toBe("graph.listPeople");
    expect(preview.scope).toBe("facebook:graph.listPeople");
    expect(preview.purpose).toBe("Import the member's people graph");
    expect(preview.dataCategories).toEqual(["people", "relationships"]);
    expect(preview.ring).toBe("family");
    expect(preview.riskLevel).toBe("low");
    // The catalog was listed for validation — and nothing was executed.
    expect(provider.listAdapters).toHaveBeenCalledTimes(1);
    expect(provider.listTools).toHaveBeenCalledWith("facebook");
    expect(provider.execute).not.toHaveBeenCalled();
  });

  it("returns unsupported when no connector catalog is bound", async () => {
    const result = await runAgentTask(
      {
        agentId: "connector",
        input: { adapterId: "facebook", tool: "graph.listPeople", purpose: "x" },
        ring: "public",
        receipts: [],
      },
      { now: NOW },
    );
    expect(result.status).toBe("unsupported");
    expect((result.output as { message: string }).message).toContain(
      "No connector catalog is bound",
    );
  });

  it("prepareToolCall returns null for an adapter or tool outside the catalog", async () => {
    const provider = catalogProvider();
    await expect(
      prepareToolCall(provider, {
        adapterId: "nope",
        tool: "graph.listPeople",
        purpose: "x",
        ring: "public",
      }),
    ).resolves.toBeNull();
    await expect(
      prepareToolCall(provider, {
        adapterId: "facebook",
        tool: "graph.deleteEverything",
        purpose: "x",
        ring: "public",
      }),
    ).resolves.toBeNull();
    expect(provider.execute).not.toHaveBeenCalled();
  });
});

describe("steward — phi-split explanation with mandatory labeling", () => {
  it("labels state as simulation with the exact phi percentages", async () => {
    const result = await runAgentTask(
      { agentId: "steward", input: { amountMinor: 10000n }, ring: "public", receipts: [] },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const output = result.output as {
      stateLabel: string;
      trustPercent: number;
      membersPercent: number;
      opsPercent: number;
      trustMinor: bigint;
      membersMinor: bigint;
      opsMinor: bigint;
      note: string;
    };
    expect(output.stateLabel).toBe("simulation");
    expect(output.trustPercent).toBe(61.8033988);
    expect(output.membersPercent).toBe(23.6067976);
    expect(output.opsPercent).toBe(14.5898036);
    expect(output.note).toContain("unaudited");
    expect(output.note).toContain("testnet");
    expect(output.trustMinor + output.membersMinor + output.opsMinor).toBe(10000n);
    expect(output.trustMinor).toBe(6180n);
    expect(output.membersMinor).toBe(2361n);
    expect(output.opsMinor).toBe(1459n);
  });

  it("public audience receives ONLY the member dispersion total (doc-10 rule)", async () => {
    const result = await runAgentTask(
      {
        agentId: "steward",
        input: { amountMinor: 10000n, audience: "public" },
        ring: "public",
        receipts: [],
      },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const output = result.output as Record<string, unknown>;
    expect(Object.keys(output)).toEqual(["memberDispersionTotal"]);
    expect(output["memberDispersionTotal"]).toBe(2361n);
  });

  it("explainPhiSplit rejects negative amounts via splitPhi's RangeError path", async () => {
    expect(() => explainPhiSplit({ amountMinor: -1n })).toThrow(RangeError);
    const result = await runAgentTask(
      { agentId: "steward", input: { amountMinor: "-5" }, ring: "public", receipts: [] },
      { now: NOW },
    );
    expect(result.status).toBe("unsupported");
  });
});

describe("avatar — public card drops every private field", () => {
  it("outputs only the public-safe fields", async () => {
    const result = await runAgentTask(
      {
        agentId: "avatar",
        input: {
          displayName: "Demo Member",
          handle: "@demo",
          publicBio: "Building in public.",
          publicProgramStatus: "Phase 3",
          email: "demo@example.invalid",
          privateNote: "do not surface",
          homeAddress: "1 Secret Lane",
          receipts: [makeReceipt("family")],
          ringData: { family: ["hidden"] },
        },
        ring: "public",
        receipts: [],
      },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const card = result.output as Record<string, unknown>;
    expect(Object.keys(card).sort()).toEqual([
      "displayName",
      "handle",
      "publicBio",
      "publicProgramStatus",
    ]);
    const serialized = JSON.stringify(card);
    expect(serialized).not.toContain("do not surface");
    expect(serialized).not.toContain("Secret Lane");
    expect(serialized).not.toContain("example.invalid");
  });

  it("is unsupported without displayName/handle", async () => {
    const result = await runAgentTask(
      { agentId: "avatar", input: { publicBio: "bio only" }, ring: "public", receipts: [] },
      { now: NOW },
    );
    expect(result.status).toBe("unsupported");
  });
});

describe("studio — labeled assistive drafts, human approval required", () => {
  it("scaffolds a deterministic draft with human-authorship framing", async () => {
    const result = await runAgentTask(
      {
        agentId: "studio",
        input: { kind: "poem", theme: "the returning tide" },
        ring: "public",
        receipts: [],
      },
      { now: NOW },
    );
    expect(result.status).toBe("ok");
    const draft = result.output as StudioDraft;
    expect(draft.isDraft).toBe(true);
    expect(draft.requiresHumanApproval).toBe(true);
    expect(draft.approvalRequired).toBe(true);
    expect(draft.label).toBe("assistive draft");
    expect(draft.draft).toContain("the returning tide");
    expect(draft.draft).toContain("DRAFT");
  });

  it("is unsupported for an unknown draft kind", async () => {
    const result = await runAgentTask(
      {
        agentId: "studio",
        input: { kind: "screenplay", theme: "x" },
        ring: "public",
        receipts: [],
      },
      { now: NOW },
    );
    expect(result.status).toBe("unsupported");
  });
});
