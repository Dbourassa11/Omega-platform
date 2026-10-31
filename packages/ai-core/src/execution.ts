/**
 * @omega/ai-core — Omni approval + executor (Phase 3B)
 *
 * The human gate and the run loop for Omni plans:
 *
 *   plan (proposed) → approvePlan by a PERSON → frozen approved plan
 *                   → OmniExecutor.execute()  → OmniRun with receipts
 *
 * approvePlan returns a NEW, deeply frozen plan object; the original
 * stays "proposed". execute() refuses anything that is not an
 * approved plan WITH an approval record — a hand-forged object that
 * merely claims status "approved" is rejected, and because the
 * approved copy is frozen, steps cannot be added or edited after
 * approval and have any effect.
 *
 * Per-step execution, in order:
 *   vetoed? → receipt "vetoed", no pass, no evaluation.
 *   (a) registry.assertActive(agentId) — an agent that is not active
 *       (never approved, retired, unknown) denies the step and HALTS
 *       the run. Passes are issued LAZILY, immediately before each
 *       step — never all upfront — so an agent created by an earlier
 *       step of the same run (agents.propose) can act in later steps,
 *       and a halted run never leaves live passes for unrun steps.
 *   (b) Registered-bounds check: tool steps require the tool in the
 *       agent's toolAllowlist; action steps require the action in the
 *       agent's actionAllowlist; the step's ring must be in the
 *       agent's ringScope; the resource's policy domain (looked up
 *       from policy.snapshot()) must be in the agent's domainScope.
 *       Two documented exceptions:
 *       - "agents.propose" is a BUILT-IN action: it is allowed for an
 *         active agent on an approved plan — the plan approval IS the
 *         authorization for the proposal, and the plan approver is
 *         recorded as the human approver of each agent proposal. It
 *         is exempt from the actionAllowlist and domainScope bounds
 *         (a registry operation, not a data access); ring and
 *         assertActive still apply, and the executor still issues a
 *         policy pass and evaluates it before running the step.
 *       - Founder-seeded fabric agents (registry.isFounderSeeded)
 *         carry actionAllowlist: [] BY DESIGN in their fabric
 *         definitions; their authority to perform a package action
 *         derives from the human-approved plan itself. Proposed
 *         agents (the terra-* agents) are strictly allowlist-bound.
 *       If any bound fails, NO pass is issued; the executor still
 *       calls policy.evaluate() (which denies by default), records a
 *       "denied" receipt naming the failed bound and the decision
 *       reason, and HALTS.
 *   (c) Issue the step's task pass via policy.createGrant — composed
 *       WITH the engine, never around it: the pass is granted BY the
 *       owner (a person subject), TO the agent subject, for exactly
 *       this resource + action + purpose, bound to this run's taskId.
 *       (The engine itself throws if an agent ever tries to source a
 *       grant or self-grant; the executor never attempts either.)
 *   (d) policy.evaluate() the exact step — deny → "denied", HALT.
 *   (e) Run the step: tools go ONLY through gateway.handle(tools/call);
 *       package actions go through the registered ActionHandlers
 *       (missing handler → "error", HALT).
 *
 * After the loop — completed or halted — policy.completeTask(runId)
 * expires every pass of the run, so no agent retains any access once
 * the run ends. When a VersionedMemoryVault is supplied, the run
 * record is written to it (adaptation, documented: the vault stores
 * LegacyMemory records, so the run record is a LegacyMemory whose
 * `text` is the JSON run summary + receipts; the vault receipt's
 * versionId is captured as run.vaultReceiptId).
 *
 * Creator: David Charles Bourassa
 */

import type { Gateway } from "@omega/mcp-gateway/browser";
import { fnv1a32 } from "@omega/legacy-engine";
import type { VersionedMemoryVault } from "@omega/legacy-engine";
import type { PolicyEngine } from "@omega/policy-engine";

import type { LegacyMemory } from "./legacy/types.js";
import { getKnownAgentDefinition } from "./omni-demo.js";
import type { OmniPlan, PlanStep } from "./planner.js";
import type { ChatCompletionProvider } from "./meta-model-client.js";
import { summarizeRun } from "./run-summary.js";
import type { RunSummary } from "./run-summary.js";
import { checkStepSkillCoverage } from "./skill-guard.js";
import type { AgentRegistry, ApproverRef } from "./registry.js";
import { RegistryError } from "./registry.js";

export interface ArtifactRef {
  kind: string;
  id: string;
  title: string;
  detail?: string;
}

export interface StepReceipt {
  stepId: string;
  agentId: string;
  ref: string;
  outcome: "executed" | "denied" | "vetoed" | "error";
  reason?: string;
  decisionReason?: string;
  artifacts: readonly ArtifactRef[];
  at: string;
}

export interface OmniRun {
  id: string;
  planId: string;
  goal: string;
  status: "completed" | "failed";
  receipts: readonly StepReceipt[];
  startedAt: string;
  finishedAt: string;
  vaultReceiptId?: string;
  /** Phase 4 (Alive Pass): run reflection — live-model-written when a
   * summary client is configured and answers, deterministic template
   * otherwise; `summary.source` says which. See run-summary.ts. */
  summary?: RunSummary;
}

export interface ActionContext {
  gathered: ReadonlyMap<string, unknown>;
  artifacts: readonly ArtifactRef[];
}

export type ActionHandler = (
  step: PlanStep,
  ctx: ActionContext,
) => Promise<readonly ArtifactRef[]> | readonly ArtifactRef[];

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export function approvePlan(
  plan: OmniPlan,
  approver: ApproverRef,
  vetoedStepIds?: readonly string[],
  now?: Date,
): OmniPlan {
  if (approver.kind === "agent") {
    throw new ExecutionError(
      `agent '${approver.id}' cannot approve plans: no agent approves ` +
        `plans — a person must approve`,
    );
  }
  const vetoed = vetoedStepIds ?? [];
  const stepIds = new Set(plan.steps.map((s) => s.id));
  for (const vetoId of vetoed) {
    if (!stepIds.has(vetoId)) {
      throw new ExecutionError(
        `cannot veto unknown step '${vetoId}' in plan '${plan.id}'`,
      );
    }
  }
  const steps = plan.steps.map((s) => {
    const copy: PlanStep = {
      ...s,
      ...(s.args !== undefined
        ? { args: Object.freeze({ ...s.args }) }
        : {}),
      expectedArtifacts: Object.freeze([...s.expectedArtifacts]),
    };
    return Object.freeze(copy);
  });
  const approval = Object.freeze({
    by: approver.id,
    at: (now ?? new Date()).toISOString(),
    vetoedStepIds: Object.freeze([...vetoed]),
  });
  const approved: OmniPlan = {
    ...plan,
    steps: Object.freeze(steps),
    status: "approved",
    approval,
  };
  return Object.freeze(approved);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

interface McpToolResult {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export class OmniExecutor {
  readonly #registry: AgentRegistry;
  readonly #policy: PolicyEngine;
  readonly #gateway: Gateway;
  readonly #ownerId: string;
  readonly #actionHandlers: Readonly<Record<string, ActionHandler>>;
  readonly #vault: VersionedMemoryVault | undefined;
  readonly #summaryClient: ChatCompletionProvider | undefined;

  constructor(opts: {
    registry: AgentRegistry;
    policy: PolicyEngine;
    gateway: Gateway;
    ownerId: string;
    actionHandlers?: Readonly<Record<string, ActionHandler>>;
    vault?: VersionedMemoryVault;
    /** Optional chat provider for the run reflection (Phase 4). When
     * omitted — or when it cannot answer live — the run summary is the
     * deterministic template, labeled source:"template". */
    summaryClient?: ChatCompletionProvider;
  }) {
    this.#registry = opts.registry;
    this.#policy = opts.policy;
    this.#gateway = opts.gateway;
    this.#ownerId = opts.ownerId;
    this.#actionHandlers = opts.actionHandlers ?? {};
    this.#vault = opts.vault;
    this.#summaryClient = opts.summaryClient;
  }

  async execute(plan: OmniPlan, now?: Date): Promise<OmniRun> {
    if (plan.status !== "approved" || plan.approval === undefined) {
      throw new ExecutionError(
        `plan '${plan.id}' is not approved: execution requires an ` +
          `approved plan with an approval record (status is ` +
          `'${plan.status}'); a plan that merely claims "approved" ` +
          `without an approval record is refused`,
      );
    }
    const approval = plan.approval;
    const started = now ?? new Date();
    const startedAt = started.toISOString();
    const runId = `run:${plan.id}:${startedAt}`;
    const vetoed = new Set(approval.vetoedStepIds);
    const gathered = new Map<string, unknown>();
    const allArtifacts: ArtifactRef[] = [];
    const receipts: StepReceipt[] = [];
    let halted = false;

    const receiptBase = (step: PlanStep) => ({
      stepId: step.id,
      agentId: step.agentId,
      ref: `receipt:${runId}:${step.id}`,
      at: startedAt,
    });

    for (const step of plan.steps) {
      if (halted) {
        break;
      }
      if (vetoed.has(step.id)) {
        receipts.push({
          ...receiptBase(step),
          outcome: "vetoed",
          reason: `Step vetoed by approver ${approval.by} at plan approval.`,
          artifacts: [],
        });
        continue;
      }

      // (a) Activation gate.
      let agent;
      try {
        agent = this.#registry.assertActive(step.agentId);
      } catch (err) {
        receipts.push({
          ...receiptBase(step),
          outcome: "denied",
          reason:
            err instanceof RegistryError || err instanceof Error
              ? err.message
              : String(err),
          artifacts: [],
        });
        halted = true;
        break;
      }

      // (b) Registered-bounds check.
      const isProposeStep =
        step.kind === "action" && step.actionId === "agents.propose";
      let failedBound: string | undefined;
      if (step.kind === "tool") {
        if (step.toolId === undefined) {
          failedBound = "tool step carries no toolId";
        } else if (!agent.toolAllowlist.includes(step.toolId)) {
          failedBound =
            `tool '${step.toolId}' is not in agent '${agent.id}' ` +
            `toolAllowlist [${agent.toolAllowlist.join(", ")}]`;
        }
      } else if (!isProposeStep) {
        if (step.actionId === undefined) {
          failedBound = "action step carries no actionId";
        } else if (
          !this.#registry.isFounderSeeded(agent.id) &&
          !agent.actionAllowlist.includes(step.actionId)
        ) {
          failedBound =
            `action '${step.actionId}' is not in agent '${agent.id}' ` +
            `actionAllowlist [${agent.actionAllowlist.join(", ")}]`;
        }
      }
      if (failedBound === undefined && !agent.ringScope.includes(step.ringScope)) {
        failedBound =
          `ring '${step.ringScope}' is not in agent '${agent.id}' ` +
          `ringScope [${agent.ringScope.join(", ")}]`;
      }
      if (failedBound === undefined) {
        const resource = this.#policy
          .snapshot()
          .resources.find((r) => r.id === step.resourceId);
        if (resource === undefined) {
          failedBound = `resource '${step.resourceId}' is unknown to the policy engine`;
        } else if (!isProposeStep && !agent.domainScope.includes(resource.domain)) {
          failedBound =
            `resource '${step.resourceId}' is in domain ` +
            `'${resource.domain}', which is not in agent '${agent.id}' ` +
            `domainScope [${agent.domainScope.join(", ")}]`;
        }
      }
      // Phase 4 (Alive Pass): skills coverage, checked last in the
      // bounds chain so a step violating several bounds is refused for
      // its most fundamental boundary first (domain before skill). A
      // tool step must be covered by the acting agent's skills as well
      // as its allowlist — skills compose with the allowlist, never
      // replace it — and a failed check routes through the same
      // registered-bounds refusal below.
      if (failedBound === undefined && step.kind === "tool") {
        const skillCheck = checkStepSkillCoverage(
          agent,
          step,
          this.#registry.skillLibrary,
        );
        if (!skillCheck.covered) {
          failedBound = skillCheck.reason;
        }
      }

      if (failedBound !== undefined) {
        // No pass is issued. Evaluate anyway — it denies by default —
        // so the denial on record is the engine's own decision.
        const decision = this.#policy.evaluate({
          subjectId: agent.policySubjectId,
          resourceId: step.resourceId,
          action: step.action,
          purpose: step.purpose,
          now: started,
        });
        receipts.push({
          ...receiptBase(step),
          outcome: "denied",
          reason:
            `Step is outside the agent's registered bounds: ` +
            `${failedBound}. Policy decision: ${decision.reason}`,
          decisionReason: decision.reason,
          artifacts: [],
        });
        halted = true;
        break;
      }

      // (c) Issue this step's task pass — lazily, only now.
      try {
        this.#policy.createGrant({
          id: `pass:${runId}:${step.id}`,
          kind: "pass",
          granteeSubjectId: agent.policySubjectId,
          resourceId: step.resourceId,
          actions: [step.action],
          purpose: step.purpose,
          grantedBy: this.#ownerId,
          grantedAt: startedAt,
          taskId: runId,
          revokedAt: null,
        });
      } catch (err) {
        receipts.push({
          ...receiptBase(step),
          outcome: "error",
          reason:
            err instanceof Error
              ? `pass issuance failed: ${err.message}`
              : "pass issuance failed",
          artifacts: [],
        });
        halted = true;
        break;
      }

      // (d) Evaluate the exact step against the engine.
      const decision = this.#policy.evaluate({
        subjectId: agent.policySubjectId,
        resourceId: step.resourceId,
        action: step.action,
        purpose: step.purpose,
        now: started,
      });
      if (decision.decision === "deny") {
        receipts.push({
          ...receiptBase(step),
          outcome: "denied",
          reason: decision.reason,
          decisionReason: decision.reason,
          artifacts: [],
        });
        halted = true;
        break;
      }

      // (e) Run the step.
      try {
        const artifacts = await this.#runStep(step, plan, gathered, allArtifacts);
        allArtifacts.push(...artifacts);
        receipts.push({
          ...receiptBase(step),
          outcome: "executed",
          decisionReason: decision.reason,
          artifacts,
        });
      } catch (err) {
        receipts.push({
          ...receiptBase(step),
          outcome: "error",
          reason: err instanceof Error ? err.message : String(err),
          decisionReason: decision.reason,
          artifacts: [],
        });
        halted = true;
        break;
      }
    }

    const finished = now ?? new Date();
    const finishedAt = finished.toISOString();

    // Every pass of this run expires now, completed or halted.
    this.#policy.completeTask(runId, finished);

    const executedCount = receipts.filter((r) => r.outcome === "executed").length;
    const nonVetoedCount = plan.steps.filter((s) => !vetoed.has(s.id)).length;
    const status: OmniRun["status"] =
      !halted && executedCount === nonVetoedCount ? "completed" : "failed";

    const run: OmniRun = {
      id: runId,
      planId: plan.id,
      goal: plan.goal,
      status,
      receipts,
      startedAt,
      finishedAt,
    };

    // Phase 4 (Alive Pass): attach the run reflection — live-written
    // when a summary client is configured and actually answers,
    // deterministic template otherwise. summarizeRun never throws:
    // every live failure falls back to template text labeled
    // source:"template", so the executor stays fully functional
    // offline (no client → template summary).
    const summary = await summarizeRun(run, {
      ...(this.#summaryClient !== undefined
        ? { client: this.#summaryClient }
        : {}),
    });
    const runWithSummary: OmniRun = { ...run, summary };

    // Run record in the vault, when one is supplied. Adaptation: the
    // vault stores LegacyMemory records, so the run record is a
    // LegacyMemory whose text is the JSON run summary + receipts.
    if (this.#vault !== undefined) {
      try {
        const memoryId = `omni-run-${fnv1a32(runId)}`;
        const text = JSON.stringify(
          {
            runId,
            planId: plan.id,
            goal: plan.goal,
            status,
            receipts,
            summary,
          },
          null,
          2,
        );
        const existing = this.#vault.get(memoryId);
        const receipt =
          existing !== undefined
            ? this.#vault.annotate(memoryId, text, {
                actor: "omni-executor",
                timestamp: finishedAt,
              })
            : this.#vault.create(
                {
                  id: memoryId,
                  title: `Omni run ${runId}`,
                  date: finishedAt.slice(0, 10),
                  year: Number(finishedAt.slice(0, 4)),
                  era: "career",
                  people: [this.#ownerId],
                  place: "Omega Platform (local)",
                  text,
                  sourceType: "document",
                  ring: "work",
                } satisfies LegacyMemory,
                { actor: "omni-executor", timestamp: finishedAt },
              );
        return { ...runWithSummary, vaultReceiptId: receipt.versionId };
      } catch {
        // A vault write failure never rewrites the run's outcome.
        return runWithSummary;
      }
    }
    return runWithSummary;
  }

  async #runStep(
    step: PlanStep,
    plan: OmniPlan,
    gathered: Map<string, unknown>,
    artifactsSoFar: readonly ArtifactRef[],
  ): Promise<readonly ArtifactRef[]> {
    if (step.kind === "tool") {
      const toolId = step.toolId as string;
      const response = await this.#gateway.handle({
        jsonrpc: "2.0",
        id: `call:${step.id}`,
        method: "tools/call",
        params: { name: toolId, arguments: step.args ?? {} },
      });
      if (response === null) {
        throw new ExecutionError(
          `gateway returned no response for tool '${toolId}'`,
        );
      }
      if (response.error !== undefined) {
        throw new ExecutionError(
          `gateway error for tool '${toolId}': ${response.error.message}`,
        );
      }
      const result = (response.result ?? {}) as McpToolResult;
      const text = result.content?.[0]?.text ?? "";
      if (result.isError === true) {
        throw new ExecutionError(
          `tool '${toolId}' failed: ${text !== "" ? text : "unknown tool error"}`,
        );
      }
      gathered.set(
        step.id,
        result.structuredContent !== undefined ? result.structuredContent : text,
      );
      return [
        {
          kind: "tool-result",
          id: `${toolId}:${step.id}`,
          title: `${toolId} result`,
          detail: text.slice(0, 240),
        },
      ];
    }

    // Built-in action: agents.propose. The plan approver (a person —
    // approvePlan enforces it) is recorded as the human approver of
    // each proposal this step creates.
    if (step.actionId === "agents.propose") {
      const approval = plan.approval as { by: string };
      const rawAgents = step.args?.["agents"];
      if (!Array.isArray(rawAgents) || rawAgents.some((a) => typeof a !== "string")) {
        throw new ExecutionError(
          "agents.propose step requires args.agents to be an array of agent ids",
        );
      }
      const artifacts: ArtifactRef[] = [];
      for (const agentId of rawAgents as string[]) {
        const definition = getKnownAgentDefinition(agentId);
        if (definition === undefined) {
          throw new ExecutionError(
            `agents.propose: no known agent definition for '${agentId}'`,
          );
        }
        const proposal = this.#registry.propose(
          definition,
          step.purpose,
          "omni-planner",
        );
        const active = this.#registry.approve(proposal.id, {
          id: approval.by,
          kind: "person",
        });
        artifacts.push({ kind: "agent", id: active.id, title: active.name });
      }
      return artifacts;
    }

    const handler =
      step.actionId !== undefined ? this.#actionHandlers[step.actionId] : undefined;
    if (handler === undefined) {
      throw new ExecutionError(
        `no handler registered for action '${step.actionId ?? "(none)"}'`,
      );
    }
    return handler(step, { gathered, artifacts: [...artifactsSoFar] });
  }
}
