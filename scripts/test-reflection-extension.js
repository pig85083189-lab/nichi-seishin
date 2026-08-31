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
assert(app.includes("延伸深度思考 →"), "入口 CTA");
assert(app.includes("整理這次的深度思考 →"), "結論 CTA");
assert(app.includes("再延伸一次 →"), "第二輪 CTA");
assert(app.includes('name="thinkExtQ"'), "radio semantics");
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
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("不要讀過往日期"), "結論也只讀今天");
assert(reviewJs.includes("reflectionExt.isReflectionExtensionRequest"), "review 接 extension");
assert(reviewJs.includes("reflectionV3.isReflectionV3Request"), "review 仍接第一層");
assert(reviewJs.includes("delete body.completedCount"), "不信 client completedCount");
assert(reviewJs.includes("enforceExtensionRoundLimit"), "server 用 persisted journal 限 2 次");
assert(reviewJs.includes("loadPersistedJournalForDate"), "只讀當天 journal");
assert(app.includes("document.getElementById(\"thinkExtAnswer\")"), "close 讀 current textarea");
assert(app.includes("今日已完成"), "完成次數文案");
assert(app.includes("前面的內容有修改，這次延伸思考是依照修改前的內容產生"), "stale 提示");
assert(app.includes("回答有修改，重新整理深度結論"), "answer stale 提示");
assert(app.includes("readonly") && app.includes("thinkExtAnswer"), "completed 可 read-only");
assert(internalTest.applyInternalTodayReset, "internal reset 仍在");

assert(reflectionSrc.includes("OPEN THE THINKING"), "第一層 prompt 未拆");
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
      questions: [
        { id: "eq1", text: "這段『只能住這裡』裡，有沒有把『現在最省事的安排』和『你願意長期用選擇去換的生活』混成同一件事？" },
        { id: "eq2", text: "如果男友這件事明天消失，家裡的不舒服還會不會同樣讓你覺得自己沒有出口？" },
        { id: "eq3", text: "你比較不能接受的，是這個環境本身，還是自己在這個環境裡越來越沒有位置？" },
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
      questions: [
        { id: "eq1", text: "這次沉默裡，你是在保護關係，還是在等對方先承認你的位置？" },
        { id: "eq2", text: "如果這件小事其實不重要，那真正讓胃緊起來的，是被誤解，還是被放在一邊？" },
        { id: "eq3", text: "你比較想要的，是這次趕快和好，還是以後吵架時不必用沉默來證明自己受傷？" },
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
      questions: [
        { id: "eq1", text: "這個標準裡，有多少是工作真正需要的，有多少其實是你對『自己看起來專業』的要求？" },
        { id: "eq2", text: "你比較受不了的，是品質不夠，還是這份落差讓你覺得自己又得獨自補完？" },
        { id: "eq3", text: "如果把標準再講一次，對方仍只到七成，你會把這當成訓練成本，還是人選問題？" },
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
      questions: [
        { id: "eq1", text: "如果她理解了事實，但不改變態度，你還會覺得這次溝通算成功嗎？" },
        { id: "eq2", text: "你已經知道要說，那『還沒說』是在等更好的時機，還是在等自己比較不會受傷的版本？" },
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
      questions: [
        { id: "eq1", text: "如果先承認今天就是累，你還會不會覺得自己應該再擠出一點效率？" },
        { id: "eq2", text: "這份痠比較像『做完了可以停』，還是『停下來會覺得自己沒做夠』？" },
        { id: "eq3", text: "明天若工作還是很多，你比較想保住的是產出，還是身體還能回來的那種力氣？" },
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
      questions: [
        { id: "eq1", text: "這頓飯裡，讓你最像自己的，是被接住，還是你自己也沒有用力表現？" },
        { id: "eq2", text: "這種放鬆，是因為事情剛好順利，還是因為你在他旁邊不必先證明自己？" },
        { id: "eq3", text: "如果這種狀態值得保留，你真正想留下的是氣氛，還是你們相處時那個不必緊繃的自己？" },
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
      questions: [
        { id: "eq1", text: "在熱到頭昏的時候，你還把『應該專心』當成自己可以完全控制的事嗎？" },
        { id: "eq2", text: "你比較煩的是工作被打斷，還是自己明明不舒服還繼續撐？" },
        { id: "eq3", text: "如果環境暫時改不了，你願意把今天的產出標準往下放一點，還是仍用平常的自己要求自己？" },
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
      questions: [
        { id: "eq1", text: "這份『怪怪的』，你比較想立刻解釋清楚，還是先讓它只是一種還不成形的感覺？" },
        { id: "eq2", text: "如果今天其實沒有需要被解決的問題，你還能接受這樣過完一天嗎？" },
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
      questions: [
        { id: "eq1", text: "如果兩年後回頭看，你比較怕的是選錯，還是從來沒有真正站在自己比較想過的那種生活上？" },
        { id: "eq2", text: "胸口緊的時候，你是在怕失去穩定，還是在怕自己選了想做的之後沒有退路？" },
        { id: "eq3", text: "這次決定裡，有沒有把『家人會怎麼看』和『你自己願意過的日子』疊成同一個標準？" },
      ],
    },
  },
  {
    id: "J",
    name: "第一層已經問得很完整",
    context: { ...layer },
    result: {
      questions: [
        { id: "eq1", text: "如果三年後你還住在這裡，你比較不能接受的是環境沒變，還是自己已經不再問有沒有別的路？" },
        { id: "eq2", text: "這段安排裡，有沒有一個界線是你其實已經隱約知道，只是還沒準備用它來衡量關係？" },
        { id: "eq3", text: "你現在說家人不一定會改，這句話是幫你看清現實，還是讓你比較容易繼續不選？" },
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

assert(html.includes("app.js?v=262"), "cache js");
assert(html.includes("app.css?v=226"), "cache css");
assert(html.includes("lib/review-merge.js?v=19"), "cache merge");

assert(app.includes("id=\"btnThinkExtStart\""), "A: CTA id");
assert(app.includes('node.closest("#btnThinkExtStart")'), "A: delegated handler 有 extension case");
assert(app.includes("generateThinkExtensionAsk({ confirmed: true })"), "A: click 進 ask");
assert(app.includes("正在往裡面整理…"), "B: click 後立即 loading 文案");
assert(app.includes("${loading ? \"disabled\" : \"\"}"), "B: loading 時 CTA disabled");
assert(app.includes('mode: "insight"') && app.includes('variant: "reflection-extension-v1"') && app.includes('step: "ask"'), "C: 一次 insight extension ask");
assert(reviewJs.includes("reflectionExt.isReflectionExtensionRequest"), "D: server 支援 frontend mode");
assert(app.includes("if (questions.length < 3)"), "E: 必須 3 題");
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

assert(app.includes("reportThinkExtDebug"), "Internal debug 存在");
assert(app.includes("這次沒有整理完成，再試一次。"), "失敗 toast");
assert(css.includes(".think-ext-cta") && css.includes("min-height: 44px"), "M: CTA touch friendly");
assert(!/pointer-events:\s*none/.test(css.split(".think-ext-cta")[1].slice(0, 80) || ""), "M: CTA 沒有 pointer-events none");

console.log("reflection-extension tests passed");
