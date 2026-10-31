/**
 * @omega/mcp-gateway/browser — browser-safe entry
 *
 * Everything a browser consumer needs from the gateway, with no
 * node: builtins anywhere in its (relative) import closure: the
 * JSON-RPC core, the tool registry contracts, the pure adapters
 * (meta-export, notes, files [in-memory part], github, notion,
 * stripe), the pure flow-control primitives, the adapter catalog,
 * and createDemoGateway.
 *
 * Deliberately NOT exported here (node-only, available from the
 * package root): runStdioGateway, createNodeFileProvider, TokenVault,
 * and the PKCE helpers (generateCodeVerifier /
 * generateCodeChallengeS256 / verifyCodeChallenge).
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";
import { generateSyntheticExport, parseFacebookExport } from "@omega/meta-export";

import { createFilesTools, createMemoryFileProvider } from "./adapters/files.js";
import { createGithubTools } from "./adapters/github.js";
import { createMetaExportTools } from "./adapters/meta-export.js";
import { createNotesTools, DEMO_NOTES } from "./adapters/notes.js";
import { createNotionTools } from "./adapters/notion.js";
import { createStripeTools } from "./adapters/stripe.js";
import { createGateway, type Gateway } from "./jsonrpc.js";

export {
  JSON_RPC_ERROR_CODES,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  createGateway,
  fingerprint,
  type Gateway,
  type GatewayOptions,
  type JsonRpcError,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type OmegaReceiptMeta,
  type RateLimitCallContext,
  type ReceiptValidationInfo,
  type ToolReceipt,
} from "./jsonrpc.js";
export { ToolError, type ToolContext, type ToolDefinition, type ToolRiskLevel } from "./registry.js";
export { createMetaExportTools } from "./adapters/meta-export.js";
export { DEMO_NOTES, createNotesTools, type NoteInput } from "./adapters/notes.js";
export {
  createFilesTools,
  createMemoryFileProvider,
  type FileListEntry,
  type FileProvider,
} from "./adapters/files.js";
export {
  createGithubTools,
  GITHUB_FIXTURE_ISSUES,
  GITHUB_FIXTURE_OWNER,
  GITHUB_FIXTURE_RELEASES,
  GITHUB_FIXTURE_REPOS,
  type GithubIssueFixture,
  type GithubReleaseFixture,
  type GithubRepoFixture,
} from "./adapters/github.js";
export {
  createNotionTools,
  NOTION_FIXTURE_DATA_SOURCES,
  NOTION_FIXTURE_PAGES,
  NOTION_PROJECT_TRACKER_ID,
  NOTION_PROJECT_TRACKER_ROWS,
  type NotionDataSourceFixture,
  type NotionPageFixture,
} from "./adapters/notion.js";
export {
  createStripeTools,
  STRIPE_FIXTURE_BALANCE,
  STRIPE_FIXTURE_DISPERSION_EVENTS,
  type StripeBalanceSummaryFixture,
  type StripeDispersionEventFixture,
} from "./adapters/stripe.js";
export {
  CircuitBreaker,
  CircuitOpenError,
  RateLimiter,
  type CircuitBreakerOptions,
  type CircuitBreakerState,
  type RateLimiterOptions,
} from "./flow-control.js";
export { ADAPTER_CATALOG, type CatalogAdapter, type CatalogAdapterStatus, type CatalogRiskLevel, type CatalogTool } from "./catalog.js";

/**
 * Receipt-carrying tool call model from the original scaffold.
 * Enforcement now exists for gated tools: any ToolDefinition with
 * `requiresReceipt: true` requires `params._meta.omegaReceipt` on
 * tools/call (see createGateway / GatewayOptions.receiptValidator),
 * and each gated call appends a ToolReceipt via gateway.listReceipts().
 * Ungated tools keep the scaffold behaviour (no receipt required).
 */
export interface OmegaToolCall {
  tool: string;
  ring: RingType;
  purpose: string;
  subjectNodeId: string;
  payload: unknown;
  receiptRequired: true;
}

export interface OmegaToolResult {
  tool: string;
  dataHash: string;
  timestamp: number;
  receiptId: string;
}

/**
 * Adapter ids known to the gateway. Working: meta-export, notes,
 * files, github (fixtures), notion (fixtures), stripe (sandbox
 * fixtures — registered as "working" over its sandbox fixtures).
 * Remaining stubs: aws, cloudflare, huggingface, homeassistant.
 */
export type AdapterId =
  | "meta-export"
  | "notes"
  | "files"
  | "github"
  | "notion"
  | "stripe"
  | "aws"
  | "cloudflare"
  | "huggingface"
  | "homeassistant";

export interface AdapterDefinition {
  id: AdapterId;
  displayName: string;
  status: "working" | "stub";
}

export const ADAPTER_REGISTRY: readonly AdapterDefinition[] = [
  { id: "meta-export", displayName: "Meta/Facebook Export", status: "working" },
  { id: "notes", displayName: "Notes", status: "working" },
  { id: "files", displayName: "Files", status: "working" },
  { id: "github", displayName: "GitHub", status: "working" },
  { id: "notion", displayName: "Notion", status: "working" },
  { id: "stripe", displayName: "Stripe", status: "working" },
  { id: "aws", displayName: "AWS", status: "stub" },
  { id: "cloudflare", displayName: "Cloudflare", status: "stub" },
  { id: "huggingface", displayName: "Hugging Face", status: "stub" },
  { id: "homeassistant", displayName: "Home Assistant", status: "stub" },
] as const;

/**
 * WORKING — scope: gateway core (registry + JSON-RPC 2.0 handling,
 * receipt gating, ToolReceipts, MCP 2026-07-28 discover) plus the
 * meta-export, notes, files, github, notion, and stripe adapters over
 * local/fixture/sandbox data. Transports: stdio included; no HTTP
 * server yet. No live network calls anywhere.
 */
export const MCP_GATEWAY_STATUS = "WORKING" as const;

/** Inline fixture documents backing the demo gateway's files adapter. */
const DEMO_FILES: Record<string, string> = {
  "hello-omega.md": [
    "# Hello Omega",
    "",
    "A fictional welcome note for the Omega demo world.",
    "Ada Whitfield keeps this file beside the garden log.",
  ].join("\n"),
  "ada-garden-notes.txt": [
    "Ada's garden notes (fictional fixture)",
    "",
    "The garden tomatoes are finally coming in.",
    "Three ripe ones today, and the lemon balm is spreading again.",
  ].join("\n"),
};

/**
 * Build a gateway with all working adapters wired to demo data:
 * the synthetic Ada Whitfield export (seed 42), DEMO_NOTES, an
 * in-memory file provider with two inline fixture documents, and the
 * github / notion / stripe fixture adapters. The github, notion, and
 * stripe tools are receipt-gated (see jsonrpc.ts).
 */
export function createDemoGateway(options?: Parameters<typeof createGateway>[0]): Gateway {
  const gateway = createGateway(options);
  const graph = parseFacebookExport(generateSyntheticExport(42));
  for (const tool of createMetaExportTools(graph)) gateway.registerTool(tool);
  for (const tool of createNotesTools(DEMO_NOTES)) gateway.registerTool(tool);
  for (const tool of createFilesTools(createMemoryFileProvider(DEMO_FILES))) gateway.registerTool(tool);
  for (const tool of createGithubTools()) gateway.registerTool(tool);
  for (const tool of createNotionTools()) gateway.registerTool(tool);
  for (const tool of createStripeTools()) gateway.registerTool(tool);
  return gateway;
}
