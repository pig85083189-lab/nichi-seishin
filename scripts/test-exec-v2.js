const fs = require("fs");
const path = require("path");
const {
  emptyExecutionChoiceBag,
  normalizeExecutionChoiceBag,
  hasMeaningfulExecutionChoices,
  selectedExecutionChoiceActions,
  mergeExecutionChoiceBags,
  mergeJournalObjects,
  insightExecutionFallbackOptions,
} = require("../lib/review-merge");
const {
  EXECUTION_CHOICES_SYSTEM,
  EXEC_DEEP_ASK_SYSTEM,
  EXEC_DEEP_CLOSE_SYSTEM,
  EXEC_DEEP_REFRESH_SYSTEM,
  choicesKind,
  choicesUserPrompt,
  featureForReviewRequest,
} = (() => {
  const review = require("../api/review");
  const entitlement = require("../lib/entitlement");
  return {
    EXECUTION_CHOICES_SYSTEM: review.EXECUTION_CHOICES_SYSTEM,
    EXEC_DEEP_ASK_SYSTEM: review.EXEC_DEEP_ASK_SYSTEM,
    EXEC_DEEP_CLOSE_SYSTEM: review.EXEC_DEEP_CLOSE_SYSTEM,
    EXEC_DEEP_REFRESH_SYSTEM: review.EXEC_DEEP_REFRESH_SYSTEM,
    choicesKind: review.choicesKind,
    choicesUserPrompt: review.choicesUserPrompt,
    featureForReviewRequest: entitlement.featureForReviewRequest,
  };
})();
const execV2 = require("../lib/exec-v2");
const { buildHistoryReading } = require("../lib/history-reading");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes("選擇你想帶走的行動"), "06 勾選語意：選擇帶走");
assert(html.includes("勾選後會加入執行力"), "06 helper：加入執行力");
assert(html.includes("把今天的覺察，變成真正做得到的下一步"), "06 fold 文案");
assert(html.includes("id=\"execCardCol\""), "舊行動卡欄可隱藏");
assert(!html.includes("Claude") || !/section-exec[\s\S]{0,800}Claude/.test(html), "06 不顯示 Claude");

assert(EXECUTION_CHOICES_SYSTEM.includes("固定產出 3 個"), "1. 固定 3 個");
assert(EXECUTION_CHOICES_SYSTEM.includes("不能只是把使用者原話換句話說"), "避免複誦");
assert(EXECUTION_CHOICES_SYSTEM.includes("NEXT STEP"), "8. 必須是 next step");
assert(EXECUTION_CHOICES_SYSTEM.includes("好好溝通"), "3. generic 禁止清單");
assert(EXECUTION_CHOICES_SYSTEM.includes("needFollowup 必須是 false"), "初始不再追問");
assert(EXEC_DEEP_ASK_SYSTEM.includes("最多 2 題"), "11. 最多 2");
assert(EXEC_DEEP_ASK_SYSTEM.includes("絕對沒有第 3 題") || EXEC_DEEP_ASK_SYSTEM.includes("禁止第 3 題"), "13. 沒有 Q3");
assert(EXEC_DEEP_ASK_SYSTEM.includes("你真正的感受是什麼"), "06 deep 不重做 04");
assert(EXEC_DEEP_CLOSE_SYSTEM.includes("executionSummary"), "close 一次回 summary");
assert(EXEC_DEEP_CLOSE_SYSTEM.includes("剛好 3 個最終行動") || EXEC_DEEP_CLOSE_SYSTEM.includes("options：剛好 3"), "close 一次回 3 actions");
assert(EXEC_DEEP_CLOSE_SYSTEM.includes("不是原本行動換句話說") || EXEC_DEEP_CLOSE_SYSTEM.includes("不要只是把原本 3 個換句話說"), "final 不是換句話說");
assert(EXEC_DEEP_REFRESH_SYSTEM === EXEC_DEEP_CLOSE_SYSTEM, "舊 refresh 走同一份 close");
assert(execV2.execDeepStep({ step: "refresh" }) === "close", "refresh step 映射 close");
assert(execV2.execDeepStep({ step: "final" }) === "close", "final step 映射 close");

assert(choicesKind({ kind: "execution-deep" }) === "execution-deep", "deep kind 獨立");
assert(featureForReviewRequest({ mode: "choices", kind: "execution-deep" }) === "execution_ai", "deep 仍走 execution_ai");
assert(featureForReviewRequest({ mode: "choices", kind: "execution" }) === "execution_ai", "初始仍走 execution_ai");

const options = [
  { id: "e1", text: "寫下最希望被理解的一件", detail: "先用一句話寫清楚最希望對方理解的那一件。" },
  { id: "e2", text: "先確認對方理解到哪裡", detail: "下次先請對方說說目前理解的是什麼。" },
  { id: "e3", text: "分開理解與實際改變", detail: "寫下這次期待的是理解還是做法改變。" },
];
const bag = normalizeExecutionChoiceBag({ options, selectedIds: ["e1", "e3"] });
assert(bag.options.length === 3, "1. 3 actions");
assert(bag.options.every((item) => item.text && item.detail), "2. title + detail");
const selected = selectedExecutionChoiceActions(bag);
assert(selected.length === 2, "5. 可選 1～3，這裡選 2");
assert(selected.every((item) => item.detail), "7. 已選保留 detail");
assert(selected.map((item) => item.text).join("|") === `${options[0].text}|${options[2].text}`, "6. selected 正確");

const empty = emptyExecutionChoiceBag();
assert(hasMeaningfulExecutionChoices(empty) === false, "空 bag 仍空");
const withDeep = normalizeExecutionChoiceBag({
  options,
  selectedIds: ["e1"],
  deep: { status: "asking", rounds: [{ question: "這三個裡哪一個最可能讓事情不一樣？", answer: "先確認理解。" }] },
});
assert(hasMeaningfulExecutionChoices(withDeep), "deep 算有內容");
const merged = mergeExecutionChoiceBags(withDeep, emptyExecutionChoiceBag());
assert(merged.deep.rounds[0].answer === "先確認理解。", "14. 空 bag 不覆蓋 deep answer");
assert(merged.selectedIds[0] === "e1", "8. reload selected 不丟");

const journalMerged = mergeJournalObjects(
  { executionChoices: withDeep },
  { executionChoices: emptyExecutionChoiceBag() }
);
assert(journalMerged.executionChoices.deep.rounds[0].answer === "先確認理解。", "cloud merge 不丟 Q1");

const soup = execV2.normalizeExecutionSummary("相信自己，勇敢踏出下一步。");
assert(soup === "", "5. 雞湯 summary 被拒絕");
const goodSummary = execV2.normalizeExecutionSummary("這次不是再說更多，而是先確認彼此真正沒對上的地方。");
assert(goodSummary.length >= 18 && goodSummary.length <= 35, "5. summary 一句適長");
assert(!goodSummary.includes("\n"), "5. summary 一句");

const finalBag = normalizeExecutionChoiceBag({
  options,
  selectedIds: ["e1"],
  deep: {
    status: "closed",
    rounds: [{ question: "哪一件最可能讓事情不一樣？", answer: "先確認她聽到的是不是同一件事。" }],
    executionSummary: "這次不是再說更多，而是先確認彼此真正沒對上的地方。",
    finalOptions: [
      { id: "f1", text: "先問她聽到的是哪一句", detail: "下次只請她複述她聽到的重點，對上再往下說。" },
      { id: "f2", text: "寫下這次沒對上的點", detail: "談完後用一句話記下真正的落差，不要再補一長串解釋。" },
      { id: "f3", text: "分開理解與改變期待", detail: "先標出這次只要被聽懂，還是也要做法改變。" },
    ],
    finalSelectedIds: ["f1"],
  },
});
assert(execV2.hasExecDeepFinal(finalBag.deep), "6. final result 完整");
assert(finalBag.deep.finalOptions.length === 3, "7. finalOptions 固定 3");
assert(finalBag.deep.finalOptions.every((item) => item.text && item.detail), "8. final 有 title + detail");
assert(finalBag.deep.executionSummary, "6. executionSummary 不為空");

const mergedFinal = mergeExecutionChoiceBags(finalBag, emptyExecutionChoiceBag());
assert(mergedFinal.deep.executionSummary === finalBag.deep.executionSummary, "12. 空 bag 不丟 summary");
assert(mergedFinal.deep.finalOptions.length === 3, "12. 空 bag 不丟 finalOptions");
assert(mergedFinal.deep.finalSelectedIds[0] === "f1", "12. 空 bag 不丟 finalSelectedIds");

const journalFinal = mergeJournalObjects(
  { executionChoices: finalBag },
  { executionChoices: emptyExecutionChoiceBag() }
);
assert(journalFinal.executionChoices.deep.finalOptions.length === 3, "12. cloud merge 不丟 final");

const selectedFinal = selectedExecutionChoiceActions(finalBag);
assert(selectedFinal.some((item) => item.id === "e1"), "13. 原本已選仍在");
assert(selectedFinal.some((item) => item.id === "f1"), "9. final 已選也算 selected");
assert(selectedFinal.length === 2, "14. 不同內容不互相覆蓋");

const similarFinal = normalizeExecutionChoiceBag({
  options,
  selectedIds: ["e2"],
  deep: {
    status: "closed",
    executionSummary: "現在缺的不是再說一次，而是先確認她理解到哪。",
    finalOptions: [
      { id: "f1", text: "先確認對方理解到哪裡", detail: "幾乎同一句，不該再加一筆。" },
      { id: "f2", text: "記下這次沒對上的一句", detail: "談完只留一句真正落差。" },
      { id: "f3", text: "下次只講一件事", detail: "開口前先選一件最想被聽懂的。" },
    ],
    finalSelectedIds: ["f1"],
  },
});
const similarSelected = selectedExecutionChoiceActions(similarFinal);
assert(similarSelected.length === 1, "14. 高度相似不重複進 History／Execution");
assert(similarSelected[0].text === options[1].text, "14. 沿用已加入的原文");

const legacyBag = normalizeExecutionChoiceBag({ options, selectedId: "e2" });
assert(legacyBag.selectedIds[0] === "e2", "17. legacy selectedId 相容");
assert(legacyBag.deep.finalOptions.length === 0, "17. legacy 沒有 final 也不壞");
assert(execV2.hasExecDeepFinal(legacyBag.deep) === false, "17. legacy 不算已完成 deep");

const already = execV2.extractAlreadyDone({
  event: "我已經跟媽媽說了，可是她還是沒有理解。",
});
assert(already.some((item) => /已經跟媽媽說/.test(item)), "4. 已做過可被抽出");
assert(execV2.looksGenericExecAction("好好溝通", "找時間好好說話"), "3. generic 可辨");
assert(execV2.looksParaphraseOfUser("我想跟媽媽好好說話", "跟媽媽好好說話"), "避免原話複誦");
assert(!execV2.looksGenericExecAction("今晚洗完澡後就直接準備上床", "到點把手機放到床以外", { mood: "疲憊", event: "今天只是很累" }), "累的日子允許恢復行動");

const unseen = insightExecutionFallbackOptions("我很努力，但重要的人沒有看見。自己知道就好。");
assert(unseen.length === 3, "fallback 固定 3");
unseen.forEach((item) => {
  assert(item.text && item.detail, "fallback 有 title+detail");
  assert(!/感恩|靜坐|早睡|相信自己|好好溝通/.test(`${item.text}${item.detail}`), `fallback 不 generic：${item.text}`);
});

const tired = insightExecutionFallbackOptions("今天只是太累了，身體很疲憊，睡眠不足。");
assert(tired.length === 3, "D 疲憊也是 3 個");
assert(tired.every((item) => /睡|休息|耗神|必做|恢復|上床/.test(`${item.text}${item.detail}`)), "D 與恢復有關");

const q1 = { status: "asking", rounds: [{ question: "哪一個最可能讓事情不一樣？", answer: "就選先確認對方理解到哪裡，因為上次沒對上。" }] };
assert(execV2.shouldSkipExecDeepAsk(q1, options) === true, "11. Q1 後可 early stop");
const vague = { status: "asking", rounds: [{ question: "還缺什麼？", answer: "還不確定。" }] };
assert(execV2.shouldSkipExecDeepAsk(vague, options) === false, "不確定時可問 Q2");
assert(execV2.shouldSkipExecDeepAsk({ status: "closed", rounds: q1.rounds.concat([{ question: "阻礙是什麼？", answer: "時間。" }]) }, options) === true, "12. 兩題後停止");
assert(execV2.EXEC_DEEP_MAX === 2, "13. 常數最多 2");

const refreshed = execV2.mergeRefreshedExecOptions(options, ["e1"], [
  { id: "e1", text: "不該覆蓋已選", detail: "x" },
  { id: "n2", text: "下次改問她理解到哪", detail: "先聽她怎麼說。" },
  { id: "n3", text: "記錄這次沒對上的點", detail: "談完後寫一句真正的落差。" },
]);
assert(refreshed[0].text === options[0].text, "15. 已選不覆蓋");
assert(refreshed.some((item) => item.text === "下次改問她理解到哪"), "未選可更新");

const reading = buildHistoryReading({
  journal: {
    event: "想跟媽媽好好說話",
    executionChoices: { options, selectedIds: ["e1", "e2"] },
  },
});
assert(reading.actions.length === 2, "16. History ④ = selected");
assert(reading.actions[0].text === options[0].text, "16. History 用同一份 title");
assert(reading.actions[0].detail === options[0].detail, "16. History 帶 detail");

const readingFinal = buildHistoryReading({
  journal: {
    event: "想跟媽媽好好說話",
    executionChoices: finalBag,
  },
});
assert(readingFinal.actions.some((item) => item.text === options[0].text), "15. History ④ 含原本已選");
assert(readingFinal.actions.some((item) => item.text === finalBag.deep.finalOptions[0].text), "15. History ④ 含 final 已選");
assert(!readingFinal.actions.some((item) => item.text === finalBag.deep.executionSummary), "15. History 不自己生成 summary 當行動");

assert(app.includes("function generateExecDeepAsk"), "10. deep Q1");
assert(app.includes("function submitExecDeepAnswer"), "deep 作答");
assert(app.includes("function generateExecDeepFinal"), "deep close 自動 final");
assert(!app.includes("function refreshExecActions"), "不再手動 refresh");
assert(!app.includes("btnExecDeepRefresh"), "4. 不再出現 refresh button");
assert(!app.includes("依照剛剛的回答，重新整理行動"), "4. 不再出現 refresh 文案");
assert(app.includes("syncSelectedExecutionToSidebar"), "6. 勾選加入 Execution");
assert(app.includes("data-choice-kind=\"${showFinal ? \"execution-final\" : \"execution\"}\"") || app.includes("execution-final"), "9. final 可勾選");
assert(app.includes("hasExecDeepFinal(bag.deep) && !options.force"), "10. reload 有 final 不重打 model");
assert(app.includes("step: \"close\""), "10. final 一次 close request");
assert(app.includes("executionSummary"), "5. 有執行力總結");
assert(app.includes("執行力總結"), "5. UI label");
assert(app.includes("接下來可以這樣做"), "final checklist 標題");
assert(app.includes("深度思考完成"), "deep close 標題");
assert(css.includes(".exec-summary") && css.includes(".exec-summary__text"), "總結 editorial");
assert(!css.includes("exec-summary") || !/\.exec-summary[^{]*{[^}]*box-shadow:\s*(?!none)/.test(css), "總結無重陰影");
assert(app.includes("rejectArchivedJournalWrite"), "17. completed read-only");
assert(app.includes("choicesBusy?.executionDeep"), "request lock");
assert(app.includes("withExecDeepDraft"), "14. deep draft autosave");
assert(app.includes("executionChoices.deep") || app.includes("bag.deep"), "deep 存在 jsonb");
assert(app.includes("function generateThinkV2Ask"), "19. 04 V2 仍在");
assert(app.includes("function generateAwarenessChoices"), "20. 05 仍在");
assert(app.includes("persistArchivedUserMarks"), "21. userMarks 未拆");
assert(css.includes(".exec-deep") && css.includes("overflow-wrap: anywhere"), "mobile 換行");
assert(app.includes("function generateExecutionChoices"), "legacy executionChoices 主函式仍在");
const initialFn = app.match(/async function generateExecutionChoices[\s\S]*?\nasync function generateExecDeepAsk/);
assert(initialFn && initialFn[0].includes('kind: "execution"'), "1. 不做 deep 仍只打初始 execution");
assert(initialFn && !initialFn[0].includes("generateExecDeepFinal"), "1. 不做 deep 不自動 final");
assert(/if \(shouldSkipExecDeepAsk\(bag\.deep, bag\.options\)\)[\s\S]{0,240}generateExecDeepFinal/.test(app), "2. Q1 early close 自動 final");
assert(/answered\.length >= 2 \|\| shouldSkipExecDeepAsk[\s\S]{0,220}generateExecDeepFinal/.test(app), "3. Q2 close 自動 final");
assert(/function generateExecDeepFinal[\s\S]{0,2800}persistJournalQuietly/.test(app), "11. final result autosave");
assert(reviewJs.includes("EXECUTION_PROMPTS_SYSTEM"), "18. 舊 Q&A prompt 仍在");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "schema 零修改");
assert(!/generateExecDeepFinal[\s\S]{0,1800}removeTask|generateExecDeepFinal[\s\S]{0,1800}deleteTask/.test(app), "13. final 不刪既有 task");
assert(app.includes("lookSimilar(String(task.title || \"\"), item.title)"), "14. 高度相似不重複加入");

const prompt = choicesUserPrompt({
  mode: "choices",
  kind: "execution",
  context: {
    awarenessLine: "我真正缺的是一次對得上的理解。",
    awarenessSeen: "我看見自己一直重複解釋。",
    thinkVariant: "think-v2",
    thinkSelected: ["我想跟媽媽好好說話，可是已經說過了。"],
    thinkCloseAwareness: "卡住的不是沒說，是說了對不上。",
    thinkCloseSelfSeen: "我看見自己會把很多事一次倒出來。",
    event: "我已經跟媽媽說了，可是她還是沒有理解。",
    mood: "委屈",
  },
});
assert(prompt.includes("【05 核心覺察】"), "讀 05");
assert(prompt.includes("【04 真正卡住的】"), "讀 V2 stuck");
assert(prompt.includes("已經跟媽媽說了"), "讀已做過");
assert(prompt.includes("禁止把已經做過的事再當下一步"), "4. already-done rule");
assert(!prompt.includes("人生願景"), "06 不搶願景");

const deepPrompt = execV2.execDeepUserPrompt({
  context: {
    actions: options,
    awarenessLine: "對不上",
    thinkCloseAwareness: "說了還沒被理解",
    event: "跟媽媽談過了",
    deep: { rounds: [{ question: "最希望改變的是理解還是做法？", answer: "理解。" }] },
  },
});
assert(deepPrompt.includes("第 2/2 題"), "Q2 才是最後一題");
assert(deepPrompt.includes("不要重做 04"), "deep 不重做 04");
assert(deepPrompt.includes("禁止第 3 題"), "沒有 Q3 路徑");

const closePrompt = execV2.execCloseUserPrompt({
  context: {
    actions: options,
    keptActions: [options[0]],
    awarenessLine: "真正缺的是對上，不是再說一次。",
    thinkCloseAwareness: "卡住的不是沒說，是說了對不上。",
    event: "我已經跟媽媽說了，可是她還是沒有理解。",
    deep: { rounds: [{ question: "最希望改變的是理解還是做法？", answer: "先確認她聽到的是不是同一件事。" }] },
  },
});
assert(closePrompt.includes("executionSummary"), "close prompt 要 summary");
assert(closePrompt.includes("3 個新的最終行動"), "close prompt 要 3 finals");
assert(closePrompt.includes("先確認她聽到的是不是同一件事"), "close 讀 Q1 answer");
assert(closePrompt.includes(options[0].text), "close 讀原本 actions");

console.log("exec v2 tests passed");
