"use client";

// Guided critical demonstration — the Omni DEMO_GOAL, end to end, in
// five gated steps: generate the plan with the OFFLINE planner,
// review (and optionally veto) its steps, approve as the demo member
// owner, execute in this browser through the real gateway + policy
// engine, and inspect the receipts and artifacts. The same plan
// schema the live Muse Spark planner will emit when the API key
// lands — today the planner is offline and everything is demo-local.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_GOAL } from "@omega/ai-core";
import { APPROVER_LABEL, useOmni } from "@/lib/omni";
import { PlanStepsList, outcomeClass } from "@/components/OmniPanels";

export default function ReviewDemoPage() {
  const omni = useOmni();
  const [planId, setPlanId] = useState<string | null>(null);
  const [vetoed, setVetoed] = useState<ReadonlySet<string>>(new Set());

  const plan = useMemo(
    () => omni.plans.find((p) => p.id === planId) ?? null,
    [omni.plans, planId],
  );
  const run = useMemo(
    () =>
      planId === null
        ? null
        : (omni.runs.find((r) => r.planId === planId) ?? null),
    [omni.runs, planId],
  );

  const status = plan ? String(plan.status) : "";
  const step1Done = plan !== null;
  const step3Done = plan !== null && status !== "proposed";
  const step4Done = run !== null;

  const toggleVeto = (stepId: string, veto: boolean) => {
    setVetoed((prev) => {
      const next = new Set(prev);
      if (veto) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
  };

  async function generatePlan() {
    const created = await omni.planGoal(DEMO_GOAL);
    if (created) {
      setPlanId(created.id);
      setVetoed(new Set());
    }
  }

  const artifacts = run
    ? run.receipts.flatMap((receipt) =>
        receipt.artifacts.map((artifact) => ({ receipt, artifact })),
      )
    : [];

  return (
    <>
      <h1 className="page-title">
        Omni Demonstration <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The critical demonstration goal, run end to end from this page.{" "}
        <Link href="/review">Open the full Review Workstation →</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>The goal</h2>
        <blockquote
          style={{
            margin: "0.5rem 0",
            padding: "0.75rem 1rem",
            borderLeft: "3px solid var(--gold)",
            background: "rgba(212, 175, 55, 0.06)",
            fontSize: "1.02rem",
            lineHeight: 1.55,
          }}
        >
          {DEMO_GOAL}
        </blockquote>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Offline planner — the same plan schema the live Muse Spark
          planner will emit when the API key lands. Approver for every
          step below: <strong>{APPROVER_LABEL}</strong>. All state is
          local/demo and resets on reload; nothing leaves this device.
        </p>
      </div>

      {omni.error !== null && (
        <p className="error-note" role="alert" style={{ marginTop: "1rem" }}>
          {omni.error}{" "}
          <button type="button" className="btn" onClick={omni.clearError}>
            Dismiss
          </button>
        </p>
      )}

      <section className="suite-section" aria-label="Demonstration steps">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Step 1 — Generate the plan{" "}
            {step1Done && <span className="badge badge-live">done</span>}
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            The offline planner turns the goal into a step plan against
            the agents the run itself will propose. The plan is created
            as <em>proposed</em> — generating it runs nothing.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={step1Done}
            onClick={generatePlan}
          >
            Generate plan
          </button>
          {plan && (
            <p className="muted" style={{ fontSize: "0.88rem" }}>
              Plan {plan.id} · {plan.steps.length} steps · created{" "}
              {plan.createdAt}
            </p>
          )}
        </div>

        <div className="card suite-panel">
          <h3 style={{ marginTop: 0 }}>
            Step 2 — Review the steps (veto is yours)
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Read every step before approving. Vetoing a step keeps it in
            the plan record but the executor will not run it — the
            receipt will say <em>vetoed</em>.
          </p>
          {plan ? (
            <PlanStepsList
              plan={plan}
              vetoed={status === "proposed" ? vetoed : undefined}
              onToggleVeto={status === "proposed" ? toggleVeto : undefined}
            />
          ) : (
            <p className="empty-note">Generate the plan first (step 1).</p>
          )}
        </div>

        <div className="card suite-panel">
          <h3 style={{ marginTop: 0 }}>
            Step 3 — Approve{" "}
            {step3Done && <span className="badge badge-live">done</span>}
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Approval is the human gate: as {APPROVER_LABEL} you approve
            the plan as reviewed, vetoes included. Without this step the
            executor has nothing it is allowed to run.
          </p>
          <button
            type="button"
            className="btn btn-gold"
            disabled={plan === null || status !== "proposed"}
            onClick={() =>
              plan && omni.approvePlanById(plan.id, [...vetoed])
            }
          >
            Approve plan as {APPROVER_LABEL}
            {vetoed.size > 0 ? ` (${vetoed.size} step(s) vetoed)` : ""}
          </button>
        </div>

        <div className="card suite-panel">
          <h3 style={{ marginTop: 0 }}>
            Step 4 — Execute{" "}
            {step4Done && <span className="badge badge-live">done</span>}
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Execution runs in this browser: tool steps go through the
            evidence gateway, every step is evaluated by the policy
            engine, package actions run their web handlers, and each
            step lands a receipt.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={plan === null || status !== "approved" || omni.executing}
            onClick={() => plan && void omni.executePlanById(plan.id)}
          >
            {omni.executing ? "Executing…" : "Execute approved plan"}
          </button>
        </div>

        <div className="card suite-panel">
          <h3 style={{ marginTop: 0 }}>Step 5 — Results</h3>
          {run === null ? (
            <p className="empty-note">
              No run yet — results appear here after step 4.
            </p>
          ) : (
            <div aria-live="polite">
              <p style={{ marginTop: 0 }}>
                <span
                  className={
                    run.status === "completed"
                      ? "badge badge-live"
                      : "badge badge-guardian"
                  }
                >
                  Run {run.status}
                </span>{" "}
                <span className="muted">
                  {run.receipts.filter((r) => r.outcome === "executed").length}/
                  {run.receipts.length} steps executed
                  {run.vaultReceiptId
                    ? ` · vault receipt: ${run.vaultReceiptId}`
                    : ""}
                </span>
              </p>
              <ul style={{ margin: "0.4rem 0", paddingLeft: "1.25rem" }}>
                {run.receipts.map((receipt) => (
                  <li key={`${receipt.stepId}-${receipt.at}`} style={{ marginBottom: "0.3rem" }}>
                    <span className={outcomeClass(receipt.outcome)}>
                      {receipt.outcome}
                    </span>{" "}
                    {receipt.ref}{" "}
                    <span className="muted">({receipt.agentId})</span>
                    {(receipt.reason ?? receipt.decisionReason) && (
                      <span className="cell-reason">
                        {receipt.reason ?? receipt.decisionReason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {artifacts.length > 0 && (
                <>
                  <h4 style={{ color: "var(--gold)" }}>Artifacts produced</h4>
                  <ul style={{ margin: "0.4rem 0", paddingLeft: "1.25rem" }}>
                    {artifacts.map(({ receipt, artifact }) => (
                      <li key={`${receipt.stepId}-${artifact.kind}-${artifact.id}`}>
                        <strong>{artifact.title}</strong>{" "}
                        <span className="muted">
                          ({artifact.kind} · {artifact.id})
                          {artifact.detail ? ` — ${artifact.detail}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {omni.lastFindings && (
                <>
                  <h4 style={{ color: "var(--gold)" }}>Findings brief</h4>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "0.88rem",
                      lineHeight: 1.55,
                      margin: "0.4rem 0",
                    }}
                  >
                    {omni.lastFindings.text}
                  </pre>
                </>
              )}
              <div className="form-actions" style={{ marginTop: "0.9rem" }}>
                <Link href="/communities" className="btn btn-primary">
                  View the community →
                </Link>
                <Link href="/cosmos" className="btn">
                  See it in the Cosmos →
                </Link>
                <Link href="/share" className="btn">
                  Draft in Share Center →
                </Link>
              </div>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Full receipts for this run are in the{" "}
                <Link href="/review">Review Workstation</Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
