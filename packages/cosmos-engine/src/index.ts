/**
 * @omega/cosmos-engine
 *
 * Holographic Cosmos Engine for the Omega Platform — Step 4.
 *
 * Framework-agnostic WebGL renderer (three.js) plus the pure-logic
 * layer it is built on: deterministic layout, consent-ring filtering,
 * a seeded PRNG, and clearly-synthetic demo data. The web app mounts
 * the engine with `createCosmosEngine(container, options)` and talks
 * to it only through the `CosmosEngine` surface.
 *
 * Creator: David Charles Bourassa
 */

export type {
  ActiveRing,
  CosmosBubble,
  CosmosData,
  CosmosEdge,
  CosmosEdgeKind,
  CosmosEngine,
  CosmosEngineOptions,
  CosmosNode,
  CosmosNodeKind,
  CosmosStats,
  GalaxyClass,
  RealmKind,
  RingType,
  Vec3,
} from "./types.js";

export { mulberry32 } from "./prng.js";

export { scaleLevelFor, UNIVERSE_SCALES } from "./scale.js";
export type { ScaleLevel, ScaleLevelId } from "./scale.js";

export {
  createMultiverseData,
  createUniverseData,
  GALAXY_CLASS_COLORS,
  mixHex,
} from "./universe.js";
export type { GeneratedWeb } from "./universe.js";

export { layoutCosmos, orbitParamsFor, positionAt, RING_SHELL_RADIUS } from "./layout.js";

export {
  DEFAULT_FRAME_DISTANCE,
  boundingSphereOfPoints,
  fitDistanceForRadius,
} from "./framing.js";
export type { BoundingSphere } from "./framing.js";
export type { OrbitParams } from "./layout.js";

export {
  DIMMED_BRIGHTNESS,
  DIMMED_SCALE,
  edgeBrightness,
  FULL_BRIGHTNESS,
  FULL_SCALE,
  isNodeDimmed,
  nodeVisualState,
} from "./filter.js";
export type { NodeVisualState } from "./filter.js";

export { createDemoCosmos } from "./data.js";

export {
  STELLAR_HOT_COLOR,
  STELLAR_WARM_COLOR,
  stellarProperties,
  stellarPropertiesForNode,
  stellarVisuals,
} from "./stellar.js";
export type { StellarProperties, StellarVisuals } from "./stellar.js";

export {
  QUALITY_THRESHOLDS,
  QUALITY_TIERS,
  QualityController,
  createQualityState,
  simulateQuality,
  stepQuality,
} from "./quality.js";
export type {
  QualityOptions,
  QualityState,
  QualityStep,
  QualityThresholds,
  QualityTier,
  QualityTierId,
  QualityTransition,
} from "./quality.js";

export {
  GLSL_HASH_2D,
  GLSL_NOISE,
  GRAIN_FRAGMENT,
  GRAIN_SHADER,
  GRAIN_VERTEX,
  NEBULA_FRAGMENT,
  NEBULA_VERTEX,
  NODE_FRAGMENT,
  NODE_VERTEX,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
  SHELL_FRAGMENT,
  SHELL_VERTEX,
} from "./shaders.js";

export {
  createCosmosEngine,
  EDGE_KIND_COLORS,
  NODE_KIND_COLORS,
  RING_SHELL_COLORS,
} from "./renderer.js";
