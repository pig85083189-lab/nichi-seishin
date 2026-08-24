(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiInsightHighlight = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  function normalizeHighlights(highlights, text) {
    const source = String(text == null ? "" : text);
    if (!source || !Array.isArray(highlights) || !highlights.length) return [];
    const candidates = [];
    highlights.forEach((item, index) => {
      const needle = String(item && item.text != null ? item.text : item || "").trim();
      if (!needle) return;
      const n = compactLen(needle);
      if (n < 4 || n > 18) return;
      const start = source.indexOf(needle);
      if (start < 0) return;
      candidates.push({
        text: needle,
        level: item && item.level === "strong" ? "strong" : "normal",
        start,
        end: start + needle.length,
        index,
      });
    });
    candidates.sort((left, right) => {
      if (left.level !== right.level) return left.level === "strong" ? -1 : 1;
      return left.index - right.index;
    });
    const accepted = [];
    let strong = 0;
    let normal = 0;
    candidates.forEach((item) => {
      if (accepted.some((prev) => item.start < prev.end && item.end > prev.start)) return;
      if (item.level === "strong") {
        if (strong >= 1) return;
        strong += 1;
      } else {
        if (normal >= 2) return;
        normal += 1;
      }
      accepted.push(item);
    });
    return accepted.sort((left, right) => left.start - right.start || left.end - right.end);
  }

  function renderHighlightedText(text, highlights) {
    const source = String(text == null ? "" : text);
    const marks = normalizeHighlights(highlights, source);
    if (!marks.length) return escapeHtml(source);
    let html = "";
    let cursor = 0;
    marks.forEach((mark) => {
      if (mark.start > cursor) html += escapeHtml(source.slice(cursor, mark.start));
      const cls = mark.level === "strong" ? "insight-highlight insight-highlight--strong" : "insight-highlight";
      html += `<span class="${cls}">${escapeHtml(source.slice(mark.start, mark.end))}</span>`;
      cursor = mark.end;
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
    escapeHtml,
    fieldHighlights,
    normalizeHighlights,
    renderHighlightedText,
    plainTextFromHighlightedHtml,
  };
});
