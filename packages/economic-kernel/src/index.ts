/**
 * @omega/economic-kernel
 *
 * PhiSplit Economic Kernel for the Omega Platform.
 * Creator: David Charles Bourassa
 *
 * All money math is integer minor units (bigint) only. Floating point
 * is never used for money math.
 */

/**
 * Numerator of PHI_MINOR as an exact rational.
 * PHI_MINOR = PHI_MINOR_NUMERATOR / PHI_DENOMINATOR
 *           = 0.618033988749894848 exactly.
 */
export const PHI_MINOR_NUMERATOR = 618033988749894848n;

/** Denominator of PHI_MINOR as an exact rational (10^18). */
export const PHI_DENOMINATOR = 1000000000000000000n;

/**
 * Float approximation of PHI_MINOR (0.618033988749894848).
 *
 * DISPLAY ONLY — never use for money math. All monetary splitting
 * must use {@link splitPhi} with bigint integer arithmetic.
 */
// eslint-disable-next-line no-loss-of-precision -- intentional: written at full φ precision to document the exact value; float64 rounds it, which is acceptable for a display-only constant. Exact math lives in the bigint rational above.
export const PHI_MINOR_FLOAT = 0.618033988749894848;

/** Result of a recursive phi split, in integer minor units. */
export interface PhiSplit {
  trust: bigint;
  members: bigint;
  ops: bigint;
}

/**
 * Round-half-up division for non-negative bigints.
 *
 * Computes round(n / d) where exact halves round up, using
 * `(2n + d) / (2d)` with bigint floor division.
 *
 * Preconditions: `n >= 0n` and `d > 0n`.
 */
export function roundHalfUpDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n) {
    throw new RangeError("roundHalfUpDiv: denominator must be positive");
  }
  if (n < 0n) {
    throw new RangeError("roundHalfUpDiv: numerator must be non-negative");
  }
  return (2n * n + d) / (2n * d);
}

/**
 * Split a gross amount (integer minor units) by the recursive phi rule.
 *
 * Rounding:
 * - `trust = roundHalfUp(gross × φ)` where φ = PHI_MINOR_NUMERATOR / PHI_DENOMINATOR
 * - `remaining = gross − trust`
 * - `members = roundHalfUp(remaining × φ)`
 * - `ops = remaining − members` (ops absorbs the rounding remainder)
 *
 * Therefore `trust + members + ops === gross` ALWAYS, and every
 * stream is non-negative for any non-negative gross.
 *
 * @throws {RangeError} if `grossMinor` is negative.
 */
export function splitPhi(grossMinor: bigint): PhiSplit {
  if (grossMinor < 0n) {
    throw new RangeError("splitPhi: grossMinor must be non-negative");
  }
  const trust = roundHalfUpDiv(
    grossMinor * PHI_MINOR_NUMERATOR,
    PHI_DENOMINATOR,
  );
  const remaining = grossMinor - trust;
  const members = roundHalfUpDiv(
    remaining * PHI_MINOR_NUMERATOR,
    PHI_DENOMINATOR,
  );
  const ops = remaining - members;
  return { trust, members, ops };
}

export * from "./public-facade.js";
