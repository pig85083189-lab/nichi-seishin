"use strict";

/**
 * ING AI 回答引擎 v2
 * Shared language + evaluation fixtures for 03 SEE / 04 UNDERSTAND / 05 GROW / 06 ACT.
 * Does not change provider/model/schema. Hypotheses stay hypotheses.
 */

const ANSWER_ENGINE_VERSION = "ing-answer-engine-v2";

const ANSWER_ENGINE_VOICE = `【ING AI 回答引擎 v2｜03～06 共用】
使用自然、白話的台灣繁體中文。
優先使用使用者原本輸入的詞，不要換成診斷或教練術語。
AI 的理解只能作為假設，不能表達成既定事實。
不說教、不診斷、不過度鼓勵。
不使用空泛的療癒金句或通用結尾。
不急著解決或要求使用者行動。
每次只推進一個真正重要的覺察或問題。
沉默與 NO_ACTION 都是有效結果；但 NO_ACTION 只能在已有 USER_CONFIRMED 覺察後才能判定。
03 要先讀完整份輸入。若同時有感謝、事件、身心感受，至少提出一個把三者放在一起的視角；連結不成立時要明說只是同日出現，不可硬湊，也不可只讀其中一段。
回話先具體承接使用者寫的內容，再整理其中的呼應、落差或需要，不要套固定人物、關係或衝突劇本。
04 若仍有真實未知，禁止用「已經想清楚了／不需要再往下挖」結束。
05 在使用者回答或勾選確認前，禁止寫「妳已經看見了」。
06 只能從 USER_CONFIRMED 05 長出下一步。`;

const PREMATURE_STOP = /已經想清楚|不需要再往下挖|先這樣就很好|沒有一定要再往下|已經看得滿清楚|暫時沒有看到需要再被解讀/;
const FALSE_CONFIRM = /妳已經看見了|你已經看見了|妳已經承認|你已經承認|妳已經確認|你已經確認|妳已經知道自己/;
const STOCK_SILENCE = /今天的你，好像已經看得滿清楚了|今天的妳，好像已經看得滿清楚了|暫時沒有看到需要再被解讀的地方|能知道自己為什麼開心、為什麼累，本身就是一種覺察/;

/** ING-EVAL-001 — mother 「滾出去」 vs gratitude for kind speech / presence */
const ING_EVAL_001 = {
  id: "ING-EVAL-001",
  label: "mother push-away vs gratitude for kind presence",
  raw: {
    thanksText: "我想感謝有人願意好好說話\n我想感謝在我需要的時候有人陪在身邊",
    event: "媽媽叫我滾出去，也希望我搬出去。",
    mood: "難過",
    bodyMindText: "胸口很不舒服，整個人悶悶的。",
  },
  expectSee: {
    mustTouch: [/感謝|好好說話|陪在身邊|需要/, /滾出去|搬出去|媽媽/, /不舒服|胸口|悶/],
    mustContrast: /放在一起|可是|但|同時|一邊|另一/,
    forbid: STOCK_SILENCE,
    idealDirection:
      "感謝的是好好說話與陪伴；最不舒服的是被『滾出去』推開。在意的可能不只是搬不搬，而是關係裡能不能被好好說話、被理解。",
  },
  expectUnderstand: {
    forbidStopCopy: PREMATURE_STOP,
    mustOfferAngles: /搬出去|說話的方式|被推開|不要我|爭吵/,
    maxQuestions: 1,
    idealDirection:
      "媽媽可能擔心家裡反覆爭吵；對妳來說那句話也可能像『這個家不要我了』。難受的是搬出去本身，還是說話方式讓妳覺得被推開？",
  },
  expectGrow: {
    forbidBeforeConfirm: FALSE_CONFIRM,
  },
  expectAct: {
    requiresUserConfirmed: true,
  },
};

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function looksPrematureStop(text) {
  return PREMATURE_STOP.test(asText(text));
}

function looksFalseConfirm(text) {
  return FALSE_CONFIRM.test(asText(text));
}

function looksStockSilence(text) {
  return STOCK_SILENCE.test(asText(text));
}

function hasThanksEventBody(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const thanks = asText(data.thanksText || data.thanks);
  const event = asText(data.event);
  const body = asText(data.bodyMindText || data.bodyNote);
  return thanks.length >= 4 && event.length >= 4 && body.length >= 2;
}

const POSITIVE = /感謝|謝謝|感恩|開心|幸福|安心|支持|幫忙|陪|理解|肯定|完成|順利|喜歡|珍惜|溫暖|放鬆|踏實/;
const DIFFICULT = /難過|生氣|委屈|孤單|擔心|焦慮|壓力|爭吵|拒絕|推開|失敗|卡住|不舒服|疲|累|痛|緊|悶|失眠|害怕|煩/;
const STOP_REQUEST = /(?:不想|不要)(?:再|繼續)?(?:想|談|聊|分析|回答|挖)|今天先這樣|先到這裡|到此為止|不用繼續|想停下來|先停(?:在這裡|一下)?/;

function shortExcerpt(value, max = 34) {
  const text = asText(value).replace(/^(?:今天)?(?:我)?(?:想)?(?:感謝|謝謝|感恩)(?:的是)?[：:]?\s*/, "");
  if (!text) return "";
  const first = text.split(/[。！？!?；;\n]+/).map(asText).find(Boolean) || text;
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

function userAskedToStop(value) {
  const data = value && typeof value === "object" ? value : {};
  const understand = data.understand && typeof data.understand === "object" ? data.understand : {};
  const direct = typeof value === "string"
    ? value
    : [data.userAnswer, data.understandAnswer, data.answer, data.answer2, understand.answer, understand.answer2].filter(Boolean).join("\n");
  return STOP_REQUEST.test(asText(direct));
}

/** A content-agnostic bridge across gratitude, event and embodied experience. */
function integratedReflectionSeed(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  if (!hasThanksEventBody(data)) return null;
  const thanks = asText(data.thanksText || data.thanks);
  const event = asText(data.event);
  const body = asText(data.bodyMindText || data.bodyNote);
  const thanksBit = shortExcerpt(thanks);
  const eventBit = shortExcerpt(event);
  const bodyBit = shortExcerpt(body, 26);
  const contrast = POSITIVE.test(thanks) && (DIFFICULT.test(event) || DIFFICULT.test(body));
  const relation = contrast ? "CONTRAST" : "COMMON_THREAD";
  return {
    id: "seed-integrated-reflection",
    type: relation,
    statement: contrast
      ? `妳一邊寫下「${thanksBit}」的感謝，另一邊也經歷了「${eventBit}」，身體還留著「${bodyBit}」的感覺。把它們放在一起，今天在意的可能不只是一件事的結果，也包括事情發生時自己怎麼被影響。`
      : `妳在感謝裡寫下「${thanksBit}」，也提到「${eventBit}」；身體的「${bodyBit}」讓這兩段不只是事情清單。它們之間有沒有呼應，值得先當成一個可能的角度。`,
    evidence: [thanksBit, eventBit, bodyBit].filter(Boolean),
    newInformation: "感謝、事件和身體感受分開寫下了，彼此的呼應或落差還沒被放在一起看",
    whyItMatters: contrast
      ? "也許可以分清楚：今天帶來支持的是什麼、消耗又來自哪裡，以及身體對這個落差有什麼反應。這只是待確認的理解。"
      : "這三段也可能只是同一天各自發生的事；若它們有關，連結要由妳的感受來確認，不能由 AI 代替決定。",
    alternative: "也可能三段內容只是同日出現，彼此沒有更深的連結。",
    confidence: "low",
    fallbackLens: true,
  };
}

function gratitudeCareVsRejectionSeed(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const thanks = asText(data.thanksText || data.thanks);
  const event = asText(data.event);
  const body = asText(data.bodyMindText || data.bodyNote);
  if (!hasThanksEventBody(data)) return null;
  const care = /好好說話|陪在身邊|需要的時候|陪伴|願意.*說話|被理解/.test(thanks);
  const reject = /滾出去|搬出去|不要我|拋棄|趕走|推開/.test(event);
  if (!care || !reject) return null;
  return {
    id: "seed-care-vs-reject",
    type: "CONTRAST",
    statement:
      "有一個角度是：妳今天感謝的，好像都是有人願意好好說話、在需要時陪著；但讓妳最不舒服的，正好是關係裡被推開的那一句。",
    evidence: [thanks.split(/\n/)[0], event, body].filter(Boolean).slice(0, 4),
    newInformation: "感謝裡被珍惜的對待方式，和事件裡受傷的對待方式，還沒被放在一起看",
    whyItMatters:
      "不一定先判斷誰對誰錯。值得再感受的，也許是妳在意的不只是搬不搬出去，而是關係裡能不能被好好說話、被理解。",
    alternative: "也可能今天只是兩件剛好同時發生的事，沒有更深連結。",
    confidence: "medium",
    fallbackLens: true,
  };
}

function integratedUnderstandFocus(raw) {
  const seed = integratedReflectionSeed(raw);
  if (!seed) return null;
  const detailSize = seed.evidence.join("").replace(/\s/g, "").length;
  if (detailSize < 28) return null;
  return {
    statement: "感謝、今天發生的事，和身體留下的感覺之間，可能有呼應，也可能有落差。",
    source: "raw",
    whyWorthThinking: `${seed.statement} 還不能替妳決定它們的關係，但值得讓妳確認：哪一段最影響今天的感受。`,
  };
}

function understandFocusSeed(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const blob = [data.thanksText, data.event, data.bodyMindText, data.mood].map(asText).join("\n");
  if (!/滾出去|搬出去/.test(blob) || !/媽媽|母親/.test(blob)) return null;
  return {
    statement: "難受的，比較像搬出去這件事本身，還是她說話的方式讓妳覺得被推開。",
    source: "raw",
    whyWorthThinking:
      "媽媽要妳搬出去，可能有她的擔心；對妳來說，那句話也可能像是在說這個家不要妳了。這兩層都還可以再對一下。",
  };
}

module.exports = {
  ANSWER_ENGINE_VERSION,
  ANSWER_ENGINE_VOICE,
  PREMATURE_STOP,
  FALSE_CONFIRM,
  STOCK_SILENCE,
  ING_EVAL_001,
  asText,
  looksPrematureStop,
  looksFalseConfirm,
  looksStockSilence,
  hasThanksEventBody,
  userAskedToStop,
  integratedReflectionSeed,
  integratedUnderstandFocus,
  gratitudeCareVsRejectionSeed,
  understandFocusSeed,
};
