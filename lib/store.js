const { loadSupabaseUserData, saveSupabaseUserData, listSupabaseUsers } = require("./supabase");

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet(key) {
  if (!kvConfigured()) return null;
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
}

async function kvSet(key, value) {
  if (!kvConfigured()) return false;
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

function cleanReports(reports) {
  const next = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  delete next.__insights;
  return next;
}

function readInsights(bundleLike, reports) {
  if (Array.isArray(bundleLike && bundleLike.insights)) return bundleLike.insights;
  if (reports && Array.isArray(reports.__insights)) return reports.__insights;
  return [];
}

async function loadUserData(userId) {
  const id = assertUserId(userId);
  const fromSb = await loadSupabaseUserData(id);
  const [reviews, tasks, sfm, reports, insights] = await Promise.all([
    kvGet(userKey(id, "reviews")),
    kvGet(userKey(id, "tasks")),
    kvGet(userKey(id, "sfm")),
    kvGet(userKey(id, "reports")),
    kvGet(userKey(id, "insights")),
  ]);
  const kvReports = cleanReports(reports);
  const kvBundle = {
    userId: id,
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    insights: Array.isArray(insights) && insights.length ? insights : readInsights(null, reports),
    reports: kvReports,
  };
  if (!fromSb) return kvBundle;
  const hasSb =
    Object.keys(fromSb.reviews || {}).length ||
    (fromSb.tasks || []).length ||
    (fromSb.sfm || []).length ||
    (fromSb.insights || []).length ||
    Object.keys(fromSb.reports || {}).length;
  if (!hasSb) return kvBundle;
  return {
    ...fromSb,
    insights: (fromSb.insights && fromSb.insights.length) ? fromSb.insights : kvBundle.insights,
  };
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

async function saveUserData(userId, bundle) {
  const id = assertUserId(userId);
  const reviews = bundle.reviews && typeof bundle.reviews === "object" && !Array.isArray(bundle.reviews) ? bundle.reviews : {};
  const tasks = Array.isArray(bundle.tasks) ? bundle.tasks.map((item) => ({ ...item, userId: id })) : [];
  const sfm = Array.isArray(bundle.sfm) ? bundle.sfm.map((item) => ({ ...item, userId: id })) : [];
  const reports = cleanReports(bundle.reports);
  const insights = Array.isArray(bundle.insights)
    ? bundle.insights.map((item) => ({ ...item, userId: id }))
    : readInsights(bundle, bundle.reports);
  await Promise.all([
    kvSet(userKey(id, "reviews"), reviews),
    kvSet(userKey(id, "tasks"), tasks),
    kvSet(userKey(id, "sfm"), sfm),
    kvSet(userKey(id, "insights"), insights),
    kvSet(userKey(id, "reports"), reports),
  ]);
  await saveSupabaseUserData(id, { reviews, tasks, sfm, insights, reports }, { email: bundle.email || "" });
  return { userId: id, reviews, tasks, sfm, insights, reports };
}

module.exports = {
  kvConfigured,
  listUsers,
  registerUser,
  loadReviews,
  saveReviews,
  mergeReviews,
  loadReport,
  loadLatestReport,
  saveReport,
  loadUserData,
  saveUserData,
  saveOrder,
  loadOrder,
  loadMembership,
  saveMembership,
};
