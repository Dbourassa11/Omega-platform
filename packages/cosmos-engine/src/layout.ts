/**
 * @omega/cosmos-engine — orbital layout (pure logic, no WebGL)
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

import { mulberry32 } from "./prng.js";
import type { CosmosNode, CosmosNodeKind, Vec3 } from "./types.js";

export const RING_SHELL_RADIUS: Readonly<Record<RingType, number>> = {
  family: 26,
  friends: 44,
  work: 62,
  public: 82,
};

export interface OrbitParams {
  shellRadius: number;
  speed: number;
  inclination: number;
  phase: number;
  yAmp: number;
  ySpeed: number;
  yPhase: number;
  size: number;
  pulsePhase: number;
  pulseSpeed: number;
  /** When set, the node is anchored at this fixed position (universe mode)
   * and `positionAt` returns it plus a small sinusoidal bob. */
  staticPosition?: Vec3;
}

function baseSizeFor(kind: CosmosNodeKind): number {
  switch (kind) {
    case "member":
      return 1.6;
    case "company":
      return 2.0;
    case "legacy":
      return 1.4;
    case "connector":
      return 1.3;
    case "creation":
      return 1.1;
    case "memory":
      return 0.9;
    case "galaxy":
      return 1.8;
  }
}

function shellBaseFor(ring: RingType): number {
  switch (ring) {
    case "family":
      return RING_SHELL_RADIUS.family;
    case "friends":
      return RING_SHELL_RADIUS.friends;
    case "work":
      return RING_SHELL_RADIUS.work;
    case "public":
      return RING_SHELL_RADIUS.public;
  }
}

const KEPLER_K = 900;
const TWO_PI = Math.PI * 2;

export function orbitParamsFor(
  node: CosmosNode,
  rng: () => number,
): OrbitParams {
  const baseRadius = shellBaseFor(node.ring);
  // shellRadius = ring base ± jitter up to 6
  const shellRadius = baseRadius + (rng() * 2 - 1) * 6;
  // Keplerian-flavoured speed: K / r^1.5, inner shells orbit faster,
  // scaled by a per-node factor in [0.7, 1.3).
  const speedFactor = 0.7 + rng() * 0.6;
  const speed = (KEPLER_K / Math.pow(shellRadius, 1.5)) * speedFactor;
  const inclination = rng() * 0.45;
  const phase = rng() * TWO_PI;
  const yAmp = 1.5 + rng() * 3.5;
  const ySpeed = 0.1 + rng() * 0.25;
  const yPhase = rng() * TWO_PI;
  const size = (node.size ?? baseSizeFor(node.kind)) * (0.8 + rng() * 0.45);
  const pulsePhase = rng() * TWO_PI;
  const pulseSpeed = 0.6 + rng() * 1.0;
  if (node.position !== undefined) {
    // Anchored node (universe / multiverse mode): no orbit at all — the
    // rng stream above is consumed identically so mixed datasets stay
    // deterministic — just a gentle bob through the existing y fields.
    const sp = node.position;
    return {
      shellRadius: Math.sqrt(sp.x * sp.x + sp.y * sp.y + sp.z * sp.z),
      speed: 0,
      inclination,
      phase,
      yAmp: Math.min(yAmp, 0.55),
      ySpeed,
      yPhase,
      size,
      pulsePhase,
      pulseSpeed,
      staticPosition: { x: sp.x, y: sp.y, z: sp.z },
    };
  }
  return {
    shellRadius,
    speed,
    inclination,
    phase,
    yAmp,
    ySpeed,
    yPhase,
    size,
    pulsePhase,
    pulseSpeed,
  };
}

export function layoutCosmos(
  nodes: readonly CosmosNode[],
  seed: number,
): Map<string, OrbitParams> {
  const rng = mulberry32(seed);
  const out = new Map<string, OrbitParams>();
  for (const node of nodes) {
    out.set(node.id, orbitParamsFor(node, rng));
  }
  return out;
}

export function positionAt(
  params: OrbitParams,
  t: number,
): { x: number; y: number; z: number } {
  if (params.staticPosition !== undefined) {
    const sp = params.staticPosition;
    // Small sinusoidal bob only (amplitude = yAmp, capped at 0.55 in
    // orbitParamsFor for anchored nodes, always <= 0.8).
    return {
      x: sp.x,
      y: sp.y + params.yAmp * Math.sin(params.yPhase + params.ySpeed * t),
      z: sp.z,
    };
  }
  const angle = params.phase + params.speed * t;
  const x0 = params.shellRadius * Math.cos(angle);
  const z0 = params.shellRadius * Math.sin(angle);
  const y0 = params.yAmp * Math.sin(params.yPhase + params.ySpeed * t);
  const cosInc = Math.cos(params.inclination);
  const sinInc = Math.sin(params.inclination);
  const y = y0 * cosInc - z0 * sinInc;
  const z = y0 * sinInc + z0 * cosInc;
  return { x: x0, y, z };
}
