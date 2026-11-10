import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ShieldAlert, ShieldCheck, ExternalLink, ArrowRightLeft, Trophy, Briefcase, Users, Send, TrendingUp, Coins,
  CheckCircle2, XCircle, Bot, Award, Medal, ArrowRight, FileText, Clock,
} from "lucide-react";
import { formatNear } from "./money.js";
import { nearToYocto } from "./wallet.js";
import { friendlyError } from "./errors.js";
import { Skeleton } from "./ui.jsx";
import { AGENT, TX, ACCT, DEMO, view, short, Link, NftArt } from "./shared.jsx";

const Y = 10n ** 24n;
const big = (v) => { try { return BigInt(v || "0"); } catch { return 0n; } };
const ago = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** One line of the agent's reasoning (drops fallback notes and the "Parsed brief" preamble). */
export function oneLine(s) {
  const parts = String(s || "").replace(/\s*\(Fell back[\s\S]*$/, "").split(/(?<=[.!?)])\s+/).filter((x) => x && !/^Parsed brief/i.test(x));
  const line = parts.slice(0, 2).join(" ").replace(/\\u\{2265\}/g, "≥");
  return line.length > 180 ? line.slice(0, 177) + "…" : line;
}

/** Reserve health: liquid treasury relative to the reserve floor (2× floor = full bar). */
export function reserveHealth(nft) {
  const liquid = big(nft.liquid), floor = big(nft.rules.min_reserve);
  if (floor === 0n) return { pct: liquid > 0n ? 100 : 0, label: liquid > 0n ? "No floor set · treasury liquid" : "Empty treasury", tone: liquid > 0n ? "ok" : "warn", ratio: null };
  const ratio = Number((liquid * 100n) / floor) / 100;
  const pct = Math.max(0, Math.min(100, Math.round((ratio / 2) * 100)));
  return { pct, ratio, tone: ratio >= 1.5 ? "ok" : ratio >= 1.05 ? "warn" : "bad", label: `${ratio.toFixed(2)}× the reserve floor` };
}

export function ReserveBar({ nft, compact }) {
  const h = reserveHealth(nft);
  return (
    <div className={`health ${compact ? "compact" : ""}`}>
      {!compact && <div className="row-between small"><span>Reserve health</span><span className="muted">{h.label}</span></div>}
      <div className="health-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={h.pct} aria-label={`Reserve health ${h.label}`}>
        <span className={`health-fill ${h.tone}`} style={{ width: `${h.pct}%` }} />
      </div>
    </div>
  );
}

/** "Loop in numbers": earned, spent, treasury now. */
export function LoopNumbers({ nft }) {
  const now = big(nft.liquid) + big(nft.invested);
  return (
    <div className="loop-numbers" aria-label="This NFT's loop in numbers">
      <div><span>Earned</span><strong>{formatNear(nft.track_record.total_earned)}</strong></div>
      <ArrowRight size={16} aria-hidden="true" className="loop-arrow" />
      <div><span>Spent on contributors</span><strong>{formatNear(nft.track_record.total_spent)}</strong></div>
      <ArrowRight size={16} aria-hidden="true" className="loop-arrow" />
      <div><span>Treasury now</span><strong>{formatNear(now.toString())}</strong><em>{formatNear(nft.liquid)} liquid · {formatNear(nft.invested)} invested</em></div>
    </div>
  );
}

// ── Live activity ────────────────────────────────────────────────────────────
export function useActivity(tokenId, { limit = 30, every = 20000 } = {}) {
  const [state, setState] = useState({ items: null, source: null, error: null });
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/activity?limit=${limit}${tokenId ? `&token_id=${tokenId}` : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "activity unavailable");
      setState({ items: j.items, source: j.source, error: null });
    } catch (e) {
      setState((s) => ({ ...s, items: s.items || [], error: e.message }));
    }
  }, [tokenId, limit]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, every);
    return () => clearInterval(t);
  }, [load, every]);
  return [state, load];
}

const ICON = { mint: Award, fund: Coins, post_job: Briefcase, submit_work: FileText, record_evaluation: Bot, approve_and_pay: Send, invest_idle: TrendingUp, demo_accrue: TrendingUp, harvest: TrendingUp, nft_transfer: ArrowRightLeft };

export function ActivityFeed({ tokenId, limit = 12, title = "Live activity", showToken = true, extra = [] }) {
  const [{ items, error, source }] = useActivity(tokenId, { limit: Math.max(limit, 30) });
  const seen = useRef(null);
  const merged = items ? [...extra, ...items].filter((x, i, a) => !x.hash || a.findIndex((y) => y.hash === x.hash) === i).sort((a, b) => b.ts - a.ts).slice(0, limit) : null;
  const fresh = new Set();
  if (merged) {
    if (seen.current) merged.forEach((x) => { if (!seen.current.has(x.hash || x.text)) fresh.add(x.hash || x.text); });
    seen.current = new Set(merged.map((x) => x.hash || x.text));
  }
  return (
    <section className="card activity" aria-live="polite">
      <div className="row-between"><h3><Activity size={18} aria-hidden="true" /> {title} <span className="live-dot" aria-hidden="true" /></h3><span className="muted small">{source && !source.startsWith("indexer") ? "from contract state" : "on-chain, refreshes every 20s"}</span></div>
      {!merged && <div>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={16} style={{ marginTop: 12 }} />)}</div>}
      {merged && merged.length === 0 && <p className="muted small">{error ? "Activity is unavailable right now." : "No activity yet."}</p>}
      {merged && (
        <ol className="feed">
          {merged.map((x, i) => {
            const Icon = x.ok === false ? XCircle : ICON[x.method] || Activity;
            const key = x.hash || x.text;
            return (
              <li key={key} className={`feed-item ${x.ok === false ? "bad" : ""} ${fresh.has(key) ? "fresh" : ""}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <span className="feed-icon"><Icon size={15} aria-hidden="true" /></span>
                <div className="feed-body">
                  <div className="feed-text">
                    {showToken && x.token_id && <span className="badge">#{x.token_id}</span>} {x.text}
                    {x.ok === false && x.error && <span className="badge red">{x.error}</span>}
                  </div>
                  {x.reason && <div className="feed-reason">{x.ok === false ? <ShieldAlert size={13} aria-hidden="true" /> : <Bot size={13} aria-hidden="true" />} {x.reason}</div>}
                </div>
                <span className="feed-meta">
                  <Clock size={12} aria-hidden="true" /> {ago(x.ts)}
                  {x.hash && <a href={`${TX}${x.hash}`} target="_blank" rel="noreferrer" aria-label={`Open transaction ${x.hash} on NearBlocks`}><ExternalLink size={13} /></a>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ── Moment 1: try to break the rules ────────────────────────────────────────
export function RuleBreakPanel({ nft, onDone }) {
  const [busy, setBusy] = useState(null);
  const [results, setResults] = useState([]);
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);
  const usable = nft.agent_id === AGENT;
  const max = formatNear(nft.rules.max_per_task);
  async function attempt(kind) {
    setBusy(kind);
    try {
      const r = await fetch("/api/break", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token_id: nft.token_id, attempt: kind }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) { setCool(Number(r.headers.get("retry-after") || 20)); throw new Error(j.error || "Slow down"); }
      if (!r.ok) throw new Error(j.error || "Attempt failed to send");
      setResults((rs) => [{ ...j, at: Date.now() }, ...rs].slice(0, 6));
      setCool(20);
      onDone?.();
    } catch (e) {
      setResults((rs) => [{ attempt: kind, sendError: e.message, at: Date.now() }, ...rs].slice(0, 6));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="card rulebreak">
      <div className="row-between"><h3><ShieldAlert size={18} aria-hidden="true" /> Try to break the rules</h3><span className="badge">live on testnet</span></div>
      <p className="muted small">Make this NFT's agent attempt something its rules forbid. It sends a <strong>real transaction</strong> with its limited key; the contract rejects it on-chain and the failed transaction stays on NearBlocks.</p>
      {!usable ? <p className="muted small">This NFT uses its own agent ({short(nft.agent_id)}), so the hosted agent can't act for it.</p> : (
        <div className="btn-row">
          <button className="btn secondary" disabled={!!busy || cool > 0} onClick={() => attempt("overspend")}>
            {busy === "overspend" ? <span className="spinner" /> : <Coins size={16} aria-hidden="true" />} Pay {formatNear((big(nft.rules.max_per_task) * 2n).toString())} for one task (max {max})
          </button>
          <button className="btn secondary" disabled={!!busy || cool > 0} onClick={() => attempt("unapproved")}>
            {busy === "unapproved" ? <span className="spinner" /> : <Send size={16} aria-hidden="true" />} Send {max} to a random account
          </button>
        </div>
      )}
      {cool > 0 && <p className="hint">Rate-limited: next attempt in {cool}s.</p>}
      {results.length > 0 && (
        <ol className="break-results">
          {results.map((r) => (
            <li key={r.at} className={r.rejected ? "rejected" : r.sendError ? "err" : "accepted"}>
              {r.sendError ? <><XCircle size={16} aria-hidden="true" /> Couldn't send: {r.sendError}</> : (
                <>
                  <div className="br-line">
                    {r.rejected ? <ShieldCheck size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                    <strong>{r.rejected ? "Blocked on-chain" : "Accepted?!"}</strong>
                    <code>{r.error || "no error"}</code>
                    {r.hash && <a href={`${TX}${r.hash}`} target="_blank" rel="noreferrer">Failed tx <ExternalLink size={13} aria-hidden="true" /></a>}
                  </div>
                  <div className="muted small">
                    Agent tried {r.attempt === "overspend" ? `to commit ${formatNear(r.tried?.amount)} to one task (limit ${formatNear(r.tried?.limit)})` : `to send ${formatNear(r.tried?.amount)} to ${r.tried?.to} (approved: ${(r.tried?.approved || []).join(", ")})`}. {r.explanation}
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Moment 3: sell the business (NEP-171 transfer) ──────────────────────────
export function TransferPanel({ nft, send, toast, onDone }) {
  const [to, setTo] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(to.trim()) && to.trim().length >= 2 && to.trim().length <= 64;
  async function go(e) {
    e.preventDefault();
    if (!valid) return;
    if (!window.confirm(`Transfer “${nft.name}” (#${nft.token_id}) to ${to.trim()}?\n\nThe treasury, jobs, track record and control of the agent go with it. You will no longer be able to run this NFT.`)) return;
    setBusy(true);
    try {
      const { hash } = await send("Transfer", "nft_transfer", { receiver_id: to.trim(), token_id: nft.token_id, memo: memo.trim() || null }, { depositYocto: 1n });
      toast({ type: "success", title: "NFT transferred", body: `${to.trim()} now owns #${nft.token_id} and its treasury.`, hash });
      setTo(""); setMemo("");
      onDone?.();
    } catch (err) {
      toast({ type: "error", ...friendlyError(err), hash: err.hash });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card form transfer" onSubmit={go}>
      <h3><ArrowRightLeft size={18} aria-hidden="true" /> Sell or transfer this business</h3>
      <p className="muted small">A standard NEP-171 <code>nft_transfer</code> (1 yoctoNEAR, confirmed in your wallet). The treasury ({formatNear((big(nft.liquid) + big(nft.invested)).toString())}), track record, jobs and agent control all follow the token. Payment for a sale happens outside this demo.</p>
      <div className="grid2">
        <label className="field"><span className="field-label">New owner (testnet account)</span><input placeholder="buyer.testnet" value={to} onChange={(e) => setTo(e.target.value.toLowerCase())} /></label>
        <label className="field"><span className="field-label">Memo (optional)</span><input maxLength={80} placeholder="Sold to …" value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
      </div>
      <button className="btn secondary" disabled={busy || !valid}>{busy ? <span className="spinner" /> : <ArrowRightLeft size={16} aria-hidden="true" />} Transfer NFT</button>
    </form>
  );
}

// ── Plain-language rule sentence (mint) ─────────────────────────────────────
export function RuleSentence({ max, reserve, reinvest }) {
  const m = Number(max) > 0 ? `${Number(max)} test NEAR` : "—";
  const r = Number(reserve) > 0 ? `${Number(reserve)} test NEAR` : "0 (no floor)";
  return (
    <p className="rule-sentence" aria-live="polite">
      <ShieldCheck size={18} aria-hidden="true" />
      <span>This NFT can never spend more than <strong>{m}</strong> per task or drop below <strong>{r}</strong>. Idle funds can only go to the approved pool, and {reinvest}% of earnings are reinvested.</span>
    </p>
  );
}

// ── Résumé (/nft/:id) ───────────────────────────────────────────────────────
export function ResumePage({ tokenId, go }) {
  const [nft, setNft] = useState(null);
  const [{ items }] = useActivity(tokenId, { limit: 200, every: 30000 });
  useEffect(() => { view("get_nft", { token_id: String(tokenId) }).then(setNft).catch(() => setNft(false)); }, [tokenId]);
  if (nft === false) return <section className="container page"><div className="card empty"><h2>NFT #{tokenId} not found</h2><Link to="/leaderboard" go={go} className="btn primary">See all NFTs</Link></div></section>;
  if (!nft) return <section className="container page"><Skeleton h={180} className="skel-block" /><Skeleton h={20} w="40%" style={{ marginTop: 16 }} /></section>;
  const txFor = (pred) => (items || []).find(pred)?.hash;
  const mintTx = txFor((x) => x.method === "mint" && x.ok);
  const paid = [];
  for (const j of nft.jobs) for (const s of j.submissions) if (s.paid) paid.push({ j, s, hash: txFor((x) => x.method === "approve_and_pay" && x.ok && x.job_id === j.id) });
  const byContributor = {};
  for (const p of paid) { const c = (byContributor[p.s.contributor] ||= { n: 0, total: 0n, hash: p.hash }); c.n++; c.total += big(p.j.budget); }
  const minted = new Date(nft.minted_at_ms);
  return (
    <section className="container page resume">
      <div className="resume-head card">
        <div className="resume-cover"><NftArt id={nft.token_id} name={nft.name} /></div>
        <div className="resume-id">
          <div className="resume-avatar"><NftArt id={nft.token_id} name={nft.name} small /></div>
          <div>
            <h1>{nft.name} <span className="badge">#{nft.token_id}</span></h1>
            <p className="lead">{nft.mission}</p>
            <p className="muted small">
              Owned by <a href={`${ACCT}${nft.owner_id}`} target="_blank" rel="noreferrer">{nft.owner_id}</a> · agent <a href={`${ACCT}${nft.agent_id}`} target="_blank" rel="noreferrer">{short(nft.agent_id)}</a> · minted {minted.toLocaleDateString()}
              {mintTx && <> · <a href={`${TX}${mintTx}`} target="_blank" rel="noreferrer">mint tx <ExternalLink size={12} aria-hidden="true" /></a></>}
            </p>
            <div className="btn-row"><Link to={`/app/${nft.token_id}`} go={go} className="btn primary sm">Open dashboard</Link><Link to="/leaderboard" go={go} className="btn ghost sm"><Trophy size={15} aria-hidden="true" /> Leaderboard</Link></div>
          </div>
        </div>
      </div>
      <div className="resume-stats">
        <div className="card stat"><div className="stat-top"><Briefcase size={16} aria-hidden="true" /> Jobs completed</div><div className="stat-value">{nft.track_record.jobs_completed}</div></div>
        <div className="card stat"><div className="stat-top"><Send size={16} aria-hidden="true" /> Spent</div><div className="stat-value">{formatNear(nft.track_record.total_spent)}</div></div>
        <div className="card stat"><div className="stat-top"><TrendingUp size={16} aria-hidden="true" /> Earned</div><div className="stat-value">{formatNear(nft.track_record.total_earned)}</div><div className="stat-sub">Demo yield</div></div>
        <div className="card stat"><div className="stat-top"><Users size={16} aria-hidden="true" /> Contributors paid</div><div className="stat-value">{nft.track_record.contributors_hired}</div></div>
      </div>
      <LoopNumbers nft={nft} />
      <div className="card"><ReserveBar nft={nft} /><p className="muted small" style={{ marginTop: 8 }}>Liquid {formatNear(nft.liquid)} · floor {formatNear(nft.rules.min_reserve)} · max per task {formatNear(nft.rules.max_per_task)} · invests only in {nft.rules.approved_destinations.map(short).join(", ")}</p></div>
      <div className="resume-grid">
        <section className="card">
          <h3><Medal size={18} aria-hidden="true" /> Work history</h3>
          {nft.jobs.length === 0 && <p className="muted small">No jobs yet.</p>}
          <ol className="history">
            {nft.jobs.slice().reverse().map((j) => {
              const win = j.submissions.find((s) => s.paid);
              const postTx = txFor((x) => x.method === "post_job" && x.ok && x.job_id === j.id);
              const payTx = txFor((x) => x.method === "approve_and_pay" && x.ok && x.job_id === j.id);
              const best = win || j.submissions.filter((s) => s.evaluation).sort((a, b) => b.evaluation.score - a.evaluation.score)[0];
              return (
                <li key={j.id}>
                  <div className="row-between"><strong>{j.title}</strong><span className={`badge ${j.status === "Paid" ? "green" : "violet"}`}>{j.status === "Paid" ? "Completed" : "Open"}</span></div>
                  <div className="muted small">{formatNear(j.budget)} · {j.submissions.length} submission{j.submissions.length === 1 ? "" : "s"} · posted {new Date(j.posted_at_ms).toLocaleDateString()}
                    {postTx && <> · <a href={`${TX}${postTx}`} target="_blank" rel="noreferrer">posted tx</a></>}
                    {payTx && <> · <a href={`${TX}${payTx}`} target="_blank" rel="noreferrer">payment tx</a></>}
                  </div>
                  {win && <div className="small">Paid <a href={`${ACCT}${win.contributor}`} target="_blank" rel="noreferrer">{short(win.contributor)}</a></div>}
                  {best?.evaluation && <div className="feed-reason"><Bot size={13} aria-hidden="true" /> {best.evaluation.score}/100: {oneLine(best.evaluation.reasoning)}</div>}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="card">
          <h3><Users size={18} aria-hidden="true" /> Contributors paid</h3>
          {Object.keys(byContributor).length === 0 && <p className="muted small">Nobody paid yet.</p>}
          <ul className="contributors">
            {Object.entries(byContributor).map(([c, v]) => (
              <li key={c}><a href={`${ACCT}${c}`} target="_blank" rel="noreferrer">{short(c)}</a><span className="muted small">{v.n} job{v.n === 1 ? "" : "s"} · {formatNear(v.total.toString())}</span>{v.hash && <a href={`${TX}${v.hash}`} target="_blank" rel="noreferrer" aria-label="Payment transaction"><ExternalLink size={13} /></a>}</li>
            ))}
          </ul>
        </section>
      </div>
      <ActivityFeed tokenId={String(nft.token_id)} limit={25} title="On-chain timeline" showToken={false} />
    </section>
  );
}

// ── Leaderboard ─────────────────────────────────────────────────────────────
export function performance(n) {
  const h = reserveHealth(n);
  const earned = Number(big(n.track_record.total_earned) * 1000n / Y) / 1000;
  const spent = Number(big(n.track_record.total_spent) * 1000n / Y) / 1000;
  // Simple, explainable score: jobs done ×10, contributors ×5, earned NEAR ×20, reserve health up to 10.
  const score = n.track_record.jobs_completed * 10 + n.track_record.contributors_hired * 5 + earned * 20 + h.pct / 10;
  return { score: Math.round(score * 10) / 10, earned, spent, health: h };
}

export function LeaderboardPage({ go }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      const ids = await view("list_token_ids", {});
      const nfts = await Promise.all(ids.map((id) => view("get_nft", { token_id: id })));
      setRows(nfts.map((n) => ({ n, p: performance(n) })).sort((a, b) => b.p.score - a.p.score));
    })().catch(() => setRows([]));
  }, []);
  return (
    <section className="container page">
      <div className="page-head">
        <h1><Trophy size={28} aria-hidden="true" /> Leaderboard</h1>
        <p className="lead">Every Mintiq NFT on testnet, ranked by what it has actually done.</p>
        <p className="muted small">Score = jobs completed ×10 + contributors paid ×5 + NEAR earned ×20 + reserve health (up to 10). Live from the contract.</p>
      </div>
      {!rows && <div className="card">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={44} style={{ marginTop: 10 }} />)}</div>}
      {rows && (
        <div className="card table-card">
          <table className="board">
            <thead><tr><th>#</th><th>NFT</th><th>Jobs</th><th>Earned</th><th>Spent</th><th>Reserve health</th><th>Score</th></tr></thead>
            <tbody>
              {rows.map(({ n, p }, i) => (
                <tr key={n.token_id} onClick={() => go(`/nft/${n.token_id}`)} className="board-row">
                  <td className="rank">{i < 3 ? <Medal size={16} className={`medal m${i}`} aria-hidden="true" /> : null}{i + 1}</td>
                  <td><Link to={`/nft/${n.token_id}`} go={go} className="board-name"><NftArt id={n.token_id} name={n.name} small /><span><strong>{n.name}</strong><span className="muted small">#{n.token_id} · {short(n.owner_id)}</span></span></Link></td>
                  <td>{n.track_record.jobs_completed}</td>
                  <td>{formatNear(n.track_record.total_earned)}</td>
                  <td>{formatNear(n.track_record.total_spent)}</td>
                  <td className="health-cell"><ReserveBar nft={n} compact /><span className="muted small">{p.health.label}</span></td>
                  <td><strong>{p.score}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export { DEMO };
