"use strict";

const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const executionV3 = require("../lib/execution-v3");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function scriptedAi(reason, write) {
  return async (_msgs, stage) => {
    if (stage === "write") return write || reason;
    return reason;
  };
}

(async () => {
  const j2Answer = "我想先說明天早上再補，可是當下還是答應了。有點怕他覺得我不配合。";
  const j2Conv = insightUnderstand.gatePostAnswerConvergence(
    "這是在躲避感覺本身，而不是在評估拒絕的後果。",
    j2Answer,
    { event: "立刻答應了" },
    { focus: "知道不想卻答應" }
  );
  assert(!/躲避感覺|逃避感覺/.test(j2Conv), "hard｜0 AI_HYPOTHESIS_LAUNDERED");
  assert(/不配合/.test(j2Conv), "hard｜convergence follows USER ANSWER");

  const q2 = insightUnderstand.q2Justified(
    {
      enough: false,
      revised: true,
      status: "ask2",
      question2: "當你想說『明天早上再補』的時候，你有沒有真的開口考慮過說出來？還是『怕他覺得我不配合』就立刻蓋過去了？",
    },
    j2Answer,
    { event: "立刻答應" },
    { dropped: [] },
    { stage: "asked1", question: "是什麼讓你立刻答應？" }
  );
  assert(!q2, "hard｜0 REDUNDANT_Q2 / FAKE_INTERACTION");

  const j4Text = insightUnderstand.rewriteUnsupportedPattern(
    "這跟你平常立刻答應不太一樣。",
    { event: "這次我有說我想再想一週，沒有立刻答應。" },
    []
  );
  assert(!/平常/.test(j4Text), "hard｜0 FALSE_PATTERN / FORCED_HISTORY");
  assert(/這次|沒有立刻/.test(j4Text), "J4｜today-only rewrite");

  const j9 = await insightGrow.runGrowPipeline({
    callAi: async () => ({
      candidates: [{ id: "a1", type: "ALREADY_DONE", title: "我看見原因", text: "害怕被評價不配合，所以留下來。", whyCarry: "x", evidence: [] }],
    }),
    ctx: {
      thanksText: "還能把事情做完。",
      event: "主管臨時改工作，我不舒服。我很清楚是怕他覺得我不配合，所以才留下來。原因我已經知道了，今天不想再分析。",
      mood: "悶",
      bodyMindText: "肩膀緊，但我已經知道為什麼答應，沒有要再問自己為什麼。",
      understand: { stage: "stop" },
    },
  });
  assert(!j9.items.length, "J9｜不可把 RAW 再標成 ALREADY_DONE");

  const j12 = await insightGrow.runGrowPipeline({
    callAi: async () => ({
      candidates: [
        {
          id: "a1",
          type: "EMERGING",
          title: "我開始看見看見但沒停",
          text: "看見衝突卻立刻說好。",
          whyCarry: "x",
          evidence: [],
        },
      ],
    }),
    ctx: {
      thanksText: "自己那份還是趕完了。",
      event: "同事臨時請我幫忙改投影片。我明明手上有自己的截止，還是立刻說好，答應完才後悔。",
      mood: "累",
      bodyMindText: "答應完肩膀更緊，有點煩自己。",
      bodyMindInsight: "在手上有截止和立刻說好之間，你其實看見了衝突，卻在看見的同時就答應了。",
      understand: { stage: "converged", focus: "看見衝突卻立刻說好", convergence: "看見衝突卻立刻說好。" },
    },
  });
  assert(j12.items.length === 1, "J12｜parrot 被擋後仍可出 bridge");
  assert(j12.items[0].bridge, "J12｜bridge 不是新生成洞察");
  assert(insightGrow.confirmationOf(j12, j12.items[0].id) === "AI_SUGGESTED", "hard｜0 UNCONFIRMED_LEAK before select");

  const ready = executionV3.executionV3Ready({
    growVariant: "grow-v1",
    thanksText: "x",
    event: "同事臨時請我幫忙改投影片。我明明手上有自己的截止，還是立刻說好。",
    mood: "累",
    bodyMindText: "答應完肩膀更緊。",
    awarenessItems: j12.items,
    awarenessSelectedIds: [],
    awarenessSelected: [],
  });
  assert(!ready, "06 未確認不可跑 ACT");

  console.log("insight journey orch fixtures passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
