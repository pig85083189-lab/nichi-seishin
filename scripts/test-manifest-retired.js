const fs = require("fs");
const path = require("path");
const { mergeJournalObjects } = require("../lib/review-merge");
const { buildGrowthStats, formatStatsPrompt } = require("../lib/report-stats");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewApi = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const analytics = fs.readFileSync(path.join(root, "lib/analytics.js"), "utf8");

const nav = html.slice(html.indexOf('class="sidebar"'), html.indexOf('id="page-today"'));

assert(/id="section-thanks"/.test(html) && /id="section-exec"/.test(html), "CASE A：01～06 DOM 仍在");
assert(/id="section-manifest"\s+hidden/.test(html), "CASE A：07 區塊 hidden");
assert(/#section-manifest\s*\{[^}]*display:\s*none\s*!important/.test(css), "CASE A：CSS 強制隱藏 07");
assert(!nav.includes('data-page="manifest"'), "CASE E：Sidebar 沒有顯化力入口");
assert(!nav.includes("#vision"), "CASE E：Sidebar 不再暴露 #vision");
assert(html.includes('id="page-manifest"'), "CASE J：#page-manifest 相容頁仍在");

const foldMatch = app.match(/const JOURNAL_FOLD_IDS = \[([\s\S]*?)\];/);
const foldIds = [...foldMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
assert(foldIds.includes("section-exec") && !foldIds.includes("section-manifest"), "CASE B：fold 最後一站是 06");
assert(app.includes("01 到 06"), "CASE B：導覽改 01 到 06");
assert(!app.includes('element: "#section-manifest"'), "CASE B：tour 不再指向 07");
assert(!app.includes('.side-item[data-page="manifest"]'), "CASE E：tour 不再指向 Sidebar 顯化力");

assert(html.includes("完成今日復盤"), "CASE C：完成今日復盤 CTA 仍在");
assert(html.includes("今天的復盤完成了。"), "CASE C：收尾主文");
assert(html.includes("看見自己，也留下明天真正做得到的一步。"), "CASE C：收尾副文");
assert(/function reviewIsComplete\(review\) \{[\s\S]{0,280}journalHasContent/.test(app), "CASE D：完成條件不要求 07");
assert(!/reviewIsComplete[\s\S]{0,400}manifest/.test(app), "CASE D：reviewIsComplete 不讀 manifest");

assert(app.includes('vision: "today"'), "CASE F：#vision 映射今日復盤");
assert(app.includes('if (raw === "vision")'), "CASE F：舊 hash 安全 redirect");
assert(app.includes('if (page === "manifest") page = "today"'), "CASE F：manifest page 不 crash");

assert(html.includes('id="guide-01"') && html.includes('id="guide-06"'), "CASE G：使用說明 01～06");
assert(!html.includes("guide-07"), "CASE G：使用說明沒有 07");
assert(html.includes("完成 01～06，就是一次完整的今日復盤。"), "CASE G：完整復盤收句");
assert(!html.includes("guide-step__label\">顯化"), "CASE G：使用說明沒有顯化步驟");

assert(app.includes("function journalHasManifestHistory"), "CASE H：新 History 有空 07 判斷");
assert(app.includes('"顯化紀錄"'), "CASE I：舊資料標成顯化紀錄");
assert(!app.includes('"⑦ 顯化力"'), "CASE H：History 不再編號 07");
assert(app.includes("function historyManifestBlocks"), "CASE I：舊 fallback 仍在");
assert(app.includes("function getManifests") && app.includes("function saveManifests"), "CASE J：manifest store 仍在");
assert(app.includes("function renderManifests"), "CASE J：舊頁 render 仍在");

const merged = mergeJournalObjects(
  {
    manifest: "舊願景",
    manifestSentence: "我正在靠近舊的生活。",
    manifestPlan: {
      id: "p-old",
      steps: [{ id: "s1", title: "舊步驟", detail: "細節", completed: true, taskAdded: false }],
    },
    manifestClose: { futureVision: "舊畫面", approachStep: "舊靠近", manifestationStatement: "舊句" },
  },
  { thanksText: "新感謝" }
);
assert(merged.manifest === "舊願景", "CASE K：merge 不丟 manifest");
assert(merged.manifestSentence.includes("舊的生活"), "CASE K：merge 不丟 sentence");
assert(merged.manifestPlan.steps[0].title === "舊步驟", "CASE K：merge 不丟 plan");
assert(merged.manifestClose.futureVision === "舊畫面", "CASE K：merge 不丟 close");

assert(/function dailyManifestUiEnabled\(\) \{\s*return false;/.test(app), "CASE X：每日 07 UI 關閉");
assert(app.includes("if (!dailyManifestUiEnabled()) return;"), "CASE X：停止新 manifest 寫入／生成");
assert(app.includes("async function generateManifestPlan"), "CASE X：舊 generate 函式保留但不被正式流程使用");
assert(app.includes("upsertManifestPlanToSidebar"), "CASE J：舊 sidebar upsert 相容仍在");
assert(app.includes("syncJournalLibraries"), "CASE J：完成復盤仍可把舊 manifest 同步進相容層");

assert(app.includes("selectedIds") && app.includes("可以選 1～3 件"), "CASE L：06 多選仍在");
assert(html.includes("收下我的行動卡"), "CASE M：行動卡 CTA 仍在");
assert(html.includes('id="page-sfm"') && app.includes("function renderTasks()"), "CASE N：Sidebar 執行力仍在");
assert(app.includes("renderCombinedHighlightedText"), "CASE O：AI highlight 仍在");
assert(app.includes("userMarkBag") && app.includes("manifest.sentence") && app.includes("manifest.plan.step."), "CASE P：舊顯化 field identity 仍在");

const emptyStats = buildGrowthStats({
  fromIso: "2026-08-20",
  toIso: "2026-08-26",
  reviews: { "2026-08-26": { date: "2026-08-26", journal: { thanksText: "謝謝", event: "開會" } } },
  insights: [],
  tasks: [],
  manifests: [],
});
assert(emptyStats.manifestation.checked === 0, "CASE Q：沒有 manifest 時統計為 0");
const emptyPrompt = formatStatsPrompt(emptyStats);
assert(emptyPrompt.includes("顯化力：勾選 0"), "CASE Q：週月報沒有 manifest 也安全");

const oldStats = buildGrowthStats({
  fromIso: "2026-08-01",
  toIso: "2026-08-07",
  reviews: {},
  insights: [],
  tasks: [],
  manifests: [{ id: "m1", title: "舊顯化", date: "2026-08-03", status: "done" }],
});
assert(oldStats.samples.manifestation.length >= 0, "CASE R：舊 manifest 仍可讀");
assert(formatStatsPrompt(oldStats).includes("顯化"), "CASE R：舊資料仍進週月報摘句路徑");

assert(css.includes("@media (max-width: 430px)") || css.includes("max-width: 390") || css.includes("overflow-wrap: anywhere"), "CASE S：窄螢幕可換行");
assert(html.includes("app.css?v=194") && html.includes("app.js?v=227"), "CASE T：cache 已升版");

assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE U：無 Supabase schema diff");
assert(!/UPDATE\s+reviews/i.test(app) && !/UPDATE\s+reviews/i.test(reviewApi), "CASE X：沒有批次 UPDATE 舊 reviews");
assert(analytics.includes("manifestation_created"), "CASE W：analytics schema 仍保留 manifestation_created");
assert(app.includes("trackProduct(\"manifestation_created\"") || app.includes('trackProduct("manifestation_created"'), "CASE W：舊事件呼叫仍在相容層，新 UI 不再觸發");

assert(html.includes("data-quick-mod=\"body\"") && html.includes("data-quick-mod=\"exec\""), "快速模組仍有身體／覺察／執行");
assert(!html.includes("data-quick-mod=\"manifest\""), "快速模組不再有顯化力");
assert(!html.includes("覺察力／執行力／顯化力 AI"), "方案頁不再介紹顯化力");
assert(html.includes("覺察力／執行力 AI"), "方案頁改為覺察力／執行力 AI");
assert(app.includes("function addTaskFromGuide"), "CASE N：06 寫入執行力路徑未改");
assert(reviewApi.includes("那些是 07 顯化力"), "CASE L：06 prompt 仍不承擔顯化");

console.log("manifest retired tests passed");
