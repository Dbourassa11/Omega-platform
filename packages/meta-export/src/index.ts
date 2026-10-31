/**
 * @omega/meta-export
 *
 * Facebook "Download Your Information" (DYI) export ingest for the
 * Omega Platform: a synthetic fixture generator, a parser /
 * normalizer with consent-ring inference, and a converter to
 * cosmos-engine data. Synthetic fixtures only — no real personal
 * data is bundled, produced, or expected by the tests.
 *
 * Creator: David Charles Bourassa
 */

export type {
  ExportFileEntry,
  NormalizedMedia,
  NormalizedMemberGraph,
  NormalizedPerson,
  NormalizedPost,
  NormalizedThread,
  RingCounts,
  RingOverride,
  RingSource,
} from "./types.js";

export { parseFacebookExport } from "./parser.js";
export { graphToCosmosData } from "./cosmos.js";
export { generateSyntheticExport, SYNTHETIC_EXPORT_OWNER_NAME } from "./generator.js";
