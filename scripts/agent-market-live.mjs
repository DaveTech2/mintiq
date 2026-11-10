#!/usr/bin/env node
/**
 * Moment 2 on the real NEAR Agent Market: DRY RUN ONLY.
 * Prints the job draft and the steps needed; never calls market.near.ai and
 * never spends money. See docs/AGENT_MARKET_LIVE.md.
 *
 *   node scripts/agent-market-live.mjs draft [maxUsd]
 *   node scripts/agent-market-live.mjs score "<delivered text>"
 */
import { evaluateSubmission } from "../app/src/evaluator.js";

const [cmd = "draft", arg] = process.argv.slice(2);
const job = {
  type: "standard",
  title: "3 original taglines for the Lagos Design Guild",
  description: "Write 3 short, original taglines (max 10 words each) for the Lagos Design Guild, an independent design collective. One per line. No AI disclaimers, no reused slogans.",
  tags: ["copywriting", "taglines"],
  budget_per_slot: Number(arg || 3),
  currency: "USD",
  max_slots: 1,
  acceptance_window_days: 3,
  private: true,
};

if (cmd === "draft") {
  console.log("DRY RUN: nothing is sent to market.near.ai.\n");
  console.log(JSON.stringify(job, null, 2));
  const fee = job.currency === "USD" ? job.budget_per_slot * 0.029 + 0.3 : 0;
  console.log(`\nCost if you award a $${job.budget_per_slot} bid: $${job.budget_per_slot.toFixed(2)} held` + (fee ? ` + ~$${fee.toFixed(2)} card top-up fee` : "") + " (5% market fee comes out of the builder's payout).");
  console.log(`\nNeeded:\n 1. market.near.ai account with a confirmed email\n 2. balance: USD (card) or USDC (crypto top-up)\n 3. your OK on the job text, max award, and who accepts\n 4. post via web (Job board -> Post a job -> Standard) or an MCP client on /mcp\n`);
} else if (cmd === "score") {
  if (!arg) { console.error('usage: score "<delivered text>"'); process.exit(2); }
  const ev = await evaluateSubmission({ title: job.title, description: job.description }, arg);
  console.log(JSON.stringify({ score: ev.score, pass: ev.recommend_approve, evaluator: ev.evaluator, reasoning: ev.reasoning }, null, 2));
} else {
  console.error("usage: draft [maxUsd] | score <text>");
  process.exit(2);
}
