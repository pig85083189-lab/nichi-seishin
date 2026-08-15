const { callOpenAI } = require("./lib/openai");
const { kvConfigured, loadReviews, mergeReviews, loadReport, loadLatestReport, saveReport } = require("./lib/store");

const REPORT_SYSTEM = `你是「日精進」的週月報教練。使用者會給你一段期間內、多天的復盤摘要。請聚合成一份冷靜、精準、可執行的綜合報告。

【口吻】
- 對事不對人。禁止雞湯、禁止空話。
- 從重複出現的落差、盲點、金句裡看出軌跡，不要逐日流水帳。

【必須寫滿這三段】
1. insights：本週／本月關鍵洞察，2-4 條。每條一句到兩句，點出結構，不要抒情。
2. progress：進步軌跡，2-4 條。寫「比前幾天更清楚／還卡在哪」。
3. nextPlan：下週／下月規劃，2-4 條。必須是做得到的下一步，不要口號。

另外給 title（報告標題）與 summary（一句總述）。
只輸出 JSON，繁體中文，不要 markdown。
{
  "title": "本週：好意沒講清楚，解法就變成壓力",
  "summary": "一句總述",
  "insights": ["洞察1", "洞察2"],
  "progress": ["軌跡1", "軌跡2"],
  "nextPlan": ["規劃1", "規劃2"]
}`;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

function pad(num) {
  return String(num).padStart(2, "0");
}

function toIso(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(iso, amount) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + amount);
  return toIso(date);
}

function startOfWeekMonday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return toIso(date);
}

function todayTaipeiIso() {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${taipei.getUTCFullYear()}-${pad(taipei.getUTCMonth() + 1)}-${pad(taipei.getUTCDate())}`;
}

function rangeFor(type, options = {}) {
  const today = options.toIso || todayTaipeiIso();
  const complete = Boolean(options.complete);
  if (type === "month") {
    const [year, month] = today.split("-").map(Number);
    if (complete) {
      const prev = new Date(Date.UTC(year, month - 2, 1));
      const fromIso = toIso(prev);
      const last = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0));
      return { fromIso, toIso: toIso(last), period: fromIso.slice(0, 7), label: "上月" };
    }
    return { fromIso: `${year}-${pad(month)}-01`, toIso: today, period: today.slice(0, 7), label: "本月" };
  }
  if (complete) {
    const thisMonday = startOfWeekMonday(today);
    const fromIso = addDays(thisMonday, -7);
    return { fromIso, toIso: addDays(thisMonday, -1), period: fromIso, label: "上週" };
  }
  const fromIso = startOfWeekMonday(today);
  return { fromIso, toIso: today, period: fromIso, label: "本週" };
}

function reviewsInRange(all, fromIso, toIso) {
  return Object.entries(all || {})
    .filter(([iso, review]) => iso >= fromIso && iso <= toIso && review && typeof review === "object")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, review]) => ({
      date: iso,
      rawText: String(review.rawText || "").slice(0, 800),
      themeTitle: review.themeTitle || review.organize?.themeTitle || "",
      conclusion: review.conclusion || review.organize?.conclusion || "",
      quotes: Array.isArray(review.quotes) ? review.quotes.slice(0, 3) : review.organize?.quotes || [],
      gratitude: review.gratitude || "",
      themeCategory: review.themeCategory || review.organize?.themeCategory || "",
    }));
}

function compactMap(list) {
  const map = {};
  (Array.isArray(list) ? list : []).forEach((item) => {
    const iso = item && (item.date || item.iso);
    if (!iso) return;
    map[iso] = item;
  });
  return map;
}

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  const header = String(req.headers.authorization || "");
  return header === `Bearer ${secret}`;
}

async function buildAiReport({ type, fromIso, toIso, period, label, entries }) {
  const digest = entries
    .map((item) => {
      const quotes = Array.isArray(item.quotes) ? item.quotes.filter(Boolean).join("／") : "";
      return [
        `【${item.date}】${item.themeCategory || ""} ${item.themeTitle || ""}`.trim(),
        item.conclusion ? `結論：${item.conclusion}` : "",
        item.rawText ? `原文：${String(item.rawText).slice(0, 280)}` : "",
        quotes ? `金句：${quotes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const data = await callOpenAI(
    [
      { role: "system", content: REPORT_SYSTEM },
      {
        role: "user",
        content: `這是「${label}」復盤（${fromIso} 至 ${toIso}），共 ${entries.length} 天。請聚合成綜合報告。\n\n${digest || "（這段期間沒有復盤摘要）"}`,
      },
    ],
    25000
  );

  return {
    ok: true,
    type,
    period,
    label,
    fromIso,
    toIso,
    title: data.title || `${label}綜合報告`,
    summary: data.summary || "",
    insights: Array.isArray(data.insights) ? data.insights.filter(Boolean).slice(0, 6) : [],
    progress: Array.isArray(data.progress) ? data.progress.filter(Boolean).slice(0, 6) : [],
    nextPlan: Array.isArray(data.nextPlan) ? data.nextPlan.filter(Boolean).slice(0, 6) : [],
    days: entries.length,
    generatedAt: new Date().toISOString(),
    source: "openai",
  };
}

async function handler(req, res, forced = {}) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const body = req.method === "POST" ? readJsonBody(req) : {};
  const type = forced.type || req.query?.type || body.type || "week";
  const kind = type === "month" ? "month" : "week";
  const readOnly = String(req.query?.read || body.read || "") === "1";
  const fromCron = Boolean(forced.cron || req.query?.cron);
  const complete = fromCron || String(req.query?.complete || "") === "1";

  if (fromCron && !cronAuthorized(req)) {
    res.status(401).json({ ok: false, error: "Cron 未授權" });
    return;
  }

  const range = rangeFor(kind, {
    toIso: body.toIso,
    complete,
  });
  const period = String(body.period || req.query?.period || range.period);

  try {
    if (req.method === "POST" && Array.isArray(body.reviews) && body.reviews.length) {
      await mergeReviews(compactMap(body.reviews));
    }

    const wantLatest = String(req.query?.latest || body.latest || "") === "1";
    if (readOnly || (req.method === "GET" && !fromCron)) {
      let stored = await loadReport(kind, period);
      if (!stored && wantLatest) stored = await loadLatestReport(kind);
      res.status(200).json({ ok: true, stored: Boolean(stored), data: stored || null, kv: kvConfigured() });
      return;
    }

    let entries = Array.isArray(body.reviews) ? reviewsInRange(compactMap(body.reviews), range.fromIso, range.toIso) : [];
    if (!entries.length) {
      const all = await loadReviews();
      entries = reviewsInRange(all, range.fromIso, range.toIso);
    }

    if (!entries.length) {
      res.status(200).json({
        ok: true,
        skipped: true,
        reason: "這段期間沒有復盤紀錄",
        type: kind,
        period,
        fromIso: range.fromIso,
        toIso: range.toIso,
        kv: kvConfigured(),
      });
      return;
    }

    const report = await buildAiReport({
      type: kind,
      fromIso: range.fromIso,
      toIso: range.toIso,
      period,
      label: range.label,
      entries,
    });
    await saveReport(kind, period, report);
    res.status(200).json({ ok: true, data: report, kv: kvConfigured() });
  } catch (error) {
    const aborted = error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
    res.status(aborted ? 504 : error.status || 500).json({
      ok: false,
      error: aborted ? "報告生成逾時" : String(error.message || "伺服器錯誤"),
    });
  }
}

module.exports = handler;
module.exports.handler = handler;
