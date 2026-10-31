import { describe, expect, it } from "vitest";

import { canAccess, isReceiptActive } from "./index.js";
import type { ConsentReceipt } from "./index.js";

const NOW = new Date("2026-01-15T12:00:00.000Z");

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

describe("isReceiptActive", () => {
  it("returns true for a non-revoked, non-expired receipt", () => {
    expect(isReceiptActive(makeReceipt(), NOW)).toBe(true);
  });

  it("returns false when revoked", () => {
    const receipt = makeReceipt({ revokedAt: "2026-01-10T00:00:00.000Z" });
    expect(isReceiptActive(receipt, NOW)).toBe(false);
  });

  it("returns false when expired", () => {
    const receipt = makeReceipt({ expiresAt: "2026-01-14T00:00:00.000Z" });
    expect(isReceiptActive(receipt, NOW)).toBe(false);
  });

  it("returns false when expiresAt equals now", () => {
    const receipt = makeReceipt({ expiresAt: NOW.toISOString() });
    expect(isReceiptActive(receipt, NOW)).toBe(false);
  });

  it("returns true when expiresAt is in the future", () => {
    const receipt = makeReceipt({ expiresAt: "2027-01-01T00:00:00.000Z" });
    expect(isReceiptActive(receipt, NOW)).toBe(true);
  });
});

describe("canAccess", () => {
  it("active receipt grants its ring", () => {
    expect(canAccess("family", makeReceipt(), NOW)).toBe(true);
  });

  it("revoked denies", () => {
    const receipt = makeReceipt({ revokedAt: "2026-01-10T00:00:00.000Z" });
    expect(canAccess("family", receipt, NOW)).toBe(false);
  });

  it("expired denies", () => {
    const receipt = makeReceipt({ expiresAt: "2026-01-01T00:00:00.000Z" });
    expect(canAccess("family", receipt, NOW)).toBe(false);
  });

  it("wrong ring denies", () => {
    expect(canAccess("work", makeReceipt({ ring: "family" }), NOW)).toBe(false);
    expect(canAccess("family", makeReceipt({ ring: "public" }), NOW)).toBe(false);
  });

  it("null denies", () => {
    expect(canAccess("family", null, NOW)).toBe(false);
  });

  it("undefined denies", () => {
    expect(canAccess("family", undefined, NOW)).toBe(false);
  });

  it("expiresAt in future grants", () => {
    const receipt = makeReceipt({ expiresAt: "2027-06-01T00:00:00.000Z" });
    expect(canAccess("family", receipt, NOW)).toBe(true);
  });
});
