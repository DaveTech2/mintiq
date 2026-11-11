# Mintiq: 2-minute demo

**Opening line:** "AI agents can run businesses, but nobody owns them and nothing limits them."

Live site: https://mintiq-pink.vercel.app (NEAR testnet, free test NEAR, no real money).

## Setup (before you start)

- Tab 1: https://mintiq-pink.vercel.app (home)
- Tab 2: https://mintiq-pink.vercel.app/app/1 (Meme Studio dashboard)
- Tab 3: https://mintiq-pink.vercel.app/nft/2 (Lagos Design Guild résumé)
- Optional: a testnet wallet with a minted NFT, to show approve-and-pay and transfer live.

## Script (2:00)

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:12 | Home hero | "AI agents can run businesses, but nobody owns them and nothing limits them. Mintiq makes the business an NFT: it has a treasury, a mission and an agent, and the rules live in a NEAR contract." |
| 0:12–0:25 | Mint page: drag the sliders | "When you mint, you set the rules. The sentence updates live: this NFT can never spend more than X per task or drop below Y. Minting is free; you only pay storage in test NEAR." |
| **Moment 1** 0:25–0:55 | Dashboard #1 → **Try to break the rules** → click both buttons | "Let's make the agent misbehave. It tries to pay twice the task limit… blocked, `ERR_OVERSPEND`. Now it tries to send money to a random account… blocked, `ERR_UNAPPROVED_DESTINATION`. These are real transactions; here they are on NearBlocks, failed on-chain. The agent's key can't even move NEAR directly." |
| **Moment 2** 0:55–1:25 | Jobs list on #2, then the activity feed | "Here's a real hire on testnet. The owner posted a job, a contributor submitted from their wallet, the agent scored it 80 out of 100 and wrote why: 'Found 3 distinct ideas that fit the topic.' The owner approved, and 0.05 NEAR arrived. Nobody clicked to score it: the agent runs on its own every 15 minutes, posting jobs, scoring work and investing idle funds. You approve every payment. Every step is a transaction you can open." |
| 1:25–1:40 | Résumé #2 + leaderboard | "Each NFT builds a résumé: jobs done, spent, earned, contributors paid, reserve health, all linked on-chain. The leaderboard ranks every business by what it actually did." |
| **Moment 3** 1:40–1:55 | Dashboard: **Sell or transfer this business**, then the transfer in the feed | "And because it's an NFT, you can sell the business. A standard NEP-171 transfer moves the treasury, the track record and control of the agent to the buyer. The old owner is locked out; the contract rejected their next job post." |
| 1:55–2:00 | Home | "Mintiq: businesses you can own, run by agents you can trust, because the rules are on-chain." |

**Closing line:** "Mintiq: businesses you can own, run by agents you can trust, because the rules are on-chain."

## Proof links

- Rule break, overspend: https://testnet.nearblocks.io/txns/3KM6XaRKsJjvhmqsXmAsRxz9CcnYsEvCQjNAkku33fkM
- Rule break, unapproved account: https://testnet.nearblocks.io/txns/5t3EwEnCNHZQYu9FW4XRF6tneNvn6R2LcmA6p2NaGktM
- Hire: post https://testnet.nearblocks.io/txns/6g1pi65Fko2TZdoCzLwKHUpWUUW2b816PA8VVSL2G8PT · submit https://testnet.nearblocks.io/txns/41YJFe9xxmEK1RoMdqVjD21a83Dzn1QkuzXgwWqgHD11 · score https://testnet.nearblocks.io/txns/8yuHkcxhcVqc6N8fA2xyUT8QVvztwFRBcFSbU8mWtqki · pay https://testnet.nearblocks.io/txns/EFms3t35JR7oo2bJR58EUCLKLb49w19hGj1yZt6RdFti
- Hire scored by NEAR AI Cloud (90/100, `z-ai/glm-5.3-flash`): post https://testnet.nearblocks.io/txns/9CYEfjX8jgF3HGihBHnY1pLb1zZ93JYYTdiKzqHwpHqH · submit https://testnet.nearblocks.io/txns/3ojddKPcRWTeNQVC8Z57Abv4yyMfLQn7FbduwR3f9hrM · score https://testnet.nearblocks.io/txns/7VN7WXFJqR5tY9LkmeZqVFvGB4hqUPmgoCW4KYoWHcRh · pay https://testnet.nearblocks.io/txns/46cpaFBN7cUfAW21iwLWH59XbftxmaQNsrFFLjm8Lnzf
- Sale: transfer https://testnet.nearblocks.io/txns/3b3tNZawZsg27vR9cT86grQvnsTkZeCzidK9bSpGN4Da · old owner blocked https://testnet.nearblocks.io/txns/7tkdP54URSKkvs6RmMDYV6HXvSteKbRTuYSSej4E9wY · new owner posts https://testnet.nearblocks.io/txns/3RfF5inbR8wbn5oaLbpwtzHSdtPGKMguuWV5Kb1r6iqz

## If something fails live

- Rule-break button says "Slow down": it is rate-limited to one try per 20 s; wait or show the proof links above.
- Activity feed empty: the indexer is down; the feed falls back to contract state (no tx links). Use the proof links.
- Wallet popup blocked: show the CLI-recorded txs above; they are the same calls the wallet sends.
