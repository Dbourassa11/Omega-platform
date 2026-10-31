// Hand-off channel between the Creative Suites and the Share Center.
// A suite calls sendToShareCenter(draft); the Share Center calls
// takeShareDraft() once to pick it up (read-and-clear). Stored only in
// this browser (localStorage "omega.shareDraft.v1").
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import type { RingType } from "@omega/consent-core";

export interface ShareDraft {
  title: string;
  body: string;
  suite: "art" | "music" | "video" | "write";
  ring: RingType;
}

const STORAGE_KEY = "omega.shareDraft.v1";
const SUITES: readonly ShareDraft["suite"][] = ["art", "music", "video", "write"];
const RINGS: readonly RingType[] = ["family", "friends", "work", "public"];

export function sendToShareCenter(draft: ShareDraft): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable — the draft simply does not carry over.
  }
}

export function takeShareDraft(): ShareDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const d = parsed as Partial<ShareDraft>;
    if (
      typeof d.title !== "string" ||
      typeof d.body !== "string" ||
      !SUITES.includes(d.suite as ShareDraft["suite"]) ||
      !RINGS.includes(d.ring as RingType)
    ) {
      return null;
    }
    return d as ShareDraft;
  } catch {
    return null;
  }
}
