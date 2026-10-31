/**
 * @omega/ai-core — Legacy Mirror answering logic (pure, local)
 *
 * Given a question and a viewer ring:
 *   (a) Consent gate first — if @omega/consent-core's canAccess denies
 *       the viewer the archive's ring, the Guardian refuses and names
 *       the boundary. No retrieval happens at all.
 *   (b) Retrieval — keyword/field matching over the archive only.
 *   (c) Abstention — if no memory supports an answer, the Mirror says
 *       so plainly. It never invents details beyond the archive.
 *   (d) Answer — composed ONLY from the retrieved memories, as claims
 *       that each carry their memory-id citations, plus an "Official
 *       Personal AI" provenance structure listing every source.
 *
 * This is deterministic local logic — no live AI call is made.
 *
 * Creator: David Charles Bourassa
 */

import { canAccess } from "@omega/consent-core";
import type { RingType } from "@omega/consent-core";

import {
  LEGACY_ARCHIVE_RING,
  LEGACY_MEMBER,
  SYNTHETIC_LEGACY_MEMORIES,
  demoReceiptForRing,
} from "./dataset.js";
import type {
  LegacyAnswer,
  LegacyClaim,
  LegacyMemory,
  LegacyProvenance,
  LegacyProvenanceSource,
  LegacyQueryOptions,
} from "./types.js";

const MAX_SOURCES = 4;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for",
  "with", "by", "from", "about", "tell", "me", "did", "do", "does",
  "was", "were", "is", "are", "what", "when", "where", "who", "how",
  "why", "his", "her", "their", "he", "she", "they", "it", "its",
  "please", "show", "give", "any", "ever", "elias", "marlowe",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

interface ScoredMemory {
  memory: LegacyMemory;
  score: number;
}

function scoreMemory(memory: LegacyMemory, tokens: readonly string[]): number {
  const title = memory.title.toLowerCase();
  const fields = [
    memory.place.toLowerCase(),
    memory.era,
    memory.sourceType,
    ...memory.people.map((person) => person.toLowerCase()),
  ].join(" ");
  const body = memory.text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (fields.includes(token)) score += 2;
    if (body.includes(token)) score += 1;
  }
  return score;
}

export function retrieveMemories(
  question: string,
  memories: readonly LegacyMemory[],
): LegacyMemory[] {
  const tokens = [...new Set(tokenize(question))];
  if (tokens.length === 0) return [];
  return memories
    .map((memory): ScoredMemory => ({ memory, score: scoreMemory(memory, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.memory.year - b.memory.year)
    .slice(0, MAX_SOURCES)
    .map((entry) => entry.memory);
}

function toProvenanceSource(memory: LegacyMemory): LegacyProvenanceSource {
  return {
    id: memory.id,
    title: memory.title,
    date: memory.date,
    year: memory.year,
    era: memory.era,
    sourceType: memory.sourceType,
    ring: memory.ring,
  };
}

function makeProvenance(
  viewerRing: RingType,
  sources: readonly LegacyProvenanceSource[],
): LegacyProvenance {
  return {
    badge: "Official Personal AI",
    label:
      "Official Personal AI — grounded only in the member's own consented archive",
    memberName: LEGACY_MEMBER.name,
    archiveLabel: LEGACY_MEMBER.archiveLabel,
    engine: "local-legacy-logic",
    viewerRing,
    requiredRing: LEGACY_ARCHIVE_RING,
    sources: [...sources],
  };
}

/**
 * Answer a question about the legacy archive, scoped by consent.
 * Pure and synchronous: same inputs, same answer, no I/O, no live AI.
 */
export function answerLegacyQuery(
  question: string,
  options: LegacyQueryOptions,
): LegacyAnswer {
  const viewerRing = options.viewerRing;
  const requiredRing: RingType = LEGACY_ARCHIVE_RING;
  const memories = options.memories ?? SYNTHETIC_LEGACY_MEMORIES;
  const now = options.now ?? new Date();
  const receipt =
    options.receipt !== undefined
      ? options.receipt
      : demoReceiptForRing(viewerRing);

  // (a) Consent gate — Guardian refusal before any retrieval.
  if (!canAccess(requiredRing, receipt, now)) {
    return {
      kind: "refused",
      refused: true,
      abstained: false,
      text:
        `Guardian: the Eternal Garden archive of ${LEGACY_MEMBER.name} ` +
        `lives in the ${requiredRing} ring. You are asking from the ` +
        `${viewerRing} ring, and consent does not cross ring boundaries ` +
        `— I can't retrieve any of it. A ${requiredRing}-ring viewer with ` +
        `the owner's active consent may ask about this archive.`,
      claims: [],
      citations: [],
      provenance: makeProvenance(viewerRing, []),
      viewerRing,
      requiredRing,
      boundaryRing: requiredRing,
      backend: "guardian",
    };
  }

  // (b) Retrieval over the archive only.
  const retrieved = retrieveMemories(question, memories);

  // (c) Abstention — never invent beyond the archive.
  if (retrieved.length === 0) {
    return {
      kind: "abstained",
      refused: false,
      abstained: true,
      text:
        `The Legacy Mirror abstains: no memory in ${LEGACY_MEMBER.name}'s ` +
        `${requiredRing}-ring archive supports an answer to that question. ` +
        `The archive holds ${memories.length} memories, and the Mirror ` +
        `answers only from them — it will not invent details the archive ` +
        `does not contain.`,
      claims: [],
      citations: [],
      provenance: makeProvenance(viewerRing, []),
      viewerRing,
      requiredRing,
      backend: "local-legacy-logic",
    };
  }

  // (d) Grounded answer — one claim per source memory, each cited.
  const claims: LegacyClaim[] = retrieved.map((memory) => ({
    text:
      `“${memory.title}” (${memory.year}, ${memory.place}): ${memory.text}`,
    citations: [memory.id],
  }));
  const sources = retrieved.map(toProvenanceSource);
  const citations = [...new Set(claims.flatMap((claim) => claim.citations))];
  const claimText = claims.map((claim) => claim.text).join(" ");

  return {
    kind: "answered",
    refused: false,
    abstained: false,
    text:
      `From ${LEGACY_MEMBER.name}'s ${requiredRing}-ring archive ` +
      `(${sources.length} source${sources.length === 1 ? "" : "s"}): ` +
      claimText,
    claims,
    citations,
    provenance: makeProvenance(viewerRing, sources),
    viewerRing,
    requiredRing,
    backend: "local-legacy-logic",
  };
}
