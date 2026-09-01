"use strict";

const valueLenses = require("../lib/insight-value-lenses");
const bodyMindSee = require("../lib/body-mind-see");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const MOTHER = {
  thanksText: "",
  event: "今天跟我媽吵了一架，因為她覺得我常常跟我男友吵架，所以她覺得影響到她的心情了，讓我感覺她好像有拋棄我的感覺。",
  mood: "難過",
  bodyMindText: "胸口很悶。",
};

const ladder = valueLenses.buildFallbackCandidates(MOTHER);
assert(ladder.some((row) => row.id === "lens-mother-conflict"), "mother-conflict lens exists");

const judged = bodyMindSee.evaluateSeeCandidate(ladder.find((row) => row.id === "lens-mother-conflict"), MOTHER);
assert(judged.keep, `mother lens keeps: ${judged.failed.join(",")}`);

const level3 = bodyMindSee.evaluateSeeCandidate(
  {
    id: "bad3",
    type: "UNNOTICED_NEED",
    statement: "被看見的需要落空，才是胸口悶的真實來源。",
    evidence: ["拋棄我的感覺", "胸口很悶"],
    newInformation: "真實來源",
    whyItMatters: "真正原因是需要沒被聽到。",
    confidence: "high",
  },
  MOTHER
);
assert(level3.drop, "level3 mother claim drops");

const ORDINARY = {
  thanksText: "天氣還可以。",
  event: "昨天睡比較晚，今天有點累。中午跟朋友吃飯滿開心的。晚上回家只想休息。",
  mood: "平",
  bodyMindText: "還好。",
};
const ordinaryLadder = valueLenses.buildFallbackCandidates(ORDINARY);
assert(ordinaryLadder.length >= 1, "ordinary day gets fallback lens");

assert(valueLenses.isExtremelySparseInput({ thanksText: "累", event: "", mood: "疲", bodyMindText: "" }), "minimal input sparse");
assert(!valueLenses.isExtremelySparseInput(MOTHER), "mother conflict is meaningful");

console.log("insight-value-lenses fixtures passed");
