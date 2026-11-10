# NEAR agent platforms: what is real today (10 Nov 2026)

## Shade Agents (TEE + contract guardrails)

Real technology, **not used as a live TEE in this demo**.

- Official docs page now says the Shade Agent Framework is **deprecated as standalone tooling after 19 April 2026**. The source and docs moved to https://github.com/NearDeFi/shade-agent-framework (the framework "will no longer be actively maintained"; it has **not had a formal audit**).
- A real Shade Agent runs a worker in a TEE (the template deploys to Phala Cloud), registers a remote attestation with a contract, and signs via Chain Signatures. That needs a TEE host and typically a paid cloud deployment. This repo does not spend money and does not attest a TEE.
- What Mintiq *did* take from that design: the **agent account is the only account that can post jobs, record evaluations, and move idle funds**, and the **contract rejects** overspend, reserve breaches, and unapproved destinations even if that key is compromised. The owner can rotate `agent_id`.
- The agent process signs with a **function-call access key** limited to the Mintiq contract and an allowlisted set of methods, so NEAR itself rejects a transfer or a call to any other contract. That is protocol-level, not TEE attestation.
- Upgrade path: run the same agent in a TEE, swap `LocalKeySigner` for a Shade/Chain-Signatures signer, and optionally require attestation before `set_agent`.

## NEAR AI Cloud

Real and usable today: private, OpenAI-compatible inference in TEEs at https://docs.near.ai/ (gateway `cloud-api.near.ai`). The live judge is **on as of 10 Nov 2026**. Production uses a key from **NEAR Builders credits**, set as `NEARAI_API_KEY` in the **agent process only** (the key is never sent to the browser or baked into the dashboard).

`app/src/evaluator.js` turns the judge on when `NEARAI_API_KEY` (or `NEAR_AI_API_KEY`) is set, unless `NEARAI_JUDGE=0` or `MINTIQ_NEARAI_JUDGE=0` forces the built-in scorer. A key alone is enough; you do **not** need `NEARAI_JUDGE=1`. The default model is `z-ai/glm-5.3-flash` (`NEAR_AI_MODEL` overrides). The agent asks for structured JSON (score, short reasoning, pass/fail). Timeouts, HTTP errors, empty content, and unparseable output fall back to the built-in rule-based scorer; the fallback is written into the on-chain `evaluator` label and shown as "Scored by …". After a 401 or 402, Cloud is not retried for the rest of that process.

The built-in scorer still parses the brief for a required count and topic, requires distinct on-topic items (caption/format/punchline structure for meme jobs), and rejects off-topic work, topic negations, duplicates, and too-short items. Pass is a score of 70 or more. It remains the labelled fallback.

The live catalog on 10 Nov 2026 did not list the documented IDs `z-ai/glm-5.2` or `zai-org/GLM-5.1-FP8`; it did list `z-ai/glm-5.3-flash` (with `json_mode` and `structured_outputs`), which is the model Mintiq uses. Completions previously returned **HTTP 402** (`no_limit_configured`) on an unfunded key. That is no longer the case. A live on-chain score from NEAR AI Cloud was recorded on 10 Nov 2026 (NFT #2 job 5, score 90 pass): [`7VN7WX…`](https://testnet.nearblocks.io/txns/7VN7WXFJqR5tY9LkmeZqVFvGB4hqUPmgoCW4KYoWHcRh).

IronClaw (docs.ironclaw.com / agent.near.ai) is a separate hosted agent framework on NEAR AI Cloud. Mintiq does not embed it.

## NEAR Intents / 1-Click Swap

Real mainnet API (https://docs.near-intents.org/, `https://1click.chaindefuser.com/v0/quote`). It moves assets to a quote-specific deposit address. It is **not** wired as an approved Mintiq destination: it would send treasury funds off-contract, it is not documented as a testnet-friendly rail, and this project does not spend real money. A future owner could `add_approved_destination` only if the destination can be constrained by the contract.

## Agent Market

See `docs/AGENT_MARKET.md`. Live product at market.near.ai; **no documented testnet**.
