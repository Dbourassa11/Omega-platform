# infra/cloudflare — Cloudflare Infrastructure

**Status: SCAFFOLD / planned** — placeholder only. Nothing is provisioned or deployed from here yet.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

## Intended purpose

Home for Cloudflare infrastructure configuration for the Omega Platform (Eternal Quantum Horizons Ω): Workers deployments beyond the `apps/worker` stub, Pages hosting for `apps/web`, DNS/WAF notes, and any KV / D1 / R2 / Queues binding definitions.

## What will live here

- Environment and binding documentation (names only — **never secrets or tokens**; real values go through Cloudflare's secret store / CI secrets, never this repo).
- Deployment runbooks and rollback notes.
- Pointers to `apps/worker/wrangler.toml`, which remains the Worker's own config.

## Not yet built

No accounts wired, no zones configured, no deploys. Do not treat this folder as evidence of a live Cloudflare setup.
