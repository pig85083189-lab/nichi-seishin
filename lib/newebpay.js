const crypto = require("crypto");

const PRODUCTION_ORIGIN = "https://nichi-seishin.vercel.app";
const VERSION = "2.0";
const AES_BLOCK = 32;

function merchantId() {
  return String(process.env.NEWEBPAY_MERCHANT_ID || "").trim();
}

function hashKey() {
  return String(process.env.NEWEBPAY_HASH_KEY || "").trim();
}

function hashIV() {
  return String(process.env.NEWEBPAY_HASH_IV || "").trim();
}

function isProduction() {
  const env = String(process.env.NEWEBPAY_ENV || process.env.NEWEBPAY_MODE || "test").trim().toLowerCase();
  return env === "prod" || env === "production" || env === "live";
}

function mpgGateway() {
  return isProduction()
    ? "https://core.newebpay.com/MPG/mpg_gateway"
    : "https://ccore.newebpay.com/MPG/mpg_gateway";
}

function newebpayConfigured() {
  const key = hashKey();
  const iv = hashIV();
  return Boolean(merchantId() && key.length === 32 && iv.length === 16);
}

function notifyUrl() {
  return `${PRODUCTION_ORIGIN}/api/pay/notify`;
}

function returnUrl() {
  return `${PRODUCTION_ORIGIN}/api/pay/return`;
}

function clientBackUrl() {
  return `${PRODUCTION_ORIGIN}/`;
}

function defaultAmt() {
  const amt = Number(process.env.NEWEBPAY_AMT || 100);
  if (!Number.isFinite(amt) || amt < 1) return 100;
  return Math.min(Math.round(amt), 9999999999);
}

function defaultItemDesc() {
  return String(process.env.NEWEBPAY_ITEM_DESC || "日精進").slice(0, 50);
}

function phpUrlencode(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E");
}

function httpBuildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${phpUrlencode(key)}=${phpUrlencode(value)}`)
    .join("&");
}

function addPadding(buffer) {
  const pad = AES_BLOCK - (buffer.length % AES_BLOCK);
  return Buffer.concat([buffer, Buffer.alloc(pad, pad)]);
}

function stripPadding(buffer) {
  if (!buffer.length) return buffer;
  const pad = buffer[buffer.length - 1];
  if (pad < 1 || pad > AES_BLOCK || pad > buffer.length) return buffer;
  return buffer.slice(0, buffer.length - pad);
}

function aesEncrypt(plain) {
  const cipher = crypto.createCipheriv("aes256", hashKey(), hashIV());
  cipher.setAutoPadding(false);
  const padded = addPadding(Buffer.from(String(plain), "utf8"));
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString("hex");
}

function aesDecrypt(hex) {
  const decipher = crypto.createDecipheriv("aes256", hashKey(), hashIV());
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(String(hex), "hex")),
    decipher.final(),
  ]);
  return stripPadding(decrypted).toString("utf8").replace(/\0+$/g, "");
}

function tradeSha(tradeInfo) {
  const raw = `HashKey=${hashKey()}&${tradeInfo}&HashIV=${hashIV()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").toUpperCase();
}

function encryptTradeInfo(params) {
  const tradeInfo = aesEncrypt(httpBuildQuery(params));
  return {
    tradeInfo,
    tradeSha: tradeSha(tradeInfo),
  };
}

function parseDecryptedTradeInfo(plain) {
  const text = String(plain || "").trim();
  if (!text) return {};
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  const out = {};
  new URLSearchParams(text).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function decryptNotify(tradeInfo, expectedSha) {
  const info = String(tradeInfo || "").trim();
  const sha = String(expectedSha || "").trim().toUpperCase();
  if (!info || !sha || tradeSha(info) !== sha) {
    throw new Error("TradeSha 驗證失敗");
  }
  return parseDecryptedTradeInfo(aesDecrypt(info));
}

function createOrderNo() {
  const rand = crypto.randomBytes(3).toString("hex");
  return `NS${Date.now()}${rand}`.slice(0, 30);
}

function mpgFormFields(tradeParams) {
  const { tradeInfo, tradeSha: sha } = encryptTradeInfo(tradeParams);
  return {
    MerchantID: merchantId(),
    TradeInfo: tradeInfo,
    TradeSha: sha,
    Version: VERSION,
    EncryptType: 0,
  };
}

function mpgAutoSubmitHtml(fields) {
  const action = mpgGateway();
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join("");
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>前往藍新金流</title>
  </head>
  <body>
    <p>正在前往藍新金流付款頁面…</p>
    <form id="newebpay" method="post" action="${escapeHtml(action)}">${inputs}</form>
    <script>document.getElementById("newebpay").submit();</script>
  </body>
</html>`;
}

const PERIOD_VERSION = "1.5";

function periodGateway() {
  return isProduction()
    ? "https://core.newebpay.com/MPG/period"
    : "https://ccore.newebpay.com/MPG/period";
}

function defaultPeriodAmt() {
  const amt = Number(process.env.NEWEBPAY_PERIOD_AMT || process.env.NEWEBPAY_AMT || 100);
  if (!Number.isFinite(amt) || amt < 1) return 100;
  return Math.min(Math.round(amt), 999999);
}

function defaultPeriodTimes() {
  const times = Number(process.env.NEWEBPAY_PERIOD_TIMES || 99);
  if (!Number.isFinite(times) || times < 1) return 99;
  return Math.min(Math.round(times), 99);
}

function periodProdDesc(text) {
  const cleaned = String(text || defaultItemDesc() || "日精進月費")
    .replace(/[^\u4e00-\u9fffA-Za-z0-9 _]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  return cleaned || "nichi_seishin";
}

function taipeiParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date instanceof Date ? date : new Date(date));
  const pick = (type) => {
    const found = parts.find((item) => item.type === type);
    return found ? found.value : "";
  };
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function taipeiYmd(date, sep = "/") {
  const { year, month, day } = taipeiParts(date);
  return `${year}${sep}${month}${sep}${day}`;
}

function formatPeriodFirstdate(date) {
  return taipeiYmd(date, "/");
}

function periodSchedule(trialEndsAt) {
  const now = new Date();
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : now;
  const firstdate = formatPeriodFirstdate(Number.isNaN(trialEnd.getTime()) ? now : trialEnd);
  const today = taipeiYmd(now, "/");
  if (firstdate > today) {
    return {
      PeriodType: "D",
      PeriodPoint: "30",
      PeriodStartType: "3",
      PeriodFirstdate: firstdate,
    };
  }
  return {
    PeriodType: "M",
    PeriodPoint: taipeiParts(now).day,
    PeriodStartType: "2",
  };
}

function periodPostFields(plainParams) {
  return {
    MerchantID_: merchantId(),
    PostData_: aesEncrypt(httpBuildQuery(plainParams)),
  };
}

function periodAutoSubmitHtml(fields) {
  const action = periodGateway();
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join("");
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>前往藍新金流定期定額</title>
  </head>
  <body>
    <p>正在前往藍新金流訂閱頁面…</p>
    <form id="newebpay" method="post" action="${escapeHtml(action)}">${inputs}</form>
    <script>document.getElementById("newebpay").submit();</script>
  </body>
</html>`;
}

function decryptPeriod(hex) {
  return parseDecryptedTradeInfo(aesDecrypt(String(hex || "").trim()));
}

function decryptPayNotify(body) {
  const period = String((body && (body.Period || body.period)) || "").trim();
  if (period) return decryptPeriod(period);
  const info = String((body && body.TradeInfo) || "").trim();
  const sha = String((body && body.TradeSha) || "").trim();
  if (info && sha) return decryptNotify(info, sha);
  if (info) return parseDecryptedTradeInfo(aesDecrypt(info));
  throw new Error("缺少 Period 或 TradeInfo");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseFormBody(raw) {
  if (raw && typeof raw === "object" && !Buffer.isBuffer(raw) && !Array.isArray(raw)) {
    return raw;
  }
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "");
  if (!text) return {};
  if (text.trim().startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  const out = {};
  new URLSearchParams(text).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function readRequestBody(req) {
  if (req.body != null && req.body !== "") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = {
  VERSION,
  PERIOD_VERSION,
  PRODUCTION_ORIGIN,
  merchantId,
  newebpayConfigured,
  isProduction,
  mpgGateway,
  periodGateway,
  notifyUrl,
  returnUrl,
  clientBackUrl,
  defaultAmt,
  defaultItemDesc,
  defaultPeriodAmt,
  defaultPeriodTimes,
  periodProdDesc,
  periodSchedule,
  formatPeriodFirstdate,
  encryptTradeInfo,
  decryptNotify,
  decryptPeriod,
  decryptPayNotify,
  createOrderNo,
  mpgFormFields,
  mpgAutoSubmitHtml,
  periodPostFields,
  periodAutoSubmitHtml,
  parseFormBody,
  readRequestBody,
};
