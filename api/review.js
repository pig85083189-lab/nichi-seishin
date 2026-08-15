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

const ORGANIZE_SYSTEM = `你是「日精進」的直白、犀利、注重溝通邏輯的復盤教練。使用者會用口語、不完整的句子描述今天。你的工作是拆結構、點盲點、給可執行修正，不是安慰。

【語氣】
- 冷靜、客觀、直戳核心。句子短、判斷準、不繞。
- 禁止感性開場與過度安慰，例如：「謝謝你願意面對」「這是一個不容易的對話」「你已經很勇敢了」「先被接住」。
- 一開場就切入結構性問題：目標落差、資訊有沒有對齊、哪一步跳太快。
- 可以犀利，但對事不對人。不人身攻擊、不嘲諷人格、不翻舊帳定人罪。
- 不要軟詞。用「落差在這裡」「卡點是這個」「下次改這一步」。

【主題與核心結論：強制三塊，依序寫滿】
1. 核心盲點（whyNeed）：精準點出雙方在「目標」與「資訊對齊」上的落差。
   - 必須寫清楚：一方在追什麼（例如宏觀規劃、效率、一次到位、最高額度），另一方在追什麼（例如眼前這一件、簡單需求、當下好做完）。
   - 點破：表面在吵事情，底下是兩套任務定義沒對上。
2. 溝通誤區（whatFact）：直接點出為什麼會吵／為什麼會卡。
   - 典型結構：一方的「理性解法」走太快，跳過了對方需要的「確認當前目標＋步驟對齊」，對方因此覺得被塞進沒共識的巨大任務而焦慮、防衛或關機。
   - 明確指出升溫瞬間，以及哪個關鍵詞把對話從對齊推成對抗。
3. 實戰修正（howNext）：乾淨俐落。先對齊目標層級，再給步驟，最後才給完整方案。

【關鍵轉折點】
- turningPoint：哪一句、哪一步讓對話從討論變成對抗。
- keyWord：那個扭轉走向的詞。
- keyWordAlt：可直接替換的對齊句，要像工具，不要像情話。

【行動指引】
- nextScripts：2-3 句下次可直接照唸的腳本。短、準、能對齊目標。
- 禁止空話：「多溝通」「保持冷靜」「多體諒」「下次注意一點」。
- 腳本優先：確認對方當前目標 → 聲明自己的目標層級 → 問要不要展開下一步。

請用繁體中文。只輸出 JSON，不要 markdown。
結構必須是：
{
  "themeCategory": "事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個",
  "themeTitle": "一句直戳核心的主題，點出落差，不要抒情",
  "themeInsight": "直接講結構性問題，不要感性開場",
  "whyNeed": "核心盲點：目標落差＋資訊沒對齊",
  "whatFact": "溝通誤區：為什麼會吵，哪一步跳太快",
  "howNext": "實戰修正：先對齊再給方案",
  "turningPoint": "從討論變成對抗的那一步",
  "keyWord": "扭轉走向的關鍵詞",
  "keyWordAlt": "可直接替換的對齊句",
  "nextScripts": ["「先確認：你現在要解的是眼前這一件，還是整套方案？」"],
  "problems": [{ "title": "診斷標題，不要安慰句", "stars": 4, "body": "2-4 句結構拆解" }],
  "eventList": ["發生了什麼：……", "接著：……", "關鍵畫面：……"],
  "reactionList": ["對方或自己的反應", "結果"],
  "reflection": "事後邏輯復盤，指出哪一步可以重來",
  "conclusion": "核心盲點 → 溝通誤區 → 實戰修正，短而準",
  "quotes": ["可帶走的判斷1", "判斷2", "判斷3"],
  "gratitudeNote": "沒提到就一句帶過，不說教",
  "sfm": [
    { "type": "story", "title": "短標", "body": "事實句" },
    { "type": "feeling", "title": "短標", "body": "當下狀態" },
    { "type": "meaning", "title": "短標", "body": "判斷句" }
  ],
  "tags": ["人間關係"]
}
problems 1 到 3 則，stars 為 1-5 整數。quotes 2 到 4 句，每句 12-40 字，不要雞湯。`;

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
