const {
  hasMeaningfulValue,
  hasMeaningfulInsight,
  hasMeaningfulGuide,
  historyDeepThinkingView,
  pickFilled,
  pickReview,
  mergeGuideRounds,
  mergeJournalObjects,
  mergeReviewMaps,
} = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const emptyInsight = {
  title: "",
  conclusion: "",
  psychology: "",
  reflection: "",
  guide: { rounds: [] },
};

assert(hasMeaningfulValue(null) === false, "null 是空");
assert(hasMeaningfulValue("") === false, "空字串是空");
assert(hasMeaningfulValue("   ") === false, "空白字串是空");
assert(hasMeaningfulValue([]) === false, "空陣列是空");
assert(hasMeaningfulValue({}) === false, "空物件是空");
assert(hasMeaningfulValue(emptyInsight) === false, "emptyInsight 必須算空");
assert(hasMeaningfulGuide({ rounds: [] }) === false, "空 guide 必須算空");
assert(hasMeaningfulInsight(emptyInsight) === false, "空 insight 必須算空");
assert(hasMeaningfulGuide({ rounds: [{ question: "Q1", answer: "" }] }) === true, "有 question 的 round 就算有內容");

const caseA = historyDeepThinkingView({
  journal: {
    insight: {
      guide: {
        rounds: [{ question: "Q1", answer: "A1" }],
      },
    },
  },
});
assert(caseA.kind === "guide", "CASE A：必須顯示新版 guide");
assert(caseA.rounds.some((item) => item.question === "Q1" && item.answer === "A1"), "CASE A：必須看到 Q1/A1");

const caseB = historyDeepThinkingView({
  journal: {
    event: "今天開會",
    insight: {
      guide: {
        rounds: [
          { question: "Q1", hint: "H1", answer: "A1" },
          { question: "Q2", hint: "H2", answer: "" },
        ],
      },
    },
  },
});
assert(caseB.kind === "guide", "CASE B：部分 answer 空白仍要顯示深度思考");
assert(caseB.rounds[0].answer === "A1", "CASE B：必須顯示 Q1 的答案");
assert(caseB.rounds.length >= 1, "CASE B：整段不可消失");

const caseC = historyDeepThinkingView({
  journal: {
    insight: {
      guide: {},
      psychology: "舊四段身心訊號還在",
    },
  },
});
assert(caseC.kind === "blocks", "CASE C：空 guide 要 fallback 到舊四段");
assert(caseC.psychology.includes("身心訊號"), "CASE C：必須讀到 psychology");

const caseD = historyDeepThinkingView({
  journal: {
    thanksText: "謝謝同事",
    event: "開會",
    insight: emptyInsight,
  },
  thinkHistory: [{ question: "舊五輪問題", reply: "舊五輪回答", insight: "舊洞察" }],
});
assert(caseD.kind === "thinkHistory", "CASE D：即使當天有其他 journal section，也要顯示 thinkHistory");
assert(caseD.count === 1, "CASE D：thinkHistory 不可被丟掉");

const caseE = historyDeepThinkingView({
  journal: {
    insight: emptyInsight,
    deep: [{ plain: "", deep: "舊 06 深度思考內容", followups: [], notes: ["", "", ""] }],
    deepPrompts: [{ title: "主題一" }],
  },
});
assert(caseE.kind === "deep", "CASE E：最後 fallback 到 journal.deep");

const cloudReview = {
  date: "2026-08-20",
  updatedAt: "2026-08-20T10:00:00.000Z",
  journal: {
    event: "雲端事件",
    insight: {
      title: "完整洞察",
      psychology: "完整 psychology",
      guide: {
        rounds: [{ question: "Q1", hint: "H1", answer: "雲端答案" }],
        summary: "雲端總結",
      },
    },
  },
};
const localEmpty = {
  date: "2026-08-20",
  updatedAt: "2026-08-23T09:00:00.000Z",
  journal: {
    event: "雲端事件",
    insight: emptyInsight,
  },
};
const caseF = pickReview(localEmpty, cloudReview);
assert(hasMeaningfulInsight(caseF.journal.insight), "CASE F：完整 insight 必須保留");
assert(caseF.journal.insight.guide.rounds[0].answer === "雲端答案", "CASE F：空 insight 不可蓋掉雲端答案");
assert(pickFilled(cloudReview.journal.insight, emptyInsight).guide.rounds[0].answer === "雲端答案", "CASE F：pickFilled 不可把空 insight 當 filled");

const caseG = mergeGuideRounds(
  [{ question: "Q1", hint: "H1", answer: "雲端答案" }],
  [{ question: "Q1", hint: "H1", answer: "" }]
);
assert(caseG[0].answer === "雲端答案", "CASE G：空 answer 不可覆蓋有內容的 answer");

const yesterday = "2026-08-22";
const today = "2026-08-23";
const cloudMap = {
  [yesterday]: {
    date: yesterday,
    updatedAt: "2026-08-22T21:00:00.000Z",
    journal: {
      insight: { guide: { rounds: [{ question: "昨天問題", answer: "昨天答案" }] } },
    },
  },
  [today]: {
    date: today,
    updatedAt: "2026-08-23T08:00:00.000Z",
    journal: {
      event: "今天的事件",
      insight: { guide: { rounds: [{ question: "今天問題", answer: "今天答案" }] } },
    },
  },
};
const localMap = {
  [today]: {
    date: today,
    updatedAt: "2026-08-23T09:30:00.000Z",
    journal: {
      event: "今天的事件",
      awareness: ["是"],
      awarenessResult: { seen: "今天改了覺察力" },
      insight: emptyInsight,
    },
  },
};
const caseH = mergeReviewMaps(cloudMap, localMap);
assert(caseH[yesterday].journal.insight.guide.rounds[0].answer === "昨天答案", "CASE H：改今天 04 不可刪昨天深度思考");
assert(caseH[today].journal.insight.guide.rounds[0].answer === "今天答案", "CASE H：改今天 04 不可刪同一天深度思考");
assert(caseH[today].journal.awarenessResult.seen === "今天改了覺察力", "CASE H：今天覺察更新仍要留下");

const phone = pickReview(cloudReview, localEmpty);
const desktop = pickReview(localEmpty, cloudReview);
assert(phone.journal.insight.guide.rounds[0].answer === desktop.journal.insight.guide.rounds[0].answer, "CASE I：同一帳號兩邊 merge 後深度思考一致");

const mergedJournal = mergeJournalObjects(
  { thanksText: "謝謝", insight: cloudReview.journal.insight },
  { thanksText: "謝謝", event: "開會", insight: emptyInsight }
);
assert(mergedJournal.insight.guide.rounds[0].answer === "雲端答案", "同一天其他 section 有內容時，空 insight 仍不可覆蓋");
assert(mergedJournal.event === "開會", "其他 journal 欄位仍可更新");

console.log("history insight tests passed");
