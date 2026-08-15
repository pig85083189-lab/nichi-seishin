const { appOrigin, cookieHeader, SESSION_COOKIE, STATE_COOKIE } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  res.setHeader("Set-Cookie", [
    cookieHeader(SESSION_COOKIE, "", req, { clear: true }),
    cookieHeader(STATE_COOKIE, "", req, { clear: true }),
  ]);
  if (req.method === "GET") {
    res.redirect(302, `${appOrigin()}/?auth=out`);
    return;
  }
  res.status(200).json({ ok: true });
};
