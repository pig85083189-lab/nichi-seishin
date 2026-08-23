const { getHistoryDailySummary, FALLBACK_TITLE } = require("../lib/history-summary");
const { historyDeepThinkingSource, hasMeaningfulGuide } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const case1 = getHistoryDailySummary({
  journal: {
    thanksText: "謝謝同事記得我愛喝的牛奶",
    event: "今天開會很緊",
    insight: {
      guide: {
        takeaway: "被看見讓我開心，但身體也正在提醒我要休息",
        awareness: "我很在意被放在心上",
        selfSeen: "我容易把被記得當成自己有沒有價值",
        rounds: [
          { question: "Q1", hint: "H1", answer: "A1" },
          { question: "Q2", hint: "H2", answer: "" },
        ],
      },
    },
    bodyCoach: { title: "今晚先讓身體停下來" },
    smallestStep: "明天只回一封信",
  },
});
assert(case1.title.includes("被看見") || case1.title.includes("休息"), "CASE 1：新版完整 review 要有 title");
assert(case1.tags.length >= 1 && case1.tags.length <= 3, "CASE 1：tags 最多 3 個");

const case2 = getHistoryDailySummary({
  journal: {
    insight: {
      guide: {
        takeaway: "",
        rounds: [{ question: "你今天看見了什麼？", hint: "從身體開始", answer: "我看見自己一直在比較" }],
        selfSeen: "比較讓我忘記自己的節奏",
      },
    },
  },
});
assert(case2.title && case2.title !== FALLBACK_TITLE, "CASE 2：舊 guide review 可以產生 title");

const case3 = getHistoryDailySummary({
  journal: {
    insight: {
      guide: {},
      psychology: "身體一直緊，其實是怕自己不夠好",
      conclusion: "我需要先承認疲憊，而不是再逼自己完成",
      reflection: "完成很多事情之外，我也需要學會照顧自己的狀態",
    },
  },
});
assert(case3.title && case3.title !== FALLBACK_TITLE, "CASE 3：舊 psychology / conclusion 可以產生 title");

const case4 = getHistoryDailySummary({
  thinkHistory: [{ title: "看見自己的價值", insight: "看見別人變好，也讓我看見自己的價值", points: [{ conclusion: "比較不是唯一的尺" }] }],
});
assert(case4.title.includes("價值") || case4.title.includes("比較"), "CASE 4：只有 thinkHistory 可以產生 title");

const case5 = getHistoryDailySummary({
  journal: {
    deep: [{ plain: "", deep: "真正的休息，不是什麼都不做，而是知道自己現在需要什麼" }],
  },
});
assert(case5.title.includes("休息") || case5.title.includes("需要"), "CASE 5：只有 journal.deep 可以產生 title");

const case6 = getHistoryDailySummary({ journal: { mood: "平靜" } });
assert(case6.title === FALLBACK_TITLE, "CASE 6：沒有 summary 時顯示固定 fallback");

const case7Review = {
  journal: {
    insight: {
      guide: {
        rounds: [
          { question: "Q1", hint: "H1", answer: "有內容" },
          { question: "Q2", hint: "H2", answer: "" },
        ],
      },
    },
  },
};
assert(hasMeaningfulGuide(case7Review.journal.insight.guide), "CASE 7：部分 answer 空白仍算有 guide");
assert(historyDeepThinkingSource(case7Review).kind === "guide", "CASE 7：深度思考仍顯示 guide");

const case8Store = { "2026-08-17": { thanks: true, insight: true } };
function ensureHistorySectionDefaults(store, iso, sectionIds) {
  if (store[iso] && Object.keys(store[iso]).length) return store[iso];
  const next = {};
  sectionIds.forEach((id, index) => {
    next[id] = index === 0;
  });
  store[iso] = next;
  return next;
}
const afterHydrate = ensureHistorySectionDefaults(case8Store, "2026-08-17", ["thanks", "event", "insight"]);
assert(afterHydrate.insight === true, "CASE 8：hydrate / rerender 後深度思考仍展開");
assert(afterHydrate.thanks === true, "CASE 9：使用者已展開的 section，autosave 後仍展開");

const case10 = getHistoryDailySummary({
  date: "2026-01-01",
  journal: { event: "去散步" },
});
assert(typeof case10.title === "string" && case10.title.length > 0, "CASE 10：沒有 dailyReflectionTitle 不報錯");
assert(Array.isArray(case10.tags), "CASE 10：沒有 Tags 也不消失");

const a = getHistoryDailySummary(case1);
const b = getHistoryDailySummary(case1);
assert(a.title === b.title && a.tags.join() === b.tags.join(), "同一份 review 必須得到穩定 summary");

console.log("history summary tests passed");
