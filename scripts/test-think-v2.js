const fs = require("fs");
const path = require("path");
const review = require("../api/review");
const thinkV2 = require("../lib/think-v2");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes('id="btnThinkChoices"'), "CURRENT 04 開始按鈕仍在");
assert(html.includes('id="btnThinkClose"'), "CURRENT 04 close 按鈕仍在");
assert(html.includes('id="section-deep"'), "04 DOM 未拆");
assert(app.includes("function generateThinkChoices"), "CURRENT generateThinkChoices 仍在");
assert(app.includes("function generateThinkChoicesClose"), "CURRENT generateThinkChoicesClose 仍在");
assert(app.includes("function generateAwarenessChoices"), "05 未因 V2 改掉");
assert(app.includes("function generateExecutionChoices"), "06 未因 V2 改掉");
assert(app.includes("if (!pointerOk && !keyboardOk) return true;") === false, "iOS accordion fix 仍在");
assert(app.includes("function generateThinkV2Ask"), "主 app 已接 V2 04");
assert(app.includes("function generateThinkChoices"), "CURRENT generateThinkChoices 仍在");
assert(reviewJs.includes('body?.variant === "think-guide"'), "legacy think-guide 判斷仍在");
assert(reviewJs.includes("thinkV2.isThinkV2Request"), "review 有獨立 V2 路由");
assert(reviewJs.includes("CHOICES_THINK_SYSTEM"), "CURRENT 04 prompt 仍在");
assert(!reviewJs.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "V2 不改 schema");
assert(html.includes("app.js?v=279") && html.includes("app.css?v=233"), "cache 已 bump");

assert(thinkV2.MIN_ROUNDS === 1 && thinkV2.MAX_ROUNDS === 3, "V2 最少 1 最多 3");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("【優先順序"), "ask 有優先順序");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("userUnknown"), "第 3 題看資訊增量種類");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("沒有更深的東西"), "允許沒有更深");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("不要預設「A 還是 B」"), "第一題不預設二分");
assert(!thinkV2.THINK_V2_ASK_SYSTEM.includes("unknownWouldChangeCore"), "不再只靠模型自評");
assert(!thinkV2.THINK_V2_ASK_SYSTEM.includes("第 1 輪｜感受"), "不再寫死感受→需求→模式");
assert(thinkV2.THINK_V2_ASK_SYSTEM.length < 2800, "ask prompt 有收短");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("CLOSE DEPTH"), "close 有證據天花板");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("問題解決模式"), "close 禁止模式標籤");
assert(!thinkV2.THINK_V2_CLOSE_SYSTEM.includes("今天發生了什麼 2) 勾選"), "V2 close 不是 CURRENT 模板");

assert(review.THINK_V2_ASK_SYSTEM === thinkV2.THINK_V2_ASK_SYSTEM, "review 匯出 V2 ask");
assert(review.CHOICES_THINK_SYSTEM.includes("這件事背後，對我真正代表什麼"), "CURRENT prompt 原文未改");

const deniedRounds = [{ question: "是不是覺得沒面子？", answer: "不是，我完全沒有這種感覺。" }];
assert(thinkV2.deniedAssumptions(deniedRounds).length >= 1, "明確否定後必須放掉假設");
assert(thinkV2.questionRevivesRejected("那你當時有什麼反應嗎？", [{ question: "那個被糾正的時刻，你當時的反應是什麼？", answer: "不是，我完全沒有這種感覺。" }]), "換句話追同一假設要被抓到");

const body = {
  variant: "think-v2",
  step: "ask",
  text: "他沒有肯定我",
  context: {
    variant: "think-v2",
    thanksText: "還有工作可以做",
    event: "他沒有肯定我，所以他根本不重視我。",
    mood: "失落",
    rounds: [{ question: "你會不會其實擔心自己不夠好？", answer: "不會，我知道自己做得很好。" }],
  },
};
const prompt = thinkV2.thinkV2UserPrompt(body);
assert(prompt.includes("我知道自己做得很好"), "V2 user prompt 看得到上一答");
assert(prompt.includes("今日感謝"), "V2 每輪都帶感謝");
assert(prompt.includes("已死亡的假設"), "V2 會提示放掉被否定的假設");
assert(thinkV2.userIntroducedSignals([{ question: "q", answer: "比較像先忍下來。我不知道自己能忍到什麼程度。" }]).some((item) => item.includes("能忍到")), "會抽出使用者新詞");

assert(thinkV2.shouldCloseThinkV2({ answeredCount: 0, readyToClose: true, question: "" }) === false, "還沒作答不能 close");
assert(thinkV2.shouldCloseThinkV2({ answeredCount: 1, readyToClose: true, question: "" }) === true, "已清楚／疲憊等可在 1 題後 close");
assert(thinkV2.shouldCloseThinkV2({ answeredCount: 2, readyToClose: true, question: "", callIndex: 3 }) === true, "2 輪且 ready 可 close");
assert(
  thinkV2.shouldCloseThinkV2({
    answeredCount: 2,
    readyToClose: false,
    question: "什麼情況一出現，你會確定已經超過能接受的範圍？",
    informationGain: 2,
    callIndex: 3,
  }) === false,
  "資訊增量 2 才准第 3 題"
);
assert(
  thinkV2.shouldCloseThinkV2({
    answeredCount: 2,
    readyToClose: false,
    question: "那對你意味著什麼？",
    informationGain: 1,
    callIndex: 3,
  }) === true,
  "資訊增量 1 強制 close"
);
assert(thinkV2.shouldCloseThinkV2({ answeredCount: 3, readyToClose: false, question: "還問？" }) === true, "第 3 輪後一定 close");

const a3 = thinkV2.scoreInformationGain({
  question: "看見的是努力本身，還是努力背後你想表達的什麼？",
  callIndex: 3,
  rounds: [
    { question: "失落從哪裡來？", answer: "我知道自己很努力，這點我不懷疑。失落是因為另一半好像完全沒看見。" },
    { question: "你最希望他看見的是什麼？", answer: "對，我不是懷疑自己。我只是希望他看見。" },
  ],
});
assert(a3.score === 0, "把被看見再抽象一層是 0");

const b3 = thinkV2.scoreInformationGain({
  question: "什麼情況一出現，你會很確定這已經超過自己能接受的範圍？",
  callIndex: 3,
  rounds: [
    { question: "你現在接受的到底是什麼？", answer: "我不是真的接受。每次看到還是很火，只是覺得改不了。" },
    { question: "很火的時候你最先想到什麼？", answer: "比較像先忍下來。我不知道自己能忍到什麼程度。" },
  ],
});
assert(b3.score === 2, "承接『能忍到什麼程度』是 2");

const usual = thinkV2.scoreInformationGain({
  question: "你通常忍不住的時候會發生什麼？",
  callIndex: 3,
  rounds: [{ question: "q", answer: "我不知道自己能忍到什麼程度。" }],
});
assert(usual.score === 0, "你通常是 0");

const action = thinkV2.scoreInformationGain({
  question: "那你現在想跟他說，還是覺得說了也沒用？",
  callIndex: 3,
  rounds: [{ question: "q", answer: "我沒有明確跟他說過我需要他回應。" }],
});
assert(action.score === 0, "要不要說是 0");

const d3 = thinkV2.scoreInformationGain({
  question: "標準什麼時候會清楚？",
  callIndex: 3,
  ctx: { event: "這個專案我拖了一個禮拜，我就是沒有執行力。" },
  rounds: [
    { question: "這一週有沒有碰過？", answer: "不是完全不想做。是規格一直改，我怕做了又重來。" },
    { question: "最卡住的是哪一次改規格？", answer: "對，比較像標準不清楚，不是我沒執行力。" },
  ],
});
assert(d3.score <= 1, "標準已解釋拖延時第 3 題最多 1");

const asked = thinkV2.normalizeThinkV2Ask({ question: "規格改的時候，你最先停下來的是哪一步", readyToClose: false, hint: "先回到那個畫面" }, { round: 2, context: { rounds: [] } });
assert(asked.question.includes("？"), "V2 問題會收成疑問句");
assert(asked.readyToClose === false, "一般第 2 輪仍可繼續問");

const tired = thinkV2.normalizeThinkV2Ask(
  { question: "你通常能不能接納休息？", readyToClose: false },
  {
    round: 2,
    context: {
      event: "今天真的好累，什麼都不想想。",
      mood: "疲憊",
      rounds: [{ question: "現在是需要休息嗎？", answer: "就是身體累，不想分析。" }],
    },
  }
);
assert(tired.readyToClose === true && !tired.question, "疲憊且說不想分析時應直接 close");

const forcedThird = thinkV2.normalizeThinkV2Ask(
  { question: "那被放在心上對你意味著什麼？", readyToClose: false, gainKind: "fork" },
  {
    round: 3,
    context: {
      rounds: [
        { question: "q1", answer: "我不懷疑自己。失落是因為他沒看見。" },
        { question: "q2", answer: "我只是希望他看見。" },
      ],
    },
  }
);
assert(forcedThird.readyToClose === true && !forcedThird.question, "第 3 題沒有資訊增量就丟掉");

const revived = thinkV2.normalizeThinkV2Ask(
  { question: "那當時被糾正的時候，你注意到自己有什麼反應嗎？", readyToClose: false },
  {
    round: 2,
    context: {
      event: "今天被主管當眾糾正了一個數字，回家後其實還好。",
      rounds: [{ question: "那個被糾正的時刻，你當時的反應是什麼？", answer: "不是，我完全沒有這種感覺。" }],
    },
  }
);
assert(revived.readyToClose === true, "否定後換句話追同一假設要丟掉");

const closed = thinkV2.normalizeThinkV2Close({ title: "被看見與失落", stuck: "失落和自己知道就好同時存在。", seen: "他說他不懷疑自己，只是希望被看見。", unknown: "" });
assert(closed.stuck && closed.seen, "V2 close 仍有卡點與看見");
assert(closed.coreConclusion === closed.stuck, "stuck 相容對到 coreConclusion");
assert(closed.close.coreConclusion === closed.coreConclusion, "close 物件有寫入");
assert(closed.unknown === "", "unknown 可以是空的");
assert(closed.actions.length === 0, "V2 close 沒有行動");

const jClose = thinkV2.normalizeThinkV2Close(
  { title: "想辭職", stuck: "被當成理所當然。", seen: "今天被臨時加工作。", unknown: "" },
  {
    context: {
      rounds: [
        { question: "發生什麼？", answer: "今天被臨時加了一堆不合理的工作，當下真的很想走。" },
        { question: "不能接受什麼？", answer: "不是第一次這樣想。真正不能接受的是事情永遠被當成理所當然。" },
        { question: "還缺什麼？", answer: "我還沒想清楚是今天太累想逃，還是真的要走。外面有沒有選擇我也不知道。" },
      ],
    },
  }
);
assert(/還沒想清楚|有沒有選擇/.test(`${jClose.unknown}${jClose.coreConclusion}`), "J 的使用者未知必須留下");

const hClose = thinkV2.normalizeThinkV2Close({
  title: "被糾正",
  stuck: "被當眾糾正卻沒有情緒反應，反而立刻進入問題解決模式。",
  seen: "你面對糾正時會快速進入問題解決模式。",
  unknown: "",
});
assert(!/問題解決模式/.test(hClose.stuck + hClose.seen), "close 不能寫問題解決模式");

assert(
  thinkV2.shouldSkipThinkV2Ask({
    variant: "think-v2",
    step: "ask",
    round: 2,
    context: {
      event: "今天真的好累，什麼都不想想。",
      mood: "疲憊",
      rounds: [{ question: "現在是需要休息嗎？", answer: "就是身體累，不想分析。" }],
    },
  }) === true,
  "已知只是累時不要再打一次 ask"
);
assert(
  thinkV2.shouldSkipThinkV2Ask({
    variant: "think-v2",
    step: "ask",
    round: 1,
    context: { event: "今天真的好累，什麼都不想想。", mood: "疲憊", rounds: [] },
  }) === false,
  "第 1 題仍要問"
);
assert(
  thinkV2.shouldSkipThinkV2Ask({
    variant: "think-v2",
    step: "ask",
    round: 3,
    context: {
      event: "今天做了很多工作，但另一半好像完全沒有注意到。",
      mood: "失落",
      rounds: [
        { question: "失落從哪裡來？", answer: "我不懷疑自己。失落是因為他沒看見。" },
        { question: "你希望他看見什麼？", answer: "我只是希望他看見。" },
      ],
    },
  }) === true,
  "沒有增益前提時不要為第 3 題再打一次 API"
);
assert(
  thinkV2.shouldSkipThinkV2Ask({
    variant: "think-v2",
    step: "ask",
    round: 3,
    context: {
      event: "這個環境真的讓我很不舒服，我知道只能接受。",
      mood: "生氣",
      rounds: [
        { question: "生氣的點是什麼？", answer: "我不是真的接受。只是覺得改不了。" },
        { question: "改不了的是什麼？", answer: "比較像先忍下來。我不知道自己能忍到什麼程度。" },
      ],
    },
  }) === false,
  "使用者自己留下未知時，第 3 題仍要問"
);

assert(
  thinkV2.looksKnownAnswerRestate("你想怎麼跟媽媽好好溝通？", { event: "我想跟媽媽好好溝通。" }, []) === true,
  "12. 已說要溝通不能再問怎麼溝通"
);
assert(
  thinkV2.scoreInformationGain({
    question: "你想怎麼跟媽媽好好溝通？",
    ctx: { event: "我想跟媽媽好好溝通。" },
    rounds: [],
    callIndex: 1,
  }).score === 0,
  "13. 重述已知沒有 information gain"
);
const closeDir = thinkV2.normalizeThinkV2Close({
  title: "理解落差",
  stuck: "問題不一定是說得不夠多，而是彼此理解可能從沒對齊。",
  seen: "你已經講過一次，真正卡住的是對不上。",
  unknown: "",
  direction: "下一次先確認彼此目前理解到哪裡，再決定要不要補解釋。",
});
assert(closeDir.direction.includes("理解"), "14. close 有改善方向");
assert(closeDir.improvementDirection === closeDir.direction, "direction 相容對到 improvementDirection");
assert(closeDir.actions.length === 0, "15. 04 不產出 06 checklist");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("improvementDirection"), "14. close prompt 有 improvementDirection");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("核心結論"), "close 有核心結論");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("我沒看見的問題"), "close 有盲點");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("怎麼做可以更好"), "close 有改善方向");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("重新包裝成問題"), "12. ask 禁止重述已知");
assert(thinkV2.MAX_ROUNDS === 3, "18. max rounds 不變");

assert(thinkV2.isThinkV2Request({ variant: "think-v2" }), "variant think-v2");
assert(!thinkV2.isThinkV2Request({ variant: "think-guide" }), "不會誤判 think-guide");

const choicePrompt = review.choicesUserPrompt({
  kind: "think",
  date: "2026-08-30",
  text: "今天做了很多工作",
  context: { thanksText: "還有力氣", event: "今天做了很多工作", mood: "平靜" },
  progress: { streak: 0 },
});
assert(choicePrompt.includes("請只生成 3 到 4 個"), "CURRENT choices user prompt 未改");

console.log("think v2 isolation tests passed");
