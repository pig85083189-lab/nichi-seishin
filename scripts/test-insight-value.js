const fs = require("fs");
const path = require("path");
const voice = require("../lib/ing-voice");
const bodyMind = require("../lib/body-mind");
const reflectionV3 = require("../lib/reflection-v3");
const reflectionExt = require("../lib/reflection-extension");
const awarenessV3 = require("../lib/awareness-v3");
const executionV3 = require("../lib/execution-v3");
const reviewMerge = require("../lib/review-merge");
const valueGate = require("../lib/insight-value-gate");
const insightReason = require("../lib/insight-reason");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

const GRANDMA = `今天跟阿嬤發生了一些事情，其實...
後來我開始換一個角度去想，
阿嬤真的老了，
我想學習多一點體諒、多一點理解。`;

const REFERENCE_CTX = {
  thanksText: "跟 Baby 一起吃飯聊天，他幫我切水果，我就覺得很幸福。",
  event: "最近每天都有在學習、工作、閱讀。工作上希望客人能感受到被照顧。",
  mood: "開心",
  bodyMindText: "心情很好，可是身體比較累。",
};

assert(html.includes("app.js?v=280"), "cache app.js");
assert(html.includes("app.css?v=234"), "cache css");
assert(html.includes("lib/review-merge.js?v=25"), "cache merge");
assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "zero schema");

const raw = voice.userRawForPrompt(GRANDMA);
assert(raw.includes("後來我開始換一個角度"), "P0：full raw 含後半");
assert(raw.includes("體諒"), "P0：full raw 含體諒");
assert(raw.includes("\n"), "P0：保留換行");
assert(!raw.endsWith("…"), "P0：不以 … 當截斷標記");
assert(raw.includes("其實..."), "P0：保留使用者省略號");

const longEvent = `${"今天工作上發生了很多事情，".repeat(30)}\n${GRANDMA}`;
const prompt04 = reflectionV3.reflectionV3UserPrompt({
  context: { thanksText: "還有家", event: longEvent, mood: "平靜", bodyMindText: GRANDMA },
});
assert(prompt04.includes("後來我開始換一個角度"), "P0：04 prompt 收到阿嬤後半");
assert(prompt04.includes("體諒"), "P0：04 prompt 收到體諒");
assert(!prompt04.includes("寫到『其實...』就停住了"), "P0：prompt 不教模型說她停住");

const prompt03 = bodyMind.bodyMindUserPrompt({
  context: { bodyMindText: GRANDMA, event: longEvent, thanksText: "還有家", mood: "平靜" },
});
assert(prompt03.includes("後來我開始換一個角度"), "P0：03 prompt 收到全文");

const prompt05 = awarenessV3.awarenessV3UserPrompt({ context: { ...REFERENCE_CTX, event: longEvent } });
assert(prompt05.includes("後來我開始換一個角度"), "P0：05 prompt 收到全文");

const prompt06 = executionV3.executionV3UserPrompt({ context: { ...REFERENCE_CTX, event: longEvent } });
assert(prompt06.includes("後來我開始換一個角度"), "P0：06 prompt 收到全文");

const promptExt = reflectionExt.reflectionExtensionAskUserPrompt({
  context: { ...REFERENCE_CTX, event: longEvent },
});
assert(promptExt.includes("後來我開始換一個角度"), "P0：extension prompt 收到全文");

assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("完整閱讀"), "04 有完整閱讀規則");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("VALUE TEST"), "04 有 value test");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes('"items"'), "04 JSON 用 items");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("ANSWER-NOT-IN-INPUT"), "04 有 answer-in-input");
assert(bodyMind.BODY_MIND_SYSTEM.includes("完整閱讀"), "03 有完整閱讀規則");

const grandmaJudge = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你寫到『其實...』就停住了，好像還沒說完。",
    questions: [
      { id: "q1", text: "你是不是只是先把它寫成感謝讓自己好過？" },
      { id: "q2", text: "你今天開心嗎？" },
      { id: "q3", text: "這件事情其實很有意思。" },
    ],
  },
  { context: { thanksText: "還有家", event: GRANDMA, mood: "平靜", bodyMindText: "胸口有一點緊。" } }
);
assert(!grandmaJudge.ok, "其實... 誤讀必須 FAIL");
assert(grandmaJudge.issues.includes("ellipsis-stop"), "抓住停在其實...");

const referenceGood = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你最近不是突然變厲害，而是每天都在替自己多累積一點。",
    items: [
      {
        id: "q1",
        title: "你其實一直有在累積",
        insight: "你今天寫了學習、工作、閱讀。這不像突然變厲害，比較像每天都在替自己多放一點進去。",
        question: "",
      },
      {
        id: "q2",
        title: "你要的幸福其實很日常",
        insight: "你今天提到一起吃飯、聊天、有人幫你切水果，這些都不是大事。放在一起看，你在意的可能不只是有人陪，而是對方真的有參與在你的日常裡。",
        question: "你很喜歡這種被放在心上的小小陪伴。這會不會也是你最想讓身邊的人，甚至你的客人感受到的東西？",
      },
    ],
  },
  { context: REFERENCE_CTX, requireValueEngine: true, requireCrossSection: true, requireContext: true }
);
assert(referenceGood.ok, `參考日應通過：${referenceGood.issues.join("；")}`);
assert(referenceGood.questions[0].title === "你其實一直有在累積", "title 會保留");
assert(referenceGood.questions[1].text.includes("切水果"), "insight 合成進 text");
assert(referenceGood.questions[1].question.includes("客人"), "optional question 保留");
assert(!referenceGood.questions[0].question, "沒有問題時不硬補 question");

const referenceBad = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "今天是開心的一天。",
    questions: [
      { id: "q1", text: "你今天開心嗎？" },
      { id: "q2", text: "Baby 陪你讓你幸福嗎？" },
      { id: "q3", text: "學習對你重要嗎？" },
    ],
  },
  { context: REFERENCE_CTX, requireValueEngine: true }
);
assert(!referenceBad.ok, "答案已在 input 的問題必須 FAIL");
assert(referenceBad.issues.some((item) => item.includes("answer-in-input")), "answer-in-input 被擋");

const categoryTitle = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你要的幸福好像一直都很簡單。",
    items: [
      { id: "q1", title: "幸福感", insight: "一起吃飯聊天就覺得幸福，你在意的好像是有人在身邊。", question: "" },
      { id: "q2", title: "人際關係", insight: "工作上你希望客人被照顧，這和你自己被打動的方式有一點像。", question: "" },
      { id: "q3", title: "身體狀態", insight: "心情很好，身體還是會累，兩件事可以同時存在。", question: "" },
    ],
  },
  { context: REFERENCE_CTX, requireValueEngine: true }
);
assert(!categoryTitle.ok, "分類 title 必須 FAIL");
assert(categoryTitle.issues.some((item) => item.includes("category-title")), "category title 被擋");

const filler = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "今天值得再看一眼自己真正在意的事。",
    questions: [
      { id: "q1", text: "你今天提到切水果。這是一個很值得思考的地方。" },
      { id: "q2", text: "看到你寫學習。這件事情其實很有意思。" },
      { id: "q3", text: "前面你說身體累。這也反映出一些值得關注的面向。" },
    ],
  },
  { context: REFERENCE_CTX }
);
assert(!filler.ok, "filler 必須 FAIL");
assert(filler.issues.some((item) => item.includes("filler")), "no-filler 被擋");

const positive = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "今天值得留下的，也許是那些很小、卻讓你覺得被放在心上的瞬間。",
    items: [
      { id: "q1", title: "你要的幸福其實很日常", insight: "吃飯、聊天、切水果都讓你覺得被放在心上。放在一起看，你在意的可能不只是有人陪，而是對方真的有參與在你的日常裡。", question: "" },
      { id: "q2", title: "你其實一直有在往前走", insight: "學習、工作、閱讀同時出現，比較像每天替自己多累積一點。", question: "" },
    ],
  },
  { context: REFERENCE_CTX, requireValueEngine: true, forbid: /創傷|害怕失去|依附|隱藏問題/ }
);
assert(positive.ok, `正向日應通過：${positive.issues.join("；")}`);

const grandmaGood = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你不是變得沒有情緒，而是開始能在有情緒之後，多看見對方一點。",
    items: [
      {
        id: "q1",
        title: "你開始比較能理解阿嬤了",
        insight: "你今天先寫了跟阿嬤發生一些事情，後來又換角度去想她真的老了。這不像沒有情緒，比較像情緒過後多看見了她一點。",
        question: "",
      },
      {
        id: "q2",
        title: "體諒是你想學習的下一步",
        insight: "你自己寫了想學習多一點體諒、多一點理解。這已經是一個正在發生的改變，不是事後才被提醒。",
        question: "下次再碰到類似的拉扯時，你覺得自己最容易先卡住的，會是情緒本身，還是不知道怎麼把體諒用出來？",
      },
      {
        id: "q3",
        title: "你沒有把話說到一半",
        insight: "『其實...』後面你其實把原因寫完了。今天值得看的不是沒說完，而是你已經自己走到理解。",
        question: "",
      },
    ],
  },
  {
    context: { thanksText: "還有家", event: GRANDMA, mood: "平靜", bodyMindText: "胸口有一點緊，後來比較鬆。" },
    requireValueEngine: true,
    forbid: /你是不是只是先把它寫成感謝/,
  }
);
assert(grandmaGood.ok, `阿嬤全文洞察應通過：${grandmaGood.issues.join("；")}`);
assert(!grandmaGood.issues.includes("ellipsis-stop"), "正確讀完全文不可被當成停住");

const mergedQ = reviewMerge.normalizeReflectionExtension({
  rounds: [
    {
      id: "ext1",
      questions: [
        { id: "eq1", title: "你在意的可能不是答案", insight: "你剛剛說事情沒有答案也沒關係。", question: "如果真的遇到暫時無法處理的事，你最容易卡住的會是哪裡？" },
      ],
    },
  ],
});
assert(mergedQ.rounds[0].questions[0].title.includes("不是答案"), "merge 保留 title");
assert(mergedQ.rounds[0].questions[0].insight.includes("沒有答案"), "merge 保留 insight");

const awareBag = reviewMerge.normalizeAwarenessV3Bag({
  items: [{ id: "a1", title: "幸福其實很簡單", text: "我發現，喜歡的人在身邊、一起過普通的日子，我就會很滿足。" }],
});
assert(awareBag.items[0].title === "幸福其實很簡單", "05 merge 保留 title");

const awareGood = awarenessV3.evaluateAwarenessV3Quality(
  {
    items: [
      { id: "a1", title: "幸福其實很簡單", text: "我發現，對我來說幸福不一定要做什麼特別的事，喜歡的人真的有參與在日常裡我就會很滿足。" },
      { id: "a2", title: "我很喜歡從生活裡累積", text: "我發現，學習、工作、閱讀這些小事，會讓我覺得自己有在往前走。" },
      { id: "a3", title: "我想把被打動的感覺帶出去", text: "我發現，我希望客人被照顧的方式，其實很像我自己被切水果時被打動的那種感覺。" },
    ],
  },
  { context: REFERENCE_CTX, requireTitle: true }
);
assert(awareGood.ok, `05 有 title 應通過：${awareGood.issues.join("；")}`);

const report = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "第一輪只看到不確定，第二輪更直接地說：這份不確定必須靠他人主動指出才會消失。" },
  { context: { selectedQuestion: "真正讓你安心的是什麼？", answer: "只要我知道自己還能掌控就好。" } }
);
assert(!report.ok, "分析報告語氣必須 FAIL");
assert(report.issues.includes("report-tone"), "deepConclusion 報告語氣被擋");

const takeaway = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "你不是一定要把所有不確定都消除掉，只是當有人從旁邊提醒你時，你會更容易相信自己的方向。" },
  { context: { selectedQuestion: "真正讓你安心的是什麼？", answer: "只要我知道自己還能掌控就好。有人提醒時我會比較敢信。" } }
);
assert(takeaway.ok, `可帶走的發現應通過：${takeaway.issues.join("；")}`);

assert(app.includes("think-v3-kicker") && app.includes("我注意到一件事"), "04 UI 有 discovery heading");
assert(app.includes("think-ext-opt__title"), "extension UI 有 title");
assert(app.includes("aware-v3-item__title"), "05 UI 有 title");
assert(css.includes(".think-v3-q__title"), "title 樣式存在");
assert(app.includes("function mapInsightQuestionItems"), "client 保留 extra fields");
assert(reflectionExt.canStartExtensionRound2({ rounds: [{ id: "ext1", deepConclusion: "看見了", completedAt: "2026-08-31T01:00:00.000Z", questions: [{ id: "eq1", text: "題" }] }] }) === true, "Round 2 仍用 completedAt");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("不是把 Round 1 question 改寫") || reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("Round 1 USER ANSWER") || reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("第一輪 user answer"), "Round 2 最高權重回答");
assert(executionV3.EXECUTION_V3_SYSTEM.includes("自然下一步"), "06 要求 insight 的下一步");
assert(executionV3.EXECUTION_V3_SYSTEM.includes("被淘汰"), "06 不從低價值 candidate 生 action");
assert(executionV3.EXECUTION_V3_SYSTEM.includes("通過價值閘門"), "06 來源必須過 value gate");

const PRODUCTION_CTX = {
  thanksText: "最近每天都有在覺察。今天跟 Baby 聊了很多，第三次一起吃拉麵，他還幫我切奇異果，我覺得很幸福。",
  event: "今天特別開心，也跟 Baby 多了很多可以聊的東西。",
  mood: "開心",
  bodyMindText: "今天特別想睡覺。",
};

const failHappinessQ = {
  id: "q-fail-happy",
  title: "幸福藏在日常裡",
  insight: "會不會這種重複、日常的陪伴，才是你真正注意的幸福感？",
  question: "會不會這種重複、日常的陪伴，才是你真正注意的幸福感？",
};
const failSleep = {
  id: "q-fail-sleep",
  title: "心情很好也可以累",
  insight: "心情很好跟想睡不衝突。",
  question: "這是身體在說今天做得夠多了，還是單純就是累？",
};
const failRestateHappy = {
  id: "q-fail-restate",
  title: "你很重視幸福",
  insight: "你很重視幸福。日常陪伴可能就是你的幸福。",
  question: "日常陪伴就是你的幸福嗎？",
};
const failTired = {
  id: "q-fail-tired",
  title: "身體在說話",
  insight: "想睡可能代表身體累了。",
  question: "你今天是不是很累？",
};
const passRelation = {
  id: "q-pass-relation",
  title: "你的覺察開始走進關係裡了",
  insight: "你最近做的覺察，好像不只讓你更了解自己。你今天特別提到，跟 Baby 也因此多了很多可以聊的東西。這代表你的改變，可能已經開始影響你們相處的方式。",
  question: "最近有沒有哪一次，你明顯感覺自己跟以前的回應方式不一樣了？",
};
const passRamen = {
  id: "q-pass-ramen",
  title: "你記住的幸福，常常都很小",
  insight: "你沒有特別記住多大的安排，反而記得第三次一起吃拉麵、他幫你切奇異果。放在一起看，你在意的可能不只是有人陪，而是對方真的有參與在你的日常裡。",
  question: "",
};

const judgedHappy = valueGate.evaluateInsightCandidate(failHappinessQ, PRODUCTION_CTX);
assert(!judgedHappy.ok, "Production：日常陪伴才是幸福？必須 FAIL");
assert(judgedHappy.issues.some((item) => /so-what|trivial|low-value-question|no-new-information/.test(item)), `幸福重述 issues：${judgedHappy.issues.join(",")}`);

const judgedSleep = valueGate.evaluateInsightCandidate(failSleep, PRODUCTION_CTX);
assert(!judgedSleep.ok, "Production：想睡不衝突必須 FAIL");
assert(judgedSleep.issues.includes("trivial-inference") || judgedSleep.issues.includes("forced-body"), `想睡 issues：${judgedSleep.issues.join(",")}`);

const judgedRestate = valueGate.evaluateInsightCandidate(failRestateHappy, PRODUCTION_CTX);
assert(!judgedRestate.ok, "重述幸福必須 FAIL");
const judgedTired = valueGate.evaluateInsightCandidate(failTired, PRODUCTION_CTX);
assert(!judgedTired.ok, "想睡→累必須 FAIL");

const judgedRelation = valueGate.evaluateInsightCandidate(passRelation, PRODUCTION_CTX);
assert(judgedRelation.ok, `覺察走進關係應通過：${judgedRelation.issues.join("；")}`);
assert(judgedRelation.newInformation, "高價值 insight 必須有 NEW_INFORMATION");
const judgedRamen = valueGate.evaluateInsightCandidate(passRamen, PRODUCTION_CTX);
assert(judgedRamen.ok, `拉麵參與日常應通過：${judgedRamen.issues.join("；")}`);
assert(!passRamen.question, "沒有更值得問時可以 STOP");

const mixed = valueGate.gateItems(
  [failHappinessQ, failSleep, failRestateHappy, failTired, passRelation, passRamen],
  PRODUCTION_CTX,
  "insight"
);
assert(mixed.kept.length === 2, `gate 只留過關項，不可把垃圾撿回：kept=${mixed.kept.length}`);
assert(mixed.kept.every((item) => item.id === "q-pass-relation" || item.id === "q-pass-ramen"), "留下的必須是新 connection");
assert(mixed.dropped.length >= 4, "Production fail examples 必須被 drop");

const onlyBad = reflectionV3.normalizeReflectionV3Result(
  {
    coreQuote: "日常的陪伴，也許就是你真正在意的幸福。",
    items: [failHappinessQ, failSleep, failTired],
  },
  PRODUCTION_CTX
);
assert(onlyBad.questions.length === 0, "全低價值時 final 不可放行");

const gatedGood = reflectionV3.normalizeReflectionV3Result(
  {
    coreQuote: "你的覺察，好像已經開始走進你們的相處裡。",
    items: [failHappinessQ, passRelation, failSleep, passRamen],
  },
  PRODUCTION_CTX
);
assert(gatedGood.questions.length === 2, "2 個過關即可，不必湊 3");
assert(!gatedGood.dropped, "client payload 不含 dropped");
assert(gatedGood.questions.every((item) => /開始影響|參與在你的日常|不只是有人陪|走進關係/.test(`${item.title || ""} ${item.insight || item.text || ""}`)), "留下的必須有新關係");

const twoOk = reflectionV3.evaluateReflectionV3Quality(gatedGood, {
  context: PRODUCTION_CTX,
  valueGate: true,
  requireValueEngine: true,
});
assert(twoOk.ok, `2 個高價值 item 應通過 evaluate：${twoOk.issues.join("；")}`);

const prodEvalFail = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "日常陪伴就是幸福。",
    items: [failHappinessQ, failSleep, failTired],
  },
  { context: PRODUCTION_CTX, valueGate: true }
);
assert(!prodEvalFail.ok, "evaluator + valueGate 必須擋 Production FAIL");

const awareTautology = awarenessV3.evaluateAwarenessV3Quality(
  {
    items: [
      { id: "a1", title: "我發現我很開心", text: "我發現我開心的時候會覺得開心。" },
      { id: "a2", title: "我想睡所以累", text: "我發現今天特別想睡，所以身體可能累了。" },
    ],
  },
  { context: PRODUCTION_CTX, requireTitle: true }
);
assert(!awareTautology.ok, "05 SO WHAT／想睡→累必須 FAIL");

const awareKeep = awarenessV3.normalizeAwarenessV3Result(
  {
    items: [
      { id: "a1", title: "我發現我很開心", text: "我發現我開心的時候會覺得開心。" },
      {
        id: "a2",
        title: "覺察走進關係裡了",
        text: "我發現，最近每天覺察之後，跟 Baby 也因此多了很多可以聊的東西，改變好像已經開始影響相處。",
      },
      {
        id: "a3",
        title: "我在意的是他有參與",
        text: "我發現，我記住的不是多大的安排，而是他真的有參與在拉麵和切奇異果這種日常裡。",
      },
    ],
  },
  PRODUCTION_CTX
);
assert(awareKeep.items.length === 2, `05 gate 應丟掉空話、留下 2 句：${awareKeep.items.length}`);

assert(reviewJs.includes("runDiscoveryPipeline"), "04 first layer is Discovery Engine");
assert(reviewJs.includes("runReasonWritePipeline"), "extension still uses reason pipeline");
assert(reviewJs.includes("insightReason.REASONING_SYSTEM"), "extension Reasoning Engine 仍在");
assert(reviewJs.includes('stage === "write"'), "Writer stage 仍在");
assert(reviewJs.includes("gateAwarenessV3Result"), "05 production 必須執行 value gate");
assert(reviewJs.includes("awarenessV3ValueGateRetryPrompt"), "05 fail 只 regen 一次");
assert(reviewJs.includes("silence"), "04 silence is formal");
assert(!reviewJs.includes("result.questions.length < 3"), "04 不再為湊 3 把垃圾放行");
assert(app.includes("thinkGuideIsSilence") && app.includes('status: "silence"'), "client accepts silence");
assert(voice.VALUE_ENGINE_BLOCK.includes("想睡 → 累"), "prompt 有 trivial kill-list");
assert(!voice.VALUE_ENGINE_BLOCK.includes("不代表身體就不需要休息"), "不再把想睡不衝突當好例子");
assert(insightReason.REASONING_SYSTEM.includes("不要寫 title"), "Reasoning 不寫文案");
assert(insightReason.WRITER_SYSTEM.includes("只寫 PASS"), "Writer 不看 DROP");

const retry = reflectionV3.reflectionV3ValueGateRetryPrompt(mixed.dropped);
assert(retry.includes("不要撿回來"), "retry 不可把 failed candidate 留回");
assert(retry.includes("寧願 2"), "retry 不為湊 3");

console.log("insight value engine fixtures ok");
