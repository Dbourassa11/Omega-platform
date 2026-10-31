# Omega Platform — Production Database Schema (Design Artifact)

> **⚠️ DESIGN ARTIFACT — NOT DEPLOYED.**
>
> This document is a **design artifact only**. It is **not deployed**: the DDL
> below has not been migrated, applied, or connected to any running system,
> database, or environment.
>
> The running demo enforces policy in the tested `@omega/policy-engine`
> package on every data path. Server-side enforcement — this schema,
> row-level security, and middleware — arrives with the production server,
> which does not exist yet.
>
> **No legal or healthcare compliance is claimed or implied by this
> document.** Nothing here certifies HIPAA, GDPR, or any other regulatory
> compliance. The `healthcare` domain below is a policy classification, not
> a compliance claim.

**Credit:** Creator David Charles Bourassa · Quantum Concepts LLC
**Scope:** Universal Access directive §8 — production data model
**Status:** Design draft for review · Migration slot reserved: `0001`
**Database target:** PostgreSQL 15+

---

## 1. Purpose

The Universal Access directive (§8) names the entities the production
platform must persist so that access to a member's data is always
*granted deliberately, limited by purpose, bounded in time, and audited*.
The demo proves that policy logic in TypeScript (`@omega/policy-engine`).
This schema is where that same policy becomes durable, server-side state:
the database — not the client, and not the agent — is the final authority
on who may see, change, export, or administer what.

This document contains:

1. Design principles (§2)
2. An entity → policy-engine-type mapping (§4)
3. Runnable-order PostgreSQL DDL for every §8 entity (§5)
4. A row-level-security (RLS) summary (§6)
5. A migration / rollout note (§7)

## 2. Design principles

1. **Deny by default.** Absence of a grant row means *no access*. There is
   no implicit, ambient, or "logged-in therefore allowed" access. Every
   table ships with RLS enabled and no permissive fallback policy.
2. **Deny wins.** An active row in `individual_access_denials` overrides
   any grant, policy, group membership, temporary pass, or agent
   capability that would otherwise allow the same access. Evaluation
   order is fixed: **denials are checked before grants** (see the comment
   on `individual_access_denials` in §5 and the evaluation order in §6.1).
3. **Purpose limitation.** Every grant and pass carries a non-null
   `purpose`. A grant authorises the named action, on the named resource,
   for the named purpose — nothing else. Reuse for a second purpose
   requires a second grant.
4. **Expiration is structural, not advisory.** Grants, passes, consents,
   and agent capabilities carry `expires_at`; task-bound grants also carry
   `task_id` / `task_completed_at` and die when the task completes,
   whichever comes first. Expired or revoked rows are inert and are never
   deleted silently — they remain for audit.
5. **Audit everything.** Every allow, deny, grant, revocation, consent
   change, request decision, agent execution, and legacy event writes an
   `audit_events` row. The audit table is append-only for the application
   role: no `UPDATE` policy, no `DELETE` policy.
6. **No post-death public flip.** Death, memorialisation, or legacy
   activation never makes private data public. `legacy_directives` and
   `memorialization_verifications` change *who administers under the
   directive*, never the classification of a resource. A resource becomes
   `public-released` only by an explicit, audited release action while the
   governing directive permits it.
7. **Agents are principals, not backdoors.** AI agents authenticate as
   `agent_identities`, hold enumerated `agent_capabilities`, and are
   evaluated by the same deny-first order as humans. Every agent action
   lands in `agent_execution_logs` and `audit_events`.
8. **Minimum necessary columns.** Tables store the identifiers, states,
   and timestamps policy evaluation needs. Content payloads live behind
   `data_resources.storage_ref`; the schema governs access to content, it
   does not become the content store.

## 3. Conventions

| Convention | Rule |
|---|---|
| Primary keys | `uuid`, default `gen_random_uuid()` |
| Timestamps | `timestamptz`, `created_at` / `updated_at` on mutable tables; event tables are insert-timestamped only |
| Enums | PostgreSQL `CREATE TYPE … AS ENUM`; small closed sets that policy also validates use `CHECK` instead |
| Domains | The ten policy-engine domains, exactly: `identity`, `family-heritage`, `social`, `healthcare`, `employment`, `financial`, `intellectual-property`, `ai-agents`, `legacy`, `public-released` |
| Actions | The eight policy-engine actions, exactly: `view`, `create`, `edit`, `comment`, `contribute`, `export`, `share`, `admin` |
| Soft state | Revocation / completion / expiry are timestamp columns (`revoked_at`, `task_completed_at`, `expires_at`), never row deletion |
| RLS context | Policies read `app.current_member_id` / `app.current_agent_id` session settings set by server middleware per request |
| Naming | Snake-case plural tables; foreign keys named `<parent_singular>_id` |

### 3.1 Count reconciliation (directive says 22; the list contains 23)

The directive §8 text states **22** entities, but its enumerated list
contains **23 distinct names**. All 23 are designed below — none was
dropped to force the count:

`members`, `member_profiles`, `relationships`, `relationship_groups`,
`group_memberships`, `data_resources`, `resource_classifications`,
`access_policies`, `access_grants`, `individual_access_denials`,
`consent_records`, `temporary_access_passes`, `access_requests`,
`audit_events`, `agent_identities`, `agent_capabilities`,
`agent_execution_logs`, `digital_archives`, `legacy_directives`,
`legacy_stewards`, `memorialization_verifications`,
`legacy_mirror_sessions`, `project_continuity_authorizations`.

**Reconciliation note for the directive's next revision:** either the
headline number should read 23, or two listed names were intended as one
entity (the most plausible merge candidate is `legacy_directives` /
`project_continuity_authorizations`, which this schema deliberately keeps
separate: a directive states a member's wishes; a continuity
authorisation is a scoped grant made under one).

## 4. Entity → policy-engine-type mapping

| # | Table | Policy-engine type / concept | Role in evaluation |
|---|---|---|---|
| 1 | `members` | `Member` (principal) | Root identity every other row anchors to |
| 2 | `member_profiles` | `MemberProfile` | Display / profile data, domain `identity` |
| 3 | `relationships` | `Relationship` | Typed member↔member edge (family, friend, colleague, steward…) |
| 4 | `relationship_groups` | `RelationshipGroup` | Named circle a policy can reference as a subject set |
| 5 | `group_memberships` | `GroupMembership` | Member's membership in a group, with role |
| 6 | `data_resources` | `DataResource` | The thing being accessed; carries owner + domain |
| 7 | `resource_classifications` | `ResourceClassification` | Sensitivity / release classification history per resource |
| 8 | `access_policies` | `AccessPolicy` | Standing owner-authored rules (subject set → action set) |
| 9 | `access_grants` | `AccessGrant` | Purpose-limited, expiring, task-bindable permission |
| 10 | `individual_access_denials` | `IndividualAccessDenial` | Person-specific deny; **evaluated first, always wins** |
| 11 | `consent_records` | `ConsentRecord` | Grant/withdrawal of consent for a domain + purpose |
| 12 | `temporary_access_passes` | `TemporaryAccessPass` | Short-lived, single-purpose pass (e.g. one appointment, one showing) |
| 13 | `access_requests` | `AccessRequest` | Ask → decide workflow that can mint a grant on approval |
| 14 | `audit_events` | `AuditEvent` | Append-only record of every decision and mutation |
| 15 | `agent_identities` | `AgentIdentity` (principal) | A registered AI agent acting for an owner member |
| 16 | `agent_capabilities` | `AgentCapability` | Enumerated, expiring capability an agent holds |
| 17 | `agent_execution_logs` | `AgentExecutionLog` | Per-run record of what an agent did, under which capability |
| 18 | `digital_archives` | `DigitalArchive` | Sealed collection of resources under retention rules |
| 19 | `legacy_directives` | `LegacyDirective` | Member's post-death / incapacity instructions |
| 20 | `legacy_stewards` | `LegacySteward` | Person appointed under a directive, with scoped role |
| 21 | `memorialization_verifications` | `MemorializationVerification` | Verified evidence a memorialisation state change rests on |
| 22 | `legacy_mirror_sessions` | `LegacyMirrorSession` | Time-boxed session where a steward/agent acts as the member's mirror |
| 23 | `project_continuity_authorizations` | `ProjectContinuityAuthorization` | Scoped authorisation for a project to continue under named people |

---

## 5. DDL

One block, in runnable order: extensions and enum types first, then
tables in foreign-key dependency order, each followed by its indexes and
an RLS note. `ENABLE ROW LEVEL SECURITY` is applied per table; the
individual `CREATE POLICY` statements are summarised in §6 and are part
of the same production migration — they are specified there rather than
repeated inline so this block stays readable.

```sql
-- =====================================================================
-- Omega Platform — production schema, migration 0001 (DESIGN ARTIFACT)
-- NOT APPLIED ANYWHERE. See header of PRODUCTION_SCHEMA.md.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;    -- members.email

-- ---------- Enum types (aligned to @omega/policy-engine) -------------

CREATE TYPE data_domain AS ENUM (
  'identity', 'family-heritage', 'social', 'healthcare', 'employment',
  'financial', 'intellectual-property', 'ai-agents', 'legacy',
  'public-released'
);

CREATE TYPE access_action AS ENUM (
  'view', 'create', 'edit', 'comment', 'contribute', 'export', 'share',
  'admin'
);

CREATE TYPE member_status AS ENUM (
  'active', 'suspended', 'memorialized', 'deceased', 'closed'
);

CREATE TYPE relationship_kind AS ENUM (
  'family', 'partner', 'friend', 'colleague', 'caregiver',
  'professional', 'steward', 'other'
);

CREATE TYPE relationship_status AS ENUM ('active', 'ended', 'blocked');

CREATE TYPE classification_level AS ENUM (
  'private', 'shared', 'restricted', 'sealed', 'public-released'
);

CREATE TYPE policy_effect AS ENUM ('allow');  -- denies live in their own table

CREATE TYPE consent_status AS ENUM (
  'granted', 'withdrawn', 'expired', 'superseded'
);

CREATE TYPE request_status AS ENUM (
  'pending', 'approved', 'denied', 'withdrawn', 'expired'
);

CREATE TYPE audit_outcome AS ENUM ('allowed', 'denied', 'error', 'noted');

CREATE TYPE agent_status AS ENUM ('active', 'suspended', 'retired');

CREATE TYPE archive_status AS ENUM (
  'open', 'sealed', 'under-review', 'released', 'destroyed'
);

CREATE TYPE legacy_directive_status AS ENUM (
  'draft', 'active', 'activated', 'revoked', 'superseded', 'fulfilled'
);

CREATE TYPE verification_status AS ENUM (
  'pending', 'verified', 'rejected', 'expired'
);

CREATE TYPE mirror_session_status AS ENUM (
  'scheduled', 'active', 'ended', 'revoked'
);

CREATE TYPE continuity_status AS ENUM (
  'proposed', 'active', 'suspended', 'ended', 'revoked'
);

-- ---------- 1. members -------------------------------------------------

CREATE TABLE members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE,
  display_name  text NOT NULL,
  status        member_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);
-- citext is provided by the citext extension, enabled alongside pgcrypto
-- in the production migration preamble.
CREATE INDEX members_status_created_idx ON members (status, created_at);
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
-- RLS: a member sees their own row; admins of the platform role see all.
-- No self-registration INSERT policy for the app role (provisioning only).

-- ---------- 2. member_profiles -----------------------------------------

CREATE TABLE member_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL UNIQUE REFERENCES members (id) ON DELETE CASCADE,
  bio           text,
  avatar_ref    text,                       -- storage reference, not a blob
  locale        text DEFAULT 'en',
  timezone      text DEFAULT 'UTC',
  profile_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_profiles_member_idx ON member_profiles (member_id);
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
-- RLS: owner read/write; other members only where a view grant on the
-- owner's identity-domain profile resource exists.

-- ---------- 3. relationships -------------------------------------------

CREATE TABLE relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  related_member_id  uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  kind               relationship_kind NOT NULL,
  status             relationship_status NOT NULL DEFAULT 'active',
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  CHECK (member_id <> related_member_id)
);
CREATE INDEX relationships_member_idx
  ON relationships (member_id, status);
CREATE INDEX relationships_related_idx
  ON relationships (related_member_id, status);
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
-- RLS: visible to the two parties only; a blocked relationship is
-- visible to the blocker for audit, hidden from the blocked member.

-- ---------- 4. relationship_groups --------------------------------------

CREATE TABLE relationship_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (owner_id, name)
);
CREATE INDEX relationship_groups_owner_idx
  ON relationship_groups (owner_id, created_at);
ALTER TABLE relationship_groups ENABLE ROW LEVEL SECURITY;
-- RLS: owner full control; group members may see the group's existence
-- and name, never its full membership list unless the owner grants it.

-- ---------- 5. group_memberships ----------------------------------------

CREATE TABLE group_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES relationship_groups (id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member'
             CHECK (role IN ('member', 'manager')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  UNIQUE (group_id, member_id)
);
CREATE INDEX group_memberships_member_idx
  ON group_memberships (member_id) WHERE left_at IS NULL;
CREATE INDEX group_memberships_group_idx
  ON group_memberships (group_id) WHERE left_at IS NULL;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
-- RLS: group owner and fellow active members (existence only, per the
-- group policy above); historical rows (left_at set) owner-only.

-- ---------- 6. data_resources -------------------------------------------

CREATE TABLE data_resources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  domain       data_domain NOT NULL,
  kind         text NOT NULL,               -- photo, document, record, post…
  title        text,
  storage_ref  text NOT NULL,               -- object-store key / URI
  content_hash text,                        -- integrity check, not content
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX data_resources_owner_domain_idx
  ON data_resources (owner_id, domain, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX data_resources_hash_idx ON data_resources (content_hash);
ALTER TABLE data_resources ENABLE ROW LEVEL SECURITY;
-- RLS: owner-or-grantee visibility — owner always; anyone else only via
-- an active grant / pass / policy covering (resource, action) after the
-- denial check. deleted_at rows are owner- and audit-visible only.

-- ---------- 7. resource_classifications ---------------------------------

CREATE TABLE resource_classifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   uuid NOT NULL REFERENCES data_resources (id) ON DELETE CASCADE,
  level         classification_level NOT NULL,
  classified_by uuid NOT NULL REFERENCES members (id),
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);
CREATE INDEX resource_classifications_current_idx
  ON resource_classifications (resource_id, created_at DESC)
  WHERE superseded_at IS NULL;
ALTER TABLE resource_classifications ENABLE ROW LEVEL SECURITY;
-- RLS: readable by anyone who can view the resource; writable only by
-- the resource owner or an admin grantee. History rows are immutable
-- (no UPDATE policy; superseding inserts a new row).

-- ---------- 8. access_policies -------------------------------------------

CREATE TABLE access_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  domain          data_domain NOT NULL,
  resource_id     uuid REFERENCES data_resources (id) ON DELETE CASCADE,
  subject_group_id uuid REFERENCES relationship_groups (id) ON DELETE CASCADE,
  subject_member_id uuid REFERENCES members (id) ON DELETE CASCADE,
  actions         access_action[] NOT NULL,
  effect          policy_effect NOT NULL DEFAULT 'allow',
  purpose         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  CHECK (subject_group_id IS NOT NULL OR subject_member_id IS NOT NULL),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE INDEX access_policies_owner_domain_idx
  ON access_policies (owner_id, domain) WHERE revoked_at IS NULL;
CREATE INDEX access_policies_resource_idx
  ON access_policies (resource_id) WHERE revoked_at IS NULL;
ALTER TABLE access_policies ENABLE ROW LEVEL SECURITY;
-- RLS: owner-only read/write. A policy is data the owner manages; it is
-- never visible to its subjects (subjects see effects, not rules).

-- ---------- 9. access_grants ----------------------------------------------
-- Purpose-limited permission. One row = one grantee, one action.
-- A grant is ACTIVE only when: revoked_at IS NULL, task_completed_at
-- IS NULL, and (expires_at IS NULL OR expires_at > now()).

CREATE TABLE access_grants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id       uuid NOT NULL REFERENCES data_resources (id) ON DELETE CASCADE,
  grantor_id        uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  grantee_member_id uuid REFERENCES members (id) ON DELETE CASCADE,
  grantee_agent_id  uuid,  -- FK added after agent_identities (see below)
  action            access_action NOT NULL,
  purpose           text NOT NULL,
  task_id           uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  task_completed_at timestamptz,
  revoked_at        timestamptz,
  revoked_by        uuid REFERENCES members (id),
  CHECK (grantee_member_id IS NOT NULL OR grantee_agent_id IS NOT NULL),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE INDEX access_grants_resource_idx
  ON access_grants (resource_id, action) WHERE revoked_at IS NULL;
CREATE INDEX access_grants_grantee_member_idx
  ON access_grants (grantee_member_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX access_grants_task_idx
  ON access_grants (task_id) WHERE task_id IS NOT NULL;
ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;
-- RLS: grantor and grantee can read the grant; only the grantor (or an
-- admin grantee on the resource) can revoke. Grants never widen on
-- UPDATE — action/resource/grantee columns are immutable by policy.

-- ---------- 10. individual_access_denials ---------------------------------
-- DENY-WINS. EVALUATION-ORDER IMPLICATION: policy evaluation MUST check
-- this table BEFORE access_grants, access_policies, temporary passes,
-- group membership, and agent capabilities. Any active denial matching
-- (subject, resource-or-domain, action-or-all) ends evaluation as DENY,
-- regardless of what any later-checked table contains. A NULL
-- resource_id means the denial covers the whole domain; a NULL action
-- means it covers every action.

CREATE TABLE individual_access_denials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  denied_member_id  uuid REFERENCES members (id) ON DELETE CASCADE,
  denied_agent_id   uuid,  -- FK added after agent_identities (see below)
  resource_id       uuid REFERENCES data_resources (id) ON DELETE CASCADE,
  domain            data_domain,
  action            access_action,
  reason            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid NOT NULL REFERENCES members (id),
  expires_at        timestamptz,
  revoked_at        timestamptz,
  CHECK (denied_member_id IS NOT NULL OR denied_agent_id IS NOT NULL),
  CHECK (resource_id IS NOT NULL OR domain IS NOT NULL)
);
CREATE INDEX individual_access_denials_subject_idx
  ON individual_access_denials (denied_member_id, resource_id)
  WHERE revoked_at IS NULL;
CREATE INDEX individual_access_denials_resource_idx
  ON individual_access_denials (resource_id) WHERE revoked_at IS NULL;
ALTER TABLE individual_access_denials ENABLE ROW LEVEL SECURITY;
-- RLS: owner-only read/write. The denied subject is NOT notified of the
-- row's existence by the database layer; evaluation returns plain DENY.

-- ---------- 11. consent_records -------------------------------------------

CREATE TABLE consent_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  domain      data_domain NOT NULL,
  purpose     text NOT NULL,
  status      consent_status NOT NULL DEFAULT 'granted',
  granted_at  timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  expires_at  timestamptz,
  source      text,                        -- surface where consent was captured
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_records_member_domain_idx
  ON consent_records (member_id, domain, status, granted_at DESC);
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
-- RLS: the consenting member reads and withdraws their own records;
-- a processor/grantee may check existence of an active consent for the
-- exact (domain, purpose) pair — and nothing beyond that existence.

-- ---------- 12. temporary_access_passes ------------------------------------

CREATE TABLE temporary_access_passes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id       uuid NOT NULL REFERENCES data_resources (id) ON DELETE CASCADE,
  issuer_id         uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  holder_member_id  uuid REFERENCES members (id) ON DELETE CASCADE,
  holder_agent_id   uuid,  -- FK added after agent_identities (see below)
  action            access_action NOT NULL DEFAULT 'view',
  purpose           text NOT NULL,
  token_hash        text NOT NULL UNIQUE,  -- hash only; the pass token itself is never stored
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  redeemed_at       timestamptz,
  max_redemptions   integer NOT NULL DEFAULT 1 CHECK (max_redemptions >= 1),
  redemption_count  integer NOT NULL DEFAULT 0,
  revoked_at        timestamptz,
  CHECK (holder_member_id IS NOT NULL OR holder_agent_id IS NOT NULL
         OR token_hash IS NOT NULL)
);
CREATE INDEX temporary_access_passes_resource_idx
  ON temporary_access_passes (resource_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX temporary_access_passes_holder_idx
  ON temporary_access_passes (holder_member_id, expires_at);
ALTER TABLE temporary_access_passes ENABLE ROW LEVEL SECURITY;
-- RLS: issuer full control; holder sees their own passes; redemption is
-- a server-side function, not a direct app-role UPDATE.

-- ---------- 13. access_requests ---------------------------------------------

CREATE TABLE access_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id      uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  resource_id       uuid REFERENCES data_resources (id) ON DELETE CASCADE,
  domain            data_domain,
  action            access_action NOT NULL,
  purpose           text NOT NULL,
  status            request_status NOT NULL DEFAULT 'pending',
  decided_by        uuid REFERENCES members (id),
  decided_at        timestamptz,
  decision_note     text,
  resulting_grant_id uuid REFERENCES access_grants (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  CHECK (resource_id IS NOT NULL OR domain IS NOT NULL)
);
CREATE INDEX access_requests_owner_pending_idx
  ON access_requests (owner_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX access_requests_requester_idx
  ON access_requests (requester_id, created_at DESC);
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
-- RLS: requester and owner see the request; only the owner decides.
-- Approval mints an access_grants row (resulting_grant_id) in the same
-- transaction — a request alone never confers access.

-- ---------- 14. audit_events -------------------------------------------------
-- Append-only. No UPDATE policy and no DELETE policy exist for the app
-- role; corrections are new events referencing the original.

CREATE TABLE audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_member_id uuid REFERENCES members (id),
  actor_agent_id  uuid,  -- FK added after agent_identities (see below)
  subject_member_id uuid REFERENCES members (id),
  resource_id   uuid REFERENCES data_resources (id),
  domain        data_domain,
  action        access_action,
  outcome       audit_outcome NOT NULL,
  event_type    text NOT NULL,  -- grant.created, access.denied, consent.withdrawn…
  purpose       text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_member_id IS NOT NULL OR actor_agent_id IS NOT NULL
         OR event_type = 'system')
);
CREATE INDEX audit_events_resource_time_idx
  ON audit_events (resource_id, created_at DESC);
CREATE INDEX audit_events_actor_time_idx
  ON audit_events (actor_member_id, created_at DESC);
CREATE INDEX audit_events_subject_time_idx
  ON audit_events (subject_member_id, created_at DESC);
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
-- RLS: INSERT-only for the app role. Read: resource owner reads events
-- about their resources; a member reads events where they are subject.
-- Platform audit role reads all; nobody updates or deletes.

-- ---------- 15. agent_identities ----------------------------------------------

CREATE TABLE agent_identities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  name         text NOT NULL,
  kind         text NOT NULL,              -- assistant, mirror, automation…
  status       agent_status NOT NULL DEFAULT 'active',
  public_key   text,                       -- credential verification material
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  retired_at   timestamptz,
  UNIQUE (owner_id, name)
);
CREATE INDEX agent_identities_owner_idx
  ON agent_identities (owner_id, status);
ALTER TABLE agent_identities ENABLE ROW LEVEL SECURITY;
-- RLS: owner full control; other principals see only that an agent
-- exists when it acts on a resource they can view (via audit events).

-- Deferred FKs: agent references declared above, bound now that
-- agent_identities exists (keeps this block in runnable order).
ALTER TABLE access_grants
  ADD CONSTRAINT access_grants_grantee_agent_fk
  FOREIGN KEY (grantee_agent_id) REFERENCES agent_identities (id)
  ON DELETE CASCADE;
ALTER TABLE individual_access_denials
  ADD CONSTRAINT individual_access_denials_agent_fk
  FOREIGN KEY (denied_agent_id) REFERENCES agent_identities (id)
  ON DELETE CASCADE;
ALTER TABLE temporary_access_passes
  ADD CONSTRAINT temporary_access_passes_agent_fk
  FOREIGN KEY (holder_agent_id) REFERENCES agent_identities (id)
  ON DELETE CASCADE;
ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_actor_agent_fk
  FOREIGN KEY (actor_agent_id) REFERENCES agent_identities (id);

-- ---------- 16. agent_capabilities ----------------------------------------------

CREATE TABLE agent_capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES agent_identities (id) ON DELETE CASCADE,
  domain      data_domain NOT NULL,
  action      access_action NOT NULL,
  resource_id uuid REFERENCES data_resources (id) ON DELETE CASCADE,
  purpose     text NOT NULL,
  granted_by  uuid NOT NULL REFERENCES members (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);
CREATE INDEX agent_capabilities_agent_idx
  ON agent_capabilities (agent_id, domain, action)
  WHERE revoked_at IS NULL;
ALTER TABLE agent_capabilities ENABLE ROW LEVEL SECURITY;
-- RLS: the agent's owner grants/revokes/reads. A capability never
-- overrides an individual_access_denials row naming that agent.

-- ---------- 17. agent_execution_logs ----------------------------------------------

CREATE TABLE agent_execution_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES agent_identities (id) ON DELETE CASCADE,
  capability_id uuid REFERENCES agent_capabilities (id),
  resource_id   uuid REFERENCES data_resources (id),
  action        access_action,
  outcome       audit_outcome NOT NULL,
  summary       text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX agent_execution_logs_agent_time_idx
  ON agent_execution_logs (agent_id, started_at DESC);
CREATE INDEX agent_execution_logs_resource_idx
  ON agent_execution_logs (resource_id, started_at DESC);
ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;
-- RLS: INSERT by the executing agent's server context only; read by the
-- agent's owner and by owners of resources the run touched. Append-only
-- for the app role, same as audit_events.

-- ---------- 18. digital_archives ----------------------------------------------------

CREATE TABLE digital_archives (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  status       archive_status NOT NULL DEFAULT 'open',
  retention_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  sealed_at    timestamptz
);
CREATE INDEX digital_archives_owner_idx
  ON digital_archives (owner_id, status, created_at DESC);
ALTER TABLE digital_archives ENABLE ROW LEVEL SECURITY;
-- RLS: owner full control while open; a sealed archive is read-only to
-- everyone including the owner until an audited unseal event. Archive
-- membership of resources is expressed via data_resources rows whose
-- storage_ref / classification the archive governs — sealing never
-- changes a resource's classification by itself.

-- ---------- 19. legacy_directives ------------------------------------------------------

CREATE TABLE legacy_directives (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  status       legacy_directive_status NOT NULL DEFAULT 'draft',
  instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  version      integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX legacy_directives_member_idx
  ON legacy_directives (member_id, status, version DESC);
ALTER TABLE legacy_directives ENABLE ROW LEVEL SECURITY;
-- RLS: the member alone reads/writes while living and competent.
-- Stewards named in the directive may read it only after activation.
-- Activation never flips any resource to public (principle 6).

-- ---------- 20. legacy_stewards ------------------------------------------------------------

CREATE TABLE legacy_stewards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_id uuid NOT NULL REFERENCES legacy_directives (id) ON DELETE CASCADE,
  steward_id   uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'steward'
               CHECK (role IN ('steward', 'executor', 'witness', 'successor')),
  scope_domains data_domain[] NOT NULL DEFAULT '{}',
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  removed_at   timestamptz,
  UNIQUE (directive_id, steward_id)
);
CREATE INDEX legacy_stewards_steward_idx
  ON legacy_stewards (steward_id) WHERE removed_at IS NULL;
CREATE INDEX legacy_stewards_directive_idx
  ON legacy_stewards (directive_id) WHERE removed_at IS NULL;
ALTER TABLE legacy_stewards ENABLE ROW LEVEL SECURITY;
-- RLS: directive owner manages; a steward sees their own appointment
-- and, post-activation, only the domains in scope_domains.

-- ---------- 21. memorialization_verifications --------------------------------------------------

CREATE TABLE memorialization_verifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  status        verification_status NOT NULL DEFAULT 'pending',
  evidence_ref  text,                      -- storage reference, never the document itself
  evidence_kind text,                      -- death certificate, court order…
  submitted_by  uuid NOT NULL REFERENCES members (id),
  reviewed_by   uuid REFERENCES members (id),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  expires_at    timestamptz
);
CREATE INDEX memorialization_verifications_member_idx
  ON memorialization_verifications (member_id, status, submitted_at DESC);
CREATE INDEX memorialization_verifications_queue_idx
  ON memorialization_verifications (submitted_at) WHERE status = 'pending';
ALTER TABLE memorialization_verifications ENABLE ROW LEVEL SECURITY;
-- RLS: platform verification role + submitter only. A 'verified' row is
-- the sole trigger permitted to move members.status to 'memorialized'
-- or 'deceased' — and that move changes administration, not visibility.

-- ---------- 22. legacy_mirror_sessions --------------------------------------------------------------

CREATE TABLE legacy_mirror_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  directive_id  uuid REFERENCES legacy_directives (id) ON DELETE SET NULL,
  agent_id      uuid REFERENCES agent_identities (id) ON DELETE SET NULL,
  steward_id    uuid REFERENCES members (id),
  status        mirror_session_status NOT NULL DEFAULT 'scheduled',
  purpose       text NOT NULL,
  scheduled_for timestamptz,
  started_at    timestamptz,
  ended_at      timestamptz,
  transcript_ref text,                     -- storage reference for the session record
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (agent_id IS NOT NULL OR steward_id IS NOT NULL)
);
CREATE INDEX legacy_mirror_sessions_member_time_idx
  ON legacy_mirror_sessions (member_id, created_at DESC);
CREATE INDEX legacy_mirror_sessions_status_idx
  ON legacy_mirror_sessions (status, scheduled_for);
ALTER TABLE legacy_mirror_sessions ENABLE ROW LEVEL SECURITY;
-- RLS: member (or, post-activation, an in-scope steward) reads session
-- records; sessions run only under an active directive and every action
-- inside a session is separately grant- and denial-checked.

-- ---------- 23. project_continuity_authorizations ------------------------------------------------------------

CREATE TABLE project_continuity_authorizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  directive_id  uuid REFERENCES legacy_directives (id) ON DELETE SET NULL,
  project_ref   text NOT NULL,             -- external/stable project identifier
  project_title text,
  status        continuity_status NOT NULL DEFAULT 'proposed',
  scope         jsonb NOT NULL DEFAULT '{}'::jsonb,
  authorized_member_id uuid REFERENCES members (id),
  authorized_agent_id  uuid REFERENCES agent_identities (id),
  purpose       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  starts_at     timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  CHECK (authorized_member_id IS NOT NULL OR authorized_agent_id IS NOT NULL)
);
CREATE INDEX project_continuity_owner_idx
  ON project_continuity_authorizations (owner_id, status, created_at DESC);
CREATE INDEX project_continuity_project_idx
  ON project_continuity_authorizations (project_ref, status);
ALTER TABLE project_continuity_authorizations ENABLE ROW LEVEL SECURITY;
-- RLS: owner manages; the authorised member/agent sees their own
-- authorisation. Continuity confers only the actions enumerated in
-- scope, only after directive activation where a directive is linked,
-- and never overrides a denial.
```

### 5.1 Notes on the DDL

- **`citext`:** `members.email` uses `citext`; the production migration
  preamble enables the `citext` extension next to `pgcrypto`. It is
  called out inline so the block is not run half-configured.
- **Deferred agent foreign keys:** `access_grants`,
  `individual_access_denials`, `temporary_access_passes`, and
  `audit_events` reference `agent_identities`, which directive order
  places after them. Their agent FKs are therefore added with
  `ALTER TABLE … ADD CONSTRAINT` immediately after `agent_identities`
  is created, keeping the single block runnable top-to-bottom.
- **State, not deletion:** expiry, revocation, completion, withdrawal,
  and removal are timestamp columns everywhere. Policy evaluation treats
  any non-null revocation/completion timestamp — or a past `expires_at`
  — as *inactive*, and the partial indexes (`WHERE revoked_at IS NULL`)
  keep the hot evaluation paths on active rows only.
- **One action per grant row:** compound permissions are multiple
  `access_grants` rows. This keeps denial matching exact: a denial of
  one action never has to be interpreted against an array.

---

## 6. Row-level security summary

RLS is enabled on **every** table. The app role receives no table-level
bypass; the policies below are the *only* app-role paths. Platform /
verification / audit roles are separate database roles, granted
narrowly, and their use is itself audited.

| Table | SELECT policy (app role) | INSERT / UPDATE / DELETE policy (app role) |
|---|---|---|
| `members` | Own row only | Provisioning role only; no app-role INSERT |
| `member_profiles` | Owner; grantees with an identity-domain view grant | Owner only |
| `relationships` | The two parties (block nuance in §5) | Either party creates; parties update own edge |
| `relationship_groups` | Owner; members see existence/name | Owner only |
| `group_memberships` | Owner; fellow active members (existence) | Owner manages; member may leave (set `left_at`) |
| `data_resources` | Owner-or-grantee, after denial check | Owner only; delete is soft (`deleted_at`) |
| `resource_classifications` | Anyone who can view the resource | Owner / admin grantee; history immutable |
| `access_policies` | Owner only | Owner only |
| `access_grants` | Grantor and grantee | Grantor creates/revokes; core columns immutable |
| `individual_access_denials` | Owner only | Owner only |
| `consent_records` | Consenting member; existence-check for exact (domain, purpose) | Member grants/withdraws own consent |
| `temporary_access_passes` | Issuer; holder (own passes) | Issuer creates/revokes; redemption via server function |
| `access_requests` | Requester and owner | Requester creates/withdraws; owner decides |
| `audit_events` | Owner of the resource; subject member; audit role (all) | **INSERT only — no UPDATE policy, no DELETE policy** |
| `agent_identities` | Owner; existence via audit where agent acted | Owner only |
| `agent_capabilities` | Owner; executing agent (own capabilities) | Owner grants/revokes |
| `agent_execution_logs` | Agent's owner; owners of touched resources | **INSERT only (server/agent context); no UPDATE/DELETE policy** |
| `digital_archives` | Owner; sealed = read-only to all app roles | Owner while `open`; seal/unseal audited |
| `legacy_directives` | Member; in-scope stewards **after activation** | Member only, while living and competent |
| `legacy_stewards` | Directive owner; steward (own appointment) | Directive owner manages |
| `memorialization_verifications` | Verification role; submitter | Submitter files; verification role reviews |
| `legacy_mirror_sessions` | Member; in-scope steward post-activation | Created under an active directive only |
| `project_continuity_authorizations` | Owner; authorised member/agent (own row) | Owner manages |

### 6.1 Evaluation order (normative)

Server middleware and the policy engine must agree on this order —
it is the order the demo's `@omega/policy-engine` implements today and
the order this schema is indexed for:

1. **Denials** — `individual_access_denials`: any active match ⇒ **DENY**, stop.
2. **Consent** — withdrawn/expired `consent_records` for the (domain, purpose) ⇒ **DENY**, stop.
3. **Ownership** — requester owns the resource ⇒ **ALLOW** (subject to classification seals).
4. **Grants** — active `access_grants` matching (resource, action, purpose, task state) ⇒ **ALLOW**.
5. **Temporary passes** — active, unexhausted `temporary_access_passes` ⇒ **ALLOW**.
6. **Policies** — active `access_policies` via direct or group subject ⇒ **ALLOW**.
7. **Agent capabilities** — for agent principals, an active `agent_capabilities` row whose owner also passes steps 1–6 ⇒ **ALLOW**.
8. **Default** — **DENY**, and write the `audit_events` row either way.

---

## 7. Migration / rollout note

- **This schema is migration `0001`** in the production server's
  migration sequence — reserved, **not yet written as a migration file,
  not run, and not connected to any database**. This document is its
  design source of truth until that server exists.
- **Rollout, when the production server is commissioned:** (1) create
  the database roles (app, provisioning, verification, audit) before
  applying DDL; (2) apply `0001` in a single transaction; (3) apply the
  `CREATE POLICY` statements specified in §6 as `0002_rls_policies`;
  (4) run the integration suite against a disposable database before any
  environment with real member data exists.
- **Integration tests:** the integration tests named in the directive
  (deny-wins over grant, purpose mismatch denies, expired grant denies,
  task-completed grant denies, consent withdrawal denies, agent
  capability cannot override a denial, no post-death public flip,
  audit row written on allow *and* on deny) map today to the
  **policy-engine security tests** in the tested `@omega/policy-engine`
  package, which exercise the same evaluation order in §6.1 against the
  in-memory model. When the server lands, those tests are ported —
  not rewritten — to run against this schema, so the demo's proven
  behaviour is the contract the database must satisfy.
- **No backfill exists or is implied.** The demo's data is fixture data;
  nothing in this schema migrates, imports, or represents it.
- **Change rule:** any change to a domain, an action, the evaluation
  order, or the deny-wins rule is a policy change first (policy-engine +
  its tests) and a schema change second — never the reverse.

---

*Design artifact — not deployed. No legal or healthcare compliance is
claimed or implied.*
*Creator David Charles Bourassa · Quantum Concepts LLC.*
