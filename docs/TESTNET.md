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

## What a public visitor can do

- View live contract state (NFT, treasury, jobs, scores, track record) via testnet RPC
- Follow explorer links for every recorded transaction

They cannot:

- Mint, post, submit, score, approve, pay, invest, or harvest from the public dashboard (no keys in the browser)
- Use a live Agent Market job (still a local simulation only; the market has no testnet)

