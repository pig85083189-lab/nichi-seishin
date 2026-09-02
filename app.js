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
  userMarkHint: "nichi.userMarkHint",
  plusTrialEndedNotice: "nichi.plusTrialEndedNotice",
};

const CLOUD_STORE_NAMES = ["reviews", "tasks", "sfm", "insights", "manifests", "reports"];

const REVIEW_API = "/api/review";
const CHAT_API = "/api/chat";
const NEWEBPAY_EPG_URL = "https://core.newebpay.com/EPG/HTC109030010100/QLBIYc";
const NEWEBPAY_CHECKOUT_ENABLED = false;
const NEWEBPAY_PLANS = {
  monthly: {
    id: "monthly",
    amount: 149,
    url: NEWEBPAY_EPG_URL,
  },
  yearly: {
    id: "yearly",
    amount: 1290,
    url: NEWEBPAY_EPG_URL,
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
  pendingHistoryRating: 3,
  historyOpen: "",
  historyDetailDate: "",
  historyListScroll: null,
  historyHashSync: false,
  historyOpenSections: {},
  splashGateReady: false,
  splashStartedAt: 0,
  splashDismissed: false,
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
  journalFoldCollapseTimer: 0,
  journalMeta: {
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    awarenessQuoteGenCount: 0,
    manifestAi: false,
    manifestAiSig: "",
    manifestPromptsAi: false,
    manifestPromptsSig: "",
    insightSig: "",
    bodyCoachSig: "",
    bodyMindSig: "",
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
  bodyMindBusy: false,
  bodyMindToken: 0,
  bodyMindRequestText: "",
  journalBodyMind: null,
  journalInternalTestRuns: [],
  journalInternalResetAt: "",
  internalModelDebug: { think: null, awareness: null, execution: null },
  journalExecFocus: null,
  journalAwarenessResult: null,
  journalAwarenessV3: { variant: "awareness-v3", sourceSig: "", items: [], selectedIds: [], generatedAt: "", observationCue: null },
  awarenessChoices: { sourceSig: "", options: [], selectedIds: [], generatedAt: "" },
  thinkChoices: { sourceSig: "", options: [], selectedIds: [], generatedAt: "" },
  executionChoices: { sourceSig: "", options: [], selectedId: "", selectedIds: [], custom: "", followupQuestion: "", followupPlaceholder: "", generatedAt: "", deep: { status: "", rounds: [], draftAnswer: "", refreshedAt: "", executionSummary: "", finalOptions: [], finalSelectedIds: [] } },
  choicesBusy: { awareness: false, think: false, execution: false, executionDeep: false, awarenessCue: false, thinkExt: false },
  choicesToken: { awareness: 0, think: 0, thinkClose: 0, execution: 0, executionDeep: 0, awarenessCue: 0, thinkExt: 0 },
  awarenessCueAttemptSig: "",
  journalUserMarks: { items: [], updatedAt: "" },
  journalManifestSentence: "",
  journalManifestHighlights: {},
  journalManifestClose: { futureVision: "", approachStep: "", manifestationStatement: "", accepted: false, addedToExec: false },
  journalManifestPlan: { id: "", steps: [] },
  manifestPrompts: [],
  manifestPromptsBusy: false,
  manifestPromptsToken: 0,
  promptsBusy: false,
  promptsToken: 0,
  corePromptsBusy: false,
  corePromptsToken: 0,
  corePromptsFailedSig: "",
  awareFoldPinned: false,
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
  cloudDirty: false,
  cloudUnsynced: false,
  syncKind: "",
  syncText: "",
};

function trackProduct(eventName, metadata) {
  try {
    if (window.NichiAnalytics && typeof window.NichiAnalytics.trackEvent === "function") {
      window.NichiAnalytics.trackEvent(eventName, metadata);
    }
  } catch {
    /* analytics 不可影響主功能 */
  }
}

function trackProductOnceSession(eventName, metadata, key) {
  try {
    if (window.NichiAnalytics && typeof window.NichiAnalytics.trackOnceSession === "function") {
      window.NichiAnalytics.trackOnceSession(eventName, metadata, key);
    }
  } catch {
    /* analytics 不可影響主功能 */
  }
}

function bindAnalytics() {
  if (!window.NichiAnalytics || !window.NichiAnalytics.bind) return;
  window.NichiAnalytics.bind({
    getClient: getSupabase,
    getUser: () => state.user,
    getIsInternal: () => isInternalMembership(state.membership),
  });
}

function isInternalMembership(membership = state.membership) {
  if (!membership) return false;
  if (membership.isInternal === true || membership.is_internal === true) return true;
  const access = String(membership.accessType || membership.access_type || "").trim().toLowerCase();
  if (access === "internal") return true;
  const status = String(membership.status || membership.subscriptionStatus || "").trim().toLowerCase();
  return status === "internal";
}

function internalTestApi() {
  return (typeof globalThis !== "undefined" && globalThis.NichiInternalTest) || {};
}

function normalizeInternalTestRuns(value) {
  const api = internalTestApi();
  if (typeof api.normalizeInternalTestRuns === "function") return api.normalizeInternalTestRuns(value);
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function takeInternalDebug(remote) {
  const debug = remote && remote._internalDebug;
  if (!debug || !debug.model) return null;
  return { provider: String(debug.provider || "").trim(), model: String(debug.model || "").trim() };
}

function paintInternalModelDebug(root, debug) {
  if (!root) return;
  root.querySelectorAll(".internal-model-debug").forEach((node) => node.remove());
  if (!isInternalMembership() || !debug || !debug.model) return;
  const line = document.createElement("p");
  line.className = "internal-model-debug";
  line.textContent = `Internal Test · ${debug.model}`;
  root.appendChild(line);
}

function trackMembershipSignals(membership) {
  if (!membership || isInternalMembership(membership)) return;
  if (membership.trialStartedAt) trackProduct("trial_started", { source: "membership" });
  if ((membership.status === "expired" || membership.status === "cancelled") && !membership.paid && !membership.isPaid) {
    trackProduct("trial_expired", { source: "membership" });
  }
  if (membership.paid || membership.isPaid || membership.status === "active") {
    trackProduct("subscription_started", { source: "membership" });
  }
}

async function probeAdminAnalyticsLink() {
  const link = document.getElementById("adminAnalyticsLink");
  if (!link || !state.user) {
    if (link) link.hidden = true;
    return;
  }
  try {
    const response = await fetch(`${location.origin}/api/admin/analytics?probe=1`, {
      credentials: "include",
      headers: authHeaders(),
    });
    link.hidden = response.status !== 200;
  } catch {
    link.hidden = true;
  }
}

const LAB_REASON_OPTIONS = [
  { id: "new-angle", label: "有新的角度" },
  { id: "connection", label: "真的有連起我寫的不同事情" },
  { id: "no-paraphrase", label: "沒有重述我的話" },
  { id: "want-answer", label: "問題讓我真的想回答" },
  { id: "human", label: "語氣比較像人" },
  { id: "filler", label: "太像廢話" },
  { id: "overreach", label: "太會腦補" },
  { id: "abstract", label: "太抽象" },
  { id: "psych", label: "太像心理分析" },
  { id: "other", label: "其他" },
];

function syncInsightLabLink() {
  const link = document.getElementById("insightLabLink");
  if (!link) return;
  const allowed = isInternalMembership();
  link.hidden = !allowed;
  if (!allowed && state.page === "lab") switchPage("today", { replaceHash: true });
}

function labStorageKey() {
  return cloudStoreKey("insightLab");
}

function readLabExperiment() {
  try {
    const raw = localStorage.getItem(labStorageKey());
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function writeLabExperiment(data) {
  try {
    if (!data) {
      localStorage.removeItem(labStorageKey());
      return;
    }
    localStorage.setItem(labStorageKey(), JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function labRawFromJournal(journal) {
  const data = journal && typeof journal === "object" ? journal : {};
  const mind = data.bodyMind && typeof data.bodyMind === "object" ? data.bodyMind : {};
  return {
    thanksText: thanksTextFrom(data),
    event: String(data.event || "").trim(),
    mood: String(data.mood || "").trim(),
    bodyMindText: String(mind.text || data.bodyNote || "").trim(),
  };
}

function labHasRaw(raw) {
  return Boolean(String((raw && (raw.thanksText || raw.event || raw.bodyMindText)) || "").trim());
}

function labReviewHasUserRaw(review) {
  return labHasRaw(labRawFromJournal(review && review.journal));
}

function labDayOptions() {
  const reviews = getReviews();
  const todayIso = currentIso();
  const days = Object.keys(reviews)
    .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
    .filter((iso) => {
      const review = reviews[iso];
      if (!labReviewHasUserRaw(review)) return false;
      return reviewIsFinalized(review) || iso === todayIso;
    })
    .sort()
    .reverse();
  if (!days.includes(todayIso) && labHasRaw(labRawFromJournal(collectJournal()))) days.unshift(todayIso);
  return days;
}

function escapeLab(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLabItem(item) {
  if (!item || !item.hasInsight) return `<p class="lab-empty">這次沒有新的洞察</p>`;
  return `
    ${item.title ? `<h4>${escapeLab(item.title)}</h4>` : ""}
    <p>${escapeLab(item.insight)}</p>
    ${item.question ? `<p>${escapeLab(item.question)}</p>` : ""}
  `;
}

function renderInsightLab() {
  const root = document.getElementById("labRoot");
  if (!root) return;
  if (!isInternalMembership()) {
    root.innerHTML = `<p class="lab-empty">Insight Lab 僅限 Internal。</p>`;
    return;
  }
  const days = labDayOptions();
  const exp = readLabExperiment() || {};
  const selected = days.includes(exp.date) ? exp.date : days[0] || "";
  const fixtureId = exp.fixtureId || "";
  const slots = Array.isArray(exp.slots) ? exp.slots : [];
  const voted = Boolean(exp.vote);
  root.innerHTML = `
    <div class="lab-toolbar">
      <label>
        <span class="sr-only">選擇日期</span>
        <select id="labDate">
          ${days.map((iso) => `<option value="${iso}" ${iso === selected ? "selected" : ""}>${iso}</option>`).join("")}
        </select>
      </label>
      <label>
        <span class="sr-only">Benchmark</span>
        <select id="labFixture">
          <option value="">使用當天原文</option>
          <option value="fx-baby" ${fixtureId === "fx-baby" ? "selected" : ""}>Benchmark：覺察 × Baby</option>
          <option value="fx-sparse" ${fixtureId === "fx-sparse" ? "selected" : ""}>Benchmark：資訊不足</option>
          <option value="fx-positive" ${fixtureId === "fx-positive" ? "selected" : ""}>Benchmark：正向日</option>
        </select>
      </label>
      <button class="btn btn-primary" id="labRun" type="button">${exp.running ? "產生中…" : "產生三個版本"}</button>
    </div>
    <p id="labStatus" class="lab-empty">${exp.error ? escapeLab(exp.error) : ""}</p>
    <div id="labSlots">
      ${slots
        .map(
          (slot) => `
        <article class="lab-card" data-lab-slot="${escapeLab(slot.key)}">
          <h3>版本 ${escapeLab(slot.key)}</h3>
          ${(Array.isArray(slot.items) ? slot.items : []).map(renderLabItem).join("")}
        </article>`
        )
        .join("")}
    </div>
    ${
      slots.length
        ? `
      <form class="lab-vote" id="labVoteForm">
        <p>哪一個真的讓你多看見自己一點？</p>
        <label><input type="radio" name="labPick" value="A" ${exp.vote === "A" ? "checked" : ""} ${voted ? "disabled" : ""} /> A</label>
        <label><input type="radio" name="labPick" value="B" ${exp.vote === "B" ? "checked" : ""} ${voted ? "disabled" : ""} /> B</label>
        <label><input type="radio" name="labPick" value="C" ${exp.vote === "C" ? "checked" : ""} ${voted ? "disabled" : ""} /> C</label>
        <label><input type="radio" name="labPick" value="none" ${exp.vote === "none" ? "checked" : ""} ${voted ? "disabled" : ""} /> 都沒有</label>
        <p>為什麼？</p>
        <div class="lab-reasons">
          ${LAB_REASON_OPTIONS.map(
            (item) => `
            <label>
              <input type="checkbox" name="labReason" value="${item.id}" ${(exp.reasons || []).includes(item.id) ? "checked" : ""} ${voted ? "disabled" : ""} />
              <span>${item.label}</span>
            </label>`
          ).join("")}
        </div>
        <input class="input" id="labOther" type="text" placeholder="其他（選填）" value="${escapeLab(exp.whyOther || "")}" ${voted ? "disabled" : ""} />
        ${voted ? "" : `<button class="btn btn-primary" type="submit">送出投票</button>`}
      </form>`
        : ""
    }
    <div class="lab-reveal" id="labReveal" ${voted && exp.revealed ? "" : "hidden"}>
      ${voted && exp.revealed ? renderLabReveal(exp) : ""}
    </div>
  `;
  document.getElementById("labRun")?.addEventListener("click", runInsightLab);
  document.getElementById("labVoteForm")?.addEventListener("submit", submitInsightLabVote);
}

function renderLabReveal(exp) {
  const revealed = exp && exp.revealed && typeof exp.revealed === "object" ? exp.revealed : {};
  const hidden = Array.isArray(revealed.hidden) ? revealed.hidden : [];
  return hidden
    .map((row) => {
      const debug = row.debug || {};
      const scores = row.scores || {};
      const usage = debug.usage || {};
      return `<p>版本 ${escapeLab(row.slot)} 實際：${escapeLab(row.label || row.pipeline)}<br />provider ${escapeLab(debug.provider)} · model ${escapeLab(debug.model)} · reasoning effort ${escapeLab(debug.reasoningEffort || "—")} · pipeline ${escapeLab(debug.pipeline)} · stage ${escapeLab(debug.stage || "—")} · ${Number(debug.latencyMs || 0)}ms · calls ${Number(debug.callCount || 0)} · completion ${Number(debug.completionTokens || usage.completionTokens || usage.output || 0)} · reasoning ${Number(debug.reasoningTokens || usage.reasoningTokens || usage.reasoning || 0)} · tokens ${Number(usage.total || 0)}${debug.httpStatus != null ? ` · http ${escapeLab(debug.httpStatus)}` : ""}${debug.finishReason || debug.stopReason ? ` · stop ${escapeLab(debug.finishReason || debug.stopReason)}` : ""}${debug.errorCode ? ` · code ${escapeLab(debug.errorCode)}` : ""}${debug.failed ? ` · failed ${escapeLab(debug.error)}` : ""}</p>
      <p class="lab-scores">Novelty ${scores.novelty ?? "—"} · Evidence ${scores.evidence ?? "—"} · Usefulness ${scores.usefulness ?? "—"} · Human ${scores.human ?? "—"} · Non-paraphrase ${scores.nonParaphrase ?? "—"}</p>`;
    })
    .join("");
}

async function postInsightLab(body, timeoutMs) {
  const response = await fetchWithTimeout(
    `${location.origin}/api/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "insight-lab", ...body }),
    },
    timeoutMs
  );
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function runInsightLabSlot(seal, slot) {
  let continueToken = "";
  for (let i = 0; i < 6; i += 1) {
    const { response, payload } = await postInsightLab(
      { action: "run", seal, slot, continueToken: continueToken || undefined },
      59000
    );
    if (response.status === 403) {
      const error = new Error("沒有 Internal 權限");
      error.status = 403;
      throw error;
    }
    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    if (payload.data.done) return payload.data;
    continueToken = payload.data.continueToken || "";
    if (!continueToken) throw new Error("Lab slot 未完成");
  }
  throw new Error("Lab slot 未完成");
}

async function runInsightLab() {
  if (!isInternalMembership()) return;
  const date = String(document.getElementById("labDate")?.value || currentIso()).trim();
  const fixtureId = String(document.getElementById("labFixture")?.value || "").trim();
  const stored = getReview(date);
  let journal = stored && stored.journal;
  if ((!journal || !labHasRaw(labRawFromJournal(journal))) && date === currentIso()) journal = collectJournal();
  const raw = fixtureId ? {} : labRawFromJournal(journal);
  if (!fixtureId && !labHasRaw(raw)) {
    showToast("這天沒有 01～03 原文");
    return;
  }
  writeLabExperiment({ date, fixtureId, running: true, slots: [], vote: "", reasons: [], revealed: null });
  renderInsightLab();
  try {
    const started = await postInsightLab(
      { action: "start", date, fixtureId, raw: fixtureId ? undefined : raw },
      15000
    );
    if (started.response.status === 403) {
      writeLabExperiment({ date, fixtureId, error: "沒有 Internal 權限", slots: [] });
      renderInsightLab();
      return;
    }
    if (!started.response.ok || !started.payload.ok || !started.payload.data) {
      throw new Error(started.payload.error || `HTTP ${started.response.status}`);
    }
    const plan = started.payload.data;
    const keys = (Array.isArray(plan.slots) ? plan.slots : []).map((row) => row && row.key).filter(Boolean);
    const parts = await Promise.all(
      keys.map(async (slot) => {
        try {
          return await runInsightLabSlot(plan.seal, slot);
        } catch (error) {
          if (error && error.status === 403) throw error;
          return {
            slot,
            done: true,
            result: {
              key: slot,
              hasInsight: false,
              failed: true,
              items: [{ hasInsight: false, title: "", insight: "", question: null }],
            },
            branchSeal: "",
          };
        }
      })
    );
    const slots = keys.map((key) => {
      const part = parts.find((item) => item && (item.slot === key || (item.result && item.result.key === key)));
      return part && part.result
        ? part.result
        : { key, hasInsight: false, failed: true, items: [{ hasInsight: false, title: "", insight: "", question: null }] };
    });
    writeLabExperiment({
      date,
      fixtureId,
      fingerprint: plan.fingerprint,
      slots,
      seal: plan.seal,
      branchSeals: parts.map((item) => item && item.branchSeal).filter(Boolean),
      vote: "",
      reasons: [],
      whyOther: "",
      revealed: null,
    });
    renderInsightLab();
  } catch (error) {
    writeLabExperiment({ date, fixtureId, error: String(error && error.message ? error.message : error), slots: [] });
    renderInsightLab();
  }
}

async function submitInsightLabVote(event) {
  event.preventDefault();
  if (!isInternalMembership()) return;
  const exp = readLabExperiment();
  if (!exp || !exp.seal || exp.vote) return;
  const pick = String(event.target.querySelector("input[name=labPick]:checked")?.value || "").trim();
  if (!pick) {
    showToast("請先選一個版本");
    return;
  }
  const reasons = Array.from(event.target.querySelectorAll("input[name=labReason]:checked")).map((node) => node.value);
  const whyOther = String(document.getElementById("labOther")?.value || "").trim();
  try {
    const response = await fetchWithTimeout(
      `${location.origin}/api/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "insight-lab", action: "reveal", seal: exp.seal, branchSeals: exp.branchSeals || [] }),
      },
      12000
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || "無法顯示對照");
    writeLabExperiment({
      ...exp,
      vote: pick,
      reasons,
      whyOther,
      revealed: payload.data,
    });
    renderInsightLab();
  } catch (error) {
    showToast(String(error && error.message ? error.message : error));
  }
}

/* =============================================================================
 * 工具
 * =========================================================================== */

function cloudStoreKey(name) {
  const uid = state.user && state.user.id;
  return uid ? `nichi.u.${uid}.${name}` : `nichi.${name}`;
}

function isCloudStoreKey(key) {
  return CLOUD_STORE_NAMES.some((name) => key === `nichi.${name}` || key.endsWith(`.${name}`) && key.startsWith("nichi.u."));
}

function storedValueIsMeaningful(raw) {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed == null) return false;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === "object") return Object.keys(parsed).length > 0;
    return Boolean(String(parsed).trim());
  } catch {
    return Boolean(String(raw).trim());
  }
}

function adoptUserScopedStorage(userId) {
  const id = String(userId || "").trim();
  if (!id) return;
  CLOUD_STORE_NAMES.forEach((name) => {
    const scoped = `nichi.u.${id}.${name}`;
    try {
      if (storedValueIsMeaningful(localStorage.getItem(scoped))) return;
      const shared = localStorage.getItem(`nichi.${name}`);
      if (storedValueIsMeaningful(shared)) localStorage.setItem(scoped, shared);
    } catch {
      /* 本機搬移失敗不擋雲端同步 */
    }
  });
}

function guestDataMayBelongToUser(userId) {
  const id = String(userId || "").trim();
  if (!id) return false;
  try {
    const reviews = loadJson("nichi.reviews", {});
    const tagged = Object.values(reviews)
      .map((review) => (review && review.userId ? String(review.userId) : ""))
      .filter(Boolean);
    if (tagged.some((uid) => uid !== id)) return false;
    return true;
  } catch {
    return false;
  }
}

function migrationFlagKey(userId) {
  return `nichi.u.${String(userId || "").trim()}.cloudMigrationCompleted_v1`;
}

function readMigrationFlag(userId) {
  try {
    return localStorage.getItem(migrationFlagKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeMigrationFlag(userId) {
  try {
    localStorage.setItem(migrationFlagKey(userId), "true");
  } catch {
    /* ignore */
  }
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value, options = {}) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("[進行式 ING] 本機儲存失敗", error);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (!options.silent) showToast("這台裝置的暫存空間有點滿，我們會再試著把紀錄留在這裡。");
    }
  }
  if (!options.silent && isCloudStoreKey(key)) {
    markUnsynced("edit");
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

function insightHighlightApi() {
  return (typeof window !== "undefined" && window.NichiInsightHighlight) || {};
}

function userMarkApi() {
  return (typeof window !== "undefined" && window.NichiUserMark) || {};
}

function highlightedHtml(text, highlights, userMarks) {
  const api = insightHighlightApi();
  if (typeof api.renderCombinedHighlightedText === "function") {
    return api.renderCombinedHighlightedText(text, highlights, userMarks);
  }
  if (typeof api.renderHighlightedText === "function") return api.renderHighlightedText(text, highlights);
  return escapeHtml(text);
}

function fieldHighlightsOf(bag, field) {
  const api = insightHighlightApi();
  if (typeof api.fieldHighlights === "function") return api.fieldHighlights(bag, field);
  if (!bag) return [];
  if (Array.isArray(bag)) return bag;
  if (typeof bag === "object" && Array.isArray(bag[field])) return bag[field];
  return [];
}

function nestedHighlights(bag, field) {
  if (!bag) return [];
  if (Array.isArray(bag)) return bag;
  return fieldHighlightsOf(bag, field);
}

function userMarkHintSeen() {
  try {
    return localStorage.getItem(STORAGE_KEYS.userMarkHint) === "1";
  } catch {
    return false;
  }
}

function rememberUserMarkHint() {
  try {
    localStorage.setItem(STORAGE_KEYS.userMarkHint, "1");
  } catch {
    /* ignore */
  }
}

function userMarkHintHtml() {
  if (userMarkHintSeen()) return "";
  if (typeof document !== "undefined" && document.querySelector(".user-mark-hint")) return "";
  return `<p class="user-mark-hint">長按或選取文字，留下今天對你重要的一句。</p>`;
}

function userMarkBag(value) {
  const api = userMarkApi();
  if (typeof api.asMarkBag === "function") return api.asMarkBag(value);
  if (Array.isArray(value)) return { items: value.filter((item) => item && typeof item === "object"), updatedAt: "" };
  if (value && typeof value === "object") {
    return {
      items: Array.isArray(value.items) ? value.items.filter((item) => item && typeof item === "object") : [],
      updatedAt: String(value.updatedAt || "").trim(),
    };
  }
  return { items: [], updatedAt: "" };
}

function normalizeUserMarks(list) {
  return userMarkBag(list).items;
}

function currentUserMarks(date) {
  if (date && date !== currentIso()) return userMarkBag(getReview(date)?.journal?.userMarks).items;
  return userMarkBag(state.journalUserMarks).items;
}

function marksForField(field, date) {
  const api = userMarkApi();
  const items = currentUserMarks(date);
  if (typeof api.marksForField === "function") return api.marksForField(items, field);
  const key = String(field || "").trim();
  if (!key) return [];
  return items.filter((item) => item && item.field === key);
}

function markableOpenAttrs(field, date) {
  const safeField = escapeHtml(field);
  const dateAttr = date ? ` data-mark-date="${escapeHtml(date)}"` : "";
  return `data-user-mark-field="${safeField}" data-mark-field="${safeField}"${dateAttr}`;
}

function markableHtml(tag, text, field, className, date, highlights) {
  const raw = String(text == null ? "" : text);
  if (!String(raw).trim()) return "";
  const cls = [field ? "js-markable" : "", className].filter(Boolean).join(" ");
  const attrs = field ? ` ${markableOpenAttrs(field, date)}` : "";
  return `<${tag} class="${cls}"${attrs}>${highlightedHtml(raw, highlights, marksForField(field, date))}</${tag}>`;
}

function markableP(text, field, className, date, highlights) {
  return markableHtml("p", text, field, className, date, highlights);
}

function markableSpan(text, field, className, date, highlights) {
  return markableHtml("span", text, field, className, date, highlights);
}

function insightFieldHtml(text, field, className = "insight-block__text", date, highlights) {
  return markableP(text, field, className, date, highlights);
}

function highlightsAttr(value) {
  if (value == null || value === "") return "";
  try {
    return encodeURIComponent(JSON.stringify(value));
  } catch {
    return "";
  }
}

function highlightsFromAttr(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return undefined;
  }
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

function textIntegrityApi() {
  return (typeof window !== "undefined" && window.NichiTextIntegrity) || {};
}

function excerptText(text, max = 140) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  const api = textIntegrityApi();
  if (typeof api.pickCompleteSentence === "function") {
    const picked = api.pickCompleteSentence(cleaned, max);
    if (picked) return picked;
    if (typeof api.splitSentences === "function" && typeof api.isCompleteSentence === "function") {
      const first = api.splitSentences(cleaned)[0] || "";
      if (first && api.isCompleteSentence(first)) return first;
    }
  }
  return cleaned;
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
  const stored = loadJson(cloudStoreKey("reviews"), {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function saveReviews(reviews) {
  saveJson(cloudStoreKey("reviews"), reviews);
}

function getReview(iso) {
  return getReviews()[iso] || null;
}

function upsertReview(iso, patch) {
  const reviews = getReviews();
  const prev = reviews[iso] && typeof reviews[iso] === "object" ? reviews[iso] : {};
  const incoming = {
    ...prev,
    ...patch,
    date: iso,
    userId: (state.user && state.user.id) || patch.userId || prev.userId || "",
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };
  reviews[iso] = pickReview(prev, incoming) || incoming;
  saveReviews(reviews);
  return reviews[iso];
}

function getTasks() {
  const saved = loadJson(cloudStoreKey("tasks"), []);
  return Array.isArray(saved) ? saved : [];
}

function saveTasks(tasks) {
  saveJson(cloudStoreKey("tasks"), tasks);
}

function splitTaskText(text) {
  const api = textIntegrityApi();
  if (typeof api.splitTitleDetail === "function") return api.splitTitleDetail(text);
  const raw = String(text || "").trim();
  return { title: raw, detail: "" };
}

function resolveExecTitleDetail(title, detail, rawSources) {
  const api = textIntegrityApi();
  if (typeof api.resolveTitleDetail === "function") return api.resolveTitleDetail(title, detail, rawSources);
  if (typeof api.repairLegacyTimeSplit === "function") {
    const repaired = api.repairLegacyTimeSplit(title, detail);
    if (repaired && repaired.repaired) return splitTaskText(repaired.source);
  }
  return { title: String(title || "").trim(), detail: String(detail || "").trim() };
}

function execRawSourcesFrom(journal) {
  const data = journal && typeof journal === "object" ? journal : {};
  const bag = data.executionChoices || state.executionChoices;
  const selected = selectedExecutionChoiceActions(bag).map((item) => item.text);
  const selectedDetails = selectedExecutionChoiceActions(bag).map((item) => String(item && item.detail ? item.detail : "").trim()).filter(Boolean);
  const options = Array.isArray(bag && bag.options)
    ? bag.options.flatMap((item) => [String(item && item.text ? item.text : "").trim(), String(item && item.detail ? item.detail : "").trim()])
    : [];
  const custom = String((bag && bag.custom) || "").trim();
  const step = String(data.smallestStep || "").trim();
  const checks = Array.isArray(data.executionChecks) ? data.executionChecks : [];
  return [...selected, ...selectedDetails, ...options, custom, step, ...checks].map((item) => String(item || "").trim()).filter(Boolean);
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
  return resolveExecTitleDetail(storedTitle, storedDetail && storedDetail !== storedTitle ? storedDetail : "", []);
}

function taskSidebarApi() {
  return (typeof window !== "undefined" && window.NichiTaskSidebar) || {};
}

function sidebarTodayIso() {
  return toInputDate(new Date());
}

function sidebarPresentTask(task) {
  const parts = taskDisplayParts(task);
  const api = taskSidebarApi();
  if (typeof api.presentLegacyTitle === "function") return api.presentLegacyTitle(parts, task);
  return parts;
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
  trackProduct("action_card_created", { source: "guide" });
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
  const saved = loadJson(cloudStoreKey("sfm"), []);
  return Array.isArray(saved) ? saved : [];
}

function saveSfm(items) {
  saveJson(cloudStoreKey("sfm"), items);
}

function getInsights() {
  const saved = loadJson(cloudStoreKey("insights"), []);
  return Array.isArray(saved) ? saved : [];
}

function saveInsights(items) {
  saveJson(cloudStoreKey("insights"), items);
}

function getManifests() {
  const saved = loadJson(cloudStoreKey("manifests"), []);
  return Array.isArray(saved) ? saved : [];
}

function saveManifests(items) {
  saveJson(cloudStoreKey("manifests"), items);
}

function addManifest({ key, title, vision, date, futureVision, approachStep, manifestationStatement }) {
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
    futureVision: String(futureVision || "").trim(),
    approachStep: String(approachStep || "").trim(),
    manifestationStatement: String(manifestationStatement || "").trim(),
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

function manifestPlanSidebarKey(iso) {
  return `manifest-plan:${iso || currentIso()}`;
}

function manifestPlanStatusFromSteps(steps) {
  const list = Array.isArray(steps) ? steps.filter((item) => String(item && item.title || "").trim()) : [];
  if (!list.length) return "";
  return list.every((item) => item.completed) ? "done" : "doing";
}

function upsertManifestPlanToSidebar(iso, journal) {
  const vision = String((journal && journal.manifest) || "").trim();
  const plan = normalizeManifestPlan(journal && journal.manifestPlan);
  if (!vision || !plan.steps.length) return { added: false };
  const date = iso || currentIso();
  const key = manifestPlanSidebarKey(date);
  const status = manifestPlanStatusFromSteps(plan.steps) || "doing";
  const items = getManifests();
  const index = items.findIndex((item) => item.sourceKey === key);
  const now = new Date().toISOString();
  if (index >= 0) {
    items[index] = {
      ...items[index],
      title: vision,
      vision,
      steps: plan.steps,
      planId: plan.id,
      status,
      date,
      updatedAt: now,
    };
    saveManifests(items);
    try {
      renderManifests();
    } catch {
      /* ignore */
    }
    return { added: false, exists: true, updated: true };
  }
  items.unshift({
    id: uid(),
    title: vision,
    vision,
    steps: plan.steps,
    planId: plan.id,
    date,
    status,
    source: "今日復盤",
    sourceKey: key,
    createdAt: now,
    updatedAt: now,
  });
  saveManifests(items);
  try {
    renderManifests();
  } catch {
    /* ignore */
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
  normalizeAwarenessQuotes(data.awarenessCheckItems).forEach((quote, index) => {
    addInsight({
      key: `insight-quote:${iso}:${index}:${quote}`,
      title: quote,
      date: iso,
      source: "今日復盤",
    });
  });
  const execItems = normalizeExecCheckItems(data.executionCheckItems, execRawSourcesFrom(data));
  (data.executionChecks || []).forEach((label) => {
    const title = String(label || "").trim();
    if (!title) return;
    const item = execItems.find((entry) => entry.title === title || entry.legacyTitle === title);
    addTaskFromGuide({
      key: `exec:${iso}:${title}`,
      label: item ? item.title : title,
      detail: item?.detail || "",
      source: "今日復盤",
      date: iso,
    });
  });
  execItems.forEach((item) => {
    const title = String(item && item.title ? item.title : "").trim();
    if (!title) return;
    addTaskFromGuide({
      key: `exec:${iso}:${item.legacyTitle || title}`,
      label: title,
      detail: item.detail || "",
      source: "今日復盤",
      date: iso,
    });
  });
  const smallest = String(data.smallestStep || "").trim();
  const choiceActions = selectedExecutionChoiceActions(data.executionChoices);
  choiceActions.forEach((item) => {
    const title = String(item && item.text ? item.text : "").trim();
    if (!title) return;
    addTaskFromGuide({
      key: execCheckTaskKey(title, iso),
      label: title,
      detail: item.detail || "",
      source: "今日復盤",
      date: iso,
    });
  });
  if (smallest && !choiceActions.length) {
    addTaskFromGuide({
      key: `exec-step:${iso}`,
      label: "明天最小一步",
      detail: smallest,
      source: "今日最小行動",
      date: iso,
    });
  }
  const vision = String(data.manifest || "").trim();
  if (hasManifestPlan(data.manifestPlan)) {
    upsertManifestPlanToSidebar(iso, data);
    return;
  }
  const close = normalizeManifestCloseBag(data.manifestClose);
  if (hasManifestCloseContent(close)) {
    if (close.accepted) {
      addManifest({
        key: `manifest-close:${iso}`,
        title: close.approachStep || close.manifestationStatement || vision,
        vision,
        futureVision: close.futureVision,
        approachStep: close.approachStep,
        manifestationStatement: close.manifestationStatement || String(data.manifestSentence || "").trim(),
        date: iso,
      });
    }
    return;
  }
  (data.manifestChecks || []).forEach((label) => {
    addManifest({
      key: `manifest:${iso}:${label}`,
      title: label,
      vision,
      date: iso,
    });
  });
  normalizeManifestPathItems(data.manifestCheckItems).forEach((item) => {
    const title = String(item && item.title ? item.title : "").trim();
    if (!title) return;
    addManifest({
      key: `manifest:${iso}:${title}`,
      title,
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

function reviewIsFinalized(review) {
  const api = reviewMergeApi();
  if (typeof api.reviewIsFinalized === "function") return api.reviewIsFinalized(review);
  if (!review || typeof review !== "object") return false;
  if (String(review.completedAt || "").trim()) return true;
  return Boolean(review.organize && typeof review.organize === "object" && hasMeaningfulValue(review.organize));
}

function reviewIsComplete(review) {
  return reviewIsFinalized(review);
}

function isCurrentJournalArchived() {
  return reviewIsFinalized(getReview(currentIso()));
}

function reviewSearchText(review) {
  if (!review) return "";
  const ai = review.organize || {};
  return [
    review.historyShortTitle,
    review.rawText,
    review.gratitude,
    review.journal && JSON.stringify(review.journal),
    Array.isArray(review.thinkHistory) ? JSON.stringify(review.thinkHistory) : "",
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
    throw new Error("請用本機 http://localhost:3000 或 Vercel 網址開啟這個網頁（不要開本機 HTML），前端才能呼叫 /api/review。");
  }
  return `${location.origin}${REVIEW_API}`;
}

function chatApiUrl() {
  if (typeof location === "undefined" || location.protocol === "file:") {
    throw new Error("請用本機 http://localhost:3000 或 Vercel 網址開啟這個網頁（不要開本機 HTML），前端才能呼叫 /api/chat。");
  }
  return `${location.origin}${CHAT_API}`;
}

function formatApiError(error) {
  const message = String(error?.message || error || "未知錯誤");
  if (error?.name === "AbortError" || /請求逾時|逾時|504|OpenAI 逾時|Claude 逾時|FUNCTION_INVOCATION_TIMEOUT/i.test(message)) {
    return "雲端整理逾時了。請再試一次。";
  }
  if (/file:|本機 HTML/.test(message)) return message;
  if (/401|請先使用 Google|未登入|未授權/i.test(message)) {
    return "請先使用 Google 登入。新加入進行式，即享 7 天 ING PLUS 完整體驗。";
  }
  if (error?.code === "membership_check_failed" || /membership_check_failed/i.test(message)) {
    return "目前暫時無法確認會員狀態，請稍後再試。";
  }
  if (error?.code === "plus_required" || /plus_required|This feature requires ING PLUS/i.test(message)) {
    return "";
  }
  if (/402|試用已結束|免費體驗已結束|paywall/i.test(message)) {
    return "PLUS 體驗已結束。你仍可繼續使用 ING FREE，過去紀錄都會保留。若想看完整洞察，可隨時升級 PLUS。";
  }
  if (/404|Failed to fetch|fetch 失敗|NetworkError/i.test(message)) {
    return "找不到後端 API。請用本機 http://localhost:3000（npm run dev）或 Vercel 網址開啟。";
  }
  return message;
}

function tokenFromLocalStorage() {
  try {
    const raw = localStorage.getItem("nichi-auth") || sessionStorage.getItem("nichi-auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const candidates = [
      parsed.access_token,
      parsed.currentSession && parsed.currentSession.access_token,
      parsed.session && parsed.session.access_token,
      parsed.data && parsed.data.session && parsed.data.session.access_token,
      parsed.data && parsed.data.access_token,
    ];
    return String(candidates.find(Boolean) || "").trim();
  } catch {
    return "";
  }
}

function currentAccessToken() {
  return String(state.accessToken || tokenFromLocalStorage() || "").trim();
}

function hasStoredAuthSession() {
  try {
    return Boolean(
      currentAccessToken() ||
        localStorage.getItem("nichi-auth") ||
        sessionStorage.getItem("nichi-auth") ||
        localStorage.getItem("nichi-auth-session")
    );
  } catch {
    return false;
  }
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

function aiClientTimeout(timeoutMs) {
  const explicit = Number(timeoutMs);
  const hasExplicit = Number.isFinite(explicit) && explicit > 0;
  if (isInternalMembership()) return hasExplicit ? Math.max(explicit, 58000) : 58000;
  return hasExplicit ? explicit : 28000;
}

async function postReview(body, timeoutMs) {
  return postAiApi(reviewApiUrl(), body, aiClientTimeout(timeoutMs));
}

async function postChat(body, timeoutMs) {
  return postAiApi(chatApiUrl(), body, aiClientTimeout(timeoutMs));
}

async function postAiApi(url, body, timeoutMs = 28000) {
  if (isAccessLocked()) {
    applyAccessLock();
    throw new Error(accessLockMessage());
  }
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
  if (payload && payload.error === "membership_check_failed") {
    const err = new Error("membership_check_failed");
    err.code = "membership_check_failed";
    throw err;
  }
  if (payload && payload.error === "plus_required") {
    openPlusUpgradeModal();
    const err = new Error("plus_required");
    err.code = "plus_required";
    err.feature = payload.feature || "";
    throw err;
  }
  if (payload && payload.error === "internal_required") {
    const err = new Error("internal_required");
    err.code = "internal_required";
    throw err;
  }
  if (applyPaywallFromPayload(response, payload) || !response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  if (!payload.data || typeof payload.data !== "object") {
    throw new Error("雲端回傳格式不完整");
  }
  if (payload._internalDebug && payload.data && typeof payload.data === "object") {
    payload.data._internalDebug = payload._internalDebug;
  }
  if (payload._internalRetrieval && payload.data && typeof payload.data === "object") {
    payload.data._internalRetrieval = payload._internalRetrieval;
  }
  return payload.data;
}

async function generateReview(rawText) {
  if (!ensurePlusFeature("insight_ai")) return null;
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
  if (!ensurePlusFeature("think_ai")) return null;
  const remote = await postChat({
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
    const chatUrl = chatApiUrl();
    const chatResponse = await fetchWithTimeout(chatUrl, { method: "GET" }, 8000);
    const chatPayload = await chatResponse.json().catch(() => ({}));
    if (chatResponse.ok && chatPayload && typeof chatPayload === "object") {
      state.apiConfigured = Boolean(chatPayload.configured);
      const label = [chatPayload.provider, chatPayload.model].filter(Boolean).join(" / ") || "未標示模型";
      if (state.apiConfigured) {
        console.log("[日精進 API] /api/chat 金鑰已設定", label);
      } else {
        console.warn("[日精進 API] 伺服器還沒讀到 ANTHROPIC_API_KEY 或 OPENAI_API_KEY。本機請寫入 .env.local，Vercel 請設環境變數後 Redeploy。");
      }
      return;
    }
  } catch (error) {
    console.warn("[日精進 API] /api/chat 健康檢查失敗", formatApiError(error), error);
  }
  try {
    const url = reviewApiUrl();
    const response = await fetchWithTimeout(url, { method: "GET" }, 8000);
    const payload = await response.json().catch(() => ({}));
    state.apiConfigured = Boolean(payload.configured);
    if (state.apiConfigured) {
      console.log("[日精進 API] 雲端金鑰已設定", payload.provider || "openai", payload.model || "gpt-4o-mini");
    } else {
      console.warn("[日精進 API] 伺服器還沒讀到 ANTHROPIC_API_KEY 或 OPENAI_API_KEY。請在本機 .env.local 或 Vercel 環境變數設定後 Redeploy。");
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
  if (!canUsePlusFeature("insight_ai")) return;
  showToast("正在連線雲端…");
  try {
    const remote = await generateReview(rawText);
    if (!remote) return;
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
    if (isPlusRequiredError(error)) return;
    const reason = formatApiError(error);
    console.error("[日精進 API] 雲端呼叫失敗，畫面維持本地結果。真正原因：", reason, error);
    if (reason) showToast(`雲端分析失敗：${reason}`);
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
  const saved = loadJson(cloudStoreKey("reports"), {});
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
  saveJson(cloudStoreKey("reports"), all);
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
  const feature = type === "month" ? "monthly_report_full" : "weekly_report_full";
  if (!canUsePlusFeature(feature)) {
    if (options.promptUpgrade) openPlusUpgradeModal();
    return null;
  }
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
  if (payload && payload.error === "membership_check_failed") {
    throw Object.assign(new Error("membership_check_failed"), { code: "membership_check_failed" });
  }
  if (payload && payload.error === "plus_required") {
    if (options.promptUpgrade) openPlusUpgradeModal();
    return null;
  }
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

function setSyncStatus(kind, text) {
  state.syncKind = kind || "";
  state.syncText = text || "";
  applySyncStatus();
}

function applySyncStatus() {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  const kind = state.syncKind || "";
  clearTimeout(applySyncStatus.hideTimer);
  if (!state.user || !kind) {
    el.hidden = true;
    el.textContent = "";
    el.className = "sync-chip";
    el.removeAttribute("title");
    return;
  }
  const labels = {
    saving: "儲存中…",
    pulling: "同步中…",
    saved: "已同步",
    error: "同步失敗",
  };
  const label = labels[kind];
  if (!label) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = label;
  el.title = state.syncText || label;
  el.className = `sync-chip is-${kind}`;
  if (kind === "saved") {
    applySyncStatus.hideTimer = setTimeout(() => {
      if (state.syncKind === "saved") {
        const chip = document.getElementById("syncStatus");
        if (chip) chip.hidden = true;
      }
    }, 2600);
  }
}

function journalHasFocus() {
  const el = document.activeElement;
  return Boolean(el && el.closest && el.closest("#page-today") && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable));
}

function isActivelyEditingJournal() {
  if (journalHasFocus()) return true;
  if (state.awareFoldPinned) return true;
  if (state.checklistBusy.awareness) return true;
  if (state.corePromptsBusy && (state.corePromptsScope === "awareness" || state.corePromptsScope === "awareness-follow")) {
    return true;
  }
  try {
    return typeof isJournalFoldEditing === "function" && isJournalFoldEditing();
  } catch {
    return false;
  }
}

function scheduleCloudSync() {
  if (!state.user) return;
  if (state.syncing) {
    state.cloudDirty = true;
    return;
  }
  clearTimeout(scheduleCloudSync.timer);
  scheduleCloudSync.timer = setTimeout(() => {
    pushCloudData().catch((error) => {
      console.error("[進行式 ING] 延遲同步失敗", error && error.message ? error.message : error);
    });
  }, 1100);
}

async function waitForCloudIdle(timeoutMs = 15000) {
  const started = Date.now();
  while (state.syncing && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

async function flushCloudNow(options = {}) {
  try {
    flushJournalAutosave();
    persistJournalQuietly();
  } catch (error) {
    console.error("[進行式 ING] 寫入本機暫存失敗", error);
  }
  persistLocalBackup(options.reason || "flush");
  if (!state.user) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    markUnsynced("offline");
    setSyncStatus("error", "現在沒有網路。紀錄已先存在這台裝置，連上後會自動同步。");
    return false;
  }
  clearTimeout(scheduleCloudSync.timer);
  await waitForCloudIdle();
  try {
    await pushCloudData({ urgent: true });
    return state.syncKind === "saved" && !hasUnsynced();
  } catch (error) {
    console.error("[進行式 ING] 立即上傳雲端失敗", {
      reason: options.reason || "flush",
      message: error && error.message ? error.message : error,
      code: error && error.code,
    });
    return false;
  }
}

function scheduleCloudRetry() {
  clearTimeout(scheduleCloudRetry.timer);
  const attempt = (scheduleCloudRetry.fails || 0) + 1;
  if (attempt > 8) return;
  scheduleCloudRetry.fails = attempt;
  scheduleCloudRetry.timer = setTimeout(() => {
    pushCloudData().catch((error) => {
      console.error("[進行式 ING] 自動重試仍未送到雲端", {
        attempt,
        message: error && error.message ? error.message : error,
        code: error && error.code,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      });
    });
  }, Math.min(attempt * 2500, 20000));
}

function unsyncedStorageKey() {
  return cloudStoreKey("unsynced");
}

function hasUnsynced() {
  if (state.cloudUnsynced) return true;
  try {
    return Boolean(localStorage.getItem(unsyncedStorageKey()));
  } catch {
    return false;
  }
}

function markUnsynced(reason) {
  if (!state.user) return;
  state.cloudUnsynced = true;
  try {
    localStorage.setItem(
      unsyncedStorageKey(),
      JSON.stringify({ at: new Date().toISOString(), reason: reason || "edit" })
    );
  } catch (error) {
    console.warn("[進行式 ING] 無法標記未同步狀態", error);
  }
}

function clearUnsynced() {
  state.cloudUnsynced = false;
  try {
    localStorage.removeItem(unsyncedStorageKey());
  } catch {
    /* ignore */
  }
  if (state.user) idbDelete(`pending:${state.user.id}`).catch(() => {});
}

function openSyncDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open("nichi-ing-sync", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key, value) {
  const db = await openSyncDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet(key) {
  const db = await openSyncDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("queue", "readonly");
      const req = tx.objectStore("queue").get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbDelete(key) {
  const db = await openSyncDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function persistLocalBackup(reason) {
  if (!state.user) return false;
  try {
    const bundle = collectCloudBundle();
    const payload = {
      savedAt: new Date().toISOString(),
      reason: reason || "save",
      userId: state.user.id,
      email: state.user.email || "",
      reviews: bundle.reviews,
      tasks: bundle.tasks,
      sfm: bundle.sfm,
      insights: bundle.insights,
      manifests: bundle.manifests,
      reports: bundle.reports,
    };
    const text = JSON.stringify(payload);
    localStorage.setItem(cloudStoreKey("backup"), text);
    localStorage.setItem("nichi.backup.last", text);
    idbSet(`pending:${state.user.id}`, payload).catch(() => {});
    return true;
  } catch (error) {
    console.warn("[進行式 ING] 本機備份失敗", error);
    try {
      const bundle = collectCloudBundle();
      idbSet(`pending:${state.user.id}`, bundle).catch(() => {});
    } catch {
      /* ignore */
    }
    return false;
  }
}

async function restoreQueueIfLocalEmpty() {
  if (!state.user) return;
  const local = getReviews();
  if (local && Object.keys(local).length) return;
  const pending = await idbGet(`pending:${state.user.id}`);
  if (!pending || typeof pending !== "object") return;
  console.warn("[進行式 ING] 從本機佇列還原尚未同步的紀錄");
  mergeCloudBundle(pending);
  markUnsynced("restore");
}

function friendlySyncError(error) {
  const message = String(error && error.message ? error.message : error || "");
  const code = String(error && error.code ? error.code : "");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "現在沒有網路。紀錄已先存在這台裝置，連上後再同步即可。";
  }
    if (code === "auth" || /401|登入狀態|請先登入/i.test(message)) {
    return "登入狀態剛過期。紀錄已先留在這台裝置，連上後會自動補傳到雲端。";
  }
  if (code === "config" || /503|準備中/i.test(message)) {
    return "雲端備份還在準備中。紀錄已先存在這台裝置。";
  }
  if (/Failed to fetch|NetworkError|fetch 失敗|逾時|timeout/i.test(message)) {
    return "這次連不到雲端。紀錄已先存在這台裝置，稍候再同步即可。";
  }
  if (message && /尚有未同步|這次還沒送到|紀錄已先|連不到雲端|登入狀態/.test(message)) return message;
  return "這次還沒送到雲端，紀錄已先存在這台裝置。";
}

function collectCloudBundle() {
  const userId = state.user && state.user.id ? String(state.user.id) : "";
  const reviews = {};
  Object.entries(getReviews()).forEach(([iso, review]) => {
    if (!review || typeof review !== "object") return;
    reviews[iso] = { ...review, date: iso, userId: review.userId || userId };
  });
  const tag = (item) => (item && typeof item === "object" ? { ...item, userId: item.userId || userId } : item);
  return {
    userId,
    reviews,
    tasks: getTasks().map(tag),
    sfm: getSfm().map(tag),
    insights: getInsights().map(tag),
    manifests: getManifests().map(tag),
    reports: getStoredReports(),
    updatedAt: new Date().toISOString(),
  };
}

function bundleHasMeaningfulData(bundle) {
  const data = bundle && typeof bundle === "object" ? bundle : {};
  const reviews = data.reviews && typeof data.reviews === "object" ? Object.values(data.reviews) : [];
  if (reviews.some((review) => reviewContentScore(review) >= 10 || (review && review.completedAt))) return true;
  if (Array.isArray(data.tasks) && data.tasks.length) return true;
  if (Array.isArray(data.sfm) && data.sfm.length) return true;
  if (Array.isArray(data.insights) && data.insights.length) return true;
  if (Array.isArray(data.manifests) && data.manifests.length) return true;
  const reports = data.reports && typeof data.reports === "object" ? data.reports : {};
  return Object.keys(reports).some((key) => key && !String(key).startsWith("__"));
}

async function pushViaApi(bundle) {
  const response = await fetchWithTimeout(
    `${location.origin}/api/sync`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bundle,
        email: state.user.email || "",
        access_token: currentAccessToken(),
      }),
    },
    20000
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    console.error("[進行式 ING] /api/sync 寫入失敗", {
      status: response.status,
      code: payload.code,
      error: payload.error,
      reason: payload.reason,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
    });
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.code = payload.code || String(response.status);
    error.reason = payload.reason || "";
    throw error;
  }
  return payload;
}

async function pushViaSupabaseClient(bundle) {
  const client = await getSupabase();
  if (!client || !state.user) return false;
  let existing = null;
  try {
    existing = await loadSupabaseRecords();
  } catch (error) {
    console.warn("[進行式 ING] 直連寫入前讀取雲端失敗", error && error.message ? error.message : error);
  }
  const merged = existing ? combineCloudBundles(existing, bundle) : bundle;
  const { error } = await client.from("nichi_user_data").upsert(
    {
      user_id: state.user.id,
      email: state.user.email || "",
      reviews: merged.reviews,
      tasks: merged.tasks,
      sfm: merged.sfm,
      reports: {
        ...(merged.reports || {}),
        __insights: merged.insights || [],
        __manifests: merged.manifests || [],
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[進行式 ING] Supabase upsert 失敗", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }
  mergeCloudBundle(merged);
  return true;
}

async function pushCloudData(options = {}) {
  if (!state.user || typeof location === "undefined" || location.protocol === "file:") return;
  if (state.syncing) {
    state.cloudDirty = true;
    if (!options.urgent) return;
    await waitForCloudIdle();
    if (state.syncing) return;
  }
  state.syncing = true;
  persistLocalBackup("sync");
  markUnsynced("sync");
  setSyncStatus("saving");
  try {
    await ensureFreshAccessToken();
    const bundle = collectCloudBundle();
    persistLocalBackup("sync");
    let payload = null;
    try {
      payload = await pushViaApi(bundle);
    } catch (apiError) {
      console.error("[進行式 ING] API 上傳失敗，改試瀏覽器直連", {
        message: apiError && apiError.message ? apiError.message : apiError,
        code: apiError && apiError.code,
        reason: apiError && apiError.reason,
      });
      const ok = await pushViaSupabaseClient(bundle);
      if (!ok) throw apiError;
    }
    if (payload && payload.degraded) {
      markUnsynced("degraded");
      setSyncStatus("error", "這次還沒完整送到雲端。紀錄已先留在這台裝置。");
      scheduleCloudRetry();
      return;
    }
    if (payload && payload.data) mergeCloudBundle(payload.data);
    scheduleCloudRetry.fails = 0;
    clearUnsynced();
    setSyncStatus("saved");
  } catch (error) {
    persistLocalBackup("error");
    markUnsynced("error");
    console.error("[進行式 ING] 雲端同步尚未完成", {
      message: error && error.message ? error.message : error,
      code: error && error.code,
      reason: error && error.reason,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
    });
    setSyncStatus("error", friendlySyncError(error));
    scheduleCloudRetry();
    throw error;
  } finally {
    state.syncing = false;
    if (state.cloudDirty) {
      state.cloudDirty = false;
      scheduleCloudSync();
    }
  }
}

function stampMs(value) {
  const raw = value && typeof value === "object" ? value.updatedAt || value.generatedAt || value.createdAt || "" : "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newerStamp(left, right) {
  return stampMs(left) >= stampMs(right);
}

function reviewContentScore(review) {
  if (!review || typeof review !== "object") return 0;
  const journal = review.journal && typeof review.journal === "object" ? review.journal : {};
  const chunks = [
    review.rawText,
    review.gratitude,
    journal.thanksText,
    journal.thanks,
    journal.event,
    journal.feel,
    journal.mood,
    journal.body,
    journal.bodyNote,
    journal.bodyMind ? JSON.stringify(journal.bodyMind) : "",
    journal.aware,
    journal.exec,
    journal.smallestStep,
    journal.manifest,
    journal.manifestSentence,
    journal.manifestClose ? JSON.stringify(journal.manifestClose) : "",
    journal.manifestPlan ? JSON.stringify(journal.manifestPlan) : "",
    journal.deep ? JSON.stringify(journal.deep) : "",
    journal.awareness ? JSON.stringify(journal.awareness) : "",
    journal.awarenessChoices ? JSON.stringify(journal.awarenessChoices) : "",
    journal.thinkChoices ? JSON.stringify(journal.thinkChoices) : "",
    journal.executionChoices ? JSON.stringify(journal.executionChoices) : "",
    journal.execution ? JSON.stringify(journal.execution) : "",
    journal.manifestThink ? JSON.stringify(journal.manifestThink) : "",
    journal.awarenessResult ? JSON.stringify(journal.awarenessResult) : "",
    journal.awarenessChecks ? JSON.stringify(journal.awarenessChecks) : "",
    journal.awarenessCheckItems ? JSON.stringify(journal.awarenessCheckItems) : "",
    journal.executionChecks ? JSON.stringify(journal.executionChecks) : "",
    journal.executionCheckItems ? JSON.stringify(journal.executionCheckItems) : "",
    journal.manifestChecks ? JSON.stringify(journal.manifestChecks) : "",
    journal.manifestCheckItems ? JSON.stringify(journal.manifestCheckItems) : "",
    journal.bodyCheck ? JSON.stringify(journal.bodyCheck) : "",
    journal.bodyCoach ? JSON.stringify(journal.bodyCoach) : "",
    journal.insight ? JSON.stringify(journal.insight) : "",
    review.organize ? JSON.stringify(review.organize) : "",
    Array.isArray(review.selectedQuotes) ? review.selectedQuotes.join(" ") : "",
    Array.isArray(review.selectedSfm) ? JSON.stringify(review.selectedSfm) : "",
    Array.isArray(review.selectedThinkActions) ? review.selectedThinkActions.join(" ") : "",
    Array.isArray(review.selectedPractice) ? review.selectedPractice.join(" ") : "",
    Array.isArray(review.thinkHistory) ? JSON.stringify(review.thinkHistory) : "",
  ];
  let score = chunks.reduce((sum, chunk) => sum + String(chunk || "").trim().length, 0);
  if (review.completedAt) score += 80;
  return score;
}

function reviewMergeApi() {
  return (typeof window !== "undefined" && window.NichiReviewMerge) || {};
}

function emptyChoiceBag() {
  const api = reviewMergeApi();
  if (typeof api.emptyChoiceBag === "function") return api.emptyChoiceBag();
  return { sourceSig: "", options: [], selectedIds: [], generatedAt: "" };
}

function normalizeChoiceBag(raw, options) {
  const api = reviewMergeApi();
  if (typeof api.normalizeChoiceBag === "function") return api.normalizeChoiceBag(raw, options);
  const src = raw && typeof raw === "object" ? raw : {};
  const optionsList = Array.isArray(src.options) ? src.options : [];
  return {
    sourceSig: String(src.sourceSig || "").trim(),
    options: optionsList
      .map((item, index) => ({
        id: String(item && item.id ? item.id : `opt${index + 1}`),
        text: String(item && (item.text || item.label) ? item.text || item.label : item || "").trim(),
      }))
      .filter((item) => item.text),
    selectedIds: Array.isArray(src.selectedIds) ? src.selectedIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 2) : [],
    generatedAt: String(src.generatedAt || "").trim(),
    ...(src.none ? { none: true } : {}),
  };
}

function hasMeaningfulChoices(value) {
  const api = reviewMergeApi();
  if (typeof api.hasMeaningfulChoices === "function") return api.hasMeaningfulChoices(value);
  const bag = normalizeChoiceBag(value);
  return bag.options.length > 0 || bag.selectedIds.length > 0 || bag.none === true;
}

function selectedChoiceTexts(value) {
  const api = reviewMergeApi();
  if (typeof api.selectedChoiceTexts === "function") return api.selectedChoiceTexts(value);
  const bag = normalizeChoiceBag(value);
  if (bag.none) return [];
  const map = new Map(bag.options.map((item) => [item.id, item.text]));
  return bag.selectedIds.map((id) => map.get(id)).filter(Boolean);
}

function choiceNoneId() {
  const api = reviewMergeApi();
  return api.CHOICE_NONE_ID || "none";
}

function choiceNoneText() {
  const api = reviewMergeApi();
  return api.CHOICE_NONE_TEXT || "今天沒有特別符合我的選項";
}

function choiceMaxSelected() {
  const api = reviewMergeApi();
  return Number.isFinite(api.CHOICE_MAX_SELECTED) ? api.CHOICE_MAX_SELECTED : 2;
}

function serializeChoiceBag(raw) {
  const bag = normalizeChoiceBag(raw);
  const next = {
    sourceSig: bag.sourceSig,
    options: bag.options.map((item) => ({ id: item.id, text: item.text })),
    selectedIds: bag.selectedIds.slice(),
    generatedAt: bag.generatedAt,
  };
  if (bag.none) next.none = true;
  return next;
}

function emptyExecDeep() {
  const api = reviewMergeApi();
  if (typeof api.emptyExecDeep === "function") return api.emptyExecDeep();
  return { status: "", rounds: [], draftAnswer: "", refreshedAt: "", executionSummary: "", finalOptions: [], finalSelectedIds: [] };
}

function normalizeExecDeep(raw) {
  const api = reviewMergeApi();
  if (typeof api.normalizeExecDeep === "function") return api.normalizeExecDeep(raw);
  const src = raw && typeof raw === "object" ? raw : {};
  const rounds = (Array.isArray(src.rounds) ? src.rounds : [])
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const question = String(item.question || "").trim();
      const answer = String(item.answer || "").trim();
      if (!question && !answer) return null;
      return {
        id: String(item.id || `d${index + 1}`),
        question,
        answer,
        placeholder: String(item.placeholder || "").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 2);
  const asking = rounds.some((item) => item.question && !item.answer);
  const answeredAll = rounds.length > 0 && rounds.every((item) => item.answer) && !asking;
  const closed = String(src.status || "") === "closed" || (rounds.length >= 2 && answeredAll);
  const finalOptions = (Array.isArray(src.finalOptions) ? src.finalOptions : [])
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || item.title || "").trim();
      if (!text) return null;
      const next = { id: String(item.id || `f${index + 1}`), text };
      if (item.detail) next.detail = String(item.detail).trim();
      return next;
    })
    .filter(Boolean)
    .slice(0, 3);
  const finalIds = new Set(finalOptions.map((item) => item.id));
  return {
    status: closed ? "closed" : asking || (src.status === "asking" && !closed) ? "asking" : "",
    rounds,
    draftAnswer: String(src.draftAnswer || "").trim(),
    refreshedAt: String(src.refreshedAt || "").trim(),
    executionSummary: String(src.executionSummary || "").replace(/\s+/g, " ").trim(),
    finalOptions,
    finalSelectedIds: (Array.isArray(src.finalSelectedIds) ? src.finalSelectedIds : []).filter((id) => finalIds.has(id)),
  };
}

function hasExecDeepFinal(deep) {
  const api = reviewMergeApi();
  if (typeof api.hasExecDeepFinal === "function") return api.hasExecDeepFinal(deep);
  const data = normalizeExecDeep(deep);
  return Boolean(data.executionSummary) && data.finalOptions.length >= 3;
}

function hasMeaningfulExecDeep(value) {
  const api = reviewMergeApi();
  if (typeof api.hasMeaningfulExecDeep === "function") return api.hasMeaningfulExecDeep(value);
  const deep = normalizeExecDeep(value);
  return deep.rounds.length > 0 || Boolean(deep.draftAnswer) || Boolean(deep.status) || Boolean(deep.executionSummary) || (deep.finalOptions && deep.finalOptions.length);
}

function execDeepAnsweredRounds(deep) {
  return normalizeExecDeep(deep).rounds.filter((item) => String(item.answer || "").trim());
}

function execDeepCurrentQuestion(deep) {
  return normalizeExecDeep(deep).rounds.find((item) => item.question && !String(item.answer || "").trim()) || null;
}

function execDeepClosed(deep) {
  const data = normalizeExecDeep(deep);
  return data.status === "closed" || execDeepAnsweredRounds(data).length >= 2;
}

function shouldSkipExecDeepAsk(deep, actions) {
  const data = normalizeExecDeep(deep);
  const answered = execDeepAnsweredRounds(data);
  if (answered.length >= 2 || data.status === "closed") return true;
  if (answered.length < 1) return false;
  const last = String(answered[answered.length - 1].answer || "").trim();
  if (!last) return false;
  if (/還不[知道確定清]|還沒想|不確定|搞不清楚|兩個都|還是不知道/.test(last)) return false;
  if (last.replace(/\s+/g, "").length < 8) return false;
  const titles = (Array.isArray(actions) ? actions : []).map((item) => String(item && (item.text || item.title) || "").trim()).filter(Boolean);
  const picked = titles.some((title) => last.includes(title.slice(0, 6)));
  return picked || /就選|先做|最想|最重要|第一個|第二個|第三個|如果做到/.test(last) || (/就是|我要|先把|下次/.test(last) && last.replace(/\s+/g, "").length >= 12);
}

function mergeRefreshedExecOptions(currentOptions, selectedIds, incoming) {
  const current = Array.isArray(currentOptions) ? currentOptions : [];
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).filter((id) => id && id !== execChoiceCustomId()));
  const kept = current.filter((item) => selected.has(item.id));
  const keptTexts = new Set(kept.map((item) => String(item.text || "").trim()));
  const next = kept.slice();
  (Array.isArray(incoming) ? incoming : []).forEach((item, index) => {
    if (next.length >= 3) return;
    const text = String(item && (item.text || item.title) || "").trim();
    if (!text || keptTexts.has(text)) return;
    let id = String(item && item.id || `e${index + 1}`).trim() || `e${index + 1}`;
    if (next.some((entry) => entry.id === id) || selected.has(id)) id = `n${next.length + 1}`;
    next.push({ ...item, id, text });
    keptTexts.add(text);
  });
  return next.slice(0, 3);
}

function emptyExecutionChoiceBag() {
  const api = reviewMergeApi();
  if (typeof api.emptyExecutionChoiceBag === "function") return api.emptyExecutionChoiceBag();
  return { sourceSig: "", options: [], selectedId: "", selectedIds: [], custom: "", followupQuestion: "", followupPlaceholder: "", generatedAt: "", deep: emptyExecDeep() };
}

function normalizeExecutionChoiceBag(raw, options) {
  const api = reviewMergeApi();
  if (typeof api.normalizeExecutionChoiceBag === "function") return api.normalizeExecutionChoiceBag(raw, options);
  const src = raw && typeof raw === "object" ? raw : {};
  const optionsList = Array.isArray(src.options) ? src.options.map((item, index) => {
    const text = String(item && (item.text || item.label) ? item.text || item.label : item || "").trim();
    const next = {
      id: String(item && item.id ? item.id : `e${index + 1}`),
      text,
    };
    const extras = typeof api.executionChoiceOptionExtras === "function"
      ? api.executionChoiceOptionExtras(item, text)
      : {};
    if (extras.detail) next.detail = extras.detail;
    else if (item && item.detail) next.detail = String(item.detail).trim();
    if (extras.kind) next.kind = extras.kind;
    else if (item && item.kind) next.kind = item.kind;
    if (extras.actKind) next.actKind = extras.actKind;
    else if (item && item.actKind) next.actKind = item.actKind;
    if (extras.horizon) next.horizon = extras.horizon;
    else if (item && item.horizon) next.horizon = item.horizon;
    if (extras.sourceAwarenessIds) next.sourceAwarenessIds = extras.sourceAwarenessIds;
    else if (item && Array.isArray(item.sourceAwarenessIds)) next.sourceAwarenessIds = item.sourceAwarenessIds;
    return next;
  }).filter((item) => item.text) : [];
  const optionIds = new Set(optionsList.map((item) => item.id));
  const hasIdsField = Array.isArray(src.selectedIds);
  const rawIds = hasIdsField && src.selectedIds.length
    ? src.selectedIds
    : (String(src.selectedId || "").trim() ? [String(src.selectedId).trim()] : (hasIdsField ? src.selectedIds : []));
  const selectedIds = [];
  rawIds.forEach((id) => {
    const value = String(id || "").trim();
    if (!value || selectedIds.includes(value)) return;
    if (value !== "custom" && !optionIds.has(value)) return;
    if (selectedIds.length >= 3) return;
    selectedIds.push(value);
  });
  return {
    variant: String(src.variant || "").trim(),
    actVariant: String(src.actVariant || "").trim(),
    status: String(src.status || "").trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    options: optionsList,
    selectedId: selectedIds[0] || "",
    selectedIds,
    custom: String(src.custom || "").trim(),
    followupQuestion: String(src.followupQuestion || "").trim(),
    followupPlaceholder: String(src.followupPlaceholder || "").trim(),
    generatedAt: String(src.generatedAt || "").trim(),
    deep: normalizeExecDeep(src.deep),
    noActionCopy: src.noActionCopy && typeof src.noActionCopy === "object" ? src.noActionCopy : null,
    leadIn: String(src.leadIn || "").replace(/\s+/g, " ").trim(),
  };
}

function hasMeaningfulExecutionChoices(value) {
  const api = reviewMergeApi();
  if (typeof api.hasMeaningfulExecutionChoices === "function") return api.hasMeaningfulExecutionChoices(value);
  const bag = normalizeExecutionChoiceBag(value);
  return bag.options.length > 0 || bag.selectedIds.length > 0 || Boolean(bag.selectedId) || Boolean(bag.custom) || Boolean(bag.followupQuestion) || hasMeaningfulExecDeep(bag.deep);
}

function selectedExecutionChoiceActions(value) {
  const api = reviewMergeApi();
  if (typeof api.selectedExecutionChoiceActions === "function") return api.selectedExecutionChoiceActions(value);
  const bag = normalizeExecutionChoiceBag(value);
  return (bag.selectedIds || []).map((id) => {
    if (id === "custom") {
      const text = String(bag.custom || "").trim();
      return text ? { id, text } : null;
    }
    const match = bag.options.find((item) => item.id === id);
    const text = match ? String(match.text || "").trim() : "";
    if (!text) return null;
    const extras = typeof api.executionChoiceOptionExtras === "function"
      ? api.executionChoiceOptionExtras(match, text)
      : {};
    return { id, text, ...extras };
  }).filter(Boolean);
}

function selectedExecutionChoiceText(value) {
  const api = reviewMergeApi();
  if (typeof api.selectedExecutionChoiceText === "function") return api.selectedExecutionChoiceText(value);
  const actions = selectedExecutionChoiceActions(value);
  return actions[0] ? actions[0].text : "";
}

function serializeExecutionChoiceOption(item) {
  const next = {
    id: item && item.id ? item.id : "",
    text: item && item.text ? item.text : "",
  };
  if (item && item.detail) next.detail = item.detail;
  if (item && item.kind) next.kind = item.kind;
  if (item && item.actKind) next.actKind = item.actKind;
  if (item && item.horizon) next.horizon = item.horizon;
  if (item && Array.isArray(item.sourceAwarenessIds)) next.sourceAwarenessIds = item.sourceAwarenessIds.slice();
  return next;
}

function serializeExecutionChoiceBag(raw) {
  const bag = normalizeExecutionChoiceBag(raw);
  return {
    variant: bag.variant || "",
    actVariant: bag.actVariant || "",
    status: bag.status || "",
    sourceSig: bag.sourceSig,
    options: bag.options.map((item) => serializeExecutionChoiceOption(item)),
    selectedId: bag.selectedId,
    selectedIds: Array.isArray(bag.selectedIds) ? bag.selectedIds.slice() : [],
    custom: bag.custom,
    followupQuestion: bag.followupQuestion,
    followupPlaceholder: bag.followupPlaceholder,
    generatedAt: bag.generatedAt,
    deep: normalizeExecDeep(bag.deep),
    noActionCopy: bag.noActionCopy || null,
    leadIn: bag.leadIn || "",
  };
}

function execChoiceCustomId() {
  const api = reviewMergeApi();
  return api.EXEC_CHOICE_CUSTOM_ID || "custom";
}

function execChoiceCustomText() {
  const api = reviewMergeApi();
  return api.EXEC_CHOICE_CUSTOM_TEXT || "我想自己寫";
}

function execChoiceMaxSelected() {
  const api = reviewMergeApi();
  const max = Number(api.EXEC_CHOICE_MAX_SELECTED);
  return Number.isFinite(max) && max > 0 ? max : 3;
}

function usesExecutionChoiceUi(journal) {
  const mode = journal && journal.mode ? journal.mode : state.journalMode;
  if (mode === "quick") return false;
  const bag = normalizeExecutionChoiceBag((journal && journal.executionChoices) || state.executionChoices);
  if (bag.options.length || bag.followupQuestion || bag.selectedIds.length || bag.selectedId || bag.custom || hasMeaningfulExecDeep(bag.deep)) return true;
  const legacy = normalizeExecutionPrompts((journal && journal.executionPrompts) || state.executionPrompts);
  return legacy.length === 0;
}

function hasMeaningfulValue(value) {
  const api = reviewMergeApi();
  if (typeof api.hasMeaningfulValue === "function") return api.hasMeaningfulValue(value);
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (typeof value === "object") return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
  return false;
}

function hasMeaningfulInsight(insight) {
  const api = reviewMergeApi();
  if (typeof api.hasMeaningfulInsight === "function") return api.hasMeaningfulInsight(insight);
  return hasMeaningfulValue(insight);
}

function hasMeaningfulThinkHistory(thinkHistory) {
  const api = reviewMergeApi();
  if (typeof api.hasMeaningfulThinkHistory === "function") return api.hasMeaningfulThinkHistory(thinkHistory);
  return Array.isArray(thinkHistory) && thinkHistory.some((item) => hasMeaningfulValue(item));
}

function pickFilled(older, newer) {
  const api = reviewMergeApi();
  if (typeof api.pickFilled === "function") return api.pickFilled(older, newer);
  if (hasMeaningfulValue(newer)) return newer;
  if (hasMeaningfulValue(older)) return older;
  return newer === undefined ? older : newer;
}

function mergeJournalObjects(older, newer) {
  const api = reviewMergeApi();
  if (typeof api.mergeJournalObjects === "function") return api.mergeJournalObjects(older, newer);
  const a = older && typeof older === "object" ? older : {};
  const b = newer && typeof newer === "object" ? newer : {};
  const next = { ...a };
  Object.keys(b).forEach((key) => {
    next[key] = pickFilled(a[key], b[key]);
  });
  return next;
}

function pickReview(left, right) {
  const api = reviewMergeApi();
  if (typeof api.pickReview === "function") return api.pickReview(left, right);
  if (!left) return right || null;
  if (!right) return left;
  const leftNewer = newerStamp(left, right);
  const newer = leftNewer ? left : right;
  const older = leftNewer ? right : left;
  return {
    ...older,
    ...newer,
    journal: mergeJournalObjects(older.journal, newer.journal),
    gratitude: pickFilled(older.gratitude, newer.gratitude),
    rawText: pickFilled(older.rawText, newer.rawText),
    organize: pickFilled(older.organize, newer.organize),
    completedAt: newer.completedAt || older.completedAt || "",
    selectedQuotes: pickFilled(older.selectedQuotes, newer.selectedQuotes),
    selectedSfm: pickFilled(older.selectedSfm, newer.selectedSfm),
    selectedThinkActions: pickFilled(older.selectedThinkActions, newer.selectedThinkActions),
    selectedPractice: pickFilled(older.selectedPractice, newer.selectedPractice),
    thinkHistory: pickFilled(older.thinkHistory, newer.thinkHistory),
    updatedAt: newer.updatedAt || older.updatedAt,
    userId: newer.userId || older.userId || "",
    date: newer.date || older.date,
  };
}

function mergeItemList(left, right) {
  const map = new Map();
  [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].forEach((item) => {
    if (!item || !item.id) return;
    const current = map.get(item.id);
    if (!current || newerStamp(item, current)) map.set(item.id, item);
  });
  return [...map.values()];
}

function combineCloudBundles(base, incoming) {
  const left = base && typeof base === "object" ? base : {};
  const right = incoming && typeof incoming === "object" ? incoming : {};
  const reviews = { ...(left.reviews && typeof left.reviews === "object" ? left.reviews : {}) };
  Object.entries(right.reviews && typeof right.reviews === "object" ? right.reviews : {}).forEach(([iso, review]) => {
    reviews[iso] = pickReview(reviews[iso], review);
  });
  const rightInsights = Array.isArray(right.insights)
    ? right.insights
    : Array.isArray(right.reports && right.reports.__insights)
      ? right.reports.__insights
      : [];
  const rightManifests = Array.isArray(right.manifests)
    ? right.manifests
    : Array.isArray(right.reports && right.reports.__manifests)
      ? right.reports.__manifests
      : [];
  return {
    reviews,
    tasks: mergeItemList(left.tasks, right.tasks),
    sfm: mergeItemList(left.sfm, right.sfm),
    insights: mergeItemList(left.insights, rightInsights),
    manifests: mergeItemList(left.manifests, rightManifests),
    reports: { ...(left.reports && typeof left.reports === "object" ? left.reports : {}), ...(right.reports && typeof right.reports === "object" ? right.reports : {}) },
    updatedAt: right.updatedAt || left.updatedAt || "",
  };
}

function mergeCloudBundle(cloud) {
  if (!cloud || typeof cloud !== "object") return;
  const incomingReviews = cloud.reviews && typeof cloud.reviews === "object" ? cloud.reviews : {};
  const incomingGuideDates = Object.entries(incomingReviews)
    .filter(([, review]) => historyHasGuideRounds(review))
    .map(([iso, review]) => `${iso}:${historyGuideFromReview(review).rounds.length}`);
  console.log("[history-debug] hydrate incoming dates", Object.keys(incomingReviews));
  console.log("[history-debug] hydrate incoming guide dates", incomingGuideDates);
  const combined = combineCloudBundles(
    {
      reviews: getReviews(),
      tasks: getTasks(),
      sfm: getSfm(),
      insights: getInsights(),
      manifests: getManifests(),
      reports: getStoredReports(),
    },
    cloud
  );
  saveJson(cloudStoreKey("reviews"), combined.reviews, { silent: true });
  const storedGuideDates = Object.entries(combined.reviews || {})
    .filter(([, review]) => historyHasGuideRounds(review))
    .map(([iso, review]) => `${iso}:${historyGuideFromReview(review).rounds.length}`);
  console.log("[history-debug] hydrate stored dates", Object.keys(combined.reviews || {}));
  console.log("[history-debug] hydrate stored guide dates", storedGuideDates);
  saveJson(cloudStoreKey("tasks"), combined.tasks, { silent: true });
  saveJson(cloudStoreKey("sfm"), combined.sfm, { silent: true });
  saveJson(cloudStoreKey("insights"), combined.insights, { silent: true });
  saveJson(cloudStoreKey("manifests"), combined.manifests, { silent: true });
  const reports = { ...(combined.reports || {}) };
  delete reports.__insights;
  delete reports.__manifests;
  saveJson(cloudStoreKey("reports"), { ...getStoredReports(), ...reports }, { silent: true });
}

function refreshCloudViews(options = {}) {
  try {
    const archived = isCurrentJournalArchived();
    const skipForm = !archived && (options.skipForm || (options.quiet && isActivelyEditingJournal()));
    if (!skipForm) {
      loadReviewForDate(currentIso());
    } else {
      applyJournalArchiveLock();
    }
    backfillLibrariesFromReviews();
    updateStats();
    renderInsights();
    renderTasks();
    renderManifests();
    renderHistory();
    if (state.page === "lab") renderInsightLab();
    if (state.page === "report") renderReport();
  } catch (error) {
    console.error("[進行式 ING] 雲端資料畫面重整失敗", error && error.message ? error.message : error);
  }
}

async function waitForAccessToken(timeoutMs = 5000) {
  const started = Date.now();
  let token = currentAccessToken();
  if (token) return token;
  while (Date.now() - started < timeoutMs) {
    await ensureFreshAccessToken();
    token = currentAccessToken();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 160));
  }
  return currentAccessToken();
}

async function pullCloudData(options = {}) {
  if (!state.user) return null;
  if (!options.quiet) setSyncStatus("pulling");
  await waitForAccessToken();
  let cloud = null;
  const readViaApi = async () => {
    const response = await fetch(`${location.origin}/api/sync`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: authHeaders({ "Cache-Control": "no-store" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      console.error("[進行式 ING] /api/sync 讀取失敗", {
        status: response.status,
        code: payload.code,
        error: payload.error,
        reason: payload.reason,
      });
      return null;
    }
    return payload.data || {};
  };
  try {
    cloud = await readViaApi();
  } catch (error) {
    console.error("[進行式 ING] 讀取 /api/sync 失敗", {
      message: error && error.message ? error.message : error,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
    });
  }
  if (!cloud) {
    await ensureFreshAccessToken();
    try {
      cloud = await readViaApi();
    } catch (error) {
      console.error("[進行式 ING] 重試讀取 /api/sync 失敗", error && error.message ? error.message : error);
    }
  }
  if (!cloud) cloud = await loadSupabaseRecords();
  if (cloud) {
    mergeCloudBundle(cloud);
    if (!options.skipViews) refreshCloudViews(options);
    if (!options.quiet && !hasUnsynced() && state.syncKind !== "error") setSyncStatus("saved");
    return cloud;
  }
  if (!options.quiet) setSyncStatus("error", "這次還沒讀到雲端資料。畫面內容已先留在這台裝置。");
  return null;
}

function flushUnsyncedCloud() {
  if (!state.user || state.syncing) return;
  if (hasUnsynced()) {
    pushCloudData().catch((error) => {
      console.error("[進行式 ING] 背景補傳失敗", {
        message: error && error.message ? error.message : error,
        code: error && error.code,
      });
    });
    return;
  }
  pullCloudData({ quiet: true }).catch((error) => {
    console.error("[進行式 ING] 背景讀取失敗", error && error.message ? error.message : error);
  });
}

function startCloudLiveSync() {
  stopCloudLiveSync();
  if (!state.user) return;
  startCloudLiveSync.timer = setInterval(() => {
    if (document.visibilityState !== "visible" || !state.user || state.syncing) return;
    flushUnsyncedCloud();
  }, 30000);
}

function stopCloudLiveSync() {
  clearInterval(startCloudLiveSync.timer);
  startCloudLiveSync.timer = 0;
}

function bindCloudLiveSync() {
  if (bindCloudLiveSync.bound) return;
  bindCloudLiveSync.bound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.user) flushUnsyncedCloud();
    if (document.visibilityState === "hidden" && state.user) {
      try {
        flushJournalAutosave();
        persistJournalQuietly();
      } catch {
        /* ignore */
      }
      if (hasUnsynced()) flushCloudNow({ reason: "hidden" }).catch(() => {});
    }
  });
  window.addEventListener("online", () => {
    if (!state.user) return;
    flushCloudNow({ reason: "online" }).catch((error) => {
      console.error("[進行式 ING] 網路恢復後補傳失敗", {
        message: error && error.message ? error.message : error,
        code: error && error.code,
      });
    });
  });
  window.addEventListener("pagehide", () => {
    try {
      flushJournalAutosave();
      persistJournalQuietly();
    } catch {
      /* ignore */
    }
    if (!state.user || !hasUnsynced() || typeof navigator === "undefined" || !navigator.sendBeacon) return;
    try {
      const bundle = collectCloudBundle();
      const body = JSON.stringify({
        ...bundle,
        email: state.user.email || "",
        access_token: currentAccessToken(),
      });
      navigator.sendBeacon(`${location.origin}/api/sync`, new Blob([body], { type: "application/json" }));
    } catch (error) {
      console.error("[進行式 ING] 離開頁面時補傳失敗", error && error.message ? error.message : error);
    }
  });
}

let cloudAccountSync = null;

async function migrateLocalToCloudIfNeeded({ pulled, cloudHas }) {
  const id = state.user && state.user.id;
  if (!id || !pulled) return false;
  if (readMigrationFlag(id)) return false;
  if (cloudHas) {
    writeMigrationFlag(id);
    return false;
  }
  if (guestDataMayBelongToUser(id)) adoptUserScopedStorage(id);
  await restoreQueueIfLocalEmpty();
  if (!bundleHasMeaningfulData(collectCloudBundle())) {
    writeMigrationFlag(id);
    return false;
  }
  const ok = await flushCloudNow({ reason: "migrate" });
  if (ok) writeMigrationFlag(id);
  return ok;
}

async function syncAccountCloud() {
  if (!state.user) {
    stopCloudLiveSync();
    setSyncStatus("");
    return;
  }
  if (cloudAccountSync) return cloudAccountSync;
  cloudAccountSync = (async () => {
    startCloudLiveSync();
    await waitForAccessToken();
    const cloud = await pullCloudData({ skipViews: true });
    const pulled = cloud != null;
    const cloudHas = pulled && bundleHasMeaningfulData(cloud);
    if (!pulled) await restoreQueueIfLocalEmpty();
    await migrateLocalToCloudIfNeeded({ pulled, cloudHas });
    refreshCloudViews({ skipForm: isActivelyEditingJournal() });
    if (pulled && hasUnsynced() && !isActivelyEditingJournal()) {
      await flushCloudNow({ reason: "login" });
    }
  })();
  try {
    await cloudAccountSync;
  } finally {
    setTimeout(() => {
      cloudAccountSync = null;
    }, 1200);
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
      <p class="auth-hint">Google 登入後，新加入進行式即享 7 天 ING PLUS 完整體驗。</p>
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
  const internal = isInternalMembership(membership);
  const paid = Boolean(membership.paid || membership.isPaid || membership.status === "active");
  const trialActive = !internal && Boolean(membership.plusTrialActive || (!paid && isMembershipLive(membership)));
  const payBtn = internal || paid
    ? `<button class="auth-pay is-paid" type="button" disabled><span>${internal ? "ING PLUS｜內部帳號" : "目前是 ING PLUS"}</span></button>`
    : `<button class="auth-pay" id="btnNewebPay" type="button" data-open-pricing><span>${trialActive ? "查看 PLUS" : "升級 PLUS"}</span></button>`;
  const trialHint = internal
    ? `<p class="auth-hint">ING PLUS｜內部帳號。功能已永久解鎖，無需付款。</p>`
    : paid
    ? `<p class="auth-hint">你正在使用 ING PLUS。隨時可從方案頁查看內容。</p>`
    : trialActive
      ? `<p class="auth-hint">PLUS 體驗中，至 ${escapeHtml(formatTrialDate(membership.trialEndsAt))}${membership.daysLeft != null ? `，還有 ${membership.daysLeft} 天` : ""}。</p>`
      : `<p class="auth-hint">你目前是 ING FREE。過去紀錄都在，可隨時升級 PLUS。</p>`;
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
    try {
      const existing = await supabaseClient.auth.getSession();
      if (!(existing.data && existing.data.session)) {
        await restoreAuthSession(supabaseClient);
      }
    } catch (error) {
      console.warn("[進行式 ING] 還原登入工作階段失敗", error && error.message ? error.message : error);
    }
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      let nextSession = session;
      if (!nextSession && event !== "SIGNED_OUT") {
        nextSession = await restoreAuthSession(supabaseClient);
      }
      const prev = state.user && state.user.id;
      if (nextSession) applySession(nextSession);
      else if (event === "SIGNED_OUT") applySession(null);
      const next = state.user && state.user.id;
      if (prev !== next) {
        renderAuth();
        if (next) syncAccountCloud().catch(() => {});
        else {
          stopCloudLiveSync();
          setSyncStatus("");
        }
      }
      if (next && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        bindAnalytics();
        if (event === "SIGNED_IN") {
          const created = Date.parse(nextSession && nextSession.user && nextSession.user.created_at ? nextSession.user.created_at : "");
          if (Number.isFinite(created) && Date.now() - created < 15 * 60 * 1000) {
            trackProduct("auth_signup_completed", { source: "google" });
          } else {
            trackProduct("login_completed", { source: "google" });
          }
        }
        trackProduct("app_open", { source: "session" });
      }
    });
    return supabaseClient;
  })();
  const client = await supabaseInit;
  supabaseInit = null;
  bindAnalytics();
  return client;
}

const AUTH_SESSION_BACKUP = "nichi-auth-session";

function persistAuthSessionBackup(session) {
  if (!session || !session.access_token) return;
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token || "",
    expires_at: session.expires_at || 0,
    expires_in: session.expires_in || 0,
    token_type: session.token_type || "bearer",
    user: session.user || null,
  });
  try {
    localStorage.setItem(AUTH_SESSION_BACKUP, payload);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(AUTH_SESSION_BACKUP, payload);
  } catch {
    /* ignore */
  }
  if (window.NichiAuthStorage && window.NichiAuthStorage.persistSessionBackup) {
    window.NichiAuthStorage.persistSessionBackup(payload);
  }
}

function clearAuthSessionBackup() {
  try {
    localStorage.removeItem(AUTH_SESSION_BACKUP);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(AUTH_SESSION_BACKUP);
  } catch {
    /* ignore */
  }
  if (window.NichiAuthStorage && window.NichiAuthStorage.clearSessionBackup) {
    window.NichiAuthStorage.clearSessionBackup();
  }
}

function readAuthSessionBackup() {
  const raws = [];
  if (window.NichiAuthStorage && window.NichiAuthStorage.readSessionBackup) {
    raws.push(window.NichiAuthStorage.readSessionBackup());
  }
  try {
    raws.push(localStorage.getItem(AUTH_SESSION_BACKUP));
  } catch {
    /* ignore */
  }
  try {
    raws.push(sessionStorage.getItem(AUTH_SESSION_BACKUP));
  } catch {
    /* ignore */
  }
  try {
    raws.push(localStorage.getItem("nichi-auth"));
  } catch {
    /* ignore */
  }
  for (const raw of raws) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.access_token) return parsed;
      const nested = parsed.currentSession || parsed.session || (parsed.data && parsed.data.session);
      if (nested && nested.access_token) return nested;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function restoreAuthSession(client) {
  const backup = readAuthSessionBackup();
  if (!backup || !backup.access_token) return null;
  if (client && backup.refresh_token && client.auth.setSession) {
    try {
      const { data, error } = await client.auth.setSession({
        access_token: backup.access_token,
        refresh_token: backup.refresh_token,
      });
      if (!error && data && data.session) {
        persistAuthSessionBackup(data.session);
        return data.session;
      }
    } catch (error) {
      console.warn("[進行式 ING] 還原 Supabase session 失敗", error && error.message ? error.message : error);
    }
  }
  return backup.user ? backup : null;
}

function applySession(session) {
  const prevId = state.user && state.user.id ? String(state.user.id) : "";
  if (!session) {
    state.accessToken = "";
    state.user = null;
    if (prevId) clearJournalMemory();
    return;
  }
  const user = session.user;
  state.accessToken = session.access_token || "";
  state.user = user
    ? {
        id: String(user.id),
        email: String(user.email || "").trim(),
        name: String((user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) || user.email || "").trim(),
        picture: String((user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || "").trim(),
      }
    : state.user;
  persistAuthSessionBackup(session);
  const nextId = state.user && state.user.id ? String(state.user.id) : "";
  if (prevId && nextId && prevId !== nextId) clearJournalMemory();
}

async function ensureFreshAccessToken() {
  const client = await getSupabase();
  if (!client) return currentAccessToken();
  let session = null;
  try {
    const current = await client.auth.getSession();
    session = current.data && current.data.session;
    if (!session) session = await restoreAuthSession(client);
    const expiresAt = session && session.expires_at ? Number(session.expires_at) * 1000 : 0;
    if (session && expiresAt && expiresAt < Date.now() + 60 * 1000) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.data && refreshed.data.session) session = refreshed.data.session;
    }
  } catch (error) {
    console.warn("ensureFreshAccessToken failed", error && error.message ? error.message : error);
  }
  if (session) applySession(session);
  else if (!state.accessToken) {
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
  try {
    await syncAccountCloud();
  } catch (error) {
    console.error("[進行式 ING] 登入後讀取雲端紀錄失敗", error && error.message ? error.message : error);
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

function clearJournalMemory() {
  state.organize = null;
  state.rawText = "";
  state.think = { round: 0, max: 5, history: [], current: null };
  state.selectedQuotes = [];
  state.selectedSfm = [];
  state.selectedThinkActions = [];
  state.selectedPractice = [];
  state.gratitude = "";
  state.journalInsight = null;
  state.journalBodyCoach = null;
  state.journalBodyMind = null;
  state.journalInternalTestRuns = [];
  state.journalInternalResetAt = "";
  state.internalModelDebug = { think: null, awareness: null, execution: null };
  state.journalExecFocus = null;
  state.journalAwarenessResult = null;
  state.journalAwarenessV3 = { variant: "awareness-v3", sourceSig: "", items: [], selectedIds: [], generatedAt: "", observationCue: null };
  state.awarenessCueAttemptSig = "";
  state.journalManifestSentence = "";
  state.journalManifestHighlights = {};
  state.manifestPrompts = [];
  state.awareFoldPinned = false;
  state.awarenessPrompts = [];
  state.executionPrompts = [];
  state.deepPrompts = [];
  state.journalMeta = {
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    awarenessQuoteGenCount: 0,
    manifestAi: false,
    manifestAiSig: "",
    manifestPromptsAi: false,
    manifestPromptsSig: "",
    insightSig: "",
    bodyCoachSig: "",
    bodyMindSig: "",
    promptsSig: "",
    promptsAi: false,
    corePromptsSig: "",
    corePromptsAi: false,
  };
}

async function signOutUser() {
  stopCloudLiveSync();
  try {
    flushJournalAutosave();
    persistJournalQuietly();
  } catch {
    /* ignore */
  }
  const client = await getSupabase();
  if (client) await client.auth.signOut();
  clearAuthSessionBackup();
  state.user = null;
  state.accessToken = "";
  state.membership = null;
  clearJournalMemory();
  setSyncStatus("");
  renderAuth();
  loadReviewForDate(currentIso());
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
  if (isInternalMembership(membership)) return true;
  if (membership.paid || membership.isPaid) return true;
  const ends = Date.parse(membership.trialEndsAt || "");
  if (Number.isFinite(ends)) return Date.now() < ends;
  return Boolean(membership.entitled);
}

function accessLockMode() {
  if (readDevPlanOverride()) return "";
  if (!state.user) return "guest";
  if (state.membership == null && !state.authReady) return "pending";
  return "";
}

function isAccessLocked() {
  return Boolean(accessLockMode());
}

function accessLockMessage() {
  return "請先使用 Google 登入。新加入進行式，即享 7 天 ING PLUS 完整體驗。";
}

function entitlementApi() {
  return typeof window !== "undefined" ? window.NichiEntitlement : null;
}

function currentEffectivePlan() {
  const membership = state.membership || {};
  if (isInternalMembership(membership)) return "plus";
  const plan = String(membership.effectivePlan || "").trim().toLowerCase();
  if (plan === "plus" || plan === "free") return plan;
  if (membership.paid || membership.isPaid || membership.plusTrialActive) return "plus";
  if (membership.entitled && isMembershipLive(membership)) return "plus";
  return "free";
}

function isBrowserLocalHost() {
  const api = entitlementApi();
  const host = typeof location !== "undefined" ? String(location.hostname || "") : "";
  if (api && typeof api.isBrowserLocalHost === "function") return api.isBrowserLocalHost(host);
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
}

function readDevPlanOverride() {
  if (!isBrowserLocalHost()) return "";
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("ingResetNotice") === "1") {
      try {
        localStorage.removeItem(plusEndedNoticeKey("dev-preview"));
        if (state.user && state.user.id) localStorage.removeItem(plusEndedNoticeKey(state.user.id));
      } catch {
        /* ignore */
      }
    }
    const raw = String(params.get("ingPlan") || "").trim().toLowerCase();
    if (raw === "free" || raw === "trial" || raw === "plus" || raw === "expired") {
      sessionStorage.setItem("nichi.devPlan", raw);
      return raw;
    }
    if (params.has("ingPlan")) {
      sessionStorage.removeItem("nichi.devPlan");
      return "";
    }
    const stored = String(sessionStorage.getItem("nichi.devPlan") || "").trim().toLowerCase();
    if (stored === "free" || stored === "trial" || stored === "plus" || stored === "expired") return stored;
  } catch {
    return "";
  }
  return "";
}

function membershipFromDevPlan(mode, base) {
  const now = Date.now();
  const prev = base && typeof base === "object" ? base : {};
  if (mode === "free") {
    return {
      ...prev,
      status: "none",
      entitled: false,
      paid: false,
      isPaid: false,
      plan: "free",
      effectivePlan: "free",
      plusTrialActive: false,
      plusTrialUsed: true,
      daysLeft: 0,
      trialEndsAt: "",
      subscriptionStatus: "none",
      isInternal: false,
      accessType: "standard",
    };
  }
  if (mode === "expired") {
    return {
      ...prev,
      status: "expired",
      entitled: false,
      paid: false,
      isPaid: false,
      plan: "free",
      effectivePlan: "free",
      plusTrialActive: false,
      plusTrialUsed: true,
      daysLeft: 0,
      trialEndsAt: new Date(now - 2 * 3600000).toISOString(),
      subscriptionStatus: "expired",
      isInternal: false,
      accessType: "standard",
    };
  }
  if (mode === "trial") {
    return {
      ...prev,
      status: "trialing",
      entitled: true,
      paid: false,
      isPaid: false,
      plan: "free",
      effectivePlan: "plus",
      plusTrialActive: true,
      plusTrialUsed: true,
      daysLeft: 5,
      trialEndsAt: new Date(now + 5 * 86400000).toISOString(),
      subscriptionStatus: "none",
      isInternal: false,
      accessType: "standard",
    };
  }
  if (mode === "plus") {
    return {
      ...prev,
      status: "active",
      entitled: true,
      paid: true,
      isPaid: true,
      plan: "plus",
      effectivePlan: "plus",
      billingInterval: "monthly",
      plusTrialActive: false,
      plusTrialUsed: true,
      daysLeft: null,
      subscriptionStatus: "active",
      isInternal: false,
      accessType: "standard",
    };
  }
  return prev;
}

function applyDevPlanOverrideToState() {
  const mode = readDevPlanOverride();
  if (!mode) return false;
  if (!state.user) state.user = { id: "dev-preview", email: "dev@localhost" };
  state.authReady = true;
  state.membership = membershipFromDevPlan(mode, state.membership);
  return true;
}

function isDevPreviewUser() {
  return Boolean(readDevPlanOverride() && state.user && state.user.id === "dev-preview");
}

function canUsePlusFeature(feature) {
  const api = entitlementApi();
  if (api && typeof api.canUseFeature === "function") {
    return api.canUseFeature(currentEffectivePlan(), feature);
  }
  return currentEffectivePlan() === "plus";
}

function isPlusRequiredError(error) {
  if (!error) return false;
  if (error.code === "plus_required" || error.error === "plus_required") return true;
  return /plus_required|This feature requires ING PLUS/i.test(String(error.message || error || ""));
}

function openPlusUpgradeModal() {
  if (currentEffectivePlan() === "plus") return;
  const modal = document.getElementById("plusUpgradeModal");
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
  trackProduct("plus_offer_viewed", { source: "upgrade_modal" });
}

function closePlusUpgradeModal() {
  const modal = document.getElementById("plusUpgradeModal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    if (modal.open) modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

function ensurePlusFeature(feature, options = {}) {
  if (canUsePlusFeature(feature)) return true;
  if (!options.auto && !options.silent) openPlusUpgradeModal();
  return false;
}

function syncPlanUi() {
  if (state.user && (state.membership || state.authReady)) {
    document.body.dataset.plan = currentEffectivePlan();
  } else {
    delete document.body.dataset.plan;
  }
}

function journalHasPlusContent(data) {
  const journal = data && typeof data === "object" ? data : null;
  if (journal && typeof deepHasContent === "function" && deepHasContent(journal.deep)) return true;
  if (journal && ((journal.awarenessChecks || []).length || (journal.executionChecks || []).length)) return true;
  const insight = state.journalInsight;
  if (insight && insight.guide && Array.isArray(insight.guide.rounds) && insight.guide.rounds.length) return true;
  if (insight && String(insight.conclusion || insight.title || "").trim()) return true;
  if (state.thinkChoices && Array.isArray(state.thinkChoices.options) && state.thinkChoices.options.length) return true;
  if (state.awarenessChoices && Array.isArray(state.awarenessChoices.options) && state.awarenessChoices.options.length) return true;
  if (state.executionChoices && Array.isArray(state.executionChoices.options) && state.executionChoices.options.length) return true;
  if (state.journalBodyCoach && (state.journalBodyCoach.analysis || state.journalBodyCoach.title)) return true;
  if (state.think && Array.isArray(state.think.history) && state.think.history.length) return true;
  return false;
}

function maybeConstrainJournalModeForPlan() {
  if (!state.user || canUsePlusFeature("deep_journal")) return;
  if (state.journalHydrating) return;
  if (state.journalMode === "deep" && !journalHasPlusContent()) {
    applyJournalMode("quick", { silent: true });
  }
}

function plusEndedNoticeKey(userId) {
  const id = String(userId || (state.user && state.user.id) || "").trim();
  return id ? `nichi.u.${id}.plusTrialEndedNotice` : STORAGE_KEYS.plusTrialEndedNotice;
}

function hasDismissedPlusEndedNotice() {
  try {
    return localStorage.getItem(plusEndedNoticeKey()) === "1" || localStorage.getItem(STORAGE_KEYS.plusTrialEndedNotice) === "1";
  } catch {
    return false;
  }
}

function dismissPlusEndedNotice() {
  try {
    localStorage.setItem(plusEndedNoticeKey(), "1");
    localStorage.setItem(STORAGE_KEYS.plusTrialEndedNotice, "1");
  } catch {
    /* ignore quota */
  }
}

function shouldShowPlusEndedNotice(membership = state.membership) {
  if (!state.user || !membership) return false;
  if (isInternalMembership(membership)) return false;
  if (membership.paid || membership.isPaid || membership.status === "active") return false;
  if (membership.plusTrialActive || isMembershipLive(membership)) return false;
  if (!membership.trialEndsAt && membership.subscriptionStatus !== "expired" && membership.status !== "expired") return false;
  return !hasDismissedPlusEndedNotice();
}

function closePlusEndedModal() {
  const modal = document.getElementById("plusEndedModal");
  if (!modal) return;
  if (typeof modal.close === "function" && modal.open) modal.close();
  else modal.removeAttribute("open");
}

function openPlusEndedModal() {
  const modal = document.getElementById("plusEndedModal");
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
  trackProduct("plus_offer_viewed", { source: "trial_ended" });
}

function maybeShowPlusEndedNotice() {
  if (!shouldShowPlusEndedNotice()) return;
  openPlusEndedModal();
}

function applyPaywallFromPayload(response, payload) {
  if (payload && payload.error === "membership_check_failed") return true;
  if (payload && payload.error === "plus_required") {
    openPlusUpgradeModal();
    return true;
  }
  if (!(response && (response.status === 402 || (payload && payload.paywall)))) return false;
  maybeShowPlusEndedNotice();
  return false;
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
  syncPlanUi();
}

function bindSubscribeButton() {
  document.querySelectorAll("[data-newebpay], [data-plan-cta]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", onSubscribeClick);
  });
  const interestCta = document.getElementById("pricingInterestCta");
  if (interestCta && interestCta.dataset.bound !== "1") {
    interestCta.dataset.bound = "1";
    interestCta.addEventListener("click", onPlusInterestClick);
  }
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

function onPlusInterestClick(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const membership = state.membership || {};
  if (isInternalMembership(membership) || membership.paid || membership.isPaid) return;
  trackProduct("plus_interest_clicked", { source: "pricing" });
  showToast("收到 🤍 ING PLUS 正在準備開放，我們會把你的升級意願記錄下來。");
}

function startNewebPay(planId) {
  if (!NEWEBPAY_CHECKOUT_ENABLED) {
    showToast("ING PLUS 方案準備中，新價格尚未開放扣款。");
    return;
  }
  if (!state.user) {
    closePricingModal();
    showToast("請先用 Google 登入。新加入進行式，即享 7 天 ING PLUS 完整體驗。");
    signInWithGoogle();
    return;
  }
  const plan = NEWEBPAY_PLANS[planId] || NEWEBPAY_PLANS.monthly;
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
  if (window.NichiAnalytics) window.NichiAnalytics.trackOnceSession("subscription_page_viewed", { source: "pricing" }, "pricing");
  trackProductOnceSession("plus_plan_viewed", { source: "pricing" }, "plus_plan_viewed");
}

function closePricingModal() {
  const modal = document.getElementById("pricingModal");
  if (!modal) return;
  if (typeof modal.close === "function" && modal.open) modal.close();
  else modal.removeAttribute("open");
}

function syncPricingModal() {
  const membership = state.membership || {};
  const internal = isInternalMembership(membership);
  const paid = Boolean(membership.paid || membership.isPaid || membership.status === "active");
  const loggedIn = Boolean(state.user);
  const trialActive = !internal && Boolean(membership.plusTrialActive || (!paid && isMembershipLive(membership)));
  const freeCta = document.getElementById("pricingFreeCta");
  if (freeCta) {
    freeCta.disabled = true;
    freeCta.textContent = paid || trialActive || internal ? "免費方案" : "目前方案";
  }
  const trialStatus = document.getElementById("plusTrialStatus");
  if (trialStatus) {
    if (internal) {
      trialStatus.hidden = false;
      trialStatus.textContent = "ING PLUS｜內部帳號";
    } else if (trialActive && membership.daysLeft != null) {
      trialStatus.hidden = false;
      trialStatus.textContent = `PLUS 體驗中 · 剩餘 ${membership.daysLeft} 天`;
    } else if (trialActive) {
      trialStatus.hidden = false;
      trialStatus.textContent = "PLUS 體驗中";
    } else {
      trialStatus.hidden = true;
      trialStatus.textContent = "";
    }
  }
  document.querySelectorAll("[data-plan-cta]").forEach((btn) => {
    const plan = btn.dataset.plan;
    if (internal) {
      btn.disabled = true;
      btn.textContent = "內部帳號";
      return;
    }
    if (paid) {
      btn.disabled = true;
      btn.textContent = "目前方案";
      return;
    }
    if (!NEWEBPAY_CHECKOUT_ENABLED) {
      btn.disabled = true;
      btn.textContent = "方案準備中";
      return;
    }
    btn.disabled = false;
    if (!loggedIn) {
      btn.textContent = plan === "yearly" ? "登入並升級 PLUS · 年繳" : "登入並升級 PLUS";
      return;
    }
    if (trialActive) {
      btn.textContent = plan === "yearly" ? "升級 PLUS · 年繳" : "升級 PLUS";
      return;
    }
    btn.textContent = plan === "yearly" ? "升級 PLUS · 年繳" : "升級 PLUS";
  });
  const interestCta = document.getElementById("pricingInterestCta");
  if (interestCta) {
    interestCta.hidden = internal || paid;
    interestCta.disabled = internal || paid;
  }
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
      completedAt: row.completed_at || row.completedAt || "",
      userId: row.user_id || state.user?.id || "",
    };
    const rating = Number(row.historyRating || row.history_rating);
    if (rating >= 1 && rating <= 5) out[iso].historyRating = Math.round(rating);
    const shortTitle = String(row.historyShortTitle || row.history_short_title || "").trim();
    if (shortTitle) out[iso].historyShortTitle = shortTitle;
    const metaRaw = row.historyMeta || row.history_meta;
    if (metaRaw && typeof metaRaw === "object") {
      const important = metaRaw.important === true;
      const updatedAt = String(metaRaw.updatedAt || metaRaw.updated_at || "").trim();
      if (important || updatedAt) out[iso].historyMeta = { important, updatedAt };
    }
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

async function refreshAuth(options = {}) {
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
    const preview = applyDevPlanOverrideToState();
    state.authReady = true;
    renderAuth();
    applyAccessLock();
    trackMembershipSignals(state.membership);
    syncPlanUi();
    syncJournalFooter();
    maybeConstrainJournalModeForPlan();
    if (state.user && !preview) trackProduct("app_open", { source: "auth" });
    maybeShowPlusEndedNotice();
    probeAdminAnalyticsLink();
    syncInsightLabLink();
    if (preview) {
      stopCloudLiveSync();
    } else if (state.user && !options.skipCloud) await syncAccountCloud();
    else if (state.user) startCloudLiveSync();
    else stopCloudLiveSync();
  } catch {
    applyDevPlanOverrideToState();
    state.authReady = true;
    renderAuth();
    applyAccessLock();
    syncInsightLabLink();
  }
}

async function watchPaidUnlock() {
  showToast("付款已送出。正在確認會員狀態…");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 900 : 2000));
    await refreshAuth({ skipCloud: true });
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
    if (auth === "ok") showToast("已登入，7 天 ING PLUS 完整體驗已開始。");
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

function reportHasAiContent(report) {
  if (!report || typeof report !== "object") return false;
  if (String(report.summary || report.analysis || report.reflection || report.title || "").trim()) return true;
  if ((report.highlights || []).length || (report.patterns || []).length || (report.insights || []).length) return true;
  return Boolean(report.source && report.source !== "local");
}

function journalHasBodyRecord(journal) {
  if (!journal || typeof journal !== "object") return false;
  if (Array.isArray(journal.bodyTags) && journal.bodyTags.length) return true;
  if (String(journal.bodyNote || "").trim()) return true;
  const check = journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : {};
  return ["mood", "body", "sleep"].some((key) => {
    const item = check[key];
    if (!item || typeof item !== "object") return false;
    if (Array.isArray(item.flags) && item.flags.length) return true;
    return Boolean(item.none || item.duration || item.other || item.reason);
  });
}

function buildFreeReportSummaryFromReviews(fromIso, toIso) {
  const reviews = getReviews();
  const days = [];
  if (fromIso && toIso && fromIso <= toIso) {
    let cursor = fromIso;
    let guard = 0;
    while (cursor <= toIso && guard < 62) {
      days.push(cursor);
      const [year, month, day] = cursor.split("-").map(Number);
      const next = new Date(Date.UTC(year, month - 1, day + 1));
      cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
      guard += 1;
    }
  }
  let recordedDays = 0;
  let completedDays = 0;
  let thanksItems = 0;
  let moodRecords = 0;
  let bodyRecords = 0;
  const moodCounts = {};
  days.forEach((iso) => {
    const review = reviews[iso];
    if (!review) return;
    const journal = review.journal && typeof review.journal === "object" ? review.journal : {};
    const thanks = thanksItemsFrom(thanksTextFrom(journal)).length;
    const mood = String(journal.mood || "").trim();
    const body = journalHasBodyRecord(journal);
    const hasText = Boolean(String(review.rawText || journal.event || journal.thanksText || "").trim());
    if (!thanks && !mood && !body && !hasText && !review.completedAt) return;
    recordedDays += 1;
    if (reviewIsComplete(review)) completedDays += 1;
    thanksItems += thanks;
    if (mood) {
      moodRecords += 1;
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
    if (body) bodyRecords += 1;
  });
  const topMood = Object.keys(moodCounts).sort((a, b) => moodCounts[b] - moodCounts[a])[0] || "";
  return { recordedDays, completedDays, thanksItems, moodRecords, bodyRecords, topMood };
}

function safeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function renderFreeReportFacts(type, report) {
  const summary = buildFreeReportSummaryFromReviews(report.fromIso, report.toIso);
  const recordedDays = safeCount(summary.recordedDays);
  const completedDays = safeCount(summary.completedDays);
  const thanksItems = safeCount(summary.thanksItems);
  const moodRecords = safeCount(summary.moodRecords);
  const bodyRecords = safeCount(summary.bodyRecords);
  const topMood = String(summary.topMood || "").trim();
  if (type === "month") {
    return `
      <article class="report-card">
        <h3>本月紀錄</h3>
        <p class="report-range">本月已記錄 ${recordedDays} 天</p>
        ${recordedDays ? "" : `<p class="report-empty">這個月還沒有紀錄。寫下第一篇後，這裡會出現本月天數。</p>`}
      </article>
    `;
  }
  return `
    <article class="report-card">
      <h3>本週基礎週報</h3>
      ${
        recordedDays || completedDays || thanksItems || moodRecords || bodyRecords
          ? ""
          : `<p class="report-empty">這個區間還沒有紀錄。寫下第一篇後，這裡會出現本週統計。</p>`
      }
      <div class="stats" style="margin:16px 0 0">
        <article class="stat-card">
          <p class="stat-card__value">${recordedDays}</p>
          <p class="stat-card__label">記錄天數</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${completedDays}</p>
          <p class="stat-card__label">完成復盤</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${thanksItems}</p>
          <p class="stat-card__label">寫下感謝</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${moodRecords}</p>
          <p class="stat-card__label">心情紀錄</p>
        </article>
        <article class="stat-card">
          <p class="stat-card__value">${bodyRecords}</p>
          <p class="stat-card__label">身體覺察</p>
        </article>
        ${
          topMood
            ? `<article class="stat-card">
          <p class="stat-card__value">${escapeHtml(topMood)}</p>
          <p class="stat-card__label">最常選擇的心情</p>
        </article>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderPlusReportLocks(type) {
  const week = type !== "month";
  const items = week
    ? ["這週反覆出現的模式", "情緒與行動之間的關聯", "進行式看見的一個提醒"]
    : ["本月反覆出現的模式", "情緒與行動之間的關聯", "進行式看見的一個提醒"];
  const cta = week ? "解鎖完整週報" : "解鎖完整月報";
  return `
    <article class="report-card report-plus-lock">
      <h3>${week ? "完整週報" : "完整月報"} <span class="plus-lock-badge">PLUS</span></h3>
      <ul class="review-list">
        ${items.map((item) => `<li>✦ ${escapeHtml(item)}</li>`).join("")}
      </ul>
      <button class="btn report-plus-lock__cta" type="button" data-plus-upgrade>${escapeHtml(cta)}</button>
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
  const plusOn = canUsePlusFeature(type === "month" ? "monthly_report_full" : "weekly_report_full");
  const period = local.period || (type === "month" ? local.fromIso.slice(0, 7) : local.fromIso);
  const cachedRaw = readCachedReport(type, period) || readLatestCachedReport(type);
  const cached = reportHasAiContent(cachedRaw) ? cachedRaw : null;
  if (cached) root.innerHTML = renderAiReportBlock(cached);
  else if (!plusOn) root.innerHTML = renderPlusReportLocks(type);
  else root.innerHTML = renderAiReportBlock(null, "loading");

  try {
    let report = await fetchStoredCloudReport(type, period);
    if (!report) report = await fetchStoredCloudReport(type, period, true);
    if (!reportHasAiContent(report) && plusOn && (local.filledDays || local.stats?.totals?.checked)) {
      report = await generateCloudReport(type, local.fromIso, local.toIso, period, { stats: local.stats });
    }
    if (token !== renderReport._token) return;
    if (reportHasAiContent(report)) {
      writeCachedReport(type, report.period || period, report);
      root.innerHTML = renderAiReportBlock(report);
    } else if (!plusOn) {
      root.innerHTML = renderPlusReportLocks(type);
    } else if (!cached) {
      root.innerHTML = renderAiReportBlock("這段期間的復盤還不夠，先寫幾天再回來看綜合報告。", "error");
    }
  } catch (error) {
    if (token !== renderReport._token) return;
    if (isPlusRequiredError(error)) {
      root.innerHTML = cached ? renderAiReportBlock(cached) : renderPlusReportLocks(type);
      return;
    }
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
  if (!state.user || !canUsePlusFeature("monthly_report_full")) return;
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
  const plusOn = canUsePlusFeature(options.type === "month" || report.type === "month" ? "monthly_report_full" : "weekly_report_full");
  const freeFacts = plusOn ? "" : renderFreeReportFacts(options.type || report.type, report);
  const initialAi = reportHasAiContent(cachedAi)
    ? renderAiReportBlock(cachedAi)
    : plusOn
      ? renderAiReportBlock(cachedAi, cachedAi ? undefined : "loading")
      : renderPlusReportLocks(options.type || report.type);
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
    ${freeFacts}
    ${renderChartCard(report.stats, chartPrefix)}
    <div id="${options.aiId || "reportAi"}">${initialAi}</div>
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

const PAGE_HASH = {
  today: "today",
  report: "reports",
  next: "actions",
  sfm: "me",
  manifest: "vision",
  history: "history",
  guide: "guide",
  lab: "lab",
};

const HASH_PAGE = {
  today: "today",
  reports: "report",
  actions: "next",
  me: "sfm",
  vision: "today",
  history: "history",
  guide: "guide",
  lab: "lab",
};

function historyDetailIso(value) {
  const iso = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

function parseAppHash() {
  const raw = String(location.hash || "").replace(/^#/, "").trim();
  const detail = raw.match(/^history\/(\d{4}-\d{2}-\d{2})$/);
  if (detail) return { page: "history", date: detail[1] };
  if (HASH_PAGE[raw]) return { page: HASH_PAGE[raw], date: "" };
  return { page: "", date: "" };
}

function hashForPage(page, date) {
  if (page === "history" && historyDetailIso(date)) return `#history/${historyDetailIso(date)}`;
  return `#${PAGE_HASH[page] || page || "today"}`;
}

function syncAppHash(page, date, options = {}) {
  const next = hashForPage(page, date);
  if (location.hash === next) return;
  const payload = { page, date: historyDetailIso(date) };
  state.historyHashSync = true;
  try {
    if (options.replace) history.replaceState(payload, "", next);
    else history.pushState(payload, "", next);
  } catch {
    location.hash = next;
  }
  state.historyHashSync = false;
}

function historyListViewEl() {
  return document.getElementById("historyListView");
}

function historyDetailViewEl() {
  return document.getElementById("historyDetailView");
}

function showHistoryListView() {
  const list = historyListViewEl();
  const detail = historyDetailViewEl();
  if (list) list.hidden = false;
  if (detail) detail.hidden = true;
}

function showHistoryDetailView() {
  const list = historyListViewEl();
  const detail = historyDetailViewEl();
  if (list) list.hidden = true;
  if (detail) detail.hidden = false;
}

function openHistoryDetail(iso, options = {}) {
  const date = historyDetailIso(iso);
  if (!date) return;
  if (state.page !== "history") {
    switchPage("history", { keepDetail: true, skipHash: true, skipHistoryRender: true });
  }
  if (!options.fromPop && state.historyDetailDate !== date) {
    if (!state.historyDetailDate) state.historyListScroll = captureHistoryScroll();
    syncAppHash("history", date, { replace: Boolean(options.replace) });
  }
  state.historyDetailDate = date;
  state.historyOpen = date;
  showHistoryDetailView();
  renderHistoryDetail(date);
  if (!options.keepScroll) {
    const view = document.getElementById("view");
    if (view) view.scrollTop = 0;
    if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
  }
}

function closeHistoryDetail(options = {}) {
  const hadDetail = Boolean(state.historyDetailDate);
  const listScroll = state.historyListScroll;
  state.historyDetailDate = "";
  state.historyOpen = "";
  showHistoryListView();
  if (state.page !== "history") {
    switchPage("history", { keepDetail: true, skipHash: true, skipHistoryRender: true });
  }
  if (!options.skipRender) renderHistory({ scroll: listScroll });
  if (hadDetail && !options.fromPop) syncAppHash("history", "", { replace: Boolean(options.replace) });
  restoreHistoryScroll(listScroll);
}

function backToHistoryList() {
  const loc = parseAppHash();
  if (loc.date && history.state && history.state.date === loc.date) {
    history.back();
    return;
  }
  closeHistoryDetail({ replace: true });
}

function applyAppLocation() {
  if (state.historyHashSync) return;
  const raw = String(location.hash || "").replace(/^#/, "").trim();
  if (raw === "vision") {
    switchPage("today", { replaceHash: true });
    return;
  }
  const loc = parseAppHash();
  if (!loc.page) return;
  if (loc.page === "history" && loc.date) {
    if (state.page === "history" && state.historyDetailDate === loc.date) return;
    openHistoryDetail(loc.date, { fromPop: true });
    return;
  }
  if (state.historyDetailDate && loc.page === "history") {
    closeHistoryDetail({ fromPop: true });
    return;
  }
  if (loc.page === "history" && state.page === "history" && !state.historyDetailDate) return;
  if (loc.page !== state.page) switchPage(loc.page, { skipHash: true });
}

function switchPage(page, options = {}) {
  if (!page) return;
  if (page === "manifest") page = "today";
  if (page === "lab" && !isInternalMembership()) page = "today";
  if (page !== "history" || !options.keepDetail) {
    state.historyDetailDate = "";
    state.historyOpen = "";
    showHistoryListView();
  }
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
  if (page === "report") {
    renderReport();
    if (window.NichiAnalytics) {
      window.NichiAnalytics.trackOnceSession(
        state.reportType === "month" ? "monthly_report_viewed" : "weekly_report_viewed",
        { type: state.reportType === "month" ? "month" : "week", source: "nav" },
        `report:${state.reportType}`
      );
    }
  }
  if (page === "next") renderInsights();
  if (page === "sfm") renderTasks();
  if (page === "manifest") renderManifests();
  if (page === "history") {
    if (options.keepDetail && state.historyDetailDate) {
      if (!options.skipHistoryRender) renderHistoryDetail(state.historyDetailDate);
    } else if (!options.skipHistoryRender) {
      renderHistory();
    }
    if (window.NichiAnalytics) window.NichiAnalytics.trackOnceSession("history_viewed", { source: "nav" }, "history");
  }
  if (page === "lab") renderInsightLab();
  if (!options.skipHash) {
    syncAppHash(page, page === "history" ? state.historyDetailDate : "", { replace: Boolean(options.replaceHash) });
  }
  if (typeof dismissUserMarkUi === "function") dismissUserMarkUi("cancel");
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
    setJournalFoldOpen(step.element.slice(1), true, { persist: false, pin: false, manual: true });
  }
}

function tourSteps() {
  return [
    {
      popover: {
        title: "歡迎來到日精進",
        description: "這是一份互動式導覽。接下來會帶你走過日期切換、01 到 06 的復盤與洞察，再到側邊欄各頁。完整文字手冊在「使用說明」。隨時可以按「略過導覽」。",
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
        description: "寫下今天真正被碰到的事，再點選心情。這會成為後面覺察選項與思考的原料。",
        side: "bottom",
      },
    },
    {
      element: "#section-body",
      tourPage: "today",
      popover: {
        title: "03 身心覺察",
        description: "用心情、身體、睡眠三個檢核看今天的狀態。看完後，右側會整理今日身心小結，給你今晚就能照顧自己的小建議。",
        side: "bottom",
      },
    },
    {
      element: "#section-deep",
      tourPage: "today",
      popover: {
        title: "04 深度思考",
        description: "寫完感謝、事件與身體後，點開始，會依今天的內容長出幾個「這件事背後代表什麼」的選項。最多勾 2 個，也可以都不勾。",
        side: "top",
      },
    },
    {
      element: "#section-aware",
      tourPage: "today",
      popover: {
        title: "05 覺察力",
        description: "經過今天的事情與深度思考後，會長出幾個「我看見了自己什麼」的選項。最多勾 2 個，也可以都不勾。",
        side: "top",
      },
    },
    {
      element: "#awareChecks",
      tourPage: "today",
      popover: {
        title: "今日覺察",
        description: "勾選後，這裡會收成「核心覺察」與「我看見了」。不必再回答是／否或打字。",
        side: "top",
      },
    },
    {
      element: "#section-exec",
      tourPage: "today",
      popover: {
        title: "06 執行力",
        description: "既然已經看見了，會整理 3 個明天做得到的小行動。選 1 個，或自己寫，再收下行動卡。",
        side: "top",
      },
    },
    {
      element: "#journalFooter",
      tourPage: "today",
      popover: {
        title: "完成今日復盤",
        description: "寫完、勾完就按這裡。草稿可先儲存；完成後，勾選的覺察與行動會同步到側邊欄。",
        side: "top",
      },
    },
    {
      element: '.side-item[data-page="today"]',
      tourPage: "today",
      tourSidebar: true,
      popover: {
        title: "今日復盤",
        description: "每天從這裡開始。側邊欄這一項會帶你回到剛才走完的 01 到 06。",
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
  document.documentElement.classList.remove("is-booting");
  document.body.classList.remove("is-booting");
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

const AWARENESS_QUESTIONS = [
  { question: "今天寫下的感謝或被對待的小事裡，對你來說，比起收到什麼，「有人有想到我」是不是更容易讓你覺得被放在心上？" },
  { question: "今天身體已經有疲累或睡眠的訊號時，你腦中是不是還是會先出現還沒做完的事？" },
  { question: "今天的心情起伏裡，你是不是比較快注意到別人，而比較慢才注意到自己的需要？" },
];

const CORE_AWARENESS_PROMPT = AWARENESS_QUESTIONS[0];

const CORE_EXECUTION_PROMPT = {
  question: "明天你最想開始的，具體是哪一件事？",
  placeholder: "例如：午餐多加一份青菜／下班後走路10分鐘",
};
const EXECUTION_PROMPT_MIN = 1;
const EXECUTION_PROMPT_MAX = 2;
const EXECUTION_CARD_MIN = 1;
const EXECUTION_CARD_MAX = 3;

function isBloatedExecQuestion(question) {
  const text = String(question || "").trim();
  if (!text) return true;
  if (text.length > 80) return true;
  if ((text.match(/[？?]/g) || []).length > 1) return true;
  return /睡眠只有|\d小時|連續\d|能量從哪裡|先補睡還是|才不會又|待辦清單|突破策略|vs|真因|自我修復|真正卡住|跟自己相處|先從哪一件|深層原因|身體在求救|你已經透支|缺乏自律/.test(text);
}

function executionQuestionFallbacks() {
  return [
    {
      question: "明天你最想開始的，具體是哪一件事？",
      placeholder: "例如：午餐多加一份青菜／下班後走路10分鐘",
    },
    {
      question: "如果明天只能完成一件最重要的事，你最希望完成的是哪一件？",
      placeholder: "例如：先完成報價單第一版／回一封最急的信",
    },
    {
      question: "這件事可以再小一點。你準備什麼時間開始、做到什麼程度就算完成？",
      placeholder: "例如：11:00躺下休息20分鐘／換完衣服後走路10分鐘",
    },
  ];
}

function executionPromptsAreStale(list) {
  const prompts = normalizeExecutionPrompts(list);
  return prompts.length >= EXECUTION_PROMPT_MIN && prompts.some((item) => isBloatedExecQuestion(item.question));
}

function sanitizeGeneratedExecutionPrompts(list) {
  const fallbacks = executionQuestionFallbacks();
  const cleaned = normalizeExecutionPrompts(list).map((item, index) => {
    if (!isBloatedExecQuestion(item.question)) {
      return {
        ...item,
        question: String(item.question || "").trim(),
        parked: false,
      };
    }
    return { ...fallbacks[index] || fallbacks[0], parked: false };
  });
  const next = [];
  const seen = new Set();
  cleaned.forEach((item) => {
    if (!item.question || seen.has(item.question)) return;
    seen.add(item.question);
    next.push(item);
  });
  fallbacks.forEach((item) => {
    if (next.length >= EXECUTION_PROMPT_MIN) return;
    if (seen.has(item.question)) return;
    seen.add(item.question);
    next.push({ ...item, parked: false });
  });
  return next.slice(0, EXECUTION_PROMPT_MAX);
}

function looksLikeAnalysisExecTitle(title) {
  const text = String(title || "").trim();
  if (!text) return true;
  return /vs|VS|真因|卡點|假二選一|自我修復|盲點|真正的原因|突破策略|難長的真實|深層原因|跟自己相處|身體在求救|你已經透支|缺乏自律/.test(text);
}

function firstExecSentence(text, max) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const limit = max || 80;
  const api = textIntegrityApi();
  if (raw.replace(/\s+/g, "").length <= limit && !looksIncompleteAwarenessText(raw)) return raw;
  return typeof api.pickCompleteSentence === "function" ? api.pickCompleteSentence(raw, limit) : "";
}

function softenExecCoachText(text) {
  return String(text || "")
    .replace(/身體在求救/g, "最近休息可能還不夠")
    .replace(/你已經透支/g, "最近可能比較累")
    .replace(/正在燃燒自己/g, "最近可能給自己的事情偏多")
    .replace(/你的身體撐不住了|身體撐不住了/g, "身體可能需要先慢下來")
    .replace(/你缺乏自律/g, "這件事可能還少一個明確的開始點")
    .replace(/你在逃避/g, "這件事可能還太大或太模糊");
}

function shortenExecHow(detail) {
  const text = firstExecSentence(softenExecCoachText(detail), 80);
  if (!text || /真正卡住|深層原因|自我修復|真因|核心卡點|為什麼|才比較容易|先讓身體|替明天保留/.test(text)) {
    return "先做最小的那一格，做完就勾起來。";
  }
  return text;
}

function shortenExecWhy(detail) {
  const text = firstExecSentence(softenExecCoachText(detail), 40);
  if (!text || /真正卡住|深層原因|自我修復|真因|核心卡點/.test(text)) {
    return "先完成會影響其他事情的那一小步。";
  }
  return text;
}

function execFocusWhenFromText(title, detail) {
  const blob = `${title || ""} ${detail || ""}`;
  const hasTomorrow = /明天/.test(blob);
  const hasToday = /今晚|今天|現在|此刻/.test(blob);
  if (hasTomorrow && !hasToday) return "tomorrow";
  if (hasToday && !hasTomorrow) return "today";
  if (hasTomorrow) return "tomorrow";
  return "today";
}

function execFocusHintForWhen(when) {
  return when === "tomorrow"
    ? "明天不用全部做到，先完成這一步就好。"
    : "今天不用全部做到，先完成這一步就好。";
}

function execFocusKicker(when) {
  return when === "tomorrow" ? "明天最重要的一步" : "今天最重要的一步";
}

function isAbstractExecAnswer(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return true;
  const compact = raw.replace(/\s+/g, "");
  if (compact.length < 4) return true;
  if (/^(早點睡|多休息|努力工作|開始運動|吃健康一點|不要拖延|把事情做好|好好休息|多運動|明天休息|明天運動|多吃菜|先完成一件最重要的事|先完成最重要的事情|先完成最重要的事)$/.test(compact)) {
    return true;
  }
  const hasTime = /[0-9０-９]+點|[0-9]{1,2}:[0-9]{2}|今晚|明天|早餐|午餐|晚餐|下班|回家|起床|睡前|洗澡後|換完衣/.test(raw);
  const hasMeasure = /分鐘|小時|一份|一餐|一封|第一版|10分|20分|走路|躺下|青菜/.test(raw);
  if (/最重要的事|早點睡|多休息|努力工作|開始運動|吃健康|不要拖延|把事情做好|好好休息/.test(raw) && !hasTime && !hasMeasure) {
    return true;
  }
  return false;
}

function rewriteGeneratedExecTitle(title, smallestStep, options) {
  const keepFull = Boolean(options && options.keepFull);
  const cleaned = softenExecCoachText(String(title || "").replace(/^[\d.、｜|\-\s]+/, "")).trim();
  const api = textIntegrityApi();
  const pickTitle = (value) => {
    if (!value) return "";
    if (keepFull) return value;
    if (value.replace(/\s+/g, "").length <= 32 && !looksIncompleteAwarenessText(value)) return value;
    return typeof api.pickCompleteSentence === "function" ? api.pickCompleteSentence(value, 32) || (value.replace(/\s+/g, "").length <= 32 ? value : "") : value;
  };
  if (cleaned && !looksLikeAnalysisExecTitle(cleaned)) return pickTitle(cleaned);
  const step = String(smallestStep || "").trim().replace(/[。！？.]+$/g, "");
  if (step && !looksLikeAnalysisExecTitle(step)) return pickTitle(keepFull ? String(smallestStep || "").trim() : step);
  return pickTitle(cleaned);
}

function pickExecItemByTitle(items, title) {
  const list = Array.isArray(items) ? items : [];
  const wanted = String(title || "").trim();
  if (!wanted) return list[0] || null;
  return (
    list.find((item) => item.title === wanted) ||
    list.find((item) => item.title && (wanted.includes(item.title) || item.title.includes(wanted))) ||
    list[0] ||
    null
  );
}

function rewriteGeneratedExecFocus(focus, items, smallestStep, options) {
  const keepFull = Boolean(options && options.keepFull);
  const list = Array.isArray(items) ? items : [];
  const source = focus && typeof focus === "object" ? focus : {};
  const picked = pickExecItemByTitle(list, source.title) || list[0] || null;
  if (!picked) {
    const step = String(smallestStep || "").trim().replace(/[。！？.]+$/g, "");
    const title = rewriteGeneratedExecTitle(source.title || step, smallestStep, { keepFull });
    const when = source.when === "tomorrow" || source.when === "today" ? source.when : execFocusWhenFromText(title, "");
    return {
      title,
      detail: keepFull ? String(source.detail || "").trim() : shortenExecWhy(source.detail),
      when,
      hint: String(source.hint || "").trim() || execFocusHintForWhen(when),
      highlights: source.highlights,
    };
  }
  const when = source.when === "tomorrow" || source.when === "today"
    ? source.when
    : execFocusWhenFromText(picked.title, picked.detail);
  return {
    title: rewriteGeneratedExecTitle(picked.title, smallestStep, { keepFull }),
    detail: keepFull ? String(source.detail || picked.detail || "").trim() : shortenExecWhy(source.detail || picked.detail),
    when,
    hint: String(source.hint || "").trim() || execFocusHintForWhen(when),
    highlights: source.highlights || picked.highlights,
  };
}

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

function dailyManifestUiEnabled() {
  return false;
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
  if (rejectArchivedJournalWrite()) return;
  if (state.journalMode !== "quick" || !["body", "aware", "exec"].includes(key)) return;
  const next = { ...normalizeQuickModules(state.quickModules), [key]: !state.quickModules?.[key] };
  syncQuickModules(next);
  persistJournalQuietly();
  const journal = collectJournal();
  if (next[key]) {
    const sectionId = { body: "section-body", aware: "section-aware", exec: "section-exec" }[key];
    setJournalFoldOpen(sectionId, true, { manual: true });
  } else {
    if (key === "aware") state.awareFoldPinned = false;
    applyJournalFolds();
  }
  if (next.aware || next.exec) maybeAutoGenerateCorePrompts(journal);
  if (next.body) maybeAutoGenerateBodyCoach(journal);
  maybeAutoGenerateInsight(journal);
}

function emptyManifestClose() {
  return { futureVision: "", approachStep: "", manifestationStatement: "", accepted: false, addedToExec: false };
}

function emptyManifestPlan() {
  return { id: "", steps: [] };
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
    bodyMind: emptyBodyMind(),
    awareness: ["", "", ""],
    awarenessChecks: [],
    awarenessCheckItems: [],
    awarenessResult: emptyAwarenessResult(),
    awarenessChoices: emptyChoiceBag(),
    thinkChoices: emptyChoiceBag(),
    executionChoices: emptyExecutionChoiceBag(),
    execution: ["", ""],
    executionChecks: [],
    executionCheckItems: [],
    executionFocus: emptyExecFocus(),
    smallestStep: "",
    mode: state.journalMode === "quick" ? "quick" : "deep",
    deepExpanded: false,
    awarenessAi: false,
    executionAi: false,
    awarenessAiSig: "",
    executionAiSig: "",
    awarenessQuoteGenCount: 0,
    manifest: "",
    manifestThink: ["", ""],
    manifestPrompts: [],
    manifestSentence: "",
    manifestClose: emptyManifestClose(),
    manifestPlan: emptyManifestPlan(),
    manifestChecks: [],
    manifestCheckItems: [],
    manifestAi: false,
    manifestAiSig: "",
    manifestPromptsAi: false,
    manifestPromptsSig: "",
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
    userMarks: { items: [], updatedAt: "" },
    manifestHighlights: {},
    internalTestRuns: [],
    internalResetAt: "",
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
  return {
    round: 0,
    rounds: [],
    summary: "",
    awareness: "",
    selfSeen: "",
    takeaway: "",
    actions: [],
    title: "",
    highlights: {},
    draftAnswer: "",
    direction: "",
    close: { coreConclusion: "", blindSpot: "", improvementDirection: "" },
  };
}

function journalVoiceHintHtml() {
  return `<p class="journal-voice-hint">打字或用麥克風說都可以</p>`;
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

function emptyExecFocus() {
  return { title: "", detail: "", when: "", hint: "" };
}

function emptyBodyCheck() {
  return {
    mood: { flags: [], none: false, reason: "" },
    body: { flags: [], none: false, reason: "", other: "" },
    sleep: { flags: [], none: false, reason: "", duration: "", quality: "", energy: "" },
  };
}

function emptyBodyCoach() {
  return { title: "", analysis: "", notice: "", suggestions: [], sig: "", highlights: {} };
}

function emptyBodyMind() {
  const api = reviewMergeApi();
  if (typeof api.emptyBodyMind === "function") return api.emptyBodyMind();
  return {
    text: "",
    insight: "",
    support: "",
    generatedAt: "",
    sig: "",
    status: "",
    seeType: "",
    evidence: [],
    confidence: "",
  };
}

function normalizeBodyMind(raw) {
  const api = reviewMergeApi();
  if (typeof api.normalizeBodyMind === "function") return api.normalizeBodyMind(raw);
  const src = raw && typeof raw === "object" ? raw : {};
  const status = String(src.status || "").trim().toLowerCase();
  const confidence = String(src.confidence || "").trim().toLowerCase();
  return {
    text: String(src.text || "").replace(/\s+/g, " ").trim(),
    insight: String(src.insight || "").replace(/\s+/g, " ").trim(),
    support: String(src.support || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    generatedAt: String(src.generatedAt || "").trim(),
    sig: String(src.sig || "").trim(),
    status: status === "silence" || status === "observation" ? status : "",
    seeType: String(src.seeType || "").trim(),
    evidence: Array.isArray(src.evidence) ? src.evidence.map((item) => String(item || "").trim()).filter(Boolean) : [],
    confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "",
    internalDebug: src.internalDebug && src.internalDebug.model
      ? { provider: String(src.internalDebug.provider || ""), model: String(src.internalDebug.model || "") }
      : null,
  };
}

function hasBodyMindResult(value) {
  const data = normalizeBodyMind(value);
  return Boolean(data.insight && data.support);
}

function bodyMindTextReady(text) {
  return String(text || "").replace(/\s+/g, "").trim().length >= 6;
}

function collectBodyMindText() {
  return String(document.getElementById("bodyMindText")?.value || "").replace(/\s+/g, " ").trim();
}

function bodyMindSignature(journal) {
  const data = journal || {};
  const mind = normalizeBodyMind(data.bodyMind);
  return [mind.text || data.bodyNote || "", String(data.event || "").trim(), String(data.mood || "").trim()].join("\n");
}

function bodyMindSourceStale(mind, text) {
  const data = normalizeBodyMind(mind);
  if (!hasBodyMindResult(data)) return false;
  const current = String(text != null ? text : collectBodyMindText()).replace(/\s+/g, " ").trim();
  const source = String(data.sig ? String(data.sig).split("\n")[0] : data.text || "").replace(/\s+/g, " ").trim();
  return Boolean(current) && current !== source;
}

function showBodyMindCtaHint(message) {
  const hint = document.getElementById("bodyMindCtaHint");
  if (!hint) return;
  const text = String(message || "").trim();
  hint.textContent = text;
  hint.hidden = !text || isCurrentJournalArchived();
}

function syncBodyMindCta() {
  const btn = document.getElementById("btnBodyMindInsight");
  const ta = document.getElementById("bodyMindText");
  const archived = isCurrentJournalArchived();
  if (ta) ta.readOnly = archived;
  if (!btn) return;
  const text = collectBodyMindText();
  const ready = bodyMindTextReady(text);
  const mind = normalizeBodyMind(state.journalBodyMind);
  const hasResult = hasBodyMindResult(mind);
  const stale = hasResult && bodyMindSourceStale(mind, text);
  const show = !archived && (!hasResult || stale);
  btn.hidden = !show;
  btn.disabled = Boolean(state.bodyMindBusy) || archived || !ready;
  btn.textContent = stale ? "內容有修改，重新看看 →" : "從今天裡，多看見自己一點 →";
  if (!ready) showBodyMindCtaHint("");
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
    thanks: thanksTextFrom(data),
    moodLabel: String(data.mood || "").trim(),
  });
}

function normalizeBodyCoach(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : [])
    .map((item) => {
      if (item && typeof item === "object") {
        const title = String(item.title || item.label || "").trim();
        const detail = String(item.detail || item.body || "").trim();
        if (title && detail) return `${title}。${detail}`;
        return title || detail;
      }
      return String(item || "").trim();
    })
    .filter(Boolean)
    .slice(0, 2);
  let title = String(data.title || data.conclusion || "").trim();
  let analysis = String(data.analysis || data.summary || "").trim();
  const notice = String(data.notice || data.watch || "").trim();
  if (!title && analysis) {
    const match = analysis.match(/^[\s\S]*?[。！？]/);
    title = match ? match[0].trim() : analysis;
    const rest = analysis.slice(title.length).trim();
    if (rest) analysis = rest;
  }
  if (title && analysis.startsWith(title)) {
    analysis = analysis.slice(title.length).replace(/^[。！？\s]+/, "");
  }
  return {
    title,
    analysis,
    notice,
    suggestions,
    sig: String(data.sig || "").trim(),
    highlights: data.highlights && typeof data.highlights === "object" ? data.highlights : {},
  };
}

function normalizeInsightList(raw, max = 4) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function mapInsightQuestionItems(list, prefix) {
  const tag = prefix || "q";
  return (Array.isArray(list) ? list : [])
    .map((item, index) => {
      const title = String((item && item.title) || "").replace(/\s+/g, " ").trim();
      const insight = String((item && item.insight) || "").replace(/\s+/g, " ").trim();
      const question = insight ? String((item && item.question) || "").replace(/\s+/g, " ").trim() : "";
      const fallback = String((item && (item.text || (!insight && item.question))) || "").replace(/\s+/g, " ").trim();
      const text = insight
        ? (question && !insight.includes(question)
            ? `${insight}${/[。！？!?]$/.test(insight) ? " " : "。"}${question}`.replace(/\s+/g, " ").trim()
            : insight)
        : fallback;
      if (!text) return null;
      const out = { id: String((item && item.id) || `${tag}${index + 1}`), text };
      if (title) out.title = title;
      if (insight) out.insight = insight;
      if (question) out.question = question;
      return out;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeThinkGuide(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const rounds = (Array.isArray(data.rounds) ? data.rounds : [])
    .map((item) => {
      const row = item && typeof item === "object" ? item : {};
      const question = String(row.question || "").trim();
      const hint = String(row.hint || "").trim();
      const answer = String(row.answer || "").trim();
      if (!question && !hint && !answer) return null;
      return {
        ...row,
        question,
        hint,
        answer,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
  const roundNum = Number(data.round);
  const round = Number.isFinite(roundNum) ? Math.max(0, Math.min(4, Math.floor(roundNum))) : 0;
  const awareness = String(data.awareness || "").trim();
  const summary = String(data.summary || awareness || "").trim();
  const storedClose = data.close && typeof data.close === "object" ? data.close : {};
  const coreConclusion = String(
    storedClose.coreConclusion || data.coreConclusion || data.stuck || awareness || summary || ""
  ).trim();
  const blindSpot = String(storedClose.blindSpot || data.blindSpot || "").trim();
  const improvementDirection = String(
    storedClose.improvementDirection || data.improvementDirection || data.direction || ""
  ).trim();
  const next = {
    ...data,
    round: round || (summary ? 4 : rounds.length),
    rounds,
    summary,
    awareness: awareness || summary || coreConclusion,
    selfSeen: String(data.selfSeen || data.self || "").trim(),
    takeaway: String(data.takeaway || data.line || "").trim(),
    actions: normalizeInsightList(data.actions, 2),
    title: String(data.title || "").trim(),
    highlights: data.highlights && typeof data.highlights === "object" ? data.highlights : {},
    draftAnswer: String(data.draftAnswer || "").trim(),
    variant: String(data.variant || "").trim(),
    status: String(data.status || "").trim(),
    direction: improvementDirection,
    close: { coreConclusion, blindSpot, improvementDirection },
    coreQuote: String(data.coreQuote || (data.discovery && data.discovery.statement) || "").replace(/\s+/g, " ").trim(),
    questions: mapInsightQuestionItems(data.questions, "q"),
    sourceSig: String(data.sourceSig || "").trim(),
    generatedAt: String(data.generatedAt || "").trim(),
    discovery: data.discovery && typeof data.discovery === "object" ? data.discovery : null,
    knownByUser: Array.isArray(data.knownByUser) ? data.knownByUser : [],
    understand: data.understand && typeof data.understand === "object" ? data.understand : null,
    extension: normalizeReflectionExtension(data.extension),
  };
  delete next.retrieval;
  return next;
}

function isUnderstandGuide(guide) {
  const data = normalizeThinkGuide(guide);
  const bag = data.understand && typeof data.understand === "object" ? data.understand : null;
  if (!bag) return false;
  return Boolean(bag.stage || bag.focus || bag.whyWorthThinking || bag.convergence);
}

function understandIsComplete(guide) {
  const data = normalizeThinkGuide(guide);
  const bag = data.understand && typeof data.understand === "object" ? data.understand : {};
  const stage = String(bag.stage || "").trim();
  if (stage === "asked1" || stage === "asked2") return false;
  return stage === "converged" || stage === "stop";
}

function thinkV2Closed(guide) {
  const data = normalizeThinkGuide(guide);
  if (data.variant !== "think-v2") return false;
  if (data.status === "closed") return true;
  return Boolean(
    data.summary ||
      data.awareness ||
      data.selfSeen ||
      (data.close && data.close.coreConclusion)
  );
}

function thinkGuideDone(guide) {
  const data = normalizeThinkGuide(guide);
  if (data.variant === "reflection-v3") {
    if ((data.status === "empty" || data.status === "silence") && data.sourceSig) return true;
    return Boolean(data.coreQuote || data.status === "understand" || (data.questions && data.questions.length >= 1) || (data.discovery && data.discovery.statement) || isUnderstandGuide(data));
  }
  if (data.variant === "think-v2") return thinkV2Closed(data);
  const answered = data.rounds.filter((item) => item.answer).length >= 3;
  if (!answered) return false;
  return Boolean(data.summary || data.awareness || data.selfSeen || data.takeaway);
}

function normalizeInsight(insight) {
  const data = insight && typeof insight === "object" ? insight : {};
  const psychology = String(data.psychology || data.analysis || data.logic || "").trim();
  const conclusion = String(data.conclusion || data.summary || "").trim();
  const guide = normalizeThinkGuide(data.guide);
  return {
    ...data,
    title: String(data.title || guide.title || "").trim(),
    conclusion: conclusion || psychology || guide.summary,
    psychology: psychology || conclusion || guide.summary,
    reflection: String(data.reflection || data.review || data.critique || "").trim(),
    logic: String(data.logic || "").trim(),
    bodyLink: String(data.bodyLink || "").trim(),
    suggestions: normalizeInsightList(data.suggestions || data.actions || guide.actions, 3),
    takeaways: normalizeInsightList(data.takeaways || data.keyPoints, 4),
    guide,
    analysis: data.analysis,
    summary: data.summary,
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
    journal.bodyMind && journal.bodyMind.text,
    journal.smallestStep,
    ...(journal.awareness || []),
    ...(journal.execution || []),
    ...(journal.manifestThink || []),
    journal.manifest,
    journal.manifestSentence,
  ];
  if (journal.manifestClose && (journal.manifestClose.futureVision || journal.manifestClose.approachStep || journal.manifestClose.manifestationStatement)) return true;
  if (journal.manifestPlan && Array.isArray(journal.manifestPlan.steps) && journal.manifestPlan.steps.some((item) => String(item && item.title || "").trim())) return true;
  if (textBits.some((item) => String(item || "").trim())) return true;
  if (hasMeaningfulChoices(journal.awarenessChoices) || hasMeaningfulChoices(journal.thinkChoices) || hasMeaningfulExecutionChoices(journal.executionChoices)) return true;
  if (deepHasContent(journal.deep) || hasMeaningfulValue(journal.deepPrompts)) return true;
  if (hasMeaningfulInsight(journal.insight)) return true;
  if ((journal.bodyTags || []).length || (journal.awarenessChecks || []).length || (journal.executionChecks || []).length || (journal.manifestChecks || []).length) return true;
  const bodyCheck = journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : {};
  if (["mood", "body", "sleep"].some((key) => (bodyCheck[key] && Array.isArray(bodyCheck[key].flags) && bodyCheck[key].flags.length) || (bodyCheck[key] && bodyCheck[key].none))) return true;
  if (String(journal.bodyCoach?.title || journal.bodyCoach?.analysis || "").trim()) return true;
  if (userMarkBag(journal.userMarks).items.length) return true;
  return hasAwarenessResult(journal.awarenessResult);
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
    journal.bodyMind && journal.bodyMind.text,
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
  if (normalizeChoiceBag(state.awarenessChoices).options.length) return true;
  return awarenessQuizAnsweredCount(answers) >= AWARENESS_QUIZ_COUNT;
}

function executionReady(answers) {
  if (usesExecutionChoiceUi()) {
    return selectedExecutionChoiceActions(state.executionChoices).length > 0;
  }
  const prompts = normalizeExecutionPrompts(state.executionPrompts);
  const list = Array.isArray(answers) ? answers : [];
  if (prompts.length >= EXECUTION_PROMPT_MIN) {
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

function compactAwarenessText(value, max) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const limit = max || 220;
  if (cleaned.replace(/\s+/g, "").length <= limit) return cleaned;
  const api = textIntegrityApi();
  if (typeof api.pickCompleteSentence === "function") return api.pickCompleteSentence(cleaned, limit) || "";
  return "";
}

function compactAwarenessBlock(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function looksIncompleteAwarenessText(text) {
  const api = textIntegrityApi();
  if (typeof api.isCompleteSentence === "function") return !api.isCompleteSentence(text);
  const raw = String(text || "").trim();
  if (!raw) return true;
  if (/[，、；：:\-—–…]$/.test(raw)) return true;
  if (/(的|和|與|以及|還包括|還有|一個|一種|不是|而是|因為|所以|包括|當成了|變成了|開始)$/.test(raw)) return true;
  return false;
}

function retainCompleteGeneratedText(value, opts) {
  const api = textIntegrityApi();
  if (typeof api.retainCompleteText === "function") return api.retainCompleteText(value, opts || {});
  const cleaned = String(value || "").trim();
  return !cleaned || looksIncompleteAwarenessText(cleaned) ? "" : cleaned;
}

function finishAwarenessBlock(value, max) {
  const cleaned = compactAwarenessBlock(value);
  if (!cleaned) return "";
  const limit = max || 280;
  const count = cleaned.replace(/\s+/g, "").length;
  if (count <= limit) return looksIncompleteAwarenessText(cleaned) ? "" : cleaned;
  const api = textIntegrityApi();
  if (typeof api.splitSentences !== "function") return "";
  const kept = [];
  let used = 0;
  api.splitSentences(cleaned).forEach((part) => {
    if (typeof api.isCompleteSentence === "function" && !api.isCompleteSentence(part)) return;
    const add = String(part || "").replace(/\s+/g, "").length;
    if (used && used + add > limit) return;
    if (!used && add > limit) return;
    kept.push(part);
    used += add;
  });
  const cut = kept.join("");
  if (!cut || looksIncompleteAwarenessText(cut)) return "";
  return cut;
}

function zhAwarenessCount(text) {
  return String(text || "").replace(/\s+/g, "").length;
}

function normalizeAwarenessLine(text, opts = {}) {
  const keepSource = Boolean(opts.keepSource);
  const original = String(text || "").replace(/\s+/g, " ").trim().replace(/^["「『]+|[」』"]+$/g, "");
  let line = original;
  if (!line) return "";
  if (looksIncompleteAwarenessText(line)) return keepSource ? original : "";
  line = line.replace(/[。！？]+$/g, "").trim();
  if (!line || looksIncompleteAwarenessText(line)) return keepSource ? original : "";
  if (zhAwarenessCount(line) < 8) return keepSource ? original : "";
  return line;
}

function softenAwarenessClaim(text) {
  return String(text || "")
    .replace(/你就是/g, "你今天好像")
    .replace(/你一直都/g, "你今天可能")
    .replace(/你其實一直/g, "你今天可能")
    .replace(/這代表你/g, "今天看起來你")
    .replace(/代表你/g, "今天看起來你")
    .replace(/你其實只是/g, "你今天好像")
    .replace(/你一定是/g, "你今天可能")
    .replace(/你一直都在透支自己/g, "今天看起來你可能把力氣用得比較滿")
    .replace(/你其實只是渴望被看見/g, "你今天好像特別在意有沒有被放在心上")
    .replace(/宇宙正在提醒你[。.]?/g, "")
    .replace(/你值得被愛[。.]?/g, "")
    .replace(/你需要好好愛自己[。.]?/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isGenericAwarenessQuestion(text) {
  return /今天你學到了什麼|你愛自己嗎|你現在有什麼感覺|你真正的感受是什麼|你有什麼感覺/.test(String(text || ""));
}

function awarenessDayBlob(day) {
  if (!day || typeof day !== "object") return "";
  const result = day.awarenessResult && typeof day.awarenessResult === "object" ? day.awarenessResult : {};
  return [
    day.thanks,
    day.event,
    day.mood,
    day.body,
    day.sleep,
    Array.isArray(day.awarenessAnswers) ? day.awarenessAnswers.join(" ") : "",
    Array.isArray(day.awareness) ? day.awareness.join(" ") : "",
    result.seen,
    result.gap,
  ]
    .map((item) => String(item || ""))
    .join(" ");
}

function awarenessDayHasContent(day) {
  return compactAwarenessText(awarenessDayBlob(day), 400).length >= 8 || Boolean(day && (day.thanks || day.event || day.mood));
}

const AWARENESS_PATTERN_GROUPS = [
  {
    id: "cared",
    label: "被照顧／被放在心上／關係支持",
    all: [/陪伴|陪著|照顧|想到你|想到我|放在心上|撐傘|關心|有人陪|被愛|被看見|有人在|放在心/],
  },
  {
    id: "tired-plan",
    label: "身體能量不足，但仍持續安排任務",
    all: [/累|疲|睡不飽|睡眠不足|精神普通|精神不足|少於5|5–6|5-6/, /待辦|計畫|還沒做|列很多|想完成|安排下一|下一步|明天要/],
  },
  {
    id: "self-last",
    label: "比較晚才注意到自己的需要",
    all: [/自己的需要|沒顧自己|忽略自己|比較慢.*自己|先顧(別|他|她|孩子|工作)|還沒休息/],
  },
];

function matchAwarenessPattern(blob, group) {
  const text = String(blob || "");
  if (!text.trim()) return false;
  const rules = Array.isArray(group.all) ? group.all : [];
  return rules.length > 0 && rules.every((re) => re.test(text));
}

function qualifyAwarenessPatterns(recentDays) {
  const days = (Array.isArray(recentDays) ? recentDays : []).filter(awarenessDayHasContent);
  return AWARENESS_PATTERN_GROUPS.map((group) => {
    const hits = days.filter((day) => matchAwarenessPattern(awarenessDayBlob(day), group));
    return {
      id: group.id,
      label: group.label,
      count: hits.length,
      dates: hits.map((day) => String(day.date || "")).filter(Boolean),
    };
  }).filter((item) => item.count >= 3);
}

function sanitizeAwarenessEcho(echo, recentDays) {
  const days = (Array.isArray(recentDays) ? recentDays : []).filter(awarenessDayHasContent);
  const text = compactAwarenessBlock(softenAwarenessClaim(echo), 120);
  if (!text || days.length < 3) return "";
  const qualified = qualifyAwarenessPatterns(days);
  if (!qualified.length) return "";
  const countMatch = text.match(/(\d+)\s*次/);
  if (countMatch && Number(countMatch[1]) < 3) return "";
  if (countMatch && Number(countMatch[1]) > days.length) return "";
  const invented = (text.match(/\d{4}-\d{2}-\d{2}/g) || []).some((iso) => !days.some((day) => day.date === iso));
  if (invented) return "";
  return text;
}

function emptyAwarenessResult() {
  return { seen: "", gap: "", question: "", line: "", echo: "", generatedAt: "", updatedAt: "", highlights: {} };
}

function isCompactAwarenessResult(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  return Boolean(
    String(nested.line || "").trim() &&
      String(nested.seen || nested.selfSeen || "").trim() &&
      !String(nested.gap || "").trim() &&
      !String(nested.question || "").trim()
  );
}

function compactInnerVoice(value, keepSource) {
  const raw = String(value || "").trim();
  if (!raw || keepSource) return raw;
  const api = textIntegrityApi();
  return typeof api.toInnerVoice === "function" ? api.toInnerVoice(raw) : raw;
}

function normalizeCompactAwarenessResult(raw, opts = {}) {
  const keepSource = Boolean(opts.keepSource);
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  const line = normalizeAwarenessLine(compactInnerVoice(nested.line || nested.core || nested.quote || nested.oneLine || "", keepSource), { keepSource });
  const seen = retainCompleteGeneratedText(compactInnerVoice(nested.seen || nested.note || nested.selfSeen || nested.iSee || "", keepSource), {
    source: "app.normalizeCompactAwarenessResult",
    field: "seen",
  });
  if (!line || !seen || looksIncompleteAwarenessText(seen)) {
    if (keepSource && (String(nested.line || "").trim() || String(nested.seen || "").trim())) {
      return {
        seen: String(nested.seen || nested.selfSeen || "").trim(),
        gap: "",
        question: "",
        line: String(nested.line || "").trim(),
        echo: "",
        generatedAt: String(nested.generatedAt || src.generatedAt || "").trim(),
        updatedAt: String(nested.updatedAt || src.updatedAt || "").trim(),
        highlights: nested.highlights && typeof nested.highlights === "object" ? nested.highlights : src.highlights && typeof src.highlights === "object" ? src.highlights : {},
      };
    }
    return emptyAwarenessResult();
  }
  return {
    seen,
    gap: "",
    question: "",
    line,
    echo: "",
    generatedAt: String(nested.generatedAt || src.generatedAt || "").trim(),
    updatedAt: String(nested.updatedAt || src.updatedAt || "").trim(),
    highlights: {
      seen: Array.isArray(src.highlights?.seen) || Array.isArray(nested.highlights?.seen) ? nested.highlights?.seen || src.highlights?.seen : [],
      gap: [],
      question: [],
      line: Array.isArray(src.highlights?.line) || Array.isArray(nested.highlights?.line) ? nested.highlights?.line || src.highlights?.line : [],
    },
  };
}

function buildCompactAwarenessResult() {
  const labels = selectedChoiceTexts(state.awarenessChoices);
  const line = normalizeAwarenessLine(labels[0] || "") || "我先把今天真正有感的地方留下來";
  const seen = labels.length
    ? `今天真正碰到我的，是「${labels[0]}」這件事。`
    : "今天先把真正有感的地方留下來就好，不必急著下更大的結論。";
  return {
    seen: retainCompleteGeneratedText(seen, { source: "app.buildCompactAwarenessResult", field: "seen" }) || seen,
    gap: "",
    question: "",
    line,
    echo: "",
    highlights: { seen: [], gap: [], question: [], line: [] },
  };
}

function normalizeAwarenessResult(raw, opts = {}) {
  const keepSource = Boolean(opts.keepSource);
  if (isCompactAwarenessResult(raw)) return normalizeCompactAwarenessResult(raw, opts);
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  let seen = softenAwarenessClaim(finishAwarenessBlock(nested.seen || nested.selfSeen || nested.todaySeen || nested.iSee, 280));
  let gap = softenAwarenessClaim(finishAwarenessBlock(nested.gap || nested.overlooked || nested.missed, 320));
  const integrity = textIntegrityApi();
  let question = typeof integrity.finalizeGeneratedQuestion === "function"
    ? integrity.finalizeGeneratedQuestion(
        nested.question || nested.tonight || nested.prompt || nested.eveningQuestion,
        { source: "app.normalizeAwarenessResult", field: "question", max: 160 }
      )
    : compactAwarenessText(nested.question || nested.tonight || nested.prompt || nested.eveningQuestion, 90);
  if (isGenericAwarenessQuestion(question) || looksIncompleteAwarenessText(question)) question = "";
  let line = normalizeAwarenessLine(nested.line || nested.quote || nested.oneLine, { keepSource });
  if (!line && Array.isArray(src.quotes) && src.quotes[0]) line = normalizeAwarenessLine(src.quotes[0], { keepSource });
  const echo = sanitizeAwarenessEcho(nested.echo || nested.weekly || nested.crossDay || nested.pattern, collectRecentAwarenessDays());
  if (echo && gap && !gap.includes(echo)) gap = `${gap}\n\n${echo}`;
  if (!seen || looksIncompleteAwarenessText(seen)) {
    if (keepSource && String(nested.seen || nested.selfSeen || nested.todaySeen || nested.iSee || "").trim()) {
      seen = String(nested.seen || nested.selfSeen || nested.todaySeen || nested.iSee || "").trim();
    } else {
      return emptyAwarenessResult();
    }
  }
  return {
    seen,
    gap,
    question,
    line,
    echo,
    generatedAt: String(nested.generatedAt || src.generatedAt || "").trim(),
    updatedAt: String(nested.updatedAt || src.updatedAt || "").trim(),
    highlights: nested.highlights && typeof nested.highlights === "object" ? nested.highlights : src.highlights && typeof src.highlights === "object" ? src.highlights : {},
  };
}

function stampAwarenessResult(result, prev) {
  const now = new Date().toISOString();
  const current = isCompactAwarenessResult(result) ? normalizeCompactAwarenessResult(result) : normalizeAwarenessResult(result);
  const before = prev && typeof prev === "object" ? prev : {};
  return {
    ...current,
    generatedAt: String(before.generatedAt || current.generatedAt || now).trim() || now,
    updatedAt: now,
  };
}

function hasAwarenessResult(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  return Boolean(String(nested.seen || nested.selfSeen || nested.todaySeen || nested.iSee || "").trim());
}

function awarenessResultKeepText(result) {
  const data = normalizeAwarenessResult(result, { keepSource: true });
  if (data.line && data.line.length >= 8) return data.line;
  const quote = cleanAwarenessQuote(data.seen);
  if (quote.length >= 8) return quote;
  const api = textIntegrityApi();
  if (typeof api.pickCompleteSentence === "function") return api.pickCompleteSentence(data.seen, 28);
  return "";
}

function formatAwarenessResultText(result) {
  const data = normalizeAwarenessResult(result, { keepSource: true });
  if (isCompactAwarenessResult(data)) {
    return [`核心覺察`, data.line, ``, `我看見了`, data.seen].join("\n");
  }
  const parts = [];
  if (data.seen) parts.push(`今天，我看見了自己\n${data.seen}`);
  if (data.gap) parts.push(`我可能忽略的地方\n${data.gap}`);
  if (data.question) parts.push(`今晚留給自己的一個問題\n${data.question}`);
  if (data.line) parts.push(`今日帶走的一句話\n${data.line}`);
  return parts.join("\n\n");
}

function cleanAwarenessQuote(text) {
  const cleaned = firstAwarenessSentence(text)
    .replace(/^["「『]+|[」』"]+$/g, "")
    .replace(/^[\d.、｜|\-\s]+/, "")
    .trim();
  if (!cleaned) return "";
  if (zhAwarenessCount(cleaned) <= 28 && !looksIncompleteAwarenessText(cleaned)) return cleaned;
  const api = textIntegrityApi();
  return typeof api.pickCompleteSentence === "function" ? api.pickCompleteSentence(cleaned, 28) : "";
}

function normalizeAwarenessQuotes(raw, fallback) {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? hasAwarenessResult(raw)
        ? [awarenessResultKeepText(raw)]
        : Array.isArray(raw.quotes)
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
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return hasQuotes ? 1 : 0;
}

function awarenessQuoteGenCount() {
  return normalizeAwarenessQuoteGenCount(
    state.journalMeta.awarenessQuoteGenCount,
    hasAwarenessResult(state.journalAwarenessResult) || collectAwareQuotes().length
  );
}

function awarenessResultStale() {
  const choiceBag = normalizeChoiceBag(state.awarenessChoices);
  const sig = choiceBag.options.length
    ? JSON.stringify({ none: Boolean(choiceBag.none), ids: choiceBag.selectedIds })
    : checklistSignature(collectAwarenessQuizAnswers());
  const hasResult = hasAwarenessResult(state.journalAwarenessResult) || collectAwareQuotes().length;
  return Boolean(hasResult && state.journalMeta.awarenessAiSig && sig && state.journalMeta.awarenessAiSig !== sig);
}

function collectAwareQuotes() {
  const result = normalizeAwarenessResult(state.journalAwarenessResult, { keepSource: true });
  const keep = awarenessResultKeepText(result);
  if (keep && keep.length >= 8) return [keep];
  const fromDom = [...document.querySelectorAll("#awareChecks .aware-result, #awareChecks .aware-quote")]
    .map((el) => String(el.dataset.quote || "").trim())
    .filter(Boolean);
  if (fromDom.length) return normalizeAwarenessQuotes(fromDom);
  const prev = getReview(currentIso())?.journal;
  if (hasAwarenessResult(prev?.awarenessResult)) {
    const saved = awarenessResultKeepText(prev.awarenessResult);
    return saved && saved.length >= 8 ? [saved] : [];
  }
  return normalizeAwarenessQuotes(prev && prev.awarenessCheckItems);
}

function collectAwareQuote() {
  return collectAwareQuotes()[0] || "";
}

function awarenessPromptFallbacks(journal) {
  const eventBit = String(journal?.event || "").replace(/\s+/g, " ").trim().slice(0, 8) || "今天這件事";
  const thanksBit = thanksTextFrom(journal).replace(/\s+/g, " ").trim().slice(0, 8);
  const check = normalizeBodyCheck(journal?.bodyCheck, journal?.bodyTags, journal?.bodyNote);
  const tired =
    (check.body?.flags || []).some((flag) => /疲|累|痠|緊/.test(flag)) ||
    check.sleep?.energy === "疲憊" ||
    check.sleep?.duration === "少於5小時" ||
    check.sleep?.duration === "5–6小時";
  const mood = journal?.mood || "";
  return [
    {
      question: thanksBit
        ? `今天寫下「${thanksBit}」時心裡有溫度。對你來說，「有人把你放在心上」是不是很能影響這一天的心情？`
        : `在「${eventBit}」裡，你特別有感覺的，是不是「有人陪著／想到你」這件事？`,
    },
    {
      question: tired
        ? "今天身體已經有累的訊號，腦中卻還在排下一件事。你是不是常常累了，才想到自己需要休息？"
        : "今天如果狀態已經不太滿，你腦中是不是還是會先出現明天想完成的事？",
    },
    {
      question: mood
        ? `今天的心情是「${mood}」。這份感覺裡，你是不是比較快注意到別人，比較慢才注意到自己？`
        : "今天發生的事情裡，你是不是比較快看見別人，比較慢才看見自己需要什麼？",
    },
  ];
}

function buildAwarenessResult(journal) {
  const answers = (journal.awareness || []).map((item) => normalizeYesNo(item));
  const yesCount = answers.filter((item) => item === "是").length;
  const noCount = answers.filter((item) => item === "否").length;
  const thanks = thanksTextFrom(journal).replace(/\s+/g, " ").trim();
  const event = String(journal.event || "").replace(/\s+/g, " ").trim();
  const check = normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote);
  const tired =
    (check.body?.flags || []).some((flag) => /疲|累|痠|緊/.test(flag)) ||
    check.sleep?.energy === "疲憊" ||
    check.sleep?.duration === "少於5小時" ||
    check.sleep?.duration === "5–6小時";
  const sparse = !thanks && !event;
  const days = collectRecentAwarenessDays();
  const qualified = qualifyAwarenessPatterns(days);
  let seen = "";
  let gap = "";
  let question = "";
  let line = "";
  let echo = "";
  if (qualified[0]) {
    echo = `近 7 天裡，有 ${qualified[0].count} 次出現「${qualified[0].label}」的線索。\n\n看起來這可能是最近值得注意的一個模式，但還只是把這幾天真實寫下的內容放在一起看。`;
  }
  if (noCount >= 3 && yesCount === 0) {
    seen = "今天你對那三個假設都沒有點頭。看起來那些解讀，還不是你現在認得的自己。";
    gap = thanks || event
      ? `你今天留下了${thanks ? "感謝" : ""}${thanks && event ? "與" : ""}${event ? "事件" : ""}。\n\n如果把這些和你選的「否」放在一起看，也許真正的發現還沒被這三題問到。\n\n那可能不是被否定的推論，而是今天實際寫下的那一件小事。`
      : "今天看起來，你比較想先把那些推論放一邊。\n\n這三題的假設你都沒有接受。\n\n也許今晚更適合留一個較小、較安全的觀察，而不是急著替自己下結論。";
    question = thanks || event
      ? "如果先不問對不對，今晚你自己最想承認的一件小事是什麼？"
      : "今晚你最想先放過、不必急著解釋的，是哪一件事？";
    line = "今天你沒有接受那些現成的解讀。";
  } else if (yesCount >= 3) {
    seen = sparse
      ? "今天你點了三次「是」。你自己也覺得，這些反應裡確實有你還沒說出口的部分。"
      : "今天你承認了好幾件自己平常可能會略過的反應。";
    gap = tired
      ? "你今天很容易看見自己的情緒與需求。\n\n但身體同時也有疲累的訊號。\n\n如果把這兩件事放在一起看，你可能還是比較晚才想到要休息。"
      : "今天你已經看見自己了。\n\n那些你點頭的地方，和今晚要怎麼對待自己，中間可能還有一小段距離。\n\n也許真正被略過的，不是發現，而是下一步要不要真的照顧它。";
    question = tired
      ? "如果今晚也把自己放在心上一次，你最想替自己做什麼？"
      : "如果明天只能留下一件你剛點頭承認的事，你會留下哪一件？";
    line = "今天你看見了，平常可能會略過的自己。";
  } else {
    seen = "今天你願意承認的，比較接近你點頭的那一題；那些你說「否」的部分，今天先不當成你的結論。";
    gap = "你選了「否」的那一題，今天看起來還不能當成你的模式。\n\n更值得看的，也許是你願意點頭的地方，以及今天實際寫下的內容。\n\n如果把這兩件事放在一起看，落差可能比被否定的假設更接近你。";
    question = "今晚你更想留下來的，是剛才點頭的那一面，還是你不想被說成那樣的那一面？";
    line = "今天你留下的，是自己點頭的那一面。";
  }
  return normalizeAwarenessResult({ seen, gap, question, line, echo });
}

function buildAwarenessCheckItems(journal) {
  return [awarenessResultKeepText(buildAwarenessResult(journal))].filter(Boolean);
}

function renderLegacyAwareQuote(quote, checked) {
  const kept = (checked || []).map((item) => String(item || "").trim()).includes(quote);
  return `<div class="aware-quote-list aware-quote-list--solo">
          <article class="aware-quote aware-quote--solo" data-quote="${escapeHtml(quote)}">
            <p class="aware-quote__kicker">今日覺察</p>
            ${markableP(quote, "awareness.quote.0", "aware-quote__text")}
            <div class="aware-quote__actions">
              <label class="aware-quote__keep">
                <input type="checkbox" value="${escapeHtml(quote)}" ${kept ? "checked" : ""} />
                <span class="aware-quote__box" aria-hidden="true"></span>
                <span>收藏今天的覺察</span>
              </label>
              <button class="btn btn--ghost btn--tiny" type="button" data-copy-aware-quote>複製</button>
            </div>
          </article>
        </div>`;
}

function awarenessResultSections(result) {
  const data = normalizeAwarenessResult(result, { keepSource: true });
  const sections = [];
  let n = 1;
  const mark = () => `${String(n++).padStart(2, "0")}｜`;
  if (data.seen) sections.push({ kind: "seen", kicker: `${mark()}今天，我看見了自己`, text: data.seen });
  if (data.gap) sections.push({ kind: "gap", kicker: `${mark()}我可能忽略的地方`, text: data.gap });
  if (data.question) sections.push({ kind: "question", kicker: `${mark()}今晚留給自己的一個問題`, text: data.question });
  return { data, sections };
}

function renderAwarenessResultCard(result, checked) {
  const compact = isCompactAwarenessResult(result);
  const data = compact ? normalizeCompactAwarenessResult(result, { keepSource: true }) : normalizeAwarenessResult(result, { keepSource: true });
  const keep = awarenessResultKeepText(data);
  const kept = (checked || []).map((item) => String(item || "").trim()).includes(keep);
  const stale = awarenessResultStale();
  const copyText = formatAwarenessResultText(data);
  const usingChoices = Boolean(normalizeChoiceBag(state.awarenessChoices).options.length);
  const staleHint = usingChoices
    ? "你改了勾選。這份覺察還是依先前的選擇寫的，可以再整理一次。"
    : "你改了是／否。這份覺察還是依先前的答案寫的，可以再整理一次。";
  if (compact && data.line && data.seen) {
    return `<div class="aware-result aware-result--compact${stale ? " is-stale" : ""}" data-quote="${escapeHtml(keep)}" data-copy="${escapeHtml(copyText)}">
      ${userMarkHintHtml()}
      ${stale ? `<p class="aware-result__stale">${escapeHtml(staleHint)}</p>` : ""}
      <div class="aware-core">
        <p class="aware-core__label">核心覺察</p>
        ${markableP(data.line, "awareness.line", "aware-core__quote", "", fieldHighlightsOf(data.highlights, "line"))}
      </div>
      <div class="aware-seen">
        <p class="aware-seen__label">我看見了</p>
        ${markableP(data.seen, "awareness.seen", "aware-seen__text", "", fieldHighlightsOf(data.highlights, "seen"))}
      </div>
      <div class="aware-result__actions">
        <label class="aware-quote__keep">
          <input type="checkbox" value="${escapeHtml(keep)}" ${kept ? "checked" : ""} />
          <span class="aware-quote__box" aria-hidden="true"></span>
          <span>收藏今天的覺察</span>
        </label>
        <button class="btn btn--ghost btn--tiny" type="button" data-copy-aware-quote>複製</button>
      </div>
    </div>`;
  }
  const { sections } = awarenessResultSections(data);
  return `<div class="aware-result${stale ? " is-stale" : ""}" data-quote="${escapeHtml(keep)}" data-copy="${escapeHtml(copyText)}">
      <p class="aware-result__heading">今日覺察</p>
      ${userMarkHintHtml()}
      ${stale ? `<p class="aware-result__stale">${escapeHtml(staleHint)}</p>` : ""}
      ${sections
        .map(
          (item) => `<article class="aware-result__card${item.kind === "question" ? " aware-result__card--question" : ""}${item.kind === "echo" ? " aware-result__card--echo" : ""}">
        <p class="aware-result__kicker">${escapeHtml(item.kicker)}</p>
        ${markableP(item.text, `awareness.${item.kind}`, `aware-result__text${item.kind === "question" ? " aware-result__text--question" : ""}`, "", fieldHighlightsOf(data.highlights, item.kind))}
      </article>`
        )
        .join("")}
      <div class="aware-result__actions">
        <label class="aware-quote__keep">
          <input type="checkbox" value="${escapeHtml(keep)}" ${kept ? "checked" : ""} />
          <span class="aware-quote__box" aria-hidden="true"></span>
          <span>收藏今天的覺察</span>
        </label>
        <button class="btn btn--ghost btn--tiny" type="button" data-copy-aware-quote>複製</button>
      </div>
      ${
        data.line
          ? `<p class="aware-result__line"><span>今日帶走的一句話</span>${markableSpan(data.line, "awareness.line", "", "", fieldHighlightsOf(data.highlights, "line"))}</p>`
          : ""
      }
    </div>`;
}

function renderAwareQuote(items, checked) {
  if (usesAwarenessV3Path()) {
    const root = document.getElementById("awareChecks");
    if (root) {
      root.innerHTML = "";
      root.hidden = true;
    }
    const btn = document.getElementById("btnAwareAi");
    if (btn) btn.hidden = true;
    const hint = document.getElementById("awareQuoteLimitHint");
    if (hint) hint.hidden = true;
    lockNewDayAwareUi();
    return;
  }
  const root = document.getElementById("awareChecks");
  if (!root) return;
  const result = normalizeAwarenessResult(state.journalAwarenessResult, { keepSource: true });
  if (result.seen) {
    root.innerHTML = renderAwarenessResultCard(result, checked);
    syncAwareQuoteGate();
    return;
  }
  const quotes = normalizeAwarenessQuotes(items);
  if (quotes.length) {
    root.innerHTML = renderLegacyAwareQuote(quotes[0], checked);
    syncAwareQuoteGate();
    return;
  }
  const answers = collectAwarenessQuizAnswers();
  const choiceBag = normalizeChoiceBag(state.awarenessChoices);
  const done = awarenessQuizAnsweredCount(answers);
  const ready = choiceBag.options.length > 0 || done >= AWARENESS_QUIZ_COUNT;
  root.innerHTML = `
    <div class="aware-quote-gate${ready ? " is-ready" : ""}">
      <p class="aware-quote__kicker">今日覺察</p>
      <p class="aware-quote-gate__title">${
        choiceBag.options.length
          ? "勾選最貼近的 1～2 句，或選沒有特別符合。然後整理今天看見的自己。"
          : ready
          ? "三個問題都看過了。現在可以把今天看見的自己整理下來。"
          : "產生選項並勾選後，整理今天的覺察。"
      }</p>
      ${choiceBag.options.length ? "" : `<p class="aware-quote-gate__meta">${Math.min(done, AWARENESS_QUIZ_COUNT)} / ${AWARENESS_QUIZ_COUNT}</p>`}
      <p class="aware-quote-gate__hint">沒有標準答案，只要選擇最貼近現在的自己。</p>
    </div>
  `;
  syncAwareQuoteGate();
}

function syncAwareQuoteGate() {
  if (usesAwarenessV3Path()) {
    const btn = document.getElementById("btnAwareAi");
    if (btn) btn.hidden = true;
    const hint = document.getElementById("awareQuoteLimitHint");
    if (hint) hint.hidden = true;
    lockNewDayAwareUi();
    return;
  }
  const btn = document.getElementById("btnAwareAi");
  const hint = document.getElementById("awareQuoteLimitHint");
  if (!btn) return;
  const choiceBag = normalizeChoiceBag(state.awarenessChoices);
  const ready = choiceBag.options.length > 0 || awarenessReady(collectAwarenessQuizAnswers());
  const hasResult = hasAwarenessResult(state.journalAwarenessResult) || Boolean(document.querySelector("#awareChecks .aware-result, #awareChecks .aware-quote"));
  const stale = awarenessResultStale();
  const loading = Boolean(state.checklistBusy.awareness);
  const show = ready && (!hasResult || stale);
  btn.hidden = !(show || loading);
  btn.disabled = !show || loading;
  btn.classList.remove("is-capped");
  btn.classList.toggle("is-busy", loading);
  btn.textContent = loading
    ? "正在為你整理…"
    : stale
      ? "根據你的勾選再整理一次"
      : "✦ 看見今天的覺察";
  if (hint) {
    hint.hidden = !(stale && hasResult && !loading);
    hint.textContent = stale ? "你改了勾選，最終覺察會依新的選擇重新整理。" : "";
  }
}

function buildExecutionCheckItems(journal) {
  const items = [];
  const answers = (journal.execution || []).map((item) => String(item || "").trim()).filter(Boolean);
  const step = String(journal.smallestStep || "").trim();
  if (usesExecutionChoiceUi(journal)) {
    selectedExecutionChoiceActions((journal && journal.executionChoices) || state.executionChoices).forEach((action) => {
      pushUniqueExec(items, action.text, action.detail || "", EXECUTION_CARD_MAX);
    });
    return items.slice(0, EXECUTION_CARD_MAX);
  }
  const blob = `${answers.join("\n")}\n${step}\n${journal.event || ""}`;
  const tired = /很累|好累|疲|睡不飽|精神不佳|事情很多/.test(blob);
  if (/多吃菜|吃.*菜|青菜/.test(blob)) {
    pushUniqueExec(items, "明天其中一餐多一份青菜", "午餐或晚餐任選一餐，多加一道青菜，不需要同時改變其他飲食。", EXECUTION_CARD_MAX);
  }
  if (/休息|躺|放下手機/.test(blob) || (tired && /事情很多|太多/.test(blob) && !items.length)) {
    pushUniqueExec(items, "明天11:00躺下休息20分鐘", "10:50設提醒，11:00放下手機。沒有睡著也沒關係，安靜休息20分鐘就算完成。", EXECUTION_CARD_MAX);
  }
  if (/運動|跑步|健身|走路/.test(blob)) {
    pushUniqueExec(items, "明天下班回家換完衣服後走路10分鐘", "換完衣服就出門走10分鐘，走完就算完成。", EXECUTION_CARD_MAX);
  }
  if (!items.length && step) {
    const api = textIntegrityApi();
    const short = step.replace(/\s+/g, "").length > 32 && typeof api.pickCompleteSentence === "function"
      ? api.pickCompleteSentence(step, 32) || step.replace(/[。！？.]+$/g, "")
      : step.replace(/[。！？.]+$/g, "");
    pushUniqueExec(items, short, "先做到這個最小程度，做完就勾起來。", EXECUTION_CARD_MAX);
  }
  if (!items.length && answers[0]) {
    const api = textIntegrityApi();
    const short = answers[0].replace(/\s+/g, "").length > 32 && typeof api.pickCompleteSentence === "function"
      ? api.pickCompleteSentence(answers[0], 32) || answers[0].replace(/[。！？.]+$/g, "")
      : answers[0].replace(/[。！？.]+$/g, "");
    pushUniqueExec(items, short, "先把這件事縮成可以開始的一小步，做完就勾起來。", EXECUTION_CARD_MAX);
  }
  return items.slice(0, tired ? 1 : EXECUTION_CARD_MAX);
}

function renderExecCheckCard(item, index, done) {
  const prefix = done ? "" : `${String(index + 1).padStart(2, "0")}｜`;
  const lead = flattenExecSentence(item.detail, item);
  const orig = Number.isFinite(item.markIndex) ? item.markIndex : index;
  return `
    <label class="check-line exec-check${done ? " is-done" : ""}" data-title="${escapeHtml(item.title)}" data-detail="${escapeHtml(lead)}" data-highlights="${escapeHtml(highlightsAttr(item.highlights))}">
      <input type="checkbox" value="${escapeHtml(item.title)}" ${done ? "checked" : ""} />
      <span class="exec-check__box" aria-hidden="true"></span>
      <span class="exec-check__body">
        <span class="exec-check__title">${prefix}${markableSpan(item.title, `exec.item.${orig}.title`, "", "", nestedHighlights(item.highlights, "title"))}</span>
        ${lead ? markableSpan(lead, `exec.item.${orig}.detail`, "exec-check__lead", "", nestedHighlights(item.highlights, "detail")) : ""}
      </span>
    </label>
  `;
}

function normalizeExecFocus(raw, items, sources) {
  const list = Array.isArray(items) ? items : [];
  const rawSources = Array.isArray(sources) ? sources : [];
  if (typeof raw === "string") {
    const parts = resolveExecTitleDetail(raw, "", rawSources);
    const picked = pickExecItemByTitle(list, parts.title) || (parts.title ? { title: parts.title, detail: flattenExecSentence(parts.detail) } : null);
    if (!picked || !picked.title) return emptyExecFocus();
    const resolved = resolveExecTitleDetail(picked.title, flattenExecSentence(picked.detail), rawSources);
    const when = execFocusWhenFromText(resolved.title, resolved.detail);
    return { title: resolved.title, detail: resolved.detail, when, hint: execFocusHintForWhen(when), highlights: picked.highlights };
  }
  const data = raw && typeof raw === "object" ? raw : {};
  const picked = pickExecItemByTitle(list, data.title);
  const title = String((picked && picked.title) || data.title || "").trim();
  const detail = flattenExecSentence((picked && picked.detail) || data.detail || data.why || data.reason || "");
  if (!title) return emptyExecFocus();
  const resolved = resolveExecTitleDetail(title, detail, rawSources);
  const when = data.when === "tomorrow" || data.when === "today" ? data.when : execFocusWhenFromText(resolved.title, resolved.detail);
  return {
    title: resolved.title,
    detail: resolved.detail,
    when,
    hint: String(data.hint || "").trim() || execFocusHintForWhen(when),
    highlights: data.highlights || (picked && picked.highlights),
  };
}

function execFocusTitleText(title) {
  const clean = String(title || "").replace(/^[「」]+|[「」]+$/g, "");
  if (!clean) return "";
  return /[。！？.]$/.test(clean) ? clean : `${clean}。`;
}

function renderExecFocus(focus, items) {
  const root = document.getElementById("execFocus");
  if (!root) return;
  if (usesExecutionChoiceUi()) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const data = normalizeExecFocus(focus, items);
  if (!data.title) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const titleText = execFocusTitleText(data.title);
  const kicker = execFocusKicker(data.when);
  const hint = data.hint || execFocusHintForWhen(data.when);
  root.hidden = false;
  root.innerHTML = `
    <p class="exec-focus__kicker">${escapeHtml(kicker)}</p>
    <p class="exec-focus__title">「${markableSpan(titleText, "exec.focus.title", "", "", nestedHighlights(data.highlights, "title"))}」</p>
    ${data.detail ? markableP(data.detail, "exec.focus.detail", "exec-focus__why", "", nestedHighlights(data.highlights, "detail")) : ""}
    <p class="exec-focus__hint">${escapeHtml(hint)}</p>
  `;
}

function renderExecChecklist(items, checked) {
  const root = document.getElementById("execChecks");
  if (!root) return;
  const normalized = normalizeExecCheckItems(items, execRawSourcesFrom({ executionChoices: state.executionChoices }));
  const set = new Set((checked || []).map((item) => (typeof item === "string" ? item : item && item.title)).filter(Boolean));
  const open = [];
  const done = [];
  const isDone = (item) => {
    if (set.has(item.title) || (item.legacyTitle && set.has(item.legacyTitle))) return true;
    const compactTitle = String(item.title || "").replace(/\s+/g, "");
    for (const label of set) {
      const compactLabel = String(label || "").replace(/\s+/g, "");
      if (compactLabel && compactTitle.startsWith(compactLabel) && /(?:[01]?\d|2[0-3])[:：][0-5]\d/.test(item.title) && /\d$/.test(String(label))) return true;
    }
    return false;
  };
  normalized.forEach((item, index) => (isDone(item) ? done : open).push({ ...item, markIndex: index }));
  root.innerHTML = `
    ${normalized.length ? userMarkHintHtml() : ""}
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
  if (rootId === "manifestChecks") {
    renderManifestPaths(items, checked);
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
  const keepAware =
    !options.forceLocal &&
    (options.useSaved || data.awarenessAi) &&
    (hasAwarenessResult(data.awarenessResult) || (data.awarenessCheckItems || []).length);
  const keepExec = !options.forceLocal && (options.useSaved || data.executionAi) && (data.executionCheckItems || []).length;
  const keepManifest = !options.forceLocal && (options.useSaved || data.manifestAi) && (data.manifestCheckItems || []).length;
  const awareItems = keepAware
    ? normalizeAwarenessQuotes(data.awarenessCheckItems).slice(0, AWARENESS_QUOTE_COUNT)
    : [];
  const execItems = keepExec
    ? normalizeExecCheckItems(data.executionCheckItems, execRawSourcesFrom(data)).slice(0, EXECUTION_CARD_MAX)
    : [];
  const manifestItems = keepManifest ? normalizeManifestPathItems(data.manifestCheckItems).slice(0, 5) : [];
  const awareChecked = options.useSaved ? data.awarenessChecks : checkedValues("awareChecks");
  const execChecked = options.useSaved ? data.executionChecks : checkedValues("execChecks");
  const manifestChecked = options.useSaved ? data.manifestChecks : checkedValues("manifestChecks");
  if (!options.skipAware) {
    state.journalAwarenessResult = keepAware
      ? normalizeAwarenessResult(data.awarenessResult || state.journalAwarenessResult, { keepSource: true })
      : emptyAwarenessResult();
    renderChecklist("awareChecks", awareItems, awareChecked);
  }
  if (!options.skipExec) {
    renderChecklist("execChecks", execItems, execChecked);
    renderExecFocus(keepExec ? data.executionFocus || state.journalExecFocus || execItems[0] : emptyExecFocus(), execItems);
  }
  if (!options.skipManifest) {
    renderChecklist("manifestChecks", manifestItems, manifestChecked);
    renderManifestSentence(data.manifestSentence || state.journalManifestSentence, data.manifestHighlights || state.journalManifestHighlights);
    renderJournalManifestResult();
  }
  if (usesAwarenessV3Path()) lockNewDayAwareUi();
}

function scheduleJournalChecklists() {
  if (state.journalHydrating) return;
  syncCorePromptGate();
  clearTimeout(state.journalCheckTimer);
  state.journalCheckTimer = setTimeout(() => {
    const data = collectJournal();
    refreshJournalChecklists(data);
    if (isJournalFoldEditing()) return;
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

function execChoiceItemDetails(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw && raw.items)
      ? raw.items
      : [];
  return list
    .map((item) => {
      if (typeof item === "string") return { title: item.trim(), detail: "" };
      return {
        title: String((item && (item.title || item.label || item.text)) || "").trim(),
        detail: flattenExecSentence(String((item && (item.detail || item.how || item.why)) || "").trim()),
      };
    })
    .filter((item) => item.title || item.detail);
}

function alignExecChoiceCheckItems(remoteRaw, actions) {
  const remote = execChoiceItemDetails(remoteRaw);
  const used = new Set();
  return (Array.isArray(actions) ? actions : [])
    .map((action) => {
      const text = String(action && action.text ? action.text : action || "").trim();
      if (!text) return null;
      let index = remote.findIndex((item, i) => !used.has(i) && item.title === text);
      if (index < 0) index = remote.findIndex((_, i) => !used.has(i));
      if (index >= 0) used.add(index);
      const match = index >= 0 ? remote[index] : null;
      const fromAction = String(action && action.detail ? action.detail : "").trim();
      let detail = fromAction || (match ? String(match.detail || "").trim() : "");
      if (detail === text) detail = "";
      return { title: text, detail };
    })
    .filter(Boolean);
}

function passthroughExecChoiceCheckItems(actions) {
  const items = [];
  (Array.isArray(actions) ? actions : []).forEach((action) => {
    pushUniqueExec(items, action && action.text, action && action.detail, EXECUTION_CARD_MAX);
  });
  return items;
}

function addExecutionCheckItemsToSidebar(items) {
  const iso = currentIso();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const title = String(item && item.title ? item.title : "").trim();
    if (!title) return;
    addTaskFromGuide({
      key: execCheckTaskKey(title, iso),
      label: title,
      detail: item.detail || "",
      source: "今日復盤",
      date: iso,
    });
  });
}

function normalizeAiExecItems(raw, min, max, fallback, smallestStep, options) {
  const keepFull = Boolean(options && options.keepFull);
  const seen = new Set();
  const items = [];
  normalizeExecCheckItems(raw).forEach((item) => {
    const title = rewriteGeneratedExecTitle(item.title, smallestStep, { keepFull });
    if (!title || seen.has(title)) return;
    seen.add(title);
    items.push({ ...item, title, detail: keepFull ? String(item.detail || "").trim() : shortenExecHow(item.detail) });
  });
  if (!items.length) {
    normalizeExecCheckItems(fallback).forEach((item) => {
      if (items.length >= min) return;
      const title = rewriteGeneratedExecTitle(item.title, smallestStep, { keepFull });
      if (!title || seen.has(title)) return;
      seen.add(title);
      items.push({ ...item, title, detail: keepFull ? String(item.detail || "").trim() : shortenExecHow(item.detail) });
    });
  }
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
    return { btn: "btnManifestPaths", loader: "manifestLoading", list: "manifestChecks", idle: "✦ 讓願望靠近現實" };
  }
  if (kind === "awareness") {
    return { btn: "btnAwareAi", loader: "awareLoading", list: "awareChecks", idle: "✦ 看見今天的覺察" };
  }
  return { btn: "btnExecAi", loader: "execLoading", list: "execChecks", idle: "收下我的行動卡" };
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
        : kind === "execution"
          ? "正在整理行動卡…"
          : "正在整理靠近的方向…"
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
      state.journalMeta.awarenessQuoteGenCount = current + 1;
    }
  }
  persistJournalQuietly();
  if (kind === "execution") trackProduct("action_card_created", { source: "checklist", mode: state.journalMode === "quick" ? "quick" : "deep" });
  if (kind === "manifest") trackProduct("manifestation_created", { source: "checklist" });
}

async function generateJournalChecklist(kind, options = {}) {
  if (kind === "execution") setJournalFoldOpen("section-exec", true, { manual: true });
  if (kind === "awareness") pinAwareFold();
  if (kind === "manifest") {
    if (!dailyManifestUiEnabled()) return;
    await generateManifestClose(options);
    return;
  }
  const isAware = kind === "awareness";
  if (recoverStaleBusy(state.checklistBusy[kind], state.checklistBusyAt?.[kind], () => setChecklistLoading(kind, false))) {
    if (!options.auto) showToast(isAware ? "還在為你整理今天的覺察，請稍候。" : "還在為你整理行動卡，請稍候。");
    return;
  }
  const journal = collectJournal();
  const choiceBag = normalizeChoiceBag(state.awarenessChoices);
  const execChoiceBag = normalizeExecutionChoiceBag(state.executionChoices);
  const usingChoices = isAware && choiceBag.options.length > 0;
  const execActions = !isAware && usesExecutionChoiceUi() ? selectedExecutionChoiceActions(execChoiceBag) : [];
  const usingExecChoices = execActions.length > 0;
  const answers = isAware
    ? usingChoices
      ? selectedChoiceTexts(choiceBag)
      : journal.awareness
    : usingExecChoices
      ? execActions.map((item) => item.text)
      : journal.execution;
  const ready = isAware ? (usingChoices || awarenessReady(answers)) : executionReady(answers);
  if (isAware && hasAwarenessResult(state.journalAwarenessResult) && !awarenessResultStale() && !options.force) {
    if (!options.auto) showToast(usingChoices ? "今天的覺察已經整理好了。若你改了勾選，可以再整理一次。" : "今天的覺察已經整理好了。若你改了是／否，可以再整理一次。");
    syncAwareQuoteGate();
    return;
  }
  if (!ready) {
    if (!options.auto) {
      showToast(
        isAware
          ? "先看完覺察選項，再整理今天的覺察。"
          : "先選明天的小行動，再收下行動卡。"
      );
    }
    return;
  }
  if (!ensurePlusFeature(isAware ? "awareness_ai" : "execution_ai", options)) return;
  if (!isAware && usingExecChoices) {
    /* new 06: no follow-up Q&A after a selected action */
  } else if (!isAware && !options.skipFollow) {
    const lastAnswer = [...(answers || [])].reverse().find((item) => String(item || "").trim()) || "";
    const prompts = normalizeExecutionPrompts(state.executionPrompts);
    if (isAbstractExecAnswer(lastAnswer) && prompts.length < EXECUTION_PROMPT_MAX) {
      await generateExecutionFollowup({ fromCards: true });
      return;
    }
  }
  const sig = usingChoices
    ? JSON.stringify({ none: Boolean(choiceBag.none), ids: choiceBag.selectedIds })
    : usingExecChoices
      ? JSON.stringify({ ids: execChoiceBag.selectedIds, custom: execChoiceBag.custom })
    : checklistSignature(answers);
  if (options.auto && state.journalMeta[isAware ? "awarenessAiSig" : "executionAiSig"] === sig) return;

  if (!isAware && usingExecChoices) {
    const items = passthroughExecChoiceCheckItems(execActions);
    if (!items.length) {
      if (!options.auto) showToast("先選明天的小行動，再收下行動卡。");
      return;
    }
    const token = (state.checklistToken[kind] || 0) + 1;
    state.checklistToken[kind] = token;
    setChecklistLoading(kind, true);
    try {
      state.journalExecFocus = rewriteGeneratedExecFocus(items[0], items, journal.smallestStep, { keepFull: true });
      applyGeneratedChecklist(kind, items, sig);
      renderExecFocus(state.journalExecFocus, items);
      addExecutionCheckItemsToSidebar(items);
      showToast(items.length > 1 ? "行動卡已經整理好了。" : "行動卡已經整理好了。");
      if (execChoiceBag.selectedIds.includes(execChoiceCustomId()) && String(execChoiceBag.custom || "").trim()) {
        trackProduct("execution_custom_completed", { source: "checklist", mode: state.journalMode === "quick" ? "quick" : "deep" });
      }
    } finally {
      if (state.checklistToken[kind] === token) setChecklistLoading(kind, false);
    }
    return;
  }

  const token = (state.checklistToken[kind] || 0) + 1;
  state.checklistToken[kind] = token;
  setChecklistLoading(kind, true);
  const watchdog = setTimeout(() => {
    if (state.checklistToken[kind] === token && state.checklistBusy[kind]) {
      setChecklistLoading(kind, false);
      if (!options.auto) showToast("雲端回應太久，已先停下來。請再試一次。");
    }
  }, 32000);

  const fallback = isAware
    ? usingChoices
      ? buildCompactAwarenessResult()
      : buildAwarenessResult(journal)
    : buildExecutionCheckItems(journal);
  const min = isAware ? 1 : usingExecChoices ? Math.max(1, execActions.length) : EXECUTION_CARD_MIN;
  const max = isAware ? 1 : usingExecChoices ? Math.max(1, execActions.length) : EXECUTION_CARD_MAX;

  try {
    if (!state.user) {
      throw new Error("請先登入，才能使用雲端分析。");
    }
    const progress = collectGrowthProgress();
    const reviewPayload = {
      mode: "checklist",
      kind,
      date: currentIso(),
      answers,
      questions: isAware
        ? currentAwarenessQuestions()
        : usingExecChoices
          ? ["使用者已選好明天要先做到的行動"]
          : currentExecutionQuestions(),
      round: isAware ? undefined : usingExecChoices ? 1 : currentExecutionQuestions().length,
      context: {
        thanks: thanksTextFrom(journal),
        thanksText: thanksTextFrom(journal),
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        bodyCheck: journal.bodyCheck,
        awareness: journal.awareness,
        deepNote: normalizeDeep(journal.deep)
          .map((item) => [item.plain, item.deep].filter((bit) => String(bit || "").trim()).join(" "))
          .filter(Boolean)
          .join("／"),
        insight: String(journal.insight?.conclusion || journal.insight?.psychology || journal.insight?.guide?.awareness || ""),
        openActions: getTasks()
          .filter((task) => task.status !== "done")
          .slice(0, 6)
          .map((task) => task.title),
        smallestStep: journal.smallestStep,
        ...priorThinkAwareContext(journal),
      },
      progress: isAware
        ? {
            streak: progress.streak,
            recentReviews: (progress.recentReviews || []).slice(0, 7),
            recentAwarenessDays: (progress.recentAwarenessDays || collectRecentAwarenessDays()).slice(0, 7),
          }
        : undefined,
      text: answers.join("\n"),
      choiceMode: usingChoices || usingExecChoices,
      selected: usingChoices ? selectedChoiceTexts(choiceBag) : usingExecChoices ? execActions.map((item) => item.text) : undefined,
      none: usingChoices ? Boolean(choiceBag.none) : undefined,
    };
    let remote;
    let lastAwareError;
    for (let attempt = 0; attempt < (isAware ? 2 : 1); attempt += 1) {
      try {
        remote = await postReview(reviewPayload);
        lastAwareError = null;
        break;
      } catch (error) {
        lastAwareError = error;
        if (!isAware || attempt === 1) throw error;
      }
    }
    if (!remote && lastAwareError) throw lastAwareError;
    if (state.checklistToken[kind] !== token) return;
    if (isAware) {
      const raw = remote.result || remote;
      const result = usingChoices
        ? normalizeCompactAwarenessResult(raw)
        : hasAwarenessResult(raw)
          ? normalizeAwarenessResult(raw)
          : emptyAwarenessResult();
      if (!result.seen || looksIncompleteAwarenessText(result.seen) || (usingChoices && !result.line)) {
        throw new Error("這次覺察沒有完整生成，請再試一次。");
      }
      state.journalAwarenessResult = stampAwarenessResult(result, state.journalAwarenessResult);
      applyGeneratedChecklist(kind, [awarenessResultKeepText(state.journalAwarenessResult)], sig);
      pinAwareFold();
      showToast("今天的覺察，已經整理好了。");
      return;
    }
    const items = usingExecChoices
      ? alignExecChoiceCheckItems(remote.items, execActions)
      : normalizeAiExecItems(remote.items, min, max, fallback, journal.smallestStep, { keepFull: false });
    if (items.length < min) throw new Error("雲端回傳格式不完整");
    state.journalExecFocus = rewriteGeneratedExecFocus(remote.focus, items, journal.smallestStep, { keepFull: usingExecChoices });
    applyGeneratedChecklist(kind, items, sig);
    renderExecFocus(state.journalExecFocus, items);
    if (usingExecChoices) addExecutionCheckItemsToSidebar(items);
    showToast(usingExecChoices && items.length > 1 ? "行動卡已經整理好了。" : "行動卡已經整理好了。");
    if (usingExecChoices && execChoiceBag.selectedIds.includes(execChoiceCustomId()) && String(execChoiceBag.custom || "").trim()) {
      trackProduct("execution_custom_completed", { source: "checklist", mode: state.journalMode === "quick" ? "quick" : "deep" });
    }
  } catch (error) {
    if (state.checklistToken[kind] !== token) return;
    if (isPlusRequiredError(error)) return;
    if (isAware) {
      const previous = hasAwarenessResult(state.journalAwarenessResult)
        ? normalizeAwarenessResult(state.journalAwarenessResult, { keepSource: true })
        : emptyAwarenessResult();
      if (previous.seen && !looksIncompleteAwarenessText(previous.seen)) {
        renderAwareQuote([awarenessResultKeepText(previous)], journal.awarenessChecks);
      }
      showToast("這次覺察沒有完整生成，請再試一次。");
      return;
    }
    const localItems = usingExecChoices ? alignExecChoiceCheckItems(fallback, execActions) : fallback.slice(0, max);
    state.journalExecFocus = rewriteGeneratedExecFocus(localItems[0], localItems, journal.smallestStep, { keepFull: usingExecChoices });
    renderExecFocus(state.journalExecFocus, localItems);
    applyGeneratedChecklist(kind, localItems, sig);
    if (usingExecChoices) addExecutionCheckItemsToSidebar(localItems);
    showToast(`雲端分析失敗：${formatApiError(error)}，先用本地整理。`);
  } finally {
    clearTimeout(watchdog);
    if (state.checklistToken[kind] === token) setChecklistLoading(kind, false);
  }
}

function localExecutionFollowup(journal) {
  const last = [...(journal.execution || [])].reverse().find((item) => String(item || "").trim()) || "";
  if (/最重要/.test(last)) {
    return {
      question: "如果明天只能完成一件最重要的事，你最希望完成的是哪一件？",
      placeholder: "例如：先完成報價單第一版／回一封最急的信",
    };
  }
  if (/運動|跑步|健身/.test(last)) {
    return {
      question: "明天運動想怎麼開始？在什麼時間、做多久就算完成？",
      placeholder: "例如：下班回家換完衣服後走路10分鐘",
    };
  }
  if (/吃|菜|健康/.test(last)) {
    return {
      question: "明天多吃菜，你想從哪一餐開始？加多少就算完成？",
      placeholder: "例如：午餐或晚餐其中一餐多加一份青菜",
    };
  }
  if (/休息|累|早點睡/.test(last)) {
    return {
      question: "明天你想在哪個時間休息？休息幾分鐘就算完成？",
      placeholder: "例如：11:00放下手機，躺下休息20分鐘",
    };
  }
  return {
    question: "這件事可以再小一點。你準備什麼時間開始、做到什麼程度就算完成？",
    placeholder: "例如：早餐後寫10分鐘／22:30放下手機",
  };
}

async function generateExecutionFollowup(options = {}) {
  setJournalFoldOpen("section-exec", true, { manual: true });
  if (recoverStaleBusy(state.corePromptsBusy, state.corePromptsBusyAt, () => setCorePromptsLoading(false))) {
    if (!options.auto) showToast("還在為你準備下一題，請稍候。");
    return;
  }
  const journal = collectJournal();
  const current = normalizeExecutionPrompts(state.executionPrompts);
  if (current.length >= EXECUTION_PROMPT_MAX) {
    if (options.fromCards) {
      await generateJournalChecklist("execution", { skipFollow: true });
    } else if (!options.auto) {
      showToast("這兩題已經夠用了，可以直接整理行動卡。");
    }
    return;
  }
  const lastAnswer = [...(journal.execution || [])].reverse().find((item) => String(item || "").trim()) || "";
  if (!lastAnswer) {
    if (!options.auto) showToast("先回答這一題，再把它問得更具體。");
    return;
  }
  if (!ensurePlusFeature("execution_ai", options)) return;
  if (!isAbstractExecAnswer(lastAnswer) && !options.force) {
    if (options.fromCards) {
      await generateJournalChecklist("execution", { skipFollow: true });
      return;
    }
    if (!options.auto) showToast("這一步已經夠具體了，可以直接整理行動卡。");
    return;
  }

  const token = (state.corePromptsToken || 0) + 1;
  state.corePromptsToken = token;
  setCorePromptsLoading(true, "execution");
  const fallback = localExecutionFollowup(journal);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const remote = await postReview(
      {
        mode: "prompts",
        variant: "core",
        scope: "execution",
        followup: true,
        step: "follow",
        date: currentIso(),
        answers: journal.execution,
        questions: current.map((item) => item.question),
        text: lastAnswer,
        context: {
          followup: true,
          step: "follow",
          promptKind: "execution",
          scope: "execution",
          thanks: thanksTextFrom(journal),
          thanksText: thanksTextFrom(journal),
          event: journal.event,
          mood: journal.mood,
          bodyTags: journal.bodyTags,
          bodyNote: journal.bodyNote,
          bodyCheck: journal.bodyCheck,
          awareness: journal.awareness,
          smallestStep: journal.smallestStep,
          ...priorThinkAwareContext(journal),
        },
      },
      18000
    );
    if (state.corePromptsToken !== token) return;
    const next = sanitizeGeneratedExecutionPrompts(remote.execution || []).filter(
      (item) => !current.some((entry) => entry.question === item.question)
    )[0] || fallback;
    const answers = collectExecutionAnswers();
    state.executionPrompts = [...current, { ...next, parked: false }].slice(0, EXECUTION_PROMPT_MAX);
    renderExecutionQuestions(state.executionPrompts, { answers });
    persistJournalQuietly();
    showToast("這一步還有點抽象，先把它說具體一點。");
  } catch (error) {
    if (state.corePromptsToken !== token) return;
    if (isPlusRequiredError(error)) return;
    const answers = collectExecutionAnswers();
    state.executionPrompts = [...current, { ...fallback, parked: false }].slice(0, EXECUTION_PROMPT_MAX);
    renderExecutionQuestions(state.executionPrompts, { answers });
    persistJournalQuietly();
    showToast(`下一題還沒好：${formatApiError(error)}，先用本地追問。`);
  } finally {
    if (state.corePromptsToken === token) setCorePromptsLoading(false);
  }
}

function maybeAutoGenerateChecklists(journal) {
  if (state.journalHydrating) return;
  if (state.journalMode === "quick" && !state.quickModules?.aware && !state.quickModules?.exec) return;
}

function manifestReady(journal) {
  return String((journal || collectJournal()).manifest || "").trim().length >= 4;
}

const MANIFEST_KIND_META = {
  start: "今天可以開始的一小步",
  habit: "需要慢慢建立的一個習慣",
  limit: "目前最值得突破的一個限制",
};

const MANIFEST_CLOSE_PROMPTS = [
  { question: "如果這已經成真，那時候的你會是什麼感覺？", placeholder: "那時候的感覺是…" },
  { question: "那個已經做到的你，會怎麼生活／怎麼選擇？", placeholder: "那時候會怎麼過日子…" },
];

function normalizeManifestCloseBag(raw, extras = {}) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    futureVision: String(data.futureVision || extras.futureVision || "").trim(),
    approachStep: String(data.approachStep || extras.approachStep || "").trim(),
    manifestationStatement: String(data.manifestationStatement || extras.manifestationStatement || extras.sentence || "").trim(),
    accepted: Boolean(data.accepted || extras.accepted),
    addedToExec: Boolean(data.addedToExec || extras.addedToExec),
  };
}

function hasManifestCloseContent(close) {
  const data = normalizeManifestCloseBag(close);
  return Boolean(data.futureVision || data.approachStep || data.manifestationStatement);
}

function journalUsesManifestClose(journal) {
  if (hasManifestCloseContent(journal)) return true;
  return hasManifestCloseContent(journal && journal.manifestClose);
}

function emptyManifestPlanStep() {
  return { id: "", title: "", detail: "", completed: false, taskAdded: false };
}

function normalizeManifestPlanStep(raw, index) {
  const data = raw && typeof raw === "object" ? raw : { title: raw };
  const title = String(data.title || data.label || data.text || "").replace(/^\s*\d+\s*[.．、｜|]\s*/, "").trim();
  if (!title) return null;
  return {
    id: String(data.id || "").trim() || uid(),
    title,
    detail: String(data.detail || data.note || data.body || "").trim(),
    completed: Boolean(data.completed || data.done),
    taskAdded: Boolean(data.taskAdded || data.addedToExec),
  };
}

function normalizeManifestPlan(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const steps = (Array.isArray(data.steps) ? data.steps : Array.isArray(data.items) ? data.items : [])
    .map((item, index) => normalizeManifestPlanStep(item, index))
    .filter(Boolean)
    .slice(0, 6);
  const seen = new Set();
  const unique = [];
  steps.forEach((item) => {
    if (seen.has(item.title)) return;
    seen.add(item.title);
    unique.push(item);
  });
  return {
    id: String(data.id || "").trim(),
    steps: unique,
  };
}

function hasManifestPlan(plan) {
  const data = normalizeManifestPlan(plan && plan.steps ? plan : plan && plan.manifestPlan);
  return data.steps.length > 0;
}

function journalUsesManifestPlan(journal) {
  return hasManifestPlan(journal && journal.manifestPlan) || hasManifestPlan(journal);
}

function buildManifestPlanFallback(vision) {
  const text = String(vision || "").trim();
  const bit = text.slice(0, 12) || "這件事";
  const rows = /收入|營收|事業|客戶|成交|產品|方案/.test(text)
    ? [
        { title: "先看清楚現在的收入結構", detail: "整理目前每個服務／產品的客單價、成交數與月營收。" },
        { title: "算出目標需要多少成交", detail: "把目標拆成每月需要的客數、產品數或方案數。" },
        { title: "找出最值得放大的收入來源", detail: "選出目前成交率與利潤較好的 1～2 個主力項目。" },
        { title: "建立固定曝光與成交節奏", detail: "安排每週固定內容、引流與銷售行動。" },
        { title: "每週回看一次數字", detail: "記錄曝光、詢問、成交與營收，再決定下一週調整什麼。" },
      ]
    : [
        { title: `先看清楚「${bit}」現在的真實狀態`, detail: "用一頁寫下現況、已有資源，以及目前最卡住的地方。" },
        { title: "把目標拆成一個可檢查的畫面", detail: "寫下怎樣算靠近了一步，不要只寫「變好」。" },
        { title: "選出這一週最值得先做的一件小事", detail: "只選一件今天或這週做得到的行動，先走出去。" },
        { title: "安排一個固定回看的時間", detail: "每週留 10 分鐘看哪一步有靠近、下一步要改什麼。" },
      ];
  return normalizeManifestPlan({ id: "", steps: rows });
}

function manifestStepTaskKey(planId, stepId, iso) {
  return `manifest:${iso || currentIso()}:${planId || "plan"}:${stepId}`;
}

function manifestStepTaskExists(planId, stepId, iso) {
  const key = manifestStepTaskKey(planId, stepId, iso);
  return getTasks().some((task) => task.sourceKey === key);
}

function hydrateManifestClose(data) {
  const fromNew = normalizeManifestCloseBag(data && data.manifestClose);
  if (hasManifestCloseContent(fromNew) || fromNew.accepted) return fromNew;
  const sentence = String((data && data.manifestSentence) || "").trim();
  const paths = normalizeManifestPathItems(data && data.manifestCheckItems);
  if (!sentence && !paths.length) return emptyManifestClose();
  return normalizeManifestCloseBag({
    futureVision: "",
    approachStep: paths[0] ? paths[0].title : "",
    manifestationStatement: sentence,
    accepted: false,
    addedToExec: false,
  });
}

function manifestApproachTaskKey(title, iso) {
  const heading = String(title || "").trim();
  if (!heading) return "";
  return `manifest-approach:${iso || currentIso()}:${heading}`;
}

function manifestCloseTaskExists(close, iso) {
  const title = String(close && close.approachStep || "").trim();
  if (!title) return false;
  const key = manifestApproachTaskKey(title, iso);
  return getTasks().some((task) => task.sourceKey === key);
}

function buildManifestCloseFallback(journal) {
  const vision = String(journal.manifest || "").trim();
  const feel = String((journal.manifestThink || [])[0] || "").trim();
  const live = String((journal.manifestThink || [])[1] || "").trim();
  const bit = vision.slice(0, 18) || "這件事";
  return normalizeManifestCloseBag({
    futureVision: feel || live
      ? [feel, live].filter(Boolean).join("\n")
      : `我慢慢把「${bit}」變成日常的一部分，不再只是想一想。`,
    approachStep: feel
      ? `今天先把這件事放在心上一次：${feel.replace(/\s+/g, " ").slice(0, 42)}`
      : `今天先花 1 分鐘，寫下「${bit}」對我真正意味著什麼。`,
    manifestationStatement: `我正在慢慢走進一個更靠近「${bit}」的生活。`,
  });
}

function manifestPromptFallbacks(vision) {
  const bit = String(vision || "").trim().slice(0, 10) || "這件事";
  return [
    {
      question: `如果「${bit}」已經成真，你最希望生活中的哪一件事先改變？`,
      placeholder: "生活裡會先不一樣的是…",
    },
    {
      question: "那個已經做到的你，現在最不一樣的可能是什麼？",
      placeholder: "做事方式或狀態會不同的是…",
    },
  ];
}

function normalizeManifestPrompts(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const question = String(item?.question || item?.title || item || "").trim();
      if (!question) return null;
      return {
        question,
        placeholder: String(item?.placeholder || "我想的是…").trim().slice(0, 24) || "我想的是…",
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}

function collectManifestThinkAnswers() {
  const prev = getReview(currentIso())?.journal?.manifestThink || [];
  return [1, 2].map((index) => {
    const el = document.getElementById(`manifestThink${index}`);
    if (el) return String(el.value || "");
    return String(prev[index - 1] || "");
  });
}

function manifestThinkReady(answers) {
  const list = Array.isArray(answers) ? answers : collectManifestThinkAnswers();
  return list.length >= 2 && list.every((item) => String(item || "").trim());
}

function normalizeManifestPathItem(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const title = item.trim();
    return title ? { kind: "", label: "", title, detail: "" } : null;
  }
  if (typeof item !== "object") return null;
  let kind = String(item.kind || "").trim().toLowerCase();
  if (kind === "step" || kind === "today") kind = "start";
  if (kind === "weekly") kind = "habit";
  if (kind === "block") kind = "limit";
  const title = String(item.title || item.label || item.text || "").trim();
  const detail = String(item.detail || item.note || "").trim();
  if (!title) return null;
  return {
    kind: MANIFEST_KIND_META[kind] ? kind : "",
    label: MANIFEST_KIND_META[kind] || "",
    title,
    detail,
    highlights: item.highlights,
  };
}

function normalizeManifestPathItems(list) {
  const items = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const next = normalizeManifestPathItem(item);
    if (!next || seen.has(next.title)) return;
    seen.add(next.title);
    items.push(next);
  });
  return items;
}

function collectManifestPathItems() {
  const cards = [...document.querySelectorAll("#manifestChecks .manifest-path")].map((el) => ({
    kind: String(el.dataset.kind || "").trim(),
    title: String(el.dataset.title || "").trim(),
    detail: String(el.dataset.detail || "").trim(),
    highlights: highlightsFromAttr(el.dataset.highlights),
  })).filter((item) => item.title);
  if (cards.length) return cards;
  return checklistItems("manifestChecks").map((title) => ({ kind: "", title, detail: "" })).filter((item) => item.title);
}

function buildManifestPathItems(journal) {
  const vision = String(journal.manifest || "").trim();
  const short = vision.length > 12 ? `${vision.slice(0, 12)}…` : vision || "這件事";
  const items = [
    { kind: "start", label: MANIFEST_KIND_META.start, title: `寫下「${short}」對你真正意味著什麼，以及下一步想靠近的方向。`, detail: "" },
    { kind: "habit", label: MANIFEST_KIND_META.habit, title: "每週留一次時間，回顧什麼有靠近、什麼只是空想。", detail: "" },
  ];
  if (/錢|收入|客戶|品牌|事業/.test(vision)) {
    items.push({ kind: "limit", label: MANIFEST_KIND_META.limit, title: "確認最容易讓自己停下來的，是方向不清楚、不敢曝光，還是還沒開始。", detail: "" });
  }
  return items.slice(0, 3);
}

function buildManifestSentence(journal) {
  const bit = String(journal.manifest || "").trim().slice(0, 8) || "這件事";
  return `我正在一步一步，讓「${bit}」從心念變成可以靠近的方向。`;
}

function renderManifestQuestions(prompts, options = {}) {
  const pathsBtn = document.getElementById("btnManifestPaths");
  if (pathsBtn) pathsBtn.hidden = true;
  const saved = Array.isArray(options.answers) ? options.answers : collectManifestThinkAnswers();
  ["manifestThink1", "manifestThink2"].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el && saved[index] != null && el.value !== String(saved[index] || "")) el.value = String(saved[index] || "");
  });
  const root = document.getElementById("manifestQuestions");
  if (root) root.hidden = true;
}

function renderManifestPathCard(item, index, done) {
  const orig = Number.isFinite(item.markIndex) ? item.markIndex : index;
  const heading = item.label ? `${String(index + 1).padStart(2, "0")}｜${item.label}` : "";
  return `
    <label class="check-line exec-check manifest-path${done ? " is-done" : ""}" data-kind="${escapeHtml(item.kind || "")}" data-title="${escapeHtml(item.title)}" data-detail="${escapeHtml(item.detail || "")}" data-highlights="${escapeHtml(highlightsAttr(item.highlights))}">
      <input type="checkbox" value="${escapeHtml(item.title)}" ${done ? "checked" : ""} />
      <span class="exec-check__box" aria-hidden="true"></span>
      <span class="exec-check__body">
        ${heading ? `<span class="manifest-path__kicker">${escapeHtml(heading)}</span>` : ""}
        ${markableSpan(item.title, `manifest.path.${orig}.title`, "exec-check__title", "", nestedHighlights(item.highlights, "title"))}
        ${item.detail ? markableSpan(item.detail, `manifest.path.${orig}.detail`, "exec-check__lead", "", nestedHighlights(item.highlights, "detail")) : ""}
      </span>
    </label>
  `;
}

function renderManifestPaths(items, checked) {
  const root = document.getElementById("manifestChecks");
  if (!root) return;
  root.hidden = true;
  const normalized = normalizeManifestPathItems(items);
  if (!normalized.length) {
    root.innerHTML = "";
    return;
  }
  const set = new Set((checked || []).map((item) => (typeof item === "string" ? item : item && item.title)).filter(Boolean));
  const rich = normalized.some((item) => item.kind);
  if (!rich) {
    root.innerHTML = normalized
      .map(
        (item, index) => `
        <label class="check-line">
          <input type="checkbox" value="${escapeHtml(item.title)}" ${set.has(item.title) ? "checked" : ""} />
          ${markableSpan(item.title, `manifest.path.${index}.title`, "")}
        </label>
      `
      )
      .join("");
    return;
  }
  const open = [];
  const done = [];
  normalized.forEach((item, index) => (set.has(item.title) ? done : open).push({ ...item, markIndex: index }));
  root.innerHTML = `
    <div class="exec-check-open">
      ${open.map((item, index) => renderManifestPathCard(item, index, false)).join("")}
    </div>
    ${
      done.length
        ? `<div class="exec-check-done">
            <h4 class="exec-check-done__title">已靠近</h4>
            ${done.map((item, index) => renderManifestPathCard(item, index, true)).join("")}
          </div>`
        : ""
    }
  `;
}

function renderManifestCloseResult(close) {
  const root = document.getElementById("manifestClose");
  if (!root) return;
  const data = normalizeManifestCloseBag(close || state.journalManifestClose);
  if (!hasManifestCloseContent(data)) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const iso = currentIso();
  const added = Boolean(data.addedToExec) || manifestCloseTaskExists(data, iso);
  const highlights = state.journalManifestHighlights || {};
  root.hidden = false;
  root.innerHTML = `
    ${
      data.futureVision
        ? `<article class="manifest-close-block">
            <p class="manifest-close-kicker">我正在靠近的生活</p>
            ${markableP(data.futureVision, "manifest.close.futureVision", "manifest-close-vision")}
          </article>`
        : ""
    }
    ${
      data.approachStep
        ? `<article class="manifest-close-near">
            <p class="journal-label">今天，我可以先靠近一點</p>
            ${markableP(data.approachStep, "manifest.close.approachStep", "manifest-close-step")}
            <button class="manifest-exec-btn${added ? " is-on" : ""}" id="btnManifestToExec" type="button"${added ? " disabled" : ""}>${added ? "✓ 已放進執行力" : "＋ 放進執行力"}</button>
          </article>`
        : ""
    }
    ${
      data.manifestationStatement
        ? `<article class="manifest-close-line">
            <p class="journal-label">我的顯化句</p>
            <p class="manifest-close-quote">「${markableSpan(data.manifestationStatement.replace(/^[「」]+|[「」]+$/g, ""), "manifest.sentence", "", "", fieldHighlightsOf(highlights, "sentence"))}」</p>
            <p class="manifest-close-note">把這句話，留給正在靠近它的自己。</p>
          </article>`
        : ""
    }
    <button class="ai-check-btn" id="btnManifestAccept" type="button"${data.accepted ? " hidden" : ""}>✦ 收下今天的顯化</button>
    <p class="manifest-close-done" id="manifestAccepted"${data.accepted ? "" : " hidden"}>✓ 今天的顯化已留下</p>
  `;
}

function padManifestStepNo(index) {
  return String(index + 1).padStart(2, "0");
}

function renderManifestPlanResult(plan) {
  const root = document.getElementById("manifestPlan");
  if (!root) return;
  const data = normalizeManifestPlan(plan || state.journalManifestPlan);
  if (!data.steps.length) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const iso = currentIso();
  const planId = data.id || `plan:${iso}`;
  root.hidden = false;
  root.innerHTML = `
    <p class="manifest-plan-kicker">我正在靠近它</p>
    <p class="manifest-plan-note">不用一次做到全部，每完成一步，你都正在靠近它。</p>
    <div class="manifest-plan-list">
      ${data.steps
        .map((item, index) => {
          const added = Boolean(item.taskAdded) || manifestStepTaskExists(planId, item.id, iso);
          return `
            <label class="manifest-step${item.completed ? " is-done" : ""}">
              <input class="manifest-step__check" type="checkbox" data-manifest-step="${escapeHtml(item.id)}" ${item.completed ? "checked" : ""} />
              <span class="manifest-step__mark" aria-hidden="true"></span>
              <span class="manifest-step__body">
                ${markableSpan(`${padManifestStepNo(index)}｜${item.title}`, `manifest.plan.step.${index}.title`, `manifest-step__title${item.completed ? " is-done" : ""}`)}
                ${item.detail ? markableSpan(item.detail, `manifest.plan.step.${index}.detail`, "manifest-step__detail") : ""}
                <button class="manifest-exec-btn${added ? " is-on" : ""}" type="button" data-manifest-step-exec="${escapeHtml(item.id)}"${added ? " disabled" : ""}>${added ? "✓ 已放進執行力" : "＋ 放進執行力"}</button>
              </span>
            </label>
          `;
        })
        .join("")}
    </div>
    <button class="manifest-regen-btn" id="btnManifestRegen" type="button">重新整理步驟</button>
  `;
}

function renderJournalManifestResult() {
  if (hasManifestPlan(state.journalManifestPlan)) {
    renderManifestPlanResult(state.journalManifestPlan);
    const close = document.getElementById("manifestClose");
    if (close) {
      close.hidden = true;
      close.innerHTML = "";
    }
    return;
  }
  const plan = document.getElementById("manifestPlan");
  if (plan) {
    plan.hidden = true;
    plan.innerHTML = "";
  }
  renderManifestCloseResult(state.journalManifestClose);
}

function renderManifestSentence(text, highlights) {
  const root = document.getElementById("manifestSentence");
  if (root) {
    root.hidden = true;
    root.innerHTML = "";
  }
  void text;
  void highlights;
}

function setManifestPromptsLoading(loading) {
  state.manifestPromptsBusy = loading;
  const btn = document.getElementById("btnManifestAi");
  const loader = document.getElementById("manifestPromptLoading");
  if (btn) {
    btn.hidden = loading;
    btn.disabled = false;
    btn.textContent = "✦ 幫我拆成可以做到的步驟";
    btn.classList.toggle("is-busy", false);
    btn.setAttribute("aria-busy", "false");
  }
  if (loader) loader.hidden = !loading;
}

function applyGeneratedManifestPrompts(prompts, answers) {
  state.manifestPrompts = normalizeManifestPrompts(prompts);
  renderManifestQuestions(state.manifestPrompts, { answers: answers || ["", ""] });
  persistJournalQuietly();
}

function applyGeneratedManifestClose(close, sig) {
  const prev = normalizeManifestCloseBag(state.journalManifestClose);
  const next = normalizeManifestCloseBag(close);
  next.accepted = prev.accepted;
  next.addedToExec =
    (prev.addedToExec && prev.approachStep === next.approachStep) || manifestCloseTaskExists(next);
  state.journalManifestClose = next;
  state.journalManifestSentence = next.manifestationStatement;
  state.journalMeta.manifestAi = true;
  state.journalMeta.manifestAiSig = sig || state.journalMeta.manifestAiSig || "";
  renderManifestCloseResult(next);
  persistJournalQuietly();
}

async function generateManifestPrompts(options = {}) {
  await generateManifestPlan(options);
}

async function generateManifestChecklist(options = {}) {
  await generateManifestPlan(options);
}

function persistManifestPlan(plan, sig) {
  const next = normalizeManifestPlan(plan);
  if (!next.id) next.id = uid();
  state.journalManifestPlan = next;
  if (sig) {
    state.journalMeta.manifestAi = true;
    state.journalMeta.manifestAiSig = sig;
  }
  renderJournalManifestResult();
  persistJournalQuietly();
  if (dailyManifestUiEnabled()) {
    upsertManifestPlanToSidebar(currentIso(), { manifest: journalFieldValue("manifestVision"), manifestPlan: next });
  }
}

async function generateManifestPlan(options = {}) {
  if (!dailyManifestUiEnabled()) return;
  if (!options.auto) setJournalFoldOpen("section-manifest", true, { manual: true });
  if (state.manifestPromptsBusy && !options.force) {
    if (!options.auto) showToast("還在整理可以靠近的步驟，請稍候。");
    return;
  }
  const current = normalizeManifestPlan(state.journalManifestPlan);
  if (!options.auto && options.confirm !== false && current.steps.some((item) => item.completed)) {
    const ok = window.confirm("重新整理後，目前的步驟與完成進度會被更新，確定要重新整理嗎？");
    if (!ok) return;
  }
  const journal = collectJournal();
  const vision = String(journal.manifest || "").trim();
  if (vision.length < 4) {
    if (!options.auto) showToast("先寫下你想顯化的是什麼。");
    return;
  }
  if (!ensurePlusFeature("manifest_ai", options)) return;
  const sig = vision;
  if (options.auto && state.journalMeta.manifestAiSig === sig && hasManifestPlan(current)) return;

  const token = (state.manifestPromptsToken || 0) + 1;
  state.manifestPromptsToken = token;
  state.checklistToken.manifest = (state.checklistToken.manifest || 0) + 1;
  setManifestPromptsLoading(true);
  const fallback = buildManifestPlanFallback(vision);

  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postReview({
      mode: "manifest",
      step: "plan",
      date: currentIso(),
      vision,
      text: vision,
      context: {
        event: journal.event,
        mood: journal.mood,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        smallestStep: journal.smallestStep,
        openActions: selectedExecutionChoiceActions(journal.executionChoices).map((item) => item.text),
        ...priorThinkAwareContext(journal),
      },
    });
    if (state.manifestPromptsToken !== token) return;
    const plan = normalizeManifestPlan({
      id: current.id || uid(),
      steps: Array.isArray(remote.steps) ? remote.steps : remote.items,
    });
    if (plan.steps.length < 3) throw new Error("雲端回傳格式不完整");
    persistManifestPlan(plan, sig);
    if (!options.auto) {
      showToast("已經整理成可以一步一步靠近的路。");
      trackProduct("manifestation_created", { source: "journal", mode: state.journalMode === "quick" ? "quick" : "deep" });
    }
  } catch (error) {
    if (state.manifestPromptsToken !== token) return;
    if (isPlusRequiredError(error)) return;
    persistManifestPlan({ id: current.id || uid(), steps: fallback.steps }, sig);
    if (!options.auto) showToast(`雲端整理失敗：${formatApiError(error)}，先用本地步驟。`);
  } finally {
    if (state.manifestPromptsToken === token) setManifestPromptsLoading(false);
  }
}

function toggleManifestPlanStep(stepId, completed) {
  if (!dailyManifestUiEnabled()) return;
  const plan = normalizeManifestPlan(state.journalManifestPlan);
  const next = {
    ...plan,
    steps: plan.steps.map((item) => (item.id === stepId ? { ...item, completed: Boolean(completed) } : item)),
  };
  persistManifestPlan(next);
}

function addManifestStepToExec(stepId) {
  if (!dailyManifestUiEnabled()) return;
  const plan = normalizeManifestPlan(state.journalManifestPlan);
  const step = plan.steps.find((item) => item.id === stepId);
  if (!step) return;
  const iso = currentIso();
  const planId = plan.id || `plan:${iso}`;
  if (step.taskAdded || manifestStepTaskExists(planId, step.id, iso)) {
    persistManifestPlan({
      ...plan,
      steps: plan.steps.map((item) => (item.id === stepId ? { ...item, taskAdded: true } : item)),
    });
    showToast("這項已在『執行力』");
    return;
  }
  const result = addTaskFromGuide({
    key: manifestStepTaskKey(planId, step.id, iso),
    label: step.title,
    detail: step.detail,
    source: "顯化力",
    date: iso,
  });
  persistManifestPlan({
    ...plan,
    id: planId,
    steps: plan.steps.map((item) => (item.id === stepId ? { ...item, taskAdded: Boolean(result.added || result.exists) } : item)),
  });
  if (result.added) showToast("已放進側邊欄『執行力』");
  else if (result.exists) showToast("這項已在『執行力』");
}

async function generateManifestClose(options = {}) {
  await generateManifestPlan(options);
}

function addManifestApproachToExec() {
  if (!dailyManifestUiEnabled()) return;
  const close = normalizeManifestCloseBag(state.journalManifestClose);
  const title = String(close.approachStep || "").trim();
  if (!title) return;
  if (close.addedToExec || manifestCloseTaskExists(close)) {
    close.addedToExec = true;
    state.journalManifestClose = close;
    renderManifestCloseResult(close);
    persistJournalQuietly();
    showToast("這項已在『執行力』");
    return;
  }
  const result = addTaskFromGuide({
    key: manifestApproachTaskKey(title),
    label: title,
    source: "顯化力",
    date: currentIso(),
  });
  close.addedToExec = Boolean(result.added || result.exists);
  state.journalManifestClose = close;
  renderManifestCloseResult(close);
  persistJournalQuietly();
  if (result.added) showToast("已放進側邊欄『執行力』");
  else if (result.exists) showToast("這項已在『執行力』");
}

function acceptManifestClose() {
  if (!dailyManifestUiEnabled()) return;
  const close = normalizeManifestCloseBag(state.journalManifestClose);
  if (!hasManifestCloseContent(close)) {
    showToast("先看見正在靠近的未來，再收下今天的顯化。");
    return;
  }
  const vision = journalFieldValue("manifestVision");
  const result = addManifest({
    key: `manifest-close:${currentIso()}`,
    title: close.approachStep || close.manifestationStatement || vision,
    vision,
    futureVision: close.futureVision,
    approachStep: close.approachStep,
    manifestationStatement: close.manifestationStatement,
    date: currentIso(),
  });
  const already = close.accepted;
  close.accepted = true;
  state.journalManifestClose = close;
  state.journalManifestSentence = close.manifestationStatement;
  renderManifestCloseResult(close);
  persistJournalQuietly();
  if (!already) trackProduct("manifestation_created", { source: "journal", mode: state.journalMode === "quick" ? "quick" : "deep" });
  showToast("今天的顯化已留下");
  void result;
}

function maybeAutoGenerateManifest() {
  if (state.journalHydrating) return;
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
    String((data.bodyMind && data.bodyMind.text) || "").trim() ||
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
    : "先把感謝、事件、心情與身心覺察寫下來，再開始 3 輪引導式深度思考。";
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

function actionStepsHtml(items, options = {}) {
  const list = Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!list.length) return "";
  const fieldPrefix = options.fieldPrefix || "";
  const date = options.date || "";
  const highlights = Array.isArray(options.highlights) ? options.highlights : [];
  return `<ol class="action-steps">${list
    .map((item, index) => {
      const num = String(index + 1).padStart(2, "0");
      const field = fieldPrefix ? `${fieldPrefix}.${index}` : "";
      return `<li class="action-steps__item">
        <div class="action-steps__copy">
          <p class="action-steps__title">${num}</p>
          ${
            field
              ? markableP(item, field, "action-steps__body", date, highlights)
              : `<p class="action-steps__body">${highlightedHtml(item, highlights)}</p>`
          }
        </div>
      </li>`;
    })
    .join("")}</ol>`;
}

function insightListHtml(items, className, options = {}) {
  const list = Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!list.length) return "";
  if (className.includes("list") && !className.includes("takeaways")) return actionStepsHtml(list, options);
  const fieldPrefix = options.fieldPrefix || "";
  const date = options.date || "";
  const highlights = Array.isArray(options.highlights) ? options.highlights : [];
  return `<${className.includes("takeaways") ? "ul" : "ol"} class="${className}">${list
    .map((item, index) => {
      const field = fieldPrefix ? `${fieldPrefix}.${index}` : "";
      return `<li>${
        field
          ? markableSpan(item, field, "insight-emph", date, highlights)
          : `<strong class="insight-emph">${highlightedHtml(item, highlights)}</strong>`
      }</li>`;
    })
    .join("")}</${className.includes("takeaways") ? "ul" : "ol"}>`;
}

function renderThinkGuideCloseHtml(guide, data) {
  const title = guide.title || data.title || "";
  const awareness = String(guide.awareness || guide.summary || data.conclusion || "").trim();
  const selfSeen = String(guide.selfSeen || "").trim();
  const takeaway = String(guide.takeaway || "").trim();
  const actions = Array.isArray(guide.actions) ? guide.actions.filter(Boolean) : [];
  const marks = guide.highlights && typeof guide.highlights === "object" ? guide.highlights : {};
  const awarenessHtml = awareness ? markableP(awareness, "think.awareness", "think-guide__close-text", "", fieldHighlightsOf(marks, "awareness")) : "";
  return `<article class="think-guide__close">
        <p class="think-guide__kicker">今日覺察總結</p>
        ${userMarkHintHtml()}
        ${title ? markableP(title, "think.title", "think-guide__close-title", "", fieldHighlightsOf(marks, "title")) : ""}
        ${awarenessHtml}
        ${
          selfSeen
            ? `<div class="think-guide__close-block">
          <p class="think-guide__kicker">今天我看見的自己</p>
          ${markableP(selfSeen, "think.selfSeen", "think-guide__self", "", fieldHighlightsOf(marks, "selfSeen"))}
        </div>`
            : ""
        }
        ${
          takeaway
            ? `<div class="think-guide__close-block">
          <p class="think-guide__kicker">今日帶走的一句話</p>
          ${markableP(takeaway, "think.takeaway", "think-guide__takeaway", "", fieldHighlightsOf(marks, "takeaway"))}
        </div>`
            : ""
        }
        ${actions.length ? actionStepsHtml(actions, { fieldPrefix: "think.action", highlights: fieldHighlightsOf(marks, "actions") }) : ""}
      </article>`;
}

function renderThinkGuideHtml(insight) {
  const data = normalizeInsight(insight);
  const guide = data.guide || emptyThinkGuide();
  const rounds = guide.rounds || [];
  if (!rounds.length && !guide.summary && !guide.awareness) {
    return `<p class="insight-card__empty">${insightEmptyCopy(state.journalMode === "quick")}</p>`;
  }
  const current = Math.min(3, Math.max(1, guide.round || rounds.length || 1));
  const done = thinkGuideDone(guide);
  const roles = ["感受", "需求與模式", "判斷點"];
  const roundCards = rounds
    .map((item, index) => {
      const num = String(index + 1).padStart(2, "0");
      const active = !done && index + 1 === current && !item.answer;
      const answered = Boolean(item.answer);
      return `<article class="think-guide__round${active ? " is-on" : answered ? " is-done" : ""}">
        <p class="think-guide__kicker">第 ${num} 輪｜${roles[index] || ""}</p>
        ${markableP(item.question, `think.round.${index}.question`, "think-guide__q")}
        ${item.hint && (active || !answered) ? markableP(item.hint, `think.round.${index}.hint`, "think-guide__hint") : ""}
        ${
          answered
            ? markableP(item.answer, `think.round.${index}.answer`, "think-guide__answer")
            : active
              ? `<label class="think-guide__field">
                  <span class="sr-only">這一輪的回答</span>
                  <textarea class="textarea think-guide-answer" rows="4" placeholder="用一句話，把此刻真正想到的寫下來…">${escapeHtml(guide.draftAnswer || "")}</textarea>
                  ${journalVoiceHintHtml()}
                  <button class="ai-check-btn" data-think-guide-next type="button">${index === 2 ? "完成三輪，生成總結" : "送出，進入下一輪"}</button>
                </label>`
              : ""
        }
      </article>`;
    })
    .join("");
  const closeHtml = done || guide.summary || guide.awareness ? renderThinkGuideCloseHtml(guide, data) : "";
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
  const marks = data.highlights && typeof data.highlights === "object" ? data.highlights : {};
  return `
    <article class="insight-card__result">
      ${userMarkHintHtml()}
      ${coreLine ? renderConclusionCallout(coreLine, "think.title", "", fieldHighlightsOf(marks, "title")) : ""}
      ${
        analysis
          ? `<section class="insight-block">
        <p class="insight-block__label">① 今天的身心訊號</p>
        ${insightFieldHtml(analysis, "think.psychology", "insight-block__text", "", fieldHighlightsOf(marks, "psychology"))}
        ${hasBody ? markableP(data.bodyLink, "think.bodyLink", "insight-block__note", "", fieldHighlightsOf(marks, "bodyLink")) : ""}
      </section>`
          : ""
      }
      ${
        reflection
          ? `<section class="insight-block insight-block--review">
        <p class="insight-block__label">② 客觀檢討與反思</p>
        ${insightFieldHtml(reflection, "think.reflection", "insight-block__text", "", fieldHighlightsOf(marks, "reflection"))}
      </section>`
          : ""
      }
      ${
        suggestions.length
          ? `<section class="insight-block insight-block--tips">
        <p class="insight-block__label">③ 具體突破建議（怎麼做會更好）</p>
        ${actionStepsHtml(suggestions, { fieldPrefix: "think.suggestion", highlights: fieldHighlightsOf(marks, "suggestions") })}
      </section>`
          : ""
      }
      ${
        takeaways.length
          ? `<section class="insight-block insight-block--focus">
        <p class="insight-block__label">💡 今日核心重點整理</p>
        ${insightListHtml(takeaways, "insight-block__takeaways", { fieldPrefix: "think.takeawayItem", highlights: fieldHighlightsOf(marks, "takeaways") })}
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
  if (loading) btn.textContent = "正在為你整理今日覺察總結…";
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
    btn.disabled = false;
    btn.classList.toggle("is-busy", loading);
    btn.setAttribute("aria-busy", loading ? "true" : "false");
    btn.textContent = loading ? "想下一問…" : "開始深度思考";
  }
  if (otherBtn) {
    otherBtn.disabled = false;
    otherBtn.classList.remove("is-busy");
    otherBtn.setAttribute("aria-busy", "false");
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
    lastAnswer: String((guide?.rounds || []).filter((item) => item.answer).slice(-1)[0]?.answer || "").trim(),
  };
}

function localThinkGuideAsk(journal, round, guide) {
  const eventBit = String(journal?.event || "").trim().slice(0, 16) || "今天這件事";
  const thanksBit = thanksTextFrom(journal).trim();
  const mood = journal?.mood || "";
  const blob = `${thanksBit}\n${journal?.event || ""}\n${mood}\n${(guide?.rounds || [])
    .map((item) => `${item.question || ""} ${item.answer || ""}`)
    .join("\n")}`;
  const mixed = /一方面|卻又|可是又|但又|開心.{0,12}(擔心|不安)|幸福.{0,12}(不安|怕)/.test(blob);
  const angry = /生氣|憤怒|委屈|被冒犯|不爽|討厭/.test(blob);
  const sad = /難過|失落|傷心|遺憾|失去/.test(blob);
  const anxious = /焦慮|害怕|擔心|不安|恐懼/.test(blob);
  const warm = /幸福|感謝|開心|滿足|溫暖|喜歡|愛|愉快|平靜|感恩|珍惜/.test(blob);
  const helpValue = /幫忙|幫助|有用|價值|變好|影響|付出/.test(blob);
  const prevFull = String(guide?.rounds?.filter((item) => item.answer).slice(-1)[0]?.answer || "").trim();
  const prev = prevFull.slice(0, 18);
  const shortPrev = prevFull.replace(/\s+/g, "").length > 0 && prevFull.replace(/\s+/g, "").length <= 8;
  if (round <= 1) {
    if (mixed) {
      return { question: `當「${eventBit}」發生時，那一刻你最直接的感受是什麼？`, hint: "先點名感覺，先不用解釋。" };
    }
    if (angry) {
      return { question: `在「${eventBit}」裡，真正讓你不舒服的，是哪一個瞬間？`, hint: "先回到那個畫面。" };
    }
    if (sad) {
      return { question: `面對「${eventBit}」，你此刻最明顯的感受是什麼？`, hint: "用自己的話說那一刻。" };
    }
    if (anxious && !warm) {
      return { question: `想到「${eventBit}」時，心裡最先浮出來的感覺是什麼？`, hint: "先描述感覺就好。" };
    }
    return {
      question: thanksBit
        ? "今天真正讓你覺得被觸動的，是哪一個具體瞬間？"
        : `當「${eventBit}」發生時，那一刻你最直接的感受是什麼？`,
      hint: "先回到那個畫面，不必急著解釋。",
    };
  }
  if (round === 2) {
    if (shortPrev) {
      return {
        question: "把「事情變好了」和「自己真的幫上忙」放在一起，你覺得今天哪一個比較接近？還是其實有其他原因？",
        hint: "選一個比較近的就好，沒有標準答案。",
      };
    }
    const clip = prev || "你剛寫下的那句";
    if (angry) {
      return { question: `你說「${clip}」，這件事真正碰到你在乎的，是哪一條界線？`, hint: "往「我真正介意什麼」走一小步。" };
    }
    if (sad) {
      return { question: `你說「${clip}」，這份難過之所以重要，是因為它碰到了你的什麼？`, hint: "看看為什麼這對你重要。" };
    }
    if (anxious && !warm) {
      return { question: `你說「${clip}」，你最擔心接下來會發生的，其實是哪一件？`, hint: "把擔心說具體一點就好。" };
    }
    return {
      question: `你說「${clip}」。最讓你有感的，是事情本身變好了，還是你發現自己有產生影響？還是其實有其他原因？`,
      hint: "讓你自己辨認，不必急著選漂亮的答案。",
    };
  }
  if (shortPrev) {
    return {
      question: "那我們換簡單一點：今天比較靠近「被看見」，還是「真的幫上忙」？還是其實有其他原因？",
      hint: "選一個比較近的方向就好。",
    };
  }
  if (helpValue) {
    return {
      question: "如果有一天你很努力幫忙，對方卻沒有因此變好，你還會覺得自己的付出有價值嗎？",
      hint: "不是否定你，只是把答案再往下一層。",
    };
  }
  if (warm && !angry && !sad) {
    return {
      question: `如果今天沒有發生「${eventBit}」，你覺得自己還會這麼有感嗎？`,
      hint: "看看你真正珍惜的，是不是這一件本身。",
    };
  }
  return {
    question: "經過前面兩問，你有沒有發現：今天這件事其實也碰到了你對自己的某個期待？",
    hint: "用疑問來看自己，不必下結論。",
  };
}

function localThinkGuideClose(journal, guide) {
  const eventBit = String(journal?.event || "").trim().slice(0, 18) || "今天這件事";
  const answers = (guide?.rounds || []).map((item) => String(item.answer || "").trim()).filter(Boolean);
  const a1 = answers[0] || "";
  const a2 = answers[1] || "";
  const a3 = answers[2] || "";
  const thanks = thanksTextFrom(journal).trim();
  const p1 = `今天留下印象的是「${eventBit}」。你沒有急著下結論，而是把當下真正有感的地方寫了下來。`;
  const p2 = a2
    ? `三輪下來，你從「${(a1 || "當下的感受").slice(0, 16)}」走到「${a2.slice(0, 16)}」${a3 ? `，又看見「${a3.slice(0, 16)}」` : ""}。這幾句比較像同一條線：你在乎的，不只是事情表面。`
    : `三輪回答指向同一件事：你開始分辨，今天真正碰到你的是什麼。`;
  const p3 = thanks
    ? "也許值得繼續觀察的是：你把這份好放在心上時，自己真正珍惜的是哪一點。"
    : "也許值得繼續觀察的是：若明天再遇到類似的瞬間，你還會不會停下來多看自己一眼。";
  const awareness = [p1, p2, p3].join("\n\n");
  const selfSeen = a3 && /^我/.test(a3) && a3.length <= 40
    ? a3.replace(/[。！？]+$/, "") + "。"
    : a2
      ? `我發現自己很在意，${a2.slice(0, 18).replace(/[。！？]+$/, "")}。`
      : "我開始看見，今天這件事其實在說出我真正在乎的是什麼。";
  const takeaway = helpValueFromAnswers(answers, journal)
    ? "看見別人變好時，也可以看看自己把價值放在哪裡。"
    : thanks
      ? "把日常裡的好當真看見，本身就是一種停留。"
      : "先看清楚我真正有感的那一點，今天就沒有白過。";
  return {
    title: thanks ? "把日常裡的好當真看見" : "今天真正有感的那一層",
    summary: awareness,
    awareness,
    selfSeen,
    takeaway,
    actions: [],
  };
}

function helpValueFromAnswers(answers, journal) {
  const blob = `${(answers || []).join(" ")}\n${thanksTextFrom(journal)}\n${journal?.event || ""}`;
  return /幫忙|幫助|有用|價值|變好|影響|付出/.test(blob);
}

function applyThinkGuideInsight(guide, sig) {
  const data = normalizeThinkGuide(guide);
  const insight = normalizeInsight({
    title: data.title,
    conclusion: data.summary,
    psychology: data.summary,
    suggestions: data.actions,
    takeaways: [data.selfSeen, data.takeaway].filter(Boolean),
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
  if (rejectArchivedJournalWrite(options)) return false;
  if (!options.auto) setJournalFoldOpen(thinkGuideFoldId(), true, { manual: true });
  if (!ensurePlusFeature("think_ai", options)) return false;
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
  trackProduct("deep_thinking_started", { source: "guide", round: nextRound });
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
    const remote = await postChat({
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
    if (isPlusRequiredError(error)) return false;
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
  if (rejectArchivedJournalWrite(options)) return false;
  if (!options.auto) setJournalFoldOpen(thinkGuideFoldId(), true, { manual: true });
  if (recoverStaleBusy(state.insightBusy, state.insightBusyAt, () => setInsightLoading(false))) {
    if (!options.auto) showToast("還在為你整理今日覺察總結，請稍候。");
    return false;
  }
  const journal = collectJournal();
  const current = normalizeInsight(state.journalInsight);
  const guide = current.guide || emptyThinkGuide();
  if (guide.rounds.filter((item) => item.answer).length < 3) {
    if (!options.auto) showToast("請先寫完三輪深度思考。");
    return false;
  }
  if (!ensurePlusFeature("think_ai", options)) return false;
  const sig = insightSignature(journal);
  const token = (state.insightToken || 0) + 1;
  state.insightToken = token;
  setInsightLoading(true);
  setThinkGuideLoadingLabel("正在為你整理今日覺察總結…");
  const watchdog = setTimeout(() => {
    if (state.insightToken === token && state.insightBusy) {
      setInsightLoading(false);
      if (!options.fromComplete && !options.auto) showToast("雲端回應太久，已先停下來。請再試一次。");
    }
  }, 32000);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postChat({
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
      summary: String(remote.awareness || remote.summary || "").trim(),
      awareness: String(remote.awareness || remote.summary || "").trim(),
      selfSeen: String(remote.selfSeen || "").trim(),
      takeaway: String(remote.takeaway || "").trim(),
      actions: Array.isArray(remote.actions)
        ? remote.actions.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 2)
        : [],
      highlights: remote.highlights && typeof remote.highlights === "object" ? remote.highlights : {},
    };
    if (!closed.summary && !closed.awareness) throw new Error("雲端回傳格式不完整");
    applyThinkGuideInsight({ ...guide, round: 4, ...closed }, sig);
    if (!options.fromComplete) showToast("今日覺察總結已生成。");
    trackProduct("deep_thinking_completed", { source: "guide" });
    return true;
  } catch (error) {
    if (state.insightToken !== token) return false;
    if (isPlusRequiredError(error)) return false;
    const fallback = localThinkGuideClose(journal, guide);
    applyThinkGuideInsight({ ...guide, round: 4, ...fallback }, sig);
    if (!options.fromComplete) showToast(`雲端總結失敗：${formatApiError(error)}，先留下本地思考。`);
    trackProduct("deep_thinking_completed", { source: "local" });
    return true;
  } finally {
    clearTimeout(watchdog);
    setThinkGuideLoadingLabel("正在為你想下一問…");
    if (state.insightToken === token) setInsightLoading(false);
  }
}

async function submitThinkGuideRound() {
  if (rejectArchivedJournalWrite()) return;
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
  if (!answer) {
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
  if (!data.title && !data.analysis && !data.notice && !data.suggestions.length) {
    root.innerHTML = `<p class="insight-card__empty">先把左邊的心情、身體與睡眠看過，再點看看今天適合怎麼照顧自己。</p>`;
    return;
  }
  const tips = actionStepsHtml(data.suggestions, {
    fieldPrefix: "bodyCoach.suggestion",
    highlights: fieldHighlightsOf(data.highlights, "suggestions"),
  });
  const core = String(data.title || "").trim();
  root.innerHTML = `
    <article class="insight-card__result">
      ${userMarkHintHtml()}
      ${core ? renderConclusionCallout(/[。！？]$/.test(core) ? core : `${core}。`, "bodyCoach.title", "", fieldHighlightsOf(data.highlights, "title")) : ""}
      ${
        data.analysis
          ? `<section class="insight-block">
        <p class="insight-block__label">① 今天的身心訊號</p>
        ${insightFieldHtml(data.analysis, "bodyCoach.analysis", "insight-block__text", "", fieldHighlightsOf(data.highlights, "analysis"))}
      </section>`
          : ""
      }
      ${
        data.notice
          ? `<section class="insight-block insight-block--review">
        <p class="insight-block__label">② 今天值得留意的地方</p>
        ${insightFieldHtml(data.notice, "bodyCoach.notice", "insight-block__text", "", fieldHighlightsOf(data.highlights, "notice"))}
      </section>`
          : ""
      }
      ${
        tips
          ? `<section class="insight-block insight-block--tips">
        <p class="insight-block__label">③ 今晚可以這樣照顧自己</p>
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
  const api = typeof window !== "undefined" ? window.NichiBodyCoachInsight : null;
  const ctx = {
    mood: journal.mood,
    event: journal.event,
    thanks: thanksTextFrom(journal),
    thanksText: thanksTextFrom(journal),
    bodyCheck: normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote),
    bodyNote: journal.bodyNote,
    bodyTags: journal.bodyTags,
  };
  const built = api && typeof api.buildLocalBodyCoach === "function" ? api.buildLocalBodyCoach(ctx) : {};
  return {
    title: String(built.title || "今天的身心狀態相對平穩，目前沒有特別明顯的反差。").trim(),
    analysis: String(built.analysis || "").trim(),
    notice: String(built.notice || "").trim(),
    suggestions: Array.isArray(built.suggestions) ? built.suggestions.slice(0, 2) : [],
    sig: bodyCoachSignature(journal),
  };
}

async function generateBodyCoach(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  if (!options.auto) setJournalFoldOpen("section-body", true, { manual: true });
  if (state.bodyCoachBusy) return;
  const journal = collectJournal();
  if (!bodyCoachReady(journal, options)) {
    if (!options.auto) showToast("請先勾選今天有出現的狀況。");
    return;
  }
  if (!ensurePlusFeature("body_ai", options)) return;
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
        awareness: journal.awareness,
        execution: journal.execution,
        smallestStep: journal.smallestStep,
      },
    });
    if (state.bodyCoachToken !== token) return;
    const coach = { ...normalizeBodyCoach(remote), sig };
    if (!(coach.title || coach.analysis) || coach.suggestions.length < 1) throw new Error("雲端回傳格式不完整");
    state.journalBodyCoach = coach;
    state.journalMeta.bodyCoachSig = sig;
    renderBodyCoachCard(coach);
    persistJournalQuietly();
    showToast("今天的身心建議，已經為你整理好了。");
    trackProduct("body_awareness_completed", { source: "coach", mode: state.journalMode === "quick" ? "quick" : "deep" });
  } catch (error) {
    if (state.bodyCoachToken !== token) return;
    if (isPlusRequiredError(error)) return;
    const fallback = localBodyCoachFallback(journal);
    state.journalBodyCoach = fallback;
    state.journalMeta.bodyCoachSig = sig;
    renderBodyCoachCard(fallback);
    persistJournalQuietly();
    showToast(`雲端建議還沒整理好：${formatApiError(error)}，先留下本地身心小結。`);
    trackProduct("body_awareness_completed", { source: "local", mode: state.journalMode === "quick" ? "quick" : "deep" });
  } finally {
    if (state.bodyCoachToken === token) setBodyCoachLoading(false);
  }
}

function maybeAutoGenerateBodyCoach(journal) {
  if (state.journalHydrating || rejectArchivedJournalWrite({ auto: true })) return;
  syncBodyMindCta();
}

function renderBodyMindInsight(mind) {
  const root = document.getElementById("bodyMindInsight");
  if (!root) return;
  const data = normalizeBodyMind(mind || state.journalBodyMind);
  if (!data.insight && !data.support) {
    root.innerHTML = "";
    syncBodyMindCta();
    return;
  }
  const silent = data.status === "silence";
  const formatted = /【核心結論】|【今日金句】|^主題[：:]/.test(`${data.insight || ""}\n${data.support || ""}`);
  if (formatted && !silent) {
    root.innerHTML = `
      <article class="body-mind-insight body-mind-insight--format">
        ${data.insight ? `<div class="body-mind-insight__line">
          ${markableP(data.insight, "bodyMind.insight", "body-mind-insight__text body-mind-insight__theme")}
        </div>` : ""}
        ${data.support ? `<div class="body-mind-insight__format">
          ${markableHtml("div", data.support, "bodyMind.support", "body-mind-insight__support body-mind-insight__support--pre")}
        </div>` : ""}
      </article>`;
  } else {
    root.innerHTML = `
      <article class="body-mind-insight${silent ? " body-mind-insight--silence" : ""}">
        ${data.insight ? `<div class="body-mind-insight__line">
          ${silent ? "" : `<p class="body-mind-insight__label">我注意到</p>`}
          ${markableP(data.insight, "bodyMind.insight", "body-mind-insight__text")}
        </div>` : ""}
        ${data.support ? `<div>
          ${silent ? "" : `<p class="body-mind-insight__label">為什麼這樣看</p>`}
          ${markableP(data.support, "bodyMind.support", "body-mind-insight__support")}
        </div>` : ""}
      </article>`;
  }
  paintInternalModelDebug(root, data.internalDebug);
  syncBodyMindCta();
}

function setBodyMindLoading(loading) {
  state.bodyMindBusy = loading;
  const loader = document.getElementById("bodyMindLoading");
  const insight = document.getElementById("bodyMindInsight");
  if (loader) loader.hidden = !loading;
  if (insight) insight.hidden = loading;
  const btn = document.getElementById("btnBodyMindInsight");
  if (btn) btn.disabled = Boolean(loading) || isCurrentJournalArchived();
  if (!loading) syncBodyMindCta();
}

async function generateBodyMindInsight(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.bodyMindBusy) return;
  const liveEl = document.getElementById("bodyMindText");
  const text = String(liveEl && liveEl.value != null ? liveEl.value : "").replace(/\s+/g, " ").trim();
  if (!bodyMindTextReady(text)) {
    showBodyMindCtaHint("再多寫一點今天發生的事或身體感受，會更容易看見。");
    syncBodyMindCta();
    return;
  }
  showBodyMindCtaHint("");
  if (!ensurePlusFeature("body_ai", options)) return;
  state.journalBodyMind = normalizeBodyMind({
    ...(state.journalBodyMind || emptyBodyMind()),
    text,
  });
  persistJournalQuietly();
  const journal = collectJournal();
  journal.bodyMind = normalizeBodyMind({ ...(journal.bodyMind || emptyBodyMind()), text });
  const sig = bodyMindSignature(journal);
  if (hasBodyMindResult(journal.bodyMind) && journal.bodyMind.sig === sig && !options.force) {
    renderBodyMindInsight(journal.bodyMind);
    return;
  }
  if (state.bodyMindBusy) return;
  const token = (state.bodyMindToken || 0) + 1;
  state.bodyMindToken = token;
  state.bodyMindRequestText = text;
  setBodyMindLoading(true);
  try {
    if (!state.user) throw new Error("請先登入，才能整理今天的覺察。");
    const remote = await postReview({
      mode: "bodymind",
      date: currentIso(),
      text,
      context: {
        bodyMindText: text,
        event: journal.event,
        mood: journal.mood,
        thanksText: thanksTextFrom(journal),
        thanks: thanksTextFrom(journal),
      },
    });
    if (state.bodyMindToken !== token) return;
    const currentText = String(document.getElementById("bodyMindText")?.value || "").replace(/\s+/g, " ").trim();
    const insight = String(remote.insight || "").replace(/\s+/g, " ").trim();
    const support = String(remote.support || "").replace(/\s+/g, " ").trim();
    if (!insight) throw new Error("今天的覺察還沒整理好，請再試一次。");
    const matches = currentText === text;
    const next = normalizeBodyMind({
      ...normalizeBodyMind(state.journalBodyMind),
      text: currentText || text,
      insight,
      support,
      status: String(remote.status || "").trim(),
      seeType: String(remote.seeType || "").trim(),
      evidence: Array.isArray(remote.evidence) ? remote.evidence : [],
      confidence: String(remote.confidence || "").trim(),
      generatedAt: new Date().toISOString(),
      sig,
      internalDebug: takeInternalDebug(remote),
    });
    state.journalBodyMind = next;
    if (matches) state.journalMeta.bodyMindSig = sig;
    renderBodyMindInsight(next);
    persistJournalQuietly();
  } catch (error) {
    if (state.bodyMindToken !== token) return;
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "今天的覺察還沒整理好，請再試一次。");
  } finally {
    if (state.bodyMindToken === token) {
      state.bodyMindRequestText = "";
      setBodyMindLoading(false);
    }
  }
}

function maybeAutoGenerateBodyMind() {
  syncBodyMindCta();
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
  const api = textIntegrityApi();
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const raw = typeof item === "string" ? item.trim() : String(item?.question || item?.title || "").trim();
      const question = typeof api.finalizeGeneratedQuestion === "function"
        ? api.finalizeGeneratedQuestion(raw, { source: "app.normalizePromptQuestionList", field: "question", max: 200 })
        : raw;
      if (!question || looksIncompleteAwarenessText(question)) return null;
      return {
        question,
        placeholder: String((item && item.placeholder) || "寫下那個時刻…").trim().slice(0, 48) || "寫下那個時刻…",
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
          ? { question, placeholder: "寫下你準備做的一小步…", parked: false }
          : null;
      }
      const question = String(item?.question || item?.title || "").trim();
      if (!question) return null;
      return {
        question,
        placeholder:
          String(item?.placeholder || "寫下你準備做的一小步…").trim().slice(0, 48) || "寫下你準備做的一小步…",
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
  const count = Math.max(prompts.length, 1);
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
        title,
        plainGuide: String(item?.plainGuide || "白話想一想：先把場面講清楚。").trim(),
        deepGuide: String(item?.deepGuide || "深挖一點點：真正被碰到的是哪一層？").trim(),
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

function localExecutionPrompts() {
  return executionQuestionFallbacks().slice(0, EXECUTION_PROMPT_MAX);
}

function mapReviewToAwarenessDay(iso, review) {
  const journal = (review && review.journal) || {};
  const check = normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote);
  const bodyFlags = [...(check.mood.flags || []), ...(check.body.flags || [])]
    .filter((flag) => flag && flag !== "其他")
    .join("、");
  const sleep = [check.sleep.duration, check.sleep.quality, check.sleep.energy].filter(Boolean).join("／");
  const awarenessResult = hasAwarenessResult(journal.awarenessResult)
    ? {
        seen: compactAwarenessText(journal.awarenessResult.seen || "", 80),
        gap: compactAwarenessText(journal.awarenessResult.gap || "", 80),
        line: compactAwarenessText(journal.awarenessResult.line || "", 80),
        echo: compactAwarenessText(journal.awarenessResult.echo || "", 80),
      }
    : null;
  return {
    date: iso,
    mood: journal.mood || "",
    thanks: thanksTextFrom(journal).slice(0, 80),
    event: String(journal.event || review.rawText || "").slice(0, 120),
    body: bodyFlags.slice(0, 60),
    sleep,
    awarenessAnswers: (journal.awareness || []).slice(0, 3),
    awareness: (journal.awarenessChecks || []).slice(0, 4),
    awarenessResult,
    actions: (journal.executionChecks || []).slice(0, 3),
    insight: String(journal.insight?.title || journal.insight?.conclusion || "").slice(0, 80),
  };
}

function collectRecentAwarenessDays() {
  const todayIso = currentIso();
  const fromDate = parseIsoDate(todayIso) || new Date();
  const fromIso = toInputDate(addDays(fromDate, -6));
  const reviews = getReviews();
  return Object.entries(reviews)
    .filter(([iso, review]) => iso >= fromIso && iso <= todayIso && (journalHasContent(review?.journal) || reviewIsComplete(review)))
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 7)
    .map(([iso, review]) => mapReviewToAwarenessDay(iso, review));
}

function collectGrowthProgress() {
  const todayIso = currentIso();
  const dates = getCompletedDates();
  const reviews = getReviews();
  const recentReviews = Object.entries(reviews)
    .filter(([iso, review]) => iso !== todayIso && reviewIsComplete(review))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([iso, review]) => mapReviewToAwarenessDay(iso, review));
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
    recentAwarenessDays: collectRecentAwarenessDays(),
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

const EXEC_WAIT_COPY = "寫完前面的看見後，再整理今天的下一步。";
const CORE_WAIT_COPY = "請先完成上方今日感謝與事件，將為你準備今日專屬的覺察與執行題";
const AWARE_WAIT_COPY = "完成「今日感謝」與「今日事件」後，會依照你今天寫下的內容，產生專屬於你的覺察選項。";
const THINK_WAIT_COPY = "寫完今日感謝與事件後，再開始今天的深度思考。";

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
  if (keepHydratedCorePrompts(prompts, hasAnswers, data?.corePromptsAi, 1)) {
    return prompts.slice(0, AWARENESS_QUIZ_COUNT);
  }
  return [];
}

function hydrateExecutionPrompts(data) {
  const prompts = normalizeExecutionPrompts(data?.executionPrompts);
  const hasAnswers =
    (data?.execution || []).some((item) => String(item || "").trim()) || prompts.some((item) => item.parked);
  if (keepHydratedCorePrompts(prompts, hasAnswers, data?.corePromptsAi, EXECUTION_PROMPT_MIN)) {
    return prompts.slice(0, EXECUTION_PROMPT_MAX);
  }
  return [];
}

function hasCorePromptSet() {
  return (
    normalizeAwarenessPrompts(state.awarenessPrompts).length >= 1 &&
    normalizeExecutionPrompts(state.executionPrompts).length >= EXECUTION_PROMPT_MIN
  );
}

function collectPromptAnswers(prefix, count = 3) {
  return Array.from({ length: count }, (_, index) => journalFieldValue(`${prefix}${index + 1}`));
}

function syncCorePromptGate() {
  const ready = coreStoryReady();
  const awareLoading = Boolean(state.corePromptsBusy || state.choicesBusy?.awareness);
  const execLoading = Boolean(state.choicesBusy?.execution || (state.corePromptsBusy && state.corePromptsScope === "execution"));
  const hasAware =
    normalizeChoiceBag(state.awarenessChoices).options.length > 0 ||
    normalizeAwarenessPrompts(state.awarenessPrompts).length >= 1;
  const execBag = normalizeExecutionChoiceBag(state.executionChoices);
  const hasExecChoices = usesExecutionChoiceUi() && (execBag.options.length > 0 || Boolean(execBag.followupQuestion));
  const hasExec = usesExecutionChoiceUi()
    ? hasExecChoices
    : normalizeExecutionPrompts(state.executionPrompts).length >= EXECUTION_PROMPT_MIN;
  const staleExec = usesExecutionChoiceUi() ? false : executionPromptsAreStale(state.executionPrompts);
  const awareEmpty = document.getElementById("awareEmpty");
  const execEmpty = document.getElementById("execEmpty");
  const awareBtn = document.getElementById("btnAwarePrompts");
  const execBtn = document.getElementById("btnExecPrompts");
  if (usesAwarenessV3Path()) {
    if (awareEmpty) awareEmpty.hidden = true;
    if (awareBtn) awareBtn.hidden = true;
    lockNewDayAwareUi();
  } else if (awareEmpty) {
    awareEmpty.textContent = AWARE_WAIT_COPY;
    awareEmpty.hidden = awareLoading || hasAware;
  }
  if (execEmpty) {
    execEmpty.textContent = EXEC_WAIT_COPY;
    execEmpty.hidden = execLoading || hasExec;
  }
  if (!usesAwarenessV3Path() && awareBtn) {
    awareBtn.hidden = hasAware;
    if (!awareBtn.hidden) {
      awareBtn.disabled = false;
      awareBtn.classList.toggle("is-busy", awareLoading);
      awareBtn.setAttribute("aria-busy", awareLoading ? "true" : "false");
      awareBtn.title = ready || awareLoading ? "" : "請先寫下今日感謝、事件，並選擇心情";
      awareBtn.textContent = awareLoading ? "正在整理覺察選項…" : "✦ 開始今天的覺察";
    }
  }
  if (execBtn) {
    const hideChoiceLoading = usesExecutionChoiceUi() && execLoading;
    execBtn.hidden = hideChoiceLoading || (hasExec && !staleExec);
    if (!execBtn.hidden) {
      execBtn.disabled = false;
      execBtn.classList.toggle("is-busy", execLoading);
      execBtn.setAttribute("aria-busy", execLoading ? "true" : "false");
      execBtn.textContent = execLoading
        ? "正在整理明天的小行動…"
        : staleExec
          ? "重新整理行動問題"
          : "✦ 開始今天的行動整理";
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
      genBtn.disabled = false;
      genBtn.classList.toggle("is-busy", Boolean(state.corePromptsBusy));
      genBtn.setAttribute("aria-busy", state.corePromptsBusy ? "true" : "false");
    }
    if (checkBtn) checkBtn.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  if (checkBtn) checkBtn.hidden = false;
  const saved = Array.isArray(answers) ? answers : collectPromptAnswers(prefix, items.length);
  const hint = prefix === "exec" ? "寫下今天的行動卡點…" : "寫下今天的覺察…";
  const fieldPrefix = prefix === "exec" ? "exec.prompt" : "awareness.prompt";
  root.innerHTML = items
    .map(
      (item, index) => `
        <div class="aware-q">
          ${markableP(item.question, `${fieldPrefix}.${index}.question`, "journal-core-q")}
          <textarea class="textarea" id="${prefix}${index + 1}" rows="${rows}" placeholder="${escapeHtml(hint)}">${escapeHtml(saved[index] || "")}</textarea>
        </div>
      `
    )
    .join("");
}

function renderAwarenessQuestions(prompts, options = {}) {
  renderAwarenessChoices(state.awarenessChoices, options);
}

function choiceListHtml(bag, kind) {
  const data = normalizeChoiceBag(bag);
  const noneId = choiceNoneId();
  const selected = new Set(data.selectedIds);
  const noneOn = Boolean(data.none);
  const options = data.options.concat([{ id: noneId, text: choiceNoneText(), none: true }]);
  return `
    <div class="choice-list" data-choice-kind="${escapeHtml(kind)}" role="group" aria-label="${kind === "think" ? "深度思考選項" : "覺察選項"}">
      <p class="choice-hint">選出最有感的 1～2 個就好。</p>
      ${options
        .map((item) => {
          const on = item.none ? noneOn : selected.has(item.id);
          return `
            <button type="button" class="choice-opt${on ? " is-on" : ""}${item.none ? " choice-opt--none" : ""}" data-choice-id="${escapeHtml(item.id)}" data-choice-kind="${escapeHtml(kind)}"${item.none ? " data-choice-none=\"1\"" : ""}>
              <span class="choice-opt__row">
                <span class="choice-opt__box" aria-hidden="true"></span>
                <span class="choice-opt__text">${escapeHtml(item.text)}</span>
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAwarenessChoices(bag) {
  if (usesAwarenessV3Path()) {
    renderAwarenessV3();
    return;
  }
  const root = document.getElementById("awareQuestions");
  const empty = document.getElementById("awareEmpty");
  const genBtn = document.getElementById("btnAwarePrompts");
  const data = normalizeChoiceBag(bag || state.awarenessChoices);
  if (!root) return;
  root.classList.remove("aware-quiz");
  if (!data.options.length) {
    root.innerHTML = "";
    if (empty) {
      empty.textContent = AWARE_WAIT_COPY;
      empty.hidden = Boolean(state.choicesBusy?.awareness || state.corePromptsBusy);
    }
    if (genBtn) {
      genBtn.hidden = false;
      genBtn.disabled = false;
      genBtn.classList.toggle("is-busy", Boolean(state.choicesBusy?.awareness || state.corePromptsBusy));
      genBtn.setAttribute("aria-busy", state.choicesBusy?.awareness || state.corePromptsBusy ? "true" : "false");
      genBtn.textContent = state.choicesBusy?.awareness || state.corePromptsBusy ? "正在整理覺察選項…" : "✦ 開始今天的覺察";
    }
    syncAwareQuoteGate();
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  root.innerHTML = choiceListHtml(data, "awareness");
  paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.awareness);
  syncAwareQuoteGate();
}

function renderThinkChoices(bag) {
  const root = document.getElementById("thinkQuestions");
  const empty = document.getElementById("thinkEmpty");
  const genBtn = document.getElementById("btnThinkChoices");
  const data = normalizeChoiceBag(bag || state.thinkChoices);
  if (!root) return;
  if (!data.options.length) {
    root.innerHTML = "";
    if (empty) {
      empty.textContent = THINK_WAIT_COPY;
      empty.hidden = Boolean(state.choicesBusy?.think);
    }
    if (genBtn) {
      genBtn.hidden = false;
      genBtn.disabled = false;
      genBtn.classList.toggle("is-busy", Boolean(state.choicesBusy?.think));
      genBtn.setAttribute("aria-busy", state.choicesBusy?.think ? "true" : "false");
      genBtn.textContent = state.choicesBusy?.think ? "正在整理深度選項…" : "✦ 開始今天的深度思考";
    }
    syncThinkChoiceGate();
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  root.innerHTML = choiceListHtml(data, "think");
  syncThinkChoiceGate();
}

function usesReflectionV3Path(journal) {
  const insight = (journal && journal.insight) || state.journalInsight;
  const guide = normalizeThinkGuide(insight && insight.guide);
  if (guide.variant === "reflection-v3") return true;
  if (guide.variant === "think-v2") return false;
  if ((guide.rounds || []).some((item) => String(item.question || "").trim())) return false;
  if (thinkV2Closed(guide)) return false;
  const bag = normalizeChoiceBag((journal && journal.thinkChoices) || state.thinkChoices);
  if (hasMeaningfulChoices(bag)) return false;
  return true;
}

function usesThinkV2Path(journal) {
  if (usesReflectionV3Path(journal)) return false;
  const insight = (journal && journal.insight) || state.journalInsight;
  const guide = normalizeThinkGuide(insight && insight.guide);
  if (guide.variant === "think-v2") return true;
  const bag = normalizeChoiceBag((journal && journal.thinkChoices) || state.thinkChoices);
  if (hasMeaningfulChoices(bag)) return false;
  return true;
}

function renderThinkSection() {
  if (usesReflectionV3Path()) renderThinkV3();
  else if (usesThinkV2Path()) renderThinkV2();
  else renderThinkChoices(state.thinkChoices);
}

function renderThinkChoiceResult(insight) {
  const root = document.getElementById("thinkChoiceResult");
  if (!root) return;
  const guide = normalizeInsight(insight || state.journalInsight).guide || emptyThinkGuide();
  const close = guide.close && typeof guide.close === "object" ? guide.close : {};
  const coreConclusion = String(close.coreConclusion || guide.awareness || guide.summary || "").trim();
  const blindSpot = String(close.blindSpot || "").trim();
  const improvementDirection = String(close.improvementDirection || guide.direction || "").trim();
  const hasClose = Boolean(
    coreConclusion || blindSpot || improvementDirection || guide.selfSeen || guide.takeaway || guide.direction
  );
  if (!hasClose) {
    root.innerHTML = "";
    return;
  }
  const v2 = guide.variant === "think-v2";
  const rawClose = ((insight || state.journalInsight || {}).guide || {}).close;
  const hasStoredClose = Boolean(
    rawClose &&
      typeof rawClose === "object" &&
      (rawClose.coreConclusion || rawClose.blindSpot || rawClose.improvementDirection)
  );
  const sections = v2
    ? [
        coreConclusion ? { kicker: "核心結論", text: coreConclusion, kind: "awareness" } : null,
        blindSpot ? { kicker: "我沒看見的問題", text: blindSpot, kind: "blindSpot" } : null,
        improvementDirection ? { kicker: "怎麼做可以更好", text: improvementDirection, kind: "direction" } : null,
        !hasStoredClose && guide.selfSeen ? { kicker: "今天我看見的", text: guide.selfSeen, kind: "selfSeen" } : null,
        !hasStoredClose && guide.takeaway ? { kicker: "還想確認的", text: guide.takeaway, kind: "takeaway" } : null,
      ].filter(Boolean)
    : [
        guide.awareness || guide.summary ? { kicker: "今天，這件事背後可能代表什麼", text: guide.awareness || guide.summary, kind: "awareness" } : null,
        guide.selfSeen ? { kicker: "今天我看見的自己", text: guide.selfSeen, kind: "selfSeen" } : null,
        guide.direction ? { kicker: "今日帶走的一句話", text: guide.direction, kind: "direction" } : null,
        guide.takeaway ? { kicker: "今日帶走的一句話", text: guide.takeaway, kind: "takeaway" } : null,
      ].filter(Boolean);
  root.innerHTML = `
    <div class="think-choice-result aware-result">
      ${!v2 && guide.title ? renderConclusionCallout(guide.title, "think.title", "", fieldHighlightsOf(guide.highlights, "title")) : ""}
      ${sections
        .map(
          (item) => `<article class="aware-result__card">
        <p class="aware-result__kicker">${escapeHtml(item.kicker)}</p>
        ${markableP(item.text, `think.${item.kind}`, "aware-result__text", "", fieldHighlightsOf(guide.highlights, item.kind))}
      </article>`
        )
        .join("")}
    </div>
  `;
}

function execStepActionsHtml(actions, date) {
  const list = (Array.isArray(actions) ? actions : []).filter((item) => String(item && item.text ? item.text : item || "").trim());
  if (!list.length) return "";
  return `<div class="exec-step-list">${list
    .map((item, index) => {
      const chosen = String(item && item.text ? item.text : item || "").trim();
      const detail = String(item && item.detail ? item.detail : "").trim();
      const field = index === 0 ? "exec.smallestStep" : `exec.selected.${index}`;
      return `<div class="exec-step-list__item">
        <span class="exec-step-list__num">${String(index + 1).padStart(2, "0")}</span>
        <div class="exec-step-list__copy">
          ${markableP(chosen, field, "exec-step-list__text", date)}
          ${detail && detail !== chosen ? `<p class="exec-step-list__detail">${escapeHtml(detail)}</p>` : ""}
        </div>
      </div>`;
    })
    .join("")}</div>`;
}

function syncExecStepUi() {
  const wrap = document.querySelector("#section-exec .exec-next");
  const ta = document.getElementById("execNext");
  const result = document.getElementById("execStepResult");
  const hint = document.getElementById("execStepHint");
  const label = document.getElementById("execStepLabel");
  const checkBtn = document.getElementById("btnExecAi");
  if (!usesExecutionChoiceUi()) {
    if (wrap) wrap.hidden = false;
    if (label) label.textContent = "明天最小的一步";
    if (ta) ta.hidden = false;
    if (result) {
      result.hidden = true;
      result.innerHTML = "";
    }
    if (hint) {
      hint.hidden = false;
      hint.textContent = "不是完整計畫，只寫第一步。小到你明天幾乎沒有理由不開始。";
    }
    return;
  }
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  const customId = execChoiceCustomId();
  const actions = selectedExecutionChoiceActions(bag);
  const customOn = bag.selectedIds.includes(customId);
  if (!bag.selectedIds.length) {
    if (wrap) wrap.hidden = true;
    if (checkBtn) checkBtn.hidden = true;
    return;
  }
  if (wrap) wrap.hidden = false;
  if (label) label.textContent = "明天，我先做到這些";
  if (customOn) {
    if (ta) {
      ta.hidden = false;
      ta.placeholder = "例如：9:30 洗完澡後把手機放下，直接準備上床";
      if (ta.value !== (bag.custom || "")) ta.value = bag.custom || "";
    }
    if (hint) {
      hint.hidden = false;
      hint.textContent = "那你想為明天留下一個什麼小行動？";
    }
  } else {
    if (ta) {
      ta.hidden = true;
      if (ta.value !== (bag.custom || "")) ta.value = bag.custom || "";
    }
    if (hint) hint.hidden = true;
  }
  if (result) {
    result.hidden = !actions.length;
    result.innerHTML = actions.length ? execStepActionsHtml(actions) : "";
  }
  if (checkBtn) checkBtn.hidden = !actions.length;
}

function renderExecDeep(data) {
  const archived = isCurrentJournalArchived();
  const deep = normalizeExecDeep(data && data.deep);
  const loading = Boolean(state.choicesBusy?.executionDeep);
  const pending = execDeepCurrentQuestion(deep);
  const answered = execDeepAnsweredRounds(deep);
  const closed = execDeepClosed(deep);
  const past = answered
    .map(
      (item) => `
        <article class="exec-deep__done">
          <p class="exec-deep__q">${escapeHtml(item.question)}</p>
          <p class="exec-deep__a">${escapeHtml(item.answer)}</p>
        </article>`
    )
    .join("");
  if (loading && !pending && !closed) {
    return `<div class="exec-deep" id="execDeep">
      <p class="check-loading__label">正在整理今天的問題…</p>
      <div class="ai-thinking__bar"><i></i></div>
    </div>`;
  }
  if (pending) {
    return `<div class="exec-deep" id="execDeep">
      ${past}
      <p class="exec-deep__q">${escapeHtml(pending.question)}</p>
      <textarea class="textarea think-guide-answer" id="execDeepAnswer" rows="4" placeholder="${escapeHtml(pending.placeholder || "把此刻想到的寫下來就好")}" ${archived ? "readonly" : ""}>${escapeHtml(deep.draftAnswer || "")}</textarea>
      ${archived ? "" : `<button class="ai-check-btn" id="btnExecDeepNext" type="button" ${loading ? "disabled" : ""}>${loading ? "正在整理…" : "繼續"}</button>`}
    </div>`;
  }
  if (closed && !hasExecDeepFinal(deep)) {
    return `<div class="exec-deep" id="execDeep">
      ${past}
      <p class="check-loading__label">${loading ? "正在整理今天的下一步…" : "這次還沒整理好。"}</p>
      ${loading ? `<div class="ai-thinking__bar"><i></i></div>` : ""}
      ${archived || loading ? "" : `<button class="exec-deep__quiet" id="btnExecDeepFinal" type="button">再整理一次</button>`}
    </div>`;
  }
  if (closed) {
    return `<div class="exec-deep exec-deep--final" id="execDeep">
      ${past}
      <p class="exec-deep__label">深度思考完成</p>
    </div>`;
  }
  return `<div class="exec-deep" id="execDeep">
    <p class="exec-deep__label">想再想深一點？</p>
    ${archived ? "" : `<button class="exec-deep__quiet" id="btnExecDeep" type="button" ${loading ? "disabled" : ""}>深度思考</button>`}
  </div>`;
}

function renderExecutionChoices(bag) {
  if (usesExecutionV3Path()) {
    renderExecutionV3();
    return;
  }
  const root = document.getElementById("execQuestions");
  const empty = document.getElementById("execEmpty");
  const genBtn = document.getElementById("btnExecPrompts");
  const checkBtn = document.getElementById("btnExecAi");
  const cardCol = document.getElementById("execCardCol");
  const data = normalizeExecutionChoiceBag(bag || state.executionChoices);
  const loading = Boolean(state.choicesBusy?.execution);
  if (cardCol) cardCol.hidden = true;
  if (!root) return;
  if (!data.options.length && !data.followupQuestion) {
    root.innerHTML = "";
    if (empty) {
      empty.textContent = "寫完前面的看見後，再整理今天的下一步。";
      empty.hidden = loading;
    }
    if (genBtn) {
      genBtn.hidden = loading;
      genBtn.disabled = false;
      genBtn.classList.toggle("is-busy", false);
      genBtn.setAttribute("aria-busy", "false");
      genBtn.textContent = "整理今天的下一步";
    }
    if (checkBtn) checkBtn.hidden = true;
    syncExecStepUi();
    return;
  }
  if (empty) empty.hidden = true;
  if (genBtn) genBtn.hidden = true;
  if (data.followupQuestion && !data.options.length) {
    root.innerHTML = `
      <div class="aware-q exec-q">
        <p class="journal-core-q">${escapeHtml(data.followupQuestion)}</p>
        <textarea class="textarea" id="execFollowup" rows="3" placeholder="${escapeHtml(data.followupPlaceholder || "例如：睡前把手機放到床以外")}"></textarea>
        ${journalVoiceHintHtml()}
        <button class="ai-check-btn" id="btnExecChoiceFollow" type="button">整理明天的小行動</button>
      </div>
    `;
    if (checkBtn) checkBtn.hidden = true;
    syncExecStepUi();
    return;
  }
  const deep = normalizeExecDeep(data.deep);
  const showFinal = hasExecDeepFinal(deep);
  const customId = execChoiceCustomId();
  const list = showFinal ? deep.finalOptions : data.options.concat([{ id: customId, text: execChoiceCustomText(), custom: true }]);
  const selected = new Set(showFinal ? deep.finalSelectedIds : data.selectedIds);
  const choiceList = `
    <div class="choice-list" data-choice-kind="${showFinal ? "execution-final" : "execution"}" role="group" aria-label="選擇你想帶走的行動">
      ${list
        .map((item) => {
          const on = selected.has(item.id);
          return `
            <button type="button" class="choice-opt${on ? " is-on" : ""}${item.custom ? " choice-opt--none" : ""}" data-choice-id="${escapeHtml(item.id)}" data-choice-kind="${showFinal ? "execution-final" : "execution"}" role="checkbox" aria-checked="${on ? "true" : "false"}">
              <span class="choice-opt__row">
                <span class="choice-opt__box" aria-hidden="true"></span>
                <span class="choice-opt__copy">
                  <span class="choice-opt__text">${escapeHtml(item.text)}</span>
                  ${item.detail ? `<span class="choice-opt__detail">${escapeHtml(item.detail)}</span>` : ""}
                </span>
              </span>
            </button>
          `;
        })
        .join("")}
      <p class="choice-hint">勾選後會加入執行力。可以選 1～3 件。</p>
    </div>`;
  root.innerHTML = showFinal
    ? `${renderExecDeep(data)}
        <article class="exec-summary">
          <p class="exec-summary__label">執行力總結</p>
          <p class="exec-summary__text">${escapeHtml(deep.executionSummary)}</p>
        </article>
        <p class="journal-label" id="execFinalLabel">接下來可以這樣做</p>
        ${choiceList}`
    : `${choiceList}${renderExecDeep(data)}`;
  paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.execution);
  if (checkBtn) checkBtn.hidden = true;
  syncExecStepUi();
}

function toggleJournalChoice(kind, id) {
  if (rejectArchivedJournalWrite()) return kind === "execution" ? normalizeExecutionChoiceBag(state.executionChoices) : normalizeChoiceBag(state[kind === "think" ? "thinkChoices" : "awarenessChoices"]);
  if (kind === "execution") {
    const bag = normalizeExecutionChoiceBag(state.executionChoices);
    const customId = execChoiceCustomId();
    const max = execChoiceMaxSelected();
    const deep = normalizeExecDeep(bag.deep);
    if (hasExecDeepFinal(deep) && deep.finalOptions.some((item) => item.id === id)) {
      const selectedIds = Array.isArray(deep.finalSelectedIds) ? deep.finalSelectedIds.slice() : [];
      const has = selectedIds.includes(id);
      if (has) deep.finalSelectedIds = selectedIds.filter((item) => item !== id);
      else {
        if (selectedIds.length >= max) {
          showToast("明天先留 3 件就好。");
          return bag;
        }
        deep.finalSelectedIds = selectedIds.concat(id);
        trackProduct("execution_choice_selected", { source: "journal", mode: "deep", variant: "final" });
      }
      bag.deep = deep;
      const next = serializeExecutionChoiceBag(bag);
      state.executionChoices = next;
      renderExecutionChoices(next);
      if (!has) syncSelectedExecutionToSidebar(next);
      persistJournalQuietly();
      return next;
    }
    if (!id || (id !== customId && !bag.options.some((item) => item.id === id))) return bag;
    const selectedIds = Array.isArray(bag.selectedIds) ? bag.selectedIds.slice() : [];
    const has = selectedIds.includes(id);
    if (has) {
      bag.selectedIds = selectedIds.filter((item) => item !== id);
    } else {
      if (selectedIds.length >= max) {
        showToast("明天先留 3 件就好。");
        return bag;
      }
      bag.selectedIds = selectedIds.concat(id);
      if (id === customId) trackProduct("execution_custom_selected", { source: "journal", mode: "deep" });
      else trackProduct("execution_choice_selected", { source: "journal", mode: "deep" });
    }
    bag.selectedId = bag.selectedIds[0] || "";
    const next = serializeExecutionChoiceBag(bag);
    state.executionChoices = next;
    renderExecutionChoices(next);
    if (!has) syncSelectedExecutionToSidebar(next);
    persistJournalQuietly();
    return next;
  }
  const key = kind === "think" ? "thinkChoices" : "awarenessChoices";
  const bag = normalizeChoiceBag(state[key]);
  const noneId = choiceNoneId();
  const max = choiceMaxSelected();
  if (id === noneId) {
    bag.none = !bag.none;
    bag.selectedIds = [];
  } else {
    const has = bag.selectedIds.includes(id);
    if (has) bag.selectedIds = bag.selectedIds.filter((item) => item !== id);
    else {
      if (bag.selectedIds.length >= max) {
        showToast("最多選 2 個就好。");
        return bag;
      }
      bag.selectedIds = bag.selectedIds.concat(id);
    }
    bag.none = false;
  }
  const next = serializeChoiceBag(bag);
  state[key] = next;
  if (kind === "think") {
    renderThinkChoices(next);
    persistJournalQuietly();
    syncThinkChoiceGate();
  } else {
    renderAwarenessChoices(next);
    persistJournalQuietly();
    syncAwareQuoteGate();
  }
  return next;
}

function syncSelectedExecutionToSidebar(bag) {
  const actions = selectedExecutionChoiceActions(bag);
  const items = passthroughExecChoiceCheckItems(actions);
  const iso = currentIso();
  const tasks = typeof getTasks === "function" ? getTasks() : [];
  const lookSimilar = typeof reviewMergeApi().choicesLookSimilar === "function" ? reviewMergeApi().choicesLookSimilar.bind(reviewMergeApi()) : () => false;
  addExecutionCheckItemsToSidebar(
    items.filter((item) => !tasks.some((task) => task && task.date === iso && lookSimilar(String(task.title || ""), item.title)))
  );
}

function setChoicesLoading(kind, loading) {
  if (!state.choicesBusy) state.choicesBusy = { awareness: false, think: false, execution: false, executionDeep: false, awarenessCue: false, thinkExt: false };
  state.choicesBusy[kind] = loading;
  if (kind === "awareness") {
    if (usesAwarenessV3Path()) {
      renderAwarenessV3();
    } else {
      const loader = document.getElementById("awarePromptLoading");
      if (loader) loader.hidden = !loading;
      renderAwarenessChoices(state.awarenessChoices);
    }
  } else if (kind === "think") {
    const loader = document.getElementById("deepPromptLoading");
    if (loader) loader.hidden = !loading;
    renderThinkSection();
  } else if (kind === "execution" || kind === "executionDeep") {
    if (usesExecutionV3Path()) {
      renderExecutionV3();
    } else {
      const loader = document.getElementById("execPromptLoading");
      if (loader && kind === "execution") loader.hidden = !loading;
      renderExecutionChoices(state.executionChoices);
      syncCorePromptGate();
    }
  }
}

function syncThinkChoiceGate() {
  const btn = document.getElementById("btnThinkClose");
  const closeLoader = document.getElementById("thinkCloseLoading");
  if (!btn) return;
  const bag = normalizeChoiceBag(state.thinkChoices);
  const guide = normalizeInsight(state.journalInsight).guide || emptyThinkGuide();
  const hasClose = Boolean(guide.awareness || guide.summary || guide.selfSeen || guide.takeaway);
  const loading = Boolean(state.choicesBusy?.thinkClose);
  const show = bag.options.length > 0 && (!hasClose || loading);
  btn.hidden = !(show || loading);
  btn.disabled = !bag.options.length || loading;
  btn.classList.toggle("is-busy", loading);
  btn.textContent = loading ? "正在整理…" : "✦ 整理今天的深度看見";
  if (closeLoader) closeLoader.hidden = !loading;
}

function localAwarenessChoiceFallbacks(journal, avoid) {
  const event = String(journal?.event || "").trim();
  const thanks = thanksTextFrom(journal);
  const mood = String(journal?.mood || "").trim();
  const options = [];
  if (/放在心上|辛苦了|主動|關心|煮|晚餐|記得/.test(`${thanks} ${event}`)) {
    options.push({ id: "a1", text: "當別人主動表達在乎時，我會特別有感" });
    options.push({ id: "a2", text: "我真正被碰到的，可能不是事情本身，而是有人把我放在心上" });
  }
  if (/珍惜|擔心|怕|來不及|平常/.test(`${thanks} ${event}`)) {
    options.push({ id: "a3", text: "我在感動之後，很容易接著擔心自己是不是不夠珍惜" });
  }
  if (/女兒|陪伴|看書|日常/.test(`${thanks} ${event}`)) {
    options.push({ id: "a4", text: "我開始發現，自己珍惜的是關係裡那些很小、很日常的陪伴" });
  }
  if (mood && options.length < 3) {
    options.push({ id: "a5", text: `今天的心情偏「${mood}」，我好像比平常更在意當下被碰到的感覺` });
  }
  if (options.length < 3) {
    options.push({ id: "a6", text: "今天真正碰到我的，可能不是事情本身，而是當下被對待的感覺" });
    options.push({ id: "a7", text: "我好像比自己以為的，更在意有沒有被放在心上" });
    options.push({ id: "a8", text: "我現在的反應裡，可能同時有感動，也有一點緊" });
  }
  return reviewMergeApi().normalizeChoiceOptions
    ? reviewMergeApi().normalizeChoiceOptions(options, { avoid, max: 4 })
    : options.slice(0, 4);
}

function localThinkChoiceFallbacks(journal, avoid) {
  const event = String(journal?.event || "").trim();
  const thanks = thanksTextFrom(journal);
  const options = [];
  if (/珍惜|擔心|怕|來不及/.test(`${thanks} ${event}`)) {
    options.push({ id: "t1", text: "我害怕的可能不是失去，而是來不及好好珍惜" });
  }
  if (/關係|陪伴|晚餐|女兒|老公|愛/.test(`${thanks} ${event}`)) {
    options.push({ id: "t2", text: "有些關係的重要，不需要等到失去才被看見" });
    options.push({ id: "t3", text: "我真正想留下的，也許不是某個結果，而是彼此有好好在一起的感覺" });
  }
  options.push({ id: "t4", text: "我正在從「等別人表達愛」，慢慢變成「自己也能停下來感受愛」" });
  const api = reviewMergeApi();
  if (typeof api.normalizeChoiceOptions === "function") {
    return api.normalizeChoiceOptions(options, { avoid, max: 4 });
  }
  return options.slice(0, 4);
}

function thinkBitsFrom(journal) {
  const bag = normalizeChoiceBag((journal && journal.thinkChoices) || state.thinkChoices);
  const insight = (journal && journal.insight && typeof journal.insight === "object" ? journal.insight : null) || state.journalInsight || {};
  const guide = normalizeThinkGuide(insight.guide);
  const isV2 = String(guide.variant || "") === "think-v2";
  const isV3 = String(guide.variant || "") === "reflection-v3";
  const v2Answers = (Array.isArray(guide.rounds) ? guide.rounds : [])
    .map((item) => String(item && item.answer || "").trim())
    .filter(Boolean)
    .slice(-2);
  return {
    bag,
    selected: isV2 ? v2Answers : selectedChoiceTexts(bag),
    none: isV2 ? false : Boolean(bag.none),
    options: isV2 ? [] : bag.options.map((item) => String(item.text || "").trim()).filter(Boolean),
    title: String(guide.title || insight.title || "").trim(),
    awareness: String((guide.close && guide.close.coreConclusion) || guide.coreQuote || guide.awareness || guide.summary || "").trim(),
    selfSeen: String(guide.selfSeen || "").trim(),
    takeaway: String(guide.takeaway || "").trim(),
    direction: String((guide.close && guide.close.improvementDirection) || guide.direction || "").trim(),
    coreConclusion: String((guide.close && guide.close.coreConclusion) || guide.coreQuote || guide.awareness || guide.summary || "").trim(),
    blindSpot: String((guide.close && guide.close.blindSpot) || "").trim(),
    improvementDirection: String((guide.close && guide.close.improvementDirection) || guide.direction || "").trim(),
    thinkVariant: isV2 ? "think-v2" : isV3 ? "reflection-v3" : "",
    coreQuote: String(guide.coreQuote || (guide.discovery && guide.discovery.statement) || "").trim(),
    questions: Array.isArray(guide.questions) ? guide.questions : [],
    status: String(guide.status || "").trim(),
    discovery: guide.discovery && typeof guide.discovery === "object" ? guide.discovery : null,
  };
}

function awarenessBitsFrom(journal) {
  const bag = normalizeChoiceBag((journal && journal.awarenessChoices) || state.awarenessChoices);
  const result = normalizeAwarenessResult((journal && journal.awarenessResult) || state.journalAwarenessResult, { keepSource: true });
  const v3 = normalizeAwarenessV3Bag((journal && journal.awarenessV3) || state.journalAwarenessV3);
  const v3Selected = selectedAwarenessV3Texts(v3);
  return {
    bag,
    selected: v3Selected.length ? v3Selected : selectedChoiceTexts(bag),
    none: Boolean(bag.none),
    line: String(result.line || v3Selected[0] || "").trim(),
    seen: String(result.seen || v3Selected.slice(1).join(" ") || "").trim(),
    items: v3.items,
    selectedIds: v3.selectedIds,
    growVariant: v3.growVariant || "",
    status: v3.status || "",
    awarenessVariant: v3.items.length ? "awareness-v3" : "",
  };
}

function priorThinkAwareContext(journal) {
  const think = thinkBitsFrom(journal);
  const aware = awarenessBitsFrom(journal);
  return {
    thinkSelected: think.selected,
    thinkNone: think.none,
    thinkOptions: think.options,
    thinkCloseTitle: think.title,
    thinkCloseAwareness: think.awareness,
    thinkCloseSelfSeen: think.selfSeen,
    thinkCloseTakeaway: think.takeaway,
    thinkCloseDirection: think.direction,
    thinkCloseCore: think.coreConclusion,
    thinkCloseBlindSpot: think.blindSpot,
    thinkCloseImprovement: think.improvementDirection,
    thinkVariant: think.thinkVariant,
    thinkCoreQuote: think.coreQuote,
    thinkQuestions: think.questions,
    awarenessSelected: aware.selected,
    awarenessNone: aware.none,
    awarenessLine: aware.line,
    awarenessSeen: aware.seen,
    awarenessItems: aware.items || [],
    awarenessSelectedIds: aware.selectedIds || [],
    awarenessVariant: aware.awarenessVariant || "",
  };
}

function choicesContext(journal, extra = {}) {
  return {
    thanks: thanksTextFrom(journal),
    thanksText: thanksTextFrom(journal),
    event: journal.event,
    mood: journal.mood,
    bodyTags: journal.bodyTags,
    bodyNote: journal.bodyNote,
    bodyCheck: journal.bodyCheck,
    bodyMindText: journal.bodyMind && journal.bodyMind.text,
    bodyMindInsight: journal.bodyMind && journal.bodyMind.insight,
    ...extra,
  };
}

async function generateAwarenessChoices(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  pinAwareFold();
  if (!ensurePlusFeature("awareness_ai", options)) return;
  if (state.choicesBusy?.awareness) {
    if (!options.auto) showToast("還在為你整理今天的覺察選項，請稍候。");
    return;
  }
  const journal = collectJournal();
  if (!coreStoryReady(journal)) {
    if (!options.auto) showToast("請先寫下今日感謝、事件，並選擇心情。");
    return;
  }
  const token = (state.choicesToken.awareness || 0) + 1;
  state.choicesToken.awareness = token;
  setChoicesLoading("awareness", true);
  const think = thinkBitsFrom(journal);
  const avoid = [...think.options, ...think.selected];
  const fallback = localAwarenessChoiceFallbacks(journal, avoid);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const remote = await postReview({
      mode: "choices",
      kind: "awareness",
      date: currentIso(),
      text: journal.event,
      avoid,
      context: choicesContext(journal, {
        avoid,
        thinkSelected: think.selected,
        thinkNone: think.none,
        thinkOptions: think.options,
        thinkCloseTitle: think.title,
        thinkCloseAwareness: think.awareness,
        thinkCloseSelfSeen: think.selfSeen,
        thinkCloseTakeaway: think.takeaway,
        thinkCloseDirection: think.direction,
        thinkCloseCore: think.coreConclusion,
        thinkCloseBlindSpot: think.blindSpot,
        thinkCloseImprovement: think.improvementDirection,
        thinkVariant: think.thinkVariant,
      }),
      progress: { streak: collectGrowthProgress().streak },
    });
    if (state.choicesToken.awareness !== token) return;
    const optionsList = normalizeChoiceBag({ options: remote.options }, { avoid }).options;
    if (optionsList.length < 3) throw new Error("今天的覺察選項還沒準備好，請再試一次。");
    state.awarenessChoices = serializeChoiceBag({
      sourceSig: `${thanksTextFrom(journal)}\n${journal.event}\n${journal.mood}`,
      options: optionsList.slice(0, 4),
      selectedIds: [],
      generatedAt: new Date().toISOString(),
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.awareness = takeInternalDebug(remote);
    renderAwarenessChoices(state.awarenessChoices);
    persistJournalQuietly();
    if (!options.auto) showToast("今天的覺察選項已經準備好了。");
  } catch (error) {
    if (state.choicesToken.awareness !== token) return;
    if (isPlusRequiredError(error)) return;
    if (fallback.length >= 3) {
      state.awarenessChoices = serializeChoiceBag({
        sourceSig: `${thanksTextFrom(journal)}\n${journal.event}\n${journal.mood}`,
        options: fallback.slice(0, 4),
        selectedIds: [],
        generatedAt: new Date().toISOString(),
      });
      renderAwarenessChoices(state.awarenessChoices);
      persistJournalQuietly();
      if (!options.auto) showToast(`雲端選項還沒好：${formatApiError(error)}，先用本地整理。`);
    } else if (!options.auto) {
      showToast("這次覺察選項沒有完整生成，請再試一次。");
    }
  } finally {
    if (state.choicesToken.awareness === token) setChoicesLoading("awareness", false);
  }
}

async function generateThinkChoices(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  setJournalFoldOpen("section-deep", true, { manual: true });
  if (!ensurePlusFeature("think_ai", options)) return;
  if (state.choicesBusy?.think) {
    if (!options.auto) showToast("還在為你整理今天的深度選項，請稍候。");
    return;
  }
  const journal = collectJournal();
  if (!coreStoryReady(journal)) {
    if (!options.auto) showToast("請先寫下今日感謝、事件，並選擇心情。");
    return;
  }
  const token = (state.choicesToken.think || 0) + 1;
  state.choicesToken.think = token;
  setChoicesLoading("think", true);
  const fallback = localThinkChoiceFallbacks(journal, []);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const remote = await postReview({
      mode: "choices",
      kind: "think",
      date: currentIso(),
      text: journal.event,
      context: choicesContext(journal),
      progress: { streak: collectGrowthProgress().streak },
    });
    if (state.choicesToken.think !== token) return;
    const optionsList = normalizeChoiceBag({ options: remote.options }).options;
    if (optionsList.length < 3) throw new Error("今天的深度選項還沒準備好，請再試一次。");
    state.thinkChoices = serializeChoiceBag({
      sourceSig: `${thanksTextFrom(journal)}\n${journal.event}\n${journal.mood}`,
      options: optionsList.slice(0, 4),
      selectedIds: [],
      generatedAt: new Date().toISOString(),
    });
    renderThinkChoices(state.thinkChoices);
    persistJournalQuietly();
    if (!options.auto) showToast("今天的深度選項已經準備好了。");
  } catch (error) {
    if (state.choicesToken.think !== token) return;
    if (isPlusRequiredError(error)) return;
    if (fallback.length >= 3) {
      state.thinkChoices = serializeChoiceBag({
        sourceSig: `${thanksTextFrom(journal)}\n${journal.event}\n${journal.mood}`,
        options: fallback.slice(0, 4),
        selectedIds: [],
        generatedAt: new Date().toISOString(),
      });
      renderThinkChoices(state.thinkChoices);
      persistJournalQuietly();
      if (!options.auto) showToast(`雲端選項還沒好：${formatApiError(error)}，先用本地整理。`);
    } else if (!options.auto) {
      showToast("這次深度選項沒有完整生成，請再試一次。");
    }
  } finally {
    if (state.choicesToken.think === token) setChoicesLoading("think", false);
  }
}

async function generateThinkChoicesClose(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  setJournalFoldOpen("section-deep", true, { manual: true });
  const bag = normalizeChoiceBag(state.thinkChoices);
  if (!bag.options.length) {
    if (!options.auto) showToast("先產生今天的深度選項。");
    return;
  }
  if (!ensurePlusFeature("think_ai", options)) return;
  if (state.choicesBusy?.thinkClose) {
    if (!options.auto) showToast("還在為你整理今天的深度看見，請稍候。");
    return;
  }
  const journal = collectJournal();
  const token = (state.choicesToken.thinkClose || 0) + 1;
  state.choicesToken.thinkClose = token;
  state.choicesBusy.thinkClose = true;
  syncThinkChoiceGate();
  const selected = selectedChoiceTexts(bag);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端分析。");
    const remote = await postReview({
      mode: "choices",
      kind: "think-close",
      date: currentIso(),
      text: journal.event,
      selected,
      none: Boolean(bag.none),
      context: { ...choicesContext(journal), selected, none: Boolean(bag.none) },
    });
    if (state.choicesToken.thinkClose !== token) return;
    const closed = {
      title: String(remote.title || "").trim(),
      summary: String(remote.awareness || remote.summary || "").trim(),
      awareness: String(remote.awareness || remote.summary || "").trim(),
      selfSeen: String(remote.selfSeen || "").trim(),
      takeaway: String(remote.takeaway || "").trim(),
      highlights: remote.highlights && typeof remote.highlights === "object" ? remote.highlights : {},
    };
    if (!closed.awareness && !closed.summary) throw new Error("今日深度看見還沒整理好，請再試一次。");
    applyThinkChoicesClose(closed);
    if (!options.auto) showToast("今天的深度看見，已經整理好了。");
  } catch (error) {
    if (state.choicesToken.thinkClose !== token) return;
    if (isPlusRequiredError(error)) return;
    applyThinkChoicesClose(localThinkChoicesClose(journal, bag));
    if (!options.auto) showToast(`雲端整理失敗：${formatApiError(error)}，先用本地整理。`);
  } finally {
    if (state.choicesToken.thinkClose === token) {
      state.choicesBusy.thinkClose = false;
      syncThinkChoiceGate();
    }
  }
}

function thinkV2AnsweredRounds(guide) {
  return (normalizeThinkGuide(guide).rounds || []).filter(
    (item) => String(item.question || "").trim() && String(item.answer || "").trim()
  );
}

function thinkV2CurrentQuestion(guide) {
  return (normalizeThinkGuide(guide).rounds || []).find(
    (item) => String(item.question || "").trim() && !String(item.answer || "").trim()
  ) || null;
}

function reflectionV3Context(journal) {
  const data = journal || collectJournal();
  const mind = normalizeBodyMind(data.bodyMind);
  return {
    thanksText: thanksTextFrom(data),
    thanks: thanksTextFrom(data),
    event: String(data.event || "").trim(),
    mood: String(data.mood || "").trim(),
    bodyMindText: mind.text,
    bodyNote: mind.text || String(data.bodyNote || "").trim(),
    bodyMindInsight: mind.insight,
    bodyMindSupport: mind.support,
  };
}

function reflectionV3SourceSig(journal) {
  const ctx = reflectionV3Context(journal);
  return [
    String(ctx.thanksText || "").replace(/\s+/g, " ").trim(),
    String(ctx.event || "").replace(/\s+/g, " ").trim(),
    String(ctx.mood || "").trim(),
    String(ctx.bodyMindText || "").replace(/\s+/g, " ").trim(),
  ].join("\n");
}

function reflectionV3Ready(journal) {
  const ctx = reflectionV3Context(journal);
  return Boolean(
    thanksFilled(journal || collectJournal()) &&
      String(ctx.event || "").trim() &&
      ctx.mood &&
      bodyMindTextReady(ctx.bodyMindText)
  );
}

function thinkGuideIsSilence(guide) {
  const data = normalizeThinkGuide(guide);
  if (data.variant !== "reflection-v3") return false;
  if (data.status === "silence") return true;
  if (data.understand && data.understand.stage === "stop" && !data.coreQuote) return true;
  return data.status === "empty" && !data.coreQuote && !(data.discovery && data.discovery.statement);
}

function thinkGuideHas04Result(guide) {
  const data = normalizeThinkGuide(guide);
  if (data.variant !== "reflection-v3" || !data.sourceSig) return false;
  return Boolean(
    data.coreQuote ||
      data.status === "empty" ||
      data.status === "silence" ||
      data.status === "discovery" ||
      data.status === "understand" ||
      (data.questions && data.questions.length >= 1) ||
      (data.discovery && data.discovery.statement) ||
      isUnderstandGuide(data)
  );
}

function reflectionV3Stale(guide, journal) {
  const data = normalizeThinkGuide(guide);
  if (data.variant !== "reflection-v3" || !data.sourceSig) return false;
  if (!(data.coreQuote || data.status === "empty" || data.status === "silence" || data.status === "understand" || data.questions.length >= 1 || (data.discovery && data.discovery.statement) || isUnderstandGuide(data))) return false;
  return data.sourceSig !== reflectionV3SourceSig(journal);
}

function showThinkV3Hint(message) {
  const hint = document.getElementById("thinkV3Hint");
  if (!hint) return;
  const text = String(message || "").trim();
  hint.textContent = text;
  hint.hidden = !text || isCurrentJournalArchived();
}

function lockNewDayThinkUi() {
  const v3 = usesReflectionV3Path();
  const card = document.getElementById("thinkV3Card");
  if (card) card.hidden = !v3;
  document.querySelectorAll("#section-deep .js-legacy-think-ui").forEach((node) => {
    node.hidden = v3;
  });
  if (v3) {
    ["thinkEmpty", "btnThinkChoices", "btnThinkClose", "btnDeepMore", "deepList", "thinkCloseLoading", "thinkQuestions", "deepPromptLoading"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.hidden = true;
    });
    const questions = document.getElementById("thinkQuestions");
    if (questions) questions.innerHTML = "";
    const result = document.getElementById("thinkChoiceResult");
    if (result) result.innerHTML = "";
  }
}

function syncThinkV3Cta() {
  lockNewDayThinkUi();
  const btn = document.getElementById("btnReflectionV3");
  if (!btn) return;
  const archived = isCurrentJournalArchived();
  const ready = reflectionV3Ready();
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  const hasResult = thinkGuideHas04Result(guide);
  const stale = hasResult && reflectionV3Stale(guide);
  const show = usesReflectionV3Path() && !archived && (!hasResult || stale);
  btn.hidden = !show;
  btn.disabled = Boolean(state.choicesBusy?.think) || archived || !ready;
  btn.textContent = stale ? "前面的內容有修改，重新看看 →" : "看看今天真正值得想的是什麼 →";
  if (!ready && show) showThinkV3Hint("先把今日感謝、事件、心情和身心覺察寫下來。");
  else if (ready) showThinkV3Hint("");
}

function applyReflectionV3Guide(patch) {
  const insight = normalizeInsight(state.journalInsight);
  const next = { ...(insight.guide || emptyThinkGuide()), ...patch, variant: "reflection-v3" };
  insight.guide = normalizeThinkGuide(next);
  if (next.coreQuote && next.status !== "silence") {
    insight.title = insight.title || "今日發現";
    insight.conclusion = next.coreQuote;
    insight.psychology = next.coreQuote;
  }
  state.journalInsight = insight;
  return insight;
}

function renderThinkV3() {
  lockNewDayThinkUi();
  const root = document.getElementById("thinkV3Result");
  const loader = document.getElementById("thinkV3Loading");
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  const loading = Boolean(state.choicesBusy?.think);
  if (loader) loader.hidden = !loading;
  syncThinkV3Cta();
  syncAwareV3Cta();
  syncExecV3Cta();
  if (!root) return;
  if (loading || !thinkGuideHas04Result(guide)) {
    if (!loading) root.innerHTML = "";
    renderThinkExtension();
    return;
  }
  if (thinkGuideIsSilence(guide)) {
    const understandStop = isUnderstandGuide(guide);
    root.innerHTML = `
    <article class="think-v3-result">
      <p class="think-v3-kicker">${understandStop ? "這次我想陪你看的是" : "今天有什麼是你可能還沒看見的？"}</p>
      <div class="think-v3-quote think-v3-quote--silence">
        <p class="think-v3-quote__text">${understandStop ? "今天這件事，你其實已經想得滿清楚了。" : "今天沒有一定要再解讀的地方。"}</p>
        <p class="think-v3-why">${understandStop ? "沒有一定要再往下挖的地方，先這樣就很好。" : "有些日子，好好經歷與記下來，就已經足夠了。"}</p>
      </div>
    </article>`;
    paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.think);
    renderThinkExtension();
    return;
  }
  if (isUnderstandGuide(guide)) {
    root.innerHTML = renderUnderstandV3(guide);
    paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.think);
    renderThinkExtension();
    return;
  }
  const discovery = guide.discovery && typeof guide.discovery === "object" ? guide.discovery : null;
  const statement = String((discovery && discovery.statement) || guide.coreQuote || "").trim();
  const why = String((discovery && discovery.why) || "").trim();
  const question = String((discovery && discovery.question) || ((guide.questions || [])[0] && (guide.questions[0].question || "")) || "").trim();
  root.innerHTML = `
    <article class="think-v3-result">
      <p class="think-v3-kicker">今天有什麼是你可能還沒看見的？</p>
      <div class="think-v3-quote">
        <p class="think-v3-quote__label">我注意到一件事</p>
        ${markableP(statement, "think.coreQuote", "think-v3-quote__text")}
      </div>
      ${why ? `<p class="think-v3-why-label">我為什麼這樣看</p><p class="think-v3-why">${escapeHtml(why)}</p>` : ""}
      ${question ? `<div class="think-v3-list">
        <p class="think-v3-list__label">如果你想再往下看</p>
        ${markableP(question, `think.question.${(guide.questions[0] && guide.questions[0].id) || "q1"}`, "think-v3-q__text")}
      </div>` : ""}
    </article>`;
  paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.think);
  renderThinkExtension();
}

function renderUnderstandV3(guide) {
  const bag = (guide && guide.understand) || {};
  const archived = isCurrentJournalArchived();
  const focus = String(bag.focus || guide.coreQuote || "").trim();
  const why = String(bag.whyWorthThinking || "").trim();
  const pastNote = String(bag.pastNote || "").trim();
  const stage = String(bag.stage || "");
  const liveQuestion = stage === "asked2" ? String(bag.question2 || "").trim() : String(bag.question || "").trim();
  const shownAnswer = String(bag.answer || "").trim();
  const shownAnswer2 = String(bag.answer2 || "").trim();
  const convergence = String(bag.convergence || "").trim();
  const waiting = (stage === "asked1" || stage === "asked2") && liveQuestion && !archived;
  const draft = String(bag.draftAnswer || "").trim();
  return `
    <article class="think-v3-result think-v3-result--understand">
      <p class="think-v3-kicker">這次我想陪你看的是</p>
      <div class="think-v3-quote">
        ${markableP(focus, "think.coreQuote", "think-v3-quote__text")}
      </div>
      ${why ? `<p class="think-v3-why">${escapeHtml(why)}</p>` : ""}
      ${pastNote ? `<p class="think-v3-past">${escapeHtml(pastNote)}</p>` : ""}
      ${shownAnswer ? `<p class="think-v3-user-answer">${escapeHtml(shownAnswer)}</p>` : ""}
      ${shownAnswer2 ? `<p class="think-v3-user-answer">${escapeHtml(shownAnswer2)}</p>` : ""}
      ${waiting ? `<div class="think-v3-ask">
        <p class="think-v3-list__label">想留一個問題給你</p>
        ${markableP(liveQuestion, `think.question.${stage === "asked2" ? "q2" : "q1"}`, "think-v3-q__text")}
        <label class="think-ext-answer-label" for="thinkUnderstandAnswer">寫下你現在想到的。</label>
        <textarea class="textarea think-ext-answer" id="thinkUnderstandAnswer" rows="4">${escapeHtml(draft)}</textarea>
        <button class="body-mind-cta think-v3-answer-cta" id="btnUnderstandAnswer" type="button">回覆後再想想 →</button>
      </div>` : ""}
      ${convergence ? `<div class="think-v3-converge">
        <p class="think-v3-list__label">這次你真正看見的</p>
        ${markableP(convergence, "think.convergence", "think-v3-quote__text")}
      </div>` : ""}
    </article>`;
}

async function generateReflectionV3(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.choicesBusy?.think) return;
  setJournalFoldOpen("section-deep", true, { manual: true });
  const journal = collectJournal();
  if (!reflectionV3Ready(journal)) {
    showThinkV3Hint("先把今日感謝、事件、心情和身心覺察寫下來。");
    syncThinkV3Cta();
    return;
  }
  if (!ensurePlusFeature("think_ai", options)) return;
  const sig = reflectionV3SourceSig(journal);
  const current = normalizeThinkGuide((state.journalInsight || {}).guide);
  if (current.variant === "reflection-v3" && current.sourceSig === sig && thinkGuideHas04Result(current) && !options.force) {
    renderThinkV3();
    return;
  }
  const token = (state.choicesToken.think || 0) + 1;
  state.choicesToken.think = token;
  state.choicesBusy.think = true;
  setChoicesLoading("think", true);
  renderThinkV3();
  try {
    if (!state.user) throw new Error("請先登入，才能整理今天的深度思考。");
    const ctx = reflectionV3Context(journal);
    const remote = await postReview({
      mode: "insight",
      variant: "reflection-v3",
      date: currentIso(),
      text: ctx.event,
      context: {
        variant: "reflection-v3",
        ...ctx,
      },
    });
    if (state.choicesToken.think !== token) return;
    const latest = collectJournal();
    const latestSig = reflectionV3SourceSig(latest);
    const coreQuote = String(remote.coreQuote || (remote.discovery && remote.discovery.statement) || "").replace(/\s+/g, " ").trim();
    const questions = mapInsightQuestionItems(
      Array.isArray(remote.items) && remote.items.length ? remote.items : remote.questions,
      "q"
    );
    if (remote && (remote.status === "empty" || remote.status === "silence" || (!remote.understand && !remote.discovery && !coreQuote))) {
      applyReflectionV3Guide({
        status: "silence",
        sourceSig: sig,
        coreQuote: "",
        questions: [],
        discovery: null,
        understand: remote.understand || { variant: "understand-v1", stage: "stop" },
        knownByUser: Array.isArray(remote.knownByUser) ? remote.knownByUser : [],
        generatedAt: new Date().toISOString(),
      });
      persistJournalQuietly();
      renderThinkV3();
      return;
    }
    if (!coreQuote && !(remote.understand && remote.understand.stage === "stop")) throw new Error("今天的深度思考還沒整理好，請再試一次。");
    applyReflectionV3Guide({
      status: remote.status === "understand" ? "understand" : remote.understand ? "understand" : "discovery",
      sourceSig: sig,
      coreQuote,
      questions,
      discovery: remote.discovery,
      understand: remote.understand || null,
      knownByUser: Array.isArray(remote.knownByUser) ? remote.knownByUser : [],
      generatedAt: new Date().toISOString(),
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.think = takeInternalDebug(remote);
    persistJournalQuietly();
    renderThinkV3();
    if (latestSig !== sig) syncThinkV3Cta();
  } catch (error) {
    if (state.choicesToken.think !== token) return;
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "今天的深度思考還沒整理好，請再試一次。");
    renderThinkV3();
  } finally {
    if (state.choicesToken.think === token) {
      state.choicesBusy.think = false;
      setChoicesLoading("think", false);
      renderThinkV3();
    }
  }
}

function flushUnderstandAnswer() {
  const ta = document.getElementById("thinkUnderstandAnswer");
  if (!ta) return normalizeThinkGuide((state.journalInsight || {}).guide);
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  if (!guide.understand) return guide;
  applyReflectionV3Guide({
    ...guide,
    understand: { ...guide.understand, draftAnswer: String(ta.value || "") },
  });
  return normalizeThinkGuide((state.journalInsight || {}).guide);
}

async function generateUnderstandAnswer(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.choicesBusy?.think) return;
  const journal = collectJournal();
  const guide = flushUnderstandAnswer();
  const bag = guide.understand || {};
  const answer = String(bag.draftAnswer || "").trim();
  if (answer.replace(/\s+/g, "").length < 4) {
    showThinkV3Hint("先寫下一點你現在想到的。");
    return;
  }
  if (!ensurePlusFeature("think_ai", options)) return;
  const token = (state.choicesToken.think || 0) + 1;
  state.choicesToken.think = token;
  state.choicesBusy.think = true;
  setChoicesLoading("think", true);
  renderThinkV3();
  try {
    if (!state.user) throw new Error("請先登入，才能繼續今天的深度思考。");
    const ctx = reflectionV3Context(journal);
    const remote = await postReview({
      mode: "insight",
      variant: "reflection-v3",
      step: "understand-answer",
      date: currentIso(),
      text: ctx.event,
      context: {
        variant: "reflection-v3",
        understandStep: "answer",
        ...ctx,
        userAnswer: answer,
        understand: bag,
      },
    });
    if (state.choicesToken.think !== token) return;
    const coreQuote = String(remote.coreQuote || (remote.understand && remote.understand.convergence) || (remote.understand && remote.understand.focus) || "").replace(/\s+/g, " ").trim();
    const questions = mapInsightQuestionItems(
      Array.isArray(remote.items) && remote.items.length ? remote.items : remote.questions,
      "q"
    );
    applyReflectionV3Guide({
      status: remote.status || "understand",
      sourceSig: guide.sourceSig || reflectionV3SourceSig(journal),
      coreQuote: coreQuote || guide.coreQuote,
      questions,
      discovery: remote.discovery,
      understand: remote.understand || bag,
      knownByUser: Array.isArray(remote.knownByUser) ? remote.knownByUser : guide.knownByUser,
      generatedAt: new Date().toISOString(),
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.think = takeInternalDebug(remote);
    persistJournalQuietly();
    renderThinkV3();
  } catch (error) {
    if (state.choicesToken.think !== token) return;
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "這次的思考還沒整理好，請再試一次。");
    renderThinkV3();
  } finally {
    if (state.choicesToken.think === token) {
      state.choicesBusy.think = false;
      setChoicesLoading("think", false);
      renderThinkV3();
    }
  }
}

function normalizeReflectionExtension(raw) {
  const api = reviewMergeApi();
  if (typeof api.normalizeReflectionExtension === "function") return api.normalizeReflectionExtension(raw);
  const src = raw && typeof raw === "object" ? raw : {};
  const rounds = (Array.isArray(src.rounds) ? src.rounds : []).slice(0, 2).map((item, index) => {
    const row = item && typeof item === "object" ? item : {};
    const questions = mapInsightQuestionItems(row.questions, "eq");
    const selectedQuestionId = String(row.selectedQuestionId || "");
    const selectedFromList = questions.find((item) => item.id === selectedQuestionId);
    return {
      id: String(row.id || `ext${index + 1}`),
      coreThread: String(row.coreThread || "").replace(/\s+/g, " ").trim(),
      questions,
      selectedQuestionId,
      selectedQuestionText: String((selectedFromList && selectedFromList.text) || row.selectedQuestionText || "").replace(/\s+/g, " ").trim(),
      answer: String(row.answer || "").trim(),
      answerSig: String(row.answerSig || "").trim(),
      deepConclusion: String(row.deepConclusion || "").trim(),
      completedAt: String(row.completedAt || "").trim(),
      sourceSig: String(row.sourceSig || "").trim(),
      stale: Boolean(row.stale),
      conclusionStale: Boolean(row.conclusionStale),
      retrieval: row.retrieval && typeof row.retrieval === "object" ? row.retrieval : null,
    };
  });
  return { variant: "reflection-extension-v1", rounds };
}

function thinkExtensionFrom(guide) {
  const data = guide || ((state.journalInsight || {}).guide || {});
  return normalizeReflectionExtension(data.extension);
}

function isThinkExtensionRoundCompleted(round) {
  const api = reviewMergeApi();
  if (typeof api.isExtensionRoundCompleted === "function") return api.isExtensionRoundCompleted(round);
  return Boolean(round && String(round.deepConclusion || "").replace(/\s+/g, " ").trim() && String(round.completedAt || "").trim());
}

function thinkExtensionCanStartRound2(extension, options = {}) {
  const api = reviewMergeApi();
  if (typeof api.canStartExtensionRound2 === "function") return api.canStartExtensionRound2(extension, options);
  const ext = normalizeReflectionExtension(extension);
  const completed = ext.rounds.filter(isThinkExtensionRoundCompleted).length;
  if (options.archived || options.busy) return false;
  return completed === 1 && ext.rounds.length >= 1;
}

function emptyThinkExtensionRound(id) {
  return {
    id: String(id || newThinkExtensionRoundId()),
    coreThread: "",
    questions: [],
    selectedQuestionId: "",
    selectedQuestionText: "",
    answer: "",
    answerSig: "",
    deepConclusion: "",
    completedAt: "",
    sourceSig: "",
    stale: false,
    conclusionStale: false,
  };
}

function thinkExtensionCompletedCount(extension) {
  const api = reviewMergeApi();
  if (typeof api.completedExtensionCount === "function") return api.completedExtensionCount(extension);
  return thinkExtensionFrom(extension && extension.rounds ? { extension } : undefined).rounds.filter(isThinkExtensionRoundCompleted).length;
}

function applyThinkExtension(extension) {
  const insight = normalizeInsight(state.journalInsight);
  const prevGuide = insight.guide || emptyThinkGuide();
  const prevExt = normalizeReflectionExtension(prevGuide.extension);
  insight.guide = normalizeThinkGuide({
    ...prevGuide,
    variant: prevGuide.variant,
    coreQuote: prevGuide.coreQuote,
    questions: prevGuide.questions,
    sourceSig: prevGuide.sourceSig,
    extension: normalizeReflectionExtension({
      ...prevExt,
      ...(extension && typeof extension === "object" ? extension : {}),
    }),
  });
  state.journalInsight = insight;
  return insight;
}

function upsertThinkExtensionRound(extension, round) {
  const api = reviewMergeApi();
  if (typeof api.upsertReflectionExtensionRound === "function") {
    return api.upsertReflectionExtensionRound(extension, round);
  }
  const ext = normalizeReflectionExtension(extension);
  const next = { id: String((round && round.id) || newThinkExtensionRoundId()), ...(round || {}) };
  const index = ext.rounds.findIndex((item) => item.id === next.id);
  const rounds = ext.rounds.slice();
  if (index >= 0) rounds[index] = { ...rounds[index], ...next };
  else rounds.push(next);
  return { variant: "reflection-extension-v1", rounds: rounds.slice(0, 2) };
}

function reportInternalRetrievalDebug(info) {
  if (typeof isInternalMembership === "function" && !isInternalMembership()) return;
  const refs = Array.isArray(info && info.references) ? info.references : [];
  console.info("[ING][retrieval]", {
    retrievedCount: Number(info && info.count) || 0,
    usedCount: Number(info && info.usedCount) || 0,
    used: refs.filter((item) => item && item.used === true).map((item) => ({
      date: String(item.date || ""),
      connectionType: String(item.connectionType || ""),
      score: Number(item.score) || 0,
    })),
    retrieved: refs.map((item) => ({
      date: String((item && item.date) || ""),
      connectionType: String((item && item.connectionType) || ""),
      score: Number(item && item.score) || 0,
      used: item && item.used === true,
    })),
    retrievalMs: info && info.timings ? Number(info.timings.retrievalMs) || 0 : 0,
  });
}

function paintInternalRetrievalDebug(root, round) {
  if (!root) return;
  root.querySelectorAll(".internal-retrieval-debug").forEach((node) => node.remove());
  if (typeof isInternalMembership === "function" && !isInternalMembership()) return;
  const live = state.internalRetrievalDebug;
  const retrieval = round && round.retrieval && typeof round.retrieval === "object" ? round.retrieval : null;
  const refs = live && Array.isArray(live.references) && live.references.length
    ? live.references
    : retrieval && Array.isArray(retrieval.selectedPast)
      ? retrieval.selectedPast
      : [];
  const used = refs.filter((item) => item && item.used === true);
  const retrievedCount = live && live.count != null ? Number(live.count) : refs.length;
  const usedCount = live && live.usedCount != null ? Number(live.usedCount) : used.length;
  if (!live && !retrieval) return;
  const usedBits = used
    .map((item) => `${String((item && item.date) || "").trim()}${item && item.connectionType ? ` ${item.connectionType}` : ""}`)
    .filter((bit) => bit.trim());
  const line =
    live && String(live.line || "").trim()
      ? String(live.line).trim()
      : `Internal Retrieval · retrieved ${retrievedCount} · used ${usedCount}${
          usedCount > 0 && usedBits.length ? ` · ${usedBits.join(" · ")}` : ""
        }`;
  const node = document.createElement("p");
  node.className = "internal-model-debug internal-retrieval-debug";
  node.textContent = line;
  root.appendChild(node);
}

function reportThinkExtDebug(info) {
  if (typeof isInternalMembership === "function" && !isInternalMembership()) return;
  const payload = {
    extensionClick: Boolean(info && info.extensionClick),
    handlerEntered: Boolean(info && info.handlerEntered),
    requestMode: String((info && info.requestMode) || ""),
    httpStatus: String((info && info.httpStatus) || ""),
    failureStage: String((info && info.failureStage) || ""),
    actualModel: String((info && info.actualModel) || ""),
  };
  console.info("[ING][extension]", payload);
}

function newThinkExtensionRoundId() {
  return `ext_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function thinkExtensionAnswerSig(answer) {
  return String(answer || "").replace(/\s+/g, " ").trim();
}

function thinkExtensionAnswerMeaningful(answer) {
  return String(answer || "").replace(/\s+/g, "").trim().length >= 8;
}

function reflectionExtensionContext(journal, options = {}) {
  const data = journal || collectJournal();
  const think = thinkBitsFrom(data);
  const mind = normalizeBodyMind(data.bodyMind);
  const ext = normalizeReflectionExtension(((data.insight && data.insight.guide) || {}).extension || thinkExtensionFrom());
  const skipId = String((options && options.roundId) || "").trim();
  const completed = ext.rounds.filter(isThinkExtensionRoundCompleted);
  const prior = completed.find((item) => item.id !== skipId) || null;
  const selected = prior && prior.questions.find((item) => item.id === prior.selectedQuestionId);
  const selectedText = String((prior && prior.selectedQuestionText) || (selected && selected.text) || "").trim();
  return {
    thanksText: thanksTextFrom(data),
    thanks: thanksTextFrom(data),
    event: String(data.event || "").trim(),
    mood: String(data.mood || "").trim(),
    bodyMindText: mind.text,
    bodyNote: mind.text || String(data.bodyNote || "").trim(),
    bodyMindInsight: mind.insight,
    bodyMindSupport: mind.support,
    coreQuote: think.coreQuote,
    thinkCoreQuote: think.coreQuote,
    thinkQuestions: think.questions,
    questions: think.questions,
    priorRound: prior
      ? {
          coreThread: String(prior.coreThread || "").trim(),
          questions: prior.questions,
          selectedQuestion: selectedText,
          selectedQuestionText: selectedText,
          answer: prior.answer,
          deepConclusion: prior.deepConclusion,
        }
      : null,
    persistedExtension: ext,
  };
}

function reflectionExtensionSourceSig(journal) {
  const ctx = reflectionExtensionContext(journal);
  return [
    String(ctx.thanksText || "").replace(/\s+/g, " ").trim(),
    String(ctx.event || "").replace(/\s+/g, " ").trim(),
    String(ctx.mood || "").trim(),
    String(ctx.bodyMindText || "").replace(/\s+/g, " ").trim(),
    String(ctx.bodyMindInsight || "").replace(/\s+/g, " ").trim(),
    String(ctx.bodyMindSupport || "").replace(/\s+/g, " ").trim(),
    String(ctx.coreQuote || "").replace(/\s+/g, " ").trim(),
    (ctx.thinkQuestions || []).map((item) => String((item && (item.text || item.question)) || "").replace(/\s+/g, " ").trim()).filter(Boolean).join("|"),
  ].join("\n");
}

function currentThinkExtensionRound(extension) {
  const ext = normalizeReflectionExtension(extension);
  return ext.rounds.find((item) => item.questions.length && !isThinkExtensionRoundCompleted(item)) || ext.rounds[ext.rounds.length - 1] || null;
}

function selectedThinkExtensionQuestion(round) {
  if (!round) return null;
  return (round.questions || []).find((item) => item.id === round.selectedQuestionId) || null;
}

function thinkExtensionSelectedText(round) {
  const selected = selectedThinkExtensionQuestion(round);
  return String((round && round.selectedQuestionText) || (selected && selected.text) || "").trim();
}

function renderThinkExtensionRecord(round, index) {
  if (!round) return "";
  const label = index === 0 ? "第一次" : "第二次";
  const selectedText = thinkExtensionSelectedText(round);
  const others = (round.questions || []).filter((item) => item.id !== round.selectedQuestionId && item.text);
  return `
    <article class="think-ext-record">
      <p class="think-ext-kicker">延伸深度思考｜${label}</p>
      ${selectedText ? `<p class="think-ext-record__q">${escapeHtml(selectedText)}</p>` : ""}
      ${round.answer ? `<p class="think-ext-record__a">${escapeHtml(round.answer)}</p>` : ""}
      ${round.deepConclusion ? `
        <div class="think-ext-conclusion">
          <p class="think-ext-conclusion__label">深度結論</p>
          ${markableP(round.deepConclusion, `think.extension.${round.id}.conclusion`, "think-ext-conclusion__text")}
        </div>` : ""}
      ${others.length ? `
        <details class="think-ext-more">
          <summary>其他題目</summary>
          ${others.map((item) => `<p class="think-ext-more__q">${escapeHtml(item.text)}</p>`).join("")}
        </details>` : ""}
    </article>`;
}

function flushThinkExtensionAnswer() {
  const ta = document.getElementById("thinkExtAnswer");
  if (!ta) return thinkExtensionFrom();
  const ext = thinkExtensionFrom();
  const current = currentThinkExtensionRound(ext);
  if (!current) return ext;
  const answer = String(ta.value || "");
  const next = { ...current, answer };
  if (current.deepConclusion && thinkExtensionAnswerSig(answer) !== current.answerSig) next.conclusionStale = true;
  applyThinkExtension({ ...ext, rounds: ext.rounds.map((item) => (item.id === current.id ? next : item)) });
  return thinkExtensionFrom();
}

function renderThinkExtension() {
  const root = document.getElementById("thinkV3Extension");
  if (!root) return;
  const archived = isCurrentJournalArchived();
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  const hasLayer = guide.variant === "reflection-v3" && Boolean(guide.coreQuote) && guide.questions.length >= 1 && !isUnderstandGuide(guide);
  const ext = normalizeReflectionExtension(guide.extension);
  const loading = Boolean(state.choicesBusy?.thinkExt);
  const completedRounds = ext.rounds.filter(isThinkExtensionRoundCompleted);
  const completedCount = completedRounds.length;
  const incomplete = ext.rounds.find((item) => item.questions.length && !isThinkExtensionRoundCompleted(item));
  const current = incomplete || null;
  const canStartRound2 = thinkExtensionCanStartRound2(ext, { archived, busy: loading });
  const round2Active = ext.rounds.some((item, index) => index > 0 && item.questions.length && !isThinkExtensionRoundCompleted(item));
  const sourceSig = hasLayer ? reflectionExtensionSourceSig() : "";
  const questionsStale = Boolean(current && current.questions.length && current.sourceSig && current.sourceSig !== sourceSig);
  if (current && questionsStale && !current.stale) {
    applyThinkExtension({
      ...ext,
      rounds: ext.rounds.map((item) => (item.id === current.id ? { ...item, stale: true } : item)),
    });
  }
  if (!hasLayer) {
    root.innerHTML = "";
    root.hidden = true;
    return;
  }
  const selected = selectedThinkExtensionQuestion(current);
  const answerValue = current ? current.answer : "";
  const answerMeaningful = thinkExtensionAnswerMeaningful(answerValue);
  const conclusionStale = Boolean(
    current &&
      current.deepConclusion &&
      (current.conclusionStale || (answerValue && thinkExtensionAnswerSig(answerValue) !== current.answerSig))
  );
  const showStart = !archived && completedCount === 0 && !(current && current.questions.length);
  const showAgain = canStartRound2 && !round2Active;
  const records = completedRounds.map((round, index) => renderThinkExtensionRecord(round, index)).join("");
  const radios = current && current.questions.length
    ? current.questions
        .map((item, index) => {
          const checked = item.id === (current.selectedQuestionId || "");
          const inputId = `reflection-extension-question-${current.id}-${item.id}`;
          const groupName = `reflection-extension-question-${current.id}`;
          return `
        <label class="think-ext-opt" for="${escapeHtml(inputId)}" data-extension-question="${escapeHtml(item.id)}" data-extension-round="${escapeHtml(current.id)}">
          <input type="radio" id="${escapeHtml(inputId)}" name="${escapeHtml(groupName)}" value="${escapeHtml(item.id)}" data-extension-question="${escapeHtml(item.id)}" data-extension-round="${escapeHtml(current.id)}" ${checked ? "checked" : ""} ${archived ? "disabled" : ""} />
          <span class="think-ext-opt__mark" aria-hidden="true"></span>
          <span class="think-ext-opt__copy">
            <span class="think-ext-opt__index">0${index + 1}</span>
            ${item.title ? `<span class="think-ext-opt__title">${escapeHtml(item.title)}</span>` : ""}
            <span class="think-ext-opt__text">${escapeHtml(item.text)}</span>
          </span>
        </label>`;
        })
        .join("")
    : "";
  root.hidden = false;
  root.innerHTML = `
    <section class="think-ext-block">
      ${showStart ? `
        <p class="think-ext-lead">想再往裡面看一點？</p>
        <button class="body-mind-cta think-ext-cta" id="btnThinkExtStart" type="button" ${loading ? "disabled" : ""}>${loading ? "正在往裡面整理…" : "延伸深度思考 →"}</button>` : ""}
      ${records}
      ${current && current.questions.length ? `
        <p class="think-ext-kicker">${completedCount ? "延伸深度思考｜第二次" : "延伸深度思考"}</p>
        <p class="think-ext-prompt">如果想再往裡面看一點，<br />哪一題最讓你停下來？</p>
        <div class="think-ext-options" role="radiogroup" aria-label="延伸深度思考題目">${radios}</div>
        ${questionsStale && !archived ? `
          <p class="think-ext-stale">前面的內容有修改，這次延伸思考是依照修改前的內容產生。</p>
          <button class="think-ext-text-btn" id="btnThinkExtRefresh" type="button">重新整理延伸問題</button>` : ""}
        ${current.selectedQuestionId ? `
          <div class="think-ext-answer-wrap" id="thinkExtAnswerWrap">
          <label class="think-ext-answer-label" for="thinkExtAnswer">寫下你現在真正想到的答案。</label>
          <textarea class="textarea think-ext-answer" id="thinkExtAnswer" rows="4" ${archived ? "readonly" : ""}>${escapeHtml(answerValue)}</textarea>
          </div>` : ""}
        ${current.selectedQuestionId ? `
          ${!archived && answerMeaningful && !current.deepConclusion ? `
            <button class="body-mind-cta think-ext-cta" id="btnThinkExtClose" type="button">整理這次的深度思考 →</button>` : ""}
          ${!archived && answerMeaningful && conclusionStale ? `
            <button class="body-mind-cta think-ext-cta" id="btnThinkExtCloseStale" type="button">回答有修改，重新整理深度結論 →</button>` : ""}` : ""}
        ${current.deepConclusion ? `
          <div class="think-ext-conclusion">
            <p class="think-ext-conclusion__label">深度結論</p>
            ${markableP(current.deepConclusion, `think.extension.${current.id}.conclusion`, "think-ext-conclusion__text")}
          </div>` : ""}` : ""}
      ${loading ? `
        <div class="check-loading" id="thinkExtLoading">
          <p class="check-loading__label">${current && current.selectedQuestionId && answerMeaningful && !showStart ? "正在整理這次的深度思考…" : "正在往裡面整理…"}</p>
          <div class="ai-thinking__bar"><i></i></div>
        </div>` : ""}
      ${completedCount ? `<p class="think-ext-count">今日已完成 ${completedCount} / 2 次延伸思考</p>` : ""}
      ${showAgain ? `<button class="think-ext-text-btn" id="btnThinkExtAgain" type="button" ${loading ? "disabled" : ""}>${loading ? "正在往裡面整理…" : "再延伸一次 →"}</button>` : ""}
    </section>`;
  paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.thinkExt);
  paintInternalRetrievalDebug(root, ext.rounds.find((item) => item && item.retrieval) || current || ext.rounds[0] || null);
}

function syncThinkExtAnswerChrome() {
  const ta = document.getElementById("thinkExtAnswer");
  if (!ta) return;
  const ext = flushThinkExtensionAnswer();
  const current = currentThinkExtensionRound(ext);
  if (!current) return;
  const meaningful = thinkExtensionAnswerMeaningful(ta.value);
  const stale = Boolean(current.deepConclusion && (current.conclusionStale || thinkExtensionAnswerSig(ta.value) !== current.answerSig));
  let close = document.getElementById("btnThinkExtClose");
  let staleBtn = document.getElementById("btnThinkExtCloseStale");
  const host = ta.closest(".think-ext-block") || ta.parentElement;
  if (!close && host && meaningful && !current.deepConclusion && !isCurrentJournalArchived()) {
    close = document.createElement("button");
    close.className = "body-mind-cta think-ext-cta";
    close.id = "btnThinkExtClose";
    close.type = "button";
    close.textContent = "整理這次的深度思考 →";
    ta.insertAdjacentElement("afterend", close);
  }
  if (close) close.hidden = !meaningful || Boolean(current.deepConclusion) || isCurrentJournalArchived();
  if (!staleBtn && host && stale && !isCurrentJournalArchived()) {
    const hint = document.createElement("p");
    hint.className = "think-ext-stale";
    hint.textContent = "回答有修改，重新整理深度結論 →";
    staleBtn = document.createElement("button");
    staleBtn.className = "body-mind-cta think-ext-cta";
    staleBtn.id = "btnThinkExtCloseStale";
    staleBtn.type = "button";
    staleBtn.textContent = "重新整理深度結論 →";
    const conclusion = host.querySelector(".think-ext-conclusion");
    (conclusion || ta).insertAdjacentElement(conclusion ? "beforebegin" : "afterend", hint);
    hint.insertAdjacentElement("afterend", staleBtn);
  }
}

function syncThinkExtensionSelectionUi() {
  const root = document.getElementById("thinkV3Extension");
  if (!root) return;
  const archived = isCurrentJournalArchived();
  const ext = thinkExtensionFrom();
  const current = currentThinkExtensionRound(ext);
  if (!current || !current.questions.length) return;
  const selectedId = String(current.selectedQuestionId || "");
  root.querySelectorAll("input[data-extension-question]").forEach((input) => {
    input.checked = input.value === selectedId;
  });
  if (!selectedId) return;
  if (document.getElementById("thinkExtAnswer")) return;
  const options = root.querySelector(".think-ext-options");
  if (!options) return;
  const wrap = document.createElement("div");
  wrap.className = "think-ext-answer-wrap";
  wrap.id = "thinkExtAnswerWrap";
  const label = document.createElement("label");
  label.className = "think-ext-answer-label";
  label.setAttribute("for", "thinkExtAnswer");
  label.textContent = "寫下你現在真正想到的答案。";
  const ta = document.createElement("textarea");
  ta.className = "textarea think-ext-answer";
  ta.id = "thinkExtAnswer";
  ta.rows = 4;
  ta.value = current.answer || "";
  if (archived) ta.readOnly = true;
  wrap.appendChild(label);
  wrap.appendChild(ta);
  options.insertAdjacentElement("afterend", wrap);
}

function selectThinkExtensionQuestion(questionId) {
  if (isCurrentJournalArchived()) return;
  const ext = thinkExtensionFrom();
  const current = currentThinkExtensionRound(ext);
  if (!current || !current.questions.some((item) => item.id === questionId)) return;
  if (current.selectedQuestionId === questionId && document.getElementById("thinkExtAnswer")) return;
  const chosen = current.questions.find((item) => item.id === questionId);
  const next = { ...current, selectedQuestionId: questionId, selectedQuestionText: chosen ? chosen.text : "" };
  if (current.deepConclusion) next.conclusionStale = true;
  applyThinkExtension({
    ...ext,
    rounds: ext.rounds.map((item) => (item.id === current.id ? next : item)),
  });
  markJournalFoldEditing("section-deep", true);
  persistJournalNow({ showHint: false });
  syncThinkExtensionSelectionUi();
}

async function generateThinkExtensionAsk(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  reportThinkExtDebug({ handlerEntered: true, failureStage: "ELIGIBILITY" });
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.choicesBusy?.thinkExt) return;
  if (!ensurePlusFeature("think_ai", options)) return;
  const journal = collectJournal();
  const guide = normalizeThinkGuide(((journal.insight || state.journalInsight || {}).guide));
  if (!(guide.variant === "reflection-v3" && guide.coreQuote && guide.questions.length >= 1)) {
    reportThinkExtDebug({ handlerEntered: true, failureStage: "ELIGIBILITY" });
    return;
  }
  const ext = normalizeReflectionExtension(guide.extension);
  const completedCount = ext.rounds.filter(isThinkExtensionRoundCompleted).length;
  const firstId = String((ext.rounds[0] && ext.rounds[0].id) || "");
  let current = null;
  if (options.startNextRound) {
    if (!thinkExtensionCanStartRound2(ext, { archived: false, busy: false })) {
      reportThinkExtDebug({ handlerEntered: true, failureStage: "ELIGIBILITY" });
      renderThinkExtension();
      return;
    }
    const extra = ext.rounds.filter((item) => item.id !== firstId);
    const round2 = extra[0] || null;
    if (round2 && round2.questions.length) {
      renderThinkExtension();
      return;
    }
    current = round2 && round2.id && round2.id !== firstId ? round2 : emptyThinkExtensionRound();
    if (current.id === firstId) current = emptyThinkExtensionRound();
  } else {
    const draft = ext.rounds.find((item) => !isThinkExtensionRoundCompleted(item));
    if (completedCount >= 2) {
      reportThinkExtDebug({ handlerEntered: true, failureStage: "ELIGIBILITY" });
      renderThinkExtension();
      return;
    }
    if (!options.refresh && draft && draft.questions.length) {
      renderThinkExtension();
      return;
    }
    current = draft;
    if (!current) current = emptyThinkExtensionRound();
  }
  if (completedCount >= 1 && current.id === firstId && firstId) {
    current = emptyThinkExtensionRound();
  }
  const token = (state.choicesToken.thinkExt || 0) + 1;
  state.choicesToken.thinkExt = token;
  state.choicesBusy.thinkExt = true;
  applyThinkExtension(upsertThinkExtensionRound(ext, current));
  persistJournalNow();
  renderThinkExtension();
  try {
    if (!state.user) throw new Error("請先登入，才能整理延伸深度思考。");
    const ctx = reflectionExtensionContext(collectJournal(), { roundId: current.id });
    ctx.roundId = current.id;
    ctx.persistedExtension = thinkExtensionFrom();
    if (options.refresh) ctx.force = true;
    reportThinkExtDebug({ handlerEntered: true, requestMode: "insight", failureStage: "REQUEST" });
    const remote = await postReview({
      mode: "insight",
      variant: "reflection-extension-v1",
      step: "ask",
      date: currentIso(),
      text: ctx.event,
      context: {
        variant: "reflection-extension-v1",
        step: "ask",
        ...ctx,
      },
    });
    if (state.choicesToken.thinkExt !== token) return;
    reportThinkExtDebug({
      handlerEntered: true,
      requestMode: "insight",
      httpStatus: "200",
      actualModel: remote && remote._internalDebug && remote._internalDebug.model,
      failureStage: "PARSE",
    });
    const questions = mapInsightQuestionItems(
      Array.isArray(remote.items) && remote.items.length ? remote.items : remote.questions,
      "eq"
    );
    if (questions.length < 1) throw new Error("這次沒有整理完成，再試一次。");
    const latest = thinkExtensionFrom();
    const kept = latest.rounds.find((item) => item.id === current.id) || current;
    applyThinkExtension(
      upsertThinkExtensionRound(latest, {
        ...kept,
        id: current.id,
        coreThread: String((remote && remote.coreThread) || kept.coreThread || "").replace(/\s+/g, " ").trim(),
        questions,
        selectedQuestionId: kept.questions.some((q) => q.id === kept.selectedQuestionId) ? kept.selectedQuestionId : "",
        selectedQuestionText: kept.questions.some((q) => q.id === kept.selectedQuestionId) ? kept.selectedQuestionText : "",
        sourceSig: reflectionExtensionSourceSig(collectJournal()),
        stale: false,
        retrieval: remote && remote.retrieval && typeof remote.retrieval === "object" ? remote.retrieval : kept.retrieval || null,
      })
    );
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.thinkExt = takeInternalDebug(remote);
    state.internalRetrievalDebug = remote && remote._internalRetrieval
      ? {
          line: String(remote._internalRetrieval.line || ""),
          count: Number(remote._internalRetrieval.count || 0),
          usedCount: Number(remote._internalRetrieval.usedCount || 0),
          references: Array.isArray(remote._internalRetrieval.references) ? remote._internalRetrieval.references : [],
          timings: remote._internalRetrieval.timings || {},
        }
      : null;
    if (state.internalRetrievalDebug) reportInternalRetrievalDebug(state.internalRetrievalDebug);
    persistJournalNow();
    reportThinkExtDebug({
      handlerEntered: true,
      requestMode: "insight",
      httpStatus: "200",
      actualModel: remote && remote._internalDebug && remote._internalDebug.model,
      failureStage: "RENDER",
    });
    renderThinkExtension();
  } catch (error) {
    if (state.choicesToken.thinkExt !== token) return;
    reportThinkExtDebug({
      handlerEntered: true,
      requestMode: "insight",
      httpStatus: error && error.status ? String(error.status) : "error",
      failureStage: "SERVER",
    });
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "這次沒有整理完成，再試一次。");
    renderThinkExtension();
  } finally {
    if (state.choicesToken.thinkExt === token) {
      state.choicesBusy.thinkExt = false;
      renderThinkExtension();
    }
  }
}

async function generateThinkExtensionClose(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.choicesBusy?.thinkExt) return;
  if (!ensurePlusFeature("think_ai", options)) return;
  const ext = flushThinkExtensionAnswer();
  persistJournalNow();
  const current = currentThinkExtensionRound(ext);
  const selected = selectedThinkExtensionQuestion(current);
  const ta = document.getElementById("thinkExtAnswer");
  const answer = String((ta && ta.value) || (current && current.answer) || "");
  if (!current || !selected || !thinkExtensionAnswerMeaningful(answer)) {
    showToast("請先選一題，並寫下你現在真正想到的答案。");
    return;
  }
  const token = (state.choicesToken.thinkExt || 0) + 1;
  state.choicesToken.thinkExt = token;
  state.choicesBusy.thinkExt = true;
  renderThinkExtension();
  try {
    if (!state.user) throw new Error("請先登入，才能整理這次的深度思考。");
    const ctx = reflectionExtensionContext(collectJournal(), { roundId: current.id });
    ctx.roundId = current.id;
    ctx.selectedQuestion = selected.text;
    ctx.selectedQuestionText = selected.text;
    ctx.answer = answer;
    ctx.persistedExtension = thinkExtensionFrom();
    const remote = await postReview({
      mode: "insight",
      variant: "reflection-extension-v1",
      step: "close",
      date: currentIso(),
      text: ctx.event,
      context: {
        variant: "reflection-extension-v1",
        step: "close",
        ...ctx,
      },
    });
    if (state.choicesToken.thinkExt !== token) return;
    const deepConclusion = String(remote.deepConclusion || remote.conclusion || "").replace(/\s+/g, " ").trim();
    if (!deepConclusion) throw new Error("這次的深度結論還沒整理好，請再試一次。");
    const latest = thinkExtensionFrom();
    const kept = latest.rounds.find((item) => item.id === current.id) || current;
    applyThinkExtension(
      upsertThinkExtensionRound(latest, {
        ...kept,
        id: current.id,
        selectedQuestionId: current.selectedQuestionId,
        selectedQuestionText: selected.text,
        answer,
        answerSig: thinkExtensionAnswerSig(answer),
        deepConclusion,
        completedAt: kept.completedAt || new Date().toISOString(),
        conclusionStale: false,
      })
    );
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.thinkExt = takeInternalDebug(remote);
    persistJournalNow();
    renderThinkExtension();
  } catch (error) {
    if (state.choicesToken.thinkExt !== token) return;
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "這次的深度結論還沒整理好，請再試一次。");
    renderThinkExtension();
  } finally {
    if (state.choicesToken.thinkExt === token) {
      state.choicesBusy.thinkExt = false;
      renderThinkExtension();
    }
  }
}

function normalizeAwarenessV3Bag(raw) {
  const api = reviewMergeApi();
  if (typeof api.normalizeAwarenessV3Bag === "function") return api.normalizeAwarenessV3Bag(raw);
  const src = raw && typeof raw === "object" ? raw : {};
  const items = (Array.isArray(src.items) ? src.items : []).map((item, index) => {
    const text = String((item && item.text) || "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    const title = String((item && item.title) || "").replace(/\s+/g, " ").trim();
    const out = { id: String((item && item.id) || `a${index + 1}`), text };
    if (title) out.title = title;
    if (item && item.type) out.type = String(item.type || "").trim();
    if (item && item.maturity) out.maturity = String(item.maturity || "").trim();
    if (item && item.bridge) out.bridge = true;
    return out;
  }).filter(Boolean).slice(0, 3);
  const allowed = new Set(items.map((item) => item.id));
  const cue = src.observationCue && typeof src.observationCue === "object" ? src.observationCue : {};
  const cueText = String(cue.text || "").replace(/\s+/g, " ").trim();
  return {
    variant: "awareness-v3",
    growVariant: String(src.growVariant || "").trim(),
    status: String(src.status || "").trim(),
    sourceSig: String(src.sourceSig || "").trim(),
    items,
    selectedIds: (Array.isArray(src.selectedIds) ? src.selectedIds : []).filter((id) => allowed.has(id)),
    generatedAt: String(src.generatedAt || "").trim(),
    observationCue: cueText
      ? {
          text: cueText,
          selectedSig: String(cue.selectedSig || "").trim(),
          generatedAt: String(cue.generatedAt || "").trim(),
        }
      : null,
    emptyCopy: src.emptyCopy && typeof src.emptyCopy === "object" ? src.emptyCopy : null,
  };
}

function isGrowAwarenessBag(data) {
  const bag = data && typeof data === "object" ? data : {};
  return bag.growVariant === "grow-v1" || bag.status === "grow" || bag.status === "empty";
}

function awarenessV3HasResult(data) {
  const bag = data && typeof data === "object" ? data : {};
  if (isGrowAwarenessBag(bag)) return Boolean(bag.sourceSig);
  return (bag.items || []).length >= 2;
}

function selectedAwarenessV3Texts(raw) {
  const api = reviewMergeApi();
  if (typeof api.selectedAwarenessV3Texts === "function") return api.selectedAwarenessV3Texts(raw);
  const data = normalizeAwarenessV3Bag(raw);
  const map = new Map(data.items.map((item) => [item.id, item.text]));
  return data.selectedIds.map((id) => map.get(id)).filter(Boolean);
}

function awarenessV3Context(journal) {
  const data = journal || collectJournal();
  const think = thinkBitsFrom(data);
  const mind = normalizeBodyMind(data.bodyMind);
  const guide = normalizeThinkGuide((data.insight && data.insight.guide) || (state.journalInsight && state.journalInsight.guide));
  return {
    thanksText: thanksTextFrom(data),
    thanks: thanksTextFrom(data),
    event: String(data.event || "").trim(),
    mood: String(data.mood || "").trim(),
    bodyMindText: mind.text,
    bodyNote: mind.text || String(data.bodyNote || "").trim(),
    bodyMindInsight: mind.insight,
    bodyMindSupport: mind.support,
    coreQuote: think.coreQuote,
    thinkCoreQuote: think.coreQuote,
    thinkQuestions: think.questions,
    understand: guide.understand || null,
  };
}

function awarenessV3SourceSig(journal) {
  const ctx = awarenessV3Context(journal);
  const bag = ctx.understand && typeof ctx.understand === "object" ? ctx.understand : null;
  if (bag && bag.stage) {
    return [
      String(ctx.thanksText || "").replace(/\s+/g, " ").trim(),
      String(ctx.event || "").replace(/\s+/g, " ").trim(),
      String(ctx.mood || "").trim(),
      String(ctx.bodyMindText || "").replace(/\s+/g, " ").trim(),
      String(bag.stage || "").trim(),
      String(bag.answer || "").replace(/\s+/g, " ").trim(),
      String(bag.answer2 || "").replace(/\s+/g, " ").trim(),
      String(bag.convergence || bag.focus || "").replace(/\s+/g, " ").trim(),
    ].join("\n");
  }
  return [
    String(ctx.thanksText || "").replace(/\s+/g, " ").trim(),
    String(ctx.event || "").replace(/\s+/g, " ").trim(),
    String(ctx.mood || "").trim(),
    String(ctx.bodyMindText || "").replace(/\s+/g, " ").trim(),
    String(ctx.bodyMindInsight || "").replace(/\s+/g, " ").trim(),
    String(ctx.bodyMindSupport || "").replace(/\s+/g, " ").trim(),
    String(ctx.coreQuote || "").replace(/\s+/g, " ").trim(),
    (ctx.thinkQuestions || []).map((item) => String((item && (item.text || item.question)) || "").replace(/\s+/g, " ").trim()).filter(Boolean).join("|"),
  ].join("\n");
}

function awarenessV3Ready(journal) {
  const data = journal || collectJournal();
  const guide = (data.insight && data.insight.guide) || (state.journalInsight && state.journalInsight.guide);
  const ctx = awarenessV3Context(data);
  const base = Boolean(thanksFilled(data) && ctx.event && ctx.mood && bodyMindTextReady(ctx.bodyMindText));
  if (!base) return false;
  if (isUnderstandGuide(guide)) return understandIsComplete(guide);
  if (thinkGuideIsSilence(guide)) return false;
  return Boolean(String(ctx.coreQuote || "").trim());
}

function usesAwarenessV3Path(journal) {
  const mode = journal && journal.mode ? journal.mode : state.journalMode;
  if (mode === "quick") return false;
  const v3 = normalizeAwarenessV3Bag((journal && journal.awarenessV3) || state.journalAwarenessV3);
  if (v3.items.length || v3.sourceSig) return true;
  const bag = normalizeChoiceBag((journal && journal.awarenessChoices) || state.awarenessChoices);
  if (hasMeaningfulChoices(bag)) return false;
  const result = normalizeAwarenessResult((journal && journal.awarenessResult) || state.journalAwarenessResult, { keepSource: true });
  if (hasAwarenessResult(result)) return false;
  const prompts = (journal && journal.awarenessPrompts) || state.awarenessPrompts || [];
  if (Array.isArray(prompts) && prompts.length) return false;
  const answers = (journal && journal.awareness) || [];
  if (Array.isArray(answers) && answers.some((item) => String(item || "").trim())) return false;
  return true;
}

function usesExecutionV3Path(journal) {
  const mode = journal && journal.mode ? journal.mode : state.journalMode;
  if (mode === "quick") return false;
  const bag = normalizeExecutionChoiceBag((journal && journal.executionChoices) || state.executionChoices);
  if (bag.variant === "execution-v3") return true;
  if (hasMeaningfulExecDeep(bag.deep)) return false;
  if (bag.options.length || bag.followupQuestion || bag.selectedIds.length || bag.selectedId || bag.custom) return false;
  const legacy = normalizeExecutionPrompts((journal && journal.executionPrompts) || state.executionPrompts);
  return legacy.length === 0;
}

function lockNewDayAwareUi() {
  const v3 = usesAwarenessV3Path();
  const section = document.getElementById("section-aware");
  if (section) section.classList.toggle("is-aware-v3", v3);
  const card = document.getElementById("awareV3Card");
  if (card) card.hidden = !v3;
  document.querySelectorAll("#section-aware .js-legacy-aware-ui").forEach((node) => {
    node.hidden = v3;
  });
  if (v3) {
    ["awareEmpty", "btnAwarePrompts", "awareQuestions", "awarePromptLoading", "btnAwareAi", "awareChecks", "awareLoading", "awareQuoteLimitHint"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.hidden = true;
    });
  }
}

function lockNewDayExecUi() {
  const v3 = usesExecutionV3Path();
  const card = document.getElementById("execV3Card");
  if (card) card.hidden = !v3;
  document.querySelectorAll("#section-exec .js-legacy-exec-ui").forEach((node) => {
    node.hidden = v3;
  });
  if (v3) {
    ["execEmpty", "btnExecPrompts", "execQuestions", "execPromptLoading", "btnExecAi", "execCardCol"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.hidden = true;
    });
    const next = document.getElementById("execNext");
    const hint = document.getElementById("execNextVoiceHint");
    const label = document.getElementById("execStepLabel");
    const stepHint = document.getElementById("execStepHint");
    const stepResult = document.getElementById("execStepResult");
    if (next) next.hidden = true;
    if (hint) hint.hidden = true;
    if (label) label.hidden = true;
    if (stepHint) stepHint.hidden = true;
    if (stepResult) stepResult.hidden = true;
  }
}

function showAwareV3Hint(message) {
  const hint = document.getElementById("awareV3Hint");
  if (!hint) return;
  const text = String(message || "").trim();
  hint.textContent = text;
  hint.hidden = !text || isCurrentJournalArchived();
}

function showExecV3Hint(message) {
  const hint = document.getElementById("execV3Hint");
  if (!hint) return;
  const text = String(message || "").trim();
  hint.textContent = text;
  hint.hidden = !text || isCurrentJournalArchived();
}

function syncAwareV3Cta() {
  lockNewDayAwareUi();
  const btn = document.getElementById("btnAwarenessV3");
  if (!btn) return;
  const archived = isCurrentJournalArchived();
  const guide = (state.journalInsight || {}).guide;
  const silent = thinkGuideIsSilence(guide) && !isUnderstandGuide(guide);
  const waitingUnderstand = isUnderstandGuide(guide) && !understandIsComplete(guide);
  const data = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  const hasResult = awarenessV3HasResult(data);
  if (silent && !hasResult) {
    btn.hidden = true;
    showAwareV3Hint("");
    return;
  }
  const ready = awarenessV3Ready();
  const stale = hasResult && data.sourceSig && data.sourceSig !== awarenessV3SourceSig();
  const show = usesAwarenessV3Path() && !archived && (!hasResult || stale);
  btn.hidden = !show;
  btn.disabled = Boolean(state.choicesBusy?.awareness) || archived || !ready || silent || waitingUnderstand;
  btn.textContent = stale ? "前面的內容有修改，重新看看 →" : "看看今天可以帶走的覺察 →";
  if (silent) showAwareV3Hint("今天沒有一定要再整理的覺察。");
  else if (waitingUnderstand && show) showAwareV3Hint("先把今天的深度思考走完，再來看可以帶走的覺察。");
  else if (!ready && show) showAwareV3Hint("先把今日感謝、事件、身心覺察和深度思考整理好。");
  else if (ready) showAwareV3Hint("");
}

function executionV3Context(journal) {
  const data = journal || collectJournal();
  const aware = awarenessBitsFrom(data);
  const think = thinkBitsFrom(data);
  const mind = normalizeBodyMind(data.bodyMind);
  return {
    thanksText: thanksTextFrom(data),
    thanks: thanksTextFrom(data),
    event: String(data.event || "").trim(),
    mood: String(data.mood || "").trim(),
    bodyMindText: mind.text,
    bodyNote: mind.text || String(data.bodyNote || "").trim(),
    coreQuote: think.coreQuote,
    thinkCoreQuote: think.coreQuote,
    awarenessSelected: aware.selected,
    awarenessSelectedIds: aware.selectedIds,
    awarenessItems: aware.items,
    growVariant: aware.growVariant || "",
    awarenessGrowVariant: aware.growVariant || "",
    awarenessStatus: aware.status || "",
    understand: (function () {
      const guide = normalizeThinkGuide((data.insight && data.insight.guide) || (state.journalInsight && state.journalInsight.guide));
      return guide.understand || null;
    })(),
  };
}

function isActExecutionBag(data) {
  const bag = data && typeof data === "object" ? data : {};
  return bag.actVariant === "act-v1" || bag.status === "actions" || bag.status === "no-action";
}

function executionV3HasResult(data) {
  const bag = data && typeof data === "object" ? data : {};
  if (isActExecutionBag(bag)) return Boolean(bag.sourceSig);
  return bag.variant === "execution-v3" && (bag.options || []).length >= 3;
}

function executionV3SourceSig(journal) {
  const ctx = executionV3Context(journal);
  if (ctx.growVariant === "grow-v1" || ctx.awarenessStatus === "grow" || ctx.awarenessStatus === "empty") {
    const bag = ctx.understand && typeof ctx.understand === "object" ? ctx.understand : {};
    return [
      "grow-v1",
      (ctx.awarenessSelectedIds || []).join(","),
      (ctx.awarenessSelected || []).join("|"),
      String(bag.answer || "").replace(/\s+/g, " ").trim(),
      String(bag.answer2 || "").replace(/\s+/g, " ").trim(),
      String(bag.convergence || "").replace(/\s+/g, " ").trim(),
      String(ctx.thanksText || "").replace(/\s+/g, " ").trim(),
      String(ctx.event || "").replace(/\s+/g, " ").trim(),
      String(ctx.mood || "").trim(),
      String(ctx.bodyMindText || "").replace(/\s+/g, " ").trim(),
    ].join("\n");
  }
  return [
    (ctx.awarenessSelectedIds || []).join(","),
    (ctx.awarenessSelected || []).join("|"),
    (ctx.awarenessItems || []).map((item) => String(item && item.text || "").trim()).join("|"),
    String(ctx.event || "").replace(/\s+/g, " ").trim(),
    String(ctx.bodyMindText || "").replace(/\s+/g, " ").trim(),
    String(ctx.coreQuote || "").replace(/\s+/g, " ").trim(),
  ].join("\n");
}

function executionV3Ready(journal) {
  const page = journal || collectJournal();
  const guide = (page.insight && page.insight.guide) || (state.journalInsight && state.journalInsight.guide);
  const silent = thinkGuideIsSilence(guide) && !isUnderstandGuide(guide);
  const data = normalizeAwarenessV3Bag((page.awarenessV3) || state.journalAwarenessV3);
  if (isGrowAwarenessBag(data)) return awarenessV3HasResult(data) && data.selectedIds.length >= 1;
  const confirmed = selectedAwarenessV3Texts(data);
  if (silent && !confirmed.length) return false;
  return data.items.length >= 2 || awarenessV3Ready(page);
}

function shouldShowStopHeavyExecEnding(journal) {
  const page = journal || collectJournal();
  const aware = normalizeAwarenessV3Bag((page.awarenessV3) || state.journalAwarenessV3);
  const bag = normalizeExecutionChoiceBag((page.executionChoices) || state.executionChoices);
  if (!isGrowAwarenessBag(aware) || !awarenessV3HasResult(aware)) return false;
  if (executionV3HasResult(bag)) return false;
  return (aware.selectedIds || []).length === 0;
}

function syncExecV3Cta() {
  lockNewDayExecUi();
  const btn = document.getElementById("btnExecutionV3");
  if (!btn) return;
  const archived = isCurrentJournalArchived();
  const guide = (state.journalInsight || {}).guide;
  const silent = thinkGuideIsSilence(guide) && !isUnderstandGuide(guide);
  const aware = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  const confirmed = selectedAwarenessV3Texts(aware);
  const grow = isGrowAwarenessBag(aware);
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  const hasResult = executionV3HasResult(bag);
  if (silent && !confirmed.length && !hasResult) {
    btn.hidden = true;
    showExecV3Hint("");
    return;
  }
  const ready = executionV3Ready();
  const stale = hasResult && bag.sourceSig && bag.sourceSig !== executionV3SourceSig();
  const stopHeavy = shouldShowStopHeavyExecEnding();
  const show = usesExecutionV3Path() && !archived && (!hasResult || stale) && !stopHeavy;
  btn.hidden = !show;
  btn.disabled = Boolean(state.choicesBusy?.execution) || archived || !ready;
  btn.textContent = stale ? "覺察有更新，重新整理下一步 →" : "把這份覺察帶回生活 →";
  if (stopHeavy) showExecV3Hint("");
  else if (grow && !confirmed.length && show) showExecV3Hint("先完成並確認 05 覺察，才能整理下一步。");
  else if (silent && !confirmed.length) showExecV3Hint("今天沒有一定要變成行動的發現。");
  else if (!ready && show) showExecV3Hint("先確認哪一個覺察最像今天的你。");
  else if (ready) showExecV3Hint("");
}

function observationSelectedSigFromBag(data) {
  const api = reviewMergeApi();
  const selected = selectedAwarenessV3Texts(data);
  if (typeof api.observationSelectedSig === "function") return api.observationSelectedSig(data.selectedIds, selected);
  const ids = [...(data.selectedIds || [])].map(String).filter(Boolean).sort();
  return `${ids.join(",")}\n${selected.join("|")}`;
}

function observationCueMatchesBag(data) {
  const cue = data && data.observationCue;
  if (!cue || !cue.text || !(data.selectedIds || []).length) return false;
  return cue.selectedSig === observationSelectedSigFromBag(data);
}

function renderAwarenessObservationCueHtml(data) {
  const selectedCount = (data.selectedIds || []).length;
  const loading = Boolean(state.choicesBusy?.awarenessCue);
  const match = observationCueMatchesBag(data);
  const archived = isCurrentJournalArchived();
  const stored = data.observationCue && data.observationCue.text ? data.observationCue.text : "";
  if (selectedCount < 1) {
    return `
      <div class="aware-v3-cue is-helper">
        <p class="aware-v3-cue__helper">勾選真正有說中你的內容，<br />再多留意自己一點。</p>
      </div>`;
  }
  if (match) {
    return `
      <div class="aware-v3-cue">
        <p class="aware-v3-cue__label">再多看自己一點</p>
        ${markableP(stored, "awareness.observationCue", "aware-v3-cue__text")}
      </div>`;
  }
  if (archived && stored) {
    return `
      <div class="aware-v3-cue">
        <p class="aware-v3-cue__label">再多看自己一點</p>
        ${markableP(stored, "awareness.observationCue", "aware-v3-cue__text")}
      </div>`;
  }
  return `
    <div class="aware-v3-cue${loading ? "" : " is-helper"}">
      ${loading ? `<p class="aware-v3-cue__label">再多看自己一點</p>` : ""}
      <p class="aware-v3-cue__helper">${loading ? "正在整理這句觀察…" : "勾選真正有說中你的內容，<br />再多留意自己一點。"}</p>
    </div>`;
}

function renderAwarenessV3() {
  lockNewDayAwareUi();
  const root = document.getElementById("awareV3Result");
  const loader = document.getElementById("awareV3Loading");
  const data = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  const loading = Boolean(state.choicesBusy?.awareness);
  if (loader) loader.hidden = !loading;
  syncAwareV3Cta();
  if (!root) return;
  if (loading || !awarenessV3HasResult(data)) {
    if (!loading) root.innerHTML = "";
    return;
  }
  const grow = isGrowAwarenessBag(data);
  if (grow && !data.items.length) {
    root.innerHTML = `
      <article class="aware-v3-empty">
        <p class="think-v3-quote__text">今天不一定要再多加一個覺察標籤。</p>
        <p class="think-v3-why">前面若已有一個真正像你的地方，先停在那裡就好。</p>
      </article>`;
    paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.awareness);
    return;
  }
  const selected = new Set(data.selectedIds);
  const bridged = grow && data.items.length === 1 && data.items.some((item) => item.bridge);
  root.innerHTML = `
    <div class="aware-v3-list">
      ${data.items.map((item) => `
        <button type="button" class="aware-v3-item${selected.has(item.id) ? " is-on" : ""}" data-aware-v3-id="${escapeHtml(item.id)}" role="checkbox" aria-checked="${selected.has(item.id) ? "true" : "false"}">
          <span class="aware-v3-item__box" aria-hidden="true"></span>
          <span class="aware-v3-item__copy">
            ${item.title ? `<p class="aware-v3-item__title">${escapeHtml(item.title)}</p>` : ""}
            ${markableP(item.text, `awareness.item.${item.id}`, "aware-v3-item__text")}
          </span>
        </button>`).join("")}
    </div>
    ${bridged ? `<p class="aware-v3-pick">前面的思考裡，有一個地方值得你確認一下。</p>` : grow ? `<p class="aware-v3-pick">哪一個最像今天的你？</p>` : renderAwarenessObservationCueHtml(data)}`;
  paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.awareness);
  if (
    !grow &&
    !state.journalHydrating &&
    !isCurrentJournalArchived() &&
    !state.choicesBusy?.awarenessCue &&
    data.selectedIds.length >= 1 &&
    !observationCueMatchesBag(data)
  ) {
    scheduleAwarenessObservationCue();
  }
}

function renderExecutionV3() {
  lockNewDayExecUi();
  const root = document.getElementById("execV3Result");
  const loader = document.getElementById("execV3Loading");
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  const loading = Boolean(state.choicesBusy?.execution);
  if (loader) loader.hidden = !loading;
  syncExecV3Cta();
  if (!root) return;
  const act = isActExecutionBag(bag);
  if (loading) return;
  if (shouldShowStopHeavyExecEnding() && !executionV3HasResult(bag)) {
    root.innerHTML = `
      <article class="exec-v3-empty">
        <p class="think-v3-quote__text">今天沒有一定要帶走的行動。</p>
        <p class="think-v3-why">前面的內容先停在這裡也可以。</p>
      </article>`;
    return;
  }
  if (!executionV3HasResult(bag) || (!act && (bag.variant !== "execution-v3" || bag.options.length < 3))) {
    root.innerHTML = "";
    return;
  }
  if (act && !bag.options.length) {
    const copy = bag.noActionCopy && typeof bag.noActionCopy === "object" ? bag.noActionCopy : {};
    root.innerHTML = `
      <article class="exec-v3-empty">
        <p class="think-v3-quote__text">${escapeHtml(copy.line1 || "這個覺察現在不用急著變成任務。")}</p>
        <p class="think-v3-why">${escapeHtml(copy.line2 || "你已經在做了。今天先把這份改變記住，就很好。")}</p>
      </article>`;
    paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.execution);
    return;
  }
  const selected = new Set(bag.selectedIds);
  const groups = [
    { kind: "ACTION_NOW", label: "行動 1｜今天／下次當下可做的一小步" },
    { kind: "PRACTICE", label: "行動 2｜接下來可以慢慢練習的方式" },
    { kind: "OBSERVE", label: "行動 3｜觀察、記錄或事前準備", also: ["NOTICE", "TEST", "PREPARE", "RECORD", "APPRECIATE"] },
  ];
  const used = new Set();
  const sections = act
    ? groups.map((group) => {
        const kinds = new Set([group.kind].concat(group.also || []));
        const items = bag.options.filter((item) => kinds.has(item.actKind || item.kind));
        items.forEach((item) => used.add(item.id));
        if (!items.length) return "";
        return `<div class="exec-v3-group"><p class="exec-v3-group__label">${group.label}</p><div class="exec-v3-list">${items.map((item) => execV3ItemHtml(item, selected)).join("")}</div></div>`;
      }).join("") + (bag.options.some((item) => !used.has(item.id))
        ? `<div class="exec-v3-list">${bag.options.filter((item) => !used.has(item.id)).map((item) => execV3ItemHtml(item, selected)).join("")}</div>`
        : "")
    : `<div class="exec-v3-list">${bag.options.map((item) => execV3ItemHtml(item, selected)).join("")}</div>`;
  root.innerHTML = `
    ${act && bag.leadIn ? `<p class="exec-v3-lead">${escapeHtml(bag.leadIn)}</p>` : ""}
    ${sections}
    ${act ? `<p class="exec-v3-pick">哪一個你想帶去做／練習？</p>` : ""}`;
  paintInternalModelDebug(root, state.internalModelDebug && state.internalModelDebug.execution);
}

function execV3ItemHtml(item, selected) {
  return `
        <button type="button" class="exec-v3-item${selected.has(item.id) ? " is-on" : ""}" data-choice-id="${escapeHtml(item.id)}" data-choice-kind="execution" role="checkbox" aria-checked="${selected.has(item.id) ? "true" : "false"}">
          <span class="exec-v3-item__box" aria-hidden="true"></span>
          <span class="exec-v3-item__copy">
            ${markableP(item.text, `exec.item.${item.id}.title`, "exec-v3-item__title")}
            ${item.detail ? markableP(item.detail, `exec.item.${item.id}.detail`, "exec-v3-item__detail") : ""}
          </span>
        </button>`;
}

function toggleAwarenessV3(id) {
  if (rejectArchivedJournalWrite()) return normalizeAwarenessV3Bag(state.journalAwarenessV3);
  const data = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  if (!data.items.some((item) => item.id === id)) return data;
  const has = data.selectedIds.includes(id);
  data.selectedIds = has ? data.selectedIds.filter((item) => item !== id) : data.selectedIds.concat(id).slice(0, 3);
  if (data.observationCue && data.observationCue.selectedSig !== observationSelectedSigFromBag(data)) {
    data.observationCue = data.observationCue.text ? { ...data.observationCue } : null;
  }
  state.journalAwarenessV3 = data;
  renderAwarenessV3();
  persistJournalQuietly();
  renderExecutionV3();
  syncExecV3Cta();
  if (!isCurrentJournalArchived()) scheduleAwarenessObservationCue();
  return data;
}

function scheduleAwarenessObservationCue() {
  if (state.awarenessCueTimer) clearTimeout(state.awarenessCueTimer);
  const data = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  if (data.selectedIds.length < 1 || isCurrentJournalArchived() || state.journalHydrating) return;
  state.awarenessCueTimer = setTimeout(() => {
    state.awarenessCueTimer = 0;
    catchAsync(() => generateAwarenessObservationCue({ confirmed: true }), "");
  }, 420);
}

async function generateAwarenessObservationCue(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  if (isCurrentJournalArchived() || state.journalHydrating) return;
  const data = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  if (data.items.length < 2 || data.selectedIds.length < 1) return;
  const sig = observationSelectedSigFromBag(data);
  if (observationCueMatchesBag(data)) return;
  if (state.awarenessCueAttemptSig === sig && !options.force && !state.choicesBusy?.awarenessCue) return;
  if (!ensurePlusFeature("awareness_ai", options)) return;
  const token = (state.choicesToken.awarenessCue || 0) + 1;
  state.choicesToken.awarenessCue = token;
  state.choicesBusy.awarenessCue = true;
  state.awarenessCueAttemptSig = sig;
  renderAwarenessV3();
  try {
    if (!state.user) return;
    const ctx = awarenessV3Context();
    const selected = selectedAwarenessV3Texts(data);
    const remote = await postReview({
      mode: "choices",
      kind: "awareness",
      variant: "awareness-v3-cue",
      step: "observation-cue",
      date: currentIso(),
      text: selected.join("\n"),
      context: {
        variant: "awareness-v3-cue",
        selectedAwareness: selected,
        thanksText: ctx.thanksText,
        thanks: ctx.thanks,
        event: ctx.event,
        mood: ctx.mood,
        bodyMindText: ctx.bodyMindText,
        bodyNote: ctx.bodyNote,
        coreQuote: ctx.coreQuote,
        thinkCoreQuote: ctx.thinkCoreQuote,
        thinkQuestions: ctx.thinkQuestions,
      },
    });
    if (state.choicesToken.awarenessCue !== token) return;
    const text = String((remote && remote.text) || "").replace(/\s+/g, " ").trim();
    if (!text || /跟對方談談|寫下來|設定界線|明天試著|列出三件|你需要學會|你應該/.test(text)) return;
    const latest = normalizeAwarenessV3Bag(state.journalAwarenessV3);
    const latestSig = observationSelectedSigFromBag(latest);
    if (latestSig !== sig) return;
    latest.observationCue = {
      text,
      selectedSig: latestSig,
      generatedAt: new Date().toISOString(),
    };
    state.journalAwarenessV3 = latest;
    persistJournalQuietly();
    renderAwarenessV3();
  } catch (_error) {
    if (state.choicesToken.awarenessCue !== token) return;
  } finally {
    if (state.choicesToken.awarenessCue === token) {
      state.choicesBusy.awarenessCue = false;
      renderAwarenessV3();
    }
  }
}

async function generateAwarenessV3(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.choicesBusy?.awareness) return;
  pinAwareFold();
  const journal = collectJournal();
  const guide = (journal.insight && journal.insight.guide) || (state.journalInsight && state.journalInsight.guide);
  if (thinkGuideIsSilence(guide) && !isUnderstandGuide(guide)) {
    syncAwareV3Cta();
    return;
  }
  if (!awarenessV3Ready(journal)) {
    showAwareV3Hint(isUnderstandGuide(guide) && !understandIsComplete(guide) ? "先把今天的深度思考走完，再來看可以帶走的覺察。" : "先把今日感謝、事件、身心覺察和深度思考整理好。");
    syncAwareV3Cta();
    return;
  }
  if (!ensurePlusFeature("awareness_ai", options)) return;
  const sig = awarenessV3SourceSig(journal);
  const current = normalizeAwarenessV3Bag(state.journalAwarenessV3);
  if (awarenessV3HasResult(current) && current.sourceSig === sig && !options.force) {
    renderAwarenessV3();
    return;
  }
  const token = (state.choicesToken.awareness || 0) + 1;
  state.choicesToken.awareness = token;
  state.choicesBusy.awareness = true;
  renderAwarenessV3();
  try {
    if (!state.user) throw new Error("請先登入，才能整理今天的覺察。");
    const ctx = awarenessV3Context(journal);
    const remote = await postReview({
      mode: "choices",
      kind: "awareness",
      variant: "awareness-v3",
      date: currentIso(),
      text: ctx.event,
      context: { variant: "awareness-v3", ...ctx },
    });
    if (state.choicesToken.awareness !== token) return;
    const items = Array.isArray(remote.items)
      ? remote.items.map((item, index) => {
          const text = String((item && item.text) || "").replace(/\s+/g, " ").trim();
          if (!text) return null;
          const title = String((item && item.title) || "").replace(/\s+/g, " ").trim();
          const out = { id: String((item && item.id) || `a${index + 1}`), text };
          if (title) out.title = title;
          if (item && item.type) out.type = String(item.type || "").trim();
          if (item && item.maturity) out.maturity = String(item.maturity || "").trim();
          if (item && item.bridge) out.bridge = true;
          return out;
        }).filter(Boolean).slice(0, 3)
      : [];
    const grow = isGrowAwarenessBag(remote);
    if (!grow && items.length < 2) throw new Error("今天的覺察還沒整理好，請再試一次。");
    state.journalAwarenessV3 = {
      variant: "awareness-v3",
      growVariant: grow ? "grow-v1" : "",
      status: grow ? (items.length ? "grow" : "empty") : "generated",
      sourceSig: sig,
      items,
      selectedIds: [],
      generatedAt: new Date().toISOString(),
      observationCue: null,
      emptyCopy: remote.emptyCopy || null,
    };
    state.awarenessCueAttemptSig = "";
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.awareness = takeInternalDebug(remote);
    persistJournalQuietly();
    renderAwarenessV3();
    renderExecutionV3();
    syncExecV3Cta();
  } catch (error) {
    if (state.choicesToken.awareness !== token) return;
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "今天的覺察還沒整理好，請再試一次。");
    renderAwarenessV3();
  } finally {
    if (state.choicesToken.awareness === token) {
      state.choicesBusy.awareness = false;
      renderAwarenessV3();
      renderExecutionV3();
    }
  }
}

async function generateExecutionV3(options = {}) {
  if (!options || options.confirmed !== true) return;
  if (options.auto) return;
  if (rejectArchivedJournalWrite(options)) return;
  if (isCurrentJournalArchived() || state.choicesBusy?.execution) return;
  setJournalFoldOpen("section-exec", true, { manual: true });
  const journal = collectJournal();
  if (thinkGuideIsSilence((journal.insight && journal.insight.guide) || (state.journalInsight && state.journalInsight.guide)) && !selectedAwarenessV3Texts(journal.awarenessV3 || state.journalAwarenessV3).length) {
    syncExecV3Cta();
    return;
  }
  if (!executionV3Ready(journal)) {
    const grow = isGrowAwarenessBag(normalizeAwarenessV3Bag(journal.awarenessV3 || state.journalAwarenessV3));
    showExecV3Hint(grow ? "先確認哪一個覺察最像今天的你。" : "先看看今天真正看見了自己什麼。");
    syncExecV3Cta();
    return;
  }
  if (!ensurePlusFeature("execution_ai", options)) return;
  const sig = executionV3SourceSig(journal);
  const current = normalizeExecutionChoiceBag(state.executionChoices);
  if (executionV3HasResult(current) && current.sourceSig === sig && !options.force) {
    renderExecutionV3();
    return;
  }
  const token = (state.choicesToken.execution || 0) + 1;
  state.choicesToken.execution = token;
  state.choicesBusy.execution = true;
  renderExecutionV3();
  try {
    if (!state.user) throw new Error("請先登入，才能整理今天的下一步。");
    const ctx = executionV3Context(journal);
    const remote = await postReview({
      mode: "choices",
      kind: "execution",
      variant: "execution-v3",
      date: currentIso(),
      text: ctx.event,
      context: { variant: "execution-v3", ...ctx },
    });
    if (state.choicesToken.execution !== token) return;
    const actions = Array.isArray(remote.actions)
      ? remote.actions.map((item, index) => {
          const text = String((item && (item.title || item.text)) || "").replace(/\s+/g, " ").trim();
          if (!text) return null;
          const next = {
            id: String((item && item.id) || `e${index + 1}`),
            text,
            detail: String((item && item.detail) || "").replace(/\s+/g, " ").trim(),
          };
          if (item && item.kind) next.kind = String(item.kind || "").trim();
          if (item && item.actKind) next.actKind = String(item.actKind || "").trim();
          if (Array.isArray(item && item.sourceAwarenessIds)) next.sourceAwarenessIds = item.sourceAwarenessIds;
          return next;
        }).filter(Boolean).slice(0, 3)
      : [];
    const act = remote.actVariant === "act-v1" || remote.status === "actions" || remote.status === "no-action" || remote.status === "blocked";
    if (act && remote.blocked) {
      showExecV3Hint("先完成並確認 05 覺察，才能整理下一步。");
      return;
    }
    if (!act && actions.length < 3) throw new Error("今天的下一步還沒整理好，請再試一次。");
    if (act && remote.status === "actions" && actions.length !== 3) throw new Error("今天的下一步還沒整理好，請再試一次。");
    state.executionChoices = serializeExecutionChoiceBag({
      variant: "execution-v3",
      actVariant: act ? "act-v1" : "",
      status: act ? (actions.length ? "actions" : "no-action") : "",
      sourceSig: sig,
      options: actions,
      selectedIds: [],
      selectedId: "",
      custom: "",
      followupQuestion: "",
      followupPlaceholder: "",
      generatedAt: new Date().toISOString(),
      noActionCopy: remote.noActionCopy || null,
      leadIn: remote.leadIn || "",
      deep: { status: "", rounds: [], draftAnswer: "", refreshedAt: "", executionSummary: "", finalOptions: [], finalSelectedIds: [] },
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.execution = takeInternalDebug(remote);
    persistJournalQuietly();
    renderExecutionV3();
  } catch (error) {
    if (state.choicesToken.execution !== token) return;
    if (isPlusRequiredError(error)) return;
    showToast(formatApiError(error) || "今天的下一步還沒整理好，請再試一次。");
    renderExecutionV3();
  } finally {
    if (state.choicesToken.execution === token) {
      state.choicesBusy.execution = false;
      renderExecutionV3();
    }
  }
}

function applyThinkV2Guide(patch) {
  const insight = normalizeInsight(state.journalInsight);
  const next = { ...(insight.guide || emptyThinkGuide()), ...patch, variant: "think-v2" };
  insight.guide = normalizeThinkGuide(next);
  if (next.title) insight.title = next.title;
  if (next.awareness || next.summary) {
    insight.conclusion = next.awareness || next.summary;
    insight.psychology = next.awareness || next.summary;
  }
  state.journalInsight = insight;
  return insight;
}

function renderThinkV2() {
  lockNewDayThinkUi();
  const root = document.getElementById("thinkQuestions");
  const empty = document.getElementById("thinkEmpty");
  const genBtn = document.getElementById("btnThinkChoices");
  const closeBtn = document.getElementById("btnThinkClose");
  if (!root) return;
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  const archived = isCurrentJournalArchived();
  const loading = Boolean(state.choicesBusy?.think);
  const closeLoading = Boolean(state.choicesBusy?.thinkClose);
  const closed = thinkV2Closed(guide);
  const pending = thinkV2CurrentQuestion(guide);
  const answered = thinkV2AnsweredRounds(guide);
  if (empty) {
    empty.textContent = THINK_WAIT_COPY;
    empty.hidden = Boolean((guide.rounds || []).length || loading || closed);
  }
  if (genBtn) {
    const showStart = !(guide.rounds || []).length && !closed;
    genBtn.hidden = !showStart || loading;
    genBtn.disabled = loading || archived;
    genBtn.classList.toggle("is-busy", loading && showStart);
    genBtn.setAttribute("aria-busy", loading && showStart ? "true" : "false");
    genBtn.textContent = loading ? "正在整理今天的問題…" : "✦ 開始今天的深度思考";
  }
  if (closeBtn) {
    const showClose = Boolean(answered.length && !closed && !pending);
    closeBtn.hidden = !(showClose || closeLoading);
    closeBtn.disabled = closeLoading || archived || !answered.length;
    closeBtn.classList.toggle("is-busy", closeLoading);
    closeBtn.textContent = closeLoading ? "正在整理…" : "✦ 整理今天的深度看見";
  }
  if (!(guide.rounds || []).length && !closed) {
    root.innerHTML = "";
    renderThinkChoiceResult(state.journalInsight);
    return;
  }
  const doneCards = (closed ? guide.rounds : answered)
    .filter((item) => String(item.question || "").trim())
    .map((item) => `<article class="think-guide__round is-done think-v2__done">
        <p class="think-guide__q">${escapeHtml(item.question)}</p>
        ${item.answer ? `<p class="think-guide__answer">${escapeHtml(item.answer)}</p>` : ""}
      </article>`)
    .join("");
  let active = "";
  if (!closed && pending) {
    active = archived
      ? `<article class="think-guide__round is-on think-v2__now">
        <p class="think-guide__q">${escapeHtml(pending.question)}</p>
      </article>`
      : `<article class="think-guide__round is-on think-v2__now">
        <p class="think-guide__q">${escapeHtml(pending.question)}</p>
        ${pending.hint ? `<p class="think-guide__hint">${escapeHtml(pending.hint)}</p>` : ""}
        <label class="think-guide__field">
          <textarea class="textarea think-guide-answer" id="thinkV2Answer" rows="4" placeholder="把此刻想到的寫下來就好">${escapeHtml(guide.draftAnswer || "")}</textarea>
          <button class="ai-check-btn ai-check-btn--label" id="btnThinkV2Next" type="button"${loading || closeLoading ? " disabled" : ""}>${loading ? "正在整理…" : "繼續"}</button>
        </label>
      </article>`;
  }
  root.innerHTML = `<div class="think-v2 think-guide">${doneCards}${active}</div>`;
  renderThinkChoiceResult(state.journalInsight);
  paintInternalModelDebug(
    closed ? document.getElementById("thinkChoiceResult") || root : root,
    state.internalModelDebug && state.internalModelDebug.think
  );
}

async function generateThinkV2Ask(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  setJournalFoldOpen("section-deep", true, { manual: true });
  if (!ensurePlusFeature("think_ai", options)) return;
  if (state.choicesBusy?.think || state.choicesBusy?.thinkClose) {
    if (!options.auto) showToast("還在整理，請稍候。");
    return;
  }
  const journal = collectJournal();
  if (!coreStoryReady(journal)) {
    if (!options.auto) showToast("請先寫下今日感謝、事件，並選擇心情。");
    return;
  }
  const current = normalizeThinkGuide((state.journalInsight || {}).guide);
  if (thinkV2Closed(current)) {
    renderThinkV2();
    return;
  }
  if (thinkV2CurrentQuestion(current)) {
    renderThinkV2();
    return;
  }
  const answered = thinkV2AnsweredRounds(current);
  const token = (state.choicesToken.think || 0) + 1;
  state.choicesToken.think = token;
  setChoicesLoading("think", true);
  try {
    if (!state.user) throw new Error("請先登入，才能開始今天的深度思考。");
    const remote = await postReview({
      mode: "insight",
      variant: "think-v2",
      step: "ask",
      round: answered.length + 1,
      date: currentIso(),
      text: journal.event,
      context: {
        variant: "think-v2",
        thanksText: thanksTextFrom(journal),
        thanks: thanksTextFrom(journal),
        event: journal.event,
        mood: journal.mood,
        bodyCheck: journal.bodyCheck,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        bodyMindText: journal.bodyMind && journal.bodyMind.text,
        bodyMindInsight: journal.bodyMind && journal.bodyMind.insight,
        rounds: answered,
      },
    });
    if (state.choicesToken.think !== token) return;
    if (remote.readyToClose || !String(remote.question || "").trim()) {
      await generateThinkV2Close({ auto: true, fromAsk: true });
      return;
    }
    const rounds = answered.concat([
      {
        question: String(remote.question || "").trim(),
        hint: String(remote.hint || "").trim(),
        observation: String(remote.observation || "").trim(),
        answer: "",
        focus: String(remote.focus || "").trim(),
      },
    ]);
    applyThinkV2Guide({
      status: "asking",
      rounds,
      round: rounds.length,
      draftAnswer: "",
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.think = takeInternalDebug(remote);
    persistJournalQuietly();
    renderThinkV2();
  } catch (error) {
    if (state.choicesToken.think !== token) return;
    if (isPlusRequiredError(error)) return;
    if (!options.auto) showToast(formatApiError(error) || "這次問題還沒好，請再試一次。");
    renderThinkV2();
  } finally {
    if (state.choicesToken.think === token) setChoicesLoading("think", false);
  }
}

async function submitThinkV2Answer(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  if (state.choicesBusy?.think || state.choicesBusy?.thinkClose) {
    showToast("還在整理，請稍候。");
    return;
  }
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  const pending = thinkV2CurrentQuestion(guide);
  if (!pending) {
    if (thinkV2AnsweredRounds(guide).length && !thinkV2Closed(guide)) return generateThinkV2Close(options);
    return;
  }
  const answer = String(document.getElementById("thinkV2Answer")?.value || guide.draftAnswer || "").trim();
  if (!answer) {
    showToast("先把想到的寫下來，再繼續。");
    return;
  }
  const rounds = (guide.rounds || []).map((item) => {
    if (item.question === pending.question && !item.answer) return { ...item, answer };
    return item;
  });
  applyThinkV2Guide({
    rounds,
    draftAnswer: "",
    status: "asking",
    round: thinkV2AnsweredRounds({ ...guide, rounds }).length,
  });
  persistJournalQuietly();
  renderThinkV2();
  await generateThinkV2Ask({ auto: true });
}

async function generateThinkV2Close(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  const guide = normalizeThinkGuide((state.journalInsight || {}).guide);
  if (thinkV2Closed(guide) && (guide.awareness || guide.selfSeen || (guide.close && guide.close.coreConclusion))) {
    renderThinkV2();
    return;
  }
  const answered = thinkV2AnsweredRounds(guide);
  if (!answered.length) {
    if (!options.auto) showToast("先回答今天的問題。");
    return;
  }
  if (!ensurePlusFeature("think_ai", options)) return;
  if (state.choicesBusy?.thinkClose) {
    if (!options.auto) showToast("還在整理今天的深度看見，請稍候。");
    return;
  }
  const journal = collectJournal();
  const token = (state.choicesToken.thinkClose || 0) + 1;
  state.choicesToken.thinkClose = token;
  state.choicesBusy.thinkClose = true;
  renderThinkV2();
  const closeLoader = document.getElementById("thinkCloseLoading");
  if (closeLoader) closeLoader.hidden = false;
  try {
    if (!state.user) throw new Error("請先登入，才能整理今天的深度看見。");
    const remote = await postReview({
      mode: "insight",
      variant: "think-v2",
      step: "close",
      date: currentIso(),
      text: journal.event,
      context: {
        variant: "think-v2",
        thanksText: thanksTextFrom(journal),
        thanks: thanksTextFrom(journal),
        event: journal.event,
        mood: journal.mood,
        bodyCheck: journal.bodyCheck,
        bodyTags: journal.bodyTags,
        bodyNote: journal.bodyNote,
        bodyMindText: journal.bodyMind && journal.bodyMind.text,
        bodyMindInsight: journal.bodyMind && journal.bodyMind.insight,
        rounds: answered,
      },
    });
    if (state.choicesToken.thinkClose !== token) return;
    const core = String(remote.coreConclusion || remote.stuck || remote.awareness || "").trim();
    const seen = String(remote.seen || remote.selfSeen || "").trim();
    const blind =
      String(remote.blindSpot || (remote.close && remote.close.blindSpot) || "").trim() ||
      "目前沒有明顯需要再往深處解讀的地方。";
    const improve = String(
      remote.improvementDirection || remote.direction || (remote.close && remote.close.improvementDirection) || ""
    ).trim();
    if (!core && !seen) throw new Error("今天的深度看見還沒整理好，請再試一次。");
    applyThinkV2Guide({
      status: "closed",
      rounds: answered,
      title: String(remote.title || "").trim(),
      summary: core,
      awareness: core,
      selfSeen: seen,
      takeaway: String(remote.unknown || remote.takeaway || "").trim(),
      direction: improve,
      close: {
        coreConclusion: core,
        blindSpot: blind,
        improvementDirection: improve,
      },
      draftAnswer: "",
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.think = takeInternalDebug(remote);
    persistJournalQuietly();
    renderThinkV2();
    if (!options.auto && !options.fromAsk) showToast("今天的深度看見，已經整理好了。");
  } catch (error) {
    if (state.choicesToken.thinkClose !== token) return;
    if (isPlusRequiredError(error)) return;
    if (!options.auto) showToast(formatApiError(error) || "今天的深度看見還沒整理好，請再試一次。");
    renderThinkV2();
  } finally {
    if (state.choicesToken.thinkClose === token) {
      state.choicesBusy.thinkClose = false;
      if (closeLoader) closeLoader.hidden = true;
      renderThinkV2();
    }
  }
}

function executionContextEnough(journal) {
  const think = thinkBitsFrom(journal);
  const aware = awarenessBitsFrom(journal);
  return Boolean(
    aware.line ||
    aware.seen ||
    (aware.selected && aware.selected.length) ||
    (think.selected && think.selected.length) ||
    think.awareness ||
    think.selfSeen ||
    think.takeaway
  );
}

function localExecutionChoiceFallbacks(journal) {
  const think = thinkBitsFrom(journal);
  const aware = awarenessBitsFrom(journal);
  const blob = [
    aware.line,
    aware.seen,
    ...(aware.selected || []),
    ...(think.selected || []),
    think.awareness,
    think.selfSeen,
    journal?.event,
    thanksTextFrom(journal),
    Array.isArray(journal?.bodyTags) ? journal.bodyTags.join(" ") : "",
    journal?.bodyNote,
  ]
    .filter(Boolean)
    .join(" ");
  const api = reviewMergeApi();
  const candidates =
    typeof api.insightExecutionFallbackOptions === "function" ? api.insightExecutionFallbackOptions(blob) : [];
  const lookSimilar = typeof api.choicesLookSimilar === "function" ? api.choicesLookSimilar.bind(api) : () => false;
  const extras = typeof api.executionChoiceOptionExtras === "function" ? api.executionChoiceOptionExtras.bind(api) : () => ({});
  const items = [];
  candidates.forEach((item) => {
    if (items.some((entry) => lookSimilar(entry.text, item.text))) return;
    items.push({ id: item.id, text: item.text, ...extras(item, item.text) });
  });
  return items.slice(0, 3);
}

async function generateExecutionChoices(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  setJournalFoldOpen("section-exec", true, { manual: true });
  if (!ensurePlusFeature("execution_ai", options)) return;
  if (state.choicesBusy?.execution) {
    if (!options.auto) showToast("還在為你整理明天的小行動，請稍候。");
    return;
  }
  const journal = collectJournal();
  if (!coreStoryReady(journal)) {
    if (!options.auto) showToast("請先寫下今日感謝、事件，並選擇心情。");
    return;
  }
  const existing = normalizeExecutionChoiceBag(state.executionChoices);
  const followupAnswer = String(options.followupAnswer || "").trim();
  if (!options.force && existing.options.length >= 3 && !followupAnswer) {
    renderExecutionChoices(existing);
    return;
  }
  const token = (state.choicesToken.execution || 0) + 1;
  state.choicesToken.execution = token;
  setChoicesLoading("execution", true);
  const fallback = localExecutionChoiceFallbacks(journal);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const remote = await postReview({
      mode: "choices",
      kind: "execution",
      date: currentIso(),
      text: journal.event,
      answers: followupAnswer ? [followupAnswer] : undefined,
      context: {
        ...choicesContext(journal, priorThinkAwareContext(journal)),
        alreadyDone: String(journal.event || ""),
        followupAnswer,
      },
      progress: { streak: collectGrowthProgress().streak },
    });
    if (state.choicesToken.execution !== token) return;
    const optionsList = normalizeExecutionChoiceBag({ options: remote.options }).options;
    if (optionsList.length < 3) throw new Error("今天的行動還沒準備好，請再試一次。");
    state.executionChoices = serializeExecutionChoiceBag({
      ...existing,
      sourceSig: `${thanksTextFrom(journal)}\n${journal.event}\n${journal.mood}`,
      options: optionsList.slice(0, 3),
      selectedId: existing.selectedId,
      selectedIds: existing.selectedIds.filter((id) => id === execChoiceCustomId() || optionsList.some((item) => item.id === id)),
      custom: existing.custom,
      followupQuestion: "",
      followupPlaceholder: "",
      generatedAt: new Date().toISOString(),
      deep: existing.deep,
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.execution = takeInternalDebug(remote);
    renderExecutionChoices(state.executionChoices);
    persistJournalQuietly();
    trackProduct("execution_choices_generated", { source: "journal", mode: "deep" });
    if (!options.auto) showToast("今天的下一步已經準備好了。");
  } catch (error) {
    if (state.choicesToken.execution !== token) return;
    if (isPlusRequiredError(error)) return;
    if (fallback.length >= 3) {
      state.executionChoices = serializeExecutionChoiceBag({
        ...existing,
        sourceSig: `${thanksTextFrom(journal)}\n${journal.event}\n${journal.mood}`,
        options: fallback.slice(0, 3),
        selectedId: existing.selectedId,
        selectedIds: existing.selectedIds,
        custom: existing.custom,
        followupQuestion: "",
        followupPlaceholder: "",
        generatedAt: new Date().toISOString(),
        deep: existing.deep,
      });
      renderExecutionChoices(state.executionChoices);
      persistJournalQuietly();
      trackProduct("execution_choices_generated", { source: "local", mode: "deep" });
      if (!options.auto) showToast(`雲端選項還沒好：${formatApiError(error)}，先用本地整理。`);
    } else if (!options.auto) {
      showToast("這次行動還沒有完整生成，請再試一次。");
    }
  } finally {
    if (state.choicesToken.execution === token) setChoicesLoading("execution", false);
  }
}

function patchExecDeep(patch) {
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  bag.deep = normalizeExecDeep({ ...(bag.deep || emptyExecDeep()), ...patch });
  state.executionChoices = serializeExecutionChoiceBag(bag);
  return state.executionChoices;
}

async function generateExecDeepAsk(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  if (!ensurePlusFeature("execution_ai", options)) return;
  if (state.choicesBusy?.executionDeep) {
    if (!options.auto) showToast("還在整理問題，請稍候。");
    return;
  }
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  if (!bag.options.length) {
    if (!options.auto) showToast("先整理今天的下一步，再想深一點。");
    return;
  }
  if (execDeepClosed(bag.deep) || execDeepAnsweredRounds(bag.deep).length >= 2) {
    if (!hasExecDeepFinal(bag.deep) && execDeepAnsweredRounds(bag.deep).length) return generateExecDeepFinal(options);
    renderExecutionChoices(bag);
    return;
  }
  if (execDeepCurrentQuestion(bag.deep)) {
    renderExecutionChoices(bag);
    return;
  }
  if (shouldSkipExecDeepAsk(bag.deep, bag.options)) {
    patchExecDeep({ status: "closed", draftAnswer: "" });
    persistJournalQuietly();
    return generateExecDeepFinal(options);
  }
  const journal = collectJournal();
  const token = (state.choicesToken.executionDeep || 0) + 1;
  state.choicesToken.executionDeep = token;
  setChoicesLoading("executionDeep", true);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const remote = await postReview({
      mode: "choices",
      kind: "execution-deep",
      step: "ask",
      date: currentIso(),
      text: journal.event,
      context: {
        ...choicesContext(journal, priorThinkAwareContext(journal)),
        variant: "exec-deep",
        step: "ask",
        actions: bag.options,
        deep: bag.deep,
      },
      progress: { streak: collectGrowthProgress().streak },
    });
    if (state.choicesToken.executionDeep !== token) return;
    const question = String(remote.question || "").trim();
    if (!question || remote.readyToClose) {
      patchExecDeep({ status: "closed", draftAnswer: "" });
      persistJournalQuietly();
      await generateExecDeepFinal({ ...options, allowBusy: true });
      return;
    }
    const deep = normalizeExecDeep(bag.deep);
    if (deep.rounds.length >= 2) {
      patchExecDeep({ status: "closed", draftAnswer: "" });
      persistJournalQuietly();
      await generateExecDeepFinal({ ...options, allowBusy: true });
      return;
    }
    deep.rounds = deep.rounds.concat([{ id: `d${deep.rounds.length + 1}`, question, placeholder: String(remote.placeholder || "").trim(), answer: "" }]).slice(0, 2);
    deep.status = "asking";
    deep.draftAnswer = "";
    patchExecDeep(deep);
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.execution = takeInternalDebug(remote);
    renderExecutionChoices(state.executionChoices);
    persistJournalQuietly();
  } catch (error) {
    if (state.choicesToken.executionDeep !== token) return;
    if (isPlusRequiredError(error)) return;
    if (!options.auto) showToast(formatApiError(error) || "這次問題還沒好，請再試一次。");
  } finally {
    if (state.choicesToken.executionDeep === token) setChoicesLoading("executionDeep", false);
  }
}

async function submitExecDeepAnswer(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  const pending = execDeepCurrentQuestion(bag.deep);
  if (!pending) {
    if (execDeepClosed(bag.deep)) return;
    return generateExecDeepAsk(options);
  }
  const answer = String(document.getElementById("execDeepAnswer")?.value || bag.deep.draftAnswer || "").trim();
  if (!answer) {
    if (!options.auto) showToast("先寫下一句就好。");
    return;
  }
  const deep = normalizeExecDeep(bag.deep);
  deep.rounds = deep.rounds.map((item) => (item.question === pending.question && !item.answer ? { ...item, answer } : item));
  deep.draftAnswer = "";
  const answered = execDeepAnsweredRounds(deep);
  if (answered.length >= 2 || shouldSkipExecDeepAsk(deep, bag.options)) {
    deep.status = "closed";
    patchExecDeep(deep);
    persistJournalQuietly();
    await generateExecDeepFinal(options);
    return;
  }
  deep.status = "asking";
  patchExecDeep(deep);
  persistJournalQuietly();
  await generateExecDeepAsk(options);
}

async function generateExecDeepFinal(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  if (!ensurePlusFeature("execution_ai", options)) return;
  const bag = normalizeExecutionChoiceBag(state.executionChoices);
  if (hasExecDeepFinal(bag.deep) && !options.force) {
    renderExecutionChoices(bag);
    return;
  }
  if (!execDeepAnsweredRounds(bag.deep).length) {
    renderExecutionChoices(bag);
    return;
  }
  if (state.choicesBusy?.executionDeep && !options.allowBusy) {
    if (!options.auto) showToast("還在整理，請稍候。");
    return;
  }
  const journal = collectJournal();
  const token = (state.choicesToken.executionDeep || 0) + 1;
  state.choicesToken.executionDeep = token;
  setChoicesLoading("executionDeep", true);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const kept = selectedExecutionChoiceActions({ ...bag, deep: { ...bag.deep, finalSelectedIds: [] } });
    const remote = await postReview({
      mode: "choices",
      kind: "execution-deep",
      step: "close",
      date: currentIso(),
      text: journal.event,
      context: {
        ...choicesContext(journal, priorThinkAwareContext(journal)),
        variant: "exec-deep",
        step: "close",
        actions: bag.options,
        keptActions: kept,
        deep: bag.deep,
      },
      progress: { streak: collectGrowthProgress().streak },
    });
    if (state.choicesToken.executionDeep !== token) return;
    const incoming = normalizeExecutionChoiceBag({ options: remote.options }).options.map((item, index) => ({
      ...item,
      id: `f${index + 1}`,
    }));
    const summary = String(remote.executionSummary || "").replace(/\s+/g, " ").trim();
    if (incoming.length < 3 || !summary) throw new Error("今天的執行力還沒整理好，請再試一次。");
    const lookSimilar = typeof reviewMergeApi().choicesLookSimilar === "function" ? reviewMergeApi().choicesLookSimilar.bind(reviewMergeApi()) : () => false;
    const finalSelectedIds = incoming
      .filter((item) => kept.some((sel) => lookSimilar(sel.text, item.text)))
      .map((item) => item.id);
    state.executionChoices = serializeExecutionChoiceBag({
      ...bag,
      deep: {
        ...normalizeExecDeep(bag.deep),
        status: "closed",
        executionSummary: summary,
        finalOptions: incoming.slice(0, 3),
        finalSelectedIds,
        refreshedAt: new Date().toISOString(),
      },
    });
    if (!state.internalModelDebug) state.internalModelDebug = {};
    state.internalModelDebug.execution = takeInternalDebug(remote);
    renderExecutionChoices(state.executionChoices);
    persistJournalQuietly();
  } catch (error) {
    if (state.choicesToken.executionDeep !== token) return;
    if (isPlusRequiredError(error)) return;
    if (!options.auto) showToast(formatApiError(error) || "這次還沒整理好，請再試一次。");
  } finally {
    if (state.choicesToken.executionDeep === token) setChoicesLoading("executionDeep", false);
  }
}

function applyThinkChoicesClose(closed) {
  const insight = normalizeInsight(state.journalInsight);
  const guide = insight.guide || emptyThinkGuide();
  insight.guide = {
    ...guide,
    title: closed.title || guide.title,
    summary: closed.awareness || closed.summary || guide.summary,
    awareness: closed.awareness || closed.summary || guide.awareness,
    selfSeen: closed.selfSeen || guide.selfSeen,
    takeaway: closed.takeaway || guide.takeaway,
    highlights: closed.highlights || guide.highlights,
  };
  if (closed.title) insight.title = closed.title;
  state.journalInsight = insight;
  renderThinkChoiceResult(insight);
  persistJournalQuietly();
}

function localThinkChoicesClose(journal, bag) {
  const selected = selectedChoiceTexts(bag);
  const eventRaw = String(journal?.event || "").trim();
  const event = eventRaw && eventRaw.replace(/\s+/g, "").length <= 42 ? eventRaw : "今天這件事";
  const line = selected[0] || "今天我先把真正有感的那一層留下來。";
  return {
    title: "今天真正有感的那一層",
    awareness: `${event}裡，有些東西比事情本身更靠近你。\n\n${selected.length ? `你勾選的是：${selected.join("；")}。` : "你今天沒有特別勾選，這也表示那些現成的句子還不是最貼近的。"}\n\n也許值得繼續觀察的，不是再解釋一次發生了什麼，而是你真正想留下的感覺。`,
    selfSeen: selected[0] ? `我看見：${selected[0]}` : "我看見自己今天先停在「還沒有特別符合的選項」。",
    takeaway: (() => {
      const raw = String(line || "").replace(/[。！？]+$/g, "").trim();
      const api = textIntegrityApi();
      if (typeof api.looksComplete === "function" && api.looksComplete(raw)) return raw;
      if (typeof api.isCompleteSentence === "function" && (api.isCompleteSentence(raw) || api.isCompleteSentence(`${raw}。`))) {
        return raw;
      }
      return "今天先把真正有感的那一層留下來";
    })(),
    highlights: {},
  };
}

function renderExecutionQuestions(prompts, options = {}) {
  if (usesExecutionV3Path()) {
    renderExecutionV3();
    return;
  }
  if (usesExecutionChoiceUi()) {
    renderExecutionChoices(state.executionChoices);
    return;
  }
  const root = document.getElementById("execQuestions");
  const empty = document.getElementById("execEmpty");
  const genBtn = document.getElementById("btnExecPrompts");
  const checkBtn = document.getElementById("btnExecAi");
  const items = normalizeExecutionPrompts(prompts);
  if (!root) return;
  syncExecStepUi();
  if (!items.length) {
    root.innerHTML = "";
    if (empty) {
      empty.textContent = EXEC_WAIT_COPY;
      empty.hidden = Boolean(state.corePromptsBusy);
    }
    if (genBtn) {
      genBtn.hidden = false;
      genBtn.disabled = false;
      genBtn.classList.toggle("is-busy", Boolean(state.corePromptsBusy));
      genBtn.setAttribute("aria-busy", state.corePromptsBusy ? "true" : "false");
      genBtn.textContent = state.corePromptsBusy ? "正在整理行動問題…" : "✦ 開始今天的行動整理";
    }
    if (checkBtn) checkBtn.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  const stale = executionPromptsAreStale(items);
  if (genBtn) {
    genBtn.hidden = !stale;
    if (!genBtn.hidden) {
      genBtn.disabled = false;
      genBtn.classList.toggle("is-busy", Boolean(state.corePromptsBusy));
      genBtn.setAttribute("aria-busy", state.corePromptsBusy ? "true" : "false");
      genBtn.textContent = state.corePromptsBusy ? "正在整理行動問題…" : "重新整理行動問題";
    }
  }
  if (checkBtn) checkBtn.hidden = false;
  const saved = Array.isArray(options.answers)
    ? options.answers.map((item) => String(item || ""))
    : collectExecutionAnswers();
  const canFollow = items.length < EXECUTION_PROMPT_MAX;
  root.innerHTML = items.length
    ? items
        .map(
          (item, index) => `
        <div class="aware-q exec-q" data-exec-index="${index}">
          ${markableP(item.question, `exec.prompt.${index}.question`, "journal-core-q")}
          <textarea class="textarea" id="exec${index + 1}" rows="4" placeholder="${escapeHtml(item.placeholder || "寫下你準備做的一小步…")}">${escapeHtml(saved[index] || "")}</textarea>
        </div>
      `
        )
        .join("") +
      (canFollow
        ? `<button class="ai-check-btn ai-check-btn--label" id="btnExecFollow" type="button">讓這一步更具體</button>`
        : "")
    : `<p class="exec-q-empty">目前沒有執行題。</p>`;
}

function renderDeepItemHtml(item, index, slot, openSet) {
  const fieldIndex = Math.max(0, index - 1);
  const plainGuide = String(item.plainGuide || "").replace(/^白話想一想[:：]?\s*/, "");
  const deepGuide = String(item.deepGuide || "").replace(/^深挖一點點[:：]?\s*/, "");
  return `
        <details class="deep-item" data-deep-index="${index}" ${openSet.has(index) ? "open" : ""}>
          <summary>${markableSpan(item.title, `deep.${fieldIndex}.title`, "deep-item__title")}</summary>
          <div class="deep-block">
            <p class="deep-guide"><strong>白話想一想</strong>${markableSpan(plainGuide, `deep.${fieldIndex}.plainGuide`, "")}</p>
            <textarea class="textarea" id="deep${index}plain" rows="3" placeholder="用白話寫下這一層…">${escapeHtml(slot.plain || "")}</textarea>
          </div>
          <div class="deep-block">
            <p class="deep-guide"><strong>深挖一點點</strong>${markableSpan(deepGuide, `deep.${fieldIndex}.deepGuide`, "")}</p>
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

function applyGeneratedCorePrompts(awareness, execution, sig, fromAi, options = {}) {
  const journal = collectJournal();
  const keepExecAnswers =
    !options.resetExecutionAnswers && (journal.execution || []).some((item) => String(item || "").trim());
  const awareList = normalizeAwarenessPrompts(awareness);
  const execList =
    execution == null ? [] : sanitizeGeneratedExecutionPrompts(normalizeExecutionPrompts(execution));
  if (awareList.length >= 1) {
    state.awarenessPrompts = awareList.slice(0, AWARENESS_QUIZ_COUNT);
    renderAwarenessQuestions(state.awarenessPrompts, {
      answers: options.resetAwarenessAnswers === false ? journal.awareness : ["", "", ""],
    });
  }
  if (execList.length >= EXECUTION_PROMPT_MIN && !usesExecutionChoiceUi()) {
    state.executionPrompts = execList;
    renderExecutionQuestions(state.executionPrompts, { answers: keepExecAnswers ? journal.execution : ["", "", ""] });
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
  if (awareLabel) {
    awareLabel.textContent =
      scope === "awareness-follow" ? "正在根據你的回答，準備下一題…" : "正在生成覺察題…";
  }
  if (awareLoader) awareLoader.hidden = !(loading && (scope === "core" || scope === "awareness"));
  if (execLoader) execLoader.hidden = !(loading && (scope === "core" || scope === "execution"));
  syncCorePromptGate();
}

function localCorePrompts(journal) {
  return {
    awareness: awarenessPromptFallbacks(journal),
    execution: executionQuestionFallbacks().slice(0, 1),
  };
}

function pinAwareFold() {
  state.awareFoldPinned = true;
  setJournalFoldOpen("section-aware", true, { manual: true });
}

function revealAwareQuestion(index) {
  const item = document.querySelector(`#awareQuestions .aware-quiz__item[data-index="${index}"]`);
  if (!item || typeof item.scrollIntoView !== "function") return;
  requestAnimationFrame(() => {
    item.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  });
}

function awarenessQuestionContext(journal, step, prompts, answers) {
  return {
    journalMode: state.journalMode,
    mode: state.journalMode,
    promptKind: "awareness",
    scope: "awareness",
    step,
    followup: step > 1,
    thanks: thanksTextFrom(journal),
    thanksText: thanksTextFrom(journal),
    event: journal.event,
    mood: journal.mood,
    bodyTags: journal.bodyTags,
    bodyNote: journal.bodyNote,
    bodyCheck: journal.bodyCheck,
    awareness: answers,
    smallestStep: journal.smallestStep,
  };
}

async function requestAwarenessQuestion(journal, step, prompts, answers) {
  const progress = collectGrowthProgress();
  const payload = {
    mode: "prompts",
    variant: "core",
    scope: "awareness",
    step,
    followup: step > 1,
    date: currentIso(),
    text: journal.event,
    questions: (prompts || []).map((item) => item.question),
    answers,
    context: awarenessQuestionContext(journal, step, prompts, answers),
    progress: {
      streak: progress.streak,
      avoidQuestions: (progress.avoidQuestions || []).slice(0, 8),
      openActions: progress.openActions || [],
      recentReviews: (progress.recentReviews || []).slice(0, 7),
    },
  };
  let lastError = new Error("這次覺察沒有完整生成，請再試一次。");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const remote = await postReview(payload, 22000);
      const next = normalizeAwarenessPrompts(remote.awareness)[0];
      if (!next?.question || looksIncompleteAwarenessText(String(next.question).replace(/[？?]+$/, ""))) {
        throw new Error("這次覺察沒有完整生成，請再試一次。");
      }
      return next;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function generateAwarenessFollowup(options = {}) {
  pinAwareFold();
  if (recoverStaleBusy(state.corePromptsBusy, state.corePromptsBusyAt, () => setCorePromptsLoading(false))) {
    if (!options.auto) showToast("還在為你準備下一題，請稍候。");
    return;
  }
  const journal = collectJournal();
  if (!coreStoryReady(journal)) {
    if (!options.auto) showToast("請先寫下今日感謝、事件，並選擇心情。");
    return;
  }
  const current = normalizeAwarenessPrompts(state.awarenessPrompts);
  const answers = (journal.awareness || []).map(normalizeYesNo);
  const answered = awarenessQuizAnsweredCount(answers);
  if (!current.length) {
    await generateCorePrompts({ scope: "awareness", force: true });
    return;
  }
  if (current.length >= AWARENESS_QUIZ_COUNT) return;
  if (answered < current.length) {
    if (!options.auto) showToast("先回答這一題，再繼續下一層。");
    return;
  }
  if (!ensurePlusFeature("awareness_ai", options)) return;
  const token = (state.corePromptsToken || 0) + 1;
  state.corePromptsToken = token;
  setCorePromptsLoading(true, "awareness-follow");
  const watchdog = setTimeout(() => {
    if (state.corePromptsToken === token && state.corePromptsBusy) {
      setCorePromptsLoading(false);
      if (!options.auto) showToast("這次覺察沒有完整生成，請再試一次。");
    }
  }, 32000);
  try {
    if (!state.user) throw new Error("請先登入，才能使用雲端出題。");
    const next = await requestAwarenessQuestion(journal, current.length + 1, current, answers);
    if (state.corePromptsToken !== token) return;
    state.awarenessPrompts = [...current, next].slice(0, AWARENESS_QUIZ_COUNT);
    state.journalMeta.corePromptsAi = true;
    renderAwarenessQuestions(state.awarenessPrompts, { answers });
    persistJournalQuietly();
    syncCorePromptGate();
    revealAwareQuestion(state.awarenessPrompts.length - 1);
  } catch (error) {
    if (state.corePromptsToken !== token) return;
    if (isPlusRequiredError(error)) return;
    if (!options.auto) showToast("這次覺察沒有完整生成，請再試一次。");
  } finally {
    clearTimeout(watchdog);
    if (state.corePromptsToken === token) setCorePromptsLoading(false);
  }
}

async function generateCorePrompts(options = {}) {
  const scope =
    options.scope === "execution" ? "execution" : options.scope === "core" ? "core" : "awareness";
  if (!ensurePlusFeature(scope === "execution" ? "execution_ai" : "awareness_ai", options)) return;
  if (scope === "awareness") {
    if (usesAwarenessV3Path()) {
      if (options.auto) return;
      await generateAwarenessV3({ confirmed: true });
      return;
    }
    await generateAwarenessChoices(options);
    return;
  }
  if (scope === "execution" && usesExecutionV3Path()) {
    if (options.auto) return;
    await generateExecutionV3({ confirmed: true });
    return;
  }
  if (scope === "execution" && usesExecutionChoiceUi()) {
    await generateExecutionChoices(options);
    return;
  }
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
  if (scope === "awareness") pinAwareFold();
  const sig = corePromptsSignature(journal);
  const existingAware = normalizeAwarenessPrompts(state.awarenessPrompts);
  const hasAware = existingAware.length >= 1;
  const answeredAware = awarenessQuizAnsweredCount(journal.awareness);
  const hasExec = normalizeExecutionPrompts(state.executionPrompts).length >= EXECUTION_PROMPT_MIN;
  if (!options.force) {
    if (scope === "awareness" && hasAware) {
      if (answeredAware < existingAware.length) return;
      if (existingAware.length >= AWARENESS_QUIZ_COUNT) return;
      await generateAwarenessFollowup({ ...options, auto: Boolean(options.auto) });
      return;
    }
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
    if (scope === "awareness") {
      const next = await requestAwarenessQuestion(journal, 1, [], []);
      if (state.corePromptsToken !== token) return;
      pinAwareFold();
      applyGeneratedCorePrompts([next], null, sig, true, { resetAwarenessAnswers: true });
      revealAwareQuestion(0);
      if (!options.auto) showToast("今天的第一題覺察已經準備好了。");
      return;
    }
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
          awareness: journal.awareness,
          smallestStep: journal.smallestStep,
          ...priorThinkAwareContext(journal),
        },
        progress: {
          streak: progress.streak,
          avoidQuestions: (progress.avoidQuestions || []).slice(0, 8),
          openActions: progress.openActions || [],
          recentReviews: (progress.recentReviews || []).slice(0, 7),
        },
      },
      22000
    );
    if (state.corePromptsToken !== token) return;
    if (scope === "execution") {
      const execution = sanitizeGeneratedExecutionPrompts(
        mergePrompts(remote.execution, fallback.execution, normalizeExecutionPrompts, 1)
      ).slice(0, 1);
      if (execution.length < 1) throw new Error("雲端回傳格式不完整");
      applyGeneratedCorePrompts(null, execution, sig, true, { resetExecutionAnswers: Boolean(options.force) });
      if (!options.auto) showToast("今天的行動問題已經準備好了。");
      return;
    }
    const awareness = normalizeAwarenessPrompts(remote.awareness).slice(0, 1);
    const execution = sanitizeGeneratedExecutionPrompts(
      mergePrompts(remote.execution, fallback.execution, normalizeExecutionPrompts, 1)
    ).slice(0, 1);
    if (!awareness[0]?.question) throw new Error("這次覺察沒有完整生成，請再試一次。");
    pinAwareFold();
    applyGeneratedCorePrompts(awareness, execution, sig, true, { resetAwarenessAnswers: true });
    revealAwareQuestion(0);
    if (!options.auto) showToast("今天的第一題覺察已經準備好了。");
  } catch (error) {
    if (state.corePromptsToken !== token) return;
    if (isPlusRequiredError(error)) return;
    if (scope === "execution") applyGeneratedCorePrompts(null, fallback.execution, sig, true, { resetExecutionAnswers: Boolean(options.force) });
    else if (scope === "core") applyGeneratedCorePrompts(null, fallback.execution, sig, true);
    if (options.auto) state.corePromptsFailedSig = sig;
    if (!options.auto) {
      showToast(
        scope === "execution"
          ? `雲端執行題還沒好：${formatApiError(error)}，先用本地題目。`
          : "這次覺察沒有完整生成，請再試一次。"
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

function captureReviewPatch() {
  const { journal, rawText } = syncHiddenReviewText();
  const prev = getReview(currentIso()) || {};
  const gratitude = document.getElementById("gratitudeInput")?.value.trim() || state.gratitude || prev.gratitude || "";
  return {
    rawText: rawText || prev.rawText || "",
    journal,
    organize: state.organize || prev.organize || null,
    gratitude,
    selectedQuotes: Array.isArray(state.selectedQuotes) ? state.selectedQuotes : prev.selectedQuotes || [],
    selectedSfm: Array.isArray(state.selectedSfm) ? state.selectedSfm : prev.selectedSfm || [],
    selectedThinkActions: Array.isArray(state.selectedThinkActions) ? state.selectedThinkActions : prev.selectedThinkActions || [],
    selectedPractice: Array.isArray(state.selectedPractice) ? state.selectedPractice : prev.selectedPractice || [],
    thinkHistory: state.think && Array.isArray(state.think.history) ? state.think.history : prev.thinkHistory || [],
    updatedAt: new Date().toISOString(),
  };
}

function persistArchivedHistoryImportant(iso, important) {
  const day = iso || state.historyDetailDate;
  const prev = getReview(day) || {};
  if (!reviewIsFinalized(prev) && !reviewIsComplete(prev)) return null;
  const now = new Date().toISOString();
  return upsertReview(day, {
    historyMeta: { important: Boolean(important), updatedAt: now },
    completedAt: prev.completedAt,
    updatedAt: now,
  });
}

function toggleHistoryImportant(iso) {
  const day = historyDetailIso(iso) || iso;
  const prev = getReview(day);
  if (!prev || !reviewIsComplete(prev)) return;
  persistArchivedHistoryImportant(day, !reviewIsHistoryImportant(prev));
  if (state.historyDetailDate === day) renderHistoryDetail(day);
}

function persistArchivedUserMarks(iso) {
  const day = iso || currentIso();
  const prev = getReview(day) || {};
  if (!reviewIsFinalized(prev)) return;
  const bag = userMarkBag(day === currentIso() ? state.journalUserMarks : prev.journal && prev.journal.userMarks);
  const prevBag = userMarkBag(prev.journal && prev.journal.userMarks);
  if (JSON.stringify(bag) === JSON.stringify(prevBag)) return;
  upsertReview(day, {
    journal: { ...(prev.journal && typeof prev.journal === "object" ? prev.journal : {}), userMarks: bag },
    completedAt: prev.completedAt,
    updatedAt: new Date().toISOString(),
  });
}

function persistJournalQuietly(options = {}) {
  try {
    const iso = currentIso();
    const prev = getReview(iso) || {};
    if (reviewIsFinalized(prev)) {
      persistArchivedUserMarks(iso);
      return;
    }
    const patch = captureReviewPatch();
    const incomingEmpty = !journalHasContent(patch.journal) && !String(patch.rawText || "").trim() && !patch.organize;
    if (incomingEmpty) return;
    upsertReview(iso, patch);
    if (options.showHint) showJournalAutosaveHint();
    if (journalHasContent(patch.journal) && window.NichiAnalytics) {
      window.NichiAnalytics.trackOnceSession("review_started", { mode: state.journalMode === "quick" ? "quick" : "deep", source: "autosave" }, `review-start:${iso}`);
    }
  } catch (error) {
    console.error("[進行式 ING] 本機暫存復盤失敗", error && error.message ? error.message : error);
  }
}

function showJournalAutosaveHint() {
  if (isCurrentJournalArchived()) return;
  const hint = document.getElementById("journalAutosaveHint");
  if (!hint) return;
  hint.hidden = false;
  hint.classList.add("is-on");
  hint.textContent = "已自動儲存";
  clearTimeout(showJournalAutosaveHint.timer);
  showJournalAutosaveHint.timer = setTimeout(() => {
    hint.classList.remove("is-on");
    showJournalAutosaveHint.hideTimer = setTimeout(() => {
      if (!hint.classList.contains("is-on")) hint.hidden = true;
    }, 400);
  }, 2200);
}

function persistJournalNow(options = {}) {
  clearTimeout(scheduleJournalAutosave.timer);
  scheduleJournalAutosave.timer = 0;
  persistJournalQuietly({ showHint: options.showHint !== false });
}

function scheduleJournalAutosave() {
  if (state.journalHydrating || isCurrentJournalArchived()) return;
  clearTimeout(scheduleJournalAutosave.timer);
  scheduleJournalAutosave.timer = setTimeout(() => {
    persistJournalNow();
  }, 900);
}

function flushJournalAutosave() {
  if (!scheduleJournalAutosave.timer) return;
  clearTimeout(scheduleJournalAutosave.timer);
  scheduleJournalAutosave.timer = 0;
  persistJournalQuietly();
}

function isJournalAutosaveField(el) {
  if (!el) return false;
  if (el.classList && el.classList.contains("think-guide-answer")) return true;
  const id = String(el.id || "");
  if (id === "thinkExtAnswer" || id === "thinkUnderstandAnswer") return true;
  return /^(thanksText|thanks\d+|aware\d+|exec\d+|execNext|execFollowup|execDeepAnswer|eventText|bodyMindText|bodyNote|bodyOtherNote|body(Mood|Body|Sleep)Reason|manifestVision|manifestThink\d+|deep\d)/.test(id);
}

function thinkV2AnswerEl() {
  return document.querySelector("#thinkQuestions .think-guide-answer");
}

function withExecDeepDraft(bag) {
  const next = normalizeExecutionChoiceBag(bag);
  const ta = document.getElementById("execDeepAnswer");
  if (!ta) return next;
  next.deep = normalizeExecDeep({ ...(next.deep || emptyExecDeep()), draftAnswer: String(ta.value || "").trim() });
  return next;
}

function withThinkGuideDraft(insight) {
  const next = normalizeInsight(insight);
  const extTa = document.getElementById("thinkExtAnswer");
  if (extTa) {
    const ext = normalizeReflectionExtension((next.guide || {}).extension);
    const current = currentThinkExtensionRound(ext);
    if (current) {
      const answer = String(extTa.value || "");
      const patched = { ...current, answer };
      if (current.deepConclusion && thinkExtensionAnswerSig(answer) !== current.answerSig) patched.conclusionStale = true;
      next.guide = normalizeThinkGuide({
        ...(next.guide || emptyThinkGuide()),
        extension: { ...ext, rounds: ext.rounds.map((item) => (item.id === current.id ? patched : item)) },
      });
    }
  }
  const ta = thinkV2AnswerEl() || thinkGuideBodyEl()?.querySelector(".think-guide-answer");
  if (!ta) return next;
  const guide = { ...(next.guide || emptyThinkGuide()), draftAnswer: String(ta.value || "").trim() };
  return { ...next, guide };
}

function syncJournalFooter() {
  const footer = document.getElementById("journalFooter");
  const actions = document.getElementById("journalFooterActions");
  const complete = document.getElementById("journalFooterComplete");
  const hint = document.getElementById("journalAutosaveHint");
  const resetBtn = document.getElementById("btnInternalResetToday");
  const archived = isCurrentJournalArchived();
  if (footer) footer.classList.toggle("is-complete", archived);
  if (actions) actions.hidden = archived;
  if (complete) complete.hidden = !archived;
  if (resetBtn) resetBtn.hidden = !(archived && isInternalMembership());
  if (hint && archived) {
    hint.hidden = true;
    hint.classList.remove("is-on");
  }
  syncCompleteButtonLabel();
}

function lockNewDayBodyUi() {
  document.querySelectorAll("#section-body .js-legacy-body-ui, #section-body .js-new-body-extra, #section-body .journal-fold__summary").forEach((node) => {
    node.hidden = true;
    node.setAttribute("hidden", "");
  });
}

function applyJournalArchiveLock() {
  const page = document.getElementById("page-today");
  const archived = isCurrentJournalArchived();
  if (page) page.classList.toggle("is-archived", archived);
  lockNewDayBodyUi();
  syncJournalFooter();
  syncBodyMindCta();
  syncThinkV3Cta();
  syncAwareV3Cta();
  syncExecV3Cta();
  if (usesReflectionV3Path()) renderThinkExtension();
}

function openInternalResetModal() {
  const modal = document.getElementById("internalResetModal");
  if (modal && typeof modal.showModal === "function") modal.showModal();
}

function closeInternalResetModal() {
  const modal = document.getElementById("internalResetModal");
  if (modal && typeof modal.close === "function" && modal.open) modal.close();
}

async function confirmInternalResetToday() {
  if (!isInternalMembership()) {
    showToast("只有內部帳號可以使用重新測試。");
    return;
  }
  const iso = currentIso();
  const prev = getReview(iso) || {};
  try {
    const remote = await postReview({
      mode: "internal-reset-today",
      date: iso,
      review: {
        ...prev,
        date: iso,
        userId: (state.user && state.user.id) || prev.userId || "",
      },
    });
    const api = internalTestApi();
    const resetAt = (remote && remote.resetAt) || new Date().toISOString();
    const next =
      (remote && remote.review) ||
      (typeof api.applyInternalTodayReset === "function"
        ? api.applyInternalTodayReset(prev, { resetAt, date: iso, userId: (state.user && state.user.id) || "" })
        : { ...prev, completedAt: "", organize: null, journal: { internalTestRuns: prev.journal && prev.journal.internalTestRuns } });
    const reviews = getReviews();
    reviews[iso] = { ...next, date: iso, userId: (state.user && state.user.id) || next.userId || "", completedAt: "", organize: null };
    saveReviews(reviews);
    state.bodyMindToken = (state.bodyMindToken || 0) + 1;
    state.insightToken = (state.insightToken || 0) + 1;
    state.choicesToken.think += 1;
    state.choicesToken.thinkClose += 1;
    state.choicesToken.awareness += 1;
    state.choicesToken.execution += 1;
    state.choicesToken.executionDeep += 1;
    state.internalModelDebug = { think: null, awareness: null, execution: null };
    closeInternalResetModal();
    loadReviewForDate(iso);
    applyJournalArchiveLock();
    flushCloudNow({ reason: "internal-reset" }).catch(() => {});
    showToast("已重新開啟今天的測試。");
  } catch (error) {
    if (error && error.code === "internal_required") {
      showToast("只有內部帳號可以使用重新測試。");
      return;
    }
    showToast(formatApiError(error) || "這次沒有重開成功，請再試一次。");
  }
}

function rejectArchivedJournalWrite(options = {}) {
  if (options.fromComplete || options.allowWhenArchived) return false;
  return isCurrentJournalArchived();
}

function isArchivedJournalReadTarget(node) {
  if (!node || typeof node.closest !== "function") return false;
  if (node.closest("[data-user-mark-field], [data-user-mark-toolbar], .user-mark-bar")) return true;
  if (node.closest("[data-mode-guide-toggle], #journalDateBtn, #reviewDate")) return true;
  if (node.closest("[data-journal-fold]") && !node.closest(".journal-fold__panel")) return true;
  return false;
}

function isArchivedJournalWriteTarget(node) {
  if (!node || typeof node.closest !== "function") return false;
  if (isArchivedJournalReadTarget(node)) return false;
  return Boolean(
    node.closest(
      "button, input, textarea, select, label, .mood-btn, .choice-opt, .body-flag-btn, .sleep-chip, .ai-check-btn, [data-journal-mode], [data-quick-mod], [data-choice-id], [data-think-guide-next], [data-deepen]"
    )
  );
}

async function generateJournalPrompts(options = {}) {
  if (rejectArchivedJournalWrite(options)) return;
  if (state.promptsBusy) return;
  const scope = options.scope || "all";
  const journal = collectJournal();
  if (!insightReady(journal)) {
    if (!options.auto) showToast("請先寫下今日事件、選擇心情，並標出身體狀況，才會生成今天的題目。");
    return;
  }
  if (!ensurePlusFeature("think_ai", options)) return;
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
    if (isPlusRequiredError(error)) return;
    applyGeneratedPrompts([], localDeepPrompts(journal), [], sig, false, scope);
    showToast(`雲端出題失敗：${formatApiError(error)}，先用今天的本地題目。`);
  } finally {
    if (state.promptsToken === token) setPromptsLoading(false, scope);
  }
}

function maybeAutoGeneratePrompts(journal) {
  return;
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
            <p class="deep-probe__q" data-followup="${escapeHtml(question)}">${i + 1}. ${markableSpan(question, `deep.${index - 1}.followup.${i}`, "")}</p>
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
  if (rejectArchivedJournalWrite()) return;
  const slotIndex = Number(index);
  if (slotIndex < 1 || slotIndex > 4 || state.deepFollowBusy[slotIndex - 1]) return;
  const slot = collectDeepSlot(slotIndex);
  if (!String(slot.plain || "").trim() && !String(slot.deep || "").trim()) {
    showToast("先在這個主題寫下一點，再往下挖。");
    return;
  }
  if (!ensurePlusFeature("think_ai")) return;
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
    if (isPlusRequiredError(error)) return;
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
  if (!options.silent && !state.journalHydrating && rejectArchivedJournalWrite()) return;
  const next = mode === "quick" ? "quick" : "deep";
  if (
    next === "deep" &&
    !options.silent &&
    !canUsePlusFeature("deep_journal") &&
    !journalHasPlusContent()
  ) {
    openPlusUpgradeModal();
    return;
  }
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
  lockNewDayAwareUi();
  lockNewDayExecUi();
  if (!state.journalHydrating) applyJournalFolds();
  if (!options.silent && !state.journalHydrating) persistJournalQuietly();
  renderInsightCard(state.journalInsight);
  if (!options.silent && !state.journalHydrating && next === "deep") {
    maybeAutoGenerateCorePrompts(collectJournal());
  }
}

function collectExecCheckItems() {
  const sources = execRawSourcesFrom({ executionChoices: state.executionChoices });
  return [...document.querySelectorAll("#execChecks .exec-check")]
    .map((el) => {
      const resolved = resolveExecTitleDetail(
        String(el.dataset.title || "").trim(),
        flattenExecSentence(String(el.dataset.detail || "").trim()),
        sources
      );
      return {
        title: resolved.title,
        detail: flattenExecSentence(resolved.detail),
        highlights: highlightsFromAttr(el.dataset.highlights),
      };
    })
    .filter((item) => item.title);
}

function normalizeExecCheckItem(item, sources) {
  if (!item) return null;
  const rawSources = Array.isArray(sources) ? sources : [];
  if (typeof item === "string") {
    const resolved = resolveExecTitleDetail(item, "", rawSources);
    return resolved.title ? { title: resolved.title, detail: resolved.detail || "" } : null;
  }
  if (typeof item !== "object") return null;
  const title = String(item.title || item.label || item.text || "").trim();
  const detail = flattenExecSentence(item.detail || item.lead || item.note || "", item);
  const highlights = item.highlights;
  if (!title && !detail) return null;
  const resolved = resolveExecTitleDetail(title, detail, rawSources);
  const nextTitle = resolved.title || resolved.detail;
  if (!nextTitle) return null;
  return {
    title: nextTitle,
    detail: resolved.title ? resolved.detail : "",
    highlights,
    legacyTitle: title && title !== nextTitle ? title : "",
  };
}

function normalizeExecCheckItems(list, sources) {
  const items = [];
  const seen = new Set();
  const rawSources = Array.isArray(sources) ? sources : [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const next = normalizeExecCheckItem(item, rawSources);
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

function formatExecCheckLine(item, sources) {
  const next = normalizeExecCheckItem(item, sources);
  if (!next) return "";
  return next.detail ? `${next.title}：${next.detail}` : next.title;
}

function execCheckHistoryLines(journal) {
  const sources = execRawSourcesFrom(journal);
  const items = normalizeExecCheckItems(journal && journal.executionCheckItems, sources);
  if (items.length) return items.map((item) => formatExecCheckLine(item, sources)).filter(Boolean);
  return (journal && journal.executionChecks ? journal.executionChecks : [])
    .map((item) => formatExecCheckLine(item, sources))
    .filter(Boolean);
}

function collectJournal() {
  const bodyCheck = collectBodyCheck();
  const bodyMind = normalizeBodyMind({
    ...(state.journalBodyMind || emptyBodyMind()),
    text: collectBodyMindText() || String((state.journalBodyMind && state.journalBodyMind.text) || "").trim(),
  });
  const journal = {
    thanks: collectThanksText(),
    thanksText: collectThanksText(),
    event: journalFieldValue("eventText"),
    mood: document.querySelector("#moodRow .mood-btn.is-on")?.dataset.mood || "",
    bodyCheck,
    bodyTags: deriveBodyTags(bodyCheck),
    bodyNote: bodyMind.text || deriveBodyNote(bodyCheck),
    bodyMind,
    bodyCoach: state.journalBodyCoach || emptyBodyCoach(),
    awareness: collectAwarenessQuizAnswers(),
    awarenessChecks: checkedValues("awareChecks"),
    awarenessCheckItems: (() => {
      const quotes = collectAwareQuotes();
      return quotes.length ? quotes : normalizeAwarenessQuotes(checklistItems("awareChecks"));
    })(),
    awarenessResult: normalizeAwarenessResult(state.journalAwarenessResult, { keepSource: true }),
    awarenessV3: normalizeAwarenessV3Bag(state.journalAwarenessV3),
    awarenessChoices: serializeChoiceBag(state.awarenessChoices),
    thinkChoices: serializeChoiceBag(state.thinkChoices),
    executionChoices: serializeExecutionChoiceBag(withExecDeepDraft(state.executionChoices)),
    execution: collectExecutionAnswers(),
    executionChecks: checkedValues("execChecks"),
    executionCheckItems: (() => {
      const collected = collectExecCheckItems();
      return collected.length ? collected : normalizeExecCheckItems(checklistItems("execChecks"), execRawSourcesFrom({ executionChoices: state.executionChoices }));
    })(),
    executionFocus: normalizeExecFocus(state.journalExecFocus, collectExecCheckItems(), execRawSourcesFrom({ executionChoices: state.executionChoices })),
    smallestStep: usesExecutionChoiceUi()
      ? selectedExecutionChoiceText(state.executionChoices) || journalFieldValue("execNext")
      : journalFieldValue("execNext"),
    mode: state.journalMode === "quick" ? "quick" : "deep",
    deepExpanded: Boolean(state.deepExpanded),
    awarenessAi: Boolean(state.journalMeta.awarenessAi),
    executionAi: Boolean(state.journalMeta.executionAi),
    awarenessAiSig: state.journalMeta.awarenessAiSig || "",
    executionAiSig: state.journalMeta.executionAiSig || "",
    awarenessQuoteGenCount: awarenessQuoteGenCount(),
    manifest: journalFieldValue("manifestVision"),
    manifestThink: collectManifestThinkAnswers(),
    manifestPrompts: journalUsesManifestClose(state.journalManifestClose)
      ? MANIFEST_CLOSE_PROMPTS.map((item) => ({ question: item.question, placeholder: item.placeholder }))
      : normalizeManifestPrompts(state.manifestPrompts),
    manifestSentence: String(
      (state.journalManifestClose && state.journalManifestClose.manifestationStatement) || state.journalManifestSentence || ""
    ).trim(),
    manifestClose: normalizeManifestCloseBag(state.journalManifestClose),
    manifestPlan: normalizeManifestPlan(state.journalManifestPlan),
    manifestChecks: checkedValues("manifestChecks"),
    manifestCheckItems: (() => {
      const collected = collectManifestPathItems();
      if (collected.length) return collected;
      const fromChecks = normalizeManifestPathItems(checklistItems("manifestChecks"));
      if (fromChecks.length) return fromChecks;
      return normalizeManifestPathItems(getReview(currentIso())?.journal?.manifestCheckItems);
    })(),
    manifestAi: Boolean(state.journalMeta.manifestAi),
    manifestAiSig: state.journalMeta.manifestAiSig || "",
    manifestPromptsAi: Boolean(state.journalMeta.manifestPromptsAi),
    manifestPromptsSig: state.journalMeta.manifestPromptsSig || "",
    insight: withThinkGuideDraft(state.journalInsight || emptyInsight()),
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
    userMarks: userMarkBag(state.journalUserMarks),
    manifestHighlights: state.journalManifestHighlights && typeof state.journalManifestHighlights === "object" ? state.journalManifestHighlights : {},
    internalTestRuns: normalizeInternalTestRuns(
      (state.journalInternalTestRuns && state.journalInternalTestRuns.length
        ? state.journalInternalTestRuns
        : getReview(currentIso()) && getReview(currentIso()).journal && getReview(currentIso()).journal.internalTestRuns) || []
    ),
    internalResetAt: String(
      state.journalInternalResetAt ||
        (getReview(currentIso()) && (getReview(currentIso()).internalResetAt || (getReview(currentIso()).journal && getReview(currentIso()).journal.internalResetAt))) ||
        ""
    ).trim(),
    internalModelDebug: state.internalModelDebug && typeof state.internalModelDebug === "object" ? state.internalModelDebug : { think: null, awareness: null, execution: null },
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
  if (bodyCoach.title || bodyCoach.analysis) {
    lines.push("今日身心小結");
    if (bodyCoach.title) lines.push(bodyCoach.title);
    if (bodyCoach.analysis) {
      lines.push("① 今天的身心訊號");
      lines.push(bodyCoach.analysis);
    }
    if (bodyCoach.notice) {
      lines.push("② 今天值得留意的地方");
      lines.push(bodyCoach.notice);
    }
    if (bodyCoach.suggestions.length) {
      lines.push("③ 今晚可以這樣照顧自己");
      bodyCoach.suggestions.forEach((item, index) => lines.push(`建議 ${index + 1}：${item}`));
    }
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
  awareQuotes.forEach((quote, index) => lines.push(`今日一句話 ${index + 1}：${quote}`));
  const awareResult = normalizeAwarenessResult(journal.awarenessResult, { keepSource: true });
  if (isCompactAwarenessResult(awareResult)) {
    if (awareResult.line) lines.push(`核心覺察：${awareResult.line}`);
    if (awareResult.seen) lines.push(`我看見了：${awareResult.seen}`);
  } else {
    if (awareResult.seen) lines.push(`今天，我看見了自己：${awareResult.seen}`);
    if (awareResult.gap) lines.push(`我可能忽略的地方：${awareResult.gap}`);
    if (awareResult.question) lines.push(`今晚留給自己的一個問題：${awareResult.question}`);
    if (awareResult.echo) lines.push(`跨日覺察：${awareResult.echo}`);
    if (awareResult.line) lines.push(`今日一句話：${awareResult.line}`);
  }
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
  if (execLines.length) lines.push(`我的行動卡：${execLines.join("、")}`);
  if (journal.executionFocus?.title) lines.push(`${execFocusKicker(journal.executionFocus.when)}：${journal.executionFocus.title}`);
  if (String(journal.manifest || "").trim()) {
    lines.push(journalUsesManifestPlan(journal) || journalUsesManifestClose(journal) ? (journalUsesManifestPlan(journal) ? `我想顯化的是：${journal.manifest.trim()}` : `我真正想靠近的是什麼：${journal.manifest.trim()}`) : `我想顯化的事情：${journal.manifest.trim()}`);
  }
  const manifestPlan = normalizeManifestPlan(journal.manifestPlan);
  if (journalUsesManifestPlan(journal)) {
    lines.push("我正在靠近它");
    manifestPlan.steps.forEach((item, index) => {
      lines.push(`${padManifestStepNo(index)}｜${item.title}${item.completed ? "（已完成）" : ""}`);
      if (item.detail) lines.push(item.detail);
    });
  } else if (journalUsesManifestClose(journal)) {
    const manifestClose = normalizeManifestCloseBag(journal.manifestClose);
    MANIFEST_CLOSE_PROMPTS.forEach((item, index) => {
      const answer = String((Array.isArray(journal.manifestThink) ? journal.manifestThink : [])[index] || "").trim();
      if (answer) lines.push(`${item.question} ${answer}`);
    });
    if (manifestClose.futureVision) {
      lines.push("我正在靠近的生活");
      lines.push(manifestClose.futureVision);
    }
    if (manifestClose.approachStep) {
      lines.push("今天，我可以先靠近一點");
      lines.push(manifestClose.approachStep);
    }
    if (manifestClose.manifestationStatement) lines.push(`我的顯化句：${manifestClose.manifestationStatement}`);
  } else {
    const manifestPrompts = normalizeManifestPrompts(journal.manifestPrompts || state.manifestPrompts);
    const manifestThink = Array.isArray(journal.manifestThink) ? journal.manifestThink : [];
    manifestPrompts.forEach((item, index) => {
      const answer = String(manifestThink[index] || "").trim();
      if (answer) lines.push(`${item.question} ${answer}`);
    });
    const manifestPaths = normalizeManifestPathItems(journal.manifestCheckItems);
    if (manifestPaths.length) lines.push(`讓願望靠近現實：${manifestPaths.map((item) => item.title).join("、")}`);
    else if ((journal.manifestChecks || []).length) lines.push(`讓願望靠近現實：${journal.manifestChecks.join("、")}`);
    if (String(journal.manifestSentence || "").trim()) lines.push(`我的顯化句：${String(journal.manifestSentence).trim()}`);
  }
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
  "section-deep",
  "section-aware",
  "section-exec",
  "section-quick-insight",
];

function journalFoldIsActive(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return false;
  if (id === "section-insight" || id === "section-quick-insight") return false;
  const quick = state.journalMode === "quick";
  if (id === "quickModules" || id === "section-quick-insight") return quick;
  if (!quick) return id !== "quickModules" && id !== "section-quick-insight";
  if (id === "section-insight" || id === "section-deep") return false;
  if (id === "section-body") return Boolean(state.quickModules?.body);
  if (id === "section-aware") return Boolean(state.quickModules?.aware);
  if (id === "section-exec") return Boolean(state.quickModules?.exec);
  if (id === "section-manifest") return false;
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
let foldTogglePointer = { id: "", at: 0 };
const JOURNAL_EDIT_SELECTOR =
  "textarea, input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio']):not([type='file']):not([type='reset']):not([type='image']), [contenteditable='true']";
const FOLD_COLLAPSE_GUARD_MS = 1200;
const journalFoldEdit = {
  foldId: "",
  active: false,
  lastFocusAt: 0,
  lastBlurAt: 0,
};

function isJournalEditField(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.matches?.(JOURNAL_EDIT_SELECTOR)) return true;
  return Boolean(el.closest?.(JOURNAL_EDIT_SELECTOR));
}

function eventTargetElement(node) {
  if (!node) return null;
  if (typeof node.closest === "function") return node;
  return node.parentElement || null;
}

function journalFoldRootFrom(node) {
  return eventTargetElement(node)?.closest?.(".journal-fold") || null;
}

function clearJournalFoldCollapseTimer() {
  if (state.journalFoldCollapseTimer) {
    clearTimeout(state.journalFoldCollapseTimer);
    state.journalFoldCollapseTimer = 0;
  }
}

function markJournalFoldEditing(foldId, editing) {
  if (editing) {
    clearJournalFoldCollapseTimer();
    journalFoldEdit.active = true;
    journalFoldEdit.foldId = foldId || journalFoldEdit.foldId || "";
    journalFoldEdit.lastFocusAt = Date.now();
    journalFoldEdit.lastBlurAt = 0;
    return;
  }
  journalFoldEdit.active = false;
  journalFoldEdit.lastBlurAt = Date.now();
}

function editingJournalFoldId() {
  const active = document.activeElement;
  if (isJournalEditField(active)) {
    const fold = journalFoldRootFrom(active);
    if (fold?.id) return fold.id;
  }
  if (journalFoldEdit.active && journalFoldEdit.foldId) return journalFoldEdit.foldId;
  return "";
}

function isJournalFoldEditing(foldId) {
  const current = editingJournalFoldId();
  if (foldId) {
    if (current === foldId) return true;
    if (
      journalFoldEdit.foldId === foldId &&
      journalFoldEdit.lastBlurAt &&
      Date.now() - journalFoldEdit.lastBlurAt < FOLD_COLLAPSE_GUARD_MS
    ) {
      return true;
    }
    return false;
  }
  return Boolean(current || journalFoldEdit.active);
}

function canAutoCollapseJournalFold(id) {
  if (!id) return true;
  if (id === "section-aware" && state.awareFoldPinned) return false;
  return !isJournalFoldEditing(id);
}

function handleJournalFoldFocusIn(event) {
  const target = event.target;
  if (!isJournalEditField(target)) return;
  const fold = journalFoldRootFrom(target);
  markJournalFoldEditing(fold?.id || "", true);
}

function handleJournalFoldFocusOut(event) {
  const target = event.target;
  if (!isJournalEditField(target)) return;
  const fold = journalFoldRootFrom(target);
  const next = event.relatedTarget;
  if (next && fold && fold.contains(next) && isJournalEditField(next)) {
    markJournalFoldEditing(fold.id, true);
    return;
  }
  markJournalFoldEditing(fold?.id || "", false);
  clearJournalFoldCollapseTimer();
  state.journalFoldCollapseTimer = setTimeout(() => {
    state.journalFoldCollapseTimer = 0;
    if (isJournalFoldEditing()) return;
    scheduleJournalChecklists();
  }, FOLD_COLLAPSE_GUARD_MS);
}

function bindJournalFoldEditGuards() {
  const page = document.getElementById("page-today");
  if (!page || page.dataset.foldEditBound === "1") return;
  page.dataset.foldEditBound = "1";
  page.addEventListener("focusin", handleJournalFoldFocusIn);
  page.addEventListener("focusout", handleJournalFoldFocusOut);
  page.addEventListener("compositionstart", handleJournalFoldFocusIn);
  page.addEventListener(
    "pointerdown",
    (event) => {
      const from = eventTargetElement(event.target);
      const toggle = from?.closest?.("[data-journal-fold]");
      if (toggle && page.contains(toggle) && !from.closest(".journal-fold__panel")) {
        const root = toggle.closest(".journal-fold");
        foldTogglePointer = { id: root?.id || "", at: Date.now() };
      }
      const field = from?.closest?.(JOURNAL_EDIT_SELECTOR);
      if (field && from.closest(".journal-fold__panel")) {
        event.stopPropagation();
      }
    },
    true
  );
}

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

function applyFoldState(id, open, options = {}) {
  const root = document.getElementById(id);
  if (!root?.classList.contains("journal-fold")) return false;
  const next = Boolean(open);
  if (!next && !options.force && !canAutoCollapseJournalFold(id)) return false;
  const toggle = root.querySelector(":scope > [data-journal-fold]");
  const panel = root.querySelector(":scope > .journal-fold__panel");
  root.classList.toggle("is-open", next);
  if (toggle) toggle.setAttribute("aria-expanded", next ? "true" : "false");
  if (next && id === "section-aware") syncAwareV3Cta();
  if (next && id === "section-exec") syncExecV3Cta();
  if (panel) {
    if (next) {
      panel.inert = false;
      panel.removeAttribute("inert");
      panel.setAttribute("aria-hidden", "false");
    } else {
      panel.inert = true;
      panel.setAttribute("inert", "");
      panel.setAttribute("aria-hidden", "true");
    }
  }
  return true;
}

function currentOpenJournalFold() {
  return JOURNAL_FOLD_IDS.find((id) => document.getElementById(id)?.classList.contains("is-open")) || "";
}

function setJournalFoldOpen(id, open, options = {}) {
  const root = document.getElementById(id);
  if (!root?.classList.contains("journal-fold")) return;
  const next = Boolean(open);
  const force = options.force === true || options.manual === true;
  if (next && !force && isJournalFoldEditing() && editingJournalFoldId() !== id) return;
  const run = () => {
    if (next && options.exclusive !== false) {
      JOURNAL_FOLD_IDS.forEach((other) => {
        if (other !== id) applyFoldState(other, false, { force });
      });
    }
    applyFoldState(id, next, { force });
    if (options.persist !== false) persistJournalFoldOpen(next ? id : currentOpenJournalFold());
  };
  if (options.pin === false) run();
  else pinFoldWhileAnimating(root, run);
}

function toggleJournalFold(id) {
  const root = document.getElementById(id);
  if (!root) return;
  const nextOpen = !root.classList.contains("is-open");
  if (id === "section-aware") state.awareFoldPinned = nextOpen;
  else if (nextOpen) state.awareFoldPinned = false;
  setJournalFoldOpen(id, nextOpen, { manual: true });
}

function applyJournalFolds() {
  const prefs = journalFoldPrefs();
  const visible = JOURNAL_FOLD_IDS.filter(journalFoldIsActive);
  const editingId = editingJournalFoldId();
  const preferred = prefs.open === "section-manifest" ? "section-exec" : prefs.open;
  let openId = visible.includes(preferred) ? preferred : "";
  if (editingId && visible.includes(editingId)) openId = editingId;
  if (state.awareFoldPinned && visible.includes("section-aware")) openId = "section-aware";
  JOURNAL_FOLD_IDS.forEach((id) => {
    const wantOpen = id === openId;
    if (!wantOpen && !canAutoCollapseJournalFold(id)) return;
    applyFoldState(id, wantOpen, { force: wantOpen });
  });
}

function fillJournal(journal) {
  lockNewDayBodyUi();
  const data = { ...emptyJournal(), ...(journal && typeof journal === "object" ? journal : {}) };
  state.awareFoldPinned = false;
  state.journalHydrating = true;
  state.choicesToken.awarenessCue = (state.choicesToken.awarenessCue || 0) + 1;
  state.choicesBusy.awarenessCue = false;
  state.awarenessCueAttemptSig = "";
  if (state.awarenessCueTimer) {
    clearTimeout(state.awarenessCueTimer);
    state.awarenessCueTimer = 0;
  }
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
  setManifestPromptsLoading(false);
  state.manifestPromptsToken += 1;
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
    manifestPromptsAi: Boolean(data.manifestPromptsAi),
    manifestPromptsSig: data.manifestPromptsSig || "",
    insightSig: data.insight?.sig || "",
    bodyCoachSig: data.bodyCoach?.sig || "",
    bodyMindSig: data.bodyMind?.sig || "",
    promptsSig: data.promptsSig || "",
    promptsAi: Boolean(data.promptsAi),
    corePromptsSig: data.corePromptsSig || "",
    corePromptsAi: Boolean(data.corePromptsAi),
  };
  state.journalInsight = normalizeInsight(data.insight);
  state.journalBodyCoach = normalizeBodyCoach(data.bodyCoach);
  const incomingMind = normalizeBodyMind(data.bodyMind);
  if (!incomingMind.text && String(data.bodyNote || "").trim()) incomingMind.text = String(data.bodyNote || "").trim();
  state.journalBodyMind = incomingMind;
  state.journalInternalTestRuns = normalizeInternalTestRuns(data.internalTestRuns);
  state.journalInternalResetAt = String(data.internalResetAt || "").trim();
  state.internalModelDebug =
    data.internalModelDebug && typeof data.internalModelDebug === "object"
      ? {
          think: data.internalModelDebug.think || null,
          awareness: data.internalModelDebug.awareness || null,
          execution: data.internalModelDebug.execution || null,
          thinkExt: data.internalModelDebug.thinkExt || null,
        }
      : { think: null, awareness: null, execution: null, thinkExt: null };
  state.journalExecFocus = normalizeExecFocus(data.executionFocus, data.executionCheckItems, execRawSourcesFrom(data));
  state.journalAwarenessResult = normalizeAwarenessResult(data.awarenessResult, { keepSource: true });
  state.journalAwarenessV3 = normalizeAwarenessV3Bag(data.awarenessV3);
  state.awarenessChoices = normalizeChoiceBag(data.awarenessChoices);
  state.thinkChoices = normalizeChoiceBag(data.thinkChoices);
  state.executionChoices = normalizeExecutionChoiceBag(data.executionChoices);
  state.journalUserMarks = userMarkBag(data.userMarks);
  state.journalManifestSentence = String(
    (data.manifestClose && data.manifestClose.manifestationStatement) || data.manifestSentence || ""
  ).trim();
  state.journalManifestHighlights = data.manifestHighlights && typeof data.manifestHighlights === "object" ? data.manifestHighlights : {};
  state.journalManifestClose = normalizeManifestCloseBag(data.manifestClose);
  if (state.journalManifestClose.manifestationStatement && !state.journalManifestSentence) {
    state.journalManifestSentence = state.journalManifestClose.manifestationStatement;
  }
  state.journalManifestPlan = normalizeManifestPlan(data.manifestPlan);
  state.manifestPrompts = journalUsesManifestClose(state.journalManifestClose)
    ? MANIFEST_CLOSE_PROMPTS.map((item) => ({ question: item.question, placeholder: item.placeholder }))
    : normalizeManifestPrompts(data.manifestPrompts);
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
  const bodyMindText = document.getElementById("bodyMindText");
  if (bodyMindText) {
    bodyMindText.value = state.journalBodyMind.text || "";
    bodyMindText.readOnly = isCurrentJournalArchived();
  }
  renderBodyMindInsight(state.journalBodyMind);
  syncBodyMindCta();
  const manifestVision = document.getElementById("manifestVision");
  if (manifestVision) manifestVision.value = data.manifest || "";
  renderManifestQuestions(state.manifestPrompts, { answers: data.manifestThink });
  renderManifestSentence(state.journalManifestSentence, state.journalManifestHighlights);
  renderJournalManifestResult();
  renderAwarenessQuestions(state.awarenessPrompts, { answers: data.awareness });
  if (usesAwarenessV3Path(data)) renderAwarenessV3();
  else renderAwarenessChoices(state.awarenessChoices);
  if (usesExecutionV3Path(data)) renderExecutionV3();
  else renderExecutionQuestions(state.executionPrompts, { answers: data.execution });
  const execNext = document.getElementById("execNext");
  if (execNext) {
    if (usesExecutionChoiceUi(data)) {
      const bag = normalizeExecutionChoiceBag(state.executionChoices);
      execNext.value = bag.custom || "";
    } else {
      execNext.value = data.smallestStep || "";
    }
  }
  syncExecStepUi();
  renderDeepThemes(state.deepPrompts, { deep: normalizeDeep(data.deep) });
  renderThinkSection();
  renderThinkChoiceResult(state.journalInsight);
  refreshJournalChecklists(data, { useSaved: true });
  renderInsightCard(state.journalInsight);
  renderBodyCoachCard(state.journalBodyCoach);
  syncCorePromptGate();
  state.journalHydrating = false;
  maybeConstrainJournalModeForPlan();
  applyJournalFolds();
  applyJournalArchiveLock();
  if (usesAwarenessV3Path(data) && !isCurrentJournalArchived()) {
    const bag = normalizeAwarenessV3Bag(state.journalAwarenessV3);
    if (!isGrowAwarenessBag(bag) && bag.selectedIds.length >= 1 && !observationCueMatchesBag(bag)) {
      scheduleAwarenessObservationCue();
    }
  }
}

function updateJournalDateLabel(iso) {
  const label = document.getElementById("journalDateLabel");
  const date = parseIsoDate(iso) || new Date();
  if (label) label.textContent = formatHeaderDate(date);
}

async function saveJournalDraft() {
  flushJournalAutosave();
  persistJournalNow({ showHint: true });
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
  state.rawText = review?.rawText || "";
  state.gratitude = review?.gratitude || "";
  state.selectedQuotes = [...(review?.selectedQuotes || [])];
  state.selectedSfm = [...(review?.selectedSfm || [])];
  state.selectedThinkActions = [...(review?.selectedThinkActions || [])];
  state.selectedPractice = [...(review?.selectedPractice || [])];
  if (review?.organize) state.organize = review.organize;
  if (Array.isArray(review?.thinkHistory) && review.thinkHistory.length) {
    state.think.history = review.thinkHistory;
    state.think.round = review.thinkHistory.length;
    state.think.current = review.thinkHistory[review.thinkHistory.length - 1];
  }
  renderAiStage();
  if (!reviewIsFinalized(review)) {
    maybeAutoGenerateInsight(review?.journal || collectJournal());
    maybeAutoGeneratePrompts(review?.journal || collectJournal());
    maybeAutoGenerateCorePrompts(review?.journal || collectJournal());
  }
  applyJournalArchiveLock();
}

function renderConclusionCallout(text, field, date, highlights, label) {
  const line = String(text || "").trim();
  if (!line) return "";
  const heading = String(label || "核心結論").trim() || "核心結論";
  return `
    <aside class="conclusion-callout">
      <p class="conclusion-callout__label">${escapeHtml(heading)}</p>
      ${field ? markableP(line, field, "conclusion-callout__text", date, highlights) : `<p class="conclusion-callout__text">${highlightedHtml(line, highlights)}</p>`}
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
  const date = options.date || "";
  const fieldBase = `thinkHistory.${index}`;
  const points = thinkPointConclusions(round);
  const conclusionHtml = points.length
    ? points.map((item, pointIndex) => renderConclusionCallout(item.conclusion, `${fieldBase}.conclusion.${pointIndex}`, date)).join("")
    : renderConclusionCallout("這一層還在成形，先把問題看清楚。");
  const current = Boolean(options.current);
  return `
    <article class="thought-unit ${current ? "thought-unit--current" : "thought-unit--past"}">
      <header class="thought-unit__head">
        ${markableHtml("h3", thinkThemeTitle(round, index), `${fieldBase}.title`, "thought-unit__title", date)}
        <span class="stars thought-unit__stars">[${starsText(thinkStarsOf(round))}]</span>
      </header>
      <div class="thought-unit__body">
        <p class="thought-unit__label">觀察紀錄</p>
        ${markableP(thinkObservationText(round, index, history, rawText), `${fieldBase}.note`, "thought-unit__note", date)}
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
    if (!ensurePlusFeature("think_ai")) return;
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
  if (!canUsePlusFeature("think_ai")) return;
  showToast("正在往下深挖…");
  try {
    const remote = await generateThink(state.rawText, state.organize, nextRound, selected, reply);
    if (state.thinkToken !== token) return;
    if (!remote) return;
    applyThinkResult(remote, nextRound, { silent: true, replace: true });
    showToast("雲端深度思考已套用。");
  } catch (error) {
    if (isPlusRequiredError(error)) return;
    console.error("[日精進 API] 深度思考雲端失敗，維持本地結果。", formatApiError(error), error);
    showToast(`雲端思考失敗：${formatApiError(error)}`);
  }
}

async function completeToday() {
  if (state.completeBusy || isCurrentJournalArchived()) return;
  flushJournalAutosave();
  if (state.journalMode === "quick") {
    const journal = collectJournal();
    if (!quickInsightReady(journal)) {
      showToast("請先寫下今日感謝、事件，並選擇心情。");
      document.getElementById("section-thanks")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  const collected = document.getElementById("thanksText") ? syncHiddenReviewText() : { journal: null, rawText: "" };
  const rawText = collected.rawText || document.getElementById("reviewText")?.value.trim() || state.rawText;
  if (!rawText && !state.organize && !journalHasContent(collected.journal)) {
    showToast("還沒有內容可以完成。");
    return;
  }
  const modal = document.getElementById("completeConfirmModal");
  if (modal && typeof modal.showModal === "function") {
    setPendingHistoryRating(3);
    modal.showModal();
    return;
  }
  await finishTodayReview();
}

function closeCompleteConfirmModal() {
  const modal = document.getElementById("completeConfirmModal");
  if (modal && typeof modal.close === "function" && modal.open) modal.close();
}

function confirmCompleteToday() {
  closeCompleteConfirmModal();
  catchAsync(() => finishTodayReview(), "完成今日復盤時發生問題");
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
  if (state.completeBusy || isCurrentJournalArchived()) return;
  flushJournalAutosave();
  if (state.journalMode === "quick") {
    const journal = collectJournal();
    if (!quickInsightReady(journal)) {
      showToast("請先寫下今日感謝、事件，並選擇心情。");
      document.getElementById("section-thanks")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  const guide = normalizeInsight(state.journalInsight).guide || emptyThinkGuide();
  if (guide.variant === "think-v2" && thinkV2AnsweredRounds(guide).length && !thinkV2Closed(guide)) {
    setCompleteBusy(true);
    try {
      await generateThinkV2Close({ fromComplete: true, auto: true });
    } finally {
      setCompleteBusy(false);
    }
  } else if (guide.rounds.filter((item) => item.answer).length >= 3 && !thinkGuideDone(guide)) {
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
  const patch = captureReviewPatch();
  const historyJournal = collected.journal || patch.journal || getReview(iso)?.journal || emptyJournal();
  const historyRating = normalizeHistoryRating(state.pendingHistoryRating) || 3;
  const historyShortTitle = buildHistoryListTitleForReview({
    ...patch,
    date: iso,
    journal: historyJournal,
    organize,
    rawText: rawText || patch.rawText,
  });

  upsertReview(iso, {
    ...patch,
    rawText: rawText || patch.rawText,
    journal: historyJournal,
    organize,
    gratitude: gratitude || patch.gratitude,
    historyRating,
    historyShortTitle,
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
  try {
    renderInsights();
    renderTasks();
    renderManifests();
    renderHistory();
  } catch (error) {
    console.error("[進行式 ING] 完成復盤後畫面更新失敗", error && error.message ? error.message : error);
  }
  flushCloudNow({ reason: "complete" }).catch((error) => {
    console.error("[進行式 ING] 完成復盤背景同步失敗", error && error.message ? error.message : error);
  });
  showToast(
    state.journalMode === "quick"
      ? "快速復盤已完成，今日洞察已存入歷史紀錄。"
      : "今日復盤已完成，勾選項目與明天最小一步已同步到側邊欄。"
  );
  const mode = state.journalMode === "quick" ? "quick" : "deep";
  trackProduct("review_completed", { mode, source: "complete" });
  trackProduct(mode === "quick" ? "quick_review_completed" : "deep_review_completed", { mode, source: "complete" });
  const journal = collected.journal || getReview(iso)?.journal || {};
  const check = journal.bodyCheck || {};
  if (
    (check.mood && (check.mood.flags || []).length) ||
    (check.body && (check.body.flags || []).length) ||
    (check.sleep && check.sleep.duration)
  ) {
    trackProduct("body_awareness_completed", { mode, source: "complete" });
  }
  if (String(journal.manifest || "").trim().length >= 4) {
    trackProduct("manifestation_created", { source: "complete" });
  }
  applyJournalArchiveLock();
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
    const plusOn = canUsePlusFeature(state.reportType === "month" ? "monthly_report_full" : "weekly_report_full");
    root.innerHTML = `
      ${
        plusOn
          ? `<article class="report-card">
        <div class="empty">
          <p class="empty__title">這個區間還沒有復盤</p>
          <p class="report-empty">寫下第一篇、勾選覺察／執行／顯化之後，這裡會出現圖表與深度思考。</p>
        </div>
      </article>`
          : `${renderFreeReportFacts(state.reportType, report)}${renderPlusReportLocks(state.reportType)}`
      }
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
      if (!reportHasAiContent(report) && canUsePlusFeature("monthly_report_full")) {
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

function renderStatusActionChips(id, status, attrName, copy = {}) {
  const safeId = escapeHtml(id);
  const attr = `${attrName}="${safeId}"`;
  const doing = copy.doing || "進行中";
  const later = copy.later || "待開始";
  const done = copy.done || "已完成";
  if (status === "done") {
    return renderTaskChip(doing, "back", `${attr} data-to="doing" aria-label="移到${doing}"`, "back");
  }
  if (status === "later") {
    return `${renderTaskChip(doing, "back", `${attr} data-to="doing" aria-label="移到${doing}"`, "back")}
      ${renderTaskChip(done, "done", `${attr} data-to="done" aria-label="標記${done}"`, "done")}`;
  }
  return `${renderTaskChip(later, "hold", `${attr} data-to="later" aria-label="移到${later}"`, "hold")}
    ${renderTaskChip(done, "done", `${attr} data-to="done" aria-label="標記${done}"`, "done")}`;
}

function statusMoveToast(to) {
  if (to === "later") return "已移到待辦。";
  if (to === "doing") return "已移到進行中。";
  if (to === "done") return "已標記完成。";
  return "已更新狀態。";
}

function libraryDateLabel(iso) {
  const day = String(iso || "").slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day || "未標日期";
  return `${y} / ${m} / ${d}`;
}

function libraryMonthDay(iso) {
  const day = String(iso || "").slice(0, 10);
  const parts = day.split("-");
  return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : "";
}

function taskGroupDateLabel(iso) {
  const day = String(iso || "").slice(0, 10);
  if (!day) return "";
  if (day === currentIso()) return "今天";
  const parts = day.split("-");
  return parts.length >= 3 ? `${parts[1]} / ${parts[2]}` : day;
}

function libraryFullDateLabel(iso) {
  const day = String(iso || "").slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return "";
  return `${y} / ${m} / ${d}`;
}

function librarySourceMeta(item) {
  const api = taskSidebarApi();
  const raw = String((item && item.source) || "").trim();
  const src = typeof api.presentLegacySource === "function" ? api.presentLegacySource(raw) : raw;
  const full = libraryFullDateLabel(item && (item.date || item.createdAt));
  if (full && src) return `來自 ${full} ${src}`;
  if (full) return `來自 ${full}`;
  if (src) return `來自 ${src}`;
  return "";
}

function taskSidebarDetail(task) {
  const title = String((task && task.title) || "").trim();
  const detail = String((task && (task.detail || task.note || task.body)) || "").trim();
  if (!detail || detail === title) return "";
  return detail;
}

function renderTaskMoveAction(task) {
  const id = escapeHtml(task.id);
  if (task.status === "later") {
    return `<button class="lib-act__move" data-task-status="${id}" data-to="doing" type="button">移到進行中</button>`;
  }
  if (task.status === "done") {
    return `<button class="lib-act__move" data-task-status="${id}" data-to="doing" type="button">重新開始</button>`;
  }
  return `<button class="lib-act__move" data-task-status="${id}" data-to="later" type="button">移到待辦</button>`;
}

function syncTaskFilterCounts(doingN, laterN, doneN) {
  const counts = { doing: doingN, later: laterN, done: doneN };
  document.querySelectorAll("#taskFilters [data-task-count]").forEach((el) => {
    const key = el.dataset.taskCount;
    el.textContent = String(counts[key] ?? 0);
  });
}

function libEmptyHtml(title, text) {
  return `<div class="lib-empty"><p class="lib-empty__title">${escapeHtml(title)}</p>${
    text ? `<p class="lib-empty__text">${escapeHtml(text)}</p>` : ""
  }</div>`;
}

function setTaskAddOpen(open) {
  const form = document.getElementById("taskForm");
  const toggle = document.getElementById("taskAddToggle");
  if (form) {
    form.hidden = !open;
    form.classList.toggle("is-open", open);
  }
  if (toggle) {
    toggle.hidden = open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = "＋ 新增一個行動";
  }
  if (open) {
    const title = document.getElementById("taskTitle");
    if (title) title.focus();
  }
}

function renderTaskFocusAction(task, todayIso) {
  if (task.status !== "doing") return "";
  const api = taskSidebarApi();
  const on = typeof api.isTodayFocus === "function" ? api.isTodayFocus(task, todayIso) : false;
  const id = escapeHtml(task.id);
  return `<button class="lib-act__focus${on ? " is-on" : ""}" data-task-focus="${id}" type="button">${on ? "今天 ✓" : "今天做"}</button>`;
}

function renderTaskItem(task, options = {}) {
  const done = task.status === "done";
  const later = task.status === "later";
  const parts = sidebarPresentTask(task);
  const title = parts.title || String(task.detail || "").trim();
  const detail = parts.detail && parts.detail !== title ? parts.detail : "";
  const meta = librarySourceMeta(task);
  const id = escapeHtml(task.id);
  const todayIso = options.todayIso || sidebarTodayIso();
  const compact = Boolean(options.compact);
  return `
    <article class="lib-act${done ? " is-done" : ""}${later ? " is-later" : ""}${compact ? " lib-act--focus" : ""}">
      <label class="lib-act__check">
        <input type="checkbox" data-task-toggle="${id}" ${done ? "checked" : ""} aria-label="標記完成" />
        <span class="lib-dot" aria-hidden="true"></span>
      </label>
      <div class="lib-act__main">
        <div class="lib-act__top">
          <p class="lib-act__title">${escapeHtml(title)}</p>
          <div class="lib-act__ops" role="group" aria-label="行動操作">
            ${renderTaskFocusAction(task, todayIso)}
            ${renderTaskMoveAction(task)}
            <button class="lib-act__del" data-task-delete="${id}" type="button" aria-label="刪除這項行動">×</button>
          </div>
        </div>
        ${detail ? `<p class="lib-act__detail">${escapeHtml(detail)}</p>` : ""}
        ${compact ? "" : meta ? `<p class="lib-act__meta">${escapeHtml(meta)}</p>` : ""}
      </div>
    </article>
  `;
}

function renderLibraryTaskGroups(items, todayIso) {
  const grouped = new Map();
  items.forEach((task) => {
    const iso = task.date || String(task.createdAt || "").slice(0, 10) || "";
    if (!grouped.has(iso)) grouped.set(iso, []);
    grouped.get(iso).push(task);
  });
  return [...grouped.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([iso, rows]) => {
      const label = taskGroupDateLabel(iso);
      return `${label ? `<p class="lib-day">${escapeHtml(label)}</p>` : ""}${rows
        .map((task) => renderTaskItem(task, { todayIso }))
        .join("")}`;
    })
    .join("");
}

function renderTodayFocusSection(focused, todayIso) {
  const count = focused.length;
  const items = focused
    .map((task) => renderTaskItem(task, { todayIso, compact: true }))
    .join("");
  return `<section class="task-focus">
    <div class="task-focus__head">
      <h3 class="task-focus__title">今天要做</h3>
      <p class="task-focus__count">${count} / 3</p>
    </div>
    ${items}
    <p class="task-focus__hint">今天先完成這些就好。</p>
  </section>`;
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
  syncTaskFilterCounts(doing.length, later.length, done.length);

  if (!all.length) {
    list.innerHTML = libEmptyHtml("還沒有正在進行的行動。", "從今天最小的一步開始就好。");
    return;
  }

  if (filter === "later") {
    list.innerHTML = later.length ? renderLibraryTaskGroups(later) : libEmptyHtml("目前沒有待開始的行動。");
    return;
  }
  if (filter === "done") {
    list.innerHTML = done.length ? renderLibraryTaskGroups(done) : libEmptyHtml("還沒有完成的行動。");
    return;
  }

  const api = taskSidebarApi();
  const todayIso = sidebarTodayIso();
  const focused = typeof api.focusedDoingTasks === "function" ? api.focusedDoingTasks(doing, todayIso) : [];
  const rest = typeof api.otherDoingTasks === "function" ? api.otherDoingTasks(doing, todayIso) : doing;
  if (!doing.length) {
    list.innerHTML = libEmptyHtml("目前沒有進行中的行動。");
    return;
  }
  const restHtml = rest.length
    ? `${focused.length ? `<p class="task-focus__rest">其他進行中</p>` : ""}${renderLibraryTaskGroups(rest, todayIso)}`
    : "";
  list.innerHTML = `${renderTodayFocusSection(focused, todayIso)}${restHtml}`;
}

function setTaskFilter(filter) {
  const next = ["doing", "later", "done"].includes(filter) ? filter : "doing";
  state.taskFilter = next;
  document.querySelectorAll("#taskFilters .lib-tab").forEach((item) => {
    const on = item.dataset.filter === next;
    item.classList.toggle("is-on", on);
    item.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function setTaskStatus(id, status) {
  const allowed = new Set(["doing", "later", "done"]);
  const next = allowed.has(status) ? status : "doing";
  const api = taskSidebarApi();
  const prev = getTasks().find((task) => task.id === id);
  const prevStatus = prev && prev.status;
  saveTasks(
    getTasks().map((task) => {
      if (task.id !== id) return task;
      const patched =
        typeof api.clearFocusLeavingDoing === "function" ? api.clearFocusLeavingDoing(task, next) : task;
      return { ...patched, status: next, updatedAt: new Date().toISOString() };
    })
  );
  setTaskFilter(next);
  renderTasks();
  if (prevStatus !== "done" && next === "done") {
    showToast((api && api.COMPLETE_TOAST) || "完成了。你正在把想法慢慢變成生活。");
  }
  if (next === "done") trackProduct("action_card_completed", { source: "sidebar" });
}

function toggleTaskTodayFocus(id) {
  const api = taskSidebarApi();
  if (typeof api.toggleTodayFocus !== "function") return;
  const result = api.toggleTodayFocus(getTasks(), id, sidebarTodayIso(), new Date().toISOString());
  if (result.reason === "limit") {
    showToast(api.FOCUS_LIMIT_TOAST || "今天先完成 3 件就好。");
    return;
  }
  if (!result.ok) return;
  saveTasks(result.tasks);
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
    source: "自行新增",
    date: currentIso(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveTasks(tasks);
  trackProduct("action_card_created", { source: "manual" });
  document.getElementById("taskTitle").value = "";
  const detailInput = document.getElementById("taskDetail");
  if (detailInput) detailInput.value = "";
  setTaskFilter("doing");
  renderTasks();
  setTaskAddOpen(false);
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
    list.innerHTML = libEmptyHtml("還沒有留下的覺察。", "完成今日復盤後，重要的看見會慢慢累積在這裡。");
    return;
  }
  if (!items.length) {
    list.innerHTML = libEmptyHtml("這個區間目前沒有留下的覺察。");
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
      const quotes = rows
        .map(
          (item) => `
            <article class="lib-quote">
              <p class="lib-quote__text">${escapeHtml(item.title)}</p>
              <button class="lib-del" data-insight-delete="${item.id}" type="button">刪除</button>
            </article>
          `
        )
        .join("");
      return `<section class="lib-group"><p class="lib-quote__date">${escapeHtml(libraryDateLabel(iso))}</p>${quotes}</section>`;
    })
    .join("");
}

function manifestKicker(item) {
  const blob = String((item && item.vision) || "");
  if (/成為|節奏|證明自己|我想成為/.test(blob)) return "我想成為的自己";
  return "我想要的生活";
}

function manifestStatusLabel(status) {
  if (status === "done") return "已實現 ✓";
  if (status === "later") return "待開始";
  return "靠近中";
}

function manifestRecordStatus(item) {
  const steps = normalizeManifestPlan({ steps: item && item.steps }).steps;
  if (!steps.length) return item && item.status ? item.status : "doing";
  return manifestPlanStatusFromSteps(steps) || item.status || "doing";
}

function renderManifestItem(item) {
  const steps = normalizeManifestPlan({ steps: item && item.steps }).steps;
  const hasSteps = steps.length > 0;
  const autoStatus = hasSteps ? manifestPlanStatusFromSteps(steps) : "";
  const status = autoStatus || item.status;
  const done = status === "done";
  const later = status === "later";
  const vision = String(item.vision || "").trim();
  const title = String(item.title || "").trim();
  const wish = vision || title;
  const near = !hasSteps && vision && title && title !== vision ? title : "";
  const doneCount = steps.filter((step) => step.completed).length;
  const id = escapeHtml(item.id);
  return `
    <article class="lib-vision${done ? " is-done" : ""}${later ? " is-later" : ""}">
      <p class="lib-vision__kicker">${escapeHtml(manifestKicker(item))}</p>
      <p class="lib-vision__wish">${escapeHtml(wish)}</p>
      ${
        hasSteps
          ? `<p class="lib-vision__progress">${doneCount} / ${steps.length} 已完成</p>
            <ul class="lib-vision__steps">
              ${steps
                .map(
                  (step) => `
                <li class="lib-vision__step${step.completed ? " is-done" : ""}">
                  <span class="lib-vision__step-mark" aria-hidden="true">${step.completed ? "✓" : "○"}</span>
                  <span class="lib-vision__step-text">${escapeHtml(step.title)}</span>
                </li>`
                )
                .join("")}
            </ul>`
          : near
          ? `<div class="lib-vision__near"><p class="lib-vision__near-label">小小靠近</p><p class="lib-vision__near-text">${escapeHtml(near)}</p></div>`
          : ""
      }
      <span class="lib-vision__meta">${escapeHtml(manifestStatusLabel(status))}${
        item.date ? ` · ${escapeHtml(libraryMonthDay(item.date))}` : ""
      }</span>
      <div class="lib-vision__ops" role="group" aria-label="顯化操作">
        ${renderStatusActionChips(item.id, status, "data-manifest-status", {
          doing: "靠近中",
          later: "待開始",
          done: "已實現",
        })}
        ${renderTaskChip("刪除", "delete", `data-manifest-delete="${id}" aria-label="刪除這項顯化目標"`, "trash")}
      </div>
    </article>
  `;
}

function renderManifests() {
  const list = document.getElementById("manifestList");
  if (!list) return;
  const all = getManifests();
  const later = all
    .filter((item) => manifestRecordStatus(item) === "later")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const doing = all
    .filter((item) => manifestRecordStatus(item) === "doing")
    .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
  const done = all
    .filter((item) => manifestRecordStatus(item) === "done")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const filter = ["all", "doing", "done"].includes(state.manifestFilter) ? state.manifestFilter : "doing";

  if (!all.length) {
    list.innerHTML = libEmptyHtml("還沒有正在靠近的願景。", "把真正想要的生活慢慢留下來。");
    return;
  }

  const items =
    filter === "all"
      ? [...all].sort((a, b) =>
          String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || ""))
        )
      : filter === "done"
      ? done
      : [...doing, ...later];
  if (!items.length) {
    const empty =
      filter === "done" ? "還沒有已實現的願景。" : "目前沒有正在靠近的願景。";
    list.innerHTML = libEmptyHtml(empty);
    return;
  }
  list.innerHTML = items.map((item) => renderManifestItem(item)).join("");
}

function setManifestFilter(filter) {
  const next = ["all", "doing", "done"].includes(filter) ? filter : "doing";
  state.manifestFilter = next;
  document.querySelectorAll("#manifestFilters .lib-tab").forEach((item) => {
    const on = item.dataset.manifestFilter === next;
    item.classList.toggle("is-on", on);
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

function historySummaryApi() {
  return (typeof window !== "undefined" && window.NichiHistorySummary) || {};
}

function getHistoryDailySummary(review) {
  const api = historySummaryApi();
  if (typeof api.getHistoryDailySummary === "function") return api.getHistoryDailySummary(review);
  return { title: "看看這一天留下的紀錄", listTitle: "看看這一天留下的紀錄", tags: [], keywords: [], rating: 0 };
}

function buildHistoryListTitleForReview(review) {
  const api = historySummaryApi();
  if (typeof api.buildHistoryListTitle === "function") return api.buildHistoryListTitle(review);
  return getHistoryDailySummary(review).listTitle || getHistoryDailySummary(review).title || "";
}

function historyMatchesTag(review, tag) {
  const api = historySummaryApi();
  if (typeof api.historyMatchesTag === "function") return api.historyMatchesTag(review, tag);
  if (tag === "all") return true;
  if (tag === "important") return reviewIsHistoryImportant(review);
  return getHistoryDailySummary(review).tags.includes(tag);
}

function historyMatchesQuery(review, query) {
  const api = historySummaryApi();
  if (typeof api.historyMatchesQuery === "function") return api.historyMatchesQuery(review, query);
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return reviewSearchText(review).toLowerCase().includes(needle);
}

function reviewIsHistoryImportant(review) {
  const api = reviewMergeApi();
  if (typeof api.reviewIsHistoryImportant === "function") return api.reviewIsHistoryImportant(review);
  return Boolean(review && review.historyMeta && review.historyMeta.important === true);
}

function normalizeHistoryRating(value) {
  const api = reviewMergeApi();
  if (typeof api.normalizeHistoryRating === "function") return api.normalizeHistoryRating(value);
  const n = Math.round(Number(value));
  return n >= 1 && n <= 5 ? n : 0;
}

function setPendingHistoryRating(value) {
  const n = normalizeHistoryRating(value) || 3;
  state.pendingHistoryRating = n;
  document.querySelectorAll("#completeRatingStars [data-history-rating]").forEach((btn) => {
    const star = Number(btn.dataset.historyRating);
    const on = star <= n;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", star === n ? "true" : "false");
    btn.textContent = on ? "★" : "☆";
  });
}

function formatHistoryListDate(iso) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return String(iso || "");
  return `${y} / ${m} / ${d}`;
}

function historyListStars(review) {
  const n = normalizeHistoryRating(review && review.historyRating);
  if (!n) return "";
  return "★".repeat(n);
}

function historyHighlight(review) {
  return getHistoryDailySummary(review).title;
}

function historyJournalIcon(name) {
  const icons = {
    thanks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>`,
    event: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h12v14H6z"/><path d="M9 9h6M9 13h4"/></svg>`,
    body: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-7-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 16.5 12 21 12 21z"/><path d="M12 11v3"/></svg>`,
    aware: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
    exec: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>`,
    insight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10c-.8.7-1 1.4-1 2H9c0-.6-.2-1.3-1-2A6 6 0 0 1 12 3z"/></svg>`,
    happened: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h12v14H6z"/><path d="M9 9h6M9 13h4"/></svg>`,
    stuck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10c-.8.7-1 1.4-1 2H9c0-.6-.2-1.3-1-2A6 6 0 0 1 12 3z"/></svg>`,
    seen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
    action: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>`,
    quote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>`,
    archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v16l-5-2.4L7 20V4z"/></svg>`,
    manifest: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.6H21l-5.4 4 2.1 6.4L12 16.6 6.3 20l2.1-6.4L3 9.6h6.8z"/></svg>`,
    note: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v16l-5-2.4L7 20V4z"/></svg>`,
  };
  return icons[name] || icons.note;
}

function historySectionMarkup(title, icon, body, open, iso = "") {
  return `<section class="history-subcard is-open history-subcard--static" data-history-section-id="${escapeHtml(icon)}" data-history-section-date="${escapeHtml(iso)}">
    <h3 class="history-subcard__title">${escapeHtml(title)}</h3>
    <div class="history-subcard__body">${body}</div>
  </section>`;
}

function historySectionStore(iso) {
  const key = String(iso || "");
  if (!key) return {};
  if (!state.historyOpenSections[key] || typeof state.historyOpenSections[key] !== "object") {
    state.historyOpenSections[key] = {};
  }
  return state.historyOpenSections[key];
}

function historySectionIsOpen(iso, sectionId, fallback) {
  const store = iso ? state.historyOpenSections[iso] : null;
  if (store && Object.prototype.hasOwnProperty.call(store, sectionId)) return Boolean(store[sectionId]);
  return Boolean(fallback);
}

function setHistorySectionOpen(iso, sectionId, open) {
  if (!iso || !sectionId) return;
  historySectionStore(iso)[sectionId] = Boolean(open);
}

function ensureHistorySectionDefaults(iso, sectionIds) {
  if (!iso || !Array.isArray(sectionIds) || !sectionIds.length) return;
  const store = state.historyOpenSections[iso];
  if (store && Object.keys(store).length) return;
  const next = {};
  sectionIds.forEach((id, index) => {
    next[id] = index === 0;
  });
  state.historyOpenSections[iso] = next;
}

function historySection(title, icon, blocks, open = false, iso = "") {
  const body = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean).join("");
  if (!body.trim()) return "";
  if (iso) ensureHistorySectionDefaults(iso, [icon]);
  return historySectionMarkup(title, icon, body, historySectionIsOpen(iso, icon, open), iso);
}

function historySectionsHtml(items, iso = "") {
  const sections = items
    .map(([title, icon, blocks]) => {
      const body = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean).join("");
      return body.trim() ? { title, icon, body } : null;
    })
    .filter(Boolean);
  if (iso) ensureHistorySectionDefaults(iso, sections.map((item) => item.icon));
  return sections
    .map((item, index) =>
      historySectionMarkup(item.title, item.icon, item.body, historySectionIsOpen(iso, item.icon, index === 0), iso)
    )
    .join("");
}

function captureHistoryScroll() {
  const view = document.getElementById("view");
  return {
    viewY: view ? view.scrollTop : 0,
    windowY: window.scrollY || document.documentElement.scrollTop || 0,
  };
}

function restoreHistoryScroll(prev) {
  if (!prev) return;
  const apply = () => {
    const view = document.getElementById("view");
    if (view) view.scrollTop = prev.viewY;
    if (typeof window.scrollTo === "function") window.scrollTo(0, prev.windowY);
  };
  apply();
  requestAnimationFrame(apply);
}

function historyBlock(label, bodyHtml) {
  if (!String(bodyHtml || "").trim()) return "";
  return `<div class="history-journal__tile">${
    label ? `<p class="history-journal__label">${escapeHtml(label)}</p>` : ""
  }${bodyHtml}</div>`;
}

function historyQaHtml(question, questionField, answer, answerField, date) {
  const q = String(question || "").trim();
  const a = String(answer || "").trim();
  if (!q && !a) return "";
  return historyBlock(
    "",
    `${q ? markableP(q, questionField, "history-journal__headline", date) : ""}${
      a ? markableP(a, answerField, "history-journal__text", date) : ""
    }`
  );
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

function historyMarkedItemsHtml(items) {
  const list = (Array.isArray(items) ? items : [items])
    .map((item) => {
      if (item && typeof item === "object" && item.text != null) {
        return {
          text: String(item.text || "").trim(),
          field: item.field || "",
          date: item.date || "",
          highlights: item.highlights,
        };
      }
      return { text: String(item || "").trim(), field: "", date: "", highlights: undefined };
    })
    .filter((item) => item.text);
  if (!list.length) return "";
    const cell = (item) =>
      item.field
        ? markableP(item.text, item.field, "history-journal__text", item.date, item.highlights)
        : `<p class="history-journal__text">${escapeHtml(item.text)}</p>`;
  if (list.length === 1) return cell(list[0]);
  return `<ul class="history-journal__list">${list
    .map((item) => `<li>${item.field ? markableSpan(item.text, item.field, "", item.date, item.highlights) : escapeHtml(item.text)}</li>`)
    .join("")}</ul>`;
}

function historyExecChecksHtml(journal, date) {
  const items = normalizeExecCheckItems(journal && journal.executionCheckItems, execRawSourcesFrom(journal));
  if (items.length) {
    return `<div class="history-exec-cards">${items
      .map(
        (item, index) => `<article class="history-exec-card">
        ${markableP(item.title, `exec.item.${index}.title`, "history-exec-card__title", date, nestedHighlights(item.highlights, "title"))}
        ${item.detail ? markableP(item.detail, `exec.item.${index}.detail`, "history-exec-card__lead", date, nestedHighlights(item.highlights, "detail")) : ""}
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

function historyQuotesHtml(quotes, date) {
  const list = (Array.isArray(quotes) ? quotes : []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!list.length) return "";
  return `<div class="history-journal__quotes">${list
    .map((quote, index) => `<blockquote class="history-journal__quote">${markableSpan(quote, `awareness.quote.${index}`, "", date)}</blockquote>`)
    .join("")}</div>`;
}

function historyBodyCheckHtml(journal, date) {
  const check = normalizeBodyCheck(journal.bodyCheck, journal.bodyTags, journal.bodyNote);
  const lines = [];
  const moodFlags = (check.mood.flags || []).join("、");
  const bodyFlags = (check.body.flags || []).filter((flag) => flag !== "其他").join("、");
  if (moodFlags || check.mood.reason) {
    lines.push({ field: "bodyCheck.mood", text: `心情：${moodFlags || "狀態平穩"}${check.mood.reason ? `｜${check.mood.reason}` : ""}` });
  }
  if (bodyFlags || check.body.other || check.body.reason) {
    const bodyLine = [bodyFlags, check.body.other ? `其他：${check.body.other}` : ""]
      .filter(Boolean)
      .join("、") || "狀態平穩";
    lines.push({ field: "bodyCheck.body", text: `身體：${bodyLine}${check.body.reason ? `｜${check.body.reason}` : ""}` });
  }
  if (check.sleep.duration || check.sleep.quality || check.sleep.energy || check.sleep.reason) {
    lines.push({
      field: "bodyCheck.sleep",
      text: `睡眠：時間 ${check.sleep.duration || "未填"}｜品質 ${check.sleep.quality || "未填"}｜起床精神 ${check.sleep.energy || "未填"}${
        check.sleep.reason ? `｜${check.sleep.reason}` : ""
      }`,
    });
  }
  const coach = normalizeBodyCoach(journal.bodyCoach);
  const title = String(coach.title || "").trim();
  const titleLine = title ? (/[。！？]$/.test(title) ? title : `${title}。`) : "";
  const coachHtml = [
    titleLine ? renderConclusionCallout(titleLine, "bodyCoach.title", date, fieldHighlightsOf(coach.highlights, "title")) : "",
    coach.analysis ? historyBlock("今天的身心訊號", markableP(coach.analysis, "bodyCoach.analysis", "history-journal__text", date, fieldHighlightsOf(coach.highlights, "analysis"))) : "",
    coach.notice ? historyBlock("值得留意", markableP(coach.notice, "bodyCoach.notice", "history-journal__text", date, fieldHighlightsOf(coach.highlights, "notice"))) : "",
    ...(coach.suggestions || []).map((item, index) => {
      const text = String(item || "").trim();
      return text
        ? historyBlock(`今晚照顧 ${index + 1}`, markableP(text, `bodyCoach.suggestion.${index}`, "history-journal__text", date, fieldHighlightsOf(coach.highlights, "suggestions")))
        : "";
    }),
  ].join("");
  return `${historyMarkedItemsHtml(lines.map((item) => ({ ...item, date })))}${coachHtml}`;
}

function historyArchiveTextIsRedundant(usedTexts, text) {
  const raw = String(text || "").trim();
  if (!raw) return true;
  const api = historyReadingApi();
  if (typeof api.hasInformationGain === "function") return !api.hasInformationGain(usedTexts, raw);
  return false;
}

function historyArchiveAllowsText(usedFields, usedTexts, field, text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const used = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
  if (field && used.has(field)) return false;
  return !historyArchiveTextIsRedundant(usedTexts, raw);
}

function historyBodyCoachLongformHtml(journal, date, usedFields, usedTexts) {
  const used = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
  const texts = Array.isArray(usedTexts) ? usedTexts : [];
  const coach = normalizeBodyCoach(journal && journal.bodyCoach);
  const title = String(coach.title || "").trim();
  const titleLine = title ? (/[。！？]$/.test(title) ? title : `${title}。`) : "";
  return [
    titleLine && historyArchiveAllowsText(used, texts, "bodyCoach.title", titleLine)
      ? renderConclusionCallout(titleLine, "bodyCoach.title", date, fieldHighlightsOf(coach.highlights, "title"))
      : "",
    coach.analysis && historyArchiveAllowsText(used, texts, "bodyCoach.analysis", coach.analysis)
      ? historyBlock("今天的身心訊號", markableP(coach.analysis, "bodyCoach.analysis", "history-journal__text", date, fieldHighlightsOf(coach.highlights, "analysis")))
      : "",
    coach.notice && historyArchiveAllowsText(used, texts, "bodyCoach.notice", coach.notice)
      ? historyBlock("值得留意", markableP(coach.notice, "bodyCoach.notice", "history-journal__text", date, fieldHighlightsOf(coach.highlights, "notice")))
      : "",
    ...(coach.suggestions || []).map((item, index) => {
      const text = String(item || "").trim();
      const field = `bodyCoach.suggestion.${index}`;
      return text && historyArchiveAllowsText(used, texts, field, text)
        ? historyBlock(`今晚照顧 ${index + 1}`, markableP(text, field, "history-journal__text", date, fieldHighlightsOf(coach.highlights, "suggestions")))
        : "";
    }),
  ].join("");
}

function historyTextMeaningful(value) {
  return String(value == null ? "" : value).trim().length > 0;
}

function historyGuideFromReview(review) {
  const insight = review && review.journal && typeof review.journal === "object" ? review.journal.insight : null;
  const guide = insight && typeof insight === "object" ? insight.guide : null;
  const raw = guide && typeof guide === "object" ? guide.rounds : null;
  if (Array.isArray(raw)) return { insight: insight || {}, guide: guide || {}, rounds: raw };
  if (raw && typeof raw === "object") {
    const rounds = Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => raw[key])
      .filter((item) => item && typeof item === "object");
    return { insight: insight || {}, guide: guide || {}, rounds };
  }
  return { insight: insight || {}, guide: guide || {}, rounds: [] };
}

function historyRoundHasContent(round) {
  if (!round || typeof round !== "object") return false;
  return (
    historyTextMeaningful(round.question) ||
    historyTextMeaningful(round.answer) ||
    historyTextMeaningful(round.hint)
  );
}

function historyHasGuideRounds(review) {
  return historyGuideFromReview(review).rounds.some(historyRoundHasContent);
}

function renderHistoryGuideCloseHtml(insight, guide, date) {
  const data = guide && typeof guide === "object" ? guide : {};
  const insightData = insight && typeof insight === "object" ? insight : {};
  return [
    data.title || insightData.title
      ? renderConclusionCallout(data.title || insightData.title, "think.title", date, fieldHighlightsOf(data.highlights, "title"))
      : "",
    data.awareness || data.summary
      ? historyBlock("今日覺察", markableP(data.awareness || data.summary, "think.awareness", "history-journal__text", date, fieldHighlightsOf(data.highlights, "awareness")))
      : "",
    data.selfSeen
      ? historyBlock("今天我看見的自己", markableP(data.selfSeen, "think.selfSeen", "history-journal__text", date, fieldHighlightsOf(data.highlights, "selfSeen")))
      : "",
    data.takeaway
      ? historyBlock("今日帶走的一句話", markableP(data.takeaway, "think.takeaway", "history-journal__headline", date, fieldHighlightsOf(data.highlights, "takeaway")))
      : "",
  ].join("");
}

function renderHistoryGuideRoundsHtml(insight, guide, date) {
  const parsed = historyGuideFromReview({ journal: { insight: { ...(insight || {}), guide } } });
  const rounds = parsed.rounds.filter(historyRoundHasContent);
  return rounds
    .map((item, index) => {
      const question = String(item.question || "").trim();
      const hint = String(item.hint || "").trim();
      const answer = String(item.answer || "").trim();
      return historyBlock(
        `第 ${String(index + 1).padStart(2, "0")} 輪`,
        `${question ? markableP(question, `think.round.${index}.question`, "history-journal__text", date) : ""}${
          hint ? markableP(hint, `think.round.${index}.hint`, "history-journal__note", date) : ""
        }${
          answer
            ? markableP(answer, `think.round.${index}.answer`, "history-journal__note", date)
            : `<p class="history-journal__note">未回答</p>`
        }`
      );
    })
    .join("");
}

function renderHistoryGuideHtml(insight, guide, date) {
  return `${renderHistoryGuideRoundsHtml(insight, guide, date)}${renderHistoryGuideCloseHtml(insight, guide, date)}${
    Array.isArray(guide && guide.actions) && guide.actions.length
      ? historyBlock("兩件具體下一步", actionStepsHtml(guide.actions, { fieldPrefix: "think.action", date, highlights: fieldHighlightsOf(guide.highlights, "actions") }))
      : ""
  }`;
}

function renderHistoryInsightBlocksHtml(insight, date) {
  const psychology = String(insight.psychology || insight.analysis || insight.logic || "").trim();
  const conclusion = String(insight.conclusion || insight.summary || "").trim();
  const reflection = String(insight.reflection || "").trim();
  const suggestions = Array.isArray(insight.suggestions) ? insight.suggestions : [];
  const takeaways = Array.isArray(insight.takeaways) ? insight.takeaways : [];
  const marks = insight.highlights && typeof insight.highlights === "object" ? insight.highlights : {};
  return `${insight.title ? renderConclusionCallout(insight.title, "think.title", date, fieldHighlightsOf(marks, "title")) : ""}${
    psychology || conclusion
      ? historyBlock("① 今天的身心訊號", markableP(psychology || conclusion, "think.psychology", "history-journal__text", date, fieldHighlightsOf(marks, "psychology")))
      : ""
  }${insight.bodyLink ? historyBlock("", markableP(insight.bodyLink, "think.bodyLink", "history-journal__note", date, fieldHighlightsOf(marks, "bodyLink"))) : ""}${
    reflection
      ? historyBlock("② 客觀檢討與反思", markableP(reflection, "think.reflection", "history-journal__text", date, fieldHighlightsOf(marks, "reflection")))
      : ""
  }${
    suggestions.length
      ? historyBlock("③ 具體突破建議（怎麼做會更好）", actionStepsHtml(suggestions, { fieldPrefix: "think.suggestion", date, highlights: fieldHighlightsOf(marks, "suggestions") }))
      : ""
  }${
    takeaways.length
      ? historyBlock(
          "今日核心重點整理",
          `<ul class="history-journal__list">${takeaways
            .map((item, index) => `<li>${markableSpan(item, `think.takeawayItem.${index}`, "", date, fieldHighlightsOf(marks, "takeaways"))}</li>`)
            .join("")}</ul>`
        )
      : ""
  }`;
}

function renderHistoryThinkHistoryHtml(thinkHistory, review) {
  const list = Array.isArray(thinkHistory) ? thinkHistory : [];
  return list
    .map((round, index) =>
      renderThoughtUnit(round, index, list.length || 5, {
        history: list,
        rawText: review?.rawText || "",
        date: review?.date || "",
      })
    )
    .join("");
}

function renderHistoryDeepJournalHtml(deep, deepPrompts, date) {
  const slots = Array.isArray(deep) ? deep : deep && typeof deep === "object" ? [deep] : [];
  const prompts = Array.isArray(deepPrompts) ? deepPrompts : [];
  const slotHtml = slots
    .map((slot, index) => {
      const prompt = prompts[index] && typeof prompts[index] === "object" ? prompts[index] : {};
      const title = String(prompt.title || prompt.question || `深度思考 ${String(index + 1).padStart(2, "0")}`).trim();
      const parts = [];
      if (slot && typeof slot === "object") {
        if (String(slot.plain || "").trim()) parts.push(markableP(slot.plain, `deep.${index}.plain`, "history-journal__text", date));
        if (String(slot.deep || "").trim()) parts.push(markableP(slot.deep, `deep.${index}.deep`, "history-journal__text", date));
        (Array.isArray(slot.followups) ? slot.followups : []).forEach((item, followIndex) => {
          if (String(item || "").trim()) parts.push(markableP(item, `deep.${index}.followup.${followIndex}`, "history-journal__text", date));
        });
        (Array.isArray(slot.notes) ? slot.notes : []).forEach((item, noteIndex) => {
          if (String(item || "").trim()) parts.push(markableP(item, `deep.${index}.note.${noteIndex}`, "history-journal__text", date));
        });
      } else if (String(slot || "").trim()) {
        parts.push(markableP(slot, `deep.${index}.plain`, "history-journal__text", date));
      }
      if (!parts.length) return "";
      const head = [];
      if (title) head.push(markableP(title, `deep.${index}.title`, "history-journal__headline", date));
      if (String(prompt.plainGuide || "").trim()) {
        head.push(markableP(String(prompt.plainGuide).replace(/^白話想一想[:：]?\s*/, ""), `deep.${index}.plainGuide`, "history-journal__text", date));
      }
      if (String(prompt.deepGuide || "").trim()) {
        head.push(markableP(String(prompt.deepGuide).replace(/^深挖一點點[:：]?\s*/, ""), `deep.${index}.deepGuide`, "history-journal__text", date));
      }
      return historyBlock("", head.concat(parts).join(""));
    })
    .join("");
  if (slotHtml) return slotHtml;
  return prompts
    .map((item, index) => {
      const title = String((item && (item.title || item.question)) || `深度思考 ${String(index + 1).padStart(2, "0")}`).trim();
      const body = String((item && (item.body || item.prompt || item.note)) || "").trim();
      if (!title && !body) return "";
      return historyBlock(
        "",
        `${title ? markableP(title, `deep.${index}.title`, "history-journal__headline", date) : ""}${
          body ? markableP(body, `deep.${index}.plain`, "history-journal__text", date) : ""
        }`
      );
    })
    .join("");
}

function renderHistoryDeepThinking(review) {
  const parsed = historyGuideFromReview(review);
  const api = reviewMergeApi();
  const helperSource =
    typeof api.historyDeepThinkingSource === "function"
      ? api.historyDeepThinkingSource(review)
      : { kind: "none" };
  let selected = "none";
  let html = "";
  const thinkChoiceBag = normalizeChoiceBag(review && review.journal && review.journal.thinkChoices);
  if (hasMeaningfulChoices(thinkChoiceBag)) {
    selected = "thinkChoices";
    const date = review && review.date;
    const selectedLines = selectedChoiceTexts(thinkChoiceBag)
      .map((text, index) => markableP(text, `think.choice.${index}`, "history-journal__text", date))
      .join("");
    const noneLine = thinkChoiceBag.none
      ? markableP(choiceNoneText(), "think.choice.none", "history-journal__note", date)
      : "";
    const choiceHtml = selectedLines || noneLine ? historyBlock("今日勾選", `${selectedLines}${noneLine}`) : "";
    html = `${choiceHtml}${renderHistoryGuideCloseHtml(parsed.insight, parsed.guide, date)}`;
  } else if (historyHasGuideRounds(review) || historyTextMeaningful(parsed.guide.summary) || historyTextMeaningful(parsed.guide.awareness)) {
    selected = "guide";
    html = renderHistoryGuideHtml(parsed.insight, parsed.guide, review && review.date);
  } else if (helperSource.kind === "blocks" || helperSource.kind === "thinkHistory" || helperSource.kind === "deep") {
    selected = helperSource.kind;
    if (helperSource.kind === "blocks") html = renderHistoryInsightBlocksHtml(helperSource.insight || {}, review && review.date);
    else if (helperSource.kind === "thinkHistory") html = renderHistoryThinkHistoryHtml(helperSource.thinkHistory, review);
    else html = renderHistoryDeepJournalHtml(helperSource.deep, helperSource.deepPrompts, review && review.date);
  } else if (parsed.insight && (historyTextMeaningful(parsed.insight.psychology) || historyTextMeaningful(parsed.insight.analysis) || historyTextMeaningful(parsed.insight.conclusion) || historyTextMeaningful(parsed.insight.summary) || historyTextMeaningful(parsed.insight.reflection))) {
    selected = "blocks";
    html = renderHistoryInsightBlocksHtml(parsed.insight, review && review.date);
  } else if (Array.isArray(review && review.thinkHistory) && review.thinkHistory.some((item) => historyTextMeaningful(item && (item.question || item.reply || item.insight || item.title)))) {
    selected = "thinkHistory";
    html = renderHistoryThinkHistoryHtml(review.thinkHistory, review);
  } else if (review && review.journal && (historyTextMeaningful(review.journal.deep) || historyTextMeaningful(review.journal.deepPrompts))) {
    selected = "deep";
    html = renderHistoryDeepJournalHtml(review.journal.deep, review.journal.deepPrompts, review && review.date);
  }
  if (parsed.rounds.some(historyRoundHasContent) && selected !== "thinkChoices" && !String(html || "").trim()) {
    console.error("[history-debug] GUIDE EXISTS BUT RENDER EMPTY", {
      date: review && (review.date || review.iso),
      roundsLength: parsed.rounds.length,
      selectedFormat: selected,
      helperKind: helperSource.kind,
      htmlLength: String(html || "").length,
    });
  }
  if (!window.__NICHI_HISTORY_DEBUG) window.__NICHI_HISTORY_DEBUG = [];
  window.__NICHI_HISTORY_DEBUG.push({
    date: review && review.date,
    selected,
    helperKind: helperSource.kind,
    roundsLength: parsed.rounds.length,
    htmlLength: String(html || "").length,
  });
  console.log("[history-debug] selected format", selected);
  console.log("[history-debug] rendered html length", String(html || "").length);
  return html;
}

function journalHasManifestHistory(journal) {
  if (!journal || typeof journal !== "object") return false;
  if (journalUsesManifestPlan(journal) || journalUsesManifestClose(journal)) return true;
  if (String(journal.manifest || "").trim()) return true;
  if (String(journal.manifestSentence || "").trim()) return true;
  if ((journal.manifestThink || []).some((item) => String(item || "").trim())) return true;
  if ((journal.manifestChecks || []).some((item) => String(item || "").trim())) return true;
  if (normalizeManifestPathItems(journal.manifestCheckItems).some((item) => String(item && item.title || "").trim())) return true;
  return false;
}

function historyManifestBlocks(journal, historyIso) {
  if (journalUsesManifestPlan(journal)) {
    const plan = normalizeManifestPlan(journal.manifestPlan);
    return [
      String(journal.manifest || "").trim()
        ? historyBlock("我想顯化的是", markableP(journal.manifest, "manifest.vision", "history-journal__text", historyIso))
        : "",
      historyBlock(
        "我正在靠近它",
        plan.steps
          .map((item, index) => {
            const title = `${padManifestStepNo(index)}｜${item.title}${item.completed ? "（已完成）" : ""}`;
            return `${markableP(title, `manifest.plan.step.${index}.title`, "history-journal__text", historyIso)}${
              item.detail ? markableP(item.detail, `manifest.plan.step.${index}.detail`, "history-journal__text", historyIso) : ""
            }`;
          })
          .join("")
      ),
    ];
  }
  if (journalUsesManifestClose(journal)) {
    const close = normalizeManifestCloseBag(journal.manifestClose);
    const statement = close.manifestationStatement || String(journal.manifestSentence || "").trim();
    return [
      String(journal.manifest || "").trim()
        ? historyBlock("我真正想靠近的是什麼", markableP(journal.manifest, "manifest.vision", "history-journal__text", historyIso))
        : "",
      close.futureVision
        ? historyBlock("我正在靠近的生活", markableP(close.futureVision, "manifest.close.futureVision", "history-journal__text", historyIso))
        : "",
      close.approachStep
        ? historyBlock("今天，我可以先靠近一點", markableP(close.approachStep, "manifest.close.approachStep", "history-journal__text", historyIso))
        : "",
      statement
        ? historyBlock(
            "我的顯化句",
            markableP(
              statement,
              "manifest.sentence",
              "history-journal__headline",
              historyIso,
              fieldHighlightsOf(journal.manifestHighlights, "sentence")
            )
          )
        : "",
    ];
  }
  return [
    String(journal.manifest || "").trim()
      ? historyBlock("我想顯化的事情", markableP(journal.manifest, "manifest.vision", "history-journal__text", historyIso))
      : "",
    ...normalizeManifestPrompts(journal.manifestPrompts).map((item, index) =>
      historyQaHtml(
        item.question,
        `manifest.prompt.${index}.question`,
        (journal.manifestThink || [])[index],
        `manifest.prompt.${index}.answer`,
        historyIso
      )
    ),
    historyBlock(
      "讓願望靠近現實",
      historyMarkedItemsHtml(
        (normalizeManifestPathItems(journal.manifestCheckItems).some((item) => item.title)
          ? normalizeManifestPathItems(journal.manifestCheckItems)
          : (journal.manifestChecks || []).map((title) => ({ title }))
        ).flatMap((item, index) => {
          const rows = [
            {
              text: item.title,
              field: `manifest.path.${index}.title`,
              date: historyIso,
              highlights: nestedHighlights(item.highlights, "title"),
            },
          ];
          if (item.detail) {
            rows.push({
              text: item.detail,
              field: `manifest.path.${index}.detail`,
              date: historyIso,
              highlights: nestedHighlights(item.highlights, "detail"),
            });
          }
          return rows;
        })
      )
    ),
    journal.manifestSentence
      ? historyBlock(
          "我的顯化句",
          markableP(
            journal.manifestSentence,
            "manifest.sentence",
            "history-journal__headline",
            historyIso,
            fieldHighlightsOf(journal.manifestHighlights, "sentence")
          )
        )
      : "",
  ];
}

function historyReadingApi() {
  return (typeof window !== "undefined" && window.NichiHistoryReading) || {};
}

function buildHistoryReadingForReview(review) {
  const api = historyReadingApi();
  if (typeof api.buildHistoryReading === "function") return api.buildHistoryReading(review);
  return {
    happened: { thanks: [], event: "", mood: "", bodySignals: [] },
    stuck: null,
    seen: null,
    actions: [],
    quote: null,
    usedFields: [],
    usedTexts: [],
    archive: { hasDeepProcess: false, hasBodyCoach: false, hasAwareProcess: false, hasGuideRounds: false },
  };
}

function historyReadingActionsHtml(actions, date) {
  const list = (Array.isArray(actions) ? actions : []).filter((item) => item && String(item.text || "").trim());
  if (!list.length) return "";
  return `<div class="exec-step-list">${list
    .map((item, index) => {
      const text = String(item.text || "").trim();
      const detail = String(item.detail || "").trim();
      const field = item.field || (index === 0 ? "exec.smallestStep" : `exec.selected.${index}`);
      return `<div class="exec-step-list__item">
        <span class="exec-step-list__num">${String(index + 1).padStart(2, "0")}</span>
        <div class="exec-step-list__copy">
          ${markableP(text, field, "exec-step-list__text", date, item.highlights)}
          ${detail && detail !== text ? `<p class="exec-step-list__detail">${escapeHtml(detail)}</p>` : ""}
        </div>
      </div>`;
    })
    .join("")}</div>`;
}

function historyHappenedHtml(reading, journal, date) {
  const happened = reading && reading.happened ? reading.happened : {};
  const thanks = historyMarkedItemsHtml(
    thanksItemsFrom(happened.thanks && happened.thanks.length ? happened.thanks : journal.thanksText || journal.thanks).map((text, index) => ({
      text,
      field: `thanks.${index}`,
      date,
    }))
  );
  const eventText = String(happened.event || journal.event || "").trim();
  const mood = String(happened.mood || journal.mood || "").trim();
  const signals = Array.isArray(happened.bodySignals) ? happened.bodySignals : [];
  return [
    thanks ? historyBlock("感謝", thanks) : "",
    eventText ? historyBlock("事件", markableP(eventText, "event", "history-journal__text", date)) : "",
    mood ? historyBlock("心情", `<p class="history-journal__mood"><span class="tag">${escapeHtml(mood)}</span></p>`) : "",
    signals.length
      ? `<div class="history-journal__signals">${historyMarkedItemsHtml(signals.map((item) => ({ ...item, date })))}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");
}

function historyExecProcessHtml(journal, date, usedFields) {
  if (hasMeaningfulExecutionChoices(journal.executionChoices)) return "";
  const used = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
  if ([...used].some((field) => String(field || "").startsWith("exec.prompt."))) return "";
  const prompts = normalizeExecutionPrompts(journal.executionPrompts);
  const answers = Array.isArray(journal.execution) ? journal.execution : [];
  const count = Math.max(prompts.length, answers.length);
  return Array.from({ length: count }, (_, index) => {
    const prompt = prompts[index];
    const answer = String(answers[index] || "").trim();
    const question = prompt?.question || prompt?.title || prompt || `執行力 ${index + 1}`;
    if (answer) return historyQaHtml(question, `exec.prompt.${index}.question`, answer, `exec.prompt.${index}.answer`, date);
    if (prompt?.parked) return historyQaHtml(question, `exec.prompt.${index}.question`, "先放著", `exec.prompt.${index}.answer`, date);
    return "";
  })
    .filter(Boolean)
    .join("");
}

function historyAwareProcessHtml(journal, date, usedFields, usedTexts) {
  const used = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
  const texts = Array.isArray(usedTexts) ? usedTexts : [];
  const awareChoiceBag = normalizeChoiceBag(journal.awarenessChoices);
  if (hasMeaningfulChoices(awareChoiceBag)) {
    return [
      ...selectedChoiceTexts(awareChoiceBag).map((text, index) => {
        const field = `awareness.choice.${index}`;
        return historyArchiveAllowsText(used, texts, field, text)
          ? markableP(text, field, "history-journal__text", date)
          : "";
      }),
      awareChoiceBag.none && !used.has("awareness.choice.none")
        ? markableP(choiceNoneText(), "awareness.choice.none", "history-journal__note", date)
        : "",
    ]
      .filter(Boolean)
      .join("");
  }
  return (
    journal.awarenessPrompts && journal.awarenessPrompts.length ? journal.awarenessPrompts : AWARENESS_QUESTIONS
  )
    .map((item, index) => {
      const answer = normalizeYesNo((journal.awareness || [])[index]) || String((journal.awareness || [])[index] || "").trim();
      const question = item.question || item.title || item;
      return answer
        ? historyQaHtml(question, `awareness.prompt.${index}.question`, answer, `awareness.prompt.${index}.answer`, date)
        : "";
    })
    .filter(Boolean)
    .join("");
}

function historyThinkChoiceProcessHtml(journal, date, usedFields, usedTexts) {
  const bag = normalizeChoiceBag(journal && journal.thinkChoices);
  if (!hasMeaningfulChoices(bag)) return "";
  const used = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
  const texts = Array.isArray(usedTexts) ? usedTexts : [];
  return [
    ...selectedChoiceTexts(bag).map((text, index) => {
      const field = `think.choice.${index}`;
      return historyArchiveAllowsText(used, texts, field, text)
        ? markableP(text, field, "history-journal__text", date)
        : "";
    }),
    bag.none && !used.has("think.choice.none")
      ? markableP(choiceNoneText(), "think.choice.none", "history-journal__note", date)
      : "",
  ]
    .filter(Boolean)
    .join("");
}

function historyArchiveInsightBlocksHtml(insight, date, usedFields, usedTexts) {
  const used = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
  const texts = Array.isArray(usedTexts) ? usedTexts : [];
  const data = insight && typeof insight === "object" ? insight : {};
  const psychology = String(data.psychology || data.analysis || data.logic || "").trim();
  const conclusion = String(data.conclusion || data.summary || "").trim();
  const reflection = String(data.reflection || "").trim();
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  const takeaways = Array.isArray(data.takeaways) ? data.takeaways : [];
  const marks = data.highlights && typeof data.highlights === "object" ? data.highlights : {};
  const core = psychology || conclusion;
  return `${
    data.title && historyArchiveAllowsText(used, texts, "think.title", data.title)
      ? renderConclusionCallout(data.title, "think.title", date, fieldHighlightsOf(marks, "title"))
      : ""
  }${
    core && historyArchiveAllowsText(used, texts, "think.psychology", core)
      ? historyBlock("", markableP(core, "think.psychology", "history-journal__text", date, fieldHighlightsOf(marks, "psychology")))
      : ""
  }${
    data.bodyLink && historyArchiveAllowsText(used, texts, "think.bodyLink", data.bodyLink)
      ? historyBlock("", markableP(data.bodyLink, "think.bodyLink", "history-journal__note", date, fieldHighlightsOf(marks, "bodyLink")))
      : ""
  }${
    reflection && historyArchiveAllowsText(used, texts, "think.reflection", reflection)
      ? historyBlock("客觀檢討與反思", markableP(reflection, "think.reflection", "history-journal__text", date, fieldHighlightsOf(marks, "reflection")))
      : ""
  }${suggestions
    .map((item, index) => {
      const text = String(item || "").trim();
      const field = `think.suggestion.${index}`;
      return text && historyArchiveAllowsText(used, texts, field, text)
        ? historyBlock("具體下一步", markableP(text, field, "history-journal__text", date, fieldHighlightsOf(marks, "suggestions")))
        : "";
    })
    .join("")}${
    takeaways.some((item, index) => historyArchiveAllowsText(used, texts, `think.takeawayItem.${index}`, item))
      ? `<ul class="history-journal__list">${takeaways
          .map((item, index) => {
            const text = String(item || "").trim();
            const field = `think.takeawayItem.${index}`;
            return text && historyArchiveAllowsText(used, texts, field, text)
              ? `<li>${markableSpan(text, field, "", date, fieldHighlightsOf(marks, "takeaways"))}</li>`
              : "";
          })
          .join("")}</ul>`
      : ""
  }`;
}

function historyLayerUsedTexts(reading) {
  if (Array.isArray(reading && reading.usedTexts) && reading.usedTexts.length) {
    return reading.usedTexts.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const happened = reading && reading.happened ? reading.happened : {};
  return [
    happened.event,
    ...(Array.isArray(happened.thanks) ? happened.thanks : []),
    reading && reading.stuck && reading.stuck.text,
    reading && reading.seen && reading.seen.text,
    reading && reading.quote && reading.quote.text,
    ...(Array.isArray(reading && reading.actions) ? reading.actions.map((item) => item && item.text) : []),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function historyArchiveHtml(review, reading, journal, date) {
  const archive = reading && reading.archive ? reading.archive : {};
  const used = new Set(reading && reading.usedFields ? reading.usedFields : []);
  const usedTexts = historyLayerUsedTexts(reading);
  const parsed = historyGuideFromReview(review);
  const blocks = [];
  if (archive.hasGuideRounds) {
    blocks.push(historyGroup("深度思考對話", renderHistoryGuideRoundsHtml(parsed.insight, parsed.guide, date)));
  } else if (archive.hasDeepProcess) {
    const helper =
      typeof reviewMergeApi().historyDeepThinkingSource === "function"
        ? reviewMergeApi().historyDeepThinkingSource(review)
        : { kind: "none" };
    if (helper.kind === "thinkHistory") blocks.push(historyGroup("深度思考對話", renderHistoryThinkHistoryHtml(helper.thinkHistory, review)));
    else if (helper.kind === "deep") blocks.push(historyGroup("深度思考對話", renderHistoryDeepJournalHtml(helper.deep, helper.deepPrompts, date)));
    else if (helper.kind === "blocks") blocks.push(historyGroup("深度思考對話", historyArchiveInsightBlocksHtml(helper.insight || {}, date, used, usedTexts)));
    else if (Array.isArray(review && review.thinkHistory) && review.thinkHistory.length) {
      blocks.push(historyGroup("深度思考對話", renderHistoryThinkHistoryHtml(review.thinkHistory, review)));
    } else if (journal.deep || journal.deepPrompts) {
      blocks.push(historyGroup("深度思考對話", renderHistoryDeepJournalHtml(journal.deep, journal.deepPrompts, date)));
    }
  } else {
    const leftoverInsight = historyArchiveInsightBlocksHtml(parsed.insight, date, used, usedTexts);
    if (leftoverInsight && leftoverInsight.replace(/<[^>]+>/g, "").trim()) {
      blocks.push(historyGroup("舊洞察整理", leftoverInsight));
    }
  }
  const thinkChoicesHtml = historyThinkChoiceProcessHtml(journal, date, used, usedTexts);
  if (thinkChoicesHtml) blocks.push(historyGroup("深度思考勾選", thinkChoicesHtml));
  if (archive.hasAwareProcess) {
    const awareProcess = historyAwareProcessHtml(journal, date, used, usedTexts);
    if (awareProcess) blocks.push(historyGroup("覺察作答", awareProcess));
  }
  const execProcess = historyExecProcessHtml(journal, date, used);
  if (execProcess) blocks.push(historyGroup("執行力作答", execProcess));
  if (archive.hasBodyCoach) {
    const coachHtml = historyBodyCoachLongformHtml(journal, date, used, usedTexts);
    if (coachHtml) blocks.push(historyGroup("身心覺察整理", coachHtml));
  }
  const bodyNote = String(journal.bodyNote || "").trim();
  if (bodyNote && historyArchiveAllowsText(used, usedTexts, "bodyCheck.note", bodyNote)) {
    blocks.push(historyGroup("身體備註", markableP(bodyNote, "bodyCheck.note", "history-journal__text", date)));
  }
  if (journalHasManifestHistory(journal)) {
    const manifestHtml = historyManifestBlocks(journal, date).filter(Boolean).join("");
    if (manifestHtml.trim()) blocks.push(historyGroup("顯化紀錄", manifestHtml));
  }
  const body = blocks.filter(Boolean).join("");
  if (!body.trim()) return "";
  const open = historySectionIsOpen(date, "archive", false);
  return `<details class="history-archive"${open ? " open" : ""} data-history-archive="${escapeHtml(date)}"><summary>查看當天完整紀錄</summary><div class="history-archive__body">${body}</div></details>`;
}

function renderHistoryJournal(review) {
  const journal = review?.journal && typeof review.journal === "object" ? review.journal : emptyJournal();
  const historyIso = String((review && review.date) || "");
  const reading = buildHistoryReadingForReview(review);
  const happenedHtml = historyHappenedHtml(reading, journal, historyIso);
  const stuckHtml = reading.stuck
    ? historyBlock("", markableP(reading.stuck.text, reading.stuck.field, "history-journal__text", historyIso, reading.stuck.highlights))
    : "";
  const seenHtml = reading.seen
    ? historyBlock("", markableP(reading.seen.text, reading.seen.field, "history-journal__text", historyIso, reading.seen.highlights))
    : "";
  const actionHtml = historyReadingActionsHtml(reading.actions, historyIso);
  const quoteHtml = reading.quote
    ? `<aside class="conclusion-callout conclusion-callout--quote">${markableP(
        reading.quote.text,
        reading.quote.field,
        "conclusion-callout__text",
        historyIso,
        reading.quote.highlights
      )}</aside>`
    : "";
  const archiveHtml = historyArchiveHtml(review, reading, journal, historyIso);
  const parts = historySectionsHtml(
    [
      ["① 今天發生了什麼", "happened", happenedHtml],
      ["② 我今天真正卡住的是什麼", "stuck", stuckHtml],
      ["③ 我今天看見了自己什麼", "seen", seenHtml],
      ["④ 我接下來要怎麼做", "action", actionHtml],
      ["⑤ 今日帶走的一句話", "quote", quoteHtml],
    ],
    historyIso
  );

  if (!parts && !archiveHtml) {
    const fallback = String(review?.rawText || "").trim();
    const organize = review?.organize;
    if (organize) return `<div class="history-journal">${historySection("當天紀錄", "note", renderHistoryReport(review), true, historyIso)}</div>`;
    if (fallback) return `<div class="history-journal">${historySection("當天紀錄", "note", historyTextBlock("", fallback), true, historyIso)}</div>`;
    return `<div class="history-journal"><p class="history-journal__empty">這天還沒有留下完整復盤內容。</p></div>`;
  }

  return `<div class="history-journal">${parts || ""}${archiveHtml || ""}</div>`;
}

function renderHistory(options = {}) {
  const list = document.getElementById("historyList");
  if (!list) return;
  if (state.page && state.page !== "history") return;
  if (state.historyDetailDate) {
    showHistoryDetailView();
    renderHistoryDetail(state.historyDetailDate);
    return;
  }
  showHistoryListView();
  const scroll = options.scroll || captureHistoryScroll();
  const query = state.historyQuery.trim().toLowerCase();
  const entries = Object.entries(getReviews())
    .filter(([, review]) => reviewIsComplete(review))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .filter(([iso, review]) => {
      if (state.historyTag !== "all") {
        if (!historyMatchesTag(review, state.historyTag)) return false;
      }
      if (!query) return true;
      const isoHay = `${iso} ${formatDisplayDate(iso)} ${formatHistoryListDate(iso)}`;
      return historyMatchesQuery(review, query) || isoHay.toLowerCase().includes(query);
    });

  if (!Object.values(getReviews()).some(reviewIsComplete)) {
    list.innerHTML = `<div class="empty"><p class="empty__title">還沒有歷史復盤</p>今天寫下第一篇，就會出現在這裡。</div>`;
    restoreHistoryScroll(scroll);
    return;
  }
  if (!entries.length) {
    list.innerHTML = `<div class="empty empty--quiet"><p class="empty__title">沒有找到相關紀錄。</p>換個關鍵字試試看。</div>`;
    restoreHistoryScroll(scroll);
    return;
  }

  list.innerHTML = entries
    .map(([iso, review]) => {
      const historyReview = { ...review, date: (review && review.date) || iso };
      const summary = getHistoryDailySummary(historyReview);
      const stars = historyListStars(historyReview);
      const cats = (summary.categories || summary.tags || []).slice(0, 2);
      return `
        <article class="history-card" data-history-iso="${escapeHtml(iso)}">
          <button class="history-card__summary" data-history-open="${iso}" type="button" aria-label="開啟 ${escapeHtml(formatHistoryListDate(iso))} 完整紀錄">
            <span class="history-card__content">
              <span class="history-card__title">${escapeHtml(summary.listTitle || summary.title)}</span>
              <span class="history-card__date">${escapeHtml(formatHistoryListDate(iso))}${
                stars ? `<span class="history-card__stars">${escapeHtml(stars)}</span>` : ""
              }</span>
              ${cats.length ? `<span class="history-card__cats">${escapeHtml(cats.join("　"))}</span>` : ""}
            </span>
          </button>
        </article>
      `;
    })
    .join("");
  restoreHistoryScroll(scroll);
}

function renderHistoryDetail(iso) {
  const root = historyDetailViewEl();
  if (!root) return;
  const date = historyDetailIso(iso);
  if (!date) {
    root.innerHTML = `
      <button class="history-detail__back" data-history-back type="button">← 返回歷史紀錄</button>
      <article class="history-detail-sheet">
        <p class="history-journal__empty">找不到這一天的紀錄。</p>
      </article>
    `;
    return;
  }
  const review = getReview(date);
  if (!review || !reviewIsComplete(review)) {
    root.innerHTML = `
      <button class="history-detail__back" data-history-back type="button">← 返回歷史紀錄</button>
      <article class="history-detail-sheet">
        <p class="history-journal__empty">這天還沒有留下完整復盤內容。</p>
      </article>
    `;
    return;
  }
  const historyReview = { ...review, date: (review && review.date) || date };
  const summary = getHistoryDailySummary(historyReview);
  const stars = historyListStars(historyReview);
  const cats = (summary.categories || summary.tags || []).slice(0, 2);
  const saved = reviewIsHistoryImportant(historyReview);
  root.innerHTML = `
    <button class="history-detail__back" data-history-back type="button">← 返回歷史紀錄</button>
    <article class="history-detail-sheet">
      <header class="history-detail__head">
        <h1 class="history-detail__title">${escapeHtml(summary.listTitle || summary.title)}</h1>
        <p class="history-detail__date">${escapeHtml(formatHistoryListDate(date))}${
          stars ? `<span class="history-card__stars">${escapeHtml(stars)}</span>` : ""
        }</p>
        <button class="history-detail__save${saved ? " is-on" : ""}" data-history-important="${escapeHtml(date)}" type="button" aria-pressed="${saved ? "true" : "false"}">${
          saved ? "★ 已收藏" : "☆ 收藏這天"
        }</button>
        ${cats.length ? `<p class="history-detail__tags">${escapeHtml(cats.join("　"))}</p>` : ""}
      </header>
      ${renderHistoryJournal(historyReview)}
    </article>
  `;
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

function catchAsync(run, fallbackMessage) {
  try {
    const result = run();
    if (result && typeof result.catch === "function") {
      result.catch((error) => {
        if (isPlusRequiredError(error)) return;
        const text = formatApiError(error);
        if (!text) return;
        showToast(`${fallbackMessage}：${text}`);
      });
    }
  } catch (error) {
    if (isPlusRequiredError(error)) return;
    const text = formatApiError(error);
    if (!text) return;
    showToast(`${fallbackMessage}：${text}`);
  }
}

function handleTodayPointerClick(event) {
  const node = eventTargetElement(event?.target);
  if (!node || typeof node.closest !== "function") return false;
  if (event._nichiTodayHandled) return false;
  if (!node.closest("#page-today")) return false;
  const handled = () => {
    event.preventDefault();
    event.stopPropagation();
    event._nichiTodayHandled = true;
    return true;
  };

  const foldBtn = node.closest("[data-journal-fold]");
  if (foldBtn && !node.closest(".journal-fold__panel")) {
    const root = foldBtn.closest(".journal-fold");
    handled();
    if (!root?.id) return true;
    foldTogglePointer = { id: "", at: 0 };
    toggleJournalFold(root.id);
    return true;
  }

  if (isCurrentJournalArchived() && isArchivedJournalWriteTarget(node)) {
    event.preventDefault();
    event.stopPropagation();
    event._nichiTodayHandled = true;
    return true;
  }
  if (isCurrentJournalArchived()) return false;
  if (node.closest("[data-extension-question]")) return false;

  if (node.closest("#btnAwarenessV3")) {
    handled();
    catchAsync(() => generateAwarenessV3({ confirmed: true }), "今天的覺察還沒整理好");
    return true;
  }
  if (node.closest("#btnExecutionV3")) {
    handled();
    catchAsync(() => generateExecutionV3({ confirmed: true }), "今天的下一步還沒整理好");
    return true;
  }
  const awareV3Btn = node.closest("[data-aware-v3-id]");
  if (awareV3Btn) {
    handled();
    pinAwareFold();
    toggleAwarenessV3(awareV3Btn.dataset.awareV3Id);
    return true;
  }
  if (node.closest("#btnAwarePrompts")) {
    handled();
    pinAwareFold();
    if (usesAwarenessV3Path()) {
      catchAsync(() => generateAwarenessV3({ confirmed: true }), "今天的覺察還沒整理好");
      return true;
    }
    catchAsync(() => generateAwarenessChoices(), "覺察選項生成失敗");
    return true;
  }
  if (node.closest("#btnReflectionV3")) {
    handled();
    catchAsync(() => generateReflectionV3({ confirmed: true }), "今天的深度思考還沒整理好");
    return true;
  }
  if (node.closest("#btnUnderstandAnswer")) {
    handled();
    catchAsync(() => generateUnderstandAnswer({ confirmed: true }), "這次的思考還沒整理好");
    return true;
  }
  if (node.closest("#btnThinkExtStart")) {
    handled();
    reportThinkExtDebug({ extensionClick: true, handlerEntered: true, failureStage: "CLICK" });
    catchAsync(() => generateThinkExtensionAsk({ confirmed: true }), "這次沒有整理完成，再試一次。");
    return true;
  }
  if (node.closest("#btnThinkExtAgain")) {
    handled();
    reportThinkExtDebug({ extensionClick: true, handlerEntered: true, failureStage: "CLICK" });
    catchAsync(() => generateThinkExtensionAsk({ confirmed: true, startNextRound: true }), "這次沒有整理完成，再試一次。");
    return true;
  }
  if (node.closest("#btnThinkExtRefresh")) {
    handled();
    catchAsync(() => generateThinkExtensionAsk({ confirmed: true, refresh: true }), "延伸深度思考還沒整理好");
    return true;
  }
  if (node.closest("#btnThinkExtClose") || node.closest("#btnThinkExtCloseStale")) {
    handled();
    catchAsync(() => generateThinkExtensionClose({ confirmed: true }), "這次的深度結論還沒整理好");
    return true;
  }
  if (node.closest("#btnThinkChoices")) {
    handled();
    setJournalFoldOpen("section-deep", true, { manual: true });
    if (usesReflectionV3Path()) {
      catchAsync(() => generateReflectionV3({ confirmed: true }), "今天的深度思考還沒整理好");
      return true;
    }
    catchAsync(() => (usesThinkV2Path() ? generateThinkV2Ask() : generateThinkChoices()), "深度思考還沒開始");
    return true;
  }
  if (node.closest("#btnThinkV2Next")) {
    handled();
    catchAsync(() => submitThinkV2Answer(), "這次回答還沒送出");
    return true;
  }
  if (node.closest("#btnThinkClose")) {
    handled();
    catchAsync(() => (usesThinkV2Path() ? generateThinkV2Close() : generateThinkChoicesClose()), "今天的深度看見還沒整理好");
    return true;
  }
  if (node.closest("#btnExecDeep")) {
    handled();
    catchAsync(() => generateExecDeepAsk(), "這次問題還沒好");
    return true;
  }
  if (node.closest("#btnExecDeepNext")) {
    handled();
    catchAsync(() => submitExecDeepAnswer(), "這次回答還沒送出");
    return true;
  }
  if (node.closest("#btnExecDeepFinal")) {
    handled();
    catchAsync(() => generateExecDeepFinal({ force: true }), "今天的執行力還沒整理好");
    return true;
  }
  if (node.closest("#btnExecChoiceFollow")) {
    handled();
    setJournalFoldOpen("section-exec", true, { manual: true });
    const answer = String(document.getElementById("execFollowup")?.value || "").trim();
    if (!answer) {
      showToast("先寫下一句就好，再整理明天的小行動。");
      return true;
    }
    catchAsync(() => generateExecutionChoices({ followupAnswer: answer, force: true }), "明天的小行動還沒好");
    return true;
  }
  if (node.closest("#btnExecFollow")) {
    handled();
    setJournalFoldOpen("section-exec", true, { manual: true });
    catchAsync(() => generateExecutionFollowup({ force: true }), "下一題還沒好");
    return true;
  }
  if (node.closest("#btnExecPrompts")) {
    handled();
    setJournalFoldOpen("section-exec", true, { manual: true });
    catchAsync(() => generateCorePrompts({ scope: "execution", force: true }), "執行題生成失敗");
    return true;
  }
  if (node.closest("#btnInsightAi") || node.closest("#btnQuickInsight")) {
    handled();
    setJournalFoldOpen(thinkGuideFoldId(), true, { manual: true });
    catchAsync(() => generateJournalInsight(), "深度思考還沒開始");
    return true;
  }
  if (node.closest("#btnAwareAi")) {
    handled();
    catchAsync(() => generateJournalChecklist("awareness"), "今天的覺察還沒整理好");
    return true;
  }
  if (node.closest("#btnExecAi")) {
    handled();
    catchAsync(() => generateJournalChecklist("execution"), "行動卡還沒整理好");
    return true;
  }
  if (node.closest("#btnManifestAi") || node.closest("#btnManifestRegen")) {
    handled();
    catchAsync(() => generateManifestPlan({ force: true }), "可以做到的步驟還沒整理好");
    return true;
  }
  if (node.closest("#btnManifestPaths")) {
    handled();
    catchAsync(() => generateManifestPlan({ force: true }), "可以做到的步驟還沒整理好");
    return true;
  }
  const stepExec = node.closest("[data-manifest-step-exec]");
  if (stepExec) {
    handled();
    addManifestStepToExec(stepExec.dataset.manifestStepExec);
    return true;
  }
  if (node.closest("#btnManifestToExec")) {
    handled();
    addManifestApproachToExec();
    return true;
  }
  if (node.closest("#btnManifestAccept")) {
    handled();
    acceptManifestClose();
    return true;
  }
  if (node.closest("#btnBodyCoach")) {
    handled();
    catchAsync(() => generateBodyCoach(), "身心建議還沒整理好");
    return true;
  }
  const nextThink = node.closest("[data-think-guide-next]");
  if (nextThink) {
    handled();
    catchAsync(() => submitThinkGuideRound(), "下一輪還沒送出");
    return true;
  }
  const choiceBtn = node.closest("[data-choice-id]");
  if (choiceBtn) {
    handled();
    const kind = choiceBtn.dataset.choiceKind === "think"
      ? "think"
      : choiceBtn.dataset.choiceKind === "execution" || choiceBtn.dataset.choiceKind === "execution-final"
        ? "execution"
        : "awareness";
    if (kind === "awareness") pinAwareFold();
    else if (kind === "think") setJournalFoldOpen("section-deep", true, { manual: true });
    else setJournalFoldOpen("section-exec", true, { manual: true });
    toggleJournalChoice(kind, choiceBtn.dataset.choiceId);
    return true;
  }
  const answerBtn = node.closest("[data-aware-answer]");
  if (answerBtn) {
    handled();
    const item = answerBtn.closest(".aware-quiz__item");
    if (!item) return true;
    const index = Number(item.dataset.index || 0);
    const prev = normalizeYesNo(item.dataset.answer);
    const value = normalizeYesNo(answerBtn.dataset.awareAnswer);
    item.dataset.answer = value;
    item.querySelectorAll(".aware-quiz__opt").forEach((btn) => {
      btn.classList.toggle("is-on", btn === answerBtn);
    });
    pinAwareFold();
    const prompts = normalizeAwarenessPrompts(state.awarenessPrompts);
    if (value && value !== prev && index < prompts.length - 1) {
      state.awarenessPrompts = prompts.slice(0, index + 1);
      const kept = collectAwarenessQuizAnswers().slice(0, index + 1);
      renderAwarenessQuestions(state.awarenessPrompts, { answers: kept });
      state.journalAwarenessResult = emptyAwarenessResult();
      state.journalMeta.awarenessAi = false;
      state.journalMeta.awarenessAiSig = "";
    }
    persistJournalQuietly();
    const journal = collectJournal();
    renderAwareQuote(journal.awarenessCheckItems, journal.awarenessChecks);
    const nextPrompts = normalizeAwarenessPrompts(state.awarenessPrompts);
    const answered = awarenessQuizAnsweredCount(journal.awareness);
    if (value && answered >= nextPrompts.length && nextPrompts.length < AWARENESS_QUIZ_COUNT) {
      catchAsync(() => generateAwarenessFollowup(), "下一題覺察還沒好");
    }
    return true;
  }
  const copyBtn = node.closest("[data-copy-aware-quote]");
  if (!copyBtn) return false;
  handled();
  const quote =
    copyBtn.closest(".aware-result")?.dataset.copy ||
    copyBtn.closest(".aware-quote")?.dataset.quote ||
    "";
  if (!quote) return true;
  navigator.clipboard.writeText(quote).then(
    () => showToast("今天的覺察已複製。"),
    () => showToast("複製失敗，請手動選取文字。")
  );
  return true;
}

let userMarkSession =
  typeof userMarkApi().createToolbarSession === "function"
    ? userMarkApi().createToolbarSession()
    : { mode: "", interacting: false, pending: null, markId: "" };

function userMarkBarEl() {
  return document.getElementById("userMarkBar");
}

function clearNativeSelection() {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (sel && typeof sel.removeAllRanges === "function") sel.removeAllRanges();
}

function hideUserMarkBar() {
  const bar = userMarkBarEl();
  if (bar) bar.hidden = true;
}

function dismissUserMarkUi(reason) {
  const api = userMarkApi();
  if (reason === "complete" && typeof api.completeToolbarSession === "function") api.completeToolbarSession(userMarkSession);
  else if (typeof api.cancelToolbarSession === "function") api.cancelToolbarSession(userMarkSession);
  else {
    userMarkSession.mode = "";
    userMarkSession.interacting = false;
    userMarkSession.pending = null;
    userMarkSession.markId = "";
  }
  hideUserMarkBar();
  if (reason === "complete" || reason === "cancel") clearNativeSelection();
}

function placeUserMarkBar(rect) {
  const bar = userMarkBarEl();
  if (!bar || !rect) return;
  bar.hidden = false;
  const pad = 10;
  const width = bar.offsetWidth || 176;
  const height = bar.offsetHeight || 72;
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.top - height - 12;
  if (top < pad) top = rect.bottom + 12;
  left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
  top = Math.min(Math.max(pad, top), window.innerHeight - height - pad);
  bar.style.left = `${Math.round(left)}px`;
  bar.style.top = `${Math.round(top)}px`;
  if (userMarkSession.pending) userMarkSession.pending.rect = rect;
}

function setUserMarkBarMode(mode) {
  const bar = userMarkBarEl();
  if (!bar) return;
  const start = document.getElementById("userMarkBarStart");
  const colors = document.getElementById("userMarkBarColors");
  const remove = document.getElementById("userMarkBarRemove");
  const cancel = document.getElementById("userMarkBarCancel");
  const title = document.getElementById("userMarkBarTitle");
  if (start) start.hidden = mode !== "create";
  if (colors) colors.hidden = mode !== "colors" && mode !== "edit";
  if (remove) remove.hidden = mode !== "edit";
  if (cancel) cancel.hidden = mode !== "colors";
  if (title) {
    title.hidden = mode !== "edit";
    title.textContent = mode === "edit" ? "改重點" : "畫重點";
  }
}

function closestMarkable(node) {
  const api = userMarkApi();
  if (typeof api.closestMarkableHost === "function") return api.closestMarkableHost(node);
  const el = node && node.nodeType === 1 ? node : node && node.parentElement;
  if (!el || typeof el.closest !== "function") return null;
  if (el.closest("input, textarea, button, [contenteditable='true']")) return null;
  return el.closest("[data-user-mark-field], .js-markable");
}

function readMarkableSelection() {
  const api = userMarkApi();
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const root = closestMarkable(range.commonAncestorContainer);
  if (!root || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const field = String(root.getAttribute("data-user-mark-field") || root.getAttribute("data-mark-field") || "").trim();
  if (!field) return null;
  const date = String(root.getAttribute("data-mark-date") || "");
  const offsets = typeof api.selectionOffsets === "function" ? api.selectionOffsets(root, sel) : null;
  if (!offsets || !String(offsets.text || "").trim()) return null;
  return {
    field,
    date,
    start: offsets.start,
    end: offsets.end,
    text: offsets.text,
    rect: range.getBoundingClientRect(),
  };
}

function coveringUserMark(field, start, end, date) {
  return currentUserMarks(date).find((item) => item.field === field && item.start <= start && item.end >= end) || null;
}

function showUserMarkBarFromPending() {
  const api = userMarkApi();
  const pending = typeof api.pendingMarkPayload === "function" ? api.pendingMarkPayload(userMarkSession) : userMarkSession.pending;
  if (!pending) return;
  const cover = coveringUserMark(pending.field, pending.start, pending.end, pending.date);
  if (cover && userMarkSession.mode !== "colors" && userMarkSession.mode !== "create") {
    userMarkSession.markId = cover.id;
    userMarkSession.mode = "edit";
    setUserMarkBarMode("edit");
  } else if (userMarkSession.mode === "edit") {
    setUserMarkBarMode("edit");
  } else if (userMarkSession.mode === "colors") {
    setUserMarkBarMode("colors");
  } else {
    userMarkSession.markId = "";
    userMarkSession.mode = "create";
    setUserMarkBarMode("create");
  }
  placeUserMarkBar(pending.rect);
}

function syncUserMarkBarFromLiveSelection() {
  const api = userMarkApi();
  if (typeof api.ignoreSelectionChange === "function" && api.ignoreSelectionChange(userMarkSession)) return;
  const payload = readMarkableSelection();
  const action = typeof api.applySelectionChange === "function" ? api.applySelectionChange(userMarkSession, payload) : payload ? "open-create" : "keep";
  if (action === "ignore" || action === "keep") return;
  if (action === "open-create" || action === "open-colors") showUserMarkBarFromPending();
}

function refreshUserMarkSurfaces(date) {
  const draftThink = (thinkV2AnswerEl() || thinkGuideBodyEl()?.querySelector(".think-guide-answer"))?.value || "";
  dismissUserMarkUi("complete");
  if (!date || date === currentIso()) {
    const journal = collectJournal();
    renderBodyCoachCard(state.journalBodyCoach);
    renderInsightCard(state.journalInsight);
    renderThinkSection();
    if (draftThink) {
      const ta = thinkV2AnswerEl() || thinkGuideBodyEl()?.querySelector(".think-guide-answer");
      if (ta) ta.value = draftThink;
    }
    renderAwarenessQuestions(state.awarenessPrompts, { answers: journal.awareness });
    renderAwareQuote(journal.awarenessCheckItems, journal.awarenessChecks);
    renderExecutionQuestions(state.executionPrompts, { answers: journal.execution });
    renderExecChecklist(journal.executionCheckItems, journal.executionChecks);
    renderExecFocus(journal.executionFocus, journal.executionCheckItems);
    renderManifestQuestions(state.manifestPrompts, { answers: journal.manifestThink });
    renderManifestPaths(journal.manifestCheckItems, journal.manifestChecks);
    renderManifestSentence(state.journalManifestSentence);
    renderJournalManifestResult();
    renderDeepThemes(state.deepPrompts, { deep: journal.deep });
  }
  if (state.page === "history") renderHistory();
}

function persistUserMarks(next, date) {
  const bag = { items: normalizeUserMarks(next), updatedAt: new Date().toISOString() };
  const iso = date || currentIso();
  if (!iso || iso === currentIso()) {
    state.journalUserMarks = bag;
    persistJournalQuietly();
  } else {
    const review = getReview(iso) || {};
    const journal = { ...(review.journal && typeof review.journal === "object" ? review.journal : {}), userMarks: bag };
    upsertReview(iso, { journal, updatedAt: new Date().toISOString() });
  }
  rememberUserMarkHint();
  refreshUserMarkSurfaces(iso);
}

function applyUserMarkColor(color) {
  const api = userMarkApi();
  const pending = typeof api.pendingMarkPayload === "function" ? api.pendingMarkPayload(userMarkSession) : null;
  if (!pending || !pending.text) return;
  const current = currentUserMarks(pending.date);
  let next = current;
  if ((pending.mode === "edit" || userMarkSession.mode === "edit") && pending.markId && typeof api.recolorMark === "function") {
    next = api.recolorMark(current, pending.markId, color);
  } else if (typeof api.upsertMark === "function") {
    next = api.upsertMark(current, {
      field: pending.field,
      start: pending.start,
      end: pending.end,
      text: pending.text,
      color,
    });
  }
  persistUserMarks(next, pending.date);
}

function removeCurrentUserMark() {
  const api = userMarkApi();
  const pending = typeof api.pendingMarkPayload === "function" ? api.pendingMarkPayload(userMarkSession) : null;
  const markId = (pending && pending.markId) || userMarkSession.markId;
  if (!markId || typeof api.removeMark !== "function") return;
  const date = (pending && pending.date) || "";
  const next = api.removeMark(currentUserMarks(date), markId);
  persistUserMarks(next, date);
}

function openUserMarkCreate(payload) {
  const api = userMarkApi();
  const snap = typeof api.snapshotSelection === "function" ? api.snapshotSelection(payload) : payload;
  if (!snap) return;
  userMarkSession.pending = snap;
  userMarkSession.interacting = false;
  userMarkSession.mode = "create";
  userMarkSession.markId = "";
  showUserMarkBarFromPending();
}

function openUserMarkEdit(span) {
  const api = userMarkApi();
  const root = closestMarkable(span);
  const id = String(span.getAttribute("data-mark-id") || "");
  if (!root || !id) return;
  const field = String(root.getAttribute("data-user-mark-field") || root.getAttribute("data-mark-field") || "");
  const date = String(root.getAttribute("data-mark-date") || "");
  const mark = currentUserMarks(date).find((item) => item.id === id);
  const payload = {
    field,
    date,
    start: mark ? mark.start : 0,
    end: mark ? mark.end : 0,
    text: mark ? mark.text : span.textContent || "",
    rect: span.getBoundingClientRect(),
    markId: id,
  };
  if (typeof api.enterEditMode === "function") api.enterEditMode(userMarkSession, payload);
  else {
    userMarkSession.pending = payload;
    userMarkSession.markId = id;
    userMarkSession.mode = "edit";
    userMarkSession.interacting = true;
  }
  setUserMarkBarMode("edit");
  placeUserMarkBar(payload.rect);
}

function maybeShowUserMarkBar() {
  const api = userMarkApi();
  if (typeof api.ignoreSelectionChange === "function" && api.ignoreSelectionChange(userMarkSession)) return;
  const payload = readMarkableSelection();
  if (payload) {
    if (typeof api.applySelectionChange === "function") api.applySelectionChange(userMarkSession, payload);
    else openUserMarkCreate(payload);
  }
  if (userMarkSession.pending) showUserMarkBarFromPending();
}

function handleUserMarkToolbarPointer(event) {
  const bar = userMarkBarEl();
  if (!bar || !bar.contains(event.target)) return false;
  event.preventDefault();
  event.stopPropagation();
  const api = userMarkApi();
  if (typeof api.beginToolbarInteract === "function") api.beginToolbarInteract(userMarkSession);
  else userMarkSession.interacting = true;
  const draw = event.target.closest && event.target.closest("#userMarkBarDraw");
  const cancel = event.target.closest && event.target.closest("#userMarkBarCancel");
  const swatch = event.target.closest && event.target.closest("[data-mark-color]");
  const remove = event.target.closest && event.target.closest("#userMarkBarRemove");
  if (draw) {
    if (typeof api.enterColorMode === "function") api.enterColorMode(userMarkSession);
    else userMarkSession.mode = "colors";
    setUserMarkBarMode("colors");
    if (userMarkSession.pending && userMarkSession.pending.rect) placeUserMarkBar(userMarkSession.pending.rect);
    return true;
  }
  if (cancel) {
    dismissUserMarkUi("cancel");
    return true;
  }
  if (swatch) {
    applyUserMarkColor(swatch.getAttribute("data-mark-color"));
    return true;
  }
  if (remove) {
    removeCurrentUserMark();
    return true;
  }
  return true;
}

function bindUserMarkUi() {
  if (bindUserMarkUi.bound) return;
  bindUserMarkUi.bound = true;
  let timer = 0;
  const bar = userMarkBarEl();
  if (bar) {
    const lock = (event) => handleUserMarkToolbarPointer(event);
    if (typeof window !== "undefined" && window.PointerEvent) {
      bar.addEventListener("pointerdown", lock);
    } else {
      bar.addEventListener("mousedown", lock);
      bar.addEventListener("touchstart", lock, { passive: false });
    }
  }
  document.addEventListener("selectionchange", () => {
    const api = userMarkApi();
    if (typeof api.ignoreSelectionChange === "function" && api.ignoreSelectionChange(userMarkSession)) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => syncUserMarkBarFromLiveSelection(), 80);
  });
  const onSelectEnd = (event) => {
    if (userMarkBarEl()?.contains(event.target)) return;
    window.setTimeout(maybeShowUserMarkBar, 0);
  };
  document.addEventListener("mouseup", onSelectEnd);
  document.addEventListener("touchend", onSelectEnd, { passive: true });
  document.addEventListener(
    "contextmenu",
    (event) => {
      const target = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("[data-user-mark-toolbar]")) event.preventDefault();
    },
    true
  );
  document.addEventListener(
    "click",
    (event) => {
      const toolbar = userMarkBarEl();
      if (toolbar && toolbar.contains(event.target)) return;
      const highlight = event.target.closest && event.target.closest(".user-highlight");
      if (highlight && closestMarkable(highlight)) {
        event.preventDefault();
        event.stopPropagation();
        openUserMarkEdit(highlight);
        return;
      }
      if (
        event.target.closest &&
        event.target.closest("[data-user-mark-field]") &&
        event.target.closest("label, summary, .exec-check, .aware-quiz__item, .manifest-path, .deep-item")
      ) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) event.preventDefault();
      }
      if (event.target.closest && event.target.closest("[data-journal-fold], [data-history-section], [data-history-open], [data-history-back]")) {
        dismissUserMarkUi("cancel");
      }
    },
    true
  );
  window.addEventListener(
    "scroll",
    () => {
      if (userMarkSession.interacting) return;
      if (userMarkSession.mode && userMarkSession.pending && userMarkSession.pending.rect) {
        placeUserMarkBar(userMarkSession.pending.rect);
      }
    },
    true
  );
  window.addEventListener("resize", () => {
    if (userMarkSession.interacting) return;
    if (userMarkSession.mode && userMarkSession.pending && userMarkSession.pending.rect) {
      placeUserMarkBar(userMarkSession.pending.rect);
    }
  });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    try {
      const target = event.target?.closest ? event.target : event.target?.parentElement;
      if (!target?.closest) return;
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
      if (target.closest("[data-plus-upgrade]")) {
        event.preventDefault();
        openPlusUpgradeModal();
        return;
      }
      if (target.closest("#btnNewebPay") || target.closest(".auth-pay:not(:disabled)") || target.closest("[data-open-pricing]")) {
        console.log("Pricing modal opened");
        event.preventDefault();
        openPricingModal();
        return;
      }
      handleTodayPointerClick(event);
    } catch (error) {
      console.error(error);
      if (isPlusRequiredError(error)) return;
      const text = formatApiError(error);
      if (text) showToast(text);
    }
  });

  const toggle = navToggleEl();
  if (toggle) toggle.addEventListener("click", toggleMenu);
  bindJournalFoldEditGuards();
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
  document.getElementById("pricingFreeCta")?.addEventListener("click", (event) => {
    event.preventDefault();
    closePricingModal();
  });
  document.getElementById("plusUpgradeForm")?.addEventListener("submit", (event) => {
    const action = event.submitter && event.submitter.id === "plusUpgradeView" ? "plus" : "later";
    closePlusUpgradeModal();
    if (action === "plus") {
      event.preventDefault();
      openPricingModal();
    }
  });
  document.getElementById("plusEndedForm")?.addEventListener("submit", (event) => {
    const action = event.submitter && event.submitter.id === "plusEndedViewPlus" ? "plus" : "continue";
    dismissPlusEndedNotice();
    closePlusEndedModal();
    if (action === "plus") {
      event.preventDefault();
      openPricingModal();
    }
  });
  document.getElementById("plusEndedModal")?.addEventListener("close", () => {
    dismissPlusEndedNotice();
  });

  const promptChips = document.getElementById("promptChips");
  if (promptChips) {
    promptChips.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-prompt]");
      if (chip) insertPrompt(chip.dataset.prompt);
    });
  }

  document.getElementById("reviewDate")?.addEventListener("change", () => {
    flushJournalAutosave();
    const iso = currentIso();
    loadReviewForDate(iso);
    updateStats();
    if (!state.user) return;
    pullCloudData({ quiet: true, skipViews: true })
      .then((cloud) => {
        if (!cloud) return;
        if (!isActivelyEditingJournal() || isCurrentJournalArchived()) loadReviewForDate(iso);
        renderHistory();
        updateStats();
      })
      .catch((error) => {
        console.error("[進行式 ING] 切換日期後同步失敗", error && error.message ? error.message : error);
      });
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
  document.getElementById("btnInternalResetToday")?.addEventListener("click", () => {
    if (!isInternalMembership() || !isCurrentJournalArchived()) return;
    openInternalResetModal();
  });
  document.getElementById("btnConfirmInternalReset")?.addEventListener("click", (event) => {
    event.preventDefault();
    confirmInternalResetToday();
  });
  document.getElementById("btnCompleteToday")?.addEventListener("click", () => {
    catchAsync(() => completeToday(), "完成今日復盤時發生問題");
  });
  document.getElementById("btnConfirmComplete")?.addEventListener("click", () => {
    confirmCompleteToday();
  });
  document.getElementById("completeRatingStars")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-history-rating]");
    if (!btn) return;
    setPendingHistoryRating(btn.dataset.historyRating);
  });
  document.getElementById("completeConfirmForm")?.addEventListener("submit", () => {
    closeCompleteConfirmModal();
  });
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
    if (!btn || isCurrentJournalArchived()) return;
    const on = !btn.classList.contains("is-on");
    document.querySelectorAll("#moodRow .mood-btn").forEach((item) => item.classList.toggle("is-on", on && item === btn));
    refreshJournalChecklists();
    const journal = collectJournal();
    persistJournalNow();
    syncCorePromptGate();
    maybeAutoGenerateInsight(journal);
    maybeAutoGeneratePrompts(journal);
    maybeAutoGenerateCorePrompts(journal);
  });

  document.getElementById("btnBodyMindInsight")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isCurrentJournalArchived() || state.bodyMindBusy) return;
    generateBodyMindInsight({ confirmed: true });
  });
  document.getElementById("bodyMindText")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.stopPropagation();
  });

  document.getElementById("section-body")?.addEventListener("click", (event) => {
    if (isCurrentJournalArchived()) return;
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
    persistJournalNow();
    refreshJournalChecklists();
    const journal = collectJournal();
    maybeAutoGenerateInsight(journal);
    maybeAutoGenerateBodyCoach(journal);
    maybeAutoGeneratePrompts(journal);
    maybeAutoGenerateCorePrompts(journal);
  });

  document.getElementById("page-today")?.addEventListener("input", (event) => {
    if (isCurrentJournalArchived()) return;
    const target = event.target;
    const id = target && target.id;
    if (isJournalAutosaveField(target) || /^thanksText$|^thanks\d+$|^(aware|exec)\d$|^execNext$|^execFollowup$|^eventText$|^bodyNote$|^bodyOtherNote$|^bodyMoodReason$|^bodyBodyReason$|^bodySleepReason$|^manifestVision$|^manifestThink\d$/.test(id || "")) {
      if (id === "execNext" && usesExecutionChoiceUi()) {
        const bag = normalizeExecutionChoiceBag(state.executionChoices);
        if (bag.selectedIds.includes(execChoiceCustomId())) {
          bag.custom = journalFieldValue("execNext");
          state.executionChoices = serializeExecutionChoiceBag(bag);
          if (bag.custom) syncSelectedExecutionToSidebar(state.executionChoices);
          syncExecStepUi();
        }
      }
      if (isJournalAutosaveField(target)) scheduleJournalAutosave();
      if (id === "thinkExtAnswer") syncThinkExtAnswerChrome();
      if (id === "thinkUnderstandAnswer") flushUnderstandAnswer();
      if (id === "bodyMindText") syncBodyMindCta();
      if (usesReflectionV3Path()) syncThinkV3Cta();
      if (usesAwarenessV3Path()) syncAwareV3Cta();
      if (usesExecutionV3Path()) syncExecV3Cta();
      scheduleJournalChecklists();
    }
  });

  document.getElementById("page-today")?.addEventListener("change", (event) => {
    if (isCurrentJournalArchived()) return;
    const extQuestion = event.target && event.target.closest && event.target.closest("input[data-extension-question]");
    if (extQuestion) {
      selectThinkExtensionQuestion(String(extQuestion.value || "").trim());
      return;
    }
    if (event.target && event.target.matches(".manifest-step__check")) {
      toggleManifestPlanStep(event.target.dataset.manifestStep, event.target.checked);
      return;
    }
    if (event.target && event.target.matches("#awareChecks input, #execChecks input, #manifestChecks input")) {
      const execInput = event.target.matches("#execChecks input") ? event.target : null;
      const execPayload = execInput
        ? {
            checked: execInput.checked,
            title: String(execInput.value || execInput.closest(".exec-check")?.dataset.title || "").trim(),
            detail: String(execInput.closest(".exec-check")?.dataset.detail || "").trim(),
          }
        : null;
      persistJournalNow();
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
    handleTodayPointerClick(event);
  });

  document.getElementById("aiStage")?.addEventListener("click", (event) => {
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
      catchAsync(() => completeToday(), "完成今日復盤時發生問題");
    }
  });

  document.getElementById("aiStage")?.addEventListener("change", (event) => {
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

  document.getElementById("aiStage")?.addEventListener("input", (event) => {
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
      if (window.NichiAnalytics) {
        window.NichiAnalytics.trackOnceSession(
          state.reportType === "month" ? "monthly_report_viewed" : "weekly_report_viewed",
          { type: state.reportType === "month" ? "month" : "week", source: "tab" },
          `report:${state.reportType}`
        );
      }
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
  document.getElementById("taskAddToggle")?.addEventListener("click", () => {
    const form = document.getElementById("taskForm");
    setTaskAddOpen(Boolean(form?.hidden));
  });
  document.getElementById("taskAddCancel")?.addEventListener("click", () => setTaskAddOpen(false));
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
      if (to !== "done") showToast(statusMoveToast(to));
      return;
    }
    const focusBtn = event.target.closest("[data-task-focus]");
    if (focusBtn) {
      event.preventDefault();
      toggleTaskTodayFocus(focusBtn.dataset.taskFocus);
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
    document.querySelectorAll("#insightFilters .lib-tab").forEach((item) => item.classList.toggle("is-on", item === chip));
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

  document.getElementById("historySearch")?.addEventListener("input", (event) => {
    state.historyQuery = event.target.value;
    renderHistory();
  });
  document.getElementById("historyTags")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-tag]");
    if (!chip) return;
    state.historyTag = chip.dataset.tag;
    document.querySelectorAll("#historyTags .chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    renderHistory();
  });
  document.getElementById("historyList")?.addEventListener("click", (event) => {
    const openDay = event.target.closest("[data-history-open]");
    if (openDay) {
      event.preventDefault();
      openHistoryDetail(openDay.dataset.historyOpen);
      return;
    }
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
      const iso = card.dataset.historySectionDate || state.historyOpen || state.historyDetailDate;
      const sectionId = card.dataset.historySectionId;
      setHistorySectionOpen(iso, sectionId, next);
    }
  });
  document.getElementById("page-history")?.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!details || details.tagName !== "DETAILS" || !details.classList.contains("history-archive")) return;
    const iso = details.getAttribute("data-history-archive") || state.historyDetailDate;
    if (!iso) return;
    setHistorySectionOpen(iso, "archive", details.open);
  }, true);
  document.getElementById("page-history")?.addEventListener("click", (event) => {
    const saveBtn = event.target.closest("[data-history-important]");
    if (saveBtn) {
      event.preventDefault();
      event.stopPropagation();
      toggleHistoryImportant(saveBtn.getAttribute("data-history-important"));
      return;
    }
    const back = event.target.closest("[data-history-back]");
    if (!back) return;
    event.preventDefault();
    backToHistoryList();
  });
  window.addEventListener("popstate", applyAppLocation);
  window.addEventListener("hashchange", applyAppLocation);

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

  document.getElementById("reminderCta")?.addEventListener("click", () => {
    document.getElementById("reminderModal").showModal();
  });
  document.getElementById("reminderForm")?.addEventListener("submit", (event) => {
    const enable = event.submitter && event.submitter.id === "enableReminder";
    saveReminder(Boolean(enable));
  });


  window.addEventListener("resize", () => {
    if (!isMobile()) setSidebarOpen(false);
  });
  bindUserMarkUi();
}

function splashMotionReduced() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const SPLASH_MIN_DURATION = 2000;

function splashLeaveMs() {
  return splashMotionReduced() ? 120 : 300;
}

function splashHoldMs() {
  return SPLASH_MIN_DURATION;
}

function waitForAppPaint() {
  return new Promise((resolve) => {
    const tick =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn) => window.setTimeout(fn, 16);
    tick(() => tick(resolve));
  });
}

function clearBootingChrome() {
  document.documentElement.classList.remove("is-booting");
  if (document.body) document.body.classList.remove("is-booting");
}

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) {
    clearBootingChrome();
    return;
  }
  if (splash.dataset.leaving === "1") return;
  splash.dataset.leaving = "1";

  const beginLeave = () => {
    if (!splash.isConnected) {
      clearBootingChrome();
      return;
    }
    splash.classList.add("is-leaving");
    splash.setAttribute("aria-hidden", "true");
    const leaveMs = splashLeaveMs();
    const finish = () => {
      if (splash.parentNode) splash.remove();
    };
    splash.addEventListener("animationend", (event) => {
      if (event.target === splash) finish();
    });
    window.setTimeout(finish, leaveMs + 80);
  };

  clearBootingChrome();
  waitForAppPaint().then(beginLeave);
}

function tryDismissSplash() {
  if (state.splashDismissed) return;
  const elapsed = Date.now() - (state.splashStartedAt || Date.now());
  if (elapsed < splashHoldMs()) return;
  if (!state.splashGateReady) return;
  state.splashDismissed = true;
  dismissSplash();
}

function markSplashGateReady() {
  state.splashGateReady = true;
  tryDismissSplash();
}

function initSplash() {
  const splash = document.getElementById("splash");
  document.documentElement.classList.add("is-booting");
  if (document.body) document.body.classList.add("is-booting");
  if (!splash) {
    state.splashGateReady = true;
    clearBootingChrome();
    return;
  }
  state.splashStartedAt = Date.now();
  window.setTimeout(tryDismissSplash, splashHoldMs());
}

function init() {
  try {
    initSplash();
  } catch (error) {
    console.error(error);
  }
  try {
    applyDevPlanOverrideToState();
    applyAccessLock();
  } catch (error) {
    console.error(error);
  }
  try {
    bindEvents();
  } catch (error) {
    console.error(error);
    document.addEventListener("click", handleTodayPointerClick);
    const btn = document.getElementById("btnOrganize");
    if (btn) btn.onclick = runOrganize;
  }
  try {
    const headerDate = document.getElementById("headerDate");
    if (headerDate) headerDate.textContent = formatHeaderDate(new Date());
    const reviewDate = document.getElementById("reviewDate");
    if (reviewDate) reviewDate.value = toInputDate(new Date());
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
    if (!hasStoredAuthSession()) {
      loadReviewForDate(currentIso());
      markSplashGateReady();
    } else {
      setSyncStatus("pulling");
    }
    backfillLibrariesFromReviews();
    updateStats();
    initReminder();
    setInterval(tickReminder, 20000);
    probeReviewApi();
    applyDevPlanOverrideToState();
    applyAccessLock();
    bindCloudLiveSync();
    refreshAuth().finally(() => markSplashGateReady());
    handleAuthQuery();
    applyAppLocation();
    setInterval(() => {
      if (state.user) applyAccessLock();
    }, 30000);
  } catch {
    markSplashGateReady();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
