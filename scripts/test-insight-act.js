"use strict";

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
assert(app.includes("哪一個你想帶去做／練習？"), "06 selection distinct from 05");
assert(app.includes("這個覺察現在不用急著變成任務"), "NO_ACTION copy");
assert(app.includes("isActExecutionBag"), "act bag helper");
assert(/function generateExecutionV3[\s\S]{0,400}rejectArchivedJournalWrite/.test(app), "V｜completed 不重打 ACT");
assert(app.includes("function generateAwarenessV3"), "05 generate untouched");
assert(insightGrow.runGrowPipeline, "05 engine retained");

(async () => {
  const a = insightAct.evaluateActItem(fx.A.good, fx.A.ctx);
  assert(!a.drop && a.kept && (a.kept.kind === "ACTION_NOW" || a.kept.kind === "PRACTICE"), "A｜NOT_YET_DONE → 具體下一步");

  const b = insightAct.evaluateActItem(fx.B.good, fx.B.ctx);
  const bLeap = insightAct.evaluateActItem(fx.B.badLeap, fx.B.ctx);
  assert(!b.drop && b.kept.kind === "PRACTICE", "B｜EMERGING → 小練習");
  assert(bLeap.drop, "B｜巨大躍進必須拒絕");

  const c = insightAct.evaluateActItem(fx.C.good, fx.C.ctx);
  const cBad = insightAct.evaluateActItem(fx.C.bad, fx.C.ctx);
  assert(!c.drop && c.kept.kind === "OBSERVE", "C｜WORTH_OBSERVING → OBSERVE");
  assert(cBad.drop, "C｜模式／行動躍進必須拒絕");

  const dEmpty = await insightAct.runActPipeline({
    callAi: async () => ({ decision: "NO_ACTION", actions: [], noActionCopy: insightAct.NO_ACTION_COPY }),
    ctx: fx.D.ctx,
  });
  assert(dEmpty.status === "no-action" && !dEmpty.actions.length, "D｜ALREADY_DONE 允許 NO_ACTION");

  const eBad = insightAct.evaluateActItem(fx.E.badTask, fx.E.ctx);
  assert(eBad.drop, "E｜正向覺察不可硬派休息作業");

  assert(
    !executionV3.executionV3Ready({
      ...fx.A.ctx,
      awarenessSelectedIds: [],
      awarenessSelected: [],
    }),
    "F｜沒有 05 勾選不可解鎖 ACT"
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
    "G｜3 條 AI 建議 0 勾選不可解鎖"
  );

  const leak = insightAct.evaluateActItem(
    {
      title: "因為你已經知道自己害怕被拋棄",
      detail: "明天直接跟對方攤牌，告訴他你很害怕被拋棄。",
      kind: "ACTION_NOW",
    },
    {
      growVariant: "grow-v1",
      thanksText: "有吃飯",
      event: "朋友沒回訊，我只是累。",
      mood: "平",
      bodyMindText: "想睡覺。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [
        { id: "a1", text: "今天比較像是累，不是關係危機。" },
        { id: "a2", text: "你其實很害怕被拋棄，所以才討好別人。" },
      ],
    }
  );
  assert(leak.drop, "H｜未勾選假設不可漏進行動");

  const sig1 = executionV3.executionV3SourceSig({ ...fx.A.ctx, awarenessSelected: [fx.A.ctx.awarenessItems[0].text] });
  const sig2 = executionV3.executionV3SourceSig({
    ...fx.A.ctx,
    awarenessSelectedIds: ["a1", "a2"],
    awarenessSelected: [fx.A.ctx.awarenessItems[0].text, "另一個勾選"],
    awarenessItems: fx.A.ctx.awarenessItems.concat([{ id: "a2", text: "另一個勾選" }]),
  });
  assert(sig1 !== sig2, "I｜勾選改變會改 sourceSig");
  assert(
    executionV3.executionV3SourceStale({ actVariant: "act-v1", status: "actions", sourceSig: sig1, actions: [{ title: "x", detail: "y".repeat(8) }] }, {
      ...fx.A.ctx,
      awarenessSelectedIds: ["a1", "a2"],
      awarenessSelected: [fx.A.ctx.awarenessItems[0].text, "另一個勾選"],
    }),
    "I｜勾選改變後 06 stale"
  );

  const j = insightAct.evaluateActItem(fx.A.good, fx.A.ctx);
  assert(!j.drop && /重做|確認/.test(`${j.kept.title}${j.kept.detail}`), "J｜04 回答可進入情境，不必新心理學");
  assert(!insightAct.looksNewPsychology(`${j.kept.title}${j.kept.detail}`), "J｜沒有新心理學");

  const k = insightAct.evaluateActItem({ title: "學習建立界線", detail: "你要學習建立界線。", kind: "PRACTICE" }, fx.A.ctx);
  assert(k.drop && (k.failed.includes("generic") || k.failed.includes("vague-what") || k.failed.includes("vague-when")), "K｜建立界線必須失敗");

  const l = insightAct.evaluateActItem({ title: "好好愛自己", detail: "相信自己，好好愛自己。", kind: "PRACTICE" }, fx.A.ctx);
  assert(l.drop && l.failed.includes("generic"), "L｜好好愛自己必須失敗");

  const m = insightAct.evaluateActItem({ title: "先確認這一版是否全要重做", detail: "不要直接開始重做，先確認一次這一版確定要全部重做嗎。", kind: "ACTION_NOW" }, fx.A.ctx);
  assert(m.drop && m.failed.includes("vague-when"), "M｜有 WHAT 沒 WHEN 必須失敗");

  const n = insightAct.evaluateActItem({ title: "明天照顧感受", detail: "明天好好照顧自己的感受。", kind: "ACTION_NOW" }, fx.A.ctx);
  assert(n.drop && (n.failed.includes("vague-what") || n.failed.includes("generic")), "N｜有 WHEN 沒 WHAT 必須失敗");

  const o = insightAct.evaluateActItem(
    { title: "下次直接拒絕加班", detail: "下次主管叫你加班時，直接拒絕，不要再配合。", kind: "ACTION_NOW" },
    {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管又叫我加班。",
      mood: "累",
      bodyMindText: "肩膀緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我知道自己的界線，但行動還沒跟上。" }],
    }
  );
  const oSafe = insightAct.evaluateActItem(
    { title: "下次先確認加班期限", detail: "下一次臨時被要求加班時，先確認這件事真正的期限，再決定怎麼安排。", kind: "ACTION_NOW", sourceAwarenessIds: ["a1"] },
    {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管又叫我加班。",
      mood: "累",
      bodyMindText: "肩膀緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我知道自己的界線，但行動還沒跟上。" }],
    }
  );
  assert(o.drop, "O｜重大決定／權力不對等不可直接拒絕主管");
  assert(!oSafe.drop, "O｜低風險確認可以留下");

  const shared = insightAct.projectActions(
    [{ id: "e1", title: fx.A.good.title, detail: fx.A.good.detail, kind: "ACTION_NOW", sourceAwarenessIds: ["a1", "a2"] }],
    fx.A.ctx
  );
  assert(shared.actions.length === 1, "P｜多個覺察可收成一個下一步");

  const one = insightAct.projectActions([fx.A.good], fx.A.ctx);
  assert(one.actions.length === 1 && one.status === "actions", "Q｜1 條成立");

  const none = insightAct.emptyNoAction(fx.D.ctx);
  assert(none.status === "no-action" && none.sourceSig, "R｜0 + NO_ACTION 可持久化");

  const three = insightAct.projectActions([
    { ...fx.A.good, id: "e1" },
    { ...fx.B.good, id: "e2" },
    { ...fx.C.good, id: "e3" },
  ], fx.A.ctx);
  assert(three.actions.length === 3, "S｜最多 3 條");

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
  assert(!legacy.actVariant && legacy.options.length === 3 && legacy.selectedIds[0] === "e1", "T｜legacy execution-v3 可讀");
  const mergedKeep = reviewMerge.mergeExecutionChoiceBags(legacy, { options: [], selectedIds: [] });
  assert(mergedKeep.options.length === 3, "T｜空 bag 不可抹掉 legacy options");

  const noAct = reviewMerge.normalizeExecutionChoiceBag({
    variant: "execution-v3",
    actVariant: "act-v1",
    status: "no-action",
    sourceSig: "act-empty",
    generatedAt: "2026-09-01T12:00:00.000Z",
    options: [],
    noActionCopy: insightAct.NO_ACTION_COPY,
  });
  assert(noAct.actVariant === "act-v1" && noAct.noActionCopy, "U｜NO_ACTION 欄位可保留");
  const mergedEmpty = reviewMerge.mergeExecutionChoiceBags(legacy, noAct);
  assert(mergedEmpty.status === "no-action" && !mergedEmpty.options.length, "U｜NO_ACTION 可覆蓋並重載");

  assert(app.includes("rejectArchivedJournalWrite"), "V｜completed 保護仍在");

  const execBag = { options: [{ id: "e1", text: "下一步" }], selectedIds: ["e1"] };
  assert(insightAct.actionConfirmationOf(execBag, "e1") === "ACTION_CHOSEN", "W｜06 勾選是想帶去做");
  assert(insightGrow.confirmationOf({ items: [{ id: "a1", text: "覺察" }], selectedIds: ["a1"] }, "a1") === "USER_CONFIRMED", "W｜05 勾選仍是真的像我");
  assert(insightAct.actionConfirmationOf({ options: [{ id: "e1", text: "下一步" }], selectedIds: [] }, "e1") === "ACTION_SUGGESTED", "W｜未勾選行動不是確認覺察");

  const blocked = await insightAct.runActPipeline({
    callAi: async () => ({ actions: [{ title: "不該出現", detail: "從原文硬派三個行動。" }] }),
    ctx: { growVariant: "grow-v1", awarenessSelectedIds: [], awarenessItems: [{ id: "a1", text: "假設" }], event: "普通一天", thanksText: "有吃飯", mood: "平" },
  });
  assert(blocked.blocked && blocked.meta && blocked.meta.calls === 0, "F｜無勾選不呼叫模型硬生行動");

  const typed = reviewMerge.normalizeExecutionChoiceBag({
    actVariant: "act-v1",
    status: "actions",
    sourceSig: "typed",
    options: [{ id: "e1", text: "下次先確認這一版是否全要重做", detail: "下次工作內容臨時被改時，先確認一次。", actKind: "ACTION_NOW", sourceAwarenessIds: ["a1"] }],
  });
  assert(typed.options[0].actKind === "ACTION_NOW" && typed.options[0].sourceAwarenessIds[0] === "a1", "optional actKind／source 可保留");

  console.log("insight act fixtures A–W passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
