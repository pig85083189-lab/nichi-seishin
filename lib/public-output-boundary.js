"use strict";

/**
 * Deterministic PUBLIC OUTPUT BOUNDARY for user-facing AI strings.
 * Serialization/contract only — not a reasoning or quality gate.
 */

const LIMITS = Object.freeze({
  // Anti-dump ceilings (compact Chinese chars). Not content-depth targets.
  understandFocus: 96,
  understandWhy: 140,
  understandPastNote: 120,
  understandQuestion: 80,
  understandConvergence: 120,
  seeInsight: 140,
  seeSupport: 240,
  growTitle: 32,
  growText: 120,
  actLeadIn: 80,
  actTitle: 40,
  actDetail: 120,
  actNoAction: 72,
});

/** Compact engine/prompt vocabulary — intentional, not an enormous blacklist. */
const ENGINE_MARK = new RegExp(
  [
    "USER\\s*RAW",
    "LOCKED(?:_KNOWN|_KNOWN_BY_USER)?",
    "KNOWN_BY_USER",
    "SYSTEM(?:\\s*PROMPT)?",
    "DEVELOPER",
    "PIPELINE",
    "SCHEMA",
    "REASONER",
    "\\bJUDGE\\b",
    "\\bGATE\\b",
    "thinkingCore",
    "possibilities",
    "stopReason",
    "whyWorthThinking",
    "sourceSig",
    "INTERPRETATION_ADDON",
    "SEE_CORE",
    "FACT_CO_OCCURRENCE",
    "內部思考",
    "內部推理",
    "內部引擎",
    "【CORE】",
    "【FOCUS】",
    "FOCUS\\s*LINE",
    "\\bSIMILARITY\\b",
    "\\bCONFIDENCE\\b",
    "\\bPIPELINE\\b",
    "\\bMODEL\\b",
    "\\bINTERNAL\\b",
    "candidate 製造",
    "這個連結是 candidate",
  ].join("|"),
  "i"
);

const PAST_CONNECTION_TYPES = new Set([
  "same-person",
  "same-situation",
  "same-tension",
  "same-value",
  "same-boundary",
  "same-choice",
  "prior-success",
  "other-relevant",
  "changed-response",
  "growth",
]);

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactChars(text) {
  return asText(text).replace(/\s+/g, "").length;
}

function looksInternalEngineText(text) {
  const blob = asText(text);
  if (!blob) return false;
  if (ENGINE_MARK.test(blob)) return true;
  if (/\{[\s\S]{0,40}"(stop|focus|possibilities|question2|convergence)"\s*:/.test(blob)) return true;
  if (/^\s*\{[\s\S]*"focusLine"\s*:/.test(blob)) return true;
  return false;
}

function stripEngineSentences(text) {
  const parts = asText(text)
    .split(/(?<=[。！？!?])/)
    .map(asText)
    .filter(Boolean);
  if (!parts.length) return asText(text);
  return asText(parts.filter((part) => !looksInternalEngineText(part)).join(""));
}

function splitSentences(text) {
  const raw = asText(text);
  if (!raw) return [];
  const out = [];
  let buf = "";
  let depth = 0;
  Array.from(raw).forEach((ch) => {
    if (ch === "「" || ch === "『") depth += 1;
    else if ((ch === "」" || ch === "』") && depth > 0) depth -= 1;
    buf += ch;
    if (depth === 0 && /[。！？!?]/.test(ch)) {
      const next = buf.trim();
      if (next) out.push(next);
      buf = "";
    }
  });
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function packCompleteSentences(text, maxChars) {
  const sentences = splitSentences(text);
  let out = "";
  for (const sentence of sentences) {
    if (!sentence || looksInternalEngineText(sentence)) continue;
    const next = asText(`${out}${sentence}`);
    if (compactChars(next) > maxChars) break;
    out = next;
  }
  return out;
}

function clipAtClauseBoundary(sentence, maxChars) {
  const raw = asText(sentence);
  if (!raw) return "";
  if (compactChars(raw) <= maxChars) return raw;
  const clauses = raw.split(/(?<=[，、；;：:])/).map(asText).filter(Boolean);
  let out = "";
  for (const clause of clauses) {
    const next = asText(`${out}${clause}`);
    if (compactChars(next) > maxChars) break;
    out = next;
  }
  out = asText(out.replace(/[，、；;：:]+$/g, ""));
  if (out && compactChars(out) >= Math.min(16, maxChars) && !looksInternalEngineText(out)) {
    if (!/[。！？!?]$/.test(out) && /[。！？!?]/.test(raw)) return `${out}。`;
    return out;
  }
  return "";
}

function hardClipAtPunctuation(text, maxChars) {
  const raw = asText(text);
  if (!raw) return "";
  let buf = "";
  let lastGood = "";
  for (const ch of Array.from(raw)) {
    const next = buf + ch;
    if (compactChars(next) > maxChars) break;
    buf = next;
    if (/[。！？!?，、；;]/.test(ch)) lastGood = buf;
  }
  const cut = asText((lastGood || buf).replace(/[，、；;]+$/g, ""));
  if (!cut || looksInternalEngineText(cut)) return "";
  if (!/[。！？!?]$/.test(cut) && /[。！？!?]/.test(raw) && compactChars(`${cut}。`) <= maxChars) {
    return `${cut}。`;
  }
  return cut;
}

/**
 * Sentence-safe length protection.
 * 1) pack leading complete sentences under limit
 * 2) if first sentence alone exceeds: cut at Chinese clause boundary
 * 3) last resort: cut at last punctuation inside the window
 * Never append leftover internal/raw remainder. No model call. No rewrite.
 */
function clipToLimit(text, maxChars) {
  const cleaned = asText(text);
  if (!cleaned) return "";
  if (compactChars(cleaned) <= maxChars) return cleaned;

  const packed = packCompleteSentences(cleaned, maxChars);
  if (packed && !looksInternalEngineText(packed)) return packed;

  const sentences = splitSentences(cleaned);
  const first = sentences[0] || cleaned;
  const clause = clipAtClauseBoundary(first, maxChars);
  if (clause) return clause;

  return hardClipAtPunctuation(cleaned, maxChars);
}

function sanitizePublicConnectionType(value) {
  const type = asText(value);
  return PAST_CONNECTION_TYPES.has(type) ? type : "";
}

/**
 * Inspect + sanitize. Same public text rules as sanitizePublicText.
 * Returns structural status only — never the rejected source text beyond the safe public output.
 * @returns {{ text: string, status: "pass"|"clip"|"reject_marker"|"reject_length"|"empty" }}
 */
function inspectPublicText(text, opts = {}) {
  const maxChars = Number(opts.maxChars) > 0 ? Math.floor(opts.maxChars) : 96;
  const fallback = opts.fallback == null ? "" : String(opts.fallback);
  let cleaned = opts.multiline
    ? String(text == null ? "" : text)
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
    : asText(text);

  if (!cleaned) {
    const textOut = opts.allowEmpty === false ? fallback : "";
    return { text: textOut, status: "empty" };
  }

  if (looksInternalEngineText(cleaned)) {
    return { text: fallback, status: "reject_marker" };
  }

  const beforeStrip = cleaned;
  cleaned = stripEngineSentences(cleaned);
  if (!cleaned || looksInternalEngineText(cleaned)) {
    return { text: fallback, status: "reject_marker" };
  }
  // If strip removed engine sentences but left remainder, still treat as marker rejection only when nothing usable left (above).
  // Partial strip that leaves safe remainder continues as pass/clip.
  void beforeStrip;

  if (compactChars(cleaned) > maxChars) {
    const clipped = clipToLimit(cleaned, maxChars);
    if (!clipped || looksInternalEngineText(clipped)) {
      return { text: fallback, status: "reject_length" };
    }
    return { text: clipped, status: "clip" };
  }

  return { text: cleaned, status: "pass" };
}

/**
 * @param {string} text
 * @param {{ maxChars?: number, fallback?: string, multiline?: boolean, allowEmpty?: boolean }} [opts]
 * @returns {string}
 */
function sanitizePublicText(text, opts = {}) {
  return inspectPublicText(text, opts).text;
}

function inspectPublicQuestion(text, opts = {}) {
  const maxChars = Number(opts.maxChars) > 0 ? Math.floor(opts.maxChars) : LIMITS.understandQuestion;
  const inspected = inspectPublicText(text, { maxChars, fallback: "" });
  if (!inspected.text) return inspected;
  let cleaned = inspected.text;
  if (/[？?]\s*$/.test(cleaned)) return { text: cleaned, status: inspected.status };
  if (/[？?]/.test(asText(text)) && !/[。！]$/.test(cleaned)) {
    cleaned = `${cleaned.replace(/[。！]+$/, "")}？`;
  }
  return { text: cleaned, status: inspected.status };
}

function sanitizePublicQuestion(text, opts = {}) {
  return inspectPublicQuestion(text, opts).text;
}

module.exports = {
  LIMITS,
  PAST_CONNECTION_TYPES,
  asText,
  compactChars,
  looksInternalEngineText,
  stripEngineSentences,
  splitSentences,
  packCompleteSentences,
  clipAtClauseBoundary,
  clipToLimit,
  sanitizePublicConnectionType,
  inspectPublicText,
  inspectPublicQuestion,
  sanitizePublicText,
  sanitizePublicQuestion,
  ENGINE_MARK,
};
