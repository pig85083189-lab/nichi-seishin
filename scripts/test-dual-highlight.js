const {
  escapeHtml,
  renderHighlightedText,
  renderCombinedHighlightedText,
  plainTextFromHighlightedHtml,
} = require("../lib/insight-highlight");
const {
  asMarkBag,
  upsertMark,
  recolorMark,
  removeMark,
  snapshotSelection,
  createToolbarSession,
  applySelectionChange,
  enterColorMode,
  pendingMarkPayload,
} = require("../lib/user-mark");
const { mergeJournalObjects, mergeUserMarks } = require("../lib/review-merge");
const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function userMark(partial) {
  return {
    id: partial.id || "um_1",
    field: partial.field || "bodyCoach.analysis",
    start: partial.start,
    end: partial.end,
    text: partial.text,
    color: partial.color || "tea",
  };
}

const source = "當你願意看見自己的需要，也開始更懂得怎麼照顧自己。回到自己的節奏就夠了。";
const aiNeed = { text: "看見自己的需要", color: "pink" };
const userNeed = userMark({
  id: "um_need",
  start: source.indexOf("自己的需要"),
  end: source.indexOf("自己的需要") + "自己的需要".length,
  text: "自己的需要",
  color: "yellow",
});

const htmlA = renderCombinedHighlightedText(source, [aiNeed], []);
assert(htmlA.includes("insight-highlight--pink"), "CASE A：只有 AI highlight 正常");
assert(!htmlA.includes("user-highlight"), "CASE A：沒有 userMark 時不畫手動 span");
assert(plainTextFromHighlightedHtml(htmlA) === source, "CASE A / S：strip 後等於原文");
assert(htmlA === renderHighlightedText(source, [aiNeed]), "CASE A：無 userMark 時與 AI-only render 相同");

const htmlB = renderCombinedHighlightedText(source, [], [userNeed]);
assert(htmlB.includes("user-highlight--yellow"), "CASE B：只有 userMark 正常");
assert(!htmlB.includes("insight-highlight"), "CASE B：沒有 AI highlight 時不畫自動 span");
assert(plainTextFromHighlightedHtml(htmlB) === source, "CASE B / S：strip 後等於原文");

const leftUser = userMark({
  id: "um_left",
  start: source.indexOf("願意"),
  end: source.indexOf("願意") + "願意".length,
  text: "願意",
  color: "sage",
});
const htmlC = renderCombinedHighlightedText(source, [aiNeed], [leftUser]);
assert(htmlC.includes("insight-highlight--pink"), "CASE C：不重疊時 AI 仍在");
assert(htmlC.includes("user-highlight--sage"), "CASE C：不重疊時 userMark 仍在");
assert(plainTextFromHighlightedHtml(htmlC) === source, "CASE C / S：strip 後等於原文");

const htmlD = renderCombinedHighlightedText(source, [aiNeed], [userNeed]);
assert(htmlD.includes("user-highlight--yellow"), "CASE D：部分重疊時 userMark 視覺優先");
assert(htmlD.includes("insight-highlight--pink"), "CASE D：AI 未重疊殘段仍顯示");
assert(!htmlD.includes("user-highlight--yellow") || htmlD.indexOf("自己的需要") >= 0, "CASE D：重疊文字仍在");
const overlapInner = htmlD.match(/user-highlight--yellow"[^>]*>([^<]*)/);
assert(overlapInner && overlapInner[1] === "自己的需要", "CASE D：重疊區顯示 user 顏色");
assert(!/insight-highlight[^>]*>自己的需要/.test(htmlD), "CASE D：重疊區不是 AI span");
assert(plainTextFromHighlightedHtml(htmlD) === source, "CASE D / S：部分重疊文字完整");

const fullUser = userMark({
  id: "um_full",
  start: source.indexOf("看見自己的需要"),
  end: source.indexOf("看見自己的需要") + "看見自己的需要".length,
  text: "看見自己的需要",
  color: "tea",
});
const htmlE = renderCombinedHighlightedText(source, [aiNeed], [fullUser]);
assert(htmlE.includes("user-highlight--tea"), "CASE E：完全重疊時 userMark 視覺優先");
assert(!htmlE.includes("insight-highlight"), "CASE E：完全重疊時 presentation 不畫 AI span");
assert(plainTextFromHighlightedHtml(htmlE) === source, "CASE E / S：完全重疊文字完整");
assert(JSON.stringify([aiNeed]) === JSON.stringify([aiNeed]), "CASE E：AI 資料仍存在、未被刪改");

const rhythm = source.indexOf("回到自己的節奏");
const rightUser = userMark({
  id: "um_right",
  start: rhythm,
  end: rhythm + "回到自己的節奏".length,
  text: "回到自己的節奏",
  color: "tea",
});
const htmlF = renderCombinedHighlightedText(source, [aiNeed], [rightUser]);
assert(htmlF.indexOf("insight-highlight") < htmlF.indexOf("user-highlight"), "CASE F：AI 在左、user 在右，offset 不偏");
assert(plainTextFromHighlightedHtml(htmlF) === source, "CASE F / S：文字完整");

const htmlG = renderCombinedHighlightedText(source, [{ text: "回到自己的節奏", color: "tea" }], [leftUser]);
assert(htmlG.indexOf("user-highlight") < htmlG.indexOf("insight-highlight"), "CASE G：AI 在右、user 在左，offset 不偏");
assert(plainTextFromHighlightedHtml(htmlG) === source, "CASE G / S：文字完整");

const twice = "轉折點出現一次。後面又出現轉折點。";
const second = twice.lastIndexOf("轉折點");
const htmlH = renderCombinedHighlightedText(twice, [{ text: "出現一次", color: "sage" }], [
  userMark({ id: "um_dup", start: second, end: second + 3, text: "轉折點", color: "pink" }),
]);
assert((htmlH.match(/user-highlight--/g) || []).length === 1, "CASE H：同一句出現兩次只標原本選中的 occurrence");
assert(htmlH.indexOf("user-highlight") > htmlH.indexOf("後面又出現"), "CASE H：標的是第二次");
assert(plainTextFromHighlightedHtml(htmlH) === twice, "CASE H / S：文字完整");

const session = createToolbarSession();
const snap = snapshotSelection({
  date: "2026-08-24",
  field: "bodyCoach.analysis",
  start: 0,
  end: 3,
  text: "當你願",
  rect: { left: 12, top: 40, width: 80, height: 20 },
});
assert(snap && snap.date === "2026-08-24" && snap.field === "bodyCoach.analysis", "snapshot 含 date/field/start/end/text/rect");
applySelectionChange(session, snap);
const afterCollapse = applySelectionChange(session, null);
assert(afterCollapse === "keep", "CASE I：selection collapse 不清 pending");
assert(session.pending && session.pending.text === "當你願", "CASE I：snapshot 還在");
assert(enterColorMode(session) === true, "CASE J：選字後可進入四色");
const pending = pendingMarkPayload(session);
assert(pending.start === 0 && pending.end === 3 && pending.text === "當你願", "CASE J：上色使用 snapshot，不重讀 getSelection");

let items = [];
items = upsertMark(items, { field: "bodyCoach.analysis", start: 2, end: 6, text: "願意", color: "tea" });
assert(items.length === 1 && items[0].color === "tea", "CASE J：畫重點一次成功");
items = recolorMark(items, items[0].id, "pink");
assert(items[0].color === "pink", "CASE K：換色成功");
const keptId = items[0].id;
items = removeMark(items, keptId);
assert(items.length === 0, "CASE L：移除成功");
const emptied = mergeUserMarks(
  { items: [{ id: keptId, field: "bodyCoach.analysis", start: 2, end: 6, text: "願意", color: "pink" }], updatedAt: "2026-08-01T00:00:00.000Z" },
  { items: [], updatedAt: "2026-08-24T00:00:00.000Z" }
);
assert(emptied.items.length === 0, "CASE M：移除最後一筆且有新 updatedAt 時，reload 不復活");

const bothHtml = renderCombinedHighlightedText(source, [aiNeed], [userNeed]);
assert(plainTextFromHighlightedHtml(bothHtml) === source, "CASE N：reload 前 AI + userMark 文字仍完整");
assert(bothHtml.includes("insight-highlight") && bothHtml.includes("user-highlight"), "CASE N / O：兩套可同時存在");

const oldOnlyUser = renderCombinedHighlightedText("核心結論還在。", undefined, [
  userMark({ id: "keep", field: "bodyCoach.title", start: 0, end: 2, text: "核心", color: "tea" }),
]);
assert(oldOnlyUser.includes("user-highlight--tea"), "CASE P：舊 review 只有 userMarks 可重新顯示");
assert(plainTextFromHighlightedHtml(oldOnlyUser) === "核心結論還在。", "CASE P / S：舊 userMarks 文字完整");

const noMarks = renderCombinedHighlightedText("舊資料沒有 highlights。", undefined, undefined);
assert(noMarks === escapeHtml("舊資料沒有 highlights。"), "CASE Q：沒 userMarks 不報錯，顯示純文字");
assert(asMarkBag(undefined).items.length === 0, "CASE Q：空 bag 可讀");

const nested = "<span class=\"insight-highlight insight-highlight--pink\">看見<span class=\"user-highlight\">自己</span></span>";
assert(plainTextFromHighlightedHtml(htmlD).includes("看見自己的需要"), "CASE S：不論 span 層數，textContent 還原原文");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
assert(css.includes("max-width: calc(100vw - 24px)"), "CASE R：工具列不超出 viewport");
assert(appJs.includes("window.innerWidth - width - pad"), "CASE R：placeUserMarkBar 會夾在螢幕內");
assert(css.includes("-webkit-user-select: text") && css.includes("[data-user-mark-field]"), "CASE T：正文可選字");
assert(!/\[data-user-mark-field\][^{]*\{[^}]*touch-callout:\s*none/.test(css), "CASE T：正文沒有 touch-callout none");
assert(!appJs.includes("userMarkMode") && !appJs.includes("is-user-mark-mode"), "CASE T：沒有恢復 mark mode");
assert(!/document\.addEventListener\(\s*["']touchstart["']/.test(appJs), "CASE T：不攔 document touchstart");
assert(!/document\.addEventListener\(\s*["']touchmove["']/.test(appJs), "CASE T：不攔 document touchmove");
assert(!/document\.addEventListener\(\s*["']pointerdown["']/.test(appJs), "CASE T：不攔 document pointerdown");
const contextBlocks = appJs.match(/addEventListener\(\s*["']contextmenu["'][\s\S]{0,420}/g) || [];
assert(contextBlocks.length === 1, "CASE T：只有 toolbar 會攔 contextmenu");
assert(contextBlocks[0].includes("[data-user-mark-toolbar]"), "CASE T：contextmenu.preventDefault 只發生在工具列");
assert(html.includes("userMarkBarDraw") && html.includes("畫重點"), "CASE J：兩階段工具列存在");
assert(appJs.includes("pendingMarkPayload") && appJs.includes("snapshotSelection"), "保留 selection snapshot");
assert(appJs.includes("data-user-mark-field") && appJs.includes("bindUserMarkUi"), "手動 runtime 已接回");
assert(appJs.includes("bodyCoach.analysis") && appJs.includes("think.psychology") && appJs.includes("awareness.seen"), "AI 生成欄位可手動畫");
assert(html.includes("自動抓出今天的重點") && html.includes("也可以留下自己的重點"), "使用說明兩套分開寫");
assert(!html.includes("先進入畫重點模式"), "使用說明不是 mark mode");

const mergedKeep = mergeJournalObjects(
  { userMarks: { items: [{ id: "keep", field: "bodyCoach.title", start: 0, end: 2, text: "核心", color: "tea" }], updatedAt: "2026-01-01T00:00:00.000Z" }, event: "舊" },
  { userMarks: { items: [], updatedAt: "" }, event: "新" }
);
assert(mergedKeep.userMarks.items[0].id === "keep", "cloud merge：空資料不可覆蓋舊 userMarks");

console.log("dual highlight tests passed");
