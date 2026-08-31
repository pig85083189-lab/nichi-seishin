const fs = require("fs");
const path = require("path");
const { pickReview, reviewIsFinalized, mergeReviewMaps } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const merge = fs.readFileSync(path.join(root, "lib/review-merge.js"), "utf8");

assert(!html.includes("id=\"btnSaveDraft\""), "CASE P：沒有儲存草稿按鈕");
assert(!html.includes(">儲存草稿<"), "CASE P：沒有儲存草稿文案");
assert(html.includes("id=\"btnCompleteToday\""), "CASE H：完成今日復盤 CTA 仍在");
assert(html.includes("完成今天的復盤？"), "CASE H：confirm 主文");
assert(html.includes("完成後會收進歷史紀錄，今天的內容將無法再修改。"), "CASE H：confirm 副文");
assert(html.includes("再檢查看看"), "CASE I：再檢查看看");
assert(html.includes("確認完成"), "CASE J：確認完成");
assert(html.includes("id=\"completeConfirmModal\""), "CASE H：confirm 用 App modal");
assert(html.includes("這一天，你想留幾顆星給未來的自己？"), "完成 modal 有重要程度");
assert(html.includes("data-history-rating=\"5\""), "可選 1～5 星");
assert(!/function completeToday[\s\S]{0,800}window\.confirm/.test(app), "CASE H：完成流程不用原生 confirm");
assert(html.includes("✓ 今天的復盤完成了。"), "CASE Q：完成主文");
assert(html.includes("看見自己，也留下明天真正做得到的一步。"), "CASE Q：完成副文");
assert(html.includes("id=\"journalFooterComplete\""), "CASE O：完成 section 獨立");
assert(html.includes("id=\"journalAutosaveHint\""), "autosave hint 存在");
assert(html.includes("已自動儲存"), "autosave 文案");
assert(app.includes("scheduleJournalAutosave"), "CASE B：debounce autosave");
assert(app.includes("persistJournalNow"), "discrete persist");
assert(app.includes("flushJournalAutosave"), "離開前 flush pending autosave");
assert(app.includes("applyJournalArchiveLock"), "CASE K：完成後 lock");
assert(app.includes("is-archived"), "CASE K：archived class");
assert(app.includes("persistArchivedUserMarks"), "CASE M：完成後仍可存 userMarks");
assert(app.includes("rejectArchivedJournalWrite"), "CASE L：禁止重新 AI");
assert(app.includes("function reviewIsFinalized"), "completion field helper");
assert(/completedAt:\s*new Date\(\)\.toISOString\(\)/.test(app), "CASE J：完成寫入 completedAt");
assert(/function reviewIsComplete\(review\) \{\s*return reviewIsFinalized\(review\);/.test(app), "stats/history 走 finalized");
assert(app.includes(".filter(([, review]) => reviewIsComplete(review))"), "History / stats 仍用 reviewIsComplete");
assert(merge.includes("function pickCompletedProtected"), "CASE W：merge 保護 completed");
assert(merge.includes("function reviewIsFinalized"), "merge 可判斷 finalized");
assert(html.includes("mode-guide--hint"), "怎麼選弱化 class");
assert(css.includes(".mode-guide--hint"), "怎麼選弱化 CSS");
const modeGuide = html.slice(html.indexOf("id=\"modeGuideTitle\""), html.indexOf("id=\"modeGuidePanel\"") + 1800);
assert(modeGuide.includes("今天適合哪一種復盤？"), "怎麼選標題：今天適合哪一種");
assert(modeGuide.includes("不知道怎麼選？看看兩種方式的差別。"), "怎麼選副標");
assert(modeGuide.includes("輕鬆・快速・每天都能做"), "快速復盤 tag");
assert(modeGuide.includes("時間不多，或今天只想簡單整理一下自己。"), "快速復盤 when");
assert(modeGuide.includes("記下今天值得感謝的事"), "快速復盤點 1");
assert(modeGuide.includes("開始快速復盤 →"), "快速復盤 CTA");
assert(modeGuide.includes("深入覺察・看見自己・找到下一步"), "深度復盤 tag");
assert(modeGuide.includes("今天有件事一直放在心上，或想更深入看看自己真正卡在哪裡。"), "深度復盤 when");
assert(modeGuide.includes("一步步看見情緒背後真正的卡點"), "深度復盤點 2");
assert(modeGuide.includes("開始深度復盤 →"), "深度復盤 CTA");
assert(!modeGuide.includes("靈魂對話"), "深度復盤不再寫靈魂對話");
assert(!modeGuide.includes("AI") && !modeGuide.includes("人工智慧"), "怎麼選卡片不出現 AI 字樣");
assert(modeGuide.includes("data-journal-mode=\"quick\"") && modeGuide.includes("data-journal-mode=\"deep\""), "卡片 data-journal-mode 未改");
assert(html.includes("id=\"modeGuidePanel\""), "指南展開仍在");
assert(html.includes("id=\"section-thanks\"") && html.includes("id=\"section-exec\""), "CASE Z：01～06 仍在");
assert(app.includes("可以選 1～3 件"), "CASE AA：06 多選");
assert(app.includes("NichiTaskSidebar") && html.includes("lib/task-sidebar.js"), "CASE AB：Sidebar 執行力");
assert(css.includes("complete-confirm-actions"), "CASE AC：confirm 按鈕排版");
assert(!app.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE AE：無 schema");
assert(!html.includes("billing") || app.includes("function trackProduct"), "CASE AF：billing 路徑未當這次主改");
assert(html.includes("app.js?v=276"), "cache app.js v=267");
  assert(html.includes("app.css?v=231"), "cache app.css v=228");
  assert(html.includes("lib/review-merge.js?v=25"), "cache review-merge v=22");

assert(reviewIsFinalized({ completedAt: "2026-08-01T10:00:00.000Z" }) === true, "CASE X：有 completedAt 即完成");
assert(reviewIsFinalized({ organize: { themeTitle: "舊整理" } }) === true, "CASE X：舊 organize 視為完成");
assert(reviewIsFinalized({ journal: { thanksText: "謝謝", event: "開會" } }) === false, "CASE F：草稿不算完成");
assert(reviewIsFinalized({ rawText: "寫了一點" }) === false, "CASE A：僅文字不算完成");
assert(reviewIsFinalized({}) === false, "空 review 不是完成");

const draft = {
  date: "2026-08-28",
  journal: { thanksText: "裝置A感謝", event: "寫到04" },
  updatedAt: "2026-08-28T12:00:00.000Z",
};
const completed = {
  date: "2026-08-28",
  journal: { thanksText: "封存感謝", event: "完成內容", mood: "平靜" },
  completedAt: "2026-08-28T11:00:00.000Z",
  updatedAt: "2026-08-28T11:00:00.000Z",
};
const overwritten = pickReview(completed, { ...draft, updatedAt: "2026-08-28T13:00:00.000Z" });
assert(overwritten.completedAt === completed.completedAt, "CASE W：draft 不可清掉 completedAt");
assert(overwritten.journal.thanksText === "封存感謝", "CASE W：舊 draft 不可覆蓋 completed 正文");
assert(overwritten.journal.event === "完成內容", "CASE V：completed journal 優先");

const staleAutosave = pickReview(completed, {
  ...completed,
  journal: { thanksText: "過期裝置又改了", event: "不該留下" },
  updatedAt: "2026-08-28T18:00:00.000Z",
});
assert(staleAutosave.journal.thanksText === "封存感謝", "CASE W：同 completedAt 的晚到 draft 不可改正文");

const marksOnCompleted = pickReview(completed, {
  completedAt: completed.completedAt,
  updatedAt: "2026-08-28T15:00:00.000Z",
  journal: {
    thanksText: "不該覆蓋",
    userMarks: { items: [{ id: "m1", field: "event", start: 0, end: 2, text: "完成", color: "tea" }], updatedAt: "2026-08-28T15:00:00.000Z" },
  },
});
assert(marksOnCompleted.journal.thanksText === "封存感謝", "CASE M：marks 更新不改正文");
assert(marksOnCompleted.journal.userMarks.items[0].id === "m1", "CASE M：完成後 userMarks 仍可合併");

const maps = mergeReviewMaps({ "2026-08-28": draft }, { "2026-08-28": completed });
assert(reviewIsFinalized(maps["2026-08-28"]), "CASE U/V：跨裝置 merge 後是 completed");
assert(maps["2026-08-28"].journal.event === "完成內容", "CASE V：合併後讀 completed 內容");

assert(app.includes("renderCombinedHighlightedText"), "CASE N：AI highlight 仍在");
assert(app.includes("userMarkBag") && html.includes("id=\"userMarkBar\""), "CASE M：userMark UI 仍在");
assert(css.includes("#page-today.is-archived [data-user-mark-field]"), "CASE M：lock 不擋 markable 文字");
assert(app.includes("scheduleJournalAutosave.timer = setTimeout"), "debounce timer");
assert(app.includes(", 900)"), "autosave debounce 900ms");
assert(html.includes("data-journal-mode=\"quick\"") && html.includes("data-journal-mode=\"deep\""), "CASE 二十二：兩種模式仍在");
assert(app.includes("完成快速復盤") && app.includes("完成今日復盤"), "快速／深度完成 CTA 文案仍在");

const clickFnStart = app.indexOf("function handleTodayPointerClick");
const clickFnEnd = app.indexOf("\nfunction ", clickFnStart + 10);
const clickFn = app.slice(clickFnStart, clickFnEnd > clickFnStart ? clickFnEnd : clickFnStart + 4000);
const foldToggleAt = clickFn.indexOf("toggleJournalFold(");
const archivedWriteAt = clickFn.indexOf("isArchivedJournalWriteTarget");
assert(foldToggleAt > 0, "CASE B：click handler 仍走 accordion toggle");
assert(archivedWriteAt > 0 && foldToggleAt < archivedWriteAt, "completed + archived ≠ accordion disabled：fold 在 write guard 之前");
assert(app.includes("function isArchivedJournalReadTarget"), "閱讀型互動獨立判斷");
assert(app.includes("function isArchivedJournalWriteTarget"), "寫入型互動獨立判斷");
assert(!/function toggleJournalFold\([\s\S]{0,180}rejectArchivedJournalWrite/.test(app), "toggleJournalFold 不被 write guard 擋住");
assert(!/function toggleJournalFold\([\s\S]{0,180}isCurrentJournalArchived/.test(app), "toggleJournalFold 不檢查 archived");
const noneStart = css.indexOf("#page-today.is-archived .mood-btn");
const noneEnd = css.indexOf("#page-today.is-archived .journal-fold__toggle");
const noneBlock = noneStart >= 0 && noneEnd > noneStart ? css.slice(noneStart, noneEnd) : "";
assert(noneBlock.includes("pointer-events: none"), "archived 仍鎖 write controls");
assert(!noneBlock.includes(".journal-fold__toggle"), "archived pointer-events none 不套 accordion trigger");
assert(!noneBlock.includes(".journal-fold {"), "archived 不整張 card pointer-events none");
assert(css.includes("#page-today.is-archived .journal-fold__toggle"), "archived accordion 明確可點");
assert(html.includes('data-journal-fold') && html.includes("id=\"section-thanks\"") && html.includes("id=\"section-exec\""), "CASE A：01～06 fold trigger 仍在");
assert(app.includes("function eventTargetElement"), "fold click 可從 text node 找到 header");
assert(!clickFn.includes("if (!pointerOk && !keyboardOk) return true;"), "iOS／LINE：header click 不再要求 pointerdown");
assert(clickFn.includes("toggleJournalFold(root.id)"), "header／chevron click 直接 toggle");
assert(app.includes('if (saved == null) return { open: "section-thanks" }'), "新帳號沒有 fold prefs 時預設展開 01");
assert(css.includes("touch-action: manipulation"), "accordion header 避免 iOS 點擊延遲");
assert(css.includes("min-height: min-content"), "open 時 inner 不被 Safari 0fr 算成 0 高");
assert(app.includes("renderCombinedHighlightedText") && app.includes("userMarkBag"), "highlight 路徑未因 fold fix 改掉");
assert(app.includes("bindCloudLiveSync"), "cloud sync 初始化仍在");

console.log("journal complete / autosave tests passed");
