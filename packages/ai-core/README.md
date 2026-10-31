# @omega/ai-core

Omni-Agentic Core for the Omega Platform — scaffold + Meta Model API adapter.

Creator: David Charles Bourassa

## Status

`SCAFFOLD` + Meta Model API adapter (**untested against live API — no key yet; offline stub is the default backend**).

The agent registry below is still a canonical type surface only, per
Implementation Plan Step 5. The Meta Model API adapter in
`src/meta-model-client.ts` is real, unit-tested client code (against an
injected mock `fetch` — no network), but it has **not** been run against the
live Meta Model API: no API key is provisioned yet, and no live integration
is claimed anywhere.

## Exports

- `AgentRole` — `"oracle" | "creator" | "memory" | "guardian" | "connector" | "legacy"`
- `AgentDefinition { role, purpose, guardrail }`
- `AGENT_REGISTRY` — all six agent definitions with purposes and guardrails:
  - **Oracle** — Natural-language navigation, search, summaries; Must cite consented sources
  - **Creator** — Poetry, visuals, music prompts, worlds; Must preserve human authorship framing
  - **Memory** — Memories, relationships, timeline context; Ring-scoped retrieval only
  - **Guardian** — Permissions, consent, privacy impact; Defaults to least privilege
  - **Connector** — MCP tools for external platforms; Requires scoped connector approval
  - **Legacy** — Digital Mirror interactions; Requires guardian authorization + drift controls
- `AgentContext { ring, subjectNodeId }`
- `AI_CORE_STATUS = "SCAFFOLD"`

Depends on `@omega/consent-core` for `RingType`.

## Meta Model API adapter (`src/meta-model-client.ts`)

- `MetaModelMessage { role: "system" | "user" | "assistant", content }`
- `MetaModelChatRequest { messages, model?, temperature?, maxTokens? }`
- `MetaModelChatResponse { model, content, usage?, backend: "meta-model-api" | "offline-stub" }`
- `ChatCompletionProvider` — the interface both backends implement:
  `chat(request): Promise<MetaModelChatResponse>`
- `MetaModelClient` — chat-completions client. Config via constructor options
  `{ apiKey?, baseUrl?, model?, timeoutMs?, fetchFn? }`; `fetchFn` defaults to
  `globalThis.fetch` and is injectable for tests.
- `OfflineStubProvider` — deterministic offline backend: a pure function of
  the request (same request → same response), clearly labeled `[offline stub]`
  in its content, performing no network I/O.
- `MetaModelError extends Error` — carries `{ code, status? }` where `code` is
  one of `"http_error"`, `"timeout"`, `"network_error"`, `"invalid_response"`.
- `createChatProvider(options?)` — factory returning a `MetaModelClient`
  (which self-falls-back to the offline stub without a key).
- `oracleChat(context, messages, provider)` — Oracle Agent wiring: prefixes a
  short ring-scoped system message (answer only from sources consented in the
  context's ring, and cite them) and delegates to the provider.
- `META_MODEL_ADAPTER_STATUS` —
  `"ADAPTER — untested against live API (no key yet); offline stub is the default backend"`

### Environment variables (names only — set real values in your shell / CI secrets)

- `META_MODEL_API_KEY` — API key. If unset/empty, the client never throws for
  the missing key: it delegates every call to `OfflineStubProvider`.
- `META_MODEL_BASE_URL` — defaults to `https://api.meta.ai/v1`.
- `META_MODEL_MODEL` — default model; defaults to `muse-spark`.

Constructor options take precedence over environment variables.

### Offline-fallback behavior

With no API key configured, `MetaModelClient.chat()` delegates to
`OfflineStubProvider` and returns `backend: "offline-stub"` with a
deterministic `[offline stub] …` echo of the last user message. This lets the
whole platform run end-to-end during the hackathon build window before a key
exists.

With a key, the client POSTs `{baseUrl}/chat/completions` with a Bearer
`Authorization` header and an `AbortController` timeout (default 30,000 ms),
maps `choices[0].message.content` and `prompt_tokens` / `completion_tokens` /
`total_tokens` usage into `MetaModelChatResponse`, and throws `MetaModelError`
for non-2xx responses (`http_error`), timeouts (`timeout`), fetch rejections
(`network_error`), and malformed payloads (`invalid_response`).

### Verify-against-docs caveat

The default base URL (`https://api.meta.ai/v1`) and the OpenAI-style
chat-completions request/response shape are the **documented-integration
assumption** for this build. Both must be verified against the current Meta
Model API docs in the build window before this adapter is used with a real
key. Until then it remains untested against the live API.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — lint `src/`
- `pnpm test` — run the vitest suite (`src/meta-model-client.test.ts`, mock
  `fetch` only — no network)
