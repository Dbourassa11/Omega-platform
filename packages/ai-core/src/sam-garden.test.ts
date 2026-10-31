import { describe, expect, it } from "vitest";

import {
  SAM_MODEL_ID_CANDIDATES,
  SamNotYetAvailableError,
  UnavailableSamTaggingProvider,
} from "./sam-garden.js";

describe("SAM garden tagging — design-only seam", () => {
  it("records both unresolved model-id spellings without asserting one", () => {
    expect(SAM_MODEL_ID_CANDIDATES).toEqual(["sam-3-1", "sam-3.1"]);
  });

  it("the only provider throws a labelled not-yet-available error", async () => {
    const provider = new UnavailableSamTaggingProvider();
    const error: unknown = await provider
      .tag({
        mediaRef: "garden-photo-001",
        mediaKind: "image",
        textPrompt: "rose",
        ring: "family",
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SamNotYetAvailableError);
    expect((error as SamNotYetAvailableError).code).toBe("not_yet_available");
    expect((error as Error).message).toContain("not yet available");
  });
});
