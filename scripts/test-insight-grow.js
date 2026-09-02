"use strict";

/**
 * 05 GROW — flow / JSON shape (content-tone asserts removed).
 */

const fs = require("fs");
const path = require("path");
const insightGrow = require("../lib/insight-grow");
const insightUnderstand = require("../lib/insight-understand");
const awarenessV3 = require("../lib/awareness-v3");
const reviewMerge = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fx = insightGrow.QUALITY_FIXTURES;

const apiFiles = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full);
    else if (name.isFile() && /\.(js|ts)$/.test(name.name)) apiFiles.push(full);
  }
}
walk(path.join(root, "api"));

assert(apiFiles.length === 12, `function count ${apiFiles.length}`);
assert(review.includes("runGrowPipeline"), "05 layer uses GROW");
assert(review.includes("shouldRunGrow"), "GROW only for understand days");
assert(!review.includes("CREATE TABLE") && !review.includes("ALTER TABLE"), "zero schema");
assert(html.includes("今天，你可以帶走哪些覺察？"), "new-day 05 lead");
assert(html.includes("看看今天可以帶走的覺察"), "new-day 05 CTA");
assert(app.includes("isGrowAwarenessBag"), "grow bag helper");
assert(app.includes("waitingUnderstand"), "05 waits for 04 complete");
assert(app.includes("function generateExecutionV3"), "06 generate untouched");
assert(insightUnderstand.understandIsComplete, "04 complete helper exported");
assert(insightGrow.GROW_REASON_SYSTEM.includes("Return JSON"), "GROW system is tech JSON scaffold");
assert(!/不要把 AI 推測|羞辱|討好別人/.test(insightGrow.GROW_REASON_SYSTEM), "GROW system has no old tone rules");

const BASE = {
  thanksText: "還能寫",
  event: "主管臨時改工作，我留下來。",
  mood: "悶",
  bodyMindText: "肩膀緊，想回家。",
};

function ctxOf(row) {
  return {
    ...(row.raw || BASE),
    understand: row.understand || null,
    bodyMindInsight: row.see || "",
    seeInsight: row.see || "",
  };
}

(async () => {
  const a = insightGrow.evaluateGrowItem(fx.A.good, ctxOf(fx.A));
  assert(!a.drop && a.kept && a.kept.text, "shape: grow item with text kept");
  assert(a.kept.type === "NOT_YET_DONE" || a.kept.type, "type field preserved when valid");

  const empty = insightGrow.evaluateGrowItem({ title: "x", text: "" }, ctxOf(fx.A));
  assert(empty.drop, "shape: empty text dropped");

  const stopped = await insightGrow.runGrowPipeline({
    callAi: async () => ({ stop: true, candidates: [] }),
    ctx: ctxOf(fx.A),
  });
  assert(stopped.status === "empty" || stopped.empty || !(stopped.items || []).length, "empty candidates → empty bag");

  const withItems = await insightGrow.runGrowPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "write") {
        return { items: [{ id: "a1", title: "我還在練習", text: "知道和做到之間還有距離。" }] };
      }
      return {
        stop: false,
        candidates: [
          {
            id: "a1",
            type: "NOT_YET_DONE",
            maturity: "UNDERSTANDING",
            title: "我還在練習",
            text: "知道和做到之間還有距離。",
            whyCarry: "值得帶走",
            evidence: ["event"],
          },
        ],
      };
    },
    ctx: ctxOf(fx.A),
  });
  assert((withItems.items || withItems.options || []).length >= 1 || withItems.status === "grow", "grow items projected");

  assert(insightGrow.confirmationOf({ items: [{ id: "a1", text: "覺察" }], selectedIds: ["a1"] }, "a1") === "USER_CONFIRMED", "05 confirm label");
  assert(insightGrow.confirmationOf({ items: [{ id: "a1", text: "覺察" }], selectedIds: [] }, "a1") === "AI_SUGGESTED", "05 suggested label");

  const bag = awarenessV3.normalizeAwarenessV3({
    items: [{ id: "a1", title: "t", text: "覺察文字" }],
    selectedIds: ["a1"],
  });
  assert(bag.items[0].text === "覺察文字", "awareness bag normalizes");

  console.log("insight grow scaffold tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
