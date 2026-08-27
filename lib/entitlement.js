(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiEntitlement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PLUS_FEATURES = {
    deep_journal: true,
    think_ai: true,
    awareness_ai: true,
    execution_ai: true,
    manifest_ai: true,
    body_ai: true,
    insight_ai: true,
    weekly_report_full: true,
    monthly_report_full: true,
    long_term_insight: true,
  };

  function normalizePlan(value) {
    const plan = String(value || "").trim().toLowerCase();
    return plan === "plus" ? "plus" : "free";
  }

  function isPlusPlan(effectivePlan) {
    return normalizePlan(effectivePlan) === "plus";
  }

  function isPlusFeature(feature) {
    return Boolean(PLUS_FEATURES[String(feature || "").trim()]);
  }

  function canUseFeature(effectivePlan, feature) {
    if (!isPlusFeature(feature)) return true;
    return isPlusPlan(effectivePlan);
  }

  function plusRequiredPayload(feature) {
    return {
      ok: false,
      error: "plus_required",
      feature: String(feature || "").trim(),
      message: "This feature requires ING PLUS.",
    };
  }

  function isPlusRequiredPayload(payload) {
    return Boolean(payload && payload.error === "plus_required");
  }

  function featureForReviewRequest(body) {
    const data = body && typeof body === "object" ? body : {};
    const mode = String(data.mode || "").trim();
    const kind = String(data.kind || data.step || "").trim();
    if (mode === "bodycoach") return "body_ai";
    if (mode === "manifest") return "manifest_ai";
    if (mode === "choices") {
      if (kind === "execution" || kind === "execution-choices") return "execution_ai";
      if (kind === "awareness") return "awareness_ai";
      return "think_ai";
    }
    if (mode === "checklist" || mode === "prompts") {
      if (kind === "execution") return "execution_ai";
      if (kind === "awareness") return "awareness_ai";
      if (kind === "manifest") return "manifest_ai";
      return "insight_ai";
    }
    if (mode === "insight" || mode === "think" || mode === "deepen") return "think_ai";
    if (mode === "organize") return "insight_ai";
    return "insight_ai";
  }

  function featureForReportType(type) {
    return String(type || "") === "month" ? "monthly_report_full" : "weekly_report_full";
  }

  function isLocalDevRuntime(env) {
    const source = env || (typeof process !== "undefined" && process.env) || {};
    const vercelEnv = String(source.VERCEL_ENV || "").toLowerCase();
    if (vercelEnv === "production" || vercelEnv === "preview") return false;
    if (vercelEnv === "development") return true;
    return String(source.NODE_ENV || "").toLowerCase() !== "production";
  }

  function isBrowserLocalHost(hostname) {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(String(hostname || ""));
  }

  function membershipCheckFailedPayload() {
    return {
      ok: false,
      error: "membership_check_failed",
      message: "Unable to verify membership right now.",
    };
  }

  async function enforcePlusEntitlement({ feature, res, supabaseReady, loadPlan, env } = {}) {
    if (!res || typeof res.status !== "function") return false;
    if (!supabaseReady) {
      if (isLocalDevRuntime(env)) return true;
      res.status(503).json(membershipCheckFailedPayload());
      return false;
    }
    try {
      const plan = await loadPlan();
      if (!canUseFeature(plan, feature)) {
        res.status(403).json(plusRequiredPayload(feature));
        return false;
      }
      return true;
    } catch (error) {
      console.error("membership check failed:", error && error.message ? error.message : error);
      res.status(503).json(membershipCheckFailedPayload());
      return false;
    }
  }

  return {
    PLUS_FEATURES,
    normalizePlan,
    isPlusPlan,
    isPlusFeature,
    canUseFeature,
    plusRequiredPayload,
    isPlusRequiredPayload,
    featureForReviewRequest,
    featureForReportType,
    isLocalDevRuntime,
    isBrowserLocalHost,
    membershipCheckFailedPayload,
    enforcePlusEntitlement,
  };
});
