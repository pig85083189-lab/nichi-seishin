/* =============================================================================
 * 日精進 — 經由 /api/review（Vercel）呼叫 OpenAI，失敗則立刻本地教練
 * 前端不直連 OpenAI，避免 CORS；畫面先出本地結果，AI 回來再加深，絕不卡在「整理中...」。
 * =========================================================================== */

const REVIEW_API = "/api/review";
const API_TIMEOUT_MS = 12000;


/* =============================================================================
 * 常數與狀態
 * =========================================================================== */

const STORAGE_KEYS = {
  reviews: "nichi.reviews",
  tasks: "nichi.tasks",
  sfm: "nichi.sfm",
  reminder: "nichi.reminder",
  ai: "nichi.ai",
  sidebar: "nichi.sidebarCollapsed",
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
  later: "先放著",
  done: "已完成",
};

const HISTORY_TAGS = ["事業經營", "人間關係", "身心狀態", "覺察"];

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
  think: { round: 0, max: 5, history: [], current: null },
  thinkToken: 0,
  selectedQuotes: [],
  selectedSfm: [],
  selectedThinkActions: [],
  gratitude: "",
  messages: [],
  remindedDate: "",
  recognition: null,
  listening: false,
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

function getAiSettings() {
  return { via: REVIEW_API };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const name = error && error.name;
    const message = String((error && error.message) || error);
    if (name === "AbortError" || /aborted/i.test(message)) throw new Error("API_TIMEOUT");
    if (/failed to fetch|networkerror|cors|load failed/i.test(message) || name === "TypeError") {
      throw new Error("API_NETWORK");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callReviewApi(payload) {
  const response = await fetchWithTimeout(
    REVIEW_API,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    API_TIMEOUT_MS
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.data) throw new Error(json.error || `API_${response.status}`);
  return json.data;
}

function normalizeOrganizeResult(remote, rawText) {
  const local = localOrganize(rawText);
  if (!remote || typeof remote !== "object") return local;
  const problems = Array.isArray(remote.problems) ? remote.problems.filter(Boolean) : [];
  const quotes = Array.isArray(remote.quotes) ? remote.quotes.filter(Boolean) : [];
  const eventList = Array.isArray(remote.eventList) ? remote.eventList.filter(Boolean) : [];
  const reactionList = Array.isArray(remote.reactionList) ? remote.reactionList.filter(Boolean) : [];
  return {
    themeCategory: remote.themeCategory || local.themeCategory,
    themeTitle: remote.themeTitle || local.themeTitle,
    problems: problems.length ? problems : local.problems,
    eventList: eventList.length ? eventList : local.eventList,
    reactionList: reactionList.length ? reactionList : local.reactionList,
    event: remote.event || (eventList.length ? eventList.join("\n") : local.event),
    othersReaction: remote.othersReaction || (reactionList.length ? reactionList.join("\n") : local.othersReaction),
    reflection: remote.reflection || local.reflection,
    conclusion: remote.conclusion || local.conclusion,
    quotes: quotes.length ? quotes : local.quotes,
    gratitudeNote: remote.gratitudeNote || local.gratitudeNote,
    gratitudeMissing: remote.gratitudeMissing ?? local.gratitudeMissing,
    sfm: Array.isArray(remote.sfm) && remote.sfm.length ? remote.sfm : local.sfm,
    tags: Array.isArray(remote.tags) && remote.tags.length ? remote.tags : local.tags,
  };
}

async function callOpenAIOrganize(rawText) {
  return callReviewApi({
    mode: "organize",
    text: rawText,
    date: currentIso(),
  });
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

function setSidebarOpen(open) {
  document.getElementById("sidebar").classList.toggle("is-open", open);
  document.getElementById("overlay").hidden = !open;
  document.getElementById("menuToggle").setAttribute("aria-expanded", String(open));
}

function toggleMenu() {
  if (isMobile()) {
    setSidebarOpen(!document.getElementById("sidebar").classList.contains("is-open"));
    return;
  }
  const app = document.getElementById("app");
  const collapsed = !app.classList.contains("is-sidebar-collapsed");
  app.classList.toggle("is-sidebar-collapsed", collapsed);
  localStorage.setItem(STORAGE_KEYS.sidebar, collapsed ? "1" : "0");
  document.getElementById("menuToggle").setAttribute("aria-expanded", String(!collapsed));
}

function switchPage(page) {
  state.page = page;
  document.querySelectorAll(".nav__item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach((section) => {
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
  return document.getElementById("reviewDate").value || toInputDate(new Date());
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
  state.think = { round: 0, max: 5, history: [], current: null };
  state.thinkToken = (state.thinkToken || 0) + 1;
  state.selectedQuotes = [];
  state.selectedSfm = [];
  state.selectedThinkActions = [];
  state.gratitude = "";
  state.messages = [];
}

function loadReviewForDate(iso) {
  const review = getReview(iso);
  document.getElementById("reviewText").value = review?.rawText || "";
  resetAiSession();
  if (review?.organize) {
    state.organize = review.organize;
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
  if (/整理中/.test(root.textContent || "") && !state.organize) {
    root.innerHTML = "";
  }

  if (!state.organize) {
    root.innerHTML = "";
    return;
  }

  const ai = state.organize;
  const problems = Array.isArray(ai.problems) ? ai.problems : [];
  const quotes = Array.isArray(ai.quotes) ? ai.quotes : [];
  const sfm = Array.isArray(ai.sfm) ? ai.sfm : [];
  const think = state.think.current;

  const quoteChecks = quotes
    .map((quote, index) => {
      const key = `quote:${index}`;
      const checked = state.selectedQuotes.includes(key) ? "checked" : "";
      return `<label class="quote-item"><input type="checkbox" data-quote="${key}" ${checked} /><span>${escapeHtml(quote)}</span></label>`;
    })
    .join("");

  const sfmChecks = sfm
    .map((item, index) => {
      const key = `sfm:${index}`;
      const checked = state.selectedSfm.includes(key) ? "checked" : "";
      return `<label class="quote-item"><input type="checkbox" data-sfm="${key}" ${checked} /><span><strong>${escapeHtml(SFM_TYPE_LABEL[item.type] || item.type)}</strong>　${escapeHtml(item.body || item.title || "")}</span></label>`;
    })
    .join("");

  const history = Array.isArray(state.think.history) ? state.think.history : [];
  const pastRounds = think
    ? history.slice(0, -1)
    : [];
  const pastHtml = pastRounds
    .map((round, index) => `
      <article class="think-card" style="opacity:.78">
        <p class="think-card__round">深度思考｜已完成　第 ${index + 1}/${state.think.max} 輪</p>
        <h3>${escapeHtml(round.question || "")}</h3>
        <p class="think-card__q">${escapeHtml(round.insight || "")}</p>
      </article>
    `)
    .join("");

  const thinkActions = (think?.actions || [])
    .map((item, index) => {
      const key = `think:${state.think.round}:${index}`;
      const checked = state.selectedThinkActions.includes(key) ? "checked" : "";
      return `<label class="check-row"><input type="checkbox" data-action="${key}" data-label="${escapeHtml(item.label || "")}" data-detail="${escapeHtml(item.detail || "")}" ${checked} /><span><strong>${escapeHtml(item.label || "下一步")}</strong><small>${escapeHtml(item.detail || "")}</small></span></label>`;
    })
    .join("");

  const thinkBlock = think
    ? `
      ${pastHtml}
      <article class="think-card" id="thinkCurrent">
        <p class="think-card__round">深度思考｜${escapeHtml(think.title || "再往前深一層")}　第 ${state.think.round}/${state.think.max} 輪</p>
        <h3>${escapeHtml(think.question || "")}</h3>
        <p class="think-card__q">${escapeHtml(think.insight || "")}</p>
        <p class="chips-label">下一步可以做的</p>
        <div class="check-list">${thinkActions}</div>
        <label class="field" style="margin-top:16px">
          <span class="field__label">你想接續回覆的（選填）</span>
          <textarea class="textarea" id="thinkReply" rows="3" placeholder="勾選行動後，也可以再寫一句你現在想到的…"></textarea>
        </label>
        <div class="ai-actions">
          ${state.think.round < state.think.max ? `<button class="btn btn--ghost" id="btnThinkSubmit" type="button">送出，進入下一輪</button>` : ""}
        </div>
      </article>
    `
    : "";

  root.innerHTML = `
    <article class="theme-banner">
      <p class="theme-banner__kicker">主題提煉</p>
      <h3 class="theme-banner__title">【${escapeHtml(ai.themeCategory || "覺察")}】主題：${escapeHtml(ai.themeTitle || "今天的復盤")}</h3>
    </article>
    ${problems
      .map((item, index) => {
        const names = ["一", "二", "三", "四", "五"];
        return `
          <article class="problem-card">
            <div class="problem-card__head">
              <h3 class="problem-card__title">【${names[index] || index + 1}、${escapeHtml(item.title || "")}】</h3>
              <span class="stars">[${starsText(item.stars)}]</span>
            </div>
            <p class="problem-card__body">${escapeHtml(item.body || "")}</p>
          </article>
        `;
      })
      .join("")}
    <article class="ai-block">
      <h3>事件拆解</h3>
      ${renderBulletList(ai.eventList, ai.event)}
    </article>
    <article class="ai-block">
      <h3>結果與反應</h3>
      ${renderBulletList(ai.reactionList, ai.othersReaction)}
    </article>
    <article class="ai-block">
      <h3>事後反思</h3>
      <p>${escapeHtml(ai.reflection || "")}</p>
    </article>
    <article class="ai-block conclusion-card">
      <h3>核心結論</h3>
      <p class="conclusion-card__text">${escapeHtml(ai.conclusion || "")}</p>
    </article>
    <article class="ai-block gold-block">
      <h3>【今日金句】</h3>
      ${(quotes.length ? quotes : []).map((quote) => `<p class="gold-quote">${escapeHtml(quote)}</p>`).join("")}
      <p class="sfm-hint">這幾句可以拿去發文（勾選後，完成今日復盤時會直接加入『執行力』）</p>
      <div class="quote-list">${quoteChecks || sfmChecks}</div>
    </article>
    <article class="ai-block gratitude-box">
      <h3>今日沒提到了感恩</h3>
      <p>${escapeHtml(ai.gratitudeNote || "留一句感謝，今天才算被完整接住。")}</p>
      <textarea class="textarea" id="gratitudeInput" rows="3" placeholder="今天想感謝的是…">${escapeHtml(state.gratitude)}</textarea>
    </article>
    ${sfmChecks ? `
    <article class="ai-block">
      <h3>Story · Feeling · Meaning</h3>
      <p class="sfm-hint">也可勾選下面這幾段體悟，一併收入素材庫。</p>
      <div class="quote-list">${sfmChecks}</div>
    </article>` : ""}
    ${thinkBlock}
    <div class="ai-actions">
      ${!think ? `<button class="btn btn--ai-ghost" id="btnThink" type="button">開始深度思考</button>` : ""}
      <button class="btn" id="btnComplete" type="button">完成今日復盤</button>
    </div>
  `;
}

/* =============================================================================
 * 本地教練：API 失敗 / CORS / 逾時時，用高品質邏輯即時產出完整結構
 * =========================================================================== */

const COACH_PEOPLE_RE = /女友|男朋友|男友|伴侶|老婆|老公|家人|媽媽|爸爸|朋友|同事|老闆|客戶|對方/;
const COACH_WORK_RE = /工作|專案|開會|會議|老闆|客戶|業績|截止|報告|事業|創業|加班/;
const COACH_BODY_RE = /累|睡|失眠|焦慮|身體|頭痛|運動|生病|疲憊|壓力|心情/;
const COACH_COMM_RE = /溝通|說話|講了|沒說|訊息|已讀|回訊|吵架|爭執|解釋|為什麼|找麻煩/;
const COACH_WHY_RE = /為什麼|因為|原來|其實是/;
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
    .map((item) => item.replace(/^[-*•、\s]+/, "").replace(/^(今天最卡的一件事|今天讓我有成就感的是|今天我做了一個決定|今天有件事本來可以做得更好|今天想要感恩的是)[：:]\s*/, "")
      .trim())
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

  let themeTitle = {
    人間關係: "溝通卡關的真正原因",
    事業經營: "行動被卡住的真正位置",
    身心狀態: "身體比嘴巴更早說實話",
    覺察: "今天還沒被說完的那一句",
  }[category];

  if (COACH_COMM_RE.test(text) || hasPeople) themeTitle = "溝通卡關的真正原因";
  if (/決定/.test(text)) themeTitle = "做了決定，卻還沒被自己接住";
  if (isWin) themeTitle = "小小做成，為什麼自己看不見";
  if (/卡/.test(text)) themeTitle = "今天最卡住的，其實不是事情本身";

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

  if (hasPeople || COACH_COMM_RE.test(text)) {
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

  const eventList = (sentences.length ? sentences.slice(0, 4) : [text]).map((item, index) => {
    const labels = ["發生了什麼", "接著", "然後", "停在這裡"];
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

  const reflection = hasWhy
    ? `當時你急著把事情處理完，原因其實已經碰到了，只是還沒被單獨拿出來看。現在回頭看「${keyShort || "今天這一段"}」，責備可以退一步，選擇才能往前。這不是翻舊帳，是把當時沒說出口的那一句補上。`
    : `當時你急著處理事情，來不及問自己為什麼要這樣做。回頭看「${keyShort || "今天這一段"}」，少的不是努力，是先對齊的那一句。現在補上，不是為了翻舊帳，是為了下次開口前先站在同一邊。`;

  const conclusionMap = {
    人間關係: `方案再好，少了一句「為什麼」，也會被${otherLabel}當成找麻煩。把原因講出口，關心才會被聽成心意。`,
    事業經營: "卡住的不是能力不夠，是行動還沒被收到明天做得到的那一步。先對齊為什麼，再動手。",
    身心狀態: "身體比嘴巴更早說實話。今天真正該被聽見的，不是行程，是那一口還沒被允許的累。",
    覺察: "真正卡住的不是努力不夠，是有一句話還沒被說清楚。把「為什麼」講出口，今天才算被完整接住。",
  };
  const conclusion = conclusionMap[category] || conclusionMap["覺察"];

  const quotes = [
    hasWhy ? "看懂原因的那天，責備會自動變輕。" : "方案再好，少了一句為什麼，也會被當成找麻煩。",
    `成長很少是一次轉身，比較像每天把下一步放小一點。`,
    keyShort ? `記住這句：「${clipPhrase(key, 18)}」——它比完美結論更靠近你。` : "把今天寫下來，不是給別人看成績，是讓這一天確實被過過。",
  ];

  return {
    themeCategory: category,
    themeTitle,
    problems: problems.slice(0, 3),
    eventList,
    reactionList,
    event: eventList.join("\n"),
    othersReaction: reactionList.join("\n"),
    reflection,
    conclusion,
    quotes,
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
        body: "不是懶，是害怕被看見還沒對齊的地方。允許這份卡待一會兒，再補一句為什麼。",
      },
      {
        type: "meaning",
        title: "今日金句",
        body: quotes[0],
      },
    ],
    tags: [category],
  };
}

function localThink(organize, round, selected, reply) {
  const theme = organize?.themeTitle || "今天還沒說完的那一句";
  const problem = organize?.problems?.[0]?.title || "少了一句為什麼";
  const actionHint = selected?.[0]?.label || "";
  const replyHint = String(reply || "").trim();
  const last = round >= 5;

  const rounds = [
    {
      title: "再往前深一層",
      question: `圍繞「${clipPhrase(theme, 18)}」：如果你只能補一句「為什麼」，那一句會是什麼？`,
      insight: `核心問題是「${clipPhrase(problem, 22)}」。少的通常不是方法，是動機沒被聽見。把為什麼說清楚，對方才有機會站到你旁邊。`,
    },
    {
      title: "再往前深一層",
      question: actionHint
        ? `你選了「${actionHint}」。做這件事之前，你最怕對方聽到的是哪一句？`
        : "如果你把最硬的那句話，換成對方聽得進去的版本，第一句會怎麼開口？",
      insight: "找麻煩的感覺，往往來自順序反了：先給方案，再補心意。對調之後，同一句話會變成靠近。",
    },
    {
      title: "再往前深一層",
      question: replyHint
        ? `你剛說「${clipPhrase(replyHint, 20)}」。這句話裡，哪一個字是真正的需要？`
        : "這份卡住，有沒有一部分其實是對自己說的，而不只是對別人？",
      insight: "對外溝通卡住時，內在通常也有一句沒被允許說出口。對自己誠實，對外才講得準。",
    },
    {
      title: "再往前深一層",
      question: "明天最小、一定做得到的一步是什麼？小到不可能失敗的那種。",
      insight: "抽象的「下次溝通好一點」不會發生。具體的「先寫一句再傳」「補講一次為什麼」才會發生。",
    },
    {
      title: "把這一層帶走",
      question: last
        ? "如果今天只帶走一句話，你希望未來的自己記得哪一句？"
        : "走到這裡，你已經比開頭更靠近自己了。還有哪一句想留給明天？",
      insight: "五輪不是為了把你問倒，是為了讓那句為什麼終於有位置。你可以停在這裡，也可以把勾選的下一步真正做一次。",
    },
  ];

  const current = rounds[Math.max(0, Math.min(4, round - 1))] || rounds[0];
  return {
    title: current.title,
    question: current.question,
    insight: current.insight,
    actions: [
      { label: "補講一次為什麼", detail: "用一句話寫下：我說這件事，是因為我在乎……" },
      { label: "提前先寫一句", detail: "開口或傳訊前，先寫「我不是要找麻煩，我是因為在乎」。" },
      { label: "換句話說練習", detail: "把今天最硬的那句，改成對方聽得進去、自己也聽得下去的版本。" },
    ],
  };
}

function applyOrganizeResult(result) {
  const safe = result && typeof result === "object" ? result : localOrganize("");
  state.organize = safe;
  state.messages = [];
  state.selectedQuotes = collectQuoteKeys(safe).filter((key) => key.startsWith("quote:"));
  state.selectedSfm = collectQuoteKeys(safe).filter((key) => key.startsWith("sfm:"));
  state.think = { round: 0, max: 5, history: [], current: null };
  try {
    upsertReview(currentIso(), {
      rawText: document.getElementById("reviewText")?.value.trim() || "",
      organize: safe,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* 儲存失敗也不擋畫面 */
  }
  renderAiStage();
}

function runOrganize(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  const now = Date.now();
  if (runOrganize._last && now - runOrganize._last < 300) return;
  runOrganize._last = now;

  const stage = document.getElementById("aiStage");
  if (stage) {
    stage.querySelectorAll(".ai-thinking").forEach((el) => el.remove());
    if (/整理中/.test(stage.textContent || "")) stage.innerHTML = "";
  }

  const input = document.getElementById("reviewText");
  const rawText = String(input && input.value ? input.value : "").trim();
  if (!rawText) {
    showToast("先用講的或寫的，留一段今天的話。");
    return;
  }

  const token = (runOrganize._token || 0) + 1;
  runOrganize._token = token;

  applyOrganizeResult(localOrganize(rawText));
  showToast("整理完成。AI 教練若就緒，會再加深一層。");

  callOpenAIOrganize(rawText)
    .then((remote) => {
      if (runOrganize._token !== token) return;
      applyOrganizeResult(normalizeOrganizeResult(remote, rawText));
      showToast("AI 教練已把今天拆得更清楚。");
    })
    .catch(() => {
      /* 本機沒有 /api/review、逾時或金鑰未設：維持本地結果，絕不卡住 */
    });
}
window.runOrganize = runOrganize;

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

function applyThinkResult(raw, nextRound) {
  const result = normalizeThinkResult(raw, nextRound);
  state.think.round = nextRound;
  state.think.current = result;
  if (!Array.isArray(state.think.history)) state.think.history = [];
  state.think.history.push(result);
  state.selectedThinkActions = [];
  try {
    upsertReview(currentIso(), {
      organize: state.organize,
      thinkHistory: state.think.history,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
  renderAiStage();
  showToast(`深度思考｜第 ${nextRound}/${state.think.max} 輪`);
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
    const token = (runThink._token || 0) + 1;
    runThink._token = token;
    applyThinkResult(localThink(state.organize, nextRound, selected, reply), nextRound);

    const rawText = document.getElementById("reviewText")?.value.trim() || "";
    callReviewApi({
      mode: "think",
      text: rawText,
      organize: state.organize,
      round: nextRound,
      max: state.think.max,
      actions: selected,
      reply,
    })
      .then((remote) => {
        if (runThink._token !== token) return;
        if (!state.think.history.length) return;
        state.think.history.pop();
        applyThinkResult(remote, nextRound);
      })
      .catch(() => {});
  } catch (error) {
    try {
      const nextRound = Math.min((state.think.round || 0) + 1, state.think.max || 5);
      applyThinkResult(localThink(state.organize, nextRound, [], String(replyText || "")), nextRound);
    } catch {
      showToast("深度思考已就緒，請再點一次。");
    }
  }
}

function completeToday() {
  const iso = currentIso();
  const rawText = document.getElementById("reviewText").value.trim();
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
    grid.innerHTML = `<div class="empty"><p class="empty__title">執行力還是空的</p>完成今日復盤時，勾選金句就會自動來到這裡，供日後發文或寫作使用。</div>`;
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
      const report = open && ai ? renderHistoryReport(review) : open ? `<div class="history-report"><p>${escapeHtml(review.rawText || "")}</p></div>` : "";
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
  const problems = (ai.problems || [])
    .map((item, index) => {
      const names = ["一", "二", "三", "四", "五"];
      return `<p><strong>【${names[index] || index + 1}、${escapeHtml(item.title || "")}】</strong> [${starsText(item.stars)}]<br>${escapeHtml(item.body || "")}</p>`;
    })
    .join("");
  const quotes = (ai.quotes || []).map((quote) => `<p class="gold-quote">${escapeHtml(quote)}</p>`).join("");
  const think = (review.thinkHistory || [])
    .map((round, index) => `<p><strong>第 ${index + 1} 輪</strong> ${escapeHtml(round.question || "")}<br>${escapeHtml(round.insight || "")}</p>`)
    .join("");
  const eventHtml = renderBulletList(ai.eventList, ai.event);
  const reactionHtml = renderBulletList(ai.reactionList, ai.othersReaction);
  return `
    <div class="history-report">
      <p><strong>【${escapeHtml(ai.themeCategory || "")}】主題：</strong>${escapeHtml(ai.themeTitle || "")}</p>
      ${problems}
      <p><strong>事件拆解</strong></p>
      ${eventHtml}
      <p><strong>結果與反應</strong></p>
      ${reactionHtml}
      <p><strong>事後反思</strong><br>${escapeHtml(ai.reflection || "")}</p>
      <p><strong>核心結論</strong><br>${escapeHtml(ai.conclusion || "")}</p>
      <p><strong>【今日金句】</strong></p>
      ${quotes}
      ${review.gratitude ? `<p><strong>感恩</strong><br>${escapeHtml(review.gratitude)}</p>` : ""}
      ${think}
      <p style="white-space:pre-wrap;color:#666;font-size:13px"><strong>原文</strong><br>${escapeHtml(review.rawText || "")}</p>
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

function fillApiForm() {
  const desc = document.querySelector("#apiModal .modal__desc");
  if (desc) {
    desc.textContent = "金鑰請設在 Vercel 環境變數 OPENAI_API_KEY。前端只呼叫 /api/review，不會把金鑰送到瀏覽器，也不會直連 OpenAI。";
  }
}

function onProviderChange() {}

function saveApiSettings(event) {
  if (event && event.submitter && event.submitter.value === "cancel") return;
  showToast("請在 Vercel 設定 OPENAI_API_KEY，前端會走 /api/review。");
}

/* =============================================================================
 * 事件
 * =========================================================================== */

function bindEvents() {
  document.getElementById("menuToggle").addEventListener("click", toggleMenu);
  document.getElementById("overlay").addEventListener("click", () => setSidebarOpen(false));

  document.querySelectorAll(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
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

  document.getElementById("openApiSettings").addEventListener("click", () => {
    fillApiForm();
    document.getElementById("apiModal").showModal();
    if (isMobile()) setSidebarOpen(false);
  });
  document.getElementById("apiProvider").addEventListener("change", onProviderChange);
  document.getElementById("apiForm").addEventListener("submit", saveApiSettings);

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      setSidebarOpen(false);
    }
  });
}

function init() {
  try {
    bindEvents();
  } catch (error) {
    const btn = document.getElementById("btnOrganize");
    if (btn) btn.onclick = runOrganize;
  }
  try {
    document.getElementById("headerDate").textContent = formatHeaderDate(new Date());
    document.getElementById("reviewDate").value = toInputDate(new Date());
    if (localStorage.getItem(STORAGE_KEYS.sidebar) === "1" && !isMobile()) {
      document.getElementById("app").classList.add("is-sidebar-collapsed");
      document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
    }
    renderPromptChips();
    loadReviewForDate(currentIso());
    updateStats();
    initReminder();
    setupSpeech();
    setInterval(tickReminder, 20000);
  } catch {
    /* 其餘初始化失敗也不擋「開始整理」 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
