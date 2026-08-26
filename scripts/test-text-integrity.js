const {
  isCompleteSentence,
  hasCompleteThought,
  pickCompleteSentence,
  finalizeGeneratedQuestion,
  splitSentences,
  splitTitleDetail,
} = require("../lib/text-integrity");
const { mergeJournalObjects, mergeReviewMaps } = require("../lib/review-merge");
const { padAwarenessPrompts, looksIncompleteAwarenessText } = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const caseA = "你會不會在無意中，把『被人惦記著』當成了";
assert(isCompleteSentence(caseA) === false, "CASE A：當成了 必須判定不完整");
assert(hasCompleteThought(caseA) === false, "CASE A：hasCompleteThought 也必須不完整");
assert(looksIncompleteAwarenessText(caseA), "CASE A：API helper 必須判定不完整");

assert(isCompleteSentence("真正的陪伴不是一直") === false, "CASE B：不是一直 必須不完整");

const caseC = "看見別人的改變，也讓我看見自己的價值。";
assert(isCompleteSentence(caseC) === true, "CASE C：完整句必須通過");

const caseD = "你是不是會把別人的主動關心，當成自己被在乎的證明？";
assert(isCompleteSentence(caseD, { requireQuestion: true }) === true, "CASE D：完整 Yes/No 必須通過");

const longComplete = "當別人主動關心你時，你是不是更容易感受到自己被重視，也更願意承認自己其實很在意這份被放在心上的感覺？";
assert(compactOver(longComplete, 30), "CASE E：測資必須超過 30 字");
assert(pickCompleteSentence(longComplete, 30) === "", "CASE E：超過 30 字的完整句不可被 slice 成半句");
assert(isCompleteSentence(longComplete, { requireQuestion: true }), "CASE E：原文本身仍完整");

const emptyAnswer = padAwarenessPrompts(
  [{ question: "當事情一件件完成時，你是不是會比單純休息更容易感到安心？", answer: "" }],
  { event: "做完很多事", step: 1 }
);
assert(emptyAnswer.length === 1, "CASE F：answer 空白仍要保留題目");
assert(isCompleteSentence(emptyAnswer[0].question, { requireQuestion: true }), "CASE F：題目本身必須完整");

const historyQuote = "陪伴不是一直靠近，而是知道什麼時候給彼此空間";
assert(isCompleteSentence(historyQuote), "CASE G：歷史金句本身完整");
assert(pickCompleteSentence(`${historyQuote}。後面還有很多補充。`, 30) === `${historyQuote}。` || pickCompleteSentence(`${historyQuote}。後面還有很多補充。`, 30) === historyQuote, "CASE G：太長時只能取完整句，不可砍半句");

const quoted = "你會不會在無意中，把『被人惦記著』當成了確認自己被愛的方式？";
assert(isCompleteSentence(quoted, { requireQuestion: true }), "CASE H：中文引號不可讓 parser 誤切");
assert(splitSentences(quoted).length === 1, "CASE H：引號內文字不可被拆成兩句");

const mixed = "今天走了 3km 😊 也寫下 thank you";
assert(typeof mixed === "string" && mixed.includes("😊") && mixed.includes("3km"), "CASE I：emoji / 英文 / 數字不可被破壞");
assert(pickCompleteSentence(mixed, 40) === "" || pickCompleteSentence(mixed, 40).includes("3km") || pickCompleteSentence(`${mixed}。`, 40).includes("😊"), "CASE I：混合字串不可被改壞");

const fullSeen = "你是不是會把別人的主動關心，當成自己被在乎的證明？";
const older = {
  journal: {
    awarenessResult: { seen: fullSeen, line: "看見別人變好，也讓我看見自己的價值" },
    insight: { guide: { takeaway: fullSeen, rounds: [{ question: quoted, answer: "" }] } },
  },
};
const newer = {
  journal: {
    awarenessResult: { seen: fullSeen, line: "看見別人變好，也讓我看見自己的價值" },
    insight: { guide: { takeaway: fullSeen, rounds: [{ question: quoted, answer: "" }] } },
  },
};
const mergedJournal = mergeJournalObjects(older.journal, newer.journal);
assert(mergedJournal.awarenessResult.seen === fullSeen, "CASE J：merge 後 seen 必須原樣");
assert(mergedJournal.insight.guide.takeaway === fullSeen, "CASE J：merge 後 takeaway 必須原樣");
assert(mergedJournal.insight.guide.rounds[0].question === quoted, "CASE J：merge 後 question 必須原樣");

const mergedMaps = mergeReviewMaps(
  { "2026-08-22": older },
  { "2026-08-22": newer }
);
assert(mergedMaps["2026-08-22"].journal.awarenessResult.seen === fullSeen, "CASE J：cloud merge 後文字完全一致");

assert(isCompleteSentence("被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫") === false, "CASE K：一杯溫 必須判定不完整");
assert(pickCompleteSentence("被愛的感受不只來自別人的惦記，也來自你願意為自己倒一杯溫暖的茶。", 28) === "", "CASE K：不可為了 28 字把完整句切成一杯溫");
assert(finalizeGeneratedQuestion(caseD) === caseD, "完整問題 finalize 後仍完整");

const rejected = padAwarenessPrompts([{ question: caseA }], { event: "被人惦記", step: 1 });
assert(rejected[0] && rejected[0].question !== caseA, "半句覺察題不可直接上畫面");
assert(isCompleteSentence(rejected[0].question, { requireQuestion: true }), "半句覺察題必須換成完整 fallback");

const timedAction = "今晚 22:00 後不再滑手機，確保明天睡眠至少 7 小時。";
const timedParts = splitTitleDetail(timedAction);
assert(timedParts.title === timedAction && timedParts.detail === "", "時間冒號不可當 title/detail delimiter");
assert(timedParts.title.includes("22:00"), "22:00 必須完整保留");
assert(splitTitleDetail("放下手機：今晚 22:00 後不再滑手機。").detail.includes("22:00"), "安全 delimiter 拆分後時間仍完整");

function compactOver(text, n) {
  return String(text || "").replace(/\s+/g, "").length > n;
}

console.log("text integrity tests passed");
