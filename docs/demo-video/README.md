# Demo video — DRAFT (historical) and FINAL

This folder holds two silent videos of the Omega Platform. The
**draft** is the Phase 2 structural draft, kept byte-untouched as a
historical artifact. The **final** is the submission demo.

| File | What it is |
|---|---|
| `draft-demo.mp4` | 36 s, 1280×720, H.264, silent, 745,935 bytes. Per beat: a 2 s title card + a 4 s hold on a real captured frame. "DRAFT — NOT FINAL" appears on every title card and "DRAFT" is burned into the bottom-right of the whole video. **Historical — do not modify.** |
| `final-demo.mp4` | **142.0 s (2:22), 1280×720, H.264 (yuv420p), silent — no audio stream, 3,010,171 bytes.** (Refreshed Oct 28 2026 for the Phase 4 Alive Pass: a Stellar Physics section was added inside the Cosmos flow.) A ~3 s title card, then per section a 2 s title card (section title + one-line narration) followed by real captured frames, each with a short caption burned into its lower edge, and a ~4 s end card. **No "DRAFT" text or watermark anywhere.** Narration is carried entirely as this text. |
| `final-stills/` | The capture frames `final-demo.mp4` was assembled from (title, cosmos, stellar, garden, privacy, omni, communities, end) for spot-checking what the video actually shows. |

## Final — section list (in order)

| # | Section | Duration | What the frames show |
|---|---|---|---|
| 1 | Title card | 3 s | "Eternal Quantum Horizons Ω — Omega Platform" / "Designed as an overlay for Facebook — design intent" / creator line |
| 2 | Cosmos — Three Views | 23 s | `/cosmos` in Consent Cosmos (default), Universe, and Multiverse modes — one real frame each, captions naming the view and its honesty label (Multiverse is labeled SPECULATIVE in-product) |
| 3 | Stellar Physics | 10 s | `/cosmos` on a dedicated fresh capture page (reduced-motion emulated from first load so star positions are stable): a member star is clicked and its inspector shows Friends / Followers / Mass / Density / Brightness computed live, under the section card "Friends make a star massive · Followers make it dense and bright" |
| 4 | Import Archive | 10 s | `/import` after loading the synthetic sample export: import summary (28 fictional people, ring counts) and the ring-decision legend — parsed entirely in the browser, nothing uploaded, unclassified people deny-by-default into the Family ring |
| 5 | Sovereign Vault | 14 s | `/vault`: a real file encrypted into the family ring, then the real Decrypt & verify flow ending at "Verified ✓ — integrity match" |
| 6 | Eternal Garden | 18 s | `/garden` via the page's own suggestion chips: the lighthouse question answered with citations, then the Antarctica question — "ABSTAINED — NO SUPPORTING MEMORY" |
| 7 | Privacy — Five Viewers | 22 s | `/privacy/demo` with the viewer switched Doctor → Family → Friend → Coworker → Public (~4 s each): the same member world re-rendered per viewer, every decision computed by the policy engine |
| 8 | Omni Demonstration | 17 s | `/review/demo`: the generated 10-step plan, then the completed run — RUN COMPLETED, 10/10 steps executed, each receipt showing its purpose-limited pass grant |
| 9 | Communities | 12 s | Terra Tech Commons (launch-ready, 8 members) with the agent's educational draft, then the same page after publishing the draft into the feed with the page's own button |
| 10 | Close | 9 s + 4 s end card | `/public`, the disclosure-filtered public shell, then the end card: "Built on Facebook. Powered by Meta's own AI stack. Owned by you." + creator line |

## How the final was captured

Pipeline: `tools/demo-video/run-final.sh` → production build → serve
on port 3100 → `capture-final.mjs` → `assemble-final.mjs`. The draft
pipeline (`run.sh`, `capture.mjs`, `assemble.mjs`) is untouched; the
final uses new files alongside it (`capture-final.mjs`,
`assemble-final.mjs`, frames in `tools/demo-video/frames-final/`).

The capture drives the **real UI** in headless Chromium — nothing is
a mock or composited frame: cosmos mode buttons; the Import page's
synthetic-export button; a real file through the Vault's file input
and its Decrypt & verify button; the Garden's own suggestion chips;
the five Privacy viewer tabs; and on `/review/demo` the full Generate
plan → Approve as the demo member owner → Execute flow. The
Communities page is reached by **client-side navigation** from the
Omni results (a page reload would reset the in-memory run), and the
educational draft is published with the community page's own
"Publish to community feed" button. Capture tracked console errors,
page errors, and HTTP ≥ 400 responses: **0** (manifest in
`tools/demo-video/frames-final/manifest.json`).

One capture bug found and fixed along the way: the Omni run badge is
CSS-uppercased, so `innerText` yields "RUN COMPLETED" — an early
capture waited for the mixed-case string and timed out even though
the run had completed in under a second. The wait is now
case-insensitive.

## Verification (final)

- `ffprobe`: duration **142.0 s**, **1280×720**, codec **h264**,
  pix_fmt **yuv420p**, **one video stream and no audio stream**,
  size **3,010,171 bytes** (Phase 4 refresh, Oct 28 2026).
- Full decode: `ffmpeg -v error -i final-demo.mp4 -f null -`
  completes with **no errors**.
- Stills in `final-stills/` are the capture frames the MP4 was
  assembled from, visually inspected: the title card carries the
  exact attribution; the Multiverse frame shows the in-canvas
  SPECULATIVE label; the Garden frame shows the abstention; the
  Privacy frame shows the Family viewer's locked cards with engine
  deny reasons; the Omni frame shows RUN COMPLETED, 10/10 steps, and
  the vault receipt. The Phase 4 Stellar Physics card (27 s) and the
  inspector frame (32 s — Friends 3 · Followers 419 · Mass 2.39 ·
  Density 7.04 · Brightness 18.68, caption legible) were additionally
  verified against extractions from the finished MP4.
- Draft integrity: `draft-demo.mp4` was 745,935 bytes before this
  work and is **745,935 bytes** after it.

## How the draft was captured

Pipeline: `tools/demo-video/` (`run.sh` → production build → serve →
`capture.mjs` → `assemble.mjs`). The capture drives the **real UI**
in headless Chromium: node-count select set to 2,000, a cosmos node
click, Public → Family ring buttons, the Oracle's own suggestion
chips (in-ring answer, then "Try crossing a ring →" Guardian
refusal), and the PhiSplit page. Captured frames + a manifest with
console errors (0) live in `tools/demo-video/frames/`.

First run note: the initial web build failed on other workstreams'
in-flight edits (stale `@omega/ai-core` dist — its source had the
exports, its built `.d.ts` did not). Rebuilding the workspace
dependency dists (now step 1 of `run.sh`) unblocked it; the capture
then completed cleanly.

## Honesty labels (do not remove)

- The **draft** is labeled DRAFT — in its filename, on every title
  card, and burned in. The **final** carries no draft markings.
- Captures ran under **software rendering** (SwiftShader). They prove
  structure only — **no FPS or performance figure** may be quoted
  from them. (The cosmos UI displays its own live node/FPS readout
  in-frame; that is the product's real UI under software rendering,
  not a performance claim, and no caption repeats it.)
- All demo data is synthetic; in-frame labels say so (OFFLINE /
  "Local demo logic — no live AI" badges, "Synthetic / fictional"
  badges, the SPECULATIVE multiverse label, and the overlay
  design-intent disclaimer — "Omega is not affiliated with or
  endorsed by Meta" — visible on the public-shell frame). Nothing
  was cropped to hide them.
- Attribution: David Charles Bourassa · Quantum Concepts LLC,
  Santa Fe, New Mexico.
