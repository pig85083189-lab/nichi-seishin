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
};

const REVIEW_API = "/api/review";

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
  organizeSource: "",
  apiConfigured: null,
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

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

function getSfm() {
  const saved = loadJson(STORAGE_KEYS.sfm, []);
  return Array.isArray(saved) ? saved : [];
}

function saveSfm(items) {
  saveJson(STORAGE_KEYS.sfm, items);
}

function reviewIsComplete(review) {
  return Boolean(review && (review.completedAt || review.organize || String(review.rawText || "").trim()));
}

function reviewSearchText(review) {
  if (!review) return "";
  const ai = review.organize || {};
  return [
    review.rawText,
    review.gratitude,
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
  if (/404|Failed to fetch|fetch 失敗|NetworkError/i.test(message)) {
    return "找不到 /api/review。請用 Vercel 網址開啟，並重新部署後端函式。";
  }
  return message;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    console.log("[日精進 API] fetch 送出", options?.method || "GET", url);
    return await fetch(url, { ...options, signal: controller.signal });
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

const ORGANIZE_SYSTEM_PROMPT = `你是「日精進」的高級深度復盤教練。每次產出：主標題與評等、【我以為是／他以為是】深度事件拆解、金句與感恩清單、下一步引導與可照唸的對話範例。繁體中文，只輸出 JSON。`;

function thinkFromOrganize(organize, round = 1) {
  const scripts = Array.isArray(organize?.nextScripts) ? organize.nextScripts.filter(Boolean) : [];
  const labels = ["先對齊彼此以為的", "把真實想法講出來", "用這句跟對方開口"];
  const gap = organize?.assumptionGap || {};
  const question =
    organize.thinkGuide ||
    (gap.line ? `兩邊以為的是同一件事嗎？「${gap.line}」` : localThink(organize, round, [], "").question);
  const insight = [organize.howNext, organize.whyNeed, organize.whatFact].filter(Boolean).join(" ") || organize.reflection || "";
  if (!scripts.length) return localThink(organize, round, [], "");
  return {
    title: "下一步引導 / 深度思考",
    question,
    insight,
    actions: scripts.slice(0, 3).map((detail, index) => ({
      label: labels[index] || `對話範例 ${index + 1}`,
      detail: /[「『"]/.test(detail) ? detail : `「${detail}」`,
    })),
  };
}

async function maybeEnhanceWithApi(rawText, token) {
  showToast("正在呼叫雲端 AI…");
  try {
    const remote = await generateReview(rawText);
    if (runOrganize._token !== token) {
      console.log("[日精進 API] 回應已過期（使用者又按了一次整理），丟棄這次結果。");
      return;
    }
    applyOrganizeResult(normalizeOrganizeResult(remote, rawText), "cloud");
    applyThinkResult(thinkFromOrganize(state.organize, 1), 1, { silent: true });
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
  document.getElementById("promptChips").innerHTML = PROMPT_CHIPS.map(
    (label) => `<button class="prompt-chip" type="button" data-prompt="${escapeHtml(label)}">${escapeHtml(label)}</button>`
  ).join("");
}

function insertPrompt(label) {
  const textarea = document.getElementById("reviewText");
  const prefix = textarea.value.trim() ? `${textarea.value.trim()}\n\n` : "";
  textarea.value = `${prefix}${label}：`;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
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
  document.getElementById("reviewText").value = review?.rawText || "";
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
      <p class="conclusion-callout__label">核心結論</p>
      <p class="conclusion-callout__text">${escapeHtml(line)}</p>
    </aside>
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
      const checked = state.selectedPractice.includes(item.key) ? "checked" : "";
      return `<label class="check-row check-row--practice"><input type="checkbox" data-practice="${escapeHtml(item.key)}" ${checked} /><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span></label>`;
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

function collectQuoteKeys(organize) {
  const keys = [];
  (organize.quotes || []).forEach((quote, index) => keys.push(`quote:${index}`));
  (organize.sfm || []).forEach((item, index) => keys.push(`sfm:${index}`));
  return keys;
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
  const pastRounds = think ? history.slice(0, -1) : [];
  const pastHtml = pastRounds
    .map(
      (round, index) => `
      <article class="think-panel think-panel--past">
        <p class="think-card__round">已完成　第 ${index + 1}/${state.think.max} 輪</p>
        <h3 class="think-panel__question">${escapeHtml(round.question || "")}</h3>
        <p class="think-card__q">${escapeHtml(round.insight || "")}</p>
      </article>
    `
    )
    .join("");

  const thinkActions = (think?.actions || [])
    .map((item, index) => {
      const key = `think:${state.think.round}:${index}`;
      const checked = state.selectedThinkActions.includes(key) ? "checked" : "";
      return `<label class="check-row check-row--practice"><input type="checkbox" data-action="${key}" data-label="${escapeHtml(item.label || "")}" data-detail="${escapeHtml(item.detail || "")}" ${checked} /><span><strong>${escapeHtml(item.label || "下一步")}</strong><small>${escapeHtml(item.detail || "")}</small></span></label>`;
    })
    .join("");

  const thinkBody = think
    ? `
      ${pastHtml}
      <div class="think-panel" id="thinkCurrent">
        <p class="think-card__round">深度思考　第 ${state.think.round}/${state.think.max} 輪</p>
        <h3 class="think-panel__question">${escapeHtml(think.question || "")}</h3>
        <p class="think-card__q">${escapeHtml(think.insight || "")}</p>
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

  const conclusion = ai.conclusion || ai.themeInsight || "";
  root.innerHTML = `
    <div class="review-board">
      ${renderReviewCard({
        title: "核心洞察區",
        variant: "insight",
        body: `
          <p class="rv-card__kicker">${state.organizeSource === "cloud" ? "雲端 AI 復盤" : "本地草稿"}</p>
          <p class="theme-inline">【${escapeHtml(ai.themeCategory || "覺察")}】${escapeHtml(ai.themeTitle || "今天的復盤")} <span class="stars">[${starsText(ai.themeStars)}]</span></p>
          ${renderConclusionCallout(conclusion)}
          ${renderSub(
            "今日金句",
            `
              ${quoteCards || `<p class="gold-quote">把今天寫下來，不是給別人看成績，是讓這一天確實被過過。</p>`}
              <p class="sfm-hint">可直接複製當標題或筆記；勾選後會收入 SFM 素材庫</p>
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
                <p class="sfm-hint">也可勾選下面這幾段體悟，一併收入素材庫。</p>
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
      "好意沒講清楚，解法就變成壓力",
      "吵的不是態度，是目標不在同一層",
      "先對齊眼前要解哪一件",
    ],
    事業經營: [
      "卡住的不是能力，是目標層級",
      "先寫死這次只解哪一層",
      keyShort ? `卡點標題：${clipPhrase(keyShort, 14)}` : "先做眼前，再談一次到位",
    ],
    身心狀態: [
      "身體先降速，行程還在加碼",
      "不是懶，是負載已經超標",
      "先砍到明天做得到的一步",
    ],
    覺察: [
      hasWhy ? "原因找到了，就別再怪個性" : "卡點不是努力不夠，是定義不清",
      "先對齊要解哪一層，再開口",
      keyShort ? `記住卡點：${clipPhrase(keyShort, 14)}` : "把今天寫成一句用得上的標題",
    ],
  };
  const quotes = [...(sets[category] || sets["覺察"])];
  if (category === "人間關係" && otherLabel && otherLabel !== "自己") {
    quotes[1] = `你給完整解法，${otherLabel}只要眼前一步`;
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
    人間關係: "沒講清楚的好意，變成一場誤會的吵架",
    事業經營: "卡在目標層級，不是卡在能力",
    身心狀態: "負載已經超過當下能處理的單位",
    覺察: "任務定義沒講清楚，復盤就停在表面",
  }[category];

  if (isComm) themeTitle = "沒講清楚的好意，變成一場誤會的吵架";
  if (/決定/.test(text) && !isComm) themeTitle = "決定做了，執行層級還沒拆";
  if (isWin && !isComm) themeTitle = "做成了，但成功定義還是模糊";
  if (/卡/.test(text) && !isComm) themeTitle = "卡住的不是事情，是任務定義";

  const themeStars = isComm ? 4 : category === "身心狀態" ? 4 : isWin ? 3 : 4;

  const turning = detectTurningWord(text);
  const themeInsight = isComm
    ? `核心問題不是態度，是目標沒對齊。你這邊在推宏觀規劃（效率、一次到位、把路鋪完）；${otherLabel}要的是微觀當下（眼前這一件、步驟清楚、先做完再說）。資訊沒對上，再正確的方案也會被聽成被塞任務。`
    : category === "事業經營"
      ? `卡點不是能力不夠。是「一次做到位」和「先做眼前能完成的一步」兩套目標疊在一起，資訊沒拆開，行動就空轉。${keyShort ? `停在「${keyShort}」。` : ""}`
      : category === "身心狀態"
        ? "落差很清楚：行程還在加碼，身體已經降速。還用宏觀效率去壓微觀負載，系統就會關機。"
        : `結構問題：事情說完了，任務定義沒講清。${keyShort ? `「${keyShort}」是卡點。` : ""}先回答「這次要解哪一層」，後面才有下一步。`;

  const problems = [];

  problems.push({
    title: isComm
      ? "核心盲點：宏觀規劃 vs 微觀當下"
      : "核心盲點：任務定義沒對齊",
    stars: 5,
    body: keyShort
      ? `你寫了「${keyShort}」。${isComm ? `一邊要的是完整解法與最高效率，一邊要的是眼前簡單需求。兩邊都在做事，但目標層級不同，資訊就對不齊。` : "事件有了，成功標準沒寫死：一次到位，還是先做完眼前？沒這句，後面全是空轉。"}`
      : isComm
        ? `一方追效率與完整規劃，一方只想處理眼前需求。目標層級不同，對話一定歪。`
        : "事情可以寫得很完整，但沒定義這次要解哪一層，復盤就只是流水帳。",
  });

  if (isComm) {
    problems.push({
      title: "溝通誤區：理性解法跳過步驟對齊",
      stars: 5,
      body: `你的解法可能是對的，但走太快。${otherLabel}需要的是先確認「現在只要眼前這一步」，再決定要不要展開。跳過這層，對方會覺得被塞進沒共識的巨大任務，焦慮或關機。升溫常卡在「${turning.word}」。改口：「${turning.alt}」`,
    });
  }

  if (vagueHits.length) {
    problems.push({
      title: `資訊模糊：「${vagueHits[0]}」讓目標對不齊`,
      stars: 3,
      body: `「${vagueHits.slice(0, 2).join("、")}」把具體需求蓋住了。對齊前先換成可執行的單位：要解哪一件、做到哪一步算完成。`,
    });
  }

  if (problems.length < 2) {
    problems.push({
      title: "實戰修正：先對齊層級，再給方案",
      stars: 4,
      body: "下次先問：這次要一次到位，還是先做眼前？確認完再給步驟。不要一開口就丟完整計畫。",
    });
  }

  if (problems.length < 3 && isWin) {
    problems.push({
      title: "做成了，但成功定義還可以寫死",
      stars: 3,
      body: keyShort
        ? `「${keyShort}」是有效動作。把它標成可複用的步驟，而不是「還不夠好」的模糊感覺。`
        : "今天有一個做成。寫下完成標準，下次才複製得了。",
    });
  }

  if (problems.length < 3 && !isComm) {
    problems.push({
      title: "下一步還停在抽象",
      stars: 3,
      body: "感受有了，執行單位沒有。把下一步收到明天做得到的一個動作，復盤才算收斂。",
    });
  }

  const eventList = [
    `發生了什麼：${sentences[0] || keyShort || text}`,
    hasPeople
      ? `對方的訴求：${otherLabel}要的是眼前好處理完的需求，不是一次被塞進完整規劃。`
      : "對方的訴求：這次主要是自己對自己。要對齊的是「這次只解哪一層」。",
    `你的解決方案：${sentences[1] || (keyShort ? `你丟出了「${keyShort}」這套做法或規劃。` : "你先給了解法，動機與目標層級還沒講清楚。")}`,
  ];

  const reactionList = hasPeople
    ? [
        `對方的反應：${otherLabel}的額度沒有你以為的那麼高，聽到的是被塞進沒共識的任務，不是好意。`,
        "你的反應：急著把完整解法一次講完，對話停在做法與語氣。",
        `落差：一邊在做宏觀規劃，一邊只要微觀當下。${keyShort ? `卡在「${keyShort}」。` : "資訊沒對齊，好意就變成壓力。"}`,
      ]
    : [
        "對方的反應：沒有外部對象，卡住的是自己對任務層級的判斷。",
        "你的反應：事情說完了，成功標準還沒寫死。",
        `落差：事件有了，定義沒有。${keyShort ? `停在「${keyShort}」。` : "下一步因此還是抽象。"}`,
      ];

  const whyNeed = isComm
    ? `核心盲點：你追的是宏觀規劃（效率、一次到位、把路鋪完）；${otherLabel}追的是微觀當下（眼前簡單需求、步驟清楚）。目標層級不同，資訊就對不齊。`
    : category === "事業經營"
      ? "核心盲點：「一次做到位」和「先做眼前能完成的一步」疊在一起，成功標準沒拆開。"
      : category === "身心狀態"
        ? "核心盲點：行程目標是加碼，身體目標是降速。兩套負載標準在搶同一個系統。"
        : "核心盲點：事件有了，這次要解哪一層還沒定義。";

  const whatFact = isComm
    ? `溝通誤區：理性解法走太快，跳過「確認當前目標＋步驟對齊」。${otherLabel}會覺得被塞進沒共識的巨大任務。升溫常卡在「${turning.word}」。${keyShort ? `畫面：「${keyShort}」。` : ""}`
    : `溝通誤區：先丟完整方案，再補定義。${keyShort ? `卡在「${keyShort}」。` : ""}順序反了，後面全是摩擦。`;

  const howNext = isComm
    ? `實戰修正：先問「現在只要眼前這一件，還是整套方案？」確認完再給步驟。把「${turning.word}」換成「${turning.alt}」。`
    : "實戰修正：先寫死這次要解哪一層，再給一個明天做得到的動作。不要一開口就上完整計畫。";

  const turningPoint = isComm
    ? `轉折發生在方案先於確認出場，或「${turning.word}」把討論推成對抗的那一步。`
    : "轉折發生在還沒定義任務層級，就直接加速處理的那一步。";

  const nextScripts = isComm
    ? [
        `「我想先對齊一下：我以為是在幫忙把路鋪完，你會不會以為我在加任務？」`,
        `「${turning.alt}」`,
        `「方案我可以給。你要我現在只處理眼前，還是一起看完整路徑？」`,
      ]
    : [
        `「我先講我以為的：我以為卡在執行。你覺得真正卡住的是哪一層？」`,
        `「這次我先只做眼前這一步，做完再決定要不要展開。」`,
        `「完整計畫先放著。現在只處理：明天做得到的那一件。」`,
      ];

  const reflection = isComm
    ? `問題核心：少了那個「為什麼」。${otherLabel}接收到的只是一個莫名其妙、多此一舉的要求，聽不到你的好意從哪來。${keyShort ? `回頭看「${keyShort}」，` : ""}解法本身可能沒問題，缺的是先講動機、再對齊對方現在要的額度。`
    : hasWhy
      ? `問題核心：原因碰到了，但沒被單獨講清楚。少了「這次要解哪一層」，後面的做法就會像多此一舉。回頭看「${keyShort || "今天這一段"}」，先補定義，再給方案。`
      : `問題核心：少了那個「為什麼」。事情說完了，對方或自己接收到的只是一個沒有來由的要求。回頭看「${keyShort || "今天這一段"}」，先講動機，再動手。`;

  const conclusion = isComm
    ? "好意要先講清楚為什麼，再給方案，否則再對的解法也會變成一場誤會。"
    : {
        事業經營: "先寫死這次要解哪一層，再給方案，否則努力會空轉。",
        身心狀態: "先承認當下負載，再談效率，否則行程會把身體當機器。",
        覺察: "先講清楚為什麼要做，再決定怎麼做。",
      }[category] || "先講清楚為什麼，再給方案。";

  const thinkGuide = isComm
    ? `兩邊以為的是同一件事嗎？你以為在幫忙，${otherLabel}以為在被加任務。先對齊這個，再給方案。`
    : "先問：我以為卡在哪裡，實際卡住的是不是『兩邊以為的不是同一件事』？";

  const quotes = buildCoachQuotes({ category: isComm ? "人間關係" : category, hasWhy, otherLabel, keyShort });

  const assumptionGap = {
    line: isComm
      ? `我以為是在幫忙把路鋪完，${otherLabel === "自己" ? "當時的自己" : "他"}以為是被塞進沒共識的任務`
      : category === "身心狀態"
        ? "我以為再撐一下就過了，身體以為系統該關機了"
        : "我以為卡在執行，其實卡在兩邊以為的不是同一件事",
    mine: isComm
      ? "我以為給完整方案就是在乎、就是幫忙。"
      : "我以為事情說清楚了，下一步就會自然發生。",
    theirs: hasPeople
      ? `${otherLabel}以為這是找麻煩，或被加進沒講好的工作量。`
      : "當時的自己以為缺的是更多努力，不是更清楚的定義。",
  };

  const mindsetList = [
    isComm
      ? "你的盲點：以為給完整方案就是在乎，沒先講為什麼，也沒問對方現在只要哪一層。"
      : "你的盲點：事情說完了，這次要解哪一層還沒定義。",
    hasPeople
      ? `對方的盲點：${otherLabel}把你的規劃聽成被塞任務，沒聽到你的好意從哪來。`
      : "對方的盲點：這次主要是自己對自己。卡住的是任務定義，不是能力。",
    isComm
      ? "你的心態：想一次把路鋪完，讓後面少受苦。"
      : "你的心態：想把今天這件事處理完，但還沒講清楚為什麼要這樣做。",
    hasPeople
      ? `對方的心態：${otherLabel}當下要的可能只是眼前好處理完的一步，額度沒有你以為的那麼高。`
      : "對方的心態：當時的自己其實只要一個做得到的單位，不是完整計畫。",
  ];

  const gratitudeList = hasGratitude
    ? [
        "感謝自己有把這段話講出來，落差才看得見。",
        hasPeople ? `感謝${otherLabel}其實有訴求，只是層級沒對上。` : "感謝今天這段卡住，把任務定義不夠清楚這件事顯影了。",
        keyShort ? `感謝「${clipPhrase(keyShort, 16)}」把真正要對齊的那一步標出來。` : "感謝這次摩擦，讓「先講為什麼再給方案」變成可帶走的一課。",
      ]
    : [
        "感謝自己願意復盤，而不是把摩擦當成個性問題。",
        hasPeople ? `感謝${otherLabel}把真實額度露出來，才知道方案走太快。` : "感謝卡住本身：它指出「這次要解哪一層」還沒講清。",
        "感謝今天這件事，讓「先對齊，再給解法」變成一句用得上的標題。",
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
      ? "感恩有提到。把具體的人、那一句話、那個動作再補清楚。"
      : "原文沒提感恩。以上三條是從事件裡提煉的正向轉念，可改可留。",
    sfm: [
      {
        type: "story",
        title: "今天的畫面",
        body: keyShort ? `卡點畫面：${clipPhrase(key, 40)}` : "今天把事件講出來了，接下來要拆的是目標層級。",
      },
      {
        type: "feeling",
        title: "當下的感覺",
        body: isComm
          ? "不是想贏，是方案先出場、對齊還沒做完，雙方都在防衛。"
          : "不是懶，是任務定義不清楚，系統不知道先做哪一層。",
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
  const theme = organize?.themeTitle || "目標層級沒對齊，解法就變成壓力";
  const problem = organize?.problems?.[0]?.title || "宏觀規劃 vs 微觀當下";
  const actionHint = selected?.[0]?.label || "";
  const replyHint = String(reply || "").trim();
  const last = round >= 5;
  const otherFromTheme = /女友/.test(`${theme}${problem}${organize?.conclusion || ""}`) ? "女友" : "對方";

  const keyWord = organize?.keyWord || "為什麼";
  const keyWordAlt = organize?.keyWordAlt || "先確認：你現在要解的是眼前這一件，還是整套方案？";
  const methodActions = [
    {
      label: "先對齊彼此以為的",
      detail: `「我想先對齊一下：我以為是在幫忙，你會不會以為我在加任務？」`,
    },
    {
      label: "把真實想法講出來",
      detail: `「${keyWordAlt}」`,
    },
    {
      label: "用這句跟對方開口",
      detail: `「方案我可以給。你要我現在只處理眼前，還是一起看完整路徑？」`,
    },
  ];

  const gapLine = organize?.assumptionGap?.line || `我以為是在幫忙，${otherFromTheme}以為是被加任務`;

  const rounds = [
    {
      title: "下一步引導 / 深度思考",
      question: `「${clipPhrase(gapLine, 36)}」——兩邊以為的是同一件事嗎？`,
      insight: `盲點是「${clipPhrase(problem, 22)}」。先對齊我以為／他以為，再給方案。下次改口：「${keyWordAlt}」`,
      actions: methodActions,
    },
    {
      title: "用方法走一步",
      question: actionHint
        ? `你選了「${actionHint}」。開口前先回答：${otherFromTheme}現在的目標是宏觀還是微觀？`
        : `如果先問${otherFromTheme}「現在只要哪一步」，你猜答案是眼前這件，還是整套方案？`,
      insight: `誤區通常是理性解法跳步。順序應是：確認當前目標 → 聲明你能給的層級 → 再問要不要展開。把「${keyWord}」換成「${keyWordAlt}」。`,
      actions: methodActions,
    },
    {
      title: "對齊之後再給方案",
      question: replyHint
        ? `你剛說「${clipPhrase(replyHint, 20)}」。這句裡，目標層級是眼前一步，還是一次到位？`
        : "你自己要的是效率最大化，還是先把眼前需求做完？兩件事不要一次塞。",
      insight: "對自己也要對齊：先寫死這次只解哪一層。層級清楚，對外才講得準。",
      actions: [
        { label: "改口練習", detail: `把跳太快的那句，改成：「${keyWordAlt}」` },
        { label: "先寫再傳", detail: "「我可以給完整方案。你現在要的是眼前這一件，還是整條路徑？」" },
        { label: "拆成一步", detail: "「我們先只做這一步，做完再決定要不要展開。」" },
      ],
    },
    {
      title: "收到明天做得到的一步",
      question: "明天實際開口時，第一句要用哪一句對齊目標？",
      insight: "「下次溝通好一點」無效。有效的是第一句先對齊層級，再給步驟。",
      actions: methodActions,
    },
    {
      title: "把這一層帶走",
      question: last
        ? "如果只帶走一個判斷，是「目標沒對齊」還是「解法跳太快」？"
        : "還有哪個步驟你會在下次對話直接改掉？",
      insight: "收束：先對齊目標層級，再給方案。勾選的腳本下次照唸即可。",
      actions: methodActions,
    },
  ];

  const current = rounds[Math.max(0, Math.min(4, round - 1))] || rounds[0];
  return {
    title: current.title,
    question: current.question,
    insight: current.insight,
    actions: current.actions || methodActions,
  };
}

function applyOrganizeResult(result, source) {
  const safe = result && typeof result === "object" ? result : localOrganize("");
  state.organize = safe;
  if (source) state.organizeSource = source;
  state.selectedQuotes = collectQuoteKeys(safe).filter((key) => key.startsWith("quote:"));
  state.selectedSfm = collectQuoteKeys(safe).filter((key) => key.startsWith("sfm:"));
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
    const rawText = String(input && input.value ? input.value : "").trim();
    if (!rawText) {
      showToast("先用講的或寫的，留一段今天的話。");
      return;
    }

    state.rawText = rawText;
    const token = (runOrganize._token || 0) + 1;
    runOrganize._token = token;

    applyOrganizeResult(localOrganize(rawText), "local");
    applyThinkResult(localThink(state.organize, 1, [], ""), 1, { silent: true });
    showToast("先出本地草稿，接著呼叫雲端 AI…");
    maybeEnhanceWithApi(rawText, token);
  } catch {
    try {
      const fallback = document.getElementById("reviewText")?.value.trim() || "今天把這段話講出來了。";
      state.rawText = fallback;
      applyOrganizeResult(localOrganize(fallback), "local");
      applyThinkResult(localThink(state.organize, 1, [], ""), 1, { silent: true });
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
  return {
    title: String(result.title || "再往前深一層"),
    question: String(result.question || fallback.question),
    insight: String(result.insight || fallback.insight),
    actions,
  };
}

function applyThinkResult(raw, nextRound, options = {}) {
  const result = normalizeThinkResult(raw, nextRound);
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
    applyThinkResult(localThink(state.organize, nextRound, selected, reply), nextRound);
    enhanceThinkWithApi(nextRound, selected, reply, token);
  } catch {
    try {
      const nextRound = Math.min((state.think.round || 0) + 1, state.think.max || 5);
      applyThinkResult(localThink(state.organize, nextRound, [], String(replyText || "")), nextRound);
    } catch {
      showToast("深度思考已就緒，請再點一次。");
    }
  }
}

async function enhanceThinkWithApi(nextRound, selected, reply, token) {
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
  const rawText = document.getElementById("reviewText").value.trim() || state.rawText;
  if (!rawText && !state.organize) {
    showToast("還沒有內容可以完成。");
    return;
  }

  const gratitude = document.getElementById("gratitudeInput")?.value.trim() || state.gratitude;
  const organize = state.organize;
  const selectedQuoteTexts = [];
  if (organize) {
    (organize.quotes || []).forEach((quote, index) => {
      if (state.selectedQuotes.includes(`quote:${index}`)) selectedQuoteTexts.push(quote);
    });
  }

  upsertReview(iso, {
    rawText,
    organize,
    gratitude,
    selectedQuotes: state.selectedQuotes,
    selectedSfm: state.selectedSfm,
    thinkHistory: state.think.history,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const sfmItems = getSfm();
  const existingBodies = new Set(sfmItems.map((item) => item.body));
  if (organize) {
    (organize.sfm || []).forEach((item, index) => {
      const body = String(item.body || "").trim();
      if (!state.selectedSfm.includes(`sfm:${index}`) || !body || existingBodies.has(body)) return;
      sfmItems.unshift({
        id: uid(),
        type: ["story", "feeling", "meaning"].includes(item.type) ? item.type : inferSfmType(body),
        title: item.title || excerptText(body, 18),
        body,
        source: "今日復盤",
        date: iso,
        createdAt: new Date().toISOString(),
      });
      existingBodies.add(body);
    });
    selectedQuoteTexts.forEach((quote) => {
      if (!quote || existingBodies.has(quote)) return;
      const type = inferSfmType(quote);
      sfmItems.unshift({
        id: uid(),
        type,
        title: excerptText(quote, 18),
        body: quote,
        source: "今日復盤",
        date: iso,
        createdAt: new Date().toISOString(),
      });
      existingBodies.add(quote);
    });
    saveSfm(sfmItems);
  }

  const actionInputs = [...document.querySelectorAll("[data-action]:checked")];
  const tasks = getTasks();
  const existingTitles = new Set(tasks.map((task) => task.title));
  actionInputs.forEach((input) => {
    const title = `${input.dataset.label}${input.dataset.detail ? `：${input.dataset.detail}` : ""}`.trim();
    if (!title || existingTitles.has(title)) return;
    tasks.unshift({
      id: uid(),
      title,
      status: "doing",
      source: "今日復盤",
      createdAt: new Date().toISOString(),
    });
    existingTitles.add(title);
  });
  saveTasks(tasks);

  updateStats();
  showToast("今日復盤已完成，筆記、金句與下一步都收好了。");
}

function inferSfmType(text) {
  if (/感覺|感受|難過|焦慮|安心|累|暖|悶|害怕|感動|委屈/.test(text)) return "feeling";
  if (/原來|其實|意義|明白|學會|提醒|重要/.test(text)) return "meaning";
  return "story";
}

function clearReview() {
  document.getElementById("reviewText").value = "";
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
  const rate = report.days ? Math.round((report.filledDays / report.days) * 100) : 0;

  if (!report.filledDays) {
    root.innerHTML = `
      <article class="report-card">
        <div class="empty">
          <p class="empty__title">這個區間還沒有復盤</p>
          <p class="report-empty">寫下第一篇之後，週月報會自動幫你數天數、算節奏、提煉常出現的字。</p>
        </div>
      </article>
    `;
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
}

function renderTasks() {
  const list = document.getElementById("taskList");
  const tasks = getTasks().filter((task) => state.taskFilter === "all" || task.status === state.taskFilter);

  if (!getTasks().length) {
    list.innerHTML = `<div class="empty"><p class="empty__title">還沒有下一步</p>從今日復盤勾選行動，或在上方手動新增一件最小的事。</div>`;
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
    grid.innerHTML = `<div class="empty"><p class="empty__title">素材庫還是空的</p>完成今日復盤時，勾選金句就會自動來到這裡，供日後發文或寫作使用。</div>`;
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
          <p class="sfm-card__type">${escapeHtml(SFM_TYPE_LABEL[item.type] || item.type)}</p>
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
  const think = (review.thinkHistory || [])
    .map((round, index) => `<p><strong>第 ${index + 1} 輪</strong> ${escapeHtml(round.question || "")}<br>${escapeHtml(round.insight || "")}</p>`)
    .join("");
  const eventHtml = renderBulletList(ai.eventList, ai.event);
  const gratitudeHtml = renderBulletList(ai.gratitudeList, ai.gratitudeNote);
  return `
    <div class="history-report">
      <p><strong>【主標題與評等】【${escapeHtml(ai.themeCategory || "")}】</strong>主題：${escapeHtml(ai.themeTitle || "")} [${starsText(ai.themeStars)}]</p>
      ${renderConclusionCallout(ai.conclusion || ai.themeInsight || "")}
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
      const textarea = document.getElementById("reviewText");
      const prefix = textarea.value && !textarea.value.endsWith("\n") ? `${textarea.value}` : textarea.value;
      textarea.value = `${prefix}${finalText}`;
    };
    recognition.onend = () => {
      state.listening = false;
      btn.classList.remove("is-on");
      document.getElementById("micLabel").textContent = "語音";
    };
    state.recognition = recognition;
  } catch {
    const btn = document.getElementById("micBtn");
    if (btn) btn.hidden = true;
  }
}

function toggleMic() {
  if (!state.recognition) return;
  const btn = document.getElementById("micBtn");
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  try {
    state.recognition.start();
    state.listening = true;
    btn.classList.add("is-on");
    document.getElementById("micLabel").textContent = "聆聽中";
  } catch {
    showToast("無法啟動語音輸入，也可以用鍵盤麥克風。");
  }
}


/* =============================================================================
 * 事件
 * =========================================================================== */

function bindEvents() {
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

  document.getElementById("promptChips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-prompt]");
    if (chip) insertPrompt(chip.dataset.prompt);
  });

  document.getElementById("reviewDate").addEventListener("change", () => {
    loadReviewForDate(currentIso());
    updateStats();
  });

  document.getElementById("clearReview").addEventListener("click", clearReview);
  const organizeBtn = document.getElementById("btnOrganize");
  organizeBtn.disabled = false;
  organizeBtn.addEventListener("click", runOrganize);
  document.getElementById("micBtn").addEventListener("click", toggleMic);

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
    }
    if (sfm) {
      state.selectedSfm = event.target.checked
        ? [...new Set([...state.selectedSfm, sfm])]
        : state.selectedSfm.filter((item) => item !== sfm);
    }
    if (action) {
      state.selectedThinkActions = event.target.checked
        ? [...new Set([...state.selectedThinkActions, action])]
        : state.selectedThinkActions.filter((item) => item !== action);
    }
    const practice = event.target.dataset.practice;
    if (practice) {
      state.selectedPractice = event.target.checked
        ? [...new Set([...(state.selectedPractice || []), practice])]
        : (state.selectedPractice || []).filter((item) => item !== practice);
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
      showToast("已從素材庫移除。");
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
  } catch {
    /* 其餘初始化失敗也不擋「開始整理」 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
