const fs = require("fs");
const path = require("path");
const {
  pickReview,
  mergeReviewMaps,
  reviewIsFinalized,
  normalizeHistoryRating,
} = require("../lib/review-merge");
const {
  getHistoryDailySummary,
  buildHistoryDisplayTitle,
  buildHistoryListTitle,
  normalizeHistoryCategory,
  pickPrimaryCategories,
  pickHistoryKeywords,
  historyMatchesTag,
  FALLBACK_TITLE,
} = require("../lib/history-summary");
const { buildHistoryReading, hasInformationGain } = require("../lib/history-reading");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const mergeSrc = fs.readFileSync(path.join(root, "lib/review-merge.js"), "utf8");
const reviewApi = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

const completed = {
  date: "2026-08-28",
  completedAt: "2026-08-28T10:00:00.000Z",
  historyRating: 4,
  historyShortTitle: "努力不被看見，也要相信自己能走到",
  journal: {
    thanksText: "謝謝自己沒有放棄",
    event: "今天做了很多，但努力沒有被看見。",
    mood: "委屈",
    dailyReflectionTags: ["自我價值", "被看見", "界線"],
    insight: {
      guide: {
        awareness: "我以為自己只要夠相信自己，就可以承受努力不被看見。但今天發現，我其實也很渴望重要的人看見我的努力。",
        selfSeen: "我不是不需要別人的肯定，而是習慣告訴自己「我自己知道就好」。",
        takeaway: "努力不被看見時最難受，但我值得被看見——不只是結果，還有過程中的我。",
      },
    },
    executionChoices: {
      options: [{ id: "e1", text: "主動跟夥伴分享最近正在努力的事情" }],
      selectedIds: ["e1"],
    },
  },
};

assert(html.includes("data-history-rating=\"1\"") && html.includes("data-history-rating=\"5\""), "CASE A：modal 可選 1～5 星");
assert(html.includes("這一天，你想留幾顆星給未來的自己？"), "CASE A：重要程度文案");
assert(app.includes("historyRating") && app.includes("setPendingHistoryRating"), "CASE A：完成流程寫入 rating");
assert(app.includes("historyRating,") || app.includes("historyRating:"), "CASE B：rating 存進 review JSON");
assert(normalizeHistoryRating(4) === 4 && normalizeHistoryRating(0) === 0 && normalizeHistoryRating("x") === 0, "CASE B：rating 只接受 1～5");

const reloaded = pickReview(null, completed);
assert(reloaded.historyRating === 4, "CASE C：reload 後 rating 保留");
assert(reloaded.historyShortTitle.includes("努力不被看見"), "CASE C：short title 保留");

const hydrated = mergeReviewMaps(
  { "2026-08-28": { date: "2026-08-28", journal: { event: "draft" } } },
  { "2026-08-28": completed }
);
assert(hydrated["2026-08-28"].historyRating === 4, "CASE D：cloud hydrate 後 rating 保留");
assert(hydrated["2026-08-28"].completedAt === completed.completedAt, "CASE D：completedAt 不被 rating 影響");

const legacy = { date: "2026-08-01", completedAt: "2026-08-01T01:00:00.000Z", journal: { event: "舊資料", thanksText: "謝謝" } };
assert(normalizeHistoryRating(legacy.historyRating) === 0, "CASE E：舊資料沒有 rating 不報錯");
const summaryLegacy = getHistoryDailySummary(legacy);
assert(summaryLegacy.rating === 0, "CASE E：summary rating 為 0");
assert(!Object.prototype.hasOwnProperty.call(pickReview(null, legacy), "historyRating") || !pickReview(null, legacy).historyRating, "CASE F：舊資料不會被亂補 rating");
const mergedLegacy = pickReview(legacy, { journal: { userMarks: { items: [] } } });
assert(!mergedLegacy.historyRating, "CASE F：merge 不會發明 rating");

const summary = getHistoryDailySummary(completed);
assert(summary.tags.length <= 2, "CASE G：列表最多 2 個主分類");
assert(summary.tags.every((tag) => ["自我覺察", "身心狀態", "人際關係", "感恩", "行動力"].includes(tag)), "CASE G：只顯示主分類");
assert(normalizeHistoryCategory("覺察") === "自我覺察", "CASE H：舊 覺察 mapping 到自我覺察");
assert(normalizeHistoryCategory("自我價值") === "自我覺察", "CASE H：自我價值 mapping");
assert(completed.journal.dailyReflectionTags.includes("被看見"), "CASE H：原始 tags 未改寫");
assert(pickHistoryKeywords(completed).includes("被看見"), "CASE H：細標籤保留在 keywords");

const fullQuote = buildHistoryDisplayTitle(completed);
const listTitle = buildHistoryListTitle(completed);
assert(listTitle === "努力不被看見，也要相信自己能走到", "CASE I：列表用 short title");
assert(fullQuote.includes("值得被看見"), "CASE I：完整核心句仍在 display title");
assert(listTitle !== fullQuote, "CASE I：short title 不覆蓋完整核心句");

const reading = buildHistoryReading(completed);
assert(reading.happened.event.includes("努力沒有被看見"), "CASE J：① 原始事件");
assert(reading.happened.thanks.length, "CASE J：① 感恩");
assert(reading.stuck && reading.stuck.text.includes("以為"), "CASE J：② 核心矛盾");
assert(reading.seen && reading.seen.text.includes("不是不需要"), "CASE J：③ 新洞察");
assert(reading.actions.length === 1, "CASE J：④ 使用 06 行動");
assert(reading.quote && reading.quote.text.includes("值得被看見"), "CASE J：⑤ 完整一句話");
assert(app.includes('"① 今天發生了什麼"') && app.includes('"⑤ 今日帶走的一句話"'), "CASE J：五層標題在 renderer");

assert(reviewApi.includes("禁止同一個洞察在 awareness / selfSeen / takeaway"), "CASE K：close prompt 禁止 ②③⑤ 重複");
assert(
  !hasInformationGain([reading.stuck.text], "我發現自己需要被看見。"),
  "CASE K：③ 不可只是複述②"
);

assert(app.includes("rejectArchivedJournalWrite") && app.includes("applyJournalArchiveLock"), "CASE L：完成後正文不可改");
assert(app.includes("isArchivedJournalReadTarget") && css.includes("#page-today.is-archived .journal-fold__toggle"), "CASE M：archived accordion 仍可展開");
assert(app.includes("persistArchivedUserMarks"), "CASE N：完成後 userMarks 仍可存");
assert(app.includes("renderCombinedHighlightedText"), "CASE O／P：combined highlight renderer");
assert(app.includes("function markableP"), "CASE Q：field identity 仍走 markableP");

const legacyDeep = buildHistoryReading({
  thinkHistory: [{ insight: "舊洞察", points: [{ conclusion: "我以為自己不累，但其實身體先停了。" }] }],
  journal: { event: "加班" },
});
assert(legacyDeep.archive.hasDeepProcess, "CASE R：舊 thinkHistory 仍可讀");
assert(legacyDeep.stuck, "CASE R：舊結論可當②");

assert(app.includes(".filter(([, review]) => reviewIsComplete(review))"), "CASE S／T：History 只列 completed");
assert(/function reviewIsComplete\(review\) \{\s*return reviewIsFinalized\(review\);/.test(app), "CASE S／T：draft 不進 History");
assert(!/reviewIsComplete[\s\S]{0,80}historyRating/.test(app), "CASE U：完成判定不讀 rating");
assert(!/streak[\s\S]{0,200}historyRating/.test(app), "CASE U：streak 不讀 rating");

assert(css.includes("overflow-x: hidden") && css.includes(".history-card__title"), "CASE V：列表可換行");
assert(css.includes("overflow-wrap") && css.includes(".history-card__cats"), "CASE V：分類可換行");
assert(css.includes("@media (min-width: 720px)"), "CASE W：desktop title 樣式");
assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE") && !mergeSrc.includes("ALTER TABLE"), "CASE X：無 schema");
assert(html.includes("lib/review-merge.js?v=23") && html.includes("lib/history-summary.js?v=9") && html.includes("lib/history-reading.js?v=8"), "cache 升版");
assert(app.includes("查看當天完整紀錄") && app.includes("historyArchiveTextIsRedundant"), "歷史詳情有分層完整紀錄入口");
assert(app.includes("history-card__cats") && !/historyListStars[\s\S]{0,200}themeStars/.test(app), "列表星星不再用 AI themeStars");
assert(historyMatchesTag(completed, "important") === false, "重要紀錄不再用 rating>=4");
assert(
  historyMatchesTag({ ...completed, historyMeta: { important: true, updatedAt: "2026-08-28T12:00:00.000Z" } }, "important") === true,
  "historyMeta.important 才是收藏"
);
assert(historyMatchesTag({ historyRating: 3, journal: { event: "x" } }, "important") === false, "3 星不是重要紀錄");
assert(historyMatchesTag(completed, "自我覺察") === true, "舊自我價值可被自我覺察篩到");
assert(reviewIsFinalized(completed), "finalized 不受 rating 改變");
assert(reviewIsFinalized({ journal: { event: "draft" } }) === false, "draft 仍未完成");

const oldTags = ["自我價值", "被看見"];
const mapped = pickPrimaryCategories({ journal: { dailyReflectionTags: oldTags, event: "開會", insight: { guide: { takeaway: "我開始看見自己" } } } });
assert(mapped.length <= 2 && mapped.includes("自我覺察"), "mapping 不破壞原始陣列");
assert(oldTags[0] === "自我價值", "原始 tags 參照未被改寫");

console.log("history archive tests passed");
