const TABLE = "nichi_user_data";

function stripEnv(value) {
  let text = String(value || "").trim().replace(/^\uFEFF/, "").replace(/\r/g, "");
  if (
    (text.startsWith("\"") && text.endsWith("\"")) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function firstEnv(names) {
  for (const name of names) {
    const value = stripEnv(process.env[name]);
    if (value) return value;
  }
  return "";
}

function supabaseUrl() {
  return firstEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]).replace(/\/+$/, "");
}

function supabaseAnonKey() {
  return firstEnv([
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);
}

function supabaseServiceKey() {
  return firstEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_KEY",
  ]);
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

function serviceKeyLooksPublic(key) {
  const value = String(key || "");
  if (value.startsWith("sb_publishable_")) return true;
  if (!value.startsWith("eyJ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
    return payload.role === "anon" || payload.role === "authenticated";
  } catch {
    return false;
  }
}

function describeSupabaseError(error) {
  const message = String((error && (error.message || error.details || error.hint)) || error || "");
  if (/schema cache|does not exist|Could not find the table/i.test(message)) {
    return "找不到 nichi_subscriptions。請在 Supabase SQL Editor 執行 supabase/schema.sql";
  }
  if (/invalid api key|jwt|401|JWSError/i.test(message)) {
    return "Supabase Secret key 無效。請到 Settings → API Keys 複製 secret / service_role，貼到 Vercel 的 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_SECRET_KEY";
  }
  if (/permission denied|rls|42501/i.test(message)) {
    return "沒有權限寫入訂閱表。請確認用的是 Secret / service_role key，不是 anon key。";
  }
  return message || "Supabase 寫入失敗";
}

let adminClient = null;

function getAdminClient() {
  if (adminClient) return adminClient;
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return null;
  if (serviceKeyLooksPublic(key)) {
    throw new Error("目前的後端金鑰是 anon / publishable key。請改貼 Secret key（sb_secret_...）或 Legacy service_role key。");
  }
  const { createClient } = require("@supabase/supabase-js");
  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data && typeof data === "object" ? data : null;
}

async function getSubscription(userId) {
  const id = String(userId || "").trim();
  const admin = getAdminClient();
  if (!id || !admin) return null;
  const { data, error } = await admin.from(SUB_TABLE).select("*").eq("user_id", id).maybeSingle();
  if (error) {
    console.error("getSubscription failed:", error.message);
    throw new Error(describeSupabaseError(error));
  }
  return data || null;
}

async function getSubscriptionByOrderNo(orderNo) {
  const no = String(orderNo || "").trim();
  const admin = getAdminClient();
  if (!no || !admin) return null;
  const { data, error } = await admin.from(SUB_TABLE).select("*").eq("merchant_order_no", no).maybeSingle();
  if (error) {
    console.error("getSubscriptionByOrderNo failed:", error.message);
    return null;
  }
  return data || null;
}

async function getSubscriptionByPeriodNo(periodNo) {
  const no = String(periodNo || "").trim();
  const admin = getAdminClient();
  if (!no || !admin) return null;
  const { data, error } = await admin.from(SUB_TABLE).select("*").eq("period_no", no).maybeSingle();
  if (error) {
    console.error("getSubscriptionByPeriodNo failed:", error.message);
    return null;
  }
  return data || null;
}

async function upsertSubscription(payload) {
  const admin = getAdminClient();
  if (!payload || !payload.user_id || !admin) return null;
  const { data, error } = await admin
    .from(SUB_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("upsertSubscription failed:", error.message, error.details || "");
    throw new Error(describeSupabaseError(error));
  }
  return data || firstRow(data);
}

async function patchSubscription(userId, patch) {
  const id = String(userId || "").trim();
  const admin = getAdminClient();
  if (!id || !patch || !admin) return null;
  const { data, error } = await admin
    .from(SUB_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("patchSubscription failed:", error.message, error.details || "");
    throw new Error(describeSupabaseError(error));
  }
  return data || null;
}

async function insertBillingEvent(event) {
  const admin = getAdminClient();
  if (!event || !admin) return { ok: false, duplicate: false };
  const tradeNo = String(event.trade_no || "").trim();
  if (tradeNo) {
    const { data: existing } = await admin.from(EVENT_TABLE).select("id").eq("trade_no", tradeNo).maybeSingle();
    if (existing) return { ok: true, duplicate: true };
  }
  const { error } = await admin.from(EVENT_TABLE).insert({
    user_id: event.user_id || null,
    merchant_order_no: event.merchant_order_no || null,
    period_no: event.period_no || null,
    trade_no: tradeNo || null,
    event_type: event.event_type,
    status: event.status || null,
    amount: Number.isFinite(event.amount) ? event.amount : null,
    payload: event.payload && typeof event.payload === "object" ? event.payload : {},
  });
  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true };
    console.error("insertBillingEvent failed:", error.message);
    return { ok: false, duplicate: false };
  }
  return { ok: true, duplicate: false };
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
  if (!user || !user.id) return null;
  if (!supabaseUrl()) {
    throw new Error("尚未設定 SUPABASE_URL");
  }
  if (!supabaseServiceKey()) {
    throw new Error("尚未設定 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_SECRET_KEY");
  }
  const admin = getAdminClient();
  if (!admin) {
    throw new Error("無法建立 Supabase Admin Client");
  }
  const existing = await getSubscription(user.id);
  const now = new Date();
  if (!existing) {
    const started = now.toISOString();
    const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    console.log("ensureTrial insert", user.id, "keyPrefix", supabaseServiceKey().slice(0, 12));
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
