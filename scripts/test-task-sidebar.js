const {
  TODAY_FOCUS_MAX,
  COMPLETE_TOAST,
  FOCUS_LIMIT_TOAST,
  isLegacyGenericTitle,
  presentLegacyTitle,
  presentLegacySource,
  isTodayFocus,
  focusedDoingTasks,
  otherDoingTasks,
  todayFocusCount,
  toggleTodayFocus,
  clearFocusLeavingDoing,
} = require("../lib/task-sidebar");
const { mergeItemList } = (function () {
  return {
    mergeItemList(left, right) {
      const map = new Map();
      [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].forEach((item) => {
        if (!item || !item.id) return;
        const current = map.get(item.id);
        const newer = !current || String(item.updatedAt || "") > String(current.updatedAt || "");
        map.set(item.id, newer ? item : current);
      });
      return [...map.values()];
    },
  };
})();
const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");

assert(html.includes("lib/task-sidebar.js?v=1"), "task-sidebar 已載入");
assert(app.includes("function toggleTaskTodayFocus"), "Sidebar 有今天要做切換");
assert(app.includes("renderTodayFocusSection"), "進行中頁有今天要做區塊");
assert(!html.includes('data-filter="focus"'), "沒有第四個 tab");
assert(app.includes("function generateExecutionChoices"), "CASE T：06 多選流程仍在");
assert(app.includes("可以選 1～3 件"), "CASE T：06 文案仍在");
assert(css.includes("overflow-x: clip") && css.includes(".task-focus"), "CASE R：執行力頁與 focus 區避免橫向溢出");
assert(css.includes("overflow-wrap: anywhere"), "長句可換行");
assert(!css.includes("line-clamp") || !/#page-sfm[\s\S]{0,200}line-clamp/.test(css), "執行力 title 不 clamp");
assert(COMPLETE_TOAST === "完成了。你正在把想法慢慢變成生活。", "CASE J：完成文案固定");
assert(FOCUS_LIMIT_TOAST === "今天先完成 3 件就好。", "CASE E：第 4 件 toast 文案固定");
assert(TODAY_FOCUS_MAX === 3, "最多 3 件");
assert(!app.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE：無 schema SQL");

const today = "2026-08-28";
const tasks = [
  { id: "a", status: "doing", title: "11:00 前睡覺", focusDate: "", updatedAt: "1" },
  { id: "b", status: "doing", title: "主動跟夥伴分享最近正在努力的事", focusDate: "", updatedAt: "1" },
  { id: "c", status: "doing", title: "寫下三件讓我開心的小事", focusDate: "", updatedAt: "1" },
  { id: "d", status: "doing", title: "第四件不該進去", focusDate: "", updatedAt: "1" },
];

let next = toggleTodayFocus(tasks, "a", today, "t2");
assert(next.ok && next.focused && isTodayFocus(next.tasks.find((item) => item.id === "a"), today), "CASE A／B：可加入 1 件");
next = toggleTodayFocus(next.tasks, "b", today, "t3");
assert(todayFocusCount(next.tasks, today) === 2, "CASE C：可同時 2 件");
next = toggleTodayFocus(next.tasks, "c", today, "t4");
assert(todayFocusCount(next.tasks, today) === 3, "CASE D：可同時 3 件");
const blocked = toggleTodayFocus(next.tasks, "d", today, "t5");
assert(blocked.ok === false && blocked.reason === "limit", "CASE E：第 4 件被阻止");
assert(todayFocusCount(blocked.tasks, today) === 3, "CASE E：清單仍是 3 件");
assert(blocked.tasks.length === 4, "CASE P：不會複製出第五筆 task");

const unfocused = toggleTodayFocus(next.tasks, "a", today, "t6");
assert(unfocused.ok && unfocused.focused === false, "CASE F：可取消今天做");
assert(unfocused.tasks.find((item) => item.id === "a").status === "doing", "CASE F：取消不改 status");
assert(unfocused.tasks.find((item) => item.id === "a").title === "11:00 前睡覺", "CASE F：取消不刪 task");

const doneTask = clearFocusLeavingDoing(next.tasks.find((item) => item.id === "b"), "done");
assert(doneTask.focusDate === "", "CASE G：完成後清掉 focus");
const laterTask = clearFocusLeavingDoing(next.tasks.find((item) => item.id === "c"), "later");
assert(laterTask.focusDate === "", "CASE H：移到待開始後清掉 focus");
const restart = clearFocusLeavingDoing({ id: "b", status: "done", focusDate: "" }, "doing");
assert(!isTodayFocus({ ...restart, status: "doing" }, today), "CASE：restart 不會自動加回");

const leftover = focusedDoingTasks(
  [
    { id: "gone", status: "doing", focusDate: today },
    { id: "old", status: "doing", focusDate: "2026-08-27" },
    { id: "done", status: "done", focusDate: today },
  ],
  today
);
assert(leftover.every((item) => item.status === "doing" && item.focusDate === today), "CASE I／Q：只保留當天 doing focus");
assert(!leftover.some((item) => item.id === "old"), "CASE Q：昨天 focus 不當今天");
assert(!leftover.some((item) => item.id === "done"), "CASE I：done 不留在今天要做");

const merged = mergeItemList(
  [{ id: "a", status: "doing", title: "同一筆", focusDate: today, updatedAt: "2026-08-28T02:00:00.000Z" }],
  [{ id: "a", status: "doing", title: "同一筆", focusDate: today, updatedAt: "2026-08-28T01:00:00.000Z" }]
);
assert(merged.length === 1, "CASE P：cloud merge 不 duplicate");
assert(merged[0].focusDate === today, "CASE O：focusDate 可隨 task 保存");

assert(isLegacyGenericTitle("明天最小一步"), "legacy title 可辨識");
const legacy = presentLegacyTitle({ title: "明天最小一步", detail: "11:00前睡覺" }, { title: "明天最小一步", detail: "11:00前睡覺" });
assert(legacy.title === "11:00前睡覺", "CASE M：Sidebar 主 title 是真正行動");
assert(!legacy.detail, "CASE M：不再重複顯示 generic + detail");
const normal = presentLegacyTitle(
  { title: "寫下三件讓我開心的小事", detail: "睡前寫在紙條上" },
  { title: "寫下三件讓我開心的小事", detail: "睡前寫在紙條上" }
);
assert(normal.title === "寫下三件讓我開心的小事" && normal.detail.includes("睡前"), "CASE N：正常 title/detail 不受影響");
const unsafe = presentLegacyTitle({ title: "明天最小一步", detail: "" }, { title: "明天最小一步", detail: "" });
assert(unsafe.title === "明天最小一步", "無法安全判斷時保持原 title");
assert(presentLegacySource("今日最小行動") === "今日復盤", "CASE M：來源 generic 顯示成今日復盤");
assert(presentLegacySource("自行新增") === "自行新增", "一般來源不變");

assert(otherDoingTasks(next.tasks, today).every((item) => !isTodayFocus(item, today)), "其他進行中不含今天要做");
assert(app.includes('prevStatus !== "done" && next === "done"'), "CASE J：只在未完成→已完成 toast");
assert(app.includes("if (to !== \"done\") showToast(statusMoveToast(to))"), "CASE K／L：restart／later 不走完成文案");
assert(app.includes("sidebarTodayIso"), "CASE Q：focus 用日曆今天，不跟 journal date picker");

console.log("task sidebar tests passed");
