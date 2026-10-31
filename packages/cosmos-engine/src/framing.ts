/**
 * @omega/cosmos-engine — camera auto-framing (pure logic, no WebGL)
 *
 * Computes a bounding sphere for a set of world points and the camera
 * distance at which that sphere fits the viewport, so a dataset of any
 * size can be framed on load instead of inheriting a frame tuned for
 * some other dataset. No three.js imports: this module is pure data.
 *
 * Creator: David Charles Bourassa
 */

import type { Vec3 } from "./types.js";

/** A sphere enclosing a point set: centroid centre + enclosing radius. */
export interface BoundingSphere {
  center: Vec3;
  radius: number;
}

/**
 * Distance of the classic default camera position (0, 60, 150) from
 * the origin: sqrt(60^2 + 150^2) ≈ 161.55. Datasets framed before
 * auto-framing existed were composed for this distance.
 */
export const DEFAULT_FRAME_DISTANCE = Math.hypot(0, 60, 150);

/**
 * Bounding sphere of a point set: the centre is the centroid (mean of
 * all points) and the radius is the largest distance from that centre
 * to any point, so every input point lies inside the sphere. Returns
 * null for an empty input — there is nothing to frame.
 */
export function boundingSphereOfPoints(
  points: readonly Vec3[],
): BoundingSphere | null {
  if (points.length === 0) {
    return null;
  }
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
    cz += point.z;
  }
  cx /= points.length;
  cy /= points.length;
  cz /= points.length;
  let radius = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dz = point.z - cz;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > radius) {
      radius = distance;
    }
  }
  return { center: { x: cx, y: cy, z: cz }, radius };
}

/**
 * Camera distance at which a sphere of `radius` fits BOTH the vertical
 * and the horizontal field of view. The horizontal fov is derived from
 * the vertical `fovDeg` and the viewport `aspect` (width / height);
 * the tighter of the two governs. A sphere fits when its angular
 * radius stays inside half the governing fov, i.e.
 * distance = radius / sin(halfFov), scaled by `margin` (default 1.12)
 * for breathing room. A degenerate radius (<= 0) needs no distance.
 */
export function fitDistanceForRadius(
  radius: number,
  fovDeg: number,
  aspect: number,
  margin = 1.12,
): number {
  if (radius <= 0) {
    return 0;
  }
  const safeAspect =
    Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const verticalHalf = ((fovDeg * Math.PI) / 180) / 2;
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * safeAspect);
  const halfFov = Math.min(verticalHalf, horizontalHalf);
  const sin = Math.sin(halfFov);
  if (sin <= 0) {
    return 0;
  }
  return (radius / sin) * margin;
}
