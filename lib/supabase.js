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

const SUB_TABLE = "nichi_subscriptions";
const EVENT_TABLE = "nichi_billing_events";
const TRIAL_DAYS = 3;
const OPEN_STATUSES = new Set(["pending", "active", "past_due"]);

function supabaseAdminConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

async function supabaseAdminRest(path, options = {}) {
  const key = supabaseServiceKey();
  if (!supabaseUrl() || !key) return { ok: false, status: 0, data: null };
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data && typeof data === "object" ? data : null;
}

async function getSubscription(userId) {
  const id = String(userId || "").trim();
  if (!id || !supabaseAdminConfigured()) return null;
  const { ok, data } = await supabaseAdminRest(
    `${SUB_TABLE}?user_id=eq.${encodeURIComponent(id)}&select=*`
  );
  if (!ok) return null;
  return firstRow(data);
}

async function getSubscriptionByOrderNo(orderNo) {
  const no = String(orderNo || "").trim();
  if (!no || !supabaseAdminConfigured()) return null;
  const { ok, data } = await supabaseAdminRest(
    `${SUB_TABLE}?merchant_order_no=eq.${encodeURIComponent(no)}&select=*`
  );
  if (!ok) return null;
  return firstRow(data);
}

async function getSubscriptionByPeriodNo(periodNo) {
  const no = String(periodNo || "").trim();
  if (!no || !supabaseAdminConfigured()) return null;
  const { ok, data } = await supabaseAdminRest(
    `${SUB_TABLE}?period_no=eq.${encodeURIComponent(no)}&select=*`
  );
  if (!ok) return null;
  return firstRow(data);
}

async function upsertSubscription(payload) {
  if (!payload || !payload.user_id || !supabaseAdminConfigured()) return null;
  const { ok, data } = await supabaseAdminRest(`${SUB_TABLE}?on_conflict=user_id`, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: payload,
  });
  if (!ok) {
    console.error("upsertSubscription failed", data);
    return null;
  }
  return firstRow(data);
}

async function patchSubscription(userId, patch) {
  const id = String(userId || "").trim();
  if (!id || !patch || !supabaseAdminConfigured()) return null;
  const { ok, data } = await supabaseAdminRest(
    `${SUB_TABLE}?user_id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { ...patch, updated_at: new Date().toISOString() },
    }
  );
  if (!ok) {
    console.error("patchSubscription failed", data);
    return null;
  }
  return firstRow(data);
}

async function insertBillingEvent(event) {
  if (!event || !supabaseAdminConfigured()) return { ok: false, duplicate: false };
  const tradeNo = String(event.trade_no || "").trim();
  if (tradeNo) {
    const existing = await supabaseAdminRest(
      `${EVENT_TABLE}?trade_no=eq.${encodeURIComponent(tradeNo)}&select=id`
    );
    if (existing.ok && Array.isArray(existing.data) && existing.data.length) {
      return { ok: true, duplicate: true };
    }
  }
  const { ok, data } = await supabaseAdminRest(EVENT_TABLE, {
    method: "POST",
    prefer: "return=minimal",
    body: {
      user_id: event.user_id || null,
      merchant_order_no: event.merchant_order_no || null,
      period_no: event.period_no || null,
      trade_no: tradeNo || null,
      event_type: event.event_type,
      status: event.status || null,
      amount: Number.isFinite(event.amount) ? event.amount : null,
      payload: event.payload && typeof event.payload === "object" ? event.payload : {},
    },
  });
  if (!ok) console.error("insertBillingEvent failed", data);
  return { ok, duplicate: false };
}

function isTrialActive(row) {
  if (!row || !row.trial_ends_at) return false;
  const ends = Date.parse(row.trial_ends_at);
  return Number.isFinite(ends) && Date.now() < ends;
}

function isEntitled(row) {
  if (!row) return false;
  if (row.status === "active" || row.status === "past_due") return true;
  return isTrialActive(row);
}

function publicMembership(row) {
  if (!row) return null;
  const entitled = isEntitled(row);
  return {
    status: row.status || "trialing",
    entitled,
    paid: row.status === "active" || row.status === "past_due",
    plan: row.plan || "monthly",
    amount: Number(row.amount) || 0,
    trialEndsAt: row.trial_ends_at || "",
    periodNo: row.period_no || "",
    nextChargeAt: row.next_charge_at || "",
  };
}

async function ensureTrial(user) {
  if (!user || !user.id || !supabaseAdminConfigured()) return null;
  const existing = await getSubscription(user.id);
  const now = new Date();
  if (!existing) {
    const started = now.toISOString();
    const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    return upsertSubscription({
      user_id: user.id,
      email: user.email || "",
      status: "trialing",
      plan: "monthly",
      amount: Number(process.env.NEWEBPAY_PERIOD_AMT || process.env.NEWEBPAY_AMT || 100) || 100,
      trial_started_at: started,
      trial_ends_at: ends,
      updated_at: started,
    });
  }
  const patch = {};
  if (user.email && user.email !== existing.email) patch.email = user.email;
  if (!OPEN_STATUSES.has(existing.status) && existing.status !== "cancelled" && !isTrialActive(existing) && existing.status !== "expired") {
    patch.status = "expired";
  }
  if (!Object.keys(patch).length) return existing;
  return (await patchSubscription(user.id, patch)) || { ...existing, ...patch };
}

module.exports = {
  TABLE,
  SUB_TABLE,
  EVENT_TABLE,
  TRIAL_DAYS,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseConfigured,
  supabaseAdminConfigured,
  getUserFromAccessToken,
  loadSupabaseUserData,
  saveSupabaseUserData,
  listSupabaseUsers,
  rowToBundle,
  emptyBundle,
  getSubscription,
  getSubscriptionByOrderNo,
  getSubscriptionByPeriodNo,
  upsertSubscription,
  patchSubscription,
  insertBillingEvent,
  isTrialActive,
  isEntitled,
  publicMembership,
  ensureTrial,
};
