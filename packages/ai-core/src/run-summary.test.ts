import { describe, expect, it } from "vitest";

import { MetaModelClient } from "./meta-model-client.js";
import type { MetaModelFetchFn } from "./meta-model-client.js";
import type { ChatCompletionProvider } from "./meta-model-client.js";
import {
  capSummaryText,
  historyByAgent,
  historyForAgent,
  summarizeRun,
  templateRunSummaryText,
} from "./run-summary.js";
import type { RunSummaryInput } from "./run-summary.js";

// Dummy fixture string — not a real credential (see oracle-live.test.ts).
const TEST_KEY = "test-key-not-a-real-credential";
const NOW = new Date("2026-10-27T12:00:00.000Z");

function fabricatedRun(): RunSummaryInput {
  return {
    id: "run:plan:test:2026-10-27T12:00:00.000Z",
    planId: "plan:test",
    goal: "Research solar evidence",
    status: "completed",
    startedAt: "2026-10-27T12:00:00.000Z",
    finishedAt: "2026-10-27T12:01:00.000Z",
    receipts: [
      {
        stepId: "s1",
        agentId: "steward",
        outcome: "executed",
        artifacts: [{ kind: "community", id: "terra-tech", title: "Terra Tech Commons" }],
      },
      {
        stepId: "s2",
        agentId: "terra-research",
        outcome: "executed",
        artifacts: [{ kind: "tool-result", id: "notes.search:s2", title: "notes.search result" }],
      },
      {
        stepId: "s3",
        agentId: "terra-research",
        outcome: "vetoed",
        artifacts: [],
      },
      {
        stepId: "s4",
        agentId: "terra-archivist",
        outcome: "denied",
        artifacts: [],
      },
    ],
  };
}

describe("summarizeRun — template path", () => {
  it("is deterministic from a fabricated run and labeled template", async () => {
    const run = fabricatedRun();
    const a = await summarizeRun(run, { now: NOW });
    const b = await summarizeRun(run, { now: NOW });
    expect(a).toEqual(b);
    expect(a.source).toBe("template");
    expect(a.modelId).toBeUndefined();
    expect(a.at).toBe(NOW.toISOString());
    expect(a.text).toBe(templateRunSummaryText(run));
    expect(a.text).toContain("2 of 4 steps executed");
    expect(a.text).toContain("1 vetoed");
    expect(a.text).toContain("1 refused (1 denied, 0 error)");
    expect(a.text).toContain("steward, terra-research, terra-archivist");
    expect(a.text).toContain("Artifacts produced: 2");
  });

  it("a keyless MetaModelClient still yields the template, never live", async () => {
    const explodingFetch: MetaModelFetchFn = async () => {
      throw new Error("fetch must not be called without an API key");
    };
    const client = new MetaModelClient({ apiKey: "", fetchFn: explodingFetch });
    const summary = await summarizeRun(fabricatedRun(), { client, now: NOW });
    expect(summary.source).toBe("template");
    expect(summary.text).toBe(templateRunSummaryText(fabricatedRun()));
  });
});

describe("summarizeRun — live path (mock-fetch)", () => {
  it("labels a successful live summary as live with the answering model", async () => {
    const fetchFn: MetaModelFetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: "muse-spark-1.3",
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "The run completed its solar research goal, executing two steps and producing a community and a search result. One step was vetoed and one was refused at the policy bound.",
            },
          },
        ],
      }),
    });
    const client = new MetaModelClient({ apiKey: TEST_KEY, fetchFn });
    const summary = await summarizeRun(fabricatedRun(), { client, now: NOW });
    expect(summary.source).toBe("live");
    expect(summary.modelId).toBe("muse-spark-1.3");
    expect(summary.text).toContain("The run completed its solar research goal");
  });

  it("falls back to template TEXT with source template on any live failure", async () => {
    const failing: ChatCompletionProvider = {
      chat: async () => {
        throw new Error("HTTP 500 from the model API");
      },
    };
    const summary = await summarizeRun(fabricatedRun(), {
      client: failing,
      now: NOW,
    });
    expect(summary.source).toBe("template");
    expect(summary.text).toBe(templateRunSummaryText(fabricatedRun()));

    const emptyLive: ChatCompletionProvider = {
      chat: async () => ({
        model: "muse-spark-1.3",
        content: "   ",
        backend: "meta-model-api" as const,
      }),
    };
    const emptySummary = await summarizeRun(fabricatedRun(), {
      client: emptyLive,
      now: NOW,
    });
    expect(emptySummary.source).toBe("template");
  });

  it("caps long live summaries at ~600 chars, cleanly", async () => {
    const long = "word ".repeat(300).trim();
    const chatty: ChatCompletionProvider = {
      chat: async () => ({
        model: "muse-spark-1.3",
        content: long,
        backend: "meta-model-api" as const,
      }),
    };
    const summary = await summarizeRun(fabricatedRun(), {
      client: chatty,
      now: NOW,
    });
    expect(summary.source).toBe("live");
    expect(summary.text.length).toBeLessThanOrEqual(600);
    expect(summary.text.endsWith("…")).toBe(true);
    expect(capSummaryText("short").length).toBe(5);
  });
});

describe("historyForAgent / historyByAgent", () => {
  it("groups runs per agent, newest first, with counts and summaries", async () => {
    const older = fabricatedRun();
    const newer: RunSummaryInput = {
      ...fabricatedRun(),
      id: "run:plan:test:2026-10-27T13:00:00.000Z",
      finishedAt: "2026-10-27T13:01:00.000Z",
      startedAt: "2026-10-27T13:00:00.000Z",
      summary: {
        text: "Second run summary.",
        source: "template",
        at: "2026-10-27T13:01:00.000Z",
      },
    };
    const history = historyForAgent([older, newer], "terra-research");
    expect(history.runCount).toBe(2);
    expect(history.executed).toBe(2);
    expect(history.vetoed).toBe(2);
    expect(history.entries[0]?.runId).toBe(newer.id);
    expect(history.entries[1]?.runId).toBe(older.id);
    expect(history.lastSummary?.text).toBe("Second run summary.");
    // Defensive: a run whose summary is not attached yet still counts.
    expect(history.entries[1]?.summary).toBeUndefined();

    const byAgent = historyByAgent([older, newer]);
    expect(Object.keys(byAgent).sort()).toEqual([
      "steward",
      "terra-archivist",
      "terra-research",
    ]);
    expect(byAgent["steward"]?.runCount).toBe(2);
    expect(historyForAgent([older], "nobody").runCount).toBe(0);
  });
});
