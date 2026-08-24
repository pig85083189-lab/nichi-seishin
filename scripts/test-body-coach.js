const {
  detectBodyCoachContrasts,
  buildLocalBodyCoach,
  sectionsOverlapTooMuch,
  looksLikeRestatement,
  keepCompleteField,
} = require("../lib/body-coach-insight");
const { BODY_COACH_SYSTEM, bodyCoachUserPrompt, normalizeBodyCoachResult } = require("../api/review");
const { isCompleteSentence } = require("../lib/text-integrity");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(BODY_COACH_SYSTEM.includes("STEP 2 找反差"), "prompt 必須包含反差步驟");
assert(BODY_COACH_SYSTEM.includes("STEP 3 找關聯"), "prompt 必須包含關聯步驟");
assert(BODY_COACH_SYSTEM.includes("STEP 4 找值得觀察的模式"), "prompt 必須包含模式步驟");
assert(BODY_COACH_SYSTEM.includes("不是資料摘要") || BODY_COACH_SYSTEM.includes("不是把今天填過的資料再整理"), "prompt 必須反對純整理報告");
assert(!BODY_COACH_SYSTEM.includes("身體的疲累，可能還沒有完全被你感覺到"), "舊的睡眠不足說教不應再當範例");

const caseACtx = {
  mood: "很好",
  bodyCheck: {
    sleep: { duration: "5–6小時", quality: "普通", energy: "不錯" },
  },
};
const caseA = buildLocalBodyCoach(caseACtx);
assert(detectBodyCoachContrasts(caseACtx).includes("sleep-energy"), "CASE A：要抓到睡眠短 × 精神不差");
assert(/睡得少|睡眠時間|精神/.test(caseA.title + caseA.notice), "CASE A：洞察要提到睡眠與精神");
assert(!/請早點睡|睡眠不足/.test(`${caseA.title}${caseA.analysis}${caseA.notice}`), "CASE A：不能只叫人早點睡");
assert(/品質|醒來|休息到/.test(`${caseA.title}${caseA.notice}${caseA.suggestions.join("")}`), "CASE A：要帶到品質或醒來感受");

const caseBCtx = {
  mood: "很好",
  thanks: "謝謝寶貝有幫忙，也謝謝跟媽媽的互動",
  event: "寶貝有幫忙，跟媽媽互動，想做的事情逐漸實現，心情很好",
  bodyCheck: { mood: { flags: ["愉快"] }, sleep: { duration: "7小時", energy: "普通" } },
};
const caseB = buildLocalBodyCoach(caseBCtx);
assert(detectBodyCoachContrasts(caseBCtx).includes("connection-progress"), "CASE B：要抓到連結感＋進展感");
assert(/踏實|連結|進展|身邊|正在發生/.test(`${caseB.title}${caseB.analysis}${caseB.notice}`), "CASE B：要提煉連結／進展，不能只重述四件事");
assert(!/^今天很開心/.test(caseB.title), "CASE B：核心結論不能只是重述心情");

const caseCCtx = {
  mood: "很好",
  event: "今天完成很多事情，很有成就感",
  bodyCheck: {
    mood: { flags: ["愉快"] },
    body: { flags: ["身體疲勞"] },
    sleep: { duration: "7小時", energy: "普通" },
  },
};
const caseC = buildLocalBodyCoach(caseCCtx);
assert(detectBodyCoachContrasts(caseCCtx).includes("done-tired"), "CASE C：要抓到心理滿足 × 身體疲累");
assert(/滿足|疲累|完成/.test(`${caseC.title}${caseC.analysis}${caseC.notice}`), "CASE C：要同時看到完成與疲累");

const caseDCtx = {
  mood: "普通",
  bodyCheck: {
    mood: { flags: [] },
    body: { flags: [] },
    sleep: { duration: "7小時", quality: "普通", energy: "普通" },
  },
};
const caseD = buildLocalBodyCoach(caseDCtx);
assert(detectBodyCoachContrasts(caseDCtx).includes("sparse") || detectBodyCoachContrasts(caseDCtx).length === 0, "CASE D：資料很少");
assert(/平穩|沒有特別明顯的反差/.test(caseD.title), "CASE D：不要硬湊心理洞察");
assert(!/你就是|代表你一定|證明你/.test(`${caseD.title}${caseD.analysis}${caseD.notice}`), "CASE D：禁止診斷句");

[caseA, caseB, caseC, caseD].forEach((item, index) => {
  assert(!sectionsOverlapTooMuch(item), `CASE E：第 ${index + 1} 組四個區塊不得大量重複`);
  assert(isCompleteSentence(item.title), `CASE E：title 必須完整 ${item.title}`);
  assert(isCompleteSentence(item.analysis), "CASE E：analysis 必須完整");
  assert(isCompleteSentence(item.notice), "CASE E：notice 必須完整");
});

const restated = normalizeBodyCoachResult(
  {
    title: "今天的開心來自寶貝、媽媽與生活中的小確幸，雖然睡眠時間較短，但精神狀態仍不錯。",
    analysis: "你今天心情很好，睡了 5–6 小時，完成很多事情。",
    notice: "你睡眠不足，請早點睡。",
    suggestions: ["多喝水", "早點睡"],
  },
  caseACtx
);
assert(!looksLikeRestatement(restated.title), "重述標題應被換成洞察");
assert(/睡得少|精神|休息/.test(restated.title), "重述結果要留下反差洞察");

const longComplete = "睡得少不一定等於精神差，今天真正值得觀察的，是什麼讓你的身體有休息到的感覺，以及醒來之後有沒有真正緩過來。";
const kept = keepCompleteField(longComplete, 30);
assert(kept === "" || isCompleteSentence(kept), "過長內容只能留下完整句，不可硬砍半句");
assert(!/感覺$/.test(kept.replace(/\s+/g, "")) || isCompleteSentence(kept), "不可 slice 成半句");

const prompt = bodyCoachUserPrompt({
  context: caseACtx,
  text: "身體覺察",
});
assert(prompt.includes("找反差"), "user prompt 必須要求先找反差");
assert(prompt.includes("sleep-energy") || prompt.includes("反差"), "user prompt 可帶入已看到的線索");

console.log("body coach insight tests passed");
