# @omega/cosmos-engine

Holographic Cosmos Engine for the Omega Platform — the living 3D universe
where members, memories, creations, companies, legacy mirrors, and
connectors orbit a central Trust Beacon inside consent-ring shells.

Creator: David Charles Bourassa · Quantum Concepts LLC

## Status

**Step 4 implemented** — the Prototype layer (deterministic orbital layout,
ring filtering, picking, focus camera) and the Cinematic layer (procedural
nebula, fresnel ring shells, beacon particle flow, bloom + film grain) are
live in WebGL via three.js.

Future layers, not yet built: WebGPU renderer, WebXR / spatial navigation,
spatial audio.

## Architecture

Framework-agnostic TypeScript (no React imports). Two halves:

| Module | Side | Contents |
| --- | --- | --- |
| `src/types.ts` | shared | `CosmosNode`, `CosmosEdge`, `CosmosData`, `CosmosEngine`, `CosmosEngineOptions`, `CosmosStats`, `ActiveRing` |
| `src/prng.ts` | logic | `mulberry32` — seeded PRNG; every random choice in the package flows from a seed |
| `src/layout.ts` | logic | `RING_SHELL_RADIUS` (family 26, friends 44, work 62, public 82), `layoutCosmos(nodes, seed)`, `positionAt(params, t)` — Kepler-flavoured orbits on inclined shells |
| `src/filter.ts` | logic | `nodeVisualState` / `edgeBrightness` — the active consent ring stays full brightness/scale, everything else dims (0.12 / 0.82) |
| `src/data.ts` | logic | `createDemoCosmos(seed, nodeCount)` — synthetic demo graph (see honesty note below) |
| `src/shaders.ts` | render | GLSL string exports: nebula (fbm value noise), instanced nodes (pulse + fresnel), ring shells (fresnel), beacon particles (quadratic bezier flow), grain/vignette pass |
| `src/renderer.ts` | render | `createCosmosEngine(container, options)` — renderer, camera/controls, nebula + starfield, ring shells, Trust Beacon, instanced nodes, edges, particle flow, picking, focus tweens, post-processing, resize, disposal |
| `src/index.ts` | — | Public entry: re-exports the whole surface above |

Node colours by kind are exported as `NODE_KIND_COLORS` from the renderer
(member `#ffd977`, memory `#f5f2e8`, creation `#ffb347`, company `#57d7ff`,
legacy `#cfc4ff`, connector `#4fe3c1`).

## Public API

```ts
import { createCosmosEngine, createDemoCosmos } from "@omega/cosmos-engine";

const engine = createCosmosEngine(container, {
  reducedMotion: false, // freeze simulation time + pulse, stop auto-rotate
  quality: "auto",      // "auto" | "high" | "low"
  bloom: true,          // false (or quality "low") renders without post FX
});

engine.setData(createDemoCosmos(7, 600));
engine.setActiveRing("family"); // or "friends" | "work" | "public" | "all"

const offSelect = engine.onNodeSelect((node) => { /* node or null */ });
const offHover = engine.onNodeHover((node) => { /* node or null */ });

engine.focusNode("member-12"); // smooth ~1.2s camera move; user input cancels
engine.getStats();             // { fps, nodeCount } — fps is a live EMA
engine.dispose();              // full teardown; methods no-op afterwards
```

Behaviour notes:

- **Deterministic layout.** `setData` always lays out with seed `1337`, so
  the same dataset renders the same cosmos on every visit.
- **Picking.** Hover highlights (and shows a pointer cursor); a click
  (pointer-up within 6px of pointer-down) selects, clicking empty space
  deselects. A selected node keeps its highlight while you hover elsewhere.
  Edges touching the hovered/selected node brighten ×2.4.
- **Auto-rotate** runs at 0.4 speed until the user's first drag, then never
  again for that engine instance.
- **Reduced motion** freezes simulation time at a composed start frame,
  disables node pulsing and particle flow time, and stops auto-rotate.
- **Beacon flow.** Up to 240 member nodes stream 3 particles each along
  bezier arcs into the Trust Beacon at the origin.

## Data model

```ts
interface CosmosNode {
  id: string;
  kind: "member" | "memory" | "creation" | "company" | "legacy" | "connector";
  ring: RingType; // "family" | "friends" | "work" | "public" (@omega/consent-core)
  label: string;
  branch?: string; // e.g. "photos", "music" for memory/creation nodes
}

interface CosmosEdge {
  source: string;
  target: string;
  kind: "relationship" | "branch" | "economic";
}
```

## Demo data honesty

Everything `createDemoCosmos` produces is **synthetic**: labels are
literally `Demo Member 001`, `Demo Company A`, `Legacy Mirror — Demo
Member 001`, and so on. Connector nodes carry real product names (Meta,
Notion, Google, GitHub, Stripe, Cloudflare) as *labels of connector slots*
— they are placeholders for integrations, not claims of live connections
or real member data.

## How the web app uses it

The web shell owns the DOM and the surrounding UI (ring switcher, stats
readout, node-count control). It mounts one engine per cosmos view,
feeds it data with `setData`, forwards ring changes with
`setActiveRing`, and renders selection details from the
`onNodeSelect` callback. The engine owns everything inside the canvas.

## Performance notes

- **Nodes are a single `InstancedMesh` — 1 draw call for all nodes**,
  regardless of count. Per-instance colour, pulse, brightness, and
  highlight travel in instanced buffer attributes; only the instance
  matrices are rewritten per frame.
- Edges are one `LineSegments`; beacon particles are one `Points`.
  The rest of the scene (nebula, starfield, 4 shells, beacon) is a
  handful of static draws.
- Pixel ratio is capped by quality: `low` = 1 (and no post-processing),
  `auto` = min(devicePixelRatio, 1.75), `high` = min(dpr, 2).
- The demo's node-count control exercises **600 / 2,000 / 5,000 nodes**;
  the FPS figure in the UI is the engine's live `getStats().fps`
  (exponential moving average). No headless or offline FPS numbers are
  claimed anywhere — measure in the browser, on the device that matters.

## Scripts

- `pnpm build` — compile to `dist/`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — lint `src/`
- `pnpm test` — vitest (pure-logic modules)
