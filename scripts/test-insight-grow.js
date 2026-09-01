"use strict";

const fs = require("fs");
const path = require("path");
const insightGrow = require("../lib/insight-grow");
const insightUnderstand = require("../lib/insight-understand");
const awarenessV3 = require("../lib/awareness-v3");
const reviewMerge = require("../lib/review-merge");
const retrieval = require("../lib/reflection-history-retrieval");

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
assert(app.includes("哪一個最像今天的你？"), "selection prompt");
assert(app.includes("不用為了多一個答案，再替自己加一個標籤。"), "warm empty");
assert(app.includes("isGrowAwarenessBag"), "grow bag helper");
assert(app.includes("!isGrowAwarenessBag(bag)"), "new-day grow skips observation cue");
assert(app.includes("waitingUnderstand"), "05 waits for 04 complete");
assert(app.includes("function generateExecutionV3"), "06 generate untouched");
assert(insightUnderstand.understandIsComplete, "04 complete helper exported");

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
  assert(!a.drop && a.kept && a.kept.type === "NOT_YET_DONE", "A｜知道但還沒做到 → NOT_YET_DONE");

  const b = insightGrow.evaluateGrowItem(fx.B.good, ctxOf(fx.B));
  assert(!b.drop && b.kept && b.kept.type === "EMERGING", "B｜更早看見 → EMERGING");

  const cGood = insightGrow.evaluateGrowItem(fx.C.good, ctxOf(fx.C));
  const cBad = insightGrow.evaluateGrowItem({ title: "我就是會討好", text: fx.C.bad, type: "WORTH_OBSERVING" }, ctxOf(fx.C));
  assert(!cGood.drop && cGood.kept.type === "WORTH_OBSERVING", "C｜證據不足 → WORTH_OBSERVING");
  assert(cBad.drop && cBad.failed.includes("false-pattern"), "C｜模式宣稱必須拒絕");

  const d = insightGrow.evaluateGrowItem(fx.D.good, ctxOf(fx.D));
  assert(!d.drop && d.kept.type === "ALREADY_DONE", "D｜已經做得更好 → ALREADY_DONE");

  const e = insightGrow.evaluateGrowItem(
    { title: "我今天第一次先停下來", text: "你今天其實已經先替自己做了選擇，這本身就是成長。", type: "ALREADY_DONE" },
    ctxOf(fx.E)
  );
  assert(!e.drop, "E｜正向日允許成長覺察");

  const f = insightGrow.evaluateGrowItem({ title: "我要覺察消耗", text: fx.F.bad, type: "WORTH_OBSERVING" }, ctxOf(fx.F));
  assert(f.drop && f.failed.includes("parrot-03"), "F｜複述 03 必須拒絕");

  const g = insightGrow.evaluateGrowItem({ title: "我看見界線", text: fx.G.bad, type: "NOT_YET_DONE" }, ctxOf(fx.G));
  assert(g.drop && g.failed.includes("parrot-04"), "G｜複述 04 收斂必須拒絕");

  const h = insightGrow.evaluateGrowItem({ title: "我害怕關係", text: fx.H.bad, type: "NOT_YET_DONE" }, ctxOf(fx.H));
  assert(h.drop && h.failed.includes("launder"), "H｜未承認的 04 假設不可洗成已確認");

  const i = insightGrow.evaluateGrowItem(fx.I.good, ctxOf(fx.I));
  assert(!i.drop, "I｜使用者回答承認後可以成為更強覺察");

  const jAi = async () => ({ stop: true, candidates: [] });
  const j = await insightGrow.runGrowPipeline({
    callAi: jAi,
    ctx: ctxOf(fx.J),
  });
  assert(j.status === "empty" && !j.items.length, "J｜沒有新成長位置 → 0 條");
  assert(j.emptyCopy && j.emptyCopy.line1, "J｜溫柔停止文案");

  const one = insightGrow.projectItems(fx.K.items, fx.A.raw, fx.A.understand);
  assert(one.items.length === 1 && one.status === "grow", "K｜1 條有力覺察成立");

  const three = insightGrow.projectItems(fx.L.items, fx.A.raw, fx.A.understand);
  assert(three.items.length === 3, "L｜最多 3 條成立");

  const bag = {
    items: [
      { id: "a1", text: "你其實已經知道自己的界線，現在還沒跟上的是當下選擇。" },
      { id: "a2", text: "你可以開始留意自己是不是常常先答應。" },
    ],
    selectedIds: [],
  };
  assert(insightGrow.confirmationOf(bag, "a1") === "AI_SUGGESTED", "M｜未勾選 = AI_SUGGESTED");
  const picked = { ...bag, selectedIds: ["a1"] };
  assert(insightGrow.confirmationOf(picked, "a1") === "USER_CONFIRMED", "N｜勾選 = USER_CONFIRMED");
  assert(insightGrow.confirmationOf(picked, "a2") === "AI_SUGGESTED", "N｜未勾選仍是假設");

  const hist = retrieval.compactCandidate(
    {
      date: "2026-08-20",
      completedAt: "2026-08-20T10:00:00.000Z",
      journal: {
        awarenessV3: picked,
      },
    },
    "2026-08-20"
  );
  assert(hist.confirmed.awareness.some((line) => /界線/.test(line)), "N｜歷史只把勾選當 USER_CONFIRMED");
  assert(hist.aiClues.unselectedAwareness.some((line) => /先答應/.test(line)), "M｜未勾選進 AI hypothesis");
  assert(!hist.confirmed.awareness.some((line) => /先答應/.test(line)), "M｜未勾選不得當作用戶模式");

  assert(
    !awarenessV3.awarenessV3Ready({
      ...BASE,
      coreQuote: "知道不想答應，和最後還是答應之間的距離。",
      understand: { stage: "asked1", focus: "焦點", question: "這比較接近什麼？" },
    }),
    "O｜Q1 等待回答時不可解鎖 05"
  );
  assert(
    !awarenessV3.awarenessV3Ready({
      ...BASE,
      coreQuote: "知道不想答應，和最後還是答應之間的距離。",
      understand: { stage: "asked2", focus: "焦點", question2: "還有沒有別的理解？" },
    }),
    "P｜Q2 等待回答時不可解鎖 05"
  );
  assert(
    awarenessV3.awarenessV3Ready({
      ...BASE,
      understand: { stage: "converged", focus: "焦點", answer: "我當下還是答應了。", convergence: "知道和做到之間。" },
    }),
    "Q｜04 收斂後可解鎖 05"
  );
  assert(
    awarenessV3.awarenessV3Ready({
      ...BASE,
      understand: { stage: "stop", focus: "", whyWorthThinking: "今天這件事，你其實已經想得滿清楚了。" },
    }),
    "R｜04 正確停止後可解鎖 05"
  );
  assert(!insightUnderstand.understandIsComplete({ stage: "asked1" }), "O｜asked1 未完成");
  assert(insightUnderstand.understandIsComplete({ stage: "stop" }), "R｜stop 算完成");

  const sig1 = awarenessV3.awarenessV3SourceSig({
    ...BASE,
    understand: { stage: "converged", answer: "我還是答應了。", convergence: "知道和做到。" },
  });
  const sig2 = awarenessV3.awarenessV3SourceSig({
    ...BASE,
    understand: { stage: "converged", answer: "其實不是怕關係，我只是累。", convergence: "知道和做到。" },
  });
  assert(sig1 !== sig2, "S｜04 回答改變會改 sourceSig");
  assert(
    awarenessV3.awarenessV3SourceStale({ growVariant: "grow-v1", status: "grow", sourceSig: sig1, items: one.items }, {
      ...BASE,
      understand: { stage: "converged", answer: "其實不是怕關係，我只是累。", convergence: "知道和做到。" },
    }),
    "S｜04 回答改變後既有 05 必須 stale"
  );

  const legacy = reviewMerge.normalizeAwarenessV3Bag({
    items: [
      { id: "a1", text: "我看見自己會先忍。" },
      { id: "a2", text: "我看見自己在意位置。" },
      { id: "a3", text: "我看見自己很少開口。" },
    ],
    selectedIds: ["a1"],
    sourceSig: "legacy-sig",
    observationCue: { text: "留意自己什麼時候先把話吞回去。", selectedSig: "a1\n我看見自己會先忍。" },
  });
  assert(!legacy.growVariant && legacy.items.length === 3 && legacy.observationCue, "T｜legacy awarenessV3 可 normalize");
  assert(awarenessV3.hasAwarenessV3Result(legacy), "T｜legacy 仍以 2～3 條為結果");
  assert(
    awarenessV3.awarenessV3Ready({
      ...BASE,
      coreQuote: "知道不想答應，和最後還是答應之間的距離。",
    }),
    "T｜沒有 understand bag 時仍用 coreQuote 相容"
  );
  const legacySig = awarenessV3.awarenessV3SourceSig({
    ...BASE,
    bodyMindInsight: "舊洞察",
    coreQuote: "舊金句",
    thinkQuestions: [{ text: "舊問題？" }],
  });
  assert(legacySig.includes("舊洞察") && legacySig.includes("舊金句"), "T｜legacy sourceSig 仍含 03／04 AI");

  const growEmpty = reviewMerge.normalizeAwarenessV3Bag({
    growVariant: "grow-v1",
    status: "empty",
    sourceSig: "new-grow",
    generatedAt: "2026-09-01T12:00:00.000Z",
    items: [],
    emptyCopy: insightGrow.EMPTY_COPY,
  });
  assert(growEmpty.growVariant === "grow-v1" && growEmpty.emptyCopy, "merge 保留 grow 欄位");
  const mergedEmpty = reviewMerge.mergeAwarenessV3(legacy, growEmpty);
  assert(mergedEmpty.status === "empty" && !mergedEmpty.items.length, "空 GROW 是真結果，可覆蓋舊 items");
  const typed = reviewMerge.normalizeAwarenessV3Bag({
    growVariant: "grow-v1",
    status: "grow",
    sourceSig: "typed",
    items: [{ id: "a1", title: "我已經更快發現", text: "你已經更早察覺到了。", type: "EMERGING", maturity: "NOTICING" }],
  });
  assert(typed.items[0].type === "EMERGING" && typed.items[0].maturity === "NOTICING", "optional type／maturity 可保留");

  const scripted = await insightGrow.runGrowPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "write") {
        return { items: [{ id: "a1", title: fx.A.good.title, text: fx.A.good.text }] };
      }
      return { stop: false, candidates: [{ id: "a1", ...fx.A.good, whyCarry: "帶走成長位置", evidence: ["立刻答應"] }] };
    },
    ctx: ctxOf(fx.A),
  });
  assert(scripted.items.length === 1 && scripted.growVariant === "grow-v1", "pipeline 可產出 1 條 GROW");
  assert(!scripted.observationCue, "new-day GROW 不產 observation cue");

  const parrotOnly = await insightGrow.runGrowPipeline({
    callAi: async () => ({
      candidates: [{ id: "a1", title: "消耗", text: fx.F.bad, type: "WORTH_OBSERVING" }],
    }),
    ctx: ctxOf({ ...fx.F, raw: BASE, understand: { stage: "converged", focus: "臨時變動", convergence: "消耗" } }),
  });
  assert(!parrotOnly.items.length && parrotOnly.status === "empty", "只剩 03 複述時正確停止");

  console.log("insight grow fixtures A–T passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
