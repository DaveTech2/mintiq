#!/usr/bin/env bash
set -euo pipefail
export RUSTUP_HOME="${RUSTUP_HOME:-/home/box/.rustup}"
export CARGO_HOME="${CARGO_HOME:-/home/box/.cargo}"
# shellcheck disable=SC1091
source "$CARGO_HOME/env"
cd "$(dirname "$0")/.."
cargo build --target wasm32-unknown-unknown --release -p mintiq -p mintiq-yield-pool
mkdir -p res
cp -f target/wasm32-unknown-unknown/release/mintiq.wasm res/
cp -f target/wasm32-unknown-unknown/release/mintiq_yield_pool.wasm res/
echo "Wrote res/mintiq.wasm and res/mintiq_yield_pool.wasm"
