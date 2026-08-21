const { requireUser } = require("../lib/auth");
const { ensureTrial, isEntitled, supabaseAdminConfigured } = require("../lib/supabase");
const { getApiKey, getModel, getProvider, usesClaude, callOpenAI } = require("../lib/openai");

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

const CHECKLIST_AWARENESS_SYSTEM = `你是「日精進」的覺察整理者。目的不是給金句，也不是替使用者下結論，而是陪他從今天已經寫下的內容裡，自己發現可能還沒注意到的需求、反應或落差。

讀完後，他最理想的感受是：「原來我是這樣？」「我自己都沒有發現。」最差的結果是一句看起來很深、但其實套誰都行的療癒語錄，或 AI 告訴他「你是什麼樣的人」。

【思考順序｜必須照做，不要跳】
1. 先讀完今天所有資料：感謝、事件、心情、身體、睡眠、起床精神、3 道是非題與答案。
2. 找出至少兩個資料區塊之間的關聯，不要只抓某一句往外延伸。
3. 把是非題當成「驗證」，不是已經成立的診斷。
4. 根據「是／否」修正判斷，再寫結果。
5. 只有使用者訊息裡「合格的跨日模式」列出的項目，才能寫 echo。沒有列出就必須空字串。
6. 資料不足就寫得簡單、具體；禁止硬湊深度。

【是／否必須改寫結論】
- 「是」：這個假設可以輕輕保留，仍用「可能／好像／今天看起來／也許」。
- 「否」：這個假設不成立。禁止再寫成他的特質或今天的結論。改寫成：今天他沒有這樣，或他看見的是另一面。
- 三題都是否：seen 必須承認「今天他沒有接受那些假設」，不要硬套被否定的模式。改從今天實際填寫的感謝、事件、身體裡找一個較小、較安全的觀察。
- 禁止把「否」解釋成防衛、迴避、還沒準備承認。否就是否。

【結果結構｜全部寫入 JSON，短、準、有證據】
- seen：【今天，我看見了自己】50～100 字。今天最值得注意的一個發現，要能回扣今天實際寫下的內容。
- gap：【我可能忽略的地方】80～150 字。不要只下結論。必須用換行分成三段：
  ① 先指出今天出現的具體線索
  ② 再說這些線索可能存在的關聯
  ③ 最後提出一個「可能的模式」
  用「如果把今天的幾個線索放在一起看／可能／好像／看起來／也許」。
- echo：【最近反覆出現的模式】60～120 字。只有訊息裡列出合格跨日模式時才能寫；否則必須是 ""。
  先寫真實天數與次數（不可虛構），再寫語意上的同一模式，最後用保留語氣說這可能值得注意。
  禁止因為同一個字出現 3 次就當成模式；要看是否同一種需求／情緒／行為。
- question：【今晚留給自己的一個問題】只一題，不要給答案。必須承接 seen + gap（若有 echo 也要承接）。
  禁止萬用題：今天你學到了什麼？你愛自己嗎？你現在有什麼感覺？你真正的感受是什麼？
- line：可選。最後才放的短句，最多 22 字。不能取代上面各段，也不能是空泛金句。

【語氣｜陪使用者發現，不是告訴他他是誰】
使用：可能、好像、看起來、也許、如果把今天的幾個線索放在一起看。
禁止：你就是、你一直都、這代表你、你其實只是、你一定是、你其實一直、代表你、你值得被愛、你需要好好愛自己、宇宙正在提醒你。
禁止心理診斷、人格標籤、虛構次數／日期／歷史事件。

規則：
- 只輸出 JSON，繁體中文
- 每個結論都必須可以回扣今天實際填寫的內容，或使用者訊息裡真正列出的歷史天
{
  "seen": "50～100字",
  "gap": "80～150字，用換行分成線索／關聯／可能的模式",
  "question": "承接前面發現的一題？",
  "line": "可選，最多22字",
  "echo": ""
}`;

const MANIFEST_PROMPTS_SYSTEM = `你是「日精進」的顯化引導者。04 看見自己，05 把事情做出來；你幫他看見自己想去哪裡，開始成為那個人。

使用者剛寫下「我想顯化的事情」。請只生成 2 道顯化思考題，不要拆待辦，不要給執行清單。

第1題：如果這件事已經成真，生活會有什麼不同？
第2題：那個已經做到的你，現在最不一樣的是什麼？

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
{"questions":[{"question":"...","placeholder":"..."},{"question":"...","placeholder":"..."}]}
placeholder 8-24 字，像「生活裡會先鬆開的是…」
繁體中文`;

const MANIFEST_PATHS_SYSTEM = `你是「日精進」的顯化整理者。不要把它變成 05 執行力的待辦清單。

05 問「明天／現在具體要做什麼」。
你問「我想去哪裡？我要慢慢成為什麼樣的人？」

請讀取願望、兩道思考題的回答，整理成「讓願望靠近現實」的 2～3 個方向，以及一句「我的顯化句」。

【方向 2～3 個，不要硬湊】
1. start｜今天可以開始的一小步：一個能開始靠近的方向，不是明天幾點的任務
2. habit｜需要慢慢建立的一個習慣：長期累積
3. limit｜目前最值得突破的一個限制：看見會讓自己停下來的地方
某類不適用就省略，不要湊滿。

【不要這樣寫】
找3個賺錢機會／聯絡一個客戶／明天打電話／今天做30分鐘／明天完成3項工作
宇宙會回應你／願望一定會實現／相信就會發生／頻率對了就會吸引／你注定會得到／只要想像就能得到

【要這樣寫】
start：「寫下目前最有可能帶來收入的1項服務，想出下一個曝光方式。」
habit：「每週固定一次回顧收入來源與有效曝光方式。」
limit：「確認最容易讓自己停下來的，是曝光不足、產品不清楚，還是不敢主動邀請。」

title 18-42 字，就是方向本身。detail 可空，或一句更短的補充（最多 22 字）。
視角要比執行力高一層：累積什麼、成為什麼，不是明天幾點做完。

【我的顯化句】
1～2 句。身份認同＋正在前進。
合格：我正在成為一個能持續創造價值，也有能力承接更多收入的人。
不合格：我一定會成功。／我一定會賺到100萬。／宇宙正在把100萬送給我。

只輸出 JSON：
{
  "items": [
    { "kind": "start", "title": "...", "detail": "..." }
  ],
  "sentence": "我正在……"
}
繁體中文`;

function isManifestPromptsRequest(body) {
  const step = String(body?.step || body?.kind || "").trim().toLowerCase();
  return step === "prompts" || step === "questions" || step === "think";
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
    if (!question || question.length > 56 || (question.match(/[？?]/g) || []).length !== 1) return;
    if (mysticManifestText(question) || looksLikeExecTaskManifest(question)) return;
    if (seen.has(question)) return;
    seen.add(question);
    items.push({
      question: question.slice(0, 48),
      placeholder: String(item?.placeholder || fallbacks[index]?.placeholder || "我想的是…").slice(0, 24),
    });
  });
  fallbacks.forEach((item) => {
    if (items.length >= 2) return;
    if (seen.has(item.question)) return;
    seen.add(item.question);
    items.push(item);
  });
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
    byKind.set(kind, {
      kind,
      label: labels[kind] || "",
      title: title.replace(/^["「]+|[」"]+$/g, "").slice(0, 48),
      detail: detail.slice(0, 22),
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
  if (!text || mysticManifestText(text) || /我一定會|宇宙正在把/.test(text)) return fallback.slice(0, 42);
  const sentences = text.split(/(?<=[。！？!?])/).map((item) => item.trim()).filter(Boolean);
  return sentences.slice(0, 2).join("").slice(0, 56) || fallback;
}

function manifestPromptsUserPrompt(body) {
  const vision = String(body.vision || body.text || "").trim();
  return `請只生成 2 道顯化思考題。不要拆待辦，不要給步驟。

我想顯化的事情：${vision || "（未寫）"}`;
}

function manifestPathsUserPrompt(body) {
  const vision = String(body.vision || body.text || "").trim();
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const questions = Array.isArray(body.questions) ? body.questions : [];
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const labeled = questions.length
    ? questions
        .map((question, index) => `${index + 1}. ${question}\n回答：${answers[index] || "（未填）"}`)
        .join("\n\n")
    : `思考回答：${answers.filter(Boolean).join("\n") || "（未填）"}`;
  return `請整理 2 到 3 個「讓願望靠近現實」的方向，以及一句顯化句。不要變成明天幾點的待辦。

我想顯化的事情：${vision || "（未寫）"}

${labeled}

今日心情：${ctx.mood || "未選"}
今日事件：${compactLine(ctx.event, 120) || "未寫"}`;
}

const CHECKLIST_EXECUTION_SYSTEM = `你是「日精進」的行動整理者。04 負責分析；你只收成「現在／明天做得出來」的下一步。少分析、多行動。

請同時讀取：行動問題的回答、以及使用者自己寫的「明天最小的一步」。若最小一步已寫「時間＋動作」，至少一張卡要承接它。

【標題＝可勾選的行動】
必須能回答：「我什麼時候算完成它？」
最好有時間或觸發條件：今晚10:30、早餐後、下午3點、起床後。
合格：今晚10:30開始準備睡覺／明天早餐後寫下3件開心小事／明天下午做30分鐘運動
不合格：補睡眠vs運動的假二選一／計劃總是待辦的真因／跟自己好好相處／我要早點睡

【說明＝一句怎麼做】
detail 只寫執行方式，1 句，最多 22 字。
合格：洗澡後放下手機，11:00前上床。／不用想完整，先花3分鐘寫完。／睡飽後再動，不用勉強自己早起。
不要寫長原因，不要「真正卡住」「深層原因」「自我修復」「真因」「核心卡點」。

【數量 1～3，禁止湊數】
一張卡只做一件事。

【今天最重要的一步｜focus】
只能一件，而且必須是「今天／現在就能開始」的行動。
優先挑：最會擋住其他事情的那一件。睡眠不足就先顧今晚睡覺，不要先列明天運動。
合格：今晚10:30開始準備睡覺。
不合格：明天11:00前睡覺，今晚開始準備。／同時列出兩件明天的目標。
focus.detail 只一句短原因，例如：先把睡眠顧好，明天才有體力完成其他計畫。

禁止抽象：好好休息、早點睡、多運動、我要完成計畫。
禁止發明他沒說過的目標。禁止你必須／你應該。

只輸出 JSON：
{
  "items": [
    { "title": "今晚10:30開始準備睡覺", "detail": "洗澡後放下手機，11:00前上床。" }
  ],
  "focus": { "title": "今晚10:30開始準備睡覺", "detail": "先把睡眠顧好，明天才有體力完成其他計畫。" }
}`;

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
      const roles = ["感受", "意義", "看見自己"];
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
    return `情緒方向：幸福／感謝／開心／滿足。
請探索為什麼這件事重要、真正珍惜什麼、反映了什麼價值或生活方式、有沒有開始看見容易忽略的幸福。
禁止問害怕失去、保護自己、防衛、期待回報，除非他自己的文字已出現矛盾、擔心、不安或交換感。`;
  }
  if (tone === "anger") {
    return `情緒方向：生氣／不舒服／被冒犯。
可探索哪個界線被碰到、真正介意什麼、原本期待對方怎麼做、情緒底下的需求。`;
  }
  if (tone === "sad") {
    return `情緒方向：難過／失落。
可探索真正失去什麼、為什麼這件事重要、這份難過反映他在乎什麼。`;
  }
  if (tone === "anxiety") {
    return `情緒方向：焦慮／害怕。
可探索最擔心什麼、哪一部分可以控制、哪一部分來自未知或想像、現在真正需要什麼。`;
  }
  if (tone === "mixed") {
    return `情緒方向：矛盾（例如又幸福又不安）。可以同時輕輕碰觸正向與不安兩面，但不要把幸福整段改寫成恐懼。`;
  }
  return `情緒方向尚不明顯。先跟著原文走，不要預設有創傷、防衛或害怕。`;
}

const THINK_GUIDE_ASK_SYSTEM = `你是「日精進」的深度思考陪伴者。先讀懂使用者今天寫下的感謝、事件、心情與（若有）身體覺察，以及到目前為止的每一輪問答，再只提出「這一輪」一個引導式疑問句。

你的工作是陪他找到答案，不是替他下結論，也不是找創傷。深度不等於找問題。不要為了深度而刻意負面化。

【先判斷情緒方向，再決定怎麼問】
- 幸福／感謝／開心／滿足：問為什麼重要、真正珍惜什麼、這反映了他的什麼、有沒有開始看見容易忽略的幸福。禁止問「是不是害怕失去」「是不是在保護自己」「是不是期待回報」，除非他自己的文字已出現矛盾、擔心、不安或交換感。
- 生氣／不舒服／被冒犯：問哪個界線被碰到、真正介意什麼、原本期待對方怎麼做、情緒底下的需求。
- 難過／失落：問真正失去什麼、為什麼重要、這份難過反映他在乎什麼。
- 焦慮／害怕：問最擔心什麼、哪裡可控制、哪裡來自未知或想像、現在真正需要什麼。
- 矛盾（例如又幸福又不安）：才可以同時輕輕碰觸正向與不安兩面。

不要像心理醫生，不要下診斷，不要堆心理學名詞，不要每件事都解讀成防衛或創傷，不要一直稱讚，不要 emoji。

【三輪角色必須不同，最多 3 輪，不要第 4 輪】
- 第 1 輪｜感受：回到事件當下。問最明顯的感受，或真正被觸動的那一個瞬間。
- 第 2 輪｜意義：必須讀取第 1 輪回答後動態生成。往「為什麼這對我重要」走，承接他的用詞。不要重問類似的為什麼，不要無故跳去害怕／防衛。
- 第 3 輪｜看見自己：把視角從「事情」拉回「自己」。問今天這件事讓他重新看見自己哪一部分。

規則：
- 只輸出 JSON：{"question":"...","hint":"..."}
- question 必須是疑問句，16-48 字，溫暖、白話、貼近今天的原文用詞
- hint 10-24 字，一句陪伴，不給答案
- 必須使用完整上下文：原始內容＋前面每一輪的問與答。不要像重新開始聊天
- 禁止雞湯、禁止說教、禁止一次問兩件事、禁止複述整段日記
- 繁體中文`;

const THINK_GUIDE_CLOSE_SYSTEM = `你是「日精進」的深度思考陪伴者。使用者已完成剛好 3 輪引導式問答。請讀取「原始內容＋三輪問與答」全部上下文，寫出一份有整體脈絡的「今日覺察總結」。

目標：讓他覺得「原來今天這些事情其實在講同一件事」「你有看懂我寫的」。不是把文字重新包裝，不是急著給答案，而是幫他把「事件 → 感受 → 發現 → 意義」串起來。

語氣：溫暖、有洞察、白話。不說教、不過度心理分析、不用心理學名詞、不像心理醫生、不下診斷。不要把幸福硬寫成害怕或防衛。不要一直稱讚。不要 emoji。不要文青空話或網路雞湯語錄。

規則：
- 只輸出 JSON：
{
  "title": "今日主題，8-18字，具體有意義，不要太雞湯也不要太抽象",
  "awareness": "今日覺察，2到4小段，用\\n\\n分段。串起事件、感受、發現與意義，不要只重述原文。",
  "selfSeen": "今天我看見的自己：一句第一人稱，必須根據他的原文，不可套模板",
  "takeaway": "今日帶走的一句話：短、有記憶點，像從今天這份紀錄長出來"
}
- 必須承接他的用詞與三輪回答
- 若今天是幸福／感謝，總結也要停在珍惜與看見，不要硬轉成恐懼
- 不要再提問，不要列行動清單
- 繁體中文`;

function thinkGuideRoundRole(round) {
  if (Number(round) === 2) return "意義";
  if (Number(round) === 3) return "看見自己";
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
  const original = `【原始內容｜每一輪都必須讀完】
今日感謝：
${thanks || "未寫"}
今日事件：${ctx.event || body.text || "（未寫）"}
心情：${ctx.mood || "未選"}
${extras.join("\n")}`;
  const dialogue = `【到目前為止的完整問答｜必須承接，不要當作新對話】
${formatThinkGuideRounds(rounds)}`;
  const tone = inferThinkGuideTone(ctx, rounds);
  if (thinkGuideStep(body) === "close") {
    return `請根據下面全部上下文，寫出有整體脈絡的「今日覺察總結」。不要再提問。

${thinkGuideToneHint(tone)}

${original}

${dialogue}`;
  }
  const last = rounds.filter((item) => String(item?.answer || "").trim()).slice(-1)[0];
  const lastLine = last
    ? `上一輪他回答：「${compactLine(last.answer, 120)}」。第 ${round} 輪必須承接這句話的用詞與意思。`
    : "這是第 1 輪，請先回到今天的畫面與感受。";
  const roleHint =
    round === 1
      ? "這一輪只問「當下真正的感受」或真正被觸動的瞬間，不要跳到意義或自我分析。"
      : round === 2
        ? "這一輪問「為什麼這對我重要／真正珍惜的是什麼」。不要無故問害怕、防衛、期待回報。"
        : "這一輪把視角從事情拉回自己：今天這件事讓他重新看見自己哪一部分。這是最後一問，不要再往下追。";
  return `這是第 ${round}/3 輪，任務是「${thinkGuideRoundRole(round)}」。請只出這一輪一個引導式疑問句，不要總結。

${thinkGuideToneHint(tone)}
${roleHint}
${lastLine}

${original}

${dialogue}`;
}

function normalizeThinkGuideAsk(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    step: "ask",
    question: String(data.question || data.prompt || "").trim().slice(0, 80),
    hint: String(data.hint || data.guide || "").trim().slice(0, 60),
  };
}

function normalizeThinkGuideClose(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const awareness = String(data.awareness || data.summary || data.conclusion || data.psychology || "")
    .replace(/\r\n/g, "\n")
    .trim();
  const selfSeen = String(data.selfSeen || data.self || data.seen || "").trim();
  const takeaway = String(data.takeaway || data.line || data.quote || "").trim();
  const actions = normalizeStringList(data.actions || data.suggestions || data.steps, 2);
  return {
    step: "close",
    title: String(data.title || data.headline || "").trim().slice(0, 48) || "今天被看見的那一層",
    summary: awareness,
    awareness,
    selfSeen: selfSeen.slice(0, 80),
    takeaway: takeaway.slice(0, 80),
    actions,
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

const BODY_COACH_SYSTEM = `你是「日精進」的身心觀察者。使用者剛填完今天的心情、身體、睡眠、感謝與事件。你的工作不是安慰、不是摘要，而是幫他看見自己可能沒注意到的關聯。

讀完資料後，他最理想的感受是：「原來我今天是這個狀態」或「原來這兩件事有關係」。最差的結果是把剛才填過的內容再講一次。

【必須綜合，不得漏看】
今日心情、身體狀況、睡眠時間、睡眠品質、起床精神、今日感謝、今日事件。

【核心任務】
找出今天最明顯的「身心落差、共同訊號、或值得注意的地方」，濃縮成一句核心結論。
例如：心安定但睡眠只有 5–6 小時 → 「今天的心是安定的，但身體正在提醒你：休息還需要再多一點。」
禁止把感謝清單、事件細節、勾選項目逐條複述。感謝與事件只用來理解今天的氛圍與負荷，不要寫成「今天被愛包圍、baby 的傘、清水、陪伴」。

【語氣：70% 客觀觀察 + 20% 個人化連結 + 10% 溫度】
像把資料放在一起看的人，不是療癒師。禁止每次都用：溫柔地、慢慢地、被愛包圍、讓自己鬆一口氣、給自己一段療癒時光、身體知道夜晚來了。這些詞偶爾一句可以，不可當固定腔。
禁止診斷、醫療判斷、把推測寫成事實。不要寫「你的神經系統正在緊繃」「自律神經失調」。改成溫和推測：「如果今天同時感到疲憊與難以放鬆，可能代表身體還需要一些時間慢下來。」

【① 今天的身心訊號】
分析資料之間的關係，不要重述填寫內容。
壞例子：「今天心情很好，身體也很平穩，睡眠 5–6 小時。」
好例子：「今天情緒整體平穩，生活中也感受到不少幸福；但昨晚只有 5–6 小時睡眠，代表心理狀態雖然穩定，身體的休息可能還沒有完全跟上。」

【② 今天值得留意的地方】
指出可能被忽略的訊號。若沒有明顯問題，就直接說今天整體狀態穩定，不要硬找問題。

【③ 今晚可以這樣照顧自己】
依當天真正出現的訊號，動態給 1～3 個建議：
- 沒有明顯問題 → 1 個
- 一個主要訊號 → 1～2 個
- 多個值得注意的訊號 → 最多 3 個
禁止為了湊滿 3 個而給無關建議。
每一條都必須能回答「為什麼今天特別建議我做這件事？」並對應今天的資料。
禁止通用建議：多喝水、深呼吸、放下手機、早點休息——除非今天的資料明確支持。
禁止沒有根據的飲食與健康建議：喝溫牛奶、某種茶、補充營養、改善自律神經、幫助某種身體功能。
建議以低風險日常行動為主：調整睡眠時間、減少今晚安排、短暫休息、簡單伸展、放慢節奏、記錄情緒、或與當日狀態直接相關的小行動。

規則：
- 只輸出 JSON，繁體中文
- title 1～2 句，不列舉使用者填過的內容
- analysis 2～4 句，寫關聯，不寫清單
- notice 1～3 句
- suggestions 1 到 3 條，禁止固定 3 條
- 每條 title 8-16 字（動作名），detail 說明今晚為什麼特別適合，20-48 字
{
  "title": "今天的心是安定的，但身體正在提醒你：休息還需要再多一點。",
  "analysis": "今天情緒整體平穩，生活中也感受到不少幸福；但昨晚只有5–6小時睡眠，代表心理狀態雖然穩定，身體的休息可能還沒有完全跟上。",
  "notice": "幸福與短睡眠同時出現時，人很容易只看見心情好的那一面，而略過身體其實還沒補回來。",
  "suggestions": [
    { "title": "今晚提早30分鐘準備睡覺", "detail": "昨晚睡眠時間偏短，今晚不用增加太多任務，先替自己多留30分鐘的休息空間。" }
  ]
}`;

function bodyCoachUserPrompt(body) {
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  return `請綜合下面全部資料，寫出「今日身心小結」。重點是找出關聯與落差，不要摘要複述。

今日心情：${ctx.mood || "未選"}
今日感謝：${formatThanksForPrompt(ctx) || "（未寫）"}
今日事件：${ctx.event || body.text || "（未寫）"}
${formatBodyCheckPrompt(ctx)}

請輸出 title、analysis、notice，以及 1 到 3 條對應今天資料的 suggestions。`;
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

function normalizeBodyCoachResult(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : Array.isArray(data.tips) ? data.tips : [])
    .map(normalizeBodyCoachSuggestion)
    .filter(Boolean)
    .slice(0, 3);
  let title = String(data.title || data.conclusion || data.core || "").trim();
  let analysis = String(data.analysis || data.signals || data.summary || "").trim();
  const notice = String(data.notice || data.watch || data.attention || "").trim();
  if (!title && analysis) {
    title = firstBodyCoachSentence(analysis);
    const rest = analysis.slice(title.length).trim();
    if (rest) analysis = rest;
  }
  if (title && analysis.startsWith(title)) {
    analysis = analysis.slice(title.length).replace(/^[。！？\s]+/, "");
  }
  return {
    title,
    analysis,
    notice,
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

function firstAwarenessSentence(text) {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  const match = raw.match(/^[^。！？!?]+[。！？!?]?/);
  return (match ? match[0] : raw).replace(/[，,、；;]+$/g, "").trim();
}

function cleanAwarenessQuote(text) {
  return firstAwarenessSentence(text)
    .replace(/^["「『]+|[」』"]+$/g, "")
    .replace(/^[\d.、｜|\-\s]+/, "")
    .trim()
    .slice(0, 28);
}

function compactAwarenessText(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max || 220);
}

function compactAwarenessBlock(value, max) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, max || 220);
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
  return { seen: "", gap: "", question: "", line: "", echo: "" };
}

function normalizeAwarenessResult(raw, recentDays) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nested = src.result && typeof src.result === "object" ? src.result : src;
  let seen = softenAwarenessClaim(compactAwarenessBlock(nested.seen || nested.selfSeen || nested.todaySeen || nested.iSee, 100));
  const gap = softenAwarenessClaim(compactAwarenessBlock(nested.gap || nested.overlooked || nested.missed, 150));
  let question = compactAwarenessText(nested.question || nested.tonight || nested.prompt || nested.eveningQuestion, 72);
  if (isGenericAwarenessQuestion(question)) question = "";
  if (question && !/[？?]$/.test(question)) question = `${question.replace(/[。.!！]+$/g, "")}？`;
  let line = compactAwarenessText(nested.line || nested.quote || nested.oneLine, 22);
  if (!line && Array.isArray(src.quotes) && src.quotes[0]) line = cleanAwarenessQuote(src.quotes[0]).slice(0, 22);
  if (!seen && line) seen = line;
  const echo = sanitizeAwarenessEcho(nested.echo || nested.weekly || nested.crossDay || nested.pattern, recentDays);
  if (!seen) return emptyAwarenessResult();
  return { seen, gap, question, line, echo };
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
  const raw = String(text || "").trim();
  const idx = raw.search(/[：:]/);
  if (idx > 0 && idx < raw.length - 1) {
    return { title: raw.slice(0, idx).trim(), detail: raw.slice(idx + 1).trim() };
  }
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
  return /vs|VS|真因|卡點|假二選一|自我修復|盲點|真正的原因|突破策略|難長的真實|深層原因|跟自己相處/.test(text);
}

function firstExecSentence(text, max) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  const match = raw.match(/^[^。！？!?]+[。！？!?]?/);
  return (match ? match[0] : raw).trim().slice(0, max || 22);
}

function shortenExecHow(detail) {
  const text = firstExecSentence(detail, 22);
  if (/真正卡住|深層原因|自我修復|真因|核心卡點|為什麼|才比較容易|先讓身體|替明天保留/.test(text)) {
    return "先做5分鐘，做完就勾起來。";
  }
  return text || "先做5分鐘，做完就勾起來。";
}

function shortenExecWhy(detail) {
  const text = firstExecSentence(detail, 28);
  if (/真正卡住|深層原因|自我修復|真因|核心卡點/.test(text)) {
    return "先做會影響其他事情的那一件。";
  }
  return text || "先做會影響其他事情的那一件。";
}

function looksLikeTodayStartable(title) {
  const text = String(title || "").trim();
  if (!text) return false;
  if (/明天/.test(text) && /今晚|現在/.test(text)) return false;
  if (/^明天/.test(text) || /明天\d|明天11|明天.*睡覺/.test(text)) return false;
  return /今晚|現在|此刻|睡前|回家後|洗澡後|放下手機|準備睡/.test(text);
}

function rewriteExecActionTitle(title, detail, smallestStep, index) {
  const cleaned = String(title || "").replace(/^[\d.、｜|\-\s]+/, "").trim();
  if (cleaned && !looksLikeAnalysisExecTitle(cleaned)) return cleaned.slice(0, 22);
  const step = String(smallestStep || "").trim().replace(/[。！？.]+$/g, "");
  if (index === 0 && step && step.length <= 22 && !looksLikeAnalysisExecTitle(step)) return step.slice(0, 22);
  const fallbacks = ["今晚22:30開始準備睡覺", "明天早餐後先做5分鐘", "替這件事排一個開始時間"];
  return fallbacks[index] || fallbacks[0];
}

function rewriteExecFocus(focus, items, smallestStep, ctx) {
  const list = Array.isArray(items) ? items : [];
  const source = focus && typeof focus === "object" ? focus : {};
  let title = rewriteExecActionTitle(source.title || list[0]?.title || "", source.detail, smallestStep, 0);
  const blob = [title, smallestStep, list.map((item) => item.title).join(" "), JSON.stringify(ctx || {})].join(" ");
  if (!looksLikeTodayStartable(title)) {
    const todayCard = list.find((item) => looksLikeTodayStartable(item.title));
    if (todayCard) title = todayCard.title;
    else if (/睡|疲|累|精神不足/.test(blob)) title = "今晚22:30開始準備睡覺";
    else title = "現在先設定一個開始時間";
  }
  return {
    title: String(title || "今晚22:30開始準備睡覺").slice(0, 22),
    detail: shortenExecWhy(source.detail || list[0]?.detail),
  };
}

function normalizeExecutionChecklistItems(raw, min, max, smallestStep) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : [];
  const items = [];
  const seen = new Set();
  list.forEach((item, index) => {
    let title = "";
    let detail = "";
    if (typeof item === "string") {
      const parts = splitChecklistTitle(item);
      title = parts.title;
      detail = parts.detail;
    } else if (item && typeof item === "object") {
      title = String(item.title || item.label || item.text || "").trim();
      detail = flattenExecSentence(item);
      if (!detail && title) {
        const parts = splitChecklistTitle(title);
        title = parts.title;
        detail = parts.detail;
      }
    }
    title = rewriteExecActionTitle(title.replace(/^[\d.、｜|\-\s]+/, ""), detail, smallestStep, index);
    detail = shortenExecHow(detail);
    if (!title || seen.has(title)) return;
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
    return `請依這個人今天的行動問題與「明天最小的一步」，產出 1 到 3 張行動卡。

標題直接寫時間＋動作。說明只寫一句怎麼做，不要寫為什麼。
今天最重要的一步只能一件，而且必須是今天／現在就能開始的行動。睡眠會擋住其他事時，先顧今晚睡覺。

${labeled}

明天最小的一步（請盡量收成時間＋動作）：${ctx.smallestStep || "未寫"}

背景（只用來對準行動，不要寫成分析）：
今日感謝：${formatThanksForPrompt(ctx) || "未寫"}
心情：${ctx.mood || "未選"}
今日事件：${ctx.event || "未寫"}
${formatBodyCheckPrompt(ctx)}
今日覺察：${Array.isArray(ctx.awareness) ? ctx.awareness.filter(Boolean).join("／") || "未寫" : ctx.awareness || "未寫"}
尚未完成的行動：${openActions.slice(0, 6).join("、") || "尚無"}`;
  }
  const labeled = questions.length
    ? questions
        .map((question, index) => `${index + 1}. ${question}\n作答：${answers[index] || "（未答）"}`)
        .join("\n\n")
    : `是非題作答：${answer || "（未答）"}`;
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

const AWARENESS_PROMPTS_SYSTEM = `你是「日精進」的覺察引導者。先從今天的感謝、事件、心情、身體、睡眠裡找出 3 個「可能的假設」，再寫成短的驗證型是非題，讓使用者自己確認。

真正目的：少一點分析，多一點讓使用者自己確認。
不是：先替他下結論、診斷人格、或把今天所有資訊塞進同一題。

【出題方式】
一題只驗證一個覺察假設。看完應該可以很直覺地選「是／否」。

規則：
- 只輸出 JSON：{"awareness":[{"question":"..."},{"question":"..."},{"question":"..."}]}
- 剛好 3 題。一題一事，優先 1～2 句，約 28-68 字
- 最多使用兩個今日線索建立關聯，最後只能問一件事
- 禁止把睡眠、心情、事件、陪伴、身體一次塞進同一題
- 必須有今日資料依據，貼近原文用詞，語氣白話、自然
- 不要預設答案，不要診斷人格，不要過度心理分析
- 禁止：「你其實在期待…」「你真正的防衛…」「你一直都…」「你就是…」
- 資料少就問得更短、更具體，不要硬湊深度
- 繁體中文

第1題：感謝或被對待的小事 × 心情（只問這一件）
合格：「昨天睡得普通，但今天有人陪伴時，你的心情明顯變好。對你來說，『有人陪著』是不是很能影響一天的心情？」
不合格：「昨天睡眠普通、今天起床精神普通，但因為 baby 陪伴、撐傘以及喝水讓你感到幸福，你是不是很容易因為關係中的陪伴而影響今天整體的情緒狀態？」

第2題：身體／睡眠 × 行動或腦中待辦（只問這一件）
合格：「今天身體已經有疲累的訊號，腦中卻還在排下一件事。你是不是常常累了，才想到自己需要休息？」

第3題：事件或情緒 × 另一個今日線索（只問這一件）`;

const EXECUTION_PROMPTS_SYSTEM = `你是「日精進」的行動教練。04 負責分析；你只問「接下來怎麼做」。少分析、多行動。

請先默默讀完今天的感謝、事件、心情、身體、睡眠與覺察，再出 2～3 題。
可以輕輕點出今天的人／事，方便對準；禁止抄寫時數、連續天數，禁止二選一質問。

出題順序：
1. 調整策略：如果明天狀況還是不理想，原本想做的事要怎麼改。不要逼他先休息或先做某件。
   合格：「如果明天還是覺得累，你準備怎麼調整原本想做的事？」
   不合格：「身體疲勞的狀態下，明天三件開心小事和運動，你想先從哪一件開始？」
2. 推進到具體行動：今天若有難受或卡住，問明天要做哪一件事讓自己比較好。不要停在怎麼想、怎麼感受、怎麼跟自己相處。
   合格：「今天和寶貝的對話讓你有些難受，明天你想做哪一件事，讓自己回到比較好的狀態？」
   不合格：「今天和寶貝的對話讓你有些難受，明天想用什麼方式跟自己相處？」
3. 可選：把行動收到時間。「明天你準備什麼時間開始做這件事？」

語言請用：
你準備怎麼調整？你要先做哪一步？明天什麼時間開始？這件事可以再小一點嗎？現在先做什麼？
禁止：真正卡住你的、深層原因、自我修復、假二選一、真因、核心卡點。

placeholder 給具體做法，不要給分析句。
第1題：「例如：運動改到下午／先完成一件最重要的事／先休息再開始」
第2題：「例如：散步10分鐘／寫下心情／留30分鐘做喜歡的事」

規則：
- 只輸出 JSON：{"execution":[{"question":"...","placeholder":"..."}]}
- 一題一事，一個問號
- 每題 24-48 字
- execution 2 到 3 題
- 繁體中文`;

const CORE_PROMPTS_SYSTEM = `你是「日精進」溫柔的覺察與行動教練。請精準讀取使用者今天寫下的感謝、事件、心情與身體覺察，動態生成「只屬於今天」的覺察力與執行力題目。

【任務】
- awareness：剛好 3 道短的驗證型是非題。一題只驗證一個假設，優先 1～2 句（28-68字）。最多用兩個今日線索，最後只問一件事。不要把睡眠、心情、事件、身體一次塞進同一題。不要預設動機、不要診斷、不要替他下結論。
- execution：2 到 3 道行動問題。第1題問怎麼調整，不要二選一。第2題問明天要做哪一件事，不要停在感受。不要用真正卡住、真因、自我修復。

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
    { "question": "完整問句，24-48字", "placeholder": "例如：具體做法…" }
  ]
}
awareness 必須剛好 3 題。execution 2 到 3 題即可，不要為了湊數硬出。`;

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
    return `請只生成 3 道短的驗證型覺察是非題。不要寫執行題，不要總結，不要替他下結論。

一題只驗證一個假設。優先 1～2 句，約 28-68 字。最多用兩個今日線索，最後只問一件事。
不要把睡眠、心情、事件、陪伴、身體一次塞進同一題。資料少就問得更短。

合格：昨天睡得普通，但今天有人陪伴時，你的心情明顯變好。對你來說，「有人陪著」是不是很能影響一天的心情？
不合格：昨天睡眠普通、今天起床精神普通，但因為 baby 陪伴、撐傘以及喝水讓你感到幸福，你是不是很容易因為關係中的陪伴而影響今天整體的情緒狀態？

${today}`;
  }
  if (kind === "execution") {
    return `請只生成 2 到 3 道行動問題。不要寫覺察是非題。少分析、多行動。

【今天的輸入｜理解情境，不要把時數或連續天數抄進題目】
${story}
今日覺察：${Array.isArray(ctx.awareness) ? ctx.awareness.filter(Boolean).join("／") || "未寫" : "未寫"}
明天最小的一步：${compactLine(ctx.smallestStep, 80) || "未寫"}

第1題必須是調整策略，不要二選一：
合格：如果明天還是覺得累，你準備怎麼調整原本想做的事？
不合格：身體疲勞的狀態下，明天三件開心小事和運動，你想先從哪一件開始？

第2題必須問「明天做哪一件事」，不要問怎麼跟自己相處：
合格：今天和寶貝的對話讓你有些難受，明天你想做哪一件事，讓自己回到比較好的狀態？
不合格：明天想用什麼方式跟自己相處？

placeholder 用具體做法，例如：運動改到下午／散步10分鐘。`;
  }
  return `請精準讀取以下「今天的原文」，生成只屬於這一天的覺察力 3 題驗證型是非題、執行力 2 到 3 題。

${today}

覺察是非題：剛好 3 題。一題一事、1～2 句、最多兩個線索。用是／否驗證，不要替他下結論。
執行題：2 到 3 題。第1題問怎麼調整，第2題問明天做哪一件事。不要二選一，不要分析用語。`;
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
    const question = item.trim();
    return question ? { question: question.slice(0, 96), placeholder: "寫下那個時刻…" } : null;
  }
  if (!item || typeof item !== "object") return null;
  const question = String(
    item.question || item.title || item.text || item.prompt || item.statement || item.label || ""
  ).trim();
  if (!question) return null;
  return {
    question: question.slice(0, 96),
    placeholder: String(item.placeholder || "寫下那個時刻…").trim().slice(0, 48) || "寫下那個時刻…",
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
  const bodyText = `${JSON.stringify((ctx && ctx.bodyCheck) || {})}${ctx && ctx.bodyNote ? ctx.bodyNote : ""}${(Array.isArray(ctx && ctx.bodyTags) ? ctx.bodyTags : []).join("")}`;
  const tired = /疲|累|少於5|5–6|精神不足|痠|緊/.test(bodyText);
  const mood = compactLine(ctx && ctx.mood, 6);
  return [
    {
      question: thanksBit
        ? `今天寫下「${thanksBit}」時心裡有溫度。對你來說，「有人把你放在心上」是不是很能影響這一天的心情？`
        : `在「${eventBit}」裡，你特別有感覺的，是不是「有人陪著／想到你」這件事？`,
    },
    {
      question: tired
        ? "今天身體已經有累的訊號，腦中卻還在排下一件事。你是不是常常累了，才想到自己需要休息？"
        : "今天如果狀態已經不太滿，你腦中是不是還是會先出現明天想完成的事？",
    },
    {
      question: mood
        ? `今天的心情是「${mood}」。這份感覺裡，你是不是比較快注意到別人，比較慢才注意到自己？`
        : "今天發生的事情裡，你是不是比較快看見別人，比較慢才看見自己需要什麼？",
    },
  ];
}

function isBloatedAwarenessQuestion(question) {
  const text = String(question || "").trim();
  if (!text) return true;
  if (text.length > 78) return true;
  const topics = ["睡眠", "心情", "事件", "陪伴", "身體", "精神", "感謝"].filter((key) => text.includes(key));
  if (topics.length >= 3) return true;
  if ((text.match(/、/g) || []).length >= 3) return true;
  return false;
}

function padAwarenessPrompts(list, ctx) {
  const extras = awarenessPromptFallbacks(ctx);
  const next = uniquePromptList(
    (list || [])
      .map((item) => {
        const question = String(item?.question || "").trim().slice(0, 72);
        return question && !isBloatedAwarenessQuestion(question) ? { question } : null;
      })
      .filter(Boolean)
  );
  extras.forEach((item) => {
    if (next.length >= 3) return;
    next.push(item);
  });
  return next.slice(0, 3);
}

function isBloatedExecQuestion(question) {
  const text = String(question || "").trim();
  if (!text) return true;
  if (text.length > 48) return true;
  if ((text.match(/[？?]/g) || []).length > 1) return true;
  return /睡眠只有|\d小時|連續\d|能量從哪裡|先補睡還是|才不會又|待辦清單|突破策略|vs|真因|自我修復|卡點|真正卡住|跟自己相處|先從哪一件|深層原因/.test(text);
}

function executionQuestionFallbacks() {
  return [
    {
      question: "如果明天還是覺得累，你準備怎麼調整原本想做的事？",
      placeholder: "例如：運動改到下午／先完成一件最重要的事／先休息再開始",
    },
    {
      question: "明天你想做哪一件事，讓自己回到比較好的狀態？",
      placeholder: "例如：散步10分鐘／寫下心情／留30分鐘做喜歡的事",
    },
    {
      question: "明天你準備什麼時間開始做這件事？",
      placeholder: "例如：早餐後／22:30／下午3點",
    },
  ];
}

function padExecutionPrompts(list) {
  const fallbacks = executionQuestionFallbacks();
  const cleaned = uniquePromptList(list).map((item, index) => {
    const question = String(item?.question || "").trim();
    if (!isBloatedExecQuestion(question)) {
      return {
        question: question.slice(0, 48),
        placeholder: String(item?.placeholder || fallbacks[index]?.placeholder || "寫下你準備做的一小步…").slice(0, 48),
      };
    }
    return fallbacks[index] || fallbacks[0];
  });
  const next = uniquePromptList(cleaned);
  fallbacks.forEach((item) => {
    if (next.length >= 2) return;
    if (next.some((entry) => entry.question === item.question)) return;
    next.push(item);
  });
  return next.slice(0, 3);
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
      if (isThinkGuideRequest(body) && thinkGuideStep(body) === "close") {
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
      messages = [
        { role: "system", content: kind === "execution" ? CHECKLIST_EXECUTION_SYSTEM : CHECKLIST_AWARENESS_SYSTEM },
        { role: "user", content: checklistUserPrompt(kind, body) },
      ];
    } else if (mode === "insight") {
      if (isThinkGuideRequest(body)) {
        const close = thinkGuideStep(body) === "close";
        messages = [
          { role: "system", content: close ? THINK_GUIDE_CLOSE_SYSTEM : THINK_GUIDE_ASK_SYSTEM },
          { role: "user", content: thinkGuideUserPrompt(body) },
        ];
      } else {
        messages = [
          { role: "system", content: isQuickInsightRequest(body) ? QUICK_INSIGHT_SYSTEM : INSIGHT_SYSTEM },
          { role: "user", content: insightUserPrompt(body) },
        ];
      }
    } else if (mode === "deepen") {
      messages = [
        { role: "system", content: DEEPEN_SYSTEM },
        { role: "user", content: deepenUserPrompt(body) },
      ];
    } else if (mode === "prompts") {
      const promptKind = isCorePromptsRequest(body) ? corePromptKind(body) : "";
      messages = [
        {
          role: "system",
          content: promptKind === "awareness"
            ? AWARENESS_PROMPTS_SYSTEM
            : promptKind === "execution"
              ? EXECUTION_PROMPTS_SYSTEM
              : isCorePromptsRequest(body)
                ? CORE_PROMPTS_SYSTEM
                : PROMPTS_SYSTEM,
        },
        {
          role: "user",
          content: isCorePromptsRequest(body) ? corePromptsUserPrompt(body, promptKind || "core") : promptsUserPrompt(body),
        },
      ];
    } else if (mode === "manifest") {
      const prompts = isManifestPromptsRequest(body);
      messages = [
        { role: "system", content: prompts ? MANIFEST_PROMPTS_SYSTEM : MANIFEST_PATHS_SYSTEM },
        { role: "user", content: prompts ? manifestPromptsUserPrompt(body) : manifestPathsUserPrompt(body) },
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

    const promptKind = isCorePromptsRequest(body) ? corePromptKind(body) : "";
    const data = await callOpenAI(messages, {
      temperature:
        mode === "bodycoach"
          ? 0.5
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
      timeoutMs: promptKind === "awareness" ? 18000 : 22000,
      maxTokens:
        mode === "bodycoach"
          ? 900
          : mode === "insight" && isThinkGuideRequest(body)
          ? thinkGuideStep(body) === "close"
            ? 1100
            : 400
          : mode === "prompts" && promptKind === "awareness"
            ? 700
          : mode === "prompts" && promptKind === "execution"
              ? 700
              : mode === "prompts" && isCorePromptsRequest(body)
                ? 1100
                : mode === "manifest"
                  ? isManifestPromptsRequest(body)
                    ? 500
                    : 800
                : mode === "checklist"
                  ? body.kind === "execution"
                    ? 600
                    : 1100
                  : 1400,
    });
    if (mode === "checklist") {
      const kind = body.kind === "execution" ? "execution" : "awareness";
      if (kind === "awareness") {
        const result = normalizeAwarenessResult(data, body.progress);
        if (!result.seen) {
          res.status(502).json({ ok: false, error: "今天的覺察還沒整理好，請再試一次" });
          return;
        }
        const quotes = result.line
          ? [result.line]
          : normalizeAwarenessQuotes([result.seen]);
        res.status(200).json({ ok: true, source: getProvider(), data: { result, quotes, items: quotes, kind } });
        return;
      }
      const min = 1;
      const max = 3;
      const smallestStep = String(body.context?.smallestStep || "").trim();
      const items = normalizeExecutionChecklistItems(data, min, max, smallestStep);
      if (items.length < min) {
        res.status(502).json({ ok: false, error: "今天的行動卡還沒整理好，請再試一次" });
        return;
      }
      const focusSource = data && typeof data === "object" ? data.focus || data.priority || items[0] : items[0];
      const focus = rewriteExecFocus(focusSource, items, smallestStep, body.context);
      res.status(200).json({ ok: true, source: getProvider(), data: { items: items.slice(0, max), focus, kind } });
      return;
    }
    if (mode === "insight") {
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
        const asked = normalizeThinkGuideAsk(data);
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
        const awareness = padAwarenessPrompts(prompts.awareness, { ...ctx, text: body.text });
        if (prompts.awareness.length < 1) {
          res.status(502).json({ ok: false, error: "今天的覺察題還沒準備好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: { awareness, execution: [] } });
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
        prompts.awareness = padAwarenessPrompts(prompts.awareness, { ...ctx, text: body.text });
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
        if (questions.length < 2) {
          res.status(502).json({ ok: false, error: "今天的顯化思考題還沒準備好，請再試一次" });
          return;
        }
        res.status(200).json({ ok: true, source: getProvider(), data: { questions, kind: "manifest" } });
        return;
      }
      const items = normalizeManifestPathItems(data);
      if (items.length < 2) {
        res.status(502).json({ ok: false, error: "靠近現實的方向還沒整理好，請再試一次" });
        return;
      }
      const sentence = normalizeManifestSentence(data, vision);
      res.status(200).json({ ok: true, source: getProvider(), data: { items: items.slice(0, 3), sentence, kind: "manifest" } });
      return;
    }
    if (mode === "bodycoach") {
      const coach = normalizeBodyCoachResult(data);
      if (!(coach.title || coach.analysis) || coach.suggestions.length < 1) {
        res.status(502).json({ ok: false, error: "今天的身心建議還沒整理好，請再試一次" });
        return;
      }
      res.status(200).json({ ok: true, source: getProvider(), data: coach });
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
