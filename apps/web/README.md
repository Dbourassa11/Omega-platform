# @omega/web — Omega Platform Web App

**Status: shell SCAFFOLD with a real Step 4 cosmos demo.** Next.js 15 App Router shell; no backend, no auth, no persistence. The home page mounts the real `@omega/cosmos-engine` Three.js engine running **synthetic demo data only** — no real member data, accounts, or vault contents are connected.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

## What this is

- Next.js 15 (App Router) + React 19 shell for Eternal Quantum Horizons Ω — the Omega Platform.
- `app/layout.tsx` — root layout listing the seven canonical layers (Consent Ring Mesh, Holographic Cosmos Engine, Omni-Agentic Core, Digital Mirror System, PhiSplit Economic Kernel, MCP Universal Bridge, Quantum DevOps Fabric) with the creator attribution in the footer.
- `app/page.tsx` — home page with the interactive cosmos demo (`components/CosmosCanvas.tsx`) and a grid of the six product branches (Living Cosmos, Imagination Branches, Omni AI Agents, Legacy Garden, Economic Beacon, Universal Bridge), each marked SCAFFOLD.
- `components/CosmosCanvas.tsx` — client component that dynamically loads `@omega/cosmos-engine` in the browser, seeds it with `createDemoCosmos(42, N)`, and provides: consent-ring switcher (All / Family / Friends / Work / Public), demo node-count select (600 / 2,000 / 5,000), live node/FPS stats from the engine, click-to-select node inspection panel (kind / ring / branch / id, labeled as demo data), and a persistent "Synthetic demo constellation — no real member data" label. Respects `prefers-reduced-motion`.
- `app/globals.css` — minimal dark theme, no Tailwind.

## Scripts

- `pnpm dev` — `next dev`
- `pnpm build` — `next build`
- `pnpm start` — `next start`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — `eslint .`
- `pnpm clean` — removes `.next` and `.turbo`

## Not yet built

Consent-ring enforcement against real data, Omni-AI agents, PhiSplit flows, MCP connectors, accounts, and vault integration are later steps. Do not treat this shell as a working product.
