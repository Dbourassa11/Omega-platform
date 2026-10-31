// SCAFFOLD — minimal Next.js 15 configuration for the Omega Platform web shell.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import type { NextConfig } from "next";

// No webpack node: shim is needed any more: browser consumers import
// @omega/mcp-gateway/browser, the gateway's browser-safe subpath whose
// import closure contains no node: builtins. The gateway package root
// still carries the node-only transports (stdio, node file provider,
// TokenVault/PKCE), but it no longer surfaces them to browser
// consumers — they only reach them by importing the root explicitly.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
