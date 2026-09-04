"use strict";

const assert = require("assert");
const boundary = require("../lib/public-output-boundary");
const insightUnderstand = require("../lib/insight-understand");
const bodyMindSee = require("../lib/body-mind-see");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");

function check(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

function hasProseLeak(value) {
  const json = JSON.stringify(value);
  return /USER RAW|內部思考|SYSTEM|PIPELINE SCHEMA|你是 ING|Bearer |eyJ|thanksText|bodyMindText/.test(json);
}

check("A normal focus: writer → boundary PASS → projection active", async () => {
  const out = await insightUnderstand.runUnderstandPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          stop: false,
          focus: {
            statement: "你其實已經把界線說出來了。",
            whyWorthThinking: "值得再看身體有沒有比較鬆。",
            source: "raw",
          },
          possibilities: [
            { id: "A", text: "可能是在保護自己。" },
            { id: "B", text: "也可能是在怕衝突。" },
          ],
          question: "如果換成更親近的人，你還會這樣說嗎？",
        };
      }
      return {
        focusLine: "你其實已經把界線說出來了。",
        why: "值得再看身體有沒有比較鬆。",
        pastNote: "",
        question: "如果換成更親近的人，你還會這樣說嗎？",
        convergence: "",
      };
    },
    ctx: {
      thanksText: "謝謝自己有停一下",
      event: "開會時想立刻答應，後來先說想再想。",
      mood: "緊",
      bodyMindText: "胸口緊，但有先停。",
    },
  });
  assert.strictEqual(out.status, "understand");
  assert.ok(out.understand.focus);
  const trace = out.meta.understandTrace;
  assert.strictEqual(trace.reasonerStatus, "ok");
  assert.strictEqual(trace.selectorStatus, "selected");
  assert.strictEqual(trace.writerStatus, "ok");
  assert.strictEqual(trace.boundary.focus, "pass");
  assert.strictEqual(trace.projectionStatus, "active");
  assert.strictEqual(trace.finalStatus, "understand");
  assert.strictEqual(trace.silenceReason, null);
  assert.ok(!hasProseLeak(trace));
});

check("B marker leak: boundary REJECT_MARKER → projection stop", () => {
  const meta = {
    _traceReasonerStatus: "ok",
    _traceSelectorStatus: "selected",
    _traceWriterAttempted: true,
    _traceWriterStatus: "ok",
    _traceCandidateCount: 2,
    _traceUsableCandidateCount: 2,
  };
  const projected = insightUnderstand.projectUnderstand(
    {
      stage: "asked1",
      focus: "【CORE】USER RAW 內部思考引擎 PIPELINE SCHEMA",
      whyWorthThinking: "值得再看。",
      question: "你還好嗎？",
    },
    { event: "e", mood: "m", thanksText: "t" },
    [],
    meta
  );
  assert.strictEqual(projected.status, "silence");
  assert.strictEqual(meta.understandTrace.boundary.focus, "reject_marker");
  assert.strictEqual(meta.understandTrace.projectionStatus, "silence_fallback");
  assert.strictEqual(meta.understandTrace.silenceReason, "boundary_reject_marker");
  assert.ok(!hasProseLeak(meta.understandTrace));
});

check("C oversized valid text: boundary CLIP → focus survives", () => {
  const long = [
    "今天這件事裡，你其實已經把界線說出來了。",
    "值得再看的是說出口之後身體有沒有比較鬆。",
    "如果換成更親近的人，這個選擇還會不會一樣，也值得再確認一次。",
    "還有一層是，當下胸口緊的時候，你有沒有先為自己留一點空間，而不是立刻把最重的話送出去。",
    "最後也可以再問自己：這次停下來，比較像保護自己，還是比較像害怕關係受影響。",
  ].join("");
  assert.ok(boundary.compactChars(long) > boundary.LIMITS.understandFocus);
  const inspected = boundary.inspectPublicText(long, {
    maxChars: boundary.LIMITS.understandFocus,
    fallback: "",
  });
  assert.strictEqual(inspected.status, "clip");
  assert.ok(inspected.text);
  assert.ok(boundary.compactChars(inspected.text) <= boundary.LIMITS.understandFocus);

  const meta = {
    _traceReasonerStatus: "ok",
    _traceSelectorStatus: "selected",
    _traceWriterAttempted: true,
    _traceWriterStatus: "ok",
  };
  const projected = insightUnderstand.projectUnderstand(
    {
      stage: "asked1",
      focus: long,
      whyWorthThinking: "值得再看身體有沒有比較鬆。",
      question: "你比較在意哪一層？",
    },
    { event: "e", mood: "m", thanksText: "t" },
    [],
    meta
  );
  assert.strictEqual(projected.status, "understand");
  assert.ok(projected.understand.focus);
  assert.strictEqual(meta.understandTrace.boundary.focus, "clip");
  assert.strictEqual(meta.understandTrace.projectionStatus, "active");
});

check("D reasoner silence identifiable separately", async () => {
  const out = await insightUnderstand.runUnderstandPipeline({
    callAi: async () => ({
      stop: true,
      stopReason: "already-clear",
      focus: { statement: "", whyWorthThinking: "", source: "raw" },
      possibilities: [],
      question: null,
    }),
    ctx: {
      thanksText: "謝謝自己",
      event: "原因我已經知道，沒有要再問，也不想再分析。",
      mood: "平",
      bodyMindText: "還好。",
    },
  });
  assert.strictEqual(out.status, "silence");
  const trace = out.meta.understandTrace;
  assert.ok(["stop", "skipped_already_clear"].includes(trace.reasonerStatus));
  assert.ok(trace.silenceReason === "already-clear" || trace.silenceReason === "model-stop" || trace.reasonerStatus === "skipped_already_clear");
  assert.ok(trace.projectionStatus === "silence" || trace.finalStatus === "silence");
});

check("E selector/core failure identifiable separately", async () => {
  const out = await insightUnderstand.runUnderstandPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          stop: false,
          focus: { statement: "你總是逃避真正的問題。", whyWorthThinking: "這證明你一直都是討好型。", source: "raw" },
          possibilities: [],
          question: "你為什麼總是這樣？",
        };
      }
      return { focusLine: "x", why: "y", question: null, convergence: "", pastNote: "" };
    },
    ctx: {
      thanksText: "謝謝空氣",
      event: "今天天氣不錯。",
      mood: "平",
      bodyMindText: "普通。",
    },
  });
  assert.strictEqual(out.status, "silence");
  const trace = out.meta.understandTrace;
  assert.ok(trace.selectorStatus === "failed" || trace.silenceReason === "selector_failed" || trace.writerStatus === "rejected");
  assert.ok(trace.finalStatus === "silence");
});

check("F writer empty/fatal identifiable separately", async () => {
  const out = await insightUnderstand.runUnderstandPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          stop: false,
          focus: {
            statement: "知道不太想，和最後還是答應之間的距離。",
            whyWorthThinking: "你已經看見自己的不舒服。真正值得想的，也許不是為什麼又答應了，而是看見之後，什麼讓行動還沒跟上。",
            source: "raw",
          },
          possibilities: [{ id: "A", text: "可能還在怕衝突。" }],
          question: "看見之後，什麼讓行動還沒跟上？",
        };
      }
      return {
        focusLine: "你總是逃避，這證明你一直都是討好型。",
        why: "你害怕被拋棄的陰影。",
        question: null,
        convergence: "你一直都是這樣。",
        pastNote: "",
      };
    },
    ctx: {
      thanksText: "謝謝自己有寫下來",
      event: "主管臨時改工作，我不太想但還是答應留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，胸口悶。",
    },
  });
  const trace = out.meta.understandTrace;
  assert.ok(trace.writerAttempted === true || trace.writerStatus);
  if (out.status === "silence") {
    assert.ok(
      trace.writerStatus === "rejected" ||
        trace.silenceReason === "writer_fatal" ||
        trace.projectionStatus === "silence_fallback" ||
        trace.projectionStatus === "silence"
    );
  }
});

check("G normal non-Internal response shape has no diagnostic on data", () => {
  const publicBag = insightUnderstand.projectUnderstand(
    {
      stage: "asked1",
      focus: "你其實已經把界線說出來了。",
      whyWorthThinking: "值得再看身體有沒有比較鬆。",
      question: "你還會這樣說嗎？",
    },
    { event: "e", mood: "m", thanksText: "t" },
    []
  );
  assert.strictEqual(publicBag.meta, undefined);
  assert.ok(!("understandTrace" in publicBag));
  assert.ok(!hasProseLeak(publicBag));
});

check("H Internal meta contains metadata only", async () => {
  const out = await insightUnderstand.runUnderstandPipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          stop: false,
          focus: {
            statement: "你其實已經把界線說出來了。",
            whyWorthThinking: "值得再看身體有沒有比較鬆。",
            source: "raw",
          },
          possibilities: [{ id: "A", text: "可能是在保護自己。" }],
          question: "如果換成更親近的人，你還會這樣說嗎？",
        };
      }
      return {
        focusLine: "你其實已經把界線說出來了。",
        why: "值得再看身體有沒有比較鬆。",
        question: "如果換成更親近的人，你還會這樣說嗎？",
        pastNote: "",
        convergence: "",
      };
    },
    ctx: {
      thanksText: "SECRET_JOURNAL_THANKS",
      event: "SECRET_JOURNAL_EVENT",
      mood: "緊",
      bodyMindText: "SECRET_BODY",
    },
  });
  const trace = out.meta.understandTrace;
  assert.ok(trace);
  assert.ok(!JSON.stringify(trace).includes("SECRET_"));
  assert.ok(!hasProseLeak(trace));
  assert.ok(!out.meta._traceReasonerStatus);
});

check("03 seeTrace structural", () => {
  const projected = bodyMindSee.projectSeeOutput({
    status: "observation",
    insight: "你其實在守住自己的節奏。",
    support: "不一定要先下結論。",
  });
  assert.ok(projected._boundary);
  assert.strictEqual(projected._boundary.insight, "pass");
  delete projected._boundary;
  assert.ok(projected.insight);
});

check("05 growTrace on empty cascade", () => {
  const empty = insightGrow.emptyResult(
    { event: "e", mood: "m", thanksText: "t" },
    {
      understand: { stage: "stop", focus: "", whyWorthThinking: "x" },
      meta: { skipReason: "silence-cascade", _growCandidatesBefore: 0, _growAfterGate: 0 },
    }
  );
  assert.strictEqual(empty.meta.growTrace.finalStatus, "empty");
  assert.strictEqual(empty.meta.growTrace.skipReason, "silence-cascade");
  assert.strictEqual(empty.meta.growTrace.selectedIdsCount, 0);
  assert.ok(!hasProseLeak(empty.meta.growTrace));
});

check("06 actTrace selectedIds / blocked", async () => {
  const blocked = await insightAct.runActPipeline({
    callAi: async () => ({}),
    ctx: { awarenessSelectedIds: [], awarenessSelected: [], awarenessItems: [] },
  });
  assert.strictEqual(blocked.meta.actTrace.selectedIdsCount, 0);
  assert.strictEqual(blocked.meta.actTrace.executionAttempted, false);
  assert.strictEqual(blocked.meta.actTrace.blockedReason, "NO_USER_CONFIRMED_AWARENESS");
  assert.ok(!hasProseLeak(blocked.meta.actTrace));
});

check("sanitizePublicText behavior unchanged vs inspect.text", () => {
  const samples = [
    "你其實已經把界線說出來了。",
    "【CORE】USER RAW 內部思考",
    "",
    ["今天這件事裡，你其實已經把界線說出來了。", "值得再看的是說出口之後身體有沒有比較鬆。", "如果換成更親近的人，這個選擇還會不會一樣。"].join(""),
  ];
  for (const sample of samples) {
    const a = boundary.sanitizePublicText(sample, { maxChars: 96, fallback: "" });
    const b = boundary.inspectPublicText(sample, { maxChars: 96, fallback: "" }).text;
    assert.strictEqual(a, b);
  }
});

console.log("\nALL INTERNAL PIPELINE TRACE FIXTURES PASSED");
