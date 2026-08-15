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
  const stored = await kvGet(USERS_KEY);
  return Array.isArray(stored) ? stored.filter((item) => item && item.id) : [];
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
  const stored = await kvGet(userKey(userId, "reviews"));
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
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

async function loadUserData(userId) {
  const id = assertUserId(userId);
  const [reviews, tasks, sfm, reports] = await Promise.all([
    kvGet(userKey(id, "reviews")),
    kvGet(userKey(id, "tasks")),
    kvGet(userKey(id, "sfm")),
    kvGet(userKey(id, "reports")),
  ]);
  return {
    userId: id,
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    reports: reports && typeof reports === "object" && !Array.isArray(reports) ? reports : {},
  };
}

async function saveUserData(userId, bundle) {
  const id = assertUserId(userId);
  const reviews = bundle.reviews && typeof bundle.reviews === "object" && !Array.isArray(bundle.reviews) ? bundle.reviews : {};
  const tasks = Array.isArray(bundle.tasks) ? bundle.tasks.map((item) => ({ ...item, userId: id })) : [];
  const sfm = Array.isArray(bundle.sfm) ? bundle.sfm.map((item) => ({ ...item, userId: id })) : [];
  const reports = bundle.reports && typeof bundle.reports === "object" && !Array.isArray(bundle.reports) ? bundle.reports : {};
  await Promise.all([
    kvSet(userKey(id, "reviews"), reviews),
    kvSet(userKey(id, "tasks"), tasks),
    kvSet(userKey(id, "sfm"), sfm),
    kvSet(userKey(id, "reports"), reports),
  ]);
  return { userId: id, reviews, tasks, sfm, reports };
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
};
