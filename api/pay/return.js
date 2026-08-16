const {
  decryptPayNotify,
  parseFormBody,
  readRequestBody,
  newebpayConfigured,
  PRODUCTION_ORIGIN,
  formatPeriodFail,
  parsePeriodGatewayError,
} = require("../../lib/newebpay");

function failUrl(code, message) {
  const params = new URLSearchParams();
  params.set("pay", "fail");
  if (code) params.set("code", String(code).slice(0, 40));
  params.set("reason", String(message || "訂閱未完成").slice(0, 300));
  return `${PRODUCTION_ORIGIN}/?${params.toString()}`;
}

function okUrl(orderNo) {
  const params = new URLSearchParams();
  params.set("pay", "ok");
  if (orderNo) params.set("order", orderNo);
  return `${PRODUCTION_ORIGIN}/?${params.toString()}`;
}

function extractRawError(body, rawText) {
  if (body && typeof body === "object") {
    const status = String(body.Status || body.status || "").trim();
    const message = String(body.Message || body.message || body.msg || "").trim();
    if (status || message) {
      return formatPeriodFail({ Status: status, Message: message, Result: body.Result || body });
    }
  }
  return parsePeriodGatewayError(rawText);
}

module.exports = async function handler(req, res) {
  const home = PRODUCTION_ORIGIN;
  if (req.method === "GET") {
    res.redirect(302, `${home}/?pay=back`);
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  if (!newebpayConfigured()) {
    res.redirect(302, failUrl("", "尚未設定藍新金流"));
    return;
  }

  const raw = await readRequestBody(req);
  const body = parseFormBody(raw);
  const rawText = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "");
  console.log("NewebPay MPG return body keys:", Object.keys(body || {}));

  try {
    const payload = decryptPayNotify(body);
    const fail = formatPeriodFail(payload);
    const result = payload.Result && typeof payload.Result === "object" ? payload.Result : payload;
    const orderNo = String(result.MerchantOrderNo || result.MerOrderNo || "").trim();
    console.log("NewebPay MPG return payload:", {
      Status: payload.Status,
      Message: payload.Message,
      Result: result,
    });
    if (String(payload.Status || "").toUpperCase() === "SUCCESS") {
      res.redirect(302, okUrl(orderNo));
      return;
    }
    res.redirect(302, failUrl(fail.code, fail.message));
  } catch (error) {
    const fallback = extractRawError(body, rawText);
    const message = fallback
      ? fallback.message
      : String(error && error.message ? error.message : "訂閱結果驗證失敗");
    const code = fallback && fallback.code ? fallback.code : "";
    console.error("NewebPay MPG return error:", {
      message,
      code,
      detail: fallback && fallback.detail ? fallback.detail : "",
      decryptError: error && error.message ? error.message : String(error),
    });
    res.redirect(302, failUrl(code, message));
  }
};
