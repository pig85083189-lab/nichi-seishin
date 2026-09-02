"use strict";

/**
 * ING answer-engine scaffold (content prompts cleared).
 * Helpers return null/false/empty so old call sites stay safe until new prompts arrive.
 */

const ANSWER_ENGINE_VERSION = "ing-answer-engine-scaffold";

/** Intentionally empty — content voice/prompts removed pending rewrite. */
const ANSWER_ENGINE_VOICE = "";

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function preserveMultiline(value) {
  return String(value == null ? "" : value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function userAskedToStop(value) {
  const data = value && typeof value === "object" ? value : {};
  const understand = data.understand && typeof data.understand === "object" ? data.understand : {};
  const direct =
    typeof value === "string"
      ? value
      : [data.userAnswer, data.understandAnswer, data.answer, data.answer2, understand.answer, understand.answer2]
          .filter(Boolean)
          .join("\n");
  return /(?:不想|不要)(?:再|繼續)?(?:想|談|聊|分析|回答|挖)|今天先這樣|先到這裡|到此為止|不用繼續|想停下來|先停(?:在這裡|一下)?|我想清楚了|我已經想清楚/.test(
    asText(direct)
  );
}

function noopNull() {
  return null;
}

function noopFalse() {
  return false;
}

module.exports = {
  ANSWER_ENGINE_VERSION,
  ANSWER_ENGINE_VOICE,
  PREMATURE_STOP: /$a/,
  FALSE_CONFIRM: /$a/,
  STOCK_SILENCE: /$a/,
  EMPTY_HEALING: /$a/,
  ING_EVAL_001: { id: "ING-EVAL-001", raw: {}, expectSee: {}, expectUnderstand: {}, expectGrow: {}, expectAct: { requiresUserConfirmed: true } },
  asText,
  preserveMultiline,
  userAskedToStop,
  looksPrematureStop: noopFalse,
  looksFalseConfirm: noopFalse,
  looksStockSilence: noopFalse,
  looksEmptyHealing: noopFalse,
  looksSeeFormat: noopFalse,
  hasThanksEventBody: noopFalse,
  integratedReflectionSeed: noopNull,
  integratedUnderstandFocus: noopNull,
  gratitudeCareVsRejectionSeed: noopNull,
  understandFocusSeed: noopNull,
  gratitudeLinesFromRaw: () => [],
  buildReception: () => "",
  composeSeeDocument: () => ({ insight: "", support: "" }),
  composeActLeadIn: () => "",
  shortExcerpt: asText,
};
