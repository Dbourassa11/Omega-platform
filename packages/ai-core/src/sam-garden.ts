/**
 * @omega/ai-core — SAM garden tagging (DESIGN ONLY — not implemented)
 *
 * Creator: David Charles Bourassa.
 *
 * Meta's model page CONFIRMS SAM 3.1 is served on the Meta Model API
 * (detect / segment / track from text prompts, returning boxes and
 * pixel-precise masks), but this pass could NOT document its endpoint,
 * request/response shape, or even resolve the model-id spelling
 * (`sam-3-1` on Meta's pricing table vs `sam-3.1` in secondary model
 * lists). See docs/META_API_NOTES.md §4. Per the honesty rule, this
 * module ships types, a provider seam, and a stub that labels itself
 * "not yet available" — no SAM call is implemented as fact.
 */

import type { RingType } from "@omega/consent-core";

export const SAM_GARDEN_STATUS =
  "DESIGN ONLY — SAM 3.1 is on the Meta Model API per Meta's model page, but its endpoint/shape and model-id spelling are undocumented in this pass; no client implemented" as const;

/** The two spellings found in sources; neither is asserted as correct. */
export const SAM_MODEL_ID_CANDIDATES = ["sam-3-1", "sam-3.1"] as const;
export type SamModelIdCandidate = (typeof SAM_MODEL_ID_CANDIDATES)[number];

export interface SamTaggingRequest {
  /** Reference to the garden media item to tag (never raw bytes here). */
  mediaRef: string;
  mediaKind: "image" | "video";
  /** Short noun phrase naming the thing to find, per Meta's SAM overview. */
  textPrompt: string;
  /** Consent ring the media lives in; tags never cross rings. */
  ring: RingType;
  model?: SamModelIdCandidate;
}

export interface SamDetectedObject {
  label: string;
  /** Normalised [x, y, width, height] box, if the API returns one. */
  box?: { x: number; y: number; width: number; height: number };
  /** Opaque mask reference/encoding, if the API returns one. */
  maskRef?: string;
  confidence?: number;
}

export interface SamTaggingResult {
  mediaRef: string;
  model: string;
  backend: "meta-model-api";
  objects: SamDetectedObject[];
  /** Suggested garden tags derived from the detected labels. */
  suggestedTags: string[];
}

export interface SamTaggingProvider {
  tag(request: SamTaggingRequest): Promise<SamTaggingResult>;
}

export class SamNotYetAvailableError extends Error {
  readonly code = "not_yet_available" as const;

  constructor() {
    super(
      "SAM garden tagging is not yet available — SAM 3.1's Model API " +
        "endpoint and request/response shape are not documented yet " +
        "(see docs/META_API_NOTES.md §4). No segmentation was performed.",
    );
    this.name = "SamNotYetAvailableError";
  }
}

/** The only SAM provider in this pass: honestly unavailable. */
export class UnavailableSamTaggingProvider implements SamTaggingProvider {
  async tag(_request: SamTaggingRequest): Promise<SamTaggingResult> {
    throw new SamNotYetAvailableError();
  }
}
