"use client";

// Holographic Cosmos Engine — interactive mount with three modes:
//   Consent Cosmos — the synthetic demo constellation inside the four
//     consent-ring shells (original Step 4 behavior, preserved).
//   Universe — simulated cosmic web from createUniverseData: a
//     statistical model of large-scale structure, not a star catalog.
//   Multiverse — SPECULATIVE bubble-universe visualization from
//     createMultiverseData; an imagination branch, not established science.
// Engine settings (quality / reduced motion) come from lib/settings and
// are re-applied live on the "omega:settings" event by recreating the
// engine. No real member data is used anywhere.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useEffect, useRef, useState } from "react";
import type {
  ActiveRing,
  CosmosData,
  CosmosEngine,
  CosmosNode,
  CosmosStats,
} from "@omega/cosmos-engine";
import { stellarPropertiesForNode } from "@omega/cosmos-engine/stellar";
import { readSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

type CosmosMode = "consent" | "universe" | "multiverse";

interface UniverseScale {
  id: string;
  label: string;
  distance: string;
  blurb: string;
}

interface BubbleMeta {
  id: string;
  label: string;
  center: { x: number; y: number; z: number };
  radius: number;
  color: string;
}

interface ExtendedData extends CosmosData {
  bubbles?: BubbleMeta[];
}

/** Engine surface including the universe/multiverse additions. */
interface ExtendedEngine extends CosmosEngine {
  setData(data: CosmosData, opts?: { transition?: boolean }): void;
  setShellsVisible(visible: boolean): void;
  setScaleLevel(id: string): void;
  playIntro(): void;
}

/** Module surface including the universe/multiverse data generators. */
interface ExtendedModule {
  createCosmosEngine: (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => ExtendedEngine;
  createDemoCosmos: (seed: number, count: number) => CosmosData;
  createUniverseData: (seed: number, galaxyCount: number) => ExtendedData;
  createMultiverseData: (seed: number, bubbleCount?: number) => ExtendedData;
  UNIVERSE_SCALES: UniverseScale[];
}

const FALLBACK_SCALES: UniverseScale[] = [
  { id: "system", label: "Star system", distance: "light-hours", blurb: "A single star and its immediate neighborhood." },
  { id: "galaxy", label: "Galaxy", distance: "~100,000 light-years", blurb: "A galaxy of stars, gas, and dust." },
  { id: "cluster", label: "Galaxy cluster", distance: "millions of light-years", blurb: "Hundreds to thousands of galaxies bound by gravity." },
  { id: "filament", label: "Filament", distance: "tens of millions of light-years", blurb: "Galaxy clusters strung along cosmic-web filaments." },
  { id: "web", label: "Cosmic web", distance: "hundreds of millions of light-years", blurb: "The full large-scale structure: filaments, walls, and voids." },
];

const MODES: readonly { value: CosmosMode; label: string }[] = [
  { value: "consent", label: "Consent Cosmos" },
  { value: "universe", label: "Universe" },
  { value: "multiverse", label: "Multiverse" },
];

const MODE_LABELS: Record<CosmosMode, string> = {
  consent: "Synthetic demo constellation — no real member data",
  universe:
    "Simulated cosmic web — galaxy positions are a statistical model of real large-scale structure (filaments, clusters, voids), not a star catalog",
  multiverse:
    "SPECULATIVE visualization — bubble-universe / multiverse concepts are unproven; shown as an imagination branch",
};

const RING_BUTTONS: readonly { value: ActiveRing; label: string }[] = [
  { value: "all", label: "All rings" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "work", label: "Work" },
  { value: "public", label: "Public" },
];

const CONSENT_COUNT_OPTIONS = [600, 2000, 5000] as const;
const GALAXY_COUNT_OPTIONS = [2000, 5000, 9000] as const;
const DEMO_SEED = 42;

export interface CosmosCanvasProps {
  /**
   * Optional external data for Consent Cosmos mode (e.g. a locally
   * parsed Facebook export via @omega/meta-export). When omitted, the
   * synthetic demo constellation is generated exactly as before, so
   * existing consumers (/demo, the plain /cosmos synthetic view) are
   * unaffected. Universe / Multiverse modes always use their own
   * generators, even when this prop is set.
   */
  data?: CosmosData;
  /** Label shown on the stage in Consent Cosmos mode when `data` is set. */
  dataLabel?: string;
}

export default function CosmosCanvas({ data, dataLabel }: CosmosCanvasProps = {}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ExtendedEngine | null>(null);
  const moduleRef = useRef<ExtendedModule | null>(null);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<CosmosMode>("consent");
  const [activeRing, setActiveRing] = useState<ActiveRing>("all");
  const [consentCount, setConsentCount] = useState<number>(600);
  const [galaxyCount, setGalaxyCount] = useState<number>(5000);
  const [scales, setScales] = useState<UniverseScale[]>(FALLBACK_SCALES);
  const [scaleLevel, setScaleLevel] = useState<string>("web");
  const [bubbles, setBubbles] = useState<BubbleMeta[]>([]);
  const [selected, setSelected] = useState<CosmosNode | null>(null);
  const [hovered, setHovered] = useState<CosmosNode | null>(null);
  const [stats, setStats] = useState<CosmosStats>({ fps: 0, nodeCount: 0 });
  const [settingsTick, setSettingsTick] = useState(0);

  const modeRef = useRef(mode);
  const consentCountRef = useRef(consentCount);
  const galaxyCountRef = useRef(galaxyCount);
  const activeRingRef = useRef(activeRing);
  const externalDataRef = useRef<CosmosData | undefined>(data);
  modeRef.current = mode;
  consentCountRef.current = consentCount;
  galaxyCountRef.current = galaxyCount;
  activeRingRef.current = activeRing;
  externalDataRef.current = data;
  const hasExternalData = data !== undefined;

  // Re-create the engine when display settings change.
  useEffect(() => {
    const onSettings = () => setSettingsTick((t) => t + 1);
    window.addEventListener("omega:settings", onSettings);
    return () => window.removeEventListener("omega:settings", onSettings);
  }, []);

  // Create the engine (and re-create it on settings change).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let engine: ExtendedEngine | null = null;
    let statsTimer: number | undefined;

    void (async () => {
      const mod = (await import("@omega/cosmos-engine")) as unknown as ExtendedModule;
      if (disposed || !mountRef.current) return;
      moduleRef.current = mod;
      if (Array.isArray(mod.UNIVERSE_SCALES) && mod.UNIVERSE_SCALES.length > 0) {
        setScales(mod.UNIVERSE_SCALES);
      }
      const settings = readSettings();
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      engine = mod.createCosmosEngine(mountRef.current, {
        reducedMotion: settings.reducedMotion || prefersReduced,
        quality: settings.quality,
        bloom: true,
        intro: true,
      });
      engineRef.current = engine;
      engine.onNodeSelect((node) => {
        setSelected(node);
        if (node) engineRef.current?.focusNode(node.id);
      });
      engine.onNodeHover((node) => setHovered(node));
      applyData(engine, mod, modeRef.current, false);
      setStats(engine.getStats());
      statsTimer = window.setInterval(() => {
        if (engineRef.current) setStats(engineRef.current.getStats());
      }, 500);
      setReady(true);
    })();

    return () => {
      disposed = true;
      if (statsTimer !== undefined) window.clearInterval(statsTimer);
      engine?.dispose();
      engineRef.current = null;
    };
    // settingsTick is the intended re-creation trigger; the effect
    // intentionally re-reads current refs rather than depending on them.
  }, [settingsTick]);

  // Push a changed external dataset into the live engine through the
  // same setData path as every other mode, so ring filtering, shells,
  // and inspection behave identically for imported data.
  useEffect(() => {
    if (!ready || data === undefined) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (modeRef.current !== "consent") return;
    engine.setShellsVisible(true);
    engine.setData(data, { transition: true });
    engine.setActiveRing(activeRingRef.current);
    setSelected(null);
    setStats(engine.getStats());
  }, [data, ready]);

  function buildData(
    mod: ExtendedModule,
    forMode: CosmosMode,
  ): { data: ExtendedData; bubbles: BubbleMeta[] } {
    if (forMode === "universe") {
      const data = mod.createUniverseData(DEMO_SEED, galaxyCountRef.current);
      return { data, bubbles: [] };
    }
    if (forMode === "multiverse") {
      const data = mod.createMultiverseData(DEMO_SEED);
      return { data, bubbles: data.bubbles ?? [] };
    }
    if (externalDataRef.current !== undefined) {
      return { data: externalDataRef.current, bubbles: [] };
    }
    return { data: mod.createDemoCosmos(DEMO_SEED, consentCountRef.current), bubbles: [] };
  }

  function applyData(
    engine: ExtendedEngine,
    mod: ExtendedModule,
    forMode: CosmosMode,
    transition: boolean,
  ) {
    const { data, bubbles: nextBubbles } = buildData(mod, forMode);
    engine.setShellsVisible(forMode === "consent");
    if (transition) {
      engine.setData(data, { transition: true });
    } else {
      engine.setData(data);
    }
    if (forMode === "consent") engine.setActiveRing(activeRingRef.current);
    if (forMode === "multiverse") setBubbles(nextBubbles);
    setSelected(null);
    setStats(engine.getStats());
  }

  const withEngine = (fn: (engine: ExtendedEngine, mod: ExtendedModule) => void) => {
    const engine = engineRef.current;
    const mod = moduleRef.current;
    if (engine && mod) fn(engine, mod);
  };

  const handleMode = (next: CosmosMode) => {
    if (next === mode) return;
    setMode(next);
    modeRef.current = next;
    withEngine((engine, mod) => applyData(engine, mod, next, true));
    logActivity("cosmos", `Switched cosmos mode to ${next}`);
  };

  const handleRing = (ring: ActiveRing) => {
    setActiveRing(ring);
    activeRingRef.current = ring;
    engineRef.current?.setActiveRing(ring);
  };

  const handleConsentCount = (count: number) => {
    if (externalDataRef.current !== undefined) return;
    setConsentCount(count);
    consentCountRef.current = count;
    withEngine((engine, mod) => {
      engine.setData(mod.createDemoCosmos(DEMO_SEED, count), { transition: true });
      setStats(engine.getStats());
    });
  };

  const handleGalaxyCount = (count: number) => {
    setGalaxyCount(count);
    galaxyCountRef.current = count;
    withEngine((engine, mod) => {
      engine.setData(mod.createUniverseData(DEMO_SEED, count), { transition: true });
      setStats(engine.getStats());
    });
  };

  const handleScale = (id: string) => {
    setScaleLevel(id);
    engineRef.current?.setScaleLevel(id);
  };

  const selectedClass = (selected as { galaxyClass?: string } | null)?.galaxyClass;
  // Stellar physics (cosmos-engine stellar.ts): non-null only for
  // member nodes carrying friend/follower counts.
  const selectedStellar = selected ? stellarPropertiesForNode(selected) : null;

  return (
    <div className="cosmos-view">
      <div className="cosmos-controls">
        <div className="tabs" role="group" aria-label="Cosmos mode" style={{ marginBottom: 0 }}>
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={mode === m.value ? "tab active" : "tab"}
              aria-pressed={mode === m.value}
              onClick={() => handleMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="cosmos-stats" aria-live="off">
          Nodes: {stats.nodeCount.toLocaleString()} · FPS: {Math.round(stats.fps)}
        </p>
      </div>

      {mode === "consent" && (
        <div className="cosmos-controls">
          <div className="ring-switcher" role="group" aria-label="Active consent ring">
            {RING_BUTTONS.map((btn) => (
              <button
                key={btn.value}
                type="button"
                className="ring-button"
                aria-pressed={activeRing === btn.value}
                onClick={() => handleRing(btn.value)}
              >
                {btn.label}
              </button>
            ))}
          </div>
          {hasExternalData ? (
            <span className="count-select">
              Imported nodes: {(data?.nodes.length ?? 0).toLocaleString()}
            </span>
          ) : (
            <label className="count-select">
              Demo nodes
              <select
                value={consentCount}
                onChange={(e) => handleConsentCount(Number(e.target.value))}
              >
                {CONSENT_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count.toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {mode === "universe" && (
        <div className="cosmos-controls">
          <span className="control-group">
            <span className="control-label">Scale</span>
            {scales.map((scale) => (
              <button
                key={scale.id}
                type="button"
                className="ring-button"
                aria-pressed={scaleLevel === scale.id}
                title={`${scale.label} — ${scale.distance}. ${scale.blurb}`}
                onClick={() => handleScale(scale.id)}
              >
                {scale.label}
              </button>
            ))}
          </span>
          <label className="count-select">
            Galaxies
            <select
              value={galaxyCount}
              onChange={(e) => handleGalaxyCount(Number(e.target.value))}
            >
              {GALAXY_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => engineRef.current?.playIntro()}
          >
            Replay intro
          </button>
        </div>
      )}

      {mode === "multiverse" && (
        <div className="cosmos-controls">
          <span className="control-group">
            <span className="control-label">Focus bubble</span>
            {bubbles.map((bubble, i) => (
              <button
                key={bubble.id}
                type="button"
                className="ring-button"
                onClick={() => engineRef.current?.focusNode(`core-b${i}`)}
              >
                <span
                  className="ring-dot"
                  style={{ background: bubble.color }}
                  aria-hidden="true"
                />
                {bubble.label}
              </button>
            ))}
            {bubbles.length === 0 && (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Loading bubble metadata…
              </span>
            )}
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => engineRef.current?.playIntro()}
          >
            Replay intro
          </button>
        </div>
      )}

      <div
        ref={mountRef}
        className="cosmos-stage"
        role="img"
        aria-label="Interactive 3D cosmos. Drag to orbit, scroll to zoom, click a node to select it."
      >
        {!ready && <p className="cosmos-loading">Loading cosmos engine…</p>}
        <p className="demo-label">
          {mode === "consent" && hasExternalData && dataLabel
            ? dataLabel
            : MODE_LABELS[mode]}
        </p>
      </div>

      <div className="selection-panel" aria-live="polite">
        {selected ? (
          <>
            <h3>{selected.label}</h3>
            <dl>
              <div>
                <dt>Kind</dt>
                <dd>{selected.kind}</dd>
              </div>
              <div>
                <dt>Ring</dt>
                <dd>{selected.ring}</dd>
              </div>
              <div>
                <dt>Branch</dt>
                <dd>{selected.branch ?? "—"}</dd>
              </div>
              {selectedClass ? (
                <div>
                  <dt>Galaxy class</dt>
                  <dd>{selectedClass}</dd>
                </div>
              ) : null}
              {selectedStellar ? (
                <>
                  <div>
                    <dt>Friends</dt>
                    <dd>{(selected.friendCount ?? 0).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Followers</dt>
                    <dd>{(selected.followerCount ?? 0).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Mass</dt>
                    <dd>{selectedStellar.mass.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Density</dt>
                    <dd>{selectedStellar.density.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Brightness</dt>
                    <dd>{selectedStellar.brightness.toFixed(2)}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Node ID</dt>
                <dd>{selected.id}</dd>
              </div>
            </dl>
            <p className="panel-note">
              {mode === "consent"
                ? hasExternalData
                  ? "Imported data panel — values come from the archive parsed locally in this browser. Friend counts count parsed connections; follower counts are demo-derived from person IDs (the export contains no follower counts)."
                  : "Demo data panel — values come from the synthetic demo generator."
                : "Simulated data panel — values come from the statistical universe generator."}
            </p>
            <button
              type="button"
              className="ring-button"
              onClick={() => engineRef.current?.focusNode(selected.id)}
            >
              Fly to node
            </button>
          </>
        ) : (
          <p className="panel-note">
            {hovered
              ? `Hovering: ${hovered.label} (${hovered.kind} · ${hovered.ring})`
              : "Click any node in the cosmos to inspect it. Click empty space to clear the selection."}
          </p>
        )}
      </div>
    </div>
  );
}
