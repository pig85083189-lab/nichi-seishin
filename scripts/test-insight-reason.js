const insightReason = require("../lib/insight-reason");
const reflectionV3 = require("../lib/reflection-v3");
const reflectionExt = require("../lib/reflection-extension");
const voice = require("../lib/ing-voice");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const PRODUCTION_CTX = {
  thanksText: "最近每天都有在覺察。今天跟 Baby 聊了很多，第三次一起吃拉麵，他還幫我切奇異果，我覺得很幸福。",
  event: "今天特別開心，也跟 Baby 多了很多可以聊的東西。",
  mood: "開心",
  bodyMindText: "今天特別想睡覺。",
};

const GRANDMA_CTX = {
  thanksText: "還有家",
  event: "被阿嬤誤會覺得很委屈，後來和媽媽聊，開始換角度理解。想到阿嬤年紀大，想學習更多體諒，不一定每件事都要爭輸贏。",
  mood: "平靜",
  bodyMindText: "胸口有一點緊，後來比較鬆。",
};

const POSITIVE_CTX = {
  thanksText: "今天工作順利，學到新東西。",
  event: "跟重要的人吃飯，覺得很開心。",
  mood: "開心",
  bodyMindText: "身體很輕鬆。",
};

const productionReason = {
  facts: [
    { id: "f1", source: "01", text: "最近每天都有在覺察" },
    { id: "f2", source: "01", text: "跟 Baby 聊了很多" },
    { id: "f3", source: "01", text: "第三次一起吃拉麵，他幫我切奇異果，我覺得很幸福" },
    { id: "f4", source: "03", text: "今天特別想睡覺" },
  ],
  known: [
    { text: "使用者知道自己覺得幸福", reason: "user explicitly stated this" },
    { text: "使用者知道自己想睡", reason: "user explicitly stated this" },
  ],
  trivial: [{ text: "想睡代表累", reason: "common-sense inference" }],
  candidates: [
    {
      id: "c-drop-happy",
      type: "value",
      idea: "日常陪伴可能就是你的幸福",
      evidence: ["f3"],
      userAlreadyKnows: true,
      trivial: false,
      newInformation: "你很重視幸福",
    },
    {
      id: "c-drop-sleep",
      type: "pattern",
      idea: "心情很好跟想睡不衝突",
      evidence: ["f4"],
      userAlreadyKnows: false,
      trivial: true,
      newInformation: "想睡可能代表身體累",
    },
    {
      id: "c-pass-rel",
      type: "connection",
      idea: "你最近做的覺察，好像不只讓你更了解自己。跟 Baby 也因此多了很多可以聊的東西，改變可能已經開始影響相處的方式。",
      evidence: ["f1", "f2"],
      userAlreadyKnows: false,
      trivial: false,
      newInformation: "持續覺察可能開始改變兩人的互動方式",
    },
    {
      id: "c-pass-ramen",
      type: "value",
      idea: "放在一起看，你在意的可能不只是有人陪，而是對方真的有參與在你的日常裡。",
      evidence: ["f3"],
      userAlreadyKnows: false,
      trivial: false,
      newInformation: "在意的是參與日常，而不只是陪伴",
    },
  ],
  judged: [
    { id: "c-drop-happy", verdict: "DROP", soWhat: 2, paraphraseRisk: 2, reason: "known happiness" },
    { id: "c-drop-sleep", verdict: "DROP", trivialRisk: 2, reason: "trivial tiredness" },
    { id: "c-pass-rel", verdict: "PASS", novelty: 2, specificity: 2, usefulness: 2, evidence: 2, humanness: 2, soWhat: 0, paraphraseRisk: 0, trivialRisk: 0, overinferenceRisk: 0, newInformation: "持續覺察可能開始改變兩人的互動方式" },
    { id: "c-pass-ramen", verdict: "PASS", novelty: 2, specificity: 2, usefulness: 2, evidence: 2, humanness: 2, soWhat: 0, paraphraseRisk: 0, trivialRisk: 0, overinferenceRisk: 0, newInformation: "在意的是參與日常，而不只是陪伴" },
  ],
};

const pack = insightReason.prepareWriterInput(productionReason, PRODUCTION_CTX);
assert(pack.pass.length >= 1, "Production：至少 1 個 PASS");
assert(pack.pass.every((item) => item.id === "c-pass-rel" || item.id === "c-pass-ramen"), "Production：只能留下新 connection");
assert(pack.dropReasons.some((line) => /c-drop-happy/.test(line)), "幸福重述 DROP");
assert(pack.dropReasons.some((line) => /c-drop-sleep/.test(line)), "想睡→累 DROP");
assert(!JSON.stringify(pack.pass).includes("想睡不衝突"), "PASS 不含 trivial");

const oneOnly = insightReason.prepareWriterInput(
  {
    facts: productionReason.facts,
    known: productionReason.known,
    trivial: productionReason.trivial,
    candidates: [productionReason.candidates[2]],
    judged: [productionReason.judged[2]],
  },
  PRODUCTION_CTX
);
assert(oneOnly.pass.length === 1, "1 pass only → 1");

const zero = insightReason.prepareWriterInput(
  {
    facts: productionReason.facts,
    known: productionReason.known,
    trivial: productionReason.trivial,
    candidates: productionReason.candidates.slice(0, 2),
    judged: productionReason.judged.slice(0, 2),
  },
  PRODUCTION_CTX
);
assert(zero.pass.length === 0, "0 pass → 不把 candidate 塞回 final");

const grandma = insightReason.prepareWriterInput(
  {
    facts: [
      { id: "f1", source: "02", text: "被阿嬤誤會覺得很委屈" },
      { id: "f2", source: "02", text: "開始換角度理解，想學習更多體諒" },
    ],
    known: [{ text: "使用者已經知道自己想體諒阿嬤", reason: "user explicitly stated this" }],
    trivial: [],
    candidates: [
      { id: "c-restate", type: "change", idea: "你開始更體諒阿嬤。", evidence: ["f2"], userAlreadyKnows: true, trivial: false, newInformation: "你想體諒阿嬤" },
      {
        id: "c-better",
        type: "change",
        idea: "你這次不是把委屈壓掉，而是開始發現理解對方和承認自己委屈可以同時存在。",
        evidence: ["f1", "f2"],
        userAlreadyKnows: false,
        trivial: false,
        newInformation: "理解對方和承認委屈可以同時存在",
      },
    ],
    judged: [
      { id: "c-restate", verdict: "DROP", paraphraseRisk: 2, reason: "known" },
      { id: "c-better", verdict: "PASS", novelty: 2, specificity: 2, usefulness: 2, evidence: 2, humanness: 2, soWhat: 0, paraphraseRisk: 0, trivialRisk: 0, overinferenceRisk: 0, newInformation: "理解對方和承認委屈可以同時存在" },
    ],
  },
  GRANDMA_CTX
);
assert(grandma.pass.length === 1 && grandma.pass[0].id === "c-better", "阿嬤：不要重述想體諒，要新 information");

const positive = insightReason.prepareWriterInput(
  {
    facts: [
      { id: "f1", source: "02", text: "今天工作順利，學到新東西" },
      { id: "f2", source: "02", text: "跟重要的人吃飯覺得很開心" },
    ],
    known: [{ text: "使用者知道自己很開心", reason: "explicit" }],
    trivial: [],
    candidates: [
      { id: "c-shadow", type: "tension", idea: "你是不是害怕失去這些順利？", evidence: ["f2"], userAlreadyKnows: false, trivial: false, newInformation: "害怕失去" },
      {
        id: "c-keep",
        type: "success",
        idea: "工作順利、學到新東西、跟重要的人吃飯同時出現。比較像你正在累積一種自己也覺得對的日子。",
        evidence: ["f1", "f2"],
        userAlreadyKnows: false,
        trivial: false,
        newInformation: "順利、學習、相處正在組成可保留的成功模式",
      },
    ],
    judged: [
      { id: "c-shadow", verdict: "DROP", reason: "positive-problem-hunt" },
      { id: "c-keep", verdict: "PASS", novelty: 2, specificity: 2, usefulness: 2, evidence: 2, humanness: 2, soWhat: 0, paraphraseRisk: 0, trivialRisk: 0, overinferenceRisk: 0, newInformation: "順利、學習、相處正在組成可保留的成功模式" },
    ],
  },
  POSITIVE_CTX
);
assert(positive.pass.length === 1 && positive.pass[0].type === "success", "正向日找 success pattern，不硬挖陰影");

const twoPass = insightReason.prepareWriterInput(
  {
    ...productionReason,
    candidates: productionReason.candidates.slice(2),
    judged: productionReason.judged.slice(2),
  },
  PRODUCTION_CTX
);
assert(twoPass.pass.length === 2, "2 passes only → 2");

const writerPrompt = insightReason.writerUserPrompt({ context: PRODUCTION_CTX }, pack, "layer");
assert(writerPrompt.includes("PASS CANDIDATES"), "Writer 只拿 PASS");
assert(!writerPrompt.includes("心情很好跟想睡不衝突") || writerPrompt.includes("TRIVIAL"), "Writer 看到 TRIVIAL 是為了禁止");
assert(writerPrompt.includes("持續覺察") || writerPrompt.includes("參與"), "Writer 看得到新 information");

const reasonPrompt = insightReason.reasoningUserPrompt({ context: PRODUCTION_CTX }, "layer");
assert(reasonPrompt.includes("不要使用歷史 retrieval") || reasonPrompt.includes("只讀今天"), "04 第一層不接 history");

const round2Prompt = insightReason.reasoningUserPrompt(
  { context: { ...PRODUCTION_CTX, priorRound: { answer: "我發現我其實比較在意他有沒有真的參與。", selectedQuestion: "你真正在意的是什麼？", deepConclusion: "參與感" } } },
  "extension"
);
assert(round2Prompt.includes("Round 1 USER ANSWER") || round2Prompt.includes("最高權重"), "Round 2 最高權重回答");
assert(round2Prompt.includes("我發現我其實比較在意他有沒有真的參與"), "Round 2 讀到 answer");

const closeBad = reflectionExt.normalizeExtensionCloseResult({
  deepConclusion: "第一輪只看到不確定，第二輪更直接地說：這代表你的核心是依賴。",
});
assert(!closeBad.deepConclusion, "deepConclusion 分析報告語氣必須清空");

const closeGood = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "你不是一定要把所有不確定都消除掉，只是當有人從旁邊提醒你時，你會更容易相信自己的方向。" },
  { context: { selectedQuestion: "真正讓你安心的是什麼？", answer: "只要我知道自己還能掌控就好。有人提醒時我會比較敢信。" } }
);
assert(closeGood.ok, `可帶走結論應通過：${closeGood.issues.join("；")}`);

assert(insightReason.REASONING_SYSTEM.includes("facts"), "Reasoning 輸出 facts");
assert(!insightReason.REASONING_SYSTEM.includes("title + insight"), "Reasoning 不寫使用者文案");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("只寫 PASS"), "04 Writer 不混 Reasoning");
assert(voice.VALUE_ENGINE_BLOCK.includes("VALUE TEST"), "Writer 仍帶 value gate 語言");

let calls = 0;
const fakeAi = async (messages, stage) => {
  calls += 1;
  if (stage === "reason" || stage === "reason-retry") return productionReason;
  return {
    coreQuote: "你的覺察，好像已經開始走進你們的相處裡。",
    items: [
      {
        id: "q1",
        title: "你的覺察開始走進關係裡了",
        insight: pack.pass[0].idea,
        question: "",
      },
    ],
  };
};
insightReason.runReasonWritePipeline({
  callAi: fakeAi,
  ctx: PRODUCTION_CTX,
  kind: "layer",
  reasonMessages: [{ role: "system", content: "x" }, { role: "user", content: "y" }],
}).then((out) => {
  assert(!out.empty, "有 PASS 就要 Writer");
  assert(calls === 2, `Call Count 應為 2，實際 ${calls}`);
  assert(out.meta.passCount >= 1, "meta 有 passCount");
  assert(!JSON.stringify(out.written).includes("facts"), "不把 CoT 傳進 final");
  const gated = reflectionV3.gateReflectionV3Result(out.written, PRODUCTION_CTX);
  assert(gated.questions.length >= 1, "1-item 可過 final gate");

  let zeroCalls = 0;
  return insightReason.runReasonWritePipeline({
    callAi: async (messages, stage) => {
      zeroCalls += 1;
      return { facts: [], known: [], trivial: [], candidates: [], judged: [] };
    },
    ctx: PRODUCTION_CTX,
    kind: "layer",
    reasonMessages: [{ role: "system", content: "x" }, { role: "user", content: "y" }],
  }).then((emptyOut) => {
    assert(emptyOut.empty, "0 pass → empty，不塞 candidate");
    assert(zeroCalls === 2, "0 pass 只 regen Reasoning 一次");
    console.log("insight reasoning architecture fixtures ok");
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
