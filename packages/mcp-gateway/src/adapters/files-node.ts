/**
 * @omega/mcp-gateway — files adapter, node provider
 *
 * Node-only FileProvider over a node:fs directory tree. The provider
 * rejects any path that resolves outside its root directory. Kept
 * separate from files.ts so the pure adapter stays browser-safe.
 *
 * Creator: David Charles Bourassa
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import { ToolError } from "../registry.js";
import type { FileListEntry, FileProvider } from "./files.js";

export function createNodeFileProvider(rootDir: string): FileProvider {
  const root = resolve(rootDir);

  function resolveInside(path: string): string {
    const resolved = resolve(root, path);
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      throw new ToolError(`path escapes root: ${path}`);
    }
    return resolved;
  }

  async function walk(dir: string, out: FileListEntry[]): Promise<void> {
    const names = await readdir(dir);
    names.sort();
    for (const name of names) {
      const full = join(dir, name);
      const info = await stat(full);
      if (info.isDirectory()) {
        await walk(full, out);
      } else if (info.isFile()) {
        out.push({ path: relative(root, full).split(sep).join("/"), size: info.size });
      }
    }
  }

  return {
    async list(): Promise<FileListEntry[]> {
      const out: FileListEntry[] = [];
      await walk(root, out);
      return out.sort((a, b) => a.path.localeCompare(b.path));
    },
    async read(path: string): Promise<string> {
      const resolved = resolveInside(path);
      try {
        return await readFile(resolved, "utf8");
      } catch (err) {
        if (err instanceof Error && "code" in err && (err as { code?: unknown }).code === "ENOENT") {
          throw new ToolError(`File not found: ${path}`);
        }
        throw err;
      }
    },
  };
}
