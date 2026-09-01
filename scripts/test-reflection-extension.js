const fs = require("fs");
const path = require("path");
const reflectionV3 = require("../lib/reflection-v3");
const reflectionExt = require("../lib/reflection-extension");
const reviewMerge = require("../lib/review-merge");
const internalTest = require("../lib/internal-test");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const reflectionSrc = fs.readFileSync(path.join(root, "lib/reflection-v3.js"), "utf8");

assert(html.includes('id="thinkV3Extension"'), "延伸容器存在");
assert(html.includes('id="thinkV3Result"'), "第一層容器仍在");
assert(html.includes("看看今天真正值得想的是什麼"), "第一層 CTA 未改");
assert(app.includes("function renderThinkV3"), "第一層 render 仍在");
assert(app.includes("function generateReflectionV3"), "第一層 generate 仍在");
assert(app.includes("function generateThinkExtensionAsk"), "延伸 ask 存在");
assert(app.includes("function generateThinkExtensionClose"), "延伸 close 存在");
assert(app.includes("想再往裡面看一點"), "入口文案");
assert(app.includes("第一次") && app.includes("renderThinkExtensionRecord"), "完成後保留第一次");
assert(app.includes("延伸深度思考｜第二次"), "第二次不覆蓋第一次");
assert(app.includes("其他題目"), "未選題次要化");
assert(app.includes("coreThread"), "persist coreThread");
assert(app.includes("selectedQuestionText"), "persist selectedQuestionText");
assert(app.includes("延伸深度思考 →"), "入口 CTA");
assert(app.includes("整理這次的深度思考 →"), "結論 CTA");
assert(app.includes("再延伸一次 →"), "第二輪 CTA");
assert(app.includes('name="${escapeHtml(groupName)}"') || app.includes("reflection-extension-question-"), "radio name 依 round");
assert(app.includes("data-extension-question"), "selection delegation hook");
assert(app.includes("function syncThinkExtensionSelectionUi"), "選題只更新局部 UI");
assert(app.includes("type=\"radio\""), "radio input");
assert(app.includes("id=\"thinkExtAnswer\""), "選題後 textarea");
assert(app.includes("寫下你現在真正想到的答案"), "回答提示");
assert(css.includes(".think-ext-block"), "延伸樣式在正文流");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "zero schema");

assert(app.includes("generateThinkExtensionAsk({ confirmed: true })"), "只有 CTA confirmed 才生成問題");
assert(app.includes("if (!options || options.confirmed !== true) return"), "沒 confirmed 不生成");
assert(reflectionExt.reflectionExtensionGenerationAllowed({ confirmed: true }), "confirmed 才允許");
assert(!reflectionExt.reflectionExtensionGenerationAllowed({}), "沒 confirmed 不允許");
assert(!reflectionExt.reflectionExtensionGenerationAllowed({ auto: true, confirmed: true }), "auto 不允許");
assert(!/function persistJournalNow[\s\S]{0,280}generateThinkExtensionAsk/.test(app), "autosave 不生成延伸問題");
assert(!/function scheduleJournalAutosave[\s\S]{0,240}generateThinkExtensionAsk/.test(app), "debounce 不生成延伸問題");
assert(!/function persistJournalNow[\s\S]{0,280}generateThinkExtensionClose/.test(app), "autosave 不生成結論");
assert(!/function generateReflectionV3[\s\S]{0,1800}generateThinkExtensionAsk/.test(app), "04 完成不自動延伸");
assert(!/function loadReviewForDate[\s\S]{0,900}generateThinkExtensionAsk/.test(app), "reload 不生成延伸");
assert(!reviewJs.includes("attachCloudAwarenessHistory") || /mode === "checklist" \|\| body.mode === "prompts" \|\| body.mode === "choices"/.test(reviewJs), "insight 不掛歷史");
assert(!reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("embeddings"), "不提 embeddings");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("不要讀過往日期"), "prompt 只讀今天");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("ONE CORE THREAD"), "先找單一核心");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("40～180"), "問題含前因可以稍長");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("NEXT LAYER"), "第二輪往下一層");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("UNRESOLVED TENSION"), "第二輪先找未解張力");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("PARALLEL ANGLE"), "第二輪不是平行角度");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("前因"), "問題必須有前因");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("ALREADY EXPLORED"), "第二輪先做 coverage");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("user answer"), "第二輪權重含回答");
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("不要讀過往日期"), "結論也只讀今天");
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("ONE CORE CONCLUSION"), "結論聚焦");
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("多看見了什麼"), "第二輪結論往下一層");
assert(reflectionExt.reflectionExtensionAskUserPrompt({ context: { priorRound: { answer: "我很在意被看見", deepConclusion: "你在意特定的人", coreThread: "被看見", selectedQuestion: "你在意被看見嗎？", questions: [{ text: "你在意被看見嗎？" }] } } }).includes("第一輪她親自回答"), "Round 2 prompt 放回答");
assert(reviewJs.includes("reflectionExt.isReflectionExtensionRequest"), "review 接 extension");
assert(reviewJs.includes("reflectionV3.isReflectionV3Request"), "review 仍接第一層");
assert(reviewJs.includes("delete body.completedCount"), "不信 client completedCount");
assert(reviewJs.includes("enforceExtensionRoundLimit"), "server 用 persisted journal 限 2 次");
assert(reviewJs.includes("loadPersistedJournalForDate"), "只讀當天 journal");
assert(reviewJs.includes("attachRound1RelevantHistory"), "Round 1 ask 才接 retrieval");
assert(reviewJs.includes("stripRound1HistorySpoof"), "不信 client selectedPast");
assert(!/reflectionExtensionCloseUserPrompt[\s\S]{0,200}usedPast/.test(reviewJs), "deepConclusion 不接歷史");
assert(!/isReflectionV3Request[\s\S]{0,800}retrieveRelevantHistory/.test(reviewJs), "04 第一層不接 history retrieval");
assert(reviewJs.includes("isHistoryRetrievalRequest"), "retrieval 走獨立 internal mode");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("TODAY FIRST"), "Round 1 今天優先");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("HISTORICAL VALUE CHECK"), "歷史要再過 value gate");
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("不要讀過往日期"), "結論仍不讀歷史");
assert(html.includes("app.js?v=283"), "cache js");
assert(html.includes("lib/review-merge.js?v=28"), "cache merge");
assert(app.includes("document.getElementById(\"thinkExtAnswer\")"), "close 讀 current textarea");
assert(app.includes("今日已完成"), "完成次數文案");
assert(app.includes("前面的內容有修改，這次延伸思考是依照修改前的內容產生"), "stale 提示");
assert(app.includes("回答有修改，重新整理深度結論"), "answer stale 提示");
assert(app.includes("readonly") && app.includes("thinkExtAnswer"), "completed 可 read-only");
assert(internalTest.applyInternalTodayReset, "internal reset 仍在");

assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("OPEN THE THINKING"), "第一層 prompt 未拆");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("LEADING QUESTION CHECK"), "第一層 leading 仍在");
assert(app.includes("function generateAwarenessV3"), "05 未拆");
assert(app.includes("function generateExecutionV3"), "06 未拆");
assert(!app.includes("deepConclusion") || !/awarenessV3Context[\s\S]{0,400}deepConclusion/.test(app), "05 不吃 deepConclusion");
assert(!/executionV3Context[\s\S]{0,400}deepConclusion/.test(app), "06 不吃 deepConclusion");
assert(!/awarenessV3SourceSig[\s\S]{0,500}extension/.test(app), "05 sig 不含 extension");
assert(!/executionV3SourceSig[\s\S]{0,400}extension/.test(app), "06 sig 不含 extension");

const layer = {
  thanksText: "還有地方住",
  event: "家裡環境讓我很不舒服，因為男友，我現在只能住這裡。",
  mood: "悶",
  bodyMindText: "一回到客廳就胸口緊。",
  coreQuote: "真正需要被看見的，也許不是你能不能忍受，而是這段安排正在交換掉多少選擇。",
  thinkQuestions: [
    { id: "q1", text: "你現在說只能接受，這裡面有哪些是真的不能改變，哪些其實是你目前還不願意付出改變的代價？" },
    { id: "q2", text: "如果家人已經完全理解你的不舒服，但生活方式仍然不改變，你真正要處理的還會是被理解嗎？" },
    { id: "q3", text: "如果繼續維持這段生活安排，你最不希望自己三年後已經習慣失去的是什麼？" },
  ],
};

const QUALITY = [
  {
    id: "A",
    name: "家庭衝突",
    context: { ...layer },
    result: {
      coreThread: "接受現況 vs 真正選擇",
      questions: [
        { id: "eq1", text: "這句「只能住這裡」，有沒有把省事和你願意長期交換的生活混在一起？" },
        { id: "eq2", text: "如果男友這件事消失，家裡的不舒服還會讓你覺得自己沒有出口嗎？" },
        { id: "eq3", text: "你比較不能接受的，是這個環境本身，還是自己越來越沒有位置？" },
      ],
    },
    forbid: /童年創傷|依附|討好型人格/,
  },
  {
    id: "B",
    name: "伴侶衝突",
    context: {
      thanksText: "他還願意聽",
      event: "跟男友為了一件小事吵起來，後來都沒說話。",
      mood: "委屈",
      bodyMindText: "吵完後胃一直緊。",
      coreQuote: "今天卡住的，也許不是誰對誰錯，而是兩個人有沒有真的站在同一件事情上。",
      thinkQuestions: [
        { text: "這次衝突裡，有沒有把『被聽懂』和『對方必須同意你』混成同一件事？" },
        { text: "如果他理解了你的感受，但不改變做法，你真正在意的還是這次吵架本身嗎？" },
        { text: "你希望修的是這次事件，還是你們以後碰到不同意見時的位置？" },
      ],
    },
    result: {
      coreThread: "被聽見 vs 被放在一邊",
      questions: [
        { id: "eq1", text: "這次沉默，是在保護關係，還是在等對方先承認你的位置？" },
        { id: "eq2", text: "真正讓胃緊的，是這件小事，還是自己又被放在一邊？" },
        { id: "eq3", text: "你比較想要的，是趕快和好，還是以後不必用沉默證明自己受傷？" },
      ],
    },
  },
  {
    id: "C",
    name: "工作",
    context: {
      thanksText: "今天總算做完一版",
      event: "員工交出來的東西和我要的標準差很多。",
      mood: "煩",
      bodyMindText: "看完檔案太陽穴一直跳。",
      coreQuote: "今天卡住的，也許不是這份檔案，而是標準有沒有被說成同一件事。",
      thinkQuestions: [
        { text: "這個落差裡，有哪些是能力問題，哪些其實是你還沒把標準講成對方聽得懂的語言？" },
        { text: "你現在煩的是成果不夠好，還是你必須再花一次時間把同一件事講清楚？" },
        { text: "如果對方已經盡力，但永遠到不了你的標準，你真正要決定的是什麼？" },
      ],
    },
    result: {
      coreThread: "工作標準 vs 自己一個人補完",
      questions: [
        { id: "eq1", text: "這個標準裡，有多少是工作需要，有多少是你不想看起來隨便？" },
        { id: "eq2", text: "你比較受不了的，是品質不夠，還是又得自己一個人補完？" },
        { id: "eq3", text: "如果標準再講一次仍只到七成，你會看成訓練成本，還是人選問題？" },
      ],
    },
    forbid: /害怕不被肯定|討好型人格/,
  },
  {
    id: "D",
    name: "已經知道答案",
    context: {
      thanksText: "我知道要溝通",
      event: "我知道要跟媽媽好好說話，也知道我希望她理解我。",
      mood: "平靜",
      bodyMindText: "想開口時胸口還是緊。",
      coreQuote: "你已經知道方向，真正還沒被檢查的，也許是那句『我知道』本身。",
      thinkQuestions: [
        { text: "這句『我知道』，是真的準備好了，還是先把下一步說成已經完成？" },
        { text: "你希望她理解的，是這件事，還是你在這件事裡的位置？" },
        { text: "胸口還緊的時候，你真正卡的是開口，還是開口之後可能被怎麼接住？" },
      ],
    },
    result: {
      coreThread: "被理解 vs 開口後站得住",
      questions: [
        { id: "eq1", text: "如果她理解事實但不改態度，你還會覺得這次溝通算成功嗎？" },
        { id: "eq2", text: "還沒說出口，是在等時機，還是在等自己比較不會受傷的版本？" },
        { id: "eq3", text: "這次你比較需要的，是被理解，還是自己先能在開口時站得住？" },
      ],
    },
    forbid: /你希望對方理解什麼|你想怎麼溝通/,
  },
  {
    id: "E",
    name: "單純疲累",
    context: {
      thanksText: "終於下班",
      event: "今天工作很多，真的很累。",
      mood: "累",
      bodyMindText: "回家後整個人都痠。",
      coreQuote: "今天也許沒有更深的故事，就是身體先到了。",
      thinkQuestions: [
        { text: "這份累裡，有多少是今天真的做太多，有多少是你習慣把休息排在最後？" },
        { text: "如果今天只是累，你還需要給它一個更複雜的解釋嗎？" },
        { text: "你現在最需要的，是弄懂為什麼累，還是先讓身體停下來？" },
      ],
    },
    result: {
      coreThread: "承認只是累 vs 還要再擠效率",
      questions: [
        { id: "eq1", text: "如果先承認今天就是累，你還會覺得自己應該再擠一點效率嗎？" },
        { id: "eq2", text: "這份痠比較像做完了可以停，還是停下來會覺得自己沒做夠？" },
        { id: "eq3", text: "明天工作還很多時，你比較想保住產出，還是身體還能回來的力氣？" },
      ],
    },
    forbid: /童年|討好|不安全感/,
  },
  {
    id: "F",
    name: "幸福",
    context: {
      thanksText: "有他在",
      event: "今天跟男友吃飯一直笑，覺得很幸福。",
      mood: "開心",
      bodyMindText: "吃飯時整個人都很放鬆。",
      coreQuote: "今天值得帶走的，也許不是這頓飯，而是你在這段關係裡可以很像自己。",
      thinkQuestions: [
        { text: "這份放鬆裡，有哪些條件是你其實很在意、只是平常很少停下來看？" },
        { text: "你覺得幸福的時候，自己是什麼樣子？" },
        { text: "今天有沒有哪一刻，是你希望之後還能常常發生的？" },
      ],
    },
    result: {
      coreThread: "在關係裡可以很像自己",
      questions: [
        { id: "eq1", text: "這頓飯裡，讓你最像自己的，是被接住，還是你自己不必用力表現？" },
        { id: "eq2", text: "這種放鬆，是事情剛好順利，還是在他旁邊不必先證明自己？" },
        { id: "eq3", text: "如果這份狀態值得留，你想留下的是氣氛，還是那個不必緊繃的自己？" },
      ],
    },
    forbid: /創傷|害怕失去|依附|隱藏問題/,
  },
  {
    id: "G",
    name: "客觀問題",
    context: {
      thanksText: "冷氣終於來了",
      event: "辦公室冷氣壞掉，整天下午熱到沒辦法專心。",
      mood: "煩",
      bodyMindText: "頭有點昏，一直流汗。",
      coreQuote: "今天的煩，也許先是環境，不必立刻變成性格問題。",
      thinkQuestions: [
        { text: "這次沒辦法專心，有多少是熱本身，有多少是你還在要求自己不受影響？" },
        { text: "這種客觀干擾出現時，你通常會先怪環境，還是先怪自己不夠穩定？" },
        { text: "如果明天冷氣還是壞的，你真正能決定的是哪一部分？" },
      ],
    },
    result: {
      coreThread: "客觀環境 vs 仍用平常標準要求自己",
      questions: [
        { id: "eq1", text: "熱到頭昏時，你還把「應該專心」當成自己能完全控制的事嗎？" },
        { id: "eq2", text: "你比較煩的是工作被打斷，還是自己明明不舒服還繼續撐？" },
        { id: "eq3", text: "環境暫時改不了時，你願意把今天標準放下一點，還是仍用平常要求自己？" },
      ],
    },
    forbid: /不安全感|討好|童年/,
  },
  {
    id: "H",
    name: "evidence 不足",
    context: {
      thanksText: "平安",
      event: "今天有點怪怪的，說不上來。",
      mood: "平靜",
      bodyMindText: "沒有特別強烈的感覺，就是有點空。",
      coreQuote: "今天也許還不必命名，先讓『說不上來』停在自己的位置。",
      thinkQuestions: [
        { text: "這份空，比較像累了，還是像還沒找到今天真正想看的那一件事？" },
        { text: "你現在需要的是找出原因，還是允許自己先不知道？" },
        { text: "如果今天沒有大事件，你還會不會覺得自己應該挖出更深的問題？" },
      ],
    },
    result: {
      coreThread: "先讓這份怪怪的停著",
      questions: [
        { id: "eq1", text: "這份怪怪的，你比較想立刻解釋清楚，還是先讓它只是還不成形的感覺？" },
        { id: "eq2", text: "如果今天沒有需要被解決的問題，你還能接受這樣過完一天嗎？" },
        { id: "eq3", text: "這份空比較像休息，還是像你習慣在平靜裡找一件值得分析的事？" },
      ],
    },
    forbid: /童年創傷|依附|討好型人格/,
  },
  {
    id: "I",
    name: "major life decision",
    context: {
      thanksText: "還有選擇",
      event: "收到兩份工作 offer，一個穩定一個更想做，不知道要選哪邊。",
      mood: "猶豫",
      bodyMindText: "一想到要回覆，胸口就緊。",
      coreQuote: "今天真正難的，也許不是資訊不夠，而是兩個你都還沒準備放棄。",
      thinkQuestions: [
        { text: "你現在卡住的，是不知道哪個比較好，還是不願意承擔放棄另一個的代價？" },
        { text: "穩定對你來說是安全，還是一種你還不想承認的自我限制？" },
        { text: "更想做的那份，吸引你的是工作本身，還是『我終於選了自己』這件事？" },
      ],
    },
    result: {
      coreThread: "選穩定 vs 站到自己比較想過的生活",
      questions: [
        { id: "eq1", text: "兩年後回頭看，你比較怕選錯，還是從來沒站到自己比較想過的生活上？" },
        { id: "eq2", text: "胸口緊時，你是怕失去穩定，還是怕選了想做的之後沒有退路？" },
        { id: "eq3", text: "這次決定裡，有沒有把家人怎麼看，和你願意過的日子疊成同一標準？" },
      ],
    },
  },
  {
    id: "J",
    name: "第一層已經問得很完整",
    context: { ...layer },
    result: {
      coreThread: "看清現實 vs 繼續不選",
      questions: [
        { id: "eq1", text: "三年後還住這裡，你比較不能接受環境沒變，還是自己不再問有沒有別的路？" },
        { id: "eq2", text: "這段安排裡，有沒有一條界線你已經隱約知道，只是還沒用來衡量關係？" },
        { id: "eq3", text: "家人不一定會改這句話，是幫你看清現實，還是讓你比較容易繼續不選？" },
      ],
    },
  },
];

QUALITY.forEach((spec) => {
  const judged = reflectionExt.evaluateExtensionAskQuality(spec.result, { context: spec.context, forbid: spec.forbid });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
});

const repeatLayer = reflectionExt.evaluateExtensionAskQuality(
  {
    questions: [
      { id: "eq1", text: "你現在說只能接受，這裡面有哪些是真的不能改變，哪些其實是你目前還不願意付出改變的代價？" },
      { id: "eq2", text: "家人如果理解了但不改，你真正要處理的還會是被理解嗎？" },
      { id: "eq3", text: "繼續這樣住，你最不希望三年後習慣失去什麼？" },
    ],
  },
  { context: layer }
);
assert(repeatLayer.issues.some((item) => item.includes("repeat-layer")), "重複第一層必須 FAIL");

const gather = reflectionExt.evaluateExtensionAskQuality(
  {
    questions: [
      { id: "eq1", text: "發生了什麼讓你最難受？" },
      { id: "eq2", text: "你當時感覺如何？" },
      { id: "eq3", text: "你希望對方做了什麼？" },
    ],
  },
  { context: layer }
);
assert(gather.issues.some((item) => item.includes("info-gathering")), "information-gathering 必須 FAIL");

const leading = reflectionExt.evaluateExtensionAskQuality(
  {
    questions: [
      { id: "eq1", text: "你其實不需要別人肯定，是不是該放下？" },
      { id: "eq2", text: "成熟的人應該接受這一切，對不對？" },
      { id: "eq3", text: "你應該離開，不是嗎？" },
    ],
  },
  { context: layer }
);
assert(leading.issues.some((item) => item.includes("leading")), "leading 必須 FAIL");

const closeOk = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "你現在看見的，也許不是能不能繼續住，而是這份安排正在用選擇換安定，而你還沒決定這筆交換值不值得。" },
  {
    context: {
      ...layer,
      selectedQuestion: "這段『只能住這裡』裡，有沒有把最省事的安排和你願意長期交換的生活混在一起？",
      answer: "我想了一下，其實不是完全沒有選擇，是我不想先把關係弄僵。穩定很重要，可是我開始覺得自己的空間也在被換走。",
    },
  }
);
assert(closeOk.ok, `結論應通過：${closeOk.issues.join("；")}`);

const closeSummary = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "我想了一下，其實不是完全沒有選擇，是我不想先把關係弄僵。穩定很重要，可是我開始覺得自己的空間也在被換走。" },
  {
    context: {
      selectedQuestion: "有沒有把最省事的安排和長期交換混在一起？",
      answer: "我想了一下，其實不是完全沒有選擇，是我不想先把關係弄僵。穩定很重要，可是我開始覺得自己的空間也在被換走。",
    },
  }
);
assert(closeSummary.issues.includes("conclusion-is-summary"), "結論不能只是回答摘要");

const closeAction = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "下一步是明天就先開口跟對方談搬家，並列一張行動清單。" },
  { context: { selectedQuestion: "你真正要決定的是什麼？", answer: "我其實已經知道自己想要空間。" } }
);
assert(closeAction.issues.includes("conclusion-action") || !closeAction.deepConclusion, "結論不能偷做 06");

const scattered = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "被看見",
    questions: [
      { id: "eq1", text: "你是不是其實在懷疑自己的價值感？" },
      { id: "eq2", text: "你這次有沒有已經全力以赴了？" },
      { id: "eq3", text: "有沒有別的方法讓過程被更多人知道？" },
    ],
  },
  { context: { event: "做了很多事，但好像沒人看見。", thinkQuestions: [{ text: "你真正在意的是成果，還是被看見？" }] } }
);
assert(!scattered.ok && scattered.issues.includes("thread-ignored"), "三題不能各走各的主題");

const priorSeen = {
  coreThread: "被看見 vs 特定重要的人",
  selectedQuestion: "你真正在意的，是一般人的肯定，還是特定重要的人有沒有看見你的努力？",
  selectedQuestionText: "你真正在意的，是一般人的肯定，還是特定重要的人有沒有看見你的努力？",
  answer: "我發現我真的很在意重要的人有沒有看見我的努力。",
  deepConclusion: "真正影響你的可能不是一般人的肯定，而是特定重要人物是否理解你的付出。",
  questions: [
    { text: "你真正在意的，是一般人的肯定，還是特定重要的人有沒有看見你的努力？" },
    { text: "被看見對你來說，比較像成績被承認，還是關係上的靠近？" },
    { text: "如果努力沒被看見，你還能自己確認這份努力有位置嗎？" },
  ],
};
const round2ok = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "如果那個人看不見，被看見還能是什麼",
    questions: [
      { id: "eq1", text: "如果那個人永遠沒辦法用你期待的方式理解你，你會怎麼重新定義被看見？" },
      { id: "eq2", text: "你想從那份理解裡得到的，比較是肯定、認同，還是關係上的靠近？" },
      { id: "eq3", text: "當被看見不再來自那個人，你還能用什麼方式確認自己的努力有位置？" },
    ],
  },
  { context: { ...layer, priorRound: priorSeen } }
);
assert(round2ok.ok, `Round 2 next layer 應通過：${round2ok.issues.join("；")}`);

const round2repeat = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "被看見",
    questions: [
      { id: "eq1", text: priorSeen.selectedQuestion },
      { id: "eq2", text: "重要的人有沒有看見你的努力，對你來說還重不重要？" },
      { id: "eq3", text: "你是不是其實很需要被肯定？" },
    ],
  },
  { context: { ...layer, priorRound: priorSeen } }
);
assert(
  round2repeat.issues.some((item) => item.includes("repeat-prior") || item.includes("repeat-answer") || item.includes("repeat-conclusion")),
  "Round 2 重問已回答內容必須 FAIL"
);

const seenValue = {
  selectedQuestion: "如果努力沒被看見，你還能自己確認這份努力有位置嗎？",
  answer: "即使沒有人看見，我還是知道自己的努力有價值。",
  deepConclusion: "努力有沒有價值，這件事你其實已經能自己確認。",
};
const round2parallel = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "讓別人看到努力",
    questions: [
      { id: "eq1", text: "那你要怎麼讓別人看到你的努力？" },
      { id: "eq2", text: "有沒有別的方法讓過程被更多人知道？" },
      { id: "eq3", text: "你要怎麼溝通，別人才會理解你的付出？" },
    ],
  },
  { context: { ...layer, priorRound: seenValue } }
);
assert(
  round2parallel.issues.some((item) => item.includes("solution-jump") || item === "parallel-angle"),
  "平行主題／解法題必須 FAIL"
);

const round2next = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "知道有價值，沒被看見時刺痛的是什麼",
    questions: [
      { id: "eq1", text: "如果你知道自己的努力有價值，別人沒看見時，真正刺痛你的又是什麼？" },
      { id: "eq2", text: "「我知道有價值」和「我仍希望重要的人看見」，可以同時成立嗎？" },
      { id: "eq3", text: "你真正想被看見的，是成果本身，還是你在這件事裡的位置？" },
    ],
  },
  { context: { ...layer, priorRound: seenValue } }
);
assert(round2next.ok, `Round 2 未解張力應通過：${round2next.issues.join("；")}`);

const ROUND2 = [
  {
    id: "R2A",
    name: "關係／被看見",
    prior: seenValue,
    result: {
      coreThread: "知道有價值之後，沒被看見刺痛的是什麼",
      questions: [
        { id: "eq1", text: "如果你知道努力有價值，沒人看見時真正刺痛的又是什麼？" },
        { id: "eq2", text: "你仍希望被看見的，是成果被承認，還是自己在關係裡的位置？" },
        { id: "eq3", text: "這份刺痛比較像不被理解，還是像努力沒有被放在心上？" },
      ],
    },
  },
  {
    id: "R2B",
    name: "居住／選擇",
    prior: {
      selectedQuestion: "這句只能住這裡，有沒有把省事和長期交換混在一起？",
      answer: "其實不是完全沒有選擇，是我不想先把關係弄僵。",
      deepConclusion: "你看見的也許不是沒有路，而是還沒準備用選擇去換關係。",
    },
    result: {
      coreThread: "不想弄僵關係，和自己的空間正在被換走",
      questions: [
        { id: "eq1", text: "不想弄僵關係時，你其實在保護誰，又同時放下了什麼？" },
        { id: "eq2", text: "如果關係繼續不僵，空間卻一直被換走，你比較不能接受哪一邊？" },
        { id: "eq3", text: "這次你真正怕的，是開口後的衝突，還是自己從此更沒有位置？" },
      ],
    },
  },
  {
    id: "R2C",
    name: "工作／努力",
    prior: {
      selectedQuestion: "你比較受不了的，是品質不夠，還是又得自己一個人補完？",
      answer: "我比較受不了的是又要自己補。標準有些是工作需要，有些是我不想看起來隨便。",
      deepConclusion: "你卡住的不只是品質，而是自己又得把缺口補成專業的樣子。",
    },
    result: {
      coreThread: "自己補完，是工作需要還是不想看起來隨便",
      questions: [
        { id: "eq1", text: "你自己補完時，補的是工作真的需要的，還是你不想看起來隨便？" },
        { id: "eq2", text: "如果只補工作需要的那一段，你還能接受別人覺得你不夠細嗎？" },
        { id: "eq3", text: "「看起來專業」對你來說，是對事情負責，還是在保護自己的位置？" },
      ],
    },
  },
  {
    id: "R2D",
    name: "溝通很多次",
    prior: {
      selectedQuestion: "還沒說出口，是在等時機，還是在等自己比較不會受傷的版本？",
      answer: "我知道要說，可是我比較怕說了以後她用同一套方式把我推回去。",
      deepConclusion: "你卡住的不是不知道說，而是開口後可能又回到同一種位置。",
    },
    result: {
      coreThread: "開口後又被推回去，真正怕的是什麼",
      questions: [
        { id: "eq1", text: "你怕的是她聽不懂，還是聽懂了仍把你推回原來的位置？" },
        { id: "eq2", text: "如果她還是用同一套方式接你，你會覺得白說，還是自己又沒站住？" },
        { id: "eq3", text: "這次你需要的，是被理解這件事，還是開口時自己先站得住？" },
      ],
    },
  },
  {
    id: "R2E",
    name: "自我懷疑",
    prior: {
      selectedQuestion: "這份怪怪的，你比較想立刻解釋清楚，還是先讓它只是還不成形的感覺？",
      answer: "我其實沒那麼想解釋，我比較怕自己又把平常的事想成我有問題。",
      deepConclusion: "你已經隱約知道，這份空不一定等於你出了錯。",
    },
    result: {
      coreThread: "空不一定是問題，為何仍想證明自己沒有錯",
      questions: [
        { id: "eq1", text: "如果你已經知道這不一定是問題，為什麼仍想先證明自己沒有錯？" },
        { id: "eq2", text: "把平常的事想成「我有問題」，是在理解自己，還是在先責備自己？" },
        { id: "eq3", text: "這份空若只是空，你還能允許它不立刻變成一個結論嗎？" },
      ],
    },
  },
  {
    id: "R2F",
    name: "positive day",
    prior: {
      selectedQuestion: "這頓飯裡，讓你最像自己的，是被接住，還是你自己不必用力表現？",
      answer: "我覺得是我自己也不必用力。在他旁邊我可以很鬆。",
      deepConclusion: "今天值得留下的，也許是你不必先證明自己也能在場。",
    },
    result: {
      coreThread: "不必用力時，你真正放下的是什麼",
      questions: [
        { id: "eq1", text: "你說不必用力，那時你放下的是表現，還是對自己的監看？" },
        { id: "eq2", text: "這種鬆，是因為他接住你，還是你自己也允許自己不用證明？" },
        { id: "eq3", text: "如果沒有這頓飯，你還能在別的地方對自己這麼鬆嗎？" },
      ],
    },
  },
  {
    id: "R2G",
    name: "fatigue",
    prior: {
      selectedQuestion: "如果先承認今天就是累，你還會覺得自己應該再擠一點效率嗎？",
      answer: "我承認今天就是累。如果還要再擠效率，身體會更回不來。",
      deepConclusion: "你已經看見，再擠效率會把身體還能回來的力氣用掉。",
    },
    result: {
      coreThread: "承認只是累之後，為何仍難允許自己停",
      questions: [
        { id: "eq1", text: "你已經承認今天就是累，為什麼停下來仍會覺得自己沒做夠？" },
        { id: "eq2", text: "身體回不來時，你比較怕的是效率掉了，還是自己看起來不夠撐？" },
        { id: "eq3", text: "若明天還很多，你要保住的是產出，還是今天說的那份力氣？" },
      ],
    },
  },
  {
    id: "R2H",
    name: "objective issue",
    prior: {
      selectedQuestion: "熱到頭昏時，你還把「應該專心」當成自己能完全控制的事嗎？",
      answer: "我知道是冷氣的問題，可是我還是會怪自己不夠穩定。",
      deepConclusion: "你已經看見環境是真的，卻仍用平常的自己要求自己。",
    },
    result: {
      coreThread: "環境是真的，為何仍把責任收到自己身上",
      questions: [
        { id: "eq1", text: "你已經知道是冷氣，為什麼還是先怪自己不夠穩定？" },
        { id: "eq2", text: "把責任收到自己身上，是在求控制，還是不習慣環境也可以是原因？" },
        { id: "eq3", text: "如果今天真的只是熱，你還需要用「不夠穩定」來解釋自己嗎？" },
      ],
    },
  },
];

ROUND2.forEach((spec) => {
  const judged = reflectionExt.evaluateExtensionAskQuality(spec.result, {
    context: { ...layer, priorRound: spec.prior },
  });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
  assert(
    !spec.result.questions.some((item) => reflectionExt.looksSolutionJump(item.text)),
    `${spec.id} 不該跳到解法`
  );
});

const persistedRound = reflectionExt.normalizeReflectionExtensionRound(
  {
    id: "ext_keep",
    coreThread: "接受現況 vs 真正選擇",
    questions: [
      { id: "eq1", text: "這句只能住這裡，有沒有把省事和長期交換混在一起？" },
      { id: "eq2", text: "男友這件事消失後，不舒服還在嗎？" },
      { id: "eq3", text: "你比較不能接受環境，還是自己沒有位置？" },
    ],
    selectedQuestionId: "eq1",
    selectedQuestionText: "這句只能住這裡，有沒有把省事和長期交換混在一起？",
    answer: "我想了一下，其實不是完全沒有選擇。",
    deepConclusion: "你看見的也許是選擇正在被交換。",
    completedAt: "2026-08-31T01:00:00.000Z",
    sourceSig: "sig",
  },
  0
);
assert(persistedRound.coreThread === "接受現況 vs 真正選擇", "coreThread 會保存");
assert(persistedRound.selectedQuestionText.includes("只能住這裡"), "selectedQuestionText 會保存");
const twoKept = reviewMerge.normalizeReflectionExtension({
  rounds: [
    persistedRound,
    {
      id: "ext_next",
      coreThread: "如果那個人看不見",
      questions: [
        { id: "eq1", text: "如果他永遠不理解，你會怎麼重新定義被看見？" },
        { id: "eq2", text: "你想從理解裡得到的是肯定還是靠近？" },
        { id: "eq3", text: "被看見不再來自他時，你還能怎麼確認努力有位置？" },
      ],
      selectedQuestionId: "eq2",
      selectedQuestionText: "你想從理解裡得到的是肯定還是靠近？",
      answer: "我比較想要的是靠近。",
      deepConclusion: "比第一輪再往下，你要的不是被評分，是關係上的位置。",
      completedAt: "2026-08-31T02:00:00.000Z",
    },
  ],
});
assert(twoKept.rounds.length === 2, "兩輪都保留");
assert(twoKept.rounds[0].coreThread && twoKept.rounds[1].coreThread, "兩輪 coreThread 都在");
assert(twoKept.rounds[0].selectedQuestionText && twoKept.rounds[1].answer, "第一輪選題與第二輪回答都在");

const emptyExt = reflectionExt.normalizeReflectionExtension({});
assert(emptyExt.rounds.length === 0, "空 extension 安全");
assert(reviewMerge.normalizeAwarenessV3Bag({ items: [{ id: "a1", text: "我看見自己會先忍。" }, { id: "a2", text: "我看見自己在意位置。" }, { id: "a3", text: "我看見自己很少開口。" }], selectedIds: ["a1"] }).items.length === 3, "05 不因 extension 崩潰");

const three = reviewMerge.normalizeReflectionExtension({
  rounds: [
    { id: "ext1", questions: [{ id: "eq1", text: "一？" }, { id: "eq2", text: "二？" }, { id: "eq3", text: "三？" }], selectedQuestionId: "eq1", answer: "我已經寫下真正想到的答案了。", answerSig: "我已經寫下真正想到的答案了。", deepConclusion: "你看見的是選擇正在被交換。", completedAt: "2026-08-31T01:00:00.000Z" },
    { id: "ext2", questions: [{ id: "eq1", text: "四？" }, { id: "eq2", text: "五？" }, { id: "eq3", text: "六？" }], selectedQuestionId: "eq2", answer: "第二次我也認真回答了這件事。", answerSig: "第二次我也認真回答了這件事。", deepConclusion: "你看見的是界線還沒被說出口。", completedAt: "2026-08-31T02:00:00.000Z" },
    { id: "ext3", questions: [{ id: "eq1", text: "七？" }], selectedQuestionId: "eq1", answer: "不該存在的第三輪。", deepConclusion: "第三輪", completedAt: "2026-08-31T03:00:00.000Z" },
  ],
});
assert(three.rounds.length === 2, "最多保存 2 rounds");
assert(reviewMerge.completedExtensionCount(three) === 2, "完成數最多 2");
assert(!reflectionExt.extensionAskAllowed(three, "ext4"), "第 3 輪 ask 被拒");
assert(reflectionExt.extensionCloseAllowed(three, "ext1"), "已完成 round 可重整結論");
assert(!reflectionExt.extensionCloseAllowed(three, "ext9"), "新的第 3 輪 close 被拒");

const draft = reviewMerge.normalizeReflectionExtension({
  rounds: [{ id: "ext1", questions: [{ id: "eq1", text: "一？" }, { id: "eq2", text: "二？" }, { id: "eq3", text: "三？" }], selectedQuestionId: "eq2", answer: "寫到一半" }],
});
assert(reviewMerge.completedExtensionCount(draft) === 0, "沒結論不算完成");
assert(draft.rounds[0].answer === "寫到一半", "draft answer 保留");

const merged = reviewMerge.mergeInsightObjects(
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: layer.thinkQuestions, extension: draft } },
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: layer.thinkQuestions, extension: { rounds: [] } } }
);
assert(merged.guide.extension.rounds[0].answer === "寫到一半", "merge 不丟 draft");

const edited = reviewMerge.normalizeReflectionExtension({
  rounds: [
    {
      id: "ext1",
      questions: [{ id: "eq1", text: "一？" }, { id: "eq2", text: "二？" }, { id: "eq3", text: "三？" }],
      selectedQuestionId: "eq1",
      answer: "後來我改了答案，但這仍是同一輪。",
      answerSig: "舊的簽名",
      deepConclusion: "舊結論",
      completedAt: "2026-08-31T01:00:00.000Z",
      conclusionStale: true,
    },
  ],
});
assert(reviewMerge.completedExtensionCount(edited) === 1, "改答案仍是同一 completed round");
assert(edited.rounds[0].id === "ext1", "不新增 round");

const reset = internalTest.applyInternalTodayReset({
  date: "2026-08-31",
  completedAt: "",
  journal: {
    event: "今天有事",
    insight: { title: "今日核心金句", guide: { variant: "reflection-v3", coreQuote: "金句", questions: layer.thinkQuestions, extension: three } },
  },
});
assert(reset.journal.internalTestRuns[0].snapshot.journal.insight.guide.extension.rounds.length === 2, "internal reset snapshot 含 extension");
assert(!reset.journal.insight, "fresh run 清空 extension");

assert(html.includes("app.js?v=283"), "cache js");
assert(html.includes("app.css?v=236"), "cache css");
assert(html.includes("lib/review-merge.js?v=28"), "cache merge");

assert(app.includes("id=\"btnThinkExtStart\""), "A: CTA id");
assert(app.includes('node.closest("#btnThinkExtStart")'), "A: delegated handler 有 extension case");
assert(app.includes("generateThinkExtensionAsk({ confirmed: true })"), "A: click 進 ask");
assert(app.includes("正在往裡面整理…"), "B: click 後立即 loading 文案");
assert(app.includes("${loading ? \"disabled\" : \"\"}"), "B: loading 時 CTA disabled");
assert(app.includes('mode: "insight"') && app.includes('variant: "reflection-extension-v1"') && app.includes('step: "ask"'), "C: 一次 insight extension ask");
assert(reviewJs.includes("reflectionExt.isReflectionExtensionRequest"), "D: server 支援 frontend mode");
assert(/async function generateThinkExtensionAsk[\s\S]{0,5000}if \(questions.length < 1\)/.test(app), "E: extension 允許 1 題");
assert(app.includes("upsertThinkExtensionRound"), "F: persist 用 upsert 不會丢掉 draft");
assert(app.includes('role="radiogroup"') && app.includes('type="radio"'), "G: 三題 single-select");
assert(app.includes("state.choicesBusy?.thinkExt") && app.includes("state.choicesToken.thinkExt"), "H: 生成中同一 round 一個 request");
assert(app.includes("persistJournalNow();") && app.includes("function renderThinkExtension"), "I: persist 後可 reload");

const firstDraft = reviewMerge.normalizeReflectionExtension({
  rounds: [{ id: "ext_first", questions: [], selectedQuestionId: "", answer: "", deepConclusion: "" }],
});
assert(firstDraft.rounds.length === 1 && firstDraft.rounds[0].id === "ext_first", "J: extension 不存在／空 draft 可建立第一次");
assert(reviewMerge.completedExtensionCount({}) === 0, "J: extension 不存在 completedCount=0");
assert(reviewMerge.completedExtensionCount(firstDraft) === 0, "J: 空 draft 不算完成");
assert(reflectionExt.extensionAskAllowed(firstDraft, "ext_first"), "J: 第一次一定可用");

const oneDone = reviewMerge.normalizeReflectionExtension({
  rounds: [
    {
      id: "ext1",
      questions: [{ id: "eq1", text: "一？" }, { id: "eq2", text: "二？" }, { id: "eq3", text: "三？" }],
      selectedQuestionId: "eq1",
      answer: "我已經寫下真正想到的答案了。",
      deepConclusion: "你看見的是選擇正在被交換。",
      completedAt: "2026-08-31T01:00:00.000Z",
    },
  ],
});
assert(reviewMerge.completedExtensionCount(oneDone) === 1, "K: 完成 1 次");
assert(reflectionExt.extensionAskAllowed(oneDone, "ext2"), "K: 第二次可用");

const twoDone = reviewMerge.normalizeReflectionExtension({
  rounds: [
    oneDone.rounds[0],
    {
      id: "ext2",
      questions: [{ id: "eq1", text: "四？" }, { id: "eq2", text: "五？" }, { id: "eq3", text: "六？" }],
      selectedQuestionId: "eq2",
      answer: "第二次我也認真回答了這件事。",
      deepConclusion: "你看見的是界線還沒被說出口。",
      completedAt: "2026-08-31T02:00:00.000Z",
    },
  ],
});
assert(reviewMerge.completedExtensionCount(twoDone) === 2, "L: 完成 2 次");
assert(!reflectionExt.extensionAskAllowed(twoDone, "ext3"), "L: 2/2 才禁止再延伸");

const produced = [
  { id: "eq1", text: "這段安排裡，有沒有把最省事和長期交換混在一起？" },
  { id: "eq2", text: "如果男友這件事消失，家裡的不舒服還在嗎？" },
  { id: "eq3", text: "你比較不能接受的是環境，還是自己沒有位置？" },
];
const dropped = reviewMerge.normalizeReflectionExtension({
  rounds: [{ id: "ext_click", questions: [], answer: "", deepConclusion: "" }],
});
const oldMap = {
  variant: "reflection-extension-v1",
  rounds: dropped.rounds.map((item) => (item.id === "missing" ? { ...item, questions: produced } : item)),
};
assert(oldMap.rounds.every((item) => !item.questions.length) || dropped.rounds.length === 1, "舊 map 路徑在空 rounds 時會丢掉題");
const saved = reviewMerge.upsertReflectionExtensionRound(dropped, {
  id: "ext_click",
  questions: produced,
  sourceSig: "thanks\nevent\nmood\nbody\n\n\nquote\nq1|q2|q3",
});
assert(saved.rounds.length === 1, "F: upsert 後仍是 1 round");
assert(saved.rounds[0].questions.length === 3, "E/F: 三題寫回同一 draft");
assert(reviewMerge.completedExtensionCount(saved) === 0, "完成數仍為 0，尚未有結論");

const selectFnStart = app.indexOf("function selectThinkExtensionQuestion");
const selectFnEnd = app.indexOf("\nasync function generateThinkExtensionAsk", selectFnStart);
const selectFn = selectFnStart >= 0 && selectFnEnd > selectFnStart ? app.slice(selectFnStart, selectFnEnd) : "";
assert(selectFn.includes("selectedQuestionId: questionId"), "選題只寫 selectedQuestionId");
assert(selectFn.includes("item.id === current.id ? next : item"), "只改目前 round");
assert(selectFn.includes("syncThinkExtensionSelectionUi()"), "選題只同步目前 round UI");
assert(!selectFn.includes("renderThinkExtension()"), "選題不重建 extension DOM");
assert(!selectFn.includes("renderThinkV3") && !selectFn.includes("renderThinkSection") && !selectFn.includes("fillJournal") && !selectFn.includes("loadReviewForDate"), "選題不重建今日頁");
assert(!selectFn.includes("scrollIntoView") && !selectFn.includes("scrollTo") && !selectFn.includes(".focus("), "選題不 scroll / focus");
assert(selectFn.includes("showHint: false"), "選題走輕量 persist");
assert(selectFn.includes("...ext") && selectFn.includes("rounds:"), "extension 用 merge 不是整包覆寫 guide");

const applyFnStart = app.indexOf("function applyThinkExtension");
const applyFnEnd = app.indexOf("\nfunction upsertThinkExtensionRound", applyFnStart);
const applyFn = applyFnStart >= 0 && applyFnEnd > applyFnStart ? app.slice(applyFnStart, applyFnEnd) : "";
assert(applyFn.includes("...prevGuide"), "apply extension 保留 guide");
assert(applyFn.includes("...prevExt"), "apply extension 保留既有 extension");

const guide = {
  variant: "reflection-v3",
  coreQuote: "真正需要被看見的，也許不是你能不能忍受。",
  questions: layer.thinkQuestions,
  status: "ready",
  extension: {
    variant: "reflection-extension-v1",
    rounds: [
      {
        id: "ext_sel",
        questions: produced,
        selectedQuestionId: "",
        answer: "",
      },
    ],
  },
};
const extBefore = reviewMerge.normalizeReflectionExtension(guide.extension);
const extAfter = reviewMerge.normalizeReflectionExtension({
  ...extBefore,
  rounds: extBefore.rounds.map((item) =>
    item.id === "ext_sel" ? { ...item, selectedQuestionId: "eq2" } : item
  ),
});
const mergedGuide = { ...guide, extension: extAfter };
assert(mergedGuide.variant === "reflection-v3", "選題後 variant 仍在");
assert(mergedGuide.coreQuote === guide.coreQuote, "選題後 coreQuote 仍在");
assert(mergedGuide.questions.length === 3, "選題後第一層 questions 仍在");
assert(mergedGuide.status === "ready", "選題後 status 仍在");
assert(mergedGuide.extension.rounds.length === 1, "選題不新增 round");
assert(mergedGuide.extension.rounds[0].selectedQuestionId === "eq2", "只改 selectedQuestionId");
assert(mergedGuide.extension.rounds[0].questions.length === 3, "三題仍在");

assert(app.includes("reportThinkExtDebug"), "Internal debug 存在");
assert(app.includes("這次沒有整理完成，再試一次。"), "失敗 toast");
assert(css.includes(".think-ext-cta") && css.includes("min-height: 44px"), "M: CTA touch friendly");
assert(!/pointer-events:\s*none/.test(css.split(".think-ext-cta")[1].slice(0, 80) || ""), "M: CTA 沒有 pointer-events none");

console.log("reflection-extension tests passed");
