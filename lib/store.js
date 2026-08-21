const { loadSupabaseUserData, saveSupabaseUserData, listSupabaseUsers, supabaseConfigured } = require("./supabase");

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function cloudStoreConfigured() {
  return kvConfigured() || supabaseConfigured();
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
    journal.aware,
    journal.exec,
    journal.smallestStep,
    journal.manifest,
    journal.manifestSentence,
    journal.deep ? JSON.stringify(journal.deep) : "",
    journal.awareness ? JSON.stringify(journal.awareness) : "",
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

function pickReview(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  const scoreL = reviewContentScore(left);
  const scoreR = reviewContentScore(right);
  const emptyL = scoreL < 10 && !left.completedAt;
  const emptyR = scoreR < 10 && !right.completedAt;
  if (emptyL && !emptyR) return right;
  if (emptyR && !emptyL) return left;
  if (left.completedAt && !right.completedAt && scoreL + 20 >= scoreR) return left;
  if (right.completedAt && !left.completedAt && scoreR + 20 >= scoreL) return right;
  if (scoreL > 40 && scoreR < 20) return left;
  if (scoreR > 40 && scoreL < 20) return right;
  if (Math.abs(scoreL - scoreR) > 40) return scoreL >= scoreR ? left : right;
  return newerStamp(left, right) ? left : right;
}

function mergeReviewMaps(left, right) {
  const next = {};
  const dates = new Set([
    ...Object.keys(left && typeof left === "object" && !Array.isArray(left) ? left : {}),
    ...Object.keys(right && typeof right === "object" && !Array.isArray(right) ? right : {}),
  ]);
  dates.forEach((iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const picked = pickReview(left && left[iso], right && right[iso]);
    if (picked && typeof picked === "object") next[iso] = picked;
  });
  return next;
}

function mergeById(left, right) {
  const map = new Map();
  [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].forEach((item) => {
    if (!item || !item.id) return;
    const current = map.get(item.id);
    if (!current || newerStamp(item, current)) map.set(item.id, item);
  });
  return [...map.values()];
}

function mergeReports(left, right) {
  const next = { ...(left && typeof left === "object" && !Array.isArray(left) ? left : {}) };
  Object.entries(right && typeof right === "object" && !Array.isArray(right) ? right : {}).forEach(([key, value]) => {
    if (!key || key.startsWith("__") || !value || typeof value !== "object") return;
    const current = next[key];
    if (!current || newerStamp(value, current)) next[key] = value;
  });
  delete next.__insights;
  delete next.__manifests;
  return next;
}

function mergeUserBundles(left, right) {
  const a = left && typeof left === "object" ? left : {};
  const b = right && typeof right === "object" ? right : {};
  return {
    userId: b.userId || a.userId || "",
    reviews: mergeReviewMaps(a.reviews, b.reviews),
    tasks: mergeById(a.tasks, b.tasks),
    sfm: mergeById(a.sfm, b.sfm),
    insights: mergeById(a.insights, b.insights),
    manifests: mergeById(a.manifests, b.manifests),
    reports: mergeReports(a.reports, b.reports),
  };
}

function stampBundleUser(userId, bundle) {
  const id = assertUserId(userId);
  const reviews = {};
  Object.entries(bundle.reviews || {}).forEach(([iso, review]) => {
    if (!review || typeof review !== "object") return;
    reviews[iso] = { ...review, date: iso, userId: id };
  });
  const tag = (item) => (item && typeof item === "object" ? { ...item, userId: id } : item);
  return {
    userId: id,
    reviews,
    tasks: (Array.isArray(bundle.tasks) ? bundle.tasks : []).map(tag),
    sfm: (Array.isArray(bundle.sfm) ? bundle.sfm : []).map(tag),
    insights: (Array.isArray(bundle.insights) ? bundle.insights : []).map(tag),
    manifests: (Array.isArray(bundle.manifests) ? bundle.manifests : []).map(tag),
    reports: cleanReports(bundle.reports),
  };
}

async function kvGet(key) {
  if (!kvConfigured()) return null;
  try {
    const response = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
    const data = await response.json().catch(() => ({}));
    if (data.result == null) return null;
    if (typeof data.result === "string") {
      try {
        return JSON.parse(data.result);
      } catch {
        return data.result;
      }
    }
    return data.result;
  } catch (error) {
    console.warn("kvGet failed", error && error.message ? error.message : error);
    return null;
  }
}

async function kvSet(key, value) {
  if (!kvConfigured()) return false;
  try {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    const response = await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.warn("kvSet failed", error && error.message ? error.message : error);
    return false;
  }
}

function assertUserId(userId) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("缺少 user_id");
  return id;
}

function userKey(userId, name) {
  return `nichi:user:${assertUserId(userId)}:${name}`;
}

const USERS_KEY = "nichi:users";

async function listUsers() {
  const fromSb = await listSupabaseUsers();
  const stored = await kvGet(USERS_KEY);
  const fromKv = Array.isArray(stored) ? stored.filter((item) => item && item.id) : [];
  const map = new Map();
  [...fromKv, ...fromSb].forEach((item) => {
    if (item && item.id) map.set(String(item.id), { id: String(item.id), email: item.email || "", name: item.name || "" });
  });
  return [...map.values()];
}

async function registerUser(user) {
  if (!user || !user.id) return false;
  const current = await listUsers();
  const next = current.filter((item) => item.id !== user.id);
  next.push({
    id: String(user.id),
    email: user.email || "",
    name: user.name || "",
    updatedAt: new Date().toISOString(),
  });
  return kvSet(USERS_KEY, next);
}

async function loadReviews(userId) {
  const id = assertUserId(userId);
  const fromSb = await loadSupabaseUserData(id);
  if (fromSb && fromSb.reviews && Object.keys(fromSb.reviews).length) return fromSb.reviews;
  const stored = await kvGet(userKey(id, "reviews"));
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : fromSb ? fromSb.reviews : {};
}

async function saveReviews(userId, reviews) {
  return kvSet(userKey(userId, "reviews"), reviews && typeof reviews === "object" ? reviews : {});
}

async function mergeReviews(userId, incoming) {
  const current = await loadReviews(userId);
  const next = { ...current };
  Object.entries(incoming || {}).forEach(([iso, review]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !review || typeof review !== "object") return;
    next[iso] = { ...(current[iso] || {}), ...review, date: iso, userId: assertUserId(userId) };
  });
  await saveReviews(userId, next);
  return next;
}

function reportKey(userId, type, period) {
  return userKey(userId, `report:${type}:${period}`);
}

function latestKey(userId, type) {
  return userKey(userId, `report:${type}:latest`);
}

async function loadReport(userId, type, period) {
  return kvGet(reportKey(userId, type, period));
}

async function loadLatestReport(userId, type) {
  return kvGet(latestKey(userId, type));
}

async function saveReport(userId, type, period, report) {
  const payload = report && typeof report === "object" ? { ...report, period, type, userId: assertUserId(userId) } : report;
  const ok = await kvSet(reportKey(userId, type, period), payload);
  await kvSet(latestKey(userId, type), payload);
  return ok;
}

function reportIndexKey(userId) {
  return userKey(userId, "report-index");
}

function reportMeta(report) {
  const item = report && typeof report === "object" ? report : {};
  return {
    type: item.type === "week" ? "week" : "month",
    period: String(item.period || ""),
    title: String(item.title || ""),
    generatedAt: String(item.generatedAt || ""),
    fromIso: String(item.fromIso || ""),
    toIso: String(item.toIso || ""),
    archived: Boolean(item.archived),
  };
}

async function loadReportIndex(userId) {
  const stored = await kvGet(reportIndexKey(userId));
  return Array.isArray(stored) ? stored.filter((item) => item && item.period) : [];
}

async function listArchivedReports(userId) {
  const id = assertUserId(userId);
  const [index, bundle] = await Promise.all([loadReportIndex(id), loadUserData(id)]);
  const map = new Map();
  const push = (item) => {
    if (!item || !item.period) return;
    const key = `${item.type === "week" ? "week" : "month"}:${item.period}`;
    const current = map.get(key);
    if (!current || String(item.generatedAt || "") >= String(current.generatedAt || "")) {
      map.set(key, {
        type: item.type === "week" ? "week" : "month",
        period: String(item.period),
        title: String(item.title || ""),
        generatedAt: String(item.generatedAt || ""),
        fromIso: String(item.fromIso || ""),
        toIso: String(item.toIso || ""),
        archived: Boolean(item.archived),
      });
    }
  };
  index.forEach(push);
  Object.entries(bundle && bundle.reports ? bundle.reports : {}).forEach(([key, value]) => {
    if (!/^(week|month):/.test(key) || !value || typeof value !== "object") return;
    push({
      type: value.type || key.split(":")[0],
      period: value.period || key.slice(key.indexOf(":") + 1),
      title: value.title,
      generatedAt: value.generatedAt,
      fromIso: value.fromIso,
      toIso: value.toIso,
      archived: value.archived,
    });
  });
  return [...map.values()].sort((left, right) => String(right.period).localeCompare(String(left.period)));
}

async function archiveUserReport(userId, report) {
  const id = assertUserId(userId);
  const payload = report && typeof report === "object" ? { ...report, archived: report.archived !== false, userId: id } : report;
  await saveReport(id, payload.type === "week" ? "week" : "month", payload.period, payload);
  const index = await loadReportIndex(id);
  const meta = reportMeta(payload);
  const next = [meta, ...index.filter((item) => !(item.type === meta.type && item.period === meta.period))].slice(0, 36);
  await kvSet(reportIndexKey(id), next);
  try {
    const bundle = await loadUserData(id);
    const reports = { ...(bundle.reports || {}) };
    reports[`${meta.type}:${meta.period}`] = payload;
    await saveUserData(id, { ...bundle, reports });
  } catch (error) {
    console.warn("archiveUserReport nest:", error && error.message ? error.message : error);
  }
  return payload;
}

function cleanReports(reports) {
  const next = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  delete next.__insights;
  delete next.__manifests;
  return next;
}

function readInsights(bundleLike, reports) {
  if (Array.isArray(bundleLike && bundleLike.insights)) return bundleLike.insights;
  if (reports && Array.isArray(reports.__insights)) return reports.__insights;
  return [];
}

function readManifests(bundleLike, reports) {
  if (Array.isArray(bundleLike && bundleLike.manifests)) return bundleLike.manifests;
  if (reports && Array.isArray(reports.__manifests)) return reports.__manifests;
  return [];
}

async function loadUserData(userId, extra = {}) {
  const id = assertUserId(userId);
  let fromSb = null;
  try {
    fromSb = await loadSupabaseUserData(id, extra);
  } catch (error) {
    console.warn("loadSupabaseUserData failed", error && error.message ? error.message : error);
  }
  let kvParts = [{}, [], [], {}, [], []];
  try {
    kvParts = await Promise.all([
      kvGet(userKey(id, "reviews")),
      kvGet(userKey(id, "tasks")),
      kvGet(userKey(id, "sfm")),
      kvGet(userKey(id, "reports")),
      kvGet(userKey(id, "insights")),
      kvGet(userKey(id, "manifests")),
    ]);
  } catch (error) {
    console.warn("loadUserData kv failed", error && error.message ? error.message : error);
  }
  const [reviews, tasks, sfm, reports, insights, manifests] = kvParts;
  const kvReports = cleanReports(reports);
  const kvBundle = {
    userId: id,
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    insights: Array.isArray(insights) && insights.length ? insights : readInsights(null, reports),
    manifests: Array.isArray(manifests) && manifests.length ? manifests : readManifests(null, reports),
    reports: kvReports,
  };
  if (!fromSb) return kvBundle;
  return stampBundleUser(id, mergeUserBundles(kvBundle, fromSb));
}

function orderKey(orderNo) {
  return `nichi:order:${String(orderNo || "").trim()}`;
}

function membershipKey(userId) {
  return userKey(userId, "membership");
}

async function saveOrder(order) {
  if (!order || !order.orderNo) return false;
  return kvSet(orderKey(order.orderNo), order);
}

async function loadOrder(orderNo) {
  if (!orderNo) return null;
  return kvGet(orderKey(orderNo));
}

async function loadMembership(userId) {
  return kvGet(membershipKey(userId));
}

async function saveMembership(userId, membership) {
  return kvSet(membershipKey(userId), membership && typeof membership === "object" ? membership : {});
}

async function saveUserData(userId, bundle, extra = {}) {
  const id = assertUserId(userId);
  const incoming = {
    userId: id,
    reviews: bundle.reviews && typeof bundle.reviews === "object" && !Array.isArray(bundle.reviews) ? bundle.reviews : {},
    tasks: Array.isArray(bundle.tasks) ? bundle.tasks : [],
    sfm: Array.isArray(bundle.sfm) ? bundle.sfm : [],
    insights: Array.isArray(bundle.insights) ? bundle.insights : readInsights(bundle, bundle.reports),
    manifests: Array.isArray(bundle.manifests) ? bundle.manifests : readManifests(bundle, bundle.reports),
    reports: cleanReports(bundle.reports),
  };
  let existing = { userId: id, reviews: {}, tasks: [], sfm: [], insights: [], manifests: [], reports: {} };
  try {
    existing = await loadUserData(id, extra);
  } catch (error) {
    console.warn("saveUserData load existing failed", error && error.message ? error.message : error);
  }
  const merged = stampBundleUser(id, mergeUserBundles(existing, incoming));
  await Promise.all([
    kvSet(userKey(id, "reviews"), merged.reviews),
    kvSet(userKey(id, "tasks"), merged.tasks),
    kvSet(userKey(id, "sfm"), merged.sfm),
    kvSet(userKey(id, "insights"), merged.insights),
    kvSet(userKey(id, "manifests"), merged.manifests),
    kvSet(userKey(id, "reports"), merged.reports),
  ]).catch((error) => {
    console.warn("saveUserData kv failed", error && error.message ? error.message : error);
  });
  if (supabaseConfigured()) {
    const saved = await saveSupabaseUserData(id, merged, {
      email: bundle.email || extra.email || "",
      userToken: extra.userToken,
    });
    if (!saved || saved.ok === false) {
      const reason = (saved && saved.error) || "無法寫入雲端資料庫";
      console.error("saveUserData supabase failed", {
        userId: id,
        reason,
        status: saved && saved.status,
        via: saved && saved.via,
      });
      if (kvConfigured()) {
        console.warn("saveUserData kept KV copy after Supabase failure");
        return { ...merged, updatedAt: new Date().toISOString(), degraded: true };
      }
      throw new Error(reason);
    }
  } else if (!kvConfigured()) {
    throw new Error("尚未設定雲端儲存");
  }
  return { ...merged, updatedAt: new Date().toISOString() };
}

module.exports = {
  kvConfigured,
  cloudStoreConfigured,
  listUsers,
  registerUser,
  loadReviews,
  saveReviews,
  mergeReviews,
  loadReport,
  loadLatestReport,
  saveReport,
  loadReportIndex,
  listArchivedReports,
  archiveUserReport,
  loadUserData,
  saveUserData,
  saveOrder,
  loadOrder,
  loadMembership,
  saveMembership,
};
