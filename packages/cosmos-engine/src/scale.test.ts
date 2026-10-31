import { describe, expect, it } from "vitest";

import { UNIVERSE_SCALES, scaleLevelFor } from "./scale.js";
import type { ScaleLevelId } from "./scale.js";
import { layoutCosmos, orbitParamsFor, positionAt } from "./layout.js";
import { mulberry32 } from "./prng.js";
import type { CosmosNode } from "./types.js";

describe("UNIVERSE_SCALES", () => {
  it("has the five hierarchy levels in order", () => {
    expect(UNIVERSE_SCALES.map((s) => s.id)).toEqual([
      "system",
      "galaxy",
      "cluster",
      "filament",
      "web",
    ]);
  });

  it("distances are strictly increasing", () => {
    for (let i = 1; i < UNIVERSE_SCALES.length; i++) {
      const prev = UNIVERSE_SCALES[i - 1];
      const curr = UNIVERSE_SCALES[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (prev === undefined || curr === undefined) return;
      expect(curr.distance).toBeGreaterThan(prev.distance);
    }
  });

  it("distances match the specified ladder", () => {
    expect(UNIVERSE_SCALES.map((s) => s.distance)).toEqual([
      26, 78, 190, 420, 820,
    ]);
  });

  it("every level has a label and a non-empty blurb", () => {
    for (const level of UNIVERSE_SCALES) {
      expect(level.label.length).toBeGreaterThan(0);
      expect(level.blurb.length).toBeGreaterThan(0);
    }
  });

  it("scaleLevelFor resolves every id", () => {
    const ids: ScaleLevelId[] = [
      "system",
      "galaxy",
      "cluster",
      "filament",
      "web",
    ];
    for (const id of ids) {
      expect(scaleLevelFor(id).id).toBe(id);
    }
  });
});

describe("layout static positions (positioned nodes)", () => {
  const positioned: CosmosNode = {
    id: "galaxy-0",
    kind: "galaxy",
    ring: "public",
    label: "Spiral Galaxy Ω-0000",
    position: { x: 120, y: -45, z: 200 },
  };

  it("orbitParamsFor anchors a positioned node (speed 0 + staticPosition)", () => {
    const params = orbitParamsFor(positioned, mulberry32(11));
    expect(params.staticPosition).toEqual({ x: 120, y: -45, z: 200 });
    expect(params.speed).toBe(0);
  });

  it("positionAt stays within 1.0 of node.position at several t values", () => {
    const params = orbitParamsFor(positioned, mulberry32(11));
    const target = positioned.position;
    expect(target).toBeDefined();
    if (target === undefined) return;
    for (const t of [0, 0.5, 1, 3.7, 10, 42.5, 100, 1000]) {
      const pos = positionAt(params, t);
      const d = Math.sqrt(
        (pos.x - target.x) ** 2 +
          (pos.y - target.y) ** 2 +
          (pos.z - target.z) ** 2,
      );
      expect(d).toBeLessThanOrEqual(1.0);
      expect(d).toBeLessThanOrEqual(0.8);
    }
  });

  it("honours node.size when present", () => {
    const sized: CosmosNode = { ...positioned, size: 3.4 };
    const params = orbitParamsFor(sized, mulberry32(3));
    // size = 3.4 * (0.8 + rng * 0.45) ∈ [2.72, 4.25]
    expect(params.size).toBeGreaterThanOrEqual(3.4 * 0.8);
    expect(params.size).toBeLessThanOrEqual(3.4 * 1.25);
  });

  it("non-positioned nodes have no staticPosition (legacy behaviour)", () => {
    const legacy: CosmosNode = {
      id: "member-1",
      kind: "member",
      ring: "family",
      label: "Demo Member 001",
    };
    const params = orbitParamsFor(legacy, mulberry32(11));
    expect(params.staticPosition).toBeUndefined();
    expect(params.speed).toBeGreaterThan(0);
  });

  it("layoutCosmos keeps positioned galaxies anchored", () => {
    const layout = layoutCosmos([positioned], 99);
    const params = layout.get("galaxy-0");
    expect(params?.staticPosition).toEqual(positioned.position);
  });
});
