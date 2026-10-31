/**
 * @omega/ai-core — Oracle answering layer
 *
 * Ring-scoped Oracle: answers a natural-language query only from nodes
 * consented in the caller's active ring, citing them, and refuses — in the
 * Guardian's voice — when the query names a node that lives in a different
 * ring. This is the consent model made tangible: consent does not cross
 * ring boundaries.
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

import type {
  ChatCompletionProvider,
  MetaModelChatRequest,
} from "./meta-model-client.js";

export interface OracleNodeRef {
  id: string;
  label: string;
  ring: RingType;
  kind?: string;
}

export interface OracleCitation {
  id: string;
  label: string;
  ring: RingType;
}

export interface OracleAnswer {
  refused: boolean;
  text: string;
  citations: OracleCitation[];
  backend: "meta-model-api" | "offline-stub" | "guardian";
  /** Model id reported by the provider, when a provider call was made. */
  model?: string;
  activeRing: RingType;
  boundaryRing?: RingType;
}

export interface OracleQueryOptions {
  activeRing: RingType;
  nodes: readonly OracleNodeRef[];
  provider: ChatCompletionProvider;
}

function toCitation(node: OracleNodeRef): OracleCitation {
  return { id: node.id, label: node.label, ring: node.ring };
}

/**
 * A node is "mentioned" when its label (case-insensitive) appears in the
 * query, or its id appears in the query. An empty query mentions nothing.
 */
function isMentioned(node: OracleNodeRef, query: string): boolean {
  if (query.trim() === "") {
    return false;
  }
  if (node.label !== "" && query.toLowerCase().includes(node.label.toLowerCase())) {
    return true;
  }
  if (node.id !== "" && query.includes(node.id)) {
    return true;
  }
  return false;
}

function guardianRefusal(
  node: OracleNodeRef,
  activeRing: RingType,
): OracleAnswer {
  return {
    refused: true,
    text:
      `Guardian: ‘${node.label}’ lives in the ${node.ring} ring. ` +
      `You are asking from the ${activeRing} ring, and consent does not ` +
      `cross ring boundaries — I can't retrieve it. Switch to the ` +
      `${node.ring} ring with the owner's consent to ask about it.`,
    citations: [],
    backend: "guardian",
    activeRing,
    boundaryRing: node.ring,
  };
}

function kindCounts(nodes: readonly OracleNodeRef[]): string {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const kind = node.kind ?? "node";
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`)
    .join(", ");
}

/**
 * Deterministic locally composed answer for the offline-stub backend.
 * The raw stub echo is never surfaced to the caller.
 */
function composeOfflineAnswer(
  activeRing: RingType,
  inRingNodes: readonly OracleNodeRef[],
  matched: readonly OracleNodeRef[],
  cited: readonly OracleNodeRef[],
): string {
  const header =
    `Offline mode: the Meta Model API is not connected, so this answer ` +
    `was composed locally from demo data in the ${activeRing} ring.`;

  if (matched.length > 0) {
    const summary = matched
      .map(
        (node) =>
          `‘${node.label}’${node.kind !== undefined ? ` (${node.kind})` : ""}`,
      )
      .join(", ");
    return (
      `${header} From the consented sources in your ${activeRing} ring: ` +
      `${summary}.`
    );
  }

  const including = cited.map((node) => `‘${node.label}’`).join(", ");
  return (
    `${header} Your ${activeRing} ring holds ${inRingNodes.length} demo ` +
    `node${inRingNodes.length === 1 ? "" : "s"}, including ${including}. ` +
    `By kind: ${kindCounts(inRingNodes)}.`
  );
}

function composeEmptyRingAnswer(activeRing: RingType): string {
  return (
    `Offline mode: the Meta Model API is not connected, so this answer ` +
    `was composed locally from demo data. Your ${activeRing} ring is ` +
    `empty — it holds no demo nodes, so there is nothing consented in ` +
    `this ring for the Oracle to answer from.`
  );
}

/**
 * Answer a query from the Oracle, scoped to `options.activeRing`.
 *
 * - If the query mentions a node in any other ring, the Guardian refuses
 *   (the provider is never called).
 * - Otherwise a grounded chat request — listing only in-ring nodes — is
 *   sent to the provider. A live ("meta-model-api") response passes
 *   through; an "offline-stub" response is replaced with a deterministic
 *   locally composed summary of the cited in-ring nodes.
 */
export async function answerOracleQuery(
  query: string,
  options: OracleQueryOptions,
): Promise<OracleAnswer> {
  const { activeRing, nodes, provider } = options;

  const mentioned = nodes.filter((node) => isMentioned(node, query));

  // Guardian refusal takes precedence over everything else, including the
  // empty-ring case: naming an out-of-ring node is a boundary crossing.
  const boundaryNode = mentioned.find((node) => node.ring !== activeRing);
  if (boundaryNode !== undefined) {
    return guardianRefusal(boundaryNode, activeRing);
  }

  const inRingNodes = nodes.filter((node) => node.ring === activeRing);

  if (inRingNodes.length === 0) {
    return {
      refused: false,
      text: composeEmptyRingAnswer(activeRing),
      citations: [],
      backend: "offline-stub",
      activeRing,
    };
  }

  const matched = mentioned.filter((node) => node.ring === activeRing);
  const cited = matched.length > 0 ? matched : inRingNodes.slice(0, 3);
  const citations = cited.map(toCitation);

  const sourceList = cited
    .map((node) => `- ${node.label} (id: ${node.id})`)
    .join("\n");

  const request: MetaModelChatRequest = {
    messages: [
      {
        role: "system",
        content:
          `You are the Oracle for the Omega Platform. Answer only from ` +
          `the listed consented sources in the '${activeRing}' ring, and ` +
          `cite them. Do not use or mention any source outside that ring.`,
      },
      {
        role: "user",
        content:
          `Question: ${query}\n\n` +
          `Consented sources in the '${activeRing}' ring:\n${sourceList}`,
      },
    ],
  };

  const response = await provider.chat(request);

  if (response.backend === "meta-model-api") {
    return {
      refused: false,
      text: response.content,
      citations,
      backend: "meta-model-api",
      model: response.model,
      activeRing,
    };
  }

  return {
    refused: false,
    text: composeOfflineAnswer(activeRing, inRingNodes, matched, cited),
    citations,
    backend: "offline-stub",
    model: response.model,
    activeRing,
  };
}
