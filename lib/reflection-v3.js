const voice = require("./ing-voice");

const REFLECTION_V3_VARIANT = "reflection-v3";

const REFLECTION_V3_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

你是「進行式 ING」的深度思考整理者。

04 不是訪談，不是問卷，不是心理診斷。
使用者今天已經寫完 01 感謝、02 事件、03 身心覺察。
她不需要再回答你。

工作是：讀懂今天 01～03，自己做一次高品質深度推理，
直接給出一句今日核心金句，以及三個深度反思問題。

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

【今日核心金句 coreQuote】
只要一句。約 20～45 個中文字。
把 01～03 放在一起後，抓出今天最值得帶走的一個核心。
不是心靈雞湯、鼓勵語、名言、情緒摘要、事件摘要、原文換句話說、03 覺察換句話說。
希望她看到會覺得：對，原來今天真正值得我看的，是這件事。
可以有洞察，但 DEPTH <= EVIDENCE。
如果金句含推論（擔心、害怕、在意、其實是……），而原文沒有明說：
用「也許／可能／或許／真正值得看的或許是」，或改寫成不必替她定義內心的句子。
不要把 inference 寫成確定心理狀態。

【三個深度反思問題】
每一題內部必須有前因：今天她真正寫過／選過、讓你想問這題的那個點。
先讓她知道「我是從你哪一段想到這裡」，再問問題。
不可以突然只丟一個看起來很深的問題。

請把 basis + question 寫成自然完整的 text。不要每天同一套「你今天提到 X。我注意到 Y。所以我想問 Z。」
可以換說法：你剛剛有一句話我很在意……／看到你寫這段，我會想到一件事……／前面你說到……，這裡其實很值得再想一下。

例如她寫「有人提醒我之後，我更確定現在努力的方向是對的」：
不要只問：「如果沒有那位貴人的提點，你原本對自己努力方向的判斷，會跟現在一樣清楚嗎？」
要寫成：「你今天提到，有人提醒你之後，你更確定自己現在努力的方向是對的。如果今天沒有這個提醒，你原本也會這麼相信自己的方向嗎？還是心裡其實還是會有一點不確定？」

題目可以 2～4 句，約 40～160 個中文字，因為需要前因。不要為了短而拿掉前因。

至少一題要讓人停下來：對耶，我沒有這樣想過。
工作是 OPEN THE THINKING，不是 LEAD TO AN ANSWER。
禁止 leading question：問題不能偷偷暗示「比較成熟／比較正確／比較應該」的答案。
例如不要問：「別人有沒有看到，是不是已經不是最重要的事？」
這已經替她答了「不被看見不重要」。
要幫她辨認差異，讓至少兩種答案都可以合理成立。

如果原文出現像「沒關係／只能接受／算了／我知道／習慣了／反正／沒辦法／應該／至少／我可以」這類語句：
不要直接當成真正的接受或事實。
先判斷：這是真的放下，還是一個還沒被檢查的結論／前提／自我說服。
這類關鍵句優先級很高，但不要 hard-code、不要每題都套同一句。
目的是找原文裡可能藏著 assumption / self-conclusion / contradiction 的話。

禁止 information-gathering：
你最難受的是什麼／為什麼你不能搬出去／是什麼原因讓你這樣想／你希望對方怎麼做／你當時是什麼感覺／你真正想要的是什麼
如果答案已經可以從 01～03 找到，絕對不要再問。

每一題先做三個檢查（不要輸出檢查過程）：
1. 這個答案她大概已經知道？YES → DROP
2. 回答之後有沒有可能改變理解方式？NO → DROP
3. LEADING QUESTION CHECK：這個問題是否已經暗示一個比較成熟／比較正確／比較應該的答案？YES → rewrite，直到至少兩種答案都能合理成立。

生成前 internally 分析，但不要顯示 reasoning：
FACT／FEELING／INTERPRETATION／ASSUMPTION／MIXED PROBLEMS／CONTROL／COST／ALTERNATIVE／CONTRADICTION／ALREADY KNOWS
例如可以留意：理解≠同意、接受≠沒有選擇、愛一個人≠所有代價都必須接受。不要硬套。

三題要有不同資訊價值，不要三題問同一件事。
理想上：一題拆沒檢查過的前提／矛盾；一題給另一個角度看；一題带到選擇、界線、代價或真正重要的事。
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

必須剛好三題。少一題就是失敗。
不要問她還沒寫的時間線、誰先停、有沒有試過、頻率、身體細節。

只輸出 JSON。繁體中文。
{
  "coreQuote": "",
  "questions": [
    { "id": "q1", "text": "" },
    { "id": "q2", "text": "" },
    { "id": "q3", "text": "" }
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

function normalizeReflectionQuestions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => {
      const text = voice.composeQuestionWithBasis(item);
      if (!text) return null;
      return { id: String((item && item.id) || `q${index + 1}`), text };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function hasReflectionV3Result(value) {
  const data = normalizeReflectionV3(value);
  return Boolean(data.coreQuote && data.questions.length >= 3);
}

function normalizeReflectionV3(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    variant: REFLECTION_V3_VARIANT,
    status: String(src.status || (src.coreQuote ? "generated" : "")).trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    coreQuote: String(src.coreQuote || src.quote || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, ""),
    questions: normalizeReflectionQuestions(src.questions),
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
  const src = raw && typeof raw === "object" ? raw : {};
  let coreQuote = String(src.coreQuote || src.quote || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, "");
  const questions = normalizeReflectionQuestions(src.questions);
  if (looksSoupQuote(coreQuote) || looksOverPsych(coreQuote)) coreQuote = "";
  const cleaned = questions.filter((item) => item.text && !looksOverPsych(item.text));
  return {
    coreQuote,
    questions: cleaned.slice(0, 3),
    sourceSig: reflectionV3SourceSig(ctx),
  };
}

function evaluateReflectionV3Quality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeReflectionV3(result);
  const source = userSourceBlob(ctx);
  const issues = [];
  if (!data.coreQuote) issues.push("missing-quote");
  if (data.questions.length < 3) issues.push("missing-questions");
  if (compactChars(data.coreQuote) > 70) issues.push("quote-too-long");
  if (looksSoupQuote(data.coreQuote)) issues.push("quote-soup");
  if (looksRestate(source, data.coreQuote)) issues.push("quote-is-summary");
  if (looksUnhedgedInference(data.coreQuote, source)) issues.push("quote-unhedged");
  const texts = data.questions.map((item) => item.text);
  texts.forEach((text, index) => {
    if (looksInfoGathering(text)) issues.push(`q${index + 1}-info-gathering`);
    if (looksKnownFromSource(text, source) && looksInfoGathering(text)) issues.push(`q${index + 1}-already-known`);
    if (looksOverPsych(text)) issues.push(`q${index + 1}-overpsych`);
    if (looksLeadingQuestion(text)) issues.push(`q${index + 1}-leading`);
    if (voice.looksAbstractJargon(text)) issues.push(`q${index + 1}-jargon`);
    if (options && options.requireContext && voice.looksMissingQuestionContext(text)) issues.push(`q${index + 1}-missing-context`);
  });
  if (looksSemanticDuplicate(texts[0], texts[1]) || looksSemanticDuplicate(texts[1], texts[2]) || looksSemanticDuplicate(texts[0], texts[2])) {
    issues.push("duplicate-questions");
  }
  if (looksOverPsych(`${data.coreQuote}${texts.join("")}`)) issues.push("overpsych");
  if (looksProblemHuntingPositive(source, `${data.coreQuote}${texts.join("")}`)) issues.push("positive-problem-hunt");
  if (options && options.forbid && options.forbid.test(`${data.coreQuote}${texts.join("")}`)) issues.push("unsupported");
  const knownCount = texts.filter((text) => looksInfoGathering(text) || looksRestate(source, text)).length;
  if (knownCount >= 3) issues.push("all-already-known");
  return { ok: !issues.length, issues, coreQuote: data.coreQuote, questions: data.questions };
}

function reflectionV3UserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return `請依今天 01～03 產出一句 coreQuote ＋ 三個深度反思問題。不要訪談。不要再要她回答。不要把 03 AI 假設寫成事實。
每一題都要有前因：先讓她知道你是從她今天哪一段想到這題，再問。白話。不要抽象詞。推測用會不會／有沒有可能／我有點好奇。

【01 今日感謝｜使用者原文】
${compactLine(ctx.thanksText || ctx.thanks, 240) || "未寫"}

【02 今日事件｜使用者原文】
${compactLine(ctx.event, 320) || "未寫"}

【02 心情】
${String(ctx.mood || ctx.moodLabel || "").trim() || "未選"}

【03 身心覺察原文｜使用者自己寫的，權重最高】
${compactLine(ctx.bodyMindText || ctx.bodyNote, 400) || "未寫"}

【03 模型假設｜hypothesis，不是事實】
覺察：${compactLine(ctx.bodyMindInsight, 200) || "無"}
引導：${compactLine(ctx.bodyMindSupport, 200) || "無"}

若幸福／安心：不要硬找問題，也不要拿獨處來對照。
若只是累、客觀工作／環境問題：先保持客觀，不要追問還沒寫的操作細節。
若 03 假設和原文不一樣：以原文為準。
問題不能偷偷給答案。金句若含推論，用也許／可能／或許。`;
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
};
