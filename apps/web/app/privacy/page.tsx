"use client";

// Privacy Control Center — member-controlled access over 10 domains,
// powered by the real @omega/policy-engine. Deny-by-default; explicit
// denials beat grants; grants are purpose-limited; passes expire by
// time or task completion; revocation is immediate; every decision is
// audited. All data on this page is the engine's synthetic demo
// fixture (fictional member June Calloway) — no real personal data.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
//
// STATE PATTERN (chosen for this page, documented per workstream brief):
//   • ONE PolicyEngine instance lives in useState, seeded once from
//     createDemoPolicyState(). A `tick` counter is bumped after every
//     mutation so the component re-renders and re-reads everything
//     from engine.snapshot() / engine queries.
//   • Decisions are ENGINE-ONLY: every allow/deny rendered here comes
//     from engine.evaluate() (dryRun for the matrix probes) or
//     engine.previewAccess(). This page contains no policy logic of
//     its own — helpers below only READ typed fields off engine data
//     for display (names, domains, purposes, timestamps).
//   • TYPED BINDINGS (WS2b): all engine data is consumed through the
//     exported types of @omega/policy-engine — snapshot() returns a
//     PolicyState whose subjects / resources / groups / grants /
//     requests are read directly as PolicySubject / PolicyResource /
//     RelationshipGroup / AccessGrant / AccessRequest records, and
//     decisions are handled as PolicyDecision / PolicyAuditEvent /
//     ResourceAccessPreview values. There is no untyped record layer
//     and no stringly dispatch: engine methods are called directly on
//     the typed PolicyEngine instance.
//   • Membership edits are DATA edits: the engine exposes no
//     state-replacement method and snapshot() returns a deep clone,
//     so an edit builds a new PolicyState from snapshot() with the
//     group's membership replaced and swaps in a NEW PolicyEngine
//     constructed from it (the sanctioned rebuild pattern). The old
//     engine's audit events are harvested into a React-state prefix
//     first, so the displayed audit log survives the swap; every
//     grant / denial / request state carries over via the snapshot,
//     and all decisions still come only from an engine instance.
//     Grants, denials, requests, passes, revocations and task
//     completions go through engine methods on the live instance.
import "./privacy.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DATA_DOMAINS,
  DEMO_MEMBER_ID,
  GROUP_TYPES,
  POLICY_ACTIONS,
  PolicyEngine,
  createDemoPolicyState,
} from "@omega/policy-engine";
import type {
  AccessGrant,
  AccessRequest,
  DataDomain,
  PolicyAction,
  PolicyAuditEvent,
  PolicyDecision,
  PolicyState,
  RelationshipGroup,
} from "@omega/policy-engine";

/* ------------------------------------------------------------------ */
/* Display-only typed field readers. None of these helpers make an    */
/* access decision — they only format engine data for rendering.      */
/* ------------------------------------------------------------------ */

/**
 * A pending request as displayed by this page. Session-created
 * emergency requests carry two extra UI fields (`emergency`,
 * `justification`) alongside the engine's AccessRequest fields; the
 * engine's clone helpers spread request objects, so the fields
 * survive snapshot() / pendingRequests() round-trips. Fixture
 * requests never set them.
 */
type DisplayRequest = AccessRequest & {
  emergency?: boolean;
  justification?: string;
};

function pretty(slug: string): string {
  const spaced = slug.replace(/[-_]+/g, " ");
  return spaced.length === 0
    ? slug
    : `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}
function fmtTime(value: string | null | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Domains a grant is scoped to: its single `domain`, if any. */
function grantDomains(g: AccessGrant): DataDomain[] {
  return g.domain !== undefined ? [g.domain] : [];
}
/** Resources a grant is scoped to: its single `resourceId`, if any. */
function grantResourceIds(g: AccessGrant): string[] {
  return g.resourceId !== undefined ? [g.resourceId] : [];
}
function decisionAllowed(d: PolicyDecision): boolean {
  return d.decision === "allow";
}
function decisionReason(d: PolicyDecision): string {
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

const DOMAINS: readonly DataDomain[] = DATA_DOMAINS;
const ACTIONS: readonly PolicyAction[] = POLICY_ACTIONS;
const KNOWN_GROUP_TYPES = GROUP_TYPES;

type DashboardTab = "active" | "pending" | "expired" | "revoked";

export default function PrivacyPage() {
  // ONE live engine instance at a time (see header comment): swapped
  // only by a membership edit, which rebuilds it from the edited
  // snapshot and preserves the audit log in `auditPrefix`.
  const [engine, setEngine] = useState(
    () => new PolicyEngine(createDemoPolicyState()),
  );
  const [auditPrefix, setAuditPrefix] = useState<PolicyAuditEvent[]>([]);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  // `tick` is read here so every mutation re-reads the engine snapshot.
  void tick;
  const snap: PolicyState = engine.snapshot();
  const subjects = snap.subjects;
  const resources = snap.resources;
  const grants = snap.grants;
  const groups = snap.groups;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const nameOfSubject = (id: string) =>
    id === "" ? "—" : (subjectById.get(id)?.displayName ?? id);
  const titleOfResource = (id: string) =>
    id === "" ? "—" : (resourceById.get(id)?.title ?? id);

  /* ---------------- Relationship Manager ---------------- */
  const [addPick, setAddPick] = useState<Record<string, string>>({});

  function updateGroupMembers(group: RelationshipGroup, nextIds: string[]) {
    const nextState: PolicyState = {
      ...snap,
      groups: snap.groups.map((g) =>
        g.id === group.id ? { ...g, memberIds: nextIds } : g,
      ),
    };
    // Preserve the audit trail across the engine swap (header comment).
    setAuditPrefix((prefix) => [...prefix, ...engine.auditLog()]);
    setEngine(new PolicyEngine(nextState));
    bump();
  }

  const holderLabel = (g: AccessGrant): string => {
    if (g.granteeSubjectId !== undefined) {
      return nameOfSubject(g.granteeSubjectId);
    }
    if (g.granteeGroupId !== undefined) {
      const group = groups.find((x) => x.id === g.granteeGroupId);
      return `group ${group ? group.name : g.granteeGroupId}`;
    }
    return "—";
  };

  /* ---------------- Permission Matrix ---------------- */
  const [matrixGroupId, setMatrixGroupId] = useState("");
  const effectiveGroupId =
    matrixGroupId !== "" ? matrixGroupId : (groups[0]?.id ?? "");
  const matrixGroup = groups.find((g) => g.id === effectiveGroupId);
  const probeSubjectId = matrixGroup
    ? (matrixGroup.memberIds[0] ?? "")
    : "";

  const matrix = useMemo(() => {
    // tick + probe identity are the invalidation keys for the probes.
    void tick;
    const cells = new Map<string, PolicyDecision>();
    if (probeSubjectId === "") return cells;
    for (const domain of DOMAINS) {
      const representative = resources.find((r) => r.domain === domain);
      if (!representative) continue;
      for (const action of ACTIONS) {
        const decision = engine.evaluate({
          subjectId: probeSubjectId,
          resourceId: representative.id,
          action,
          dryRun: true,
        });
        cells.set(`${domain}:${action}`, decision);
      }
    }
    return cells;
  }, [tick, probeSubjectId, engine]);

  function backingGrant(
    domain: DataDomain,
    action: PolicyAction,
  ): AccessGrant | undefined {
    if (!matrixGroup) return undefined;
    const gid = matrixGroup.id;
    return grants.find((g) => {
      if (g.revokedAt !== null) return false;
      const domains = grantDomains(g);
      const scopedToGroup =
        g.granteeGroupId === gid ||
        (g.granteeSubjectId !== undefined &&
          matrixGroup.memberIds.includes(g.granteeSubjectId));
      return (
        scopedToGroup &&
        (domains.length === 0 || domains.includes(domain)) &&
        (g.actions.length === 0 || g.actions.includes(action))
      );
    });
  }

  /* ---------------- Access Preview ---------------- */
  const [previewSubjectId, setPreviewSubjectId] = useState("");
  const effectivePreviewId =
    previewSubjectId !== "" ? previewSubjectId : (subjects[0]?.id ?? "");

  const previewEntries = useMemo(() => {
    void tick;
    if (effectivePreviewId === "") return [];
    // The engine's preview shape: one ResourceAccessPreview per
    // resource, whose `actions` is a per-action record of full
    // PolicyDecisions (in POLICY_ACTIONS order).
    return engine.previewAccess(effectivePreviewId).map((entry) => ({
      resource: entry.resource,
      decisions: POLICY_ACTIONS.map((action) => ({
        action,
        decision: entry.actions[action],
      })),
    }));
  }, [tick, effectivePreviewId, engine]);

  const previewByDomain = useMemo(() => {
    const grouped = new Map<string, typeof previewEntries>();
    for (const entry of previewEntries) {
      const domain: string = entry.resource.domain || "other";
      const list = grouped.get(domain) ?? [];
      list.push(entry);
      grouped.set(domain, list);
    }
    return grouped;
  }, [previewEntries]);

  /* ---------------- Temporary Passes ---------------- */
  const [passSubject, setPassSubject] = useState("");
  const [passDomain, setPassDomain] = useState<DataDomain>(
    DATA_DOMAINS[0] ?? "identity",
  );
  const [passActions, setPassActions] = useState<PolicyAction[]>(["view"]);
  const [passPurpose, setPassPurpose] = useState("");
  const [passExpiry, setPassExpiry] = useState("");

  const statusIds = useMemo(() => {
    void tick;
    const sets: Record<"active" | "expired" | "revoked", Set<string>> = {
      active: new Set(),
      expired: new Set(),
      revoked: new Set(),
    };
    for (const status of ["active", "expired", "revoked"] as const) {
      for (const g of engine.grantsByStatus(status)) {
        sets[status].add(g.id);
      }
    }
    return sets;
  }, [tick, engine]);

  function statusOf(g: AccessGrant): "active" | "expired" | "revoked" {
    if (statusIds.revoked.has(g.id) || g.revokedAt !== null) return "revoked";
    if (statusIds.expired.has(g.id)) return "expired";
    if (
      g.expiresAt !== undefined &&
      new Date(g.expiresAt).getTime() < Date.now()
    )
      return "expired";
    return "active";
  }

  const passes = grants.filter((g) => g.kind === "pass");

  const [passError, setPassError] = useState("");

  function createPass() {
    const subject = passSubject !== "" ? passSubject : effectivePreviewId;
    if (subject === "") return;
    const expiresAt =
      passExpiry !== ""
        ? new Date(passExpiry).toISOString()
        : new Date(Date.now() + 24 * 3600_000).toISOString();
    try {
      // Exact AccessGrant shape: the engine validates it (known
      // grantee, exactly one grantee field, non-empty purpose, and
      // no self-grants / no agent-sourced grants).
      engine.createGrant({
        id: `pass-ui-${Date.now()}`,
        kind: "pass",
        granteeSubjectId: subject,
        domain: passDomain,
        actions: passActions,
        purpose:
          passPurpose !== "" ? passPurpose : "temporary-pass (synthetic)",
        grantedBy: DEMO_MEMBER_ID,
        grantedAt: new Date().toISOString(),
        expiresAt,
        revokedAt: null,
      });
      setPassError("");
      setPassPurpose("");
    } catch (error) {
      setPassError(
        error instanceof Error
          ? `The engine refused this pass: ${error.message}`
          : "The engine refused this pass.",
      );
    }
    bump();
  }

  /* ---------------- Consent Dashboard ---------------- */
  const [tab, setTab] = useState<DashboardTab>("active");
  const pending = useMemo<DisplayRequest[]>(() => {
    void tick;
    return engine.pendingRequests();
  }, [tick, engine]);

  const tabGrants =
    tab === "pending"
      ? []
      : grants.filter((g) => statusOf(g) === tab);

  /* ---------------- Emergency Access ---------------- */
  const [emSubject, setEmSubject] = useState("");
  const [emDomain, setEmDomain] = useState<DataDomain>(
    DATA_DOMAINS[3] ?? DATA_DOMAINS[0] ?? "healthcare",
  );
  const [emJustification, setEmJustification] = useState("");
  const [emergencyQueue, setEmergencyQueue] = useState<
    { requestId: string; subjectId: string; domain: DataDomain; justification: string }[]
  >([]);
  const [postHoc, setPostHoc] = useState<string[]>([]);

  const [emError, setEmError] = useState("");

  function createEmergencyRequest() {
    const subject = emSubject !== "" ? emSubject : effectivePreviewId;
    if (subject === "") return;
    const rid = `req-emergency-${Date.now()}`;
    try {
      const request: DisplayRequest = {
        id: rid,
        subjectId: subject,
        domain: emDomain,
        actions: ["view"],
        purpose: "emergency-access (synthetic)",
        justification: emJustification,
        emergency: true,
        requestedAt: new Date().toISOString(),
        status: "pending",
      };
      engine.createRequest(request);
      setEmergencyQueue((q) => [
        ...q,
        {
          requestId: rid,
          subjectId: subject,
          domain: emDomain,
          justification: emJustification,
        },
      ]);
      setEmError("");
      setEmJustification("");
    } catch (error) {
      setEmError(
        error instanceof Error
          ? `The engine refused this request: ${error.message}`
          : "The engine refused this request.",
      );
    }
    bump();
  }

  function approveEmergency(item: (typeof emergencyQueue)[number]) {
    // Approver step — a different actor than the requester
    // (decideRequest's grantedBy is the member, DEMO_MEMBER_ID).
    try {
      engine.decideRequest(item.requestId, true, DEMO_MEMBER_ID);
      // decideRequest's approval creates a standing grant
      // (`g-from-<requestId>`); the governed emergency path replaces
      // it immediately with the scoped 1-hour pass below, so no
      // standing emergency access remains.
      const standingId = `g-from-${item.requestId}`;
      if (grants.some((g) => g.id === standingId)) {
        engine.revokeGrant(standingId);
      }
      engine.createGrant({
        id: `pass-emergency-${Date.now()}`,
        kind: "pass",
        granteeSubjectId: item.subjectId,
        domain: item.domain,
        actions: ["view"],
        purpose: `emergency-access (synthetic) — ${item.justification}`,
        grantedBy: DEMO_MEMBER_ID,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        revokedAt: null,
      });
      setEmergencyQueue((q) =>
        q.filter((x) => x.requestId !== item.requestId),
      );
      setPostHoc((p) => [
        ...p,
        `Emergency pass for ${nameOfSubject(item.subjectId)} · ${pretty(item.domain)} · approved by the designated approver (member, synthetic) · expires in 1 hour · post-hoc review required.`,
      ]);
      setEmError("");
    } catch (error) {
      setEmError(
        error instanceof Error
          ? `The engine refused this approval: ${error.message}`
          : "The engine refused this approval.",
      );
    }
    bump();
  }

  /* ---------------- Access Audit ---------------- */
  const audit = useMemo(() => {
    void tick;
    const current = engine.auditLog();
    // auditPrefix holds events from engines swapped out by membership
    // edits (see header comment); the live engine's log follows it.
    return [...auditPrefix, ...current].slice().reverse();
  }, [tick, engine, auditPrefix]);

  return (
    <div>
      <h1 className="page-title">
        Privacy Control Center <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Member-controlled access over {DOMAINS.length} domains, decided by
        the universal access engine (<code>@omega/policy-engine</code>):
        deny-by-default, explicit denials beat grants, grants are
        purpose-limited, passes expire by time or task completion,
        revocation is immediate, and every decision is audited.{" "}
        <Link href="/privacy/demo">Open the Five-Viewer Demonstration →</Link>
      </p>
      <p className="privacy-banner" role="note">
        <strong>Synthetic demo data.</strong> The member, people, records
        and grants on this page are the policy engine&apos;s fictional
        fixture (June Calloway (synthetic)) — no real personal data. The
        enforcement, however, is the real engine on every cell, chip and
        card below.
      </p>

      {/* ---------- 2. Relationship Manager ---------- */}
      <section className="privacy-section" aria-label="Relationship Manager">
        <h2>Relationship Manager</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Groups are data; decisions are the engine&apos;s. Adding or
          removing a member edits group membership — what that member can
          then reach is still computed only by{" "}
          <code>engine.evaluate()</code>.
          {KNOWN_GROUP_TYPES.length > 0
            ? ` Group types in this fixture: ${KNOWN_GROUP_TYPES.join(", ")}.`
            : ""}
        </p>
        <div className="privacy-grid">
          {groups.map((group) => {
            const gid = group.id;
            const members = group.memberIds;
            const candidates = subjects.filter(
              (s) => !members.includes(s.id),
            );
            return (
              <div className="card" key={gid}>
                <h3>{group.name}</h3>
                <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
                  Type: {pretty(group.type)} · {members.length} member
                  {members.length === 1 ? "" : "s"}
                </p>
                {members.map((mid) => (
                  <div className="member-row" key={mid}>
                    <span className="member-name">{nameOfSubject(mid)}</span>
                    <span className="member-kind">
                      {subjectById.get(mid)?.kind ?? ""}
                    </span>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() =>
                        updateGroupMembers(
                          group,
                          members.filter((m) => m !== mid),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="muted" style={{ fontSize: "0.88rem" }}>
                    No members — this group currently opens nothing.
                  </p>
                )}
                <div className="inline-form">
                  <div className="field">
                    <label htmlFor={`add-${gid}`}>Add member</label>
                    <select
                      id={`add-${gid}`}
                      className="select"
                      value={addPick[gid] ?? ""}
                      onChange={(e) =>
                        setAddPick((p) => ({ ...p, [gid]: e.target.value }))
                      }
                    >
                      <option value="">Select a person or agent…</option>
                      {candidates.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gold"
                    disabled={(addPick[gid] ?? "") === ""}
                    onClick={() => {
                      const pick = addPick[gid] ?? "";
                      if (pick === "") return;
                      updateGroupMembers(group, [...members, pick]);
                      setAddPick((p) => ({ ...p, [gid]: "" }));
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- 3. Permission Matrix ---------- */}
      <section className="privacy-section" aria-label="Permission Matrix">
        <h2>Permission Matrix</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Computed live from the engine over representative resources —
          each cell is a <code>dryRun</code> evaluation of the selected
          group&apos;s first member against the fixture&apos;s first
          resource in that domain. Hover a cell for the engine&apos;s
          reason. Where a cell is backed by a domain-scoped grant for
          this group, a revoke button is shown.
        </p>
        <div className="field" style={{ maxWidth: "24rem" }}>
          <label htmlFor="matrix-group">Group</label>
          <select
            id="matrix-group"
            className="select"
            value={effectiveGroupId}
            onChange={(e) => setMatrixGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({pretty(g.type)})
              </option>
            ))}
          </select>
        </div>
        <p className="muted" style={{ fontSize: "0.88rem" }}>
          Probing as:{" "}
          <strong>
            {probeSubjectId !== "" ? nameOfSubject(probeSubjectId) : "—"}
          </strong>{" "}
          (first member of {matrixGroup ? matrixGroup.name : "—"})
        </p>
        <div className="card matrix-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Domain</th>
                {ACTIONS.map((action) => (
                  <th scope="col" key={action}>
                    {pretty(action)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOMAINS.map((domain) => (
                <tr key={domain}>
                  <th scope="row">{pretty(domain)}</th>
                  {ACTIONS.map((action) => {
                    const decision = matrix.get(`${domain}:${action}`);
                    if (!decision) {
                      return (
                        <td key={action}>
                          <span className="cell-deny">✗</span>
                          <span className="cell-reason">
                            No representative resource
                          </span>
                        </td>
                      );
                    }
                    const allowed = decisionAllowed(decision);
                    const backing = allowed
                      ? backingGrant(domain, action)
                      : undefined;
                    return (
                      <td
                        key={action}
                        className={allowed ? "cell-allow-bg" : "cell-deny-bg"}
                        title={decisionReason(decision)}
                      >
                        <span
                          className={`cell-mark ${allowed ? "cell-allow" : "cell-deny"}`}
                        >
                          {allowed ? "✓" : "✗"}
                        </span>
                        <span className="cell-reason">
                          {decisionReason(decision)}
                        </span>
                        {backing && (
                          <button
                            type="button"
                            className="btn btn-small"
                            style={{ marginTop: "0.35rem" }}
                            onClick={() => {
                              engine.revokeGrant(backing.id);
                              bump();
                            }}
                          >
                            Revoke {backing.id}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- 4. Access Preview ---------- */}
      <section className="privacy-section" aria-label="Access Preview">
        <h2>Access Preview</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Exactly what one subject can reach, computed by{" "}
          <code>engine.previewAccess()</code> — the view decision&apos;s
          engine reason (including matched grant / denial ids) is shown
          under each resource.
        </p>
        <div className="field" style={{ maxWidth: "24rem" }}>
          <label htmlFor="preview-subject">Subject (people and agents)</label>
          <select
            id="preview-subject"
            className="select"
            value={effectivePreviewId}
            onChange={(e) => setPreviewSubjectId(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
                {` — ${s.kind}`}
              </option>
            ))}
          </select>
        </div>
        {[...previewByDomain.entries()].map(([domain, entries]) => (
          <div key={domain}>
            <h3 style={{ color: "var(--gold)" }}>{pretty(domain)}</h3>
            {entries.map((entry, idx) => {
              const viewDecision = entry.decisions.find(
                (d) => d.action === "view",
              );
              return (
                <div
                  className="preview-resource"
                  key={`${entry.resource.id}-${idx}`}
                >
                  <h4>{entry.resource.title}</h4>
                  <div className="action-chips">
                    {entry.decisions.map((d) => (
                      <span
                        key={d.action}
                        className={
                          decisionAllowed(d.decision)
                            ? "action-chip is-allow"
                            : "action-chip is-deny"
                        }
                        title={decisionReason(d.decision)}
                      >
                        {d.action}: {decisionAllowed(d.decision) ? "allow" : "deny"}
                      </span>
                    ))}
                  </div>
                  {viewDecision && (
                    <p className="preview-reason">
                      View: {decisionReason(viewDecision.decision)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {previewEntries.length === 0 && (
          <p className="muted">No preview available for this subject yet.</p>
        )}
      </section>

      {/* ---------- 5. Temporary Passes ---------- */}
      <section className="privacy-section" aria-label="Temporary Passes">
        <h2>Temporary Passes</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Passes are grants with an expiry — by time, or immediately when
          their task is completed. Status below is derived from the
          engine&apos;s own grant-status queries.
        </p>
        <div className="card">
          {passes.length === 0 && (
            <p className="muted">No passes in the fixture yet — create one below.</p>
          )}
          {passes.map((pass) => {
            const status = statusOf(pass);
            const task = pass.taskId ?? "";
            return (
              <div className="pass-row" key={pass.id}>
                <h4>
                  {pass.id}{" "}
                  <span className={`status-${status}`}>{status}</span>
                </h4>
                <p style={{ margin: "0.2rem 0" }}>
                  Holder: {holderLabel(pass)}{" "}
                  · Domains: {grantDomains(pass).map(pretty).join(", ") || "—"}{" "}
                  · Actions: {pass.actions.join(", ") || "—"}
                </p>
                <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  Purpose: {pass.purpose !== "" ? pass.purpose : "—"}
                  {task !== "" ? ` · Task: ${task}` : ""} · Expires:{" "}
                  {fmtTime(pass.expiresAt)} · Granted by{" "}
                  {nameOfSubject(pass.grantedBy)}
                </p>
                {grantResourceIds(pass).length > 0 && (
                  <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                    Resources:{" "}
                    {grantResourceIds(pass).map(titleOfResource).join(", ")}
                  </p>
                )}
                {task !== "" && status === "active" && (
                  <button
                    type="button"
                    className="btn btn-gold btn-small"
                    onClick={() => {
                      engine.completeTask(task);
                      bump();
                    }}
                  >
                    Complete task — pass expires now
                  </button>
                )}
                {status === "active" && (
                  <button
                    type="button"
                    className="btn btn-small"
                    style={{ marginLeft: "0.4rem" }}
                    onClick={() => {
                      engine.revokeGrant(pass.id);
                      bump();
                    }}
                  >
                    Revoke pass
                  </button>
                )}
              </div>
            );
          })}

          <h3 style={{ marginTop: "1.2rem" }}>Create a pass</h3>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="pass-subject">Subject</label>
              <select
                id="pass-subject"
                className="select"
                value={passSubject !== "" ? passSubject : effectivePreviewId}
                onChange={(e) => setPassSubject(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pass-domain">Domain</label>
              <select
                id="pass-domain"
                className="select"
                value={passDomain}
                onChange={(e) => setPassDomain(e.target.value as DataDomain)}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {pretty(d)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pass-purpose">Purpose</label>
              <input
                id="pass-purpose"
                className="input"
                value={passPurpose}
                onChange={(e) => setPassPurpose(e.target.value)}
                placeholder="e.g. second-opinion review (synthetic)"
              />
            </div>
            <div className="field">
              <label htmlFor="pass-expiry">Expires</label>
              <input
                id="pass-expiry"
                className="input"
                type="datetime-local"
                value={passExpiry}
                onChange={(e) => setPassExpiry(e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: "0.7rem" }}>
            <span className="field-label">Actions (passes are limited to view / export)</span>
            <div className="checkbox-row">
              {(["view", "export"] as const).map((action) => (
                <label key={action}>
                  <input
                    type="checkbox"
                    checked={passActions.includes(action)}
                    onChange={(e) =>
                      setPassActions((prev) =>
                        e.target.checked
                          ? [...prev, action]
                          : prev.filter((a) => a !== action),
                      )
                    }
                  />
                  {pretty(action)}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={passActions.length === 0}
            onClick={createPass}
          >
            Create pass (granted by the member)
          </button>
          {passError !== "" && (
            <p className="lock-note" style={{ color: "var(--red)", fontSize: "0.88rem" }}>
              {passError}
            </p>
          )}
        </div>
      </section>

      {/* ---------- 6. Consent Dashboard ---------- */}
      <section className="privacy-section" aria-label="Consent Dashboard">
        <h2>Consent Dashboard</h2>
        <div className="tabs" role="tablist" aria-label="Consent dashboard">
          {(
            [
              ["active", "Active grants"],
              ["pending", "Pending requests"],
              ["expired", "Expired"],
              ["revoked", "Revoked"],
            ] as [DashboardTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "tab active" : "tab"}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "pending" && pending.length > 0
                ? ` (${pending.length})`
                : ""}
            </button>
          ))}
        </div>

        {tab === "pending" ? (
          <div className="card">
            {pending.length === 0 && (
              <p className="muted">No pending requests.</p>
            )}
            {pending.map((req) => (
              <div className="request-row" key={req.id}>
                <h4>
                  {req.id}{" "}
                  <span className="status-pending">pending</span>
                  {req.emergency === true ? (
                    <span className="badge badge-guardian" style={{ marginLeft: "0.5rem" }}>
                      emergency
                    </span>
                  ) : null}
                </h4>
                <p style={{ margin: "0.2rem 0" }}>
                  From: {nameOfSubject(req.subjectId)} · Action:{" "}
                  {req.actions[0] ?? "view"} ·
                  Domain: {pretty(req.domain ?? "")}
                  {req.resourceId !== undefined && req.resourceId !== ""
                    ? ` · Resource: ${titleOfResource(req.resourceId)}`
                    : ""}
                </p>
                <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  Purpose: {req.purpose !== "" ? req.purpose : "—"}
                  {req.justification !== undefined && req.justification !== ""
                    ? ` · Justification: ${req.justification}`
                    : ""}{" "}
                  · Requested: {fmtTime(req.requestedAt)}
                </p>
                <button
                  type="button"
                  className="btn btn-gold btn-small"
                  onClick={() => {
                    try {
                      engine.decideRequest(req.id, true, DEMO_MEMBER_ID);
                    } catch {
                      // Engine guards (e.g. self-grant) leave the
                      // request pending — the dashboard re-reads it.
                    }
                    bump();
                  }}
                >
                  Approve
                </button>{" "}
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    try {
                      engine.decideRequest(req.id, false, DEMO_MEMBER_ID);
                    } catch {
                      // See Approve above.
                    }
                    bump();
                  }}
                >
                  Deny
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            {tabGrants.length === 0 && (
              <p className="muted">No {tab} grants.</p>
            )}
            {tabGrants.map((g) => (
              <div className="request-row" key={g.id}>
                <h4>
                  {g.id} <span className={`status-${tab}`}>{tab}</span>{" "}
                  <span className="member-kind">{g.kind}</span>
                </h4>
                <p style={{ margin: "0.2rem 0" }}>
                  Holder: {holderLabel(g)}{" "}
                  · Domains: {grantDomains(g).map(pretty).join(", ") || "—"} ·
                  Actions: {g.actions.join(", ") || "—"}
                </p>
                <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  Purpose: {g.purpose !== "" ? g.purpose : "—"} · Granted: {fmtTime(g.grantedAt)}{" "}
                  · Expires: {fmtTime(g.expiresAt)}
                  {g.revokedAt !== null
                    ? ` · Revoked: ${fmtTime(g.revokedAt)}`
                    : ""}
                </p>
                {tab === "active" && (
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      engine.revokeGrant(g.id);
                      bump();
                    }}
                  >
                    Revoke — effective immediately
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- 8. Emergency Access ---------- */}
      <section className="privacy-section" aria-label="Emergency Access">
        <h2>Emergency Access</h2>
        <div className="emergency-note" role="note">
          <strong>Governed workflow demonstration — not a bypass.</strong>{" "}
          An emergency request is created by the requester, then decided by
          a <em>separate</em> designated approver. Approval creates a
          narrowly scoped pass that expires in 1 hour and is flagged for
          post-hoc review, with the flow recorded in the audit log. No
          legal or healthcare compliance is claimed by this demonstration.
        </div>
        <div className="card">
          <h3>Step 1 — Requester creates an emergency request</h3>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="em-subject">Requesting subject</label>
              <select
                id="em-subject"
                className="select"
                value={emSubject !== "" ? emSubject : effectivePreviewId}
                onChange={(e) => setEmSubject(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="em-domain">Domain</label>
              <select
                id="em-domain"
                className="select"
                value={emDomain}
                onChange={(e) => setEmDomain(e.target.value as DataDomain)}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {pretty(d)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="em-justification">Justification</label>
              <input
                id="em-justification"
                className="input"
                value={emJustification}
                onChange={(e) => setEmJustification(e.target.value)}
                placeholder="Why is emergency access needed? (synthetic)"
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: "0.7rem" }}
            onClick={createEmergencyRequest}
          >
            Create emergency request
          </button>
          {emError !== "" && (
            <p style={{ color: "var(--red)", fontSize: "0.88rem" }}>{emError}</p>
          )}

          <h3 style={{ marginTop: "1.2rem" }}>
            Step 2 — Designated approver decides (not the requester)
          </h3>
          {emergencyQueue.length === 0 && (
            <p className="muted">
              No emergency requests awaiting the approver in this session.
              (Requests that arrived with the fixture appear under Consent
              Dashboard → Pending requests.)
            </p>
          )}
          {emergencyQueue.map((item) => (
            <div className="request-row" key={item.requestId}>
              <p style={{ margin: "0.2rem 0" }}>
                <strong>{item.requestId}</strong> — {nameOfSubject(item.subjectId)}{" "}
                requests emergency view access to {pretty(item.domain)}.
                {item.justification !== ""
                  ? ` Justification: ${item.justification}`
                  : ""}
              </p>
              <button
                type="button"
                className="btn btn-gold btn-small"
                onClick={() => approveEmergency(item)}
              >
                Approve as designated approver (member) — issue 1-hour scoped pass
              </button>
            </div>
          ))}
          {postHoc.length > 0 && (
            <>
              <h3 style={{ marginTop: "1.2rem" }}>Post-hoc review required</h3>
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {postHoc.map((line) => (
                  <li key={line} style={{ fontSize: "0.9rem" }}>
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* ---------- 7. Access Audit ---------- */}
      <section className="privacy-section" aria-label="Access Audit">
        <h2>Access Audit</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Newest first, straight from <code>engine.auditLog()</code>.
          Non-dryRun evaluations land here — the Five-Viewer
          Demonstration&apos;s grid evaluations work the same way in
          its own engine; the matrix and Access Preview above use
          dryRun evaluations, which do not grow the log.
        </p>
        <div className="card audit-scroll">
          {audit.length === 0 ? (
            <p className="muted">
              No audit events yet in this session — approve a request,
              revoke a grant, or run the demonstration to generate some.
            </p>
          ) : (
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((event, idx) => {
                  const allowed = event.decision === "allow";
                  const hasDecision = event.decision !== undefined;
                  return (
                    <tr key={`${event.id}-${idx}`}>
                      <td>{fmtTime(event.at)}</td>
                      <td>{event.kind}</td>
                      <td>{nameOfSubject(event.subjectId ?? "")}</td>
                      <td>{titleOfResource(event.resourceId ?? "")}</td>
                      <td>
                        {hasDecision ? (
                          <span className={allowed ? "cell-allow" : "cell-deny"}>
                            {allowed ? "allow" : "deny"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{event.reason !== "" ? event.reason : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
