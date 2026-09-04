"use strict";

/**
 * AI Engine V2 — lightweight epistemic helpers (validation only).
 * Not a Judge/Gate/Selector. Does not decide "deep enough".
 */

const { TRUST } = require("./types");

const UNSUPPORTED_INFERENCE = new RegExp(
  [
    "童年",
    "原生家庭",
    "依附(型|風格|模式)",
    "創傷",
    "PTSD",
    "人格障礙",
    "潛意識(裡|中)?(其實|就是)",
    "內在小孩",
    "你總是(因為|由於)",
    "妳總是(因為|由於)",
    "診斷",
    "病理性",
    "你其實有憂鬱",
    "妳其實有憂鬱",
  ].join("|"),
  "i"
);

const GENERIC_MOTIVATION = new RegExp(
  [
    "相信自己[，,]?終有一天會發光",
    "所有努力都不會白費",
    "真正的成長來自內心",
    "給自己一點空間",
    "允許自己慢慢來",
    "你已經做得很好",
    "妳已經做得很好",
    "這很不容易",
  ].join("|")
);

const POSSIBILITY_MARKER = /有一個可能|也許|或許|換個角度看|也可以留意|不一定是這樣|值得看看|有個角度/;

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function looksUnsupportedInference(text) {
  return UNSUPPORTED_INFERENCE.test(asText(text));
}

function looksGenericMotivation(text) {
  return GENERIC_MOTIVATION.test(asText(text));
}

function hasCalibratedPossibilityLanguage(text) {
  return POSSIBILITY_MARKER.test(asText(text));
}

/**
 * Drop unsupported invention from a list of reflection strings.
 * Keeps grounded possibilities (does not reject for uncertainty).
 */
function filterUnsupportedLines(lines) {
  const list = Array.isArray(lines) ? lines : [];
  return list
    .map((line) => asText(line))
    .filter(Boolean)
    .filter((line) => !looksUnsupportedInference(line));
}

function classifyLineHint(text) {
  const line = asText(text);
  if (!line) return TRUST.UNSUPPORTED;
  if (looksUnsupportedInference(line)) return TRUST.UNSUPPORTED;
  if (hasCalibratedPossibilityLanguage(line)) return TRUST.POSSIBILITY;
  return TRUST.FACT;
}

module.exports = {
  asText,
  looksUnsupportedInference,
  looksGenericMotivation,
  hasCalibratedPossibilityLanguage,
  filterUnsupportedLines,
  classifyLineHint,
  UNSUPPORTED_INFERENCE,
};
