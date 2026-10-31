# @omega/policy-engine

The generalized access-policy engine for the Omega Platform
(Phase 3C, Universal Member-Controlled Access directive §9): who —
a person or an AI agent — may do what, to which of a member's data
domains, for which purpose, under grants the member controls.

Creator: David Charles Bourassa

## What this is

Consent-core proved the thesis in miniature: ring-scoped receipts,
exact match, deny-by-default. This package is the generalization
the directive asks for:

- **Subjects** — people and agents (`PolicySubject { id, kind, displayName }`).
- **Groups** — relationship groups (`family`, `friends`, `work`,
  `public`, `healthcare-providers`, `employers`,
  `research-collaborators`, `public-followers`, `trusted-agents`,
  `legacy-stewards`).
- **Data domains** — `identity`, `family-heritage`, `social`,
  `healthcare`, `employment`, `financial`,
  `intellectual-property`, `ai-agents`, `legacy`, `public-released`
  (exported as `DATA_DOMAINS`).
- **Actions** — `view`, `create`, `edit`, `comment`, `contribute`,
  `export`, `share`, `admin` (`POLICY_ACTIONS`).
- **Grants and passes** — standing grants, plus task-bound passes
  that expire when their task completes or their expiry passes.
- **Explicit denials** — individual overrides that win over grants.
- **Access requests** — pending asks the member approves or denies;
  approval mints the corresponding grant.
- **Legacy directives** — lifetime vs. post-death summaries,
  never-public domains, stewards, continuity authorizations with
  attribution rules, and the simulation-disclosure text.
- **An append-only audit log** of every evaluation and mutation.

Everything is in-memory and deterministic under an injected `now`;
there is no persistence layer in this package (see the honesty
note below).

## Evaluation order (`PolicyEngine.evaluate`)

Fixed order, deny-by-default:

1. **Unknown subject or resource → deny.** No exceptions, no
   partial matches.
2. **Explicit denial → deny (deny wins).** A denial matches when
   its subject is exact, its scope matches (resource-scoped,
   domain-scoped, or global; each present scope field must match),
   and its action list is absent (meaning: all actions) or contains
   the action. A matching denial beats every grant — this is how a
   member keeps one record private even inside a group that can
   otherwise see its domain (the fixture's performance review: the
   work group holds an employment-domain view grant, and coworker
   Tom Becker is still denied by `d-coworker-review`).
3. **Legacy never-public guard** (see below), applied to the
   public-scoped subset of otherwise-matching grants.
4. **First matching grant → allow.** A grant matches when the
   grantee is the subject directly or a group containing the
   subject; the scope is the exact resource or the resource's
   domain; the action is in the grant's list; the grant is active
   at `now` (`grantStatusAt`: not revoked, not past `expiresAt`,
   pass task not completed); and the purpose rule holds.
5. **Deny-by-default.**

Every non-`dryRun` evaluation appends an `"evaluation"` audit
event. `previewAccess(subjectId)` computes all resources × all 8
actions through dry-run evaluations, so previews never grow the
audit log.

### The purpose rule

Grants are **purpose-limited**. When a request states a purpose,
it must equal the grant's purpose exactly — a `treatment` grant
does not authorize a `research` request. When a request states no
purpose, it is matched on scope/action/status alone.

`TRAINING_PURPOSE` (`"model-training"`) is the sharp edge of the
rule: a request with purpose `model-training` matches only a grant
whose purpose is exactly `model-training`. Ordinary grants —
however broad their scope and actions — never authorize training
on a member's data.

### Deny wins

Denials are checked before grants, always. There is no grant
strong enough to override an explicit denial, and removing the
denial is the only way the grant path reopens.

### The legacy never-public guard — exact implementation

A member's `LegacyDirective.neverPublic` lists domains that must
never become public. The engine implements the guard inside the
grant-matching step, after explicit denials:

- A grant is **public-scoped** when its grantee is a group whose
  `type` is `"public"`.
- The guard applies to a resource when the resource owner's
  directive exists, its `memorialization.state` is `"verified"`,
  and the resource's domain is in `neverPublic`.
- Among the grants that otherwise match (grantee, scope, action,
  active status, purpose), the engine first looks for a
  **non-public-scoped** match: if one exists, it allows — a family
  steward's legitimate path is untouched.
- If **every** matching grant is public-scoped and the guard
  applies, evaluation returns a synthetic deny explaining the
  directive, instead of allowing through the public path.
- If the guard does not apply (directive absent, memorialization
  not yet verified, or the domain is not listed), a public-scoped
  grant behaves like any other grant.

This is deliberately narrow: it closes the public path into
never-public domains once a death is verified and memorialization
is in force, and it does nothing before that point.

## Revocation and the consent-core purge hook

`revokeGrant` sets `revokedAt` (access denies from that instant —
status is computed at evaluation time, so revocation is immediate)
and appends a `"grant-revoked"` audit event. It then composes
consent-core's sync primitives, truthfully, without fabricating
consent receipts:

1. For the grantee subject — or, for a group grant, for **each
   member subject** of the group — every `ContextCache` supplied
   to the engine's constructor is purged of all entries whose
   `subjectId` matches (any scope, any ring).
2. If any purged entry had scope `"ai"`, exactly **one**
   `createSyncEvent({ type: "ai.context.purge", subjectId, ring:
   <ring of the first purged AI entry>, localVersion:
   syncLog.countForSubject(subjectId) + 1, conflictPolicy:
   "local_wins" })` is appended to the supplied `SyncEventLog`,
   and a `"context-purge"` audit event is appended to the
   engine's own log.

Revoking an already-revoked grant is a no-op. The same hook shape
is what consent-core's own `revokeConsentAndPurge` uses for
receipts; here it is keyed on policy subjects instead of receipts
because this package's grants — not consent receipts — are what
was revoked.

## No self-escalation

`createGrant` throws when:

- `grantedBy` resolves to a subject with kind `"agent"` — **agents
  can never source grants**;
- `grantedBy === granteeSubjectId` — no self-grants;
- the grant is malformed: not exactly one of
  `granteeSubjectId`/`granteeGroupId`; neither `resourceId` nor
  `domain`; an unknown granter, grantee, resource, domain, or
  action; an empty purpose or action list; or a duplicate id.

`decideRequest(id, approve, grantedBy)` creates the approved
request's grant **through `createGrant`** with the deciding member
as `grantedBy`, so these guards protect the request path too — and
a grant that fails validation leaves the request pending.

## Why a new package, not consent-core v2

Consent-core's ring-exact API — `canAccess(requiredRing, receipt,
now)` over four rings, with receipts as the unit of consent — is a
**load-bearing primitive**: it is consumed across the app (legacy
engine, UI, sync/purge flows) precisely because its semantics are
small and exact. The directive's model is a different, larger
shape: arbitrary subjects and agents, ten data domains, eight
actions, purposes, group membership, passes, denials, requests,
and directives. Folding that into consent-core would either break
the exact-ring contract its consumers rely on or bury it under a
second, generalized API living in the same package.

So the generalized model is a **new layer that composes
consent-core instead of forking it**: `@omega/policy-engine`
depends on `@omega/consent-core` (`workspace:*`) and reuses its
`SyncEventLog`, `ContextCache`, and `createSyncEvent` for the
revocation purge. Nothing in consent-core changed.

## Demo fixture (`src/demo-fixture.ts`)

`createDemoPolicyState()` returns a fresh deep policy state per
call for a fictional member, **June Calloway** (`DEMO_MEMBER_ID =
"member-june"`): 7 subjects (member, doctor, daughter, friend,
coworker, public visitor, and the Digital Archivist agent), 6
groups, 14 resources across all ten domains, 8 grants, 2 passes
(one active archivist pass bound to `task-organize-archive`, one
long-expired second-opinion pass), 1 denial, 1 pending request,
and 2 legacy directives — June's, plus the exported
`ELIAS_LEGACY_DIRECTIVE` for Elias Marlowe, whose archive the
Eternal Garden preserves. Every display name and summary that
represents a record carries `(synthetic)` labeling.

`src/security.test.ts` is the directive §9 security-test matrix
run against this fixture: purpose-limited healthcare access,
family/friend/coworker/public scoping, deny-wins on the
performance review, the agent pass and its task completion, the
expired pass, instant revocation with cache purge + purge sync
event, the training-purpose wall, agent/self-grant escalation
guards, deny-by-default for unknown actions/resources/subjects,
registry queries, audit discipline (previews don't audit), and
the never-public directive guard.

## Honesty note

Enforcement lives in **this tested package**, on every demo data
path: the web surfaces evaluate through `PolicyEngine`, and the
§9 matrix proves the semantics. There is **no server or database
enforcement yet** — this package is in-memory, and policy state is
only as durable as its host process. Server/DB enforcement
arrives with the server; the production data model it will
enforce is specified in `docs/PRODUCTION_SCHEMA.md`.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — lint `src/`
- `pnpm test` — run the vitest suite (`src/index.test.ts`,
  `src/security.test.ts`)
