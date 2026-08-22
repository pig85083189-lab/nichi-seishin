const { getAdminClient } = require("./supabase");

const TAIPEI = "Asia/Taipei";

const EVENT_NAMES = [
  "app_open",
  "auth_signup_completed",
  "login_completed",
  "review_started",
  "review_completed",
  "quick_review_completed",
  "deep_review_completed",
  "body_awareness_completed",
  "deep_thinking_started",
  "deep_thinking_completed",
  "action_card_created",
  "action_card_completed",
  "weekly_report_generated",
  "weekly_report_viewed",
  "monthly_report_generated",
  "monthly_report_viewed",
  "manifestation_created",
  "history_viewed",
  "subscription_page_viewed",
  "trial_started",
  "trial_expired",
  "subscription_started",
];

const CORE_EVENTS = new Set([
  "review_completed",
  "quick_review_completed",
  "deep_review_completed",
  "body_awareness_completed",
  "deep_thinking_completed",
  "action_card_created",
  "action_card_completed",
  "weekly_report_generated",
  "monthly_report_generated",
]);

const FEATURE_EVENTS = {
  quick_review: "quick_review_completed",
  deep_review: "deep_review_completed",
  body_awareness: "body_awareness_completed",
  deep_thinking: "deep_thinking_completed",
  execution: ["action_card_created", "action_card_completed"],
  weekly_report: "weekly_report_generated",
  monthly_report: "monthly_report_generated",
  manifestation: "manifestation_created",
  history: "history_viewed",
};

const ALLOWED_META_KEYS = new Set(["mode", "source", "step", "kind", "type", "period", "plan", "status", "feature", "round"]);
const UNIQUE_ONCE = new Set(["auth_signup_completed", "trial_started", "trial_expired", "subscription_started"]);

function taipeiDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(isoDate, days) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + Number(days || 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utc));
}

function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(`${fromIso}T00:00:00+08:00`);
  const b = Date.parse(`${toIso}T00:00:00+08:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function sanitizeMetadata(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const next = {};
  Object.keys(src).forEach((key) => {
    if (!ALLOWED_META_KEYS.has(key)) return;
    const value = src[key];
    if (value == null || value === "") return;
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = Math.max(-999, Math.min(999, Math.round(value)));
      return;
    }
    if (typeof value === "boolean") {
      next[key] = value;
      return;
    }
    const text = String(value).trim();
    if (!text || text.length > 24 || /[。！？\n]/.test(text)) return;
    next[key] = text;
  });
  return next;
}

function eventCategory(name) {
  if (name.startsWith("auth_") || name === "login_completed" || name === "app_open") return "auth";
  if (name.includes("review")) return "review";
  if (name.includes("body")) return "body";
  if (name.includes("thinking")) return "thinking";
  if (name.includes("action")) return "execution";
  if (name.includes("report")) return "report";
  if (name.includes("manifest")) return "manifest";
  if (name.includes("history") || name.includes("subscription_page")) return "nav";
  if (name.includes("trial") || name.includes("subscription_started")) return "billing";
  return "product";
}

function maskEmail(email) {
  const raw = String(email || "").trim();
  const at = raw.indexOf("@");
  if (at < 1) return raw ? "***" : "";
  const name = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const keep = name.slice(0, 1);
  return `${keep}***@${domain}`;
}

function adminClient() {
  try {
    return getAdminClient();
  } catch {
    return null;
  }
}

async function isAnalyticsAdmin(user) {
  if (!user || !user.id) return false;
  const admin = adminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("nichi_admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!error && data && data.user_id) return true;
  const allow = String(process.env.ANALYTICS_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && user.email && allow.includes(String(user.email).toLowerCase())) return true;
  return false;
}

async function insertAnalyticsEvent(input) {
  const userId = String((input && input.userId) || "").trim();
  const eventName = String((input && input.eventName) || "").trim();
  if (!userId || !EVENT_NAMES.includes(eventName)) return { ok: false, skipped: true };
  const admin = adminClient();
  if (!admin) return { ok: false, skipped: true };
  const payload = {
    user_id: userId,
    event_name: eventName,
    event_category: String((input && input.category) || eventCategory(eventName)),
    event_metadata: sanitizeMetadata((input && input.metadata) || {}),
    session_id: String((input && input.sessionId) || "").slice(0, 64) || null,
    created_at: input && input.createdAt ? new Date(input.createdAt).toISOString() : new Date().toISOString(),
  };
  if (!payload.event_metadata.source && input && input.source) {
    payload.event_metadata.source = String(input.source).slice(0, 24);
  }
  try {
    if (UNIQUE_ONCE.has(eventName) || input.uniqueOnce) {
      const { data: existing } = await admin
        .from("analytics_events")
        .select("id")
        .eq("user_id", userId)
        .eq("event_name", eventName)
        .limit(1)
        .maybeSingle();
      if (existing) return { ok: true, duplicate: true };
    }
    const { error } = await admin.from("analytics_events").insert(payload);
    if (error) {
      if (error.code === "23505") return { ok: true, duplicate: true };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function fetchAll(table, columns, apply) {
  const admin = adminClient();
  if (!admin) return [];
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  while (from < 20000) {
    let query = admin.from(table).select(columns).range(from, from + pageSize - 1);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function day0ForUser(user) {
  return user.trialStartedAt || user.signupDate || "";
}

function computeStreaks(dates) {
  const unique = [...new Set((dates || []).filter(Boolean))].sort();
  if (!unique.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const gap = daysBetween(unique[i - 1], unique[i]);
    if (gap === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  const today = taipeiDate(new Date());
  const last = unique[unique.length - 1];
  const sinceLast = daysBetween(last, today);
  const current = sinceLast === 0 || sinceLast === 1 ? (() => {
    let count = 1;
    for (let i = unique.length - 1; i > 0; i -= 1) {
      if (daysBetween(unique[i - 1], unique[i]) === 1) count += 1;
      else break;
    }
    return sinceLast === 1 || sinceLast === 0 ? count : 0;
  })() : 0;
  return { current, longest };
}

function buildUserMaps(events, profiles, subscriptions) {
  const users = new Map();
  (profiles || []).forEach((row) => {
    users.set(row.id, {
      userId: row.id,
      email: row.email || "",
      signupDate: taipeiDate(row.created_at),
      signupAt: row.created_at,
      firstActiveDate: "",
      lastActiveDate: "",
      activeDates: new Set(),
      counts: {},
      trialStartedAt: "",
      trialEndsAt: "",
      trialStatus: null,
      subscriptionStatus: null,
    });
  });
  (subscriptions || []).forEach((row) => {
    const user = users.get(row.user_id) || {
      userId: row.user_id,
      email: row.email || "",
      signupDate: taipeiDate(row.created_at),
      signupAt: row.created_at,
      firstActiveDate: "",
      lastActiveDate: "",
      activeDates: new Set(),
      counts: {},
    };
    user.trialStartedAt = taipeiDate(row.trial_started_at);
    user.trialEndsAt = row.trial_ends_at || "";
    user.trialStatus = row.status || null;
    user.subscriptionStatus = row.status === "active" || row.status === "past_due" ? "active" : row.status || null;
    user.paid = row.status === "active" || row.status === "past_due";
    users.set(row.user_id, user);
  });
  (events || []).forEach((event) => {
    const user = users.get(event.user_id) || {
      userId: event.user_id,
      email: "",
      signupDate: taipeiDate(event.created_at),
      signupAt: event.created_at,
      firstActiveDate: "",
      lastActiveDate: "",
      activeDates: new Set(),
      counts: {},
    };
    const day = taipeiDate(event.created_at);
    user.counts[event.event_name] = (user.counts[event.event_name] || 0) + 1;
    if (CORE_EVENTS.has(event.event_name) && day) {
      user.activeDates.add(day);
      if (!user.firstActiveDate || day < user.firstActiveDate) user.firstActiveDate = day;
      if (!user.lastActiveDate || day > user.lastActiveDate) user.lastActiveDate = day;
    }
    users.set(event.user_id, user);
  });
  return users;
}

function summarizeUser(user) {
  const today = taipeiDate(new Date());
  const activeDates = [...(user.activeDates || [])].sort();
  const last7 = addDays(today, -6);
  const last30 = addDays(today, -29);
  const streaks = computeStreaks(activeDates);
  const day0 = day0ForUser(user);
  const count = (name) => Number(user.counts[name] || 0);
  const onDay = (offset) => {
    if (!day0) return false;
    const target = addDays(day0, offset);
    return activeDates.includes(target);
  };
  return {
    userId: user.userId,
    emailMasked: maskEmail(user.email),
    signupDate: user.signupDate || null,
    firstActiveDate: user.firstActiveDate || null,
    lastActiveDate: user.lastActiveDate || null,
    totalActiveDays: activeDates.length,
    activeDaysLast7: activeDates.filter((day) => day >= last7 && day <= today).length,
    activeDaysLast30: activeDates.filter((day) => day >= last30 && day <= today).length,
    totalReviews: count("review_completed"),
    quickReviews: count("quick_review_completed"),
    deepReviews: count("deep_review_completed"),
    bodyAwarenessCount: count("body_awareness_completed"),
    deepThinkingCount: count("deep_thinking_completed"),
    actionCardsCreated: count("action_card_created"),
    actionCardsCompleted: count("action_card_completed"),
    weeklyReportsGenerated: count("weekly_report_generated"),
    monthlyReportsGenerated: count("monthly_report_generated"),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    daysSinceSignup: user.signupDate ? daysBetween(user.signupDate, today) : null,
    trialStatus: user.trialStatus || null,
    subscriptionStatus: user.paid ? "active" : user.trialStatus || null,
    paid: Boolean(user.paid),
    features: {
      quick: count("quick_review_completed") > 0,
      deep: count("deep_review_completed") > 0,
      body: count("body_awareness_completed") > 0,
      thinking: count("deep_thinking_completed") > 0,
      execution: count("action_card_created") + count("action_card_completed") > 0,
      weekly: count("weekly_report_generated") > 0,
      monthly: count("monthly_report_generated") > 0,
      manifestation: count("manifestation_created") > 0,
      history: count("history_viewed") > 0,
    },
    d3: onDay(3),
    d7: onDay(7),
    d14: onDay(14),
    d30: onDay(30),
    firstReview: count("review_completed") > 0,
    trialStartedAt: user.trialStartedAt || null,
  };
}

function filterUsers(users, memberIds) {
  if (!memberIds) return [...users.values()];
  const set = new Set(memberIds);
  return [...users.values()].filter((user) => set.has(user.userId));
}

function retentionTable(summaries, offsets) {
  const signed = summaries.length;
  return offsets.map((day) => {
    const count = summaries.filter((item) => {
      if (day === 0) return Boolean(item.signupDate || item.trialStartedAt);
      return item[`d${day}`];
    }).length;
    return {
      day,
      users: day === 0 ? signed : count,
      rate: signed ? count / signed : 0,
    };
  });
}

function windowActiveRetention(users, windowDays, minActiveDays) {
  const need = Math.max(1, Number(minActiveDays) || 3);
  let count = 0;
  users.forEach((user) => {
    const day0 = day0ForUser(user);
    if (!day0) return;
    const end = addDays(day0, windowDays);
    const days = [...user.activeDates].filter((day) => day >= day0 && day <= end).length;
    if (days >= need) count += 1;
  });
  return { windowDays, minActiveDays: need, users: count, rate: users.length ? count / users.length : 0 };
}

function featureStats(events, activeUserCount) {
  const labels = {
    quick_review: "快速復盤",
    deep_review: "深度復盤",
    body_awareness: "身體覺察",
    deep_thinking: "深度思考",
    execution: "執行力",
    weekly_report: "週報",
    monthly_report: "月報",
    manifestation: "顯化力",
    history: "歷史紀錄",
  };
  return Object.entries(FEATURE_EVENTS).map(([key, names]) => {
    const list = Array.isArray(names) ? names : [names];
    const matched = (events || []).filter((event) => list.includes(event.event_name));
    const people = new Set(matched.map((event) => event.user_id));
    return {
      key,
      label: labels[key],
      users: people.size,
      uses: matched.length,
      ofActive: activeUserCount ? people.size / activeUserCount : 0,
    };
  });
}

function funnelFrom(summaries) {
  const layers = [
    { key: "signup", label: "註冊", count: summaries.length },
    { key: "first_review", label: "完成第一次復盤", count: summaries.filter((item) => item.firstReview).length },
    { key: "d3", label: "D3 回來", count: summaries.filter((item) => item.d3).length },
    { key: "d7", label: "D7 回來", count: summaries.filter((item) => item.d7).length },
    { key: "d14", label: "D14 回來", count: summaries.filter((item) => item.d14).length },
    { key: "d30", label: "D30 回來", count: summaries.filter((item) => item.d30).length },
    { key: "subscribed", label: "開始訂閱", count: summaries.filter((item) => item.paid).length },
  ];
  const total = layers[0].count || 0;
  return layers.map((layer, index) => {
    const prev = index === 0 ? layer.count : layers[index - 1].count;
    return {
      ...layer,
      fromPrev: prev ? layer.count / prev : 0,
      fromSignup: total ? layer.count / total : 0,
    };
  });
}

function dauSeries(events, days = 30) {
  const today = taipeiDate(new Date());
  const start = addDays(today, -(days - 1));
  const buckets = {};
  for (let i = 0; i < days; i += 1) buckets[addDays(start, i)] = new Set();
  (events || []).forEach((event) => {
    if (!CORE_EVENTS.has(event.event_name)) return;
    const day = taipeiDate(event.created_at);
    if (buckets[day]) buckets[day].add(event.user_id);
  });
  return Object.keys(buckets)
    .sort()
    .map((day) => ({ date: day, users: buckets[day].size }));
}

async function loadAnalyticsBundle() {
  const [events, profiles, subscriptions, cohorts, members] = await Promise.all([
    fetchAll("analytics_events", "user_id,event_name,event_category,event_metadata,created_at"),
    fetchAll("nichi_profiles", "id,email,created_at"),
    fetchAll("nichi_subscriptions", "user_id,email,status,trial_started_at,trial_ends_at,updated_at"),
    fetchAll("nichi_analytics_cohorts", "id,slug,name,start_date,end_date,created_at"),
    fetchAll("nichi_analytics_cohort_members", "cohort_id,user_id"),
  ]);
  return { events, profiles, subscriptions, cohorts, members };
}

function buildDashboard(bundle, options = {}) {
  const cohortSlug = String(options.cohort || "all").trim();
  const memberIds = cohortSlug && cohortSlug !== "all"
    ? bundle.members.filter((row) => {
        const cohort = bundle.cohorts.find((item) => item.slug === cohortSlug || item.id === cohortSlug);
        return cohort && row.cohort_id === cohort.id;
      }).map((row) => row.user_id)
    : null;
  const users = buildUserMaps(bundle.events, bundle.profiles, bundle.subscriptions);
  const scopedUsers = filterUsers(users, memberIds);
  const scopedEvents = memberIds
    ? bundle.events.filter((event) => memberIds.includes(event.user_id))
    : bundle.events;
  const summaries = scopedUsers.map(summarizeUser);
  const today = taipeiDate(new Date());
  const last7 = addDays(today, -6);
  const last30 = addDays(today, -29);
  const activeToday = summaries.filter((item) => item.lastActiveDate === today).length;
  const active7 = summaries.filter((item) => item.activeDaysLast7 > 0).length;
  const active30 = summaries.filter((item) => item.activeDaysLast30 > 0).length;
  const firstReview = summaries.filter((item) => item.firstReview).length;
  const dayRetention = retentionTable(summaries, [0, 1, 3, 7, 14, 30]);
  const d7 = dayRetention.find((item) => item.day === 7) || { users: 0, rate: 0 };
  const d30 = dayRetention.find((item) => item.day === 30) || { users: 0, rate: 0 };
  return {
    generatedAt: new Date().toISOString(),
    timezone: TAIPEI,
    cohort: cohortSlug || "all",
    cohorts: [{ slug: "all", name: "全部使用者" }, ...bundle.cohorts.map((item) => ({ slug: item.slug, name: item.name, startDate: item.start_date, endDate: item.end_date }))],
    kpis: {
      signups: summaries.length,
      activeToday,
      activeLast7: active7,
      activeLast30: active30,
      firstReview,
      d7Retention: d7.rate,
      d7Users: d7.users,
      d30Retention: d30.rate,
      d30Users: d30.users,
      paid: summaries.filter((item) => item.paid).length,
    },
    funnel: funnelFrom(summaries),
    features: featureStats(scopedEvents, active30 || summaries.filter((item) => item.totalActiveDays > 0).length),
    retention: {
      dayN: dayRetention,
      activeWindows: [
        windowActiveRetention(scopedUsers, 7, 3),
        windowActiveRetention(scopedUsers, 14, 3),
        windowActiveRetention(scopedUsers, 30, 3),
      ],
    },
    dau: dauSeries(scopedEvents, 30),
    users: summaries
      .sort((left, right) => String(right.lastActiveDate || "").localeCompare(String(left.lastActiveDate || "")))
      .map((item) => ({
        ...item,
        userId: item.userId,
      })),
    notes: {
      unpaidReliable: true,
      viewedEventsLiveOnly: true,
      deepThinkingNotBackfilled: true,
    },
  };
}

async function listCohorts() {
  return fetchAll("nichi_analytics_cohorts", "id,slug,name,start_date,end_date,created_at");
}

async function upsertCohort({ slug, name, startDate, endDate, userIds }) {
  const admin = adminClient();
  if (!admin) throw new Error("尚未設定 Supabase Admin");
  const cleanSlug = String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const cleanName = String(name || cleanSlug).trim().slice(0, 80);
  if (!cleanSlug) throw new Error("請提供 cohort slug");
  const { data, error } = await admin
    .from("nichi_analytics_cohorts")
    .upsert({
      slug: cleanSlug,
      name: cleanName,
      start_date: startDate || null,
      end_date: endDate || null,
    }, { onConflict: "slug" })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  const ids = (Array.isArray(userIds) ? userIds : [])
    .map((item) => String(item || "").trim())
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item));
  if (ids.length) {
    const rows = ids.map((userId) => ({ cohort_id: data.id, user_id: userId }));
    const { error: memberError } = await admin.from("nichi_analytics_cohort_members").upsert(rows, { onConflict: "cohort_id,user_id" });
    if (memberError) throw new Error(memberError.message);
  }
  return data;
}

module.exports = {
  EVENT_NAMES,
  CORE_EVENTS,
  TAIPEI,
  taipeiDate,
  addDays,
  sanitizeMetadata,
  maskEmail,
  isAnalyticsAdmin,
  insertAnalyticsEvent,
  loadAnalyticsBundle,
  buildDashboard,
  listCohorts,
  upsertCohort,
};
