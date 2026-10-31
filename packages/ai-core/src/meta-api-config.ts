/**
 * @omega/ai-core — Meta Model API configuration (single source of truth)
 *
 * Every Meta Model API surface (chat, image, badges) resolves its
 * configuration through this module, so LIVE/OFFLINE everywhere flips
 * from the SAME signal: whether an API key is present after the fallback
 * chain below. Creator: David Charles Bourassa.
 *
 * STATUS: No API key exists yet. Nothing here claims a live integration;
 * `live` simply means "a key is configured", never "a call succeeded".
 *
 * Env var NAMES (values are never read anywhere except the key presence
 * check and the client constructors — see docs/META_API_NOTES.md §5):
 *   META_MODEL_API_KEY    project name for the key (primary)
 *   MODEL_API_KEY         Meta's documented name (fallback alias)
 *   META_MODEL_BASE_URL   base URL override
 *   META_MODEL_MODEL      chat model id override
 *   META_MODEL_IMAGE_MODEL image model id override
 */

export const META_MODEL_API_KEY_ENV = "META_MODEL_API_KEY" as const;
export const META_MODEL_API_KEY_FALLBACK_ENV = "MODEL_API_KEY" as const;
export const META_MODEL_BASE_URL_ENV = "META_MODEL_BASE_URL" as const;
export const META_MODEL_MODEL_ENV = "META_MODEL_MODEL" as const;
export const META_MODEL_IMAGE_MODEL_ENV = "META_MODEL_IMAGE_MODEL" as const;

export const DEFAULT_META_API_BASE_URL = "https://api.meta.ai/v1";

/** Newest documented Muse Spark chat model id (see META_API_NOTES §1). */
export const DEFAULT_META_CHAT_MODEL = "muse-spark-1.3";

/** Model id confirmed on a Meta page opened 2026-10-26 (Meta's example). */
export const META_CONFIRMED_CHAT_MODEL = "muse-spark-1.1";

/** Documented Muse Image model id (see META_API_NOTES §2). */
export const DEFAULT_META_IMAGE_MODEL = "muse-image-1.0";

/** Minimal structural env shape so tests can pass a fake environment. */
export type MetaApiEnv = Record<string, string | undefined>;

export interface MetaApiConfig {
  /** True when a non-empty key is present after the fallback chain. */
  keyPresent: boolean;
  baseUrl: string;
  chatModel: string;
  imageModel: string;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value !== "" ? value : undefined;
}

/**
 * Resolve the effective key from an environment: the project's
 * META_MODEL_API_KEY first, then Meta's documented MODEL_API_KEY.
 * Returns only presence — the value itself never leaves the clients.
 */
export function resolveMetaApiKey(
  env: MetaApiEnv = process.env,
): string | undefined {
  return (
    nonEmpty(env[META_MODEL_API_KEY_ENV]) ??
    nonEmpty(env[META_MODEL_API_KEY_FALLBACK_ENV])
  );
}

export function resolveMetaApiConfig(
  env: MetaApiEnv = process.env,
): MetaApiConfig {
  const baseUrl = (
    nonEmpty(env[META_MODEL_BASE_URL_ENV]) ?? DEFAULT_META_API_BASE_URL
  ).replace(/\/+$/, "");
  return {
    keyPresent: resolveMetaApiKey(env) !== undefined,
    baseUrl,
    chatModel: nonEmpty(env[META_MODEL_MODEL_ENV]) ?? DEFAULT_META_CHAT_MODEL,
    imageModel:
      nonEmpty(env[META_MODEL_IMAGE_MODEL_ENV]) ?? DEFAULT_META_IMAGE_MODEL,
  };
}

export type MetaApiMode = "live" | "offline";

export interface MetaApiStatus {
  mode: MetaApiMode;
  /** The chat model id that will answer when mode is "live". */
  chatModel: string;
  imageModel: string;
  baseUrl: string;
  /** Honest human label; never claims a successful live call. */
  label: string;
}

/**
 * The one status every AI surface should display. When a key is present
 * the label names the answering model id; otherwise it says plainly that
 * no API key is connected and the offline fallback is in use.
 */
export function getMetaApiStatus(env: MetaApiEnv = process.env): MetaApiStatus {
  const config = resolveMetaApiConfig(env);
  if (config.keyPresent) {
    return {
      mode: "live",
      chatModel: config.chatModel,
      imageModel: config.imageModel,
      baseUrl: config.baseUrl,
      label: `Live — Meta Model API · ${config.chatModel}`,
    };
  }
  return {
    mode: "offline",
    chatModel: config.chatModel,
    imageModel: config.imageModel,
    baseUrl: config.baseUrl,
    label: "Offline fallback — no API key connected",
  };
}
