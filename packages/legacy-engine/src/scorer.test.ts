import { describe, expect, it } from "vitest";

import { SYNTHETIC_LEGACY_MEMORIES } from "./test-fixtures.js";

import { VersionedMemoryVault } from "./vault.js";
import { auditArchive, scoreClaims } from "./scorer.js";
import type { ArchiveClaim } from "./scorer.js";

const TS = "2026-10-27T00:00:00.000Z";

function seededVault(): VersionedMemoryVault {
  return new VersionedMemoryVault(SYNTHETIC_LEGACY_MEMORIES, {
    actor: "scorer-test",
    timestamp: TS,
  });
}

describe("scoreClaims", () => {
  it("passes a supported claim clean (mem-008 lighthouse facts)", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-supported",
        text: "Elias spent the summer of 1968 at Port Anselm Lighthouse with Captain Bram Ellery.",
        person: "Captain Bram Ellery",
        place: "Port Anselm Lighthouse",
        year: 1968,
        memoryId: "mem-008",
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.claimsChecked).toBe(1);
    expect(report.memoriesChecked).toBe(SYNTHETIC_LEGACY_MEMORIES.length);
    expect(report.flags).toEqual([]);
    expect(report.score).toBe(1);
  });

  it("supports an unpinned claim when one memory matches every field", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-unpinned",
        text: "The family sailed on Lake Anselm in 1987 with Helena Marlowe.",
        person: "Helena Marlowe",
        place: "Lake Anselm",
        year: 1987,
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.flags).toEqual([]);
    expect(report.score).toBe(1);
  });

  it("catches a planted contradiction: wrong year for a known memoryId", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-contradiction",
        text: "The lighthouse summer was in 1975.",
        person: "Captain Bram Ellery",
        place: "Port Anselm Lighthouse",
        year: 1975,
        memoryId: "mem-008",
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.score).toBe(0);
    expect(report.flags.length).toBe(1);
    expect(report.flags[0]?.kind).toBe("contradiction");
    expect(report.flags[0]?.claimId).toBe("c-contradiction");
    expect(report.flags[0]?.memoryIds).toContain("mem-008");
  });

  it("catches a same-event place contradiction without a memoryId", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-place-conflict",
        text: "In 1968 Captain Bram Ellery was with Elias in Willow Creek.",
        person: "Captain Bram Ellery",
        place: "Willow Creek",
        year: 1968,
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.flags.length).toBe(1);
    expect(report.flags[0]?.kind).toBe("contradiction");
    expect(report.flags[0]?.memoryIds).toContain("mem-008");
  });

  it("flags an unsupported claim whose fields exist nowhere together", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-unsupported",
        text: "Elias travelled to Antarctica in 1990 with Helena Reyes.",
        person: "Helena Reyes",
        place: "Antarctica",
        year: 1990,
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.score).toBe(0);
    expect(report.flags.length).toBe(1);
    expect(report.flags[0]?.kind).toBe("unsupported");
    expect(report.flags[0]?.claimId).toBe("c-unsupported");
  });

  it("flags a claim referencing an unknown memoryId as unsupported", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-unknown-memory",
        text: "A claim about a memory the archive does not hold.",
        memoryId: "mem-999",
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.flags.length).toBe(1);
    expect(report.flags[0]?.kind).toBe("unsupported");
  });

  it("scores the supported fraction across a mixed claim set", () => {
    const claims: ArchiveClaim[] = [
      {
        id: "c-ok",
        text: "Lighthouse summer, 1968.",
        person: "Captain Bram Ellery",
        place: "Port Anselm Lighthouse",
        year: 1968,
      },
      {
        id: "c-bad",
        text: "Antarctica, 1990.",
        person: "Helena Reyes",
        place: "Antarctica",
        year: 1990,
      },
    ];
    const report = scoreClaims(seededVault(), claims);
    expect(report.claimsChecked).toBe(2);
    expect(report.score).toBe(0.5);
  });

  it("returns score 1 with claimsChecked 0 for an empty claim set", () => {
    const report = scoreClaims(seededVault(), []);
    expect(report).toEqual({
      score: 1,
      claimsChecked: 0,
      memoriesChecked: SYNTHETIC_LEGACY_MEMORIES.length,
      flags: [],
    });
  });
});

describe("auditArchive", () => {
  it("audits the shipped synthetic archive clean", () => {
    const report = auditArchive(seededVault());
    expect(report.memoriesChecked).toBe(SYNTHETIC_LEGACY_MEMORIES.length);
    expect(report.claimsChecked).toBe(SYNTHETIC_LEGACY_MEMORIES.length);
    expect(report.flags).toEqual([]);
    expect(report.score).toBe(1);
  });

  it("catches a year-vs-date inconsistency introduced by an amend", () => {
    const vault = seededVault();
    vault.amend(
      "mem-008",
      { year: 1970 },
      { actor: "scorer-test", timestamp: TS },
    );
    const report = auditArchive(vault);
    expect(report.score).toBeLessThan(1);
    expect(
      report.flags.some(
        (flag) =>
          flag.kind === "contradiction" && flag.memoryIds.includes("mem-008"),
      ),
    ).toBe(true);
  });

  it("catches two memories sharing a title with different years", () => {
    const vault = seededVault();
    vault.create(
      {
        id: "mem-duplicate",
        title: "The Sailboat Kestrel",
        date: "1999-07-18",
        year: 1999,
        era: "family",
        people: ["Helena Marlowe"],
        place: "Lake Anselm",
        text: "A second record with the same title but a different year.",
        sourceType: "photo",
        ring: "family",
      },
      { actor: "scorer-test", timestamp: TS },
    );
    const report = auditArchive(vault);
    expect(report.score).toBeLessThan(1);
    expect(
      report.flags.some(
        (flag) =>
          flag.kind === "contradiction" &&
          flag.memoryIds.includes("mem-023") &&
          flag.memoryIds.includes("mem-duplicate"),
      ),
    ).toBe(true);
  });
});
