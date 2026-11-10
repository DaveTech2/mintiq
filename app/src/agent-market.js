/**
 * Agent Market integration.
 *
 * Live API: https://market.near.ai  (docs: docs.market.near.ai)
 * There is no documented testnet or sandbox payment mode. A real job
 * spends the buyer's USD or USDC balance on production. This module
 * defaults to a labelled simulation of the documented lifecycle.
 *
 * Verified behaviour is recorded in docs/AGENT_MARKET.md.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./near.js";

const SIM_PATH = path.join(ROOT, ".mintiq/market-sim.json");
export const MARKET_ORIGIN = "https://market.near.ai";
export const PLATFORM_FEE_BPS = 500; // 5%, from official docs

function loadSim() {
  if (!fs.existsSync(SIM_PATH)) {
    return {
      mode: "simulated",
      label:
        "Simulated Agent Market lifecycle (not posted to market.near.ai). Live market has no documented testnet.",
      buyerBalanceUsdc: "100.00",
      ownerBalanceUsdc: "0.00",
      jobs: [],
    };
  }
  return JSON.parse(fs.readFileSync(SIM_PATH, "utf8"));
}

function saveSim(state) {
  fs.mkdirSync(path.dirname(SIM_PATH), { recursive: true });
  fs.writeFileSync(SIM_PATH, JSON.stringify(state, null, 2));
}

function money(s) {
  return (Math.round(Number(s) * 100) / 100).toFixed(2);
}

export function marketStatus() {
  const liveToken = Boolean(process.env.MARKET_AAT_TOKEN);
  const liveBuyer = Boolean(process.env.MARKET_BUYER_SESSION);
  return {
    liveConfigured: liveToken || liveBuyer,
    liveUsed: false,
    reason: liveToken || liveBuyer
      ? "Live credentials are present, but Mintiq will not award or fund a production job (real USD/USDC, no testnet)."
      : "No live Agent Market credentials. Using the documented simulation.",
    origin: MARKET_ORIGIN,
    simulation: loadSim(),
  };
}

/** Post a standard board job. On the real market this does not charge yet. */
export function simPostJob({ title, description, budgetUsd, tokenId }) {
  const state = loadSim();
  const job = {
    id: `sim-job-${state.jobs.length + 1}`,
    kind: "standard",
    title,
    description,
    budgetUsd: money(budgetUsd),
    currency: "USDC",
    tokenId: String(tokenId),
    status: "open",
    escrowHeld: null,
    bid: null,
    assignment: null,
    payout: null,
    postedAt: new Date().toISOString(),
    note: "Simulation of a standard board job: nothing is charged until award, per docs.market.near.ai/buyers/post-a-job.",
  };
  state.jobs.push(job);
  saveSim(state);
  return job;
}

export function simBid(jobId, { amountUsd, proposal, bidder }) {
  const state = loadSim();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("Sim job not found");
  if (job.status !== "open") throw new Error("Job is not open for bids");
  job.bid = {
    id: `${job.id}-bid-1`,
    amountUsd: money(amountUsd),
    proposal,
    bidder: bidder || "contributor.sim",
    status: "pending",
  };
  saveSim(state);
  return job;
}

/** Award holds the bid amount from the buyer's balance. */
export function simAward(jobId) {
  const state = loadSim();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job?.bid) throw new Error("No bid to award");
  const amount = money(job.bid.amountUsd);
  if (Number(state.buyerBalanceUsdc) < Number(amount)) {
    throw new Error("Simulated buyer USDC balance is too low to fund escrow");
  }
  state.buyerBalanceUsdc = money(Number(state.buyerBalanceUsdc) - Number(amount));
  job.status = "awarded";
  job.bid.status = "accepted";
  job.escrowHeld = {
    amountUsd: amount,
    currency: "USDC",
    status: "held",
    fundedBy: "buyer (simulated Agent Market balance)",
    fundedAt: new Date().toISOString(),
    note: "On the live market this is a hire ledger entry. The agent cannot touch it.",
  };
  job.assignment = { status: "in_progress", deliverable: null };
  saveSim(state);
  return job;
}

export function simSubmit(jobId, deliverableMarkdown) {
  const state = loadSim();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job?.assignment) throw new Error("No assignment");
  job.assignment.status = "submitted";
  job.assignment.deliverable = deliverableMarkdown;
  job.assignment.submittedAt = new Date().toISOString();
  job.status = "submitted";
  saveSim(state);
  return job;
}

/** Buyer accept: owner receives amount minus 5% fee. */
export function simAccept(jobId) {
  const state = loadSim();
  const job = state.jobs.find((j) => j.id === jobId);
  if (job?.assignment?.status !== "submitted") throw new Error("Nothing to accept");
  const held = Number(job.escrowHeld.amountUsd);
  const fee = money((held * PLATFORM_FEE_BPS) / 10_000);
  const ownerPayout = money(held - Number(fee));
  state.ownerBalanceUsdc = money(Number(state.ownerBalanceUsdc) + Number(ownerPayout));
  job.escrowHeld.status = "released";
  job.assignment.status = "accepted";
  job.status = "accepted";
  job.payout = {
    ownerUsd: ownerPayout,
    platformFeeUsd: fee,
    currency: "USDC",
    to: "agent owner's marketplace balance (not the agent token)",
    acceptedAt: new Date().toISOString(),
  };
  saveSim(state);
  return job;
}

export function listSimJobs() {
  return loadSim();
}

/** Live client stub — never awards or spends. */
export async function probeLiveMarket() {
  if (!process.env.MARKET_AAT_TOKEN) {
    return { ok: false, reason: "MARKET_AAT_TOKEN not set" };
  }
  try {
    const res = await fetch(`${MARKET_ORIGIN}/v1/jobs/board?limit=1`, {
      headers: { Authorization: `Bearer ${process.env.MARKET_AAT_TOKEN}` },
    });
    return {
      ok: res.ok,
      status: res.status,
      note: "Read-only probe only. Mintiq will not post, award, or fund a live job.",
    };
  } catch (err) {
    return { ok: false, reason: String(err.message || err) };
  }
}
