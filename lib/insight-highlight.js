(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiInsightHighlight = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLORS = ["tea", "yellow", "sage", "pink"];
  const MIN_CHARS = 2;
  const MAX_CHARS = 18;
  const MAX_MARKS = 2;
  const SHORT_SOURCE_CHARS = 56;
  const COLOR_HINTS = [
    ["pink", ["看見自己的需要", "允許自己的感受", "自己的需要", "允許自己", "接納", "感受", "關係", "情緒"]],
    ["yellow", ["看事情的角度", "看見自己的模式", "真正介意", "原來", "發現", "看見自己", "理解", "覺察", "模式"]],
    ["sage", ["願意開始", "做出新的選擇", "新的選擇", "願意開始", "願意", "選擇", "行動", "前進", "靠近"]],
    ["tea", ["回到自己的節奏", "不需要急著證明", "適合自己的節奏", "自己的節奏", "不需要急", "節奏", "提醒"]],
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function compactLen(text) {
    return String(text || "").replace(/\s+/g, "").length;
  }

  function fieldHighlights(bag, field) {
    if (!bag) return [];
    if (Array.isArray(bag)) {
      return bag.filter((item) => !item || !item.field || item.field === field);
    }
    if (typeof bag === "object" && Array.isArray(bag[field])) return bag[field];
    return [];
  }

  function inferColor(text, level) {
    const source = String(text || "");
    for (let i = 0; i < COLOR_HINTS.length; i += 1) {
      const color = COLOR_HINTS[i][0];
      const keys = COLOR_HINTS[i][1];
      for (let k = 0; k < keys.length; k += 1) {
        if (source.includes(keys[k])) return color;
      }
    }
    return level === "strong" ? "tea" : "tea";
  }

  function normalizeColor(item) {
    const raw = String((item && item.color) || "")
      .trim()
      .toLowerCase();
    if (COLORS.includes(raw)) return raw;
    const alias = raw === "milk" || raw === "brown" ? "tea" : raw === "green" ? "sage" : "";
    if (COLORS.includes(alias)) return alias;
    return inferColor(item && item.text, item && item.level);
  }

  function locateNeedle(source, needle, hintStart) {
    const first = source.indexOf(needle);
    if (first < 0) return -1;
    const second = source.indexOf(needle, first + Math.max(1, needle.length));
    if (second < 0) return first;
    const start = Number(hintStart);
    if (Number.isFinite(start) && start >= 0 && source.slice(start, start + needle.length) === needle) {
      return start;
    }
    return -1;
  }

  function normalizeHighlights(highlights, text) {
    const source = String(text == null ? "" : text);
    if (!source || !Array.isArray(highlights) || !highlights.length) return [];
    const candidates = [];
    highlights.forEach((item, index) => {
      const needle = String(item && item.text != null ? item.text : item || "").trim();
      if (!needle) return;
      if (source.indexOf(needle) < 0) return;
      const n = compactLen(needle);
      if (n < MIN_CHARS || n > MAX_CHARS) return;
      const start = locateNeedle(source, needle, item && (item.start != null ? item.start : item.index));
      if (start < 0) return;
      candidates.push({
        text: needle,
        color: normalizeColor(typeof item === "object" ? item : { text: needle }),
        level: item && item.level === "strong" ? "strong" : "normal",
        start,
        end: start + needle.length,
        index,
      });
    });
    const maxMarks = compactLen(source) <= SHORT_SOURCE_CHARS ? 1 : MAX_MARKS;
    candidates.sort((left, right) => {
      const leftPrimary = left.level === "strong" ? 0 : 1;
      const rightPrimary = right.level === "strong" ? 0 : 1;
      if (leftPrimary !== rightPrimary) return leftPrimary - rightPrimary;
      return left.index - right.index;
    });
    const accepted = [];
    candidates.forEach((item) => {
      if (accepted.length >= maxMarks) return;
      if (accepted.some((prev) => item.start < prev.end && item.end > prev.start)) return;
      accepted.push(item);
    });
    return accepted.sort((left, right) => left.start - right.start || left.end - right.end);
  }

  function highlightClass(color) {
    const name = COLORS.includes(color) ? color : "tea";
    return `insight-highlight insight-highlight--${name}`;
  }

  function renderHighlightedText(text, highlights) {
    const source = String(text == null ? "" : text);
    const marks = normalizeHighlights(highlights, source);
    if (!marks.length) return escapeHtml(source);
    let html = "";
    let cursor = 0;
    marks.forEach((mark) => {
      if (mark.start > cursor) html += escapeHtml(source.slice(cursor, mark.start));
      html += `<span class="${highlightClass(mark.color)}">${escapeHtml(source.slice(mark.start, mark.end))}</span>`;
      cursor = mark.end;
    });
    if (cursor < source.length) html += escapeHtml(source.slice(cursor));
    return html;
  }

  function userHighlightClass(color) {
    const name = COLORS.includes(color) ? color : "tea";
    return `user-highlight user-highlight--${name}`;
  }

  function resolvePlainUserRange(source, mark) {
    const text = String(source == null ? "" : source);
    if (!mark || typeof mark !== "object") return null;
    const needle = String(mark.text == null ? "" : mark.text);
    const hintStart = Number(mark.start);
    const hintEnd = Number(mark.end);
    const color = COLORS.includes(mark.color) ? mark.color : "tea";
    const id = String(mark.id || "");
    if (needle && Number.isFinite(hintStart) && Number.isFinite(hintEnd) && hintEnd > hintStart && text.slice(hintStart, hintEnd) === needle) {
      return { start: Math.max(0, Math.floor(hintStart)), end: Math.max(0, Math.floor(hintEnd)), text: needle, color, id };
    }
    if (!needle) return null;
    const hits = [];
    let from = 0;
    while (from <= text.length) {
      const found = text.indexOf(needle, from);
      if (found < 0) break;
      hits.push(found);
      from = found + Math.max(1, needle.length);
    }
    if (!hits.length) return null;
    const start = Number.isFinite(hintStart)
      ? hits.reduce((best, pos) => (Math.abs(pos - hintStart) < Math.abs(best - hintStart) ? pos : best), hits[0])
      : hits[0];
    return { start, end: start + needle.length, text: needle, color, id };
  }

  function acceptUserRanges(source, userMarks) {
    const resolved = (Array.isArray(userMarks) ? userMarks : [])
      .map((item) => resolvePlainUserRange(source, item))
      .filter(Boolean)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    const accepted = [];
    resolved.forEach((item) => {
      if (accepted.some((prev) => item.start < prev.end && item.end > prev.start)) return;
      accepted.push(item);
    });
    return accepted;
  }

  function subtractIntervals(range, blockers) {
    let pieces = [{ start: range.start, end: range.end }];
    (Array.isArray(blockers) ? blockers : []).forEach((block) => {
      const next = [];
      pieces.forEach((piece) => {
        if (block.end <= piece.start || block.start >= piece.end) {
          next.push(piece);
          return;
        }
        if (block.start > piece.start) next.push({ start: piece.start, end: Math.min(block.start, piece.end) });
        if (block.end < piece.end) next.push({ start: Math.max(block.end, piece.start), end: piece.end });
      });
      pieces = next.filter((item) => item.end > item.start);
    });
    return pieces;
  }

  function renderCombinedHighlightedText(text, aiHighlights, userMarks) {
    const source = String(text == null ? "" : text);
    const users = acceptUserRanges(source, userMarks);
    if (!users.length) return renderHighlightedText(source, aiHighlights);
    const aiMarks = normalizeHighlights(aiHighlights, source);
    const pieces = users.map((item) => ({ kind: "user", start: item.start, end: item.end, color: item.color, id: item.id }));
    aiMarks.forEach((mark) => {
      subtractIntervals(mark, users).forEach((frag) => {
        pieces.push({ kind: "ai", start: frag.start, end: frag.end, color: mark.color });
      });
    });
    pieces.sort((left, right) => left.start - right.start || left.end - right.end || (left.kind === "user" ? -1 : 1));
    let html = "";
    let cursor = 0;
    pieces.forEach((piece) => {
      if (piece.start > cursor) html += escapeHtml(source.slice(cursor, piece.start));
      const inner = escapeHtml(source.slice(piece.start, piece.end));
      if (piece.kind === "user") {
        html += `<span class="${userHighlightClass(piece.color)}" data-mark-id="${escapeHtml(piece.id)}">${inner}</span>`;
      } else {
        html += `<span class="${highlightClass(piece.color)}">${inner}</span>`;
      }
      cursor = piece.end;
    });
    if (cursor < source.length) html += escapeHtml(source.slice(cursor));
    return html;
  }

  function plainTextFromHighlightedHtml(html) {
    return String(html || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  return {
    COLORS,
    escapeHtml,
    fieldHighlights,
    inferColor,
    normalizeColor,
    normalizeHighlights,
    renderHighlightedText,
    renderCombinedHighlightedText,
    resolvePlainUserRange,
    acceptUserRanges,
    plainTextFromHighlightedHtml,
  };
});
