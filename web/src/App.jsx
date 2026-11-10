import { useEffect, useMemo, useState } from "react";
import { formatUsd, formatNear, yoctoToUsd } from "./money.js";
import deployed from "./deployed.json";
import { viewMethod } from "./rpc.js";
import {
  initWallet, showModal, signedInAccount, signOut, callContract, outcomeHash, outcomeFailure, nearToYocto,
} from "./wallet.js";

const RPC = deployed.rpc;
const CONTRACT = deployed.contracts.mintiq;
const POOL = deployed.contracts.yieldPool;
const AGENT = deployed.accounts.agent;
const TX = deployed.explorerTx;
const ACCT = deployed.explorerAccount;
const STORAGE_BUFFER_NEAR = 0.05;

const view = (method, args = {}) => viewMethod(RPC, CONTRACT, method, args);

const TEMPLATES = {
  custom: { label: "Blank (write your own)", name: "", mission: "" },
  meme: { label: "Meme Studio", name: "Meme Studio", mission: "Build a meme production business: hire writers for original meme concepts and grow the treasury." },
  coffee: { label: "Coffee shop copy desk", name: "Corner Coffee Copy", mission: "Commission short taglines and social posts for a neighbourhood coffee shop." },
  research: { label: "Research desk", name: "Research Desk", mission: "Hire contributors to write short, sourced summaries on NEAR ecosystem projects." },
};

const DEFAULT_MINT = {
  template: "custom",
  name: "",
  mission: "",
  treasuryNear: "1.5",
  maxPerTaskNear: "0.1",
  reserveNear: "0.5",
  reinvestPct: 70,
  agentId: AGENT,
  usePool: true,
};

function usd(yocto) {
  return formatUsd(yoctoToUsd(yocto));
}

function nearUsd(near) {
  const n = Number(near);
  return Number.isFinite(n) ? formatUsd(n * deployed.usdPerNear) : "—";
}

// The four on-chain moments that prove the idea, matched against the scripted demo log.
const PROOF_MOMENTS = [
  { match: "ERR_OVERSPEND", title: "Overspend blocked", body: "The agent tried to post a $6 job. The max is $5, so the contract rejected it.", tone: "block" },
  { match: "cannot transfer NEAR", title: "Agent can't move funds", body: "The agent's key tried to send NEAR out. NEAR itself refused before any code ran.", tone: "block" },
  { match: "approved and paid", title: "Job paid", body: "A contributor delivered 5 memes, the agent scored them 95, the owner approved, and the NFT paid $5.", tone: "ok" },
  { match: "Harvest demo yield", title: "Yield harvested", body: "Idle money earned demo yield, then it came back and was split between the treasury and the owner.", tone: "ok" },
];

function proofTx(match) {
  return (deployed.transactions || []).find((t) => t.label.includes(match));
}

function shortAcct(a) {
  return a && a.length > 24 ? `${a.slice(0, 10)}…${a.slice(-10)}` : a;
}

function timeAgo(ms) {
  const s = Math.max(0, (Date.now() - Number(ms)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function buildActivity(nft) {
  const items = [];
  for (const j of nft.jobs || []) {
    items.push({ at: j.posted_at_ms, kind: "post", text: `Posted job "${j.title}" for ${usd(j.budget)}` });
    for (const s of j.submissions || []) {
      items.push({ at: s.submitted_at_ms, kind: "submit", text: `${shortAcct(s.contributor)} submitted work to "${j.title}"` });
      if (s.evaluation) {
        items.push({
          at: Number(s.submitted_at_ms) + 1,
          kind: s.evaluation.recommend_approve ? "pass" : "fail",
          text: `Agent scored submission #${s.id}: ${s.evaluation.score}/100, ${s.evaluation.recommend_approve ? "recommends paying" : "rejected"}`,
        });
      }
      if (s.paid) items.push({ at: Number(s.submitted_at_ms) + 2, kind: "paid", text: `Paid ${usd(j.budget)} to ${shortAcct(s.contributor)}` });
    }
  }
  items.push({ at: nft.minted_at_ms, kind: "mint", text: `Minted with rules: max ${usd(nft.rules.max_per_task)} per task, ${usd(nft.rules.min_reserve)} reserve` });
  return items.filter((i) => Number(i.at) > 0).sort((a, b) => Number(b.at) - Number(a.at));
}

function tokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token");
}

function setTokenInUrl(id) {
  const u = new URL(window.location.href);
  u.searchParams.set("token", id);
  u.searchParams.delete("transactionHashes");
  u.searchParams.delete("errorCode");
  u.searchParams.delete("errorMessage");
  window.history.replaceState({}, "", u);
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [walletReady, setWalletReady] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [selected, setSelected] = useState(tokenFromUrl());
  const [nft, setNft] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [filterMine, setFilterMine] = useState(false);
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [job, setJob] = useState({ title: "3 taglines for a coffee shop", description: "Write 3 short original taglines for a neighbourhood coffee shop.", budgetNear: "0.05" });
  const [submission, setSubmission] = useState("");
  const [investNear, setInvestNear] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadTokens() {
    const list = await view("nft_tokens", { from_index: "0", limit: 200 });
    setTokens(list || []);
    return list || [];
  }

  async function loadToken(id) {
    if (!id) return setNft(null);
    try {
      setNft(await view("get_nft", { token_id: String(id) }));
    } catch {
      setNft(null);
    }
  }

  async function refresh(id = selected) {
    const list = await loadTokens();
    const next = id && list.some((t) => t.token_id === String(id)) ? String(id) : list[0]?.token_id;
    setSelected(next);
    await loadToken(next);
  }

  useEffect(() => {
    // Redirect wallets (MyNearWallet) come back with ?transactionHashes=
    const params = new URLSearchParams(window.location.search);
    const hashes = params.get("transactionHashes");
    if (hashes) setFlash({ type: "ok", text: "Transaction sent from your wallet.", hash: hashes.split(",").pop() });
    if (params.get("errorCode")) setFlash({ type: "err", text: `Wallet: ${params.get("errorCode")}` });

    refresh().catch((e) => setFlash({ type: "err", text: e.message }));
    initWallet({ contractId: CONTRACT, rpc: RPC })
      .then(async (selector) => {
        setWalletReady(true);
        setAccount(await signedInAccount());
        selector.store.observable.subscribe((state) => {
          const a = state.accounts?.find((x) => x.active)?.accountId || state.accounts?.[0]?.accountId || null;
          setAccount(a);
        });
      })
      .catch((e) => setFlash({ type: "err", text: `Wallet selector failed to load: ${e.message}` }));
  }, []);

  async function send(label, method, args, { gasTgas = 30, depositYocto = 0n } = {}) {
    if (!account) {
      showModal();
      throw new Error("Connect a testnet wallet first.");
    }
    const outcome = await callContract({ contractId: CONTRACT, method, args, gasTgas, depositYocto });
    const hash = outcomeHash(outcome);
    const fail = outcomeFailure(outcome);
    if (fail) throw Object.assign(new Error(`${label} rejected by the contract: ${fail}`), { hash });
    return { outcome, hash };
  }

  async function run(fn) {
    setBusy(true);
    setFlash(null);
    try {
      const r = await fn();
      if (r?.text) setFlash({ type: "ok", ...r });
      await refresh(r?.select || selected);
    } catch (err) {
      setFlash({ type: "err", text: err.message, hash: err.hash });
    } finally {
      setBusy(false);
    }
  }

  const isOwner = account && nft && account === nft.owner_id;
  const visibleTokens = useMemo(
    () => (filterMine && account ? tokens.filter((t) => t.owner_id === account) : tokens),
    [tokens, filterMine, account]
  );
  const myCount = account ? tokens.filter((t) => t.owner_id === account).length : 0;

  const treasuryOk = Number(mint.treasuryNear) > Number(mint.reserveNear) && Number(mint.treasuryNear) > 0;
  const mintValid = mint.name.trim() && mint.mission.trim() && treasuryOk && Number(mint.maxPerTaskNear) > 0 && mint.usePool;

  async function doMint() {
    const reinvest = Math.round(Number(mint.reinvestPct) * 100);
    const args = {
      name: mint.name.trim(),
      mission: mint.mission.trim(),
      agent_id: mint.agentId.trim() || AGENT,
      max_per_task: nearToYocto(mint.maxPerTaskNear).toString(),
      min_reserve: nearToYocto(mint.reserveNear).toString(),
      reinvest_bps: reinvest,
      owner_share_bps: 10000 - reinvest,
      approved_destinations: [POOL],
    };
    const deposit = nearToYocto(mint.treasuryNear) + nearToYocto(String(STORAGE_BUFFER_NEAR));
    const { outcome, hash } = await send("Mint", "mint", args, { gasTgas: 30, depositYocto: deposit });
    let newId = null;
    try {
      const b64 = outcome?.status?.SuccessValue;
      if (b64) newId = JSON.parse(atob(b64));
    } catch {}
    if (newId) setTokenInUrl(newId);
    setTab("dashboard");
    return { text: `Minted "${args.name}"${newId ? ` as token #${newId}` : ""}.`, hash, select: newId };
  }

  const idle = nft
    ? (() => {
        const open = (nft.jobs || []).filter((j) => j.status === "Open").reduce((a, j) => a + BigInt(j.budget), 0n);
        const v = BigInt(nft.liquid) - BigInt(nft.rules.min_reserve) - open;
        return v > 0n ? v : 0n;
      })()
    : 0n;

  const loop = nft
    ? (() => {
        const earned = BigInt(nft.track_record.total_earned);
        const spent = BigInt(nft.track_record.total_spent);
        const toOwner = (earned * BigInt(nft.rules.owner_share_bps)) / 10000n;
        const reinvested = earned - toOwner;
        return { earned, spent, toOwner, reinvested, net: reinvested - spent };
      })()
    : null;
  const activity = nft ? buildActivity(nft) : [];

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Mintiq</p>
          <h1>NFTs that earn, invest, hire, and pay on their own.</h1>
          <p className="lede">Each NFT owns a treasury and an AI agent runs it. The agent hires people, invests idle money and pays out, and the contract enforces the owner's rules so it can't break them.</p>
          <div className="badges">
            <span className="badge warn">NEAR testnet</span>
            <span className="badge">Rules enforced on-chain</span>
            <span className="badge">Demo yield</span>
            <span className="badge">Market simulated</span>
            <span className="badge">$2.00 / NEAR demo rate</span>
          </div>
        </div>
        <nav>
          <button className={tab === "dashboard" ? "on" : ""} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button className={tab === "mint" ? "on" : ""} onClick={() => setTab("mint")}>Mint</button>
          {account ? (
            <button className="ghost" title="Disconnect" onClick={() => signOut().then(() => setAccount(null))}>
              {account.length > 22 ? `${account.slice(0, 10)}…${account.slice(-8)}` : account} · Disconnect
            </button>
          ) : (
            <button disabled={!walletReady} onClick={showModal}>{walletReady ? "Connect testnet wallet" : "Loading wallets…"}</button>
          )}
        </nav>
      </header>

      {flash && (
        <p className={`flash ${flash.type}`}>
          {flash.text}
          {flash.hash && (
            <>
              {" "}
              <a href={`${TX}${flash.hash}`} target="_blank" rel="noreferrer">View transaction</a>
            </>
          )}
        </p>
      )}

      <section className="how">
        <div className="how-step">
          <span className="num">1</span>
          <h3>Mint with rules</h3>
          <p>Fund a treasury and set the limits: max spend per task, a reserve floor, where it can invest, and how earnings are split.</p>
        </div>
        <div className="how-step">
          <span className="num">2</span>
          <h3>The agent hires and invests</h3>
          <p>It posts jobs, scores submissions, and puts idle money into approved places. Its key can't move funds anywhere else.</p>
        </div>
        <div className="how-step">
          <span className="num">3</span>
          <h3>It builds a track record</h3>
          <p>Jobs, payouts and earnings are recorded on-chain. Transfer the NFT and the business, treasury and history go with it.</p>
        </div>
      </section>

      <section className="card">
        <h2>Proven on NEAR testnet</h2>
        <p className="muted">Real transactions from the demo NFT. Tap any card to check it in the explorer.</p>
        <div className="proofs">
          {PROOF_MOMENTS.map((p) => {
            const t = proofTx(p.match);
            const Tag = t?.hash ? "a" : "div";
            return (
              <Tag key={p.title} className={`proof ${p.tone}`} {...(t?.hash ? { href: `${TX}${t.hash}`, target: "_blank", rel: "noreferrer" } : {})}>
                <span className="proof-tag">{p.tone === "block" ? "Rejected" : "Done"}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                {t?.hash && <span className="proof-link">View transaction →</span>}
              </Tag>
            );
          })}
        </div>
      </section>

      <details className="card try">
        <summary>Try it yourself on testnet</summary>
        <ol className="steps">
          <li>Get a free testnet account (e.g. <a href="https://testnet.mynearwallet.com" target="_blank" rel="noreferrer">MyNearWallet testnet</a> or Meteor), which comes with test NEAR.</li>
          <li>Click <strong>Connect testnet wallet</strong>.</li>
          <li>Open <strong>Mint</strong>, name your NFT, write its mission, and fund a small treasury (1–2 NEAR is plenty).</li>
          <li>Post a job, submit work (from any account), click <strong>Ask agent to score</strong>, then approve &amp; pay or invest idle funds as the owner.</li>
        </ol>
        <p className="hint">
          Treasury contract <a href={`${ACCT}${CONTRACT}`} target="_blank" rel="noreferrer">{CONTRACT}</a> · demo yield pool{" "}
          <a href={`${ACCT}${POOL}`} target="_blank" rel="noreferrer">{POOL}</a> (labelled demo, not real staking) · agent{" "}
          <a href={`${ACCT}${AGENT}`} target="_blank" rel="noreferrer">{AGENT}</a> (function-call key, cannot move funds) · scorer: {deployed.evaluator}
        </p>
      </details>

      {tab === "mint" && (
        <section className="card form">
          <h2>Mint your own Mintiq (testnet)</h2>
          <p className="muted">
            You own the NFT. The deposit becomes its treasury. The contract enforces your rules: the agent and you can never pay more than the max per task, dip below
            the reserve floor, or invest anywhere outside the approved list.
          </p>
          <label>
            Start from a template (optional prefill)
            <select
              value={mint.template}
              onChange={(e) => {
                const t = TEMPLATES[e.target.value];
                setMint({ ...mint, template: e.target.value, name: t.name, mission: t.mission });
              }}
            >
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <option key={k} value={k}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            NFT name (your title, stored as the token's metadata title)
            <input maxLength={64} placeholder="e.g. Lagos Design Guild" value={mint.name} onChange={(e) => setMint({ ...mint, name: e.target.value })} />
            <span className="hint">{mint.name.length}/64</span>
          </label>
          <label>
            Mission (free text)
            <textarea maxLength={500} placeholder="What should this NFT's agent hire people to do?" value={mint.mission} onChange={(e) => setMint({ ...mint, mission: e.target.value })} />
            <span className="hint">{mint.mission.length}/500</span>
          </label>
          <div className="grid3">
            <label>
              Treasury deposit (NEAR)
              <input inputMode="decimal" value={mint.treasuryNear} onChange={(e) => setMint({ ...mint, treasuryNear: e.target.value })} />
              <span className="hint">≈ {nearUsd(mint.treasuryNear)} · plus 0.05 NEAR storage</span>
            </label>
            <label>
              Max spend per task (NEAR)
              <input inputMode="decimal" value={mint.maxPerTaskNear} onChange={(e) => setMint({ ...mint, maxPerTaskNear: e.target.value })} />
              <span className="hint">≈ {nearUsd(mint.maxPerTaskNear)}</span>
            </label>
            <label>
              Reserve floor (NEAR)
              <input inputMode="decimal" value={mint.reserveNear} onChange={(e) => setMint({ ...mint, reserveNear: e.target.value })} />
              <span className="hint">≈ {nearUsd(mint.reserveNear)} always stays liquid</span>
            </label>
          </div>
          <div className="grid2">
            <label>
              Reinvest share of earnings (%)
              <input type="number" min={0} max={100} value={mint.reinvestPct} onChange={(e) => setMint({ ...mint, reinvestPct: Math.max(0, Math.min(100, +e.target.value)) })} />
              <span className="hint">{mint.reinvestPct}% back to the treasury · {100 - mint.reinvestPct}% to you</span>
            </label>
            <label>
              Agent account
              <input value={mint.agentId} onChange={(e) => setMint({ ...mint, agentId: e.target.value })} />
              <span className="hint">Default is the hosted Mintiq agent (scores submissions for you).</span>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={mint.usePool} onChange={(e) => setMint({ ...mint, usePool: e.target.checked })} />
            Approved investment: <code>{POOL}</code> (demo yield pool, the only option on testnet)
          </label>
          {!treasuryOk && <p className="flash err">Treasury must be larger than the reserve floor.</p>}
          <button disabled={busy || !mintValid} onClick={() => run(doMint)}>
            {account ? `Mint with ${mint.treasuryNear} NEAR treasury` : "Connect wallet to mint"}
          </button>
        </section>
      )}

      {tab === "dashboard" && (
        <>
          <section className="card picker">
            <label>
              View token
              <select
                value={selected || ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setTokenInUrl(e.target.value);
                  loadToken(e.target.value);
                }}
              >
                {visibleTokens.map((t) => (
                  <option key={t.token_id} value={t.token_id}>
                    #{t.token_id} {t.metadata?.title || "(untitled)"} · {t.owner_id === account ? "yours" : t.owner_id}
                  </option>
                ))}
              </select>
            </label>
            {account && (
              <label className="check">
                <input type="checkbox" checked={filterMine} onChange={(e) => setFilterMine(e.target.checked)} /> Only my tokens ({myCount})
              </label>
            )}
            <span className="hint">{tokens.length} Mintiq NFTs on testnet</span>
          </section>

          {!nft && <section className="card"><p>No token selected. Mint one from the Mint tab.</p></section>}

          {nft && (
            <>
              <section className="hero-card">
                <div>
                  <p className="eyebrow">Token #{nft.token_id} · owner <a href={`${ACCT}${nft.owner_id}`} target="_blank" rel="noreferrer">{nft.owner_id}</a>{isOwner ? " (you)" : ""}</p>
                  <h2>{nft.name}</h2>
                  <p className="mission">{nft.mission}</p>
                  <p className="hint">Agent {nft.agent_id} · reinvest {nft.rules.reinvest_bps / 100}% / owner {nft.rules.owner_share_bps / 100}% · approved: {nft.rules.approved_destinations.join(", ")}</p>
                </div>
              </section>

              <section className="stats">
                <Stat label="Liquid treasury" value={usd(nft.liquid)} sub={formatNear(nft.liquid)} />
                <Stat label="Invested" value={usd(nft.invested)} sub={`${formatNear(nft.invested)} · demo pool`} />
                <Stat label="Reserve floor" value={usd(nft.rules.min_reserve)} sub={`Max per task ${usd(nft.rules.max_per_task)} (${formatNear(nft.rules.max_per_task)})`} />
                <Stat label="Idle above reserve" value={usd(idle.toString())} sub="after open job budgets" />
              </section>

              <section className="card track">
                <h3>On-chain track record</h3>
                <div className="stats compact">
                  <Stat label="Jobs completed" value={nft.track_record.jobs_completed} />
                  <Stat label="Contributors hired" value={nft.track_record.contributors_hired} />
                  <Stat label="Total spent" value={usd(nft.track_record.total_spent)} />
                  <Stat label="Total earned" value={usd(nft.track_record.total_earned)} />
                  <Stat label="Paid to owner" value={usd(loop.toOwner.toString())} sub={`${nft.rules.owner_share_bps / 100}% of earnings`} />
                  <Stat
                    label="Net to treasury"
                    value={`${loop.net < 0n ? "−" : "+"}${usd((loop.net < 0n ? -loop.net : loop.net).toString())}`}
                    sub="reinvested earnings minus spending"
                  />
                </div>
              </section>

              <section className="card">
                <h3>The loop</h3>
                <p className="muted">Hiring spends the treasury and investing refills it. The owner's split decides how much comes back.</p>
                <div className="loop">
                  <div className="node"><span>Treasury</span><strong>{usd(nft.liquid)}</strong></div>
                  <div className="arrow">→</div>
                  <div className="node split-node">
                    <div><span>Hiring</span><strong>−{usd(loop.spent.toString())}</strong></div>
                    <div><span>Investing</span><strong>{usd(nft.invested)}</strong></div>
                  </div>
                  <div className="arrow">→</div>
                  <div className="node"><span>Earnings</span><strong>+{usd(loop.earned.toString())}</strong></div>
                  <div className="arrow">→</div>
                  <div className="node split-node">
                    <div><span>Back to treasury</span><strong>+{usd(loop.reinvested.toString())}</strong></div>
                    <div><span>To owner</span><strong>+{usd(loop.toOwner.toString())}</strong></div>
                  </div>
                </div>
              </section>

              <section className="card">
                <h3>Activity</h3>
                {activity.length === 0 ? (
                  <p className="muted">Nothing yet.</p>
                ) : (
                  <ul className="feed">
                    {activity.slice(0, 12).map((a, i) => (
                      <li key={i} className={a.kind}>
                        <span className="dot" />
                        <span className="feed-text">{a.text}</span>
                        <span className="feed-time">{timeAgo(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {isOwner && (
                <section className="split">
                  <div className="card">
                    <h3>Post a job (owner)</h3>
                    <label>Title<input maxLength={120} value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} /></label>
                    <label>Brief<textarea maxLength={1000} value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} /></label>
                    <label>
                      Budget (NEAR)
                      <input inputMode="decimal" value={job.budgetNear} onChange={(e) => setJob({ ...job, budgetNear: e.target.value })} />
                      <span className="hint">≈ {nearUsd(job.budgetNear)} · above {formatNear(nft.rules.max_per_task)} the contract rejects it (ERR_OVERSPEND)</span>
                    </label>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const { hash } = await send("Post job", "post_job", {
                            token_id: nft.token_id, title: job.title, description: job.description, budget: nearToYocto(job.budgetNear).toString(),
                          });
                          return { text: "Job posted on-chain.", hash };
                        })
                      }
                    >
                      Post job
                    </button>
                  </div>
                  <div className="card">
                    <h3>Invest &amp; harvest (owner)</h3>
                    <p className="muted">Idle funds can only go to the approved demo yield pool, and never below the reserve.</p>
                    <label>
                      Amount (NEAR)
                      <input inputMode="decimal" placeholder={formatNear(idle.toString()).replace(" NEAR", "")} value={investNear} onChange={(e) => setInvestNear(e.target.value)} />
                      <span className="hint">Idle now: {formatNear(idle.toString())}</span>
                    </label>
                    <div className="row">
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const amount = investNear ? nearToYocto(investNear) : idle;
                            if (amount <= 0n) throw new Error("Nothing idle above the reserve to invest.");
                            const { hash } = await send("Invest", "invest_idle", { token_id: nft.token_id, destination: nft.rules.approved_destinations[0], amount: amount.toString() }, { gasTgas: 100 });
                            return { text: `Invested ${formatNear(amount.toString())} in the demo pool.`, hash };
                          })
                        }
                      >
                        Invest idle funds
                      </button>
                      <button
                        className="ghost"
                        disabled={busy || BigInt(nft.invested) === 0n}
                        onClick={() =>
                          run(async () => {
                            const dest = nft.rules.approved_destinations[0];
                            await send("Demo accrue", "demo_accrue", { token_id: nft.token_id, destination: dest, bps: 500 }, { gasTgas: 50 });
                            const { hash } = await send("Harvest", "harvest", { token_id: nft.token_id, destination: dest }, { gasTgas: 150 });
                            return { text: "Accrued 5% demo yield and harvested it (split by your reinvest/owner rule).", hash };
                          })
                        }
                      >
                        Accrue 5% demo yield &amp; harvest
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {isOwner && (
                <section className="card">
                  <h3>Sell or transfer this business (owner)</h3>
                  <p className="muted">The treasury, investments, jobs and track record stay with the token. The new owner gets the whole business, and the rules can't be changed.</p>
                  <div className="row end">
                    <label className="grow">
                      New owner account
                      <input placeholder="friend.testnet" value={transferTo} onChange={(e) => setTransferTo(e.target.value.trim())} />
                    </label>
                    <button
                      disabled={busy || !transferTo || transferTo === account}
                      onClick={() =>
                        run(async () => {
                          const { hash } = await send("Transfer", "nft_transfer", { receiver_id: transferTo, token_id: nft.token_id, memo: "Mintiq business transfer" });
                          const to = transferTo;
                          setTransferTo("");
                          return { text: `Transferred "${nft.name}" to ${to}. Its treasury and track record went with it.`, hash };
                        })
                      }
                    >
                      Transfer NFT
                    </button>
                  </div>
                </section>
              )}

              <section className="card">
                <h3>Jobs board</h3>
                <p className="muted">Anyone with a testnet wallet can submit work. The agent scores it with the built-in rule-based scorer (no LLM) and records the score on-chain; only the owner can approve and pay.</p>
                {(nft.jobs || []).length === 0 && <p className="muted">No jobs yet{isOwner ? ". Post one above." : "."}</p>}
                {(nft.jobs || []).slice().reverse().map((j) => {
                  const unscored = (j.submissions || []).some((s) => !s.evaluation);
                  return (
                    <article className="job" key={j.id}>
                      <header>
                        <strong>{j.title}</strong>
                        <span className="pill">{j.status}</span>
                        <span className="muted">{usd(j.budget)} · {formatNear(j.budget)}</span>
                      </header>
                      <p>{j.description}</p>
                      {(j.submissions || []).map((s) => (
                        <div className="sub" key={s.id}>
                          <p className="muted">Submission #{s.id} from {s.contributor}{s.paid ? " · paid" : ""}</p>
                          <pre>{s.content}</pre>
                          {s.evaluation ? (
                            <p>
                              Score <strong>{s.evaluation.score}</strong> · {s.evaluation.recommend_approve ? "pass (recommends approval)" : "fail (does not recommend)"} · {s.evaluation.evaluator}
                              <br />
                              <span className="muted">{s.evaluation.reasoning}</span>
                            </p>
                          ) : (
                            <p className="muted">Not scored yet.</p>
                          )}
                          {isOwner && j.status === "Open" && s.evaluation && !s.paid && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const { hash } = await send("Approve & pay", "approve_and_pay", { token_id: nft.token_id, job_id: j.id, submission_id: s.id });
                                  return { text: `Paid ${formatNear(j.budget)} to ${s.contributor} from the NFT treasury.`, hash };
                                })
                              }
                            >
                              Approve &amp; pay {formatNear(j.budget)}
                            </button>
                          )}
                        </div>
                      ))}
                      {j.status === "Open" && unscored && nft.agent_id === AGENT && (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const res = await fetch("/api/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token_id: nft.token_id }) });
                              if (res.status === 404) throw new Error("The scoring agent isn't running on this deployment yet. Submissions stay unscored until it's set up.");
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data.error || "Agent scoring failed");
                              const last = data.actions?.[data.actions.length - 1];
                              return { text: `Agent scored ${data.actions?.length || 0} submission(s) on-chain.`, hash: last?.hash };
                            })
                          }
                        >
                          Ask agent to score
                        </button>
                      )}
                      {j.status === "Open" && (
                        <div className="sub">
                          <label>
                            Submit work {account ? `as ${account}` : "(connect a wallet)"}
                            <textarea maxLength={2000} value={submission} onChange={(e) => setSubmission(e.target.value)} placeholder="Paste the deliverable, one item per line…" />
                          </label>
                          <button
                            className="ghost"
                            disabled={busy || !submission.trim()}
                            onClick={() =>
                              run(async () => {
                                const { hash } = await send("Submit", "submit_work", { token_id: nft.token_id, job_id: j.id, content: submission });
                                setSubmission("");
                                return { text: "Submitted. Ask the agent to score it.", hash };
                              })
                            }
                          >
                            Submit work
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>

              {nft.token_id === deployed.demoTokenId && (
                <details className="card">
                  <summary>All {(deployed.transactions || []).length} demo transactions for token #{deployed.demoTokenId}, including setup</summary>
                  <ul className="tx-list">
                    {(deployed.transactions || []).map((t) => (
                      <li key={`${t.label}-${t.hash || "none"}`}>
                        <span className={t.ok ? "ok" : "err"}>{t.ok ? "PASS" : "FAIL"}</span> {t.label}
                        {t.hash && (
                          <>
                            {" · "}
                            <a href={`${TX}${t.hash}`} target="_blank" rel="noreferrer">{t.hash.slice(0, 10)}…{t.hash.slice(-6)}</a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <section className="card">
                <h3>NEAR AI Agent Market</h3>
                <p className="muted">Next, Mintiq agents will post jobs to market.near.ai so other AI agents and people can bid on them. The market has no testnet and a real job spends real USD or USDC, so this demo simulates the documented flow (post → bid → award → submit → accept) instead of spending money.</p>
              </section>
            </>
          )}
        </>
      )}

      <footer>
        <p>Mintiq · NEAR testnet · rules live in the contract · {deployed.rateLabel}</p>
      </footer>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <p className="label">{label}</p>
      <p className="value">{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}
