/**
 * Browser-side NEAR testnet RPC helper. View calls only. No keys.
 */
export async function viewMethod(rpc, contractId, methodName, args = {}) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mintiq",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: contractId,
        method_name: methodName,
        args_base64: btoa(unescape(encodeURIComponent(JSON.stringify(args)))),
      },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  if (data.result?.error) throw new Error(String(data.result.error));
  const bytes = Uint8Array.from(data.result.result);
  const text = new TextDecoder().decode(bytes);
  return text ? JSON.parse(text) : null;
}

export function buildTestnetApi(deployed) {
  const rpc = deployed.rpc;
  const contractId = deployed.contracts.mintiq;

  return async function testnetApi(path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    if (method !== "GET") {
      const err = new Error(
        "This public dashboard is read-only. Mint, pay, and other writes were already executed on NEAR testnet; use the explorer links to inspect those transactions. No keys are in the browser."
      );
      err.readOnly = true;
      throw err;
    }
    if (path === "/api/status") {
      return {
        mode: "testnet",
        networkId: "testnet",
        rpc,
        contracts: deployed.contracts,
        accounts: {
          owner: deployed.accounts.owner,
          agent: deployed.accounts.agent,
          contributor: deployed.accounts.contributor,
          agentKeyType: "function-call",
          allowedMethods: ["post_job", "record_evaluation", "invest_idle", "harvest", "demo_accrue"],
        },
        usdPerNear: deployed.usdPerNear,
        rateLabel: deployed.rateLabel,
        agent: {
          evaluator: deployed.evaluator,
          evaluatorLabel: deployed.evaluator,
          signer: "function-call access key (not in the browser)",
          verifiedTee: false,
        },
        market: { liveUsed: false, reason: "Agent Market has no testnet; the hire loop was not posted there." },
        readOnly: true,
        explorer: {
          tx: deployed.explorerTx,
          account: deployed.explorerAccount,
        },
        transactions: deployed.transactions || [],
        evaluations: deployed.evaluations || null,
        visitorCapabilities: deployed.visitorCapabilities || null,
      };
    }
    if (path === "/api/nfts") {
      const ids = await viewMethod(rpc, contractId, "list_token_ids", {});
      const nfts = [];
      for (const token_id of ids || []) {
        nfts.push(await viewMethod(rpc, contractId, "get_nft", { token_id }));
      }
      return { nfts, rateLabel: deployed.rateLabel, usdPerNear: deployed.usdPerNear };
    }
    const one = path.match(/^\/api\/nfts\/(.+)$/);
    if (one) {
      const token_id = decodeURIComponent(one[1]);
      const nft = await viewMethod(rpc, contractId, "get_nft", { token_id });
      const nft_token = await viewMethod(rpc, contractId, "nft_token", { token_id });
      return { nft, nft_token, rateLabel: deployed.rateLabel, usdPerNear: deployed.usdPerNear };
    }
    if (path === "/api/market") {
      return { jobs: [], buyerBalanceUsdc: 0, ownerBalanceUsdc: 0, simulated: false, note: "Not on testnet." };
    }
    throw new Error(`Unknown path ${path}`);
  };
}
