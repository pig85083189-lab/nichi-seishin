const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert(html.includes('id="historyDetailView"'), "有歷史詳情頁容器");
assert(html.includes('id="historyListView"'), "有歷史列表容器");
assert(src.includes("openHistoryDetail") && src.includes("closeHistoryDetail"), "有 detail navigation");
assert(src.includes("data-history-open"), "列表點整列進入詳情");
assert(src.includes("#history/${") || src.includes("#history/"), "使用 hash history/date");
assert(src.includes('addEventListener("popstate"'), "支援 browser back");
assert(src.includes("historyListScroll"), "保留列表 scroll");
assert(src.includes("historyQuery") && src.includes("historyTag"), "搜尋與 filter state 仍在");
assert(src.includes("history.back()"), "畫面上返回可走 browser history");
assert(src.includes("renderHistoryDetail") && src.includes("renderHistoryJournal"), "詳情頁沿用既有 journal render");
assert(src.includes("history-subcard--static"), "詳情 section 改為靜態閱讀，不再 accordion");
assert(src.includes("renderCombinedHighlightedText"), "combined highlight 仍在");
assert(!src.includes("data-history-toggle"), "列表不再用 accordion toggle");
assert(!/history-card__panel/.test(src), "列表不再插入 inline panel");

console.log("history detail navigation tests passed");
