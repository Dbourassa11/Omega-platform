import { describe, expect, it } from "vitest";

import {
  GALAXY_CLASS_COLORS,
  createMultiverseData,
  createUniverseData,
} from "./universe.js";
import type { CosmosNode, Vec3 } from "./types.js";

const HEX_RE = /^#[0-9a-f]{6}$/;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function distToFilaments(node: CosmosNode, paths: Vec3[][]): number {
  const p = node.position;
  if (p === undefined) return Infinity;
  let best = Infinity;
  for (const path of paths) {
    for (const s of path) {
      const d = Math.sqrt((p.x - s.x) ** 2 + (p.y - s.y) ** 2 + (p.z - s.z) ** 2);
      if (d < best) best = d;
    }
  }
  return best;
}

function ellipticalShare(nodes: CosmosNode[]): number {
  if (nodes.length === 0) return 0;
  const e = nodes.filter((n) => n.galaxyClass === "elliptical").length;
  return e / nodes.length;
}

describe("createUniverseData", () => {
  const data = createUniverseData(42, 1200);

  it("is deterministic: same seed produces deep-equal data", () => {
    const again = createUniverseData(42, 1200);
    expect(again).toEqual(data);
    expect(JSON.stringify(again)).toBe(JSON.stringify(data));
  });

  it("different seeds produce different data", () => {
    const other = createUniverseData(43, 1200);
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(data));
  });

  it("produces exactly the requested galaxy count", () => {
    expect(data.nodes.length).toBe(1200);
    expect(createUniverseData(7, 300).nodes.length).toBe(300);
    expect(createUniverseData(7, 1).nodes.length).toBe(1);
  });

  it("every node is a galaxy with position, hex colour and class", () => {
    for (const node of data.nodes) {
      expect(node.kind).toBe("galaxy");
      expect(node.ring).toBe("public");
      expect(node.position).toBeDefined();
      expect(node.color).toMatch(HEX_RE);
      expect(node.galaxyClass).toBeDefined();
      expect(["spiral", "elliptical", "irregular"]).toContain(
        node.galaxyClass,
      );
      expect(node.size).toBeGreaterThan(0);
      expect(node.label).toMatch(
        /^(Spiral|Elliptical|Irregular) Galaxy Ω-\d{4}$/,
      );
      expect(["cluster", "filament", "void"]).toContain(node.branch);
    }
  });

  it("galaxy ids are unique and shaped galaxy-{i}", () => {
    const ids = new Set(data.nodes.map((n) => n.id));
    expect(ids.size).toBe(data.nodes.length);
    expect(data.nodes[0]?.id).toBe("galaxy-0");
  });

  it("every galaxy position lies within radius x 1.05 (radius = 300)", () => {
    for (const node of data.nodes) {
      const p = node.position;
      expect(p).toBeDefined();
      if (p === undefined) continue;
      const mag = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      expect(mag).toBeLessThanOrEqual(300 * 1.05);
    }
  });

  it("returns filament paths sampled at 24 points each", () => {
    expect(data.filamentPaths).toBeDefined();
    expect((data.filamentPaths ?? []).length).toBeGreaterThan(0);
    for (const path of data.filamentPaths ?? []) {
      expect(path.length).toBe(24);
    }
  });

  it("edge endpoints exist, no self-edges, edges capped at 2x galaxies", () => {
    const ids = new Set(data.nodes.map((n) => n.id));
    for (const edge of data.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
      expect(edge.source).not.toBe(edge.target);
    }
    expect(data.edges.length).toBeLessThanOrEqual(2 * data.nodes.length);
    expect(data.edges.length).toBeGreaterThan(0);
  });

  it("void galaxies sit far from filaments; filament galaxies hug them", () => {
    const paths = data.filamentPaths ?? [];
    const voidDistances = data.nodes
      .filter((n) => n.branch === "void")
      .map((n) => distToFilaments(n, paths));
    const filamentDistances = data.nodes
      .filter((n) => n.branch === "filament")
      .map((n) => distToFilaments(n, paths));
    expect(voidDistances.length).toBeGreaterThan(0);
    expect(filamentDistances.length).toBeGreaterThan(0);
    expect(median(voidDistances)).toBeGreaterThan(
      3 * median(filamentDistances),
    );
  });

  it("cluster galaxies have a higher elliptical share than void galaxies", () => {
    const cluster = data.nodes.filter((n) => n.branch === "cluster");
    const voids = data.nodes.filter((n) => n.branch === "void");
    expect(cluster.length).toBeGreaterThan(0);
    expect(voids.length).toBeGreaterThan(0);
    expect(ellipticalShare(cluster)).toBeGreaterThan(ellipticalShare(voids));
  });

  it("branch distribution roughly matches cluster/filament/void mix", () => {
    const total = data.nodes.length;
    const clusterShare =
      data.nodes.filter((n) => n.branch === "cluster").length / total;
    const filamentShare =
      data.nodes.filter((n) => n.branch === "filament").length / total;
    const voidShare =
      data.nodes.filter((n) => n.branch === "void").length / total;
    expect(clusterShare).toBeGreaterThan(0.25);
    expect(clusterShare).toBeLessThan(0.43);
    expect(filamentShare).toBeGreaterThan(0.43);
    expect(filamentShare).toBeLessThan(0.61);
    expect(voidShare).toBeGreaterThan(0.07);
    expect(voidShare).toBeLessThan(0.21);
  });

  it("GALAXY_CLASS_COLORS matches the specified palette", () => {
    expect(GALAXY_CLASS_COLORS).toEqual({
      spiral: "#bcd8ff",
      elliptical: "#ffd9a3",
      irregular: "#7fe9ff",
    });
  });
});

describe("createMultiverseData", () => {
  const data = createMultiverseData(7);
  const bubbles = data.bubbles ?? [];

  it("is deterministic: same seed produces deep-equal data", () => {
    expect(createMultiverseData(7)).toEqual(data);
  });

  it("produces the requested number of bubbles (default 5)", () => {
    expect(bubbles.length).toBe(5);
    expect((createMultiverseData(7, 3).bubbles ?? []).length).toBe(3);
  });

  it("bubble 0 is the home universe at the origin", () => {
    const home = bubbles[0];
    expect(home?.label).toBe("Member Cosmos — Home Universe");
    expect(home?.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(home?.radius).toBe(110);
  });

  it("all node ids are unique (bubble-prefixed)", () => {
    const ids = new Set(data.nodes.map((n) => n.id));
    expect(ids.size).toBe(data.nodes.length);
    const galaxy = data.nodes.find((n) => n.id.startsWith("b1-galaxy-"));
    expect(galaxy).toBeDefined();
  });

  it("each bubble has its core node at its centre", () => {
    bubbles.forEach((bubble, i) => {
      const core = data.nodes.find((n) => n.id === `core-b${i}`);
      expect(core).toBeDefined();
      expect(core?.position).toEqual(bubble.center);
      expect(core?.size).toBe(3.4);
      expect(core?.label).toBe(`${bubble.label} — Core`);
    });
  });

  it("bubbles have distinct colours", () => {
    const colors = bubbles.map((b) => b.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const color of colors) {
      expect(color).toMatch(HEX_RE);
    }
  });

  it("variant bubbles carry the variant labels", () => {
    const labels = bubbles.map((b) => b.label);
    expect(labels).toContain("Variant — High-Trust φ");
    expect(labels).toContain("Variant — Eternal Garden");
    expect(labels).toContain("Variant — Deep Void");
    expect(labels).toContain("Variant — Bright Core");
  });

  it("home bubble holds ~800 galaxies and variants ~350 each", () => {
    const countFor = (prefix: string): number =>
      data.nodes.filter(
        (n) => n.id.startsWith(prefix) && n.id.includes("galaxy-"),
      ).length;
    expect(countFor("b0-")).toBe(800);
    for (let bIdx = 1; bIdx < bubbles.length; bIdx++) {
      const c = countFor(`b${bIdx}-`);
      expect(c).toBeGreaterThanOrEqual(300);
      expect(c).toBeLessThanOrEqual(400);
    }
  });

  it("returns offset filament paths for the bubbles", () => {
    expect((data.filamentPaths ?? []).length).toBeGreaterThan(0);
  });

  it("every multiverse edge endpoint exists", () => {
    const ids = new Set(data.nodes.map((n) => n.id));
    for (const edge of data.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
  });
});
