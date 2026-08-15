const { requireUser } = require("./lib/auth");
const { kvConfigured, loadUserData, saveUserData } = require("./lib/store");

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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (!kvConfigured()) {
    res.status(503).json({ ok: false, error: "尚未設定 Vercel KV，無法同步雲端備份" });
    return;
  }

  try {
    if (req.method === "GET") {
      const data = await loadUserData(user.id);
      res.status(200).json({ ok: true, userId: user.id, data });
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = readJsonBody(req);
      const saved = await saveUserData(user.id, body);
      res.status(200).json({ ok: true, userId: user.id, data: saved });
      return;
    }

    res.status(405).json({ ok: false, error: "只接受 GET / PUT" });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || "同步失敗") });
  }
};
