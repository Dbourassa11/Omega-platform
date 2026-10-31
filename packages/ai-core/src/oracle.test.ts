import { describe, expect, it, vi } from "vitest";

import type {
  ChatCompletionProvider,
  MetaModelChatRequest,
  MetaModelChatResponse,
} from "./meta-model-client.js";
import {
  answerOracleQuery,
  type OracleNodeRef,
} from "./oracle.js";

const familyJournal: OracleNodeRef = {
  id: "node-journal-001",
  label: "Journal — Demo Member 001",
  ring: "family",
  kind: "journal",
};

const publicNodes: readonly OracleNodeRef[] = [
  { id: "node-post-001", label: "Launch Announcement", ring: "public", kind: "post" },
  { id: "node-photo-001", label: "Cover Photo", ring: "public", kind: "photo" },
  { id: "node-photo-002", label: "Studio Photo", ring: "public", kind: "photo" },
  { id: "node-note-001", label: "Press Note", ring: "public", kind: "note" },
];

function stubProvider(): ChatCompletionProvider & {
  chat: ReturnType<typeof vi.fn>;
} {
  return {
    chat: vi.fn(
      async (
        _request: MetaModelChatRequest,
      ): Promise<MetaModelChatResponse> => ({
        model: "muse-spark",
        content: "[offline stub] raw echo that must never be surfaced",
        backend: "offline-stub",
      }),
    ),
  };
}

function liveProvider(): ChatCompletionProvider & {
  chat: ReturnType<typeof vi.fn>;
} {
  return {
    chat: vi.fn(
      async (
        _request: MetaModelChatRequest,
      ): Promise<MetaModelChatResponse> => ({
        model: "muse-spark",
        content: "LIVE ANSWER",
        backend: "meta-model-api",
      }),
    ),
  };
}

describe("answerOracleQuery — Guardian refusal", () => {
  it("refuses a query naming an out-of-ring node and never calls the provider", async () => {
    const provider = stubProvider();

    const answer = await answerOracleQuery(
      "Tell me about Journal — Demo Member 001",
      {
        activeRing: "public",
        nodes: [familyJournal, ...publicNodes],
        provider,
      },
    );

    expect(answer.refused).toBe(true);
    expect(answer.backend).toBe("guardian");
    expect(answer.boundaryRing).toBe("family");
    expect(answer.activeRing).toBe("public");
    expect(answer.citations).toEqual([]);
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("refusal text names both the boundary ring and the active ring", async () => {
    const provider = stubProvider();

    const answer = await answerOracleQuery(
      "Tell me about Journal — Demo Member 001",
      {
        activeRing: "public",
        nodes: [familyJournal, ...publicNodes],
        provider,
      },
    );

    expect(answer.text).toContain("family");
    expect(answer.text).toContain("public");
    expect(answer.text).toContain("Journal — Demo Member 001");
    expect(provider.chat).not.toHaveBeenCalled();
  });
});

describe("answerOracleQuery — in-ring paths", () => {
  it("answers in-ring with the stub provider, citing and naming the mentioned node", async () => {
    const provider = stubProvider();

    const answer = await answerOracleQuery("Tell me about Cover Photo", {
      activeRing: "public",
      nodes: publicNodes,
      provider,
    });

    expect(answer.refused).toBe(false);
    expect(answer.backend).toBe("offline-stub");
    expect(answer.citations).toContainEqual({
      id: "node-photo-001",
      label: "Cover Photo",
      ring: "public",
    });
    expect(answer.text).toContain("Cover Photo");
    // Plainly offline, and the raw stub echo is not surfaced.
    expect(answer.text).toContain("Offline mode");
    expect(answer.text).not.toContain("[offline stub]");
    expect(answer.text).not.toContain("raw echo");
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it("passes a live Meta Model API answer through with citations", async () => {
    const provider = liveProvider();

    const answer = await answerOracleQuery("Tell me about Cover Photo", {
      activeRing: "public",
      nodes: publicNodes,
      provider,
    });

    expect(answer.refused).toBe(false);
    expect(answer.text).toBe("LIVE ANSWER");
    expect(answer.backend).toBe("meta-model-api");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations).toContainEqual({
      id: "node-photo-001",
      label: "Cover Photo",
      ring: "public",
    });
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it("a no-mention general query cites only nodes from the active ring", async () => {
    const provider = stubProvider();

    const answer = await answerOracleQuery("What is in here?", {
      activeRing: "public",
      nodes: [familyJournal, ...publicNodes],
      provider,
    });

    expect(answer.refused).toBe(false);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations.length).toBeLessThanOrEqual(3);
    for (const citation of answer.citations) {
      expect(citation.ring).toBe("public");
    }
    expect(answer.text).toContain("Your public ring holds 4 demo nodes");
  });

  it("matches a mention by node id", async () => {
    const provider = stubProvider();

    const answer = await answerOracleQuery(
      "What does node-photo-002 show?",
      {
        activeRing: "public",
        nodes: publicNodes,
        provider,
      },
    );

    expect(answer.refused).toBe(false);
    expect(answer.citations).toEqual([
      { id: "node-photo-002", label: "Studio Photo", ring: "public" },
    ]);
    expect(answer.text).toContain("Studio Photo");
  });
});

describe("answerOracleQuery — empty ring", () => {
  it("reports an empty active ring without calling the provider", async () => {
    const provider = stubProvider();

    const answer = await answerOracleQuery("Anything here?", {
      activeRing: "work",
      nodes: publicNodes,
      provider,
    });

    expect(answer.refused).toBe(false);
    expect(answer.backend).toBe("offline-stub");
    expect(answer.citations).toEqual([]);
    expect(answer.text).toContain("work");
    expect(answer.text.toLowerCase()).toContain("empty");
    expect(provider.chat).not.toHaveBeenCalled();
  });
});
