const { getSession, publicUser, authConfigured } = require("../../lib/auth");
const { kvConfigured, loadMembership } = require("../../lib/store");
const { supabaseConfigured } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "只接受 GET" });
    return;
  }
  const user = await getSession(req);
  let membership = null;
  if (user && kvConfigured()) {
    membership = await loadMembership(user.id);
  }
  res.status(200).json({
    ok: true,
    configured: authConfigured(),
    supabaseConfigured: supabaseConfigured(),
    payConfigured: false,
    user: publicUser(user),
    membership: membership && membership.paid ? { paid: true, paidAt: membership.paidAt || "", plan: membership.plan || "member" } : null,
  });
};
