#!/usr/bin/env node
/**
 * Finish remaining testnet demo writes after rpc.testnet.near.org started
 * returning -429. Uses FastNear. Keys stay in .mintiq/ and are never printed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, keyStores, KeyPair, utils } from "near-api-js";
import { evaluateSubmission, SCORER_LABEL } from "../app/src/evaluator.js";
import { USD_PER_NEAR, RATE_LABEL, usdToYocto, yoctoToUsd, formatUsd, formatNear } from "../app/src/money.js";
import { redact, txHashFrom } from "./lib-redact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, ".mintiq");
const NETWORK_ID = "testnet";
const RPC = "https://test.rpc.fastnear.com";
const EXPLORER_TX = "https://testnet.nearblocks.io/txns/";
const EXPLORER_TX_ALT = "https://explorer.testnet.near.org/transactions/";
const EXPLORER_ACCT = "https://testnet.nearblocks.io/address/";
const GAS = 30_000_000_000_000n;
const GAS_HEAVY = 80_000_000_000_000n;
const YOCTO = 10n ** 24n;

function explorerTx(hash) {
  if (!hash) return null;
  return { nearblocks: `${EXPLORER_TX}${hash}`, explorer: `${EXPLORER_TX_ALT}${hash}` };
}
function accountLink(id) { return `${EXPLORER_ACCT}${id}`; }
function parseNear(n) { return BigInt(utils.format.parseNearAmount(String(n))); }
function log(title, data) {
  console.log(`\n== ${title} ==`);
  console.log(typeof data === "string" ? redact(data) : redact(JSON.stringify(data, null, 2)));
}
function readKey(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  return { accountId: raw.account_id || raw.accountId, secretKey: raw.private_key || raw.secret_key || raw.secretKey };
}
async function connectAccount(accountId, secretKey) {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, accountId, KeyPair.fromString(secretKey));
  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC, keyStore });
  return near.account(accountId);
}
async function recordCall(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const result = await fn();
      const hash = txHashFrom(result);
      console.log(`PASS  ${label}${hash ? `  ${hash}` : ""}`);
      return { label, ok: true, hash, explorer: explorerTx(hash), result };
    } catch (err) {
      lastErr = err;
      const msg = redact(err?.message || err);
      const retryable = / -429 |TIMEOUT|429|deprecated|gateway timeout|ECONNRESET|fetch failed/i.test(msg);
      const hash = txHashFrom(err) || txHashFrom(err?.cause) || txHashFrom(err?.context) || null;
      console.log(`FAIL  ${label}${hash ? `  ${hash}` : ""} (attempt ${attempt})${retryable ? " — retrying" : ""}`);
      console.log(`      ${msg.split("\n")[0].slice(0, 300)}`);
      if (!retryable || attempt === 5) {
        return { label, ok: false, hash, explorer: explorerTx(hash), error: msg.split("\n")[0].slice(0, 300) };
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return { label, ok: false, hash: null, explorer: null, error: redact(lastErr?.message || lastErr) };
}

const memes = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.
3. "Reserve floor, comedy ceiling" — a bouncer at a club named $20.
4. "Yield, then punchline" — a staking pool telling dad jokes.
5. "Owner signs, agent suggests" — two stamps: SCORE 88 and PAY.`;
const offTopic = `Here is my lasagna recipe.
Boil 12 sheets of pasta, brown a pound of ground beef with onion,
layer with ricotta and tomato sauce, bake at 375°F for 45 minutes.
I also fixed a typo in the office Wi-Fi password documentation.
This has nothing to do with memes.`;

async function main() {
  delete process.env.NEARAI_JUDGE;
  delete process.env.MINTIQ_NEARAI_JUDGE;
  const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "testnet.json"), "utf8"));
  cfg.rpc = RPC;
  const mintiqId = cfg.contracts.mintiq;
  const yieldId = cfg.contracts.yieldPool;
  const tokenId = String(cfg.demoTokenId || "1");

  const ownerKey = readKey("testnet-owner.json");
  const agentKey = readKey("testnet-agent.json");
  const contribKey = readKey("testnet-contributor.json");
  const owner = await connectAccount(ownerKey.accountId, ownerKey.secretKey);
  const agent = await connectAccount(agentKey.accountId, agentKey.secretKey);
  const contrib = await connectAccount(contribKey.accountId, contribKey.secretKey);
  const viewer = owner;

  const txs = [];
  const nft0 = await viewer.viewFunction({ contractId: mintiqId, methodName: "get_nft", args: { token_id: tokenId } });
  const job = (nft0.jobs || [])[0];
  if (!job) throw new Error("Job 1 is missing on-chain; cannot continue.");
  const subs = job.submissions || [];
  log("Current on-chain state", {
    rpc: RPC,
    jobStatus: job.status,
    submissions: subs.map((s) => ({ id: s.id, paid: s.paid, hasEval: Boolean(s.evaluation), preview: String(s.content || "").slice(0, 40) })),
    liquid: formatUsd(yoctoToUsd(nft0.liquid)),
    invested: formatUsd(yoctoToUsd(nft0.invested)),
    jobs_completed: nft0.track_record.jobs_completed,
  });

  const hasOffTopic = subs.some((s) => /lasagna/i.test(s.content || ""));
  if (!hasOffTopic) {
    txs.push(await recordCall("Contributor submitted the off-topic lasagna text", () =>
      contrib.functionCall({
        contractId: mintiqId,
        methodName: "submit_work",
        args: { token_id: tokenId, job_id: 1, content: offTopic },
        gas: GAS,
        attachedDeposit: 0n,
      })
    ));
  } else {
    console.log("PASS  Off-topic submission already on-chain.");
  }

  const jobBrief = { title: "5 original memes, $5", description: "Deliver 5 original meme concepts for the studio. Budget $5." };
  const evGood = await evaluateSubmission(jobBrief, memes);
  const evBad = await evaluateSubmission(jobBrief, offTopic);
  log("Scorer (good)", { score: evGood.score, passed: evGood.passed, label: evGood.label, reasoning: evGood.reasoning });
  log("Scorer (off-topic)", { score: evBad.score, passed: evBad.passed, label: evBad.label, reasoning: evBad.reasoning });

  const nft1 = await viewer.viewFunction({ contractId: mintiqId, methodName: "get_nft", args: { token_id: tokenId } });
  const job1 = (nft1.jobs || [])[0];
  for (const s of job1.submissions || []) {
    if (s.evaluation) {
      console.log(`PASS  Submission ${s.id} already has an on-chain evaluation.`);
      continue;
    }
    const ev = /lasagna/i.test(s.content || "") ? evBad : evGood;
    txs.push(await recordCall(`Agent recorded score for submission ${s.id}`, () =>
      agent.functionCall({
        contractId: mintiqId,
        methodName: "record_evaluation",
        args: {
          token_id: tokenId,
          job_id: 1,
          submission_id: Number(s.id),
          score: ev.score,
          reasoning: ev.reasoning,
          recommend_approve: ev.recommend_approve,
          evaluator: ev.evaluator,
        },
        gas: GAS,
        attachedDeposit: 0n,
      })
    ));
  }

  const nft2 = await viewer.viewFunction({ contractId: mintiqId, methodName: "get_nft", args: { token_id: tokenId } });
  const job2 = (nft2.jobs || [])[0];
  if (job2.status === "Paid" || (job2.submissions || []).some((s) => s.paid)) {
    console.log("PASS  Good submission already paid.");
  } else {
    const good = (job2.submissions || []).find((s) => !/lasagna/i.test(s.content || ""));
    if (!good) throw new Error("Good submission missing.");
    txs.push(await recordCall("Owner approved and paid the good submission", () =>
      owner.functionCall({
        contractId: mintiqId,
        methodName: "approve_and_pay",
        args: { token_id: tokenId, job_id: 1, submission_id: Number(good.id) },
        gas: 40_000_000_000_000n,
        attachedDeposit: 0n,
      })
    ));
  }

  const nft3 = await viewer.viewFunction({ contractId: mintiqId, methodName: "get_nft", args: { token_id: tokenId } });
  if (BigInt(nft3.invested) > 0n) {
    console.log(`PASS  Already invested ${formatUsd(yoctoToUsd(nft3.invested))}.`);
  } else {
    const idle = BigInt(nft3.liquid) - BigInt(nft3.rules.min_reserve);
    if (idle <= 0n) throw new Error("No idle funds above the reserve to invest.");
    txs.push(await recordCall(`Invest idle ${formatUsd(yoctoToUsd(idle.toString()))} in demo yield pool`, () =>
      agent.functionCall({
        contractId: mintiqId,
        methodName: "invest_idle",
        args: { token_id: tokenId, destination: yieldId, amount: idle.toString() },
        gas: GAS_HEAVY,
        attachedDeposit: 0n,
      })
    ));
    txs.push(await recordCall("Accrue 5% demo yield (labelled, not real staking)", () =>
      agent.functionCall({
        contractId: mintiqId,
        methodName: "demo_accrue",
        args: { token_id: tokenId, destination: yieldId, bps: 500 },
        gas: GAS,
        attachedDeposit: 0n,
      })
    ));
    txs.push(await recordCall("Harvest demo yield back to the treasury", () =>
      agent.functionCall({
        contractId: mintiqId,
        methodName: "harvest",
        args: { token_id: tokenId, destination: yieldId },
        gas: GAS_HEAVY,
        attachedDeposit: 0n,
      })
    ));
  }

  const nft = await viewer.viewFunction({ contractId: mintiqId, methodName: "get_nft", args: { token_id: tokenId } });
  const evs = {};
  for (const s of (nft.jobs || [])[0]?.submissions || []) {
    const kind = /lasagna/i.test(s.content || "") ? "offTopic" : "good";
    evs[kind] = s.evaluation
      ? { score: s.evaluation.score, passed: s.evaluation.recommend_approve, label: s.evaluation.evaluator, reasoning: s.evaluation.reasoning }
      : kind === "offTopic"
        ? { score: evBad.score, passed: evBad.passed, label: evBad.label, reasoning: evBad.reasoning }
        : { score: evGood.score, passed: evGood.passed, label: evGood.label, reasoning: evGood.reasoning };
  }

  // Merge previous report txs with new ones.
  let prev = [];
  const prevPath = path.join(DIR, "testnet-report.json");
  if (fs.existsSync(prevPath)) {
    try { prev = JSON.parse(fs.readFileSync(prevPath, "utf8")).transactions || []; } catch {}
  }
  const merged = [...prev];
  for (const t of txs) {
    const { result, ...rest } = t;
    const idx = merged.findIndex((x) => x.label === rest.label);
    if (idx >= 0) merged[idx] = rest;
    else merged.push(rest);
  }

  cfg.rpc = RPC;
  fs.writeFileSync(path.join(DIR, "testnet.json"), JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });

  const publicReport = {
    networkId: NETWORK_ID,
    rpc: RPC,
    explorerTx: EXPLORER_TX,
    explorerTxAlt: EXPLORER_TX_ALT,
    explorerAccount: EXPLORER_ACCT,
    contracts: cfg.contracts,
    accounts: {
      owner: cfg.accounts.owner.accountId,
      agent: cfg.accounts.agent.accountId,
      contributor: cfg.accounts.contributor.accountId,
    },
    accountExplorer: {
      mintiq: accountLink(mintiqId),
      yieldPool: accountLink(yieldId),
      owner: accountLink(cfg.accounts.owner.accountId),
      agent: accountLink(cfg.accounts.agent.accountId),
      contributor: accountLink(cfg.accounts.contributor.accountId),
    },
    demoTokenId: tokenId,
    usdPerNear: USD_PER_NEAR,
    rateLabel: RATE_LABEL,
    evaluator: SCORER_LABEL,
    evaluations: evs,
    trackRecord: {
      jobs_completed: nft.track_record.jobs_completed,
      contributors_hired: nft.track_record.contributors_hired,
      total_spent: formatUsd(yoctoToUsd(nft.track_record.total_spent)),
      total_earned: formatUsd(yoctoToUsd(nft.track_record.total_earned)),
      liquid: formatUsd(yoctoToUsd(nft.liquid)),
      invested: formatUsd(yoctoToUsd(nft.invested)),
    },
    transactions: merged,
    visitorCapabilities: {
      publicCan: [
        "View live contract state (NFT, treasury, jobs, scores, track record) via testnet RPC",
        "Follow explorer links for every recorded transaction",
      ],
      publicCannot: [
        "Mint, post, submit, score, approve, pay, invest, or harvest from the public dashboard (no keys in the browser)",
        "Use a live Agent Market job (still a local simulation only; the market has no testnet)",
      ],
    },
    writtenAt: new Date().toISOString(),
    rpcNote: "Uses https://test.rpc.fastnear.com because rpc.testnet.near.org returned HTTP -429 / deprecated mid-demo.",
  };
  fs.writeFileSync(path.join(DIR, "testnet-report.json"), JSON.stringify(publicReport, null, 2) + "\n");
  fs.writeFileSync(path.join(ROOT, "web/src/deployed.json"), JSON.stringify(publicReport, null, 2) + "\n");

  const failed = txs.filter((t) => !t.ok);
  log("Continue summary", {
    evaluations: evs,
    trackRecord: publicReport.trackRecord,
    newTxs: txs.map((t) => ({ label: t.label, ok: t.ok, hash: t.hash })),
    failed: failed.length,
  });
  if (failed.length) {
    process.exitCode = 1;
  } else {
    console.log("\nRemaining testnet writes completed on FastNear RPC. Keys were not printed.");
  }
}

main().catch((err) => {
  console.error(redact(err?.stack || err?.message || err));
  process.exit(1);
});
