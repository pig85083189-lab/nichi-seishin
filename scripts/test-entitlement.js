const fs = require("fs");
const path = require("path");
const {
  canUseFeature,
  isPlusPlan,
  plusRequiredPayload,
  featureForReviewRequest,
  featureForReportType,
} = require("../lib/entitlement");
const { effectivePlanFromRow, plusTrialActive } = require("../lib/supabase");
const { buildFreeReportSummary } = require("../lib/report-stats");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function trialRow(day, durationDays = 7) {
  const elapsed = (day - 1) * 86400000 + 60 * 1000;
  const started = Date.now() - elapsed;
  const ends = started + durationDays * 86400000;
  const active = Date.now() < ends;
  return {
    status: active ? "trialing" : "expired",
    plan: "monthly",
    is_paid: false,
    trial_started_at: new Date(started).toISOString(),
    trial_ends_at: new Date(ends).toISOString(),
  };
}

const plusFeatures = [
  "deep_journal",
  "think_ai",
  "awareness_ai",
  "execution_ai",
  "manifest_ai",
  "body_ai",
  "insight_ai",
  "weekly_report_full",
  "monthly_report_full",
  "long_term_insight",
];

const day1 = trialRow(1);
assert(effectivePlanFromRow(day1) === "plus", "CASE 1：trial Day 1 effective plus");
assert(plusTrialActive(day1), "CASE 1：trial Day 1 plusTrialActive");
plusFeatures.forEach((feature) => {
  assert(canUseFeature("plus", feature) === true, `CASE 1：plus 可使用 ${feature}`);
});

const day7 = trialRow(7);
assert(effectivePlanFromRow(day7) === "plus", "CASE 2：新 trial Day 7 仍是 plus");
plusFeatures.forEach((feature) => {
  assert(canUseFeature(effectivePlanFromRow(day7), feature) === true, `CASE 2：Day 7 可使用 ${feature}`);
});

const day8 = trialRow(8);
assert(effectivePlanFromRow(day8) === "free", "CASE 3：新 trial Day 8 unpaid → free");
assert(canUseFeature("free", "think_ai") === false, "CASE 3：FREE 不能用 PLUS AI");
assert(canUseFeature("free", "unknown_free_feature") === true, "CASE 3：未列為 PLUS 的功能仍可用");

const legacyDay29 = trialRow(29, 30);
assert(effectivePlanFromRow(legacyDay29) === "plus", "既有 30 天 trial Day 29 仍 plus，不因程式改 7 天而縮短");
assert(plusTrialActive(legacyDay29), "既有 30 天 trial_ends_at 仍有效");

const payload = plusRequiredPayload("think_ai");
assert(payload.error === "plus_required", "CASE 3／8：權限狀態是 plus_required");
assert(payload.message === "This feature requires ING PLUS.", "CASE 3／8：產品權限訊息");
assert(!/402|沒有權限|trial expired/i.test(JSON.stringify(payload)), "不要把 trial 到期當成技術錯誤");

const monthly = {
  status: "active",
  plan: "monthly",
  is_paid: true,
  trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
};
const yearly = { ...monthly, plan: "yearly" };
const quarter = { ...monthly, plan: "quarter" };
assert(effectivePlanFromRow(monthly) === "plus", "CASE 5：月繳 PLUS");
assert(effectivePlanFromRow(yearly) === "plus", "CASE 6：年繳 PLUS");
assert(effectivePlanFromRow(quarter) === "plus", "CASE 7：舊季繳仍是 PLUS");
assert(isPlusPlan("plus") && !isPlusPlan("free"), "plan 正規化");

const internalExpired = {
  status: "expired",
  plan: "monthly",
  is_paid: false,
  trial_ends_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  access_type: "internal",
};
assert(effectivePlanFromRow(internalExpired) === "plus", "internal 到期 trial 仍是 plus");
assert(plusTrialActive(internalExpired) === false, "internal 不走 trial");
plusFeatures.forEach((feature) => {
  assert(canUseFeature(effectivePlanFromRow(internalExpired), feature) === true, `internal 可使用 ${feature}`);
});

assert(featureForReviewRequest({ mode: "bodycoach" }) === "body_ai", "bodycoach → body_ai");
assert(featureForReviewRequest({ mode: "choices", kind: "awareness" }) === "awareness_ai", "awareness choices");
assert(featureForReviewRequest({ mode: "choices", kind: "execution" }) === "execution_ai", "execution choices");
assert(featureForReviewRequest({ mode: "insight" }) === "think_ai", "insight → think_ai");
assert(featureForReportType("month") === "monthly_report_full", "month report feature");
assert(featureForReportType("week") === "weekly_report_full", "week report feature");

const stats = buildFreeReportSummary({
  fromIso: "2026-08-17",
  toIso: "2026-08-23",
  reviews: {
    "2026-08-17": {
      completedAt: "2026-08-17T12:00:00.000Z",
      journal: { thanksText: "謝謝陽光\n謝謝一杯水", mood: "平靜", bodyCheck: { body: { flags: ["肩頸"] } } },
    },
    "2026-08-18": {
      journal: { thanksText: "謝謝自己", mood: "平靜" },
    },
  },
});
assert(stats.recordedDays === 2, "FREE 週報可統計記錄天數");
assert(stats.thanksItems === 3, "FREE 週報可統計感謝件數");
assert(stats.moodRecords === 2, "FREE 週報可統計心情次數");
assert(stats.bodyRecords === 1, "FREE 週報可統計身體覺察");
assert(stats.topMood === "平靜", "FREE 週報可顯示最常心情");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const chat = fs.readFileSync(path.join(root, "api/chat.js"), "utf8");
const report = fs.readFileSync(path.join(root, "api/generate-report.js"), "utf8");

assert(html.includes("plusUpgradeModal"), "CASE 3：PLUS Upgrade Modal");
assert(html.includes("這是 ING PLUS 的深度覺察功能"), "Upgrade Modal 標題");
assert(html.includes("先繼續記錄") && html.includes("查看 ING PLUS"), "Upgrade Modal 按鈕");
assert(html.includes("lib/entitlement.js"), "共用 entitlement 腳本");
assert(app.includes("function canUsePlusFeature") && app.includes("function ensurePlusFeature"), "前端共用 entitlement");
assert(app.includes("openPlusUpgradeModal"), "前端收到 plus_required 開 modal");
assert(!app.includes("你沒有權限"), "不要顯示生硬權限文字");
assert(html.includes("每日快速復盤") && html.includes("基礎週報"), "方案頁 FREE 功能");
assert(html.includes("完整週報與月報") && html.includes("長期個人模式與歷史洞察"), "方案頁 PLUS 功能");
assert(html.includes("覺察力／執行力 AI"), "方案頁 PLUS 為覺察力／執行力 AI");
assert(!html.includes("覺察力／執行力／顯化力 AI"), "方案頁不再介紹已下架的顯化力");
assert(html.includes("NT$149") && html.includes("NT$1,290"), "價格保留");
assert(html.includes("7 天 ING PLUS 完整體驗"), "7 天體驗文案");
assert(html.includes("我想升級 PLUS") && html.includes("pricingInterestCta"), "Beta 升級意願 CTA");

assert(review.includes("enforcePlusEntitlement") && review.includes("featureForReviewRequest"), "CASE 8：review API 後端檢查");
assert(chat.includes("enforcePlusEntitlement") && chat.includes("think_ai"), "CASE 8：chat API 後端檢查");
assert(report.includes("enforcePlusEntitlement") && report.includes("featureForReportType"), "CASE 8：generate-report POST 檢查");
assert(report.includes("readOnly || req.method === \"GET\""), "GET 讀取既有週月報不擋 FREE");
assert(report.includes("reason: \"plus_required\""), "cron 跳過非 PLUS 使用者，不刪資料");
assert(app.includes("fetchStoredCloudReport"), "CASE 4：FREE 仍可讀既有雲端報告");
assert(app.includes("reportHasAiContent"), "CASE 4：既有 AI 報告可繼續顯示");
assert(app.includes("renderFreeReportFacts") && app.includes("解鎖完整週報"), "FREE 基礎週報 + PLUS 區塊");
assert(app.includes("本月已記錄") || app.includes("本月紀錄"), "FREE 月報基本統計");
assert(app.includes("這個區間還沒有紀錄"), "FREE 週報 empty state");
assert(!html.includes("標準版") && !html.includes("進階超值版"), "方案頁無舊方案名");
assert(!html.includes("$599") && !html.includes("$1,197"), "方案頁無舊價格");
assert(html.includes("方案準備中"), "付款 CTA 尚未對應新價格");
assert(app.includes("NEWEBPAY_CHECKOUT_ENABLED = false"), "不把使用者送去舊金流金額");
assert(app.includes("ingPlan") && app.includes("function readDevPlanOverride"), "localhost UI 模擬");
assert(app.includes('addEventListener("close"') && app.includes("dismissPlusEndedNotice"), "trial 結束提醒關閉後標記已看過");
assert(app.includes("data-plus-upgrade"), "完整週月報 CTA 開 Upgrade Modal");
assert(app.includes("目前暫時無法確認會員狀態，請稍後再試。"), "membership 查詢失敗不開付費 modal");
assert(review.includes("enforcePlusEntitlement") && chat.includes("enforcePlusEntitlement"), "PLUS API 共用 fail-closed");

const {
  isLocalDevRuntime,
  isBrowserLocalHost,
  membershipCheckFailedPayload,
  enforcePlusEntitlement,
} = require("../lib/entitlement");

assert(isLocalDevRuntime({ VERCEL_ENV: "production" }) === false, "Production 不是 local dev");
assert(isLocalDevRuntime({ VERCEL_ENV: "preview" }) === false, "Preview 不是 local dev");
assert(isLocalDevRuntime({ VERCEL_ENV: "development" }) === true, "vercel dev 是 local");
assert(isBrowserLocalHost("localhost") === true, "localhost 可模擬 UI");
assert(isBrowserLocalHost("growth-ing.com") === false, "正式網址不可用 URL 切方案");
assert(membershipCheckFailedPayload().error === "membership_check_failed", "查詢失敗錯誤碼");

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

(async () => {
  const prodDenied = mockRes();
  const prodOk = await enforcePlusEntitlement({
    feature: "think_ai",
    res: prodDenied,
    supabaseReady: false,
    env: { VERCEL_ENV: "production" },
  });
  assert(prodOk === false && prodDenied.statusCode === 503, "Production 無法確認時 fail-closed");
  assert(prodDenied.body.error === "membership_check_failed", "系統錯誤不是 plus_required");

  const freeDenied = mockRes();
  const freeOk = await enforcePlusEntitlement({
    feature: "think_ai",
    res: freeDenied,
    supabaseReady: true,
    loadPlan: async () => "free",
  });
  assert(freeOk === false && freeDenied.statusCode === 403, "確定 FREE 回 403");
  assert(freeDenied.body.error === "plus_required", "FREE 才是 plus_required");

  const failed = mockRes();
  const failedOk = await enforcePlusEntitlement({
    feature: "think_ai",
    res: failed,
    supabaseReady: true,
    loadPlan: async () => {
      throw new Error("db down");
    },
  });
  assert(failedOk === false && failed.statusCode === 503, "查詢失敗回 5xx");
  assert(failed.body.error === "membership_check_failed", "查詢失敗不是叫人付費");

  const plusRes = mockRes();
  const plusOk = await enforcePlusEntitlement({
    feature: "think_ai",
    res: plusRes,
    supabaseReady: true,
    loadPlan: async () => "plus",
  });
  assert(plusOk === true, "PLUS 可通過");

  console.log("entitlement tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
