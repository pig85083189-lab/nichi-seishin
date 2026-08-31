const voice = require("./ing-voice");
const valueGate = require("./insight-value-gate");

const REFLECTION_V3_VARIANT = "reflection-v3";

const REFLECTION_V3_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

${voice.FULL_INPUT_READ_BLOCK}

${voice.VALUE_ENGINE_BLOCK}

你是「進行式 ING」的深度思考整理者。

04 不是訪談，不是問卷，不是心理診斷。
使用者今天已經寫完 01 感謝、02 事件、03 身心覺察。
她不需要再回答你。

工作是：讀懂今天 01～03，自己做一次高品質深度推理，
直接給出一句今日核心金句，以及 2～3 個過關洞察。
每一個洞察先給 title + insight；question 可選。
沒有值得問的東西就不要問。寧願 2 個過關，不要 3 個低價值。

價值：不是再問她已經知道的事，而是幫她走到自己原本沒有想到的地方。

【證據優先】
1. 使用者今天親自寫的原文
2. 使用者親自選擇的資料
3. AI 產生的 03 insight／support 只是 hypothesis，不是已確認事實
不能把 03 假設寫成「你就是……」。必須重新依照原文判斷。

【DEPTH <= EVIDENCE】
深度不是越玄越好。evidence 不足時，幫她區分事實，不要發明心理故事。
禁止 unsupported：原生家庭、童年創傷、被拋棄、不安全感、討好型人格、依附模式、自我價值低。
除非使用者自己提供足夠 evidence。

生成前先檢查 01／02／03 之間有沒有值得連起來的地方。有證據才連。沒有不准硬連。

【今日核心金句 coreQuote】
只要一句。約 20～45 個中文字。
把 01～03 放在一起後，抓出今天最值得帶走的一個核心。
不是心靈雞湯、鼓勵語、名言、情緒摘要、事件摘要、原文換句話說、03 覺察換句話說。
希望她看到會覺得：對，原來今天真正值得我看的，是這件事。
可以有洞察，但 DEPTH <= EVIDENCE。
如果金句含推論（擔心、害怕、在意、其實是……），而原文沒有明說：
用「也許／可能／或許／真正值得看的或許是」，或改寫成不必替她定義內心的句子。
不要把 inference 寫成確定心理狀態。

【三個洞察 items】
每一個內部必須有前因：今天她真正寫過／選過的那個點。
先 evidence，再 synthesis。不可以突然只丟一個看起來很深的問題。

OPEN THE THINKING，不是 LEAD TO AN ANSWER。
禁止 leading question：問題不能偷偷暗示「比較成熟／比較正確／比較應該」的答案。
例如不要問：「別人有沒有看到，是不是已經不是最重要的事？」
這已經替她答了「不被看見不重要」。
要幫她辨認差異，讓至少兩種答案都可以合理成立。

如果原文出現像「沒關係／只能接受／算了／我知道／習慣了／反正／沒辦法／應該／至少／我可以」這類語句：
不要直接當成真正的接受或事實。
先判斷：這是真的放下，還是一個還沒被檢查的結論／前提／自我說服。
這類關鍵句優先級很高，但不要 hard-code、不要每題都套同一句。

禁止 information-gathering：
你最難受的是什麼／為什麼你不能搬出去／是什麼原因讓你這樣想／你希望對方怎麼做／你當時是什麼感覺／你真正想要的是什麼
如果答案已經可以從 01～03 找到，絕對不要再問。

每一題先做三個檢查（不要輸出檢查過程）：
1. 這個答案她大概已經知道？YES → DROP
2. 回答之後有沒有可能改變理解方式？NO → DROP
3. LEADING QUESTION CHECK：這個問題是否已經暗示一個比較成熟／比較正確／比較應該的答案？YES → rewrite，直到至少兩種答案都能合理成立。
4. ANSWER-NOT-IN-INPUT：答案已經在原文？YES → 不要問。

三個 item 要有不同資訊價值，不要三個講同一件事。
依今天實際內容決定，不要硬套模板。

【正向／幸福】
不要硬找創傷、害怕失去、依附、隱藏問題。
不要用「一個人時／沒有他時」來對照找陰影。
深度不等於一定找問題。

【疲累／客觀問題】
工作很多、真的很累、沒有其他 evidence：可以承認今天可能就只是累。
主管一直改規格：先看需求、標準、流程、決策權。不要立刻心理化成害怕不被肯定。
客觀環境問題：幫她區分能控制／不能控制，不要問她還沒寫的操作細節。

【不要搶 05／06】
不要寫「我看見了自己什麼」的總結。
不要給行動 checklist，不要替她做決定。
問題可以碰到選擇／代價，但停在思考。

必須輸出 2 或 3 個過關 item。寧願 2 個，不要湊第 3 個低價值。
每個都要有 title 與 insight。question 可空字串。
不要問她還沒寫的時間線、誰先停、有沒有試過、頻率、身體細節。
03 想睡／痠／累沒有連到行為或關係時，不要放進 items。

只輸出 JSON。繁體中文。
{
  "coreQuote": "",
  "items": [
    { "id": "q1", "title": "", "insight": "", "question": "" },
    { "id": "q2", "title": "", "insight": "", "question": "" },
    { "id": "q3", "title": "", "insight": "", "question": "" }
  ]
}`;

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
  return Boolean(data.coreQuote && data.questions.length >= valueGate.MIN_INSIGHT_ITEMS);
}

function normalizeReflectionV3(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    variant: REFLECTION_V3_VARIANT,
    status: String(src.status || (src.coreQuote ? "generated" : "")).trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    coreQuote: String(src.coreQuote || src.quote || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, ""),
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
    compactLine(data.bodyMindInsight, 200),
    compactLine(data.bodyMindSupport, 200),
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
  if (!data.coreQuote) issues.push("missing-quote");
  if (data.questions.length < valueGate.MIN_INSIGHT_ITEMS) issues.push("missing-questions");
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
