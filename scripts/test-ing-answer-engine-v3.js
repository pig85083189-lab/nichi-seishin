"use strict";

/** Answer-engine v3 tone/format asserts removed — keep scaffold smoke only. */

const answerEngine = require("../lib/ing-answer-engine");
const insightAct = require("../lib/insight-act");
const bodyMindSee = require("../lib/body-mind-see");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(answerEngine.ANSWER_ENGINE_VERSION === "ing-answer-engine-scaffold", "v3 version → scaffold");
assert(answerEngine.ANSWER_ENGINE_VOICE === "", "voice empty");
assert(bodyMindSee.SEE_REASON_SYSTEM.includes("Return JSON"), "03 tech prompt");
assert(insightUnderstand.UNDERSTAND_REASON_SYSTEM.includes("Return JSON"), "04 tech prompt");
assert(insightGrow.GROW_REASON_SYSTEM.includes("Return JSON"), "05 tech prompt");
assert(insightAct.ACT_SYSTEM.includes("Return JSON"), "06 tech prompt");
assert(!answerEngine.looksPrematureStop("已經想清楚了"), "premature-stop gate cleared");
assert(!answerEngine.looksFalseConfirm("妳已經看見了"), "false-confirm gate cleared");

console.log("ing answer-engine v3 scaffold smoke passed");
