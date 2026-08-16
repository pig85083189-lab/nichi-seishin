const crypto = require("crypto");

const PRODUCTION_ORIGIN = "https://nichi-seishin.vercel.app";
const VERSION = "2.0";
const AES_BLOCK = 32;

function stripEnv(value) {
  let text = String(value || "").replace(/^\uFEFF/, "").replace(/\r/g, "");
  if (
    (text.startsWith("\"") && text.endsWith("\"")) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }
  return text.trim();
}

function normalizeSecret(value) {
  const raw = String(value == null ? "" : value);
  const stripped = stripEnv(raw).replace(/[\s\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, "");
  return {
    rawChars: raw.length,
    value: stripped,
    hadWhitespace: stripped !== raw.trim() || /[\s\u00a0\u200b]/.test(raw),
  };
}

function firstEnv(names) {
  return pickEnv(names).value;
}

function pickEnv(names) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw == null || raw === "") continue;
    const parsed = normalizeSecret(raw);
    if (parsed.value) return { name, ...parsed };
  }
  return { name: "", rawChars: 0, value: "", hadWhitespace: false };
}

function presentEnvNames(names) {
  return names.filter((name) => {
    const raw = process.env[name];
    return raw != null && String(raw).length > 0;
  });
}

function maskSecret(value, keep = 3) {
  const text = String(value || "");
  if (!text) return "(empty)";
  if (text.length < keep) return `${text}…(len=${text.length})`;
  return `${text.slice(0, keep)}...${text.slice(-keep)}`;
}

const HARDCODED_MERCHANT_ID = "HTC109030010100";
const HARDCODED_HASH_KEY = "nx1zcPRhfiJS0ECZQcd2XRolrr2P2pKm";
const HARDCODED_HASH_IV = "PttRZuDsLLO4ZIQC";

function merchantIdNames() {
  return ["HARDCODED_MERCHANT_ID"];
}

function hashKeyNames() {
  return ["HARDCODED_HASH_KEY"];
}

function hashIvNames() {
  return ["HARDCODED_HASH_IV"];
}

function hardcodedPick(name, value) {
  return { name, rawChars: String(value).length, value: String(value), hadWhitespace: false };
}

function merchantIdPick() {
  return hardcodedPick("HARDCODED_MERCHANT_ID", HARDCODED_MERCHANT_ID);
}

function hashKeyPick() {
  return hardcodedPick("HARDCODED_HASH_KEY", HARDCODED_HASH_KEY);
}

function hashIvPick() {
  return hardcodedPick("HARDCODED_HASH_IV", HARDCODED_HASH_IV);
}

function merchantId() {
  return HARDCODED_MERCHANT_ID;
}

function hashKey() {
  return HARDCODED_HASH_KEY;
}

function hashIV() {
  return HARDCODED_HASH_IV;
}

function envNamePick() {
  return pickEnv(["NEWEBPAY_ENV", "NEWEBPAY_MODE", "NEWEBPAY_STAGE", "NEWEBPAY_GATEWAY"]);
}

function resolveMpgMode() {
  const picked = envNamePick();
  const raw = String(picked.value || "").toLowerCase();
  if (!raw) {
    return {
      mode: "production",
      production: true,
      envVar: "",
      envValue: "",
      reason: "NEWEBPAY_ENV unset → default production / core (official keys)",
    };
  }
  if (raw.includes("ccore") || ["test", "testing", "stage", "staging", "sandbox", "dev", "development", "0", "false", "no"].includes(raw)) {
    return {
      mode: "test",
      production: false,
      envVar: picked.name,
      envValue: picked.value,
      reason: `${picked.name}=${picked.value} → test / ccore`,
    };
  }
  if (raw.includes("core.newebpay") || ["prod", "production", "live", "core", "official", "release", "1", "true", "yes"].includes(raw)) {
    return {
      mode: "production",
      production: true,
      envVar: picked.name,
      envValue: picked.value,
      reason: `${picked.name}=${picked.value} → production / core`,
    };
  }
  return {
    mode: "production",
    production: true,
    envVar: picked.name,
    envValue: picked.value,
    reason: `${picked.name}=${picked.value} unrecognized → default production / core`,
  };
}

function inferKeyStage(name) {
  const n = String(name || "").toUpperCase();
  if (n.includes("_TEST") || n.endsWith("TEST")) return "test";
  if (n.includes("_PROD") || n.endsWith("PROD") || n.includes("PRODUCTION")) return "production";
  return "unspecified";
}

function logMpgKeyCheck() {
  const key = hashKeyPick();
  const iv = hashIvPick();
  const mid = merchantIdPick();
  const resolved = resolveMpgMode();
  const keyStage = inferKeyStage(key.name);
  const pairing =
    keyStage === "unspecified"
      ? `generic ${key.name || "HashKey"} paired with ${resolved.mode} gateway`
      : keyStage === resolved.mode
        ? `${keyStage} keys paired with ${resolved.mode} gateway`
        : `MISMATCH ${keyStage} keys with ${resolved.mode} gateway`;
  console.log("[NewebPay MPG] MODE=" + resolved.mode);
  console.log("[NewebPay MPG] MODE_REASON=" + resolved.reason);
  console.log("[NewebPay MPG] GATEWAY=" + mpgGateway());
  console.log("[NewebPay MPG] KEY_PAIRING=" + pairing);
  if (keyStage !== "unspecified" && keyStage !== resolved.mode) {
    console.warn("[NewebPay MPG] KEY_GATEWAY_MISMATCH set NEWEBPAY_ENV=" + (keyStage === "test" ? "test" : "prod"));
  }
  console.log(
    "[NewebPay MPG] KEY_CHECK env=" + (key.name || "(none)") +
    ", Key length: " + String(key.value.length) +
    ", start: " + String(key.value).slice(0, 3) + "..." +
    ", end: ..." + String(key.value).slice(-3) +
    ", rawLength: " + String(key.rawChars) +
    ", hadWhitespace: " + String(key.hadWhitespace)
  );
  console.log(
    "[NewebPay MPG] IV_CHECK env=" + (iv.name || "(none)") +
    ", IV length: " + String(iv.value.length) +
    ", start: " + String(iv.value).slice(0, 3) + "..." +
    ", end: ..." + String(iv.value).slice(-3) +
    ", rawLength: " + String(iv.rawChars) +
    ", hadWhitespace: " + String(iv.hadWhitespace)
  );
  console.log(
    "[NewebPay MPG] MID_CHECK MerchantID env: " + (mid.name || "(none)") +
    ", length: " + String(mid.value.length) +
    ", value: " + mid.value
  );
  console.log("[NewebPay MPG] ENV_PRESENT=" + JSON.stringify({
    hashKey: presentEnvNames(hashKeyNames()),
    hashIv: presentEnvNames(hashIvNames()),
    merchantId: presentEnvNames(merchantIdNames()),
    env: presentEnvNames(["NEWEBPAY_ENV", "NEWEBPAY_MODE", "NEWEBPAY_STAGE", "NEWEBPAY_GATEWAY"]),
  }));
}

function newebpayEnvName() {
  return resolveMpgMode().envValue.toLowerCase() || "";
}

function isProduction() {
  return resolveMpgMode().production;
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
  const resolved = resolveMpgMode();
  return {
    configured: newebpayConfigured(),
    env: resolved.envValue || "(unset→prod)",
    mode: resolved.mode,
    modeReason: resolved.reason,
    production: resolved.production,
    gateway: mpgGateway(),
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
  return 399;
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
  return compactMpgQuery(params);
}

function encodeItemDesc(value) {
  return encodeURIComponent(String(value).replace(/[\r\n\t]/g, "").trim());
}

function compactMpgQuery(params) {
  const parts = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    const k = String(key).replace(/\s+/g, "");
    const raw = String(value).replace(/[\r\n\t]/g, "").trim();
    const v = k === "ItemDesc" ? encodeItemDesc(raw) : phpUrlencode(raw);
    parts.push(k + "=" + v);
  });
  const query = parts.join("&");
  if (/\s/.test(query)) {
    throw new Error("QUERY_BEFORE_AES 含有空白或換行");
  }
  if (/= | =|& | &/.test(query)) {
    throw new Error("QUERY_BEFORE_AES 的 & 或 = 前後有空白");
  }
  return query;
}

function inspectMpgQuery(query, params) {
  const now = Math.floor(Date.now() / 1000);
  const stamp = Number(params && params.TimeStamp);
  const itemRaw = String((params && params.ItemDesc) || "");
  const itemEncoded = encodeItemDesc(itemRaw);
  const expectedNichi = encodeURIComponent("日精進");
  const spacesAroundSep = [];
  for (let i = 0; i < query.length; i += 1) {
    const ch = query[i];
    if (ch !== "&" && ch !== "=") continue;
    const before = i > 0 ? query.charCodeAt(i - 1) : null;
    const after = i + 1 < query.length ? query.charCodeAt(i + 1) : null;
    if (before === 32 || before === 9 || after === 32 || after === 9) {
      spacesAroundSep.push({ index: i, char: ch, before, after });
    }
  }
  return {
    queryChars: query.length,
    hasWhitespace: /\s/.test(query),
    hasNewline: /[\r\n]/.test(query),
    spacesAroundSeparators: spacesAroundSep.length,
    itemDescRaw: itemRaw,
    itemDescUtf8Bytes: Buffer.from(itemRaw, "utf8").toString("hex"),
    itemDescEncoded: itemEncoded,
    itemDescIsNichi: itemRaw === "日精進",
    itemDescEncodeOk: itemRaw !== "日精進" || itemEncoded === expectedNichi,
    timeStamp: params && params.TimeStamp,
    timeStampNow: now,
    timeStampDeltaSec: Number.isFinite(stamp) ? stamp - now : null,
    timeStampLooksUnix: /^\d{10}$/.test(String((params && params.TimeStamp) || "")),
  };
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
    throw new Error("MPG AES 需要 HashKey 32 bytes、HashIV 16 bytes");
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

function rawTradeInfoHex(hex) {
  const text = String(hex || "").replace(/\s+/g, "").toLowerCase();
  if (!text) throw new Error("TradeInfo 密文是空的");
  if (text.includes("%")) {
    throw new Error("TradeInfo 密文不可經過 URL Encode 再算 SHA256");
  }
  if (!/^[0-9a-f]+$/.test(text)) {
    throw new Error("TradeInfo 必須是完整 hex，不可截斷或轉換");
  }
  if (text.length % 2 !== 0) {
    throw new Error(`TradeInfo hex 長度必須是偶數，目前是 ${text.length}`);
  }
  return text;
}

function mpgAesEncrypt(plain) {
  const key = phpOpensslBytes(hashKey(), 32);
  const iv = phpOpensslBytes(hashIV(), 16);
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error("MPG AES 需要 HashKey 32 bytes、HashIV 16 bytes");
  }
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  const padded = addPadding(Buffer.from(String(plain), "utf8"));
  return rawTradeInfoHex(Buffer.concat([cipher.update(padded), cipher.final()]).toString("hex"));
}

function tradeShaSource(tradeInfo) {
  const info = rawTradeInfoHex(tradeInfo);
  return "HashKey=" + hashKey() + "&" + info + "&HashIV=" + hashIV();
}

function tradeInfoFromShaRaw(shaRaw) {
  const prefix = "HashKey=" + hashKey() + "&";
  const suffix = "&HashIV=" + hashIV();
  const text = String(shaRaw || "");
  if (!text.startsWith(prefix) || !text.endsWith(suffix)) return "";
  return text.slice(prefix.length, text.length - suffix.length);
}

function tradeSha(tradeInfo) {
  return crypto.createHash("sha256").update(tradeShaSource(tradeInfo), "utf8").digest("hex").toUpperCase();
}

function logOfficialMpgShaVector() {
  const sampleInfo =
    "ff91c8aa01379e4de621a44e5f11f72e4d25bdb1a18242db6cef9ef07d80b0165e476fd1d9acaa53170272c82d122961e1a0700a7427cfa1cf90db7f6d6593bbc93102a4d4b9b66d9974c13c31a7ab4bba1d4e0790f0cbbbd7ad64c6d3c8012a601ceaa808bff70f94a8efa5a4f984b9d41304ffd879612177c622f75f4214fa";
  const sampleRaw =
    `HashKey=12345678901234567890123456789012&${sampleInfo}&HashIV=1234567890123456`;
  const sampleSha = "EA0A6CC37F40C1EA5692E7CBB8AE097653DF3E91365E6A9CD7E91312413C7BB8";
  const got = crypto.createHash("sha256").update(sampleRaw, "utf8").digest("hex").toUpperCase();
  console.log("[NewebPay MPG] OFFICIAL_SHA_VECTOR_OK=" + String(got === sampleSha));
}

function mpgVersion() {
  return firstEnv(["NEWEBPAY_MPG_VERSION"]) || VERSION;
}

function mpgAmt() {
  return 399;
}

function mpgItemDesc(text) {
  const cleaned = String(text || defaultItemDesc() || "日精進")
    .replace(/[\r\n\t]/g, "")
    .trim()
    .slice(0, 50);
  return cleaned || "日精進";
}

function buildMpgTradeParams(input = {}) {
  const now = Math.floor(Date.now() / 1000);
  const params = {
    MerchantID: String(merchantId()).replace(/\s+/g, ""),
    RespondType: "JSON",
    TimeStamp: String(now),
    Version: mpgVersion(),
    LangType: "zh-tw",
    MerchantOrderNo: String(input.orderNo || createOrderNo()).replace(/[^A-Za-z0-9_]/g, "").slice(0, 30),
    Amt: String(mpgAmt()),
    ItemDesc: mpgItemDesc(input.itemDesc),
    ReturnURL: returnUrl(),
    NotifyURL: notifyUrl(),
    ClientBackURL: clientBackUrl(),
    Email: String(input.email || "").trim().slice(0, 50),
    EmailModify: "0",
    LoginType: "0",
    CREDIT: "1",
  };
  const required = ["MerchantID", "RespondType", "TimeStamp", "Version", "MerchantOrderNo", "Amt", "ItemDesc"];
  const missing = required.filter((key) => !String(params[key] || "").trim());
  if (missing.length) {
    throw new Error(`MPG 缺少必填欄位：${missing.join(", ")}`);
  }
  if (params.Amt !== "399") {
    throw new Error(`MPG 金額必須是 399，目前是 ${params.Amt}`);
  }
  if (!/^\d{10}$/.test(params.TimeStamp)) {
    throw new Error(`TimeStamp 必須是 10 位數 Unix 秒，目前是 ${params.TimeStamp}`);
  }
  return params;
}

function encryptTradeInfo(params) {
  const query = compactMpgQuery(params);
  const tradeInfo = mpgAesEncrypt(query);
  const shaRaw = tradeShaSource(tradeInfo);
  const sha = tradeSha(tradeInfo);
  const shaTradeInfo = tradeInfoFromShaRaw(shaRaw);
  if (shaTradeInfo !== tradeInfo) {
    throw new Error("SHA256_RAW 中的 TradeInfo 與加密密文不一致");
  }
  return {
    query,
    tradeInfo,
    tradeSha: sha,
    shaRaw,
    shaTradeInfo,
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
  try {
    return parseDecryptedTradeInfo(phpOpensslDecrypt(info, hashKey(), hashIV()));
  } catch {
    return parseDecryptedTradeInfo(aesDecrypt(info));
  }
}

function createOrderNo() {
  const rand = crypto.randomBytes(3).toString("hex");
  return `NS${Date.now()}${rand}`.slice(0, 30);
}

function mpgFormFields(tradeParams) {
  const params = { ...tradeParams };
  logMpgKeyCheck();
  const { query, tradeInfo, tradeSha: sha, shaRaw, shaTradeInfo } = encryptTradeInfo(params);
  let roundtrip = "";
  try {
    roundtrip = aesDecrypt(tradeInfo);
  } catch {
    try {
      roundtrip = phpOpensslDecrypt(tradeInfo, hashKey(), hashIV());
    } catch {
      roundtrip = "";
    }
  }
  logOfficialMpgShaVector();
  const queryInspect = inspectMpgQuery(query, params);
  console.log("[NewebPay MPG] QUERY_BEFORE_AES=" + query);
  console.log("[NewebPay MPG] QUERY_INSPECT=" + JSON.stringify(queryInspect));
  if (queryInspect.hasWhitespace || queryInspect.hasNewline || queryInspect.spacesAroundSeparators) {
    throw new Error("QUERY_BEFORE_AES 含有空白、換行或分隔符旁空白");
  }
  if (!queryInspect.timeStampLooksUnix || Math.abs(queryInspect.timeStampDeltaSec || 0) > 120) {
    throw new Error("TimeStamp 不是當下的 Unix 秒");
  }
  if (!queryInspect.itemDescEncodeOk) {
    throw new Error("ItemDesc 日精進 UTF-8 encodeURIComponent 與預期不符");
  }
  console.log("[NewebPay MPG] ROUNDTRIP_OK=" + String(roundtrip === query));
  console.log("[NewebPay MPG] AMT=" + String(params.Amt));
  console.log("[NewebPay MPG] VERSION=" + String(params.Version));
  console.log("[NewebPay MPG] GATEWAY=" + mpgGateway());
  console.log("[NewebPay MPG] SHA256_FORMAT=HashKey={HashKey}&{TradeInfo}&HashIV={HashIV}");
  console.log("[NewebPay MPG] SHA256_NO_URLENCODE=true");
  console.log("[NewebPay MPG] TRADEINFO_HEX=" + tradeInfo);
  console.log("[NewebPay MPG] TRADEINFO_CHARS=" + String(tradeInfo.length));
  console.log("[NewebPay MPG] SHA_TRADEINFO_CHARS=" + String(shaTradeInfo.length));
  console.log("[NewebPay MPG] SHA_TRADEINFO_MATCH=" + String(shaTradeInfo === tradeInfo));
  console.log("[NewebPay MPG] TRADEINFO_HAS_PERCENT=" + String(tradeInfo.includes("%")));
  console.log("[NewebPay MPG] SHA256_RAW=" + shaRaw);
  console.log("[NewebPay MPG] SHA256_HASH=" + sha);
  return {
    MerchantID: merchantId(),
    TradeInfo: tradeInfo,
    TradeSha: sha,
    Version: String(params.Version || mpgVersion()),
    EncryptType: "0",
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
];

function officialPeriodPlain(params = {}) {
  return {
    RespondType: "JSON",
    TimeStamp: String(params.TimeStamp || ""),
    Version: "1.5",
    LangType: "zh-Tw",
    MerOrderNo: String(params.MerOrderNo || ""),
    ProdDesc: String(params.ProdDesc || ""),
    PeriodAmt: String(params.PeriodAmt || ""),
    PeriodType: String(params.PeriodType || ""),
    PeriodPoint: String(params.PeriodPoint || ""),
    PeriodStartType: String(params.PeriodStartType || ""),
    PeriodTimes: String(params.PeriodTimes || ""),
    PayerEmail: String(params.PayerEmail || ""),
    PaymentInfo: "Y",
    OrderInfo: "N",
    EmailModify: "1",
    NotifyURL: String(params.NotifyURL || ""),
  };
}

function periodQueryString(params) {
  const official = officialPeriodPlain(params);
  const missing = PERIOD_QUERY_ORDER.filter((key) => !String(official[key] || "").trim());
  if (missing.length) {
    throw new Error(`Period query 缺少 ${missing.join(", ")}`);
  }
  return httpBuildQuery(official);
}

function inspectPeriodQuery(query) {
  const text = String(query || "");
  const pairs = text.split("&").filter(Boolean);
  const keys = pairs.map((pair) => pair.split("=")[0]);
  const versionPair = pairs.find((pair) => pair.startsWith("Version=")) || "";
  const versionIndex = keys.indexOf("Version");
  return {
    keys: keys.join(","),
    officialOrderOk: keys.join(",") === PERIOD_QUERY_ORDER.join(","),
    startsRespondTypeJson: text.startsWith("RespondType=JSON&"),
    versionPair,
    versionIndex,
    versionAfterTimeStamp: keys[1] === "TimeStamp" && keys[2] === "Version",
    hasVersion15: versionPair === "Version=1.5",
    hasLowercaseVersion: /(?:^|&)version=/.test(text),
    hasEncodedVersionDot: /(?:^|&)Version=1%2[Ee]5(?:&|$)/.test(text),
    hasTimeStampDigits: /(?:^|&)TimeStamp=\d+(?:&|$)/.test(text),
    decodedPlusAsSpace: text.includes(" ") && !text.includes("+"),
  };
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
  const rebuilt = periodQueryString({
    TimeStamp: "1700033460",
    MerOrderNo: "myorder1700033460",
    ProdDesc: "Test commssion",
    PeriodAmt: "10",
    PeriodType: "M",
    PeriodPoint: "05",
    PeriodStartType: "2",
    PeriodTimes: "12",
    PayerEmail: "test@neweb.com.tw",
    NotifyURL: "https://webhook.site/b728e917-1bf7-478b-b0f9-73b56aeb44e0",
  });
  console.log("[NewebPay Period] OFFICIAL_AES_VECTOR_OK=" + String(got === sampleHex));
  console.log("[NewebPay Period] OFFICIAL_QUERY_REBUILD_OK=" + String(rebuilt === sampleQuery));
  console.log("[NewebPay Period] OFFICIAL_QUERY_VERSION=" + ((rebuilt.match(/(?:^|&)(Version=[^&]*)/) || [])[1] || ""));
}

function logPeriodQuery(params, query) {
  const inspect = inspectPeriodQuery(query);
  console.log("[NewebPay Period] FIELD_TYPES=" + JSON.stringify(periodFieldTypes(params)));
  console.log("[NewebPay Period] QUERY_BEFORE_AES=" + query);
  console.log("[NewebPay Period] QUERY_LENGTH=" + String(query.length));
  console.log("[NewebPay Period] QUERY_INSPECT=" + JSON.stringify(inspect));
  console.log("[NewebPay Period] AES=" + JSON.stringify({
    cipher: "AES-256-CBC",
    padding: "PKCS7",
    flags: "OPENSSL_RAW_DATA",
    keyBytes: phpOpensslBytes(hashKey(), 32).length,
    ivBytes: phpOpensslBytes(hashIV(), 16).length,
    hashKeyChars: hashKey().length,
    hashIvChars: hashIV().length,
  }));
  if (
    !inspect.officialOrderOk ||
    !inspect.hasVersion15 ||
    inspect.hasLowercaseVersion ||
    inspect.hasEncodedVersionDot ||
    !inspect.startsRespondTypeJson ||
    !inspect.versionAfterTimeStamp
  ) {
    throw new Error("Period query 與官方 1.5 欄位順序／Version=1.5 不一致");
  }
}

function periodPostFields(plainParams) {
  const params = officialPeriodPlain({ ...plainParams, Version: "1.5" });
  const query = periodQueryString(params);
  if (!/(?:^|&)Version=1\.5(?:&|$)/.test(query)) {
    throw new Error("Period 加密字串缺少 Version=1.5");
  }
  logPeriodQuery(params, query);
  logOfficialAesVector();
  const hex = periodEncrypt(query);
  const roundtrip = phpOpensslDecrypt(hex, hashKey(), hashIV());
  const decryptedVersion = (roundtrip.match(/(?:^|&)Version=([^&]*)/) || [])[1] || "";
  console.log("[NewebPay Period] ROUNDTRIP_QUERY=" + roundtrip);
  console.log("[NewebPay Period] ROUNDTRIP_OK=" + String(roundtrip === query));
  console.log("[NewebPay Period] DECRYPTED_VERSION=" + decryptedVersion);
  if (decryptedVersion !== "1.5") {
    throw new Error(`PostData_ 解密後沒有 Version=1.5，而是 ${decryptedVersion || "（缺失）"}`);
  }
  const fields = officialPeriodFormFields(hex);
  const wire = periodFormBody(fields);
  console.log("[NewebPay Period] FORM_KEYS=" + Object.keys(fields).join(","));
  console.log("[NewebPay Period] POSTDATA_HEX_OK=" + String(/^[0-9a-f]+$/.test(fields.PostData_)));
  console.log("[NewebPay Period] POSTDATA_CHARS=" + String(fields.PostData_.length));
  console.log("[NewebPay Period] WIRE_BODY_CHARS=" + String(wire.length));
  console.log("[NewebPay Period] WIRE_HAS_PLUS=" + String(wire.includes("+")));
  return fields;
}

function sanitizePeriodPostData(postData) {
  return String(postData || "").replace(/\s+/g, "").toLowerCase();
}

function officialPeriodFormFields(postData) {
  const hex = sanitizePeriodPostData(postData);
  if (hex && !/^[0-9a-f]+$/.test(hex)) {
    throw new Error("PostData_ 必須是 hex，不能含空白或 +");
  }
  return {
    MerchantID_: merchantId(),
    PostData_: hex,
  };
}

function periodFormBody(fields) {
  const official = officialPeriodFormFields(fields && fields.PostData_);
  if (fields && fields.MerchantID_) official.MerchantID_ = String(fields.MerchantID_);
  return `MerchantID_=${encodeURIComponent(official.MerchantID_)}&PostData_=${official.PostData_}`;
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
    <form id="newebpay" method="post" accept-charset="UTF-8" enctype="application/x-www-form-urlencoded" action="${escapeHtml(action)}">
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
  resolveMpgMode,
  mpgGateway,
  mpgVersion,
  mpgAmt,
  mpgItemDesc,
  buildMpgTradeParams,
  logMpgKeyCheck,
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
  periodFormBody,
  phpOpensslEncrypt,
  periodAutoSubmitHtml,
  parsePeriodGatewayError,
  formatPeriodFail,
  resultFromPeriodPayload,
  parseFormBody,
  readRequestBody,
};
