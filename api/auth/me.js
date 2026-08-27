const { getSession, publicUser, authConfigured } = require("../../lib/auth");
const { supabaseConfigured, ensureTrial, publicMembership, isInternalUser, decorateInternalAccess } = require("../../lib/supabase");
const { newebpayConfigured } = require("../../lib/newebpay");
const { insertAnalyticsEvent } = require("../../lib/analytics");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "只接受 GET" });
    return;
  }
  const user = await getSession(req);
  let membership = null;
  let membershipError = "";
  if (user) {
    try {
      const row = await ensureTrial(user);
      const internal = Boolean((row && String(row.access_type || "").toLowerCase() === "internal") || (await isInternalUser(user.id, user.email)));
      membership = publicMembership(decorateInternalAccess(row, user.id, internal));
      console.log("auth/me membership", {
        userId: user.id,
        isInternal: Boolean(membership && membership.isInternal),
        accessType: membership && membership.accessType,
        plusTrialActive: Boolean(membership && membership.plusTrialActive),
        effectivePlan: membership && membership.effectivePlan,
        status: membership && membership.status,
      });
      if (!membership || !membership.isInternal) {
        insertAnalyticsEvent({
          userId: user.id,
          eventName: "trial_started",
          metadata: { source: "auth" },
          uniqueOnce: true,
        }).catch(() => {});
        if (membership && (membership.paid || membership.isPaid)) {
          insertAnalyticsEvent({
            userId: user.id,
            eventName: "subscription_started",
            metadata: { source: "auth" },
            uniqueOnce: true,
          }).catch(() => {});
        } else if (membership && membership.status === "expired") {
          insertAnalyticsEvent({
            userId: user.id,
            eventName: "trial_expired",
            metadata: { source: "auth" },
            uniqueOnce: true,
          }).catch(() => {});
        }
      }
    } catch (error) {
      membershipError = String(error && error.message ? error.message : error);
      console.error("ensureTrial failed:", {
        message: membershipError,
        name: error && error.name,
        stack: error && error.stack,
      });
    }
  }
  res.status(200).json({
    ok: true,
    configured: authConfigured(),
    supabaseConfigured: supabaseConfigured(),
    payConfigured: newebpayConfigured(),
    user: publicUser(user),
    membership,
    membershipError: membershipError || undefined,
  });
};
