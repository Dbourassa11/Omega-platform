/**
 * @omega/cosmos-engine — type contracts
 *
 * Pure-logic type surface shared by the renderer and the logic layer.
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";
import type { ScaleLevelId } from "./scale.js";
import type { QualityTierId } from "./quality.js";
export type { RingType };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type GalaxyClass = "spiral" | "elliptical" | "irregular";

export type CosmosNodeKind =
  | "member"
  | "memory"
  | "creation"
  | "company"
  | "legacy"
  | "connector"
  | "galaxy";

export type CosmosEdgeKind = "relationship" | "branch" | "economic";

export interface CosmosNode {
  id: string;
  kind: CosmosNodeKind;
  ring: RingType;
  label: string;
  branch?: string;
  /** Fixed world position (universe / multiverse mode). When present the
   * node is anchored in place instead of orbiting a consent-ring shell. */
  position?: Vec3;
  /** Per-node hex colour, overriding NODE_KIND_COLORS[kind]. */
  color?: string;
  /** Per-node base size, overriding baseSizeFor(kind). */
  size?: number;
  /** Galaxy morphological class (kind === "galaxy" only). */
  galaxyClass?: GalaxyClass;
  /**
   * Number of friends (member nodes only). Drives stellar mass —
   * see stellar.ts (David's law: friends make a star massive).
   * Optional and additive: datasets that never set it render neutrally.
   */
  friendCount?: number;
  /**
   * Number of followers (member nodes only). Drives stellar density
   * and brightness — see stellar.ts (followers make a star dense and
   * bright, never more massive).
   */
  followerCount?: number;
}

export interface CosmosEdge {
  source: string;
  target: string;
  kind: CosmosEdgeKind;
}

/** A bubble universe in the multiverse view: a fresnel shell + metadata. */
export interface CosmosBubble {
  id: string;
  label: string;
  center: Vec3;
  radius: number;
  color: string;
}

export interface CosmosData {
  nodes: CosmosNode[];
  edges: CosmosEdge[];
  /** Optional bubble-universe shells (multiverse view). */
  bubbles?: CosmosBubble[];
  /** Optional cosmic-web filament polylines, each a sampled point list. */
  filamentPaths?: Vec3[][];
}

export type ActiveRing = RingType | "all";

export type RealmKind =
  | "living-cosmos"
  | "eternal-garden"
  | "creator-studio"
  | "trust-ledger"
  | "connector-galaxy"
  | "holographic-branch";

export interface CosmosEngineOptions {
  reducedMotion?: boolean;
  quality?: "auto" | "high" | "low";
  bloom?: boolean;
  /** Play the cinematic intro sweep once when the engine is created. */
  intro?: boolean;
}

export interface CosmosStats {
  fps: number;
  nodeCount: number;
  /** Current adaptive-quality tier when quality:"auto" is in effect;
   * the starting tier otherwise. See quality.ts. */
  qualityTier?: QualityTierId;
}

export interface CosmosEngine {
  setData(
    data: CosmosData,
    opts?: { transition?: boolean; frame?: boolean },
  ): void;
  setActiveRing(ring: ActiveRing): void;
  onNodeSelect(cb: (node: CosmosNode | null) => void): () => void;
  onNodeHover(cb: (node: CosmosNode | null) => void): () => void;
  focusNode(id: string): void;
  /** Toggle the consent-ring shells (+ Trust Beacon particles) on/off. */
  setShellsVisible(visible: boolean): void;
  /** Tween the camera to the named universe scale level's distance. */
  setScaleLevel(level: ScaleLevelId): void;
  /** Play the cinematic intro sweep (no-op animation under reduced motion). */
  playIntro(): void;
  getStats(): CosmosStats;
  dispose(): void;
}
