/* =============================================================================
 * 日精進 — 開箱即用。開始整理先出本地復盤，再經 /api/review 用伺服器金鑰加深。
 * 前端不存放、不收集 API Key。金鑰只存在 Vercel 環境變數。
 * =========================================================================== */

const STORAGE_KEYS = {
  reviews: "nichi.reviews",
  tasks: "nichi.tasks",
  sfm: "nichi.sfm",
  reminder: "nichi.reminder",
  sidebar: "nichi.sidebarCollapsed",
  reports: "nichi.reports",
};

const REVIEW_API = "/api/review";
const NEWEBPAY_EPG_URL = "https://core.newebpay.com/EPG/HTC109030010100/QLBIYc";

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
  later: "先放著",
  done: "已完成",
};

const REPORT_STOP_WORDS = new Set([
  "的", "了", "是", "在", "我", "你", "他", "她", "它", "也", "都", "就", "而", "及", "與", "或",
  "但", "並", "被", "把", "讓", "從", "到", "對", "為", "以", "和", "跟", "很", "更", "最", "還",
  "再", "又", "才", "已", "會", "能", "要", "想", "有", "沒", "不", "這", "那", "此", "其", "之",
  "等", "著", "過", "來", "去", "做", "說", "看", "寫", "今天", "昨天", "明天", "因為", "所以",
  "但是", "如果", "雖然", "然後", "以及", "一個", "這個", "那個", "自己", "什麼", "怎麼", "可以",
  "真的", "已經", "還是", "還有", "比較", "一些", "一樣", "時候", "東西", "事情", "感覺", "覺得",
  "開始", "繼續", "完成", "復盤", "我們", "你們", "他們", "發生", "地方", "調整", "下一步", "最小",
]);

const state = {
  page: "today",
  reportType: "week",
  taskFilter: "all",
  sfmFilter: "all",
  historyQuery: "",
  historyTag: "all",
  historyOpen: "",
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
  recognition: null,
  listening: false,
  speechTarget: "",
  journalHydrating: false,
  journalCheckTimer: 0,
  journalMeta: {
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    insightSig: "",
  },
  checklistBusy: { awareness: false, execution: false },
  checklistToken: { awareness: 0, execution: 0 },
  insightBusy: false,
  insightToken: 0,
  journalInsight: null,
  deepFollowBusy: [false, false, false, false],
  deepFollowToken: [0, 0, 0, 0],
  organizeSource: "",
  apiConfigured: null,
  user: null,
  accessToken: "",
  authConfigured: false,
  payConfigured: false,
  membership: null,
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
    [STORAGE_KEYS.reviews, STORAGE_KEYS.tasks, STORAGE_KEYS.sfm, STORAGE_KEYS.reports].includes(key)
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

function taskTitleFromParts(label, detail) {
  const title = String(label || "").trim();
  const body = String(detail || "").trim();
  if (title && body) return `${title}：${body}`;
  return title || body;
}

function findTaskBySourceKey(key) {
  if (!key) return null;
  return getTasks().find((task) => task.sourceKey === key) || null;
}

function addTaskFromGuide({ key, label, detail }) {
  const title = taskTitleFromParts(label, detail);
  if (!title) return { added: false };
  const tasks = getTasks();
  if (tasks.some((task) => task.sourceKey === key || task.title === title)) {
    return { added: false, exists: true };
  }
  tasks.unshift({
    id: uid(),
    title,
    status: "doing",
    source: "今日復盤",
    sourceKey: key || "",
    createdAt: new Date().toISOString(),
  });
  saveTasks(tasks);
  try {
    renderTasks();
  } catch {
    /* 下一步頁面還沒畫也沒關係 */
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

function syncGuideToNextSteps(input, checked) {
  const key = input.dataset.practice || input.dataset.action || "";
  const label = input.dataset.label || "";
  const detail = input.dataset.detail || "";
  if (checked) {
    const result = addTaskFromGuide({ key, label, detail });
    if (result.added) showToast("已加入『覺察力』");
    else if (result.exists) showToast("這項已在『覺察力』");
    return;
  }
  const result = removeTaskFromGuide(key);
  if (result.removed) showToast("已從『覺察力』拿掉");
  else if (result.kept) showToast("這項已在清單裡，改由你手動管理");
}

function getSfm() {
  const saved = loadJson(STORAGE_KEYS.sfm, []);
  return Array.isArray(saved) ? saved : [];
}

function saveSfm(items) {
  saveJson(STORAGE_KEYS.sfm, items);
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
  if (start === -1 || end === -1) throw new Error("AI 回傳不是 JSON");
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
  if (error?.name === "AbortError" || /請求逾時|逾時/.test(message)) return "雲端通道逾時。請確認 Vercel 已 Redeploy，且 OPENAI_API_KEY 設在 Production。";
  if (/file:|本機 HTML/.test(message)) return message;
  if (/401|請先使用 Google|未登入|未授權/i.test(message)) {
    return "請先登入，才能使用雲端 AI 與同步備份。";
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
  if (!response.ok || payload.ok === false) {
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
    showToast("本地草稿已出。登入後才能使用雲端 AI 與同步備份。");
    return;
  }
  showToast("正在呼叫雲端 AI…");
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
    showToast("雲端 AI 復盤已套用。");
  } catch (error) {
    const reason = formatApiError(error);
    console.error("[日精進 API] 雲端呼叫失敗，畫面維持本地結果。真正原因：", reason, error);
    showToast(`雲端 AI 失敗：${reason}`);
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

function extractKeywords(texts, limit = 8) {
  const counts = new Map();
  texts.forEach((text) => {
    const chunks = String(text || "").match(/[\u4e00-\u9fff]{2,6}|[A-Za-z]{3,}/g) || [];
    chunks.forEach((word) => {
      if (REPORT_STOP_WORDS.has(word)) return;
      counts.set(word, (counts.get(word) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= 2 || counts.size <= 8)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
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

function buildReport(type) {
  const { fromIso, toIso, days, label } = rangeFor(type);
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
  const keywords = extractKeywords(entries.map((item) => item.text));

  return { label, fromIso, toIso, days, filledDays, totalChars, keywords, entries };
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
  return payload && payload.data && typeof payload.data === "object" ? payload.data : null;
}

async function generateCloudReport(type, fromIso, toIso, period) {
  if (!state.user) return null;
  const reviews = compactReviewsForRange(fromIso, toIso);
  if (!reviews.length) return null;
  const response = await fetchWithTimeout(
    `${location.origin}/api/generate-report`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, period, fromIso, toIso, reviews }),
    },
    28000
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload.data || null;
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
        reports: bundle.reports,
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

    saveJson(STORAGE_KEYS.reports, { ...getStoredReports(), ...(cloud.reports || {}) }, { silent: true });
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
    if (state.page === "next") renderTasks();
    if (state.page === "sfm") renderSfm();
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
    top.textContent = user ? user.name || user.email || "已登入" : "登入";
    top.title = user ? "登出" : "使用 Google 帳號登入";
  }
  if (!side) return;
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
      <p class="auth-hint">登入後會讀取你在雲端的復盤與個人紀錄。</p>
    `;
    if (lastAuthError) setAuthError(lastAuthError);
    return;
  }
  const initial = escapeHtml((user.name || user.email || "我").slice(0, 1));
  const avatar = user.picture
    ? `<img src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="auth-avatar">${initial}</span>`;
  const membership = state.membership || {};
  const status = membership.status || "";
  const entitled = Boolean(membership.entitled || membership.paid);
  const payBtn = status === "active"
    ? `<button class="auth-pay is-paid" type="button" disabled><span>已付款</span></button>`
    : `<a class="auth-pay" id="btnNewebPay" href="${NEWEBPAY_EPG_URL}"><span>${status === "trialing" || status === "pending" ? "一次付清 NT$399" : "付款以繼續 NT$399"}</span></a>`;
  const trialHint = membership.trialEndsAt && status === "trialing"
    ? `<p class="auth-hint">試用至 ${escapeHtml(formatTrialDate(membership.trialEndsAt))}</p>`
    : entitled && status === "active"
      ? `<p class="auth-hint">一次付清已完成。</p>`
      : status === "expired" || status === "cancelled" || status === "past_due"
        ? `<p class="auth-hint">試用已結束，付款 NT$399 後可繼續使用雲端 AI。</p>`
        : `<p class="auth-hint">登入後會讀取你在雲端的復盤與個人紀錄。</p>`;
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

function bindSubscribeButton() {
  const btn = document.getElementById("btnNewebPay");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", onSubscribeClick);
}

function onSubscribeClick(event) {
  console.log("Subscribe button clicked");
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  startNewebPay();
}

function startNewebPay() {
  window.location.assign(NEWEBPAY_EPG_URL);
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
  if (!reviews && !tasks && !sfm && !reports) return null;
  return {
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    reports: reports && typeof reports === "object" && !Array.isArray(reports) ? reports : {},
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
    renderAuth();
    if (state.user) {
      await pullCloudData();
      await pushCloudData();
    }
  } catch {
    renderAuth();
  }
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
    if (auth === "ok") showToast("已登入，資料會跟著你的帳號備份。");
    if (auth === "out") showToast("已登出。本機草稿仍在這台裝置上。");
    if (auth === "error" || oauthError || storedAuthError) {
      const raw = storedAuthError || oauthError || params.get("reason") || "請再試一次";
      const message = translateAuthError(raw);
      setAuthError(message);
      showToast(`登入失敗：${message}`);
    }
    if (pay === "ok") showToast("付款已送出。會員狀態會在藍新通知後更新。");
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

function renderAiReportBlock(ai, status) {
  if (status === "loading") {
    return `
      <article class="report-card report-card--ai">
        <h3>綜合報告</h3>
        <p class="report-empty">正在把這段期間的復盤聚合成洞察、軌跡與規劃…</p>
      </article>
    `;
  }
  if (status === "error") {
    return `
      <article class="report-card report-card--ai">
        <h3>綜合報告</h3>
        <p class="report-empty">${escapeHtml(ai || "雲端報告暫時不可用。本地摘要仍在上面。")}</p>
      </article>
    `;
  }
  if (!ai) return "";
  const list = (items) =>
    Array.isArray(items) && items.length
      ? `<ul class="review-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="report-empty">這一段還沒有足夠的復盤可以聚合。</p>`;
  const rangeNote =
    ai.fromIso && ai.toIso
      ? `${formatDisplayDate(ai.fromIso)} — ${formatDisplayDate(ai.toIso)}`
      : "";
  return `
    <article class="report-card report-card--ai">
      <h3>${escapeHtml(ai.title || "綜合報告")}</h3>
      ${rangeNote ? `<p class="report-range">${escapeHtml(rangeNote)}</p>` : ""}
      ${ai.summary ? `<p class="rv-card__conclusion">${escapeHtml(ai.summary)}</p>` : ""}
      <p class="sfm-hint">${ai.generatedAt ? `生成於 ${escapeHtml(String(ai.generatedAt).replace("T", " ").slice(0, 16))}` : "雲端 AI 聚合"}</p>
    </article>
    <article class="report-card">
      <h3>本${ai.type === "month" ? "月" : "週"}關鍵洞察</h3>
      ${list(ai.insights)}
    </article>
    <article class="report-card">
      <h3>進步軌跡</h3>
      ${list(ai.progress)}
    </article>
    <article class="report-card">
      <h3>${ai.type === "month" ? "下月" : "下週"}規劃</h3>
      ${list(ai.nextPlan)}
    </article>
  `;
}

async function hydrateAiReport(type, local, token) {
  const root = document.getElementById("reportAi");
  if (!root) return;
  const period = type === "month" ? local.fromIso.slice(0, 7) : local.fromIso;
  const cached = readCachedReport(type, period) || readLatestCachedReport(type);
  if (cached) root.innerHTML = renderAiReportBlock(cached);
  else root.innerHTML = renderAiReportBlock(null, "loading");

  try {
    let report = await fetchStoredCloudReport(type, period);
    if (!report) report = await fetchStoredCloudReport(type, period, true);
    if (!report && local.filledDays) {
      report = await generateCloudReport(type, local.fromIso, local.toIso, period);
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

function switchPage(page) {
  state.page = page;
  document.querySelectorAll(".side-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.page === page);
  });
  document.querySelectorAll(".page[data-page]").forEach((section) => {
    const active = section.dataset.page === page;
    section.classList.toggle("is-active", active);
    section.hidden = !active;
  });
  if (isMobile()) setSidebarOpen(false);
  if (page === "report") renderReport();
  if (page === "next") renderTasks();
  if (page === "sfm") renderSfm();
  if (page === "history") renderHistory();
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

function emptyJournal() {
  return {
    thanks: ["", "", ""],
    event: "",
    mood: "",
    bodyTags: [],
    bodyNote: "",
    awareness: ["", "", ""],
    awarenessChecks: [],
    awarenessCheckItems: [],
    execution: ["", "", ""],
    executionChecks: [],
    executionCheckItems: [],
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    insight: emptyInsight(),
    deep: emptyDeep(),
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

function emptyInsight() {
  return { title: "", conclusion: "", logic: "", bodyLink: "", sig: "" };
}

function normalizeInsight(insight) {
  const data = insight && typeof insight === "object" ? insight : {};
  return {
    title: String(data.title || "").trim(),
    conclusion: String(data.conclusion || "").trim(),
    logic: String(data.logic || "").trim(),
    bodyLink: String(data.bodyLink || "").trim(),
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
    ...(journal.thanks || []),
    journal.event,
    journal.mood,
    journal.bodyNote,
    ...(journal.awareness || []),
    ...(journal.execution || []),
  ];
  if (textBits.some((item) => String(item || "").trim())) return true;
  if (deepHasContent(journal.deep)) return true;
  if (String(journal.insight?.conclusion || "").trim()) return true;
  return Boolean((journal.bodyTags || []).length || (journal.awarenessChecks || []).length || (journal.executionChecks || []).length);
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
    ...(journal.thanks || []),
    journal.event,
    journal.mood,
    journal.bodyNote,
    ...(journal.awareness || []),
    ...(journal.execution || []),
  ]
    .map((item) => String(item || ""))
    .join("\n");
}

function buildAwarenessCheckItems(journal) {
  const items = [];
  const blob = journalBlob(journal);
  const aware = journal.awareness || [];
  const mood = journal.mood || "";
  const bodyTags = journal.bodyTags || [];
  if (String(aware[0] || "").trim()) pushUnique(items, "生命力或平靜是從哪個時刻來的", 6);
  if (String(aware[1] || "").trim()) pushUnique(items, "防衛心或情緒波動真正在保護什麼", 6);
  if (String(aware[2] || "").trim()) pushUnique(items, "明天可以改的那個小細節", 6);
  if (mood === "生氣" || mood === "難過") pushUnique(items, "這份情緒想讓我看見什麼", 6);
  if (mood === "開心" || mood === "平靜") pushUnique(items, "今天真正被滋養到的是", 6);
  if (bodyTags.length || String(journal.bodyNote || "").trim()) pushUnique(items, "身體現在最想被照顧的地方", 6);
  if (/他|她|對方|同事|家人|朋友|老闆|客戶|伴侶/.test(blob)) pushUnique(items, "關係裡我真正在意的是", 6);
  ["情緒被觸發的原因", "身體發出的訊號", "真實需求還沒被說出來", "防衛心其實在保護什麼", "我對自己重複的一句話"].forEach(
    (item) => {
      if (items.length < 4) pushUnique(items, item, 6);
    }
  );
  return items.slice(0, 6);
}

function buildExecutionCheckItems(journal) {
  const items = [];
  const task = String((journal.execution || [])[0] || "");
  const stuck = String((journal.execution || [])[1] || "");
  const step = String((journal.execution || [])[2] || "");
  const body = `${stuck}\n${task}\n${(journal.bodyTags || []).join(" ")}\n${journal.bodyNote || ""}`;
  if (/累|疲|睡|沒力|能量|頭痛|緊繃/.test(body)) pushUnique(items, "能量或睡眠不夠", 4);
  if (/打斷|忙|臨時|別人|訊息|會議/.test(stuck)) pushUnique(items, "被其他事情打斷", 4);
  if (/完美|失敗|丟臉|被看|焦慮|怕/.test(stuck)) pushUnique(items, "害怕做不好或被看見", 4);
  if (/大|不知|從哪|複雜|太多/.test(`${stuck}\n${task}`)) pushUnique(items, "任務太大，不知道從哪開始", 4);
  if (/為什麼|意義|不想|沒動力|提不起/.test(stuck)) pushUnique(items, "還沒對齊為什麼要做", 4);
  if (step.trim()) pushUnique(items, "先做那 5 分鐘的一小步", 4);
  ["目標不夠清楚", "任務太大，不知道從哪開始", "害怕做不好或被看見", "還沒對齊為什麼要做"].forEach((item) => {
    if (items.length < 3) pushUnique(items, item, 4);
  });
  return items.slice(0, 4);
}

function renderChecklist(rootId, items, checked) {
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
  const keepAware = !options.forceLocal && (options.useSaved || data.awarenessAi) && (data.awarenessCheckItems || []).length;
  const keepExec = !options.forceLocal && (options.useSaved || data.executionAi) && (data.executionCheckItems || []).length;
  const awareItems = keepAware ? data.awarenessCheckItems.slice(0, 6) : buildAwarenessCheckItems(data);
  const execItems = keepExec ? data.executionCheckItems.slice(0, 4) : buildExecutionCheckItems(data);
  const awareChecked = options.useSaved ? data.awarenessChecks : checkedValues("awareChecks");
  const execChecked = options.useSaved ? data.executionChecks : checkedValues("execChecks");
  if (!options.skipAware) renderChecklist("awareChecks", awareItems, awareChecked);
  if (!options.skipExec) renderChecklist("execChecks", execItems, execChecked);
}

function scheduleJournalChecklists() {
  if (state.journalHydrating) return;
  clearTimeout(state.journalCheckTimer);
  state.journalCheckTimer = setTimeout(() => {
    const data = collectJournal();
    refreshJournalChecklists(data);
    maybeAutoGenerateChecklists(data);
    maybeAutoGenerateInsight(data);
  }, 900);
}

function threeAnswersFilled(answers) {
  return (answers || []).filter((item) => String(item || "").trim()).length >= 3;
}

function checklistSignature(answers) {
  return (answers || []).map((item) => String(item || "").trim()).join("\n");
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

function setChecklistLoading(kind, loading) {
  const isAware = kind === "awareness";
  const btn = document.getElementById(isAware ? "btnAwareAi" : "btnExecAi");
  const loader = document.getElementById(isAware ? "awareLoading" : "execLoading");
  const list = document.getElementById(isAware ? "awareChecks" : "execChecks");
  state.checklistBusy[kind] = loading;
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "分析中…" : "AI 分析並生成勾勾表";
  }
  if (loader) loader.hidden = !loading;
  if (list) list.classList.toggle("is-loading", loading);
}

function applyGeneratedChecklist(kind, items, sig) {
  const isAware = kind === "awareness";
  renderChecklist(isAware ? "awareChecks" : "execChecks", items, []);
  state.journalMeta[isAware ? "awarenessAi" : "executionAi"] = true;
  state.journalMeta[isAware ? "awarenessAiSig" : "executionAiSig"] = sig;
}

async function generateJournalChecklist(kind, options = {}) {
  const isAware = kind === "awareness";
  if (state.checklistBusy[kind]) return;
  const journal = collectJournal();
  const answers = isAware ? journal.awareness : journal.execution;
  if (!threeAnswersFilled(answers)) {
    if (!options.auto) showToast("先把左側三個問題寫完，再請 AI 整理勾勾表。");
    return;
  }
  const sig = checklistSignature(answers);
  if (options.auto && state.journalMeta[isAware ? "awarenessAiSig" : "executionAiSig"] === sig) return;

  const token = (state.checklistToken[kind] || 0) + 1;
  state.checklistToken[kind] = token;
  setChecklistLoading(kind, true);

  const fallback = isAware ? buildAwarenessCheckItems(journal) : buildExecutionCheckItems(journal);
  const min = isAware ? 4 : 3;
  const max = isAware ? 6 : 4;

  try {
    if (!state.user) {
      throw new Error("請先登入，才能使用雲端 AI 分析。");
    }
    const remote = await postReview({
      mode: "checklist",
      kind,
      date: currentIso(),
      answers,
      context: {
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
      },
      text: answers.join("\n"),
    });
    if (state.checklistToken[kind] !== token) return;
    const items = normalizeAiChecklistItems(remote.items, min, max, fallback);
    if (items.length < min) throw new Error("雲端回傳格式不完整");
    applyGeneratedChecklist(kind, items, sig);
    showToast(isAware ? "覺察勾勾表已生成。" : "行動卡點已生成。");
  } catch (error) {
    if (state.checklistToken[kind] !== token) return;
    applyGeneratedChecklist(kind, fallback.slice(0, max), sig);
    showToast(`雲端分析失敗：${formatApiError(error)}，先用本地整理。`);
  } finally {
    if (state.checklistToken[kind] === token) setChecklistLoading(kind, false);
  }
}

function maybeAutoGenerateChecklists(journal) {
  if (state.journalHydrating) return;
  if (threeAnswersFilled(journal.awareness) && state.journalMeta.awarenessAiSig !== checklistSignature(journal.awareness)) {
    generateJournalChecklist("awareness", { auto: true });
  }
  if (threeAnswersFilled(journal.execution) && state.journalMeta.executionAiSig !== checklistSignature(journal.execution)) {
    generateJournalChecklist("execution", { auto: true });
  }
}

function insightReady(journal) {
  const data = journal || collectJournal();
  return Boolean(
    String(data.event || "").trim() &&
      data.mood &&
      ((data.bodyTags || []).length || String(data.bodyNote || "").trim())
  );
}

function insightSignature(journal) {
  const data = journal || collectJournal();
  return [String(data.event || "").trim(), data.mood || "", (data.bodyTags || []).join("、"), String(data.bodyNote || "").trim()].join("\n");
}

function renderInsightCard(insight) {
  const root = document.getElementById("insightBody");
  if (!root) return;
  const data = normalizeInsight(insight);
  if (!data.conclusion) {
    root.innerHTML = `<p class="insight-card__empty">先把事件、心情與身體反應寫下來，再點按鈕或等它自動生成。</p>`;
    return;
  }
  root.innerHTML = `
    <article class="insight-card__result">
      <p class="insight-card__kicker">【核心結論】</p>
      ${data.title ? `<h3 class="insight-card__headline">${escapeHtml(data.title)}</h3>` : ""}
      <p class="insight-card__conclusion">${escapeHtml(data.conclusion)}</p>
      ${data.logic ? `<p class="insight-card__note">${escapeHtml(data.logic)}</p>` : ""}
      ${data.bodyLink ? `<p class="insight-card__note">${escapeHtml(data.bodyLink)}</p>` : ""}
    </article>
  `;
}

function setInsightLoading(loading) {
  const btn = document.getElementById("btnInsightAi");
  const loader = document.getElementById("insightLoading");
  const body = document.getElementById("insightBody");
  state.insightBusy = loading;
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "分析中…" : "生成深度洞察";
  }
  if (loader) loader.hidden = !loading;
  if (body) body.classList.toggle("is-loading", loading);
}

function localInsightFallback(journal) {
  const mood = journal.mood || "這份情緒";
  const tags = (journal.bodyTags || []).join("、") || "身體的訊號";
  return {
    title: "身體比念頭更早開口",
    conclusion: `今天這件事碰到你時，心情停在「${mood}」。真正要被看見的，不一定是表面上發生了什麼，而是你當下用什麼方式保護自己。`,
    logic: "防衛不一定是錯的。它常常是在來不及說清楚之前，先幫你把關係或面子守住。",
    bodyLink: `${tags} 往往不是多餘的噪音，而是壓力已經先走到身上。`,
    sig: insightSignature(journal),
  };
}

async function generateJournalInsight(options = {}) {
  if (state.insightBusy) return;
  const journal = collectJournal();
  if (!insightReady(journal)) {
    if (!options.auto) showToast("請先寫下今日事件、選擇心情，並標出身體狀況。");
    return;
  }
  const sig = insightSignature(journal);
  if (options.auto && state.journalMeta.insightSig === sig) return;

  const token = (state.insightToken || 0) + 1;
  state.insightToken = token;
  setInsightLoading(true);

  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端 AI 分析。");
    const remote = await postReview({
      mode: "insight",
      date: currentIso(),
      text: journal.event,
      context: {
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
      },
    });
    if (state.insightToken !== token) return;
    const insight = { ...normalizeInsight(remote), sig };
    if (!insight.conclusion) throw new Error("雲端回傳格式不完整");
    state.journalInsight = insight;
    state.journalMeta.insightSig = sig;
    renderInsightCard(insight);
    showToast("今日核心結論已生成。");
  } catch (error) {
    if (state.insightToken !== token) return;
    const fallback = localInsightFallback(journal);
    state.journalInsight = fallback;
    state.journalMeta.insightSig = sig;
    renderInsightCard(fallback);
    showToast(`雲端分析失敗：${formatApiError(error)}，先留下本地洞察。`);
  } finally {
    if (state.insightToken === token) setInsightLoading(false);
  }
}

function maybeAutoGenerateInsight(journal) {
  if (state.journalHydrating) return;
  if (insightReady(journal) && state.journalMeta.insightSig !== insightSignature(journal)) {
    generateJournalInsight({ auto: true });
  }
}

const DEEP_THEMES = [
  "今天哪一刻，我其實超想翻白眼（或超不爽），但還是忍住了？",
  "今天有沒有哪件事，是我其實可以不要做，但又不好意思拒絕的？",
  "如果今天可以重來，哪一件事我絕對不要再用老方法處理？",
  "今天最爽、最讓我覺得「還好我有堅持」的一瞬間是什麼？",
];

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
    <p class="deep-follow__head">AI 教練追問</p>
    ${items
      .map(
        (question, i) => `
          <article class="deep-probe">
            <p class="deep-probe__q" data-followup="${escapeHtml(question)}">${i + 1}. ${escapeHtml(question)}</p>
            <textarea class="textarea" id="deep${index}note${i + 1}" rows="3" placeholder="針對這一題，我還想寫下的是…">${escapeHtml(saved[i] || "")}</textarea>
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
    btn.textContent = loading ? "分析中…" : "讓 AI 帶我再深入思考";
  }
  if (loader) loader.hidden = !loading;
}

function localDeepFollowFallback(index, slot) {
  const themeFallbacks = [
    ["那句沒說出口的話，如果說出來，你最怕對方聽見什麼？", "忍住的那一秒，身體哪裡先緊起來？", "如果可以只改一個小動作，你會讓哪一句話被對方聽見？"],
    ["不好意思拒絕時，你在保護誰的感受？", "如果這次說「這次我沒辦法」，最壞的畫面是什麼？", "這件事如果不是你做，誰其實也可以承擔？"],
    ["那個老方法曾經幫你逃過什麼？", "新方法只需要改哪一個最小的動作？", "如果明天只用新方法做 5 分鐘，會從哪一步開始？"],
    ["那一刻讓你覺得『我是這樣的人』的，是哪一個價值？", "明天要複製它，最小的一步是什麼？", "如果把這份堅持說給自己聽，那句話會是什麼？"],
  ];
  return themeFallbacks[index - 1] || themeFallbacks[0];
}

async function generateDeepFollow(index) {
  const slotIndex = Number(index);
  if (slotIndex < 1 || slotIndex > 4 || state.deepFollowBusy[slotIndex - 1]) return;
  const slot = collectDeepSlot(slotIndex);
  if (!String(slot.plain || "").trim() && !String(slot.deep || "").trim()) {
    showToast("先在這個主題寫下一點，再請 AI 往下挖。");
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
    if (!state.user) throw new Error("請先登入，才能使用雲端 AI 分析。");
    const remote = await postReview({
      mode: "deepen",
      date: currentIso(),
      theme: DEEP_THEMES[slotIndex - 1],
      plain: slot.plain,
      deep: slot.deep,
      text: `${slot.plain}\n${slot.deep}`.trim(),
      context: {
        event: journal.event,
        mood: journal.mood,
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

function collectJournal() {
  const journal = {
    thanks: ["thanks1", "thanks2", "thanks3"].map(journalFieldValue),
    event: journalFieldValue("eventText"),
    mood: document.querySelector("#moodRow .mood-btn.is-on")?.dataset.mood || "",
    bodyTags: [...document.querySelectorAll("#bodyTags .tag-btn.is-on")].map((btn) => btn.dataset.bodyTag),
    bodyNote: journalFieldValue("bodyNote"),
    awareness: ["aware1", "aware2", "aware3"].map(journalFieldValue),
    awarenessChecks: checkedValues("awareChecks"),
    awarenessCheckItems: checklistItems("awareChecks"),
    execution: ["exec1", "exec2", "exec3"].map(journalFieldValue),
    executionChecks: checkedValues("execChecks"),
    executionCheckItems: checklistItems("execChecks"),
    awarenessAi: Boolean(state.journalMeta.awarenessAi),
    executionAi: Boolean(state.journalMeta.executionAi),
    awarenessAiSig: state.journalMeta.awarenessAiSig || "",
    executionAiSig: state.journalMeta.executionAiSig || "",
    insight: state.journalInsight || emptyInsight(),
    deep: [1, 2, 3, 4].map(collectDeepSlot),
  };
  return journal;
}

function composeJournalRawText(journal) {
  const lines = [];
  const thanks = (journal.thanks || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (thanks.length) {
    lines.push("今日感謝");
    thanks.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }
  if (String(journal.event || "").trim()) lines.push(`今日事件：${journal.event.trim()}`);
  if (journal.mood) lines.push(`心情：${journal.mood}`);
  if ((journal.bodyTags || []).length) lines.push(`身體狀態：${journal.bodyTags.join("、")}`);
  if (String(journal.bodyNote || "").trim()) lines.push(`身體提醒：${journal.bodyNote.trim()}`);
  const insight = normalizeInsight(journal.insight);
  if (insight.conclusion) {
    lines.push("AI 深度教練洞察");
    if (insight.title) lines.push(insight.title);
    lines.push(insight.conclusion);
    if (insight.logic) lines.push(insight.logic);
    if (insight.bodyLink) lines.push(insight.bodyLink);
  }
  const awareQs = [
    "今天，哪個時刻感受到了「生命力」或「平靜」？",
    "今天，哪一個時刻我出現了「防衛心」或「情緒波動」？",
    "如果明天能重來一次，在某個小細節上，我會做哪一個不同的選擇？",
  ];
  (journal.awareness || []).forEach((item, index) => {
    if (String(item || "").trim()) lines.push(`${awareQs[index]} ${item.trim()}`);
  });
  if ((journal.awarenessChecks || []).length) lines.push(`今天我覺察到：${journal.awarenessChecks.join("、")}`);
  const execQs = [
    "今天本來想做，但卻一直拖著沒做的是哪件事？",
    "是什麼原因讓你卡住、不想動？",
    "明天只要花 5 分鐘，哪一小步可以讓你重新開始？",
  ];
  (journal.execution || []).forEach((item, index) => {
    if (String(item || "").trim()) lines.push(`${execQs[index]} ${item.trim()}`);
  });
  if ((journal.executionChecks || []).length) lines.push(`我的行動卡點：${journal.executionChecks.join("、")}`);
  const deepQs = [
    "今天哪一刻，我其實超想翻白眼（或超不爽），但還是忍住了？",
    "今天有沒有哪件事，是我其實可以不要做，但又不好意思拒絕的？",
    "如果今天可以重來，哪一件事我絕對不要再用老方法處理？",
    "今天最爽、最讓我覺得「還好我有堅持」的一瞬間是什麼？",
  ];
  normalizeDeep(journal.deep).forEach((item, index) => {
    const plain = String(item.plain || "").trim();
    const deep = String(item.deep || "").trim();
    if (!plain && !deep && !(item.followups || []).length) return;
    lines.push(deepQs[index]);
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

function fillJournal(journal) {
  const data = { ...emptyJournal(), ...(journal && typeof journal === "object" ? journal : {}) };
  state.journalHydrating = true;
  state.checklistToken.awareness += 1;
  state.checklistToken.execution += 1;
  state.insightToken += 1;
  state.deepFollowToken = state.deepFollowToken.map((n) => n + 1);
  setChecklistLoading("awareness", false);
  setChecklistLoading("execution", false);
  setInsightLoading(false);
  [1, 2, 3, 4].forEach((index) => setDeepFollowLoading(index, false));
  state.journalMeta = {
    awarenessAi: Boolean(data.awarenessAi),
    executionAi: Boolean(data.executionAi),
    awarenessAiSig: data.awarenessAiSig || "",
    executionAiSig: data.executionAiSig || "",
    insightSig: data.insight?.sig || "",
  };
  state.journalInsight = normalizeInsight(data.insight);
  ["thanks1", "thanks2", "thanks3"].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.value = data.thanks[index] || "";
  });
  const eventText = document.getElementById("eventText");
  if (eventText) eventText.value = data.event || "";
  setActiveButtons("moodRow", ".mood-btn", data.mood ? [data.mood] : []);
  setActiveButtons("bodyTags", ".tag-btn", data.bodyTags);
  const bodyNote = document.getElementById("bodyNote");
  if (bodyNote) bodyNote.value = data.bodyNote || "";
  ["aware1", "aware2", "aware3"].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.value = data.awareness[index] || "";
  });
  ["exec1", "exec2", "exec3"].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.value = data.execution[index] || "";
  });
  const deep = normalizeDeep(data.deep);
  deep.forEach((item, index) => {
    const plain = document.getElementById(`deep${index + 1}plain`);
    const note = document.getElementById(`deep${index + 1}deep`);
    if (plain) plain.value = item.plain || "";
    if (note) note.value = item.deep || "";
    renderDeepFollow(index + 1, item.followups, item.notes);
  });
  refreshJournalChecklists(data, { useSaved: true });
  renderInsightCard(state.journalInsight);
  state.journalHydrating = false;
}

function updateJournalDateLabel(iso) {
  const label = document.getElementById("journalDateLabel");
  const date = parseIsoDate(iso) || new Date();
  if (label) label.textContent = formatHeaderDate(date);
}

function speechTarget() {
  const active = document.activeElement;
  if (active && (active.matches("input, textarea") && active.id !== "reviewDate")) return active;
  if (state.speechTarget && document.getElementById(state.speechTarget)) {
    return document.getElementById(state.speechTarget);
  }
  return document.getElementById("thanks1") || document.getElementById("reviewText");
}

function rememberSpeechTarget(el) {
  if (el && el.id && el.matches("input, textarea") && el.id !== "reviewDate" && el.id !== "reviewText") {
    state.speechTarget = el.id;
  }
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
}

function renderConclusionCallout(text) {
  const line = String(text || "").trim();
  if (!line) return "";
  return `
    <aside class="conclusion-callout">
      <p class="conclusion-callout__label">【核心結論】</p>
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
        ${think.question ? `<p class="sfm-hint">下一層可以接著想：${escapeHtml(think.question)}</p>` : ""}
        <p class="chips-label">勾選你願意練習或已經說過的句子</p>
        <div class="check-list">${thinkActions}</div>
        <label class="field" style="margin-top:16px">
          <span class="field__label">你想接續回覆的（選填）</span>
          <textarea class="textarea" id="thinkReply" rows="3" placeholder="勾選行動後，也可以再寫一句你現在想到的…"></textarea>
        </label>
        <div class="ai-actions">
          ${state.think.round < state.think.max ? `<button class="btn btn--ghost" id="btnThinkSubmit" type="button">送出，進入下一輪</button>` : ""}
        </div>
      </div>
    `
    : `
      <div class="think-panel">
        <p class="think-card__round">引導式互動</p>
        <p>整理完成後會立刻出現可勾選的下一步。若沒看到，再按一次開始整理即可。</p>
        <div class="ai-actions">
          <button class="btn btn--ai-ghost" id="btnThink" type="button">開始深度思考</button>
        </div>
      </div>
    `;

  root.innerHTML = `
    <div class="review-board">
      ${renderReviewCard({
        title: "核心洞察區",
        variant: "insight",
        body: `
          <p class="rv-card__kicker">${state.organizeSource === "cloud" ? "雲端 AI 復盤" : "本地草稿"}</p>
          <p class="theme-inline">【${escapeHtml(ai.themeCategory || "覺察")}】${escapeHtml(ai.themeTitle || "今天的復盤")} <span class="stars">[${starsText(ai.themeStars)}]</span></p>
          ${renderSub(
            "今日金句",
            `
              ${quoteCards || `<p class="gold-quote">把今天寫下來，不是給別人看成績，是讓這一天確實被過過。</p>`}
              <p class="sfm-hint">可直接複製當標題或筆記；勾選後會收入『執行力』</p>
              <div class="quote-list">${quoteChecks || ""}</div>
            `
          )}
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
          <textarea class="textarea" id="gratitudeInput" rows="3" placeholder="你還想補一句感謝的是…">${escapeHtml(state.gratitude)}</textarea>
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
        body: thinkBody,
      })}
      ${renderReviewCard({
        title: "原始輸入紀錄",
        variant: "muted",
        body: `
          <p class="raw-record">${escapeHtml(rawText || "（尚未留下原文）")}</p>
          <p class="sfm-hint">這段原文會永久保存在本機歷史紀錄，不會被整理結果覆蓋。</p>
        `,
      })}
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
    if (document.getElementById("thanks1")) syncHiddenReviewText();
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
    showToast("先出本地草稿，接著呼叫雲端 AI…");
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
  showToast("正在呼叫雲端 AI 深挖…");
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
  const iso = currentIso();
  const collected = document.getElementById("thanks1") ? syncHiddenReviewText() : { journal: null, rawText: "" };
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
  showToast("今日復盤已完成，筆記、金句與下一步都收好了。");
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
  const rate = report.days ? Math.round((report.filledDays / report.days) * 100) : 0;
  const token = (renderReport._token || 0) + 1;
  renderReport._token = token;
  const period = state.reportType === "month" ? report.fromIso.slice(0, 7) : report.fromIso;
  const cachedAi = readCachedReport(state.reportType, period) || readLatestCachedReport(state.reportType);

  if (!report.filledDays) {
    root.innerHTML = `
      <article class="report-card">
        <div class="empty">
          <p class="empty__title">這個區間還沒有復盤</p>
          <p class="report-empty">寫下第一篇之後，週月報會自動幫你數天數、算節奏，並聚合成洞察與規劃。</p>
        </div>
      </article>
      <div id="reportAi">${renderAiReportBlock(cachedAi, cachedAi ? undefined : "loading")}</div>
    `;
    hydrateAiReport(state.reportType, report, token);
    return;
  }

  root.innerHTML = `
    <article class="report-card">
      <h3>${escapeHtml(report.label)}完成摘要</h3>
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
          <p class="stat-card__value">${formatCharCount(report.totalChars)}</p>
          <p class="stat-card__label">累積總字數</p>
        </article>
      </div>
      <p class="report-rhythm" style="margin-top:16px">${escapeHtml(formatFrequencyLabel(report.days, report.filledDays))}。一共留下 ${formatCharCount(report.totalChars)}。</p>
    </article>
    <article class="report-card">
      <h3>高頻關鍵字</h3>
      <div class="report-keywords">
        ${
          report.keywords.length
            ? report.keywords.map((item) => `<span class="keyword">${escapeHtml(item.word)}<span class="keyword__count">${item.count}</span></span>`).join("")
            : `<p class="report-empty">字還不夠多，關鍵字會在你繼續寫之後長出來。</p>`
        }
      </div>
    </article>
    <div id="reportAi">${renderAiReportBlock(cachedAi, cachedAi ? undefined : "loading")}</div>
    <article class="report-card">
      <h3>逐日回顧</h3>
      <ul class="highlight-list">
        ${report.entries
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
          .join("")}
      </ul>
    </article>
  `;
  hydrateAiReport(state.reportType, report, token);
  syncReviewsToCloud();
}

function renderTasks() {
  const list = document.getElementById("taskList");
  if (!list) return;
  const tasks = getTasks().filter((task) => state.taskFilter === "all" || task.status === state.taskFilter);

  if (!getTasks().length) {
    list.innerHTML = `<div class="empty"><p class="empty__title">覺察力還是空的</p>從今日復盤勾選行動，或在上方手動新增一件最小的事。</div>`;
    return;
  }
  if (!tasks.length) {
    list.innerHTML = `<div class="empty">這個分類目前是空的。</div>`;
    return;
  }

  list.innerHTML = tasks
    .map((task) => {
      const created = task.createdAt ? formatDisplayDate(task.createdAt.slice(0, 10)) : "";
      return `
        <article class="task-card">
          <div>
            <p class="task-card__title">${escapeHtml(task.title)}</p>
            <div class="task-card__meta">
              <span class="tag tag--${escapeHtml(task.status)}">${escapeHtml(STATUS_LABEL[task.status] || task.status)}</span>
              <span class="tag">${escapeHtml(task.source || "自行新增")}</span>
              ${created ? `<span class="tag">${created}</span>` : ""}
            </div>
          </div>
          <div class="task-card__actions">
            <button class="btn btn--ghost btn--tiny" data-task-status="${task.id}" data-to="doing" type="button">進行中</button>
            <button class="btn btn--ghost btn--tiny" data-task-status="${task.id}" data-to="later" type="button">先放著</button>
            <button class="btn btn--ghost btn--tiny" data-task-status="${task.id}" data-to="done" type="button">已完成</button>
            <button class="btn btn--ghost btn--tiny" data-task-delete="${task.id}" type="button">刪除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function addTask(event) {
  event.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return;
  const tasks = getTasks();
  tasks.unshift({
    id: uid(),
    title,
    status: "doing",
    source: document.getElementById("taskSource").value,
    createdAt: new Date().toISOString(),
  });
  saveTasks(tasks);
  document.getElementById("taskTitle").value = "";
  renderTasks();
  showToast("下一步已加入。");
}

function renderSfm() {
  const grid = document.getElementById("sfmGrid");
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
      const hay = `${iso} ${formatDisplayDate(iso)} ${reviewSearchText(review)}`.toLowerCase();
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
      const report = open && ai ? renderHistoryReport(review) : open ? `<div class="history-report"><p class="raw-record">${escapeHtml(review.rawText || "")}</p></div>` : "";
      return `
        <article class="history-card ${open ? "is-open" : ""}">
          <p class="history-card__date">${formatDisplayDate(iso)}</p>
          <p class="history-card__excerpt">${escapeHtml(excerptText(ai?.themeTitle ? `【${ai.themeCategory || ""}】${ai.themeTitle}` : review.rawText))}</p>
          <div class="history-card__meta">
            ${tags}
            <button class="btn btn--ghost btn--tiny" data-history-toggle="${iso}" type="button">${open ? "收合" : "展開完整報告"}</button>
            <button class="btn btn--ghost btn--tiny" data-open="${iso}" type="button">打開這天</button>
          </div>
          ${report}
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
 * 提醒 / 語音 / API Modal
 * =========================================================================== */

function reminderLabel() {
  const reminder = loadJson(STORAGE_KEYS.reminder, null);
  if (reminder?.enabled && reminder.time) {
    return `復盤提醒：每晚 ${reminder.time} — 點此更改`;
  }
  return "你還沒開啟提醒，可能會忘記復盤 — 點這裡一分鐘設定";
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
      new Notification("日精進", { body: "該寫今天的復盤了。用講的也沒關係。" });
    } catch {
      /* ignore */
    }
  }
}

function setupSpeech() {
  try {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById("micBtn");
    if (!btn) return;
    if (!Speech) {
      btn.hidden = true;
      return;
    }
    const recognition = new Speech();
    recognition.lang = "zh-TW";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (!finalText) return;
      const field = speechTarget();
      if (!field) return;
      const prefix = field.value && !field.value.endsWith("\n") && field.value ? field.value : field.value;
      field.value = `${prefix}${finalText}`;
      syncHiddenReviewText();
    };
    recognition.onend = () => {
      state.listening = false;
      btn.classList.remove("is-on");
      const label = document.getElementById("micLabel");
      if (label) label.textContent = "語音記錄";
    };
    state.recognition = recognition;
  } catch {
    const btn = document.getElementById("micBtn");
    if (btn) btn.hidden = true;
  }
}

function toggleMic() {
  const btn = document.getElementById("micBtn");
  if (!state.recognition) {
    if (btn) btn.classList.toggle("is-on");
    showToast("語音記錄準備中，也可以先用鍵盤寫下。");
    return;
  }
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  try {
    state.recognition.start();
    state.listening = true;
    if (btn) {
      btn.classList.add("is-on");
      btn.setAttribute("aria-pressed", "true");
    }
    const label = document.getElementById("micLabel");
    if (label) label.textContent = "聆聽中";
  } catch {
    showToast("無法啟動語音輸入，也可以用鍵盤寫下。");
  }
}


/* =============================================================================
 * 事件
 * =========================================================================== */

function bindEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest ? event.target : event.target.parentElement;
    if (!target || !target.closest) return;
    if (target.closest("#btnGoogleLogin")) {
      event.preventDefault();
      signInWithGoogle();
      return;
    }
    if (target.closest("#btnSignOut") || target.closest("#btnGoogleLogout")) {
      event.preventDefault();
      signOutUser();
      return;
    }
    if (target.closest("#btnNewebPay") || target.closest(".auth-pay:not(:disabled)")) {
      console.log("Subscribe button clicked");
      event.preventDefault();
      startNewebPay();
    }
  });

  const toggle = navToggleEl();
  if (toggle) toggle.addEventListener("click", toggleMenu);
  const scrim = document.getElementById("scrim");
  if (scrim) scrim.addEventListener("click", () => setSidebarOpen(false));

  document.querySelectorAll(".side-item").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      switchPage(btn.dataset.page);
    });
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
  document.getElementById("micBtn")?.addEventListener("click", toggleMic);
  document.getElementById("btnCompleteToday")?.addEventListener("click", completeToday);
  document.getElementById("btnSaveDraft")?.addEventListener("click", saveJournalDraft);
  document.getElementById("btnAwareAi")?.addEventListener("click", () => generateJournalChecklist("awareness"));
  document.getElementById("btnExecAi")?.addEventListener("click", () => generateJournalChecklist("execution"));
  document.getElementById("btnInsightAi")?.addEventListener("click", () => generateJournalInsight());
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
    maybeAutoGenerateInsight(collectJournal());
  });

  document.getElementById("bodyTags")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".tag-btn");
    if (!btn) return;
    btn.classList.toggle("is-on");
    refreshJournalChecklists();
    maybeAutoGenerateInsight(collectJournal());
  });

  document.getElementById("page-today")?.addEventListener("input", (event) => {
    const id = event.target && event.target.id;
    if (/^(aware|exec)\d$|^eventText$|^bodyNote$/.test(id || "")) scheduleJournalChecklists();
  });

  document.getElementById("page-today")?.addEventListener("focusin", (event) => {
    rememberSpeechTarget(event.target);
  });

  document.getElementById("page-today")?.addEventListener("click", (event) => {
    const mini = event.target.closest("[data-voice-ui]");
    if (!mini) return;
    event.preventDefault();
    const input = mini.closest(".thanks-row")?.querySelector("input, textarea");
    if (input) {
      input.focus();
      rememberSpeechTarget(input);
    }
    mini.classList.toggle("is-on");
    toggleMic();
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

  document.getElementById("taskForm").addEventListener("submit", addTask);
  document.getElementById("taskFilters").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter]");
    if (!chip) return;
    state.taskFilter = chip.dataset.filter;
    document.querySelectorAll("#taskFilters .chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    renderTasks();
  });
  document.getElementById("taskList").addEventListener("click", (event) => {
    const statusBtn = event.target.closest("[data-task-status]");
    const deleteBtn = event.target.closest("[data-task-delete]");
    let tasks = getTasks();
    if (statusBtn) {
      tasks = tasks.map((task) => (task.id === statusBtn.dataset.taskStatus ? { ...task, status: statusBtn.dataset.to } : task));
      saveTasks(tasks);
      renderTasks();
    }
    if (deleteBtn) {
      saveTasks(tasks.filter((task) => task.id !== deleteBtn.dataset.taskDelete));
      renderTasks();
      showToast("已刪除這一步。");
    }
  });

  document.getElementById("sfmFilters").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-sfm]");
    if (!chip) return;
    state.sfmFilter = chip.dataset.sfm;
    document.querySelectorAll("#sfmFilters .chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    renderSfm();
  });
  document.getElementById("sfmGrid").addEventListener("click", async (event) => {
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
    const toggle = event.target.closest("[data-history-toggle]");
    const open = event.target.closest("[data-open]");
    if (toggle) {
      state.historyOpen = state.historyOpen === toggle.dataset.historyToggle ? "" : toggle.dataset.historyToggle;
      renderHistory();
    }
    if (open) {
      document.getElementById("reviewDate").value = open.dataset.open;
      loadReviewForDate(open.dataset.open);
      switchPage("today");
    }
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

function init() {
  try {
    bindEvents();
  } catch {
    const btn = document.getElementById("btnOrganize");
    if (btn) btn.onclick = runOrganize;
  }
  try {
    document.getElementById("headerDate").textContent = formatHeaderDate(new Date());
    document.getElementById("reviewDate").value = toInputDate(new Date());
    updateJournalDateLabel(toInputDate(new Date()));
    const closed =
      localStorage.getItem("rv_sidebar") === "closed" || localStorage.getItem(STORAGE_KEYS.sidebar) === "1";
    if (closed && !isMobile()) {
      document.body.classList.add("nav-closed");
      const toggle = navToggleEl();
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
    renderPromptChips();
    loadReviewForDate(currentIso());
    updateStats();
    initReminder();
    setupSpeech();
    setInterval(tickReminder, 20000);
    probeReviewApi();
    refreshAuth();
    handleAuthQuery();
  } catch {
    /* 其餘初始化失敗也不擋「開始整理」 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
