"use strict";

/**
 * 06 ACT — flow / safety / JSON shape (content-tone asserts removed).
 */

const fs = require("fs");
const path = require("path");
const insightAct = require("../lib/insight-act");
const executionV3 = require("../lib/execution-v3");
const reviewMerge = require("../lib/review-merge");
const insightGrow = require("../lib/insight-grow");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fx = insightAct.QUALITY_FIXTURES;

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
assert(review.includes("runActPipeline"), "06 layer uses ACT");
assert(review.includes("shouldRunAct"), "ACT only for grow days");
assert(!review.includes("CREATE TABLE") && !review.includes("ALTER TABLE"), "zero schema");
assert(html.includes("這份覺察，要怎麼帶回生活？"), "new-day 06 lead");
assert(html.includes("把這份覺察帶回生活"), "new-day 06 CTA");
assert(app.includes("isActExecutionBag"), "act bag helper");
assert(/function generateExecutionV3[\s\S]{0,400}rejectArchivedJournalWrite/.test(app), "completed 不重打 ACT");
assert(app.includes("function generateAwarenessV3"), "05 generate untouched");
assert(insightGrow.runGrowPipeline, "05 engine retained");
assert(insightAct.ACT_SYSTEM.includes("Return JSON"), "ACT system is tech JSON scaffold");
assert(!/不要太文青|白話優先|剛好 3 個/.test(insightAct.ACT_SYSTEM), "ACT system has no old tone rules");

(async () => {
  const a = insightAct.evaluateActItem(fx.A.good, fx.A.ctx);
  assert(!a.drop && a.kept && a.kept.title && a.kept.detail, "shape: action with title+detail kept");

  const missing = insightAct.evaluateActItem({ title: "", detail: "" }, fx.A.ctx);
  assert(missing.drop, "shape: missing fields dropped");

  assert(
    !executionV3.executionV3Ready({
      ...fx.A.ctx,
      awarenessSelectedIds: [],
      awarenessSelected: [],
    }),
    "no 05 selection → ACT not ready"
  );

  assert(
    !executionV3.executionV3Ready({
      growVariant: "grow-v1",
      thanksText: "還能寫",
      event: "主管臨時改工作，我留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，想回家。",
      awarenessItems: [
        { id: "a1", text: "假設一" },
        { id: "a2", text: "假設二" },
        { id: "a3", text: "假設三" },
      ],
      awarenessSelectedIds: [],
    }),
    "AI suggestions without confirm → ACT not ready"
  );

  let calls = 0;
  const blocked = await insightAct.runActPipeline({
    callAi: async () => {
      calls += 1;
      return { actions: [{ title: "不該出現", detail: "硬生行動" }] };
    },
    ctx: {
      growVariant: "grow-v1",
      awarenessSelectedIds: [],
      awarenessItems: [{ id: "a1", text: "假設" }],
      event: "普通一天",
      thanksText: "有吃飯",
      mood: "平",
    },
  });
  assert(blocked.blocked && blocked.meta && blocked.meta.calls === 0, "no USER_CONFIRMED → blocked");
  assert(calls === 0, "no USER_CONFIRMED → model not called");

  const dEmpty = await insightAct.runActPipeline({
    callAi: async () => ({ decision: "NO_ACTION", actions: [], noActionCopy: { line1: "", line2: "" } }),
    ctx: fx.D.ctx,
  });
  assert(dEmpty.status === "no-action" && !dEmpty.actions.length, "NO_ACTION allowed after confirm");

  const withActions = await insightAct.runActPipeline({
    callAi: async () => ({
      decision: "ACTIONS",
      leadIn: "",
      actions: [
        { id: "e1", kind: "ACTION_NOW", title: "下一步一", detail: "做一件小事", sourceAwarenessIds: ["a1"] },
        { id: "e2", kind: "PRACTICE", title: "下一步二", detail: "練習一件事", sourceAwarenessIds: ["a1"] },
      ],
    }),
    ctx: fx.A.ctx,
  });
  assert(withActions.status === "actions" && withActions.actions.length === 2, "actions JSON projected");
  assert(withActions.actions[0].title === "下一步一", "action title preserved");

  const sig1 = executionV3.executionV3SourceSig({ ...fx.A.ctx, awarenessSelected: [fx.A.ctx.awarenessItems[0].text] });
  const sig2 = executionV3.executionV3SourceSig({
    ...fx.A.ctx,
    awarenessSelectedIds: ["a1", "a2"],
    awarenessSelected: [fx.A.ctx.awarenessItems[0].text, "另一個勾選"],
    awarenessItems: fx.A.ctx.awarenessItems.concat([{ id: "a2", text: "另一個勾選" }]),
  });
  assert(sig1 !== sig2, "selection change updates sourceSig");

  const one = insightAct.projectActions([fx.A.good], fx.A.ctx);
  assert(one.actions.length === 1 && one.status === "actions", "projectActions keeps shape");

  const none = insightAct.emptyNoAction(fx.D.ctx);
  assert(none.status === "no-action" && none.sourceSig, "emptyNoAction persistable");

  const legacy = reviewMerge.normalizeExecutionChoiceBag({
    variant: "execution-v3",
    options: [
      { id: "e1", text: "分清哪些真的不能改", detail: "列出不能控制的一件事。" },
      { id: "e2", text: "寫下未來居住條件", detail: "寫三個條件。" },
      { id: "e3", text: "說一個具體感受", detail: "只說一個空間。" },
    ],
    selectedIds: ["e1"],
    sourceSig: "legacy-exec",
  });
  assert(!legacy.actVariant && legacy.options.length === 3 && legacy.selectedIds[0] === "e1", "legacy execution-v3 readable");
  const mergedKeep = reviewMerge.mergeExecutionChoiceBags(legacy, { options: [], selectedIds: [] });
  assert(mergedKeep.options.length === 3, "empty bag does not wipe legacy options");

  const noAct = reviewMerge.normalizeExecutionChoiceBag({
    variant: "execution-v3",
    actVariant: "act-v1",
    status: "no-action",
    sourceSig: "act-empty",
    generatedAt: "2026-09-01T12:00:00.000Z",
    options: [],
    noActionCopy: insightAct.NO_ACTION_COPY,
  });
  assert(noAct.actVariant === "act-v1", "NO_ACTION fields retained");
  const mergedEmpty = reviewMerge.mergeExecutionChoiceBags(legacy, noAct);
  assert(mergedEmpty.status === "no-action" && !mergedEmpty.options.length, "NO_ACTION can overwrite");

  assert(app.includes("rejectArchivedJournalWrite"), "completed write guard");
  assert(insightAct.actionConfirmationOf({ options: [{ id: "e1", text: "下一步" }], selectedIds: ["e1"] }, "e1") === "ACTION_CHOSEN", "06 chosen");
  assert(insightGrow.confirmationOf({ items: [{ id: "a1", text: "覺察" }], selectedIds: ["a1"] }, "a1") === "USER_CONFIRMED", "05 confirmed");
  assert(insightAct.actionConfirmationOf({ options: [{ id: "e1", text: "下一步" }], selectedIds: [] }, "e1") === "ACTION_SUGGESTED", "06 suggested");

  console.log("insight act scaffold tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
