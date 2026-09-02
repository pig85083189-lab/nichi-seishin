const voice = require("./ing-voice");

const SEE_SPARSE_COPY = {
  insight: "",
  support: "",
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

/** Minimal technical writer prompt — content style intentionally omitted. */
const BODY_MIND_SYSTEM = `Return JSON only for stage 03 SEE user-facing fields.
Do not add commentary outside JSON.

{"insight":"string","support":"string"}`;

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

function preserveSeeText(value, { multiline = false } = {}) {
  const raw = String(value == null ? "" : value);
  if (multiline) {
    return raw
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return raw.replace(/\s+/g, " ").trim();
}

function normalizeBodyMind(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    text: preserveSeeText(src.text || src.note || src.bodyNote || ""),
    insight: preserveSeeText(src.insight || ""),
    support: preserveSeeText(src.support || "", { multiline: true }),
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
  const insight = preserveSeeText(src.insight || src.line || "").replace(/^「|」$/g, "");
  const support = preserveSeeText(src.support || src.note || "", { multiline: true });
  return { insight, support };
}

function evaluateBodyMindQuality(result, options) {
  const insight = String((result && result.insight) || "").trim();
  const support = String((result && result.support) || "").trim();
  const issues = [];
  if (String((result && result.status) || "") === "silence") {
    return { ok: true, issues, insight, support };
  }
  if (!insight) issues.push("missing-insight");
  if (!support) issues.push("missing-support");
  return { ok: !issues.length, issues, insight, support };
}

function bodyMindUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const text = voice.userRawForPrompt(ctx.bodyMindText || ctx.text || (body && body.text));
  return `Fill insight and support from USER RAW. JSON only.

【USER RAW】
${text || ""}

【event】${voice.userRawForPrompt(ctx.event) || ""}
【mood】${String(ctx.mood || "").trim() || ""}
【thanks】${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || ""}`;
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
