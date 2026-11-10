# Agent Market: verified escrow and payout (as of 10 Nov 2026)

Sources read this turn, not assumed:

- https://market.near.ai/llms.txt
- https://docs.market.near.ai/ (index and https://docs.market.near.ai/llms.txt)
- https://docs.market.near.ai/concepts/payments-and-disputes.md
- https://docs.market.near.ai/concepts/how-it-works.md
- https://docs.market.near.ai/buyers/wallets-and-billing.md
- https://docs.market.near.ai/buyers/post-a-job.md
- https://docs.market.near.ai/buyers/first-result.md
- https://docs.market.near.ai/buyers/follow-a-job.md
- https://docs.market.near.ai/faq.md
- https://docs.market.near.ai/builders/faq.md
- https://market.near.ai/skill/SKILL.md
- https://market.near.ai/skill/reference/agent-api.md
- https://market.near.ai/openapi.json (info: "agents-market API" 2.0.0)

## Who funds escrow

The **buyer** funds it, from their **Agent Market balance**, not from a raw NEAR account they control and not from the worker agent.

- Instant hire: the price leaves the buyer's balance and is held when the hire is confirmed.
- Standard board job: posting is free. **Nothing is charged until the buyer awards a bid.** Awarding holds that bid's amount in the job's currency and creates the assignment.
- Competition: the prize pool is **USDC only** and **is held when the competition is posted**.

The agent API token (`Authorization: Bearer aat_…`) "can neither act as its owner account nor move funds." Creating jobs, awarding, accepting, and disputes "belong to accounts, not agent tokens" (`skill/reference/agent-api.md`).

Builder FAQ: "The Wallet Provider, a third party named in the Terms of Service. You connect no wallet and hold no keys."

## Currency

Three buyer balances (`buyers/wallets-and-billing.md`):

| Balance | Currency | How it fills | What it pays |
| --- | --- | --- | --- |
| Fiat wallet | USD | Card top-ups | Hires and awards in USD |
| Crypto wallet | USDC | Crypto deposits | Hires, awards, and competition prize pools in USDC |
| Credits | USD-denominated | Granted by the marketplace | USDC hires, before the crypto wallet is touched. Spend-only. |

USD and USDC are treated as the same price on the market (either balance can pay a listing in the other currency), but **payouts stay in the currency the buyer paid with** — "USD and USDC do not convert into each other."

A2A + x402 is a separate rail: the official example quotes `network: "near:mainnet"` and USDC (`docs.market.near.ai/a2a/hire-agent-using-x402`). That payment is held and settled when the agent delivers, not when the buyer later accepts.

## From which account

- Web / MCP hires: the **buyer's Agent Market wallet** (fiat USD, crypto USDC, or credits). Hiring requires a confirmed-email account, except x402 (a wallet that signs a USDC authorization is enough).
- The worker agent never receives the money. The `aat_` token cannot read the owner's wallet.

## Testnet / sandbox mode

**None is documented.**

Searched: the docs index, payments, wallets, FAQ, builder FAQ, first-result, the worker skill, the agent-api reference, and the live OpenAPI document (211,633 bytes). Counts for `testnet`, `sandbox`, `staging`, and `faucet` in that OpenAPI file were **zero**. Server URLs are not even listed in the spec; the live product is `https://market.near.ai`.

x402 payment examples use **NEAR mainnet**, not testnet.

A real job on Agent Market therefore requires a live buyer account and a real USD card top-up or USDC crypto deposit. This repo does **not** post or fund a live job.

## How acceptance releases payment, and to whom

1. The agent submits a deliverable (`POST /v1/assignments/{id}/submit`). That does **not** release the held payment.
2. The **buyer** accepts (web, or MCP tool `accept_result`). Accepting splits the held payment: the **agent owner's marketplace balance** receives the payout; the marketplace takes its **5% platform fee from the builder's price**, not as an extra charge to the buyer. A $100 job credits **$95** to the owner (`builders/faq.md`).
3. If the buyer does nothing, the work is **auto-accepted** when the acceptance window ends: **3 days** after submission, unless the buyer chose up to **7 days** at posting/hire.
4. Ledger kinds: `hire` (held at award), `payout` (released to the owner), `platform_fee`, `refund` (back to the balance that paid).
5. Withdrawals are a later step, by the owner signed in as a person: USD to a bank via Stripe Connect; USDC to a wallet address on NEAR or several EVM/Solana networks.

Refunds return to the buyer if the assignment is cancelled before start, the delivery window lapses, or a dispute is resolved against the agent.

## What this means for Mintiq

Mintiq's NFT treasury lives on NEAR (testnet or a local sandbox). Agent Market escrow lives in the marketplace's custodial balances in USD/USDC. There is no documented testnet market, and no documented API for a NEAR contract to fund market escrow directly.

The demo therefore:

- Runs the NFT treasury, limited agent key, overspend rejection, and dashboard on NEAR sandbox (and testnet if a funded account is available).
- Includes a **labelled simulation** of the documented Agent Market job lifecycle (post → bid → award/hold → submit → accept / owner payout minus 5%).
- Ships a thin real-API client that stays off unless explicit live credentials are present. It will not top up, award, or accept on production.

OpenAPI note: award and accept are **not** exposed as REST paths in `openapi.json` 2.0.0 (no `/award` or `/accept` job routes). Buyer award/accept is documented on the web and as MCP tools (`award_bid`, `accept_result`). Standard job creation also appears as MCP `post_job` / job drafts; the public REST spec lists `POST /v1/jobs/competition` (humans only; "the call spends") but not a simple `POST /v1/jobs` for a standard board job.
