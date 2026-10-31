# @omega/ui

UI types for the Omega Platform — scaffold, framework-free (no React dependency).

Creator: David Charles Bourassa

## Status

`SCAFFOLD`

## Exports

- `CosmosPalette { background, gold, trustGold, memberCyan, opsGreen, royaltyPurple }`
- `DEFAULT_PALETTE` — background `#030308`, gold `#d4af37`, trustGold `#ffd700`, memberCyan `#22d3ee`, opsGreen `#34d399`, royaltyPurple `#a78bfa`
- `HudPanelProps { title, ring? }`
- `UI_STATUS = "SCAFFOLD"`

Depends on `@omega/consent-core` for `RingType`.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — lint `src/`
