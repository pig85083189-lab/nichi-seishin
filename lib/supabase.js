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

function publicAuthUser(data) {
  if (!data || !data.id) return null;
  const meta = data.user_metadata && typeof data.user_metadata === "object" ? data.user_metadata : {};
  return {
    id: String(data.id),
    email: String(data.email || meta.email || "").trim(),
    name: String(meta.name || meta.full_name || data.email || "").trim(),
    picture: String(meta.avatar_url || meta.picture || "").trim(),
  };
}

async function getUserFromAccessToken(token) {
  const access = String(token || "").trim();
  if (!access) return null;

  try {
    const admin = getAdminClient();
    if (admin) {
      const { data, error } = await admin.auth.getUser(access);
      if (!error && data && data.user) {
        const user = publicAuthUser(data.user);
        if (user) return user;
      }
      if (error) {
        console.warn("Auth check: admin.auth.getUser failed", {
          message: error.message,
          status: error.status || error.statusCode || "",
          tokenChars: access.length,
          tokenPrefix: access.slice(0, 16),
        });
      }
    }
  } catch (error) {
    console.warn("getUserFromAccessToken admin:", error && error.message ? error.message : error);
  }

  if (!supabaseConfigured()) return null;
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${access}`,
      apikey: supabaseAnonKey(),
    },
  });
  if (!response.ok) {
    console.warn("getUserFromAccessToken /auth/v1/user:", response.status);
    return null;
  }
  const data = await response.json().catch(() => null);
  return publicAuthUser(data);
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
    insights: [],
    reports: {},
  };
}

function stripInsightsFromReports(reports) {
  const next = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  delete next.__insights;
  return next;
}

function extractInsights(row, nested, reports) {
  if (Array.isArray(row && row.insights)) return row.insights;
  if (nested && Array.isArray(nested.insights)) return nested.insights;
  if (reports && Array.isArray(reports.__insights)) return reports.__insights;
  return [];
}

function nestInsightsInReports(reports, insights) {
  const next = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  next.__insights = Array.isArray(insights) ? insights : [];
  return next;
}

function rowToBundle(row, userId) {
  if (!row || typeof row !== "object") return emptyBundle(userId);
  const nested = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : null;
  const reviews = row.reviews || (nested && nested.reviews) || {};
  const tasks = row.tasks || (nested && nested.tasks) || [];
  const sfm = row.sfm || (nested && nested.sfm) || [];
  const reportsRaw = row.reports || (nested && nested.reports) || {};
  return {
    userId,
    reviews: reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {},
    tasks: Array.isArray(tasks) ? tasks : [],
    sfm: Array.isArray(sfm) ? sfm : [],
    insights: extractInsights(row, nested, reportsRaw),
    reports: stripInsightsFromReports(reportsRaw),
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
    reports: nestInsightsInReports(
      bundle.reports,
      Array.isArray(bundle.insights) ? bundle.insights : []
    ),
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

function logSupabaseError(label, error) {
  const raw = error && typeof error === "object" ? error : { message: String(error || "") };
  console.error(label, {
    message: raw.message || "",
    code: raw.code || "",
    details: raw.details || "",
    hint: raw.hint || "",
    status: raw.status || raw.statusCode || "",
  });
}

function describeSupabaseError(error) {
  const message = String((error && (error.message || error.details || error.hint)) || error || "");
  const code = String((error && error.code) || "");
  const hint = String((error && error.hint) || "");
  const raw = [code, message, hint].filter(Boolean).join(" | ");
  if (/PGRST002|schema cache|Could not find the table|does not exist/i.test(`${code} ${message}`)) {
    return `PostgREST 看不到 public.nichi_subscriptions（${raw}）。請到 Settings → API 確認 Exposed schemas 含 public，並在 SQL Editor 執行：notify pgrst, 'reload schema';`;
  }
  if (/invalid api key|jwt|401|JWSError|PGRST301/i.test(`${code} ${message}`)) {
    return `Supabase Secret key 無效（${raw}）`;
  }
  if (/permission denied|rls|42501/i.test(`${code} ${message}`)) {
    return `沒有權限寫入 public.nichi_subscriptions（${raw}）`;
  }
  return raw || "Supabase 寫入失敗";
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
    db: {
      schema: "public",
    },
  });
  return adminClient;
}

function fromPublic(admin, table) {
  return admin.schema("public").from(table);
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data && typeof data === "object" ? data : null;
}

async function getSubscription(userId) {
  const id = String(userId || "").trim();
  const admin = getAdminClient();
  if (!id || !admin) return null;
  const { data, error } = await fromPublic(admin, SUB_TABLE).select("*").eq("user_id", id).maybeSingle();
  if (error) {
    logSupabaseError("getSubscription failed", error);
    throw new Error(describeSupabaseError(error));
  }
  return data || null;
}

async function getSubscriptionByOrderNo(orderNo) {
  const no = String(orderNo || "").trim();
  const admin = getAdminClient();
  if (!no || !admin) return null;
  const { data, error } = await fromPublic(admin, SUB_TABLE).select("*").eq("merchant_order_no", no).maybeSingle();
  if (error) {
    logSupabaseError("getSubscriptionByOrderNo failed", error);
    return null;
  }
  return data || null;
}

async function getSubscriptionByPeriodNo(periodNo) {
  const no = String(periodNo || "").trim();
  const admin = getAdminClient();
  if (!no || !admin) return null;
  const { data, error } = await fromPublic(admin, SUB_TABLE).select("*").eq("period_no", no).maybeSingle();
  if (error) {
    logSupabaseError("getSubscriptionByPeriodNo failed", error);
    return null;
  }
  return data || null;
}

async function upsertSubscription(payload) {
  const admin = getAdminClient();
  if (!payload || !payload.user_id || !admin) return null;
  const { data, error } = await fromPublic(admin, SUB_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  if (error) {
    logSupabaseError("upsertSubscription failed", error);
    throw new Error(describeSupabaseError(error));
  }
  return data || firstRow(data);
}

async function patchSubscription(userId, patch) {
  const id = String(userId || "").trim();
  const admin = getAdminClient();
  if (!id || !patch || !admin) return null;
  const { data, error } = await fromPublic(admin, SUB_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", id)
    .select()
    .maybeSingle();
  if (error) {
    logSupabaseError("patchSubscription failed", error);
    throw new Error(describeSupabaseError(error));
  }
  return data || null;
}

async function insertBillingEvent(event) {
  const admin = getAdminClient();
  if (!event || !admin) return { ok: false, duplicate: false };
  const tradeNo = String(event.trade_no || "").trim();
  if (tradeNo) {
    const { data: existing } = await fromPublic(admin, EVENT_TABLE).select("id").eq("trade_no", tradeNo).maybeSingle();
    if (existing) return { ok: true, duplicate: true };
  }
  const { error } = await fromPublic(admin, EVENT_TABLE).insert({
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
    logSupabaseError("insertBillingEvent failed", error);
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
