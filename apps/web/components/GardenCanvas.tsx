"use client";

// Eternal Garden — era-clustered cosmos view of the synthetic legacy
// archive. Reuses the Holographic Cosmos Engine (@omega/cosmos-engine)
// with custom nodes: one node per memory, anchored in five era clusters
// arranged around the garden. Clicking a node selects the memory and
// the page shows its provenance card. All data is the fictional demo
// archive from @omega/ai-core — no real personal data.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useEffect, useRef, useState } from "react";
import type { CosmosData, CosmosEngine, CosmosNode } from "@omega/cosmos-engine";
import type { LegacyEra, LegacyMemory } from "@omega/ai-core";
import { LEGACY_ERAS, LEGACY_ERA_LABELS } from "@omega/ai-core";
import { readSettings } from "@/lib/settings";

const ERA_COLORS: Record<LegacyEra, string> = {
  childhood: "#6ee7ff",
  youth: "#7be3a8",
  career: "#d4af37",
  family: "#b18cff",
  "later-years": "#e8a15c",
};

/** Deterministic pseudo-random offset in [-1, 1] from an integer seed. */
function seededOffset(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function buildGardenData(memories: readonly LegacyMemory[]): CosmosData {
  const nodes: CosmosNode[] = [];
  const edges: CosmosData["edges"] = [];

  LEGACY_ERAS.forEach((era, eraIndex) => {
    const inEra = memories
      .filter((memory) => memory.era === era)
      .sort((a, b) => a.year - b.year);
    const angle = (eraIndex / LEGACY_ERAS.length) * Math.PI * 2 - Math.PI / 2;
    const center = {
      x: Math.cos(angle) * 62,
      y: (eraIndex - 2) * 7,
      z: Math.sin(angle) * 62,
    };
    inEra.forEach((memory, i) => {
      const seed = eraIndex * 100 + i;
      nodes.push({
        id: memory.id,
        kind: "memory",
        ring: memory.ring,
        label: memory.title,
        branch: LEGACY_ERA_LABELS[era],
        color: ERA_COLORS[era] ?? "#d4af37",
        size: 1.6,
        position: {
          x: center.x + seededOffset(seed + 1) * 16,
          y: center.y + seededOffset(seed + 2) * 10,
          z: center.z + seededOffset(seed + 3) * 16,
        },
      });
      if (i > 0) {
        const prev = inEra[i - 1];
        if (prev) {
          edges.push({ source: prev.id, target: memory.id, kind: "branch" });
        }
      }
    });
  });

  return { nodes, edges };
}

interface GardenCanvasProps {
  memories: readonly LegacyMemory[];
  onSelect: (memory: LegacyMemory | null) => void;
}

export default function GardenCanvas({ memories, onSelect }: GardenCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CosmosEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const memoriesRef = useRef(memories);
  memoriesRef.current = memories;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let engine: CosmosEngine | null = null;

    void (async () => {
      try {
        const mod = await import("@omega/cosmos-engine");
        if (disposed || !mountRef.current) return;
        const settings = readSettings();
        const prefersReduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        engine = mod.createCosmosEngine(mountRef.current, {
          reducedMotion: settings.reducedMotion || prefersReduced,
          quality: settings.quality,
          bloom: true,
          intro: false,
        });
        engineRef.current = engine;
        engine.setShellsVisible(true);
        engine.setData(buildGardenData(memoriesRef.current));
        engine.setActiveRing("family");
        engine.onNodeSelect((node: CosmosNode | null) => {
          const memory =
            node === null
              ? null
              : (memoriesRef.current.find((m) => m.id === node.id) ?? null);
          onSelectRef.current(memory);
        });
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  if (failed) {
    return (
      <div className="cosmos-stage garden-stage">
        <p className="cosmos-loading">
          The 3D garden could not start in this browser — the era clusters
          below list every memory instead.
        </p>
        <p className="demo-label">
          Synthetic demo archive — fictional member, no real personal data
        </p>
      </div>
    );
  }

  return (
    <div className="cosmos-stage garden-stage">
      <div
        ref={mountRef}
        className="garden-mount"
        role="img"
        aria-label="Eternal Garden: memories of the synthetic demo archive arranged in five era clusters. Use the era lists below for an accessible view."
      >
        {!ready && <p className="cosmos-loading">Growing the garden…</p>}
      </div>
      <p className="demo-label">
        Synthetic demo archive — fictional member, no real personal data
      </p>
    </div>
  );
}

export { ERA_COLORS };
