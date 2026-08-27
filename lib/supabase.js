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

function realServiceKey() {
  const key = supabaseServiceKey();
  if (!key || serviceKeyLooksPublic(key)) return "";
  return key;
}

function restAuthHeaders(options = {}) {
  const anon = supabaseAnonKey();
  const service = options.forceUserToken ? "" : realServiceKey();
  const token = service || String(options.userToken || "").trim() || anon || supabaseServiceKey();
  return {
    apikey: anon || service || supabaseServiceKey() || token,
    Authorization: `Bearer ${token}`,
  };
}

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function stripNullBytes(value) {
  if (typeof value === "string") return value.replace(/\u0000/g, "");
  if (Array.isArray(value)) return value.map(stripNullBytes);
  if (value && typeof value === "object") {
    const next = {};
    Object.keys(value).forEach((key) => {
      next[key] = stripNullBytes(value[key]);
    });
    return next;
  }
  return value;
}

function restErrorText(data, status) {
  if (data == null || data === "") return `HTTP ${status || 0}`;
  if (typeof data === "string") return data;
  return String(data.message || data.error_description || data.error || data.hint || data.details || `HTTP ${status || 0}`);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function buildUserDataRow(userId, bundle, extra = {}) {
  return stripNullBytes(
    cloneJson(
      {
        user_id: userId,
        email: extra.email || "",
        reviews: bundle.reviews && typeof bundle.reviews === "object" && !Array.isArray(bundle.reviews) ? bundle.reviews : {},
        tasks: Array.isArray(bundle.tasks) ? bundle.tasks : [],
        sfm: Array.isArray(bundle.sfm) ? bundle.sfm : [],
        reports: nestLibrariesInReports(
          bundle.reports,
          Array.isArray(bundle.insights) ? bundle.insights : [],
          Array.isArray(bundle.manifests) ? bundle.manifests : []
        ),
        updated_at: new Date().toISOString(),
      },
      null
    )
  );
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
  if (!supabaseUrl() || !key) return { ok: false, status: 0, data: null, error: "尚未設定 Supabase" };
  let response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: {
        ...restAuthHeaders(options),
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    return { ok: false, status: 0, data: null, error: String(error && error.message ? error.message : error) };
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? "" : restErrorText(data, response.status),
  };
}

function emptyBundle(userId) {
  return {
    userId,
    reviews: {},
    tasks: [],
    sfm: [],
    insights: [],
    manifests: [],
    reports: {},
  };
}

function stripLibrariesFromReports(reports) {
  const next = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  delete next.__insights;
  delete next.__manifests;
  return next;
}

function extractInsights(row, nested, reports) {
  if (Array.isArray(row && row.insights)) return row.insights;
  if (nested && Array.isArray(nested.insights)) return nested.insights;
  if (reports && Array.isArray(reports.__insights)) return reports.__insights;
  return [];
}

function extractManifests(row, nested, reports) {
  if (Array.isArray(row && row.manifests)) return row.manifests;
  if (nested && Array.isArray(nested.manifests)) return nested.manifests;
  if (reports && Array.isArray(reports.__manifests)) return reports.__manifests;
  return [];
}

function nestLibrariesInReports(reports, insights, manifests) {
  const next = reports && typeof reports === "object" && !Array.isArray(reports) ? { ...reports } : {};
  next.__insights = Array.isArray(insights) ? insights : [];
  next.__manifests = Array.isArray(manifests) ? manifests : [];
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
    manifests: extractManifests(row, nested, reportsRaw),
    reports: stripLibrariesFromReports(reportsRaw),
    updatedAt: row.updated_at || row.updatedAt || "",
  };
}

async function loadSupabaseUserData(userId, extra = {}) {
  const id = String(userId || "").trim();
  if (!id || !supabaseConfigured()) return null;

  try {
    const admin = getAdminClient();
    if (admin) {
      const { data, error } = await fromPublic(admin, TABLE).select("*").eq("user_id", id).maybeSingle();
      if (error) {
        logSupabaseError("load nichi_user_data admin", error);
      } else {
        if (!data) return emptyBundle(id);
        return rowToBundle(data, id);
      }
    }
  } catch (error) {
    console.warn("load nichi_user_data admin skipped", error && error.message ? error.message : error);
  }

  const { ok, data, error } = await supabaseRest(`${TABLE}?user_id=eq.${encodeURIComponent(id)}&select=*`, {
    userToken: extra.userToken,
  });
  if (!ok) {
    console.warn("load nichi_user_data rest failed", { userId: id, error });
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return emptyBundle(id);
  return rowToBundle(row, id);
}

async function saveSupabaseUserData(userId, bundle, extra = {}) {
  const id = String(userId || "").trim();
  if (!id || !supabaseConfigured() || !(realServiceKey() || extra.userToken || restKey())) {
    return { ok: false, error: "尚未設定雲端資料庫" };
  }
  if (!isUuid(id)) {
    return { ok: false, error: `user_id 不是有效的 UUID（${id}）` };
  }
  const payload = buildUserDataRow(id, bundle, extra);
  if (!payload) return { ok: false, error: "資料格式無法送到雲端" };

  try {
    const admin = getAdminClient();
    if (admin) {
      const { error } = await fromPublic(admin, TABLE).upsert(payload, { onConflict: "user_id" });
      if (!error) return { ok: true, via: "admin" };
      logSupabaseError("save nichi_user_data admin upsert", error);
      const described = describeSupabaseError(error);
      console.error("save nichi_user_data admin failed", {
        userId: id,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      if (!extra.userToken) return { ok: false, error: described };
    }
  } catch (error) {
    console.error("save nichi_user_data admin client", {
      userId: id,
      message: error && error.message ? error.message : error,
    });
  }

  const attempts = [
    { forceUserToken: false, method: "POST", path: `${TABLE}?on_conflict=user_id`, prefer: "resolution=merge-duplicates,return=minimal" },
    { forceUserToken: true, method: "POST", path: `${TABLE}?on_conflict=user_id`, prefer: "resolution=merge-duplicates,return=minimal" },
    { forceUserToken: false, method: "PATCH", path: `${TABLE}?user_id=eq.${encodeURIComponent(id)}`, prefer: "return=minimal" },
    { forceUserToken: true, method: "PATCH", path: `${TABLE}?user_id=eq.${encodeURIComponent(id)}`, prefer: "return=minimal" },
    { forceUserToken: true, method: "POST", path: TABLE, prefer: "return=minimal" },
  ];

  let last = { ok: false, status: 0, error: "無法寫入雲端資料庫" };
  for (const attempt of attempts) {
    if (attempt.forceUserToken && !extra.userToken) continue;
    last = await supabaseRest(attempt.path, {
      method: attempt.method,
      prefer: attempt.prefer,
      userToken: extra.userToken,
      forceUserToken: attempt.forceUserToken,
      body: payload,
    });
    if (last.ok) return { ok: true, status: last.status, via: "rest" };
    console.warn("save nichi_user_data rest attempt failed", {
      userId: id,
      method: attempt.method,
      path: attempt.path,
      forceUserToken: attempt.forceUserToken,
      status: last.status,
      error: last.error,
    });
  }
  console.error("saveSupabaseUserData failed", {
    userId: id,
    status: last.status,
    error: last.error,
    data: last.data,
  });
  return { ok: false, status: last.status, error: last.error || "無法寫入雲端資料庫" };
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
const INTERNAL_TABLE = "nichi_internal_users";
const TRIAL_DAYS = 30;
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
    return `PostgREST 看不到資料表（${raw}）。請到 Settings → API 確認 Exposed schemas 含 public，並在 SQL Editor 執行：notify pgrst, 'reload schema';`;
  }
  if (/invalid api key|jwt|401|JWSError|PGRST301/i.test(`${code} ${message}`)) {
    return `Supabase Secret key 無效（${raw}）`;
  }
  if (/permission denied|rls|42501/i.test(`${code} ${message}`)) {
    return `沒有權限寫入雲端資料表（${raw}）`;
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

function parseInternalAllowlist() {
  const ids = String(firstEnv(["NICHI_INTERNAL_USER_IDS", "INTERNAL_USER_IDS"]) || "")
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => isUuid(item));
  const emails = String(firstEnv(["NICHI_INTERNAL_EMAILS", "INTERNAL_EMAILS"]) || "")
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return { ids, emails };
}

function isInternalAllowlisted(userId, email) {
  const { ids, emails } = parseInternalAllowlist();
  if (ids.includes(String(userId || "").trim().toLowerCase())) return true;
  const mail = String(email || "").trim().toLowerCase();
  return Boolean(mail && emails.includes(mail));
}

function isInternalAccessType(value) {
  return String(value || "").trim().toLowerCase() === "internal";
}

function isInternal(row) {
  return isInternalAccessType(row && row.access_type);
}

async function lookupInternalByTable(userId) {
  const admin = getAdminClient();
  const id = String(userId || "").trim();
  if (!admin || !id) return { row: null, error: null };
  const queries = [
    () => admin.from(INTERNAL_TABLE).select("user_id,access_type").eq("user_id", id).maybeSingle(),
    () => fromPublic(admin, INTERNAL_TABLE).select("user_id,access_type").eq("user_id", id).maybeSingle(),
  ];
  let lastError = null;
  for (const query of queries) {
    const { data, error } = await query();
    if (!error) return { row: data || null, error: null };
    lastError = error;
  }
  return { row: null, error: lastError };
}

async function lookupInternalByRpc(userId, email) {
  const admin = getAdminClient();
  const id = String(userId || "").trim();
  if (!admin || !id) return false;
  const { data, error } = await admin.rpc("nichi_is_internal_user", {
    p_user_id: id,
    p_email: String(email || "").trim(),
  });
  if (error) {
    logSupabaseError("nichi_is_internal_user rpc failed", error);
    return false;
  }
  return data === true;
}

async function lookupInternalViaPgQuery(userId, email) {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return false;
  const clauses = [];
  if (isUuid(userId)) clauses.push(`user_id = '${String(userId).replace(/'/g, "")}'::uuid`);
  const mail = String(email || "").trim().replace(/'/g, "''").slice(0, 320);
  if (mail) {
    clauses.push(`user_id in (select id from auth.users where lower(email) = lower('${mail}'))`);
  }
  if (!clauses.length) return false;
  const sql = `select user_id from public.nichi_internal_users where access_type = 'internal' and (${clauses.join(" or ")}) limit 1`;
  const paths = ["/pg/query", "/pg-meta/default/query"];
  for (const path of paths) {
    try {
      const response = await fetch(`${url}${path}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      const rows = Array.isArray(payload)
        ? payload
        : (payload && (payload.data || payload.rows)) || [];
      if (Array.isArray(rows) && rows.length) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function isInternalUser(userId, email) {
  const id = String(userId || "").trim();
  if (!id) return false;
  if (isInternalAllowlisted(id, email)) return true;
  if (!getAdminClient()) return false;
  try {
    const { row, error } = await lookupInternalByTable(id);
    if (row && isInternalAccessType(row.access_type || "internal")) return true;
    if (error) logSupabaseError("isInternalUser table lookup failed", error);
    if (await lookupInternalByRpc(id, email)) return true;
    if (await lookupInternalViaPgQuery(id, email)) return true;
    return false;
  } catch (error) {
    console.warn("isInternalUser failed:", error && error.message ? error.message : error);
    return isInternalAllowlisted(id, email);
  }
}

async function listInternalUserIds() {
  const admin = getAdminClient();
  if (!admin) return parseInternalAllowlist().ids;
  try {
    let result = await admin.from(INTERNAL_TABLE).select("user_id,access_type");
    if (result.error) {
      logSupabaseError("listInternalUserIds failed", result.error);
      result = await fromPublic(admin, INTERNAL_TABLE).select("user_id,access_type");
    }
    if (result.error || !Array.isArray(result.data)) {
      return parseInternalAllowlist().ids;
    }
    return result.data
      .filter((row) => isInternalAccessType((row && row.access_type) || "internal"))
      .map((row) => String(row.user_id || "").trim())
      .filter(Boolean);
  } catch (error) {
    console.warn("listInternalUserIds failed:", error && error.message ? error.message : error);
    return parseInternalAllowlist().ids;
  }
}

function decorateInternalAccess(row, userId, internal) {
  const id = String(userId || (row && row.user_id) || "").trim();
  if (internal) return { ...(row || { user_id: id }), access_type: "internal" };
  return row ? { ...row, access_type: "standard" } : row;
}

async function withInternalAccess(row, userId, email) {
  const id = String(userId || (row && row.user_id) || "").trim();
  const internal = await isInternalUser(id, email || (row && row.email) || "");
  return decorateInternalAccess(row, id, internal);
}

function isTrialActive(row) {
  if (!row || !row.trial_ends_at) return false;
  const ends = Date.parse(row.trial_ends_at);
  return Number.isFinite(ends) && Date.now() < ends;
}

function isPaid(row) {
  if (!row) return false;
  if (row.is_paid === true || row.is_paid === "true" || row.is_paid === 1) return true;
  return row.status === "active" || row.status === "past_due";
}

function isEntitled(row) {
  if (!row) return false;
  return isInternal(row) || isPaid(row) || isTrialActive(row);
}

function plusTrialActive(row) {
  return Boolean(row && !isInternal(row) && !isPaid(row) && isTrialActive(row));
}

function plusTrialUsed(row) {
  return Boolean(row && (row.trial_started_at || row.created_at));
}

function billingIntervalFromRow(row) {
  const raw = String((row && row.plan) || "").toLowerCase();
  if (raw === "yearly" || raw === "year" || raw === "annual" || raw === "y") return "yearly";
  if (raw === "quarter" || raw === "season") return "quarter";
  if (raw === "monthly" || raw === "month" || raw === "m") return "monthly";
  return isPaid(row) ? "monthly" : null;
}

function productPlanFromRow(row) {
  if (isInternal(row)) return "plus";
  return isPaid(row) ? "plus" : "free";
}

function effectivePlanFromRow(row) {
  if (!row) return "free";
  if (isInternal(row) || isPaid(row) || plusTrialActive(row)) return "plus";
  return "free";
}

function subscriptionStatusFromRow(row) {
  if (!row) return "none";
  if (isInternal(row) && !isPaid(row)) return "internal";
  if (isPaid(row)) {
    if (row.status === "cancelled" || row.status === "canceled") return "canceled";
    if (row.status === "expired") return "expired";
    return "active";
  }
  if (row.status === "cancelled" || row.status === "canceled") return "canceled";
  if (row.status === "expired" || (row.trial_ends_at && !isTrialActive(row))) return "expired";
  return "none";
}

function trialEndFromStart(startedAt) {
  const started = new Date(startedAt || Date.now());
  if (Number.isNaN(started.getTime())) {
    return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  }
  const taipei = new Date(started.getTime() + 8 * 60 * 60 * 1000);
  const endUtc = Date.UTC(
    taipei.getUTCFullYear(),
    taipei.getUTCMonth(),
    taipei.getUTCDate() + TRIAL_DAYS
  ) - 8 * 60 * 60 * 1000;
  return new Date(endUtc).toISOString();
}

function publicMembership(row) {
  if (!row) return null;
  const internal = isInternal(row);
  const entitled = isEntitled(row);
  const paid = isPaid(row);
  const trialActive = plusTrialActive(row);
  const trialEndsAt = row.trial_ends_at || "";
  const ends = Date.parse(trialEndsAt);
  const daysLeft = Number.isFinite(ends) ? Math.max(0, Math.ceil((ends - Date.now()) / 86400000)) : 0;
  return {
    status: internal && !paid ? "internal" : row.status || "trialing",
    entitled,
    paid,
    isPaid: paid,
    isInternal: internal,
    accessType: internal ? "internal" : "standard",
    access_type: internal ? "internal" : "standard",
    plan: productPlanFromRow(row),
    effectivePlan: effectivePlanFromRow(row),
    billingInterval: billingIntervalFromRow(row),
    subscriptionStatus: subscriptionStatusFromRow(row),
    plusTrialActive: trialActive,
    plusTrialUsed: plusTrialUsed(row),
    plusTrialStartedAt: row.trial_started_at || row.created_at || "",
    plusTrialEndsAt: trialEndsAt,
    amount: Number(row.amount) || 0,
    trialDays: TRIAL_DAYS,
    trialStartedAt: row.trial_started_at || row.created_at || "",
    trialEndsAt,
    daysLeft: paid || internal ? null : daysLeft,
    createdAt: row.created_at || row.trial_started_at || "",
    periodNo: row.period_no || "",
    nextChargeAt: row.next_charge_at || "",
    subscriptionStartedAt: row.last_charge_at || "",
    subscriptionEndsAt: row.next_charge_at || "",
  };
}

async function markPaid(userId, extraPatch = {}) {
  try {
    return await patchSubscription(userId, { ...extraPatch, is_paid: true });
  } catch (error) {
    console.warn("markPaid is_paid fallback:", error && error.message ? error.message : error);
    return patchSubscription(userId, extraPatch);
  }
}

async function upsertProfile(user) {
  if (!user || !user.id) return { ok: false };
  const payload = stripNullBytes({
    id: user.id,
    email: user.email || "",
    display_name: user.name || "",
    avatar_url: user.picture || "",
    updated_at: new Date().toISOString(),
  });
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "no admin" };
    const { error } = await fromPublic(admin, "nichi_profiles").upsert(payload, { onConflict: "id" });
    if (error) {
      logSupabaseError("upsert nichi_profiles", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    console.warn("upsertProfile skipped", error && error.message ? error.message : error);
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function ensureTrial(user) {
  if (!user || !user.id) return null;
  upsertProfile(user).catch((error) => {
    console.warn("upsertProfile", error && error.message ? error.message : error);
  });
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
  const internal = await isInternalUser(user.id, user.email);
  const now = new Date();
  if (!existing) {
    const started = now.toISOString();
    const ends = trialEndFromStart(started);
    console.log("ensureTrial insert", user.id, "trialDays", TRIAL_DAYS, "internal", internal);
    const created = await upsertSubscription({
      user_id: user.id,
      email: user.email || "",
      status: "trialing",
      plan: "monthly",
      amount: Number(process.env.NEWEBPAY_PERIOD_AMT || process.env.NEWEBPAY_AMT || 149) || 149,
      trial_started_at: started,
      trial_ends_at: ends,
      updated_at: started,
    });
    return decorateInternalAccess(created, user.id, internal);
  }
  const patch = {};
  if (user.email && user.email !== existing.email) patch.email = user.email;
  if (!internal && !isPaid(existing)) {
    // 既有列的 trial_ends_at 不重算。TRIAL_DAYS 變更只影響新 insert，避免舊帳號被自動延長。
    const nextRow = { ...existing, ...patch };
    if (isTrialActive(nextRow) && nextRow.status === "expired") {
      patch.status = "trialing";
    } else if (!OPEN_STATUSES.has(nextRow.status) && nextRow.status !== "cancelled" && !isTrialActive(nextRow) && nextRow.status !== "expired") {
      patch.status = "expired";
    } else if (nextRow.status === "trialing" && !isTrialActive(nextRow)) {
      patch.status = "expired";
    }
  }
  if (!Object.keys(patch).length) return decorateInternalAccess(existing, user.id, internal);
  const updated = (await patchSubscription(user.id, patch)) || { ...existing, ...patch };
  return decorateInternalAccess(updated, user.id, internal);
}

module.exports = {
  TABLE,
  SUB_TABLE,
  EVENT_TABLE,
  INTERNAL_TABLE,
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
  isInternal,
  isInternalUser,
  isInternalAllowlisted,
  parseInternalAllowlist,
  listInternalUserIds,
  decorateInternalAccess,
  withInternalAccess,
  isTrialActive,
  isPaid,
  isEntitled,
  plusTrialActive,
  plusTrialUsed,
  productPlanFromRow,
  effectivePlanFromRow,
  subscriptionStatusFromRow,
  billingIntervalFromRow,
  publicMembership,
  ensureTrial,
  upsertProfile,
  markPaid,
  getAdminClient,
};
