/**
 * @omega/mcp-gateway — Notion adapter (synthetic fixtures)
 *
 * Fixture data only — mirrors the CURRENT Notion API (version
 * 2026-03-11) object shapes. No live Notion calls are made anywhere.
 * All fixture content is fictional / synthetic; URLs are "#" fixtures.
 *
 * Live path (NOT implemented — fixtures only):
 * - Send header `Notion-Version: 2026-03-11` on every request.
 * - Query rows via `POST /v1/data_sources/{id}/query`.
 * - Authenticate via an OAuth public connection (authorization-code
 *   flow with PKCE; see src/infra.ts for the PKCE helpers).
 *
 * Creator: David Charles Bourassa
 */

import { ToolError, type ToolDefinition } from "../registry.js";

// ---------------------------------------------------------------------------
// Synthetic fixtures — Notion API version 2026-03-11 shapes
// ---------------------------------------------------------------------------

type NotionTitleSegment = { type: "text"; text: { content: string } };

export interface NotionPageFixture {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  properties: Record<string, unknown>;
  synthetic: true;
}

export interface NotionDataSourceFixture {
  object: "data_source";
  id: string;
  created_time: string;
  last_edited_time: string;
  title: NotionTitleSegment[];
  url: string;
  synthetic: true;
}

function titleProperty(content: string): Record<string, unknown> {
  return {
    id: "title",
    type: "title",
    title: [{ type: "text", text: { content } }] as NotionTitleSegment[],
  };
}

function selectProperty(name: string): Record<string, unknown> {
  return { id: "status", type: "select", select: { id: `sel-${name.toLowerCase().replace(/\s+/g, "-")}`, name } };
}

export const NOTION_PROJECT_TRACKER_ID = "ds-00000000-0000-4000-8000-000000000001";

export const NOTION_FIXTURE_DATA_SOURCES: readonly NotionDataSourceFixture[] = [
  {
    object: "data_source",
    id: NOTION_PROJECT_TRACKER_ID,
    created_time: "2026-01-15T00:00:00.000Z",
    last_edited_time: "2026-10-20T00:00:00.000Z",
    title: [{ type: "text", text: { content: "Project Tracker" } }],
    url: "#",
    synthetic: true,
  },
] as const;

/** Standalone pages (not data-source rows). */
export const NOTION_FIXTURE_PAGES: readonly NotionPageFixture[] = [
  {
    object: "page",
    id: "pg-00000000-0000-4000-8000-000000000101",
    created_time: "2026-02-01T00:00:00.000Z",
    last_edited_time: "2026-10-01T00:00:00.000Z",
    archived: false,
    url: "#",
    properties: { Name: titleProperty("Omega Launch Plan (synthetic fixture)") },
    synthetic: true,
  },
  {
    object: "page",
    id: "pg-00000000-0000-4000-8000-000000000102",
    created_time: "2026-02-05T00:00:00.000Z",
    last_edited_time: "2026-10-02T00:00:00.000Z",
    archived: false,
    url: "#",
    properties: { Name: titleProperty("Garden Notes (synthetic fixture)") },
    synthetic: true,
  },
] as const;

/** Rows of the Project Tracker data source — page objects with typed properties. */
export const NOTION_PROJECT_TRACKER_ROWS: readonly NotionPageFixture[] = [
  {
    object: "page",
    id: "pg-00000000-0000-4000-8000-000000000201",
    created_time: "2026-03-01T00:00:00.000Z",
    last_edited_time: "2026-10-10T00:00:00.000Z",
    archived: false,
    url: "#",
    properties: {
      Name: titleProperty("Ship MCP gateway fixtures"),
      Status: selectProperty("In Progress"),
    },
    synthetic: true,
  },
  {
    object: "page",
    id: "pg-00000000-0000-4000-8000-000000000202",
    created_time: "2026-03-02T00:00:00.000Z",
    last_edited_time: "2026-10-11T00:00:00.000Z",
    archived: false,
    url: "#",
    properties: {
      Name: titleProperty("Draft demo script"),
      Status: selectProperty("Done"),
    },
    synthetic: true,
  },
  {
    object: "page",
    id: "pg-00000000-0000-4000-8000-000000000203",
    created_time: "2026-03-03T00:00:00.000Z",
    last_edited_time: "2026-10-12T00:00:00.000Z",
    archived: false,
    url: "#",
    properties: {
      Name: titleProperty("Review receipt gating"),
      Status: selectProperty("In Progress"),
    },
    synthetic: true,
  },
] as const;

const ALL_PAGES: readonly NotionPageFixture[] = [...NOTION_FIXTURE_PAGES, ...NOTION_PROJECT_TRACKER_ROWS];

function pageTitle(page: NotionPageFixture): string {
  const nameProp = page.properties["Name"] as { title?: NotionTitleSegment[] } | undefined;
  return (nameProp?.title ?? []).map((seg) => seg.text.content).join("");
}

function dataSourceTitle(ds: NotionDataSourceFixture): string {
  return ds.title.map((seg) => seg.text.content).join("");
}

function rowStatus(page: NotionPageFixture): string | undefined {
  const statusProp = page.properties["Status"] as { select?: { name?: string } | null } | undefined;
  return statusProp?.select?.name;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function createNotionTools(): ToolDefinition[] {
  return [
    {
      name: "notion.search",
      description:
        "Search synthetic Notion fixtures by title across pages and data sources (Notion API 2026-03-11 shapes, fictional data, no live Notion calls).",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false,
      },
      adapter: "notion",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { query?: unknown }) => {
        const query = args?.query;
        if (typeof query !== "string" || query.trim().length === 0) {
          throw new ToolError("notion.search requires a non-empty string query");
        }
        const needle = query.toLowerCase();
        const results: unknown[] = [];
        for (const page of ALL_PAGES) {
          if (pageTitle(page).toLowerCase().includes(needle)) results.push(page);
        }
        for (const ds of NOTION_FIXTURE_DATA_SOURCES) {
          if (dataSourceTitle(ds).toLowerCase().includes(needle)) results.push(ds);
        }
        return { results, count: results.length, synthetic: true };
      },
    },
    {
      name: "notion.queryDataSource",
      description:
        "Query synthetic Notion data-source rows filtered by Status select equals (fixtures mirror POST /v1/data_sources/{id}/query, Notion API 2026-03-11; no live Notion calls).",
      inputSchema: {
        type: "object",
        properties: {
          dataSourceId: { type: "string", minLength: 1 },
          status: { type: "string", minLength: 1 },
        },
        required: ["status"],
        additionalProperties: false,
      },
      adapter: "notion",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { dataSourceId?: unknown; status?: unknown }) => {
        const status = args?.status;
        if (typeof status !== "string" || status.trim().length === 0) {
          throw new ToolError("notion.queryDataSource requires a non-empty string status");
        }
        const dataSourceId = args?.dataSourceId ?? NOTION_PROJECT_TRACKER_ID;
        if (dataSourceId !== NOTION_PROJECT_TRACKER_ID) {
          throw new ToolError(`Unknown data source: ${JSON.stringify(dataSourceId)}`);
        }
        const results = NOTION_PROJECT_TRACKER_ROWS.filter((row) => rowStatus(row) === status);
        return { results: [...results], count: results.length, synthetic: true };
      },
    },
    {
      name: "notion.getPage",
      description:
        "Get one page by id from synthetic Notion fixtures (Notion API 2026-03-11 page shape, fictional data, no live Notion calls).",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"],
        additionalProperties: false,
      },
      adapter: "notion",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { id?: unknown }) => {
        const id = args?.id;
        if (typeof id !== "string" || id.length === 0) {
          throw new ToolError("notion.getPage requires a non-empty string id");
        }
        const page = ALL_PAGES.find((p) => p.id === id);
        if (page === undefined) {
          throw new ToolError(`Unknown page: ${id}`);
        }
        return page;
      },
    },
  ];
}
