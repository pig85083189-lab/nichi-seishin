(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiUserMark = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLORS = ["tea", "yellow", "sage", "pink"];
  const COLOR_LABEL = {
    tea: "奶茶",
    yellow: "奶黃",
    sage: "鼠尾草",
    pink: "霧粉",
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function makeId() {
    return `um_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeColor(value) {
    return COLORS.includes(value) ? value : "tea";
  }

  function normalizeMark(raw) {
    if (!raw || typeof raw !== "object") return null;
    const field = String(raw.field || raw.section || "").trim();
    const text = String(raw.text == null ? "" : raw.text);
    const start = Number(raw.start);
    const end = Number(raw.end);
    if (!field || !text) return null;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return {
      id: String(raw.id || makeId()),
      field,
      start: Math.max(0, Math.floor(start)),
      end: Math.max(0, Math.floor(end)),
      text,
      color: normalizeColor(raw.color),
      updatedAt: String(raw.updatedAt || "").trim(),
    };
  }

  function normalizeMarks(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .map(normalizeMark)
      .filter((item) => {
        if (!item || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }

  function marksForField(list, field) {
    const key = String(field || "").trim();
    if (!key) return [];
    return normalizeMarks(list).filter((item) => item.field === key);
  }

  function resolveRange(source, mark) {
    const text = String(source == null ? "" : source);
    const item = normalizeMark(mark);
    if (!item) return null;
    if (text.slice(item.start, item.end) === item.text) {
      return { start: item.start, end: item.end, text: item.text, color: item.color, id: item.id };
    }
    const hits = [];
    let from = 0;
    while (from <= text.length) {
      const found = text.indexOf(item.text, from);
      if (found < 0) break;
      hits.push(found);
      from = found + Math.max(1, item.text.length);
    }
    if (!hits.length) return null;
    const start = hits.reduce((best, pos) => (Math.abs(pos - item.start) < Math.abs(best - item.start) ? pos : best), hits[0]);
    return { start, end: start + item.text.length, text: item.text, color: item.color, id: item.id };
  }

  function renderMarkedText(text, marks) {
    const source = String(text == null ? "" : text);
    const resolved = normalizeMarks(marks)
      .map((item) => resolveRange(source, item))
      .filter(Boolean)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    const accepted = [];
    resolved.forEach((item) => {
      if (accepted.some((prev) => item.start < prev.end && item.end > prev.start)) return;
      accepted.push(item);
    });
    if (!accepted.length) return escapeHtml(source);
    let html = "";
    let cursor = 0;
    accepted.forEach((item) => {
      if (item.start > cursor) html += escapeHtml(source.slice(cursor, item.start));
      html += `<span class="user-highlight user-highlight--${item.color}" data-mark-id="${escapeHtml(item.id)}">${escapeHtml(
        source.slice(item.start, item.end)
      )}</span>`;
      cursor = item.end;
    });
    if (cursor < source.length) html += escapeHtml(source.slice(cursor));
    return html;
  }

  function plainTextFromMarkedHtml(html) {
    return String(html || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function overlaps(left, right) {
    return left.start < right.end && left.end > right.start && left.field === right.field;
  }

  function upsertMark(list, next) {
    const mark = normalizeMark(next);
    if (!mark) return normalizeMarks(list);
    const current = normalizeMarks(list).filter((item) => item.id === mark.id || !overlaps(item, mark));
    current.push({ ...mark, updatedAt: mark.updatedAt || new Date().toISOString() });
    return current.sort((left, right) => left.start - right.start || left.field.localeCompare(right.field));
  }

  function recolorMark(list, id, color) {
    return normalizeMarks(list).map((item) =>
      item.id === id ? { ...item, color: normalizeColor(color), updatedAt: new Date().toISOString() } : item
    );
  }

  function removeMark(list, id) {
    return normalizeMarks(list).filter((item) => item.id !== id);
  }

  function stampMs(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function asMarkBag(value) {
    if (Array.isArray(value)) return { items: normalizeMarks(value), updatedAt: "" };
    if (value && typeof value === "object") {
      return {
        items: normalizeMarks(value.items || value.marks || value.userMarks),
        updatedAt: String(value.updatedAt || "").trim(),
      };
    }
    return { items: [], updatedAt: "" };
  }

  function mergeUserMarks(older, newer) {
    const a = asMarkBag(older);
    const b = asMarkBag(newer);
    if (b.updatedAt && stampMs(b.updatedAt) >= stampMs(a.updatedAt)) return { items: b.items, updatedAt: b.updatedAt };
    if (b.items.length && !b.updatedAt) return { items: b.items, updatedAt: a.updatedAt || b.updatedAt };
    if (a.items.length || a.updatedAt) return a;
    return b;
  }

  function selectionOffsets(root, selection) {
    const sel = selection || (typeof window !== "undefined" ? window.getSelection() : null);
    if (!root || !sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;
    const pre = typeof document !== "undefined" ? document.createRange() : null;
    if (!pre) return null;
    pre.selectNodeContents(root);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const selected = range.toString();
    const end = start + selected.length;
    if (end <= start) return null;
    const text = String(root.textContent || "").slice(start, end);
    if (!text || text !== selected) return null;
    return { start, end, text };
  }

  return {
    COLORS,
    COLOR_LABEL,
    escapeHtml,
    normalizeColor,
    normalizeMark,
    normalizeMarks,
    marksForField,
    resolveRange,
    renderMarkedText,
    plainTextFromMarkedHtml,
    upsertMark,
    recolorMark,
    removeMark,
    mergeUserMarks,
    asMarkBag,
    selectionOffsets,
  };
});
