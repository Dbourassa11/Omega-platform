/**
 * @omega/legacy-engine — Versioned Memory Vault (Continuity Engine core)
 *
 * Append-only, versioned storage for LegacyMemory records. Nothing is
 * silently rewritten: seeding, creation, amendment, and annotation each
 * append a new version with a receipt, and every receipt chains to the
 * previous version's hash so tampering with stored content is detectable
 * via verifyChain / verifyVersionChain.
 *
 * The hash is a small deterministic FNV-1a (32-bit) fingerprint — an
 * integrity check for this demo core, NOT a cryptographic hash.
 * @omega/vault-core owns real cryptography.
 *
 * Creator: David Charles Bourassa
 */

import type { LegacyMemory } from "./types.js";

export interface MemoryReceipt {
  versionId: string;
  memoryId: string;
  version: number;
  kind: "create" | "amend" | "annotate";
  actor: string;
  timestamp: string;
  note?: string;
  previousHash: string | null;
  hash: string;
}

export interface MemoryVersion {
  receipt: MemoryReceipt;
  memory: LegacyMemory;
}

export interface MemoryMutationMeta {
  actor: string;
  timestamp: string;
  note?: string;
}

const DEFAULT_SEED_ACTOR = "vault-seed";
const DEFAULT_SEED_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function copyMemory(memory: LegacyMemory): LegacyMemory {
  return { ...memory, people: [...memory.people] };
}

function copyReceipt(receipt: MemoryReceipt): MemoryReceipt {
  return { ...receipt };
}

function copyVersion(version: MemoryVersion): MemoryVersion {
  return {
    receipt: copyReceipt(version.receipt),
    memory: copyMemory(version.memory),
  };
}

/** Deterministic JSON: object keys sorted recursively, arrays in order. */
export function canonicalMemoryJson(memory: LegacyMemory): string {
  return stableStringify(memory);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

/** FNV-1a 32-bit, hex-encoded. Deterministic; not cryptographic. */
export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function computeMemoryHash(args: {
  previousHash: string | null;
  memory: LegacyMemory;
  kind: MemoryReceipt["kind"];
  note?: string;
}): string {
  const note = args.note ?? "";
  const payload = `${args.previousHash ?? ""}|${canonicalMemoryJson(args.memory)}|${args.kind}|${note}`;
  return fnv1a32(payload);
}

/**
 * Recompute hashes along an exported chain (oldest → newest).
 * Returns false if any version number, versionId, previousHash link,
 * or content hash does not match its receipt. This is the clean way to
 * test tamper detection: copy a vault's history, alter one version's
 * memory, and this returns false for the altered chain while the
 * vault's own verifyChain still returns true (the vault never hands
 * out references to its stored versions).
 */
export function verifyVersionChain(
  versions: readonly MemoryVersion[],
): boolean {
  if (versions.length === 0) return false;
  let previousHash: string | null = null;
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    if (!version) return false;
    const { receipt, memory } = version;
    if (receipt.memoryId !== memory.id) return false;
    if (receipt.version !== i + 1) return false;
    if (receipt.versionId !== `${receipt.memoryId}@v${receipt.version}`) {
      return false;
    }
    if (receipt.previousHash !== previousHash) return false;
    const expected = computeMemoryHash({
      previousHash,
      memory,
      kind: receipt.kind,
      ...(receipt.note !== undefined ? { note: receipt.note } : {}),
    });
    if (expected !== receipt.hash) return false;
    previousHash = receipt.hash;
  }
  return true;
}

export class VersionedMemoryVault {
  readonly #chains = new Map<string, MemoryVersion[]>();
  readonly #order: string[] = [];
  readonly #receipts: MemoryReceipt[] = [];

  constructor(
    seed?: readonly LegacyMemory[],
    opts?: { actor?: string; timestamp?: string },
  ) {
    if (seed) {
      const actor = opts?.actor ?? DEFAULT_SEED_ACTOR;
      const timestamp = opts?.timestamp ?? DEFAULT_SEED_TIMESTAMP;
      for (const memory of seed) {
        this.create(copyMemory(memory), { actor, timestamp });
      }
    }
  }

  create(memory: LegacyMemory, meta: MemoryMutationMeta): MemoryReceipt {
    if (this.#chains.has(memory.id)) {
      throw new Error(`Memory already exists: ${memory.id}`);
    }
    return this.#append(copyMemory(memory), "create", meta);
  }

  amend(
    id: string,
    patch: Partial<LegacyMemory>,
    meta: MemoryMutationMeta,
  ): MemoryReceipt {
    const current = this.#latest(id);
    if (!current) {
      throw new Error(`Unknown memory: ${id}`);
    }
    // The id itself is immutable: it always wins over the patch.
    const next: LegacyMemory = {
      ...copyMemory(current),
      ...patch,
      id,
      people: patch.people ? [...patch.people] : [...current.people],
    };
    return this.#append(next, "amend", meta);
  }

  annotate(
    id: string,
    note: string,
    meta: { actor: string; timestamp: string },
  ): MemoryReceipt {
    const current = this.#latest(id);
    if (!current) {
      throw new Error(`Unknown memory: ${id}`);
    }
    return this.#append(copyMemory(current), "annotate", {
      actor: meta.actor,
      timestamp: meta.timestamp,
      note,
    });
  }

  get(id: string): LegacyMemory | undefined {
    const current = this.#latest(id);
    return current ? copyMemory(current) : undefined;
  }

  history(id: string): readonly MemoryVersion[] {
    const chain = this.#chains.get(id);
    if (!chain) return [];
    return chain.map(copyVersion);
  }

  list(): readonly LegacyMemory[] {
    const out: LegacyMemory[] = [];
    for (const id of this.#order) {
      const current = this.#latest(id);
      if (current) out.push(copyMemory(current));
    }
    return out;
  }

  receipts(): readonly MemoryReceipt[] {
    return this.#receipts.map(copyReceipt);
  }

  verifyChain(id: string): boolean {
    const chain = this.#chains.get(id);
    if (!chain || chain.length === 0) return false;
    return verifyVersionChain(chain);
  }

  #latest(id: string): LegacyMemory | undefined {
    const chain = this.#chains.get(id);
    if (!chain || chain.length === 0) return undefined;
    return chain[chain.length - 1]?.memory;
  }

  #append(
    memory: LegacyMemory,
    kind: MemoryReceipt["kind"],
    meta: MemoryMutationMeta,
  ): MemoryReceipt {
    const chain = this.#chains.get(memory.id) ?? [];
    const previous = chain[chain.length - 1];
    const previousHash = previous ? previous.receipt.hash : null;
    const version = chain.length + 1;
    const hash = computeMemoryHash({
      previousHash,
      memory,
      kind,
      ...(meta.note !== undefined ? { note: meta.note } : {}),
    });
    const receipt: MemoryReceipt = {
      versionId: `${memory.id}@v${version}`,
      memoryId: memory.id,
      version,
      kind,
      actor: meta.actor,
      timestamp: meta.timestamp,
      ...(meta.note !== undefined ? { note: meta.note } : {}),
      previousHash,
      hash,
    };
    const stored: MemoryVersion = {
      receipt: copyReceipt(receipt),
      memory: copyMemory(memory),
    };
    if (chain.length === 0) {
      this.#chains.set(memory.id, [stored]);
      this.#order.push(memory.id);
    } else {
      chain.push(stored);
    }
    this.#receipts.push(copyReceipt(receipt));
    return copyReceipt(receipt);
  }
}
