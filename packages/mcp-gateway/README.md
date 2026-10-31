# @omega/mcp-gateway

Transport-agnostic JSON-RPC 2.0 tool gateway (MCP-style `tools/list` +
`tools/call`) for the Omega Platform, with a tool registry and three
working adapters: **meta-export**, **notes**, and **files**.

Creator: David Charles Bourassa

## Status

`WORKING` — gateway core (registry + JSON-RPC 2.0 handling) plus the
meta-export, notes, and files adapters over local/fixture data.
Transports: stdio included; no HTTP server yet.

The adapter registry (`ADAPTER_REGISTRY`) honestly reflects this: the
three adapters implemented here are `"working"`; GitHub, Stripe, AWS,
Cloudflare, Hugging Face, and Home Assistant remain `"stub"`.

## Architecture

- **`src/registry.ts`** — `ToolDefinition { name, description,
  inputSchema, handler }` and `ToolError`. Handlers throw `ToolError`
  for caller-facing failures (bad arguments, unknown ids, missing
  files); the gateway converts those to MCP-style `isError: true`
  results instead of protocol errors.
- **`src/jsonrpc.ts`** — `createGateway()` → `{ registerTool, handle }`.
  `handle(request: unknown): Promise<JsonRpcResponse | null>` never
  throws: every failure becomes a JSON-RPC error response, and
  notification requests (no `id`) return `null`. Error codes per
  spec: `-32700` parse, `-32600` invalid request, `-32601` method not
  found, `-32602` invalid params, `-32603` internal.
  Methods: `ping` → `"pong"`, `tools/list` (tools sorted by name),
  `tools/call` (MCP-style result with `content`,
  `structuredContent`, and `isError`; unknown tool → `-32602` with
  `data: { tool }`).
- **`src/stdio.ts`** — `runStdioGateway(gateway, input, output)`:
  newline-delimited JSON over any readable/writable stream pair —
  MCP's classic transport. Unparseable lines get a `-32700` response
  with `id: null`; notifications produce no output line.
- **`src/adapters/`** — one factory per adapter, each returning
  `ToolDefinition[]` to register on a gateway.
- **`src/index.ts`** — public exports, the scaffold-era
  `OmegaToolCall` / `OmegaToolResult` receipt model (kept; see
  Scope), `ADAPTER_REGISTRY`, `MCP_GATEWAY_STATUS = "WORKING"`, and
  `createDemoGateway()` wiring all three adapters to demo data.

## Adapters and tools

### meta-export — `createMetaExportTools(graph)`

Wraps a `NormalizedMemberGraph` from `@omega/meta-export`
(`parseFacebookExport` output — synthetic fixture or a real parsed
export supplied by the caller).

| Tool | Arguments | Result |
| --- | --- | --- |
| `graph.summary` | none | `{ ownerName, synthetic, peoplePerRing, postCount, mediaCount, threadCount, unclassifiedCount }` |
| `graph.listPeople` | `{ ring? }` | `{ people: [{ id, name, ring, ringSource, messageCount }] }` sorted by name; invalid ring → `ToolError` |
| `graph.searchPosts` | `{ query }` (required, non-empty) | `{ matches: [{ id, timestamp, text, ring }], count }` — case-insensitive substring over post text + title |

### notes — `createNotesTools(notes)`

In-memory markdown notes (`NoteInput { id, markdown }`); titles are
parsed from the first `# ` heading, falling back to the id. A small
fictional fixture set about the Ada Whitfield demo world is exported
as `DEMO_NOTES`.

| Tool | Arguments | Result |
| --- | --- | --- |
| `notes.list` | none | `[{ id, title }]` |
| `notes.search` | `{ query }` | `[{ id, title, excerpt }]` — excerpt is the first matching line, trimmed, ≤160 chars |
| `notes.get` | `{ id }` | `{ id, title, markdown }`; unknown id → `ToolError` |

### files — `createFilesTools(provider)`

A `FileProvider { list, read }` with two implementations:
`createMemoryFileProvider(files: Record<string, string>)` and
`createNodeFileProvider(rootDir)` (node:fs; **any path resolving
outside `rootDir` is rejected** with `ToolError: path escapes root`).
Fixture files for the node provider live in `fixtures/files/`.

| Tool | Arguments | Result |
| --- | --- | --- |
| `files.list` | none | `[{ path, size }]` |
| `files.read` | `{ path }` | `{ path, content }` |
| `files.search` | `{ query }` | `[{ path, excerpt }]` over the provider's text files |

## Example

Request:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph.summary","arguments":{}}}
```

Response (from `createDemoGateway()`, synthetic seed-42 export):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "{\"ownerName\":\"Ada Whitfield\",\"synthetic\":true,\"peoplePerRing\":{\"family\":15,\"friends\":6,\"work\":4,\"public\":3},\"postCount\":14,\"mediaCount\":10,\"threadCount\":10,\"unclassifiedCount\":11}" }],
    "structuredContent": {
      "ownerName": "Ada Whitfield",
      "synthetic": true,
      "peoplePerRing": { "family": 15, "friends": 6, "work": 4, "public": 3 },
      "postCount": 14,
      "mediaCount": 10,
      "threadCount": 10,
      "unclassifiedCount": 11
    },
    "isError": false
  }
}
```

Request:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      { "name": "files.list", "description": "List files exposed by the provider, with sizes in bytes.", "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false } },
      { "name": "graph.summary", "description": "Summarize the member graph: owner, ring counts, and content totals.", "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false } }
    ]
  }
}
```

(The full demo gateway registers nine tools; the list above is
trimmed to two entries for brevity. `tools/list` returns them sorted
by name.)

## Scope — honest limits

- No HTTP transport yet; stdio is the only transport.
- No auth and no consent-receipt enforcement yet. The scaffold-era
  `OmegaToolCall` / `OmegaToolResult` receipt model
  (`receiptRequired: true`, `receiptId`, `dataHash`) is retained as
  the future receipts wiring and is **not** enforced by the working
  gateway.
- Adapters run over local/fixture data only: the meta-export adapter
  serves whatever graph the caller parsed, notes are in-memory, and
  files come from an in-memory map or a single local directory.
- All bundled demo/fixture data is synthetic and fictional.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — lint `src/`
- `pnpm test` — run the vitest suite (protocol-level tests in
  `src/*.test.ts`: JSON-RPC envelope and error codes, the real
  synthetic-export totals through `graph.*`, notes and files
  adapters, node-provider path-traversal rejection, and the stdio
  transport over `PassThrough` streams)
