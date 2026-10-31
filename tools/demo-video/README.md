# Demo-video pipeline (tools/demo-video)

Produces a **silent DRAFT** video of the HACKATHON.md §6 two-minute
demo from the real production UI. Final voiceover is the founder's
later call; this pipeline deliberately makes no audio.

## Run it

```bash
# one-time: puppeteer + Chromium (~170 MB) OUTSIDE the monorepo deps
mkdir -p /tmp/shot && cd /tmp/shot && npm init -y && npm i puppeteer

# full pipeline: build → serve (port 3217) → capture → assemble
cd tools/demo-video && bash run.sh
```

Or step by step: `node capture.mjs --base http://127.0.0.1:3217`
(with the production build already serving), then `node assemble.mjs`.

## What it does

- `capture.mjs` — headless Chromium (`--no-sandbox
  --enable-unsafe-swiftshader`) walks the beats and drives the real
  UI: node-count select → 2,000, a canvas node click, Public → Family
  ring buttons, the Oracle's suggestion chips (in-ring, then
  "Try crossing a ring →"), and the PhiSplit page. One PNG per beat +
  `manifest.json` (frames, beat captions, console errors).
- `assemble.mjs` — ffmpeg: per beat a 2s title card + 4s frame hold.
  "DRAFT — NOT FINAL" is on every title card and "DRAFT" is burned
  into the whole video. Output: `docs/demo-video/draft-demo.mp4`.

## Honesty rules baked in

- Software rendering (SwiftShader): frames prove **structure only**.
  No FPS / performance figure may be quoted from these captures.
- The video is a DRAFT in its filename, its title cards, and a
  burned-in watermark. It is silent by design.
- Demo data is synthetic; the in-product labels stay visible in-frame.

Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
