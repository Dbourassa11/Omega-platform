# Universe Model — Universe and Multiverse Visualization Modes

**Date:** 2026-10-26
**Creator:** David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico
**Status:** Research specification. Nothing in this document is implemented.
It specifies two new visualization modes for `@omega/cosmos-engine` —
**Universe** (one observable universe, structured as a cosmic web) and
**Multiverse** (bubble universes and branching timelines) — and records
the evidence each visual choice rests on, or labels it speculative where
no such evidence exists.

---

## 1. Purpose and scope

The existing engine renders a social cosmos: members, memories, creations,
companies, legacy mirrors, and connectors on consent-ring shells around a
central Trust Beacon (`packages/cosmos-engine/README.md`). The new modes
reuse that engine's rendering machinery but replace its subject. Instead
of a person's network, they render astronomical structure:

- **Universe mode** — a statistical model of large-scale structure: galaxies
  concentrated along filaments, galaxy clusters at filament intersections,
  and large regions that are genuinely empty.
- **Multiverse mode** — the same universe model shown as one bubble among
  several, plus a branching-timeline view. Everything in this mode is
  **SPECULATIVE** (see §8 and §9). The mode is a visualization of ideas
  from the literature, not a depiction of observed objects.

This document does not change any existing behaviour. The consent-ring
cosmos, its data model (`CosmosNode` / `CosmosEdge`), and its colours
(`NODE_KIND_COLORS`) are untouched by this specification.

### 1.1 How to read the grounding labels

Every visual choice in §5 carries one of two labels:

- **GROUNDED** — the choice follows a structure, correlation, or scale
  stated in a source listed in §10.
- **SPECULATIVE** — the choice visualizes a hypothesis that is not
  established, or is a purely artistic encoding. Speculative elements
  must carry that label in the UI as well as in this document (see §8.3).

---

## 2. The existing engine, as it actually is

The specification builds on the real surface of
`packages/cosmos-engine` (read from `README.md`, `src/index.ts`,
`src/types.ts`, `src/renderer.ts`, and `src/layout.ts` at the time of
writing):

| Engine fact | Source in repo |
| --- | --- |
| Entry point is `createCosmosEngine(container, options)`; options are `reducedMotion?: boolean`, `quality?: "auto" \| "high" \| "low"`, `bloom?: boolean` | `src/types.ts`, `src/index.ts` |
| Engine interface is `setData`, `setActiveRing`, `onNodeSelect`, `onNodeHover`, `focusNode`, `getStats`, `dispose` | `src/types.ts` (`CosmosEngine`) |
| All nodes render as a single `THREE.InstancedMesh` (icosahedron geometry, detail 1) — one draw call for all nodes, regardless of count | `README.md`, `src/renderer.ts` (`buildNodes`) |
| Per-instance data travels in `InstancedBufferAttribute`s on the geometry: `aColor` (vec3), `aData` (vec3: pulse phase, pulse speed, brightness; `DynamicDrawUsage`), `aHighlight` (float; `DynamicDrawUsage`) | `src/renderer.ts` (`buildNodes`) |
| Node shading is a custom `ShaderMaterial` (`NODE_VERTEX` / `NODE_FRAGMENT` from `src/shaders.ts`) with pulse and fresnel terms; only the instance matrices are rewritten per frame | `README.md`, `src/renderer.ts` |
| Edges are one `THREE.LineSegments`; beacon particles are one `THREE.Points` | `README.md` |
| Particle flow already exists: up to 240 source nodes × 3 particles stream along quadratic bezier arcs in the particle vertex shader (`PARTICLE_VERTEX`, with `aCtrl`, `aOffset`, `aColor` attributes) toward the Trust Beacon | `src/renderer.ts` (`buildParticles`, `MAX_PARTICLE_SOURCES`, `PARTICLES_PER_SOURCE`) |
| Post-processing, when enabled, is `EffectComposer` → `RenderPass` → `UnrealBloomPass` (strength 1.1, radius 0.6, threshold 0.15) → film-grain `ShaderPass` → `OutputPass`; tone mapping is `ACESFilmicToneMapping` | `src/renderer.ts` |
| Quality scaling already exists: pixel ratio is capped at 1 for `low` (which also disables post-processing), `min(devicePixelRatio, 1.75)` for `auto`, `min(devicePixelRatio, 2)` for `high` | `README.md`, `src/renderer.ts` |
| Layout is deterministic: a seeded PRNG (`mulberry32` in `src/prng.ts`); `setData` always lays out with seed `1337` | `README.md`, `src/renderer.ts` (`LAYOUT_SEED`) |
| Current layout places nodes on inclined orbital shells (`layoutCosmos`, `positionAt`, `RING_SHELL_RADIUS`: family 26, friends 44, work 62, public 82). This is a social layout; the Universe modes do **not** reuse it (see §7.2) | `src/layout.ts` |
| `focusNode(id)` performs a ~1.2 s smoothstep camera tween; user input cancels it. `OrbitControls` damping is on; auto-rotate (0.4) stops permanently at the first drag | `README.md`, `src/renderer.ts` |
| The demo's node-count control exercises 600 / 2,000 / 5,000 nodes. `getStats()` returns `{ fps, nodeCount }`, where `fps` is a live exponential moving average measured in the browser | `README.md`, `src/types.ts` |
| `RealmKind` already names other realms (`living-cosmos`, `eternal-garden`, `creator-studio`, `trust-ledger`, `connector-galaxy`, `holographic-branch`). Universe and Multiverse would be new realm kinds, not renames of these | `src/types.ts` |

Two consequences follow:

1. The 5,000-node case is already an exercised configuration of the
   current engine, not a new target invented for this spec. This document
   makes **no performance claim** about the new modes (see §9).
2. The new modes need a new layout module and new node kinds, but they do
   not need a new renderer architecture. §7 specifies the techniques in
   terms of the mechanisms above.

---

## 3. Large-scale structure: the cosmic web

### 3.1 What the structure is

On scales of tens to hundreds of megaparsecs, matter is not distributed
uniformly. Galaxies, gas, and dark matter form a web:

- **Filaments** — elongated, thread-like concentrations of matter.
  The European Space Agency's description of an Illustris cosmic-web
  image puts it plainly: the web is "the vast network of threads and
  filaments that extends throughout the Universe," and "stars, galaxies,
  and galaxy clusters spring to life in the densest knots of this web,
  and remain connected by vast threads that stretch out for many millions
  of light-years."
- **Walls (sheets)** — flattened, sheet-like concentrations, the second
  component of the web alongside filaments.
- **Voids** — the large, underdense regions enclosed by filaments and
  walls. Voids occupy most of the volume while containing little of the
  mass. NASA's summary of the same picture: groups of galaxies are bound
  into clusters, clusters into superclusters, and "the superclusters are
  arranged in immense sheets stretching across the universe, interspersed
  with dark voids and lending the whole a kind of spiderweb structure."
- **Nodes / clusters** — where filaments intersect, matter is densest.
  Those intersections host galaxy clusters: the Millennium Simulation
  caption published by the Max Planck Institute describes a web "of
  filaments which surround large voids and cross in massive halos of
  matter," where "the largest of these halos are rich clusters of
  galaxies, containing more than one thousand galaxies."

### 3.2 The simulation picture

This web is not an artistic convention; it is what both observations and
simulations produce when gravity acts on near-uniform initial conditions:

- The **Millennium Simulation** (Millennium Run) traced more than
  10 billion particles in a cubic region 2 billion light-years on a side.
  Its published description states that on very large scales the universe
  appears nearly homogeneous, while enlargements show the complex cosmic
  web "up to scales of order ~100 Mpc (about 300 million light-years),"
  made of filaments surrounding voids and crossing in massive haloes.
- The **Illustris Project** is a hydrodynamical counterpart: Illustris-1
  covers a volume of (106.5 Mpc)³, follows more than 18 billion resolution
  elements, and at redshift 0 contains about 40,000 well-resolved galaxies
  "covering a diverse range of morphologies and colours including
  early-type, late-type and irregular galaxies." Its introduction
  describes dark matter "arranged in an intricate cosmic web … with
  tenuous filaments surrounding large voids and connecting
  gravitationally bound haloes in which galaxies form."

Design consequence: a Universe-mode layout that scatters galaxies
uniformly, or on spherical shells, contradicts the structure it claims to
show. Galaxy positions must be drawn from a filamentary density field
(§7.2), with voids produced by the same field — not decorated afterwards.

---

## 4. Galaxy morphology and stellar populations

### 4.1 The Hubble sequence

Galaxy classification in this spec follows the Hubble sequence (1926):
ellipticals (E0–E7, by apparent flattening), lenticulars (S0) at the
junction, spirals (Sa–Sc, and barred SBa–SBc, by arm winding and bulge
prominence), and irregulars, which fall outside the tuning-fork diagram.
The sequence is a morphological classification, not an evolutionary
track: galaxies do not travel along it from one end to the other.

### 4.2 Why colour follows type

Colour in the new modes encodes dominant stellar population, and the
correlation is physical:

- **Spirals read blue-white.** A spiral's arms and disk are blue because
  they contain young, hot, massive stars; its centre is redder, like an
  elliptical, because the bulge population is older. University of Oregon
  lecture notes state this directly: "Both the arms and the disk of a
  spiral system are blue in color, whereas its central areas are red like
  an elliptical galaxy," and "the center of a spiral is made of old stars,
  with young stars in the arms formed recently out of gas and dust."
  Caltech's Ay 1 notes add that spiral arms are prominent "due either to
  bright O and B stars (evidence for recent star formation), or to dust
  lanes," and that properties along the sequence run from red colours and
  no star formation at the elliptical end to blue colours and active star
  formation at the spiral end.
- **Ellipticals read warm / red-gold.** Ellipticals are smooth, contain
  old stellar populations, are largely devoid of gas and dust, and show
  little or no current star formation. The same Oregon notes: ellipticals
  are "somewhat redder than the Sun … devoid of gas or dust and contain
  just old stars," and an old stellar population is red "since all the
  hot stars have died off … leaving the faint cool stars." Caltech's
  notes likewise describe ellipticals as having old, metal-rich stellar
  populations, little or no rotation support, and a preference for dense
  (cluster) environments.
- **Irregulars read blue / cyan.** Irregulars have no regular symmetry or
  obvious nucleus and are "generally bluer in color than are the arms and
  disks of spiral galaxies," with bright regions of new stars embedded in
  ionized gas (Oregon notes). They are typically lower-mass systems with
  erratic, ongoing star formation.

The three display colours in §5 are stylized representatives of these
population colours, chosen for legibility against a dark background and
for separation under bloom. They are not measured galaxy colours, and
the UI must not present them as photometry.

---

## 5. Visual mapping table

Every visual choice in the new modes, and what it rests on. A choice with
no row in this table does not ship.

| # | Visual choice | Specification | Grounding |
| --- | --- | --- | --- |
| 1 | Filament concentration | Galaxy instances are sampled from a filamentary density field: density is highest along filament spines, falls off away from them, and most instances lie in or near filaments and walls rather than in open volume | **GROUNDED** — cosmic web (§3.1): filaments/walls are where matter concentrates (ESA Illustris description; Millennium description; NASA spiderweb summary) |
| 2 | True voids | Regions enclosed by filaments are left genuinely empty of galaxy instances at Universe scale. No background "filler" galaxies are scattered into voids to make the scene look busy. A void may be selectable as a region, but it contains no nodes to select | **GROUNDED** — voids are underdense volume enclosed by the web (§3.1). Deliberately not absolute at smaller scales: real voids contain a small number of mostly dwarf galaxies, so a future zoom level may show sparse dwarfs — labelled as such if added. At the default web scale, empty is the honest rendering |
| 3 | Cluster placement | The largest, brightest galaxy groupings sit at filament intersections (nodes of the skeleton, §7.2), not at random high-density points. Cluster instances are denser and include a higher elliptical fraction than filament instances | **GROUNDED** — clusters form where filaments cross, in the most massive haloes, with >1,000 galaxies in the richest Millennium haloes (§3.1); ellipticals preferentially occupy dense environments (§4.2) |
| 4 | Spiral colour `#bcd8ff` (blue-white) | All spiral-class instances use this base colour in `aColor` | **GROUNDED** in population terms (§4.2): young, hot stars dominate spiral arms/disks. The exact hex is a display choice, not a measurement |
| 5 | Elliptical colour `#ffd9a3` (warm gold) | All elliptical-class instances use this base colour | **GROUNDED** in population terms (§4.2): old stellar populations, red-gold integrated light, little star formation. Exact hex is a display choice |
| 6 | Irregular colour `#7fe9ff` (cyan) | All irregular-class instances use this base colour | **GROUNDED** in population terms (§4.2): irregulars are bluer than spiral disks, gas-rich, star-forming, typically low mass. Cyan (rather than a second blue-white) is a legibility choice so the class stays distinguishable from spirals under bloom |
| 7 | Size variance | Instance scale varies by class and by a seeded per-galaxy factor, spanning a wide range: many small instances, few large ones. Ellipticals include the largest instances; irregulars are drawn from the small end | **GROUNDED** as a range, **stylized** as a distribution — galaxies span orders of magnitude in mass and size (Milky Way ~100,000 ly across; Andromeda ~220,000 ly; IC 1101 up to ~4 million ly per NASA; see the Scales table in §6). No specific size function is claimed; the distribution used in code must be named in code as a modelling choice |
| 8 | Scale hierarchy | Navigation is organized as five named levels: **Star System → Galaxy → Cluster → Filament → Cosmic Web**. Moving between levels is a discrete, labelled transition, not a continuous claim of true scale (see §6, note on scale compression) | **GROUNDED** as an ordering of real structures (§3; Scales, §6). The compression between levels is a navigation device and is labelled as such in the UI |
| 9 | Filament rendering | Filaments are implied first by galaxy concentration (row 1). Any additional filament geometry (lines / faint volume) is drawn faint, additive, and clearly subordinate to the galaxies it connects; it represents a density skeleton, not an observed glowing thread | **GROUNDED** in structure, **stylized** in rendering — real filaments are mostly dark matter and diffuse gas, "invisible to the eye" (ESA). The UI copy must say the thread is a guide to density, not something a telescope photographs in visible light |
| 10 | Bubble universes with distinct palettes | In Multiverse mode, each bubble universe re-runs the Universe layout with its own palette (hue-shifted class colours) and its own seed, enclosed in a translucent sphere. Bubbles do not touch, exchange particles, or share edges | **SPECULATIVE** — eternal-inflation bubble universes are a hypothesis, not an observation (§8.1). Distinct palettes are an artistic encoding only; they do **not** assert that another bubble's physical laws or colours are known. Bubbles are drawn non-interacting because the hypothesis itself describes them as causally disconnected |
| 11 | Branching timelines | In Multiverse mode, a timeline view draws a trunk that forks into non-rejoining branches; each branch carries a copy of the scene state at the fork and then diverges. Branches never merge and never exchange particles or edges | **SPECULATIVE** — the branching picture is the many-worlds interpretation of quantum mechanics (Everett, 1957), an interpretation, not an established result (§8.2). Non-merge / non-interaction follows the interpretation's own description (APS: once formed, branches "cannot interact with each other") |
| 12 | Central object in Universe mode | There is no Trust Beacon at the centre of Universe mode. The centre of the view is a cluster node or an empty reference origin, labelled as a viewpoint, not as a physical centre of the universe | **GROUNDED** — the observable universe is observer-centred by definition (its radius is the distance light has had time to travel to the observer); no physical centre is claimed. Keeping the Beacon here would assert a centre that does not exist in the model |

---

## 6. Scales

Real numbers, with units. Conversions: 1 parsec (pc) ≈ 3.26 light-years
(ly); 1 megaparsec (Mpc) = 1,000,000 pc ≈ 3.26 million ly;
1 gigaparsec (Gpc) ≈ 3.26 billion ly.

| Level / object | Characteristic size | Notes |
| --- | --- | --- |
| Star system (planetary system) | Order of light-hours for the planetary region; ~1–2 ly to the outer Oort cloud in the Solar System's case | Definition-dependent. NASA notes light takes about 1.87 years to reach the farthest reaches of the Sun's Oort cloud. This level exists in the hierarchy for navigation; no star-system geometry is specified at web scale |
| Galaxy — Milky Way | ~100,000 ly across (~30 kpc); ~100–400 billion stars | NASA. A mid-sized spiral; Andromeda is ~220,000 ly across |
| Galaxy — large end | Up to ~4 million ly across (IC 1101, as cited by NASA) | Illustrates why row 7 of §5 needs a wide size range |
| Galaxy group / cluster | Order of 1 to a few Mpc across; rich clusters contain hundreds to >1,000 galaxies | Millennium's largest haloes are "rich clusters of galaxies, containing more than one thousand galaxies" |
| Filament | Tens of Mpc long, up to order ~100 Mpc (~300 million ly) for the largest structures in the Millennium picture | Millennium description: web structure "up to scales of order ~100 Mpc." Individual filament lengths vary widely; this is an order of magnitude, not a fixed length |
| Wall / sheet | Comparable extent to filaments (tens of Mpc), small thickness relative to extent | Superclusters are "arranged in immense sheets" (NASA) |
| Void | Tens of Mpc across; the largest known voids reach hundreds of Mpc in diameter in survey descriptions | Voids dominate volume and are underdense, not literally matter-free at all scales (see §5, row 2) |
| Simulation volumes (reference) | Millennium Run: cube 2 billion ly on a side, >10 billion particles. Illustris-1: (106.5 Mpc)³, ~40,000 well-resolved galaxies at z = 0 | These are the scales of the published models this spec follows — both far smaller than the observable universe, which is why Universe mode is a representative volume, not the whole observable universe |
| Observable universe | Diameter ~93 billion ly (93 Gly; 28.5 Gpc); radius ~46.5 Gly; age ~13.8 billion years | Comoving (present-day) distances. The diameter exceeds twice the age × c because space expanded while the light travelled. "Observable" is a light-travel limit, not a technological one |

**Note on scale compression (read before implementing zoom).** True
linear scale across this table is not renderable as one scene: the ratio
between a galaxy (~100,000 ly) and the observable universe (~93 billion
ly) is roughly a million to one, and a star system is smaller again by
orders of magnitude. The five hierarchy levels in §5 row 8 are therefore
**separate scenes with labelled transitions**, each internally
consistent in relative placement, between which scale is compressed.
UI copy at each transition must name the new level and its characteristic
scale from the table above. Presenting the levels as one continuous,
to-scale space would be false, and this spec does not authorize it.

---

## 7. Rendering specification (Three.js, on the existing engine)

Target configuration for design purposes: **5,000+ galaxy instances** in
Universe mode — the top of the range the current demo already exercises
(600 / 2,000 / 5,000). All techniques below are specified against the
mechanisms in §2. No frame-rate figure is promised for any device (§9).

### 7.1 One instanced mesh per galaxy class

- Render galaxies exactly as the current engine renders nodes: a single
  `THREE.InstancedMesh` per class (three meshes total — spiral,
  elliptical, irregular), each with one geometry and one custom
  `ShaderMaterial` in the pattern of `NODE_VERTEX` / `NODE_FRAGMENT`.
  Instancing renders many copies of the same geometry and material in a
  single draw call; per-instance variation comes from attributes, not
  from per-object materials.
- Carry per-instance data in `InstancedBufferAttribute`s, extending the
  existing set:
  - `aColor` (vec3) — the class colour from §5, optionally varied slightly
    per instance by a seeded factor (brightness variation only; hue stays
    with the class).
  - `aData` (vec3) — reuse the existing semantics where they fit: pulse
    phase, pulse speed, brightness. Galaxy pulsing, if kept, must be
    subtle and must be disabled under `reducedMotion`, as now.
  - `aHighlight` (float) — reuse as-is for hover/selection.
  - New, if needed: `aClass` data such as a seeded size/age factor should
    be folded into `aData`-style attributes rather than new uniforms;
    uniforms are shared by all instances and cannot vary per galaxy.
- Instance matrices: Universe-mode galaxies are **static** (they do not
  orbit). Set matrices once at `setData` time. Unlike the current cosmos,
  whose matrices are rewritten every frame for orbital motion, a static
  web should not pay a per-frame matrix rewrite; mark
  `instanceMatrix` static unless a mode animation (e.g. slow rotation of
  the whole web group) is active — and implement that as a group transform,
  not per-instance updates.
- Picking: reuse the existing raycast-against-`InstancedMesh` path
  (`instanceId` → node). Selection of a galaxy shows its class, its
  hierarchy level, and whether its position is model-generated (it always
  is — see §9).

### 7.2 Layout: a seeded filament skeleton (new module)

A new pure-logic layout module beside `src/layout.ts` (same pattern:
no WebGL imports, seeded, unit-testable). It does not reuse
`layoutCosmos` / `RING_SHELL_RADIUS`.

1. **Seed everything.** One `mulberry32` stream from a single seed, as
   the existing layout does, so the same seed always produces the same
   universe on every visit. Changing the seed is how Multiverse mode
   gives each bubble its own universe.
2. **Build a skeleton.** Generate a set of node points (future cluster
   sites) in the volume; connect near neighbours into filament segments
   (polylines). Add a small number of sheet-like connections if walls are
   rendered. The algorithm (e.g. a minimum-spanning / neighbour-graph
   construction) is an implementation choice, but it must be named in
   code and its output described as a **model skeleton**, not survey data.
3. **Sample galaxies from the skeleton.** For each galaxy: pick a segment
   weighted by segment length, place the galaxy near the segment with a
   seeded radial falloff, and place a defined fraction in cluster
   groupings at skeleton nodes. Control the filament/field/cluster mix
   with explicit named parameters. Sampling from the skeleton — and
   nowhere else — is what makes the voids true (§5, row 2): volume away
   from the skeleton receives no samples.
4. **Assign classes by environment.** Cluster samples draw a higher
   elliptical fraction; filament samples are spiral-majority; irregulars
   are weighted to low-density filament ends and the field fraction, and
   drawn smaller. The exact fractions are modelling parameters — name
   them, seed them, and do not present them as measured cosmic fractions.
5. **Assign sizes.** Seeded per-galaxy scale from a wide distribution
   (§5, row 7), with class-dependent ranges.

### 7.3 Filament and cluster geometry

- Filament guide geometry (§5, row 9): one `THREE.LineSegments` (the
  pattern the engine already uses for edges) or a single `THREE.Points`
  density trace along segments. One draw, additive, low opacity.
- Clusters need no separate geometry: a cluster **is** a dense grouping
  of instances at a skeleton node, plus optionally one brighter central
  elliptical instance. Do not add a halo mesh that implies a hard cluster
  boundary; clusters do not have one.

### 7.4 GPU particle flow

Reuse the engine's existing particle system pattern (`PARTICLE_VERTEX` /
`PARTICLE_FRAGMENT`, `aCtrl` / `aOffset` / `aColor`, motion computed in
the vertex shader from `uTime`):

- In Universe mode, particles flow **along filaments**: each particle's
  start, control, and end points lie on one filament segment, so flow
  reads as movement along the web rather than toward a centre. There is
  no Beacon in this mode (§5, row 12), so the current "flow into the
  Beacon" arrangement does not transfer.
- Particle positions must be computed in the shader from `uTime` (as the
  beacon flow already does with its bezier evaluation), so the CPU does
  not rewrite particle positions per frame for a static web.
- Flow is decorative unless it encodes a named quantity. If a flow speed
  or direction is ever presented as physical (e.g. infall toward a
  cluster), that encoding must be added to §5 first. Unlabelled flow must
  be described in UI copy as motion for legibility, not as measured
  velocities.
- `reducedMotion` freezes flow time, as it does now.

### 7.5 Post-processing: bloom, with restraint

- Reuse the existing composer chain: `RenderPass` → `UnrealBloomPass` →
  grain `ShaderPass` → `OutputPass`, with the current defaults
  (strength 1.1, radius 0.6, threshold 0.15) as the starting point, tuned
  per mode.
- Bloom is not free of meaning here: with three class colours close in
  luminance, aggressive bloom merges spirals (`#bcd8ff`) and irregulars
  (`#7fe9ff`) into one blue-white glow. Tune threshold/strength so class
  colours remain separable at the default camera distance, and verify
  that separability in the browser — it is a correctness criterion for
  the colour encoding, not only an aesthetic one.
- `quality: "low"` and `bloom: false` must render the same scene without
  the composer, as they do now. Class identity must survive without
  bloom (it is carried by `aColor`, not by the glow).

### 7.6 Cinematic camera paths

- Extend the existing focus mechanism rather than replacing it:
  `focusNode` already performs a ~1.2 s smoothstep tween and cancels on
  user input. Hierarchy transitions (§5, row 8; §6 note) are sequences of
  such moves.
- For multi-stop paths (e.g. Cosmic Web → Filament → Cluster → Galaxy),
  interpolate camera position and target along a spline
  (`THREE.CatmullRomCurve3`, part of Three.js core) with an eased
  parameter, one labelled level per stop. Keep the existing rules:
  user input cancels the path immediately; auto-rotate does not resume
  after the user's first drag.
- Every path stop shows the level name and characteristic scale (§6).
  A path must never imply a continuous to-scale flight through the
  levels it compresses.
- `reducedMotion`: no paths. Transitions cut directly to the composed
  frame, as the current engine freezes at a composed start frame.

### 7.7 Quality scaling

Build on the existing `quality` option instead of inventing a second
system:

| Tier | Specified behaviour |
| --- | --- |
| `high` | Full instance count as supplied (5,000+ in the design case); pixel ratio `min(dpr, 2)`; bloom on (unless `bloom: false`); full starfield and particle counts |
| `auto` | Pixel ratio `min(dpr, 1.75)`; bloom on; instance, starfield, and particle counts as supplied. (Automatic step-down based on measured FPS is **not** currently implemented in the engine and is not claimed here; if added, it must drive off `getStats().fps`, the live EMA, and be described as adaptive, not as a guarantee.) |
| `low` | Pixel ratio 1; no post-processing; reduced starfield and particle counts. Instance count may be reduced only by sampling the same seeded layout deterministically (e.g. every Nth galaxy), never by re-rolling positions — a low-quality view must be the same universe, thinned |

Geometry detail is part of quality scaling: the current node geometry is
`IcosahedronGeometry(1, 1)`. Lower tiers may drop to detail 0 for galaxy
instances; class identity is colour-carried, so this loses silhouette,
not information.

### 7.8 Background

Reuse the existing nebula (fbm shader, `NEBULA_FRAGMENT`) and starfield
(2,500 points in the current engine) as backdrop only. In Universe mode
the backdrop must stay visually behind and dimmer than the web: the
starfield is a distant-star backdrop, not part of the galaxy data, and
must not be countable as galaxies. If that distinction cannot be kept
clear at the default view, reduce starfield brightness in this mode
rather than explaining it afterwards.

---

## 8. Multiverse concepts — SPECULATIVE throughout

Nothing in this section is observed. Both concepts below are live topics
of theoretical discussion and active disagreement. The visualizations
are permitted by this spec **only** with the labelling in §8.3.

### 8.1 Bubble universes (eternal inflation)

In eternal-inflation models, inflation does not end everywhere at once:
regions where it ends form "bubbles" of ordinary expanding space, while
inflation continues elsewhere and keeps producing further bubbles —
"a multiverse in which space is broken up into bubbles or patches whose
properties differ from patch to patch." Steinhardt produced the first
example (1983), Vilenkin showed the mechanism is generic to the models
considered, and Linde's chaotic-inflation work developed the picture
further.

The disagreement is part of the record and must not be edited out:
Steinhardt later argued the multiverse makes inflation untestable and
therefore a breakdown of the theory; a 2014 analysis concluded the
resulting multiverse is "still very much an open question that will
require much deeper investigation." No bubble universe has been
observed. There is no evidence available to this project for the number,
size, spacing, colour, or physical laws of any other bubble.

**Visualization rule:** bubbles are rendered as separate Universe-mode
volumes with distinct palettes (§5, row 10) solely so a viewer can tell
them apart. Palette difference encodes *separateness*, nothing else.

### 8.2 Branching timelines (many-worlds)

The many-worlds interpretation (Everett, 1957; originally his "relative
state" formulation) holds that the wave function does not collapse:
it "continues to evolve, forever splitting into other wave functions,
each branch becoming its own separate universe." The American Physical
Society's history notes the branches, once formed, "cannot interact with
each other, continuing to evolve independently," that the idea "remains
controversial among theoretical physicists," and that it was met with
considerable skepticism from the start. It is an **interpretation** of
quantum mechanics — a way of reading the same equations — not an
experimental result, and it has not gained universal acceptance.

**Visualization rule:** the branching view (§5, row 11) is a diagram of
the interpretation. Branches fork and never rejoin or interact, because
that is what the interpretation says; the diagram is not a map of
places, and no branch is labelled with a real event outcome as if the
other outcome had been observed elsewhere.

### 8.3 Labelling requirement (hard rule)

- Every Multiverse-mode view carries a persistent, readable
  **"Speculative — not observed"** label in the UI, not only in a
  one-time intro or tooltip.
- Copy in the mode must name the source idea ("eternal inflation",
  "many-worlds interpretation (Everett, 1957)") next to the visuals it
  generated.
- No Multiverse element may be described, in UI copy, docs, or marketing
  text, as discovered, detected, mapped, or visited.

---

## 9. What we deliberately do NOT claim

- **The multiverse is unproven.** Eternal inflation and many-worlds are
  hypotheses / interpretations (§8). This project visualizes them; it
  does not endorse them as fact, and its UI must not either.
- **Galaxy positions are a statistical model, not a catalog.** Every
  galaxy in Universe mode is generated by the seeded layout in §7.2 to
  reproduce the *statistics* of large-scale structure (concentrated on
  filaments, clustered at nodes, absent from voids). No instance is a
  real galaxy at its real position; no instance may be labelled with a
  real galaxy's name or coordinates unless a future, separately specified
  catalog mode supplies them.
- **Colours are encodings, not photometry.** Class colours (§5) follow
  real stellar-population correlations but are chosen display values.
- **Scales are compressed between hierarchy levels.** §6 gives real
  characteristic sizes; the navigation between levels is not to scale
  and must not be presented as such.
- **No performance figures.** This spec states no frame rate, load time,
  or maximum node count for the new modes on any device. The only FPS
  number this project recognizes is the live `getStats().fps` measured
  in the browser on the device in question, exactly as the current
  engine's README already states.
- **No live AI integration.** The Meta Model API adapter in
  `packages/ai-core` is untested against the live API and no API key
  exists for this project. Appendix A records what public documentation
  does and does not establish. Nothing in the Universe or Multiverse
  modes depends on, or may be described as powered by, a live Meta
  Model API connection.
- **No centre, no edge, no glow-in-the-sky filaments.** The observable
  universe in this model has an observer-relative horizon, not a
  physical centre or boundary wall; filaments are density structure,
  not luminous threads (§5, rows 9 and 12).

---

## Appendix A. Meta Model API — public documentation status

Researched 2026-10-26 from the pages listed in §10. This appendix records
what public documentation establishes about the assumptions hard-coded in
`packages/ai-core/src/meta-model-client.ts`:

- `DEFAULT_META_MODEL_BASE_URL = "https://api.meta.ai/v1"`
- `DEFAULT_META_MODEL_MODEL = "muse-spark"`
- Request shape: `POST {baseUrl}/chat/completions`, OpenAI-style body
  (`model`, `messages`, optional `temperature`, `max_tokens`), header
  `Authorization: Bearer <key>`; response parsed as
  `choices[0].message.content`.
- The adapter's own header comment already states it is "UNTESTED
  against the live API — there is no API key yet," with the offline stub
  as the default backend. This appendix does not change that status.

### A.1 Base URL — CONFIRMED

`https://api.meta.ai/v1` is the base URL shown in Meta's own developer
example (Meta developer blog, "Meta Model API"): an OpenAI client is
constructed with `base_url="https://api.meta.ai/v1"` and an API key read
from the environment variable `MODEL_API_KEY`. Secondary sources that
quote Meta's documentation at dev.meta.ai agree: the API "lives at
`https://api.meta.ai/v1`," and LiteLLM's provider documentation states
that Chat, Responses, and Messages requests "go to
`https://api.meta.ai/v1` by default."

**Verdict: public documentation confirms the adapter's base URL.**

### A.2 Model ID — the bare ID is NOT documented; versioned IDs are

- Meta's own example calls the model **`muse-spark-1.1`** (via the
  Responses API, `client.responses.create(model="muse-spark-1.1", …)`).
- LiteLLM's Meta provider page lists `muse-spark-1.1` as the documented
  chat model (1M-token context, text/image/video/PDF input), alongside
  `muse-voice-transcribe-1.0` for realtime transcription.
- Secondary reporting of Meta's dev.meta.ai documentation additionally
  lists `muse-spark-1.2` and `muse-spark-1.3` (and `-contributor`
  variants). Those version numbers were **not** verified on a Meta page
  opened for this appendix; they are recorded as secondary reporting.
- **No page opened for this appendix lists a bare `muse-spark` as an
  API model ID.** Every documented ID is versioned.

**Verdict: public documentation does not cover the adapter's default
model `"muse-spark"`; the documented form is versioned
(`muse-spark-1.1` confirmed on a Meta page). The adapter default should
be treated as unverified — and, on the evidence above, likely to be
rejected by the live API — until it is changed to a documented
versioned ID and tested with a real key. This spec records the finding;
it does not change the code.**

### A.3 Auth shape and request formats — partially confirmed

- Auth: Meta's example supplies the key as the OpenAI client's `api_key`
  (which that client sends as a Bearer token), sourced from an
  environment variable named `MODEL_API_KEY` in the example. A secondary
  source quoting dev.meta.ai states the API is "authenticated with a
  Bearer `MODEL_API_KEY`." The adapter's `Authorization: Bearer <key>`
  header is consistent with that shape.
  Note the naming spread, none of which is interchangeable by
  assumption: Meta's example uses `MODEL_API_KEY`; LiteLLM's own
  integration uses `META_API_KEY` / `META_API_BASE` for its proxy; the
  adapter uses `META_MODEL_API_KEY` / `META_MODEL_BASE_URL` /
  `META_MODEL_MODEL`. Only the adapter's names are this project's —
  they are not documented Meta names.
- Formats: secondary sources quoting dev.meta.ai state the API accepts
  Responses, Chat Completions, and Messages formats and is usable
  through the OpenAI SDK by changing base URL, key, and model name.
  That is consistent with the adapter's `/chat/completions` choice.
- **What could NOT be verified:** the full dev.meta.ai documentation
  pages themselves were not opened directly in this research pass; the
  format and auth details above rest on Meta's developer blog example
  plus secondary sources quoting those docs. The exact
  `choices[0].message.content` response envelope the adapter parses,
  its error shapes, rate limits, and pricing were not verified against
  a live call (no key exists) and are not confirmed by this appendix.
  Nothing here is a claim of live integration.

### A.4 Summary

| Adapter assumption | Status against public docs |
| --- | --- |
| Base URL `https://api.meta.ai/v1` | **Confirmed** (Meta developer example; corroborated by LiteLLM and other secondary sources) |
| Model `"muse-spark"` (bare) | **Not covered / contradicted by omission** — documented IDs are versioned; `muse-spark-1.1` confirmed, `1.2`/`1.3` reported secondarily |
| `POST /chat/completions`, OpenAI-style body | **Consistent** with secondary sources quoting dev.meta.ai; not verified live |
| `Authorization: Bearer <key>` | **Consistent** with Meta's example (OpenAI client `api_key`) and secondary quoting of the docs |
| Live integration | **None.** No API key exists; the adapter is untested; the offline stub is the default backend |

---

## 10. Sources

Pages actually opened during the research for this document, 2026-10-26:

- ESA — Simulation of the cosmic web (Illustris):
  https://www.esa.int/ESA_Multimedia/Images/2025/06/Simulation_of_the_cosmic_web
- Max Planck Institute for Astrophysics via Phys.org — Millennium Run /
  Millennium Simulation description:
  https://phys.org/news/2005-06-world-largest-supercomputer-simulation-growth.html
- Vogelsberger et al. — Introducing the Illustris Project (arXiv:1405.2921,
  HTML version):
  https://ar5iv.labs.arxiv.org/html/1405.2921
- NASA Science — Our Milky Way Galaxy: How Big is Space?:
  https://science.nasa.gov/universe/exoplanets/our-milky-way-galaxy-how-big-is-space/
- Observable universe — diameter, radius, age, comoving distances:
  https://en.wikipedia.org/wiki/Observable_Universe
- University of Oregon — Hubble sequence (galaxy colours, ellipticals,
  spirals, irregulars):
  https://pages.uoregon.edu/jschombe/ast123/lectures/lec11.html
- Caltech Ay 1, Lecture 12 — Galaxies and Their Properties (Hubble
  sequence trends, stellar populations):
  http://sites.astro.caltech.edu/ay1/Ay1_Lecture12.pdf
- Eternal inflation — bubble/patch multiverse, history, and the
  open-question criticism:
  https://en.wikipedia.org/wiki/Eternal_inflation
- American Physical Society — This Month in Physics History (Everett,
  many-worlds, branching and non-interaction, reception):
  https://www.aps.org/apsnews/2009/05/this-month-in-physics-history
- Three.js documentation index (InstancedMesh, InstancedBufferAttribute,
  CatmullRomCurve3, and addons listings):
  https://threejs.org/docs/
- Codrops — Three.js Instances: Rendering Multiple Objects Simultaneously
  (single draw call, `instanceMatrix`, `InstancedBufferAttribute` with
  custom shaders):
  https://tympanus.net/codrops/2025/07/10/three-js-instances-rendering-multiple-objects-simultaneously/
- Meta (developer.meta.com) — Meta Model API blog example (base URL,
  `MODEL_API_KEY`, `muse-spark-1.1`, Responses API):
  https://developer.meta.com/ai/resources/blog/build-with-muse-spark
- LiteLLM — Meta Model API provider documentation (base URL, endpoints,
  model list):
  https://docs.litellm.ai/docs/providers/meta
- ShipWithMuse — Muse Spark Structured Outputs and Tool Calling
  (secondary source quoting dev.meta.ai docs: formats, Bearer auth,
  Chat Completions path):
  https://shipwithmuse.live/blog/muse-spark-structured-outputs

Repository sources for §2 and Appendix A (read, not web pages):
`packages/cosmos-engine/README.md`, `packages/cosmos-engine/src/index.ts`,
`packages/cosmos-engine/src/types.ts`, `packages/cosmos-engine/src/layout.ts`,
`packages/cosmos-engine/src/renderer.ts`,
`packages/ai-core/src/meta-model-client.ts`.

---

## Appendix B — Implementation status (added 2026-10-26, after the Day-1 build)

This spec was written before the Day-1 implementation; §7 in particular is a
recommendation, not a description of shipped code. What actually shipped in
`packages/cosmos-engine` on 2026-10-26:

- **Generator** — `createUniverseData(seed, galaxyCount)` implements the §3/§4
  model: cluster centres by rejection sampling; filaments as quadratic-bezier
  paths between connected clusters (sampled at 24 points, used both as the
  rendered guide lines and the placement pool — the mechanism that makes the
  voids true); placement mix cluster 34% / filament 52% / void 14% with the
  §4 class mixes and class colours (`#bcd8ff` / `#ffd9a3` / `#7fe9ff`, with
  per-galaxy lightness jitter). Distribution properties are unit-tested
  (median void distance-to-filament > 3× the filament median; cluster
  elliptical share > void share).
- **Rendering** — the existing single `InstancedMesh` was kept (not one mesh
  per class as §7.1 suggested): galaxies are `kind: "galaxy"` nodes with
  explicit static positions honoured by the layout layer, per-node colours,
  and per-node sizes. Filaments render as one merged additive `LineSegments`;
  multiverse bubbles reuse the existing fresnel shell shader. Bloom is the
  engine's existing pass — colour separability at 5,000 galaxies was verified
  visually in the Oct 26 production-build capture, not measured.
- **Camera** — scale levels (Star System 26 / Galaxy 78 / Cluster 190 /
  Filament 420 / Cosmic Web 820 scene units) are distance stops with eased
  tweens, extending the existing focus-tween approach rather than the §7.6
  CatmullRom level path; the intro flythrough does use a CatmullRom sweep.
  Reduced-motion cuts animation as specified.
- **Multiverse** — `createMultiverseData(seed, bubbleCount = 5)`: the member
  cosmos plus variant bubbles with tint-shifted palettes, each with a
  focusable core node; labelled SPECULATIVE in-product per §8.3.
- **Not implemented from §7**: GPU particle flow along filaments (§7.4) — the
  Trust Beacon particle system remains consent-mode only. No performance
  figures are claimed anywhere (§9 holds).
