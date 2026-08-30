const AWARENESS_V3_VARIANT = "awareness-v3";

const AWARENESS_V3_SYSTEM = `你是「進行式 ING」的覺察整理者。

05 不是深度思考，不是訪談，不是診斷。
04 已經做過深度思考。05 只做一件事：
整理出 3 個「我可能真正看見了自己什麼」，讓使用者自己勾選認領。

AI-generated awareness ≠ user-confirmed awareness。
你只是提出可能，使用者之後才決定哪一句說中了她。

【證據優先】
1. 使用者今天親自寫的原文
2. 使用者親自選擇的心情／資料
3. 03 insight／support 只是 AI hypothesis
4. 04 coreQuote 與 reflection questions 只是 AI 輸出
04 的問題不是使用者回答，不能直接當成 user truth。
例如 04 問「你在意的其實是被理解嗎？」
05 不能直接寫「我發現我真正需要的是被理解」
除非使用者原文有足夠 evidence。

【DEPTH <= EVIDENCE】
禁止：心理診斷、人格貼標籤、原生家庭、童年創傷、依附分類、討好型人格、自我價值低、generic affirmation。
不要直接重複 03。不要直接把 04 question 當答案。

【三個覺察】
三個要有不同資訊價值，不是同一件事換三種說法。
可能包含：感受／在意、模式／習慣、價值／界線／選擇。
依今天內容決定，不要硬套模板。

【長度】
每一個 1 句為主，約 20～45 個中文字。必要時最多 2 個短句。
不要長篇。使用者要一眼能判斷：這個有沒有說中我？

【語氣】
第一人稱可認領。
「我發現，真正讓我累的不是事情很多，而是我一直覺得自己不能停。」
不要：「你可能是一個對自己要求很高的人。」

【正向／幸福】
不要硬找問題。positive awareness 也有價值。

【不要搶 03／04／06】
不要再做身心假設。不要再問深度反思。不要給行動 checklist。

只輸出 JSON。繁體中文。
{
  "items": [
    { "id": "a1", "text": "" },
    { "id": "a2", "text": "" },
    { "id": "a3", "text": "" }
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

function isAwarenessV3Request(body) {
  return body?.variant === AWARENESS_V3_VARIANT || body?.context?.variant === AWARENESS_V3_VARIANT;
}

function emptyAwarenessV3() {
  return {
    variant: AWARENESS_V3_VARIANT,
    sourceSig: "",
    items: [],
    selectedIds: [],
    generatedAt: "",
  };
}

function normalizeAwarenessV3Items(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => {
      const text = String((item && (item.text || item.line || item)) || "").replace(/\s+/g, " ").trim();
      if (!text) return null;
      return { id: String((item && item.id) || `a${index + 1}`), text };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeAwarenessV3(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const items = normalizeAwarenessV3Items(src.items || src.options);
  const allowed = new Set(items.map((item) => item.id));
  const selectedIds = (Array.isArray(src.selectedIds) ? src.selectedIds : [])
    .map((id) => String(id || "").trim())
    .filter((id) => allowed.has(id));
  return {
    variant: AWARENESS_V3_VARIANT,
    sourceSig: String(src.sourceSig || "").trim(),
    items,
    selectedIds,
    generatedAt: String(src.generatedAt || "").trim(),
  };
}

function hasAwarenessV3Result(value) {
  return normalizeAwarenessV3(value).items.length >= 3;
}

function selectedAwarenessV3Texts(value) {
  const data = normalizeAwarenessV3(value);
  const map = new Map(data.items.map((item) => [item.id, item.text]));
  return data.selectedIds.map((id) => map.get(id)).filter(Boolean);
}

function awarenessV3SourceSig(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const questions = Array.isArray(data.thinkQuestions || data.questions) ? data.thinkQuestions || data.questions : [];
  return [
    compactLine(data.thanksText || data.thanks, 240),
    compactLine(data.event, 240),
    String(data.mood || data.moodLabel || "").trim(),
    compactLine(data.bodyMindText || data.bodyNote, 400),
    compactLine(data.bodyMindInsight, 200),
    compactLine(data.bodyMindSupport, 200),
    compactLine(data.coreQuote || data.thinkCoreQuote, 200),
    questions.map((item) => compactLine(item && (item.text || item.question || item), 160)).filter(Boolean).join("|"),
  ].join("\n");
}

function awarenessV3Ready(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return Boolean(
    compactChars(data.thanksText || data.thanks) >= 2 &&
      compactChars(data.event) >= 4 &&
      String(data.mood || "").trim() &&
      compactChars(data.bodyMindText || data.bodyNote) >= 6 &&
      compactChars(data.coreQuote || data.thinkCoreQuote) >= 8
  );
}

function awarenessV3SourceStale(guide, ctx) {
  const data = normalizeAwarenessV3(guide);
  if (!hasAwarenessV3Result(data) || !data.sourceSig) return false;
  return data.sourceSig !== awarenessV3SourceSig(ctx);
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
  if (a.includes(b) || b.includes(a)) return a.length > 10 && b.length / Math.max(a.length, 1) > 0.62;
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
  return inter / gb.size >= 0.74;
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

function looksOverPsych(text) {
  return /童年創傷|原生家庭|被拋棄|不安全感|討好型人格|依附模式|自我價值低|內在小孩|依附風格/.test(String(text || ""));
}

function looksGenericAffirmation(text) {
  return /好好愛自己|相信自己|你已經很棒|一切都會好|明天會更好/.test(String(text || ""));
}

function looksSecondPerson(text) {
  return /^你/.test(String(text || "").trim());
}

function looksProblemHuntingPositive(source, blob) {
  if (!/幸福|一直笑|很開心|很舒服|很安心|很放鬆|有成就/.test(String(source || ""))) return false;
  return /創傷|害怕失去|依附|隱藏問題|其實不快樂|陰影/.test(String(blob || ""));
}

function userSourceBlob(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [data.thanksText || data.thanks, data.event, data.bodyMindText || data.bodyNote].filter(Boolean).join("\n");
}

function normalizeAwarenessV3Result(raw, ctx) {
  const src = raw && typeof raw === "object" ? raw : {};
  const items = normalizeAwarenessV3Items(src.items || src.options).filter(
    (item) => item.text && !looksOverPsych(item.text) && !looksGenericAffirmation(item.text)
  );
  return {
    items: items.slice(0, 3),
    sourceSig: awarenessV3SourceSig(ctx),
  };
}

function evaluateAwarenessV3Quality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeAwarenessV3(result);
  const source = userSourceBlob(ctx);
  const aiOnly = [ctx.bodyMindInsight, ctx.bodyMindSupport, ctx.coreQuote, ...(Array.isArray(ctx.thinkQuestions) ? ctx.thinkQuestions.map((item) => item && (item.text || item)) : [])]
    .filter(Boolean)
    .join("\n");
  const issues = [];
  if (data.items.length < 3) issues.push("missing-items");
  const texts = data.items.map((item) => item.text);
  texts.forEach((text, index) => {
    if (compactChars(text) > 70) issues.push(`a${index + 1}-too-long`);
    if (looksOverPsych(text)) issues.push(`a${index + 1}-overpsych`);
    if (looksGenericAffirmation(text)) issues.push(`a${index + 1}-generic`);
    if (looksSecondPerson(text)) issues.push(`a${index + 1}-second-person`);
  });
  if (looksSemanticDuplicate(texts[0], texts[1]) || looksSemanticDuplicate(texts[1], texts[2]) || looksSemanticDuplicate(texts[0], texts[2])) {
    issues.push("duplicate-items");
  }
  if (looksProblemHuntingPositive(source, texts.join(""))) issues.push("positive-problem-hunt");
  if (options && options.forbid && options.forbid.test(texts.join(""))) issues.push("unsupported");
  const copied = texts.filter((text) => looksRestate(aiOnly, text) && !looksRestate(source, text)).length;
  if (copied >= 2) issues.push("ai-hypothesis-as-truth");
  return { ok: !issues.length, issues, items: data.items };
}

function awarenessV3UserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const questions = Array.isArray(ctx.thinkQuestions || ctx.questions) ? ctx.thinkQuestions || ctx.questions : [];
  return `請依今天 01～04 產出三個第一人稱覺察。不要訪談。不要行動。不要把 03／04 AI 假設寫成事實。

【01 今日感謝｜使用者原文】
${compactLine(ctx.thanksText || ctx.thanks, 240) || "未寫"}

【02 今日事件｜使用者原文】
${compactLine(ctx.event, 320) || "未寫"}

【02 心情】
${String(ctx.mood || "").trim() || "未選"}

【03 身心覺察原文｜使用者自己寫的，權重最高】
${compactLine(ctx.bodyMindText || ctx.bodyNote, 400) || "未寫"}

【03 模型假設｜hypothesis，不是事實】
覺察：${compactLine(ctx.bodyMindInsight, 200) || "無"}
引導：${compactLine(ctx.bodyMindSupport, 200) || "無"}

【04 今日核心金句｜AI 輸出，不是 user truth】
${compactLine(ctx.coreQuote || ctx.thinkCoreQuote, 200) || "無"}

【04 深度反思問題｜只是 prompt，不是使用者回答】
${questions.map((item, index) => `${index + 1}. ${compactLine(item && (item.text || item.question || item), 180)}`).filter((line) => line.length > 4).join("\n") || "無"}

若幸福／安心：不要硬找問題。
若 04 問題含 hypothesis：不可直接變成「我發現……」。
三句要不同層次。第一人稱。`;
}

function awarenessV3GenerationAllowed(options) {
  return Boolean(options && options.confirmed === true && options.auto !== true);
}

function mergeAwarenessV3(older, newer) {
  const a = normalizeAwarenessV3(older);
  const b = normalizeAwarenessV3(newer);
  if (!hasAwarenessV3Result(b)) return hasAwarenessV3Result(a) ? a : b;
  if (!hasAwarenessV3Result(a)) return b;
  const stamp = (value) => {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  };
  if (stamp(b.generatedAt) >= stamp(a.generatedAt) || (b.sourceSig && b.sourceSig !== a.sourceSig)) {
    return {
      ...b,
      selectedIds: b.selectedIds.length ? b.selectedIds : a.sourceSig === b.sourceSig ? a.selectedIds : [],
    };
  }
  return {
    ...a,
    selectedIds: b.selectedIds.length ? b.selectedIds : a.selectedIds,
  };
}

module.exports = {
  AWARENESS_V3_VARIANT,
  AWARENESS_V3_SYSTEM,
  isAwarenessV3Request,
  emptyAwarenessV3,
  normalizeAwarenessV3Items,
  normalizeAwarenessV3,
  hasAwarenessV3Result,
  selectedAwarenessV3Texts,
  awarenessV3SourceSig,
  awarenessV3Ready,
  awarenessV3SourceStale,
  normalizeAwarenessV3Result,
  evaluateAwarenessV3Quality,
  awarenessV3UserPrompt,
  awarenessV3GenerationAllowed,
  mergeAwarenessV3,
  looksOverPsych,
  looksGenericAffirmation,
  looksSemanticDuplicate,
};
