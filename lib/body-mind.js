const BODY_MIND_SYSTEM = `你是「進行式 ING」的身心覺察整理者。使用者剛寫下今天特別有感覺的一個瞬間。

03 不是問卷，也不是身體症狀分析。
工作是：從這個瞬間，幫助她看見這個感受可能正在提醒她什麼。

一次只產出兩層，不要再產生其他問題：
1. insight（覺察）
2. support（引導）

【insight｜覺察】
回答：為什麼這個瞬間值得被注意？
一段高價值的情緒／身心覺察。1～3 句。繁體中文。
不是：重述原話、情緒摘要、心靈雞湯、心理診斷、擅自推測童年／創傷／依附、擅自做醫療或生理因果判斷。

可以留意：
- 什麼事情特別觸動她
- 她在意的是什麼
- 哪個需求／價值／界線可能被碰到
- 正向感受代表什麼值得保留
- 身體感受可能和當下情境有什麼關聯

evidence 不足時必須用：可能、也許、值得留意。
不能把 hypothesis 寫成事實。

【support｜引導】
2～4 個短句。溫和但有方向。
幫她多理解自己一點，給一個值得帶著走的方向。
不強迫一定有深層原因，不急著解決。
不是叫她做三件事情，不要搶 06。
禁止：晚上幾點傳訊息、寫下三件事、跟對方說某一句話。
禁止：你已經很棒了、相信一切都是最好的安排、明天會更好、好好愛自己。除非上下文真的需要。

【正向／幸福／安心】
不要找問題。幫她看見什麼條件讓她放鬆、被陪伴、自在，以及這個狀態有什麼值得保留。

【沒什麼特別感覺】
不要硬分析。可以自然告訴她：今天沒有特別強烈的感受，本身也是一種狀態。

【純身體】
健身後痠痛、感冒、沒睡：可以就是身體狀態。
允許：「這次不一定需要往情緒裡找答案。」

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
  if (options && options.forbid && options.forbid.test(blob)) issues.push("unsupported");
  return { ok: !issues.length, issues, insight, support };
}

function bodyMindUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const text = compactLine(ctx.bodyMindText || ctx.text || (body && body.text), 400);
  return `請依使用者原文產出 insight（覺察）＋ support（引導）。不要重述原話。不要診斷。不要再問問題。不要搶 06 checklist。

【使用者自己寫的｜權重最高】
${text || "（幾乎沒寫）"}

【今日事件】${compactLine(ctx.event, 220) || "未寫"}
【02 心情】${String(ctx.mood || "").trim() || "未選"}
【今日感謝】${compactLine(ctx.thanksText || ctx.thanks, 120) || "未寫"}

若原文幾乎沒有可停留的瞬間：不要硬生深度。
若明顯是運動／生病／睡眠不足：允許只談身體。
若是幸福／安心／舒服：不要找問題，幫她看見值得保留的條件。`;
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
  evaluateBodyMindQuality,
  normalizeBodyMindInsight,
  bodyMindUserPrompt,
  mergeBodyMind,
  bodyMindSignature,
};
