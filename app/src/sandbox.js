import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, parseNEAR, KeyPair } from "near-workspaces";

const nearToYocto = (n) => BigInt(parseNEAR(String(n)));
import { connect, keyStores, utils } from "near-api-js";
import { USD_PER_NEAR, RATE_LABEL, usdToYocto } from "./money.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MINTIQ_DIR = path.join(ROOT, ".mintiq");
const WASM_MINTIQ = path.join(ROOT, "res/mintiq.wasm");
const WASM_YIELD = path.join(ROOT, "res/mintiq_yield_pool.wasm");

export const AGENT_METHODS = [
  "post_job",
  "record_evaluation",
  "invest_idle",
  "harvest",
  "demo_accrue",
];

function writeKey(file, accountId, secretKey) {
  fs.mkdirSync(MINTIQ_DIR, { recursive: true });
  const abs = path.join(MINTIQ_DIR, file);
  fs.writeFileSync(
    abs,
    JSON.stringify({ account_id: accountId, private_key: secretKey }, null, 2) + "\n",
    { mode: 0o600 }
  );
  fs.chmodSync(abs, 0o600);
  return path.relative(ROOT, abs);
}

function secretOf(keyPair) {
  return keyPair.toString();
}

export async function bootSandbox() {
  if (!fs.existsSync(WASM_MINTIQ) || !fs.existsSync(WASM_YIELD)) {
    throw new Error("Missing wasm in res/. Run: npm run build:wasm");
  }

  const worker = await Worker.init({
    network: "sandbox",
    rm: false,
  });
  const root = worker.rootAccount;
  const rpc = worker.config.rpcAddr;
  const networkId = "sandbox";

  const yieldPool = await root.createSubAccount("yield", {
    initialBalance: nearToYocto(200),
  });
  await yieldPool.deploy(WASM_YIELD);
  await yieldPool.call(yieldPool, "new", {});

  const mintiq = await root.createSubAccount("mintiq", {
    initialBalance: nearToYocto(20),
  });
  await mintiq.deploy(WASM_MINTIQ);
  await mintiq.call(mintiq, "new", {});

  const owner = await root.createSubAccount("owner", {
    initialBalance: nearToYocto(200),
  });
  const agent = await root.createSubAccount("agent", {
    initialBalance: nearToYocto(20),
  });
  const contributor = await root.createSubAccount("contributor", {
    initialBalance: nearToYocto(5),
  });

  const ownerKey = await owner.getKey();
  const agentFullKey = await agent.getKey();
  const contributorKey = await contributor.getKey();

  // Limited function-call key: only the Mintiq contract and agent methods.
  const limited = KeyPair.fromRandom("ed25519");
  const ownerNear = await connectWithKey(networkId, rpc, owner.accountId, secretOf(ownerKey));
  const agentFullNear = await connectWithKey(
    networkId,
    rpc,
    agent.accountId,
    secretOf(agentFullKey)
  );
  const allowance = BigInt(utils.format.parseNearAmount("5"));
  await agentFullNear.account.addKey(
    limited.getPublicKey().toString(),
    mintiq.accountId,
    AGENT_METHODS,
    allowance
  );

  const cfg = {
    mode: "sandbox",
    networkId,
    rpc,
    usdPerNear: USD_PER_NEAR,
    rateLabel: RATE_LABEL,
    contracts: {
      mintiq: mintiq.accountId,
      yieldPool: yieldPool.accountId,
    },
    accounts: {
      owner: { accountId: owner.accountId, keyFile: writeKey("owner.json", owner.accountId, secretOf(ownerKey)) },
      agent: {
        accountId: agent.accountId,
        keyFile: writeKey("agent.json", agent.accountId, secretOf(limited)),
        keyType: "function-call",
        allowedContract: mintiq.accountId,
        allowedMethods: AGENT_METHODS,
      },
      agentFull: {
        accountId: agent.accountId,
        keyFile: writeKey("agent-full.json", agent.accountId, secretOf(agentFullKey)),
        keyType: "full-access",
        note: "Kept only so the sandbox account remains usable. The agent process uses agent.json (function-call).",
      },
      contributor: {
        accountId: contributor.accountId,
        keyFile: writeKey("contributor.json", contributor.accountId, secretOf(contributorKey)),
      },
    },
    startedAt: new Date().toISOString(),
  };

  const configPath = path.join(MINTIQ_DIR, "local.json");
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(configPath, 0o600);

  return {
    worker,
    rpc,
    accounts: { root, mintiq, yieldPool, owner, agent, contributor },
    cfg,
    ownerNear,
    connectLimited: () => connectWithKey(networkId, rpc, agent.accountId, secretOf(limited)),
  };
}

export async function connectWithKey(networkId, rpc, accountId, secretKey) {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(networkId, accountId, KeyPair.fromString(secretKey));
  const near = await connect({ networkId, nodeUrl: rpc, keyStore });
  return { near, account: await near.account(accountId), accountId };
}

export { usdToYocto, ROOT };
