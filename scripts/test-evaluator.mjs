#!/usr/bin/env node
/**
 * Live (or fallback) evaluation of one on-brief and one off-topic submission.
 * Never prints API keys.
 */
import { evaluateSubmission, evaluatorStatus, nearAiApiKey } from "../app/src/evaluator.js";

function redact(value) {
  let text = String(value ?? "");
  const key = nearAiApiKey();
  if (key) text = text.split(key).join("[REDACTED]");
  return text;
}

const job = {
  title: "5 original memes, $5",
  description: "Deliver 5 original meme concepts for the studio. Budget $5.",
};

const good = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.
3. "Reserve floor, comedy ceiling" — a bouncer at a club named $20.
4. "Yield, then punchline" — a staking pool telling dad jokes.
5. "Owner signs, agent suggests" — two stamps: SCORE 88 and PAY.`;

const bad = `Here is my lasagna recipe.
Boil 12 sheets of pasta, brown a pound of ground beef with onion,
layer with ricotta and tomato sauce, bake at 375°F for 45 minutes.
I also fixed a typo in the office Wi-Fi password documentation.
This has nothing to do with memes.`;

function summarize(label, ev) {
  return {
    case: label,
    source: ev.source,
    evaluator: ev.evaluator,
    label: ev.label,
    model: ev.model,
    score: ev.score,
    passed: ev.passed,
    recommend_approve: ev.recommend_approve,
    fallback: ev.fallback,
    fallback_reason: ev.fallback_reason ? redact(ev.fallback_reason) : null,
    reasoning: redact(ev.reasoning),
  };
}

async function main() {
  const configured = Boolean(nearAiApiKey());
  console.log("Evaluator pre-call status:", JSON.stringify(evaluatorStatus()));
  console.log("NEAR AI Cloud key configured:", configured);

  const goodEv = await evaluateSubmission(job, good);
  const badEv = await evaluateSubmission(job, bad);
  const report = {
    statusAfter: evaluatorStatus(),
    good: summarize("good / on-brief", goodEv),
    bad: summarize("bad / off-topic", badEv),
  };
  console.log(JSON.stringify(report, null, 2));

  const bothLive = goodEv.source === "near-ai" && badEv.source === "near-ai" && !goodEv.fallback && !badEv.fallback;
  const scoresDiffer = goodEv.score !== badEv.score;
  const sensible = goodEv.score > badEv.score && goodEv.passed && !badEv.passed;
  if (!bothLive) {
    console.error("LIVE_JUDGING_FAILED");
    process.exitCode = 2;
  } else if (!sensible) {
    console.error(
      `SCORES_NOT_SENSIBLE good=${goodEv.score} passed=${goodEv.passed} bad=${badEv.score} passed=${badEv.passed} differ=${scoresDiffer}`
    );
    process.exitCode = 3;
  } else {
    console.log("LIVE_JUDGING_OK");
  }
}

main().catch((err) => {
  console.error(redact(err?.stack || err?.message || err));
  process.exit(1);
});
