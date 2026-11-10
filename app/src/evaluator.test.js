import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSubmission,
  evaluatorStatus,
  nearAiJudgeEnabled,
  resetNearAiState,
  SCORER_LABEL,
} from "./evaluator.js";

const FAKE_KEY = "test-key-not-real-123456";
function withKey(fn) {
  return async () => {
    const saved = { k: process.env.NEARAI_API_KEY, k2: process.env.NEAR_AI_API_KEY, j: process.env.NEARAI_JUDGE };
    process.env.NEARAI_API_KEY = FAKE_KEY;
    delete process.env.NEAR_AI_API_KEY;
    delete process.env.NEARAI_JUDGE;
    resetNearAiState();
    try { await fn(); } finally {
      for (const [k, v] of [["NEARAI_API_KEY", saved.k], ["NEAR_AI_API_KEY", saved.k2], ["NEARAI_JUDGE", saved.j]]) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
      resetNearAiState();
    }
  };
}
const jsonRes = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });

const JOB = {
  title: "5 original memes, $5",
  description: "Deliver 5 original meme concepts for the studio. Budget $5.",
};
const GOOD = `1. "Treasury that memes back" — a vault with googly eyes hiring artists.
2. "Max $5, infinite jokes" — a receipt stamped APPROVED BY THE NFT.
3. "Reserve floor, comedy ceiling" — a bouncer at a club named $20.
4. "Yield, then punchline" — a staking pool telling dad jokes.
5. "Owner signs, agent suggests" — two stamps: SCORE 88 and PAY.`;

test("NEAR AI Cloud judging is off when no key is set", () => {
  const saved = [process.env.NEARAI_API_KEY, process.env.NEAR_AI_API_KEY];
  delete process.env.NEARAI_API_KEY;
  delete process.env.NEAR_AI_API_KEY;
  delete process.env.NEARAI_JUDGE;
  delete process.env.MINTIQ_NEARAI_JUDGE;
  assert.equal(nearAiJudgeEnabled(), false);
  const status = evaluatorStatus();
  assert.equal(status.source, "rule-based");
  assert.equal(status.evaluator, SCORER_LABEL);
  assert.equal(status.nearAiJudge, false);
  if (saved[0] !== undefined) process.env.NEARAI_API_KEY = saved[0];
  if (saved[1] !== undefined) process.env.NEAR_AI_API_KEY = saved[1];
});

test("NEARAI_JUDGE=0 forces the built-in scorer even with a key", withKey(async () => {
  process.env.NEARAI_JUDGE = "0";
  let called = false;
  const ev = await evaluateSubmission(JOB, GOOD, { fetchImpl: async () => { called = true; return jsonRes(200, {}); } });
  assert.equal(called, false);
  assert.equal(ev.evaluator, SCORER_LABEL);
}));

test("with a key, NEAR AI Cloud is tried first (z-ai/glm-5.3-flash)", withKey(async () => {
  let seen = null;
  const ev = await evaluateSubmission(JOB, GOOD, {
    fetchImpl: async (url, init) => {
      seen = { url, model: JSON.parse(init.body).model, auth: init.headers.Authorization };
      return jsonRes(200, { choices: [{ message: { content: '{"score":91,"reasoning":"five on-topic memes","passed":true}' } }] });
    },
  });
  assert.equal(seen.url, "https://cloud-api.near.ai/v1/chat/completions");
  assert.equal(seen.model, "z-ai/glm-5.3-flash");
  assert.equal(seen.auth, `Bearer ${FAKE_KEY}`);
  assert.equal(ev.score, 91);
  assert.equal(ev.evaluator, "NEAR AI Cloud (z-ai/glm-5.3-flash)");
}));

test("HTTP 402 falls back to the built-in scorer and records the fallback", withKey(async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonRes(402, { error: { message: `no credit for ${FAKE_KEY}`, type: "no_limit_configured" } }); };
  const ev = await evaluateSubmission(JOB, GOOD, { fetchImpl });
  assert.equal(ev.passed, true);
  assert.equal(ev.source, "rule-based-fallback");
  assert.match(ev.evaluator, /^Built-in rule-based scorer \(no LLM\); NEAR AI fallback \(HTTP 402\)$/);
  assert.ok(ev.evaluator.length <= 120);
  assert.ok(!JSON.stringify(ev).includes(FAKE_KEY), "key must never leak into the result");
  // after a 402 the process stops calling Cloud
  await evaluateSubmission(JOB, GOOD, { fetchImpl });
  assert.equal(calls, 1);
}));

test("a timeout falls back to the built-in scorer", withKey(async () => {
  const fetchImpl = (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const ev = await evaluateSubmission(JOB, GOOD, { fetchImpl, timeoutMs: 50 });
  assert.equal(ev.evaluator, `${SCORER_LABEL}; NEAR AI fallback (timeout)`);
}));

test("evaluateSubmission uses the built-in scorer when no key is set", async () => {
  const saved = process.env.NEARAI_API_KEY;
  delete process.env.NEARAI_API_KEY;
  delete process.env.NEARAI_JUDGE;
  delete process.env.MINTIQ_NEARAI_JUDGE;
  const ev = await evaluateSubmission(JOB, GOOD);
  if (saved !== undefined) process.env.NEARAI_API_KEY = saved;
  assert.equal(ev.label, SCORER_LABEL);
  assert.equal(ev.source, "rule-based");
  assert.equal(ev.passed, true);
});

test("empty model content falls back to the built-in scorer", withKey(async () => {
  const ev = await evaluateSubmission(JOB, GOOD, {
    fetchImpl: async () => jsonRes(200, { choices: [{ finish_reason: "length", message: { content: null, reasoning_content: "thinking..." } }] }),
  });
  assert.equal(ev.source, "rule-based-fallback");
  assert.match(ev.evaluator, /NEAR AI fallback \(empty content\)/);
}));
