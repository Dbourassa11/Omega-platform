/**
 * @omega/cosmos-engine — synthetic demo data (pure logic, no WebGL)
 *
 * All data is clearly synthetic ("Demo ...") and deterministic from seed.
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

import { mulberry32 } from "./prng.js";
import type { CosmosData, CosmosEdge, CosmosNode } from "./types.js";

const BRANCH_NAMES: readonly string[] = [
  "experiences",
  "art",
  "photos",
  "music",
  "videos",
  "movies",
  "wisdom",
];

const CONNECTOR_DEFS: readonly { slug: string; label: string }[] = [
  { slug: "meta", label: "Meta" },
  { slug: "notion", label: "Notion" },
  { slug: "google", label: "Google" },
  { slug: "github", label: "GitHub" },
  { slug: "stripe", label: "Stripe" },
  { slug: "cloudflare", label: "Cloudflare" },
];

const RING_ORDER: readonly RingType[] = [
  "family",
  "friends",
  "work",
  "public",
];

function pickRingWeighted(rng: () => number): RingType {
  const r = rng();
  if (r < 0.3) return "family";
  if (r < 0.6) return "friends";
  if (r < 0.85) return "work";
  return "public";
}

function pickBranch(rng: () => number): string {
  const idx = Math.floor(rng() * BRANCH_NAMES.length);
  return BRANCH_NAMES[idx] ?? "experiences";
}

function companyLabel(index1: number): string {
  const idx = index1 - 1;
  const letter = String.fromCharCode(65 + (idx % 26));
  const suffix = idx >= 26 ? String(Math.floor(idx / 26)) : "";
  return `Demo Company ${letter}${suffix}`;
}

function memberLabel(index1: number): string {
  return `Demo Member ${String(index1).padStart(3, "0")}`;
}

interface OwnedNode {
  node: CosmosNode;
  ownerId: string;
}

export function createDemoCosmos(
  seed: number,
  nodeCount: number,
): CosmosData {
  const rng = mulberry32(seed);
  if (nodeCount <= 0) {
    return { nodes: [], edges: [] };
  }

  const connectorCount =
    nodeCount >= 30
      ? CONNECTOR_DEFS.length
      : Math.min(
          CONNECTOR_DEFS.length,
          Math.max(1, Math.floor(nodeCount / 5)),
        );
  const memberCount = Math.max(1, Math.round(nodeCount * 0.22));
  const companyCount = Math.max(
    nodeCount >= 100 ? 2 : 0,
    Math.round(nodeCount * 0.04),
  );
  const legacyCount = Math.max(
    nodeCount >= 100 ? 2 : 0,
    Math.round(nodeCount * 0.03),
  );

  // --- Members ---
  const members: CosmosNode[] = [];
  for (let i = 1; i <= memberCount; i++) {
    members.push({
      id: `member-${i}`,
      kind: "member",
      ring: pickRingWeighted(rng),
      label: memberLabel(i),
    });
  }

  // Guarantee every ring is represented when there are >= 8 members.
  if (members.length >= 8) {
    const counts = new Map<RingType, number>();
    for (const ring of RING_ORDER) counts.set(ring, 0);
    for (const m of members) counts.set(m.ring, (counts.get(m.ring) ?? 0) + 1);
    for (const ring of RING_ORDER) {
      if ((counts.get(ring) ?? 0) > 0) continue;
      // Find a donor: a member whose ring currently has more than one member.
      for (let i = members.length - 1; i >= 0; i--) {
        const candidate = members[i];
        if (candidate === undefined) continue;
        if ((counts.get(candidate.ring) ?? 0) > 1) {
          counts.set(candidate.ring, (counts.get(candidate.ring) ?? 0) - 1);
          candidate.ring = ring;
          counts.set(ring, 1);
          break;
        }
      }
    }
  }

  // --- Branch nodes (memory | creation), 2-6 per member ---
  const branchRecords: OwnedNode[] = [];
  members.forEach((member, memberIdx) => {
    const memberNum = memberIdx + 1;
    const count = 2 + Math.floor(rng() * 5);
    for (let j = 1; j <= count; j++) {
      const kind = rng() < 0.5 ? "memory" : "creation";
      const branch = pickBranch(rng);
      const id =
        kind === "memory"
          ? `memory-${memberNum}-${j}`
          : `creation-${memberNum}-${j}`;
      const label =
        kind === "memory"
          ? `Journal — ${member.label}`
          : `Artwork — ${member.label}`;
      branchRecords.push({
        node: { id, kind, ring: member.ring, label, branch },
        ownerId: member.id,
      });
    }
  });

  // --- Companies ---
  const companies: CosmosNode[] = [];
  for (let i = 1; i <= companyCount; i++) {
    companies.push({
      id: `company-${i}`,
      kind: "company",
      ring: rng() < 0.5 ? "work" : "public",
      label: companyLabel(i),
    });
  }

  // --- Legacy mirrors ---
  const legacyRecords: OwnedNode[] = [];
  for (let i = 1; i <= legacyCount; i++) {
    const ownerIdx = Math.floor(rng() * members.length);
    const owner = members[ownerIdx] ?? members[0];
    if (owner === undefined) break;
    legacyRecords.push({
      node: {
        id: `legacy-${i}`,
        kind: "legacy",
        ring: "family",
        label: `Legacy Mirror — ${owner.label}`,
      },
      ownerId: owner.id,
    });
  }

  // --- Connectors ---
  const connectors: CosmosNode[] = [];
  for (let i = 0; i < connectorCount; i++) {
    const def = CONNECTOR_DEFS[i];
    if (def === undefined) break;
    connectors.push({
      id: `connector-${def.slug}`,
      kind: "connector",
      ring: "public",
      label: def.label,
    });
  }

  // --- Reconcile total to exactly nodeCount ---
  let total =
    members.length +
    branchRecords.length +
    companies.length +
    legacyRecords.length +
    connectors.length;

  if (total > nodeCount) {
    let excess = total - nodeCount;
    // Trim branch nodes first.
    while (excess > 0 && branchRecords.length > 0) {
      branchRecords.pop();
      excess--;
    }
    // Fallback (only reachable for very small graphs): trim other groups.
    while (excess > 0 && legacyRecords.length > 0) {
      legacyRecords.pop();
      excess--;
    }
    while (excess > 0 && companies.length > 0) {
      companies.pop();
      excess--;
    }
    while (excess > 0 && connectors.length > 0) {
      connectors.pop();
      excess--;
    }
    total = nodeCount + excess;
  }

  if (total < nodeCount) {
    const padCount = nodeCount - total;
    for (let p = 1; p <= padCount; p++) {
      const ownerIdx = Math.floor(rng() * members.length);
      const owner = members[ownerIdx] ?? members[0];
      if (owner === undefined) break;
      const branch = pickBranch(rng);
      branchRecords.push({
        node: {
          id: `memory-extra-${p}`,
          kind: "memory",
          ring: owner.ring,
          label: `Journal — ${owner.label}`,
          branch,
        },
        ownerId: owner.id,
      });
    }
  }

  const nodes: CosmosNode[] = [
    ...members,
    ...branchRecords.map((r) => r.node),
    ...companies,
    ...legacyRecords.map((r) => r.node),
    ...connectors,
  ];

  // --- Edges, built AFTER the final node set ---
  const edges: CosmosEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (source: string, target: string, kind: CosmosEdge["kind"]): boolean => {
    if (source === target) return false;
    const key = `${source}|${target}|${kind}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    edges.push({ source, target, kind });
    return true;
  };

  // member -> branch
  for (const record of branchRecords) {
    addEdge(record.ownerId, record.node.id, "branch");
  }
  // member -> legacy mirror
  for (const record of legacyRecords) {
    addEdge(record.ownerId, record.node.id, "branch");
  }

  // member <-> member in the same ring (1-2 each, no duplicates, no self)
  const membersByRing = new Map<RingType, CosmosNode[]>();
  for (const ring of RING_ORDER) membersByRing.set(ring, []);
  for (const m of members) {
    const group = membersByRing.get(m.ring);
    if (group !== undefined) group.push(m);
  }
  const relationshipPairs = new Set<string>();
  for (const member of members) {
    const group = membersByRing.get(member.ring) ?? [];
    const candidates = group.filter((c) => c.id !== member.id);
    if (candidates.length === 0) continue;
    const desired = 1 + Math.floor(rng() * 2);
    const chosen = new Set<number>();
    let attempts = 0;
    while (
      chosen.size < Math.min(desired, candidates.length) &&
      attempts < candidates.length * 4 + 4
    ) {
      attempts++;
      const idx = Math.floor(rng() * candidates.length);
      if (chosen.has(idx)) continue;
      chosen.add(idx);
      const peer = candidates[idx];
      if (peer === undefined) continue;
      const pairKey = [member.id, peer.id].sort().join("|");
      if (relationshipPairs.has(pairKey)) continue;
      relationshipPairs.add(pairKey);
      addEdge(member.id, peer.id, "relationship");
    }
  }

  // member -> connector for ~40% of members
  if (connectors.length > 0) {
    for (const member of members) {
      if (rng() < 0.4) {
        const idx = Math.floor(rng() * connectors.length);
        const connector = connectors[idx];
        if (connector !== undefined) {
          addEdge(member.id, connector.id, "branch");
        }
      }
    }
  }

  // member <-> company (economic), each company gets 2-4 members
  for (const company of companies) {
    if (members.length === 0) break;
    const desired = 2 + Math.floor(rng() * 3);
    const chosen = new Set<number>();
    let attempts = 0;
    while (
      chosen.size < Math.min(desired, members.length) &&
      attempts < members.length * 4 + 4
    ) {
      attempts++;
      const idx = Math.floor(rng() * members.length);
      if (chosen.has(idx)) continue;
      chosen.add(idx);
      const member = members[idx];
      if (member === undefined) continue;
      addEdge(member.id, company.id, "economic");
    }
  }

  // --- Stellar counts (David's law — see stellar.ts) ---
  // friendCount is the member's actual relationship-edge degree in the
  // graph just built: the number of "relationship" edges (member <->
  // member) touching them. Branch/economic edges are not friendships,
  // so they do not count. Computed after all edges exist, as specified.
  const friendDegree = new Map<string, number>();
  for (const edge of edges) {
    if (edge.kind !== "relationship") continue;
    friendDegree.set(edge.source, (friendDegree.get(edge.source) ?? 0) + 1);
    friendDegree.set(edge.target, (friendDegree.get(edge.target) ?? 0) + 1);
  }
  // followerCount is drawn from the same seeded RNG (one draw per
  // member, in member order, after every edge draw — so the graph
  // above is unchanged and the whole dataset stays deterministic per
  // seed). The ^2.5 curve is deliberately skewed: most members have
  // few followers, a rare few have hundreds.
  for (const member of members) {
    member.friendCount = friendDegree.get(member.id) ?? 0;
    member.followerCount = Math.floor(Math.pow(rng(), 2.5) * 500);
  }

  return { nodes, edges };
}
