/**
 * @omega/mcp-gateway
 *
 * Transport-agnostic JSON-RPC 2.0 tool gateway (MCP-style tools/list +
 * tools/call) for the Omega Platform, with a tool registry and working
 * adapters: meta-export (member graph), notes, files, github (fixtures),
 * notion (fixtures), and stripe (sandbox fixtures). Receipt-gated tools
 * enforce consent receipts; see src/jsonrpc.ts.
 *
 * The browser-safe surface lives in src/browser.ts and is re-exported
 * here in full, so every export of this root also works from
 * "@omega/mcp-gateway/browser" — except the node-only extras added
 * below: the stdio transport, the node:fs file provider, TokenVault,
 * and the PKCE helpers. Browser consumers should import the
 * "./browser" subpath so no node: builtins enter their bundle.
 *
 * Creator: David Charles Bourassa
 */

export * from "./browser.js";
export { createNodeFileProvider } from "./adapters/files-node.js";
export {
  TokenVault,
  generateCodeChallengeS256,
  generateCodeVerifier,
  verifyCodeChallenge,
  type ContextPurgeDescriptor,
  type TokenVaultOptions,
  type WrappedToken,
} from "./infra.js";
export { runStdioGateway } from "./stdio.js";
