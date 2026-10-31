import { describe, expect, it } from "vitest";

import {
  RING_SHELL_RADIUS,
  layoutCosmos,
  positionAt,
} from "./layout.js";
import { mulberry32 } from "./prng.js";
import { orbitParamsFor } from "./layout.js";
import type { CosmosNode } from "./types.js";

function node(id: string, ring: CosmosNode["ring"], kind: CosmosNode["kind"] = "member"): CosmosNode {
  return { id, kind, ring, label: id };
}

describe("layoutCosmos determinism", () => {
  it("same seed produces a deep-equal layout twice", () => {
    const nodes: CosmosNode[] = [
      node("a", "family"),
      node("b", "friends"),
      node("c", "work"),
      node("d", "public"),
      node("e", "family", "memory"),
    ];
    const first = layoutCosmos(nodes, 1234);
    const second = layoutCosmos(nodes, 1234);
    expect([...first.entries()]).toEqual([...second.entries()]);
    expect(first).toEqual(second);
  });

  it("different seeds produce different layouts", () => {
    const nodes: CosmosNode[] = [node("a", "family"), node("b", "public")];
    const first = layoutCosmos(nodes, 1);
    const second = layoutCosmos(nodes, 2);
    expect([...first.entries()]).not.toEqual([...second.entries()]);
  });
});

describe("positionAt purity", () => {
  it("same inputs produce identical output values", () => {
    const params = orbitParamsFor(node("a", "family"), mulberry32(7));
    const p1 = positionAt(params, 3.25);
    const p2 = positionAt(params, 3.25);
    expect(p1).toEqual(p2);
    expect(p1.x).toBe(p2.x);
    expect(p1.y).toBe(p2.y);
    expect(p1.z).toBe(p2.z);
  });
});

describe("ring shells", () => {
  it("RING_SHELL_RADIUS is ordered family < friends < work < public", () => {
    expect(RING_SHELL_RADIUS.family).toBeLessThan(RING_SHELL_RADIUS.friends);
    expect(RING_SHELL_RADIUS.friends).toBeLessThan(RING_SHELL_RADIUS.work);
    expect(RING_SHELL_RADIUS.work).toBeLessThan(RING_SHELL_RADIUS.public);
  });

  it("a family node's shellRadius is smaller than a public node's (fixed seed)", () => {
    const layout = layoutCosmos(
      [node("fam", "family"), node("pub", "public")],
      42,
    );
    const fam = layout.get("fam");
    const pub = layout.get("pub");
    expect(fam).toBeDefined();
    expect(pub).toBeDefined();
    if (fam === undefined || pub === undefined) return;
    expect(fam.shellRadius).toBeLessThan(pub.shellRadius);
    // Jitter is bounded by 6 around each ring base.
    expect(Math.abs(fam.shellRadius - RING_SHELL_RADIUS.family)).toBeLessThanOrEqual(6);
    expect(Math.abs(pub.shellRadius - RING_SHELL_RADIUS.public)).toBeLessThanOrEqual(6);
  });

  it("inner shells orbit faster than outer shells on average (Keplerian)", () => {
    const fam = orbitParamsFor(node("f", "family"), mulberry32(99));
    const pub = orbitParamsFor(node("p", "public"), mulberry32(99));
    // Even with the 0.7-1.3 factor, the r^-1.5 gap between 26 and 82 dominates.
    expect(fam.speed).toBeGreaterThan(pub.speed);
  });
});

describe("positionAt bounds", () => {
  it("|pos| stays within shellRadius + yAmp + epsilon over time", () => {
    const params = orbitParamsFor(node("a", "work", "creation"), mulberry32(5));
    const bound = params.shellRadius + params.yAmp + 1e-9;
    for (const t of [0, 0.5, 1, 3.7, 10, 42.5, 100, 1000]) {
      const pos = positionAt(params, t);
      const mag = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      expect(mag).toBeLessThanOrEqual(bound);
    }
  });
});

describe("mulberry32 via layout seed stream", () => {
  it("orbit params fall in their specified ranges", () => {
    const rng = mulberry32(2024);
    const params = orbitParamsFor(node("x", "friends", "company"), rng);
    expect(params.inclination).toBeGreaterThanOrEqual(0);
    expect(params.inclination).toBeLessThanOrEqual(0.45);
    expect(params.phase).toBeGreaterThanOrEqual(0);
    expect(params.phase).toBeLessThan(Math.PI * 2);
    expect(params.yAmp).toBeGreaterThanOrEqual(1.5);
    expect(params.yAmp).toBeLessThanOrEqual(5);
    expect(params.ySpeed).toBeGreaterThanOrEqual(0.1);
    expect(params.ySpeed).toBeLessThanOrEqual(0.35);
    expect(params.pulseSpeed).toBeGreaterThanOrEqual(0.6);
    expect(params.pulseSpeed).toBeLessThanOrEqual(1.6);
    // company base size 2.0 x factor 0.8-1.25
    expect(params.size).toBeGreaterThanOrEqual(1.6);
    expect(params.size).toBeLessThanOrEqual(2.5);
  });
});
