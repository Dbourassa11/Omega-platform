/**
 * @omega/ai-core — Omni plan candidate validator (Phase 4, Alive Pass)
 *
 * Model output is UNTRUSTED input. Every plan a live planner produces
 * passes through `validatePlanCandidate` before it may become an
 * OmniPlan: the validator checks the candidate against injected
 * lookups (registry agents, gateway tools, package actions, and the
 * known-agent-definition table) and collects ALL errors — each one
 * naming the step index and the reason — instead of failing fast or,
 * worse, coercing unknown values into validity. Nothing here mutates
 * the candidate, calls a model, or touches the registry: the context
 * is plain injected data/lookups so the validator stays decoupled
 * and unit-testable.
 *
 * Creator: David Charles Bourassa
 */

import { RING_TYPES } from "@omega/consent-core";
import type { RingType } from "@omega/consent-core";
import { POLICY_ACTIONS } from "@omega/policy-engine";
import type { PolicyAction } from "@omega/policy-engine";

import type { OmniAgentDefinition } from "./registry.js";
import { OMNI_PACKAGE_ACTIONS } from "./registry.js";
import type { PlanStep } from "./planner.js";

/**
 * Injected lookups the validator checks a candidate against. All
 * fields are plain data or pure lookups supplied by the host:
 * - `knownAgentIds`: agent ids already in the registry (active).
 * - `knownToolIds`: gateway tool ids (e.g. "notes.search").
 * - `knownActionIds`: package action ids; defaults to
 *   OMNI_PACKAGE_ACTIONS when omitted.
 * - `getKnownAgentDefinition`: the known-definition lookup
 *   (KNOWN_AGENT_DEFINITIONS / getKnownAgentDefinition) — an agent a
 *   plan proposes is only usable when its definition resolves here.
 * - `knownAgentDefinitions`: optional enumeration of the known
 *   definitions, used only so callers (the live planner's prompt)
 *   can list which agents may be proposed.
 */
export interface PlanValidationContext {
  knownAgentIds: Iterable<string>;
  knownToolIds: Iterable<string>;
  knownActionIds?: Iterable<string>;
  getKnownAgentDefinition: (id: string) => OmniAgentDefinition | undefined;
  knownAgentDefinitions?: Iterable<OmniAgentDefinition>;
}

/** A validated candidate: the goal plus the steps, exactly as checked. */
export interface ValidatedPlan {
  goal: string;
  steps: readonly PlanStep[];
}

export type PlanValidationResult =
  | { ok: true; plan: ValidatedPlan }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Validate an untrusted plan candidate (typically parsed model JSON).
 *
 * Rules, in check order — ALL violations are collected:
 * Overall shape:
 *  - candidate must be a plain object;
 *  - `goal` must be a non-empty string;
 *  - `steps` must be an array with at least one step.
 * Per step (errors name the step index AND the step id when known):
 *  - step must be a plain object;
 *  - `id` must be a non-empty string, unique within the plan;
 *  - `kind` must be "tool" or "action";
 *  - tool steps: `toolId` must be a string in the known tool set;
 *  - action steps: `actionId` must be a string in the known action set;
 *  - `agentId` must be a non-empty string that is either a known
 *    registry agent OR an agent proposed by an EARLIER
 *    `agents.propose` step in the same plan whose definition resolves
 *    via the known-definition lookup (a later proposal does not
 *    authorize an earlier use, and an unresolvable proposal
 *    authorizes nothing);
 *  - an `agents.propose` step's `args.agents` must be an array of
 *    non-empty strings, each resolving via the known-definition
 *    lookup (the executor refuses unknown definitions at run time —
 *    the validator refuses them at plan time);
 *  - `purpose` must be a non-empty string;
 *  - `ringScope` must be one of the valid rings (RING_TYPES);
 *  - `action` must be one of the valid policy actions
 *    (POLICY_ACTIONS);
 *  - `resourceId` must be a non-empty string;
 *  - `expectedArtifacts` must be an array of strings;
 *  - `args`, when present, must be a plain object.
 * Unknown or mistyped values are errors — never coerced.
 */
export function validatePlanCandidate(
  raw: unknown,
  ctx: PlanValidationContext,
): PlanValidationResult {
  const errors: string[] = [];
  const knownAgents = new Set(ctx.knownAgentIds);
  const knownTools = new Set(ctx.knownToolIds);
  const knownActions = new Set(ctx.knownActionIds ?? OMNI_PACKAGE_ACTIONS);
  const validRings = new Set<string>(RING_TYPES);
  const validActions = new Set<string>(POLICY_ACTIONS);

  if (!isRecord(raw)) {
    return {
      ok: false,
      errors: ["plan candidate must be a JSON object with goal and steps"],
    };
  }

  if (!isNonEmptyString(raw.goal)) {
    errors.push("plan: goal must be a non-empty string");
  }

  if (!Array.isArray(raw.steps)) {
    errors.push("plan: steps must be an array");
    return { ok: false, errors };
  }
  if (raw.steps.length === 0) {
    errors.push("plan: steps must contain at least one step");
  }

  // Agent ids an EARLIER agents.propose step has validly proposed.
  const proposedEarlier = new Set<string>();
  const seenStepIds = new Set<string>();
  const steps: PlanStep[] = [];

  raw.steps.forEach((stepRaw: unknown, index: number) => {
    const at = `step ${index}`;
    if (!isRecord(stepRaw)) {
      errors.push(`${at}: step must be an object`);
      return;
    }
    const label = isNonEmptyString(stepRaw.id)
      ? `${at} ('${stepRaw.id}')`
      : at;
    const errorsBefore = errors.length;

    // id — non-empty string, unique.
    if (!isNonEmptyString(stepRaw.id)) {
      errors.push(`${at}: id must be a non-empty string`);
    } else if (seenStepIds.has(stepRaw.id)) {
      errors.push(`${label}: duplicate step id '${stepRaw.id}'`);
    } else {
      seenStepIds.add(stepRaw.id);
    }

    // kind + the id the kind binds.
    const kind = stepRaw.kind;
    if (kind !== "tool" && kind !== "action") {
      errors.push(`${label}: kind must be "tool" or "action"`);
    } else if (kind === "tool") {
      if (!isNonEmptyString(stepRaw.toolId)) {
        errors.push(`${label}: tool step requires a toolId string`);
      } else if (!knownTools.has(stepRaw.toolId)) {
        errors.push(
          `${label}: unknown tool id '${stepRaw.toolId}' (not a known gateway tool)`,
        );
      }
    } else {
      if (!isNonEmptyString(stepRaw.actionId)) {
        errors.push(`${label}: action step requires an actionId string`);
      } else if (!knownActions.has(stepRaw.actionId)) {
        errors.push(
          `${label}: unknown action id '${stepRaw.actionId}' (not a known package action)`,
        );
      }
    }

    // agents.propose payload: every proposed id must resolve to a
    // known definition; resolvable ids become usable by LATER steps.
    const proposedHere: string[] = [];
    if (kind === "action" && stepRaw.actionId === "agents.propose") {
      const args = stepRaw.args;
      const agentsArg = isRecord(args) ? args.agents : undefined;
      if (
        !Array.isArray(agentsArg) ||
        agentsArg.some((a: unknown) => !isNonEmptyString(a))
      ) {
        errors.push(
          `${label}: agents.propose requires args.agents to be an array of agent id strings`,
        );
      } else {
        for (const proposedId of agentsArg as string[]) {
          if (ctx.getKnownAgentDefinition(proposedId) === undefined) {
            errors.push(
              `${label}: agents.propose proposes unknown agent '${proposedId}' (no known agent definition)`,
            );
          } else {
            proposedHere.push(proposedId);
          }
        }
      }
    }

    // agentId — registry agent, or proposed EARLIER in this plan.
    if (!isNonEmptyString(stepRaw.agentId)) {
      errors.push(`${label}: agentId must be a non-empty string`);
    } else if (
      !knownAgents.has(stepRaw.agentId) &&
      !proposedEarlier.has(stepRaw.agentId)
    ) {
      errors.push(
        `${label}: unknown agent '${stepRaw.agentId}' (not in the registry and not proposed by an earlier agents.propose step in this plan)`,
      );
    }

    if (!isNonEmptyString(stepRaw.purpose)) {
      errors.push(`${label}: purpose must be a non-empty string`);
    }

    if (
      typeof stepRaw.ringScope !== "string" ||
      !validRings.has(stepRaw.ringScope)
    ) {
      errors.push(
        `${label}: ringScope must be a valid ring (${RING_TYPES.join(", ")})`,
      );
    }

    if (typeof stepRaw.action !== "string" || !validActions.has(stepRaw.action)) {
      errors.push(
        `${label}: action must be a valid policy action (${POLICY_ACTIONS.join(", ")})`,
      );
    }

    if (!isNonEmptyString(stepRaw.resourceId)) {
      errors.push(`${label}: resourceId must be a non-empty string`);
    }

    if (
      !Array.isArray(stepRaw.expectedArtifacts) ||
      stepRaw.expectedArtifacts.some((a: unknown) => typeof a !== "string")
    ) {
      errors.push(`${label}: expectedArtifacts must be an array of strings`);
    }

    if (stepRaw.args !== undefined && !isRecord(stepRaw.args)) {
      errors.push(`${label}: args must be an object when present`);
    }

    // Only now do this step's own proposals become visible — a step
    // can never authorize itself or an earlier step.
    for (const proposedId of proposedHere) {
      proposedEarlier.add(proposedId);
    }

    if (errors.length === errorsBefore) {
      const step: PlanStep = {
        id: stepRaw.id as string,
        agentId: stepRaw.agentId as string,
        kind: kind as PlanStep["kind"],
        ...(kind === "tool" ? { toolId: stepRaw.toolId as string } : {}),
        ...(kind === "action"
          ? { actionId: stepRaw.actionId as string }
          : {}),
        ...(stepRaw.args !== undefined
          ? { args: stepRaw.args as Record<string, unknown> }
          : {}),
        purpose: stepRaw.purpose as string,
        ringScope: stepRaw.ringScope as RingType,
        resourceId: stepRaw.resourceId as string,
        action: stepRaw.action as PolicyAction,
        expectedArtifacts: [...(stepRaw.expectedArtifacts as string[])],
      };
      steps.push(step);
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    plan: { goal: raw.goal as string, steps },
  };
}
