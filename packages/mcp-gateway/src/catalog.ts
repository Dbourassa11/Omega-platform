/**
 * @omega/mcp-gateway — pure adapter catalog
 *
 * Metadata-only catalog of every adapter and its tools. This module
 * has NO runtime imports (type-only declarations only) so browser
 * code can import it via the "./catalog" subpath without pulling in
 * any node code.
 *
 * Creator: David Charles Bourassa
 */

export type CatalogAdapterStatus = "working" | "sandbox" | "stub";

export type CatalogRiskLevel = "low" | "medium" | "high";

export interface CatalogTool {
  name: string;
  description: string;
  requiresReceipt: boolean;
  riskLevel: CatalogRiskLevel;
}

export interface CatalogAdapter {
  id: string;
  displayName: string;
  status: CatalogAdapterStatus;
  tools: CatalogTool[];
}

export const ADAPTER_CATALOG: readonly CatalogAdapter[] = [
  {
    id: "meta-export",
    displayName: "Meta/Facebook Export",
    status: "working",
    tools: [
      {
        name: "graph.summary",
        description: "Summarize the member graph: owner, ring counts, and content totals.",
        requiresReceipt: false,
        riskLevel: "low",
      },
      {
        name: "graph.listPeople",
        description: "List people in the member graph, optionally filtered by consent ring, sorted by name.",
        requiresReceipt: false,
        riskLevel: "low",
      },
      {
        name: "graph.searchPosts",
        description: "Case-insensitive substring search over post text and titles.",
        requiresReceipt: false,
        riskLevel: "low",
      },
    ],
  },
  {
    id: "notes",
    displayName: "Notes",
    status: "working",
    tools: [
      {
        name: "notes.list",
        description: "List notes with their ids and titles.",
        requiresReceipt: false,
        riskLevel: "low",
      },
      {
        name: "notes.search",
        description: "Case-insensitive line search over note bodies; returns the first matching line per note as an excerpt.",
        requiresReceipt: false,
        riskLevel: "low",
      },
      {
        name: "notes.get",
        description: "Fetch one note's full markdown by id.",
        requiresReceipt: false,
        riskLevel: "low",
      },
    ],
  },
  {
    id: "files",
    displayName: "Files",
    status: "working",
    tools: [
      {
        name: "files.list",
        description: "List files exposed by the provider, with sizes in bytes.",
        requiresReceipt: false,
        riskLevel: "low",
      },
      {
        name: "files.read",
        description: "Read one text file by provider-relative path.",
        requiresReceipt: false,
        riskLevel: "low",
      },
      {
        name: "files.search",
        description: "Case-insensitive line search across the provider's text files; returns the first matching line per file as an excerpt.",
        requiresReceipt: false,
        riskLevel: "low",
      },
    ],
  },
  {
    id: "github",
    displayName: "GitHub",
    status: "working",
    tools: [
      {
        name: "github.listRepos",
        description:
          "List repositories for the fictional omega-demo-org from synthetic GitHub fixtures (no live GitHub calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
      {
        name: "github.getRepo",
        description:
          "Get one repository by name or full_name from synthetic GitHub fixtures (fictional demo data, no live GitHub calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
      {
        name: "github.listIssues",
        description:
          "List issues from synthetic GitHub fixtures, optionally filtered by repo and state (fictional demo data, no live GitHub calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
      {
        name: "github.listReleases",
        description:
          "List releases for a repository from synthetic GitHub fixtures (fictional demo data, no live GitHub calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
    ],
  },
  {
    id: "notion",
    displayName: "Notion",
    status: "working",
    tools: [
      {
        name: "notion.search",
        description:
          "Search synthetic Notion fixtures by title across pages and data sources (Notion API 2026-03-11 shapes, fictional data, no live Notion calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
      {
        name: "notion.queryDataSource",
        description:
          "Query synthetic Notion data-source rows filtered by Status select equals (fixtures mirror POST /v1/data_sources/{id}/query, Notion API 2026-03-11; no live Notion calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
      {
        name: "notion.getPage",
        description:
          "Get one page by id from synthetic Notion fixtures (Notion API 2026-03-11 page shape, fictional data, no live Notion calls).",
        requiresReceipt: true,
        riskLevel: "low",
      },
    ],
  },
  {
    id: "stripe",
    displayName: "Stripe",
    status: "sandbox",
    tools: [
      {
        name: "stripe.listDispersionEvents",
        description: "SANDBOX fixture — no live Stripe calls. List synthetic Stripe dispersion events (livemode: false).",
        requiresReceipt: true,
        riskLevel: "low",
      },
      {
        name: "stripe.getBalanceSummary",
        description: "SANDBOX fixture — no live Stripe calls. Get a synthetic Stripe balance summary (livemode: false).",
        requiresReceipt: true,
        riskLevel: "medium",
      },
    ],
  },
  { id: "aws", displayName: "AWS", status: "stub", tools: [] },
  { id: "cloudflare", displayName: "Cloudflare", status: "stub", tools: [] },
  { id: "huggingface", displayName: "Hugging Face", status: "stub", tools: [] },
  { id: "homeassistant", displayName: "Home Assistant", status: "stub", tools: [] },
] as const;
