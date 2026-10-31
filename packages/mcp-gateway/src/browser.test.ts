/**
 * @omega/mcp-gateway — browser entry guard tests
 *
 * Proves the "./browser" entry (src/browser.ts) works on its own and
 * that no module in its relative import closure imports a "node:"
 * builtin — the durable fix for the web bundle, replacing the webpack
 * node:-shim that used to live in apps/web/next.config.ts.
 *
 * Creator: David Charles Bourassa
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createDemoGateway, type JsonRpcResponse } from "./browser.js";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Every import/export specifier appearing in a source file. */
function specifiersOf(source: string): string[] {
  // Strip block comments first so prose mentioning imports (or quoted
  // subpaths like "./catalog" in catalog.ts's header) is not mistaken
  // for a real import/export statement.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const specifiers: string[] = [];
  const pattern = /(?:import|export)\b[^"']*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const specifier = match[1];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

/** Absolute .ts paths of every module reachable from `entry` via relative imports. */
function relativeImportClosure(entry: string): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    for (const specifier of specifiersOf(readFileSync(current, "utf8"))) {
      if (!specifier.startsWith(".")) continue;
      const resolved = resolve(dirname(current), specifier.replace(/\.js$/, ".ts"));
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

function assertResponse(response: JsonRpcResponse | null): JsonRpcResponse {
  if (response === null) throw new Error("expected a response, got null (notification)");
  return response;
}

describe("browser entry — createDemoGateway", () => {
  it("answers tools/list with the demo tools", async () => {
    const gateway = createDemoGateway();
    const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    expect(res.error).toBeUndefined();
    const result = res.result as { tools: { name: string }[] };
    const names = result.tools.map((tool) => tool.name);
    expect(names).toContain("files.list");
    expect(names).toContain("notes.list");
    expect(names).toContain("graph.summary");
    expect(names).toEqual([...names].sort());
  });

  it("answers tools/call for an ungated demo tool", async () => {
    const gateway = createDemoGateway();
    const res = assertResponse(
      await gateway.handle({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "files.read", arguments: { path: "hello-omega.md" } },
      }),
    );
    expect(res.error).toBeUndefined();
    const result = res.result as { isError: boolean; structuredContent: { path: string; content: string } };
    expect(result.isError).toBe(false);
    expect(result.structuredContent.path).toBe("hello-omega.md");
    expect(result.structuredContent.content).toContain("# Hello Omega");
  });
});

describe("browser entry — node-free import closure", () => {
  it("no module in the browser entry's relative import closure imports a node: builtin", () => {
    const closure = relativeImportClosure(resolve(SRC_DIR, "browser.ts"));
    // The walk must actually cover the gateway core and pure adapters.
    const basenames = [...closure].map((file) => file.split("/").pop());
    expect(basenames).toContain("jsonrpc.ts");
    expect(basenames).toContain("registry.ts");
    expect(basenames).toContain("flow-control.ts");
    expect(basenames).toContain("catalog.ts");
    expect(basenames).toContain("files.ts");
    // The node-only modules must not be reachable at all.
    expect(basenames).not.toContain("infra.ts");
    expect(basenames).not.toContain("stdio.ts");
    expect(basenames).not.toContain("files-node.ts");
    for (const file of closure) {
      for (const specifier of specifiersOf(readFileSync(file, "utf8"))) {
        expect(specifier.startsWith("node:"), `${file} imports ${specifier}`).toBe(false);
      }
    }
  });
});
