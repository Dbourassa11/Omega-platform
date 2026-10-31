"use client";

// Review Workstation — the human seat for Omni Execution (Phase 3B).
// Agent proposals are approved or rejected here, plans from the
// OFFLINE planner are reviewed step by step (with per-step veto),
// approved, and executed in this browser through the real evidence
// gateway and the real policy engine. Every run is receipted and the
// receipts are shown in full. All Omni state is local/demo: a reload
// resets it, and nothing leaves this device.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import Link from "next/link";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  DEMO_GOAL,
  OMNI_PACKAGE_ACTIONS,
  type OmniAgentDefinition,
} from "@omega/ai-core";
import { RING_TYPES, type RingType } from "@omega/consent-core";
import { DATA_DOMAINS, type DataDomain } from "@omega/policy-engine";
import { GATEWAY_TOOL_IDS, useOmni } from "@/lib/omni";
import {
  OmniAgentMonitorPanel,
  OmniPlanPanel,
  OmniRunPanel,
  PlannerErrorNotice,
} from "@/components/OmniPanels";
import AgentSkills from "@/components/AgentSkills";

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "agent" : slug;
}

function capitalize(text: string): string {
  return text.length === 0
    ? text
    : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function scopeLabel(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return str(value, "—");
}

function CheckboxGroup({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  selected: ReadonlySet<string>;
  onToggle: (value: string, on: boolean) => void;
}) {
  return (
    <fieldset className="form-field" style={{ border: "none", padding: 0, margin: 0 }}>
      <legend style={{ fontSize: "0.8rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: "0.35rem" }}>
        {legend}
      </legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1rem" }}>
        {options.map((option) => (
          <label
            key={option}
            style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center", fontSize: "0.88rem" }}
          >
            <input
              type="checkbox"
              checked={selected.has(option)}
              onChange={(e) => onToggle(option, e.target.checked)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ReviewPage() {
  const omni = useOmni();
  const [goal, setGoal] = useState<string>(DEMO_GOAL);

  // Propose-agent form state.
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [justification, setJustification] = useState("");
  const [rings, setRings] = useState<ReadonlySet<string>>(new Set(["public"]));
  const [tools, setTools] = useState<ReadonlySet<string>>(new Set());
  const [actions, setActions] = useState<ReadonlySet<string>>(new Set());
  const [domains, setDomains] = useState<ReadonlySet<string>>(new Set(["public-released"]));
  const [formNote, setFormNote] = useState<string | null>(null);

  const toggleIn =
    (setter: Dispatch<SetStateAction<ReadonlySet<string>>>) =>
    (value: string, on: boolean) =>
      setter((prev) => {
        const next = new Set(prev);
        if (on) next.add(value);
        else next.delete(value);
        return next;
      });

  function submitProposal() {
    const name = agentName.trim();
    const role = agentRole.trim();
    if (name === "" || role === "") {
      setFormNote("Name and role are required — the registry validates the rest.");
      return;
    }
    const id = slugify(name);
    const def: OmniAgentDefinition = {
      id,
      name,
      role,
      ringScope: RING_TYPES.filter((ring) => rings.has(ring)) as RingType[],
      toolAllowlist: GATEWAY_TOOL_IDS.filter((tool) => tools.has(tool)),
      actionAllowlist: OMNI_PACKAGE_ACTIONS.filter((action) =>
        actions.has(action),
      ),
      domainScope: DATA_DOMAINS.filter((domain) =>
        domains.has(domain),
      ) as DataDomain[],
      policySubjectId: `agent:${id}`,
      provenanceRequirements: {
        citations: true,
        disclosure: true,
        receipt: true,
        stateLabel: true,
      },
      status: "proposed",
    };
    const proposal = omni.proposeAgent(
      def,
      justification.trim() || "Proposed from the Review Workstation.",
    );
    if (proposal) {
      setFormNote(
        `Proposal ${proposal.id} submitted — it stays proposed until you approve or reject it below.`,
      );
      setAgentName("");
      setAgentRole("");
      setJustification("");
    } else {
      setFormNote(null);
    }
  }

  // Agent monitor: per-agent tallies derived from the runs' receipts.
  const monitor = useMemo(() => {
    const byAgent = new Map<
      string,
      { executed: number; denied: number; vetoed: number; error: number }
    >();
    for (const run of omni.runs) {
      for (const receipt of run.receipts) {
        const entry =
          byAgent.get(receipt.agentId) ??
          { executed: 0, denied: 0, vetoed: 0, error: 0 };
        if (receipt.outcome === "executed") entry.executed += 1;
        else if (receipt.outcome === "denied") entry.denied += 1;
        else if (receipt.outcome === "vetoed") entry.vetoed += 1;
        else entry.error += 1;
        byAgent.set(receipt.agentId, entry);
      }
    }
    return byAgent;
  }, [omni.runs]);

  return (
    <>
      <h1 className="page-title">
        Review Workstation <span className="omega">Ω</span>
      </h1>
      <p className="honest-banner" role="note">
        <strong>Review Workstation — local demo.</strong> Plans are
        generated by the OFFLINE planner; execution runs real gateway
        tools and package actions in this browser, gated by the policy
        engine. Nothing leaves this device. All Omni state is in-memory
        and resets on reload.
      </p>
      <p style={{ marginTop: "0.9rem" }}>
        <Link href="/review/demo" className="btn btn-gold">
          Run the guided critical demonstration →
        </Link>{" "}
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          The full goal, step by step: propose agents, plan, approve,
          execute, and see the community, findings brief, share draft and
          cosmos nodes the run produces.
        </span>
      </p>

      {omni.error !== null && (
        <p className="error-note" role="alert" style={{ marginTop: "1rem" }}>
          {omni.error}{" "}
          <button type="button" className="btn" onClick={omni.clearError}>
            Dismiss
          </button>
        </p>
      )}

      <section aria-label="Agent registry" className="suite-section">
        <h2>Agent registry</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Registered agents from the Omni registry — scope is enforced by
          the policy engine at execution time, not by this list.
        </p>
        {omni.agents.length === 0 ? (
          <p className="empty-note">Registry is loading…</p>
        ) : (
          <div className="card-grid">
            {omni.agents.map((agent) => (
              <div className="card" key={agent.id}>
                <h3 style={{ marginTop: 0 }}>
                  {agent.name}{" "}
                  <span
                    className={
                      String(agent.status) === "active"
                        ? "badge badge-live"
                        : "badge badge-offline"
                    }
                  >
                    {String(agent.status)}
                  </span>
                </h3>
                <p style={{ margin: "0 0 0.4rem", fontSize: "0.9rem" }}>
                  {agent.role}
                </p>
                <p className="muted" style={{ margin: "0 0 0.3rem", fontSize: "0.84rem" }}>
                  Ring scope: {scopeLabel(agent.ringScope)} · policy subject:{" "}
                  {agent.policySubjectId}
                </p>
                <p className="muted" style={{ margin: "0 0 0.3rem", fontSize: "0.84rem" }}>
                  Tools:{" "}
                  {agent.toolAllowlist.length > 0
                    ? agent.toolAllowlist.join(", ")
                    : "none"}
                </p>
                <p className="muted" style={{ margin: "0 0 0.3rem", fontSize: "0.84rem" }}>
                  Actions:{" "}
                  {agent.actionAllowlist.length > 0
                    ? agent.actionAllowlist.join(", ")
                    : "none"}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: "0.84rem" }}>
                  Domains: {scopeLabel(agent.domainScope)} · provenance:
                  citations {agent.provenanceRequirements.citations ? "required" : "—"},
                  disclosure {agent.provenanceRequirements.disclosure ? "required" : "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ color: "var(--gold)" }}>Proposals</h3>
        {omni.proposals.length === 0 ? (
          <p className="empty-note">
            No proposals yet. A run can propose agents (the executor&apos;s
            built-in agents.propose action), or propose one yourself with
            the form below.
          </p>
        ) : (
          omni.proposals.map((proposal) => {
            const decided = proposal.decision !== undefined;
            const decisionWord = decided
              ? `${proposal.decision?.outcome ?? "decided"} by ${proposal.decision?.by ?? ""}`
              : "";
            return (
              <div className="card" key={proposal.id} style={{ marginTop: "0.75rem" }}>
                <h4 style={{ margin: "0 0 0.3rem" }}>
                  {proposal.definition.name}{" "}
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    ({proposal.definition.id})
                  </span>{" "}
                  {decided ? (
                    <span className="badge badge-offline">{decisionWord}</span>
                  ) : (
                    <span className="badge badge-gold">awaiting your decision</span>
                  )}
                </h4>
                <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>
                  {proposal.definition.role}
                </p>
                <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  Justification: {proposal.justification} · proposed by{" "}
                  {proposal.proposedBy} · {proposal.createdAt}
                </p>
                <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  Ring scope: {scopeLabel(proposal.definition.ringScope)} ·
                  tools:{" "}
                  {proposal.definition.toolAllowlist.length > 0
                    ? proposal.definition.toolAllowlist.join(", ")
                    : "none"}{" "}
                  · actions:{" "}
                  {proposal.definition.actionAllowlist.length > 0
                    ? proposal.definition.actionAllowlist.join(", ")
                    : "none"}{" "}
                  · domains: {scopeLabel(proposal.definition.domainScope)}
                </p>
                {!decided && (
                  <div className="form-actions" style={{ marginTop: "0.6rem" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => omni.approveProposal(proposal.id)}
                    >
                      Approve proposal
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => omni.rejectProposal(proposal.id)}
                    >
                      Reject proposal
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="card suite-panel">
          <h3 style={{ marginTop: 0 }}>Propose a new agent</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            The registry validates the definition — unknown tools, actions
            or domains are rejected and the registry&apos;s error is shown
            above. Approval is always a separate human step.
          </p>
          <div className="form-stack">
            <div className="form-row">
              <label className="form-field">
                <span>Agent name</span>
                <input
                  className="input"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Terra Gardener"
                />
              </label>
              <label className="form-field">
                <span>Role</span>
                <input
                  className="input"
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  placeholder="What this agent is for"
                />
              </label>
            </div>
            <label className="form-field">
              <span>Justification</span>
              <textarea
                className="textarea"
                rows={2}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this agent should exist"
              />
            </label>
            <CheckboxGroup
              legend="Ring scope"
              options={RING_TYPES}
              selected={rings}
              onToggle={toggleIn(setRings)}
            />
            <CheckboxGroup
              legend="Tool allowlist (gateway tools)"
              options={GATEWAY_TOOL_IDS}
              selected={tools}
              onToggle={toggleIn(setTools)}
            />
            <CheckboxGroup
              legend="Action allowlist (package actions)"
              options={OMNI_PACKAGE_ACTIONS}
              selected={actions}
              onToggle={toggleIn(setActions)}
            />
            <CheckboxGroup
              legend="Domain scope"
              options={DATA_DOMAINS}
              selected={domains}
              onToggle={toggleIn(setDomains)}
            />
            <div className="form-actions">
              <button type="button" className="btn btn-gold" onClick={submitProposal}>
                Submit proposal
              </button>
              {formNote !== null && (
                <span className="saved-note" role="status">
                  {formNote}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Plans and runs" className="suite-section">
        <h2>Plans &amp; runs</h2>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Create a plan</h3>
          <div className="form-stack">
            <label className="form-field">
              <span>Goal</span>
              <textarea
                className="textarea"
                rows={4}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void omni.planGoal(goal)}
              >
                Generate plan
              </button>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                The plan is created as <em>proposed</em> — nothing runs
                until you approve it, and you can veto individual steps
                before approving.
              </span>
            </div>
          </div>
        </div>

        <PlannerErrorNotice plannerError={omni.plannerError} />

        {omni.plans.length === 0 && (
          <p className="empty-note" style={{ marginTop: "1rem" }}>
            No plans yet — generate one above, or use the{" "}
            <Link href="/review/demo">guided demonstration</Link>.
          </p>
        )}
        {omni.plans.map((plan) => (
          <OmniPlanPanel
            key={plan.id}
            plan={plan}
            executing={omni.executing}
            plannerModelId={omni.plannerModelId}
            onApprove={omni.approvePlanById}
            onExecute={(planId) => void omni.executePlanById(planId)}
          />
        ))}

        <h3 style={{ color: "var(--gold)", marginTop: "1.5rem" }}>Runs</h3>
        {omni.runs.length === 0 ? (
          <p className="empty-note">No runs yet — approve a plan and execute it.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {omni.runs.map((run) => (
                <span key={run.id} style={{ display: "block" }}>
                  Run {run.id}: <strong>{run.status}</strong> —{" "}
                  {run.receipts.filter((r) => r.outcome === "executed").length}/
                  {run.receipts.length} steps executed · {run.goal.slice(0, 80)}…
                </span>
              ))}
            </p>
            {omni.runs.map((run) => (
              <OmniRunPanel key={run.id} run={run} />
            ))}
          </>
        )}
      </section>

      <section aria-label="Agent monitor" className="suite-section">
        <h2>Agent monitor</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Run history per agent, derived from the runs&apos; step receipts
          above — counts are what the executor actually recorded.
        </p>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Status</th>
              <th scope="col">Scope</th>
              <th scope="col">Executed</th>
              <th scope="col">Denied</th>
              <th scope="col">Vetoed</th>
              <th scope="col">Error</th>
            </tr>
          </thead>
          <tbody>
            {omni.agents.map((agent) => {
              const tally = monitor.get(agent.id) ?? {
                executed: 0,
                denied: 0,
                vetoed: 0,
                error: 0,
              };
              return (
                <tr key={agent.id}>
                  <td>
                    {agent.name}{" "}
                    <span className="muted">({agent.id})</span>
                  </td>
                  <td>{capitalize(String(agent.status))}</td>
                  <td style={{ fontSize: "0.84rem" }}>
                    rings: {scopeLabel(agent.ringScope)} · domains:{" "}
                    {scopeLabel(agent.domainScope)}
                  </td>
                  <td>{tally.executed}</td>
                  <td>{tally.denied}</td>
                  <td>{tally.vetoed}</td>
                  <td>{tally.error}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {omni.runs.length === 0 && (
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            No receipts yet — tallies stay at zero until a plan executes.
          </p>
        )}

        <OmniAgentMonitorPanel
          agents={omni.agents}
          histories={omni.agentHistories}
        />

        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Agent skills</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            The versioned skills each agent holds. A tool step runs only
            when the tool is in the agent&apos;s allowlist <em>and</em>{" "}
            covered by one of its skills — the executor refuses anything
            else. The full library lives on the{" "}
            <Link href="/agents">Omni-AI Agents page</Link>.
          </p>
          {omni.agents.map((agent) => (
            <div key={agent.id} style={{ marginTop: "0.75rem" }}>
              <strong>
                {agent.name} <span className="muted">({agent.id})</span>
              </strong>
              <AgentSkills definition={agent} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
