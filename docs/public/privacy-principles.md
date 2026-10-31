# Privacy Principles

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

Omega's privacy model is architectural — enforced by the packages
that implement it, not promised by a policy page.

## Consent rings

Access is governed by consent rings — Family / Friends / Work /
Public. A request is allowed only when a consent receipt exists, is
active, and its ring exactly equals the required ring. There is no
ring hierarchy and no cross-ring inheritance: consent given for one
ring never opens another, and the absence of a receipt always means
no.

## Local-first

Member data is processed on the member's own device wherever the
design allows. The demo dashboard runs entirely in the browser: an
imported archive is parsed locally and nothing is uploaded.

## Public surfaces show member dispersion only

The only ledger information a public surface may carry is the single
member-dispersion aggregate described in
[member-dispersion-dashboard.md](member-dispersion-dashboard.md),
produced through an allowlist-sanitized, assertion-checked payload.

## AI grounded in consented data only

Agents retrieve only from the active consent ring, cite the sources
they used, and refuse — visibly — when a question reaches outside
that ring. The Legacy Mirror answers only from the member's
consented archive, cites a source memory for every claim, and
abstains rather than inventing a memory. Every agent run emits an
audit receipt.

## Revocation purges context

Revoking a consent receipt is not a label change: it purges every
cached AI and connector context entry for that subject and ring, and
the purge itself is recorded as sync events. What was consented and
then revoked does not linger in a cache.

## Disclosure

AI-generated representations are disclosed as such on every output
that carries them. Program state (simulation / testnet / production)
is labeled, demo data is labeled synthetic, and offline AI state is
labeled offline — no surface silently presents itself as live.
