const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function count(needle) {
  let n = 0;
  let from = 0;
  while (from <= src.length) {
    const found = src.indexOf(needle, from);
    if (found < 0) return n;
    n += 1;
    from = found + needle.length;
  }
  return n;
}

function has(needle) {
  return src.includes(needle);
}

assert(has("data-user-mark-field"), "使用 data-user-mark-field 標記可畫區域");
assert(!/tagName\s*===?\s*['\"]H[1-6]['\"]/.test(src), "不可用 h1/h2/h3 tag 禁止畫重點");
assert(has("pendingMarkPayload") || has("userMarkSession.pending"), "使用 selection snapshot");
assert(has("beginToolbarInteract") || has("interacting"), "工具列 interaction lock");
assert(has("ignoreSelectionChange"), "toolbar 操作期間忽略 selectionchange");
assert(has('dismissUserMarkUi("complete")') || has("clearNativeSelection"), "成功後才清 selection");
assert(has('dismissUserMarkUi("cancel")'), "取消時才清 selection");

const shared = [
  "bodyCoach.title",
  "bodyCoach.analysis",
  "bodyCoach.notice",
  "think.title",
  "think.awareness",
  "think.selfSeen",
  "think.takeaway",
  "think.round.${index}.question",
  "awareness.seen",
  "awareness.gap",
  "awareness.question",
  "awareness.line",
  "awareness.prompt.${index}.question",
  "exec.item.${orig}.title",
  "exec.focus.title",
  "exec.focus.detail",
  "exec.prompt.${index}.question",
  "manifest.sentence",
  "manifest.prompt.${index}.question",
  "deep.${fieldIndex}.title",
];

shared.forEach((field) => {
  assert(has(field), `generated field 存在：${field}`);
});

assert(count("bodyCoach.title") >= 2, "CASE M/S：bodyCoach.title 今日與歷史共用");
assert(count("think.title") >= 2, "CASE M/S：think.title 今日與歷史共用");
assert(has("awareness.${item.kind}") && has('"awareness.seen"'), "CASE N/S：awareness.seen 今日與歷史同一 identity");
assert(count("exec.item.") >= 4, "CASE K/L：行動卡 title/detail 今日與歷史共用");
assert(count("think.round.") >= 4, "深度思考 round question/answer 今日與歷史共用");
assert(count("awareness.prompt.") >= 2, "覺察題今日與歷史共用");
assert(count("exec.prompt.") >= 2, "執行題今日與歷史共用");
assert(has("deep.${fieldIndex}.title") && has("deep.${index}.title"), "深度主題 title 今日與歷史共用");

assert(has('conclusion-callout__label">核心結論'), "CASE O：固定 UI label「核心結論」不是 markable field");
assert(!has('data-user-mark-field="核心結論"'), "CASE O：固定 label 不加 field");
assert(has("isForbiddenMarkTarget") || has("input, textarea"), "CASE P：input/textarea 禁止");

console.log("user mark field mapping tests passed");
