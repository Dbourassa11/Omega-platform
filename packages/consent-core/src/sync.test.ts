/**
 * @omega/consent-core — sync events and revocation purge tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { canAccess, isReceiptActive } from "./index.js";
import type { ConsentReceipt } from "./index.js";
import {
  ContextCache,
  SyncEventLog,
  createSyncEvent,
  revokeConsentAndPurge,
} from "./sync.js";
import type { ContextCacheEntry } from "./sync.js";

const NOW = new Date("2026-01-15T12:00:00.000Z");
const REVOKE_AT = new Date("2026-02-01T09:30:00.000Z");

function makeReceipt(overrides: Partial<ConsentReceipt> = {}): ConsentReceipt {
  const base: ConsentReceipt = {
    id: "receipt-1",
    subjectNodeId: "node-1",
    ring: "family",
    purpose: "view memories",
    grantedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "abc123",
    adapter: null,
  };
  return { ...base, ...overrides };
}

function entry(overrides: Partial<ContextCacheEntry> = {}): ContextCacheEntry {
  return {
    scope: "ai",
    ownerId: "owner-1",
    ring: "family",
    subjectId: "node-1",
    data: { cached: true },
    ...overrides,
  };
}

describe("createSyncEvent", () => {
  it("fills id, createdAt, and patchHash when omitted", () => {
    const event = createSyncEvent({
      type: "node.patch",
      subjectId: "node-1",
      ring: "work",
      localVersion: 1,
      conflictPolicy: "merge_if_safe",
    });
    expect(event.id).toMatch(/^sync-\d+$/);
    expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false);
    expect(event.patchHash).toMatch(/^[0-9a-f]{8}$/);
    expect("remoteVersion" in event).toBe(false);
  });

  it("honours injected id and createdAt, and generates unique counter ids", () => {
    const injected = createSyncEvent({
      id: "evt-fixed",
      createdAt: "2026-01-01T00:00:00.000Z",
      type: "ledger.patch",
      subjectId: "node-9",
      ring: "public",
      localVersion: 3,
      remoteVersion: 2,
      conflictPolicy: "remote_wins",
    });
    expect(injected.id).toBe("evt-fixed");
    expect(injected.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(injected.remoteVersion).toBe(2);

    const a = createSyncEvent({
      type: "node.patch",
      subjectId: "n",
      ring: "work",
      localVersion: 1,
      conflictPolicy: "local_wins",
    });
    const b = createSyncEvent({
      type: "node.patch",
      subjectId: "n",
      ring: "work",
      localVersion: 1,
      conflictPolicy: "local_wins",
    });
    expect(a.id).not.toBe(b.id);
  });

  it("patchHash is deterministic for identical canonical fields and changes with content", () => {
    const base = {
      id: "evt-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      type: "receipt.patch" as const,
      subjectId: "node-1",
      ring: "family" as const,
      conflictPolicy: "local_wins" as const,
    };
    const first = createSyncEvent({ ...base, localVersion: 1 });
    const again = createSyncEvent({ ...base, localVersion: 1 });
    const bumped = createSyncEvent({ ...base, localVersion: 2 });
    expect(again.patchHash).toBe(first.patchHash);
    expect(bumped.patchHash).not.toBe(first.patchHash);
  });
});

describe("SyncEventLog", () => {
  it("is append-only from the outside: returned arrays and events are copies", () => {
    const log = new SyncEventLog();
    const event = createSyncEvent({
      type: "node.patch",
      subjectId: "node-1",
      ring: "family",
      localVersion: 1,
      conflictPolicy: "local_wins",
    });
    log.append(event);

    const listed = log.list();
    expect(listed).toHaveLength(1);
    listed.push({ ...event, id: "forged" });
    const first = listed[0];
    if (first !== undefined) first.subjectId = "tampered";

    expect(log.size).toBe(1);
    expect(log.list()[0]?.subjectId).toBe("node-1");
  });

  it("filters by subject and by type", () => {
    const log = new SyncEventLog();
    const mk = (type: "node.patch" | "ledger.patch", subjectId: string) =>
      createSyncEvent({
        type,
        subjectId,
        ring: "work",
        localVersion: 1,
        conflictPolicy: "manual_review",
      });
    log.append(mk("node.patch", "node-1"));
    log.append(mk("ledger.patch", "node-1"));
    log.append(mk("node.patch", "node-2"));

    expect(log.bySubject("node-1")).toHaveLength(2);
    expect(log.bySubject("node-2")).toHaveLength(1);
    expect(log.byType("node.patch")).toHaveLength(2);
    expect(log.byType("ledger.patch")).toHaveLength(1);
    expect(log.countForSubject("node-1")).toBe(2);
  });
});

describe("ContextCache", () => {
  it("set/get/has/entries/size, with upsert on the identity tuple", () => {
    const cache = new ContextCache();
    cache.set(entry({ data: "v1" }));
    cache.set(entry({ scope: "connector", data: "token" }));
    expect(cache.size).toBe(2);
    expect(cache.has("ai", "owner-1", "family", "node-1")).toBe(true);
    expect(cache.has("ai", "owner-1", "work", "node-1")).toBe(false);
    expect(cache.get("ai", "owner-1", "family", "node-1")?.data).toBe("v1");

    cache.set(entry({ data: "v2" }));
    expect(cache.size).toBe(2);
    expect(cache.get("ai", "owner-1", "family", "node-1")?.data).toBe("v2");
    expect(cache.entries()).toHaveLength(2);
  });

  it("purgeWhere removes matches and returns them", () => {
    const cache = new ContextCache();
    cache.set(entry({ subjectId: "node-1" }));
    cache.set(entry({ subjectId: "node-2" }));
    cache.set(entry({ subjectId: "node-1", scope: "connector" }));

    const purged = cache.purgeWhere((e) => e.subjectId === "node-1");
    expect(purged).toHaveLength(2);
    expect(cache.size).toBe(1);
    expect(cache.entries()[0]?.subjectId).toBe("node-2");
    expect(cache.purgeWhere(() => false)).toEqual([]);
  });
});

describe("revokeConsentAndPurge — lifecycle", () => {
  it("revokes the receipt, purges matching context only, and logs the sequence", () => {
    const receipt = makeReceipt();
    expect(isReceiptActive(receipt, NOW)).toBe(true);
    expect(canAccess("family", receipt, NOW)).toBe(true);

    const aiCache = new ContextCache();
    aiCache.set(entry({ scope: "ai", subjectId: "node-1", ring: "family", data: "ai ctx" }));
    aiCache.set(entry({ scope: "ai", subjectId: "node-2", ring: "family", data: "other subject" }));
    aiCache.set(entry({ scope: "ai", subjectId: "node-1", ring: "work", data: "other ring" }));

    const connectorCache = new ContextCache();
    connectorCache.set(entry({ scope: "connector", subjectId: "node-1", ring: "family", data: "token" }));
    connectorCache.set(entry({ scope: "connector", subjectId: "node-2", ring: "family", data: "other token" }));

    const log = new SyncEventLog();
    const result = revokeConsentAndPurge({
      receipt,
      log,
      caches: [aiCache, connectorCache],
      now: REVOKE_AT,
    });

    // Receipt is marked revoked the consent-core way: revokedAt set.
    expect(result.receipt.revokedAt).toBe(REVOKE_AT.toISOString());
    expect(receipt.revokedAt).toBeNull(); // input not mutated
    expect(isReceiptActive(result.receipt, REVOKE_AT)).toBe(false);
    expect(canAccess("family", result.receipt, REVOKE_AT)).toBe(false);

    // Exactly the subject+ring entries are gone, from both caches.
    expect(result.purgedCount).toBe(2);
    expect(aiCache.has("ai", "owner-1", "family", "node-1")).toBe(false);
    expect(connectorCache.has("connector", "owner-1", "family", "node-1")).toBe(false);

    // Other subjects and other rings survive.
    expect(aiCache.has("ai", "owner-1", "family", "node-2")).toBe(true);
    expect(aiCache.has("ai", "owner-1", "work", "node-1")).toBe(true);
    expect(connectorCache.has("connector", "owner-1", "family", "node-2")).toBe(true);

    // Event sequence: receipt.patch, ai.context.purge, connector.patch.
    expect(result.events.map((e) => e.type)).toEqual([
      "receipt.patch",
      "ai.context.purge",
      "connector.patch",
    ]);
    for (const event of result.events) {
      expect(event.subjectId).toBe("node-1");
      expect(event.ring).toBe("family");
      expect(event.createdAt).toBe(REVOKE_AT.toISOString());
      expect(event.patchHash).toMatch(/^[0-9a-f]{8}$/);
    }
    expect(result.events.map((e) => e.localVersion)).toEqual([1, 2, 3]);
    expect(log.list().map((e) => e.type)).toEqual([
      "receipt.patch",
      "ai.context.purge",
      "connector.patch",
    ]);
  });

  it("a second revoke of the already-revoked receipt is a clean no-op", () => {
    const aiCache = new ContextCache();
    aiCache.set(entry({ scope: "ai", subjectId: "node-1", ring: "family" }));
    const log = new SyncEventLog();

    const first = revokeConsentAndPurge({
      receipt: makeReceipt(),
      log,
      caches: [aiCache],
      now: REVOKE_AT,
    });
    expect(first.purgedCount).toBe(1);
    const logSizeAfterFirst = log.size;

    // Even if new context appears later, an already-revoked receipt
    // emits nothing and purges nothing on a repeat call.
    aiCache.set(entry({ scope: "ai", subjectId: "node-1", ring: "family", data: "late" }));
    const second = revokeConsentAndPurge({
      receipt: first.receipt,
      log,
      caches: [aiCache],
      now: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(second.events).toEqual([]);
    expect(second.purgedCount).toBe(0);
    expect(second.receipt.revokedAt).toBe(REVOKE_AT.toISOString());
    expect(log.size).toBe(logSizeAfterFirst);
    expect(aiCache.size).toBe(1);
  });

  it("versions continue from the log's existing count for the subject", () => {
    const log = new SyncEventLog();
    log.append(
      createSyncEvent({
        type: "node.patch",
        subjectId: "node-1",
        ring: "family",
        localVersion: 1,
        conflictPolicy: "local_wins",
      }),
    );
    log.append(
      createSyncEvent({
        type: "node.patch",
        subjectId: "node-other",
        ring: "family",
        localVersion: 1,
        conflictPolicy: "local_wins",
      }),
    );

    const cache = new ContextCache();
    cache.set(entry({ scope: "connector", subjectId: "node-1", ring: "family" }));
    const result = revokeConsentAndPurge({
      receipt: makeReceipt(),
      log,
      caches: [cache],
      now: REVOKE_AT,
    });
    // One prior event for node-1 (the node-other event does not count).
    expect(result.events.map((e) => e.localVersion)).toEqual([2, 3]);
    expect(result.events.map((e) => e.type)).toEqual([
      "receipt.patch",
      "connector.patch",
    ]);
  });

  it("emits one ai.context.purge per subject+ring but one connector.patch per purged connector entry", () => {
    const cacheA = new ContextCache();
    cacheA.set(entry({ scope: "ai", ownerId: "ai-1", subjectId: "node-1" }));
    cacheA.set(entry({ scope: "connector", ownerId: "conn-1", subjectId: "node-1" }));
    const cacheB = new ContextCache();
    cacheB.set(entry({ scope: "ai", ownerId: "ai-2", subjectId: "node-1" }));
    cacheB.set(entry({ scope: "connector", ownerId: "conn-2", subjectId: "node-1" }));

    const result = revokeConsentAndPurge({
      receipt: makeReceipt(),
      log: new SyncEventLog(),
      caches: [cacheA, cacheB],
      now: REVOKE_AT,
    });
    expect(result.purgedCount).toBe(4);
    expect(result.events.map((e) => e.type)).toEqual([
      "receipt.patch",
      "ai.context.purge",
      "connector.patch",
      "connector.patch",
    ]);
  });

  it("with nothing cached, only the receipt.patch event is emitted", () => {
    const result = revokeConsentAndPurge({
      receipt: makeReceipt(),
      log: new SyncEventLog(),
      caches: [new ContextCache()],
      now: REVOKE_AT,
    });
    expect(result.purgedCount).toBe(0);
    expect(result.events.map((e) => e.type)).toEqual(["receipt.patch"]);
    expect(isReceiptActive(result.receipt, REVOKE_AT)).toBe(false);
  });

  it("an expired-but-not-revoked receipt is still marked revoked and purged", () => {
    const cache = new ContextCache();
    cache.set(entry({ scope: "ai", subjectId: "node-1", ring: "family" }));
    const result = revokeConsentAndPurge({
      receipt: makeReceipt({ expiresAt: "2026-01-10T00:00:00.000Z" }),
      log: new SyncEventLog(),
      caches: [cache],
      now: REVOKE_AT,
    });
    expect(result.receipt.revokedAt).toBe(REVOKE_AT.toISOString());
    expect(result.purgedCount).toBe(1);
    expect(canAccess("family", result.receipt, REVOKE_AT)).toBe(false);
  });
});
