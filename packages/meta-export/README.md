# @omega/meta-export

Facebook "Download Your Information" (DYI) export ingest for the Omega
Platform: a synthetic fixture generator, a parser / normalizer with
consent-ring inference, and a converter to cosmos-engine data.

Creator: David Charles Bourassa

## Status

New in Phase 3. Pure logic, no I/O: callers supply export files as
in-memory `{ path, content }` entries. All bundled / generated data is
synthetic and fictional — no real personal data.

## Exports

- `ExportFileEntry { path, content }`
- `RingSource` — `"list" | "inferred" | "default" | "override"`
- `NormalizedPerson { id, name, ring, ringSource, messageCount }`
- `NormalizedPost { id, timestamp, text, title?, ring }`
- `NormalizedMedia { id, title, album?, timestamp, ring }`
- `NormalizedThread { id, title?, participantIds, messageCount, lastTimestamp, ring }`
- `RingCounts { family, friends, work, public }`
- `NormalizedMemberGraph { ownerName, synthetic, people, posts, media, threads, summary }`
  — `summary` is `{ peoplePerRing, postCount, mediaCount, threadCount, unclassifiedCount }`.
- `RingOverride { personId, ring }`
- `parseFacebookExport(files, overrides?)` → `NormalizedMemberGraph`
- `graphToCosmosData(graph)` → `CosmosData` (types from `@omega/cosmos-engine`)
- `generateSyntheticExport(seed?)` → `ExportFileEntry[]` (default seed `42`)
- `SYNTHETIC_EXPORT_OWNER_NAME` — `"Ada Whitfield"`, the fictional owner.

Depends on `@omega/consent-core` for `RingType`
(`"family" | "friends" | "work" | "public"`; family is the innermost /
most private shell, public the outermost) and on
`@omega/cosmos-engine` for types only.

## DYI shapes used

Files are matched by filename suffix, so path prefixes (for example the
`facebook-<name>/` folder a real export ships in) are tolerated. Unknown
files are ignored, and a malformed or wrongly-shaped file is skipped —
parsing never throws on a single bad file.

| Export file | Shape read |
| --- | --- |
| `friends_and_followers/friends/friends.json` | `{ "friends_v2": [{ "name", "timestamp" }] }` |
| `friends_and_followers/friend_lists/friend_lists.json` | `{ "friend_lists_v2": [{ "name", "members": [names] }] }` |
| `your_facebook_activity/posts/your_posts_1.json` | `[{ "timestamp", "title", "data": [{ "post": "…" }] }]` |
| `your_facebook_activity/posts/album_<n>.json` | `{ "name", "photos": [{ "uri", "creation_timestamp", "title" }] }` |
| `messages/inbox/<slug>/message_1.json` | `{ "participants": [{ "name" }], "messages": [{ "sender_name", "timestamp_ms", "content" }], "title", "thread_path" }` |
| `SYNTHETIC_FIXTURE_README.txt` | Presence marks the graph `synthetic: true` (see below) |

Normalization notes:

- **People** are the union of the friends list and all thread
  participants, excluding the owner. Person id is
  `"person:" + slugified name` (lowercase, non-alphanumeric runs → `"-"`).
- **Owner**: the sole participant common to every message thread. If
  that is ambiguous, the most frequent thread participant wins (ties
  broken alphabetically); with no threads, `ownerName` is
  `"Unknown Owner"`.
- **messageCount** (exact rule): in a 1:1 thread (exactly 2 participants
  including the owner), the thread's **total** message count is credited
  to the other person. In a group thread (> 2 participants), each person
  is credited **only with the messages they themselves sent**.
  Owner-sent messages never add to anyone's count beyond the 1:1 total
  rule above.

## Ring inference

Deterministic, in this precedence order:

1. **override** (`ringSource: "override"`) — an explicit `RingOverride`
   for the person's id. Always wins.
2. **list** (`ringSource: "list"`) — friend-list membership. A list name
   containing `family` → `family`; `close` → `friends`; `work`,
   `colleague`, or `coworker` → `work`; `acquaintance` → `public`.
   A person on several lists gets the **most restrictive** ring
   (family > friends > work > public in restrictiveness).
3. **inferred** (`ringSource: "inferred"`) — message frequency:
   `messageCount >= 25` → `friends`.
4. **default** (`ringSource: "default"`) — `family`. **Deny-by-default
   rationale:** an unclassified person has made no classification claim
   and nobody has vouched for a wider audience, so they are placed in
   the innermost, most restrictive ring — visible only in the innermost
   ring view — until a human classifies them. Publishing an
   unclassified person into an outer ring by default would leak first
   and ask questions later; defaulting inward leaks nothing. These
   people are counted in `summary.unclassifiedCount`
   (`ringSource === "default"`).

`summary.peoplePerRing` counts **all** people by their final ring.

### Post / media / thread ring defaults

- **Posts** — `friends`. They are the owner's own posts; the documented
  default keeps them off the public shell until reclassified.
- **Media** — album name containing `family` → `family`, otherwise
  `friends` (same default as posts).
- **Threads** — the most restrictive ring among the non-owner
  participants (a thread is only as private as its most private
  participant requires). A thread with only the owner → `family`.

## Cosmos conversion

`graphToCosmosData` emits:

- an owner node `{ id: "owner", kind: "member", ring: "family", label: ownerName }`,
- one `member` node per person with `ring` / `label` from the person and
  `branch` set to the person's `ringSource`,
- `relationship` edges: owner ↔ person for every thread co-participant,
  plus person ↔ person pairwise edges inside group threads (groups of
  at most 6 non-owner participants).

No positions are set — the cosmos engine lays ring-shell nodes out
itself when no position is present. Nodes and edges are deduplicated
and sorted deterministically (by id, then source / target).

## Synthetic fixture

`generateSyntheticExport(seed?)` emits a DYI-shaped archive for the
fictional owner **Ada Whitfield** and 28 fictional people — zero real
personal data. It is deterministic: the same seed produces
byte-identical files. The seeded PRNG varies only message wording
(picked from mundane fictional templates) and timestamp jitter; people,
list membership, thread message counts, posts, and albums are fixed by
design, so the parsed summary is stable across seeds.

The archive includes overlapping friend lists (a person on both
"Family" and "Close Friends", and so on) to exercise the
most-restrictive-wins rule, 1:1 threads with message counts on both
sides of the inference threshold (including a 1-message thread), and
two group threads (3 and 4 non-owner participants). A
`SYNTHETIC_FIXTURE_README.txt` labelling the archive as fully synthetic
and fictional is part of the output, and its presence is what makes
`parseFacebookExport` report `synthetic: true`.

For the default seed, the fixture parses to: 28 people
(family 15, friends 6, work 4, public 3), 11 unclassified,
14 posts, 10 media items, 10 threads.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — lint `src/`
- `pnpm test` — run the vitest suite (`src/generator.test.ts`,
  `src/parser.test.ts`, `src/cosmos.test.ts` — synthetic fixture only,
  no I/O, no network)
