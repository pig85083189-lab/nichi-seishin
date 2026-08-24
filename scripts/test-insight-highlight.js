const {
  escapeHtml,
  fieldHighlights,
  normalizeHighlights,
  renderHighlightedText,
  plainTextFromHighlightedHtml,
} = require("../lib/insight-highlight");
const {
  normalizeAwarenessResult,
  normalizeBodyCoachResult,
  BODY_COACH_SYSTEM,
} = require("../api/review");
const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const sourceA = "精神狀態好不好，重點不完全在睡多久，而是睡得好不好。";
const htmlA = renderHighlightedText(sourceA, [{ text: "睡得好不好", level: "normal" }]);
assert(htmlA.includes('class="insight-highlight"'), "CASE A：一般反白必須包 span");
assert(!htmlA.includes("insight-highlight--strong"), "CASE A：一般反白不可帶 strong");
assert(plainTextFromHighlightedHtml(htmlA) === sourceA, "CASE A：正文必須與原文完全一致");

const sourceB = "精神狀態好不好，重點不完全在睡多久，而是睡得好不好。";
const htmlB = renderHighlightedText(sourceB, [{ text: "睡得好不好", level: "strong" }]);
assert(htmlB.includes("insight-highlight--strong"), "CASE B：核心反白必須帶 strong class");
assert(plainTextFromHighlightedHtml(htmlB) === sourceB, "CASE B：正文必須與原文完全一致");

const sourceC = "內心想法逐漸實現，想做的事正在發生，這讓今天變得比較踏實。";
const htmlC = renderHighlightedText(sourceC, [
  { text: "內心想法逐漸實現", level: "normal" },
  { text: "想做的事正在發生", level: "strong" },
]);
assert(htmlC.includes("insight-highlight--strong"), "CASE C：兩個 highlight 時 strong 仍在");
assert((htmlC.match(/insight-highlight/g) || []).length >= 2, "CASE C：兩個 highlight 都要包到");
assert(plainTextFromHighlightedHtml(htmlC) === sourceC, "CASE C：正文必須與原文完全一致");

const wrapSource = "今晚先把手機放到另一個房間，讓自己真正睡得好不好，而不是只看睡了多久。";
const htmlD = renderHighlightedText(wrapSource, [{ text: "真正睡得好不好", level: "normal" }]);
assert(htmlD.includes("insight-highlight"), "CASE D：跨行仍只包原短句");
assert(plainTextFromHighlightedHtml(htmlD) === wrapSource, "CASE D：跨行時正文仍完整");

const sourceE = "今天沒有特別值得強調的地方，狀態大致平穩。";
const htmlE = renderHighlightedText(sourceE, [{ text: "這句完全不存在", level: "strong" }]);
assert(htmlE === escapeHtml(sourceE), "CASE E：找不到原文時略過 highlight");
assert(plainTextFromHighlightedHtml(htmlE) === sourceE, "CASE E：找不到時正文仍完整");

const sourceF = "舊資料沒有 highlights，也要完整顯示全文。";
const htmlF = renderHighlightedText(sourceF, undefined);
assert(htmlF === escapeHtml(sourceF), "CASE F：沒有 highlights 時只 escape 原文");
assert(plainTextFromHighlightedHtml(htmlF) === sourceF, "CASE F：舊資料正文完整");

const sourceG = `他寫了 <script>alert(1)</script> 與 "引號" & 符號。`;
const htmlG = renderHighlightedText(sourceG, [{ text: "引號", level: "normal" }]);
assert(!htmlG.includes("<script>"), "CASE G：不可輸出未 escape 的 script");
assert(htmlG.includes("&lt;script&gt;"), "CASE G：HTML 特殊字元必須被 escape");
assert(plainTextFromHighlightedHtml(htmlG) === sourceG, "CASE G：特殊字元還原後必須等於原文");

const sourceH = "真正值得記住的是睡得好不好，不是睡多久。";
const htmlH = renderHighlightedText(sourceH, [
  { text: "睡得好不好", level: "strong" },
  { text: "是睡得好不好，不是", level: "normal" },
]);
assert((htmlH.match(/睡得好不好/g) || []).length === 1, "CASE H：重疊 highlight 不可重複文字");
assert(plainTextFromHighlightedHtml(htmlH) === sourceH, "CASE H：重疊時正文仍完整");
assert(normalizeHighlights(
  [
    { text: "睡得好不好", level: "strong" },
    { text: "是睡得好不好，不是", level: "normal" },
  ],
  sourceH
).length === 1, "CASE H：重疊時只保留一個");

const caseASource = "卻成為一個轉折點。";
const caseAHtml = renderHighlightedText(caseASource, [{ text: "轉折點", level: "strong" }]);
assert(caseAHtml.includes("insight-highlight--strong"), "CASE A：轉折點必須出現 strong 螢光筆");
assert(caseAHtml.includes(">轉折點<") || caseAHtml.includes(">轉折點</span>"), "CASE A：必須包到轉折點");
assert(plainTextFromHighlightedHtml(caseAHtml) === caseASource, "CASE A：正文必須與原文完全一致");

const caseBSource = "今天讓你感受到被看見。";
const caseBHtml = renderHighlightedText(caseBSource, [{ text: "被看見", level: "normal" }]);
assert(caseBHtml.includes('class="insight-highlight"'), "CASE B：被看見必須正常反白");
assert(plainTextFromHighlightedHtml(caseBHtml) === caseBSource, "CASE B：正文必須與原文完全一致");

const caseCSource = "今天讓你感受到被看見。";
const caseCHtml = renderHighlightedText(caseCSource, [{ text: "不存在的文字", level: "strong" }]);
assert(caseCHtml === escapeHtml(caseCSource), "CASE C：找不到原文時不反白");
assert(plainTextFromHighlightedHtml(caseCHtml) === caseCSource, "CASE C：原文必須完整");

const caseDSource = "舊資料沒有 highlights，也要完整顯示全文。";
const caseDHtml = renderHighlightedText(caseDSource, undefined);
assert(caseDHtml === escapeHtml(caseDSource), "CASE D：舊資料必須完整顯示原文");

const caseESource = "這段比較長的重點加深了你對身邊人的珍視，即使換行也應該自然帶著螢光筆。";
const caseEHtml = renderHighlightedText(caseESource, [{ text: "加深了你對身邊人的珍視", level: "normal" }]);
assert(caseEHtml.includes("insight-highlight"), "CASE E：跨行 highlight 仍要包 span");
assert(plainTextFromHighlightedHtml(caseEHtml) === caseESource, "CASE E：跨行時正文仍完整");

const caseFSource = `他寫了 <script>alert(1)</script> 與 "引號" & 符號。`;
const caseFHtml = renderHighlightedText(caseFSource, [{ text: "引號", level: "normal" }]);
assert(!caseFHtml.includes("<script>"), "CASE F：不可輸出未 escape 的 script");
assert(caseFHtml.includes("&lt;script&gt;"), "CASE F：HTML 特殊字元必須被 escape");
assert(plainTextFromHighlightedHtml(caseFHtml) === caseFSource, "CASE F：特殊字元還原後必須等於原文");

const caseGSource = "真正值得記住的是睡得好不好，不是睡多久。";
const caseGHtml = renderHighlightedText(caseGSource, [
  { text: "睡得好不好", level: "strong" },
  { text: "是睡得好不好，不是", level: "normal" },
]);
assert((caseGHtml.match(/睡得好不好/g) || []).length === 1, "CASE G：重疊 highlight 不可重複文字");
assert(plainTextFromHighlightedHtml(caseGHtml) === caseGSource, "CASE G：重疊時正文仍完整");
assert(
  normalizeHighlights(
    [
      { text: "睡得好不好", level: "strong" },
      { text: "是睡得好不好，不是", level: "normal" },
    ],
    caseGSource
  ).length === 1,
  "CASE G：重疊時只保留一個"
);

assert(normalizeHighlights([{ text: "一", level: "normal" }], "只有一個字不該反白。").length === 0, "少於 2 字不可反白");
assert(normalizeHighlights([{ text: "這一段太長了所以不應該被整句反白起來看", level: "normal" }], "這一段太長了所以不應該被整句反白起來看。").length === 0, "超過 18 字不可反白");
["被看見", "安全感", "有進展", "完成感", "界線感"].forEach((phrase) => {
  const source = `今天出現了${phrase}。`;
  const html = renderHighlightedText(source, [{ text: phrase, level: "normal" }]);
  assert(html.includes(`>${phrase}</span>`), `${phrase} 必須可被反白`);
  assert(plainTextFromHighlightedHtml(html) === source, `${phrase} 不可改寫原文`);
});

const bag = {
  title: [{ text: "睡得好不好", level: "strong" }],
  analysis: [{ text: "內心想法逐漸實現", level: "normal" }],
};
assert(fieldHighlights(bag, "title")[0].text === "睡得好不好", "欄位 highlights 必須依 field 取出");
assert(fieldHighlights(bag, "notice").length === 0, "沒有該欄位時回傳空陣列");
assert(fieldHighlights(undefined, "title").length === 0, "沒有 highlights bag 時回傳空陣列");

const awareness = normalizeAwarenessResult({
  seen: "今天你好像特別在意被放在心上。這比牛奶或關心本身更靠近你。你願意承認這一層，已經比只複述事件更深。最後你也看見完成感對你的拉扯。",
  gap: "你選了「是」之後，睡眠不足卻仍想把事情做完，可能才是今天真正沒被說出口的模式。這不是指責，只是把線索放在一起看。",
  question: "如果沒有人看見你的努力，你還會願意為自己做這些事情嗎？",
  line: "被放在心上，比事情本身更靠近你",
  highlights: {
    seen: [{ text: "被放在心上", level: "strong" }],
    gap: [{ text: "這段不存在", level: "normal" }],
  },
});
assert(awareness.seen.includes("完成感"), "API 不得為了 highlight 改寫 seen");
assert(awareness.highlights.seen[0].text === "被放在心上", "API 必須原樣保留 highlights");
assert(awareness.highlights.gap[0].text === "這段不存在", "找不到的 highlight 仍原樣保存，render 時才略過");

const coach = normalizeBodyCoachResult(
  {
    title: "精神狀態好不好，重點不完全在睡多久，而是睡得好不好。",
    analysis: "睡眠品質和起床精神出現落差，比單純睡多久更值得停下來看。這不是要你立刻改作息，只是把訊號放在一起。",
    notice: "今天情緒偏高，身體卻還沒跟上，這個落差值得留意。",
    suggestions: ["睡前把手機放到另一個房間。先讓眼睛休息十分鐘。", "明天其中一餐多一份青菜。"],
    highlights: {
      title: [{ text: "睡得好不好", level: "strong" }],
    },
  },
  { mood: { flags: ["平靜"] }, body: { flags: [] }, sleep: { duration: "7-8小時", quality: "普通", energy: "還可以" } }
);
assert(coach.title.includes("睡得好不好"), "身心小結正文不可被 highlight 改寫");
assert(coach.highlights.title[0].text === "睡得好不好", "身心小結必須帶出 highlights");

const reviewJs = fs.readFileSync(path.join(__dirname, "../api/review.js"), "utf8");
assert(reviewJs.includes("highlight.text 必須 100% 原樣存在"), "AI prompt 必須要求 highlight 原樣存在於原文");
assert(BODY_COACH_SYSTEM.includes("highlights"), "身心小結 prompt 必須包含 highlights");
assert(reviewJs.includes("CHECKLIST_AWARENESS_SYSTEM") && reviewJs.includes('"seen": [{ "text"'), "覺察力 prompt 必須包含 highlights");
assert(reviewJs.includes("THINK_GUIDE_CLOSE_SYSTEM") && reviewJs.includes('"awareness": [{ "text"'), "深度思考收束 prompt 必須包含 highlights");
assert(reviewJs.includes("每張卡與 focus 可帶 highlights"), "執行力 prompt 必須包含 highlights");

console.log("insight highlight tests passed");
