// Public Platform — the disclosure-filtered public shell of the Omega
// Platform (Notion Branch A). Everything rendered here is public-safe
// by construction: the member-dispersion payload is built with
// @omega/economic-kernel's public facade, re-sanitized through its
// allowlist sanitizer, and asserted public-safe in code before it is
// rendered. Connector status comes from @omega/mcp-gateway's pure
// catalog subpath (display name + status only — no scopes, no data).
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import {
  PUBLIC_ALLOWED_KEYS,
  assertPublicSafe,
  buildPublicDispersionPayload,
  sanitizePublicLedgerPayload,
  splitPhi,
} from "@omega/economic-kernel";
import { ADAPTER_CATALOG } from "@omega/mcp-gateway/catalog";

const DEMO_FLOW_MINOR = 250000_00n; // $250,000.00 demo flow (same as Overview)
// Demo figure only — a labeled stand-in count for the public shell,
// not a real member count.
const DEMO_ACTIVE_MEMBER_COUNT = 128;

// Build the ONLY ledger shape allowed on a public surface, then run it
// back through the allowlist sanitizer and the forbidden-key assertion
// before anything renders. The payload carries strings/numbers only,
// so it is safe to render as JSON.
const PUBLIC_PAYLOAD = (() => {
  const built = buildPublicDispersionPayload([splitPhi(DEMO_FLOW_MINOR)], {
    publicProgramStatus: "simulation",
    activeMemberCount: DEMO_ACTIVE_MEMBER_COUNT,
  });
  const sanitized = sanitizePublicLedgerPayload({ ...built });
  assertPublicSafe(sanitized);
  return sanitized;
})();

const PRIVACY_PRINCIPLES: readonly string[] = [
  "Consent rings — access is exact-ring and deny-by-default: Family / Friends / Work / Public receipts govern what any person or agent may see, and consent never crosses ring boundaries.",
  "Local-first — member data is processed on the member's own device wherever the design allows; the demo dashboard runs entirely in this browser and uploads nothing.",
  "Public surfaces show member dispersion only — the single aggregate in the payload above. Internal allocation detail is never published on a public surface.",
  "Revocation purges context — revoking a consent receipt purges cached AI and connector context for that subject and ring (see the Operator Control plane for a live mechanism demo).",
];

export default function PublicPlatformPage() {
  return (
    <>
      <h1 className="page-title">
        Public Platform <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Omega is designed as an <strong>overlay for Facebook</strong> — a
        next-generation platform layer that sits on top of a member&apos;s
        existing Facebook graph rather than competing with it. This page is
        the platform&apos;s public shell: what anyone may see, with no
        account and no consent receipt.{" "}
        <em>
          Design intent only — Omega is not affiliated with or endorsed by
          Meta.
        </em>
      </p>
      <p>
        <span className="badge badge-gold">Public surface</span>{" "}
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          Public surface — disclosure-filtered by the Public Disclosure Rule.
          Member/personal surfaces (the dashboard) are separate and
          access-controlled.
        </span>
      </p>

      <div className="card">
        <h2>Member dispersion — simulation, demo flow</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The public member-dispersion payload for a{" "}
          <strong>simulation</strong> demo flow, built in code from the
          demo flow by <code>buildPublicDispersionPayload</code>, passed
          through <code>sanitizePublicLedgerPayload</code>, and checked with{" "}
          <code>assertPublicSafe</code> before rendering. The total is a
          decimal string in minor units, and the active member count (
          {DEMO_ACTIVE_MEMBER_COUNT}) is a labeled demo figure, not a real
          count. Only the allowed keys exist in this payload — that is the
          disclosure rule, enforced by an allowlist rather than by redaction:
        </p>
        <p style={{ margin: "0 0 0.6rem" }}>
          {PUBLIC_ALLOWED_KEYS.map((key) => (
            <span key={key} className="chip" style={{ marginRight: "0.4rem" }}>
              {key}
            </span>
          ))}
        </p>
        <pre
          style={{
            margin: 0,
            overflowX: "auto",
            fontSize: "0.88rem",
            lineHeight: 1.55,
          }}
        >
          {JSON.stringify(PUBLIC_PAYLOAD, null, 2)}
        </pre>
      </div>

      <div className="card">
        <h2>Connector status — public</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The connector catalog at a glance: display name and status only.
          No scopes and no payload data are shown on a public surface.
        </p>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Connector</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {ADAPTER_CATALOG.map((adapter) => (
              <tr key={adapter.id}>
                <td>{adapter.displayName}</td>
                <td>
                  <span
                    className={
                      adapter.status === "working"
                        ? "cell-allow"
                        : undefined
                    }
                    style={{ textTransform: "capitalize" }}
                  >
                    {adapter.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          “Working” adapters run over local, fixture, or sandbox data in
          this build — no live external accounts are connected.
        </p>
      </div>

      <div className="card">
        <h2>Privacy principles</h2>
        <ul className="status-list" style={{ marginBottom: 0 }}>
          {PRIVACY_PRINCIPLES.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
