const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");

assert(html.includes("userMarkBar"), "toolbar 已恢復");
assert(html.includes("userMarkBarDraw"), "兩階段：先出現畫重點");
assert(html.includes("lib/user-mark.js"), "重新載入 user-mark.js");
assert(src.includes("bindUserMarkUi"), "bindUserMarkUi 已接回");
assert(src.includes("snapshotSelection") && src.includes("pendingMarkPayload"), "selection snapshot 已恢復");
assert(src.includes("data-user-mark-field") && src.includes("markableOpenAttrs"), "可畫重點欄位已恢復");
assert(src.includes("userMarkSession"), "toolbar session 已恢復");
assert(/addEventListener\(\s*["']selectionchange["']/.test(src), "有 selectionchange 監聽");
assert(src.includes("renderCombinedHighlightedText"), "AI + userMark 一次 render");
assert(src.includes("userMarkBag") && src.includes("userMarks:"), "仍沿用 journal.userMarks");
assert(src.includes("bodyCoach.analysis") && src.includes("bodyCoach.title"), "身心小結可畫");
assert(src.includes("bodyMind.insight") && src.includes("bodyMind.support"), "03 覺察與引導可畫");
assert(src.includes("think.psychology") && src.includes("think.awareness") && src.includes("think.takeaway"), "深度思考可畫");
assert(src.includes("think.coreQuote") && src.includes("think.question."), "04 V3 金句與三題可畫");
assert(src.includes("awareness.seen") && src.includes("awareness.line"), "覺察結果可畫");
assert(src.includes("exec.item.") && src.includes("exec.focus.title"), "行動卡與今日焦點可畫");
assert(src.includes("manifest.sentence") && src.includes("manifest.path."), "顯化內容可畫");
assert(src.includes("history-journal__text"), "歷史紀錄可畫");
assert(!src.includes("userMarkMode") && !src.includes("is-user-mark-mode"), "沒有恢復 mark mode");
assert(css.includes("user-mark-bar") && css.includes(".user-highlight--tea"), "手動反白 CSS 已恢復");
assert(css.includes(".insight-highlight--yellow"), "AI 四色 CSS 仍在");
assert(html.includes("長按選取文字") && html.includes("滑鼠選取文字"), "使用說明含手機與電腦操作");

console.log("user-mark field restore tests passed");
