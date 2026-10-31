/**
 * @omega/mcp-gateway — GitHub adapter (synthetic fixtures)
 *
 * Fixture data only — shaped like GitHub REST API responses for a
 * fictional demo org. No live GitHub calls are made anywhere.
 * All fixture content is fictional / synthetic.
 *
 * Creator: David Charles Bourassa
 */

import { ToolError, type ToolDefinition } from "../registry.js";

// ---------------------------------------------------------------------------
// Synthetic fixtures — fictional demo org "omega-demo-org"
// ---------------------------------------------------------------------------

export interface GithubRepoFixture {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string; id: number; type: string };
  html_url: string;
  description: string;
  fork: boolean;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
  synthetic: true;
}

export const GITHUB_FIXTURE_OWNER = "omega-demo-org";

export const GITHUB_FIXTURE_REPOS: readonly GithubRepoFixture[] = [
  {
    id: 900001,
    name: "omega-platform",
    full_name: "omega-demo-org/omega-platform",
    private: false,
    owner: { login: "omega-demo-org", id: 990001, type: "Organization" },
    html_url: "#",
    description: "Synthetic fixture repo — the Omega Platform monorepo (fictional demo data).",
    fork: false,
    stargazers_count: 128,
    watchers_count: 128,
    forks_count: 12,
    open_issues_count: 2,
    language: "TypeScript",
    default_branch: "main",
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
    synthetic: true,
  },
  {
    id: 900002,
    name: "omega-cosmos",
    full_name: "omega-demo-org/omega-cosmos",
    private: false,
    owner: { login: "omega-demo-org", id: 990001, type: "Organization" },
    html_url: "#",
    description: "Synthetic fixture repo — cosmos engine experiments (fictional demo data).",
    fork: false,
    stargazers_count: 42,
    watchers_count: 42,
    forks_count: 3,
    open_issues_count: 1,
    language: "TypeScript",
    default_branch: "main",
    created_at: "2026-02-14T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
    synthetic: true,
  },
  {
    id: 900003,
    name: "omega-garden",
    full_name: "omega-demo-org/omega-garden",
    private: false,
    owner: { login: "omega-demo-org", id: 990001, type: "Organization" },
    html_url: "#",
    description: "Synthetic fixture repo — Eternal Garden demo assets (fictional demo data).",
    fork: false,
    stargazers_count: 7,
    watchers_count: 7,
    forks_count: 0,
    open_issues_count: 0,
    language: "JavaScript",
    default_branch: "main",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-09-30T00:00:00Z",
    synthetic: true,
  },
] as const;

export interface GithubIssueFixture {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: { login: string };
  labels: { name: string }[];
  body: string;
  created_at: string;
  repo: string;
  synthetic: true;
}

export const GITHUB_FIXTURE_ISSUES: readonly GithubIssueFixture[] = [
  {
    id: 910001,
    number: 1,
    title: "Fixture: wire discover method into demo",
    state: "open",
    html_url: "#",
    user: { login: "demo-ada" },
    labels: [{ name: "enhancement" }],
    body: "Synthetic fixture issue body — fictional demo data only.",
    created_at: "2026-10-01T00:00:00Z",
    repo: "omega-demo-org/omega-platform",
    synthetic: true,
  },
  {
    id: 910002,
    number: 2,
    title: "Fixture: document receipt gating",
    state: "closed",
    html_url: "#",
    user: { login: "demo-ben" },
    labels: [{ name: "docs" }],
    body: "Synthetic fixture issue body — fictional demo data only.",
    created_at: "2026-10-02T00:00:00Z",
    repo: "omega-demo-org/omega-platform",
    synthetic: true,
  },
  {
    id: 910003,
    number: 1,
    title: "Fixture: starfield palette pass",
    state: "open",
    html_url: "#",
    user: { login: "demo-ada" },
    labels: [{ name: "design" }],
    body: "Synthetic fixture issue body — fictional demo data only.",
    created_at: "2026-10-03T00:00:00Z",
    repo: "omega-demo-org/omega-cosmos",
    synthetic: true,
  },
] as const;

export interface GithubReleaseFixture {
  id: number;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  body: string;
  created_at: string;
  published_at: string;
  repo: string;
  synthetic: true;
}

export const GITHUB_FIXTURE_RELEASES: readonly GithubReleaseFixture[] = [
  {
    id: 920001,
    tag_name: "v0.1.0-demo",
    name: "Demo v0.1.0 (synthetic fixture)",
    draft: false,
    prerelease: true,
    html_url: "#",
    body: "Synthetic fixture release notes — fictional demo data only.",
    created_at: "2026-10-10T00:00:00Z",
    published_at: "2026-10-10T00:00:00Z",
    repo: "omega-demo-org/omega-platform",
    synthetic: true,
  },
  {
    id: 920002,
    tag_name: "v0.0.1-demo",
    name: "Demo v0.0.1 (synthetic fixture)",
    draft: false,
    prerelease: true,
    html_url: "#",
    body: "Synthetic fixture release notes — fictional demo data only.",
    created_at: "2026-09-01T00:00:00Z",
    published_at: "2026-09-01T00:00:00Z",
    repo: "omega-demo-org/omega-cosmos",
    synthetic: true,
  },
] as const;

function resolveRepo(value: unknown, tool: string): GithubRepoFixture {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${tool} requires a non-empty string repo (name or full_name)`);
  }
  const needle = value.trim();
  const repo = GITHUB_FIXTURE_REPOS.find((r) => r.name === needle || r.full_name === needle);
  if (repo === undefined) {
    throw new ToolError(`Unknown repo: ${needle}`);
  }
  return repo;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function createGithubTools(): ToolDefinition[] {
  return [
    {
      name: "github.listRepos",
      description:
        "List repositories for the fictional omega-demo-org from synthetic GitHub fixtures (no live GitHub calls).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      adapter: "github",
      requiresReceipt: true,
      riskLevel: "low",
      handler: () => ({ repos: [...GITHUB_FIXTURE_REPOS], count: GITHUB_FIXTURE_REPOS.length, synthetic: true }),
    },
    {
      name: "github.getRepo",
      description:
        "Get one repository by name or full_name from synthetic GitHub fixtures (fictional demo data, no live GitHub calls).",
      inputSchema: {
        type: "object",
        properties: { repo: { type: "string", minLength: 1 } },
        required: ["repo"],
        additionalProperties: false,
      },
      adapter: "github",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { repo?: unknown }) => resolveRepo(args?.repo, "github.getRepo"),
    },
    {
      name: "github.listIssues",
      description:
        "List issues from synthetic GitHub fixtures, optionally filtered by repo and state (fictional demo data, no live GitHub calls).",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", minLength: 1 },
          state: { type: "string", enum: ["open", "closed"] },
        },
        additionalProperties: false,
      },
      adapter: "github",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { repo?: unknown; state?: unknown }) => {
        let fullName: string | undefined;
        if (args?.repo !== undefined) {
          fullName = resolveRepo(args.repo, "github.listIssues").full_name;
        }
        const state = args?.state;
        if (state !== undefined && state !== "open" && state !== "closed") {
          throw new ToolError('github.listIssues state must be "open" or "closed"');
        }
        const issues = GITHUB_FIXTURE_ISSUES.filter(
          (issue) =>
            (fullName === undefined || issue.repo === fullName) && (state === undefined || issue.state === state),
        );
        return { issues: [...issues], count: issues.length, synthetic: true };
      },
    },
    {
      name: "github.listReleases",
      description:
        "List releases for a repository from synthetic GitHub fixtures (fictional demo data, no live GitHub calls).",
      inputSchema: {
        type: "object",
        properties: { repo: { type: "string", minLength: 1 } },
        required: ["repo"],
        additionalProperties: false,
      },
      adapter: "github",
      requiresReceipt: true,
      riskLevel: "low",
      handler: (args: { repo?: unknown }) => {
        const repo = resolveRepo(args?.repo, "github.listReleases");
        const releases = GITHUB_FIXTURE_RELEASES.filter((r) => r.repo === repo.full_name);
        return { releases: [...releases], count: releases.length, synthetic: true };
      },
    },
  ];
}
