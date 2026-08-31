const reviewHandler = require("./review");
const { requireUser } = require("../lib/auth");
const { ensureTrial, effectivePlanFromRow, supabaseAdminConfigured, isInternal } = require("../lib/supabase");
const { enforcePlusEntitlement } = require("../lib/entitlement");
const { getApiKey, getModel, getProvider, internalDebugMeta, usesClaude, callOpenAI } = require("../lib/openai");

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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function isReviewPayload(body) {
  if (!body || typeof body !== "object") return false;
  if (body.mode) return true;
  if (body.variant === "think-guide" || body.context?.variant === "think-guide") return true;
  return false;
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      configured: Boolean(getApiKey()),
      auth: require("../lib/auth").authConfigured(),
      provider: getProvider(),
      usesClaude: usesClaude(),
      model: getModel(),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "只接受 POST" });
    return;
  }

  const body = readJsonBody(req);
  delete body.model;
  delete body.internal;
  delete body.forceProvider;
  delete body.provider;
  if (isReviewPayload(body)) {
    return reviewHandler(req, res);
  }

  const user = await requireUser(req, res);
  if (!user) return;

  let membershipRow = null;
  let internalUser = false;
  if (supabaseAdminConfigured()) {
    try {
      membershipRow = await ensureTrial(user);
      internalUser = isInternal(membershipRow);
    } catch (error) {
      console.error("ensureTrial in chat:", error && error.message ? error.message : error);
    }
  }

  const allowed = await enforcePlusEntitlement({
    feature: "think_ai",
    res,
    supabaseReady: supabaseAdminConfigured(),
    loadPlan: async () => {
      const row = membershipRow || (await ensureTrial(user));
      return { plan: effectivePlanFromRow(row), isInternal: isInternal(row) };
    },
  });
  if (!allowed) return;

  const origJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && payload.ok === true && internalUser) {
      return origJson({ ...payload, _internalDebug: internalDebugMeta({ internal: true }) });
    }
    return origJson(payload);
  };

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    res.status(400).json({ ok: false, error: "缺少 messages 或深度思考內容" });
    return;
  }

  try {
    const data = await callOpenAI(messages, {
      internal: internalUser,
      temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7,
      timeoutMs: internalUser ? 45000 : 22000,
      json: body.json !== false,
      maxTokens: Number(body.maxTokens) || 1024,
    });
    res.status(200).json({
      ok: true,
      source: getProvider(),
      provider: getProvider(),
      model: getModel({ internal: internalUser }),
      data,
    });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? (usesClaude() ? "Claude 逾時" : "OpenAI 逾時") : String(error.message || "伺服器錯誤"),
    });
  }
};
