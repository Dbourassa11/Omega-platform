/**
 * @omega/mcp-gateway — meta-export adapter
 *
 * Exposes a parsed Facebook DYI member graph (from @omega/meta-export)
 * as gateway tools. Works over any NormalizedMemberGraph — synthetic
 * fixture or a real parsed export supplied by the caller.
 *
 * Creator: David Charles Bourassa
 */

import { RING_TYPES, type RingType } from "@omega/consent-core";
import type { NormalizedMemberGraph } from "@omega/meta-export";

import { ToolError, type ToolDefinition } from "../registry.js";

const NO_ARGS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

function isRingType(value: unknown): value is RingType {
  return typeof value === "string" && (RING_TYPES as readonly string[]).includes(value);
}

export function createMetaExportTools(graph: NormalizedMemberGraph): ToolDefinition[] {
  return [
    {
      name: "graph.summary",
      description: "Summarize the member graph: owner, ring counts, and content totals.",
      inputSchema: NO_ARGS_SCHEMA,
      handler: () => ({
        ownerName: graph.ownerName,
        synthetic: graph.synthetic,
        peoplePerRing: graph.summary.peoplePerRing,
        postCount: graph.summary.postCount,
        mediaCount: graph.summary.mediaCount,
        threadCount: graph.summary.threadCount,
        unclassifiedCount: graph.summary.unclassifiedCount,
      }),
    },
    {
      name: "graph.listPeople",
      description: "List people in the member graph, optionally filtered by consent ring, sorted by name.",
      inputSchema: {
        type: "object",
        properties: {
          ring: { type: "string", enum: [...RING_TYPES] },
        },
        additionalProperties: false,
      },
      handler: (args: { ring?: unknown }) => {
        const ring = args?.ring;
        if (ring !== undefined && !isRingType(ring)) {
          throw new ToolError(`Invalid ring: ${JSON.stringify(ring)} (expected one of ${RING_TYPES.join(", ")})`);
        }
        const people = graph.people
          .filter((person) => ring === undefined || person.ring === ring)
          .map((person) => ({
            id: person.id,
            name: person.name,
            ring: person.ring,
            ringSource: person.ringSource,
            messageCount: person.messageCount,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return { people };
      },
    },
    {
      name: "graph.searchPosts",
      description: "Case-insensitive substring search over post text and titles.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1 },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: (args: { query?: unknown }) => {
        const query = args?.query;
        if (typeof query !== "string" || query.trim().length === 0) {
          throw new ToolError("graph.searchPosts requires a non-empty string query");
        }
        const needle = query.toLowerCase();
        const matches = graph.posts
          .filter((post) => `${post.title ?? ""}\n${post.text}`.toLowerCase().includes(needle))
          .map((post) => ({
            id: post.id,
            timestamp: post.timestamp,
            text: post.text,
            ring: post.ring,
          }));
        return { matches, count: matches.length };
      },
    },
  ];
}
