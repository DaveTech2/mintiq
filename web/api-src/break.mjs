/**
 * Vercel serverless function: POST /api/break  ("Try to break the rules")
 *
 * Public demo. The hosted agent (miqagt…, FUNCTION-CALL key limited to the
 * treasury contract) sends a REAL transaction that breaks one of the NFT's
 * rules. The contract panics, so the transaction is recorded on-chain as
 * failed and we return its hash plus the rejection code.
 *
 *   { token_id, attempt: "overspend" }  -> post_job with budget = 2 × max_per_task  -> ERR_OVERSPEND
 *   { token_id, attempt: "unapproved" } -> invest_idle to a random, unapproved account -> ERR_UNAPPROVED_DESTINATION
 *
 * Rate-limited (per IP and per instance). Each failed tx burns ~0.0003 test NEAR
 * of gas from the agent's key allowance; no treasury funds can move.
 */
import crypto from "node:crypto";
import { connect, keyStores, KeyPair, transactions } from "near-api-js";

const RPC = process.env.MINTIQ_RPC || "https://test.rpc.fastnear.com";
const CONTRACT = process.env.MINTIQ_CONTRACT || "mintiq7f109e53.testnet";
const AGENT = process.env.MINTIQ_AGENT || "miqagt7f109e53.testnet";
const TGAS = 1_000_000_000_000n;
const PER_IP_MS = 20_000;
const GLOBAL_MS = 4_000;
const hits = new Map();
let lastGlobal = 0;

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

export function errorCode(failure) {
  const s = JSON.stringify(failure || {});
  return (s.match(/ERR_[A-Z_]+/) || [null])[0];
}

export const RULE_TEXT = {
  ERR_OVERSPEND: "Rejected: the budget is above this NFT's max spend per task.",
  ERR_UNAPPROVED_DESTINATION: "Rejected: funds may only go to the approved investment account.",
  ERR_RESERVE: "Rejected: this would drop the treasury below its reserve floor.",
  ERR_TOO_MANY_OPEN_JOBS: "Rejected: too many open jobs on this NFT (limit 10).",
};

function clientIp(req) {
  return String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const now = Date.now();
  const ip = clientIp(req);
  const wait = Math.max((hits.get(ip) || 0) + PER_IP_MS - now, lastGlobal + GLOBAL_MS - now);
  if (wait > 0) {
    res.setHeader("retry-after", String(Math.ceil(wait / 1000)));
    return res.status(429).json({ error: `Slow down: try again in ${Math.ceil(wait / 1000)}s.` });
  }
  hits.set(ip, now);
  lastGlobal = now;
  if (hits.size > 5000) hits.clear();
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const token_id = String(body.token_id || "");
    const attempt = String(body.attempt || "");
    if (!/^\d{1,9}$/.test(token_id)) return res.status(400).json({ error: "token_id must be a number" });
    const nft = await view("get_nft", { token_id });
    if (nft.agent_id !== AGENT) return res.status(403).json({ error: "This NFT uses a different agent, so the hosted agent can't act for it." });
    let method, args, rule, tried;
    if (attempt === "overspend") {
      const budget = BigInt(nft.rules.max_per_task) * 2n;
      method = "post_job";
      args = { token_id, title: "Rule-break demo: overspend", description: "Agent tries to commit twice the max spend per task.", budget: budget.toString() };
      rule = "max_per_task";
      tried = { amount: budget.toString(), limit: nft.rules.max_per_task };
    } else if (attempt === "unapproved") {
      const rogue = `rogue-${crypto.randomBytes(4).toString("hex")}.testnet`;
      const amount = BigInt(nft.rules.max_per_task) > 0n ? BigInt(nft.rules.max_per_task) : 10n ** 22n;
      method = "invest_idle";
      args = { token_id, destination: rogue, amount: amount.toString() };
      rule = "approved_destinations";
      tried = { amount: amount.toString(), to: rogue, approved: nft.rules.approved_destinations };
    } else {
      return res.status(400).json({ error: "attempt must be overspend or unapproved" });
    }
    const account = await agentAccount();
    const out = await account.signAndSendTransaction({
      receiverId: CONTRACT,
      actions: [transactions.functionCall(method, Buffer.from(JSON.stringify(args)), 30n * TGAS, 0n)],
      returnError: true,
    });
    const failure = out.status?.Failure;
    const code = errorCode(failure);
    return res.status(200).json({
      attempt, method, rule, tried, agent: AGENT,
      hash: out.transaction?.hash, rejected: Boolean(failure), error: code,
      explanation: RULE_TEXT[code] || (failure ? "Rejected by the contract." : "Unexpectedly accepted."),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e).replace(/ed25519:[A-Za-z0-9]+/g, "[redacted]").slice(0, 300) });
  }
}
