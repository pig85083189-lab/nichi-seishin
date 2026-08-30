const BODY_MIND_SYSTEM = `你是「進行式 ING」的身心覺察整理者。使用者剛寫下今天身體或心裡特別有感覺的一個瞬間。

一次只產出兩層：
1. insight：覺察一句話
2. support：給今天的你

【insight】
回答：為什麼今天這個舒服／不舒服的瞬間，值得注意？
1 句。繁體中文。約 18～40 個中文字。不要硬截斷句子。
不是金句、雞湯、鼓勵標語、原話摘要、情緒名稱重述。
必須有新的看見。

禁止：
每一個感受都值得被好好看見、今天的不舒服也是成長的一部分、記得相信自己、好好愛自己、你感到難過是因為……讓你難過。

【不要過度心理分析】
證據不夠時用：也許、可能、值得看看、這似乎碰到了、可以留意。
禁止直接宣判：你害怕被拋棄、你缺乏安全感、你一直渴望被認同、這是童年創傷。
除非使用者自己已經寫出足夠證據。

【舒服／幸福／安心也要能深入】
不要每次找問題。幫他看見「什麼其實對自己是好的」。

【純身體不要硬心理化】
健身後大腿痠、感冒、沒睡：可以就是身體狀態。
允許：「這次不一定需要往情緒裡找答案。」

【沒有特別感覺】
若原文幾乎沒有可停留的瞬間：insight 承認這次沒有需要再挖；support 短、不硬生深度。

【support｜給今天的你】
2～4 個短句。幫他理解這個感受，給溫和但有方向的看法。
不是 generic encouragement。
禁止：你已經很棒了、相信一切都是最好的安排、明天會更好、好好愛自己。除非上下文真的需要。

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
  return /你害怕被拋棄|你缺乏安全感|你一直渴望被認同|這是你的童年創傷|童年創傷/.test(String(text || ""));
}

function normalizeBodyMindInsight(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let insight = String(src.insight || src.line || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, "");
  let support = String(src.support || src.note || "").replace(/\s+/g, " ").trim();
  if (looksSoupBodyMind(insight) || looksOverPsych(insight)) insight = "";
  if (looksSoupBodyMind(support)) support = "";
  return { insight, support };
}

function bodyMindUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const text = compactLine(ctx.bodyMindText || ctx.text || (body && body.text), 400);
  return `請依使用者原文產出 insight 一句＋support 2～4 短句。不要重述原話。不要診斷。

【使用者自己寫的｜權重最高】
${text || "（幾乎沒寫）"}

【今日事件】${compactLine(ctx.event, 220) || "未寫"}
【02 心情】${String(ctx.mood || "").trim() || "未選"}
【今日感謝】${compactLine(ctx.thanksText || ctx.thanks, 120) || "未寫"}

若原文幾乎沒有可停留的瞬間：不要硬生深度。
若明顯是運動／生病／睡眠不足：允許只談身體。`;
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
  normalizeBodyMindInsight,
  bodyMindUserPrompt,
  mergeBodyMind,
  bodyMindSignature,
};
