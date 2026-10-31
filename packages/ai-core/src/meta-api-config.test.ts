import { describe, expect, it } from "vitest";

import {
  getMetaApiStatus,
  resolveMetaApiConfig,
  resolveMetaApiKey,
} from "./meta-api-config.js";

describe("resolveMetaApiKey — fallback chain", () => {
  it("prefers the project name META_MODEL_API_KEY", () => {
    expect(
      resolveMetaApiKey({
        META_MODEL_API_KEY: "project-key",
        MODEL_API_KEY: "meta-key",
      }),
    ).toBe("project-key");
  });

  it("falls back to Meta's documented MODEL_API_KEY", () => {
    expect(resolveMetaApiKey({ MODEL_API_KEY: "meta-key" })).toBe("meta-key");
  });

  it("treats empty strings as absent", () => {
    expect(
      resolveMetaApiKey({ META_MODEL_API_KEY: "", MODEL_API_KEY: "meta-key" }),
    ).toBe("meta-key");
    expect(resolveMetaApiKey({ META_MODEL_API_KEY: "" })).toBeUndefined();
    expect(resolveMetaApiKey({})).toBeUndefined();
  });
});

describe("resolveMetaApiConfig — defaults", () => {
  it("uses the documented defaults when nothing is set", () => {
    const config = resolveMetaApiConfig({});
    expect(config.keyPresent).toBe(false);
    expect(config.baseUrl).toBe("https://api.meta.ai/v1");
    expect(config.chatModel).toBe("muse-spark-1.3");
    expect(config.imageModel).toBe("muse-image-1.0");
  });

  it("honours overrides and strips trailing slashes", () => {
    const config = resolveMetaApiConfig({
      META_MODEL_API_KEY: "k",
      META_MODEL_BASE_URL: "https://example.test/v1///",
      META_MODEL_MODEL: "muse-spark-1.1",
      META_MODEL_IMAGE_MODEL: "muse-image-1.0",
    });
    expect(config.keyPresent).toBe(true);
    expect(config.baseUrl).toBe("https://example.test/v1");
    expect(config.chatModel).toBe("muse-spark-1.1");
  });
});

describe("getMetaApiStatus — the one badge signal", () => {
  it("is offline and says no API key is connected when no key is present", () => {
    const status = getMetaApiStatus({});
    expect(status.mode).toBe("offline");
    expect(status.label).toContain("no API key connected");
  });

  it("is live and names the answering model id when a key is present", () => {
    const status = getMetaApiStatus({ MODEL_API_KEY: "k" });
    expect(status.mode).toBe("live");
    expect(status.chatModel).toBe("muse-spark-1.3");
    expect(status.label).toContain("muse-spark-1.3");
  });
});
