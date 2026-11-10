import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { ROOT, loadConfig, view, call, GAS_HEAVY } from "./near.js";
import { evaluateAndRecord, investAllIdle, harvest, demoAccrue, agentStatus } from "./agent.js";
import { usdToYocto, yoctoToUsd, formatUsd, RATE_LABEL, USD_PER_NEAR } from "./money.js";
import {
  marketStatus,
  listSimJobs,
  simPostJob,
  simBid,
  simAward,
  simSubmit,
  simAccept,
} from "./agent-market.js";

const DIST = path.join(ROOT, "web/dist");
const STORAGE_BUFFER = "50000000000000000000000";

function sendErr(res, err) {
  const message = String(err?.message || err)
    .replace(/ed25519:[A-Za-z0-9]+/g, "ed25519:[redacted]")
    .split("\n")[0]
    .slice(0, 500);
  res.status(400).json({ error: message });
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/status", (_req, res) => {
    try {
      const cfg = loadConfig();
      res.json({
        mode: cfg.mode,
        networkId: cfg.networkId,
        rpc: cfg.rpc,
        contracts: cfg.contracts,
        accounts: {
          owner: cfg.accounts.owner.accountId,
          agent: cfg.accounts.agent.accountId,
          contributor: cfg.accounts.contributor.accountId,
          agentKeyType: cfg.accounts.agent.keyType,
          allowedMethods: cfg.accounts.agent.allowedMethods,
        },
        usdPerNear: USD_PER_NEAR,
        rateLabel: RATE_LABEL,
        agent: agentStatus(),
        market: marketStatus(),
      });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.get("/api/nfts", async (_req, res) => {
    try {
      const ids = await view("list_token_ids", {});
      const nfts = [];
      for (const token_id of ids) {
        nfts.push(await view("get_nft", { token_id }));
      }
      res.json({ nfts, rateLabel: RATE_LABEL, usdPerNear: USD_PER_NEAR });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.get("/api/nfts/:id", async (req, res) => {
    try {
      const token_id = String(req.params.id);
      const nft = await view("get_nft", { token_id });
      const json = await view("nft_token", { token_id });
      res.json({ nft, nft_token: json, rateLabel: RATE_LABEL, usdPerNear: USD_PER_NEAR });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/mint", async (req, res) => {
    try {
      const cfg = loadConfig();
      const {
        name,
        mission,
        treasuryUsd = 100,
        maxPerTaskUsd = 5,
        minReserveUsd = 20,
        reinvestBps = 7000,
        ownerShareBps = 3000,
      } = req.body || {};
      const treasury = usdToYocto(treasuryUsd);
      const deposit = (BigInt(treasury) + BigInt(STORAGE_BUFFER)).toString();
      const result = await call(
        "owner",
        "mint",
        {
          name,
          mission,
          agent_id: cfg.accounts.agent.accountId,
          max_per_task: usdToYocto(maxPerTaskUsd),
          min_reserve: usdToYocto(minReserveUsd),
          reinvest_bps: Number(reinvestBps),
          owner_share_bps: Number(ownerShareBps),
          approved_destinations: [cfg.contracts.yieldPool],
        },
        { depositYocto: deposit, gas: GAS_HEAVY }
      );
      res.json({ ok: true, tx: result.transaction?.hash || null });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const { tokenId, title, description, budgetUsd } = req.body || {};
      await call("agent", "post_job", {
        token_id: String(tokenId),
        title,
        description,
        budget: usdToYocto(budgetUsd),
      });
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/jobs/submit", async (req, res) => {
    try {
      const { tokenId, jobId, content } = req.body || {};
      await call("contributor", "submit_work", {
        token_id: String(tokenId),
        job_id: Number(jobId),
        content,
      });
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/jobs/evaluate", async (req, res) => {
    try {
      const ev = await evaluateAndRecord(req.body.tokenId, req.body.jobId, req.body.submissionId);
      res.json({ ok: true, evaluation: ev });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/jobs/approve", async (req, res) => {
    try {
      await call(
        "owner",
        "approve_and_pay",
        {
          token_id: String(req.body.tokenId),
          job_id: Number(req.body.jobId),
          submission_id: Number(req.body.submissionId),
        },
        { gas: GAS_HEAVY }
      );
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/invest", async (req, res) => {
    try {
      const out = await investAllIdle(req.body.tokenId);
      res.json({ ok: true, ...out });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.post("/api/harvest", async (req, res) => {
    try {
      if (req.body.accrueBps) {
        await demoAccrue(req.body.tokenId, Number(req.body.accrueBps));
      }
      const out = await harvest(req.body.tokenId);
      res.json({ ok: true, ...out, note: "DEMO yield pool — not real staking." });
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.get("/api/market", (_req, res) => {
    res.json(listSimJobs());
  });

  app.post("/api/market/post", (req, res) => {
    try {
      res.json(simPostJob(req.body || {}));
    } catch (err) {
      sendErr(res, err);
    }
  });
  app.post("/api/market/bid", (req, res) => {
    try {
      res.json(simBid(req.body.jobId, req.body));
    } catch (err) {
      sendErr(res, err);
    }
  });
  app.post("/api/market/award", (req, res) => {
    try {
      res.json(simAward(req.body.jobId));
    } catch (err) {
      sendErr(res, err);
    }
  });
  app.post("/api/market/submit", (req, res) => {
    try {
      res.json(simSubmit(req.body.jobId, req.body.deliverableMarkdown));
    } catch (err) {
      sendErr(res, err);
    }
  });
  app.post("/api/market/accept", (req, res) => {
    try {
      res.json(simAccept(req.body.jobId));
    } catch (err) {
      sendErr(res, err);
    }
  });

  app.get("/api/fx/:yocto", (req, res) => {
    const usd = yoctoToUsd(req.params.yocto);
    res.json({ usd, display: formatUsd(usd), rateLabel: RATE_LABEL });
  });

  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(DIST, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .type("html")
        .send(
          "<p>Mintiq API is up. Build the dashboard with <code>npm run build:web</code> and restart, or use <code>npm run dev:web</code>.</p>"
        );
    });
  }

  return app;
}

export async function startServer({ port = 8787 } = {}) {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, "127.0.0.1", () => {
      console.log(`Mintiq server http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer({ port: process.env.PORT || 8787 }).catch((err) => {
    console.error(String(err.message || err));
    process.exit(1);
  });
}
