/**
 * @omega/legacy-engine — archive record types (local, self-contained)
 *
 * LegacyMemory and its supporting unions are defined HERE, in
 * legacy-engine, so this package has no dependency on @omega/ai-core.
 * (ai-core's agent fabric depends on legacy-engine's vault/scorer; the
 * reverse type-only import of LegacyMemory from ai-core closed a
 * workspace dependency cycle that aborted the turbo build graph.)
 *
 * The shapes below are intentionally IDENTICAL — field for field, in
 * the same order — to @omega/ai-core's LegacyMemory in
 * packages/ai-core/src/legacy/types.ts. TypeScript is structural, so
 * ai-core's own memories (and the web app's garden page, which seeds
 * the vault from ai-core's SYNTHETIC_LEGACY_MEMORIES) pass into the
 * vault and scorer with no adapter and no behavior change. If the
 * archive record shape ever changes, change BOTH definitions together.
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

export type LegacyEra =
  | "childhood"
  | "youth"
  | "career"
  | "family"
  | "later-years";

export type LegacySourceType =
  | "journal"
  | "photo"
  | "letter"
  | "recording"
  | "document"
  | "keepsake";

/** One archived memory in a member's life archive. */
export interface LegacyMemory {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD); the day may be approximate in demo data. */
  date: string;
  year: number;
  era: LegacyEra;
  people: string[];
  place: string;
  text: string;
  sourceType: LegacySourceType;
  ring: RingType;
}
