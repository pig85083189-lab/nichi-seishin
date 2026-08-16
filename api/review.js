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

const CHECKLIST_AWARENESS_SYSTEM = `你是「日精進」的高階心靈教練與諮詢師。使用者剛寫下今天的三個覺察問題。
請用心理學與教練視角做深層、白話的分析，整理成「今天我覺察到」勾選清單。

規則：
- 只輸出 JSON：{"items":["..."]}
- items 必須 4 到 6 條，不可少於 4、不可超過 6
- 每一條 12-28 字，像一句可勾選的洞察，不要編號、不要句號堆疊
- 必須貼近使用者原文，指出真正被碰到的層：生命力來源、防衛心在保護什麼、情緒真正在說什麼、還沒說出口的需求、身體訊號、明天可改的小選擇
- 禁止雞湯、禁止說教、禁止病例腔、禁止空泛「要愛自己」
- 繁體中文`;

const CHECKLIST_EXECUTION_SYSTEM = `你是「日精進」的高階心靈教練。使用者剛寫下拖延的事、卡住原因，以及明天只要 5 分鐘的一小步。
請分析真正的行動卡點，整理成「我的行動卡點」勾選清單。

規則：
- 只輸出 JSON：{"items":["..."]}
- items 必須 3 到 4 條，不可少於 3、不可超過 4
- 每一條 12-28 字，具體到這個人今天的卡住，讓他能直接勾選
- 可涵蓋：任務太大、害怕做不好或被看見、能量不夠、目標不夠清楚、還沒對齊為什麼要做、被打斷、5 分鐘起步點
- 禁止空泛激勵、禁止「你要更努力」
- 繁體中文`;

const INSIGHT_SYSTEM = `你是「日精進」的高階心靈教練：溫柔，但犀利。使用者剛寫下今天的事件、心情，以及身體狀況。
請根據事件、情緒與身體反應，生成一段有深度思考與邏輯分析的核心結論。

請點出其中一到兩層：
- 事件背後的心理防衛機制
- 情緒盲點（我以為／其實在怕什麼）
- 身體緊繃、疲憊、不適與心理壓力的關聯

規則：
- 只輸出 JSON
- 口吻像一對一諮詢：先接住，再點破。禁止雞湯、禁止說教、禁止病例腔
- 必須貼近使用者原文，不要空泛
- 繁體中文
{
  "title": "一句有質感的洞察標題，12-22字",
  "conclusion": "核心結論，2到4句。這是今天最該被看見的一句總結。",
  "logic": "邏輯分析：防衛機制或情緒盲點為什麼會這樣運作，2到3句。",
  "bodyLink": "身體反應與心理壓力的關聯，1到2句。"
}`;

function insightUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const bodyTags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
  return `請為這個人生成今日核心結論。

今日事件：${ctx.event || body.text || "（未寫）"}
心情：${ctx.mood || "未選"}
身體狀態：${bodyTags || "未選"}
身體在提醒我：${ctx.bodyNote || "未寫"}`;
}

function normalizeInsightResult(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    title: String(data.title || data.headline || "").trim().slice(0, 48),
    conclusion: String(data.conclusion || data.summary || data.core || "").trim(),
    logic: String(data.logic || data.analysis || "").trim(),
    bodyLink: String(data.bodyLink || data.body || data.link || "").trim(),
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

function checklistUserPrompt(kind, body) {
  const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const bodyTags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
  if (kind === "execution") {
    return `請分析這個人的行動卡點，產出 3 到 4 條勾選項目。

一直拖著沒做的事：${answers[0] || "（未填）"}
卡住、不想動的原因：${answers[1] || "（未填）"}
明天只要 5 分鐘的一小步：${answers[2] || "（未填）"}

背景補充：
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}
身體狀態：${bodyTags || "未選"}
身體提醒：${ctx.bodyNote || "未寫"}`;
  }
  const questions = Array.isArray(body.questions) ? body.questions.map((item) => String(item || "").trim()) : [];
  return `請分析這個人今天的覺察，產出 4 到 6 條「今天我覺察到」勾選項目。

題目一：${questions[0] || "今天的第一個覺察題"}
回答一：${answers[0] || "（未填）"}
題目二：${questions[1] || "今天的第二個覺察題"}
回答二：${answers[1] || "（未填）"}
題目三：${questions[2] || "今天的第三個覺察題"}
回答三：${answers[2] || "（未填）"}

背景補充：
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}
身體狀態：${bodyTags || "未選"}
身體提醒：${ctx.bodyNote || "未寫"}`;
}

const PROMPTS_SYSTEM = `你是「日精進」的高階心靈教練。請依這個人今天的真實輸入，以及近期成長進度，動態生成全新的覺察題與深度思考主題。

【任務】
- awareness：3 道覺察力題目，讓他寫短答。
- deep：4 個深度思考主題。每個主題含標題、白話引導、深挖引導。

【必須遵守】
- 只輸出 JSON
- 題目必須貼近今天的事件、心情、身體訊號、感恩與近期洞察，讓他覺得「這題是為我今天出的」
- 每天視角都要不同：可從關係、身體、價值、界線、未說出口的話、想保護的東西、小小的堅持等切入，但不要重複使用者最近已經問過的題
- 禁止使用固定題庫口吻。尤其禁止出現或改寫這些死題：
  「生命力或平靜」「防衛心或情緒波動」「翻白眼」「不好意思拒絕」「老方法處理」「還好我有堅持」
- 禁止雞湯、禁止說教、禁止病例腔、禁止空泛「你真正的感受是什麼」
- 題目要具體、有畫面、有啟發，像一對一教練今天才想出來的
- 繁體中文

{
  "awareness": [
    { "question": "完整問句，18-36字", "placeholder": "8-16字的作答提示" },
    { "question": "完整問句", "placeholder": "作答提示" },
    { "question": "完整問句", "placeholder": "作答提示" }
  ],
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
awareness 必須剛好 3 題。deep 必須剛好 4 題。`;

function compactLine(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max || 160);
}

function promptsUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const progress = body.progress && typeof body.progress === "object" ? body.progress : {};
  const bodyTags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : "";
  const thanks = Array.isArray(ctx.thanks) ? ctx.thanks.filter(Boolean).join("、") : "";
  const recent = Array.isArray(progress.recentReviews) ? progress.recentReviews : [];
  const recentInsights = Array.isArray(progress.recentInsights) ? progress.recentInsights : [];
  const avoid = Array.isArray(progress.avoidQuestions) ? progress.avoidQuestions.filter(Boolean) : [];
  const openActions = Array.isArray(progress.openActions) ? progress.openActions.filter(Boolean) : [];
  const recentText = recent
    .slice(0, 7)
    .map((item) => {
      const checks = Array.isArray(item.awareness) ? item.awareness.join("、") : "";
      return `- ${item.date || ""}｜心情 ${item.mood || "未記"}｜${compactLine(item.event, 80)}${item.insight ? `｜洞察：${compactLine(item.insight, 60)}` : ""}${checks ? `｜已覺察：${compactLine(checks, 80)}` : ""}`;
    })
    .join("\n");
  return `請為這個人生成「今天才有」的覺察題 3 題，以及深度思考主題 4 題。

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

請讓今天的題目承接他的進度：看見重複模式就換新視角，看見新突破就往下挖一層。`;
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
    .slice(0, 3);
  const deep = (Array.isArray(data.deep) ? data.deep : [])
    .map(normalizeDeepPromptItem)
    .filter(Boolean)
    .slice(0, 4);
  return { awareness, deep };
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
        res.status(402).json({ ok: false, error: "試用已結束，請訂閱後繼續使用雲端 AI。" });
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
                : "organize";
    const text = String(body.text || "").trim();
    if (mode === "checklist") {
      const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item || "").trim()) : [];
      if (answers.filter(Boolean).length < 3) {
        res.status(400).json({ ok: false, error: "請先寫完左側三個問題" });
        return;
      }
    } else if (mode === "insight") {
      const ctx = body.context && typeof body.context === "object" ? body.context : {};
      const event = String(ctx.event || text || "").trim();
      const mood = String(ctx.mood || "").trim();
      const hasBody = (Array.isArray(ctx.bodyTags) && ctx.bodyTags.length) || String(ctx.bodyNote || "").trim();
      if (!event || !mood || !hasBody) {
        res.status(400).json({ ok: false, error: "請先寫下今日事件、選擇心情，並標出身體狀況" });
        return;
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
      const hasBody = (Array.isArray(ctx.bodyTags) && ctx.bodyTags.length) || String(ctx.bodyNote || "").trim();
      if (!event || !mood || !hasBody) {
        res.status(400).json({ ok: false, error: "請先寫下今日事件、選擇心情，並標出身體狀況" });
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
        { role: "system", content: INSIGHT_SYSTEM },
        { role: "user", content: insightUserPrompt(body) },
      ];
    } else if (mode === "deepen") {
      messages = [
        { role: "system", content: DEEPEN_SYSTEM },
        { role: "user", content: deepenUserPrompt(body) },
      ];
    } else if (mode === "prompts") {
      messages = [
        { role: "system", content: PROMPTS_SYSTEM },
        { role: "user", content: promptsUserPrompt(body) },
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
      const min = kind === "execution" ? 3 : 4;
      const max = kind === "execution" ? 4 : 6;
      const items = normalizeChecklistItems(data, min, max);
      if (items.length < min) {
        res.status(502).json({ ok: false, error: "AI 勾勾表格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: { items: items.slice(0, max), kind } });
      return;
    }
    if (mode === "insight") {
      const insight = normalizeInsightResult(data);
      if (!insight.conclusion) {
        res.status(502).json({ ok: false, error: "AI 洞察格式不完整，請再試一次" });
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
      if (prompts.awareness.length < 3 || prompts.deep.length < 4) {
        res.status(502).json({ ok: false, error: "AI 題目格式不完整，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: "openai", data: prompts });
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
