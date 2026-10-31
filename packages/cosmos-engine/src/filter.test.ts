import { describe, expect, it } from "vitest";

import {
  DIMMED_BRIGHTNESS,
  DIMMED_SCALE,
  FULL_BRIGHTNESS,
  FULL_SCALE,
  edgeBrightness,
  isNodeDimmed,
  nodeVisualState,
} from "./filter.js";
import type { CosmosEdge, CosmosNode, RingType } from "./types.js";

const RINGS: RingType[] = ["family", "friends", "work", "public"];

function node(id: string, ring: RingType): CosmosNode {
  return { id, kind: "member", ring, label: id };
}

describe("nodeVisualState", () => {
  it("'all' gives full brightness/scale for every ring", () => {
    for (const ring of RINGS) {
      expect(nodeVisualState(node("n", ring), "all")).toEqual({
        brightness: FULL_BRIGHTNESS,
        scale: FULL_SCALE,
      });
      expect(isNodeDimmed(node("n", ring), "all")).toBe(false);
    }
  });

  it("active ring is full, other rings are exactly dimmed", () => {
    for (const active of RINGS) {
      for (const ring of RINGS) {
        const state = nodeVisualState(node("n", ring), active);
        if (ring === active) {
          expect(state).toEqual({
            brightness: FULL_BRIGHTNESS,
            scale: FULL_SCALE,
          });
          expect(isNodeDimmed(node("n", ring), active)).toBe(false);
        } else {
          expect(state.brightness).toBe(DIMMED_BRIGHTNESS);
          expect(state.scale).toBe(DIMMED_SCALE);
          expect(state.brightness).toBe(0.12);
          expect(state.scale).toBe(0.82);
          expect(isNodeDimmed(node("n", ring), active)).toBe(true);
        }
      }
    }
  });
});

describe("edgeBrightness", () => {
  const famA = node("fam-a", "family");
  const famB = node("fam-b", "family");
  const friend = node("friend-a", "friends");
  const work = node("work-a", "work");
  const byId = new Map<string, CosmosNode>([
    [famA.id, famA],
    [famB.id, famB],
    [friend.id, friend],
    [work.id, work],
  ]);

  function edge(source: string, target: string): CosmosEdge {
    return { source, target, kind: "relationship" };
  }

  it("both endpoints active = 1", () => {
    expect(edgeBrightness(edge("fam-a", "fam-b"), byId, "family")).toBe(1);
  });

  it("one endpoint active = (1 + 0.12) / 2", () => {
    expect(
      edgeBrightness(edge("fam-a", "friend-a"), byId, "family"),
    ).toBeCloseTo((1 + 0.12) / 2, 10);
  });

  it("no endpoint active = 0.12", () => {
    expect(edgeBrightness(edge("friend-a", "work-a"), byId, "family")).toBe(
      0.12,
    );
  });

  it("'all' makes every edge full brightness", () => {
    expect(edgeBrightness(edge("friend-a", "work-a"), byId, "all")).toBe(1);
  });

  it("a missing endpoint is treated as dimmed", () => {
    expect(
      edgeBrightness(edge("fam-a", "missing-id"), byId, "family"),
    ).toBeCloseTo((1 + 0.12) / 2, 10);
    expect(
      edgeBrightness(edge("missing-a", "missing-b"), byId, "family"),
    ).toBe(0.12);
  });
});
