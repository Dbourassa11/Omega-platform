import { describe, expect, it } from "vitest";

import type { AgentContext } from "./index.js";
import {
  MetaModelClient,
  MetaModelError,
  OfflineStubProvider,
  createChatProvider,
  getChatProviderStatus,
  oracleChat,
  type ChatCompletionProvider,
  type MetaModelChatRequest,
  type MetaModelFetchFn,
  type MetaModelFetchInit,
} from "./meta-model-client.js";

// Dummy fixture string used only to exercise the Authorization header shape
// in tests. It is not a real credential and grants access to nothing.
const TEST_KEY = "test-key-not-a-real-credential";

describe("MetaModelClient — success path (mock fetch, no network)", () => {
  it("maps an OpenAI-shaped 200 payload and sends the expected request", async () => {
    let capturedUrl = "";
    let capturedInit: MetaModelFetchInit | undefined;
    const fetchFn: MetaModelFetchFn = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: "muse-spark",
          choices: [
            {
              message: { role: "assistant", content: "Hello from the mock." },
            },
          ],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        }),
      };
    };

    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });
    const response = await client.chat({
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.2,
      maxTokens: 64,
    });

    expect(response.backend).toBe("meta-model-api");
    expect(response.model).toBe("muse-spark");
    expect(response.content).toBe("Hello from the mock.");
    expect(response.usage).toEqual({
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
    });

    expect(capturedUrl).toBe("https://api.meta.ai/v1/chat/completions");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(capturedInit?.headers["Content-Type"]).toBe("application/json");
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);

    const sentBody: unknown = JSON.parse(capturedInit?.body ?? "{}");
    expect(sentBody).toEqual({
      model: "muse-spark-1.3",
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.2,
      max_completion_tokens: 64,
    });
  });

  it("serializes reasoning_effort when requested", async () => {
    let capturedInit: MetaModelFetchInit | undefined;
    const fetchFn: MetaModelFetchFn = async (_url, init) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: "muse-spark-1.3",
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
      };
    };
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });
    await client.chat({
      messages: [{ role: "user", content: "Think hard" }],
      reasoningEffort: "high",
    });
    const sentBody: unknown = JSON.parse(capturedInit?.body ?? "{}");
    expect(sentBody).toMatchObject({ reasoning_effort: "high" });
  });
});

describe("offline stub fallback — no API key", () => {
  it("returns the offline-stub backend and is deterministic", async () => {
    const explodingFetch: MetaModelFetchFn = async () => {
      throw new Error("fetch must not be called without an API key");
    };
    // An empty-string key is treated as "no key configured".
    const provider = createChatProvider({ apiKey: "", fetchFn: explodingFetch });

    const request: MetaModelChatRequest = {
      messages: [{ role: "user", content: "What is the Omega Platform?" }],
    };
    const first = await provider.chat(request);
    const second = await provider.chat(request);

    expect(first.backend).toBe("offline-stub");
    expect(first.content).toContain("offline stub");
    expect(first.model).toBe("muse-spark-1.3");
    expect(second.content).toBe(first.content);
    expect(second).toEqual(first);
  });

  it("OfflineStubProvider echoes only the last user message (first 80 chars)", async () => {
    const stub = new OfflineStubProvider();
    const response = await stub.chat({
      messages: [
        { role: "user", content: "first question" },
        { role: "assistant", content: "some answer" },
        { role: "user", content: "x".repeat(120) },
      ],
      model: "custom-model",
    });
    expect(response.backend).toBe("offline-stub");
    expect(response.model).toBe("custom-model");
    expect(response.content).toContain("x".repeat(80));
    expect(response.content).not.toContain("x".repeat(81));
  });
});

describe("MetaModelClient — error mapping", () => {
  it("HTTP 500 rejects with MetaModelError status 500 / code http_error", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    const metaError = error as MetaModelError;
    expect(metaError.status).toBe(500);
    expect(metaError.code).toBe("http_error");
  });

  it("a fetch that only settles on abort rejects with code timeout", async () => {
    const fetchFn: MetaModelFetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    const client = new MetaModelClient({
      apiKey: TEST_KEY,
      fetchFn,
      timeoutMs: 10,
    });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("timeout");
  });

  it("a network rejection rejects with code network_error", async () => {
    const fetchFn: MetaModelFetchFn = async () => {
      throw new Error("socket hang up");
    };
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("network_error");
  });

  it("a 200 payload without choices rejects with code invalid_response", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ model: "muse-spark" }),
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("invalid_response");
  });

  it("HTTP 401 rejects with MetaModelError status 401 / code http_error", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "unauthorized" } }),
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).status).toBe(401);
    expect((error as MetaModelError).code).toBe("http_error");
  });

  it("HTTP 429 rejects with MetaModelError status 429 / code http_error", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "rate limited" } }),
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).status).toBe(429);
    expect((error as MetaModelError).code).toBe("http_error");
  });

  it("a 200 response whose json() throws rejects with code invalid_response", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("invalid_response");
    expect((error as MetaModelError).message).toContain("malformed JSON");
  });

  it("a 200 payload with non-string content rejects with code invalid_response", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: "muse-spark-1.3",
        choices: [{ message: { role: "assistant", content: 42 } }],
      }),
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });

    const error: unknown = await client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("invalid_response");
  });
});

describe("provider status — the badge signal", () => {
  it("reports live with the answering model id when a key is configured", () => {
    const client = new MetaModelClient({
      apiKey: TEST_KEY,
      fetchFn: async () => {
        throw new Error("unused");
      },
    });
    const status = getChatProviderStatus(client);
    expect(status.mode).toBe("live");
    expect(status.model).toBe("muse-spark-1.3");
    expect(status.label).toContain("muse-spark-1.3");
    expect(client.isLive).toBe(true);
    expect(client.configuredModel).toBe("muse-spark-1.3");
  });

  it("reports offline — no API key connected — without a key", () => {
    const provider = createChatProvider({ apiKey: "" });
    const status = getChatProviderStatus(provider);
    expect(status.mode).toBe("offline");
    expect(status.label).toContain("no API key connected");
  });
});

describe("oracleChat — Oracle Agent wiring", () => {
  it("prefixes a ring-scoped system message and delegates to the provider", async () => {
    let captured: MetaModelChatRequest | undefined;
    const recordingProvider: ChatCompletionProvider = {
      async chat(request) {
        captured = request;
        return {
          model: "muse-spark",
          content: "recorded",
          backend: "offline-stub",
        };
      },
    };
    const context: AgentContext = { ring: "family", subjectNodeId: "node-1" };

    const response = await oracleChat(
      context,
      [{ role: "user", content: "Summarize my memories" }],
      recordingProvider,
    );

    expect(response.content).toBe("recorded");
    expect(captured?.messages).toHaveLength(2);
    expect(captured?.messages[0]?.role).toBe("system");
    expect(captured?.messages[0]?.content).toContain("'family' ring");
    expect(captured?.messages[1]).toEqual({
      role: "user",
      content: "Summarize my memories",
    });
  });
});
