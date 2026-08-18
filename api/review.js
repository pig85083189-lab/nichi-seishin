function chatCompletionsUrl() {
  const raw = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim() || "https://api.openai.com/v1";
  const base = raw.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function parseAiJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("OpenAI 回傳不是 JSON");
  return JSON.parse(candidate.slice(start, end + 1));
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

const { requireUser } = require("../lib/auth");
const { ensureTrial, isEntitled, supabaseAdminConfigured } = require("../lib/supabase");

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
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

const CHECKLIST_AWARENESS_SYSTEM = `你是「日精進」的高階心靈教練與諮詢師。使用者剛完成今天專屬的 6 道自我覺察是非題（題目依他今日的感謝、事件與心情動態生成）。

請根據這 6 題的「是／否」作答，以及今天的狀態，精準煉結成一句「核心重點金句」：一段充滿深度、療癒、能引導覺察的深刻話語。讓他一看就能沈澱下來，看見真正被碰到的那一層。

規則：
- 只輸出 JSON：{"quote":"..."}
- quote 必須剛好 1 句，可含逗號或頓號，但不要拆成多段、不要條列、不要解釋
- 28-52 字，直擊今天真正被碰到的核心
- 要讀懂「是」與「否」的組合：同意的題顯示他看見了什麼，否定的題顯示他還在保護或還沒準備好的地方
- 必須貼近他今天的事件與作答，讓他認出「這是在說我今天」
- 禁止長篇大論、禁止條列雜訊、禁止編號、禁止雞湯口號、禁止說教、禁止病例腔、禁止空泛「要愛自己」
- 繁體中文`;

const CHECKLIST_MANIFEST_SYSTEM = `你是「日精進」的高階心靈教練。使用者剛寫下明天想顯化的願景或目標。
請把這句心念拆成具體、明天做得到的執行目標，讓他能用行動去靠近它。

規則：
- 只輸出 JSON：{"items":["..."]}
- items 必須 3 到 5 條，不可少於 3、不可超過 5
- 每一條 12-28 字，是可勾選的具體步驟，不要口號、不要空泛「相信宇宙」
- 步驟要小、可執行、貼近這個人今天的事件與心情
- 禁止雞湯、禁止說教、禁止病例腔
- 繁體中文`;

function manifestUserPrompt(body) {
  const vision = String(body.vision || body.text || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const bodyTags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
  const openActions = Array.isArray(ctx.openActions) ? ctx.openActions.filter(Boolean) : [];
  return `請把這個顯化願景拆成 3 到 5 個明天做得到的執行步驟。

明天想顯化的事情：${vision || "（未寫）"}
今日事件：${ctx.event || "未寫"}
心情：${ctx.mood || "未選"}
身體狀態：${bodyTags || "未選"}
尚未完成的行動：${openActions.slice(0, 6).join("、") || "尚無"}`;
}

const CHECKLIST_EXECUTION_SYSTEM = `你是「日精進」的高階心靈教練。使用者剛回答今天專屬的三道執行力問題（題目會依他今日的感謝、事件、情緒波動或卡點動態生成）。
請依這三題的深度回答，整理成「行動卡點／解法」勾選清單。勾選後會進入他的個人行動清單。

規則：
- 只輸出 JSON：{"items":[{"title":"...","detail":"..."}]}
- items 必須 3 到 4 條，不可少於 3、不可超過 4
- title：4-12 字，核心行動名稱。不要編號、不要句號
- detail：18-36 字，作為「引言／具體作法說明」。用溫暖、具體、好執行的口吻告訴他這件事「怎麼做會比較好」，不要只重複 title
- 至少 2 條是明天做得到的最小解法（具體動作），其餘可以是真正卡住的點
- 必須貼近他剛寫的回答與今日事件，不要重複他已經列在「尚未完成的行動」裡的句子
- 禁止固定題庫口吻（例如只寫「任務太大」「害怕被看見」「先做 5 分鐘」這種萬用句）
- 禁止空泛激勵、禁止「你要更努力」
- 繁體中文`;

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
請根據事件、情緒與身體反應，生成一份結構完整、有深度的「深度洞察」。禁止只給一句空泛金句。

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
請生成一份結構完整、有深度的「深度洞察」。即使是快速復盤，也禁止只給一句話。

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
    return `這是快速復盤。請生成包含四個完整維度的深度洞察：① 今天的身心訊號 ② 客觀檢討與反思 ③ 具體突破建議（怎麼做會更好） ④ 今日核心重點整理。
今天加選的模組：${modules.length ? modules.join("、") : "無（只寫感謝、事件與心情）"}

今日感謝：${thanks || "（未寫）"}
今日事件：${ctx.event || body.text || "（未寫）"}
心情：${ctx.mood || "未選"}
${extras.join("\n")}`.trim();
  }
  return `請為這個人生成包含四個完整維度的深度洞察：① 今天的身心訊號 ② 客觀檢討與反思 ③ 具體突破建議（怎麼做會更好） ④ 今日核心重點整理。

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
    title: String(data.title || data.headline || "").trim().slice(0, 48),
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

const BODY_COACH_SYSTEM = `你是「日精進」的溫柔身心療癒陪伴者。使用者剛勾選今天的心情、身體與睡眠狀況，並可能寫下原因。請用放鬆、安放、不催促的語氣，給出「身心療癒建議」。

心情可能包含：出現焦慮、脾氣暴躁、普通、好心情。
身體可能包含：腸胃不適、頭痛、全身痠痛、身體疲勞，以及使用者自填的其他身體感受。
睡眠改為三個長期紀錄欄位：睡眠時間、睡眠品質、起床精神。

請溫柔地看見這三件事此刻如何互相安放：例如事情未如預期時身體哪裡先緊起來、睡不好時脾氣為何更薄、睡得夠或精神好時身體又如何被保護。然後給 3 個具體、今晚就能讓自己鬆一口氣的療癒動作。

規則：
- 只輸出 JSON
- 口吻溫暖、放鬆、可執行。像把燈調暗一點，而不是檢查清單。禁止雞湯、禁止說教、禁止診斷疾病或開藥
- 若勾選的是正向或平穩狀態（好心情、普通、睡眠品質很好、起床精神很好），要肯定它並給維持安放節奏的建議，不要硬找問題
- 若有不適訊號，先同理身體的緊繃，再給輕柔、做得到的療癒動作
- 建議必須是實際、放鬆導向的動作，例如調整呼吸、補充溫水、伸展、提早放下手機、溫水洗手臂、讓肩膀鬆開
- suggestions 必須剛好 3 條，每條 18-42 字
- 繁體中文
{
  "analysis": "2到4句。溫柔地看見心情、身體與睡眠此刻如何互相安放。",
  "suggestions": ["建議1", "建議2", "建議3"]
}`;

function bodyCoachUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  return `請針對這個人今天的身心狀態，寫出溫暖放鬆的「身心療癒建議」，並給 3 個今晚就能安放自己的動作。

今日感謝：${formatThanksForPrompt(ctx) || "（未寫）"}
今日事件：${ctx.event || body.text || "（未寫）"}
心情標籤：${ctx.mood || "未選"}
${formatBodyCheckPrompt(ctx)}`;
}

function normalizeBodyCoachResult(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : Array.isArray(data.tips) ? data.tips : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return {
    analysis: String(data.analysis || data.summary || data.logic || "").trim(),
    suggestions,
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
    if (text && !questions.includes(text)) questions.push(text.replace(/^[\d.、\-\s]+/, "").slice(0, 80));
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
    if (text && !items.includes(text)) items.push(text.replace(/^[\d.、\-\s]+/, "").slice(0, 48));
  });
  return items.slice(0, max);
}

function normalizeAwarenessQuote(raw) {
  let text = "";
  if (typeof raw === "string") {
    text = raw.trim();
  } else if (raw && typeof raw === "object") {
    text = String(raw.quote || raw.text || raw.title || "").trim();
    if (!text && Array.isArray(raw.items) && raw.items.length) {
      const first = raw.items[0];
      text = String(first?.quote || first?.title || first?.text || first || "").trim();
    }
  }
  text = text.replace(/^["「『]+|[」』"]+$/g, "").replace(/^[\d.、｜|\-\s]+/, "").trim();
  if (text.length < 12) return "";
  return text.slice(0, 80);
}

function splitChecklistTitle(text) {
  const raw = String(text || "").trim();
  const idx = raw.search(/[：:]/);
  if (idx > 0 && idx < raw.length - 1) {
    return { title: raw.slice(0, idx).trim(), detail: raw.slice(idx + 1).trim() };
  }
  return { title: raw, detail: "" };
}

function normalizeExecutionChecklistItems(raw, min, max) {
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
      const parts = splitChecklistTitle(item);
      title = parts.title;
      detail = parts.detail;
    } else if (item && typeof item === "object") {
      title = String(item.title || item.label || item.text || "").trim();
      detail = String(item.detail || item.lead || item.how || item.note || "").trim();
      if (!detail && title) {
        const parts = splitChecklistTitle(title);
        title = parts.title;
        detail = parts.detail;
      }
    }
    title = title.replace(/^[\d.、｜|\-\s]+/, "").slice(0, 18);
    detail = detail.slice(0, 48);
    if (!title || seen.has(title)) return;
    if (!detail) detail = "用最小、明天做得到的方式先走一步。";
    seen.add(title);
    items.push({ title, detail });
  });
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
    return `請依這個人今天的執行力回答，產出 3 到 4 條「行動卡點／解法」勾選項目。每一條都要有「行動標題」與「怎麼做會比較好」的具體作法說明。勾選後會進入行動清單，所以解法要具體、明天做得到。

${labeled}

明天最小的一步：${ctx.smallestStep || "未寫"}

背景補充：
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}
身體狀態：${bodyTags || "未選"}
身體提醒：${ctx.bodyNote || "未寫"}
尚未完成的行動：${openActions.slice(0, 6).join("、") || "尚無"}`;
  }
  const labeled = questions.length
    ? questions
        .map((question, index) => `${index + 1}. ${question}\n作答：${answers[index] || "（未答）"}`)
        .join("\n\n")
    : `是非題作答：${answer || "（未答）"}`;
  return `請依這個人今天的 6 道覺察是非題作答，煉結出一句直擊核心的「核心重點金句」。只要一句深刻、療癒、能引導覺察的話，不要條列、不要長篇解釋。

${labeled}

背景補充：
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}
身體狀態：${bodyTags || "未選"}
身體提醒：${ctx.bodyNote || "未寫"}`;
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
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max || 160);
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

const CORE_PROMPTS_SYSTEM = `你是「日精進」的高階心靈教練。請精準讀取使用者今天寫下的感謝內容、事件經過與當下情緒，動態生成「只屬於今天」的覺察力與執行力題目。

【任務】
- awareness：剛好 6 道自我覺察是非題。每題必須是一句可回答「是」或「否」的陳述句（不要開放問句、不要問「是什麼／為什麼」）。對準今天實際發生的畫面、情緒波動、感動或委屈，由淺入深：事件觸動 → 情緒 → 防衛 → 需求 → 身體 → 核心信念。
- execution：3 道針對性的執行突破題。必須對準今天事件裡的卡點、生氣、拖延或做不下去的地方：具體盲點是什麼、卡住的真正原因、明天最快能採取的突破行動。

【必須遵守】
- 只輸出 JSON
- 題目裡要能看見今天的人、事、情緒，讓他一眼覺得「這題是為我今天出的」
- 每天視角都要不同，不要重複使用者最近已經問過的題
- 禁止使用固定題庫口吻。尤其禁止出現或改寫這些死題：
  「今天哪一件事最觸動你」「你當時真正的感受是什麼」「你真正介意的是什麼」
  「生命力或平靜」「防衛心或情緒波動」「翻白眼」「不好意思拒絕」「老方法處理」
  「本來想做卻一直拖著」「卡住不想動」「明天只要花 5 分鐘」
  「今天在執行目標時遇到了什麼實質卡點」
- 禁止雞湯、禁止說教、禁止病例腔、禁止空泛「你真正的感受是什麼」「你要更努力」
- 題目要具體、有畫面、有啟發，像一對一教練今天才想出來的
- 繁體中文

{
  "awareness": [
    { "question": "可答是或否的陳述句，18-36字" }
  ],
  "execution": [
    { "question": "完整問句，18-40字", "placeholder": "8-18字" }
  ]
}
awareness 必須剛好 6 題，execution 必須剛好 3 題。`;

function isCorePromptsRequest(body) {
  return body?.variant === "core" || body?.scope === "core" || body?.kind === "core";
}

function corePromptsUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const progress = body.progress && typeof body.progress === "object" ? body.progress : {};
  const thanks = formatThanksForPrompt(ctx) || "未寫";
  const avoid = Array.isArray(progress.avoidQuestions) ? progress.avoidQuestions.filter(Boolean) : [];
  const openActions = Array.isArray(progress.openActions) ? progress.openActions.filter(Boolean) : [];
  return `請精準讀取以下「今天的原文」，生成只屬於這一天的覺察力 6 題是非題、執行力 3 題。題目必須能讓人認出今天的感謝、事件與情緒，不要出成萬用題。

日期：${body.date || ""}
連續復盤天數：${progress.streak || 0}

【今天的輸入｜必須據此出題】
今日感謝：
${thanks}
今日事件：${compactLine(ctx.event || body.text, 800) || "（未寫）"}
心情：${ctx.mood || "未選"}

尚未完成的行動：${openActions.slice(0, 6).map((item) => compactLine(item, 40)).join("、") || "尚無"}

【請避開、不要再出相近的題】
${avoid.length ? avoid.slice(0, 16).map((item) => `- ${compactLine(item, 60)}`).join("\n") : "（無）"}

覺察是非題：6 句可答「是」或「否」的陳述，對準今天的情緒波動、感動或委屈，引導看見背後的期待或盲點。
執行題：針對今天卡住、生氣或拖延的部分，問具體盲點，以及明天最快的突破行動。`;
}

function normalizePromptItem(item) {
  if (typeof item === "string") {
    const question = item.trim();
    return question ? { question, placeholder: "寫下那個時刻…" } : null;
  }
  if (!item || typeof item !== "object") return null;
  const question = String(item.question || item.title || item.text || "").trim();
  if (!question) return null;
  return {
    question: question.slice(0, 80),
    placeholder: String(item.placeholder || "寫下那個時刻…").trim().slice(0, 36) || "寫下那個時刻…",
  };
}

function normalizeDeepPromptItem(item) {
  const base = normalizePromptItem(item);
  if (!base) return null;
  const data = item && typeof item === "object" ? item : {};
  return {
    title: base.question.slice(0, 90),
    plainGuide: String(data.plainGuide || data.plain || "白話想一想：先把場面講清楚。").trim().slice(0, 80),
    deepGuide: String(data.deepGuide || data.deep || "深挖一點點：真正被碰到的是哪一層？").trim().slice(0, 80),
    placeholderPlain: String(data.placeholderPlain || "那一刻發生了什麼…").trim().slice(0, 36),
    placeholderDeep: String(data.placeholderDeep || "真正觸發我的是…").trim().slice(0, 36),
  };
}

function normalizePromptsResult(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const awareness = (Array.isArray(data.awareness) ? data.awareness : [])
    .map(normalizePromptItem)
    .filter(Boolean)
    .slice(0, 6);
  const execution = (Array.isArray(data.execution) ? data.execution : [])
    .map(normalizePromptItem)
    .filter(Boolean)
    .slice(0, 3);
  const deep = (Array.isArray(data.deep) ? data.deep : [])
    .map(normalizeDeepPromptItem)
    .filter(Boolean)
    .slice(0, 4);
  return { awareness, execution, deep };
}

async function callOpenAI(messages, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error("伺服器尚未設定 OPENAI_API_KEY");
    error.status = 500;
    throw error;
  }

  const url = chatCompletionsUrl();
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (/openrouter\.ai/i.test(url)) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://nichi-seishin.vercel.app";
    headers["X-Title"] = "nichi-seishin";
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0.75,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error((data && data.error && data.error.message) || `OpenAI 請求失敗（${response.status}）`);
      error.status = response.status;
      throw error;
    }
    const content = data?.choices?.[0]?.message?.content || "";
    return parseAiJson(content);
  } finally {
    clearTimeout(timer);
  }
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
      model: String(process.env.OPENAI_MODEL || "gpt-4o-mini"),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "只接受 POST" });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (supabaseAdminConfigured()) {
    try {
      const sub = await ensureTrial(user);
      if (sub && !isEntitled(sub)) {
        res.status(402).json({ ok: false, error: "您的 7 天免費體驗已結束，升級訂閱即可解鎖完整無限暢用權限", paywall: true });
        return;
      }
    } catch (error) {
      console.error("ensureTrial in review:", error && error.message ? error.message : error);
    }
  }

  try {
    const body = readJsonBody(req);
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
                    : "organize";
    const text = String(body.text || "").trim();
    if (mode === "checklist") {
      const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
      if (answers.filter(Boolean).length < 1) {
        res.status(400).json({ ok: false, error: "請先寫完左側這道核心題" });
        return;
      }
    } else if (mode === "insight") {
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const event = String(ctx.event || text || "").trim();
      const mood = String(ctx.mood || "").trim();
      if (isQuickInsightRequest(body)) {
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
        res.status(400).json({ ok: false, error: "請先寫下明天想顯化的事情" });
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
      messages = [
        { role: "system", content: kind === "execution" ? CHECKLIST_EXECUTION_SYSTEM : CHECKLIST_AWARENESS_SYSTEM },
        { role: "user", content: checklistUserPrompt(kind, body) },
      ];
    } else if (mode === "insight") {
      messages = [
        { role: "system", content: isQuickInsightRequest(body) ? QUICK_INSIGHT_SYSTEM : INSIGHT_SYSTEM },
        { role: "user", content: insightUserPrompt(body) },
      ];
    } else if (mode === "deepen") {
      messages = [
        { role: "system", content: DEEPEN_SYSTEM },
        { role: "user", content: deepenUserPrompt(body) },
      ];
    } else if (mode === "prompts") {
      messages = [
        { role: "system", content: isCorePromptsRequest(body) ? CORE_PROMPTS_SYSTEM : PROMPTS_SYSTEM },
        { role: "user", content: isCorePromptsRequest(body) ? corePromptsUserPrompt(body) : promptsUserPrompt(body) },
      ];
    } else if (mode === "manifest") {
      messages = [
        { role: "system", content: CHECKLIST_MANIFEST_SYSTEM },
        { role: "user", content: manifestUserPrompt(body) },
      ];
    } else if (mode === "bodycoach") {
      messages = [
        { role: "system", content: BODY_COACH_SYSTEM },
        { role: "user", content: bodyCoachUserPrompt(body) },
      ];
    } else if (mode === "think") {
      const round = Number(body.round) || 1;
      const max = Number(body.max) || 5;
      const actions = Array.isArray(body.actions) ? body.actions : [];
      const reply = String(body.reply || "").trim() || "（沒有額外補充）";
      const organize = body.organize ? JSON.stringify(body.organize) : "";
      messages = [
        { role: "system", content: THINK_SYSTEM },
        {
          role: "user",
          content: `這是第 ${round}/${max} 輪。\n先前整理：\n${organize}\n\n勾選的下一步：\n${actions.length ? actions.map((item) => `- ${item.label}：${item.detail}`).join("\n") : "（尚未勾選）"}\n\n使用者補充：\n${reply}\n\n原始口語：\n${text}`,
        },
      ];
    } else {
      messages = [
        { role: "system", content: ORGANIZE_SYSTEM },
        { role: "user", content: `復盤日期：${body.date || ""}\n\n口語原文：\n${text}` },
      ];
    }

    const data = await callOpenAI(messages, { temperature: mode === "prompts" ? 0.95 : 0.75 });
    if (mode === "checklist") {
      const kind = body.kind === "execution" ? "execution" : "awareness";
      if (kind === "awareness") {
        const quote = normalizeAwarenessQuote(data);
        if (!quote) {
          res.status(502).json({ ok: false, error: "AI 覺察金句格式不完整，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: "openai", data: { quote, items: [quote], kind } });
        return;
      }
      const min = 3;
      const max = 4;
      const items = normalizeExecutionChecklistItems(data, min, max);
      if (items.length < min) {
        res.status(502).json({ ok: false, error: "AI 勾勾表格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: { items: items.slice(0, max), kind } });
      return;
    }
    if (mode === "insight") {
      const insight = normalizeInsightResult(data);
      if (!insight.conclusion && !insight.psychology) {
        res.status(502).json({ ok: false, error: "洞察格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: insight });
      return;
    }
    if (mode === "deepen") {
      const questions = normalizeDeepenQuestions(data);
      if (questions.length < 3) {
        res.status(502).json({ ok: false, error: "AI 延伸提問格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: { questions } });
      return;
    }
    if (mode === "prompts") {
      const prompts = normalizePromptsResult(data);
      if (isCorePromptsRequest(body)) {
        if (prompts.awareness.length < 6 || prompts.execution.length < 3) {
          res.status(502).json({ ok: false, error: "AI 題目格式不完整，請再試一次" });
          return;
        }
      } else if (prompts.deep.length < 4) {
        res.status(502).json({ ok: false, error: "AI 題目格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: prompts });
      return;
    }
    if (mode === "manifest") {
      const items = normalizeChecklistItems(data, 3, 5);
      if (items.length < 3) {
        res.status(502).json({ ok: false, error: "AI 顯化步驟格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: { items: items.slice(0, 5), kind: "manifest" } });
      return;
    }
    if (mode === "bodycoach") {
      const coach = normalizeBodyCoachResult(data);
      if (!coach.analysis || coach.suggestions.length < 3) {
        res.status(502).json({ ok: false, error: "AI 身心療癒建議格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: coach });
      return;
    }
    res.status(200).json({ ok: true, source: "openai", data });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? "OpenAI 逾時" : String(error.message || "伺服器錯誤"),
    });
  }
};
