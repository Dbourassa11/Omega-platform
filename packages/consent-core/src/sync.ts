/**
 * @omega/consent-core — sync events and revocation context purge
 *
 * Creator: David Charles Bourassa
 *
 * Sync events describe patches moving between nodes. Consent
 * revocation is one of those patches with a hard side effect:
 * revoking a receipt purges every cached context entry for that
 * subject and ring — connector tokens/caches and AI context alike —
 * and the purge itself is recorded in the event log.
 */

import type { ConsentReceipt, RingType } from "./index.js";

// Note: canAccess/isReceiptActive semantics live in index.ts; this
// module only marks receipts revoked via `revokedAt`.

/**
 * A single sync patch event.
 *
 * `patchHash` is a non-cryptographic FNV-1a fingerprint of the
 * event's canonical fields — a cheap change-detection checksum, not
 * a security hash. This mirrors the honesty pattern used for hashes
 * elsewhere in the platform (e.g. legacy-engine): never present it
 * as cryptographic proof.
 */
export interface OmegaSyncEvent {
  id: string;
  type:
    | "node.patch"
    | "receipt.patch"
    | "ledger.patch"
    | "connector.patch"
    | "ai.context.purge";
  subjectId: string;
  ring: RingType;
  patchHash: string;
  localVersion: number;
  remoteVersion?: number;
  conflictPolicy: "local_wins" | "remote_wins" | "manual_review" | "merge_if_safe";
  createdAt: string;
}

export type OmegaSyncEventType = OmegaSyncEvent["type"];

export type SyncConflictPolicy = OmegaSyncEvent["conflictPolicy"];

/** Fields a caller supplies; `id`, `createdAt`, and `patchHash` are filled in when omitted. */
export type CreateSyncEventInput = Omit<
  OmegaSyncEvent,
  "id" | "createdAt" | "patchHash"
> &
  Partial<Pick<OmegaSyncEvent, "id" | "createdAt" | "patchHash">>;

/** FNV-1a 32-bit, hex-encoded. Deterministic; not cryptographic. */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

let syncEventCounter = 0;

/**
 * Create a sync event, filling in any omitted generated fields:
 * - `id`: `sync-<n>` from a deterministic module counter, unless an
 *   id is injected via the partial.
 * - `createdAt`: the current time as an ISO-8601 string.
 * - `patchHash`: FNV-1a over the event's canonical fields (id, type,
 *   subjectId, ring, versions, conflictPolicy, createdAt) — a
 *   non-cryptographic fingerprint, not a security hash.
 */
export function createSyncEvent(partial: CreateSyncEventInput): OmegaSyncEvent {
  const id = partial.id ?? `sync-${++syncEventCounter}`;
  const createdAt = partial.createdAt ?? new Date().toISOString();

  const event: OmegaSyncEvent = {
    id,
    type: partial.type,
    subjectId: partial.subjectId,
    ring: partial.ring,
    patchHash: "",
    localVersion: partial.localVersion,
    conflictPolicy: partial.conflictPolicy,
    createdAt,
  };
  if (partial.remoteVersion !== undefined) {
    event.remoteVersion = partial.remoteVersion;
  }

  event.patchHash =
    partial.patchHash ??
    fnv1a32(
      [
        event.id,
        event.type,
        event.subjectId,
        event.ring,
        String(event.localVersion),
        event.remoteVersion === undefined ? "" : String(event.remoteVersion),
        event.conflictPolicy,
        event.createdAt,
      ].join("|"),
    );

  return event;
}

/**
 * Append-only in-memory log of sync events.
 *
 * Events are stored as copies and every read returns fresh copies,
 * so callers can never mutate the log's history.
 */
export class SyncEventLog {
  #events: OmegaSyncEvent[] = [];

  append(event: OmegaSyncEvent): OmegaSyncEvent {
    const stored = { ...event };
    this.#events.push(stored);
    return { ...stored };
  }

  list(): OmegaSyncEvent[] {
    return this.#events.map((event) => ({ ...event }));
  }

  bySubject(subjectId: string): OmegaSyncEvent[] {
    return this.#events
      .filter((event) => event.subjectId === subjectId)
      .map((event) => ({ ...event }));
  }

  byType(type: OmegaSyncEventType): OmegaSyncEvent[] {
    return this.#events
      .filter((event) => event.type === type)
      .map((event) => ({ ...event }));
  }

  /** Number of events recorded for a subject — the base for version increments. */
  countForSubject(subjectId: string): number {
    return this.#events.filter((event) => event.subjectId === subjectId).length;
  }

  get size(): number {
    return this.#events.length;
  }
}

/** One cached context entry, scoped to a connector or to AI context. */
export interface ContextCacheEntry {
  scope: "connector" | "ai";
  ownerId: string;
  ring: RingType;
  subjectId: string;
  data: unknown;
}

/**
 * A cache of connector or AI context entries.
 *
 * An entry's identity is the tuple (scope, ownerId, ring, subjectId):
 * `set` upserts on that tuple. Reads return copies.
 */
export class ContextCache {
  #entries: ContextCacheEntry[] = [];

  set(entry: ContextCacheEntry): void {
    const index = this.#entries.findIndex(
      (existing) =>
        existing.scope === entry.scope &&
        existing.ownerId === entry.ownerId &&
        existing.ring === entry.ring &&
        existing.subjectId === entry.subjectId,
    );
    const copy = { ...entry };
    if (index >= 0) {
      this.#entries[index] = copy;
    } else {
      this.#entries.push(copy);
    }
  }

  get(
    scope: ContextCacheEntry["scope"],
    ownerId: string,
    ring: RingType,
    subjectId: string,
  ): ContextCacheEntry | undefined {
    const found = this.#entries.find(
      (entry) =>
        entry.scope === scope &&
        entry.ownerId === ownerId &&
        entry.ring === ring &&
        entry.subjectId === subjectId,
    );
    return found === undefined ? undefined : { ...found };
  }

  has(
    scope: ContextCacheEntry["scope"],
    ownerId: string,
    ring: RingType,
    subjectId: string,
  ): boolean {
    return this.get(scope, ownerId, ring, subjectId) !== undefined;
  }

  entries(): ContextCacheEntry[] {
    return this.#entries.map((entry) => ({ ...entry }));
  }

  /**
   * Remove every entry matching `predicate`.
   * Returns the purged entries (copies), in their original order.
   */
  purgeWhere(
    predicate: (entry: ContextCacheEntry) => boolean,
  ): ContextCacheEntry[] {
    const purged: ContextCacheEntry[] = [];
    const kept: ContextCacheEntry[] = [];
    for (const entry of this.#entries) {
      if (predicate({ ...entry })) {
        purged.push({ ...entry });
      } else {
        kept.push(entry);
      }
    }
    this.#entries = kept;
    return purged;
  }

  get size(): number {
    return this.#entries.length;
  }
}

export interface RevokeConsentAndPurgeResult {
  /** The receipt with `revokedAt` set — consent-core's revocation marker. */
  receipt: ConsentReceipt;
  /** Events emitted by this call, in emission order (also appended to the log). */
  events: OmegaSyncEvent[];
  /** Total cache entries purged across all caches. */
  purgedCount: number;
}

/**
 * Revoke a consent receipt and purge its cached context.
 *
 * Revocation marking: consent-core has no status field — a receipt is
 * revoked exactly when `revokedAt` is non-null (see
 * `isReceiptActive`). The returned receipt is a copy of the input
 * with `revokedAt` set to `now`; the input is not mutated. From that
 * moment `isReceiptActive(updated)` is false and `canAccess` denies
 * the receipt's ring.
 *
 * Behavior:
 * 1. Emits a `receipt.patch` event for the receipt's subject/ring.
 * 2. Purges, from every cache, each entry whose `subjectId` equals
 *    the receipt's `subjectNodeId` AND whose `ring` equals the
 *    receipt's ring. Entries for other subjects or other rings are
 *    untouched.
 * 3. If any "ai"-scope entries were purged, emits exactly one
 *    `ai.context.purge` event for the subject+ring (the purge is a
 *    single context wipe, however many entries it removed).
 * 4. For "connector"-scope entries, emits one `connector.patch`
 *    event per purged entry (each represents one connector context
 *    dropped).
 *
 * Event order is always: receipt.patch, ai.context.purge (if any),
 * then connector.patch events. `localVersion` increments from the
 * log's current event count for the subject, so versions continue
 * any existing history for that subject.
 *
 * Idempotency: if the receipt is already revoked (`revokedAt`
 * non-null), this is a clean no-op — the receipt is returned
 * unchanged (as a copy), no events are emitted, no caches are
 * touched, and `purgedCount` is 0.
 */
export function revokeConsentAndPurge(args: {
  receipt: ConsentReceipt;
  log: SyncEventLog;
  caches: readonly ContextCache[];
  now?: Date;
}): RevokeConsentAndPurgeResult {
  const { receipt, log, caches } = args;
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const subjectId = receipt.subjectNodeId;
  const ring = receipt.ring;

  if (receipt.revokedAt !== null) {
    return { receipt: { ...receipt }, events: [], purgedCount: 0 };
  }

  const updated: ConsentReceipt = { ...receipt, revokedAt: nowIso };

  let nextVersion = log.countForSubject(subjectId);
  const emit = (
    type: OmegaSyncEventType,
  ): OmegaSyncEvent => {
    const event = createSyncEvent({
      type,
      subjectId,
      ring,
      localVersion: ++nextVersion,
      conflictPolicy: "local_wins",
      createdAt: nowIso,
    });
    log.append(event);
    return event;
  };

  const receiptEvent = emit("receipt.patch");

  const purged: ContextCacheEntry[] = [];
  for (const cache of caches) {
    purged.push(
      ...cache.purgeWhere(
        (entry) => entry.subjectId === subjectId && entry.ring === ring,
      ),
    );
  }

  const events: OmegaSyncEvent[] = [receiptEvent];

  if (purged.some((entry) => entry.scope === "ai")) {
    events.push(emit("ai.context.purge"));
  }
  for (const entry of purged) {
    if (entry.scope === "connector") {
      events.push(emit("connector.patch"));
    }
  }

  return { receipt: updated, events, purgedCount: purged.length };
}
