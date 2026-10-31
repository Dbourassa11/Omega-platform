# Member Dispersion — the Public Dashboard Payload

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

## The Public Disclosure Rule

Omega's public surfaces follow one rule: **the public may see the
total member dispersion, and nothing else from the ledger.** Internal
allocation streams, vault and treasury detail, guarantees, and
wallet information are never part of a public payload — in any
context, at any nesting depth.

The rule is enforced by construction, not by redaction:

1. The payload is **built** from a single aggregate — the member
   dispersion total.
2. It is then passed through an **allowlist sanitizer**: the output
   object is rebuilt field by field from validated values, so no
   other field can pass through.
3. It is **asserted public-safe**: a recursive check fails the build
   if any forbidden key appears anywhere in the payload.

## The payload shape

A public member-dispersion payload contains only these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `memberDispersionTotal` | string | The total member dispersion, as a decimal string in minor units (for example, cents for USD). A string, so no precision is ever lost to floating point. |
| `currency` | string | One of `USD`, `ETH`, or `CREDITS`. |
| `lastUpdated` | string | ISO-8601 timestamp of the payload. |
| `activeMemberCount` | number (optional) | Count of active members, included only when it is a valid non-negative number. |
| `publicProgramStatus` | string | One of `simulation`, `testnet`, or `production` — the program state is always named, never implied. |

That is the complete list. If a field is not in this table, it is not
public.

## Where it appears

The payload is rendered as visible JSON on the platform's public
shell (`/public` in the web app), labeled as a simulation demo flow
when the underlying data is demo data. Member/personal surfaces (the
dashboard) are separate and access-controlled: a member viewing
their own console is a different disclosure context from a public
audience, and the two are never mixed.
