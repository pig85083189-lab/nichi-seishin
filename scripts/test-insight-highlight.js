const {
  escapeHtml,
  fieldHighlights,
  inferColor,
  normalizeHighlights,
  renderHighlightedText,
  plainTextFromHighlightedHtml,
} = require("../lib/insight-highlight");
const { mergeJournalObjects } = require("../lib/review-merge");
const {
  normalizeAwarenessResult,
  normalizeBodyCoachResult,
  BODY_COACH_SYSTEM,
} = require("../api/review");
const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const sourceA = "你開始發現，真正需要調整的不是結果，而是看事情的角度。";
const htmlA = renderHighlightedText(sourceA, [{ text: "看事情的角度", color: "yellow" }]);
assert(htmlA.includes("insight-highlight--yellow"), "CASE A：valid highlight 必須反白");
assert(htmlA.includes(">看事情的角度</span>"), "CASE A：必須包到指定片段");
assert(plainTextFromHighlightedHtml(htmlA) === sourceA, "CASE A / G：移除 span 後必須等於原文");

const sourceB = "當你願意看見自己的需要，也開始更懂得怎麼照顧自己。";
const htmlB = renderHighlightedText(sourceB, [
  { text: "看見自己的需要", color: "pink" },
  { text: "照顧自己", color: "sage" },
]);
assert(htmlB.includes("insight-highlight--pink"), "CASE B：短段落保留第一個 highlight");
assert(!htmlB.includes("insight-highlight--sage"), "寧缺勿濫：短段落最多 1 個，不並排兩色");
assert((htmlB.match(/insight-highlight--/g) || []).length === 1, "短段落 0～1 個 highlight");
assert(plainTextFromHighlightedHtml(htmlB) === sourceB, "CASE B / G：正文完整");

const sourceBLong =
  "今天你慢慢看見自己的需要，也開始分辨真正卡住的地方。接著你願意開始，把注意力從結果轉回自己。最後你也想起，其實可以回到自己的節奏，不必一次證明全部。";
const htmlBLong = renderHighlightedText(sourceBLong, [
  { text: "看見自己的需要", color: "pink" },
  { text: "願意開始", color: "sage" },
]);
assert(htmlBLong.includes("insight-highlight--pink"), "較長段落可保留第一個 highlight");
assert(htmlBLong.includes("insight-highlight--sage"), "CASE B：較長段落最多 2 個都正確");
assert((htmlBLong.match(/insight-highlight--/g) || []).length === 2, "較長段落最多 2 個 highlight");
assert(plainTextFromHighlightedHtml(htmlBLong) === sourceBLong, "較長段落正文完整");

const sourceC = "今天狀態大致平穩，沒有特別需要強調的地方。";
const htmlC = renderHighlightedText(sourceC, [{ text: "這句完全不存在", color: "tea" }]);
assert(htmlC === escapeHtml(sourceC), "CASE C：找不到原文時略過");
assert(plainTextFromHighlightedHtml(htmlC) === sourceC, "CASE C：原文完整");

const sourceD = "卻成為一個轉折點。";
const htmlD = renderHighlightedText(sourceD, [{ text: "轉折點", color: "yellow" }]);
assert(htmlD.includes(">轉折點</span>"), "CASE D：2～3 字完整概念可顯示");
assert(plainTextFromHighlightedHtml(htmlD) === sourceD, "CASE D：正文完整");

const wrapSource = "這段比較長的重點加深了你對身邊人的珍視，即使換行也應該自然帶著螢光筆。";
const htmlE = renderHighlightedText(wrapSource, [{ text: "加深了你對身邊人的珍視", color: "tea" }]);
assert(htmlE.includes("insight-highlight"), "CASE E：跨行仍包 span");
assert(plainTextFromHighlightedHtml(htmlE) === wrapSource, "CASE E：跨行正文完整");

const sourceF = `他寫了 <script>alert(1)</script> 與 "引號" & 符號。`;
const htmlF = renderHighlightedText(sourceF, [{ text: "引號", color: "tea" }]);
assert(!htmlF.includes("<script>"), "CASE F：不可輸出未 escape 的 script");
assert(htmlF.includes("&lt;script&gt;"), "CASE F：HTML 特殊字元必須被 escape");
assert(plainTextFromHighlightedHtml(htmlF) === sourceF, "CASE F：特殊字元還原後必須等於原文");

const sourceH = "舊資料沒有 highlights，也要完整顯示全文。";
const htmlH = renderHighlightedText(sourceH, undefined);
assert(htmlH === escapeHtml(sourceH), "CASE H：沒有 highlights 時只 escape 原文");
assert(plainTextFromHighlightedHtml(htmlH) === sourceH, "CASE H：舊資料正文完整");

const twice = "轉折點出現一次，後面又出現一次轉折點。";
const htmlJSkip = renderHighlightedText(twice, [{ text: "轉折點", color: "yellow" }]);
assert(!htmlJSkip.includes("insight-highlight"), "CASE J：同一句出現兩次且無 start 時略過，不要反錯");
assert(plainTextFromHighlightedHtml(htmlJSkip) === twice, "CASE J：略過時原文完整");
const second = twice.lastIndexOf("轉折點");
const htmlJHit = renderHighlightedText(twice, [{ text: "轉折點", color: "yellow", start: second }]);
assert(htmlJHit.indexOf("insight-highlight") > htmlJHit.indexOf("後面又出現"), "CASE J：有 start 時只標指定 occurrence");
assert(plainTextFromHighlightedHtml(htmlJHit) === twice, "CASE J：指定 occurrence 時原文完整");

assert(normalizeHighlights([{ text: "一", color: "tea" }], "只有一個字不該反白。").length === 0, "少於 2 字不可反白");
assert(
  normalizeHighlights([{ text: "這一段太長了所以不應該被整句反白起來看", color: "tea" }], "這一段太長了所以不應該被整句反白起來看。").length === 0,
  "超過長度上限不可反白，且不可截成 2～12 字"
);

const threeSource =
  "今天你慢慢看見自己的需要，也開始分辨真正卡住的地方。接著你願意開始，把注意力從結果轉回自己。最後你也想起，其實可以回到自己的節奏，不必一次證明全部。";
const three = renderHighlightedText(threeSource, [
  { text: "看見自己的需要", color: "pink" },
  { text: "願意開始", color: "sage" },
  { text: "回到自己的節奏", color: "tea" },
]);
assert((three.match(/insight-highlight--/g) || []).length === 2, "較長段落最多 2 個 highlight");
assert(plainTextFromHighlightedHtml(three) === threeSource, "超過上限時正文仍完整");

assert(inferColor("看見自己的需要") === "pink", "四色：看見自己的需要 → 霧粉");
assert(inferColor("看事情的角度") === "yellow", "四色：看事情的角度 → 奶黃");
assert(inferColor("願意開始") === "sage", "四色：願意開始 → 鼠尾草");
assert(inferColor("回到自己的節奏") === "tea", "四色：回到自己的節奏 → 奶茶");
const sameA = renderHighlightedText("回到自己的節奏，就夠了。", [{ text: "回到自己的節奏" }]);
const sameB = renderHighlightedText("回到自己的節奏，就夠了。", [{ text: "回到自己的節奏" }]);
assert(sameA === sameB && sameA.includes("insight-highlight--tea"), "相同內容顏色保持一致");

const bag = {
  title: [{ text: "睡得好不好", color: "tea" }],
  analysis: [{ text: "內心想法逐漸實現", color: "yellow" }],
};
assert(fieldHighlights(bag, "title")[0].text === "睡得好不好", "欄位 highlights 必須依 field 取出");
assert(fieldHighlights(bag, "notice").length === 0, "沒有該欄位時回傳空陣列");
assert(fieldHighlights(undefined, "title").length === 0, "沒有 highlights bag 時回傳空陣列");

const awareness = normalizeAwarenessResult({
  seen: "今天你好像特別在意被放在心上。這比牛奶或關心本身更靠近你。你願意承認這一層，已經比只複述事件更深。最後你也看見完成感對你的拉扯。",
  gap: "你選了「是」之後，睡眠不足卻仍想把事情做完，可能才是今天真正沒被說出口的模式。這不是指責，只是把線索放在一起看。",
  question: "如果沒有人看見你的努力，你還會願意為自己做這些事情嗎？",
  line: "被放在心上，比事情本身更靠近你",
  highlights: {
    seen: [{ text: "被放在心上", color: "pink" }],
    gap: [{ text: "這段不存在", color: "yellow" }],
  },
});
assert(awareness.seen.includes("完成感"), "API 不得為了 highlight 改寫 seen");
assert(awareness.highlights.seen[0].text === "被放在心上", "API 必須原樣保留 highlights");
assert(awareness.highlights.gap[0].text === "這段不存在", "找不到的 highlight 仍原樣保存，render 時才略過");
const awarenessHtml = renderHighlightedText(awareness.seen, awareness.highlights.seen);
assert(plainTextFromHighlightedHtml(awarenessHtml) === awareness.seen, "覺察正文不可因反白少字");

const coach = normalizeBodyCoachResult(
  {
    title: "精神狀態好不好，重點不完全在睡多久，而是睡得好不好。",
    analysis: "睡眠品質和起床精神出現落差，比單純睡多久更值得停下來看。這不是要你立刻改作息，只是把訊號放在一起。",
    notice: "今天情緒偏高，身體卻還沒跟上，這個落差值得留意。",
    suggestions: ["睡前把手機放到另一個房間。先讓眼睛休息十分鐘。", "明天其中一餐多一份青菜。"],
    highlights: {
      title: [{ text: "睡得好不好", color: "tea" }],
    },
  },
  { mood: { flags: ["平靜"] }, body: { flags: [] }, sleep: { duration: "7-8小時", quality: "普通", energy: "還可以" } }
);
assert(coach.title.includes("睡得好不好"), "身心小結正文不可被 highlight 改寫");
assert(coach.highlights.title[0].text === "睡得好不好", "身心小結必須帶出 highlights");
const todayHtml = renderHighlightedText(coach.title, fieldHighlights(coach.highlights, "title"));
const historyHtml = renderHighlightedText(coach.title, fieldHighlights(coach.highlights, "title"));
assert(todayHtml === historyHtml && todayHtml.includes("insight-highlight"), "CASE I：今日與歷史用同一份 highlights 渲染");

const oldJournal = { userMarks: { items: [{ id: "keep", field: "bodyCoach.title", start: 0, end: 3, text: "核心", color: "tea" }], updatedAt: "2026-01-01T00:00:00.000Z" }, event: "舊" };
const merged = mergeJournalObjects(oldJournal, { userMarks: { items: [], updatedAt: "" }, event: "新" });
assert(merged.userMarks.items.length === 1 && merged.userMarks.items[0].id === "keep", "CASE M：舊 userMarks 不可被空資料覆蓋");
assert(renderHighlightedText("核心結論還在。", undefined) === escapeHtml("核心結論還在。"), "CASE M：UI 不 render userMarks");

const reviewJs = fs.readFileSync(path.join(__dirname, "../api/review.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../app.css"), "utf8");
assert(reviewJs.includes("highlight.text 必須 100% 原樣存在"), "AI prompt 必須要求 highlight 原樣存在於原文");
assert(BODY_COACH_SYSTEM.includes("highlights"), "身心小結 prompt 必須包含 highlights");
assert(reviewJs.includes("CHECKLIST_AWARENESS_SYSTEM") && reviewJs.includes('"seen": [{ "text"'), "覺察力 prompt 必須包含 highlights");
assert(reviewJs.includes("THINK_GUIDE_CLOSE_SYSTEM") && reviewJs.includes('"awareness": [{ "text"'), "深度思考收束 prompt 必須包含 highlights");
assert(reviewJs.includes("每張卡與 focus 可帶 highlights"), "執行力 prompt 必須包含 highlights");
assert(reviewJs.includes('color": "yellow"') || reviewJs.includes("color："), "prompt 必須說明四色");
assert(!html.includes("userMarkBar"), "CASE K：手動畫重點 toolbar 不存在");
assert(!html.includes("lib/user-mark.js"), "CASE K：不載入手動畫重點 runtime");
assert(!appJs.includes("bindUserMarkUi") && !appJs.includes("selectionchange"), "CASE L：沒有手動畫重點監聽");
assert(!appJs.includes("data-user-mark-field"), "CASE L：沒有可畫重點欄位");
assert(!css.includes("user-mark-bar") && !css.includes(".user-highlight"), "CASE K：已移除手動畫重點 CSS");
assert(css.includes("box-decoration-break: clone"), "CASE E / N：跨行螢光筆");
assert(css.includes("rgba(214, 187, 164, 0.7)"), "CASE N：反白強度夠清楚");
assert(css.includes("line-height: inherit"), "CASE N：不可撐高行距");
assert(html.includes("自動抓出今天的重點"), "使用說明已改為自動抓重點");
assert(!html.includes("點「畫重點」"), "使用說明不再教手動畫重點");

console.log("insight highlight tests passed");
