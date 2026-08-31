const { requireUser } = require("../lib/auth");
const { ensureTrial, supabaseAdminConfigured, isInternal, isInternalUser } = require("../lib/supabase");
const insightLab = require("../lib/insight-lab");
const openai = require("../lib/openai");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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

async function requireInternal(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  let internal = false;
  if (supabaseAdminConfigured()) {
    try {
      const row = await ensureTrial(user);
      internal = isInternal(row);
    } catch {
      internal = false;
    }
  }
  if (!internal) internal = await isInternalUser(user.id, user.email);
  if (!internal) {
    res.status(403).json({ ok: false, error: "internal_required", message: "Insight Lab is internal only." });
    return null;
  }
  return user;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const user = await requireInternal(req, res);
    if (!user) return;

    if (req.method === "GET") {
      res.status(200).json({
        ok: true,
        lab: true,
        openai: openai.openaiAvailable(),
        fixtures: insightLab.listFixtures(),
      });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "只接受 POST" });
      return;
    }

    const body = readJsonBody(req);
    const action = String(body.action || "run").trim().toLowerCase();

    if (action === "reveal") {
      const revealed = insightLab.revealLab(body.seal);
      if (!revealed) {
        res.status(400).json({ ok: false, error: "無法顯示對照" });
        return;
      }
      res.status(200).json({ ok: true, data: revealed });
      return;
    }

    if (action !== "run") {
      res.status(400).json({ ok: false, error: "unknown_action" });
      return;
    }

    const result = await insightLab.runLabExperiment({
      raw: body.raw,
      fixtureId: body.fixtureId,
    });
    res.status(200).json({
      ok: true,
      data: {
        version: result.version,
        fingerprint: result.fingerprint,
        fixtureId: result.fixtureId,
        latencyMs: result.latencyMs,
        slots: result.slots,
        seal: result.seal,
      },
    });
  } catch (error) {
    const status = Number(error && error.status) || 500;
    const message = String((error && error.message) || "Insight Lab 失敗").slice(0, 180);
    res.status(status).json({ ok: false, error: message });
  }
};
