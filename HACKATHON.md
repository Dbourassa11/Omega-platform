# Omega Platform — Eternal Quantum Horizons Ω

**Designed as an overlay for Facebook — the next-generation Facebook platform layer: your Facebook graph rendered as a living, consent-bound cosmos you actually own. Built on Meta's own AI stack, owned by you.**

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico

---

## Event Facts & Hard Deadlines

> **APPLICATION STATUS — SUBMITTED.** David Charles Bourassa submitted the
> application on **October 23, 2026**, ahead of the deadline below. Judging is
> scored on the **verified official criteria in Section 7** (Impact 30% ·
> Use of Meta AI Tooling 25% · Demo 25% · Technical Depth & Execution 20%).
>
> - **Event:** Meta Global AI Developer Hackathon 2026
> - **Applications close:** **October 25, 2026, 11:59 PM ET** — rolling review, 20,000-participant cap
> - **Application:** https://dev.meta.ai/events/global-hackathon
> - **Build window:** October 26 – November 4, 2026
> - **Projects due:** **November 4, 2026, 9:00 PM ET**
> - **Prize pool:** $1M
> - **Selected participants receive:** $150 in Meta Model API credits
> - **Stack center:** Meta Model API (Muse Spark series, Muse Image, SAM 3.1) + open-weights models
>
> Application window (now closed):

---

## 1. What Omega Is

Omega Platform — "Eternal Quantum Horizons Ω" — is a consent-bound, holographic social-memory layer designed as an overlay / integration on Facebook, not a standalone competing social network.

The cosmos, consent rings, vault, and AI agents layer over the member's existing Facebook graph via the MCP Universal Bridge's Meta adapter (Graph API where platform policy allows; user data exports as fallback). The AI core is designed to run on Meta's own stack: Meta Model API / Muse Spark, with Muse Image and SAM 3.1 on the roadmap.

**Canonical layers:**

- **Consent Ring Mesh** — Family / Friends / Work / Public rings govern all access. Every data item, node, and AI retrieval is ring-scoped.
- **Holographic Cosmos Engine** — Three.js scene: instanced nodes, ring shells, Trust Beacon particle flow, nebula shader, bloom — plus Universe mode (simulated cosmic web) and a speculative Multiverse view. Working, with 102 engine tests.
- **Omni-Agentic Core** — The canonical 8-agent fabric: Oracle, Consent Guardian, Memory Curator, Avatar, Legacy Mirror, Studio, Connector, Economic Steward — data-driven definitions with a consent-gated, receipted runtime (`/agents`).
- **Digital Mirror System** — Legacy ingestion and the Eternal Garden mode for long-term personal memory. *Status: the Eternal Garden demo surface is BUILT (Oct 26) — synthetic legacy archive, era-clustered garden visualization, provenance-cited Q&A with abstention and Guardian ring enforcement (`packages/ai-core/src/legacy/` + `/garden`).*
- **PhiSplit Economic Kernel** — Recursive golden-ratio split: Trust 61.8033988% / Members 23.6067976% / Operations 14.5898036%. Exact bigint math. Working and property-tested over 1,000 amounts.
- **MCP Universal Bridge** — Working JSON-RPC connector gateway with a 10-adapter catalog: Meta-export / Notes / Files / GitHub (fixtures) / Notion (fixtures) working, Stripe sandbox, four infra stubs; rate limiter, circuit breaker, PKCE, and tool receipts; MCP 2026-07-28 alignment.
- **Quantum DevOps Fabric** — pnpm + Turborepo + TypeScript strict, CI, ADRs.

**Project claim (combination-scoped):**

> The project claims to be the first social platform to combine a navigable 3D cosmos interface with a member-keyed encrypted data vault and a personal AI grounded solely in each member's own data — every output carrying an "official personal AI" provenance badge.

This is presented as the project's claim, scoped to that specific combination.

---

## 2. Entry Recommendation

**Primary track: Startup**

Rationale: There is a founder and an LLC — Quantum Concepts LLC — behind the project, and the repo reflects a production-grade program rather than a weekend prototype:

- Tested contract suite (Foundry, 9/9 including fuzz)
- Architecture Decision Records (ADRs 0001–0004)
- CI gates: typecheck 12/12, lint, build
- Phase gates and an audit plan for contracts
- Monorepo structure: pnpm + Turborepo + TypeScript strict

**Fallback track: Indie** — if Startup eligibility or team composition requires it on the application page, the same submission maps cleanly to Indie criteria (see table in Section 4).

**Theme — Primary: "Build for Your World"**

Data sovereignty for your own world — your Facebook life, your keys, your rules. The Consent Ring Mesh, member-keyed vault, and ring-scoped AI retrieval are a direct expression of this theme.

**Theme — Secondary: "Push the Frontier"**

A navigable 3D social cosmos, a recursive φ-split economic kernel in exact bigint math, and provenance-badged personal AI ground the frontier claim in working code.

---

## 3. Positioning: An Overlay on Facebook

Omega is designed as an overlay for Facebook — the blueprint's wrap-around bridge — intended as the next-generation Facebook platform layer.

It does **not** ask members to leave Facebook or rebuild their graph elsewhere. It layers on top:

- **Cosmos layer** — the member's existing graph becomes a navigable 3D cosmos (Holographic Cosmos Engine).
- **Consent layer** — Family / Friends / Work / Public rings (Consent Ring Mesh) decide what any viewer or agent may see.
- **Vault layer** — member-keyed encrypted storage for the data that matters most.
- **AI layer** — Omni-Agentic Core agents (the 8-agent fabric: Oracle, Consent Guardian, Memory Curator, Avatar, Legacy Mirror, Studio, Connector, Economic Steward) grounded solely in the member's own data, running on Meta's own AI stack.
- **Bridge layer** — the MCP Universal Bridge connects via its Meta adapter: Graph API where platform policy allows; user data exports as fallback.

**Strategic fit:** The project extends Facebook rather than competing with it. It gives Facebook members a reason to deepen — not duplicate — their presence on the platform, using Meta Model API, Muse Spark, and (on the roadmap) Muse Image and SAM 3.1 as the intelligence layer. That is the story Meta judges are primed for: a new experience layer *for* Facebook.

*Frame note: All of the above is design intent — "designed as an overlay for Facebook." No Meta endorsement, partnership, or approval is implied.*

---

## 4. Judging Criteria → Evidence Mapping

Repo totals today (recomputed Oct 28 2026, after the Phase 4 Alive Pass): **vitest 543 tests, forge 9 tests, `@omega/web` production build green (20 routes) and lint clean — 0 errors, 0 warnings — all under the full turbo gate (`turbo build typecheck lint test`, 48/48 tasks).**

**Official judging criteria (verified from Cerebral Valley's Official Rules — see Section 7) → where the evidence lives:**

| Official criterion (weight) | Evidence in this repo |
|---|---|
| **Impact (30%)** | The problem and its beneficiaries are argued in `SUBMISSION.md`: members who built their lives inside a graph they don't own; families preserving a legacy under consent. The Eternal Garden (`/garden` + `packages/ai-core/src/legacy/`) makes the benefit tangible: a life archive that answers only with cited truth, abstains rather than inventing, and is Family-ring by default. The overlay positioning (Section 3) means adoption never asks anyone to leave Facebook. |
| **Use of Meta AI Tooling (25%)** | `packages/ai-core`: the WORKING 8-agent fabric (`AGENT_FABRIC` + `runAgentTask` — ring-scoped, consent-gated, every run receipted; `/agents` runs it live in the browser) built around a Meta Model API client (base URL confirmed from Meta's own example; default model the newest documented Spark id `muse-spark-1.3`, `muse-spark-1.1` kept as the confirmed pinned fallback), documented-envelope contract tests incl. 401/429/5xx paths, Muse Image client + Creative→Vault provenance seam, SAM 3.1 as typed design only where its shape is undocumented, one env signal flipping every AI surface LIVE/OFFLINE with the answering model named on the badge. The **Omni execution layer** (registry / planner / executor in the same package) is built around the same client seam: plans are typed data in the exact schema the live Muse Spark planner will emit when the key lands — today a deterministic offline planner emits them and the mode is badged OFFLINE. Full graded findings: `docs/META_API_NOTES.md`. Activates with zero code change when the key lands; until then every answer is badged offline — nothing claims to be live. |
| **Demo (25%)** | Twenty working routes including a **Guided Demo** (`/demo`) that walks the Section 6 script as clickable captioned steps, a **Public Platform shell** (`/public`) showing exactly what a public audience may see, an **Omni-AI Agents console** (`/agents`) running the 8-agent fabric live with receipts, a **Review Workstation** (`/review`) where agent proposals activate only on human approval and plans run only after whole-plan approval with per-step veto, and the **critical Omni Demonstration** (`/review/demo`): one goal — create a sustainable-technology community, build three specialized agents, gather authorized evidence, organize findings, draft educational content, prepare launch — executed end to end through the policy engine and the tool gateway, landing a real local community (`/communities`) and new cosmos nodes (`/cosmos`, 604 nodes, chip-labeled); and an **Operator Control plane** (`/control`) with a live revoke-and-purge demo, a **Privacy Control Center** (`/privacy`) running the Universal Access Engine live (permission matrix, access preview, temporary passes, consent dashboard, audit), and a **Five-Viewer Demonstration** (`/privacy/demo`) rendering one synthetic member's world as five different authorized views — Doctor, Family, Friend, Coworker, Public — every card an engine decision with its deny reason shown; the engine's automatic quality-degrade (frame-time state machine with hysteresis) keeps the live demo from choking; a scripted capture pipeline produced a silent 36 s DRAFT video (`docs/demo-video/draft-demo.mp4`) against the real UI — the final two-minute voiced cut is recorded from the same beats before submission. |
| **Technical Depth & Execution (20%)** | 543 vitest + 9 forge across nine tested packages (cosmos-engine 119, ai-core 165, mcp-gateway 72, policy-engine 51, meta-export 41, economic-kernel 35, consent-core 25, legacy-engine 23, vault-core 12); a **stellar-physics model** in the cosmos engine (friends → mass, followers → density + brightness at exactly unchanged mass — monotonicity is a tested contract, and the inspector computes the readouts live); a **live planner** whose model-drafted plans are validated against the registry / tool registry / scopes before they exist (hallucinated tools rejected with all reasons), a **versioned skills system** the executor enforces alongside the allowlist, and **run reflections** stored in each run's versioned vault record (live-written when keyed, template-labeled otherwise); an **agent execution model** with the safety properties proven as tests, not prose: a proposed agent cannot activate without a person's approval (agent approvers throw), an unapproved plan cannot execute, a vetoed step never runs, an out-of-scope step is refused with the engine's reason and **zero tool calls made**, each step runs under a purpose-limited pass issued by the member-owner that **expires when the run completes** (post-run evaluation denies), and every step lands a receipt in a versioned vault run record; exact-bigint recursive φ math; a public disclosure facade with leakage tests (allowlist-sanitized member-dispersion payloads only); consent revocation that purges cached AI/connector context, proven in tests and in the `/control` demo; real browser cryptography (AES-GCM + AES-KW ring wrapping) verified end-to-end; a working JSON-RPC tool gateway with protocol-level tests; a versioned memory vault whose consistency scorer enforces the real-data-only rule in code; a generalized **policy engine** (`@omega/policy-engine`) evaluating the full access tuple (subject + resource + action + purpose + relationship + consent + policy + context + expiration) across 10 data domains and 8 actions, with deny-wins individual overrides, purpose-limited expiring passes, per-decision audit events, and a 28-case security-test matrix proving the five-viewer scenario (doctor sees medical, never family conversations; an expired pass denies; revocation denies on the next evaluation and purges cached context); a Facebook-export ingest pipeline (parser → ring inference → cosmos) tested at every stage; ADRs 0001–0004; gates re-run on the final tree (full turbo gate — `turbo build typecheck lint test`, 48/48 tasks); scaffold labeled scaffold, contracts labeled unaudited/testnet-grade. |

The earlier track-lens mapping is retained below as supporting detail:

| Criterion | What judges look for | Concrete evidence in this repo |
|---|---|---|
| **Startup — Technical execution** | Sound architecture, correct implementation, tests that prove behavior, not slides | `packages/cosmos-engine`: real Three.js engine — single-draw-call InstancedMesh nodes, custom shader (pulse, fresnel rim, hover/select), four consent-ring shells, Trust Beacon with GPU bezier particle flow, 5-octave fbm nebula + starfield, bloom post-processing — 102 engine tests. **Universe mode**: a seeded cosmic-web generator (filaments, clusters at intersections, true voids; galaxy-class colors) whose distribution properties are themselves unit-tested (void-vs-filament median distance, class shares). `packages/economic-kernel`: recursive φ-split in exact bigint math, property-tested over 1,000 amounts. `contracts/`: PhiSplitRouter + ReserveVault + MerkleAnchor, Foundry-tested 9/9 incl. fuzz. `packages/consent-core`: ring types + `canAccess` checks, tested. `packages/vault-core`: AES-GCM item encryption with AES-KW ring-wrapped keys — round-trip and wrong-ring rejection tested. |
| **Startup — Production-readiness** | CI, decision records, reproducibility, a credible path to ship, honest risk labeling | Quantum DevOps Fabric: pnpm + Turborepo + TypeScript strict monorepo; CI gates (production build and lint — 0 errors, 0 warnings — for the web app; vitest 543, forge 9, under the full turbo gate — `turbo build typecheck lint test`, 48/48 tasks). ADRs 0001–0004 document the foundation, split, and vault decisions. Scaffold packages are explicitly labeled as scaffold (`ui`; MemberPool / TreasuryRegistry contracts; `apps/docs`, `apps/worker`) — Phase 3 (Oct 27) moved `mcp-gateway` (JSON-RPC tool gateway) and `legacy-engine` (continuity core) from scaffold to working, and added `meta-export` (Facebook export ingest). Contracts are labeled unaudited, testnet-grade, with an audit plan — no deployability overclaim. |
| **Indie — Creativity** | A genuinely new experience or combination, not a reskin | A navigable 3D cosmos as the social interface itself: ring switcher re-lights the universe as access changes; Trust Beacon visualizes value flow in-scene; a simulated cosmic web and a clearly-labeled speculative multiverse extend the same engine; Eternal Garden mode (Digital Mirror System) for legacy memory. The combination claim in Section 1 is the creative thesis. |
| **Indie — Technical ambition** | Hard problems attempted with real technique | Single-draw-call instancing for 5,000-node scenes with live FPS readout; custom GLSL (nebula fbm, fresnel shells, particle bezier flow); a seeded cosmic-web generator with statistically tested structure; exact bigint recursive-φ economics instead of floating-point approximations; Merkle anchoring in-contract (`MerkleAnchor`); real client-side vault cryptography (AES-GCM + AES-KW ring wrapping); ring-scoped retrieval with Guardian enforcement for the Oracle agent. |
| **Indie — "It works"** | A live demo a judge can run and poke, resilient without secrets | `apps/web` is now a twenty-route working dashboard (Overview, Public Platform, Cosmos, Import Archive, Vault, Creative Suites, Share Center, Communities, AI Oracle, Omni-AI Agents, Review Workstation, Eternal Garden, Consent Rings, Privacy Control Center, PhiSplit, Guided Demo, Operator Control, Settings): the cosmos demo (ring switcher, 600 / 2,000 / 5,000-node control, fly-to-node, live FPS readout, inspection panel, persistent "Synthetic demo constellation — no real member data" label) plus Universe and Multiverse views; an Import Archive page that parses a real-shaped Facebook export **entirely in the browser** — nothing is uploaded — infers consent rings for every person, and renders the imported graph in the same consent cosmos (dataset switcher on the Cosmos page); a Vault where uploads are really encrypted in-browser and decrypt-verified; an Oracle whose in-ring answers cite demo nodes and whose out-of-ring answers are visibly refused by the Guardian; an Eternal Garden whose legacy Q&A cites its sources and abstains rather than inventing — All running on the labeled offline path, so the demo never hard-fails without a key. 543 vitest + 9 forge tests pass (full turbo gate, 48/48 tasks). **Render verified Oct 23 2026** (consent cosmos), **Oct 26 2026** (the dashboard incl. Universe/Multiverse, Garden, and the Guided Demo), and **Oct 27 2026** (the full import flow: sample export → ring-assigned summary → imported cosmos with live ring filtering) by headless capture of the production build — zero console errors (screenshots: `docs/images/cosmos-demo.png`, `docs/images/dashboard-overview.png`, `docs/images/cosmos-universe.png`, `docs/images/phase3-import-result.png`, `docs/images/phase3-imported-cosmos.png`). The Oct 28 capture added the Privacy Control Center and the Five-Viewer Demonstration — the Doctor's preview allows exactly the two synthetic healthcare records and the Family view unlocks only family-heritage records plus the memoir (screenshots: `docs/images/phase3c-privacy-preview-doctor.png`, `docs/images/phase3c-demo-family.png`). A second Oct 28 capture verified the Omni execution flow end to end in the browser: the critical demonstration completed 10/10 steps with a vault receipt, a workstation proposal was approved into an ACTIVE agent, the created community rendered with its published educational post, and the cosmos showed the Omni additions at 604 nodes (screenshots: `docs/images/phase3b-review-demo.png`, `docs/images/phase3b-review-workstation.png`, `docs/images/phase3b-communities.png`, `docs/images/phase3b-cosmos-omni.png`) — zero console errors. A final Oct 28 optimization pass re-swept **all twenty routes** on the production build — zero console errors on every route — and re-verified the Privacy Control Center after its typed rewrite (the Doctor's preview still allows exactly the two synthetic healthcare records), checked the seven key pages at 390 px with no horizontal overflow, and captured the cosmos engine's new camera auto-framing (imported 29-node graph framed at its own bounds; 600-node demo framing the full public shell — `docs/images/phase-opt-cosmos-demo.png`, `docs/images/phase-opt-imported-cosmos.png`). The pass also cut First Load JS sharply (Overview 270 → 118 kB, AI Oracle 427 → 144 kB; heaviest route is now 154 kB) by importing the pure data module directly and routing browser consumers through the gateway's browser-safe entry — the full audit is `docs/COMPLETION_AUDIT.md`. No performance figure is claimed — verification ran under software rendering. A Phase 4 (Alive Pass) capture on Oct 28 verified the living layer on the production build: a member star's inspector computing Friends / Followers / Mass / Density / Brightness live (Demo Member 072: 3 · 419 · 2.39 · 7.04 · 18.68), the Skills library on `/agents`, and the Review Workstation's agent monitor showing per-agent run history with the run's source-labeled reflection — zero console errors (screenshots: `docs/images/phase-alive-cosmos-inspector.png`, `docs/images/phase-alive-skills.png`, `docs/images/phase-alive-review.png`). |
| **Strategic fit (cross-track)** | Does this make the host platform stronger? Does it use the sponsor stack for real? | Designed as an overlay for Facebook via the MCP Universal Bridge Meta adapter — it extends the existing graph instead of competing with it. AI core targets Meta Model API / Muse Spark as its primary runtime (adapter ready in `ai-core`); Muse Image and SAM 3.1 on the roadmap for Mirror / Garden enrichment. |

---

## 5. Build Plan — October 26 to November 4, 2026

**Status at Day 1 (Oct 26):** the dashboard, Universe/Multiverse modes, the
working Vault, and the Oracle + Guardian layer (offline path) all landed ahead
of this plan — see the evidence map in Section 4. What remains is the live-API
wiring (blocked on the key + credits) and the final voiced demo video.
A follow-up public-docs check (Oct 26, `docs/META_API_NOTES.md`) set the
adapter's default model to the newest documented Spark id, `muse-spark-1.3`,
keeping `muse-spark-1.1` — the id in Meta's own example — as the pinned
fallback.

**Day 1–2 — Oracle Agent live on Muse Spark**
Wire the Oracle Agent (Omni-Agentic Core) to Muse Spark via the Meta Model API adapter in `packages/ai-core` (adapter already stubbed for this). Ring-scoped retrieval over the demo cosmos data, with cited answers — every answer names the ring and source nodes it used.
*Status: the ring-scoped answering layer, the Meta Model API research (documented model ids, Muse Image envelope, SAM 3.1 design-only), the mocked contract tests, and the zero-code-change env activation are BUILT; only the live key wiring remains (key + credits pending).* 

**Day 3–4 — Guardian enforcement + Legacy Mirror**
- Consent Guardian enforcement demo: an out-of-ring question produces a visible, in-character refusal — the consent model made tangible for judges. *Status: BUILT (Day 1) — the Oracle page ships a "Try crossing a ring →" chip that triggers it.*
- Legacy Mirror Q&A in Eternal Garden mode (Digital Mirror System), with provenance labels on every output ("official personal AI" badge pattern). *Status: BUILT (Oct 26, ahead of schedule) — synthetic 32-memory archive, era-clustered garden view, per-claim citations, abstention on unsupported questions, Family-ring default with Guardian refusal (`packages/ai-core/src/legacy/`, `/garden`).*

**Day 5–6 — Polish, performance, video**
Performance pass on the 5,000-node view (instancing, quality modes, reduced-motion path). Demo polish. Record the demo video from the script in Section 6.
*Status (Oct 26): automatic quality-degrade is BUILT (frame-time state machine, hysteresis, reduced-motion respected — cosmos-engine `quality.ts`, 13 tests); the Guided Demo path (`/demo`) walking the Section 6 beats is BUILT; a silent 36 s DRAFT video was produced by the scripted capture pipeline (`docs/demo-video/`). Remaining: the final two-minute video with founder voiceover, recorded from the same beats.*

**Day 7–8 — Buffer and submission**
Buffer for API / review surprises. Assemble the submission package (repo link, video, write-up). **Final submit well before the November 4, 9:00 PM ET deadline** — do not submit at the deadline.

---

## 6. Two-Minute Demo Script — Outline

**0:00–0:15 — Hook**
"Your Facebook graph, as a living cosmos you actually own." Cold open on the cosmos at 2,000 nodes, slow orbit.

**0:15–0:40 — Fly-through**
Cosmos fly-through: nebula, starfield, bloom. Scale up to the 5,000-node view; live FPS readout visible. Click a node — fly-to-node, inspection panel opens.

**0:40–1:05 — The ring switch**
Switch Public → Family. The universe re-lights: ring shells change, nodes outside the ring dim out. Narrate: *what changed is what the AI may see.* Consent is visual, not a settings page.

**1:05–1:35 — Ask the Oracle**
Ask the Oracle a question. Ring-scoped answer with citations, powered by Muse Spark, grounded only in in-ring demo data. Provenance label visible on the answer.

**1:35–1:50 — Guardian refusal beat**
Ask a question that reaches outside the current ring. The Guardian refuses — visibly, with the ring boundary named. Cut on the refusal; it is the product.

**1:50–2:00 — Close on the Trust Beacon**
Zoom to the Trust Beacon: particle flow showing value moving **61.8% to the member / family trust by design** (PhiSplit: Trust 61.8033988% / Members 23.6067976% / Operations 14.5898036%).

**Final line:**
> "Built on Facebook. Powered by Meta's own AI stack. Owned by you."

---

## 7. Submission Checklist & Verified Official Rules

- [x] **Application submitted** — by David Charles Bourassa on **October 23, 2026**, ahead of the October 25, 11:59 PM ET deadline (rolling review, 20,000-participant cap)
- [ ] Track selected: **Startup** — ONE track only (see verified rules below); Indie is a pre-submission fallback decision, not a parallel entry
- [ ] Theme selected: **"Build for Your World"** (primary); "Push the Frontier" (secondary)
- [ ] Repo audit-clean: no secrets, no EIN, correct attribution — David Charles Bourassa · Quantum Concepts LLC throughout
- [ ] Meta Model API key + $150 participant credits claimed and wired (env only — zero code change)
- [x] Oracle + Guardian + Legacy Mirror demos working end-to-end (Section 5) — on the labeled offline path
- [x] Draft demo video produced from the Section 6 beats (`docs/demo-video/draft-demo.mp4`, silent DRAFT)
- [ ] Final 2-minute demo video with founder voiceover recorded and uploaded; link added to `SUBMISSION.md`
- [ ] Portal write-up pasted from `SUBMISSION.md`
- [ ] Project submitted via the Cerebral Valley portal **before November 4, 2026, 9:00 PM ET** — target well ahead of the deadline

### Verified official criteria & constraints

*Checked against Cerebral Valley's Official Rules for this event (verified Oct 26, 2026). This section replaces any earlier "confirm the rules yourself" caveat — these are the rules the entry is built against.*

- **Judging criteria (official weights):** **Impact 30%** (real-world potential, who benefits, could become something people use, theme fit) · **Use of Meta AI Tooling 25%** (creative use, beyond basic integration, unexpected capabilities surfaced) · **Demo 25%** (working, impressive demo that holds up live; demo-video quality) · **Technical Depth & Execution 20%** (sound, refined engineering, real craft).
- **Submission route & deadline:** Cerebral Valley portal — https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit — by **November 4, 2026, 9:00 PM ET**.
- **Judging & finals:** judging runs **November 4–8, 2026**; winners are announced **November 9, 2026** at the closing ceremony.
- **One track only:** a project may be entered in a single track. Omega enters **Startup**.
- **Original work:** the submission must be the participant's / organization's own original work, solely owned by them. Open-source components are permitted where their licenses are followed and built upon — this repo's OSS stack is used under its licenses, notices intact.
- **⚠️ Licence warning — everything submitted is effectively public forever.** The rules grant the organizers a **perpetual, irrevocable, royalty-free licence** over all submitted material and impose **no confidentiality**. Submit OUTPUT only: this monorepo, `SUBMISSION.md`, and the demo video. Internal strategy, research verdicts, and planning records live outside this repository and are never part of the submission.
- **Named tooling:** Muse Spark series, Muse Wonder, Muse Image, SAM 3 (event page: SAM 3.1), Muse Code, and open-weights models, via the Meta Model API.

---

## Attribution & Honesty Note

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.**

Honesty note: Scaffold components in this repo are labeled as scaffold (the `ui` package; MemberPool and TreasuryRegistry contracts; `apps/docs`, `apps/worker`). Phase 3 (Oct 27 2026) moved `mcp-gateway` and `legacy-engine` to WORKING at honestly bounded scope (gateway: JSON-RPC core + stdio, no HTTP/auth, adapters over local/fixture/sandbox data — GitHub and Notion working over synthetic fixtures, Stripe sandbox only, four infra adapters still stubs; legacy-engine: versioned-vault + scorer core, no persistence layer) and added `packages/meta-export`; the imported-archive demo runs on a synthetic, fictional export — no real member export has been processed yet. The PhiSplitRouter, ReserveVault, and MerkleAnchor contracts are **unaudited and testnet-grade only**. There is **no live Meta integration yet** — the `packages/ai-core` Meta Model API adapter is ready with an offline stub and is untested against the live API; it activates when the API key lands. (Oct 26 docs check: the adapter's base URL matches Meta's own public example; its default model is the newest documented Spark id, `muse-spark-1.3`, with `muse-spark-1.1` — the id in Meta's example — kept as the pinned fallback; graded findings in `docs/META_API_NOTES.md`.) The Vault (`packages/vault-core` + the Vault page) performs real AES-GCM/AES-KW cryptography in the browser, but storage is local-browser only — no server persistence, and demo ring keys are stored in the browser, which the UI labels as demo-only practice. Demo data in `apps/web` is synthetic and labeled as such in-product: "Synthetic demo constellation — no real member data." The Multiverse view is labeled SPECULATIVE in-product: bubble-universe concepts are unproven.
