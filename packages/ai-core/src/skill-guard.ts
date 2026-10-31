/**
 * @omega/ai-core — Skill coverage guard (Phase 4, Alive Pass — WS3)
 *
 * A pure, side-effect-free check the OmniExecutor can run next to its
 * existing registered-bounds (allowlist) check in #runStep's caller
 * (execution.ts execute(), step (b)): it answers only "is this step
 * covered?" and records nothing itself — the executor owns receipts.
 *
 * Rules:
 * - kind "action" steps are COVERED by this guard, always. Package
 *   actions are not gateway tools and no skill bundles them; actions
 *   stay governed by the existing actionAllowlist / founder-seeded
 *   plan-authority path in execution.ts. Letting a tool-skill veto an
 *   action would break that documented authority model, so the guard
 *   deliberately has no opinion on actions.
 * - kind "tool" steps are covered iff BOTH hold:
 *     1. step.toolId ∈ agent.toolAllowlist (the registry bound), AND
 *     2. step.toolId ∈ toolCoverage(agent) — the union of toolIds of
 *        the skills named by agent.skillIds, resolved in `library`.
 *   Skills COMPOSE with the allowlist; they never replace it. A tool
 *   that is allowlisted but unskilled is refused, and a tool that is
 *   skilled but not allowlisted is refused.
 * - An unknown skill id on the agent, or a tool step with no toolId,
 *   is NOT covered — the reason names the failure.
 *
 * Every refusal reason names the agent, the tool (when there is one),
 * and which of the two checks failed.
 *
 * Creator: David Charles Bourassa
 */

import type { PlanStep } from "./planner.js";
import type { OmniAgentDefinition } from "./registry.js";
import { SEED_SKILL_LIBRARY } from "./skills.js";
import type { SkillLibrary } from "./skills.js";

export type SkillCoverageResult =
  | { covered: true }
  | { covered: false; reason: string };

export function checkStepSkillCoverage(
  agent: OmniAgentDefinition,
  step: PlanStep,
  library: SkillLibrary = SEED_SKILL_LIBRARY,
): SkillCoverageResult {
  // Actions stay allowlist-governed (see header) — no skill opinion.
  if (step.kind === "action") {
    return { covered: true };
  }

  const toolId = step.toolId;
  if (toolId === undefined) {
    return {
      covered: false,
      reason:
        `agent '${agent.id}': tool step '${step.id}' carries no toolId — ` +
        `skill coverage cannot be established`,
    };
  }

  // Check 1 of 2: the registry allowlist bound (unchanged semantics).
  if (!agent.toolAllowlist.includes(toolId)) {
    return {
      covered: false,
      reason:
        `agent '${agent.id}': tool '${toolId}' failed the allowlist ` +
        `check — it is not in the agent's toolAllowlist ` +
        `[${agent.toolAllowlist.join(", ")}] (skill coverage is not reached)`,
    };
  }

  // Check 2 of 2: skill coverage, resolved through the library.
  const skillIds = agent.skillIds ?? [];
  for (const skillId of skillIds) {
    if (!library.has(skillId)) {
      return {
        covered: false,
        reason:
          `agent '${agent.id}': tool '${toolId}' failed the skill ` +
          `coverage check — the agent references unknown skill id ` +
          `'${skillId}', which is not in the skill library`,
      };
    }
  }
  const coverage = library.toolCoverage(agent);
  if (!coverage.has(toolId)) {
    return {
      covered: false,
      reason:
        `agent '${agent.id}': tool '${toolId}' failed the skill ` +
        `coverage check — it is allowlisted but not covered by any of ` +
        `the agent's skills [${skillIds.join(", ") || "(none)"}] ` +
        `(covered tools: [${[...coverage].join(", ")}])`,
    };
  }

  return { covered: true };
}
