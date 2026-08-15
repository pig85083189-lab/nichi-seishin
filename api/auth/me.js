const { getSession, publicUser, authConfigured } = require("../../lib/auth");
const { supabaseConfigured, ensureTrial, publicMembership } = require("../../lib/supabase");
const { newebpayConfigured } = require("../../lib/newebpay");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "只接受 GET" });
    return;
  }
  const user = await getSession(req);
  let membership = null;
  if (user) {
    try {
      const row = await ensureTrial(user);
      membership = publicMembership(row);
    } catch (error) {
      console.error("ensureTrial failed:", error && error.message ? error.message : error);
    }
  }
  res.status(200).json({
    ok: true,
    configured: authConfigured(),
    supabaseConfigured: supabaseConfigured(),
    payConfigured: newebpayConfigured(),
    user: publicUser(user),
    membership,
  });
};
