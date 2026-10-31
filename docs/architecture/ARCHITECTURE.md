# Omega Platform — Architecture

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

> "No Artificial, Only Official Art"

**Status:** Canonical architecture for the Step 2 scaffold. Implementation Plan Step 1 deliverable.

> **Honest status:** This document describes the canonical architecture for a scaffold monorepo. This is not a launched product. There are no users, no revenue, and no partnerships. Components are labeled SCAFFOLD, WORKING, or testnet-grade accordingly in the product taxonomy below. Nothing in this document should be read as a claim of a deployed system.

---

## 1. Canonical layers

The Omega Platform is organized into seven canonical layers. These names are canonical — use them in code, docs, issues, and contracts. Do not substitute earlier draft names.

| Domain | Canonical layer name | Purpose |
| --- | --- | --- |
| Identity | **Consent Ring Mesh** | Family / Friends / Work / Public access controls, plus custom rings. Deny-by-default consent, receipts, and revocation for every item. |
| Visual world | **Holographic Cosmos Engine** | Infinite node constellations, dimensions, effects, and branches. Renders the Living Cosmos, Eternal Garden, and Imagination Branches as a navigable 3D social / memory graph. |
| AI | **Omni-Agentic Core** | Embedded AI agents, semantic search, content creation, and assistant orchestration. Own-data-only, with provenance on every generation. |
| Legacy | **Digital Mirror System** | Memory ingestion, persona retrieval, and the Eternal Garden. Imports a person's own archives and makes them retrievable under consent. |
| Economics | **PhiSplit Economic Kernel** | Golden Ratio routing, ledgers, and revenue visualization. Exact recursive φ math in code; on-chain routing via the smart contract suite. |
| Connectors | **MCP Universal Bridge** | Meta, Notion, GitHub, Stripe, cloud, storage, and future adapters. Scoped, consent-gated access to external systems via MCP. |
| Deployment | **Quantum DevOps Fabric** | Turborepo, CI/CD, security scanning, environments, and observability. Build, test, audit, and deployment infrastructure for the monorepo. |

---

## 2. Canonical product branches

Six canonical product branches sit on top of the seven layers. Branch names are canonical.

| Branch | Description |
| --- | --- |
| **Living Cosmos** | The primary 3D cosmos — posts, memories, and connections as stellar nodes organized by consent rings. |
| **Imagination Branches** | Branching creative spaces forked from the Living Cosmos for what-if worlds, drafts, and alternate arrangements. |
| **Omni AI Agents** | The family of embedded agents (Oracle, Consent Guardian, Memory Curator, Avatar, Legacy Mirror, Studio, Connector, Economic Steward) operating inside the Omni-Agentic Core. |
| **Legacy Garden** | The Eternal Garden — a grief-safe, consent-bounded place for a person's own memories and, where they have explicitly configured it, legacy / mirror material. |
| **Economic Beacon** | Revenue visualization, φ-split routing views, and ledger transparency powered by the PhiSplit Economic Kernel. |
| **Universal Bridge** | The connector surface — scoped external integrations via the MCP Universal Bridge, presented to the user as one bridge. |

---

## 3. Architecture diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        OMEGA PLATFORM                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌────────────┬────────────┼────────────┬────────────┐
        ▼            ▼            ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Consent │ │Holographic│ │  Omni-   │ │ Digital  │ │ PhiSplit │
   │  Ring   │ │  Cosmos   │ │ Agentic  │ │  Mirror  │ │ Economic │
   │  Mesh   │ │  Engine   │ │   Core   │ │  System  │ │  Kernel  │
   └─────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
        ┌────────────┬────────────┐
        ▼            ▼            ▼
   ┌──────────────────┐   ┌──────────────────┐
   │  MCP Universal   │   │ Quantum DevOps   │
   │     Bridge       │   │     Fabric       │
   └──────────────────┘   └──────────────────┘

  Consent Mesh / Omni Core / Digital Mirror
                    │
                    ▼
        ┌───────────────────────┐
        │ Encrypted IndexedDB   │
        │        Vault          │
        │ AES-GCM per item,     │
        │ per-ring wrapped keys │
        └───────────────────────┘

  MCP Bridge
                    │
                    ▼
        ┌───────────────────────┐
        │ Scoped External       │
        │ Connectors            │
        │ Meta · Notion ·       │
        │ GitHub · Stripe ·     │
        │ cloud · storage ·     │
        │ future adapters       │
        └───────────────────────┘

  PhiSplit Kernel
                    │
                    ▼
        ┌───────────────────────┐
        │ Smart Contract Suite  │
        │ PhiSplitRouter ·      │
        │ ReserveVault ·        │
        │ MerkleAnchor          │
        └───────────────────────┘

  Cosmos Engine / Omni Core / PhiSplit
                    │
                    ▼
        ┌───────────────────────┐
        │    Visual Realms      │
        │ Living Cosmos ·       │
        │ Eternal Garden ·      │
        │ Imagination Branches  │
        └───────────────────────┘
```

Reading the diagram:

- All seven layers compose the platform. No layer bypasses the Consent Ring Mesh.
- The Consent Ring Mesh, Omni-Agentic Core, and Digital Mirror System read and write through the **Encrypted IndexedDB Vault** — the local-first client vault (see ADR 0003).
- The MCP Universal Bridge is the *only* path to external systems, and every connector is scoped.
- The PhiSplit Economic Kernel's on-chain counterpart is the **Smart Contract Suite**: `PhiSplitRouter`, `ReserveVault`, and `MerkleAnchor` (plus scaffold stubs `MemberPool` and `TreasuryRegistry`).
- The Holographic Cosmos Engine, Omni-Agentic Core, and PhiSplit Economic Kernel together drive the **Visual Realms**: Living Cosmos, Eternal Garden, and Imagination Branches.

---

## 4. Product taxonomy

Every unit in the monorepo, mapped to its canonical layer, product branch, and honest status.

| Unit | Layer | Branch | Status |
| --- | --- | --- | --- |
| `apps/web` | Holographic Cosmos Engine | Living Cosmos | SCAFFOLD |
| `apps/docs` | Quantum DevOps Fabric | — | SCAFFOLD |
| `apps/worker` | Quantum DevOps Fabric | Universal Bridge | SCAFFOLD |
| `packages/consent-core` | Consent Ring Mesh | Living Cosmos | WORKING — types + checks |
| `packages/economic-kernel` | PhiSplit Economic Kernel | Economic Beacon | WORKING |
| `packages/cosmos-engine` | Holographic Cosmos Engine | Living Cosmos | SCAFFOLD |
| `packages/ai-core` | Omni-Agentic Core | Omni AI Agents | SCAFFOLD |
| `packages/mcp-gateway` | MCP Universal Bridge | Universal Bridge | SCAFFOLD |
| `packages/legacy-engine` | Digital Mirror System | Legacy Garden | SCAFFOLD |
| `packages/ui` | Holographic Cosmos Engine | Living Cosmos | SCAFFOLD |
| `contracts/PhiSplitRouter` | PhiSplit Economic Kernel | Economic Beacon | WORKING — testnet-grade, unaudited |
| `contracts/ReserveVault` | PhiSplit Economic Kernel | Economic Beacon | WORKING — testnet-grade, unaudited |
| `contracts/MerkleAnchor` | PhiSplit Economic Kernel | Economic Beacon | WORKING — testnet-grade, unaudited |
| `contracts/MemberPool` | PhiSplit Economic Kernel | Economic Beacon | SCAFFOLD — stub |
| `contracts/TreasuryRegistry` | PhiSplit Economic Kernel | Economic Beacon | SCAFFOLD — stub |
| `infra/*` | Quantum DevOps Fabric | — | SCAFFOLD / supporting |

Status key:

- **SCAFFOLD** — canonical type surfaces, shells, or stubs only. No production behavior is claimed.
- **WORKING** — implemented and tested in the monorepo (unit / property tests as applicable).
- **WORKING — testnet-grade, unaudited** — implemented and Foundry-tested, suitable for testnet experimentation only. **Not audited. Not for real funds.**

---

## 5. Cross-cutting invariants

These invariants hold across every layer, branch, app, package, and contract. A feature that violates one of them is not done, regardless of its status label.

1. **Consent before everything.** Consent is checked before retrieval, render, generation, sync, and export. There is no code path that reads, displays, generates from, syncs, or exports an item without a consent check first.
2. **Deny-by-default rings.** Consent rings (Family / Friends / Work / Public + custom) deny by default. Access requires an explicit grant for that ring; absence of a grant is a denial, never a default-allow.
3. **Own-data-only AI, with provenance.** The Omni-Agentic Core trains on and generates from the user's own sovereign data only — "No Artificial, Only Official Art." Every generated artifact carries provenance: what source items it derived from, under what consent, and when.
4. **Exact φ math in code.** The recursive φ split is computed with exact math in code (bigint minor units; see ADR 0002). "62/38" is UI shorthand only and must never appear in calculations, contracts, ledgers, or tests as the operative split.
5. **Everything auditable.** Consent decisions, retrievals, generations, syncs, exports, and economic routing leave an auditable record. If it cannot be audited, it does not ship.
6. **Legal gates for enforceable economics.** The φ-split, trusts, and any "perpetual" provisions are a design specification until cleared. Enforceable deployment requires legal, tax, securities, privacy, and platform-policy counsel, plus an independent contract audit. No contract in this repo is for real funds in its current state.

---

## 6. Architecture decisions

The decisions that define this architecture are recorded as ADRs in `docs/adr/`:

- [ADR 0001 — TypeScript Monorepo](../adr/0001-typescript-monorepo.md) — pnpm + Turborepo + TypeScript strict is the canonical foundation; the M0 FastAPI build is retained as a prototype service layer, not the foundation.
- [ADR 0002 — Recursive Phi Split](../adr/0002-recursive-phi-split.md) — the canonical economic split is recursive φ (Trust 61.8033988% / Members 23.6067976% / Operations 14.5898036%); exact math in code, "62/38" is UI shorthand only.
- [ADR 0003 — AES-GCM Client Vault](../adr/0003-aes-gcm-client-vault.md) — the client vault standard is AES-GCM per item with per-ring wrapped keys in IndexedDB.
- [ADR 0004 — Attribution Name](../adr/0004-attribution-name.md) — creator attribution is **David Charles Bourassa** in all code, docs, metadata, and credits.

---

*Omega Platform — Quantum Concepts LLC, Santa Fe, New Mexico. Scaffold architecture; no launched product, no users, no revenue, no partnerships are claimed.*
