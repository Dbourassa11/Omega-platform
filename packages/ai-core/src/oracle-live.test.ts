import { describe, expect, it } from "vitest";

import { MetaModelClient, type MetaModelFetchFn } from "./meta-model-client.js";
import { answerOracleQuery, type OracleNodeRef } from "./oracle.js";

// Dummy fixture string used only to exercise the Authorization header shape
// in tests. It is not a real credential and grants access to nothing.
const TEST_KEY = "test-key-not-a-real-credential";

const publicNodes: readonly OracleNodeRef[] = [
  { id: "node-photo-001", label: "Cover Photo", ring: "public", kind: "photo" },
  { id: "node-note-001", label: "Press Note", ring: "public", kind: "note" },
];

function liveFetch(captured: { body?: unknown }): MetaModelFetchFn {
  return async (_url, init) => {
    captured.body = JSON.parse(init.body) as unknown;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: "muse-spark-1.3",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Cover Photo is the public cover image [node-photo-001].",
            },
          },
        ],
        usage: { prompt_tokens: 42, completion_tokens: 12, total_tokens: 54 },
      }),
    };
  };
}

describe("Oracle live path — MetaModelClient with a key (mocked fetch)", () => {
  it("runs the live Spark chat with ring-scoped context and surfaces the model", async () => {
    const captured: { body?: unknown } = {};
    const provider = new MetaModelClient({
      apiKey: TEST_KEY,
      fetchFn: liveFetch(captured),
    });

    const answer = await answerOracleQuery("Tell me about Cover Photo", {
      activeRing: "public",
      nodes: publicNodes,
      provider,
    });

    expect(answer.refused).toBe(false);
    expect(answer.backend).toBe("meta-model-api");
    expect(answer.model).toBe("muse-spark-1.3");
    expect(answer.text).toContain("Cover Photo is the public cover image");
    expect(answer.citations).toContainEqual({
      id: "node-photo-001",
      label: "Cover Photo",
      ring: "public",
    });

    // The request that went out was scoped to the public ring and listed
    // only in-ring consented sources.
    const body = captured.body as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe("muse-spark-1.3");
    const allContent = body.messages.map((m) => m.content).join("\n");
    expect(allContent).toContain("'public' ring");
    expect(allContent).toContain("Cover Photo");
  });

  it("the Guardian still refuses out-of-ring queries before any live call", async () => {
    let fetchCalled = false;
    const fetchFn: MetaModelFetchFn = async () => {
      fetchCalled = true;
      throw new Error("fetch must not be called for a refused query");
    };
    const provider = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const answer = await answerOracleQuery("Tell me about Family Secret", {
      activeRing: "public",
      nodes: [
        ...publicNodes,
        { id: "node-secret", label: "Family Secret", ring: "family" },
      ],
      provider,
    });

    expect(answer.refused).toBe(true);
    expect(answer.backend).toBe("guardian");
    expect(fetchCalled).toBe(false);
  });
});

describe("Oracle offline path — MetaModelClient without a key", () => {
  it("answers OFFLINE from local composition and never calls fetch", async () => {
    const explodingFetch: MetaModelFetchFn = async () => {
      throw new Error("fetch must not be called without an API key");
    };
    const provider = new MetaModelClient({
      apiKey: "",
      fetchFn: explodingFetch,
    });

    const answer = await answerOracleQuery("Tell me about Cover Photo", {
      activeRing: "public",
      nodes: publicNodes,
      provider,
    });

    expect(answer.refused).toBe(false);
    expect(answer.backend).toBe("offline-stub");
    expect(answer.model).toBe("muse-spark-1.3");
    expect(answer.text).toContain("Offline mode");
    expect(answer.text).toContain("Cover Photo");
    expect(provider.isLive).toBe(false);
  });
});
