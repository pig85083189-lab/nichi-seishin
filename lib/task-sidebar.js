(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiTaskSidebar = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TODAY_FOCUS_MAX = 3;
  const COMPLETE_TOAST = "完成了。你正在把想法慢慢變成生活。";
  const FOCUS_LIMIT_TOAST = "今天先完成 3 件就好。";

  const LEGACY_GENERIC_TITLES = [
    "明天最小一步",
    "明天最小的一步",
    "今天最小一步",
    "今天最小的一步",
    "今日最小一步",
    "今日最小的一步",
    "今日最小行動",
  ];

  const LEGACY_GENERIC_SOURCES = ["今日最小行動", "明天最小一步", "明天最小的一步", "今天最小一步", "今日最小一步"];

  function asText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function compactKey(text) {
    return asText(text).replace(/\s+/g, "");
  }

  function isLegacyGenericTitle(text) {
    const key = compactKey(text);
    if (!key) return false;
    return LEGACY_GENERIC_TITLES.some((item) => compactKey(item) === key);
  }

  function presentLegacyTitle(parts, task) {
    const heading = asText(parts && parts.title);
    const rest = asText(parts && parts.detail);
    const storedDetail = asText(task && (task.detail || task.note || task.body));
    const action = rest || storedDetail;
    if (isLegacyGenericTitle(heading) && action && compactKey(action) !== compactKey(heading)) {
      return { title: action, detail: "" };
    }
    return {
      title: heading,
      detail: action && compactKey(action) !== compactKey(heading) ? action : "",
    };
  }

  function presentLegacySource(source) {
    const raw = asText(source);
    if (!raw) return "";
    if (LEGACY_GENERIC_SOURCES.some((item) => compactKey(item) === compactKey(raw))) return "今日復盤";
    return raw;
  }

  function isTodayFocus(task, todayIso) {
    if (!task || task.status !== "doing") return false;
    return asText(task.focusDate) === asText(todayIso);
  }

  function focusedDoingTasks(tasks, todayIso) {
    return (Array.isArray(tasks) ? tasks : []).filter((task) => isTodayFocus(task, todayIso));
  }

  function otherDoingTasks(tasks, todayIso) {
    return (Array.isArray(tasks) ? tasks : []).filter((task) => task && task.status === "doing" && !isTodayFocus(task, todayIso));
  }

  function todayFocusCount(tasks, todayIso) {
    return focusedDoingTasks(tasks, todayIso).length;
  }

  function patchTask(task, patch) {
    return { ...(task || {}), ...patch };
  }

  function toggleTodayFocus(tasks, id, todayIso, nowIso) {
    const list = Array.isArray(tasks) ? tasks.map((item) => ({ ...item })) : [];
    const index = list.findIndex((item) => item && item.id === id);
    if (index < 0) return { tasks: list, ok: false, reason: "missing" };
    const task = list[index];
    if (task.status !== "doing") return { tasks: list, ok: false, reason: "not-doing" };
    if (isTodayFocus(task, todayIso)) {
      list[index] = patchTask(task, { focusDate: "", updatedAt: nowIso || task.updatedAt });
      return { tasks: list, ok: true, focused: false };
    }
    if (todayFocusCount(list, todayIso) >= TODAY_FOCUS_MAX) {
      return { tasks: list, ok: false, reason: "limit" };
    }
    list[index] = patchTask(task, { focusDate: asText(todayIso), updatedAt: nowIso || task.updatedAt });
    return { tasks: list, ok: true, focused: true };
  }

  function clearFocusLeavingDoing(task, nextStatus) {
    if (!task) return task;
    if (nextStatus === "doing") return task;
    if (!asText(task.focusDate)) return task;
    return patchTask(task, { focusDate: "" });
  }

  return {
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
  };
});
