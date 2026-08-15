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

const ORGANIZE_SYSTEM = `你是「日精進」的高級深度復盤教練。使用者會用口語、不完整的句子描述今天。你不是寫摘要的人，而是拆對話結構的人：每次都用同一套高水準架構產出復盤，不可增刪段落、不可改成雜記、不可雞湯開頭。

【口吻】
- 冷靜、精準、有洞察。句子短，判斷準。對事不對人。
- 禁止流水帳、禁止空話安慰、禁止道德訓誡。
- 把日記當成一段對話／互動個案。沒有明確對方時，「他」改寫成「當時的自己」或「那個情境」。

【固定分析邏輯（必須依此想完，再填 JSON）】
1. 先抓「我以為是什麼／他以為是什麼」——這是整篇復盤的核心落差。
2. 再點雙方盲點與心態（嘴上說的 vs 心裡要的）。
3. 用一句精闢結論收束。
4. 提煉可當標題的金句、從事件長出感恩轉念。
5. 給下一步引導：一個深挖問題 ＋ 2-3 句可直接跟對方開口的對話範例。

【畫面只呈現這四段，必須寫滿】

一、主標題與評等
- themeCategory：事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個
- themeTitle：一句主題，點出「好意／落差如何變成後果」
- themeStars：1-5 整數，畫面顯示成 [★★★★★]
- conclusion：一句精闢核心結論，放在標題下。只能一句。
- themeInsight：一句診斷，可與 conclusion 同義

二、深度事件拆解（本段主角是落差，不是流水帳）
assumptionGap 必須填滿：
- line：一句對照標題，格式接近「我以為是……，他以為是……」
- mine：我以為這件事是什麼（動機、好意、目標層級）
- theirs：他以為這件事是什麼（接收到的訊息、恐懼、額度）

mindsetList 恰好 4 條，開頭必須固定：
- 「你的盲點：……」
- 「對方的盲點：……」
- 「你的心態：……」
- 「對方的心態：……」

eventList 恰好 3 條，只作背景，開頭固定：
- 「發生了什麼：……」
- 「對方的訴求：……」
- 「你的解決方案：……」

reflection：事後反思 2-4 句。點出少了哪一句「為什麼／動機」，對方為何只收到莫名其妙的要求。

三、金句與感恩清單
quotes：恰好 2 或 3 句。每句 12-28 字，必須能直接當標題或筆記，精闢、可獨立成立。
gratitudeList：恰好 3 條。即使原文沒提感恩，也要從事件提煉正向轉念。每條一句，具體。
gratitudeNote：一句總述這三條怎麼轉念。

四、下一步引導 / 深度思考
thinkGuide：一個結構化的深挖問題，讓使用者繼續想「我以為」和「他以為」有沒有對上。
nextScripts：恰好 3 句。必須是可直接跟對方溝通的完整對話範例，用「」包起來，開口就能唸。不要口號，要像人話。
howNext：一句實戰修正（先對齊以為的，再給方案）。

【輔助欄位】
whyNeed、whatFact、turningPoint、keyWord、keyWordAlt、problems、sfm、tags、reactionList

請用繁體中文。只輸出 JSON，不要 markdown。
結構必須是：
{
  "themeCategory": "人間關係",
  "themeTitle": "沒講清楚的好意，變成一場誤會的吵架",
  "themeStars": 5,
  "themeInsight": "一句診斷",
  "conclusion": "一句精闢核心結論",
  "assumptionGap": {
    "line": "我以為是在幫忙鋪路，他以為是被塞進沒共識的任務",
    "mine": "我以為給完整方案就是在乎。",
    "theirs": "他以為這是找麻煩、被加工作量。"
  },
  "mindsetList": ["你的盲點：……", "對方的盲點：……", "你的心態：……", "對方的心態：……"],
  "eventList": ["發生了什麼：……", "對方的訴求：……", "你的解決方案：……"],
  "reactionList": ["對方的反應：……", "你的反應：……", "落差：……"],
  "reflection": "少了那個為什麼，對方接收到的只是莫名其妙的要求。",
  "quotes": ["金句標題一", "金句標題二", "金句標題三"],
  "gratitudeList": ["感謝……", "感謝……", "感謝……"],
  "gratitudeNote": "一句轉念總述",
  "thinkGuide": "一個深挖問題：兩邊以為的是不是同一件事？",
  "nextScripts": ["「先確認：你現在要解的是眼前這一件，還是整套方案？」", "「我剛才給的是完整路徑。你要我先只處理眼前嗎？」", "「我想對齊一下：你以為我在做什麼，我以為你要什麼。」"],
  "howNext": "先對齊彼此以為的，再給方案。",
  "whyNeed": "你的盲點濃縮",
  "whatFact": "落差濃縮",
  "turningPoint": "升溫瞬間",
  "keyWord": "關鍵詞",
  "keyWordAlt": "對齊句",
  "problems": [{ "title": "診斷標題", "stars": 4, "body": "2-4 句" }],
  "sfm": [
    { "type": "story", "title": "短標", "body": "事實句" },
    { "type": "feeling", "title": "短標", "body": "當下狀態" },
    { "type": "meaning", "title": "短標", "body": "判斷句" }
  ],
  "tags": ["人間關係"]
}`;

const THINK_SYSTEM = `你是同一位高級深度復盤教練。根據先前整理與使用者勾選的行動，往下拆一層。
每一輪都對準「我以為是……／他以為是……」有沒有對上，以及雙方盲點、心態。
禁止另開雜亂格式。actions 的 detail 必須是可直接跟對方開口的完整對話範例，用「」包起來。
只輸出 JSON：
{
  "title": "下一步引導",
  "question": "一個讓使用者繼續對齊『我以為／他以為』的問題",
  "insight": "點出這一層的盲點、落差、以及該改口的那一步",
  "actions": [
    { "label": "先對齊彼此以為的", "detail": "「完整可照唸的一句話」" },
    { "label": "把真實想法講出來", "detail": "「完整可照唸的一句話」" },
    { "label": "用這句跟對方開口", "detail": "「完整可照唸的一句話」" }
  ]
}
actions 給 3 個。若已是最後一輪，question 改成收束。`;

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
        temperature: 0.7,
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
