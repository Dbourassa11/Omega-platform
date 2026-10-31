/**
 * @omega/cosmos-engine — stellar physics tests
 *
 * Encodes David's law as a contract (monotonicity is the spec):
 * friends make a star massive; followers make it dense and bright,
 * never more massive.
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { createDemoCosmos } from "./data.js";
import {
  stellarProperties,
  stellarPropertiesForNode,
  stellarVisuals,
} from "./stellar.js";
import type { CosmosNode } from "./types.js";

function member(partial: Partial<CosmosNode>): CosmosNode {
  return {
    id: "member-test",
    kind: "member",
    ring: "friends",
    label: "Test Member",
    ...partial,
  };
}

function rgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

describe("stellarProperties — mass from friends only", () => {
  it("mass strictly increases with friends at several points", () => {
    const points = [0, 1, 3, 10, 50, 200, 1000];
    let previous = -Infinity;
    for (const friends of points) {
      const { mass } = stellarProperties(friends, 0);
      expect(mass).toBeGreaterThan(previous);
      previous = mass;
    }
  });

  it("the empty star is exactly mass 1 / density 1 / radius 1 / brightness 1", () => {
    expect(stellarProperties(0, 0)).toEqual({
      mass: 1,
      density: 1,
      radius: 1,
      brightness: 1,
    });
  });

  it("followers leave mass EXACTLY unchanged (bit-for-bit)", () => {
    for (const friends of [0, 1, 7, 42, 500]) {
      const baseline = stellarProperties(friends, 0).mass;
      for (const followers of [1, 10, 100, 10_000, 1_000_000]) {
        expect(stellarProperties(friends, followers).mass).toBe(baseline);
      }
    }
  });
});

describe("stellarProperties — followers add density and brightness", () => {
  it("at fixed friends: density up, brightness up, radius down", () => {
    const friends = 25;
    const ladder = [0, 1, 5, 25, 100, 1000, 100_000];
    let prevDensity = -Infinity;
    let prevBrightness = -Infinity;
    let prevRadius = Infinity;
    for (const followers of ladder) {
      const props = stellarProperties(friends, followers);
      expect(props.density).toBeGreaterThan(prevDensity);
      expect(props.brightness).toBeGreaterThan(prevBrightness);
      expect(props.radius).toBeLessThan(prevRadius);
      prevDensity = props.density;
      prevBrightness = props.brightness;
      prevRadius = props.radius;
    }
  });

  it("radius grows sublinearly with mass: 8x mass less than 8x radius", () => {
    // mass = 1 + ln(1 + friends): friends = e^7 - 1 gives mass ≈ 8,
    // i.e. 8x the empty star's mass of 1 (at density 1 throughout).
    const empty = stellarProperties(0, 0);
    const eightfold = stellarProperties(Math.exp(7) - 1, 0);
    expect(eightfold.mass).toBeCloseTo(8 * empty.mass, 6);
    expect(eightfold.radius).toBeLessThan(8 * empty.radius);
    // In fact the cube-root relation makes it almost exactly 2x.
    expect(eightfold.radius).toBeCloseTo(2, 3);
  });

  it("doubling friends less than doubles radius", () => {
    for (const friends of [1, 10, 100, 1000]) {
      const single = stellarProperties(friends, 0);
      const doubled = stellarProperties(friends * 2, 0);
      expect(doubled.radius).toBeLessThan(2 * single.radius);
      expect(doubled.radius).toBeGreaterThan(single.radius);
    }
  });
});

describe("stellarVisuals — colour temperature and glow", () => {
  it("at fixed friends, high followers is bluer than low followers", () => {
    const low = stellarVisuals(member({ friendCount: 10, followerCount: 0 }));
    const high = stellarVisuals(member({ friendCount: 10, followerCount: 5000 }));
    const lowRgb = rgb(low.colorHex);
    const highRgb = rgb(high.colorHex);
    expect(highRgb.b).toBeGreaterThanOrEqual(lowRgb.b);
    expect(highRgb.r).toBeLessThanOrEqual(lowRgb.r);
    expect(highRgb.b > lowRgb.b || highRgb.r < lowRgb.r).toBe(true);
  });

  it("sizeScale is the stellar radius; emissive and halo grow with followers", () => {
    const sparse = stellarVisuals(member({ friendCount: 20, followerCount: 0 }));
    const dense = stellarVisuals(member({ friendCount: 20, followerCount: 2000 }));
    const propsSparse = stellarProperties(20, 0);
    const propsDense = stellarProperties(20, 2000);
    expect(sparse.sizeScale).toBeCloseTo(propsSparse.radius, 12);
    expect(dense.sizeScale).toBeCloseTo(propsDense.radius, 12);
    // Denser star: more compact, but glowing harder.
    expect(dense.sizeScale).toBeLessThan(sparse.sizeScale);
    expect(dense.emissiveIntensity).toBeGreaterThan(sparse.emissiveIntensity);
    expect(dense.haloScale).toBeGreaterThan(sparse.haloScale);
    // More friends at fixed followers: bigger star.
    const befriended = stellarVisuals(member({ friendCount: 200, followerCount: 0 }));
    expect(befriended.sizeScale).toBeGreaterThan(sparse.sizeScale);
  });

  it("is deterministic: same node, same visuals", () => {
    const node = member({ friendCount: 33, followerCount: 777 });
    expect(stellarVisuals(node)).toEqual(stellarVisuals(node));
  });
});

describe("stellarVisuals — neutral default", () => {
  it("non-member nodes return the neutral default with their kind colour", () => {
    const galaxyNode: CosmosNode = {
      id: "g-1",
      kind: "galaxy",
      ring: "public",
      label: "Galaxy",
      friendCount: 100,
      followerCount: 100,
    };
    const galaxy = stellarVisuals(galaxyNode);
    expect(galaxy).toEqual({
      sizeScale: 1,
      colorHex: "#bcd8ff",
      emissiveIntensity: 1,
      haloScale: 1,
    });
    expect(
      stellarPropertiesForNode({
        kind: "galaxy",
        friendCount: 100,
        followerCount: 100,
      }),
    ).toBeNull();
  });

  it("member nodes without counts return the neutral default", () => {
    const visuals = stellarVisuals(member({}));
    expect(visuals).toEqual({
      sizeScale: 1,
      colorHex: "#ffd977",
      emissiveIntensity: 1,
      haloScale: 1,
    });
    expect(stellarPropertiesForNode(member({}))).toBeNull();
  });

  it("a member with only one count is computed with the other as 0", () => {
    const friendsOnly = stellarPropertiesForNode(member({ friendCount: 10 }));
    expect(friendsOnly).not.toBeNull();
    expect(friendsOnly?.density).toBe(1);
    expect(friendsOnly?.mass).toBeCloseTo(1 + Math.log1p(10), 12);
    const followersOnly = stellarPropertiesForNode(member({ followerCount: 10 }));
    expect(followersOnly?.mass).toBe(1);
    expect(followersOnly?.density).toBeCloseTo(1 + Math.log1p(10), 12);
  });

  it("a per-node colour wins for the neutral default", () => {
    const companyNode: CosmosNode = {
      id: "c-1",
      kind: "company",
      ring: "work",
      label: "Co",
      color: "#123456",
    };
    const visuals = stellarVisuals(companyNode);
    expect(visuals.colorHex).toBe("#123456");
    expect(visuals.sizeScale).toBe(1);
  });
});

describe("createDemoCosmos — stellar counts", () => {
  it("every member carries both counts; non-members carry neither", () => {
    const data = createDemoCosmos(42, 600);
    const members = data.nodes.filter((n) => n.kind === "member");
    expect(members.length).toBeGreaterThan(0);
    for (const m of members) {
      expect(typeof m.friendCount).toBe("number");
      expect(typeof m.followerCount).toBe("number");
      expect(m.friendCount ?? -1).toBeGreaterThanOrEqual(0);
      expect(m.followerCount ?? -1).toBeGreaterThanOrEqual(0);
    }
    for (const n of data.nodes) {
      if (n.kind === "member") continue;
      expect(n.friendCount).toBeUndefined();
      expect(n.followerCount).toBeUndefined();
    }
  });

  it("friendCount equals the actual relationship-edge degree (small seeded graph)", () => {
    const data = createDemoCosmos(7, 50);
    const degree = new Map<string, number>();
    for (const edge of data.edges) {
      if (edge.kind !== "relationship") continue;
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    for (const node of data.nodes) {
      if (node.kind !== "member") continue;
      expect(node.friendCount).toBe(degree.get(node.id) ?? 0);
    }
  });

  it("counts are deterministic per seed and vary across seeds", () => {
    const a = createDemoCosmos(123, 200);
    const b = createDemoCosmos(123, 200);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = createDemoCosmos(124, 200);
    const followersA = a.nodes
      .filter((n) => n.kind === "member")
      .map((n) => n.followerCount);
    const followersC = c.nodes
      .filter((n) => n.kind === "member")
      .map((n) => n.followerCount);
    expect(followersA).not.toEqual(followersC);
  });

  it("follower counts are skewed: the median sits well below the max", () => {
    const data = createDemoCosmos(42, 2000);
    const followers = data.nodes
      .filter((n) => n.kind === "member")
      .map((n) => n.followerCount ?? 0)
      .sort((x, y) => x - y);
    const median = followers[Math.floor(followers.length / 2)] ?? 0;
    const max = followers[followers.length - 1] ?? 0;
    expect(max).toBeGreaterThan(50);
    expect(median).toBeLessThan(max / 3);
  });
});
