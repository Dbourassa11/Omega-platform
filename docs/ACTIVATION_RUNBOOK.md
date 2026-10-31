# Activation Runbook — "The Hour the Key Lands"

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

**Scope:** the Omega Platform monorepo in this tree, for the Meta Global AI
Developer Hackathon 2026 (submissions due November 4, 2026, 9:00 PM ET, via
the Cerebral Valley portal). This runbook is OUTPUT-safe: it contains no
secrets, no key values, and no internal strategy, and it may travel with the
submission tree.

**Status at writing (October 27, 2026): no Meta Model API key exists.**
Everything in `packages/ai-core` runs on the labeled offline fallback until
a key is configured. Nothing in this runbook claims a live integration that
has not yet happened.

**Ground truth for every name below:** `packages/ai-core/src/meta-api-config.ts`
(single source of truth for env resolution), `.env.example`, and
`docs/META_API_NOTES.md`. Env var names, model ids, and endpoints are copied
from those sources, never invented.

## 0. Preconditions — do not start until all three are true

1. [ ] The acceptance email from Cerebral Valley has arrived.
2. [ ] The $150 in Meta Model API credits has been claimed **per the
   email's Credit Terms** (the terms in the email govern, not this
   runbook).
3. [ ] A key has been obtained **via Meta's secure flow** (the flow the
   acceptance email / Meta dashboard points to).

Record immediately, in the credit-burn table (§5), the date the credits
were claimed and the date the 10-day validity window ends. The 10-day
clock is the single most unforgiving constraint in this runbook: every
live verification, proof capture, and demo recording that needs a live
call must happen inside that window.

## 1. Key-handling rules — absolute, no exceptions

1. The key is **NEVER pasted in chat** — not in any chat, channel, or
   message thread, including this project's own chats.
2. The key is **NEVER committed** — not to this repo, not to any repo,
   not in any file that could be committed. The local `.env` file is
   gitignored (`.gitignore` covers `.env` and `.env.*` with only
   `.env.example` excepted), but gitignored is a safety net, not a
   permission: the key still never goes into the repo tree.
3. The key is **NEVER written into the repo or into screenshots** — no
   key value in docs, code comments, terminal captures, or proof images.
   Crop or blur any terminal/editor pane that could show it before a
   screenshot is filed.
4. The key goes **only** through the secure-entry path into the runtime
   environment or the local `.env` file (gitignored). It is set as an
   environment variable, never as a code change. Activation is
   zero-code-change by design: the adapter already reads the env names
   below.
5. If a key value is ever pasted, committed, or screenshotted, treat it
   as compromised: rotate it immediately (§7) and re-verify.

Env var names — exactly as in `.env.example` and
`packages/ai-core/src/meta-api-config.ts`:

| Variable | Role | Default if unset |
| --- | --- | --- |
| `META_MODEL_API_KEY` | API key — project name, **primary** | (none — absence means offline) |
| `MODEL_API_KEY` | API key — Meta's documented name, **fallback alias**, used only when `META_MODEL_API_KEY` is unset | (none) |
| `META_MODEL_BASE_URL` | Base URL override | `https://api.meta.ai/v1` |
| `META_MODEL_MODEL` | Chat model id override | `muse-spark-1.3` (newest documented Spark id; see §2 Step 3) |
| `META_MODEL_IMAGE_MODEL` | Image model id override | `muse-image-1.0` |

Do not invent other names. LiteLLM's `META_API_KEY` / `META_API_BASE`
are **not** this project's names and are not read by this code
(`docs/META_API_NOTES.md` §5).

## 2. Ordered activation steps

### Step 1 — Set the environment

1. Copy `.env.example` to `.env` if no local `.env` exists yet.
2. Set **one** key variable via the secure-entry path: prefer
   `META_MODEL_API_KEY`. Set `MODEL_API_KEY` only if the key was issued
   per Meta's dashboard instructions under that name — the fallback
   chain accepts it with zero code change.
3. Leave `META_MODEL_BASE_URL`, `META_MODEL_MODEL`, and
   `META_MODEL_IMAGE_MODEL` unset unless a step below tells you to pin
   one. Unset means the documented defaults above.
4. Verify no key value appears in any file under version control:
   `git status` (once a repo exists) must show no `.env`, and no file
   you touched contains the key string.

### Step 2 — Restart the web app

1. Stop the running web app completely.
2. Start it again (`pnpm --filter @omega/web dev` for the dev server;
   `pnpm build` + `pnpm start` equivalent for a production run — see the
   Quickstart in `README.md`).
3. The provider is created per page load (`createChatProvider()` in
   `packages/ai-core/src/meta-model-client.ts`, resolved through
   `meta-api-config.ts`), so a full restart + fresh page load is what
   picks the new environment up. A hot-reload is not sufficient evidence.

### Step 3 — Verification call A: minimal chat completion

1. Open the AI Oracle (`/oracle`).
2. Ask one in-ring question using a suggestion chip, e.g.
   "Tell me about …" for a node in the active ring.
3. **What must come back:**
   - The per-answer badge reads **Live — Meta Model API · `muse-spark-1.3`**
     (the default chat model) and the answer backend is `meta-model-api`.
   - The answer still cites its ring-scoped sources (see §3).
   - Under the hood this is `POST {baseUrl}/chat/completions` with the
     OpenAI-style request (`model`, `messages`, `max_completion_tokens`
     when capped) and the response envelope the client parses in
     `MetaModelClient.chat()` (`packages/ai-core/src/meta-model-client.ts`):
     `choices[0].message.content` for the text, `usage.{prompt,completion,total}_tokens`
     for token counts, and `model` for the answering model id. A
     response missing `choices[0].message.content` is rejected as
     `invalid_response` — that is a failed verification, not a live
     answer.
4. **If the call is rejected as an unknown model** (HTTP 404 /
   `model_not_found`-style error): pin the Meta-example model and retry
   once — set `META_MODEL_MODEL=muse-spark-1.1` (the id confirmed on
   Meta's own example page, `docs/META_API_NOTES.md` §1, kept in code
   as `META_CONFIRMED_CHAT_MODEL`), restart (§2, Step 2), and repeat
   this step. Record which model id verified, and use that id in every
   badge/proof statement afterward. Do not keep retrying other model
   ids: one fallback, then stop and escalate (§6).
5. Log the call in the credit-burn table (§5) with the token counts
   from the response `usage` envelope.

### Step 4 — Verification call B: exactly one Muse Image generation

This step is included because `docs/META_API_NOTES.md` §2 **does**
document the image endpoint (it is not a skip case):

1. In Creative Suites (`/creative`), use the Art suite's prompt
   composer path for one image generation, or call the documented seam
   directly: `MetaImageClient.generate()` / `generateCreativeArt()`
   (`packages/ai-core/src/meta-image-client.ts`).
2. **What must come back:**
   - One image, from `POST {baseUrl}/images/generations` with
     `model` = `muse-image-1.0` (default `META_MODEL_IMAGE_MODEL`).
   - The response envelope the client parses in
     `MetaImageClient.generate()`: `data: [{ b64_json | url, … }]`.
     **Caution carried from `docs/META_API_NOTES.md` §2:** this envelope
     is the OpenAI-style shape used by the documented integrations; it
     is NOT Meta-verbatim. Re-check it verbatim on this first live call
     — if the live shape differs, the call fails as `invalid_response`
     and that finding is recorded (it is not papered over).
   - The generation is filed to the Vault with its full provenance
     record (`generateCreativeArt`): prompt, model id, timestamp, ring,
     creator — the Creative→Vault provenance seam described in
     `SUBMISSION.md`.
3. Generate **one** image only for verification. Further generations
   are demo/proof work and are logged in §5 like any other call.
   (Secondary sources in `docs/META_API_NOTES.md` §2 put image pricing
   at $0.01 per image — context only, not relied on by any code; record
   the actual charge from Meta's billing, not from this note.)
4. If the image call fails, chat verification (§2, Step 3) still
   stands on its own. Do not block the chat activation on the image
   call; record the image failure and its error code in §5/§6.

### Step 5 — Confirm the badge signal, honestly

Read this before declaring activation complete:

- The badge mode in `getMetaApiStatus()` /
  `getChatProviderStatus()` flips on **key presence alone**. The code
  says so explicitly (`meta-api-config.ts`: "`live` simply means 'a key
  is configured', never 'a call succeeded'"). A LIVE badge after Step 1
  proves the env landed — it does **not** prove a live call succeeded.
- **Activation is confirmed only after Steps 3 (and, for the image
  surface, 4) return real, successful responses.** Until then, every
  public statement still says "adapter ready, untested against the live
  API" and every answer that has not actually been answered live keeps
  its offline label.

## 3. Badge-flip checklist — per surface, what "correct" looks like

Check each surface in a fresh page load after the restart. Never
display a live badge that isn't live: if any check below fails, that
surface stays OFFLINE (§6).

### AI Oracle (`/oracle` — `apps/web/app/oracle/page.tsx`)

- [ ] Header badge (`ProviderStatusBadge`, top of the page) reads
  **Live — Meta Model API · `<verified model id>`** (default
  `muse-spark-1.3`, or `muse-spark-1.1` if §2 Step 3 pinned it).
- [ ] A live answer's per-answer badge (`BackendBadge` on the answer
  bubble) reads **Live — Meta Model API · `<model id from the response>`**
  — the model id comes from the response envelope, falling back to the
  requested model when the response carries none.
- [ ] **Citations still present:** the live answer's bubble still shows
  its "Cited:" list of in-ring nodes. The Oracle system prompt
  (`packages/ai-core/src/oracle.ts`, `answerOracleQuery`) restricts the
  model to the listed consented sources in the active ring and tells it
  to cite them. A live answer with no citations is a failed check —
  re-ask, and if it persists, record it as a live-behavior finding.
- [ ] **Guardian refusals still fire live:** ask about a node in a
  different ring (use the "Try crossing a ring →" suggestion chip).
  Correct result: a **Guardian refusal** badge and a refusal naming the
  boundary ring — and the provider is never called for that question
  (`oracle.ts`: the Guardian check precedes the provider call, so this
  holds identically live and offline). A live answer that discloses
  out-of-ring content is a stop-everything defect.

### Creative Suites composer (`/creative` — `apps/web/app/creative/page.tsx`)

- [ ] Composer-panel badge (`ProviderStatusBadge` next to "Generate
  with AI") reads **Live — Meta Model API · `<verified model id>`**.
- [ ] A generated draft's badge (`BackendBadge`, shown both in the
  composer actions and above the draft) reads
  **Live — Meta Model API · `<model id>`** with backend `meta-model-api`.
- [ ] The draft is still presented as a draft for David Charles
  Bourassa to shape and finish (the Creator system prompt's human-
  authorship framing), never as a completed work and never with AI
  authorship claimed.
- [ ] For the Art image path (§2 Step 4): the generated image is filed
  to the Vault with its provenance record (prompt, model id, timestamp,
  ring, creator). An image that cannot be filed with provenance is not
  proof — it is an open item.

### Eternal Garden Q&A (`/garden` — `apps/web/app/garden/page.tsx`)

- [ ] **Correct post-activation state is NO live badge.** The Garden
  Q&A is deterministic local logic, not a Meta Model API call
  (`packages/ai-core/src/legacy/answer.ts`: "Pure and synchronous: same
  inputs, same answer, no I/O, no live AI"; the page header states "no
  live AI call is made"). After activation its answer badge must still
  read **Local demo logic — no live AI**, alongside the
  **Official Personal AI** provenance badge on cited answers.
- [ ] **Guardian refusals still fire:** ask from a non-family ring.
  Correct result: a **Guardian refusal** badge naming the Family-ring
  boundary (the archive lives in the Family ring).
- [ ] **Abstentions still fire:** ask something the synthetic archive
  does not support. Correct result: an **Abstained — no supporting
  memory** badge, never an invented memory.
- [ ] If the Garden ever shows a LIVE badge, that is a defect, not a
  success — it would mean a surface is claiming a live call it never
  made. Report it and do not use that screenshot as proof.

### Not a badge signal — do not use these as activation evidence

- The Settings page (`/settings`) connection-status card is **static
  text** ("Meta Model API: not connected (no key)") and does not flip
  with the env. Its staleness after activation is a known doc/UI lag,
  not a failed activation — it is fixed by the post-activation doc step
  (§8), not by re-running activation.
- The Overview page's "Meta Model API — no key connected" line is the
  same kind of static text. Judge activation only by the three surfaces
  above.

## 4. Proof capture list

Take screenshots only after §2 Steps 3–4 succeed, and file them under
`docs/images/` following the existing naming pattern
(`dashboard-overview.png`, `cosmos-demo.png`, `cosmos-demo-family.png`,
`cosmos-universe.png`, `vault-demo.png`, `phase2-demo.png`,
`phase2-garden.png`):

1. `docs/images/phase3-oracle-live.png` — a live Oracle answer with
   its **Live — Meta Model API · `<model id>`** badge and its Cited
   list visible.
2. `docs/images/phase3-oracle-guardian-live.png` — a Guardian refusal
   taken **after** activation (same session, live key configured),
   proving refusals still fire live.
3. `docs/images/phase3-creator-live.png` — a live Creative Suites
   draft with its live badge visible (Art/Music/Video/Write — one is
   enough for activation proof).
4. `docs/images/phase3-creator-vault.png` — the one Muse Image
   generation filed to the Vault with its provenance record visible
   (prompt, model id, timestamp, ring, creator).
5. `docs/images/phase3-garden-local.png` — a Garden answer taken after
   activation showing **Local demo logic — no live AI** plus its
   cited sources — proof that no surface falsely claims to be live.

Rules for every proof image: no key value visible anywhere in the
frame; no terminal, editor, or env pane in the shot; the badge text and
model id must be legible (that legibility is the point of the shot).

## 5. Credit-burn tracking

Maintain this table from the first live call until the window closes.
One row per call (or per batch where a batch is genuinely one action).
"Est. cost" is filled from Meta's billing / pricing page at the time of
the call — never from memory, and never from the secondary-source
figures in `docs/META_API_NOTES.md` (those are research context, not a
price list). The response `usage` envelope (§2 Step 3) is the token
source for chat calls.

| Date | Surface (Oracle / Creative chat / Muse Image / Garden*) | Calls | Est. tokens / units | Est. cost | Running total vs $150 |
| --- | --- | --- | --- | --- | --- |
| _YYYY-MM-DD_ | _e.g. Oracle chat_ | _1_ | _prompt _ / completion _ / total __ | _$__.___ | _$__.___ / $150_ |

\* Garden makes no live calls and burns nothing — it has no rows. Its
absence from this table is itself a check: if a Garden row ever appears,
something is misclassified.

Daily, during the window: (1) total the day's rows, (2) compare the
running total to $150, (3) note the remaining days in the 10-day window.
If the running total approaches the cap, stop discretionary live calls
and reserve the remainder for the final demo recording.

## 6. Failure fallbacks

The client maps failures to `MetaModelError` codes
(`packages/ai-core/src/meta-model-client.ts`): `http_error` (with HTTP
status), `timeout` (30,000 ms chat / 60,000 ms image), `network_error`,
`invalid_response`, `not_configured`. The web pages catch provider
failures and show a plain error ("The Oracle could not answer just
now", "Generation failed") — they do not silently substitute a fake
live answer.

| Symptom | Meaning | Action |
| --- | --- | --- |
| HTTP 401 (`http_error`, status 401) | Bad / revoked / wrong-account key | Do not retry the same key. Re-check the key came from Meta's secure flow for this project, rotate (§7), re-verify with §2 Step 3. Badges stay OFFLINE until a call succeeds. |
| HTTP 429 (`http_error`, status 429) | Rate limit | Stop calling. Wait, then retry once with a minimal request. If 429 persists, the window's live work pauses — the product keeps working on the deterministic fallback and no live badge is shown for unanswered work. Log it in §5. |
| HTTP 5xx / network failure / timeout | Meta-side or connectivity failure | Retry once after a short wait. If it persists, treat the surface as offline for the session (see below). |
| `invalid_response` | Envelope mismatch (e.g. image `data[]` shape differs from the documented OpenAI-style shape) | Record the actual response shape (without any key material) as a first-live-call finding in `docs/META_API_NOTES.md` §6 follow-up. Do not hand-edit the client to force a pass without a documented shape. |
| `not_configured` | No key resolved | The env did not land. Re-check Step 1 (variable name spelling — `META_MODEL_API_KEY` vs `MODEL_API_KEY`), restart fully (Step 2), reload the page. |

**Offline-fallback rule (applies to every failure above):** badges stay
OFFLINE, the product keeps working on the deterministic fallback, and a
live badge is never displayed for work that was not actually answered
live. Note the one asymmetry in the current code: with a key configured
but failing, `MetaModelClient.chat()` throws rather than falling back
to the offline stub (the stub is used only when no key is configured).
So the operator fallback for a bad/failing key is explicit, not
automatic: remove the key from the environment, restart, and confirm
the OFFLINE badges return — then fix the key problem and re-run §2.
Never leave a failing key in place while demoing.

## 7. Rotating a key safely

1. Remove the old key from the runtime environment and from local
   `.env` (and from any secret store it was entered into, via that
   store's own rotation flow).
2. Enter the new key through the secure-entry path only (§1).
3. Restart the web app (§2 Step 2) and re-run verification (§2 Steps
   3–4).
4. Confirm the old key appears nowhere in the repo, chat, or screenshots
   (§1 rule 5). If it ever did, it is compromised regardless of
   rotation timing — note that in the activation record.

## 8. Post-activation — same day, before the window closes

1. Update `HACKATHON.md` §7 checklist: tick "Meta Model API key +
   $150 participant credits claimed and wired (env only — zero code
   change)" and replace the "no live Meta integration yet" honesty
   wording with the activation date, the verified model id(s), and the
   proof image paths (§4).
2. Update `SUBMISSION.md` ("Use of Meta AI tooling" section) the same
   way: what was "untested against the live API" becomes live-verified
   with date + proof paths; the image-envelope caution in
   `docs/META_API_NOTES.md` §2 is resolved or carried forward explicitly
   — never silently dropped.
3. Record in the activation record (this runbook's §5 table + a dated
   note): activation date, credits-claimed date, 10-day window end
   date, verified chat model id, verified image model id, and the five
   proof paths from §4.
4. Re-run the full gate set on the final tree (build, typecheck, lint,
   vitest, forge) before submission — activation changes env, not code,
   but the gate numbers in `SUBMISSION.md` must still describe the
   tree being submitted.

---

*Operator note: if any step in this runbook contradicts what the code
actually does, the code + `docs/META_API_NOTES.md` win and this runbook
is corrected. Do not "fix" a verification failure by editing a badge
label.*
