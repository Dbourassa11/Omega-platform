import { describe, expect, it } from "vitest";

import { LEGACY_ERAS } from "./types.js";
import {
  LEGACY_MEMBER,
  SYNTHETIC_LEGACY_MEMORIES,
  demoReceiptForRing,
  memoriesByEra,
} from "./dataset.js";
import { answerLegacyQuery, retrieveMemories } from "./answer.js";

describe("synthetic legacy dataset", () => {
  it("holds 24–40 memories, all in the family ring, with unique ids", () => {
    expect(SYNTHETIC_LEGACY_MEMORIES.length).toBeGreaterThanOrEqual(24);
    expect(SYNTHETIC_LEGACY_MEMORIES.length).toBeLessThanOrEqual(40);
    const ids = new Set(SYNTHETIC_LEGACY_MEMORIES.map((m) => m.id));
    expect(ids.size).toBe(SYNTHETIC_LEGACY_MEMORIES.length);
    for (const memory of SYNTHETIC_LEGACY_MEMORIES) {
      expect(memory.ring).toBe("family");
      expect(memory.title.length).toBeGreaterThan(0);
      expect(memory.text.length).toBeGreaterThan(0);
      expect(memory.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(memory.year).toBe(Number(memory.date.slice(0, 4)));
    }
  });

  it("spans every era and is labeled synthetic", () => {
    const grouped = memoriesByEra(SYNTHETIC_LEGACY_MEMORIES);
    for (const era of LEGACY_ERAS) {
      expect(grouped.get(era)?.length ?? 0).toBeGreaterThanOrEqual(4);
    }
    expect(LEGACY_MEMBER.synthetic).toBe(true);
    expect(LEGACY_MEMBER.archiveLabel).toContain("fictional");
  });
});

describe("answerLegacyQuery — in-ring success path", () => {
  it("answers a family viewer with citations to the lighthouse memory", () => {
    const answer = answerLegacyQuery(
      "Tell me about the lighthouse at Port Anselm",
      { viewerRing: "family" },
    );
    expect(answer.kind).toBe("answered");
    expect(answer.refused).toBe(false);
    expect(answer.abstained).toBe(false);
    expect(answer.backend).toBe("local-legacy-logic");
    expect(answer.citations).toContain("mem-008");
    expect(answer.text).toContain("Port Anselm");
    expect(answer.provenance.badge).toBe("Official Personal AI");
    expect(answer.provenance.engine).toBe("local-legacy-logic");
    expect(
      answer.provenance.sources.some((s) => s.id === "mem-008"),
    ).toBe(true);
    const lighthouse = answer.provenance.sources.find(
      (s) => s.id === "mem-008",
    );
    expect(lighthouse?.title).toBe("Summer at the Port Anselm Lighthouse");
    expect(lighthouse?.sourceType).toBe("journal");
    expect(lighthouse?.ring).toBe("family");
  });

  it("citation completeness: every claim carries ≥1 valid citation", () => {
    const questions = [
      "Tell me about the lighthouse at Port Anselm",
      "What boat did the family sail on Lake Anselm?",
      "Where did he work at Cedar Ridge Observatory?",
      "Tell me about the violin",
      "Who is Wren?",
    ];
    const validIds = new Set(SYNTHETIC_LEGACY_MEMORIES.map((m) => m.id));
    for (const question of questions) {
      const answer = answerLegacyQuery(question, { viewerRing: "family" });
      expect(answer.kind, question).toBe("answered");
      expect(answer.claims.length).toBeGreaterThan(0);
      for (const claim of answer.claims) {
        expect(claim.citations.length).toBeGreaterThanOrEqual(1);
        for (const id of claim.citations) {
          expect(validIds.has(id)).toBe(true);
        }
      }
      // The flat citation list and the provenance sources agree exactly
      // with the union of the claim citations.
      const union = [...new Set(answer.claims.flatMap((c) => c.citations))];
      expect([...answer.citations].sort()).toEqual([...union].sort());
      expect(answer.provenance.sources.map((s) => s.id).sort()).toEqual(
        [...union].sort(),
      );
    }
  });
});

describe("answerLegacyQuery — abstention", () => {
  it("abstains on a question no memory supports, inventing nothing", () => {
    const answer = answerLegacyQuery("Did Elias travel to Antarctica?", {
      viewerRing: "family",
    });
    expect(answer.kind).toBe("abstained");
    expect(answer.abstained).toBe(true);
    expect(answer.refused).toBe(false);
    expect(answer.claims).toEqual([]);
    expect(answer.citations).toEqual([]);
    expect(answer.provenance.sources).toEqual([]);
    expect(answer.text.toLowerCase()).toContain("abstains");
    expect(answer.text).not.toContain("Antarctica is");
  });

  it("retrieveMemories returns nothing for an unsupported question", () => {
    expect(
      retrieveMemories(
        "Did Elias travel to Antarctica?",
        SYNTHETIC_LEGACY_MEMORIES,
      ),
    ).toEqual([]);
  });
});

describe("answerLegacyQuery — Guardian refusal for out-of-ring viewers", () => {
  it.each(["friends", "work", "public"] as const)(
    "refuses a %s viewer and names the family boundary",
    (viewerRing) => {
      const answer = answerLegacyQuery(
        "Tell me about the lighthouse at Port Anselm",
        { viewerRing },
      );
      expect(answer.kind).toBe("refused");
      expect(answer.refused).toBe(true);
      expect(answer.backend).toBe("guardian");
      expect(answer.boundaryRing).toBe("family");
      expect(answer.requiredRing).toBe("family");
      expect(answer.claims).toEqual([]);
      expect(answer.citations).toEqual([]);
      expect(answer.text).toContain("family");
      expect(answer.text).toContain(viewerRing);
      // The refusal leaks no archive content.
      expect(answer.text).not.toContain("Bram Ellery");
      expect(answer.text).not.toContain("lens");
    },
  );

  it("refuses a family viewer holding a revoked receipt", () => {
    const revoked = {
      ...demoReceiptForRing("family"),
      revokedAt: "2026-06-01T00:00:00.000Z",
    };
    const answer = answerLegacyQuery("Tell me about the lighthouse", {
      viewerRing: "family",
      receipt: revoked,
    });
    expect(answer.kind).toBe("refused");
    expect(answer.backend).toBe("guardian");
  });

  it("refuses a family viewer holding only a friends-ring receipt", () => {
    const answer = answerLegacyQuery("Tell me about the lighthouse", {
      viewerRing: "family",
      receipt: demoReceiptForRing("friends"),
    });
    expect(answer.kind).toBe("refused");
  });

  it("answers a family viewer with an explicit active family receipt", () => {
    const answer = answerLegacyQuery("Tell me about the lighthouse", {
      viewerRing: "family",
      receipt: demoReceiptForRing("family"),
      now: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(answer.kind).toBe("answered");
    expect(answer.citations).toContain("mem-008");
  });
});
