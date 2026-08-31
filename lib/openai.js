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

function incompleteAiError() {
  const error = new Error("AI 回覆不完整");
  error.code = "INCOMPLETE_AI";
  return error;
}

function assertCompleteAiStop(reason) {
  const stop = String(reason || "").toLowerCase();
  if (stop === "length" || stop === "max_tokens") throw incompleteAiError();
}

function parseAiJson(raw, opts = {}) {
  const candidate = stripJsonFences(raw);
  if (!candidate) throw new Error("AI 回傳不是 JSON");
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
  // Never turn a mid-string cutoff into a "valid" shorter field. Incomplete JSON must fail.
  if (opts.rejectPartial !== false) throw incompleteAiError();
  const repaired = repairTruncatedJson(candidate);
  if (repaired != null) return repaired;
  throw new Error("AI 回傳不是 JSON");
}

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const INTERNAL_CLAUDE_MODEL = "claude-sonnet-5";

function isClaudeSonnet5(model) {
  return /^claude-sonnet-5\b/i.test(String(model || "").trim());
}

function resolveClaudeModel(options) {
  // Server-only. Ignore any client-supplied model string.
  if (options && options.internal === true) return INTERNAL_CLAUDE_MODEL;
  return usableKey(process.env.ANTHROPIC_MODEL) || usableKey(process.env.CLAUDE_MODEL) || DEFAULT_CLAUDE_MODEL;
}

function extractClaudeText(data) {
  const blocks = Array.isArray(data && data.content) ? data.content : [];
  return blocks
    .filter((part) => part && part.type === "text")
    .map((part) => String(part.text || ""))
    .join("");
}

function buildClaudePayload(messages, opts, model) {
  const { system, messages: claudeMessages } = splitClaudeMessages(messages);
  const requested = Number(opts && opts.maxTokens);
  const baseTokens = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 4096;
  const payload = {
    model,
    max_tokens: isClaudeSonnet5(model) ? Math.max(baseTokens, 16000) : baseTokens,
    messages: claudeMessages,
  };
  if (system) payload.system = system;
  if (isClaudeSonnet5(model)) {
    const effort = String((opts && opts.effort) || "high").trim() || "high";
    payload.output_config = { effort };
  } else {
    payload.temperature = Number.isFinite(opts && opts.temperature) ? opts.temperature : 0.7;
  }
  return payload;
}

function claudeTimeoutMs(opts, model) {
  const requested = Number(opts && opts.timeoutMs);
  if (isClaudeSonnet5(model)) {
    return Math.max(15000, Math.min(Number.isFinite(requested) ? requested : 45000, 60000));
  }
  return Math.max(8000, Math.min(Number.isFinite(requested) ? requested : 22000, 26000));
}

function usableKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (/replace-me|your[_-]?key|placeholder/i.test(key)) return "";
  return key;
}

function getAnthropicKey() {
  return usableKey(process.env.ANTHROPIC_API_KEY) || usableKey(process.env.CLAUDE_API_KEY);
}

function getOpenAIKey() {
  return usableKey(process.env.OPENAI_API_KEY) || usableKey(process.env.OPENROUTER_API_KEY);
}

const LAB_GPT_MODEL = "gpt-5.6-sol";

function openaiAvailable() {
  return Boolean(getOpenAIKey());
}

function wantsOpenAI(options) {
  const opts = options && typeof options === "object" ? options : {};
  return String(opts.forceProvider || opts.provider || "").trim().toLowerCase() === "openai";
}

function isGpt5Family(model) {
  return /^gpt-5/i.test(String(model || "").trim());
}

function getApiKey() {
  return getAnthropicKey() || getOpenAIKey();
}

function usesClaude() {
  return Boolean(getAnthropicKey());
}

function getProvider() {
  return usesClaude() ? "claude" : "openai";
}

function internalDebugMeta(options) {
  let provider = "openai";
  if (usesClaude()) provider = "anthropic";
  else if (/openrouter\.ai/i.test(String(typeof chatCompletionsUrl === "function" ? chatCompletionsUrl() : ""))) provider = "openrouter";
  return {
    provider,
    model: getModel(options),
  };
}

function getModel(options) {
  if (wantsOpenAI(options)) {
    if (options && options.lab) return LAB_GPT_MODEL;
    return usableKey(process.env.OPENAI_MODEL) || LAB_GPT_MODEL;
  }
  if (usesClaude()) return resolveClaudeModel(options);
  return usableKey(process.env.OPENAI_MODEL) || "gpt-4o-mini";
}

function abortError(provider) {
  const viaOpenAI = provider === "openai" || (!provider && !usesClaude());
  const error = new Error(viaOpenAI ? "OpenAI 逾時" : "Claude 逾時");
  error.status = 504;
  error.name = "AbortError";
  return error;
}

function normalizeUsage(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const input = Number(data.input_tokens || data.prompt_tokens || 0) || 0;
  const output = Number(data.output_tokens || data.completion_tokens || 0) || 0;
  const reasoning = Number(
    (data.output_tokens_details && data.output_tokens_details.reasoning_tokens) ||
      data.reasoning_tokens ||
      0
  ) || 0;
  const total = Number(data.total_tokens || input + output) || input + output;
  return { input, output, reasoning, total };
}

function finishWithMeta(parsed, extra, opts) {
  if (opts && opts.returnMeta) {
    return { data: parsed, ...extra };
  }
  return parsed;
}

function buildOpenAIPayload(messages, opts, model) {
  const payload = { model, messages };
  if (opts.json !== false) payload.response_format = { type: "json_object" };
  const maxTokens = Number(opts.maxTokens);
  const cap = Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : 0;
  if (isGpt5Family(model)) {
    if (opts.skipReasoning !== true) {
      // Chat Completions official field is top-level reasoning_effort.
      // Responses API uses reasoning.effort — this path is Chat Completions only.
      const fallback = opts.lab ? "high" : "medium";
      const effort = String((opts && opts.effort) || fallback).trim() || fallback;
      payload.reasoning_effort = effort;
    }
    if (cap) payload.max_completion_tokens = cap;
  } else {
    payload.temperature = Number.isFinite(opts.temperature) ? opts.temperature : 0.7;
    if (cap) payload.max_tokens = cap;
  }
  return payload;
}

function splitClaudeMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const system = list
    .filter((item) => item && item.role === "system")
    .map((item) => String(item.content || "").trim())
    .filter(Boolean)
    .join("\n\n");
  const rest = list
    .filter((item) => item && item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || "").trim(),
    }))
    .filter((item) => item.content);
  const merged = [];
  rest.forEach((item) => {
    const last = merged[merged.length - 1];
    if (last && last.role === item.role) last.content = `${last.content}\n\n${item.content}`;
    else merged.push({ ...item });
  });
  if (!merged.length) merged.push({ role: "user", content: "請依系統指示輸出 JSON。" });
  if (merged[0].role !== "user") merged.unshift({ role: "user", content: "請開始。" });
  return { system, messages: merged };
}

async function callClaude(messages, opts) {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    const error = new Error("伺服器尚未設定 ANTHROPIC_API_KEY");
    error.status = 500;
    throw error;
  }
  const model = resolveClaudeModel(opts);
  const payload = buildClaudePayload(messages, opts || {}, model);
  const timeoutMs = claudeTimeoutMs(opts, model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = (data && data.error && data.error.message) || `Claude 請求失敗（${response.status}）`;
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }
    const text = extractClaudeText(data);
    assertCompleteAiStop(data.stop_reason);
    const parsed = parseAiJson(text, { rejectPartial: opts.rejectPartial !== false });
    return finishWithMeta(
      parsed,
      {
        usage: normalizeUsage(data.usage),
        model,
        provider: "anthropic",
        reasoningEffort: isClaudeSonnet5(model) ? String((opts && opts.effort) || "high") : "",
        endpoint: "anthropic.messages",
      },
      opts
    );
  } catch (error) {
    if (error?.name === "AbortError") throw abortError("anthropic");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAIHttp(messages, opts) {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    const error = new Error("伺服器尚未設定 OPENAI_API_KEY");
    error.status = 500;
    throw error;
  }

  const url = chatCompletionsUrl();
  const model = getModel(opts);
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

  const payload = buildOpenAIPayload(messages, opts, model);

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
        return callOpenAIHttp(messages, { ...opts, json: false, _retried: true, timeoutMs: Math.min(12000, timeoutMs) });
      }
      if (
        !opts._retried &&
        (payload.max_tokens || payload.max_completion_tokens) &&
        response.status === 400 &&
        /max_tokens|max_completion_tokens/i.test(msg)
      ) {
        return callOpenAIHttp(messages, { ...opts, maxTokens: 0, _retried: true, timeoutMs: Math.min(12000, timeoutMs) });
      }
      if (
        !opts.lab &&
        !opts._retried &&
        isGpt5Family(model) &&
        response.status === 400 &&
        /temperature|reasoning_effort/i.test(msg)
      ) {
        return callOpenAIHttp(messages, { ...opts, skipReasoning: true, _retried: true, timeoutMs: Math.min(12000, timeoutMs) });
      }
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }
    assertCompleteAiStop(data?.choices?.[0]?.finish_reason);
    const parsed = parseAiJson(data?.choices?.[0]?.message?.content || "", { rejectPartial: opts.rejectPartial !== false });
    return finishWithMeta(
      parsed,
      {
        usage: normalizeUsage(data.usage),
        model: data.model || model,
        provider: "openai",
        reasoningEffort: payload.reasoning_effort || "",
        endpoint: "chat.completions",
      },
      opts
    );
  } catch (error) {
    if (error?.name === "AbortError") throw abortError("openai");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(messages, options = {}) {
  const opts = typeof options === "number" ? { timeoutMs: options } : options && typeof options === "object" ? options : {};
  // Production default: Anthropic key 存在時一律走 Claude。Lab 才可用 forceProvider=openai。
  if (usesClaude() && !wantsOpenAI(opts)) return callClaude(messages, opts);
  if (wantsOpenAI(opts) || !usesClaude()) return callOpenAIHttp(messages, opts);

  const error = new Error("伺服器尚未設定 ANTHROPIC_API_KEY 或 OPENAI_API_KEY");
  error.status = 500;
  throw error;
}

module.exports = {
  getApiKey,
  getOpenAIKey,
  getModel,
  getProvider,
  internalDebugMeta,
  usesClaude,
  openaiAvailable,
  wantsOpenAI,
  callOpenAI,
  parseAiJson,
  repairTruncatedJson,
  incompleteAiError,
  DEFAULT_CLAUDE_MODEL,
  INTERNAL_CLAUDE_MODEL,
  LAB_GPT_MODEL,
  resolveClaudeModel,
  extractClaudeText,
  buildClaudePayload,
  buildOpenAIPayload,
  isClaudeSonnet5,
  isGpt5Family,
  normalizeUsage,
};
