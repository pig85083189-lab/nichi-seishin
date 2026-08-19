function chatCompletionsUrl() {
  const raw = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim() || "https://api.openai.com/v1";
  const base = raw.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function parseAiJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("OpenAI 回傳不是 JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
}

function getModel() {
  return String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
}

function abortError() {
  const error = new Error("OpenAI 逾時");
  error.status = 504;
  error.name = "AbortError";
  return error;
}

async function callOpenAI(messages, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error("伺服器尚未設定 OPENAI_API_KEY");
    error.status = 500;
    throw error;
  }

  const opts = typeof options === "number" ? { timeoutMs: options } : options && typeof options === "object" ? options : {};
  const url = chatCompletionsUrl();
  const model = getModel();
  const timeoutMs = Math.max(8000, Math.min(Number(opts.timeoutMs) || 22000, 26000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (/openrouter\.ai/i.test(url)) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://nichi-seishin.vercel.app";
    headers["X-Title"] = "nichi-seishin";
  }

  const payload = {
    model,
    temperature: Number.isFinite(opts.temperature) ? opts.temperature : 0.7,
    messages,
  };
  if (opts.json !== false) payload.response_format = { type: "json_object" };
  const maxTokens = Number(opts.maxTokens);
  if (Number.isFinite(maxTokens) && maxTokens > 0) payload.max_tokens = Math.floor(maxTokens);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = (data && data.error && data.error.message) || `OpenAI 請求失敗（${response.status}）`;
      if (!opts._retried && opts.json !== false && response.status === 400 && /response_format|json_object/i.test(msg)) {
        return callOpenAI(messages, { ...opts, json: false, _retried: true, timeoutMs: Math.min(12000, timeoutMs) });
      }
      if (!opts._retried && payload.max_tokens && response.status === 400 && /max_tokens|max_completion_tokens/i.test(msg)) {
        return callOpenAI(messages, { ...opts, maxTokens: 0, _retried: true, timeoutMs: Math.min(12000, timeoutMs) });
      }
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }
    return parseAiJson(data?.choices?.[0]?.message?.content || "");
  } catch (error) {
    if (error?.name === "AbortError") throw abortError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getApiKey, getModel, callOpenAI };
