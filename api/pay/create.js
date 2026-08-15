const { getSession } = require("../../lib/auth");
const { ensureTrial, patchSubscription } = require("../../lib/supabase");
const {
  newebpayConfigured,
  PERIOD_VERSION,
  createOrderNo,
  defaultPeriodAmt,
  defaultPeriodTimes,
  periodProdDesc,
  periodSchedule,
  periodPostFields,
  periodAutoSubmitHtml,
  periodGateway,
  notifyUrl,
  returnUrl,
  clientBackUrl,
} = require("../../lib/newebpay");

function readJsonBody(req) {
  const raw = req.body;
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw;
  return {};
}

function wantsJson(req) {
  const accept = String(req.headers.accept || "");
  if (accept.includes("text/html")) return false;
  if (accept.includes("application/json")) return true;
  const type = String(req.headers["content-type"] || "");
  return type.includes("application/json");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "只接受 GET 或 POST" });
    return;
  }

  if (!newebpayConfigured()) {
    res.status(501).json({
      ok: false,
      error: "尚未設定 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY（32 碼）與 NEWEBPAY_HASH_IV（16 碼）",
    });
    return;
  }

  const user = await getSession(req);
  if (!user) {
    if (wantsJson(req)) {
      res.status(401).json({ ok: false, error: "請先登入" });
      return;
    }
    res.redirect(302, "/");
    return;
  }

  const sub = await ensureTrial(user);
  if (!sub) {
    res.status(500).json({ ok: false, error: "無法建立試用紀錄，請確認 SUPABASE_SERVICE_ROLE_KEY" });
    return;
  }
  if (sub.status === "active") {
    res.status(409).json({ ok: false, error: "你已經訂閱中" });
    return;
  }
  if (!user.email) {
    res.status(400).json({ ok: false, error: "這個帳號沒有 Email，藍新定期定額需要付款人信箱" });
    return;
  }

  const body = req.method === "POST" ? readJsonBody(req) : {};
  const amt = Number(body.amt || defaultPeriodAmt());
  if (!Number.isFinite(amt) || amt < 1) {
    res.status(400).json({ ok: false, error: "金額必須是正整數" });
    return;
  }
  const times = defaultPeriodTimes();
  const itemDesc = periodProdDesc(body.itemDesc);
  const orderNo = createOrderNo().replace(/[^A-Za-z0-9_]/g, "").slice(0, 30);
  const schedule = periodSchedule(sub.trial_ends_at);
  const tradeParams = {
    RespondType: "JSON",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    Version: PERIOD_VERSION,
    LangType: "zh-Tw",
    MerOrderNo: orderNo,
    ProdDesc: itemDesc,
    PeriodAmt: String(Math.round(amt)),
    PeriodType: schedule.PeriodType,
    PeriodPoint: schedule.PeriodPoint,
    PeriodStartType: schedule.PeriodStartType,
    PeriodTimes: String(times),
    PeriodMemo: "nichi_seishin",
    PayerEmail: user.email,
    EmailModify: 0,
    PaymentInfo: "N",
    OrderInfo: "N",
    NotifyURL: notifyUrl(),
    ReturnURL: returnUrl(),
    BackURL: clientBackUrl(),
  };
  if (schedule.PeriodFirstdate) tradeParams.PeriodFirstdate = schedule.PeriodFirstdate;

  const saved = await patchSubscription(user.id, {
    status: "pending",
    email: user.email,
    amount: Math.round(amt),
    merchant_order_no: orderNo,
    period_type: schedule.PeriodType,
    period_point: schedule.PeriodPoint,
    period_times: times,
    period_start_type: Number(schedule.PeriodStartType),
  });
  if (!saved) {
    res.status(500).json({ ok: false, error: "無法寫入訂閱訂單，請稍後再試" });
    return;
  }

  const fields = periodPostFields(tradeParams);
  console.log("NewebPay period created:", orderNo, "NotifyURL:", notifyUrl(), "schedule:", schedule);

  if (wantsJson(req)) {
    res.status(200).json({
      ok: true,
      gateway: periodGateway(),
      orderNo,
      fields,
    });
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(periodAutoSubmitHtml(fields));
};
