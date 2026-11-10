# Moment 2 on the real NEAR Agent Market (not done; needs your approval)

Mintiq's in-app hire runs on NEAR testnet (see README, Moment 2). The real [NEAR Agent Market](https://market.near.ai) has **no testnet**, so doing the same there spends real money. Nothing here has been posted or paid. Checked against docs.market.near.ai on 10 Nov 2026.

## What it would cost

| Item | Amount |
| --- | --- |
| Posting a standard job | Free. Nothing is charged until you award a bid. |
| Awarding a bid | The bid amount, held from your balance. Suggested cap: **$1–5** for "3 taglines" (bidders name their own price; the budget is a guide, not a cap). |
| Marketplace fee | 5%, taken from the builder's payout, **not added** to your cost. |
| Card top-up fee | 2.9% + $0.30 on top, if you top up USD by card (USDC/NEAR crypto top-ups avoid it). |
| Example | Award a $3 bid, top up by card: **≈ $3.39 total**. |

## What it needs from you

1. A **market.near.ai account with a confirmed email** (posting and awarding refuse until the email is confirmed).
2. A **balance**: USD by card, or USDC via a crypto top-up (NEAR, USDC, USDT and others are accepted and converted to USDC at a locked quote).
3. Your OK on: the job text (it is **public** unless "Private job" is ticked), the max you will award, and who accepts the result.
4. One of:
   - **Web (simplest):** post from Job board → Post a job → Standard, using the text below; or
   - **MCP:** connect an MCP client to `/mcp` (award/accept return a link for you to confirm) or `/mcp/pro` (spends in the call; keep approval prompts on for `create_job`, `award_bid`, `accept_result`).

An agent API token (`aat_…`) cannot post, award or pay; buyer actions belong to your account.

## How it maps to Mintiq

| Mintiq (testnet) | Agent Market (mainnet, real money) |
| --- | --- |
| Owner posts job, budget capped by `max_per_task` | You post a standard job with a budget guide |
| Contributor `submit_work` | Agents bid; you award one (amount held) |
| Agent `record_evaluation` with reasoning | Mintiq's scorer can score the delivered text off-chain (`scripts/agent-market-live.mjs score`) and you decide |
| Owner `approve_and_pay` from the NFT treasury | You accept; payout goes to the agent owner's market balance minus 5% |

The NFT treasury **cannot** fund Agent Market escrow: the market pays from its custodial USD/USDC balances, and there is no documented API for a NEAR contract to fund a job. A future version could have the NFT owner reimburse themselves from the treasury on mainnet; that is not built.

## Dry-run helper

`node scripts/agent-market-live.mjs draft` prints the job draft and checklist. `node scripts/agent-market-live.mjs score "<delivered text>"` scores a delivery with Mintiq's evaluator. The script never calls the market and has no live mode.
