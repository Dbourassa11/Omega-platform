/**
 * @omega/legacy-engine
 *
 * WORKING mechanical core for the Legacy Ingestion Engine /
 * Continuity Engine, per Implementation Plan Step 6 and Omega
 * Platform Phase 3: a versioned memory vault plus a consistency
 * scorer over the Eternal Garden archive (@omega/ai-core).
 *
 * Scope note (honest): this is the mechanical core only — in-memory,
 * no persistence layer yet, no ingestion pipeline runtime. Every
 * memory is versioned; nothing is silently rewritten; claims must
 * trace to the archive.
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

export type PipelineStage =
  | "authorization-gate"
  | "file-intake"
  | "fingerprinting"
  | "encryption"
  | "extraction"
  | "embedding"
  | "persona-profile"
  | "interaction-runtime";

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "authorization-gate",
  "file-intake",
  "fingerprinting",
  "encryption",
  "extraction",
  "embedding",
  "persona-profile",
  "interaction-runtime",
] as const;

export interface IngestionItem {
  id: string;
  sourceType: "email" | "voice" | "text" | "social" | "photo" | "video";
  ring: RingType;
  sha256: string;
  status: PipelineStage | "rejected" | "complete";
}

export interface PersonaProfile {
  nodeId: string;
  version: number;
  driftPercentage: number;
}

export const SAFETY_RULES: readonly string[] = [
  "No unsupervised personality drift",
  "No fabricated memories presented as fact",
  "No voice cloning without explicit documented authorization",
  "Clear labels: simulated reflection, not literal consciousness",
  "Guardian review for sensitive memories, minors, medical/legal content, posthumous rights",
] as const;

export const LEGACY_ENGINE_STATUS = "WORKING" as const;

export const LEGACY_ENGINE_SCOPE =
  "Mechanical core: versioned memory vault + consistency scorer over the Eternal Garden archive; no persistence layer yet." as const;

export {
  VersionedMemoryVault,
  canonicalMemoryJson,
  computeMemoryHash,
  fnv1a32,
  verifyVersionChain,
} from "./vault.js";
export type {
  MemoryMutationMeta,
  MemoryReceipt,
  MemoryVersion,
} from "./vault.js";

export { ERA_YEAR_RANGES, auditArchive, scoreClaims } from "./scorer.js";
export type {
  ArchiveClaim,
  ConsistencyReport,
  ScorerFlag,
} from "./scorer.js";
