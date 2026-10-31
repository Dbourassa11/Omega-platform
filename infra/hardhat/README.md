# infra/hardhat — Hardhat Tooling

**Status: SCAFFOLD / planned** — placeholder only. No Hardhat project is configured here.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

## Intended purpose

Reserved for Hardhat-based contract tooling for the Omega Platform (Eternal Quantum Horizons Ω) if and where it complements the Foundry workflow: deployment scripts, network configuration, and TypeScript-side contract integration tests for the PhiSplit Economic Kernel contracts in `contracts/`.

## What will live here

- `hardhat.config.ts` and deployment scripts, if the Hardhat track is adopted.
- Network definitions (names and chain IDs only — **never private keys or seed phrases**; keys come from environment/secret stores, never this repo).
- Notes on how Hardhat tasks relate to the canonical Foundry test suite.

## Not yet built

Foundry is the current contract toolchain (see `infra/foundry/` and the CI contract step). This folder exists so the Hardhat decision has a home; nothing here runs today.
