const { callOpenAI, getProvider } = require("../lib/openai");
const { requireUser } = require("../lib/auth");
const { buildGrowthStats, formatStatsPrompt } = require("../lib/report-stats");
const { canUseFeature, plusRequiredPayload, featureForReportType, enforcePlusEntitlement } = require("../lib/entitlement");
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
const { ensureTrial, getSubscription, withInternalAccess, effectivePlanFromRow, supabaseAdminConfigured } = require("../lib/supabase");

const REPORT_SYSTEM = `你是「日精進」溫暖且具建設性的成長教練。使用者會給你一段期間內的復盤摘要，以及覺察力、執行力、顯化力的勾選量與完成頻率。

請寫一份冷靜、精準、可執行、結構清晰的個人心理模式報告。對事不對人。禁止雞湯、禁止空話。必須貼近數據與原文。你要比使用者更懂他自己：不只複述當週發生什麼，更要抓出跨天重複出現、他自己可能還沒命名的隱性模式。

【必須寫滿】
1. highlights「本期閃光點」：2-4 條。肯定他做得很棒、進步顯著的地方，要具體，不要空泛誇獎。
2. analysis「今天的身心訊號」：3-6 句完整段落。指出這段期間為什麼這些事會反覆觸動他：防衛機制、情緒盲點、或潛在期待。要有因果，不要一句話帶過。第一句必須是最重要的核心覺察。
3. reflection「客觀檢討與反思」：3-5 句。溫柔但精準地檢討這段期間的處理方式有哪些可以調整。不責備，但直指核心：他反覆做了什麼、迴避了什麼、哪裡讓事情更卡。
4. breakthroughs「具體突破建議（怎麼做會更好）」：2-3 條。每條都是下次遇到類似狀況可以立刻套用的具體行動或轉念做法。
5. insights「本期核心重點整理」：3-4 條精煉金句，讓他一眼帶走這段期間的最大收穫。
6. patterns「隱性模式」：2-4 條。這是報告的核心。要像一位長期陪伴的分析師，把身心與行為的重複劇本講出來。例如：
   - 「你最近常因為『事情未如預期』而導致腸胃不適與焦慮。」
   - 「你的拖延往往發生在需要做決策的星期三。」
   必須結合星期幾、心情、身體訊號（腸胃、頭痛、睡眠時間／品質／起床精神）、事件主題、最小行動是否落地。不要寫成空泛性格評論。
7. progress：進步軌跡，2-4 條。
8. nextPlan：下週／下月規劃，2-4 條，必須做得到。

另外給 title（報告標題）與 summary（一句總述）。
只輸出 JSON，繁體中文，不要 markdown。
{
  "title": "本週：心念開始落地，執行還差一口氣",
  "summary": "一句總述",
  "analysis": "今天的身心訊號，3到6句。",
  "reflection": "客觀檢討與反思，3到5句。不責備，但直指核心。",
  "highlights": ["閃光點1", "閃光點2"],
  "breakthroughs": ["突破建議1", "突破建議2"],
  "patterns": ["隱性模式1", "隱性模式2"],
  "insights": ["核心重點1", "核心重點2"],
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

function weekdayZh(iso) {
  const names = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return "";
  return names[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] || "";
}

function reviewsInRange(all, fromIso, toIso) {
  return Object.entries(all || {})
    .filter(([iso, review]) => iso >= fromIso && iso <= toIso && review && typeof review === "object")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, review]) => {
      const journal = review.journal && typeof review.journal === "object" ? review.journal : {};
      const bodyCheck = journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : {};
      const sleep = bodyCheck.sleep && typeof bodyCheck.sleep === "object" ? bodyCheck.sleep : {};
      return {
        date: iso,
        weekday: weekdayZh(iso),
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
          mood: String(journal.mood || "").slice(0, 20),
          event: String(journal.event || "").slice(0, 160),
          bodyTags: Array.isArray(journal.bodyTags) ? journal.bodyTags.slice(0, 8) : [],
          bodyNote: String(journal.bodyNote || "").slice(0, 180),
          smallestStep: String(journal.smallestStep || "").slice(0, 120),
          awareness: Array.isArray(journal.awareness)
            ? journal.awareness.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6).map((item) => item.slice(0, 120))
            : [],
          sleep: {
            duration: String(sleep.duration || "").slice(0, 20),
            quality: String(sleep.quality || "").slice(0, 20),
            energy: String(sleep.energy || "").slice(0, 20),
          },
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
        item.weekday ? `星期：${item.weekday}` : "",
        journal.mood ? `心情：${journal.mood}` : "",
        journal.event ? `事件：${journal.event}` : "",
        journal.bodyTags?.length ? `身體標籤：${journal.bodyTags.join("、")}` : "",
        journal.bodyNote ? `身心備註：${journal.bodyNote}` : "",
        journal.sleep?.duration || journal.sleep?.quality || journal.sleep?.energy
          ? `睡眠：時間 ${journal.sleep.duration || "未填"}／品質 ${journal.sleep.quality || "未填"}／起床精神 ${journal.sleep.energy || "未填"}`
          : "",
        journal.awareness?.length ? `覺察：${journal.awareness.join("／")}` : "",
        journal.smallestStep ? `明天最小一步：${journal.smallestStep}` : "",
        journal.awarenessChecks?.length ? `覺察勾選：${journal.awarenessChecks.join("、")}` : "",
        journal.executionChecks?.length ? `執行勾選：${journal.executionChecks.join("、")}` : "",
        journal.manifestChecks?.length ? `顯化勾選：${journal.manifestChecks.join("、")}` : "",
        journal.manifest ? `顯化願景：${journal.manifest}` : "",
      ].filter(Boolean);
      return [
        `【${item.date}${item.weekday ? ` ${item.weekday}` : ""}】${item.themeCategory || ""} ${item.themeTitle || ""}`.trim(),
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
        content: `這是「${label}」成長報告（${fromIso} 至 ${toIso}），共 ${entries.length} 天復盤。\n請寫出結構完整的深度思考：① 今天的身心訊號 ② 客觀檢討與反思 ③ 具體突破建議（怎麼做會更好） ④ 本期核心重點整理。同時抓出跨天重複的隱性模式：身心連鎖（例如事情未如預期→腸胃／焦慮）、星期節奏（例如星期三決策拖延）、睡眠與執行力的連動。\n\n【三力數據】\n${formatStatsPrompt(stats)}\n\n【復盤摘要】\n${digest || "（這段期間沒有復盤摘要，請只根據三力數據寫）"}`,
      },
    ],
    { timeoutMs: 25000, maxTokens: 2500 }
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
    analysis: String(data.analysis || data.psychology || "").trim(),
    reflection: String(data.reflection || data.review || "").trim(),
    highlights: lines(data.highlights, 4),
    breakthroughs: lines(data.breakthroughs, 3),
    patterns: lines(data.patterns, 4),
    insights: lines(data.insights, 6),
    progress: lines(data.progress, 6),
    nextPlan: lines(data.nextPlan, 6),
    stats: stats || null,
    days: entries.length,
    generatedAt: new Date().toISOString(),
    source: getProvider(),
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
        let plan = "free";
        try {
          plan = effectivePlanFromRow(await withInternalAccess(await getSubscription(account.id), account.id));
        } catch {
          plan = "free";
        }
        if (!canUseFeature(plan, featureForReportType(kind))) {
          results.push({ userId: account.id, skipped: true, reason: "plus_required" });
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
        try {
          const { insertAnalyticsEvent } = require("../lib/analytics");
          await insertAnalyticsEvent({
            userId: account.id,
            eventName: kind === "month" ? "monthly_report_generated" : "weekly_report_generated",
            metadata: { type: kind === "month" ? "month" : "week", source: "cron" },
          });
        } catch {
          /* ignore */
        }
        results.push({ userId: account.id, ok: true, period, days: entries.length, archived });
      }
      res.status(200).json({ ok: true, cron: true, results, kv: kvConfigured() });
      return;
    }

    const user = await requireUser(req, res);
    if (!user) return;
    if (supabaseAdminConfigured()) {
      try {
        await ensureTrial(user);
      } catch (error) {
        console.error("ensureTrial in generate-report:", error && error.message ? error.message : error);
      }
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

    const reportFeature = featureForReportType(kind);
    const allowed = await enforcePlusEntitlement({
      feature: reportFeature,
      res,
      supabaseReady: supabaseAdminConfigured(),
      loadPlan: async () => effectivePlanFromRow(await ensureTrial(user)),
    });
    if (!allowed) return;

    if (req.method === "POST" && Array.isArray(body.reviews) && body.reviews.length) {
      await mergeReviews(user.id, compactMap(body.reviews));
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
    try {
      const { insertAnalyticsEvent } = require("../lib/analytics");
      await insertAnalyticsEvent({
        userId: user.id,
        eventName: kind === "month" ? "monthly_report_generated" : "weekly_report_generated",
        metadata: { type: kind === "month" ? "month" : "week", source: "api" },
      });
    } catch {
      /* ignore */
    }
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
