/**
 * @omega/mcp-gateway — stdio transport tests
 *
 * Creator: David Charles Bourassa
 */

import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { createDemoGateway, type JsonRpcResponse } from "./index.js";
import { runStdioGateway } from "./stdio.js";

describe("runStdioGateway", () => {
  it("answers newline-delimited requests and reports garbage lines as -32700", async () => {
    const gateway = createDemoGateway();
    const input = new PassThrough();
    const output = new PassThrough();
    let captured = "";
    output.on("data", (chunk: Buffer) => {
      captured += chunk.toString("utf8");
    });

    const done = runStdioGateway(gateway, input, output);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "graph.summary", arguments: {} } })}\n`,
    );
    input.write("this is not json\n");
    input.end();
    await done;

    const lines = captured
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JsonRpcResponse);
    expect(lines).toHaveLength(3);

    expect(lines[0]?.id).toBe(1);
    const list = lines[0]?.result as { tools: { name: string }[] };
    expect(list.tools.map((tool) => tool.name)).toContain("graph.summary");

    expect(lines[1]?.id).toBe(2);
    const call = lines[1]?.result as { structuredContent: { ownerName: string }; isError: boolean };
    expect(call.isError).toBe(false);
    expect(call.structuredContent.ownerName).toBe("Ada Whitfield");

    expect(lines[2]?.id).toBeNull();
    expect(lines[2]?.error?.code).toBe(-32700);
  });

  it("writes no line for notifications", async () => {
    const gateway = createDemoGateway();
    const input = new PassThrough();
    const output = new PassThrough();
    let captured = "";
    output.on("data", (chunk: Buffer) => {
      captured += chunk.toString("utf8");
    });

    const done = runStdioGateway(gateway, input, output);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "ping" })}\n`);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 9, method: "ping" })}\n`);
    input.end();
    await done;

    const lines = captured.split("\n").filter((line) => line.trim().length > 0);
    expect(lines).toHaveLength(1);
    expect((JSON.parse(lines[0] ?? "") as JsonRpcResponse).result).toBe("pong");
  });
});
