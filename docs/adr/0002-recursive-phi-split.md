# ADR 0002 — Recursive Phi Split as the Canonical Economic Split

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

## Status

Accepted — 2026-10-22

## Context

The Omega Platform's economics route revenue by the Golden Ratio (φ). Three different statements of the split existed, and they do not agree:

- **M0 contracts:** 61.8 / 25 / 13.2 (Trust / Members / Operations). This was the split implemented in the earlier M0 contract draft.
- **Rounded shorthand:** 62 / 38 — a two-part rounding used in presentation and UI copy. It is not a three-way split at all.
- **Recursive φ:** Apply φ twice — Trust takes φ of the gross; Members take φ of the remainder; Operations take what remains. This is the mathematically coherent version of the design intent ("recursive φ split"), and the Implementation Plan adopted it as canonical.

Leaving multiple operative splits in code, contracts, and copy would produce ledgers that do not reconcile and a model no auditor could certify.

> Honest framing: the split below is a design specification for a scaffold. No funds flow through it, there is no revenue, and no contract in this repo is deployed for real funds.

## Decision

**The canonical split is the recursive φ split:**

```text
φ = 1.618033988749894848…

Trust      = gross × 0.618033988749894848
Remainder  = gross − Trust
Members    = Remainder × φ-share of remainder  (i.e. Remainder × 0.618033988749894848)
Operations = Remainder − Members
```

Resulting shares of gross:

| Destination | Share of gross |
| --- | --- |
| Trust | **61.8033988%** |
| Members | **23.6067976%** |
| Operations | **14.5898036%** |
| **Total** | **100%** |

Rules that follow from this decision:

- **Exact math in code.** The split is computed with exact rational / fixed-point math in code, in **bigint minor units** — never with floating-point percentages, and never with the rounded numbers above as inputs. The percentages in the table are the human-readable statement of the result, not the implementation.
- **"62/38" is UI shorthand ONLY.** It may appear in presentation/UI copy as an approximation. It must never appear in calculations, contracts, ledgers, tests, or documentation of the operative split.
- **M0 numbers are superseded.** The 61.8 / 25 / 13.2 split from the M0 contracts is no longer canonical anywhere. The monorepo's `packages/economic-kernel` and `contracts/` (PhiSplitRouter, ReserveVault, MerkleAnchor) implement the recursive φ split.
- A separate **15%-of-operations reserve** concept appeared in blueprint drafts; where it applies, it is taken from the Operations share under its own rule and does not change the canonical three-way split above.

## Consequences

**Positive:**

- One split, stated exactly, implemented in one place (`packages/economic-kernel`) and mirrored on-chain — ledgers, UI, and contracts can be checked against each other.
- The split is derivable from φ alone, so any implementation can be independently verified against the formula above.

**Costs / trade-offs:**

- M0 contract code using 61.8 / 25 / 13.2 is obsolete as economics (retained only as prototype history).
- Any material quoting "62/38" must be understood — and where necessary labeled — as shorthand, not the split.

**Audit plan (required before any real funds):**

1. Unit tests for the kernel split, including edge values and remainder handling in minor units.
2. Fuzz / property tests (split sums to gross; no negative shares; monotonicity).
3. Slither static analysis on the contract suite.
4. Foundry invariant tests on the routing contracts.
5. Formal verification of the core routing invariants.
6. **Independent security audit** by an external firm.

**Legal gate:**

Enforceable deployment of this economics — trusts, member distributions, any "perpetual" provisions — requires legal, tax, and securities counsel, plus privacy and platform-policy review. Nothing in this ADR, the kernel package, or the contract suite constitutes an enforceable financial arrangement in its current scaffold state.
