import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSubmission,
  evaluatorStatus,
  nearAiJudgeEnabled,
  SCORER_LABEL,
} from "./evaluator.js";

const JOB = {
  title: "5 original memes, $5",
  description: "Deliver 5 original meme concepts for the studio. Budget $5.",
};
const GOOD = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.
3. "Reserve floor, comedy ceiling" — a bouncer at a club named $20.
4. "Yield, then punchline" — a staking pool telling dad jokes.
5. "Owner signs, agent suggests" — two stamps: SCORE 88 and PAY.`;

test("NEAR AI Cloud judging is off by default even if a key might be present", () => {
  delete process.env.NEARAI_JUDGE;
  delete process.env.MINTIQ_NEARAI_JUDGE;
  assert.equal(nearAiJudgeEnabled(), false);
  const status = evaluatorStatus();
  assert.equal(status.source, "rule-based");
  assert.equal(status.evaluator, SCORER_LABEL);
  assert.equal(status.nearAiJudge, false);
});

test("evaluateSubmission uses the built-in scorer when the judge flag is off", async () => {
  delete process.env.NEARAI_JUDGE;
  delete process.env.MINTIQ_NEARAI_JUDGE;
  const ev = await evaluateSubmission(JOB, GOOD);
  assert.equal(ev.label, SCORER_LABEL);
  assert.equal(ev.source, "rule-based");
  assert.equal(ev.passed, true);
});
