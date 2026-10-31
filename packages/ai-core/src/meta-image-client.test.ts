import { describe, expect, it } from "vitest";

import {
  MetaImageClient,
  generateCreativeArt,
} from "./meta-image-client.js";
import {
  MetaModelError,
  type MetaModelFetchFn,
  type MetaModelFetchInit,
} from "./meta-model-client.js";

// Dummy fixture string used only to exercise the Authorization header shape
// in tests. It is not a real credential and grants access to nothing.
const TEST_KEY = "test-key-not-a-real-credential";

describe("MetaImageClient — no API key", () => {
  it("throws a labelled not_configured error and never calls fetch", async () => {
    let fetchCalled = false;
    const fetchFn: MetaModelFetchFn = async () => {
      fetchCalled = true;
      throw new Error("fetch must not be called without an API key");
    };
    const client = new MetaImageClient({ apiKey: "", fetchFn });

    const error: unknown = await client
      .generate({ prompt: "A gold spiral over a dark field" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("not_configured");
    expect((error as MetaModelError).message).toContain("not yet available");
    expect((error as MetaModelError).message).toContain("no API key connected");
    expect(fetchCalled).toBe(false);
    expect(client.isLive).toBe(false);
  });
});

describe("MetaImageClient — documented generations shape (mock fetch)", () => {
  it("posts to /images/generations and maps the data envelope", async () => {
    let capturedUrl = "";
    let capturedInit: MetaModelFetchInit | undefined;
    const fetchFn: MetaModelFetchFn = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          created: 1_700_000_000,
          model: "muse-image-1.0",
          data: [{ b64_json: "aGVsbG8=", revised_prompt: "revised" }],
        }),
      };
    };
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });

    const response = await client.generate({
      prompt: "A gold spiral over a dark field",
      n: 1,
      size: "1792x1024",
      outputFormat: "png",
    });

    expect(response.backend).toBe("meta-model-api");
    expect(response.model).toBe("muse-image-1.0");
    expect(response.created).toBe(1_700_000_000);
    expect(response.data).toEqual([
      { b64Json: "aGVsbG8=", revisedPrompt: "revised" },
    ]);

    expect(capturedUrl).toBe("https://api.meta.ai/v1/images/generations");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
    const sentBody: unknown = JSON.parse(capturedInit?.body ?? "{}");
    expect(sentBody).toEqual({
      model: "muse-image-1.0",
      prompt: "A gold spiral over a dark field",
      n: 1,
      size: "1792x1024",
      output_format: "png",
    });
  });

  it("maps a url-format result item", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ url: "https://example.test/image.webp" }],
      }),
    });
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });
    const response = await client.generate({
      prompt: "p",
      responseFormat: "url",
    });
    expect(response.data).toEqual([{ url: "https://example.test/image.webp" }]);
    // No model field in the payload: falls back to the requested model.
    expect(response.model).toBe("muse-image-1.0");
  });

  it("HTTP 429 rejects with MetaModelError status 429", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" }),
    });
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });
    const error: unknown = await client
      .generate({ prompt: "p" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).status).toBe(429);
    expect((error as MetaModelError).code).toBe("http_error");
  });

  it("a payload without a data array rejects with invalid_response", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ created: 1 }),
    });
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });
    const error: unknown = await client
      .generate({ prompt: "p" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("invalid_response");
  });

  it("a data item with neither b64_json nor url rejects with invalid_response", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ revised_prompt: "only text" }] }),
    });
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });
    const error: unknown = await client
      .generate({ prompt: "p" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("invalid_response");
  });

  it("malformed JSON rejects with invalid_response", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("not json");
      },
    });
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });
    const error: unknown = await client
      .generate({ prompt: "p" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaModelError);
    expect((error as MetaModelError).code).toBe("invalid_response");
  });
});

describe("generateCreativeArt — Vault provenance seam", () => {
  it("returns the image plus a complete provenance record", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: "muse-image-1.0",
        data: [{ b64_json: "aGVsbG8=" }],
      }),
    });
    const client = new MetaImageClient({ apiKey: TEST_KEY, fetchFn });

    const { image, provenance } = await generateCreativeArt(
      client,
      {
        prompt: "A gold spiral over a dark field",
        ring: "public",
        size: "1024x1024",
      },
      () => new Date("2026-10-26T12:00:00.000Z"),
    );

    expect(image.data).toHaveLength(1);
    expect(provenance).toEqual({
      kind: "ai-generated-image",
      prompt: "A gold spiral over a dark field",
      modelId: "muse-image-1.0",
      generatedAt: "2026-10-26T12:00:00.000Z",
      ring: "public",
      creator: "David Charles Bourassa",
      backend: "meta-model-api",
      responseFormat: "b64_json",
      outputFormat: "webp",
      size: "1024x1024",
    });
  });
});
