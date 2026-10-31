// Consent Rings — ring overview plus a LIVE access matrix computed with
// the real @omega/consent-core (canAccess / isReceiptActive) against
// fabricated demo receipts at render time. Demo data only.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import {
  RING_TYPES,
  canAccess,
  isReceiptActive,
  type ConsentReceipt,
  type RingType,
} from "@omega/consent-core";
import { RING_SHELL_COLORS } from "@omega/cosmos-engine";

const RING_DESCRIPTIONS: Record<RingType, string> = {
  family:
    "The innermost ring: immediate family. The demo cosmos renders it as the innermost shell around the trust beacon.",
  friends:
    "Close friends and trusted peers. A friends receipt never opens family content — rings do not inherit.",
  work: "Colleagues and collaborators. Work access is scoped by purpose, and receipts can expire.",
  public:
    "Everyone. Public is still a ring: content reaches it only through an explicit public receipt, never by fall-through.",
};

const PURPOSES = ["view-profile", "view-memories", "message", "collaborate"] as const;
type Purpose = (typeof PURPOSES)[number];

const PURPOSE_LABELS: Record<Purpose, string> = {
  "view-profile": "View profile",
  "view-memories": "View memories",
  message: "Message",
  collaborate: "Collaborate",
};

// Fabricated demo receipts for subject "demo-member-1". Fixed timestamps
// keep the matrix deterministic: actives expire in 2099 (or never), the
// expired one lapsed in 2020, the revoked one was revoked in 2026.
const RECEIPTS: readonly ConsentReceipt[] = [
  {
    id: "rcpt-family-memories",
    subjectNodeId: "demo-member-1",
    ring: "family",
    purpose: "view-memories",
    grantedAt: "2026-01-05T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-family-memories",
    adapter: null,
  },
  {
    id: "rcpt-family-message",
    subjectNodeId: "demo-member-1",
    ring: "family",
    purpose: "message",
    grantedAt: "2026-01-05T12:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-family-message",
    adapter: null,
  },
  {
    id: "rcpt-friends-profile",
    subjectNodeId: "demo-member-1",
    ring: "friends",
    purpose: "view-profile",
    grantedAt: "2026-02-11T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-friends-profile",
    adapter: null,
  },
  {
    id: "rcpt-friends-message-revoked",
    subjectNodeId: "demo-member-1",
    ring: "friends",
    purpose: "message",
    grantedAt: "2026-02-11T12:00:00.000Z",
    revokedAt: "2026-03-01T09:30:00.000Z",
    dataHash: "demo-hash-friends-message",
    adapter: null,
  },
  {
    id: "rcpt-work-profile",
    subjectNodeId: "demo-member-1",
    ring: "work",
    purpose: "view-profile",
    grantedAt: "2026-04-18T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-work-profile",
    adapter: null,
  },
  {
    id: "rcpt-work-collaborate-expired",
    subjectNodeId: "demo-member-1",
    ring: "work",
    purpose: "collaborate",
    grantedAt: "2019-05-01T12:00:00.000Z",
    expiresAt: "2020-06-01T12:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-work-collaborate",
    adapter: null,
  },
  {
    id: "rcpt-public-profile",
    subjectNodeId: "demo-member-1",
    ring: "public",
    purpose: "view-profile",
    grantedAt: "2026-06-22T12:00:00.000Z",
    revokedAt: null,
    dataHash: "demo-hash-public-profile",
    adapter: null,
  },
];

function reasonFor(receipt: ConsentReceipt | undefined, now: Date): string {
  if (!receipt) return "No receipt — denied by default";
  if (receipt.revokedAt !== null) return "Receipt revoked";
  if (!isReceiptActive(receipt, now)) return "Receipt expired";
  return "Active receipt, exact ring";
}

function receiptStatus(receipt: ConsentReceipt, now: Date): string {
  if (receipt.revokedAt !== null) return "Revoked";
  if (!isReceiptActive(receipt, now)) return "Expired";
  return "Active";
}

export default function ConsentPage() {
  const now = new Date();

  return (
    <>
      <h1 className="page-title">Consent Rings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Access on the Omega Platform is <strong>exact-ring</strong> and{" "}
        <strong>deny-by-default</strong>: a request is allowed only when a
        consent receipt exists, is active (not revoked, not expired), and its
        ring exactly equals the required ring. There is no ring hierarchy and
        no cross-ring inheritance — a Family receipt does not open Friends
        content, and the absence of a receipt always means no.
      </p>

      <div className="card-grid">
        {RING_TYPES.map((ring) => (
          <div className="card" key={ring}>
            <h3 style={{ textTransform: "capitalize" }}>
              <span
                className="ring-dot"
                style={{ background: RING_SHELL_COLORS[ring] }}
                aria-hidden="true"
              />
              {ring}
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>{RING_DESCRIPTIONS[ring]}</p>
            <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
              Shell color {RING_SHELL_COLORS[ring]} — matches the Cosmos
              consent-ring shells.
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Live access matrix</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Computed at render with the real consent core —{" "}
          <code>canAccess(requiredRing, receipt, now)</code> — against the
          fabricated demo receipts listed below. Rows are the ring a request
          requires; columns are purposes. A cell is allowed only when a
          receipt for that exact ring <em>and</em> purpose is active.
        </p>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Required ring</th>
              {PURPOSES.map((purpose) => (
                <th scope="col" key={purpose}>
                  {PURPOSE_LABELS[purpose]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RING_TYPES.map((ring) => (
              <tr key={ring}>
                <th scope="row" style={{ textTransform: "capitalize" }}>
                  <span
                    className="ring-dot"
                    style={{ background: RING_SHELL_COLORS[ring] }}
                    aria-hidden="true"
                  />
                  {ring}
                </th>
                {PURPOSES.map((purpose) => {
                  const receipt = RECEIPTS.find(
                    (r) => r.ring === ring && r.purpose === purpose,
                  );
                  // A receipt only counts for its own purpose; pass it to
                  // canAccess only when the purpose matches, else deny.
                  const allowed = canAccess(ring, receipt, now);
                  return (
                    <td key={purpose}>
                      <span className={allowed ? "cell-allow" : "cell-deny"}>
                        {allowed ? "Allow" : "Deny"}
                      </span>
                      <span className="cell-reason">{reasonFor(receipt, now)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Note the deliberate gaps: Friends messaging is denied (revoked
          receipt), Work collaboration is denied (expired receipt), and every
          purpose without a receipt is denied by default — including Public,
          which receives nothing without an explicit public receipt.
        </p>
      </div>

      <div className="card">
        <h2>Demo receipts behind the matrix</h2>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Receipt</th>
              <th scope="col">Ring</th>
              <th scope="col">Purpose</th>
              <th scope="col">Granted</th>
              <th scope="col">Expires</th>
              <th scope="col">Status (now)</th>
            </tr>
          </thead>
          <tbody>
            {RECEIPTS.map((receipt) => (
              <tr key={receipt.id}>
                <td>{receipt.id}</td>
                <td style={{ textTransform: "capitalize" }}>{receipt.ring}</td>
                <td>{PURPOSE_LABELS[receipt.purpose as Purpose] ?? receipt.purpose}</td>
                <td>{receipt.grantedAt.slice(0, 10)}</td>
                <td>{receipt.expiresAt ? receipt.expiresAt.slice(0, 10) : "—"}</td>
                <td>
                  <span
                    className={
                      receiptStatus(receipt, now) === "Active"
                        ? "cell-allow"
                        : "cell-deny"
                    }
                  >
                    {receiptStatus(receipt, now)}
                  </span>
                  {receipt.revokedAt ? (
                    <span className="cell-reason">
                      revoked {receipt.revokedAt.slice(0, 10)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          These receipts are fabricated fixtures for one demo subject
          (demo-member-1) so the rules can be seen working. No real consent
          records exist in this demo.
        </p>
      </div>
    </>
  );
}
