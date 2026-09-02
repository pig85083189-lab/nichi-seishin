"use strict";

/**
 * Answer-engine scaffold — wiring + ACT safety (tone/format asserts removed).
 */

const fs = require("fs");
const path = require("path");
const answerEngine = require("../lib/ing-answer-engine");
const bodyMindSee = require("../lib/body-mind-see");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");
const executionV3 = require("../lib/execution-v3");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");

assert(fs.existsSync(path.join(root, "lib/ing-answer-engine.js")), "answer-engine module present");
assert(answerEngine.ANSWER_ENGINE_VERSION === "ing-answer-engine-scaffold", "engine is scaffold");
assert(answerEngine.ANSWER_ENGINE_VOICE === "", "voice cleared");
assert(answerEngine.integratedReflectionSeed({}) == null, "content seeds cleared");
assert(answerEngine.composeSeeDocument({}) && answerEngine.composeSeeDocument({}).insight === "", "see composer stubbed");
assert(answerEngine.composeActLeadIn([], {}) === "", "act lead-in stubbed");

const raw = {
  thanksText: "我想感謝有人願意好好說話。",
  event: "媽媽說滾出去。",
  mood: "難受",
  bodyMindText: "胸口不舒服。",
};

(async () => {
  const see = await bodyMindSee.runSeePipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "s1",
              type: "CONTRAST",
              statement: "技術輸出洞察",
              evidence: ["胸口不舒服"],
              newInformation: "n",
              whyItMatters: "w",
              alternative: "a",
              confidence: "medium",
            },
          ],
        };
      }
      if (stage === "challenge") return { items: [{ id: "s1", verdict: "KEEP", failed: [] }] };
      if (stage === "write") return { insight: "技術輸出洞察", support: "技術輸出說明" };
      return {};
    },
    ctx: raw,
  });
  assert(see.insight === "技術輸出洞察", "03 pipeline still returns insight");

  const understand = await insightUnderstand.runUnderstandPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "write") {
        return { focusLine: "焦點", why: "原因", pastNote: "", question: "問題？", convergence: "" };
      }
      return {
        stop: false,
        focus: { statement: "焦點", source: "raw", whyWorthThinking: "原因" },
        past: { use: false },
        possibilities: [{ id: "A", text: "可能" }],
        question: "問題？",
        status: "ask",
      };
    },
    ctx: raw,
    mode: "open",
  });
  assert(understand.understand || understand.status, "04 pipeline still runs");

  const grow = await insightGrow.runGrowPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "write") return { items: [{ id: "a1", title: "標題", text: "成長位置" }] };
      return {
        stop: false,
        candidates: [
          {
            id: "a1",
            type: "WORTH_OBSERVING",
            maturity: "NOTICING",
            title: "標題",
            text: "成長位置",
            whyCarry: "w",
            evidence: ["e"],
          },
        ],
      };
    },
    ctx: { ...raw, understand: understand.understand || { stage: "converged", focus: "焦點" }, bodyMindInsight: see.insight },
  });
  assert(grow, "05 pipeline still runs");

  let calls = 0;
  const blocked = await insightAct.runActPipeline({
    callAi: async () => {
      calls += 1;
      return { decision: "ACTIONS", actions: [{ title: "x", detail: "y" }] };
    },
    ctx: { ...raw, growVariant: "grow-v1", awarenessSelectedIds: [], awarenessItems: [{ id: "a1", text: "假設" }] },
  });
  assert(blocked.blocked && calls === 0, "06 blocked without USER_CONFIRMED");
  assert(!executionV3.executionV3Ready({ ...raw, growVariant: "grow-v1", awarenessSelectedIds: [], awarenessItems: [{ id: "a1", text: "假設" }] }), "ACT not ready without confirm");

  const confirmed = await insightAct.runActPipeline({
    callAi: async () => ({
      decision: "ACTIONS",
      leadIn: "",
      actions: [{ id: "e1", kind: "ACTION_NOW", title: "一小步", detail: "做一件事", sourceAwarenessIds: ["a1"] }],
    }),
    ctx: {
      ...raw,
      growVariant: "grow-v1",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "t", text: "已確認覺察" }],
    },
  });
  assert(confirmed.status === "actions" && confirmed.actions.length === 1, "06 runs after USER_CONFIRMED");

  console.log("ing answer-engine scaffold / eval wiring passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
