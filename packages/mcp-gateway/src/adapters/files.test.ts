/**
 * @omega/mcp-gateway — files adapter tests
 *
 * Creator: David Charles Bourassa
 */

import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ToolError, type ToolDefinition } from "../registry.js";
import { createNodeFileProvider } from "./files-node.js";
import { createFilesTools, createMemoryFileProvider, type FileProvider } from "./files.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/files/", import.meta.url));

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error(`missing tool: ${name}`);
  return tool;
}

async function run(tools: ToolDefinition[], name: string, args: unknown): Promise<unknown> {
  const tool = findTool(tools, name);
  return tool.handler(args, { toolName: name });
}

describe("memory file provider + files tools", () => {
  const provider = createMemoryFileProvider({
    "b.txt": "second file\nwith a hidden gem line",
    "a.md": "# Alpha\n\nThe gem is mentioned here too.",
  });
  const tools = createFilesTools(provider);

  it("list returns entries sorted by path with byte sizes", async () => {
    const entries = await provider.list();
    expect(entries.map((entry) => entry.path)).toEqual(["a.md", "b.txt"]);
    for (const entry of entries) {
      expect(entry.size).toBeGreaterThan(0);
    }
  });

  it("files.list returns the provider entries", async () => {
    const entries = (await run(tools, "files.list", {})) as { path: string; size: number }[];
    expect(entries.map((entry) => entry.path)).toEqual(["a.md", "b.txt"]);
  });

  it("files.read returns path and content", async () => {
    const result = (await run(tools, "files.read", { path: "a.md" })) as { path: string; content: string };
    expect(result.path).toBe("a.md");
    expect(result.content).toContain("# Alpha");
  });

  it("files.read of a missing file throws ToolError", async () => {
    await expect(run(tools, "files.read", { path: "missing.txt" })).rejects.toBeInstanceOf(ToolError);
  });

  it("files.search finds the first matching line per file", async () => {
    const results = (await run(tools, "files.search", { query: "GEM" })) as { path: string; excerpt: string }[];
    expect(results.map((result) => result.path)).toEqual(["a.md", "b.txt"]);
    expect(results[0]?.excerpt).toContain("gem");
    expect(results[1]?.excerpt).toContain("gem");
  });
});

describe("node file provider over the shipped fixtures", () => {
  const provider: FileProvider = createNodeFileProvider(FIXTURES_DIR);
  const tools = createFilesTools(provider);

  it("lists the fixture files", async () => {
    const entries = await provider.list();
    expect(entries.map((entry) => entry.path)).toEqual([
      "ada-garden-notes.txt",
      "book-club.md",
      "hello-omega.md",
    ]);
  });

  it("reads a legitimate fixture file", async () => {
    const content = await provider.read("hello-omega.md");
    expect(content).toContain("# Hello Omega");
    const viaTool = (await run(tools, "files.read", { path: "ada-garden-notes.txt" })) as { content: string };
    expect(viaTool.content).toContain("garden tomatoes");
  });

  it("searches the fixture files", async () => {
    const results = (await run(tools, "files.search", { query: "book club" })) as { path: string }[];
    expect(results.map((result) => result.path)).toContain("book-club.md");
  });

  it("rejects relative path traversal", async () => {
    await expect(provider.read("../secret")).rejects.toBeInstanceOf(ToolError);
    await expect(provider.read("../secret")).rejects.toThrow(/path escapes root/);
    await expect(provider.read("../../package.json")).rejects.toThrow(/path escapes root/);
  });

  it("rejects absolute paths outside the root", async () => {
    await expect(provider.read("/etc/passwd")).rejects.toBeInstanceOf(ToolError);
    await expect(provider.read("/etc/passwd")).rejects.toThrow(/path escapes root/);
  });
});
