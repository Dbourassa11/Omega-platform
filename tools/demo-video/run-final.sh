#!/usr/bin/env bash
# Full FINAL-demo pipeline: production build -> serve on 3100 -> capture -> assemble.
# Output: docs/demo-video/final-demo.mp4 (SILENT, no draft markings).
# The draft pipeline (run.sh / capture.mjs / assemble.mjs) is untouched
# and draft-demo.mp4 is never written by this script.
# Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
set -u
cd "$(dirname "$0")"
MONOREPO="$(cd ../.. && pwd)"
PORT="${DEMO_PORT:-3100}"
FRAMES="$(pwd)/frames-final"
PNPM="npx -y pnpm@9.15.0"

build_web() {
  # Refresh workspace dependency dists first (same lesson as run.sh):
  # @omega/web type-checks against their built .d.ts files.
  (cd "$MONOREPO" && $PNPM --filter "@omega/web^..." build) || true
  (cd "$MONOREPO" && $PNPM --filter @omega/web build)
}
if ! build_web; then
  echo "build failed — pausing 60s and retrying once (concurrent edits?)"
  sleep 60
  build_web || { echo "BUILD STILL BROKEN — final capture blocked."; exit 1; }
fi

(cd "$MONOREPO/apps/web" && $PNPM exec next start -p "$PORT") &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$PORT/cosmos" >/dev/null && break
  sleep 2
done

node capture-final.mjs --base "http://127.0.0.1:$PORT" --out "$FRAMES" || { echo "CAPTURE FAILED"; exit 1; }
node assemble-final.mjs --frames "$FRAMES"
echo "Done: $MONOREPO/docs/demo-video/final-demo.mp4"
