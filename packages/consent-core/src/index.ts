/**
 * @omega/consent-core
 *
 * Foundation consent package for the Omega Platform.
 * Creator: David Charles Bourassa
 *
 * Consent is ring-scoped with an exact-ring match and deny-by-default:
 * access is granted only when a receipt exists, is active (not revoked
 * and not expired), and its ring exactly equals the required ring.
 * There is no implicit hierarchy or cross-ring inheritance.
 */

export type RingType = "family" | "friends" | "work" | "public";

export const RING_TYPES: readonly RingType[] = [
  "family",
  "friends",
  "work",
  "public",
] as const;

/**
 * A record of consent granted for a single ring and purpose.
 * All timestamps are ISO-8601 strings.
 */
export interface ConsentReceipt {
  id: string;
  subjectNodeId: string;
  ring: RingType;
  purpose: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt: string | null;
  dataHash: string;
  adapter: string | null;
}

/**
 * Returns true if the receipt is currently active at `now`.
 *
 * A receipt is inactive when:
 * - `revokedAt` is non-null (revoked at or before any evaluation time), or
 * - `expiresAt` is present and `expiresAt <= now`.
 */
export function isReceiptActive(receipt: ConsentReceipt, now: Date): boolean {
  if (receipt.revokedAt !== null) {
    return false;
  }
  if (receipt.expiresAt !== undefined) {
    const expiresAtMs = Date.parse(receipt.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      return false;
    }
    if (expiresAtMs <= now.getTime()) {
      return false;
    }
  }
  return true;
}

/**
 * Ring-scoped, exact-ring match, deny-by-default access check.
 *
 * Returns true iff:
 * - a receipt exists (not null/undefined),
 * - the receipt is active at `now` (see {@link isReceiptActive}), and
 * - `receipt.ring === requiredRing` exactly.
 *
 * Any other condition — missing receipt, revoked, expired, or a
 * receipt for a different ring — denies access.
 */
export function canAccess(
  requiredRing: RingType,
  receipt: ConsentReceipt | null | undefined,
  now: Date = new Date(),
): boolean {
  if (receipt === null || receipt === undefined) {
    return false;
  }
  if (!isReceiptActive(receipt, now)) {
    return false;
  }
  return receipt.ring === requiredRing;
}

export * from "./sync.js";
