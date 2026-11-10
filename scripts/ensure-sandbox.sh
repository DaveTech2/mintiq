#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/node_modules/near-sandbox/bin/near-sandbox-2.14.0/near-sandbox"
DEST="$ROOT/node_modules/near-workspaces/node_modules/near-sandbox/bin/near-sandbox"
if [[ -x "$SRC" && -d "$(dirname "$DEST")" ]]; then
  cp -f "$SRC" "$DEST"
  chmod +x "$DEST"
  echo "Installed neard 2.14.0 sandbox binary for near-workspaces"
fi
