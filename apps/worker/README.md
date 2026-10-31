# @omega/worker — Omega Platform Cloudflare Worker

**Status: SCAFFOLD** — stub Worker only. Not deployed; no bindings, no secrets, no production routes.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

## What this is

Edge stub for Eternal Quantum Horizons Ω — the Omega Platform. `src/index.ts` default-exports an `ExportedHandler`:

- `GET /healthz` → JSON `{ status: "ok", service: "omega-worker", scaffold: true }`
- Everything else → JSON 404

`wrangler.toml` sets `name = "omega-worker"`, `main = "src/index.ts"`, `compatibility_date = "2024-12-01"`.

## Scripts

- `pnpm dev` — `wrangler dev`
- `pnpm build` — `tsc -p tsconfig.json`
- `pnpm typecheck` — `tsc -p tsconfig.json`
- `pnpm lint` — `eslint src`
- `pnpm clean` — removes `dist`, `.turbo`, `.wrangler`

## Not yet built

No KV/D1/R2 bindings, no queues, no MCP gateway routing, no auth. Those arrive in later steps with their own configuration — never commit secrets to this repo.
