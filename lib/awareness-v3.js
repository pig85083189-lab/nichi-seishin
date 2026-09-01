const voice = require("./ing-voice");
const valueGate = require("./insight-value-gate");
const insightUnderstand = require("./insight-understand");

const AWARENESS_V3_VARIANT = "awareness-v3";

const AWARENESS_V3_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

${voice.FULL_INPUT_READ_BLOCK}

${voice.VALUE_ENGINE_BLOCK}

你是「進行式 ING」的覺察整理者。

05 不是深度思考，不是訪談，不是診斷。
04 已經做過深度思考。05 只做一件事：
整理出 2～3 個「我可能真正看見了自己什麼」，讓使用者自己勾選認領。
SO WHAT：如果她看完只會覺得「對啊我自己就知道」，刪掉。
不要把 04 改成第一人稱就算完成。
寧願 2 個真的能帶走的看見，不要湊第 3 句空話。

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

【2～3 個覺察】
要有不同資訊價值，不是同一件事換三種說法。
可能包含：感受／在意、模式／習慣、價值／界線／選擇。
依今天內容決定，不要硬套模板。
05 沒有 question。每個 item：title + 第一人稱 text。
title =「我要覺察什麼」，有觀點，不是分類。
text = 第一人稱完整看見。

【長度】
title 約 4～14 個中文字。
text 1 句為主，約 20～55 個中文字。必要時最多 2 個短句。
不要長篇。使用者要一眼能判斷：這個有沒有說中我？

【語氣】
第一人稱可認領，而且必須像真人會說的話。
她應該覺得：如果這是我今天真的看見自己的地方，我會願意勾選。
「我發現，當有人肯定我正在做的事情時，我會更相信自己真的走對了。」
「我發現，我有時候會希望自己的心意真的有被對方放在心上。」
不要：「我發現自己的方向感部分建立於外部視角所提供的確認。」
不要：「我發現自己存在被記憶與被看見的需求。」
不要新開一個心理分析。不要給 action。不要兩句同一意思。
2～3 個 item 應該是不同、但今天真的有證據的「我看見」。

【正向／幸福】
不要硬找問題。positive awareness 也有價值。

【不要搶 03／04／06】
不要再做身心假設。不要再問深度反思。不要給行動 checklist。

只輸出 JSON。繁體中文。
{
  "items": [
    { "id": "a1", "title": "", "text": "" },
    { "id": "a2", "title": "", "text": "" },
    { "id": "a3", "title": "", "text": "" }
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

const AWARENESS_V3_CUE_VARIANT = "awareness-v3-cue";

const AWARENESS_V3_CUE_SYSTEM = `你是「進行式 ING」的自我觀察提示者。

使用者已經親自勾選、確認了今天的覺察。
你只做一件事：留下一句她之後還可以繼續觀察自己的提示。

這不是新的深度思考，不是 04 的第四題，不是心理分析，不是結論，不是行動建議，也不是 06。
不要 textarea、不要要求回答、不要出作業。

【最高權重】
使用者親自勾選確認的 awareness。
未勾選的覺察不是事實，你看不到它們，也不准發明它們。

【其次】
今天 01～03 使用者原文。
04 只是低權重 context，不要複製 04 的問題。

【只給 ONE cue】
勾了 2～3 個時：找最值得繼續觀察的一個交集，或挑資訊價值最高的一個。
不要把三句覺察硬塞進一句。

【語氣】
1～2 個短句。約 25～60 個中文字。
specific、gentle、open-ended、observable。
用：留意、觀察、分辨、看看、發現。
希望她覺得：下一次發生類似事情時，我會開始注意這件事。

【從理解走向觀察】
不要：「你需要學會肯定自己的價值。」
可以：「下一次你又很在意對方有沒有看見你的付出時，可以留意：你真正期待的是一句肯定，還是希望對方理解這份付出對你的意義？」

不要：「跟對方談談／寫下來／設定界線／明天試著／列出三件」。
那是 06。

【正向／幸福】
不要硬找問題。可以留意讓她特別像自己的小細節。

【evidence 不足】
不要發明沒寫過的動機。只給一個很輕、仍可觀察的角度。

只輸出 JSON。繁體中文。
{ "text": "" }`;

function isAwarenessV3CueRequest(body) {
  const variant = body?.variant || body?.context?.variant;
  return variant === AWARENESS_V3_CUE_VARIANT || body?.step === "observation-cue";
}

function isAwarenessV3Request(body) {
  if (isAwarenessV3CueRequest(body)) return false;
  return body?.variant === AWARENESS_V3_VARIANT || body?.context?.variant === AWARENESS_V3_VARIANT;
}

function emptyAwarenessV3() {
  return {
    variant: AWARENESS_V3_VARIANT,
    sourceSig: "",
    items: [],
    selectedIds: [],
    generatedAt: "",
    observationCue: null,
  };
}

function awarenessItemText(item) {
  if (typeof item === "string") return item.replace(/\s+/g, " ").trim();
  if (!item || typeof item !== "object") return "";
  return String(item.text || item.line || item.awareness || item.content || item.label || item.sentence || "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectAwarenessV3RawItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const layers = [raw, raw.data, raw.result, raw.payload].filter((item) => item && typeof item === "object");
  for (const layer of layers) {
    if (Array.isArray(layer)) return layer;
    const list = layer.items || layer.options || layer.awareness || layer.statements || layer.lines;
    if (Array.isArray(list) && list.length) return list;
  }
  const keyed = ["a1", "a2", "a3"]
    .map((id) => {
      const value = raw[id];
      const text = awarenessItemText(value);
      return text ? { id, text } : null;
    })
    .filter(Boolean);
  return keyed.length >= 2 ? keyed : [];
}

function normalizeAwarenessV3Items(raw, max) {
  const list = collectAwarenessV3RawItems(raw);
  const limit = Number(max);
  const cap = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 8) : 3;
  return list
    .map((item, index) => {
      const text = awarenessItemText(item);
      if (!text || text === "[object Object]") return null;
      const title = String((item && item.title) || "").replace(/\s+/g, " ").trim();
      const out = { id: String((item && item.id) || `a${index + 1}`), text };
      if (title) out.title = title;
      if (item && item.type) out.type = String(item.type || "").trim();
      if (item && item.maturity) out.maturity = String(item.maturity || "").trim();
      return out;
    })
    .filter(Boolean)
    .slice(0, cap);
}

function normalizeAwarenessV3(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const items = normalizeAwarenessV3Items(src.items || src.options || raw);
  const allowed = new Set(items.map((item) => item.id));
  const selectedIds = (Array.isArray(src.selectedIds) ? src.selectedIds : [])
    .map((id) => String(id || "").trim())
    .filter((id) => allowed.has(id));
  return {
    variant: AWARENESS_V3_VARIANT,
    growVariant: String(src.growVariant || "").trim(),
    status: String(src.status || "").trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    items,
    selectedIds,
    generatedAt: String(src.generatedAt || "").trim(),
    observationCue: normalizeObservationCue(src.observationCue),
    emptyCopy: src.emptyCopy && typeof src.emptyCopy === "object" ? src.emptyCopy : null,
  };
}

function normalizeObservationCue(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const text = String(src.text || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return {
    text,
    selectedSig: String(src.selectedSig || "").trim(),
    generatedAt: String(src.generatedAt || "").trim(),
  };
}

function observationSelectedSig(selectedIds, selectedTexts) {
  const ids = (Array.isArray(selectedIds) ? selectedIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice()
    .sort();
  const texts = (Array.isArray(selectedTexts) ? selectedTexts : [])
    .map((text) => String(text || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return `${ids.join(",")}\n${texts.join("|")}`;
}

function observationCueMatches(value) {
  const data = normalizeAwarenessV3(value);
  const cue = data.observationCue;
  if (!cue || !cue.text || !data.selectedIds.length) return false;
  return cue.selectedSig === observationSelectedSig(data.selectedIds, selectedAwarenessV3Texts(data));
}

function shouldShowPersonalizedObservationCue(value) {
  return normalizeAwarenessV3(value).selectedIds.length >= 1;
}

function hasAwarenessV3Result(value) {
  const data = normalizeAwarenessV3(value);
  if (data.growVariant === "grow-v1" || data.status === "grow" || data.status === "empty") {
    return Boolean(data.sourceSig);
  }
  return data.items.length >= valueGate.MIN_INSIGHT_ITEMS;
}

function selectedAwarenessV3Texts(value) {
  const data = normalizeAwarenessV3(value);
  const map = new Map(data.items.map((item) => [item.id, item.text]));
  return data.selectedIds.map((id) => map.get(id)).filter(Boolean);
}

function awarenessV3SourceSig(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const understand = insightUnderstand.normalizeUnderstand(data.understand || null);
  if (understand && understand.stage) {
    return [
      compactLine(data.thanksText || data.thanks, 240),
      compactLine(data.event, 240),
      String(data.mood || data.moodLabel || "").trim(),
      compactLine(data.bodyMindText || data.bodyNote, 400),
      understand.stage,
      compactLine(understand.answer, 240),
      compactLine(understand.answer2, 240),
      compactLine(understand.convergence || understand.focus, 240),
    ].join("\n");
  }
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
  const base = Boolean(
    compactChars(data.thanksText || data.thanks) >= 2 &&
      compactChars(data.event) >= 4 &&
      String(data.mood || "").trim() &&
      compactChars(data.bodyMindText || data.bodyNote) >= 6
  );
  if (!base) return false;
  const understand = insightUnderstand.normalizeUnderstand(data.understand || null);
  if (understand && understand.stage) return insightUnderstand.understandIsComplete(understand);
  return compactChars(data.coreQuote || data.thinkCoreQuote) >= 8;
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
  return /童年創傷|原生家庭|被拋棄|不安全感|討好型人格|依附模式|自我價值低|內在小孩|依附風格/.test(String(text || "")) || voice.looksAbstractJargon(text);
}

function looksGenericAffirmation(text) {
  const raw = String(text || "");
  if (/好好愛自己|你已經很棒|一切都會好|明天會更好/.test(raw)) return true;
  return voice.looksBareTrustYourself(raw);
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
  const gated = gateAwarenessV3Result(raw, ctx);
  return {
    items: gated.items,
    sourceSig: gated.sourceSig,
  };
}

function gateAwarenessV3Result(raw, ctx) {
  const items = normalizeAwarenessV3Items(raw, 8).filter(
    (item) => item.text && !looksOverPsych(item.text) && !looksGenericAffirmation(item.text)
  );
  const gated = valueGate.gateItems(items, ctx, "awareness");
  return {
    items: gated.kept,
    sourceSig: awarenessV3SourceSig(ctx),
    dropped: gated.dropped,
  };
}

function awarenessV3ValueGateRetryPrompt(dropped) {
  return valueGate.valueGateRetryPrompt(dropped, "awareness");
}

function evaluateAwarenessV3Quality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeAwarenessV3(result);
  const source = userSourceBlob(ctx);
  const aiOnly = [ctx.bodyMindInsight, ctx.bodyMindSupport, ctx.coreQuote, ...(Array.isArray(ctx.thinkQuestions) ? ctx.thinkQuestions.map((item) => item && (item.text || item)) : [])]
    .filter(Boolean)
    .join("\n");
  const issues = [];
  if (data.items.length < valueGate.MIN_INSIGHT_ITEMS) issues.push("missing-items");
  const texts = data.items.map((item) => item.text);
  texts.forEach((text, index) => {
    const item = data.items[index] || {};
    if (compactChars(text) > 90) issues.push(`a${index + 1}-too-long`);
    if (looksOverPsych(text)) issues.push(`a${index + 1}-overpsych`);
    if (looksGenericAffirmation(text)) issues.push(`a${index + 1}-generic`);
    if (voice.looksAbstractJargon(text)) issues.push(`a${index + 1}-jargon`);
    if (looksSecondPerson(text)) issues.push(`a${index + 1}-second-person`);
    if (voice.looksFillerPhrase(text)) issues.push(`a${index + 1}-filler`);
    if (valueGate.looksTautologyAwareness(text, source)) issues.push(`a${index + 1}-so-what`);
    if (options && options.requireTitle) {
      if (!item.title) issues.push(`a${index + 1}-missing-title`);
      else if (voice.looksCategoryTitle(item.title)) issues.push(`a${index + 1}-category-title`);
    } else if (item.title && voice.looksCategoryTitle(item.title)) {
      issues.push(`a${index + 1}-category-title`);
    }
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
  return `請依今天 01～04 產出 2～3 個第一人稱覺察。不要訪談。不要行動。不要把 03／04 AI 假設寫成事實。
完整讀完 USER RAW。省略號後面的句子也要讀。
每個 item：title（我要覺察什麼）＋ 第一人稱 text。白話。不要抽象詞。
看完不能只是「對啊我自己就知道」。不要把 04 改成第一人稱。寧願 2 句過關，不要湊第 3 句。

【01 今日感謝｜使用者原文】
${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}

【02 今日事件｜使用者原文】
${voice.userRawForPrompt(ctx.event) || "未寫"}

【02 心情】
${String(ctx.mood || "").trim() || "未選"}

【03 身心覺察原文｜使用者自己寫的，權重最高】
${voice.userRawForPrompt(ctx.bodyMindText || ctx.bodyNote) || "未寫"}

【03 模型假設｜hypothesis，不是事實】
覺察：${compactLine(ctx.bodyMindInsight, 200) || "無"}
引導：${compactLine(ctx.bodyMindSupport, 200) || "無"}

【04 今日核心金句｜AI 輸出，不是 user truth】
${compactLine(ctx.coreQuote || ctx.thinkCoreQuote, 200) || "無"}

【04 深度反思｜只是 prompt，不是使用者回答】
${questions.map((item, index) => `${index + 1}. ${compactLine(item && (item.title ? `${item.title} ${item.text || item.insight || item.question || item}` : item.text || item.question || item), 220)}`).filter((line) => line.length > 4).join("\n") || "無"}

若幸福／安心：不要硬找問題。
若 04 問題含 hypothesis：不可直接變成「我發現……」。
三句要不同層次。第一人稱。title 要有觀點，不要分類名。`;
}

function awarenessV3GenerationAllowed(options) {
  return Boolean(options && options.confirmed === true && options.auto !== true);
}

function thinkQuestionTexts(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const questions = Array.isArray(data.thinkQuestions || data.questions) ? data.thinkQuestions || data.questions : [];
  return questions.map((item) => String((item && (item.text || item.question || item)) || "").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function looksObservationAction(text) {
  return /跟對方談談|跟他談|跟她談|寫下來|設定界線|明天試著|列出三件|列出來|跟對方說|跟他說|跟她說|採取行動|去做一件/.test(String(text || ""));
}

function looksObservationAdvice(text) {
  return /你需要學會|你應該|你要學會|試著放下|好好愛自己|學會肯定|你必須|建議你|你需要去/.test(String(text || ""));
}

function looksObservationVoice(text) {
  return /留意|觀察|分辨|看看|發現|注意/.test(String(text || ""));
}

function looksSimilarToThinkQuestions(text, ctx) {
  return thinkQuestionTexts(ctx).some((question) => looksSemanticDuplicate(question, text) || looksRestate(question, text));
}

function gramOverlapRatio(left, right) {
  const a = closeTextKey(left);
  const b = closeTextKey(right);
  if (!a || !b || a.length < 8 || b.length < 8) return 0;
  const grams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size < 5 || gb.size < 5) return 0;
  let inter = 0;
  gb.forEach((gram) => {
    if (ga.has(gram)) inter += 1;
  });
  return inter / Math.min(ga.size, gb.size);
}

function looksUnselectedAsTruth(text, options) {
  const selected = Array.isArray(options && options.selected) ? options.selected : [];
  const unselected = Array.isArray(options && options.unselected) ? options.unselected : [];
  if (!unselected.length) return false;
  const selectedBlob = selected.join("\n");
  return unselected.some((item) => {
    const unsel = gramOverlapRatio(item, text);
    const sel = selected.length ? Math.max(...selected.map((line) => gramOverlapRatio(line, text))) : 0;
    if (unsel >= 0.52 && unsel > sel + 0.1) return true;
    return looksRestate(item, text) && !looksRestate(selectedBlob, text);
  });
}

function normalizeObservationCueResult(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    text: String(src.text || src.cue || src.observation || src.observationCue || "").replace(/\s+/g, " ").trim(),
  };
}

function evaluateObservationCueQuality(text, options) {
  const cue = String((text && typeof text === "object" ? text.text : text) || "").replace(/\s+/g, " ").trim();
  const ctx = (options && options.context) || options || {};
  const selected = Array.isArray(options && options.selected) ? options.selected : Array.isArray(ctx.selectedAwareness) ? ctx.selectedAwareness : [];
  const unselected = Array.isArray(options && options.unselected) ? options.unselected : Array.isArray(ctx.unselectedAwareness) ? ctx.unselectedAwareness : [];
  const source = userSourceBlob(ctx);
  const issues = [];
  if (!cue) issues.push("missing");
  const chars = compactChars(cue);
  if (cue && chars < 20) issues.push("too-short");
  if (chars > 70) issues.push("too-long");
  if (looksObservationAction(cue)) issues.push("action");
  if (looksObservationAdvice(cue) || looksGenericAffirmation(cue)) issues.push("advice");
  if (cue && !looksObservationVoice(cue)) issues.push("not-observation");
  if (looksSimilarToThinkQuestions(cue, ctx)) issues.push("similar-to-04");
  if (looksOverPsych(cue)) issues.push("overpsych");
  if (looksUnselectedAsTruth(cue, { selected, unselected })) issues.push("unselected-as-truth");
  if (looksProblemHuntingPositive(source, cue)) issues.push("positive-problem-hunt");
  if (options && options.forbid && options.forbid.test(cue)) issues.push("unsupported");
  const fatal = issues.some((issue) =>
    ["missing", "action", "advice", "similar-to-04", "overpsych", "unselected-as-truth"].includes(issue)
  );
  return { ok: !issues.length, accept: !fatal, issues, text: cue };
}

function awarenessV3CueUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const selected = Array.isArray(ctx.selectedAwareness) ? ctx.selectedAwareness : [];
  const questions = thinkQuestionTexts(ctx);
  return `請依使用者親自勾選確認的覺察，留下一句之後還可以觀察自己的提示。只要一句。不要行動。不要複製 04。

【使用者親自勾選確認的覺察｜最高權重，這才是事實】
${selected.map((item, index) => `${index + 1}. ${compactLine(item, 180)}`).filter((line) => line.length > 3).join("\n") || "尚未勾選"}

勾選數量：${selected.length}
若超過一句：只找一個最值得繼續觀察的交集，或挑最有資訊價值的一句。不要全塞進一句。

【01 今日感謝｜使用者原文】
${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}

【02 今日事件｜使用者原文】
${voice.userRawForPrompt(ctx.event) || "未寫"}

【02 心情】
${String(ctx.mood || "").trim() || "未選"}

【03 身心覺察原文｜使用者自己寫的】
${voice.userRawForPrompt(ctx.bodyMindText || ctx.bodyNote) || "未寫"}

【04 深度反思問題｜低權重，禁止複製或改寫成同一題】
${questions.map((item, index) => `${index + 1}. ${compactLine(item, 180)}`).join("\n") || "無"}

未勾選的覺察不是事實。不要當成她已經承認。
不要要求回答。不要給 06 行動。
若幸福／安心：不要硬找問題。
只輸出 { "text": "" }。`;
}

function pickObservationCue(a, b, selectedIds, items) {
  const map = new Map((Array.isArray(items) ? items : []).map((item) => [item.id, item.text]));
  const texts = (Array.isArray(selectedIds) ? selectedIds : []).map((id) => map.get(id)).filter(Boolean);
  const sig = observationSelectedSig(selectedIds, texts);
  const stamp = (value) => {
    const parsed = Date.parse((value && value.generatedAt) || "");
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const ca = a && a.observationCue;
  const cb = b && b.observationCue;
  if (!selectedIds || !selectedIds.length) {
    return stamp(cb) >= stamp(ca) ? cb || ca || null : ca || cb || null;
  }
  if (cb && (!cb.selectedSig || cb.selectedSig === sig)) return cb;
  if (ca && (!ca.selectedSig || ca.selectedSig === sig)) return ca;
  return stamp(cb) >= stamp(ca) ? cb || ca || null : ca || cb || null;
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
  const preferB = stamp(b.generatedAt) >= stamp(a.generatedAt) || (b.sourceSig && b.sourceSig !== a.sourceSig);
  const winner = preferB ? b : a;
  const selectedIds = b.selectedIds.length ? b.selectedIds : preferB && a.sourceSig === b.sourceSig ? a.selectedIds : preferB ? [] : a.selectedIds;
  return {
    ...winner,
    selectedIds,
    observationCue: winner.growVariant === "grow-v1" || winner.status === "grow" || winner.status === "empty"
      ? winner.observationCue || null
      : pickObservationCue(a, b, selectedIds, winner.items),
  };
}

module.exports = {
  AWARENESS_V3_VARIANT,
  AWARENESS_V3_CUE_VARIANT,
  AWARENESS_V3_SYSTEM,
  AWARENESS_V3_CUE_SYSTEM,
  isAwarenessV3CueRequest,
  isAwarenessV3Request,
  emptyAwarenessV3,
  normalizeAwarenessV3Items,
  normalizeAwarenessV3,
  normalizeObservationCue,
  observationSelectedSig,
  observationCueMatches,
  shouldShowPersonalizedObservationCue,
  hasAwarenessV3Result,
  selectedAwarenessV3Texts,
  awarenessV3SourceSig,
  awarenessV3Ready,
  awarenessV3SourceStale,
  normalizeAwarenessV3Result,
  gateAwarenessV3Result,
  awarenessV3ValueGateRetryPrompt,
  normalizeObservationCueResult,
  evaluateAwarenessV3Quality,
  evaluateObservationCueQuality,
  awarenessV3UserPrompt,
  awarenessV3CueUserPrompt,
  awarenessV3GenerationAllowed,
  mergeAwarenessV3,
  looksOverPsych,
  looksGenericAffirmation,
  looksSemanticDuplicate,
  looksObservationAction,
  looksObservationAdvice,
};
