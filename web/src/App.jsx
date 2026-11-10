import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, Sparkles, LayoutDashboard, Menu, X, ShieldCheck, Coins, Bot, TrendingUp, ArrowRight, ExternalLink,
  Briefcase, Send, Gauge, CheckCircle2, CircleDashed, PiggyBank, Sprout, LogOut, Users, FlaskConical, Lock, Sun, Moon,
} from "lucide-react";
import { formatNear } from "./money.js";
import deployed from "./deployed.json";
import { initWallet, showModal, signedInAccount, signOut, callContract, outcomeHash, outcomeFailure, nearToYocto } from "./wallet.js";
import { friendlyError } from "./errors.js";
import { Logo, Skeleton, ToastProvider, useToast } from "./ui.jsx";
import { ActivityFeed, RuleBreakPanel, TransferPanel, RuleSentence, ResumePage, LeaderboardPage, LoopNumbers, ReserveBar, oneLine } from "./features.jsx";

import { RPC, CONTRACT, POOL, AGENT, TX, ACCT, DEMO, view, usd, nearUsd, FAUCET, STORAGE_ALLOWANCE, short, Link, NftArt } from "./shared.jsx";
export { FAUCET };

// ── Routing (path based; Vercel rewrites everything to index.html) ──────────
function parseRoute() {
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return { page: "home" };
  if (p === "/mint") return { page: "mint" };
  if (p === "/app") return { page: "app", token: new URLSearchParams(window.location.search).get("token") };
  const m = p.match(/^\/app\/(\d{1,9})$/);
  if (m) return { page: "app", token: m[1] };
  const r = p.match(/^\/nft\/(\d{1,9})$/);
  if (r) return { page: "nft", token: r[1] };
  if (p === "/leaderboard") return { page: "leaderboard" };
  return { page: "404" };
}
function useRoute() {
  const [route, setRoute] = useState(parseRoute());
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const go = useCallback((to) => {
    window.history.pushState({}, "", to);
    setRoute(parseRoute());
    window.scrollTo({ top: 0 });
  }, []);
  return [route, go];
}
const TEMPLATES = {
  custom: { label: "Blank — write your own", name: "", mission: "" },
  meme: { label: "Meme Studio", name: "Meme Studio", mission: "Build a meme production business: hire writers for original meme concepts and grow the treasury." },
  coffee: { label: "Coffee shop copy desk", name: "Corner Coffee Copy", mission: "Commission short taglines and social posts for a neighbourhood coffee shop." },
  research: { label: "Research desk", name: "Research Desk", mission: "Hire contributors to write short, sourced summaries on NEAR ecosystem projects." },
};
const DEFAULT_MINT = { template: "custom", name: "", mission: "", treasuryNear: "0.1", maxPerTaskNear: "0.05", reserveNear: "0", reinvestPct: 70, agentId: AGENT };

export default function Root() {
  return (
    <ToastProvider explorerTx={TX}>
      <App />
    </ToastProvider>
  );
}

function App() {
  const [route, go] = useRoute();
  const toast = useToast();
  const [account, setAccount] = useState(null);
  const [walletReady, setWalletReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tokens, setTokens] = useState(null);

  const loadTokens = useCallback(async () => {
    const list = await view("nft_tokens", { from_index: "0", limit: 200 });
    setTokens(list || []);
    return list || [];
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashes = params.get("transactionHashes");
    if (hashes) toast({ type: "success", title: "Transaction confirmed", body: "Sent from your wallet.", hash: hashes.split(",").pop() });
    if (params.get("errorCode")) toast({ type: "error", ...friendlyError(params.get("errorCode")) });
    loadTokens().catch((e) => toast({ type: "error", ...friendlyError(e) }));
    initWallet({ contractId: CONTRACT, rpc: RPC })
      .then(async (selector) => {
        setWalletReady(true);
        setAccount(await signedInAccount());
        selector.store.observable.subscribe((s) => setAccount(s.accounts?.find((x) => x.active)?.accountId || s.accounts?.[0]?.accountId || null));
      })
      .catch((e) => toast({ type: "error", title: "Wallets failed to load", body: e.message }));
  }, []);

  useEffect(() => setMenuOpen(false), [route.page]);

  const send = useCallback(
    async (label, method, args, { gasTgas = 30, depositYocto = 0n } = {}) => {
      if (!account) {
        showModal();
        throw new Error("Connect a testnet wallet first.");
      }
      const outcome = await callContract({ contractId: CONTRACT, method, args, gasTgas, depositYocto });
      const hash = outcomeHash(outcome);
      const fail = outcomeFailure(outcome);
      if (fail) throw Object.assign(new Error(fail), { hash });
      return { outcome, hash };
    },
    [account]
  );

  const ctx = { account, walletReady, tokens, loadTokens, send, go, toast };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="testnet-bar" role="note">
        <FlaskConical size={13} aria-hidden="true" />
        <span className="tb-long">Free on NEAR testnet · no real money · </span>
        <span className="tb-short">Free on testnet · </span>
        <a href={FAUCET} target="_blank" rel="noreferrer"><span className="tb-long">Get free test NEAR</span><span className="tb-short">Get test NEAR</span></a>
      </div>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" go={go} className="brand" aria-label="Mintiq home">
            <Logo size={26} /> <span>Mintiq</span>
          </Link>
          <nav className={`nav-links ${menuOpen ? "open" : ""}`} aria-label="Main">
            <Link to="/" go={go} aria-current={route.page === "home" ? "page" : undefined}>Overview</Link>
            <Link to="/mint" go={go} aria-current={route.page === "mint" ? "page" : undefined}>Mint</Link>
            <Link to="/app" go={go} aria-current={route.page === "app" ? "page" : undefined}>Dashboard</Link>
            <Link to="/leaderboard" go={go} aria-current={route.page === "leaderboard" ? "page" : undefined}>Leaderboard</Link>
            <div className="theme-row"><span>Theme</span><ThemeToggle /></div>
            <WalletButton {...ctx} className="nav-wallet-mobile" />
          </nav>
          <div className="nav-right">
            <ThemeToggle />
            <WalletButton {...ctx} className="nav-wallet-desktop" />
            <button className="icon-btn menu-btn" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {route.page === "home" && <Landing {...ctx} />}
        {route.page === "mint" && <MintPage {...ctx} />}
        {route.page === "app" && <Dashboard {...ctx} tokenId={route.token} />}
        {route.page === "nft" && <ResumePage tokenId={route.token} go={go} />}
        {route.page === "leaderboard" && <LeaderboardPage go={go} />}
        {route.page === "404" && <NotFound go={go} />}
      </main>
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="brand small"><Logo size={22} /> Mintiq</div>
            <p>NFTs with a treasury, a mission and an agent. Rules enforced on NEAR.</p>
            <a className="x-link" href="https://x.com/mintiq_" target="_blank" rel="noopener noreferrer" aria-label="Mintiq on X (@mintiq_)">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              @mintiq_
            </a>
          </div>
          <nav className="footer-col" aria-label="Product">
            <h4>Product</h4>
            <Link to="/mint" go={go}>Mint</Link>
            <Link to="/app" go={go}>Dashboard</Link>
            <Link to={`/app/${DEMO}`} go={go}>Demo NFT</Link>
            <Link to={`/nft/${DEMO}`} go={go}>Demo résumé</Link>
            <Link to="/leaderboard" go={go}>Leaderboard</Link>
          </nav>
          <nav className="footer-col" aria-label="Resources">
            <h4>Resources</h4>
            <a href={`${ACCT}${CONTRACT}`} target="_blank" rel="noreferrer">Contract on NearBlocks</a>
            <a href={FAUCET} target="_blank" rel="noreferrer">Testnet faucet</a>
            <a href="https://docs.near.org" target="_blank" rel="noreferrer">NEAR docs</a>
          </nav>
          <div className="footer-col">
            <h4>Testnet</h4>
            <p>Rules live in the treasury contract on NEAR testnet. Free to try, test NEAR has no cash value and the demo yield is simulated.</p>
            <p>Scoring: a built-in rule-based scorer. The NEAR AI Cloud judge is built in and switches on once the account is funded.</p>
            <p>The agent runs on its own every 15 minutes.</p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Mintiq · NEAR testnet demo</span>
          <span>Built for “NFTs That Do Something”</span>
        </div>
      </footer>
    </>
  );
}

// ── Theme (white / black). index.html sets data-theme before React renders. ─────
function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    // follow the system setting until the user picks a theme
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      let saved = null;
      try { saved = localStorage.getItem("mintiq-theme"); } catch {}
      if (saved) return;
      document.documentElement.dataset.theme = e.matches ? "dark" : "light";
      setTheme(currentTheme());
    };
    mq.addEventListener?.("change", onChange);
    const sync = () => setTheme(currentTheme());
    window.addEventListener("mintiq-theme", sync);
    return () => { mq.removeEventListener?.("change", onChange); window.removeEventListener("mintiq-theme", sync); };
  }, []);
  const next = theme === "dark" ? "light" : "dark";
  function toggle() {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mintiq-theme", next); } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0A0A0A" : "#F5F3EF");
    window.dispatchEvent(new Event("mintiq-theme"));
  }
  return (
    <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} aria-pressed={theme === "dark"}>
      {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}

function WalletButton({ account, walletReady, className }) {
  if (account)
    return (
      <button className={`btn ghost ${className}`} onClick={() => signOut()} title="Disconnect wallet" aria-label={`Disconnect ${account}`}>
        <span className="dot" aria-hidden="true" /> {short(account)} <LogOut size={15} aria-hidden="true" />
      </button>
    );
  return (
    <button className={`btn primary ${className}`} disabled={!walletReady} onClick={showModal}>
      <Wallet size={16} aria-hidden="true" /> {walletReady ? "Connect wallet" : "Loading wallets…"}
    </button>
  );
}

// ── Landing ─────────────────────────────────────────────────────────────────
function Landing({ go, account, walletReady, tokens }) {
  return (
    <>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-badge-row"><Logo size={26} /><span className="eyebrow"><Sparkles size={14} aria-hidden="true" /> NEAR · NFTs that do something</span></div>
            <h1>An NFT with a treasury, a mission, and an agent that <em>gets work done</em>.</h1>
            <p className="lead">
              Mint a Mintiq, fund it, and set the rules. Its agent posts jobs, scores the work, and invests idle funds.
              The contract enforces your caps, so the agent can never overspend, dip below the reserve, or send money somewhere you didn't approve.
            </p>
            <div className="cta-row">
              {account ? (
                <Link to="/mint" go={go} className="btn primary lg"><Sparkles size={18} aria-hidden="true" /> Mint your Mintiq</Link>
              ) : (
                <button className="btn primary lg" disabled={!walletReady} onClick={showModal}><Wallet size={18} aria-hidden="true" /> Connect wallet</button>
              )}
              {!account && <Link to="/mint" go={go} className="btn secondary lg"><Sparkles size={18} aria-hidden="true" /> Mint your Mintiq</Link>}
              <Link to={`/app/${DEMO}`} go={go} className="btn ghost lg">View demo NFT <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
            <p className="hint hero-note">{tokens ? `${tokens.length} Mintiq NFTs live on testnet.` : "Loading live testnet state…"} Free on testnet: no mint fee, and you can <a href={FAUCET} target="_blank" rel="noreferrer">get free test NEAR</a> for a testnet wallet (MyNearWallet, Meteor, HERE or Intear).</p>
          </div>
          <HeroCard tokens={tokens} />
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">How it works</h2>
        <ol className="steps-grid">
          {[
            { icon: Wallet, t: "Connect", d: "Use any NEAR testnet wallet. Your wallet signs every write; no keys live on this site." },
            { icon: Sparkles, t: "Mint", d: "Name your NFT, write its mission, fund a small treasury and set the max spend, reserve floor and earnings split." },
            { icon: Bot, t: "Agent works", d: "Post a job. Anyone can submit. Every 15 minutes the agent scores new submissions with its built-in scorer and records the score and reasoning on-chain. No one has to click." },
            { icon: CheckCircle2, t: "You approve", d: "Only you can pay a contributor. Invest idle funds in the approved pool and harvest earnings by your split." },
          ].map((s, i) => (
            <li key={s.t} className="card step">
              <span className="step-num">{i + 1}</span>
              <s.icon size={22} className="step-icon" aria-hidden="true" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container section">
        <div className="feature-grid">
          <Feature icon={ShieldCheck} t="Rules in the contract" d="Max spend per task, reserve floor and the approved investment list are checked on-chain. Overspends are rejected (ERR_OVERSPEND)." />
          <Feature icon={Lock} t="Limited agent key" d="The agent uses a NEAR function-call key that can only call job, score and invest methods on the treasury. It cannot transfer funds." />
          <Feature icon={TrendingUp} t="Earns and reinvests" d="Harvested earnings split between treasury and owner by your rule. On testnet the yield is a clearly labelled demo pool." />
          <Feature icon={Gauge} t="On-chain track record" d="Jobs completed, contributors hired, spent and earned are stored with the NFT and exposed in its NEP-171 metadata." />
        </div>
      </section>

      <section className="container section">
        <div className="live-grid">
          <ActivityFeed limit={8} title="Live on testnet" />
          <div className="card moments">
            <h3>See it in three moments</h3>
            <ol>
              <li><strong>Break the rules.</strong> Make the agent try to overspend or send funds to a stranger. The contract rejects it on-chain. <Link to={`/app/${DEMO}#rules`} go={go}>Try it</Link></li>
              <li><strong>Hire for real.</strong> Post a job, anyone submits, the agent scores it with a reason, the owner pays. <Link to={`/app/${DEMO}`} go={go}>Open the demo</Link></li>
              <li><strong>Sell the business.</strong> Transfer the NFT and its treasury, track record and agent go with it. <Link to={`/nft/${DEMO}`} go={go}>See a résumé</Link></li>
            </ol>
            <Link to="/leaderboard" go={go} className="btn ghost"><TrendingUp size={16} aria-hidden="true" /> Leaderboard</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({ icon: Icon, t, d }) {
  return (
    <div className="card feature">
      <span className="feature-icon"><Icon size={20} aria-hidden="true" /></span>
      <h3>{t}</h3>
      <p>{d}</p>
    </div>
  );
}

function HeroCard({ tokens }) {
  const [nft, setNft] = useState(null);
  useEffect(() => {
    view("get_nft", { token_id: DEMO }).then(setNft).catch(() => {});
  }, []);
  return (
    <div className="card nft-card hero-card" aria-label="Demo NFT preview">
      <NftArt id={DEMO} name={nft?.name} />
      <div className="nft-card-body">
        {nft ? (
          <>
            <div className="row-between"><h3>{nft.name}</h3><span className="badge">#{nft.token_id}</span></div>
            <p className="muted clamp2">{nft.mission}</p>
            <div className="mini-stats">
              <div><span>Liquid</span><strong>{usd(nft.liquid)}</strong></div>
              <div><span>Invested</span><strong>{usd(nft.invested)}</strong></div>
              <div><span>Jobs done</span><strong>{nft.track_record.jobs_completed}</strong></div>
            </div>
          </>
        ) : (
          <>
            <Skeleton h={22} w="60%" /><Skeleton h={14} style={{ marginTop: 10 }} /><Skeleton h={14} w="80%" style={{ marginTop: 6 }} />
            <Skeleton h={44} style={{ marginTop: 16 }} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Mint ────────────────────────────────────────────────────────────────────
function MintPage({ account, walletReady, send, go, toast, loadTokens }) {
  const [m, setM] = useState(DEFAULT_MINT);
  const [busy, setBusy] = useState(false);
  const errs = [];
  if (!m.name.trim()) errs.push("Name your NFT.");
  if (!m.mission.trim()) errs.push("Write a mission.");
  const t = Number(m.treasuryNear), r = Number(m.reserveNear), mx = Number(m.maxPerTaskNear);
  if (!(t >= 0)) errs.push("Treasury can be 0 or more test NEAR.");
  if (!(r >= 0)) errs.push("Reserve floor can be 0 or more.");
  if (t < r) errs.push("Treasury must be at least the reserve floor.");
  if (!(mx > 0)) errs.push("Max spend per task must be above zero.");
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });

  async function mint(e) {
    e.preventDefault();
    if (errs.length) return;
    setBusy(true);
    try {
      const reinvest = Math.round(Number(m.reinvestPct) * 100);
      const args = {
        name: m.name.trim(), mission: m.mission.trim(), agent_id: m.agentId.trim() || AGENT,
        max_per_task: nearToYocto(m.maxPerTaskNear).toString(), min_reserve: nearToYocto(m.reserveNear).toString(),
        reinvest_bps: reinvest, owner_share_bps: 10000 - reinvest, approved_destinations: [POOL],
      };
      const deposit = nearToYocto(String(m.treasuryNear || "0")) + nearToYocto(STORAGE_ALLOWANCE);
      const { outcome, hash } = await send("Mint", "mint", args, { depositYocto: deposit });
      let id = null;
      try { id = JSON.parse(atob(outcome?.status?.SuccessValue || "")); } catch {}
      toast({ type: "success", title: `Minted “${args.name}”`, body: id ? `Token #${id} is yours.` : "Your NFT is minted.", hash });
      await loadTokens();
      go(id ? `/app/${id}` : "/app");
    } catch (err) {
      toast({ type: "error", ...friendlyError(err), hash: err.hash });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container page">
      <div className="page-head">
        <h1>Mint your Mintiq</h1>
        <p className="lead">You own the NFT. The contract enforces the rules you set here.</p>
        <div className="free-note" role="note"><Sparkles size={16} aria-hidden="true" /> <span><strong>Free on testnet.</strong> No mint fee. You only attach test NEAR: an optional treasury (0 is fine) plus a {STORAGE_ALLOWANCE} NEAR storage allowance, and whatever storage doesn't use goes into your treasury. <a href={FAUCET} target="_blank" rel="noreferrer">Get free test NEAR</a>.</span></div>
      </div>
      <div className="mint-grid">
        <form className="card form" onSubmit={mint} noValidate>
          <Field label="Start from a template" hint="Optional. Prefills name and mission; edit freely.">
            <select value={m.template} onChange={(e) => { const tp = TEMPLATES[e.target.value]; setM({ ...m, template: e.target.value, name: tp.name, mission: tp.mission }); }}>
              {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="NFT name" hint={`${m.name.length}/64 · stored as the token title`}>
            <input required maxLength={64} placeholder="e.g. Lagos Design Guild" value={m.name} onChange={set("name")} />
          </Field>
          <Field label="Mission" hint={`${m.mission.length}/500 · what should the agent hire people to do?`}>
            <textarea required maxLength={500} rows={3} placeholder="Commission short taglines and posters for independent design studios." value={m.mission} onChange={set("mission")} />
          </Field>
          <div className="rule-sliders">
            <Field label={`Max spend per task: ${m.maxPerTaskNear || 0} test NEAR`}>
              <input type="range" min={0.01} max={1} step={0.01} value={Math.min(1, Number(m.maxPerTaskNear) || 0.01)} onChange={(e) => setM({ ...m, maxPerTaskNear: e.target.value })} aria-valuetext={`${m.maxPerTaskNear} NEAR per task`} />
            </Field>
            <Field label={`Reserve floor: ${m.reserveNear || 0} test NEAR`}>
              <input type="range" min={0} max={Math.max(1, Number(m.treasuryNear) || 0)} step={0.01} value={Number(m.reserveNear) || 0} onChange={(e) => setM({ ...m, reserveNear: e.target.value })} aria-valuetext={`${m.reserveNear} NEAR reserve`} />
            </Field>
            <Field label={`Treasury: ${m.treasuryNear || 0} test NEAR`}>
              <input type="range" min={0} max={5} step={0.05} value={Math.min(5, Number(m.treasuryNear) || 0)} onChange={(e) => setM({ ...m, treasuryNear: e.target.value })} aria-valuetext={`${m.treasuryNear} NEAR treasury`} />
            </Field>
          </div>
          <RuleSentence max={m.maxPerTaskNear} reserve={m.reserveNear} reinvest={m.reinvestPct} />
          <div className="grid3">
            <Field label="Treasury (test NEAR)" hint={`Optional, 0 is fine · top up later · + ≤${STORAGE_ALLOWANCE} storage`}>
              <input inputMode="decimal" value={m.treasuryNear} onChange={set("treasuryNear")} />
            </Field>
            <Field label="Max per task (NEAR)" hint="Cap per job, enforced on-chain">
              <input inputMode="decimal" value={m.maxPerTaskNear} onChange={set("maxPerTaskNear")} />
            </Field>
            <Field label="Reserve floor (NEAR)" hint="Always stays liquid; 0 is fine">
              <input inputMode="decimal" value={m.reserveNear} onChange={set("reserveNear")} />
            </Field>
          </div>
          <Field label={`Earnings split: ${m.reinvestPct}% reinvested · ${100 - m.reinvestPct}% to you`}>
            <input type="range" min={0} max={100} step={5} value={m.reinvestPct} onChange={(e) => setM({ ...m, reinvestPct: +e.target.value })} aria-valuetext={`${m.reinvestPct}% reinvested`} />
          </Field>
          <details className="advanced">
            <summary>Advanced</summary>
            <Field label="Agent account" hint="Default is the hosted Mintiq agent, which scores submissions for you.">
              <input value={m.agentId} onChange={set("agentId")} />
            </Field>
          </details>
          <div className="approved"><PiggyBank size={18} aria-hidden="true" /> Approved investment: <code>{POOL}</code> <span className="badge amber">demo yield</span></div>
          {errs.length > 0 && (m.name || m.mission) && <ul className="form-errors" role="alert">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
          {account ? (
            <button className="btn primary lg block" type="submit" disabled={busy || errs.length > 0}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />} {busy ? "Waiting for your wallet…" : `Mint free · ${m.treasuryNear || 0} test NEAR treasury`}
            </button>
          ) : (
            <button className="btn primary lg block" type="button" disabled={!walletReady} onClick={showModal}><Wallet size={18} aria-hidden="true" /> Connect wallet to mint</button>
          )}
        </form>
        <aside className="card nft-card preview" aria-label="Preview">
          <NftArt id="preview" name={m.name} />
          <div className="nft-card-body">
            <div className="row-between"><h3>{m.name || "Your NFT name"}</h3><span className="badge">preview</span></div>
            <p className="muted clamp3">{m.mission || "Your mission shows here."}</p>
            <div className="mini-stats">
              <div><span>Treasury</span><strong>{nearUsd(m.treasuryNear)}</strong></div>
              <div><span>Max/task</span><strong>{nearUsd(m.maxPerTaskNear)}</strong></div>
              <div><span>Reserve</span><strong>{nearUsd(m.reserveNear)}</strong></div>
            </div>
            <p className="hint">Free test NEAR from the <a href={FAUCET} target="_blank" rel="noreferrer">NEAR testnet faucet</a>. 0.1 NEAR is plenty to try a job.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ tokenId, tokens, account, send, toast, go, loadTokens }) {
  const [nft, setNft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(null);
  const selected = tokenId || (account && tokens?.find((t) => t.owner_id === account)?.token_id) || DEMO;

  const load = useCallback(async () => {
    setLoading(true);
    try { setNft(await view("get_nft", { token_id: String(selected) })); } catch { setNft(false); }
    setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (nft && window.location.hash === "#rules") setTimeout(() => document.getElementById("rules")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [nft?.token_id]);

  const list = useMemo(() => (mine && account ? (tokens || []).filter((t) => t.owner_id === account) : tokens || []), [tokens, mine, account]);
  const isOwner = account && nft && nft.owner_id === account;

  async function act(key, fn) {
    setBusy(key);
    try {
      const r = await fn();
      if (r) toast({ type: "success", ...r });
      await Promise.all([load(), loadTokens()]);
    } catch (err) {
      toast({ type: "error", ...friendlyError(err), hash: err.hash });
    } finally {
      setBusy(null);
    }
  }

  const idle = nft
    ? (() => {
        const open = (nft.jobs || []).filter((j) => j.status === "Open").reduce((a, j) => a + BigInt(j.budget), 0n);
        const v = BigInt(nft.liquid) - BigInt(nft.rules.min_reserve) - open;
        return v > 0n ? v : 0n;
      })()
    : 0n;

  return (
    <section className="container page">
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Live contract state from NEAR testnet.</p>
        </div>
        <div className="picker">
          <label className="field compact">
            <span className="field-label">NFT</span>
            {tokens ? (
              <select value={String(selected)} onChange={(e) => go(`/app/${e.target.value}`)}>
                {list.map((t) => <option key={t.token_id} value={t.token_id}>#{t.token_id} · {t.metadata?.title || "Untitled"}{t.owner_id === account ? " (yours)" : ""}</option>)}
                {!list.some((t) => t.token_id === String(selected)) && <option value={selected}>#{selected}</option>}
              </select>
            ) : <Skeleton h={40} w={260} />}
          </label>
          {account && (
            <label className="toggle">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine ({(tokens || []).filter((t) => t.owner_id === account).length})
            </label>
          )}
          <Link to="/mint" go={go} className="btn secondary"><Sparkles size={16} aria-hidden="true" /> Mint new</Link>
        </div>
      </div>

      {loading && !nft && <DashSkeleton />}
      {nft === false && !loading && (
        <div className="card empty"><h2>Token #{selected} not found</h2><p className="muted">It may not exist yet.</p><Link to="/app" go={go} className="btn primary">Back to dashboard</Link></div>
      )}

      {nft && (
        <>
          <div className="dash-top">
            <div className="card nft-card">
              <NftArt id={nft.token_id} name={nft.name} />
              <div className="nft-card-body">
                <div className="row-between"><h2>{nft.name}</h2><span className="badge">#{nft.token_id}</span></div>
                <p className="muted">{nft.mission}</p>
                <dl className="meta">
                  <div><dt>Owner</dt><dd><a href={`${ACCT}${nft.owner_id}`} target="_blank" rel="noreferrer">{short(nft.owner_id)}</a>{isOwner && <span className="badge green">you</span>}</dd></div>
                  <div><dt>Agent</dt><dd><a href={`${ACCT}${nft.agent_id}`} target="_blank" rel="noreferrer">{short(nft.agent_id)}</a></dd></div>
                  <div><dt>Split</dt><dd>{nft.rules.reinvest_bps / 100}% reinvest · {nft.rules.owner_share_bps / 100}% owner</dd></div>
                </dl>
              </div>
            </div>
            <div className="stat-grid">
              <Stat icon={Coins} label="Liquid treasury" value={usd(nft.liquid)} sub="Test NEAR · free" />
              <Stat icon={Sprout} label="Invested" value={usd(nft.invested)} sub="Demo yield pool" tag="demo" />
              <Stat icon={ShieldCheck} label="Reserve floor" value={usd(nft.rules.min_reserve)} sub={`Max per task ${usd(nft.rules.max_per_task)}`} />
              <Stat icon={PiggyBank} label="Idle to invest" value={usd(idle.toString())} sub="After open job budgets" />
              <Stat icon={Briefcase} label="Jobs completed" value={nft.track_record.jobs_completed} />
              <Stat icon={Users} label="Contributors hired" value={nft.track_record.contributors_hired} />
              <Stat icon={Send} label="Total spent" value={usd(nft.track_record.total_spent)} />
              <Stat icon={TrendingUp} label="Total earned" value={usd(nft.track_record.total_earned)} sub="Demo yield, no cost to you" />
            </div>
          </div>

          <div className="card notice auto-note"><Bot size={18} aria-hidden="true" /> The agent runs on its own every 15 minutes. It scores new submissions and invests idle funds within these rules. Only the owner can approve payment.</div>

          <div id="rules"><RuleBreakPanel nft={nft} /></div>

          <ActivityFeed tokenId={String(nft.token_id)} limit={8} title="This NFT's activity" showToken={false} />

          <LoopNumbers nft={nft} />
          <div className="card health-card"><ReserveBar nft={nft} /><Link to={`/nft/${nft.token_id}`} go={go} className="btn ghost sm">View résumé <ArrowRight size={15} aria-hidden="true" /></Link></div>

          {isOwner ? (
            <OwnerPanel nft={nft} idle={idle} busy={busy} act={act} send={send} />
          ) : (
            <div className="card notice"><Lock size={18} aria-hidden="true" /> {account ? "You're viewing someone else's NFT. You can submit work to open jobs." : "Connect a wallet to submit work, or mint your own NFT to post jobs."}</div>
          )}

          <JobsBoard nft={nft} account={account} isOwner={isOwner} busy={busy} act={act} send={send} />

          {isOwner && <TransferPanel nft={nft} send={send} toast={toast} onDone={() => Promise.all([load(), loadTokens()])} />}

          {nft.token_id === DEMO && (deployed.transactions || []).length > 0 && (
            <details className="card txs">
              <summary>Scripted demo transactions for token #{DEMO} ({deployed.transactions.length})</summary>
              <ul>
                {deployed.transactions.map((t) => (
                  <li key={`${t.label}-${t.hash}`}>
                    <span className={`badge ${t.ok ? "green" : "red"}`}>{t.ok ? "PASS" : "FAIL"}</span> {t.label}
                    {t.hash && <a href={`${TX}${t.hash}`} target="_blank" rel="noreferrer" aria-label={`Open transaction ${t.hash}`}><ExternalLink size={14} /></a>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function DashSkeleton() {
  return (
    <div className="dash-top" aria-busy="true" aria-label="Loading NFT">
      <div className="card"><Skeleton h={150} r={14} style={{ borderRadius: 20 }} className="skel-block" /><div style={{ padding: 18 }}><Skeleton h={24} w="50%" /><Skeleton h={14} style={{ marginTop: 10 }} /><Skeleton h={14} w="70%" style={{ marginTop: 6 }} /></div></div>
      <div className="stat-grid">{Array.from({ length: 8 }).map((_, i) => <div className="card stat" key={i}><Skeleton h={12} w="50%" /><Skeleton h={26} w="70%" style={{ marginTop: 10 }} /></div>)}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tag }) {
  return (
    <div className="card stat">
      <div className="stat-top"><span className="stat-icon"><Icon size={16} aria-hidden="true" /></span>{label}{tag && <span className="badge amber">{tag}</span>}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function OwnerPanel({ nft, idle, busy, act, send }) {
  const [job, setJob] = useState({ title: "3 taglines for a design studio", description: "Write 3 short original taglines for an independent design studio.", budgetNear: "0.05" });
  const [amt, setAmt] = useState("");
  const [topup, setTopup] = useState("0.1");
  const dest = nft.rules.approved_destinations[0];
  return (
    <div className="owner-grid">
      <form className="card form" onSubmit={(e) => { e.preventDefault(); act("post", async () => {
        const { hash } = await send("Post job", "post_job", { token_id: nft.token_id, title: job.title, description: job.description, budget: nearToYocto(job.budgetNear || "0").toString() });
        return { title: "Job posted", body: `“${job.title}” is open for submissions.`, hash };
      }); }}>
        <h3><Briefcase size={18} aria-hidden="true" /> Post a job</h3>
        <Field label="Title"><input maxLength={120} value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} /></Field>
        <Field label="Brief"><textarea rows={2} maxLength={1000} value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} /></Field>
        <Field label="Budget (NEAR)" hint={`Max ${formatNear(nft.rules.max_per_task)}; more is rejected by the contract`}>
          <input inputMode="decimal" value={job.budgetNear} onChange={(e) => setJob({ ...job, budgetNear: e.target.value })} />
        </Field>
        <button className="btn primary" disabled={!!busy}>{busy === "post" ? <span className="spinner" /> : <Send size={16} aria-hidden="true" />} Post job</button>
      </form>
      <div className="card form">
        <h3><Sprout size={18} aria-hidden="true" /> Invest &amp; harvest <span className="badge amber">demo yield</span></h3>
        <p className="muted small">Idle funds can only go to <code>{dest}</code>, and never below the reserve.</p>
        <Field label="Amount (NEAR)" hint={`Idle now: ${formatNear(idle.toString())}`}>
          <input inputMode="decimal" placeholder={formatNear(idle.toString()).replace(" NEAR", "")} value={amt} onChange={(e) => setAmt(e.target.value)} />
        </Field>
        <div className="btn-row">
          <button className="btn primary" disabled={!!busy} onClick={() => act("invest", async () => {
            const amount = amt ? nearToYocto(amt) : idle;
            if (amount <= 0n) throw new Error("ERR_RESERVE");
            const { hash } = await send("Invest", "invest_idle", { token_id: nft.token_id, destination: dest, amount: amount.toString() }, { gasTgas: 100 });
            setAmt("");
            return { title: "Invested", body: `${formatNear(amount.toString())} moved to the demo yield pool.`, hash };
          })}>{busy === "invest" ? <span className="spinner" /> : <PiggyBank size={16} aria-hidden="true" />} Invest idle</button>
          <button className="btn secondary" disabled={!!busy || BigInt(nft.invested) === 0n} onClick={() => act("harvest", async () => {
            await send("Accrue", "demo_accrue", { token_id: nft.token_id, destination: dest, bps: 500 }, { gasTgas: 50 });
            const { hash } = await send("Harvest", "harvest", { token_id: nft.token_id, destination: dest }, { gasTgas: 150 });
            return { title: "Harvested demo yield", body: "5% demo yield accrued and split by your reinvest/owner rule.", hash };
          })}>{busy === "harvest" ? <span className="spinner" /> : <TrendingUp size={16} aria-hidden="true" />} Accrue 5% &amp; harvest</button>
        </div>
        <p className="hint">Demo yield is simulated on testnet and costs you nothing.</p>
        <Field label="Top up treasury (test NEAR)" hint={<>Free test NEAR from the <a href={FAUCET} target="_blank" rel="noreferrer">faucet</a>.</>}>
          <div className="submit-form">
            <input inputMode="decimal" value={topup} onChange={(e) => setTopup(e.target.value)} />
            <button className="btn ghost" type="button" disabled={!!busy || !(Number(topup) > 0)} onClick={() => act("fund", async () => {
              const { hash } = await send("Top up", "fund", { token_id: nft.token_id }, { depositYocto: nearToYocto(topup) });
              return { title: "Treasury topped up", body: `${topup} test NEAR added to the treasury.`, hash };
            })}>{busy === "fund" ? <span className="spinner" /> : <Coins size={16} aria-hidden="true" />} Add funds</button>
          </div>
        </Field>
      </div>
    </div>
  );
}

/** Name the scorer that actually scored this NFT's work, not the one we hope to use. */
function scorerLabel(nft) {
  const evals = (nft.jobs || []).flatMap((j) => (j.submissions || []).map((s) => s.evaluation).filter(Boolean));
  const ai = evals.some((e) => /^NEAR AI Cloud/.test(e.evaluator || ""));
  if (ai) return "Scored by NEAR AI Cloud, with the built-in scorer as backup";
  return "Scored by the built-in rule-based scorer · NEAR AI judge ready, not yet funded";
}

function JobsBoard({ nft, account, isOwner, busy, act, send }) {
  const [drafts, setDrafts] = useState({});
  const jobs = (nft.jobs || []).slice().reverse();
  return (
    <section className="jobs">
      <div className="row-between"><h2>Jobs</h2><span className="muted small">{scorerLabel(nft)}</span></div>
      {jobs.length === 0 && <div className="card empty"><Briefcase size={28} aria-hidden="true" /><p>No jobs yet.{isOwner ? " Post one above." : ""}</p></div>}
      {jobs.map((j) => {
        const unscored = (j.submissions || []).filter((s) => !s.evaluation).length;
        return (
          <article className="card job" key={j.id}>
            <header className="job-head">
              <div><h3>{j.title}</h3><p className="muted small">{j.description}</p></div>
              <div className="job-tags"><span className={`badge ${j.status === "Paid" ? "green" : "violet"}`}>{j.status}</span><span className="badge">{formatNear(j.budget)}</span></div>
            </header>
            {(j.submissions || []).length === 0 && <p className="muted small">No submissions yet.</p>}
            <div className="subs">
              {(j.submissions || []).map((s) => (
                <div className={`sub ${s.paid ? "paid" : ""}`} key={s.id}>
                  <div className="sub-head">
                    <span className="muted small">#{s.id} · {short(s.contributor)}</span>
                    {s.evaluation ? (
                      <span className={`score ${s.evaluation.recommend_approve ? "pass" : "fail"}`} title={s.evaluation.reasoning}>
                        {s.evaluation.recommend_approve ? <CheckCircle2 size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />} {s.evaluation.score}/100 {s.evaluation.recommend_approve ? "pass" : "fail"}
                      </span>
                    ) : <span className="score pending"><CircleDashed size={14} aria-hidden="true" /> not scored</span>}
                    {s.paid && <span className="badge green">paid</span>}
                  </div>
                  <pre>{s.content}</pre>
                  {s.evaluation && <p className="agent-says"><Bot size={14} aria-hidden="true" /> <strong>Agent:</strong> {oneLine(s.evaluation.reasoning)}</p>}
                  {s.evaluation && <details className="muted small"><summary>Full reasoning</summary>{s.evaluation.reasoning}</details>}
                  {s.evaluation && <p className="scored-by small"><Bot size={13} aria-hidden="true" /> Scored by {s.evaluation.evaluator || "unknown"}</p>}
                  {isOwner && j.status === "Open" && s.evaluation && !s.paid && (
                    <button className="btn primary sm" disabled={!!busy} onClick={() => act(`pay${s.id}`, async () => {
                      const { hash } = await send("Pay", "approve_and_pay", { token_id: nft.token_id, job_id: j.id, submission_id: s.id });
                      return { title: "Paid contributor", body: `${formatNear(j.budget)} sent to ${s.contributor} from the NFT treasury.`, hash };
                    })}>{busy === `pay${s.id}` ? <span className="spinner" /> : <Coins size={15} aria-hidden="true" />} Approve &amp; pay {formatNear(j.budget)}</button>
                  )}
                </div>
              ))}
            </div>
            {j.status === "Open" && (
              <div className="job-actions">
                {unscored > 0 && nft.agent_id === AGENT && (
                  <button className="btn secondary sm" disabled={!!busy} onClick={() => act(`score${j.id}`, async () => {
                    const res = await fetch("/api/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token_id: nft.token_id }) });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || "Agent scoring failed");
                    const last = data.actions?.[data.actions.length - 1];
                    return { title: "Agent scored the work", body: `${data.actions?.length || 0} submission(s) scored on-chain by the agent.`, hash: last?.hash };
                  })}>{busy === `score${j.id}` ? <span className="spinner" /> : <Bot size={15} aria-hidden="true" />} Ask agent to score ({unscored})</button>
                )}
                <form className="submit-form" onSubmit={(e) => { e.preventDefault(); const c = (drafts[j.id] || "").trim(); if (!c) return; act(`sub${j.id}`, async () => {
                  const { hash } = await send("Submit", "submit_work", { token_id: nft.token_id, job_id: j.id, content: c });
                  setDrafts({ ...drafts, [j.id]: "" });
                  return { title: "Work submitted", body: "Ask the agent to score it.", hash };
                }); }}>
                  <label className="sr-only" htmlFor={`sub-${j.id}`}>Your submission for {j.title}</label>
                  <textarea id={`sub-${j.id}`} rows={2} maxLength={2000} placeholder={account ? "Paste your work, one item per line…" : "Connect a wallet to submit work"} value={drafts[j.id] || ""} onChange={(e) => setDrafts({ ...drafts, [j.id]: e.target.value })} />
                  <button className="btn ghost sm" disabled={!!busy || !(drafts[j.id] || "").trim()}>{busy === `sub${j.id}` ? <span className="spinner" /> : <Send size={15} aria-hidden="true" />} Submit</button>
                </form>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function NotFound({ go }) {
  return (
    <section className="container page notfound">
      <div className="nf-mark"><Logo size={96} /></div>
      <p className="eyebrow">404</p>
      <h1>This page isn't on-chain.</h1>
      <p className="lead">The link may be broken, or the page was moved.</p>
      <div className="cta-row center">
        <Link to="/" go={go} className="btn primary"><ArrowRight size={16} aria-hidden="true" /> Go home</Link>
        <Link to="/app" go={go} className="btn ghost"><LayoutDashboard size={16} aria-hidden="true" /> Open dashboard</Link>
      </div>
    </section>
  );
}
