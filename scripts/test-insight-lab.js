const fs = require("fs");
const path = require("path");
const insightLab = require("../lib/insight-lab");
const openai = require("../lib/openai");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const lab = fs.readFileSync(path.join(root, "lib/insight-lab.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const openaiSrc = fs.readFileSync(path.join(root, "lib/openai.js"), "utf8");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const v3 = fs.readFileSync(path.join(root, "lib/insight-reason.js"), "utf8");
const bodyMind = fs.readFileSync(path.join(root, "lib/body-mind.js"), "utf8");

function listApiFunctions(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...listApiFunctions(full));
    else if (name.isFile() && /\.(js|ts)$/.test(name.name)) out.push(full);
  }
  return out;
}

const apiFiles = listApiFunctions(path.join(root, "api"));
assert(apiFiles.length === 12, `serverless function count ${apiFiles.length}`);
assert(!fs.existsSync(path.join(root, "api/insight-lab.js")), "api/insight-lab.js removed");
assert(!vercel.includes("api/insight-lab.js"), "vercel.json has no insight-lab function");
assert(/"api\/review\.js"[\s\S]{0,80}"maxDuration": 60/.test(vercel), "review maxDuration stays 60");

assert(html.includes("app.js?v=281"), "cache app.js");
assert(html.includes("app.css?v=234"), "cache css");
assert(html.includes('id="insightLabLink"'), "sidebar Insight Lab");
assert(html.includes("Internal"), "Internal badge");
assert(html.includes('data-page="lab"'), "lab page");
assert(html.includes("hidden"), "lab link starts hidden");
assert(/#insightLabLink\[hidden\]\s*\{\s*display:\s*none\s*!important;/.test(css), "hidden Lab link beats .side-item display");

assert(app.includes("function syncInsightLabLink"), "internal link sync");
assert(app.includes('page === "lab" && !isInternalMembership()'), "non-internal cannot stay on lab");
assert(app.includes("writeLabExperiment"), "local experiment persist");
assert(app.includes('mode: "insight-lab"') && app.includes("/api/review"), "lab posts to /api/review");
assert(!app.includes("/api/insight-lab"), "frontend no longer uses /api/insight-lab");
assert(!/function runInsightLab[\s\S]{0,1200}journalInsight\s*=/.test(app), "lab run does not write journal.insight");
assert(!/function submitInsightLabVote[\s\S]{0,900}journalInsight\s*=/.test(app), "vote does not write journal.insight");
assert(app.includes("cloudStoreKey(\"insightLab\")") || app.includes('cloudStoreKey("insightLab")'), "lab storage isolated");
assert(!app.includes("CLOUD_STORE_NAMES = [") || !/CLOUD_STORE_NAMES = \[[^\]]+insightLab/.test(app), "lab not in cloud journal stores");

const dayFn = app.slice(app.indexOf("function labDayOptions"), app.indexOf("function escapeLab"));
assert(dayFn.includes("getReviews()"), "lab dates from canonical getReviews");
assert(!dayFn.includes("state.reviews"), "lab dates do not use empty state.reviews");
assert(dayFn.includes("reviewIsFinalized"), "lab dates prefer finalized reviews");
const runFn = app.slice(app.indexOf("async function runInsightLab"), app.indexOf("async function submitInsightLabVote"));
assert(runFn.includes("getReview("), "lab run reads getReview");
assert(!runFn.includes("state.reviews"), "lab run does not use state.reviews");
assert(!runFn.includes("saveReviews") && !runFn.includes("upsertReview"), "lab run does not mutate reviews");
assert(runFn.includes('action: "start"'), "lab starts experiment first");
assert(runFn.includes("runInsightLabSlot"), "lab runs slots independently");
assert(runFn.includes("Promise.all"), "A/B/C client requests can run in parallel");
assert(!runFn.includes('action: "run", date'), "lab no longer sends one all-in-one run");
assert(!app.includes("forceProvider"), "client never sends forceProvider");
assert(!runFn.includes("pipeline:"), "client run does not choose pipeline");
assert(app.includes('if (state.page === "lab") renderInsightLab()'), "cloud hydrate refreshes lab options");
assert(!/days\.map[\s\S]{0,120}\|\| `<option value="\$\{currentIso\(\)\}"/.test(app), "empty today is not forced into the date select");

const labGate = review.indexOf('body.mode || "") === "insight-lab"');
const pipeline = review.indexOf("runReasonWritePipeline");
assert(labGate >= 0, "review hosts insight-lab mode");
assert(pipeline > labGate, "Lab gate is before formal 04 pipeline");
assert(review.includes("isInternalUser"), "server uses isInternalUser");
assert(review.includes("Insight Lab is internal only."), "normal user 403");
assert(review.includes("handleInsightLabRequest"), "reuses Lab handler");
assert(review.includes("planLabExperiment"), "review hosts start");
assert(review.includes("runLabSlot"), "review hosts per-slot run");
assert(!review.includes("runLabExperiment"), "review no longer runs A/B/C in one request");
assert(review.includes("delete body.pipeline"), "review drops client pipeline");
assert(review.slice(labGate, labGate + 900).includes("return;"), "Lab early return");
assert(!/console\.log/.test(lab), "lib no console.log");

assert(openaiSrc.includes("if (usesClaude() && !wantsOpenAI(opts)) return callClaude"), "default routing still Claude first");
assert(openai.LAB_GPT_MODEL === "gpt-5.6-sol", "Lab GPT model pinned server-side");
assert(openai.getModel({ forceProvider: "openai", lab: true }) === "gpt-5.6-sol", "lab force GPT");
assert(insightLab.LAB_GPT_EFFORT === "high", "Lab GPT effort is high");
assert(insightLab.LAB_A_REASON_TIMEOUT === 26000, "Current Reason timeout matches formal Internal 04");
assert(insightLab.LAB_A_WRITE_TIMEOUT === 26000, "Current Writer timeout matches formal Internal 04");
assert(insightLab.LAB_CLAUDE_TIMEOUT === 26000, "Council Claude per-call timeout is 26s");
assert(insightLab.LAB_GPT_MAX_COMPLETION_TOKENS === 25000, "GPT completion budget follows official reasoning reserve");
assert(insightLab.gptOpts().effort === "high", "B/C gptOpts effort high");
assert(insightLab.gptOpts().effort !== "medium", "B/C not default medium");
assert(insightLab.gptOpts().maxTokens === 25000, "B default maxTokens is 25000");
assert(insightLab.gptOpts({ maxTokens: 800 }).maxTokens === 800, "explicit override still works");
const gptReq = insightLab.labGptRequestConfig();
assert(gptReq.endpoint === "https://api.openai.com/v1/chat/completions", "Chat Completions endpoint");
assert(gptReq.model === "gpt-5.6-sol", "request model sol");
assert(gptReq.reasoningEffortField === "reasoning_effort", "Chat Completions field name");
assert(gptReq.reasoningEffort === "high", "request reasoning_effort high");
assert(gptReq.maxCompletionTokens === 25000, "request max_completion_tokens is 25000");
assert(gptReq.hasNestedReasoningObject === false, "not Responses reasoning object");
const labPayload = openai.buildOpenAIPayload([{ role: "user", content: "x" }], insightLab.gptOpts(), "gpt-5.6-sol");
assert(labPayload.reasoning_effort === "high", "payload.reasoning_effort = high");
assert(labPayload.max_completion_tokens === 25000, "payload.max_completion_tokens is 25000 not 700");
assert(labPayload.max_completion_tokens !== 700, "no 700 token ceiling");
assert(!("reasoning" in labPayload), "Chat Completions does not send reasoning:{}");
const criticPayload = openai.buildOpenAIPayload([{ role: "user", content: "x" }], insightLab.gptOpts(), "gpt-5.6-sol");
assert(criticPayload.max_completion_tokens === 25000, "Critic shares the same high+JSON budget");
const usageChat = openai.normalizeUsage({
  prompt_tokens: 10,
  completion_tokens: 900,
  completion_tokens_details: { reasoning_tokens: 820 },
  total_tokens: 910,
});
assert(usageChat.reasoning === 820 && usageChat.reasoningTokens === 820, "Chat Completions reasoning_tokens mapped");
assert(usageChat.output === 900 && usageChat.completionTokens === 900, "completion_tokens mapped");
assert(!lab.includes("Promise.all([\n    runCurrent"), "server no longer Promise.all three pipelines in one handler");
assert(css.includes("max-width: 375px") && css.includes("max-width: 390px") && css.includes("max-width: 430px"), "lab overflow breakpoints");
assert(app.includes("reasoning effort"), "reveal shows reasoning effort");
assert(review.includes("runDiscoveryPipeline"), "formal 04 layer uses Discovery Engine");
assert(review.includes("runReasonWritePipeline"), "extension / lab current still can use reason pipeline");
assert(v3.includes("REASONING_SYSTEM"), "4B-2.7 reasoning still in place");
assert(bodyMind.includes("BODY_MIND_SYSTEM") || bodyMind.includes("身心"), "03 untouched");

assert(css.includes(".page--lab"), "lab css");
assert(css.includes("min-width: 0"), "overflow guard exists");
assert(css.includes(".lab-card"), "simple cards");

const baby = insightLab.FIXTURES["fx-baby"];
assert(baby.thanksText.includes("覺察") && baby.thanksText.includes("奇異果"), "baby fixture raw");
assert(baby.expect.bad.some((re) => re.test("你很重視幸福")), "evaluator flags known-bad");
assert(!lab.includes("你的自我覺察可能不只是在改變你自己"), "do not hardcode good answer");

const raw = insightLab.sanitizeRaw({}, "fx-baby");
const shared = insightLab.formatUserRaw(raw);
assert(shared.includes(raw.thanksText) && shared.includes(raw.event) && shared.includes(raw.bodyMindText), "same raw builder");
assert(!shared.includes("coreQuote") && !shared.includes("questions"), "no 04 AI in lab input");

const reviewMerge = require("../lib/review-merge");
const sampleJournal = {
  thanksText: "謝謝今天還能寫下來",
  event: "跟 Baby 把話說清楚",
  mood: "平靜",
  bodyNote: "legacy body note",
  bodyMind: {
    text: "胸口比較鬆",
    insight: "AI body insight must not enter Lab RAW",
    support: "AI body support must not enter Lab RAW",
  },
  insight: { coreQuote: "正式04", questions: ["不要餵04"] },
  awarenessResult: { title: "正式05" },
  smallestStep: "正式06",
};
const mapped = insightLab.journalUserRaw(sampleJournal);
assert(mapped.thanksText === "謝謝今天還能寫下來", "01 thanksText");
assert(mapped.event === "跟 Baby 把話說清楚" && mapped.mood === "平靜", "02 event+mood");
assert(mapped.bodyMindText === "胸口比較鬆", "03 prefers bodyMind.text");
assert(!JSON.stringify(mapped).includes("AI body") && !JSON.stringify(mapped).includes("正式04"), "no AI fields in USER RAW");
assert(insightLab.journalUserRaw({ event: "e", bodyNote: "舊欄位", bodyMind: { insight: "nope" } }).bodyMindText === "舊欄位", "legacy bodyNote");

const fixtureReviews = {
  "2026-08-29": { date: "2026-08-29", completedAt: "2026-08-29T20:00:00.000Z", journal: { thanksText: "29 感謝", event: "29 事件", mood: "難過", bodyMind: { text: "29 身體" } } },
  "2026-08-30": { date: "2026-08-30", completedAt: "2026-08-30T20:00:00.000Z", journal: { thanksText: "30 感謝", event: "30 事件", mood: "開心", bodyNote: "30 舊身心" } },
  "2026-09-01": { date: "2026-09-01", journal: { thanksText: "", event: "", mood: "", bodyMind: { text: "", insight: "today ai" } } },
};
const hydrated = {};
assert(insightLab.listLabDates(hydrated, { todayIso: "2026-09-01" }).length === 0, "before hydrate: no empty today-only list");
Object.assign(hydrated, fixtureReviews);
const dates = insightLab.listLabDates(hydrated, { todayIso: "2026-09-01", isFinalized: reviewMerge.reviewIsFinalized });
assert(dates.includes("2026-08-30") && dates.includes("2026-08-29"), "after hydrate: history dates appear");
assert(!dates.includes("2026-09-01"), "empty today is not the only/any option");
assert(dates[0] === "2026-08-30" && dates[1] === "2026-08-29", "newest first");

const sourceA = insightLab.sanitizeRaw(mapped);
const sourceB = insightLab.sanitizeRaw(mapped);
const sourceC = insightLab.sanitizeRaw(mapped);
assert(insightLab.formatUserRaw(sourceA) === insightLab.formatUserRaw(sourceB) && insightLab.formatUserRaw(sourceB) === insightLab.formatUserRaw(sourceC), "A/B/C same USER RAW");
assert(insightLab.rawFingerprint(sourceA) === insightLab.rawFingerprint(sourceC), "same raw fingerprint");
assert(!insightLab.formatUserRaw(sourceA).includes("正式04") && !insightLab.formatUserRaw(sourceA).includes("正式05"), "04/05/06 stay out of Lab RAW");

const reasonJson = {
  facts: [
    { id: "f1", source: "01", text: "最近每天都會做一些覺察" },
    { id: "f2", source: "01", text: "跟 Baby 聊的東西變多了" },
  ],
  known: [{ text: "使用者知道自己覺得幸福", reason: "stated" }],
  trivial: [{ text: "想睡代表累", reason: "common" }],
  candidates: [
    {
      id: "c1",
      type: "connection",
      idea: "持續覺察後，跟 Baby 可聊的東西也變多了，改變可能已經開始影響你們相處的方式。",
      evidence: ["f1", "f2"],
      userAlreadyKnows: false,
      trivial: false,
      newInformation: "覺察可能開始改變兩人的交流方式",
    },
  ],
  judged: { c1: { verdict: "PASS", novelty: 2, specificity: 2, usefulness: 2, evidence: 2, humanness: 2, soWhat: 0, paraphraseRisk: 0, trivialRisk: 0, overinferenceRisk: 0 } },
};

function mockCallAi(overrides = {}) {
  return async (messages, opts, stage) => {
    const system = String(messages && messages[0] && messages[0].content) || "";
    const user = String(messages && messages[1] && messages[1].content) || "";
    if (overrides.capture) overrides.capture.push({ stage, system, user, force: opts && opts.forceProvider, effort: opts && opts.effort });
    if (overrides.failGpt && opts && opts.forceProvider === "openai" && stage === "gpt") throw new Error("GPT failed");
    if (overrides.failClaude && !(opts && opts.forceProvider === "openai")) throw new Error("Claude failed");
    if (overrides.failTimeout && stage === "gpt") {
      const error = new Error("OpenAI 逾時");
      error.name = "AbortError";
      error.status = 504;
      throw error;
    }
    if (overrides.failCouncilCritic && String(stage).includes("council-critic")) throw new Error("council critic failed");
    if (opts && opts.forceProvider === "openai" && system.includes("不是順著前一位")) {
      return {
        data: {
          items: [{ id: "c1", verdict: "KEEP", idea: "覺察可能開始成為你們之間新的交流方式", evidence: ["每天覺察", "聊的東西變多"], reason: "cross-section" }],
          added: [],
        },
        usage: { input: 10, output: 20, total: 30 },
        model: "gpt-5.6-sol",
        provider: "openai",
      };
    }
    if (opts && opts.forceProvider === "openai") {
      return {
        data: overrides.gptEmpty
          ? { hasInsight: false, title: "", insight: "", question: null }
          : { hasInsight: true, title: "覺察走進對話裡了", insight: "你最近持續做覺察之後，跟 Baby 可聊的東西也變多了。這可能已經開始成為你們相處的方式。", question: null },
        usage: { input: 8, output: 12, total: 20 },
        model: "gpt-5.6-sol",
        provider: "openai",
      };
    }
    if (system.includes("內部推理引擎") || String(stage).includes("reason")) {
      return { data: reasonJson, usage: { input: 5, output: 9, total: 14 }, model: "claude-sonnet-5", provider: "anthropic" };
    }
    if (system.includes("只把下面 PASS") || String(stage).includes("write") || system.includes("前因")) {
      return {
        data: {
          coreQuote: "覺察開始走進關係",
          items: [{ id: "q1", title: "覺察走進關係裡了", insight: "你最近做的覺察，好像不只讓你更了解自己。跟 Baby 也因此多了很多可以聊的東西。", question: "" }],
        },
        usage: { input: 4, output: 8, total: 12 },
        model: "claude-sonnet-5",
        provider: "anthropic",
      };
    }
    if (system.includes("內部分析員")) {
      return {
        data: {
          candidates: [{ id: "c1", idea: "覺察可能開始改變交流方式", evidence: ["每天覺察", "聊的東西變多"], whyItMayMatter: "cross-section", confidence: "high" }],
        },
        usage: { input: 6, output: 8, total: 14 },
        model: "claude-sonnet-5",
        provider: "anthropic",
      };
    }
    if (system.includes("從通過批判的候選中")) {
      return {
        data: { hasInsight: true, title: "交流方式正在變", insight: "持續覺察之後，你們可聊的東西變多了。這可能已經成為關係裡新的交流方式。", question: null },
        usage: { input: 5, output: 7, total: 12 },
        model: "claude-sonnet-5",
        provider: "anthropic",
      };
    }
    throw new Error(`unexpected lab call ${stage}`);
  };
}

(async () => {
  const capture = [];
  const run = await insightLab.runLabExperiment({
    fixtureId: "fx-baby",
    callAi: mockCallAi({ capture }),
    rand: () => 0,
  });
  assert(run.slots.length === 3, "three blinded slots");
  assert(run.slots.every((slot) => ["A", "B", "C"].includes(slot.key)), "A/B/C labels");
  const dumped = JSON.stringify(run.slots);
  assert(!/Current ING|gpt-5\.6|Council|claude-sonnet|openai/i.test(dumped), "no model names before reveal");
  assert(run.seal && !JSON.stringify(run.slots).includes(run.seal.slice(0, 12)) || run.seal, "seal present");
  const users = capture.map((item) => item.user).filter((text) => text && (text.includes("覺察") || text.includes("【01")));
  const babyThanks = insightLab.FIXTURES["fx-baby"].thanksText;
  assert(users.length >= 3, "A/B/C all received USER RAW");
  assert(users.every((text) => text.includes("最近每天都會做一些覺察") && text.includes("一直想睡")), "same raw facts for A/B/C");
  assert(!users.some((text) => /coreQuote|thinkQuestions|bodyMindInsight/.test(text) && text.includes("正式04")), "no first-layer 04 AI fed in");
  assert(run.fingerprint === insightLab.rawFingerprint(insightLab.sanitizeRaw({}, "fx-baby")), "fingerprint matches raw");

  const revealed = insightLab.revealLab(run.seal);
  assert(revealed && revealed.mapping.length === 3, "reveal mapping after unseal");
  assert(revealed.mapping.every((row) => row.slot && row.pipeline), "slot→pipeline mapping");
  assert(revealed.hidden.every((row) => row.debug && row.debug.model), "internal debug after reveal");
  assert(revealed.hidden.every((row) => row.debug && row.debug.reasoningEffort), "reveal includes reasoning effort");
  assert(revealed.hidden[0].scores && "novelty" in revealed.hidden[0].scores, "evaluator scores exist");
  const gptCalls = capture.filter((item) => item.force === "openai");
  assert(gptCalls.length >= 2, "GPT Independent + GPT Critic both called");
  assert(gptCalls.every((item) => item.effort === "high"), "B and C critic use high, not medium");
  const gptHidden = revealed.hidden.find((row) => row.pipeline === "gpt");
  const councilHidden = revealed.hidden.find((row) => row.pipeline === "council");
  const currentHidden = revealed.hidden.find((row) => row.pipeline === "current");
  assert(gptHidden.debug.reasoningEffort === "high", "B reveal effort high");
  assert(String(councilHidden.debug.reasoningEffort).includes("high"), "C reveal includes high");
  assert(currentHidden.debug.stages.includes("current:reason") && currentHidden.debug.stages.includes("current:write"), "Current Reason/Writer stages recorded");
  assert(councilHidden.debug.stages.includes("council-analyst"), "Council analyst stage");
  assert(councilHidden.debug.stages.includes("council-critic"), "Council critic stage");
  assert(councilHidden.debug.stages.includes("council-mentor"), "Council mentor stage");
  assert("finishReason" in gptHidden.debug && "errorCode" in gptHidden.debug, "reveal debug includes finish/error fields");
  assert("reasoningTokens" in gptHidden.debug, "reveal debug includes reasoning token budget");

  const emptyGpt = await insightLab.runLabExperiment({
    fixtureId: "fx-sparse",
    callAi: mockCallAi({ gptEmpty: true }),
    rand: () => 0.9,
  });
  const gptSlot = insightLab.revealLab(emptyGpt.seal).mapping.find((row) => row.pipeline === "gpt");
  const gptPublic = emptyGpt.slots.find((slot) => slot.key === gptSlot.slot);
  assert(gptPublic && gptPublic.hasInsight === false, "hasInsight false is legal");

  const one = await insightLab.runLabExperiment({ fixtureId: "fx-baby", callAi: mockCallAi(), rand: () => 0.2 });
  one.slots.forEach((slot) => {
    if (slot.hasInsight) assert(slot.items.length >= 1 && slot.items.length <= 3, "1–3 items");
  });

  const gptFail = await insightLab.runLabExperiment({ fixtureId: "fx-baby", callAi: mockCallAi({ failGpt: true }), rand: () => 0 });
  const gptFailMap = insightLab.revealLab(gptFail.seal);
  const gptFailRow = gptFailMap.hidden.find((row) => row.pipeline === "gpt");
  assert(gptFailRow.debug.failed, "GPT failure recorded");
  assert(!JSON.stringify(gptFail.slots).includes("GPT failed"), "failure detail not on blind cards");

  const claudeFail = await insightLab.runLabExperiment({ fixtureId: "fx-baby", callAi: mockCallAi({ failClaude: true }), rand: () => 0 });
  assert(insightLab.revealLab(claudeFail.seal).hidden.some((row) => row.pipeline === "current" && row.debug.failed), "Claude current failure");

  const timeout = await insightLab.runLabExperiment({ fixtureId: "fx-baby", callAi: mockCallAi({ failTimeout: true }), rand: () => 0 });
  assert(insightLab.revealLab(timeout.seal).hidden.some((row) => row.pipeline === "gpt" && row.debug.failed), "provider timeout");

  const councilFail = await insightLab.runLabExperiment({ fixtureId: "fx-baby", callAi: mockCallAi({ failCouncilCritic: true }), rand: () => 0 });
  const councilRow = insightLab.revealLab(councilFail.seal).hidden.find((row) => row.pipeline === "council");
  assert(councilRow.debug.failed, "council partial critic failure");
  assert(councilRow.debug.error.includes("critic"), "does not fake council from A");
  assert(councilRow.debug.stage === "council-critic", "council failure stage is critic");
  assert(councilRow.debug.stages.includes("council-analyst"), "analyst completed before critic failed");
  assert(!councilRow.debug.stages.includes("council-mentor"), "mentor did not run after critic fail");

  const stepPlan = insightLab.planLabExperiment({ fixtureId: "fx-baby", rand: () => 0.1 });
  const stepCurrent = insightLab.revealLab(stepPlan.seal, []).mapping.find((row) => row.pipeline === "current").slot;
  const firstStep = await insightLab.runLabSlot({ seal: stepPlan.seal, slot: stepCurrent, callAi: mockCallAi() });
  assert(firstStep.done === false && firstStep.continueToken, "Current first request is Reason only, not 78s full pipeline");
  assert(!firstStep.result, "unfinished Current request exposes no public card yet");

  const plan = insightLab.planLabExperiment({ fixtureId: "fx-baby", rand: () => 0 });
  assert(plan.slots.every((row) => row.key && !row.pipeline && !row.model), "start slots have no branch identity");
  assert(!JSON.stringify(plan.slots).includes("current") && !JSON.stringify(plan.slots).includes("gpt"), "start does not leak pipelines");
  const mapping = insightLab.revealLab(plan.seal, []).mapping;
  const currentSlot = mapping.find((row) => row.pipeline === "current").slot;
  const hijack = await insightLab.runLabSlotUntilDone({
    seal: plan.seal,
    slot: currentSlot,
    pipeline: "gpt",
    forceProvider: "openai",
    model: "gpt-5.6-sol",
    callAi: mockCallAi({ capture }),
  });
  const hijackBranch = insightLab.unsealPayload(hijack.branchSeal);
  assert(hijackBranch.pipeline === "current", "client cannot pick provider/model/pipeline");
  assert(hijack.result && !JSON.stringify(hijack.result).includes("Current ING"), "slot result stays blind");

  const isolatedPlan = insightLab.planLabExperiment({ fixtureId: "fx-baby", rand: () => 0.4 });
  const isolatedMap = insightLab.revealLab(isolatedPlan.seal, []).mapping;
  const isoGpt = isolatedMap.find((row) => row.pipeline === "gpt").slot;
  const isoCurrent = isolatedMap.find((row) => row.pipeline === "current").slot;
  const isoCouncil = isolatedMap.find((row) => row.pipeline === "council").slot;
  const [isoFail, isoOk, isoCouncilOk] = await Promise.all([
    insightLab.runLabSlotUntilDone({ seal: isolatedPlan.seal, slot: isoGpt, callAi: mockCallAi({ failGpt: true }) }),
    insightLab.runLabSlotUntilDone({ seal: isolatedPlan.seal, slot: isoCurrent, callAi: mockCallAi() }),
    insightLab.runLabSlotUntilDone({ seal: isolatedPlan.seal, slot: isoCouncil, callAi: mockCallAi() }),
  ]);
  assert(isoFail.result.failed, "GPT branch can fail alone");
  assert(!isoOk.result.failed && isoOk.result.hasInsight, "Current ING still completes");
  assert(!isoCouncilOk.result.failed, "Council still completes");
  const isoReveal = insightLab.revealLab(isolatedPlan.seal, [isoFail.branchSeal, isoOk.branchSeal, isoCouncilOk.branchSeal]);
  assert(isoReveal.hidden.find((row) => row.pipeline === "current").debug.stage.includes("current"), "Current stage visible after reveal");
  assert(isoReveal.hidden.find((row) => row.pipeline === "council").debug.stages.join(" ").includes("council-analyst"), "Council analyst identifiable");
  assert(isoReveal.hidden.find((row) => row.pipeline === "council").debug.stages.includes("council-critic"), "Council critic identifiable");
  assert(isoReveal.hidden.find((row) => row.pipeline === "council").debug.stages.includes("council-mentor"), "Council mentor identifiable");
  const dbgDump = JSON.stringify(isoReveal.hidden.map((row) => row.debug));
  assert(!dbgDump.includes(babyThanks), "debug does not persist USER RAW");

  const notes = insightLab.fixtureNotes("fx-baby", [{ hasInsight: true, title: "幸福", insight: "你很重視幸福。陪伴讓你覺得幸福。", question: "你是不是很珍惜 Baby？" }]);
  assert(notes.badHits.length >= 2, "fixture evaluator catches paraphrase");
  const positiveBad = insightLab.fixtureNotes("fx-positive", [{ hasInsight: true, title: "怕", insight: "你是不是害怕失去，內在不安全。", question: "如果明天不順利怎麼辦？" }]);
  assert(positiveBad.badHits.length >= 2, "positive day forbids shadow mining");

  const shuffled = new Set();
  for (let i = 0; i < 12; i += 1) {
    shuffled.add(insightLab.shufflePipelines(() => Math.random()).map((row) => row.pipeline).join(","));
  }
  assert(shuffled.size > 1, "blind randomization varies");

  assert(!insightLab.revealLab("not-a-seal"), "bad seal");
  const voteOnly = insightLab.revealLab(run.seal);
  assert(voteOnly.mapping, "reveal is explicit unseal, not bundled in slots");

  console.log("insight lab tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
