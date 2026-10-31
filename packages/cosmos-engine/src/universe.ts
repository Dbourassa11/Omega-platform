/**
 * @omega/cosmos-engine — universe & multiverse data (pure logic, no WebGL)
 *
 * Procedurally generates a cosmic-web galaxy field: galaxy clusters
 * linked by bezier filaments, with galaxies placed in clusters, along
 * filaments, and in the voids between them. Fully deterministic from
 * a seed via mulberry32.
 *
 * NOTE — the multiverse view is a SPECULATIVE VISUALIZATION: bubble
 * universes are an artistic device for exploring variant cosmoses,
 * not a claim about real cosmology.
 *
 * Creator: David Charles Bourassa
 */

import { mulberry32 } from "./prng.js";
import type {
  CosmosBubble,
  CosmosData,
  CosmosEdge,
  CosmosNode,
  GalaxyClass,
  Vec3,
} from "./types.js";

export const GALAXY_CLASS_COLORS: Record<GalaxyClass, string> = {
  spiral: "#bcd8ff",
  elliptical: "#ffd9a3",
  irregular: "#7fe9ff",
};

/* ------------------------------------------------------------------ */
/* Colour helpers (pure)                                               */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const ch = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/** Linearly mix two hex colours: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(
    ca.r + (cb.r - ca.r) * k,
    ca.g + (cb.g - ca.g) * k,
    ca.b + (cb.b - ca.b) * k,
  );
}

/** Jitter a hex colour's HSL lightness by a small seeded amount. */
function jitterLightness(hex: string, rng: () => number): string {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  const nl = Math.max(0.08, Math.min(0.92, l + (rng() - 0.5) * 0.14));
  // HSL → RGB
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let rr: number;
  let gg: number;
  let bb: number;
  if (s === 0) {
    rr = gg = bb = nl;
  } else {
    const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
    const p = 2 * nl - q;
    rr = hue2rgb(p, q, h + 1 / 3);
    gg = hue2rgb(p, q, h);
    bb = hue2rgb(p, q, h - 1 / 3);
  }
  return rgbToHex(rr * 255, gg * 255, bb * 255);
}

/* ------------------------------------------------------------------ */
/* Geometry helpers (pure)                                             */
/* ------------------------------------------------------------------ */

function gaussian(rng: () => number): number {
  // Box–Muller transform.
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomDirection(rng: () => number): Vec3 {
  const z = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: r * Math.cos(theta), y: r * Math.sin(theta), z };
}

function randomPointInSphere(rng: () => number, radius: number): Vec3 {
  const dir = randomDirection(rng);
  const dist = radius * Math.cbrt(rng());
  return { x: dir.x * dist, y: dir.y * dist, z: dir.z * dist };
}

function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const CLASS_LABEL: Record<GalaxyClass, string> = {
  spiral: "Spiral",
  elliptical: "Elliptical",
  irregular: "Irregular",
};

const CLASS_BASE_SIZE: Record<GalaxyClass, number> = {
  elliptical: 2.2,
  spiral: 1.8,
  irregular: 1.2,
};

function pickClass(
  rng: () => number,
  spiralW: number,
  ellipticalW: number,
): GalaxyClass {
  const r = rng();
  if (r < ellipticalW) return "elliptical";
  if (r < ellipticalW + spiralW) return "spiral";
  return "irregular";
}

/* ------------------------------------------------------------------ */
/* Cosmic-web generation                                               */
/* ------------------------------------------------------------------ */

export interface GeneratedWeb {
  nodes: CosmosNode[];
  edges: CosmosEdge[];
  filamentPaths: Vec3[][];
}

/**
 * Build one cosmic web inside a sphere of `radius`.
 * `tint` (hex) optionally shifts every galaxy colour toward a palette
 * tint (used per-bubble in the multiverse view); null keeps class colours.
 */
function generateWeb(
  rng: () => number,
  radius: number,
  galaxyCount: number,
  tint: string | null,
  idPrefix: string,
): GeneratedWeb {
  if (galaxyCount <= 0) {
    return { nodes: [], edges: [], filamentPaths: [] };
  }
  // Distances/sigmas in the placement spec are calibrated for radius 300;
  // scale them down (never up) for smaller bubble universes.
  const sigmaScale = Math.min(1, Math.max(0.4, radius / 300));

  // --- Cluster centres, with a minimum separation (rejection sampling) ---
  const clusterCount = Math.max(3, Math.round(galaxyCount / 450));
  const minSeparation = radius * 0.3;
  const centers: Vec3[] = [];
  for (let c = 0; c < clusterCount; c++) {
    let best: Vec3 | null = null;
    let bestMin = -1;
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = randomPointInSphere(rng, radius * 0.82);
      let minD = Infinity;
      for (const existing of centers) {
        minD = Math.min(minD, dist(candidate, existing));
      }
      if (minD >= minSeparation) {
        best = candidate;
        break;
      }
      if (minD > bestMin) {
        bestMin = minD;
        best = candidate;
      }
    }
    centers.push(best ?? randomPointInSphere(rng, radius * 0.82));
  }
  const clusterSigmas = centers.map(() => (6 + rng() * 4) * sigmaScale);

  // --- Filaments: nearest-neighbour spanning links + ~30% extra ---
  const linkKeys = new Set<string>();
  const links: [number, number][] = [];
  const addLink = (a: number, b: number): void => {
    if (a === b) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    links.push([a, b]);
  };
  for (let c = 1; c < centers.length; c++) {
    let nearest = 0;
    let nearestD = Infinity;
    for (let p = 0; p < c; p++) {
      const a = centers[c];
      const b = centers[p];
      if (a === undefined || b === undefined) continue;
      const d = dist(a, b);
      if (d < nearestD) {
        nearestD = d;
        nearest = p;
      }
    }
    addLink(nearest, c);
  }
  for (let a = 0; a < centers.length; a++) {
    for (let b = a + 1; b < centers.length; b++) {
      if (rng() < 0.3) addLink(a, b);
    }
  }

  // --- Sample each filament as a quadratic bezier (24 points) ---
  const filamentPaths: Vec3[][] = [];
  const samplePool: Vec3[] = [];
  for (const [ai, bi] of links) {
    const a = centers[ai];
    const b = centers[bi];
    if (a === undefined || b === undefined) continue;
    const mid: Vec3 = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
    // Jitter the control point perpendicular to the filament direction.
    const dir: Vec3 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.max(1e-6, Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2));
    const rand = randomDirection(rng);
    let perp: Vec3 = {
      x: rand.x - (rand.x * dir.x + rand.y * dir.y + rand.z * dir.z) * (dir.x / (len * len)),
      y: rand.y - (rand.x * dir.x + rand.y * dir.y + rand.z * dir.z) * (dir.y / (len * len)),
      z: rand.z - (rand.x * dir.x + rand.y * dir.y + rand.z * dir.z) * (dir.z / (len * len)),
    };
    const perpLen = Math.sqrt(perp.x ** 2 + perp.y ** 2 + perp.z ** 2);
    if (perpLen < 1e-6) {
      perp = { x: 1, y: 0, z: 0 };
    } else {
      perp = { x: perp.x / perpLen, y: perp.y / perpLen, z: perp.z / perpLen };
    }
    const bow = len * (0.08 + rng() * 0.12);
    const ctrl: Vec3 = {
      x: mid.x + perp.x * bow,
      y: mid.y + perp.y * bow,
      z: mid.z + perp.z * bow,
    };
    const path: Vec3[] = [];
    for (let s = 0; s < 24; s++) {
      const t = s / 23;
      const u = 1 - t;
      const point: Vec3 = {
        x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y,
        z: u * u * a.z + 2 * u * t * ctrl.z + t * t * b.z,
      };
      path.push(point);
      samplePool.push(point);
    }
    filamentPaths.push(path);
  }

  // --- Galaxy placement ---
  const nodes: CosmosNode[] = [];
  const clusterMembers = new Map<number, string[]>();
  const voidRejectFilament = 26 * sigmaScale;
  const voidRejectCluster = 30 * sigmaScale;

  for (let i = 0; i < galaxyCount; i++) {
    const roll = rng();
    let position: Vec3;
    let branch: "cluster" | "filament" | "void";
    let galaxyClass: GalaxyClass;
    let clusterIdx = -1;

    if (roll < 0.34) {
      branch = "cluster";
      clusterIdx = Math.floor(rng() * centers.length);
      const center = centers[clusterIdx];
      const sigma = clusterSigmas[clusterIdx] ?? 8 * sigmaScale;
      if (center === undefined) {
        position = { x: 0, y: 0, z: 0 };
      } else {
        position = {
          x: center.x + gaussian(rng) * sigma,
          y: center.y + gaussian(rng) * sigma,
          z: center.z + gaussian(rng) * sigma,
        };
      }
      // Cluster mix: elliptical 62 / spiral 26 / irregular 12.
      galaxyClass = pickClass(rng, 0.26, 0.62);
    } else if (roll < 0.86) {
      branch = "filament";
      const path = filamentPaths[Math.floor(rng() * filamentPaths.length)];
      const sample =
        path !== undefined && path.length > 0
          ? path[Math.floor(rng() * path.length)]
          : { x: 0, y: 0, z: 0 };
      const sigma = 4.5 * sigmaScale;
      position = {
        x: (sample?.x ?? 0) + gaussian(rng) * sigma,
        y: (sample?.y ?? 0) + gaussian(rng) * sigma,
        z: (sample?.z ?? 0) + gaussian(rng) * sigma,
      };
      // Filament mix: spiral 58 / elliptical 24 / irregular 18.
      galaxyClass = pickClass(rng, 0.58, 0.24);
    } else {
      branch = "void";
      let candidate = randomPointInSphere(rng, radius);
      for (let retry = 0; retry < 12; retry++) {
        let rejected = false;
        for (const s of samplePool) {
          if (dist(candidate, s) < voidRejectFilament) {
            rejected = true;
            break;
          }
        }
        if (!rejected) {
          for (const c of centers) {
            if (dist(candidate, c) < voidRejectCluster) {
              rejected = true;
              break;
            }
          }
        }
        if (!rejected) break;
        candidate = randomPointInSphere(rng, radius);
      }
      position = candidate;
      // Void mix: irregular 55 / spiral 30 / elliptical 15.
      galaxyClass = pickClass(rng, 0.3, 0.15);
    }

    let color = GALAXY_CLASS_COLORS[galaxyClass];
    if (tint !== null) {
      color = mixHex(color, tint, 0.38);
    }
    color = jitterLightness(color, rng);

    const node: CosmosNode = {
      id: `${idPrefix}galaxy-${i}`,
      kind: "galaxy",
      ring: "public",
      label: `${CLASS_LABEL[galaxyClass]} Galaxy Ω-${String(i).padStart(4, "0")}`,
      branch,
      position,
      color,
      size: CLASS_BASE_SIZE[galaxyClass] * (0.7 + rng() * 0.6),
      galaxyClass,
    };
    nodes.push(node);
    if (clusterIdx >= 0) {
      const group = clusterMembers.get(clusterIdx) ?? [];
      group.push(node.id);
      clusterMembers.set(clusterIdx, group);
    }
  }

  // --- Edges: link ~50% of each cluster's galaxies to its brightest
  // (first-placed) galaxy; total is naturally capped at <= galaxyCount. ---
  const edges: CosmosEdge[] = [];
  for (const group of clusterMembers.values()) {
    const brightest = group[0];
    if (brightest === undefined) continue;
    for (let k = 1; k < group.length; k++) {
      const member = group[k];
      if (member === undefined) continue;
      if (rng() < 0.5) {
        edges.push({ source: brightest, target: member, kind: "relationship" });
      }
    }
  }
  const edgeCap = galaxyCount * 2;
  const cappedEdges = edges.length > edgeCap ? edges.slice(0, edgeCap) : edges;

  return { nodes, edges: cappedEdges, filamentPaths };
}

/* ------------------------------------------------------------------ */
/* Public generators                                                   */
/* ------------------------------------------------------------------ */

/** One universe: a cosmic web of `galaxyCount` galaxies in radius 300. */
export function createUniverseData(
  seed: number,
  galaxyCount: number,
): CosmosData {
  const rng = mulberry32(seed);
  const web = generateWeb(rng, 300, galaxyCount, null, "");
  return {
    nodes: web.nodes,
    edges: web.edges,
    filamentPaths: web.filamentPaths,
  };
}

const MULTIVERSE_VARIANTS: readonly { label: string; tint: string }[] = [
  { label: "Variant — High-Trust φ", tint: "#ffd166" },
  { label: "Variant — Eternal Garden", tint: "#69db9c" },
  { label: "Variant — Deep Void", tint: "#7a6ff0" },
  { label: "Variant — Bright Core", tint: "#fff3b0" },
  { label: "Variant — Mirror Branch", tint: "#e08cff" },
];

const HOME_LABEL = "Member Cosmos — Home Universe";
const HOME_COLOR = "#8fb7ff";

/**
 * The multiverse view: bubble 0 is the home universe at the origin and
 * the remaining bubbles sit on a ring around it, each with its own
 * palette tint and core node. SPECULATIVE VISUALIZATION — see header.
 */
export function createMultiverseData(
  seed: number,
  bubbleCount = 5,
): CosmosData {
  const rng = mulberry32(seed);
  const count = Math.max(1, Math.floor(bubbleCount));
  const nodes: CosmosNode[] = [];
  const edges: CosmosEdge[] = [];
  const filamentPaths: Vec3[][] = [];
  const bubbles: CosmosBubble[] = [];

  for (let b = 0; b < count; b++) {
    const isHome = b === 0;
    const variant =
      MULTIVERSE_VARIANTS[(b - 1) % MULTIVERSE_VARIANTS.length] ??
      MULTIVERSE_VARIANTS[0];
    const label = isHome ? HOME_LABEL : (variant?.label ?? HOME_LABEL);
    const tint = isHome ? null : (variant?.tint ?? null);
    const bubbleColor = isHome ? HOME_COLOR : (variant?.tint ?? HOME_COLOR);
    const radius = isHome ? 110 : 78 + rng() * 22;
    let center: Vec3 = { x: 0, y: 0, z: 0 };
    if (!isHome) {
      const ringSlots = Math.max(1, count - 1);
      const angle = ((b - 1) / ringSlots) * Math.PI * 2;
      center = {
        x: 330 * Math.cos(angle),
        y: (rng() - 0.5) * 80,
        z: 330 * Math.sin(angle),
      };
    }
    const galaxyCount = isHome ? 800 : 320 + Math.floor(rng() * 60);
    const web = generateWeb(rng, radius, galaxyCount, tint, `b${b}-`);

    for (const node of web.nodes) {
      if (node.position !== undefined) {
        node.position = {
          x: node.position.x + center.x,
          y: node.position.y + center.y,
          z: node.position.z + center.z,
        };
      }
      nodes.push(node);
    }
    for (const edge of web.edges) edges.push(edge);
    for (const path of web.filamentPaths) {
      filamentPaths.push(
        path.map((p) => ({ x: p.x + center.x, y: p.y + center.y, z: p.z + center.z })),
      );
    }

    bubbles.push({
      id: `bubble-${b}`,
      label,
      center: { ...center },
      radius,
      color: bubbleColor,
    });
    nodes.push({
      id: `core-b${b}`,
      kind: "galaxy",
      ring: "public",
      label: `${label} — Core`,
      branch: "cluster",
      position: { ...center },
      color: bubbleColor,
      size: 3.4,
      galaxyClass: "elliptical",
    });
  }

  return { nodes, edges, bubbles, filamentPaths };
}
