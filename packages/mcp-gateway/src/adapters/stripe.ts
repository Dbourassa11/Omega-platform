/**
 * @omega/mcp-gateway — Stripe adapter (SANDBOX synthetic fixtures)
 *
 * SANDBOX fixture data only — no live Stripe calls are made anywhere.
 * Every result payload includes `livemode: false` and `sandbox: true`.
 * All fixture content is fictional / synthetic.
 *
 * Creator: David Charles Bourassa
 */

import { ToolError, type ToolDefinition } from "../registry.js";

// ---------------------------------------------------------------------------
// Synthetic sandbox fixtures
// ---------------------------------------------------------------------------

export interface StripeDispersionEventFixture {
  id: string;
  object: "dispersion_event";
  type: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  livemode: false;
  sandbox: true;
  synthetic: true;
}

export const STRIPE_FIXTURE_DISPERSION_EVENTS: readonly StripeDispersionEventFixture[] = [
  {
    id: "disp_synthetic_001",
    object: "dispersion_event",
    type: "payout.paid",
    amount: 12500,
    currency: "usd",
    status: "paid",
    created: 1761000000,
    livemode: false,
    sandbox: true,
    synthetic: true,
  },
  {
    id: "disp_synthetic_002",
    object: "dispersion_event",
    type: "charge.succeeded",
    amount: 4900,
    currency: "usd",
    status: "succeeded",
    created: 1761100000,
    livemode: false,
    sandbox: true,
    synthetic: true,
  },
  {
    id: "disp_synthetic_003",
    object: "dispersion_event",
    type: "payout.created",
    amount: 25000,
    currency: "usd",
    status: "pending",
    created: 1761200000,
    livemode: false,
    sandbox: true,
    synthetic: true,
  },
] as const;

export interface StripeBalanceSummaryFixture {
  object: "balance";
  livemode: false;
  sandbox: true;
  synthetic: true;
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
  availableTotalUsdCents: number;
  pendingTotalUsdCents: number;
}

export const STRIPE_FIXTURE_BALANCE: StripeBalanceSummaryFixture = {
  object: "balance",
  livemode: false,
  sandbox: true,
  synthetic: true,
  available: [{ amount: 42400, currency: "usd" }],
  pending: [{ amount: 25000, currency: "usd" }],
  availableTotalUsdCents: 42400,
  pendingTotalUsdCents: 25000,
};

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function createStripeTools(): ToolDefinition[] {
  return [
    {
      name: "stripe.listDispersionEvents",
      description: "SANDBOX fixture — no live Stripe calls. List synthetic Stripe dispersion events (livemode: false).",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number", minimum: 1 } },
        additionalProperties: false,
      },
      adapter: "stripe",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { limit?: unknown }) => {
        const limit = args?.limit;
        if (limit !== undefined && (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1)) {
          throw new ToolError("stripe.listDispersionEvents limit must be a positive number");
        }
        const events =
          limit === undefined
            ? [...STRIPE_FIXTURE_DISPERSION_EVENTS]
            : STRIPE_FIXTURE_DISPERSION_EVENTS.slice(0, Math.floor(limit));
        return { events, count: events.length, livemode: false, sandbox: true, synthetic: true };
      },
    },
    {
      name: "stripe.getBalanceSummary",
      description: "SANDBOX fixture — no live Stripe calls. Get a synthetic Stripe balance summary (livemode: false).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      adapter: "stripe",
      requiresReceipt: true,
      riskLevel: "medium",
      handler: () => ({ ...STRIPE_FIXTURE_BALANCE }),
    },
  ];
}
