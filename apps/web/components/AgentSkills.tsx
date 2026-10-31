"use client";

// AgentSkills — presentational rendering of the skills an agent holds
// (Phase 4, Workstream 3). Self-contained: imports only from
// @omega/ai-core + React. Drop it anywhere an agent definition (or an
// id + skillIds pair) is in scope — e.g. the Review Workstation's
// agent monitor. Skills resolve through the seed SkillLibrary from
// ai-core; an id the library does not know renders as an explicit
// "unknown skill" chip rather than disappearing.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { SEED_SKILL_LIBRARY } from "@omega/ai-core";
import type { OmniAgentDefinition, SkillLibrary } from "@omega/ai-core";

export interface AgentSkillsProps {
  /** Full agent definition — its skillIds are rendered. */
  definition?: OmniAgentDefinition;
  /** Alternative to `definition`: an agent id plus its skill ids. */
  agentId?: string;
  skillIds?: readonly string[];
  /** Library to resolve ids against. Defaults to the seed library. */
  library?: SkillLibrary;
}

export default function AgentSkills({
  definition,
  agentId,
  skillIds,
  library,
}: AgentSkillsProps) {
  const lib = library ?? SEED_SKILL_LIBRARY;
  const ids = definition?.skillIds ?? skillIds ?? [];
  const label = definition?.name ?? agentId ?? definition?.id ?? "Agent";

  if (ids.length === 0) {
    return (
      <p className="muted" style={{ margin: "0.3rem 0", fontSize: "0.82rem" }}>
        Skills: none assigned
      </p>
    );
  }

  return (
    <div style={{ margin: "0.3rem 0" }} aria-label={`Skills held by ${label}`}>
      <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.82rem" }}>
        Skills:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {ids.map((skillId) => {
          const skill = lib.get(skillId);
          if (skill === undefined) {
            return (
              <p key={skillId} style={{ margin: 0, fontSize: "0.85rem" }}>
                <span className="chip">{skillId}</span>{" "}
                <span className="muted">unknown skill — not in the library</span>
              </p>
            );
          }
          return (
            <div key={skill.id} style={{ fontSize: "0.85rem" }}>
              <strong>{skill.name}</strong>{" "}
              <span className="badge badge-offline">v{skill.version}</span>{" "}
              <span>
                {skill.toolIds.map((toolId) => (
                  <span
                    key={toolId}
                    className="chip"
                    style={{ marginRight: "0.3rem" }}
                  >
                    {toolId}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
