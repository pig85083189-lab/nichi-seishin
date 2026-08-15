const {
  googleConfigured,
  appOrigin,
  sign,
  verify,
  parseCookies,
  cookieHeader,
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_DAYS,
} = require("../../lib/auth");
const { registerUser } = require("../../lib/store");

module.exports = async function handler(req, res) {
  const origin = appOrigin();
  const fail = (reason) => {
    res.redirect(302, `${origin}/?auth=error&reason=${encodeURIComponent(reason)}`);
  };

  if (!googleConfigured()) {
    fail("尚未設定 Google 登入");
    return;
  }

  const url = new URL(req.url, origin);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const cookies = parseCookies(req);
  const expected = cookies[STATE_COOKIE] || "";
  if (!code || !state || !expected || state !== expected || !verify(state)) {
    fail("登入驗證失敗，請再試一次");
    return;
  }

  try {
    const redirectUri = "https://nichi-seishin.vercel.app/api/auth/callback";
    console.log("Redirect URI being sent (token exchange):", redirectUri);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      fail((tokenData.error_description || tokenData.error || "Google 授權失敗").slice(0, 80));
      return;
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json().catch(() => ({}));
    const id = String(profile.sub || "").trim();
    const email = String(profile.email || "").trim();
    if (!id || !email) {
      fail("Google 沒有回傳帳號識別");
      return;
    }

    const user = {
      id,
      email,
      name: String(profile.name || email).trim(),
      picture: String(profile.picture || "").trim(),
    };
    await registerUser(user);

    const session = sign({
      ...user,
      exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
    res.setHeader("Set-Cookie", [
      cookieHeader(SESSION_COOKIE, session, req, { maxAge: SESSION_DAYS * 24 * 60 * 60 }),
      cookieHeader(STATE_COOKIE, "", req, { clear: true }),
    ]);
    res.redirect(302, `${origin}/?auth=ok`);
  } catch (error) {
    fail(String(error.message || "登入失敗").slice(0, 80));
  }
};
