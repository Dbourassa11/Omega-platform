/**
 * @omega/cosmos-engine — stellar physics for member stars (pure logic, no WebGL)
 *
 * David's law (2026-10-27), in plain language:
 *
 *   "When a member has a lot of friends their star is more massive,
 *    but followers add density and brightness."
 *
 * The model, exactly as implemented below:
 *
 *   - Mass comes from friends ONLY. Each friend adds a little less
 *     than the one before (a logarithm), so going from 0 to 10 friends
 *     matters more than going from 1,000 to 1,010:
 *         mass = 1 + ln(1 + friendCount)
 *     Followers never touch mass — not a rounding difference, never:
 *     the mass formula simply does not read the follower count.
 *
 *   - Density comes from followers, with the same diminishing curve:
 *         density = 1 + ln(1 + followerCount)
 *     More followers pack the same mass into a tighter star.
 *
 *   - Radius follows the stellar relation radius ∝ (mass / density)^(1/3)
 *     (the cube root of volume per unit mass, normalised so a member
 *     with no friends and no followers has radius exactly 1):
 *         radius = (mass / density)^(1/3)
 *     Because of the cube root, radius grows SUBLINEARLY with mass —
 *     eight times the mass only doubles the radius. And at a fixed
 *     friend count, more followers mean higher density, so the star
 *     gets slightly SMALLER (more compact) even as it gets brighter.
 *
 *   - Brightness (luminosity) grows with density, and therefore with
 *     followers:
 *         brightness = density^(3/2)
 *     A follower-less star has brightness exactly 1.
 *
 *   - Colour temperature follows density/brightness: a sparse star is
 *     warm gold; as followers pack it denser and brighter it heats
 *     toward blue-white, the way real dense, luminous stars burn
 *     hotter and bluer than sparse, cool ones.
 *
 * Everything here is a pure, deterministic function of the node's
 * friend/follower counts. Non-member nodes, and member nodes carrying
 * no counts at all, get the neutral default visuals (sizeScale 1,
 * the node's existing kind colour, no emissive or halo boost), so
 * universe / multiverse galaxies and legacy datasets render exactly
 * as before.
 *
 * Creator: David Charles Bourassa
 */

import type { CosmosNode, CosmosNodeKind } from "./types.js";

/** Derived stellar quantities for a member star. All are unitless
 * ratios against the empty star (no friends, no followers), whose
 * mass, density, radius, and brightness are all exactly 1. */
export interface StellarProperties {
  /** 1 + ln(1 + friendCount). A function of friends ONLY. */
  mass: number;
  /** 1 + ln(1 + followerCount). */
  density: number;
  /** (mass / density)^(1/3) — sublinear in mass, compacted by density. */
  radius: number;
  /** density^(3/2) — grows with density and with followers. */
  brightness: number;
}

/** Pure visual mapping consumed by the renderer and the inspector. */
export interface StellarVisuals {
  /** Instance scale multiplier: the stellar radius (1 = neutral). */
  sizeScale: number;
  /** Star colour: warm gold when sparse, blue-white when dense/hot. */
  colorHex: string;
  /** Multiplier applied to the instance colour (via aColor). */
  emissiveIntensity: number;
  /** Multiplier for the member glow/particle rendering around the star. */
  haloScale: number;
}

/**
 * Neutral per-kind colours, mirroring NODE_KIND_COLORS in renderer.ts.
 * Duplicated here (rather than imported) so this pure module never
 * depends on the WebGL renderer — the renderer imports this module.
 */
const NEUTRAL_KIND_COLORS: Record<CosmosNodeKind, string> = {
  member: "#ffd977",
  memory: "#f5f2e8",
  creation: "#ffb347",
  company: "#57d7ff",
  legacy: "#cfc4ff",
  connector: "#4fe3c1",
  galaxy: "#bcd8ff",
};

/** Colour of a sparse, cool member star (the member kind colour). */
export const STELLAR_WARM_COLOR = "#ffd977";
/** Colour of a dense, hot, bright member star. */
export const STELLAR_HOT_COLOR = "#cfe4ff";

function sanitizeCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

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

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(
    ca.r + (cb.r - ca.r) * k,
    ca.g + (cb.g - ca.g) * k,
    ca.b + (cb.b - ca.b) * k,
  );
}

/**
 * Stellar properties from raw counts. Negative, non-finite, or missing
 * counts are treated as 0. Mass reads `friendCount` and nothing else,
 * so two calls differing only in followers return bit-for-bit equal mass.
 */
export function stellarProperties(
  friendCount: number | undefined,
  followerCount: number | undefined,
): StellarProperties {
  const friends = sanitizeCount(friendCount);
  const followers = sanitizeCount(followerCount);
  const mass = 1 + Math.log1p(friends);
  const density = 1 + Math.log1p(followers);
  const radius = Math.cbrt(mass / density);
  const brightness = Math.pow(density, 1.5);
  return { mass, density, radius, brightness };
}

/**
 * Stellar properties for a node, or null when the node has no stellar
 * physics: non-member nodes, and member nodes carrying neither count.
 * A member carrying only one count is computed with the other as 0.
 */
export function stellarPropertiesForNode(
  node: Pick<CosmosNode, "kind" | "friendCount" | "followerCount">,
): StellarProperties | null {
  if (node.kind !== "member") {
    return null;
  }
  if (node.friendCount === undefined && node.followerCount === undefined) {
    return null;
  }
  return stellarProperties(node.friendCount, node.followerCount);
}

/**
 * Visual mapping for a node. Deterministic; member stars shift from
 * warm gold (sparse) toward blue-white (dense/hot) as density rises,
 * grow by their stellar radius, and glow harder with brightness.
 * Neutral default for non-members and count-less members: sizeScale 1,
 * the node's existing colour (its per-node colour, else its kind
 * colour), emissiveIntensity 1, haloScale 1.
 */
export function stellarVisuals(
  node: Pick<CosmosNode, "kind" | "color" | "friendCount" | "followerCount">,
): StellarVisuals {
  const props = stellarPropertiesForNode(node);
  if (props === null) {
    return {
      sizeScale: 1,
      colorHex: node.color ?? NEUTRAL_KIND_COLORS[node.kind],
      emissiveIntensity: 1,
      haloScale: 1,
    };
  }
  // Temperature ramp: 0 at density 1 (no followers), approaching 1 as
  // density grows — density 2 → 0.50, density 5.6 (≈100 followers) → 0.82.
  const heat = 1 - 1 / props.density;
  // Brightness is >= 1, so log(brightness) is >= 0; the caps keep a
  // very-followed star from blowing out the bloom pass.
  const glow = Math.log(props.brightness);
  return {
    sizeScale: props.radius,
    colorHex: mixHex(STELLAR_WARM_COLOR, STELLAR_HOT_COLOR, heat),
    emissiveIntensity: Math.min(2.2, 1 + 0.35 * glow),
    haloScale: Math.min(3, 1 + 0.5 * glow),
  };
}
