const {
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

assert(isPaid(paid) === true, "付費帳號 isPaid");
assert(effectivePlanFromRow(paid) === "plus", "付費帳號 effective plus");
assert(productPlanFromRow(paid) === "plus", "付費帳號 product plus");
assert(subscriptionStatusFromRow(paid) === "active", "付費 subscription active");
assert(billingIntervalFromRow(paid) === "monthly", "付費帳號沿用既有 interval");
assert(effectivePlanFromRow(paid) !== "free", "不可把已付款帳號降成 FREE");

const legacyQuarter = { ...paid, plan: "quarter" };
assert(billingIntervalFromRow(legacyQuarter) === "quarter", "舊季繳 interval 相容保留");
assert(effectivePlanFromRow(legacyQuarter) === "plus", "舊季繳仍是 PLUS");

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

console.log("membership plan tests passed");
