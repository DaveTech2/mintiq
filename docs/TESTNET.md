# Mintiq on NEAR testnet

Public contract IDs, explorer links, and transaction hashes from the 10 Nov 2026 (Africa/Lagos) deploy. **No private keys.** The scripted demo used the built-in rule-based scorer (no LLM). Live NEAR AI Cloud judging was not exercised.

Live dashboard (read-only, public): https://mintiq-pink.vercel.app

RPC used for the completed writes: `https://test.rpc.fastnear.com` (`rpc.testnet.near.org` returned a deprecated `-429` mid-demo, so later transactions were sent through FastNear).

## Accounts

| Role | Account | Explorer |
| --- | --- | --- |
| Treasury / NFT contract | `mintiq7f109e53.testnet` | [nearblocks](https://testnet.nearblocks.io/address/mintiq7f109e53.testnet) |
| Demo yield pool | `yld.mintiq7f109e53.testnet` | [nearblocks](https://testnet.nearblocks.io/address/yld.mintiq7f109e53.testnet) |
| Owner | `own.mintiq7f109e53.testnet` | [nearblocks](https://testnet.nearblocks.io/address/own.mintiq7f109e53.testnet) |
| Agent | `miqagt7f109e53.testnet` | [nearblocks](https://testnet.nearblocks.io/address/miqagt7f109e53.testnet) |
| Contributor | `wrk.mintiq7f109e53.testnet` | [nearblocks](https://testnet.nearblocks.io/address/wrk.mintiq7f109e53.testnet) |

Demo NFT token id: `1` (Meme Studio, $100 treasury at the fixed $2.00 / NEAR demo rate).

## Scorer results (on-chain)

- Good submission (5 meme concepts): **95**, pass. Parsed brief as 5 meme ideas. Found 5 distinct caption/punchline ideas that fit the topic. Pass (score 95 ≥ 70). Scorer: Built-in rule-based scorer (no LLM).
- Off-topic lasagna recipe: **0**, fail. Parsed brief as 5 meme ideas. Found only 0 distinct meme ideas (5 required items missing). 1 item is too short to count. "meme" appears as a negation or meta-text, not as delivered work. Submission contains off-topic content (for example a recipe or unrelated notes). Fail (score 0 < 70). Scorer: Built-in rule-based scorer (no LLM).

## Track record after invest / harvest

- Jobs completed: 1
- Contributors hired: 1
- Total spent: $5.00
- Total earned (labelled demo yield, not real staking): $3.75
- Liquid: $22.63
- Invested: $75.00

## Transactions

| Step | Result | Hash | Explorer |
| --- | --- | --- | --- |
| Top up parent from miqfuel57f109e53.testnet (9.8000 NEAR) | PASS | `CjmDZdgfNkAVVZ1HtcNQf2DB5eoijL7ydsiXRk9ZRJ3N` | [nearblocks](https://testnet.nearblocks.io/txns/CjmDZdgfNkAVVZ1HtcNQf2DB5eoijL7ydsiXRk9ZRJ3N) · [explorer](https://explorer.testnet.near.org/transactions/CjmDZdgfNkAVVZ1HtcNQf2DB5eoijL7ydsiXRk9ZRJ3N) |
| Top up parent from miqfuel67f109e53.testnet (9.8000 NEAR) | PASS | `9STAVKqZwRPScuNxEVG2cPUksbqdX6GmkfgdVs9yvGxS` | [nearblocks](https://testnet.nearblocks.io/txns/9STAVKqZwRPScuNxEVG2cPUksbqdX6GmkfgdVs9yvGxS) · [explorer](https://explorer.testnet.near.org/transactions/9STAVKqZwRPScuNxEVG2cPUksbqdX6GmkfgdVs9yvGxS) |
| Top up parent from miqfuel77f109e53.testnet (9.8000 NEAR) | PASS | `9iDgwdyh5hSFX4284tWz8vqcJkNn3ZkTMv9pJW5GWNEx` | [nearblocks](https://testnet.nearblocks.io/txns/9iDgwdyh5hSFX4284tWz8vqcJkNn3ZkTMv9pJW5GWNEx) · [explorer](https://explorer.testnet.near.org/transactions/9iDgwdyh5hSFX4284tWz8vqcJkNn3ZkTMv9pJW5GWNEx) |
| Create yield subaccount yld.mintiq7f109e53.testnet | PASS | `4ukLFwJ5WBp6fEENJde9fNwMm5F1ryhPkYUmTDugjrKw` | [nearblocks](https://testnet.nearblocks.io/txns/4ukLFwJ5WBp6fEENJde9fNwMm5F1ryhPkYUmTDugjrKw) · [explorer](https://explorer.testnet.near.org/transactions/4ukLFwJ5WBp6fEENJde9fNwMm5F1ryhPkYUmTDugjrKw) |
| Create owner subaccount own.mintiq7f109e53.testnet | PASS | `DG1FviVu3UkpDTUuoiCFnSQ2H9VWqyUHtvoAa3RHtH2Q` | [nearblocks](https://testnet.nearblocks.io/txns/DG1FviVu3UkpDTUuoiCFnSQ2H9VWqyUHtvoAa3RHtH2Q) · [explorer](https://explorer.testnet.near.org/transactions/DG1FviVu3UkpDTUuoiCFnSQ2H9VWqyUHtvoAa3RHtH2Q) |
| Create contributor subaccount wrk.mintiq7f109e53.testnet | PASS | `6Kx4gFD8Qzj6K1S7vJFattpVkDoqrJiceZUdXeCwHhoj` | [nearblocks](https://testnet.nearblocks.io/txns/6Kx4gFD8Qzj6K1S7vJFattpVkDoqrJiceZUdXeCwHhoj) · [explorer](https://explorer.testnet.near.org/transactions/6Kx4gFD8Qzj6K1S7vJFattpVkDoqrJiceZUdXeCwHhoj) |
| Deploy yield pool wasm | PASS | `GAJ8yzTaoEMdERUAGC9tYZMHwWwumh1EvuhqX35DhUB5` | [nearblocks](https://testnet.nearblocks.io/txns/GAJ8yzTaoEMdERUAGC9tYZMHwWwumh1EvuhqX35DhUB5) · [explorer](https://explorer.testnet.near.org/transactions/GAJ8yzTaoEMdERUAGC9tYZMHwWwumh1EvuhqX35DhUB5) |
| Init yield pool (new) | PASS | `Ca2krSApZfXtzmSgomSQNbgtq9ybw8ZhztPLL28ztNHJ` | [nearblocks](https://testnet.nearblocks.io/txns/Ca2krSApZfXtzmSgomSQNbgtq9ybw8ZhztPLL28ztNHJ) · [explorer](https://explorer.testnet.near.org/transactions/Ca2krSApZfXtzmSgomSQNbgtq9ybw8ZhztPLL28ztNHJ) |
| Deploy Mintiq treasury/NFT wasm | PASS | `6tRgSDN2HGiB7xu8EmwJEwvrRGw7Ca1QcPAK7f2fUkHS` | [nearblocks](https://testnet.nearblocks.io/txns/6tRgSDN2HGiB7xu8EmwJEwvrRGw7Ca1QcPAK7f2fUkHS) · [explorer](https://explorer.testnet.near.org/transactions/6tRgSDN2HGiB7xu8EmwJEwvrRGw7Ca1QcPAK7f2fUkHS) |
| Init Mintiq (new) | PASS | `CsSP8gpMVjDVQTBDjVNDEJUsv4Vut5TtjtbudZJVuxx4` | [nearblocks](https://testnet.nearblocks.io/txns/CsSP8gpMVjDVQTBDjVNDEJUsv4Vut5TtjtbudZJVuxx4) · [explorer](https://explorer.testnet.near.org/transactions/CsSP8gpMVjDVQTBDjVNDEJUsv4Vut5TtjtbudZJVuxx4) |
| Add agent function-call key limited to Mintiq agent methods | PASS | `CG8wWdhVhShYgRwMwzUCNrBpaiboG8D8x3Sh793CZqYH` | [nearblocks](https://testnet.nearblocks.io/txns/CG8wWdhVhShYgRwMwzUCNrBpaiboG8D8x3Sh793CZqYH) · [explorer](https://explorer.testnet.near.org/transactions/CG8wWdhVhShYgRwMwzUCNrBpaiboG8D8x3Sh793CZqYH) |
| Mint Meme Studio NFT with $100 treasury | PASS | `Cj7jMwHAcF1ETx4vbQG6KrhgFXg3sM7PC5sKzZrqGC6E` | [nearblocks](https://testnet.nearblocks.io/txns/Cj7jMwHAcF1ETx4vbQG6KrhgFXg3sM7PC5sKzZrqGC6E) · [explorer](https://explorer.testnet.near.org/transactions/Cj7jMwHAcF1ETx4vbQG6KrhgFXg3sM7PC5sKzZrqGC6E) |
| Agent function-call key cannot transfer NEAR (protocol rejection) | PASS | `4UUdc5bbh3qR3bq6Zze2utqo74je4x8xsYfA5VBdswdD` | [nearblocks](https://testnet.nearblocks.io/txns/4UUdc5bbh3qR3bq6Zze2utqo74je4x8xsYfA5VBdswdD) · [explorer](https://explorer.testnet.near.org/transactions/4UUdc5bbh3qR3bq6Zze2utqo74je4x8xsYfA5VBdswdD) |
| Agent function-call key cannot call the yield pool | PASS | `2kRzU1R7rj1gyvKg8HsErTXjpAa5dQBZ4SvJpMp8UAtU` | [nearblocks](https://testnet.nearblocks.io/txns/2kRzU1R7rj1gyvKg8HsErTXjpAa5dQBZ4SvJpMp8UAtU) · [explorer](https://explorer.testnet.near.org/transactions/2kRzU1R7rj1gyvKg8HsErTXjpAa5dQBZ4SvJpMp8UAtU) |
| Contract rejects a $6 job (max per task is $5) — ERR_OVERSPEND | PASS | `2teQzuMFHJDCJgDyFLsGoQJFrkC96E3Mbb4PXdA6H9iy` | [nearblocks](https://testnet.nearblocks.io/txns/2teQzuMFHJDCJgDyFLsGoQJFrkC96E3Mbb4PXdA6H9iy) · [explorer](https://explorer.testnet.near.org/transactions/2teQzuMFHJDCJgDyFLsGoQJFrkC96E3Mbb4PXdA6H9iy) |
| Agent posted job "5 original memes, $5" | PASS | `3tGbsDAxW135p96cHwmuYbsGsWGCGpehSnC4oEnmbLf2` | [nearblocks](https://testnet.nearblocks.io/txns/3tGbsDAxW135p96cHwmuYbsGsWGCGpehSnC4oEnmbLf2) · [explorer](https://explorer.testnet.near.org/transactions/3tGbsDAxW135p96cHwmuYbsGsWGCGpehSnC4oEnmbLf2) |
| Contributor submitted the good meme set | PASS | `GCyQZmrzrmdBfEcKyHoANgCXjfJhm7N9TuyVDuoUpAei` | [nearblocks](https://testnet.nearblocks.io/txns/GCyQZmrzrmdBfEcKyHoANgCXjfJhm7N9TuyVDuoUpAei) · [explorer](https://explorer.testnet.near.org/transactions/GCyQZmrzrmdBfEcKyHoANgCXjfJhm7N9TuyVDuoUpAei) |
| Contributor submitted the off-topic lasagna text | PASS | `F1VjMT6bt4Awf7aa61svyGviEs7Yz4DuFYe4Q9mNmmAw` | [nearblocks](https://testnet.nearblocks.io/txns/F1VjMT6bt4Awf7aa61svyGviEs7Yz4DuFYe4Q9mNmmAw) · [explorer](https://explorer.testnet.near.org/transactions/F1VjMT6bt4Awf7aa61svyGviEs7Yz4DuFYe4Q9mNmmAw) |
| Owner approved and paid the good submission | PASS | `HNtmwKDMSmDLEozXDNTyx7winkyJKMZWDkMAoT36mN4C` | [nearblocks](https://testnet.nearblocks.io/txns/HNtmwKDMSmDLEozXDNTyx7winkyJKMZWDkMAoT36mN4C) · [explorer](https://explorer.testnet.near.org/transactions/HNtmwKDMSmDLEozXDNTyx7winkyJKMZWDkMAoT36mN4C) |
| Accrue 5% demo yield (labelled, not real staking) | PASS | `CNAw7cxJ8UVuurtHKhj6bpev1DK3Ku8fU5BhdBcD4A1B` | [nearblocks](https://testnet.nearblocks.io/txns/CNAw7cxJ8UVuurtHKhj6bpev1DK3Ku8fU5BhdBcD4A1B) · [explorer](https://explorer.testnet.near.org/transactions/CNAw7cxJ8UVuurtHKhj6bpev1DK3Ku8fU5BhdBcD4A1B) |
| Harvest demo yield back to the treasury | PASS | `5AN8EgEz89zDjCZSmdQieeDHGMhg7sPghgC5HLmCQj9a` | [nearblocks](https://testnet.nearblocks.io/txns/5AN8EgEz89zDjCZSmdQieeDHGMhg7sPghgC5HLmCQj9a) · [explorer](https://explorer.testnet.near.org/transactions/5AN8EgEz89zDjCZSmdQieeDHGMhg7sPghgC5HLmCQj9a) |
| Agent recorded score for submission 1 | PASS | `DgYtpHbrtq5c569pnwVbJQ4m9TjwgjqJYMx8RWhwvnVz` | [nearblocks](https://testnet.nearblocks.io/txns/DgYtpHbrtq5c569pnwVbJQ4m9TjwgjqJYMx8RWhwvnVz) · [explorer](https://explorer.testnet.near.org/transactions/DgYtpHbrtq5c569pnwVbJQ4m9TjwgjqJYMx8RWhwvnVz) |
| Agent recorded score for submission 2 | PASS | `HTQca4fZFFYHggcbLWxbL7bCA6sBv1xbnHkUi9QWybdv` | [nearblocks](https://testnet.nearblocks.io/txns/HTQca4fZFFYHggcbLWxbL7bCA6sBv1xbnHkUi9QWybdv) · [explorer](https://explorer.testnet.near.org/transactions/HTQca4fZFFYHggcbLWxbL7bCA6sBv1xbnHkUi9QWybdv) |
| Invest idle $75.00 in demo yield pool | PASS | `DCayzHcGZb3NVxmvABmJcKBTdmKXauXmuSSta6VerjsR` | [nearblocks](https://testnet.nearblocks.io/txns/DCayzHcGZb3NVxmvABmJcKBTdmKXauXmuSSta6VerjsR) · [explorer](https://explorer.testnet.near.org/transactions/DCayzHcGZb3NVxmvABmJcKBTdmKXauXmuSSta6VerjsR) |

## v2: public minting with a wallet (10 Nov 2026)

The contract was redeployed **in place** at `mintiq7f109e53.testnet` (same borsh state layout, token #1 unchanged). The upgrade tx is the first row below.

What changed:

- `mint` is public. Any testnet account can mint with a small deposit (1–2 NEAR is plenty). The caller becomes the owner and the deposit becomes that token's treasury.
- The **owner or the token's agent** can `post_job`, `invest_idle`, `harvest`, and `demo_accrue` on that token. Every cap still applies (`ERR_OVERSPEND`, `ERR_RESERVE`, `ERR_UNAPPROVED_DESTINATION`).
- Only the **agent** can `record_evaluation`, so an owner cannot score their own jobs (`ERR_NOT_AGENT`). Only the **owner** can `approve_and_pay`, and only on their own token (`ERR_NOT_OWNER`).
- There are length caps on names, missions, briefs, and submissions, plus at most 5 approved destinations, 10 open jobs, and 20 submissions per job.

### Fresh-account E2E (faucet accounts, near-cli-rs)

- Visitor/owner: `miqvis111000.testnet`. It minted **token #2 "Lagos Design Guild"**: 1.5 NEAR treasury, 0.1 NEAR max per task, 0.5 NEAR reserve, 70/30 split.
- Contributor/stranger: `miqwrk111000.testnet`.
- Scoring for visitors goes through `POST https://mintiq-pink.vercel.app/api/score`. It runs the built-in rule-based scorer and signs `record_evaluation` with the agent's function-call key, which is held server-side and cannot transfer NEAR.

| Step | Signer | Result | Tx |
| --- | --- | --- | --- |
| Upgrade Mintiq contract to v2 (public mint, owner-run treasury ops, size caps) |  | ok | [`5Ur8VFwjQr…`](https://testnet.nearblocks.io/txns/5Ur8VFwjQrCWsKrrB8yCwNP6FyZPsKtNU8acHurshzCi) |
| Visitor mints 'Lagos Design Guild' (custom name + mission, 1.5 NEAR treasury) | miqvis111000.testnet | ok | [`FxZN4LvUWJ…`](https://testnet.nearblocks.io/txns/FxZN4LvUWJaiNWzokvjN1WPTogRXgnwpPPPNF2iyiPaY) |
| Visitor (owner) posts job '3 taglines for a design studio' at 0.05 NEAR | miqvis111000.testnet | ok | [`FLW2ymycpy…`](https://testnet.nearblocks.io/txns/FLW2ymycpy2TzzfW8UoAGHqCGWKzAnykCPyyKHkEh4cJ) |
| Visitor tries a 0.2 NEAR job (max per task 0.1) — ERR_OVERSPEND | miqvis111000.testnet | expected rejection `ERR_OVERSPEND` | [`3W4NRxTdwg…`](https://testnet.nearblocks.io/txns/3W4NRxTdwg3BN8c4FGwkRbmTKsbvA2iBArRf5cDqqFNH) |
| Stranger (contributor account) tries to post a job on token 2 — ERR_NOT_AGENT_OR_OWNER | miqwrk111000.testnet | expected rejection `ERR_NOT_AGENT_OR_OWNER` | [`Dp49j91z9c…`](https://testnet.nearblocks.io/txns/Dp49j91z9cQkbWQKPPKgzvzDa4DnqV4nhzPL1L5q5m9f) |
| Contributor submits 3 taglines | miqwrk111000.testnet | ok | [`8HCXuP6zod…`](https://testnet.nearblocks.io/txns/8HCXuP6zod3Fb7Mk4CG67XnMKEUdcVMEZEJyn4KuxJvU) |
| Contributor submits off-topic lasagna recipe | miqwrk111000.testnet | ok | [`ErKnwzwSeL…`](https://testnet.nearblocks.io/txns/ErKnwzwSeLLQg2jUYheCN8bQQti9aAFiouxxWteu3SJi) |
| Owner tries to score own submission — ERR_NOT_AGENT (only the agent judges) | miqvis111000.testnet | expected rejection `ERR_NOT_AGENT` | [`wYJyHqespA…`](https://testnet.nearblocks.io/txns/wYJyHqespAMzzuvdonbZS3xRce1vksLPHfKGF6Sh3ip) |
| Visitor tries to pay from demo token #1 — ERR_NOT_OWNER | miqvis111000.testnet | expected rejection `ERR_NOT_OWNER` | [`5e6p3Nkkie…`](https://testnet.nearblocks.io/txns/5e6p3Nkkie8oNW2XMeYYBUQ6KfFmHJYHZqKyF1w5QTL2) |
| Owner tries to pay an unscored submission — ERR_NOT_EVALUATED | miqvis111000.testnet | expected rejection `ERR_NOT_EVALUATED` | [`5umQjn9PY1…`](https://testnet.nearblocks.io/txns/5umQjn9PY1DFK1QXix1BoxXRipLPLR4WT8jknddS44VW) |
| Agent scored submission 1 = 80 (pass) via live https://mintiq-pink.vercel.app/api/score (function-call key) | miqagt7f109e53.testnet | ok | [`F2nsxgQy6J…`](https://testnet.nearblocks.io/txns/F2nsxgQy6J1kqRxqJbcjjyRLW5ChhnbmCMnRvESVVyVT) |
| Agent scored submission 2 = 0 (fail) via live https://mintiq-pink.vercel.app/api/score (function-call key) | miqagt7f109e53.testnet | ok | [`AnAH8wccuK…`](https://testnet.nearblocks.io/txns/AnAH8wccuK8kMp4X5maaFzXDYrMi6WnM4Jp68tVs9uZS) |
| Stranger tries to approve & pay on token 2 — ERR_NOT_OWNER | miqwrk111000.testnet | expected rejection `ERR_NOT_OWNER` | [`8o7pDvV6gR…`](https://testnet.nearblocks.io/txns/8o7pDvV6gRPr2E4qynPeyCDdjzyjSkczCRuznR3GuTKw) |
| Owner approves & pays the 80-score taglines (0.05 NEAR to contributor) | miqvis111000.testnet | ok | [`96z3AAjkFj…`](https://testnet.nearblocks.io/txns/96z3AAjkFjBShpgcCSJKJ7umRqSdQokdnJD83Dh7Y4oZ) |
| Owner tries to invest to an unapproved account — ERR_UNAPPROVED_DESTINATION | miqvis111000.testnet | expected rejection `ERR_UNAPPROVED_DESTINATION` | [`3BKj3GX65W…`](https://testnet.nearblocks.io/txns/3BKj3GX65WevMKx81cr4WVAF2yz4xXRb7f4rT8TxNZSB) |
| Owner tries to invest 1.0 NEAR (would breach 0.5 reserve) — ERR_RESERVE | miqvis111000.testnet | expected rejection `ERR_RESERVE` | [`6FzPx7SrSv…`](https://testnet.nearblocks.io/txns/6FzPx7SrSv9S5kAUZqg1mxVBc4LyMExdRXFDV6DWL9Xi) |
| Owner invests 0.9 NEAR idle in the demo yield pool | miqvis111000.testnet | ok | [`2cMwJiPcCf…`](https://testnet.nearblocks.io/txns/2cMwJiPcCfCb9DEaF5GLoGmQgeHGwxwyLVQMNUrNvBnw) |
| Owner accrues 5% labelled demo yield | miqvis111000.testnet | ok | [`AL3iabbvXB…`](https://testnet.nearblocks.io/txns/AL3iabbvXBj164U3R2h5oqb6eCYKrosnwYXBk3kKxLtw) |
| Owner harvests demo yield (70% treasury / 30% owner) | miqvis111000.testnet | ok | [`FWBM919BD2…`](https://testnet.nearblocks.io/txns/FWBM919BD2FPhUNskTYxwrVZw999MXZQ7RnxnQhsZAXW) |
| Owner posts job 2 '3 slogans for a print shop' (0.05 NEAR) for the IronClaw cycle | miqvis111000.testnet | ok | [`5PNoxHq8s8…`](https://testnet.nearblocks.io/txns/5PNoxHq8s8tR3ktSrtZpYta9RJx9AS3z91mjjkDX2dta) |
| Contributor submits 3 slogans to job 2 | miqwrk111000.testnet | ok | [`FN3jpnEGXa…`](https://testnet.nearblocks.io/txns/FN3jpnEGXaR6qJSgSnPBFUuXz2xZuJG9w3hihYjS2Nk3) |

The wallet path in the dashboard sends the same calls and deposits as near-cli. It was checked headless: the selector modal lists MyNearWallet, Meteor, HERE, and Intear, and MyNearWallet opens `testnet.mynearwallet.com/login` for `mintiq7f109e53.testnet`. Approving a wallet sign-in needs a human, so the signed writes above were made with near-cli on the same accounts.

## v2.1: free to try, NEAR AI judge with fallback (10 Nov 2026)

- **Free mint.** There is no mint fee. `mint` charges only the storage the new token actually uses (measured on-chain, about 0.004 NEAR for a short mission). Everything else attached becomes the treasury, so a treasury of 0 with a reserve of 0 is valid. The site attaches the chosen treasury (default 0.1 test NEAR) plus a 0.02 storage allowance, and any unused allowance goes into the treasury. Free test NEAR: https://docs.near.org/getting-started/faucet
- **`fund(token_id)`.** Anyone can top up a treasury. The dashboard has an "Add funds" field.
- **Evaluator.** When `NEARAI_API_KEY` is set (it is set on Vercel), NEAR AI Cloud `z-ai/glm-5.3-flash` is tried first. On any error it falls back to the built-in rule-based scorer. Each submission's on-chain `evaluator` field records which scorer was used, and the dashboard shows it as "Scored by …". `NEARAI_JUDGE=0` forces the built-in scorer.
- **Live check (10 Nov 2026, about 11:55 WAT).** The existing key still returns **HTTP 402** `no_limit_configured` ("No spending limit configured"). Production therefore records `Built-in rule-based scorer (no LLM); NEAR AI fallback (HTTP 402)`.

| Step | Signer | Result | Tx |
| --- | --- | --- | --- |
| Upgrade to v2.1: free mint (storage only), fund() top-up | mintiq7f109e53.testnet | ok | [`69Ua9y4UJX…`](https://testnet.nearblocks.io/txns/69Ua9y4UJXCXg17rY6pgZMeu6iNjxQ4bYebQgFjkmNBJ) |
| Free mint: visitor mints 'Free Tester' with only 0.02 NEAR (storage; treasury ~0.01) | miqvis111000.testnet | ok | [`4iXbrATVdM…`](https://testnet.nearblocks.io/txns/4iXbrATVdMakH4W63yTa1F2vvoKbruLWPgwC3TkZeGH8) |
| Contributor tops up token #3 with fund() 0.1 NEAR | miqwrk111000.testnet | ok | [`23bhy66sgu…`](https://testnet.nearblocks.io/txns/23bhy66sguwF3ViKdrYSCXPCZxKQNoiYJKUfj4f3g2Rm) |
| Owner posts job on free token #3 (0.01 NEAR) | miqvis111000.testnet | ok | [`EmVf5vavzM…`](https://testnet.nearblocks.io/txns/EmVf5vavzMsS3MNX715DyG8eY7wYhBMv8FGtp8vXgACX) |
| Contributor submits taglines to token #3 | miqwrk111000.testnet | ok | [`5JKy3UsFST…`](https://testnet.nearblocks.io/txns/5JKy3UsFSTkhc8XFzwNqUDA8GY5WhYsBCPH6syLvCmeF) |
| Live /api/score on token #3: NEAR AI Cloud tried, HTTP 402, built-in fallback recorded (score 80 pass) | miqagt7f109e53.testnet | ok | [`FrDnhL5cvw…`](https://testnet.nearblocks.io/txns/FrDnhL5cvwBsdKSGi8TTdDRhFBxFEmFUjYwEQZqe9FrH) |
| IronClaw (local, qwen2.5-3b via Ollama) mintiq.score_submission: token #2 job 2 sub 1 = 80 pass | miqagt7f109e53.testnet | ok | [`5fUxtHFgLa…`](https://testnet.nearblocks.io/txns/5fUxtHFgLad3vcEMD9tdGunBPtf7r2H8sCqHDqHs2aBH) |

### IronClaw (local) on-chain action



## What a public visitor can do

With a testnet wallet (MyNearWallet, Meteor, HERE, or Intear) on https://mintiq-pink.vercel.app:

- Mint their own Mintiq **for free**: there is no mint fee, only about 0.004 NEAR of storage, paid in free test NEAR. They set a custom name, mission, treasury (0 is fine), max per task, reserve floor, and reinvest/owner split. Templates only prefill the form. The approved destination is the labelled demo pool.
- See it in the dashboard picker (use "Only mine" to filter).
- As owner: post jobs, ask the agent to score submissions, approve and pay a passing submission, invest idle funds above the reserve, and accrue and harvest the labelled 5% demo yield.
- As anyone: submit work to any open job.

Without a wallet, a visitor can view all live NFT state, jobs, scores, and explorer links.

A visitor still cannot:

- Score submissions themselves. Only the agent records scores.
- Pay out of someone else's treasury, or invest outside the approved list.
- Use a live Agent Market job. That is still a local simulation, because the market has no testnet.
