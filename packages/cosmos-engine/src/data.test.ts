import { describe, expect, it } from "vitest";

import { createDemoCosmos } from "./data.js";
import type { RingType } from "./types.js";

const CASES: { seed: number; count: number }[] = [
  { seed: 7, count: 50 },
  { seed: 42, count: 600 },
  { seed: 99, count: 2000 },
];

const ALL_RINGS: RingType[] = ["family", "friends", "work", "public"];

describe("createDemoCosmos", () => {
  for (const { seed, count } of CASES) {
    describe(`seed=${seed} count=${count}`, () => {
      const data = createDemoCosmos(seed, count);

      it("produces exactly nodeCount nodes", () => {
        expect(data.nodes.length).toBe(count);
      });

      it("has unique ids", () => {
        const ids = new Set(data.nodes.map((n) => n.id));
        expect(ids.size).toBe(data.nodes.length);
      });

      it("every edge endpoint exists in the node id set", () => {
        const ids = new Set(data.nodes.map((n) => n.id));
        for (const edge of data.edges) {
          expect(ids.has(edge.source)).toBe(true);
          expect(ids.has(edge.target)).toBe(true);
          expect(edge.source).not.toBe(edge.target);
        }
      });

      it("has no duplicate edges", () => {
        const keys = data.edges.map(
          (e) => `${e.source}|${e.target}|${e.kind}`,
        );
        expect(new Set(keys).size).toBe(keys.length);
      });

      it("represents every ring among nodes", () => {
        const rings = new Set(data.nodes.map((n) => n.ring));
        for (const ring of ALL_RINGS) {
          expect(rings.has(ring)).toBe(true);
        }
      });

      it("all labels are non-empty", () => {
        for (const n of data.nodes) {
          expect(n.label.length).toBeGreaterThan(0);
        }
      });

      it("branch nodes have `branch` set and an owner edge", () => {
        const branchNodes = data.nodes.filter(
          (n) => n.kind === "memory" || n.kind === "creation",
        );
        expect(branchNodes.length).toBeGreaterThan(0);
        for (const branchNode of branchNodes) {
          expect(branchNode.branch).toBeDefined();
          expect((branchNode.branch ?? "").length).toBeGreaterThan(0);
          const ownerEdge = data.edges.find(
            (e) => e.target === branchNode.id && e.kind === "branch",
          );
          expect(ownerEdge).toBeDefined();
          // The owner is a member node.
          const owner = data.nodes.find((n) => n.id === ownerEdge?.source);
          expect(owner?.kind).toBe("member");
          // Branch node shares its owner's ring.
          expect(branchNode.ring).toBe(owner?.ring);
        }
      });

      it("includes exactly 6 connector nodes for count >= 30", () => {
        const connectors = data.nodes.filter((n) => n.kind === "connector");
        expect(connectors.length).toBe(6);
      });
    });

    it(`same seed produces identical JSON (seed=${seed})`, () => {
      const a = createDemoCosmos(seed, count);
      const b = createDemoCosmos(seed, count);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  }

  it("different seeds produce different data", () => {
    const a = createDemoCosmos(1, 200);
    const b = createDemoCosmos(2, 200);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("labels are clearly synthetic", () => {
    const data = createDemoCosmos(42, 600);
    const member = data.nodes.find((n) => n.kind === "member");
    expect(member?.label).toMatch(/^Demo Member \d+$/);
    const company = data.nodes.find((n) => n.kind === "company");
    expect(company?.label).toMatch(/^Demo Company /);
  });
});
