# Mintiq

An NFT that holds its own money, hires people, and invests idle funds — within rules the minter sets and the **NEAR contract** enforces.

> In one line: an NFT that earns, invests, hires, and pays on its own, within limits its owner sets.

**Track:** NEAR hackathon, “NFTs That Do Something.”  
**Demo rate:** **$2.00 per NEAR**, fixed and labelled in the UI. Not a live price. A $100 treasury is 50 NEAR; a $5 job is 2.5 NEAR; a $20 reserve is 10 NEAR.

This repository was built and tested locally. It has **not** been pushed to GitHub from this worktree, and it does **not** spend real money.

---

## Agent Market escrow (verified, 10 Nov 2026)

Read first. These are from the official docs and API, not assumptions. Full notes: [`docs/AGENT_MARKET.md`](docs/AGENT_MARKET.md).

| Question | What the docs say |
| --- | --- |
| Who funds escrow? | The **buyer**, from their **Agent Market balance**. Instant hire: held when the hire is confirmed. Standard board job: **posting is free; the bid amount is held when the buyer awards**. Competition prize pools (USDC only) are held when the competition is posted. |
| Currency? | **USD** (fiat wallet, card top-up) or **USDC** (crypto wallet). Marketplace **credits** (USD-denominated, spend-only) can pay USDC hires first. USD and USDC are the same *price* on the market, but payouts stay in the currency paid — they do not convert. x402 hires are USDC on **NEAR mainnet**. |
| From which account? | The buyer's custodial Agent Market wallet (a third-party wallet provider; users “connect no wallet and hold no keys”). An agent `aat_` token **cannot** move funds, accept work, or act as the owner. |
| Testnet / sandbox? | **None documented.** The live OpenAPI (`agents-market API` 2.0.0 at https://market.near.ai/openapi.json) has zero mentions of testnet, sandbox, staging, or a faucet. The product is https://market.near.ai. A real job requires a live funded USD or USDC balance. |
| How does acceptance pay, and whom? | Submitting a deliverable does **not** release funds. The **buyer** accepts (or auto-accept after 3–7 days). The held amount splits: the **agent owner's marketplace balance** gets the payout; the market takes a **5% fee from the builder's price** (a $100 job credits $95). Withdrawals are a later, person-signed step (USD via Stripe, USDC to a wallet). |

**Consequence for this demo:** Mintiq cannot honestly post a funded Agent Market job on NEAR testnet, because the market has no documented testnet and a live award spends real USD/USDC. The scripted demo therefore:

1. Runs the NFT treasury, limited agent key, hire/pay loop, overspend rejection, and dashboard on a **local NEAR sandbox**.
2. Walks one **labelled simulation** of the documented market lifecycle (post → bid → award/hold → submit → accept, owner paid minus 5%).
3. Will not award or top up on production.

Award and accept are not REST paths in the public OpenAPI; they are documented on the web and as MCP buyer tools (`award_bid`, `accept_result`).

Other NEAR agent notes (Shade Agents deprecated as standalone tooling after 19 April 2026, NEAR AI Cloud, Intents): [`docs/NEAR_AGENTS.md`](docs/NEAR_AGENTS.md).

---

## How rules are enforced on-chain

The agent cannot pay contributors directly and cannot break the mint rules.

- Only the **agent account** can `post_job`, `record_evaluation`, `invest_idle`, `harvest`, and `demo_accrue`.
- Only the **owner** can `approve_and_pay` (and rotate the agent with `set_agent`).
- `post_job` / `approve_and_pay` reject a budget above `max_per_task` (`ERR_OVERSPEND`).
- Any spend or investment that would leave liquid treasury below `min_reserve` is rejected (`ERR_RESERVE`).
- Investments are allowed only to `approved_destinations` (`ERR_UNAPPROVED_DESTINATION`). Earnings credit is also restricted to those accounts.
- Earnings split uses the mint-time `reinvest_bps` / `owner_share_bps` (must sum to 10_000).

On top of that, the demo agent signs with a **function-call access key** limited to the Mintiq contract and those agent methods. A transfer, or a call to any other contract (including the yield pool), is rejected by **NEAR**, before contract code runs.

The NFT is NEP-171 (`nft_token`, `nft_metadata` spec `nft-1.0.0`, `nft_transfer`, supply views). Track record (`jobs_completed`, `contributors_hired`, `total_spent`, `total_earned`) is on `get_track_record` / `get_nft` and in `nft_token` metadata `description` and `extra`.

The approved investment destination in this repo is a **demo yield pool** (labelled, 10% APY plus a `demo_accrue` helper). It is not a validator staking pool.

---

## Repository layout

```
contracts/mintiq/          Rust NFT + treasury + jobs (near-sdk 5.30)
contracts/yield-pool/      Labelled demo yield destination
app/src/                   Agent, evaluator, API server, Agent Market simulation
web/                       Dashboard (Vite + React)
scripts/demo.mjs           Scripted end-to-end demo
scripts/build-wasm.sh      Release wasm → res/
docs/                      Agent Market and NEAR agent research
```

---

## How to run

Prerequisites: Rust with `wasm32-unknown-unknown` (this box uses rustup under `/home/box/.cargo`), Node 20+.

```bash
# Contract unit tests (no sandbox)
source /home/box/.cargo/env   # if rustup is not on PATH
npm run test:contract

# Build wasm
npm run build:wasm

# Built-in scorer unit tests
npm run test:scorer

# Scripted demo (sandbox comes up and is torn down at the end)
npm run demo

# Demo + keep the sandbox and dashboard running
npm run build:web
npm run demo -- --serve
# open http://127.0.0.1:8787
```

The script mints a $100 treasury, tries (and shows NEAR rejecting) a transfer and a foreign-contract call with the agent’s limited key, tries (and shows the contract rejecting) a $6 job, posts “5 original memes, $5”, takes a good submission and an off-topic one, scores both with the built-in rule-based scorer (good must pass, off-topic must fail), has the owner approve and pay the good submission, then walks the simulated Agent Market job, invests idle funds, and harvests a labelled 5% demo yield.

Keys are written to `.mintiq/` with mode `0600` and are gitignored. Logs print account IDs only.

The default evaluator is the **built-in rule-based scorer (no LLM)**. It parses the job brief for a required count and topic (for example, 5 meme ideas), requires that many distinct items with caption/format/punchline structure, and penalizes negations or meta-mentions of the topic, off-topic content, duplicates, and too-short items. Pass is a score of 70 or more. Run `npm run test:scorer` for the unit tests.

Live NEAR AI Cloud judging is wired but **not exercised in the demo**: the Cloud account has no credit, and the user chose not to buy any. A key in `NEARAI_API_KEY` is not enough to turn it on. Set `NEARAI_JUDGE=1` (agent process only, never in the dashboard bundle, never commit the key) only when the account is funded. The gateway is `https://cloud-api.near.ai/v1`. An unfunded key returns HTTP 402 (`no_limit_configured`); with the flag left off, the demo never calls Cloud and those errors do not hit the logs. If the flag is on and Cloud fails, the built-in scorer is used, one warning is printed, and Cloud is not retried in that process.

After a testnet deploy, `web/src/deployed.json` holds public contract IDs and tx hashes only (no keys). `npm run build:web` then produces a static dashboard that reads live state from testnet RPC. Public visitors can inspect the demo NFT; they cannot sign writes from the site. The production dashboard is at https://mintiq-pink.vercel.app. Details: [`docs/TESTNET.md`](docs/TESTNET.md).

To deploy the frontend statically (for example to Vercel), run `npm run build:web` and publish `web/dist`. The testnet build does not need a `/api` server. **Do not deploy unless asked.**

---

## What is live vs simulated

| Piece | Status |
| --- | --- |
| Mintiq + yield-pool contracts | Compiled to wasm; unit tests run on the host |
| End-to-end loop | Local **NEAR sandbox** via `near-workspaces` |
| NEAR testnet deploy | Done. Contracts and the scripted demo flow are on testnet. Public IDs, tx hashes, and explorer links: [`docs/TESTNET.md`](docs/TESTNET.md). |
| Agent signer | Local function-call access key, not a Shade TEE |
| Job evaluator | **Built-in rule-based scorer (no LLM)** is the demo default. Live NEAR AI Cloud judging is wired behind `NEARAI_JUDGE=1` plus a key, but is **not exercised**: the account has no credit (HTTP 402 `no_limit_configured` on earlier probes) and the user chose not to buy credits. We do not claim a live NEAR AI score we did not get. |
| Agent Market job | **Simulation** of the documented lifecycle, clearly labelled |
| Demo yield | Simulated 10% APY pool, labelled; not real staking |

---

## License

Apache-2.0
