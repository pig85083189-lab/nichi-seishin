(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiTextIntegrity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COMPLETE_TEXT_RULE =
    "所有輸出欄位都必須是語意完整的句子。禁止輸出講到一半的句子。不得為了符合字數限制直接截斷句子。若內容過長，請重新濃縮成較短但完整的一句話。";

  const HANGING_CORE =
    /(的|在|是|把|讓|會|可以|因為|所以|如果|但是|而|與|和|或|當成了|變成了|開始了|當成|變成|開始|覺得|發現|代表|可能|正在|一直|一個|一種|還包括|還有|以及|不是|而是|包括)$/;

  const COLLOQUIAL_OK = /^(好了|知道了|謝謝你了|沒事了|夠了|可以了|了解了|收到了)$/;

  function compactLen(text) {
    return String(text || "").replace(/\s+/g, "").length;
  }

  function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function stripEndPunct(text) {
    return String(text || "").replace(/[\s。！？!?…⋯～~]+$/g, "").trim();
  }

  function quoteBalance(text) {
    const raw = String(text || "");
    const pairs = [
      ["「", "」"],
      ["『", "』"],
    ];
    return pairs.every(([open, close]) => {
      const opens = (raw.match(new RegExp(open, "g")) || []).length;
      const closes = (raw.match(new RegExp(close, "g")) || []).length;
      return opens === closes;
    });
  }

  function isCompleteSentence(text, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const raw = cleanText(text);
    if (!raw) return false;
    if (/[，、；：:\-—–…]$/.test(raw)) return false;
    if (!quoteBalance(raw)) return false;
    const core = stripEndPunct(raw);
    if (!core) return false;
    if (COLLOQUIAL_OK.test(core)) return true;
    if (HANGING_CORE.test(core)) return false;
    if (options.requireQuestion && !/[？?]$/.test(raw)) return false;
    return true;
  }

  function hasCompleteThought(text, opts) {
    return isCompleteSentence(text, opts);
  }

  function splitSentences(text) {
    const raw = cleanText(text);
    if (!raw) return [];
    const out = [];
    let buf = "";
    let depth = 0;
    Array.from(raw).forEach((ch) => {
      if (ch === "「" || ch === "『") depth += 1;
      else if ((ch === "」" || ch === "』") && depth > 0) depth -= 1;
      buf += ch;
      if (depth === 0 && /[。！？!?；]/.test(ch)) {
        const next = buf.trim();
        if (next) out.push(next);
        buf = "";
      }
    });
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function pickCompleteSentence(text, maxLength) {
    const max = Number(maxLength) > 0 ? Number(maxLength) : 30;
    const sentences = splitSentences(text);
    const complete = sentences.filter((item) => isCompleteSentence(item));
    if (!complete.length && isCompleteSentence(text)) {
      return compactLen(text) <= max ? cleanText(text) : "";
    }
    const fitting = complete.filter((item) => compactLen(item) <= max);
    if (fitting.length) {
      return fitting.reduce((best, item) => (compactLen(item) > compactLen(best) ? item : best));
    }
    return "";
  }

  function finalizeGeneratedQuestion(text, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    let next = cleanText(text);
    if (!next) return "";
    if (options.requireQuestion !== false && !/[？?]$/.test(next)) {
      next = `${next.replace(/[。.!！]+$/g, "")}？`;
    }
    if (!isCompleteSentence(next, { requireQuestion: options.requireQuestion !== false })) {
      warnIncomplete(options.source || "question", options.field || "question", next);
      return "";
    }
    if (options.max && compactLen(next) > options.max) {
      warnIncomplete(options.source || "question", `${options.field || "question"}:too-long`, next);
      return "";
    }
    return next;
  }

  function isDevMode() {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") return true;
      if (process.env.NICHI_TEXT_INTEGRITY === "1") return true;
    }
    if (typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(String(location.hostname || ""))) return true;
    if (typeof window !== "undefined" && window.__NICHI_HISTORY_DEBUG) return true;
    return false;
  }

  function warnIncomplete(source, field, text) {
    if (!isDevMode()) return;
    if (typeof console === "undefined" || typeof console.warn !== "function") return;
    console.warn("[text-integrity] incomplete sentence", { source, field, text });
  }

  return {
    COMPLETE_TEXT_RULE,
    compactLen,
    cleanText,
    isCompleteSentence,
    hasCompleteThought,
    splitSentences,
    pickCompleteSentence,
    finalizeGeneratedQuestion,
    warnIncomplete,
  };
});
