const {
  escapeHtml,
  normalizeMarks,
  renderMarkedText,
  plainTextFromMarkedHtml,
  resolveRange,
  upsertMark,
  recolorMark,
  removeMark,
  mergeUserMarks,
  marksForField,
} = require("../lib/user-mark");
const { mergeJournalObjects } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const source = "昨晚的夢境雖然帶來短暫的驚嚇，卻成為一個轉折點。你在夢醒後進一步思考了失去的含義。";

const htmlA = renderMarkedText(source, [{ id: "a", field: "bodyCoach.title", start: 19, end: 22, text: "轉折點", color: "tea" }]);
assert(htmlA.includes("user-highlight--tea"), "CASE A：奶茶反白");
assert(plainTextFromMarkedHtml(htmlA) === source, "CASE A：正文不變");

const htmlB = renderMarkedText("今天讓你感受到被看見。", [
  { id: "b", field: "awareness.seen", start: 8, end: 11, text: "被看見", color: "sage" },
]);
assert(htmlB.includes("user-highlight--sage"), "CASE B：顏色 class");
assert(plainTextFromMarkedHtml(htmlB) === "今天讓你感受到被看見。", "CASE B：正文不變");

const wrap = "這段比較長的重點加深了你對身邊人的珍視，即使換行也應該自然帶著螢光筆。";
const htmlC = renderMarkedText(wrap, [
  { id: "c", field: "think.awareness", start: 8, end: 20, text: "加深了你對身邊人的珍視", color: "yellow" },
]);
assert(htmlC.includes("user-highlight--yellow"), "CASE C：跨行仍包 span");
assert(plainTextFromMarkedHtml(htmlC) === wrap, "CASE C：跨行正文完整");

const twice = "轉折點出現一次。後面又出現轉折點。";
const second = twice.lastIndexOf("轉折點");
const htmlD = renderMarkedText(twice, [
  { id: "d", field: "think.awareness", start: second, end: second + 3, text: "轉折點", color: "pink" },
]);
assert((htmlD.match(/class="user-highlight /g) || []).length === 1, "CASE D：同一句出現兩次只包選中那一次");
assert(htmlD.indexOf("user-highlight") > htmlD.indexOf("出現一次"), "CASE D：反白的是第二次");
assert(plainTextFromMarkedHtml(htmlD) === twice, "CASE D：正文完整");

const list = [
  { id: "e", field: "bodyCoach.title", start: 19, end: 22, text: "轉折點", color: "tea" },
];
const recoloured = recolorMark(list, "e", "pink");
assert(recoloured[0].color === "pink", "CASE E：可換色");
assert(recoloured[0].start === 19 && recoloured[0].text === "轉折點", "CASE E：位置不變");

const removed = removeMark(recoloured, "e");
assert(removed.length === 0, "CASE F：可移除");
assert(renderMarkedText(source, removed) === escapeHtml(source), "CASE F：移除後回復原文");

assert(renderMarkedText(source, undefined) === escapeHtml(source), "CASE I：沒有 userMarks 顯示全文");
assert(renderMarkedText(source, []).length === escapeHtml(source).length, "CASE I：空陣列不反白");

const xss = `他寫了 <script>alert(1)</script> 與 "引號"。`;
const htmlK = renderMarkedText(xss, [{ id: "k", field: "x", start: 20, end: 22, text: "引號", color: "tea" }]);
assert(!htmlK.includes("<script>"), "CASE K：不可輸出未 escape script");
assert(plainTextFromMarkedHtml(htmlK) === xss, "CASE K：特殊字元還原後等於原文");

const drifted = resolveRange("前綴轉折點後綴", { field: "x", start: 99, end: 102, text: "轉折點", color: "tea", id: "z" });
assert(drifted && drifted.start === 2, "range 對不上時用原文精確字串回錨到最近一次");

const missing = resolveRange("完全沒有這段", { field: "x", start: 0, end: 3, text: "轉折點", color: "tea", id: "z" });
assert(missing == null, "找不到原文就略過");

const older = [{ id: "keep", field: "bodyCoach.title", start: 0, end: 2, text: "安心", color: "tea" }];
assert(mergeUserMarks(older, []).items[0].id === "keep", "CASE M：空陣列不可覆蓋");
assert(mergeUserMarks(older, undefined).items[0].id === "keep", "CASE M：空值不可覆蓋");
assert(mergeUserMarks(older, {}).items[0].id === "keep", "CASE M：空物件不可覆蓋");
assert(
  mergeUserMarks(older, [{ id: "new", field: "bodyCoach.title", start: 1, end: 3, text: "進展", color: "sage" }]).items[0].id === "new",
  "有新 marks 時採用新資料"
);

const cleared = mergeUserMarks(
  { items: older, updatedAt: "2026-08-20T00:00:00.000Z" },
  { items: [], updatedAt: "2026-08-24T00:00:00.000Z" }
);
assert(cleared.items.length === 0, "CASE F：帶時間戳的空 bag 表示使用者刻意清空");

const merged = mergeJournalObjects({ userMarks: older, event: "舊" }, { userMarks: [], event: "新" });
assert(merged.event === "新", "journal 其他欄位仍可更新");
assert(merged.userMarks.items.length === 1 && merged.userMarks.items[0].id === "keep", "CASE M：merge journal 時空 userMarks 不可覆蓋");

assert(!htmlA.includes("insight-highlight"), "CASE J：使用者反白不走舊 AI highlight class");

const added = upsertMark([], { field: "awareness.seen", start: 0, end: 3, text: "被看見", color: "yellow" });
assert(added[0].text === "被看見" && added[0].color === "yellow", "只能用使用者選取的原文建立 mark");
assert(marksForField(added, "awareness.seen").length === 1, "依 field 取出");
assert(marksForField(added, "bodyCoach.title").length === 0, "其他 field 不取出");

const overlap = upsertMark(added, { field: "awareness.seen", start: 1, end: 4, text: "看見。", color: "pink" });
assert(overlap.length === 1, "重疊時不重複包兩層");

const normalized = normalizeMarks([{ field: "", text: "轉折點", start: 0, end: 3 }]);
assert(normalized.length === 0, "沒有 field 的 mark 不保存");

console.log("user mark tests passed");
