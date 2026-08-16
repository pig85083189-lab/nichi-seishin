const { callOpenAI } = require("../lib/openai");
const { requireUser } = require("../lib/auth");
const { buildGrowthStats, formatStatsPrompt } = require("../lib/report-stats");
const {
  kvConfigured,
  listUsers,
  loadReviews,
  loadUserData,
  mergeReviews,
  loadReport,
  loadLatestReport,
  listArchivedReports,
  archiveUserReport,
} = require("../lib/store");

const REPORT_SYSTEM = `你是「日精進」的成長教練。使用者會給你一段期間內的復盤摘要，以及覺察力、執行力、顯化力的勾選量與完成頻率。

請寫一份冷靜、精準、可執行的成長報告。對事不對人。禁止雞湯、禁止空話。必須貼近數據與原文。

【必須寫滿】
1. highlights「本期閃光點」：2-4 條。肯定他做得很棒、進步顯著的地方，要具體，不要空泛誇獎。
2. breakthroughs「成長突破口」：2-3 條。客觀指出盲點、停滯或三力失衡，每條含一個明天做得到的改進建議。
3. insights：關鍵洞察，2-4 條。
4. progress：進步軌跡，2-4 條。
5. nextPlan：下週／下月規劃，2-4 條，必須做得到。

另外給 title（報告標題）與 summary（一句總述）。
只輸出 JSON，繁體中文，不要 markdown。
{
  "title": "本週：心念開始落地，執行還差一口氣",
  "summary": "一句總述",
  "highlights": ["閃光點1", "閃光點2"],
  "breakthroughs": ["突破口1（含具體建議）", "突破口2"],
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

function validIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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
    .map(([iso, review]) => {
      const journal = review.journal && typeof review.journal === "object" ? review.journal : {};
      return {
        date: iso,
        rawText: String(review.rawText || "").slice(0, 800),
        themeTitle: review.themeTitle || review.organize?.themeTitle || "",
        conclusion: review.conclusion || review.organize?.conclusion || "",
        quotes: Array.isArray(review.quotes) ? review.quotes.slice(0, 3) : review.organize?.quotes || [],
        gratitude: review.gratitude || "",
        themeCategory: review.themeCategory || review.organize?.themeCategory || "",
        journal: {
          awarenessChecks: Array.isArray(journal.awarenessChecks) ? journal.awarenessChecks.slice(0, 8) : [],
          executionChecks: Array.isArray(journal.executionChecks) ? journal.executionChecks.slice(0, 8) : [],
          manifestChecks: Array.isArray(journal.manifestChecks) ? journal.manifestChecks.slice(0, 8) : [],
          manifest: String(journal.manifest || "").slice(0, 120),
        },
      };
    });
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

function lines(list, max = 6) {
  return Array.isArray(list) ? list.map((item) => String(item || "").trim()).filter(Boolean).slice(0, max) : [];
}

async function buildAiReport({ type, fromIso, toIso, period, label, entries, stats, archived }) {
  const digest = (entries || [])
    .map((item) => {
      const quotes = Array.isArray(item.quotes) ? item.quotes.filter(Boolean).join("／") : "";
      const journal = item.journal && typeof item.journal === "object" ? item.journal : {};
      const checks = [
        journal.awarenessChecks?.length ? `覺察勾選：${journal.awarenessChecks.join("、")}` : "",
        journal.executionChecks?.length ? `執行勾選：${journal.executionChecks.join("、")}` : "",
        journal.manifestChecks?.length ? `顯化勾選：${journal.manifestChecks.join("、")}` : "",
        journal.manifest ? `顯化願景：${journal.manifest}` : "",
      ].filter(Boolean);
      return [
        `【${item.date}】${item.themeCategory || ""} ${item.themeTitle || ""}`.trim(),
        item.conclusion ? `結論：${item.conclusion}` : "",
        item.rawText ? `原文：${String(item.rawText).slice(0, 280)}` : "",
        quotes ? `金句：${quotes}` : "",
        ...checks,
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
        content: `這是「${label}」成長報告（${fromIso} 至 ${toIso}），共 ${entries.length} 天復盤。\n\n【三力數據】\n${formatStatsPrompt(stats)}\n\n【復盤摘要】\n${digest || "（這段期間沒有復盤摘要，請只根據三力數據寫）"}`,
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
    archived: Boolean(archived),
    title: data.title || `${label}成長報告`,
    summary: data.summary || "",
    highlights: lines(data.highlights, 4),
    breakthroughs: lines(data.breakthroughs, 3),
    insights: lines(data.insights, 6),
    progress: lines(data.progress, 6),
    nextPlan: lines(data.nextPlan, 6),
    stats: stats || null,
    days: entries.length,
    generatedAt: new Date().toISOString(),
    source: "openai",
  };
}

function librariesFrom(body, bundle) {
  return {
    insights: Array.isArray(body.insights) ? body.insights : bundle?.insights || [],
    tasks: Array.isArray(body.tasks) ? body.tasks : bundle?.tasks || [],
    manifests: Array.isArray(body.manifests) ? body.manifests : bundle?.manifests || [],
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
  const listOnly = String(req.query?.list || body.list || "") === "1";
  const fromCron = Boolean(forced.cron || req.query?.cron);
  const complete = fromCron || String(req.query?.complete || body.complete || "") === "1";

  if (fromCron && !cronAuthorized(req)) {
    res.status(401).json({ ok: false, error: "Cron 未授權" });
    return;
  }

  const computed = rangeFor(kind, { toIso: body.toIso, complete });
  const range =
    validIso(body.fromIso) && validIso(body.toIso)
      ? {
          fromIso: body.fromIso,
          toIso: body.toIso,
          period: String(body.period || (kind === "month" ? body.fromIso.slice(0, 7) : body.fromIso)),
          label: kind === "month" ? "月報" : "週報",
        }
      : computed;
  const period = String(body.period || req.query?.period || range.period);
  const archived = kind === "month" && (complete || Boolean(body.archive));

  try {
    if (fromCron) {
      const users = await listUsers();
      const results = [];
      for (const account of users) {
        const bundle = await loadUserData(account.id);
        const entries = reviewsInRange(bundle.reviews || {}, range.fromIso, range.toIso);
        const stats = buildGrowthStats({
          fromIso: range.fromIso,
          toIso: range.toIso,
          reviews: bundle.reviews || {},
          insights: bundle.insights || [],
          tasks: bundle.tasks || [],
          manifests: bundle.manifests || [],
        });
        if (!entries.length && !(stats.totals && stats.totals.checked)) {
          results.push({ userId: account.id, skipped: true });
          continue;
        }
        const report = await buildAiReport({
          type: kind,
          fromIso: range.fromIso,
          toIso: range.toIso,
          period,
          label: range.label,
          entries,
          stats,
          archived,
        });
        await archiveUserReport(account.id, report);
        results.push({ userId: account.id, ok: true, period, days: entries.length, archived });
      }
      res.status(200).json({ ok: true, cron: true, results, kv: kvConfigured() });
      return;
    }

    const user = await requireUser(req, res);
    if (!user) return;

    if (req.method === "POST" && Array.isArray(body.reviews) && body.reviews.length) {
      await mergeReviews(user.id, compactMap(body.reviews));
    }

    if (listOnly) {
      const items = await listArchivedReports(user.id);
      res.status(200).json({ ok: true, data: items, kv: kvConfigured(), userId: user.id });
      return;
    }

    const wantLatest = String(req.query?.latest || body.latest || "") === "1";
    if (readOnly || req.method === "GET") {
      let stored = await loadReport(user.id, kind, period);
      if (!stored && wantLatest) stored = await loadLatestReport(user.id, kind);
      res.status(200).json({ ok: true, stored: Boolean(stored), data: stored || null, kv: kvConfigured(), userId: user.id });
      return;
    }

    const bundle = await loadUserData(user.id);
    const libs = librariesFrom(body, bundle);
    const postedReviews = Array.isArray(body.reviews) ? compactMap(body.reviews) : {};
    let entries = Object.keys(postedReviews).length
      ? reviewsInRange(postedReviews, range.fromIso, range.toIso)
      : [];
    if (!entries.length) {
      entries = reviewsInRange(bundle.reviews || (await loadReviews(user.id)), range.fromIso, range.toIso);
    }
    const stats = buildGrowthStats({
      fromIso: range.fromIso,
      toIso: range.toIso,
      reviews: Object.keys(postedReviews).length ? postedReviews : bundle.reviews || {},
      insights: libs.insights,
      tasks: libs.tasks,
      manifests: libs.manifests,
    });

    if (!entries.length && !(stats.totals && stats.totals.checked)) {
      res.status(200).json({
        ok: true,
        skipped: true,
        reason: "這段期間沒有復盤紀錄",
        type: kind,
        period,
        fromIso: range.fromIso,
        toIso: range.toIso,
        stats,
        kv: kvConfigured(),
        userId: user.id,
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
      stats,
      archived,
    });
    await archiveUserReport(user.id, report);
    res.status(200).json({ ok: true, data: report, kv: kvConfigured(), userId: user.id });
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
