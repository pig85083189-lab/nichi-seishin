const BODY_MIND_SYSTEM = `你是「進行式 ING」的身心覺察整理者。使用者剛寫下今天特別有感覺的一個瞬間。

03 不是問卷，也不是身體症狀分析。
工作是：從這個瞬間，幫助她一眼看見今天最值得注意的是什麼。

一次只產出兩層，不要再產生其他問題：
1. insight（覺察）
2. support（引導）

【insight｜覺察】
ONE CORE INSIGHT ONLY.
1～2 個短句。目標約 25～55 個中文字。不要超過 2 句。
一眼就知道今天最值得注意的是什麼。
不是摘要，不是長篇分析。
不要一次講情緒＋需求＋界線＋模式＋童年＋下一步。只選一個核心。
不是：重述原話、情緒摘要、心靈雞湯、心理診斷、擅自推測童年／創傷／依附、擅自做醫療或生理因果判斷。

好例子：
「真正讓你不舒服的，可能不只是環境本身，而是生活的選擇不完全在自己手上。」
evidence 不夠時：
「這個瞬間之所以特別有感，也許碰到了你很在意的一件事；真正是什麼，可以先不用急著定義。」
禁止：「你今天因為媽媽說了這句話，所以感到難過。」

evidence 不足時必須用：可能、也許、值得留意。
不能把 hypothesis 寫成事實。

【support｜引導】
1～2 個短句。目標約 30～70 個中文字。不要超過 2 句。
只帶她往下一點點看。不是長篇分析、checklist、解決方案、04 深度反思、06 action。
不要搶 06。禁止：晚上幾點傳訊息、寫下三件事、跟對方說某一句話。
禁止：你已經很棒了、相信一切都是最好的安排、明天會更好、好好愛自己。

好例子：
「先分開看看：哪些真的無法改變，哪些只是現在還沒有重新選擇。」

【正向／幸福／安心】
不要找問題。短、準。
覺察：「讓你感到幸福的，可能不是做了什麼特別的事，而是你們相處時很放鬆、很有回應。」
引導：「這種讓你自然做自己的時刻，本身就很值得記住。」

【沒什麼特別感覺】
不要硬分析。今天沒有特別強烈的感受，本身也是一種狀態。

【純身體】
健身後痠痛、感冒、沒睡：可以就是身體狀態。不要寫「肌肉受到有效刺激」，不要心理化。
覺察：「今天最明顯的是身體真的累了，暫時不需要替它加上更深的解釋。」
引導：「先把這個身體訊號記下來就好。」

禁止再問問題。不要輸出 question。

只輸出 JSON：
{
  "insight": "...",
  "support": "..."
}
繁體中文`;

function compactLine(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const limit = Number(max) || 400;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function emptyBodyMind() {
  return { text: "", insight: "", support: "", generatedAt: "", sig: "" };
}

function normalizeBodyMind(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    text: String(src.text || src.note || src.bodyNote || "").replace(/\s+/g, " ").trim(),
    insight: String(src.insight || "").replace(/\s+/g, " ").trim(),
    support: String(src.support || "").replace(/\s+/g, " ").trim(),
    generatedAt: String(src.generatedAt || "").trim(),
    sig: String(src.sig || "").trim(),
    internalDebug: src.internalDebug && src.internalDebug.model
      ? { provider: String(src.internalDebug.provider || ""), model: String(src.internalDebug.model || "") }
      : null,
  };
}

function hasMeaningfulBodyMind(value) {
  const data = normalizeBodyMind(value);
  return Boolean(data.text || data.insight || data.support);
}

function hasBodyMindResult(value) {
  const data = normalizeBodyMind(value);
  return Boolean(data.insight && data.support);
}

function bodyMindTextReady(value) {
  const text = typeof value === "string" ? value : normalizeBodyMind(value).text;
  const compact = String(text || "").replace(/\s+/g, "").trim();
  return compact.length >= 6;
}

function looksEmptyBodyMindInput(text) {
  const raw = String(text || "").replace(/\s+/g, "").trim();
  if (!raw) return true;
  return /沒有?(什麼)?特別|沒什麼感覺|普通|還好|沒有特別的感覺|沒感覺/.test(raw) && raw.length < 18;
}

function looksSoupBodyMind(text) {
  return /每一個感受都值得|也是成長的一部分|記得相信自己|好好愛自己|相信一切都是最好|明天會更好|你已經很棒了/.test(
    String(text || "")
  );
}

function looksOverPsych(text) {
  return /你害怕被拋棄|你缺乏安全感|你一直渴望被認同|這是你的童年創傷|童年創傷|不安全感|內在小孩|依附風格/.test(
    String(text || "")
  );
}

function looksMedicalCause(text) {
  return /荷爾蒙|自律神經|血糖|這是憂鬱症|這是焦慮症|生理因果|醫學上|疾病造成/.test(String(text || ""));
}

function looksChecklistSupport(text) {
  return /晚上\s*\d|寫下三件|傳訊息|跟對方說[「『]|步驟[一二三123]|^\s*[1１][\.．、]/.test(String(text || ""));
}

function looksQuestionOutput(text) {
  return /[？?]/.test(String(text || ""));
}

function closeTextKey(text) {
  return String(text || "")
    .replace(/[，。！？、；：:\s「」『』（）()…·\-—～~]/g, "")
    .trim();
}

function looksRestate(userText, insight) {
  const a = closeTextKey(userText);
  const b = closeTextKey(insight);
  if (!a || !b) return false;
  if (a.length >= 8 && b.includes(a)) return true;
  if (b.length >= 8 && a.includes(b) && b.length / a.length > 0.72) return true;
  const grams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size < 5 || gb.size < 5) return false;
  let inter = 0;
  ga.forEach((gram) => {
    if (gb.has(gram)) inter += 1;
  });
  return inter / Math.min(ga.size, gb.size) >= 0.78;
}

function looksProblemHunting(userText, insight) {
  const source = String(userText || "");
  const positive = /幸福|很開心|一直笑|很舒服|很安心|很放鬆|被陪伴/.test(source);
  if (!positive) return false;
  return /問題是|其實不快樂|陰影|真正的焦慮|你其實在怕/.test(String(insight || ""));
}

function compactBodyMindChars(text) {
  return String(text || "").replace(/\s+/g, "").trim().length;
}

function countBodyMindSentences(text) {
  return String(text || "")
    .split(/[。！？!?\n]+/)
    .map((part) => part.replace(/\s+/g, "").trim())
    .filter(Boolean).length;
}

function looksLongBodyMind(text, maxChars) {
  const compact = compactBodyMindChars(text);
  return compact > (Number(maxChars) || 80) || countBodyMindSentences(text) > 2;
}

function looksStackedInsight(text) {
  return /同時你可能|因此內心|也希望被理解，同時|情緒.+需求.+界線/.test(String(text || ""));
}

function bodyMindSourceStale(mind, currentText) {
  const data = normalizeBodyMind(mind);
  if (!hasBodyMindResult(data)) return false;
  const current = String(currentText || "").replace(/\s+/g, " ").trim();
  const source = String(data.sig ? String(data.sig).split("\n")[0] : data.text || "").replace(/\s+/g, " ").trim();
  return Boolean(current) && current !== source;
}

function stripQuestionSentences(text) {
  return String(text || "")
    .replace(/[^。！？\n]*[？?][」』]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBodyMindInsight(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let insight = stripQuestionSentences(String(src.insight || src.line || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, ""));
  let support = stripQuestionSentences(String(src.support || src.note || "").replace(/\s+/g, " ").trim());
  if (looksSoupBodyMind(insight) || looksOverPsych(insight) || looksMedicalCause(insight)) insight = "";
  if (looksSoupBodyMind(support) || looksChecklistSupport(support)) support = "";
  return { insight, support };
}

function evaluateBodyMindQuality(result, options) {
  const userText = String((options && (options.text || options.userText)) || "").trim();
  const insight = String((result && result.insight) || "").trim();
  const support = String((result && result.support) || "").trim();
  const blob = `${insight}${support}`;
  const issues = [];
  if (!insight) issues.push("missing-insight");
  if (!support) issues.push("missing-support");
  if (looksRestate(userText, insight)) issues.push("restate");
  if (looksSoupBodyMind(blob)) issues.push("soup");
  if (looksOverPsych(blob) && !(options && options.allowPsych)) issues.push("overpsych");
  if (looksMedicalCause(blob)) issues.push("medical");
  if (looksChecklistSupport(support)) issues.push("support-is-checklist");
  if (looksQuestionOutput(blob)) issues.push("asked-question");
  if (looksProblemHunting(userText, insight)) issues.push("positive-problem-hunt");
  if (looksStackedInsight(insight)) issues.push("stacked-insight");
  if (looksLongBodyMind(insight, 80)) issues.push("insight-too-long");
  if (looksLongBodyMind(support, 95)) issues.push("support-too-long");
  if (options && options.forbid && options.forbid.test(blob)) issues.push("unsupported");
  return { ok: !issues.length, issues, insight, support };
}

function bodyMindUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const text = compactLine(ctx.bodyMindText || ctx.text || (body && body.text), 400);
  return `請依使用者原文產出 insight（覺察）＋ support（引導）。
覺察：1～2 短句，約 25～55 字，只留一個核心。
引導：1～2 短句，約 30～70 字，只帶下一步看一眼。
不要重述、不要摘要、不要長篇、不要診斷、不要再問問題、不要搶 06。

【使用者自己寫的｜權重最高】
${text || "（幾乎沒寫）"}

【今日事件】${compactLine(ctx.event, 220) || "未寫"}
【02 心情】${String(ctx.mood || "").trim() || "未選"}
【今日感謝】${compactLine(ctx.thanksText || ctx.thanks, 120) || "未寫"}

若原文幾乎沒有可停留的瞬間：不要硬生深度。
若明顯是運動／生病／睡眠不足：允許只談身體，不要心理化。
若是幸福／安心／舒服：不要找問題，短短寫出值得保留的條件。`;
}

function mergeBodyMind(older, newer) {
  if (!hasMeaningfulBodyMind(newer)) {
    return hasMeaningfulBodyMind(older) ? normalizeBodyMind(older) : emptyBodyMind();
  }
  if (!hasMeaningfulBodyMind(older)) return normalizeBodyMind(newer);
  const a = normalizeBodyMind(older);
  const b = normalizeBodyMind(newer);
  return {
    text: b.text || a.text,
    insight: b.insight || a.insight,
    support: b.support || a.support,
    generatedAt: b.generatedAt || a.generatedAt,
    sig: b.sig || a.sig,
    internalDebug: b.internalDebug || a.internalDebug,
  };
}

function bodyMindSignature(text, event, mood) {
  return [String(text || "").replace(/\s+/g, " ").trim(), String(event || "").trim(), String(mood || "").trim()].join("\n");
}

module.exports = {
  BODY_MIND_SYSTEM,
  emptyBodyMind,
  normalizeBodyMind,
  hasMeaningfulBodyMind,
  hasBodyMindResult,
  bodyMindTextReady,
  looksEmptyBodyMindInput,
  looksSoupBodyMind,
  looksOverPsych,
  looksMedicalCause,
  looksChecklistSupport,
  looksRestate,
  looksProblemHunting,
  compactBodyMindChars,
  countBodyMindSentences,
  looksLongBodyMind,
  looksStackedInsight,
  bodyMindSourceStale,
  evaluateBodyMindQuality,
  normalizeBodyMindInsight,
  bodyMindUserPrompt,
  mergeBodyMind,
  bodyMindSignature,
};
