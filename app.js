/* =============================================================================
 * 日精進 — 本地教練優先。開始整理同步秒出完整復盤，絕不卡在「整理中...」。
 * API 金鑰只從設定介面寫入 localStorage，程式碼中不存放任何密鑰。
 * =========================================================================== */

const STORAGE_KEYS = {
  reviews: "nichi.reviews",
  tasks: "nichi.tasks",
  sfm: "nichi.sfm",
  reminder: "nichi.reminder",
  ai: "nichi.ai",
  sidebar: "nichi.sidebarCollapsed",
};

const DEFAULT_AI = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
};

const PROVIDER_PRESETS = {
  gemini: { label: "Google Gemini", model: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  openai: { label: "OpenAI", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  openrouter: { label: "OpenRouter", model: "openai/gpt-4o-mini", baseUrl: "https://openrouter.ai/api/v1" },
  deepseek: { label: "DeepSeek", model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
  groq: { label: "Groq", model: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
  compatible: { label: "自訂 OpenAI 相容端點", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
};

function normalizeProvider(value) {
  return PROVIDER_PRESETS[value] ? value : "openai";
}

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
  gratitude: "",
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

function maskKey(key) {
  const value = String(key || "");
  if (value.length < 8) return value ? "已儲存" : "";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
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
 * API 設定：只讀 localStorage，絕不寫死金鑰
 * =========================================================================== */

function readApiField(id) {
  try {
    return String(document.getElementById(id)?.value || "").trim();
  } catch {
    return "";
  }
}

function getAiSettings() {
  const saved = loadJson(STORAGE_KEYS.ai, {});
  const source = saved && typeof saved === "object" ? saved : {};
  const formKey = readApiField("apiKeyInput");
  const formModel = readApiField("apiModelInput");
  const formBase = readApiField("apiBaseInput");
  const formProvider = readApiField("apiProvider");
  return {
    provider: normalizeProvider(formProvider || source.provider || DEFAULT_AI.provider),
    apiKey: formKey || String(source.apiKey || DEFAULT_AI.apiKey || "").trim(),
    model: formModel || String(source.model || DEFAULT_AI.model).trim() || DEFAULT_AI.model,
    baseUrl: formBase || String(source.baseUrl || DEFAULT_AI.baseUrl).trim() || DEFAULT_AI.baseUrl,
  };
}

function saveAiSettings(next) {
  const current = getAiSettings();
  const merged = {
    provider: normalizeProvider(next.provider || current.provider),
    apiKey: next.apiKey === undefined ? current.apiKey : String(next.apiKey || "").trim(),
    model: String(next.model || current.model || DEFAULT_AI.model).trim() || DEFAULT_AI.model,
    baseUrl: String(next.baseUrl || current.baseUrl || DEFAULT_AI.baseUrl).trim() || DEFAULT_AI.baseUrl,
  };
  saveJson(STORAGE_KEYS.ai, merged);
  return merged;
}

function clearAiSettings() {
  saveJson(STORAGE_KEYS.ai, { ...DEFAULT_AI, apiKey: "" });
}

function joinChatCompletionsUrl(baseUrl) {
  let raw = String(baseUrl || DEFAULT_AI.baseUrl).trim() || DEFAULT_AI.baseUrl;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    let path = (url.pathname || "").replace(/\/+$/, "");
    if (path === "/") path = "";
    path = path.replace(/(\/v1)+$/i, "/v1");
    if (!/\/v1$/i.test(path)) path = `${path}/v1`;
    if (!/\/chat\/completions$/i.test(path)) path = `${path}/chat/completions`;
    url.pathname = path.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    const cleaned = raw.replace(/\/+$/, "").replace(/(\/v1)+/gi, "/v1");
    if (/\/chat\/completions$/i.test(cleaned)) return cleaned;
    if (/\/v1$/i.test(cleaned)) return `${cleaned}/chat/completions`;
    return `${cleaned}/v1/chat/completions`;
  }
}

function parseAiJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI 回傳不是 JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function joinGeminiGenerateUrl(baseUrl, model, apiKey) {
  let raw = String(baseUrl || "https://generativelanguage.googleapis.com/v1beta").trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  raw = raw.replace(/\/+$/, "");
  const name = String(model || "gemini-2.0-flash").trim() || "gemini-2.0-flash";
  if (/generateContent/i.test(raw)) {
    const joiner = raw.includes("?") ? "&" : "?";
    return `${raw}${joiner}key=${encodeURIComponent(apiKey)}`;
  }
  return `${raw}/models/${name}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => String(part?.text || "")).join("").trim();
}

async function callGeminiApi(messages, settings) {
  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
  const user = messages.filter((item) => item.role !== "system").map((item) => item.content).join("\n\n");
  const response = await fetchWithTimeout(
    joinGeminiGenerateUrl(settings.baseUrl, settings.model, settings.apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}`.trim() }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    },
    8000
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data.error && data.error.message) || `GEMINI_${response.status}`);
  return parseAiJson(extractGeminiText(data));
}

async function callStoredKeyApi(messages) {
  const settings = getAiSettings();
  if (!settings.apiKey) throw new Error("NO_KEY");
  if (settings.provider === "gemini") return callGeminiApi(messages, settings);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey}`,
  };
  if (settings.provider === "openrouter") {
    headers["HTTP-Referer"] = location.origin || "https://nichi-seishin.local";
    headers["X-Title"] = "日精進";
  }
  const response = await fetchWithTimeout(
    joinChatCompletionsUrl(settings.baseUrl),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages,
      }),
    },
    8000
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data && data.error && data.error.message) || `API_${response.status}`);
  return parseAiJson(data?.choices?.[0]?.message?.content || "");
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
    themeInsight: remote.themeInsight || local.themeInsight,
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
    whyNeed: remote.whyNeed || local.whyNeed,
    whatFact: remote.whatFact || local.whatFact,
    howNext: remote.howNext || local.howNext,
    turningPoint: remote.turningPoint || local.turningPoint,
    keyWord: remote.keyWord || local.keyWord,
    keyWordAlt: remote.keyWordAlt || local.keyWordAlt,
    nextScripts: Array.isArray(remote.nextScripts) && remote.nextScripts.length ? remote.nextScripts : local.nextScripts,
  };
}

const ORGANIZE_SYSTEM_PROMPT = `你是「日精進」的溫暖且高情商深層復盤專家。你像一位懂人心的溫柔朋友，也像一位能直擊核心、卻從不傷人的教練。使用者會用口語、不完整的句子描述今天。

【角色定位】
- 溫暖、高情商、深層、可落地。
- 讓讀到這段復盤的每一個人（包含身邊的人）都覺得被尊重、無壓力、看得很舒服。

【語氣層次（必須遵守）】
1. 開場先用「溫柔肯定」。例如：「這是一個不容易的對話，謝謝你願意面對。」看見今天願意說出來，本身就值得被溫柔對待。
2. 中間剖析用「好奇心取代批判」。幫使用者翻譯事件背後的真實需求。例如：「這背後其實是因為你很在意……」「我們好奇的是，那一刻你最想被接住的是什麼？」
3. 禁止責怪、批判、嘲諷、審問、犀利定罪、「你應該早就知道」，也不要把卡住當成失敗。
4. 用「我們」「一起看看」。把卡住當成在乎的訊號。

【主題與核心結論：強制使用黃金圈法則】
處理 themeInsight、whyNeed、whatFact、howNext、conclusion 時，必須依序寫：
1. 為什麼（動機／需求）：先翻譯彼此真正在乎什麼。把盲點轉譯成未被說出口的需求與心意，不是誰做錯了。
2. 是什麼（事實）：溫和點出發生了什麼、哪一個瞬間情緒開始升溫。
3. 怎麼做（下一步）：給出下次對話可直接照唸的具體腳本，不是空泛建議。

【關鍵轉折點（必須明確點出）】
- 明確指出：對話的哪一個瞬間，情緒開始升溫？
- 明確點出那一個「關鍵詞」（例如「為什麼」），說明它如何瞬間扭轉對話走向。
- 立刻給出替代的溫柔表達建議（一句可直接說出口的話）。
- 分別填入 turningPoint、keyWord、keyWordAlt。

【行動指引】
- nextScripts 必須是 2-3 句「下次對話可直接應用」的具體腳本，用引號寫出完整句子。
- 不要寫「多溝通」「保持冷靜」「下次注意一點」這類空泛建議。
- 腳本要讓身邊的人聽了也舒服、無壓力。

【輸出】
只輸出 JSON，繁體中文，不要 markdown。
需含 themeCategory、themeTitle、themeInsight、whyNeed、whatFact、howNext、turningPoint、keyWord、keyWordAlt、nextScripts、problems、eventList、reactionList、reflection、conclusion、quotes、gratitudeNote、sfm、tags。

欄位寫法：
- themeCategory：事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個
- themeTitle：溫柔、好懂、直擊核心的一句主題
- themeInsight：先溫柔肯定開場，再用好奇心翻譯真實需求，最後輕輕接到黃金圈
- whyNeed：為什麼（動機／彼此的在乎），1-2 句
- whatFact：是什麼（事實與升溫瞬間），1-2 句
- howNext：怎麼做（可照唸的下一步），1-2 句
- turningPoint：情緒開始升溫的那一個瞬間
- keyWord：扭轉對話走向的關鍵詞，例如「為什麼」
- keyWordAlt：可直接說出口的溫柔替代句
- nextScripts：2-3 句完整對話腳本
- problems：1-3 則；用「看見／需要／在乎」的語言，不要指責；stars 為 1-5
- eventList、reactionList：客觀、溫和，不評對錯
- reflection：事後反思，帶陪伴感與好奇心
- conclusion：用黃金圈收束（為什麼 → 是什麼 → 怎麼做），溫柔且直擊核心
- quotes：2-4 句溫柔金句，每句 12-40 字
- gratitudeNote：溫柔提醒，不施壓
- sfm：story / feeling / meaning 各一則，語氣同樣溫暖`;

function maybeEnhanceWithApi(rawText, token) {
  const settings = getAiSettings();
  if (!settings.apiKey) return;
  callStoredKeyApi([
    {
      role: "system",
      content: ORGANIZE_SYSTEM_PROMPT,
    },
    { role: "user", content: `復盤日期：${currentIso()}\n\n口語原文：\n${rawText}` },
  ])
    .then((remote) => {
      if (runOrganize._token !== token) return;
      if ((state.think.round || 0) > 1) return;
      applyOrganizeResult(normalizeOrganizeResult(remote, rawText));
      applyThinkResult(localThink(state.organize, 1, [], ""), 1, { silent: true });
      showToast("雲端教練已把今天拆得更清楚。");
    })
    .catch(() => {
      /* 金鑰無效、CORS 或逾時：維持本地結果，絕不卡住 */
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
  const problems = Array.isArray(ai.problems) ? ai.problems : [];
  const quotes = Array.isArray(ai.quotes) ? ai.quotes : [];
  const sfm = Array.isArray(ai.sfm) ? ai.sfm : [];
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
      <article class="think-card" style="opacity:.78">
        <p class="think-card__round">深度思考｜已完成　第 ${index + 1}/${state.think.max} 輪</p>
        <h3>${escapeHtml(round.question || "")}</h3>
        <p class="think-card__q">${escapeHtml(round.insight || "")}</p>
      </article>
    `
    )
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
        <p class="think-card__round">引導式互動　第 ${state.think.round}/${state.think.max} 輪</p>
        <h3>${escapeHtml(think.question || "")}</h3>
        <p class="think-card__q">${escapeHtml(think.insight || "")}</p>
        <p class="chips-label">選一個方法繼續深挖，或當成明天的下一步</p>
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
    : `
      <article class="think-card">
        <p class="think-card__round">引導式互動</p>
        <p>整理完成後會立刻出現可勾選的下一步。若沒看到，再按一次開始整理即可。</p>
        <div class="ai-actions">
          <button class="btn btn--ai-ghost" id="btnThink" type="button">開始深度思考</button>
        </div>
      </article>
    `;

  root.innerHTML = `
    <section class="review-section" aria-labelledby="sec-theme">
      <h2 class="review-section__title" id="sec-theme">【主題與核心結論】</h2>
      <article class="theme-banner">
        <p class="theme-banner__kicker">溫柔看見彼此的在乎</p>
        <h3 class="theme-banner__title">【${escapeHtml(ai.themeCategory || "覺察")}】主題：${escapeHtml(ai.themeTitle || "今天的復盤")}</h3>
        ${ai.themeInsight ? `<p class="theme-banner__lead">${escapeHtml(ai.themeInsight)}</p>` : ""}
      </article>
      ${renderGoldenCircle(ai)}
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
      <article class="ai-block gratitude-box">
        <h3>今日沒提到了感恩</h3>
        <p>${escapeHtml(ai.gratitudeNote || "留一句感謝，今天才算被完整接住。")}</p>
        <textarea class="textarea" id="gratitudeInput" rows="3" placeholder="今天想感謝的是…">${escapeHtml(state.gratitude)}</textarea>
      </article>
    </section>

    <section class="review-section" aria-labelledby="sec-quotes">
      <h2 class="review-section__title" id="sec-quotes">【今日金句】</h2>
      <article class="ai-block gold-block">
        ${quoteCards || `<p class="gold-quote">把今天寫下來，不是給別人看成績，是讓這一天確實被過過。</p>`}
        <p class="sfm-hint">可直接複製發文或拿去實踐；勾選後，完成今日復盤會加入 SFM 素材庫</p>
        <div class="quote-list">${quoteChecks || sfmChecks}</div>
      </article>
      ${
        sfmChecks
          ? `
      <article class="ai-block">
        <h3>Story · Feeling · Meaning</h3>
        <p class="sfm-hint">也可勾選下面這幾段體悟，一併收入素材庫。</p>
        <div class="quote-list">${sfmChecks}</div>
      </article>`
          : ""
      }
    </section>

    <section class="review-section" aria-labelledby="sec-think">
      <h2 class="review-section__title" id="sec-think">【深度思考與下一步】</h2>
      ${thinkBlock}
    </section>

    <section class="review-section" aria-labelledby="sec-raw">
      <h2 class="review-section__title" id="sec-raw">【原始輸入紀錄】</h2>
      <article class="ai-block raw-block">
        <p class="raw-record">${escapeHtml(rawText || "（尚未留下原文）")}</p>
        <p class="sfm-hint">這段原文會永久保存在本機歷史紀錄，不會被整理結果覆蓋。</p>
      </article>
    </section>

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
    { re: /為什麼/, word: "為什麼", alt: "我有點擔心，是因為我很在意我們。可以跟我說說你現在的想法嗎？" },
    { re: /你應該/, word: "你應該", alt: "我比較希望我們可以一起看看……你覺得呢？" },
    { re: /怎麼又|又是/, word: "怎麼又", alt: "我發現這件事又出現了，我想先聽聽你現在的感受。" },
    { re: /你都不|都不/, word: "你都不", alt: "我其實很需要被看見，可以請你陪我一下嗎？" },
    { re: /找麻煩/, word: "找麻煩", alt: "我不是要找麻煩，我是因為在乎我們，才想跟你靠近一點。" },
  ];
  return pairs.find((item) => item.re.test(text)) || pairs[0];
}

function renderGoldenCircle(ai) {
  if (!ai) return "";
  const scripts = Array.isArray(ai.nextScripts) ? ai.nextScripts.filter(Boolean) : [];
  const circle = [ai.whyNeed, ai.whatFact, ai.howNext].some(Boolean)
    ? `
      <article class="ai-block">
        <h3>黃金圈：為什麼 → 是什麼 → 怎麼做</h3>
        ${ai.whyNeed ? `<p><strong>為什麼（動機）</strong><br>${escapeHtml(ai.whyNeed)}</p>` : ""}
        ${ai.whatFact ? `<p><strong>是什麼（事實）</strong><br>${escapeHtml(ai.whatFact)}</p>` : ""}
        ${ai.howNext ? `<p><strong>怎麼做（下一步）</strong><br>${escapeHtml(ai.howNext)}</p>` : ""}
      </article>`
    : "";
  const turning = ai.turningPoint || ai.keyWord || ai.keyWordAlt
    ? `
      <article class="ai-block">
        <h3>關鍵轉折點</h3>
        ${ai.turningPoint ? `<p>${escapeHtml(ai.turningPoint)}</p>` : ""}
        ${ai.keyWord ? `<p>扭轉走向的關鍵詞：<strong>「${escapeHtml(ai.keyWord)}」</strong></p>` : ""}
        ${ai.keyWordAlt ? `<p>下次可以改成：「${escapeHtml(ai.keyWordAlt)}」</p>` : ""}
      </article>`
    : "";
  const scriptBlock = scripts.length
    ? `
      <article class="ai-block">
        <h3>下次對話可直接這樣說</h3>
        <ul class="review-list">${scripts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>`
    : "";
  return `${circle}${turning}${scriptBlock}`;
}

function buildCoachQuotes({ category, hasWhy, otherLabel, keyShort }) {
  const sets = {
    人間關係: [
      "卡住的地方，常常只是兩邊的在乎還沒被好好聽見。",
      "先讓對方聽見你在乎，再輕輕說出你的想法。",
      "複述一遍他的意思，就是在說：我願意站到你旁邊。",
    ],
    事業經營: [
      "你已經很努力了。下一步只要小到明天做得到，就夠溫柔。",
      "先對齊自己在乎什麼，再動手，走路會比較不喘。",
      keyShort ? `記住這句：「${clipPhrase(keyShort, 16)}」——它比完美計畫更靠近你。` : "把今天寫下來，是讓這一天被溫柔地過過。",
    ],
    身心狀態: [
      "身體比嘴巴更早說實話。允許那一口累，今天才算被接住。",
      "不是懶，是你的系統在請你慢一點。聽見它，就是照顧自己。",
      "成長很少是一次轉身，比較像每天把下一步放小一點。",
    ],
    覺察: [
      hasWhy ? "看懂自己在乎什麼的那天，責備會自己變輕。" : "你已經碰到今天了。差的只是那句還沒被溫柔說出口的話。",
      "把「我在乎什麼」講出來，今天就會被完整接住。",
      keyShort ? `記住這句：「${clipPhrase(keyShort, 16)}」——它比完美結論更靠近你。` : "把今天寫下來，是讓這一天被溫柔地過過。",
    ],
  };
  const quotes = [...(sets[category] || sets["覺察"])];
  if (category === "人間關係" && otherLabel && otherLabel !== "自己") {
    quotes[1] = `先讓${otherLabel}聽見你在乎，再輕輕說出你的想法。兩邊都會比較舒服。`;
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
    人間關係: "這次裡，我們看見了彼此的在乎",
    事業經營: "卡住的地方，其實也在說你在乎",
    身心狀態: "身體先說了實話，我們慢慢聽",
    覺察: "今天這一段，值得被溫柔接住",
  }[category];

  if (isComm) themeTitle = "這次裡，我們看見了彼此的在乎";
  if (/決定/.test(text) && !isComm) themeTitle = "做了決定，也讓自己被溫柔接住";
  if (isWin && !isComm) themeTitle = "小小做成，也值得被自己看見";
  if (/卡/.test(text) && !isComm) themeTitle = "今天卡住的，其實是一份還沒被接住的在乎";

  const turning = detectTurningWord(text);
  const themeInsight = isComm
    ? `這是一個不容易的對話，謝謝你願意面對。這背後其實是因為你很在意被理解、被當成心意；${otherLabel}可能也很在意自己的節奏被尊重。我們好奇的是：那一刻，兩邊最想被接住的是什麼？`
    : category === "事業經營"
      ? "謝謝你願意把這份卡住拿出來看。這背後其實是因為你很在意把事情做好，不是能力不夠。我們好奇的是：你真正想守住的，是成果，還是自己也被看見？"
      : category === "身心狀態"
        ? "這是不容易被承認的一天，謝謝你願意面對身體先說出口的累。這背後其實是因為你很在意把生活顧好，嘴巴還在撐。我們好奇的是：那一口累，最想被允許什麼？"
        : `謝謝你願意把今天說出來。${keyShort ? `「${keyShort}」這句已經碰到心底。` : ""}這背後其實是因為你很在意被接住。我們好奇的是：那句還沒說出口的在乎，是什麼？`;

  const problems = [];

  problems.push({
    title: isComm
      ? "彼此的在乎，都還差一句被溫柔聽見"
      : "事情說完了，心底的在乎還想被接住",
    stars: 5,
    body: keyShort
      ? `你寫了「${keyShort}」。事情已經被說出來了，這很好。${isComm ? `接下來我們可以輕輕補上：你在乎什麼，以及${otherLabel}可能也在乎什麼。兩邊都被看見，對話就會從緊繃變成靠近。` : "自己也值得被接住：你明明有做，只是那份心意還沒被溫柔地命名。補一句「我在乎……」，整段話的溫度會不一樣。"}`
      : "事情可以寫得很完整，這已經很棒。若再補一句「我／我們在乎什麼」，意義就會慢慢浮出來，沒有人需要被責怪。",
  });

  if (isComm) {
    problems.push({
      title: `關鍵轉折：把「${turning.word}」換成更溫柔的一句`,
      stars: 4,
      body: `好奇心告訴我們：空氣常在「${turning.word}」出現的那一瞬升溫。不是這個詞不好，是它容易被聽成質問。下次可以直接說：「${turning.alt}」讓${otherLabel}先聽見你的在乎。`,
    });
  }

  if (vagueHits.length) {
    problems.push({
      title: `「${vagueHits[0]}」也在保護你，我們可以再靠近一點`,
      stars: 3,
      body: `「${vagueHits.slice(0, 2).join("、")}」不是錯，它在讓你安全一點。若願意，把模糊的詞換成一個更準的感覺或畫面，今天會更立體，也更被自己陪伴。`,
    });
  }

  if (problems.length < 2) {
    problems.push({
      title: "下一步只要小小的、明天做得到就好",
      stars: 4,
      body: "情緒與事件都被看見了，已經很好。若想把今天接到明天，選一個小到不會有壓力的動作——複述一次、先猜對方在乎什麼、或補一句「我是因為在乎……」。輕輕走就好。",
    });
  }

  if (problems.length < 3 && isWin) {
    problems.push({
      title: "已經有一個小小的做成，也值得被留下來",
      stars: 3,
      body: keyShort
        ? `「${keyShort}」你可能自己沒當一回事。把它單獨留下來，它會變成可以再溫柔使用的故事，而不是被「還沒夠好」蓋過去。`
        : "今天其實有一個小小的做成。寫下來，讓它被看見，而不是被「還沒夠好」蓋過去。",
    });
  }

  if (problems.length < 3 && !isComm) {
    problems.push({
      title: "感受有了，再為它取一個溫柔的名字",
      stars: 3,
      body: "你已經碰到今天了。可以再輕輕問一次：這份感覺在提醒你，你在乎什麼？一句就夠。寫成可以帶走的話，心就會鬆一點。",
    });
  }

  const eventList = (sentences.length ? sentences.slice(0, 4) : [text]).map((item, index) => {
    const labels = ["發生了什麼", "接著", "然後", "停在這裡"];
    return `${labels[index] || "還有"}：${item}`;
  });
  if (keyShort) eventList.push(`關鍵畫面：${clipPhrase(key, 36)}`);

  const reactionList = hasPeople
    ? [
        `${otherLabel}當下的反應，比較像「還沒被接住」，不是「不想聽」。兩邊都有在乎。`,
        "結果：對話停在做法與語氣，彼此的心意都還差一點被聽見。",
        "若先看見對方的在乎，再輕輕說出自己的，關心就比較容易被聽成心意。",
        keyShort ? `事後空氣停在「${keyShort}」這一句，還想被溫柔對齊。` : "事後空氣還有一點緊，是因為那句「我在乎……」還沒出場。",
      ]
    : [
        "這次主要是自己與自己的對話。沒有別人在場，也值得被溫柔對待。",
        "當下你把事情說完了，這已經很好；心底的在乎還可以再被命名一次。",
        "結果：事件被看見了，意義還可以再靠近一點。",
        "你怎麼溫柔地對自己說話，之後也會怎麼溫柔地對別人說話。",
      ];

  const whyNeed = isComm
    ? `為什麼：你很在意心意被聽見，${otherLabel}也很在意感受被尊重。兩邊的在乎都是真的。`
    : category === "事業經營"
      ? "為什麼：你很在意把事情做好，也希望自己的努力被接住，不是被略過。"
      : category === "身心狀態"
        ? "為什麼：你很在意把生活顧好，身體卻先提醒你：被允許休息，也是一種在乎。"
        : "為什麼：你很在意今天這一段被完整接住，而不是只被當成流水帳。";

  const whatFact = isComm
    ? `是什麼：情緒比較容易在「${turning.word}」出現的那一瞬升溫。${keyShort ? `關鍵畫面停在「${keyShort}」。` : ""}這個詞一出口，對方常會聽成被質問，而聽不到你的擔心。`
    : `是什麼：事情被說完了，${keyShort ? `停在「${keyShort}」` : "真正的在乎"} 還沒被溫柔命名，心就還有一點緊。`;

  const howNext = isComm
    ? `怎麼做：下次先把「${turning.word}」換成「${turning.alt}」再開口。讓動機站到語氣前面。`
    : `怎麼做：下次對自己或對方說：「我想先說，我是因為在乎……才提起這件事。」`;

  const turningPoint = isComm
    ? `關鍵轉折點大概發生在「${turning.word}」被說出口、或方案先於心意出場的那一秒。空氣從哪裡開始緊，就從哪裡改口。`
    : `關鍵轉折點發生在你急著把事情處理完、還沒問自己「我在乎什麼」的那一瞬。先停一秒，再開口。`;

  const nextScripts = isComm
    ? [
        `「我剛剛聽你說……我猜你是因為在乎……對嗎？」`,
        `「${turning.alt}」`,
        `「我想講的不是對錯，是我很在意我們。你現在方便聽我說一句嗎？」`,
      ]
    : [
        `「我想先說，我是因為在乎……才提起這件事。」`,
        `「我現在有一點卡住，不是要給你壓力，只是想被理解一下。」`,
        `「你方便的話，我們可以慢慢說；不方便也沒關係，我先把這句放在這裡。」`,
      ];

  const reflection = hasWhy
    ? `當時你急著把事情處理完，其實已經碰到自己在乎什麼了，只是還沒被單獨拿出來抱抱。現在回頭看「${keyShort || "今天這一段"}」，我們好奇的不是誰錯了，而是那一刻你最想被接住的是什麼。責備可以先放下，陪伴可以往前。`
    : isComm
      ? `當時你急著把話說完，來不及先聽懂${otherLabel}的在乎。回頭看「${keyShort || "今天這一段"}」，我們好奇的是：如果先複述他的意思、再把「${turning.word}」換成「${turning.alt}」，走向會不會柔一點？`
      : `當時你急著處理事情，來不及問自己在乎什麼。回頭看「${keyShort || "今天這一段"}」，我們好奇的是：那句還沒說出口的話，是不是其實在說「請接住我」？`;

  const conclusion = isComm
    ? `為什麼：彼此都有在乎。是什麼：空氣常在「${turning.word}」那一瞬升溫。怎麼做：下次直接說「${turning.alt}」讓關心被聽成心意。`
    : {
        事業經營: "為什麼：你很在乎把事情做好。是什麼：下一步還有一點抽象，心就會緊。怎麼做：明天對自己說「我先只做一件小到做得到的事」，再開始。",
        身心狀態: "為什麼：你很在乎把生活顧好。是什麼：身體先說實話，嘴巴還在撐。怎麼做：對自己說「我允許自己先休息一口，再決定下一步」。",
        覺察: "為什麼：你很在乎被接住。是什麼：有一句在乎還沒出場。怎麼做：把「我想先說，我是因為在乎……」說出口。",
      }[category] || "為什麼：你很在乎被接住。是什麼：有一句話還沒出場。怎麼做：把「我在乎什麼」溫柔說出來。";

  const quotes = buildCoachQuotes({ category: isComm ? "人間關係" : category, hasWhy, otherLabel, keyShort });

  return {
    themeCategory: category,
    themeTitle,
    themeInsight,
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
      ? "你已經提到感謝了，這份柔軟很好。若願意，再具體一點：是誰、哪一句、哪一個小動作讓你想說謝謝？"
      : "今天還沒提到感恩也沒關係。若心裡還有一點空間，可以留一句：哪怕只感謝自己有把這段話講出來。",
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
          ? "不是想贏過對方，是希望自己的在乎被聽見。允許這份卡待一會兒，再輕輕補一句：我是因為在乎。"
          : "不是懶，是有一塊地方還想被溫柔看見。允許這份卡待一會兒，再輕輕補一句：我在乎什麼。",
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
  };
}

function localThink(organize, round, selected, reply) {
  const theme = organize?.themeTitle || "這次裡，我們看見了彼此的在乎";
  const problem = organize?.problems?.[0]?.title || "彼此的在乎還想被聽見";
  const actionHint = selected?.[0]?.label || "";
  const replyHint = String(reply || "").trim();
  const last = round >= 5;
  const otherFromTheme = /女友/.test(`${theme}${problem}${organize?.conclusion || ""}`) ? "女友" : "對方";

  const keyWord = organize?.keyWord || "為什麼";
  const keyWordAlt = organize?.keyWordAlt || "我有點擔心，是因為我很在意我們。可以跟我說說你現在的想法嗎？";
  const methodActions = [
    {
      label: "下次可以這樣開場",
      detail: `「我剛剛聽你說……我猜你是因為在乎……對嗎？我想先聽懂你，再分享我的想法。」`,
    },
    {
      label: `把「${keyWord}」換成溫柔版`,
      detail: `「${keyWordAlt}」`,
    },
    {
      label: "若對方還沒準備好",
      detail: `「沒關係，你現在如果不方便也沒問題。我想說的只是：我很在意${otherFromTheme === "女友" ? "妳" : "你"}，也在意我們。」`,
    },
  ];

  const rounds = [
    {
      title: "深度思考與下一步",
      question: `圍繞「${clipPhrase(theme, 22)}」：如果只能溫柔補一句「我在乎……」，那一句會是什麼？`,
      insight: `謝謝你願意再靠近一層。這背後其實是因為「${clipPhrase(problem, 22)}」還想被聽見。關鍵轉折常停在「${keyWord}」——下次改口成「${keyWordAlt}」，走向就會柔下來。`,
      actions: methodActions,
    },
    {
      title: "用方法走一步",
      question: actionHint
        ? `你選了「${actionHint}」。做這一步之前，你最希望${otherFromTheme}聽見的是哪一句？`
        : "如果先用複述法，把對方的話說回去，你猜他最想被聽懂的是哪一句？",
      insight: `好奇心先於結論：先聽懂，再猜他在乎什麼，最後才說自己的心意。把「${keyWord}」換成「${keyWordAlt}」，同一句話就會從升溫變成靠近。`,
      actions: methodActions,
    },
    {
      title: "聽懂之後再開口",
      question: replyHint
        ? `你剛說「${clipPhrase(replyHint, 20)}」。這句話裡，哪一個字是真正的需要？`
        : "這份卡住，有沒有一部分其實是想對自己說：我也值得被理解？",
      insight: "對外溝通卡住時，內在通常也有一句還沒被允許說出口。對自己溫柔一點，對外才講得輕。複述法也可以用在自己：把今天的情緒用一句話說回去。",
      actions: [
        { label: "換句話說練習", detail: `把今天最硬的那句，改成：「${keyWordAlt}」` },
        { label: "先寫再傳", detail: "「我想說的是：我在乎你，也在乎我們。你現在方便聽我說一句嗎？」" },
        { label: "複述給自己聽", detail: "「我其實是想被理解，也想讓對方知道我不是在指責。」" },
      ],
    },
    {
      title: "收到明天做得到的一步",
      question: "明天最小、一定做得到、也不會給身邊的人壓力的一步是什麼？",
      insight: "「下次溝通好一點」可以先放下。具體的「複述一次」「先猜他在乎什麼」「補講一次我在乎」就夠了。小到沒有壓力，才走得下去。",
      actions: methodActions,
    },
    {
      title: "把這一層帶走",
      question: last
        ? "如果今天只帶走一句話，你希望未來的自己記得哪一句？"
        : "走到這裡，你已經比開頭更靠近自己了。還有哪一句想留給明天？",
      insight: "這些提問不是為了把你問倒，是為了讓那份在乎終於有位置。你可以停在這裡，也可以把勾選的下一步輕輕做一次。",
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

function applyOrganizeResult(result) {
  const safe = result && typeof result === "object" ? result : localOrganize("");
  state.organize = safe;
  state.selectedQuotes = collectQuoteKeys(safe).filter((key) => key.startsWith("quote:"));
  state.selectedSfm = collectQuoteKeys(safe).filter((key) => key.startsWith("sfm:"));
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

    applyOrganizeResult(localOrganize(rawText));
    applyThinkResult(localThink(state.organize, 1, [], ""), 1, { silent: true });
    showToast("整理完成。主題、金句與下一步都在下面。");
    maybeEnhanceWithApi(rawText, token);
  } catch {
    try {
      const fallback = document.getElementById("reviewText")?.value.trim() || "今天把這段話講出來了。";
      state.rawText = fallback;
      applyOrganizeResult(localOrganize(fallback));
      applyThinkResult(localThink(state.organize, 1, [], ""), 1, { silent: true });
    } catch {
      purgeThinkingUi();
    }
  }
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

function applyThinkResult(raw, nextRound, options = {}) {
  const result = normalizeThinkResult(raw, nextRound);
  state.think.round = nextRound;
  state.think.current = result;
  if (!Array.isArray(state.think.history)) state.think.history = [];
  state.think.history.push(result);
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
    applyThinkResult(localThink(state.organize, nextRound, selected, reply), nextRound);
  } catch {
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
      <p><strong>【主題與核心結論】【${escapeHtml(ai.themeCategory || "")}】</strong>${escapeHtml(ai.themeTitle || "")}</p>
      ${ai.themeInsight ? `<p>${escapeHtml(ai.themeInsight)}</p>` : ""}
      ${renderGoldenCircle(ai)}
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
      ${think ? `<p><strong>【深度思考與下一步】</strong></p>${think}` : ""}
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

function updateApiStatus() {
  const status = document.getElementById("apiStatus");
  if (!status) return;
  const settings = getAiSettings();
  if (settings.apiKey) {
    status.classList.add("is-ready");
    status.textContent = `已選 ${PROVIDER_PRESETS[settings.provider]?.label || "OpenAI"}，金鑰存在此瀏覽器（${maskKey(settings.apiKey)}）。整理仍會先走本地教練。`;
  } else {
    status.classList.remove("is-ready");
    status.textContent = "目前使用本地教練，點「開始整理」會立刻出結果。";
  }
}

function syncApiBaseField() {
  const baseField = document.getElementById("apiBaseField");
  if (baseField) baseField.hidden = false;
}

function onProviderChange() {
  const id = normalizeProvider(document.getElementById("apiProvider")?.value);
  const preset = PROVIDER_PRESETS[id] || PROVIDER_PRESETS.openai;
  const model = document.getElementById("apiModelInput");
  const base = document.getElementById("apiBaseInput");
  if (model) {
    model.value = preset.model;
    model.placeholder = preset.model;
  }
  if (base) {
    base.value = preset.baseUrl;
    base.placeholder = preset.baseUrl;
    const field = document.getElementById("apiBaseField");
    if (field) field.hidden = false;
  }
}
window.onProviderChange = onProviderChange;

function fillApiForm() {
  const settings = getAiSettings();
  const provider = document.getElementById("apiProvider");
  const key = document.getElementById("apiKeyInput");
  const model = document.getElementById("apiModelInput");
  const base = document.getElementById("apiBaseInput");
  if (provider) provider.value = settings.provider;
  if (key) key.value = settings.apiKey;
  if (model) {
    model.value = settings.model;
    model.placeholder = PROVIDER_PRESETS[settings.provider]?.model || settings.model;
  }
  if (base) {
    base.value = settings.baseUrl;
    base.placeholder = PROVIDER_PRESETS[settings.provider]?.baseUrl || settings.baseUrl;
  }
  syncApiBaseField();
  updateApiStatus();
}

function saveApiSettings(event) {
  const action = event?.submitter?.value || "confirm";
  if (action === "cancel") return;
  if (action === "clear") {
    clearAiSettings();
    fillApiForm();
    showToast("已清除此瀏覽器的 API 金鑰。");
    return;
  }
  const provider = normalizeProvider(document.getElementById("apiProvider")?.value);
  const preset = PROVIDER_PRESETS[provider];
  saveAiSettings({
    provider,
    apiKey: document.getElementById("apiKeyInput")?.value,
    model: document.getElementById("apiModelInput")?.value || preset.model,
    baseUrl: document.getElementById("apiBaseInput")?.value || preset.baseUrl,
  });
  updateApiStatus();
  showToast(getAiSettings().apiKey ? "金鑰已存在此瀏覽器，不會寫進程式碼。" : "未填金鑰，之後仍用本地教練秒出結果。");
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
  document.getElementById("apiProvider")?.addEventListener("change", onProviderChange);
  document.getElementById("apiForm").addEventListener("submit", saveApiSettings);

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
  } catch {
    /* 其餘初始化失敗也不擋「開始整理」 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
