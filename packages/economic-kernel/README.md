# @omega/economic-kernel

PhiSplit Economic Kernel for the Omega Platform.

Creator: David Charles Bourassa

## Overview

Implements the canonical recursive φ split in integer minor units (bigint) only — floating point is never used for money math.

- `PHI_MINOR_NUMERATOR = 618033988749894848n`, `PHI_DENOMINATOR = 1000000000000000000n` — PHI_MINOR = 0.618033988749894848 exactly as a rational
- `PHI_MINOR_FLOAT` — display only, never for money math
- `PhiSplit { trust, members, ops }` — all `bigint`
- `splitPhi(grossMinor)` — throws `RangeError` on negative input

### Rounding

- `trust = roundHalfUp(gross × φ)`
- `remaining = gross − trust`
- `members = roundHalfUp(remaining × φ)`
- `ops = remaining − members` (ops absorbs the rounding remainder)

Therefore `trust + members + ops === gross` always.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm test` — run vitest tests
- `pnpm lint` — lint `src/`
