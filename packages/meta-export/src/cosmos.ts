/**
 * @omega/meta-export — NormalizedMemberGraph -> CosmosData converter
 *
 * Emits no node positions: the cosmos engine lays ring-shell nodes
 * out itself when no position is set. Ordering is deterministic
 * (nodes and edges sorted by id / source / target).
 *
 * Creator: David Charles Bourassa
 */

import type { CosmosData, CosmosEdge, CosmosNode } from "@omega/cosmos-engine";

import type { NormalizedMemberGraph } from "./types.js";

export function graphToCosmosData(graph: NormalizedMemberGraph): CosmosData {
  const nodes: CosmosNode[] = [
    { id: "owner", kind: "member", ring: "family", label: graph.ownerName },
    ...graph.people.map(
      (person): CosmosNode => ({
        id: person.id,
        kind: "member",
        ring: person.ring,
        label: person.name,
        branch: person.ringSource,
      }),
    ),
  ];
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const edges: CosmosEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (source: string, target: string): void => {
    if (source === target) return;
    const key = `${source}|${target}|relationship`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ source, target, kind: "relationship" });
  };

  for (const thread of graph.threads) {
    // owner <-> every thread co-participant
    for (const personId of thread.participantIds) {
      addEdge("owner", personId);
    }
    // person <-> person, pairwise, for group threads. A normalized
    // thread's participantIds exclude the owner, so >= 2 of them means
    // the thread had > 2 participants in total (a group thread).
    // Pairwise edges are only emitted for groups of at most 6
    // non-owner participants, to bound edge growth.
    if (thread.participantIds.length >= 2 && thread.participantIds.length <= 6) {
      const ids = [...thread.participantIds].sort();
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i];
          const b = ids[j];
          if (a !== undefined && b !== undefined) addEdge(a, b);
        }
      }
    }
  }

  edges.sort((a, b) =>
    a.source !== b.source
      ? a.source < b.source
        ? -1
        : 1
      : a.target !== b.target
        ? a.target < b.target
          ? -1
          : 1
        : 0,
  );

  return { nodes, edges };
}
