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
    themeStars: remote.themeStars || local.themeStars,
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
    thinkGuide: remote.thinkGuide || local.thinkGuide,
  };
}

const ORGANIZE_SYSTEM_PROMPT = `你是「日精進」的專業心理教練，也是直白、注重溝通邏輯的復盤教練。使用者會用口語、不完整的句子描述今天。你必須每次都產出同一套條理分明、直擊重點的復盤，不可省略任何一段。

【語氣】
- 冷靜、客觀、像專業教練在拆個案。句子短、判斷準。
- 禁止感性開場與過度安慰。對事不對人。

【強制輸出結構（依此順序寫滿，不可缺段）】

1. 主標題與星等
- themeCategory：事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個
- themeTitle：一句精煉主題，點出「好意／落差如何變成後果」。例如：「沒講清楚的好意，變成一場誤會的吵架」
- themeStars：1-5 整數，代表這次議題的衝擊與值得復盤的程度。畫面會顯示成 [★★★★☆]
- themeInsight：標題下的一句診斷，直戳結構，不要抒情

2. 事件拆解（eventList，恰好 3 條，必須用以下開頭）
- 「發生了什麼：……」客觀還原事實
- 「對方的訴求：……」對方當下真正要的是什麼（眼前需求、情緒確認、還是只要一個簡單答案）
- 「你的解決方案：……」你實際丟出去的做法或規劃

3. 結果與反應（reactionList，恰好 3 條，必須用以下開頭）
- 「對方的反應：……」
- 「你的反應：……」
- 「落差：……」客觀寫雙方目標／資訊／額度沒對上的地方。例如：對方要的額度沒那麼高，對話卻停在做法與語氣。

4. 事後反思（reflection）
- 點出問題核心：少了哪一句「為什麼／動機／目標層級」，對方接收到的就只剩一個莫名其妙、多此一舉的要求。
- 2-4 句，具體，不要空話。

5. 核心結論
- conclusion：只用一句話總結教訓
- quotes：2-3 句今日金句，每句 12-40 字，可帶走、可實踐
- thinkGuide：1-2 句思維引導，告訴下次開口前先問什麼、先對齊什麼
- howNext：實戰修正，乾淨俐落
- nextScripts：2-3 句下次可直接照唸的對話腳本

【仍需填的輔助欄位】
- whyNeed：核心盲點（目標落差＋資訊沒對齊）
- whatFact：溝通誤區（為什麼會吵，哪一步跳太快）
- turningPoint、keyWord、keyWordAlt：升溫瞬間、關鍵詞、可替換的對齊句
- problems：1-3 則診斷卡，title 像診斷、stars 1-5、body 2-4 句
- gratitudeNote、sfm、tags

【輸出】
只輸出 JSON，繁體中文，不要 markdown。
需含 themeCategory、themeTitle、themeStars、themeInsight、eventList、reactionList、reflection、conclusion、quotes、thinkGuide、whyNeed、whatFact、howNext、turningPoint、keyWord、keyWordAlt、nextScripts、problems、gratitudeNote、sfm、tags。`;

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
      showToast("雲端教練已拆出盲點與修正。");
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
        <p class="theme-banner__kicker">直擊溝通落差</p>
        <h3 class="theme-banner__title">【${escapeHtml(ai.themeCategory || "覺察")}】主題：${escapeHtml(ai.themeTitle || "今天的復盤")} <span class="stars">[${starsText(ai.themeStars)}]</span></h3>
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
        ${ai.thinkGuide ? `<p class="sfm-hint">${escapeHtml(ai.thinkGuide)}</p>` : ""}
      </article>
      <article class="ai-block gratitude-box">
        <h3>今日沒提到了感恩</h3>
        <p>${escapeHtml(ai.gratitudeNote || "沒提到就略過。要補就補一句具體事實。")}</p>
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
      "吵的不是態度，是兩邊的目標不在同一層。",
      "方案走太快，對齊沒做完，再對的解法也會變任務轟炸。",
      "先確認眼前要解哪一件，再決定要不要展開完整規劃。",
    ],
    事業經營: [
      "卡住通常不是能力，是目標層級沒對上：一次到位，還是先做眼前。",
      "先對齊要解哪一層，再動手，才不會空轉。",
      keyShort ? `記住卡點：「${clipPhrase(keyShort, 16)}」——它比完美計畫更接近真相。` : "把今天寫下來，是為了看清哪一步跳太快。",
    ],
    身心狀態: [
      "身體先降速，行程還在加碼。落差就在這裡。",
      "不是懶，是負載已經超過當下能處理的單位。",
      "先砍到明天做得到的一步，再談完整計畫。",
    ],
    覺察: [
      hasWhy ? "原因找到了，就別再把問題定義成個性。" : "卡點不是努力不夠，是任務定義還沒講清楚。",
      "先對齊要解哪一層，再開口。",
      keyShort ? `記住卡點：「${clipPhrase(keyShort, 16)}」。` : "把今天寫下來，是為了看清哪一步跳太快。",
    ],
  };
  const quotes = [...(sets[category] || sets["覺察"])];
  if (category === "人間關係" && otherLabel && otherLabel !== "自己") {
    quotes[1] = `你給的是完整解法，${otherLabel}要的可能只是眼前這一步。先對齊層級。`;
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
        `「先確認：你現在要解的是眼前這一件，還是整套方案？」`,
        `「${turning.alt}」`,
        `「方案我可以給。你要我現在只處理眼前，還是一起看完整路徑？」`,
      ]
    : [
        `「這次我先只做眼前這一步，做完再決定要不要展開。」`,
        `「先對齊：一次到位，還是先完成眼前能做完的單位？」`,
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
    ? `下次開口前先問兩句：對方現在要的額度有多高？我的「為什麼」講了沒有？沒對齊就不要丟完整方案。`
    : "下次先回答「這次只解哪一層」，再開始做。思維順序：為什麼 → 是什麼 → 怎麼做。";

  const quotes = buildCoachQuotes({ category: isComm ? "人間關係" : category, hasWhy, otherLabel, keyShort });

  return {
    themeCategory: category,
    themeTitle,
    themeStars,
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
      ? "感恩有提到。補具體：是誰、哪一句、哪個動作。"
      : "這段沒提到感恩。要補就補一句事實，不補也無妨。",
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
      label: "先對齊目標層級",
      detail: `「先確認：你現在要解的是眼前這一件，還是整套方案？」`,
    },
    {
      label: `改掉「${keyWord}」`,
      detail: `「${keyWordAlt}」`,
    },
    {
      label: "只處理眼前這一步",
      detail: `「方案我可以給。你要我現在只處理眼前，還是一起看完整路徑？」`,
    },
  ];

  const rounds = [
    {
      title: "深度思考與下一步",
      question: `圍繞「${clipPhrase(theme, 22)}」：你當時給的是完整方案，還是${otherFromTheme}要的眼前一步？`,
      insight: `盲點是「${clipPhrase(problem, 22)}」。解法走太快，對齊沒做完。升溫詞是「${keyWord}」。下次改口：「${keyWordAlt}」`,
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
      <p><strong>【主題與核心結論】【${escapeHtml(ai.themeCategory || "")}】</strong>主題：${escapeHtml(ai.themeTitle || "")} [${starsText(ai.themeStars)}]</p>
      ${ai.themeInsight ? `<p>${escapeHtml(ai.themeInsight)}</p>` : ""}
      ${renderGoldenCircle(ai)}
      ${problems}
      <p><strong>事件拆解</strong></p>
      ${eventHtml}
      <p><strong>結果與反應</strong></p>
      ${reactionHtml}
      <p><strong>事後反思</strong><br>${escapeHtml(ai.reflection || "")}</p>
      <p><strong>核心結論</strong><br>${escapeHtml(ai.conclusion || "")}</p>
      ${ai.thinkGuide ? `<p><strong>思維引導</strong><br>${escapeHtml(ai.thinkGuide)}</p>` : ""}
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
