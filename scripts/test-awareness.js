const {
  looksIncompleteAwarenessText,
  finishAwarenessBlock,
  normalizeAwarenessLine,
  normalizeAwarenessResult,
  padAwarenessPrompts,
  awarenessPromptStep,
  labeledAwarenessTurns,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(looksIncompleteAwarenessText("這些都讓你開心。有趣的是，這些時刻的共同點不只是被看見，還包括『別人的主動』和『自己的完成』——一個"), "半句必須判定不完整");
assert(looksIncompleteAwarenessText("今天你好像特別在意被放在心上。") === false, "完整句不應被判定不完整");
assert(finishAwarenessBlock("今天你好像特別在意被放在心上。這不是事情本身。", 280).includes("事情本身"), "完整段落不可被切掉");
assert(
  finishAwarenessBlock(
    "這些都讓你開心。有趣的是，這些時刻的共同點不只是被看見，還包括『別人的主動』和『自己的完成』——一個尚未說完的",
    80
  ) === "" ||
    !looksIncompleteAwarenessText(
      finishAwarenessBlock(
        "這些都讓你開心。有趣的是，這些時刻的共同點不只是被看見，還包括『別人的主動』和『自己的完成』。這才是完整的收束。",
        280
      )
    ),
  "過長內容只能停在完整句"
);

const longSeen = "今天你好像特別在意被放在心上。這比牛奶或關心本身更靠近你。你願意承認這一層，已經比只複述事件更深。最後你也看見完成感對你的拉扯。";
const normalized = normalizeAwarenessResult({
  seen: longSeen,
  gap: "你選了「是」之後，睡眠不足卻仍想把事情做完，可能才是今天真正沒被說出口的模式。這不是指責，只是把線索放在一起看。",
  question: "如果沒有人看見你的努力，你還會願意為自己做這些事情嗎？",
  line: "被放在心上，比事情本身更靠近你",
});
assert(normalized.seen.includes("完成感"), "今日覺察不可因舊的 100 字上限被截斷");
assert(String(normalized.line).replace(/\s+/g, "").length >= 15, "帶走的一句話至少 15 字");
assert(zhOk(normalized.line), "帶走的一句話不可超過 30 個中文字");

const cut = normalizeAwarenessResult({
  seen: "這些都讓你開心。有趣的是，這些時刻的共同點不只是被看見，還包括『別人的主動』和『自己的完成』——一個",
  gap: "完整的第二段。也指出一個可能忽略的地方。",
  question: "今晚你想留下哪一面？",
  line: "今天你沒有把話說完所以不算",
});
assert(!cut.seen, "半句 seen 不可當成完整結果");

const one = padAwarenessPrompts([{ question: "當別人記得你愛喝的牛奶時，你會特別開心，是不是因為被放在心上比事情本身更重要？" }], { event: "開心果記得我愛喝的牛奶" });
assert(one.length === 1, "覺察題現在一次只保留 1 題");
assert(one[0].question.includes("被放在心上"), "不可再把題目切成 72 字");

assert(awarenessPromptStep({ answers: [] }) === 1, "沒有答案時是 Q1");
assert(awarenessPromptStep({ answers: ["是"] }) === 2, "答完 Q1 後是 Q2");
assert(awarenessPromptStep({ answers: ["是", "否"] }) === 3, "答完 Q2 後是 Q3");
assert(awarenessPromptStep({ step: 2, answers: [] }) === 2, "可明確指定 step");

const turns = labeledAwarenessTurns({
  questions: ["你是不是因為被放在心上才開心？"],
  answers: ["否"],
});
assert(turns.includes("回答：否"), "否必須進下一題 context");

function zhOk(text) {
  const n = String(text || "").replace(/\s+/g, "").length;
  return n <= 30;
}

assert(String(normalizeAwarenessLine("被放在心上，比事情本身更靠近你")).replace(/\s+/g, "").length >= 15, "line helper 應收下完整短句");
assert(!normalizeAwarenessLine("太短了"), "太短的 line 應被拒絕");

console.log("awareness tests passed");
