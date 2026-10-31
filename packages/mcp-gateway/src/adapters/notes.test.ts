/**
 * @omega/mcp-gateway — notes adapter tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { ToolError, type ToolDefinition } from "../registry.js";
import { createNotesTools, DEMO_NOTES } from "./notes.js";

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error(`missing tool: ${name}`);
  return tool;
}

async function run(tools: ToolDefinition[], name: string, args: unknown): Promise<unknown> {
  const tool = findTool(tools, name);
  return tool.handler(args, { toolName: name });
}

describe("createNotesTools over DEMO_NOTES", () => {
  const tools = createNotesTools(DEMO_NOTES);

  it("registers notes.list, notes.search, and notes.get", () => {
    expect(tools.map((tool) => tool.name).sort()).toEqual(["notes.get", "notes.list", "notes.search"]);
  });

  it("notes.list returns ids and titles parsed from the first '# ' heading", async () => {
    const list = (await run(tools, "notes.list", {})) as { id: string; title: string }[];
    expect(list).toEqual([
      { id: "ada-garden-log", title: "Ada's Garden Log" },
      { id: "omega-demo-script", title: "Omega Demo Script" },
      { id: "book-club-notes", title: "Book Club Notes" },
    ]);
  });

  it("title falls back to the id when a note has no '# ' heading", async () => {
    const custom = createNotesTools([{ id: "plain-note", markdown: "No heading here.\nJust text." }]);
    const list = (await run(custom, "notes.list", {})) as { id: string; title: string }[];
    expect(list).toEqual([{ id: "plain-note", title: "plain-note" }]);
  });

  it("notes.search returns the first matching line as an excerpt (≤160 chars)", async () => {
    const results = (await run(tools, "notes.search", { query: "TOMATOES" })) as {
      id: string;
      title: string;
      excerpt: string;
    }[];
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("ada-garden-log");
    expect(results[0]?.excerpt).toContain("tomatoes");
    expect((results[0]?.excerpt ?? "").length).toBeLessThanOrEqual(160);
  });

  it("notes.search with an empty query throws ToolError", async () => {
    await expect(run(tools, "notes.search", { query: "  " })).rejects.toBeInstanceOf(ToolError);
  });

  it("notes.get returns the full markdown for a known id", async () => {
    const note = (await run(tools, "notes.get", { id: "book-club-notes" })) as {
      id: string;
      title: string;
      markdown: string;
    };
    expect(note.title).toBe("Book Club Notes");
    expect(note.markdown).toContain("Ana Silva picked the next novel");
  });

  it("notes.get with an unknown id throws ToolError", async () => {
    await expect(run(tools, "notes.get", { id: "no-such-note" })).rejects.toBeInstanceOf(ToolError);
    await expect(run(tools, "notes.get", { id: "no-such-note" })).rejects.toThrow(/Unknown note/);
  });
});
