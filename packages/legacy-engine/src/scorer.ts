/**
 * @omega/legacy-engine — Consistency Scorer (Continuity Engine core)
 *
 * Real-data-only rule, enforced in code: a claim is SUPPORTED only
 * when a single memory in the vault matches every structured field the
 * claim provides (person ∈ memory.people, place === memory.place,
 * year === memory.year). The scorer never consults outside data and
 * never invents a match. Deterministic: flags are emitted in claim
 * order, with memory ids in vault order.
 *
 * Definitions (see README for the full statement):
 * - SUPPORTED: one memory matches all provided structured fields.
 *   A claim with a memoryId is supported only when that memory matches
 *   all its provided fields (the memoryId pins the event).
 * - CONTRADICTION: (a) a claim pins a memoryId whose memory has a
 *   different year than the claim's year, or whose place/person does
 *   not match the claim's place/person; or (b) a claim without a
 *   memoryId provides person + year + place, no single memory supports
 *   all three, but some memory matches person + year while differing
 *   in place (same event, conflicting fact).
 * - UNSUPPORTED: no supporting memory and no contradiction rule fires
 *   — the fields match different memories partially, or not at all.
 *
 * Score = supported claims / total claims; with zero claims the score
 * is 1 (an empty claim set contains no contradiction).
 *
 * Creator: David Charles Bourassa
 */

import type { LegacyMemory } from "./types.js";

import type { VersionedMemoryVault } from "./vault.js";

export interface ArchiveClaim {
  id: string;
  text: string;
  person?: string;
  place?: string;
  year?: number;
  memoryId?: string;
}

export interface ScorerFlag {
  kind: "contradiction" | "unsupported";
  claimId?: string;
  memoryIds: string[];
  detail: string;
}

export interface ConsistencyReport {
  score: number;
  claimsChecked: number;
  memoriesChecked: number;
  flags: ScorerFlag[];
}

function hasStructuredFields(claim: ArchiveClaim): boolean {
  return (
    claim.person !== undefined ||
    claim.place !== undefined ||
    claim.year !== undefined
  );
}

function matchesFields(memory: LegacyMemory, claim: ArchiveClaim): boolean {
  if (claim.person !== undefined && !memory.people.includes(claim.person)) {
    return false;
  }
  if (claim.place !== undefined && memory.place !== claim.place) {
    return false;
  }
  if (claim.year !== undefined && memory.year !== claim.year) {
    return false;
  }
  return true;
}

function partialMatchIds(
  memories: readonly LegacyMemory[],
  claim: ArchiveClaim,
): string[] {
  const ids: string[] = [];
  for (const memory of memories) {
    const partial =
      (claim.person !== undefined && memory.people.includes(claim.person)) ||
      (claim.place !== undefined && memory.place === claim.place) ||
      (claim.year !== undefined && memory.year === claim.year);
    if (partial) ids.push(memory.id);
  }
  return ids;
}

type ClaimVerdict =
  | { status: "supported" }
  | { status: "contradiction" | "unsupported"; flag: ScorerFlag };

function verdictForClaim(
  memories: readonly LegacyMemory[],
  byId: Map<string, LegacyMemory>,
  claim: ArchiveClaim,
): ClaimVerdict {
  const claimId = claim.id;

  // Pinned-memory claims: the memoryId is the event.
  if (claim.memoryId !== undefined) {
    const pinned = byId.get(claim.memoryId);
    if (!pinned) {
      return {
        status: "unsupported",
        flag: {
          kind: "unsupported",
          claimId,
          memoryIds: [],
          detail: `Claim references unknown memory ${claim.memoryId}; no archive record supports it.`,
        },
      };
    }
    if (matchesFields(pinned, claim)) {
      return { status: "supported" };
    }
    const mismatches: string[] = [];
    if (claim.year !== undefined && pinned.year !== claim.year) {
      mismatches.push(`year ${claim.year} but the memory records ${pinned.year}`);
    }
    if (claim.place !== undefined && pinned.place !== claim.place) {
      mismatches.push(
        `place "${claim.place}" but the memory records "${pinned.place}"`,
      );
    }
    if (claim.person !== undefined && !pinned.people.includes(claim.person)) {
      mismatches.push(
        `person "${claim.person}" is not listed in the memory's people`,
      );
    }
    return {
      status: "contradiction",
      flag: {
        kind: "contradiction",
        claimId,
        memoryIds: [pinned.id],
        detail: `Claim about memory ${pinned.id} conflicts with the archive: ${mismatches.join("; ")}.`,
      },
    };
  }

  if (!hasStructuredFields(claim)) {
    return {
      status: "unsupported",
      flag: {
        kind: "unsupported",
        claimId,
        memoryIds: [],
        detail:
          "Claim provides no person, place, year, or memory reference, so no archive record can support it.",
      },
    };
  }

  if (memories.some((memory) => matchesFields(memory, claim))) {
    return { status: "supported" };
  }

  // Same-event, conflicting-fact check: person + year match a memory
  // but the place differs.
  if (
    claim.person !== undefined &&
    claim.year !== undefined &&
    claim.place !== undefined
  ) {
    const sameEventDifferentPlace = memories.filter(
      (memory) =>
        memory.people.includes(claim.person as string) &&
        memory.year === claim.year &&
        memory.place !== claim.place,
    );
    if (sameEventDifferentPlace.length > 0) {
      return {
        status: "contradiction",
        flag: {
          kind: "contradiction",
          claimId,
          memoryIds: sameEventDifferentPlace.map((m) => m.id),
          detail: `Claim places ${claim.person} in ${claim.place} in ${claim.year}, but the archive places that person in ${sameEventDifferentPlace
            .map((m) => m.place)
            .join(", ")} in that year.`,
        },
      };
    }
  }

  return {
    status: "unsupported",
    flag: {
      kind: "unsupported",
      claimId,
      memoryIds: partialMatchIds(memories, claim),
      detail:
        "No single archive memory matches every provided field (person, place, year); fields match different memories partially or not at all.",
    },
  };
}

export function scoreClaims(
  vault: VersionedMemoryVault,
  claims: readonly ArchiveClaim[],
): ConsistencyReport {
  const memories = vault.list();
  const byId = new Map(memories.map((m) => [m.id, m]));
  const flags: ScorerFlag[] = [];
  let supported = 0;
  for (const claim of claims) {
    const verdict = verdictForClaim(memories, byId, claim);
    if (verdict.status === "supported") {
      supported += 1;
    } else {
      flags.push(verdict.flag);
    }
  }
  const score = claims.length === 0 ? 1 : supported / claims.length;
  return {
    score,
    claimsChecked: claims.length,
    memoriesChecked: memories.length,
    flags,
  };
}

/**
 * Era year spans derived from the synthetic archive itself
 * (packages/ai-core/src/legacy/dataset.ts section headers and the
 * years actually recorded under each era): childhood 1952–1964,
 * youth 1965–1973, career 1974–1999, family 1978–2005,
 * later-years 2006–2024. Note career and family overlap — a year
 * fitting either is not, by itself, an era error; a memory is flagged
 * only when its year falls outside its own era's span.
 */
export const ERA_YEAR_RANGES: Record<
  LegacyMemory["era"],
  { min: number; max: number }
> = {
  childhood: { min: 1952, max: 1964 },
  youth: { min: 1965, max: 1973 },
  career: { min: 1974, max: 1999 },
  family: { min: 1978, max: 2005 },
  "later-years": { min: 2006, max: 2024 },
};

export function auditArchive(
  vault: VersionedMemoryVault,
): ConsistencyReport {
  const memories = vault.list();

  // One derived claim per memory, from its own people[0] / place / year.
  const derived: ArchiveClaim[] = memories.map((memory) => ({
    id: `audit-${memory.id}`,
    text: `Memory ${memory.id} records its first-listed person at its place in its year.`,
    ...(memory.people[0] !== undefined ? { person: memory.people[0] } : {}),
    place: memory.place,
    year: memory.year,
    memoryId: memory.id,
  }));
  const base = scoreClaims(vault, derived);

  // Extra archive-level checks (not expressible as single claims):
  // year-vs-date, era-vs-year, and duplicate-title conflicts.
  const extraFlags: ScorerFlag[] = [];
  const failedMemoryIds = new Set<string>();

  for (const flag of base.flags) {
    for (const id of flag.memoryIds) failedMemoryIds.add(id);
    if (flag.claimId !== undefined) {
      failedMemoryIds.add(flag.claimId.replace(/^audit-/, ""));
    }
  }

  for (const memory of memories) {
    const dateYear = Number(memory.date.slice(0, 4));
    if (!Number.isFinite(dateYear) || dateYear !== memory.year) {
      extraFlags.push({
        kind: "contradiction",
        claimId: `audit-${memory.id}`,
        memoryIds: [memory.id],
        detail: `Memory ${memory.id} has year ${memory.year} but its date ${memory.date} falls in ${dateYear}.`,
      });
      failedMemoryIds.add(memory.id);
    }
    const range = ERA_YEAR_RANGES[memory.era];
    if (memory.year < range.min || memory.year > range.max) {
      extraFlags.push({
        kind: "contradiction",
        claimId: `audit-${memory.id}`,
        memoryIds: [memory.id],
        detail: `Memory ${memory.id} is filed under era "${memory.era}" (${range.min}–${range.max}) but its year is ${memory.year}.`,
      });
      failedMemoryIds.add(memory.id);
    }
  }

  const byTitle = new Map<string, LegacyMemory[]>();
  for (const memory of memories) {
    const group = byTitle.get(memory.title) ?? [];
    group.push(memory);
    byTitle.set(memory.title, group);
  }
  for (const [title, group] of byTitle) {
    if (group.length < 2) continue;
    const years = new Set(group.map((m) => m.year));
    const places = new Set(group.map((m) => m.place));
    if (years.size > 1 || places.size > 1) {
      extraFlags.push({
        kind: "contradiction",
        memoryIds: group.map((m) => m.id),
        detail: `Two archive memories share the title "${title}" but record different years (${[...years].join(", ")}) or places (${[...places].join(", ")}).`,
      });
      for (const memory of group) failedMemoryIds.add(memory.id);
    }
  }

  const flags = [...base.flags, ...extraFlags];
  const claimsChecked = derived.length;
  const score =
    claimsChecked === 0
      ? 1
      : Math.max(0, (claimsChecked - failedMemoryIds.size) / claimsChecked);

  return {
    score,
    claimsChecked,
    memoriesChecked: memories.length,
    flags,
  };
}
