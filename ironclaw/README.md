# Mintiq agent on IronClaw

This folder packages the Mintiq treasury agent as an **IronClaw extension** (IronClaw v1.4.1 "Reborn", extension manifest v3, WASM component tools).

> **What actually ran:** a locally built IronClaw with a local open-weights model (Ollama), not NEAR AI Cloud. One real on-chain action came from IronClaw: `mintiq.score_submission`. Hosted IronClaw is documented only. Details are in [Status](#status-honest).

## Tools

| Tool (model-visible name) | Egress | Credential | Permission | Effect |
| --- | --- | --- | --- | --- |
| `mintiq.list_pending` (`mintiq__list_pending`) | `https://test.rpc.fastnear.com` only | none | allow | Read-only: Mintiq-agent tokens, unscored submissions, idle funds above reserve |
| `mintiq.score_submission` | `https://mintiq-pink.vercel.app` (relay) | `mintiq_relay_token` (injected header) | ask | Scores one submission server-side (NEAR AI Cloud, built-in fallback) and records `record_evaluation`. Cannot pay anyone. |
| `mintiq.invest_idle` | relay | `mintiq_relay_token` | ask, `financial` | Invests idle funds above the reserve into the approved destination (demo pool) |
| `mintiq.harvest` | relay | `mintiq_relay_token` | ask, `financial` | Optionally accrues up to 5% labelled demo yield, then harvests |

## Files

- `extension/mintiq/manifest.toml`: tools, network targets, effects, origin gates, credential handles, and the `[auth.mintiq]` api_key recipe.
- `extension/mintiq/schemas/`, `extension/mintiq/prompts/`: input schemas and tool docs. The docs tell the model that contributor text is untrusted.
- `extension/mintiq/wasm-src/`: Rust WASM component against IronClaw `tool.wit` (`near:agent@0.4.1`). The built component is `wasm/mintiq_tool.wasm`.

## Credential vault and allowlist

The relay token lives only in IronClaw's secret store. The WASM never sees it. IronClaw host egress injects `Authorization: Bearer …`, and only for the host `mintiq-pink.vercel.app`.

The network allowlist has two entries:
- NEAR testnet RPC, for reads.
- The Mintiq relay host, for writes.

**This deviates from "RPC + treasury only".** IronClaw WASM tools never hold raw secrets, so they cannot sign NEAR transactions themselves. Writes go through `POST /api/agent` (`web/api-src/agent.mjs`). That endpoint:

- requires the bearer token (timing-safe compare);
- acts only on tokens whose agent is `miqagt7f109e53.testnet`;
- signs with that account's function-call key, which is limited to `mintiq7f109e53.testnet` agent methods and cannot transfer NEAR.

The contract still enforces max per task, the reserve, and approved destinations. Only the owner can pay.

## Build and run locally (what was done)

```bash
# 1. IronClaw from source (tag ironclaw-v1.4.1)
git clone https://github.com/nearai/ironclaw && cd ironclaw && git checkout ironclaw-v1.4.1
COREPACK_HOME=$HOME/.cache/corepack cargo build --release

# 2. Mintiq tool component
cd mintiq/ironclaw/extension/mintiq/wasm-src
rustup target add wasm32-wasip2 && cargo build --release --target wasm32-wasip2
cp target/wasm32-wasip2/release/mintiq_tool.wasm ../wasm/

# 3. Local LLM (no credits): Ollama + Qwen2.5-3B-Instruct GGUF (downloaded from Hugging Face)
ollama serve & ollama create qwen2.5-3b-local -f Modelfile

# 4. IronClaw home (local-dev profile) with the extension
export IRONCLAW_REBORN_HOME=/workspace/ironclaw-home IRONCLAW_REBORN_WORKSPACE_ROOT=/workspace/ironclaw-ws
export IRONCLAW_DISABLE_OS_KEYCHAIN=1 LLM_REQUEST_TIMEOUT_SECS=900   # CPU inference; default 60s times out
cp -r mintiq/ironclaw/extension/mintiq $IRONCLAW_REBORN_HOME/local-dev/system/extensions/mintiq
# config.toml: provider "ollama", model "qwen2.5-3b-local", base_url "http://127.0.0.1:11434"
ironclaw serve --port 3417          # WebUI token in $HOME/webui-token

# 5. Credential: WebUI -> Extensions -> Mintiq -> Relay token
#    (API: /api/reborn/product-auth/manual-token/setup then /secret-submit)
```

On the relay side, `MINTIQ_RELAY_TOKEN` and `MINTIQ_AGENT_KEY` are Vercel sensitive env vars. Locally they live in the gitignored `.mintiq/` and are never committed.

## Status (honest)

| Item | Result |
| --- | --- |
| IronClaw v1.4.1 built from source | ✅ |
| Extension loads, 4 tools active | ✅ |
| Relay token stored in the vault | ✅ (the WASM never sees it) |
| `list_pending` through IronClaw | ✅ Real RPC read: token 2, job 2, submission 1 pending |
| `score_submission` through IronClaw | ✅ On-chain [`5fUxtHFg…`](https://testnet.nearblocks.io/txns/5fUxtHFgLad3vcEMD9tdGunBPtf7r2H8sCqHDqHs2aBH): score 80, pass |
| `invest_idle` / `harvest` through IronClaw | ⚠️ The 3B local model replied from earlier context or sent wrong arguments instead of calling these tools. The relay actions themselves work. |
| Hosted IronClaw on NEAR AI Cloud | ❌ Documented only. It needs a sign-in and credits; the key returns HTTP 402 `no_limit_configured` |

The local model is the weak link: about 1–3 minutes per turn on CPU, and it sometimes skips the real call. A larger model, or NEAR AI Cloud once funded, needs only an LLM provider change in `config.toml`.

## Hosted IronClaw (NEAR AI Cloud): steps only

1. Sign in at https://cloud.near.ai and add credits.
2. Create an IronClaw agent with the NEAR AI provider, model `z-ai/glm-5.3-flash`.
3. Install `extension/mintiq` and set the `mintiq_relay_token` secret in the hosted vault.
4. Keep the allowlist: `test.rpc.fastnear.com` plus `mintiq-pink.vercel.app`.
5. Add a routine: list pending → score → invest idle → harvest.
