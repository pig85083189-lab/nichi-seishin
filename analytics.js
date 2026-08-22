/* 產品行為追蹤。失敗不影響主流程。不收集私人文字。 */
(function (root) {
  const EVENT_NAMES = {
    app_open: "auth",
    auth_signup_completed: "auth",
    login_completed: "auth",
    review_started: "review",
    review_completed: "review",
    quick_review_completed: "review",
    deep_review_completed: "review",
    body_awareness_completed: "body",
    deep_thinking_started: "thinking",
    deep_thinking_completed: "thinking",
    action_card_created: "execution",
    action_card_completed: "execution",
    weekly_report_generated: "report",
    weekly_report_viewed: "report",
    monthly_report_generated: "report",
    monthly_report_viewed: "report",
    manifestation_created: "manifest",
    history_viewed: "nav",
    subscription_page_viewed: "nav",
    trial_started: "billing",
    trial_expired: "billing",
    subscription_started: "billing",
  };
  const META_KEYS = { mode: 1, source: 1, step: 1, kind: 1, type: 1, period: 1, plan: 1, status: 1, feature: 1, round: 1 };
  const ONCE = { auth_signup_completed: 1, trial_started: 1, trial_expired: 1, subscription_started: 1 };
  const recent = new Map();
  let deps = { getClient: null, getUser: null };

  function storageGet(store, key) {
    try {
      return store.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function storageSet(store, key, value) {
    try {
      store.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function sessionId() {
    const key = "nichi.analytics.session";
    let id = storageGet(sessionStorage, key);
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      storageSet(sessionStorage, key, id);
    }
    return id;
  }

  function sanitizeMeta(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const next = {};
    Object.keys(src).forEach((key) => {
      if (!META_KEYS[key]) return;
      const value = src[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        next[key] = Math.round(value);
        return;
      }
      if (typeof value === "boolean") {
        next[key] = value;
        return;
      }
      const text = String(value || "").trim();
      if (!text || text.length > 24 || /[。！？\n]/.test(text)) return;
      next[key] = text;
    });
    return next;
  }

  function onceKey(name, userId) {
    return `nichi.analytics.once.${name}.${userId || "anon"}`;
  }

  async function trackEvent(eventName, metadata) {
    const name = String(eventName || "").trim();
    if (!EVENT_NAMES[name]) return false;
    const user = deps.getUser ? deps.getUser() : null;
    if (!user || !user.id) return false;
    if (ONCE[name] && storageGet(localStorage, onceKey(name, user.id))) return false;
    const meta = sanitizeMeta(metadata);
    const stamp = `${name}:${JSON.stringify(meta)}`;
    const now = Date.now();
    const last = recent.get(stamp) || 0;
    if (now - last < 2000) return false;
    recent.set(stamp, now);
    if (name === "app_open" && storageGet(sessionStorage, "nichi.analytics.app_open")) return false;
    try {
      const client = deps.getClient ? await deps.getClient() : null;
      if (!client) return false;
      const { error } = await client.from("analytics_events").insert({
        user_id: user.id,
        event_name: name,
        event_category: EVENT_NAMES[name],
        event_metadata: meta,
        session_id: sessionId(),
      });
      if (error) return false;
      if (ONCE[name]) storageSet(localStorage, onceKey(name, user.id), "1");
      if (name === "app_open") storageSet(sessionStorage, "nichi.analytics.app_open", "1");
      return true;
    } catch {
      return false;
    }
  }

  function trackOnceSession(eventName, metadata, key) {
    const flag = `nichi.analytics.sess.${key || eventName}`;
    if (storageGet(sessionStorage, flag)) return Promise.resolve(false);
    storageSet(sessionStorage, flag, "1");
    return trackEvent(eventName, metadata);
  }

  root.NichiAnalytics = {
    bind(next) {
      deps = { ...deps, ...(next || {}) };
    },
    trackEvent,
    trackOnceSession,
    sessionId,
  };
  root.trackEvent = trackEvent;
})(window);
