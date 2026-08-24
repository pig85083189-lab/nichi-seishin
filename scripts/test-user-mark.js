const { asMarkBag } = require("../lib/user-mark");
const { mergeJournalObjects, mergeUserMarks } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const older = { items: [{ id: "keep", field: "bodyCoach.title", start: 0, end: 3, text: "核心", color: "tea" }], updatedAt: "2026-01-01T00:00:00.000Z" };
const newerEmpty = { items: [], updatedAt: "" };
const mergedBag = mergeUserMarks(older, newerEmpty);
assert(mergedBag.items.length === 1 && mergedBag.items[0].id === "keep", "CASE M：merge userMarks 時空資料不可覆蓋");

const merged = mergeJournalObjects({ userMarks: older, event: "舊" }, { userMarks: [], event: "新" });
assert(merged.userMarks.items.length === 1 && merged.userMarks.items[0].id === "keep", "CASE M：merge journal 時空 userMarks 不可覆蓋");
assert(asMarkBag(older).items[0].text === "核心", "CASE M：舊 bag 仍可讀，不修改");

const cleared = mergeUserMarks(older, { items: [], updatedAt: "2026-08-24T00:00:00.000Z" });
assert(cleared.items.length === 0, "CASE M：主動移除最後一筆且帶新 updatedAt 時不復活");

console.log("userMarks compatibility tests passed");
