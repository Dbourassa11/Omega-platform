/**
 * @omega/mcp-gateway — Notion adapter tests (synthetic fixtures)
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { ToolError, type ToolDefinition } from "../registry.js";
import { createNotionTools, NOTION_FIXTURE_PAGES, NOTION_PROJECT_TRACKER_ID } from "./notion.js";

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((c) => c.name === name);
  if (tool === undefined) throw new Error(`missing tool: ${name}`);
  return tool;
}

async function run(tools: ToolDefinition[], name: string, args: unknown): Promise<unknown> {
  return findTool(tools, name).handler(args, { toolName: name });
}

describe("createNotionTools over synthetic fixtures", () => {
  const tools = createNotionTools();

  it("registers three receipt-gated tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["notion.getPage", "notion.queryDataSource", "notion.search"]);
    for (const tool of tools) {
      expect(tool.requiresReceipt).toBe(true);
      expect(tool.adapter).toBe("notion");
    }
  });

  it("search matches titles across pages and data sources", async () => {
    const tracker = (await run(tools, "notion.search", { query: "project tracker" })) as {
      results: { object: string }[];
      count: number;
    };
    expect(tracker.count).toBe(1);
    expect(tracker.results[0]?.object).toBe("data_source");
    const garden = (await run(tools, "notion.search", { query: "GARDEN" })) as { count: number };
    expect(garden.count).toBe(1);
    const none = (await run(tools, "notion.search", { query: "zzz-no-match" })) as { count: number };
    expect(none.count).toBe(0);
  });

  it("queryDataSource filters rows by Status select equals", async () => {
    const inProgress = (await run(tools, "notion.queryDataSource", {
      dataSourceId: NOTION_PROJECT_TRACKER_ID,
      status: "In Progress",
    })) as { count: number; results: { object: string }[] };
    expect(inProgress.count).toBe(2);
    expect(inProgress.results.every((r) => r.object === "page")).toBe(true);
    const done = (await run(tools, "notion.queryDataSource", { status: "Done" })) as { count: number };
    expect(done.count).toBe(1);
    await expect(run(tools, "notion.queryDataSource", { dataSourceId: "nope", status: "Done" })).rejects.toBeInstanceOf(
      ToolError,
    );
  });

  it("getPage returns a 2026-03-11-shaped page, unknown -> ToolError", async () => {
    const first = NOTION_FIXTURE_PAGES[0];
    if (first === undefined) throw new Error("fixture missing");
    const page = (await run(tools, "notion.getPage", { id: first.id })) as { object: string; url: string };
    expect(page.object).toBe("page");
    expect(page.url).toBe("#");
    await expect(run(tools, "notion.getPage", { id: "missing" })).rejects.toThrow(/Unknown page/);
  });
});
