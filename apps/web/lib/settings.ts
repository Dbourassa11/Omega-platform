// Shared user settings for the Omega Platform web shell.
// Persisted only in this browser (localStorage "omega.settings.v1");
// changes broadcast on the "omega:settings" window event so live pages
// (notably the Cosmos page) can react without a reload.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

export interface OmegaSettings {
  quality: "auto" | "high" | "low";
  reducedMotion: boolean;
}

const STORAGE_KEY = "omega.settings.v1";
const EVENT_NAME = "omega:settings";

export const DEFAULT_SETTINGS: OmegaSettings = {
  quality: "auto",
  reducedMotion: false,
};

export function readSettings(): OmegaSettings {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_SETTINGS };
    }
    const p = parsed as Partial<OmegaSettings>;
    return {
      quality:
        p.quality === "high" || p.quality === "low" || p.quality === "auto"
          ? p.quality
          : DEFAULT_SETTINGS.quality,
      reducedMotion:
        typeof p.reducedMotion === "boolean"
          ? p.reducedMotion
          : DEFAULT_SETTINGS.reducedMotion,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(s: OmegaSettings): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Storage unavailable — settings apply for this session only.
  }
}
