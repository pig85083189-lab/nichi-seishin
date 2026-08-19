function chatCompletionsUrl() {
  const raw = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim() || "https://api.openai.com/v1";
  const base = raw.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function stripJsonFences(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function tryParseJson(text) {
  const candidate = String(text || "").trim();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

function repairTruncatedJson(text) {
  const raw = String(text || "");
  const objStart = raw.indexOf("{");
  const arrStart = raw.indexOf("[");
  if (objStart === -1 && arrStart === -1) return null;
  const start = arrStart === -1 || (objStart !== -1 && objStart < arrStart) ? objStart : arrStart;
  let slice = raw.slice(start).replace(/,\s*$/, "");
  let inStr = false;
  let esc = false;
  for (let i = 0; i < slice.length; i += 1) {
    const ch = slice[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
  }
  if (inStr) slice += '"';
  const stack = [];
  inStr = false;
  esc = false;
  for (let i = 0; i < slice.length; i += 1) {
    const ch = slice[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  slice += stack.reverse().join("");
  return tryParseJson(slice);
}

function parseAiJson(raw) {
  const candidate = stripJsonFences(raw);
  if (!candidate) throw new Error("OpenAI 回傳不是 JSON");
  const objectStart = candidate.indexOf("{");
  const arrayStart = candidate.indexOf("[");
  const slices = [];
  if (objectStart !== -1) {
    const end = candidate.lastIndexOf("}");
    slices.push(end > objectStart ? candidate.slice(objectStart, end + 1) : candidate.slice(objectStart));
  }
  if (arrayStart !== -1) {
    const end = candidate.lastIndexOf("]");
    slices.push(end > arrayStart ? candidate.slice(arrayStart, end + 1) : candidate.slice(arrayStart));
  }
  slices.push(candidate);
  for (const item of slices) {
    const parsed = tryParseJson(item);
    if (parsed != null) return parsed;
  }
  const repaired = repairTruncatedJson(candidate);
  if (repaired != null) return repaired;
  throw new Error("OpenAI 回傳不是 JSON");
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
