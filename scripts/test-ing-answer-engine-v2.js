"use strict";

/** Answer-engine v2 content seeds removed — keep scaffold smoke only. */

const answerEngine = require("../lib/ing-answer-engine");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(answerEngine.ANSWER_ENGINE_VERSION === "ing-answer-engine-scaffold", "scaffold version");
assert(answerEngine.integratedReflectionSeed({
  thanksText: "感謝朋友陪我",
  event: "有人沒回訊",
  bodyMindText: "胸口悶",
}) == null, "integrated seed cleared");
assert(answerEngine.gratitudeCareVsRejectionSeed({
  thanksText: "感謝好好說話",
  event: "媽媽說滾出去",
  bodyMindText: "不舒服",
}) == null, "care/reject seed cleared");
assert(answerEngine.looksSeeFormat("【核心結論】x\n【金句】y") === false, "format checker stubbed");
assert(answerEngine.composeActLeadIn([{ text: "覺察" }], { event: "事件" }) === "", "act lead-in cleared");

console.log("ing answer-engine v2 scaffold smoke passed");
