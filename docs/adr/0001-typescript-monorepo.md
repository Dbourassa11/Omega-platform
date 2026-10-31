# ADR 0001 — TypeScript Monorepo as the Canonical Foundation

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

## Status

Accepted — 2026-10-22

## Context

Two foundation directions existed for the Omega Platform:

- **M0 (prototype):** An earlier M0 build used a FastAPI (Python) service layer. It proved out concepts — including server-side patterns and an earlier contract draft — and its test suites passed at the time it was built. It was a prototype, not a designed long-term foundation.
- **Blueprint direction:** The v9 blueprint and the platform design work pointed toward a Turborepo-based monorepo, with shared TypeScript types flowing between the web app, packages, worker, and tooling.

Maintaining both as co-foundations would split types, tooling, and review effort, and would leave every future decision ambiguous about which stack is canonical.

The Implementation Plan resolved this conflict explicitly: the TypeScript monorepo is the foundation, and M0 is retained in its prototype role.

> Honest framing: this decision concerns a scaffold monorepo. There is no launched product, no users, and no revenue attached to either stack.

## Decision

**pnpm + Turborepo + TypeScript (strict) monorepo is the canonical foundation** of the Omega Platform, rooted at `~/workspace/omega-platform/monorepo/`.

- Package management: **pnpm** (workspaces).
- Task orchestration and caching: **Turborepo**.
- Language: **TypeScript in strict mode** across all apps and packages (`tsconfig.base.json`).
- The M0 FastAPI build is **retained as a prototype service layer only** — a reference and possible future service prototype, not the foundation. New canonical work lands in the monorepo.
- Solidity contracts live in the monorepo under `contracts/` and are built and tested with Foundry; they are part of the monorepo program, not of the M0 prototype.

## Consequences

**Positive:**

- One canonical type system: consent, economics, cosmos, AI, MCP, and legacy types are shared across `apps/web`, `apps/worker`, and all `packages/*` without duplication or drift.
- One toolchain to run, test, lint, and audit: `pnpm install`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm lint`.
- The Step 2 scaffold, future milestones, and all ADRs going forward assume this foundation — no per-feature stack negotiation.

**Costs / trade-offs:**

- Anything valuable in M0 must be deliberately ported into TypeScript (or kept behind a clearly bounded prototype service boundary); it does not come for free by import.
- Python-side tooling from M0 does not carry over; equivalent checks must exist in the monorepo's CI (Quantum DevOps Fabric).
- Contributors must treat "it works in M0" as prototype evidence only — canonical status requires the monorepo implementation and its tests.

**Follow-ups:**

- If a Python service is ever promoted from prototype to production use, it requires its own ADR stating its boundary, contract with the monorepo, and deployment story.
