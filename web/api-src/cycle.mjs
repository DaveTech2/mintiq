/**
 * Vercel serverless function: GET|POST /api/cycle  (autonomous agent run)
 *
 * Runs one Mintiq agent cycle across every NFT that uses this agent, with no
 * human click:
 *   - scores every unscored submission on open jobs (record_evaluation)
 *   - posts the NFT's next job when none is open (post_job; at most every 6h,
 *     only if the treasury covers it above the reserve; MINTIQ_AUTO_POST=0 turns it off)
 *   - invests idle funds above the reserve, open job budgets and one held-back
 *     job budget (invest_idle), skipping dust below MIN_INVEST
 *
 * Triggered on a schedule by .github/workflows/agent-cycle.yml (every 15 min)
 * and by a daily Vercel cron as a backup. Both send
 * `Authorization: Bearer <secret>`; accepted secrets are CRON_SECRET (what
 * Vercel cron sends) or MINTIQ_RELAY_TOKEN.
 *
 * Signs with the agent's FUNCTION-CALL key only. The key cannot transfer NEAR,
 * approve payment, or call any other contract, and the contract still enforces
 * max-per-task, the reserve floor and approved destinations.
 */
import crypto from "node:crypto";
import { connect, keyStores, KeyPair } from "near-api-js";
import { runCycle } from "../../app/src/agent-cycle.js";

const RPC = process.env.MINTIQ_RPC || "https://test.rpc.fastnear.com";
const CONTRACT = process.env.MINTIQ_CONTRACT || "mintiq7f109e53.testnet";
const AGENT = process.env.MINTIQ_AGENT || "miqagt7f109e53.testnet";
// Don't spend gas moving dust: 0.05 NEAR minimum per investment.
const MIN_INVEST = 50_000_000_000_000_000_000_000n;

async function view(method, args) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: {
      request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }),
  });
  const j = await res.json();
  if (j.error || j.result?.error) throw new Error(`view ${method} failed`);
  return JSON.parse(Buffer.from(j.result.result).toString() || "null");
}

let accountPromise = null;
function agentAccount() {
  if (!accountPromise) {
    accountPromise = (async () => {
      const secret = process.env.MINTIQ_AGENT_KEY;
      if (!secret) throw new Error("agent key not configured");
      const keyStore = new keyStores.InMemoryKeyStore();
      await keyStore.setKey("testnet", AGENT, KeyPair.fromString(secret));
      const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
      return near.account(AGENT);
    })();
  }
  return accountPromise;
}

function authorized(req) {
  const got = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  return [process.env.CRON_SECRET, process.env.MINTIQ_RELAY_TOKEN].filter(Boolean).some((want) => {
    const a = Buffer.from(want), b = Buffer.from(got);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  const started = Date.now();
  try {
    const account = await agentAccount();
    const call = async (methodName, args, gas) => {
      const out = await account.functionCall({ contractId: CONTRACT, methodName, args, gas, attachedDeposit: 0n });
      const failure = out.status?.Failure;
      return { hash: out.transaction?.hash, ok: !failure, error: failure ? (JSON.stringify(failure).match(/ERR_[A-Z_]+/) || ["failed"])[0] : null };
    };
    // Wrap view so invest skips dust: hide idle below MIN_INVEST by treating it as reserve.
    const guardedView = async (method, args) => {
      const out = await view(method, args);
      if (method !== "get_nft" || !out) return out;
      const open = (out.jobs || []).filter((j) => j.status === "Open").reduce((a, j) => a + BigInt(j.budget), 0n);
      const idle = BigInt(out.liquid) - BigInt(out.rules.min_reserve) - open;
      if (idle > 0n && idle < MIN_INVEST) {
        return { ...out, rules: { ...out.rules, min_reserve: (BigInt(out.rules.min_reserve) + idle).toString() } };
      }
      return out;
    };
    const result = await runCycle({ view: guardedView, call, agentId: AGENT, maxScores: 5, invest: true, autoPost: process.env.MINTIQ_AUTO_POST !== "0" });
    return res.status(200).json({ ...result, ms: Date.now() - started });
  } catch (e) {
    const msg = String(e?.message || e).replace(/ed25519:[A-Za-z0-9]+/g, "[redacted]");
    return res.status(500).json({ error: msg.slice(0, 300) });
  }
}
