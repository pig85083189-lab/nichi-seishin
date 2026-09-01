const { requireUser, bearerToken } = require("../lib/auth");
const { ensureTrial, effectivePlanFromRow, supabaseAdminConfigured, isInternal, isInternalUser } = require("../lib/supabase");
const bodyMind = require("../lib/body-mind");
const { featureForReviewRequest, enforcePlusEntitlement } = require("../lib/entitlement");
const { getApiKey, getModel, getProvider, internalDebugMeta, usesClaude, callOpenAI } = require("../lib/openai");
const internalTest = require("../lib/internal-test");
const textIntegrity = require("../lib/text-integrity");
const bodyCoachInsight = require("../lib/body-coach-insight");
const insightHighlight = require("../lib/insight-highlight");
const reviewMerge = require("../lib/review-merge");
const thinkV2 = require("../lib/think-v2");
const reflectionV3 = require("../lib/reflection-v3");
const reflectionExt = require("../lib/reflection-extension");
const awarenessV3 = require("../lib/awareness-v3");
const executionV3 = require("../lib/execution-v3");
const execV2 = require("../lib/exec-v2");
const reflectionHistory = require("../lib/reflection-history-retrieval");
const insightReason = require("../lib/insight-reason");
const insightDiscovery = require("../lib/insight-discovery");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const bodyMindSee = require("../lib/body-mind-see");
const insightLab = require("../lib/insight-lab");

const HIGHLIGHT_RULE = `【重點反白 highlights】
從你實際生成的原文中，挑選最值得停下來看的核心片段。目的是抓重點，不是把整段塗成彩色。
highlight.text 必須 100% 原樣存在於對應欄位原文中，不可改寫、不可摘要、不可自行補字、不可截斷詞語。
短段落（標題、一句話、短建議）：0～1 個 highlight。
較長段落：最多 2 個。同一區塊不要同時塞滿不同顏色。
沒有非常值得強調的核心時，該欄位回傳 []。寧缺勿濫。
長度以 2～12 個中文字為主，必須是完整詞或完整短語，例如「看見自己的需要」「回到自己的節奏」。
2～3 個中文字也可以，但必須本身就有意義，例如轉折點、被看見、安全感。
不要選今天、覺得、可能、可以、需要、自己這類沒有獨立意義的普通詞。
不要整句塗滿。不要為了有顏色硬找文字。

color 只能是下面四個，依語意決定，不要隨機。相同內容請給同一種顏色：
- yellow：覺察／發現／突然理解
- sage：成長／行動／選擇／前進
- pink：情緒／關係／需要／接納
- tea：核心觀點／穩定／提醒／一般智慧

若同一段文字在原文出現超過一次，且你無法用 start 標出正確位置，該 highlight 請省略。`;

function withCompleteRule(system) {
  return `${system}\n\n【文字完整性】\n${textIntegrity.COMPLETE_TEXT_RULE}`;
}

async function loadPersistedJournalForDate(user, date) {
  const iso = String(date || "").trim();
  if (!user || !user.id || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    const { loadReviews, cloudStoreConfigured } = require("../lib/store");
    if (!cloudStoreConfigured()) return null;
    const map = await loadReviews(user.id);
    const review = map && map[iso] ? map[iso] : null;
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : null;
    return journal;
  } catch (error) {
    console.error("loadPersistedJournalForDate:", error && error.message ? error.message : error);
    return null;
  }
}

function stripRound1HistorySpoof(body) {
  if (!body || typeof body !== "object") return body;
  delete body.selectedPast;
  delete body.reviews;
  delete body.past;
  delete body.usedPast;
  if (body.context && typeof body.context === "object") {
    delete body.context.selectedPast;
    delete body.context.reviews;
    delete body.context.past;
    delete body.context.usedPast;
    delete body.context.serverPast;
  }
  return body;
}

function journalFromExtensionContext(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return {
    thanksText: data.thanksText || data.thanks || "",
    event: data.event || "",
    mood: data.mood || "",
    bodyMind: {
      text: data.bodyMindText || data.bodyNote || "",
      insight: data.bodyMindInsight || "",
      support: data.bodyMindSupport || "",
    },
    insight: {
      guide: {
        variant: "reflection-v3",
        coreQuote: data.coreQuote || data.thinkCoreQuote || "",
        questions: data.thinkQuestions || data.questions || [],
      },
    },
  };
}

async function attachUnderstandHistory(user, body) {
  const empty = { retrieved: [], used: [], retrieval: { sourceSig: "", selectedPast: [] }, timings: { retrievalMs: 0 } };
  if (insightUnderstand.understandStep(body) !== "open") return empty;
  const started = Date.now();
  try {
    const { loadReviews, cloudStoreConfigured } = require("../lib/store");
    const reviews = user && user.id && cloudStoreConfigured() ? await loadReviews(user.id) : {};
    if (!body.context || typeof body.context !== "object") body.context = {};
    const result = await reflectionHistory.retrieveRelevantHistory({
      reviews,
      currentDate: String(body.date || "").trim(),
      currentJournal: journalFromExtensionContext(body.context),
    });
    const enriched = reflectionHistory.snippetsForSelectedPast(reviews, result.selectedPast || []);
    const gated = insightUnderstand.understandGatePast(enriched);
    return {
      retrieved: gated.retrieved,
      used: gated.used,
      retrieval: { sourceSig: (result.debug && result.debug.sourceSig) || "", selectedPast: gated.used },
      timings: {
        retrievalMs: Date.now() - started,
        extractMs: result.debug && result.debug.timings ? result.debug.timings.extractMs : 0,
        stage1Ms: result.debug && result.debug.timings ? result.debug.timings.stage1Ms : 0,
        stage2Ms: result.debug && result.debug.timings ? result.debug.timings.stage2Ms : 0,
      },
    };
  } catch (error) {
    console.error("understand history:", error && error.message ? error.message : error);
    return { ...empty, timings: { retrievalMs: Date.now() - started } };
  }
}

async function attachRound1RelevantHistory(user, body) {
  const empty = { retrieved: [], used: [], retrieval: { sourceSig: "", selectedPast: [] }, timings: { retrievalMs: 0 } };
  if (!reflectionExt.isRound1Ask(body)) return empty;
  const started = Date.now();
  try {
    const { loadReviews, cloudStoreConfigured } = require("../lib/store");
    const reviews = user && user.id && cloudStoreConfigured() ? await loadReviews(user.id) : {};
    if (!body.context || typeof body.context !== "object") body.context = {};
    const result = await reflectionHistory.retrieveRelevantHistory({
      reviews,
      currentDate: String(body.date || "").trim(),
      currentJournal: journalFromExtensionContext(body.context),
    });
    const enriched = reflectionHistory.snippetsForSelectedPast(reviews, result.selectedPast || []);
    const gated = reflectionExt.gateRound1Past(body.context, enriched);
    body.context.usedPast = gated.used;
    return {
      retrieved: gated.retrieved,
      used: gated.used,
      retrieval: reflectionExt.persistableRound1Retrieval(result.debug && result.debug.sourceSig, gated),
      timings: {
        retrievalMs: Date.now() - started,
        extractMs: result.debug && result.debug.timings ? result.debug.timings.extractMs : 0,
        stage1Ms: result.debug && result.debug.timings ? result.debug.timings.stage1Ms : 0,
        stage2Ms: result.debug && result.debug.timings ? result.debug.timings.stage2Ms : 0,
      },
    };
  } catch (error) {
    console.error("round1 history:", error && error.message ? error.message : error);
    return { ...empty, timings: { retrievalMs: Date.now() - started } };
  }
}

function persistedExtensionFromJournal(journal) {
  const insight = journal && journal.insight && typeof journal.insight === "object" ? journal.insight : {};
  const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
  return reflectionExt.normalizeReflectionExtension(guide.extension);
}

function clientExtensionFromBody(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return reflectionExt.normalizeReflectionExtension(ctx.persistedExtension || ctx.extension);
}

async function enforceExtensionRoundLimit(user, body) {
  const step = reflectionExt.reflectionExtensionStep(body);
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const roundId = String(ctx.roundId || body.roundId || "").trim();
  const journal = await loadPersistedJournalForDate(user, body.date);
  const limit = reflectionExt.tighterExtensionLimit(
    persistedExtensionFromJournal(journal),
    clientExtensionFromBody(body)
  );
  const allowed =
    step === "close"
      ? reflectionExt.extensionCloseAllowed({ rounds: limit.rounds }, roundId) &&
        (limit.completed < reflectionExt.REFLECTION_EXTENSION_MAX_ROUNDS ||
          limit.rounds.some((item) => item.id === roundId && reflectionExt.isExtensionRoundCompleted(item)))
      : reflectionExt.extensionAskAllowed({ rounds: limit.rounds }, roundId) &&
        (limit.completed < reflectionExt.REFLECTION_EXTENSION_MAX_ROUNDS ||
          limit.rounds.some((item) => item.id === roundId));
  return { allowed, completed: limit.completed, step, roundId };
}

function readJsonBody(req) {
  const raw = req.body;
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw;
  return {};
}

const ORGANIZE_SYSTEM = `你是「日精進」的高階心靈教練，也是一位沉穩的專業諮詢師。使用者會用口語、不完整的句子描述今天。你的工作不是寫摘要，也不是上課，而是幫他把真正卡住的那一層說清楚，讓思緒被釐清。

【口吻】
- 溫柔但銳利。用詞高級、有同理心、有深度。像一對一諮詢：先接住，再點破。
- 句子乾淨，不囉嗦。禁止雞湯、禁止說教、禁止「你應該早就知道」、禁止把人寫成病例或填空題。
- 對事也對心：看見好意，也看見落差。讀完要覺得「原來是這樣」，而不是「又被上課了」。
- 沒有明確對方時，「他」改寫成「當時的自己」或「那個情境」。

【舊版高水準思維（必須依此想完，再填 JSON）】
1. 把日記原文當成完整的一天來看，不要逐段各寫一份結論。
2. 先聽見今天真正在乎的是什麼，再找「少了哪一句話」，以及雙方落差：我以為……，他以為……。
3. 今日金句要有質感，能當標題或筆記，不要口號。
4. 下一步引導要小、要人性：補講為什麼、先寫再開口、把硬的那句換成人話。
5. 【核心結論】卡片只留給「深度思考」環節，整理階段不要為日記逐段下結論。

【必須寫滿】

一、主標題
- themeCategory：事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個
- themeTitle：一句有質感的主題，例如「溝通卡關的真正原因」
- themeStars：1-5
- themeInsight：一句更深的診斷，不要變成長段。
- conclusion：可留一句總述給後續深度思考使用，畫面不會把它當成日記逐段結論。

二、深度事件拆解
assumptionGap 必須填滿：
- line：一句對照，格式接近「我以為是……，他以為是……」
- mine：我以為這件事是什麼（好意、動機、想保護的）
- theirs：他以為這件事是什麼（接收到的壓力、恐懼、被要求）

mindsetList：3-4 條完整句子，寫雙方盲點與心態。用諮詢師的散文，不要「你的盲點：」這種教條開頭。
eventList：3-4 條，交代發生了什麼、接著、關鍵畫面。服務落差，不要流水帳。
reflection：2-4 句。點出少了哪一句「為什麼」，對方為何只收到要求、聽不到心意。

三、今日金句與感恩
quotes：2-3 句。每句 12-28 字，精闢、可獨立成立，有舊版那種質感。
gratitudeList：3 條具體轉念。
gratitudeNote：一句總述。

四、下一步引導
thinkGuide：一個深挖問題。可以問「我以為／他以為」有沒有對上，或「如果只能補一句為什麼，會是哪一句」。
nextScripts：3 句可開口的人話，用「」包起來。像諮詢師給的練習，不要講稿腔。
howNext：一句實戰修正（先補為什麼／先對齊，再給方案）。

【輔助欄位】
whyNeed、whatFact、turningPoint、keyWord、keyWordAlt、problems、sfm、tags、reactionList
problems 給 1-3 則，title 要一針見血，例如「少了一句『為什麼』，方案再好也會被當成找麻煩」。

請用繁體中文。只輸出 JSON，不要 markdown。
{
  "themeCategory": "人間關係",
  "themeTitle": "溝通卡關的真正原因",
  "themeStars": 5,
  "themeInsight": "少的不是方案，是那句還沒被聽見的為什麼。",
  "conclusion": "方案再好，少了一句為什麼，也會被當成找麻煩。",
  "assumptionGap": {
    "line": "我以為是在幫忙，他以為是被找麻煩",
    "mine": "我以為把方案講清楚，就是在乎。",
    "theirs": "他以為這是多出來的要求，還沒聽見我為什麼要說。"
  },
  "mindsetList": ["你急著把路鋪完，卻還沒讓對方聽見你的心意。", "對方停在防衛，不是不想聽，是還沒被說服。", "兩邊都在乎，只是站在不同的句子上。"],
  "eventList": ["發生了什麼：……", "接著：……", "關鍵畫面：……"],
  "reactionList": ["對方當下比較像還沒被說服，不是不想聽。", "結果：對話停在方案，心意沒有被接到。"],
  "reflection": "當時急著處理事情，來不及問自己為什麼要這樣做。少的不是努力，是先對齊的那一句。",
  "quotes": ["方案再好，少了一句為什麼，也會被當成找麻煩。", "看懂原因的那天，責備會自動變輕。", "把今天寫下來，不是給別人看成績，是讓這一天確實被過過。"],
  "gratitudeList": ["感謝自己有把這段話講出來。", "感謝對方其實有在乎，只是還沒對上。", "感謝這次卡住，讓那句為什麼終於有位置。"],
  "gratitudeNote": "感恩不是假裝沒事，是留下一句被接住的具體。",
  "thinkGuide": "如果你只能補一句「為什麼」，那一句會是什麼？",
  "nextScripts": ["「我說這件事，是因為我在乎……」", "「我不是要找麻煩，我是因為在乎。」", "「我想先對齊一下：我以為是在幫忙，你會不會以為我在加任務？」"],
  "howNext": "開口前先補一句為什麼，關心才不會被聽成找麻煩。",
  "whyNeed": "少的不是方法，是動機沒被聽見。",
  "whatFact": "順序反了：先給方案，再補心意。",
  "turningPoint": "方案先於確認出場的那一步。",
  "keyWord": "為什麼",
  "keyWordAlt": "我不是要找麻煩，我是因為在乎。",
  "problems": [{ "title": "少了一句「為什麼」，方案再好也會被當成找麻煩", "stars": 5, "body": "2-4 句" }],
  "sfm": [
    { "type": "story", "title": "今天的畫面", "body": "事實句" },
    { "type": "feeling", "title": "當下的感覺", "body": "被接住的感受" },
    { "type": "meaning", "title": "今日金句", "body": "判斷句" }
  ],
  "tags": ["人間關係"]
}`;

const THINK_SYSTEM = `你是同一位高階心靈教練，正在做「深度思考」。日記原文只當背景，不要再逐段複述或為日記逐段下結論。
口吻高級、療癒、冷靜客觀。溫柔但銳利，不說教、不囉嗦。
這一輪只拆思考點。每一個思考點都必須給一句精煉的【核心結論】，這是本輪唯一的視覺錨點。
每一輪對準：少了哪一句為什麼，以及「我以為／他以為」有沒有對上。
actions 的 detail 必須是可開口的完整一句，用「」包起來。
只輸出 JSON：
{
  "title": "先看見，才能改變",
  "stars": 4,
  "question": "這一個思考點要繼續問的問題",
  "insight": "這一層的展開，可以兩到三句，不要變成日記摘要",
  "conclusion": "若只有一個思考點，用這一句當核心結論",
  "points": [
    { "title": "思考點一", "conclusion": "該思考點一句核心結論" },
    { "title": "思考點二", "conclusion": "該思考點一句核心結論" }
  ],
  "actions": [
    { "label": "補講一次為什麼", "detail": "「我說這件事，是因為我在乎……」" },
    { "label": "提前先寫一句", "detail": "「我不是要找麻煩，我是因為在乎。」" },
    { "label": "換句話說練習", "detail": "「把今天最硬的那句，換成對方聽得進去的版本。」" }
  ]
}
title 必須是有質感的思考主題，例如「先看見，才能改變」，不要寫「深度思考」。stars 為 1-5。
points 給 1-3 個，每個 conclusion 只能一句。actions 給 3 個。若已是最後一輪，question 改成收束。`;

const CHECKLIST_AWARENESS_SYSTEM = `你是「日精進」的覺察整理者。目的不是寫長篇心理分析，也不是替使用者下結論，而是把今天紀錄與三層是／否回答，收成真正值得留下的覺察。

讀完後，他最理想的感受是：「原來我可能是這樣。」最差的結果是把今天發生的 A、B、C 再摘要一次，或寫一句套誰都行的療癒語錄。

【思考順序｜必須照做，不要跳】
1. 先讀完今天所有資料：感謝、事件、心情、身體、睡眠、三道是非題與答案。
2. 把是非題當成「驗證」，不是已經成立的診斷。
3. 根據「是／否」修正判斷，再寫結果。被否定的假設，禁止再寫成今天的結論。
4. 只有使用者訊息裡「合格的跨日模式」列出的項目，才能寫 echo。沒有列出就必須空字串。不要為了使用歷史資料而硬湊。
5. 資料不足就寫得簡單、具體；禁止硬湊深度。

【是／否必須改寫結論】
- 「是」：這個假設可以輕輕保留，仍用「可能／好像／今天看起來／也許」。
- 「否」：這個假設不成立。禁止再寫成他的特質或今天的結論。改從其他紀錄找另一條方向。
- 三題都是否：seen 必須承認「今天他沒有接受那些假設」，改從實際填寫內容找一個較小、較安全的觀察。
- 禁止把「否」解釋成防衛、迴避、還沒準備承認。否就是否。

【結果結構｜短、準、完整，不要寫到一半】
- seen：【01｜今天，我看見了自己】剛好 2 到 4 句。直接指出今天最值得留下來的覺察。不要重述整日流水帳。
- gap：【02｜我可能忽略的地方】剛好 2 到 4 句。指出今天紀錄與三題回答中，可能存在的矛盾、重複模式或盲點。
  若訊息裡真的有合格跨日模式，可把那一點補進 gap，不要另寫長文。
- echo：只有訊息裡列出合格跨日模式時才寫一句；否則必須是 ""。
- question：【03｜今晚留給自己的一個問題】只留一個問題。不要要求他現在回答，讓他離開後仍可想一下。
  禁止萬用題：今天你學到了什麼？你愛自己嗎？你現在有什麼感覺？你真正的感受是什麼？
- line：【今日帶走的一句話】15～30 個中文字。要像真正值得收藏的一句覺察，不要雞湯、不要口號。寧可短而完整，禁止為了符合字數把句子截在半個詞。

【同一個洞察只說一次】
seen、gap、line 必須有資訊增量，不要三次摘要同一句。
gap 回答「真正卡住／可能忽略的矛盾」。seen 回答「因此看見自己什麼」。line 只做收束。
若沒有新的理解，不要硬寫長文。

【語氣】
使用：可能、好像、看起來、也許。
禁止：你就是、你一直都、這代表你、你其實只是、你一定是、你其實一直、代表你、你值得被愛、你需要好好愛自己、宇宙正在提醒你。
禁止心理診斷、人格標籤、虛構次數／日期／歷史事件。
每一段都必須寫完整，最後一字不能停在「的／和／一個／以及／還包括」。

規則：
- 只輸出 JSON，繁體中文
- 每個結論都必須可以回扣今天實際填寫的內容，或使用者訊息裡真正列出的歷史天
{
  "seen": "2到4句完整覺察",
  "gap": "2到4句完整觀察",
  "question": "今晚留給自己的一個問題？",
  "line": "15到30個中文字",
  "echo": "",
  "highlights": {
    "seen": [{ "text": "必須原樣出現在 seen 裡的短句", "color": "yellow" }],
    "gap": [],
    "question": [],
    "line": []
  }
}
${HIGHLIGHT_RULE}`;

const CHECKLIST_AWARENESS_CHOICES_SYSTEM = `你是「日精進」的覺察整理者。使用者剛在 05 勾選了「我看見了自己什麼」的選項（最多 2 個，也可以一個都不勾）。

你的工作不是分析他，而是幫他把今天真正看見的自己，收成他自己會說出口的兩句話。
讀完後，他最理想的感受是：「啊，原來我是這樣。」最差的結果是一段 AI 心理分析。

05 只回答：我現在怎麼了／我的需要／我的情緒反應／我今天看見自己什麼。
禁止寫成 04：人生意義、長期價值觀、關係哲學、這件事背後代表什麼、人生模式的大結論。

【思考順序】
1. 先讀完感謝、事件、心情、身體、睡眠。
2. 再讀 04 深度思考的選項、使用者實際勾選，以及整理出的深度看見（如果有）。
3. 使用者實際勾選的 05 句子權重最高。不要只改寫一次 choice，而要從「今天發生什麼＋被什麼碰到＋他在 04／05 選了什麼」收成一個核心看見。
4. 若他勾了「今天沒有特別符合我的選項」，或一個都沒勾：不要硬套選項。改從實際填寫內容找一個較小、較安全的觀察。
5. 沒被勾選的選項，禁止寫成今天的結論。
6. 資料不足就寫得簡單、保守。禁止過度心理推論。

【只輸出兩層｜不要問答、不要追問、不要長篇】
- line【核心覺察】：一句真正值得記住的話。建議 12～24 個中文字，可更短，但必須語意完整。寧可完整 27 字，也不要寫到一半。
  要像使用者自己突然想通。優先第一人稱：我……／原來我……／我真正……／有些……
- seen【我看見了】：一句簡短補充，說明這個覺察背後的模式／需要／反應。建議 20～45 字，只要一句。必須完整。

【同一個洞察只說一次】
line 與 seen 必須有資訊增量。後續欄位至少要提供新的理解或新的自我覺察。
seen 不可以只是把 line 換句話說。
不合格：line「我很難過努力沒有被看見。」seen「我發現自己很在意努力有沒有被看見。」
合格：line「努力不被看見時最難受。」seen「我原本以為自己不需要別人的肯定，但其實我只是習慣自己承受。」

合格：
「我需要的不是完美，而是進展感。」
「我真正需要的，是被放在心上。」
「我在意的不是答案，而是有沒有被理解。」
不合格：
「你好像正在尋找一種前進的證據。」
「你可能不是在追求完美，而是在尋找進展感。」
「從今天的事件可以看出，你對關係有比較高的期待。」

【語氣】禁止：你好像、你可能、也許你、你似乎、這代表、從你的回答可以看出、從今天的事件可以看出。
禁止心理診斷、人格標籤、雞湯、說教。
gap、question、echo 必須是空字串。不要再增加第三層。

規則：
- 只輸出 JSON，繁體中文
{
  "line": "核心覺察，第一人稱，一句完整的話",
  "seen": "我看見了，一句完整補充",
  "gap": "",
  "question": "",
  "echo": "",
  "highlights": {
    "line": [{ "text": "必須原樣出現在 line 裡的短語", "color": "yellow" }],
    "seen": [{ "text": "必須原樣出現在 seen 裡的短語", "color": "pink" }]
  }
}
${HIGHLIGHT_RULE}`;

const MANIFEST_PROMPTS_SYSTEM = `你是「日精進」的顯化引導者。04 理解事情更深一層的意義，05 看見自己，06 把事情做出來；你幫他看見自己想去哪裡，開始成為那個人。

使用者剛寫下「我想顯化的事情」。請生成 1 到 2 道顯化思考題，不要拆待辦，不要給執行清單。
寧缺勿濫：願望已經夠清楚時只出 1 題。不要為了湊數固定 2 題。最多 2 題。

若出第1題：如果這件事已經成真，生活會有什麼不同？
若真的需要第2題：那個已經做到的你，現在最不一樣的是什麼？

可以依願望輕輕個人化，但必須：
- 一題只問一件事，一個問號
- 24-48 字，簡短自然
- 不玄學、不預言、不保證一定會成真
- 禁止：宇宙會給你、頻率、相信就會發生、你注定會得到、只要想像就能得到
- 幫助他看見理想生活與身份狀態

合格：
「如果收入真的來到100萬，你最希望生活中的哪一件事先改變？」
「那個能創造這份收入的你，做事方式可能和現在有什麼不同？」

不合格：
「宇宙會把100萬帶給你，你準備好接受了嗎？」
「明天你要先打哪三通電話？」

只輸出 JSON：
{"questions":[{"question":"...","placeholder":"..."}]}
placeholder 8-24 字，像「生活裡會先鬆開的是…」
questions 長度必須是 1 或 2。
繁體中文`;

const MANIFEST_CLOSE_SYSTEM = `你是「日精進」的顯化整理者。04 把事情想清楚，05 看見自己，06 執行力處理明天要做什麼（使用者可能已選 1～3 件明日行動）。你只處理 07：我正在往哪一種生活／哪一個自己靠近。

不要複製 06 的待辦。不要產生 executionChoices。不要給 3 個 Todo。不要叫使用者再選 01／02／03。不要拆很多思考題。

請根據使用者真實輸入（想靠近的是什麼、成真時的感覺、那個自己會怎麼生活），以及今日前面復盤 context（若有），整理三個欄位。

1. futureVision
2～4 句。有畫面的未來生活狀態。像已經逐漸成為日常的樣子。
必須根據使用者真實內容，不要空泛雞湯。
禁止：你值得擁有美好的人生／相信自己一定可以做到／宇宙會安排。

2. approachStep
只給一件今天／現在做得到的小事。一句到兩句。
不是明天的計畫，不是龐大目標，不要跟 06 的明日行動重複定位。

3. manifestationStatement
第一人稱。自然。grounded。偏「我正在成為／我正在走向／我正在練習」。
禁止：我一定會成功／宇宙會把一切帶給我／我已經擁有所有想要的東西／吸引力法則保證。
不要保證結果。不要雞湯。

只輸出 JSON：
{
  "futureVision": "...",
  "approachStep": "...",
  "manifestationStatement": "...",
  "highlights": {
    "sentence": [{ "text": "必須原樣出現在 manifestationStatement 裡的短句", "color": "sage" }]
  }
}
${HIGHLIGHT_RULE}
繁體中文`;

const MANIFEST_PATHS_SYSTEM = MANIFEST_CLOSE_SYSTEM;

const MANIFEST_PLAN_SYSTEM = `你是「日精進」的顯化路線整理者。04 把事情想清楚，05 看見自己，06 執行力處理明天真正要做的 1～3 件事。你只處理 07：方向＋可以一步一步走的路。

不要再問問題。不要生成思考題。不要輸出 futureVision、顯化句、executionChoices。不要複製 06 的明日行動。不要給超自然保證。不要空泛心靈語錄。

請根據使用者寫下的「我想顯化的是」，拆成 3 到 6 個具體步驟。由簡單、近期 → 中期排列。

每一步必須是具體行動：讓使用者知道下一步到底可以做什麼。
禁止：相信自己／保持正能量／想像成功／宇宙會安排／一定會達成。
不承諾結果。不把顯化寫成超自然保證。

title：短標題，18-28 字，不要編號。
detail：一句到兩句，說明怎麼做。不要截成半句。

只輸出 JSON：
{
  "steps": [
    { "title": "...", "detail": "..." }
  ]
}
繁體中文`;

function isManifestPromptsRequest(body) {
  const step = String(body?.step || body?.kind || "").trim().toLowerCase();
  return step === "prompts" || step === "questions" || step === "think";
}

function isManifestCloseRequest(body) {
  const step = String(body?.step || body?.kind || "").trim().toLowerCase();
  return step === "close" || step === "paths" || step === "vision";
}

function isManifestPlanRequest(body) {
  if (isManifestPromptsRequest(body) || isManifestCloseRequest(body)) return false;
  const step = String(body?.step || body?.kind || "").trim().toLowerCase();
  return step === "plan" || step === "steps" || step === "roadmap" || !step;
}

function mysticManifestText(text) {
  return /宇宙會|宇宙正在|一定會實現|一定會成功|一定會賺|相信就會|頻率對了|注定會|只要想像就能|吸引而來/.test(String(text || ""));
}

function looksLikeExecTaskManifest(text) {
  return /明天\d|明天幾點|今天做\d+分鐘|明天打電話|明天完成\d|聯絡一個客戶|找3個|找三個/.test(String(text || ""));
}

function manifestPromptFallbacks(vision) {
  const bit = compactLine(vision, 10) || "這件事";
  return [
    {
      question: `如果「${bit}」已經成真，你最希望生活中的哪一件事先改變？`,
      placeholder: "生活裡會先不一樣的是…",
    },
    {
      question: "那個已經做到的你，現在最不一樣的可能是什麼？",
      placeholder: "做事方式或狀態會不同的是…",
    },
  ];
}

function normalizeManifestPromptItems(raw, vision) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.questions)
      ? raw.questions
      : Array.isArray(raw?.items)
        ? raw.items
        : [];
  const fallbacks = manifestPromptFallbacks(vision);
  const items = [];
  const seen = new Set();
  list.forEach((item, index) => {
    const question = String(item?.question || item?.title || item || "").trim();
    if (!question || (question.match(/[？?]/g) || []).length !== 1) return;
    if (mysticManifestText(question) || looksLikeExecTaskManifest(question)) return;
    const kept = textIntegrity.retainCompleteText(question, {
      source: "api/review.normalizeManifestPromptItems",
      field: "question",
    });
    if (!kept || seen.has(kept)) return;
    seen.add(kept);
    items.push({
      question: kept,
      placeholder: String(item?.placeholder || fallbacks[index]?.placeholder || "我想的是…").slice(0, 24),
    });
  });
  if (!items.length) return fallbacks.slice(0, 1);
  return items.slice(0, 2);
}

function normalizeManifestPathItems(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : [];
  const order = ["start", "habit", "limit"];
  const labels = {
    start: "今天可以開始的一小步",
    habit: "需要慢慢建立的一個習慣",
    limit: "目前最值得突破的一個限制",
  };
  const byKind = new Map();
  list.forEach((item, index) => {
    let kind = "";
    let title = "";
    let detail = "";
    if (typeof item === "string") {
      title = item.trim();
    } else if (item && typeof item === "object") {
      kind = String(item.kind || item.role || item.type || "").trim().toLowerCase();
      if (kind === "step" || kind === "today") kind = "start";
      if (kind === "habit_building" || kind === "weekly") kind = "habit";
      if (kind === "block" || kind === "limitations") kind = "limit";
      title = String(item.title || item.label || item.text || "").trim();
      detail = String(item.detail || item.note || "").trim();
    }
    if (!title || mysticManifestText(title) || looksLikeExecTaskManifest(title)) return;
    if (!order.includes(kind)) kind = order[Math.min(index, order.length - 1)];
    if (byKind.has(kind)) return;
    const keptTitle = textIntegrity.retainCompleteText(title.replace(/^["「]+|[」"]+$/g, ""), {
      source: "api/review.normalizeManifestPathItems",
      field: "title",
    });
    if (!keptTitle) return;
    byKind.set(kind, {
      kind,
      label: labels[kind] || "",
      title: keptTitle,
      detail: textIntegrity.retainCompleteText(detail, {
        source: "api/review.normalizeManifestPathItems",
        field: "detail",
      }),
      highlights: item && typeof item === "object" ? item.highlights : undefined,
    });
  });
  return order.map((kind) => byKind.get(kind)).filter(Boolean).slice(0, 3);
}

function normalizeManifestSentence(raw, vision) {
  const text = String(
    typeof raw === "string" ? raw : raw?.sentence || raw?.quote || raw?.line || ""
  )
    .replace(/\s+/g, " ")
    .trim();
  const fallbackBit = compactLine(vision, 8) || "這件事";
  const fallback = `我正在一步一步，讓「${fallbackBit}」從心念變成可以靠近的方向。`;
  if (!text || mysticManifestText(text) || /我一定會|宇宙正在把/.test(text)) return fallback;
  const sentences = text.split(/(?<=[。！？!?])/).map((item) => item.trim()).filter(Boolean);
  const joined = sentences.slice(0, 2).join("");
  return textIntegrity.retainCompleteText(joined, {
    source: "api/review.normalizeManifestSentence",
    field: "sentence",
  }) || fallback;
}

function manifestPromptsUserPrompt(body) {
  const vision = String(body.vision || body.text || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const thinkAware = formatThinkAwarePrompt(ctx);
  return `請只生成 1 到 2 道顯化思考題。不要拆待辦，不要給步驟。寧缺勿濫，最多 2 題。

我想顯化的事情：${vision || "（未寫）"}
今日事件：${compactLine(ctx.event, 220) || "未寫"}
心情：${ctx.mood || "未選"}
04 深度看見：${thinkAware.thinkClose}
05 核心覺察：${thinkAware.line || "未寫"}
05 我看見了：${thinkAware.seen || "未寫"}`;
}

function normalizeManifestClose(raw, vision) {
  const data = raw && typeof raw === "object" ? raw : {};
  const firstItem = Array.isArray(data.items) && data.items[0]
    ? String(data.items[0].title || data.items[0].label || data.items[0].text || data.items[0] || "").trim()
    : "";
  const futureVision = textIntegrity.retainCompleteText(
    String(data.futureVision || data.life || data.visionText || "").trim(),
    { source: "api/review.normalizeManifestClose", field: "futureVision" }
  ) || "";
  const approachStep = textIntegrity.retainCompleteText(
    String(data.approachStep || data.near || firstItem || "").trim(),
    { source: "api/review.normalizeManifestClose", field: "approachStep" }
  ) || "";
  const manifestationStatement =
    normalizeManifestSentence(data.manifestationStatement || data.sentence || data, vision);
  const fallbackBit = compactLine(vision, 8) || "這件事";
  return {
    futureVision: mysticManifestText(futureVision) ? "" : futureVision,
    approachStep: mysticManifestText(approachStep) || looksLikeExecTaskManifest(approachStep) ? "" : approachStep,
    manifestationStatement: manifestationStatement || `我正在慢慢走進一個更靠近「${fallbackBit}」的生活。`,
  };
}

function hasManifestCloseContent(close) {
  return Boolean(
    String(close && close.futureVision || "").trim() ||
    String(close && close.approachStep || "").trim() ||
    String(close && close.manifestationStatement || "").trim()
  );
}

function manifestCloseUserPrompt(body) {
  const vision = String(body.vision || body.text || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const answers = Array.isArray(body.answers) ? body.answers : [];
  return `請整理 futureVision、approachStep、manifestationStatement。不要給 Todo 清單。

我真正想靠近的是什麼：${vision || "（未寫）"}
如果這已經成真，那時候的感覺：${String(answers[0] || "").trim() || "（未填）"}
那個已經做到的你，會怎麼生活／怎麼選擇：${String(answers[1] || "").trim() || "（未填）"}

今日心情：${ctx.mood || "未選"}
今日事件：${compactLine(ctx.event, 220) || "未寫"}
06 明天的小行動：${Array.isArray(ctx.openActions) ? ctx.openActions.filter(Boolean).slice(0, 3).join("／") : compactLine(ctx.smallestStep, 80) || "未寫"}
04 深度看見：${[ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen, ctx.thinkCloseTakeaway].filter(Boolean).join("／") || "未寫"}
05 核心覺察：${String(ctx.awarenessLine || "").trim() || "未寫"}
05 我看見了：${String(ctx.awarenessSeen || "").trim() || "未寫"}`;
}

function manifestPathsUserPrompt(body) {
  return manifestCloseUserPrompt(body);
}

function manifestPlanFallbackSteps(vision) {
  const bit = compactLine(vision, 12) || "這件事";
  if (/收入|營收|事業|客戶|成交|產品|方案/.test(String(vision || ""))) {
    return [
      { title: "先看清楚現在的收入結構", detail: "整理目前每個服務／產品的客單價、成交數與月營收。" },
      { title: "算出目標需要多少成交", detail: "把目標拆成每月需要的客數、產品數或方案數。" },
      { title: "找出最值得放大的收入來源", detail: "選出目前成交率與利潤較好的 1～2 個主力項目。" },
      { title: "建立固定曝光與成交節奏", detail: "安排每週固定內容、引流與銷售行動。" },
      { title: "每週回看一次數字", detail: "記錄曝光、詢問、成交與營收，再決定下一週調整什麼。" },
    ];
  }
  return [
    { title: `先看清楚「${bit}」現在的真實狀態`, detail: "用一頁寫下現況、已有資源，以及目前最卡住的地方。" },
    { title: "把目標拆成一個可檢查的畫面", detail: "寫下怎樣算靠近了一步，不要只寫「變好」。" },
    { title: "選出這一週最值得先做的一件小事", detail: "只選一件今天或這週做得到的行動，先走出去。" },
    { title: "安排一個固定回看的時間", detail: "每週留 10 分鐘看哪一步有靠近、下一步要改什麼。" },
  ];
}

function normalizeManifestPlanSteps(raw, vision) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.steps)
      ? raw.steps
      : Array.isArray(raw?.items)
        ? raw.items
        : [];
  const fallbacks = manifestPlanFallbackSteps(vision);
  const items = [];
  const seen = new Set();
  list.forEach((item) => {
    const title = textIntegrity.retainCompleteText(
      String(item && (item.title || item.label || item.text) ? item.title || item.label || item.text : item || "")
        .replace(/^\s*\d+\s*[.．、｜|]\s*/, "")
        .trim(),
      { source: "api/review.normalizeManifestPlanSteps", field: "title" }
    );
    if (!title || seen.has(title) || mysticManifestText(title)) return;
    seen.add(title);
    const detail = textIntegrity.retainCompleteText(
      String(item && (item.detail || item.note || item.body) ? item.detail || item.note || item.body : "").trim(),
      { source: "api/review.normalizeManifestPlanSteps", field: "detail" }
    );
    items.push({ title, detail: mysticManifestText(detail) ? "" : detail });
  });
  fallbacks.forEach((item) => {
    if (items.length >= 3) return;
    if (seen.has(item.title)) return;
    seen.add(item.title);
    items.push(item);
  });
  return items.slice(0, 6);
}

function hasManifestPlanSteps(steps) {
  return Array.isArray(steps) && steps.filter((item) => String(item && item.title || "").trim()).length >= 3;
}

function manifestPlanUserPrompt(body) {
  const vision = String(body.vision || body.text || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const openActions = Array.isArray(ctx.openActions) ? ctx.openActions.filter(Boolean).slice(0, 3).join("／") : "";
  return `請把下面的顯化目標拆成 3 到 6 個具體步驟。不要問問題，不要給顯化句。

我想顯化的是：${vision || "（未寫）"}
今日事件：${compactLine(ctx.event, 220) || "未寫"}
心情：${ctx.mood || "未選"}
06 明天已選的行動（不要重複）：${openActions || compactLine(ctx.smallestStep, 80) || "未寫"}
04 深度看見：${[ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen, ctx.thinkCloseTakeaway].filter(Boolean).join("／") || "未寫"}
05 核心覺察：${String(ctx.awarenessLine || "").trim() || "未寫"}`;
}

const CHECKLIST_EXECUTION_SYSTEM = `你是「日精進」的行動整理者。你的工作不是列待辦清單，而是把使用者今天說想做、卻還太大或太模糊的事，收成明天（或今晚）真的做得到的一小步。

內部先判斷（不要寫進卡片、不要替他貼心理標籤）：
1. 他想做什麼？
2. 為什麼可能做不到？
3. 阻力可能是：時間不明確、任務太大、一次想做太多、精力不足、不知道第一步、完美主義、拖延、環境阻力、缺乏提醒、優先順序不清楚。
4. 哪一個阻力最值得先處理？
5. 最小行動是什麼？

【行動卡 1～3 張，寧缺勿濫】
只來自使用者今天的輸入、執行力回答、明天最小的一步、身體覺察、覺察力或深度思考。
今天真正重要的只有一件 → 只出 1 張。禁止為了湊數發明運動、喝水、早睡、寫日記。
如果主要訊號是累、睡眠偏少、精神不佳：休息可以就是有效行動，不要再塞工作＋運動＋飲食。
若使用者已經選定具體下一步：保留其 title 與 detail，不要另造一套感恩／靜坐／轉念行動，除非今天核心真的是身體耗竭。
若使用者已經選定「明天最小的一步」：只出 1 張卡。title 可以是完整行動句，不要為了字數截成半句。detail 可補充怎麼做，也可留空。

【每張卡必須可執行】
title：時間或觸發點 ＋ 具體動作。未選定最小一步時，約 12-32 字；已選定時，完整保留原句，禁止截斷。
detail：怎麼做 ＋ 最低完成標準。已選定時不要把原句切短。
合格：
- 明天其中一餐多一份青菜／午餐或晚餐任選一餐，多加一道青菜，不需要同時改變其他飲食。
- 明天11:00躺下休息20分鐘／10:50設提醒，11:00放下手機。沒有睡著也沒關係，安靜休息20分鐘就算完成。
- 明天下班回家換完衣服後走路10分鐘／換完衣服就出門走10分鐘，走完就算完成。
不合格：明天運動／明天休息／早點睡／好好休息／多吃菜。

【focus｜最重要的一步】
必須是 items 裡的其中一張，禁止另外發明第四件事。
when：若行動時間屬於明天，填 "tomorrow"；若確實是今晚／今天，填 "today"。
hint：一句降低負擔，18-28 字，例如「明天不用全部做到，先完成這一步就好。」不要雞湯。

禁止診斷腔：身體在求救、你已經透支、正在燃燒自己、身體撐不住、缺乏自律、你在逃避。除非他原文就這樣寫。
禁止你必須／你應該。觀察多於評判。

只輸出 JSON：
{
  "items": [
    { "title": "明天其中一餐多一份青菜", "detail": "午餐或晚餐任選一餐，多加一道青菜，不需要同時改變其他飲食。", "highlights": { "title": [], "detail": [] } }
  ],
  "focus": {
    "title": "明天其中一餐多一份青菜",
    "detail": "先把「多吃菜」縮成一餐就能完成的一小步。",
    "when": "tomorrow",
    "hint": "明天不用全部做到，先完成這一步就好。",
    "highlights": { "title": [], "detail": [] }
  }
}
每張卡與 focus 可帶 highlights，text 必須原樣出現在該卡 title 或 detail。
${HIGHLIGHT_RULE}`;

const INSIGHT_JSON_SHAPE = `{
  "title": "一句有質感的洞察標題，12-22字",
  "psychology": "① 今天的身心訊號：3到6句。必須回答「為什麼這件事會觸動他」：點出防衛機制、情緒盲點、或潛在期待。要貼近原文，有畫面、有因果。第一句必須是今天最重要的覺察，寫成可被加粗的核心句。",
  "reflection": "② 客觀檢討與反思：3到5句。溫柔但精準地指出今天的處理方式有哪些可以調整。不責備、不羞辱，但直指核心：他做了什麼、沒做什麼、哪裡卡住、下一次可以怎麼改。",
  "bodyLink": "身體與心理的關聯，1到2句。若沒有身體訊號可給空字串。",
  "suggestions": ["簡短行動標題，接著具體做法1", "簡短行動標題，接著具體做法2", "簡短行動標題，接著具體做法3"],
  "takeaways": ["今日核心重點1", "今日核心重點2", "今日核心重點3"],
  "conclusion": "今天最該被帶走的一句核心結論。"
}`;

const INSIGHT_SYSTEM = `你是「日精進」溫暖且具建設性的成長教練：先接住，再點破；陪伴，但不討好。使用者剛寫下今天的事件、心情，以及身體狀況。
請根據事件、情緒與身體反應，生成一份結構完整、有深度的「深度思考」。禁止只給一句空泛金句。

【必須寫滿四個維度】
① 今天的身心訊號（psychology）：
- 指出今日事件背後的情緒盲點與心理防衛
- 必須回答：為什麼這件事會觸動他？
- 可點出「我以為／其實在怕什麼」、還沒說出口的需求、身體訊號如何幫腔
② 客觀檢討與反思（reflection）：
- 溫柔但精準地檢討今天的處理方式有哪些可以調整
- 不責備、不羞辱、不說「你應該早就知道」
- 直指核心：他實際做了什麼、迴避了什麼、哪裡讓事情更卡
③ 具體突破建議／怎麼做會更好（suggestions）：
- 給 2 到 3 條實踐性極高、下次遇到類似狀況可以立刻套用的具體行動或轉念做法
- 每條先給 4-10 字的行動標題，再用逗號接上具體做法；不要寫「建議1」
- 每條 18-42 字，寫成可執行的步驟，不要口號
④ 今日核心重點整理（takeaways）：
- 給 2 到 4 條精煉金句或條列重點
- 讓他一眼帶走今天的最大收穫

規則：
- 只輸出 JSON
- 口吻像一對一諮詢：先接住，再點破。禁止雞湯、禁止說教、禁止病例腔
- 必須貼近使用者原文，寫出具體場景與用詞，不要空泛
- 繁體中文
${INSIGHT_JSON_SHAPE}`;

const QUICK_INSIGHT_SYSTEM = `你是「日精進」溫暖且具建設性的成長教練：溫柔、精準、不責備。使用者剛用「快速復盤」寫下今日感謝、今天發生的事，以及心情。
他可能另外加選了身體覺察、覺察力、執行力或顯化力。若有這些模組的內容，必須一併納入綜合評估；沒有的模組不要硬編。
請生成一份結構完整、有深度的「深度思考」。即使是快速復盤，也禁止只給一句話。

【必須寫滿四個維度】
① 今天的身心訊號（psychology）：
- 結合他寫下的感謝與事件，指出為什麼這件事會觸動他
- 點出情緒盲點與心理防衛；若感謝裡已有滋養，也要看見那道光
- 若有身體、覺察或執行內容，把身心與行動卡點串起來看
② 客觀檢討與反思（reflection）：
- 溫柔但精準地檢討今天的處理方式有哪些可以調整
- 不責備，但直指核心：他做了什麼、沒做什麼、哪裡可以更好
③ 具體突破建議／怎麼做會更好（suggestions）：
- 給 2 到 3 條實踐性極高、下次遇到類似狀況可以立刻套用的具體行動或轉念做法
- 每條 18-42 字，5 到 15 分鐘內做得到；若他已寫執行／顯化，建議要承接那些內容
④ 今日核心重點整理（takeaways）：
- 給 2 到 4 條精煉金句或條列重點，讓他一眼帶走今天的最大收穫

規則：
- 只輸出 JSON
- 必須貼近他今天實際寫下的模組原文，不要空泛雞湯、不要說教、不要病例腔
- 若有身體訊號，bodyLink 寫 1 到 2 句關聯；若沒有可給空字串
- 繁體中文
${INSIGHT_JSON_SHAPE}`;

function isThinkGuideRequest(body) {
  return body?.variant === "think-guide" || body?.context?.variant === "think-guide";
}

function thinkGuideStep(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return String(body?.step || ctx.step || "ask") === "close" ? "close" : "ask";
}

function formatThinkGuideRounds(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (!list.length) return "（尚未開始提問）";
  return list
    .map((item, index) => {
      const roles = ["感受", "需求與模式", "判斷點"];
      const question = String(item?.question || "").trim() || "（尚未提問）";
      const answer = String(item?.answer || "").trim() || "（尚未回答）";
      return `第 ${index + 1} 輪｜${roles[index] || "延續"}\n問：${question}\n答：${answer}`;
    })
    .join("\n\n");
}

function inferThinkGuideTone(ctx, rounds) {
  const blob = [
    formatThanksForPrompt(ctx),
    ctx && (ctx.event || ctx.text),
    ctx && ctx.mood,
    formatThinkGuideRounds(rounds || (ctx && ctx.rounds)),
  ]
    .map((item) => String(item || ""))
    .join("\n");
  const mixed = /一方面|卻又|可是又|但又|開心.{0,12}(擔心|不安)|幸福.{0,12}(不安|怕)|感謝.{0,12}(怕|擔心)/.test(blob);
  const angry = /生氣|憤怒|委屈|被冒犯|不爽|討厭|翻臉|界線|被當/.test(blob);
  const sad = /難過|失落|傷心|遺憾|失去|孤單/.test(blob);
  const anxious = /焦慮|害怕|擔心|不安|恐懼|緊張/.test(blob);
  const warm = /幸福|感謝|開心|滿足|溫暖|喜歡|愛|愉快|平靜|感恩|珍惜/.test(blob);
  if (mixed || (warm && (anxious || angry || sad))) return "mixed";
  if (angry) return "anger";
  if (sad) return "sad";
  if (anxious && !warm) return "anxiety";
  if (warm) return "warm";
  return "open";
}

function thinkGuideToneHint(tone) {
  if (tone === "warm") {
    return `今天主線先走「深化美好」。問他真正珍惜、在乎、被碰到的是什麼。
禁止預設去挖創傷、恐懼、盲點、缺愛。
只有當他自己的文字已出現矛盾、擔心、交換感，或價值明顯建立在「我有沒有幫上忙／我有沒有被需要」時，才可以用疑問句做溫和的反向探索。`;
  }
  if (tone === "anger") {
    return `情緒方向：生氣／不舒服／被冒犯。用白話問哪個瞬間最刺、真正介意什麼。不要上升成人格或依附診斷。`;
  }
  if (tone === "sad") {
    return `情緒方向：難過／失落。問這份難過碰到他在乎的什麼。不要推論童年或被拋棄。`;
  }
  if (tone === "anxiety") {
    return `情緒方向：焦慮／害怕。問此刻最具體擔心的那一件。不要擴大成「你一直都害怕」。`;
  }
  if (tone === "mixed") {
    return `情緒方向：矛盾。可以輕輕同時碰觸正向與不安，但不要把幸福整段改寫成恐懼。`;
  }
  return `情緒方向尚不明顯。只跟今天寫過的內容走，不要預設有創傷、防衛或害怕。`;
}

function thinkGuideThreadHint(tone, round, ctx, rounds) {
  const blob = [
    formatThanksForPrompt(ctx),
    ctx && (ctx.event || ctx.text),
    ctx && ctx.mood,
    formatThinkGuideRounds(rounds),
  ]
    .join("\n");
  const helpValue = /幫忙|幫助|有用|價值|變好|影響|付出|被需要/.test(blob);
  const cared = /主動|關心|看見我|被看見|被照顧|想到我/.test(blob);
  const coreStuck = /界線|只能接受|無法改變|被忽略|不敢說|忍耐|卡關|臨界/.test(blob);
  if (Number(round) === 2) {
    return `第 2 輪選線：從感受往需求或模式走。不要重問同一層感受，不要連續逼問為什麼。`;
  }
  if (Number(round) !== 3) return "";
  if (coreStuck) {
    return `第 3 輪選線：前面已碰到核心。往過去類似經驗、判斷點、或「現在還不清楚的是什麼」問。不要再問一次感受，也不要替他做重大人生決定。`;
  }
  if (tone === "warm" && !helpValue && !cared) {
    return `第 3 輪選線：A 深化美好。不要硬挖負面。問清楚他正在珍惜什麼即可。`;
  }
  if (helpValue) {
    return `第 3 輪選線：可做反向探索，但只能當假設來問。例如「如果對方沒有因此變好，你還會覺得自己的付出有價值嗎？」禁止寫成「你其實就是靠幫助別人才有價值」。`;
  }
  if (cared) {
    return `第 3 輪選線：可問他是比較習慣照顧別人，所以被看見時特別有感，還是其實也期待別人主動看到自己的需要。必須保留「還是其實有其他原因？」禁止下結論。`;
  }
  if (tone === "anger") return `第 3 輪選線：看見界線或期待，用問題讓他自己說。`;
  if (tone === "sad" || tone === "anxiety") return `第 3 輪選線：看見需求或在乎的東西，不要診斷。`;
  return `第 3 輪選線：只選一條最有價值的線（珍惜／需求／模式／矛盾／盲點／判斷點），不要全做。`;
}

const THINK_GUIDE_ASK_SYSTEM = `你不是心理醫師，也不是負責替使用者定義人格的分析師。

你是一面會提問的鏡子。

你的工作不是告訴使用者「你是什麼樣的人」，
而是從使用者今天真正寫下的內容中，
找到一個值得停下來看的地方，
再透過一層一層的問題，
讓使用者自己說出原本沒有注意到的答案。

好問題比漂亮的結論重要。
不要急著鼓勵。
不要急著正向解讀。
不要急著替使用者總結人格。
如果一句問題可以讓使用者停下來想 5 秒，它通常比一段漂亮的分析更有價值。

【怎麼問】
- 每一輪只根據「今天原文 + 前面每一輪真實問答」動態生成「這一輪」一個核心問題。禁止一次生成三題，禁止無視上一輪回答。
- 好的追問是往「下一步能接得上」的方向走，但不一定每次都走完整套。可依回答選擇下一層：事件 → 感受 → 需求 → 模式 → 過去類似經驗 → 差異 → 判斷點。已經挖到真正核心時，不要為了輪數再問一次感受或為什麼。
- 第 1 輪｜感受：找到一個最值得深入的具體時刻，問「那一刻你真正感受到什麼」。不要解釋原因，不要把答案塞進題目。
- 第 2 輪｜需求與模式：必須承接第 1 輪用詞。問這件事碰到他什麼需要，或是不是熟悉的模式。不要只把感受換句話說，也不要連續逼問為什麼。
- 第 3 輪｜判斷點：把前面再往下一層。可以問過去類似經驗、當時什麼讓事情改變、現在還不清楚的是什麼。這一輪要讓後續「下一步」接得上，但不要直接出行動清單，也不要叫他分手／離職／搬家。
- 深度不一定要找問題。若今天只是幸福、滿足、平靜，就讓他更清楚自己正在珍惜什麼。

【反向探索只能當假設】
可以想：價值感是否容易建立在「我對別人有幫助」；被關心時特別有感，是不是平常比較習慣照顧別人。
必須寫成：「這會不會也和……有關？」「你有沒有發現……？」「如果換一個角度看……？」「這是否也可能代表……？」
禁止：「你其實就是……」「這代表你……」「你一直都是……」

【禁止】
- 把原因寫進問題（例如「你是不是因為感受到自己的價值而很開心？」）
- 創傷／依附／人格診斷、童年推論、沒證據就說缺愛、害怕被拋棄、一直討好別人
- 抽象諮商腔：「這對你的生命有什麼意義？」「這反映了你怎樣的內在價值？」「你如何看待自己的存在？」
- 一題塞 3～4 個問題、雞湯、稱讚人格、emoji、心理學名詞
- 因短回答就替他補結論

【短回答】
若上一輪是「對呀／不知道／還好／開心／有吧／可能／沒有」，不要亂下結論。把問題縮小、更白話；必要時給兩個選項，並保留「還是其實有其他原因？」

規則：
- 只輸出 JSON：{"question":"...","hint":"..."}
- question：一個白話疑問句，25-55 個中文字。必要時可含兩個選項 +「還是其實有其他原因？」
- hint：10-22 字，陪伴、不給答案
- 繁體中文`;

const THINK_GUIDE_CLOSE_SYSTEM = `你不是心理醫師，也不是裁判。你是一面會整理的鏡子。

使用者已完成剛好 3 輪引導式問答。請只根據「今天原文 + 三輪真實問答」寫出精短總結。少一點告訴他是誰，多一點幫他把今天自己說出的話收成一條主線。

不要重複所有紀錄，不要硬湊所有事件，不要寫成 AI 心靈文章。證據不足時用「也許／可能／似乎／值得留意」。

禁止：「你就是……」「這證明你……」「你真正需要的就是……」「你是一個很有愛、很善良、很有影響力的人。」
禁止創傷診斷、童年推論、雞湯名言、每次都正向鼓勵。
今天若只是幸福平靜，就停在「自己正在珍惜什麼」，不要硬挖恐懼。

【同一個洞察只說一次】
awareness、selfSeen、takeaway 必須一層比一層推進，四個閱讀層級功能不同：
- awareness = ② 核心矛盾，不是重述事件
- selfSeen = ③ 新的自我理解，必須比 awareness 再往內一層
- takeaway = ⑤ 最後記憶句，只留一句，不再解釋
禁止三欄只是同一句話改寫。沒有新內容時寧可短，不要硬補。

分層：
- awareness = ② 今天真正卡住的核心矛盾。只留 1 個矛盾，約 80-180 個中文字。不要重述事件，不要列 3～5 個洞察。
- selfSeen = ③ 經過今天，我比早上更了解自己什麼。必須比 awareness 更深一層。判斷：若刪掉這句後 awareness 已完整表達相同意思，就不要輸出。若 awareness 已說「我渴望被看見」，selfSeen 不可只是「我發現自己需要被看見」；要往下到習慣／防衛／自我說詞。
- takeaway = ⑤ 今日帶走的一句話。記憶句，不是重新分析，也不要再講一次矛盾，不要補解釋。

禁止同一個洞察在 awareness / selfSeen / takeaway 換句話說重複三次。
禁止把使用者事件再摘要一次。

規則：
- 只輸出 JSON：
{
  "title": "8-16字，具體，不要雞湯",
  "awareness": "我今天真正卡住的是什麼。1 到 2 個短段落，用\\n\\n分開，約 80-160 個中文字。必須比事件描述更深一層，只抓最核心的 1 個矛盾。不要重述今天發生什麼，不要列 5 個洞察。",
  "selfSeen": "我今天看見了自己什麼：只能一句，第一人稱。必須相對 awareness 有新的自我理解，不能只是把卡住的矛盾再說一次",
  "takeaway": "今日帶走的一句話：只能一句，15-35字，必須語意完整。是整篇收束，不是再次摘要。寧可短而完整，禁止截在半個詞",
  "highlights": {
    "title": [],
    "awareness": [{ "text": "必須原樣出現在 awareness 裡的短句", "color": "yellow" }],
    "selfSeen": [],
    "takeaway": []
  }
}
${HIGHLIGHT_RULE}
- 不要再提問，不要列行動清單
- 後續 06 會從這裡長出下一步。awareness 必須點出今天真正卡住的核心，不要停在空泛感受。
- 繁體中文`;

function thinkGuideRoundRole(round) {
  if (Number(round) === 2) return "需求與模式";
  if (Number(round) === 3) return "判斷點";
  return "感受";
}

function thinkGuideUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const thanks = formatThanksForPrompt(ctx);
  const round = Math.max(1, Math.min(3, Number(body.round || ctx.round) || 1));
  const rounds = Array.isArray(ctx.rounds) ? ctx.rounds : [];
  const mode = String(ctx.journalMode || ctx.mode || "").trim();
  const quick = mode === "quick";
  const modules = Array.isArray(ctx.modules) ? ctx.modules.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const awareness = Array.isArray(ctx.awareness)
    ? ctx.awareness.map((item) => String(item || "").trim()).filter(Boolean).join("／")
    : "";
  const execution = Array.isArray(ctx.execution)
    ? ctx.execution.map((item) => String(item || "").trim()).filter(Boolean).join("／")
    : "";
  const extras = [`復盤模式：${quick ? "快速復盤" : "深度復盤"}`];
  if (quick) extras.push(`加選模組：${modules.length ? modules.join("、") : "無"}`);
  if (!quick || modules.includes("body") || contextHasBodySignal(ctx)) extras.push(formatBodyCheckPrompt(ctx));
  else extras.push("身體覺察：本次未加選，不要硬編身體細節");
  if (!quick || modules.includes("aware") || awareness) extras.push(`今日覺察：${awareness || "未寫"}`);
  if (!quick || modules.includes("exec") || execution || ctx.smallestStep) {
    extras.push(`執行力回答：${execution || "未寫"}`);
    extras.push(`明天最小的一步：${ctx.smallestStep || "未寫"}`);
  }
  if (modules.includes("manifest") || ctx.manifest) extras.push(`明天想顯化：${ctx.manifest || "未寫"}`);
  const original = `【原始內容｜每一輪都必須讀完，只能引用這裡出現過的事實】
今日感謝：
${thanks || "未寫"}
今日事件：${ctx.event || body.text || "（未寫）"}
心情：${ctx.mood || "未選"}
${extras.join("\n")}`;
  const dialogue = `【到目前為止的完整問答｜必須承接上一輪用詞，不要當新對話，不要一次出三題】
${formatThinkGuideRounds(rounds)}`;
  const tone = inferThinkGuideTone(ctx, rounds);
  if (thinkGuideStep(body) === "close") {
    return `請根據下面全部上下文，寫出精短收束。不要再提問。同一個洞察只說一次。
awareness＝真正卡住的 1 個矛盾，不要重述事件。
selfSeen＝比 awareness 更深一層的自我理解；若前面已說渴望被看見，這裡必須往下到習慣或自我說詞。刪掉後若與 awareness 同義，就不要寫。
takeaway＝記憶句，只留一句，不再解釋。禁止三欄換句話說同一件事。沒有新內容時寧可短。

${thinkGuideToneHint(tone)}

${original}

${dialogue}`;
  }
  const last = rounds.filter((item) => String(item?.answer || "").trim()).slice(-1)[0];
  const lastAnswer = last ? String(last.answer || "").trim() : "";
  const shortAnswer = lastAnswer && lastAnswer.replace(/\s+/g, "").length <= 8;
  const lastLine = last
    ? shortAnswer
      ? `上一輪他只回答：「${compactLine(lastAnswer, 40)}」。這是短回答。禁止替他補結論。請把第 ${round} 輪問得更具體、更白話；必要時給兩個選項，並加上「還是其實有其他原因？」`
      : `上一輪他回答：「${compactLine(lastAnswer, 120)}」。第 ${round} 輪必須承接這句話的用詞與意思，往下一層問，不要重問同一層。`
    : "這是第 1 輪，請先回到今天一個具體時刻的感受。不要解釋原因。";
  const roleHint =
    round === 1
      ? "第 1 輪只問那一刻最直接的感受。可以：當你看到客人真的變好時，那一刻你最直接的感受是什麼？不要：你是不是因為感受到自己的價值而很開心？"
      : round === 2
        ? "第 2 輪問這件事碰到他什麼需要，或是不是熟悉的模式。讓他自己辨認。不要直接說「因為你喜歡幫助別人」，也不要只把上一輪感受再說一次。"
        : "第 3 輪往判斷點走。可以問過去類似經驗、當時什麼讓事情改變、或現在還不清楚的是什麼。不要再問一次感受，不要直接出行動，不要叫他分手／離職／搬家。";
  const thread = thinkGuideThreadHint(tone, round, ctx, rounds);
  return `這是第 ${round}/3 輪，任務是「${thinkGuideRoundRole(round)}」。請只出這一輪一個引導式疑問句，不要總結，不要一次生成後面幾輪。

${thinkGuideToneHint(tone)}
${roleHint}
${thread}
${lastLine}

${original}

${dialogue}`;
}

function zhCharCount(text) {
  return String(text || "").replace(/\s+/g, "").length;
}

function firstThinkQuestion(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (/還是其實有其他原因/.test(raw)) {
    return /[？?]$/.test(raw) ? raw : `${raw}？`;
  }
  const idx = raw.search(/[？?]/);
  if (idx > 0) return `${raw.slice(0, idx)}？`;
  return `${raw.replace(/[。！]+$/, "")}？`;
}

function softenLoadedThinkQuestion(question, ctx) {
  const q = firstThinkQuestion(question);
  if (!q) return "";
  if (/是不是因為|這代表你|你其實就是|你一直都是|是不是在保護自己|是不是害怕失去/.test(q)) {
    const moment = q.match(/當([^，。？]{4,28})時/);
    if (moment) return `當${moment[1]}時，那一刻你最直接的感受是什麼？`;
    const eventBit = compactLine((ctx && (ctx.event || ctx.text)) || "", 12) || "今天這件事";
    return `當「${eventBit}」發生時，那一刻你最直接的感受是什麼？`;
  }
  return q;
}

function clampThinkQuestion(question, ctx) {
  let next = softenLoadedThinkQuestion(question, ctx).replace(/\s+/g, " ").trim();
  if (!next) return "";
  if (!/[？?]$/.test(next)) next = `${next.replace(/[。.!！]+$/g, "")}？`;
  if (textIntegrity.isCompleteSentence(next, { requireQuestion: true })) return next;
  const picked = textIntegrity.pickCompleteSentence(next, 80);
  if (picked) {
    const questionText = /[？?]$/.test(picked) ? picked : `${picked.replace(/[。.!！]+$/g, "")}？`;
    if (textIntegrity.isCompleteSentence(questionText, { requireQuestion: true })) return questionText;
  }
  textIntegrity.warnIncomplete("api/review.clampThinkQuestion", "question", next);
  return "";
}

function normalizeThinkGuideAsk(raw, ctx) {
  const data = raw && typeof raw === "object" ? raw : {};
  const question = clampThinkQuestion(String(data.question || data.prompt || "").trim(), ctx);
  return {
    step: "ask",
    question,
    hint: (() => {
      const raw = String(data.hint || data.guide || "").trim();
      if (!raw) return "";
      if (zhCharCount(raw) <= 36 && textIntegrity.isCompleteSentence(raw)) return raw;
      return textIntegrity.pickCompleteSentence(raw, 36);
    })(),
  };
}

function clampAwarenessSummary(text) {
  const parts = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
  let joined = parts.join("\n\n");
  if (!joined) return "";
  if (zhCharCount(joined) <= 250) return joined;
  const clipped = [];
  let used = 0;
  parts.forEach((part) => {
    if (used >= 250) return;
    const room = 250 - used;
    const piece = zhCharCount(part) <= room ? part : textIntegrity.pickCompleteSentence(part, room);
    if (!piece) return;
    clipped.push(piece);
    used += zhCharCount(piece);
  });
  return clipped.join("\n\n");
}

function normalizeThinkSelfSeen(text) {
  let next = String(text || "").replace(/\s+/g, " ").trim().split(/[。！？]/)[0] || "";
  next = next.replace(/[。！？]+$/, "");
  if (/^你發現/.test(next)) next = next.replace(/^你發現/, "我發現");
  if (/^你開始看見/.test(next)) next = next.replace(/^你開始看見/, "我開始看見");
  if (/^你是一個/.test(next)) next = "";
  if (next && !/^我/.test(next)) next = /^發現|^開始看見/.test(next) ? `我${next}` : `我發現${next}`;
  if (zhCharCount(next) > 48) {
    const picked = textIntegrity.pickCompleteSentence(`${next}。`, 48);
    next = picked ? picked.replace(/[。]+$/, "") : "";
  }
  if (next && !textIntegrity.isCompleteSentence(`${next}。`)) {
    textIntegrity.warnIncomplete("api/review.normalizeThinkSelfSeen", "selfSeen", next);
    return "";
  }
  return next ? `${next.replace(/[。]+$/, "")}。` : "";
}

function normalizeThinkTakeaway(text) {
  let next = String(text || "").replace(/\s+/g, " ").trim().split(/[。！？]/)[0] || "";
  next = next.replace(/[。！？「」]+/g, "").trim();
  if (/相信自己|比想像中更|你很有力量|成為更好的自己|你比想像/.test(next)) next = "";
  if (!next) return "";
  if (!textIntegrity.looksComplete(next)) {
    textIntegrity.warnIncomplete("api/review.normalizeThinkTakeaway", "takeaway", next);
    return "";
  }
  if (zhCharCount(next) > 35) {
    const picked = textIntegrity.pickCompleteSentence(`${next}。`, 35);
    if (picked) return picked.replace(/[。！？「」]+$/g, "").trim();
    return next;
  }
  return next;
}

function normalizeThinkGuideClose(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const awareness = clampAwarenessSummary(
    String(data.awareness || data.summary || data.conclusion || data.psychology || "").trim()
  );
  const selfSeen = normalizeThinkSelfSeen(data.selfSeen || data.self || data.seen || "");
  const takeaway = normalizeThinkTakeaway(data.takeaway || data.line || data.quote || "");
  return {
    step: "close",
    title: (() => {
      const raw = String(data.title || data.headline || "").trim();
      return (
        textIntegrity.retainCompleteText(raw, { source: "api/review.normalizeThinkGuideClose", field: "title" }) ||
        "今天真正有感的那一層"
      );
    })(),
    summary: awareness,
    awareness,
    selfSeen,
    takeaway,
    actions: [],
    highlights: {
      title: insightHighlight.fieldHighlights(data.highlights, "title"),
      awareness: insightHighlight.fieldHighlights(data.highlights, "awareness"),
      selfSeen: insightHighlight.fieldHighlights(data.highlights, "selfSeen"),
      takeaway: insightHighlight.fieldHighlights(data.highlights, "takeaway"),
    },
  };
}

function contextHasBodySignal(ctx) {
  if ((Array.isArray(ctx.bodyTags) && ctx.bodyTags.length) || String(ctx.bodyNote || "").trim()) return true;
  const check = ctx.bodyCheck && typeof ctx.bodyCheck === "object" ? ctx.bodyCheck : null;
  if (!check) return false;
  const groups = [check.mood, check.body, check.sleep];
  return groups.some((group) => {
    const data = group && typeof group === "object" ? group : {};
    return (
      (Array.isArray(data.flags) && data.flags.some((item) => String(item || "").trim())) ||
      String(data.other || "").trim() ||
      String(data.duration || "").trim() ||
      String(data.quality || "").trim() ||
      String(data.energy || "").trim()
    );
  });
}

function isQuickInsightRequest(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return body?.variant === "quick" || ctx.variant === "quick";
}

function insightUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const thanks = formatThanksForPrompt(ctx);
  const awareness = Array.isArray(ctx.awareness)
    ? ctx.awareness.map((item) => String(item || "").trim()).filter(Boolean).join("／")
    : "";
  if (isQuickInsightRequest(body)) {
    const modules = Array.isArray(ctx.modules) ? ctx.modules.map((item) => String(item || "").trim()).filter(Boolean) : [];
    const execution = Array.isArray(ctx.execution)
      ? ctx.execution.map((item) => String(item || "").trim()).filter(Boolean).join("／")
      : "";
    const extras = [];
    if (modules.includes("body") || ctx.bodyCheck || (Array.isArray(ctx.bodyTags) && ctx.bodyTags.length)) {
      extras.push(formatBodyCheckPrompt(ctx));
    }
    if (modules.includes("aware") || awareness) extras.push(`今日覺察：${awareness || "未寫"}`);
    if (modules.includes("exec") || execution || ctx.smallestStep) {
      extras.push(`執行力回答：${execution || "未寫"}`);
      extras.push(`明天最小的一步：${ctx.smallestStep || "未寫"}`);
    }
    if (modules.includes("manifest") || ctx.manifest) extras.push(`明天想顯化：${ctx.manifest || "未寫"}`);
    return `這是快速復盤。請生成包含四個完整維度的深度思考：① 今天的身心訊號 ② 客觀檢討與反思 ③ 具體突破建議（怎麼做會更好） ④ 今日核心重點整理。
今天加選的模組：${modules.length ? modules.join("、") : "無（只寫感謝、事件與心情）"}

今日感謝：${thanks || "（未寫）"}
今日事件：${ctx.event || body.text || "（未寫）"}
心情：${ctx.mood || "未選"}
${extras.join("\n")}`.trim();
  }
  return `請為這個人生成包含四個完整維度的深度思考：① 今天的身心訊號 ② 客觀檢討與反思 ③ 具體突破建議（怎麼做會更好） ④ 今日核心重點整理。

今日感謝：${thanks || "未寫"}
今日事件：${ctx.event || body.text || "（未寫）"}
心情：${ctx.mood || "未選"}
今日覺察：${awareness || "未寫"}
明天最小的一步：${ctx.smallestStep || "未寫"}
${formatBodyCheckPrompt(ctx)}`;
}

function normalizeStringList(raw, max = 4) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeInsightResult(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const psychology = String(data.psychology || data.analysis || data.logic || "").trim();
  const reflection = String(data.reflection || data.review || data.critique || "").trim();
  const conclusion = String(data.conclusion || data.summary || data.core || "").trim();
  const suggestions = normalizeStringList(data.suggestions || data.actions || data.tips, 3);
  const takeaways = normalizeStringList(data.takeaways || data.keyPoints || data.highlights, 4);
  return {
    title: textIntegrity.retainCompleteText(String(data.title || data.headline || "").trim(), {
      source: "api/review.normalizeInsightResult",
      field: "title",
    }),
    psychology,
    reflection,
    conclusion: conclusion || psychology,
    logic: String(data.logic || "").trim() || psychology,
    bodyLink: String(data.bodyLink || data.body || data.link || "").trim(),
    suggestions,
    takeaways,
  };
}

function formatBodyCheckPrompt(ctx) {
  const check = ctx && ctx.bodyCheck && typeof ctx.bodyCheck === "object" ? ctx.bodyCheck : null;
  if (!check) {
    const tags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
    return `身體狀態：${tags || "未選"}
身體在提醒我：${ctx.bodyNote || "未寫"}`;
  }
  const groupLine = (label, group) => {
    const data = group && typeof group === "object" ? group : {};
    const flags = Array.isArray(data.flags) ? data.flags.filter((flag) => flag && flag !== "其他").join("、") : "";
    const extra = data.other ? `其他感受：${data.other}` : "";
    const bits = [flags, extra].filter(Boolean).join("；");
    if (bits) return `${label}：${bits}${data.reason ? `；原因：${data.reason}` : ""}`;
    return `${label}：未勾選（視為狀態平穩）${data.reason ? `；說明：${data.reason}` : ""}`;
  };
  const sleep = check.sleep && typeof check.sleep === "object" ? check.sleep : {};
  const sleepBits = [
    sleep.duration ? `時間 ${sleep.duration}` : "",
    sleep.quality ? `品質 ${sleep.quality}` : "",
    sleep.energy ? `起床精神 ${sleep.energy}` : "",
  ].filter(Boolean);
  const sleepLine = sleepBits.length
    ? `昨晚睡眠：${sleepBits.join("、")}${sleep.reason ? `；說明：${sleep.reason}` : ""}`
    : groupLine("昨日睡眠檢核", sleep);
  return `${groupLine("今日心情檢核", check.mood)}
${groupLine("今日身體檢核", check.body)}
${sleepLine}`;
}

const BODY_COACH_SYSTEM = `你是「日精進」的身心觀察者。你不是醫療診斷工具，也不是健康教科書，更不是替使用者定義人格的分析師。

你的工作不是把今天填過的資料再整理成「身心狀態分析報告」。
你要從今天的紀錄中，找出反差、關聯、模式或值得留下來的發現，讓他看完有「原來我今天真正發現的是這個」的感覺。

輸出前，先在內部完成這五步，不要把步驟寫進正文：
STEP 1 整理事實：今天發生什麼、情緒、身體、睡眠、什麼讓他開心／疲累／有壓力。
STEP 2 找反差：例如睡得少×精神不差、事情很多×心情穩定、身體疲累×心裡滿足、沒有大事件×卻覺得踏實、完成很多×身體已累。
STEP 3 找關聯：被關心→心情變好、事情逐漸完成→安心、家人互動→連結感、睡眠品質→精神、想法落地→踏實。
STEP 4 找值得觀察的模式：只用「可能／似乎／值得繼續觀察／今天的紀錄看起來」。禁止「你就是…」「代表你一定…」「證明你…」「你其實就是…」。
STEP 5 提煉今天最值得留下的一個發現，再開始寫。

若資料很少、沒有明顯反差：寧願平實，不要硬湊洞察。可以寫：今天身心相對平穩，目前沒有特別明顯的反差，可以繼續觀察什麼情況下精神會特別好或特別疲累。

【四個區塊必須推進，禁止換句話重複同一句結論】
- title 核心結論：今天最值得帶走的一個洞察。1-2 句，25-55 個中文字，可單獨閱讀。要有反差／關聯／發現，不要重述「今天很開心、睡了 5-6 小時」。不要文青、雞湯、說教、診斷腔。
- analysis 今天的身心訊號：把資料串起來，寫「發生了什麼＋彼此可能有什麼關聯」。不要逐項報告。
- notice 今天值得留意的地方：找出今天最值得繼續觀察的反差／模式。只挑最相關的 1-2 點。不要只提醒「睡眠不足，請早點睡」。
- suggestions 今晚可以這樣照顧自己：剛好 2 條，必須直接來自前面的洞察，具體到今晚能做。不要每次固定喝水／泡澡／早點睡／深呼吸。

【事實 vs 推測】
明確寫出的才是事實。其餘用：可能、似乎、值得繼續觀察、今天的紀錄看起來。
禁止：代表你、說明你、你其實已經、你是在硬撐、身體正在透支、睡眠債、長期消耗、宇宙、頻率、綻放、正能量。
單日睡眠偏短 ≠ 硬撐。若只睡 5-6 小時但精神不錯，要寫反差：睡得少不一定等於精神差；影響精神的可能不只是時數，品質與心理狀態也值得一起看。不要寫成「你其實很累只是沒發現」。

【③ 建議】
不要重複他今天已做過的事：
已寫感謝 → 禁止再叫他寫感謝／小確幸／感恩日記
已寫事件 → 禁止再叫他寫日記
已做身體覺察 → 禁止再叫他重新掃描身體
紀錄已提到運動／冥想 → 不要再預設叫他做同一件事
禁止空泛：好好休息、多照顧自己、放鬆身心、保持正向、多注意睡眠、適度休息、多喝水。
禁止宣稱療效：改善睡眠品質、調節自律神經、降低壓力荷爾蒙。

語氣：白話、有陪伴感、不過度心理分析。不要 emoji。所有欄位都必須是語意完整的句子。

規則：
- 只輸出 JSON，繁體中文
{
  "title": "25-55字洞察，不是摘要",
  "analysis": "80-180字，資料與關聯",
  "notice": "60-150字，反差與觀察",
  "suggestions": [
    { "title": "12-25字動作", "detail": "40-90字，說明為何跟今天的發現有關" },
    { "title": "12-25字動作", "detail": "40-90字" }
  ],
  "highlights": {
    "title": [{ "text": "必須原樣出現在 title 裡的短句", "color": "tea" }],
    "analysis": [],
    "notice": [],
    "suggestions": []
  }
}
${HIGHLIGHT_RULE}`;

function bodyCoachCompletedNotes(ctx) {
  const thanks = formatThanksForPrompt(ctx);
  const event = String((ctx && ctx.event) || "").trim();
  const awareness = Array.isArray(ctx && ctx.awareness) ? ctx.awareness.filter((item) => String(item || "").trim()) : [];
  const execution = Array.isArray(ctx && ctx.execution) ? ctx.execution.filter((item) => String(item || "").trim()) : [];
  const blob = `${thanks}\n${event}\n${(ctx && ctx.bodyNote) || ""}`;
  const notes = [];
  if (thanks) notes.push("已寫今日感謝 → 禁止再建議寫感謝／小確幸／感恩日記");
  if (event) notes.push("已寫今日事件 → 禁止再建議寫日記");
  notes.push("已勾選心情／身體／睡眠 → 禁止再建議重新掃描身體");
  if (awareness.length) notes.push("已寫覺察力回答");
  if (execution.length || String((ctx && ctx.smallestStep) || "").trim()) notes.push("已寫執行力／下一步");
  if (/運動|跑步|瑜珈|瑜伽|健身|重訓|散步/.test(blob)) notes.push("紀錄已提到運動 → 不要再預設建議運動");
  if (/冥想|正念靜坐/.test(blob)) notes.push("紀錄已提到冥想 → 不要再建議冥想");
  return notes;
}

function bodyCoachUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const done = bodyCoachCompletedNotes(ctx);
  const contrasts = bodyCoachInsight.detectBodyCoachContrasts(ctx);
  const hint = contrasts.length
    ? `系統先看到的可能線索（僅供內部參考，不足就忽略，不要照抄）：${contrasts.join("、")}`
    : "系統沒有看到明顯反差。資料不足時請平實說明，不要硬湊洞察。";
  return `請只根據下面「今天這個人真正寫過的內容」寫出身心小結。
先在內部走完：整理事實 → 找反差 → 找關聯 → 找模式 → 提煉一個發現。
title 是今天最值得帶走的洞察，不是資料摘要。
analysis 寫關聯，notice 寫反差與值得觀察的點，suggestions 必須承接前面的發現。
四個區塊不要重複同一句話。單日睡眠偏短不要寫成硬撐或睡眠債。照顧建議固定 2 條，且不要重複他今天已做過的事。

${hint}

今日心情：${ctx.mood || "未選"}
今日感謝：${formatThanksForPrompt(ctx) || "（未寫）"}
今日事件：${ctx.event || body.text || "（未寫）"}
${formatBodyCheckPrompt(ctx)}
覺察力回答：${Array.isArray(ctx.awareness) ? ctx.awareness.filter(Boolean).join("／") || "未寫" : "未寫"}
執行力／最小一步：${[...(Array.isArray(ctx.execution) ? ctx.execution : []), ctx.smallestStep].filter(Boolean).join("／") || "未寫"}

今天已完成：
${done.map((item) => `- ${item}`).join("\n")}

請輸出 title、analysis、notice，以及剛好 2 條 suggestions。`;
}

function softenBodyCoachText(text) {
  return String(text || "")
    .replace(/代表你用(?:一個相對)?疲憊的身體[，,]?撐起了[^。！？]*/g, "今天雖然感覺有精神，但身體的疲累可能還沒有完全被你感覺到")
    .replace(/用(?:一個相對)?疲憊的身體[，,]?撐起了[^。！？]*/g, "心情上的能量和身體的恢復程度可能還沒完全對上")
    .replace(/撐起了今天的熱情(?:與專注)?/g, "今天的熱情與身體恢復程度可能不同步")
    .replace(/代表你/g, "看起來")
    .replace(/說明你/g, "看起來")
    .replace(/你其實已經/g, "也許")
    .replace(/你是在硬撐/g, "即使現在沒有明顯感覺，身體可能仍需要休息")
    .replace(/身體正在透支/g, "身體可能仍需要更多休息")
    .replace(/身體已經超負荷/g, "今晚或許適合把負荷放低一點")
    .replace(/睡眠債/g, "睡眠時間偏短")
    .replace(/長期消耗/g, "今天休息偏少")
    .replace(/身體警訊/g, "值得留意的訊號")
    .replace(/可以改善睡眠品質|能調節自律神經|可以降低壓力荷爾蒙|可以改善焦慮|能幫助身體修復/g, "幫助自己慢慢進入休息狀態");
}

function keepSentencesWithin(text, max, overflow = 12) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (zhCharCount(raw) <= max) return raw;
  const parts = [];
  let buf = "";
  Array.from(raw).forEach((ch) => {
    buf += ch;
    if (/[。！？]/.test(ch)) {
      parts.push(buf.trim());
      buf = "";
    }
  });
  if (buf.trim()) parts.push(buf.trim());
  const kept = [];
  let used = 0;
  parts.forEach((part) => {
    const add = zhCharCount(part);
    if (used && used + add > max) return;
    if (!used && add > max) {
      if (add <= max + overflow) kept.push(part);
      return;
    }
    kept.push(part);
    used += add;
  });
  return kept.join("") || raw;
}

function isRepeatCareSuggestion(text, ctx) {
  const t = String(text || "");
  const thanks = Boolean(formatThanksForPrompt(ctx));
  const event = String((ctx && ctx.event) || "").trim();
  const blob = `${formatThanksForPrompt(ctx)}\n${event}\n${(ctx && ctx.bodyNote) || ""}`;
  if (thanks && /感謝|感恩|小確幸|寫下今天.{0,6}開心/.test(t)) return true;
  if (event && /寫日記|寫下今天發生/.test(t)) return true;
  if (/掃描身體|重新覺察身體|身體掃描/.test(t)) return true;
  if (/運動|跑步|瑜珈|瑜伽|健身/.test(blob) && /去運動|再運動|跑一次|做瑜伽/.test(t)) return true;
  if (/冥想/.test(blob) && /冥想/.test(t)) return true;
  if (/好好休息|多照顧自己|放鬆身心|保持正向|多注意睡眠|適度休息|^多喝水/.test(t)) return true;
  return false;
}

function defaultBodyCoachSuggestions(ctx) {
  return bodyCoachInsight.buildLocalBodyCoach(ctx).suggestions || [];
}

function normalizeBodyCoachSuggestion(item) {
  if (item && typeof item === "object") {
    const title = String(item.title || item.label || "").trim();
    const detail = String(item.detail || item.body || item.why || item.reason || "").trim();
    if (title && detail) return `${title}。${detail}`;
    return title || detail;
  }
  return String(item || "").trim();
}

function firstBodyCoachSentence(text) {
  const raw = String(text || "").trim();
  const match = raw.match(/^[\s\S]*?[。！？]/);
  return match ? match[0].trim() : raw;
}

function normalizeBodyCoachResult(raw, ctx) {
  const data = raw && typeof raw === "object" ? raw : {};
  const incoming = Array.isArray(data.suggestions) ? data.suggestions : Array.isArray(data.tips) ? data.tips : [];
  let suggestions = incoming
    .map(normalizeBodyCoachSuggestion)
    .map(softenBodyCoachText)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !isRepeatCareSuggestion(item, ctx));
  const fallbacks = defaultBodyCoachSuggestions(ctx).map(normalizeBodyCoachSuggestion);
  fallbacks.forEach((item) => {
    if (suggestions.length >= 2) return;
    if (!isRepeatCareSuggestion(item, ctx)) suggestions.push(item);
  });
  suggestions = suggestions.slice(0, 2);
  const local = bodyCoachInsight.buildLocalBodyCoach(ctx);
  let title = bodyCoachInsight.keepCompleteField(
    softenBodyCoachText(String(data.title || data.conclusion || data.core || "").trim()),
    55
  );
  let analysis = bodyCoachInsight.keepCompleteField(
    softenBodyCoachText(String(data.analysis || data.signals || data.summary || "").trim()),
    180
  );
  let notice = bodyCoachInsight.keepCompleteField(
    softenBodyCoachText(String(data.notice || data.watch || data.attention || "").trim()),
    150
  );
  if (bodyCoachInsight.looksLikeRestatement(title) && local.title) title = local.title;
  if (bodyCoachInsight.looksLikeRestatement(analysis) && local.analysis) analysis = local.analysis;
  if (bodyCoachInsight.looksLikeRestatement(notice) && local.notice) notice = local.notice;
  if (!title && analysis) {
    title = firstBodyCoachSentence(analysis);
    const rest = analysis.startsWith(title) ? analysis.slice(title.length).trim() : analysis;
    if (rest && rest !== analysis) analysis = rest;
    else if (local.title) title = local.title;
  }
  if (title && analysis.startsWith(title)) {
    analysis = analysis.slice(title.length).replace(/^[。！？\s]+/, "");
  }
  if (!title) title = local.title;
  if (!analysis) analysis = local.analysis;
  if (!notice) notice = local.notice;
  if (bodyCoachInsight.sectionsOverlapTooMuch({ title, analysis, notice }) && local.notice && notice !== local.notice) {
    notice = local.notice;
  }
  if (!suggestions.length) suggestions = fallbacks.slice(0, 2);
  [title, analysis, notice].forEach((field, index) => {
    const name = ["title", "analysis", "notice"][index];
    if (field && !textIntegrity.isCompleteSentence(field) && textIntegrity.splitSentences(field).some((item) => !textIntegrity.isCompleteSentence(item))) {
      textIntegrity.warnIncomplete("api/review.normalizeBodyCoachResult", name, field);
    }
  });
  return {
    title,
    analysis,
    notice,
    suggestions,
    highlights: {
      title: insightHighlight.fieldHighlights(data.highlights, "title"),
      analysis: insightHighlight.fieldHighlights(data.highlights, "analysis"),
      notice: insightHighlight.fieldHighlights(data.highlights, "notice"),
      suggestions: insightHighlight.fieldHighlights(data.highlights, "suggestions"),
    },
  };
}

const DEEPEN_SYSTEM = `你是「日精進」的高階心靈教練：有同理心，也有洞察力。使用者剛在一個深度思考主題裡寫下自己的回答。
請針對他的真實內容，再往下挖，提出至少 3 個更能直指核心的延伸思考問題。

規則：
- 只輸出 JSON：{"questions":["...","...","..."]}
- questions 必須 3 到 4 題
- 每一題是完整問句，12-36 字，貼近他剛寫的人、場面、情緒，不要空泛
- 像一對一教練追問：溫柔，但問到真正被碰到的那一層
- 禁止說教、禁止病例腔、禁止重複他已經回答過的原題
- 禁止套用固定題庫；每一題都要從他剛寫的人、場面、情緒長出來
- 繁體中文`;

function deepenUserPrompt(body) {
  const theme = String(body.theme || "").trim();
  const plain = String(body.plain || "").trim();
  const deep = String(body.deep || body.note || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  return `請針對這個主題與回答，再提出 3 到 4 個更深的追問。追問必須是今天才想得出來的，不要用制式題庫。

主題：${theme || "深度思考"}
白話想一想：${plain || "（未寫）"}
深挖一點點：${deep || "（未寫）"}
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}`;
}

function normalizeDeepenQuestions(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.questions)
      ? raw.questions
      : Array.isArray(raw?.items)
        ? raw.items
        : [];
  const questions = [];
  list.forEach((item) => {
    const text = typeof item === "string"
      ? item.trim()
      : String(item?.question || item?.text || item?.title || "").trim();
    if (text) {
      const cleaned = text.replace(/^[\d.、\-\s]+/, "").trim();
      const next = textIntegrity.isCompleteSentence(cleaned)
        ? cleaned
        : textIntegrity.pickCompleteSentence(cleaned, 80);
      if (next && !questions.includes(next)) questions.push(next);
    }
  });
  return questions.slice(0, 4);
}

function normalizeChecklistItems(raw, min, max) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : [];
  const items = [];
  list.forEach((item) => {
    const text = typeof item === "string"
      ? item.trim()
      : String(item?.label || item?.text || item?.title || "").trim();
    if (text && !items.includes(text)) items.push(text.replace(/^[\d.、\-\s]+/, ""));
  });
  return items.slice(0, max);
}

function firstAwarenessSentence(text) {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  const match = raw.match(/^[^。！？!?]+[。！？!?]?/);
  return (match ? match[0] : raw).replace(/[，,、；;]+$/g, "").trim();
}

function cleanAwarenessQuote(text) {
  const cleaned = firstAwarenessSentence(text)
    .replace(/^["「『]+|[」』"]+$/g, "")
    .replace(/^[\d.、｜|\-\s]+/, "")
    .trim();
  if (!cleaned) return "";
  if (zhCharCount(cleaned) <= 28 && textIntegrity.isCompleteSentence(cleaned)) return cleaned;
  return textIntegrity.pickCompleteSentence(cleaned, 28);
}

function compactAwarenessText(value, max) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (!max || zhCharCount(cleaned) <= max) return cleaned;
  return textIntegrity.pickCompleteSentence(cleaned, max) || "";
}

function compactAwarenessBlock(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function looksIncompleteAwarenessText(text) {
  return !textIntegrity.isCompleteSentence(text);
}

function finishAwarenessBlock(value, max) {
  const cleaned = compactAwarenessBlock(value);
  if (!cleaned) return "";
  const limit = max || 280;
  if (zhCharCount(cleaned) <= limit) {
    return looksIncompleteAwarenessText(cleaned) ? "" : cleaned;
  }
  const sentences = textIntegrity.splitSentences(cleaned);
  const kept = [];
  let used = 0;
  sentences.forEach((part) => {
    if (!textIntegrity.isCompleteSentence(part)) return;
    const add = zhCharCount(part);
    if (used && used + add > limit) return;
    if (!used && add > limit) return;
    kept.push(part);
    used += add;
  });
  const cut = kept.join("");
  if (!cut || looksIncompleteAwarenessText(cut)) return "";
  return cut;
}

function normalizeAwarenessLine(text) {
  let line = String(text || "").replace(/\s+/g, " ").trim().replace(/^["「『]+|[」』"]+$/g, "");
  if (!line || looksIncompleteAwarenessText(line)) return "";
  line = textIntegrity.toInnerVoice ? textIntegrity.toInnerVoice(line) : line;
  line = line.replace(/[。！？]+$/g, "").trim();
  if (!line || looksIncompleteAwarenessText(line)) return "";
  if (zhCharCount(line) < 8) return "";
  return line;
}

function isCompactAwarenessResult(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  const line = String(nested.line || "").trim();
  const seen = String(nested.seen || nested.selfSeen || "").trim();
  const gap = String(nested.gap || "").trim();
  const question = String(nested.question || "").trim();
  return Boolean(line && seen && !gap && !question);
}

function normalizeCompactAwarenessResult(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  let line = textIntegrity.toInnerVoice(nested.line || nested.core || nested.quote || nested.oneLine || "");
  let seen = textIntegrity.toInnerVoice(nested.seen || nested.note || nested.selfSeen || nested.iSee || "");
  if (zhCharCount(line) > 36 && zhCharCount(seen) > 0 && zhCharCount(seen) <= 28 && zhCharCount(line) > zhCharCount(seen) + 8) {
    const swapped = line;
    line = seen;
    seen = swapped;
  }
  line = normalizeAwarenessLine(line);
  seen = textIntegrity.retainCompleteText(seen, { source: "api/review.normalizeCompactAwarenessResult", field: "seen" });
  if (!line || !seen || looksIncompleteAwarenessText(seen)) return emptyAwarenessResult();
  return {
    seen,
    gap: "",
    question: "",
    line,
    echo: "",
    generatedAt: String(nested.generatedAt || src.generatedAt || "").trim(),
    updatedAt: String(nested.updatedAt || src.updatedAt || "").trim(),
    highlights: {
      seen: insightHighlight.fieldHighlights(nested.highlights || src.highlights, "seen"),
      gap: [],
      question: [],
      line: insightHighlight.fieldHighlights(nested.highlights || src.highlights, "line"),
    },
  };
}

function softenAwarenessClaim(text) {
  return String(text || "")
    .replace(/你就是/g, "你今天好像")
    .replace(/你一直都/g, "你今天可能")
    .replace(/你其實一直/g, "你今天可能")
    .replace(/這代表你/g, "今天看起來你")
    .replace(/代表你/g, "今天看起來你")
    .replace(/你其實只是/g, "你今天好像")
    .replace(/你一定是/g, "你今天可能")
    .replace(/你一直都在透支自己/g, "今天看起來你可能把力氣用得比較滿")
    .replace(/你其實只是渴望被看見/g, "你今天好像特別在意有沒有被放在心上")
    .replace(/宇宙正在提醒你[。.]?/g, "")
    .replace(/你值得被愛[。.]?/g, "")
    .replace(/你需要好好愛自己[。.]?/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isGenericAwarenessQuestion(text) {
  return /今天你學到了什麼|你愛自己嗎|你現在有什麼感覺|你真正的感受是什麼|你有什麼感覺/.test(String(text || ""));
}

function awarenessDayBlob(day) {
  if (!day || typeof day !== "object") return "";
  const result = day.awarenessResult && typeof day.awarenessResult === "object" ? day.awarenessResult : {};
  return [
    day.thanks,
    day.event,
    day.mood,
    day.body,
    day.sleep,
    Array.isArray(day.awarenessAnswers) ? day.awarenessAnswers.join(" ") : "",
    Array.isArray(day.awareness) ? day.awareness.join(" ") : "",
    result.seen,
    result.gap,
  ]
    .map((item) => String(item || ""))
    .join(" ");
}

function awarenessDayHasContent(day) {
  return compactLine(awarenessDayBlob(day), 400).length >= 8 || Boolean(day && (day.thanks || day.event || day.mood));
}

const AWARENESS_PATTERN_GROUPS = [
  {
    id: "cared",
    label: "被照顧／被放在心上／關係支持",
    all: [/陪伴|陪著|照顧|想到你|想到我|放在心上|撐傘|關心|有人陪|被愛|被看見|有人在|放在心/],
  },
  {
    id: "tired-plan",
    label: "身體能量不足，但仍持續安排任務",
    all: [/累|疲|睡不飽|睡眠不足|精神普通|精神不足|少於5|5–6|5-6/, /待辦|計畫|還沒做|列很多|想完成|安排下一|下一步|明天要/],
  },
  {
    id: "self-last",
    label: "比較晚才注意到自己的需要",
    all: [/自己的需要|沒顧自己|忽略自己|比較慢.*自己|先顧(別|他|她|孩子|工作)|還沒休息/],
  },
];

function matchAwarenessPattern(blob, group) {
  const text = String(blob || "");
  if (!text.trim()) return false;
  const rules = Array.isArray(group.all) ? group.all : [];
  return rules.length > 0 && rules.every((re) => re.test(text));
}

function qualifyAwarenessPatterns(recentDays) {
  const days = (Array.isArray(recentDays) ? recentDays : []).filter(awarenessDayHasContent);
  return AWARENESS_PATTERN_GROUPS.map((group) => {
    const hits = days.filter((day) => matchAwarenessPattern(awarenessDayBlob(day), group));
    return {
      id: group.id,
      label: group.label,
      count: hits.length,
      dates: hits.map((day) => String(day.date || "")).filter(Boolean),
      clues: hits
        .map((day) => compactLine(day.thanks || day.event || day.body || day.sleep, 24))
        .filter(Boolean)
        .slice(0, 3),
    };
  }).filter((item) => item.count >= 3);
}

function padDatePart(num) {
  return String(num).padStart(2, "0");
}

function toIsoDateValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function mapCloudReviewToAwarenessDay(iso, review) {
  const journal = (review && review.journal) || {};
  const bodyCheck = journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : {};
  const moodFlags = Array.isArray(bodyCheck.mood && bodyCheck.mood.flags) ? bodyCheck.mood.flags : [];
  const bodyFlags = Array.isArray(bodyCheck.body && bodyCheck.body.flags) ? bodyCheck.body.flags : [];
  const sleep = bodyCheck.sleep && typeof bodyCheck.sleep === "object" ? bodyCheck.sleep : {};
  return {
    date: iso,
    mood: journal.mood || "",
    thanks: String(journal.thanksText || journal.thanks || "").slice(0, 80),
    event: String(journal.event || (review && review.rawText) || "").slice(0, 120),
    body: [...moodFlags, ...bodyFlags].filter(Boolean).join("、").slice(0, 60),
    sleep: [sleep.duration, sleep.quality, sleep.energy].filter(Boolean).join("／"),
    awarenessAnswers: Array.isArray(journal.awareness) ? journal.awareness.slice(0, 3) : [],
    awareness: Array.isArray(journal.awarenessChecks) ? journal.awarenessChecks.slice(0, 4) : [],
    awarenessResult: journal.awarenessResult && typeof journal.awarenessResult === "object"
      ? {
          seen: compactLine(journal.awarenessResult.seen || "", 80),
          gap: compactLine(journal.awarenessResult.gap || "", 80),
          line: compactLine(journal.awarenessResult.line || "", 80),
          echo: compactLine(journal.awarenessResult.echo || "", 80),
        }
      : null,
    actions: Array.isArray(journal.executionChecks) ? journal.executionChecks.slice(0, 3) : [],
    insight: String((journal.insight && (journal.insight.title || journal.insight.conclusion)) || "").slice(0, 80),
  };
}

async function cloudAwarenessDaysForUser(userId, todayIso, extra) {
  const { loadUserData, cloudStoreConfigured } = require("../lib/store");
  if (!cloudStoreConfigured()) return null;
  const data = await loadUserData(userId, extra);
  const reviews = data && data.reviews && typeof data.reviews === "object" && !Array.isArray(data.reviews)
    ? data.reviews
    : {};
  const today = String(todayIso || "").trim();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(today) ? new Date(`${today}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return [];
  const from = new Date(base);
  from.setDate(from.getDate() - 6);
  const fromIso = toIsoDateValue(from);
  const untilIso = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : toIsoDateValue(base);
  return Object.entries(reviews)
    .filter(([iso, review]) => iso >= fromIso && iso <= untilIso && review && typeof review === "object")
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 7)
    .map(([iso, review]) => mapCloudReviewToAwarenessDay(iso, review));
}

async function attachCloudAwarenessHistory(user, body, extra) {
  if (!user || !user.id || !body || typeof body !== "object") return body;
  try {
    const days = await cloudAwarenessDaysForUser(user.id, body.date, extra);
    if (!Array.isArray(days)) return body;
    body.progress = {
      ...(body.progress && typeof body.progress === "object" ? body.progress : {}),
      recentAwarenessDays: days,
    };
  } catch (error) {
    console.warn("attachCloudAwarenessHistory failed", error && error.message ? error.message : error);
  }
  return body;
}

function recentAwarenessDaysFrom(progressOrDays) {
  if (Array.isArray(progressOrDays)) return progressOrDays;
  if (progressOrDays && typeof progressOrDays === "object") {
    if (Array.isArray(progressOrDays.recentAwarenessDays)) return progressOrDays.recentAwarenessDays;
    if (Array.isArray(progressOrDays.recentReviews)) return progressOrDays.recentReviews;
  }
  return [];
}

function sanitizeAwarenessEcho(echo, progressOrDays) {
  const days = recentAwarenessDaysFrom(progressOrDays).filter(awarenessDayHasContent);
  const text = compactAwarenessBlock(softenAwarenessClaim(echo), 120);
  if (!text) return "";
  if (days.length < 3) return "";
  const qualified = qualifyAwarenessPatterns(days);
  if (!qualified.length) return "";
  const countMatch = text.match(/(\d+)\s*次/);
  if (countMatch && Number(countMatch[1]) < 3) return "";
  if (countMatch && Number(countMatch[1]) > days.length) return "";
  const invented = (text.match(/\d{4}-\d{2}-\d{2}/g) || []).some((iso) => !days.some((day) => day.date === iso));
  if (invented) return "";
  if (/你最近常常|你一直都常常|這代表你最近/.test(text) && qualified.length === 0) return "";
  return text;
}

function emptyAwarenessResult() {
  return { seen: "", gap: "", question: "", line: "", echo: "", generatedAt: "", updatedAt: "" };
}

function normalizeAwarenessResult(raw, recentDays) {
  if (isCompactAwarenessResult(raw)) return normalizeCompactAwarenessResult(raw);
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  let seen = softenAwarenessClaim(finishAwarenessBlock(nested.seen || nested.selfSeen || nested.todaySeen || nested.iSee, 280));
  let gap = softenAwarenessClaim(finishAwarenessBlock(nested.gap || nested.overlooked || nested.missed, 320));
  let question = textIntegrity.finalizeGeneratedQuestion(
    nested.question || nested.tonight || nested.prompt || nested.eveningQuestion,
    { source: "api/review.normalizeAwarenessResult", field: "question", max: 160 }
  );
  if (isGenericAwarenessQuestion(question)) question = "";
  let line = normalizeAwarenessLine(nested.line || nested.quote || nested.oneLine);
  if (!line && Array.isArray(src.quotes) && src.quotes[0]) line = normalizeAwarenessLine(src.quotes[0]);
  const echo = sanitizeAwarenessEcho(nested.echo || nested.weekly || nested.crossDay || nested.pattern, recentDays);
  if (echo && gap && !gap.includes(echo)) gap = `${gap}\n\n${echo}`;
  if (!seen || looksIncompleteAwarenessText(seen) || (gap && looksIncompleteAwarenessText(gap))) {
    return emptyAwarenessResult();
  }
  return {
    seen,
    gap,
    question,
    line,
    echo,
    generatedAt: String(nested.generatedAt || src.generatedAt || "").trim(),
    updatedAt: String(nested.updatedAt || src.updatedAt || "").trim(),
    highlights: {
      seen: insightHighlight.fieldHighlights(nested.highlights || src.highlights, "seen"),
      gap: insightHighlight.fieldHighlights(nested.highlights || src.highlights, "gap"),
      question: insightHighlight.fieldHighlights(nested.highlights || src.highlights, "question"),
      line: insightHighlight.fieldHighlights(nested.highlights || src.highlights, "line"),
    },
  };
}

function normalizeAwarenessQuotes(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.quotes)
      ? raw.quotes
      : Array.isArray(raw?.items)
        ? raw.items
        : raw?.quote
          ? [raw.quote]
          : [];
  const items = [];
  const seen = new Set();
  list.forEach((item) => {
    const text = cleanAwarenessQuote(typeof item === "string" ? item : item?.quote || item?.text || item?.title || "");
    if (text.length < 8 || seen.has(text)) return;
    seen.add(text);
    items.push(text);
  });
  return items.slice(0, 1);
}

function splitChecklistTitle(text) {
  if (typeof textIntegrity.splitTitleDetail === "function") {
    return textIntegrity.splitTitleDetail(text);
  }
  const raw = String(text || "").trim();
  return { title: raw, detail: "" };
}

function flattenExecSentence(item) {
  if (typeof item === "string") {
    const parts = splitChecklistTitle(item);
    return parts.detail || parts.title;
  }
  const how = String(item?.how || item?.action || "").trim();
  const detail = String(item?.detail || item?.lead || item?.note || "").trim();
  const extracted = (detail.match(/怎麼做[:：]\s*([^｜]+)/) || [])[1]?.trim() || "";
  return how || extracted || detail;
}

function looksLikeAnalysisExecTitle(title) {
  const text = String(title || "").trim();
  if (!text) return true;
  return /vs|VS|真因|卡點|假二選一|自我修復|盲點|真正的原因|突破策略|難長的真實|深層原因|跟自己相處|身體在求救|你已經透支|缺乏自律/.test(text);
}

function firstExecSentence(text, max) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const limit = max || 80;
  if (zhCharCount(raw) <= limit && textIntegrity.isCompleteSentence(raw)) return raw;
  return textIntegrity.pickCompleteSentence(raw, limit);
}

function softenExecCoachText(text) {
  return String(text || "")
    .replace(/身體在求救/g, "最近休息可能還不夠")
    .replace(/你已經透支/g, "最近可能比較累")
    .replace(/正在燃燒自己/g, "最近可能給自己的事情偏多")
    .replace(/你的身體撐不住了|身體撐不住了/g, "身體可能需要先慢下來")
    .replace(/你缺乏自律/g, "這件事可能還少一個明確的開始點")
    .replace(/你在逃避/g, "這件事可能還太大或太模糊");
}

function shortenExecHow(detail) {
  const text = firstExecSentence(softenExecCoachText(detail), 80);
  if (/真正卡住|深層原因|自我修復|真因|核心卡點|為什麼|才比較容易/.test(text)) {
    return "先做最小的那一格，做完就勾起來。";
  }
  return text || "先做最小的那一格，做完就勾起來。";
}

function shortenExecWhy(detail) {
  const text = firstExecSentence(softenExecCoachText(detail), 40);
  if (/真正卡住|深層原因|自我修復|真因|核心卡點/.test(text)) {
    return "先完成會影響其他事情的那一小步。";
  }
  return text || "先完成會影響其他事情的那一小步。";
}

function execFocusWhenFromText(title, detail) {
  const blob = `${title || ""} ${detail || ""}`;
  const hasTomorrow = /明天/.test(blob);
  const hasToday = /今晚|今天|現在|此刻/.test(blob);
  if (hasTomorrow && !hasToday) return "tomorrow";
  if (hasToday && !hasTomorrow) return "today";
  if (hasTomorrow) return "tomorrow";
  return "today";
}

function execFocusHintForWhen(when) {
  return when === "tomorrow"
    ? "明天不用全部做到，先完成這一步就好。"
    : "今天不用全部做到，先完成這一步就好。";
}

function rewriteExecActionTitle(title, detail, smallestStep, options) {
  const keepFull = Boolean(options && options.keepFull);
  const cleaned = softenExecCoachText(String(title || "").replace(/^[\d.、｜|\-\s]+/, "")).trim();
  if (keepFull) {
    if (cleaned && !looksLikeAnalysisExecTitle(cleaned)) return cleaned;
    const step = String(smallestStep || "").trim();
    if (step && !looksLikeAnalysisExecTitle(step)) return step;
    return cleaned || step;
  }
  const pickTitle = (value) => {
    if (!value) return "";
    if (zhCharCount(value) <= 32 && textIntegrity.isCompleteSentence(value)) return value;
    return textIntegrity.pickCompleteSentence(value, 32) || (zhCharCount(value) <= 32 ? value : "");
  };
  if (cleaned && !looksLikeAnalysisExecTitle(cleaned)) return pickTitle(cleaned);
  const step = String(smallestStep || "").trim().replace(/[。！？.]+$/g, "");
  if (step && !looksLikeAnalysisExecTitle(step)) return pickTitle(step);
  return pickTitle(cleaned);
}

function pickExecItemByTitle(items, title) {
  const list = Array.isArray(items) ? items : [];
  const wanted = String(title || "").trim();
  if (!wanted) return list[0] || null;
  return (
    list.find((item) => item.title === wanted) ||
    list.find((item) => item.title && (wanted.includes(item.title) || item.title.includes(wanted))) ||
    list[0] ||
    null
  );
}

function rewriteExecFocus(focus, items, smallestStep, ctx, options) {
  const keepFull = Boolean(options && options.keepFull);
  const list = Array.isArray(items) ? items : [];
  const source = focus && typeof focus === "object" ? focus : {};
  const picked = pickExecItemByTitle(list, source.title) || list[0] || null;
  if (!picked) {
    const step = String(smallestStep || "").trim();
    const title = rewriteExecActionTitle(source.title || step, "", smallestStep, { keepFull });
    const when = execFocusWhenFromText(title, "");
    return {
      title,
      detail: keepFull ? String(source.detail || "").trim() : shortenExecWhy(source.detail),
      when,
      hint: String(source.hint || "").trim() || execFocusHintForWhen(when),
      highlights: source.highlights,
    };
  }
  const when = source.when === "tomorrow" || source.when === "today"
    ? source.when
    : execFocusWhenFromText(picked.title, picked.detail);
  return {
    title: rewriteExecActionTitle(picked.title, picked.detail, smallestStep, { keepFull }),
    detail: keepFull ? String(source.detail || picked.detail || "").trim() : shortenExecWhy(source.detail || picked.detail),
    when,
    hint: String(source.hint || "").trim() || execFocusHintForWhen(when),
    highlights: source.highlights || picked.highlights,
  };
}

function normalizeExecutionChecklistItems(raw, min, max, smallestStep, options) {
  const keepFull = Boolean(options && options.keepFull);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : [];
  const items = [];
  const seen = new Set();
  list.forEach((item) => {
    let title = "";
    let detail = "";
    if (typeof item === "string") {
      const resolved = textIntegrity.resolveTitleDetail
        ? textIntegrity.resolveTitleDetail(item, "", [smallestStep].filter(Boolean))
        : splitChecklistTitle(item);
      title = resolved.title;
      detail = resolved.detail;
    } else if (item && typeof item === "object") {
      title = String(item.title || item.label || item.text || "").trim();
      detail = flattenExecSentence(item);
      const resolved = textIntegrity.resolveTitleDetail
        ? textIntegrity.resolveTitleDetail(title, detail, [smallestStep].filter(Boolean))
        : null;
      if (resolved && resolved.title) {
        title = resolved.title;
        detail = resolved.detail;
      } else if (!detail && title) {
        const parts = splitChecklistTitle(title);
        title = parts.title;
        detail = parts.detail;
      }
    }
    title = rewriteExecActionTitle(title.replace(/^[\d.、｜|\-\s]+/, ""), detail, smallestStep, { keepFull });
    detail = keepFull ? String(detail || "").trim() : shortenExecHow(detail);
    if (!title || seen.has(title)) return;
    seen.add(title);
    items.push({
      title,
      detail,
      highlights: item && typeof item === "object" ? item.highlights : undefined,
    });
  });
  if (keepFull && !items.length && String(smallestStep || "").trim()) {
    items.push({ title: String(smallestStep).trim(), detail: "", highlights: undefined });
  }
  return items.slice(0, max);
}

function checklistUserPrompt(kind, body) {
  const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
  const answer = answers.filter(Boolean).join("\n\n") || String(body.text || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const bodyTags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
  const questions = Array.isArray(body.questions) ? body.questions.map((item) => String(item || "").trim()) : [];
  if (kind === "execution") {
    const openActions = Array.isArray(ctx.openActions) ? ctx.openActions.filter(Boolean) : [];
    const labeled = questions.length
      ? questions
          .map((question, index) => `${index + 1}. ${question}\n回答：${answers[index] || "（未填）"}`)
          .join("\n\n")
      : `深度回答：${answer || "（未填）"}`;
    const choiceMode = Boolean(body.choiceMode);
    return `請依這個人今天真正寫過的內容，產出可執行行動卡。寧缺勿濫：只有一件重要的事就只出 1 張。不要發明他沒提過的習慣。
${choiceMode ? "使用者已選好具體下一步。items 必須對應已選行動的 title／detail，禁止另造感恩、靜坐、喝水、早睡來取代核心問題。除非今天核心真的是身體耗竭。\n" : ""}
使用者已經選好「明天最小的一步」時：只出 1 張卡，title 與 detail 都必須完整保留語意，禁止截斷、禁止改寫成更短的半句。
標題＝時間或觸發點＋具體動作。說明＝怎麼做＋最低完成標準。
最重要的一步必須是 items 裡的其中一張，不要另外發明。若行動屬於明天，focus.when 填 tomorrow。
若今天主要是累、睡眠偏少：休息可以就是那一張卡，不要再塞很多任務。

${labeled}

明天最小的一步：${ctx.smallestStep || "未寫"}
本輪作答輪數：${Number(body.round || questions.length || 1)}

背景（只用來對準行動，不要寫成分析或診斷）：
今日感謝：${formatThanksForPrompt(ctx) || "未寫"}
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}
${formatBodyCheckPrompt(ctx)}
今日覺察：${Array.isArray(ctx.awareness) ? ctx.awareness.filter(Boolean).join("／") || "未寫" : ctx.awareness || "未寫"}
核心覺察：${String(ctx.awarenessLine || "").trim() || "未寫"}
我看見了：${String(ctx.awarenessSeen || "").trim() || "未寫"}
04 勾選：${Array.isArray(ctx.thinkSelected) && ctx.thinkSelected.length ? ctx.thinkSelected.join("／") : ctx.thinkNone ? "今天沒有特別符合我的選項" : "未勾"}
深度看見：${[ctx.thinkCloseTitle, ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen, ctx.thinkCloseTakeaway].filter(Boolean).join("／") || compactLine(ctx.deepNote || ctx.insight, 220) || "未寫"}
尚未完成的行動：${openActions.slice(0, 6).join("、") || "尚無"}`;
  }
  const labeled = questions.length
    ? questions
        .map((question, index) => `${index + 1}. ${question}\n作答：${answers[index] || "（未答）"}`)
        .join("\n\n")
    : `是非題作答：${answer || "（未答）"}`;
  if (isAwarenessChoiceClose(body)) {
    const selected = Array.isArray(body.selected) ? body.selected.map((item) => String(item || "").trim()).filter(Boolean) : answers.filter(Boolean);
    const none = Boolean(body.none) || selected.some((item) => item === "今天沒有特別符合我的選項");
    const picked = none
      ? "使用者勾選了「今天沒有特別符合我的選項」。不要硬套未勾選的句子。"
      : selected.length
        ? selected.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "使用者一個選項都沒勾。不要硬套未勾選的句子。";
    return `請先交叉比對今天所有資料，再依勾選內容收成兩句：「核心覺察」＋「我看見了」。不要分析他，不要再提問，不要第三層。

使用者勾選的句子權重最高。從「今天發生什麼＋被什麼碰到＋他在 04／05 選了哪幾句」收成一個核心看見。不要只改寫 choice。
05 只寫「我看見了自己什麼」。不要寫人生意義、長期價值、關係哲學。

【05 勾選｜權重最高】
${picked}

【04 深度思考】
${
  ctx.thinkVariant === "think-v2"
    ? `核心結論：${ctx.thinkCloseCore || ctx.thinkCloseAwareness || "尚未整理"}
我沒看見的問題：${ctx.thinkCloseBlindSpot || "未寫"}
改善方向：${ctx.thinkCloseImprovement || ctx.thinkCloseDirection || "未寫"}
使用者自己說出的：${Array.isArray(ctx.thinkSelected) && ctx.thinkSelected.length ? ctx.thinkSelected.join("／") : "尚未寫"}
03 身心原文：${compactLine(ctx.bodyMindText || ctx.bodyNote, 160) || "未寫"}
03 模型假設（非事實，不要重講）：${compactLine(ctx.bodyMindInsight, 80) || "無"}
不要把「我沒看見的問題」原句當成 05。05 只寫「經過今天，我真正看見了自己什麼」。`
    : `勾選：${Array.isArray(ctx.thinkSelected) && ctx.thinkSelected.length ? ctx.thinkSelected.map((item, index) => `${index + 1}. ${item}`).join("\n") : ctx.thinkNone ? "今天沒有特別符合我的選項" : "尚未勾選"}
深度看見：${[ctx.thinkCloseTitle, ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen, ctx.thinkCloseTakeaway].filter(Boolean).join("\n") || "尚未整理"}`
}

【今天已完成的內容】
今日感謝：
${formatThanksForPrompt(ctx) || "未寫"}
今日事件：${compactLine(ctx.event, 800) || "未寫"}
心情：${ctx.mood || "未選"}
${formatBodyCheckPrompt(ctx)}
`;
  }
  const yesCount = answers.filter((item) => item === "是").length;
  const noCount = answers.filter((item) => item === "否").length;
  const progress = body.progress && typeof body.progress === "object" ? body.progress : {};
  const recentDays = Array.isArray(progress.recentAwarenessDays)
    ? progress.recentAwarenessDays
    : Array.isArray(progress.recentReviews)
      ? progress.recentReviews
      : [];
  return `請先交叉比對今天所有資料，再依是／否修正判斷，最後才產出完整「今日覺察結果」。不要只給金句，也不要替他下人格結論。

【3 道驗證題與作答｜否=假設不成立】
${labeled}

是：${yesCount}　否：${noCount}
若某題為「否」，禁止把該題的假設寫進 seen / gap / line / echo。
若三題都是否，seen 必須承認今天他沒有接受那些假設，改從實際填寫內容找一個較小的觀察。

【今天已完成的內容｜必須綜合，不要只抓一句】
今日感謝：
${formatThanksForPrompt(ctx) || "未寫"}
今日事件：${compactLine(ctx.event, 800) || "未寫"}
心情：${ctx.mood || "未選"}
${formatBodyCheckPrompt(ctx)}

【gap 寫法】先寫今天具體線索 → 再說可能的關聯 → 最後才提一個可能的模式。用可能／好像／看起來／也許。

【question】必須承接 seen + gap${qualifyAwarenessPatterns(recentDays).length ? " + echo" : ""}。不要問「今天你學到了什麼／你愛自己嗎／你現在有什麼感覺」。

【最近反覆出現的模式｜echo】
${formatRecentAwarenessDays(progress)}
`;
}

const PROMPTS_SYSTEM = `你是「日精進」的高階心靈教練。請依這個人今天的真實輸入，以及近期成長進度，動態生成全新的深度思考主題。

覺察力與執行力已改為固定的一道核心題，不要再生成覺察題或執行力題。

【任務】
- deep：4 個深度思考主題。每個主題含標題、白話引導、深挖引導。
- 第一題必須是今天最值得深挖、最貼近當下狀態的主題（會單獨顯示在主畫面）。其餘三題作為「還想繼續探索」時才展開。

【必須遵守】
- 只輸出 JSON
- 題目必須貼近今天的事件、心情、身體訊號、感恩、近期洞察與未完成行動，讓他覺得「這題是為我今天出的」
- 每天視角都要不同：可從關係、身體、價值、界線、未說出口的話、想保護的東西、卡住的任務、小小的堅持等切入，但不要重複使用者最近已經問過的題
- 禁止使用固定題庫口吻。尤其禁止出現或改寫這些死題：
  「生命力或平靜」「防衛心或情緒波動」「翻白眼」「不好意思拒絕」「老方法處理」「還好我有堅持」
  「本來想做卻一直拖著」「卡住不想動」「明天只要花 5 分鐘」
- 禁止雞湯、禁止說教、禁止病例腔、禁止空泛「你真正的感受是什麼」「你要更努力」
- 題目要具體、有畫面、有啟發，像一對一教練今天才想出來的
- 繁體中文

{
  "deep": [
    {
      "title": "深度思考主題，完整問句，18-40字",
      "plainGuide": "白話想一想：一句引導，幫他把場面講清楚",
      "deepGuide": "深挖一點點：一句引導，問到真正被碰到的那一層",
      "placeholderPlain": "8-18字",
      "placeholderDeep": "8-18字"
    }
  ]
}
deep 必須剛好 4 題。`;

function compactLine(value, max) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const limit = max || 160;
  if (zhCharCount(cleaned) <= limit) return cleaned;
  return textIntegrity.pickCompleteSentence(cleaned, limit) || "";
}

function thanksItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatThanksForPrompt(ctx) {
  const raw = String((ctx && ctx.thanksText) || "").trim();
  if (raw) return raw;
  const items = thanksItems(ctx && ctx.thanks);
  if (!items.length) return "";
  return items.length === 1 ? items[0] : items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatRecentAwarenessDays(progress) {
  const recent = Array.isArray(progress?.recentAwarenessDays)
    ? progress.recentAwarenessDays
    : Array.isArray(progress?.recentReviews)
      ? progress.recentReviews
      : [];
  const days = recent.filter(awarenessDayHasContent).slice(0, 7);
  if (days.length < 3) {
    return `近 7 天只有 ${days.length} 天有實際紀錄。資料不足，echo 必須是空字串。禁止寫「近X天第X次」「你最近常常」，禁止虛構次數、日期與歷史事件。`;
  }
  const qualified = qualifyAwarenessPatterns(days);
  const dayLines = days
    .map((day) => {
      const result = day && day.awarenessResult && typeof day.awarenessResult === "object" ? day.awarenessResult : {};
      const answers = Array.isArray(day.awarenessAnswers) ? day.awarenessAnswers.join("/") : "";
      const body = compactLine(day.body || (Array.isArray(day.bodyTags) ? day.bodyTags.join("、") : ""), 40);
      const sleep = compactLine(day.sleep, 40);
      const seen = compactLine(result.seen || (Array.isArray(day.awareness) ? day.awareness.join("／") : day.awareness), 80);
      return `${day.date || "某日"}｜心情:${day.mood || "未選"}｜感謝:${compactLine(day.thanks, 50) || "未寫"}｜事件:${compactLine(day.event, 70) || "未寫"}｜身體:${body || "未寫"}｜睡眠:${sleep || "未寫"}｜是非:${answers || "無"}｜覺察:${seen || "未寫"}`;
    })
    .join("\n");
  if (!qualified.length) {
    return `近 7 天有 ${days.length} 天紀錄，但沒有任何「同一語意模式」達到 3 次。echo 必須是空字串。不要因為同一個字出現 3 次就當成模式。禁止虛構。

【真實紀錄｜只可引用，不可改日期或次數】
${dayLines}`;
  }
  const patternLines = qualified
    .map((item) => `- ${item.label}：${item.count} 次（${item.dates.join("、")}）；線索：${item.clues.join("／") || "見上方紀錄"}`)
    .join("\n");
  return `只有下列合格模式可以寫進 echo。次數與日期必須和這裡一致，禁止加減或虛構。請做語意歸類，不要只數關鍵字。

【合格的跨日模式｜至少 3 次才列出】
${patternLines}

【真實紀錄】
${dayLines}`;
}

function promptsUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const progress = body.progress && typeof body.progress === "object" ? body.progress : {};
  const bodyTags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
  const thanks = formatThanksForPrompt(ctx);
  const recent = Array.isArray(progress.recentReviews) ? progress.recentReviews : [];
  const recentInsights = Array.isArray(progress.recentInsights) ? progress.recentInsights : [];
  const avoid = Array.isArray(progress.avoidQuestions) ? progress.avoidQuestions.filter(Boolean) : [];
  const openActions = Array.isArray(progress.openActions) ? progress.openActions.filter(Boolean) : [];
  const recentText = recent
    .slice(0, 7)
    .map((item) => {
      const checks = Array.isArray(item.awareness) ? item.awareness.join("、") : "";
      const actions = Array.isArray(item.actions) ? item.actions.join("、") : "";
      return `- ${item.date || ""}｜心情 ${item.mood || "未記"}｜${compactLine(item.event, 80)}${item.insight ? `｜洞察：${compactLine(item.insight, 60)}` : ""}${checks ? `｜已覺察：${compactLine(checks, 80)}` : ""}${actions ? `｜行動：${compactLine(actions, 80)}` : ""}`;
    })
    .join("\n");
  return `請為這個人生成「今天才有」的深度思考主題 4 題。覺察力與執行力已改為固定核心題，不要再出那兩類題。

日期：${body.date || ""}
連續復盤天數：${progress.streak || 0}

【今天的輸入】
今日感謝：${thanks || "未寫"}
今日事件：${compactLine(ctx.event || body.text, 500) || "（未寫）"}
心情：${ctx.mood || "未選"}
身體狀態：${bodyTags || "未選"}
身體在提醒我：${compactLine(ctx.bodyNote, 200) || "未寫"}
今日核心結論：${compactLine(ctx.insight, 220) || "尚未生成"}

【成長進度】
近期已覺察洞察：${recentInsights.slice(0, 8).map((item) => compactLine(item.title || item, 40)).filter(Boolean).join("、") || "尚無"}
尚未完成的行動：${openActions.slice(0, 6).map((item) => compactLine(item, 40)).join("、") || "尚無"}
最近幾天的復盤：
${recentText || "（還沒有歷史復盤）"}

【請避開、不要再出相近的題】
${avoid.length ? avoid.slice(0, 16).map((item) => `- ${compactLine(item, 60)}`).join("\n") : "（無）"}

請讓今天的深度思考主題承接他的進度：看見重複模式就換新視角，看見新突破就往下挖一層。`;
}

const AWARENESS_PROMPTS_SYSTEM = `你是「日精進」的覺察引導者。每次只生成 1 道是／否題，讓使用者自己確認。

這不是一次出完的心理測驗。Q2 必須承接 Q1 的是／否；Q3 必須承接 Q1、Q2 的是／否。
「是」與「否」都是有效路徑。不可以預設「是」才是正確答案。
若上一題是「否」，下一題禁止繼續把被否定的假設當成事實，必須改從今天其他紀錄另找一條方向。

【三層深度】
Q1｜看見感受背後的原因
從今天真實發生的事件切入，但不要只重述事件。
要讓他第一次產生：「原來我在意的是這個。」
合格：「當別人記得你的喜好、主動關心你時，你會特別開心，是不是因為『被放在心上』對你來說，比事情本身更重要？」
不合格：「別人關心你是不是讓你很開心？」

Q2｜看見重複的內在模式
必須參考今天完整紀錄、Q1、Q1 的是／否。
找出他今天可能沒注意到的行為模式、情緒模式、自我要求、被看見的需求、完成感、休息與努力的拉扯、對自己的期待、或與他人互動的模式。
必須用「是不是／會不會／是否可能」，不要直接判定他就是這樣。
合格：「當你睡眠不足，卻還是想把安排好的事情完成，你是不是很容易把『我有做到』放在『我現在累不累』前面？」

Q3｜碰到更底層的自己
這是三題裡最重要的一題。必須根據今日完整紀錄 + Q1答案 + Q2答案，往更深一層。
可探索：自我價值、被需要、被看見、安全感、外在肯定、完成感、控制感、對自己的要求、是否允許自己休息、真正重視的事情、自己與他人的關係。
希望他看到時會停頓幾秒。
合格：「如果今天什麼都沒有完成，也沒有人特別肯定你，你還能一樣覺得今天的自己值得喜歡嗎？」

【生成前自我檢查｜不合格就重寫】
1. 是不是只在重述他已經知道的事情？是 → 重寫
2. 是不是任何人都可以套用？是 → 重寫
3. 有沒有使用今天真實紀錄的具體線索？沒有 → 重寫
4. 能不能帶出「原來我可能是這樣」的感覺？沒有 → 再深入一層
5. 是否過度心理分析或替他下結論？是 → 改成探索式的是／否問題

禁止假深度、文青空話，例如：「在今天的光影裡，你是否看見內心真正的自己？」
禁止：「你其實在期待…」「你真正的防衛…」「你一直都…」「你就是…」
問題一定要引用今天紀錄中的線索，具體、白話、準確、有心理深度。
整題必須寫完整，最後一字不能停在「的／和／一個／以及／還包括／當成了」。
問題必須可以單獨閱讀，最後必須有「？」，並且是一個清楚的是／否判斷。
所有輸出欄位都必須是語意完整的句子。禁止輸出講到一半的句子。不得為了符合字數限制直接截斷句子。若內容過長，請重新濃縮成較短但完整的一句話。

規則：
- 只輸出 JSON：{"awareness":[{"question":"..."}]}
- 只出 1 題，1～3 句，40-160 字，一個問號
- 必須能用「是／否」回答
- 繁體中文`;

const CHOICES_AWARENESS_SYSTEM = `你是「日精進」的覺察引導者。任務是從今天真實寫下的內容，長出幾個「經過今天這些事情，我看見了自己什麼」的選項，讓使用者勾選。

這不是測驗，不是診斷，也不是深度意義題。
這是 05 覺察力，發生在 04 深度思考之後。
05 只處理當下的自己：我現在怎麼了、我的需要、我的情緒反應、我的習慣、我容易忽略自己的地方、我今天真正看見自己的地方。
禁止寫成 04 的題：這件事背後代表什麼、人生哲學、價值觀大結論、真正想留下什麼。
若使用者訊息列出 04 已出現的深度思考句子，禁止改寫或近義重複。

【生成規則｜寧缺勿濫】
- 只輸出 3 到 4 個選項。能清楚推導出 3 個就只出 3 個，不要為了湊數硬出第 4、第 5 個。
- 永遠不要輸出「今天沒有特別符合我的選項」；前端會自己加。
- 每一句必須能回扣今天感謝、事件、心情或身體紀錄的具體線索。
- 沒有把握的選項直接省略。
- 第一人稱、可能／好像／看起來。禁止：你就是、你一直都、這代表你。
- 每句 18-42 個中文字，完整一句，不要問句。

合格：
「當別人主動表達在乎時，我會特別有感」
「我真正被碰到的，可能不是事情本身，而是有人把我放在心上」
不合格：
「我害怕的可能不是失去，而是來不及好好珍惜」（這是 04）
「你就是一個很需要被愛的人」

只輸出 JSON：
{"options":[{"id":"a1","text":"..."},{"id":"a2","text":"..."}]}
繁體中文`;

const CHOICES_THINK_SYSTEM = `你是「日精進」的深度思考引導者。任務是從今天真實寫下的內容，長出幾個「這件事背後，對我真正代表什麼？」的選項。

這是 04 深度思考，發生在覺察力之前。
只根據今日感謝、今日事件、心情、身體覺察生成。不要等待、不要依賴尚未生成的覺察結論。

04 是理解事情更深一層的意義：我在意的價值、關係裡真正重要的東西、反覆出現的模式、我真正害怕／珍惜的是什麼、這件事對我的意義、我真正想留下的是什麼。
禁止替使用者直接下完整的自我覺察結論。那是後面 05 的工作。
禁止寫成 05：我現在怎麼了、我的需要、我的情緒反應、我看見了自己什麼。

【生成規則｜寧缺勿濫】
- 只輸出 3 到 4 個選項。能清楚推導出 3 個就只出 3 個，不要為了湊數硬出第 4、第 5 個。
- 永遠不要輸出「今天沒有特別符合我的選項」；前端會自己加。
- 每一句必須能回扣今天感謝、事件、心情或身體紀錄。
- 第一人稱、可能／好像／看起來。禁止：你就是、你一直都、這代表你。
- 每句 18-42 個中文字，完整一句，不要問句。

合格：
「我害怕的可能不是失去，而是來不及好好珍惜」
「有些關係的重要，不需要等到失去才被看見」
不合格：
「當別人主動表達在乎時，我會特別有感」（這是 05）
「我真正被碰到的，可能不是晚餐本身，而是有人把我放在心上」（這是 05）

只輸出 JSON：
{"options":[{"id":"t1","text":"..."},{"id":"t2","text":"..."}]}
繁體中文`;

const THINK_CHOICES_CLOSE_SYSTEM = `你不是心理醫師，也不是裁判。你是一面會整理的鏡子。

使用者剛在 04 勾選了「這件事背後代表什麼」的選項（最多 2 個，也可以一個都不勾）。
請只根據今天原文 + 勾選內容，寫出精短總結。不要再提問，不要列行動清單，不要寫成三輪問答。

若他勾了「今天沒有特別符合我的選項」，或一個都沒勾：不要硬套選項。改從實際填寫內容找一個較小、較安全的觀察。
沒被勾選的選項，禁止寫成今天的結論。
證據不足時用「也許／可能／似乎／值得留意」。
禁止：「你就是……」「這證明你……」「你真正需要的就是……」

規則：
- 只輸出 JSON：
{
  "title": "8-16字，具體，不要雞湯",
  "awareness": "今日深度看見。剛好 2 到 3 個短段落，用\\n\\n分開。全文 120-220 個中文字。內容只含：1) 今天發生了什麼 2) 勾選共同指向什麼 3) 今天可能值得繼續觀察什麼",
  "selfSeen": "今天我看見的自己：只能一句，第一人稱，必須像他自己說的",
  "takeaway": "今日帶走的一句話：只能一句，15-35字，必須語意完整。寧可短而完整，禁止截在半個詞",
  "highlights": {
    "title": [],
    "awareness": [{ "text": "必須原樣出現在 awareness 裡的短句", "color": "yellow" }],
    "selfSeen": [],
    "takeaway": []
  }
}
${HIGHLIGHT_RULE}
- 繁體中文`;

const EXECUTION_CHOICES_SYSTEM = execV2.EXECUTION_CHOICES_SYSTEM;
const EXEC_DEEP_ASK_SYSTEM = execV2.EXEC_DEEP_ASK_SYSTEM;
const EXEC_DEEP_CLOSE_SYSTEM = execV2.EXEC_DEEP_CLOSE_SYSTEM;
const EXEC_DEEP_REFRESH_SYSTEM = execV2.EXEC_DEEP_REFRESH_SYSTEM;

const EXECUTION_PROMPTS_SYSTEM = `你是「日精進」的行動教練。先幫他找到卡點與阻力，再把想做的事問到夠具體。不要分析人格，不要列待辦。

這是 06 執行力。前面已經有 04 深度思考與 05 核心覺察／我看見了。
問題要自然變成：既然我已經看見這件事，那接下來我願意做什麼？
優先參考 04 深度看見與 05 核心覺察，不要再重做一次覺察。

這次只出「第 1 題」。後面會依回答再追問，最多 2 輪。不要出第 3 題。

第 1 題要讓他說出：明天真正想做的那一件事，或如果太累／事情太多，準備先放下什麼。
可以輕輕點出今天已看見的方向、人／事／身體訊號，方便對準。
禁止診斷腔：身體在求救、你已經透支、正在燃燒自己、缺乏自律、你在逃避。
禁止二選一質問。禁止真正卡住你的、深層原因、自我修復、真因。

合格：
「你想明天開始多吃菜，但也提到最近睡得比較少。如果明天不要求一次做到很多，最容易開始的一步是什麼？」
「明天你最想開始的，具體是哪一件事？」
不合格：
「身體在求救（睡眠不足），你要先休息還是先工作？」

placeholder 給具體做法，例如：午餐多加一份青菜／下班後走路10分鐘。

規則：
- 只輸出 JSON：{"execution":[{"question":"...","placeholder":"..."}]}
- 只出 1 題
- 一題一事，一個問號
- 每題 24-72 字
- 繁體中文`;

const EXECUTION_FOLLOW_SYSTEM = `你是「日精進」的行動教練。使用者剛回答了執行力問題，但答案可能還太抽象。

請只出 1 道追問，把行動拆成：什麼事情、什麼時間、最小做到什麼程度、怎樣算完成。

若上一答是「先完成一件最重要的事」→ 問「如果明天只能完成一件最重要的事，你最希望完成的是哪一件？」
若上一答是「開始運動」→ 問時間／方式／多久算完成，例如下班回家換完衣服後走路10分鐘。
若上一答是「多吃菜／吃健康一點」→ 問哪一餐、加多少就算完成。
若上一答是「明天要休息／多休息」→ 問哪個時間、休息幾分鐘、沒睡著算不算完成。
若上一答是「早點睡／不要拖延／把事情做好／努力工作」→ 追問具體的事、時間與完成標準。

不要重複上一題。不要診斷腔。這已經是最多第 2 題，不要再規劃第 3 題。
如果已經夠具體（已有事情＋時間或觸發點＋完成標準），仍只出一題把缺的那一格補上。

規則：
- 只輸出 JSON：{"execution":[{"question":"...","placeholder":"..."}]}
- 只出 1 題，24-72 字，一個問號
- 繁體中文`;

const CORE_PROMPTS_SYSTEM = `你是「日精進」溫柔的覺察與行動教練。請精準讀取使用者今天寫下的感謝、事件、心情與身體覺察，動態生成「只屬於今天」的覺察力與執行力題目。

【任務】
- awareness：只出目前這一層的 1 道是／否題。Q1 看感受背後的原因，Q2 看重複模式，Q3 碰到更底層的自己。下一題必須承接上一題的是／否；若上一題是「否」，禁止繼續把被否定的假設當成事實。
- execution：只出 1 道行動問題，問明天真正想做的那一件，或事情太多時準備先放下什麼。不要一次出完 2～3 題。不要用真正卡住、真因、自我修復。不要診斷腔。

【必須遵守】
- 只輸出 JSON
- 題目裡要能看見今天的人、事、情緒
- 禁止空泛萬用題、禁止雞湯、禁止說教
- 繁體中文

{
  "awareness": [
    { "question": "1～2句，只問一件事，可問是不是…？" }
  ],
  "execution": [
    { "question": "完整問句，24-72字", "placeholder": "例如：具體做法…" }
  ]
}
awareness 這次只出 1 題。execution 這次只出 1 題。`;

function isExecutionFollowupRequest(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return Boolean(body?.followup || body?.step === "follow" || ctx.followup || ctx.step === "follow");
}

function labeledAwarenessTurns(body) {
  const questions = Array.isArray(body?.questions) ? body.questions.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const answers = Array.isArray(body?.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
  return questions
    .map((question, index) => {
      const answer = answers[index] === "否" ? "否" : answers[index] === "是" ? "是" : "（未答）";
      return `Q${index + 1}：${question}\n回答：${answer}`;
    })
    .join("\n\n");
}

function awarenessPromptStep(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const requested = Number(body?.step || ctx.step || 0);
  if (requested >= 1 && requested <= 3) return requested;
  const answered = (Array.isArray(body?.answers) ? body.answers : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item === "是" || item === "否").length;
  return Math.min(3, Math.max(1, answered + 1));
}

function isAwarenessFollowupRequest(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  if (body?.followup || ctx.followup) return true;
  const step = awarenessPromptStep(body);
  return step >= 2;
}

function executionFollowUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const questions = Array.isArray(body.questions) ? body.questions.map((item) => String(item || "").trim()) : [];
  const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
  const labeled = questions
    .map((question, index) => `${index + 1}. ${question}\n回答：${answers[index] || "（未填）"}`)
    .join("\n\n");
  const last = answers.filter(Boolean).slice(-1)[0] || "";
  return `請只出 1 道追問，把上一答變得可執行。不要重複上一題。

已問過：
${labeled || "（尚無）"}

上一答：${last || "（未填）"}
明天最小的一步：${ctx.smallestStep || "未寫"}
今日事件：${compactLine(ctx.event || body.text, 120) || "未寫"}
心情：${ctx.mood || "未選"}
${formatBodyCheckPrompt(ctx)}

核心覺察：${String(ctx.awarenessLine || "").trim() || "未寫"}
我看見了：${String(ctx.awarenessSeen || "").trim() || "未寫"}
深度看見：${[ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen].filter(Boolean).join("／") || "未寫"}

若上一答仍是「最重要的事／早點睡／多休息／開始運動／吃健康一點／不要拖延」，必須再問具體的事、時間與完成標準。`;
}

function isChoicesRequest(body) {
  const mode = String(body?.mode || "").trim().toLowerCase();
  const kind = String(body?.kind || body?.scope || "").trim().toLowerCase();
  return mode === "choices" || kind === "awareness-choices" || kind === "think-choices" || kind === "think-close" || kind === "execution-choices" || kind === "execution-deep" || kind === "exec-deep";
}

function choicesKind(body) {
  const kind = String(body?.kind || body?.scope || body?.step || "").trim().toLowerCase();
  if (kind === "think-close" || kind === "close") return "think-close";
  if (kind === "think" || kind === "think-choices" || kind === "deep") return "think";
  if (kind === "execution-deep" || kind === "exec-deep") return "execution-deep";
  if (kind === "execution" || kind === "exec" || kind === "execution-choices") return "execution";
  return "awareness";
}

function isAwarenessChoiceClose(body) {
  return Boolean(body?.choiceMode || body?.variant === "choices" || body?.source === "choices");
}

function formatThinkAwarePrompt(ctx) {
  const thinkSelected = Array.isArray(ctx.thinkSelected) ? ctx.thinkSelected.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const thinkOptions = Array.isArray(ctx.thinkOptions) ? ctx.thinkOptions.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const thinkNone = Boolean(ctx.thinkNone);
  const v2 = String(ctx.thinkVariant || "") === "think-v2";
  const thinkClose = (
    v2
      ? [
          ctx.thinkCloseCore || ctx.thinkCloseAwareness,
          ctx.thinkCloseBlindSpot,
          ctx.thinkCloseImprovement || ctx.thinkCloseDirection,
          ctx.thinkCloseSelfSeen,
          ctx.thinkCloseTakeaway,
        ]
      : [ctx.thinkCloseTitle, ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen, ctx.thinkCloseTakeaway]
  )
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const awareSelected = Array.isArray(ctx.awarenessSelected) ? ctx.awarenessSelected.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return {
    thinkPicked: v2
      ? thinkSelected.length
        ? thinkSelected.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "尚未寫下。"
      : thinkNone
      ? "使用者勾選了「今天沒有特別符合我的選項」。"
      : thinkSelected.length
        ? thinkSelected.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "尚未勾選。",
    thinkOptions: thinkOptions.length ? thinkOptions.map((item) => `- ${item}`).join("\n") : "（尚無）",
    thinkClose: thinkClose.join("\n") || "尚未整理。",
    awareSelected: awareSelected.join("／") || "",
    line: String(ctx.awarenessLine || "").trim(),
    seen: String(ctx.awarenessSeen || "").trim(),
  };
}

function journalStoryForChoices(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const progress = body.progress && typeof body.progress === "object" ? body.progress : {};
  const avoid = Array.isArray(body.avoid) ? body.avoid : Array.isArray(ctx.avoid) ? ctx.avoid : [];
  const selected = Array.isArray(body.selected) ? body.selected : Array.isArray(ctx.selected) ? ctx.selected : [];
  const none = Boolean(body.none || ctx.none);
  return {
    ctx,
    progress,
    avoid: avoid.map((item) => String(item || "").trim()).filter(Boolean),
    selected: selected.map((item) => String(item || "").trim()).filter(Boolean),
    none,
    story: `日期：${body.date || ""}
連續復盤天數：${progress.streak || 0}

今日感謝：
${formatThanksForPrompt(ctx) || "未寫"}
今日事件：${compactLine(ctx.event || body.text, 800) || "（未寫）"}
心情：${ctx.mood || "未選"}
${formatBodyCheckPrompt(ctx)}`,
  };
}

function choicesUserPrompt(body) {
  const kind = choicesKind(body);
  const { ctx, avoid, selected, none, story } = journalStoryForChoices(body);
  const thinkAware = formatThinkAwarePrompt(ctx);
  if (kind === "think-close") {
    const picked = none
      ? "使用者勾選了「今天沒有特別符合我的選項」。不要硬套未勾選的句子。"
      : selected.length
        ? selected.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "使用者一個選項都沒勾。不要硬套未勾選的句子，改從實際填寫內容找一個較小的觀察。";
    return `請根據下面內容，寫出精短的「今日深度看見」。不要再提問。

【04 勾選】
${picked}

【今天的輸入】
${story}`;
  }
  if (kind === "think") {
    return `請只生成 3 到 4 個「這件事背後，對我真正代表什麼」的選項。寧缺勿濫，不要湊滿 5 個。不要輸出「今天沒有特別符合我的選項」。

這是 04：理解事情更深一層的意義。只根據感謝、事件、心情、身體覺察生成。
不要等待尚未生成的覺察結論。不要寫成「我現在怎麼了／我看見了自己什麼」。

【今天的輸入｜必須據此長出選項】
${story}`;
  }
  if (kind === "execution" || kind === "execution-deep") {
    return execV2.executionChoicesUserPrompt(body);
  }
  const avoidBlock = avoid.length
    ? avoid.map((item) => `- ${item}`).join("\n")
    : "（尚無 04 選項）";
  return `請只生成 3 到 4 個「經過今天這些事情，我看見了自己什麼」的選項。寧缺勿濫，不要湊滿 5 個。不要輸出「今天沒有特別符合我的選項」。

這是 05：看見當下的自己。不要寫成「這件事背後代表什麼」。
禁止改寫下面這些 04 深度思考句子：
${avoidBlock}

【04 深度思考｜可讀，但不要重複】
${
  ctx.thinkVariant === "think-v2"
    ? `核心結論：${ctx.thinkCloseCore || ctx.thinkCloseAwareness || "尚未整理"}
我沒看見的問題：${ctx.thinkCloseBlindSpot || "未寫"}
改善方向：${ctx.thinkCloseImprovement || ctx.thinkCloseDirection || "未寫"}
使用者自己說出的：
${thinkAware.thinkPicked}
不要把「我沒看見的問題」原句當成 05 選項。`
    : `勾選：
${thinkAware.thinkPicked}
選項：
${thinkAware.thinkOptions}
深度看見：
${thinkAware.thinkClose}`
}

【今天的輸入｜必須據此長出選項】
${story}`;
}

function normalizeGeneratedChoiceOptions(raw, kind, avoid) {
  const prefix = kind === "think" ? "t" : "a";
  const list = reviewMerge.normalizeChoiceOptions(raw, { avoid, max: 4 });
  return list.map((item, index) => ({
    id: /^[at]\d+$/.test(item.id) ? item.id : `${prefix}${index + 1}`,
    text: item.text,
  }));
}

function isCorePromptsRequest(body) {
  if (body?.variant === "core" || body?.kind === "core") return true;
  const scope = String(body?.scope || body?.promptKind || "").trim().toLowerCase();
  return scope === "core" || scope === "awareness" || scope === "aware" || scope === "execution" || scope === "exec";
}

function corePromptKind(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const kind = String(body?.promptKind || ctx.promptKind || body?.scope || ctx.scope || "").trim().toLowerCase();
  if (kind === "awareness" || kind === "aware") return "awareness";
  if (kind === "execution" || kind === "exec") return "execution";
  return "core";
}

function corePromptsUserPrompt(body, kind = "core") {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const progress = body.progress && typeof body.progress === "object" ? body.progress : {};
  const thanks = formatThanksForPrompt(ctx) || "未寫";
  const avoid = Array.isArray(progress.avoidQuestions) ? progress.avoidQuestions.filter(Boolean) : [];
  const openActions = Array.isArray(progress.openActions) ? progress.openActions.filter(Boolean) : [];
  const story = `日期：${body.date || ""}
連續復盤天數：${progress.streak || 0}

今日感謝：
${thanks}
今日事件：${compactLine(ctx.event || body.text, 800) || "（未寫）"}
心情：${ctx.mood || "未選"}
${formatBodyCheckPrompt(ctx)}

尚未完成的行動：${openActions.slice(0, 6).map((item) => compactLine(item, 40)).join("、") || "尚無"}

【請避開、不要再出相近的題】
${avoid.length ? avoid.slice(0, 12).map((item) => `- ${compactLine(item, 60)}`).join("\n") : "（無）"}`;
  const today = `【今天的輸入｜必須據此出題】
${story}`;
  if (kind === "awareness") {
    const step = awarenessPromptStep(body);
    const turns = labeledAwarenessTurns(body);
    const lastAnswer = (Array.isArray(body.answers) ? body.answers : []).filter((item) => item === "是" || item === "否").slice(-1)[0] || "";
    const layer =
      step === 1
        ? "現在只出 Q1：看見感受背後的原因。從今天真實事件切入，不要只重述事件。讓他第一次覺得「原來我在意的是這個」。"
        : step === 2
          ? "現在只出 Q2：看見重複的內在模式。必須承接 Q1 與 Q1 的是／否。用「是不是／會不會／是否可能」，不要判定他就是這樣。"
          : "現在只出 Q3：碰到更底層的自己。必須承接 Q1、Q2 與兩次是／否。這一題要讓他停頓幾秒。";
    const branch =
      lastAnswer === "否"
        ? "上一題使用者選了「否」。被否定的假設已經不成立。禁止寫「既然……」「因為你剛才承認……」。必須重新理解：那真正發生的可能是什麼？再從今天其他紀錄另找一條方向。"
        : lastAnswer === "是"
          ? "上一題使用者選了「是」。可以沿著這條覺察路徑再往下一層，但仍用探索語氣，不要把它寫成已經證實的人格結論。"
          : "還沒有上一題答案。只根據今天紀錄出 Q1。";
    return `請只生成目前這一層的 1 道覺察是非題。不要一次出 Q1、Q2、Q3。不要寫執行題，不要總結，不要替他下結論。

這一層：Q${step}
${layer}

【已完成的題與答案｜必須影響這一題】
${turns || "（尚未作答，這是 Q1）"}

【是／否分支】
${branch}

題目必須引用今天真實紀錄的具體線索。禁止任何人都能套用的假深度。生成前先做自我檢查：重述、萬用、沒線索、沒「原來我可能是這樣」、過度下結論，全部重寫。

${today}`;
  }
  if (kind === "execution") {
    return `請只生成 1 道行動問題。不要寫覺察是非題。不要一次出完後面的題。

【今天的輸入｜理解情境，不要把時數或連續天數抄進題目】
${story}
04 深度勾選：${Array.isArray(ctx.thinkSelected) && ctx.thinkSelected.length ? ctx.thinkSelected.join("／") : ctx.thinkNone ? "今天沒有特別符合我的選項" : "未勾"}
深度看見：${[ctx.thinkCloseAwareness, ctx.thinkCloseSelfSeen, ctx.thinkCloseTakeaway].filter(Boolean).join("／") || "未寫"}
核心覺察：${String(ctx.awarenessLine || "").trim() || "未寫"}
我看見了：${String(ctx.awarenessSeen || "").trim() || "未寫"}
今日覺察：${Array.isArray(ctx.awareness) ? ctx.awareness.filter(Boolean).join("／") || "未寫" : "未寫"}
明天最小的一步：${compactLine(ctx.smallestStep, 80) || "未寫"}

既然已經看見這件事，問接下來願意做什麼。不要再重做一次覺察。

合格：你想明天開始多吃菜，但也提到最近睡得比較少。如果明天不要求一次做到很多，最容易開始的一步是什麼？
不合格：身體在求救，你要先休息還是先工作？

placeholder 用具體做法，例如：午餐多加一份青菜／下班後走路10分鐘。`;
  }
  return `請精準讀取以下「今天的原文」，生成只屬於這一天的覺察力目前這一層 1 題、執行力 1 題。

${today}

覺察是非題：只出 1 題。必須引用今天線索，並依已有是／否調整方向。
執行題：只出 1 題，問明天真正想做的那一件。不要二選一，不要分析用語。`;
}

function asPromptList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*]|第?[一二三1-3][、.．)]|[1-3][\.、)])\s*/, "").trim())
      .filter((line) => line.length >= 8);
    return lines.length ? lines : [raw];
  }
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.questions)) return raw.questions;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.prompts)) return raw.prompts;
    if (Array.isArray(raw.statements)) return raw.statements;
    if (raw.question || raw.title || raw.text || raw.prompt || raw.statement) return [raw];
    const values = Object.keys(raw)
      .sort()
      .map((key) => raw[key])
      .filter((item) => typeof item === "string" || (item && typeof item === "object"));
    if (values.length) return values;
  }
  return [];
}

function normalizePromptItem(item) {
  if (typeof item === "string") {
    const question = textIntegrity.finalizeGeneratedQuestion(item, {
      source: "api/review.normalizePromptItem",
      field: "question",
      max: 200,
    });
    return question ? { question, placeholder: "寫下那個時刻…" } : null;
  }
  if (!item || typeof item !== "object") return null;
  const question = textIntegrity.finalizeGeneratedQuestion(
    item.question || item.title || item.text || item.prompt || item.statement || item.label || "",
    { source: "api/review.normalizePromptItem", field: "question", max: 200 }
  );
  if (!question) return null;
  return {
    question,
    placeholder: String(item.placeholder || "寫下那個時刻…").trim().slice(0, 48) || "寫下那個時刻…",
  };
}

function normalizeDeepPromptItem(item) {
  const base = normalizePromptItem(item);
  if (!base) return null;
  const data = item && typeof item === "object" ? item : {};
  const title = textIntegrity.isCompleteSentence(base.question)
    ? base.question
    : textIntegrity.finalizeGeneratedQuestion(base.question, {
        source: "api/review.normalizeDeepPromptItem",
        field: "title",
      });
  if (!title) return null;
  return {
    title,
    plainGuide: String(data.plainGuide || data.plain || "白話想一想：先把場面講清楚。").trim(),
    deepGuide: String(data.deepGuide || data.deep || "深挖一點點：真正被碰到的是哪一層？").trim(),
    placeholderPlain: String(data.placeholderPlain || "那一刻發生了什麼…").trim().slice(0, 36),
    placeholderDeep: String(data.placeholderDeep || "真正觸發我的是…").trim().slice(0, 36),
  };
}

function uniquePromptList(list) {
  const seen = new Set();
  const next = [];
  (list || []).forEach((item) => {
    const question = String(item?.question || "").trim();
    if (!question || seen.has(question)) return;
    seen.add(question);
    next.push(item);
  });
  return next;
}

function awarenessPromptFallbacks(ctx) {
  const eventBit = compactLine(ctx && (ctx.event || ctx.text), 8) || "今天這件事";
  const thanksBit = compactLine(formatThanksForPrompt(ctx), 8);
  return [
    {
      question: thanksBit
        ? `當你寫下「${thanksBit}」時，你特別有感覺，是不是因為『被放在心上』對你來說，比事情本身更重要？`
        : `在「${eventBit}」裡，你特別有感覺的，是不是『被放在心上』這件事，比事情本身更重要？`,
    },
  ];
}

function isBloatedAwarenessQuestion(question) {
  const text = String(question || "").trim();
  if (!text) return true;
  if (text.length > 200) return true;
  if (looksIncompleteAwarenessText(text.replace(/[？?]+$/, ""))) return true;
  if ((text.match(/、/g) || []).length >= 5) return true;
  return false;
}

function padAwarenessPrompts(list, ctx, max = 1) {
  const extras = awarenessPromptFallbacks(ctx);
  const next = uniquePromptList(
    (list || [])
      .map((item) => {
        const question = textIntegrity.finalizeGeneratedQuestion(item?.question, {
          source: "api/review.padAwarenessPrompts",
          field: "question",
          max: 200,
        });
        return question && !isBloatedAwarenessQuestion(question) ? { question } : null;
      })
      .filter(Boolean)
  );
  if (!next.length) {
    if (extras[0] && Number(ctx && ctx.step) <= 1) next.push(extras[0]);
    else {
      next.push({
        question: "當你回頭看今天的選擇時，你是不是更能看見自己真正在意的是什麼？",
      });
    }
  }
  return next.slice(0, Math.max(1, max));
}

function isBloatedExecQuestion(question) {
  const text = String(question || "").trim();
  if (!text) return true;
  if (text.length > 80) return true;
  if ((text.match(/[？?]/g) || []).length > 1) return true;
  return /睡眠只有|\d小時|連續\d|能量從哪裡|先補睡還是|才不會又|待辦清單|突破策略|vs|真因|自我修復|真正卡住|跟自己相處|先從哪一件|深層原因|身體在求救|你已經透支|缺乏自律/.test(text);
}

function executionQuestionFallbacks() {
  return [
    {
      question: "明天你最想開始的，具體是哪一件事？",
      placeholder: "例如：午餐多加一份青菜／下班後走路10分鐘",
    },
    {
      question: "如果明天只能完成一件最重要的事，你最希望完成的是哪一件？",
      placeholder: "例如：先完成報價單第一版／回一封最急的信",
    },
    {
      question: "這件事可以再小一點。你準備什麼時間開始、做到什麼程度就算完成？",
      placeholder: "例如：11:00躺下休息20分鐘／換完衣服後走路10分鐘",
    },
  ];
}

function padExecutionPrompts(list) {
  const fallbacks = executionQuestionFallbacks();
  const cleaned = uniquePromptList(list).map((item, index) => {
    const question = String(item?.question || "").trim();
    if (!isBloatedExecQuestion(question) && textIntegrity.isCompleteSentence(question, { requireQuestion: true })) {
      return {
        question,
        placeholder: String(item?.placeholder || fallbacks[index]?.placeholder || "寫下你準備做的一小步…").slice(0, 48),
      };
    }
    return fallbacks[index] || fallbacks[0];
  });
  const next = uniquePromptList(cleaned);
  if (!next.length) next.push(fallbacks[0]);
  return next.slice(0, 1);
}

function normalizePromptsResult(raw, kind = "core") {
  const wrapped = Array.isArray(raw) ? { awareness: raw, execution: raw } : raw;
  const data = wrapped && typeof wrapped === "object" ? wrapped : {};
  let awareness = uniquePromptList(
    []
      .concat(asPromptList(data.awareness), kind === "awareness" ? asPromptList(data.questions) : [])
      .concat(kind === "awareness" ? asPromptList(data.statements) : [])
      .concat(kind === "awareness" ? asPromptList(data.items) : [])
      .map(normalizePromptItem)
      .filter(Boolean)
  ).slice(0, 3);
  let execution = uniquePromptList(
    []
      .concat(asPromptList(data.execution), kind === "execution" ? asPromptList(data.questions) : [])
      .concat(kind === "execution" ? asPromptList(data.items) : [])
      .map(normalizePromptItem)
      .filter(Boolean)
  ).slice(0, 3);
  const deep = asPromptList(data.deep)
    .map(normalizeDeepPromptItem)
    .filter(Boolean)
    .slice(0, 4);
  return { awareness, execution, deep };
}

async function handleInsightLabRequest(res, body) {
  const action = String((body && body.action) || "run").trim().toLowerCase();
  if (action === "probe") {
    res.status(200).json({
      ok: true,
      lab: true,
      openai: require("../lib/openai").openaiAvailable(),
      fixtures: insightLab.listFixtures(),
    });
    return;
  }
  if (action === "reveal") {
    const revealed = insightLab.revealLab(body && body.seal, body && body.branchSeals);
    if (!revealed) {
      res.status(400).json({ ok: false, error: "無法顯示對照" });
      return;
    }
    res.status(200).json({ ok: true, data: revealed });
    return;
  }
  if (action === "start") {
    const plan = insightLab.planLabExperiment({
      raw: body && body.raw,
      fixtureId: body && body.fixtureId,
    });
    res.status(200).json({
      ok: true,
      data: {
        version: plan.version,
        fingerprint: plan.fingerprint,
        fixtureId: plan.fixtureId,
        slots: plan.slots,
        seal: plan.seal,
      },
    });
    return;
  }
  if (action === "run") {
    const result = await insightLab.runLabSlot({
      seal: body && body.seal,
      slot: body && body.slot,
      continueToken: body && body.continueToken,
    });
    res.status(200).json({
      ok: true,
      data: result.done
        ? {
            slot: result.slot,
            done: true,
            result: result.result,
            branchSeal: result.branchSeal,
          }
        : {
            slot: result.slot,
            done: false,
            continueToken: result.continueToken,
          },
    });
    return;
  }
  res.status(400).json({ ok: false, error: "unknown_action" });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      configured: Boolean(getApiKey()),
      auth: require("../lib/auth").authConfigured(),
      provider: getProvider(),
      usesClaude: usesClaude(),
      model: getModel(),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "只接受 POST" });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const body = readJsonBody(req);
  delete body.user_id;
  delete body.userId;
  delete body.model;
  delete body.internal;
  delete body.forceProvider;
  delete body.provider;
  delete body.pipeline;
  delete body.branch;
  delete body.completedCount;
  delete body.completedRounds;
  delete body.selectedPast;
  delete body.reviews;
  delete body.past;
  delete body.usedPast;
  delete body.historicalContext;
  if (body.context && typeof body.context === "object") {
    delete body.context.completedCount;
    delete body.context.completedRounds;
    delete body.context.user_id;
    delete body.context.userId;
    delete body.context.model;
    delete body.context.internal;
    delete body.context.selectedPast;
    delete body.context.reviews;
    delete body.context.past;
    delete body.context.usedPast;
    delete body.context.serverPast;
    delete body.context.historicalContext;
  }

  let membershipRow = null;
  let internalUser = false;
  if (supabaseAdminConfigured()) {
    try {
      membershipRow = await ensureTrial(user);
      internalUser = isInternal(membershipRow);
    } catch (error) {
      console.error("ensureTrial in review:", error && error.message ? error.message : error);
    }
  }

  if (String(body.mode || "") === "insight-lab") {
    let allowed = internalUser;
    if (!allowed) allowed = await isInternalUser(user.id, user.email);
    if (!allowed) {
      res.status(403).json({ ok: false, error: "internal_required", message: "Insight Lab is internal only." });
      return;
    }
    try {
      await handleInsightLabRequest(res, body);
    } catch (error) {
      const status = Number(error && error.status) || 500;
      const message = String((error && error.message) || "Insight Lab 失敗").slice(0, 180);
      res.status(status).json({ ok: false, error: message });
    }
    return;
  }

  if (String(body.mode || "") === "internal-reset-today") {
    if (!internalUser) {
      res.status(403).json({ ok: false, error: "internal_required", message: "Internal test reset requires an internal account." });
      return;
    }
    const iso = String(body.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      res.status(400).json({ ok: false, error: "invalid_date" });
      return;
    }
    const resetAt = new Date().toISOString();
    let nextReview = null;
    try {
      const { loadReviews, mergeReviews, cloudStoreConfigured } = require("../lib/store");
      const storedMap = cloudStoreConfigured() ? await loadReviews(user.id) : {};
      const stored = storedMap && storedMap[iso] ? storedMap[iso] : null;
      const incoming = body.review && typeof body.review === "object" ? { ...body.review, date: iso, userId: user.id } : null;
      const latest = reviewMerge.pickReview(stored, incoming) || incoming || stored || { date: iso, userId: user.id };
      nextReview = internalTest.applyInternalTodayReset(latest, { resetAt, date: iso, userId: user.id });
      if (cloudStoreConfigured()) {
        await mergeReviews(user.id, { [iso]: { ...nextReview, userId: user.id, date: iso } });
      }
    } catch (error) {
      console.error("internal-reset-today persist:", error && error.message ? error.message : error);
      nextReview = internalTest.applyInternalTodayReset(body.review || { date: iso }, { resetAt, date: iso, userId: user.id });
    }
    res.status(200).json({
      ok: true,
      allowed: true,
      resetAt,
      data: { allowed: true, resetAt, date: iso, review: nextReview },
    });
    return;
  }

  if (reflectionHistory.isHistoryRetrievalRequest(body)) {
    if (!internalUser) {
      res.status(403).json({ ok: false, error: "internal_required", message: "Internal retrieval requires an internal account." });
      return;
    }
    const iso = String(body.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      res.status(400).json({ ok: false, error: "invalid_date" });
      return;
    }
    try {
      const { loadReviews, cloudStoreConfigured } = require("../lib/store");
      const reviews = cloudStoreConfigured() ? await loadReviews(user.id) : {};
      const persisted = reviews && reviews[iso] && reviews[iso].journal && typeof reviews[iso].journal === "object" ? reviews[iso].journal : null;
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const currentJournal =
        ctx.journal && typeof ctx.journal === "object"
          ? ctx.journal
          : persisted || {
              thanksText: ctx.thanksText || ctx.thanks || "",
              event: ctx.event || "",
              mood: ctx.mood || "",
              bodyMind: { text: ctx.bodyMindText || ctx.bodyNote || "" },
              insight: { guide: { coreQuote: ctx.coreQuote || "", questions: ctx.thinkQuestions || ctx.questions || [] } },
            };
      const result = await reflectionHistory.retrieveRelevantHistory({
        reviews,
        currentDate: iso,
        currentJournal,
        currentExtension: ctx.currentExtension || ctx.extension || null,
        callAi: (messages) => callOpenAI(messages, { internal: true, temperature: 0.2, timeoutMs: 20000, maxTokens: 900 }),
      });
      const debug = result.debug || {};
      res.status(200).json({
        ok: true,
        data: {
          currentDate: iso,
          candidateCount: debug.candidateCount || 0,
          stage1Top: Array.isArray(debug.stage1Top) ? debug.stage1Top : [],
          selectedPast: result.selectedPast || [],
          sourceSig: debug.sourceSig || "",
          timings: debug.timings || {},
          payloadBytes: debug.payloadBytes || 0,
          line: reflectionHistory.internalRetrievalLine(result.selectedPast),
        },
      });
    } catch (error) {
      console.error("history-retrieval:", error && error.message ? error.message : error);
      res.status(200).json({
        ok: true,
        data: {
          currentDate: iso,
          candidateCount: 0,
          stage1Top: [],
          selectedPast: [],
          line: reflectionHistory.internalRetrievalLine([]),
        },
      });
    }
    return;
  }

  const allowed = await enforcePlusEntitlement({
    feature: featureForReviewRequest(body),
    res,
    supabaseReady: supabaseAdminConfigured(),
    loadPlan: async () => {
      const row = membershipRow || (await ensureTrial(user));
      return { plan: effectivePlanFromRow(row), isInternal: isInternal(row) };
    },
  });
  if (!allowed) return;

  const origJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && payload.ok === true && internalUser) {
      return origJson({ ...payload, _internalDebug: internalDebugMeta({ internal: true }) });
    }
    return origJson(payload);
  };

  try {
    let round1History = null;
    if (body.mode === "checklist" || body.mode === "prompts" || body.mode === "choices") {
      await attachCloudAwarenessHistory(user, body, {
        userToken: bearerToken(req, body),
        email: user.email || "",
      });
    }
    const mode =
      body.mode === "think"
        ? "think"
        : body.mode === "checklist"
          ? "checklist"
          : body.mode === "insight"
            ? "insight"
            : body.mode === "deepen"
              ? "deepen"
              : body.mode === "prompts"
                ? "prompts"
                : body.mode === "manifest"
                  ? "manifest"
                  : body.mode === "bodycoach"
                    ? "bodycoach"
                    : body.mode === "bodymind"
                      ? "bodymind"
                    : body.mode === "choices"
                      ? "choices"
                      : "organize";
    const text = String(body.text || "").trim();
    if (mode === "checklist") {
      const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
      const selected = Array.isArray(body.selected) ? body.selected.map((item) => String(item || "").trim()).filter(Boolean) : [];
      if (!isAwarenessChoiceClose(body) && answers.filter(Boolean).length < 1 && !selected.length && !body.none) {
        res.status(400).json({ ok: false, error: "請先寫完左側這道核心題" });
        return;
      }
    } else if (mode === "choices") {
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const event = String(ctx.event || text || "").trim();
      const mood = String(ctx.mood || "").trim();
      const thanks = thanksItems(ctx.thanksText || ctx.thanks);
      if (!event || !mood || !thanks.length) {
        res.status(400).json({ ok: false, error: "請先寫下今日感謝、事件，並選擇心情" });
        return;
      }
    } else if (mode === "insight") {
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const event = String(ctx.event || text || "").trim();
      const mood = String(ctx.mood || "").trim();
      if (thinkV2.isThinkV2Request(body) && thinkV2.thinkV2Step(body) === "close") {
        const answered = thinkV2.answeredRounds(ctx.rounds);
        if (answered.length < thinkV2.MIN_ROUNDS) {
          res.status(400).json({ ok: false, error: "請先完成至少一輪深度思考" });
          return;
        }
      } else if (thinkV2.isThinkV2Request(body)) {
        const thanks = thanksItems(ctx.thanksText || ctx.thanks);
        if (!event || !mood || !thanks.length) {
          res.status(400).json({ ok: false, error: "請先寫下今日感謝、事件，並選擇心情" });
          return;
        }
      } else if (reflectionExt.isReflectionExtensionRequest(body)) {
        const quote = String(ctx.coreQuote || ctx.thinkCoreQuote || "").trim();
        const layerQs = Array.isArray(ctx.thinkQuestions) ? ctx.thinkQuestions : Array.isArray(ctx.questions) ? ctx.questions : [];
        if (!quote || layerQs.length < 1) {
          res.status(400).json({ ok: false, error: "請先完成今天的深度思考" });
          return;
        }
        if (reflectionExt.reflectionExtensionStep(body) === "close") {
          const selected = String(ctx.selectedQuestion || ctx.selectedQuestionText || "").trim();
          const answer = String(ctx.answer || "").trim();
          if (!selected || !reflectionExt.answerIsMeaningful(answer)) {
            res.status(400).json({ ok: false, error: "請先選一題並寫下你的回答" });
            return;
          }
        }
        const limit = await enforceExtensionRoundLimit(user, body);
        if (!limit.allowed) {
          res.status(400).json({ ok: false, error: "今天的延伸思考已經完成兩次" });
          return;
        }
      } else if (isThinkGuideRequest(body) && thinkGuideStep(body) === "close") {
        const rounds = Array.isArray(ctx.rounds) ? ctx.rounds : [];
        const answered = rounds.filter((item) => String(item?.question || "").trim() && String(item?.answer || "").trim());
        if (answered.length < 3) {
          res.status(400).json({ ok: false, error: "請先完成三輪深度思考" });
          return;
        }
      } else if (isThinkGuideRequest(body)) {
        const isQuick = String(ctx.journalMode || ctx.mode || "").trim() === "quick";
        if (isQuick) {
          const thanks = thanksItems(ctx.thanksText || ctx.thanks);
          if (!event || !mood || !thanks.length) {
            res.status(400).json({ ok: false, error: "請先寫下今日感謝、事件，並選擇心情" });
            return;
          }
        } else if (!event || !mood || !contextHasBodySignal(ctx)) {
          res.status(400).json({ ok: false, error: "請先寫下今日事件、選擇心情，並標出身體狀況" });
          return;
        }
      } else if (isQuickInsightRequest(body)) {
        const thanks = thanksItems(ctx.thanksText || ctx.thanks);
        if (!event || !mood || !thanks.length) {
          res.status(400).json({ ok: false, error: "請先寫下今日感謝、事件，並選擇心情" });
          return;
        }
      } else {
        if (!event || !mood || !contextHasBodySignal(ctx)) {
          res.status(400).json({ ok: false, error: "請先寫下今日事件、選擇心情，並標出身體狀況" });
          return;
        }
      }
    } else if (mode === "deepen") {
      const plain = String(body.plain || "").trim();
      const deep = String(body.deep || body.note || "").trim();
      if (!plain && !deep) {
        res.status(400).json({ ok: false, error: "請先在這個主題寫下一點回答" });
        return;
      }
    } else if (mode === "prompts") {
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const event = String(ctx.event || text || "").trim();
      const mood = String(ctx.mood || "").trim();
      if (isCorePromptsRequest(body)) {
        const thanks = thanksItems(ctx.thanksText || ctx.thanks);
        if (!event || !mood || !thanks.length) {
          res.status(400).json({ ok: false, error: "請先寫下今日感謝、事件，並選擇心情" });
          return;
        }
      } else {
        const hasBody = (Array.isArray(ctx.bodyTags) && ctx.bodyTags.length) || String(ctx.bodyNote || "").trim();
        if (!event || !mood || !hasBody) {
          res.status(400).json({ ok: false, error: "請先寫下今日事件、選擇心情，並標出身體狀況" });
          return;
        }
      }
    } else if (mode === "manifest") {
      const vision = String(body.vision || text || "").trim();
      if (vision.length < 4) {
        res.status(400).json({ ok: false, error: "請先寫下想顯化的事情" });
        return;
      }
    } else if (!text && mode === "organize" && !Array.isArray(body.messages)) {
      res.status(400).json({ ok: false, error: "缺少復盤原文" });
      return;
    }
    if (text.length > 8000) {
      res.status(400).json({ ok: false, error: "原文太長，請先收成 8000 字以內" });
      return;
    }

    let messages;
    if (Array.isArray(body.messages) && body.messages.length) {
      messages = body.messages;
    } else if (mode === "checklist") {
      const kind = body.kind === "execution" ? "execution" : "awareness";
      const awareChoices = kind === "awareness" && isAwarenessChoiceClose(body);
      messages = [
        { role: "system", content: withCompleteRule(kind === "execution" ? CHECKLIST_EXECUTION_SYSTEM : awareChoices ? CHECKLIST_AWARENESS_CHOICES_SYSTEM : CHECKLIST_AWARENESS_SYSTEM) },
        { role: "user", content: checklistUserPrompt(kind, body) },
      ];
    } else if (mode === "choices") {
      if (awarenessV3.isAwarenessV3CueRequest(body)) {
        messages = [
          { role: "system", content: withCompleteRule(awarenessV3.AWARENESS_V3_CUE_SYSTEM) },
          { role: "user", content: awarenessV3.awarenessV3CueUserPrompt(body) },
        ];
      } else if (awarenessV3.isAwarenessV3Request(body)) {
        messages = [
          { role: "system", content: withCompleteRule(awarenessV3.AWARENESS_V3_SYSTEM) },
          { role: "user", content: awarenessV3.awarenessV3UserPrompt(body) },
        ];
      } else if (executionV3.isExecutionV3Request(body)) {
        messages = [
          { role: "system", content: withCompleteRule(executionV3.EXECUTION_V3_SYSTEM) },
          { role: "user", content: executionV3.executionV3UserPrompt(body) },
        ];
      } else {
      const kind = choicesKind(body);
      if (kind === "execution-deep") {
        const step = execV2.execDeepStep(body);
        const skipAsk =
          step === "ask" &&
          execV2.shouldSkipExecDeepAsk(body.context && body.context.deep, body.context && body.context.actions);
        if (skipAsk) {
          res.status(200).json({
            ok: true,
            source: getProvider(),
            data: { question: "", placeholder: "", readyToClose: true, kind },
          });
          return;
        }
        messages = [
          {
            role: "system",
            content: withCompleteRule(step === "close" ? EXEC_DEEP_CLOSE_SYSTEM : EXEC_DEEP_ASK_SYSTEM),
          },
          {
            role: "user",
            content: step === "close" ? execV2.execCloseUserPrompt(body) : execV2.execDeepUserPrompt(body),
          },
        ];
      } else {
        messages = [
          {
            role: "system",
            content: withCompleteRule(
              kind === "think-close"
                ? THINK_CHOICES_CLOSE_SYSTEM
                : kind === "think"
                  ? CHOICES_THINK_SYSTEM
                  : kind === "execution"
                    ? EXECUTION_CHOICES_SYSTEM
                    : CHOICES_AWARENESS_SYSTEM
            ),
          },
          { role: "user", content: choicesUserPrompt(body) },
        ];
      }
      }
    } else if (mode === "insight") {
      if (reflectionExt.isReflectionExtensionRequest(body)) {
        const close = reflectionExt.reflectionExtensionStep(body) === "close";
        if (!close) {
          stripRound1HistorySpoof(body);
          round1History = await attachRound1RelevantHistory(user, body);
        }
        messages = [
          {
            role: "system",
            content: withCompleteRule(close ? reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM : reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM),
          },
          {
            role: "user",
            content: close ? reflectionExt.reflectionExtensionCloseUserPrompt(body) : reflectionExt.reflectionExtensionAskUserPrompt(body),
          },
        ];
      } else if (reflectionV3.isReflectionV3Request(body)) {
        messages = [
          { role: "system", content: withCompleteRule(reflectionV3.REFLECTION_V3_SYSTEM) },
          { role: "user", content: reflectionV3.reflectionV3UserPrompt(body) },
        ];
      } else if (thinkV2.isThinkV2Request(body)) {
        const close = thinkV2.thinkV2Step(body) === "close";
        messages = [
          { role: "system", content: withCompleteRule(close ? thinkV2.THINK_V2_CLOSE_SYSTEM : thinkV2.THINK_V2_ASK_SYSTEM) },
          { role: "user", content: thinkV2.thinkV2UserPrompt(body) },
        ];
      } else if (isThinkGuideRequest(body)) {
        const close = thinkGuideStep(body) === "close";
        messages = [
          { role: "system", content: withCompleteRule(close ? THINK_GUIDE_CLOSE_SYSTEM : THINK_GUIDE_ASK_SYSTEM) },
          { role: "user", content: thinkGuideUserPrompt(body) },
        ];
      } else {
        messages = [
          { role: "system", content: withCompleteRule(isQuickInsightRequest(body) ? QUICK_INSIGHT_SYSTEM : INSIGHT_SYSTEM) },
          { role: "user", content: insightUserPrompt(body) },
        ];
      }
    } else if (mode === "deepen") {
      messages = [
        { role: "system", content: withCompleteRule(DEEPEN_SYSTEM) },
        { role: "user", content: deepenUserPrompt(body) },
      ];
    } else if (mode === "prompts") {
      const promptKind = isCorePromptsRequest(body) ? corePromptKind(body) : "";
      messages = [
        {
          role: "system",
          content: withCompleteRule(
            promptKind === "awareness"
              ? AWARENESS_PROMPTS_SYSTEM
              : promptKind === "execution"
                ? isExecutionFollowupRequest(body)
                  ? EXECUTION_FOLLOW_SYSTEM
                  : EXECUTION_PROMPTS_SYSTEM
                : isCorePromptsRequest(body)
                  ? CORE_PROMPTS_SYSTEM
                  : PROMPTS_SYSTEM
          ),
        },
        {
          role: "user",
          content: promptKind === "execution" && isExecutionFollowupRequest(body)
            ? executionFollowUserPrompt(body)
            : isCorePromptsRequest(body)
              ? corePromptsUserPrompt(body, promptKind || "core")
              : promptsUserPrompt(body),
        },
      ];
    } else if (mode === "manifest") {
      const prompts = isManifestPromptsRequest(body);
      const close = isManifestCloseRequest(body);
      messages = [
        {
          role: "system",
          content: withCompleteRule(prompts ? MANIFEST_PROMPTS_SYSTEM : close ? MANIFEST_CLOSE_SYSTEM : MANIFEST_PLAN_SYSTEM),
        },
        {
          role: "user",
          content: prompts ? manifestPromptsUserPrompt(body) : close ? manifestCloseUserPrompt(body) : manifestPlanUserPrompt(body),
        },
      ];
    } else if (mode === "bodycoach") {
      messages = [
        { role: "system", content: withCompleteRule(BODY_COACH_SYSTEM) },
        { role: "user", content: bodyCoachUserPrompt(body) },
      ];
    } else if (mode === "bodymind") {
      messages = [
        { role: "system", content: withCompleteRule(bodyMind.BODY_MIND_SYSTEM) },
        { role: "user", content: bodyMind.bodyMindUserPrompt(body) },
      ];
    } else if (mode === "think") {
      const round = Number(body.round) || 1;
      const max = Number(body.max) || 5;
      const actions = Array.isArray(body.actions) ? body.actions : [];
      const reply = String(body.reply || "").trim() || "（沒有額外補充）";
      const organize = body.organize ? JSON.stringify(body.organize) : "";
      messages = [
        { role: "system", content: withCompleteRule(THINK_SYSTEM) },
        {
          role: "user",
          content: `這是第 ${round}/${max} 輪。\n先前整理：\n${organize}\n\n勾選的下一步：\n${actions.length ? actions.map((item) => `- ${item.label}：${item.detail}`).join("\n") : "（尚未勾選）"}\n\n使用者補充：\n${reply}\n\n原始口語：\n${text}`,
        },
      ];
    } else {
      messages = [
        { role: "system", content: withCompleteRule(ORGANIZE_SYSTEM) },
        { role: "user", content: `復盤日期：${body.date || ""}\n\n口語原文：\n${text}` },
      ];
    }

    const promptKind = isCorePromptsRequest(body) ? corePromptKind(body) : "";
    const choiceKind = mode === "choices" ? choicesKind(body) : "";
    const awareMode =
      (mode === "prompts" && promptKind === "awareness") ||
      (mode === "checklist" && body.kind !== "execution") ||
      (mode === "choices" && choiceKind !== "think-close" && choiceKind !== "execution" && choiceKind !== "execution-deep");
    const aiOpts = {
      internal: internalUser,
      effort:
        internalUser &&
        mode === "insight" &&
        (thinkV2.isThinkV2Request(body) ||
          reflectionV3.isReflectionV3Request(body) ||
          reflectionExt.isReflectionExtensionRequest(body))
          ? "high"
          : undefined,
      temperature:
        mode === "insight" && reflectionExt.isReflectionExtensionRequest(body)
          ? 0.45
        : mode === "insight" && reflectionV3.isReflectionV3Request(body)
          ? 0.45
        : mode === "choices" && (awarenessV3.isAwarenessV3CueRequest(body) || awarenessV3.isAwarenessV3Request(body) || executionV3.isExecutionV3Request(body))
          ? 0.45
        : mode === "insight" && thinkV2.isThinkV2Request(body)
          ? thinkV2.thinkV2Step(body) === "close"
            ? 0.4
            : 0.55
        : mode === "insight" && isThinkGuideRequest(body)
          ? thinkGuideStep(body) === "close"
            ? 0.4
            : 0.55
        : mode === "choices" && choiceKind === "think-close"
          ? 0.4
          : mode === "choices"
            ? 0.55
        : mode === "bodycoach" || mode === "bodymind"
          ? 0.45
          : mode === "manifest"
            ? 0.45
          : mode === "prompts" && promptKind === "execution"
            ? 0.35
            : mode === "checklist" && body.kind === "execution"
              ? 0.35
              : mode === "checklist"
                ? 0.5
              : mode === "prompts"
                ? 0.7
                : 0.75,
      timeoutMs: internalUser ? 55000 : promptKind === "awareness" || mode === "choices" ? 20000 : 22000,
      rejectPartial: true,
      maxTokens:
        mode === "bodycoach"
          ? 640
          : mode === "bodymind"
            ? 500
          : mode === "choices" && awarenessV3.isAwarenessV3CueRequest(body)
            ? 280
          : mode === "choices" && choiceKind === "think-close"
            ? 900
          : mode === "choices" && (choiceKind === "execution" || choiceKind === "execution-deep")
            ? 900
          : mode === "choices"
            ? 700
          : mode === "insight" && reflectionExt.isReflectionExtensionRequest(body)
            ? reflectionExt.reflectionExtensionStep(body) === "close"
              ? 400
              : 800
          : mode === "insight" && reflectionV3.isReflectionV3Request(body)
            ? 900
          : mode === "choices" && (awarenessV3.isAwarenessV3Request(body) || executionV3.isExecutionV3Request(body))
            ? 800
          : mode === "insight" && thinkV2.isThinkV2Request(body)
          ? thinkV2.thinkV2Step(body) === "close"
            ? 900
            : 800
          : mode === "insight" && isThinkGuideRequest(body)
          ? thinkGuideStep(body) === "close"
            ? 900
            : 640
          : mode === "prompts" && promptKind === "awareness"
            ? 700
          : mode === "prompts" && promptKind === "execution"
              ? 800
              : mode === "prompts" && isCorePromptsRequest(body)
                ? 1000
                : mode === "manifest"
                  ? isManifestPromptsRequest(body)
                    ? 640
                    : 900
                : mode === "checklist"
                  ? body.kind === "execution"
                    ? 900
                    : isAwarenessChoiceClose(body)
                      ? 700
                      : 1800
                  : 1600,
    };
    if (mode === "bodymind") {
      const ctx = {
        ...(body.context && typeof body.context === "object" ? body.context : {}),
        text,
        bodyMindText: (body.context && body.context.bodyMindText) || text,
      };
      const callAi = (msgs, stage) =>
        callOpenAI(msgs, {
          ...aiOpts,
          timeoutMs: internalUser ? 20000 : Math.min(Number(aiOpts.timeoutMs) || 16000, 16000),
          maxTokens: stage === "write" ? 400 : stage === "challenge" ? 700 : 900,
        });
      const seen = await bodyMindSee.runSeePipeline({ callAi, ctx, skipWriterIfReadable: true });
      res.status(200).json({
        ok: true,
        source: getProvider(),
        data: bodyMindSee.projectSeeOutput(seen),
        ...(internalUser ? { _internalReason: seen.meta || {} } : {}),
      });
      return;
    }
    if (mode === "insight" && thinkV2.isThinkV2Request(body) && thinkV2.shouldSkipThinkV2Ask(body)) {
      const skipped = thinkV2.normalizeThinkV2Ask({ readyToClose: true, question: "", unknown: "", unknownWouldChangeCore: false }, body);
      res.status(200).json({ ok: true, source: "local-stop", data: skipped });
      return;
    }
    const reasonPipeline =
      mode === "insight" &&
      (reflectionV3.isReflectionV3Request(body) ||
        (reflectionExt.isReflectionExtensionRequest(body) && reflectionExt.reflectionExtensionStep(body) !== "close"));
    if (reasonPipeline) {
      const kind = reflectionExt.isReflectionExtensionRequest(body) ? "extension" : "layer";
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const callAi = (msgs, stage) =>
        callOpenAI(msgs, {
          ...aiOpts,
          timeoutMs: internalUser ? 26000 : Math.min(Number(aiOpts.timeoutMs) || 22000, 22000),
          maxTokens: stage === "write" ? 800 : 1600,
          _retried: stage === "reason-retry",
        });
      if (kind === "layer") {
        stripRound1HistorySpoof(body);
        const step = insightUnderstand.understandStep(body);
        let understandHistory = { retrieved: [], used: [], timings: {} };
        if (step === "open") understandHistory = await attachUnderstandHistory(user, body);
        const understood = await insightUnderstand.runUnderstandPipeline({
          callAi,
          ctx,
          step,
          prior: ctx.understand || ctx.priorUnderstand || null,
          usedPast: step === "open" ? understandHistory.used : null,
        });
        const result = {
          status: understood.status || "silence",
          understand: understood.understand || null,
          discovery: understood.discovery || null,
          knownByUser: understood.knownByUser || [],
          coreQuote: understood.coreQuote || "",
          questions: understood.questions || [],
          sourceSig: understood.sourceSig || reflectionV3.reflectionV3SourceSig(ctx),
        };
        res.status(200).json({
          ok: true,
          source: getProvider(),
          data: result,
          ...(internalUser
            ? {
                _internalReason: understood.meta || {},
                ...(understandHistory.used && understandHistory.used.length
                  ? {
                      _internalRetrieval: {
                        count: (understandHistory.retrieved || []).length,
                        usedCount: (understandHistory.used || []).length,
                        references: understandHistory.used,
                        timings: understandHistory.timings || {},
                      },
                    }
                  : {}),
              }
            : {}),
        });
        return;
      }
      const pipeline = await insightReason.runReasonWritePipeline({
        callAi,
        ctx,
        kind,
        reasonMessages: [
          { role: "system", content: withCompleteRule(insightReason.REASONING_SYSTEM) },
          { role: "user", content: insightReason.reasoningUserPrompt(body, kind) },
        ],
        writeSystem: withCompleteRule(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM),
      });
      const meta = pipeline.meta || {};
      const retrieval = round1History && round1History.retrieval ? round1History.retrieval : { sourceSig: "", selectedPast: [] };
      if (pipeline.empty) {
        res.status(502).json({ ok: false, error: "延伸深度思考還沒整理好，請再試一次" });
        return;
      }
      const asked = reflectionExt.normalizeExtensionAskResult(pipeline.written);
      const gatedAsk = require("../lib/insight-value-gate").gateItems(asked.questions, ctx, "insight");
      asked.questions = gatedAsk.kept;
      if (!asked.questions.length) {
        res.status(502).json({ ok: false, error: "延伸深度思考還沒整理好，請再試一次" });
        return;
      }
      res.status(200).json({
        ok: true,
        source: getProvider(),
        data: { ...asked, retrieval },
        ...(internalUser && round1History
          ? {
              _internalRetrieval: {
                count: (round1History.retrieved || []).length,
                usedCount: (round1History.used || []).length,
                references: retrieval.selectedPast || [],
                timings: round1History.timings || {},
                line: reflectionExt.formatInternalRetrievalLine({
                  retrieved: round1History.retrieved,
                  used: round1History.used,
                  retrievedCount: (round1History.retrieved || []).length,
                  usedCount: (round1History.used || []).length,
                }),
              },
              _internalReason: meta,
            }
          : internalUser
            ? { _internalReason: meta }
            : {}),
      });
      return;
    }
    if (
      mode === "choices" &&
      awarenessV3.isAwarenessV3Request(body) &&
      !awarenessV3.isAwarenessV3CueRequest(body) &&
      insightGrow.shouldRunGrow(body.context)
    ) {
      const callAi = (msgs, stage) =>
        callOpenAI(msgs, {
          ...aiOpts,
          timeoutMs: internalUser ? 26000 : Math.min(Number(aiOpts.timeoutMs) || 22000, 22000),
          maxTokens: stage === "write" ? 700 : 1200,
        });
      const grown = await insightGrow.runGrowPipeline({ callAi, ctx: body.context || {} });
      res.status(200).json({
        ok: true,
        source: getProvider(),
        data: grown,
        ...(internalUser ? { _internalReason: grown.meta || {} } : {}),
      });
      return;
    }
    let data;
    try {
      data = await callOpenAI(messages, aiOpts);
    } catch (error) {
      if (!awareMode) throw error;
      data = await callOpenAI(messages, { ...aiOpts, _retried: true });
    }
    if (mode === "choices") {
      if (awarenessV3.isAwarenessV3CueRequest(body)) {
        const result = awarenessV3.normalizeObservationCueResult(data, body.context || {});
        const judged = awarenessV3.evaluateObservationCueQuality(result.text, {
          context: body.context || {},
          selected: body.context && body.context.selectedAwareness,
          unselected: body.context && body.context.unselectedAwareness,
        });
        if (!result.text || !judged.accept) {
          res.status(502).json({ ok: false, error: "這句觀察還沒整理好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: { text: judged.text || result.text } });
        return;
      }
      if (awarenessV3.isAwarenessV3Request(body)) {
        let gated = awarenessV3.gateAwarenessV3Result(data, body.context || {});
        if (!gated.items || gated.items.length < 2) {
          try {
            data = await callOpenAI(
              messages.concat([
                { role: "assistant", content: JSON.stringify({ items: Array.isArray(data && data.items) ? data.items : data }) },
                { role: "user", content: awarenessV3.awarenessV3ValueGateRetryPrompt(gated.dropped) },
              ]),
              { ...aiOpts, _retried: true }
            );
            gated = awarenessV3.gateAwarenessV3Result(data, body.context || {});
          } catch (error) {
            console.warn("[awareness-v3]", { failureStage: "value-gate-retry", error: String(error && error.message || error) });
          }
        }
        const result = { items: gated.items, sourceSig: gated.sourceSig };
        if (!result.items || result.items.length < 2) {
          console.warn("[awareness-v3]", {
            failureStage: "value-gate",
            itemCount: Array.isArray(result.items) ? result.items.length : 0,
            dropped: Array.isArray(gated.dropped) ? gated.dropped.length : 0,
            model: getModel({ internal: internalUser }),
          });
          res.status(502).json({ ok: false, error: "今天的覺察還沒整理好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: result });
        return;
      }
      if (executionV3.isExecutionV3Request(body)) {
        const result = executionV3.normalizeExecutionV3Result(data, body.context || {});
        if (!result.actions || result.actions.length < 3) {
          res.status(502).json({ ok: false, error: "今天的下一步還沒整理好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: result });
        return;
      }
      const kind = choicesKind(body);
      if (kind === "think-close") {
        const closed = normalizeThinkGuideClose(data);
        if (!closed.summary && !closed.awareness) {
          res.status(502).json({ ok: false, error: "今日深度看見還沒整理好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: closed });
        return;
      }
      if (kind === "execution-deep") {
        const step = execV2.execDeepStep(body);
        if (step === "close") {
          const options = reviewMerge.normalizeExecutionChoiceOptions
            ? reviewMerge.normalizeExecutionChoiceOptions(data.options || data, { max: 3 })
            : [];
          const executionSummary = execV2.normalizeExecutionSummary
            ? execV2.normalizeExecutionSummary(data.executionSummary || data.summary)
            : String(data.executionSummary || "").trim();
          if (options.length < 3 || !executionSummary) {
            res.status(502).json({ ok: false, error: "今天的執行力還沒整理好，請再試一次" });
            return;
          }
          res.status(200).json({
            ok: true,
            source: getProvider(),
            data: { executionSummary, options: options.slice(0, 3).map((item, index) => ({ ...item, id: `f${index + 1}` })), kind },
          });
          return;
        }
        const question = String(data.question || "").trim();
        const readyToClose = Boolean(data.readyToClose) || !question;
        res.status(200).json({
          ok: true,
          source: getProvider(),
          data: {
            question,
            placeholder: String(data.placeholder || "").trim(),
            readyToClose,
            kind,
          },
        });
        return;
      }
      if (kind === "execution") {
        const options = reviewMerge.normalizeExecutionChoiceOptions
          ? reviewMerge.normalizeExecutionChoiceOptions(data, { max: 3 })
          : [];
        if (options.length < 1) {
          res.status(502).json({ ok: false, error: "今天的行動選項還沒準備好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: { options: options.slice(0, 3), needFollowup: false, kind } });
        return;
      }
      const avoid = Array.isArray(body.avoid) ? body.avoid : Array.isArray(body.context?.avoid) ? body.context.avoid : [];
      const options = normalizeGeneratedChoiceOptions(data, kind, avoid);
      if (options.length < 3) {
        res.status(502).json({ ok: false, error: kind === "think" ? "今天的深度選項還沒準備好，請再試一次" : "今天的覺察選項還沒準備好，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: getProvider(), data: { options: options.slice(0, 4), kind } });
      return;
    }
    if (mode === "checklist") {
      const kind = body.kind === "execution" ? "execution" : "awareness";
      if (kind === "awareness") {
        const compact = isAwarenessChoiceClose(body);
        let result = compact ? normalizeCompactAwarenessResult(data) : normalizeAwarenessResult(data, body.progress);
        const incomplete = compact
          ? !result.line || !result.seen || looksIncompleteAwarenessText(result.seen)
          : !result.seen || looksIncompleteAwarenessText(result.seen);
        if (incomplete) {
          data = await callOpenAI(messages, { ...aiOpts, _retried: true });
          result = compact ? normalizeCompactAwarenessResult(data) : normalizeAwarenessResult(data, body.progress);
        }
        const stillIncomplete = compact
          ? !result.line || !result.seen || looksIncompleteAwarenessText(result.seen)
          : !result.seen || looksIncompleteAwarenessText(result.seen);
        if (stillIncomplete) {
          res.status(502).json({ ok: false, error: "這次覺察沒有完整生成，請再試一次。" });
          return;
        }
        const quotes = result.line
          ? [result.line]
          : normalizeAwarenessQuotes([result.seen]);
        res.status(200).json({ ok: true, source: getProvider(), data: { result, quotes, items: quotes, kind } });
        return;
      }
      const min = 1;
      const smallestStep = String(body.context?.smallestStep || "").trim();
      const keepFull = Boolean(body.choiceMode) && Boolean(smallestStep);
      const max = keepFull ? 1 : 3;
      const items = normalizeExecutionChecklistItems(data, min, max, smallestStep, { keepFull });
      if (items.length < min) {
        res.status(502).json({ ok: false, error: "今天的行動卡還沒整理好，請再試一次" });
        return;
      }
      const focusSource = data && typeof data === "object" ? data.focus || data.priority || items[0] : items[0];
      const focus = rewriteExecFocus(focusSource, items, smallestStep, body.context, { keepFull });
      res.status(200).json({ ok: true, source: getProvider(), data: { items: items.slice(0, max), focus, kind } });
      return;
    }
    if (mode === "insight") {
      if (reflectionExt.isReflectionExtensionRequest(body)) {
        if (reflectionExt.reflectionExtensionStep(body) === "close") {
          const closed = reflectionExt.normalizeExtensionCloseResult(data);
          if (!closed.deepConclusion) {
            res.status(502).json({ ok: false, error: "這次的深度結論還沒整理好，請再試一次" });
            return;
          }
          res.status(200).json({ ok: true, source: getProvider(), data: closed });
          return;
        }
        const asked = reflectionExt.normalizeExtensionAskResult(data);
        if (asked.questions.length < 3) {
          res.status(502).json({ ok: false, error: "延伸深度思考還沒整理好，請再試一次" });
          return;
        }
        const retrieval = round1History && round1History.retrieval ? round1History.retrieval : { sourceSig: "", selectedPast: [] };
        res.status(200).json({
          ok: true,
          source: getProvider(),
          data: { ...asked, retrieval },
          ...(internalUser && round1History
            ? {
                _internalRetrieval: {
                  count: (round1History.retrieved || []).length,
                  usedCount: (round1History.used || []).length,
                  references: retrieval.selectedPast || [],
                  timings: round1History.timings || {},
                  line: reflectionExt.formatInternalRetrievalLine({
                    retrieved: round1History.retrieved,
                    used: round1History.used,
                    retrievedCount: (round1History.retrieved || []).length,
                    usedCount: (round1History.used || []).length,
                  }),
                },
              }
            : {}),
        });
        return;
      }
      if (reflectionV3.isReflectionV3Request(body)) {
        let gated = reflectionV3.gateReflectionV3Result(data, body.context || {});
        if (!gated.coreQuote || gated.questions.length < 2) {
          try {
            data = await callOpenAI(
              messages.concat([
                {
                  role: "assistant",
                  content: JSON.stringify({
                    coreQuote: gated.coreQuote,
                    items: Array.isArray(data && data.items) ? data.items : data && data.questions ? data.questions : [],
                  }),
                },
                { role: "user", content: reflectionV3.reflectionV3ValueGateRetryPrompt(gated.dropped) },
              ]),
              { ...aiOpts, _retried: true }
            );
            gated = reflectionV3.gateReflectionV3Result(data, body.context || {});
          } catch (error) {
            console.warn("[reflection-v3]", { failureStage: "value-gate-retry", error: String(error && error.message || error) });
          }
        }
        const result = {
          coreQuote: gated.coreQuote,
          questions: gated.questions,
          sourceSig: gated.sourceSig,
        };
        if (!result.coreQuote || result.questions.length < 2) {
          res.status(502).json({ ok: false, error: "今天的深度思考還沒整理好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: result });
        return;
      }
      if (thinkV2.isThinkV2Request(body)) {
        if (thinkV2.thinkV2Step(body) === "close") {
          const closed = thinkV2.normalizeThinkV2Close(data, body);
          if (!closed.stuck && !closed.seen && !closed.coreConclusion) {
            res.status(502).json({ ok: false, error: "深度思考收束還沒整理好，請再試一次" });
            return;
          }
          res.status(200).json({ ok: true, source: getProvider(), data: closed });
          return;
        }
        const asked = thinkV2.normalizeThinkV2Ask(data, body);
        if (!asked.question && !asked.readyToClose) {
          res.status(502).json({ ok: false, error: "深度思考提問格式不完整，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: asked });
        return;
      }
      if (isThinkGuideRequest(body)) {
        if (thinkGuideStep(body) === "close") {
          const closed = normalizeThinkGuideClose(data);
          if (!closed.summary && !closed.awareness) {
            res.status(502).json({ ok: false, error: "今日覺察總結還沒整理好，請再試一次" });
            return;
          }
          res.status(200).json({ ok: true, source: getProvider(), data: closed });
          return;
        }
        const asked = normalizeThinkGuideAsk(data, body.context);
        if (!asked.question) {
          res.status(502).json({ ok: false, error: "深度思考提問格式不完整，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: asked });
        return;
      }
      const insight = normalizeInsightResult(data);
      if (!insight.conclusion && !insight.psychology) {
        res.status(502).json({ ok: false, error: "深度思考格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: getProvider(), data: insight });
      return;
    }
    if (mode === "deepen") {
      const questions = normalizeDeepenQuestions(data);
      if (questions.length < 3) {
        res.status(502).json({ ok: false, error: "AI 延伸提問格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: getProvider(), data: { questions } });
      return;
    }
    if (mode === "prompts") {
      const kind = isCorePromptsRequest(body) ? corePromptKind(body) : "";
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const prompts = normalizePromptsResult(data, kind || "core");
      if (kind === "awareness") {
        let awareness = padAwarenessPrompts(prompts.awareness, { ...ctx, text: body.text, step: awarenessPromptStep(body) }, 1);
        if (!awareness[0]?.question || looksIncompleteAwarenessText(String(awareness[0].question).replace(/[？?]+$/, ""))) {
          data = await callOpenAI(messages, { ...aiOpts, _retried: true });
          const retried = normalizePromptsResult(data, "awareness");
          awareness = padAwarenessPrompts(retried.awareness, { ...ctx, text: body.text, step: awarenessPromptStep(body) }, 1);
        }
        if (!awareness[0]?.question || looksIncompleteAwarenessText(String(awareness[0].question).replace(/[？?]+$/, ""))) {
          res.status(502).json({ ok: false, error: "這次覺察沒有完整生成，請再試一次。" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: { awareness: awareness.slice(0, 1), execution: [] } });
        return;
      }
      if (isCorePromptsRequest(body)) {
        if (kind === "execution") {
          const execution = padExecutionPrompts(prompts.execution);
          if (prompts.execution.length < 1) {
            res.status(502).json({ ok: false, error: "今天的執行題還沒準備好，請再試一次" });
            return;
          }
          res.status(200).json({ ok: true, source: getProvider(), data: { awareness: [], execution } });
          return;
        }
        if (prompts.awareness.length < 1) {
          res.status(502).json({ ok: false, error: "今天的覺察題還沒準備好，請再試一次" });
          return;
        }
        prompts.awareness = padAwarenessPrompts(prompts.awareness, { ...ctx, text: body.text, step: awarenessPromptStep(body) }, 1);
        prompts.execution = padExecutionPrompts(prompts.execution);
      } else if (prompts.deep.length < 4) {
        res.status(502).json({ ok: false, error: "AI 題目格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: getProvider(), data: prompts });
      return;
    }
    if (mode === "manifest") {
      const vision = String(body.vision || body.text || "").trim();
      if (isManifestPromptsRequest(body)) {
        const questions = normalizeManifestPromptItems(data, vision);
        if (questions.length < 1) {
          res.status(502).json({ ok: false, error: "今天的顯化思考題還沒準備好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: { questions, kind: "manifest" } });
        return;
      }
      if (isManifestCloseRequest(body)) {
        const close = normalizeManifestClose(data, vision);
        if (!hasManifestCloseContent(close)) {
          res.status(502).json({ ok: false, error: "正在靠近的生活還沒整理好，請再試一次" });
          return;
        }
        res.status(200).json({
          ok: true,
          source: getProvider(),
          data: {
            ...close,
            sentence: close.manifestationStatement,
            highlights: {
              sentence: insightHighlight.fieldHighlights(data.highlights, "sentence"),
            },
            kind: "manifest",
          },
        });
        return;
      }
      const steps = normalizeManifestPlanSteps(data, vision);
      if (!hasManifestPlanSteps(steps)) {
        res.status(502).json({ ok: false, error: "可以做到的步驟還沒整理好，請再試一次" });
        return;
      }
      res.status(200).json({
        ok: true,
        source: getProvider(),
        data: { steps, kind: "manifest" },
      });
      return;
    }
    if (mode === "bodycoach") {
      const coach = normalizeBodyCoachResult(data, body.context);
      if (!(coach.title || coach.analysis) || coach.suggestions.length < 1) {
        res.status(502).json({ ok: false, error: "今天的身心建議還沒整理好，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: getProvider(), data: coach });
      return;
    }
    if (mode === "bodymind") {
      const result = bodyMindSee.projectSeeOutput(bodyMind.normalizeBodyMindInsight(data));
      res.status(200).json({ ok: true, source: getProvider(), data: result });
      return;
    }
    res.status(200).json({ ok: true, source: getProvider(), data });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? (usesClaude() ? "Claude 逾時" : "OpenAI 逾時") : String(error.message || "伺服器錯誤"),
    });
  }
};

module.exports.normalizeAwarenessResult = normalizeAwarenessResult;
module.exports.awarenessPromptFallbacks = awarenessPromptFallbacks;
module.exports.formatRecentAwarenessDays = formatRecentAwarenessDays;
module.exports.normalizeBodyCoachResult = normalizeBodyCoachResult;
module.exports.BODY_COACH_SYSTEM = BODY_COACH_SYSTEM;
module.exports.BODY_MIND_SYSTEM = bodyMind.BODY_MIND_SYSTEM;
module.exports.bodyCoachUserPrompt = bodyCoachUserPrompt;
module.exports.rewriteExecFocus = rewriteExecFocus;
module.exports.normalizeExecutionChecklistItems = normalizeExecutionChecklistItems;
module.exports.looksIncompleteAwarenessText = looksIncompleteAwarenessText;
module.exports.finishAwarenessBlock = finishAwarenessBlock;
module.exports.normalizeAwarenessLine = normalizeAwarenessLine;
module.exports.isCompactAwarenessResult = isCompactAwarenessResult;
module.exports.normalizeCompactAwarenessResult = normalizeCompactAwarenessResult;
module.exports.CHECKLIST_AWARENESS_CHOICES_SYSTEM = CHECKLIST_AWARENESS_CHOICES_SYSTEM;
module.exports.normalizeThinkTakeaway = normalizeThinkTakeaway;
module.exports.normalizeThinkGuideClose = normalizeThinkGuideClose;
module.exports.normalizeInsightResult = normalizeInsightResult;
module.exports.normalizeManifestSentence = normalizeManifestSentence;
module.exports.padAwarenessPrompts = padAwarenessPrompts;
module.exports.awarenessPromptStep = awarenessPromptStep;
module.exports.labeledAwarenessTurns = labeledAwarenessTurns;
module.exports.normalizeGeneratedChoiceOptions = normalizeGeneratedChoiceOptions;
module.exports.choicesKind = choicesKind;
module.exports.CHOICES_AWARENESS_SYSTEM = CHOICES_AWARENESS_SYSTEM;
module.exports.CHOICES_THINK_SYSTEM = CHOICES_THINK_SYSTEM;
module.exports.THINK_CHOICES_CLOSE_SYSTEM = THINK_CHOICES_CLOSE_SYSTEM;
module.exports.THINK_V2_ASK_SYSTEM = thinkV2.THINK_V2_ASK_SYSTEM;
module.exports.THINK_V2_CLOSE_SYSTEM = thinkV2.THINK_V2_CLOSE_SYSTEM;
module.exports.REFLECTION_V3_SYSTEM = reflectionV3.REFLECTION_V3_SYSTEM;
module.exports.AWARENESS_V3_SYSTEM = awarenessV3.AWARENESS_V3_SYSTEM;
module.exports.AWARENESS_V3_CUE_SYSTEM = awarenessV3.AWARENESS_V3_CUE_SYSTEM;
module.exports.EXECUTION_V3_SYSTEM = executionV3.EXECUTION_V3_SYSTEM;
module.exports.choicesUserPrompt = choicesUserPrompt;
module.exports.EXECUTION_CHOICES_SYSTEM = EXECUTION_CHOICES_SYSTEM;
module.exports.EXECUTION_PROMPTS_SYSTEM = EXECUTION_PROMPTS_SYSTEM;
module.exports.EXEC_DEEP_ASK_SYSTEM = EXEC_DEEP_ASK_SYSTEM;
module.exports.EXEC_DEEP_CLOSE_SYSTEM = EXEC_DEEP_CLOSE_SYSTEM;
module.exports.EXEC_DEEP_REFRESH_SYSTEM = EXEC_DEEP_REFRESH_SYSTEM;
module.exports.MANIFEST_PROMPTS_SYSTEM = MANIFEST_PROMPTS_SYSTEM;
module.exports.MANIFEST_PATHS_SYSTEM = MANIFEST_PATHS_SYSTEM;
module.exports.MANIFEST_CLOSE_SYSTEM = MANIFEST_CLOSE_SYSTEM;
module.exports.MANIFEST_PLAN_SYSTEM = MANIFEST_PLAN_SYSTEM;
module.exports.normalizeManifestClose = normalizeManifestClose;
module.exports.normalizeManifestPlanSteps = normalizeManifestPlanSteps;
