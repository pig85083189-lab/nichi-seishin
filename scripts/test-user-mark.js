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
  snapshotSelection,
  createToolbarSession,
  ignoreSelectionChange,
  applySelectionChange,
  beginToolbarInteract,
  enterColorMode,
  enterEditMode,
  pendingMarkPayload,
  cancelToolbarSession,
  completeToolbarSession,
  isForbiddenMarkTarget,
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

const titleHtml = renderMarkedText("看見自己的需要，也是一種照顧", [
  { id: "g", field: "bodyCoach.title", start: 2, end: 6, text: "自己的需", color: "tea" },
]);
assert(titleHtml.includes("user-highlight--tea"), "CASE G：AI 標題可畫 2～5 字");
assert(plainTextFromMarkedHtml(titleHtml) === "看見自己的需要，也是一種照顧", "CASE G：標題正文不變");

const titleAll = renderMarkedText("看見自己的需要，也是一種照顧", [
  { id: "h", field: "think.title", start: 0, end: 14, text: "看見自己的需要，也是一種照顧", color: "sage" },
]);
assert(titleAll.includes("user-highlight--sage"), "CASE H：AI 標題整句可畫");

const quoteHtml = renderMarkedText("今天你留下的，是自己點頭的那一面。", [
  { id: "j", field: "awareness.line", start: 0, end: 17, text: "今天你留下的，是自己點頭的那一面。", color: "pink" },
]);
assert(quoteHtml.includes("user-highlight--pink"), "CASE J：金句可畫");

const cardTitle = renderMarkedText("明天11:00躺下休息20分鐘", [
  { id: "k", field: "exec.item.0.title", start: 0, end: 5, text: "明天11:00", color: "yellow" },
]);
assert(cardTitle.includes("exec.item.0.title") || cardTitle.includes("user-highlight--yellow"), "CASE K：行動卡 title 可畫");

const cardDetail = renderMarkedText("10:50設提醒，11:00放下手機。", [
  { id: "l", field: "exec.item.0.detail", start: 0, end: 12, text: "10:50設提醒，11:00放下手機。", color: "tea" },
]);
assert(cardDetail.includes("user-highlight--tea"), "CASE L：行動卡 detail 可畫");

const twiceRange = upsertMark([], { field: "think.round.0.question", start: 8, end: 11, text: "轉折點", color: "sage" });
const twiceSource = "轉折點出現一次。後面又出現轉折點。";
const htmlQ = renderMarkedText(twiceSource, [{ ...twiceRange[0], start: twiceSource.lastIndexOf("轉折點"), end: twiceSource.lastIndexOf("轉折點") + 3, text: "轉折點" }]);
assert((htmlQ.match(/class="user-highlight /g) || []).length === 1, "CASE Q：同一句兩次只標選中 range");

const live = { date: "2026-08-24", field: "bodyCoach.title", start: 2, end: 6, text: "自己的需", rect: { left: 10, top: 10, width: 40, height: 18 } };
const session = createToolbarSession();
assert(!("markMode" in session) || !session.markMode, "不再使用 userMarkMode");
assert(applySelectionChange(session, live) === "open-create", "CASE A：直接選字出現第一層「畫重點」");
assert(session.mode === "create", "CASE A：mode = create");
assert(session.pending.text === "自己的需", "CASE A：pending 保存原文");
assert(enterColorMode(session) === true, "CASE B：點畫重點進入四色");
assert(session.mode === "colors", "CASE B：第二層四色");
beginToolbarInteract(session);
assert(ignoreSelectionChange(session) === true, "CASE D：工具列 pointerdown 後忽略 selectionchange");
assert(applySelectionChange(session, null) === "ignore", "CASE C/D：collapse 不可關閉 toolbar");
assert(pendingMarkPayload(session).text === "自己的需", "CASE C：snapshot 仍在");
const painted = upsertMark([], { ...pendingMarkPayload(session), color: "sage" });
assert(painted[0].color === "sage" && painted[0].field === "bodyCoach.title", "CASE C：用 snapshot 上色，不靠 live selection");
completeToolbarSession(session);
assert(!session.pending && !session.mode && session.interacting === false, "上色後 pending 關閉");

const collapseSession = createToolbarSession();
assert(applySelectionChange(collapseSession, live) === "open-create", "選字建 snapshot");
assert(applySelectionChange(collapseSession, null) === "keep", "CASE C：collapse 不清 pending");
assert(collapseSession.pending && collapseSession.pending.text === "自己的需", "CASE C：native menu / collapse 後 snapshot 仍在");
assert(collapseSession.mode === "create", "CASE A：collapse 仍停在第一層");
assert(enterColorMode(collapseSession) === true, "CASE B：collapse 後仍可進四色");
const paintedFromSnap = upsertMark([], { ...pendingMarkPayload(collapseSession), color: "yellow" });
assert(paintedFromSnap[0].text === "自己的需" && paintedFromSnap[0].color === "yellow", "CASE C：上色只用 snapshot");
completeToolbarSession(collapseSession);

const cancelSession = createToolbarSession();
applySelectionChange(cancelSession, live);
enterColorMode(cancelSession);
cancelToolbarSession(cancelSession);
assert(!cancelSession.pending && !cancelSession.mode, "取消不留下 pending");
assert(upsertMark([], pendingMarkPayload(cancelSession) || {}).length === 0, "取消不建立 userMark");

const editSession = createToolbarSession();
enterEditMode(editSession, { ...live, markId: "m1" });
assert(ignoreSelectionChange(editSession) === true, "edit 期間忽略 selectionchange");
assert(pendingMarkPayload(editSession).markId === "m1", "CASE H：已反白可換色，edit 使用 snapshot");

assert(isForbiddenMarkTarget({ nodeType: 1, closest: (sel) => (sel.includes("textarea") ? {} : null) }) === true, "CASE P：textarea 禁止");
assert(isForbiddenMarkTarget({ nodeType: 1, closest: (sel) => (sel.includes("input") ? {} : null) }) === true, "CASE P：input 禁止");
assert(isForbiddenMarkTarget({ nodeType: 1, closest: (sel) => (sel.includes("[data-user-mark-toolbar]") ? {} : null) }) === true, "toolbar 自己禁止");
assert(isForbiddenMarkTarget({ nodeType: 1, closest: () => null }) === false, "一般閱讀文字可畫");

const snapNull = snapshotSelection({ field: "x", start: 0, end: 0, text: "" });
assert(snapNull == null, "空選取不能當 snapshot");

const safariSession = createToolbarSession();
assert(applySelectionChange(safariSession, live) === "open-create", "CASE A：合法 selection 建 snapshot");
assert(safariSession.pending.text === "自己的需", "CASE A：選字後 pending 存在");
const dragged = { ...live, start: 0, end: 6, text: "看見自己的需" };
assert(applySelectionChange(safariSession, dragged) === "open-create", "拖曳 handles 可更新 snapshot");
assert(safariSession.pending.text === "看見自己的需", "pending 跟著新 range");
assert(applySelectionChange(safariSession, null) === "keep", "CASE C：更新後再 collapse 仍保留");
assert(enterColorMode(safariSession) === true, "CASE B：點畫重點後四色");
assert(safariSession.mode === "colors", "CASE B：第二層");
assert(ignoreSelectionChange(safariSession) === true, "四色期間忽略 selectionchange");
assert(applySelectionChange(safariSession, null) === "ignore", "CASE C：四色期間 collapse 不清");
const firstPaint = upsertMark([], { ...pendingMarkPayload(safariSession), color: "pink" });
assert(firstPaint[0].text === "看見自己的需", "CASE C：四色後仍用 snapshot");
completeToolbarSession(safariSession);
assert(applySelectionChange(safariSession, live) === "open-create", "完成後可立刻選第二筆，不必先進 mark mode");
const secondLive = { date: "2026-08-24", field: "bodyCoach.analysis", start: 0, end: 3, text: "轉折點", rect: live.rect };
assert(applySelectionChange(safariSession, secondLive) === "open-create", "第二段合法 range 取代 pending");
enterColorMode(safariSession);
const secondPaint = upsertMark(firstPaint, { ...pendingMarkPayload(safariSession), color: "pink" });
assert(secondPaint.length === 2, "第二筆可獨立上色");

const titleMark = upsertMark([], { field: "bodyCoach.title", start: 0, end: 7, text: "看見自己的需要", color: "tea" });
assert(titleMark[0].field === "bodyCoach.title", "CASE I：標題可畫");
const bodyMark = upsertMark(titleMark, { field: "bodyCoach.analysis", start: 0, end: 3, text: "轉折點", color: "sage" });
assert(bodyMark.some((item) => item.field === "bodyCoach.analysis"), "CASE J：一般內文可畫");
const historyTitle = upsertMark(bodyMark, { field: "think.title", start: 0, end: 4, text: "看見自己", color: "pink" });
assert(historyTitle.some((item) => item.field === "think.title"), "CASE K：歷史標題 field 可畫");

const stored = { items: historyTitle, updatedAt: "2026-08-24T08:00:00.000Z" };
assert(stored.items.length === 3, "CASE L：bag 可保存多筆");
const reloaded = mergeUserMarks({ items: [], updatedAt: "" }, stored);
assert(reloaded.items.length === 3 && reloaded.updatedAt === stored.updatedAt, "CASE L：reload 後重點仍在");
const clearedLast = removeMark(reloaded.items, reloaded.items[reloaded.items.length - 1].id);
const emptied = mergeUserMarks(reloaded, { items: clearedLast.length ? clearedLast : [], updatedAt: "2026-08-24T09:00:00.000Z" });
assert(emptied.items.length === 2, "CASE M：移除後以新 timestamp 為準");
const allRemoved = mergeUserMarks(emptied, { items: [], updatedAt: "2026-08-24T10:00:00.000Z" });
assert(allRemoved.items.length === 0, "CASE M：移除最後一筆後 reload 不復活");

console.log("user mark tests passed");
