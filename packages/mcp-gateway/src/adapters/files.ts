/**
 * @omega/mcp-gateway — files adapter (pure, browser-safe)
 *
 * Exposes a FileProvider as gateway tools. This module holds the pure
 * part of the adapter: the FileProvider / FileListEntry types, the
 * in-memory provider, and the tool factory. The node:fs directory
 * provider lives in files-node.ts so browser consumers importing this
 * module pull in no node: builtins.
 *
 * Creator: David Charles Bourassa
 */

import { ToolError, type ToolDefinition } from "../registry.js";

export interface FileListEntry {
  path: string;
  size: number;
}

export interface FileProvider {
  list(): Promise<FileListEntry[]>;
  read(path: string): Promise<string>;
}

const textEncoder = new TextEncoder();

function byteLength(text: string): number {
  return textEncoder.encode(text).length;
}

export function createMemoryFileProvider(files: Record<string, string>): FileProvider {
  const entries = new Map(Object.entries(files));
  return {
    async list(): Promise<FileListEntry[]> {
      return [...entries.entries()]
        .map(([path, content]) => ({ path, size: byteLength(content) }))
        .sort((a, b) => a.path.localeCompare(b.path));
    },
    async read(path: string): Promise<string> {
      const content = entries.get(path);
      if (content === undefined) {
        throw new ToolError(`File not found: ${path}`);
      }
      return content;
    },
  };
}

function requireNonEmptyString(value: unknown, tool: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${tool} requires a non-empty string ${field}`);
  }
  return value;
}

export function createFilesTools(provider: FileProvider): ToolDefinition[] {
  return [
    {
      name: "files.list",
      description: "List files exposed by the provider, with sizes in bytes.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => provider.list(),
    },
    {
      name: "files.read",
      description: "Read one text file by provider-relative path.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", minLength: 1 } },
        required: ["path"],
        additionalProperties: false,
      },
      handler: async (args: { path?: unknown }) => {
        const path = requireNonEmptyString(args?.path, "files.read", "path");
        const content = await provider.read(path);
        return { path, content };
      },
    },
    {
      name: "files.search",
      description: "Case-insensitive line search across the provider's text files; returns the first matching line per file as an excerpt.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false,
      },
      handler: async (args: { query?: unknown }) => {
        const query = requireNonEmptyString(args?.query, "files.search", "query");
        const needle = query.toLowerCase();
        const entries = await provider.list();
        const results: { path: string; excerpt: string }[] = [];
        for (const entry of entries) {
          let content: string;
          try {
            content = await provider.read(entry.path);
          } catch {
            continue; // Unreadable entries are skipped, not fatal.
          }
          const line = content.split(/\r?\n/).find((candidate) => candidate.toLowerCase().includes(needle));
          if (line !== undefined) {
            results.push({ path: entry.path, excerpt: line.trim().slice(0, 160) });
          }
        }
        return results;
      },
    },
  ];
}
