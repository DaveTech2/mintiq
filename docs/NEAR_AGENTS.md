# NEAR agent platforms: what is real today (10 Nov 2026)

## Shade Agents (TEE + contract guardrails)

Real technology, **not used as a live TEE in this demo**.

- Official docs page now says the Shade Agent Framework is **deprecated as standalone tooling after 19 April 2026**. The source and docs moved to https://github.com/NearDeFi/shade-agent-framework (the framework "will no longer be actively maintained"; it has **not had a formal audit**).
- A real Shade Agent runs a worker in a TEE (the template deploys to Phala Cloud), registers a remote attestation with a contract, and signs via Chain Signatures. That needs a TEE host and typically a paid cloud deployment. This repo does not spend money and does not attest a TEE.
- What Mintiq *did* take from that design: the **agent account is the only account that can post jobs, record evaluations, and move idle funds**, and the **contract rejects** overspend, reserve breaches, and unapproved destinations even if that key is compromised. The owner can rotate `agent_id`.
- The agent process signs with a **function-call access key** limited to the Mintiq contract and an allowlisted set of methods, so NEAR itself rejects a transfer or a call to any other contract. That is protocol-level, not TEE attestation.
- Upgrade path: run the same agent in a TEE, swap `LocalKeySigner` for a Shade/Chain-Signatures signer, and optionally require attestation before `set_agent`.

## NEAR AI Cloud

Real and usable today: private, OpenAI-compatible inference in TEEs at https://docs.near.ai/ (gateway `cloud-api.near.ai`). Live judging is **optional and off by default**. The demo uses the **built-in rule-based scorer (no LLM)**, which parses the brief for a required count and topic, requires distinct on-topic items (caption/format/punchline structure for meme jobs), and rejects off-topic work, topic negations, duplicates, and too-short items. Pass is a score of 70 or more.

The Cloud path stays wired in `app/src/evaluator.js` for a later funded account: set `NEARAI_JUDGE=1` and `NEARAI_API_KEY` in the **agent process only** (the key is never sent to the browser or baked into the dashboard). A key alone does not enable it, so an unfunded key cannot 402-spam demo logs. When enabled, the agent discovers a model from `GET /v1/models` and asks for structured JSON (score, short reasoning, pass/fail). Timeouts, HTTP errors, and unparseable output fall back to the built-in scorer; a single warning is logged and Cloud is not retried in that process.

The live catalog on 10 Nov 2026 did not list the documented IDs `z-ai/glm-5.2` or `zai-org/GLM-5.1-FP8`; it did list `z-ai/glm-5.3-flash` (with `json_mode` and `structured_outputs`), which is the model Mintiq would select. Completions and `POST /v1/check_api_key` previously returned **HTTP 402** (`no_limit_configured`: "No spending limit configured. Please contact support to set up credits."), including after a $10 key spend limit was reported as set. The user chose not to buy Cloud credits, so this demo does **not** call the live judge. We do not claim a live NEAR AI score we did not get.

IronClaw (docs.ironclaw.com / agent.near.ai) is a separate hosted agent framework on NEAR AI Cloud. Mintiq does not embed it.

## NEAR Intents / 1-Click Swap

Real mainnet API (https://docs.near-intents.org/, `https://1click.chaindefuser.com/v0/quote`). It moves assets to a quote-specific deposit address. It is **not** wired as an approved Mintiq destination: it would send treasury funds off-contract, it is not documented as a testnet-friendly rail, and this project does not spend real money. A future owner could `add_approved_destination` only if the destination can be constrained by the contract.

## Agent Market

See `docs/AGENT_MARKET.md`. Live product at market.near.ai; **no documented testnet**.
