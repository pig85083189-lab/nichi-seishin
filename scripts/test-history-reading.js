const fs = require("fs");
const path = require("path");
const {
  buildHistoryReading,
  hasInformationGain,
} = require("../lib/history-reading");
const { getHistoryDailySummary } = require("../lib/history-summary");

function compactLen(text) {
  return String(text || "").replace(/\s+/g, "").length;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewApi = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes("lib/history-reading.js?v=1"), "History reading mapper 已載入");
assert(app.includes('"① 今天發生了什麼"'), "主閱讀流有①");
assert(app.includes("查看完整深度思考"), "深度思考可展開");
assert(app.includes("markableP(reading.stuck.text, reading.stuck.field"), "② 走既有 field + markableP");
assert(app.includes("markableP(reading.seen.text, reading.seen.field"), "③ 走既有 field + markableP");
assert(app.includes("renderCombinedHighlightedText"), "CASE I：combined renderer 仍在");
assert(app.includes("history-subcard--static"), "CASE L：History 詳情仍是 editorial 展開");
assert(css.includes("overflow-x: hidden") && css.includes(".history-detail-sheet"), "CASE K：詳情頁避免橫向溢出");
assert(reviewApi.includes("同一個洞察只說一次"), "AI close prompt 含去重原則");
assert(!app.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE O：沒有 schema migration");
assert(!/UPDATE\s+reviews/i.test(app), "CASE O：沒有批次改舊 reviews");

assert(
  !hasInformationGain(
    ["我很難過努力沒有被看見。"],
    "我發現自己很在意努力有沒有被看見。"
  ),
  "CASE B：③ 不可只是把②換句話說"
);
assert(
  hasInformationGain(
    ["我很難過努力沒有被看見。"],
    "我原本以為自己不需要別人的肯定，但今天發現，我只是習慣自己承受。"
  ),
  "CASE B：有新自我理解時③要留下"
);

const caseA = buildHistoryReading({
  date: "2026-08-27",
  journal: {
    thanksText: "謝謝自己還是有把事情做完",
    event: "我今天做了很多，但努力沒有被看見。",
    mood: "委屈",
    bodyCheck: {
      mood: { flags: ["平靜"], reason: "" },
      body: { flags: [], other: "", reason: "" },
      sleep: { duration: "5–6 小時", quality: "普通", energy: "普通", reason: "" },
    },
    bodyCoach: {
      title: "努力被看見的渴望正在提醒你",
      analysis: "努力被看見的渴望正在提醒你，身體也在說同一件事。",
      notice: "你其實希望努力被看見。",
    },
    insight: {
      guide: {
        rounds: [
          { question: "真正卡住的是什麼？", answer: "努力沒被看見" },
          { question: "這讓你想到什麼？", answer: "我希望被看見" },
          { question: "你看見自己什麼？", answer: "我在意努力有沒有被看見" },
          { question: "還有呢？", answer: "還是同一件事" },
          { question: "最後呢？", answer: "努力沒被看見很難過" },
        ],
        awareness: "我以為自己只要夠相信自己，就可以承受努力沒有被看見。但今天發現，我其實也很渴望重要的人看見我的努力。",
        selfSeen: "我發現自己希望被看見。",
        takeaway: "努力沒被看見沒關係。",
      },
    },
    awarenessResult: {
      line: "努力沒被看見沒關係。",
      seen: "我發現自己希望被看見。",
      gap: "",
    },
    executionChoices: {
      options: [{ id: "e1", text: "主動跟夥伴分享最近正在努力的事情" }],
      selectedIds: ["e1"],
    },
  },
});

assert(caseA.happened.event.includes("努力沒有被看見"), "CASE M：使用者原文仍是 source of truth");
assert(caseA.happened.bodySignals.some((item) => String(item.text).includes("睡眠")), "CASE E：身體訊號可留在①");
assert(!JSON.stringify(caseA.happened).includes("渴望正在提醒你"), "CASE E：① 不放身體覺察心理長文");
assert(caseA.stuck && caseA.stuck.field === "think.awareness", "CASE A：② 用既有核心矛盾欄位");
assert(!caseA.seen, "CASE A：③ 若只是複述②就不要再寫");
assert(caseA.actions.length === 1 && caseA.actions[0].text.includes("分享"), "CASE C：④ 是已選行動");
assert(!/其實你|正在提醒/.test(caseA.actions[0].text), "CASE C：④ 不是心理分析");
assert(caseA.quote && caseA.quote.text.includes("努力"), "CASE D：有一句帶走的話");
assert(caseA.quote.field === "awareness.line" || caseA.quote.field === "think.takeaway", "CASE D：金句用既有欄位，不重產");
assert(caseA.archive.hasGuideRounds === true, "CASE F：五輪原始資料仍在");
assert(caseA.archive.hasDeepProcess === true, "CASE F：深度思考可被展開");

const mainThemeCount = [caseA.stuck && caseA.stuck.text, caseA.seen && caseA.seen.text, caseA.quote && caseA.quote.text]
  .filter(Boolean)
  .filter((text) => /希望被看見|努力沒有被看見|努力沒被看見/.test(text) && compactLen(text) > 24).length;
assert(mainThemeCount <= 2, "CASE A／H：主閱讀流不會 4～5 次重述同一長段");

const caseB = buildHistoryReading({
  journal: {
    event: "努力很多但沒被看見。",
    insight: {
      guide: {
        awareness: "我以為自己只要夠相信自己，就可以承受努力沒有被看見。但今天我發現，我其實也很渴望重要的人看見我的努力。",
        selfSeen: "我不是不需要別人的肯定，而是習慣告訴自己「我自己知道就好」。",
        takeaway: "努力不被看見時最難受，但我值得被看見。",
        rounds: [{ question: "Q1", answer: "A1" }],
      },
    },
  },
});
assert(caseB.stuck && caseB.stuck.text.includes("以為"), "CASE B：② 是矛盾");
assert(caseB.seen && caseB.seen.text.includes("不是不需要"), "CASE B：③ 有資訊增量");
assert(caseB.stuck.field !== caseB.seen.field, "CASE B：②③ 使用不同 field identity");

const caseG = buildHistoryReading({
  journal: {
    thanksText: "舊感謝",
    event: "舊事件，開會很緊。",
    mood: "焦慮",
    awarenessResult: {
      seen: "我發現自己一直在趕，其實是怕自己不夠好。",
      gap: "我表面上在趕進度，真正卡住的是怕證明不了自己。",
      line: "趕不是勤奮，有時是害怕。",
    },
  },
});
assert(caseG.happened.event.includes("舊事件"), "CASE G：舊紀錄事件仍在");
assert(caseG.stuck && caseG.stuck.text.includes("卡住"), "CASE G：沒有新版 summary 時用舊 gap／seen fallback");
assert(caseG.quote && caseG.quote.field === "awareness.line", "CASE G：舊金句仍可讀");
assert(caseG.happened.thanks.includes("舊感謝"), "CASE G：舊感謝仍在");

const caseLegacyDeep = buildHistoryReading({
  thinkHistory: [
    { question: "舊五輪問題", reply: "舊五輪回答", insight: "舊洞察", points: [{ conclusion: "我以為自己不累，但其實身體先停了。" }] },
  ],
  journal: { event: "加班到很晚" },
});
assert(caseLegacyDeep.archive.hasDeepProcess === true, "CASE F／G：legacy thinkHistory 仍可展開");
assert(caseLegacyDeep.stuck && caseLegacyDeep.stuck.text.includes("身體"), "CASE G：舊五輪結論可當② fallback");

const title = getHistoryDailySummary({
  journal: {
    insight: {
      guide: {
        takeaway: "努力不被看見時，我也可以相信自己繼續走",
        selfSeen: "我不是不需要別人的肯定，而是習慣自己承受。",
      },
    },
  },
});
assert(title.title && title.title !== "看看這一天留下的紀錄", "CASE 標題：有完整可讀 title");
assert(!/…$/.test(title.title), "CASE 標題：不是截斷摘要");

assert(app.includes("function renderHistoryDeepThinking"), "CASE F：舊深度 render 函式仍在，資料可讀");
assert(app.includes("historyBodyCheckHtml"), "身體覺察原始 render 仍保留");
assert(app.includes('"awareness.line"') && app.includes('"think.awareness"'), "CASE I／J：field identity 仍在");
assert(app.includes("JOURNAL_FOLD_IDS") && /id="section-thanks"/.test(fs.readFileSync(path.join(root, "index.html"), "utf8")), "CASE N：01～06 DOM 未拆");

console.log("history reading tests passed");
