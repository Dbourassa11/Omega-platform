/**
 * @omega/mcp-gateway — JSON-RPC 2.0 gateway core
 *
 * Transport-agnostic: `handle` takes an already-parsed JSON value and
 * returns a response object (or `null` for notifications). It never
 * throws — every failure becomes a JSON-RPC error response.
 *
 * Methods:
 * - "ping"            → "pong"
 * - "server/discover" → MCP 2026-07-28 discovery document
 * - "tools/list"      → { tools: [...], ttlMs, cacheScope }
 * - "tools/call"      → MCP-style { content, structuredContent, isError }
 *
 * Receipt gating: tools with `requiresReceipt: true` only run when
 * `params._meta.omegaReceipt` is present (and accepted by the optional
 * `receiptValidator`); otherwise the call fails with
 * OMEGA_RECEIPT_REQUIRED (-32001) and the handler never runs. Every
 * gated call that reaches the handler appends a ToolReceipt, readable
 * via `gateway.listReceipts()`.
 *
 * Protocol version: if `params._meta["io.modelcontextprotocol/protocolVersion"]`
 * is present and not in SUPPORTED_PROTOCOL_VERSIONS, the call fails
 * with UNSUPPORTED_PROTOCOL_VERSION (-32022). Absent _meta is accepted.
 *
 * Creator: David Charles Bourassa
 */

import { CircuitOpenError, type CircuitBreaker, type RateLimiter } from "./flow-control.js";
import { ToolError, type ToolDefinition } from "./registry.js";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

/** JSON-RPC 2.0 error codes, per spec, plus Omega/MCP extensions. */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** A receipt-gated tool was called without an accepted consent receipt. */
  OMEGA_RECEIPT_REQUIRED: -32001,
  /** Rate limit exceeded for the call's rate-limit key. */
  OMEGA_RATE_LIMITED: -32002,
  /** The circuit breaker is open; the handler was not run. */
  OMEGA_CIRCUIT_OPEN: -32003,
  /** Unsupported MCP protocol version (MCP 2026-07-28 spec). */
  UNSUPPORTED_PROTOCOL_VERSION: -32022,
} as const;

export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = ["2026-07-28", "2025-11-25"] as const;
export const LATEST_PROTOCOL_VERSION = "2026-07-28" as const;

/** A consent receipt as carried at `params._meta.omegaReceipt`. */
export interface OmegaReceiptMeta {
  ring?: string;
  purpose?: string;
  [key: string]: unknown;
}

export interface ReceiptValidationInfo {
  tool: string;
  ring?: string;
  purpose?: string;
  receipt: Record<string, unknown>;
}

/** Record of a gated tool call (success or handler error). */
export interface ToolReceipt {
  id: string;
  adapter: string;
  tool: string;
  ring: string;
  purpose: string;
  inputHash: string;
  outputHash: string;
  createdAt: string;
}

export interface RateLimitCallContext {
  tool: string;
  arguments: Record<string, unknown>;
  params: Record<string, unknown>;
}

export interface GatewayOptions {
  receiptValidator?: (info: ReceiptValidationInfo) => boolean;
  circuitBreaker?: CircuitBreaker;
  rateLimiter?: RateLimiter;
  rateLimitKey?: (call: RateLimitCallContext) => string;
}

export interface Gateway {
  registerTool(tool: ToolDefinition): void;
  handle(request: unknown): Promise<JsonRpcResponse | null>;
  listReceipts(): ToolReceipt[];
}

/**
 * FNV-1a 32-bit fingerprint, hex-encoded.
 * Non-cryptographic — used only as a lightweight content fingerprint
 * for ToolReceipt input/output hashes, never for security decisions.
 */
export function fingerprint(value: unknown): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : (JSON.stringify(value) ?? "null");
  } catch {
    text = String(value);
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  const error: JsonRpcError = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

function makeResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidId(value: unknown): value is JsonRpcId {
  return typeof value === "string" || typeof value === "number" || value === null;
}

function extractMeta(params: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(params)) return undefined;
  const meta = params["_meta"];
  return isPlainObject(meta) ? meta : undefined;
}

function unsupportedProtocolVersion(params: unknown): string | undefined {
  const meta = extractMeta(params);
  if (meta === undefined) return undefined;
  const version = meta["io.modelcontextprotocol/protocolVersion"];
  if (typeof version !== "string") return undefined;
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version) ? undefined : version;
}

export function createGateway(options: GatewayOptions = {}): Gateway {
  const tools = new Map<string, ToolDefinition>();
  const receipts: ToolReceipt[] = [];
  let receiptCounter = 0;

  function registerTool(tool: ToolDefinition): void {
    if (typeof tool.name !== "string" || tool.name.length === 0) {
      throw new Error("Tool name must be a non-empty string");
    }
    if (tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    tools.set(tool.name, tool);
  }

  function listReceipts(): ToolReceipt[] {
    return [...receipts];
  }

  function appendReceipt(
    tool: ToolDefinition,
    receiptMeta: Record<string, unknown>,
    args: unknown,
    output: unknown,
  ): void {
    receiptCounter += 1;
    const ring = typeof receiptMeta["ring"] === "string" ? (receiptMeta["ring"] as string) : "public";
    const purpose =
      typeof receiptMeta["purpose"] === "string" ? (receiptMeta["purpose"] as string) : "unspecified";
    receipts.push({
      id: `receipt-${receiptCounter}`,
      adapter: tool.adapter ?? tool.name.split(".")[0] ?? "unknown",
      tool: tool.name,
      ring,
      purpose,
      inputHash: fingerprint(args ?? {}),
      outputHash: fingerprint(output ?? null),
      createdAt: new Date().toISOString(),
    });
  }

  async function dispatch(id: JsonRpcId, method: string, params: unknown): Promise<JsonRpcResponse> {
    const badVersion = unsupportedProtocolVersion(params);
    if (badVersion !== undefined) {
      return makeError(
        id,
        JSON_RPC_ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION,
        `Unsupported protocol version: ${badVersion}`,
        { protocolVersion: badVersion, supported: [...SUPPORTED_PROTOCOL_VERSIONS] },
      );
    }

    switch (method) {
      case "ping":
        return makeResult(id, "pong");

      case "server/discover":
        return makeResult(id, {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "@omega/mcp-gateway", version: "0.0.0" },
        });

      case "tools/list": {
        const list = [...tools.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }));
        return makeResult(id, { tools: list, ttlMs: 60000, cacheScope: "private" });
      }

      case "tools/call": {
        if (!isPlainObject(params)) {
          return makeError(id, JSON_RPC_ERROR_CODES.INVALID_PARAMS, "Invalid params: tools/call expects an object with a tool name");
        }
        const name = params["name"];
        if (typeof name !== "string" || name.length === 0) {
          return makeError(id, JSON_RPC_ERROR_CODES.INVALID_PARAMS, "Invalid params: tool name must be a non-empty string");
        }
        const args = params["arguments"];
        if (args !== undefined && !isPlainObject(args)) {
          return makeError(id, JSON_RPC_ERROR_CODES.INVALID_PARAMS, "Invalid params: tool arguments must be an object", { tool: name });
        }
        const tool = tools.get(name);
        if (tool === undefined) {
          return makeError(id, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Unknown tool: ${name}`, { tool: name });
        }

        // --- Consent-receipt gate (handler MUST NOT run on failure) ---
        let receiptMeta: Record<string, unknown> | undefined;
        if (tool.requiresReceipt === true) {
          const meta = extractMeta(params);
          const candidate = meta?.["omegaReceipt"];
          if (!isPlainObject(candidate)) {
            return makeError(
              id,
              JSON_RPC_ERROR_CODES.OMEGA_RECEIPT_REQUIRED,
              `Consent receipt required for tool: ${name}`,
              { tool: name },
            );
          }
          receiptMeta = candidate;
          if (options.receiptValidator !== undefined) {
            const info: ReceiptValidationInfo = {
              tool: name,
              receipt: candidate,
            };
            if (typeof candidate["ring"] === "string") info.ring = candidate["ring"] as string;
            if (typeof candidate["purpose"] === "string") info.purpose = candidate["purpose"] as string;
            let accepted = false;
            try {
              accepted = options.receiptValidator(info);
            } catch {
              accepted = false;
            }
            if (!accepted) {
              return makeError(
                id,
                JSON_RPC_ERROR_CODES.OMEGA_RECEIPT_REQUIRED,
                `Consent receipt rejected for tool: ${name}`,
                { tool: name },
              );
            }
          }
        }

        // --- Rate limiting ---
        if (options.rateLimiter !== undefined) {
          const callArgs = (args ?? {}) as Record<string, unknown>;
          const key =
            options.rateLimitKey !== undefined
              ? options.rateLimitKey({ tool: name, arguments: callArgs, params })
              : name;
          if (!options.rateLimiter.tryAcquire(key)) {
            return makeError(id, JSON_RPC_ERROR_CODES.OMEGA_RATE_LIMITED, `Rate limit exceeded for tool: ${name}`, {
              tool: name,
            });
          }
        }

        // --- Handler execution (optionally through the circuit breaker) ---
        try {
          const invoke = async (): Promise<unknown> => tool.handler(args ?? {}, { toolName: name });
          const value =
            options.circuitBreaker !== undefined ? await options.circuitBreaker.exec(invoke) : await invoke();
          const normalized = value === undefined ? null : value;
          if (receiptMeta !== undefined) {
            appendReceipt(tool, receiptMeta, args ?? {}, normalized);
          }
          return makeResult(id, {
            content: [{ type: "text", text: JSON.stringify(normalized) }],
            structuredContent: normalized,
            isError: false,
          });
        } catch (err) {
          if (err instanceof CircuitOpenError) {
            if (receiptMeta !== undefined) {
              appendReceipt(tool, receiptMeta, args ?? {}, { error: err.message });
            }
            return makeError(id, JSON_RPC_ERROR_CODES.OMEGA_CIRCUIT_OPEN, err.message, { tool: name });
          }
          if (err instanceof ToolError) {
            if (receiptMeta !== undefined) {
              appendReceipt(tool, receiptMeta, args ?? {}, { error: err.message });
            }
            // MCP convention: tool-level failures are results, not protocol errors.
            return makeResult(id, {
              content: [{ type: "text", text: err.message }],
              isError: true,
            });
          }
          if (receiptMeta !== undefined) {
            appendReceipt(tool, receiptMeta, args ?? {}, { error: err instanceof Error ? err.message : "Internal error" });
          }
          const message = err instanceof Error ? err.message : "Internal error";
          return makeError(id, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, message);
        }
      }

      default:
        return makeError(id, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`, { method });
    }
  }

  async function handle(request: unknown): Promise<JsonRpcResponse | null> {
    try {
      if (!isPlainObject(request)) {
        return makeError(null, JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Invalid Request: expected a JSON-RPC object");
      }
      const hasId = Object.prototype.hasOwnProperty.call(request, "id");
      const rawId = request["id"];
      if (hasId && !isValidId(rawId)) {
        return makeError(null, JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Invalid Request: id must be a string, number, or null");
      }
      const id: JsonRpcId = hasId ? (rawId as JsonRpcId) : null;
      if (request["jsonrpc"] !== "2.0" || typeof request["method"] !== "string" || request["method"].length === 0) {
        return makeError(null, JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Invalid Request: jsonrpc must be \"2.0\" and method a non-empty string");
      }
      const method = request["method"];
      const params = request["params"];

      if (!hasId) {
        // Notification: process quietly, never respond.
        try {
          await dispatch(null, method, params);
        } catch {
          // Notification failures are swallowed by definition.
        }
        return null;
      }
      return await dispatch(id, method, params);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return makeError(null, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, message);
    }
  }

  return { registerTool, handle, listReceipts };
}
