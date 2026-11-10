/**
 * Mintiq agent.
 *
 * Signs with a dedicated NEAR account whose key lives in a file
 * (MINTIQ_AGENT_KEY_FILE / config accounts.agent.keyFile) — never logged.
 * The contract, not the agent, enforces spending, reserve, and destination rules.
 *
 * This is a local-key agent, not a Shade Agent running in a TEE. See docs/NEAR_AGENTS.md
 * for what is real today and the upgrade path.
 */
import { call, view, GAS_HEAVY, loadConfig } from "./near.js";
import { evaluateSubmission, evaluatorStatus } from "./evaluator.js";
import { usdToYocto, yoctoToUsd, formatUsd } from "./money.js";

export function agentStatus() {
  const cfg = loadConfig();
  const ev = evaluatorStatus();
  return {
    signer: "LocalKeySigner",
    verifiedTee: false,
    agentAccount: cfg.accounts.agent.accountId,
    evaluator: ev.source,
    evaluatorLabel: ev.evaluator,
    evaluatorModel: ev.model,
    note: "Agent key is loaded from a local file and is not attested. Contract rules still bind this account.",
  };
}

export async function postJob(tokenId, { title, description, budgetUsd }) {
  const budget = usdToYocto(budgetUsd);
  const outcome = await call("agent", "post_job", {
    token_id: String(tokenId),
    title,
    description,
    budget,
  });
  return { title, budgetUsd, budgetYocto: budget, outcomeId: outcome.transaction?.hash || null };
}

export async function evaluateAndRecord(tokenId, jobId, submissionId) {
  const nft = await view("get_nft", { token_id: String(tokenId) });
  const job = (nft.jobs || []).find((j) => Number(j.id) === Number(jobId));
  if (!job) throw new Error("Job not found");
  const sub = (job.submissions || []).find((s) => Number(s.id) === Number(submissionId));
  if (!sub) throw new Error("Submission not found");
  const ev = await evaluateSubmission(job, sub.content);
  await call("agent", "record_evaluation", {
    token_id: String(tokenId),
    job_id: Number(jobId),
    submission_id: Number(submissionId),
    score: ev.score,
    reasoning: ev.reasoning,
    recommend_approve: ev.recommend_approve,
    evaluator: ev.evaluator,
  });
  return ev;
}

export async function investIdle(tokenId, destination, amountUsd) {
  const amount = usdToYocto(amountUsd);
  await call(
    "agent",
    "invest_idle",
    {
      token_id: String(tokenId),
      destination,
      amount,
    },
    { gas: GAS_HEAVY }
  );
  return { amountUsd, amountYocto: amount, destination };
}

export async function investAllIdle(tokenId) {
  const cfg = loadConfig();
  const nft = await view("get_nft", { token_id: String(tokenId) });
  const liquid = BigInt(nft.liquid);
  const reserve = BigInt(nft.rules.min_reserve);
  if (liquid <= reserve) {
    return { skipped: true, reason: "No idle funds above the reserve." };
  }
  const amount = (liquid - reserve).toString();
  const destination = destinationOf(cfg, nft);
  await call(
    "agent",
    "invest_idle",
    { token_id: String(tokenId), destination, amount },
    { gas: GAS_HEAVY }
  );
  return {
    skipped: false,
    amountYocto: amount,
    amountUsd: yoctoToUsd(amount),
    destination,
    display: formatUsd(yoctoToUsd(amount)),
  };
}

export async function demoAccrue(tokenId, bps = 500) {
  const cfg = loadConfig();
  const nft = await view("get_nft", { token_id: String(tokenId) });
  const destination = destinationOf(cfg, nft);
  await call(
    "agent",
    "demo_accrue",
    { token_id: String(tokenId), destination, bps },
    { gas: GAS_HEAVY }
  );
  return { destination, bps, note: "DEMO yield only — not real staking." };
}

export async function harvest(tokenId) {
  const cfg = loadConfig();
  const nft = await view("get_nft", { token_id: String(tokenId) });
  const destination = destinationOf(cfg, nft);
  await call(
    "agent",
    "harvest",
    { token_id: String(tokenId), destination },
    { gas: GAS_HEAVY }
  );
  return { destination };
}

function destinationOf(cfg, nft) {
  return (
    cfg.contracts.yieldPool ||
    nft.rules.approved_destinations[0] ||
    (() => {
      throw new Error("No approved destination");
    })()
  );
}
