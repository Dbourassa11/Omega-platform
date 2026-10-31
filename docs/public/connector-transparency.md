# Connector Transparency

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

Omega's connectors are listed publicly by name and status. This page
mirrors the platform's adapter catalog: it shows what exists and how
mature it is — no scopes and no payload data are published here.

| Connector | Status |
| --- | --- |
| Meta/Facebook Export | working |
| Notes | working |
| Files | working |
| GitHub | working |
| Notion | working |
| Stripe | sandbox |
| AWS | stub |
| Cloudflare | stub |
| Hugging Face | stub |
| Home Assistant | stub |

## What the statuses mean

- **Working** — the adapter runs in this build over local, fixture,
  or synthetic data. "Working" does not mean a live external account
  is connected: the GitHub and Notion adapters, for example, run over
  synthetic fixtures with no live calls.
- **Sandbox** — the adapter runs against a sandbox / fixture
  environment only (Stripe: synthetic sandbox data, no live Stripe
  calls).
- **Stub** — the adapter is catalogued but has no tools yet.

## How connector access is governed

- Tools that touch member data are **receipt-gated**: a call requires
  an active consent receipt for the relevant ring.
- The Connector agent **prepares** scoped tool calls for human
  approval and shows exactly what would be shared; it never executes
  silently.
- Revoking consent purges cached connector context for that subject
  and ring (see [privacy-principles.md](privacy-principles.md)).
