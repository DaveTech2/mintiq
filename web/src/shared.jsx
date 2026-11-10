import deployed from "./deployed.json";
import { formatNear } from "./money.js";
import { viewMethod } from "./rpc.js";

export const RPC = deployed.rpc;
export const CONTRACT = deployed.contracts.mintiq;
export const POOL = deployed.contracts.yieldPool;
export const AGENT = deployed.accounts.agent;
export const TX = deployed.explorerTx;
export const ACCT = deployed.explorerAccount;
export const DEMO = deployed.demoTokenId || "1";
export const view = (method, args = {}) => viewMethod(RPC, CONTRACT, method, args);
// Free on testnet: amounts are shown in test NEAR only (no cash value, no USD rate).
export const usd = (y) => formatNear(y);
export const nearUsd = (n) => (Number.isFinite(Number(n)) ? `${Number(n)} NEAR` : "—");
export const FAUCET = "https://docs.near.org/getting-started/faucet";
export const STORAGE_ALLOWANCE = "0.02";
export const short = (a) => (a && a.length > 22 ? `${a.slice(0, 9)}…${a.slice(-9)}` : a);


export function Link({ to, go, children, className, ...rest }) {
  return (
    <a href={to} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to); }} {...rest}>
      {children}
    </a>
  );
}


/** Deterministic generative art per token: gradient blob + hexagon mark. */
export function NftArt({ id = "1", name = "", small }) {
  // Deterministic brand-palette art: black card, green/cream shapes, logo mark.
  const seed = [...String(id) + name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  const r1 = 40 + (seed % 40), cx = 30 + (seed % 140), cy = 20 + ((seed * 7) % 80);
  const rot = (seed * 13) % 360;
  return (
    <div className={`nft-art ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="120" fill="#0B0B0B" />
        <circle cx={cx} cy={cy} r={r1} fill="#94C447" opacity="0.9" />
        <circle cx={200 - cx / 2} cy={120 - cy / 3} r={r1 * 0.7} fill="none" stroke="#F5F3EF" strokeWidth="1.5" opacity="0.5" />
        <g transform={`translate(100 60) rotate(${rot})`} opacity="0.35">
          <rect x="-70" y="-3" width="140" height="6" rx="3" fill="#F5F3EF" />
        </g>
        <rect x="68" y="28" width="64" height="64" rx="16" fill="#F5F3EF" />
        <image href="/mintiq-mark.png" x="74" y="34" width="52" height="52" />
      </svg>
    </div>
  );
}

