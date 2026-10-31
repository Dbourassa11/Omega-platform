/**
 * @omega/economic-kernel — public disclosure facade tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { splitPhi } from "./index.js";
import {
  PUBLIC_ALLOWED_KEYS,
  PUBLIC_FORBIDDEN_KEYS,
  assertPublicSafe,
  buildPublicDispersionPayload,
  findForbiddenKeys,
  sanitizePublicLedgerPayload,
} from "./public-facade.js";

/**
 * The serialized payload must not contain any forbidden key as a JSON
 * key, compared case-insensitively.
 */
function expectNoForbiddenKeysInJson(payload: unknown): void {
  const json = JSON.stringify(payload).toLowerCase();
  for (const key of PUBLIC_FORBIDDEN_KEYS) {
    expect(json).not.toContain(`"${key.toLowerCase()}":`);
  }
  expect(findForbiddenKeys(payload)).toEqual([]);
}

describe("public key constants", () => {
  it("allowed keys are exactly the disclosure contract", () => {
    expect([...PUBLIC_ALLOWED_KEYS].sort()).toEqual(
      [
        "activeMemberCount",
        "currency",
        "lastUpdated",
        "memberDispersionTotal",
        "publicProgramStatus",
      ].sort(),
    );
  });

  it("forbidden keys cover both source lists", () => {
    for (const key of [
      "trust",
      "familyTrust",
      "ops",
      "operations",
      "reserve",
      "reserveVault",
      "floorGuarantee",
      "guardianMultisig",
      "treasuryWallet",
      "annualTrustAccumulator",
      "totalRoutedAllTime",
    ]) {
      expect(PUBLIC_FORBIDDEN_KEYS).toContain(key);
    }
  });
});

describe("sanitizePublicLedgerPayload — pass-through and defaults", () => {
  it("keeps validated allowed fields and drops everything else", () => {
    const payload = sanitizePublicLedgerPayload({
      memberDispersionTotal: "12345",
      currency: "ETH",
      lastUpdated: "2026-01-01T00:00:00.000Z",
      publicProgramStatus: "testnet",
      activeMemberCount: 42,
      somethingInternal: "drop me",
    });
    expect(payload).toEqual({
      memberDispersionTotal: "12345",
      currency: "ETH",
      lastUpdated: "2026-01-01T00:00:00.000Z",
      publicProgramStatus: "testnet",
      activeMemberCount: 42,
    });
  });

  it("applies doc defaults for an empty input", () => {
    const before = Date.now();
    const payload = sanitizePublicLedgerPayload({});
    const after = Date.now();
    expect(payload.memberDispersionTotal).toBe("0");
    expect(payload.currency).toBe("USD");
    expect(payload.publicProgramStatus).toBe("simulation");
    expect("activeMemberCount" in payload).toBe(false);
    const parsed = Date.parse(payload.lastUpdated);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("stringifies a numeric or bigint total, and defaults nullish to 0", () => {
    expect(
      sanitizePublicLedgerPayload({ memberDispersionTotal: 777 })
        .memberDispersionTotal,
    ).toBe("777");
    expect(
      sanitizePublicLedgerPayload({ memberDispersionTotal: 900n })
        .memberDispersionTotal,
    ).toBe("900");
    expect(
      sanitizePublicLedgerPayload({ memberDispersionTotal: null })
        .memberDispersionTotal,
    ).toBe("0");
  });

  it("falls back on invalid currency and program status", () => {
    const payload = sanitizePublicLedgerPayload({
      currency: "BTC",
      publicProgramStatus: "live",
    });
    expect(payload.currency).toBe("USD");
    expect(payload.publicProgramStatus).toBe("simulation");
    expect(
      sanitizePublicLedgerPayload({ currency: "CREDITS" }).currency,
    ).toBe("CREDITS");
    expect(
      sanitizePublicLedgerPayload({ publicProgramStatus: "production" })
        .publicProgramStatus,
    ).toBe("production");
  });

  it("includes activeMemberCount only for finite non-negative numbers", () => {
    expect(
      sanitizePublicLedgerPayload({ activeMemberCount: 0 }).activeMemberCount,
    ).toBe(0);
    expect(
      sanitizePublicLedgerPayload({ activeMemberCount: 7 }).activeMemberCount,
    ).toBe(7);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, "7", null]) {
      const payload = sanitizePublicLedgerPayload({ activeMemberCount: bad });
      expect("activeMemberCount" in payload).toBe(false);
    }
  });
});

describe("sanitizePublicLedgerPayload — leakage", () => {
  const adversarialInputs: Record<string, unknown>[] = [
    // Forbidden keys at the top level.
    {
      memberDispersionTotal: "100",
      trust: "1",
      familyTrust: "2",
      ops: "3",
      operations: "4",
      reserve: "5",
      reserveVault: "6",
      floorGuarantee: "7",
      guardianMultisig: "8",
      treasuryWallet: "9",
      annualTrustAccumulator: "10",
      totalRoutedAllTime: "11",
    },
    // Forbidden keys nested inside objects.
    {
      memberDispersionTotal: "100",
      internal: { trust: "1", deep: { deeper: { reserveVault: "2" } } },
    },
    // Forbidden keys inside arrays of objects.
    {
      memberDispersionTotal: "100",
      streams: [{ ops: "1" }, { list: [{ treasuryWallet: "2" }] }],
    },
    // Mixed-case spellings.
    {
      memberDispersionTotal: "100",
      Trust: "1",
      RESERVE: "2",
      FamilyTrust: "3",
      nested: { Ops: "4", ANNUALTRUSTACCUMULATOR: "5" },
      arr: [{ FloorGuarantee: "6" }],
    },
    // Forbidden key whose value contains more forbidden keys.
    {
      memberDispersionTotal: "100",
      reserve: { trust: { ops: "1" } },
    },
  ];

  for (const [index, input] of adversarialInputs.entries()) {
    it(`strips every forbidden key (adversarial input ${index})`, () => {
      // Sanity: the raw input really does contain forbidden keys.
      expect(findForbiddenKeys(input).length).toBeGreaterThan(0);

      const payload = sanitizePublicLedgerPayload(input);
      expectNoForbiddenKeysInJson(payload);
      expect(() => assertPublicSafe(payload)).not.toThrow();
      expect(Object.keys(payload).sort()).toEqual(
        ["currency", "lastUpdated", "memberDispersionTotal", "publicProgramStatus"].sort(),
      );
      expect(payload.memberDispersionTotal).toBe("100");
    });
  }
});

describe("findForbiddenKeys", () => {
  it("detects planted keys with dotted paths, case-insensitively", () => {
    const raw = {
      trust: 1,
      nested: { FamilyTrust: 2 },
      list: [{ RESERVE: 3 }, { fine: 4 }],
      deep: { a: { b: { ops: 5 } } },
    };
    expect(findForbiddenKeys(raw).sort()).toEqual(
      ["deep.a.b.ops", "list.0.RESERVE", "nested.FamilyTrust", "trust"].sort(),
    );
  });

  it("returns [] for clean values, primitives, and null", () => {
    expect(findForbiddenKeys({ memberDispersionTotal: "1" })).toEqual([]);
    expect(findForbiddenKeys([{ ok: true }])).toEqual([]);
    expect(findForbiddenKeys("trust")).toEqual([]);
    expect(findForbiddenKeys(null)).toEqual([]);
    expect(findForbiddenKeys(undefined)).toEqual([]);
    expect(findForbiddenKeys(42)).toEqual([]);
  });

  it("does not match keys that merely contain a forbidden substring", () => {
    expect(
      findForbiddenKeys({ trusted: 1, reserves: 2, operationsLead: 3 }),
    ).toEqual([]);
  });
});

describe("assertPublicSafe", () => {
  it("throws an Error listing the violating paths", () => {
    expect(() => assertPublicSafe({ a: { Trust: 1 } })).toThrow(Error);
    expect(() => assertPublicSafe({ a: { Trust: 1 } })).toThrow(/a\.Trust/);
  });

  it("accepts a sanitized payload", () => {
    expect(() =>
      assertPublicSafe(sanitizePublicLedgerPayload({ trust: "9" })),
    ).not.toThrow();
  });
});

describe("buildPublicDispersionPayload", () => {
  it("sums only the member components of realistic splits, in minor units", () => {
    const splits = [splitPhi(100_000n), splitPhi(50_000n), splitPhi(1n)];
    const expectedTotal = splits.reduce((acc, s) => acc + s.members, 0n);

    const payload = buildPublicDispersionPayload(splits);
    expect(payload.memberDispersionTotal).toBe(expectedTotal.toString());
    expect(Object.keys(payload).sort()).toEqual(
      ["currency", "lastUpdated", "memberDispersionTotal", "publicProgramStatus"].sort(),
    );
    expectNoForbiddenKeysInJson(payload);
  });

  it("honours options and validates them through the sanitizer", () => {
    const payload = buildPublicDispersionPayload([splitPhi(1000n)], {
      currency: "ETH",
      publicProgramStatus: "production",
      activeMemberCount: 12,
      lastUpdated: "2026-02-02T00:00:00.000Z",
    });
    expect(payload.currency).toBe("ETH");
    expect(payload.publicProgramStatus).toBe("production");
    expect(payload.activeMemberCount).toBe(12);
    expect(payload.lastUpdated).toBe("2026-02-02T00:00:00.000Z");
    expect(Object.keys(payload).sort()).toEqual(
      [...PUBLIC_ALLOWED_KEYS].sort(),
    );
  });

  it("empty split list totals 0", () => {
    expect(buildPublicDispersionPayload([]).memberDispersionTotal).toBe("0");
  });
});
