const voice = require("./ing-voice");
const valueGate = require("./insight-value-gate");
const insightReason = require("./insight-reason");

const REFLECTION_V3_VARIANT = "reflection-v3";

const REFLECTION_V3_SYSTEM = insightReason.WRITER_SYSTEM;

function compactLine(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const limit = Number(max) || 400;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function compactChars(text) {
  return String(text || "").replace(/\s+/g, "").trim().length;
}

function isReflectionV3Request(body) {
  return body?.variant === REFLECTION_V3_VARIANT || body?.context?.variant === REFLECTION_V3_VARIANT;
}

function emptyReflectionV3() {
  return {
    variant: REFLECTION_V3_VARIANT,
    status: "",
    sourceSig: "",
    coreQuote: "",
    questions: [],
    generatedAt: "",
  };
}

function normalizeReflectionQuestions(raw, max) {
  const list = Array.isArray(raw) ? raw : [];
  const limit = Number(max);
  const cap = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 8) : 3;
  return list
    .map((item, index) => voice.composeInsightItem(item, index, "q"))
    .filter(Boolean)
    .slice(0, cap);
}

function hasReflectionV3Result(value) {
  const data = normalizeReflectionV3(value);
  if ((data.status === "empty" || data.status === "silence") && data.sourceSig) return true;
  return Boolean(data.sourceSig && (data.coreQuote || data.questions.length >= 1 || (data.discovery && data.discovery.statement)));
}

function normalizeReflectionV3(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    variant: REFLECTION_V3_VARIANT,
    status: String(src.status || (src.coreQuote ? "generated" : src.discovery ? "discovery" : "")).trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    discovery: src.discovery && typeof src.discovery === "object" ? src.discovery : null,
    knownByUser: Array.isArray(src.knownByUser) ? src.knownByUser : [],
    coreQuote: String(src.coreQuote || src.quote || (src.discovery && src.discovery.statement) || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, ""),
    questions: normalizeReflectionQuestions(
      Array.isArray(src.items) && src.items.length ? src.items : src.questions
    ),
    generatedAt: String(src.generatedAt || "").trim(),
    internalDebug: src.internalDebug && src.internalDebug.model
      ? { provider: String(src.internalDebug.provider || ""), model: String(src.internalDebug.model || "") }
      : null,
  };
}

function reflectionV3SourceSig(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [
    compactLine(data.thanksText || data.thanks, 240),
    compactLine(data.event, 240),
    String(data.mood || data.moodLabel || "").trim(),
    compactLine(data.bodyMindText || data.bodyNote, 400),
  ].join("\n");
}

function reflectionV3Ready(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const thanks = compactChars(data.thanksText || data.thanks);
  const event = compactChars(data.event);
  const mood = String(data.mood || data.moodLabel || "").trim();
  const body = compactChars(data.bodyMindText || data.bodyNote);
  return Boolean(thanks >= 2 && event >= 4 && mood && body >= 6);
}

function reflectionV3SourceStale(guide, ctx) {
  const data = normalizeReflectionV3(guide);
  if (!hasReflectionV3Result(data) || !data.sourceSig) return false;
  return data.sourceSig !== reflectionV3SourceSig(ctx);
}

function looksSoupQuote(text) {
  const raw = String(text || "");
  if (/一切都會好|好好愛自己|你已經很棒|明天會更好|相信一切都是最好/.test(raw)) return true;
  return voice.looksBareTrustYourself(raw);
}

function looksOverPsych(text) {
  return /童年創傷|原生家庭|被拋棄|不安全感|討好型人格|依附模式|自我價值低|內在小孩|依附風格/.test(String(text || "")) || voice.looksAbstractJargon(text);
}

function looksInfoGathering(text) {
  return /你最難受的是什麼|為什麼你不能|是什麼原因讓你|你希望對方怎麼做|你當時是什麼感覺|你真正想要的是什麼|為什麼不能搬|當時發生了什麼|你有試過|有沒有試過|還能撐多久|你的身體是什麼樣子/.test(
    String(text || "")
  );
}

function looksLeadingQuestion(text) {
  return /是不是已經不是|是不是不重要|是不是其實不|難道不|是不是該|是不是應該|是不是時候|才是真正重要|是不是已經夠|是不是可以放下|是不是其實沒那麼|不就證明|不就說明|是不是說明你|是不是已經不需要|是不是最重要的其實|是不是已經不是最重要|別人有沒有看到，是不是/.test(
    String(text || "")
  );
}

function looksUnhedgedInference(quote, source) {
  const text = String(quote || "");
  const blob = String(source || "");
  if (!/擔心|害怕|恐懼|焦慮|其實是因為/.test(text)) return false;
  if (/也許|可能|或許|好像|似乎|真正值得看的或許/.test(text)) return false;
  if (/擔心|害怕|恐懼|焦慮/.test(blob)) return false;
  return true;
}

function closeTextKey(text) {
  return String(text || "")
    .replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "")
    .trim();
}

function looksRestate(source, text) {
  const a = closeTextKey(source);
  const b = closeTextKey(text);
  if (!a || !b || b.length < 8) return false;
  if (a.includes(b) || b.includes(a)) return a.length > 10 && b.length / Math.max(a.length, 1) > 0.55;
  const grams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size < 6 || gb.size < 6) return false;
  let inter = 0;
  gb.forEach((gram) => {
    if (ga.has(gram)) inter += 1;
  });
  return inter / gb.size >= 0.72;
}

function looksKnownFromSource(question, source) {
  const q = String(question || "");
  if (looksInfoGathering(q)) return true;
  return looksRestate(source, q);
}

function looksSemanticDuplicate(left, right) {
  const a = closeTextKey(left);
  const b = closeTextKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 10) return false;
  return long.includes(short) || looksRestate(left, right);
}

function looksProblemHuntingPositive(source, blob) {
  if (!/幸福|一直笑|很開心|很舒服|很安心|很放鬆/.test(String(source || ""))) return false;
  return /創傷|害怕失去|依附|隱藏問題|其實不快樂|陰影/.test(String(blob || ""));
}

function userSourceBlob(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [data.thanksText || data.thanks, data.event, data.bodyMindText || data.bodyNote].filter(Boolean).join("\n");
}

function normalizeReflectionV3Result(raw, ctx) {
  const gated = gateReflectionV3Result(raw, ctx);
  return {
    coreQuote: gated.coreQuote,
    questions: gated.questions,
    sourceSig: gated.sourceSig,
  };
}

function gateReflectionV3Result(raw, ctx) {
  const src = raw && typeof raw === "object" ? raw : {};
  let coreQuote = String(src.coreQuote || src.quote || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, "");
  const questions = normalizeReflectionQuestions(
    Array.isArray(src.items) && src.items.length ? src.items : src.questions,
    8
  );
  if (looksSoupQuote(coreQuote) || looksOverPsych(coreQuote)) coreQuote = "";
  const cleaned = questions.filter((item) => item.text && !looksOverPsych(item.text));
  const gated = valueGate.gateItems(cleaned, ctx, "insight");
  return {
    coreQuote,
    questions: gated.kept,
    sourceSig: reflectionV3SourceSig(ctx),
    dropped: gated.dropped,
  };
}

function reflectionV3ValueGateRetryPrompt(dropped, ctx) {
  return valueGate.valueGateRetryPrompt(dropped, "insight");
}

function evaluateReflectionV3Quality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeReflectionV3(result);
  const source = userSourceBlob(ctx);
  const issues = [];
  if (data.status === "silence" || data.status === "empty") {
    return { ok: true, issues: [], coreQuote: "", questions: [], status: "silence" };
  }
  if (!data.coreQuote && !data.discovery) issues.push("missing-quote");
  if (compactChars(data.coreQuote) > 70) issues.push("quote-too-long");
  if (looksSoupQuote(data.coreQuote)) issues.push("quote-soup");
  if (looksRestate(source, data.coreQuote)) issues.push("quote-is-summary");
  if (looksUnhedgedInference(data.coreQuote, source)) issues.push("quote-unhedged");
  const texts = data.questions.map((item) => item.text);
  const blob = `${data.coreQuote}${texts.join("")}`;
  texts.forEach((text, index) => {
    const item = data.questions[index] || {};
    if (looksInfoGathering(text)) issues.push(`q${index + 1}-info-gathering`);
    if (looksKnownFromSource(text, source) && looksInfoGathering(text)) issues.push(`q${index + 1}-already-known`);
    if (looksOverPsych(text)) issues.push(`q${index + 1}-overpsych`);
    if (looksLeadingQuestion(text)) issues.push(`q${index + 1}-leading`);
    if (voice.looksAbstractJargon(text)) issues.push(`q${index + 1}-jargon`);
    if (voice.looksFillerPhrase(text)) issues.push(`q${index + 1}-filler`);
    if (voice.looksAnswerAlreadyInInput(item.question || text, source)) issues.push(`q${index + 1}-answer-in-input`);
    if (options && options.valueGate) {
      valueGate.evaluateInsightCandidate(item, ctx).issues.forEach((issue) => issues.push(`q${index + 1}-${issue}`));
    }
    if (options && options.requireContext && voice.looksMissingQuestionContext(text)) issues.push(`q${index + 1}-missing-context`);
    if (options && options.requireValueEngine) {
      if (!item.title) issues.push(`q${index + 1}-missing-title`);
      else {
        const n = compactChars(item.title);
        if (n < 4 || n > 16) issues.push(`q${index + 1}-title-len`);
        if (voice.looksCategoryTitle(item.title)) issues.push(`q${index + 1}-category-title`);
      }
      const body = item.insight || text;
      const bodyKey = closeTextKey(body);
      const srcKey = closeTextKey(source);
      if (bodyKey.length >= 12 && srcKey.includes(bodyKey)) issues.push(`q${index + 1}-paraphrase`);
    }
  });
  if (looksSemanticDuplicate(texts[0], texts[1]) || looksSemanticDuplicate(texts[1], texts[2]) || looksSemanticDuplicate(texts[0], texts[2])) {
    issues.push("duplicate-questions");
  }
  if (looksOverPsych(blob)) issues.push("overpsych");
  if (looksProblemHuntingPositive(source, blob)) issues.push("positive-problem-hunt");
  if (voice.looksStoppedAtEllipsis(blob)) issues.push("ellipsis-stop");
  if (options && options.forbid && options.forbid.test(blob)) issues.push("unsupported");
  if (options && options.requireCrossSection && voice.hasCrossSectionOpportunity(ctx) && !voice.looksHasConnection(blob)) {
    issues.push("missing-connection");
  }
  const knownCount = texts.filter((text) => looksInfoGathering(text) || looksRestate(source, text)).length;
  if (knownCount >= 3) issues.push("all-already-known");
  return { ok: !issues.length, issues, coreQuote: data.coreQuote, questions: data.questions };
}

function reflectionV3UserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return `請依今天 01～03 產出一句 coreQuote ＋ 2～3 個過關洞察。不要訪談。不要再要她回答。不要把 03 AI 假設寫成事實。
完整讀完 USER RAW。省略號後面的句子也要讀。
每個 item 必須比原文多一個新關係。只是重述幸福、想睡→累、問答案已在原文的問題：刪掉。
寧願 2 個過關，不要湊第 3 個。03 想睡沒連到關係／選擇／模式，不要放進 04。
生成前先看 01／02／03 有沒有值得連起來的地方。有證據才連。

【01 今日感謝｜使用者原文】
${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}

【02 今日事件｜使用者原文】
${voice.userRawForPrompt(ctx.event) || "未寫"}

【02 心情】
${String(ctx.mood || ctx.moodLabel || "").trim() || "未選"}

【03 身心覺察原文｜使用者自己寫的，權重最高】
${voice.userRawForPrompt(ctx.bodyMindText || ctx.bodyNote) || "未寫"}

【03 模型假設｜hypothesis，不是事實】
覺察：${compactLine(ctx.bodyMindInsight, 200) || "無"}
引導：${compactLine(ctx.bodyMindSupport, 200) || "無"}

若幸福／安心：不要硬找問題，也不要拿獨處來對照。可以看見正在做對什麼、哪個習慣值得保留。
若只是累、客觀工作／環境問題：先保持客觀，不要追問還沒寫的操作細節。
若 03 假設和原文不一樣：以原文為準。
問題的答案如果已經在原文，不要問。金句若含推論，用也許／可能／或許。`;
}

function reflectionV3GenerationAllowed(options) {
  return Boolean(options && options.confirmed === true && options.auto !== true);
}

module.exports = {
  REFLECTION_V3_VARIANT,
  REFLECTION_V3_SYSTEM,
  REFLECTION_V3_REASONING_SYSTEM: insightReason.REASONING_SYSTEM,
  isReflectionV3Request,
  emptyReflectionV3,
  normalizeReflectionQuestions,
  normalizeReflectionV3,
  hasReflectionV3Result,
  reflectionV3SourceSig,
  reflectionV3Ready,
  reflectionV3SourceStale,
  normalizeReflectionV3Result,
  gateReflectionV3Result,
  reflectionV3ValueGateRetryPrompt,
  evaluateReflectionV3Quality,
  reflectionV3UserPrompt,
  reflectionV3GenerationAllowed,
  looksSoupQuote,
  looksOverPsych,
  looksInfoGathering,
  looksLeadingQuestion,
  looksUnhedgedInference,
  looksRestate,
  looksKnownFromSource,
  looksSemanticDuplicate,
  composeQuestionWithBasis: voice.composeQuestionWithBasis,
  composeInsightItem: voice.composeInsightItem,
};
