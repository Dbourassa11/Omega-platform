/**
 * @omega/ai-core — Live Omni planner over the Meta Model API
 * (Phase 4, Alive Pass)
 *
 * `createLivePlanner` asks a Meta Model client to draft an OmniPlan
 * for a goal, then treats the model's output as UNTRUSTED input: the
 * text must extract as JSON, parse, and pass `validatePlanCandidate`
 * against the injected validation context before it becomes a plan.
 * Any failure throws a `PlanRejectedError` carrying every reason —
 * loudly, on the error object — with NO silent fallback to the
 * offline plan (a rejected live draft must surface as a rejection,
 * never as a quietly different plan). A successful draft is still
 * only "proposed": human approval (`approvePlan`) is required before
 * anything executes.
 *
 * `createOmniPlanner` is the factory the hosts use: it returns the
 * live planner when `getMetaApiStatus()` reports a configured key,
 * and an async wrapper over the deterministic offline planner
 * otherwise — the same async surface either way. No key is ever
 * invented, hardcoded, or requested here; activation is env-only.
 *
 * Creator: David Charles Bourassa
 */

import { RING_TYPES } from "@omega/consent-core";
import { fnv1a32 } from "@omega/legacy-engine";
import { POLICY_ACTIONS } from "@omega/policy-engine";

import { getMetaApiStatus } from "./meta-api-config.js";
import type { MetaApiEnv } from "./meta-api-config.js";
import type { ChatCompletionProvider } from "./meta-model-client.js";
import { MetaModelClient } from "./meta-model-client.js";
import { createOfflinePlanner } from "./planner.js";
import type { OmniPlan } from "./planner.js";
import { validatePlanCandidate } from "./plan-validator.js";
import type {
  PlanValidationContext,
  PlanValidationResult,
} from "./plan-validator.js";
import { OMNI_PACKAGE_ACTIONS } from "./registry.js";

/**
 * A live planner draft was rejected. `errors` carries ALL reasons:
 * for a parse failure, the JSON parse reason; for a validation
 * failure, every validator error (each naming its step index).
 * `kind` distinguishes the two rejection stages.
 */
export class PlanRejectedError extends Error {
  readonly kind: "parse" | "validation" | "transport";
  readonly errors: readonly string[];

  constructor(
    kind: "parse" | "validation" | "transport",
    errors: readonly string[],
  ) {
    super(
      `Live planner output rejected (${kind}): ${errors.join("; ")}`,
    );
    this.name = "PlanRejectedError";
    this.kind = kind;
    this.errors = Object.freeze([...errors]);
  }
}

/** The validation context, or a provider resolved fresh per plan. */
export type ValidationContextSource =
  | PlanValidationContext
  | (() => PlanValidationContext);

function resolveContext(
  source: ValidationContextSource,
): PlanValidationContext {
  return typeof source === "function"
    ? (source as () => PlanValidationContext)()
    : source;
}

export interface LivePlanner {
  readonly mode: "live";
  readonly modelId: string;
  plan(goal: string, now?: Date): Promise<OmniPlan>;
}

export interface CreateLivePlannerOptions {
  client: ChatCompletionProvider;
  validationContext: ValidationContextSource;
  modelId?: string;
}

function buildSystemPrompt(ctx: PlanValidationContext): string {
  const agents = [...ctx.knownAgentIds];
  const tools = [...ctx.knownToolIds];
  const actions = [...(ctx.knownActionIds ?? OMNI_PACKAGE_ACTIONS)];
  const proposable = [...(ctx.knownAgentDefinitions ?? [])]
    .map((d) => d.id)
    .filter((id) => !agents.includes(id));
  return [
    "You are the Omni planner for the Omega Platform. Draft an execution plan for the user's goal as JSON ONLY — no prose, no markdown fences, no commentary.",
    "",
    "Output shape (exactly this schema):",
    '{ "goal": string, "steps": [ { "id": string, "agentId": string, "kind": "tool" | "action", "toolId": string (tool steps only), "actionId": string (action steps only), "args": object (optional), "purpose": string, "ringScope": string, "resourceId": string, "action": string, "expectedArtifacts": string[] } ] }',
    "",
    `Registered agents you may assign steps to: ${agents.join(", ") || "(none)"}.`,
    proposable.length > 0
      ? `Agents you may CREATE via an "agents.propose" action step (args: { "agents": ["<id>"] }): ${proposable.join(", ")}. A proposed agent may only be used by steps AFTER the proposing step.`
      : "You may not propose new agents in this plan.",
    `Gateway tools (tool steps, toolId must be one of): ${tools.join(", ")}.`,
    `Package actions (action steps, actionId must be one of): ${actions.join(", ")}.`,
    `ringScope must be one of: ${RING_TYPES.join(", ")}.`,
    `action (the policy action) must be one of: ${POLICY_ACTIONS.join(", ")}.`,
    "Every step needs a non-empty resourceId (e.g. \"evidence:notes\"), a purpose sentence, and the artifacts it is expected to produce.",
    "Use ONLY the agents, tools, and actions listed above — ids outside these lists are rejected. Order steps so each step's agent already exists (registered, or proposed by an earlier step) when the step runs.",
  ].join("\n");
}

/** Extract the JSON document from model text, tolerating code fences. */
export function extractPlanJson(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  if (fence && fence[1] !== undefined) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function createLivePlanner(
  opts: CreateLivePlannerOptions,
): LivePlanner {
  const modelId =
    opts.modelId ??
    (opts.client instanceof MetaModelClient
      ? opts.client.configuredModel
      : undefined) ??
    getMetaApiStatus().chatModel;

  return {
    mode: "live",
    modelId,
    async plan(goal: string, now?: Date): Promise<OmniPlan> {
      const ctx = resolveContext(opts.validationContext);
      let content: string;
      let responseModel: string;
      try {
        const response = await opts.client.chat({
          model: modelId,
          temperature: 0.2,
          messages: [
            { role: "system", content: buildSystemPrompt(ctx) },
            { role: "user", content: `Goal: ${goal}` },
          ],
        });
        if (response.backend !== "meta-model-api") {
          throw new PlanRejectedError("transport", [
            "planner client did not answer live (offline stub backend) — no live plan was produced",
          ]);
        }
        content = response.content;
        responseModel = response.model;
      } catch (err) {
        if (err instanceof PlanRejectedError) throw err;
        throw new PlanRejectedError("transport", [
          `model call failed: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractPlanJson(content)) as unknown;
      } catch (err) {
        throw new PlanRejectedError("parse", [
          `model output is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      }

      const result: PlanValidationResult = validatePlanCandidate(parsed, ctx);
      if (!result.ok) {
        throw new PlanRejectedError("validation", result.errors);
      }

      const createdAt = (now ?? new Date()).toISOString();
      const plan: OmniPlan = {
        // Distinct per draft (goal + creation instant), unlike the
        // offline planner's deterministic per-goal id.
        id: `plan:${fnv1a32(`${goal.trim().toLowerCase()}\n${createdAt}`)}`,
        goal,
        plannerMode: "live",
        plannerModelId: responseModel,
        createdAt,
        steps: result.plan.steps,
        status: "proposed",
      };
      return plan;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory — live when a key is configured, offline otherwise
// ---------------------------------------------------------------------------

/** The async planner surface hosts consume, whichever mode is active. */
export interface OmniPlanner {
  readonly mode: "live" | "offline";
  readonly modelId?: string;
  plan(goal: string, now?: Date): Promise<OmniPlan>;
}

export interface CreateOmniPlannerOptions {
  /** Inject a client (tests pass a mock-fetch MetaModelClient). */
  client?: ChatCompletionProvider;
  validationContext: ValidationContextSource;
  modelId?: string;
  /** Inject an environment for the key-presence check (tests). */
  env?: MetaApiEnv;
}

export function createOmniPlanner(
  opts: CreateOmniPlannerOptions,
): OmniPlanner {
  const status = getMetaApiStatus(opts.env);
  const clientIsLive =
    opts.client instanceof MetaModelClient ? opts.client.isLive : undefined;
  // An explicitly injected live-capable client decides when present;
  // otherwise the shared env status is the signal (runbook §5).
  const live = clientIsLive ?? status.mode === "live";

  if (!live) {
    const offline = createOfflinePlanner();
    return {
      mode: "offline",
      plan: async (goal: string, now?: Date): Promise<OmniPlan> =>
        offline.plan(goal, now),
    };
  }

  const client =
    opts.client ??
    new MetaModelClient(
      opts.modelId !== undefined ? { model: opts.modelId } : {},
    );
  const livePlanner = createLivePlanner({
    client,
    validationContext: opts.validationContext,
    ...(opts.modelId !== undefined ? { modelId: opts.modelId } : {}),
  });
  return {
    mode: "live",
    modelId: livePlanner.modelId,
    plan: (goal: string, now?: Date): Promise<OmniPlan> =>
      livePlanner.plan(goal, now),
  };
}
