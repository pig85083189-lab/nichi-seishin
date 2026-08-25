const { getHistoryDailySummary, buildHistoryDisplayTitle, FALLBACK_TITLE } = require("../lib/history-summary");
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

const shortTitle = buildHistoryDisplayTitle({
  journal: { insight: { guide: { takeaway: "我開始看見自己的節奏" } } },
});
assert(shortTitle === "我開始看見自己的節奏", "CASE 1：短標題完整一行");
assert(!shortTitle.includes("…"), "短標題不可加省略號");

const midTitle = buildHistoryDisplayTitle({
  journal: {
    insight: {
      guide: { takeaway: "在陪伴與距離之間，找到自己的平衡" },
    },
  },
});
assert(midTitle === "在陪伴與距離之間，找到自己的平衡", "CASE 2：約 20 字標題必須完整");

const longTitle = buildHistoryDisplayTitle({
  journal: {
    insight: {
      guide: {
        takeaway: "從慌張到接納：今天你在陪伴與距離之間找到了平衡，也開始理解自己真正需要的是什麼",
      },
    },
  },
});
assert(!/平$/.test(longTitle.replace(/\s+/g, "")), "CASE 3／4：不可在「平衡」中間硬切");
assert(!longTitle.includes("…"), "不可用省略號硬切半句");
assert(longTitle.includes("平衡") || longTitle.includes("接納"), "長標題要留下完整子句");
assert(longTitle.length <= 40, "顯示標題不可整段貼上");

const longConclusion = buildHistoryDisplayTitle({
  journal: {
    insight: {
      conclusion: "從慌張到接納：今天你在陪伴與距離之間找到了平衡，也開始理解自己真正需要的是什麼。後面還有很多補充說明，這一段非常長。",
    },
  },
});
assert(longConclusion.includes("平衡"), "CASE 4：長 conclusion 要停在完整子句");
assert(!/平$/.test(longConclusion.replace(/\s+/g, "")), "CASE 4：長 conclusion 不可切成半句");

assert(buildHistoryDisplayTitle({ journal: { mood: "平靜" } }) === FALLBACK_TITLE, "CASE 5：沒有可用 summary 用 fallback");

const eventOnly = buildHistoryDisplayTitle({
  date: "2026-08-22",
  journal: {
    event:
      "今天去陪爸爸媽媽吃飯，因為很久沒有看到他們，突然覺得他們其實有時候也滿孤單的。以前可能覺得陪伴就是常常待在一起，但現在也慢慢理解每個人需要自己的空間。",
    thanksText: "謝謝爸媽還願意等我回家吃飯",
  },
});
assert(!eventOnly.includes("偶爾抽空"), "CASE 1：事件描述不可直接當標題");
assert(!eventOnly.includes("陪爸爸媽媽吃飯"), "CASE 1：標題應提升成覺察，而不是複製事件");
assert(/陪伴|空間|家人|愛/.test(eventOnly), "CASE 1：應提煉陪伴／空間相關金句");

const takeawayQuote = buildHistoryDisplayTitle({
  journal: {
    insight: {
      guide: {
        takeaway: "看見別人變好，也讓我看見自己的價值",
        awareness: "身邊的人慢慢變好讓我很開心",
      },
    },
  },
});
assert(takeawayQuote === "看見別人變好，也讓我看見自己的價值", "CASE 2：完整 takeaway 應提煉成金句");

const sharedTheme = buildHistoryDisplayTitle({
  date: "2026-08-21",
  journal: {
    thanksText: "謝謝客人臉變亮，也謝謝男友開始寫感恩日記",
    event: "看到身邊的人慢慢變好讓我很開心",
    awarenessResult: { seen: "我在乎自己有沒有被看見，也在乎自己有沒有帶來影響" },
  },
});
assert(/價值|影響力|看見/.test(sharedTheme), "CASE 3：感謝＋事件＋覺察要抓共同核心");

const bodyAndDone = buildHistoryDisplayTitle({
  date: "2026-08-20",
  journal: {
    event: "今天完成很多事情很有成就感，但昨天其實只睡五六個小時。",
    bodyCoach: { title: "睡眠不足還是硬把事情做完" },
    smallestStep: "明天只做一件事",
  },
});
assert(/身體|照顧|休息|完成/.test(bodyAndDone), "CASE 4：行動 × 身體照顧");
assert(!bodyAndDone.includes("只睡五六個小時"), "CASE 4：不要複製疲累事件原句");
assert(bodyAndDone !== "睡眠不足還是硬把事情做完", "CASE 4：身體教練標題若只是事件描述，不可直接當金句");

const longSource = buildHistoryDisplayTitle({
  journal: {
    insight: {
      conclusion:
        "從慌張到接納：今天你在陪伴與距離之間找到了平衡，也開始理解自己真正需要的是什麼。後面還有很多補充說明，這一段非常長。",
    },
  },
});
assert(!/平$/.test(longSource.replace(/\s+/g, "")), "CASE 7：長文不可切成半句");
assert(!longSource.includes("…"), "CASE 7：不可用省略號硬切");

const truncatedTitle = buildHistoryDisplayTitle({
  journal: { insight: { guide: { takeaway: "被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫" } } },
});
assert(truncatedTitle !== "被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫", "不完整 takeaway 不可當歷史金句");

console.log("history summary tests passed");
