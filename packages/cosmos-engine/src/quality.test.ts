import { describe, expect, it } from "vitest";

import {
  QUALITY_THRESHOLDS,
  QUALITY_TIERS,
  QualityController,
  createQualityState,
  simulateQuality,
  stepQuality,
} from "./quality.js";

const FAST = 8; // ~125 fps
const OK = 16.7; // ~60 fps — between the two thresholds: no stepping
const SLOW = 40; // 25 fps — above the downgrade threshold

function series(ms: number, n: number): number[] {
  return Array.from({ length: n }, () => ms);
}

describe("QUALITY_TIERS", () => {
  it("is ordered full → balanced → performance with monotonically cheaper settings", () => {
    expect(QUALITY_TIERS.map((t) => t.id)).toEqual(["full", "balanced", "performance"]);
    for (let i = 1; i < QUALITY_TIERS.length; i++) {
      const prev = QUALITY_TIERS[i - 1];
      const cur = QUALITY_TIERS[i];
      expect(prev).toBeDefined();
      expect(cur).toBeDefined();
      if (prev && cur) expect(cur.pixelRatioScale).toBeLessThan(prev.pixelRatioScale);
    }
    expect(QUALITY_TIERS[0]?.bloom).toBe(true);
    expect(QUALITY_TIERS[2]?.bloom).toBe(false);
    expect(QUALITY_TIERS[2]?.grain).toBe(false);
  });
});

describe("stepQuality", () => {
  it("starts at full and stays there on fast frames", () => {
    const { finalTier, transitions } = simulateQuality(series(FAST, 500));
    expect(finalTier.id).toBe("full");
    expect(transitions).toEqual([]);
  });

  it("stays at full on ~60fps frames (average between thresholds)", () => {
    const { finalTier, transitions } = simulateQuality(series(OK, 2000));
    expect(finalTier.id).toBe("full");
    expect(transitions).toEqual([]);
  });

  it("steps down one tier after a sustained run of slow frames", () => {
    const { finalTier, transitions } = simulateQuality(series(SLOW, 150));
    expect(finalTier.id).toBe("balanced");
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ from: "full", to: "balanced", direction: "down" });
  });

  it("reaches the performance floor under sustained slowness and stops there", () => {
    const { finalTier, transitions } = simulateQuality(series(SLOW, 5000));
    expect(finalTier.id).toBe("performance");
    expect(transitions.map((t) => t.to)).toEqual(["balanced", "performance"]);
  });

  it("a single huge spike does not degrade quality (clamped + streak-gated)", () => {
    const frames = [...series(FAST, 120), 5000, ...series(FAST, 120)];
    const { finalTier, transitions } = simulateQuality(frames);
    expect(finalTier.id).toBe("full");
    expect(transitions).toEqual([]);
  });

  it("does not oscillate when frame times alternate around the threshold", () => {
    const frames = Array.from({ length: 4000 }, (_, i) => (i % 2 === 0 ? 24 : 10));
    const { transitions } = simulateQuality(frames);
    // Alternating input must produce at most one downward step and
    // never a down-up-down flap.
    const directions = transitions.map((t) => t.direction);
    expect(directions.filter((d) => d === "up")).toHaveLength(0);
    expect(transitions.length).toBeLessThanOrEqual(1);
  });

  it("recovers upward only after a long fast run (hysteresis asymmetry)", () => {
    const down = simulateQuality(series(SLOW, 150));
    expect(down.finalTier.id).toBe("balanced");
    // A short fast burst is NOT enough to climb back.
    const shortBurst = simulateQuality([...series(SLOW, 150), ...series(FAST, 200)]);
    expect(shortBurst.finalTier.id).toBe("balanced");
    // A long fast run is.
    const longRun = simulateQuality([
      ...series(SLOW, 150),
      ...series(FAST, QUALITY_THRESHOLDS.upgradeAfterFrames + QUALITY_THRESHOLDS.cooldownFrames + 400),
    ]);
    expect(longRun.finalTier.id).toBe("full");
    expect(longRun.transitions.map((t) => t.direction)).toEqual(["down", "up"]);
  });

  it("respects the cooldown: no second step immediately after the first", () => {
    let state = createQualityState();
    let firstChangeAt = -1;
    let secondChangeAt = -1;
    for (let i = 0; i < 600; i++) {
      const step = stepQuality(state, SLOW);
      state = step.state;
      if (step.changed && firstChangeAt < 0) firstChangeAt = i;
      else if (step.changed && secondChangeAt < 0) secondChangeAt = i;
    }
    expect(firstChangeAt).toBeGreaterThanOrEqual(0);
    expect(secondChangeAt).toBeGreaterThan(firstChangeAt + QUALITY_THRESHOLDS.cooldownFrames);
  });

  it("reduced motion: may step down but NEVER steps up (no effects escalation)", () => {
    const frames = [
      ...series(SLOW, 2000), // drive all the way to performance
      ...series(FAST, 5000), // then run fast for a long time
    ];
    const { finalTier, transitions } = simulateQuality(frames, { reducedMotion: true });
    expect(finalTier.id).toBe("performance");
    expect(transitions.every((t) => t.direction === "down")).toBe(true);
  });

  it("ignores non-finite / negative samples without changing state", () => {
    const s0 = createQualityState();
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const step = stepQuality(s0, bad);
      expect(step.changed).toBe(false);
      expect(step.state).toBe(s0);
    }
  });

  it("is pure: stepping does not mutate the input state", () => {
    const s0 = createQualityState();
    const snapshot = { ...s0 };
    stepQuality(s0, SLOW);
    expect(s0).toEqual(snapshot);
  });
});

describe("QualityController", () => {
  it("tracks the tier and rolling average across pushes", () => {
    const c = new QualityController();
    expect(c.tier.id).toBe("full");
    let sawChange = false;
    for (let i = 0; i < 150; i++) {
      if (c.push(SLOW).changed) sawChange = true;
    }
    expect(sawChange).toBe(true);
    expect(c.tier.id).toBe("balanced");
    expect(c.avgFrameMs).not.toBeNull();
    expect(c.avgFrameMs as number).toBeGreaterThan(QUALITY_THRESHOLDS.downgradeAvgMs);
  });
});
