const voice = require("./ing-voice");

const EXECUTION_V3_VARIANT = "execution-v3";

const EXECUTION_V3_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

${voice.FULL_INPUT_READ_BLOCK}

你是「進行式 ING」的下一步整理者。

06 不是深度思考，不是第二輪訪談。
04 已經負責深度思考。05 已經負責確認覺察。
06 只做一件事：所以我接下來真正可以做什麼？

下一步不是為了讓今天感覺好一點，
而是為了讓今天的覺察真的往前走一步。

【權重】
最高：05 user-confirmed awareness（selectedIds 對應的句子）
其次：使用者原文
再其次：03／04 AI、未被勾選的 05
未勾選的 05 不能當成 confirmed truth。
如果 05 一個都沒勾：用今天原文＋較保守 interpretation，不要假裝 AI 覺察已被確認。

【三個行動】
每個都必須回答 WHY THIS ACTION。不要突然派作業。
結構：basis／reason ＋ action title ＋ action detail。
title 約 8～18 個中文字，短、像下一步名稱。
detail 先寫為什麼這個行動從今天長出來，再寫具體怎麼做。可以 2～4 句。

例如不要只寫：「每天記錄三件做得好的事情。」
要寫成：
title：「留下一件自己認可的進步」
detail：「因為你今天發現，別人的肯定會讓你更確定自己的方向，所以這次可以先練習替自己留下證據。不用寫很多，今天先留下一件你自己也認可的進步。下一次不確定又出現時，先回來看看自己已經走過哪些路。」

行動必須從今天內容長出來、具體、小、可執行、不像人生指令。
ACTION 必須從通過價值閘門的 insight／使用者親自確認的覺察長出來，是今天 insight 的自然下一步，不是 generic self-help。
不要從「想睡所以累」「日常陪伴就是幸福」這種被淘汰的句子派作業。
例如洞察是「你已經開始能換角度理解阿嬤」：
下一步不是「多愛家人」，而是下次有情緒時，先多問自己一個角度。

三個要有不同作用，不要「說一次／再說一次／換個方式說」。
可以是：看清楚、試一個小改變、留下可持續的下一步。
依內容決定，不要硬套。

類型可依內容選：observation／validation／review／expression／boundary／decision criteria／low-risk experiment／concrete action／self-care only when relevant。

【重大決定】
涉及伴侶、離職、搬家、家庭、重大財務：
不要直接叫她分手、搬家、離職、切斷關係。
優先：釐清、觀察、設定條件、確認事實、表達、界線、低風險實驗、建立決策標準。

【禁止 generic】
好好溝通、多愛自己、相信自己、放下、冥想、感恩、早點睡、休息一下
除非今天 context 真正支持，而且具體到可執行。

不要只做無關痛癢的整理房間，除非它真的碰到 confirmed awareness。
不要叫她再做一次她今天已經做過的事。

【不要搶 03／04／05】
不要再解釋感受。不要再給深度問題。不要重寫覺察。

只輸出 JSON。繁體中文。
{
  "actions": [
    { "id": "e1", "title": "", "detail": "" },
    { "id": "e2", "title": "", "detail": "" },
    { "id": "e3", "title": "", "detail": "" }
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

function isExecutionV3Request(body) {
  return body?.variant === EXECUTION_V3_VARIANT || body?.context?.variant === EXECUTION_V3_VARIANT;
}

function emptyExecutionV3() {
  return {
    variant: EXECUTION_V3_VARIANT,
    sourceSig: "",
    actions: [],
    selectedIds: [],
    generatedAt: "",
  };
}

function normalizeExecutionV3Actions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => {
      const title = String((item && (item.title || item.text || item)) || "").replace(/\s+/g, " ").trim();
      const detail = voice.composeActionDetail(item);
      if (!title) return null;
      const out = { id: String((item && item.id) || `e${index + 1}`), title, detail, text: title };
      const actKind = String((item && (item.actKind || item.kind)) || "").trim();
      if (/^(ACTION_NOW|PRACTICE|OBSERVE)$/.test(actKind)) out.actKind = actKind;
      if (Array.isArray(item && item.sourceAwarenessIds)) {
        out.sourceAwarenessIds = item.sourceAwarenessIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 3);
      }
      return out;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeExecutionV3(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const actions = normalizeExecutionV3Actions(src.actions || src.options || src.items);
  const allowed = new Set(actions.map((item) => item.id));
  const selectedIds = (Array.isArray(src.selectedIds) ? src.selectedIds : [])
    .map((id) => String(id || "").trim())
    .filter((id) => allowed.has(id));
  return {
    variant: EXECUTION_V3_VARIANT,
    actVariant: String(src.actVariant || "").trim(),
    status: String(src.status || "").trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    actions,
    selectedIds,
    generatedAt: String(src.generatedAt || "").trim(),
    noActionCopy: src.noActionCopy && typeof src.noActionCopy === "object" ? src.noActionCopy : null,
  };
}

function isGrowActContext(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return data.growVariant === "grow-v1" || data.awarenessGrowVariant === "grow-v1" || data.awarenessStatus === "grow" || data.awarenessStatus === "empty";
}

function hasGrowActGroundedContext(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const understand = data.understand && typeof data.understand === "object" ? data.understand : {};
  const selected = Array.isArray(data.awarenessSelected) ? data.awarenessSelected : [];
  const selectedItems = Array.isArray(data.awarenessItems)
    ? data.awarenessItems.filter((item) => {
        const ids = Array.isArray(data.awarenessSelectedIds) ? data.awarenessSelectedIds.map(String) : [];
        return ids.includes(String(item && item.id));
      })
    : [];
  const chars =
    compactChars(data.thanksText || data.thanks) +
    compactChars(data.event) +
    compactChars(data.bodyMindText || data.bodyNote) +
    compactChars(data.userAnswer || data.understandAnswer) +
    compactChars(understand.answer) +
    compactChars(understand.answer2) +
    compactChars(understand.convergence) +
    selected.map((text) => compactChars(text)).reduce((sum, n) => sum + n, 0) +
    selectedItems.map((item) => compactChars(item && (item.text || item.title))).reduce((sum, n) => sum + n, 0);
  return chars >= 8;
}

function hasExecutionV3Result(value) {
  const data = normalizeExecutionV3(value);
  if (data.actVariant === "act-v1" || data.status === "actions" || data.status === "no-action") {
    return Boolean(data.sourceSig);
  }
  return data.actions.length >= 3;
}

function executionV3SourceSig(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const selected = Array.isArray(data.awarenessSelected) ? data.awarenessSelected : [];
  const selectedIds = Array.isArray(data.awarenessSelectedIds) ? data.awarenessSelectedIds : [];
  if (isGrowActContext(data)) {
    const understand = data.understand && typeof data.understand === "object" ? data.understand : {};
    return [
      "grow-v1",
      selectedIds.join(","),
      selected.map((text) => compactLine(text, 160)).join("|"),
      compactLine(understand.answer || data.understandAnswer, 160),
      compactLine(understand.answer2 || data.understandAnswer2, 160),
      compactLine(understand.convergence, 160),
      compactLine(data.thanksText || data.thanks, 160),
      compactLine(data.event, 160),
      String(data.mood || "").trim(),
      compactLine(data.bodyMindText || data.bodyNote, 160),
    ].join("\n");
  }
  const generated = Array.isArray(data.awarenessItems) ? data.awarenessItems : [];
  return [
    selectedIds.join(","),
    selected.map((text) => compactLine(text, 160)).join("|"),
    generated.map((item) => compactLine(item && (item.text || item), 80)).join("|"),
    compactLine(data.event, 160),
    compactLine(data.bodyMindText || data.bodyNote, 160),
    compactLine(data.coreQuote || data.thinkCoreQuote, 160),
  ].join("\n");
}

function executionV3Ready(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  if (isGrowActContext(data)) {
    const selectedIds = Array.isArray(data.awarenessSelectedIds) ? data.awarenessSelectedIds.filter(Boolean) : [];
    const selected = Array.isArray(data.awarenessSelected) ? data.awarenessSelected.filter((item) => String(item || "").trim()) : [];
    // 06 needs USER_CONFIRMED 05 + grounded context. Event is optional.
    if (!(selectedIds.length >= 1 || selected.length >= 1)) return false;
    return hasGrowActGroundedContext(data);
  }
  const base = Boolean(
    compactChars(data.thanksText || data.thanks) >= 2 &&
      compactChars(data.event) >= 4 &&
      String(data.mood || "").trim()
  );
  if (!base) return false;
  const generated = Array.isArray(data.awarenessItems) ? data.awarenessItems : [];
  return generated.length >= 3 || compactChars(data.bodyMindText || data.bodyNote) >= 6;
}

function executionV3SourceStale(guide, ctx) {
  const data = normalizeExecutionV3(guide);
  if (!hasExecutionV3Result(data) || !data.sourceSig) return false;
  return data.sourceSig !== executionV3SourceSig(ctx);
}

function closeTextKey(text) {
  return String(text || "")
    .replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "")
    .trim();
}

function looksRestate(source, text) {
  const a = closeTextKey(source);
  const b = closeTextKey(text);
  if (!a || !b || b.length < 6) return false;
  if (a.includes(b) || b.includes(a)) return a.length > 8 && b.length / Math.max(a.length, 1) > 0.62;
  return false;
}

function looksSemanticDuplicate(left, right) {
  const a = closeTextKey(left);
  const b = closeTextKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 8) return false;
  return long.includes(short) || looksRestate(left, right);
}

function looksGenericAction(text) {
  return /好好溝通|多愛自己|相信自己|放下吧|去冥想|練習感恩|早點睡|休息一下|好好休息/.test(String(text || ""));
}

function looksMajorDecision(text) {
  return /立刻分手|馬上搬家|直接離職|切斷關係|跟他分手|辭職不幹/.test(String(text || ""));
}

function looksUnselectedAsConfirmed(actionText, ctx) {
  const selected = (Array.isArray(ctx && ctx.awarenessSelected) ? ctx.awarenessSelected : []).join("\n");
  const generated = Array.isArray(ctx && ctx.awarenessItems) ? ctx.awarenessItems : [];
  const selectedIds = new Set(Array.isArray(ctx && ctx.awarenessSelectedIds) ? ctx.awarenessSelectedIds : []);
  if (!generated.length || !selectedIds.size) return false;
  return generated.some((item) => {
    const id = String(item && item.id || "");
    const text = String(item && item.text || "");
    if (!text || selectedIds.has(id)) return false;
    return looksRestate(text, actionText) && !looksRestate(selected, actionText);
  });
}

function normalizeExecutionV3Result(raw, ctx) {
  const src = raw && typeof raw === "object" ? raw : {};
  const actions = normalizeExecutionV3Actions(src.actions || src.options).filter(
    (item) => item.title && !looksGenericAction(`${item.title}${item.detail}`) && !looksMajorDecision(`${item.title}${item.detail}`)
  );
  return {
    actions: actions.slice(0, 3),
    sourceSig: executionV3SourceSig(ctx),
  };
}

function evaluateExecutionV3Quality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeExecutionV3(result);
  const issues = [];
  if (data.actions.length < 3) issues.push("missing-actions");
  const blobs = data.actions.map((item) => `${item.title}${item.detail}`);
  data.actions.forEach((item, index) => {
    if (compactChars(item.title) > 24) issues.push(`e${index + 1}-title-long`);
    if (!item.detail) issues.push(`e${index + 1}-no-detail`);
    if (looksGenericAction(`${item.title}${item.detail}`)) issues.push(`e${index + 1}-generic`);
    if (looksMajorDecision(`${item.title}${item.detail}`)) issues.push(`e${index + 1}-major-decision`);
    if (looksUnselectedAsConfirmed(`${item.title}${item.detail}`, ctx)) issues.push(`e${index + 1}-unselected-as-confirmed`);
    if (voice.looksAbstractJargon(`${item.title}${item.detail}`)) issues.push(`e${index + 1}-jargon`);
    if (options && options.requireWhy && !/因為你今天|你今天發現|你今天提到|所以這次/.test(item.detail)) {
      issues.push(`e${index + 1}-missing-why`);
    }
  });
  if (looksSemanticDuplicate(blobs[0], blobs[1]) || looksSemanticDuplicate(blobs[1], blobs[2]) || looksSemanticDuplicate(blobs[0], blobs[2])) {
    issues.push("duplicate-actions");
  }
  if (options && options.forbid && options.forbid.test(blobs.join(""))) issues.push("unsupported");
  const selected = (Array.isArray(ctx.awarenessSelected) ? ctx.awarenessSelected : []).join("\n");
  if (selected && data.actions.every((item) => !looksRestate(selected, `${item.title}${item.detail}`) && !/寫下|列出|分清|觀察|記下|條件|具體|一件|停下來/.test(`${item.title}${item.detail}`))) {
    issues.push("not-tied-to-confirmed");
  }
  return { ok: !issues.length, issues, actions: data.actions };
}

function executionV3UserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const confirmed = Array.isArray(ctx.awarenessSelected) ? ctx.awarenessSelected : [];
  const generated = Array.isArray(ctx.awarenessItems) ? ctx.awarenessItems : [];
  const selectedIds = new Set(Array.isArray(ctx.awarenessSelectedIds) ? ctx.awarenessSelectedIds : []);
  const unselected = generated.filter((item) => item && item.text && !selectedIds.has(item.id)).map((item) => item.text);
  return `請依今天 01～05 產出三個可執行下一步。不要第二輪深度思考。不要重大人生決策。
每個行動都要先說為什麼從今天長出來，再給具體、小、可執行的下一步。不要突然派作業。白話。
ACTION 必須從通過價值閘門的 insight／使用者親自確認的覺察長出來，是今天 insight 的自然下一步，不是 generic self-help。
不要從「想睡所以累」「日常陪伴就是幸福」這種被淘汰的句子派作業。
完整讀完 USER RAW。省略號後面的句子也要讀。

【01 今日感謝｜使用者原文】
${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}

【02 今日事件｜使用者原文】
${voice.userRawForPrompt(ctx.event) || "未寫"}

【02 心情】
${String(ctx.mood || "").trim() || "未選"}

【03 身心覺察原文】
${voice.userRawForPrompt(ctx.bodyMindText || ctx.bodyNote) || "未寫"}

【04 核心金句｜AI，不是 user truth】
${compactLine(ctx.coreQuote || ctx.thinkCoreQuote, 200) || "無"}

【05 使用者親自確認的覺察｜最高權重】
${confirmed.length ? confirmed.map((text, index) => `${index + 1}. ${compactLine(text, 160)}`).join("\n") : "（一個都沒勾。請用原文＋保守解釋，不要假裝 AI 覺察已被確認。）"}

【05 未勾選｜不可當成 confirmed】
${unselected.length ? unselected.map((text) => `- ${compactLine(text, 120)}`).join("\n") : "無"}

行動要碰到 confirmed awareness（若有）。
具體、做得到、三個作用不同。`;
}

function executionV3GenerationAllowed(options) {
  return Boolean(options && options.confirmed === true && options.auto !== true);
}

function executionV3ToChoiceOptions(value) {
  return normalizeExecutionV3(value).actions.map((item) => ({
    id: item.id,
    text: item.title,
    detail: item.detail,
  }));
}

module.exports = {
  EXECUTION_V3_VARIANT,
  EXECUTION_V3_SYSTEM,
  isExecutionV3Request,
  emptyExecutionV3,
  normalizeExecutionV3Actions,
  normalizeExecutionV3,
  hasExecutionV3Result,
  executionV3SourceSig,
  executionV3Ready,
  executionV3SourceStale,
  normalizeExecutionV3Result,
  evaluateExecutionV3Quality,
  executionV3UserPrompt,
  executionV3GenerationAllowed,
  executionV3ToChoiceOptions,
  looksGenericAction,
  looksMajorDecision,
  isGrowActContext,
};
