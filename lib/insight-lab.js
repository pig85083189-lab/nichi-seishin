"use strict";

const crypto = require("crypto");
const openai = require("./openai");
const voice = require("./ing-voice");
const insightReason = require("./insight-reason");
const reflectionV3 = require("./reflection-v3");
const valueGate = require("./insight-value-gate");
const textIntegrity = require("./text-integrity");
const { authSecret } = require("./auth");

const LAB_VERSION = "insight-lab-v2";
const SLOT_KEYS = ["A", "B", "C"];
const PIPELINE_IDS = ["current", "gpt", "council"];
const PIPELINE_LABELS = {
  current: "Current ING",
  gpt: "GPT",
  council: "Council",
};

const LAB_CLAUDE_TIMEOUT = 26000;
const LAB_GPT_TIMEOUT = 26000;
const LAB_GPT_EFFORT = "high";
const LAB_GPT_MAX_COMPLETION_TOKENS = 25000;
const LAB_GPT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const LAB_A_REASON_TIMEOUT = 26000;
const LAB_A_WRITE_TIMEOUT = 26000;
const LAB_MAX_SLOT_STEPS = 6;

const GPT_INDEPENDENT_SYSTEM = `你正在閱讀一個人今天真正寫下的內容。

你的任務不是摘要她寫了什麼，
也不是安慰她，
更不是為了顯得有深度而硬問問題。

先完整理解她今天寫的內容。

然後只找：

「有沒有一件她自己沒有直接說出來，
但把她寫的內容放在一起後，
可以合理看見的事情？」

這個看見必須：
1. 有她原文中的具體證據。
2. 不是把她的話換句話說。
3. 不是一般常識。
4. 不是心理診斷。
5. 不是硬把正向的一天解讀成有問題。
6. 能讓她讀完產生：
   「我原本沒有這樣想過。」
   或
   「原來這幾件事可能有關係。」

如果沒有真正值得說的新東西，
請直接判斷沒有。

不要為了完成任務硬生洞察。

問題不是必須的。

只有當一個問題真的可以讓她多知道自己一件事時，
才問一個問題。

請用自然、白話、像真正理解她的人說話。
不要心理報告語氣。
不要心靈雞湯。
不要 AI 套話。

只輸出 JSON：
{"hasInsight":true,"title":"","insight":"","question":null}
或
{"hasInsight":false,"title":"","insight":"","question":null}

只給 ONE best insight。不要 3 個。question 沒有就 null。`;

const COUNCIL_ANALYST_SYSTEM = `你是內部分析員，不是寫給使用者看的教練。
從 USER RAW 找最多 5 個可能值得看的洞察。
不要寫 title。不要寫溫柔文案。不要問問題。

優先：cross-section connection、change、pattern、value、success pattern、genuine tension。
禁止：paraphrase、trivial inference、unsupported psychology。
正向的一天不要硬找陰影。孤立的「想睡／累」不要當洞察。
沒有值得看的可以 candidates 空陣列。

只輸出 JSON：
{"candidates":[{"id":"c1","idea":"","evidence":[""],"whyItMayMatter":"","confidence":"high|medium|low"}]}`;

const COUNCIL_CRITIC_SYSTEM = `你的工作不是順著前一位分析員。
你要挑戰它。

逐一判斷：
- 這不是使用者自己已經知道的嗎？
- 這是不是換句話說？
- 這是不是常識？
- evidence 真的支持嗎？
- 有沒有腦補？
- 看完是不是只會「所以呢？」
- 有沒有更好的 connection 被漏掉？

每個 candidate：KEEP / REVISE / DROP
可以 ADD 最多 1 個被漏掉的高價值 connection。
最多留下 3 個。可以 1 個。可以 0 個。
不要寫給使用者看的文案。不要完整 chain-of-thought。

只輸出 JSON：
{"items":[{"id":"c1","verdict":"KEEP|REVISE|DROP","idea":"","reason":"","evidence":[""]}],"added":[{"idea":"","evidence":[""],"reason":""}]}`;

const COUNCIL_MENTOR_SYSTEM = `從通過批判的候選中，選 ONE BEST insight 寫給使用者。
不要發明新洞察。不要重述使用者自己已經寫出的話。
沒有真正有價值就 hasInsight false。
question 可空。只有回答後會多知道自己一件事才問。
白話、像人。不要心理報告。不要雞湯。

只輸出 JSON：
{"hasInsight":true,"title":"","insight":"","question":null}
或
{"hasInsight":false,"title":"","insight":"","question":null}`;

const FIXTURES = {
  "fx-baby": {
    id: "fx-baby",
    label: "Benchmark：覺察 × Baby",
    thanksText:
      "最近每天都會做一些覺察，也發現跟 Baby 聊的東西變多了。今天我們又一起去吃拉麵，他還幫我切奇異果，我覺得這些很平凡的小事其實很幸福。",
    event: "今天心情很好。",
    mood: "開心",
    bodyMindText: "身體特別累，一直想睡。",
    expect: {
      allowEmpty: false,
      preferHasInsight: true,
      bad: [
        /你很重視幸福/,
        /陪伴讓你覺得幸福/,
        /想睡代表你累/,
        /開心和累可以同時存在/,
        /你是不是很珍惜 Baby/,
        /平凡的小事對你很重要/,
      ],
      goodSignals: [/覺察/, /聊/, /關係|相處|交流|互動/],
    },
  },
  "fx-sparse": {
    id: "fx-sparse",
    label: "Benchmark：資訊不足",
    thanksText: "",
    event: "今天特別累，一直想睡。",
    mood: "平靜",
    bodyMindText: "一直想睡。",
    expect: {
      allowEmpty: true,
      preferHasInsight: false,
      bad: [/身體在提醒你休息/, /想睡代表/, /你的身體在告訴你/],
      goodSignals: [],
    },
  },
  "fx-positive": {
    id: "fx-positive",
    label: "Benchmark：正向日",
    thanksText: "今天工作順利，學到新東西。",
    event: "和喜歡的人吃飯，今天很開心。",
    mood: "開心",
    bodyMindText: "身體很輕鬆。",
    expect: {
      allowEmpty: true,
      preferHasInsight: false,
      bad: [/害怕失去/, /依賴/, /內在不安全/, /如果明天不順利/],
      goodSignals: [/順利|學到|值得留|正在做對|可複製/],
    },
  },
};

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactLine(value, max) {
  const text = asText(value);
  const limit = Number(max) || 240;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function journalUserRaw(journal) {
  const data = journal && typeof journal === "object" ? journal : {};
  const mind = data.bodyMind && typeof data.bodyMind === "object" ? data.bodyMind : {};
  let thanksText = "";
  if (typeof data.thanksText === "string" && data.thanksText.trim()) thanksText = data.thanksText.trim();
  else if (typeof data.thanks === "string") thanksText = data.thanks.trim();
  else if (Array.isArray(data.thanks)) {
    thanksText = data.thanks.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
  }
  return {
    thanksText,
    event: asText(data.event || ""),
    mood: asText(data.mood || ""),
    bodyMindText: asText(mind.text || data.bodyNote || ""),
  };
}

function listLabDates(reviews, options = {}) {
  const map = reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {};
  const todayIso = String(options.todayIso || "").trim();
  const isFinalized = typeof options.isFinalized === "function"
    ? options.isFinalized
    : (review) => Boolean(review && String(review.completedAt || "").trim());
  const rawFrom = typeof options.rawFromJournal === "function" ? options.rawFromJournal : journalUserRaw;
  const days = Object.keys(map)
    .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
    .filter((iso) => {
      const review = map[iso];
      if (!hasLabRaw(rawFrom(review && review.journal))) return false;
      return isFinalized(review) || iso === todayIso;
    })
    .sort()
    .reverse();
  if (todayIso && !days.includes(todayIso) && options.todayJournal && hasLabRaw(rawFrom(options.todayJournal))) {
    days.unshift(todayIso);
  }
  return days;
}

function sanitizeRaw(input, fixtureId) {
  const fx = fixtureId && FIXTURES[fixtureId] ? FIXTURES[fixtureId] : null;
  const src = fx || (input && typeof input === "object" ? input : {});
  return {
    thanksText: voice.userRawForPrompt(src.thanksText || src.thanks || ""),
    event: voice.userRawForPrompt(src.event || ""),
    mood: asText(src.mood || src.moodLabel).slice(0, 40),
    bodyMindText: voice.userRawForPrompt(src.bodyMindText || src.bodyNote || ""),
  };
}

function hasLabRaw(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return Boolean(asText(data.thanksText) || asText(data.event) || asText(data.bodyMindText));
}

function formatUserRaw(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return `【01 感謝】
${data.thanksText || "未寫"}

【02 事件】
${data.event || "未寫"}

【02 心情】
${data.mood || "未選"}

【03 身心覺察原文】
${data.bodyMindText || "未寫"}`;
}

function rawFingerprint(raw) {
  return crypto.createHash("sha256").update(formatUserRaw(raw), "utf8").digest("hex").slice(0, 16);
}

function emptyItem() {
  return { hasInsight: false, title: "", insight: "", question: null };
}

function normalizeOneInsight(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const has = src.hasInsight !== false && Boolean(asText(src.insight || src.title));
  const question = asText(src.question);
  return {
    hasInsight: has,
    title: has ? asText(src.title).slice(0, 40) : "",
    insight: has ? asText(src.insight) : "",
    question: has && question ? question : null,
  };
}

function itemsFromCurrent(written) {
  const gated = written && typeof written === "object" ? written : {};
  const questions = Array.isArray(gated.questions) ? gated.questions : [];
  const items = questions
    .map((item) =>
      normalizeOneInsight({
        hasInsight: true,
        title: item && item.title,
        insight: item && (item.insight || item.text),
        question: item && item.question,
      })
    )
    .filter((item) => item.hasInsight)
    .slice(0, 3);
  if (!items.length && asText(gated.coreQuote)) {
    items.push(normalizeOneInsight({ hasInsight: true, title: "", insight: gated.coreQuote, question: null }));
  }
  return items;
}

function publicItems(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [{ ...emptyItem() }];
  return list.map((item) => ({
    hasInsight: Boolean(item.hasInsight),
    title: item.hasInsight ? asText(item.title) : "",
    insight: item.hasInsight ? asText(item.insight) : "",
    question: item.hasInsight && item.question ? asText(item.question) : null,
  }));
}

function slimUsage(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    input: Number(data.input || 0) || 0,
    output: Number(data.output || data.completionTokens || 0) || 0,
    reasoning: Number(data.reasoning || data.reasoningTokens || 0) || 0,
    total: Number(data.total || 0) || 0,
    completionTokens: Number(data.completionTokens || data.output || 0) || 0,
    reasoningTokens: Number(data.reasoningTokens || data.reasoning || 0) || 0,
  };
}

function errorDebug(error) {
  const dbg = (error && error.labCall) || (error && error.providerDebug) || {};
  return {
    stage: asText(dbg.stage),
    provider: asText(dbg.provider),
    model: asText(dbg.model),
    reasoningEffort: asText(dbg.reasoningEffort),
    httpStatus: dbg.httpStatus != null ? dbg.httpStatus : error && error.status != null ? error.status : null,
    finishReason: asText(dbg.finishReason),
    stopReason: asText(dbg.stopReason),
    latencyMs: Number(dbg.latencyMs || 0) || 0,
    code: asText(dbg.code || (error && error.code)),
    usage: dbg.usage ? slimUsage(dbg.usage) : null,
  };
}

function slimCall(meta) {
  const item = meta && typeof meta === "object" ? meta : {};
  return {
    stage: asText(item.stage),
    provider: asText(item.provider),
    model: asText(item.model),
    reasoningEffort: asText(item.reasoningEffort),
    latencyMs: Number(item.latencyMs || 0) || 0,
    usage: slimUsage(item.usage),
    httpStatus: item.httpStatus != null ? item.httpStatus : null,
    finishReason: asText(item.finishReason),
    stopReason: asText(item.stopReason),
  };
}

function failedResult(stage, error, calls) {
  const err = error && error.message ? error.message : String(error || "failed");
  return {
    ok: false,
    failed: true,
    stage,
    error: err.slice(0, 180),
    items: [],
    hasInsight: false,
    calls: Array.isArray(calls) ? calls.map(slimCall) : [],
    errorDebug: errorDebug(error),
  };
}

function sealKey() {
  const secret = String(authSecret() || "").trim() || "nichi-insight-lab-v1";
  return crypto.createHash("sha256").update(`lab:${secret}`).digest();
}

function sealPayload(payload) {
  const key = sealKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function unsealPayload(token) {
  const raw = String(token || "").trim();
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", sealKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    const data = JSON.parse(json);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function shufflePipelines(rand) {
  const roll = typeof rand === "function" ? rand : Math.random;
  const keys = PIPELINE_IDS.slice();
  for (let i = keys.length - 1; i > 0; i -= 1) {
    const j = Math.floor(roll() * (i + 1));
    const tmp = keys[i];
    keys[i] = keys[j];
    keys[j] = tmp;
  }
  return keys.map((pipeline, index) => ({ slot: SLOT_KEYS[index], pipeline }));
}

function evaluateItem(item, raw) {
  if (!item || !item.hasInsight) {
    return { novelty: 1, evidence: 1, usefulness: 1, human: 1, nonParaphrase: 2, empty: true };
  }
  const gated = valueGate.evaluateInsightCandidate(
    { insight: item.insight, question: item.question || "", text: item.insight },
    raw
  );
  const blob = valueGate.userSourceBlob(raw);
  const paraphrase = valueGate.looksNearParaphrase(item.insight, blob);
  const psych = reflectionV3.looksOverPsych(item.insight) || voice.looksReportConclusion(item.insight);
  return {
    novelty: paraphrase ? 0 : gated.ok ? 2 : 1,
    evidence: gated.issues.includes("no-new-information") ? 0 : 2,
    usefulness: gated.ok ? 2 : 0,
    human: psych ? 0 : 2,
    nonParaphrase: paraphrase ? 0 : 2,
    empty: false,
  };
}

function fixtureNotes(fixtureId, items) {
  const fx = FIXTURES[fixtureId];
  if (!fx || !fx.expect) return null;
  const text = (Array.isArray(items) ? items : []).map((item) => `${item.title} ${item.insight} ${item.question || ""}`).join("\n");
  const hits = (fx.expect.bad || []).filter((re) => re.test(text)).map((re) => re.source);
  const signals = (fx.expect.goodSignals || []).filter((re) => re.test(text)).map((re) => re.source);
  const hasInsight = (Array.isArray(items) ? items : []).some((item) => item && item.hasInsight);
  return {
    allowEmpty: Boolean(fx.expect.allowEmpty),
    preferHasInsight: Boolean(fx.expect.preferHasInsight),
    badHits: hits,
    goodSignals: signals,
    emptyOk: !hasInsight && Boolean(fx.expect.allowEmpty),
  };
}

function gptOpts(extra) {
  return {
    forceProvider: "openai",
    lab: true,
    returnMeta: true,
    timeoutMs: LAB_GPT_TIMEOUT,
    maxTokens: LAB_GPT_MAX_COMPLETION_TOKENS,
    effort: LAB_GPT_EFFORT,
    ...(extra || {}),
  };
}

function labGptRequestConfig() {
  const opts = gptOpts();
  const payload = openai.buildOpenAIPayload(
    [{ role: "user", content: "lab" }],
    opts,
    openai.LAB_GPT_MODEL
  );
  return {
    endpoint: LAB_GPT_ENDPOINT,
    method: "POST",
    model: payload.model,
    reasoningEffortField: "reasoning_effort",
    reasoningEffort: payload.reasoning_effort,
    maxCompletionTokens: payload.max_completion_tokens || null,
    responseFormat: payload.response_format || null,
    hasNestedReasoningObject: Object.prototype.hasOwnProperty.call(payload, "reasoning"),
  };
}

function claudeOpts(extra) {
  return {
    internal: true,
    returnMeta: true,
    timeoutMs: LAB_CLAUDE_TIMEOUT,
    maxTokens: 900,
    effort: "high",
    ...(extra || {}),
  };
}

async function invokeModel(callAi, messages, opts, stage) {
  const started = Date.now();
  try {
    const result = await callAi(messages, opts, stage);
    const latencyMs = Date.now() - started;
    if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "data")) {
      return {
        data: result.data,
        usage: slimUsage(result.usage || { input: 0, output: 0, reasoning: 0, total: 0 }),
        model: result.model || "",
        provider: result.provider || "",
        reasoningEffort: result.reasoningEffort || asText(opts && opts.effort),
        latencyMs,
        stage,
        httpStatus: result.httpStatus != null ? result.httpStatus : 200,
        finishReason: asText(result.finishReason),
        stopReason: asText(result.stopReason),
      };
    }
    return {
      data: result,
      usage: slimUsage({ input: 0, output: 0, reasoning: 0, total: 0 }),
      model: "",
      provider: "",
      reasoningEffort: asText(opts && opts.effort),
      latencyMs,
      stage,
      httpStatus: 200,
      finishReason: "",
      stopReason: "",
    };
  } catch (error) {
    if (error && typeof error === "object") {
      const prev = error.providerDebug || {};
      error.labCall = {
        stage,
        latencyMs: Date.now() - started,
        provider: prev.provider || "",
        model: prev.model || "",
        reasoningEffort: prev.reasoningEffort || asText(opts && opts.effort),
        httpStatus: prev.httpStatus != null ? prev.httpStatus : error.status != null ? error.status : null,
        finishReason: prev.finishReason || "",
        stopReason: prev.stopReason || "",
        usage: prev.usage ? slimUsage(prev.usage) : null,
        code: prev.code || error.code || "",
      };
    }
    throw error;
  }
}

function debugFromCalls(pipeline, calls, extra) {
  const list = Array.isArray(calls) ? calls : [];
  const usage = list.reduce(
    (acc, item) => {
      const row = slimUsage(item.usage);
      return {
        input: acc.input + row.input,
        output: acc.output + row.output,
        reasoning: acc.reasoning + row.reasoning,
        total: acc.total + row.total,
        completionTokens: acc.completionTokens + row.completionTokens,
        reasoningTokens: acc.reasoningTokens + row.reasoningTokens,
      };
    },
    { input: 0, output: 0, reasoning: 0, total: 0, completionTokens: 0, reasoningTokens: 0 }
  );
  const last = list[list.length - 1] || {};
  const fail = extra && extra.errorDebug ? extra.errorDebug : {};
  return {
    pipeline,
    label: PIPELINE_LABELS[pipeline] || pipeline,
    provider: list.map((item) => item.provider).filter(Boolean).join(" → ") || fail.provider || "—",
    model: list.map((item) => item.model).filter(Boolean).join(" → ") || fail.model || "—",
    reasoningEffort:
      [...new Set(list.map((item) => item.reasoningEffort).filter(Boolean))].join(" → ") || fail.reasoningEffort || "—",
    latencyMs: list.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0) + Number(fail.latencyMs || 0),
    callCount: list.length,
    usage,
    failed: Boolean(extra && extra.failed),
    error: extra && extra.error ? extra.error : "",
    stage: asText((extra && extra.stage) || fail.stage || last.stage),
    httpStatus: fail.httpStatus != null ? fail.httpStatus : last.httpStatus != null ? last.httpStatus : null,
    finishReason: fail.finishReason || last.finishReason || "",
    stopReason: fail.stopReason || last.stopReason || "",
    errorCode: fail.code || "",
    stages: list.map((item) => item.stage).filter(Boolean),
    completionTokens: usage.completionTokens,
    reasoningTokens: usage.reasoningTokens,
  };
}

function currentContext(raw) {
  return {
    thanksText: raw.thanksText,
    event: raw.event,
    mood: raw.mood,
    bodyMindText: raw.bodyMindText,
  };
}

function currentReasonMessages(ctx) {
  return [
    { role: "system", content: `${insightReason.REASONING_SYSTEM}\n\n【文字完整性】\n${textIntegrity.COMPLETE_TEXT_RULE}` },
    { role: "user", content: insightReason.reasoningUserPrompt({ context: ctx }, "layer") },
  ];
}

async function currentModelCall(callAi, messages, stage, calls) {
  const meta = await invokeModel(
    callAi,
    messages,
    claudeOpts({
      timeoutMs: stage === "write" ? LAB_A_WRITE_TIMEOUT : LAB_A_REASON_TIMEOUT,
      maxTokens: stage === "write" ? 800 : 1600,
    }),
    `current:${stage}`
  );
  calls.push(slimCall(meta));
  return meta.data;
}

function finishCurrent(written, ctx, calls) {
  const gated = reflectionV3.gateReflectionV3Result(written, ctx);
  const items = itemsFromCurrent(gated);
  return {
    ok: true,
    failed: false,
    hasInsight: items.length > 0,
    items,
    calls,
    passCount: items.length,
    stage: "current:write",
  };
}

async function advanceCurrent(raw, callAi, state) {
  const ctx = currentContext(raw);
  const calls = Array.isArray(state && state.calls) ? state.calls.slice() : [];
  const phase = asText(state && state.phase) || "reason";
  try {
    if (phase === "reason") {
      const rawReason = await currentModelCall(callAi, currentReasonMessages(ctx), "reason", calls);
      const pack = insightReason.prepareWriterInput(rawReason, ctx);
      if (pack.pass.length) {
        return { done: false, state: { phase: "write", pack, calls } };
      }
      return { done: false, state: { phase: "retry", pack, calls } };
    }
    if (phase === "retry") {
      const pack = state && state.pack ? state.pack : { pass: [], dropReasons: [], candidateCount: 0 };
      const rawReason = await currentModelCall(
        callAi,
        currentReasonMessages(ctx).concat([
          { role: "assistant", content: JSON.stringify({ candidateCount: pack.candidateCount, dropReasons: pack.dropReasons }) },
          { role: "user", content: insightReason.reasoningRetryPrompt(pack) },
        ]),
        "reason-retry",
        calls
      );
      const next = insightReason.prepareWriterInput(rawReason, ctx);
      if (!next.pass.length) {
        return { done: true, result: { ok: true, failed: false, hasInsight: false, items: [], calls, passCount: 0, stage: "current:reason-retry" } };
      }
      return { done: false, state: { phase: "write", pack: next, calls } };
    }
    const pack = state && state.pack ? state.pack : { pass: [] };
    const written = await currentModelCall(
      callAi,
      [
        { role: "system", content: `${insightReason.WRITER_SYSTEM}\n\n【文字完整性】\n${textIntegrity.COMPLETE_TEXT_RULE}` },
        { role: "user", content: insightReason.writerUserPrompt({ context: ctx }, pack, "layer") },
      ],
      "write",
      calls
    );
    return { done: true, result: finishCurrent(written, ctx, calls) };
  } catch (error) {
    const stage = (error && error.labCall && error.labCall.stage) || `current:${phase}`;
    return { done: true, result: failedResult(stage, error, calls) };
  }
}

async function runCurrent(raw, callAi) {
  let state = { phase: "reason", calls: [] };
  for (let i = 0; i < LAB_MAX_SLOT_STEPS; i += 1) {
    const out = await advanceCurrent(raw, callAi, state);
    if (out.done) return out.result;
    state = out.state;
  }
  return failedResult("current", new Error("current_incomplete"), state.calls);
}

async function advanceGpt(raw, sharedRaw, callAi, state) {
  const calls = Array.isArray(state && state.calls) ? state.calls.slice() : [];
  try {
    const meta = await invokeModel(
      callAi,
      [
        { role: "system", content: GPT_INDEPENDENT_SYSTEM },
        { role: "user", content: sharedRaw },
      ],
      gptOpts(),
      "gpt"
    );
    calls.push(slimCall(meta));
    const item = normalizeOneInsight(meta.data);
    return {
      done: true,
      result: { ok: true, failed: false, hasInsight: item.hasInsight, items: item.hasInsight ? [item] : [], calls, stage: "gpt" },
    };
  } catch (error) {
    return { done: true, result: failedResult("gpt", error, calls) };
  }
}

async function runGpt(raw, sharedRaw, callAi) {
  const out = await advanceGpt(raw, sharedRaw, callAi, { calls: [] });
  return out.result;
}

function compactCritique(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(src.items) ? src.items : [];
  const kept = [];
  const dropped = [];
  items.forEach((item, index) => {
    const verdict = asText(item && item.verdict).toUpperCase();
    const idea = asText(item && item.idea);
    if (!idea) return;
    if (verdict === "DROP") {
      dropped.push({ id: asText(item.id) || `c${index + 1}`, reason: compactLine(item.reason, 120) });
      return;
    }
    if (kept.length >= 3) return;
    kept.push({
      id: asText(item.id) || `k${kept.length + 1}`,
      idea,
      evidence: Array.isArray(item.evidence) ? item.evidence.map(asText).filter(Boolean).slice(0, 4) : [],
      verdict: verdict === "REVISE" ? "REVISE" : "KEEP",
    });
  });
  const added = (Array.isArray(src.added) ? src.added : [])
    .map((item) => ({
      idea: asText(item && item.idea),
      evidence: Array.isArray(item && item.evidence) ? item.evidence.map(asText).filter(Boolean).slice(0, 4) : [],
    }))
    .filter((item) => item.idea)
    .slice(0, 1);
  added.forEach((item) => {
    if (kept.length >= 3) return;
    kept.push({ id: `add${kept.length + 1}`, idea: item.idea, evidence: item.evidence, verdict: "ADD" });
  });
  return { kept, dropped: dropped.slice(0, 6), added };
}

function compactCouncilCandidates(raw) {
  const candidates = Array.isArray(raw && raw.candidates) ? raw.candidates.slice(0, 5) : [];
  return candidates.map((item, index) => ({
    id: asText(item && item.id) || `c${index + 1}`,
    idea: asText(item && item.idea),
    evidence: Array.isArray(item && item.evidence) ? item.evidence.map(asText).filter(Boolean).slice(0, 4) : [],
    confidence: asText(item && item.confidence) || "medium",
  }));
}

async function advanceCouncil(raw, sharedRaw, callAi, state) {
  const calls = Array.isArray(state && state.calls) ? state.calls.slice() : [];
  const phase = asText(state && state.phase) || "analyst";
  try {
    if (phase === "analyst") {
      const analyst = await invokeModel(
        callAi,
        [
          { role: "system", content: COUNCIL_ANALYST_SYSTEM },
          { role: "user", content: sharedRaw },
        ],
        claudeOpts({ maxTokens: 1200 }),
        "council-analyst"
      );
      calls.push(slimCall(analyst));
      return { done: false, state: { phase: "critic", candidates: compactCouncilCandidates(analyst.data), calls } };
    }
    if (phase === "critic") {
      const compactCandidates = Array.isArray(state && state.candidates) ? state.candidates : [];
      try {
        const critic = await invokeModel(
          callAi,
          [
            { role: "system", content: COUNCIL_CRITIC_SYSTEM },
            {
              role: "user",
              content: `${sharedRaw}\n\n【Claude candidates】\n${JSON.stringify(compactCandidates)}`,
            },
          ],
          gptOpts(),
          "council-critic"
        );
        calls.push(slimCall(critic));
        return { done: false, state: { phase: "mentor", critique: compactCritique(critic.data), calls } };
      } catch (error) {
        return { done: true, result: failedResult("council-critic", error, calls) };
      }
    }
    const critique = state && state.critique ? state.critique : { kept: [], dropped: [] };
    const mentor = await invokeModel(
      callAi,
      [
        { role: "system", content: COUNCIL_MENTOR_SYSTEM },
        {
          role: "user",
          content: `${sharedRaw}\n\n【通過批判的候選】\n${JSON.stringify(critique.kept)}\n【已淘汰】\n${JSON.stringify(critique.dropped)}`,
        },
      ],
      claudeOpts({ maxTokens: 700 }),
      "council-mentor"
    );
    calls.push(slimCall(mentor));
    const item = normalizeOneInsight(mentor.data);
    return {
      done: true,
      result: {
        ok: true,
        failed: false,
        hasInsight: item.hasInsight,
        items: item.hasInsight ? [item] : [],
        calls,
        critique,
        stage: "council-mentor",
      },
    };
  } catch (error) {
    const stage = (error && error.labCall && error.labCall.stage) || `council-${phase}`;
    return { done: true, result: failedResult(stage, error, calls) };
  }
}

async function runCouncil(raw, sharedRaw, callAi) {
  let state = { phase: "analyst", calls: [] };
  for (let i = 0; i < LAB_MAX_SLOT_STEPS; i += 1) {
    const out = await advanceCouncil(raw, sharedRaw, callAi, state);
    if (out.done) return out.result;
    state = out.state;
  }
  return failedResult("council", new Error("council_incomplete"), state.calls);
}

function defaultCallAi() {
  return (messages, opts) => openai.callOpenAI(messages, opts);
}

function publicSlotFromResult(slotKey, result) {
  const items = publicItems(result && result.items);
  const hasInsight = items.some((item) => item.hasInsight);
  return {
    key: slotKey,
    hasInsight,
    failed: Boolean(result && result.failed),
    items: hasInsight ? items.filter((item) => item.hasInsight) : [{ ...emptyItem() }],
  };
}

function hiddenFromResult(slotKey, pipeline, result, raw, fixtureId) {
  return {
    slot: slotKey,
    pipeline,
    label: PIPELINE_LABELS[pipeline],
    debug: debugFromCalls(pipeline, result && result.calls, result),
    scores: evaluateItem((result && result.items && result.items[0]) || emptyItem(), raw),
    fixture: fixtureNotes(fixtureId, result && result.items),
  };
}

function labRequestError(message, status) {
  const error = new Error(message);
  error.status = status || 400;
  return error;
}

function readExperimentSeal(token) {
  const data = unsealPayload(token);
  if (!data || data.v !== LAB_VERSION || data.kind !== "experiment") return null;
  if (!data.raw || !Array.isArray(data.mapping)) return null;
  return data;
}

function pipelineForSlot(experiment, slotKey) {
  const row = (experiment.mapping || []).find((item) => item && item.slot === slotKey);
  return row && PIPELINE_IDS.includes(row.pipeline) ? row.pipeline : "";
}

async function advancePipeline(pipeline, raw, sharedRaw, callAi, state) {
  if (pipeline === "current") return advanceCurrent(raw, callAi, state);
  if (pipeline === "gpt") return advanceGpt(raw, sharedRaw, callAi, state);
  if (pipeline === "council") return advanceCouncil(raw, sharedRaw, callAi, state);
  return { done: true, result: failedResult(pipeline, new Error("unknown_pipeline")) };
}

function planLabExperiment(options) {
  const opts = options && typeof options === "object" ? options : {};
  const fixtureId = asText(opts.fixtureId);
  const raw = sanitizeRaw(opts.raw, fixtureId);
  if (!hasLabRaw(raw)) throw labRequestError("當天沒有 01～03 原文", 400);
  const fingerprint = rawFingerprint(raw);
  const mapping = shufflePipelines(opts.rand);
  return {
    version: LAB_VERSION,
    fingerprint,
    fixtureId: fixtureId || "",
    slots: mapping.map((row) => ({ key: row.slot })),
    seal: sealPayload({
      v: LAB_VERSION,
      kind: "experiment",
      fingerprint,
      fixtureId: fixtureId || "",
      raw,
      mapping: mapping.map((row) => ({ slot: row.slot, pipeline: row.pipeline })),
    }),
  };
}

function finishSlotBranch(experiment, slotKey, pipeline, result) {
  const publicSlot = publicSlotFromResult(slotKey, result);
  const hidden = hiddenFromResult(slotKey, pipeline, result, experiment.raw, experiment.fixtureId);
  return {
    slot: slotKey,
    done: true,
    result: publicSlot,
    branchSeal: sealPayload({
      v: LAB_VERSION,
      kind: "branch",
      fingerprint: experiment.fingerprint,
      slot: slotKey,
      pipeline,
      hidden,
      publicSlot,
    }),
  };
}

async function runLabSlot(options) {
  const opts = options && typeof options === "object" ? options : {};
  const experiment = readExperimentSeal(opts.seal);
  if (!experiment) throw labRequestError("無效的 Lab 實驗", 400);
  const slotKey = asText(opts.slot).toUpperCase();
  if (!SLOT_KEYS.includes(slotKey)) throw labRequestError("無效的版本", 400);
  const pipeline = pipelineForSlot(experiment, slotKey);
  if (!pipeline) throw labRequestError("無效的版本", 400);
  let state = { phase: "", calls: [] };
  const continueRaw = asText(opts.continueToken);
  if (continueRaw) {
    const cont = unsealPayload(continueRaw);
    if (
      !cont ||
      cont.v !== LAB_VERSION ||
      cont.kind !== "continue" ||
      cont.fingerprint !== experiment.fingerprint ||
      cont.slot !== slotKey ||
      cont.pipeline !== pipeline
    ) {
      throw labRequestError("無效的續跑", 400);
    }
    state = cont.state && typeof cont.state === "object" ? cont.state : { phase: "", calls: [] };
  }
  const sharedRaw = formatUserRaw(experiment.raw);
  const callAi = typeof opts.callAi === "function" ? opts.callAi : defaultCallAi();
  const out = await advancePipeline(pipeline, experiment.raw, sharedRaw, callAi, state);
  if (!out.done) {
    return {
      slot: slotKey,
      done: false,
      continueToken: sealPayload({
        v: LAB_VERSION,
        kind: "continue",
        fingerprint: experiment.fingerprint,
        slot: slotKey,
        pipeline,
        state: out.state,
      }),
    };
  }
  return finishSlotBranch(experiment, slotKey, pipeline, out.result);
}

async function runLabSlotUntilDone(options) {
  let continueToken = "";
  let last = null;
  for (let i = 0; i < LAB_MAX_SLOT_STEPS; i += 1) {
    last = await runLabSlot({ ...options, continueToken: continueToken || undefined });
    if (last.done) return last;
    continueToken = last.continueToken;
  }
  throw labRequestError("Lab slot 未完成", 500);
}

function assembleLabReveal(experimentSeal, branchSeals) {
  const experiment = readExperimentSeal(experimentSeal);
  if (!experiment) return null;
  const branches = (Array.isArray(branchSeals) ? branchSeals : [])
    .map((token) => unsealPayload(token))
    .filter((item) => item && item.v === LAB_VERSION && item.kind === "branch" && item.fingerprint === experiment.fingerprint);
  const hidden = experiment.mapping.map((row) => {
    const found = branches.find((item) => item.slot === row.slot && item.pipeline === row.pipeline);
    return found && found.hidden
      ? found.hidden
      : {
          slot: row.slot,
          pipeline: row.pipeline,
          label: PIPELINE_LABELS[row.pipeline],
          debug: debugFromCalls(row.pipeline, [], { failed: true, error: "missing_branch", stage: row.pipeline }),
          scores: evaluateItem(emptyItem(), experiment.raw),
          fixture: null,
        };
  });
  return {
    mapping: experiment.mapping.map((row) => ({ slot: row.slot, pipeline: row.pipeline })),
    hidden,
    fingerprint: experiment.fingerprint,
  };
}

function combineLabExperiment(plan, parts, latencyMs) {
  const experiment = readExperimentSeal(plan.seal);
  const slots = (experiment.mapping || []).map((row) => {
    const part = (parts || []).find((item) => item && item.slot === row.slot);
    return part && part.result ? part.result : publicSlotFromResult(row.slot, failedResult(row.pipeline, new Error("missing")));
  });
  const revealed = assembleLabReveal(plan.seal, (parts || []).map((item) => item && item.branchSeal).filter(Boolean));
  return {
    version: LAB_VERSION,
    fingerprint: plan.fingerprint,
    fixtureId: plan.fixtureId || "",
    latencyMs: Number(latencyMs || 0) || 0,
    slots,
    seal: sealPayload({
      v: LAB_VERSION,
      kind: "reveal",
      fingerprint: plan.fingerprint,
      hidden: revealed ? revealed.hidden : [],
      mapping: revealed ? revealed.mapping : [],
    }),
    branchSeals: (parts || []).map((item) => item && item.branchSeal).filter(Boolean),
    experimentSeal: plan.seal,
  };
}

async function runLabExperiment(options) {
  const plan = planLabExperiment(options);
  const started = Date.now();
  const parts = await Promise.all(
    plan.slots.map((row) =>
      runLabSlotUntilDone({
        seal: plan.seal,
        slot: row.key,
        callAi: options && options.callAi,
      })
    )
  );
  return combineLabExperiment(plan, parts, Date.now() - started);
}

function revealLab(seal, branchSeals) {
  const data = unsealPayload(seal);
  if (!data || data.v !== LAB_VERSION) return null;
  if (data.kind === "experiment") return assembleLabReveal(seal, branchSeals);
  if (data.kind === "reveal" || (Array.isArray(data.hidden) && Array.isArray(data.mapping))) {
    return {
      mapping: Array.isArray(data.mapping) ? data.mapping : [],
      hidden: Array.isArray(data.hidden) ? data.hidden : [],
      fingerprint: data.fingerprint || "",
    };
  }
  return null;
}

function listFixtures() {
  return Object.keys(FIXTURES).map((id) => ({ id, label: FIXTURES[id].label }));
}

module.exports = {
  LAB_VERSION,
  PIPELINE_IDS,
  PIPELINE_LABELS,
  SLOT_KEYS,
  FIXTURES,
  GPT_INDEPENDENT_SYSTEM,
  sanitizeRaw,
  journalUserRaw,
  listLabDates,
  hasLabRaw,
  formatUserRaw,
  rawFingerprint,
  shufflePipelines,
  normalizeOneInsight,
  publicItems,
  compactCritique,
  evaluateItem,
  fixtureNotes,
  sealPayload,
  unsealPayload,
  planLabExperiment,
  runLabSlot,
  runLabSlotUntilDone,
  assembleLabReveal,
  runLabExperiment,
  revealLab,
  listFixtures,
  gptOpts,
  labGptRequestConfig,
  LAB_GPT_EFFORT,
  LAB_GPT_ENDPOINT,
  LAB_GPT_MAX_COMPLETION_TOKENS,
  LAB_GPT_TIMEOUT,
  LAB_CLAUDE_TIMEOUT,
  LAB_A_REASON_TIMEOUT,
  LAB_A_WRITE_TIMEOUT,
};
