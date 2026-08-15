const {
  getSubscriptionByOrderNo,
  getSubscriptionByPeriodNo,
  patchSubscription,
  insertBillingEvent,
  isTrialActive,
} = require("../../lib/supabase");
const { newebpayConfigured, decryptPayNotify, parseFormBody, readRequestBody } = require("../../lib/newebpay");

function resultFromPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.Result && typeof payload.Result === "object") return payload.Result;
  return payload;
}

function isSuccess(payload, result) {
  const status = String(payload.Status || "").toUpperCase();
  const respond = String(result.RespondCode || "").trim();
  if (status !== "SUCCESS") return false;
  return !respond || respond === "00";
}

function isRecurringDebit(result) {
  return Boolean(result.AlreadyTimes || result.AuthDate || result.OrderNo || result.NextAuthDate);
}

function nextChargeDate(result) {
  const next = String(result.NextAuthDate || "").trim();
  if (next) return next.slice(0, 10);
  const dateArray = String(result.DateArray || "").trim();
  if (!dateArray) return "";
  const today = new Date().toISOString().slice(0, 10);
  const dates = dateArray
    .split(",")
    .map((item) => item.trim().slice(0, 10))
    .filter(Boolean);
  return dates.find((item) => item > today) || dates[dates.length - 1] || "";
}

async function applyNotify(payload) {
  const result = resultFromPayload(payload);
  const orderNo = String(result.MerchantOrderNo || result.MerOrderNo || "").trim();
  const periodNo = String(result.PeriodNo || "").trim();
  const tradeNo = String(result.TradeNo || "").trim();
  const amt = Number(result.PeriodAmt || result.AuthAmt || result.Amt);
  const success = isSuccess(payload, result);
  const debit = isRecurringDebit(result);
  const alterType = String(result.AlterType || "").toLowerCase();
  const message = String(payload.Message || "").trim();

  let row = orderNo ? await getSubscriptionByOrderNo(orderNo) : null;
  if (!row && periodNo) row = await getSubscriptionByPeriodNo(periodNo);
  if (!row) {
    console.log("NewebPay notify: no subscription for", orderNo, periodNo);
    return;
  }

  let eventType = debit ? (success ? "debit" : "debit_fail") : success ? "authorize" : "debit_fail";
  if (alterType === "terminate" || alterType === "cancel" || /終止|取消/.test(message)) eventType = "cancel";
  else if (alterType === "suspend" || /暫停/.test(message)) eventType = "cancel";

  const recorded = await insertBillingEvent({
    user_id: row.user_id,
    merchant_order_no: orderNo || row.merchant_order_no,
    period_no: periodNo || row.period_no,
    trade_no: tradeNo,
    event_type: eventType,
    status: String(payload.Status || ""),
    amount: Number.isFinite(amt) ? Math.round(amt) : row.amount,
    payload,
  });
  if (recorded.duplicate) {
    console.log("NewebPay notify duplicate trade:", tradeNo);
    return;
  }

  const patch = {};
  if (orderNo) patch.merchant_order_no = orderNo;
  if (periodNo) patch.period_no = periodNo;
  if (Number.isFinite(amt) && amt > 0) patch.amount = Math.round(amt);
  patch.last_message = message.slice(0, 200);

  if (eventType === "cancel") {
    patch.status = "cancelled";
    patch.cancelled_at = new Date().toISOString();
  } else if (success) {
    patch.status = "active";
    if (tradeNo) patch.last_trade_no = tradeNo;
    if (debit || tradeNo) patch.last_charge_at = new Date().toISOString();
    const next = nextChargeDate(result);
    if (next) patch.next_charge_at = next;
  } else if (row.status === "active" || debit) {
    patch.status = "past_due";
  } else if (row.status === "pending") {
    patch.status = isTrialActive(row) ? "trialing" : "expired";
  }

  await patchSubscription(row.user_id, patch);
  console.log("NewebPay notify applied:", eventType, orderNo, periodNo, row.user_id);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  if (!newebpayConfigured()) {
    res.status(501).send("NewebPay not configured");
    return;
  }

  try {
    const body = parseFormBody(await readRequestBody(req));
    const payload = decryptPayNotify(body);
    await applyNotify(payload);
    res.status(200).send("OK");
  } catch (error) {
    console.error("NewebPay notify error:", error.message || error);
    res.status(400).send("FAIL");
  }
};
