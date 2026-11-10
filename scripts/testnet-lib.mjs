/**
 * Small helpers for v2 testnet scripts. Keys are read from gitignored .mintiq/
 * and never printed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, keyStores, KeyPair } from "near-api-js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIR = path.join(ROOT, ".mintiq");
export const RPC = process.env.MINTIQ_RPC || "https://test.rpc.fastnear.com";
export const CONTRACT = "mintiq7f109e53.testnet";
export const POOL = "yld.mintiq7f109e53.testnet";
export const AGENT = "miqagt7f109e53.testnet";
export const NB_TX = "https://testnet.nearblocks.io/txns/";
export const NB_ACCT = "https://testnet.nearblocks.io/address/";

export function keyFile(name) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
  return { accountId: raw.account_id, secretKey: raw.private_key };
}

export function saveKey(name, accountId, secretKey) {
  const abs = path.join(DIR, name);
  fs.writeFileSync(abs, JSON.stringify({ account_id: accountId, private_key: secretKey }, null, 2) + "\n", { mode: 0o600 });
}

export async function accountFromFile(name) {
  const { accountId, secretKey } = keyFile(name);
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", accountId, KeyPair.fromString(secretKey));
  const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
  return near.account(accountId);
}

export async function view(method, args = {}, contractId = CONTRACT) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "query",
      params: { request_type: "call_function", finality: "optimistic", account_id: contractId, method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
    }),
  });
  const j = await res.json();
  if (j.error || j.result?.error) throw new Error(JSON.stringify(j.error || j.result.error));
  return JSON.parse(Buffer.from(j.result.result).toString() || "null");
}

export function redact(s) {
  return String(s?.message || s).replace(/ed25519:[A-Za-z0-9]+/g, "ed25519:[redacted]");
}

/** Returns { ok, hash, error } and never throws. */
export async function tryCall(account, fn) {
  try {
    const out = await fn(account);
    const hash = out?.transaction?.hash || out?.transaction_outcome?.id;
    const failure = out?.status?.Failure;
    return { ok: !failure, hash, error: failure ? JSON.stringify(failure) : null, out };
  } catch (e) {
    const hash = e?.context?.transactionHash || e?.transaction_outcome?.id || (String(e.message).match(/[1-9A-HJ-NP-Za-km-z]{43,44}/) || [])[0];
    return { ok: false, hash, error: redact(e) };
  }
}

export function record(file, entry) {
  const abs = path.join(DIR, file);
  const list = fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : [];
  list.push({ ...entry, at: new Date().toISOString() });
  fs.writeFileSync(abs, JSON.stringify(list, null, 2) + "\n");
  console.log(`${entry.ok ? "PASS" : "FAIL"} ${entry.label}${entry.hash ? ` ${NB_TX}${entry.hash}` : ""}${entry.error ? ` (${entry.error.slice(0, 200)})` : ""}`);
}
