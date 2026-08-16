const { getSession, bearerToken } = require("../../lib/auth");
const { ensureTrial, patchSubscription } = require("../../lib/supabase");
const {
  newebpayConfigured,
  newebpayConfigStatus,
  createOrderNo,
  mpgAmt,
  mpgItemDesc,
  buildMpgTradeParams,
  mpgFormFields,
  mpgAutoSubmitHtml,
  mpgGateway,
  notifyUrl,
  readRequestBody,
} = require("../../lib/newebpay");

function parseJsonValue(raw) {
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

async function readJsonBody(req) {
  const parsed = parseJsonValue(req.body);
  if (parsed && Object.keys(parsed).length) return parsed;
  const raw = await readRequestBody(req);
  return parseJsonValue(raw);
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
    console.error("NewebPay not configured:", newebpayConfigStatus());
    res.status(501).json({
      ok: false,
      error: "尚未設定藍新金流。請在 Vercel 加上 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY（32 碼）與 NEWEBPAY_HASH_IV（16 碼）。",
    });
    return;
  }

  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const extra = { accessToken: body.accessToken || body.token };
  const user = await getSession(req, extra);
  if (!user) {
    const hasToken = Boolean(bearerToken(req, extra));
    res.status(401).json({
      ok: false,
      error: hasToken ? "登入已過期，請重新登入後再付款" : "請先登入",
    });
    return;
  }

  let sub;
  try {
    sub = await ensureTrial(user);
  } catch (error) {
    const message = String(error && error.message ? error.message : "無法建立試用紀錄");
    res.status(500).json({ ok: false, error: message });
    return;
  }
  if (!sub) {
    res.status(500).json({ ok: false, error: "尚未設定 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_SECRET_KEY" });
    return;
  }
  if (sub.status === "active") {
    res.status(409).json({ ok: false, error: "你已經付款完成" });
    return;
  }
  if (!user.email) {
    res.status(400).json({ ok: false, error: "這個帳號沒有 Email，藍新一次付清需要付款人信箱" });
    return;
  }

  const amt = mpgAmt();
  const itemDesc = mpgItemDesc(body.itemDesc);
  const orderNo = createOrderNo().replace(/[^A-Za-z0-9_]/g, "").slice(0, 30);
  let tradeParams;
  try {
    tradeParams = buildMpgTradeParams({
      orderNo,
      email: user.email,
      itemDesc,
    });
  } catch (error) {
    console.error("NewebPay MPG params invalid:", error && error.message ? error.message : error);
    res.status(400).json({ ok: false, error: String(error && error.message ? error.message : "藍新一次付清參數不完整") });
    return;
  }
  console.log("NewebPay MPG assembled payload:", tradeParams);

  let saved;
  try {
    saved = await patchSubscription(user.id, {
      status: "pending",
      email: user.email,
      amount: amt,
      merchant_order_no: orderNo,
    });
  } catch (error) {
    console.error("NewebPay patchSubscription failed:", error && error.message ? error.message : error);
    res.status(500).json({ ok: false, error: String(error && error.message ? error.message : "無法寫入付款訂單") });
    return;
  }
  if (!saved) {
    res.status(500).json({ ok: false, error: "無法寫入付款訂單，請稍後再試" });
    return;
  }

  let fields;
  try {
    fields = mpgFormFields(tradeParams);
  } catch (error) {
    console.error("NewebPay encrypt failed:", error && error.message ? error.message : error, newebpayConfigStatus());
    res.status(500).json({ ok: false, error: "藍新參數加密失敗，請確認 HASH_KEY 為 32 碼、HASH_IV 為 16 碼。" });
    return;
  }
  const payStatus = newebpayConfigStatus();
  console.log("NewebPay MPG created:", {
    orderNo,
    env: payStatus.env,
    production: payStatus.production,
    gateway: payStatus.gateway,
    merchantId: payStatus.merchantId,
    notifyUrl: notifyUrl(),
    version: tradeParams.Version,
    amt: tradeParams.Amt,
    formKeys: Object.keys(fields),
    hasMerchantId: Boolean(fields.MerchantID),
    hasTradeInfo: Boolean(fields.TradeInfo),
    hasTradeSha: Boolean(fields.TradeSha),
  });

  if (wantsJson(req)) {
    res.status(200).json({
      ok: true,
      gateway: mpgGateway(),
      orderNo,
      fields,
    });
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(mpgAutoSubmitHtml(fields));
};
