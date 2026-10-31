import { describe, expect, it } from "vitest";

import { SYNTHETIC_LEGACY_MEMORIES } from "./test-fixtures.js";
import type { LegacyMemory } from "./types.js";

import {
  VersionedMemoryVault,
  verifyVersionChain,
} from "./vault.js";

const TS = "2026-10-27T00:00:00.000Z";
const META = { actor: "test-actor", timestamp: TS };

function sample(id: string, patch?: Partial<LegacyMemory>): LegacyMemory {
  return {
    id,
    title: "Sample Memory",
    date: "1968-08-14",
    year: 1968,
    era: "youth",
    people: ["Captain Bram Ellery"],
    place: "Port Anselm Lighthouse",
    text: "Spent the summer at the lighthouse.",
    sourceType: "journal",
    ring: "family",
    ...patch,
  };
}

describe("VersionedMemoryVault — seeding", () => {
  it("creates v1 create receipts for each seeded memory and verifies the chain", () => {
    const vault = new VersionedMemoryVault(SYNTHETIC_LEGACY_MEMORIES, {
      actor: "seed-test",
      timestamp: TS,
    });
    expect(vault.list().length).toBe(SYNTHETIC_LEGACY_MEMORIES.length);
    expect(vault.receipts().length).toBe(SYNTHETIC_LEGACY_MEMORIES.length);
    for (const memory of SYNTHETIC_LEGACY_MEMORIES) {
      const history = vault.history(memory.id);
      expect(history.length).toBe(1);
      expect(history[0]?.receipt.version).toBe(1);
      expect(history[0]?.receipt.kind).toBe("create");
      expect(history[0]?.receipt.versionId).toBe(`${memory.id}@v1`);
      expect(history[0]?.receipt.previousHash).toBeNull();
      expect(history[0]?.receipt.actor).toBe("seed-test");
      expect(history[0]?.receipt.timestamp).toBe(TS);
      expect(vault.verifyChain(memory.id)).toBe(true);
      expect(vault.get(memory.id)).toEqual(memory);
    }
  });

  it("is deterministic: identical seeds produce identical hashes", () => {
    const a = new VersionedMemoryVault(SYNTHETIC_LEGACY_MEMORIES, {
      actor: "seed",
      timestamp: TS,
    });
    const b = new VersionedMemoryVault(SYNTHETIC_LEGACY_MEMORIES, {
      actor: "seed",
      timestamp: TS,
    });
    expect(a.receipts()).toEqual(b.receipts());
  });

  it("list() preserves stable seed order", () => {
    const vault = new VersionedMemoryVault([sample("m-b"), sample("m-a")], META);
    expect(vault.list().map((m) => m.id)).toEqual(["m-b", "m-a"]);
  });
});

describe("VersionedMemoryVault — mutations append versions", () => {
  it("amend appends v2, get returns the patch, and v1 is unchanged", () => {
    const vault = new VersionedMemoryVault([sample("m-1")], META);
    const receipt = vault.amend("m-1", { place: "Willow Creek" }, META);
    expect(receipt.version).toBe(2);
    expect(receipt.kind).toBe("amend");
    expect(receipt.versionId).toBe("m-1@v2");
    expect(receipt.previousHash).toBe(vault.history("m-1")[0]?.receipt.hash);
    expect(vault.get("m-1")?.place).toBe("Willow Creek");
    const history = vault.history("m-1");
    expect(history.length).toBe(2);
    expect(history[0]?.memory.place).toBe("Port Anselm Lighthouse");
    expect(history[1]?.memory.place).toBe("Willow Creek");
    expect(vault.verifyChain("m-1")).toBe(true);
  });

  it("amend cannot change the id", () => {
    const vault = new VersionedMemoryVault([sample("m-1")], META);
    vault.amend("m-1", { id: "m-other", title: "Retitled" }, META);
    expect(vault.get("m-1")?.title).toBe("Retitled");
    expect(vault.get("m-other")).toBeUndefined();
  });

  it("annotate bumps the version without changing memory content", () => {
    const original = sample("m-1");
    const vault = new VersionedMemoryVault([original], META);
    const before = vault.get("m-1");
    const receipt = vault.annotate("m-1", "Verified against the journal.", META);
    expect(receipt.version).toBe(2);
    expect(receipt.kind).toBe("annotate");
    expect(receipt.note).toBe("Verified against the journal.");
    expect(vault.get("m-1")).toEqual(before);
    expect(vault.get("m-1")).toEqual(original);
    expect(vault.history("m-1").length).toBe(2);
    expect(vault.verifyChain("m-1")).toBe(true);
  });

  it("receipts() returns all receipts in append order across memories", () => {
    const vault = new VersionedMemoryVault([sample("m-1"), sample("m-2")], META);
    vault.annotate("m-1", "note", META);
    vault.amend("m-2", { title: "New title" }, META);
    expect(vault.receipts().map((r) => r.versionId)).toEqual([
      "m-1@v1",
      "m-2@v1",
      "m-1@v2",
      "m-2@v2",
    ]);
  });
});

describe("VersionedMemoryVault — guards", () => {
  it("throws on duplicate create", () => {
    const vault = new VersionedMemoryVault([sample("m-1")], META);
    expect(() => vault.create(sample("m-1"), META)).toThrow(/already exists/);
  });

  it("throws on amend and annotate of an unknown id", () => {
    const vault = new VersionedMemoryVault([], META);
    expect(() => vault.amend("nope", { title: "x" }, META)).toThrow(
      /Unknown memory/,
    );
    expect(() => vault.annotate("nope", "note", META)).toThrow(
      /Unknown memory/,
    );
  });

  it("get and history are empty for unknown ids and verifyChain is false", () => {
    const vault = new VersionedMemoryVault([], META);
    expect(vault.get("nope")).toBeUndefined();
    expect(vault.history("nope")).toEqual([]);
    expect(vault.verifyChain("nope")).toBe(false);
  });
});

describe("VersionedMemoryVault — tamper detection", () => {
  it("detects a tampered version in an exported chain", () => {
    const vault = new VersionedMemoryVault([sample("m-1")], META);
    vault.amend("m-1", { title: "Amended Title" }, META);
    const exported = vault.history("m-1");
    expect(verifyVersionChain(exported)).toBe(true);

    const tampered = exported.map((version, index) =>
      index === 1
        ? {
            receipt: { ...version.receipt },
            memory: { ...version.memory, text: "Silently rewritten text." },
          }
        : version,
    );
    expect(verifyVersionChain(tampered)).toBe(false);

    // Mutating exported copies never touches the vault's own chain.
    expect(vault.verifyChain("m-1")).toBe(true);
    expect(vault.get("m-1")?.text).toBe(sample("m-1").text);
  });

  it("detects a broken previousHash link in an exported chain", () => {
    const vault = new VersionedMemoryVault([sample("m-1")], META);
    vault.annotate("m-1", "note", META);
    const exported = vault.history("m-1");
    const broken = exported.map((version, index) =>
      index === 1
        ? {
            receipt: { ...version.receipt, previousHash: "deadbeef" },
            memory: { ...version.memory },
          }
        : version,
    );
    expect(verifyVersionChain(broken)).toBe(false);
  });
});
