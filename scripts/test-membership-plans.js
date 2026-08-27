const {
  TRIAL_DAYS,
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
  isInternalAllowlisted,
} = require("../lib/supabase");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const future = new Date(Date.now() + 10 * 86400000).toISOString();
const past = new Date(Date.now() - 2 * 86400000).toISOString();

const trialing = {
  status: "trialing",
  plan: "monthly",
  is_paid: false,
  trial_started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  trial_ends_at: future,
};

const expired = {
  status: "expired",
  plan: "monthly",
  is_paid: false,
  trial_started_at: "2026-01-01T00:00:00.000Z",
  trial_ends_at: past,
};

const paid = {
  status: "active",
  plan: "monthly",
  is_paid: true,
  trial_started_at: "2026-01-01T00:00:00.000Z",
  trial_ends_at: past,
  last_charge_at: "2026-08-01T00:00:00.000Z",
  next_charge_at: "2026-09-01",
};

assert(TRIAL_DAYS === 7, "新建立 trial 為 7 天");
assert(isTrialActive(trialing) === true, "試用中 isTrialActive");
assert(plusTrialActive(trialing) === true, "試用中 plusTrialActive");
assert(productPlanFromRow(trialing) === "free", "註冊帳號 product plan 仍是 free");
assert(effectivePlanFromRow(trialing) === "plus", "試用中 effective_plan = plus");
assert(subscriptionStatusFromRow(trialing) === "none", "試用中尚無付費訂閱");
assert(publicMembership(trialing).plusTrialActive === true, "publicMembership plusTrialActive");

assert(isTrialActive(expired) === false, "到期後試用結束");
assert(plusTrialActive(expired) === false, "到期後 plusTrialActive false");
assert(productPlanFromRow(expired) === "free", "到期後 plan = free");
assert(effectivePlanFromRow(expired) === "free", "到期後 effective_plan = free");
assert(isEntitled(expired) === false, "到期未付費不是 PLUS");
assert(isPaid(expired) === false, "到期未付費不是 paid");
assert(plusTrialUsed(expired) === true, "舊帳號試用已用過，不可重置");
assert(effectivePlanFromRow(expired) === "free", "過期 trial 不重送 7 天");

const legacyThirty = {
  status: "trialing",
  plan: "monthly",
  is_paid: false,
  trial_started_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  trial_ends_at: new Date(Date.now() + 20 * 86400000).toISOString(),
};
assert(isTrialActive(legacyThirty) === true, "既有 30 天 trial_ends_at 仍有效");
assert(effectivePlanFromRow(legacyThirty) === "plus", "舊 30 天 trial 不因程式改 7 天被縮短");

assert(isPaid(paid) === true, "付費帳號 isPaid");
assert(effectivePlanFromRow(paid) === "plus", "付費帳號 effective plus");
assert(productPlanFromRow(paid) === "plus", "付費帳號 product plus");
assert(subscriptionStatusFromRow(paid) === "active", "付費 subscription active");
assert(billingIntervalFromRow(paid) === "monthly", "付費帳號沿用既有 interval");
assert(effectivePlanFromRow(paid) !== "free", "不可把已付款帳號降成 FREE");

const legacyQuarter = { ...paid, plan: "quarter" };
assert(billingIntervalFromRow(legacyQuarter) === "quarter", "舊季繳 interval 相容保留");
assert(effectivePlanFromRow(legacyQuarter) === "plus", "舊季繳仍是 PLUS");

const internalExpired = {
  status: "expired",
  plan: "monthly",
  is_paid: false,
  trial_started_at: "2026-01-01T00:00:00.000Z",
  trial_ends_at: past,
  access_type: "internal",
};
assert(isPaid(internalExpired) === false, "internal 不是假付款");
assert(plusTrialActive(internalExpired) === false, "internal 不走 trial");
assert(effectivePlanFromRow(internalExpired) === "plus", "internal 永久 effective plus");
assert(isEntitled(internalExpired) === true, "internal 解鎖 PLUS");
assert(publicMembership(internalExpired).isInternal === true, "membership 標記 isInternal");
assert(publicMembership(internalExpired).access_type === "internal", "publicMembership 帶 access_type");
assert(publicMembership(internalExpired).accessType === "internal", "publicMembership 帶 accessType");
assert(publicMembership(internalExpired).plusTrialActive === false, "internal 不顯示 trial");
assert(publicMembership(internalExpired).daysLeft == null, "internal 無剩餘天數");
assert(publicMembership(internalExpired).paid === false, "internal 不是 paid");
assert(publicMembership(internalExpired).status === "internal", "internal 公開狀態");
assert(subscriptionStatusFromRow(internalExpired) === "internal", "internal subscription status");
assert(productPlanFromRow(internalExpired) === "plus", "internal product plan 是 plus");
assert(publicMembership(internalExpired).effectivePlan === "plus", "internal effectivePlan plus");

const internalTrialing = { ...trialing, access_type: "internal" };
assert(plusTrialActive(internalTrialing) === false, "internal 即使 trial 日期未到也不算 trial");
assert(effectivePlanFromRow(internalTrialing) === "plus", "internal trialing 仍是 plus");
assert(isPaid(internalTrialing) === false, "internal trialing 不是付款");

const internalPaid = { ...paid, access_type: "internal" };
assert(isPaid(internalPaid) === true, "真的付過款的 internal 仍可讀 is_paid");
assert(publicMembership(internalPaid).paid === true, "不把真實付款改成 false");
assert(subscriptionStatusFromRow(internalPaid) === "active", "付費 internal 仍是 active subscription");

process.env.NICHI_INTERNAL_USER_IDS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
process.env.NICHI_INTERNAL_EMAILS = "internal@example.com";
assert(isInternalAllowlisted("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA") === true, "server allowlist 認 uuid");
assert(isInternalAllowlisted("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") === false, "不在 allowlist 不是 internal");
assert(isInternalAllowlisted("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "internal@example.com") === true, "server allowlist 認 email");
delete process.env.NICHI_INTERNAL_USER_IDS;
delete process.env.NICHI_INTERNAL_EMAILS;

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const chat = fs.readFileSync(path.join(root, "api/chat.js"), "utf8");
const report = fs.readFileSync(path.join(root, "api/generate-report.js"), "utf8");

assert(html.includes("ING FREE") && html.includes("ING PLUS"), "方案頁兩張卡");
assert(!html.includes("標準版") && !html.includes("進階超值版"), "舊方案名稱已移除");
assert(!html.includes("$599") && !html.includes("$1,197"), "舊價格已移除");
assert(html.includes("NT$149") && html.includes("NT$1,290"), "新價格");
assert(html.includes("最推薦"), "年繳標示最推薦");
assert(html.includes("plusEndedModal"), "非阻斷到期提醒");
assert(html.includes("繼續使用 FREE") && html.includes("查看 PLUS"), "到期提醒按鈕");
assert(!html.includes("js-lock-expired"), "不再有阻擋式到期付費牆");
assert(app.includes("return \"\";") || /function accessLockMode\(\) \{[\s\S]{0,220}return "";/.test(app), "登入後不因試用到期鎖 App");
assert(!review.includes("paywall: true") && !chat.includes("paywall: true") && !report.includes("paywall: true"), "API 不再用 402 鎖整個功能");
assert(review.includes("enforcePlusEntitlement") && chat.includes("enforcePlusEntitlement") && report.includes("enforcePlusEntitlement"), "PLUS AI 後端改回 plus_required");
const entitlement = fs.readFileSync(path.join(root, "lib/entitlement.js"), "utf8");
assert(entitlement.includes("status(403)") && entitlement.includes("plus_required"), "FREE 呼叫 PLUS API 回 403");
assert(entitlement.includes("membership_check_failed") && entitlement.includes("status(503)"), "無法確認 membership 回 5xx");
assert(app.includes("maybeShowPlusEndedNotice"), "到期只提醒一次");
assert(app.includes("dismissPlusEndedNotice"), "提醒可關閉且不再每次登入跳出");
assert(app.includes("membership.accessType || membership.access_type"), "前端同時讀 camelCase / snake_case");
assert(app.includes("status === \"internal\""), "前端也認 status=internal");
assert(app.includes("ING PLUS｜內部帳號"), "側欄／方案頁內部文案");
assert(!app.includes(".from(\"nichi_internal_users\")"), "前端不讀寫內部表");
assert(!/INTERNAL_PLUS_EMAILS|internalEmails|INTERNAL_EMAILS/.test(app), "前端沒有 email allowlist");
assert(html.includes("analytics.js?v=4"), "analytics cache 已升版");
assert(html.includes("pricingInterestCta") && html.includes("我想升級 PLUS"), "方案頁有升級意願 CTA");
const supabaseSrc = fs.readFileSync(path.join(root, "lib/supabase.js"), "utf8");
assert(supabaseSrc.includes("TRIAL_DAYS = 7"), "一般新使用者是 7 天 trial");
assert(supabaseSrc.includes("既有列的 trial_ends_at 不重算"), "既有 trial 日期不重算");
assert(supabaseSrc.includes("nichi_internal_users"), "後端用獨立內部表");
assert(supabaseSrc.includes("NICHI_INTERNAL_USER_IDS"), "PostgREST cache miss 時有 server allowlist");
assert(supabaseSrc.includes("lookupInternalViaPgQuery"), "嘗試繞過 PostgREST schema cache");
assert(supabaseSrc.includes(".from(INTERNAL_TABLE)"), "後端直接查 nichi_internal_users");
assert(!/access_type:\s*"internal"[\s\S]{0,80}is_paid:\s*true/.test(supabaseSrc), "internal overlay 不寫 is_paid");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260827_internal_plus.sql"), "utf8");
assert(migration.includes("create table if not exists public.nichi_internal_users"), "migration 建立內部表");
assert(migration.includes("revoke all on public.nichi_internal_users"), "一般使用者不能自封 internal");
assert(migration.includes("nichi_internal_users_service_all"), "service_role 有 RLS policy");
assert(migration.includes("nichi_is_internal_user"), "migration 含 SECURITY DEFINER 函式");
assert(migration.includes("nichi_user_data"), "migration 註明不改日記資料");
assert(!/on public\.analytics_events/.test(migration), "internal migration 不對 analytics_events 建 policy");
const analyticsClient = fs.readFileSync(path.join(root, "analytics.js"), "utf8");
assert(analyticsClient.includes("getIsInternal"), "前端追蹤略過 internal");
assert(analyticsClient.includes("plus_offer_viewed") && analyticsClient.includes("plus_plan_viewed") && analyticsClient.includes("plus_interest_clicked"), "PLUS 轉換事件");
assert(app.includes("plus_offer_viewed") && app.includes("plus_plan_viewed") && app.includes("plus_interest_clicked"), "前端會送 PLUS 轉換事件");
assert(app.includes("daysLeft: 5"), "localhost trial 模擬剩餘 1～7 天");
assert(app.includes("onPlusInterestClick"), "方案頁意願 CTA 不走付款");
const interestFn = app.slice(app.indexOf("function onPlusInterestClick"), app.indexOf("function startNewebPay"));
assert(interestFn.includes("plus_interest_clicked"), "點擊記錄 plus_interest_clicked");
assert(!interestFn.includes("startNewebPay") && !interestFn.includes("NEWEBPAY"), "意願 CTA 不進藍新");
const plusMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260827_plus_conversion_events.sql"), "utf8");
assert(plusMigration.includes("plus_offer_viewed") && plusMigration.includes("to_regclass('public.analytics_events')"), "PLUS 事件 migration 僅在表存在時改 CHECK");
const adminHtml = fs.readFileSync(path.join(root, "admin/analytics.html"), "utf8");
assert(adminHtml.includes("PLUS 轉換") && adminHtml.includes("plusFunnelList"), "後台有 PLUS 轉換區塊");
const adminJs = fs.readFileSync(path.join(root, "admin/analytics.js"), "utf8");
assert(adminJs.includes("renderPlusConversion") && adminJs.includes("plusConversion"), "後台渲染 unique users 漏斗");
const payCreate = fs.readFileSync(path.join(root, "api/pay/create.js"), "utf8");
assert(payCreate.includes("isInternal") && payCreate.includes("內部帳號無需付款"), "internal 不走付款");
const meApi = fs.readFileSync(path.join(root, "api/auth/me.js"), "utf8");
assert(meApi.includes("membership.isInternal"), "auth/me 不把 internal 算進 conversion");
assert(meApi.includes("decorateInternalAccess"), "auth/me 強制 overlay internal");

console.log("membership plan tests passed");
