"use client";

// Cosmos — the Holographic Cosmos Engine page with three modes:
// Consent Cosmos (synthetic demo constellation in consent-ring shells),
// Universe (simulated cosmic web), and Multiverse (speculative
// bubble-universe imagination branch). The Consent Cosmos can show
// either the synthetic demo dataset or an archive imported locally
// on the Import Archive page. All other data is synthetic/simulated.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { graphToCosmosData } from "@omega/meta-export";
import type { CosmosData } from "@omega/cosmos-engine";
import CosmosCanvas from "@/components/CosmosCanvas";
import { IMPORTED_FOLLOWER_NOTE, useDataset, withStellarCounts } from "@/lib/dataset";

type DatasetView = "synthetic" | "imported";

export default function CosmosPage() {
  const { state, omniAdditions } = useDataset();
  const importedGraph = state.kind === "imported" ? state.graph : null;
  const importedAt = state.kind === "imported" ? state.importedAt : null;

  const [view, setView] = useState<DatasetView>(
    importedGraph ? "imported" : "synthetic",
  );

  // A fresh import (new importedAt) becomes the active view, so the
  // "View in Cosmos" flow from /import lands on the imported graph.
  useEffect(() => {
    if (importedAt !== null) setView("imported");
  }, [importedAt]);

  const importedCosmosData = useMemo(
    () =>
      importedGraph
        ? withStellarCounts(importedGraph, graphToCosmosData(importedGraph))
        : undefined,
    [importedGraph],
  );

  // Omni merge: when a completed Omni run's cosmos.addNodes action has
  // registered additions in the dataset store (lib/dataset.tsx), merge
  // them into the synthetic dataset — the same createDemoCosmos(42,
  // 600) base the canvas generates on its own — and pass the merged
  // set down as the canvas's data. The engine module is imported
  // lazily here, exactly as CosmosCanvas loads it, so no WebGL code
  // joins this page's initial bundle.
  const [mergedSyntheticData, setMergedSyntheticData] =
    useState<CosmosData | undefined>(undefined);
  useEffect(() => {
    if (omniAdditions === null) {
      setMergedSyntheticData(undefined);
      return;
    }
    let live = true;
    void import("@omega/cosmos-engine").then((mod) => {
      if (!live) return;
      const base = mod.createDemoCosmos(42, 600);
      setMergedSyntheticData({
        nodes: [...base.nodes, ...omniAdditions.nodes],
        edges: [...base.edges, ...omniAdditions.edges],
      });
    });
    return () => {
      live = false;
    };
  }, [omniAdditions]);

  const showImported = view === "imported" && importedGraph !== null;
  const showOmniMerge =
    !showImported && omniAdditions !== null && mergedSyntheticData !== undefined;

  return (
    <>
      <h1 className="page-title">
        Cosmos <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        One engine, three views. <strong>Consent Cosmos</strong> is the
        synthetic member constellation inside the four consent-ring shells.{" "}
        <strong>Universe</strong> zooms out to a simulated cosmic web —
        galaxy positions are a statistical model of real large-scale
        structure (filaments, clusters, voids), not a star catalog.{" "}
        <strong>Multiverse</strong> is a speculative imagination branch:
        bubble-universe concepts are unproven, and the view is labeled as
        such. Drag to orbit, scroll to zoom, click a node to inspect it.
        Display quality and reduced-motion follow your{" "}
        <a href="/settings">Settings</a>.
      </p>

      <div className="cosmos-controls" style={{ marginBottom: "0.75rem" }}>
        <div className="tabs" role="group" aria-label="Dataset" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={view === "synthetic" ? "tab active" : "tab"}
            aria-pressed={view === "synthetic"}
            onClick={() => setView("synthetic")}
          >
            Synthetic demo
          </button>
          <button
            type="button"
            className={showImported ? "tab active" : "tab"}
            aria-pressed={showImported}
            disabled={importedGraph === null}
            onClick={() => setView("imported")}
          >
            Imported archive
          </button>
        </div>
        {importedGraph === null ? (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            No archive imported yet — <Link href="/import">import one</Link>{" "}
            to enable this view.
          </span>
        ) : showImported ? (
          <span className="chip">
            Imported archive — processed locally, nothing uploaded ·{" "}
            {importedGraph.ownerName} · {importedGraph.people.length} people
            · {importedGraph.summary.postCount} posts
          </span>
        ) : (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            An imported archive is available — switch to “Imported archive”
            to view it.
          </span>
        )}
      </div>

      <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
        Friends make a star massive. Followers make it dense and bright.
      </p>

      {showImported && (
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
          {IMPORTED_FOLLOWER_NOTE}
        </p>
      )}

      {!showImported && omniAdditions !== null && (
        <p style={{ marginBottom: "0.75rem" }}>
          <span className="chip">
            Includes nodes added by the Omni demonstration run (community +
            agents)
          </span>{" "}
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Added on the public ring by the run&apos;s cosmos.addNodes
            action — demo-local, reset on reload.
          </span>
        </p>
      )}

      {showImported && importedCosmosData ? (
        <CosmosCanvas
          data={importedCosmosData}
          dataLabel="Imported archive — processed locally, nothing uploaded · Followers are demo-derived (the export has no follower counts)"
        />
      ) : showOmniMerge ? (
        <CosmosCanvas
          data={mergedSyntheticData}
          dataLabel="Synthetic demo constellation + Omni demonstration nodes (community + agents) — all demo-local"
        />
      ) : (
        <CosmosCanvas />
      )}
    </>
  );
}
