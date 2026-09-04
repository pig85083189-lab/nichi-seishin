const assert = require("assert");
const fs = require("fs");
const path = require("path");
const internalTest = require("../lib/internal-test");

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function check(name, fn) {
  fn();
  console.log("PASS", name);
}

const SECRET = "SECRET_JOURNAL_EVENT_SHOULD_NEVER_STORE";

check("A Internal 03 seeTrace retained", () => {
  const store = memoryStorage();
  const out = internalTest.retainPipelineTraceFromReason(
    {
      seeTrace: {
        finalStatus: "observation",
        insightPresent: true,
        boundary: { insight: "pass", support: "pass" },
      },
      dropped: [{ prose: SECRET }],
      journal: SECRET,
    },
    { storage: store, timestamp: "2026-09-04T10:00:00.000Z" }
  );
  assert.strictEqual(out.stage, "see");
  assert.strictEqual(out.seeTrace.finalStatus, "observation");
  assert.strictEqual(out.seeTrace.insightPresent, true);
  assert.strictEqual(out.seeTrace.boundary.insight, "pass");
  assert.ok(!JSON.stringify(out).includes(SECRET));
  assert.ok(!JSON.stringify(out).includes("dropped"));
});

check("B Internal 04 understandTrace retained without deleting seeTrace", () => {
  const store = memoryStorage();
  internalTest.retainPipelineTraceFromReason(
    {
      seeTrace: {
        finalStatus: "observation",
        insightPresent: true,
        boundary: { insight: "pass", support: "clip" },
      },
    },
    { storage: store, timestamp: "2026-09-04T10:00:00.000Z" }
  );
  const out = internalTest.retainPipelineTraceFromReason(
    {
      understandTrace: {
        reasonerStatus: "ok",
        candidateCount: 3,
        usableCandidateCount: 1,
        selectorStatus: "selected",
        coreSelected: true,
        writerAttempted: true,
        writerStatus: "ok",
        preBoundary: { focusPresent: true, focusLength: 12, whyPresent: true, whyLength: 10, questionPresent: false, questionLength: 0 },
        boundary: { focus: "pass", why: "pass", question: "empty" },
        postBoundary: { focusPresent: true, focusLength: 12, whyPresent: true, whyLength: 10, questionPresent: false, questionLength: 0 },
        projectionStatus: "active",
        finalStage: "asked1",
        finalStatus: "understand",
        silenceReason: null,
        leakProse: SECRET,
      },
    },
    { storage: store, timestamp: "2026-09-04T10:01:00.000Z" }
  );
  assert.strictEqual(out.stage, "understand");
  assert.ok(out.seeTrace);
  assert.strictEqual(out.seeTrace.boundary.support, "clip");
  assert.strictEqual(out.understandTrace.usableCandidateCount, 1);
  assert.strictEqual(out.understandTrace.boundary.focus, "pass");
  assert.ok(!("leakProse" in out.understandTrace));
  assert.ok(!JSON.stringify(out).includes(SECRET));
});

check("C Internal 05 growTrace retained", () => {
  const store = memoryStorage();
  internalTest.retainPipelineTraceFromReason(
    { seeTrace: { finalStatus: "observation", insightPresent: true, boundary: { insight: "pass", support: "pass" } } },
    { storage: store, timestamp: "2026-09-04T10:00:00.000Z" }
  );
  internalTest.retainPipelineTraceFromReason(
    {
      understandTrace: {
        reasonerStatus: "ok",
        candidateCount: 1,
        usableCandidateCount: 1,
        selectorStatus: "selected",
        coreSelected: true,
        writerAttempted: true,
        writerStatus: "ok",
        preBoundary: {},
        boundary: { focus: "pass" },
        postBoundary: {},
        projectionStatus: "active",
        finalStage: "asked1",
        finalStatus: "understand",
        silenceReason: null,
      },
    },
    { storage: store, timestamp: "2026-09-04T10:01:00.000Z" }
  );
  const out = internalTest.retainPipelineTraceFromReason(
    {
      growTrace: {
        inputUnderstandStage: "asked1",
        inputUnderstandStop: false,
        candidateCountBefore: 2,
        itemCountAfterGate: 1,
        itemCountAfterBoundary: 1,
        finalStatus: "grow",
        selectedIdsCount: 0,
        skipReason: null,
      },
    },
    { storage: store, timestamp: "2026-09-04T10:02:00.000Z" }
  );
  assert.strictEqual(out.stage, "grow");
  assert.ok(out.seeTrace);
  assert.ok(out.understandTrace);
  assert.strictEqual(out.growTrace.itemCountAfterBoundary, 1);
});

check("D Internal 06 actTrace retained", () => {
  const store = memoryStorage();
  const seed = {
    seeTrace: { finalStatus: "observation", insightPresent: true, boundary: { insight: "pass", support: "pass" } },
    understandTrace: {
      reasonerStatus: "ok",
      candidateCount: 1,
      usableCandidateCount: 1,
      selectorStatus: "selected",
      coreSelected: true,
      writerAttempted: true,
      writerStatus: "ok",
      preBoundary: {},
      boundary: {},
      postBoundary: {},
      projectionStatus: "active",
      finalStage: "asked1",
      finalStatus: "understand",
      silenceReason: null,
    },
    growTrace: {
      inputUnderstandStage: "asked1",
      inputUnderstandStop: false,
      candidateCountBefore: 1,
      itemCountAfterGate: 1,
      itemCountAfterBoundary: 1,
      finalStatus: "grow",
      selectedIdsCount: 0,
      skipReason: null,
    },
  };
  internalTest.retainPipelineTraceFromReason({ seeTrace: seed.seeTrace }, { storage: store, timestamp: "t1" });
  internalTest.retainPipelineTraceFromReason({ understandTrace: seed.understandTrace }, { storage: store, timestamp: "t2" });
  internalTest.retainPipelineTraceFromReason({ growTrace: seed.growTrace }, { storage: store, timestamp: "t3" });
  const out = internalTest.retainPipelineTraceFromReason(
    {
      actTrace: {
        growStatus: "grow",
        selectedIdsCount: 0,
        executionAttempted: false,
        finalStatus: "blocked",
        stopHeavyReason: "selectedIds_empty",
        blockedReason: "NO_USER_CONFIRMED_AWARENESS",
      },
    },
    { storage: store, timestamp: "t4" }
  );
  assert.strictEqual(out.stage, "act");
  assert.ok(out.seeTrace && out.understandTrace && out.growTrace && out.actTrace);
  assert.strictEqual(out.actTrace.selectedIdsCount, 0);
});

check("E normal user / empty reason → no trace storage", () => {
  const store = memoryStorage();
  const out = internalTest.retainPipelineTraceFromReason({}, { storage: store });
  assert.strictEqual(out, null);
  assert.strictEqual(store.getItem(internalTest.PIPELINE_TRACE_STORAGE_KEY), null);
  assert.strictEqual(internalTest.retainPipelineTraceFromReason(null, { storage: store }), null);
  assert.strictEqual(internalTest.retainPipelineTraceFromReason({ focus: SECRET, why: SECRET }, { storage: store }), null);
});

check("F refresh/read → latest Internal trace remains readable", () => {
  const store = memoryStorage();
  internalTest.retainPipelineTraceFromReason(
    {
      seeTrace: { finalStatus: "observation", insightPresent: true, boundary: { insight: "pass", support: "pass" } },
    },
    { storage: store, timestamp: "2026-09-04T10:00:00.000Z" }
  );
  internalTest.retainPipelineTraceFromReason(
    {
      understandTrace: {
        reasonerStatus: "stop",
        candidateCount: 0,
        usableCandidateCount: 0,
        selectorStatus: "failed",
        coreSelected: false,
        writerAttempted: false,
        writerStatus: "skipped",
        preBoundary: {},
        boundary: {},
        postBoundary: {},
        projectionStatus: "silence",
        finalStage: "stop",
        finalStatus: "silence",
        silenceReason: "model-stop",
      },
    },
    { storage: store, timestamp: "2026-09-04T10:01:00.000Z" }
  );
  const read = internalTest.readPipelineTrace(store);
  assert.ok(read);
  assert.strictEqual(read.stage, "understand");
  assert.ok(read.seeTrace);
  assert.strictEqual(read.understandTrace.silenceReason, "model-stop");
  assert.strictEqual(read.timestamp, "2026-09-04T10:01:00.000Z");
});

check("G journal/sync payload isolation + no private content", () => {
  const store = memoryStorage();
  const bag = internalTest.retainPipelineTraceFromReason(
    {
      seeTrace: { finalStatus: "silence", insightPresent: true, boundary: { insight: "pass", support: "pass" } },
      understandTrace: {
        reasonerStatus: "ok",
        candidateCount: 2,
        usableCandidateCount: 0,
        selectorStatus: "failed",
        coreSelected: false,
        writerAttempted: false,
        writerStatus: "skipped",
        preBoundary: { focusPresent: true, focusLength: 20, whyPresent: false, whyLength: 0, questionPresent: false, questionLength: 0 },
        boundary: { focus: "reject_marker" },
        postBoundary: { focusPresent: false, focusLength: 0, whyPresent: false, whyLength: 0, questionPresent: false, questionLength: 0 },
        projectionStatus: "silence_fallback",
        finalStage: "stop",
        finalStatus: "silence",
        silenceReason: "boundary_reject_marker",
        candidateText: "你其實已經把界線說出來了。這是不該被留下的 prose",
      },
      rawProvider: { content: "huge" },
      prompts: { system: "SYS" },
    },
    { storage: store, timestamp: "t" }
  );
  const json = JSON.stringify(bag);
  assert.ok(!json.includes("你其實"));
  assert.ok(!json.includes("candidateText"));
  assert.ok(!json.includes("rawProvider"));
  assert.ok(!json.includes("prompts"));
  assert.ok(!json.includes("SYS"));

  const journal = {
    thanksText: "t",
    event: "e",
    mood: "m",
    insight: { guide: { status: "silence" } },
  };
  assert.ok(!("seeTrace" in journal));
  assert.ok(!("understandTrace" in journal));
  assert.notStrictEqual(internalTest.PIPELINE_TRACE_STORAGE_KEY, "nichi.reviews");
  assert.ok(!String(internalTest.PIPELINE_TRACE_STORAGE_KEY).startsWith("nichi."));
});

check("H public response path equivalence wiring", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(app.includes("retainPipelineTraceFromReason"));
  assert.ok(app.includes("Do NOT merge _internalReason into data"));
  // Still returns payload.data only; does not assign _internalReason onto data.
  assert.ok(!/payload\.data\._internalReason\s*=/.test(app));
  assert.ok(/return payload\.data;/.test(app));
  // Capture happens only for Internal + when _internalReason exists.
  assert.ok(app.includes("isInternalMembership() && payload._internalReason"));
});

check("prose-length codes rejected", () => {
  const long = "x".repeat(80);
  const out = internalTest.sanitizeUnderstandTrace({
    reasonerStatus: long,
    candidateCount: 1,
    usableCandidateCount: 1,
    selectorStatus: "selected",
    coreSelected: true,
    writerAttempted: true,
    writerStatus: "ok",
    preBoundary: {},
    boundary: { focus: long },
    postBoundary: {},
    projectionStatus: "active",
    finalStage: "asked1",
    finalStatus: "understand",
    silenceReason: long,
  });
  assert.strictEqual(out.reasonerStatus, "");
  assert.strictEqual(out.boundary.focus, undefined);
  assert.strictEqual(out.silenceReason, null);
});

console.log("\nALL INTERNAL PIPELINE TRACE RETENTION FIXTURES PASSED");
console.log("STORAGE_KEY", internalTest.PIPELINE_TRACE_STORAGE_KEY);
