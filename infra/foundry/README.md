# infra/foundry — Foundry Tooling

**Status: SCAFFOLD / planned** — placeholder describing the intended Foundry setup. The contracts themselves live in `contracts/` at the monorepo root.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

## Intended purpose

Foundry (`forge`, `cast`, `anvil`) is the canonical contract toolchain for the Omega Platform (Eternal Quantum Horizons Ω) — building, testing, and auditing the PhiSplit Economic Kernel contracts (PhiSplitRouter, MerkleAnchor, MemberPool, TreasuryRegistry, and related contracts) under `contracts/`.

## What will live here

- Foundry profile / remapping notes and pinned toolchain version.
- Fuzz and invariant test guidance, gas-report notes, and the audit-preparation checklist.
- CI notes: the `test` job in `infra/github-actions/ci.yml` installs Foundry via `foundry-rs/foundry-toolchain@v1` and runs `forge test` in `contracts/`.

## Not yet built

Contracts are unaudited scaffolds. No deployments, no verified addresses, no mainnet anything. **Never** commit private keys, deployer credentials, or `.env` files here — only `.env.example` with placeholder names.
