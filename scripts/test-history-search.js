const fs = require("fs");
const path = require("path");
const {
  pickReview,
  mergeReviewMaps,
  reviewIsFinalized,
  reviewIsHistoryImportant,
} = require("../lib/review-merge");
const {
  buildHistorySearchText,
  historyMatchesQuery,
  historyMatchesTag,
  normalizeHistoryCategory,
  pickPrimaryCategories,
  pickHistoryKeywords,
} = require("../lib/history-summary");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mergeSrc = fs.readFileSync(path.join(root, "lib/review-merge.js"), "utf8");

const sample = {
  date: "2026-08-28",
  completedAt: "2026-08-28T10:00:00.000Z",
  historyRating: 5,
  historyShortTitle: "努力不被看見，也要相信自己",
  rawText: "今天其實很難過",
  journal: {
    thanksText: "謝謝媽媽幫我熱湯",
    event: "工作上很努力，但過程沒有被看見。",
    mood: "委屈",
    dailyReflectionTags: ["自我價值", "被看見", "界線", "工作"],
    bodyCheck: {
      sleep: { duration: "5–6 小時", quality: "普通", energy: "普通" },
    },
    insight: {
      guide: {
        awareness: "我以為自己只要夠相信自己。",
        selfSeen: "我習慣告訴自己我自己知道就好。",
        takeaway: "努力不被看見時最難受，但我值得被看見。",
        rounds: [{ question: "真正卡住的是什麼？", answer: "深度思考裡也提到媽媽的期待。" }],
      },
    },
    awarenessResult: { seen: "我看見自己在等待被肯定", line: "被看見也包括過程" },
    executionChoices: {
      options: [{ id: "e1", text: "明天先完成一件工作上的小任務並說出來" }],
      selectedIds: ["e1"],
    },
    userMarks: { items: [{ start: 0, end: 2, color: "yellow", text: "zzzz-mark" }], updatedAt: "2026-08-28T10:01:00.000Z" },
  },
  organize: { tags: ["成長"], keywords: ["節奏"] },
};

assert(historyMatchesQuery(sample, "努力不被看見"), "CASE A：搜尋 title / short title 可找到");
assert(historyMatchesQuery(sample, "努力"), "CASE A：搜尋 title 片段可找到");
assert(historyMatchesQuery({ journal: { event: "今天和同事開會" }, historyShortTitle: "回到自己的節奏" }, "開會"), "CASE B：搜尋事件正文，即使 title 沒有該詞");
assert(historyMatchesQuery(sample, "熱湯"), "CASE C：搜尋感恩正文可找到");
assert(historyMatchesQuery(sample, "睡眠"), "CASE D：搜尋睡眠文字可找到");
assert(historyMatchesQuery(sample, "5-6"), "CASE D：標點差異仍可搜到睡眠時數");
assert(historyMatchesQuery(sample, "媽媽的期待"), "CASE E：搜尋深度思考可找到");
assert(historyMatchesQuery(sample, "值得被看見"), "CASE F：搜尋帶走的一句話可找到");
assert(historyMatchesQuery(sample, "被看見"), "CASE G：搜尋 AI keyword / 細標籤可找到");
assert(historyMatchesQuery(sample, "節奏"), "CASE G：搜尋 organize keywords 可找到");
assert(!historyMatchesQuery(sample, "沒有這句話"), "CASE H：無關關鍵字找不到");
assert(app.includes("沒有找到相關紀錄。"), "CASE H：empty copy");
assert(app.includes("換個關鍵字試試看。"), "CASE H：empty subtitle");

assert(historyMatchesTag(sample, "自我覺察") === true, "CASE I：自我覺察 filter");
assert(historyMatchesTag(sample, "身心狀態") === true, "CASE J：身心狀態 filter（睡眠）");
assert(historyMatchesTag({ journal: { event: "和伴侶吵架", dailyReflectionTags: ["伴侶"] } }, "人際關係") === true, "CASE K：人際關係 filter");
assert(historyMatchesTag(sample, "感恩") === true, "CASE L：感恩 filter");
assert(historyMatchesTag(sample, "行動力") === true, "CASE M：行動力 filter");
assert(pickPrimaryCategories(sample).length <= 2, "CASE N：列表最多 2 個主分類");
assert(normalizeHistoryCategory("覺察") === "自我覺察", "CASE O：舊 覺察 normalization");
assert(normalizeHistoryCategory("睡眠") === "身心狀態", "CASE O：睡眠 → 身心狀態");
assert(normalizeHistoryCategory("伴侶") === "人際關係", "CASE O：伴侶 → 人際關係");
assert(normalizeHistoryCategory("成長") === "自我覺察", "CASE O：成長 → 自我覺察");
assert(normalizeHistoryCategory("下一步") === "行動力", "CASE O：下一步 → 行動力");
assert(normalizeHistoryCategory("界線") === "", "CASE O：無法安全判斷就不亂 mapping");
assert(sample.journal.dailyReflectionTags[0] === "自我價值", "CASE P：原始 tags 參照未被改寫");
assert(sample.journal.dailyReflectionTags.includes("被看見"), "CASE P：細標籤仍保留");
assert(pickHistoryKeywords(sample).includes("被看見"), "AI keywords 仍可讀");

assert(app.includes("☆ 收藏這天") && app.includes("★ 已收藏"), "CASE Q：History detail 可收藏");
assert(app.includes("function persistArchivedHistoryImportant"), "CASE Q：收藏寫 metadata");
assert(historyMatchesTag(sample, "important") === false, "CASE R：五星但沒收藏，不是重要紀錄");
const saved = { ...sample, historyMeta: { important: true, updatedAt: "2026-08-28T12:00:00.000Z" } };
assert(historyMatchesTag(saved, "important") === true, "CASE R：收藏後重要紀錄能找到");
assert(reviewIsHistoryImportant(saved) === true, "CASE R：reviewIsHistoryImportant");
assert(historyMatchesTag({ ...saved, historyMeta: { important: false, updatedAt: "2026-08-28T13:00:00.000Z" } }, "important") === false, "CASE S：取消收藏後消失");
assert(historyMatchesTag(saved, "important") && historyMatchesQuery(saved, "工作"), "CASE T：搜尋 + 重要紀錄可同時成立");

const reloaded = pickReview(null, saved);
assert(reloaded.historyMeta && reloaded.historyMeta.important === true, "CASE U：reload 保留收藏");
assert(reloaded.historyRating === 5, "CASE U：rating 不被收藏覆蓋");

const hydrated = mergeReviewMaps(
  { "2026-08-28": { date: "2026-08-28", completedAt: sample.completedAt, journal: { event: "draft" }, historyRating: 5 } },
  { "2026-08-28": saved }
);
assert(hydrated["2026-08-28"].historyMeta.important === true, "CASE V：cloud hydrate 保留收藏");
assert(hydrated["2026-08-28"].completedAt === sample.completedAt, "CASE V：completedAt 不被收藏改寫");

const unfav = mergeReviewMaps(
  { "2026-08-28": saved },
  {
    "2026-08-28": {
      ...saved,
      historyMeta: { important: false, updatedAt: "2026-08-28T18:00:00.000Z" },
      updatedAt: "2026-08-28T18:00:00.000Z",
    },
  }
);
assert(unfav["2026-08-28"].historyMeta.important === false, "CASE V：較新的取消收藏勝出");

assert(app.includes("rejectArchivedJournalWrite") && app.includes("applyJournalArchiveLock"), "CASE W：archived 正文仍不可改");
assert(app.includes("persistArchivedUserMarks") && app.includes("persistArchivedHistoryImportant"), "CASE W／X：收藏與 userMarks 分開寫入");
assert(app.includes("renderCombinedHighlightedText"), "CASE X／Y：combined highlight renderer");
assert(app.includes('"① 今天發生了什麼"') && app.includes('"⑤ 今日帶走的一句話"'), "CASE Z：五層摘要標題仍在");
assert(app.includes("查看當天完整紀錄"), "CASE AA：完整紀錄入口仍在");
assert(/function reviewIsComplete\(review\) \{\s*return reviewIsFinalized\(review\);/.test(app), "CASE AB／AC：draft 不進 History");
assert(reviewIsFinalized({ journal: { event: "draft" } }) === false, "CASE AB：draft 未完成");
assert(reviewIsFinalized(sample) === true, "CASE AC：completed 才算完成");
assert(!/streak[\s\S]{0,200}historyMeta/.test(app), "CASE AD：streak 不讀收藏");
assert(!/reviewIsComplete[\s\S]{0,80}historyMeta/.test(app), "CASE AD：完成判定不讀收藏");

assert(css.includes("overflow-x: hidden") && css.includes(".history-detail-sheet"), "CASE AE：詳情避免橫向溢出");
assert(css.includes(".history-toolbar") && /#historyTags|chips/.test(css + html), "CASE AF：desktop toolbar 仍在");
assert(/\.history-toolbar\s*\{[^}]*position:\s*static/.test(css), "CASE AG：搜尋／filter 非 sticky");
assert(!/#page-history[\s\S]{0,400}position:\s*sticky/.test(css), "CASE AG：history 頁首不 sticky");
assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE") && !mergeSrc.includes("ALTER TABLE"), "CASE AH：無 schema");

const hay = buildHistorySearchText(sample);
assert(!hay.includes("zzzz-mark"), "搜尋不吃 userMarks 正文");
assert(!/<mark|<span/.test(hay), "搜尋來源不是 HTML");
assert(app.includes("historyMatchesQuery(review, query)"), "列表搜尋走 historyMatchesQuery");
assert(!/JSON\.stringify\(review\.journal\)/.test(app.slice(app.indexOf("function renderHistory"), app.indexOf("function renderHistoryDetail"))), "列表搜尋不再 stringify journal");

console.log("history search / important tests passed");
