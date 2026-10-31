# @omega/legacy-engine

Legacy Ingestion Engine / Continuity Engine for the Omega Platform —
the mechanical core: a versioned memory vault plus a consistency
scorer over the Eternal Garden archive (`@omega/ai-core`).

Creator: David Charles Bourassa

## Status

`WORKING` — `LEGACY_ENGINE_STATUS = "WORKING"`.

Scope (honest): this is the mechanical core only. The vault is
in-memory — there is no persistence layer yet — and the ingestion
pipeline stages below remain a canonical type surface, not a runtime.
Exports include `LEGACY_ENGINE_SCOPE` stating the same.

Continuity rule: **every memory is versioned; nothing is silently
rewritten; claims must trace to the archive.**

## Versioned Memory Vault (`src/vault.ts`)

`VersionedMemoryVault` stores `LegacyMemory` records as append-only
version chains. Seeding the constructor (or `create`) writes a v1
`"create"` receipt per memory; `amend` and `annotate` each append a
new version — stored earlier versions are never mutated, and the
vault only ever hands out copies, so callers cannot rewrite history
through a returned object.

```ts
const vault = new VersionedMemoryVault(SYNTHETIC_LEGACY_MEMORIES, {
  actor: "garden-archive-audit",
  timestamp: "2026-01-01T00:00:00.000Z",
});
vault.amend("mem-008", { year: 1970 }, { actor, timestamp }); // → v2 receipt
vault.annotate("mem-008", "Checked against the journal.", { actor, timestamp }); // → v3
vault.get("mem-008");       // latest version
vault.history("mem-008");   // all versions, oldest → newest
vault.list();               // latest version of every memory, stable (insertion) order
vault.receipts();           // all receipts, append order
vault.verifyChain("mem-008"); // recompute the hash chain
```

- `create` throws if the id already exists; `amend`/`annotate` throw
  on an unknown id. An id is immutable: a patch cannot rename it.
- `annotate` appends a version whose memory content is identical to
  the previous one; the note lives on the receipt.
- Constructor seed defaults (when `opts` omits them): actor
  `"vault-seed"`, timestamp `"1970-01-01T00:00:00.000Z"` — seeding is
  deterministic: identical input produces identical receipts/hashes.

### Receipts and the hash chain

Every mutation produces a `MemoryReceipt`:

```ts
interface MemoryReceipt {
  versionId: string;   // `${memoryId}@v${version}`
  memoryId: string;
  version: number;     // 1-based, monotonically increasing per memory
  kind: "create" | "amend" | "annotate";
  actor: string;
  timestamp: string;   // ISO, supplied by the caller (deterministic in tests)
  note?: string;
  previousHash: string | null;
  hash: string;
}
```

`hash` is a deterministic fingerprint of
`previousHash + canonical memory JSON + kind + note`, where the
canonical JSON has recursively sorted keys, and the fingerprint is
**FNV-1a (32-bit), hex-encoded**. ⚠️ This is an integrity fingerprint
for the demo core, **not a cryptographic hash** — `@omega/vault-core`
owns real cryptography. `verifyChain(id)` recomputes every link;
`verifyVersionChain(versions)` does the same for an exported chain,
which is how tamper detection is tested (alter one exported version's
content → verification fails; the vault's own chain is unaffected).

## Consistency Scorer (`src/scorer.ts`)

Real-data-only rule, enforced in code: the scorer consults **only**
the vault's memories. It never uses outside data and never invents a
match. All logic is deterministic.

A claim (`ArchiveClaim { id, text, person?, place?, year?, memoryId? }`)
is judged on its structured fields only:

- **Supported** — some single memory matches *every* provided field:
  `person ∈ memory.people`, `place === memory.place`,
  `year === memory.year`. A claim with a `memoryId` is supported only
  when *that* memory matches every provided field (the memoryId pins
  the event).
- **Contradiction** —
  (a) the claim pins a `memoryId` whose memory disagrees with a
  provided field (different year, different place, or a person the
  memory does not list); or
  (b) the claim provides person + year + place, no single memory
  supports all three, but some memory matches person + year while
  recording a different place — the same event with a conflicting
  fact.
- **Unsupported** — no supporting memory and no contradiction rule
  fires: the fields match different memories partially, match nothing,
  the claim references an unknown `memoryId`, or the claim provides
  no structured fields at all.

`scoreClaims(vault, claims)` returns
`{ score, claimsChecked, memoriesChecked, flags }` with
`score = supported / total claims`, and `score = 1` when there are
no claims (an empty claim set contains no contradiction).

### Archive audit

`auditArchive(vault)` derives one claim per memory from the memory
itself (`people[0]` / place / year, pinned by `memoryId`) and runs
`scoreClaims`, plus archive-level checks a single claim cannot
express:

- **year vs. date** — `memory.year` must equal the year in
  `memory.date`;
- **era vs. year** — `memory.year` must fall inside its era's span
  (`ERA_YEAR_RANGES`, derived from the synthetic archive's own era
  sections: childhood 1952–1964, youth 1965–1973, career 1974–1999,
  family 1978–2005, later-years 2006–2024; career and family overlap,
  which is not an error by itself);
- **duplicate titles** — two memories sharing a title but recording
  different years or places is a contradiction.

The audit score is the fraction of derived claims whose memory is
implicated in no flag (`1` when the archive is empty). The shipped
synthetic archive audits clean: score `1`, 32 claims / 32 memories
checked, no flags (verified by the test suite against
`SYNTHETIC_LEGACY_MEMORIES`).

## Garden panel

The Eternal Garden page (`apps/web/app/garden`) renders an
"Archive integrity" panel computed from this package: it seeds a
vault from `SYNTHETIC_LEGACY_MEMORIES`, runs `auditArchive`, and
displays the consistency score, memories/claims checked, and the
versions/receipts count, with any flags listed.

## Scaffold surface (kept)

The original Phase-2 type surface is unchanged and still exported —
other code may reference it:

- `PipelineStage` / `PIPELINE_STAGES` — the 8 ingestion stages
- `IngestionItem { id, sourceType, ring, sha256, status }`
- `PersonaProfile { nodeId, version, driftPercentage }`
- `SAFETY_RULES`:
  - No unsupervised personality drift
  - No fabricated memories presented as fact
  - No voice cloning without explicit documented authorization
  - Clear labels: simulated reflection, not literal consciousness
  - Guardian review for sensitive memories, minors, medical/legal content, posthumous rights

Depends on `@omega/ai-core` (for `LegacyMemory` and the synthetic
archive) and `@omega/consent-core` (for `RingType`).

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — lint `src/`
- `pnpm test` — run the vitest suite (`src/vault.test.ts`,
  `src/scorer.test.ts`)
