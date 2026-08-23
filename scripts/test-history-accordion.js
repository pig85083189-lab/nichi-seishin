function ensureHistorySectionDefaults(store, iso, sectionIds) {
  if (store[iso] && Object.keys(store[iso]).length) return store[iso];
  const next = {};
  sectionIds.forEach((id, index) => {
    next[id] = index === 0;
  });
  store[iso] = next;
  return next;
}

function setHistorySectionOpen(store, iso, sectionId, open) {
  if (!store[iso]) store[iso] = {};
  store[iso][sectionId] = Boolean(open);
}

function historySectionIsOpen(store, iso, sectionId, fallback) {
  const map = store[iso];
  if (map && Object.prototype.hasOwnProperty.call(map, sectionId)) return Boolean(map[sectionId]);
  return Boolean(fallback);
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const store = {};
const first = ensureHistorySectionDefaults(store, "2026-08-17", ["thanks", "event", "insight"]);
assert(first.thanks === true, "第一次打開某日期：第一個 section 預設展開");
assert(first.event === false && first.insight === false, "第一次打開：其他 section 預設收合");

setHistorySectionOpen(store, "2026-08-17", "insight", true);
setHistorySectionOpen(store, "2026-08-17", "event", true);
const afterRerender = ensureHistorySectionDefaults(store, "2026-08-17", ["thanks", "event", "insight"]);
assert(afterRerender.insight === true, "CASE C：rerender 後深度思考仍展開");
assert(afterRerender.event === true, "CASE C：rerender 後第二個展開 section 仍展開");
assert(afterRerender.thanks === true, "CASE C：原本展開的感謝仍展開");

setHistorySectionOpen(store, "2026-08-17", "insight", false);
assert(historySectionIsOpen(store, "2026-08-17", "insight", true) === false, "CASE D：手動收合後保持收合");
ensureHistorySectionDefaults(store, "2026-08-17", ["thanks", "event", "insight"]);
assert(store["2026-08-17"].insight === false, "CASE D：rerender 不可把手動收合改回預設展開");

assert(historySectionIsOpen(store, "2026-08-17", "insight", true) === false, "資料更新不應改寫 UI state");

console.log("history accordion tests passed");
