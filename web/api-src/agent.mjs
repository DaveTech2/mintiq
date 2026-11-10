/**
 * Vercel serverless function: POST /api/agent  (Mintiq agent signer relay)
 *
 * The IronClaw-packaged agent calls this endpoint through IronClaw's host HTTP
 * egress, which injects `Authorization: Bearer <relay token>` from IronClaw's
 * secret store. The WASM tool never sees the token or the NEAR key.
 *
 * The relay signs with the agent's FUNCTION-CALL key (receiver = treasury
 * contract; methods post_job / record_evaluation / invest_idle / harvest /
 * demo_accrue). It accepts only these actions and builds the arguments itself:
 *   score   { token_id, job_id, submission_id }  -> built-in scorer -> record_evaluation
 *   invest  { token_id }                          -> invest_idle(idle above reserve + open budgets)
 *   accrue  { token_id, bps<=500 }                -> demo_accrue (labelled demo yield)
 *   harvest { token_id }                          -> harvest
 * The score is computed here by the deterministic scorer, so a prompt-injected
 * model cannot choose a score. The contract still enforces every cap.
 */
import crypto from "node:crypto";
import { connect, keyStores, KeyPair } from "near-api-js";
import { evaluateSubmission } from "../../app/src/evaluator.js";
import { idleAboveReserve } from "../../app/src/agent-cycle.js";

const RPC = process.env.MINTIQ_RPC || "https://test.rpc.fastnear.com";
const CONTRACT = process.env.MINTIQ_CONTRACT || "mintiq7f109e53.testnet";
const AGENT = process.env.MINTIQ_AGENT || "miqagt7f109e53.testnet";
const TGAS = 1_000_000_000_000n;

async function view(method, args) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: {
      request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }),
  });
  const j = await res.json();
  if (j.error || j.result?.error) throw new Error("view failed");
  return JSON.parse(Buffer.from(j.result.result).toString() || "null");
}

let accountPromise = null;
function agentAccount() {
  if (!accountPromise) {
    accountPromise = (async () => {
      const keyStore = new keyStores.InMemoryKeyStore();
      await keyStore.setKey("testnet", AGENT, KeyPair.fromString(process.env.MINTIQ_AGENT_KEY));
      const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
      return near.account(AGENT);
    })();
  }
  return accountPromise;
}

function authorized(req) {
  const want = process.env.MINTIQ_RELAY_TOKEN || "";
  const got = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!want || !got) return false;
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function send(methodName, args, gasTgas) {
  const account = await agentAccount();
  const out = await account.functionCall({ contractId: CONTRACT, methodName, args, gas: BigInt(gasTgas) * TGAS, attachedDeposit: 0n });
  const failure = out.status?.Failure;
  return { method: methodName, hash: out.transaction?.hash, ok: !failure, error: failure ? (JSON.stringify(failure).match(/ERR_[A-Z_]+/) || ["failed"])[0] : null };
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = String(body.action || "");
    const token_id = String(body.token_id || "");
    if (!/^\d{1,9}$/.test(token_id)) return res.status(400).json({ error: "token_id must be a number" });
    const nft = await view("get_nft", { token_id });
    if (nft.agent_id !== AGENT) return res.status(403).json({ error: "this token uses a different agent" });
    const dest = nft.rules.approved_destinations[0];

    if (action === "score") {
      const job = nft.jobs.find((j) => j.id === Number(body.job_id));
      const sub = job?.submissions.find((s) => s.id === Number(body.submission_id));
      if (!job || !sub) return res.status(404).json({ error: "no such job/submission" });
      if (job.status !== "Open" || sub.evaluation) return res.status(409).json({ error: "already scored or job closed" });
      const ev = await evaluateSubmission(job, sub.content);
      const evaluator = ev.evaluator.slice(0, 120);
      const r = await send("record_evaluation", {
        token_id, job_id: job.id, submission_id: sub.id, score: ev.score,
        reasoning: ev.reasoning.slice(0, 900), recommend_approve: ev.recommend_approve, evaluator,
      }, 30);
      return res.status(200).json({ ...r, score: ev.score, pass: ev.recommend_approve, evaluator });
    }
    if (action === "invest") {
      const idle = idleAboveReserve(nft);
      if (idle <= 0n) return res.status(200).json({ ok: true, skipped: "nothing idle above reserve" });
      const r = await send("invest_idle", { token_id, destination: dest, amount: idle.toString() }, 100);
      return res.status(200).json({ ...r, amount: idle.toString(), destination: dest });
    }
    if (action === "accrue") {
      const bps = Math.max(1, Math.min(500, Number(body.bps || 500)));
      return res.status(200).json(await send("demo_accrue", { token_id, destination: dest, bps }, 50));
    }
    if (action === "harvest") {
      return res.status(200).json(await send("harvest", { token_id, destination: dest }, 150));
    }
    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e).replace(/ed25519:[A-Za-z0-9]+/g, "[redacted]").slice(0, 300) });
  }
}
