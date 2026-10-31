/**
 * @omega/ai-core — Legacy Mirror / Eternal Garden
 *
 * Consent-bound Q&A over a member's life archive (Digital Mirror
 * System), with an "Official Personal AI" provenance badge on every
 * result. The bundled archive is synthetic demo data — a fictional
 * member, no real personal data.
 *
 * Creator: David Charles Bourassa
 */

export {
  LEGACY_ERAS,
  LEGACY_ERA_LABELS,
} from "./types.js";
export type {
  LegacyAnswer,
  LegacyAnswerKind,
  LegacyClaim,
  LegacyEra,
  LegacyMemberProfile,
  LegacyMemory,
  LegacyProvenance,
  LegacyProvenanceSource,
  LegacyQueryOptions,
  LegacySourceType,
} from "./types.js";

export {
  LEGACY_ARCHIVE_RING,
  LEGACY_DEMO_RECEIPT_ID,
  LEGACY_MEMBER,
  SYNTHETIC_LEGACY_MEMORIES,
  demoReceiptForRing,
  memoriesByEra,
} from "./dataset.js";

export { answerLegacyQuery, retrieveMemories } from "./answer.js";
