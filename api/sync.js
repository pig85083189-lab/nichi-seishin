const { getSession, bearerToken } = require("../lib/auth");
const { cloudStoreConfigured, loadUserData, saveUserData } = require("../lib/store");

function readJsonBody(req) {
  const raw = req.body;
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw;
  return {};
}

function publicSyncError(error, status) {
  const message = String((error && error.message) || error || "");
  const code = Number(status) || 0;
  if (code === 401 || /請先登入|未登入|jwt|token/i.test(message)) {
    return {
      code: "auth",
      error: "登入狀態剛過期，紀錄已先留在這台裝置。請再點一次重新同步。",
    };
  }
  if (/permission|42501|rls|沒有權限/i.test(message)) {
    return {
      code: "permission",
      error: "雲端這次沒有收下資料，已先存在這台裝置。網路穩定後可再同步。",
    };
  }
  if (/fetch|network|ENOTFOUND|timeout|逾時|ECONN/i.test(message)) {
    return {
      code: "network",
      error: "這次連不到雲端，紀錄已先留在這台裝置。稍候再同步即可。",
    };
  }
  return {
    code: "sync",
    error: "這次還沒送到雲端，紀錄已先存在這台裝置。稍候再同步即可。",
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const body = req.method === "GET" ? {} : readJsonBody(req);
  const user = await getSession(req, {
    accessToken: body.access_token || body.accessToken,
  });
  if (!user) {
    res.status(401).json({
      ok: false,
      ...publicSyncError(new Error("請先登入"), 401),
    });
    return;
  }

  if (!cloudStoreConfigured()) {
    res.status(503).json({
      ok: false,
      code: "config",
      error: "雲端備份還在準備中，紀錄已先存在這台裝置。",
    });
    return;
  }

  const extra = {
    userToken: bearerToken(req, body) || body.access_token || body.accessToken || "",
    email: body.email || user.email || "",
  };

  try {
    if (req.method === "GET") {
      const data = await loadUserData(user.id, extra);
      res.status(200).json({ ok: true, userId: user.id, data });
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const saved = await saveUserData(user.id, { ...body, email: extra.email }, extra);
      console.log("api/sync saved", {
        userId: user.id,
        updatedAt: saved && saved.updatedAt,
        degraded: Boolean(saved && saved.degraded),
        reviewDays: saved && saved.reviews ? Object.keys(saved.reviews).length : 0,
      });
      res.status(200).json({
        ok: true,
        userId: user.id,
        updatedAt: saved && saved.updatedAt,
        degraded: Boolean(saved && saved.degraded),
      });
      return;
    }

    res.status(405).json({ ok: false, error: "這次請求方式還不能同步，請再試一次。" });
  } catch (error) {
    console.error("api/sync failed", {
      userId: user.id,
      method: req.method,
      message: error && error.message ? error.message : error,
      stack: error && error.stack ? String(error.stack).slice(0, 800) : "",
    });
    const mapped = publicSyncError(error, 500);
    res.status(500).json({
      ok: false,
      ...mapped,
      reason: String((error && error.message) || error || "").slice(0, 300),
    });
  }
};
