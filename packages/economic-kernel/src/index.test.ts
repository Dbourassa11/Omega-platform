import { describe, expect, it } from "vitest";

import {
  PHI_DENOMINATOR,
  PHI_MINOR_NUMERATOR,
  splitPhi,
} from "./index.js";

function absBigInt(x: bigint): bigint {
  return x < 0n ? -x : x;
}

/**
 * Assert `actual` is within 1 minor unit of the exact rational
 * `numerator / denominator` (i.e. |actual * denominator - numerator| <= denominator).
 * Equivalent to |actual - exact| <= 1 without floating point.
 */
function expectWithinOne(
  actual: bigint,
  numerator: bigint,
  denominator: bigint,
): void {
  const diff = absBigInt(actual * denominator - numerator);
  expect(diff <= denominator).toBe(true);
}

describe("splitPhi — identity", () => {
  const amounts: bigint[] = [
    0n,
    1n,
    2n,
    3n,
    999n,
    1000n,
    123456789n,
    10n ** 18n,
    10n ** 24n,
  ];

  for (const gross of amounts) {
    it(`trust + members + ops === gross for ${gross}`, () => {
      const split = splitPhi(gross);
      expect(split.trust + split.members + split.ops).toBe(gross);
      expect(split.trust >= 0n).toBe(true);
      expect(split.members >= 0n).toBe(true);
      expect(split.ops >= 0n).toBe(true);
    });
  }
});

describe("splitPhi — proportion accuracy for gross >= 1000n", () => {
  const amounts: bigint[] = [1000n, 123456789n, 10n ** 18n, 10n ** 24n];

  for (const gross of amounts) {
    it(`each stream within 1 of exact rational proportion for ${gross}`, () => {
      const split = splitPhi(gross);

      // trust within 1 of gross * NUM / DEN
      expectWithinOne(
        split.trust,
        gross * PHI_MINOR_NUMERATOR,
        PHI_DENOMINATOR,
      );

      // members within 1 of remaining * NUM / DEN, where remaining = gross - trust
      const remaining = gross - split.trust;
      expectWithinOne(
        split.members,
        remaining * PHI_MINOR_NUMERATOR,
        PHI_DENOMINATOR,
      );

      // ops within 1 of remaining * (1 - phi) = remaining * (DEN - NUM) / DEN,
      // allowing the absorbed rounding remainder: ops = remaining - members,
      // so its deviation equals members' deviation (<= 1).
      expectWithinOne(
        split.ops,
        remaining * (PHI_DENOMINATOR - PHI_MINOR_NUMERATOR),
        PHI_DENOMINATOR,
      );
    });
  }
});

describe("splitPhi — negative input", () => {
  it("throws RangeError on negative gross", () => {
    expect(() => splitPhi(-1n)).toThrow(RangeError);
    expect(() => splitPhi(-1000n)).toThrow(RangeError);
  });
});

describe("splitPhi — randomized property test (deterministic LCG)", () => {
  it("identity + non-negativity hold for 1000 pseudo-random amounts", () => {
    // Simple deterministic LCG over bigint.
    // x_{n+1} = (a * x_n + c) mod m, with classic 64-bit constants.
    const a = 6364136223846793005n;
    const c = 1442695040888963407n;
    const m = 2n ** 64n;
    let state = 88172645463325252n;

    for (let i = 0; i < 1000; i++) {
      state = (a * state + c) % m;
      // Vary magnitude: mix full-range values and small values.
      const gross = i % 3 === 0 ? state % 10000n : state;
      const split = splitPhi(gross);
      expect(split.trust + split.members + split.ops).toBe(gross);
      expect(split.trust >= 0n).toBe(true);
      expect(split.members >= 0n).toBe(true);
      expect(split.ops >= 0n).toBe(true);
    }
  });
});
