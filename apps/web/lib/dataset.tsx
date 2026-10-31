"use client";

// Client-side dataset store for the Omega Platform web shell.
// Holds the active member dataset: either the synthetic demo
// constellation (default) or a Facebook export parsed locally in
// this browser via @omega/meta-export. In-memory only — a reload
// resets to synthetic, by design. Nothing is uploaded or persisted.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  parseFacebookExport,
  type ExportFileEntry,
  type NormalizedMemberGraph,
  type RingOverride,
} from "@omega/meta-export";
import type { CosmosData } from "@omega/cosmos-engine";
import { logActivity } from "@/lib/activity";

export type DatasetState =
  | { kind: "synthetic" }
  | {
      kind: "imported";
      graph: NormalizedMemberGraph;
      files: ExportFileEntry[];
      importedAt: string;
    };

export interface DatasetContextValue {
  state: DatasetState;
  setImported: (
    files: ExportFileEntry[],
    overrides?: RingOverride[],
  ) => NormalizedMemberGraph;
  applyOverrides: (overrides: RingOverride[]) => void;
  resetToSynthetic: () => void;
  /**
   * Extra cosmos nodes/edges added by the Omni demonstration run
   * (community + agent nodes), merged into the synthetic dataset by
   * the Cosmos page. Null until a run's cosmos.addNodes action lands.
   * Kept here — rather than in the Omni store — because both providers
   * are mounted in Providers.tsx with the dataset store on the
   * outside, so the Omni action handler can write through this setter
   * and the Cosmos page can read without a circular provider order.
   */
  omniAdditions: CosmosData | null;
  setOmniAdditions: (data: CosmosData | null) => void;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

/**
 * Disclosure for imported datasets, shown wherever imported stellar
 * counts appear: a Facebook export contains no follower data, so
 * follower counts in the imported cosmos are DEMO-DERIVED (see
 * demoFollowerCountForId), never parsed. Friend counts, by contrast,
 * are real: they count the person's parsed connections (below).
 */
export const IMPORTED_FOLLOWER_NOTE =
  "Followers are demo-derived from a stable hash of each person ID — the export contains no follower counts. Friend counts come from the parsed connections.";

/** FNV-1a hash of an id, normalised to [0, 1). Stable across runs. */
function stableHash01(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

/**
 * Demo-derived follower count for an imported person: a deterministic
 * function of the stable hash of their person id, skewed so most
 * people have few followers and a rare few have many. NOT parsed data
 * — see IMPORTED_FOLLOWER_NOTE.
 */
export function demoFollowerCountForId(id: string): number {
  const u = stableHash01(id);
  return Math.floor(u * u * 600);
}

/**
 * Enrich CosmosData converted from a parsed export (meta-export's
 * graphToCosmosData) with stellar counts (see @omega/cosmos-engine
 * stellar.ts — David's law):
 *
 *   - friendCount: the person's parsed connection count — the number
 *     of distinct people they share a thread with in the export,
 *     mirroring exactly the relationship edges graphToCosmosData
 *     emits (owner <-> each thread participant; pairwise between
 *     co-participants of group threads of at most 6 non-owner
 *     participants).
 *   - followerCount: demo-derived from a stable hash of the person
 *     id (demoFollowerCountForId) — disclosed by IMPORTED_FOLLOWER_NOTE
 *     wherever imported data is labelled.
 *
 * Non-member nodes are returned untouched.
 */
export function withStellarCounts(
  graph: NormalizedMemberGraph,
  data: CosmosData,
): CosmosData {
  const connections = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    if (a === b) return;
    let set = connections.get(a);
    if (set === undefined) {
      set = new Set<string>();
      connections.set(a, set);
    }
    set.add(b);
  };
  for (const thread of graph.threads) {
    for (const personId of thread.participantIds) {
      link("owner", personId);
      link(personId, "owner");
    }
    if (thread.participantIds.length >= 2 && thread.participantIds.length <= 6) {
      const ids = [...thread.participantIds].sort();
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i];
          const b = ids[j];
          if (a !== undefined && b !== undefined) {
            link(a, b);
            link(b, a);
          }
        }
      }
    }
  }
  return {
    ...data,
    nodes: data.nodes.map((node) =>
      node.kind === "member"
        ? {
            ...node,
            friendCount: connections.get(node.id)?.size ?? 0,
            followerCount: demoFollowerCountForId(node.id),
          }
        : node,
    ),
  };
}


function mergeOverrides(
  existing: RingOverride[],
  incoming: RingOverride[],
): RingOverride[] {
  const byId = new Map<string, RingOverride>();
  for (const o of existing) byId.set(o.personId, o);
  for (const o of incoming) byId.set(o.personId, o);
  return [...byId.values()];
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DatasetState>({ kind: "synthetic" });
  const [omniAdditions, setOmniAdditionsState] = useState<CosmosData | null>(
    null,
  );
  const overridesRef = useRef<RingOverride[]>([]);
  const stateRef = useRef<DatasetState>(state);
  stateRef.current = state;

  const setImported = useCallback(
    (files: ExportFileEntry[], overrides?: RingOverride[]) => {
      const effective = overrides ?? [];
      overridesRef.current = effective;
      const graph = parseFacebookExport(files, effective);
      const next: DatasetState = {
        kind: "imported",
        graph,
        files,
        importedAt: new Date().toISOString(),
      };
      stateRef.current = next;
      setState(next);
      logActivity(
        "import",
        `Imported archive for ${graph.ownerName} — ${graph.people.length} people, ${graph.summary.postCount} posts, processed locally`,
      );
      return graph;
    },
    [],
  );

  const applyOverrides = useCallback((overrides: RingOverride[]) => {
    const current = stateRef.current;
    if (current.kind !== "imported") return;
    const merged = mergeOverrides(overridesRef.current, overrides);
    overridesRef.current = merged;
    const graph = parseFacebookExport(current.files, merged);
    const next: DatasetState = { ...current, graph };
    stateRef.current = next;
    setState(next);
    logActivity(
      "import",
      `Reclassified ${overrides.length} ${overrides.length === 1 ? "person" : "people"} via ring override`,
    );
  }, []);

  const resetToSynthetic = useCallback(() => {
    overridesRef.current = [];
    const next: DatasetState = { kind: "synthetic" };
    stateRef.current = next;
    setState(next);
    logActivity("import", "Reset active dataset to the synthetic demo");
  }, []);

  const setOmniAdditions = useCallback((data: CosmosData | null) => {
    setOmniAdditionsState(data);
    if (data !== null) {
      logActivity(
        "cosmos",
        `Omni demonstration added ${data.nodes.length} nodes to the synthetic cosmos (demo-local)`,
      );
    }
  }, []);

  const value = useMemo<DatasetContextValue>(
    () => ({
      state,
      setImported,
      applyOverrides,
      resetToSynthetic,
      omniAdditions,
      setOmniAdditions,
    }),
    [state, setImported, applyOverrides, resetToSynthetic, omniAdditions, setOmniAdditions],
  );

  return (
    <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>
  );
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) {
    throw new Error("useDataset must be used inside <DatasetProvider>");
  }
  return ctx;
}
