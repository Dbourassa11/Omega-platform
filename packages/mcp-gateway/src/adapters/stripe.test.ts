/**
 * @omega/mcp-gateway — Stripe adapter tests (SANDBOX fixtures)
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import type { ToolDefinition } from "../registry.js";
import { createStripeTools } from "./stripe.js";

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((c) => c.name === name);
  if (tool === undefined) throw new Error(`missing tool: ${name}`);
  return tool;
}

async function run(tools: ToolDefinition[], name: string, args: unknown): Promise<unknown> {
  return findTool(tools, name).handler(args, { toolName: name });
}

describe("createStripeTools over SANDBOX fixtures", () => {
  const tools = createStripeTools();

  it("registers two receipt-gated sandbox tools with sandbox wording", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["stripe.getBalanceSummary", "stripe.listDispersionEvents"]);
    for (const tool of tools) {
      expect(tool.requiresReceipt).toBe(true);
      expect(tool.adapter).toBe("stripe");
      expect(tool.description).toContain("SANDBOX fixture — no live Stripe calls");
    }
  });

  it("listDispersionEvents always carries livemode:false and sandbox:true", async () => {
    const result = (await run(tools, "stripe.listDispersionEvents", {})) as {
      livemode: boolean;
      sandbox: boolean;
      count: number;
      events: { livemode: boolean; sandbox: boolean }[];
    };
    expect(result.livemode).toBe(false);
    expect(result.sandbox).toBe(true);
    expect(result.count).toBe(3);
    for (const event of result.events) {
      expect(event.livemode).toBe(false);
      expect(event.sandbox).toBe(true);
    }
    const limited = (await run(tools, "stripe.listDispersionEvents", { limit: 1 })) as { count: number };
    expect(limited.count).toBe(1);
  });

  it("getBalanceSummary always carries livemode:false and sandbox:true", async () => {
    const result = (await run(tools, "stripe.getBalanceSummary", {})) as {
      livemode: boolean;
      sandbox: boolean;
      availableTotalUsdCents: number;
    };
    expect(result.livemode).toBe(false);
    expect(result.sandbox).toBe(true);
    expect(result.availableTotalUsdCents).toBe(42400);
  });
});
