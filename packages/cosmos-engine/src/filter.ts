/**
 * @omega/cosmos-engine — ring filtering (pure logic, no WebGL)
 *
 * Creator: David Charles Bourassa
 */

import type { ActiveRing, CosmosEdge, CosmosNode } from "./types.js";

export const FULL_BRIGHTNESS = 1;
export const DIMMED_BRIGHTNESS = 0.12;
export const FULL_SCALE = 1;
export const DIMMED_SCALE = 0.82;

export interface NodeVisualState {
  brightness: number;
  scale: number;
}

export function nodeVisualState(
  node: CosmosNode,
  activeRing: ActiveRing,
): NodeVisualState {
  if (activeRing === "all" || node.ring === activeRing) {
    return { brightness: FULL_BRIGHTNESS, scale: FULL_SCALE };
  }
  return { brightness: DIMMED_BRIGHTNESS, scale: DIMMED_SCALE };
}

export function isNodeDimmed(
  node: CosmosNode,
  activeRing: ActiveRing,
): boolean {
  return !(activeRing === "all" || node.ring === activeRing);
}

export function edgeBrightness(
  edge: CosmosEdge,
  nodeById: ReadonlyMap<string, CosmosNode>,
  activeRing: ActiveRing,
): number {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  const sourceBrightness =
    source === undefined
      ? DIMMED_BRIGHTNESS
      : nodeVisualState(source, activeRing).brightness;
  const targetBrightness =
    target === undefined
      ? DIMMED_BRIGHTNESS
      : nodeVisualState(target, activeRing).brightness;
  return (sourceBrightness + targetBrightness) / 2;
}
