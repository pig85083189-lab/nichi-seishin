"use strict";

const crypto = require("crypto");
const openai = require("./openai");
const voice = require("./ing-voice");
const insightReason = require("./insight-reason");
const reflectionV3 = require("./reflection-v3");
const valueGate = require("./insight-value-gate");
const textIntegrity = require("./text-integrity");
const { authSecret } = require("./auth");

const LAB_VERSION = "insight-lab-v1";
const SLOT_KEYS = ["A", "B", "C"];
const PIPELINE_IDS = ["current", "gpt", "council"];
const PIPELINE_LABELS = {
  current: "Current ING",
  gpt: "GPT",
  council: "Council",
};

const LAB_CLAUDE_TIMEOUT = 16000;
const LAB_GPT_TIMEOUT = 26000;
const LAB_GPT_EFFORT = "high";
const LAB_GPT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const LAB_A_REASON_TIMEOUT = 18000;
const LAB_A_WRITE_TIMEOUT = 16000;

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

function failedResult(stage, error) {
  const err = error && error.message ? error.message : String(error || "failed");
  return {
    ok: false,
    failed: true,
    stage,
    error: err.slice(0, 180),
    items: [],
    hasInsight: false,
    calls: [],
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
    maxTokens: 700,
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
  const result = await callAi(messages, opts, stage);
  const latencyMs = Date.now() - started;
  if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "data")) {
    return {
      data: result.data,
      usage: result.usage || { input: 0, output: 0, reasoning: 0, total: 0 },
      model: result.model || "",
      provider: result.provider || "",
      reasoningEffort: result.reasoningEffort || asText(opts && opts.effort),
      latencyMs,
      stage,
    };
  }
  return {
    data: result,
    usage: { input: 0, output: 0, reasoning: 0, total: 0 },
    model: "",
    provider: "",
    reasoningEffort: asText(opts && opts.effort),
    latencyMs,
    stage,
  };
}

function debugFromCalls(pipeline, calls, extra) {
  const list = Array.isArray(calls) ? calls : [];
  const usage = list.reduce(
    (acc, item) => ({
      input: acc.input + Number((item.usage && item.usage.input) || 0),
      output: acc.output + Number((item.usage && item.usage.output) || 0),
      reasoning: acc.reasoning + Number((item.usage && item.usage.reasoning) || 0),
      total: acc.total + Number((item.usage && item.usage.total) || 0),
    }),
    { input: 0, output: 0, reasoning: 0, total: 0 }
  );
  return {
    pipeline,
    label: PIPELINE_LABELS[pipeline] || pipeline,
    provider: list.map((item) => item.provider).filter(Boolean).join(" → ") || "—",
    model: list.map((item) => item.model).filter(Boolean).join(" → ") || "—",
    reasoningEffort: [...new Set(list.map((item) => item.reasoningEffort).filter(Boolean))].join(" → ") || "—",
    latencyMs: list.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0),
    callCount: list.length,
    usage,
    failed: Boolean(extra && extra.failed),
    error: extra && extra.error ? extra.error : "",
  };
}

async function runCurrent(raw, callAi) {
  const calls = [];
  const ctx = {
    thanksText: raw.thanksText,
    event: raw.event,
    mood: raw.mood,
    bodyMindText: raw.bodyMindText,
  };
  try {
    const pipeline = await insightReason.runReasonWritePipeline({
      callAi: async (messages, stage) => {
        const meta = await invokeModel(
          callAi,
          messages,
          claudeOpts({
            timeoutMs: stage === "write" ? LAB_A_WRITE_TIMEOUT : LAB_A_REASON_TIMEOUT,
            maxTokens: stage === "write" ? 800 : 1600,
          }),
          `current:${stage}`
        );
        calls.push(meta);
        return meta.data;
      },
      ctx,
      kind: "layer",
      reasonMessages: [
        { role: "system", content: `${insightReason.REASONING_SYSTEM}\n\n【文字完整性】\n${textIntegrity.COMPLETE_TEXT_RULE}` },
        { role: "user", content: insightReason.reasoningUserPrompt({ context: ctx }, "layer") },
      ],
      writeSystem: `${insightReason.WRITER_SYSTEM}\n\n【文字完整性】\n${textIntegrity.COMPLETE_TEXT_RULE}`,
    });
    if (pipeline.empty) {
      return { ok: true, failed: false, hasInsight: false, items: [], calls, passCount: 0 };
    }
    const gated = reflectionV3.gateReflectionV3Result(pipeline.written, ctx);
    const items = itemsFromCurrent(gated);
    return {
      ok: true,
      failed: false,
      hasInsight: items.length > 0,
      items,
      calls,
      passCount: items.length,
    };
  } catch (error) {
    return { ...failedResult("current", error), calls };
  }
}

async function runGpt(raw, sharedRaw, callAi) {
  const calls = [];
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
    calls.push(meta);
    const item = normalizeOneInsight(meta.data);
    return { ok: true, failed: false, hasInsight: item.hasInsight, items: item.hasInsight ? [item] : [], calls };
  } catch (error) {
    return { ...failedResult("gpt", error), calls };
  }
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

async function runCouncil(raw, sharedRaw, callAi) {
  const calls = [];
  try {
    const analyst = await invokeModel(
      callAi,
      [
        { role: "system", content: COUNCIL_ANALYST_SYSTEM },
        { role: "user", content: sharedRaw },
      ],
      claudeOpts({ maxTokens: 1200 }),
      "council-analyst"
    );
    calls.push(analyst);
    const candidates = Array.isArray(analyst.data && analyst.data.candidates)
      ? analyst.data.candidates.slice(0, 5)
      : [];
    const compactCandidates = candidates.map((item, index) => ({
      id: asText(item && item.id) || `c${index + 1}`,
      idea: asText(item && item.idea),
      evidence: Array.isArray(item && item.evidence) ? item.evidence.map(asText).filter(Boolean).slice(0, 4) : [],
      confidence: asText(item && item.confidence) || "medium",
    }));

    let criticData = { items: [], added: [] };
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
        gptOpts({ maxTokens: 800 }),
        "council-critic"
      );
      calls.push(critic);
      criticData = critic.data;
    } catch (error) {
      return { ...failedResult("council-critic", error), calls };
    }

    const critique = compactCritique(criticData);
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
    calls.push(mentor);
    const item = normalizeOneInsight(mentor.data);
    return { ok: true, failed: false, hasInsight: item.hasInsight, items: item.hasInsight ? [item] : [], calls, critique };
  } catch (error) {
    return { ...failedResult("council", error), calls };
  }
}

function defaultCallAi() {
  return (messages, opts) => openai.callOpenAI(messages, opts);
}

async function runLabExperiment(options) {
  const opts = options && typeof options === "object" ? options : {};
  const fixtureId = asText(opts.fixtureId);
  const raw = sanitizeRaw(opts.raw, fixtureId);
  if (!hasLabRaw(raw)) {
    const error = new Error("當天沒有 01～03 原文");
    error.status = 400;
    throw error;
  }
  const sharedRaw = formatUserRaw(raw);
  const fingerprint = rawFingerprint(raw);
  const callAi = typeof opts.callAi === "function" ? opts.callAi : defaultCallAi();
  const started = Date.now();
  const [current, gpt, council] = await Promise.all([
    runCurrent(raw, callAi),
    runGpt(raw, sharedRaw, callAi),
    runCouncil(raw, sharedRaw, callAi),
  ]);
  const byId = { current, gpt, council };
  const mapping = shufflePipelines(opts.rand);
  const slots = mapping.map((row) => {
    const result = byId[row.pipeline] || failedResult(row.pipeline, new Error("missing"));
    const items = publicItems(result.items);
    const hasInsight = items.some((item) => item.hasInsight);
    return {
      key: row.slot,
      hasInsight,
      failed: Boolean(result.failed),
      items: hasInsight ? items.filter((item) => item.hasInsight) : [{ ...emptyItem() }],
    };
  });
  const hidden = mapping.map((row) => {
    const result = byId[row.pipeline] || {};
    return {
      slot: row.slot,
      pipeline: row.pipeline,
      label: PIPELINE_LABELS[row.pipeline],
      debug: debugFromCalls(row.pipeline, result.calls, result),
      scores: evaluateItem((result.items && result.items[0]) || emptyItem(), raw),
      fixture: fixtureNotes(fixtureId, result.items),
    };
  });
  return {
    version: LAB_VERSION,
    fingerprint,
    fixtureId: fixtureId || "",
    latencyMs: Date.now() - started,
    slots,
    seal: sealPayload({
      v: LAB_VERSION,
      fingerprint,
      hidden,
      mapping: mapping.map((row) => ({ slot: row.slot, pipeline: row.pipeline })),
    }),
  };
}

function revealLab(seal) {
  const data = unsealPayload(seal);
  if (!data || data.v !== LAB_VERSION) return null;
  return {
    mapping: Array.isArray(data.mapping) ? data.mapping : [],
    hidden: Array.isArray(data.hidden) ? data.hidden : [],
    fingerprint: data.fingerprint || "",
  };
}

function listFixtures() {
  return Object.keys(FIXTURES).map((id) => ({ id, label: FIXTURES[id].label }));
}

module.exports = {
  LAB_VERSION,
  PIPELINE_IDS,
  PIPELINE_LABELS,
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
  runLabExperiment,
  revealLab,
  listFixtures,
  gptOpts,
  labGptRequestConfig,
  LAB_GPT_EFFORT,
  LAB_GPT_ENDPOINT,
};
