import { describe, expect, it } from "vitest";

import { graphToCosmosData } from "./cosmos.js";
import { generateSyntheticExport } from "./generator.js";
import { parseFacebookExport } from "./parser.js";

const graph = parseFacebookExport(generateSyntheticExport());
const cosmos = graphToCosmosData(graph);

describe("graphToCosmosData", () => {
  it("emits the owner node plus one member node per person", () => {
    expect(cosmos.nodes).toHaveLength(29);
    const owner = cosmos.nodes.find((n) => n.id === "owner");
    expect(owner).toEqual({
      id: "owner",
      kind: "member",
      ring: "family",
      label: "Ada Whitfield",
    });
  });

  it("person nodes carry ring, label, and ringSource as branch", () => {
    for (const person of graph.people) {
      const node = cosmos.nodes.find((n) => n.id === person.id);
      expect(node?.kind).toBe("member");
      expect(node?.ring).toBe(person.ring);
      expect(node?.label).toBe(person.name);
      expect(node?.branch).toBe(person.ringSource);
    }
  });

  it("emits no positions (the engine shell layout applies)", () => {
    for (const node of cosmos.nodes) {
      expect(node.position).toBeUndefined();
    }
  });

  it("orders nodes deterministically by id", () => {
    const ids = cosmos.nodes.map((n) => n.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("emits the expected relationship edge count", () => {
    // 15 distinct owner<->thread-participant edges (8 one-to-one
    // partners + 3 hiking-plan members + 4 book-club members) plus
    // group pairwise edges: C(3,2)=3 hiking + C(4,2)=6 book club = 9.
    expect(cosmos.edges).toHaveLength(24);
    for (const edge of cosmos.edges) {
      expect(edge.kind).toBe("relationship");
    }
  });

  it("every edge endpoint exists as a node, with no self-edges or duplicates", () => {
    const nodeIds = new Set(cosmos.nodes.map((n) => n.id));
    const keys = new Set<string>();
    for (const edge of cosmos.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
      expect(edge.source).not.toBe(edge.target);
      const key = `${edge.source}|${edge.target}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  it("connects the owner to every thread co-participant", () => {
    const ownerTargets = new Set(
      cosmos.edges.filter((e) => e.source === "owner").map((e) => e.target),
    );
    expect(ownerTargets.size).toBe(15);
    expect(ownerTargets.has("person:ruby-thompson")).toBe(true);
    expect(ownerTargets.has("person:sam-delgado")).toBe(true);
    // A person in no thread gets no owner edge.
    expect(ownerTargets.has("person:june-whitfield")).toBe(false);
  });

  it("creates pairwise edges inside group threads only", () => {
    const has = (a: string, b: string): boolean =>
      cosmos.edges.some(
        (e) =>
          (e.source === a && e.target === b) || (e.source === b && e.target === a),
      );
    expect(has("person:adam-kowalski", "person:maya-patel")).toBe(true);
    expect(has("person:ana-silva", "person:sam-delgado")).toBe(true);
    // Ruby is only in a 1:1 thread: no person<->person edge.
    expect(has("person:ruby-thompson", "person:eli-morgan")).toBe(false);
  });

  it("is deterministic: same graph in, identical data out", () => {
    expect(graphToCosmosData(graph)).toEqual(cosmos);
  });
});
