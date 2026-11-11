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
 *
 * With autoPost, the agent posts the NFT's next job (one open job at a time,
 * at most every 6 hours, only if the treasury covers it above the reserve) and
 * keeps one job budget uninvested so hiring can continue.
 */
import { evaluateSubmission, evaluatorStatus } from "./evaluator.js";

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

// ── Auto-posting ────────────────────────────────────────────────────────────
const NEAR = 10n ** 24n;
export const DEFAULT_JOB_BUDGET = NEAR / 20n; // 0.05 NEAR
export const DEFAULT_POST_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Job ideas the agent can post for any mission, in order. {m} = the NFT's mission. */
const JOB_TEMPLATES = [
  { title: "3 taglines for {name}", description: "Write 3 short, original taglines for {name}, whose mission is to {m}. One per line." },
  { title: "3 social post ideas for {name}", description: "Suggest 3 social media post ideas that help {name} {m}. One per line, each under 200 characters." },
  { title: "3 slogans for {name}", description: "Write 3 punchy slogans for {name}. Mission: {m}. One per line." },
  { title: "3 name ideas for a {name} product", description: "Suggest 3 product or campaign names that fit {name}'s mission to {m}. One per line with a one-line reason." },
  { title: "3 short tweets for {name}", description: "Write 3 tweets (under 240 characters each) announcing what {name} does: {m}. One per line." },
  { title: "3 meme concepts for {name}", description: "Describe 3 original meme concepts about {name} and its mission to {m}. Caption plus a one-line image idea, one per line." },
];

function fill(str, nft) {
  const mission = String(nft.mission || "get useful work done").replace(/\.$/, "");
  return str.replaceAll("{name}", nft.name || `NFT #${nft.token_id}`).replaceAll("{m}", mission);
}

/** Decide whether to post the next job, and which. Returns null if the agent should wait. */
export function nextJob(nft, { now = Date.now(), budget = DEFAULT_JOB_BUDGET, cooldownMs = DEFAULT_POST_COOLDOWN_MS } = {}) {
  const jobs = nft.jobs || [];
  if (jobs.some((j) => j.status === "Open")) return null; // one open job at a time
  const last = jobs.reduce((a, j) => Math.max(a, Number(j.posted_at_ms || 0)), 0);
  if (last && now - last < cooldownMs) return null;
  const cap = BigInt(nft.rules.max_per_task);
  const amount = budget < cap ? budget : cap;
  if (idleAboveReserve(nft) < amount) return null; // the treasury can't cover it above the reserve
  const used = new Set(jobs.map((j) => j.title.trim().toLowerCase()));
  for (const t of JOB_TEMPLATES) {
    const title = fill(t.title, nft).slice(0, 120);
    if (used.has(title.toLowerCase())) continue;
    return { title, description: fill(t.description, nft).slice(0, 1000), budget: amount };
  }
  return null; // every idea already used
}

export async function runCycle({ view, call, agentId, tokenIds = null, maxScores = 5, invest = false, autoPost = false, maxPosts = 3, postOptions = {}, log = () => {} }) {
  const ids = tokenIds || (await view("list_token_ids", {}));
  const actions = [];
  let scored = 0;
  let posted = 0;
  for (const token_id of ids) {
    let nft = await view("get_nft", { token_id });
    if (nft.agent_id !== agentId) {
      log(`skip token ${token_id}: agent is ${nft.agent_id}`);
      continue;
    }
    for (const { job, sub } of pendingSubmissions(nft)) {
      if (scored >= maxScores) break;
      const ev = await evaluateSubmission(job, sub.content);
      const args = {
        token_id,
        job_id: job.id,
        submission_id: sub.id,
        score: ev.score,
        reasoning: ev.reasoning.slice(0, 900),
        recommend_approve: ev.recommend_approve,
        evaluator: ev.evaluator.slice(0, 120),
      };
      const r = await call("record_evaluation", args, GAS);
      scored += 1;
      actions.push({ type: "record_evaluation", token_id, job_id: job.id, submission_id: sub.id, score: ev.score, pass: ev.recommend_approve, evaluator: args.evaluator, ...r });
      log(`scored token ${token_id} job ${job.id} sub ${sub.id}: ${ev.score}`);
    }
    let keep = 0n; // held back from investing so the next job can be funded
    if (autoPost) {
      const job = posted < maxPosts ? nextJob(nft, postOptions) : null;
      if (job) {
        const r = await call("post_job", { token_id, title: job.title, description: job.description, budget: job.budget.toString() }, GAS);
        posted += 1;
        actions.push({ type: "post_job", token_id, title: job.title, budget: job.budget.toString(), ...r });
        log(`posted job on token ${token_id}: ${job.title}`);
        if (r.ok !== false) nft = await view("get_nft", { token_id }); // open budget now counts against idle
      }
      const cap = BigInt(nft.rules.max_per_task);
      const b = postOptions.budget ?? DEFAULT_JOB_BUDGET;
      keep = b < cap ? b : cap;
    }
    if (invest) {
      const idle = idleAboveReserve(nft) - keep;
      const dest = nft.rules.approved_destinations[0];
      if (idle > 0n && dest) {
        const r = await call("invest_idle", { token_id, destination: dest, amount: idle.toString() }, GAS_HEAVY);
        actions.push({ type: "invest_idle", token_id, destination: dest, amount: idle.toString(), ...r });
      }
    }
  }
  return { agentId, evaluator: evaluatorStatus().evaluator, actions };
}
