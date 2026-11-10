/**
 * Vercel serverless function: GET /api/activity[?token_id=N][&limit=40]
 *
 * Live activity feed for the Mintiq contract, built from indexed testnet
 * transactions (NearBlocks API v3 list) + each transaction's args/status from
 * archival RPC, enriched with current contract state (job titles, payees).
 * Every item carries its on-chain transaction hash, including FAILED ones
 * (rule-break attempts). Falls back to contract-state-only items if the
 * indexer is unavailable.
 */
const RPC = process.env.MINTIQ_RPC || "https://test.rpc.fastnear.com";
const ARCHIVAL = process.env.MINTIQ_ARCHIVAL_RPC || "https://archival-rpc.testnet.fastnear.com";
const CONTRACT = process.env.MINTIQ_CONTRACT || "mintiq7f109e53.testnet";
const AGENT = process.env.MINTIQ_AGENT || "miqagt7f109e53.testnet";
const NB = "https://api-testnet.nearblocks.io/v3";
const details = new Map(); // tx hash -> parsed detail (immutable once final)
let listCache = { at: 0, items: null };

async function rpc(url, method, params) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error?.cause?.name || j.error?.message || "rpc error");
  return j.result;
}
async function view(method, args) {
  const r = await rpc(RPC, "query", { request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  return JSON.parse(Buffer.from(r.result).toString() || "null");
}

async function listTxns() {
  if (listCache.items && Date.now() - listCache.at < 10_000) return listCache.items;
  const out = [];
  let next = null;
  for (let page = 0; page < 3; page++) {
    const u = `${NB}/accounts/${CONTRACT}/txns?limit=100${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    const r = await fetch(u, { headers: process.env.NEARBLOCKS_API_KEY ? { authorization: `Bearer ${process.env.NEARBLOCKS_API_KEY}` } : {} });
    if (!r.ok) { if (out.length) break; throw new Error(`indexer HTTP ${r.status}`); }
    const j = await r.json();
    for (const t of j.data || []) {
      if (t.receiver_account_id !== CONTRACT) continue;
      const fc = (t.actions || []).find((a) => a.action === "FUNCTION_CALL");
      if (!fc) continue;
      out.push({ hash: t.transaction_hash, signer: t.signer_account_id, method: fc.method, ok: t.outcomes?.status !== false, ts: Math.floor(Number(t.block_timestamp) / 1e6) });
    }
    next = j.meta?.next_page || j.meta?.next || null;
    if (!next || (j.data || []).length < 100) break;
  }
  listCache = { at: Date.now(), items: out };
  return out;
}

function errCode(failure) {
  const s = JSON.stringify(failure || {});
  return (s.match(/ERR_[A-Z_]+/) || [s.includes("Failure") || failure ? "FAILED" : null])[0];
}

async function detail(t) {
  if (details.has(t.hash)) return details.get(t.hash);
  const params = { tx_hash: t.hash, sender_account_id: t.signer, wait_until: "NONE" };
  let r = null;
  for (const url of [ARCHIVAL, RPC, ARCHIVAL]) {
    try { r = await rpc(url, "tx", params); break; } catch { await new Promise((ok) => setTimeout(ok, 250)); }
  }
  if (!r) return fromIndexer(t);
  const fc = (r.transaction?.actions || []).map((a) => a.FunctionCall).find(Boolean) || {};
  let args = {};
  try { args = JSON.parse(Buffer.from(fc.args || "", "base64").toString() || "{}"); } catch {}
  let ret = null;
  if (r.status?.SuccessValue) { try { ret = JSON.parse(Buffer.from(r.status.SuccessValue, "base64").toString()); } catch {} }
  const d = { args, deposit: fc.deposit || "0", ok: !r.status?.Failure, error: r.status?.Failure ? errCode(r.status.Failure) : null, ret };
  details.set(t.hash, d);
  return d;
}

async function fromIndexer(t) {
  const r = await fetch(`${NB}/txns/${t.hash}`);
  if (!r.ok) throw new Error("detail unavailable");
  const j = (await r.json()).data || {};
  const fc = (j.actions || []).find((x) => x.action === "FUNCTION_CALL")?.args || {};
  const d = { args: fc.args_json || {}, deposit: fc.deposit || "0", ok: j.outcomes?.status !== false, error: j.outcomes?.status === false ? "FAILED" : null, ret: null };
  details.set(t.hash, d);
  return d;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } }));
  return out;
}

const Y = 10n ** 24n;
function near(y) {
  try { const v = BigInt(y || "0"); const w = v / Y, f = (v % Y).toString().padStart(24, "0").slice(0, 4).replace(/0+$/, ""); return `${w}${f ? "." + f : ""} NEAR`; } catch { return "? NEAR"; }
}
const short = (a) => (a && a.length > 24 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);
/** One line of the agent's reasoning: drop fallback notes and the "Parsed brief" preamble. */
export function oneLine(s) {
  const parts = String(s || "").replace(/\s*\(Fell back[\s\S]*$/, "").split(/(?<=[.!?)])\s+/).filter((x) => x && !/^Parsed brief/i.test(x));
  const line = parts.slice(0, 2).join(" ").replace(/\\u\{2265\}/g, "≥");
  return line.length > 180 ? line.slice(0, 177) + "…" : line;
}
const firstSentence = oneLine;
const RULES = {
  ERR_OVERSPEND: "Blocked by the contract: above the max spend per task.",
  ERR_UNAPPROVED_DESTINATION: "Blocked by the contract: not the approved investment account.",
  ERR_RESERVE: "Blocked by the contract: would breach the reserve floor.",
  ERR_NOT_AGENT_OR_OWNER: "Blocked by the contract: only the current owner or its agent can do this.",
  ERR_NOT_OWNER: "Blocked by the contract: only the current owner can do this.",
  ERR_REQUIRES_ONE_YOCTO: "Blocked: NEP-171 transfers need exactly 1 yoctoNEAR (wallet confirmation).",
};

function describe(t, d, nfts) {
  const a = d.args || {};
  const tok = a.token_id != null ? String(a.token_id) : (t.method === "mint" && d.ret != null ? String(d.ret) : null);
  const nft = tok ? nfts[tok] : null;
  const actor = t.signer === AGENT ? "Agent" : short(t.signer);
  const job = nft && a.job_id != null ? nft.jobs.find((j) => j.id === Number(a.job_id)) : null;
  const ok = d.ok;
  let kind = t.method, text, reason = null, amount = null;
  switch (t.method) {
    case "mint": text = ok ? `${short(t.signer)} minted #${tok ?? "?"} “${a.name || "Untitled"}”` : `Mint failed`; amount = d.deposit; break;
    case "fund": text = `${actor} added ${near(d.deposit)} to the treasury`; amount = d.deposit; break;
    case "post_job": {
      const jid = typeof d.ret === "number" ? d.ret : null;
      text = ok ? `${actor} posted job #${jid ?? "?"} “${a.title}” · ${near(a.budget)}` : `${actor} tried to post a ${near(a.budget)} job`;
      amount = a.budget; break;
    }
    case "submit_work": {
      const n = job ? job.submissions.length : null;
      text = `${actor} submitted work to job #${a.job_id}${job ? ` “${job.title}”` : ""}${n ? ` (${n} submission${n === 1 ? "" : "s"} so far)` : ""}`; break;
    }
    case "record_evaluation":
      text = `${actor} scored submission #${a.submission_id} on job #${a.job_id}: ${a.score}/100 ${a.recommend_approve ? "pass" : "fail"}`;
      reason = firstSentence(String(a.reasoning || "").replace(/\s*\(Fell back.*$/s, "")); break;
    case "approve_and_pay": {
      const sub = job?.submissions.find((s) => s.id === Number(a.submission_id));
      text = ok ? `${actor} approved and paid ${short(sub?.contributor || "contributor")} ${job ? near(job.budget) : ""} for job #${a.job_id}` : `${actor} tried to pay job #${a.job_id}`;
      amount = job?.budget || null; break;
    }
    case "invest_idle": text = ok ? `${actor} invested ${near(a.amount)} in ${short(a.destination)}` : `${actor} tried to send ${near(a.amount)} to ${short(a.destination)}`; amount = a.amount; break;
    case "demo_accrue": text = `${actor} accrued ${(Number(a.bps) / 100) || 0}% demo yield`; break;
    case "harvest": text = `${actor} harvested earnings back to the treasury`; break;
    case "nft_transfer": text = ok ? `${short(t.signer)} transferred NFT #${tok} to ${short(a.receiver_id)}${a.memo ? ` · “${a.memo}”` : ""}` : `${short(t.signer)} tried to transfer NFT #${tok}`; break;
    case "set_agent": text = `${actor} set the agent to ${short(a.agent_id)}`; break;
    case "add_approved_destination": text = `${actor} approved ${short(a.destination)} for investments`; break;
    case "new": text = "Contract initialised"; break;
    default: text = `${actor} called ${t.method}`;
  }
  if (!ok && !reason) reason = RULES[d.error] || "Rejected by the contract.";
  const job_id = a.job_id != null ? Number(a.job_id) : t.method === "post_job" && typeof d.ret === "number" ? d.ret : null;
  return { hash: t.hash, ts: t.ts, token_id: tok, job_id, submission_id: a.submission_id != null ? Number(a.submission_id) : null, method: t.method, kind, actor, signer: t.signer, ok, error: d.error, text, reason, amount };
}

function fromState(nfts) {
  const items = [];
  for (const n of Object.values(nfts)) {
    items.push({ ts: n.minted_at_ms, token_id: n.token_id, method: "mint", ok: true, text: `${short(n.owner_id)} owns #${n.token_id} “${n.name}”`, hash: null });
    for (const j of n.jobs) {
      items.push({ ts: j.posted_at_ms, token_id: n.token_id, method: "post_job", ok: true, text: `Job #${j.id} “${j.title}” posted · ${near(j.budget)}`, hash: null });
      for (const s of j.submissions) {
        items.push({ ts: s.submitted_at_ms, token_id: n.token_id, method: "submit_work", ok: true, text: `${short(s.contributor)} submitted work to job #${j.id}`, hash: null });
        if (s.evaluation) items.push({ ts: s.submitted_at_ms + 1, token_id: n.token_id, method: "record_evaluation", ok: true, text: `Agent scored submission #${s.id}: ${s.evaluation.score}/100`, reason: firstSentence(s.evaluation.reasoning), hash: null });
        if (s.paid) items.push({ ts: s.submitted_at_ms + 2, token_id: n.token_id, method: "approve_and_pay", ok: true, text: `Paid ${short(s.contributor)} ${near(j.budget)} for job #${j.id}`, hash: null });
      }
    }
  }
  return items;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const token = url.searchParams.get("token_id");
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 40)));
  try {
    const ids = await view("list_token_ids", {});
    const nfts = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await view("get_nft", { token_id: id })])));
    let items, source = "indexer";
    try {
      const txs = await listTxns();
      const ds = await pool(txs, 5, detail);
      items = txs.map((t, i) => (ds[i] ? describe(t, ds[i], nfts) : null)).filter(Boolean);
    } catch (e) {
      items = fromState(nfts); source = `contract-state (indexer unavailable: ${String(e.message).slice(0, 80)})`;
    }
    if (token) items = items.filter((x) => x.token_id === token);
    items.sort((a, b) => b.ts - a.ts);
    res.setHeader("cache-control", "public, s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json({ contract: CONTRACT, source, count: items.length, items: items.slice(0, limit) });
  } catch (e) {
    res.setHeader("cache-control", "no-store");
    return res.status(500).json({ error: String(e?.message || e).slice(0, 200) });
  }
}
