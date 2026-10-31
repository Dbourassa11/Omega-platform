/**
 * @omega/ai-core — Meta Model API image client (Muse Image)
 *
 * Creator: David Charles Bourassa.
 *
 * STATUS: UNTESTED against the live API — there is no API key yet.
 * The request shape below is DOCUMENTED via secondary sources quoting
 * Meta's developer documentation (see docs/META_API_NOTES.md §2):
 * model "muse-image-1.0", POST {baseUrl}/images/generations, same base
 * URL and Bearer auth as Muse Spark. The response envelope is parsed as
 * the OpenAI-style images shape (`data: [{ b64_json | url }]`) that the
 * documented integrations use; it is NOT Meta-verbatim and must be
 * re-checked on the first live call. With no API key configured this
 * client NEVER fabricates an image — it throws a labelled
 * "not_configured" MetaModelError.
 */

import type { RingType } from "@omega/consent-core";

import {
  DEFAULT_META_IMAGE_MODEL,
  resolveMetaApiConfig,
  resolveMetaApiKey,
} from "./meta-api-config.js";
import {
  MetaModelError,
  type MetaModelFetchFn,
  type MetaModelFetchResponse,
} from "./meta-model-client.js";

export const META_IMAGE_ADAPTER_STATUS =
  "ADAPTER — documented request shape, untested against live API (no key yet)" as const;

export const DEFAULT_META_IMAGE_MODEL_ID = DEFAULT_META_IMAGE_MODEL;
export const DEFAULT_META_IMAGE_TIMEOUT_MS = 60_000;

export type MetaImageResponseFormat = "b64_json" | "url";
export type MetaImageOutputFormat = "webp" | "png" | "jpeg";

export interface MetaImageGenerationRequest {
  prompt: string;
  model?: string;
  /** 1–10, default 1 (documented). */
  n?: number;
  /** "WxH" string; sets aspect ratio only, not exact pixels (documented). */
  size?: string;
  responseFormat?: MetaImageResponseFormat;
  outputFormat?: MetaImageOutputFormat;
}

export interface MetaImageResultItem {
  b64Json?: string;
  url?: string;
  revisedPrompt?: string;
}

export interface MetaImageGenerationResponse {
  model: string;
  created?: number;
  data: MetaImageResultItem[];
  backend: "meta-model-api";
}

/**
 * Vault-filing provenance record for a generated image. Shape-compatible
 * with @omega/vault-core concepts (a ring-scoped item with metadata the
 * Vault can encrypt and file); this package defines types only and does
 * not import or modify vault-core.
 */
export interface VaultImageProvenance {
  kind: "ai-generated-image";
  /** The exact prompt that produced the image. */
  prompt: string;
  /** The model id that produced the image. */
  modelId: string;
  /** ISO-8601 timestamp of generation. */
  generatedAt: string;
  /** Consent ring the image is filed under. */
  ring: RingType;
  /** Human author of record for the work. */
  creator: "David Charles Bourassa";
  backend: "meta-model-api";
  responseFormat: MetaImageResponseFormat;
  outputFormat: MetaImageOutputFormat;
  size?: string;
}

export interface MetaImageClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: MetaModelFetchFn;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const defaultFetchFn: MetaModelFetchFn =
  typeof globalThis.fetch === "function"
    ? (globalThis.fetch.bind(globalThis) as unknown as MetaModelFetchFn)
    : async () => {
        throw new Error("globalThis.fetch is not available in this runtime");
      };

/**
 * Image-generation client for Muse Image on the Meta Model API.
 * Shares env resolution with the chat client via meta-api-config, so a
 * key landing in the documented env names activates it with zero code
 * change.
 */
export class MetaImageClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: MetaModelFetchFn;

  constructor(options: MetaImageClientOptions = {}) {
    const config = resolveMetaApiConfig();
    const apiKey = options.apiKey ?? resolveMetaApiKey();
    this.apiKey = apiKey !== undefined && apiKey !== "" ? apiKey : undefined;
    this.baseUrl = (options.baseUrl ?? config.baseUrl).replace(/\/+$/, "");
    this.model = options.model ?? config.imageModel;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_META_IMAGE_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? defaultFetchFn;
  }

  get isLive(): boolean {
    return this.apiKey !== undefined;
  }

  get configuredModel(): string {
    return this.model;
  }

  async generate(
    request: MetaImageGenerationRequest,
  ): Promise<MetaImageGenerationResponse> {
    if (this.apiKey === undefined) {
      throw new MetaModelError(
        "Muse Image is not yet available — no API key connected " +
          "(offline fallback cannot generate images)",
        { code: "not_configured" },
      );
    }
    const apiKey = this.apiKey;
    const model = request.model ?? this.model;

    const body: Record<string, unknown> = {
      model,
      prompt: request.prompt,
    };
    if (request.n !== undefined) body.n = request.n;
    if (request.size !== undefined) body.size = request.size;
    if (request.responseFormat !== undefined) {
      body.response_format = request.responseFormat;
    }
    if (request.outputFormat !== undefined) {
      body.output_format = request.outputFormat;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: MetaModelFetchResponse;
    try {
      response = await this.fetchFn(`${this.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw new MetaModelError(
          `Meta Model API image request timed out after ${this.timeoutMs} ms`,
          { code: "timeout", cause: error },
        );
      }
      throw new MetaModelError(
        "Meta Model API image request failed (network error)",
        { code: "network_error", cause: error },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new MetaModelError(
        `Meta Model API image request failed with HTTP ${response.status}`,
        { code: "http_error", status: response.status },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new MetaModelError("Meta Model API returned malformed JSON", {
        code: "invalid_response",
        cause: error,
      });
    }

    const dataRaw = isRecord(payload) ? payload.data : undefined;
    if (!Array.isArray(dataRaw) || dataRaw.length === 0) {
      throw new MetaModelError(
        "Meta Model API image response is missing a non-empty data array",
        { code: "invalid_response" },
      );
    }
    const data: MetaImageResultItem[] = [];
    for (const item of dataRaw) {
      if (!isRecord(item)) {
        throw new MetaModelError(
          "Meta Model API image response data item is not an object",
          { code: "invalid_response" },
        );
      }
      const b64Json =
        typeof item.b64_json === "string" ? item.b64_json : undefined;
      const url = typeof item.url === "string" ? item.url : undefined;
      if (b64Json === undefined && url === undefined) {
        throw new MetaModelError(
          "Meta Model API image response item has neither b64_json nor url",
          { code: "invalid_response" },
        );
      }
      data.push({
        ...(b64Json !== undefined ? { b64Json } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(typeof item.revised_prompt === "string"
          ? { revisedPrompt: item.revised_prompt }
          : {}),
      });
    }

    return {
      model:
        isRecord(payload) && typeof payload.model === "string"
          ? payload.model
          : model,
      ...(isRecord(payload) && typeof payload.created === "number"
        ? { created: payload.created }
        : {}),
      data,
      backend: "meta-model-api",
    };
  }
}

export function createImageClient(
  options: MetaImageClientOptions = {},
): MetaImageClient {
  return new MetaImageClient(options);
}

/**
 * Creative Art seam: request a Muse Image generation through the given
 * client and produce the Vault-filing provenance record for the result.
 * The image bytes/URL stay with the caller; this seam returns exactly
 * what the Vault needs to file the work with honest provenance.
 */
export async function generateCreativeArt(
  client: MetaImageClient,
  request: MetaImageGenerationRequest & { ring: RingType },
  now: () => Date = () => new Date(),
): Promise<{
  image: MetaImageGenerationResponse;
  provenance: VaultImageProvenance;
}> {
  const image = await client.generate(request);
  const provenance: VaultImageProvenance = {
    kind: "ai-generated-image",
    prompt: request.prompt,
    modelId: image.model,
    generatedAt: now().toISOString(),
    ring: request.ring,
    creator: "David Charles Bourassa",
    backend: "meta-model-api",
    responseFormat: request.responseFormat ?? "b64_json",
    outputFormat: request.outputFormat ?? "webp",
    ...(request.size !== undefined ? { size: request.size } : {}),
  };
  return { image, provenance };
}
