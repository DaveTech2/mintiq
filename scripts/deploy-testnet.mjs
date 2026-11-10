#!/usr/bin/env node
/**
 * Create faucet-sponsored NEAR testnet accounts, deploy Mintiq contracts,
 * restrict the agent key, and run the scripted demo flow on testnet.
 *
 * Private keys are written only to gitignored .mintiq/ files (mode 0600)
 * and are never printed or logged.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { connect, keyStores, KeyPair, utils } from "near-api-js";
import { evaluateSubmission, SCORER_LABEL } from "../app/src/evaluator.js";
import { USD_PER_NEAR, RATE_LABEL, usdToYocto, yoctoToUsd, formatUsd, formatNear } from "../app/src/money.js";
import { redact, txHashFrom } from "./lib-redact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, ".mintiq");
const WASM_MINTIQ = path.join(ROOT, "res/mintiq.wasm");
const WASM_YIELD = path.join(ROOT, "res/mintiq_yield_pool.wasm");
const NETWORK_ID = "testnet";
const RPCS = [
  "https://test.rpc.fastnear.com",
  "https://neart.lava.build",
  "https://rpc.testnet.near.org",
];
const FAUCETS = [
  "https://helper.nearprotocol.com/account",
  "https://helper.testnet.near.org/account",
];
const EXPLORER_TX = "https://testnet.nearblocks.io/txns/";
const EXPLORER_TX_ALT = "https://explorer.testnet.near.org/transactions/";
const EXPLORER_ACCT = "https://testnet.nearblocks.io/address/";
const AGENT_METHODS = [
  "post_job",
  "record_evaluation",
  "invest_idle",
  "harvest",
  "demo_accrue",
];
const STORAGE_BUFFER = "50000000000000000000000"; // 0.05 NEAR
const YOCTO = 10n ** 24n;
const GAS = 30_000_000_000_000n;
const GAS_HEAVY = 80_000_000_000_000n;

fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });

function log(title, data) {
  console.log(`\n== ${title} ==`);
  if (typeof data === "string") console.log(redact(data));
  else console.log(redact(JSON.stringify(data, null, 2)));
}

function writeKey(file, accountId, secretKey) {
  const abs = path.join(DIR, file);
  fs.writeFileSync(abs, JSON.stringify({ account_id: accountId, private_key: secretKey }, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(abs, 0o600);
  return path.relative(ROOT, abs);
}

function writeJson(file, obj, mode = 0o600) {
  const abs = path.join(DIR, file);
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n", { mode });
  fs.chmodSync(abs, mode);
  return abs;
}

function explorerTx(hash) {
  if (!hash) return null;
  return { nearblocks: `${EXPLORER_TX}${hash}`, explorer: `${EXPLORER_TX_ALT}${hash}` };
}

function accountLink(id) {
  return `${EXPLORER_ACCT}${id}`;
}

function parseNear(n) {
  return BigInt(utils.format.parseNearAmount(String(n)));
}

function formatYoctoNear(y) {
  const v = BigInt(y);
  const whole = v / YOCTO;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, 4);
  return `${whole}.${frac} NEAR`;
}

async function pickRpc() {
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "status", params: [] }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.result?.chain_id === "testnet") {
        console.log(`Using RPC ${url}`);
        return url;
      }
    } catch (err) {
      console.log(`RPC ${url} failed: ${redact(err.message || err)}`);
    }
  }
  throw new Error("No working testnet RPC");
}

async function connectAccount(rpc, accountId, secretKey) {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, accountId, KeyPair.fromString(secretKey));
  const near = await connect({ networkId: NETWORK_ID, nodeUrl: rpc, keyStore });
  return near.account(accountId);
}

async function viewAccount(rpc, accountId) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method: "query",
      params: { request_type: "view_account", finality: "final", account_id: accountId },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (data.error) return null;
  return data.result;
}

async function faucetCreate(accountId, publicKey) {
  let last = "no faucet tried";
  for (const url of FAUCETS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: publicKey }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
      if (res.ok) {
        return { ok: true, url, body };
      }
      last = `${url} HTTP ${res.status}: ${redact(text).slice(0, 240)}`;
    } catch (err) {
      last = `${url}: ${redact(err.message || err)}`;
    }
  }
  return { ok: false, error: last };
}

async function faucetViaCli(accountId) {
  // Last-resort path. Copies the legacy keychain file into .mintiq without printing it.
  const { spawnSync } = await import("node:child_process");
  const args = [
    "--yes",
    "near-cli-rs",
    "account",
    "create-account",
    "sponsor-by-faucet-service",
    accountId,
    "autogenerate-new-keypair",
    "save-to-legacy-keychain",
    "network-config",
    "testnet",
    "create",
  ];
  const out = spawnSync("npx", args, { encoding: "utf8", timeout: 90_000 });
  const combined = redact(`${out.stdout || ""}\n${out.stderr || ""}`);
  if (out.status !== 0) {
    return { ok: false, error: combined.slice(0, 400) };
  }
  const cred = path.join(process.env.HOME || "/home/box", ".near-credentials/testnet", `${accountId}.json`);
  if (!fs.existsSync(cred)) return { ok: false, error: "CLI reported success but no keychain file was written." };
  const raw = JSON.parse(fs.readFileSync(cred, "utf8"));
  const secretKey = raw.private_key || raw.secret_key || raw.secretKey;
  if (!secretKey) return { ok: false, error: "CLI keychain file had no key field." };
  return { ok: true, secretKey, log: combined.slice(0, 200) };
}

async function recordCall(label, fn) {
  try {
    const result = await fn();
    const hash = txHashFrom(result);
    const entry = { label, ok: true, hash, explorer: explorerTx(hash) };
    console.log(`PASS  ${label}${hash ? `  ${hash}` : ""}`);
    return { ...entry, result };
  } catch (err) {
    const hash = txHashFrom(err) || txHashFrom(err?.cause) || txHashFrom(err?.context) || null;
    const message = redact(err?.message || err).split("\n")[0].slice(0, 300);
    console.log(`FAIL  ${label}${hash ? `  ${hash}` : ""}`);
    console.log(`      ${message}`);
    return { label, ok: false, hash, explorer: explorerTx(hash), error: message };
  }
}

async function expectFail(label, fn) {
  const rec = await recordCall(label, fn);
  if (rec.ok) {
    rec.ok = false;
    rec.error = "expected a rejection, but the call succeeded";
    console.log(`FAIL  ${label}: expected a rejection, but the call succeeded`);
    return rec;
  }
  rec.expectedFail = true;
  rec.ok = true; // expected failure is a demo pass
  console.log(`PASS  ${label} (rejected as expected)`);
  return rec;
}

async function main() {
  if (!fs.existsSync(WASM_MINTIQ) || !fs.existsSync(WASM_YIELD)) {
    throw new Error("Missing wasm in res/. Run: npm run build:wasm");
  }
  // Do not attempt NEAR AI Cloud during this deploy/demo.
  delete process.env.NEARAI_JUDGE;
  delete process.env.MINTIQ_NEARAI_JUDGE;

  const rpc = await pickRpc();

  function readExistingKey(file) {
    const abs = path.join(DIR, file);
    if (!fs.existsSync(abs)) return null;
    const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
    const secretKey = raw.private_key || raw.secret_key || raw.secretKey;
    const accountId = raw.account_id || raw.accountId;
    if (!secretKey || !accountId) return null;
    return { accountId, secretKey, keyPair: KeyPair.fromString(secretKey) };
  }

  const existingMintiq = readExistingKey("testnet-mintiq.json");
  const existingAgent = readExistingKey("testnet-agent-full.json");
  let reuse = false;
  if (existingMintiq && existingAgent) {
    const liveA = await viewAccount(rpc, existingMintiq.accountId);
    const liveB = await viewAccount(rpc, existingAgent.accountId);
    reuse = Boolean(liveA?.amount && liveB?.amount);
  }

  const suffix = reuse
    ? (existingMintiq.accountId.match(/^mintiq([a-f0-9]+)\.testnet$/) || [])[1] || crypto.randomBytes(4).toString("hex")
    : crypto.randomBytes(4).toString("hex");
  const mintiqId = reuse ? existingMintiq.accountId : `mintiq${suffix}.testnet`;
  const agentId = reuse ? existingAgent.accountId : `miqagt${suffix}.testnet`;
  const yieldId = `yld.${mintiqId}`;
  const ownerId = `own.${mintiqId}`;
  const contribId = `wrk.${mintiqId}`;

  const txs = [];
  const keys = {
    mintiq: reuse ? existingMintiq.keyPair : KeyPair.fromRandom("ed25519"),
    agent: reuse ? existingAgent.keyPair : KeyPair.fromRandom("ed25519"),
    agentLimited: readExistingKey("testnet-agent.json")?.keyPair || KeyPair.fromRandom("ed25519"),
    yield: readExistingKey("testnet-yield.json")?.keyPair || KeyPair.fromRandom("ed25519"),
    owner: readExistingKey("testnet-owner.json")?.keyPair || KeyPair.fromRandom("ed25519"),
    contributor: readExistingKey("testnet-contributor.json")?.keyPair || KeyPair.fromRandom("ed25519"),
  };

  const keyFiles = {
    mintiq: writeKey("testnet-mintiq.json", mintiqId, keys.mintiq.toString()),
    agentFull: writeKey("testnet-agent-full.json", agentId, keys.agent.toString()),
    agent: writeKey("testnet-agent.json", agentId, keys.agentLimited.toString()),
    yield: writeKey("testnet-yield.json", yieldId, keys.yield.toString()),
    owner: writeKey("testnet-owner.json", ownerId, keys.owner.toString()),
    contributor: writeKey("testnet-contributor.json", contribId, keys.contributor.toString()),
  };
  console.log("Wrote gitignored key files under .mintiq/ (mode 0600). Secrets are not logged.");
  if (reuse) console.log(`Reusing faucet accounts ${mintiqId} and ${agentId}.`);

  log(reuse ? "Reusing faucet-sponsored accounts" : "Creating faucet-sponsored accounts", { mintiq: mintiqId, agent: agentId });

  for (const [id, kp] of [[mintiqId, keys.mintiq], [agentId, keys.agent]]) {
    if (reuse) {
      log(`Already on testnet: ${id}`, { explorer: accountLink(id) });
      continue;
    }
    const pub = kp.getPublicKey().toString();
    let created = await faucetCreate(id, pub);
    if (!created.ok) {
      console.log(`HTTP faucet failed for ${id}: ${created.error}. Trying near-cli-rs...`);
      const cli = await faucetViaCli(id);
      if (!cli.ok) throw new Error(`Could not create ${id}: ${cli.error}`);
      // CLI generated a different key. Replace our file with the CLI key, never print it.
      if (id === mintiqId) {
        keys.mintiq = KeyPair.fromString(cli.secretKey);
        keyFiles.mintiq = writeKey("testnet-mintiq.json", mintiqId, cli.secretKey);
      } else {
        keys.agent = KeyPair.fromString(cli.secretKey);
        keyFiles.agentFull = writeKey("testnet-agent-full.json", agentId, cli.secretKey);
      }
      created = { ok: true, url: "near-cli-rs faucet", body: { note: "created via CLI keychain, copied into .mintiq/" } };
    }
    log(`Faucet created ${id}`, { via: created.url || "http", explorer: accountLink(id) });
  }

  // Wait briefly for accounts to be queryable
  for (let i = 0; i < 10; i++) {
    const a = await viewAccount(rpc, mintiqId);
    const b = await viewAccount(rpc, agentId);
    if (a?.amount && b?.amount) {
      log("Faucet balances", {
        mintiq: formatYoctoNear(a.amount),
        agent: formatYoctoNear(b.amount),
      });
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const mintiqAcct = await connectAccount(rpc, mintiqId, keys.mintiq.toString());
  const agentFullAcct = await connectAccount(rpc, agentId, keys.agent.toString());

  const treasuryYocto = usdToYocto(100);
  const mintDeposit = BigInt(treasuryYocto) + BigInt(STORAGE_BUFFER);
  // Owner needs mint deposit + gas; others need gas and storage.
  const ownerFund = mintDeposit + parseNear("8");
  const yieldFund = parseNear("5");
  const contribFund = parseNear("2");
  const neededFromParent = ownerFund + yieldFund + contribFund + parseNear("2");

  let parentInfo = await viewAccount(rpc, mintiqId);
  let parentBal = BigInt(parentInfo?.amount || "0");
  if (parentBal < neededFromParent + parseNear("3")) {
    console.log("Parent balance is short of the $100 mint. Creating extra faucet-funded accounts to top up.");
    let fuelN = 0;
    while (parentBal < neededFromParent + parseNear("3") && fuelN < 10) {
      fuelN += 1;
      const fuelId = `miqfuel${fuelN}${suffix}.testnet`;
      const existingFuel = await viewAccount(rpc, fuelId);
      if (existingFuel?.amount) {
        console.log(`Fuel account ${fuelId} already exists (${formatYoctoNear(existingFuel.amount)}); skipping.`);
        continue;
      }
      const fuelKp = KeyPair.fromRandom("ed25519");
      writeKey(`testnet-fuel${fuelN}.json`, fuelId, fuelKp.toString());
      const created = await faucetCreate(fuelId, fuelKp.getPublicKey().toString());
      if (!created.ok) {
        console.log(`Could not create fuel account ${fuelId}: ${created.error}`);
        continue;
      }
      for (let i = 0; i < 8; i++) {
        const st = await viewAccount(rpc, fuelId);
        if (st?.amount) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      const fuelAcct = await connectAccount(rpc, fuelId, fuelKp.toString());
      const st = await viewAccount(rpc, fuelId);
      const keep = parseNear("0.2");
      const send = BigInt(st?.amount || "0") > keep ? BigInt(st.amount) - keep : 0n;
      if (send > 0n) {
        const rec = await recordCall(`Top up parent from ${fuelId} (${formatYoctoNear(send)})`, () =>
          fuelAcct.sendMoney(mintiqId, send)
        );
        txs.push(rec);
      }
      parentInfo = await viewAccount(rpc, mintiqId);
      parentBal = BigInt(parentInfo?.amount || "0");
      log("Parent balance after top-up", formatYoctoNear(parentBal));
    }
  }

  parentInfo = await viewAccount(rpc, mintiqId);
  parentBal = BigInt(parentInfo?.amount || "0");
  if (parentBal < neededFromParent) {
    throw new Error(
      `Not enough testnet NEAR to mint a $100 treasury (need ~${formatYoctoNear(neededFromParent)}, have ${formatYoctoNear(parentBal)}).`
    );
  }

  // Create subaccounts
  for (const [label, id, kp, amount] of [
    ["Create yield subaccount", yieldId, keys.yield, yieldFund],
    ["Create owner subaccount", ownerId, keys.owner, ownerFund],
    ["Create contributor subaccount", contribId, keys.contributor, contribFund],
  ]) {
    const already = await viewAccount(rpc, id);
    if (already?.amount) {
      console.log(`PASS  ${label} ${id} already exists (${formatYoctoNear(already.amount)})`);
      txs.push({ label: `${label} ${id}`, ok: true, hash: null, explorer: null, note: "already exists" });
      continue;
    }
    const rec = await recordCall(`${label} ${id}`, () =>
      mintiqAcct.createAccount(id, kp.getPublicKey().toString(), amount)
    );
    txs.push(rec);
    if (!rec.ok) throw new Error(`Failed to create ${id}: ${rec.error}`);
  }

  const yieldAcct = await connectAccount(rpc, yieldId, keys.yield.toString());
  const ownerAcct = await connectAccount(rpc, ownerId, keys.owner.toString());
  const contribAcct = await connectAccount(rpc, contribId, keys.contributor.toString());

  // Deploy + init
  const yieldWasm = fs.readFileSync(WASM_YIELD);
  const mintiqWasm = fs.readFileSync(WASM_MINTIQ);
  txs.push(await recordCall("Deploy yield pool wasm", () => yieldAcct.deployContract(yieldWasm)));
  txs.push(await recordCall("Init yield pool (new)", () =>
    yieldAcct.functionCall({ contractId: yieldId, methodName: "new", args: {}, gas: GAS, attachedDeposit: 0n })
  ));
  txs.push(await recordCall("Deploy Mintiq treasury/NFT wasm", () => mintiqAcct.deployContract(mintiqWasm)));
  txs.push(await recordCall("Init Mintiq (new)", () =>
    mintiqAcct.functionCall({ contractId: mintiqId, methodName: "new", args: {}, gas: GAS, attachedDeposit: 0n })
  ));
  if (txs.some((t) => /Deploy|Init/.test(t.label) && !t.ok)) {
    throw new Error("Contract deploy or init failed. See FAIL lines above.");
  }

  // Restrict the agent to a function-call key on the treasury contract only.
  txs.push(
    await recordCall("Add agent function-call key limited to Mintiq agent methods", () =>
      agentFullAcct.addKey(
        keys.agentLimited.getPublicKey().toString(),
        mintiqId,
        AGENT_METHODS,
        parseNear("10")
      )
    )
  );
  const agentLimitedAcct = await connectAccount(rpc, agentId, keys.agentLimited.toString());

  // ── Demo flow ──────────────────────────────────────────────────────────
  const tokenId = await (async () => {
    const rec = await recordCall("Mint Meme Studio NFT with $100 treasury", () =>
      ownerAcct.functionCall({
        contractId: mintiqId,
        methodName: "mint",
        args: {
          name: "Meme Studio",
          mission: "build a meme production business",
          agent_id: agentId,
          max_per_task: usdToYocto(5),
          min_reserve: usdToYocto(20),
          reinvest_bps: 7000,
          owner_share_bps: 3000,
          approved_destinations: [yieldId],
        },
        gas: GAS_HEAVY,
        attachedDeposit: mintDeposit,
      })
    );
    txs.push(rec);
    if (!rec.ok) throw new Error(`Mint failed: ${rec.error}`);
    // The mint method returns the token id; parse from status if present.
    try {
      const status = rec.result?.status?.SuccessValue;
      if (status) {
        const decoded = Buffer.from(status, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        return String(parsed);
      }
    } catch {
      /* fall through */
    }
    return "1";
  })();
  log("Minted NFT", { tokenId, treasury: formatUsd(100), depositNear: formatNear(mintDeposit.toString()) });

  txs.push(
    await expectFail("Agent function-call key cannot transfer NEAR (protocol rejection)", () =>
      agentLimitedAcct.sendMoney(contribId, parseNear("0.1"))
    )
  );
  txs.push(
    await expectFail("Agent function-call key cannot call the yield pool", () =>
      agentLimitedAcct.functionCall({
        contractId: yieldId,
        methodName: "deposit",
        args: { token_id: String(tokenId) },
        gas: GAS,
        attachedDeposit: parseNear("0.1"),
      })
    )
  );
  txs.push(
    await expectFail("Contract rejects a $6 job (max per task is $5) — ERR_OVERSPEND", () =>
      agentLimitedAcct.functionCall({
        contractId: mintiqId,
        methodName: "post_job",
        args: {
          token_id: String(tokenId),
          title: "6 original memes",
          description: "This budget is over the max per task.",
          budget: usdToYocto(6),
        },
        gas: GAS,
        attachedDeposit: 0n,
      })
    )
  );

  txs.push(
    await recordCall('Agent posted job "5 original memes, $5"', () =>
      agentLimitedAcct.functionCall({
        contractId: mintiqId,
        methodName: "post_job",
        args: {
          token_id: String(tokenId),
          title: "5 original memes, $5",
          description: "Deliver 5 original meme concepts for the studio. Budget $5.",
          budget: usdToYocto(5),
        },
        gas: GAS,
        attachedDeposit: 0n,
      })
    )
  );

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

  txs.push(
    await recordCall("Contributor submitted the good meme set", () =>
      contribAcct.functionCall({
        contractId: mintiqId,
        methodName: "submit_work",
        args: { token_id: String(tokenId), job_id: 1, content: memes },
        gas: GAS,
        attachedDeposit: 0n,
      })
    )
  );
  txs.push(
    await recordCall("Contributor submitted the off-topic lasagna text", () =>
      contribAcct.functionCall({
        contractId: mintiqId,
        methodName: "submit_work",
        args: { token_id: String(tokenId), job_id: 1, content: offTopic },
        gas: GAS,
        attachedDeposit: 0n,
      })
    )
  );

  const jobBrief = { title: "5 original memes, $5", description: "Deliver 5 original meme concepts for the studio. Budget $5." };
  const evGood = await evaluateSubmission(jobBrief, memes);
  const evBad = await evaluateSubmission(jobBrief, offTopic);
  log("Scorer (good)", { score: evGood.score, passed: evGood.passed, label: evGood.label, reasoning: evGood.reasoning });
  log("Scorer (off-topic)", { score: evBad.score, passed: evBad.passed, label: evBad.label, reasoning: evBad.reasoning });

  const recordEval = (submissionId, ev, label) =>
    recordCall(label, () =>
      agentLimitedAcct.functionCall({
        contractId: mintiqId,
        methodName: "record_evaluation",
        args: {
          token_id: String(tokenId),
          job_id: 1,
          submission_id: submissionId,
          score: ev.score,
          reasoning: ev.reasoning,
          recommend_approve: ev.recommend_approve,
          evaluator: ev.evaluator,
        },
        gas: GAS,
        attachedDeposit: 0n,
      })
    );
  txs.push(await recordEval(1, evGood, "Agent recorded good submission score"));
  txs.push(await recordEval(2, evBad, "Agent recorded off-topic submission score"));

  if (!(evGood.passed && evGood.score >= 70 && !evBad.passed && evBad.score < 70 && evGood.label === SCORER_LABEL)) {
    throw new Error("Built-in scorer did not pass the good submission and fail the off-topic one.");
  }
  console.log("PASS  Built-in rule-based scorer: good passed, off-topic failed.");

  txs.push(
    await recordCall("Owner approved and paid the good submission", () =>
      ownerAcct.functionCall({
        contractId: mintiqId,
        methodName: "approve_and_pay",
        args: { token_id: String(tokenId), job_id: 1, submission_id: 1 },
        gas: 40_000_000_000_000n,
        attachedDeposit: 0n,
      })
    )
  );

  // Invest idle funds and harvest labelled demo yield
  const nftBefore = await mintiqAcct.viewFunction({
    contractId: mintiqId,
    methodName: "get_nft",
    args: { token_id: String(tokenId) },
  });
  const idle = BigInt(nftBefore.liquid) - BigInt(nftBefore.rules.min_reserve);
  txs.push(
    await recordCall(`Invest idle ${formatUsd(yoctoToUsd(idle.toString()))} in demo yield pool`, () =>
      agentLimitedAcct.functionCall({
        contractId: mintiqId,
        methodName: "invest_idle",
        args: { token_id: String(tokenId), destination: yieldId, amount: idle.toString() },
        gas: GAS_HEAVY,
        attachedDeposit: 0n,
      })
    )
  );
  txs.push(
    await recordCall("Accrue 5% demo yield (labelled, not real staking)", () =>
      agentLimitedAcct.functionCall({
        contractId: mintiqId,
        methodName: "demo_accrue",
        args: { token_id: String(tokenId), destination: yieldId, bps: 500 },
        gas: GAS,
        attachedDeposit: 0n,
      })
    )
  );
  txs.push(
    await recordCall("Harvest demo yield back to the treasury", () =>
      agentLimitedAcct.functionCall({
        contractId: mintiqId,
        methodName: "harvest",
        args: { token_id: String(tokenId), destination: yieldId },
        gas: GAS_HEAVY,
        attachedDeposit: 0n,
      })
    )
  );

  const nft = await mintiqAcct.viewFunction({
    contractId: mintiqId,
    methodName: "get_nft",
    args: { token_id: String(tokenId) },
  });

  const cfg = {
    mode: "testnet",
    networkId: NETWORK_ID,
    rpc,
    usdPerNear: USD_PER_NEAR,
    rateLabel: RATE_LABEL,
    contracts: { mintiq: mintiqId, yieldPool: yieldId },
    accounts: {
      owner: { accountId: ownerId, keyFile: keyFiles.owner },
      agent: {
        accountId: agentId,
        keyFile: keyFiles.agent,
        keyType: "function-call",
        allowedContract: mintiqId,
        allowedMethods: AGENT_METHODS,
      },
      agentFull: {
        accountId: agentId,
        keyFile: keyFiles.agentFull,
        keyType: "full-access",
        note: "Full key kept only in .mintiq/. The agent process uses the function-call key.",
      },
      contributor: { accountId: contribId, keyFile: keyFiles.contributor },
    },
    demoTokenId: String(tokenId),
    startedAt: new Date().toISOString(),
  };
  writeJson("testnet.json", cfg, 0o600);

  const publicReport = {
    networkId: NETWORK_ID,
    rpc,
    explorerTx: EXPLORER_TX,
    explorerTxAlt: EXPLORER_TX_ALT,
    explorerAccount: EXPLORER_ACCT,
    contracts: { mintiq: mintiqId, yieldPool: yieldId },
    accounts: { owner: ownerId, agent: agentId, contributor: contribId },
    accountExplorer: {
      mintiq: accountLink(mintiqId),
      yieldPool: accountLink(yieldId),
      owner: accountLink(ownerId),
      agent: accountLink(agentId),
      contributor: accountLink(contribId),
    },
    demoTokenId: String(tokenId),
    usdPerNear: USD_PER_NEAR,
    rateLabel: RATE_LABEL,
    evaluator: SCORER_LABEL,
    evaluations: {
      good: { score: evGood.score, passed: evGood.passed, label: evGood.label, reasoning: evGood.reasoning },
      offTopic: { score: evBad.score, passed: evBad.passed, label: evBad.label, reasoning: evBad.reasoning },
    },
    trackRecord: {
      jobs_completed: nft.track_record.jobs_completed,
      contributors_hired: nft.track_record.contributors_hired,
      total_spent: formatUsd(yoctoToUsd(nft.track_record.total_spent)),
      total_earned: formatUsd(yoctoToUsd(nft.track_record.total_earned)),
      liquid: formatUsd(yoctoToUsd(nft.liquid)),
      invested: formatUsd(yoctoToUsd(nft.invested)),
    },
    transactions: txs.map(({ label, ok, hash, explorer, error, expectedFail }) => ({
      label, ok, hash, explorer, expectedFail: Boolean(expectedFail), error: error || null,
    })),
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
  };
  // Public report has no keys; mode 0644 is fine inside .mintiq and we copy a docs version.
  writeJson("testnet-report.json", publicReport, 0o644);

  const webConfigPath = path.join(ROOT, "web/src/deployed.json");
  fs.writeFileSync(webConfigPath, JSON.stringify(publicReport, null, 2) + "\n");
  console.log(`Wrote public web config ${path.relative(ROOT, webConfigPath)} (no keys).`);

  const failed = txs.filter((t) => !t.ok);
  log("Testnet demo summary", {
    tokenId,
    accounts: publicReport.accounts,
    contracts: publicReport.contracts,
    evaluations: publicReport.evaluations,
    trackRecord: publicReport.trackRecord,
    txCount: txs.length,
    failed: failed.length,
  });
  if (failed.length) {
    console.error(`\n${failed.length} step(s) failed. See FAIL lines and the report.`);
    process.exitCode = 1;
  } else {
    console.log("\nTestnet demo flow completed. Keys remain in .mintiq/ and were not printed.");
  }
}

main().catch((err) => {
  console.error(redact(err?.stack || err?.message || err));
  process.exit(1);
});
