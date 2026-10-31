/**
 * @omega/mcp-gateway — JSON-RPC protocol + demo gateway tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { createGateway, ToolError, type JsonRpcResponse } from "./index.js";
import { createDemoGateway } from "./index.js";

interface ToolCallResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
  isError: boolean;
}

function assertResponse(response: JsonRpcResponse | null): JsonRpcResponse {
  if (response === null) throw new Error("expected a response, got null (notification)");
  return response;
}

function callResult(response: JsonRpcResponse | null): ToolCallResult {
  const res = assertResponse(response);
  if (res.error !== undefined) {
    throw new Error(`expected a result, got error ${res.error.code}: ${res.error.message}`);
  }
  return res.result as ToolCallResult;
}

async function callTool(
  gateway: ReturnType<typeof createDemoGateway>,
  id: number,
  name: string,
  args?: Record<string, unknown>,
): Promise<ToolCallResult> {
  const params: Record<string, unknown> = { name };
  if (args !== undefined) params["arguments"] = args;
  return callResult(await gateway.handle({ jsonrpc: "2.0", id, method: "tools/call", params }));
}

describe("JSON-RPC protocol envelope", () => {
  const gateway = createDemoGateway();

  it("answers ping with pong and echoes the id", async () => {
    const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    expect(res.result).toBe("pong");
    expect(res.error).toBeUndefined();
  });

  it("tools/list returns the registered tools sorted by name, each with an inputSchema", async () => {
    const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: "list-1", method: "tools/list" }));
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe("list-1");
    const result = res.result as { tools: { name: string; description: string; inputSchema: unknown }[] };
    const names = result.tools.map((tool) => tool.name);
    expect(names).toEqual([
      "files.list",
      "files.read",
      "files.search",
      "github.getRepo",
      "github.listIssues",
      "github.listReleases",
      "github.listRepos",
      "graph.listPeople",
      "graph.searchPosts",
      "graph.summary",
      "notes.get",
      "notes.list",
      "notes.search",
      "notion.getPage",
      "notion.queryDataSource",
      "notion.search",
      "stripe.getBalanceSummary",
      "stripe.listDispersionEvents",
    ]);
    expect(names).toEqual([...names].sort());
    for (const tool of result.tools) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeTypeOf("object");
      expect(tool.inputSchema).not.toBeNull();
    }
  });

  it("unknown method → -32601", async () => {
    const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 7, method: "nope/nope" }));
    expect(res.error?.code).toBe(-32601);
    expect(res.id).toBe(7);
  });

  it("unknown tool → -32602 with data.tool", async () => {
    const res = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "nope.tool", arguments: {} } }),
    );
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data).toEqual({ tool: "nope.tool" });
  });

  it("tools/call with a malformed params shape → -32602", async () => {
    for (const params of [null, "x", { arguments: {} }, { name: "graph.summary", arguments: "nope" }]) {
      const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params }));
      expect(res.error?.code).toBe(-32602);
    }
  });

  it("malformed requests → -32600", async () => {
    const badRequests: unknown[] = [
      null,
      "hello",
      42,
      [],
      {},
      { jsonrpc: "2.0" },
      { jsonrpc: "1.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", id: 1, method: "" },
      { id: 1, method: "ping" },
    ];
    for (const bad of badRequests) {
      const res = assertResponse(await gateway.handle(bad));
      expect(res.error?.code).toBe(-32600);
      expect(res.jsonrpc).toBe("2.0");
    }
  });

  it("notification (no id) → null response", async () => {
    expect(await gateway.handle({ jsonrpc: "2.0", method: "ping" })).toBeNull();
    expect(
      await gateway.handle({ jsonrpc: "2.0", method: "tools/call", params: { name: "graph.summary", arguments: {} } }),
    ).toBeNull();
  });

  it("handle never throws, even on exotic input", async () => {
    await expect(gateway.handle(undefined)).resolves.toBeTypeOf("object");
    await expect(gateway.handle(Symbol("x"))).resolves.toBeTypeOf("object");
  });
});

describe("handler error mapping", () => {
  it("ToolError → isError result (not a protocol error)", async () => {
    const gateway = createGateway();
    gateway.registerTool({
      name: "demo.fail",
      description: "Always fails with a ToolError.",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        throw new ToolError("caller-facing failure");
      },
    });
    const result = callResult(
      await gateway.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "demo.fail", arguments: {} } }),
    );
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "caller-facing failure" }]);
  });

  it("unexpected handler throw → -32603", async () => {
    const gateway = createGateway();
    gateway.registerTool({
      name: "demo.explode",
      description: "Always throws a generic error.",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        throw new Error("kaboom");
      },
    });
    const res = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "demo.explode", arguments: {} } }),
    );
    expect(res.error?.code).toBe(-32603);
  });

  it("duplicate tool registration throws", () => {
    const gateway = createGateway();
    const tool = {
      name: "demo.once",
      description: "Registered once.",
      inputSchema: { type: "object", properties: {} },
      handler: () => null,
    };
    gateway.registerTool(tool);
    expect(() => gateway.registerTool(tool)).toThrow(/already registered/);
  });
});

describe("demo gateway — meta-export adapter over the real synthetic export", () => {
  const gateway = createDemoGateway();

  it("graph.summary matches the synthetic fixture totals exactly", async () => {
    const result = await callTool(gateway, 1, "graph.summary", {});
    expect(result.isError).toBe(false);
    const summary = result.structuredContent as {
      ownerName: string;
      synthetic: boolean;
      peoplePerRing: { family: number; friends: number; work: number; public: number };
      postCount: number;
      mediaCount: number;
      threadCount: number;
      unclassifiedCount: number;
    };
    expect(summary.ownerName).toBe("Ada Whitfield");
    expect(summary.synthetic).toBe(true);
    expect(summary.peoplePerRing).toEqual({ family: 15, friends: 6, work: 4, public: 3 });
    expect(summary.postCount).toBe(14);
    expect(summary.threadCount).toBe(10);
    expect(summary.unclassifiedCount).toBe(11);
    // content text is the JSON string of the same result
    expect(JSON.parse(result.content[0]?.text ?? "")).toEqual(summary);
  });

  it("graph.listPeople with no ring returns all 28 people sorted by name", async () => {
    const result = await callTool(gateway, 2, "graph.listPeople", {});
    const { people } = result.structuredContent as { people: { name: string }[] };
    expect(people).toHaveLength(28);
    const names = people.map((person) => person.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("graph.listPeople ring filter: work → exactly 4 people, all ring work", async () => {
    const result = await callTool(gateway, 3, "graph.listPeople", { ring: "work" });
    const { people } = result.structuredContent as { people: { name: string; ring: string }[] };
    expect(people).toHaveLength(4);
    expect(people.every((person) => person.ring === "work")).toBe(true);
  });

  it("graph.listPeople with an invalid ring → ToolError result", async () => {
    const result = await callTool(gateway, 4, "graph.listPeople", { ring: "neighbors" });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Invalid ring/);
  });

  it("graph.searchPosts finds a known term from the generator templates, case-insensitively", async () => {
    const result = await callTool(gateway, 5, "graph.searchPosts", { query: "LEMON LOAF" });
    const { matches, count } = result.structuredContent as { matches: { text: string }[]; count: number };
    expect(count).toBe(1);
    expect(matches[0]?.text).toContain("lemon loaf");
  });

  it("graph.searchPosts rejects an empty query with a ToolError result", async () => {
    const empty = await callTool(gateway, 6, "graph.searchPosts", { query: "" });
    expect(empty.isError).toBe(true);
    const missing = await callTool(gateway, 7, "graph.searchPosts", {});
    expect(missing.isError).toBe(true);
  });
});
