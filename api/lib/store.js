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

const REVIEWS_KEY = "nichi:reviews";

function reportKey(type, period) {
  return `nichi:report:${type}:${period}`;
}

async function loadReviews() {
  const stored = await kvGet(REVIEWS_KEY);
  return stored && typeof stored === "object" ? stored : {};
}

async function saveReviews(reviews) {
  return kvSet(REVIEWS_KEY, reviews && typeof reviews === "object" ? reviews : {});
}

async function mergeReviews(incoming) {
  const current = await loadReviews();
  const next = { ...current };
  Object.entries(incoming || {}).forEach(([iso, review]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !review || typeof review !== "object") return;
    next[iso] = { ...(current[iso] || {}), ...review, date: iso };
  });
  await saveReviews(next);
  return next;
}

function latestKey(type) {
  return `nichi:report:${type}:latest`;
}

async function loadReport(type, period) {
  return kvGet(reportKey(type, period));
}

async function loadLatestReport(type) {
  return kvGet(latestKey(type));
}

async function saveReport(type, period, report) {
  const payload = report && typeof report === "object" ? { ...report, period, type } : report;
  const ok = await kvSet(reportKey(type, period), payload);
  await kvSet(latestKey(type), payload);
  return ok;
}

module.exports = {
  kvConfigured,
  loadReviews,
  mergeReviews,
  loadReport,
  loadLatestReport,
  saveReport,
};
