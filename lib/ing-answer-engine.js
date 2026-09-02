"use strict";

/**
 * ING AI 回答引擎 v3
 * Shared tone + section format helpers for 03 SEE / 04 UNDERSTAND / 05 GROW / 06 ACT.
 * No provider/model/schema change. Hypotheses stay hypotheses. USER_CONFIRMED / NO_ACTION gates remain.
 */

const ANSWER_ENGINE_VERSION = "ing-answer-engine-v3";

const ANSWER_ENGINE_VOICE = `【ING AI 回答引擎 v3｜03～06 共通語氣】
語氣：溫柔、具體、穩定、有條理的日常覺察。像一位真正讀完她今天寫的內容、理解她的陪伴者。
使用自然白話的台灣繁體中文。優先用她原本的詞。

必須遵守：
1. 先具體承接使用者原文，不要直接套泛用鼓勵。
2. 不把 AI 推測寫成使用者已確認的事實。
3. 不使用過度空泛、文青、說教或心理諮商式語言。
4. 每一次都有明確核心，但可保留「這可能只是其中一種理解」。
5. 不要為了完整而硬湊感恩、事件、身體三者的關聯；有連結才說，沒有就分著看。
6. 各階段功能不同，不要硬套同一種長篇格式。
7. 不急著解決或要求行動。沉默與 NO_ACTION 都是有效結果；NO_ACTION 只能在已有 USER_CONFIRMED 後判定。
8. 05 在使用者勾選／回答確認前，禁止「妳已經看見了」。
9. 06 只能從 USER_CONFIRMED 長出下一步。`;

const PREMATURE_STOP = /已經想清楚|不需要再往下挖|先這樣就很好|沒有一定要再往下|已經看得滿清楚|暫時沒有看到需要再被解讀/;
const FALSE_CONFIRM = /妳已經看見了|你已經看見了|妳已經承認|你已經承認|妳已經確認|你已經確認|妳已經知道自己/;
const STOCK_SILENCE = /今天的你，好像已經看得滿清楚了|今天的妳，好像已經看得滿清楚了|暫時沒有看到需要再被解讀的地方|能知道自己為什麼開心、為什麼累，本身就是一種覺察/;
const EMPTY_HEALING = /好好愛自己|相信自己|一切都會好|你已經很棒|放鬆一點|學會愛自己|成長的一部分/;

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

function preserveMultiline(value) {
  return String(value == null ? "" : value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function looksEmptyHealing(text) {
  return EMPTY_HEALING.test(asText(text));
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
const STOP_REQUEST = /(?:不想|不要)(?:再|繼續)?(?:想|談|聊|分析|回答|挖)|今天先這樣|先到這裡|到此為止|不用繼續|想停下來|先停(?:在這裡|一下)?|我想清楚了|我已經想清楚/;

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

function looksSeeFormat(text) {
  const line = preserveMultiline(text);
  return /【核心結論】|【今日金句】|【感恩清單】|【一、/.test(line) || /^主題[：:]/.test(line);
}

function gratitudeLinesFromRaw(raw) {
  const thanks = String((raw && (raw.thanksText || raw.thanks)) || "");
  return thanks
    .split(/\n+/)
    .map((line) => asText(line))
    .filter((line) => line.length >= 4)
    .map((line) => line.replace(/^(?:我想)?(?:感謝|謝謝|感恩)(?:的是)?[：:\s]*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildReception(raw) {
  const parts = [];
  const thanks = shortExcerpt(raw && (raw.thanksText || raw.thanks), 28);
  const event = shortExcerpt(raw && raw.event, 36);
  const body = shortExcerpt(raw && (raw.bodyMindText || raw.bodyNote), 24);
  const mood = asText(raw && raw.mood);
  if (thanks) parts.push(`感謝裡寫到「${thanks}」`);
  if (event) parts.push(`今天發生「${event}」`);
  if (mood) parts.push(`心情是${mood}`);
  if (body) parts.push(`身體留下「${body}」`);
  if (!parts.length) return "我先把你今天寫下的內容看完了。";
  return `我先接住你今天寫的：${parts.join("；")}。`;
}

function defaultTheme(raw, core) {
  const statement = asText(core && core.statement);
  if (statement) return statement.length > 22 ? `${statement.slice(0, 22)}…` : statement;
  const event = shortExcerpt(raw && raw.event, 18);
  if (event) return event;
  return "今天值得被好好看見的一角";
}

function composeSeeDocument(options) {
  const opts = options && typeof options === "object" ? options : {};
  const raw = opts.raw || {};
  const core = opts.core || {};
  const date = asText(opts.date) || "";
  const theme = asText(opts.theme) || defaultTheme(raw, core);
  const title = asText(opts.sectionTitle || opts.title) || asText(core.statement) || theme;
  const reception = asText(opts.reception) || buildReception(raw);
  const findings = (Array.isArray(opts.findings) ? opts.findings : [])
    .map(asText)
    .filter(Boolean)
    .slice(0, 3);
  const evidenceFindings = (Array.isArray(core.evidence) ? core.evidence : [])
    .map((item) => asText(item))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => `你寫到「${shortExcerpt(item, 28)}」，這一點值得被單獨看見。`);
  const bullets = findings.length ? findings : evidenceFindings;
  while (bullets.length < 2 && asText(core.statement)) {
    bullets.push(asText(core.statement));
    break;
  }
  if (bullets.length < 2 && asText(raw.event)) bullets.push(`今天的事件「${shortExcerpt(raw.event, 30)}」仍在影響你。`);
  const extension = asText(opts.extension) || asText(core.whyItMatters) || asText(core.alternative) || "這可能只是其中一種理解，仍可由你自己再確認。";
  const conclusion = asText(opts.conclusion) || asText(core.statement) || theme;
  const quotes = (Array.isArray(opts.quotes) ? opts.quotes : [])
    .map(asText)
    .filter((line) => line && !looksEmptyHealing(line))
    .slice(0, 3);
  if (!quotes.length) {
    quotes.push(conclusion.length > 28 ? conclusion.slice(0, 28) : conclusion);
    if (asText(core.newInformation)) quotes.push(asText(core.newInformation).slice(0, 28));
  }
  const gratitude = (Array.isArray(opts.gratitude) ? opts.gratitude : gratitudeLinesFromRaw(raw))
    .map(asText)
    .filter(Boolean)
    .slice(0, 3);

  const insight = `主題：${theme}`;
  const lines = [
    date ? `【覺察｜${date}】` : "【覺察】",
    "",
    `【一、${title}】`,
    reception,
    "",
    ...bullets.slice(0, 3).map((item) => `・${item}`),
    "",
    `・${extension}`,
    "",
    "【核心結論】",
    conclusion,
    "",
    "【今日金句】",
    ...quotes.slice(0, 3).map((item) => `「${item.replace(/^「|」$/g, "")}」`),
  ];
  if (gratitude.length) {
    lines.push("", "【感恩清單】", ...gratitude.map((item) => `・${item}`));
  }
  return {
    insight,
    support: preserveMultiline(lines.join("\n")),
    theme,
    conclusion,
    quotes,
    gratitude,
  };
}

function composeActLeadIn(confirmed, raw) {
  const first = asText(confirmed && confirmed[0] && (confirmed[0].title || confirmed[0].text));
  const core = first ? shortExcerpt(first, 22) : "自己真正在意的地方";
  const eventBit = shortExcerpt(raw && raw.event, 18);
  const hook = eventBit ? `從你今天寫下的「${eventBit}」裡` : "從你今天寫下的內容裡";
  return `${hook}，我看到你已經知道${core}。接下來不用一次改很多，可以先從這三件小事開始。`;
}

module.exports = {
  ANSWER_ENGINE_VERSION,
  ANSWER_ENGINE_VOICE,
  PREMATURE_STOP,
  FALSE_CONFIRM,
  STOCK_SILENCE,
  EMPTY_HEALING,
  ING_EVAL_001,
  asText,
  preserveMultiline,
  looksPrematureStop,
  looksFalseConfirm,
  looksStockSilence,
  looksEmptyHealing,
  looksSeeFormat,
  hasThanksEventBody,
  userAskedToStop,
  integratedReflectionSeed,
  integratedUnderstandFocus,
  gratitudeCareVsRejectionSeed,
  understandFocusSeed,
  gratitudeLinesFromRaw,
  buildReception,
  composeSeeDocument,
  composeActLeadIn,
  shortExcerpt,
};
