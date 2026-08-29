const fs = require("fs");
const path = require("path");
const {
  emptyExecutionChoiceBag,
  normalizeExecutionChoiceOptions,
  normalizeExecutionChoiceBag,
  hasMeaningfulExecutionChoices,
  selectedExecutionChoiceActions,
  selectedExecutionChoiceText,
  mergeExecutionChoiceBags,
  mergeJournalObjects,
  choicesLookSimilar,
  insightExecutionFallbackOptions,
  EXEC_CHOICE_CUSTOM_ID,
  EXEC_CHOICE_CUSTOM_TEXT,
  EXEC_CHOICE_MAX_SELECTED,
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
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

const longAction =
  "今晚 9:30 洗完澡後，把手機放到客廳充電，直接換上睡衣準備上床，不再打開任何需要動腦的訊息。";

const sleepOptions = [
  { id: "e1", text: "今晚 9:30 洗完澡後就直接準備上床" },
  { id: "e2", text: "睡前 30 分鐘把手機放到床以外的地方" },
  { id: "e3", text: "晚上 10 點後不再安排需要動腦的事情" },
];

/* CASE A：04＋05 足夠時，prompt 要求直接給行動、不出問答 */
assert(EXECUTION_CHOICES_SYSTEM.includes("needFollowup 必須是 false"), "CASE A：足夠時禁止追問");
assert(EXECUTION_CHOICES_SYSTEM.includes("不要再問一長串問題"), "CASE A：新版不是問答");
assert(EXECUTION_CHOICES_SYSTEM.includes("不要為了看起來完整硬湊"), "CASE A：不要硬湊 3 個");
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
assert(enoughPrompt.includes("不要為了看起來完整硬湊 3 個"), "CASE A：user prompt 也不硬湊");
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

/* CASE C：多選 1～3 */
assert(app.includes('role="group"'), "CASE C：06 用 group／checkbox");
assert(app.includes("可以選 1～3 件"), "CASE C：文案是多選");
assert(app.includes('role="checkbox"'), "CASE C：checkbox role");
assert(css.includes(".exec-step-list__item"), "CASE C：preview 用簡潔 list");
assert(!css.includes('.choice-list[data-choice-kind="execution"] .choice-opt__box'), "CASE C：不再用 radio 圓點");
assert(app.includes("明天先留 3 件就好。"), "CASE C：第 4 個給輕量提示");
assert(app.includes("selectedIds.includes(id)"), "CASE C：可取消已選");
assert(EXEC_CHOICE_MAX_SELECTED === 3, "CASE C：最多 3 個實際行動");
const multiBag = normalizeExecutionChoiceBag({
  options: sleepOptions,
  selectedIds: ["e1", "e2", "custom"],
  custom: "打電話給媽媽",
});
assert(multiBag.selectedId === "e1", "CASE C：舊 selectedId 仍寫第一個，給舊讀取端");
assert(selectedExecutionChoiceActions(multiBag).map((item) => item.text).join("|") === `${sleepOptions[0].text}|${sleepOptions[1].text}|打電話給媽媽`, "CASE C：多選各自獨立");
const emptyCustomBag = normalizeExecutionChoiceBag({
  options: sleepOptions,
  selectedIds: ["e1", "custom"],
  custom: "   ",
});
assert(selectedExecutionChoiceActions(emptyCustomBag).length === 1, "CASE C：空白 custom 不建立空行動");
const fromOld = normalizeExecutionChoiceBag({ options: sleepOptions, selectedId: "e2" });
assert(fromOld.selectedIds[0] === "e2" && fromOld.selectedIds.length === 1, "CASE C：舊 selectedId 可 hydrate 成 selectedIds");

/* CASE D／E：選完直接成為明天最小的一步，不再重填 */
const selectedBag = normalizeExecutionChoiceBag({
  options: sleepOptions,
  selectedId: "e1",
});
assert(selectedExecutionChoiceText(selectedBag) === sleepOptions[0].text, "CASE D：選中全文成為最小一步");
assert(app.includes('markableP(chosen, field, "exec-step-list__text", date)'), "CASE D：選中後顯示明天的行動 list");
assert(app.includes("明天，我先做到這些"), "CASE D：preview 標題改成明天我先做到這些");
assert(app.includes("alignExecChoiceCheckItems"), "CASE D：收下後依選中行動各自成卡");
assert(app.includes("addExecutionCheckItemsToSidebar"), "CASE D：收下後寫入獨立 task");
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
assert(app.includes("function historyReadingActionsHtml"), "CASE K：歷史行動走 presentation list");
assert(fs.readFileSync(path.join(__dirname, "../lib/history-reading.js"), "utf8").includes("selectedExecutionChoiceActions"), "CASE K：優先已選 executionChoices");
assert(!app.includes('"⑥ 執行力"'), "CASE K：歷史不再整章傾印執行力");
assert(app.includes("exec-step-list"), "CASE K：行動仍用編號 list");

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

/* CASE V：06 不承擔顯化；07 已退出正式流程 */
assert(app.includes("section-manifest"), "CASE V：舊 07 DOM／runtime 相容仍在");
assert(app.includes("priorThinkAwareContext(journal)"), "CASE V：舊 07 runtime 仍可讀前面資料");
assert(!html.includes("guide-07"), "CASE V：使用說明不再有 07");
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

const oneGrown = normalizeExecutionChoiceOptions([
  {
    id: "e1",
    text: "記下真正不舒服的瞬間",
    detail: "下次環境再讓你明顯不舒服時，寫下剛剛發生什麼、哪一個瞬間最受不了。",
    kind: "observe",
    horizon: "next",
  },
]);
assert(oneGrown.length === 1, "品質優先：1 個完整行動也成立");
assert(oneGrown[0].detail.includes("哪一個瞬間"), "detail 會被保留");
assert(oneGrown[0].kind === "observe" && oneGrown[0].horizon === "next", "kind／horizon 是可選擴充，不是新 schema");
const selectedGrown = selectedExecutionChoiceActions({ options: oneGrown, selectedIds: ["e1"] });
assert(selectedGrown[0].detail.includes("下次環境"), "已選行動帶著同一份 detail");
const legacyOnly = normalizeExecutionChoiceOptions([{ id: "e1", text: "今晚 9:30 洗完澡後就直接準備上床" }]);
assert(legacyOnly.length === 1 && !legacyOnly[0].detail, "舊的只有 text 的 option 仍可讀");
assert(EXECUTION_CHOICES_SYSTEM.includes("禁止因為一次情緒事件就叫使用者分手"), "重大決定不可直接下指令");
assert(EXECUTION_CHOICES_SYSTEM.includes("自我照顧"), "自我照顧仍可用，但有條件");
assert(app.includes("passthroughExecChoiceCheckItems"), "收下行動卡時沿用已選 title／detail，不另造一套");
assert(app.includes("optionsList.length < 1"), "API／client 接受 1～3 個");
const mergeJs = fs.readFileSync(path.join(root, "lib/review-merge.js"), "utf8");
assert(mergeJs.includes("記下真正不舒服的瞬間"), "界線 fallback 不是感恩／靜坐");
assert(mergeJs.includes("先推進卡住的那一件"), "工作 fallback 直接推進卡住的事");
assert(app.includes("careOk") || app.includes("insightExecutionFallbackOptions"), "疲累才走自我照顧 fallback");
assert(app.includes("insightExecutionFallbackOptions"), "fallback 與 History／Execution 共用同一組 insight actions");
assert(reviewJs.includes("需求與模式") && reviewJs.includes("判斷點"), "深度思考追問改為服務下一步");
assert(reviewJs.includes("不要為了輪數再問一次感受"), "挖到核心後不要重複問");

const unseenBlob =
  "我今天覺得很努力，但重要的人沒有看見。感到失落、委屈。我平常習慣告訴自己「我自己知道就好」，但其實仍然希望被看見。";
const unseenActions = insightExecutionFallbackOptions(unseenBlob);
assert(unseenActions.length >= 1 && unseenActions.length <= 2, `被看見案例不要硬湊 3 個，實際 ${unseenActions.length}`);
unseenActions.forEach((item, index) => {
  assert(item.text && item.detail, `被看見案例 action ${index + 1} 必須有 title + detail`);
  const blob = `${item.text}${item.detail}`;
  assert(!/感恩|靜坐|早睡|相信自己/.test(blob), `被看見案例不可變成感恩／靜坐／早睡／相信自己：${item.text}`);
});
assert(
  unseenActions.some((item) => /看見|說|表達/.test(`${item.text}${item.detail}`)) &&
    unseenActions.some((item) => /觀察|自己知道就好|需求/.test(`${item.text}${item.detail}`)),
  "被看見案例應同時碰到表達／被看見，以及觀察／需求確認"
);
const unseenBag = { options: unseenActions, selectedIds: unseenActions.map((item) => item.id) };
const unseenSelected = selectedExecutionChoiceActions(unseenBag);
assert(unseenSelected.length === unseenActions.length, "Execution 讀同一組已選 action");
assert(
  unseenSelected.every((item, index) => item.text === unseenActions[index].text && item.detail === unseenActions[index].detail),
  "Execution 的 title／detail 與生成結果一致"
);
const unseenPrompt = choicesUserPrompt({
  mode: "choices",
  kind: "execution",
  context: {
    awarenessLine: "我表面上告訴自己「我自己知道就好」，但其實仍然希望被看見。",
    awarenessSeen: "我發現自己平常習慣把被看見的需要藏起來。",
    thinkSelected: ["我很努力，但重要的人沒有看見"],
    thinkCloseAwareness: "真正卡住的不是不夠努力，而是我渴望被看見，卻習慣告訴自己不用被看見。",
    event: "今天覺得很努力，但重要的人沒有看見，感到失落、委屈。",
    mood: "委屈",
  },
});
assert(unseenPrompt.includes("希望被看見") || unseenPrompt.includes("自己知道就好"), "06 會讀到被看見核心");
assert(EXECUTION_CHOICES_SYSTEM.includes("渴望被看見"), "system 把被看見當核心，而不是自我打氣");
assert(EXECUTION_CHOICES_SYSTEM.includes("相信自己"), "system 禁止只叫使用者相信自己");

assert(html.includes("把覺察變成下一步，不求做很多，只留下明天真正做得到的行動。"), "使用說明 06 是行動，不是問答");
assert(!html.includes("AI 會依今天的內容問你 1 題"), "使用說明不再寫舊問答");

console.log("execution choices tests passed");
