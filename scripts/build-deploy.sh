#!/usr/bin/env bash
# Assemble the Vercel deploy folder: static dashboard + /api/score agent function.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:web
OUT=web/.deploy
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -maxdepth 1 ! -name .vercel -exec rm -rf {} +
cp -r web/dist/. "$OUT/"
rm -rf "$OUT/.vercel.tmp"
mkdir -p "$OUT/api"
npx esbuild web/api-src/score.mjs --bundle --platform=node --target=node20 --format=esm \
  --outfile="$OUT/api/score.mjs" \
  --banner:js="import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" --log-level=warning
cat > "$OUT/vercel.json" <<'JSON'
{
  "rewrites": [{ "source": "/((?!assets/|api/).*)", "destination": "/index.html" }],
  "functions": { "api/score.mjs": { "maxDuration": 30 } }
}
JSON
echo "Deploy folder ready: $OUT"
