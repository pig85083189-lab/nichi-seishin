const fs = require("fs");
const path = require("path");
const reflectionV3 = require("../lib/reflection-v3");
const thinkV2 = require("../lib/think-v2");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes("<span>04</span> 深度思考"), "04 標題仍在");
assert(html.includes('id="btnReflectionV3"'), "V3 CTA 存在");
assert(html.includes("看看今天真正值得想的是什麼"), "V3 CTA 文案");
assert(html.includes("id=\"thinkV3Card\""), "V3 容器存在");
assert(html.includes("js-legacy-think-ui"), "legacy 04 UI 仍在可隱藏");
assert(html.includes("今天真正值得重新思考的是什麼"), "04 fold 文案已換成重新思考");
assert(app.includes('"thinkQuestions", "deepPromptLoading"'), "V3 會關掉訪談殘件");
assert(app.includes("function generateReflectionV3"), "V3 generate 存在");
assert(app.includes('variant: "reflection-v3"'), "request 帶 reflection-v3");
assert(app.includes("generateReflectionV3({ confirmed: true })"), "只有 CTA confirmed 才生成");
assert(app.includes("if (!options || options.confirmed !== true) return"), "沒 confirmed 不生成");
assert(!/function persistJournalNow[\s\S]{0,280}generateReflectionV3/.test(app), "autosave 不生成 04");
assert(!/function scheduleJournalAutosave[\s\S]{0,220}generateReflectionV3/.test(app), "debounce 不生成 04");
assert(!/function loadReviewForDate[\s\S]{0,900}generateReflectionV3/.test(app), "reload 不生成 04");
assert(!/function maybeAutoGenerateInsight[\s\S]{0,80}generateReflectionV3/.test(app), "state update 不生成 04");
assert(app.includes("function generateThinkV2Ask"), "think-v2 未刪");
assert(app.includes("function generateThinkV2Close"), "think-v2 close 未刪");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("只問一個能讓思考往前的問題"), "ask prompt 未改");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("coreConclusion"), "close prompt 未改");
assert(reviewJs.includes("reflectionV3.isReflectionV3Request"), "review 接 V3");
assert(reviewJs.includes("thinkV2.isThinkV2Request"), "review 仍接 V2");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "zero schema");
assert(app.includes("function generateBodyMindInsight"), "03 未拆");
assert(app.includes("generateBodyMindInsight({ confirmed: true })"), "03 CTA 未拆");
assert(app.includes("function generateAwarenessChoices"), "05 未拆");
assert(app.includes("function generateExecDeepFinal"), "06 未拆");

assert(reflectionV3.reflectionV3GenerationAllowed({ confirmed: true }), "confirmed 才允許");
assert(!reflectionV3.reflectionV3GenerationAllowed({}), "沒 confirmed 不允許");
assert(!reflectionV3.reflectionV3GenerationAllowed({ auto: true, confirmed: true }), "auto 不允許");
assert(reflectionV3.reflectionV3Ready({
  thanksText: "還有家",
  event: "媽媽叫我搬出去",
  mood: "難過",
  bodyMindText: "胸口很悶，當下整個人都緊起來。",
}), "01-03 足夠才 ready");
assert(!reflectionV3.reflectionV3Ready({ thanksText: "還有家", event: "搬家", mood: "難過", bodyMindText: "" }), "沒 03 不 ready");

const QUALITY = [
  {
    id: "A",
    name: "家庭／居住",
    context: { thanksText: "還有地方住", event: "家裡環境讓我很不舒服，因為男友，我現在只能住這裡。我知道家人不一定會改。", mood: "悶", bodyMindText: "一回到客廳就胸口緊。" },
    result: {
      coreQuote: "真正需要被看見的，也許不是你能不能忍受這個環境，而是這段安排正在交換掉多少選擇。",
      questions: [
        { id: "q1", text: "你現在說只能接受，這裡面有哪些是真的不能改變，哪些其實是你目前還不願意付出改變的代價？" },
        { id: "q2", text: "如果家人已經完全理解你的不舒服，但生活方式仍然不改變，你真正要處理的還會是被理解嗎？" },
        { id: "q3", text: "如果繼續維持這段生活安排，你最不希望自己三年後已經習慣失去的是什麼？" },
      ],
    },
    forbid: /童年創傷|不安全感|依附/,
  },
  {
    id: "B",
    name: "伴侶衝突",
    context: { thanksText: "他還願意聽", event: "跟男友為了一件小事吵起來，後來都沒說話。", mood: "委屈", bodyMindText: "吵完後胃一直緊。" },
    result: {
      coreQuote: "今天卡住的，也許不是誰對誰錯，而是兩個人有沒有真的站在同一件事情上。",
      questions: [
        { id: "q1", text: "這次衝突裡，有沒有把『被聽懂』和『對方必須同意你』混成同一件事？" },
        { id: "q2", text: "如果他理解了你的感受，但不改變做法，你真正在意的還是這次吵架本身嗎？" },
        { id: "q3", text: "你希望修的是這次事件，還是你們以後碰到不同意見時的位置？" },
      ],
    },
  },
  {
    id: "C",
    name: "已經溝通很多次",
    context: { thanksText: "我有開口", event: "這件事我已經跟對方說過很多次，對方還是這樣。", mood: "無力", bodyMindText: "一想到又要說一次，肩膀就沉下去。" },
    result: {
      coreQuote: "今天累的，也許不是還沒表達，而是表達過之後，事情仍然沒有對上。",
      questions: [
        { id: "q1", text: "你已經說了很多次，下一次再說，比較像是新的溝通，還是重複一個已經無效的方法？" },
        { id: "q2", text: "對方聽懂你的意思，和對方願意改變，這兩件事你現在有沒有當成同一件事？" },
        { id: "q3", text: "如果理解已經發生、改變卻沒發生，你真正要決定的是繼續等，還是重新看這段關係的條件？" },
      ],
    },
    forbid: /你希望對方怎麼做|你真正想要的是什麼/,
  },
  {
    id: "D",
    name: "工作標準",
    context: { thanksText: "今天總算做完一版", event: "員工交出來的東西和我要的標準差很多。", mood: "煩", bodyMindText: "看完檔案太陽穴一直跳。" },
    result: {
      coreQuote: "今天卡住的，也許不是對方不努力，而是標準有沒有被雙方當成同一件事。",
      questions: [
        { id: "q1", text: "你現在生氣的，比較像是結果不夠好，還是你們從來沒有對過『什麼叫夠好』？" },
        { id: "q2", text: "如果對方其實聽懂了方向，只是方法不同，你真正要處理的還會是態度嗎？" },
        { id: "q3", text: "這次你最需要先對上的，是標準、流程，還是誰有最後決策權？" },
      ],
    },
    forbid: /害怕不被肯定|討好型人格/,
  },
  {
    id: "E",
    name: "規格一直改",
    context: { thanksText: "還能把今天做完", event: "主管一路改規格，原本做完的又要重來。", mood: "累", bodyMindText: "回家後肩膀一直緊。" },
    result: {
      coreQuote: "今天最耗你的，也許不是工作本身，而是標準一直被往後推、卻沒人把它停下來。",
      questions: [
        { id: "q1", text: "這些改動裡，有哪些是真的需求變了，哪些其實只是決策還沒被拍板？" },
        { id: "q2", text: "如果規格還會再改，你真正缺的是更多努力，還是一個可以停下來的決策點？" },
        { id: "q3", text: "在你能控制的範圍裡，有沒有一件事可以先被固定，而不必等全部都穩定？" },
      ],
    },
    forbid: /你害怕不被肯定|童年/,
  },
  {
    id: "F",
    name: "自我懷疑",
    context: { thanksText: "還是把簡報交出去了", event: "簡報前一直覺得自己是不是不夠好。", mood: "忐忑", bodyMindText: "上台前手心一直濕。" },
    result: {
      coreQuote: "今天真正纏著你的，也許不是做得不夠，而是你用什麼標準在審判自己。",
      questions: [
        { id: "q1", text: "你說自己不夠好，這個『好』的標準，是今天這份工作需要的，還是你習慣拿來壓自己的？" },
        { id: "q2", text: "如果把『做得完整』和『被喜歡』分開，你對這次簡報的判斷會不會不一樣？" },
        { id: "q3", text: "有沒有一個證據，其實已經說明你今天有把該做的做完，只是還沒被你算進去？" },
      ],
    },
  },
  {
    id: "G",
    name: "已經知道答案",
    context: { thanksText: "我知道要溝通", event: "我知道要跟媽媽好好說話，也知道我希望她理解我。", mood: "平靜", bodyMindText: "想開口時胸口還是緊。" },
    result: {
      coreQuote: "今天你已經知道要表達，真正還沒被看的，也許是你準備用什麼代價去換被理解。",
      questions: [
        { id: "q1", text: "你已經知道要溝通，那這次真正沒被檢查的，是『說了沒有』，還是『怎樣才算被聽見』？" },
        { id: "q2", text: "如果她聽懂了，但不改變立場，你要處理的還會是這次表達嗎？" },
        { id: "q3", text: "胸口這股緊，比較像害怕開口，還是害怕開口之後仍然沒有位置？" },
      ],
    },
    forbid: /你希望對方理解什麼|你想怎麼溝通/,
  },
  {
    id: "H",
    name: "單純疲累",
    context: { thanksText: "終於下班", event: "今天工作很多，真的很累。", mood: "累", bodyMindText: "回家後整個人都痠。" },
    result: {
      coreQuote: "今天最清楚的事實，也許就是身體已經用完了，不必再替它找一個更深的故事。",
      questions: [
        { id: "q1", text: "如果先把『今天只是累』當真，有什麼解釋其實可以先放下？" },
        { id: "q2", text: "這份累比較像一次過量，還是連續幾天都沒被補回來？" },
        { id: "q3", text: "明天你真正需要的，是再推自己一把，還是先讓身體回到可以思考的狀態？" },
      ],
    },
    forbid: /童年|討好|責任感人格|不安全感/,
  },
  {
    id: "I",
    name: "幸福的一天",
    context: { thanksText: "有他在", event: "今天跟男友吃飯一直笑，覺得很幸福。", mood: "開心", bodyMindText: "吃飯時整個人都很放鬆。" },
    result: {
      coreQuote: "今天值得帶走的，也許不是做了什麼特別的事，而是你在這段關係裡可以自然做自己。",
      questions: [
        { id: "q1", text: "今天讓你真正放鬆的，是做了什麼，還是你在這段關係裡可以成為什麼樣的自己？" },
        { id: "q2", text: "如果這種幸福不是偶然，今天有哪些條件其實值得你刻意保留下來？" },
        { id: "q3", text: "這份自在裡，有沒有一個你平常很少允許自己擁有的位置？" },
      ],
    },
    forbid: /創傷|害怕失去|依附|隱藏問題/,
  },
  {
    id: "J",
    name: "客觀問題",
    context: { thanksText: "冷氣終於來了", event: "辦公室冷氣壞掉，整天下午熱到沒辦法專心。", mood: "煩", bodyMindText: "頭有點昏， Sweat 一直流。" },
    result: {
      coreQuote: "今天低落的主因，很可能就是環境真的讓人很難做事，不必先把它讀成性格問題。",
      questions: [
        { id: "q1", text: "如果先把熱和沒專心當成同一件客觀事實，還有什麼解釋其實不必加上去？" },
        { id: "q2", text: "在冷氣修好之前，有哪一件事是你真的能控制的，哪一件其實只能等？" },
        { id: "q3", text: "今天你對自己的不滿，有多少其實只是環境先把你耗乾了？" },
      ],
    },
    forbid: /不安全感|討好|童年/,
  },
  {
    id: "K",
    name: "evidence 不足",
    context: { thanksText: "平安", event: "今天有點怪怪的，說不上來。", mood: "平靜", bodyMindText: "沒有特別強烈的感覺，就是有點空。" },
    result: {
      coreQuote: "今天還看不清楚的，本身就可以先被承認，不必急著替它補一個深層原因。",
      questions: [
        { id: "q1", text: "這份空，比較像沒事發生，還是有一件事你還沒準備好命名？" },
        { id: "q2", text: "如果現在不急著解釋，你最先確定的事實會是什麼？" },
        { id: "q3", text: "有沒有可能，今天需要的不是更深的分析，而是先讓這份不清楚停在這裡？" },
      ],
    },
    forbid: /童年創傷|依附|討好型人格/,
  },
  {
    id: "L",
    name: "03 hypothesis 不同",
    context: {
      thanksText: "還能回家",
      event: "加班到很晚，只覺得身體很累。",
      mood: "累",
      bodyMindText: "今天加班到很晚，大腿和肩膀都很痠。",
      bodyMindInsight: "你可能在意選擇權，害怕自己沒有位置。",
      bodyMindSupport: "先看看選擇是不是不在自己手上。",
    },
    result: {
      coreQuote: "今天最硬的事實仍是身體被工作拉太長，不必先把 03 的假設當成結論。",
      questions: [
        { id: "q1", text: "如果先只看你自己寫的『加班很痠』，還需要立刻談選擇權嗎？" },
        { id: "q2", text: "這次的痠，比較像一次過量，還是一個已經重複太久的節奏？" },
        { id: "q3", text: "在恢復之前，有哪一件工作上的事其實可以明天再面對？" },
      ],
    },
    forbid: /你就是失去選擇權|不安全感|童年/,
  },
];

QUALITY.forEach((spec) => {
  const judged = reflectionV3.evaluateReflectionV3Quality(spec.result, { context: spec.context, forbid: spec.forbid });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
});

const badGather = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你因為居住環境無法自主而感到焦慮。",
    questions: [
      { id: "q1", text: "你最難受的是什麼？" },
      { id: "q2", text: "為什麼你不能搬出去？" },
      { id: "q3", text: "你當時是什麼感覺？" },
    ],
  },
  { context: { event: "家裡環境讓我很不舒服，因為男友只能住這裡。", bodyMindText: "胸口緊。" } }
);
assert(badGather.issues.includes("quote-is-summary") || badGather.issues.includes("q1-info-gathering"), "摘要／補資料必須 FAIL");

const stale = reflectionV3.normalizeReflectionV3({
  coreQuote: "金句",
  questions: [{ text: "一？" }, { text: "二？" }, { text: "三？" }],
  sourceSig: reflectionV3.reflectionV3SourceSig({ event: "舊", mood: "悶", thanksText: "家", bodyMindText: "胸口悶住了。" }),
});
assert(
  reflectionV3.reflectionV3SourceStale(stale, { event: "新的事件", mood: "悶", thanksText: "家", bodyMindText: "胸口悶住了。" }),
  "01-03 修改後 stale"
);

assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("LEADING QUESTION CHECK"), "prompt 有 leading check");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("OPEN THE THINKING"), "prompt 要求打開思考");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("還沒被檢查的結論"), "prompt 會檢查關鍵句");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("也許／可能／或許"), "prompt 要求金句對沖推論");

assert(
  reflectionV3.looksLeadingQuestion("如果全力以赴本來就是你對自己的標準，那別人有沒有看到，是不是已經不是最重要的事？"),
  "暗示正確答案的題必須被抓到"
);
assert(
  !reflectionV3.looksLeadingQuestion("如果全力以赴本來就是你對自己的標準，那現在真正讓你難受的，是付出沒有被看見，還是某個重要的人沒有理解這份付出的意義？"),
  "兩種答案都能成立的題不該被抓"
);

const leading = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你很珍惜別人默默付出的部分，卻擔心自己的付出換不到被看見。",
    questions: [
      { id: "q1", text: "如果全力以赴本來就是你對自己的標準，那別人有沒有看到，是不是已經不是最重要的事？" },
      { id: "q2", text: "你現在說沒關係，是真的放下了，還是你只是決定先往前走？" },
      { id: "q3", text: "這份付出裡，有沒有哪一塊其實是你自己先認定必須被看見的？" },
    ],
  },
  { context: { thanksText: "有人默默幫忙", event: "沒關係，這是磨練。我已經很努力了。", bodyMindText: "胸口有點悶。" } }
);
assert(leading.issues.includes("quote-unhedged"), "原文沒說擔心時，金句不能寫成確定擔心");
assert(leading.issues.includes("q1-leading"), "leading question 必須 FAIL");

const openKey = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "真正值得看的或許是：這句沒關係，是放下，還是先往前走。",
    questions: [
      { id: "q1", text: "這句『沒關係』是真的讓你放下了，還是你只是決定先往前走？" },
      { id: "q2", text: "如果全力以赴本來就是你對自己的標準，那現在真正讓你難受的，是付出沒有被看見，還是某個重要的人沒有理解這份付出的意義？" },
      { id: "q3", text: "這份磨練裡，有哪些是你願意交換的，哪些其實還不想當成必須接受？" },
    ],
  },
  { context: { thanksText: "有人默默幫忙", event: "沒關係，這是磨練。我已經很努力了。", bodyMindText: "胸口有點悶。" } }
);
assert(openKey.ok, `開放題應通過：${openKey.issues.join("；")}`);

console.log("reflection-v3 tests passed");
