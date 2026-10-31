// Shared local activity feed for the Omega Platform web shell.
// Entries live only in this browser (localStorage "omega.activity.v1").
// Other sections call logActivity(); listeners re-read on the
// "omega:activity" window event.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

export interface ActivityEntry {
  ts: number;
  kind: string;
  text: string;
}

const STORAGE_KEY = "omega.activity.v1";
const EVENT_NAME = "omega:activity";
const MAX_ENTRIES = 50;

export function readActivity(): ActivityEntry[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ActivityEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as ActivityEntry).ts === "number" &&
        typeof (e as ActivityEntry).kind === "string" &&
        typeof (e as ActivityEntry).text === "string",
    );
  } catch {
    return [];
  }
}

export function logActivity(kind: string, text: string): void {
  try {
    if (typeof window === "undefined") return;
    const entry: ActivityEntry = { ts: Date.now(), kind, text };
    const next = [entry, ...readActivity()].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Storage full or unavailable — activity is best-effort only.
  }
}
