import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrief, ruleBasedEvaluate, SCORER_LABEL, PASS_THRESHOLD } from "./scorer.js";

const JOB = {
  title: "5 original memes, $5",
  description: "Deliver 5 original meme concepts for the studio. Budget $5.",
};

const GOOD = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.
3. "Reserve floor, comedy ceiling" — a bouncer at a club named $20.
4. "Yield, then punchline" — a staking pool telling dad jokes.
5. "Owner signs, agent suggests" — two stamps: SCORE 88 and PAY.`;

const OFF_TOPIC = `Here is my lasagna recipe.
Boil 12 sheets of pasta, brown a pound of ground beef with onion,
layer with ricotta and tomato sauce, bake at 375°F for 45 minutes.
I also fixed a typo in the office Wi-Fi password documentation.
This has nothing to do with memes.`;

const TOO_FEW = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.`;

const DUPLICATES = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Treasury that memes back" — a vault with googly eyes hiring artists.
3. "Treasury that memes back" — a vault with googly eyes hiring artists.
4. "Treasury that memes back" — a vault with googly eyes hiring artists.
5. "Treasury that memes back" — a vault with googly eyes hiring artists.`;

test("parseBrief reads count and topic from '5 original memes, $5'", () => {
  const brief = parseBrief(JOB);
  assert.equal(brief.count, 5);
  assert.equal(brief.topic, "meme");
  assert.ok(brief.topicTerms.includes("meme"));
  assert.equal(brief.original, true);
});

function assertFail(ev, name) {
  assert.equal(ev.label, SCORER_LABEL, `${name} label`);
  assert.equal(ev.evaluator, SCORER_LABEL, `${name} evaluator`);
  assert.ok(ev.score >= 0 && ev.score <= 100, `${name} score range`);
  assert.ok(ev.score < PASS_THRESHOLD, `${name} score should be < ${PASS_THRESHOLD}, got ${ev.score}`);
  assert.equal(ev.passed, false, `${name} should fail`);
  assert.equal(ev.recommend_approve, false);
  assert.ok(ev.reasoning.length > 0);
}

test("good submission: five caption/punchline meme ideas pass", () => {
  const ev = ruleBasedEvaluate(JOB, GOOD);
  assert.equal(ev.label, SCORER_LABEL);
  assert.equal(ev.evaluator, SCORER_LABEL);
  assert.ok(ev.score >= PASS_THRESHOLD, `good score should be >= ${PASS_THRESHOLD}, got ${ev.score}`);
  assert.equal(ev.passed, true);
  assert.equal(ev.recommend_approve, true);
  assert.equal(ev.stats.valid, 5);
  assert.match(ev.reasoning, /Pass/);
  console.log(`SCORE good=${ev.score} passed=${ev.passed} ${ev.reasoning}`);
});

test("off-topic lasagna recipe with a meme negation fails", () => {
  const ev = ruleBasedEvaluate(JOB, OFF_TOPIC);
  assertFail(ev, "off-topic");
  assert.equal(ev.stats.valid, 0);
  assert.match(ev.reasoning, /off-topic|negation/i);
  console.log(`SCORE off-topic=${ev.score} passed=${ev.passed} ${ev.reasoning}`);
});

test("too-few items (only two meme ideas) fails", () => {
  const ev = ruleBasedEvaluate(JOB, TOO_FEW);
  assertFail(ev, "too-few");
  assert.equal(ev.stats.valid, 2);
  assert.match(ev.reasoning, /only 2|missing/i);
  console.log(`SCORE too-few=${ev.score} passed=${ev.passed} ${ev.reasoning}`);
});

test("five duplicate meme ideas count as one and fail", () => {
  const ev = ruleBasedEvaluate(JOB, DUPLICATES);
  assertFail(ev, "duplicates");
  assert.equal(ev.stats.valid, 1);
  assert.ok(ev.stats.duplicates >= 4);
  assert.match(ev.reasoning, /duplicate/i);
  console.log(`SCORE duplicates=${ev.score} passed=${ev.passed} ${ev.reasoning}`);
});

test("custom visitor brief: three on-topic taglines pass", () => {
  const job = { title: "3 taglines for a coffee shop", description: "Write 3 short original taglines for a neighbourhood coffee shop." };
  const r = ruleBasedEvaluate(job, "1. Wake up and smell the neighbourhood coffee\n2. Your daily cup of coffee, brewed next door\n3. Coffee shop warmth in every sip");
  assert.equal(r.passed, true);
});

test("custom visitor brief: one-word junk fails", () => {
  const job = { title: "3 taglines for a coffee shop", description: "Write 3 taglines." };
  assert.equal(ruleBasedEvaluate(job, "ok\nok\nok").passed, false);
});

test("custom visitor brief: off-topic recipe fails", () => {
  const job = { title: "3 taglines for a coffee shop", description: "Write 3 taglines." };
  assert.equal(ruleBasedEvaluate(job, "Here is my lasagna recipe: preheat the oven to 200").passed, false);
});
