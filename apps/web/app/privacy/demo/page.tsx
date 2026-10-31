"use client";

// Five-Viewer Demonstration — the same synthetic member world, viewed
// by six different subjects, with every card's visibility decided by
// the real @omega/policy-engine (engine.evaluate, no purpose supplied
// for the grid gate, so a grant matches when scope / action / status
// fit). Denied resources render as locked cards showing the engine's
// deny reason — that contrast IS the demonstration.
// All records are synthetic; enforcement is the real engine on every
// card. This page holds its OWN engine instance (fresh fixture),
// separate from /privacy.
// Typed bindings (WS2b): engine data is consumed through the exported
// types of @omega/policy-engine — snapshot() returns a PolicyState
// read directly (subjects / resources / grants as PolicySubject /
// PolicyResource / AccessGrant records) and every decision is a
// PolicyDecision obtained by calling the typed PolicyEngine directly.
// No policy logic lives in this page.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "../privacy.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PolicyEngine, createDemoPolicyState } from "@omega/policy-engine";
import type { PolicyDecision } from "@omega/policy-engine";

/* Display-only typed helpers — no policy logic lives in this page. */
function pretty(slug: string): string {
  const spaced = slug.replace(/[-_]+/g, " ");
  return spaced.length === 0
    ? slug
    : `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}
function decisionAllowed(d: PolicyDecision | null): boolean {
  return d?.decision === "allow";
}
function decisionReason(d: PolicyDecision | null): string {
  if (d === null) return "Denied by the engine";
  const extras: string[] = [];
  if (
    d.matchedGrantId !== undefined &&
    !d.reason.includes(d.matchedGrantId)
  ) {
    extras.push(`grant ${d.matchedGrantId}`);
  }
  if (
    d.matchedDenialId !== undefined &&
    !d.reason.includes(d.matchedDenialId)
  ) {
    extras.push(`denial ${d.matchedDenialId}`);
  }
  return extras.length > 0 ? `${d.reason} (matched ${extras.join(", ")})` : d.reason;
}

const VIEWERS = [
  { key: "doctor", label: "Doctor", match: "Priya Nair" },
  { key: "family", label: "Family", match: "Maya Calloway" },
  { key: "friend", label: "Friend", match: "Sam Reyes" },
  { key: "coworker", label: "Coworker", match: "Tom Becker" },
  { key: "public", label: "Public", match: "Public" },
  { key: "archivist", label: "Archivist Agent", match: "Archivist" },
] as const;
type ViewerKey = (typeof VIEWERS)[number]["key"];

export default function PrivacyDemoPage() {
  const [engine] = useState(() => new PolicyEngine(createDemoPolicyState()));
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const [viewerKey, setViewerKey] = useState<ViewerKey>("doctor");
  const [agentResults, setAgentResults] = useState<
    { label: string; decision: PolicyDecision }[] | null
  >(null);
  const [revokeResult, setRevokeResult] = useState<{
    grantId: string;
    decision: PolicyDecision | null;
    auditCount: number;
  } | null>(null);

  void tick;
  const snap = engine.snapshot();
  const subjects = snap.subjects;
  const resources = snap.resources;
  const grants = snap.grants;

  const findSubject = (needle: string) =>
    subjects.find((s) => s.displayName.includes(needle));

  const viewer = VIEWERS.find((v) => v.key === viewerKey) ?? VIEWERS[0];
  const viewerSubject = viewer ? findSubject(viewer.match) : undefined;
  const viewerId = viewerSubject ? viewerSubject.id : "";
  const archivist = findSubject("Archivist");
  const archivistId = archivist ? archivist.id : "";
  const daughter = findSubject("Maya Calloway");
  const daughterId = daughter ? daughter.id : "";

  // The grid: one real engine evaluation per card for the active
  // viewer (no purpose supplied — see header comment). Non-dryRun, so
  // these evaluations land in this page's engine audit log.
  const grid = useMemo(() => {
    void tick;
    if (viewerId === "") return [];
    return resources.map((resource) => ({
      resource,
      decision: engine.evaluate({
        subjectId: viewerId,
        resourceId: resource.id,
        action: "view",
      }),
    }));
  }, [tick, viewerId, engine]);

  const auditCount = useMemo(() => {
    void tick;
    return engine.auditLog().length;
  }, [tick, engine]);

  function runAgentBeat() {
    if (archivistId === "") return;
    const memoir = engine.evaluate({
      subjectId: archivistId,
      resourceId: "res-memoir",
      action: "view",
      purpose: "archive-organization",
    });
    const budget = engine.evaluate({
      subjectId: archivistId,
      resourceId: "res-budget",
      action: "view",
      purpose: "archive-organization",
    });
    setAgentResults([
      { label: "Archivist · view res-memoir · purpose “archive-organization”", decision: memoir },
      { label: "Archivist · view res-budget · purpose “archive-organization”", decision: budget },
    ]);
    bump();
  }

  function runRevokeBeat() {
    // The family heritage grant: prefer a grant whose own fields say
    // "heritage"; otherwise the grant that lets the daughter / family
    // reach the family chat record.
    const heritage =
      grants.find((g) =>
        JSON.stringify(g).toLowerCase().includes("heritage"),
      ) ??
      grants.find((g) => {
        const resourcesForGrant =
          g.resourceId !== undefined ? [g.resourceId] : [];
        return (
          (g.granteeSubjectId === daughterId ||
            (g.granteeGroupId ?? "").toLowerCase().includes("family")) &&
          (resourcesForGrant.includes("res-family-chat") ||
            resourcesForGrant.length === 0)
        );
      });
    const gid = heritage ? heritage.id : "";
    if (gid !== "") engine.revokeGrant(gid);
    const decision =
      daughterId !== ""
        ? engine.evaluate({
            subjectId: daughterId,
            resourceId: "res-family-chat",
            action: "view",
          })
        : null;
    setRevokeResult({
      grantId: gid,
      decision,
      auditCount: engine.auditLog().length,
    });
    bump();
  }

  const memoirResource = resources.find((r) => r.id === "res-memoir");

  return (
    <div>
      <h1 className="page-title">
        Five-Viewer Demonstration <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        One member&apos;s world, six authorized views of it. Switch the
        viewer and the same records re-render — content appears only
        where the engine allows a <code>view</code>; everywhere else the
        card locks and shows the engine&apos;s deny reason.{" "}
        <Link href="/privacy">Back to the Privacy Control Center →</Link>
      </p>
      <p className="privacy-banner" role="note">
        <strong>All records synthetic; enforcement is the real engine on
        every card.</strong> The member, people and records are the
        policy engine&apos;s fictional fixture — no real personal data —
        and every visibility decision below is an{" "}
        <code>engine.evaluate()</code> call, not page logic.
      </p>

      <div className="tabs" role="radiogroup" aria-label="Active viewer">
        {VIEWERS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="radio"
            aria-checked={viewerKey === v.key}
            className={viewerKey === v.key ? "tab active" : "tab"}
            onClick={() => setViewerKey(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Viewing as:{" "}
        <strong>
          {viewerSubject ? viewerSubject.displayName : "—"}
        </strong>{" "}
        · Audit events recorded by this page&apos;s engine so far:{" "}
        <strong>{auditCount}</strong>
      </p>

      <section aria-label="Member world">
        <div className="privacy-grid">
          {grid.map(({ resource, decision }) => {
            const allowed = decisionAllowed(decision);
            const rid = resource.id;
            if (!allowed) {
              return (
                <div className="card world-card-locked" key={rid}>
                  <h3>🔒 {resource.title}</h3>
                  <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                    {pretty(resource.domain)} · {rid}
                  </p>
                  <p className="lock-note">
                    Locked for this viewer — {decisionReason(decision)}
                  </p>
                </div>
              );
            }
            return (
              <div className="card" key={rid}>
                <h3>{resource.title}</h3>
                <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  {pretty(resource.domain)} · {rid} ·{" "}
                  <span className="cell-allow">view allowed</span>
                </p>
                <p className="world-summary">{resource.summary}</p>
                <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.8rem" }}>
                  {decisionReason(decision)}
                </p>
              </div>
            );
          })}
        </div>
        {grid.length === 0 && (
          <p className="muted">No viewer subject found in the fixture.</p>
        )}
      </section>

      <section className="privacy-section" aria-label="Demonstration beats">
        <h2>Guided beats</h2>

        <div className="card">
          <h3>Beat 1 — Agent retrieval, purpose-limited</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            The Digital Archivist Agent may retrieve the memoir for its
            assigned task (<em>archive-organization</em>) — and nothing
            else. The budget record is outside that purpose and scope.
          </p>
          <button type="button" className="btn btn-primary" onClick={runAgentBeat}>
            Run archivist retrieval attempts
          </button>
          {agentResults !== null && (
            <div className="beat-result" aria-live="polite">
              {agentResults.map((r) => (
                <p key={r.label} style={{ margin: "0.3rem 0" }}>
                  <span
                    className={
                      decisionAllowed(r.decision) ? "cell-allow" : "cell-deny"
                    }
                  >
                    {decisionAllowed(r.decision) ? "Allow" : "Deny"}
                  </span>{" "}
                  {r.label}
                  <span className="cell-reason">{decisionReason(r.decision)}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Beat 2 — Revoke &amp; recheck</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Revoking the family heritage grant takes effect immediately:
            the daughter&apos;s next attempt to view the family chat
            record is re-evaluated by the engine and denied. If the Family
            viewer is active above, the grid updates too.
          </p>
          <button type="button" className="btn btn-gold" onClick={runRevokeBeat}>
            Revoke the family heritage grant, then recheck
          </button>
          {revokeResult !== null && (
            <div className="beat-result" aria-live="polite">
              <p style={{ margin: "0.3rem 0" }}>
                Revoked grant: <strong>{revokeResult.grantId || "—"}</strong>{" "}
                · Recheck (daughter · view res-family-chat):{" "}
                <span
                  className={
                    decisionAllowed(revokeResult.decision)
                      ? "cell-allow"
                      : "cell-deny"
                  }
                >
                  {decisionAllowed(revokeResult.decision) ? "Allow" : "Deny"}
                </span>
                <span className="cell-reason">
                  {decisionReason(revokeResult.decision)}
                </span>
              </p>
              <p className="muted" style={{ margin: "0.3rem 0", fontSize: "0.88rem" }}>
                Audit events in this page&apos;s engine after the recheck:{" "}
                <strong>{revokeResult.auditCount}</strong> — the revocation
                and the denied recheck are both on the record.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Beat 3 — Legacy Mirror</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            An archived question over the memoir record (
            <code>res-memoir</code>), answered from the record itself with
            its citation — and the simulation disclosure shown, always.
          </p>
          {memoirResource ? (
            <>
              <p style={{ margin: "0.3rem 0" }}>
                <strong>Record:</strong> {memoirResource.title} ·{" "}
                {pretty(memoirResource.domain)}
              </p>
              <p className="world-summary">{memoirResource.summary}</p>
              <p style={{ margin: "0.6rem 0" }}>
                <strong>Question:</strong> What does the archived memoir
                record hold?
              </p>
              <p style={{ margin: "0.3rem 0" }}>
                <strong>Simulated answer:</strong> According to the archived
                record, “{memoirResource.summary}”{" "}
                <span className="chip">
                  Source: res-memoir · {memoirResource.title}
                </span>
              </p>
            </>
          ) : (
            <p className="muted">The memoir record (res-memoir) is not in this fixture snapshot.</p>
          )}
          <p className="disclosure-box" role="note">
            <strong>Disclosure:</strong> Simulated response generated from
            the member&apos;s archived records — not the member&apos;s own
            statement, and not continuing consciousness.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link href="/garden">
              Open the full Legacy Mirror in the Eternal Garden →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
