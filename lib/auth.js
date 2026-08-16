const crypto = require("crypto");

const SESSION_COOKIE = "nichi_session";
const STATE_COOKIE = "nichi_oauth_state";
const SESSION_DAYS = 30;
const PRODUCTION_ORIGIN = "https://nichi-seishin.vercel.app";

function authSecret() {
  return String(process.env.AUTH_SECRET || "").trim();
}

function googleConfigured() {
  return Boolean(String(process.env.GOOGLE_CLIENT_ID || "").trim() && String(process.env.GOOGLE_CLIENT_SECRET || "").trim() && authSecret());
}

function originFromReq(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().replace(/:\d+$/, "");
  if (!host) return PRODUCTION_ORIGIN;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function appOrigin() {
  const fromEnv = String(process.env.AUTH_URL || process.env.APP_ORIGIN || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return PRODUCTION_ORIGIN;
}

function oauthRedirectUri() {
  return `${PRODUCTION_ORIGIN}/api/auth/callback`;
}

function isHttps(req) {
  return String(req.headers["x-forwarded-proto"] || "").includes("https");
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !authSecret()) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (data.exp && Date.now() > Number(data.exp)) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  const out = {};
  header.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    out[trimmed.slice(0, index)] = decodeURIComponent(trimmed.slice(index + 1));
  });
  return out;
}

function cookieHeader(name, value, req, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value || "")}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (isHttps(req)) parts.push("Secure");
  if (options.clear) parts.push("Max-Age=0");
  else if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

const { getUserFromAccessToken, supabaseConfigured } = require("./supabase");

function authConfigured() {
  return supabaseConfigured() || googleConfigured();
}

function headerValue(req, name) {
  const raw = req.headers[name] || req.headers[String(name).toLowerCase()] || "";
  return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
}

function redactSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 12) return `${text.slice(0, 4)}…(len=${text.length})`;
  return `${text.slice(0, 16)}…${text.slice(-8)}(len=${text.length})`;
}

function bearerToken(req, extra = {}) {
  const header = headerValue(req, "authorization");
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  if (header && !header.includes(" ")) return header.trim();
  const alt = String(
    headerValue(req, "x-supabase-auth") ||
    headerValue(req, "x-access-token") ||
    extra.accessToken ||
    extra.token ||
    ""
  ).trim();
  if (alt) return alt.replace(/^bearer\s+/i, "");
  return "";
}

function describeAuthRequest(req, extra = {}) {
  const cookies = parseCookies(req);
  const authorization = headerValue(req, "authorization");
  const token = bearerToken(req, extra);
  return {
    method: req.method,
    authorization: redactSecret(authorization),
    authorizationPrefix: authorization.slice(0, 20),
    authorizationStartsWithBearer: authorization.toLowerCase().startsWith("bearer "),
    xSupabaseAuth: redactSecret(headerValue(req, "x-supabase-auth")),
    cookieHeader: headerValue(req, "cookie"),
    cookieNames: Object.keys(cookies),
    hasNichiSessionCookie: Boolean(cookies[SESSION_COOKIE]),
    bodyHasAccessToken: Boolean(extra.accessToken || extra.token),
    resolvedToken: redactSecret(token),
    resolvedTokenChars: token.length,
    headerNames: Object.keys(req.headers || {}),
  };
}

async function getSession(req, extra = {}) {
  const token = bearerToken(req, extra);
  let user = null;
  if (token) {
    user = await getUserFromAccessToken(token);
    if (!user) {
      console.warn("getSession: bearer present but Supabase user lookup failed", {
        tokenChars: token.length,
      });
    }
  }
  if (!user) {
    const cookieToken = parseCookies(req)[SESSION_COOKIE];
    const data = verify(cookieToken);
    if (data && data.id) {
      user = {
        id: String(data.id),
        email: data.email || "",
        name: data.name || "",
        picture: data.picture || "",
      };
    }
  }
  console.log("Auth check:", {
    ...describeAuthRequest(req, extra),
    userId: user && user.id ? user.id : null,
    userEmail: user && user.email ? user.email : null,
  });
  return user;
}

async function requireUser(req, res) {
  const user = await getSession(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "請先登入" });
    return null;
  }
  return user;
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, picture: user.picture };
}

module.exports = {
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_DAYS,
  authSecret,
  googleConfigured,
  authConfigured,
  originFromReq,
  appOrigin,
  oauthRedirectUri,
  sign,
  verify,
  parseCookies,
  cookieHeader,
  getSession,
  requireUser,
  publicUser,
  bearerToken,
  describeAuthRequest,
  headerValue,
};
