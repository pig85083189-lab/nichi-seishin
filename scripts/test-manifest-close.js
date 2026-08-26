const fs = require("fs");
const path = require("path");
const {
  mergeJournalObjects,
} = require("../lib/review-merge");
const {
  MANIFEST_CLOSE_SYSTEM,
  MANIFEST_PATHS_SYSTEM,
  MANIFEST_PROMPTS_SYSTEM,
  normalizeManifestClose,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");

const sectionManifest = html.slice(html.indexOf('id="section-manifest"'), html.indexOf('id="section-quick-insight"'));

assert(sectionManifest.includes("我真正想靠近的是什麼？"), "CASE A：07 有願景標題");
assert(sectionManifest.includes("id=\"manifestVision\""), "CASE A：保留 textarea");
assert(sectionManifest.includes("不是只想著得到什麼"), "CASE A：新導語");
assert(sectionManifest.includes("如果這已經成真，那時候的你會是什麼感覺？"), "CASE B：固定題 1");
assert(sectionManifest.includes("那個已經做到的你，會怎麼生活／怎麼選擇？"), "CASE B：固定題 2");
assert(sectionManifest.includes("id=\"manifestThink1\"") && sectionManifest.includes("id=\"manifestThink2\""), "CASE B：兩題都是 textarea");
assert(sectionManifest.includes("看見我正在靠近的未來"), "CASE C：新 CTA");
assert(sectionManifest.includes("正在替你整理正在靠近的生活"), "CASE G：loading 文案");
assert(!sectionManifest.includes("✦ 看看這個願望"), "不再用看看這個願望");
assert(!/executionChoices/.test(MANIFEST_CLOSE_SYSTEM) || MANIFEST_CLOSE_SYSTEM.includes("不要產生 executionChoices"), "不要回傳 executionChoices");
assert(!MANIFEST_CLOSE_SYSTEM.includes('"items"'), "CASE D：prompt 不產出 3 個 Todo items");

assert(MANIFEST_CLOSE_SYSTEM.includes("futureVision"), "CASE C：prompt 有 futureVision");
assert(MANIFEST_CLOSE_SYSTEM.includes("approachStep"), "CASE D：prompt 有 approachStep");
assert(MANIFEST_CLOSE_SYSTEM.includes("manifestationStatement"), "CASE E：prompt 有顯化句");
assert(MANIFEST_CLOSE_SYSTEM.includes("我正在成為") || MANIFEST_CLOSE_SYSTEM.includes("我正在走向"), "CASE E：grounded 顯化句");
assert(MANIFEST_PATHS_SYSTEM === MANIFEST_CLOSE_SYSTEM, "舊 paths step 相容新 close prompt");
assert(MANIFEST_PROMPTS_SYSTEM.includes("最多 2 題"), "舊 prompts step 仍在");

const partial = normalizeManifestClose({ futureVision: "我站在台上，把想說的話說完。" }, "演講順利");
assert(partial.futureVision.includes("台上"), "CASE F：缺欄仍可 normalize");
assert(typeof partial.approachStep === "string", "CASE F：缺 approachStep 不 crash");
assert(typeof partial.manifestationStatement === "string" && partial.manifestationStatement.length > 0, "CASE F：缺顯化句有 fallback");
assert(!/throw new Error/.test(String(normalizeManifestClose)), "CASE F：normalize 本身不 throw");

assert(app.includes("setManifestPromptsLoading(true)"), "CASE G：有 loading");
assert(app.includes("雲端整理失敗"), "CASE H：error fallback");
assert(app.includes("buildManifestCloseFallback"), "CASE H：本地 fallback");
assert(app.includes("generateManifestClose({ force: true })"), "CASE H：可 retry");

assert(app.includes("addManifestApproachToExec"), "CASE I：放進執行力");
assert(app.includes('source: "顯化力"'), "CASE I：source 顯化力");
assert(app.includes("manifest-approach:"), "CASE J：idempotent sourceKey");
assert(app.includes("manifestCloseTaskExists"), "CASE J：重複點不建第二筆");
assert(app.includes("addedToExec"), "CASE J：成功後標記已加入");
assert(app.includes("✓ 已放進執行力"), "CASE J：成功文案");
assert(!/applyGeneratedManifestClose[\s\S]{0,200}addTaskFromGuide/.test(app), "CASE K：產生結果不自動建 task");
assert(app.includes("acceptManifestClose"), "CASE L：收下今天的顯化");
assert(app.includes("manifest-close:"), "CASE L：收藏 sourceKey");
assert(app.includes("✓ 今天的顯化已留下"), "CASE L：完成 feedback");
assert(app.includes("futureVision: String(futureVision"), "CASE M：Sidebar 可存 futureVision");
assert(app.includes("approachStep: String(approachStep"), "CASE M：Sidebar 可存 approachStep");
assert(app.includes("manifestationStatement: String(manifestationStatement"), "CASE M：Sidebar 可存顯化句");
assert(app.includes("function renderManifestItem(item)"), "CASE N：Sidebar presentation 函式仍在");
assert(app.includes("lib-vision__near-label"), "CASE N：Sidebar 仍顯示小小靠近");

assert(app.includes("historyManifestBlocks"), "CASE O／P：history fallback");
assert(app.includes("讓願望靠近現實"), "CASE O：舊 history 仍可讀 paths");
assert(app.includes("我想顯化的事情"), "CASE O：舊 history 願景標題");
assert(app.includes("我真正想靠近的是什麼"), "CASE P：新 history 四層");
assert(app.includes("我正在靠近的生活"), "CASE P：新 history futureVision");
assert(app.includes("今天，我可以先靠近一點"), "CASE P：新 history approachStep");
assert(app.includes("journalUsesManifestClose"), "CASE P：新舊分流");

assert(css.includes(".journal-split--manifest"), "CASE Q：07 單欄");
assert(css.includes("grid-template-columns: minmax(0, 1fr)"), "CASE Q：單欄 grid");
assert(css.includes("#section-manifest") && css.includes("overflow-x: hidden"), "CASE Q：無橫向溢出");
assert(css.includes("overflow-wrap: anywhere"), "CASE R：長句 wrap");
assert(!/#section-manifest[\s\S]{0,400}-webkit-line-clamp/.test(css), "CASE R：07 不 line-clamp");
assert(css.includes("font-family: var(--serif)"), "視覺：serif 願景／顯化句");
assert(css.includes(".manifest-close-vision"), "視覺：futureVision 區塊");
assert(css.includes(".manifest-close-quote"), "視覺：顯化句高潮");

assert(app.includes('"④ 深度思考"'), "CASE S：04 歷史標題未改");
assert(html.includes("id=\"section-deep\"") && html.includes("id=\"section-insight\""), "CASE S：04 DOM 仍在");
assert(html.includes("id=\"section-aware\""), "CASE T：05 DOM 未改編號");
assert(html.includes("id=\"section-exec\""), "CASE U：06 DOM 仍在");
assert(app.includes("EXEC_CHOICE_MAX_SELECTED") || app.includes("selectedIds"), "CASE U：06 多選仍在");
assert(html.includes('id="page-sfm"'), "CASE V：Sidebar 執行力頁仍在");
assert(html.includes('id="page-next"'), "CASE W：Sidebar 覺察力頁仍在");
assert(app.includes("renderCombinedHighlightedText"), "CASE X：AI highlight 仍在");
assert(app.includes("manifest.sentence") && app.includes("manifest.path."), "CASE X：userMark 舊欄位仍在");
assert(app.includes("manifest.close.futureVision") && app.includes("manifest.close.approachStep"), "CASE X：新 close 可畫重點");
assert(!app.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE Y：無 schema migration");
assert(html.includes("id=\"section-thanks\"") && html.includes("id=\"section-manifest\""), "CASE Z：04→07 區塊仍在");

const merged = mergeJournalObjects(
  {
    manifestClose: {
      futureVision: "舊畫面",
      approachStep: "舊一小步",
      manifestationStatement: "我正在成為舊的自己。",
      accepted: true,
      addedToExec: false,
    },
  },
  { manifestClose: { futureVision: "", approachStep: "", manifestationStatement: "", accepted: false, addedToExec: false } }
);
assert(merged.manifestClose.futureVision === "舊畫面", "舊 close 不被空物件覆蓋");
assert(merged.manifestClose.accepted === true, "accepted 以 OR 保留");

const oldHistory = app.includes('historyBlock("我想顯化的事情"');
assert(oldHistory, "舊 history fallback 仍呼叫我想顯化的事情");

console.log("manifest close tests passed");
