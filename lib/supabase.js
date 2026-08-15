const TABLE = "nichi_user_data";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

function supabaseAnonKey() {
  return String(process.env.SUPABASE_ANON_KEY || "").trim();
}

function supabaseServiceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

function restKey() {
  return supabaseServiceKey() || supabaseAnonKey();
}

async function getUserFromAccessToken(token) {
  const access = String(token || "").trim();
  if (!access || !supabaseConfigured()) return null;
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${access}`,
      apikey: supabaseAnonKey(),
    },
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data || !data.id) return null;
  const meta = data.user_metadata && typeof data.user_metadata === "object" ? data.user_metadata : {};
  return {
    id: String(data.id),
    email: String(data.email || meta.email || "").trim(),
    name: String(meta.name || meta.full_name || data.email || "").trim(),
    picture: String(meta.avatar_url || meta.picture || "").trim(),
  };
}

async function supabaseRest(path, options = {}) {
  const key = restKey();
  if (!supabaseUrl() || !key) return { ok: false, status: 0, data: null };
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.userToken || key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: response.ok, status: response.status, data };
}

function emptyBundle(userId) {
  return {
    userId,
    reviews: {},
    tasks: [],
    sfm: [],
    reports: {},
  };
}

function rowToBundle(row, userId) {
  if (!row || typeof row !== "object") return emptyBundle(userId);
  const nested = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : null;
  const reviews = row.reviews || (nested && nested.reviews) || {};
  const tasks = row.tasks || (nested && nested.tasks) || [];
  const sfm = row.sfm || (nested && nested.sfm) || [];
  const reports = row.reports || (nested && nested.reports) || {};
  return {
    userId,
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    reports: reports && typeof reports === "object" && !Array.isArray(reports) ? reports : {},
  };
}

async function loadSupabaseUserData(userId) {
  const id = String(userId || "").trim();
  if (!id || !supabaseConfigured()) return null;
  const { ok, data } = await supabaseRest(`${TABLE}?user_id=eq.${encodeURIComponent(id)}&select=*`);
  if (!ok) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return emptyBundle(id);
  return rowToBundle(row, id);
}

async function saveSupabaseUserData(userId, bundle, extra = {}) {
  const id = String(userId || "").trim();
  if (!id || !supabaseConfigured() || !restKey()) return false;
  const payload = {
    user_id: id,
    email: extra.email || "",
    reviews: bundle.reviews && typeof bundle.reviews === "object" && !Array.isArray(bundle.reviews) ? bundle.reviews : {},
    tasks: Array.isArray(bundle.tasks) ? bundle.tasks : [],
    sfm: Array.isArray(bundle.sfm) ? bundle.sfm : [],
    reports: bundle.reports && typeof bundle.reports === "object" && !Array.isArray(bundle.reports) ? bundle.reports : {},
    updated_at: new Date().toISOString(),
  };
  const { ok } = await supabaseRest(`${TABLE}?on_conflict=user_id`, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: payload,
  });
  return ok;
}

async function listSupabaseUsers() {
  if (!supabaseConfigured() || !restKey()) return [];
  const { ok, data } = await supabaseRest(`${TABLE}?select=user_id,email`);
  if (!ok || !Array.isArray(data)) return [];
  return data
    .filter((row) => row && row.user_id)
    .map((row) => ({ id: String(row.user_id), email: row.email || "" }));
}

module.exports = {
  TABLE,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseConfigured,
  getUserFromAccessToken,
  loadSupabaseUserData,
  saveSupabaseUserData,
  listSupabaseUsers,
  rowToBundle,
  emptyBundle,
};
