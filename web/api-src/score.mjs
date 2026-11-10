/**
 * Vercel serverless function: POST /api/score { token_id }
 *
 * Runs one Mintiq agent cycle for a single token: scores that token's
 * unscored submissions (NEAR AI Cloud first, built-in scorer as fallback)
 * and records the score on-chain via the agent's FUNCTION-CALL key (can only call
 * post_job / record_evaluation / invest_idle / harvest / demo_accrue on the
 * treasury contract; it cannot transfer NEAR or approve payment).
 *
 * The key comes from the MINTIQ_AGENT_KEY env var and is never returned.
 */
import { connect, keyStores, KeyPair } from "near-api-js";
import { runCycle } from "../../app/src/agent-cycle.js";

const RPC = process.env.MINTIQ_RPC || "https://test.rpc.fastnear.com";
const CONTRACT = process.env.MINTIQ_CONTRACT || "mintiq7f109e53.testnet";
const AGENT = process.env.MINTIQ_AGENT || "miqagt7f109e53.testnet";

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

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST { token_id }" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const token_id = String(body.token_id || "").trim();
    if (!/^\d{1,9}$/.test(token_id)) {
      res.status(400).json({ error: "token_id must be a number" });
      return;
    }
    const account = await agentAccount();
    const call = async (methodName, args, gas) => {
      const out = await account.functionCall({ contractId: CONTRACT, methodName, args, gas, attachedDeposit: 0n });
      return { hash: out.transaction?.hash, ok: !out.status?.Failure };
    };
    const result = await runCycle({ view, call, agentId: AGENT, tokenIds: [token_id], maxScores: 3, invest: false });
    res.status(200).json(result);
  } catch (e) {
    const msg = String(e?.message || e).replace(/ed25519:[A-Za-z0-9]+/g, "[redacted]");
    res.status(500).json({ error: msg.slice(0, 300) });
  }
}
