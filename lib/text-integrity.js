(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiTextIntegrity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COMPLETE_TEXT_RULE =
    "所有輸出欄位都必須是語意完整的句子。禁止輸出講到一半的句子。不得為了符合字數限制直接截斷句子。若內容過長，請重新濃縮成較短但完整的一句話。";

  const HANGING_CORE =
    /(的|在|是|把|讓|會|可以|因為|所以|如果|但是|而|與|和|或|當成了|變成了|開始了|當成|變成|開始|覺得|發現|代表|可能|正在|一直|一個|一種|還包括|還有|以及|不是|而是|包括|倒一杯|一杯[溫暖熱冷親])$/;

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

  function looksComplete(text, opts) {
    const raw = cleanText(text);
    if (!raw) return false;
    if (isCompleteSentence(raw, opts)) return true;
    if (!/[。！？!?]$/.test(raw) && isCompleteSentence(`${raw}。`, opts)) return true;
    const parts = splitSentences(raw);
    return parts.length > 0 && parts.every((item) => isCompleteSentence(item, opts));
  }

  function retainCompleteText(text, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const cleaned = cleanText(text);
    if (!cleaned) return "";
    if (looksComplete(cleaned, options)) {
      if (options.max && compactLen(cleaned) > options.max) {
        const picked = pickCompleteSentence(cleaned, options.max);
        return picked || cleaned;
      }
      return cleaned;
    }
    warnIncomplete(options.source || "retainCompleteText", options.field || "text", cleaned);
    return "";
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

  function looksLikeAnalystVoice(text) {
    const raw = cleanText(text);
    if (!raw) return false;
    return /^(你好像|你可能|也許你|你似乎|這代表|這可能代表|從你的回答可以看出|從今天的事件可以看出)/.test(raw);
  }

  function toInnerVoice(text) {
    let next = cleanText(text);
    if (!next) return "";
    next = next
      .replace(/^從你的回答可以看出[，,。]?/, "")
      .replace(/^從今天的事件可以看出[，,。]?/, "")
      .replace(/^這可能代表你其實/, "我其實")
      .replace(/^這可能代表你/, "我")
      .replace(/^這代表你/, "我")
      .replace(/^你似乎正在/, "我")
      .replace(/^你似乎/, "我")
      .replace(/^你好像/, "我")
      .replace(/^你可能不是/, "我不是")
      .replace(/^你可能/, "我")
      .replace(/^也許你/, "我")
      .replace(/^你今天好像/, "我")
      .replace(/^你今天可能/, "我")
      .replace(/^今天看起來你/, "我")
      .replace(/^你在找的/, "我在找的")
      .replace(/^你真正需要的/, "我真正需要的")
      .replace(/^你真正/, "我真正")
      .replace(/^你需要的/, "我需要的")
      .replace(/^你在意的/, "我在意的")
      .replace(/^你不是/, "我不是");
    if (/^你(?!們)/.test(next)) next = next.replace(/^你/, "我");
    return cleanText(next);
  }

  function warnIncomplete(source, field, text) {
    if (!isDevMode()) return;
    if (typeof console === "undefined" || typeof console.warn !== "function") return;
    console.warn("[text-integrity] incomplete sentence", { source, field, text });
  }

  function timeColonIndexes(text) {
    const indexes = new Set();
    const raw = String(text || "");
    const re = /(?:^|[^\d])((?:[01]?\d|2[0-3])[:：][0-5]\d)(?!\d)/g;
    let match;
    while ((match = re.exec(raw))) {
      const token = match[1];
      const tokenStart = match.index + match[0].length - token.length;
      const colonAt = token.search(/[:：]/);
      if (colonAt >= 0) indexes.add(tokenStart + colonAt);
    }
    return indexes;
  }

  function isSafeTitleDetailSplit(text, idx) {
    const raw = String(text || "");
    if (idx <= 0 || idx >= raw.length - 1) return false;
    const left = raw.slice(0, idx).trim();
    const right = raw.slice(idx + 1).trim();
    if (!left || !right) return false;
    if (/\d$/.test(left)) return false;
    if (/^[0-5]\d(?:\D|$)/.test(right)) return false;
    if (!/[\u3400-\u9fffA-Za-z]/.test(left)) return false;
    return true;
  }

  function splitTitleDetail(text) {
    const raw = String(text || "").trim();
    if (!raw) return { title: "", detail: "" };
    const protectedColons = timeColonIndexes(raw);
    const trySplitAt = (idx) => {
      if (!isSafeTitleDetailSplit(raw, idx)) return null;
      return { title: raw.slice(0, idx).trim(), detail: raw.slice(idx + 1).trim() };
    };
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === "｜" || ch === "|" || ch === "—" || ch === "–") {
        const parts = trySplitAt(i);
        if (parts) return parts;
      }
    }
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch !== ":" && ch !== "：") continue;
      if (protectedColons.has(i)) continue;
      const parts = trySplitAt(i);
      if (parts) return parts;
    }
    return { title: raw, detail: "" };
  }

  function isClockHourToken(token) {
    const raw = String(token || "");
    if (!/^(?:[01]?\d|2[0-3])$/.test(raw)) return false;
    const hour = Number(raw);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23;
  }

  function isClockMinuteToken(token) {
    return /^[0-5]\d$/.test(String(token || ""));
  }

  function isLegacyTimeHourPrefix(prefix) {
    const text = String(prefix || "").trim();
    if (!text) return true;
    if (/第$/.test(text)) return false;
    return /(?:今[晚天早]|明[天早]|凌晨|傍晚|中午|下午|晚上|早上|上午|睡前|午夜|半夜)$/.test(text);
  }

  function repairLegacyTimeSplit(title, detail) {
    const heading = String(title || "").trim();
    const rest = String(detail || "").trim();
    const unchanged = { title: heading, detail: rest, source: heading, repaired: false };
    if (!heading || !rest) return unchanged;
    const hourMatch = heading.match(/^(.*?)(\d{1,2})$/);
    if (!hourMatch || !isClockHourToken(hourMatch[2])) return unchanged;
    if (!isLegacyTimeHourPrefix(hourMatch[1])) return unchanged;
    const minuteMatch = rest.match(/^([0-5]\d)([\s\S]*)$/);
    if (!minuteMatch || !isClockMinuteToken(minuteMatch[1])) return unchanged;
    const afterMinute = String(minuteMatch[2] || "").trim();
    if (/^[個件次題項步]/.test(afterMinute)) return unchanged;
    const source = `${heading}:${rest}`;
    return { title: heading, detail: rest, source, repaired: true };
  }

  function pickMatchingRawSource(sources, title, detail, repaired) {
    const list = (Array.isArray(sources) ? sources : []).map((item) => String(item || "").trim()).filter(Boolean);
    if (!list.length || !repaired || !repaired.repaired) return "";
    const recon = compactLen(repaired.source) ? String(repaired.source).replace(/\s+/g, "").replace(/[…⋯]+$/g, "") : "";
    if (!recon) return "";
    let best = "";
    let bestScore = 0;
    list.forEach((src) => {
      const compactSrc = String(src).replace(/\s+/g, "");
      if (!compactSrc) return;
      let score = 0;
      if (compactSrc === recon) score = 5;
      else if (compactSrc.includes(recon) || recon.includes(compactSrc.replace(/[…⋯]+$/g, ""))) score = 4;
      else if (/(?:[01]?\d|2[0-3])[:：][0-5]\d/.test(src) && recon.includes(compactSrc.replace(/[…⋯]+$/g, ""))) score = 3;
      if (score > bestScore || (score === bestScore && score > 0 && src.length > best.length)) {
        bestScore = score;
        best = src;
      }
    });
    return best;
  }

  function resolveTitleDetail(title, detail, rawSources) {
    const heading = String(title || "").trim();
    const rest = String(detail || "").trim();
    const repaired = repairLegacyTimeSplit(heading, rest);
    const matched = pickMatchingRawSource(rawSources, heading, rest, repaired);
    if (matched) {
      const parts = splitTitleDetail(matched);
      return { title: parts.title || matched, detail: parts.detail || "", fromRaw: true };
    }
    if (repaired.repaired) {
      const parts = splitTitleDetail(repaired.source);
      return { title: parts.title || repaired.source, detail: parts.detail || "", fromRaw: false };
    }
    if (!heading && rest) {
      const parts = splitTitleDetail(rest);
      return { title: parts.title, detail: parts.detail, fromRaw: false };
    }
    if (heading && (!rest || rest === heading)) {
      const parts = splitTitleDetail(heading);
      return { title: parts.title, detail: parts.detail || "", fromRaw: false };
    }
    return { title: heading, detail: rest, fromRaw: false };
  }

  return {
    COMPLETE_TEXT_RULE,
    compactLen,
    cleanText,
    isCompleteSentence,
    looksComplete,
    hasCompleteThought,
    splitSentences,
    pickCompleteSentence,
    retainCompleteText,
    finalizeGeneratedQuestion,
    looksLikeAnalystVoice,
    toInnerVoice,
    warnIncomplete,
    splitTitleDetail,
    timeColonIndexes,
    repairLegacyTimeSplit,
    resolveTitleDetail,
  };
});
