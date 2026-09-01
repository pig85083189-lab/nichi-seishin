"use strict";

/**
 * ING AI 回答引擎 v1
 * Shared language + evaluation fixtures for 03 SEE / 04 UNDERSTAND / 05 GROW / 06 ACT.
 * Does not change provider/model/schema. Hypotheses stay hypotheses.
 */

const ANSWER_ENGINE_VERSION = "ing-answer-engine-v1";

const ANSWER_ENGINE_VOICE = `【ING AI 回答引擎 v1｜03～06 共用】
使用自然、白話的台灣繁體中文。
優先使用使用者原本輸入的詞，不要換成診斷或教練術語。
AI 的理解只能作為假設，不能表達成既定事實。
不說教、不診斷、不過度鼓勵。
不使用空泛的療癒金句或通用結尾。
不急著解決或要求使用者行動。
每次只推進一個真正重要的覺察或問題。
沉默與 NO_ACTION 都是有效結果；但 NO_ACTION 只能在已有 USER_CONFIRMED 覺察後才能判定。
03 若同時有感謝、事件、身心感受，必須整合成一個視角，不可只讀其中一段。
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
  gratitudeCareVsRejectionSeed,
  understandFocusSeed,
};
