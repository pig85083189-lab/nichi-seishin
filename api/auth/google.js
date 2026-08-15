const { googleConfigured, sign, cookieHeader, STATE_COOKIE } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (!googleConfigured()) {
    res.status(501).json({
      ok: false,
      error: "尚未設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 與 AUTH_SECRET",
    });
    return;
  }
  const redirectUri = "https://nichi-seishin.vercel.app/api/auth/callback";
  console.log("Redirect URI being sent:", redirectUri);
  console.log("AUTH_URL:", process.env.AUTH_URL || "(unset)");
  console.log("APP_ORIGIN:", process.env.APP_ORIGIN || "(unset)");
  const state = sign({ n: Date.now(), exp: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.setHeader("Set-Cookie", cookieHeader(STATE_COOKIE, state, req, { maxAge: 600 }));
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  console.log("Google auth URL:", googleAuthUrl);
  res.redirect(302, googleAuthUrl);
};
