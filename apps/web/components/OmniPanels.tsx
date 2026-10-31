"use client";

// Shared Omni plan / run displays for the Review Workstation and the
// guided Omni demonstration. Plans come from the Omni planner in
// @omega/ai-core (live via the Meta Model API when a key is
// configured, deterministic offline planner otherwise); runs are the
// executor's receipted output. A LIVE badge below is rendered ONLY
// for a plan whose plannerMode is "live" (a call actually answered
// live) or a run summary whose source is "live" — never otherwise.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useState } from "react";
import {
  OMNI_OWNER_ID,
  type AgentRunHistory,
  type OmniAgentDefinition,
  type OmniPlan,
  type OmniRun,
  type PlanStep,
  type RunSummary,
} from "@omega/ai-core";
import { APPROVER_LABEL } from "@/lib/omni";

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Rec)
    : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function scopeLabel(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return str(value, "—");
}

function listLabel(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        const r = rec(entry);
        return str(r.title ?? r.id ?? r.kind, "");
      })
      .filter((entry) => entry !== "")
      .join(", ");
  }
  return str(value);
}

/**
 * Planner badge for one plan. LIVE — Meta Model API · <model id>
 * appears ONLY when this plan's plannerMode is "live"; every other
 * plan shows OFFLINE. The model id comes from the plan itself
 * (plannerModelId, set by the live planner) with the optional
 * context model id as a fallback.
 */
export function PlannerBadge({
  plan,
  modelId,
}: {
  plan: OmniPlan;
  modelId?: string | null | undefined;
}) {
  if (plan.plannerMode === "live") {
    const model = plan.plannerModelId ?? modelId ?? undefined;
    return (
      <span className="badge badge-live">
        LIVE — Meta Model API{model !== undefined ? ` · ${model}` : ""}
      </span>
    );
  }
  return (
    <span className="badge badge-offline">
      OFFLINE — deterministic offline planner
    </span>
  );
}

/**
 * Visible live-planner rejection. `plannerError` carries the raw
 * rejection reasons (PlanRejectedError errors, from the Omni
 * context); this notice renders them under the exact
 * "Live planner output rejected: …" wording.
 */
export function PlannerErrorNotice({
  plannerError,
}: {
  plannerError?: string | null | undefined;
}) {
  if (plannerError === undefined || plannerError === null || plannerError === "") {
    return null;
  }
  return (
    <p className="error-note" role="alert" style={{ marginTop: "0.8rem" }}>
      Live planner output rejected: {plannerError}
    </p>
  );
}

/** A run summary's honest source label: live only when source is live. */
export function RunSummaryBadge({ summary }: { summary: RunSummary }) {
  if (summary.source === "live") {
    return (
      <span className="badge badge-live">
        LIVE summary — Meta Model API
        {summary.modelId !== undefined ? ` · ${summary.modelId}` : ""}
      </span>
    );
  }
  return <span className="badge badge-offline">Template summary</span>;
}

export function outcomeClass(outcome: string): string {
  if (outcome === "executed") return "cell-allow";
  if (outcome === "denied" || outcome === "vetoed") return "cell-deny";
  return "badge badge-offline";
}

export function PlanStepsList({
  plan,
  vetoed,
  onToggleVeto,
}: {
  plan: OmniPlan;
  vetoed?: ReadonlySet<string> | undefined;
  onToggleVeto?: ((stepId: string, veto: boolean) => void) | undefined;
}) {
  const approval = rec(plan.approval);
  const vetoedIds = new Set<string>(
    Array.isArray(approval.vetoedStepIds)
      ? approval.vetoedStepIds.map((v) => String(v))
      : [],
  );
  return (
    <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
      {plan.steps.map((step: PlanStep) => {
        const wasVetoed = vetoedIds.has(step.id);
        return (
          <li key={step.id} style={{ marginBottom: "0.65rem" }}>
            <div>
              <strong>{step.purpose}</strong>{" "}
              <span className="chip" style={{ marginRight: "0.35rem" }}>
                {step.kind}
                {step.kind === "tool" && step.toolId ? `: ${step.toolId}` : ""}
                {step.kind === "action" && step.actionId
                  ? `: ${step.actionId}`
                  : ""}
              </span>
              <span className="chip">{step.agentId}</span>
              {wasVetoed && (
                <span className="badge badge-guardian" style={{ marginLeft: "0.4rem" }}>
                  vetoed
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
              Step {step.id} · ring scope: {scopeLabel(step.ringScope)} ·
              resource: {str(step.resourceId, "—")} · action:{" "}
              {str(step.action, "—")}
              {listLabel(step.expectedArtifacts) !== ""
                ? ` · expected artifacts: ${listLabel(step.expectedArtifacts)}`
                : ""}
            </p>
            {onToggleVeto && vetoed && (
              <label
                style={{
                  display: "inline-flex",
                  gap: "0.4rem",
                  alignItems: "center",
                  fontSize: "0.88rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={vetoed.has(step.id)}
                  onChange={(e) => onToggleVeto(step.id, e.target.checked)}
                />
                Veto this step
              </label>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OmniPlanPanel({
  plan,
  executing,
  onApprove,
  onExecute,
  plannerError,
  plannerModelId,
}: {
  plan: OmniPlan;
  executing: boolean;
  onApprove: (planId: string, vetoedStepIds: readonly string[]) => void;
  onExecute: (planId: string) => void;
  /** Raw live-planner rejection reasons from the Omni context. */
  plannerError?: string | null | undefined;
  /** Context model id, fallback for the planner badge. */
  plannerModelId?: string | null | undefined;
}) {
  const [vetoed, setVetoed] = useState<ReadonlySet<string>>(new Set());
  const status = String(plan.status);
  const approval = rec(plan.approval);
  const approverLabel = str(approval.by, "");

  const toggleVeto = (stepId: string, veto: boolean) => {
    setVetoed((prev) => {
      const next = new Set(prev);
      if (veto) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
  };

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>
        Plan {plan.id}{" "}
        <span
          className={
            status === "approved"
              ? "badge badge-live"
              : status === "proposed"
                ? "badge badge-gold"
                : "badge badge-offline"
          }
        >
          {status}
        </span>
      </h3>
      <p style={{ margin: "0.3rem 0" }}>{plan.goal}</p>
      <p style={{ margin: "0.3rem 0" }}>
        <PlannerBadge plan={plan} modelId={plannerModelId} />
      </p>
      <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
        Planner mode: {plan.plannerMode} · created {plan.createdAt}
        {approverLabel !== ""
          ? ` · approved by ${approverLabel === OMNI_OWNER_ID ? APPROVER_LABEL : approverLabel}`
          : ""}
      </p>
      <PlannerErrorNotice plannerError={plannerError} />
      <PlanStepsList
        plan={plan}
        vetoed={status === "proposed" ? vetoed : undefined}
        onToggleVeto={status === "proposed" ? toggleVeto : undefined}
      />
      {status === "proposed" && (
        <div className="form-actions" style={{ marginTop: "0.8rem" }}>
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => onApprove(plan.id, [...vetoed])}
          >
            Approve plan as {APPROVER_LABEL}
            {vetoed.size > 0 ? ` (${vetoed.size} step(s) vetoed)` : ""}
          </button>
        </div>
      )}
      {status === "approved" && (
        <div className="form-actions" style={{ marginTop: "0.8rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={executing}
            onClick={() => onExecute(plan.id)}
          >
            {executing ? "Executing…" : "Execute approved plan"}
          </button>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Execution runs in this browser, gated by the policy engine.
          </span>
        </div>
      )}
    </div>
  );
}

export function OmniRunPanel({ run }: { run: OmniRun }) {
  const executed = run.receipts.filter((r) => r.outcome === "executed").length;
  // The run summary is attached by the executor's summary hook;
  // until that wiring lands it is absent — read it defensively.
  const summary = (run as { summary?: RunSummary }).summary;
  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>
        Run {run.id}{" "}
        <span
          className={run.status === "completed" ? "badge badge-live" : "badge badge-guardian"}
        >
          {run.status}
        </span>
      </h3>
      <p style={{ margin: "0.3rem 0" }}>{run.goal}</p>
      <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
        Plan {run.planId} · steps executed {executed}/{run.receipts.length} ·{" "}
        {run.startedAt} → {run.finishedAt}
        {run.vaultReceiptId
          ? ` · vault receipt: ${run.vaultReceiptId}`
          : " · no vault receipt"}
      </p>
      {summary !== undefined && (
        <div style={{ margin: "0.5rem 0" }}>
          <RunSummaryBadge summary={summary} />{" "}
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            {summary.at} · source: {summary.source}
          </span>
          <p style={{ margin: "0.35rem 0", fontSize: "0.92rem" }}>
            {summary.text}
          </p>
        </div>
      )}
      <table className="matrix">
        <thead>
          <tr>
            <th scope="col">Step ref</th>
            <th scope="col">Agent</th>
            <th scope="col">Outcome</th>
            <th scope="col">Artifacts / reason</th>
            <th scope="col">At</th>
          </tr>
        </thead>
        <tbody>
          {run.receipts.map((receipt) => (
            <tr key={`${receipt.stepId}-${receipt.at}`}>
              <td>{receipt.ref}</td>
              <td>{receipt.agentId}</td>
              <td>
                <span className={outcomeClass(receipt.outcome)}>
                  {receipt.outcome}
                </span>
              </td>
              <td style={{ fontSize: "0.85rem" }}>
                {receipt.artifacts.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                    {receipt.artifacts.map((artifact) => (
                      <li key={`${artifact.kind}-${artifact.id}`}>
                        <strong>{artifact.title}</strong>{" "}
                        <span className="muted">
                          ({artifact.kind} · {artifact.id})
                          {artifact.detail ? ` — ${artifact.detail}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">—</span>
                )}
                {(receipt.reason ?? receipt.decisionReason) && (
                  <span className="cell-reason">
                    {receipt.reason ?? receipt.decisionReason}
                  </span>
                )}
              </td>
              <td style={{ fontSize: "0.82rem" }}>{receipt.at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Agent monitor — per-agent run history (agent memory) from the
 * Omni context's `agentHistories` (historyByAgent over the retained
 * runs). For each agent: how many runs it participated in, its
 * step-outcome counts, and its most recent run's summary text with
 * the summary's honest source label (live / template). Agents with
 * no runs yet show "No runs yet" — histories are derived from
 * receipts only, never invented.
 */
export function OmniAgentMonitorPanel({
  agents,
  histories,
}: {
  agents: readonly OmniAgentDefinition[];
  histories: Readonly<Record<string, AgentRunHistory>>;
}) {
  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Agent monitor — run history</h3>
      {agents.length === 0 ? (
        <p className="empty-note">Registry is loading…</p>
      ) : (
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Runs</th>
              <th scope="col">Executed</th>
              <th scope="col">Denied</th>
              <th scope="col">Vetoed</th>
              <th scope="col">Error</th>
              <th scope="col">Last run summary</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const history = histories[agent.id];
              const lastSummary =
                history?.lastSummary ?? history?.entries[0]?.summary;
              return (
                <tr key={agent.id}>
                  <td>
                    {agent.name}{" "}
                    <span className="muted">({agent.id})</span>
                  </td>
                  <td>{history?.runCount ?? 0}</td>
                  <td>{history?.executed ?? 0}</td>
                  <td>{history?.denied ?? 0}</td>
                  <td>{history?.vetoed ?? 0}</td>
                  <td>{history?.error ?? 0}</td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {lastSummary !== undefined ? (
                      <>
                        <RunSummaryBadge summary={lastSummary} />{" "}
                        <span>{lastSummary.text}</span>{" "}
                        <span className="muted">
                          (source: {lastSummary.source})
                        </span>
                      </>
                    ) : history !== undefined && history.runCount > 0 ? (
                      <span className="muted">
                        {history.runCount} run(s) recorded — no summary
                        attached yet
                      </span>
                    ) : (
                      <span className="muted">No runs yet</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
