"use strict";

const answerEngine = require("../lib/ing-answer-engine");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cases = [
  {
    thanksText: "感謝同事臨時幫我補上資料。",
    event: "簡報雖然完成了，但客戶突然改需求，我很煩。",
    bodyMindText: "肩膀很緊，眼睛也有點痠。",
  },
  {
    thanksText: "今天感恩自己有出門散步。",
    event: "和朋友吃晚餐聊了很久，心情很放鬆。",
    bodyMindText: "呼吸比較深，腿有走路後的痠。",
  },
  {
    thanksText: "謝謝家人記得幫我留晚餐。",
    event: "今天考試沒考好，有點失望。",
    bodyMindText: "胃緊緊的，手心一直冒汗。",
  },
];

cases.forEach((raw, index) => {
  const seed = answerEngine.integratedReflectionSeed(raw);
  assert(seed, `case ${index + 1} creates an integrated seed`);
  assert(seed.evidence.length === 3, `case ${index + 1} preserves all three input streams`);
  const text = `${seed.statement} ${seed.whyItMatters}`;
  assert(/感謝|謝謝|感恩/.test(text), `case ${index + 1} acknowledges gratitude`);
  assert(/身體|感覺/.test(text), `case ${index + 1} acknowledges embodiment`);
  assert(/可能|也許|有沒有|不能/.test(text), `case ${index + 1} keeps interpretation tentative`);
  assert(!/媽媽|滾出去|搬出去/.test(text), `case ${index + 1} does not leak a fixed scenario`);
});

assert(!answerEngine.integratedReflectionSeed({ thanksText: "謝謝今天", event: "開會", bodyMindText: "" }), "missing body does not force integration");
assert(answerEngine.userAskedToStop("今天先到這裡，不想繼續分析了"), "explicit stop is detected");
assert(answerEngine.userAskedToStop({ understand: { answer: "我不想再聊，先這樣" } }), "nested answer stop is detected");
assert(!answerEngine.userAskedToStop("我還想繼續想想看"), "willingness to continue is not a stop");

const stopCtx = {
  growVariant: "grow-v1",
  thanksText: cases[0].thanksText,
  event: cases[0].event,
  bodyMindText: cases[0].bodyMindText,
  understand: { stage: "converged", answer: "我不想繼續分析，今天先到這裡。" },
  awarenessItems: [{ id: "a1", text: "AI 還沒被我確認的推測" }],
  awarenessSelectedIds: [],
};

assert(!insightGrow.shouldRunGrow(stopCtx), "explicit stop prevents entering 05");

(async () => {
  let calls = 0;
  const grow = await insightGrow.runGrowPipeline({
    ctx: stopCtx,
    callAi: async () => {
      calls += 1;
      return {};
    },
  });
  assert(calls === 0, "explicit stop does not call 05 model");
  assert(grow.meta.skipReason === "user-requested-stop", "05 records respectful stop reason");

  const act = await insightAct.runActPipeline({
    ctx: stopCtx,
    callAi: async () => {
      throw new Error("06 must not run");
    },
  });
  assert(act.blocked && act.meta.calls === 0, "06 remains blocked without USER_CONFIRMED");

  const focus = answerEngine.integratedUnderstandFocus(cases[2]);
  assert(focus && /感謝、今天發生的事，和身體/.test(focus.statement), "04 can carry generic integrated context forward");
  assert(!insightUnderstand.looksNoUnknownLeft(cases[2]), "integrated unresolved input is not prematurely closed");

  console.log("ING answer-engine v2 generalization and safety regression passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
