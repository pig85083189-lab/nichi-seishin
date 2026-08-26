const fs = require("fs");
const path = require("path");
const { mergeJournalObjects } = require("../lib/review-merge");
const {
  MANIFEST_PLAN_SYSTEM,
  MANIFEST_CLOSE_SYSTEM,
  MANIFEST_PROMPTS_SYSTEM,
  normalizeManifestPlanSteps,
  normalizeManifestClose,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const section = html.slice(html.indexOf('id="section-manifest"'), html.indexOf('id="section-quick-insight"'));

assert(section.includes("我想顯化的是"), "CASE A：07 標題是我想顯化的是");
assert(section.includes("幫我拆成可以做到的步驟"), "CASE A：CTA");
assert(section.includes("id=\"manifestVision\""), "CASE A：保留 textarea");
assert(section.includes("manifest-feel\" hidden") || section.includes("manifest-feel") && section.includes("hidden"), "不再顯示問句輸入");
assert(!section.includes("看見我正在靠近的未來"), "不再用 close CTA");

assert(MANIFEST_PLAN_SYSTEM.includes("不要再問問題") || MANIFEST_PLAN_SYSTEM.includes("不要問問題"), "CASE A：AI 不再問問題");
assert(MANIFEST_PLAN_SYSTEM.includes("3 到 6"), "CASE B：3～6 步");
assert(MANIFEST_PLAN_SYSTEM.includes("不要輸出 futureVision") || MANIFEST_PLAN_SYSTEM.includes("不要生成思考題"), "CASE A：AI 不走舊 close 輸出");
assert(!/"futureVision"/.test(MANIFEST_PLAN_SYSTEM), "JSON 不輸出 futureVision");
assert(!/"manifestationStatement"/.test(MANIFEST_PLAN_SYSTEM), "JSON 不輸出顯化句");
assert(MANIFEST_PLAN_SYSTEM.includes("executionChoices"), "明確不要複製 06");

const steps = normalizeManifestPlanSteps(
  {
    steps: [
      { title: "先看清楚現在的收入結構", detail: "整理目前每個服務／產品的客單價、成交數與月營收。" },
      { title: "算出 30 萬需要多少成交", detail: "把目標拆成每月需要的客數、產品數或方案數。" },
      { title: "找出最值得放大的收入來源", detail: "選出目前成交率與利潤較好的 1～2 個主力項目。" },
      { title: "建立固定曝光與成交節奏", detail: "安排每週固定內容、引流與銷售行動。" },
    ],
  },
  "我想讓自己的事業每個月穩定收入 30 萬。"
);
assert(steps.length >= 3 && steps.length <= 6, `CASE B：steps 應 3～6，實際 ${steps.length}`);
assert(steps[0].title.includes("收入結構"), "CASE A：依真實目標拆步");

const partial = normalizeManifestPlanSteps({ steps: [{ title: "只做第一步", detail: "寫下現況。" }] }, "想更健康");
assert(partial.length >= 3, "缺步時用 fallback 補到至少 3");

assert(app.includes("toggleManifestPlanStep"), "CASE C：可單獨勾完成");
assert(app.includes("completed: Boolean"), "CASE D：completed 寫入 state");
assert(app.includes("manifestPlan: normalizeManifestPlan"), "CASE D：collect 會存 plan");
assert(css.includes("text-decoration: line-through"), "CASE E：完成 title 刪除線");
assert(css.includes(".manifest-step.is-done .manifest-step__detail"), "CASE F：detail 只淡化");
assert(css.includes("text-decoration: none"), "CASE F：detail 不刪除線");

assert(app.includes("addManifestStepToExec"), "CASE G：單步放進執行力");
assert(app.includes('source: "顯化力"'), "CASE G：source 顯化力");
assert(app.includes("manifest:${iso"), "CASE H：穩定 sourceKey");
assert(app.includes("manifestStepTaskExists"), "CASE H：不可重複加入");
assert(app.includes("data-manifest-step-exec"), "CASE I：每一步獨立 CTA");
assert(app.includes("addTaskFromGuide"), "CASE J：沿用既有 task 寫入");
assert(!/function renderTasks\(/.test(app.replace("function renderTasks()", "")) || app.includes("function renderTasks()"), "CASE R：renderTasks 仍在");

assert(app.includes("lib-vision__progress"), "CASE K：Sidebar 完成數");
assert(app.includes("lib-vision__steps"), "CASE K：Sidebar 顯示 steps");
assert(app.includes("manifestPlanStatusFromSteps"), "CASE L：全完成＝已實現");
assert(app.includes("小小靠近"), "CASE M：舊 record 仍可顯示小小靠近");
assert(app.includes("historyManifestBlocks"), "舊 history fallback 仍在");
assert(app.includes("讓願望靠近現實"), "CASE M：舊 path history 仍在");
assert(app.includes("我正在靠近的生活"), "CASE M：舊 close history 仍在");

assert(css.includes(".journal-split--manifest"), "CASE N：07 單欄");
assert(css.includes("#section-manifest") && css.includes("overflow-x: hidden"), "CASE N：無橫向溢出");
assert(!/#section-manifest[\s\S]{0,500}-webkit-line-clamp/.test(css), "CASE N：07 不 clamp");
assert(css.includes("max-width: 800px"), "CASE O：Desktop lib 仍約 800");

assert(html.includes('id="section-thanks"') && html.includes('id="section-exec"'), "CASE P：01～06 DOM 仍在");
assert(app.includes("selectedIds") && app.includes("可以選 1～3 件") || html.includes("1～3"), "CASE Q：06 多選文案仍在");
assert(html.includes('id="page-sfm"'), "CASE R：Sidebar 執行力頁仍在");
assert(app.includes("renderCombinedHighlightedText"), "CASE S：AI highlight 仍在");
assert(app.includes("manifest.sentence") && app.includes("manifest.path."), "CASE S：舊 userMark 欄位仍在");
assert(app.includes("manifest.plan.step."), "CASE S：新 step 可畫重點");
assert(!app.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE T：無 schema migration");
assert(MANIFEST_CLOSE_SYSTEM.includes("futureVision"), "舊 close prompt 仍保留");
assert(MANIFEST_PROMPTS_SYSTEM.includes("最多 2 題"), "舊 prompts 仍保留");

const close = normalizeManifestClose({ futureVision: "舊畫面", manifestationStatement: "我正在成為舊的自己。" }, "舊願景");
assert(close.futureVision.includes("舊畫面"), "舊 close normalize 不壞");

const merged = mergeJournalObjects(
  {
    manifestPlan: {
      id: "p1",
      steps: [{ id: "s1", title: "舊步驟", detail: "細節", completed: true, taskAdded: false }],
    },
  },
  { manifestPlan: { id: "p1", steps: [{ id: "s1", title: "舊步驟", detail: "細節", completed: false, taskAdded: true }] } }
);
assert(merged.manifestPlan.steps[0].completed === true, "merge 保留 completed");
assert(merged.manifestPlan.steps[0].taskAdded === true, "merge 保留 taskAdded");

assert(app.includes("重新整理後，目前的步驟與完成進度會被更新"), "重新生成需確認");
assert(html.includes("正在把你想要的生活，整理成可以一步一步靠近的路"), "loading 文案");

console.log("manifest plan tests passed");
