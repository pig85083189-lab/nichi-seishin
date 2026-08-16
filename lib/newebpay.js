const crypto = require("crypto");

const PRODUCTION_ORIGIN = "https://nichi-seishin.vercel.app";
const VERSION = "2.0";
const AES_BLOCK = 32;

function stripEnv(value) {
  let text = String(value || "").trim().replace(/^\uFEFF/, "").replace(/\r/g, "");
  if (
    (text.startsWith("\"") && text.endsWith("\"")) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function firstEnv(names) {
  for (const name of names) {
    const value = stripEnv(process.env[name]);
    if (value) return value;
  }
  return "";
}

function merchantId() {
  return firstEnv(["NEWEBPAY_MERCHANT_ID", "MerchantID", "MERCHANT_ID", "NEWEBPAY_MID"]);
}

function hashKey() {
  return firstEnv(["NEWEBPAY_HASH_KEY", "HashKey", "HASH_KEY", "NEWEBPAY_HashKey"]);
}

function hashIV() {
  return firstEnv(["NEWEBPAY_HASH_IV", "HashIV", "HASH_IV", "NEWEBPAY_HashIV"]);
}

function newebpayEnvName() {
  return firstEnv(["NEWEBPAY_ENV", "NEWEBPAY_MODE", "NEWEBPAY_STAGE", "NEWEBPAY_GATEWAY"]).toLowerCase();
}

function isProduction() {
  const env = newebpayEnvName();
  if (["test", "testing", "stage", "staging", "sandbox", "ccore", "dev", "development"].includes(env)) {
    return false;
  }
  if (["prod", "production", "live", "core", "official", "release", "1", "true", "yes"].includes(env)) {
    return true;
  }
  if (["0", "false", "no"].includes(env)) return false;
  return true;
}

function mpgGateway() {
  return isProduction()
    ? "https://core.newebpay.com/MPG/mpg_gateway"
    : "https://ccore.newebpay.com/MPG/mpg_gateway";
}

function secretBytes(value, expected) {
  const text = stripEnv(value);
  if (!text) return Buffer.alloc(0);
  if (/^[0-9a-fA-F]+$/.test(text) && text.length === expected * 2) {
    return Buffer.from(text, "hex");
  }
  return Buffer.from(text, "utf8");
}

function phpOpensslBytes(value, size) {
  const raw = Buffer.from(stripEnv(value), "utf8");
  if (raw.length === size) return raw;
  if (raw.length > size) return raw.subarray(0, size);
  return Buffer.concat([raw, Buffer.alloc(size - raw.length)]);
}

function newebpayConfigured() {
  const mid = merchantId();
  const key = secretBytes(hashKey(), 32);
  const iv = secretBytes(hashIV(), 16);
  return Boolean(mid && key.length === 32 && iv.length === 16);
}

function newebpayConfigStatus() {
  const key = hashKey();
  const iv = hashIV();
  const prod = isProduction();
  return {
    configured: newebpayConfigured(),
    env: newebpayEnvName() || "(unset→prod)",
    production: prod,
    gateway: periodGateway(),
    merchantId: merchantId(),
    hasMerchantId: Boolean(merchantId()),
    hashKeyChars: key.length,
    hashIvChars: iv.length,
    hashKeyBytes: secretBytes(key, 32).length,
    hashIvBytes: secretBytes(iv, 16).length,
  };
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
  const cipher = crypto.createCipheriv("aes-256-cbc", secretBytes(hashKey(), 32), secretBytes(hashIV(), 16));
  cipher.setAutoPadding(false);
  const padded = addPadding(Buffer.from(String(plain), "utf8"));
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString("hex");
}

function aesEncryptPkcs7(plain) {
  return phpOpensslEncrypt(plain, hashKey(), hashIV());
}

function phpOpensslEncrypt(plain, keyText, ivText) {
  const key = phpOpensslBytes(keyText, 32);
  const iv = phpOpensslBytes(ivText, 16);
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error("Period AES 需要 HashKey 32 bytes、HashIV 16 bytes");
  }
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([
    cipher.update(Buffer.from(String(plain), "utf8")),
    cipher.final(),
  ]).toString("hex");
}

function aesDecrypt(hex) {
  const raw = Buffer.from(String(hex || "").trim(), "hex");
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", secretBytes(hashKey(), 32), secretBytes(hashIV(), 16));
    const decrypted = Buffer.concat([decipher.update(raw), decipher.final()]);
    return decrypted.toString("utf8").replace(/\0+$/g, "");
  } catch {
    const decipher = crypto.createDecipheriv("aes-256-cbc", secretBytes(hashKey(), 32), secretBytes(hashIV(), 16));
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(raw), decipher.final()]);
    return stripPadding(decrypted).toString("utf8").replace(/\0+$/g, "");
  }
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

function periodVersion() {
  const fromEnv = firstEnv(["NEWEBPAY_PERIOD_VERSION"]);
  if (fromEnv === "1.5") return fromEnv;
  return PERIOD_VERSION;
}

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

function digitString(value, min, max, name) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${name} 必須是 ${min}-${max} 的整數，目前是 ${value}`);
  }
  return String(n);
}

function periodSchedule() {
  return {
    PeriodType: "M",
    PeriodPoint: taipeiParts(new Date()).day,
    PeriodStartType: "2",
  };
}

function buildPeriodTradeParams(input = {}) {
  const schedule = periodSchedule();
  const params = {
    RespondType: "JSON",
    TimeStamp: digitString(Math.floor(Date.now() / 1000), 1, 9999999999, "TimeStamp"),
    Version: periodVersion(),
    LangType: "zh-Tw",
    MerOrderNo: String(input.orderNo || createOrderNo()).replace(/[^A-Za-z0-9_]/g, "").slice(0, 30),
    ProdDesc: periodProdDesc(input.itemDesc),
    PeriodAmt: digitString(input.amt || defaultPeriodAmt(), 1, 999999, "PeriodAmt"),
    PeriodType: "M",
    PeriodPoint: String(schedule.PeriodPoint || "").padStart(2, "0"),
    PeriodStartType: digitString(schedule.PeriodStartType, 1, 3, "PeriodStartType"),
    PeriodTimes: digitString(defaultPeriodTimes(), 1, 99, "PeriodTimes"),
    PayerEmail: String(input.email || "").trim().slice(0, 50),
    PaymentInfo: "Y",
    OrderInfo: "N",
    EmailModify: "1",
    NotifyURL: notifyUrl(),
    ReturnURL: returnUrl(),
    BackURL: clientBackUrl(),
  };
  const required = [
    "RespondType",
    "TimeStamp",
    "Version",
    "MerOrderNo",
    "ProdDesc",
    "PeriodAmt",
    "PeriodType",
    "PeriodPoint",
    "PeriodStartType",
    "PeriodTimes",
    "PayerEmail",
  ];
  const missing = required.filter((key) => !String(params[key] || "").trim());
  if (missing.length) {
    throw new Error(`Period 缺少必填欄位：${missing.join(", ")}`);
  }
  if (!/^\d{2}$/.test(params.PeriodPoint) || Number(params.PeriodPoint) < 1 || Number(params.PeriodPoint) > 31) {
    throw new Error(`PeriodPoint 必須是 01-31，目前是 ${params.PeriodPoint}`);
  }
  if (params.Version !== "1.5") {
    throw new Error(`Period Version 必須是 1.5，目前是 ${params.Version}`);
  }
  if (!/^\d+$/.test(params.PeriodAmt) || !/^\d+$/.test(params.PeriodTimes) || !/^\d+$/.test(params.PeriodStartType)) {
    throw new Error("PeriodAmt / PeriodTimes / PeriodStartType 必須是純數字");
  }
  return params;
}

const PERIOD_QUERY_ORDER = [
  "RespondType",
  "TimeStamp",
  "Version",
  "LangType",
  "MerOrderNo",
  "ProdDesc",
  "PeriodAmt",
  "PeriodType",
  "PeriodPoint",
  "PeriodStartType",
  "PeriodTimes",
  "PayerEmail",
  "PaymentInfo",
  "OrderInfo",
  "EmailModify",
  "NotifyURL",
  "ReturnURL",
  "BackURL",
];

function periodQueryString(params) {
  return PERIOD_QUERY_ORDER.map((key) => {
    if (key === "Version") return "Version=1.5";
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Period query 缺少 ${key}`);
    }
    return `${key}=${phpUrlencode(String(value))}`;
  }).join("&");
}

function periodFieldTypes(params) {
  const out = {};
  PERIOD_QUERY_ORDER.forEach((key) => {
    const value = params[key];
    out[key] = { value, jsType: typeof value, chars: String(value ?? "").length };
  });
  return out;
}

function periodEncrypt(query) {
  return phpOpensslEncrypt(query, hashKey(), hashIV());
}

function logOfficialAesVector() {
  const sampleQuery =
    "RespondType=JSON&TimeStamp=1700033460&Version=1.5&LangType=zh-Tw&MerOrderNo=myorder1700033460&ProdDesc=Test+commssion&PeriodAmt=10&PeriodType=M&PeriodPoint=05&PeriodStartType=2&PeriodTimes=12&PayerEmail=test%40neweb.com.tw&PaymentInfo=Y&OrderInfo=N&EmailModify=1&NotifyURL=https%3A%2F%2Fwebhook.site%2Fb728e917-1bf7-478b-b0f9-73b56aeb44e0";
  const sampleHex =
    "45d5175feaa9ef2ea039f84afba34c6330e8fa21ae01ec40f15ab00073b4e93584cc1d3a7e2b26feb08216d14074dd4a83a64791e114cd15e200a88ef38720e7830d892953a25b84411abc8d0f86ff73719af52e0c303de9586c422702e806e599ffd739086b0c3f8c3b995b2a6ba92902070f5f8c4c2916f72b0d9c1027ca050799a6a55e78ff07c663e4b90aa3a84dfde353f1354fc5165ccc897f5ee0586a2852e2e5e1be1f3fa2f7a618377abdab9b6aa3af39eb005e461aaa2c8da4d2fd3af93bed9eb3438b01804a9a1bc39bcb6f7bd3a35bd275fe53923960bd76c4def1175e8b1f60acb21cd4ebe9c03fe10df2c1a6aa455e21899c02cba501ce2fb87c72a6cbb2a146ddd4688fd3ce9cf068bdb6f4f2c4351d78973d32268737e931def628d0f3f3aac038cd551a0f8c85e0d194542da74f6ba841c4068bab0f14453dbac0d16dba1de2656368238855dc6351821380a3455532a2259c2c5caf4cac";
  const got = phpOpensslEncrypt(sampleQuery, "IaWudQJsuOT994cpHRWzv7Ge67yC1cE3", "C1dLm3nxZRVlmBSP");
  console.log("[NewebPay Period] OFFICIAL_AES_VECTOR_OK=" + String(got === sampleHex));
}

function logPeriodQuery(params, query) {
  console.log("[NewebPay Period] FIELD_TYPES=" + JSON.stringify(periodFieldTypes(params)));
  console.log("[NewebPay Period] QUERY_BEFORE_AES=" + query);
  console.log("[NewebPay Period] QUERY_LENGTH=" + String(query.length));
  console.log("[NewebPay Period] QUERY_HAS_VERSION=" + String(/(?:^|&)Version=1\.5(?:&|$)/.test(query)));
  console.log("[NewebPay Period] AES=" + JSON.stringify({
    cipher: "AES-256-CBC",
    padding: "PKCS7",
    flags: "OPENSSL_RAW_DATA",
    keyBytes: phpOpensslBytes(hashKey(), 32).length,
    ivBytes: phpOpensslBytes(hashIV(), 16).length,
    hashKeyChars: hashKey().length,
    hashIvChars: hashIV().length,
  }));
}

function periodPostFields(plainParams) {
  const params = { ...plainParams, Version: "1.5" };
  delete params.MerchantID;
  delete params.Amt;
  const query = periodQueryString(params);
  if (!/(?:^|&)Version=1\.5(?:&|$)/.test(query)) {
    throw new Error("Period 加密字串缺少 Version=1.5");
  }
  logPeriodQuery(params, query);
  logOfficialAesVector();
  if (newebpayConfigured()) {
    try {
      const roundtrip = aesDecrypt(periodEncrypt(query));
      console.log("[NewebPay Period] ROUNDTRIP_QUERY=" + roundtrip);
      console.log("[NewebPay Period] ROUNDTRIP_OK=" + String(roundtrip === query));
    } catch (error) {
      console.error("[NewebPay Period] ROUNDTRIP_FAIL", error && error.message ? error.message : error);
    }
  }
  const fields = officialPeriodFormFields(periodEncrypt(query));
  console.log("[NewebPay Period] FORM_KEYS=" + Object.keys(fields).join(","));
  return fields;
}

function officialPeriodFormFields(postData) {
  return {
    MerchantID_: merchantId(),
    PostData_: String(postData || ""),
  };
}

function resultFromPeriodPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.Result && typeof payload.Result === "object") return payload.Result;
  return payload;
}

function formatPeriodFail(payload) {
  const result = resultFromPeriodPayload(payload);
  const status = String((payload && payload.Status) || result.Status || "").trim();
  const message = String((payload && payload.Message) || result.Message || "").trim();
  const parts = [status, message].filter(Boolean);
  return {
    code: status,
    message: parts.join(" ") || "藍新定期定額交易失敗",
    detail: JSON.stringify({
      Status: status,
      Message: message,
      Result: result && typeof result === "object" ? result : undefined,
    }).slice(0, 800),
    payload,
  };
}

function parsePeriodGatewayError(html) {
  const text = String(html || "");
  if (!text.trim()) return null;

  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed);
      if (json && json.Status && String(json.Status).toUpperCase() !== "SUCCESS") {
        return formatPeriodFail(json);
      }
    } catch {
      /* not JSON */
    }
  }

  const periodHex = (
    text.match(/name=["']Period["'][^>]*value=["']([0-9a-fA-F]+)["']/i) ||
    text.match(/name=["']period["'][^>]*value=["']([0-9a-fA-F]+)["']/i) ||
    text.match(/[?&]Period=([0-9a-fA-F]+)/i)
  );
  if (periodHex && periodHex[1]) {
    try {
      const payload = decryptPeriod(periodHex[1]);
      if (payload.Status && String(payload.Status).toUpperCase() !== "SUCCESS") {
        return formatPeriodFail(payload);
      }
    } catch (error) {
      console.error("NewebPay Period gateway Period decrypt failed:", error && error.message ? error.message : error);
    }
  }

  const code = (text.match(/PER\d{5}/) || [])[0] || "";
  const messageMatch =
    text.match(/資料不齊全[^<\n\r]{0,80}/) ||
    text.match(/參數錯誤[^<\n\r]{0,80}/) ||
    text.match(/錯誤訊息[：:]\s*([^<\n\r]+)/) ||
    text.match(/錯誤代碼[：:]\s*([^<\n\r]+)/);
  if (code || /資料不齊全|參數錯誤/.test(text)) {
    const extra = messageMatch ? String(messageMatch[1] || messageMatch[0] || "").trim() : "";
    return {
      code,
      message: [code, extra].filter(Boolean).join(" ") || "藍新定期定額交易失敗",
      detail: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
    };
  }
  return null;
}

async function probePeriodGateway(fields) {
  const official = officialPeriodFormFields(fields && fields.PostData_);
  if (fields && fields.MerchantID_) official.MerchantID_ = fields.MerchantID_;
  const body = new URLSearchParams({
    MerchantID_: official.MerchantID_,
    PostData_: official.PostData_,
  });
  const response = await fetch(periodGateway(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/json",
    },
    body: body.toString(),
    redirect: "manual",
  });
  const text = await response.text();
  console.log("NewebPay Period gateway probe:", {
    status: response.status,
    location: response.headers.get("location") || "",
    formKeys: ["MerchantID_", "PostData_"],
    snippet: String(text || "").replace(/\s+/g, " ").trim().slice(0, 400),
  });
  return parsePeriodGatewayError(text);
}

function periodAutoSubmitHtml(fields) {
  const official = officialPeriodFormFields(fields && fields.PostData_);
  if (fields && fields.MerchantID_) official.MerchantID_ = fields.MerchantID_;
  const action = periodGateway();
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>前往藍新金流定期定額</title>
  </head>
  <body>
    <p>正在前往藍新金流訂閱頁面…</p>
    <form id="newebpay" method="post" action="${escapeHtml(action)}">
      <input type="hidden" name="MerchantID_" value="${escapeHtml(official.MerchantID_)}" />
      <input type="hidden" name="PostData_" value="${escapeHtml(official.PostData_)}" />
    </form>
    <script>document.getElementById("newebpay").submit();</script>
  </body>
</html>`;
}

function phpOpensslDecrypt(hex, keyText, ivText) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    phpOpensslBytes(keyText, 32),
    phpOpensslBytes(ivText, 16)
  );
  return Buffer.concat([
    decipher.update(Buffer.from(String(hex || "").trim(), "hex")),
    decipher.final(),
  ]).toString("utf8").replace(/\0+$/g, "");
}

function decryptPeriod(hex) {
  const text = String(hex || "").trim();
  try {
    return parseDecryptedTradeInfo(phpOpensslDecrypt(text, hashKey(), hashIV()));
  } catch {
    return parseDecryptedTradeInfo(aesDecrypt(text));
  }
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
  periodVersion,
  PRODUCTION_ORIGIN,
  merchantId,
  newebpayConfigured,
  newebpayConfigStatus,
  newebpayEnvName,
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
  buildPeriodTradeParams,
  formatPeriodFirstdate,
  encryptTradeInfo,
  decryptNotify,
  decryptPeriod,
  decryptPayNotify,
  createOrderNo,
  mpgFormFields,
  mpgAutoSubmitHtml,
  periodPostFields,
  officialPeriodFormFields,
  phpOpensslEncrypt,
  periodAutoSubmitHtml,
  parsePeriodGatewayError,
  probePeriodGateway,
  formatPeriodFail,
  resultFromPeriodPayload,
  parseFormBody,
  readRequestBody,
};
