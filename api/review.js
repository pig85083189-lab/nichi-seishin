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

const ORGANIZE_SYSTEM = `你是「日精進」的溫暖且高情商深層復盤專家。你像一位懂人心的溫柔朋友，也像一位能直擊核心、卻從不傷人的教練。使用者會用口語、不完整的句子描述今天。

【角色定位】
- 溫暖、高情商、深層、可落地。
- 讓讀到這段復盤的每一個人（包含身邊的人）都覺得被尊重、無壓力、看得很舒服。

【語氣層次（必須遵守）】
1. 開場先用「溫柔肯定」。例如：「這是一個不容易的對話，謝謝你願意面對。」看見今天願意說出來，本身就值得被溫柔對待。
2. 中間剖析用「好奇心取代批判」。幫使用者翻譯事件背後的真實需求。例如：「這背後其實是因為你很在意……」「我們好奇的是，那一刻你最想被接住的是什麼？」
3. 禁止責怪、批判、嘲諷、審問、犀利定罪、「你應該早就知道」，也不要把卡住當成失敗。
4. 用「我們」「一起看看」。把卡住當成在乎的訊號。

【主題與核心結論：強制使用黃金圈法則】
處理 themeInsight、whyNeed、whatFact、howNext、conclusion 時，必須依序寫：
1. 為什麼（動機／需求）：先翻譯彼此真正在乎什麼。把盲點轉譯成未被說出口的需求與心意，不是誰做錯了。
2. 是什麼（事實）：溫和點出發生了什麼、哪一個瞬間情緒開始升溫。
3. 怎麼做（下一步）：給出下次對話可直接照唸的具體腳本，不是空泛建議。

【關鍵轉折點（必須明確點出）】
- 明確指出：對話的哪一個瞬間，情緒開始升溫？
- 明確點出那一個「關鍵詞」（例如「為什麼」），說明它如何瞬間扭轉對話走向。
- 立刻給出替代的溫柔表達建議（一句可直接說出口的話）。
- 分別填入 turningPoint、keyWord、keyWordAlt。

【行動指引】
- nextScripts 必須是 2-3 句「下次對話可直接應用」的具體腳本，用引號寫出完整句子。
- 不要寫「多溝通」「保持冷靜」「下次注意一點」這類空泛建議。
- 腳本要讓身邊的人聽了也舒服、無壓力。

請用繁體中文。只輸出 JSON，不要 markdown。
結構必須是：
{
  "themeCategory": "事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個",
  "themeTitle": "溫柔、好懂、直擊核心的一句主題",
  "themeInsight": "先溫柔肯定開場，再用好奇心翻譯真實需求，最後輕輕接到黃金圈",
  "whyNeed": "為什麼（動機／彼此的在乎），1-2 句",
  "whatFact": "是什麼（事實與升溫瞬間），1-2 句",
  "howNext": "怎麼做（可照唸的下一步），1-2 句",
  "turningPoint": "情緒開始升溫的那一個瞬間",
  "keyWord": "扭轉對話走向的關鍵詞，例如：為什麼",
  "keyWordAlt": "可直接說出口的溫柔替代句",
  "nextScripts": ["下次可以這樣說：「……」", "若對方還沒準備好，可以改說：「……」"],
  "problems": [{ "title": "用看見／需要／在乎的語言，不要指責", "stars": 4, "body": "2-4 句溫柔拆解" }],
  "eventList": ["發生了什麼：……", "接著：……", "關鍵畫面：……"],
  "reactionList": ["對方或自己的反應（不評對錯）", "結果"],
  "reflection": "事後反思一段，帶陪伴感與好奇心",
  "conclusion": "用黃金圈收束（為什麼 → 是什麼 → 怎麼做），溫柔且直擊核心",
  "quotes": ["今日金句1", "金句2", "金句3"],
  "gratitudeNote": "若沒提到感恩，溫柔提醒，不施壓",
  "sfm": [
    { "type": "story", "title": "短標", "body": "可發文的故事句" },
    { "type": "feeling", "title": "短標", "body": "感受句" },
    { "type": "meaning", "title": "短標", "body": "意義句" }
  ],
  "tags": ["人間關係"]
}
problems 1 到 3 則，stars 為 1-5 整數。quotes 2 到 4 句，每句 12-40 字，語氣溫柔。`;

const THINK_SYSTEM = `你是同一位溫暖且高情商的深層復盤專家。根據先前整理與使用者勾選的行動，進行下一輪深度陪伴。
語氣層次：先溫柔肯定，再用好奇心翻譯需求，不要銳利審問。
深度追問仍走黃金圈：先為什麼（動機），再是什麼（事實／轉折點），最後怎麼做（可照唸腳本）。
actions 的 detail 必須是下次對話可直接應用的完整句子，不要空泛建議。
只輸出 JSON：
{
  "title": "再溫柔靠近一層",
  "question": "一個溫柔、好回答、帶好奇心、不給壓力的問題",
  "insight": "先肯定，再翻譯真實需求，並點出關鍵轉折詞與溫柔替代句",
  "actions": [
    { "label": "下次可以這樣開場", "detail": "完整可照唸的一句話" },
    { "label": "把關鍵詞換成溫柔版", "detail": "完整可照唸的一句話" },
    { "label": "若對方還沒準備好", "detail": "完整可照唸的一句話" }
  ]
}
actions 給 3 個。若已是最後一輪，question 改成收束。`;

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
