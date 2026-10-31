# @omega/docs-app — Omega Platform Documentation Portal

**Status: SCAFFOLD** — stub package only. No documentation site is generated yet.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

## What this is

A placeholder for the Omega Platform documentation portal for Eternal Quantum Horizons Ω. `src/index.ts` exports a single `DOCS_PORTAL` constant with `status: "SCAFFOLD"` so other packages and tooling can reference the portal before a real docs pipeline (generator, content source, hosting) is chosen.

Platform documentation source material lives in the monorepo `docs/` tree (architecture notes and ADRs); this app will eventually render it.

## Scripts

- `pnpm build` — `tsc -p tsconfig.json`
- `pnpm typecheck` — `tsc --noEmit -p tsconfig.json`
- `pnpm lint` — `eslint src`
- `pnpm clean` — removes `dist` and `.turbo`
