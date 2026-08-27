const { sanitizeMetadata, maskEmail, buildDashboard, taipeiDate, addDays } = require("../lib/analytics");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(sanitizeMetadata({ mode: "deep", diary: "秘密日記" }).diary == null, "不可收下日記");
assert(sanitizeMetadata({ mode: "deep", source: "home" }).mode === "deep", "允許短列舉");
assert(sanitizeMetadata({ event: "今天很難過而且寫了一大段" }).event == null, "不可收下自由文字 key");
assert(maskEmail("hello@gmail.com") === "h***@gmail.com", "email 必須遮罩");

const empty = buildDashboard({
  events: [],
  profiles: [],
  subscriptions: [],
  cohorts: [{ slug: "founder-batch-01", name: "Founder Batch 01" }],
  members: [],
});
assert(empty.kpis.signups === 0, "空資料註冊應為 0");
assert(empty.funnel.every((item) => item.count === 0), "空漏斗應為 0");
assert(empty.users.length === 0, "空使用者列表");

const day0 = addDays(taipeiDate(new Date()), -7);
const userId = "11111111-1111-1111-1111-111111111111";
const data = buildDashboard({
  events: [
    { user_id: userId, event_name: "review_completed", created_at: `${day0}T02:00:00+08:00` },
    { user_id: userId, event_name: "review_completed", created_at: `${addDays(day0, 7)}T02:00:00+08:00` },
  ],
  profiles: [{ id: userId, email: "founder@example.com", created_at: `${day0}T01:00:00+08:00` }],
  subscriptions: [{ user_id: userId, email: "founder@example.com", status: "trialing", trial_started_at: `${day0}T01:00:00+08:00`, updated_at: `${day0}T01:00:00+08:00` }],
  cohorts: [],
  members: [],
});
assert(data.users[0].emailMasked === "f***@example.com", "列表必須遮罩");
assert(data.users[0].d7 === true, "D7 應是第 7 天當天活躍");
assert(data.users[0].d3 === false, "D3 當天沒事件不可算回來");
assert(!JSON.stringify(data).includes("秘密"), "輸出不可含私人文字");

const internalId = "22222222-2222-2222-2222-222222222222";
const mixed = buildDashboard({
  events: [
    { user_id: userId, event_name: "review_completed", created_at: `${day0}T02:00:00+08:00` },
    { user_id: internalId, event_name: "review_completed", created_at: `${day0}T02:00:00+08:00` },
    { user_id: internalId, event_name: "subscription_started", created_at: `${day0}T03:00:00+08:00` },
  ],
  profiles: [
    { id: userId, email: "founder@example.com", created_at: `${day0}T01:00:00+08:00` },
    { id: internalId, email: "internal@example.com", created_at: `${day0}T01:00:00+08:00` },
  ],
  subscriptions: [
    { user_id: userId, email: "founder@example.com", status: "trialing", trial_started_at: `${day0}T01:00:00+08:00`, updated_at: `${day0}T01:00:00+08:00` },
    { user_id: internalId, email: "internal@example.com", status: "active", is_paid: true, updated_at: `${day0}T01:00:00+08:00` },
  ],
  cohorts: [{ id: "c1", slug: "founder-batch-01", name: "Founder Batch 01" }],
  members: [
    { cohort_id: "c1", user_id: userId },
    { cohort_id: "c1", user_id: internalId },
  ],
  internalUserIds: [internalId],
});
assert(mixed.kpis.signups === 1, "internal 不計入註冊");
assert(mixed.kpis.paid === 0, "internal 不計入付費轉換");
assert(!mixed.users.some((item) => item.userId === internalId), "使用者列表排除 internal");
assert(mixed.users.some((item) => item.userId === userId), "一般使用者仍在列表");
const founderOnly = buildDashboard({
  events: [
    { user_id: userId, event_name: "review_completed", created_at: `${day0}T02:00:00+08:00` },
    { user_id: internalId, event_name: "review_completed", created_at: `${day0}T02:00:00+08:00` },
  ],
  profiles: [
    { id: userId, email: "founder@example.com", created_at: `${day0}T01:00:00+08:00` },
    { id: internalId, email: "internal@example.com", created_at: `${day0}T01:00:00+08:00` },
  ],
  subscriptions: [
    { user_id: userId, email: "founder@example.com", status: "trialing", trial_started_at: `${day0}T01:00:00+08:00`, updated_at: `${day0}T01:00:00+08:00` },
    { user_id: internalId, email: "internal@example.com", status: "active", is_paid: true, updated_at: `${day0}T01:00:00+08:00` },
  ],
  cohorts: [{ id: "c1", slug: "founder-batch-01", name: "Founder Batch 01" }],
  members: [
    { cohort_id: "c1", user_id: userId },
    { cohort_id: "c1", user_id: internalId },
  ],
  internalUserIds: [internalId],
}, { cohort: "founder-batch-01" });
assert(founderOnly.kpis.signups === 1, "Founder Cohort 排除 internal");
assert(!founderOnly.users.some((item) => item.userId === internalId), "cohort 成員不含 internal");

console.log("analytics tests passed");
