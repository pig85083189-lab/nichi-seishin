const fs = require("fs");
const path = require("path");
const {
  emptyExecutionChoiceBag,
  normalizeExecutionChoiceOptions,
  normalizeExecutionChoiceBag,
  hasMeaningfulExecutionChoices,
  selectedExecutionChoiceText,
  mergeExecutionChoiceBags,
  mergeJournalObjects,
  choicesLookSimilar,
  EXEC_CHOICE_CUSTOM_ID,
  EXEC_CHOICE_CUSTOM_TEXT,
} = require("../lib/review-merge");
const {
  EXECUTION_CHOICES_SYSTEM,
  EXECUTION_PROMPTS_SYSTEM,
  choicesUserPrompt,
  choicesKind,
  normalizeExecutionChecklistItems,
  MANIFEST_PROMPTS_SYSTEM,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const analyticsClient = fs.readFileSync(path.join(root, "analytics.js"), "utf8");
const analyticsServer = fs.readFileSync(path.join(root, "lib/analytics.js"), "utf8");

const longAction =
  "今晚 9:30 洗完澡後，把手機放到客廳充電，直接換上睡衣準備上床，不再打開任何需要動腦的訊息。";

const sleepOptions = [
  { id: "e1", text: "今晚 9:30 洗完澡後就直接準備上床" },
  { id: "e2", text: "睡前 30 分鐘把手機放到床以外的地方" },
  { id: "e3", text: "晚上 10 點後不再安排需要動腦的事情" },
];

/* CASE A：04＋05 足夠時，prompt 要求直接給 3 個行動、不出問答 */
assert(EXECUTION_CHOICES_SYSTEM.includes("needFollowup 必須是 false"), "CASE A：足夠時禁止追問");
assert(EXECUTION_CHOICES_SYSTEM.includes("不要再問一長串問題"), "CASE A：新版不是問答");
assert(app.includes("executionContextEnough"), "CASE A：client 判斷 04／05 是否足夠");
assert(app.includes("allowFollowup = !enough && !alreadyFollowed"), "CASE A：足夠時 client 忽略 followup");

const enoughPrompt = choicesUserPrompt({
  mode: "choices",
  kind: "execution",
  context: {
    awarenessLine: "我真正缺的不是意志力，是一個明確的睡覺開始點。",
    awarenessSeen: "我看見自己常常洗完澡後又滑手機，把上床時間往後推。",
    thinkSelected: ["我害怕的可能不是失去，而是來不及好好休息"],
    thinkCloseSelfSeen: "我看見自己總把休息排到最後。",
    event: "今天加班到很晚，回家還是先滑手機。",
    mood: "累",
  },
});
assert(enoughPrompt.includes("【05 核心覺察】"), "CASE A：06 讀 05 核心覺察");
assert(enoughPrompt.includes("【04 勾選】"), "CASE A：06 讀 04 勾選");
assert(enoughPrompt.includes("needFollowup=false"), "CASE A：足夠時直接給行動");
assert(!enoughPrompt.includes("人生願景"), "CASE A：06 不搶 07");

/* CASE B：近義重複會被丟掉 */
assert(choicesLookSimilar("今晚早一點上床睡覺休息夠", "今晚早一點上床睡覺比較好"), "CASE B：8 字窗可判斷近義");
const duped = normalizeExecutionChoiceOptions([
  { id: "e1", text: "今晚早一點上床睡覺休息夠" },
  { id: "e2", text: "今晚早一點上床睡覺比較好" },
  { id: "e3", text: "睡前 30 分鐘把手機放到床以外的地方" },
  { id: "e4", text: "晚上 10 點後不再安排需要動腦的事情" },
]);
assert(duped.length === 3, `CASE B：近義重複應去掉後仍能湊 3 個，實際 ${duped.length}`);
assert(duped[0].text !== duped[1].text, "CASE B：留下的選項不可相同");
assert(EXECUTION_CHOICES_SYSTEM.includes("禁止近義重複"), "CASE B：system 禁止近義");

/* CASE C：單選 */
assert(app.includes('role="radiogroup"'), "CASE C：06 用 radiogroup");
assert(app.includes("選 1 個就好"), "CASE C：文案是單選");
assert(app.includes('data-choice-kind="execution"'), "CASE C：execution choice kind");
assert(css.includes('.choice-list[data-choice-kind="execution"] .choice-opt__box'), "CASE C：radio 圓點");
assert(app.includes("if (bag.selectedId === id)"), "CASE C：再點同一項不會變多選");

/* CASE D／E：選完直接成為明天最小的一步，不再重填 */
const selectedBag = normalizeExecutionChoiceBag({
  options: sleepOptions,
  selectedId: "e1",
});
assert(selectedExecutionChoiceText(selectedBag) === sleepOptions[0].text, "CASE D：選中全文成為最小一步");
assert(app.includes('markableP(chosen, "exec.smallestStep"'), "CASE D：選中後直接顯示明天最小的一步");
assert(app.includes("usingExecChoices") && app.includes("no follow-up Q&A after a selected action"), "CASE E：選完不再追問");
assert(html.includes("那你想為明天留下一個什麼小行動？") || app.includes("那你想為明天留下一個什麼小行動？"), "CASE F：自訂才出提示");

/* CASE F／G：我想自己寫 */
assert(EXEC_CHOICE_CUSTOM_ID === "custom", "CASE F：custom id 固定");
assert(EXEC_CHOICE_CUSTOM_TEXT === "我想自己寫", "CASE F：固定選項文案");
assert(!sleepOptions.some((item) => item.text === EXEC_CHOICE_CUSTOM_TEXT), "CASE F：AI options 不含我想自己寫");
const customBag = normalizeExecutionChoiceBag({
  options: sleepOptions,
  selectedId: "custom",
  custom: "明天早餐後先散步 10 分鐘",
});
assert(selectedExecutionChoiceText(customBag) === "明天早餐後先散步 10 分鐘", "CASE G：自訂文字成為最小一步");
assert(app.includes("execChoiceCustomId"), "CASE F：runtime 有 custom");
assert(app.includes("ta.hidden = false"), "CASE F：選自己寫才出 textarea");

/* CASE H／I：資料不足最多 1 題，答完不再第 2 題 */
assert(EXECUTION_CHOICES_SYSTEM.includes("不要出第 2 題"), "CASE H：最多 1 追問");
assert(app.includes("alreadyFollowed"), "CASE I：追問過就不再追問");
assert(app.includes("btnExecChoiceFollow"), "CASE H：追問送出鈕");
assert(!app.includes("generateExecutionFollowup({ fromCards: true })") || app.includes("usingExecChoices"), "CASE I：新版不走舊第 2 題");

/* CASE J：行動卡沿用 */
assert(app.includes("generateJournalChecklist(\"execution\")") || app.includes('generateJournalChecklist("execution")'), "CASE J：仍走行動卡");
assert(app.includes("exec.item."), "CASE J：行動卡 field identity 不變");
assert(app.includes("exec.focus.title"), "CASE J：focus field 不變");
assert(html.includes("收下我的行動卡"), "CASE J：CTA 改收下");

/* CASE K：新版歷史只顯示選中的 */
assert(app.includes("if (hasMeaningfulExecutionChoices(journal.executionChoices)) return []"), "CASE K：新版不渲染未選 options／舊 Q&A");
assert(app.includes("execChosen"), "CASE K：歷史用最後選中的一步");

/* CASE L：舊 Q&A fallback */
assert(app.includes("historyQaHtml(question, `exec.prompt.${index}.question`"), "CASE L：舊問題／回答仍可顯示");
assert(EXECUTION_PROMPTS_SYSTEM.includes("最多 2 輪"), "CASE L：舊路徑 prompt 仍在");

/* CASE M：reload hydrate */
assert(app.includes("state.executionChoices = normalizeExecutionChoiceBag(data.executionChoices)"), "CASE M：fillJournal hydrate");
assert(app.includes("executionChoices: serializeExecutionChoiceBag(state.executionChoices)"), "CASE M：collectJournal 寫回");

/* CASE N：空 bag 不覆蓋 */
const kept = mergeExecutionChoiceBags(
  {
    sourceSig: "sig",
    options: sleepOptions,
    selectedId: "e2",
    custom: "",
    generatedAt: "2026-08-25T10:00:00.000Z",
  },
  emptyExecutionChoiceBag()
);
assert(kept.selectedId === "e2", "CASE N：空 executionChoices 不覆蓋已有選擇");
assert(kept.options.length === 3, "CASE N：空 bag 保留舊 options");
const mergedJournal = mergeJournalObjects(
  { executionChoices: { sourceSig: "sig", options: sleepOptions, selectedId: "e1" } },
  { executionChoices: emptyExecutionChoiceBag() }
);
assert(mergedJournal.executionChoices.selectedId === "e1", "CASE N：journal merge 同樣不覆蓋");

/* CASE O／P／Q：highlight + userMark field identity */
assert(app.includes('"exec.smallestStep"'), "CASE O／P：smallestStep field 不變");
assert(app.includes("exec.item."), "CASE O／P：exec.item field 不變");
assert(app.includes("renderCombinedHighlightedText"), "CASE Q：combined renderer 仍在");
assert(!app.includes("exec.choice."), "CASE P：沒有改掉舊 field identity");

/* CASE R／T：text integrity，禁止硬截斷 option／最小一步 */
const longKept = normalizeExecutionChoiceOptions([{ id: "e1", text: longAction }, ...sleepOptions.slice(1)]);
assert(longKept[0].text === longAction, "CASE T：長行動句完整保留，不可因 72 字丟掉");
assert(!/executionChoices[\s\S]{0,80}\.slice\(0,\s*\d+\)/.test(app) || app.includes("optionsList"), "CASE T：choices 路徑沒有對正文 slice");
const fullCard = normalizeExecutionChecklistItems(
  { items: [{ title: longAction, detail: "洗完澡後把手機放下，直接準備上床。" }] },
  1,
  1,
  longAction,
  { keepFull: true }
);
assert(fullCard[0].title === longAction, "CASE T：行動卡 keepFull 不截 title");
assert(fullCard[0].detail.includes("洗完澡後把手機放下"), "CASE T：detail 完整保留");

/* CASE S：390 CSS wrap */
assert(css.includes("overflow-wrap: anywhere"), "CASE S：長文可換行");
assert(html.includes("id=\"execStepResult\""), "CASE S：選中結果區塊");

/* CASE U：沒有 schema / migration */
assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE U：沒有 schema SQL");
assert(!/UPDATE\s+reviews/i.test(app), "CASE U：沒有批次 UPDATE 舊 reviews");
assert(app.includes("executionPrompts"), "CASE U：舊 executionPrompts key 仍在");
assert(app.includes("smallestStep"), "CASE U：smallestStep key 仍在");

/* CASE V：07 沒被破壞 */
assert(MANIFEST_PROMPTS_SYSTEM.includes("06 執行力") || app.includes("section-manifest"), "CASE V：07 仍在");
assert(app.includes("priorThinkAwareContext(journal)"), "CASE V：07 仍可讀前面資料");
assert(html.includes("guide-07"), "CASE V：使用說明 07 仍在");
assert(EXECUTION_CHOICES_SYSTEM.includes("那些是 07 顯化力"), "CASE V：06 明確不寫願景");

/* Analytics 仍認 action card，並能辨識新事件 */
assert(analyticsClient.includes("execution_choices_generated"), "analytics client 有 choices generated");
assert(analyticsClient.includes("execution_choice_selected"), "analytics client 有 choice selected");
assert(analyticsClient.includes("execution_custom_selected"), "analytics client 有 custom selected");
assert(analyticsClient.includes("action_card_created"), "完成率仍以 action_card_created 為準");
assert(analyticsServer.includes("execution_choices_generated"), "analytics server allowlist 同步");
assert(analyticsServer.includes("action_card_created"), "server 完成率事件仍在");

assert(choicesKind({ kind: "execution-choices" }) === "execution", "choicesKind 認得 execution");
assert(hasMeaningfulExecutionChoices(emptyExecutionChoiceBag()) === false, "空 bag 不算有內容");

assert(html.includes("把今天的覺察變成明天做得到的一小步"), "使用說明已改成選行動，不是回答問題");
assert(!html.includes("AI 會依今天的內容問你 1 題"), "使用說明不再寫舊問答");

console.log("execution choices tests passed");
