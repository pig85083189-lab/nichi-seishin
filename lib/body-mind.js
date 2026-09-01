const voice = require("./ing-voice");

const SEE_SPARSE_COPY = {
  insight: "今天留下的內容還不多。",
  support: "若還想多寫一點，任何一件小事、一個感受、一個瞬間都可以。",
};

const SEE_SILENCE_COPY = SEE_SPARSE_COPY;

const SEE_TYPES = [
  "CONTRAST",
  "COMMON_THREAD",
  "ENERGY_SOURCE",
  "DRAIN_SOURCE",
  "UNNOTICED_NEED",
  "CHANGE",
  "UNRECOGNIZED_STRENGTH",
  "BETTER_NEXT_RESPONSE",
];

const BODY_MIND_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

${voice.FULL_INPUT_READ_BLOCK}

你只負責把已經通過的 03 SEE Core 寫成給使用者看的兩層中文。
03 是 SEE｜看見。核心問題：今天有什麼，是她自己還沒注意到，但值得她知道的？
看完整天的 USER RAW，不要只複述身心 textarea。
輸出必須和 Core 語意等價。不能新增意義。

ONE CORE INSIGHT ONLY.
insight：1～2 個短句。目標約 25～55 個中文字。必須是一句真正的觀察，不是類別標題。
support：2～4 個短句。合計約 40～110 個中文字。說明為什麼注意到、今天哪裡支持它、之後可以繼續留意什麼。
不要寫成 04 深度思考，不要寫成 06 行動教練。

不要搶 06。禁止：晚上幾點傳訊息、寫下三件事、跟對方說某一句話、明天請完成三個行動。
不要找問題。正向觀察可以保留。
禁止：創傷、依附、討好型、潛意識、自我價值——若只是假設，必須用「可能／也許／有沒有一種可能」標成假說，不可寫成定論。
允許探索性表述（有沒有一種可能、我會有點好奇），不要把有用的假說刪成空白。
禁止把假說寫成「真正的問題就是／這證明妳／妳一定是」。
禁止再對使用者做訪談式追問（你為什麼／你覺得呢）。
不要輸出單純的 checklist 行動。

只輸出 JSON：
{
  "insight": "...",
  "support": "..."
}
繁體中文`;

function emptyBodyMind() {
  return {
    text: "",
    insight: "",
    support: "",
    generatedAt: "",
    sig: "",
    status: "",
    seeType: "",
    evidence: [],
    confidence: "",
    internalDebug: null,
  };
}

function normalizeSeeType(value) {
  const type = String(value || "").trim().toUpperCase().replace(/[\s-]/g, "_");
  return SEE_TYPES.includes(type) ? type : "";
}

function normalizeSeeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return status === "silence" || status === "observation" ? status : "";
}

function normalizeSeeConfidence(value) {
  const confidence = String(value || "").trim().toLowerCase();
  return confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "";
}

function normalizeSeeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 6);
}

function normalizeBodyMind(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    text: String(src.text || src.note || src.bodyNote || "").replace(/\s+/g, " ").trim(),
    insight: String(src.insight || "").replace(/\s+/g, " ").trim(),
    support: String(src.support || "").replace(/\s+/g, " ").trim(),
    generatedAt: String(src.generatedAt || "").trim(),
    sig: String(src.sig || "").trim(),
    status: normalizeSeeStatus(src.status),
    seeType: normalizeSeeType(src.seeType),
    evidence: normalizeSeeEvidence(src.evidence),
    confidence: normalizeSeeConfidence(src.confidence),
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
  return (
    /你害怕被拋棄|你缺乏安全感|你一直渴望被認同|這是你的童年創傷|童年創傷|不安全感|內在小孩|依附風格|你正在經歷|情感需求之間的落差/.test(
      String(text || "")
    ) || voice.looksAbstractJargon(text)
  );
}

function looksMedicalCause(text) {
  return /荷爾蒙|自律神經|血糖|這是憂鬱症|這是焦慮症|生理因果|醫學上|疾病造成/.test(String(text || ""));
}

function looksChecklistSupport(text) {
  return /晚上\s*\d|寫下三件|去傳訊息|晚上.{0,12}傳訊息|跟對方說[「『]|步驟[一二三123]|^\s*[1１][\.．、]|明天請|請完成三個|三個行動/.test(
    String(text || "")
  );
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

function stripInterviewOnlyQuestions(text) {
  // Keep exploratory openings (有沒有一種可能 / 我會有點好奇).
  // Strip only interviewer-style prompts that put the work back on the user alone.
  return String(text || "")
    .split(/(?<=[。！？!?])/)
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => {
      if (/有沒有一種可能|我會有點好奇|也許可以再|不一定是這樣|這裡也許|值得妳感受/.test(part)) return true;
      return !/^(那)?([妳你])(為什麼|覺得呢|會不會覺得|是否應該)/.test(part);
    })
    .join("");
}

function normalizeBodyMindInsight(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let insight = stripInterviewOnlyQuestions(String(src.insight || src.line || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, ""));
  let support = stripInterviewOnlyQuestions(String(src.support || src.note || "").replace(/\s+/g, " ").trim());
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
  if (String((result && result.status) || "") === "silence") {
    if (!insight) issues.push("missing-insight");
    if (!support) issues.push("missing-support");
    return { ok: !issues.length, issues, insight, support };
  }
  if (!insight) issues.push("missing-insight");
  if (!support) issues.push("missing-support");
  if (looksRestate(userText, insight)) issues.push("restate");
  if (looksSoupBodyMind(blob)) issues.push("soup");
  if (looksOverPsych(blob) && !(options && options.allowPsych)) issues.push("overpsych");
  if (looksMedicalCause(blob)) issues.push("medical");
  if (looksChecklistSupport(support)) issues.push("support-is-checklist");
  if (looksQuestionOutput(blob)) issues.push("asked-question");
  if (looksProblemHunting(userText, insight)) issues.push("positive-problem-hunt");
  if (voice.looksPhysicalPsychologized(userText, insight)) issues.push("physical-psychologized");
  if (voice.looksAbstractJargon(blob)) issues.push("jargon");
  if (looksStackedInsight(insight)) issues.push("stacked-insight");
  if (looksLongBodyMind(insight, 80)) issues.push("insight-too-long");
  if (countBodyMindSentences(support) > 4 || compactBodyMindChars(support) > 120) issues.push("support-too-long");
  if (options && options.forbid && options.forbid.test(blob)) issues.push("unsupported");
  return { ok: !issues.length, issues, insight, support };
}

function bodyMindUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const text = voice.userRawForPrompt(ctx.bodyMindText || ctx.text || (body && body.text));
  return `請依今天的 USER RAW 產出 insight（觀察）＋ support（為什麼這樣看）。
03 是 SEE｜看見。問的是：今天有什麼，是她自己還沒注意到，但值得她知道的？
白話、貼近原話、一眼看懂、不超出證據。不要複述她已經寫出的結論。
完整讀完原文。省略號後面的句子也要讀。
觀察：1～2 短句，約 25～55 字，只留一個核心。
說明：1～2 短句，約 30～70 字。不要教訓、不要診斷、不要強迫正向、不要硬給行動。
不要重述、不要摘要、不要長篇、不要再問問題、不要搶 06。
不要找問題。正向觀察可以保留。0 個觀察時請讓呼叫端走沉默，不要硬生。
禁止抽象詞：內在判準、外部視角、情緒需求、心理機制、自我價值感。

【使用者自己寫的｜權重最高】
${text || "（幾乎沒寫）"}

【今日事件】${voice.userRawForPrompt(ctx.event) || "未寫"}
【02 心情】${String(ctx.mood || "").trim() || "未選"}
【今日感謝】${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}

若原文幾乎沒有可停留、或她已經看得很清楚：不要硬生深度。
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
    status: b.status || a.status,
    seeType: b.seeType || a.seeType,
    evidence: b.evidence.length ? b.evidence : a.evidence,
    confidence: b.confidence || a.confidence,
    internalDebug: b.internalDebug || a.internalDebug,
  };
}

function bodyMindSignature(text, event, mood) {
  return [String(text || "").replace(/\s+/g, " ").trim(), String(event || "").trim(), String(mood || "").trim()].join("\n");
}

function bodyMindGenerationAllowed(options) {
  return Boolean(options && options.confirmed === true && options.auto !== true);
}

function bodyMindLiveText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function bodyMindResponseMatches(requestText, currentText) {
  return bodyMindLiveText(requestText) === bodyMindLiveText(currentText);
}

module.exports = {
  SEE_SPARSE_COPY,
  BODY_MIND_SYSTEM,
  SEE_SILENCE_COPY,
  SEE_TYPES,
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
  looksQuestionOutput,
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
  bodyMindGenerationAllowed,
  bodyMindLiveText,
  bodyMindResponseMatches,
};
