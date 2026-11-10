#!/usr/bin/env node
/**
 * Scripted Mintiq end-to-end demo.
 *
 * Prints account IDs, USD amounts, and pass/fail lines.
 * Never prints private keys or seed phrases.
 */
import { bootSandbox } from "../app/src/sandbox.js";
import { evaluateSubmission } from "../app/src/evaluator.js";
import {
  simPostJob,
  simBid,
  simAward,
  simSubmit,
  simAccept,
  marketStatus,
} from "../app/src/agent-market.js";
import {
  USD_PER_NEAR,
  RATE_LABEL,
  usdToYocto,
  yoctoToUsd,
  formatUsd,
  formatNear,
} from "../app/src/money.js";

const STORAGE_BUFFER = "50000000000000000000000"; // 0.05 NEAR
const serve = process.argv.includes("--serve");

function log(title, data) {
  console.log(`\n== ${title} ==`);
  if (typeof data === "string") console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

function redact(err) {
  return String(err?.message || err)
    .replace(/ed25519:[A-Za-z0-9]+/g, "ed25519:[redacted]")
    .replace(/private_key":\s*"[^"]+"/g, 'private_key":"[redacted]"');
}

async function expectFail(label, fn) {
  try {
    await fn();
    console.log(`FAIL  ${label}: expected a rejection, but the call succeeded`);
    return { ok: false, label, error: "succeeded unexpectedly" };
  } catch (err) {
    const error = redact(err);
    console.log(`PASS  ${label}`);
    console.log(`      ${error.split("\n")[0].slice(0, 240)}`);
    return { ok: true, label, error };
  }
}

async function main() {
  console.log("Mintiq e2e demo");
  console.log(RATE_LABEL);
  console.log("Treasury example: $100  →  50 NEAR");
  console.log("Max per task:     $5    →   2.5 NEAR");
  console.log("Reserve:          $20   →  10 NEAR");

  const boot = await bootSandbox();
  const { accounts, cfg, connectLimited } = boot;
  const { mintiq, yieldPool, owner, agent, contributor } = accounts;

  log("Network", {
    mode: "NEAR workspaces sandbox (local). Not testnet, not mainnet.",
    rpc: cfg.rpc,
    mintiq: cfg.contracts.mintiq,
    yieldPool: cfg.contracts.yieldPool,
    owner: cfg.accounts.owner.accountId,
    agent: cfg.accounts.agent.accountId,
    contributor: cfg.accounts.contributor.accountId,
    agentKey: "function-call access key, methods: " + cfg.accounts.agent.allowedMethods.join(", "),
  });

  const treasuryYocto = usdToYocto(100);
  const deposit = (BigInt(treasuryYocto) + BigInt(STORAGE_BUFFER)).toString();

  const tokenId = await owner.call(
    mintiq,
    "mint",
    {
      name: "Meme Studio",
      mission: "build a meme production business",
      agent_id: agent.accountId,
      max_per_task: usdToYocto(5),
      min_reserve: usdToYocto(20),
      reinvest_bps: 7000,
      owner_share_bps: 3000,
      approved_destinations: [yieldPool.accountId],
    },
    { attachedDeposit: BigInt(deposit), gas: 50_000_000_000_000n }
  );
  log("Minted NFT", { tokenId, treasury: formatUsd(100), depositNear: formatNear(deposit) });

  // ── Demo moment 1: limited key cannot transfer ──────────────────────────
  const limited = await connectLimited();
  const transferAttempt = await expectFail(
    "Agent function-call key cannot transfer NEAR (protocol rejection)",
    async () => {
      await limited.account.sendMoney(contributor.accountId, BigInt(usdToYocto(1)));
    }
  );

  // ── Demo moment 2: limited key cannot call another contract ─────────────
  const otherContractAttempt = await expectFail(
    "Agent function-call key cannot call the yield pool (or any non-allowlisted contract)",
    async () => {
      await limited.account.functionCall({
        contractId: yieldPool.accountId,
        methodName: "deposit",
        args: { token_id: String(tokenId) },
        gas: 30_000_000_000_000n,
        attachedDeposit: BigInt(usdToYocto(1)),
      });
    }
  );

  // ── Demo moment 3: contract rejects overspend ───────────────────────────
  // Post a legal $5 job first using the limited key through workspaces?
  // workspaces agent account still has its full key; use near-api limited account.
  const overspendAttempt = await expectFail(
    "Contract rejects a $6 job (max per task is $5) — ERR_OVERSPEND",
    async () => {
      await limited.account.functionCall({
        contractId: mintiq.accountId,
        methodName: "post_job",
        args: {
          token_id: String(tokenId),
          title: "6 original memes",
          description: "This budget is over the max per task.",
          budget: usdToYocto(6),
        },
        gas: 30_000_000_000_000n,
        attachedDeposit: 0n,
      });
    }
  );

  // ── Happy path: post $5 job with the limited key ────────────────────────
  await limited.account.functionCall({
    contractId: mintiq.accountId,
    methodName: "post_job",
    args: {
      token_id: String(tokenId),
      title: "5 original memes, $5",
      description: "Deliver 5 original meme concepts for the studio. Budget $5.",
      budget: usdToYocto(5),
    },
    gas: 30_000_000_000_000n,
    attachedDeposit: 0n,
  });
  log("Agent posted job", { title: "5 original memes, $5", budget: formatUsd(5) });

  const memes = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.
3. "Reserve floor, comedy ceiling" — a bouncer at a club named $20.
4. "Yield, then punchline" — a staking pool telling dad jokes.
5. "Owner signs, agent suggests" — two stamps: SCORE 88 and PAY.`;

  await contributor.call(mintiq, "submit_work", {
    token_id: String(tokenId),
    job_id: 1,
    content: memes,
  });

  const jobBrief = { title: "5 original memes, $5", description: "Deliver 5 original meme concepts" };
  const offTopic = `Here is my lasagna recipe.
Boil 12 sheets of pasta, brown a pound of ground beef with onion,
layer with ricotta and tomato sauce, bake at 375°F for 45 minutes.
I also fixed a typo in the office Wi-Fi password documentation.
This has nothing to do with memes.`;

  await contributor.call(mintiq, "submit_work", {
    token_id: String(tokenId),
    job_id: 1,
    content: offTopic,
  });

  const ev = await evaluateSubmission(jobBrief, memes);
  const evBad = await evaluateSubmission(jobBrief, offTopic);

  async function recordEval(submissionId, evaluation) {
    await limited.account.functionCall({
      contractId: mintiq.accountId,
      methodName: "record_evaluation",
      args: {
        token_id: String(tokenId),
        job_id: 1,
        submission_id: submissionId,
        score: evaluation.score,
        reasoning: evaluation.reasoning,
        recommend_approve: evaluation.recommend_approve,
        evaluator: evaluation.evaluator,
      },
      gas: 30_000_000_000_000n,
      attachedDeposit: 0n,
    });
  }
  await recordEval(1, ev);
  await recordEval(2, evBad);

  log("Agent evaluation (good submission)", {
    score: ev.score,
    passed: ev.passed,
    recommend_approve: ev.recommend_approve,
    evaluator: ev.evaluator,
    label: ev.label,
    reasoning: ev.reasoning,
  });
  log("Agent evaluation (off-topic submission)", {
    score: evBad.score,
    passed: evBad.passed,
    recommend_approve: evBad.recommend_approve,
    evaluator: evBad.evaluator,
    label: evBad.label,
    reasoning: evBad.reasoning,
  });

  const scorerOk =
    ev.label === "Built-in rule-based scorer (no LLM)" &&
    evBad.label === "Built-in rule-based scorer (no LLM)" &&
    ev.passed === true &&
    ev.score >= 70 &&
    evBad.passed === false &&
    evBad.score < 70;
  if (!scorerOk) {
    console.error("FAIL  Built-in scorer did not pass the good submission and fail the off-topic one.");
  } else {
    console.log("PASS  Built-in rule-based scorer: good submission passed, off-topic submission failed.");
  }

  await owner.call(mintiq, "approve_and_pay", {
    token_id: String(tokenId),
    job_id: 1,
    submission_id: 1,
  }, { gas: 40_000_000_000_000n });

  // ── Simulated Agent Market job (documented lifecycle, not production) ──
  const marketIntro = marketStatus();
  log("Agent Market status", {
    liveConfigured: marketIntro.liveConfigured,
    reason: marketIntro.reason,
    origin: marketIntro.origin,
  });
  const boardJob = simPostJob({
    title: "5 original memes, $5",
    description: "Same brief, shown as a standard Agent Market board job. Posting does not charge.",
    budgetUsd: 5,
    tokenId,
  });
  simBid(boardJob.id, {
    amountUsd: 5,
    proposal: memes,
    bidder: contributor.accountId,
  });
  simAward(boardJob.id);
  simSubmit(boardJob.id, memes);
  const accepted = simAccept(boardJob.id);
  log("Simulated Agent Market job (not posted to market.near.ai)", {
    jobId: accepted.id,
    escrow: accepted.escrowHeld,
    payout: accepted.payout,
    buyerBalanceLeft: marketStatus().simulation.buyerBalanceUsdc,
    ownerBalance: marketStatus().simulation.ownerBalanceUsdc,
  });

  // Stretch: invest idle funds and harvest labelled demo yield
  let invest = null;
  try {
    const nftBefore = await mintiq.view("get_nft", { token_id: String(tokenId) });
    const liquid = BigInt(nftBefore.liquid);
    const reserve = BigInt(nftBefore.rules.min_reserve);
    const idle = liquid - reserve;
    await limited.account.functionCall({
      contractId: mintiq.accountId,
      methodName: "invest_idle",
      args: {
        token_id: String(tokenId),
        destination: yieldPool.accountId,
        amount: idle.toString(),
      },
      gas: 80_000_000_000_000n,
      attachedDeposit: 0n,
    });
    await limited.account.functionCall({
      contractId: mintiq.accountId,
      methodName: "demo_accrue",
      args: { token_id: String(tokenId), destination: yieldPool.accountId, bps: 500 },
      gas: 40_000_000_000_000n,
      attachedDeposit: 0n,
    });
    await limited.account.functionCall({
      contractId: mintiq.accountId,
      methodName: "harvest",
      args: { token_id: String(tokenId), destination: yieldPool.accountId },
      gas: 80_000_000_000_000n,
      attachedDeposit: 0n,
    });
    invest = { ok: true, investedUsd: yoctoToUsd(idle.toString()), demoYieldBps: 500 };
  } catch (err) {
    invest = { ok: false, error: redact(err) };
  }

  const nft = await mintiq.view("get_nft", { token_id: String(tokenId) });
  const track = nft.track_record;
  const meta = await mintiq.view("nft_token", { token_id: String(tokenId) });

  log("On-chain track record", {
    jobs_completed: track.jobs_completed,
    contributors_hired: track.contributors_hired,
    total_spent: `${formatUsd(yoctoToUsd(track.total_spent))} (${formatNear(track.total_spent)})`,
    total_earned: `${formatUsd(yoctoToUsd(track.total_earned))} (${formatNear(track.total_earned)})`,
    liquid: `${formatUsd(yoctoToUsd(nft.liquid))} (${formatNear(nft.liquid)})`,
    invested: `${formatUsd(yoctoToUsd(nft.invested))} (${formatNear(nft.invested)})`,
    investStep: invest,
  });
  log("nft_token metadata extra", JSON.parse(meta.metadata.extra));

  const results = {
    tokenId,
    transferRejected: transferAttempt.ok,
    otherContractRejected: otherContractAttempt.ok,
    overspendRejected: overspendAttempt.ok,
    jobPaid: Number(track.jobs_completed) === 1,
    marketSimAccepted: accepted.status === "accepted",
    investOk: Boolean(invest?.ok),
    goodSubmissionPassed: Boolean(ev.passed),
    offTopicSubmissionFailed: evBad.passed === false,
    scorerLabel: ev.evaluator,
    scorerOk,
  };
  log("Summary", results);

  const allCore =
    results.transferRejected &&
    results.otherContractRejected &&
    results.overspendRejected &&
    results.jobPaid &&
    results.marketSimAccepted &&
    results.scorerOk;
  if (!allCore) {
    console.error("\nCore demo did not fully pass.");
    process.exitCode = 1;
  } else {
    console.log("\nCore loop passed: mint, limited-key rejections, overspend rejection, built-in scorer (good pass / off-topic fail), hire/pay, simulated market job.");
  }

  if (serve) {
    process.env.MINTIQ_KEEP_SANDBOX = "1";
    const { startServer } = await import("../app/src/server.js");
    await startServer({ worker: boot.worker, port: process.env.PORT || 8787 });
    console.log(`\nDashboard: http://127.0.0.1:${process.env.PORT || 8787}`);
    console.log("Sandbox will stay up until this process exits.");
    await new Promise(() => {});
  } else {
    await boot.worker.tearDown();
    console.log("\nSandbox torn down. Re-run with --serve to keep RPC + the dashboard up.");
  }
}

main().catch((err) => {
  console.error(redact(err));
  process.exit(1);
});
