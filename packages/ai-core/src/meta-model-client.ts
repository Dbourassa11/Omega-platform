/**
 * @omega/ai-core — Meta Model API adapter
 *
 * Adapter for the Meta Model API (hackathon build window), used by the
 * Omni-Agentic Core agents. Creator: David Charles Bourassa.
 *
 * STATUS: This adapter is UNTESTED against the live API — there is no API
 * key yet. The offline stub is the default backend whenever no key is
 * configured. Nothing in this module claims a live integration.
 *
 * DOCS CHECK 2026-10-26 (see docs/META_API_NOTES.md §1 and
 * docs/UNIVERSE_MODEL.md, Appendix A): public Meta documentation CONFIRMS
 * the base URL ("https://api.meta.ai/v1") and the versioned model id
 * "muse-spark-1.1" via Meta's own developer example. The newest
 * documented Muse Spark chat model id is "muse-spark-1.3" (documented
 * via secondary sources quoting Meta's dev.meta.ai models/pricing pages;
 * see META_API_NOTES for the grading of each claim), so the default
 * model below is "muse-spark-1.3", with "muse-spark-1.1" kept as the
 * exported Meta-confirmed fallback. The exact chat-completions response
 * envelope is still not live-verified (no API key yet).
 */

import type { AgentContext } from "./index.js";
import {
  DEFAULT_META_API_BASE_URL,
  DEFAULT_META_CHAT_MODEL,
  META_CONFIRMED_CHAT_MODEL,
  resolveMetaApiKey,
} from "./meta-api-config.js";

export const META_MODEL_ADAPTER_STATUS =
  "ADAPTER — untested against live API (no key yet); offline stub is the default backend" as const;

export const DEFAULT_META_MODEL_BASE_URL = DEFAULT_META_API_BASE_URL;
export const DEFAULT_META_MODEL_MODEL = DEFAULT_META_CHAT_MODEL;
/** Model id confirmed verbatim on a Meta page opened 2026-10-26. */
export const META_MODEL_CONFIRMED_MODEL = META_CONFIRMED_CHAT_MODEL;
export const DEFAULT_META_MODEL_TIMEOUT_MS = 30_000;

/** Documented Muse Spark reasoning-effort levels (`none` is not supported). */
export type MetaModelReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export interface MetaModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MetaModelChatRequest {
  messages: MetaModelMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: MetaModelReasoningEffort;
}

export interface MetaModelChatResponse {
  model: string;
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  backend: "meta-model-api" | "offline-stub";
}

export interface ChatCompletionProvider {
  chat(request: MetaModelChatRequest): Promise<MetaModelChatResponse>;
}

export type MetaModelErrorCode =
  | "http_error"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "not_configured";

export class MetaModelError extends Error {
  readonly code: MetaModelErrorCode;
  readonly status?: number;

  constructor(
    message: string,
    options: { code: MetaModelErrorCode; status?: number; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "MetaModelError";
    this.code = options.code;
    if (options.status !== undefined) {
      this.status = options.status;
    }
  }
}

/**
 * Minimal structural shape of the parts of `fetch` this adapter uses.
 * Keeping it structural makes the client trivially mockable in tests and
 * independent of DOM lib types.
 */
export interface MetaModelFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface MetaModelFetchInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export type MetaModelFetchFn = (
  url: string,
  init: MetaModelFetchInit,
) => Promise<MetaModelFetchResponse>;

const defaultFetchFn: MetaModelFetchFn =
  typeof globalThis.fetch === "function"
    ? (globalThis.fetch.bind(globalThis) as unknown as MetaModelFetchFn)
    : async () => {
        throw new Error("globalThis.fetch is not available in this runtime");
      };

/**
 * Deterministic offline provider. Pure function of the request: the same
 * request always yields the same response. It performs no network I/O and
 * exists so the platform runs end-to-end before a real API key is provisioned.
 */
export class OfflineStubProvider implements ChatCompletionProvider {
  private readonly defaultModel: string;

  constructor(options: { model?: string } = {}) {
    this.defaultModel = options.model ?? DEFAULT_META_MODEL_MODEL;
  }

  async chat(request: MetaModelChatRequest): Promise<MetaModelChatResponse> {
    const model = request.model ?? this.defaultModel;
    let lastUserContent = "";
    for (const message of request.messages) {
      if (message.role === "user") {
        lastUserContent = message.content;
      }
    }
    const snippet = lastUserContent.slice(0, 80);
    return {
      model,
      content:
        `[offline stub] The Meta Model API is not connected yet ` +
        `(no API key connected). Deterministic echo for: "${snippet}"`,
      backend: "offline-stub",
    };
  }
}

export interface MetaModelClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: MetaModelFetchFn;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Chat-completions client for the Meta Model API.
 *
 * If no API key is configured (constructor option or the
 * META_MODEL_API_KEY environment variable), every call is delegated to the
 * deterministic OfflineStubProvider — constructing or calling this client
 * never throws merely because a key is missing.
 */
export class MetaModelClient implements ChatCompletionProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: MetaModelFetchFn;
  private readonly stub: OfflineStubProvider;

  constructor(options: MetaModelClientOptions = {}) {
    // Key resolution: explicit option, then the shared fallback chain
    // (META_MODEL_API_KEY, then Meta's documented MODEL_API_KEY) so a key
    // issued per Meta's dashboard works with zero code change.
    const apiKey = options.apiKey ?? resolveMetaApiKey();
    this.apiKey = apiKey !== undefined && apiKey !== "" ? apiKey : undefined;
    this.baseUrl = (
      options.baseUrl ??
      process.env.META_MODEL_BASE_URL ??
      DEFAULT_META_MODEL_BASE_URL
    ).replace(/\/+$/, "");
    this.model =
      options.model ?? process.env.META_MODEL_MODEL ?? DEFAULT_META_MODEL_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_META_MODEL_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? defaultFetchFn;
    this.stub = new OfflineStubProvider({ model: this.model });
  }

  /** True when an API key is configured (a call would go to the live API). */
  get isLive(): boolean {
    return this.apiKey !== undefined;
  }

  /** The model id this client will send unless a request overrides it. */
  get configuredModel(): string {
    return this.model;
  }

  /** The resolved base URL (no trailing slash). */
  get configuredBaseUrl(): string {
    return this.baseUrl;
  }

  async chat(request: MetaModelChatRequest): Promise<MetaModelChatResponse> {
    if (this.apiKey === undefined) {
      return this.stub.chat(request);
    }
    const apiKey = this.apiKey;
    const model = request.model ?? this.model;

    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
    };
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      // Canonical on the Meta Model API per Meta's docs (quoted in
      // META_API_NOTES §1): max_tokens is only a deprecated alias.
      body.max_completion_tokens = request.maxTokens;
    }
    if (request.reasoningEffort !== undefined) {
      body.reasoning_effort = request.reasoningEffort;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: MetaModelFetchResponse;
    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
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
          `Meta Model API request timed out after ${this.timeoutMs} ms`,
          { code: "timeout", cause: error },
        );
      }
      throw new MetaModelError("Meta Model API request failed (network error)", {
        code: "network_error",
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new MetaModelError(
        `Meta Model API request failed with HTTP ${response.status}`,
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

    const choices = isRecord(payload) ? payload.choices : undefined;
    const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
    const message = isRecord(firstChoice) ? firstChoice.message : undefined;
    const content = isRecord(message) ? message.content : undefined;
    if (typeof content !== "string") {
      throw new MetaModelError(
        "Meta Model API response is missing choices[0].message.content",
        { code: "invalid_response" },
      );
    }

    const responseModel =
      isRecord(payload) && typeof payload.model === "string"
        ? payload.model
        : model;

    const usageRaw = isRecord(payload) ? payload.usage : undefined;
    let usage: MetaModelChatResponse["usage"];
    if (isRecord(usageRaw)) {
      const promptTokens = numberOrUndefined(usageRaw.prompt_tokens);
      const completionTokens = numberOrUndefined(usageRaw.completion_tokens);
      const totalTokens = numberOrUndefined(usageRaw.total_tokens);
      usage = {
        ...(promptTokens !== undefined ? { promptTokens } : {}),
        ...(completionTokens !== undefined ? { completionTokens } : {}),
        ...(totalTokens !== undefined ? { totalTokens } : {}),
      };
    }

    return {
      model: responseModel,
      content,
      ...(usage !== undefined ? { usage } : {}),
      backend: "meta-model-api",
    };
  }
}

/**
 * Factory for the platform's default chat provider. Returns a
 * MetaModelClient, which self-falls-back to the offline stub when no API
 * key is configured.
 */
export function createChatProvider(
  options: MetaModelClientOptions = {},
): ChatCompletionProvider {
  return new MetaModelClient(options);
}

export interface ChatProviderStatus {
  mode: "live" | "offline";
  /** The model id that answers when mode is "live". */
  model: string;
  label: string;
}

/**
 * The LIVE/OFFLINE signal for badges, derived from the same key-presence
 * check the client itself uses. Unknown provider implementations are
 * reported as offline rather than guessed live.
 */
export function getChatProviderStatus(
  provider: ChatCompletionProvider,
): ChatProviderStatus {
  if (provider instanceof MetaModelClient) {
    if (provider.isLive) {
      return {
        mode: "live",
        model: provider.configuredModel,
        label: `Live — Meta Model API · ${provider.configuredModel}`,
      };
    }
    return {
      mode: "offline",
      model: provider.configuredModel,
      label: "Offline fallback — no API key connected",
    };
  }
  if (provider instanceof OfflineStubProvider) {
    return {
      mode: "offline",
      model: DEFAULT_META_MODEL_MODEL,
      label: "Offline fallback — no API key connected",
    };
  }
  return {
    mode: "offline",
    model: DEFAULT_META_MODEL_MODEL,
    label: "Offline fallback — no API key connected",
  };
}

/**
 * Thin Oracle Agent wiring: prefixes a ring-scoped system message (per the
 * Oracle guardrail in AGENT_REGISTRY — cite consented sources only) and
 * delegates the chat to the given provider.
 */
export async function oracleChat(
  context: AgentContext,
  messages: MetaModelMessage[],
  provider: ChatCompletionProvider,
): Promise<MetaModelChatResponse> {
  const systemMessage: MetaModelMessage = {
    role: "system",
    content:
      `You are the Oracle Agent for the Omega Platform. Answer only from ` +
      `sources consented in the '${context.ring}' ring and cite them.`,
  };
  return provider.chat({ messages: [systemMessage, ...messages] });
}
