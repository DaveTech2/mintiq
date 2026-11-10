#!/usr/bin/env node
/** Redeploy the v2 Mintiq wasm in place (state layout unchanged, no migration). */
import fs from "node:fs";
import path from "node:path";
import { ROOT, accountFromFile, view, tryCall, record } from "./testnet-lib.mjs";

const before = await view("get_nft", { token_id: "1" });
const acct = await accountFromFile("testnet-mintiq.json");
const wasm = fs.readFileSync(path.join(ROOT, "res/mintiq.wasm"));
const r = await tryCall(acct, (a) => a.deployContract(wasm));
record("testnet-v2.json", { label: "Upgrade Mintiq contract to v2 (public mint, owner-run treasury ops, size caps)", ...r, out: undefined });
const after = await view("get_nft", { token_id: "1" });
const same = JSON.stringify(before) === JSON.stringify(after);
console.log(`Demo token #1 state preserved: ${same}`);
if (!same) process.exit(1);
