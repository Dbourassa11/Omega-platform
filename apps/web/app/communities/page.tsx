"use client";

// Communities — the demo-local communities created by Omni runs.
// A community exists here only because an approved, executed Omni
// plan created it in this browser (see the Review Workstation and
// the guided demonstration). Its feed, drafts and membership come
// from the Omni store's state; publishing a draft is a demo action
// taken by the demo member owner. Nothing here is a real community,
// and nothing leaves this device.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import Link from "next/link";
import { APPROVER_LABEL, useOmni } from "@/lib/omni";

function capitalize(text: string): string {
  return text.length === 0
    ? text
    : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export default function CommunitiesPage() {
  const omni = useOmni();
  const peopleById = new Map(omni.people.map((person) => [person.id, person]));
  const strip = omni.people.slice(0, 12);

  return (
    <>
      <h1 className="page-title">
        Communities <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Communities created by Omni demonstration runs — demo-local, in
        this browser only, reset on reload.
      </p>
      <p className="honest-banner" role="note">
        <strong>Demo-local communities.</strong> Visibility and content
        access are evaluated through the policy engine — demo-local.
        Membership below is the synthetic demo graph (seed 42); no real
        people, no real community, nothing posted anywhere.
      </p>

      {omni.communities.length === 0 ? (
        <p className="empty-note" style={{ marginTop: "1.25rem" }}>
          No communities yet — run the Omni demonstration.{" "}
          <Link href="/review/demo">
            Open the guided demonstration →
          </Link>
        </p>
      ) : (
        omni.communities.map((community) => {
          const published = community.posts.filter(
            (post) => post.status === "published",
          );
          const drafts = community.posts.filter(
            (post) => post.status === "draft",
          );
          return (
            <section
              key={community.id}
              className="card suite-panel"
              aria-label={`Community ${community.name}`}
            >
              <h2 style={{ marginTop: 0 }}>
                {community.name}{" "}
                <span
                  className={
                    community.status === "launch-ready"
                      ? "badge badge-live"
                      : "badge badge-gold"
                  }
                >
                  {community.status}
                </span>
              </h2>
              <p style={{ margin: "0.2rem 0" }}>
                Topic: <strong>{community.topic}</strong>
              </p>
              <p className="muted" style={{ margin: "0.2rem 0", fontSize: "0.88rem" }}>
                {community.visibilityNote}
              </p>

              <h3 style={{ color: "var(--gold)" }}>
                Members ({community.memberIds.length})
              </h3>
              <p style={{ margin: "0.3rem 0" }}>
                {community.memberIds.map((memberId) => {
                  const person = peopleById.get(memberId);
                  return (
                    <span
                      key={memberId}
                      className="chip"
                      style={{ marginRight: "0.4rem", marginBottom: "0.4rem" }}
                    >
                      {person ? person.name : memberId} ·{" "}
                      {person ? capitalize(person.ring) : "—"} ring
                    </span>
                  );
                })}
              </p>

              <h3 style={{ color: "var(--gold)" }}>Feed</h3>
              {published.length === 0 ? (
                <p className="empty-note">
                  Nothing published yet — the agent&apos;s educational
                  draft is waiting below for a human decision.
                </p>
              ) : (
                published.map((post) => (
                  <article key={post.id} className="feed-item">
                    <p style={{ margin: "0 0 0.3rem" }}>
                      <strong>{post.title}</strong>{" "}
                      <span className="feed-kind">{post.authorLabel}</span>
                    </p>
                    {post.body.split("\n\n").map((paragraph, index) => (
                      <p key={index} style={{ fontSize: "0.93rem", lineHeight: 1.55 }}>
                        {paragraph}
                      </p>
                    ))}
                    <time>{post.createdAt}</time>
                  </article>
                ))
              )}

              <h3 style={{ color: "var(--gold)" }}>Drafts</h3>
              {drafts.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.9rem" }}>
                  No drafts waiting for this community.
                </p>
              ) : (
                drafts.map((post) => (
                  <article key={post.id} className="feed-item">
                    <p style={{ margin: "0 0 0.3rem" }}>
                      <strong>{post.title}</strong>{" "}
                      <span className="badge badge-gold">draft</span>{" "}
                      <span className="feed-kind">{post.authorLabel}</span>
                    </p>
                    {post.body.split("\n\n").map((paragraph, index) => (
                      <p key={index} style={{ fontSize: "0.93rem", lineHeight: 1.55 }}>
                        {paragraph}
                      </p>
                    ))}
                    <div className="form-actions" style={{ marginTop: "0.6rem" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          omni.publishCommunityPost(community.id, post.id)
                        }
                      >
                        Publish to community feed
                      </button>
                      <span className="muted" style={{ fontSize: "0.85rem" }}>
                        Demo action by {APPROVER_LABEL} — moves this
                        draft into the feed above, in this browser only.
                      </span>
                    </div>
                  </article>
                ))
              )}
            </section>
          );
        })
      )}

      <section className="suite-section" aria-label="Demo graph people">
        <h2>People — demo graph</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Fixture member profiles from the synthetic demo graph (seed
          42) that communities draw their founding members from. Names
          and rings are the fixture&apos;s, not real people&apos;s.
        </p>
        <p style={{ margin: "0.3rem 0" }}>
          {strip.map((person) => (
            <span
              key={person.id}
              className="chip"
              style={{ marginRight: "0.4rem", marginBottom: "0.4rem" }}
            >
              {person.name} · {capitalize(person.ring)} ring
            </span>
          ))}
        </p>
      </section>
    </>
  );
}
