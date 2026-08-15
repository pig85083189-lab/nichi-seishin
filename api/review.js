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
  "title": "深度思考",
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
points 給 1-3 個，每個 conclusion 只能一句。actions 給 3 個。若已是最後一輪，question 改成收束。`;

async function callOpenAI(messages) {
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
        temperature: 0.75,
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
      model: String(process.env.OPENAI_MODEL || "gpt-4o-mini"),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "只接受 POST" });
    return;
  }

  try {
    const body = readJsonBody(req);
    const mode = body.mode === "think" ? "think" : "organize";
    const text = String(body.text || "").trim();
    if (!text && mode === "organize" && !Array.isArray(body.messages)) {
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

    const data = await callOpenAI(messages);
    res.status(200).json({ ok: true, source: "openai", data });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? "OpenAI 逾時" : String(error.message || "伺服器錯誤"),
    });
  }
};
