/**
 * @omega/mcp-gateway — receipt gating + MCP 2026-07-28 alignment tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { createGateway, JSON_RPC_ERROR_CODES, type JsonRpcResponse } from "./index.js";
import { createGithubTools } from "./adapters/github.js";
import { CircuitBreaker, RateLimiter } from "./infra.js";

function assertResponse(response: JsonRpcResponse | null): JsonRpcResponse {
  if (response === null) throw new Error("expected a response, got null");
  return response;
}

const RECEIPT = { ring: "public", purpose: "demo-read" };

function gatewayWithGithub(validator?: (info: { tool: string; ring?: string; purpose?: string; receipt: Record<string, unknown> }) => boolean) {
  const gateway = validator ? createGateway({ receiptValidator: validator }) : createGateway();
  for (const tool of createGithubTools()) gateway.registerTool(tool);
  return gateway;
}

describe("receipt-gated dispatch", () => {
  it("missing receipt -> -32001 and handler does not run", async () => {
    let ran = false;
    const gateway = createGateway();
    gateway.registerTool({
      name: "demo.gated",
      description: "Gated demo tool.",
      inputSchema: { type: "object", properties: {} },
      requiresReceipt: true,
      adapter: "demo",
      handler: () => {
        ran = true;
        return { ok: true };
      },
    });
    const res = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "demo.gated", arguments: {} } }),
    );
    expect(res.error?.code).toBe(JSON_RPC_ERROR_CODES.OMEGA_RECEIPT_REQUIRED);
    expect(res.error?.code).toBe(-32001);
    expect(ran).toBe(false);
    expect(gateway.listReceipts()).toHaveLength(0);
  });

  it("receipt at params._meta.omegaReceipt allows the call and appends a ToolReceipt", async () => {
    const gateway = gatewayWithGithub();
    const res = assertResponse(
      await gateway.handle({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "github.listRepos", arguments: {}, _meta: { omegaReceipt: RECEIPT } },
      }),
    );
    expect(res.error).toBeUndefined();
    const result = res.result as { structuredContent: { count: number }; isError: boolean };
    expect(result.isError).toBe(false);
    expect(result.structuredContent.count).toBe(3);
    const receipts = gateway.listReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.tool).toBe("github.listRepos");
    expect(receipts[0]?.adapter).toBe("github");
    expect(receipts[0]?.ring).toBe("public");
    expect(receipts[0]?.purpose).toBe("demo-read");
    expect(receipts[0]?.inputHash).toMatch(/^[0-9a-f]{8}$/);
    expect(receipts[0]?.outputHash).toMatch(/^[0-9a-f]{8}$/);
    expect(receipts[0]?.id).toBeTruthy();
    expect(receipts[0]?.createdAt).toBeTruthy();
  });

  it("validator-rejected receipt -> -32001 and handler does not run", async () => {
    const gateway = gatewayWithGithub(() => false);
    const res = assertResponse(
      await gateway.handle({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "github.listRepos", arguments: {}, _meta: { omegaReceipt: RECEIPT } },
      }),
    );
    expect(res.error?.code).toBe(-32001);
    expect(gateway.listReceipts()).toHaveLength(0);
  });

  it("validator receives tool/ring/purpose/receipt", async () => {
    const seen: unknown[] = [];
    const gateway = gatewayWithGithub((info) => {
      seen.push(info);
      return info.purpose === "demo-read";
    });
    const ok = assertResponse(
      await gateway.handle({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "github.listRepos", arguments: {}, _meta: { omegaReceipt: RECEIPT } },
      }),
    );
    expect(ok.error).toBeUndefined();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ tool: "github.listRepos", ring: "public", purpose: "demo-read" });
  });

  it("gated handler error still appends a ToolReceipt and defaults ring/purpose", async () => {
    const gateway = gatewayWithGithub();
    const res = assertResponse(
      await gateway.handle({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "github.getRepo", arguments: { repo: "nope" }, _meta: { omegaReceipt: {} } },
      }),
    );
    const result = res.result as { isError: boolean };
    expect(result.isError).toBe(true);
    const receipts = gateway.listReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.ring).toBe("public");
    expect(receipts[0]?.purpose).toBe("unspecified");
  });

  it("ungated tools need no receipt and produce no ToolReceipt", async () => {
    const gateway = createGateway();
    gateway.registerTool({
      name: "demo.open",
      description: "Open demo tool.",
      inputSchema: { type: "object", properties: {} },
      handler: () => ({ ok: true }),
    });
    const res = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "demo.open", arguments: {} } }),
    );
    expect(res.error).toBeUndefined();
    expect(gateway.listReceipts()).toHaveLength(0);
  });
});

describe("MCP 2026-07-28 alignment", () => {
  it("server/discover returns the 2026-07-28 discovery document", async () => {
    const gateway = createGateway();
    const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 1, method: "server/discover" }));
    expect(res.result).toEqual({
      protocolVersion: "2026-07-28",
      capabilities: { tools: {} },
      serverInfo: { name: "@omega/mcp-gateway", version: "0.0.0" },
    });
  });

  it("tools/list gains ttlMs and cacheScope hints", async () => {
    const gateway = gatewayWithGithub();
    const res = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const result = res.result as { tools: unknown[]; ttlMs: number; cacheScope: string };
    expect(result.ttlMs).toBe(60000);
    expect(result.cacheScope).toBe("private");
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it("unsupported protocol version in _meta -> -32022; supported/absent accepted", async () => {
    const gateway = createGateway();
    const bad = assertResponse(
      await gateway.handle({
        jsonrpc: "2.0",
        id: 3,
        method: "ping",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": "1999-01-01" } },
      }),
    );
    expect(bad.error?.code).toBe(-32022);
    expect(bad.error?.code).toBe(JSON_RPC_ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION);
    for (const version of ["2026-07-28", "2025-11-25"]) {
      const ok = assertResponse(
        await gateway.handle({
          jsonrpc: "2.0",
          id: 4,
          method: "ping",
          params: { _meta: { "io.modelcontextprotocol/protocolVersion": version } },
        }),
      );
      expect(ok.result).toBe("pong");
    }
    const absent = assertResponse(await gateway.handle({ jsonrpc: "2.0", id: 5, method: "ping" }));
    expect(absent.result).toBe("pong");
  });
});

describe("gateway rate limiter + circuit breaker wiring", () => {
  it("rate limiter blocks excess gated/ungated calls with -32002", async () => {
    const gateway = createGateway({ rateLimiter: new RateLimiter({ capacity: 1, refillPerSecond: 0 }) });
    gateway.registerTool({
      name: "demo.open",
      description: "Open demo tool.",
      inputSchema: { type: "object", properties: {} },
      handler: () => ({ ok: true }),
    });
    const first = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "demo.open", arguments: {} } }),
    );
    expect(first.error).toBeUndefined();
    const second = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "demo.open", arguments: {} } }),
    );
    expect(second.error?.code).toBe(JSON_RPC_ERROR_CODES.OMEGA_RATE_LIMITED);
  });

  it("circuit breaker opens and maps to -32003", async () => {
    const gateway = createGateway({
      circuitBreaker: new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 }),
    });
    gateway.registerTool({
      name: "demo.explode",
      description: "Always throws.",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        throw new Error("kaboom");
      },
    });
    const first = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "demo.explode", arguments: {} } }),
    );
    expect(first.error?.code).toBe(-32603);
    const second = assertResponse(
      await gateway.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "demo.explode", arguments: {} } }),
    );
    expect(second.error?.code).toBe(JSON_RPC_ERROR_CODES.OMEGA_CIRCUIT_OPEN);
  });
});
