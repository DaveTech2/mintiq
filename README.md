# Mintiq

**AI agents can run businesses, but nobody owns them and nothing limits them.** Mintiq fixes both: each business is an NFT you own, with its own treasury, mission and agent, and the rules the agent can never break are enforced by a NEAR contract.

- **Live (free, NEAR testnet):** https://mintiq-pink.vercel.app
- **Contract:** [`mintiq7f109e53.testnet`](https://testnet.nearblocks.io/address/mintiq7f109e53.testnet) · demo yield pool [`yld.mintiq7f109e53.testnet`](https://testnet.nearblocks.io/address/yld.mintiq7f109e53.testnet) · hosted agent [`miqagt7f109e53.testnet`](https://testnet.nearblocks.io/address/miqagt7f109e53.testnet)
- **X:** [@mintiq_](https://x.com/mintiq_)
- **Track:** NEAR hackathon, "NFTs That Do Something" · demo script: [`docs/PITCH.md`](docs/PITCH.md)

> Everything runs on **NEAR testnet with test NEAR**, which has no cash value. Amounts are shown in test NEAR, not dollars. Testnet USDC (NEP-141) was considered, but the contract's treasury, payouts and storage all settle in native NEAR, and switching would add `ft_transfer_call` plumbing without changing what the demo proves.

## How it works

```mermaid
flowchart LR
  O([Owner wallet]) -- mint + rules --> C
  subgraph C [Mintiq contract · NEP-171 NFT]
    T[(Treasury)]
    R{{Rules: max per task,\nreserve floor,\napproved pool}}
    TR[Track record]
  end
  A([Agent · limited key]) -- post_job / record_evaluation / invest_idle --> C
  W([Contributor wallet]) -- submit_work --> C
  O -- approve_and_pay --> C
  C -- payment --> W
  C -- invest idle --> P[(Approved yield pool)]
  P -- earnings --> C
  O -- nft_transfer --> B([New owner])
  R -. rejects .-> X[[ERR_OVERSPEND\nERR_UNAPPROVED_DESTINATION\nERR_RESERVE]]
```

1. **Mint** (free; only the measured storage is kept). The minter sets the mission, max spend per task, reserve floor and earnings split. The treasury is the deposit minus storage (0 is fine; anyone can `fund` it later).
2. **Hire.** The owner or agent posts a job. Anyone with a wallet submits work. The agent scores it on-chain with a score, pass/fail and **one line of reasoning** (NEAR AI Cloud first, built-in rule-based scorer as fallback; the evaluator used is stored with the score).
3. **Pay.** Only the owner can `approve_and_pay`; the contract sends the budget from the treasury to the contributor.
4. **Invest.** Idle funds above the reserve can only go to the approved pool (a labelled demo yield pool on testnet). Earnings split between treasury and owner by the mint rule.
5. **Sell.** `nft_transfer` (NEP-171, 1 yoctoNEAR) moves the whole business: treasury, track record, jobs and control of the agent follow the token, because every owner check reads the token's current owner.

The agent signs with a **function-call key** limited to the Mintiq contract and its agent methods, so NEAR itself blocks transfers or calls to other contracts. The contract then enforces the rules:

| Rule | Error |
| --- | --- |
| Budget above `max_per_task` | `ERR_OVERSPEND` |
| Investment to anything but the approved pool | `ERR_UNAPPROVED_DESTINATION` |
| Spend/investment that would breach `min_reserve` | `ERR_RESERVE` |
| Anyone but the current owner/agent runs the NFT | `ERR_NOT_AGENT_OR_OWNER` / `ERR_NOT_OWNER` |
| Transfer without exactly 1 yoctoNEAR | `ERR_REQUIRES_ONE_YOCTO` |

## The three moments (all on testnet, with tx links)

**1. Try to break the rules.** On any NFT page, **Try to break the rules** makes the hosted agent send a real transaction that breaks a rule. The contract panics, the failed tx stays on-chain, and the page shows the reason and the NearBlocks link. Rate-limited (20 s per visitor).

- Agent tries to commit 5 NEAR to one task (max 2.5): [`3KM6Xa…`](https://testnet.nearblocks.io/txns/3KM6XaRKsJjvhmqsXmAsRxz9CcnYsEvCQjNAkku33fkM) → `ERR_OVERSPEND`
- Agent tries to send 2.5 NEAR to `rogue-34ee08e3.testnet`: [`5t3EwE…`](https://testnet.nearblocks.io/txns/5t3EwEnCNHZQYu9FW4XRF6tneNvn6R2LcmA6p2NaGktM) → `ERR_UNAPPROVED_DESTINATION`

**2. A real hire, end to end (NFT #2, Lagos Design Guild).**

| Step | Tx |
| --- | --- |
| Owner `miqvis111000.testnet` posts "3 taglines for a Lagos design guild", 0.05 NEAR | [`6g1pi6…`](https://testnet.nearblocks.io/txns/6g1pi65Fko2TZdoCzLwKHUpWUUW2b816PA8VVSL2G8PT) |
| Contributor `miqwrk111000.testnet` submits from a wallet | [`41YJFe…`](https://testnet.nearblocks.io/txns/41YJFe9xxmEK1RoMdqVjD21a83Dzn1QkuzXgwWqgHD11) |
| Agent scores 80/100 pass: "Found 3 distinct ideas that fit the topic." | [`8yuHkc…`](https://testnet.nearblocks.io/txns/8yuHkcxhcVqc6N8fA2xyUT8QVvztwFRBcFSbU8mWtqki) |
| Owner approves; 0.05 NEAR arrives at the contributor | [`EFms3t…`](https://testnet.nearblocks.io/txns/EFms3t35JR7oo2bJR58EUCLKLb49w19hGj1yZt6RdFti) |

This runs in-app on testnet. Posting the same job on the real [NEAR Agent Market](https://market.near.ai) costs real USD/USDC (no testnet exists); what that needs is in [`docs/AGENT_MARKET_LIVE.md`](docs/AGENT_MARKET_LIVE.md).

**3. Sell the business (NFT #3, Free Tester).**

| Step | Tx |
| --- | --- |
| Transfer without 1 yocto is rejected | [`CKvdkH…`](https://testnet.nearblocks.io/txns/CKvdkHbAmySXWL9K7bapSPw3vExJp9dn7rUaFB1wV4Xr) → `ERR_REQUIRES_ONE_YOCTO` |
| `miqvis111000.testnet` transfers #3 to `miqwrk111000.testnet` (`nft_transfer`, memo "Selling Free Tester") | [`3b3tNZ…`](https://testnet.nearblocks.io/txns/3b3tNZawZsg27vR9cT86grQvnsTkZeCzidK9bSpGN4Da) |
| Old owner tries to post a job → rejected | [`7tkdP5…`](https://testnet.nearblocks.io/txns/7tkdP54URSKkvs6RmMDYV6HXvSteKbRTuYSSej4E9wY) → `ERR_NOT_AGENT_OR_OWNER` |
| New owner posts a job from the same treasury | [`3RfF5i…`](https://testnet.nearblocks.io/txns/3RfF5inbR8wbn5oaLbpwtzHSdtPGKMguuWV5Kb1r6iqz) |

Contract upgraded in place for NEP-171 transfers (state preserved, checked): [`7F9a6B…`](https://testnet.nearblocks.io/txns/7F9a6Byor58iQ5hcX5PrFDmS9VVoiATBYzVCNWcCP8ku). Older txs (deploy, first demo, mint E2E): [`docs/TESTNET.md`](docs/TESTNET.md).

## What's on the site

- **Home:** what it is, how it works, a live on-chain activity feed and the three moments.
- **Mint** (`/mint`): name, mission, templates, rules as sliders and inputs, and a live sentence: "This NFT can never spend more than X per task or drop below Y."
- **Dashboard** (`/app/:id`): treasury, the loop in numbers (earned → spent → treasury now), reserve health, owner tools (post job, invest, harvest, top up, transfer), jobs with the agent's one-line reasoning, **Try to break the rules**, and this NFT's activity.
- **Résumé** (`/nft/:id`): a profile per NFT with jobs completed, spent, earned, contributors paid, reserve health and a work history where every item links to its transaction.
- **Leaderboard** (`/leaderboard`): all NFTs ranked by jobs completed, contributors paid, earnings and reserve health.

The activity feed comes from `/api/activity`: the NearBlocks v3 transaction list for the contract, each transaction's arguments and status from archival RPC, and current contract state. Failed transactions are included. If the indexer is down it falls back to contract state.

## Run it

Prerequisites: Rust stable with `wasm32-unknown-unknown`, Node 20+.

```bash
npm install
npm run test:contract          # 36 contract unit tests
npm run test:scorer            # scorer + NEAR AI fallback tests
npm run build:wasm             # res/mintiq.wasm, res/mintiq_yield_pool.wasm
npm run demo                   # full loop on a local NEAR sandbox
npm run dev:web                # site against testnet (APIs need Vercel or the env below)
bash scripts/build-deploy.sh   # site + /api functions into web/.deploy
cd web/.deploy && npx vercel deploy --prod
```

Serverless functions (`web/api-src/`): `/api/score` (public scoring), `/api/break` (rule-break demo), `/api/activity` (feed) and `/api/agent` (IronClaw relay, bearer token). They sign with the agent's function-call key from the `MINTIQ_AGENT_KEY` env var. `NEARAI_API_KEY` enables the NEAR AI Cloud judge (it currently returns HTTP 402, so live scores come from the labelled built-in fallback). Keys live in `.mintiq/` (gitignored) and Vercel env, never in the repo or browser.

Upgrading the testnet contract in place: `npm run build:wasm && node scripts/upgrade-testnet.mjs` (fails if demo token state changes).

## Layout

```
contracts/mintiq/      NFT + treasury + jobs + rules (near-sdk 5)
contracts/yield-pool/  Labelled demo yield destination
web/src/               React site (Vite, NEAR Wallet Selector)
web/api-src/           Vercel functions: score, break, activity, agent
app/src/               Agent, evaluator (NEAR AI + fallback), Agent Market simulation
ironclaw/              IronClaw extension packaging the agent
scripts/               build, deploy, testnet upgrade, E2E helpers, agent-market-live (dry run)
docs/                  PITCH, testnet log, Agent Market notes
```

## Honest status

| Piece | Status |
| --- | --- |
| Contract, wallet mint, hire/pay, invest/harvest, transfer | Live on testnet |
| Agent signer | Function-call key on Vercel (not a TEE) |
| Scoring | NEAR AI Cloud wired; key returns HTTP 402, so live scores are the built-in fallback and labelled so |
| Yield | Demo pool with simulated yield, labelled |
| Agent Market | Not posted (real money, no testnet); dry-run script and requirements in `docs/AGENT_MARKET_LIVE.md` |
| IronClaw | Extension runs locally with a small open model; Agent Market's managed IronClaw runtime is deprecated (see `ironclaw/README.md`) |

## License

Apache-2.0
