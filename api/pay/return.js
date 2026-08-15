const { decryptPayNotify, parseFormBody, readRequestBody, newebpayConfigured, PRODUCTION_ORIGIN } = require("../../lib/newebpay");

function resultFromPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.Result && typeof payload.Result === "object") return payload.Result;
  return payload;
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
    res.redirect(302, `${home}/?pay=error&reason=${encodeURIComponent("尚未設定藍新金流")}`);
    return;
  }

  try {
    const body = parseFormBody(await readRequestBody(req));
    const payload = decryptPayNotify(body);
    const status = String(payload.Status || "").toUpperCase();
    const result = resultFromPayload(payload);
    const orderNo = String(result.MerchantOrderNo || result.MerOrderNo || "").trim();
    if (status === "SUCCESS") {
      res.redirect(302, `${home}/?pay=ok${orderNo ? `&order=${encodeURIComponent(orderNo)}` : ""}`);
      return;
    }
    const reason = String(payload.Message || status || "訂閱未完成").slice(0, 80);
    res.redirect(302, `${home}/?pay=fail&reason=${encodeURIComponent(reason)}`);
  } catch (error) {
    res.redirect(302, `${home}/?pay=error&reason=${encodeURIComponent(String(error.message || "訂閱結果驗證失敗").slice(0, 80))}`);
  }
};
