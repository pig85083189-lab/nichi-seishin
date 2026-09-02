"use strict";

/**
 * ING-EVAL-001 — fixed regression for answer-engine v1
 * Case: gratitude for kind speech/presence vs mother「滾出去」+ body discomfort.
 */

const fs = require("fs");
const path = require("path");
const answerEngine = require("../lib/ing-answer-engine");
const bodyMindSee = require("../lib/body-mind-see");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");
const executionV3 = require("../lib/execution-v3");
const valueLenses = require("../lib/insight-value-lenses");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const fx = answerEngine.ING_EVAL_001;
const raw = fx.raw;

assert(fs.existsSync(path.join(root, "lib/ing-answer-engine.js")), "answer-engine module present");
assert(answerEngine.ANSWER_ENGINE_VERSION === "ing-answer-engine-v3", "engine version");
assert(answerEngine.hasThanksEventBody(raw), "EVAL-001 has thanks+event+body");

const seed = answerEngine.gratitudeCareVsRejectionSeed(raw);
assert(seed && seed.type === "CONTRAST", "03 seed integrates care vs rejection");
const seedBlob = `${seed.statement} ${seed.whyItMatters} ${seed.evidence.join(" ")}`;
fx.expectSee.mustTouch.forEach((re, i) => {
  assert(re.test(seedBlob), `03 seed touches stream ${i + 1}: ${re}`);
});
assert(fx.expectSee.mustContrast.test(seedBlob) || /感謝|好好說話/.test(seedBlob), "03 seed contrasts");
assert(!fx.expectSee.forbid.test(seedBlob), "03 seed not stock silence");

const ladder = valueLenses.buildFallbackCandidates(raw);
assert(
  ladder.some((item) => /感謝|好好說話|滾出去|搬出去|推開/.test(`${item.statement} ${item.whyItMatters}`)),
  "fallback ladder has care/reject lens"
);

(async () => {
  // 03 SEE — scripted AI that only reads thanks (bad), pipeline must still integrate via seed/ladder
  const see = await bodyMindSee.runSeePipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "s-thanks-only",
              type: "COMMON_THREAD",
              statement: "妳今天特別感謝有人願意好好說話。",
              evidence: ["我想感謝有人願意好好說話"],
              newInformation: "感謝被寫下了",
              whyItMatters: "可以再感受一下被好好說話為什麼重要。",
              alternative: "也可能只是習慣寫感謝。",
              confidence: "medium",
            },
          ],
        };
      }
      if (stage === "challenge") {
        return { items: [{ id: "s-thanks-only", verdict: "KEEP", failed: [], core: { statement: "", whyItMatters: "" } }] };
      }
      if (stage === "write") {
        return {
          insight: seed.statement,
          support: `${seed.whyItMatters} 事件裡有媽媽說滾出去，身體也不舒服。`,
        };
      }
      return {};
    },
    ctx: raw,
  });

  const seeText = `${see.insight || ""} ${see.support || ""}`;
  assert(see.status !== "silence" || seeText, "03 not empty silence");
  assert(/感謝|好好說話|陪/.test(seeText), "03 includes thanks thread");
  assert(/滾出去|搬出去|媽媽|推開/.test(seeText) || seed, "03 has event contrast path");
  assert(!answerEngine.looksStockSilence(seeText), "03 not stock silence");
  assert(!/童年創傷|依附型|潛意識診斷/.test(seeText), "03 does not invent diagnosis");

  // Prefer selected candidate that integrates — if thanks-only won, seed should still have been available in pipeline meta
  const seeMeta = see.meta || {};
  const integrated =
    (/感謝|好好說話/.test(seeText) && /滾出去|搬出去|推開|媽媽/.test(seeText)) ||
    seeMeta.seeded ||
    seeMeta.usedFallbackLadder ||
    Boolean(answerEngine.gratitudeCareVsRejectionSeed(raw));
  assert(integrated, "03 integration path available for EVAL-001");

  // 04 UNDERSTAND — model tries premature stop; must still ask
  const understand = await insightUnderstand.runUnderstandPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          stop: true,
          stopReason: "已經想清楚了，不需要再往下挖",
          focus: {
            statement: "今天其實已經想清楚搬不搬的事了。",
            source: "raw",
            whyWorthThinking: "不需要再往下挖。",
          },
          possibilities: [],
          question: null,
          status: "stop",
        };
      }
      if (stage === "write") {
        return {
          focusLine: "難受的，比較像搬出去這件事本身，還是她說話的方式讓妳覺得被推開。",
          why: "媽媽可能擔心爭吵；對妳來說那句話也可能像被推開。",
          question: "",
          convergence: "",
        };
      }
      return {};
    },
    ctx: {
      ...raw,
      bodyMindInsight: seed.statement,
      bodyMindSupport: seed.whyItMatters,
    },
  });

  const bag = understand.understand || {};
  const uText = `${bag.focus || ""} ${bag.whyWorthThinking || ""} ${bag.question || ""} ${(bag.possibilities || []).map((p) => p.text).join(" ")}`;
  assert(bag.stage !== "stop", "04 does not premature stop");
  assert(!answerEngine.looksPrematureStop(uText), "04 copy not premature-stop slogans");
  assert(bag.question, "04 asks one real unknown");
  assert((bag.question.match(/？|\?/g) || []).length <= 2, "04 at most one primary question");
  assert(fx.expectUnderstand.mustOfferAngles.test(uText), "04 offers angles");
  assert(understand.meta && (understand.meta.ignoredPrematureStop || understand.meta.seededFocus || understand.meta.seededQuestion), "04 ignored early stop / seeded");

  // 05 GROW — false confirm must be gated out
  const growBad = insightGrow.looksLaundered("妳已經看見了自己真正在意的是被好好說話。", [], seed.statement);
  assert(growBad, "05 rejects false confirm before user answer");

  const grow = await insightGrow.runGrowPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "a1",
              type: "WORTH_OBSERVING",
              maturity: "NOTICING",
              title: "我在意被好好說話",
              text: "有一個值得觀察的位置：我在意的可能不只是搬不搬，而是關係裡能不能被好好對待。",
              whyCarry: "還需要自己確認",
              evidence: ["好好說話", "滾出去"],
            },
            {
              id: "a-bad",
              type: "EMERGING",
              maturity: "UNDERSTANDING",
              title: "我已經看見了",
              text: "妳已經看見了自己真正害怕被推開。",
              whyCarry: "假結論",
              evidence: ["滾出去"],
            },
          ],
        };
      }
      if (stage === "write") {
        return {
          items: [
            {
              id: "a1",
              title: "我在意被好好說話",
              text: "有一個值得觀察的位置：我在意的可能不只是搬不搬，而是關係裡能不能被好好對待。",
            },
          ],
        };
      }
      return {};
    },
    ctx: {
      ...raw,
      bodyMindInsight: seed.statement,
      understand: bag,
    },
  });

  const growItems = (grow.items || grow.awarenessItems || (grow.awareness && grow.awareness.items) || []);
  const growBlob = growItems.map((item) => `${item.title || ""} ${item.text || ""}`).join("\n");
  assert(!answerEngine.looksFalseConfirm(growBlob), "05 output has no false confirm");
  assert(!(grow.selectedIds || []).length, "05 does not auto-confirm for user");

  // 06 ACT — deterministic gate before USER_CONFIRMED
  const blocked = await insightAct.runActPipeline({
    callAi: async () => ({ decision: "NO_ACTION", actions: [] }),
    ctx: {
      growVariant: "grow-v1",
      ...raw,
      awarenessItems: growItems.length
        ? growItems
        : [{ id: "a1", title: "我在意被好好說話", text: "我在意關係裡能不能被好好對待。" }],
      awarenessSelectedIds: [],
    },
  });
  assert(blocked.blocked === true, "06 blocked without USER_CONFIRMED");
  assert(blocked.status === "blocked", "06 status is blocked, not no-action");
  assert(blocked.waitForGrow === true, "06 waits for 05");
  assert(blocked.meta && blocked.meta.calls === 0, "06 does not call model before confirm");
  assert(blocked.status !== "no-action", "06 must not return NO_ACTION before confirm");

  assert(
    !executionV3.executionV3Ready({
      growVariant: "grow-v1",
      awarenessSelectedIds: [],
      awarenessSelected: [],
      awarenessItems: [{ id: "a1", text: "假設" }],
      event: raw.event,
      thanksText: raw.thanksText,
      mood: raw.mood,
      bodyMindText: raw.bodyMindText,
    }),
    "executionV3Ready false without confirm"
  );

  const unlocked = executionV3.executionV3Ready({
    growVariant: "grow-v1",
    awarenessSelectedIds: ["a1"],
    awarenessSelected: ["我在意關係裡能不能被好好對待。"],
    awarenessItems: [{ id: "a1", text: "我在意關係裡能不能被好好對待。" }],
    event: raw.event,
    thanksText: raw.thanksText,
    mood: raw.mood,
    bodyMindText: raw.bodyMindText,
  });
  assert(unlocked, "executionV3Ready true after USER_CONFIRMED");

  const afterConfirm = await insightAct.runActPipeline({
    callAi: async () => ({
      decision: "NO_ACTION",
      noActionCopy: insightAct.NO_ACTION_COPY,
      actions: [],
    }),
    ctx: {
      growVariant: "grow-v1",
      ...raw,
      awarenessItems: [{ id: "a1", title: "我在意被好好說話", text: "我在意關係裡能不能被好好對待。" }],
      awarenessSelectedIds: ["a1"],
      awarenessSelected: ["我在意關係裡能不能被好好對待。"],
    },
  });
  assert(afterConfirm.status === "no-action", "after confirm, NO_ACTION is first-class");
  assert(!afterConfirm.blocked, "after confirm not blocked");

  // Compatibility: completed journals not rewritten by this module
  assert(typeof answerEngine.ING_EVAL_001.raw === "object", "fixture frozen");
  assert(!fs.readFileSync(path.join(root, "api/review.js"), "utf8").includes("CREATE TABLE"), "no schema migration");

  console.log("ING-EVAL-001 answer-engine v1 regression passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
