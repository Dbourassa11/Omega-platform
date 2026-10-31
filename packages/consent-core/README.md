# @omega/consent-core

Foundation consent package for the Omega Platform.

Creator: David Charles Bourassa

## Overview

Defines the canonical consent model used across the platform:

- `RingType` — `"family" | "friends" | "work" | "public"` and `RING_TYPES`
- `ConsentReceipt` — a ring-scoped consent record with ISO-8601 timestamps
- `isReceiptActive(receipt, now)` — false if revoked or expired
- `canAccess(requiredRing, receipt, now?)` — ring-scoped, exact-ring match, deny-by-default

Access is granted only when a receipt exists, is active, and its ring exactly equals the required ring. There is no cross-ring inheritance.

## Usage

```ts
import { canAccess } from "@omega/consent-core";
import type { ConsentReceipt } from "@omega/consent-core";

const allowed = canAccess("family", receipt);
```

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm test` — run vitest tests
- `pnpm lint` — lint `src/`
