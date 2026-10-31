/**
 * @omega/economic-kernel — public disclosure facade
 *
 * Creator: David Charles Bourassa
 *
 * The ONLY shape of ledger data that may leave the platform publicly.
 * It exposes a single aggregate — total member dispersion — and never
 * any internal allocation stream, vault, guarantee, or treasury detail.
 *
 * Sanitization is allowlist-based: the payload is rebuilt field by
 * field from validated values, so nothing else passes through at any
 * depth, regardless of what the input contains.
 */

import type { PhiSplit } from "./index.js";

/** Keys allowed in a public member-dispersion payload — the complete list. */
export const PUBLIC_ALLOWED_KEYS = [
  "memberDispersionTotal",
  "currency",
  "lastUpdated",
  "activeMemberCount",
  "publicProgramStatus",
] as const;

/**
 * Keys that must never appear in a public payload, at any depth.
 * Matches are case-insensitive (see {@link findForbiddenKeys}).
 */
export const PUBLIC_FORBIDDEN_KEYS = [
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
] as const;

const PUBLIC_CURRENCIES = ["USD", "ETH", "CREDITS"] as const;

const PUBLIC_PROGRAM_STATUSES = ["simulation", "testnet", "production"] as const;

/**
 * Public member-dispersion payload. This interface is the disclosure
 * contract: no other ledger field is public.
 */
export interface PublicMemberDispersionPayload {
  memberDispersionTotal: string;
  currency: "USD" | "ETH" | "CREDITS";
  lastUpdated: string;
  activeMemberCount?: number;
  publicProgramStatus: "simulation" | "testnet" | "production";
}

type PublicCurrency = PublicMemberDispersionPayload["currency"];
type PublicProgramStatus = PublicMemberDispersionPayload["publicProgramStatus"];

function isPublicCurrency(value: unknown): value is PublicCurrency {
  return (
    typeof value === "string" &&
    (PUBLIC_CURRENCIES as readonly string[]).includes(value)
  );
}

function isPublicProgramStatus(value: unknown): value is PublicProgramStatus {
  return (
    typeof value === "string" &&
    (PUBLIC_PROGRAM_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Build a public-safe payload from an arbitrary internal record.
 *
 * Only the allowed fields are read, each validated independently:
 * - `memberDispersionTotal`: `String(input.memberDispersionTotal ?? "0")`
 * - `currency`: one of "USD" | "ETH" | "CREDITS", default "USD"
 * - `lastUpdated`: the input string when present, else the current
 *   time as an ISO-8601 string
 * - `publicProgramStatus`: one of "simulation" | "testnet" |
 *   "production", default "simulation"
 * - `activeMemberCount`: included only when the input value is a
 *   finite, non-negative number
 *
 * Every other key — top-level or nested — is dropped, because the
 * output object is constructed from scratch.
 */
export function sanitizePublicLedgerPayload(
  input: Record<string, unknown>,
): PublicMemberDispersionPayload {
  const lastUpdated =
    typeof input.lastUpdated === "string" && input.lastUpdated.length > 0
      ? input.lastUpdated
      : new Date().toISOString();

  const payload: PublicMemberDispersionPayload = {
    memberDispersionTotal: String(input.memberDispersionTotal ?? "0"),
    currency: isPublicCurrency(input.currency) ? input.currency : "USD",
    lastUpdated,
    publicProgramStatus: isPublicProgramStatus(input.publicProgramStatus)
      ? input.publicProgramStatus
      : "simulation",
  };

  const count = input.activeMemberCount;
  if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
    payload.activeMemberCount = count;
  }

  return payload;
}

/**
 * Build a public payload from phi splits.
 *
 * Units: `PhiSplit.members` is an integer count of minor units (the
 * same minor units passed to `splitPhi` — e.g. cents for USD). The
 * total is the exact bigint sum of the splits' `members` components,
 * emitted as a decimal string in those same minor units. No scaling
 * or currency conversion is applied.
 *
 * Only the `members` component is read; the splits' other components
 * never enter the payload.
 */
export function buildPublicDispersionPayload(
  splits: readonly PhiSplit[],
  opts?: {
    currency?: PublicMemberDispersionPayload["currency"];
    publicProgramStatus?: PublicMemberDispersionPayload["publicProgramStatus"];
    activeMemberCount?: number;
    lastUpdated?: string;
  },
): PublicMemberDispersionPayload {
  let total = 0n;
  for (const split of splits) {
    total += split.members;
  }
  return sanitizePublicLedgerPayload({
    memberDispersionTotal: total.toString(),
    currency: opts?.currency,
    publicProgramStatus: opts?.publicProgramStatus,
    activeMemberCount: opts?.activeMemberCount,
    lastUpdated: opts?.lastUpdated,
  });
}

const FORBIDDEN_LOWER: ReadonlySet<string> = new Set(
  PUBLIC_FORBIDDEN_KEYS.map((key) => key.toLowerCase()),
);

/**
 * Recursively scan a value for forbidden keys.
 *
 * Walks plain objects and arrays at any depth and returns the dotted
 * paths (array indices as numeric segments, e.g. `items.0.reserve`)
 * of every key whose lowercase form is forbidden. Matching is
 * case-insensitive: "Trust", "RESERVE", and "FamilyTrust" all match.
 * Primitive values and null are ignored.
 */
export function findForbiddenKeys(value: unknown): string[] {
  const found: string[] = [];

  const visit = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, path === "" ? String(index) : `${path}.${index}`);
      });
      return;
    }
    if (current !== null && typeof current === "object") {
      for (const [key, child] of Object.entries(current)) {
        const childPath = path === "" ? key : `${path}.${key}`;
        if (FORBIDDEN_LOWER.has(key.toLowerCase())) {
          found.push(childPath);
        }
        visit(child, childPath);
      }
    }
  };

  visit(value, "");
  return found;
}

/**
 * Throw if a value contains any forbidden key at any depth.
 *
 * @throws {Error} listing every violating dotted path.
 */
export function assertPublicSafe(value: unknown): void {
  const violations = findForbiddenKeys(value);
  if (violations.length > 0) {
    throw new Error(
      `Public payload contains forbidden keys: ${violations.join(", ")}`,
    );
  }
}
