const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");

assert(!html.includes("userMarkBar"), "CASE K：HTML 已移除畫重點 toolbar");
assert(!html.includes("userMarkBarDraw"), "CASE K：沒有畫重點按鈕");
assert(!html.includes("lib/user-mark.js"), "CASE K：不載入 user-mark.js");
assert(!src.includes("bindUserMarkUi"), "CASE K：已移除 bindUserMarkUi");
assert(!src.includes("pendingUserMark"), "CASE K：已移除 pending snapshot");
assert(!src.includes("data-user-mark-field"), "CASE K：已移除 data-user-mark-field");
assert(!src.includes("markableOpenAttrs"), "CASE K：已移除 markableOpenAttrs");
assert(!src.includes("userMarkSession"), "CASE K：已移除 userMarkSession");
assert(!/addEventListener\(\s*["']selectionchange["']/.test(src), "CASE L：沒有 selectionchange 監聽");
assert(src.includes("userMarkBag") && src.includes("userMarks:"), "CASE M：仍保留 userMarks 相容讀寫");
assert(src.includes("renderHighlightedText") || src.includes("highlightedHtml"), "已重新啟用 AI 反白 render");
assert(css.includes("insight-highlight--yellow"), "四色自動反白 CSS 存在");
assert(!css.includes("user-mark-bar"), "CSS 已移除手動 toolbar");
assert(!html.includes("長按並選取文字"), "使用說明已移除手動畫重點步驟");

console.log("manual user-mark UI removal tests passed");
