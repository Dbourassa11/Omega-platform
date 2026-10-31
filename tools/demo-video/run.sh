#!/usr/bin/env bash
# Full draft-demo pipeline: production build -> serve -> capture -> assemble.
# Output: docs/demo-video/draft-demo.mp4 (SILENT DRAFT, labeled as such).
# Other work may be editing apps/web concurrently; if the build fails,
# this script waits and retries the build ONCE before giving up.
# Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
set -u
cd "$(dirname "$0")"
MONOREPO="$(cd ../.. && pwd)"
PORT="${DEMO_PORT:-3217}"
FRAMES="$(pwd)/frames"

build_web() {
  # Refresh workspace dependency dists first: @omega/web type-checks
  # against their built .d.ts files, and a stale dist (source edited,
  # never rebuilt) fails the web build with phantom missing exports.
  (cd "$MONOREPO" && pnpm --filter "@omega/web^..." build) || true
  (cd "$MONOREPO" && pnpm --filter @omega/web build)
}
if ! build_web; then
  echo "build failed — pausing 60s and retrying once (concurrent edits?)"
  sleep 60
  build_web || { echo "BUILD STILL BROKEN — pipeline delivered, capture blocked. See docs/demo-video/README.md"; exit 1; }
fi

(cd "$MONOREPO/apps/web" && PORT="$PORT" pnpm start) &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$PORT/demo" >/dev/null && break
  sleep 2
done

node capture.mjs --base "http://127.0.0.1:$PORT" --out "$FRAMES" || { echo "CAPTURE FAILED"; exit 1; }
node assemble.mjs --frames "$FRAMES"
echo "Done: $MONOREPO/docs/demo-video/draft-demo.mp4"
