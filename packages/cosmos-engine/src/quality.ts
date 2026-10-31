/**
 * @omega/cosmos-engine — adaptive quality (pure logic, no WebGL)
 *
 * A small, fully deterministic state machine that watches a rolling
 * average of frame times and steps render quality down when frames are
 * sustainedly slow — and back up only after a much longer run of fast
 * frames (hysteresis), so quality cannot oscillate around a threshold.
 *
 * The renderer feeds it one sample per frame (`dt * 1000`); everything
 * here is a pure function of the sample series, so the stepping logic
 * is unit-tested without a GPU, a DOM, or timers.
 *
 * Reduced motion: when `reducedMotion` is set the controller may still
 * step DOWN (protecting a struggling device is not an "effect"), but
 * it never steps UP — no automatic effects escalation for a visitor
 * who asked for reduced motion.
 *
 * Creator: David Charles Bourassa
 */

export type QualityTierId = "full" | "balanced" | "performance";

export interface QualityTier {
  id: QualityTierId;
  /** Multiplier applied to the renderer's base pixel ratio. */
  pixelRatioScale: number;
  /** Bloom post-processing allowed at this tier. */
  bloom: boolean;
  /** Film-grain pass allowed at this tier. */
  grain: boolean;
}

/** Ordered best → cheapest. Index 0 is the starting tier. */
export const QUALITY_TIERS: readonly QualityTier[] = [
  { id: "full", pixelRatioScale: 1, bloom: true, grain: true },
  { id: "balanced", pixelRatioScale: 0.75, bloom: true, grain: false },
  { id: "performance", pixelRatioScale: 0.5, bloom: false, grain: false },
];

export interface QualityThresholds {
  /** Rolling average above this (ms) counts a frame as "slow". */
  downgradeAvgMs: number;
  /** Rolling average below this (ms) counts a frame as "fast". */
  upgradeAvgMs: number;
  /** Consecutive slow evaluations before stepping down one tier. */
  downgradeAfterFrames: number;
  /** Consecutive fast evaluations before stepping up one tier.
   * Deliberately ≫ downgradeAfterFrames: recovery must be earned. */
  upgradeAfterFrames: number;
  /** Frames after any step during which no further step may occur. */
  cooldownFrames: number;
  /** EMA weight for each new frame-time sample (0 < α ≤ 1). */
  emaAlpha: number;
  /** Samples are clamped to this ceiling so a single tab-switch or
   * GC pause cannot masquerade as sustained slowness. */
  maxSampleMs: number;
}

export const QUALITY_THRESHOLDS: QualityThresholds = {
  downgradeAvgMs: 22,
  upgradeAvgMs: 12.5,
  downgradeAfterFrames: 45,
  upgradeAfterFrames: 900,
  cooldownFrames: 120,
  emaAlpha: 0.08,
  maxSampleMs: 100,
};

export interface QualityOptions {
  reducedMotion?: boolean;
  thresholds?: Partial<QualityThresholds>;
}

export interface QualityState {
  tierIndex: number;
  /** Exponential moving average of frame time (ms); null before sample 1. */
  avgFrameMs: number | null;
  slowStreak: number;
  fastStreak: number;
  cooldownRemaining: number;
  samples: number;
}

export interface QualityStep {
  state: QualityState;
  tier: QualityTier;
  /** True only on the sample where the tier actually changed. */
  changed: boolean;
  direction: "down" | "up" | null;
}

export function createQualityState(): QualityState {
  return {
    tierIndex: 0,
    avgFrameMs: null,
    slowStreak: 0,
    fastStreak: 0,
    cooldownRemaining: 0,
    samples: 0,
  };
}

function resolveThresholds(opts: QualityOptions): QualityThresholds {
  return { ...QUALITY_THRESHOLDS, ...(opts.thresholds ?? {}) };
}

function tierAt(index: number): QualityTier {
  const tier = QUALITY_TIERS[index] ?? QUALITY_TIERS[0];
  if (tier === undefined) throw new Error("QUALITY_TIERS must not be empty");
  return tier;
}

/**
 * Feed one frame-time sample (ms). Pure: the input state is not
 * mutated; the returned state is the next state.
 */
export function stepQuality(
  prev: QualityState,
  frameMs: number,
  opts: QualityOptions = {},
): QualityStep {
  const t = resolveThresholds(opts);
  const reducedMotion = opts.reducedMotion ?? false;

  // Ignore garbage samples entirely (NaN, negative, infinite).
  if (!Number.isFinite(frameMs) || frameMs < 0) {
    return { state: prev, tier: tierAt(prev.tierIndex), changed: false, direction: null };
  }
  const sample = Math.min(frameMs, t.maxSampleMs);
  const avg =
    prev.avgFrameMs === null
      ? sample
      : prev.avgFrameMs + (sample - prev.avgFrameMs) * t.emaAlpha;

  // While a step is settling (cooldown), evidence gathering pauses:
  // streaks hold at zero, so the next step always needs a fresh,
  // full streak measured after the cooldown — never a banked one.
  const inCooldown = prev.cooldownRemaining > 0;
  const state: QualityState = {
    ...prev,
    avgFrameMs: avg,
    samples: prev.samples + 1,
    cooldownRemaining: Math.max(0, prev.cooldownRemaining - 1),
    slowStreak: inCooldown ? 0 : avg > t.downgradeAvgMs ? prev.slowStreak + 1 : 0,
    fastStreak: inCooldown ? 0 : avg < t.upgradeAvgMs ? prev.fastStreak + 1 : 0,
  };

  if (state.cooldownRemaining > 0) {
    return { state, tier: tierAt(state.tierIndex), changed: false, direction: null };
  }

  const lastIndex = QUALITY_TIERS.length - 1;
  if (state.slowStreak >= t.downgradeAfterFrames && state.tierIndex < lastIndex) {
    const next: QualityState = {
      ...state,
      tierIndex: state.tierIndex + 1,
      slowStreak: 0,
      fastStreak: 0,
      cooldownRemaining: t.cooldownFrames,
    };
    return { state: next, tier: tierAt(next.tierIndex), changed: true, direction: "down" };
  }

  if (
    !reducedMotion &&
    state.fastStreak >= t.upgradeAfterFrames &&
    state.tierIndex > 0
  ) {
    const next: QualityState = {
      ...state,
      tierIndex: state.tierIndex - 1,
      slowStreak: 0,
      fastStreak: 0,
      cooldownRemaining: t.cooldownFrames,
    };
    return { state: next, tier: tierAt(next.tierIndex), changed: true, direction: "up" };
  }

  return { state, tier: tierAt(state.tierIndex), changed: false, direction: null };
}

export interface QualityTransition {
  /** Sample index (0-based) at which the tier changed. */
  atSample: number;
  from: QualityTierId;
  to: QualityTierId;
  direction: "down" | "up";
}

/** Run a whole frame-time series through the controller (test/demo aid). */
export function simulateQuality(
  frameTimesMs: readonly number[],
  opts: QualityOptions = {},
): { finalTier: QualityTier; transitions: QualityTransition[]; state: QualityState } {
  let state = createQualityState();
  const transitions: QualityTransition[] = [];
  frameTimesMs.forEach((ms, i) => {
    const from = tierAt(state.tierIndex).id;
    const step = stepQuality(state, ms, opts);
    state = step.state;
    if (step.changed && step.direction !== null) {
      transitions.push({ atSample: i, from, to: step.tier.id, direction: step.direction });
    }
  });
  return { finalTier: tierAt(state.tierIndex), transitions, state };
}

/** Stateful convenience wrapper for the render loop. */
export class QualityController {
  private state: QualityState = createQualityState();
  private readonly opts: QualityOptions;

  constructor(opts: QualityOptions = {}) {
    this.opts = opts;
  }

  get tier(): QualityTier {
    return tierAt(this.state.tierIndex);
  }

  get avgFrameMs(): number | null {
    return this.state.avgFrameMs;
  }

  /** Feed one frame; returns the step (check `.changed` to re-apply). */
  push(frameMs: number): QualityStep {
    const step = stepQuality(this.state, frameMs, this.opts);
    this.state = step.state;
    return step;
  }
}
