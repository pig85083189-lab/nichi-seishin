const fs = require("fs");
const path = require("path");
const reviewMerge = require("../lib/review-merge");
const reflectionExt = require("../lib/reflection-extension");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");

const QS = [
  { id: "eq1", text: "你要的是被聽懂，還是對方必須同意？" },
  { id: "eq2", text: "這次沒被接住，你先保護的是什麼？" },
  { id: "eq3", text: "如果先不要求對方改，你自己還想看哪一層？" },
];

const RETRIEVAL_USED = {
  sourceSig: "retrieval-sig",
  selectedPast: [
    {
      date: "2026-07-12",
      score: 4,
      connectionType: "same-tension",
      provenance: { userRaw: true, userConfirmed: false, aiHypothesis: false },
      used: true,
    },
  ],
};

const RETRIEVAL_EMPTY = { sourceSig: "retrieval-empty", selectedPast: [] };

function round1Questions(extra) {
  return {
    id: "ext1",
    questions: QS,
    selectedQuestionId: "",
    selectedQuestionText: "",
    answer: "",
    retrieval: RETRIEVAL_USED,
    ...(extra || {}),
  };
}

function round1Completed(extra) {
  return round1Questions({
    selectedQuestionId: "eq1",
    selectedQuestionText: QS[0].text,
    answer: "我發現自己真正在等的是被接住，不是對方立刻同意。",
    answerSig: "我發現自己真正在等的是被接住，不是對方立刻同意。",
    deepConclusion: "今天真正還沒解開的，也許是被接住和被同意被當成同一件事。",
    completedAt: "2026-08-31T04:00:00.000Z",
    retrieval: RETRIEVAL_USED,
    ...(extra || {}),
  });
}

assert(reviewMerge.completedExtensionCount({ rounds: [round1Questions()] }) === 0, "A: questions only → 0");
assert(
  reviewMerge.completedExtensionCount({ rounds: [round1Questions({ selectedQuestionId: "eq1" })] }) === 0,
  "B: selected question → 0"
);
assert(
  reviewMerge.completedExtensionCount({
    rounds: [round1Questions({ selectedQuestionId: "eq1", answer: "我正在寫，但還沒整理結論。" })],
  }) === 0,
  "C: answer draft → 0"
);
assert(
  reviewMerge.completedExtensionCount({
    rounds: [{ id: "ext1", questions: [], retrieval: RETRIEVAL_USED }],
  }) === 0,
  "D: retrieval metadata → 0"
);
assert(
  reviewMerge.completedExtensionCount({
    rounds: [
      round1Questions({
        selectedQuestionId: "eq1",
        answer: "我已經寫下真正想到的答案了。",
        deepConclusion: "",
        completedAt: "",
      }),
    ],
  }) === 0,
  "E: close failure → 0"
);

const done1 = reviewMerge.normalizeReflectionExtension({ rounds: [round1Completed()] });
assert(reviewMerge.completedExtensionCount(done1) === 1, "F: deepConclusion + completedAt → 1");
assert(done1.rounds[0].completedAt, "F: completedAt persisted");
assert(reflectionExt.extensionAskAllowed(done1, "ext2"), "F: 第二次 ask 可用");
assert(reviewMerge.canStartExtensionRound2(done1), "F: canStartRound2 true");
assert(!reviewMerge.extensionDailyLimitReached(done1), "F: dailyLimitReached false");
assert(app.includes("startNextRound: true"), "F: 再延伸一次傳 startNextRound");
assert(app.includes("canStartRound2 && !round2Active"), "F: CTA 看 canStartRound2 不是 incomplete Round 1");
assert(!/completedCount === 1 && !incomplete && ext\.rounds\.length < 2/.test(app), "F: 不再用 rounds.length 擋第二輪");

const ghost = reviewMerge.normalizeReflectionExtension({
  rounds: [round1Completed(), { id: "ext_ghost", questions: [], retrieval: RETRIEVAL_EMPTY }],
});
assert(reviewMerge.completedExtensionCount(ghost) === 1, "ghost 不算 completed");
assert(reflectionExt.extensionAskAllowed(ghost, "ext_ghost"), "ghost 可當成 Round 2 draft 生成");
assert(reflectionExt.extensionAskAllowed(ghost, "ext2"), "即使有 ghost，completed=1 仍可進 Round 2");

const mergedRound2 = reviewMerge.upsertReflectionExtensionRound(done1, {
  id: "ext2",
  questions: [],
});
assert(mergedRound2.rounds[0].id === "ext1", "G: Round 1 仍在");
assert(mergedRound2.rounds[0].deepConclusion === done1.rounds[0].deepConclusion, "G: Round 1 conclusion 保留");
assert(mergedRound2.rounds[0].completedAt === done1.rounds[0].completedAt, "G: Round 1 completedAt 保留");
assert(mergedRound2.rounds[0].retrieval && mergedRound2.rounds[0].retrieval.selectedPast.length === 1, "G: Round 1 retrieval 保留");
assert(mergedRound2.rounds.some((item) => item.id === "ext2"), "G: Round 2 draft 建立");
assert(reviewMerge.completedExtensionCount(mergedRound2) === 1, "H: Round 2 draft → still 1");

const asked2 = reviewMerge.upsertReflectionExtensionRound(mergedRound2, {
  id: "ext2",
  questions: [
    { id: "eq1", text: "被接住之後，你還怕失去什麼？" },
    { id: "eq2", text: "如果對方聽懂了但不改，你真正要面對的是哪一層？" },
    { id: "eq3", text: "這條線對你自己意味著什麼？" },
  ],
});
assert(reviewMerge.completedExtensionCount(asked2) === 1, "H: Round 2 questions → still 1");

const round2Draft = asked2.rounds.find((item) => item.id === "ext2");
const twoDone = reviewMerge.upsertReflectionExtensionRound(asked2, {
  ...round2Draft,
  selectedQuestionId: "eq2",
  selectedQuestionText: "如果對方聽懂了但不改，你真正要面對的是哪一層？",
  answer: "第二次我看見自己其實怕的是關係裡沒有位置。",
  answerSig: "第二次我看見自己其實怕的是關係裡沒有位置。",
  deepConclusion: "你真正想守住的，也許不是這次有沒有被同意，而是自己還有沒有位置。",
  completedAt: "2026-08-31T05:00:00.000Z",
});
assert(reviewMerge.completedExtensionCount(twoDone) === 2, "I: Round 2 completed → 2");
assert(!reflectionExt.extensionAskAllowed(twoDone, "ext3"), "I: 2/2 不再允許第三輪");
assert(twoDone.rounds.length === 2, "I: 不會長出第三輪");

const reload1 = reviewMerge.mergeInsightObjects(
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: done1 } },
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: done1 } }
);
assert(reviewMerge.completedExtensionCount(reload1.guide.extension) === 1, "J: reload after Round 1 → still 1");
assert(reflectionExt.extensionAskAllowed(reload1.guide.extension, "ext2"), "J: reload 後第二輪 CTA 仍可");

const reloadDraft = reviewMerge.mergeInsightObjects(
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: done1 } },
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: asked2 } }
);
assert(reloadDraft.guide.extension.rounds[0].completedAt, "K: Round 1 completed 仍在");
assert(reloadDraft.guide.extension.rounds.some((item) => item.id === "ext2" && item.questions.length === 3), "K: Round 2 progress 仍在");
assert(reviewMerge.completedExtensionCount(reloadDraft.guide.extension) === 1, "K: draft 不算 2");

const emptyRet = reviewMerge.normalizeReflectionExtension({
  rounds: [round1Completed({ retrieval: RETRIEVAL_EMPTY })],
});
assert(reviewMerge.completedExtensionCount(emptyRet) === 1, "L: retrieved 0 / used 0 → completed 1");
assert(reflectionExt.extensionAskAllowed(emptyRet, "ext2"), "L: transition 正常");

const usedRet = reviewMerge.normalizeReflectionExtension({ rounds: [round1Completed()] });
assert(reviewMerge.completedExtensionCount(usedRet) === 1, "M: retrieved >0 / used >0 → completed 1");
assert(reflectionExt.extensionAskAllowed(usedRet, "ext2"), "M: transition 正常");

assert(reviewMerge.historyDeepThinkingView({ journal: { insight: { guide: { rounds: [{ question: "舊題", answer: "舊答" }] } } } }).kind === "guide", "N: legacy 不 crash");
assert(reviewMerge.completedExtensionCount({ rounds: [{ question: "legacy" }] }) === 0, "N: legacy extension 無 completedAt → 0");

const splitIds = reviewMerge.mergeInsightObjects(
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: { rounds: [round1Completed({ id: "ext_abc" })] } } },
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: { rounds: [round1Completed({ id: "ext1" })] } } }
);
assert(splitIds.guide.extension.rounds.length === 1, "persist merge 同 index 不同 id 不長出第二輪");
assert(reviewMerge.completedExtensionCount(splitIds.guide.extension) === 1, "不同 id 同 index 不加成 2/2");
assert(reflectionExt.extensionAskAllowed(splitIds.guide.extension, "ext2"), "merge 後仍可進 Round 2");

const dupLimit = reflectionExt.tighterExtensionLimit(
  { rounds: [round1Completed({ id: "ext_abc" })] },
  { rounds: [round1Completed({ id: "ext1" })] }
);
assert(dupLimit.completed === 1, "limit 不把同 index 不同 id 加成 2/2");
assert(reflectionExt.extensionAskAllowed({ rounds: dupLimit.rounds }, "ext2"), "concat 誤判修復後 Round 2 可 ask");

const ghostLimit = reflectionExt.tighterExtensionLimit(done1, ghost);
assert(ghostLimit.completed === 1, "ghost + completed 仍是 1");
assert(reflectionExt.extensionAskAllowed({ rounds: ghostLimit.rounds }, "ext2"), "server 不因 ghost 擋 Round 2");

assert(!/function isExtensionRoundCompleted[\s\S]{0,280}retrieval/.test(fs.readFileSync(path.join(root, "lib/review-merge.js"), "utf8")), "completed 不看 retrieval");
assert(!/function isExtensionRoundCompleted[\s\S]{0,220}retrieval/.test(fs.readFileSync(path.join(root, "lib/reflection-extension.js"), "utf8")), "lib completed 不看 retrieval");

assert(app.includes('node.closest("#btnThinkExtAgain")'), "再延伸一次走 delegated click");
assert(app.includes("document.getElementById(\"page-today\")?.addEventListener(\"click\""), "today 用 click 不是 pointerdown");
assert(app.includes('id="btnThinkExtAgain"') && app.includes('type="button"'), "再延伸一次是 button");
assert(!/function generateThinkExtensionAsk[\s\S]{0,900}selectedPast/.test(app) || /function generateThinkExtensionAsk[\s\S]{0,2200}isRound1Ask/.test(fs.readFileSync(path.join(root, "api/review.js"), "utf8")), "Round 2 不另接 retrieval");
assert(app.includes("completedAt: kept.completedAt || new Date().toISOString()"), "close persist completedAt");
assert(/function renderThinkExtension[\s\S]{0,4500}renderThinkExtensionRecord/.test(app), "完成後顯示第一輪內容");
assert(app.includes("今日已完成 ${completedCount} / 2 次延伸思考"), "1/2 文案");
assert(!app.includes("paintInternalExtensionDebug"), "extension debug UI 已移除");
assert(!app.includes("Internal Extension · rounds"), "Internal Extension 摘要已移除");
assert(!app.includes("internal-extension-debug"), "extension debug class 已移除");
assert(!app.includes("[ING][extension-state]"), "extension-state console panel 已移除");
assert(!css.includes("internal-extension-debug"), "debug CSS 已移除");
assert(app.includes("paintInternalRetrievalDebug"), "Internal Retrieval 仍保留");
assert(app.includes("Internal Retrieval · retrieved"), "4B-2 retrieval 驗收行仍在");
assert(app.includes("if (!live && !retrieval) return"), "retrieved 0 仍顯示 Internal Retrieval");
assert(app.includes("ext.rounds.find((item) => item && item.retrieval)"), "完成後仍畫 Round 1 retrieval");
assert(app.includes("startNextRound: true"), "startNextRound 仍在");
assert(app.includes("if (completedCount >= 1 && current.id === firstId"), "Round 2 不 reuse round[0].id");

const prodState = reviewMerge.normalizeReflectionExtension({
  rounds: [
    {
      id: "r1",
      questions: QS,
      selectedQuestionId: "eq1",
      selectedQuestionText: QS[0].text,
      answer: "meaningful answer",
      deepConclusion: "meaningful conclusion",
      completedAt: "2026-08-31T06:00:00.000Z",
    },
  ],
});
assert(reviewMerge.completedExtensionCount(prodState) === 1, "production fixture completedCount = 1");
assert(reviewMerge.canStartExtensionRound2(prodState) === true, "production fixture canStartRound2 = true");
assert(reviewMerge.extensionDailyLimitReached(prodState) === false, "production fixture dailyLimitReached = false");
assert(reflectionExt.completedExtensionCount(prodState) === 1, "server completedCount 與 client 相同");
assert(reflectionExt.canStartExtensionRound2(prodState) === true, "server canStartRound2 與 client 相同");
assert(reflectionExt.extensionAskAllowed(prodState, "r2"), "production fixture 可送 Round 2 ask");

const afterAskOnly = reviewMerge.normalizeReflectionExtension({
  rounds: [{ id: "r1", questions: QS, selectedQuestionId: "eq1", answer: "meaningful answer" }],
});
assert(reviewMerge.completedExtensionCount(afterAskOnly) === 0, "Round 1 questions generation 不算 completed");
assert(reviewMerge.completedExtensionCount(prodState) === 1, "questions + deepConclusion 仍只算 1 round");

const missingSelect = reviewMerge.normalizeReflectionExtension({
  rounds: [
    {
      id: "r1",
      questions: QS,
      selectedQuestionId: "",
      answer: "",
      deepConclusion: "meaningful conclusion",
      completedAt: "2026-08-31T06:00:00.000Z",
    },
  ],
});
assert(missingSelect.rounds[0].completedAt === "2026-08-31T06:00:00.000Z", "normalize 不因缺 selectedQuestionId 清掉 completedAt");
assert(reviewMerge.completedExtensionCount(missingSelect) === 1, "canonical completed 只看 conclusion + completedAt");
assert(reviewMerge.canStartExtensionRound2(missingSelect) === true, "缺 selectedQuestionId 仍可進 Round 2");

const round2Append = reviewMerge.upsertReflectionExtensionRound(prodState, {
  id: "r2",
  questions: [
    { id: "eq1", text: "被接住之後，你還怕失去什麼？" },
    { id: "eq2", text: "如果對方聽懂了但不改，你真正要面對的是哪一層？" },
    { id: "eq3", text: "這條線對你自己意味著什麼？" },
  ],
});
assert(round2Append.rounds.length === 2, "click Round 2 → rounds.length = 2");
assert(round2Append.rounds[0].id === "r1", "rounds[0] id 不變");
assert(round2Append.rounds[0].deepConclusion === prodState.rounds[0].deepConclusion, "rounds[0] conclusion 不變");
assert(round2Append.rounds[0].completedAt === prodState.rounds[0].completedAt, "rounds[0] completedAt 不變");
assert(round2Append.rounds[1].id === "r2", "rounds[1] 是新 id");
assert(round2Append.rounds[1].questions.length === 3, "rounds[1].questions.length = 3");
assert(reviewMerge.completedExtensionCount(round2Append) === 1, "Round 2 questions 仍是 1/2");
assert(round2Append.rounds[1].id !== round2Append.rounds[0].id, "不能 reuse round[0].id");

const reloadProd = reviewMerge.mergeInsightObjects(
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: prodState } },
  { guide: { variant: "reflection-v3", coreQuote: "金句", questions: [{ text: "第一層？" }], extension: prodState } }
);
assert(reviewMerge.completedExtensionCount(reloadProd.guide.extension) === 1, "reload fixture completedCount = 1");
assert(reviewMerge.canStartExtensionRound2(reloadProd.guide.extension) === true, "reload fixture canStartRound2 = true");
assert(!reviewMerge.extensionDailyLimitReached(reloadProd.guide.extension), "reload 不是 2/2");

assert(/\.think-ext-text-btn\s*\{[^}]*min-height:\s*44px/.test(css), "再延伸一次 touch target");
assert(!/#page-today[\s\S]{0,80}\.think-ext-text-btn[\s\S]{0,80}pointer-events:\s*none/.test(css), "再延伸一次沒有 pointer-events none");

assert(html.includes("app.js?v=271"), "cache app.js");
assert(html.includes("lib/review-merge.js?v=24"), "cache review-merge");

console.log("extension-round2 tests passed");
