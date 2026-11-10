import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, keyStores, KeyPair, utils } from "near-api-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");
export const CONFIG_PATH = process.env.MINTIQ_CONFIG || path.join(ROOT, ".mintiq/local.json");

const GAS_DEFAULT = BigInt("30000000000000"); // 30 Tgas
const GAS_HEAVY = BigInt("80000000000000");

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`No Mintiq config at ${CONFIG_PATH}. Run: npm run demo`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

export function readKeyFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  const secretKey = raw.private_key || raw.secretKey || raw.secret_key;
  if (!secretKey) throw new Error(`No secret key in ${path.basename(abs)}`);
  return { accountId: raw.account_id || raw.accountId, secretKey };
}

async function connectRole(cfg, role) {
  const acc = cfg.accounts[role];
  if (!acc) throw new Error(`Unknown role: ${role}`);
  const { secretKey } = readKeyFile(acc.keyFile);
  const keyStore = new keyStores.InMemoryKeyStore();
  const networkId = cfg.networkId || "sandbox";
  await keyStore.setKey(networkId, acc.accountId, KeyPair.fromString(secretKey));
  const near = await connect({
    networkId,
    nodeUrl: cfg.rpc,
    keyStore,
  });
  return { near, account: await near.account(acc.accountId), accountId: acc.accountId, cfg };
}

export async function withRole(role) {
  const cfg = loadConfig();
  return connectRole(cfg, role);
}

export async function view(method, args = {}, contractId) {
  const cfg = loadConfig();
  const { account } = await connectRole(cfg, "owner");
  return account.viewFunction({
    contractId: contractId || cfg.contracts.mintiq,
    methodName: method,
    args,
  });
}

export async function call(role, method, args = {}, { depositYocto = "0", gas = GAS_DEFAULT, contractId } = {}) {
  const { account, cfg } = await withRole(role);
  const result = await account.functionCall({
    contractId: contractId || cfg.contracts.mintiq,
    methodName: method,
    args,
    gas,
    attachedDeposit: BigInt(depositYocto),
  });
  return result;
}

export { GAS_DEFAULT, GAS_HEAVY, utils };
