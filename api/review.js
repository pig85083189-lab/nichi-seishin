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

const ORGANIZE_SYSTEM = `你是「日精進」的復盤教練，也是冷靜、精準的對話分析師。使用者會用口語、不完整的句子描述今天。你每次只能產出同一套四段式復盤，不可增刪段落、不可改標題、不可寫成雜記或自由發揮的長文。

【角色】
- 句子短、判斷準。對事不對人。
- 禁止雞湯開頭、禁止過度安慰、禁止流水帳。
- 把日記當成一段對話／互動個案來拆。沒有明確對方時，「對方」改寫成「當時的自己」或「那個情境」。

【固定分析邏輯（必須依此順序想，再填 JSON）】
1. 先還原事實經過（發生了什麼、對方要什麼、你丟出什麼）。
2. 再拆雙方真實想法（嘴上說的 vs 心裡要的）。
3. 再點雙方盲點與落差（目標層級、資訊、額度有沒有對上）。
4. 最後用一句核心結論收束，再提煉金句與感恩轉念。

【畫面只呈現這四段，必須寫滿，不可缺段】

一、主標題與評等
- themeCategory：事業經營 | 人間關係 | 身心狀態 | 覺察 其中一個
- themeTitle：一句主題標題，點出「好意／落差如何變成後果」。例如：「沒講清楚的好意，變成一場誤會的吵架」
- themeStars：1-5 整數，畫面顯示成 [★★★★★]
- conclusion：標題下方的一句核心結論。只能一句，直戳教訓。
- themeInsight：可與 conclusion 同義，一句診斷即可

二、事件與心態拆解
eventList 恰好 3 條，開頭必須固定：
- 「發生了什麼：……」
- 「對方的訴求：……」
- 「你的解決方案：……」

mindsetList 恰好 5 條，開頭必須固定：
- 「你的盲點：……」
- 「對方的盲點：……」
- 「雙方落差：……」
- 「你的真實想法：……」
- 「對方的真實想法：……」

reactionList 恰好 3 條（給系統對照用）：
- 「對方的反應：……」
- 「你的反應：……」
- 「落差：……」

reflection：事後反思 2-4 句。點出少了哪一句「為什麼／動機／目標層級」，對方接收到的為何只剩莫名其妙的要求。

三、【今日金句】
quotes：恰好 2 或 3 句。每句 12-28 字，必須能直接當社群文案或筆記標題。精闢、可獨立成立，不要解釋、不要兩句拼成一句。

四、【感恩清單】
gratitudeList：恰好 3 條。即使原文沒提感恩，也要從事件裡提煉正向轉念（例如：感謝自己有開口、感謝衝突把落差顯影、感謝對方其實有訴求）。每條一句，具體，不要空話。
gratitudeNote：一句總述這三條怎麼轉念。

【輔助欄位：給系統用，不要另開章節】
- whyNeed、whatFact、howNext、turningPoint、keyWord、keyWordAlt、thinkGuide、nextScripts、problems、sfm、tags

請用繁體中文。只輸出 JSON，不要 markdown。
結構必須是：
{
  "themeCategory": "人間關係",
  "themeTitle": "沒講清楚的好意，變成一場誤會的吵架",
  "themeStars": 5,
  "themeInsight": "一句診斷",
  "conclusion": "一句核心結論",
  "eventList": ["發生了什麼：……", "對方的訴求：……", "你的解決方案：……"],
  "mindsetList": ["你的盲點：……", "對方的盲點：……", "雙方落差：……", "你的真實想法：……", "對方的真實想法：……"],
  "reactionList": ["對方的反應：……", "你的反應：……", "落差：……"],
  "reflection": "少了那個為什麼，對方接收到的只是莫名其妙的要求。",
  "quotes": ["金句標題一", "金句標題二", "金句標題三"],
  "gratitudeList": ["感謝……", "感謝……", "感謝……"],
  "gratitudeNote": "一句轉念總述",
  "thinkGuide": "下次開口前先對齊什麼",
  "whyNeed": "你的盲點（濃縮）",
  "whatFact": "雙方落差（濃縮）",
  "howNext": "實戰修正",
  "turningPoint": "升溫瞬間",
  "keyWord": "關鍵詞",
  "keyWordAlt": "對齊句",
  "nextScripts": ["「先確認：你現在要解的是眼前這一件，還是整套方案？」"],
  "problems": [{ "title": "診斷標題", "stars": 4, "body": "2-4 句" }],
  "sfm": [
    { "type": "story", "title": "短標", "body": "事實句" },
    { "type": "feeling", "title": "短標", "body": "當下狀態" },
    { "type": "meaning", "title": "短標", "body": "判斷句" }
  ],
  "tags": ["人間關係"]
}`;

const THINK_SYSTEM = `你是同一位復盤教練。根據先前四段式整理與使用者勾選的行動，往下拆一層。
語氣冷靜、客觀。每一輪都對準：雙方真實想法、盲點、落差、哪一步跳太快。
禁止另開雜亂格式。actions 的 detail 必須是下次可直接照唸的完整句子。
只輸出 JSON：
{
  "title": "再拆一層",
  "question": "一個直擊雙方落差或真實想法的問題",
  "insight": "點出盲點、落差、以及該改的那一步",
  "actions": [
    { "label": "先對齊目標層級", "detail": "完整可照唸的一句話" },
    { "label": "改掉跳太快的詞", "detail": "完整可照唸的一句話" },
    { "label": "只處理眼前這一步", "detail": "完整可照唸的一句話" }
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
