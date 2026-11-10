/**
 * Built-in rule-based job scorer. No LLM, deterministic.
 * Parses the brief for a required item count and topic, then checks that
 * the submission actually delivers that many distinct, on-topic items.
 * Mentions of the topic in negations or meta-text do not count as delivery.
 */

export const SCORER_LABEL = "Built-in rule-based scorer (no LLM)";
export const PASS_THRESHOLD = 70;

const MEME_FORMAT =
  /\b(image macro|drake(?:\s+format)?|two-?panels?|top text|bottom text|wojak|expanding brain|distracted boyfriend|meme format|caption:|punchline:|setup:)\b/i;

const NEGATION =
  /\b(nothing to do with|doesn'?t have (anything|much) to do with|not (really )?(a |about |related to )?(the )?(memes?|topic)\b|unrelated to\b|isn'?t (a |about )?(the )?(memes?|topic)\b|is not (a |about )?(the )?(memes?|topic)\b|no memes? (here|included|in this)|don'?t (even )?(have|include) (any )?memes?\b|this isn'?t about)\b/i;

const OFF_TOPIC =
  /\b(lasagna|ricotta|recipe|preheat|ground beef|tomato sauce|spaghetti|parmesan|casserole|bake at|tablespoons?|teaspoons?|cups of|wifi password|wi-fi password|office wi-?fi)\b/i;

const FILLER = /\b(lorem ipsum|asdf|test test|placeholder|todo)\b/i;

const STOP = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with", "by",
  "original", "deliver", "delivery", "budget", "studio", "please", "job",
  "concepts", "concept", "items", "item", "ideas", "idea", "work", "task",
  "tasks", "the", "this", "that",
]);

export function parseBrief(job = {}) {
  const raw = `${job.title || ""} ${job.description || ""}`.trim();
  const withoutMoney = raw.replace(/\$\s*\d+(?:\.\d+)?/g, " ").replace(/\s+/g, " ").trim();

  const counted = withoutMoney.match(
    /(\d+)\s+(?:original\s+)?([a-z][a-z-]{2,24})/i
  );
  const anyNumber = withoutMoney.match(/\b(\d+)\b/);
  const count = Math.max(1, parseInt((counted || anyNumber || [])[1] || "1", 10));

  let topicWord = (counted && counted[2] ? counted[2] : "").toLowerCase();
  if (!topicWord || STOP.has(topicWord)) {
    const words = withoutMoney.toLowerCase().match(/[a-z][a-z-]{2,24}/g) || [];
    topicWord = words.find((w) => !STOP.has(w)) || "item";
  }

  const singular = topicWord.replace(/s\b/, "");
  const topicTerms = new Set([topicWord, singular, `${singular}s`]);

  return {
    count,
    topic: singular,
    topicTerms: [...topicTerms],
    original: /\boriginal\b/i.test(withoutMoney),
    raw,
  };
}

export function splitItems(content) {
  const text = String(content || "").trim();
  if (!text) return [];

  const linePieces = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const marker = /^(?:\d+[\.\)\-:]\s+|\-\s+|\*\s+|\u2022\s+)/;
  const marked = linePieces.filter((l) => marker.test(l));
  if (marked.length >= 2) {
    return linePieces.map((l) => l.replace(marker, "").trim()).filter(Boolean);
  }

  const inline = text
    .split(/(?:^|\s+)(?:\d+[\.\)\-:]\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (inline.length >= 2) return inline;

  return linePieces.length ? linePieces : [text];
}

function normalizeItem(item) {
  return String(item)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(item) {
  return (String(item).match(/\p{L}+\b/gu) || []).length;
}

function isTooShort(item) {
  return normalizeItem(item).length < 28 || wordCount(item) < 6;
}

/** Taglines, names, and slogans are short by nature, so non-meme briefs use a lower bar. */
function isTooShortFor(item, brief) {
  if (brief.topic === "meme") return isTooShort(item);
  return normalizeItem(item).length < 16 || wordCount(item) < 3;
}

function briefWords(brief) {
  const words = (brief.raw || "").toLowerCase().match(/[a-z][a-z-]{3,24}/g) || [];
  return new Set(words.filter((w) => !STOP.has(w)));
}

function hasCaptionPunchline(item) {
  const text = String(item).trim();
  if (/["“][^"”]{3,}["”]\s*[—–\-:]\s+\S+/.test(text)) return true;
  if (/\S.{2,80}?\s+[—–]\s+\S.{5,}/.test(text)) return true;
  if (/\S.{2,80}?\s+ - \s+\S.{5,}/.test(text) && text.length >= 28) return true;
  if (/^["“]?[^:]{3,70}["”]?\s*:\s+.{10,}/.test(text)) return true;
  if (/\S{3,}\s+\/\s+\S{3,}/.test(text)) return true;
  if (MEME_FORMAT.test(text) && text.length >= 28) return true;
  return false;
}

function isNegationOrMeta(item, allText) {
  return NEGATION.test(item) || NEGATION.test(allText);
}

function isOffTopicText(item, allText) {
  return OFF_TOPIC.test(item) || OFF_TOPIC.test(allText);
}

function looksLikeMemeIdea(item) {
  if (isTooShort(item)) return false;
  if (OFF_TOPIC.test(item)) return false;
  if (NEGATION.test(item)) return false;
  return hasCaptionPunchline(item);
}

function looksLikeTopicItem(item, brief) {
  if (brief.topic === "meme") return looksLikeMemeIdea(item);
  if (isTooShortFor(item, brief) || OFF_TOPIC.test(item) || NEGATION.test(item)) return false;
  const norm = normalizeItem(item);
  const mentionsTopic = brief.topicTerms.some((t) => new RegExp(`\\b${t}\\b`, "i").test(item));
  const bw = briefWords(brief);
  const sharesBriefWord = norm.split(" ").some((w) => bw.has(w) || bw.has(`${w}s`) || bw.has(w.replace(/s$/, "")));
  return mentionsTopic || sharesBriefWord || hasCaptionPunchline(item) || norm.length >= 24;
}

function uniqueKey(item) {
  const norm = normalizeItem(item);
  const words = norm.split(" ").slice(0, 10).join(" ");
  return words || norm;
}

export function ruleBasedEvaluate(job, content) {
  const brief = parseBrief(job);
  const text = String(content || "").trim();
  const items = splitItems(text);
  const reasons = [];

  let score = 50;
  const seen = new Set();
  let valid = 0;
  let structured = 0;
  let tooShort = 0;
  let duplicates = 0;
  let negatedItems = 0;
  let offTopicItems = 0;

  for (const item of items) {
    if (isTooShortFor(item, brief) && !hasCaptionPunchline(item)) {
      tooShort += 1;
      continue;
    }
    if (NEGATION.test(item)) {
      negatedItems += 1;
      continue;
    }
    if (OFF_TOPIC.test(item)) {
      offTopicItems += 1;
      continue;
    }
    if (!looksLikeTopicItem(item, brief)) {
      continue;
    }
    const key = uniqueKey(item);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    valid += 1;
    if (hasCaptionPunchline(item)) structured += 1;
  }

  const hasNegation = negatedItems > 0 || NEGATION.test(text);
  const hasOffTopic = offTopicItems > 0 || OFF_TOPIC.test(text);
  const hasFiller = FILLER.test(text);

  reasons.push(
    `Parsed brief as ${brief.count} ${brief.topic} idea${brief.count === 1 ? "" : "s"}.`
  );

  if (valid >= brief.count) {
    score += 30;
    reasons.push(
      `Found ${valid} distinct ${brief.topic === "meme" ? "caption/punchline " : ""}idea${valid === 1 ? "" : "s"} that fit the topic.`
    );
  } else {
    const missing = brief.count - valid;
    score -= 15 + 6 * missing;
    reasons.push(
      `Found only ${valid} distinct ${brief.topic} idea${valid === 1 ? "" : "s"} (${missing} required item${missing === 1 ? "" : "s"} missing).`
    );
  }

  if (structured > 0 && brief.topic === "meme") {
    score += Math.min(15, structured * 3);
  }

  if (tooShort > 0) {
    score -= Math.min(18, tooShort * 6);
    reasons.push(`${tooShort} item${tooShort === 1 ? " is" : "s are"} too short to count.`);
  }
  if (duplicates > 0) {
    score -= Math.min(25, duplicates * 8);
    reasons.push(`${duplicates} item${duplicates === 1 ? " is a duplicate" : "s are duplicates"}.`);
  }
  if (hasNegation) {
    score -= 20;
    reasons.push(`"${brief.topic}" appears as a negation or meta-text, not as delivered work.`);
  }
  if (hasOffTopic) {
    score -= 30;
    reasons.push("Submission contains off-topic content (for example a recipe or unrelated notes).");
  }
  if (hasFiller) {
    score -= 20;
    reasons.push("Contains placeholder or filler text.");
  }

  // Hard gates: missing required items, or no valid items plus off-topic/negation.
  if (valid < brief.count) score = Math.min(score, PASS_THRESHOLD - 1);
  if (valid === 0 && (hasOffTopic || hasNegation)) score = Math.min(score, 35);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const passed = score >= PASS_THRESHOLD;
  reasons.push(passed ? `Pass (score ${score} ≥ ${PASS_THRESHOLD}).` : `Fail (score ${score} < ${PASS_THRESHOLD}).`);

  return {
    score,
    reasoning: reasons.join(" "),
    passed,
    recommend_approve: passed,
    evaluator: SCORER_LABEL,
    label: SCORER_LABEL,
    source: "rule-based",
    model: null,
    fallback: false,
    fallback_reason: null,
    brief,
    stats: { valid, structured, tooShort, duplicates, negatedItems, offTopicItems, itemCount: items.length },
  };
}
