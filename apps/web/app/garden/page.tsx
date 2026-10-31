"use client";

// Eternal Garden — Legacy Mirror over the synthetic demo archive.
// Era-clustered cosmos view of a FICTIONAL member's life archive plus a
// consent-bound Q&A panel (@omega/ai-core Legacy Mirror). Answers are
// composed locally from archive memories only, every claim cited, with
// an "Official Personal AI" provenance badge; out-of-ring viewers are
// refused by the Guardian and unsupported questions get an abstention.
// No live AI call is made — the panel labels its local logic as such.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import "./garden.css";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  LEGACY_DEMO_RECEIPT_ID,
  LEGACY_ERAS,
  LEGACY_ERA_LABELS,
  LEGACY_MEMBER,
  SYNTHETIC_LEGACY_MEMORIES,
  answerLegacyQuery,
  memoriesByEra,
} from "@omega/ai-core";
import type { LegacyAnswer, LegacyMemory } from "@omega/ai-core";
import { RING_TYPES } from "@omega/consent-core";
import type { RingType } from "@omega/consent-core";
import { VersionedMemoryVault, auditArchive } from "@omega/legacy-engine";
import { ELIAS_LEGACY_DIRECTIVE } from "@omega/policy-engine";
import GardenCanvas, { ERA_COLORS } from "@/components/GardenCanvas";

// Archive integrity — computed once at build/render from the synthetic
// archive itself: seed the Continuity Engine's versioned vault with
// every memory (one v1 "create" receipt each) and audit the vault.
// Deterministic local logic from @omega/legacy-engine — no live AI
// call, and no claim here reaches beyond the archive's own records.
const ARCHIVE_INTEGRITY = (() => {
  const vault = new VersionedMemoryVault(SYNTHETIC_LEGACY_MEMORIES, {
    actor: "garden-archive-audit",
    timestamp: "2026-01-01T00:00:00.000Z",
  });
  return {
    report: auditArchive(vault),
    receiptsCount: vault.receipts().length,
  };
})();

function capitalize(text: string): string {
  return text.length === 0
    ? text
    : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function KindBadge({ answer }: { answer: LegacyAnswer }) {
  if (answer.kind === "refused") {
    return <span className="badge badge-guardian">Guardian refusal</span>;
  }
  if (answer.kind === "abstained") {
    return <span className="badge badge-abstain">Abstained — no supporting memory</span>;
  }
  return <span className="badge badge-gold">{answer.provenance.badge}</span>;
}

export default function GardenPage() {
  const [selected, setSelected] = useState<LegacyMemory | null>(null);
  const [viewerRing, setViewerRing] = useState<RingType>("family");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<LegacyAnswer | null>(null);

  const grouped = useMemo(
    () => memoriesByEra(SYNTHETIC_LEGACY_MEMORIES),
    [],
  );
  const byId = useMemo(
    () => new Map(SYNTHETIC_LEGACY_MEMORIES.map((m) => [m.id, m])),
    [],
  );

  function ask(raw: string) {
    const question = raw.trim();
    if (question === "") return;
    setLastQuestion(question);
    setAnswer(answerLegacyQuery(question, { viewerRing }));
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(input);
  }

  return (
    <div>
      <h1 className="page-title">
        Eternal Garden <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The Legacy Mirror (Digital Mirror System): a member&apos;s life
        archive rendered as a garden of era clusters inside the cosmos,
        with a personal AI that answers only from the archive itself —
        every claim cited, every output carrying the{" "}
        <strong>Official Personal AI</strong> provenance badge.
      </p>

      <p className="garden-banner" role="note">
        <strong>Synthetic demo archive — fictional member, no real personal
        data.</strong>{" "}
        {LEGACY_MEMBER.name} (b. {LEGACY_MEMBER.birthYear}) is an invented
        person; all {SYNTHETIC_LEGACY_MEMORIES.length} memories, names, and
        places are synthetic. The Q&amp;A below runs on deterministic local
        logic in this page — no live AI call is made.
      </p>

      <GardenCanvas memories={SYNTHETIC_LEGACY_MEMORIES} onSelect={setSelected} />

      <div className="era-legend" aria-label="Era legend">
        {LEGACY_ERAS.map((era) => (
          <span key={era}>
            <span
              className="ring-dot"
              style={{ background: ERA_COLORS[era] }}
              aria-hidden="true"
            />
            {LEGACY_ERA_LABELS[era]} · {grouped.get(era)?.length ?? 0} memories
          </span>
        ))}
      </div>

      {selected !== null && (
        <section className="card provenance-card" aria-label="Memory provenance">
          <h3>{selected.title}</h3>
          <dl>
            <div>
              <dt>Date</dt>
              <dd>{selected.date}</dd>
            </div>
            <div>
              <dt>Era</dt>
              <dd>{LEGACY_ERA_LABELS[selected.era]}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {selected.sourceType} · id {selected.id}
              </dd>
            </div>
            <div>
              <dt>Place</dt>
              <dd>{selected.place}</dd>
            </div>
            <div>
              <dt>Ring</dt>
              <dd>{selected.ring}</dd>
            </div>
            <div>
              <dt>Consent receipt (demo)</dt>
              <dd>{LEGACY_DEMO_RECEIPT_ID}</dd>
            </div>
          </dl>
          {selected.people.length > 0 && (
            <p className="panel-note">
              People: {selected.people.join(", ")} (fictional)
            </p>
          )}
          <p style={{ marginBottom: 0 }}>{selected.text}</p>
          <p className="panel-note" style={{ marginTop: "0.6rem" }}>
            <span className="badge badge-gold">Official Personal AI</span>{" "}
            Provenance: this card is rendered from the synthetic archive
            record itself — source, date, and ring are the record&apos;s own
            fields.
          </p>
        </section>
      )}

      <section aria-label="Memories by era">
        {LEGACY_ERAS.map((era) => (
          <div key={era} className="era-section">
            <h3>
              <span
                className="ring-dot"
                style={{ background: ERA_COLORS[era] }}
                aria-hidden="true"
              />
              {LEGACY_ERA_LABELS[era]}
            </h3>
            <div className="era-grid">
              {(grouped.get(era) ?? []).map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  className={
                    selected?.id === memory.id
                      ? "memory-chip-card is-selected"
                      : "memory-chip-card"
                  }
                  onClick={() => setSelected(memory)}
                >
                  <strong>{memory.title}</strong>
                  <span>
                    {memory.year} · {memory.sourceType} · {memory.place}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section
        className="card provenance-card"
        aria-label="Archive integrity"
        style={{ marginTop: "1.5rem" }}
      >
        <h2>Archive integrity</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Continuity rule: every memory is versioned; nothing is silently
          rewritten; claims must trace to the archive. This panel is
          computed from the synthetic archive by the Continuity
          Engine&apos;s versioned memory vault and consistency scorer
          (<code>@omega/legacy-engine</code>) — deterministic local logic,
          no live AI call.
        </p>
        <dl>
          <div>
            <dt>Consistency score</dt>
            <dd>
              {(ARCHIVE_INTEGRITY.report.score * 100).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt>Memories checked</dt>
            <dd>{ARCHIVE_INTEGRITY.report.memoriesChecked}</dd>
          </div>
          <div>
            <dt>Claims checked</dt>
            <dd>{ARCHIVE_INTEGRITY.report.claimsChecked}</dd>
          </div>
          <div>
            <dt>Versions / receipts</dt>
            <dd>{ARCHIVE_INTEGRITY.receiptsCount}</dd>
          </div>
        </dl>
        {ARCHIVE_INTEGRITY.report.flags.length === 0 ? (
          <p style={{ marginBottom: 0 }}>
            No contradictions or unsupported claims detected in the
            synthetic archive.
          </p>
        ) : (
          <ul style={{ marginBottom: 0 }}>
            {ARCHIVE_INTEGRITY.report.flags.map((flag) => (
              <li key={`${flag.kind}-${flag.claimId ?? flag.memoryIds.join(",")}`}>
                <strong>{flag.kind}</strong>
                {flag.claimId ? ` · ${flag.claimId}` : ""} — {flag.detail}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="card provenance-card"
        aria-label="Legacy Directive"
        style={{ marginTop: "1.5rem" }}
      >
        <h2>Legacy Directive — as configured by the member</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The member-configured legacy directive for{" "}
          {LEGACY_MEMBER.name}&apos;s synthetic archive, read from the
          universal access engine (<code>@omega/policy-engine</code>).
          This is what the member set — a death never makes private data
          public on its own, and the domains listed as never-public stay
          that way, including after death.
        </p>
        {(() => {
          const directive = ELIAS_LEGACY_DIRECTIVE as unknown as Record<
            string,
            unknown
          >;
          const asText = (value: unknown, fallback: string): string =>
            typeof value === "string" && value !== "" ? value : fallback;
          const asList = (value: unknown): string[] =>
            Array.isArray(value)
              ? value.map((entry) =>
                  typeof entry === "string"
                    ? entry
                    : JSON.stringify(entry),
                )
              : [];
          const neverPublic = asList(
            directive.neverPublicDomains ??
              directive.neverPublic ??
              directive.neverBecomesPublic,
          );
          const stewardsRaw = Array.isArray(directive.stewards)
            ? directive.stewards
            : Array.isArray(directive.legacyStewards)
              ? directive.legacyStewards
              : [];
          const stewardNames = stewardsRaw.map((entry) =>
            typeof entry === "string"
              ? entry
              : asText(
                  (entry as Record<string, unknown>).name ??
                    (entry as Record<string, unknown>).subjectId ??
                    (entry as Record<string, unknown>).id,
                  JSON.stringify(entry),
                ),
          );
          const memorialRaw = directive.memorialization ??
            directive.memorializationState;
          const memorialText =
            typeof memorialRaw === "string"
              ? memorialRaw
              : memorialRaw !== null &&
                  typeof memorialRaw === "object"
                ? asText(
                    (memorialRaw as Record<string, unknown>).state ??
                      (memorialRaw as Record<string, unknown>).status,
                    JSON.stringify(memorialRaw),
                  )
                : "not specified in this synthetic archive";
          const continuity = Array.isArray(
            directive.continuityAuthorizations,
          )
            ? (directive.continuityAuthorizations as Record<
                string,
                unknown
              >[])
            : [];
          return (
            <>
              <dl>
                <div>
                  <dt>Archive member</dt>
                  <dd>
                    {LEGACY_MEMBER.name} (fictional) · directive member id:{" "}
                    {asText(directive.memberId, "—")}
                  </dd>
                </div>
                <div>
                  <dt>Memorialization</dt>
                  <dd>{memorialText}</dd>
                </div>
              </dl>
              <p style={{ margin: "0.4rem 0" }}>
                <strong>During lifetime:</strong>{" "}
                {asText(
                  directive.lifetimeSummary ??
                    directive.lifetime ??
                    directive.duringLifetime,
                  "Not specified in this synthetic archive.",
                )}
              </p>
              <p style={{ margin: "0.4rem 0" }}>
                <strong>After verified death:</strong>{" "}
                {asText(
                  directive.postDeathSummary ??
                    directive.postDeath ??
                    directive.afterDeath,
                  "Not specified in this synthetic archive.",
                )}
              </p>
              <p style={{ margin: "0.4rem 0" }}>
                <strong>Never becomes public — including after death:</strong>{" "}
                {neverPublic.length > 0
                  ? neverPublic.join(", ")
                  : "none listed in this synthetic archive"}
              </p>
              <p style={{ margin: "0.4rem 0" }}>
                <strong>Designated stewards:</strong>{" "}
                {stewardNames.length > 0
                  ? stewardNames.join(", ")
                  : "none designated in this synthetic archive"}
              </p>
              {continuity.length > 0 && (
                <>
                  <p style={{ margin: "0.6rem 0 0.3rem" }}>
                    <strong>Continuity authorizations</strong> (project
                    stewardship only — never impersonation or unrestricted
                    disclosure):
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                    {continuity.map((entry, idx) => (
                      <li key={idx} style={{ fontSize: "0.92rem" }}>
                        {asText(
                          entry.projectTitle ?? entry.project,
                          "Unnamed project",
                        )}{" "}
                        — steward: {asText(entry.steward ?? entry.stewardId, "—")}{" "}
                        {typeof entry.scope === "string" && entry.scope !== ""
                          ? `· scope: ${entry.scope} `
                          : ""}
                        · attribution rule:{" "}
                        {asText(
                          entry.attributionRule ?? entry.attribution,
                          "—",
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p
                style={{
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "8px",
                  padding: "0.6rem 0.8rem",
                  fontSize: "0.9rem",
                  marginBottom: 0,
                }}
              >
                <strong>Simulation disclosure (verbatim from the directive):</strong>{" "}
                {asText(
                  directive.simulationDisclosure,
                  "Simulated response generated from the member's archived records — not the member's own statement, and not continuing consciousness.",
                )}
              </p>
            </>
          );
        })()}
      </section>

      <section className="card" aria-label="Ask the Legacy Mirror" style={{ marginTop: "1.5rem" }}>
        <h2>Ask the Legacy Mirror</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Answers are composed locally from the archive only, with a
          citation for every claim. Ask from outside the{" "}
          <strong>family</strong> ring and the Guardian refuses; ask about
          something the archive does not hold and the Mirror abstains
          rather than inventing.
        </p>

        <div
          className="picker-row"
          role="radiogroup"
          aria-label="Viewer consent ring"
        >
          {RING_TYPES.map((ring) => (
            <button
              key={ring}
              type="button"
              role="radio"
              aria-checked={viewerRing === ring}
              className={
                viewerRing === ring
                  ? "chip picker-chip is-active"
                  : "chip picker-chip"
              }
              onClick={() => setViewerRing(ring)}
            >
              {capitalize(ring)}
            </button>
          ))}
        </div>
        <p className="oracle-scope-note">
          Viewing as: <strong>{viewerRing}</strong> ring · archive ring:{" "}
          <strong>family</strong> · demo consent receipt:{" "}
          {LEGACY_DEMO_RECEIPT_ID}-{viewerRing}
        </p>

        <div className="suggestion-row" aria-label="Suggested questions">
          <span className="suggestion-label">Try:</span>
          <button
            type="button"
            className="chip"
            onClick={() => ask("Tell me about the lighthouse at Port Anselm")}
          >
            Tell me about the lighthouse at Port Anselm
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => ask("What boat did the family sail on Lake Anselm?")}
          >
            What boat did the family sail?
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => ask("Did Elias travel to Antarctica?")}
          >
            Unsupported → Did Elias travel to Antarctica?
          </button>
        </div>

        <form className="oracle-input-row" onSubmit={handleSubmit}>
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${LEGACY_MEMBER.name}'s archive…`}
            aria-label="Ask the Legacy Mirror"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={input.trim() === ""}
          >
            Ask
          </button>
        </form>

        {answer !== null && (
          <div className="legacy-answer" aria-live="polite">
            {lastQuestion !== null && (
              <p className="muted" style={{ marginBottom: "0.4rem" }}>
                You asked (as {viewerRing}): “{lastQuestion}”
              </p>
            )}
            <div className="oracle-bubble-head">
              <span>
                {answer.kind === "refused" ? "Guardian" : "Legacy Mirror"}
              </span>
              <KindBadge answer={answer} />
              <span className="badge badge-offline">
                Local demo logic — no live AI
              </span>
            </div>
            <p style={{ margin: 0 }}>{answer.text}</p>

            {answer.claims.length > 0 && (
              <ul className="legacy-claims" aria-label="Claims and citations">
                {answer.claims.map((claim) => (
                  <li key={claim.citations.join(",")}>
                    {claim.text}
                    <br />
                    {claim.citations.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="chip"
                        onClick={() => {
                          const memory = byId.get(id);
                          if (memory) setSelected(memory);
                        }}
                      >
                        {id} · {byId.get(id)?.title ?? id}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            {answer.provenance.sources.length > 0 && (
              <ul className="legacy-sources" aria-label="Official Personal AI provenance">
                <li>
                  {answer.provenance.badge} provenance — member:{" "}
                  {answer.provenance.memberName} (fictional) · sources:
                </li>
                {answer.provenance.sources.map((source) => (
                  <li key={source.id}>
                    <span className="chip">
                      {source.title} · {source.date} · {source.sourceType} ·{" "}
                      {source.ring}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {answer.kind === "refused" && (
              <p className="boundary-note">
                Boundary: this archive lives in the{" "}
                <strong>{answer.requiredRing}</strong> ring, outside your{" "}
                <strong>{viewerRing}</strong> viewer ring. Switch the viewer
                ring to Family above to ask with the owner&apos;s consent.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
