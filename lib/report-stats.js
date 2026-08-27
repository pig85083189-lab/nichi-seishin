function pad(num) {
  return String(num).padStart(2, "0");
}

function addDaysIso(iso, amount) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day + Number(amount || 0)));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function enumerateDays(fromIso, toIso) {
  const days = [];
  if (!fromIso || !toIso || fromIso > toIso) return days;
  let cursor = fromIso;
  let guard = 0;
  while (cursor <= toIso && guard < 62) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
    guard += 1;
  }
  return days;
}

function asReviewMap(reviews) {
  if (reviews && typeof reviews === "object" && !Array.isArray(reviews)) return reviews;
  const map = {};
  (Array.isArray(reviews) ? reviews : []).forEach((item) => {
    const iso = item && (item.date || item.iso);
    if (iso) map[iso] = item;
  });
  return map;
}

function itemIso(item) {
  const date = String((item && (item.date || item.iso)) || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const created = String((item && item.createdAt) || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : "";
}

function inRange(iso, fromIso, toIso) {
  return Boolean(iso && iso >= fromIso && iso <= toIso);
}

function journalChecks(review) {
  if (!review || typeof review !== "object") {
    return { awareness: 0, execution: 0, manifestation: 0 };
  }
  const source = review.journal && typeof review.journal === "object" ? review.journal : review;
  return {
    awareness: Array.isArray(source.awarenessChecks) ? source.awarenessChecks.filter(Boolean).length : 0,
    execution: Array.isArray(source.executionChecks) ? source.executionChecks.filter(Boolean).length : 0,
    manifestation: Array.isArray(source.manifestChecks) ? source.manifestChecks.filter(Boolean).length : 0,
  };
}

function groupByDate(items) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const iso = itemIso(item);
    if (!iso) return;
    if (!map.has(iso)) map.set(iso, []);
    map.get(iso).push(item);
  });
  return map;
}

function statusBucket(items, fromIso, toIso) {
  const bucket = { checked: 0, done: 0, doing: 0, later: 0, daysActive: 0 };
  const activeDays = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const iso = itemIso(item);
    if (!inRange(iso, fromIso, toIso)) return;
    bucket.checked += 1;
    activeDays.add(iso);
    const status = String(item.status || "doing");
    if (status === "done") bucket.done += 1;
    else if (status === "later") bucket.later += 1;
    else bucket.doing += 1;
  });
  bucket.daysActive = activeDays.size;
  return bucket;
}

function sampleTitles(items, fromIso, toIso, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => inRange(itemIso(item), fromIso, toIso))
    .map((item) => String(item.title || item.label || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildGrowthStats({ fromIso, toIso, reviews, insights, tasks, manifests } = {}) {
  const reviewMap = asReviewMap(reviews);
  const insightMap = groupByDate(insights);
  const taskMap = groupByDate(tasks);
  const manifestMap = groupByDate(manifests);
  const days = enumerateDays(fromIso, toIso);
  const series = days.map((iso) => {
    const review = reviewMap[iso];
    const checks = journalChecks(review);
    const awareness = checks.awareness || (insightMap.get(iso) || []).length;
    const execution = checks.execution || (taskMap.get(iso) || []).length;
    const manifestation = checks.manifestation || (manifestMap.get(iso) || []).length;
    return { iso, awareness, execution, manifestation };
  });

  const sum = (key) => series.reduce((total, row) => total + Number(row[key] || 0), 0);
  const awarenessLib = statusBucket(insights, fromIso, toIso);
  const executionLib = statusBucket(tasks, fromIso, toIso);
  const manifestationLib = statusBucket(manifests, fromIso, toIso);
  const awareness = {
    ...awarenessLib,
    checked: Math.max(awarenessLib.checked, sum("awareness")),
    done: Math.max(awarenessLib.done, awarenessLib.checked),
  };
  const execution = {
    ...executionLib,
    checked: Math.max(executionLib.checked, sum("execution")),
  };
  const manifestation = {
    ...manifestationLib,
    checked: Math.max(manifestationLib.checked, sum("manifestation")),
  };
  const filledDays = series.filter((row) => row.awareness || row.execution || row.manifestation).length;
  const checked = awareness.checked + execution.checked + manifestation.checked;
  const done = awareness.done + execution.done + manifestation.done;

  return {
    fromIso,
    toIso,
    days: days.length,
    filledDays,
    awareness,
    execution,
    manifestation,
    series,
    totals: { checked, done, filledDays },
    samples: {
      awareness: sampleTitles(insights, fromIso, toIso),
      execution: sampleTitles(tasks, fromIso, toIso),
      manifestation: sampleTitles(manifests, fromIso, toIso),
    },
  };
}

function formatStatsPrompt(stats) {
  const data = stats && typeof stats === "object" ? stats : {};
  const line = (label, bucket) => {
    const item = bucket || {};
    const rate = item.checked ? Math.round((Number(item.done || 0) / item.checked) * 100) : 0;
    return `${label}：勾選 ${item.checked || 0}、完成 ${item.done || 0}（完成率 ${rate}%）、有紀錄的天數 ${item.daysActive || 0}`;
  };
  const samples = data.samples || {};
  const sampleLine = (label, list) =>
    `${label}摘句：${(Array.isArray(list) ? list : []).join("／") || "（尚無）"}`;
  return [
    `區間：${data.fromIso || ""} 至 ${data.toIso || ""}，共 ${data.days || 0} 天，其中 ${data.filledDays || 0} 天有勾選紀錄`,
    line("覺察力", data.awareness),
    line("執行力", data.execution),
    line("顯化力", data.manifestation),
    `合計勾選 ${data.totals?.checked || 0}，合計完成 ${data.totals?.done || 0}`,
    sampleLine("覺察", samples.awareness),
    sampleLine("執行", samples.execution),
    sampleLine("顯化", samples.manifestation),
  ].join("\n");
}

function thanksCount(journal) {
  if (!journal || typeof journal !== "object") return 0;
  if (Array.isArray(journal.thanks)) return journal.thanks.filter((item) => String(item || "").trim()).length;
  const text = String(journal.thanksText || journal.thanks || "").trim();
  if (!text) return 0;
  return text.split(/\n+/).filter((line) => String(line || "").trim()).length;
}

function hasBodyRecord(journal) {
  if (!journal || typeof journal !== "object") return false;
  if (Array.isArray(journal.bodyTags) && journal.bodyTags.length) return true;
  if (String(journal.bodyNote || "").trim()) return true;
  const check = journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : {};
  return ["mood", "body", "sleep"].some((key) => {
    const item = check[key];
    if (!item || typeof item !== "object") return false;
    if (Array.isArray(item.flags) && item.flags.length) return true;
    if (item.none || item.duration || item.other || item.reason) return true;
    return false;
  });
}

function buildFreeReportSummary({ fromIso, toIso, reviews } = {}) {
  const reviewMap = asReviewMap(reviews);
  const days = enumerateDays(fromIso, toIso);
  let recordedDays = 0;
  let completedDays = 0;
  let thanksItems = 0;
  let moodRecords = 0;
  let bodyRecords = 0;
  const moodCounts = {};
  days.forEach((iso) => {
    const review = reviewMap[iso];
    if (!review) return;
    const journal = review.journal && typeof review.journal === "object" ? review.journal : {};
    const thanks = thanksCount(journal);
    const mood = String(journal.mood || "").trim();
    const body = hasBodyRecord(journal);
    const hasText = Boolean(String(review.rawText || journal.event || journal.thanksText || "").trim());
    if (!thanks && !mood && !body && !hasText && !review.completedAt) return;
    recordedDays += 1;
    if (review.completedAt || review.organize || String(review.rawText || "").trim()) completedDays += 1;
    thanksItems += thanks;
    if (mood) {
      moodRecords += 1;
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
    if (body) bodyRecords += 1;
  });
  const topMood = Object.keys(moodCounts).sort((a, b) => moodCounts[b] - moodCounts[a])[0] || "";
  return {
    fromIso,
    toIso,
    days: days.length,
    recordedDays,
    completedDays,
    thanksItems,
    moodRecords,
    bodyRecords,
    topMood,
  };
}

module.exports = {
  enumerateDays,
  buildGrowthStats,
  formatStatsPrompt,
  buildFreeReportSummary,
};
