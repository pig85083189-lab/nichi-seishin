const fs = require("fs");
const path = require("path");
const { splitTitleDetail } = require("../lib/text-integrity");
const { renderCombinedHighlightedText, plainTextFromHighlightedHtml } = require("../lib/insight-highlight");
const { normalizeExecutionChecklistItems } = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const integrity = fs.readFileSync(path.join(root, "lib/text-integrity.js"), "utf8");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

function timeIntact(parsed, source) {
  const times = source.match(/(?:[01]?\d|2[0-3])[:：][0-5]\d/g) || [];
  times.forEach((token) => {
    const inTitle = parsed.title.includes(token);
    const inDetail = String(parsed.detail || "").includes(token);
    assert(inTitle || inDetail, `時間 ${token} 必須完整出現在 title 或 detail`);
    assert(!(parsed.title.endsWith(token.split(/[:：]/)[0]) && String(parsed.detail || "").startsWith(token.split(/[:：]/)[1])), `不可把 ${token} 拆成 title/detail`);
  });
  assert(source.includes(parsed.title), "title 必須來自完整 source");
  if (parsed.detail) assert(source.includes(parsed.detail), "detail 必須來自完整 source");
}

const caseA = "今晚 22:00 後不再滑手機，確保明天睡眠至少 7 小時。";
const parsedA = splitTitleDetail(caseA);
assert(parsedA.title !== "今晚22" && parsedA.title !== "今晚 22", "CASE A：title 不可是 今晚22");
assert(!String(parsedA.detail || "").startsWith("00"), "CASE A：detail 不可從 00 開始");
assert(parsedA.title.includes("22:00"), "CASE A：22:00 完整");
assert(parsedA.title === caseA && parsedA.detail === "", "CASE A／F：無安全 delimiter 時整句 title");
timeIntact(parsedA, caseA);

const caseB = "明天 09:30 開始準備上床。";
const parsedB = splitTitleDetail(caseB);
assert(parsedB.title.includes("09:30"), "CASE B：09:30 完整");
assert(parsedB.detail === "", "CASE B：不硬拆");
timeIntact(parsedB, caseB);

const caseC = "8:00 起床後先喝一杯水。";
const parsedC = splitTitleDetail(caseC);
assert(parsedC.title.includes("8:00"), "CASE C：8:00 完整");
assert(parsedC.title === caseC, "CASE C：整句保留");
timeIntact(parsedC, caseC);

const caseD = "23:59 前把手機放下。";
const parsedD = splitTitleDetail(caseD);
assert(parsedD.title.includes("23:59"), "CASE D：23:59 完整");
assert(parsedD.title === caseD, "CASE D：整句保留");
timeIntact(parsedD, caseD);

const caseE = "放下手機：今晚 22:00 後不再滑手機。";
const parsedE = splitTitleDetail(caseE);
assert(parsedE.title === "放下手機", "CASE E：安全 delimiter 可拆 title");
assert(parsedE.detail === "今晚 22:00 後不再滑手機。", "CASE E：detail 保留 22:00");
timeIntact(parsedE, caseE);

const caseF = "今晚 22:00 後不再滑手機。";
const parsedF = splitTitleDetail(caseF);
assert(parsedF.title === caseF && parsedF.detail === "", "CASE F：不安全 delimiter → 整句 title");

const compactTime = "今晚22:00後不再滑手機。";
const parsedCompact = splitTitleDetail(compactTime);
assert(parsedCompact.title.includes("22:00"), "無空白的 22:00 也不可拆");
assert(parsedCompact.detail === "", "無空白時間句整句保留");

const pipe = "放下手機｜今晚 22:00 後不再滑手機。";
const parsedPipe = splitTitleDetail(pipe);
assert(parsedPipe.title === "放下手機", "｜ 可作為安全 delimiter");
assert(parsedPipe.detail.includes("22:00"), "｜ 拆分後時間仍完整");

const three = [
  "明天早餐前停留 10 秒，感受當下。",
  "今晚 22:00 後不再滑手機，確保睡眠至少 7 小時。",
  "明天 09:30 打電話給媽媽。",
];
const cards = normalizeExecutionChecklistItems(
  three.map((title) => ({ title, detail: "" })),
  1,
  6,
  "",
  { keepFull: true }
);
assert(cards.length === 3, `CASE G：三張行動卡，實際 ${cards.length}`);
assert(cards[0].title === three[0], "CASE G：第一張完整");
assert(cards[1].title.includes("22:00") && cards[1].title === three[1], "CASE G：第二張 22:00 不拆壞");
assert(cards[2].title.includes("09:30") && cards[2].title === three[2], "CASE G：第三張 09:30 不拆壞");
assert(cards.every((item) => !item.detail || three.some((src) => src.includes(item.detail))), "CASE H：detail 不憑空發明");

const stringCards = normalizeExecutionChecklistItems(three, 1, 6, "", { keepFull: true });
assert(stringCards[1].title.includes("22:00"), "CASE G：字串路徑 22:00 完整");
assert(stringCards[2].title.includes("09:30"), "CASE G：字串路徑 09:30 完整");

three.forEach((source, index) => {
  const htmlCard = renderCombinedHighlightedText(cards[index].title, [{ text: cards[index].title.slice(0, 2), color: "sage" }], []);
  assert(plainTextFromHighlightedHtml(htmlCard) === cards[index].title, `CASE H／K／M：第 ${index + 1} 張 highlight 後文字完整`);
});

assert(app.includes("splitTitleDetail"), "CASE I：history／行動卡 parser 改走 splitTitleDetail");
assert(app.includes("historyExecChecksHtml"), "CASE I：history 仍用同一套 normalize");
assert(app.includes("function addTaskFromGuide"), "CASE J：Sidebar 仍經 addTaskFromGuide 收字");
assert(/parsed = splitTaskText\(label\)/.test(app), "CASE J：加入執行力仍走 splitTaskText");
assert(app.includes("renderCombinedHighlightedText"), "CASE K：AI highlight 未改核心");
assert(app.includes("userMark") || html.includes("lib/user-mark.js"), "CASE L：userMark 仍在");

const fn = integrity.slice(integrity.indexOf("function splitTitleDetail"), integrity.indexOf("return {", integrity.indexOf("function splitTitleDetail")));
assert(!/\.slice\(\s*0\s*,\s*\d+\s*\)/.test(fn), "CASE O：parser 沒有硬截字數");
assert(!/\.substring\(\s*0\s*,\s*\d+\s*\)/.test(fn), "CASE O：沒有 substring 硬切");
assert(app.includes("selectedIds") && html.includes("可以選 1～3 件"), "CASE P：06 多選文案仍在");
assert(html.includes("id=\"section-manifest\"") && app.includes("generateManifestPlan"), "CASE Q：07 仍在");
assert(html.includes('id="page-sfm"') && app.includes("function renderTasks()"), "CASE R：Sidebar 執行力未改入口");
assert(!app.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE S：無 schema migration");
assert(review.includes("splitTitleDetail"), "API splitChecklistTitle 改走同一套 parser");
assert(!/function splitTaskText\([\s\S]{0,180}search\(\/\[：:\]\/\)/.test(app), "client 不再用第一個冒號硬拆");
assert(!/function splitChecklistTitle\([\s\S]{0,180}search\(\/\[：:\]\/\)/.test(review), "API 不再用第一個冒號硬拆");
assert(css.includes("overflow-wrap: anywhere"), "CASE N：長句可換行");
assert(html.includes("lib/text-integrity.js?v=4"), "cache：text-integrity v=4");
assert(html.includes("app.js?v=216"), "cache：app.js v=216");

console.log("action title split tests passed");
