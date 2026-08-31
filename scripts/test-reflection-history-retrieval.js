const fs = require("fs");
const path = require("path");
const reviewMerge = require("../lib/review-merge");
const retrieval = require("../lib/reflection-history-retrieval");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const extSrc = fs.readFileSync(path.join(root, "lib/reflection-extension.js"), "utf8");
const v3Src = fs.readFileSync(path.join(root, "lib/reflection-v3.js"), "utf8");
const helperSrc = fs.readFileSync(path.join(root, "lib/reflection-history-retrieval.js"), "utf8");

const TODAY = "2026-08-31";

function done(iso, journal, extra) {
  return {
    date: iso,
    completedAt: `${iso}T10:00:00.000Z`,
    journal: journal || {},
    ...(extra || {}),
  };
}

const TODAY_COMM = {
  thanksText: "還能坐下來說話",
  event: "和伴侶溝通，覺得自己一直說了也沒用。",
  mood: "無力",
  bodyMind: { text: "胸口悶，講完還是像沒被理解。", insight: "你可能很在意選擇權。" },
  insight: {
    guide: {
      variant: "reflection-v3",
      coreQuote: "你可能很在意選擇權。",
      questions: [{ id: "q1", text: "表達過之後，你真正在等的是什麼？" }],
    },
  },
};

const FIX = {
  A: done("2026-07-12", {
    thanksText: "他願意坐下來",
    event: "和伴侶又談了一次，我講了很多遍，對方還是沒聽進去。",
    mood: "累",
    bodyMind: { text: "說完更悶，還是沒被理解。" },
  }),
  B: done("2026-06-03", {
    thanksText: "工作做完了",
    event: "工作夥伴那邊，我已經講很多次，但還是沒有被理解。",
    mood: "煩",
    bodyMind: { text: "說了也沒用，會議開完還是同一句。" },
  }),
  C: done("2026-05-20", {
    thanksText: "天氣很好",
    event: "和伴侶一起去北海道旅行，風景很好，整天都很開心。",
    mood: "開心",
    bodyMind: { text: "走在街上很輕鬆，晚餐也很好吃。" },
  }),
  D: done("2026-04-18", {
    thanksText: "終於懂了",
    event: "今天終於理解了一道數學題，說了很多次公式後自己懂了。",
    mood: "順",
    bodyMind: { text: "把菜單上的字也理解完了。" },
  }),
  E: done("2026-03-08", {
    thanksText: "報告交了",
    event: "今天只是把報告寫完，天氣很好。",
    mood: "平",
    bodyMind: {
      text: "加班寫完就回家。",
      insight: "你可能很在意選擇權，也一直想被理解。",
    },
    insight: {
      guide: {
        variant: "reflection-v3",
        coreQuote: "你可能很在意選擇權。",
        questions: [{ id: "q1", text: "你是不是一直很在意有沒有選擇？" }],
      },
    },
  }),
  F: done("2026-02-14", {
    thanksText: "把話講完了",
    event: "開會時我把想法講完了，但現場沒什麼回應。",
    mood: "悶",
    bodyMind: { text: "講完之後還是空的。" },
    awarenessV3: {
      items: [
        { id: "a1", text: "我已經溝通了，但不代表對方真的理解。" },
        { id: "a2", text: "今天只是有點累。" },
        { id: "a3", text: "也許該更早休息。" },
      ],
      selectedIds: ["a1"],
    },
  }),
  G: done("2026-02-02", {
    thanksText: "家人在",
    event: "上次家庭聚餐沒有要解釋什麼，整個人很安心。",
    mood: "暖",
    bodyMind: { text: "沒有壓力，也很自在、被支持。" },
  }),
  H: done("2026-01-22", {
    thanksText: "還能停一下",
    event: "和伴侶溝通卡住時，我先停下來寫下自己真正想說的。",
    mood: "定",
    bodyMind: { text: "說了也沒用的時候，我改成先寫下來。" },
    executionChoices: {
      options: [{ id: "e1", text: "先寫下自己要說的，而不是當場解釋" }],
      selectedIds: ["e1"],
    },
  }),
  J: {
    date: "2025-12-01",
    completedAt: "2025-12-01T10:00:00.000Z",
    rawText: "和伴侶溝通，講了很多次還是沒被理解。",
    organize: { summary: "舊版整理：表達和被聽見之間有落差。" },
    journal: { event: "舊格式日記：伴侶聽不懂我在說什麼。" },
  },
  K: {
    date: "2026-07-01",
    journal: {
      thanksText: "草稿",
      event: "和伴侶溝通沒有被理解。",
      mood: "悶",
      bodyMind: { text: "說了也沒用。" },
    },
  },
  L: done(TODAY, TODAY_COMM),
  NOISE1: done("2026-07-28", {
    thanksText: "有菜吃",
    event: "去超市買菜，晚餐很普通。",
    mood: "平",
    bodyMind: { text: "提袋子有點手酸。" },
  }),
  NOISE2: done("2026-06-18", {
    thanksText: "有時間跑步",
    event: "跑步跑完三公里，小腿有點酸。",
    mood: "爽",
    bodyMind: { text: "呼吸順，沒有特別想什麼。" },
  }),
};

const ALL = {
  "2026-07-12": FIX.A,
  "2026-06-03": FIX.B,
  "2026-05-20": FIX.C,
  "2026-04-18": FIX.D,
  "2026-03-08": FIX.E,
  "2026-02-14": FIX.F,
  "2026-02-02": FIX.G,
  "2026-01-22": FIX.H,
  "2025-12-01": FIX.J,
  "2026-07-01": FIX.K,
  "2026-08-31": FIX.L,
  "2026-07-28": FIX.NOISE1,
  "2026-06-18": FIX.NOISE2,
};

assert(reviewMerge.reviewIsFinalized(FIX.A), "reuse reviewIsFinalized");
assert(!reviewMerge.reviewIsFinalized(FIX.K), "draft 不是 finalized");
assert(reviewMerge.reviewIsFinalized(FIX.J), "legacy organize/completedAt 是 finalized");
assert(!app.includes("找到 3 筆歷史") && !app.includes("人生模式"), "一般 UI 沒有 retrieval 畫面");
assert(!html.includes("history-retrieval"), "index 不掛 retrieval UI");
assert(extSrc.includes("不要讀過往日期"), "04 extension 仍只讀今天");
assert(v3Src.includes("01 感謝") || require("../lib/insight-reason").REASONING_SYSTEM.includes("使用者今天已經寫完 01 感謝"), "04 第一層仍只讀今天");
assert(!/generateReflectionV3[\s\S]{0,400}retrieveRelevantHistory/.test(app), "04 生成不接 retrieval");
assert(!/generateThinkExtensionAsk[\s\S]{0,400}retrieveRelevantHistory/.test(app), "client 不自己跑 retrieval");
assert(!/generateThinkExtensionClose[\s\S]{0,400}retrieveRelevantHistory/.test(app), "deepConclusion 不接 retrieval");
assert(reviewJs.includes("isHistoryRetrievalRequest"), "internal API path 存在");
assert(reviewJs.includes("internal_required"), "retrieval 要求 internal");
assert(reviewJs.includes("loadReviews(user.id)"), "只讀登入者自己的 reviews");
assert(!reviewJs.includes("CREATE TABLE") && !helperSrc.includes("ALTER TABLE"), "zero schema");
assert(!helperSrc.includes("pinecone") && !helperSrc.includes("pgvector") && !helperSrc.includes("embeddings"), "V1 不用 vector DB");
assert(retrieval.HISTORY_RERANK_SYSTEM.includes("不要寫「你總是"), "禁止 pattern claim");
assert(retrieval.HISTORY_RERANK_SYSTEM.includes("USER_RAW"), "信任層級進入 Stage 2");
assert(retrieval.HISTORY_RERANK_SYSTEM.includes("不要做成 problem detector"), "允許正向 retrieval");

const extracted = retrieval.extractFinalizedCandidates(ALL, TODAY);
const extractedDates = extracted.map((item) => item.date);
assert(!extractedDates.includes(TODAY), "L｜今天本身排除");
assert(!extractedDates.includes("2026-07-01"), "K｜draft 排除");
assert(extractedDates.includes("2025-12-01"), "J｜legacy 可抽取");
assert(extractedDates.includes("2026-07-12"), "A 進入 candidate window");
const compactJ = extracted.find((item) => item.date === "2025-12-01");
assert(compactJ.userRaw.event.includes("舊格式") || compactJ.userRaw.legacyAnswers.length, "J 容忍缺 bodyMind");
assert(compactJ.aiClues.organize || compactJ.aiClues.coreQuote !== undefined, "J AI 線索保留 provenance");

const compactF = retrieval.compactCandidate(FIX.F, "2026-02-14");
assert(compactF.confirmed.awareness.some((text) => text.includes("溝通")), "F selected awareness = USER_CONFIRMED");
assert(compactF.aiClues.unselectedAwareness.some((text) => text.includes("累")), "未勾選 awareness = AI_HYPOTHESIS");

const compactH = retrieval.compactCandidate(FIX.H, "2026-01-22");
assert(compactH.confirmed.selectedActions.length === 1, "H selected action 抽出");
assert(compactH.actionCompleted === false, "選過 ≠ 完成");

async function run(journal, reviews, extra) {
  return retrieval.retrieveRelevantHistory({
    reviews: reviews || ALL,
    currentDate: TODAY,
    currentJournal: journal,
    currentExtension: extra && extra.currentExtension,
    rerank: extra && extra.rerank,
  });
}

function datesOf(result) {
  return (result.selectedPast || []).map((item) => item.date);
}

const evalReport = [];

function record(id, result, notes) {
  evalReport.push({
    id,
    selected: (result.selectedPast || []).map((item) => ({
      date: item.date,
      score: item.score,
      connectionType: item.connectionType,
      reason: item.reason,
    })),
    stage1: (result.debug && result.debug.stage1Top) || [],
    notes,
  });
}

(async () => {
  const main = await run(TODAY_COMM);
  record("MAIN", main, "溝通主查詢，歷史含 A-L");
  const mainDates = datesOf(main);
  assert(mainDates.includes("2026-07-12"), "A｜同一人物＋同一問題應入選");
  assert(!mainDates.includes("2026-05-20"), "C｜同一人物不同主題不可只因人物高分");
  assert(!mainDates.includes("2026-04-18"), "D｜文字像但意義不同不可誤配");
  assert(!mainDates.includes("2026-03-08"), "E｜只有過去 AI hypothesis 不可高 confidence");
  assert(!mainDates.includes("2026-07-01"), "K｜draft 不可入選");
  assert(!mainDates.includes(TODAY), "L｜今天不可入選");
  assert(!mainDates.includes("2026-07-28") && !mainDates.includes("2026-06-18"), "雜訊日不可湊數");
  assert(main.selectedPast.length <= 3, "最多 3 筆");
  assert(main.selectedPast.every((item) => item.score >= 3), "只保留 score >= 3");
  assert(main.selectedPast.every((item) => !/你總是|你一直|這是你的模式/.test(item.reason)), "reason 無 pattern claim");
  const pickedA = main.selectedPast.find((item) => item.date === "2026-07-12");
  assert(pickedA.connectionType === "same-person" || pickedA.connectionType === "same-situation", "A connectionType 合理");
  assert(main.debug.sourceSig && main.debug.timings && Number.isFinite(main.debug.payloadBytes), "有 sourceSig / latency / payload");

  const onlyB = await run(TODAY_COMM, {
    "2026-06-03": FIX.B,
    "2026-05-20": FIX.C,
    "2026-04-18": FIX.D,
    "2026-03-08": FIX.E,
    "2026-07-28": FIX.NOISE1,
    "2026-06-18": FIX.NOISE2,
  });
  record("B", onlyB, "不同人物＋同一 tension");
  assert(datesOf(onlyB).includes("2026-06-03"), "B｜同一 tension 可入選");
  assert(onlyB.selectedPast.find((item) => item.date === "2026-06-03").connectionType === "same-tension", "B 標 same-tension");
  assert(!datesOf(onlyB).includes("2026-05-20"), "B 包不應帶入 C");

  const onlyF = await run(TODAY_COMM, { "2026-02-14": FIX.F, "2026-07-28": FIX.NOISE1 });
  record("F", onlyF, "confirmed awareness");
  assert(datesOf(onlyF).includes("2026-02-14"), "F｜confirmed awareness 是高價值 signal");

  const onlyH = await run(TODAY_COMM, { "2026-01-22": FIX.H, "2026-07-28": FIX.NOISE1 });
  record("H", onlyH, "prior selected action");
  const pickedH = onlyH.selectedPast.find((item) => item.date === "2026-01-22");
  assert(pickedH, "H｜可標記 prior-success");
  assert(pickedH.connectionType === "prior-success", "H connectionType=prior-success");
  assert(!/有效|成功過|曾經有效/.test(pickedH.reason), "H 不可宣稱方法有效");

  const onlyJ = await run(TODAY_COMM, { "2025-12-01": FIX.J });
  record("J", onlyJ, "legacy only");
  assert(datesOf(onlyJ).includes("2025-12-01"), "J｜legacy 可被相關時找回");

  const positiveToday = {
    thanksText: "家人在",
    event: "和家人相處沒有壓力，覺得很自在、被支持。",
    mood: "暖",
    bodyMind: { text: "整個人很安心，不用解釋自己。" },
  };
  const onlyG = await run(positiveToday, { "2026-02-02": FIX.G, "2026-07-28": FIX.NOISE1, "2026-07-12": FIX.A });
  record("G", onlyG, "positive day");
  assert(datesOf(onlyG).includes("2026-02-02"), "G｜能找 positive relevant history");
  assert(!datesOf(onlyG).includes("2026-07-12") || onlyG.selectedPast[0].date === "2026-02-02", "G 不應被問題日蓋過");

  const gardenToday = {
    thanksText: "薄荷活著",
    event: "今天把陽台的薄荷修剪好了，葉子很香。",
    mood: "順",
    bodyMind: { text: "手碰到泥土，很安靜。" },
  };
  const none = await run(gardenToday, ALL);
  record("I", none, "沒有相關歷史");
  assert(none.selectedPast.length === 0, "I｜沒有相關歷史應回 []");
  assert(none.debug.candidateCount >= 0, "I 仍可抽取 finalized candidates");

  const emptyHistory = await run(TODAY_COMM, {});
  record("EMPTY", emptyHistory, "完全沒有歷史");
  assert(emptyHistory.selectedPast.length === 0, "無歷史回 []");

  const withExt = await run(TODAY_COMM, { "2026-07-12": FIX.A, "2026-07-28": FIX.NOISE1 }, {
    currentExtension: {
      selectedQuestionText: "你說了之後，真正在等的是被理解嗎？",
      userAnswer: "我等的是對方聽進去，不是只聽到我有說話。",
      coreThread: "表達過 ≠ 被理解",
    },
  });
  assert(datesOf(withExt).includes("2026-07-12"), "optional extension context 可當更高權重 query");
  assert(withExt.debug.sourceSig !== main.debug.sourceSig, "extension 改變 sourceSig");

  const cached = await retrieval.retrieveRelevantHistory({
    reviews: { "2026-07-12": FIX.A },
    currentDate: TODAY,
    currentJournal: TODAY_COMM,
    cachedSourceSig: withExt.debug.sourceSig,
    cachedSelectedPast: withExt.selectedPast,
  });
  assert(cached.debug.cacheHit !== true, "不同 query 不誤用 cache");

  const sameAgain = await retrieval.retrieveRelevantHistory({
    reviews: { "2026-07-12": FIX.A, "2026-07-28": FIX.NOISE1 },
    currentDate: TODAY,
    currentJournal: TODAY_COMM,
    currentExtension: {
      selectedQuestionText: "你說了之後，真正在等的是被理解嗎？",
      userAnswer: "我等的是對方聽進去，不是只聽到我有說話。",
      coreThread: "表達過 ≠ 被理解",
    },
    cachedSourceSig: withExt.debug.sourceSig,
    cachedSelectedPast: withExt.selectedPast,
  });
  assert(sameAgain.debug.cacheHit === true, "相同 sourceSig 可跳過 rerank");

  const mocked = await retrieval.retrieveRelevantHistory({
    reviews: { "2026-07-12": FIX.A, "2026-05-20": FIX.C },
    currentDate: TODAY,
    currentJournal: TODAY_COMM,
    rerank: async () => ({
      items: [
        { date: "2026-07-12", relevanceScore: 4, connectionType: "same-person", reason: "這筆紀錄可能和今天有關，因為同一關係裡的表達張力。" },
        { date: "2026-05-20", relevanceScore: 1, connectionType: "same-person", reason: "只有同一人物。" },
      ],
    }),
  });
  assert(datesOf(mocked).join() === "2026-07-12", "Stage 2 mock 只留 score>=3");

  const malformed = await run(TODAY_COMM, { "2026-07-12": FIX.A, bad: null, "nope": { journal: 1 } });
  assert(datesOf(malformed).includes("2026-07-12"), "malformed review 不 crash");

  assert(retrieval.internalRetrievalLine(main.selectedPast).startsWith("Internal Retrieval ·"), "internal debug 只顯示筆數");
  assert(!JSON.stringify(main.debug).includes(TODAY_COMM.event), "debug 不 dump 今天原文");
  assert(!JSON.stringify(main.selectedPast).includes("北海道"), "selectedPast 不帶完整私人日記");

  const onlyC = retrieval.stage1Select(
    retrieval.queryFromJournal(TODAY_COMM, { date: TODAY }),
    [retrieval.compactCandidate(FIX.C, "2026-05-20")],
    TODAY
  );
  assert(!onlyC.length || onlyC[0].stage1Score < 3, "C Stage 1 不因同一人物爆分");

  console.log("reflection-history-retrieval fixtures A-L ok");
  evalReport.forEach((row) => {
    console.log(`\n[${row.id}] ${row.notes}`);
    console.log("  selected:", row.selected.length ? row.selected.map((item) => `${item.date} ${item.score} ${item.connectionType}`).join(" | ") : "[]");
    if (row.selected[0]) console.log("  reason:", row.selected[0].reason);
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
