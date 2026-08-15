const { googleConfigured, originFromReq, sign, cookieHeader, STATE_COOKIE } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (!googleConfigured()) {
    res.status(501).json({
      ok: false,
      error: "尚未設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 與 AUTH_SECRET",
    });
    return;
  }
  const origin = originFromReq(req);
  const state = sign({ n: Date.now(), exp: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.setHeader("Set-Cookie", cookieHeader(STATE_COOKIE, state, req, { maxAge: 600 }));
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
