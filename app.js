/* =============================================================================
 * 日精進 — 開箱即用。開始整理先出本地復盤，再經 /api/review 用伺服器金鑰加深。
 * 前端不存放、不收集 API Key。金鑰只存在 Vercel 環境變數。
 * =========================================================================== */

const STORAGE_KEYS = {
  reviews: "nichi.reviews",
  tasks: "nichi.tasks",
  sfm: "nichi.sfm",
  insights: "nichi.insights",
  manifests: "nichi.manifests",
  reminder: "nichi.reminder",
  sidebar: "nichi.sidebarCollapsed",
  reports: "nichi.reports",
  journalMode: "nichi.journalMode",
  journalFolds: "nichi.journalFolds",
};

const REVIEW_API = "/api/review";
const NEWEBPAY_EPG_URL = "https://core.newebpay.com/EPG/HTC109030010100/QLBIYc";
const NEWEBPAY_PLANS = {
  monthly: {
    id: "monthly",
    amount: 599,
    url: NEWEBPAY_EPG_URL,
  },
  quarter: {
    id: "quarter",
    amount: 1197,
    url: "https://core.newebpay.com/EPG/SinSpa/1gbSo9",
  },
};

const PROMPT_CHIPS = [
  "今天最卡的一件事",
  "今天讓我有成就感的是",
  "今天我做了一個決定",
  "今天有件事本來可以做得更好",
  "今天想要感恩的是",
];

const SFM_TYPE_LABEL = {
  story: "Story 故事",
  feeling: "Feeling 感受",
  meaning: "Meaning 意義",
};

const STATUS_LABEL = {
  doing: "進行中",
  later: "待辦",
  done: "已完成",
};

const state = {
  page: "today",
  reportType: "week",
  reportCharts: { radar: null, bars: null },
  monthArchiveTried: false,
  tour: null,
  taskFilter: "doing",
  insightFilter: "all",
  manifestFilter: "doing",
  sfmFilter: "all",
  historyQuery: "",
  historyTag: "all",
  historyOpen: "",
  journalMode: "deep",
  quickModules: { body: false, aware: false, exec: false, manifest: false },
  deepExpanded: false,
  organize: null,
  rawText: "",
  think: { round: 0, max: 5, history: [], current: null },
  thinkToken: 0,
  selectedQuotes: [],
  selectedSfm: [],
  selectedThinkActions: [],
  selectedPractice: [],
  gratitude: "",
  remindedDate: "",
  journalHydrating: false,
  journalCheckTimer: 0,
  journalMeta: {
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    awarenessQuoteGenCount: 0,
    manifestAi: false,
    manifestAiSig: "",
    insightSig: "",
    bodyCoachSig: "",
    promptsSig: "",
    promptsAi: false,
    corePromptsSig: "",
    corePromptsAi: false,
  },
  checklistBusy: { awareness: false, execution: false, manifest: false },
  checklistToken: { awareness: 0, execution: 0, manifest: 0 },
  insightBusy: false,
  insightToken: 0,
  completeBusy: false,
  journalInsight: null,
  bodyCoachBusy: false,
  bodyCoachToken: 0,
  journalBodyCoach: null,
  promptsBusy: false,
  promptsToken: 0,
  corePromptsBusy: false,
  corePromptsToken: 0,
  corePromptsFailedSig: "",
  awarenessPrompts: [],
  executionPrompts: [],
  execQuestionTab: "open",
  deepPrompts: [],
  deepFollowBusy: [false, false, false, false],
  deepFollowToken: [0, 0, 0, 0],
  organizeSource: "",
  apiConfigured: null,
  user: null,
  accessToken: "",
  authConfigured: false,
  payConfigured: false,
  membership: null,
  authReady: false,
  syncing: false,
};

/* =============================================================================
 * 工具
 * =========================================================================== */

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value, options = {}) {
  localStorage.setItem(key, JSON.stringify(value));
  if (
    !options.silent &&
    [STORAGE_KEYS.reviews, STORAGE_KEYS.tasks, STORAGE_KEYS.sfm, STORAGE_KEYS.insights, STORAGE_KEYS.manifests, STORAGE_KEYS.reports].includes(key)
  ) {
    scheduleCloudSync();
  }
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad(num) {
  return String(num).padStart(2, "0");
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function toInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatHeaderDate(date) {
  return `${date.getFullYear()} / ${pad(date.getMonth() + 1)} / ${pad(date.getDate())}`;
}

function formatDisplayDate(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${y}/${m}/${d}`;
}

function formatTrialDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return startOfDay(date);
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function starsText(n) {
  const count = Math.max(1, Math.min(5, Number(n) || 3));
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

function excerptText(text, max = 140) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

function isMobile() {
  return window.matchMedia("(max-width: 900px)").matches;
}

/* =============================================================================
 * 資料層
 * =========================================================================== */

function getReviews() {
  const stored = loadJson(STORAGE_KEYS.reviews, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function saveReviews(reviews) {
  saveJson(STORAGE_KEYS.reviews, reviews);
}

function getReview(iso) {
  return getReviews()[iso] || null;
}

function upsertReview(iso, patch) {
  const reviews = getReviews();
  const prev = reviews[iso] && typeof reviews[iso] === "object" ? reviews[iso] : {};
  reviews[iso] = { ...prev, ...patch, date: iso };
  saveReviews(reviews);
  return reviews[iso];
}

function getTasks() {
  const saved = loadJson(STORAGE_KEYS.tasks, []);
  return Array.isArray(saved) ? saved : [];
}

function saveTasks(tasks) {
  saveJson(STORAGE_KEYS.tasks, tasks);
}

function splitTaskText(text) {
  const raw = String(text || "").trim();
  const idx = raw.search(/[：:]/);
  if (idx > 0 && idx < raw.length - 1) {
    return { title: raw.slice(0, idx).trim(), detail: raw.slice(idx + 1).trim() };
  }
  return { title: raw, detail: "" };
}

function flattenExecSentence(text, extra) {
  const how = String(extra?.how || extra?.action || "").trim();
  const raw = String(text || extra?.detail || extra?.lead || extra?.note || "").trim();
  const extracted = (raw.match(/怎麼做[:：]\s*([^｜]+)/) || [])[1]?.trim() || "";
  return how || extracted || raw;
}

function taskDisplayParts(task) {
  const storedTitle = String(task && task.title ? task.title : "").trim();
  const storedDetail = flattenExecSentence((task && (task.detail || task.note || task.body)) || "", task);
  if (storedDetail && storedDetail !== storedTitle) {
    return { title: storedTitle || storedDetail, detail: storedTitle ? storedDetail : "" };
  }
  return splitTaskText(storedTitle);
}

function findTaskBySourceKey(key) {
  if (!key) return null;
  return getTasks().find((task) => task.sourceKey === key) || null;
}

function addTaskFromGuide({ key, label, detail, source, date }) {
  const parsed = splitTaskText(label);
  const title = parsed.title || String(detail || "").trim();
  const note = flattenExecSentence(String(detail || "").trim() || parsed.detail, { detail });
  if (!title) return { added: false };
  const iso = date || currentIso();
  const tasks = getTasks();
  if (key && tasks.some((task) => task.sourceKey === key)) return { added: false, exists: true };
  if (tasks.some((task) => task.title === title && task.date === iso && String(task.detail || "") === (note && note !== title ? note : ""))) {
    return { added: false, exists: true };
  }
  tasks.unshift({
    id: uid(),
    title,
    detail: note && note !== title ? note : "",
    status: "doing",
    source: source || "今日復盤",
    sourceKey: key || "",
    date: iso,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveTasks(tasks);
  try {
    renderTasks();
  } catch {
    /* 執行力頁面還沒畫也沒關係 */
  }
  return { added: true };
}

function removeTaskFromGuide(key) {
  if (!key) return { removed: false };
  const tasks = getTasks();
  const index = tasks.findIndex((task) => task.sourceKey === key);
  if (index === -1) return { removed: false };
  if (tasks[index].status !== "doing") return { removed: false, kept: true };
  tasks.splice(index, 1);
  saveTasks(tasks);
  try {
    renderTasks();
  } catch {
    /* ignore */
  }
  return { removed: true };
}

function execCheckTaskKey(title, iso) {
  const heading = String(title || "").trim();
  if (!heading) return "";
  return `exec:${iso || currentIso()}:${heading}`;
}

function syncExecCheckToSidebar({ checked, title, detail }) {
  const heading = String(title || "").trim();
  if (!heading) return;
  const key = execCheckTaskKey(heading);
  if (checked) {
    const result = addTaskFromGuide({
      key,
      label: heading,
      detail: flattenExecSentence(String(detail || "").trim()),
      source: "今日復盤",
    });
    if (result.added) showToast("已加入側邊欄『執行力』");
    else if (result.exists) showToast("這項已在『執行力』");
    return;
  }
  const result = removeTaskFromGuide(key);
  if (result.removed) showToast("已從『執行力』拿掉");
  else if (result.kept) showToast("這項已在清單裡，改由你手動管理");
}

function syncGuideToNextSteps(input, checked) {
  const key = input.dataset.practice || input.dataset.action || "";
  const label = input.dataset.label || "";
  const detail = input.dataset.detail || "";
  if (checked) {
    const result = addTaskFromGuide({ key, label, detail });
    if (result.added) showToast("已加入『執行力』");
    else if (result.exists) showToast("這項已在『執行力』");
    return;
  }
  const result = removeTaskFromGuide(key);
  if (result.removed) showToast("已從『執行力』拿掉");
  else if (result.kept) showToast("這項已在清單裡，改由你手動管理");
}

function getSfm() {
  const saved = loadJson(STORAGE_KEYS.sfm, []);
  return Array.isArray(saved) ? saved : [];
}

function saveSfm(items) {
  saveJson(STORAGE_KEYS.sfm, items);
}

function getInsights() {
  const saved = loadJson(STORAGE_KEYS.insights, []);
  return Array.isArray(saved) ? saved : [];
}

function saveInsights(items) {
  saveJson(STORAGE_KEYS.insights, items);
}

function getManifests() {
  const saved = loadJson(STORAGE_KEYS.manifests, []);
  return Array.isArray(saved) ? saved : [];
}

function saveManifests(items) {
  saveJson(STORAGE_KEYS.manifests, items);
}

function addManifest({ key, title, vision, date }) {
  const text = String(title || "").trim();
  if (!text) return { added: false };
  const items = getManifests();
  if (key && items.some((item) => item.sourceKey === key)) return { added: false, exists: true };
  const iso = date || currentIso();
  if (items.some((item) => item.title === text && item.date === iso && item.vision === (vision || ""))) {
    return { added: false, exists: true };
  }
  items.unshift({
    id: uid(),
    title: text,
    vision: String(vision || "").trim(),
    date: iso,
    status: "doing",
    source: "今日復盤",
    sourceKey: key || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveManifests(items);
  try {
    renderManifests();
  } catch {
    /* 顯化力頁面還沒畫也沒關係 */
  }
  return { added: true };
}

function removeManifestFromGuide(key) {
  if (!key) return { removed: false };
  const items = getManifests();
  const index = items.findIndex((item) => item.sourceKey === key);
  if (index === -1) return { removed: false };
  if (items[index].status !== "doing") return { removed: false, kept: true };
  items.splice(index, 1);
  saveManifests(items);
  try {
    renderManifests();
  } catch {
    /* ignore */
  }
  return { removed: true };
}

function manifestCheckKey(title, iso) {
  const heading = String(title || "").trim();
  if (!heading) return "";
  return `manifest:${iso || currentIso()}:${heading}`;
}

function syncManifestCheckToSidebar({ checked, title }) {
  const heading = String(title || "").trim();
  if (!heading) return;
  const vision = String(document.getElementById("manifestVision")?.value || "").trim();
  const key = manifestCheckKey(heading);
  if (checked) {
    const result = addManifest({
      key,
      title: heading,
      vision,
      date: currentIso(),
    });
    if (result.added) showToast("已加入側邊欄『顯化力』");
    else if (result.exists) showToast("這項已在『顯化力』");
    return;
  }
  const result = removeManifestFromGuide(key);
  if (result.removed) showToast("已從『顯化力』拿掉");
  else if (result.kept) showToast("這項已在清單裡，改由你手動管理");
}

function addInsight({ key, title, date, source }) {
  const text = String(title || "").trim();
  if (!text) return { added: false };
  const items = getInsights();
  if (key && items.some((item) => item.sourceKey === key)) return { added: false, exists: true };
  if (items.some((item) => item.title === text && item.date === (date || currentIso()))) {
    return { added: false, exists: true };
  }
  items.unshift({
    id: uid(),
    title: text,
    date: date || currentIso(),
    source: source || "今日復盤",
    sourceKey: key || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveInsights(items);
  try {
    renderInsights();
  } catch {
    /* 覺察力頁面還沒畫也沒關係 */
  }
  return { added: true };
}

function syncJournalLibraries(iso, journal) {
  const data = journal && typeof journal === "object" ? journal : {};
  (data.awarenessChecks || []).forEach((label) => {
    addInsight({
      key: `insight:${iso}:${label}`,
      title: label,
      date: iso,
      source: "今日復盤",
    });
  });
  const execItems = normalizeExecCheckItems(data.executionCheckItems);
  (data.executionChecks || []).forEach((label) => {
    const title = String(label || "").trim();
    if (!title) return;
    const item = execItems.find((entry) => entry.title === title);
    addTaskFromGuide({
      key: `exec:${iso}:${title}`,
      label: title,
      detail: item?.detail || "",
      source: "今日復盤",
      date: iso,
    });
  });
  const smallest = String(data.smallestStep || "").trim();
  if (smallest) {
    addTaskFromGuide({
      key: `exec-step:${iso}`,
      label: "明天最小一步",
      detail: smallest,
      source: "今日最小行動",
      date: iso,
    });
  }
  const vision = String(data.manifest || "").trim();
  (data.manifestChecks || []).forEach((label) => {
    addManifest({
      key: `manifest:${iso}:${label}`,
      title: label,
      vision,
      date: iso,
    });
  });
}

function backfillLibrariesFromReviews() {
  Object.entries(getReviews()).forEach(([iso, review]) => {
    if (!review || !(review.completedAt || review.journal)) return;
    syncJournalLibraries(iso, review.journal || {});
  });
}

function sfmGuideKey(kind, index, iso) {
  return `review:${iso || currentIso()}:${kind}:${index}`;
}

function refreshSfmIfVisible() {
  try {
    renderSfm();
  } catch {
    /* 素材庫頁面還沒畫也沒關係 */
  }
}

function addSfmFromGuide({ key, body, title, type, date }) {
  const text = String(body || "").trim();
  if (!text) return { added: false };
  const items = getSfm();
  if (key && items.some((item) => item.sourceKey === key)) return { added: false, exists: true };
  if (items.some((item) => item.body === text)) return { added: false, exists: true };
  const resolvedType = ["story", "feeling", "meaning"].includes(type) ? type : inferSfmType(text);
  items.unshift({
    id: uid(),
    type: resolvedType,
    title: String(title || excerptText(text, 18)).trim() || excerptText(text, 18),
    body: text,
    source: "今日復盤",
    sourceKey: key || "",
    date: date || currentIso(),
    createdAt: new Date().toISOString(),
  });
  saveSfm(items);
  refreshSfmIfVisible();
  return { added: true };
}

function removeSfmFromGuide(key) {
  if (!key) return { removed: false };
  const items = getSfm();
  const index = items.findIndex((item) => item.sourceKey === key);
  if (index === -1) return { removed: false, kept: true };
  items.splice(index, 1);
  saveSfm(items);
  refreshSfmIfVisible();
  return { removed: true };
}

function syncGuideToSfm(kind, index, checked) {
  const iso = currentIso();
  const key = sfmGuideKey(kind, index, iso);
  let body = "";
  let title = "";
  let type = "";
  if (kind === "quote") {
    body = String(state.organize?.quotes?.[index] || "").trim();
  } else {
    const item = state.organize?.sfm?.[index] || {};
    body = String(item.body || item.title || "").trim();
    title = item.title || "";
    type = item.type || "";
  }
  if (checked) {
    const result = addSfmFromGuide({ key, body, title, type, date: iso });
    if (result.added) showToast("已存入 1 則到『執行力』");
    else if (result.exists) showToast("這則已在『執行力』");
    return;
  }
  const result = removeSfmFromGuide(key);
  if (result.removed) showToast("已從『執行力』拿掉");
  else if (result.kept) showToast("這則已在『執行力』，改由你手動刪除");
}

function reviewIsComplete(review) {
  return Boolean(
    review &&
      (review.completedAt ||
        review.organize ||
        String(review.rawText || "").trim() ||
        journalHasContent(review.journal))
  );
}

function reviewSearchText(review) {
  if (!review) return "";
  const ai = review.organize || {};
  return [
    review.rawText,
    review.gratitude,
    review.journal && JSON.stringify(review.journal),
    ai.themeCategory,
    ai.themeTitle,
    ai.themeInsight,
    ai.event,
    ai.othersReaction,
    ai.reflection,
    ai.conclusion,
    ...(ai.quotes || []),
    ...(ai.tags || []),
    ...(ai.problems || []).map((item) => `${item.title} ${item.body}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function purgeThinkingUi() {
  try {
    const stage = document.getElementById("aiStage");
    if (!stage) return;
    stage.querySelectorAll(".ai-thinking").forEach((el) => el.remove());
    if (/整理中/.test(stage.textContent || "")) {
      if (state.organize) renderAiStage();
      else stage.innerHTML = "";
    }
  } catch {
    /* 清畫面失敗也不擋後續渲染 */
  }
}

/* =============================================================================
 * 雲端復盤：只打同網域 /api/review，金鑰由 Vercel 環境變數提供
 * =========================================================================== */

function parseAiJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("雲端回傳不是 JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function reviewApiUrl() {
  if (typeof location === "undefined" || location.protocol === "file:") {
    throw new Error("請用 Vercel 網址開啟這個網頁（不要開本機 HTML），前端才能呼叫 /api/review。");
  }
  return `${location.origin}${REVIEW_API}`;
}

function formatApiError(error) {
  const message = String(error?.message || error || "未知錯誤");
  if (error?.name === "AbortError" || /請求逾時|逾時|504|OpenAI 逾時|FUNCTION_INVOCATION_TIMEOUT/i.test(message)) {
    return "雲端整理逾時了。請再試一次。";
  }
  if (/file:|本機 HTML/.test(message)) return message;
  if (/401|請先使用 Google|未登入|未授權/i.test(message)) {
    return "請先使用 Google 登入，即可解鎖 7 天完整免費試用";
  }
  if (/402|試用已結束|免費體驗已結束|paywall/i.test(message)) {
    return "您的 7 天免費體驗已結束，升級訂閱即可解鎖完整無限暢用權限";
  }
  if (/404|Failed to fetch|fetch 失敗|NetworkError/i.test(message)) {
    return "找不到 /api/review。請用 Vercel 網址開啟，並重新部署後端函式。";
  }
  return message;
}

function tokenFromLocalStorage() {
  try {
    const raw = localStorage.getItem("nichi-auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(
      parsed.access_token ||
      (parsed.currentSession && parsed.currentSession.access_token) ||
      (parsed.session && parsed.session.access_token) ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function currentAccessToken() {
  return String(state.accessToken || tokenFromLocalStorage() || "").trim();
}

function authHeaders(headers = {}, token) {
  const next = { ...(headers || {}) };
  const access = String(token || currentAccessToken() || "").trim();
  if (access) next.Authorization = `Bearer ${access}`;
  return next;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    console.log("[日精進 API] fetch 送出", options?.method || "GET", url);
    return await fetch(url, {
      credentials: "include",
      ...options,
      headers: authHeaders(options?.headers),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`請求逾時（${timeoutMs}ms）`);
    throw new Error(`fetch 失敗：${error?.message || error}`);
  } finally {
    clearTimeout(timer);
  }
}

async function postReview(body, timeoutMs = 28000) {
  if (isAccessLocked()) {
    applyAccessLock();
    throw new Error(accessLockMessage());
  }
  const url = reviewApiUrl();
  console.log("[日精進 API] POST", url, body && body.mode);
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  const payload = await response.json().catch(() => ({}));
  console.log("[日精進 API] 回應", response.status, payload && payload.ok, payload && payload.error);
  if (applyPaywallFromPayload(response, payload) || !response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  if (!payload.data || typeof payload.data !== "object") {
    throw new Error("雲端回傳格式不完整");
  }
  return payload.data;
}

async function generateReview(rawText) {
  const remote = await postReview({
    mode: "organize",
    date: currentIso(),
    text: String(rawText || "").slice(0, 8000),
  });
  if (!(remote.themeTitle || remote.conclusion || remote.themeInsight)) {
    throw new Error("雲端回傳格式不完整");
  }
  return remote;
}

async function generateThink(rawText, organize, round, actions, reply) {
  const remote = await postReview({
    mode: "think",
    date: currentIso(),
    text: String(rawText || "").slice(0, 8000),
    organize,
    round,
    max: state.think.max || 5,
    actions: Array.isArray(actions) ? actions : [],
    reply: String(reply || ""),
  });
  if (!(remote.question || remote.insight || remote.title)) {
    throw new Error("雲端思考回傳格式不完整");
  }
  return remote;
}

async function probeReviewApi() {
  try {
    const url = reviewApiUrl();
    const response = await fetchWithTimeout(url, { method: "GET" }, 8000);
    const payload = await response.json().catch(() => ({}));
    state.apiConfigured = Boolean(payload.configured);
    if (state.apiConfigured) {
      console.log("[日精進 API] 雲端金鑰已設定", payload.model || "gpt-4o-mini");
    } else {
      console.warn("[日精進 API] 伺服器還沒讀到 OPENAI_API_KEY。請在 Vercel → Settings → Environment Variables 設 Production，然後 Redeploy。");
    }
  } catch (error) {
    state.apiConfigured = false;
    console.warn("[日精進 API] 健康檢查失敗", formatApiError(error), error);
  }
}

function normalizeOrganizeResult(remote, rawText) {
  const local = localOrganize(rawText);
  if (!remote || typeof remote !== "object") return local;
  const problems = Array.isArray(remote.problems) ? remote.problems.filter(Boolean) : [];
  const quotes = Array.isArray(remote.quotes) ? remote.quotes.filter(Boolean).slice(0, 3) : [];
  const eventList = Array.isArray(remote.eventList) ? remote.eventList.filter(Boolean) : [];
  const reactionList = Array.isArray(remote.reactionList) ? remote.reactionList.filter(Boolean) : [];
  const mindsetList = Array.isArray(remote.mindsetList) ? remote.mindsetList.filter(Boolean) : [];
  const gratitudeList = Array.isArray(remote.gratitudeList) ? remote.gratitudeList.filter(Boolean) : [];
  return {
    themeCategory: remote.themeCategory || local.themeCategory,
    themeTitle: remote.themeTitle || local.themeTitle,
    themeStars: remote.themeStars || local.themeStars,
    themeInsight: remote.themeInsight || remote.conclusion || local.themeInsight,
    problems: problems.length ? problems : local.problems,
    eventList: eventList.length ? eventList : local.eventList,
    reactionList: reactionList.length ? reactionList : local.reactionList,
    mindsetList: mindsetList.length ? mindsetList : local.mindsetList,
    event: remote.event || (eventList.length ? eventList.join("\n") : local.event),
    othersReaction: remote.othersReaction || (reactionList.length ? reactionList.join("\n") : local.othersReaction),
    reflection: remote.reflection || local.reflection,
    conclusion: remote.conclusion || local.conclusion,
    quotes: quotes.length ? quotes : local.quotes,
    gratitudeList: gratitudeList.length ? gratitudeList : local.gratitudeList,
    gratitudeNote: remote.gratitudeNote || local.gratitudeNote,
    gratitudeMissing: remote.gratitudeMissing ?? local.gratitudeMissing,
    sfm: Array.isArray(remote.sfm) && remote.sfm.length ? remote.sfm : local.sfm,
    tags: Array.isArray(remote.tags) && remote.tags.length ? remote.tags : local.tags,
    whyNeed: remote.whyNeed || local.whyNeed,
    whatFact: remote.whatFact || local.whatFact,
    howNext: remote.howNext || local.howNext,
    turningPoint: remote.turningPoint || local.turningPoint,
    keyWord: remote.keyWord || local.keyWord,
    keyWordAlt: remote.keyWordAlt || local.keyWordAlt,
    nextScripts: Array.isArray(remote.nextScripts) && remote.nextScripts.length ? remote.nextScripts : local.nextScripts,
    thinkGuide: remote.thinkGuide || local.thinkGuide,
    assumptionGap: normalizeAssumptionGap(remote, local),
  };
}

function normalizeAssumptionGap(remote, local) {
  const fallback = local.assumptionGap || {};
  const nested = remote && typeof remote.assumptionGap === "object" ? remote.assumptionGap : {};
  const mine = nested.mine || remote.iThought || fallback.mine || "";
  const theirs = nested.theirs || remote.theyThought || fallback.theirs || "";
  const line = nested.line || remote.gapLine || fallback.line || "";
  if (!mine && !theirs && !line) return fallback;
  return { mine, theirs, line };
}

const ORGANIZE_SYSTEM_PROMPT = `你是「日精進」的高階心靈教練。語氣高級、療癒、冷靜客觀。整理日記時不要逐段下結論；【核心結論】只留給深度思考的每一個思考點。繁體中文，只輸出 JSON。`;

function thinkFromOrganize(organize, round = 1) {
  const scripts = Array.isArray(organize?.nextScripts) ? organize.nextScripts.filter(Boolean) : [];
  const labels = ["補講一次為什麼", "提前先寫一句", "換句話說練習"];
  const gap = organize?.assumptionGap || {};
  const question =
    organize.thinkGuide ||
    (gap.line ? `兩邊以為的是同一件事嗎？「${gap.line}」` : localThink(organize, round, [], "").question);
  const insight = [organize.howNext, organize.whyNeed, organize.whatFact].filter(Boolean).join(" ") || organize.reflection || "";
  const points = [
    organize.whyNeed && { title: "看見卡點", conclusion: organize.whyNeed },
    organize.whatFact && { title: "看見落差", conclusion: organize.whatFact },
    organize.howNext && { title: "下一步", conclusion: organize.howNext },
  ].filter(Boolean);
  if (!scripts.length) return localThink(organize, round, [], "");
  return {
    title: "先聽見那句為什麼",
    stars: organize.themeStars || 4,
    prompt: defaultThinkPrompt(organize),
    question,
    insight,
    conclusion: organize.conclusion || points[0]?.conclusion || "",
    points: points.length ? points : [{ title: "這一層", conclusion: organize.conclusion || insight }],
    actions: scripts.slice(0, 3).map((detail, index) => ({
      label: labels[index] || `對話範例 ${index + 1}`,
      detail: /[「『"]/.test(detail) ? detail : `「${detail}」`,
    })),
  };
}

async function maybeEnhanceWithApi(rawText, token) {
  if (!state.user) {
    showToast("本地草稿已出。登入後才能使用雲端分析與同步備份。");
    return;
  }
  showToast("正在連線雲端…");
  try {
    const remote = await generateReview(rawText);
    if (runOrganize._token !== token) {
      console.log("[日精進 API] 回應已過期（使用者又按了一次整理），丟棄這次結果。");
      return;
    }
    applyOrganizeResult(normalizeOrganizeResult(remote, rawText), "cloud");
    applyThinkResult(thinkFromOrganize(state.organize, 1), 1, {
      silent: true,
      prompt: defaultThinkPrompt(state.organize),
    });
    console.log("[日精進 API] 雲端復盤已套用", remote.themeTitle);
    showToast("雲端復盤已套用。");
  } catch (error) {
    const reason = formatApiError(error);
    console.error("[日精進 API] 雲端呼叫失敗，畫面維持本地結果。真正原因：", reason, error);
    showToast(`雲端分析失敗：${reason}`);
  }
}

/* =============================================================================
 * 統計 / 週月報
 * =========================================================================== */

function getCompletedDates() {
  return Object.entries(getReviews())
    .filter(([, review]) => reviewIsComplete(review))
    .map(([iso]) => iso)
    .filter((iso) => parseIsoDate(iso))
    .sort();
}

function calcStreak(dates, todayIso) {
  const set = new Set(dates);
  let cursor = parseIsoDate(todayIso) || startOfDay(new Date());
  if (!set.has(toInputDate(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (set.has(toInputDate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function countInRange(dates, fromIso, toIso) {
  return dates.filter((iso) => iso >= fromIso && iso <= toIso).length;
}

function updateStats() {
  const today = new Date();
  const todayIso = toInputDate(today);
  const dates = getCompletedDates();
  const weekStart = toInputDate(startOfWeek(today));
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const monthDays = daysInMonth(today);

  document.getElementById("statStreak").textContent = String(calcStreak(dates, todayIso));
  document.getElementById("statWeek").textContent = `${countInRange(dates, weekStart, todayIso)}/7`;
  document.getElementById("statMonth").textContent = `${countInRange(dates, monthStart, todayIso)}/${monthDays}`;
}

function formatCharCount(count) {
  if (count >= 10000) return `${(count / 10000).toFixed(1)} 萬字`;
  return `${count} 字`;
}

function formatFrequencyLabel(days, filledDays) {
  if (!filledDays) return "這個區間還沒有復盤";
  const pace = days / filledDays;
  if (pace <= 1.2) return "幾乎天天都有寫";
  if (pace <= 2.2) return `大約每 ${pace.toFixed(1)} 天一篇`;
  if (pace <= 4) return "一週會寫幾次，節奏還算穩";
  return "寫得比較稀疏，但每一次都算數";
}

function rangeFor(type) {
  const today = startOfDay(new Date());
  if (type === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      fromIso: toInputDate(from),
      toIso: toInputDate(today),
      days: today.getDate(),
      label: "本月",
    };
  }
  const from = startOfWeek(today);
  return {
    fromIso: toInputDate(from),
    toIso: toInputDate(today),
    days: Math.round((today - from) / 86400000) + 1,
    label: "本週",
  };
}

function previousMonthRange() {
  const today = startOfDay(new Date());
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    fromIso: toInputDate(from),
    toIso: toInputDate(to),
    period: toInputDate(from).slice(0, 7),
    days: to.getDate(),
    label: "上月",
  };
}

function formatMonthLabel(period) {
  const [year, month] = String(period || "").split("-");
  if (!year || !month) return String(period || "月報");
  return `${year} 年 ${Number(month)} 月`;
}

function itemDateIso(item) {
  const date = String((item && (item.date || item.iso)) || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const created = String((item && item.createdAt) || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : "";
}

function enumerateReportDays(fromIso, toIso) {
  const days = [];
  const start = parseIsoDate(fromIso);
  const end = parseIsoDate(toIso);
  if (!start || !end || start > end) return days;
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 62) {
    days.push(toInputDate(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
}

function journalCheckCounts(review) {
  const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
  return {
    awareness: Array.isArray(journal.awarenessChecks) ? journal.awarenessChecks.filter(Boolean).length : 0,
    execution: Array.isArray(journal.executionChecks) ? journal.executionChecks.filter(Boolean).length : 0,
    manifestation: Array.isArray(journal.manifestChecks) ? journal.manifestChecks.filter(Boolean).length : 0,
  };
}

function libraryBucket(items, fromIso, toIso) {
  const bucket = { checked: 0, done: 0, doing: 0, later: 0, daysActive: 0 };
  const active = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const iso = itemDateIso(item);
    if (!iso || iso < fromIso || iso > toIso) return;
    bucket.checked += 1;
    active.add(iso);
    const status = String(item.status || "doing");
    if (status === "done") bucket.done += 1;
    else if (status === "later") bucket.later += 1;
    else bucket.doing += 1;
  });
  bucket.daysActive = active.size;
  return bucket;
}

function sampleLibraryTitles(items, fromIso, toIso, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      const iso = itemDateIso(item);
      return iso && iso >= fromIso && iso <= toIso;
    })
    .map((item) => String(item.title || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildGrowthStats(fromIso, toIso) {
  const reviews = getReviews();
  const insights = getInsights();
  const tasks = getTasks();
  const manifests = getManifests();
  const insightByDate = new Map();
  const taskByDate = new Map();
  const manifestByDate = new Map();
  const group = (list, map) => {
    list.forEach((item) => {
      const iso = itemDateIso(item);
      if (!iso) return;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push(item);
    });
  };
  group(insights, insightByDate);
  group(tasks, taskByDate);
  group(manifests, manifestByDate);

  const series = enumerateReportDays(fromIso, toIso).map((iso) => {
    const checks = journalCheckCounts(reviews[iso]);
    return {
      iso,
      awareness: checks.awareness || (insightByDate.get(iso) || []).length,
      execution: checks.execution || (taskByDate.get(iso) || []).length,
      manifestation: checks.manifestation || (manifestByDate.get(iso) || []).length,
    };
  });
  const sum = (key) => series.reduce((total, row) => total + Number(row[key] || 0), 0);
  const awarenessLib = libraryBucket(insights, fromIso, toIso);
  const executionLib = libraryBucket(tasks, fromIso, toIso);
  const manifestationLib = libraryBucket(manifests, fromIso, toIso);
  const awareness = {
    ...awarenessLib,
    checked: Math.max(awarenessLib.checked, sum("awareness")),
    done: Math.max(awarenessLib.done, awarenessLib.checked),
  };
  const execution = {
    ...executionLib,
    checked: Math.max(executionLib.checked, sum("execution")),
  };
  const manifestation = {
    ...manifestationLib,
    checked: Math.max(manifestationLib.checked, sum("manifestation")),
  };
  const filledDays = series.filter((row) => row.awareness || row.execution || row.manifestation).length;
  return {
    fromIso,
    toIso,
    days: series.length,
    filledDays,
    awareness,
    execution,
    manifestation,
    series,
    totals: {
      checked: awareness.checked + execution.checked + manifestation.checked,
      done: awareness.done + execution.done + manifestation.done,
      filledDays,
    },
    samples: {
      awareness: sampleLibraryTitles(insights, fromIso, toIso),
      execution: sampleLibraryTitles(tasks, fromIso, toIso),
      manifestation: sampleLibraryTitles(manifests, fromIso, toIso),
    },
  };
}

function completionRate(bucket) {
  const checked = Number(bucket && bucket.checked) || 0;
  const done = Number(bucket && bucket.done) || 0;
  if (!checked) return 0;
  return Math.round((done / checked) * 100);
}

function buildReport(type, rangeOverride) {
  const { fromIso, toIso, days, label } = rangeOverride || rangeFor(type);
  const reviews = getReviews();
  const entries = Object.keys(reviews)
    .filter((iso) => iso >= fromIso && iso <= toIso && reviewIsComplete(reviews[iso]))
    .sort()
    .map((iso) => {
      const review = reviews[iso];
      const text = reviewSearchText(review);
      return {
        iso,
        text,
        highlight: excerptText(review.organize?.themeTitle || review.organize?.conclusion || review.rawText, 90),
      };
    });

  const filledDays = entries.length;
  const totalChars = entries.reduce((sum, item) => sum + item.text.replace(/\s/g, "").length, 0);
  const stats = buildGrowthStats(fromIso, toIso);
  const period = type === "month" ? fromIso.slice(0, 7) : fromIso;

  return { type, label, fromIso, toIso, period, days, filledDays, totalChars, entries, stats };
}

function getStoredReports() {
  const saved = loadJson(STORAGE_KEYS.reports, {});
  return saved && typeof saved === "object" ? saved : {};
}

function reportCacheKey(type, period) {
  return `${type}:${period}`;
}

function readCachedReport(type, period) {
  return getStoredReports()[reportCacheKey(type, period)] || null;
}

function readLatestCachedReport(type) {
  const prefix = `${type}:`;
  const keys = Object.keys(getStoredReports())
    .filter((key) => key.startsWith(prefix))
    .sort();
  const last = keys[keys.length - 1];
  return last ? getStoredReports()[last] : null;
}

function writeCachedReport(type, period, report) {
  const all = getStoredReports();
  all[reportCacheKey(type, period)] = report;
  saveJson(STORAGE_KEYS.reports, all);
}

function compactReviewsForRange(fromIso, toIso) {
  const reviews = getReviews();
  return Object.keys(reviews)
    .filter((iso) => iso >= fromIso && iso <= toIso && reviewIsComplete(reviews[iso]))
    .sort()
    .map((iso) => {
      const review = reviews[iso];
      const ai = review.organize || {};
      return {
        date: iso,
        rawText: String(review.rawText || "").slice(0, 800),
        themeTitle: ai.themeTitle || "",
        conclusion: ai.conclusion || "",
        quotes: Array.isArray(ai.quotes) ? ai.quotes.slice(0, 3) : [],
        gratitude: review.gratitude || ai.gratitudeNote || "",
        themeCategory: ai.themeCategory || "",
        journal: review.journal && typeof review.journal === "object" ? review.journal : {},
      };
    });
}

async function fetchStoredCloudReport(type, period, latest) {
  if (!state.user) return null;
  const qs = latest ? "&latest=1" : "";
  const response = await fetchWithTimeout(
    `${location.origin}/api/generate-report?type=${encodeURIComponent(type)}&period=${encodeURIComponent(period)}&read=1${qs}`,
    { method: "GET" },
    8000
  );
  const payload = await response.json().catch(() => ({}));
  if (applyPaywallFromPayload(response, payload)) return null;
  return payload && payload.data && typeof payload.data === "object" ? payload.data : null;
}

async function generateCloudReport(type, fromIso, toIso, period, options = {}) {
  if (!state.user) return null;
  if (isAccessLocked()) {
    applyAccessLock();
    throw new Error(accessLockMessage());
  }
  const reviews = compactReviewsForRange(fromIso, toIso);
  const stats = options.stats || buildGrowthStats(fromIso, toIso);
  if (!reviews.length && !(stats.totals && stats.totals.checked)) return null;
  const response = await fetchWithTimeout(
    `${location.origin}/api/generate-report`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        period,
        fromIso,
        toIso,
        archive: Boolean(options.archive),
        reviews,
        stats,
        insights: getInsights(),
        tasks: getTasks(),
        manifests: getManifests(),
      }),
    },
    28000
  );
  const payload = await response.json().catch(() => ({}));
  if (applyPaywallFromPayload(response, payload) || !response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload.data || null;
}

async function fetchArchivedReportList() {
  const local = listLocalMonthArchives();
  if (!state.user) return local;
  try {
    const response = await fetchWithTimeout(
      `${location.origin}/api/generate-report?list=1`,
      { method: "GET" },
      8000
    );
    const payload = await response.json().catch(() => ({}));
    applyPaywallFromPayload(response, payload);
    const remote = Array.isArray(payload.data) ? payload.data : [];
    const map = new Map();
    [...local, ...remote.filter((item) => item && item.type !== "week")].forEach((item) => {
      const period = String(item.period || "");
      if (!period) return;
      const current = map.get(period);
      if (!current || String(item.generatedAt || "") >= String(current.generatedAt || "")) map.set(period, item);
    });
    return [...map.values()].sort((left, right) => String(right.period).localeCompare(String(left.period)));
  } catch {
    return local;
  }
}

function scheduleCloudSync() {
  if (!state.user || state.syncing) return;
  clearTimeout(scheduleCloudSync.timer);
  scheduleCloudSync.timer = setTimeout(() => {
    pushCloudData().catch(() => {});
  }, 900);
}

function collectCloudBundle() {
  return {
    reviews: getReviews(),
    tasks: getTasks(),
    sfm: getSfm(),
    insights: getInsights(),
    manifests: getManifests(),
    reports: getStoredReports(),
  };
}

async function pushCloudData() {
  if (!state.user || typeof location === "undefined" || location.protocol === "file:") return;
  const bundle = collectCloudBundle();
  const client = await getSupabase();
  if (client) {
    const { error } = await client.from("nichi_user_data").upsert(
      {
        user_id: state.user.id,
        email: state.user.email || "",
        reviews: bundle.reviews,
        tasks: bundle.tasks,
        sfm: bundle.sfm,
        reports: { ...(bundle.reports || {}), __insights: bundle.insights || [], __manifests: bundle.manifests || [] },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) console.warn("[日精進] Supabase 寫入失敗", error.message);
  }
  const response = await fetch(`${location.origin}/api/sync`, {
    method: "PUT",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...bundle, email: state.user.email || "" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    if (client) return;
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
}

function newerStamp(left, right) {
  return String((left && left.updatedAt) || "") >= String((right && right.updatedAt) || "");
}

function mergeCloudBundle(cloud) {
  state.syncing = true;
  try {
    const localReviews = getReviews();
    const nextReviews = { ...localReviews };
    Object.entries(cloud.reviews || {}).forEach(([iso, review]) => {
      if (!nextReviews[iso] || newerStamp(review, nextReviews[iso])) nextReviews[iso] = review;
    });
    saveJson(STORAGE_KEYS.reviews, nextReviews, { silent: true });

    const taskMap = new Map();
    [...getTasks(), ...(Array.isArray(cloud.tasks) ? cloud.tasks : [])].forEach((task) => {
      if (!task || !task.id) return;
      const current = taskMap.get(task.id);
      if (!current || newerStamp(task, current)) taskMap.set(task.id, task);
    });
    saveJson(STORAGE_KEYS.tasks, [...taskMap.values()], { silent: true });

    const sfmMap = new Map();
    [...getSfm(), ...(Array.isArray(cloud.sfm) ? cloud.sfm : [])].forEach((item) => {
      if (!item || !item.id) return;
      const current = sfmMap.get(item.id);
      if (!current || newerStamp(item, current)) sfmMap.set(item.id, item);
    });
    saveJson(STORAGE_KEYS.sfm, [...sfmMap.values()], { silent: true });

    const rawInsights = Array.isArray(cloud.insights)
      ? cloud.insights
      : Array.isArray(cloud.reports && cloud.reports.__insights)
        ? cloud.reports.__insights
        : [];
    const insightMap = new Map();
    [...getInsights(), ...rawInsights].forEach((item) => {
      if (!item || !item.id) return;
      const current = insightMap.get(item.id);
      if (!current || newerStamp(item, current)) insightMap.set(item.id, item);
    });
    saveJson(STORAGE_KEYS.insights, [...insightMap.values()], { silent: true });

    const rawManifests = Array.isArray(cloud.manifests)
      ? cloud.manifests
      : Array.isArray(cloud.reports && cloud.reports.__manifests)
        ? cloud.reports.__manifests
        : [];
    const manifestMap = new Map();
    [...getManifests(), ...rawManifests].forEach((item) => {
      if (!item || !item.id) return;
      const current = manifestMap.get(item.id);
      if (!current || newerStamp(item, current)) manifestMap.set(item.id, item);
    });
    saveJson(STORAGE_KEYS.manifests, [...manifestMap.values()], { silent: true });

    const reports = { ...(cloud.reports || {}) };
    delete reports.__insights;
    delete reports.__manifests;
    saveJson(STORAGE_KEYS.reports, { ...getStoredReports(), ...reports }, { silent: true });
  } finally {
    state.syncing = false;
  }
}

async function pullCloudData() {
  if (!state.user) return;
  const fromSb = await loadSupabaseRecords();
  if (fromSb) {
    mergeCloudBundle(fromSb);
  } else {
    const response = await fetch(`${location.origin}/api/sync`, {
      method: "GET",
      credentials: "include",
      headers: authHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.ok !== false) mergeCloudBundle(payload.data || {});
  }
  try {
    loadReviewForDate(currentIso());
    updateStats();
    if (state.page === "next") renderInsights();
    if (state.page === "sfm") renderTasks();
    if (state.page === "manifest") renderManifests();
    if (state.page === "history") renderHistory();
    if (state.page === "report") renderReport();
  } catch {
    /* 畫面重整失敗也不擋同步 */
  }
}

function renderAuth() {
  const side = document.getElementById("sideAuth");
  const top = document.getElementById("topAuthBtn");
  const user = state.user;
  if (top) {
    top.textContent = user ? user.name || user.email || "已登入" : "Google 登入";
    top.title = user ? "登出" : "使用 Google 帳號登入";
  }
  if (!side) {
    applyAccessLock();
    return;
  }
  if (!user) {
    side.innerHTML = `
      <button class="auth-login" id="btnGoogleLogin" type="button">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="#4285F4" d="M22.6 12.25c0-.8-.07-1.57-.2-2.31H12v4.37h5.95a5.08 5.08 0 0 1-2.2 3.34v2.77h3.56c2.08-1.92 3.29-4.75 3.29-8.17Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.26 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A10.99 10.99 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.72.12-1.43.34-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.85Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85C6.71 7.31 9.14 5.38 12 5.38Z" />
        </svg>
        <span>使用 Google 帳號登入</span>
      </button>
      <p class="auth-form__error" id="authError" hidden></p>
      <p class="auth-hint">Google 登入後享有 7 天完整功能免費試用。</p>
    `;
    if (lastAuthError) setAuthError(lastAuthError);
    applyAccessLock();
    return;
  }
  const initial = escapeHtml((user.name || user.email || "我").slice(0, 1));
  const avatar = user.picture
    ? `<img src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="auth-avatar">${initial}</span>`;
  const membership = state.membership || {};
  const status = membership.status || "";
  const entitled = Boolean(membership.entitled || membership.paid || membership.isPaid);
  const payBtn = entitled && (membership.paid || membership.isPaid || status === "active")
    ? `<button class="auth-pay is-paid" type="button" disabled><span>已解鎖無限暢用</span></button>`
    : `<button class="auth-pay" id="btnNewebPay" type="button" data-open-pricing><span>${status === "trialing" || status === "pending" ? "選擇方案升級" : "選擇方案解鎖"}</span></button>`;
  const trialHint = membership.trialEndsAt && (status === "trialing" || entitled && !membership.paid && !membership.isPaid)
    ? `<p class="auth-hint">7 天免費試用至 ${escapeHtml(formatTrialDate(membership.trialEndsAt))}${membership.daysLeft != null ? `，還有 ${membership.daysLeft} 天` : ""}。</p>`
    : entitled && (status === "active" || membership.paid || membership.isPaid)
      ? `<p class="auth-hint">一次付清已完成，功能已全部解鎖。</p>`
      : status === "expired" || status === "cancelled" || status === "past_due" || (!entitled && status)
        ? `<p class="auth-hint">7 天免費體驗已結束，可選月繳 $599 或季繳 $1,197 解鎖暢用。</p>`
        : `<p class="auth-hint">登入後享有 7 天完整功能免費試用。</p>`;
  side.innerHTML = `
    <div class="auth-user">
      ${avatar}
      <div class="auth-user__meta">
        <p class="auth-user__name">${escapeHtml(user.name || "已登入")}</p>
        <p class="auth-user__email">${escapeHtml(user.email || "")}</p>
      </div>
    </div>
    ${payBtn}
    <button class="auth-logout" id="btnSignOut" type="button"><span>登出</span></button>
    ${trialHint}
  `;
  bindSubscribeButton();
  applyAccessLock();
}

let supabaseClient = null;
let supabaseInit = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (supabaseInit) return supabaseInit;
  supabaseInit = (async () => {
    if (typeof window === "undefined" || !window.supabase) return null;
    const createClient = window.supabase.createClient || (window.supabase.default && window.supabase.default.createClient);
    if (!createClient) return null;
    if (typeof location === "undefined" || location.protocol === "file:") return null;
    const response = await fetch(`${location.origin}/api/config`);
    const cfg = await response.json().catch(() => ({}));
    const url = String(cfg.supabaseUrl || "").trim();
    const key = String(cfg.supabaseAnonKey || "").trim();
    if (!url || !key) return null;
    const authStorage = window.NichiAuthStorage && window.NichiAuthStorage.createAuthStorage();
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        storageKey: "nichi-auth",
        ...(authStorage ? { storage: authStorage } : {}),
      },
    });
    if (supabaseClient.auth.initialize) await supabaseClient.auth.initialize();
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      const prev = state.user && state.user.id;
      applySession(session);
      const next = state.user && state.user.id;
      if (prev !== next) renderAuth();
    });
    return supabaseClient;
  })();
  const client = await supabaseInit;
  supabaseInit = null;
  return client;
}

function applySession(session) {
  const user = session && session.user;
  state.accessToken = (session && session.access_token) || "";
  state.user = user
    ? {
        id: String(user.id),
        email: String(user.email || "").trim(),
        name: String((user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) || user.email || "").trim(),
        picture: String((user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || "").trim(),
      }
    : null;
}

async function ensureFreshAccessToken() {
  const client = await getSupabase();
  if (!client) return "";
  let session = null;
  try {
    const current = await client.auth.getSession();
    session = current.data && current.data.session;
    const expiresAt = session && session.expires_at ? Number(session.expires_at) * 1000 : 0;
    if (!session || (expiresAt && expiresAt < Date.now() + 60 * 1000)) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.data && refreshed.data.session) session = refreshed.data.session;
    }
  } catch (error) {
    console.warn("ensureFreshAccessToken failed", error && error.message ? error.message : error);
  }
  applySession(session);
  if (!state.accessToken) {
    const stored = tokenFromLocalStorage();
    if (stored) state.accessToken = stored;
  }
  return state.accessToken;
}

let lastAuthError = "";

function setAuthError(message) {
  lastAuthError = String(message || "").trim();
  const el = document.getElementById("authError");
  if (!el) return;
  el.hidden = !lastAuthError;
  el.textContent = lastAuthError;
}

function translateAuthError(error) {
  const message = String(error?.message || error || "登入失敗");
  if (/popup|provider is not enabled|unsupported provider/i.test(message)) {
    return "尚未在 Supabase 開啟 Google 登入。請到 Authentication → Providers 啟用 Google。";
  }
  if (/PKCE verifier not found|Auth session missing|code verifier/i.test(message)) {
    return "登入驗證已過期，瀏覽器找不到 PKCE 驗證碼。請再點一次「使用 Google 帳號登入」，並避免用無痕視窗或不同瀏覽器開啟回調連結。";
  }
  if (/Unable to exchange external code|invalid_grant|invalid_client/i.test(message)) {
    return "Google 授權碼交換失敗。請確認 Google Cloud 的重新導向 URI 是 https://zmjfbdtwxuawebwnybfp.supabase.co/auth/v1/callback，且 Client ID / Secret 是同一組網頁應用程式憑證。";
  }
  if (/rate limit|too many/i.test(message)) return "嘗試太多次，請稍後再試。";
  return message;
}

async function afterAuthSuccess() {
  renderAuth();
  showToast("已登入，正在讀取你的紀錄…");
  try {
    await pullCloudData();
    await pushCloudData();
    showToast("已載入你的個人紀錄。");
  } catch (error) {
    showToast(`紀錄讀取失敗：${error.message || error}`);
  }
}

async function signInWithGoogle() {
  const client = await getSupabase();
  if (!client) {
    const msg = "尚未設定 Supabase。請在 Vercel 加上 SUPABASE_URL 與 SUPABASE_ANON_KEY。";
    setAuthError(msg);
    showToast(msg);
    return;
  }
  setAuthError("");
  if (window.NichiAuthStorage && window.NichiAuthStorage.clearAuthArtifacts) {
    window.NichiAuthStorage.clearAuthArtifacts({ keepSession: true });
  }
  const redirectTo = `${location.origin}/auth/callback.html`;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: "openid email profile",
    },
  });
  if (error) {
    const message = translateAuthError(error);
    setAuthError(message);
    showToast(message);
    return;
  }
  if (!data || !data.url) {
    const message = "沒有取得 Google 授權網址，請再試一次。";
    setAuthError(message);
    showToast(message);
    return;
  }
  if (window.NichiAuthStorage) {
    window.NichiAuthStorage.persistVerifierCopies();
    if (!window.NichiAuthStorage.readVerifier()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      window.NichiAuthStorage.persistVerifierCopies();
    }
    if (!window.NichiAuthStorage.readVerifier()) {
      const message = "無法儲存登入驗證碼。請關閉無痕模式，並允許此網站使用 Cookie 後再試。";
      setAuthError(message);
      showToast(message);
      return;
    }
  }
  window.location.replace(data.url);
}

async function signOutUser() {
  const client = await getSupabase();
  if (client) await client.auth.signOut();
  state.user = null;
  state.accessToken = "";
  state.membership = null;
  renderAuth();
  showToast("已登出。本機草稿仍在這台裝置上。");
}

function submitNewebPayForm(gateway, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = gateway;
  form.acceptCharset = "UTF-8";
  form.enctype = "application/x-www-form-urlencoded";
  const tradeInfo = fields && fields.TradeInfo != null ? String(fields.TradeInfo).replace(/\s+/g, "").toLowerCase() : "";
  const tradeSha = fields && fields.TradeSha != null ? String(fields.TradeSha).replace(/\s+/g, "").toUpperCase() : "";
  if (!/^[0-9a-f]+$/.test(tradeInfo) || tradeInfo.includes("%")) {
    showToast("TradeInfo 不是純 hex，已中止送出以免簽章不符");
    return;
  }
  if (!/^[0-9A-F]{64}$/.test(tradeSha)) {
    showToast("TradeSha 必須是 64 碼大寫 hex");
    return;
  }
  const payload = {
    MerchantID: String((fields && fields.MerchantID) || "").replace(/\s+/g, ""),
    TradeInfo: tradeInfo,
    TradeSha: tradeSha,
    Version: String((fields && fields.Version) || "2.0"),
    EncryptType: "0",
  };
  if (payload.MerchantID !== "HTC109030010100") {
    showToast("商店代號必須是 HTC109030010100");
    return;
  }
  Object.entries(payload).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  console.log("MPG form TradeInfo chars", tradeInfo.length, "hasPercent", tradeInfo.includes("%"), "shaUpper", tradeSha);
  document.body.appendChild(form);
  form.submit();
}

function isMembershipLive(membership) {
  if (!membership) return false;
  if (membership.paid || membership.isPaid) return true;
  const ends = Date.parse(membership.trialEndsAt || "");
  if (Number.isFinite(ends)) return Date.now() < ends;
  return Boolean(membership.entitled);
}

function accessLockMode() {
  if (!state.user) return "guest";
  if (state.membership == null && !state.authReady) return "pending";
  if (!state.membership) return "";
  return isMembershipLive(state.membership) ? "" : "expired";
}

function isAccessLocked() {
  return Boolean(accessLockMode());
}

function accessLockMessage() {
  return accessLockMode() === "expired"
    ? "您的 7 天免費體驗已結束，升級訂閱即可解鎖完整無限暢用權限"
    : "請先使用 Google 登入，即可解鎖 7 天完整免費試用";
}

function applyPaywallFromPayload(response, payload) {
  if (!(response && (response.status === 402 || (payload && payload.paywall)))) return false;
  const current = state.membership || {};
  state.membership = {
    ...current,
    entitled: false,
    paid: false,
    isPaid: false,
    status: current.status === "active" || current.status === "past_due" ? current.status : "expired",
  };
  applyAccessLock();
  renderAuth();
  return true;
}

function applyAccessLock() {
  const mode = accessLockMode();
  const locked = Boolean(mode);
  document.body.classList.toggle("is-locked", locked);
  document.body.dataset.lockMode = mode || "";
  const paywall = document.getElementById("paywall");
  if (paywall) {
    paywall.hidden = !locked;
    paywall.dataset.mode = mode || "guest";
    if (locked) {
      paywall.querySelectorAll("[data-newebpay]").forEach((el) => {
        el.setAttribute("href", NEWEBPAY_EPG_URL);
      });
    }
  }
  const view = document.getElementById("view");
  if (view) {
    if (locked) view.setAttribute("inert", "");
    else view.removeAttribute("inert");
  }
  bindSubscribeButton();
  syncPricingModal();
}

function bindSubscribeButton() {
  document.querySelectorAll("[data-newebpay], [data-plan-cta]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", onSubscribeClick);
  });
}

function onSubscribeClick(event) {
  console.log("Subscribe button clicked");
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const trigger = event && event.currentTarget ? event.currentTarget : event && event.target;
  const plan = trigger && trigger.closest ? trigger.closest("[data-plan]") : null;
  startNewebPay(plan && plan.dataset.plan);
}

function startNewebPay(planId) {
  if (!state.user) {
    closePricingModal();
    showToast("請先用 Google 登入，即可享有 7 天完整試用。");
    signInWithGoogle();
    return;
  }
  const plan = NEWEBPAY_PLANS[planId] || NEWEBPAY_PLANS.quarter;
  window.location.assign(plan.url || NEWEBPAY_EPG_URL);
}

function openPricingModal() {
  const modal = document.getElementById("pricingModal");
  if (!modal) return;
  syncPricingModal();
  bindSubscribeButton();
  if (typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
}

function closePricingModal() {
  const modal = document.getElementById("pricingModal");
  if (!modal) return;
  if (typeof modal.close === "function" && modal.open) modal.close();
  else modal.removeAttribute("open");
}

function syncPricingModal() {
  const membership = state.membership || {};
  const paid = Boolean(membership.paid || membership.isPaid || membership.status === "active");
  const loggedIn = Boolean(state.user);
  document.querySelectorAll("[data-plan-cta]").forEach((btn) => {
    const plan = btn.dataset.plan;
    if (paid) {
      btn.disabled = true;
      btn.textContent = "已解鎖暢用";
      return;
    }
    btn.disabled = false;
    if (!loggedIn) {
      btn.textContent = plan === "quarter" ? "登入並立即升級" : "登入開始試用";
      return;
    }
    if (isAccessLocked()) {
      btn.textContent = "立即升級";
      return;
    }
    btn.textContent = plan === "quarter" ? "立即升級" : "開始試用";
  });
}

function rowsToReviewMap(rows) {
  const out = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== "object") return;
    const iso = String(row.date || row.iso || row.review_date || row.day || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    out[iso] = {
      date: iso,
      rawText: row.raw_text || row.rawText || row.content || row.body || "",
      organize: row.organize || row.ai || null,
      think: row.think || null,
      gratitude: row.gratitude || "",
      journal: row.journal || null,
      completedAt: row.completed_at || row.completedAt || row.updated_at || "",
      userId: row.user_id || state.user?.id || "",
    };
  });
  return out;
}

function normalizeRemoteBundle(row) {
  if (!row || typeof row !== "object") return null;
  const nested = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : null;
  const reviews = row.reviews || (nested && nested.reviews);
  const tasks = row.tasks || (nested && nested.tasks);
  const sfm = row.sfm || (nested && nested.sfm);
  const reports = row.reports || (nested && nested.reports);
  const reportsRaw = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  const insights = row.insights || (nested && nested.insights) || reportsRaw.__insights;
  const manifests = row.manifests || (nested && nested.manifests) || reportsRaw.__manifests;
  delete reportsRaw.__insights;
  delete reportsRaw.__manifests;
  if (!reviews && !tasks && !sfm && !Object.keys(reportsRaw).length && !(insights && insights.length) && !(manifests && manifests.length)) return null;
  return {
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    insights: Array.isArray(insights) ? insights : [],
    manifests: Array.isArray(manifests) ? manifests : [],
    reports: reportsRaw,
  };
}

async function fetchOwnRow(client, table, user) {
  const attempts = [
    () => client.from(table).select("*").eq("user_id", user.id).maybeSingle(),
    () => client.from(table).select("*").eq("id", user.id).maybeSingle(),
    () => client.from(table).select("*").eq("email", user.email).maybeSingle(),
  ];
  for (const run of attempts) {
    try {
      const { data, error } = await run();
      if (!error && data) return data;
    } catch {
      /* 換下一種查法 */
    }
  }
  return null;
}

async function loadSupabaseRecords() {
  const client = await getSupabase();
  const user = state.user;
  if (!client || !user) return null;
  const tables = ["nichi_user_data", "user_data", "user_records", "profiles"];
  for (const table of tables) {
    const row = await fetchOwnRow(client, table, user);
    const bundle = normalizeRemoteBundle(row);
    if (bundle) return bundle;
  }
  try {
    const { data, error } = await client.from("reviews").select("*").eq("user_id", user.id);
    if (!error && Array.isArray(data) && data.length) {
      const reviews = rowsToReviewMap(data);
      let tasks = [];
      let sfm = [];
      try {
        const taskRes = await client.from("tasks").select("*").eq("user_id", user.id);
        if (!taskRes.error && Array.isArray(taskRes.data)) tasks = taskRes.data;
      } catch {
        /* optional */
      }
      try {
        const sfmRes = await client.from("sfm").select("*").eq("user_id", user.id);
        if (!sfmRes.error && Array.isArray(sfmRes.data)) sfm = sfmRes.data;
      } catch {
        /* optional */
      }
      return { reviews, tasks, sfm, reports: {} };
    }
  } catch {
    /* 沒有 reviews 表就略過 */
  }
  return null;
}

async function refreshAuth() {
  renderAuth();
  try {
    const client = await getSupabase();
    state.authConfigured = Boolean(client);
    if (client) {
      await ensureFreshAccessToken();
    }
    if (typeof location !== "undefined" && location.protocol !== "file:") {
      const response = await fetch(`${location.origin}/api/auth/me`, {
        credentials: "include",
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      state.payConfigured = Boolean(payload.payConfigured);
      state.membership = payload.membership || null;
      if (payload.membershipError) setAuthError(payload.membershipError);
      if (!state.user && payload.user) state.user = payload.user;
    }
    state.authReady = true;
    renderAuth();
    applyAccessLock();
    if (state.user) {
      await pullCloudData();
      await pushCloudData();
    }
  } catch {
    state.authReady = true;
    renderAuth();
    applyAccessLock();
  }
}

async function watchPaidUnlock() {
  showToast("付款已送出。正在確認會員狀態…");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 900 : 2000));
    await refreshAuth();
    if (state.membership && (state.membership.paid || state.membership.isPaid)) {
      showToast("付款成功，功能已全部解鎖。");
      return;
    }
  }
  showToast("若畫面尚未解鎖，請稍候再重新整理。藍新通知到達後會自動開通。");
}

function handleAuthQuery() {
  try {
    const params = new URLSearchParams(location.search);
    const auth = params.get("auth");
    const pay = params.get("pay");
    const oauthError = params.get("error_description") || params.get("error");
    let storedAuthError = "";
    try {
      storedAuthError = sessionStorage.getItem("nichi.authError") || "";
      if (storedAuthError) sessionStorage.removeItem("nichi.authError");
    } catch {
      storedAuthError = "";
    }
    if (!auth && !pay && !oauthError && !storedAuthError) return;
    if (auth === "ok") showToast("已登入，7 天完整免費試用已開始。");
    if (auth === "out") showToast("已登出。本機草稿仍在這台裝置上。");
    if (auth === "error" || oauthError || storedAuthError) {
      const raw = storedAuthError || oauthError || params.get("reason") || "請再試一次";
      const message = translateAuthError(raw);
      setAuthError(message);
      showToast(`登入失敗：${message}`);
    }
    if (pay === "ok") watchPaidUnlock();
    if (pay === "fail" || pay === "error") {
      const code = params.get("code") || "";
      const reason = params.get("reason") || "請再試一次";
      const message = [code, reason].filter(Boolean).join(" ");
      setAuthError(message);
      showToast(pay === "fail" ? `付款未完成：${message}` : `付款結果異常：${message}`);
    }
    if (pay === "back") showToast("已返回商店，尚未完成付款。");
    params.delete("auth");
    params.delete("reason");
    params.delete("code");
    params.delete("pay");
    params.delete("order");
    params.delete("error");
    params.delete("error_description");
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    history.replaceState({}, "", next);
  } catch {
    /* ignore */
  }
}

function syncReviewsToCloud() {
  scheduleCloudSync();
}

function listLocalMonthArchives() {
  const stored = getStoredReports();
  const fromCache = Object.entries(stored)
    .filter(([key, value]) => key.startsWith("month:") && value && typeof value === "object")
    .map(([key, value]) => ({
      type: "month",
      period: value.period || key.slice(6),
      title: value.title || formatMonthLabel(value.period || key.slice(6)),
      generatedAt: value.generatedAt || "",
      fromIso: value.fromIso || "",
      toIso: value.toIso || "",
      archived: true,
    }));
  const current = toInputDate(new Date()).slice(0, 7);
  const months = new Set(fromCache.map((item) => item.period));
  Object.keys(getReviews()).forEach((iso) => {
    const month = iso.slice(0, 7);
    if (month && month < current) months.add(month);
  });
  getInsights().concat(getTasks(), getManifests()).forEach((item) => {
    const month = itemDateIso(item).slice(0, 7);
    if (month && month < current) months.add(month);
  });
  const map = new Map();
  fromCache.forEach((item) => map.set(item.period, item));
  [...months].forEach((period) => {
    if (map.has(period)) return;
    map.set(period, {
      type: "month",
      period,
      title: `${formatMonthLabel(period)}成長報告`,
      generatedAt: "",
      fromIso: `${period}-01`,
      toIso: "",
      archived: true,
    });
  });
  return [...map.values()].sort((left, right) => String(right.period).localeCompare(String(left.period)));
}

function lastDayOfMonthIso(period) {
  const [year, month] = String(period || "").split("-").map(Number);
  if (!year || !month) return "";
  return toInputDate(new Date(year, month, 0));
}

function destroyReportCharts(prefix) {
  const charts = state.reportCharts || {};
  const keys = prefix
    ? [`${prefix}Radar`, `${prefix}Bars`]
    : Object.keys(charts);
  keys.forEach((key) => {
    if (charts[key] && typeof charts[key].destroy === "function") charts[key].destroy();
    charts[key] = null;
  });
}

function chartPalette() {
  return {
    awareness: "#9c8879",
    execution: "#c4a484",
    manifestation: "#8f7468",
    awarenessSoft: "rgba(156, 136, 121, 0.35)",
    executionSoft: "rgba(196, 164, 132, 0.45)",
    manifestationSoft: "rgba(143, 116, 104, 0.4)",
    tick: "#8a7d72",
    grid: "rgba(232, 221, 208, 0.9)",
  };
}

function paintReportCharts(stats, prefix = "report") {
  destroyReportCharts(prefix);
  const ChartLib = typeof window !== "undefined" ? window.Chart : null;
  const data = stats || { awareness: {}, execution: {}, manifestation: {}, series: [] };
  const colors = chartPalette();
  const radarEl = document.getElementById(`${prefix}Radar`);
  const barsEl = document.getElementById(`${prefix}Bars`);
  const awareness = Number(data.awareness?.checked || 0);
  const execution = Number(data.execution?.checked || 0);
  const manifestation = Number(data.manifestation?.checked || 0);
  const series = Array.isArray(data.series) ? data.series : [];
  if (!ChartLib || !radarEl || !barsEl) {
    paintReportChartFallback(data, prefix);
    return;
  }
  const max = Math.max(4, awareness, execution, manifestation);
  state.reportCharts[`${prefix}Radar`] = new ChartLib(radarEl, {
    type: "radar",
    data: {
      labels: ["覺察力", "執行力", "顯化力"],
      datasets: [
        {
          label: "已勾選",
          data: [awareness, execution, manifestation],
          backgroundColor: colors.awarenessSoft,
          borderColor: colors.awareness,
          pointBackgroundColor: colors.manifestation,
          pointBorderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max,
          ticks: { stepSize: Math.ceil(max / 4) || 1, color: colors.tick, backdropColor: "transparent", showLabelBackdrop: false },
          pointLabels: { color: colors.tick, font: { size: 13, family: "Noto Sans TC, sans-serif" } },
          grid: { color: colors.grid },
          angleLines: { color: colors.grid },
        },
      },
    },
  });
  state.reportCharts[`${prefix}Bars`] = new ChartLib(barsEl, {
    type: "bar",
    data: {
      labels: series.map((row) => String(row.iso || "").slice(5).replace("-", "/")),
      datasets: [
        { label: "覺察力", data: series.map((row) => row.awareness || 0), backgroundColor: colors.awareness, stack: "growth" },
        { label: "執行力", data: series.map((row) => row.execution || 0), backgroundColor: colors.execution, stack: "growth" },
        { label: "顯化力", data: series.map((row) => row.manifestation || 0), backgroundColor: colors.manifestation, stack: "growth" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: colors.tick, boxWidth: 10, font: { family: "Noto Sans TC, sans-serif" } },
        },
      },
      scales: {
        x: { stacked: true, ticks: { color: colors.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { color: colors.tick, precision: 0 }, grid: { color: colors.grid } },
      },
    },
  });
}

function paintReportChartFallback(stats, prefix) {
  const host = document.getElementById(`${prefix}ChartFallback`);
  if (!host) return;
  const series = Array.isArray(stats?.series) ? stats.series : [];
  const max = Math.max(1, ...series.map((row) => (row.awareness || 0) + (row.execution || 0) + (row.manifestation || 0)));
  host.hidden = false;
  host.innerHTML = series
    .map((row) => {
      const total = (row.awareness || 0) + (row.execution || 0) + (row.manifestation || 0);
      return `<div class="chart-fallback__row"><span>${escapeHtml(String(row.iso || "").slice(5))}</span><i style="width:${Math.round((total / max) * 100)}%"></i></div>`;
    })
    .join("");
}

function renderChartCard(stats, prefix = "report") {
  const data = stats || { awareness: {}, execution: {}, manifestation: {}, totals: {} };
  return `
    <article class="report-card report-card--charts">
      <h3>三力成長圖表</h3>
      <p class="report-range">覺察力、執行力、顯化力在這個區間的勾選量與完成頻率。</p>
      <div class="growth-metrics">
        <article class="growth-metric">
          <span>覺察力</span>
          <strong>${data.awareness?.checked || 0}</strong>
          <em>完成 ${completionRate(data.awareness)}%</em>
        </article>
        <article class="growth-metric">
          <span>執行力</span>
          <strong>${data.execution?.checked || 0}</strong>
          <em>完成 ${completionRate(data.execution)}%</em>
        </article>
        <article class="growth-metric">
          <span>顯化力</span>
          <strong>${data.manifestation?.checked || 0}</strong>
          <em>完成 ${completionRate(data.manifestation)}%</em>
        </article>
      </div>
      <div class="chart-grid">
        <div class="chart-panel">
          <p class="chart-panel__label">雷達圖 · 三力結構</p>
          <div class="chart-wrap"><canvas id="${prefix}Radar" aria-label="覺察力執行力顯化力雷達圖"></canvas></div>
        </div>
        <div class="chart-panel">
          <p class="chart-panel__label">堆疊柱狀圖 · 每日勾選</p>
          <div class="chart-wrap chart-wrap--wide"><canvas id="${prefix}Bars" aria-label="每日勾選堆疊柱狀圖"></canvas></div>
        </div>
      </div>
      <div class="chart-fallback" id="${prefix}ChartFallback" hidden></div>
    </article>
  `;
}

function renderAiReportBlock(ai, status) {
  if (status === "loading") {
    return `
      <article class="report-card report-card--ai report-card--coach">
        <h3>💡 深度思考</h3>
        <p class="report-empty">正在把這個區間的勾選量、趨勢與復盤摘要，整理成閃光點與突破口…</p>
      </article>
    `;
  }
  if (status === "error") {
    return `
      <article class="report-card report-card--ai report-card--coach">
        <h3>💡 深度思考</h3>
        <p class="report-empty">${escapeHtml(ai || "雲端洞察暫時不可用。圖表與本地摘要仍在上面。")}</p>
      </article>
    `;
  }
  if (!ai) return "";
  const list = (items) =>
    Array.isArray(items) && items.length
      ? `<ul class="review-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
  const rangeNote =
    ai.fromIso && ai.toIso
      ? `${formatDisplayDate(ai.fromIso)} — ${formatDisplayDate(ai.toIso)}`
      : "";
  const highlights = ai.highlights && ai.highlights.length ? ai.highlights : [];
  const breakthroughs = ai.breakthroughs && ai.breakthroughs.length ? ai.breakthroughs : ai.nextPlan;
  const takeaways = ai.insights && ai.insights.length ? ai.insights : [];
  const analysis = String(ai.analysis || "").trim();
  const summary = String(ai.summary || "").trim();
  const psychology = analysis || summary;
  return `
    <article class="report-card report-card--ai report-card--coach">
      <h3>💡 深度思考</h3>
      ${rangeNote ? `<p class="report-range">${escapeHtml(rangeNote)}</p>` : ""}
      ${ai.title ? `<p class="insight-card__headline">${escapeHtml(ai.title)}</p>` : ""}
      ${summary && summary !== psychology ? `<p class="rv-card__conclusion">${escapeHtml(summary)}</p>` : ""}
      <div class="report-insight">
        ${
          psychology
            ? `<section class="insight-block">
          <p class="insight-block__label">① 今天的身心訊號</p>
          ${emphasizeLeadHtml(psychology)}
        </section>`
            : ""
        }
        ${
          String(ai.reflection || "").trim()
            ? `<section class="insight-block insight-block--review">
          <p class="insight-block__label">② 客觀檢討與反思</p>
          ${emphasizeLeadHtml(String(ai.reflection).trim())}
        </section>`
            : ""
        }
        ${
          breakthroughs && breakthroughs.length
            ? `<section class="insight-block insight-block--tips">
          <p class="insight-block__label">③ 具體突破建議（怎麼做會更好）</p>
          ${actionStepsHtml(breakthroughs)}
        </section>`
            : ""
        }
        ${
          takeaways.length
            ? `<section class="insight-block insight-block--focus">
          <p class="insight-block__label">💡 今日核心重點整理</p>
          ${insightListHtml(takeaways, "insight-block__takeaways")}
        </section>`
            : ""
        }
      </div>
      <p class="sfm-hint">${ai.generatedAt ? `生成於 ${escapeHtml(String(ai.generatedAt).replace("T", " ").slice(0, 16))}` : "雲端聚合"}</p>
    </article>
    <article class="report-card report-card--glow">
      <h3>本期閃光點</h3>
      ${list(highlights) || `<p class="report-empty">這一段還沒有足夠的復盤可以聚合。</p>`}
    </article>
    <article class="report-card report-card--break">
      <h3>成長突破口</h3>
      ${list(breakthroughs) || `<p class="report-empty">這一段還沒有足夠的復盤可以聚合。</p>`}
    </article>
    ${
      Array.isArray(ai.patterns) && ai.patterns.length
        ? `<article class="report-card report-card--pattern">
      <h3>隱性模式</h3>
      ${list(ai.patterns)}
    </article>`
        : ""
    }
  `;
}

function renderHistoryReportList(items) {
  if (!items.length) {
    return `<div class="empty"><p class="empty__title">還沒有封存的月報</p>每月 1 號會自動結算上個月，也可以在這裡回看過去的成長。</div>`;
  }
  return items
    .map((item) => {
      const period = item.period || "";
      return `
        <article class="archive-card">
          <div>
            <p class="archive-card__title">${escapeHtml(item.title || `${formatMonthLabel(period)}成長報告`)}</p>
            <p class="archive-card__meta">${escapeHtml(formatMonthLabel(period))}${item.generatedAt ? ` · ${escapeHtml(String(item.generatedAt).slice(0, 10).replace(/-/g, "/"))}` : " · 可開啟數據存檔"}</p>
          </div>
          <div class="archive-card__actions">
            <button class="btn btn--ghost btn--tiny" data-open-archive="${escapeHtml(period)}" type="button">查看</button>
            <button class="btn btn--ghost btn--tiny" data-print-archive="${escapeHtml(period)}" type="button">PDF / 列印</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function hydrateAiReport(type, local, token) {
  const root = document.getElementById("reportAi");
  if (!root) return;
  const period = local.period || (type === "month" ? local.fromIso.slice(0, 7) : local.fromIso);
  const cached = readCachedReport(type, period) || readLatestCachedReport(type);
  if (cached) root.innerHTML = renderAiReportBlock(cached);
  else root.innerHTML = renderAiReportBlock(null, "loading");

  try {
    let report = await fetchStoredCloudReport(type, period);
    if (!report) report = await fetchStoredCloudReport(type, period, true);
    if (!report && (local.filledDays || local.stats?.totals?.checked)) {
      report = await generateCloudReport(type, local.fromIso, local.toIso, period, { stats: local.stats });
    }
    if (token !== renderReport._token) return;
    if (report) {
      writeCachedReport(type, report.period || period, report);
      root.innerHTML = renderAiReportBlock(report);
    } else if (!cached) {
      root.innerHTML = renderAiReportBlock("這段期間的復盤還不夠，先寫幾天再回來看綜合報告。", "error");
    }
  } catch (error) {
    if (token !== renderReport._token) return;
    if (!cached) root.innerHTML = renderAiReportBlock(formatApiError(error), "error");
  }
}

async function ensurePreviousMonthArchive() {
  if (state.monthArchiveTried) return;
  state.monthArchiveTried = true;
  const prev = previousMonthRange();
  if (readCachedReport("month", prev.period)) return;
  const local = buildReport("month", prev);
  if (!local.filledDays && !(local.stats?.totals?.checked)) {
    return;
  }
  const snapshot = {
    type: "month",
    period: prev.period,
    fromIso: prev.fromIso,
    toIso: prev.toIso,
    label: "上月",
    title: `${formatMonthLabel(prev.period)}成長報告`,
    summary: "",
    highlights: [],
    breakthroughs: [],
    stats: local.stats,
    archived: true,
    source: "local",
    generatedAt: new Date().toISOString(),
  };
  writeCachedReport("month", prev.period, snapshot);
  if (!state.user) return;
  try {
    const report = await generateCloudReport("month", prev.fromIso, prev.toIso, prev.period, {
      stats: local.stats,
      archive: true,
    });
    if (report) writeCachedReport("month", report.period || prev.period, report);
  } catch {
    /* 本地封存仍可用 */
  }
}

function renderReportBody(report, options = {}) {
  const rate = report.days ? Math.round((report.filledDays / report.days) * 100) : 0;
  const cachedAi = options.ai;
  const chartPrefix = options.chartPrefix || "report";
  return `
    <article class="report-card">
      <h3>${escapeHtml(report.label || "本區間")}完成摘要</h3>
      <p class="report-range">${formatDisplayDate(report.fromIso)} — ${formatDisplayDate(report.toIso)}</p>
      <div class="stats" style="margin:16px 0 0">
        <article class="stat-card">
          <p class="stat-card__value">${report.filledDays}/${report.days}</p>
          <p class="stat-card__label">填寫天數</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${rate}%</p>
          <p class="stat-card__label">完成率</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${report.stats?.totals?.checked || 0}</p>
          <p class="stat-card__label">三力勾選</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${formatCharCount(report.totalChars)}</p>
          <p class="stat-card__label">累積總字數</p>
        </article>
      </div>
      <p class="report-rhythm" style="margin-top:16px">${escapeHtml(formatFrequencyLabel(report.days, report.filledDays))}。一共留下 ${formatCharCount(report.totalChars)}。</p>
    </article>
    ${renderChartCard(report.stats, chartPrefix)}
    <div id="${options.aiId || "reportAi"}">${renderAiReportBlock(cachedAi, cachedAi ? undefined : "loading")}</div>
    <article class="report-card">
      <h3>逐日回顧</h3>
      ${
        (report.entries || []).length
          ? `<ul class="highlight-list">${report.entries
              .slice()
              .reverse()
              .map(
                (item) => `
                  <li>
                    <span class="highlight-list__date">${formatDisplayDate(item.iso)}</span>
                    <p class="highlight-list__text">${escapeHtml(item.highlight)}</p>
                  </li>
                `
              )
              .join("")}</ul>`
          : `<p class="report-empty">這個區間還沒有逐日摘要。</p>`
      }
    </article>
  `;
}

/* =============================================================================
 * 畫面：導航 / 今日復盤
 * =========================================================================== */

function navToggleEl() {
  return document.getElementById("nav-toggle");
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("nav-closed", collapsed);
  localStorage.setItem("rv_sidebar", collapsed ? "closed" : "open");
  localStorage.setItem(STORAGE_KEYS.sidebar, collapsed ? "1" : "0");
  const toggle = navToggleEl();
  if (toggle) toggle.setAttribute("aria-expanded", String(!collapsed));
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.toggle("is-open", open);
  const scrim = document.getElementById("scrim");
  if (scrim) scrim.hidden = !open;
  const toggle = navToggleEl();
  if (toggle) toggle.setAttribute("aria-expanded", String(open || !document.body.classList.contains("nav-closed")));
}

function toggleMenu() {
  if (isMobile()) {
    setSidebarOpen(!document.getElementById("sidebar").classList.contains("is-open"));
    return;
  }
  setSidebarCollapsed(!document.body.classList.contains("nav-closed"));
}

function switchPage(page, options = {}) {
  if (!page) return;
  state.page = page;
  document.querySelectorAll(".side-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.page === page);
  });
  document.querySelectorAll(".page[data-page]").forEach((section) => {
    const active = section.dataset.page === page;
    section.classList.toggle("is-active", active);
    section.hidden = !active;
  });
  if (isMobile() && !options.keepSidebar) setSidebarOpen(false);
  if (page === "report") renderReport();
  if (page === "next") renderInsights();
  if (page === "sfm") renderTasks();
  if (page === "manifest") renderManifests();
  if (page === "history") renderHistory();
}

function driverFactory() {
  return window.driver?.js?.driver || window.driver?.driver || null;
}

function prepareTourStep(step) {
  if (!step) return;
  if (step.tourSidebar) {
    if (isMobile()) setSidebarOpen(true);
    else if (document.body.classList.contains("nav-closed")) setSidebarCollapsed(false);
  } else if (isMobile()) {
    setSidebarOpen(false);
  }
  if (step.tourPage) switchPage(step.tourPage, { keepSidebar: Boolean(step.tourSidebar) });
  if (typeof step.element === "string" && step.element.startsWith("#")) {
    setJournalFoldOpen(step.element.slice(1), true, { persist: false, pin: false });
  }
}

function tourSteps() {
  return [
    {
      popover: {
        title: "歡迎來到日精進",
        description: "這是一份互動式導覽。接下來會帶你走過日期切換、01 到 07 的復盤與洞察，再到側邊欄各頁。完整文字手冊在「使用說明」。隨時可以按「略過導覽」。",
        side: "over",
        align: "center",
      },
    },
    {
      element: "#journalWhen",
      tourPage: "today",
      popover: {
        title: "切換復盤日期",
        description: "點日期可切換要寫的那一天，方便補寫昨天或回看之前的紀錄。",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: ".mode-guide",
      tourPage: "today",
      popover: {
        title: "復盤模式指南",
        description: "預設收合，保持畫面簡潔。點標題橫幅即可展開，比較快速與深度復盤，再點卡片切換。",
        side: "bottom",
      },
    },
    {
      element: "#section-thanks",
      tourPage: "today",
      popover: {
        title: "01 今日感謝",
        description: "把今天想感謝的人、事、物寫在同一格。換行就能繼續下一件。",
        side: "bottom",
      },
    },
    {
      element: "#section-event",
      tourPage: "today",
      popover: {
        title: "02 今日事件",
        description: "寫下今天真正被碰到的事，再點選心情。快速復盤寫完感謝、事件與心情就能開始 3 輪深度思考；深度復盤則會成為後面出題與思考的原料。",
        side: "bottom",
      },
    },
    {
      element: "#section-body",
      tourPage: "today",
      popover: {
        title: "03 身體覺察",
        description: "用心情、身體、睡眠三個檢核看今天的狀態。看完後，右側會整理今日身心小結，給你今晚就能照顧自己的小建議。",
        side: "bottom",
      },
    },
    {
      element: "#section-insight",
      tourPage: "today",
      popover: {
        title: "深度思考",
        description: "寫完事件、心情與身體後，會連續問你 3 輪。答完後給你 2 件具體下一步，以及一段直擊核心的總結。",
        side: "bottom",
      },
    },
    {
      element: "#section-aware",
      tourPage: "today",
      popover: {
        title: "04 覺察力",
        description: "寫完今日感謝與事件後，點開始，會依今天的內容準備 3 個專屬問題。逐題回答後，把今天最重要的發現留下來。",
        side: "top",
      },
    },
    {
      element: "#awareChecks",
      tourPage: "today",
      popover: {
        title: "今日核心覺察",
        description: "回答完 3 個問題後，這裡會把今天最重要的發現，整理成一句值得留下來的話。",
        side: "top",
      },
    },
    {
      element: "#section-exec",
      tourPage: "today",
      popover: {
        title: "05 執行力",
        description: "寫完今日感謝與事件後，會生成 3 道今天專屬的執行題。右側行動卡一打勾，就會立刻同步到側邊欄「執行力」。",
        side: "top",
      },
    },
    {
      element: "#section-deep",
      tourPage: "today",
      popover: {
        title: "06 深度思考",
        description: "今天先深挖一個最貼近你的主題。若還想繼續，再點「我還想繼續探索」展開另外三題。",
        side: "top",
      },
    },
    {
      element: "#section-manifest",
      tourPage: "today",
      popover: {
        title: "07 顯化力",
        description: "左側寫下明天想顯化的心念，右側會拆成做得到的步驟。勾選後會立刻同步到側邊欄「顯化力」，完成復盤也會再匯集一次。",
        side: "top",
      },
    },
    {
      element: "#journalFooter",
      tourPage: "today",
      popover: {
        title: "完成今日復盤",
        description: "寫完、勾完就按這裡。草稿可先儲存；完成後，勾選的覺察、行動與顯化步驟會同步到側邊欄。",
        side: "top",
      },
    },
    {
      element: '.side-item[data-page="today"]',
      tourPage: "today",
      tourSidebar: true,
      popover: {
        title: "今日復盤",
        description: "每天從這裡開始。側邊欄這一項會帶你回到剛才走完的 01 到 07。",
        side: "right",
      },
    },
    {
      element: '.side-item[data-page="report"]',
      tourPage: "report",
      tourSidebar: true,
      popover: {
        title: "週月報",
        description: "把一週或一個月的勾選量、完成率收成圖表，並用深度思考寫出閃光點與突破口。底部可回看封存的月報。",
        side: "right",
      },
    },
    {
      element: '.side-item[data-page="next"]',
      tourPage: "next",
      tourSidebar: true,
      popover: {
        title: "覺察力清單",
        description: "復盤裡勾選的洞察會累積在這裡，方便回看你已經看見過什麼。",
        side: "right",
      },
    },
    {
      element: '.side-item[data-page="sfm"]',
      tourPage: "sfm",
      tourSidebar: true,
      popover: {
        title: "執行力",
        description: "復盤裡打勾的行動卡會匯集到這裡。可用進行中、待辦、已完成來整理，還沒想做的就移到待辦。",
        side: "right",
      },
    },
    {
      element: '.side-item[data-page="manifest"]',
      tourPage: "manifest",
      tourSidebar: true,
      popover: {
        title: "顯化力",
        description: "復盤裡勾選的顯化目標會匯集到這裡。可用進行中、待辦、已完成來整理，還沒想推進的就移到待辦。",
        side: "right",
      },
    },
    {
      element: '.side-item[data-page="history"]',
      tourPage: "history",
      tourSidebar: true,
      popover: {
        title: "歷史紀錄",
        description: "所有完成的復盤都在這裡。列表先看當天那句重點，點開才展開完整內容；也可用搜尋或標籤找回某個人、某一天。",
        side: "right",
      },
    },
  ].filter((step) => !step.element || document.querySelector(step.element));
}

function startOnboardingTour() {
  const createDriver = driverFactory();
  if (!createDriver) {
    showToast("導覽套件載入中，請稍後再試一次。");
    return;
  }
  if (state.tour && typeof state.tour.destroy === "function") {
    state.tour.destroy();
    state.tour = null;
  }
  const splash = document.getElementById("splash");
  if (splash) splash.remove();
  switchPage("today");

  const tour = createDriver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: "#1a1613",
    overlayOpacity: 0.58,
    stagePadding: 10,
    stageRadius: 16,
    popoverClass: "nichi-tour",
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    doneBtnText: "完成",
    progressText: "{{current}} / {{total}}",
    disableActiveInteraction: true,
    steps: tourSteps(),
    onHighlightStarted(element, step) {
      prepareTourStep(step);
    },
    onHighlighted() {
      window.setTimeout(() => {
        if (state.tour && typeof state.tour.refresh === "function") state.tour.refresh();
      }, 220);
    },
    onPopoverRender(popover) {
      if (!popover?.footer || popover.footer.querySelector(".nichi-tour__skip")) return;
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "nichi-tour__skip";
      skip.textContent = "略過導覽";
      skip.addEventListener("click", () => {
        if (state.tour) state.tour.destroy();
      });
      popover.footer.prepend(skip);
    },
    onDestroyed() {
      state.tour = null;
      if (isMobile()) setSidebarOpen(false);
      switchPage("today");
    },
  });
  state.tour = tour;
  tour.drive();
}

function currentIso() {
  return document.getElementById("reviewDate")?.value || toInputDate(new Date());
}

function renderPromptChips() {
  const root = document.getElementById("promptChips");
  if (!root) return;
  root.innerHTML = PROMPT_CHIPS.map(
    (label) => `<button class="prompt-chip" type="button" data-prompt="${escapeHtml(label)}">${escapeHtml(label)}</button>`
  ).join("");
}

function insertPrompt(label) {
  const textarea = document.getElementById("reviewText");
  if (!textarea) return;
  const prefix = textarea.value.trim() ? `${textarea.value.trim()}\n\n` : "";
  textarea.value = `${prefix}${label}：`;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function journalFieldValue(id) {
  return String(document.getElementById(id)?.value || "").trim();
}

const AWARENESS_QUIZ_COUNT = 3;
const AWARENESS_QUOTE_COUNT = 1;
const AWARENESS_QUOTE_GEN_MAX = 2;

const AWARENESS_QUESTIONS = [
  { question: "今天最觸動我的，其實不是事情本身，而是它碰到了我在意的那一層。" },
  { question: "我寫下的感謝裡，藏著我今天真正想被看見的需求。" },
  { question: "我還沒完全承認：今天讓我不舒服的，其實和我怕失去什麼有關。" },
];

const CORE_AWARENESS_PROMPT = AWARENESS_QUESTIONS[0];

const CORE_EXECUTION_PROMPT = {
  question: "今天在執行目標時遇到了什麼實質卡點？你打算採取什麼全面性的行動或突破策略來解決它？",
  placeholder: "寫下卡點、卡住的真正原因，以及你打算採取的突破策略…",
};

function thanksItemsFrom(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function thanksTextFrom(journal) {
  if (!journal || typeof journal !== "object") return "";
  if (typeof journal.thanksText === "string" && journal.thanksText.trim()) return journal.thanksText;
  if (typeof journal.thanks === "string") return journal.thanks;
  return thanksItemsFrom(journal.thanks).join("\n");
}

function collectThanksText() {
  return String(document.getElementById("thanksText")?.value || "");
}

function renderThanksFields(journalOrValues) {
  const field = document.getElementById("thanksText");
  if (!field) return;
  if (journalOrValues && typeof journalOrValues === "object" && !Array.isArray(journalOrValues)) {
    field.value = thanksTextFrom(journalOrValues);
    return;
  }
  field.value = thanksItemsFrom(journalOrValues).join("\n");
}

function emptyQuickModules() {
  return { body: false, aware: false, exec: false, manifest: false };
}

function normalizeQuickModules(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    body: Boolean(src.body),
    aware: Boolean(src.aware),
    exec: Boolean(src.exec),
    manifest: Boolean(src.manifest),
  };
}

function quickModuleOn(key, journal) {
  if ((journal?.mode || state.journalMode) !== "quick") return true;
  const mods = normalizeQuickModules(journal?.quickModules || state.quickModules);
  return Boolean(mods[key]);
}

function syncQuickModules(mods = state.quickModules) {
  const next = normalizeQuickModules(mods);
  state.quickModules = next;
  const isQuick = state.journalMode === "quick";
  document.body.dataset.quickBody = isQuick && next.body ? "on" : "";
  document.body.dataset.quickAware = isQuick && next.aware ? "on" : "";
  document.body.dataset.quickExec = isQuick && next.exec ? "on" : "";
  document.body.dataset.quickManifest = isQuick && next.manifest ? "on" : "";
  document.querySelectorAll("[data-quick-mod]").forEach((btn) => {
    const on = Boolean(next[btn.dataset.quickMod]);
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function toggleQuickModule(key) {
  if (state.journalMode !== "quick" || !["body", "aware", "exec", "manifest"].includes(key)) return;
  const next = { ...normalizeQuickModules(state.quickModules), [key]: !state.quickModules?.[key] };
  syncQuickModules(next);
  persistJournalQuietly();
  const journal = collectJournal();
  if (next[key]) {
    const sectionId = { body: "section-body", aware: "section-aware", exec: "section-exec", manifest: "section-manifest" }[key];
    setJournalFoldOpen(sectionId, true);
  } else {
    applyJournalFolds();
  }
  if (next.aware || next.exec) maybeAutoGenerateCorePrompts(journal);
  if (next.body) maybeAutoGenerateBodyCoach(journal);
  if (next.manifest) maybeAutoGenerateManifest(journal);
  maybeAutoGenerateInsight(journal);
}

function emptyJournal() {
  return {
    thanks: "",
    thanksText: "",
    event: "",
    mood: "",
    bodyTags: [],
    bodyNote: "",
    bodyCheck: emptyBodyCheck(),
    bodyCoach: emptyBodyCoach(),
    awareness: ["", "", ""],
    awarenessChecks: [],
    awarenessCheckItems: [],
    execution: ["", "", ""],
    executionChecks: [],
    executionCheckItems: [],
    smallestStep: "",
    mode: state.journalMode === "quick" ? "quick" : "deep",
    deepExpanded: false,
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    awarenessQuoteGenCount: 0,
    manifest: "",
    manifestChecks: [],
    manifestCheckItems: [],
    manifestAi: false,
    manifestAiSig: "",
    insight: emptyInsight(),
    deep: emptyDeep(),
    awarenessPrompts: [],
    executionPrompts: [],
    executionQuestionTab: "open",
    deepPrompts: [],
    promptsSig: "",
    promptsAi: false,
    corePromptsSig: "",
    corePromptsAi: false,
    quickModules: emptyQuickModules(),
  };
}

function emptyDeep() {
  return [
    { plain: "", deep: "", followups: [], notes: ["", "", ""] },
    { plain: "", deep: "", followups: [], notes: ["", "", ""] },
    { plain: "", deep: "", followups: [], notes: ["", "", ""] },
    { plain: "", deep: "", followups: [], notes: ["", "", ""] },
  ];
}

function emptyThinkGuide() {
  return { round: 0, rounds: [], summary: "", actions: [], title: "" };
}

function emptyInsight() {
  return {
    title: "",
    conclusion: "",
    psychology: "",
    reflection: "",
    logic: "",
    bodyLink: "",
    suggestions: [],
    takeaways: [],
    guide: emptyThinkGuide(),
    sig: "",
  };
}

function emptyBodyCheck() {
  return {
    mood: { flags: [], none: false, reason: "" },
    body: { flags: [], none: false, reason: "", other: "" },
    sleep: { flags: [], none: false, reason: "", duration: "", quality: "", energy: "" },
  };
}

function emptyBodyCoach() {
  return { analysis: "", suggestions: [], sig: "" };
}

function normalizeBodyGroup(group) {
  const data = group && typeof group === "object" ? group : {};
  return {
    flags: Array.isArray(data.flags) ? data.flags.map((item) => String(item || "").trim()).filter(Boolean) : [],
    none: Boolean(data.none),
    reason: String(data.reason || "").trim(),
  };
}

function migrateSleepFields(sleep) {
  const next = {
    ...normalizeBodyGroup(sleep),
    duration: String(sleep?.duration || "").trim(),
    quality: String(sleep?.quality || "").trim(),
    energy: String(sleep?.energy || "").trim(),
  };
  const flags = next.flags || [];
  if (!next.quality && flags.includes("睡不著")) next.quality = "睡不著";
  if (!next.quality && flags.includes("睡得很好")) next.quality = "很好";
  if (!next.duration && flags.includes("10:00以前入睡")) next.duration = next.duration || "";
  return next;
}

function normalizeBodyMoodFlags(flags) {
  const aliases = {
    出現焦慮: "焦慮",
    焦慮: "焦慮",
    心悸緊張: "焦慮",
    脾氣暴躁: "煩躁",
    不耐煩: "煩躁",
    煩躁: "煩躁",
    普通: "平靜",
    平靜: "平靜",
    好心情: "愉快",
    愉快: "愉快",
  };
  const next = [];
  (Array.isArray(flags) ? flags : []).forEach((flag) => {
    const mapped = aliases[String(flag || "").trim()];
    if (mapped && !next.includes(mapped)) next.push(mapped);
  });
  return next.slice(0, 1);
}

function migrateBodyCheckFromTags(tags, note) {
  const next = emptyBodyCheck();
  const list = Array.isArray(tags) ? tags.map((item) => String(item || "").trim()) : [];
  const noteText = String(note || "").trim();
  list.forEach((tag) => {
    const mood = normalizeBodyMoodFlags([tag])[0];
    if (mood) next.mood.flags.push(mood);
    else if (tag === "腸胃不適" || tag === "頭痛" || tag === "全身痠痛" || tag === "身體疲勞") next.body.flags.push(tag);
    else if (tag === "睡眠不足" || tag === "睡不著") next.sleep.flags.push("睡不著");
    else if (tag === "10:00以前入睡" || tag === "睡得很好") next.sleep.flags.push(tag);
    else if (tag === "心情平穩") next.mood.none = true;
    else if (tag === "身體無不適" || tag === "精力充沛") next.body.none = true;
  });
  next.mood.flags = normalizeBodyMoodFlags(next.mood.flags);
  next.body.flags = [...new Set(next.body.flags)];
  next.sleep.flags = [...new Set(next.sleep.flags)];
  if (!next.mood.flags.length && !next.mood.none && /焦慮|暴躁|不耐|煩躁/.test(noteText)) next.mood.reason = noteText;
  if (!next.body.reason && noteText) next.body.reason = noteText;
  if (next.mood.flags.length) next.mood.none = false;
  if (next.body.flags.length) next.body.none = false;
  return next;
}

function normalizeBodyCheck(raw, tags, note) {
  if (raw && typeof raw === "object" && (raw.mood || raw.body || raw.sleep)) {
    const mood = normalizeBodyGroup(raw.mood);
    const body = normalizeBodyGroup(raw.body);
    const next = {
      mood: { ...mood, flags: normalizeBodyMoodFlags(mood.flags) },
      body: { ...body, other: String(raw.body?.other || "").trim() },
      sleep: migrateSleepFields(raw.sleep),
    };
    if (next.mood.flags.length) next.mood.none = false;
    if (next.body.flags.length || next.body.other) next.body.none = false;
    return next;
  }
  return migrateBodyCheckFromTags(tags, note);
}

function deriveBodyTags(check) {
  const data = normalizeBodyCheck(check);
  const tags = [];
  if (data.mood.none) tags.push("心情平穩");
  else tags.push(...data.mood.flags);
  if (data.body.none) tags.push("身體無不適");
  else tags.push(...data.body.flags);
  if (data.body.other) tags.push("其他");
  tags.push(...data.sleep.flags);
  if (data.sleep.duration) tags.push(data.sleep.duration);
  if (data.sleep.quality) tags.push(data.sleep.quality);
  if (data.sleep.energy) tags.push(`起床${data.sleep.energy}`);
  return tags;
}

function deriveBodyNote(check) {
  const data = normalizeBodyCheck(check);
  const parts = [];
  if (data.mood.reason) parts.push(`心情原因：${data.mood.reason}`);
  if (data.body.other) parts.push(`其他身體感受：${data.body.other}`);
  if (data.body.reason) parts.push(`身體原因：${data.body.reason}`);
  if (data.sleep.duration) parts.push(`睡眠時間：${data.sleep.duration}`);
  if (data.sleep.quality) parts.push(`睡眠品質：${data.sleep.quality}`);
  if (data.sleep.energy) parts.push(`起床精神：${data.sleep.energy}`);
  if (data.sleep.reason) parts.push(`睡眠說明：${data.sleep.reason}`);
  return parts.join("\n");
}

function collectBodyCheck() {
  const readGroup = (name, reasonId) => {
    const root = document.querySelector(`[data-body-group="${name}"]`);
    const flags = [...(root?.querySelectorAll(".body-flag-btn.is-on") || [])]
      .map((btn) => btn.dataset.bodyFlag)
      .filter(Boolean);
    return {
      flags,
      none: false,
      reason: journalFieldValue(reasonId),
    };
  };
  const sleepValue = (field) =>
    document.querySelector(`[data-sleep-field="${field}"] .sleep-chip.is-on`)?.dataset.sleepValue || "";
  const body = readGroup("body", "bodyBodyReason");
  const sleep = readGroup("sleep", "bodySleepReason");
  return {
    mood: readGroup("mood", "bodyMoodReason"),
    body: { ...body, other: journalFieldValue("bodyOtherNote") },
    sleep: {
      ...sleep,
      duration: sleepValue("duration"),
      quality: sleepValue("quality"),
      energy: sleepValue("energy"),
    },
  };
}

function syncBodyReasonVisibility(check) {
  const data = check || collectBodyCheck();
  ["mood", "body", "sleep"].forEach((name) => {
    const reason = document.querySelector(`[data-body-reason="${name}"]`);
    if (!reason) return;
    const group = data[name] || {};
    if (name === "sleep") {
      reason.hidden = !(group.duration || group.quality || group.energy || (group.flags || []).length);
      return;
    }
    const show = Boolean((group.flags || []).filter((flag) => flag !== "其他").length);
    reason.hidden = !show;
  });
  const other = document.querySelector("[data-body-other='body']");
  if (other) other.hidden = !((data.body?.flags || []).includes("其他") || String(data.body?.other || "").trim());
}

function fillSleepChips(sleep) {
  ["duration", "quality", "energy"].forEach((field) => {
    const value = String(sleep?.[field] || "");
    document.querySelectorAll(`[data-sleep-field="${field}"] .sleep-chip`).forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.sleepValue === value);
    });
  });
}

function fillBodyCheck(check) {
  const data = normalizeBodyCheck(check);
  ["mood", "body", "sleep"].forEach((name) => {
    const root = document.querySelector(`[data-body-group="${name}"]`);
    if (!root) return;
    const group = data[name];
    const flagSet = new Set(group.flags || []);
    root.querySelectorAll(".body-flag-btn").forEach((btn) => {
      btn.classList.toggle("is-on", flagSet.has(btn.dataset.bodyFlag));
    });
  });
  fillSleepChips(data.sleep);
  const moodReason = document.getElementById("bodyMoodReason");
  const bodyReason = document.getElementById("bodyBodyReason");
  const sleepReason = document.getElementById("bodySleepReason");
  const bodyOther = document.getElementById("bodyOtherNote");
  if (moodReason) moodReason.value = data.mood.reason || "";
  if (bodyReason) bodyReason.value = data.body.reason || "";
  if (sleepReason) sleepReason.value = data.sleep.reason || "";
  if (bodyOther) bodyOther.value = data.body.other || "";
  syncBodyReasonVisibility(data);
}

function bodyCheckHasSignal(check) {
  const data = check || emptyBodyCheck();
  return ["mood", "body", "sleep"].some((name) => {
    const group = data[name] || {};
    return Boolean(
      (group.flags || []).length ||
        String(group.reason || "").trim() ||
        String(group.other || "").trim() ||
        String(group.duration || "").trim() ||
        String(group.quality || "").trim() ||
        String(group.energy || "").trim()
    );
  });
}

function bodyCoachReady(journal, options = {}) {
  const check = (journal && journal.bodyCheck) || collectBodyCheck();
  if (options.auto) return bodyCheckHasSignal(check);
  return true;
}

function bodyCoachSignature(journal) {
  const data = journal || collectJournal();
  const check = normalizeBodyCheck(data.bodyCheck);
  return JSON.stringify({
    mood: check.mood,
    body: check.body,
    sleep: check.sleep,
    event: String(data.event || "").trim(),
  });
}

function normalizeBodyCoach(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return {
    analysis: String(data.analysis || data.summary || "").trim(),
    suggestions,
    sig: String(data.sig || "").trim(),
  };
}

function normalizeInsightList(raw, max = 4) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeThinkGuide(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const rounds = (Array.isArray(data.rounds) ? data.rounds : [])
    .map((item) => ({
      question: String(item?.question || "").trim(),
      hint: String(item?.hint || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question)
    .slice(0, 3);
  const roundNum = Number(data.round);
  const round = Number.isFinite(roundNum) ? Math.max(0, Math.min(4, Math.floor(roundNum))) : 0;
  return {
    round: round || (data.summary ? 4 : rounds.length),
    rounds,
    summary: String(data.summary || "").trim(),
    actions: normalizeInsightList(data.actions, 2),
    title: String(data.title || "").trim(),
  };
}

function thinkGuideDone(guide) {
  const data = normalizeThinkGuide(guide);
  return Boolean(data.summary && data.actions.length >= 2 && data.rounds.filter((item) => item.answer).length >= 3);
}

function normalizeInsight(insight) {
  const data = insight && typeof insight === "object" ? insight : {};
  const psychology = String(data.psychology || data.analysis || data.logic || "").trim();
  const conclusion = String(data.conclusion || data.summary || "").trim();
  const guide = normalizeThinkGuide(data.guide);
  return {
    title: String(data.title || guide.title || "").trim(),
    conclusion: conclusion || psychology || guide.summary,
    psychology: psychology || conclusion || guide.summary,
    reflection: String(data.reflection || data.review || data.critique || "").trim(),
    logic: String(data.logic || "").trim(),
    bodyLink: String(data.bodyLink || "").trim(),
    suggestions: normalizeInsightList(data.suggestions || data.actions || guide.actions, 3),
    takeaways: normalizeInsightList(data.takeaways || data.keyPoints, 4),
    guide,
    sig: String(data.sig || "").trim(),
  };
}

function normalizeDeep(deep) {
  return emptyDeep().map((slot, index) => {
    const item = Array.isArray(deep) ? deep[index] : null;
    if (item && typeof item === "object") {
      const followups = Array.isArray(item.followups)
        ? item.followups.map((q) => String(q || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      const notes = [0, 1, 2, 3].map((i) => String((item.notes || [])[i] || ""));
      return {
        plain: String(item.plain || ""),
        deep: String(item.deep || item.note || ""),
        followups,
        notes,
      };
    }
    return { ...slot, deep: String(item || "") };
  });
}

function deepHasContent(deep) {
  return normalizeDeep(deep).some(
    (item) =>
      String(item.plain || "").trim() ||
      String(item.deep || "").trim() ||
      (item.followups || []).length ||
      (item.notes || []).some((note) => String(note || "").trim())
  );
}

function journalHasContent(journal) {
  if (!journal || typeof journal !== "object") return false;
  const textBits = [
    thanksTextFrom(journal),
    journal.event,
    journal.mood,
    journal.bodyNote,
    journal.smallestStep,
    ...(journal.awareness || []),
    ...(journal.execution || []),
    journal.manifest,
  ];
  if (textBits.some((item) => String(item || "").trim())) return true;
  if (deepHasContent(journal.deep)) return true;
  if (String(journal.insight?.conclusion || journal.insight?.psychology || journal.insight?.reflection || journal.insight?.guide?.summary || "").trim()) return true;
  if ((journal.insight?.suggestions || []).length || (journal.insight?.takeaways || []).length || (journal.insight?.guide?.rounds || []).length) return true;
  return Boolean((journal.bodyTags || []).length || (journal.awarenessChecks || []).length || (journal.executionChecks || []).length || (journal.manifestChecks || []).length);
}

function checkedValues(rootId) {
  return [...document.querySelectorAll(`#${rootId} input[type="checkbox"]:checked`)].map((input) => input.value);
}

function checklistItems(rootId) {
  return [...document.querySelectorAll(`#${rootId} input[type="checkbox"]`)].map((input) => input.value);
}

function pushUnique(list, item, max) {
  const text = String(item || "").trim();
  if (!text || list.includes(text) || list.length >= max) return list;
  list.push(text);
  return list;
}

function journalBlob(journal) {
  return [
    thanksTextFrom(journal),
    journal.event,
    journal.mood,
    journal.bodyNote,
    journal.smallestStep,
    ...(journal.awareness || []),
    ...(journal.execution || []),
  ]
    .map((item) => String(item || ""))
    .join("\n");
}

function joinJournalAnswers(answers) {
  return (Array.isArray(answers) ? answers : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function coreAnswerFilled(answers) {
  return joinJournalAnswers(answers).length >= 4;
}

function threePromptAnswersReady(answers) {
  return (Array.isArray(answers) ? answers : []).filter((item) => String(item || "").trim()).length >= 3;
}

function normalizeYesNo(value) {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase();
  if (raw === "是" || key === "yes" || key === "y" || key === "true") return "是";
  if (raw === "否" || key === "no" || key === "n" || key === "false") return "否";
  return "";
}

function collectAwarenessQuizAnswers() {
  const items = [...document.querySelectorAll("#awareQuestions .aware-quiz__item")];
  if (items.length) return items.map((el) => normalizeYesNo(el.dataset.answer));
  const prev = getReview(currentIso())?.journal?.awareness;
  const list = Array.isArray(prev) ? prev.map(normalizeYesNo) : [];
  return Array.from({ length: AWARENESS_QUIZ_COUNT }, (_, index) => list[index] || "");
}

function awarenessQuizAnsweredCount(answers) {
  return (Array.isArray(answers) ? answers : [])
    .slice(0, AWARENESS_QUIZ_COUNT)
    .map(normalizeYesNo)
    .filter(Boolean).length;
}

function awarenessReady(answers) {
  return awarenessQuizAnsweredCount(answers) >= AWARENESS_QUIZ_COUNT;
}

function executionReady(answers) {
  const prompts = normalizeExecutionPrompts(state.executionPrompts);
  const list = Array.isArray(answers) ? answers : [];
  if (prompts.length >= 3) {
    return prompts.every((_, index) => String(list[index] || "").trim());
  }
  return coreAnswerFilled(list);
}

function fillAwarenessAnswers(answers) {
  const list = Array.isArray(answers) ? answers.map((item) => String(item || "")) : [];
  ["aware1", "aware2", "aware3"].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.value = list[index] || "";
  });
}

function fillExecutionAnswers(answers) {
  const list = Array.isArray(answers) ? answers.map((item) => String(item || "")) : [];
  ["exec1", "exec2", "exec3"].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.value = list[index] || "";
  });
}

function fillCoreAnswer(id, answers) {
  const el = document.getElementById(id);
  if (el) el.value = joinJournalAnswers(answers);
}

function firstAwarenessSentence(text) {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  const match = raw.match(/^[^。！？!?]+[。！？!?]?/);
  return (match ? match[0] : raw).replace(/[，,、；;]+$/g, "").trim();
}

function cleanAwarenessQuote(text) {
  return firstAwarenessSentence(text)
    .replace(/^["「『]+|[」』"]+$/g, "")
    .replace(/^[\d.、｜|\-\s]+/, "")
    .trim()
    .slice(0, 28);
}

function normalizeAwarenessQuotes(raw, fallback) {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Array.isArray(raw.quotes)
        ? raw.quotes
        : Array.isArray(raw.items)
          ? raw.items
          : raw.quote
            ? [raw.quote]
            : []
      : raw
        ? [raw]
        : [];
  const items = [];
  const seen = new Set();
  source.forEach((item) => {
    const text = cleanAwarenessQuote(typeof item === "string" ? item : item?.quote || item?.text || item?.title || "");
    if (text.length < 8 || seen.has(text)) return;
    seen.add(text);
    items.push(text);
  });
  (Array.isArray(fallback) ? fallback : fallback ? [fallback] : []).forEach((item) => {
    const text = cleanAwarenessQuote(item);
    if (text.length >= 8 && items.length < AWARENESS_QUOTE_COUNT && !seen.has(text)) {
      seen.add(text);
      items.push(text);
    }
  });
  return items.slice(0, AWARENESS_QUOTE_COUNT);
}

function pickAwarenessQuote(items) {
  return normalizeAwarenessQuotes(items)[0] || "";
}

function normalizeAwarenessQuoteGenCount(raw, hasQuotes) {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(AWARENESS_QUOTE_GEN_MAX, Math.floor(n));
  return hasQuotes ? 1 : 0;
}

function awarenessQuoteGenCount() {
  return normalizeAwarenessQuoteGenCount(state.journalMeta.awarenessQuoteGenCount, collectAwareQuotes().length);
}

function awarenessQuoteGenCapped() {
  return awarenessQuoteGenCount() >= AWARENESS_QUOTE_GEN_MAX;
}

function collectAwareQuotes() {
  const fromDom = [...document.querySelectorAll("#awareChecks .aware-quote")]
    .map((el) => String(el.dataset.quote || "").trim())
    .filter(Boolean);
  if (fromDom.length) return normalizeAwarenessQuotes(fromDom);
  const prev = getReview(currentIso())?.journal;
  return normalizeAwarenessQuotes(prev && prev.awarenessCheckItems);
}

function collectAwareQuote() {
  return collectAwareQuotes()[0] || "";
}

function buildAwarenessQuotes(journal) {
  const mood = journal.mood || "";
  return [
    mood === "生氣" || mood === "難過"
      ? "不舒服不是失控，是內心的結在敲門。"
      : "你最不想承認的那一層，才是今天的主詞。",
  ];
}

function buildAwarenessCheckItems(journal) {
  return buildAwarenessQuotes(journal);
}

function renderAwareQuote(items, checked) {
  const root = document.getElementById("awareChecks");
  if (!root) return;
  const quotes = normalizeAwarenessQuotes(items);
  if (quotes.length) {
    const quote = quotes[0];
    const kept = (checked || []).map((item) => String(item || "").trim()).includes(quote);
    root.innerHTML = `<div class="aware-quote-list aware-quote-list--solo">
          <article class="aware-quote aware-quote--solo" data-quote="${escapeHtml(quote)}">
            <p class="aware-quote__kicker">今日核心覺察</p>
            <p class="aware-quote__text">${escapeHtml(quote)}</p>
            <div class="aware-quote__actions">
              <label class="aware-quote__keep">
                <input type="checkbox" value="${escapeHtml(quote)}" ${kept ? "checked" : ""} />
                <span class="aware-quote__box" aria-hidden="true"></span>
                <span>收藏這句</span>
              </label>
              <button class="btn btn--ghost btn--tiny" type="button" data-copy-aware-quote>複製</button>
            </div>
          </article>
        </div>`;
    syncAwareQuoteGate();
    return;
  }
  const answers = collectAwarenessQuizAnswers();
  const done = awarenessQuizAnsweredCount(answers);
  const ready = done >= AWARENESS_QUIZ_COUNT;
  root.innerHTML = `
    <div class="aware-quote-gate${ready ? " is-ready" : ""}">
      <p class="aware-quote__kicker">今日核心覺察</p>
      <p class="aware-quote-gate__title">${
        ready
          ? "三個問題都看過了。現在可以把今天最重要的發現留下來。"
          : "完成 3 題後，看見今天的核心覺察。"
      }</p>
      <p class="aware-quote-gate__meta">${Math.min(done, AWARENESS_QUIZ_COUNT)} / ${AWARENESS_QUIZ_COUNT}</p>
      <p class="aware-quote-gate__hint">沒有標準答案，只要選擇最貼近現在的自己。</p>
    </div>
  `;
  syncAwareQuoteGate();
}

function syncAwareQuoteGate() {
  const btn = document.getElementById("btnAwareAi");
  const hint = document.getElementById("awareQuoteLimitHint");
  if (!btn) return;
  const answers = collectAwarenessQuizAnswers();
  const ready = awarenessReady(answers);
  const quotes = collectAwareQuotes();
  const loading = Boolean(state.checklistBusy.awareness);
  const show = ready && !quotes.length && !awarenessQuoteGenCapped();
  btn.hidden = !(show || loading);
  if (quotes.length && !loading) btn.hidden = true;
  btn.disabled = !show || loading;
  btn.classList.remove("is-capped");
  btn.classList.toggle("is-busy", loading);
  btn.textContent = loading ? "正在為你整理…" : "✦ 看見我的核心覺察";
  if (hint) {
    hint.hidden = true;
    hint.textContent = "";
  }
}

function buildExecutionCheckItems(journal) {
  const items = [];
  const answers = (journal.execution || []).map((item) => String(item || "").trim()).filter(Boolean);
  const answer = joinJournalAnswers(journal.execution);
  const blob = `${answer}\n${journal.event || ""}\n${journal.bodyNote || ""}`;
  if (answer) {
    const short = answer.length > 18 ? `${answer.slice(0, 18)}…` : answer;
    pushUniqueExec(items, "先處理今天最卡的那一步", `把「${short}」收成一個 5 分鐘動作，做完立刻停。`, 4);
  }
  if (/累|疲|睡|沒力|能量|頭痛|緊繃/.test(blob)) {
    pushUniqueExec(items, "先讓身體休息", "先停十分鐘，喝口水、鬆開肩膀，再決定下一小步。", 4);
  }
  if (/怕|完美|失敗|丟臉|被看/.test(blob)) {
    pushUniqueExec(items, "只做醜一點的第一版", "設 10 分鐘計時，只交出能開始的草稿，不求一次做好。", 4);
  }
  if (/卡|拖|大|不知|從哪|複雜|太多/.test(blob)) {
    pushUniqueExec(items, "拆成最小一步", "在紙上只寫「明天第一件小事」，寫完就收工。", 4);
  }
  if (/策略|突破|行動|下一步/.test(blob)) {
    pushUniqueExec(items, "把策略變成動作", "把突破策略改寫成明天第一個可勾選的具體動作。", 4);
  }
  answers.slice(0, 2).forEach((item) => {
    const parts = splitTaskText(item.slice(0, 36));
    if (items.length < 3) pushUniqueExec(items, parts.title, parts.detail || "用最小、明天做得到的方式先走一步。", 4);
  });
  return items.slice(0, 4);
}

function renderExecCheckCard(item, index, done) {
  const heading = done ? item.title : `${String(index + 1).padStart(2, "0")}｜${item.title}`;
  const lead = flattenExecSentence(item.detail, item);
  return `
    <label class="check-line exec-check${done ? " is-done" : ""}" data-title="${escapeHtml(item.title)}" data-detail="${escapeHtml(lead)}">
      <input type="checkbox" value="${escapeHtml(item.title)}" ${done ? "checked" : ""} />
      <span class="exec-check__box" aria-hidden="true"></span>
      <span class="exec-check__body">
        <span class="exec-check__title">${escapeHtml(heading)}</span>
        ${lead ? `<span class="exec-check__lead">${escapeHtml(lead)}</span>` : ""}
      </span>
    </label>
  `;
}

function renderExecChecklist(items, checked) {
  const root = document.getElementById("execChecks");
  if (!root) return;
  const normalized = normalizeExecCheckItems(items);
  const set = new Set((checked || []).map((item) => (typeof item === "string" ? item : item && item.title)).filter(Boolean));
  const open = [];
  const done = [];
  normalized.forEach((item) => (set.has(item.title) ? done : open).push(item));
  root.innerHTML = `
    <div class="exec-check-open">
      ${open.map((item, index) => renderExecCheckCard(item, index, false)).join("") || (done.length ? "" : `<p class="empty">目前沒有待完成的行動。</p>`)}
    </div>
    ${
      done.length
        ? `<div class="exec-check-done">
            <h4 class="exec-check-done__title">已完成</h4>
            ${done.map((item, index) => renderExecCheckCard(item, index, true)).join("")}
          </div>`
        : ""
    }
  `;
}

function renderChecklist(rootId, items, checked) {
  if (rootId === "execChecks") {
    renderExecChecklist(items, checked);
    return;
  }
  if (rootId === "awareChecks") {
    renderAwareQuote(items, checked);
    return;
  }
  const root = document.getElementById(rootId);
  if (!root) return;
  const set = new Set(checked || []);
  root.innerHTML = (items || [])
    .map(
      (label) => `
        <label class="check-line">
          <input type="checkbox" value="${escapeHtml(label)}" ${set.has(label) ? "checked" : ""} />
          <span>${escapeHtml(label)}</span>
        </label>
      `
    )
    .join("");
}

function refreshJournalChecklists(journal, options = {}) {
  const data = journal || collectJournal();
  if (state.checklistBusy.awareness) options.skipAware = true;
  if (state.checklistBusy.execution) options.skipExec = true;
  if (state.checklistBusy.manifest) options.skipManifest = true;
  const keepAware = !options.forceLocal && (options.useSaved || data.awarenessAi) && (data.awarenessCheckItems || []).length;
  const keepExec = !options.forceLocal && (options.useSaved || data.executionAi) && (data.executionCheckItems || []).length;
  const keepManifest = !options.forceLocal && (options.useSaved || data.manifestAi) && (data.manifestCheckItems || []).length;
  const awareItems = keepAware
    ? normalizeAwarenessQuotes(data.awarenessCheckItems).slice(0, AWARENESS_QUOTE_COUNT)
    : [];
  const execItems = keepExec
    ? normalizeExecCheckItems(data.executionCheckItems).slice(0, 4)
    : buildExecutionCheckItems(data);
  const manifestItems = keepManifest ? data.manifestCheckItems.slice(0, 5) : [];
  const awareChecked = options.useSaved ? data.awarenessChecks : checkedValues("awareChecks");
  const execChecked = options.useSaved ? data.executionChecks : checkedValues("execChecks");
  const manifestChecked = options.useSaved ? data.manifestChecks : checkedValues("manifestChecks");
  if (!options.skipAware) renderChecklist("awareChecks", awareItems, awareChecked);
  if (!options.skipExec) renderChecklist("execChecks", execItems, execChecked);
  if (!options.skipManifest) renderChecklist("manifestChecks", manifestItems, manifestChecked);
}

function scheduleJournalChecklists() {
  if (state.journalHydrating) return;
  syncCorePromptGate();
  clearTimeout(state.journalCheckTimer);
  state.journalCheckTimer = setTimeout(() => {
    const data = collectJournal();
    refreshJournalChecklists(data);
    maybeAutoGenerateChecklists(data);
    maybeAutoGenerateManifest(data);
    maybeAutoGenerateInsight(data);
    maybeAutoGenerateBodyCoach(data);
    maybeAutoGeneratePrompts(data);
    maybeAutoGenerateCorePrompts(data);
  }, 900);
}

function threeAnswersFilled(answers) {
  return coreAnswerFilled(answers);
}

function checklistSignature(answers) {
  return (answers || []).map((item) => String(item || "").trim()).join("\n");
}

function normalizeAiExecItems(raw, min, max, fallback) {
  const items = normalizeExecCheckItems(raw);
  normalizeExecCheckItems(fallback).forEach((item) => {
    if (items.length < min && !items.some((entry) => entry.title === item.title)) items.push(item);
  });
  return items.slice(0, max);
}

function normalizeAiChecklistItems(raw, min, max, fallback) {
  const list = Array.isArray(raw) ? raw : [];
  const items = [];
  list.forEach((item) => {
    const text = typeof item === "string"
      ? item.trim()
      : String(item?.label || item?.text || item?.title || "").trim();
    if (text && !items.includes(text)) items.push(text);
  });
  (fallback || []).forEach((item) => {
    if (items.length < min) pushUnique(items, item, max);
  });
  return items.slice(0, max);
}

function checklistUi(kind) {
  if (kind === "manifest") {
    return { btn: "btnManifestAi", loader: "manifestLoading", list: "manifestChecks", idle: "生成執行目標" };
  }
  if (kind === "awareness") {
    return { btn: "btnAwareAi", loader: "awareLoading", list: "awareChecks", idle: "✦ 看見我的核心覺察" };
  }
  return { btn: "btnExecAi", loader: "execLoading", list: "execChecks", idle: "生成專屬行動卡點勾勾表" };
}

function setChecklistLoading(kind, loading) {
  const ui = checklistUi(kind);
  const btn = document.getElementById(ui.btn);
  const loader = document.getElementById(ui.loader);
  const list = document.getElementById(ui.list);
  state.checklistBusy[kind] = loading;
  if (!state.checklistBusyAt) state.checklistBusyAt = { awareness: 0, execution: 0, manifest: 0 };
  state.checklistBusyAt[kind] = loading ? Date.now() : 0;
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading
      ? kind === "awareness"
        ? "正在為你整理…"
        : "分析中…"
      : ui.idle;
  }
  if (loader) loader.hidden = !loading;
  if (list) list.classList.toggle("is-loading", loading);
  if (kind === "awareness") syncAwareQuoteGate();
}

function applyGeneratedChecklist(kind, items, sig) {
  const ui = checklistUi(kind);
  renderChecklist(ui.list, items, []);
  if (kind === "manifest") {
    state.journalMeta.manifestAi = true;
    state.journalMeta.manifestAiSig = sig;
  } else {
    const isAware = kind === "awareness";
    state.journalMeta[isAware ? "awarenessAi" : "executionAi"] = true;
    state.journalMeta[isAware ? "awarenessAiSig" : "executionAiSig"] = sig;
    if (isAware) {
      const used = Number(state.journalMeta.awarenessQuoteGenCount);
      const current = Number.isFinite(used) && used >= 0 ? Math.floor(used) : 0;
      state.journalMeta.awarenessQuoteGenCount = Math.min(AWARENESS_QUOTE_GEN_MAX, current + 1);
    }
  }
  persistJournalQuietly();
}

async function generateJournalChecklist(kind, options = {}) {
  if (kind === "execution") setJournalFoldOpen("section-exec", true);
  if (kind === "awareness") setJournalFoldOpen("section-aware", true);
  if (kind === "manifest") {
    await generateManifestChecklist(options);
    return;
  }
  const isAware = kind === "awareness";
  if (recoverStaleBusy(state.checklistBusy[kind], state.checklistBusyAt?.[kind], () => setChecklistLoading(kind, false))) {
    if (!options.auto) showToast(isAware ? "還在為你整理核心覺察，請稍候。" : "還在為你整理行動卡，請稍候。");
    return;
  }
  const journal = collectJournal();
  const answers = isAware ? journal.awareness : journal.execution;
  const ready = isAware ? awarenessReady(answers) : executionReady(answers);
  if (isAware && awarenessQuoteGenCapped()) {
    if (!options.auto) showToast("這次復盤的核心覺察已經留下來了。");
    syncAwareQuoteGate();
    return;
  }
  if (!ready) {
    if (!options.auto) {
      showToast(
        isAware
          ? "先回答完 3 個問題，再看見今天的核心覺察。"
          : "先把執行突破題寫完，再生成勾勾表。"
      );
    }
    return;
  }
  const sig = checklistSignature(answers);
  if (options.auto && state.journalMeta[isAware ? "awarenessAiSig" : "executionAiSig"] === sig) return;

  const token = (state.checklistToken[kind] || 0) + 1;
  state.checklistToken[kind] = token;
  setChecklistLoading(kind, true);
  const watchdog = setTimeout(() => {
    if (state.checklistToken[kind] === token && state.checklistBusy[kind]) {
      setChecklistLoading(kind, false);
      if (!options.auto) showToast("雲端回應太久，已先停下來。請再試一次。");
    }
  }, 32000);

  const fallback = isAware ? buildAwarenessCheckItems(journal) : buildExecutionCheckItems(journal);
  const min = isAware ? AWARENESS_QUOTE_COUNT : 3;
  const max = isAware ? AWARENESS_QUOTE_COUNT : 4;

  try {
    if (!state.user) {
      throw new Error("請先登入，才能使用雲端分析。");
    }
    const remote = await postReview({
      mode: "checklist",
      kind,
      date: currentIso(),
      answers,
      questions: isAware
        ? currentAwarenessQuestions()
        : currentExecutionQuestions(),
      context: {
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        bodyCheck: journal.bodyCheck,
        openActions: getTasks()
          .filter((task) => task.status !== "done")
          .slice(0, 6)
          .map((task) => task.title),
        smallestStep: journal.smallestStep,
      },
      text: answers.join("\n"),
    });
    if (state.checklistToken[kind] !== token) return;
    const items = isAware
      ? normalizeAwarenessQuotes(remote.quotes || remote.items, fallback)
      : normalizeAiExecItems(remote.items, min, max, fallback);
    if (items.length < min) throw new Error("雲端回傳格式不完整");
    applyGeneratedChecklist(kind, items, sig);
    showToast(
      isAware
        ? awarenessQuoteGenCount() >= AWARENESS_QUOTE_GEN_MAX
          ? "今天的核心覺察，已經留下來了。"
          : "今天的核心覺察，已經留下來了。"
        : "行動卡點已生成。"
    );
  } catch (error) {
    if (state.checklistToken[kind] !== token) return;
    applyGeneratedChecklist(kind, fallback.slice(0, max), sig);
    showToast(`雲端分析失敗：${formatApiError(error)}，先用本地整理。`);
  } finally {
    clearTimeout(watchdog);
    if (state.checklistToken[kind] === token) setChecklistLoading(kind, false);
  }
}

function maybeAutoGenerateChecklists(journal) {
  if (state.journalHydrating) return;
  if (state.journalMode === "quick" && !state.quickModules?.aware && !state.quickModules?.exec) return;
  if (quickModuleOn("exec", journal) && executionReady(journal.execution) && state.journalMeta.executionAiSig !== checklistSignature(journal.execution)) {
    generateJournalChecklist("execution", { auto: true });
  }
}

function manifestReady(journal) {
  return String((journal || collectJournal()).manifest || "").trim().length >= 4;
}

function buildManifestCheckItems(journal) {
  const vision = String(journal.manifest || "").trim();
  const short = vision.length > 14 ? `${vision.slice(0, 14)}…` : vision || "這份願景";
  const items = [];
  pushUnique(items, `明天先為「${short}」做一件最小的事`, 5);
  pushUnique(items, "把願景寫成一句明天做得到的話，貼在看得到的地方", 5);
  pushUnique(items, "安排 10 分鐘，只靠近這件事一步", 5);
  if (/錢|收入|客戶|成交|訂單/.test(vision)) pushUnique(items, "主動聯絡一位可能幫忙的人", 5);
  if (/關係|愛|陪伴|溝通/.test(vision)) pushUnique(items, "對在乎的人說一句真心話", 5);
  if (/睡|休息|健康|身體/.test(vision)) pushUnique(items, "今晚固定時間放下螢幕，讓身體先休息", 5);
  return items.slice(0, 5);
}

async function generateManifestChecklist(options = {}) {
  setJournalFoldOpen("section-manifest", true);
  if (state.checklistBusy.manifest && !options.auto) return;
  const journal = collectJournal();
  const vision = String(journal.manifest || "").trim();
  if (vision.length < 4) {
    if (!options.auto) showToast("先寫下明天想顯化的事情，再拆成執行目標。");
    return;
  }
  const sig = vision;
  if (options.auto && state.journalMeta.manifestAiSig === sig) return;

  const token = (state.checklistToken.manifest || 0) + 1;
  state.checklistToken.manifest = token;
  setChecklistLoading("manifest", true);
  const fallback = buildManifestCheckItems(journal);

  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postReview({
      mode: "manifest",
      date: currentIso(),
      vision,
      text: vision,
      context: {
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        openActions: getTasks()
          .filter((task) => task.status !== "done")
          .slice(0, 6)
          .map((task) => task.title),
      },
    });
    if (state.checklistToken.manifest !== token) return;
    const items = normalizeAiChecklistItems(remote.items, 3, 5, fallback);
    if (items.length < 3) throw new Error("雲端回傳格式不完整");
    applyGeneratedChecklist("manifest", items, sig);
    showToast("顯化執行目標已生成。");
  } catch (error) {
    if (state.checklistToken.manifest !== token) return;
    applyGeneratedChecklist("manifest", fallback.slice(0, 5), sig);
    showToast(`雲端分析失敗：${formatApiError(error)}，先用本地步驟。`);
  } finally {
    if (state.checklistToken.manifest === token) setChecklistLoading("manifest", false);
  }
}

function maybeAutoGenerateManifest(journal) {
  if (state.journalHydrating) return;
  if (state.journalMode === "quick" && !state.quickModules?.manifest) return;
  if (manifestReady(journal) && state.journalMeta.manifestAiSig !== String(journal.manifest || "").trim()) {
    generateManifestChecklist({ auto: true });
  }
}

function thanksFilled(journal) {
  return thanksItemsFrom(journal?.thanksText || journal?.thanks).length > 0;
}

function quickInsightReady(journal) {
  const data = journal || collectJournal();
  return Boolean(thanksFilled(data) && String(data.event || "").trim() && data.mood);
}

function insightReady(journal) {
  const data = journal || collectJournal();
  if ((data.mode || state.journalMode) === "quick") return quickInsightReady(data);
  const check = normalizeBodyCheck(data.bodyCheck, data.bodyTags, data.bodyNote);
  const hasBody = Boolean(
    (data.bodyTags || []).length ||
    String(data.bodyNote || "").trim() ||
    (check.mood.flags || []).length ||
    check.mood.reason ||
    (check.body.flags || []).length ||
    check.body.other ||
    check.body.reason ||
    check.sleep.duration ||
    check.sleep.quality ||
    check.sleep.energy ||
    check.sleep.reason
  );
  return Boolean(String(data.event || "").trim() && data.mood && hasBody);
}

function insightSignature(journal) {
  const data = journal || collectJournal();
  const thanks = thanksItemsFrom(data.thanksText || data.thanks).join("\n");
  const check = normalizeBodyCheck(data.bodyCheck, data.bodyTags, data.bodyNote);
  const bodySig = [
    (check.mood.flags || []).join("、"),
    check.mood.reason || "",
    (check.body.flags || []).join("、"),
    check.body.other || "",
    check.body.reason || "",
    check.sleep.duration || "",
    check.sleep.quality || "",
    check.sleep.energy || "",
    check.sleep.reason || "",
  ].join("|");
  if ((data.mode || state.journalMode) === "quick") {
    const mods = normalizeQuickModules(data.quickModules || state.quickModules);
    const extra = [];
    if (mods.body) extra.push(bodySig);
    if (mods.aware) extra.push((data.awareness || []).map((item) => String(item || "").trim()).join("|"));
    if (mods.exec) extra.push((data.execution || []).map((item) => String(item || "").trim()).join("|"), String(data.smallestStep || "").trim());
    if (mods.manifest) extra.push(String(data.manifest || "").trim());
    return ["quick", thanks, String(data.event || "").trim(), data.mood || "", JSON.stringify(mods), ...extra].join("\n");
  }
  return ["deep", String(data.event || "").trim(), data.mood || "", bodySig].join("\n");
}

function insightEmptyCopy(quick) {
  return quick
    ? "先寫下感謝、事件與心情，再開始 3 輪引導式深度思考。"
    : "先把感謝、事件、心情與身體覺察寫下來，再開始 3 輪引導式深度思考。";
}

function thinkGuideFoldId() {
  return state.journalMode === "quick" ? "section-quick-insight" : "section-insight";
}

function thinkGuideBodyEl() {
  return document.getElementById(state.journalMode === "quick" ? "quickInsightBody" : "insightBody");
}

function thinkGuideNotReadyMessage() {
  return state.journalMode === "quick"
    ? "請先寫下今日感謝、事件，並選擇心情。"
    : "請先寫下今日事件、選擇心情，並標出身體狀況。";
}

function setThinkGuideLoadingLabel(text) {
  const loader = document.getElementById(state.journalMode === "quick" ? "quickInsightLoading" : "insightLoading");
  const label = loader?.querySelector(".check-loading__label");
  if (label) label.textContent = text;
}

function emphasizeLeadHtml(text, className = "insight-block__text") {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const match = raw.match(/^([\s\S]{8,80}?[。！？])([\s\S]*)$/);
  if (match && String(match[2] || "").trim()) {
    return `<p class="${className}"><strong class="insight-emph">${escapeHtml(match[1])}</strong>${escapeHtml(match[2])}</p>`;
  }
  return `<p class="${className}"><strong class="insight-emph">${escapeHtml(raw)}</strong></p>`;
}

function splitActionLine(text) {
  const raw = String(text || "").trim();
  if (!raw) return { title: "", body: "" };
  const punct = raw.search(/[，。：:、]/);
  if (punct >= 2 && punct <= 16) {
    return { title: raw.slice(0, punct), body: raw.slice(punct + 1).replace(/^[，。：:\s]+/, "") };
  }
  if (raw.length <= 18) return { title: raw.replace(/[。！？]+$/, ""), body: "" };
  return { title: raw.slice(0, 10), body: raw };
}

function actionStepsHtml(items) {
  const list = Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!list.length) return "";
  return `<ol class="action-steps">${list
    .map((item, index) => {
      const { title, body } = splitActionLine(item);
      const num = String(index + 1).padStart(2, "0");
      return `<li class="action-steps__item">
        <div class="action-steps__copy">
          <p class="action-steps__title">${num}｜${escapeHtml(title)}</p>
          ${body ? `<p class="action-steps__body">${escapeHtml(body)}</p>` : ""}
        </div>
      </li>`;
    })
    .join("")}</ol>`;
}

function insightListHtml(items, className) {
  const list = Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!list.length) return "";
  if (className.includes("list") && !className.includes("takeaways")) return actionStepsHtml(list);
  return `<${className.includes("takeaways") ? "ul" : "ol"} class="${className}">${list
    .map((item) => `<li><strong class="insight-emph">${escapeHtml(item)}</strong></li>`)
    .join("")}</${className.includes("takeaways") ? "ul" : "ol"}>`;
}

function renderThinkGuideHtml(insight) {
  const data = normalizeInsight(insight);
  const guide = data.guide || emptyThinkGuide();
  const rounds = guide.rounds || [];
  if (!rounds.length && !guide.summary) {
    return `<p class="insight-card__empty">${insightEmptyCopy(state.journalMode === "quick")}</p>`;
  }
  const current = Math.min(3, Math.max(1, guide.round || rounds.length || 1));
  const done = thinkGuideDone(guide);
  const roundCards = rounds
    .map((item, index) => {
      const num = String(index + 1).padStart(2, "0");
      const active = !done && index + 1 === current && !item.answer;
      const answered = Boolean(item.answer);
      return `<article class="think-guide__round${active ? " is-on" : answered ? " is-done" : ""}">
        <p class="think-guide__kicker">第 ${num} 輪</p>
        <p class="think-guide__q">${escapeHtml(item.question)}</p>
        ${item.hint && (active || !answered) ? `<p class="think-guide__hint">${escapeHtml(item.hint)}</p>` : ""}
        ${
          answered
            ? `<p class="think-guide__answer">${escapeHtml(item.answer)}</p>`
            : active
              ? `<label class="think-guide__field">
                  <span class="sr-only">這一輪的回答</span>
                  <textarea class="textarea think-guide-answer" rows="4" placeholder="用一句話，把此刻真正想到的寫下來…"></textarea>
                  <button class="ai-check-btn" data-think-guide-next type="button">${index === 2 ? "完成三輪，生成總結" : "送出，進入下一輪"}</button>
                </label>`
              : ""
        }
      </article>`;
    })
    .join("");
  const closeHtml =
    done || guide.summary
      ? `<article class="think-guide__close">
        <p class="think-guide__kicker">深度思考總結</p>
        ${guide.title || data.title ? `<p class="think-guide__close-title">${escapeHtml(guide.title || data.title)}</p>` : ""}
        <p class="think-guide__close-text">${escapeHtml(guide.summary || data.conclusion || "")}</p>
        ${actionStepsHtml(guide.actions.length ? guide.actions : data.suggestions)}
      </article>`
      : "";
  return `<div class="think-guide">${roundCards}${closeHtml}</div>`;
}

function renderInsightResultHtml(data) {
  const analysis = String(data.psychology || data.conclusion || "").trim();
  const reflection = String(data.reflection || "").trim();
  const hasBody = Boolean(String(data.bodyLink || "").trim());
  const suggestions = data.suggestions || [];
  const takeaways = data.takeaways || [];
  if (!analysis && !reflection && !suggestions.length && !takeaways.length) {
    return `<p class="insight-card__empty">${insightEmptyCopy(state.journalMode === "quick")}</p>`;
  }
  const coreLine = String(data.title || takeaways[0] || "").trim();
  return `
    <article class="insight-card__result">
      ${coreLine ? renderConclusionCallout(coreLine) : ""}
      ${
        analysis
          ? `<section class="insight-block">
        <p class="insight-block__label">① 今天的身心訊號</p>
        ${emphasizeLeadHtml(analysis)}
        ${hasBody ? `<p class="insight-block__note">${escapeHtml(data.bodyLink)}</p>` : ""}
      </section>`
          : ""
      }
      ${
        reflection
          ? `<section class="insight-block insight-block--review">
        <p class="insight-block__label">② 客觀檢討與反思</p>
        ${emphasizeLeadHtml(reflection)}
      </section>`
          : ""
      }
      ${
        suggestions.length
          ? `<section class="insight-block insight-block--tips">
        <p class="insight-block__label">③ 具體突破建議（怎麼做會更好）</p>
        ${actionStepsHtml(suggestions)}
      </section>`
          : ""
      }
      ${
        takeaways.length
          ? `<section class="insight-block insight-block--focus">
        <p class="insight-block__label">💡 今日核心重點整理</p>
        ${insightListHtml(takeaways, "insight-block__takeaways")}
      </section>`
          : ""
      }
    </article>
  `;
}

function renderInsightCard(insight) {
  const data = normalizeInsight(insight);
  const guide = data.guide || emptyThinkGuide();
  const started = Boolean(guide.rounds.length || guide.summary);
  const deepRoot = document.getElementById("insightBody");
  const quickRoot = document.getElementById("quickInsightBody");
  const deepBtn = document.getElementById("btnInsightAi");
  const quickBtn = document.getElementById("btnQuickInsight");
  const html = started
    ? renderThinkGuideHtml(data)
    : data.psychology || data.conclusion || data.reflection
      ? renderInsightResultHtml(data)
      : `<p class="insight-card__empty">${insightEmptyCopy(state.journalMode === "quick")}</p>`;
  const activeRoot = state.journalMode === "quick" ? quickRoot : deepRoot;
  const idleRoot = state.journalMode === "quick" ? deepRoot : quickRoot;
  if (activeRoot) activeRoot.innerHTML = html;
  if (idleRoot) {
    idleRoot.innerHTML = `<p class="insight-card__empty">${insightEmptyCopy(idleRoot === quickRoot)}</p>`;
  }
  if (deepBtn) deepBtn.hidden = state.journalMode !== "quick" && started;
  if (quickBtn) quickBtn.hidden = state.journalMode === "quick" && started;
}

function syncCompleteButtonLabel() {
  const btn = document.getElementById("btnCompleteToday");
  if (!btn || state.completeBusy) return;
  btn.textContent = state.journalMode === "quick" ? "完成快速復盤" : "完成今日復盤";
}

function setCompleteBusy(loading) {
  state.completeBusy = loading;
  const btn = document.getElementById("btnCompleteToday");
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.textContent = "正在為你收成今日深度思考…";
  else syncCompleteButtonLabel();
}

function setInsightLoading(loading) {
  const quick = state.journalMode === "quick";
  const btn = document.getElementById(quick ? "btnQuickInsight" : "btnInsightAi");
  const otherBtn = document.getElementById(quick ? "btnInsightAi" : "btnQuickInsight");
  const loader = document.getElementById(quick ? "quickInsightLoading" : "insightLoading");
  const otherLoader = document.getElementById(quick ? "insightLoading" : "quickInsightLoading");
  const body = document.getElementById(quick ? "quickInsightBody" : "insightBody");
  const otherBody = document.getElementById(quick ? "insightBody" : "quickInsightBody");
  state.insightBusy = loading;
  state.insightBusyAt = loading ? Date.now() : 0;
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "想下一問…" : "開始深度思考";
  }
  if (otherBtn) {
    otherBtn.disabled = false;
    otherBtn.textContent = "開始深度思考";
  }
  if (loader) loader.hidden = !loading;
  if (otherLoader) otherLoader.hidden = true;
  if (body) body.classList.toggle("is-loading", loading);
  if (otherBody) otherBody.classList.remove("is-loading");
}

function localInsightFallback(journal) {
  const mood = journal.mood || "這份心情";
  const thanks = thanksItemsFrom(journal.thanksText || journal.thanks);
  const tags = (journal.bodyTags || []).join("、") || "身體的訊號";
  const eventBit = String(journal.event || "").trim().slice(0, 18);
  if (state.journalMode === "quick") {
    const psychology = thanks.length
      ? `今天心情停在「${mood}」。事件本身也許嘈雜，但你寫下的感謝已經透露：你並不是只有被碰到的那一面，還有一處願意被滋養的柔軟。真正觸動你的，往往不是事情成不成功，而是有沒有被看見、被珍惜。`
      : `今天這件事碰到你時，心情停在「${mood}」。願意把它寫下來，本身就是防衛稍微鬆開的時刻。真正要被看見的，是你對「被好好對待」或「把事情做對」的潛在期待。`;
    return {
      title: "先被接住的那一句",
      psychology,
      conclusion: psychology,
      logic: psychology,
      bodyLink: "",
      reflection: "今天你已經願意把事情寫下來，這是好的。比較容易卡住的地方，是情緒一來就急著判定對錯，或把還沒說出口的期待，直接當成對方應該懂。調整點不在「你不該有感覺」，而在「感覺出現後，你有沒有給自己一句真實的話」。",
      suggestions: [
        "今晚用一句話對自己說：我看見今天被碰到的地方了，先不用立刻修好。",
        "把感謝裡最溫的那一件，再寫成一句可以留給明天的話。",
        thanks.length ? "明天用 5 分鐘，只做一件能讓這份感謝落地的小事。" : "明天用 5 分鐘，只把今天卡住的第一個動作做完。",
      ],
      takeaways: [
        `心情「${mood}」不是噪音，是入口。`,
        "被觸動，往往因為有還沒被滿足的期待。",
        "感謝與事件可以同時存在，不必互相取消。",
      ],
      sig: insightSignature(journal),
    };
  }
  const psychology = `今天這件事碰到你時，心情停在「${mood}」。真正要被看見的，不一定是表面上發生了什麼${eventBit ? `（${eventBit}…）` : ""}，而是你當下用什麼方式保護自己。防衛不一定是錯的，它常常是在來不及說清楚之前，先幫你把關係或面子守住。`;
  return {
    title: "身體比念頭更早開口",
    psychology,
    conclusion: psychology,
    logic: psychology,
    bodyLink: `${tags} 往往不是多餘的噪音，而是壓力已經先走到身上。`,
    reflection: "今天的處理方式裡，最值得調整的不是情緒本身，而是情緒一來就進入防衛或硬撐。你可以允許自己先停 10 秒，把「我以為發生了什麼」和「實際發生了什麼」分開寫，再決定要不要回應。",
    suggestions: [
      "今晚先做 8 次「吸 4 秒、吐 6 秒」，讓身體確認現在是安全的。",
      "把「我以為對方在否定我」改寫成一句更接近事實的話，只寫給自己看。",
      "明天只做一件 5 分鐘內能完成、跟今天這件事有關的最小動作。",
    ],
    takeaways: [
      "被觸動，是期待被碰到了。",
      "身體比念頭更早開口。",
      "先接住自己，再決定要不要行動。",
    ],
    sig: insightSignature(journal),
  };
}

function thinkGuideContext(journal, guide) {
  const quick = state.journalMode === "quick";
  const mods = normalizeQuickModules(journal.quickModules || state.quickModules);
  const on = (key) => !quick || Boolean(mods[key]);
  return {
    variant: "think-guide",
    journalMode: state.journalMode,
    mode: state.journalMode,
    step: "ask",
    modules: quick ? Object.keys(mods).filter((key) => mods[key]) : ["body", "aware", "exec"],
    event: journal.event,
    mood: journal.mood,
    thanks: thanksTextFrom(journal),
    thanksText: thanksTextFrom(journal),
    awareness: on("aware") ? journal.awareness : [],
    execution: on("exec") ? journal.execution : [],
    smallestStep: on("exec") ? journal.smallestStep : "",
    bodyTags: on("body") ? journal.bodyTags : [],
    bodyNote: on("body") ? journal.bodyNote : "",
    bodyCheck: on("body") ? journal.bodyCheck : null,
    manifest: on("manifest") ? journal.manifest : "",
    rounds: (guide?.rounds || []).map((item) => ({
      question: item.question,
      hint: item.hint,
      answer: item.answer,
    })),
  };
}

function localThinkGuideAsk(journal, round, guide) {
  const mood = journal.mood || "這份心情";
  const eventBit = String(journal.event || "").trim().slice(0, 16) || "今天這件事";
  const questions = [
    {
      question: `在「${eventBit}」裡，最讓你放不下的，其實是哪一個瞬間？`,
      hint: "先點名那個畫面，不必急著解釋。",
    },
    {
      question: `如果「${mood}」可以說話，它最想讓你承認的是什麼？`,
      hint: "往內聽一句還沒被允許說出口的話。",
    },
    {
      question: "明天的你若只改一件最小的事，會先輕輕碰哪裡？",
      hint: "選小到 5 分鐘內做得到的那一步。",
    },
  ];
  return questions[Math.max(0, Math.min(2, round - 1))];
}

function localThinkGuideClose(journal, guide) {
  const last = (guide.rounds || []).map((item) => item.answer).filter(Boolean).slice(-1)[0] || "你今天願意停下來看自己";
  return {
    title: "先把看見，收成下一步",
    summary: `三輪問下來，真正被碰到的不是事情成不成功，而是你有沒有被自己接住。你寫下「${String(last).slice(0, 24)}」，已經比繞開它更靠近核心。先溫柔地承認這一層，再把力氣放到明天做得到的兩件小事上。`,
    actions: [
      "今晚把這一輪最刺到的那句話，手寫成一行，放到明天看得到的地方。",
      "明天只做一件 5 分鐘內能完成、和今天卡點有關的小事，做完就停。",
    ],
  };
}

function applyThinkGuideInsight(guide, sig) {
  const data = normalizeThinkGuide(guide);
  const insight = normalizeInsight({
    title: data.title,
    conclusion: data.summary,
    psychology: data.summary,
    suggestions: data.actions,
    takeaways: data.actions,
    guide: data,
    sig,
  });
  state.journalInsight = insight;
  state.journalMeta.insightSig = sig;
  renderInsightCard(insight);
  persistJournalQuietly();
  return insight;
}

function recoverStaleBusy(flag, startedAt, clearFn, limitMs = 32000) {
  if (!flag) return false;
  if (Date.now() - (startedAt || 0) < limitMs) return true;
  if (typeof clearFn === "function") clearFn();
  return false;
}

async function generateThinkGuideAsk(options = {}) {
  setJournalFoldOpen(thinkGuideFoldId(), true);
  if (recoverStaleBusy(state.insightBusy, state.insightBusyAt, () => setInsightLoading(false))) {
    if (!options.auto) showToast("還在為你想下一問，請稍候。");
    return false;
  }
  const journal = collectJournal();
  if (!insightReady(journal)) {
    if (!options.auto) showToast(thinkGuideNotReadyMessage());
    return false;
  }
  const current = normalizeInsight(state.journalInsight);
  const guide = current.guide || emptyThinkGuide();
  if (thinkGuideDone(guide)) return true;
  const nextRound = (guide.rounds || []).length + 1;
  if (nextRound > 3) return generateThinkGuideClose(options);
  const sig = insightSignature(journal);
  if (options.auto && guide.rounds.length && current.sig === sig) return false;
  const token = (state.insightToken || 0) + 1;
  state.insightToken = token;
  setInsightLoading(true);
  const watchdog = setTimeout(() => {
    if (state.insightToken === token && state.insightBusy) {
      setInsightLoading(false);
      if (!options.auto) showToast("雲端回應太久，已先停下來。請再試一次。");
    }
  }, 32000);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postReview({
      mode: "insight",
      variant: "think-guide",
      step: "ask",
      round: nextRound,
      date: currentIso(),
      text: journal.event,
      context: { ...thinkGuideContext(journal, guide), step: "ask", round: nextRound },
    });
    if (state.insightToken !== token) return false;
    const asked = {
      question: String(remote.question || "").trim(),
      hint: String(remote.hint || "").trim(),
      answer: "",
    };
    if (!asked.question) throw new Error("雲端回傳格式不完整");
    const nextGuide = {
      ...guide,
      round: nextRound,
      rounds: [...guide.rounds, asked],
    };
    applyThinkGuideInsight(nextGuide, sig);
    if (!options.auto) showToast(`深度思考｜第 ${nextRound}/3 輪`);
    return true;
  } catch (error) {
    if (state.insightToken !== token) return false;
    const asked = { ...localThinkGuideAsk(journal, nextRound, guide), answer: "" };
    applyThinkGuideInsight({ ...guide, round: nextRound, rounds: [...guide.rounds, asked] }, sig);
    if (!options.auto) showToast(`雲端提問失敗：${formatApiError(error)}，先用本地引導。`);
    return true;
  } finally {
    clearTimeout(watchdog);
    if (state.insightToken === token) setInsightLoading(false);
  }
}

async function generateThinkGuideClose(options = {}) {
  setJournalFoldOpen(thinkGuideFoldId(), true);
  if (recoverStaleBusy(state.insightBusy, state.insightBusyAt, () => setInsightLoading(false))) {
    if (!options.auto) showToast("還在為你收成今日深度思考，請稍候。");
    return false;
  }
  const journal = collectJournal();
  const current = normalizeInsight(state.journalInsight);
  const guide = current.guide || emptyThinkGuide();
  if (guide.rounds.filter((item) => item.answer).length < 3) {
    if (!options.auto) showToast("請先寫完三輪深度思考。");
    return false;
  }
  const sig = insightSignature(journal);
  const token = (state.insightToken || 0) + 1;
  state.insightToken = token;
  setInsightLoading(true);
  setThinkGuideLoadingLabel("正在為你收成今日深度思考…");
  const watchdog = setTimeout(() => {
    if (state.insightToken === token && state.insightBusy) {
      setInsightLoading(false);
      if (!options.fromComplete && !options.auto) showToast("雲端回應太久，已先停下來。請再試一次。");
    }
  }, 32000);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postReview({
      mode: "insight",
      variant: "think-guide",
      step: "close",
      date: currentIso(),
      text: journal.event,
      context: { ...thinkGuideContext(journal, guide), step: "close" },
    });
    if (state.insightToken !== token) return false;
    const closed = {
      title: String(remote.title || "").trim(),
      summary: String(remote.summary || "").trim(),
      actions: Array.isArray(remote.actions) ? remote.actions.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 2) : [],
    };
    if (!closed.summary || closed.actions.length < 2) throw new Error("雲端回傳格式不完整");
    applyThinkGuideInsight({ ...guide, round: 4, title: closed.title, summary: closed.summary, actions: closed.actions }, sig);
    if (!options.fromComplete) showToast("今日深度思考已生成。");
    return true;
  } catch (error) {
    if (state.insightToken !== token) return false;
    const fallback = localThinkGuideClose(journal, guide);
    applyThinkGuideInsight({ ...guide, round: 4, ...fallback }, sig);
    if (!options.fromComplete) showToast(`雲端總結失敗：${formatApiError(error)}，先留下本地思考。`);
    return true;
  } finally {
    clearTimeout(watchdog);
    setThinkGuideLoadingLabel("正在為你想下一問…");
    if (state.insightToken === token) setInsightLoading(false);
  }
}

async function submitThinkGuideRound() {
  if (recoverStaleBusy(state.insightBusy, state.insightBusyAt, () => setInsightLoading(false))) {
    showToast("還在為你想下一問，請稍候。");
    return;
  }
  const journal = collectJournal();
  if (!insightReady(journal)) {
    showToast(thinkGuideNotReadyMessage());
    return;
  }
  const answer = String(thinkGuideBodyEl()?.querySelector(".think-guide-answer")?.value || "").trim();
  if (answer.length < 2) {
    showToast("先寫下一點你此刻想到的，再往下一輪。");
    return;
  }
  const current = normalizeInsight(state.journalInsight);
  const guide = current.guide || emptyThinkGuide();
  const rounds = (guide.rounds || []).map((item, index, list) =>
    index === list.length - 1 ? { ...item, answer } : item
  );
  const nextGuide = { ...guide, rounds };
  applyThinkGuideInsight(nextGuide, insightSignature(journal));
  if (rounds.filter((item) => item.answer).length >= 3) {
    await generateThinkGuideClose();
    return;
  }
  await generateThinkGuideAsk();
}

async function generateJournalInsight(options = {}) {
  return generateThinkGuideAsk(options);
}

function maybeAutoGenerateInsight() {
  return;
}

function renderBodyCoachCard(coach) {
  const root = document.getElementById("bodyCoachBody");
  if (!root) return;
  const data = normalizeBodyCoach(coach);
  if (!data.analysis && !data.suggestions.length) {
    root.innerHTML = `<p class="insight-card__empty">先把左邊的心情、身體與睡眠看過，再點看看今天適合怎麼照顧自己。</p>`;
    return;
  }
  const tips = actionStepsHtml(data.suggestions);
  const core = String(data.analysis || "").split(/[。！？]/).map((item) => item.trim()).filter(Boolean)[0];
  root.innerHTML = `
    <article class="insight-card__result">
      ${core ? renderConclusionCallout(/[。！？]$/.test(core) ? core : `${core}。`) : ""}
      ${
        data.analysis
          ? `<section class="insight-block">
        <p class="insight-block__label">① 今天的身心訊號</p>
        ${emphasizeLeadHtml(data.analysis)}
      </section>`
          : ""
      }
      ${
        tips
          ? `<section class="insight-block insight-block--tips">
        <p class="insight-block__label">③ 具體突破建議（怎麼做會更好）</p>
        ${tips}
      </section>`
          : ""
      }
    </article>
  `;
}

function setBodyCoachLoading(loading) {
  const btn = document.getElementById("btnBodyCoach");
  const loader = document.getElementById("bodyCoachLoading");
  const body = document.getElementById("bodyCoachBody");
  state.bodyCoachBusy = loading;
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "正在為你整理…" : "✦ 看看今天的身心建議";
  }
  if (loader) loader.hidden = !loading;
  if (body) body.classList.toggle("is-loading", loading);
}

function localBodyCoachFallback(journal) {
  const check = normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote);
  const moodFlags = check.mood.flags || [];
  const bodyFlags = check.body.flags || [];
  const sleepFlags = check.sleep.flags || [];
  const moodBits = moodFlags.length ? `心情是「${moodFlags.join("、")}」` : "心情大致平穩";
  const bodyBits = bodyFlags.length ? `身體有「${bodyFlags.join("、")}」` : "身體沒有明顯不適";
  const sleepBits = sleepFlags.join("、") || "未特別勾選睡眠狀況";
  const moodIssue = moodFlags.includes("焦慮") || moodFlags.includes("煩躁") || moodFlags.includes("脾氣暴躁") || moodFlags.includes("不耐煩");
  const bodyIssue =
    bodyFlags.includes("腸胃不適") ||
    bodyFlags.includes("頭痛") ||
    bodyFlags.includes("全身痠痛") ||
    bodyFlags.includes("身體疲勞");
  const sleepIssue = sleepFlags.includes("睡不著");
  const suggestions = [];
  if (moodIssue || sleepIssue) {
    suggestions.push("今晚先做 8 次「吸 4 秒、吐 6 秒」的腹式呼吸，讓交感神經慢慢降下來。");
  } else {
    suggestions.push("站起來把肩膀繞三圈、再慢慢轉頭，給身體一個明確的換檔訊號。");
  }
  if (bodyFlags.includes("腸胃不適") || bodyFlags.includes("頭痛")) {
    suggestions.push("這一小時每 20 分鐘喝一小口水，先不要用咖啡或空腹撐過不適。");
  } else if (bodyFlags.includes("身體疲勞") || bodyFlags.includes("全身痠痛")) {
    suggestions.push("接下來 10 分鐘先坐下或躺平，把雙腿抬高或輕輕伸展，不要再硬撐下一件事。");
  } else {
    suggestions.push("現在補一杯溫水，接下來兩小時把飲料換成白開水。");
  }
  if (bodyFlags.includes("全身痠痛") || bodyFlags.includes("身體疲勞") || sleepIssue) {
    suggestions.push("睡前 10 分鐘先把髖關節與小腿輕輕轉開，讓身體先進入休息，再關燈。");
  } else if (sleepFlags.includes("10:00以前入睡") || sleepFlags.includes("睡得很好")) {
    suggestions.push("維持今晚的入睡節奏，睡前把明天第一件小事寫在紙上，就不要再滑手機。");
  } else {
    suggestions.push("把睡前 20 分鐘留給伸展或熱水洗手臂，讓大腦有一段明確的下班儀式。");
  }
  const analysis =
    moodIssue || bodyIssue || sleepIssue
      ? `今天是${moodBits}，同時${bodyBits}；睡眠這邊是「${sleepBits}」。心情、身體與睡眠常常一起緊、也一起鬆。先讓身體有一小段被好好對待的時間，情緒才有地方慢慢落地。`
      : `今天是${moodBits}，同時${bodyBits}；睡眠這邊是「${sleepBits}」。狀態偏穩，就用輕柔的小動作把這份安放守住，不必等到緊了才開始照顧自己。`;
  return {
    analysis,
    suggestions: suggestions.slice(0, 3),
    sig: bodyCoachSignature(journal),
  };
}

async function generateBodyCoach(options = {}) {
  setJournalFoldOpen("section-body", true);
  if (state.bodyCoachBusy) return;
  const journal = collectJournal();
  if (!bodyCoachReady(journal, options)) {
    if (!options.auto) showToast("請先勾選今天有出現的狀況。");
    return;
  }
  const sig = bodyCoachSignature(journal);
  if (options.auto && state.journalMeta.bodyCoachSig === sig) return;

  const token = (state.bodyCoachToken || 0) + 1;
  state.bodyCoachToken = token;
  setBodyCoachLoading(true);

  try {
    if (!state.user) throw new Error("請先登入，才能看看今天的身心建議。");
    const remote = await postReview({
      mode: "bodycoach",
      date: currentIso(),
      text: deriveBodyNote(journal.bodyCheck) || journal.event || "身體覺察",
      context: {
        event: journal.event,
        mood: journal.mood,
        bodyCheck: journal.bodyCheck,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        thanks: thanksTextFrom(journal),
        thanksText: thanksTextFrom(journal),
      },
    });
    if (state.bodyCoachToken !== token) return;
    const coach = { ...normalizeBodyCoach(remote), sig };
    if (!coach.analysis || coach.suggestions.length < 3) throw new Error("雲端回傳格式不完整");
    state.journalBodyCoach = coach;
    state.journalMeta.bodyCoachSig = sig;
    renderBodyCoachCard(coach);
    persistJournalQuietly();
    showToast("今天的身心建議，已經為你整理好了。");
  } catch (error) {
    if (state.bodyCoachToken !== token) return;
    const fallback = localBodyCoachFallback(journal);
    state.journalBodyCoach = fallback;
    state.journalMeta.bodyCoachSig = sig;
    renderBodyCoachCard(fallback);
    persistJournalQuietly();
    showToast(`雲端建議還沒整理好：${formatApiError(error)}，先留下本地身心小結。`);
  } finally {
    if (state.bodyCoachToken === token) setBodyCoachLoading(false);
  }
}

function maybeAutoGenerateBodyCoach(journal) {
  if (state.journalHydrating) return;
  if (state.journalMode === "quick" && !state.quickModules?.body) return;
  if (bodyCoachReady(journal, { auto: true }) && state.journalMeta.bodyCoachSig !== bodyCoachSignature(journal)) {
    generateBodyCoach({ auto: true });
  }
}

const LEGACY_AWARENESS_PROMPTS = [CORE_AWARENESS_PROMPT];

const LEGACY_EXECUTION_PROMPTS = [CORE_EXECUTION_PROMPT];

const LEGACY_DEEP_PROMPTS = [
  {
    title: "今天哪一刻，我其實超想翻白眼（或超不爽），但還是忍住了？",
    plainGuide: "白話想一想：先不用分析。那一刻是誰、什麼場面、你心裡那句沒說出口的話是什麼？",
    deepGuide: "深挖一點點：你忍住的背後，真正被碰到的是什麼？是不被尊重、被誤解，還是怕關係破掉？",
    placeholderPlain: "那一刻發生了什麼…",
    placeholderDeep: "真正觸發我的是…",
  },
  {
    title: "今天有沒有哪件事，是我其實可以不要做，但又不好意思拒絕的？",
    plainGuide: "白話想一想：那件「算了，我來」的事是什麼？如果可以重來，你其實想說什麼？",
    deepGuide: "深挖一點點：不好意思拒絕，通常在保護什麼？是怕被覺得不夠好，還是怕讓對方失望？",
    placeholderPlain: "那件不好意思拒絕的事是…",
    placeholderDeep: "我真正在保護的是…",
  },
  {
    title: "如果今天可以重來，哪一件事我絕對不要再用老方法處理？",
    plainGuide: "白話想一想：那個老方法是什麼？重來一次，你會改哪一個小動作就好？",
    deepGuide: "深挖一點點：老方法曾經保護過你。這次你想換成什麼新方法，才比較像現在的自己？",
    placeholderPlain: "那個老方法，以及我想改的小動作…",
    placeholderDeep: "我想換成的新方法是…",
  },
  {
    title: "今天最爽、最讓我覺得「還好我有堅持」的一瞬間是什麼？",
    plainGuide: "白話想一想：那個瞬間發生了什麼？你當時做了哪件「有點難，但還是做了」的事？",
    deepGuide: "深挖一點點：這件事碰觸到你的哪一個價值觀？明天要怎麼複製這個成功經驗，再小一步也行。",
    placeholderPlain: "那個還好我有堅持的瞬間是…",
    placeholderDeep: "我想留下來、明天再複製的是…",
  },
];

function normalizePromptQuestionList(list, max) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      if (typeof item === "string") {
        const question = item.trim();
        return question ? { question, placeholder: "寫下那個時刻…" } : null;
      }
      const question = String(item?.question || item?.title || "").trim();
      if (!question) return null;
      return {
        question: question.slice(0, 120),
        placeholder: String(item?.placeholder || "寫下那個時刻…").trim().slice(0, 48) || "寫下那個時刻…",
      };
    })
    .filter(Boolean)
    .slice(0, max);
}

function normalizeAwarenessPrompts(list) {
  return normalizePromptQuestionList(list, AWARENESS_QUIZ_COUNT);
}

function normalizeExecutionPrompts(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      if (typeof item === "string") {
        const question = item.trim();
        return question
          ? { question: question.slice(0, 120), placeholder: "寫下那個卡點或一小步…", parked: false }
          : null;
      }
      const question = String(item?.question || item?.title || "").trim();
      if (!question) return null;
      return {
        question: question.slice(0, 120),
        placeholder:
          String(item?.placeholder || "寫下那個卡點或一小步…").trim().slice(0, 48) || "寫下那個卡點或一小步…",
        parked: Boolean(item?.parked),
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeExecQuestionTab(value) {
  return value === "later" ? "later" : "open";
}

function collectExecutionAnswers() {
  const prompts = normalizeExecutionPrompts(state.executionPrompts);
  const prev = getReview(currentIso())?.journal?.execution || [];
  const count = Math.max(prompts.length, 3);
  return Array.from({ length: count }, (_, index) => {
    const el = document.getElementById(`exec${index + 1}`);
    if (el) return String(el.value || "");
    return String(prev[index] || "");
  });
}

function normalizeDeepPrompts(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const title = String(item?.title || item?.question || "").trim();
      if (!title) return null;
      return {
        title: title.slice(0, 90),
        plainGuide: String(item?.plainGuide || "白話想一想：先把場面講清楚。").trim().slice(0, 90),
        deepGuide: String(item?.deepGuide || "深挖一點點：真正被碰到的是哪一層？").trim().slice(0, 90),
        placeholderPlain: String(item?.placeholderPlain || "那一刻發生了什麼…").trim().slice(0, 36),
        placeholderDeep: String(item?.placeholderDeep || "真正觸發我的是…").trim().slice(0, 36),
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function promptsSignature(journal) {
  return [currentIso(), insightSignature(journal)].join("\n");
}

function promptsHaveAnswers(journal) {
  const data = journal || collectJournal();
  return (data.awareness || []).some((item) => String(item || "").trim()) || deepHasContent(data.deep);
}

function executionHaveAnswers(journal) {
  const data = journal || collectJournal();
  return (data.execution || []).some((item) => String(item || "").trim());
}

function eventSnippet(journal) {
  const text = String(journal?.event || "").replace(/\s+/g, " ").trim();
  if (!text) return "今天這件事";
  return text.length > 16 ? `${text.slice(0, 16)}…` : text;
}

function localAwarenessPrompts(journal) {
  const mood = journal?.mood || "這份心情";
  const snippet = eventSnippet(journal);
  return [
    {
      question: `面對「${snippet}」，今天真正觸動你、卻還沒說出口的是哪一句？`,
      placeholder: "那句沒說出口的話是…",
    },
    {
      question: `心情停在「${mood}」時，你最先想保護的是什麼？`,
      placeholder: "我真正在保護的是…",
    },
    {
      question: "如果再往內看一層，你真正介意、真正渴望被看見的是什麼？",
      placeholder: "真正介意的是…",
    },
  ];
}

function localDeepPrompts(journal) {
  const mood = journal.mood || "這份心情";
  const snippet = eventSnippet(journal);
  const related = /他|她|對方|同事|家人|朋友|老闆|客戶|伴侶/.test(journal.event || "");
  const pool = [
    [
      {
        title: `面對「${snippet}」，你哪一句真心話最後還是吞回去了？`,
        plainGuide: "白話想一想：那句話卡在哪裡？當時場面是什麼？",
        deepGuide: "深挖一點點：吞回去，是在保護關係、面子，還是保護那個還沒準備好的自己？",
        placeholderPlain: "那句沒說出口的話是…",
        placeholderDeep: "我真正在保護的是…",
      },
      {
        title: related ? "今天對方（或當時的自己）聽見的，和你想傳達的，差在哪裡？" : "今天哪一個決定，其實是害怕多過想要？",
        plainGuide: "白話想一想：你以為自己在做什麼？實際被接收到的又是什麼？",
        deepGuide: `深挖一點點：心情停在「${mood}」時，真正害怕失去的是什麼？`,
        placeholderPlain: "兩邊的落差是…",
        placeholderDeep: "我真正怕失去的是…",
      },
      {
        title: "如果把今天的防衛拿掉十秒，你會先照顧哪一塊？",
        plainGuide: "白話想一想：防衛出現時，身體或語氣先發生了什麼？",
        deepGuide: "深挖一點點：那十秒裡，你最需要的一句話是什麼？",
        placeholderPlain: "防衛出現的樣子是…",
        placeholderDeep: "我最需要的那句話是…",
      },
      {
        title: "今天哪一個小小的誠實，值得被你明天再做一次？",
        plainGuide: "白話想一想：那個誠實可能很小，甚至只有你自己看見。",
        deepGuide: "深挖一點點：它碰到你的哪一個價值？明天怎麼複製，再小一步也行。",
        placeholderPlain: "那個小小的誠實是…",
        placeholderDeep: "我想留下來的是…",
      },
    ],
  ];
  return pool[0];
}

function localExecutionPrompts(journal) {
  const snippet = eventSnippet(journal);
  return [
    {
      question: `針對「${snippet}」，今天最需要被突破的是哪一件事？`,
      placeholder: "最需要突破的是…",
    },
    {
      question: "真正把你卡住的，是事情本身、情緒，還是還沒跨出去的那一步？",
      placeholder: "卡住我的是…",
    },
    {
      question: "明天可以採取的最快行動是什麼？小到今天晚上或明天早上就能做完。",
      placeholder: "明天最快能做的是…",
    },
  ];
}

function collectGrowthProgress() {
  const todayIso = currentIso();
  const dates = getCompletedDates();
  const reviews = getReviews();
  const recentReviews = Object.entries(reviews)
    .filter(([iso, review]) => iso !== todayIso && reviewIsComplete(review))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([iso, review]) => {
      const journal = review.journal || {};
      return {
        date: iso,
        mood: journal.mood || "",
        event: String(journal.event || review.rawText || "").slice(0, 120),
        awareness: (journal.awarenessChecks || []).slice(0, 4),
        actions: (journal.executionChecks || []).slice(0, 3),
        insight: String(journal.insight?.title || journal.insight?.conclusion || "").slice(0, 80),
      };
    });
  const avoidQuestions = [];
  Object.entries(reviews)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)
    .forEach(([, review]) => {
      (review.journal?.awarenessPrompts || []).forEach((item) => avoidQuestions.push(item.question || item.title || item));
      (review.journal?.executionPrompts || []).forEach((item) => avoidQuestions.push(item.question || item.title || item));
      (review.journal?.deepPrompts || []).forEach((item) => avoidQuestions.push(item.title || item.question || item));
    });
  (state.awarenessPrompts || []).forEach((item) => avoidQuestions.push(item.question));
  (state.executionPrompts || []).forEach((item) => avoidQuestions.push(item.question));
  (state.deepPrompts || []).forEach((item) => avoidQuestions.push(item.title));
  return {
    streak: calcStreak(dates, todayIso),
    recentReviews,
    recentInsights: getInsights()
      .slice(0, 8)
      .map((item) => ({ date: item.date || "", title: item.title || "" })),
    openActions: getTasks()
      .filter((task) => task.status !== "done")
      .slice(0, 6)
      .map((task) => task.title),
    avoidQuestions: [...new Set(avoidQuestions.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 20),
  };
}

const CORE_WAIT_COPY = "請先完成上方今日感謝與事件，將為你準備今日專屬的覺察與執行題";
const AWARE_WAIT_COPY = "完成「今日感謝」與「今日事件」後，會依照你今天寫下的內容，產生專屬於你的覺察題。";

function currentAwarenessQuestions() {
  const prompts = normalizeAwarenessPrompts(state.awarenessPrompts);
  if (prompts.length) return prompts.map((item) => item.question);
  return AWARENESS_QUESTIONS.map((item) => item.question);
}

function currentExecutionQuestions() {
  const prompts = normalizeExecutionPrompts(state.executionPrompts);
  if (prompts.length) return prompts.map((item) => item.question);
  return [CORE_EXECUTION_PROMPT.question];
}

function coreStoryReady(journal) {
  const data = journal || collectJournal();
  return Boolean(thanksFilled(data) && String(data.event || "").trim() && data.mood);
}

function corePromptsSignature(journal) {
  const data = journal || collectJournal();
  const thanks = thanksItemsFrom(data.thanksText || data.thanks).join("\n");
  const check = normalizeBodyCheck(data.bodyCheck, data.bodyTags, data.bodyNote);
  const bodySig = [
    (check.mood.flags || []).join("、"),
    check.mood.reason || "",
    (check.body.flags || []).join("、"),
    check.body.other || "",
    check.body.reason || "",
    check.sleep.duration || "",
    check.sleep.quality || "",
    check.sleep.energy || "",
  ].join("|");
  return ["core", thanks, String(data.event || "").trim(), data.mood || "", bodySig].join("\n");
}

function corePromptsHaveAnswers(journal) {
  const data = journal || collectJournal();
  return (
    awarenessQuizAnsweredCount(data.awareness) > 0 ||
    (data.execution || []).some((item) => String(item || "").trim()) ||
    normalizeExecutionPrompts(data.executionPrompts || state.executionPrompts).some((item) => item.parked)
  );
}

function isStockCoreQuestion(question) {
  const q = String(question || "").trim();
  if (!q) return true;
  if (AWARENESS_QUESTIONS.some((item) => item.question === q)) return true;
  return q === CORE_EXECUTION_PROMPT.question;
}

function keepHydratedCorePrompts(prompts, hasAnswers, fromAi, min = 3) {
  if (prompts.length < min) return false;
  if (hasAnswers) return true;
  if (!fromAi) return false;
  return !prompts.some((item) => isStockCoreQuestion(item.question));
}

function hydrateAwarenessPrompts(data) {
  const prompts = normalizeAwarenessPrompts(data?.awarenessPrompts);
  const hasAnswers = (data?.awareness || []).some((item) => normalizeYesNo(item) || String(item || "").trim());
  if (keepHydratedCorePrompts(prompts, hasAnswers, data?.corePromptsAi, AWARENESS_QUIZ_COUNT)) {
    return prompts.slice(0, AWARENESS_QUIZ_COUNT);
  }
  return [];
}

function hydrateExecutionPrompts(data) {
  const prompts = normalizeExecutionPrompts(data?.executionPrompts);
  const hasAnswers =
    (data?.execution || []).some((item) => String(item || "").trim()) || prompts.some((item) => item.parked);
  if (keepHydratedCorePrompts(prompts, hasAnswers, data?.corePromptsAi, 3)) return prompts.slice(0, 3);
  return [];
}

function hasCorePromptSet() {
  return (
    normalizeAwarenessPrompts(state.awarenessPrompts).length >= AWARENESS_QUIZ_COUNT &&
    normalizeExecutionPrompts(state.executionPrompts).length >= 3
  );
}

function collectPromptAnswers(prefix, count = 3) {
  return Array.from({ length: count }, (_, index) => journalFieldValue(`${prefix}${index + 1}`));
}

function syncCorePromptGate() {
  const ready = coreStoryReady();
  const loading = Boolean(state.corePromptsBusy);
  const hasAware = normalizeAwarenessPrompts(state.awarenessPrompts).length >= AWARENESS_QUIZ_COUNT;
  const hasExec = normalizeExecutionPrompts(state.executionPrompts).length >= 3;
  const awareEmpty = document.getElementById("awareEmpty");
  const execEmpty = document.getElementById("execEmpty");
  const awareBtn = document.getElementById("btnAwarePrompts");
  const execBtn = document.getElementById("btnExecPrompts");
  if (awareEmpty) {
    awareEmpty.textContent = AWARE_WAIT_COPY;
    awareEmpty.hidden = loading || hasAware;
  }
  if (execEmpty) {
    execEmpty.textContent = CORE_WAIT_COPY;
    execEmpty.hidden = loading || hasExec;
  }
  if (awareBtn) {
    awareBtn.hidden = hasAware;
    if (!awareBtn.hidden) {
      awareBtn.disabled = !ready || loading;
      awareBtn.textContent = loading ? "正在生成覺察題…" : "✦ 開始今天的覺察";
    }
  }
  if (execBtn) {
    execBtn.hidden = hasExec;
    if (!execBtn.hidden) {
      execBtn.disabled = !ready || loading;
      execBtn.textContent = loading ? "出題中…" : "生成今日專屬行動題";
    }
  }
}

function renderDynamicQuestions(rootId, emptyId, genBtnId, checkBtnId, prompts, prefix, answers, rows) {
  const root = document.getElementById(rootId);
  const empty = document.getElementById(emptyId);
  const genBtn = document.getElementById(genBtnId);
  const checkBtn = document.getElementById(checkBtnId);
  const items = prefix === "aware" ? normalizeAwarenessPrompts(prompts) : normalizeExecutionPrompts(prompts);
  if (!root) return;
  if (!items.length) {
    root.innerHTML = "";
    if (empty) {
      empty.textContent = CORE_WAIT_COPY;
      empty.hidden = Boolean(state.corePromptsBusy);
    }
    if (genBtn) {
      genBtn.hidden = false;
      genBtn.disabled = !coreStoryReady() || Boolean(state.corePromptsBusy);
    }
    if (checkBtn) checkBtn.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  if (checkBtn) checkBtn.hidden = false;
  const saved = Array.isArray(answers) ? answers : collectPromptAnswers(prefix, items.length);
  const hint = prefix === "exec" ? "寫下今天的行動卡點…" : "寫下今天的覺察…";
  root.innerHTML = items
    .map(
      (item, index) => `
        <div class="aware-q">
          <p class="journal-core-q">${escapeHtml(item.question)}</p>
          <textarea class="textarea" id="${prefix}${index + 1}" rows="${rows}" placeholder="${escapeHtml(hint)}">${escapeHtml(saved[index] || "")}</textarea>
        </div>
      `
    )
    .join("");
}

function renderAwarenessQuestions(prompts, options = {}) {
  const root = document.getElementById("awareQuestions");
  const empty = document.getElementById("awareEmpty");
  const genBtn = document.getElementById("btnAwarePrompts");
  const items = normalizeAwarenessPrompts(prompts);
  if (!root) return;
  if (!items.length) {
    root.classList.remove("aware-quiz");
    root.innerHTML = "";
    if (empty) {
      empty.textContent = AWARE_WAIT_COPY;
      empty.hidden = Boolean(state.corePromptsBusy);
    }
    if (genBtn) {
      genBtn.hidden = false;
      genBtn.disabled = !coreStoryReady() || Boolean(state.corePromptsBusy);
      genBtn.textContent = state.corePromptsBusy ? "正在生成覺察題…" : "✦ 開始今天的覺察";
    }
    syncAwareQuoteGate();
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  const saved = Array.isArray(options.answers) ? options.answers.map(normalizeYesNo) : collectAwarenessQuizAnswers();
  root.classList.add("aware-quiz");
  root.innerHTML = items
    .map((item, index) => {
      const answer = normalizeYesNo(saved[index]);
      return `
        <article class="aware-quiz__item" data-index="${index}" data-answer="${escapeHtml(answer)}">
          <p class="aware-quiz__q"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(item.question)}</p>
          <div class="aware-quiz__opts" role="group" aria-label="第 ${index + 1} 題">
            <button type="button" class="aware-quiz__opt${answer === "是" ? " is-on" : ""}" data-aware-answer="是">是</button>
            <button type="button" class="aware-quiz__opt${answer === "否" ? " is-on" : ""}" data-aware-answer="否">否</button>
          </div>
        </article>
      `;
    })
    .join("");
  syncAwareQuoteGate();
}

function renderExecutionQuestions(prompts, options = {}) {
  const root = document.getElementById("execQuestions");
  const empty = document.getElementById("execEmpty");
  const genBtn = document.getElementById("btnExecPrompts");
  const checkBtn = document.getElementById("btnExecAi");
  const items = normalizeExecutionPrompts(prompts);
  if (!root) return;
  if (!items.length) {
    root.innerHTML = "";
    if (empty) {
      empty.textContent = CORE_WAIT_COPY;
      empty.hidden = Boolean(state.corePromptsBusy);
    }
    if (genBtn) {
      genBtn.hidden = false;
      genBtn.disabled = !coreStoryReady() || Boolean(state.corePromptsBusy);
    }
    if (checkBtn) checkBtn.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  if (checkBtn) checkBtn.hidden = false;
  const saved = Array.isArray(options.answers)
    ? options.answers.map((item) => String(item || ""))
    : collectExecutionAnswers();
  root.innerHTML = items.length
    ? items
        .map(
          (item, index) => `
        <div class="aware-q exec-q" data-exec-index="${index}">
          <p class="journal-core-q">${escapeHtml(item.question)}</p>
          <textarea class="textarea" id="exec${index + 1}" rows="4" placeholder="${escapeHtml(item.placeholder || "寫下今天的行動卡點…")}">${escapeHtml(saved[index] || "")}</textarea>
        </div>
      `
        )
        .join("")
    : `<p class="exec-q-empty">目前沒有執行題。</p>`;
}

function renderDeepItemHtml(item, index, slot, openSet) {
  return `
        <details class="deep-item" data-deep-index="${index}" ${openSet.has(index) ? "open" : ""}>
          <summary>${escapeHtml(item.title)}</summary>
          <div class="deep-block">
            <p class="deep-guide"><strong>白話想一想</strong>${escapeHtml(String(item.plainGuide || "").replace(/^白話想一想[:：]?\s*/, ""))}</p>
            <textarea class="textarea" id="deep${index}plain" rows="3" placeholder="用白話寫下這一層…">${escapeHtml(slot.plain || "")}</textarea>
          </div>
          <div class="deep-block">
            <p class="deep-guide"><strong>深挖一點點</strong>${escapeHtml(String(item.deepGuide || "").replace(/^深挖一點點[:：]?\s*/, ""))}</p>
            <textarea class="textarea" id="deep${index}deep" rows="3" placeholder="再往內看一層…">${escapeHtml(slot.deep || "")}</textarea>
          </div>
          <button class="ai-check-btn" data-deepen="${index}" type="button">帶我再深入思考</button>
          <div class="check-loading" id="deep${index}Loading" hidden>
            <p class="check-loading__label">正在根據你的回答往下挖…</p>
            <div class="ai-thinking__bar"><i></i></div>
          </div>
          <div class="deep-follow" id="deep${index}Follow"></div>
        </details>
      `;
}

function deepSlotHasContent(slot) {
  const data = slot || {};
  return Boolean(
    String(data.plain || "").trim() ||
      String(data.deep || "").trim() ||
      (data.followups || []).some((item) => String(item || "").trim()) ||
      (data.notes || []).some((item) => String(item || "").trim())
  );
}

function renderDeepThemes(prompts, options = {}) {
  const root = document.getElementById("deepList");
  const moreBtn = document.getElementById("btnDeepMore");
  if (!root) return;
  const items = normalizeDeepPrompts(prompts);
  const deep = options.deep || [1, 2, 3, 4].map((index) => {
    try {
      return collectDeepSlot(index);
    } catch {
      return { plain: "", deep: "", followups: [], notes: ["", "", "", ""] };
    }
  });
  const openSet = new Set(
    [...root.querySelectorAll("details.deep-item[open]")].map((el) => Number(el.dataset.deepIndex || 0))
  );
  if (!items.length) {
    root.classList.add("is-waiting");
    root.innerHTML = `<p class="deep-empty">寫完今日事件、心情與身體狀況後，會依你今天的狀態生成一個最值得深挖的主題。</p>`;
    if (moreBtn) moreBtn.hidden = true;
    return;
  }
  const extraFilled = deep.slice(1).some(deepSlotHasContent);
  if (extraFilled) state.deepExpanded = true;
  root.classList.remove("is-waiting");
  const first = items[0];
  const rest = items.slice(1);
  const firstHtml = renderDeepItemHtml(first, 1, deep[0] || {}, openSet);
  const restHtml = rest
    .map((item, i) => renderDeepItemHtml(item, i + 2, deep[i + 1] || {}, openSet))
    .join("");
  root.innerHTML =
    firstHtml +
    (rest.length
      ? `<div class="deep-more" id="deepMore" ${state.deepExpanded ? "" : "hidden"}>${restHtml}</div>`
      : "");
  items.forEach((_, i) => {
    const slot = deep[i] || {};
    renderDeepFollow(i + 1, slot.followups, slot.notes);
  });
  if (moreBtn) moreBtn.hidden = state.deepExpanded || rest.length === 0;
}

function expandDeepThemes() {
  state.deepExpanded = true;
  const more = document.getElementById("deepMore");
  const btn = document.getElementById("btnDeepMore");
  if (more) more.hidden = false;
  if (btn) btn.hidden = true;
  persistJournalQuietly();
}

function setPromptsLoading(loading, scope = "all") {
  state.promptsBusy = loading;
  const deepLoader = document.getElementById("deepPromptLoading");
  const showDeep = loading && (scope === "all" || scope === "awareness" || scope === "deep");
  if (deepLoader) deepLoader.hidden = !showDeep;
}

function applyGeneratedPrompts(awareness, deep, execution, sig, fromAi) {
  const journal = collectJournal();
  if (!deepHasContent(journal.deep)) {
    state.deepPrompts = normalizeDeepPrompts(deep);
    renderDeepThemes(state.deepPrompts);
  }
  state.journalMeta.promptsSig = sig;
  state.journalMeta.promptsAi = Boolean(fromAi);
  persistJournalQuietly();
}

function applyGeneratedCorePrompts(awareness, execution, sig, fromAi) {
  const journal = collectJournal();
  const keepAnswers = corePromptsHaveAnswers(journal);
  const awareList = normalizeAwarenessPrompts(awareness);
  const execList = normalizeExecutionPrompts(execution);
  if (awareList.length >= AWARENESS_QUIZ_COUNT) {
    state.awarenessPrompts = awareList;
    renderAwarenessQuestions(state.awarenessPrompts, { answers: ["", "", ""] });
  }
  if (execList.length >= 3) {
    state.executionPrompts = execList;
    renderExecutionQuestions(state.executionPrompts, { answers: keepAnswers ? journal.execution : ["", "", ""] });
  }
  state.execQuestionTab = "open";
  state.journalMeta.corePromptsSig = sig;
  state.journalMeta.corePromptsAi = Boolean(fromAi) || Boolean(state.journalMeta.corePromptsAi);
  if (fromAi) state.corePromptsFailedSig = "";
  persistJournalQuietly();
  refreshJournalChecklists();
  syncCorePromptGate();
}

function setCorePromptsLoading(loading, scope = "core") {
  state.corePromptsBusy = loading;
  state.corePromptsBusyAt = loading ? Date.now() : 0;
  state.corePromptsScope = loading ? scope : "";
  const awareLoader = document.getElementById("awarePromptLoading");
  const execLoader = document.getElementById("execPromptLoading");
  const awareLabel = awareLoader?.querySelector(".check-loading__label");
  if (awareLabel) awareLabel.textContent = "正在生成覺察題…";
  if (awareLoader) awareLoader.hidden = !(loading && (scope === "core" || scope === "awareness"));
  if (execLoader) execLoader.hidden = !(loading && (scope === "core" || scope === "execution"));
  syncCorePromptGate();
}

function localCorePrompts(journal) {
  const eventBit = String(journal?.event || "").trim().slice(0, 12) || "今天這件事";
  const mood = journal?.mood || "這份心情";
  return {
    awareness: [
      { question: `在「${eventBit}」裡，我真正被碰到的，其實不是表面看到的那一層。` },
      { question: "我寫下的感謝，其實在說：我今天很想被好好對待。" },
      { question: `「${mood}」底下，還有一句我還沒敢對自己承認的話。` },
    ],
    execution: [
      { question: `若明天只改「${eventBit}」裡最小的一步，你會先動哪裡？`, placeholder: "明天最小的一步…" },
      { question: "今天卡住時，你最常用來保護自己的方式是什麼？", placeholder: "我習慣用的保護是…" },
      { question: "哪一個 5 分鐘內做得到的動作，能讓今天鬆一口氣？", placeholder: "5 分鐘內能做的是…" },
    ],
  };
}

async function generateCorePrompts(options = {}) {
  const scope =
    options.scope === "execution" ? "execution" : options.scope === "core" ? "core" : "awareness";
  if (recoverStaleBusy(state.corePromptsBusy, state.corePromptsBusyAt, () => setCorePromptsLoading(false))) {
    if (!options.auto) {
      showToast(scope === "execution" ? "還在為你準備執行題，請稍候。" : "還在生成覺察題，請稍候。");
    }
    return;
  }
  const journal = collectJournal();
  if (!coreStoryReady(journal)) {
    if (!options.auto) showToast("請先寫下今日感謝、事件，並選擇心情。");
    syncCorePromptGate();
    return;
  }
  const sig = corePromptsSignature(journal);
  const hasAware = normalizeAwarenessPrompts(state.awarenessPrompts).length >= AWARENESS_QUIZ_COUNT;
  const hasExec = normalizeExecutionPrompts(state.executionPrompts).length >= 3;
  if (!options.force) {
    if (scope === "awareness" && hasAware && awarenessQuizAnsweredCount(journal.awareness) > 0) return;
    if (scope === "execution" && hasExec && corePromptsHaveAnswers(journal)) return;
    if (scope === "core" && hasAware && hasExec && corePromptsHaveAnswers(journal)) return;
  }
  if (options.auto && !options.force && state.journalMeta.corePromptsAi && state.journalMeta.corePromptsSig === sig) {
    return;
  }
  if (options.auto && !options.force && state.corePromptsFailedSig === sig) return;

  const token = (state.corePromptsToken || 0) + 1;
  state.corePromptsToken = token;
  setCorePromptsLoading(true, scope);
  const watchdog = setTimeout(() => {
    if (state.corePromptsToken === token && state.corePromptsBusy) {
      setCorePromptsLoading(false);
      if (!options.auto) showToast("雲端回應太久，已先停下來。請再試一次。");
    }
  }, 32000);

  const fallback = localCorePrompts(journal);
  const mergePrompts = (remoteList, localList, normalize, min) => {
    const remote = normalize(remoteList);
    if (remote.length >= min) return remote;
    const next = remote.slice();
    normalize(localList).forEach((item) => {
      if (next.length >= min) return;
      if (!next.some((entry) => entry.question === item.question)) next.push(item);
    });
    return next.slice(0, min);
  };

  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const progress = collectGrowthProgress();
    const remote = await postReview(
      {
        mode: "prompts",
        variant: "core",
        scope,
        date: currentIso(),
        text: journal.event,
        context: {
          journalMode: state.journalMode,
          mode: state.journalMode,
          promptKind: scope,
          scope,
          thanks: thanksTextFrom(journal),
          thanksText: thanksTextFrom(journal),
          event: journal.event,
          mood: journal.mood,
          bodyTags: journal.bodyTags,
          bodyNote: journal.bodyNote,
          bodyCheck: journal.bodyCheck,
        },
        progress: {
          streak: progress.streak,
          avoidQuestions: (progress.avoidQuestions || []).slice(0, 8),
          openActions: progress.openActions || [],
        },
      },
      22000
    );
    if (state.corePromptsToken !== token) return;
    if (scope === "awareness") {
      const awareness = mergePrompts(remote.awareness, fallback.awareness, normalizeAwarenessPrompts, AWARENESS_QUIZ_COUNT);
      if (awareness.length < AWARENESS_QUIZ_COUNT) throw new Error("雲端回傳格式不完整");
      applyGeneratedCorePrompts(awareness, null, sig, true);
      if (!options.auto) showToast("今天的覺察題已經準備好了。");
      return;
    }
    if (scope === "execution") {
      const execution = mergePrompts(remote.execution, fallback.execution, normalizeExecutionPrompts, 3);
      if (execution.length < 3) throw new Error("雲端回傳格式不完整");
      applyGeneratedCorePrompts(null, execution, sig, true);
      if (!options.auto) showToast("今天的執行題已經準備好了。");
      return;
    }
    const awareness = mergePrompts(remote.awareness, fallback.awareness, normalizeAwarenessPrompts, AWARENESS_QUIZ_COUNT);
    const execution = mergePrompts(remote.execution, fallback.execution, normalizeExecutionPrompts, 3);
    if (awareness.length < AWARENESS_QUIZ_COUNT) throw new Error("雲端回傳格式不完整");
    applyGeneratedCorePrompts(awareness, execution, sig, true);
    if (!options.auto) showToast("今天的覺察題已經準備好了。");
  } catch (error) {
    if (state.corePromptsToken !== token) return;
    if (scope === "awareness") applyGeneratedCorePrompts(fallback.awareness, null, sig, true);
    else if (scope === "execution") applyGeneratedCorePrompts(null, fallback.execution, sig, true);
    else applyGeneratedCorePrompts(fallback.awareness, fallback.execution, sig, true);
    if (options.auto) state.corePromptsFailedSig = sig;
    if (!options.auto) {
      showToast(
        scope === "execution"
          ? `雲端執行題還沒好：${formatApiError(error)}，先用本地題目。`
          : `覺察題生成失敗：${formatApiError(error)}。已先放下 3 道本地覺察題，請再試一次。`
      );
    }
  } finally {
    clearTimeout(watchdog);
    if (state.corePromptsToken === token) setCorePromptsLoading(false);
  }
}

function maybeAutoGenerateCorePrompts(journal) {
  if (state.journalHydrating) return;
  syncCorePromptGate();
}

function persistJournalQuietly() {
  try {
    const { journal, rawText } = syncHiddenReviewText();
    const prev = getReview(currentIso()) || {};
    upsertReview(currentIso(), {
      rawText: rawText || prev.rawText || "",
      journal,
      organize: state.organize || prev.organize || null,
      gratitude: prev.gratitude || state.gratitude || "",
      selectedQuotes: state.selectedQuotes,
      selectedSfm: state.selectedSfm,
      thinkHistory: state.think.history,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* 出題後的安靜儲存失敗不擋畫面 */
  }
}

async function generateJournalPrompts(options = {}) {
  if (state.promptsBusy) return;
  const scope = options.scope || "all";
  const journal = collectJournal();
  if (!insightReady(journal)) {
    if (!options.auto) showToast("請先寫下今日事件、選擇心情，並標出身體狀況，才會生成今天的題目。");
    return;
  }
  if (options.force && deepHasContent(journal.deep)) {
    showToast("你已經開始作答深度思考了。想換題的話，先清空這幾題的回答。");
    return;
  }
  if (!options.force && deepHasContent(journal.deep) && state.deepPrompts.length === 4) {
    return;
  }
  const sig = promptsSignature(journal);
  if (options.auto && !options.force && state.journalMeta.promptsSig === sig && state.deepPrompts.length === 4) {
    return;
  }

  const token = (state.promptsToken || 0) + 1;
  state.promptsToken = token;
  setPromptsLoading(true, scope);

  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const insight = normalizeInsight(state.journalInsight);
    const remote = await postReview({
      mode: "prompts",
      date: currentIso(),
      text: journal.event,
      context: {
        thanks: thanksTextFrom(journal),
        thanksText: thanksTextFrom(journal),
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        insight: [insight.title, insight.conclusion].filter(Boolean).join("／"),
      },
      progress: collectGrowthProgress(),
    });
    if (state.promptsToken !== token) return;
    const deep = normalizeDeepPrompts(remote.deep);
    if (deep.length < 4) throw new Error("雲端回傳格式不完整");
    applyGeneratedPrompts([], deep, [], sig, true, scope);
    showToast("今天的深度思考主題已生成。");
  } catch (error) {
    if (state.promptsToken !== token) return;
    applyGeneratedPrompts([], localDeepPrompts(journal), [], sig, false, scope);
    showToast(`雲端出題失敗：${formatApiError(error)}，先用今天的本地題目。`);
  } finally {
    if (state.promptsToken === token) setPromptsLoading(false, scope);
  }
}

function maybeAutoGeneratePrompts(journal) {
  if (state.journalHydrating || state.journalMode === "quick") return;
  const data = journal || collectJournal();
  if (!insightReady(data)) return;
  if (state.deepPrompts.length === 4 && state.journalMeta.promptsSig === promptsSignature(data)) return;
  if (deepHasContent(data.deep) && state.deepPrompts.length === 4) return;
  generateJournalPrompts({ auto: true });
}

function currentDeepTheme(index) {
  return (state.deepPrompts[index - 1] || {}).title || "";
}

function collectDeepSlot(index) {
  const followups = [...document.querySelectorAll(`#deep${index}Follow [data-followup]`)].map((el) =>
    String(el.getAttribute("data-followup") || "").trim()
  );
  return {
    plain: journalFieldValue(`deep${index}plain`),
    deep: journalFieldValue(`deep${index}deep`),
    followups,
    notes: [1, 2, 3, 4].map((n) => journalFieldValue(`deep${index}note${n}`)),
  };
}

function renderDeepFollow(index, questions, notes) {
  const root = document.getElementById(`deep${index}Follow`);
  if (!root) return;
  const items = (questions || []).map((q) => String(q || "").trim()).filter(Boolean).slice(0, 4);
  if (!items.length) {
    root.innerHTML = "";
    return;
  }
  const saved = notes || [];
  root.innerHTML = `
    <p class="deep-follow__head">深度追問</p>
    ${items
      .map(
        (question, i) => `
          <article class="deep-probe">
            <p class="deep-probe__q" data-followup="${escapeHtml(question)}">${i + 1}. ${escapeHtml(question)}</p>
            <textarea class="textarea" id="deep${index}note${i + 1}" rows="3" placeholder="寫下對這一題的想法…">${escapeHtml(saved[i] || "")}</textarea>
          </article>
        `
      )
      .join("")}
  `;
}

function setDeepFollowLoading(index, loading) {
  const btn = document.querySelector(`[data-deepen="${index}"]`);
  const loader = document.getElementById(`deep${index}Loading`);
  state.deepFollowBusy[index - 1] = loading;
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "分析中…" : "帶我再深入思考";
  }
  if (loader) loader.hidden = !loading;
}

function localDeepFollowFallback(index, slot) {
  const text = `${slot.plain || ""} ${slot.deep || ""}`.replace(/\s+/g, " ").trim();
  const snippet = text ? (text.length > 12 ? `${text.slice(0, 12)}…` : text) : currentDeepTheme(index) || "這件事";
  return [
    `在「${snippet}」裡，你最不想被看穿的是哪一句？`,
    "如果把防衛拿掉十秒，你其實想說什麼？",
    "明天只要改一個最小的動作，會從哪一步開始？",
  ];
}

async function generateDeepFollow(index) {
  const slotIndex = Number(index);
  if (slotIndex < 1 || slotIndex > 4 || state.deepFollowBusy[slotIndex - 1]) return;
  const slot = collectDeepSlot(slotIndex);
  if (!String(slot.plain || "").trim() && !String(slot.deep || "").trim()) {
    showToast("先在這個主題寫下一點，再往下挖。");
    return;
  }
  const details = document.querySelector(`#deep${slotIndex}plain`)?.closest("details");
  if (details) details.open = true;

  const token = (state.deepFollowToken[slotIndex - 1] || 0) + 1;
  state.deepFollowToken[slotIndex - 1] = token;
  setDeepFollowLoading(slotIndex, true);

  const journal = collectJournal();
  const fallback = localDeepFollowFallback(slotIndex, slot);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postReview({
      mode: "deepen",
      date: currentIso(),
      theme: currentDeepTheme(slotIndex) || "今天的深度思考",
      plain: slot.plain,
      deep: slot.deep,
      text: `${slot.plain}\n${slot.deep}`.trim(),
      context: {
        event: journal.event,
        mood: journal.mood,
        theme: currentDeepTheme(slotIndex),
      },
    });
    if (state.deepFollowToken[slotIndex - 1] !== token) return;
    const questions = (remote.questions || []).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4);
    if (questions.length < 3) throw new Error("雲端回傳格式不完整");
    renderDeepFollow(slotIndex, questions, slot.notes);
    showToast("已生出 3 個更深的追問。");
  } catch (error) {
    if (state.deepFollowToken[slotIndex - 1] !== token) return;
    renderDeepFollow(slotIndex, fallback, slot.notes);
    showToast(`雲端分析失敗：${formatApiError(error)}，先用本地追問。`);
  } finally {
    if (state.deepFollowToken[slotIndex - 1] === token) setDeepFollowLoading(slotIndex, false);
  }
}

function inferJournalMode(data) {
  if (data?.mode === "quick" || data?.mode === "deep") return data.mode;
  const deepBits = [...(data?.awareness || []).slice(1), ...(data?.execution || []), data?.manifest];
  if (deepBits.some((item) => String(item || "").trim())) return "deep";
  if (deepHasContent(data?.deep)) return "deep";
  if ((data?.awarenessChecks || []).length || (data?.executionChecks || []).length || (data?.manifestChecks || []).length) {
    return "deep";
  }
  return state.journalMode === "quick" ? "quick" : "deep";
}

function setModeGuideOpen(open) {
  const root = document.querySelector(".mode-guide");
  const toggle = document.getElementById("modeGuideToggle");
  const panel = document.getElementById("modeGuidePanel");
  if (!root) return;
  const next = Boolean(open);
  root.classList.toggle("is-open", next);
  if (toggle) toggle.setAttribute("aria-expanded", next ? "true" : "false");
  if (panel) {
    panel.inert = !next;
    panel.setAttribute("aria-hidden", next ? "false" : "true");
  }
  root.querySelectorAll(".mode-guide__card").forEach((btn) => {
    btn.tabIndex = next ? 0 : -1;
  });
}

function toggleModeGuide() {
  const root = document.querySelector(".mode-guide");
  if (!root) return;
  setModeGuideOpen(!root.classList.contains("is-open"));
}

function applyJournalMode(mode, options = {}) {
  const next = mode === "quick" ? "quick" : "deep";
  state.journalMode = next;
  document.body.dataset.journalMode = next;
  document.querySelectorAll("[data-journal-mode]").forEach((btn) => {
    const on = btn.dataset.journalMode === next;
    btn.classList.toggle("is-on", on);
    if (btn.classList.contains("journal-mode__btn")) btn.setAttribute("aria-selected", on ? "true" : "false");
    if (btn.classList.contains("mode-guide__card")) btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  try {
    localStorage.setItem(STORAGE_KEYS.journalMode, next);
  } catch {
    /* 偏好寫入失敗不擋畫面 */
  }
  syncCompleteButtonLabel();
  syncQuickModules(state.quickModules);
  if (!state.journalHydrating) applyJournalFolds();
  if (!options.silent && !state.journalHydrating) persistJournalQuietly();
  renderInsightCard(state.journalInsight);
  if (!options.silent && !state.journalHydrating && next === "deep") {
    maybeAutoGenerateCorePrompts(collectJournal());
  }
}

function collectExecCheckItems() {
  return [...document.querySelectorAll("#execChecks .exec-check")]
    .map((el) => ({
      title: String(el.dataset.title || "").trim(),
      detail: flattenExecSentence(String(el.dataset.detail || "").trim()),
    }))
    .filter((item) => item.title);
}

function normalizeExecCheckItem(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const parts = splitTaskText(item);
    const detail = flattenExecSentence(parts.detail);
    return parts.title ? { title: parts.title, detail } : null;
  }
  if (typeof item !== "object") return null;
  const title = String(item.title || item.label || item.text || "").trim();
  const detail = flattenExecSentence(item.detail || item.lead || item.note || "", item);
  if (!title && !detail) return null;
  if (!title) return splitTaskText(detail);
  if (detail && detail !== title) return { title, detail };
  const parts = splitTaskText(title);
  return { title: parts.title, detail: flattenExecSentence(parts.detail || detail) };
}

function normalizeExecCheckItems(list) {
  const items = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const next = normalizeExecCheckItem(item);
    if (!next || seen.has(next.title)) return;
    seen.add(next.title);
    items.push(next);
  });
  return items;
}

function pushUniqueExec(list, title, detail, max) {
  const heading = String(title || "").trim();
  if (!heading || list.some((item) => item.title === heading) || list.length >= max) return list;
  list.push({ title: heading, detail: flattenExecSentence(detail) });
  return list;
}

function formatExecCheckLine(item) {
  const next = normalizeExecCheckItem(item);
  if (!next) return "";
  return next.detail ? `${next.title}：${next.detail}` : next.title;
}

function execCheckHistoryLines(journal) {
  const items = normalizeExecCheckItems(journal && journal.executionCheckItems);
  if (items.length) return items.map(formatExecCheckLine).filter(Boolean);
  return (journal && journal.executionChecks ? journal.executionChecks : [])
    .map(formatExecCheckLine)
    .filter(Boolean);
}

function collectJournal() {
  const bodyCheck = collectBodyCheck();
  const journal = {
    thanks: collectThanksText(),
    thanksText: collectThanksText(),
    event: journalFieldValue("eventText"),
    mood: document.querySelector("#moodRow .mood-btn.is-on")?.dataset.mood || "",
    bodyCheck,
    bodyTags: deriveBodyTags(bodyCheck),
    bodyNote: deriveBodyNote(bodyCheck),
    bodyCoach: state.journalBodyCoach || emptyBodyCoach(),
    awareness: collectAwarenessQuizAnswers(),
    awarenessChecks: checkedValues("awareChecks"),
    awarenessCheckItems: (() => {
      const quotes = collectAwareQuotes();
      return quotes.length ? quotes : normalizeAwarenessQuotes(checklistItems("awareChecks"));
    })(),
    execution: collectExecutionAnswers(),
    executionChecks: checkedValues("execChecks"),
    executionCheckItems: (() => {
      const collected = collectExecCheckItems();
      return collected.length ? collected : normalizeExecCheckItems(checklistItems("execChecks"));
    })(),
    smallestStep: journalFieldValue("execNext"),
    mode: state.journalMode === "quick" ? "quick" : "deep",
    deepExpanded: Boolean(state.deepExpanded),
    awarenessAi: Boolean(state.journalMeta.awarenessAi),
    executionAi: Boolean(state.journalMeta.executionAi),
    awarenessAiSig: state.journalMeta.awarenessAiSig || "",
    executionAiSig: state.journalMeta.executionAiSig || "",
    awarenessQuoteGenCount: awarenessQuoteGenCount(),
    manifest: journalFieldValue("manifestVision"),
    manifestChecks: checkedValues("manifestChecks"),
    manifestCheckItems: checklistItems("manifestChecks"),
    manifestAi: Boolean(state.journalMeta.manifestAi),
    manifestAiSig: state.journalMeta.manifestAiSig || "",
    insight: state.journalInsight || emptyInsight(),
    deep: [1, 2, 3, 4].map(collectDeepSlot),
    awarenessPrompts: state.awarenessPrompts || [],
    executionPrompts: normalizeExecutionPrompts(state.executionPrompts),
    executionQuestionTab: normalizeExecQuestionTab(state.execQuestionTab),
    deepPrompts: state.deepPrompts || [],
    promptsSig: state.journalMeta.promptsSig || "",
    promptsAi: Boolean(state.journalMeta.promptsAi),
    corePromptsSig: state.journalMeta.corePromptsSig || "",
    corePromptsAi: Boolean(state.journalMeta.corePromptsAi),
    quickModules: normalizeQuickModules(state.quickModules),
  };
  return journal;
}

function composeJournalRawText(journal) {
  const lines = [];
  const thanksText = String(journal.thanksText || "").trim() || thanksItemsFrom(journal.thanks).join("\n");
  if (thanksText) {
    lines.push("今日感謝");
    lines.push(thanksText);
  }
  if (String(journal.event || "").trim()) lines.push(`今日事件：${journal.event.trim()}`);
  if (journal.mood) lines.push(`心情：${journal.mood}`);
  const check = normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote);
  if (check.mood.flags.length) lines.push(`今日心情檢核：${check.mood.flags.join("、")}`);
  if (check.mood.reason) lines.push(`心情原因：${check.mood.reason}`);
  if (check.body.flags.length) lines.push(`今日身體檢核：${check.body.flags.join("、")}`);
  if (check.body.other) lines.push(`其他身體感受：${check.body.other}`);
  if (check.body.reason) lines.push(`身體原因：${check.body.reason}`);
  if (check.sleep.duration) lines.push(`睡眠時間：${check.sleep.duration}`);
  if (check.sleep.quality) lines.push(`睡眠品質：${check.sleep.quality}`);
  if (check.sleep.energy) lines.push(`起床精神：${check.sleep.energy}`);
  if (check.sleep.flags.length) lines.push(`昨日睡眠檢核：${check.sleep.flags.join("、")}`);
  if (check.sleep.reason) lines.push(`睡眠說明：${check.sleep.reason}`);
  const bodyCoach = normalizeBodyCoach(journal.bodyCoach);
  if (bodyCoach.analysis) {
    lines.push("今日身心小結");
    lines.push(bodyCoach.analysis);
    bodyCoach.suggestions.forEach((item, index) => lines.push(`建議 ${index + 1}：${item}`));
  }
  const insight = normalizeInsight(journal.insight);
  if (
    insight.guide?.rounds?.length ||
    insight.guide?.summary ||
    insight.psychology ||
    insight.conclusion ||
    insight.reflection ||
    insight.suggestions.length ||
    insight.takeaways.length
  ) {
    lines.push("深度思考");
    (insight.guide?.rounds || []).forEach((item, index) => {
      lines.push(`第 ${index + 1} 輪：${item.question}`);
      if (item.answer) lines.push(item.answer);
    });
    if (insight.guide?.title || insight.title) lines.push(insight.guide?.title || insight.title);
    if (insight.guide?.summary) lines.push(insight.guide.summary);
    (insight.guide?.actions || []).forEach((item, index) => lines.push(`下一步 ${index + 1}：${item}`));
    if (!insight.guide?.summary && (insight.psychology || insight.conclusion)) {
      lines.push("① 今天的身心訊號");
      lines.push(insight.psychology || insight.conclusion);
    }
    if (insight.bodyLink) lines.push(insight.bodyLink);
    if (insight.reflection) {
      lines.push("② 客觀檢討與反思");
      lines.push(insight.reflection);
    }
    if (insight.suggestions.length && !(insight.guide?.actions || []).length) {
      lines.push("③ 具體突破建議（怎麼做會更好）");
      insight.suggestions.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    }
    if (insight.takeaways.length && !insight.guide?.summary) {
      lines.push("④ 今日核心重點整理");
      insight.takeaways.forEach((item) => lines.push(`- ${item}`));
    }
  }
  const awareQs = (journal.awarenessPrompts || state.awarenessPrompts || AWARENESS_QUESTIONS).map(
    (item) => item.question || item.title || item
  );
  awareQs.forEach((question, index) => {
    const answer = normalizeYesNo((journal.awareness || [])[index]) || String((journal.awareness || [])[index] || "").trim();
    if (answer) lines.push(`${question} ${answer}`);
  });
  const awareQuotes = normalizeAwarenessQuotes(journal.awarenessCheckItems);
  awareQuotes.forEach((quote, index) => lines.push(`核心覺察 ${index + 1}：${quote}`));
  const execPrompts = normalizeExecutionPrompts(journal.executionPrompts || state.executionPrompts);
  const execAnswers = Array.isArray(journal.execution) ? journal.execution : [];
  const execCount = Math.max(execPrompts.length, execAnswers.length);
  for (let index = 0; index < execCount; index += 1) {
    const prompt = execPrompts[index];
    const answer = String(execAnswers[index] || "").trim();
    const question = prompt?.question || `執行力 ${index + 1}`;
    if (answer) lines.push(`${question} ${answer}`);
    else if (prompt?.parked) lines.push(`${question} 先放著`);
  }
  if (String(journal.smallestStep || "").trim()) lines.push(`明天最小的一步：${String(journal.smallestStep).trim()}`);
  const execLines = execCheckHistoryLines(journal);
  if (execLines.length) lines.push(`我的行動卡點：${execLines.join("、")}`);
  if (String(journal.manifest || "").trim()) lines.push(`明天想顯化：${journal.manifest.trim()}`);
  if ((journal.manifestChecks || []).length) lines.push(`顯化執行目標：${journal.manifestChecks.join("、")}`);
  const deepQs = (journal.deepPrompts || state.deepPrompts || []).map((item) => item.title || item.question || item);
  normalizeDeep(journal.deep).forEach((item, index) => {
    const plain = String(item.plain || "").trim();
    const deep = String(item.deep || "").trim();
    if (!plain && !deep && !(item.followups || []).length) return;
    lines.push(deepQs[index] || `深度思考 ${index + 1}`);
    if (plain) lines.push(`白話想一想：${plain}`);
    if (deep) lines.push(`深挖一點點：${deep}`);
    (item.followups || []).forEach((question, qIndex) => {
      if (!String(question || "").trim()) return;
      lines.push(`延伸追問 ${qIndex + 1}：${question}`);
      const note = String((item.notes || [])[qIndex] || "").trim();
      if (note) lines.push(`延伸反思：${note}`);
    });
  });
  return lines.join("\n");
}

function syncHiddenReviewText() {
  const journal = collectJournal();
  const composed = composeJournalRawText(journal);
  const textarea = document.getElementById("reviewText");
  const existing = String(textarea?.value || "").trim();
  const rawText = journalHasContent(journal) ? composed : composed || existing;
  if (textarea && (composed || !existing)) textarea.value = rawText;
  return { journal, rawText };
}

function setActiveButtons(rootId, selector, values) {
  const set = new Set(values || []);
  document.querySelectorAll(`#${rootId} ${selector}`).forEach((btn) => {
    const key = btn.dataset.mood || btn.dataset.bodyTag;
    btn.classList.toggle("is-on", set.has(key));
  });
}

function setCheckedValues(rootId, values) {
  const set = new Set(values || []);
  document.querySelectorAll(`#${rootId} input[type="checkbox"]`).forEach((input) => {
    input.checked = set.has(input.value);
  });
}

const JOURNAL_FOLD_IDS = [
  "section-thanks",
  "section-event",
  "quickModules",
  "section-body",
  "section-insight",
  "section-aware",
  "section-exec",
  "section-deep",
  "section-manifest",
  "section-quick-insight",
];

function journalFoldIsActive(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return false;
  const quick = state.journalMode === "quick";
  if (id === "quickModules" || id === "section-quick-insight") return quick;
  if (!quick) return id !== "quickModules" && id !== "section-quick-insight";
  if (id === "section-insight" || id === "section-deep") return false;
  if (id === "section-body") return Boolean(state.quickModules?.body);
  if (id === "section-aware") return Boolean(state.quickModules?.aware);
  if (id === "section-exec") return Boolean(state.quickModules?.exec);
  if (id === "section-manifest") return Boolean(state.quickModules?.manifest);
  return true;
}

function journalFoldPrefs() {
  const saved = loadJson(STORAGE_KEYS.journalFolds, null);
  if (saved == null) return { open: "section-thanks" };
  if (typeof saved === "string") return { open: saved };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { open: "section-thanks" };
  if (typeof saved.open === "string") return { open: saved.open };
  const open = JOURNAL_FOLD_IDS.find((id) => saved[id] === true) || "";
  return { open };
}

function persistJournalFoldOpen(openId) {
  try {
    localStorage.setItem(STORAGE_KEYS.journalFolds, JSON.stringify({ open: openId || "" }));
  } catch {
    /* ignore quota */
  }
}

function journalScroller(el) {
  const view = document.getElementById("view");
  if (view && (!el || view.contains(el))) return view;
  return document.scrollingElement || document.documentElement;
}

let foldAnchorFrame = 0;

function stopFoldAnchor() {
  if (foldAnchorFrame) cancelAnimationFrame(foldAnchorFrame);
  foldAnchorFrame = 0;
}

function pinFoldWhileAnimating(root, mutate) {
  if (!root) {
    mutate();
    return;
  }
  const scroller = journalScroller(root);
  const anchor = root.querySelector(":scope > [data-journal-fold]") || root;
  const startTop = anchor.getBoundingClientRect().top;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  stopFoldAnchor();
  mutate();
  const sync = () => {
    const delta = anchor.getBoundingClientRect().top - startTop;
    if (!scroller || Math.abs(delta) < 0.5) return;
    scroller.scrollTop += delta;
  };
  sync();
  if (reduceMotion) return;
  const doneAt = performance.now() + 420;
  const tick = (now) => {
    sync();
    if (now < doneAt) foldAnchorFrame = requestAnimationFrame(tick);
    else foldAnchorFrame = 0;
  };
  foldAnchorFrame = requestAnimationFrame(tick);
}

function applyFoldState(id, open) {
  const root = document.getElementById(id);
  if (!root?.classList.contains("journal-fold")) return;
  const toggle = root.querySelector(":scope > [data-journal-fold]");
  const panel = root.querySelector(":scope > .journal-fold__panel");
  const next = Boolean(open);
  root.classList.toggle("is-open", next);
  if (toggle) toggle.setAttribute("aria-expanded", next ? "true" : "false");
  if (panel) {
    panel.inert = !next;
    panel.setAttribute("aria-hidden", next ? "false" : "true");
  }
}

function currentOpenJournalFold() {
  return JOURNAL_FOLD_IDS.find((id) => document.getElementById(id)?.classList.contains("is-open")) || "";
}

function setJournalFoldOpen(id, open, options = {}) {
  const root = document.getElementById(id);
  if (!root?.classList.contains("journal-fold")) return;
  const next = Boolean(open);
  const run = () => {
    if (next && options.exclusive !== false) {
      JOURNAL_FOLD_IDS.forEach((other) => {
        if (other !== id) applyFoldState(other, false);
      });
    }
    applyFoldState(id, next);
    if (options.persist !== false) persistJournalFoldOpen(next ? id : currentOpenJournalFold());
  };
  if (options.pin === false) run();
  else pinFoldWhileAnimating(root, run);
}

function toggleJournalFold(id) {
  const root = document.getElementById(id);
  if (!root) return;
  setJournalFoldOpen(id, !root.classList.contains("is-open"));
}

function applyJournalFolds() {
  const prefs = journalFoldPrefs();
  const visible = JOURNAL_FOLD_IDS.filter(journalFoldIsActive);
  const openId = visible.includes(prefs.open) ? prefs.open : "";
  JOURNAL_FOLD_IDS.forEach((id) => applyFoldState(id, id === openId));
}

function fillJournal(journal) {
  const data = { ...emptyJournal(), ...(journal && typeof journal === "object" ? journal : {}) };
  state.journalHydrating = true;
  state.checklistToken.awareness += 1;
  state.checklistToken.execution += 1;
  state.checklistToken.manifest += 1;
  state.insightToken += 1;
  state.bodyCoachToken += 1;
  state.promptsToken += 1;
  state.deepFollowToken = state.deepFollowToken.map((n) => n + 1);
  setChecklistLoading("awareness", false);
  setChecklistLoading("execution", false);
  setChecklistLoading("manifest", false);
  setInsightLoading(false);
  setBodyCoachLoading(false);
  setPromptsLoading(false);
  setCorePromptsLoading(false);
  state.corePromptsToken += 1;
  state.corePromptsFailedSig = "";
  [1, 2, 3, 4].forEach((index) => setDeepFollowLoading(index, false));
  state.journalMeta = {
    awarenessAi: Boolean(data.awarenessAi),
    executionAi: Boolean(data.executionAi),
    awarenessAiSig: data.awarenessAiSig || "",
    executionAiSig: data.executionAiSig || "",
    awarenessQuoteGenCount: normalizeAwarenessQuoteGenCount(
      data.awarenessQuoteGenCount,
      Boolean((data.awarenessCheckItems || []).length)
    ),
    manifestAi: Boolean(data.manifestAi),
    manifestAiSig: data.manifestAiSig || "",
    insightSig: data.insight?.sig || "",
    bodyCoachSig: data.bodyCoach?.sig || "",
    promptsSig: data.promptsSig || "",
    promptsAi: Boolean(data.promptsAi),
    corePromptsSig: data.corePromptsSig || "",
    corePromptsAi: Boolean(data.corePromptsAi),
  };
  state.journalInsight = normalizeInsight(data.insight);
  state.journalBodyCoach = normalizeBodyCoach(data.bodyCoach);
  state.awarenessPrompts = hydrateAwarenessPrompts(data);
  state.executionPrompts = hydrateExecutionPrompts(data);
  state.execQuestionTab = normalizeExecQuestionTab(data.executionQuestionTab);
  state.deepPrompts = normalizeDeepPrompts(data.deepPrompts);
  state.deepExpanded = Boolean(data.deepExpanded) || normalizeDeep(data.deep).slice(1).some(deepSlotHasContent);
  state.quickModules = normalizeQuickModules(data.quickModules);
  applyJournalMode(inferJournalMode(data), { silent: true });
  const hasPromptAnswers =
    (data.awareness || []).some((item) => String(item || "").trim()) || deepHasContent(data.deep);
  if (!state.deepPrompts.length && hasPromptAnswers) state.deepPrompts = LEGACY_DEEP_PROMPTS;
  renderThanksFields(data);
  const eventText = document.getElementById("eventText");
  if (eventText) eventText.value = data.event || "";
  setActiveButtons("moodRow", ".mood-btn", data.mood ? [data.mood] : []);
  fillBodyCheck(normalizeBodyCheck(data.bodyCheck, data.bodyTags, data.bodyNote));
  const manifestVision = document.getElementById("manifestVision");
  if (manifestVision) manifestVision.value = data.manifest || "";
  renderAwarenessQuestions(state.awarenessPrompts, { answers: data.awareness });
  renderExecutionQuestions(state.executionPrompts, { answers: data.execution });
  const execNext = document.getElementById("execNext");
  if (execNext) execNext.value = data.smallestStep || "";
  renderDeepThemes(state.deepPrompts, { deep: normalizeDeep(data.deep) });
  refreshJournalChecklists(data, { useSaved: true });
  renderInsightCard(state.journalInsight);
  renderBodyCoachCard(state.journalBodyCoach);
  syncCorePromptGate();
  state.journalHydrating = false;
  applyJournalFolds();
}

function updateJournalDateLabel(iso) {
  const label = document.getElementById("journalDateLabel");
  const date = parseIsoDate(iso) || new Date();
  if (label) label.textContent = formatHeaderDate(date);
}

function saveJournalDraft() {
  const { journal, rawText } = syncHiddenReviewText();
  if (!rawText && !journalHasContent(journal) && !state.organize) {
    showToast("還沒有內容可以儲存。");
    return;
  }
  const prev = getReview(currentIso()) || {};
  upsertReview(currentIso(), {
    rawText,
    journal,
    organize: state.organize || prev.organize || null,
    gratitude: document.getElementById("gratitudeInput")?.value.trim() || state.gratitude,
    selectedQuotes: state.selectedQuotes,
    selectedSfm: state.selectedSfm,
    thinkHistory: state.think.history,
    updatedAt: new Date().toISOString(),
  });
  updateStats();
  syncReviewsToCloud();
  showToast("草稿已儲存。");
}

function resetAiSession() {
  state.organize = null;
  state.rawText = "";
  state.think = { round: 0, max: 5, history: [], current: null };
  state.thinkToken = (state.thinkToken || 0) + 1;
  state.selectedQuotes = [];
  state.selectedSfm = [];
  state.selectedThinkActions = [];
  state.selectedPractice = [];
  state.gratitude = "";
}

function loadReviewForDate(iso) {
  const review = getReview(iso);
  updateJournalDateLabel(iso);
  fillJournal(review?.journal);
  const textarea = document.getElementById("reviewText");
  if (textarea) textarea.value = review?.rawText || composeJournalRawText(review?.journal || emptyJournal());
  resetAiSession();
  if (review?.organize) {
    state.organize = review.organize;
    state.rawText = review.rawText || "";
    state.gratitude = review.gratitude || "";
    state.selectedQuotes = [...(review.selectedQuotes || [])];
    state.selectedSfm = [...(review.selectedSfm || [])];
    if (Array.isArray(review.thinkHistory) && review.thinkHistory.length) {
      state.think.history = review.thinkHistory;
      state.think.round = review.thinkHistory.length;
      state.think.current = review.thinkHistory[review.thinkHistory.length - 1];
    }
  }
  renderAiStage();
  maybeAutoGenerateInsight(review?.journal || collectJournal());
  maybeAutoGeneratePrompts(review?.journal || collectJournal());
  maybeAutoGenerateCorePrompts(review?.journal || collectJournal());
}

function renderConclusionCallout(text) {
  const line = String(text || "").trim();
  if (!line) return "";
  return `
    <aside class="conclusion-callout">
      <p class="conclusion-callout__label">核心結論</p>
      <p class="conclusion-callout__text">${escapeHtml(line)}</p>
    </aside>
  `;
}

function thinkPointConclusions(round) {
  const points = Array.isArray(round?.points)
    ? round.points
        .map((item) => ({
          title: String(item?.title || "").trim(),
          conclusion: String(item?.conclusion || "").trim(),
        }))
        .filter((item) => item.conclusion)
    : [];
  if (points.length) return points;
  const one = String(round?.conclusion || "").trim();
  if (one) return [{ title: "", conclusion: one }];
  const insight = String(round?.insight || "").trim();
  if (!insight) return [];
  const first = insight.split(/[。！？]/).map((item) => item.trim()).filter(Boolean)[0];
  return first ? [{ title: "", conclusion: /[。！？]$/.test(first) ? first : `${first}。` }] : [];
}

function defaultThinkPrompt(organize) {
  return String(organize?.thinkGuide || organize?.themeTitle || "今天這段復盤，真正卡住的是哪一句？").trim();
}

function thinkPromptText(round, index, history) {
  if (round?.prompt) return String(round.prompt).trim();
  if (index > 0) {
    const prev = history[index - 1] || {};
    return String(prev.reply || prev.question || "").trim();
  }
  return String(round?.question || defaultThinkPrompt(state.organize)).trim();
}

const THINK_CHAPTER = ["一", "二", "三", "四", "五"];
const THINK_THEME_FALLBACK = [
  "先聽見那句為什麼",
  "順序反了，心意就聽不見",
  "先對自己說實話",
  "收到明天做得到的一步",
  "先看見，才能改變",
];

function thinkThemeTitle(round, index) {
  const raw = String(round?.title || "").trim();
  const generic = /^(深度思考|下一步引導|下一步引導 \/ 深度思考|再往前深一層)$/;
  const theme = raw && !generic.test(raw) ? raw.replace(/^[一二三四五六七八九十]+、\s*/, "") : THINK_THEME_FALLBACK[index] || "再往前深一層";
  const chapter = THINK_CHAPTER[index] || String(index + 1);
  return `${chapter}、${theme}`;
}

function thinkStarsOf(round) {
  const n = Number(round?.stars ?? round?.themeStars);
  return n >= 1 && n <= 5 ? n : 4;
}

function thinkObservationText(round, index, history, rawText) {
  if (index === 0) {
    const diary = String(rawText || state.rawText || "").trim();
    if (diary) return diary;
  }
  const reply = String(round?.reply || "").trim();
  if (reply) return reply;
  const prompt = thinkPromptText(round, index, history);
  if (prompt) return prompt;
  return String(round?.insight || "").trim() || "這一輪還沒有留下觀察紀錄。";
}

function renderThoughtUnit(round, index, total, options = {}) {
  const history = options.history || state.think.history || [];
  const rawText = options.rawText || state.rawText || "";
  const points = thinkPointConclusions(round);
  const conclusionHtml = points.length
    ? points.map((item) => renderConclusionCallout(item.conclusion)).join("")
    : renderConclusionCallout("這一層還在成形，先把問題看清楚。");
  const current = Boolean(options.current);
  return `
    <article class="thought-unit ${current ? "thought-unit--current" : "thought-unit--past"}">
      <header class="thought-unit__head">
        <h3 class="thought-unit__title">${escapeHtml(thinkThemeTitle(round, index))}</h3>
        <span class="stars thought-unit__stars">[${starsText(thinkStarsOf(round))}]</span>
      </header>
      <div class="thought-unit__body">
        <p class="thought-unit__label">觀察紀錄</p>
        <p class="thought-unit__note">${escapeHtml(thinkObservationText(round, index, history, rawText))}</p>
      </div>
      <div class="thought-unit__conclusion">
        ${conclusionHtml}
      </div>
    </article>
  `;
}

function renderReviewCard({ title, body, variant = "", wide = false }) {
  if (!String(body || "").trim()) return "";
  const extras = [variant ? `rv-card--${variant}` : "", wide ? "rv-card--wide" : ""].filter(Boolean).join(" ");
  return `
    <article class="rv-card ${extras}">
      <header class="rv-card__head">
        <h3 class="rv-card__title">${escapeHtml(title)}</h3>
      </header>
      <div class="rv-card__body">${body}</div>
    </article>
  `;
}

function renderSub(title, body) {
  if (!String(body || "").trim()) return "";
  return `<section class="rv-sub"><h4 class="rv-sub__title">${escapeHtml(title)}</h4><div class="rv-sub__body">${body}</div></section>`;
}

function renderAssumptionGap(ai) {
  const gap = ai?.assumptionGap || {};
  const mine = String(gap.mine || "").trim();
  const theirs = String(gap.theirs || "").trim();
  const line = String(gap.line || "").trim();
  if (!mine && !theirs && !line) return "";
  return renderSub(
    "我以為是……，他以為是……",
    `
      ${line ? `<p class="gap-card__line">${escapeHtml(line)}</p>` : ""}
      <div class="gap-split">
        ${mine ? `<div class="gap-split__col"><p class="gap-split__label">我以為是</p><p>${escapeHtml(mine)}</p></div>` : ""}
        ${theirs ? `<div class="gap-split__col"><p class="gap-split__label">他以為是</p><p>${escapeHtml(theirs)}</p></div>` : ""}
      </div>
    `
  );
}

function renderPracticeChecks(scripts, howNext) {
  const items = [];
  if (howNext) items.push({ key: "practice:how", label: "實戰修正", detail: howNext });
  (Array.isArray(scripts) ? scripts : []).forEach((script, index) => {
    const detail = String(script || "").trim();
    if (!detail) return;
    items.push({ key: `practice:script:${index}`, label: `對話練習 ${index + 1}`, detail });
  });
  if (!items.length) return "";
  const rows = items
    .map((item) => {
      const checked = state.selectedPractice.includes(item.key) || Boolean(findTaskBySourceKey(item.key)) ? "checked" : "";
      return `<label class="check-row check-row--practice"><input type="checkbox" data-practice="${escapeHtml(item.key)}" data-label="${escapeHtml(item.label)}" data-detail="${escapeHtml(item.detail)}" ${checked} /><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span></label>`;
    })
    .join("");
  return renderReviewCard({
    title: "下一步引導 / 練習建議",
    wide: true,
    body: `
      <p class="sfm-hint">勾選表示這句你願意去說，或已經練習過。打勾是給自己的完成感，不是給別人看成績。</p>
      <div class="check-list">${rows}</div>
    `,
  });
}

function renderBulletList(items, fallbackText) {
  const list = (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!list.length && fallbackText) {
    return `<p>${escapeHtml(fallbackText)}</p>`;
  }
  if (!list.length) return `<p>今天的這一段，還可以再拆得更清楚一點。</p>`;
  return `<ul class="review-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderAiStage() {
  const root = document.getElementById("aiStage");
  if (!root) return;
  purgeThinkingUi();

  if (!state.organize) {
    root.innerHTML = "";
    return;
  }

  const ai = state.organize;
  const quotes = Array.isArray(ai.quotes) ? ai.quotes : [];
  const sfm = Array.isArray(ai.sfm) ? ai.sfm : [];
  const gratitudeList = Array.isArray(ai.gratitudeList) ? ai.gratitudeList : [];
  const mindsetList = Array.isArray(ai.mindsetList) ? ai.mindsetList : [];
  const think = state.think.current;
  const rawText = state.rawText || document.getElementById("reviewText")?.value.trim() || "";

  const quoteChecks = quotes
    .map((quote, index) => {
      const key = `quote:${index}`;
      const checked = state.selectedQuotes.includes(key) ? "checked" : "";
      return `<label class="quote-item"><input type="checkbox" data-quote="${key}" ${checked} /><span>${escapeHtml(quote)}</span></label>`;
    })
    .join("");

  const quoteCards = quotes
    .map(
      (quote, index) => `
        <div class="gold-quote-row">
          <p class="gold-quote">${escapeHtml(quote)}</p>
          <button class="btn btn--ghost btn--tiny" type="button" data-copy-quote="${index}">複製金句</button>
        </div>`
    )
    .join("");

  const sfmChecks = sfm
    .map((item, index) => {
      const key = `sfm:${index}`;
      const checked = state.selectedSfm.includes(key) ? "checked" : "";
      return `<label class="quote-item"><input type="checkbox" data-sfm="${key}" ${checked} /><span><strong>${escapeHtml(SFM_TYPE_LABEL[item.type] || item.type)}</strong>　${escapeHtml(item.body || item.title || "")}</span></label>`;
    })
    .join("");

  const history = Array.isArray(state.think.history) ? state.think.history : [];
  const timelineHtml = history
    .map((round, index) =>
      renderThoughtUnit(round, index, state.think.max, {
        history,
        rawText,
        current: Boolean(think) && index === history.length - 1,
      })
    )
    .join("");

  const thinkActions = (think?.actions || [])
    .map((item, index) => {
      const key = `think:${state.think.round}:${index}`;
      const checked = state.selectedThinkActions.includes(key) || Boolean(findTaskBySourceKey(key)) ? "checked" : "";
      return `<label class="check-row check-row--practice"><input type="checkbox" data-action="${key}" data-label="${escapeHtml(item.label || "")}" data-detail="${escapeHtml(item.detail || "")}" ${checked} /><span><strong>${escapeHtml(item.label || "下一步")}</strong><small>${escapeHtml(item.detail || "")}</small></span></label>`;
    })
    .join("");

  const thinkBody = think
    ? `
      <div class="thought-timeline">${timelineHtml}</div>
      <div class="think-panel" id="thinkCurrent">
        ${think.question ? `<p class="think-prompt">${escapeHtml(think.question)}</p>` : ""}
        <p class="chips-label">勾選你願意練習或已經說過的句子</p>
        <div class="check-list">${thinkActions}</div>
        <label class="field" style="margin-top:24px">
          <span class="field__label">你想接續回覆的（選填）</span>
          <textarea class="textarea" id="thinkReply" rows="3" placeholder="再寫一句當下想到的…"></textarea>
        </label>
        <div class="ai-actions">
          ${state.think.round < state.think.max ? `<button class="btn btn--think" id="btnThinkSubmit" type="button">接著回答</button>` : ""}
        </div>
      </div>
    `
    : `
      <div class="think-panel">
        <p class="think-card__round">引導式互動</p>
        <p>整理完成後會立刻出現可勾選的下一步。若沒看到，再按一次開始整理即可。</p>
        <div class="ai-actions">
          <button class="btn btn--think" id="btnThink" type="button">繼續深度思考</button>
        </div>
      </div>
    `;

  root.innerHTML = `
    <div class="review-board ${think ? "review-board--think" : ""}">
      ${renderReviewCard({
        title: "今日金句",
        variant: "insight",
        body: `
          ${quoteCards || `<p class="gold-quote">對過程全力以赴，對結果保持開放。</p>`}
          <p class="sfm-hint">勾選收藏後會收入『執行力』；也可直接複製。</p>
          <div class="quote-list">${quoteChecks || ""}</div>
        `,
      })}
      ${renderReviewCard({
        title: "核心洞察區",
        variant: "insight",
        body: `
          <p class="rv-card__kicker">${state.organizeSource === "cloud" ? "雲端復盤" : "本地草稿"}</p>
          <p class="theme-inline">【${escapeHtml(ai.themeCategory || "覺察")}】${escapeHtml(ai.themeTitle || "今天的復盤")} <span class="stars">[${starsText(ai.themeStars)}]</span></p>
        `,
      })}
      ${renderReviewCard({
        title: "深度事件拆解",
        body: `
          ${renderAssumptionGap(ai)}
          ${renderSub("雙方盲點與心態", renderBulletList(mindsetList.length ? mindsetList : ai.reactionList, ai.othersReaction))}
          ${renderSub("事件經過", renderBulletList(ai.eventList, ai.event))}
          ${renderSub("事後反思", `<p>${escapeHtml(ai.reflection || "")}</p>`)}
        `,
      })}
      ${renderReviewCard({
        title: "感恩清單",
        body: `
          ${gratitudeList.length ? renderBulletList(gratitudeList) : `<p>${escapeHtml(ai.gratitudeNote || "從今天這件事裡，先留一句具體的感謝。")}</p>`}
          ${ai.gratitudeNote && gratitudeList.length ? `<p class="sfm-hint">${escapeHtml(ai.gratitudeNote)}</p>` : ""}
          <textarea class="textarea" id="gratitudeInput" rows="3" placeholder="補一句感謝…">${escapeHtml(state.gratitude)}</textarea>
        `,
      })}
      ${
        sfmChecks
          ? renderReviewCard({
              title: "Story · Feeling · Meaning",
              body: `
                <p class="sfm-hint">也可勾選下面這幾段體悟，一併收入『執行力』。</p>
                <div class="quote-list">${sfmChecks}</div>
              `,
            })
          : ""
      }
      ${renderPracticeChecks(ai.nextScripts, ai.howNext)}
      ${renderReviewCard({
        title: "深度思考",
        variant: think ? "think" : "",
        body: thinkBody,
      })}
      <details class="raw-record-fold">
        <summary>查看我的原始紀錄</summary>
        <p class="raw-record">${escapeHtml(rawText || "（尚未留下原文）")}</p>
        <p class="sfm-hint">這段原文會永久保存，整理後不可修改。</p>
      </details>
    </div>
    <div class="ai-actions">
      <button class="btn" id="btnComplete" type="button">完成今日復盤</button>
    </div>
  `;
}

/* =============================================================================
 * 本地深度教練：主題與核心結論、今日金句、深度思考與下一步
 * =========================================================================== */

const COACH_PEOPLE_RE = /女友|女朋友|男朋友|男友|伴侶|老婆|老公|家人|媽媽|爸爸|朋友|同事|老闆|客戶|對方/;
const COACH_WORK_RE = /工作|專案|開會|會議|老闆|客戶|業績|截止|報告|事業|創業|加班/;
const COACH_BODY_RE = /累|睡|失眠|焦慮|身體|頭痛|運動|生病|疲憊|壓力|心情/;
const COACH_COMM_RE = /溝通|說話|講了|沒說|訊息|已讀|回訊|吵架|爭執|解釋|為什麼|找麻煩|聽不懂|被當成/;
const COACH_WHY_RE = /為什麼|因為|原來|其實是|背後/;
const COACH_GRATITUDE_RE = /感恩|感謝|謝謝|慶幸/;
const COACH_VAGUE = ["好像", "還好", "應該", "大概", "可能", "差不多", "還行"];

function clipPhrase(text, max = 22) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function splitCoachSentences(text) {
  return String(text || "")
    .split(/[。！？!?；;\n]+/)
    .map((item) =>
      item
        .replace(/^[-*•、\s]+/, "")
        .replace(/^(今天最卡的一件事|今天讓我有成就感的是|今天我做了一個決定|今天有件事本來可以做得更好|今天想要感恩的是)[：:]\s*/, "")
        .trim()
    )
    .filter((item) => item.length >= 2);
}

function longestCoachSentence(sentences, fallback) {
  return [...sentences].sort((a, b) => b.length - a.length)[0] || fallback || "";
}

function detectCoachCategory(text) {
  if (COACH_PEOPLE_RE.test(text) || COACH_COMM_RE.test(text)) return "人間關係";
  if (COACH_WORK_RE.test(text)) return "事業經營";
  if (COACH_BODY_RE.test(text)) return "身心狀態";
  return "覺察";
}

function detectTurningWord(text) {
  const pairs = [
    { re: /為什麼/, word: "為什麼", alt: "先確認：你現在要解的是眼前這一件，還是整套方案？" },
    { re: /你應該/, word: "你應該", alt: "我們先對齊目標：這次要一次到位，還是先把眼前處理完？" },
    { re: /怎麼又|又是/, word: "怎麼又", alt: "這件事又出現了。先講你現在要我處理哪一步。" },
    { re: /你都不|都不/, word: "你都不", alt: "我缺的是這一步的確認。你現在要的具體是什麼？" },
    { re: /找麻煩/, word: "找麻煩", alt: "我不是要加任務。我先對齊：你要的是眼前這件，還是完整規劃？" },
  ];
  return pairs.find((item) => item.re.test(text)) || pairs[0];
}

function renderGoldenCircle(ai) {
  if (!ai) return "";
  const scripts = Array.isArray(ai.nextScripts) ? ai.nextScripts.filter(Boolean) : [];
  const circle = [ai.whyNeed, ai.whatFact, ai.howNext].some(Boolean)
    ? `
      <article class="ai-block">
        <h3>核心診斷</h3>
        ${ai.whyNeed ? `<p><strong>核心盲點</strong><br>${escapeHtml(ai.whyNeed)}</p>` : ""}
        ${ai.whatFact ? `<p><strong>溝通誤區</strong><br>${escapeHtml(ai.whatFact)}</p>` : ""}
        ${ai.howNext ? `<p><strong>實戰修正</strong><br>${escapeHtml(ai.howNext)}</p>` : ""}
      </article>`
    : "";
  const turning = ai.turningPoint || ai.keyWord || ai.keyWordAlt
    ? `
      <article class="ai-block">
        <h3>升溫轉折</h3>
        ${ai.turningPoint ? `<p>${escapeHtml(ai.turningPoint)}</p>` : ""}
        ${ai.keyWord ? `<p>關鍵詞：<strong>「${escapeHtml(ai.keyWord)}」</strong></p>` : ""}
        ${ai.keyWordAlt ? `<p>改口：「${escapeHtml(ai.keyWordAlt)}」</p>` : ""}
      </article>`
    : "";
  const scriptBlock = scripts.length
    ? `
      <article class="ai-block">
        <h3>下次照這句說</h3>
        <ul class="review-list">${scripts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>`
    : "";
  return `${circle}${turning}${scriptBlock}`;
}

function buildCoachQuotes({ category, hasWhy, otherLabel, keyShort }) {
  const sets = {
    人間關係: [
      "方案再好，少了一句為什麼，也會被當成找麻煩。",
      "對方聽成找麻煩之前，先讓他聽見你在乎。",
      "看懂原因的那天，責備會自動變輕。",
    ],
    事業經營: [
      "卡住的不是能力不夠，是下一步還沒小到明天做得到。",
      "先對齊為什麼，再動手；順序反了，再努力也像空轉。",
      keyShort ? `記住這句：「${clipPhrase(keyShort, 16)}」——它比完美計畫更靠近你。` : "把今天寫下來，不是給別人看成績，是讓這一天確實被過過。",
    ],
    身心狀態: [
      "身體比嘴巴更早說實話。允許那一口累，今天才算被接住。",
      "不是懶，是系統已經在喊停。聽見它，比再加一件事更勇敢。",
      "成長很少是一次轉身，比較像每天把下一步放小一點。",
    ],
    覺察: [
      hasWhy ? "看懂原因的那天，責備會自動變輕。" : "真正卡住的不是努力不夠，是有一句話還沒被說清楚。",
      "把「為什麼」講出口，今天才算被完整接住。",
      keyShort ? `記住這句：「${clipPhrase(keyShort, 16)}」——它比完美結論更靠近你。` : "把今天寫下來，不是給別人看成績，是讓這一天確實被過過。",
    ],
  };
  const quotes = [...(sets[category] || sets["覺察"])];
  if (category === "人間關係" && otherLabel && otherLabel !== "自己") {
    quotes[1] = `把原因講給${otherLabel}聽，關心才會被聽成心意。`;
  }
  return quotes.slice(0, 3);
}

function localOrganize(rawText) {
  const text = String(rawText || "").trim() || "今天把這段話講出來了。";
  const sentences = splitCoachSentences(text);
  const key = longestCoachSentence(sentences, text);
  const keyShort = clipPhrase(key, 24);
  const category = detectCoachCategory(text);
  const hasWhy = COACH_WHY_RE.test(text);
  const hasPeople = COACH_PEOPLE_RE.test(text);
  const girlfriend = /女友|女朋友/.test(text);
  const otherLabel = girlfriend ? "女友" : hasPeople ? "對方" : "自己";
  const vagueHits = COACH_VAGUE.filter((word) => text.includes(word));
  const hasGratitude = COACH_GRATITUDE_RE.test(text);
  const isWin = /成就|做到|完成|決定|開始了|終於/.test(text);
  const isComm = COACH_COMM_RE.test(text) || hasPeople;

  let themeTitle = {
    人間關係: "溝通卡關的真正原因",
    事業經營: "行動被卡住的真正位置",
    身心狀態: "身體比嘴巴更早說實話",
    覺察: "今天還沒被說完的那一句",
  }[category];

  if (isComm) themeTitle = "溝通卡關的真正原因";
  if (/決定/.test(text) && !isComm) themeTitle = "做了決定，卻還沒被自己接住";
  if (isWin && !isComm) themeTitle = "小小做成，為什麼自己看不見";
  if (/卡/.test(text) && !isComm) themeTitle = "今天最卡住的，其實不是事情本身";

  const themeStars = isComm ? 4 : category === "身心狀態" ? 4 : isWin ? 3 : 4;

  const turning = detectTurningWord(text);
  const themeInsight = isComm
    ? `少的不是方案，是那句還沒被聽見的為什麼。你急著把路鋪完，${otherLabel}聽到的卻是被加進來的要求。兩邊都在乎，只是站在不同的句子上。`
    : category === "事業經營"
      ? `卡住的不是能力不夠，是下一步還沒小到明天做得到。${keyShort ? `停在「${keyShort}」。` : ""}先對齊為什麼，再動手。`
      : category === "身心狀態"
        ? "身體比嘴巴更早說實話。今天真正該被聽見的，不是行程，是那一口還沒被允許的累。"
        : `真正卡住的不是努力不夠，是有一句話還沒被說清楚。${keyShort ? `「${keyShort}」還停在表面。` : ""}把為什麼講出口，今天才算被完整接住。`;

  const problems = [];

  if (!hasWhy) {
    problems.push({
      title: "少了一句「為什麼」，方案再好也會被當成找麻煩",
      stars: 5,
      body: keyShort
        ? `你寫了「${keyShort}」。事情被說完了，原因卻還沒出場。${otherLabel}聽到的是你的方案，聽不到你的心意；你自己也會覺得「我明明有做」，卻沒被接住。補一句為什麼，整段對話的溫度會不一樣。`
        : "事情可以寫得很完整，可是少了「為什麼」，它還只是流水帳。補一句為什麼，意義才會出現。",
    });
  }

  if (isComm) {
    problems.push({
      title: "話出口之前，少了一句先對齊的話",
      stars: 4,
      body: `關係裡最容易被當成找麻煩的，不是你的建議，是${otherLabel}還不知道你為什麼要講。提前先寫一句「我是因為在乎才說」，關心才不會被聽成指責。`,
    });
  }

  if (vagueHits.length) {
    problems.push({
      title: `「${vagueHits[0]}」把真實蓋住了`,
      stars: 3,
      body: `「${vagueHits.slice(0, 2).join("、")}」在保護你，也讓復盤停在表面。把模糊的詞換成一個更準的感覺或畫面，今天才會立體起來。`,
    });
  }

  if (problems.length < 2) {
    problems.push({
      title: "下一步還太抽象，明天不一定接得住",
      stars: 4,
      body: "復盤若只停在情緒與事件，明天仍會用同一套方式過。選一個小到不可能失敗的動作——補講一次、先寫再傳、換句話說——把今天接到明天。",
    });
  }

  if (problems.length < 3 && isWin) {
    problems.push({
      title: "已經有一個小小的做成，卻被自己略過",
      stars: 3,
      body: keyShort
        ? `「${keyShort}」你可能自己沒當一回事。把它單獨留下來，它才會變成可以再用的故事，而不是被「還沒夠好」蓋過去。`
        : "今天其實有一個小小的做成。寫下來，才不會被「還沒夠好」蓋過去。",
    });
  }

  if (problems.length < 2) {
    problems.push({
      title: "感受有了，意義還缺一句",
      stars: 3,
      body: "你已經碰到今天了。再問一次：這份感覺在提醒你什麼？一句就夠。",
    });
  }

  const eventList = (sentences.length ? sentences.slice(0, 3) : [text]).map((item, index) => {
    const labels = ["發生了什麼", "接著", "然後"];
    return `${labels[index] || "還有"}：${item}`;
  });
  if (keyShort) eventList.push(`關鍵畫面：${clipPhrase(key, 36)}`);

  const reactionList = hasPeople
    ? [
        `${otherLabel}當下的反應，比較像「還沒被說服」，不是「不想聽」。`,
        "結果：對話停在你的方案，心意沒有被接到。",
        "若沒把為什麼講清楚，關心會被聽成指責，或被當成找麻煩。",
        keyShort ? `事後空氣停在「${keyShort}」這一句還沒被對齊。` : "事後空氣還是緊的，因為真正要對齊的那句話還沒出場。",
      ]
    : [
        "這次主要是自己與自己的對話。沒有別人在場，不代表沒有關係。",
        "當下的反應是把事情說完，卻還沒問自己為什麼要這樣做。",
        "結果：復盤停在流水帳，意義還沒出場。",
        "你怎麼對自己說話，之後也會怎麼對別人說話。",
      ];

  const whyNeed = isComm
    ? `少的不是方法，是動機沒被聽見。你急著把路鋪完，${otherLabel}還不知道你為什麼要講。`
    : category === "事業經營"
      ? "卡住的不是能力不夠，是下一步還沒被收到明天做得到的那一步。"
      : category === "身心狀態"
        ? "身體比嘴巴更早說實話。今天該被聽見的，是那一口還沒被允許的累。"
        : "真正卡住的不是努力不夠，是有一句話還沒被說清楚。";

  const whatFact = isComm
    ? `順序反了：先給方案，再補心意。${otherLabel}接收到的只是要求，聽不到你的在乎。升溫常卡在「${turning.word}」。${keyShort ? `畫面：「${keyShort}」。` : ""}`
    : `順序反了：先處理事情，再問為什麼。${keyShort ? `停在「${keyShort}」。` : ""}補上那一句，責備才會退一步。`;

  const howNext = isComm
    ? `開口前先補一句為什麼。把「${turning.word}」換成「我不是要找麻煩，我是因為在乎」。`
    : "先對齊為什麼，再動手。選一個小到不可能失敗的下一步。";

  const turningPoint = isComm
    ? `轉折發生在方案先於確認出場，或「${turning.word}」把討論推成對抗的那一步。`
    : "轉折發生在還沒問自己為什麼，就直接加速處理的那一步。";

  const nextScripts = isComm
    ? [
        `「我說這件事，是因為我在乎……」`,
        `「我不是要找麻煩，我是因為在乎。」`,
        `「我想先對齊一下：我以為是在幫忙，你會不會以為我在加任務？」`,
      ]
    : [
        `「我先講我以為的：我以為卡在執行。真正卡住的，會不會是那句還沒說出口的為什麼？」`,
        `「這次我先只做眼前這一步，做完再決定要不要展開。」`,
        `「把今天最硬的那句，換成自己也聽得下去的版本。」`,
      ];

  const reflection = isComm
    ? `當時你急著把事情處理完，${otherLabel}接收到的只是一個還沒被說明的要求，聽不到你的好意從哪來。${keyShort ? `回頭看「${keyShort}」，` : ""}解法本身可能沒問題，缺的是先講為什麼。現在補上，不是為了翻舊帳，是為了下次開口前先站在同一邊。`
    : hasWhy
      ? `當時你急著把事情處理完，原因其實已經碰到了，只是還沒被單獨拿出來看。現在回頭看「${keyShort || "今天這一段"}」，責備可以退一步，選擇才能往前。`
      : `當時你急著處理事情，來不及問自己為什麼要這樣做。回頭看「${keyShort || "今天這一段"}」，少的不是努力，是先對齊的那一句。現在補上，不是為了翻舊帳，是為了下次先站在自己旁邊。`;

  const conclusion = isComm
    ? `方案再好，少了一句「為什麼」，也會被${otherLabel}當成找麻煩。把原因講出口，關心才會被聽成心意。`
    : {
        事業經營: "卡住的不是能力不夠，是行動還沒被收到明天做得到的那一步。先對齊為什麼，再動手。",
        身心狀態: "身體比嘴巴更早說實話。今天真正該被聽見的，不是行程，是那一口還沒被允許的累。",
        覺察: "真正卡住的不是努力不夠，是有一句話還沒被說清楚。把「為什麼」講出口，今天才算被完整接住。",
      }[category] || "真正卡住的不是努力不夠，是有一句話還沒被說清楚。";

  const thinkGuide = isComm
    ? `如果你只能補一句「為什麼」給${otherLabel}，那一句會是什麼？兩邊以為的，是同一件事嗎？`
    : "如果你只能補一句「為什麼」，那一句會是什麼？";

  const quotes = buildCoachQuotes({ category: isComm ? "人間關係" : category, hasWhy, otherLabel, keyShort });

  const assumptionGap = {
    line: isComm
      ? `我以為是在幫忙，${otherLabel === "自己" ? "當時的自己" : "他"}以為是被找麻煩`
      : category === "身心狀態"
        ? "我以為再撐一下就過了，身體以為自己該被允許停下來"
        : "我以為卡在執行，當時的自己以為缺的是更多努力",
    mine: isComm
      ? "我以為把方案講清楚，就是在乎。"
      : "我以為事情說清楚了，下一步就會自然發生。",
    theirs: hasPeople
      ? `${otherLabel}以為這是多出來的要求，還沒聽見我為什麼要說。`
      : "當時的自己以為缺的是更多努力，不是那句還沒說出口的為什麼。",
  };

  const mindsetList = [
    isComm
      ? "你急著把路鋪完，卻還沒讓對方聽見你的心意。"
      : "你把事情說完了，卻還沒問自己為什麼要這樣做。",
    hasPeople
      ? `${otherLabel}停在防衛，不是不想聽，是還沒被說服。`
      : "這次主要是自己對自己。卡住的不是能力，是那句還沒被允許說出口的話。",
    isComm
      ? "兩邊都在乎，只是站在不同的句子上。"
      : "感受已經碰到了，意義還缺一句。",
    hasPeople
      ? `${otherLabel}當下要的，可能只是先被理解，不是立刻被給一套解法。`
      : "當時的自己其實只要被接住，不是再加一份完整計畫。",
  ];

  const gratitudeList = hasGratitude
    ? [
        "感謝自己有把這段話講出來，落差才看得見。",
        hasPeople ? `感謝${otherLabel}其實有在乎，只是還沒對上。` : "感謝今天這段卡住，讓那句為什麼終於有位置。",
        keyShort ? `感謝「${clipPhrase(keyShort, 16)}」把真正要對齊的那一步標出來。` : "感謝這次摩擦，讓關心有機會被聽成心意。",
      ]
    : [
        "感謝自己願意復盤，而不是把摩擦當成個性問題。",
        hasPeople ? `感謝${otherLabel}把真實感受露出來，才知道方案走太快。` : "感謝卡住本身：它指出有一句話還沒被說清楚。",
        "感謝今天這件事，讓「先講為什麼，再給方案」變成一句用得上的標題。",
      ];

  return {
    themeCategory: category,
    themeTitle,
    themeStars,
    themeInsight,
    problems: problems.slice(0, 3),
    eventList,
    reactionList,
    mindsetList,
    assumptionGap,
    event: eventList.join("\n"),
    othersReaction: reactionList.join("\n"),
    reflection,
    conclusion,
    quotes,
    gratitudeList,
    gratitudeMissing: !hasGratitude,
    gratitudeNote: hasGratitude
      ? "你已經提到感謝了。再具體一點：是誰、哪一句、哪一個小動作讓你想說謝謝？"
      : "今天的復盤裡還沒有感恩。不是要你假裝沒事，是留一句：哪怕只感謝自己有把這段話講出來。",
    sfm: [
      {
        type: "story",
        title: "今天的畫面",
        body: keyShort ? `有一個畫面我到現在還記得：${clipPhrase(key, 40)}` : "我把今天說出來了，這件事本身就算走了一步。",
      },
      {
        type: "feeling",
        title: "當下的感覺",
        body: isComm
          ? "不是想贏，是害怕好意沒被聽見。允許這份卡待一會兒，再補一句為什麼。"
          : "不是懶，是害怕被看見還沒對齊的地方。允許這份卡待一會兒，再補一句為什麼。",
      },
      {
        type: "meaning",
        title: "今日金句",
        body: quotes[0],
      },
    ],
    tags: [category],
    whyNeed,
    whatFact,
    howNext,
    turningPoint,
    keyWord: turning.word,
    keyWordAlt: turning.alt,
    nextScripts,
    thinkGuide,
  };
}

function localThink(organize, round, selected, reply) {
  const theme = organize?.themeTitle || "今天還沒說完的那一句";
  const problem = organize?.problems?.[0]?.title || "少了一句為什麼";
  const actionHint = selected?.[0]?.label || "";
  const replyHint = String(reply || "").trim();
  const last = round >= 5;
  const otherFromTheme = /女友/.test(`${theme}${problem}${organize?.conclusion || ""}`) ? "女友" : "對方";

  const keyWordAlt = organize?.keyWordAlt || "我不是要找麻煩，我是因為在乎。";
  const methodActions = [
    {
      label: "補講一次為什麼",
      detail: "「我說這件事，是因為我在乎……」",
    },
    {
      label: "提前先寫一句",
      detail: `「${keyWordAlt}」`,
    },
    {
      label: "換句話說練習",
      detail: "「把今天最硬的那句，換成對方聽得進去、自己也聽得下去的版本。」",
    },
  ];

  const gapLine = organize?.assumptionGap?.line || `我以為是在幫忙，${otherFromTheme}以為是被找麻煩`;

  const rounds = [
    {
      title: "先聽見那句為什麼",
      stars: 4,
      question: organize?.thinkGuide || `圍繞「${clipPhrase(theme, 18)}」：如果你只能補一句「為什麼」，那一句會是什麼？`,
      insight: `核心是「${clipPhrase(problem, 22)}」。少的通常不是方法，是動機沒被聽見。「${clipPhrase(gapLine, 28)}」——兩邊以為的，是同一件事嗎？`,
      conclusion: organize?.conclusion || "少的不是方案，是那句還沒被聽見的為什麼。",
      points: [
        { title: "這一層", conclusion: organize?.conclusion || "少的不是方案，是那句還沒被聽見的為什麼。" },
      ],
      actions: methodActions,
    },
    {
      title: "順序反了，心意就聽不見",
      stars: 4,
      question: actionHint
        ? `你選了「${actionHint}」。做這件事之前，你最怕${otherFromTheme}聽到的是哪一句？`
        : `如果你把最硬的那句話，換成${otherFromTheme}聽得進去的版本，第一句會怎麼開口？`,
      insight: "找麻煩的感覺，往往來自順序反了：先給方案，再補心意。對調之後，同一句話會變成靠近。",
      conclusion: "先給方案、再補心意，關心就會被聽成找麻煩。",
      points: [{ title: "順序", conclusion: "先給方案、再補心意，關心就會被聽成找麻煩。" }],
      actions: methodActions,
    },
    {
      title: "先對自己說實話",
      stars: 4,
      question: replyHint
        ? `你剛說「${clipPhrase(replyHint, 20)}」。這句話裡，哪一個字是真正的需要？`
        : "這份卡住，有沒有一部分其實是對自己說的，而不只是對別人？",
      insight: "對外溝通卡住時，內在通常也有一句沒被允許說出口。對自己誠實，對外才講得準。",
      conclusion: "對外卡住之前，先讓那句對自己說的話有位置。",
      points: [{ title: "對自己", conclusion: "對外卡住之前，先讓那句對自己說的話有位置。" }],
      actions: methodActions,
    },
    {
      title: "收到明天做得到的一步",
      stars: 5,
      question: "明天最小、一定做得到的一步是什麼？小到不可能失敗的那種。",
      insight: "抽象的「下次溝通好一點」不會發生。具體的「先寫一句再傳」「補講一次為什麼」才會發生。",
      conclusion: "明天只做一件小到不可能失敗的事：先寫一句為什麼再開口。",
      points: [{ title: "明天", conclusion: "明天只做一件小到不可能失敗的事：先寫一句為什麼再開口。" }],
      actions: methodActions,
    },
    {
      title: "先看見，才能改變",
      stars: 5,
      question: last
        ? "如果今天只帶走一句話，你希望未來的自己記得哪一句？"
        : "走到這裡，你已經比開頭更靠近自己了。還有哪一句想留給明天？",
      insight: "五輪不是為了把你問倒，是為了讓那句為什麼終於有位置。你可以停在這裡，也可以把勾選的下一步真正做一次。",
      conclusion: "帶走一句就夠：讓那句為什麼終於有位置。",
      points: [{ title: "帶走", conclusion: "帶走一句就夠：讓那句為什麼終於有位置。" }],
      actions: methodActions,
    },
  ];

  const current = rounds[Math.max(0, Math.min(4, round - 1))] || rounds[0];
  return {
    title: current.title,
    stars: current.stars || 4,
    prompt: current.question || defaultThinkPrompt(organize),
    question: current.question,
    insight: current.insight,
    conclusion: current.conclusion || "",
    points: current.points || [],
    actions: current.actions || methodActions,
  };
}

function applyOrganizeResult(result, source) {
  const safe = result && typeof result === "object" ? result : localOrganize("");
  state.organize = safe;
  if (source) state.organizeSource = source;
  state.selectedQuotes = [];
  state.selectedSfm = [];
  state.selectedPractice = [];
  state.think = { round: 0, max: 5, history: [], current: null };
  try {
    upsertReview(currentIso(), {
      rawText: state.rawText || document.getElementById("reviewText")?.value.trim() || "",
      organize: safe,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* 儲存失敗也不擋畫面 */
  }
  renderAiStage();
  purgeThinkingUi();
}

function runOrganize(event) {
  try {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    purgeThinkingUi();

    const input = document.getElementById("reviewText");
    if (document.getElementById("thanksText")) syncHiddenReviewText();
    const rawText = String(input && input.value ? input.value : "").trim();
    if (!rawText) {
      showToast("先用講的或寫的，留一段今天的話。");
      return;
    }

    state.rawText = rawText;
    const token = (runOrganize._token || 0) + 1;
    runOrganize._token = token;

    applyOrganizeResult(localOrganize(rawText), "local");
    applyThinkResult(localThink(state.organize, 1, [], ""), 1, {
      silent: true,
      prompt: defaultThinkPrompt(state.organize),
    });
    showToast("先出本地草稿，接著連線雲端…");
    maybeEnhanceWithApi(rawText, token);
  } catch {
    try {
      const fallback = document.getElementById("reviewText")?.value.trim() || "今天把這段話講出來了。";
      state.rawText = fallback;
      applyOrganizeResult(localOrganize(fallback), "local");
      applyThinkResult(localThink(state.organize, 1, [], ""), 1, {
        silent: true,
        prompt: defaultThinkPrompt(state.organize),
      });
    } catch {
      purgeThinkingUi();
    }
  }
}
window.runOrganize = runOrganize;
window.generateReview = generateReview;

function normalizeThinkResult(raw, round) {
  const fallback = localThink(state.organize, round, [], "");
  const result = raw && typeof raw === "object" ? raw : fallback;
  const actions = Array.isArray(result.actions) && result.actions.length
    ? result.actions.slice(0, 4).map((item) => ({
        label: String(item?.label || "下一步").trim() || "下一步",
        detail: String(item?.detail || "").trim() || "把這一步寫成明天做得到的一句話。",
      }))
    : fallback.actions;
  const points = Array.isArray(result.points)
    ? result.points
        .map((item) => ({
          title: String(item?.title || "").trim(),
          conclusion: String(item?.conclusion || "").trim(),
        }))
        .filter((item) => item.conclusion)
    : fallback.points;
  const stars = Number(result.stars ?? fallback.stars);
  return {
    title: String(result.title || fallback.title || "先聽見那句為什麼"),
    stars: stars >= 1 && stars <= 5 ? stars : 4,
    question: String(result.question || fallback.question),
    insight: String(result.insight || fallback.insight),
    conclusion: String(result.conclusion || fallback.conclusion || ""),
    points: points && points.length ? points : fallback.points,
    prompt: String(result.prompt || fallback.prompt || "").trim(),
    reply: String(result.reply || fallback.reply || "").trim(),
    actions,
  };
}

function applyThinkResult(raw, nextRound, options = {}) {
  const result = normalizeThinkResult(raw, nextRound);
  const existing = options.replace && state.think.history?.length ? state.think.history[state.think.history.length - 1] : null;
  result.prompt = String(options.prompt || result.prompt || existing?.prompt || "").trim();
  result.reply = String(options.reply || result.reply || existing?.reply || "").trim();
  state.think.round = nextRound;
  state.think.current = result;
  if (!Array.isArray(state.think.history)) state.think.history = [];
  if (options.replace && state.think.history.length) {
    state.think.history[state.think.history.length - 1] = result;
  } else {
    state.think.history.push(result);
  }
  state.selectedThinkActions = [];
  try {
    upsertReview(currentIso(), {
      rawText: state.rawText || document.getElementById("reviewText")?.value.trim() || "",
      organize: state.organize,
      thinkHistory: state.think.history,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
  renderAiStage();
  if (!options.silent) showToast(`深度思考｜第 ${nextRound}/${state.think.max} 輪`);
  return result;
}

function runThink(replyText = "") {
  try {
    if (!state.organize) {
      showToast("請先按「開始整理」。");
      return;
    }
    if ((state.think.round || 0) >= state.think.max) {
      showToast("五輪深度思考已走完，可以直接完成今日復盤。");
      return;
    }

    const selected = [...document.querySelectorAll("[data-action]:checked")].map((input) => ({
      key: input.dataset.action,
      label: input.dataset.label,
      detail: input.dataset.detail,
    }));
    const reply = String(replyText || "").trim();
    const nextRound = (state.think.round || 0) + 1;
    const token = (state.thinkToken || 0) + 1;
    state.thinkToken = token;
    const prompt = reply || state.think.current?.question || defaultThinkPrompt(state.organize);
    if (state.think.current) state.think.current.reply = reply;
    applyThinkResult(localThink(state.organize, nextRound, selected, reply), nextRound, { prompt, reply });
    enhanceThinkWithApi(nextRound, selected, reply, token);
  } catch {
    try {
      const nextRound = Math.min((state.think.round || 0) + 1, state.think.max || 5);
      const reply = String(replyText || "").trim();
      applyThinkResult(localThink(state.organize, nextRound, [], reply), nextRound, {
        prompt: reply || state.think.current?.question || defaultThinkPrompt(state.organize),
        reply,
      });
    } catch {
      showToast("深度思考已就緒，請再點一次。");
    }
  }
}

async function enhanceThinkWithApi(nextRound, selected, reply, token) {
  if (!state.user) {
    showToast("登入後，深度思考才會走到雲端。");
    return;
  }
  showToast("正在往下深挖…");
  try {
    const remote = await generateThink(state.rawText, state.organize, nextRound, selected, reply);
    if (state.thinkToken !== token) return;
    applyThinkResult(remote, nextRound, { silent: true, replace: true });
    showToast("雲端深度思考已套用。");
  } catch (error) {
    console.error("[日精進 API] 深度思考雲端失敗，維持本地結果。", formatApiError(error), error);
    showToast(`雲端思考失敗：${formatApiError(error)}`);
  }
}

function completeToday() {
  finishTodayReview();
}

function waitForInsightIdle(timeoutMs = 25000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (!state.insightBusy || Date.now() - started >= timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 120);
    };
    tick();
  });
}

async function finishTodayReview() {
  if (state.completeBusy) return;
  if (state.journalMode === "quick") {
    const journal = collectJournal();
    if (!quickInsightReady(journal)) {
      showToast("請先寫下今日感謝、事件，並選擇心情。");
      document.getElementById("section-thanks")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  const guide = normalizeInsight(state.journalInsight).guide || emptyThinkGuide();
  if (guide.rounds.filter((item) => item.answer).length >= 3 && !thinkGuideDone(guide)) {
    if (state.journalMode === "quick") {
      document.getElementById("section-quick-insight")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setCompleteBusy(true);
    try {
      await generateThinkGuideClose({ fromComplete: true });
    } finally {
      setCompleteBusy(false);
    }
  }
  const iso = currentIso();
  const collected = document.getElementById("thanksText") ? syncHiddenReviewText() : { journal: null, rawText: "" };
  const rawText = collected.rawText || document.getElementById("reviewText")?.value.trim() || state.rawText;
  if (!rawText && !state.organize && !journalHasContent(collected.journal)) {
    showToast("還沒有內容可以完成。");
    return;
  }

  const gratitude = document.getElementById("gratitudeInput")?.value.trim() || state.gratitude;
  const organize = state.organize;

  upsertReview(iso, {
    rawText,
    journal: collected.journal || getReview(iso)?.journal || emptyJournal(),
    organize,
    gratitude,
    selectedQuotes: state.selectedQuotes,
    selectedSfm: state.selectedSfm,
    thinkHistory: state.think.history,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  syncJournalLibraries(iso, collected.journal || getReview(iso)?.journal || {});

  if (organize) {
    (organize.sfm || []).forEach((item, index) => {
      if (!state.selectedSfm.includes(`sfm:${index}`)) return;
      addSfmFromGuide({
        key: sfmGuideKey("sfm", index, iso),
        body: item.body || item.title,
        title: item.title,
        type: item.type,
        date: iso,
      });
    });
    (organize.quotes || []).forEach((quote, index) => {
      if (!state.selectedQuotes.includes(`quote:${index}`)) return;
      addSfmFromGuide({
        key: sfmGuideKey("quote", index, iso),
        body: quote,
        date: iso,
      });
    });
  }

  const actionInputs = [...document.querySelectorAll("[data-action]:checked, [data-practice]:checked")];
  actionInputs.forEach((input) => {
    addTaskFromGuide({
      key: input.dataset.practice || input.dataset.action || "",
      label: input.dataset.label || "",
      detail: input.dataset.detail || "",
    });
  });

  updateStats();
  syncReviewsToCloud();
  showToast(
    state.journalMode === "quick"
      ? "快速復盤已完成，今日洞察已存入歷史紀錄。"
      : "今日復盤已完成，勾選項目與明天最小一步已同步到側邊欄。"
  );
}

function inferSfmType(text) {
  if (/感覺|感受|難過|焦慮|安心|累|暖|悶|害怕|感動|委屈/.test(text)) return "feeling";
  if (/原來|其實|意義|明白|學會|提醒|重要/.test(text)) return "meaning";
  return "story";
}

function clearReview() {
  const textarea = document.getElementById("reviewText");
  if (textarea) textarea.value = "";
  fillJournal(emptyJournal());
  resetAiSession();
  renderAiStage();
  const iso = currentIso();
  const reviews = getReviews();
  if (reviews[iso] && !reviews[iso].completedAt) {
    delete reviews[iso];
    saveReviews(reviews);
  }
  updateStats();
}

/* =============================================================================
 * 週月報 / 下一步 / SFM / 歷史
 * =========================================================================== */

function renderReport() {
  const report = buildReport(state.reportType);
  const root = document.getElementById("reportContent");
  if (!root) return;
  destroyReportCharts("report");
  const token = (renderReport._token || 0) + 1;
  renderReport._token = token;
  const period = report.period;
  const cachedAi = readCachedReport(state.reportType, period) || readLatestCachedReport(state.reportType);
  const hasData = report.filledDays || (report.stats?.totals?.checked || 0);

  if (!hasData) {
    root.innerHTML = `
      <article class="report-card">
        <div class="empty">
          <p class="empty__title">這個區間還沒有復盤</p>
          <p class="report-empty">寫下第一篇、勾選覺察／執行／顯化之後，這裡會出現圖表與深度思考。</p>
        </div>
      </article>
      <div id="reportAi"></div>
      <article class="report-card" id="reportHistoryCard">
        <h3>歷史報告列表</h3>
        <p class="report-range">每月 1 號會自動封存上個月的月度成長報告。</p>
        <div class="archive-list" id="reportHistoryList">${renderHistoryReportList(listLocalMonthArchives())}</div>
      </article>
    `;
    hydrateReportHistory();
    ensurePreviousMonthArchive().then(() => {
      if (token === renderReport._token) hydrateReportHistory();
    });
    return;
  }

  root.innerHTML = `
    ${renderReportBody(report, { ai: cachedAi })}
    <article class="report-card" id="reportHistoryCard">
      <h3>歷史報告列表</h3>
      <p class="report-range">點開任意月份，回看當時的圖表、閃光點與突破口。可列印成 PDF 存檔。</p>
      <div class="archive-list" id="reportHistoryList">${renderHistoryReportList(listLocalMonthArchives())}</div>
    </article>
  `;
  requestAnimationFrame(() => paintReportCharts(report.stats, "report"));
  hydrateAiReport(state.reportType, report, token);
  hydrateReportHistory();
  ensurePreviousMonthArchive().then(() => {
    if (token === renderReport._token) hydrateReportHistory();
  });
  syncReviewsToCloud();
}

async function hydrateReportHistory() {
  const list = document.getElementById("reportHistoryList");
  if (!list) return;
  const items = await fetchArchivedReportList();
  list.innerHTML = renderHistoryReportList(items);
}

function archiveRangeForPeriod(period) {
  const fromIso = `${period}-01`;
  return {
    fromIso,
    toIso: lastDayOfMonthIso(period),
    days: Number(lastDayOfMonthIso(period).slice(-2)) || 30,
    label: formatMonthLabel(period),
  };
}

function buildArchiveViewModel(period) {
  const range = archiveRangeForPeriod(period);
  const local = buildReport("month", range);
  const cached = readCachedReport("month", period);
  return {
    local,
    cached,
    stats: (cached && cached.stats) || local.stats,
  };
}

function fillArchiveModal(period) {
  const modal = document.getElementById("reportArchiveModal");
  const body = document.getElementById("reportArchiveBody");
  const title = document.getElementById("reportArchiveTitle");
  if (!modal || !body) return;
  const view = buildArchiveViewModel(period);
  if (title) title.textContent = view.cached?.title || `${formatMonthLabel(period)}成長報告`;
  body.innerHTML = renderReportBody(
    {
      ...view.local,
      label: formatMonthLabel(period),
    },
    {
      ai:
        view.cached || {
          summary: "這份月份已留下數據存檔。登入後可生成深度思考。",
          highlights: [],
          breakthroughs: [],
          fromIso: view.local.fromIso,
          toIso: view.local.toIso,
        },
      aiId: "archiveAi",
      chartPrefix: "archive",
    }
  );
  modal.dataset.period = period;
  if (typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
  requestAnimationFrame(() => paintReportCharts(view.stats, "archive"));
}

async function openArchivedMonth(period, options = {}) {
  const range = archiveRangeForPeriod(period);
  fillArchiveModal(period);
  const cached = readCachedReport("month", period);
  if (state.user && (!cached || cached.source === "local")) {
    try {
      let report = await fetchStoredCloudReport("month", period);
      if (!report) {
        report = await generateCloudReport("month", range.fromIso, range.toIso, period, {
          stats: buildGrowthStats(range.fromIso, range.toIso),
          archive: true,
        });
      }
      if (report) {
        writeCachedReport("month", report.period || period, report);
        fillArchiveModal(period);
      }
    } catch {
      /* 本地存檔仍可看 */
    }
  }
  if (options.print) window.setTimeout(() => printArchivedReport(), 250);
}

function printArchivedReport() {
  document.body.classList.add("printing-report");
  window.print();
  window.setTimeout(() => document.body.classList.remove("printing-report"), 400);
}

function taskActionIcon(name) {
  const icons = {
    hold: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16l-1.6 11H5.6L4 8z"/><path d="M4 8l2.2-3.5h11.6L20 8"/><path d="M9 13h6"/></svg>`,
    back: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 8H4V3"/><path d="M4 8c2.4-3.2 6-5 10-5a9 9 0 1 1-9 9"/></svg>`,
    done: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.3 2.3 4.7-5"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14"/><path d="M10 7V5h4v2"/><path d="M8 7l.8 12h6.4L16 7"/></svg>`,
  };
  return icons[name] || "";
}

function renderTaskChip(label, variant, attrs, icon) {
  return `<button class="task-chip-btn task-chip-btn--${variant}" ${attrs} type="button">${taskActionIcon(icon)}<span>${escapeHtml(label)}</span></button>`;
}

function renderStatusActionChips(id, status, attrName) {
  const safeId = escapeHtml(id);
  const attr = `${attrName}="${safeId}"`;
  if (status === "done") {
    return renderTaskChip("進行中", "back", `${attr} data-to="doing" aria-label="移到進行中"`, "back");
  }
  if (status === "later") {
    return `${renderTaskChip("進行中", "back", `${attr} data-to="doing" aria-label="移到進行中"`, "back")}
      ${renderTaskChip("已完成", "done", `${attr} data-to="done" aria-label="標記已完成"`, "done")}`;
  }
  return `${renderTaskChip("移到待辦", "hold", `${attr} data-to="later" aria-label="移到待辦"`, "hold")}
    ${renderTaskChip("已完成", "done", `${attr} data-to="done" aria-label="標記已完成"`, "done")}`;
}

function statusMoveToast(to) {
  if (to === "later") return "已移到待辦。";
  if (to === "doing") return "已移到進行中。";
  if (to === "done") return "已標記完成。";
  return "已更新狀態。";
}

function renderTaskItem(task, options = {}) {
  const done = task.status === "done";
  const later = task.status === "later";
  const dateLabel = task.date ? formatDisplayDate(task.date) : "";
  const parts = taskDisplayParts(task);
  const heading =
    Number.isInteger(options.index) && !done
      ? `${String(options.index + 1).padStart(2, "0")}｜${parts.title}`
      : parts.title;
  const id = escapeHtml(task.id);
  return `
    <article class="task-card task-todo${done ? " is-done" : ""}${later ? " is-later" : ""}">
      <label class="task-todo__check">
        <input type="checkbox" data-task-toggle="${id}" ${done ? "checked" : ""} />
        <span class="task-todo__box" aria-hidden="true"></span>
        <span class="task-todo__body">
          <span class="task-card__title">${escapeHtml(heading)}</span>
          ${parts.detail ? `<span class="task-card__lead">${escapeHtml(parts.detail)}</span>` : ""}
          <span class="task-card__meta">
            <span class="tag">${escapeHtml(task.source || "自行新增")}</span>
            ${later ? `<span class="tag tag--later">待辦</span>` : ""}
            ${dateLabel ? `<span class="tag">${escapeHtml(dateLabel)}</span>` : ""}
          </span>
        </span>
      </label>
      <div class="task-todo__actions" role="group" aria-label="行動操作">
        ${renderStatusActionChips(task.id, task.status, "data-task-status")}
        ${renderTaskChip("刪除", "delete", `data-task-delete="${id}" aria-label="刪除這項行動"`, "trash")}
      </div>
    </article>
  `;
}

function renderTaskSection(title, lead, items, emptyText) {
  return `
    <section class="todo-section">
      <header class="todo-section__head">
        <h3>${escapeHtml(title)}${items.length ? `（${items.length}）` : ""}</h3>
        <p>${escapeHtml(lead)}</p>
      </header>
      ${items.length ? items.map((task, index) => renderTaskItem(task, { index })).join("") : `<div class="empty">${escapeHtml(emptyText)}</div>`}
    </section>
  `;
}

function renderTasks() {
  const list = document.getElementById("taskList");
  if (!list) return;
  const all = getTasks();
  const later = all
    .filter((task) => task.status === "later")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const doing = all
    .filter((task) => task.status === "doing")
    .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
  const done = all
    .filter((task) => task.status === "done")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const filter = ["doing", "later", "done"].includes(state.taskFilter) ? state.taskFilter : "doing";

  if (!all.length) {
    list.innerHTML = `<div class="empty"><p class="empty__title">執行力還是空的</p>在今日復盤勾選行動卡點或解法，完成復盤後就會匯集到這裡。</div>`;
    return;
  }

  if (filter === "later") {
    list.innerHTML = renderTaskSection("待辦", "點「進行中」就能拿回來做。完成後會走到已完成。", later, "目前沒有待辦的行動。");
    return;
  }
  if (filter === "done") {
    list.innerHTML = renderTaskSection("已完成", "這些已經被你做完了。點「進行中」或取消勾選就能再拿回來。", done, "還沒有完成的行動。");
    return;
  }
  list.innerHTML = renderTaskSection(
    "進行中",
    "勾選或點「已完成」就會走過去。還沒想做的，點「移到待辦」。",
    doing,
    "目前沒有進行中的行動。"
  );
}

function setTaskFilter(filter) {
  const next = ["doing", "later", "done"].includes(filter) ? filter : "doing";
  state.taskFilter = next;
  document.querySelectorAll("#taskFilters .chip").forEach((item) => {
    const on = item.dataset.filter === next;
    item.classList.toggle("is-active", on);
    item.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function setTaskStatus(id, status) {
  const allowed = new Set(["doing", "later", "done"]);
  const next = allowed.has(status) ? status : "doing";
  saveTasks(
    getTasks().map((task) =>
      task.id === id ? { ...task, status: next, updatedAt: new Date().toISOString() } : task
    )
  );
  setTaskFilter(next);
  renderTasks();
}

function setTaskDone(id, done) {
  setTaskStatus(id, done ? "done" : "doing");
}

function addTask(event) {
  event.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return;
  const tasks = getTasks();
  tasks.unshift({
    id: uid(),
    title,
    detail: document.getElementById("taskDetail")?.value.trim() || "",
    status: "doing",
    source: document.getElementById("taskSource").value,
    date: currentIso(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveTasks(tasks);
  document.getElementById("taskTitle").value = "";
  const detailInput = document.getElementById("taskDetail");
  if (detailInput) detailInput.value = "";
  setTaskFilter("doing");
  renderTasks();
  showToast("行動已加入。");
}

function insightInRange(item) {
  const iso = item.date || String(item.createdAt || "").slice(0, 10);
  const date = parseIsoDate(iso);
  if (!date) return state.insightFilter === "all";
  const today = startOfDay(new Date());
  if (state.insightFilter === "week") return date >= startOfWeek(today) && date <= today;
  if (state.insightFilter === "month") {
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }
  return true;
}

function renderInsights() {
  const list = document.getElementById("insightList");
  if (!list) return;
  const all = getInsights();
  const items = all.filter(insightInRange);
  if (!all.length) {
    list.innerHTML = `<div class="empty"><p class="empty__title">還沒有已覺察洞察</p>在今日復盤收藏核心覺察金句，完成復盤後就會出現在這裡。</div>`;
    return;
  }
  if (!items.length) {
    list.innerHTML = `<div class="empty">這個區間目前沒有洞察。</div>`;
    return;
  }
  const grouped = new Map();
  items.forEach((item) => {
    const iso = item.date || String(item.createdAt || "").slice(0, 10) || "";
    if (!grouped.has(iso)) grouped.set(iso, []);
    grouped.get(iso).push(item);
  });
  list.innerHTML = [...grouped.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([iso, rows]) => {
      const cards = rows
        .map((item) => {
          const dateLabel = iso ? formatDisplayDate(iso) : item.date ? formatDisplayDate(item.date) : "";
          return `
            <article class="task-card insight-saved">
              <div>
                <p class="task-card__title insight-saved__quote">${escapeHtml(item.title)}</p>
                ${dateLabel ? `<div class="task-card__meta"><span class="tag tag--date">${escapeHtml(dateLabel)}</span></div>` : ""}
              </div>
              <div class="task-card__actions">
                <button class="btn btn--ghost btn--tiny" data-insight-delete="${item.id}" type="button">刪除</button>
              </div>
            </article>
          `;
        })
        .join("");
      return `<section class="library-group"><h3 class="library-group__date">${escapeHtml(iso ? formatDisplayDate(iso) : "未標日期")}</h3>${cards}</section>`;
    })
    .join("");
}

function renderManifestItem(item) {
  const done = item.status === "done";
  const later = item.status === "later";
  const dateLabel = item.date ? formatDisplayDate(item.date) : "";
  const vision = String(item.vision || "").trim();
  const id = escapeHtml(item.id);
  return `
    <article class="task-card task-todo${done ? " is-done" : ""}${later ? " is-later" : ""}">
      <label class="task-todo__check">
        <input type="checkbox" data-manifest-toggle="${id}" ${done ? "checked" : ""} />
        <span class="task-todo__box" aria-hidden="true"></span>
        <span class="task-todo__body">
          <span class="task-card__title">${escapeHtml(item.title)}</span>
          ${vision ? `<span class="task-card__lead">${escapeHtml(vision)}</span>` : ""}
          <span class="task-card__meta">
            <span class="tag">顯化力</span>
            ${later ? `<span class="tag tag--later">待辦</span>` : ""}
            <span class="tag">${escapeHtml(item.source || "今日復盤")}</span>
            ${dateLabel ? `<span class="tag">${escapeHtml(dateLabel)}</span>` : ""}
          </span>
        </span>
      </label>
      <div class="task-todo__actions" role="group" aria-label="顯化操作">
        ${renderStatusActionChips(item.id, item.status, "data-manifest-status")}
        ${renderTaskChip("刪除", "delete", `data-manifest-delete="${id}" aria-label="刪除這項顯化目標"`, "trash")}
      </div>
    </article>
  `;
}

function renderManifestGroups(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const iso = item.date || String(item.createdAt || "").slice(0, 10) || "";
    if (!grouped.has(iso)) grouped.set(iso, []);
    grouped.get(iso).push(item);
  });
  return [...grouped.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([iso, rows]) => {
      const cards = rows.map((item) => renderManifestItem(item)).join("");
      return `<section class="library-group"><h3 class="library-group__date">${escapeHtml(iso ? formatDisplayDate(iso) : "未標日期")}</h3>${cards}</section>`;
    })
    .join("");
}

function renderManifests() {
  const list = document.getElementById("manifestList");
  if (!list) return;
  const all = getManifests();
  const later = all
    .filter((item) => item.status === "later")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const doing = all
    .filter((item) => item.status === "doing")
    .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
  const done = all
    .filter((item) => item.status === "done")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const filter = ["doing", "later", "done"].includes(state.manifestFilter) ? state.manifestFilter : "doing";

  if (!all.length) {
    list.innerHTML = `<div class="empty"><p class="empty__title">顯化力還是空的</p>在今日復盤勾選顯化執行目標，完成復盤後就會匯集到這裡。</div>`;
    return;
  }

  const buckets = {
    doing: {
      title: "進行中",
      lead: "勾選或點「已完成」就會走過去。還沒想推進的，點「移到待辦」。",
      items: doing,
      empty: "目前沒有進行中的顯化目標。",
    },
    later: {
      title: "待辦",
      lead: "點「進行中」就能拿回來推進。完成後會走到已完成。",
      items: later,
      empty: "目前沒有待辦的顯化目標。",
    },
    done: {
      title: "已完成",
      lead: "這些願景步驟已經被你做完了。點「進行中」或取消勾選就能再拿回來。",
      items: done,
      empty: "還沒有完成的顯化目標。",
    },
  };
  const bucket = buckets[filter];
  list.innerHTML = `<section class="todo-section"><header class="todo-section__head"><h3>${bucket.title}${bucket.items.length ? `（${bucket.items.length}）` : ""}</h3><p>${bucket.lead}</p></header>${
    bucket.items.length ? renderManifestGroups(bucket.items) : `<div class="empty">${bucket.empty}</div>`
  }</section>`;
}

function setManifestFilter(filter) {
  const next = ["doing", "later", "done"].includes(filter) ? filter : "doing";
  state.manifestFilter = next;
  document.querySelectorAll("#manifestFilters .chip").forEach((item) => {
    const on = item.dataset.manifestFilter === next;
    item.classList.toggle("is-active", on);
    item.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function setManifestStatus(id, status) {
  const allowed = new Set(["doing", "later", "done"]);
  const next = allowed.has(status) ? status : "doing";
  saveManifests(
    getManifests().map((item) => (item.id === id ? { ...item, status: next, updatedAt: new Date().toISOString() } : item))
  );
  setManifestFilter(next);
  renderManifests();
}

function renderSfm() {
  const grid = document.getElementById("sfmGrid");
  if (!grid) return;
  const items = getSfm().filter((item) => state.sfmFilter === "all" || item.type === state.sfmFilter);
  if (!getSfm().length) {
    grid.innerHTML = `<div class="empty"><p class="empty__title">執行力還是空的</p>在復盤結果勾選金句，就會立刻存到這裡，重新整理也不會遺失。</div>`;
    return;
  }
  if (!items.length) {
    grid.innerHTML = `<div class="empty">這個分類目前沒有卡片。</div>`;
    return;
  }
  grid.innerHTML = items
    .map(
      (item) => `
        <article class="sfm-card">
          <p class="sfm-card__type">${escapeHtml(SFM_TYPE_LABEL[item.type] || item.type)}${item.date ? ` · ${escapeHtml(formatDisplayDate(item.date))}` : ""}</p>
          <h3 class="sfm-card__title">${escapeHtml(item.title || "")}</h3>
          <p class="sfm-card__body">${escapeHtml(item.body || "")}</p>
          <div class="sfm-card__actions">
            <button class="btn btn--ghost btn--tiny" data-sfm-copy="${item.id}" type="button">複製</button>
            <button class="btn btn--ghost btn--tiny" data-sfm-delete="${item.id}" type="button">刪除</button>
          </div>
        </article>
      `
    )
    .join("");
}

function firstHighlightSentence(text, max = 84) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/[^。！？!?]+[。！？!?]?/);
  const sentence = String(match ? match[0] : cleaned).trim();
  return excerptText(sentence, max);
}

function historyHighlight(review) {
  const journal = review?.journal && typeof review.journal === "object" ? review.journal : {};
  const insight = normalizeInsight(journal.insight);
  const organize = review?.organize && typeof review.organize === "object" ? review.organize : {};
  const candidates = [
    insight.psychology,
    insight.reflection,
    insight.conclusion,
    insight.title,
    insight.guide?.summary,
    ...(insight.guide?.rounds || []).map((item) => item.answer),
    ...(insight.takeaways || []),
    organize.themeInsight,
    organize.conclusion,
    organize.themeTitle,
    organize.reflection,
    joinJournalAnswers(journal.awareness),
    journal.event,
    review?.rawText,
  ];
  for (const item of candidates) {
    const sentence = firstHighlightSentence(item, 84);
    if (sentence.replace(/[。！？!?…\s]/g, "").length >= 6) return sentence;
  }
  return "這天留下了一筆復盤。";
}

function historyJournalIcon(name) {
  const icons = {
    thanks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>`,
    event: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h12v14H6z"/><path d="M9 9h6M9 13h4"/></svg>`,
    aware: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
    exec: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>`,
    insight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10c-.8.7-1 1.4-1 2H9c0-.6-.2-1.3-1-2A6 6 0 0 1 12 3z"/></svg>`,
    manifest: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.6H21l-5.4 4 2.1 6.4L12 16.6 6.3 20l2.1-6.4L3 9.6h6.8z"/></svg>`,
    note: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v16l-5-2.4L7 20V4z"/></svg>`,
  };
  return icons[name] || icons.note;
}

function historySectionMarkup(title, icon, body, open) {
  return `<section class="history-subcard${open ? " is-open" : ""}">
    <button class="history-subcard__toggle" type="button" data-history-section aria-expanded="${open ? "true" : "false"}">
      <span class="history-subcard__icon" aria-hidden="true">${historyJournalIcon(icon)}</span>
      <h3 class="history-subcard__title">${escapeHtml(title)}</h3>
      <span class="history-subcard__chevron" aria-hidden="true"></span>
    </button>
    <div class="history-subcard__panel"${open ? "" : " inert"} aria-hidden="${open ? "false" : "true"}">
      <div class="history-subcard__body">${body}</div>
    </div>
  </section>`;
}

function historySection(title, icon, blocks, open = false) {
  const body = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean).join("");
  if (!body.trim()) return "";
  return historySectionMarkup(title, icon, body, open);
}

function historySectionsHtml(items) {
  const sections = items
    .map(([title, icon, blocks]) => {
      const body = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean).join("");
      return body.trim() ? { title, icon, body } : null;
    })
    .filter(Boolean);
  return sections.map((item, index) => historySectionMarkup(item.title, item.icon, item.body, index === 0)).join("");
}

function historyBlock(label, bodyHtml) {
  if (!String(bodyHtml || "").trim()) return "";
  return `<div class="history-journal__tile">${
    label ? `<p class="history-journal__label">${escapeHtml(label)}</p>` : ""
  }${bodyHtml}</div>`;
}

function historyTextBlock(label, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return historyBlock(label, `<p class="history-journal__text">${escapeHtml(text)}</p>`);
}

function historyItemsHtml(items) {
  const list = (Array.isArray(items) ? items : [items])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return `<p class="history-journal__text">${escapeHtml(list[0])}</p>`;
  return `<ul class="history-journal__list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function historyExecChecksHtml(journal) {
  const items = normalizeExecCheckItems(journal && journal.executionCheckItems);
  if (items.length) {
    return `<div class="history-exec-cards">${items
      .map(
        (item) => `<article class="history-exec-card">
        <p class="history-exec-card__title">${escapeHtml(item.title)}</p>
        ${item.detail ? `<p class="history-exec-card__lead">${escapeHtml(item.detail)}</p>` : ""}
      </article>`
      )
      .join("")}</div>`;
  }
  return historyItemsHtml(execCheckHistoryLines(journal));
}

function historyListBlock(label, items) {
  const html = historyItemsHtml(items);
  if (!html) return "";
  return historyBlock(label, html);
}

function historyGroup(label, html) {
  if (!String(html || "").trim()) return "";
  return `<div class="history-journal__group">
    ${label ? `<p class="history-journal__group-title">${escapeHtml(label)}</p>` : ""}
    <div class="history-journal__group-body">${html}</div>
  </div>`;
}

function historyQuotesHtml(quotes) {
  const list = (Array.isArray(quotes) ? quotes : []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!list.length) return "";
  return `<div class="history-journal__quotes">${list
    .map((quote) => `<blockquote class="history-journal__quote">${escapeHtml(quote)}</blockquote>`)
    .join("")}</div>`;
}

function historyBodyCheckHtml(journal) {
  const check = normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote);
  const lines = [];
  const moodFlags = (check.mood.flags || []).join("、");
  const bodyFlags = (check.body.flags || []).filter((flag) => flag !== "其他").join("、");
  if (moodFlags || check.mood.reason) {
    lines.push(`心情：${moodFlags || "狀態平穩"}${check.mood.reason ? `｜${check.mood.reason}` : ""}`);
  }
  if (bodyFlags || check.body.other || check.body.reason) {
    const bodyLine = [bodyFlags, check.body.other ? `其他：${check.body.other}` : ""]
      .filter(Boolean)
      .join("、") || "狀態平穩";
    lines.push(`身體：${bodyLine}${check.body.reason ? `｜${check.body.reason}` : ""}`);
  }
  if (check.sleep.duration || check.sleep.quality || check.sleep.energy || check.sleep.reason) {
    lines.push(
      `睡眠：時間 ${check.sleep.duration || "未填"}｜品質 ${check.sleep.quality || "未填"}｜起床精神 ${check.sleep.energy || "未填"}${
        check.sleep.reason ? `｜${check.sleep.reason}` : ""
      }`
    );
  }
  const coach = normalizeBodyCoach(journal.bodyCoach);
  if (coach.analysis) lines.push(coach.analysis);
  (coach.suggestions || []).forEach((item, index) => lines.push(`建議 ${index + 1}：${item}`));
  return historyItemsHtml(lines);
}

function renderHistoryJournal(review) {
  const journal = review?.journal && typeof review.journal === "object" ? review.journal : emptyJournal();
  const insight = normalizeInsight(journal.insight);
  const thanks = historyItemsHtml(thanksItemsFrom(journal.thanksText || journal.thanks));
  const awareFields = (
    journal.awarenessPrompts && journal.awarenessPrompts.length ? journal.awarenessPrompts : AWARENESS_QUESTIONS
  )
    .map((item, index) => {
      const answer = normalizeYesNo((journal.awareness || [])[index]) || String((journal.awareness || [])[index] || "").trim();
      const question = item.question || item.title || item;
      return answer ? historyTextBlock(question, answer) : "";
    })
    .filter(Boolean)
    .join("");
  const quotes = historyQuotesHtml(
    normalizeAwarenessQuotes(journal.awarenessCheckItems).length
      ? normalizeAwarenessQuotes(journal.awarenessCheckItems)
      : journal.awarenessChecks
  );
  const execFields = (() => {
    const prompts = normalizeExecutionPrompts(journal.executionPrompts);
    const answers = Array.isArray(journal.execution) ? journal.execution : [];
    const count = Math.max(prompts.length, answers.length);
    return Array.from({ length: count }, (_, index) => {
      const prompt = prompts[index];
      const answer = String(answers[index] || "").trim();
      const question = prompt?.question || prompt?.title || prompt || `執行力 ${index + 1}`;
      if (answer) return historyTextBlock(question, answer);
      if (prompt?.parked) return historyTextBlock(question, "先放著");
      return "";
    }).filter(Boolean);
  })();
  const insightHtml = (() => {
    const guide = insight.guide || emptyThinkGuide();
    if (guide.rounds.length || guide.summary) {
      const roundBlocks = guide.rounds
        .map((item, index) =>
          historyBlock(
            `第 ${String(index + 1).padStart(2, "0")} 輪`,
            `<p class="history-journal__text">${escapeHtml(item.question)}</p>${
              item.answer ? `<p class="history-journal__note">${escapeHtml(item.answer)}</p>` : ""
            }`
          )
        )
        .join("");
      const closeBlocks = [
        guide.title || insight.title
          ? historyBlock("", `<p class="history-journal__headline">${escapeHtml(guide.title || insight.title)}</p>`)
          : "",
        guide.summary ? historyBlock("總結", `<p class="history-journal__text">${escapeHtml(guide.summary)}</p>`) : "",
        guide.actions.length
          ? historyBlock(
              "兩件具體下一步",
              `<ul class="history-journal__list">${guide.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            )
          : "",
      ].join("");
      return `${roundBlocks}${closeBlocks}`;
    }
    if (!(insight.conclusion || insight.psychology || insight.reflection || insight.suggestions.length || insight.takeaways.length)) {
      return "";
    }
    return `${insight.title ? historyBlock("", `<p class="history-journal__headline">${escapeHtml(insight.title)}</p>`) : ""}${
      insight.psychology || insight.conclusion
        ? historyBlock("① 今天的身心訊號", `<p class="history-journal__text">${escapeHtml(insight.psychology || insight.conclusion)}</p>`)
        : ""
    }${insight.bodyLink ? historyBlock("", `<p class="history-journal__note">${escapeHtml(insight.bodyLink)}</p>`) : ""}${
      insight.reflection
        ? historyBlock("② 客觀檢討與反思", `<p class="history-journal__text">${escapeHtml(insight.reflection)}</p>`)
        : ""
    }${
      insight.suggestions.length
        ? historyBlock(
            "③ 具體突破建議（怎麼做會更好）",
            `<ul class="history-journal__list">${insight.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          )
        : ""
    }${
      insight.takeaways.length
        ? historyBlock(
            "今日核心重點整理",
            `<ul class="history-journal__list">${insight.takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          )
        : ""
    }`;
  })();
  const parts = historySectionsHtml([
    ["① 今日感謝", "thanks", historyBlock("", thanks)],
    [
      "② 今日事件與情緒",
      "event",
      [
        String(journal.event || "").trim()
          ? historyBlock("", `<p class="history-journal__text">${escapeHtml(String(journal.event).trim())}</p>`)
          : "",
        journal.mood ? historyBlock("心情", `<p class="history-journal__mood"><span class="tag">${escapeHtml(journal.mood)}</span></p>`) : "",
      ],
    ],
    [
      "③ 身心覺察與金句",
      "aware",
      [
        historyGroup("身心檢核", historyBlock("", historyBodyCheckHtml(journal))),
        historyGroup("覺察作答", awareFields),
        historyGroup("今日金句", historyBlock("", quotes)),
      ],
    ],
    [
      "④ 執行力行動清單",
      "exec",
      [...execFields, historyTextBlock("明天最小的一步", journal.smallestStep), historyBlock("行動卡點／解法", historyExecChecksHtml(journal))],
    ],
    ["深度思考", "insight", insightHtml],
    [
      "⑤ 顯化力願景",
      "manifest",
      [historyTextBlock("明天想顯化", journal.manifest), historyListBlock("顯化執行目標", journal.manifestChecks)],
    ],
  ]);

  if (!parts) {
    const fallback = String(review?.rawText || "").trim();
    const organize = review?.organize;
    if (organize) return `<div class="history-journal">${historySection("當天紀錄", "note", renderHistoryReport(review), true)}</div>`;
    if (fallback) return `<div class="history-journal">${historySection("當天紀錄", "note", historyTextBlock("", fallback), true)}</div>`;
    return `<div class="history-journal"><p class="history-journal__empty">這天還沒有留下完整復盤內容。</p></div>`;
  }

  return `<div class="history-journal">${parts}</div>`;
}

function renderHistory() {
  const list = document.getElementById("historyList");
  const query = state.historyQuery.trim().toLowerCase();
  const entries = Object.entries(getReviews())
    .filter(([, review]) => reviewIsComplete(review))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .filter(([iso, review]) => {
      if (state.historyTag !== "all") {
        const tags = review.organize?.tags || (review.organize?.themeCategory ? [review.organize.themeCategory] : []);
        if (!tags.includes(state.historyTag)) return false;
      }
      if (!query) return true;
      const hay = `${iso} ${formatDisplayDate(iso)} ${reviewSearchText(review)} ${historyHighlight(review)}`.toLowerCase();
      return hay.includes(query);
    });

  if (!Object.values(getReviews()).some(reviewIsComplete)) {
    list.innerHTML = `<div class="empty"><p class="empty__title">還沒有歷史復盤</p>今天寫下第一篇，就會出現在這裡。</div>`;
    return;
  }
  if (!entries.length) {
    list.innerHTML = `<div class="empty">沒有符合搜尋或標籤的紀錄。</div>`;
    return;
  }

  list.innerHTML = entries
    .map(([iso, review]) => {
      const ai = review.organize;
      const open = state.historyOpen === iso;
      const tags = (ai?.tags || (ai?.themeCategory ? [ai.themeCategory] : []))
        .map((tag) => `<span class="tag tag--ai">${escapeHtml(tag)}</span>`)
        .join("");
      const highlight = historyHighlight(review);
      return `
        <article class="history-card ${open ? "is-open" : ""}" data-history-iso="${escapeHtml(iso)}">
          <button class="history-card__summary" data-history-toggle="${iso}" type="button" aria-expanded="${open ? "true" : "false"}">
            <span class="history-card__date">${formatDisplayDate(iso)}</span>
            <span class="history-card__chevron" aria-hidden="true"></span>
            <span class="history-card__excerpt">${escapeHtml(highlight)}</span>
            ${tags ? `<span class="history-card__tags">${tags}</span>` : ""}
          </button>
          <div class="history-card__panel">
            <div class="history-card__panel-inner">
              ${renderHistoryJournal(review)}
              <div class="history-card__actions">
                <button class="btn btn--ghost btn--tiny" data-open="${iso}" type="button">打開這天</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistoryReport(review) {
  const ai = review.organize;
  if (!ai) return "";
  const quotes = (ai.quotes || []).map((quote) => `<p class="gold-quote">${escapeHtml(quote)}</p>`).join("");
  const thinkHistory = review.thinkHistory || [];
  const think = thinkHistory
    .map((round, index) =>
      renderThoughtUnit(round, index, thinkHistory.length || 5, {
        history: thinkHistory,
        rawText: review.rawText || "",
      })
    )
    .join("");
  const eventHtml = renderBulletList(ai.eventList, ai.event);
  const gratitudeHtml = renderBulletList(ai.gratitudeList, ai.gratitudeNote);
  return `
    <div class="history-report">
      <p><strong>【主標題與評等】【${escapeHtml(ai.themeCategory || "")}】</strong>主題：${escapeHtml(ai.themeTitle || "")} [${starsText(ai.themeStars)}]</p>
      <p><strong>【深度事件拆解】</strong></p>
      ${ai.assumptionGap?.line ? `<p class="gap-card__line">${escapeHtml(ai.assumptionGap.line)}</p>` : ""}
      ${ai.assumptionGap?.mine ? `<p><strong>我以為是</strong><br>${escapeHtml(ai.assumptionGap.mine)}</p>` : ""}
      ${ai.assumptionGap?.theirs ? `<p><strong>他以為是</strong><br>${escapeHtml(ai.assumptionGap.theirs)}</p>` : ""}
      <p><strong>雙方盲點與心態</strong></p>
      ${ai.mindsetList && ai.mindsetList.length ? renderBulletList(ai.mindsetList) : renderBulletList(ai.reactionList, ai.othersReaction)}
      <p><strong>事件經過</strong></p>
      ${eventHtml}
      <p><strong>事後反思</strong><br>${escapeHtml(ai.reflection || "")}</p>
      <p><strong>【金句與感恩清單】今日金句</strong></p>
      ${quotes}
      <p><strong>感恩清單</strong></p>
      ${gratitudeHtml}
      ${review.gratitude ? `<p><strong>你補的感謝</strong><br>${escapeHtml(review.gratitude)}</p>` : ""}
      <p><strong>【下一步引導 / 深度思考】</strong></p>
      ${Array.isArray(ai.nextScripts) && ai.nextScripts.length ? renderBulletList(ai.nextScripts) : ""}
      ${ai.howNext ? `<p>${escapeHtml(ai.howNext)}</p>` : ""}
      ${think ? `${think}` : ""}
      <p><strong>【原始輸入紀錄】</strong></p>
      <p class="raw-record">${escapeHtml(review.rawText || "")}</p>
    </div>
  `;
}

/* =============================================================================
 * 提醒
 * =========================================================================== */

function reminderLabel() {
  const reminder = loadJson(STORAGE_KEYS.reminder, null);
  if (reminder?.enabled && reminder.time) {
    return `🔔 每晚 ${reminder.time}`;
  }
  return "🔔 開啟每日覺察提醒";
}

function initReminder() {
  document.getElementById("reminderCta").textContent = reminderLabel();
  const reminder = loadJson(STORAGE_KEYS.reminder, null);
  if (reminder?.time) document.getElementById("reminderTime").value = reminder.time;
}

async function saveReminder(enable) {
  const time = document.getElementById("reminderTime").value || "21:30";
  if (enable && "Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }
  saveJson(STORAGE_KEYS.reminder, { enabled: enable, time });
  initReminder();
  showToast(enable ? `已設定每天 ${time} 提醒復盤` : "已關閉復盤提醒");
}

function tickReminder() {
  const reminder = loadJson(STORAGE_KEYS.reminder, null);
  if (!reminder?.enabled || !reminder.time) return;
  const now = new Date();
  const [h, m] = reminder.time.split(":").map(Number);
  if (now.getHours() !== h || now.getMinutes() !== m) return;
  const todayIso = toInputDate(now);
  if (state.remindedDate === todayIso) return;
  const review = getReview(todayIso);
  if (review?.completedAt) return;
  state.remindedDate = todayIso;
  showToast("現在是你設定的復盤時間。");
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("日精進", { body: "該寫今天的復盤了。" });
    } catch {
      /* ignore */
    }
  }
}

/* =============================================================================
 * 事件
 * =========================================================================== */

function bindEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest ? event.target : event.target.parentElement;
    if (!target || !target.closest) return;
    if (target.closest("#btnGoogleLogin") || target.closest("[data-google-login]")) {
      event.preventDefault();
      signInWithGoogle();
      return;
    }
    if (target.closest("#btnSignOut") || target.closest("#btnGoogleLogout")) {
      event.preventDefault();
      signOutUser();
      return;
    }
    if (target.closest("#btnNewebPay") || target.closest(".auth-pay:not(:disabled)") || target.closest("[data-open-pricing]")) {
      console.log("Pricing modal opened");
      event.preventDefault();
      openPricingModal();
      return;
    }
  });

  const toggle = navToggleEl();
  if (toggle) toggle.addEventListener("click", toggleMenu);
  const scrim = document.getElementById("scrim");
  if (scrim) scrim.addEventListener("click", () => setSidebarOpen(false));

  document.querySelectorAll(".side-item").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (!btn.dataset.page) return;
      switchPage(btn.dataset.page);
    });
  });
  document.getElementById("topGuideBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    switchPage("guide");
  });
  document.getElementById("page-guide")?.addEventListener("click", (event) => {
    const start = event.target.closest(".js-guide-start");
    if (start) {
      event.preventDefault();
      switchPage("today");
      document.getElementById("view")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const jump = event.target.closest("[data-guide-jump]");
    if (!jump) return;
    event.preventDefault();
    document.getElementById(jump.dataset.guideJump)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("btnStartTour")?.addEventListener("click", (event) => {
    event.preventDefault();
    startOnboardingTour();
  });
  document.getElementById("topPlanBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    openPricingModal();
  });
  document.getElementById("pricingClose")?.addEventListener("click", (event) => {
    event.preventDefault();
    closePricingModal();
  });
  document.getElementById("pricingModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closePricingModal();
  });

  const promptChips = document.getElementById("promptChips");
  if (promptChips) {
    promptChips.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-prompt]");
      if (chip) insertPrompt(chip.dataset.prompt);
    });
  }

  document.getElementById("reviewDate")?.addEventListener("change", () => {
    loadReviewForDate(currentIso());
    updateStats();
  });

  document.getElementById("journalDateBtn")?.addEventListener("click", () => {
    const input = document.getElementById("reviewDate");
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  });

  document.getElementById("clearReview")?.addEventListener("click", clearReview);
  const organizeBtn = document.getElementById("btnOrganize");
  if (organizeBtn) {
    organizeBtn.disabled = false;
    organizeBtn.addEventListener("click", runOrganize);
  }
  document.getElementById("btnCompleteToday")?.addEventListener("click", completeToday);
  document.getElementById("btnSaveDraft")?.addEventListener("click", saveJournalDraft);
  document.getElementById("btnAwarePrompts")?.addEventListener("click", () => {
    setJournalFoldOpen("section-aware", true);
    Promise.resolve(generateCorePrompts({ scope: "awareness" })).catch((error) => {
      setCorePromptsLoading(false);
      showToast(`覺察題生成失敗：${formatApiError(error)}`);
    });
  });
  document.getElementById("btnExecPrompts")?.addEventListener("click", () => {
    setJournalFoldOpen("section-exec", true);
    Promise.resolve(generateCorePrompts({ scope: "execution" })).catch((error) => {
      setCorePromptsLoading(false);
      showToast(`執行題生成失敗：${formatApiError(error)}`);
    });
  });
  document.getElementById("btnAwareAi")?.addEventListener("click", () => generateJournalChecklist("awareness"));
  document.getElementById("btnExecAi")?.addEventListener("click", () => generateJournalChecklist("execution"));
  document.getElementById("btnManifestAi")?.addEventListener("click", () => generateJournalChecklist("manifest"));
  document.getElementById("btnInsightAi")?.addEventListener("click", () => generateJournalInsight());
  document.getElementById("btnQuickInsight")?.addEventListener("click", () => generateJournalInsight());
  document.getElementById("btnBodyCoach")?.addEventListener("click", () => generateBodyCoach());
  document.querySelector(".journal-mode-block")?.addEventListener("click", (event) => {
    const fold = event.target.closest("[data-mode-guide-toggle]");
    if (fold) {
      event.preventDefault();
      toggleModeGuide();
      return;
    }
    const btn = event.target.closest("[data-journal-mode]");
    if (!btn) return;
    applyJournalMode(btn.dataset.journalMode);
  });
  document.getElementById("quickModules")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-quick-mod]");
    if (!btn) return;
    toggleQuickModule(btn.dataset.quickMod);
  });
  document.getElementById("btnDeepMore")?.addEventListener("click", expandDeepThemes);
  document.getElementById("section-deep")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-deepen]");
    if (!btn) return;
    generateDeepFollow(btn.dataset.deepen);
  });

  document.getElementById("moodRow")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".mood-btn");
    if (!btn) return;
    const on = !btn.classList.contains("is-on");
    document.querySelectorAll("#moodRow .mood-btn").forEach((item) => item.classList.toggle("is-on", on && item === btn));
    refreshJournalChecklists();
    const journal = collectJournal();
    persistJournalQuietly();
    syncCorePromptGate();
    maybeAutoGenerateInsight(journal);
    maybeAutoGeneratePrompts(journal);
    maybeAutoGenerateCorePrompts(journal);
  });

  document.getElementById("section-body")?.addEventListener("click", (event) => {
    const sleep = event.target.closest(".sleep-chip");
    if (sleep) {
      const field = sleep.dataset.sleepField;
      const turningOn = !sleep.classList.contains("is-on");
      document.querySelectorAll(`.sleep-chip[data-sleep-field="${field}"]`).forEach((btn) => {
        btn.classList.toggle("is-on", turningOn && btn === sleep);
      });
    } else {
      const btn = event.target.closest(".body-flag-btn");
      if (!btn) return;
      if (btn.dataset.bodyGroup === "mood") {
        const turningOn = !btn.classList.contains("is-on");
        document.querySelectorAll('.body-flag-btn[data-body-group="mood"]').forEach((item) => {
          item.classList.toggle("is-on", turningOn && item === btn);
        });
      } else {
        btn.classList.toggle("is-on");
      }
    }
    syncBodyReasonVisibility();
    persistJournalQuietly();
    refreshJournalChecklists();
    const journal = collectJournal();
    maybeAutoGenerateInsight(journal);
    maybeAutoGenerateBodyCoach(journal);
    maybeAutoGeneratePrompts(journal);
    maybeAutoGenerateCorePrompts(journal);
  });

  document.getElementById("page-today")?.addEventListener("input", (event) => {
    const id = event.target && event.target.id;
    if (/^thanksText$|^thanks\d+$|^(aware|exec)\d$|^execNext$|^eventText$|^bodyNote$|^bodyOtherNote$|^bodyMoodReason$|^bodyBodyReason$|^bodySleepReason$|^manifestVision$/.test(id || "")) {
      if (/^thanksText$|^thanks\d+$|^(aware|exec)\d$|^execNext$|^eventText$|^bodyOtherNote$|^body(Mood|Body|Sleep)Reason$|^manifestVision$/.test(id || "")) persistJournalQuietly();
      scheduleJournalChecklists();
    }
  });

  document.getElementById("page-today")?.addEventListener("change", (event) => {
    if (event.target && event.target.matches("#awareChecks input, #execChecks input, #manifestChecks input")) {
      const execInput = event.target.matches("#execChecks input") ? event.target : null;
      const execPayload = execInput
        ? {
            checked: execInput.checked,
            title: String(execInput.value || execInput.closest(".exec-check")?.dataset.title || "").trim(),
            detail: String(execInput.closest(".exec-check")?.dataset.detail || "").trim(),
          }
        : null;
      persistJournalQuietly();
      if (execPayload) {
        const journal = collectJournal();
        renderExecChecklist(journal.executionCheckItems, journal.executionChecks);
        syncExecCheckToSidebar(execPayload);
      }
      if (event.target.matches("#manifestChecks input")) {
        syncManifestCheckToSidebar({
          checked: event.target.checked,
          title: String(event.target.value || "").trim(),
        });
      }
      if (event.target.matches("#awareChecks input") && event.target.checked) {
        const quote = String(event.target.value || "").trim();
        if (quote) {
          addInsight({
            key: `insight:${currentIso()}:${quote}`,
            title: quote,
            date: currentIso(),
            source: "今日復盤",
          });
          showToast("已收藏到覺察力。");
        }
      }
    }
  });

  document.getElementById("page-today")?.addEventListener("click", (event) => {
    const foldBtn = event.target.closest("[data-journal-fold]");
    if (foldBtn) {
      event.preventDefault();
      const root = foldBtn.closest(".journal-fold");
      if (root?.id) toggleJournalFold(root.id);
      return;
    }
    const nextThink = event.target.closest("[data-think-guide-next]");
    if (nextThink) {
      event.preventDefault();
      submitThinkGuideRound();
      return;
    }
    const answerBtn = event.target.closest("[data-aware-answer]");
    if (answerBtn) {
      event.preventDefault();
      const item = answerBtn.closest(".aware-quiz__item");
      if (!item) return;
      const value = normalizeYesNo(answerBtn.dataset.awareAnswer);
      item.dataset.answer = value;
      item.querySelectorAll(".aware-quiz__opt").forEach((btn) => {
        btn.classList.toggle("is-on", btn === answerBtn);
      });
      persistJournalQuietly();
      const journal = collectJournal();
      renderAwareQuote(journal.awarenessCheckItems, journal.awarenessChecks);
      return;
    }
    const copyBtn = event.target.closest("[data-copy-aware-quote]");
    if (!copyBtn) return;
    event.preventDefault();
    const quote = copyBtn.closest(".aware-quote")?.dataset.quote || "";
    if (!quote) return;
    navigator.clipboard.writeText(quote).then(
      () => showToast("這句核心覺察已複製。"),
      () => showToast("複製失敗，請手動選取文字。")
    );
  });

  document.getElementById("aiStage").addEventListener("click", (event) => {
    const copyQuote = event.target.closest("[data-copy-quote]");
    if (copyQuote) {
      event.preventDefault();
      const quote = state.organize?.quotes?.[Number(copyQuote.dataset.copyQuote)] || "";
      if (!quote) return;
      navigator.clipboard.writeText(quote).then(
        () => showToast("金句已複製，可以直接拿去發文。"),
        () => showToast("複製失敗，請手動選取文字。")
      );
      return;
    }
    const thinkBtn = event.target.closest("#btnThink, #btnThinkSubmit");
    if (thinkBtn) {
      event.preventDefault();
      const reply = document.getElementById("thinkReply")?.value || "";
      runThink(thinkBtn.id === "btnThinkSubmit" ? reply : "");
      return;
    }
    if (event.target.closest("#btnComplete")) {
      event.preventDefault();
      completeToday();
    }
  });

  document.getElementById("aiStage").addEventListener("change", (event) => {
    const quote = event.target.dataset.quote;
    const sfm = event.target.dataset.sfm;
    const action = event.target.dataset.action;
    if (quote) {
      state.selectedQuotes = event.target.checked
        ? [...new Set([...state.selectedQuotes, quote])]
        : state.selectedQuotes.filter((item) => item !== quote);
      const index = Number(String(quote).split(":")[1]);
      if (Number.isFinite(index)) syncGuideToSfm("quote", index, event.target.checked);
    }
    if (sfm) {
      state.selectedSfm = event.target.checked
        ? [...new Set([...state.selectedSfm, sfm])]
        : state.selectedSfm.filter((item) => item !== sfm);
      const index = Number(String(sfm).split(":")[1]);
      if (Number.isFinite(index)) syncGuideToSfm("sfm", index, event.target.checked);
    }
    if (action) {
      state.selectedThinkActions = event.target.checked
        ? [...new Set([...state.selectedThinkActions, action])]
        : state.selectedThinkActions.filter((item) => item !== action);
      syncGuideToNextSteps(event.target, event.target.checked);
    }
    const practice = event.target.dataset.practice;
    if (practice) {
      state.selectedPractice = event.target.checked
        ? [...new Set([...(state.selectedPractice || []), practice])]
        : (state.selectedPractice || []).filter((item) => item !== practice);
      syncGuideToNextSteps(event.target, event.target.checked);
    }
    if (event.target.id === "gratitudeInput") state.gratitude = event.target.value;
  });

  document.getElementById("aiStage").addEventListener("input", (event) => {
    if (event.target.id === "gratitudeInput") state.gratitude = event.target.value;
  });

  document.querySelectorAll("[data-report]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.reportType = btn.dataset.report;
      document.querySelectorAll("[data-report]").forEach((tab) => {
        const active = tab === btn;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      renderReport();
    });
  });

  document.getElementById("reportContent")?.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-archive]");
    const printBtn = event.target.closest("[data-print-archive]");
    if (open) {
      event.preventDefault();
      openArchivedMonth(open.dataset.openArchive);
    }
    if (printBtn) {
      event.preventDefault();
      openArchivedMonth(printBtn.dataset.printArchive, { print: true });
    }
  });
  document.getElementById("reportArchivePrint")?.addEventListener("click", () => printArchivedReport());
  document.getElementById("reportArchiveClose")?.addEventListener("click", () => {
    const modal = document.getElementById("reportArchiveModal");
    destroyReportCharts("archive");
    if (modal && typeof modal.close === "function") modal.close();
    else if (modal) modal.removeAttribute("open");
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-report"));

  document.getElementById("taskForm")?.addEventListener("submit", addTask);
  document.getElementById("taskFilters")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter]");
    if (!chip) return;
    setTaskFilter(chip.dataset.filter);
    renderTasks();
  });
  document.getElementById("page-sfm")?.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-task-toggle]");
    if (!toggle) return;
    setTaskDone(toggle.dataset.taskToggle, toggle.checked);
  });
  document.getElementById("page-sfm")?.addEventListener("click", (event) => {
    const statusBtn = event.target.closest("[data-task-status]");
    const deleteBtn = event.target.closest("[data-task-delete]");
    if (statusBtn) {
      event.preventDefault();
      const to = statusBtn.dataset.to;
      setTaskStatus(statusBtn.dataset.taskStatus, to);
      showToast(statusMoveToast(to));
      return;
    }
    if (deleteBtn) {
      saveTasks(getTasks().filter((task) => task.id !== deleteBtn.dataset.taskDelete));
      renderTasks();
      showToast("已刪除這項行動。");
    }
  });

  document.getElementById("insightFilters")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-insight-filter]");
    if (!chip) return;
    state.insightFilter = chip.dataset.insightFilter;
    document.querySelectorAll("#insightFilters .chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    renderInsights();
  });
  document.getElementById("insightList")?.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest("[data-insight-delete]");
    if (!deleteBtn) return;
    saveInsights(getInsights().filter((item) => item.id !== deleteBtn.dataset.insightDelete));
    renderInsights();
    showToast("已刪除這則洞察。");
  });

  document.getElementById("manifestFilters")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-manifest-filter]");
    if (!chip) return;
    setManifestFilter(chip.dataset.manifestFilter);
    renderManifests();
  });
  document.getElementById("page-manifest")?.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-manifest-toggle]");
    if (!toggle) return;
    setManifestStatus(toggle.dataset.manifestToggle, toggle.checked ? "done" : "doing");
  });
  document.getElementById("page-manifest")?.addEventListener("click", (event) => {
    const statusBtn = event.target.closest("[data-manifest-status]");
    const deleteBtn = event.target.closest("[data-manifest-delete]");
    if (statusBtn) {
      event.preventDefault();
      const to = statusBtn.dataset.to;
      setManifestStatus(statusBtn.dataset.manifestStatus, to);
      showToast(statusMoveToast(to));
      return;
    }
    if (deleteBtn) {
      saveManifests(getManifests().filter((item) => item.id !== deleteBtn.dataset.manifestDelete));
      renderManifests();
      showToast("已刪除這項顯化目標。");
    }
  });

  document.getElementById("sfmFilters")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-sfm]");
    if (!chip) return;
    state.sfmFilter = chip.dataset.sfm;
    document.querySelectorAll("#sfmFilters .chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    renderSfm();
  });
  document.getElementById("sfmGrid")?.addEventListener("click", async (event) => {
    const copyBtn = event.target.closest("[data-sfm-copy]");
    const deleteBtn = event.target.closest("[data-sfm-delete]");
    if (copyBtn) {
      const item = getSfm().find((entry) => entry.id === copyBtn.dataset.sfmCopy);
      if (!item) return;
      try {
        await navigator.clipboard.writeText(item.body);
        showToast("已複製到剪貼簿。");
      } catch {
        showToast("複製失敗，請手動選取文字。");
      }
    }
    if (deleteBtn) {
      saveSfm(getSfm().filter((item) => item.id !== deleteBtn.dataset.sfmDelete));
      renderSfm();
      showToast("已從『執行力』移除。");
    }
  });

  document.getElementById("historySearch").addEventListener("input", (event) => {
    state.historyQuery = event.target.value;
    renderHistory();
  });
  document.getElementById("historyTags").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-tag]");
    if (!chip) return;
    state.historyTag = chip.dataset.tag;
    document.querySelectorAll("#historyTags .chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    renderHistory();
  });
  document.getElementById("historyList").addEventListener("click", (event) => {
    const open = event.target.closest("[data-open]");
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      document.getElementById("reviewDate").value = open.dataset.open;
      loadReviewForDate(open.dataset.open);
      switchPage("today");
      return;
    }
    const sectionToggle = event.target.closest("[data-history-section]");
    if (sectionToggle) {
      event.preventDefault();
      event.stopPropagation();
      const card = sectionToggle.closest(".history-subcard");
      if (!card) return;
      const next = !card.classList.contains("is-open");
      card.classList.toggle("is-open", next);
      sectionToggle.setAttribute("aria-expanded", next ? "true" : "false");
      const panel = card.querySelector(".history-subcard__panel");
      if (panel) {
        panel.inert = !next;
        panel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      return;
    }
    const toggle = event.target.closest("[data-history-toggle]");
    if (!toggle) return;
    const iso = toggle.dataset.historyToggle;
    const nextOpen = state.historyOpen === iso ? "" : iso;
    state.historyOpen = nextOpen;
    const list = document.getElementById("historyList");
    list.querySelectorAll(".history-card").forEach((card) => {
      const isOpen = card.dataset.historyIso === nextOpen;
      card.classList.toggle("is-open", isOpen);
      const summary = card.querySelector("[data-history-toggle]");
      if (summary) summary.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });

  const topAuth = document.getElementById("topAuthBtn");
  if (topAuth) {
    topAuth.addEventListener("click", () => {
      if (state.user) {
        signOutUser();
        return;
      }
      if (isMobile()) setSidebarOpen(true);
      signInWithGoogle();
    });
  }

  document.getElementById("view")?.addEventListener(
    "click",
    (event) => {
      if (!isAccessLocked()) return;
      if (event.target.closest && event.target.closest("[data-newebpay], #paywall, [data-google-login]")) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
  bindSubscribeButton();

  document.getElementById("reminderCta").addEventListener("click", () => {
    document.getElementById("reminderModal").showModal();
  });
  document.getElementById("reminderForm").addEventListener("submit", (event) => {
    const enable = event.submitter && event.submitter.id === "enableReminder";
    saveReminder(Boolean(enable));
  });


  window.addEventListener("resize", () => {
    if (!isMobile()) setSidebarOpen(false);
  });
}

function initSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const finish = () => {
    if (!splash.parentNode) return;
    splash.classList.add("is-gone");
    splash.setAttribute("aria-hidden", "true");
    splash.remove();
  };
  splash.addEventListener("animationend", (event) => {
    if (event.target === splash && event.animationName === "splashOut") finish();
  });
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(finish, reduced ? 1000 : 2400);
}

function init() {
  try {
    initSplash();
    applyAccessLock();
    bindEvents();
  } catch {
    const btn = document.getElementById("btnOrganize");
    if (btn) btn.onclick = runOrganize;
  }
  try {
    document.getElementById("headerDate").textContent = formatHeaderDate(new Date());
    document.getElementById("reviewDate").value = toInputDate(new Date());
    updateJournalDateLabel(toInputDate(new Date()));
    try {
      const storedMode = localStorage.getItem(STORAGE_KEYS.journalMode);
      applyJournalMode(storedMode === "quick" ? "quick" : "deep", { silent: true });
    } catch {
      applyJournalMode("deep", { silent: true });
    }
    setModeGuideOpen(false);
    applyJournalFolds();
    const closed =
      localStorage.getItem("rv_sidebar") === "closed" || localStorage.getItem(STORAGE_KEYS.sidebar) === "1";
    if (closed && !isMobile()) {
      document.body.classList.add("nav-closed");
      const toggle = navToggleEl();
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
    renderPromptChips();
    loadReviewForDate(currentIso());
    backfillLibrariesFromReviews();
    updateStats();
    initReminder();
    setInterval(tickReminder, 20000);
    probeReviewApi();
    applyAccessLock();
    refreshAuth();
    handleAuthQuery();
    setInterval(() => {
      if (state.user) applyAccessLock();
    }, 30000);
  } catch {
    /* 其餘初始化失敗也不擋「開始整理」 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
