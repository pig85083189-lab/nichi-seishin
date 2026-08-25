const {
  isCompleteSentence,
  looksComplete,
  retainCompleteText,
} = require("../lib/text-integrity");
const {
  renderCombinedHighlightedText,
  plainTextFromHighlightedHtml,
} = require("../lib/insight-highlight");
const { getHistoryDailySummary, buildHistoryDisplayTitle } = require("../lib/history-summary");
const { parseAiJson, repairTruncatedJson, incompleteAiError } = require("../lib/openai");
const {
  normalizeAwarenessLine,
  normalizeThinkTakeaway,
  normalizeThinkGuideClose,
  normalizeGeneratedChoiceOptions,
} = require("../api/review");
const { historyDeepThinkingView, hasMeaningfulChoices } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const CUT = "被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫";
const FULL = "被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫暖的茶。";
const TAIL = "為自己倒一杯溫暖的茶。";

function stripHtml(html) {
  return plainTextFromHighlightedHtml(html);
}

function mark(source, needle, color) {
  const start = source.indexOf(needle);
  return {
    text: needle,
    color,
    start,
    end: start + needle.length,
    id: `um_${needle}`,
  };
}

// --- Prove the production cutoff layer ---
const repaired = repairTruncatedJson(`{"takeaway":"${CUT}`);
assert(repaired && repaired.takeaway === CUT, "舊 repairTruncatedJson 會把截斷 JSON 收成「一杯溫」");
let threw = false;
try {
  parseAiJson(`{"takeaway":"${CUT}`);
} catch (error) {
  threw = error && error.code === "INCOMPLETE_AI";
}
assert(threw, "現在 parseAiJson 必須拒絕半截 JSON，不可再存短字串");

assert(isCompleteSentence(CUT) === false, "「一杯溫」不可再被當成完整句");
assert(looksComplete(CUT) === false, "looksComplete 也必須擋「一杯溫」");
assert(normalizeAwarenessLine(CUT) === "", "04 line normalize 不可收下半句");
assert(require("../api/review").normalizeAwarenessResult({ seen: FULL, line: CUT }).line === "", "新 AI 結果不可存入半句 line");
assert(normalizeThinkTakeaway(CUT) === "", "06 takeaway normalize 不可收下半句");
assert(retainCompleteText(FULL) === FULL, "完整句必須原樣保留");

const closed = normalizeThinkGuideClose({
  title: "今天真正有感的那一層",
  awareness: "你勾選的句子指向被惦記的感受。\n\n值得繼續看的，是你願不願意為自己留下溫度。",
  selfSeen: "我發現自己很在意被放在心上。",
  takeaway: CUT,
});
assert(closed.takeaway !== CUT, "think-close 不可把半句 takeaway 存進 review");

// CASE A
const sourceA = FULL;
const htmlA = renderCombinedHighlightedText(sourceA, [{ text: "被惦記", color: "yellow" }], []);
assert(stripHtml(htmlA) === sourceA, "CASE A：完整中文長句 render 後必須全等");

// CASE B
assert(!CUT.includes("溫暖的茶"), "CASE B 測資：截斷句沒有「溫暖的茶」");
assert(stripHtml(renderCombinedHighlightedText(FULL, [], [])) === FULL, "CASE B：完整「溫暖的茶」不可變成「一杯溫」");
const titleFromFull = buildHistoryDisplayTitle({
  journal: { insight: { guide: { takeaway: FULL.replace(/。$/, "") } } },
});
assert(!/一杯溫$/.test(String(titleFromFull).replace(/\s+/g, "")), "CASE B：history title 不可停在「一杯溫」");
assert(!titleFromFull.includes("一杯溫") || titleFromFull.includes("溫暖的茶") || titleFromFull.includes("惦記"), "CASE B：完整句可當 title，不可被切半");

// CASE C
const storedC = { journal: { insight: { guide: { takeaway: FULL } } } };
const beforeC = storedC.journal.insight.guide.takeaway;
const titleC = getHistoryDailySummary(storedC).title;
assert(storedC.journal.insight.guide.takeaway === beforeC, "CASE C：history summary 不得改寫 stored source");
assert(titleC !== CUT, "CASE C：summary 不得輸出截斷句");

const truncatedReview = { date: "2026-08-23", journal: { insight: { guide: { takeaway: CUT } } } };
const truncatedTitle = getHistoryDailySummary(truncatedReview).title;
assert(truncatedTitle !== CUT, "CASE C：不完整 takeaway 不可當列表金句");
assert(truncatedReview.journal.insight.guide.takeaway === CUT, "CASE C：舊 review 原文仍原樣保留、不寫回");

// CASE D
const htmlD = renderCombinedHighlightedText(FULL, [{ text: "被愛的感受", color: "tea" }], []);
assert(stripHtml(htmlD) === FULL, "CASE D：history detail 路徑 textContent === stored source");

// CASE E
const htmlE = renderCombinedHighlightedText(FULL, [{ text: "溫暖的茶。", color: "pink" }], []);
assert(stripHtml(htmlE) === FULL, "CASE E：AI highlight 在句尾，最後文字不能消失");
assert(htmlE.includes("溫暖的茶。"), "CASE E：句尾仍在 DOM");

// CASE F
const userTail = mark(FULL, "溫暖的茶。", "sage");
const htmlF = renderCombinedHighlightedText(FULL, [], [userTail]);
assert(stripHtml(htmlF) === FULL, "CASE F：userMark 在句尾，最後文字不能消失");

// CASE G
const htmlG = renderCombinedHighlightedText(FULL, [{ text: "溫暖的茶。", color: "yellow" }], [userTail]);
assert(stripHtml(htmlG) === FULL, "CASE G：AI + userMark overlap 完整文字不變");

// CASE H
assert(stripHtml(renderCombinedHighlightedText(FULL, [], [])) === FULL, "CASE H：沒有 highlight 完整文字不變");

// CASE I
const oldReview = {
  journal: {
    insight: {
      psychology: FULL,
      conclusion: FULL,
      guide: { rounds: [{ question: "你今天看見了什麼？", answer: FULL }] },
    },
  },
};
assert(getHistoryDailySummary(oldReview).title !== CUT, "CASE I：舊 review fallback 不可產出半句");
assert(oldReview.journal.insight.psychology === FULL, "CASE I：舊 psychology 原文不變");
assert(oldReview.journal.insight.guide.rounds[0].answer === FULL, "CASE I：舊 rounds 原文不變");

// CASE J
const choiceText = "被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫暖的茶";
const choiceBag = {
  sourceSig: "sig",
  options: [{ id: "t1", text: choiceText }],
  selectedIds: ["t1"],
  generatedAt: "2026-08-23T00:00:00.000Z",
};
assert(hasMeaningfulChoices(choiceBag), "CASE J：新版 choices 有效");
const choiceView = historyDeepThinkingView({ journal: { thinkChoices: choiceBag, insight: { guide: { takeaway: choiceText } } } });
assert(choiceView.kind === "thinkChoices", "CASE J：history 走新版 choices");
assert(choiceView.selectedTexts.join("") === choiceText, "CASE J：choices 原文完整");
assert(choiceView.rounds.length === 0, "CASE J：有新 choices 時不畫舊 rounds");
const choiceHtml = renderCombinedHighlightedText(choiceText, [{ text: "別人的惦記", color: "yellow" }], []);
assert(stripHtml(choiceHtml) === choiceText, "CASE J：choices render 後完整");
const opts = normalizeGeneratedChoiceOptions({ options: [{ id: "t1", text: choiceText }] }, "think", []);
assert(opts.some((item) => item.text === choiceText), "CASE J：choices normalize 不截字");

// Extra: highlight at start / middle / two marks / cross punctuation
const startHtml = renderCombinedHighlightedText(FULL, [{ text: "被愛的感受不只來自", color: "tea" }], []);
assert(stripHtml(startHtml) === FULL, "highlight 句首文字完整");
const midHtml = renderCombinedHighlightedText(FULL, [{ text: "別人的惦記", color: "sage" }], []);
assert(stripHtml(midHtml) === FULL, "highlight 句中文字完整");
const twice = "出現一次，後面又出現一次。";
const twiceHtml = renderCombinedHighlightedText(twice, [{ text: "出現一次", color: "pink" }], [
  mark(twice, "出現一次", "yellow"),
]);
assert(stripHtml(twiceHtml) === twice, "同一句出現兩次時文字仍完整");

console.log("text integrity render tests passed");
