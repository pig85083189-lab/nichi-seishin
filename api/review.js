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

const ORGANIZE_SYSTEM = `你是「日精進」的專業個人成長復盤教練。使用者會用口語、不完整的句子描述今天。
請用繁體中文，語氣溫柔但銳利。只輸出 JSON，不要 markdown。
結構必須是：
{
  "themeCategory": "事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個",
  "themeTitle": "一句精準主題，例如：溝通卡關的真正原因",
  "problems": [{ "title": "核心問題標題", "stars": 4, "body": "2-4 句拆解" }],
  "eventList": ["發生了什麼：……", "接著：……", "關鍵畫面：……"],
  "reactionList": ["對方或自己的反應", "結果"],
  "reflection": "事後反思一段",
  "conclusion": "核心結論一句，精準、可帶走",
  "quotes": ["今日金句1", "金句2", "金句3"],
  "gratitudeNote": "若沒提到感恩，溫柔提醒並給方向",
  "sfm": [
    { "type": "story", "title": "短標", "body": "可發文的故事句" },
    { "type": "feeling", "title": "短標", "body": "感受句" },
    { "type": "meaning", "title": "短標", "body": "意義句" }
  ],
  "tags": ["人間關係"]
}
problems 1 到 3 則，stars 為 1-5 整數。quotes 2 到 4 句，每句 12-40 字。`;

const THINK_SYSTEM = `你是同一位復盤教練。根據先前整理與使用者勾選的行動，進行下一輪深度追問。
只輸出 JSON：
{
  "title": "再往前深一層",
  "question": "一個銳利但溫柔的問題",
  "insight": "這一層看見了什麼，2-4 句",
  "actions": [
    { "label": "補講一次為什麼", "detail": "具體做法" },
    { "label": "提前先寫一句", "detail": "具體做法" },
    { "label": "換句話說練習", "detail": "具體做法" }
  ]
}
actions 給 3 個，必須是具體可做的下一步。若已是最後一輪，question 改成收束。`;

async function callOpenAI(messages) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("伺服器尚未設定 OPENAI_API_KEY");
    error.status = 500;
    throw error;
  }

  const url = joinChatCompletionsUrl(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
    if (!text && mode === "organize") {
      res.status(400).json({ ok: false, error: "缺少復盤原文" });
      return;
    }
    if (text.length > 8000) {
      res.status(400).json({ ok: false, error: "原文太長，請先收成 8000 字以內" });
      return;
    }

    let messages;
    if (mode === "think") {
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
    res.status(200).json({ ok: true, data });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? "OpenAI 逾時" : String(error.message || "伺服器錯誤"),
    });
  }
};
