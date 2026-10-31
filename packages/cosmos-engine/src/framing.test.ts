/**
 * @omega/cosmos-engine — framing tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { createDemoCosmos } from "./data.js";
import {
  DEFAULT_FRAME_DISTANCE,
  boundingSphereOfPoints,
  fitDistanceForRadius,
} from "./framing.js";
import { layoutCosmos, positionAt, RING_SHELL_RADIUS } from "./layout.js";
import type { CosmosData, CosmosNode, Vec3 } from "./types.js";

const FOV = 55;
const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;

/** Bounds the renderer computes: node positions at t, radius inflated by max node size. */
function datasetBounds(data: CosmosData): { radius: number; inflated: number } {
  const layout = layoutCosmos(data.nodes, 1337);
  const points: Vec3[] = [];
  let maxSize = 0;
  for (const node of data.nodes) {
    const params = layout.get(node.id);
    if (params === undefined) continue;
    points.push(positionAt(params, 12));
    maxSize = Math.max(maxSize, params.size);
  }
  const sphere = boundingSphereOfPoints(points);
  const radius = sphere?.radius ?? 0;
  return { radius, inflated: radius + maxSize };
}

describe("boundingSphereOfPoints", () => {
  it("returns null for an empty input", () => {
    expect(boundingSphereOfPoints([])).toBeNull();
  });

  it("a single point is its own centre with radius 0", () => {
    const sphere = boundingSphereOfPoints([{ x: 3, y: -2, z: 7 }]);
    expect(sphere).not.toBeNull();
    expect(sphere?.center).toEqual({ x: 3, y: -2, z: 7 });
    expect(sphere?.radius).toBe(0);
  });

  it("centres on the centroid and encloses every point", () => {
    const points: Vec3[] = [
      { x: 10, y: 0, z: 0 },
      { x: -10, y: 0, z: 0 },
      { x: 0, y: 10, z: 0 },
      { x: 0, y: -10, z: 0 },
    ];
    const sphere = boundingSphereOfPoints(points);
    expect(sphere?.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(sphere?.radius).toBeCloseTo(10, 9);
    for (const point of points) {
      const d = Math.hypot(
        point.x - (sphere?.center.x ?? 0),
        point.y - (sphere?.center.y ?? 0),
        point.z - (sphere?.center.z ?? 0),
      );
      expect(d).toBeLessThanOrEqual((sphere?.radius ?? 0) + 1e-9);
    }
  });

  it("a wide spread has a larger radius than a tight cluster", () => {
    const cluster = boundingSphereOfPoints([
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]);
    const spread = boundingSphereOfPoints([
      { x: 100, y: 0, z: 0 },
      { x: -100, y: 0, z: 0 },
      { x: 0, y: 100, z: 0 },
    ]);
    expect(cluster?.radius).toBeLessThan(spread?.radius ?? 0);
  });
});

describe("fitDistanceForRadius", () => {
  it("returns 0 for a degenerate radius", () => {
    expect(fitDistanceForRadius(0, FOV, LANDSCAPE)).toBe(0);
    expect(fitDistanceForRadius(-5, FOV, LANDSCAPE)).toBe(0);
  });

  it("a tight cluster fits closer than a wide spread", () => {
    const near = fitDistanceForRadius(10, FOV, LANDSCAPE);
    const far = fitDistanceForRadius(90, FOV, LANDSCAPE);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near * 5);
  });

  it("portrait aspect needs more distance than landscape for the same radius", () => {
    const landscape = fitDistanceForRadius(50, FOV, LANDSCAPE);
    const portrait = fitDistanceForRadius(50, FOV, PORTRAIT);
    expect(portrait).toBeGreaterThan(landscape);
    // Square sits between the two.
    const square = fitDistanceForRadius(50, FOV, 1);
    expect(square).toBeGreaterThanOrEqual(landscape);
    expect(portrait).toBeGreaterThan(square);
  });

  it("grows monotonically with margin", () => {
    const tight = fitDistanceForRadius(50, FOV, LANDSCAPE, 1);
    const defaultMargin = fitDistanceForRadius(50, FOV, LANDSCAPE);
    const loose = fitDistanceForRadius(50, FOV, LANDSCAPE, 1.5);
    expect(defaultMargin).toBeGreaterThan(tight);
    expect(loose).toBeGreaterThan(defaultMargin);
    expect(defaultMargin / tight).toBeCloseTo(1.12, 9);
  });

  it("grows monotonically with radius and shrinks with a wider fov", () => {
    expect(fitDistanceForRadius(60, FOV, LANDSCAPE)).toBeGreaterThan(
      fitDistanceForRadius(30, FOV, LANDSCAPE),
    );
    expect(fitDistanceForRadius(50, 70, LANDSCAPE)).toBeLessThan(
      fitDistanceForRadius(50, FOV, LANDSCAPE),
    );
  });

  it("the fitted distance puts the sphere inside the fov cone", () => {
    const radius = 40;
    const distance = fitDistanceForRadius(radius, FOV, LANDSCAPE, 1);
    // Angular radius of the sphere from the fitted distance.
    const angular = Math.asin(radius / distance);
    expect(angular).toBeLessThanOrEqual((FOV * Math.PI) / 180 / 2 + 1e-9);
  });
});

describe("DEFAULT_FRAME_DISTANCE", () => {
  it("matches the classic (0, 60, 150) camera distance", () => {
    expect(DEFAULT_FRAME_DISTANCE).toBeCloseTo(Math.hypot(0, 60, 150), 9);
    expect(DEFAULT_FRAME_DISTANCE).toBeGreaterThan(161);
    expect(DEFAULT_FRAME_DISTANCE).toBeLessThan(162);
  });
});

describe("dataset-level framing", () => {
  it("demo 600 bounds sit at approximately the public shell", () => {
    const { radius, inflated } = datasetBounds(createDemoCosmos(42, 600));
    // Outermost orbiters live on the public shell (82) plus jitter (6)
    // plus their vertical bob, measured from a near-origin centroid.
    expect(radius).toBeGreaterThan(RING_SHELL_RADIUS.public - 14);
    expect(radius).toBeLessThan(RING_SHELL_RADIUS.public + 14);
    expect(inflated).toBeGreaterThan(radius);
    const distance = fitDistanceForRadius(inflated, FOV, LANDSCAPE);
    expect(distance).toBeGreaterThan(DEFAULT_FRAME_DISTANCE);
  });

  it("a 29-node inner-ring dataset fits at a much shorter distance", () => {
    const nodes: CosmosNode[] = [];
    for (let i = 0; i < 29; i++) {
      nodes.push({
        id: `inner-${i}`,
        kind: i % 3 === 0 ? "member" : "memory",
        ring: i % 2 === 0 ? "family" : "friends",
        label: `Inner ${i}`,
      });
    }
    const small = datasetBounds({ nodes, edges: [] });
    // Nothing lives beyond the friends shell (44) plus jitter and bob.
    expect(small.inflated).toBeLessThan(RING_SHELL_RADIUS.work);
    const smallDistance = fitDistanceForRadius(small.inflated, FOV, LANDSCAPE);
    const demoDistance = fitDistanceForRadius(
      datasetBounds(createDemoCosmos(42, 600)).inflated,
      FOV,
      LANDSCAPE,
    );
    expect(smallDistance).toBeLessThan(demoDistance * 0.75);
    expect(smallDistance).toBeLessThan(DEFAULT_FRAME_DISTANCE);
  });
});
