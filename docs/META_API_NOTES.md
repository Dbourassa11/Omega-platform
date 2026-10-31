# Meta Model API — Research Notes (Workstream 2, Live-API Readiness)

**Date / access date:** 2026-10-26
**Creator:** David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico
**Status:** Research notes only. **No API key exists for this project and
nothing in this document is a claim of live integration.** The adapter in
`packages/ai-core` remains untested against the live API; the offline stub
is the default backend whenever no key is configured.

## How to read the verdicts

- **CONFIRMED (Meta page opened)** — the fact appears on a Meta-owned page
  (`developer.meta.com`, `ai.meta.com`) that was opened during this pass.
- **DOCUMENTED (secondary, quoting Meta docs)** — the fact is reported by
  independent secondary sources that cite or quote Meta's developer
  documentation at `dev.meta.ai` / `developer.meta.com`, but the
  `dev.meta.ai` documentation pages themselves were not rendered directly
  in this pass (they are script-driven; the text fetcher returned the
  marketing/model pages only). Treated as documented for planning and for
  mocked contract tests, **not** as live-verified.
- **UNVERIFIED / NOT DOCUMENTED** — no usable public source found in this
  pass. Not implemented as fact anywhere in code.

---

## 1. Muse Spark chat — newest documented model id

### Findings

- **Base URL `https://api.meta.ai/v1` — CONFIRMED (Meta page opened).**
  Meta's own developer example constructs an OpenAI client with
  `base_url="https://api.meta.ai/v1"` and an API key read from the
  environment variable `MODEL_API_KEY`, calling
  `client.responses.create(model="muse-spark-1.1", …)`.
  Source: https://developer.meta.com/ai/resources/blog/build-with-muse-spark
- **`muse-spark-1.1` — CONFIRMED (Meta page opened).** It is the model id
  in Meta's example above, and Meta's per-version model page is titled
  "Muse Spark 1.1" ("Now in public preview for US developers").
  Source: https://developer.meta.com/ai/models/muse-spark-1-1/
- **`muse-spark-1.3` is the newest documented Muse Spark chat model id —
  DOCUMENTED (secondary, quoting Meta docs).** Promptfoo's Meta provider
  documentation — which links directly to Meta's `dev.meta.ai` models
  page and pricing page — states: "select `muse-spark-1.3` explicitly to
  use the latest model", lists `muse-spark-1.3` and
  `muse-spark-1.3-contributor` as working with the Responses, Chat
  Completions, and Messages APIs, with a 1,048,576-token context window,
  and gives Meta-published pricing for both ids. Independent secondary
  timelines agree on the release cadence: 1.1 on 2026-07-09, 1.2 on
  2026-08-05, 1.3 on 2026-09-02.
  Sources:
  - https://www.promptfoo.dev/docs/providers/meta/
  - https://shipwithmuse.live/blog/muse-spark-for-developers
  - https://docs.litellm.ai/docs/providers/meta (lists `muse-spark-1.1`
    only — an older snapshot; useful corroboration for 1.1, silent on 1.3)
- **`muse-spark-1.2` / `muse-spark-1.2-contributor` — DOCUMENTED
  (secondary).** Same sources as 1.3. Not opened on a Meta page in this
  pass.
- **Contributor variants — DOCUMENTED (secondary), opt-in only.**
  Selecting a `-contributor` id permits Meta to use prompts and
  completions to train future models, in exchange for discounted pricing.
  This project never defaults to a contributor id; it is available only
  as an explicit per-request / env choice.
- **Chat envelope — DOCUMENTED (secondary) + consistent with the existing
  adapter.** The API accepts Responses, Chat Completions
  (`POST /chat/completions` relative to the base URL), and Messages
  formats, authenticated with `Authorization: Bearer <key>`. The
  OpenAI-style response envelope the adapter already parses
  (`choices[0].message.content`, `usage.{prompt,completion,total}_tokens`)
  is the shape the OpenAI SDK examples print from. The exact wire envelope
  has **not** been verified against a live call (no key).
- **`max_completion_tokens` is the canonical cap — DOCUMENTED
  (secondary).** Promptfoo, describing Meta's docs: on the chat endpoint
  Meta accepts `max_tokens` only as a deprecated alias and forwards it as
  `max_completion_tokens`; on Responses the cap is `max_output_tokens`.
  The adapter now sends `max_completion_tokens`.
- **`reasoning_effort` — DOCUMENTED (secondary).** Values `minimal`,
  `low`, `medium`, `high`, `xhigh`; `none` is not supported. The adapter
  exposes it as an optional request field.
- **Out of scope, noted only:** secondary sources from October 2026 also
  describe a separate `muse-wonder-1.0` model on the same API. No Meta
  page opened in this pass documents it, so it is **UNVERIFIED** here and
  nothing in code references it.

### Code consequence

`DEFAULT_META_MODEL_MODEL` is now `muse-spark-1.3`, with
`muse-spark-1.1` kept as the exported Meta-confirmed fallback constant
(`META_MODEL_CONFIRMED_MODEL`). The env override (§5) still wins over the
default, so a key holder can pin any documented id with zero code change.

---

## 2. Muse Image — model id, endpoints, request/response shape

### Findings

- **The model exists — CONFIRMED (Meta page opened).** Meta's launch post
  introduces Muse Image as an agentic image generation / editing model
  from Meta Superintelligence Labs, integrated with Muse Spark,
  available in the Meta AI app, meta.ai, Instagram Stories (US), and
  WhatsApp (limited countries). The launch post gives **no API model id,
  endpoint, or request/response shape**.
  Source: https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/
- **Model id `muse-image-1.0` on the Meta Model API — DOCUMENTED
  (secondary, quoting Meta docs).** Multiple independent integrations and
  write-ups that cite Meta's developer documentation agree on the id,
  including a first-person live test (2026-08-30, with a real key) that
  reports `client.images.generate(model="muse-image-1.0", …)` returning
  an image, after `muse-spark-1.2` returned `404 model_not_found` for the
  same call.
  Sources:
  - https://www.orcarouter.ai/blog/muse-image
  - https://medium.com/@master_58978/meta-ai-muse-i-wrote-not-yet-confirmed-in-my-last-article-4e429accd38b
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/image-generation
  - https://docs.comfy.org/tutorials/partner-nodes/meta/muse-image
- **Endpoints — DOCUMENTED (secondary).** Same base URL and Bearer auth
  as Muse Spark:
  - Generate — `POST /images/generations` (i.e. `POST /v1/images/generations`)
  - Edit — `POST /images/edits`
  - Multi-turn refinement — via the Responses API (`POST /responses`)
  Only the generations endpoint is implemented in this pass; edits and
  Responses-based refinement are noted, not coded.
  Source: https://www.orcarouter.ai/blog/muse-image
- **Request parameters — DOCUMENTED (secondary).** `model` (=
  `muse-image-1.0`), `prompt`; `n` 1–10 (default 1); `size` as a `"WxH"`
  string that sets aspect ratio only, not exact pixels; `response_format`
  `b64_json` (default) or `url`; `output_format` `webp` (default), `png`,
  or `jpeg`; plus a `tool_enablement` extension and `reasoning_strength`
  `high` (default) / `low`. The last two extensions are **not** sent by
  this project's client in this pass.
  Source: https://www.orcarouter.ai/blog/muse-image
- **Response envelope — ASSUMED OpenAI-compatible, NOT Meta-verbatim.**
  The integrations above call the endpoint through the OpenAI SDK's
  images interface, whose response is `data: [{ b64_json | url, … }]`.
  No Meta page opened in this pass prints the raw JSON response. The
  image client parses that OpenAI-style envelope defensively and treats
  any other shape as `invalid_response`. This is the weakest-documented
  part of the image surface and must be re-checked on the first live call.
- **Pricing (context only):** $0.01 per image, per the secondary sources
  above and fal's listing. Not relied on by any code.

### Code consequence

A real `MetaImageClient` is implemented against the documented request
shape (§2 endpoints/parameters), with mocked-fetch contract tests. With
no API key it never fabricates an image: it throws a labelled
`MetaModelError` (`code: "not_configured"`) stating the image API is not
yet available because no API key is connected.

---

## 3. "Glimmer" — what it is

### Findings

- **Muse Glimmer is Meta's open-weight, on-device agent model —
  CONFIRMED (Meta page opened).** Meta's research publication introduces
  "Muse Glimmer, an open-source 30B parameter causal language model with
  perception encoder, purpose-built for autonomous agentic tasks on
  consumer hardware", accepting text and image inputs and producing text
  outputs, quantized to approximately 4-bit precision for single-GPU
  inference, released under the Apache 2.0 license.
  Source: https://ai.meta.com/research/publications/muse-glimmer-30b-an-on-device-agentic-model/
- **It is NOT a Meta Model API product.** Secondary sources consistently
  describe Glimmer as a download you self-host (distilled from Muse
  Spark), explicitly contrasting it with the API-only Muse Spark line:
  "Muse Glimmer, likewise, is not on that API — since August 10, 2026 it
  is a download."
  Sources:
  - https://mungomash.com/ai/llama/versions/
  - https://venturebeat.com/technology/meta-returns-to-open-source-with-muse-glimmer-an-apache-2-0-licensed-30b-parameter-ai-model-optimized-for-agents-available-now
- There is therefore **no Glimmer endpoint, model id, or API key flow**
  for this project to integrate. If local inference is ever wanted, it is
  a separate self-hosting decision (consumer-GPU class hardware), not a
  Model API readiness item. Nothing in code references Glimmer.

---

## 4. SAM 3 / SAM 3.1 — Model API exposure

### Findings

- **SAM 3.1 IS exposed via the Meta Model API — CONFIRMED (Meta page
  opened).** Meta's model page: "Detect, segment and track objects in
  images and video on Meta Model API, with nothing to host or tune"; SAM
  3.1 "shares its envelope, keys, docs and billing with every other Meta
  model"; it "detects the objects, returns pixel-precise segmentation
  masks and tracks them through video", zero-shot, from text prompts
  ("Give SAM 3.1 a short noun phrase naming one thing, and it returns a
  box and a mask for every match").
  Source: https://developer.meta.com/ai/models/sam-3-1/
- **Model id spelling CONFLICTS across sources.** Meta's pricing table on
  the page above lists the id as **`sam-3-1`** ($2.50 / 1k images,
  $0.20 / 1k frames). Secondary sources quoting the API model list write
  **`sam-3.1`**. This pass could not resolve which spelling the API
  accepts; both are recorded here and neither is coded as fact.
  Sources:
  - https://developer.meta.com/ai/models/sam-3-1/ (pricing table: `sam-3-1`)
  - https://shipwithmuse.live/blog/muse-developer-platform (model list: `sam-3.1`)
  - https://mungomash.com/ai/llama/versions/ ("SAM 3.1 … as `sam-3.1`")
- **Endpoint / request / response shape — NOT DOCUMENTED in this pass.**
  One secondary source claims SAM 3.1 is served "over `POST /v1/responses`",
  but no page opened in this pass shows a SAM request or response example,
  a media-upload flow, or a mask encoding. Per the honesty rule, that
  claim is recorded as **UNVERIFIED** and no SAM client is implemented.

### Code consequence

SAM garden tagging ships as **types + design only** (see
`packages/ai-core/src/sam-garden.ts`): a tagging request/result shape and
a provider interface whose only implementation is a stub that throws a
labelled "not yet available" error. Implementing a real call waits on (a)
the resolved model-id spelling and (b) a documented request/response
shape — both first-live-call checks once a key exists.

---

## 5. Environment variables (names only — never values)

The project keeps its own consistent names; Meta's documented name is
accepted as a fallback alias for the key so a key issued per Meta's
dashboard instructions works with zero code change.

| Name | Role | Notes |
| --- | --- | --- |
| `META_MODEL_API_KEY` | API key (project name, primary) | Presence = LIVE; absence/empty = offline stub |
| `MODEL_API_KEY` | API key (Meta's documented name, fallback alias) | Used only when `META_MODEL_API_KEY` is unset |
| `META_MODEL_BASE_URL` | Base URL override | Default `https://api.meta.ai/v1` |
| `META_MODEL_MODEL` | Chat model id override | Default `muse-spark-1.3`; pin `muse-spark-1.1` for the Meta-example model |
| `META_MODEL_IMAGE_MODEL` | Image model id override | Default `muse-image-1.0` |

Notes:

- The chat, image, and status surfaces all resolve through the single
  config module `packages/ai-core/src/meta-api-config.ts`, so every badge
  in the app flips from the **same** signal: key presence after the
  fallback chain above.
- In the Next.js web app, these are server/runtime environment names.
  Client components only ever learn LIVE/OFFLINE + the model id from the
  provider/backend result of an actual call; no key value is ever exposed
  to the browser by this code.
- LiteLLM's own integration names (`META_API_KEY` / `META_API_BASE`) are
  **not** this project's names and are not read by this code.

## 6. What still waits on the API key

1. First live chat call: verify the `choices[0].message.content`
   envelope, error body shapes (401 / 429 / 5xx), and that
   `muse-spark-1.3` is accepted for this account (fall back to
   `META_MODEL_MODEL=muse-spark-1.1` if not).
2. First live image call: verify the `data[]` response envelope and the
   `size` / `response_format` / `output_format` parameters verbatim.
3. SAM: resolve `sam-3-1` vs `sam-3.1` and obtain a documented
   request/response shape before any client code.
4. Rate limits / pricing for this account (secondary sources report
   per-team limits; nothing here relies on them).
