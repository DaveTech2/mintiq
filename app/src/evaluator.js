/**
 * Pluggable job evaluator.
 *
 * Auto mode: if NEARAI_API_KEY (or NEAR_AI_API_KEY) is set, NEAR AI Cloud
 * (model z-ai/glm-5.3-flash by default, NEAR_AI_MODEL overrides) is tried
 * first. On any error (HTTP 402 no credit, 401, timeout, bad JSON) the
 * built-in rule-based scorer is used and the fallback is recorded in the
 * evaluator label stored on-chain. NEARAI_JUDGE=0 forces the built-in scorer.
 * After a 401/402 we stop calling Cloud for the rest of this process. The key is never logged, printed, written to disk, or
 * sent to the dashboard. The contract does not trust this score; the owner
 * still has to approve payment.
 */

import { ruleBasedEvaluate, SCORER_LABEL } from "./scorer.js";

const NEAR_AI_BASE = "https://cloud-api.near.ai/v1";
const LLM_TIMEOUT_MS = Number(process.env.NEAR_AI_TIMEOUT_MS || 20_000);
export const DEFAULT_NEAR_AI_MODEL = "z-ai/glm-5.3-flash";
const DISCOVER_TIMEOUT_MS = 15_000;
const MAX_TOKENS = 1024;

// Docs historically suggested z-ai/glm-5.2 or zai-org/GLM-5.1-FP8.
// Prefer those when the live catalog still lists them; otherwise the
// current GLM successors (flash first, to keep spend tiny).
const DOCUMENTED_MODELS = ["z-ai/glm-5.2", "zai-org/GLM-5.1-FP8"];
const FALLBACK_MODELS = ["z-ai/glm-5.3-flash", "z-ai/glm-5.3"];

let cachedModelId = null;
let discoverPromise = null;
let cloudDisabledAfterError = false;
let cloudWarningLogged = false;

export function nearAiApiKey() {
  return process.env.NEARAI_API_KEY || process.env.NEAR_AI_API_KEY || "";
}

export function nearAiBaseUrl() {
  return (process.env.NEAR_AI_BASE_URL || NEAR_AI_BASE).replace(/\/$/, "");
}

function flagOff(value) {
  return ["0", "false", "no", "off"].includes(String(value ?? "").trim().toLowerCase());
}

/** Auto: on when a key is set, unless NEARAI_JUDGE=0 (or MINTIQ_NEARAI_JUDGE=0). */
export function nearAiJudgeEnabled() {
  if (cloudDisabledAfterError) return false;
  if (flagOff(process.env.NEARAI_JUDGE) || flagOff(process.env.MINTIQ_NEARAI_JUDGE)) return false;
  return Boolean(nearAiApiKey());
}

/** Test hook: forget a previous 401/402 so the next call tries Cloud again. */
export function resetNearAiState() {
  cloudDisabledAfterError = false;
  cloudWarningLogged = false;
  cachedModelId = null;
  discoverPromise = null;
}

function shortReason(err) {
  const status = err?.status;
  if (status) return `HTTP ${status}`;
  const m = String(err?.message || err || "error");
  if (/timed out/i.test(m)) return "timeout";
  if (/empty content/i.test(m)) return "empty content";
  if (/non-JSON/i.test(m)) return "non-JSON output";
  return m.slice(0, 40);
}

function redact(value) {
  let text = String(value ?? "");
  const key = nearAiApiKey();
  if (key) text = text.split(key).join("[REDACTED]");
  return text;
}

function describeHttpError(status, body) {
  const raw = redact(body).replace(/\s+/g, " ").trim();
  let message = "";
  let type = "";
  try {
    const parsed = JSON.parse(body);
    message = redact(parsed?.error?.message || parsed?.message || "");
    type = redact(parsed?.error?.type || "");
  } catch {
    message = raw.slice(0, 180);
  }
  const detail = [message, type && type !== message ? `(${type})` : ""].filter(Boolean).join(" ");
  if (status === 401) return `NEAR AI Cloud HTTP 401 unauthorized${detail ? `: ${detail}` : ""}`;
  if (status === 402) {
    return `NEAR AI Cloud HTTP 402 insufficient credits or no spending limit configured${detail ? `: ${detail}` : ""}`;
  }
  return `NEAR AI Cloud HTTP ${status}${detail ? `: ${detail}` : ""}`;
}

function warnCloudOnce(err) {
  if (err?.status === 401 || err?.status === 402) cloudDisabledAfterError = true;
  if (cloudWarningLogged) return;
  cloudWarningLogged = true;
  const msg = redact(err?.message || err);
  console.warn(`NEAR AI Cloud judging failed: ${msg}. Using ${SCORER_LABEL}${cloudDisabledAfterError ? " for the rest of this process" : " for this submission"}.`);
}

function withOptionalFallback(result, fallbackReason, short) {
  if (!fallbackReason) return result;
  const label = `${SCORER_LABEL}; NEAR AI fallback (${short || "error"})`.slice(0, 120);
  return {
    ...result,
    evaluator: label,
    label,
    source: "rule-based-fallback",
    fallback: true,
    fallback_reason: redact(fallbackReason),
    reasoning: `${result.reasoning} (Fell back from NEAR AI Cloud: ${redact(fallbackReason)}.)`,
  };
}

function parseEvaluationJson(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Empty model response");
  const candidates = [];
  candidates.push(text);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    candidates.push(text.slice(first, last + 1));
  }
  let lastErr = null;
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Evaluator returned non-JSON output${lastErr ? "" : ""}`);
}

function scoreFrom(parsed) {
  const n = Number(parsed.score);
  if (!Number.isFinite(n)) throw new Error("Evaluator JSON missing a numeric score");
  return Math.max(0, Math.min(100, Math.round(n)));
}

function passedFrom(parsed, score) {
  const raw =
    parsed.passed ??
    parsed.pass ??
    parsed.recommend_approve ??
    parsed.approved;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (["true", "pass", "yes", "approve"].includes(v)) return true;
    if (["false", "fail", "no", "reject"].includes(v)) return false;
  }
  return score >= 70;
}

async function fetchJson(url, { method = "GET", body, timeoutMs, apiKey, fetchImpl = fetch }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(describeHttpError(res.status, text));
      err.status = res.status;
      throw err;
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error("NEAR AI Cloud returned a non-JSON body");
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`NEAR AI Cloud request timed out after ${timeoutMs}ms`);
    }
    const e = new Error(redact(err?.message || err));
    if (err?.status) e.status = err.status;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function pickModel(ids) {
  const list = ids.filter(Boolean);
  const preferred = [
    process.env.NEAR_AI_MODEL,
    ...DOCUMENTED_MODELS,
    ...FALLBACK_MODELS,
  ].filter(Boolean);
  for (const id of preferred) {
    if (list.includes(id)) return id;
  }
  const glm = list.find((id) => /^z-ai\/glm/i.test(id) || /glm-5/i.test(id));
  if (glm) return glm;
  throw new Error("No suitable chat model in the NEAR AI Cloud catalog");
}

export async function discoverNearAiModel({ force = false } = {}) {
  if (cachedModelId && !force) return cachedModelId;
  if (discoverPromise && !force) return discoverPromise;
  const apiKey = nearAiApiKey();
  if (!apiKey) throw new Error("NEAR AI Cloud API key is not set");
  discoverPromise = (async () => {
    const data = await fetchJson(`${nearAiBaseUrl()}/models`, {
      timeoutMs: DISCOVER_TIMEOUT_MS,
      apiKey,
    });
    const rows = Array.isArray(data.data) ? data.data : [];
    const ids = rows.map((m) => (typeof m === "string" ? m : m?.id)).filter(Boolean);
    if (ids.length === 0) throw new Error("NEAR AI Cloud catalog was empty");
    cachedModelId = pickModel(ids);
    return cachedModelId;
  })();
  try {
    return await discoverPromise;
  } catch (err) {
    discoverPromise = null;
    throw err;
  }
}


function messageContent(data) {
  const choice = data?.choices?.[0] || {};
  const msg = choice.message || {};
  const raw = msg.content;
  if (typeof raw === "string" && raw.trim()) return raw;
  if (Array.isArray(raw)) {
    const joined = raw
      .map((part) => (typeof part === "string" ? part : part?.text || part?.content || ""))
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  if (raw && typeof raw === "object" && typeof raw.text === "string" && raw.text.trim()) return raw.text;
  const finish = choice.finish_reason || "unknown";
  throw new Error(`Evaluator returned empty content (finish_reason=${finish})`);
}

async function llmEvaluate(job, content, { apiKey, baseUrl, model, fetchImpl, timeoutMs = LLM_TIMEOUT_MS }) {
  const payload = {
    model,
    temperature: 0.2,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You evaluate contributor work for a small treasury-backed NFT business. Compare the submission to the job brief. Reply ONLY compact JSON: {"score":0-100,"reasoning":"one or two short sentences","passed":true|false}. score is an integer. passed is true only if the work is on-topic and fulfills the brief well enough to accept. Off-topic, incomplete, or placeholder work must fail. Be fair and specific. No markdown.',
      },
      {
        role: "user",
        content: `Job title: ${job.title || ""}\nJob description: ${job.description || ""}\nBudget note: paid only if the owner approves.\n\nSubmission:\n${content}`,
      },
    ],
  };
  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    method: "POST",
    body: payload,
    timeoutMs,
    apiKey,
    fetchImpl,
  });
  const raw = messageContent(data);
  const parsed = parseEvaluationJson(raw);
  const score = scoreFrom(parsed);
  const passed = passedFrom(parsed, score);
  const label = `NEAR AI Cloud (${model})`;
  return {
    score,
    reasoning: String(parsed.reasoning || "No reasoning returned.").slice(0, 800),
    passed,
    recommend_approve: passed,
    evaluator: label,
    label,
    source: "near-ai",
    model,
    fallback: false,
    fallback_reason: null,
  };
}

export function evaluatorStatus() {
  if (nearAiJudgeEnabled()) {
    return {
      source: "near-ai",
      evaluator: `NEAR AI Cloud (${process.env.NEAR_AI_MODEL || DEFAULT_NEAR_AI_MODEL}), built-in scorer fallback`,
      model: process.env.NEAR_AI_MODEL || DEFAULT_NEAR_AI_MODEL,
      configured: true,
      nearAiJudge: true,
    };
  }
  return {
    source: "rule-based",
    evaluator: SCORER_LABEL,
    model: null,
    configured: true,
    nearAiJudge: false,
  };
}

export async function evaluateSubmission(job, content, { fetchImpl = fetch, timeoutMs } = {}) {
  if (nearAiJudgeEnabled()) {
    try {
      const model = process.env.NEAR_AI_MODEL || DEFAULT_NEAR_AI_MODEL;
      return await llmEvaluate(job, content, {
        apiKey: nearAiApiKey(),
        baseUrl: nearAiBaseUrl(),
        model,
        fetchImpl,
        timeoutMs,
      });
    } catch (err) {
      warnCloudOnce(err);
      return withOptionalFallback(ruleBasedEvaluate(job, content), err?.message || err, shortReason(err));
    }
  }
  return ruleBasedEvaluate(job, content);
}

export { ruleBasedEvaluate, SCORER_LABEL } from "./scorer.js";
