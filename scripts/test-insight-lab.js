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

assert(html.includes("app.js?v=277"), "cache app.js");
assert(html.includes("app.css?v=231"), "cache css");
assert(html.includes('id="insightLabLink"'), "sidebar Insight Lab");
assert(html.includes("Internal"), "Internal badge");
assert(html.includes('data-page="lab"'), "lab page");
assert(html.includes("hidden"), "lab link starts hidden");

assert(app.includes("function syncInsightLabLink"), "internal link sync");
assert(app.includes('page === "lab" && !isInternalMembership()'), "non-internal cannot stay on lab");
assert(app.includes("writeLabExperiment"), "local experiment persist");
assert(app.includes('mode: "insight-lab"') && app.includes("/api/review"), "lab posts to /api/review");
assert(!app.includes("/api/insight-lab"), "frontend no longer uses /api/insight-lab");
assert(!/function runInsightLab[\s\S]{0,1200}journalInsight\s*=/.test(app), "lab run does not write journal.insight");
assert(!/function submitInsightLabVote[\s\S]{0,900}journalInsight\s*=/.test(app), "vote does not write journal.insight");
assert(app.includes("cloudStoreKey(\"insightLab\")") || app.includes('cloudStoreKey("insightLab")'), "lab storage isolated");
assert(!app.includes("CLOUD_STORE_NAMES = [") || !/CLOUD_STORE_NAMES = \[[^\]]+insightLab/.test(app), "lab not in cloud journal stores");

const labGate = review.indexOf('body.mode || "") === "insight-lab"');
const pipeline = review.indexOf("runReasonWritePipeline");
assert(labGate >= 0, "review hosts insight-lab mode");
assert(pipeline > labGate, "Lab gate is before formal 04 pipeline");
assert(review.includes("isInternalUser"), "server uses isInternalUser");
assert(review.includes("Insight Lab is internal only."), "normal user 403");
assert(review.includes("handleInsightLabRequest"), "reuses Lab handler");
assert(review.slice(labGate, labGate + 900).includes("return;"), "Lab early return");
assert(!/console\.log/.test(lab), "lib no console.log");

assert(openaiSrc.includes("if (usesClaude() && !wantsOpenAI(opts)) return callClaude"), "default routing still Claude first");
assert(openai.LAB_GPT_MODEL === "gpt-5.6-sol", "Lab GPT model pinned server-side");
assert(openai.getModel({ forceProvider: "openai", lab: true }) === "gpt-5.6-sol", "lab force GPT");
assert(insightLab.LAB_GPT_EFFORT === "high", "Lab GPT effort is high");
assert(insightLab.gptOpts().effort === "high", "B/C gptOpts effort high");
assert(insightLab.gptOpts().effort !== "medium", "B/C not default medium");
const gptReq = insightLab.labGptRequestConfig();
assert(gptReq.endpoint === "https://api.openai.com/v1/chat/completions", "Chat Completions endpoint");
assert(gptReq.model === "gpt-5.6-sol", "request model sol");
assert(gptReq.reasoningEffortField === "reasoning_effort", "Chat Completions field name");
assert(gptReq.reasoningEffort === "high", "request reasoning_effort high");
assert(gptReq.hasNestedReasoningObject === false, "not Responses reasoning object");
const labPayload = openai.buildOpenAIPayload([{ role: "user", content: "x" }], insightLab.gptOpts(), "gpt-5.6-sol");
assert(labPayload.reasoning_effort === "high", "payload.reasoning_effort = high");
assert(!("reasoning" in labPayload), "Chat Completions does not send reasoning:{}");
assert(app.includes("reasoning effort"), "reveal shows reasoning effort");
assert(review.includes("runReasonWritePipeline"), "production 04 pipeline untouched");
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
  assert(gptHidden.debug.reasoningEffort === "high", "B reveal effort high");
  assert(String(councilHidden.debug.reasoningEffort).includes("high"), "C reveal includes high");

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
