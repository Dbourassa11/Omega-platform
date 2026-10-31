/**
 * @omega/mcp-gateway — GitHub adapter tests (synthetic fixtures)
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import { ToolError, type ToolDefinition } from "../registry.js";
import { createGithubTools, GITHUB_FIXTURE_REPOS } from "./github.js";

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((c) => c.name === name);
  if (tool === undefined) throw new Error(`missing tool: ${name}`);
  return tool;
}

async function run(tools: ToolDefinition[], name: string, args: unknown): Promise<unknown> {
  return findTool(tools, name).handler(args, { toolName: name });
}

describe("createGithubTools over synthetic fixtures", () => {
  const tools = createGithubTools();

  it("registers four receipt-gated tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "github.getRepo",
      "github.listIssues",
      "github.listReleases",
      "github.listRepos",
    ]);
    for (const tool of tools) {
      expect(tool.requiresReceipt).toBe(true);
      expect(tool.adapter).toBe("github");
    }
  });

  it("listRepos returns GitHub-shaped fictional repos", async () => {
    const result = (await run(tools, "github.listRepos", {})) as {
      repos: { name: string; full_name: string; private: boolean; description: string }[];
      count: number;
    };
    expect(result.count).toBe(GITHUB_FIXTURE_REPOS.length);
    const names = result.repos.map((r) => r.name);
    expect(names).toContain("omega-platform");
    expect(names).toContain("omega-cosmos");
    for (const repo of result.repos) {
      expect(repo.private).toBe(false);
      expect(repo.description.toLowerCase()).toMatch(/fixture|synthetic|fictional/);
    }
  });

  it("getRepo resolves by name and full_name, unknown -> ToolError", async () => {
    const byName = (await run(tools, "github.getRepo", { repo: "omega-platform" })) as { full_name: string };
    expect(byName.full_name).toBe("omega-demo-org/omega-platform");
    const byFull = (await run(tools, "github.getRepo", { repo: "omega-demo-org/omega-cosmos" })) as { name: string };
    expect(byFull.name).toBe("omega-cosmos");
    await expect(run(tools, "github.getRepo", { repo: "nope" })).rejects.toBeInstanceOf(ToolError);
  });

  it("listIssues filters by repo and state", async () => {
    const all = (await run(tools, "github.listIssues", {})) as { count: number };
    expect(all.count).toBe(3);
    const open = (await run(tools, "github.listIssues", { repo: "omega-platform", state: "open" })) as {
      issues: { state: string }[];
      count: number;
    };
    expect(open.count).toBe(1);
    expect(open.issues[0]?.state).toBe("open");
  });

  it("listReleases returns releases for a repo", async () => {
    const result = (await run(tools, "github.listReleases", { repo: "omega-platform" })) as {
      releases: { tag_name: string }[];
      count: number;
    };
    expect(result.count).toBe(1);
    expect(result.releases[0]?.tag_name).toBe("v0.1.0-demo");
  });
});
