const { getSession, publicUser, googleConfigured } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "只接受 GET" });
    return;
  }
  const user = getSession(req);
  res.status(200).json({
    ok: true,
    configured: googleConfigured(),
    user: publicUser(user),
  });
};
