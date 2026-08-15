function joinChatCompletionsUrl(baseUrl) {
  let raw = String(baseUrl || "https://api.openai.com/v1").trim() || "https://api.openai.com/v1";
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    let path = (url.pathname || "").replace(/\/+$/, "");
    if (path === "/") path = "";
    path = path.replace(/(\/v1)+$/i, "/v1");
    if (!/\/v1$/i.test(path)) path = `${path}/v1`;
    if (!/\/chat\/completions$/i.test(path)) path = `${path}/chat/completions`;
    url.pathname = path.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    const cleaned = raw.replace(/\/+$/, "").replace(/(\/v1)+/gi, "/v1");
    if (/\/chat\/completions$/i.test(cleaned)) return cleaned;
    if (/\/v1$/i.test(cleaned)) return `${cleaned}/chat/completions`;
    return `${cleaned}/v1/chat/completions`;
  }
}

function parseAiJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI 回傳不是 JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

const ORGANIZE_SYSTEM = `你是「日精進」的專業心理教練，也是直白、注重溝通邏輯的復盤教練。使用者會用口語、不完整的句子描述今天。你必須每次都產出同一套條理分明、直擊重點的復盤，不可省略任何一段。

【語氣】
- 冷靜、客觀、像專業教練在拆個案。句子短、判斷準。
- 禁止感性開場與過度安慰。對事不對人。

【強制輸出結構（依此順序寫滿，不可缺段）】

1. 主標題與星等
- themeCategory：事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個
- themeTitle：一句精煉主題，點出「好意／落差如何變成後果」。例如：「沒講清楚的好意，變成一場誤會的吵架」
- themeStars：1-5 整數，畫面會顯示成 [★★★★☆]
- themeInsight：標題下的一句診斷，直戳結構，不要抒情

2. 事件拆解（eventList，恰好 3 條，必須用以下開頭）
- 「發生了什麼：……」
- 「對方的訴求：……」
- 「你的解決方案：……」

3. 結果與反應（reactionList，恰好 3 條，必須用以下開頭）
- 「對方的反應：……」
- 「你的反應：……」
- 「落差：……」客觀寫雙方目標／資訊／額度沒對上的地方。

4. 事後反思（reflection）
- 點出問題核心：少了哪一句「為什麼／動機／目標層級」，對方接收到的就只剩一個莫名其妙、多此一舉的要求。
- 2-4 句，具體，不要空話。

5. 核心結論
- conclusion：只用一句話總結教訓
- quotes：2-3 句今日金句，每句 12-40 字
- thinkGuide：1-2 句思維引導
- howNext：實戰修正
- nextScripts：2-3 句下次可直接照唸的對話腳本

【仍需填的輔助欄位】
- whyNeed、whatFact、turningPoint、keyWord、keyWordAlt、problems、gratitudeNote、sfm、tags

請用繁體中文。只輸出 JSON，不要 markdown。
結構必須是：
{
  "themeCategory": "人間關係",
  "themeTitle": "沒講清楚的好意，變成一場誤會的吵架",
  "themeStars": 4,
  "themeInsight": "一句診斷",
  "eventList": ["發生了什麼：……", "對方的訴求：……", "你的解決方案：……"],
  "reactionList": ["對方的反應：……", "你的反應：……", "落差：……"],
  "reflection": "少了那個為什麼，對方接收到的只是莫名其妙的要求。",
  "conclusion": "一句話教訓",
  "quotes": ["今日金句1", "金句2"],
  "thinkGuide": "下次開口前先對齊什麼",
  "whyNeed": "核心盲點",
  "whatFact": "溝通誤區",
  "howNext": "實戰修正",
  "turningPoint": "升溫瞬間",
  "keyWord": "關鍵詞",
  "keyWordAlt": "對齊句",
  "nextScripts": ["「先確認：你現在要解的是眼前這一件，還是整套方案？」"],
  "problems": [{ "title": "診斷標題", "stars": 4, "body": "2-4 句" }],
  "gratitudeNote": "一句帶過",
  "sfm": [
    { "type": "story", "title": "短標", "body": "事實句" },
    { "type": "feeling", "title": "短標", "body": "當下狀態" },
    { "type": "meaning", "title": "短標", "body": "判斷句" }
  ],
  "tags": ["人間關係"]
}`;

const THINK_SYSTEM = `你是同一位直白、犀利、注重溝通邏輯的復盤教練。根據先前整理與使用者勾選的行動，往下拆一層。
語氣冷靜、客觀、直戳核心。禁止感性安慰。
每一輪都對準：目標落差、資訊有沒有對齊、哪一步跳太快。
actions 的 detail 必須是下次可直接照唸、用來對齊目標的完整句子，不要空話。
只輸出 JSON：
{
  "title": "再拆一層",
  "question": "一個直擊結構的問題，例如兩邊的目標是不是同一層",
  "insight": "點出盲點、誤區、以及該改的那一步",
  "actions": [
    { "label": "先對齊目標層級", "detail": "完整可照唸的一句話" },
    { "label": "改掉跳太快的詞", "detail": "完整可照唸的一句話" },
    { "label": "只處理眼前這一步", "detail": "完整可照唸的一句話" }
  ]
}
actions 給 3 個。若已是最後一輪，question 改成收束。`;

async function callOpenAI(messages, options = {}) {
  const apiKey = String(options.apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("缺少 API Key（請在前端設定，或在 Vercel 設 OPENAI_API_KEY）");
    error.status = 500;
    throw error;
  }

  const provider = String(options.provider || "openai");
  const url = joinChatCompletionsUrl(options.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://nichi-seishin.vercel.app";
    headers["X-Title"] = "nichi-seishin";
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error((data && data.error && data.error.message) || `上游請求失敗（${response.status}）`);
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "只接受 POST" });
    return;
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
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

    const data = await callOpenAI(messages, {
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      model: body.model,
      provider: body.provider,
    });
    res.status(200).json({ ok: true, data });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? "OpenAI 逾時" : String(error.message || "伺服器錯誤"),
    });
  }
};
