/**
 * @omega/mcp-gateway — pure catalog tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { ADAPTER_CATALOG } from "./catalog.js";
import { ADAPTER_REGISTRY } from "./index.js";

describe("ADAPTER_CATALOG", () => {
  it("covers all 10 adapters matching the registry ids", () => {
    expect(ADAPTER_CATALOG).toHaveLength(10);
    expect(ADAPTER_CATALOG.map((a) => a.id).sort()).toEqual(ADAPTER_REGISTRY.map((a) => a.id).sort());
  });

  it("stub adapters have empty tools; stripe is sandbox; others working/sandbox only", () => {
    for (const adapter of ADAPTER_CATALOG) {
      if (adapter.status === "stub") expect(adapter.tools).toEqual([]);
    }
    expect(ADAPTER_CATALOG.find((a) => a.id === "stripe")?.status).toBe("sandbox");
    expect(ADAPTER_CATALOG.find((a) => a.id === "github")?.status).toBe("working");
    expect(ADAPTER_CATALOG.find((a) => a.id === "notion")?.status).toBe("working");
  });

  it("gated adapters mark requiresReceipt; local adapters do not", () => {
    const byId = new Map(ADAPTER_CATALOG.map((a) => [a.id, a]));
    for (const id of ["github", "notion", "stripe"]) {
      for (const tool of byId.get(id)?.tools ?? []) expect(tool.requiresReceipt).toBe(true);
    }
    for (const id of ["meta-export", "notes", "files"]) {
      for (const tool of byId.get(id)?.tools ?? []) expect(tool.requiresReceipt).toBe(false);
    }
    const totalTools = ADAPTER_CATALOG.reduce((sum, a) => sum + a.tools.length, 0);
    expect(totalTools).toBe(18);
  });
});
