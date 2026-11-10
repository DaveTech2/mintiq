/**
 * NEAR Wallet Selector (testnet). The browser never holds Mintiq keys: every
 * write is signed by the visitor's own wallet.
 */
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet";
import { actionCreators } from "near-js-tx2";
import "@near-wallet-selector/modal-ui/styles.css";

export const TGAS = 1_000_000_000_000n;
export const YOCTO = 10n ** 24n;

export function nearToYocto(near) {
  const [w, f = ""] = String(near).trim().split(".");
  if (!/^\d*$/.test(w) || !/^\d*$/.test(f)) throw new Error(`Invalid NEAR amount: ${near}`);
  return BigInt(w || "0") * YOCTO + BigInt((f + "0".repeat(24)).slice(0, 24) || "0");
}

let selectorPromise = null;
let modal = null;

export function initWallet({ contractId, rpc }) {
  if (!selectorPromise) {
    selectorPromise = setupWalletSelector({
      network: {
        networkId: "testnet",
        nodeUrl: rpc,
        helperUrl: "https://helper.testnet.near.org",
        explorerUrl: "https://testnet.nearblocks.io",
        indexerUrl: "https://testnet-api.kitwallet.app",
      },
      modules: [setupMyNearWallet(), setupMeteorWallet(), setupHereWallet(), setupIntearWallet()],
    }).then((selector) => {
      modal = setupModal(selector, {
        contractId,
        description: "Connect a NEAR testnet account to mint and run your own Mintiq. Testnet only, no real money.",
      });
      return selector;
    });
  }
  return selectorPromise;
}

export function showModal() {
  modal?.show();
}

export async function signedInAccount() {
  const selector = await selectorPromise;
  const accounts = selector.store.getState().accounts || [];
  return accounts.find((a) => a.active)?.accountId || accounts[0]?.accountId || null;
}

export async function signOut() {
  const selector = await selectorPromise;
  const wallet = await selector.wallet();
  await wallet.signOut();
}

/** Sign and send one function call to the treasury contract from the visitor's wallet. */
export async function callContract({ contractId, method, args, gasTgas = 30, depositYocto = 0n }) {
  const selector = await selectorPromise;
  const wallet = await selector.wallet();
  const action = actionCreators.functionCall(method, args, BigInt(gasTgas) * TGAS, BigInt(depositYocto));
  return wallet.signAndSendTransaction({ receiverId: contractId, actions: [action] });
}

export function outcomeHash(outcome) {
  return outcome?.transaction?.hash || outcome?.transaction_outcome?.id || null;
}

export function outcomeFailure(outcome) {
  const f = outcome?.status?.Failure;
  if (!f) return null;
  const s = JSON.stringify(f);
  const m = s.match(/ERR_[A-Z_]+/);
  return m ? m[0] : s.slice(0, 200);
}
