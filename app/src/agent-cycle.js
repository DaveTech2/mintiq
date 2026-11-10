/**
 * One Mintiq agent cycle, transport-agnostic.
 *
 * view(method, args)   -> contract view call result
 * call(method, args)   -> signs a function call to the treasury contract with the
 *                         agent's function-call key; returns { hash }
 *
 * The cycle only uses methods the agent key is allowed to call
 * (record_evaluation, invest_idle, harvest, demo_accrue, post_job). The
 * contract still enforces every cap; this code cannot pay anyone.
 */
import { ruleBasedEvaluate, SCORER_LABEL } from "./scorer.js";

const GAS = 30_000_000_000_000n;
const GAS_HEAVY = 80_000_000_000_000n;

/** Pending = open job, submission not yet evaluated. */
export function pendingSubmissions(nft) {
  const out = [];
  for (const job of nft.jobs || []) {
    if (job.status !== "Open") continue;
    for (const sub of job.submissions || []) {
      if (!sub.evaluation) out.push({ job, sub });
    }
  }
  return out;
}

export function idleAboveReserve(nft) {
  const liquid = BigInt(nft.liquid);
  const reserve = BigInt(nft.rules.min_reserve);
  // keep enough for every open job's budget on top of the reserve
  const openBudgets = (nft.jobs || [])
    .filter((j) => j.status === "Open")
    .reduce((a, j) => a + BigInt(j.budget), 0n);
  const idle = liquid - reserve - openBudgets;
  return idle > 0n ? idle : 0n;
}

export async function runCycle({ view, call, agentId, tokenIds = null, maxScores = 5, invest = false, log = () => {} }) {
  const ids = tokenIds || (await view("list_token_ids", {}));
  const actions = [];
  let scored = 0;
  for (const token_id of ids) {
    const nft = await view("get_nft", { token_id });
    if (nft.agent_id !== agentId) {
      log(`skip token ${token_id}: agent is ${nft.agent_id}`);
      continue;
    }
    for (const { job, sub } of pendingSubmissions(nft)) {
      if (scored >= maxScores) break;
      const ev = ruleBasedEvaluate(job, sub.content);
      const args = {
        token_id,
        job_id: job.id,
        submission_id: sub.id,
        score: ev.score,
        reasoning: ev.reasoning.slice(0, 900),
        recommend_approve: ev.recommend_approve,
        evaluator: SCORER_LABEL,
      };
      const r = await call("record_evaluation", args, GAS);
      scored += 1;
      actions.push({ type: "record_evaluation", token_id, job_id: job.id, submission_id: sub.id, score: ev.score, pass: ev.recommend_approve, ...r });
      log(`scored token ${token_id} job ${job.id} sub ${sub.id}: ${ev.score}`);
    }
    if (invest) {
      const idle = idleAboveReserve(nft);
      const dest = nft.rules.approved_destinations[0];
      if (idle > 0n && dest) {
        const r = await call("invest_idle", { token_id, destination: dest, amount: idle.toString() }, GAS_HEAVY);
        actions.push({ type: "invest_idle", token_id, destination: dest, amount: idle.toString(), ...r });
      }
    }
  }
  return { agentId, evaluator: SCORER_LABEL, actions };
}
