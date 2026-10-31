/**
 * @omega/ai-core — Legacy Mirror / Eternal Garden types
 *
 * The Legacy Mirror answers questions about a member's life archive
 * (the Eternal Garden) only from memories inside the archive's consent
 * ring, citing the memories behind every claim, and abstaining — never
 * inventing — when no memory supports an answer. Out-of-ring viewers
 * are refused by the Guardian before any retrieval happens.
 *
 * The bundled archive is synthetic demo data: a fictional member, no
 * real personal data.
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

export const LEGACY_ERAS: readonly LegacyEra[] = [
  "childhood",
  "youth",
  "career",
  "family",
  "later-years",
] as const;

export const LEGACY_ERA_LABELS: Record<LegacyEra, string> = {
  childhood: "Childhood",
  youth: "Youth",
  career: "Career",
  family: "Family",
  "later-years": "Later Years",
};

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

export interface LegacyMemberProfile {
  /** Fictional demo member name — not a real person. */
  name: string;
  birthYear: number;
  homeTown: string;
  archiveLabel: string;
  synthetic: true;
}

/** One grounded claim in an answer. Every claim carries ≥1 citation. */
export interface LegacyClaim {
  text: string;
  /** Memory ids that support this claim. Never empty on an answer. */
  citations: string[];
}

/** Provenance entry for one cited memory — the badge's source list. */
export interface LegacyProvenanceSource {
  id: string;
  title: string;
  date: string;
  year: number;
  era: LegacyEra;
  sourceType: LegacySourceType;
  ring: RingType;
}

/**
 * "Official Personal AI" provenance structure attached to every result.
 * Judges / UIs render `badge` + `label` and the `sources` list verbatim.
 */
export interface LegacyProvenance {
  badge: "Official Personal AI";
  label: string;
  memberName: string;
  archiveLabel: string;
  /** The Q&A runs on deterministic local logic — never a live AI call. */
  engine: "local-legacy-logic";
  viewerRing: RingType;
  requiredRing: RingType;
  sources: LegacyProvenanceSource[];
}

export type LegacyAnswerKind = "answered" | "refused" | "abstained";

export interface LegacyAnswer {
  kind: LegacyAnswerKind;
  refused: boolean;
  abstained: boolean;
  text: string;
  /** Grounded claims; empty on refusal / abstention. */
  claims: LegacyClaim[];
  /** Flat list of cited memory ids (union of claim citations). */
  citations: string[];
  provenance: LegacyProvenance;
  viewerRing: RingType;
  /** The ring the archive lives in (the boundary on a refusal). */
  requiredRing: RingType;
  boundaryRing?: RingType;
  backend: "local-legacy-logic" | "guardian";
}

export interface LegacyQueryOptions {
  /** The ring the viewer is asking from. */
  viewerRing: RingType;
  /**
   * The viewer's consent receipt. Defaults to a demo receipt for
   * `viewerRing` (see demoReceiptForRing) so the demo can be driven by
   * a ring selector alone; pass an explicit receipt to model revoked /
   * expired / mismatched consent.
   */
  receipt?: import("@omega/consent-core").ConsentReceipt | null;
  /** Archive to answer from. Defaults to the synthetic demo archive. */
  memories?: readonly LegacyMemory[];
  /** Evaluation time for receipt activity. Defaults to now. */
  now?: Date;
}
