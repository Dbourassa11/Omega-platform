/**
 * @omega/mcp-gateway — tool registry contracts
 *
 * A tool is a named, JSON-Schema-described handler. Handlers signal
 * caller-facing failures (bad arguments, unknown ids, missing files)
 * by throwing `ToolError`; the gateway converts those to MCP-style
 * `isError: true` results instead of protocol errors.
 *
 * Creator: David Charles Bourassa
 */

/** Error type handlers throw for caller-facing tool failures. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

/** Context passed to every tool handler invocation. */
export interface ToolContext {
  /** Name of the tool being invoked. */
  readonly toolName: string;
}

/** Risk classification for a tool, surfaced in the pure catalog. */
export type ToolRiskLevel = "low" | "medium" | "high";

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object describing the tool's arguments. */
  inputSchema: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handler args are validated per-tool from raw JSON-RPC params
  handler: (args: any, ctx: ToolContext) => unknown | Promise<unknown>;
  /**
   * When true, `tools/call` for this tool requires a consent receipt
   * at `params._meta.omegaReceipt`. Missing or validator-rejected
   * receipts fail with OMEGA_RECEIPT_REQUIRED and the handler never runs.
   */
  requiresReceipt?: boolean;
  /** Adapter id this tool belongs to (e.g. "github", "notion", "stripe"). */
  adapter?: string;
  /** Risk classification surfaced to hosts / the catalog. */
  riskLevel?: ToolRiskLevel;
}
