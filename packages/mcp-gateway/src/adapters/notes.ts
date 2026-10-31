/**
 * @omega/mcp-gateway — notes adapter
 *
 * Exposes a small in-memory set of markdown notes as gateway tools.
 * Titles come from the first "# " heading, falling back to the note id.
 *
 * Creator: David Charles Bourassa
 */

import { ToolError, type ToolDefinition } from "../registry.js";

export interface NoteInput {
  id: string;
  markdown: string;
}

interface ParsedNote {
  id: string;
  title: string;
  markdown: string;
  lines: string[];
}

function parseNote(note: NoteInput): ParsedNote {
  const lines = note.markdown.split(/\r?\n/);
  let title = note.id;
  for (const line of lines) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match?.[1] !== undefined) {
      title = match[1].trim();
      break;
    }
  }
  return { id: note.id, title, markdown: note.markdown, lines };
}

function requireQuery(args: { query?: unknown }, tool: string): string {
  const query = args?.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new ToolError(`${tool} requires a non-empty string query`);
  }
  return query;
}

/** Built-in fictional demo notes (Ada Whitfield / Omega demo world). */
export const DEMO_NOTES: readonly NoteInput[] = [
  {
    id: "ada-garden-log",
    markdown: [
      "# Ada's Garden Log",
      "",
      "The garden tomatoes are finally coming in, three ripe ones today.",
      "Ben Whitfield promised to build a second raised bed before autumn.",
      "Lemon balm is taking over the corner by the fence again.",
    ].join("\n"),
  },
  {
    id: "omega-demo-script",
    markdown: [
      "# Omega Demo Script",
      "",
      "Open on the Eternal Garden: four consent rings around one owner.",
      "The gateway answers tools/list before any data is shown.",
      "Every demo person in this script is fictional, starting with Ada Whitfield.",
    ].join("\n"),
  },
  {
    id: "book-club-notes",
    markdown: [
      "# Book Club Notes",
      "",
      "Ana Silva picked the next novel; Paul Novak brings the questions.",
      "Kate Sullivan argued the slow middle chapter was worth it.",
      "Next meeting moves to the library room on the hill.",
    ].join("\n"),
  },
] as const;

export function createNotesTools(notes: readonly NoteInput[]): ToolDefinition[] {
  const parsed = notes.map(parseNote);
  const byId = new Map(parsed.map((note) => [note.id, note]));

  return [
    {
      name: "notes.list",
      description: "List notes with their ids and titles.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () => parsed.map((note) => ({ id: note.id, title: note.title })),
    },
    {
      name: "notes.search",
      description: "Case-insensitive line search over note bodies; returns the first matching line per note as an excerpt.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false,
      },
      handler: (args: { query?: unknown }) => {
        const query = requireQuery(args, "notes.search");
        const needle = query.toLowerCase();
        const results: { id: string; title: string; excerpt: string }[] = [];
        for (const note of parsed) {
          const line = note.lines.find((candidate) => candidate.toLowerCase().includes(needle));
          if (line !== undefined) {
            results.push({ id: note.id, title: note.title, excerpt: line.trim().slice(0, 160) });
          }
        }
        return results;
      },
    },
    {
      name: "notes.get",
      description: "Fetch one note's full markdown by id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"],
        additionalProperties: false,
      },
      handler: (args: { id?: unknown }) => {
        const id = args?.id;
        if (typeof id !== "string" || id.length === 0) {
          throw new ToolError("notes.get requires a non-empty string id");
        }
        const note = byId.get(id);
        if (note === undefined) {
          throw new ToolError(`Unknown note: ${id}`);
        }
        return { id: note.id, title: note.title, markdown: note.markdown };
      },
    },
  ];
}
