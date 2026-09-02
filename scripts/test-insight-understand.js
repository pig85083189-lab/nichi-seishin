"use strict";

/**
 * 04 UNDERSTAND — flow / JSON shape / history wiring (content-tone asserts removed).
 */

const fs = require("fs");
const path = require("path");
const insightUnderstand = require("../lib/insight-understand");
const retrieval = require("../lib/reflection-history-retrieval");
const reviewMerge = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mergeSrc = fs.readFileSync(path.join(root, "lib/review-merge.js"), "utf8");
const fx = insightUnderstand.QUALITY_FIXTURES;

assert(review.includes("runUnderstandPipeline"), "04 layer uses UNDERSTAND");
assert(review.includes("attachUnderstandHistory"), "04 open retrieves history server-side");
assert(review.includes("stripRound1HistorySpoof"), "client usedPast is stripped");
assert(fs.existsSync(path.join(root, "lib/insight-discovery.js")), "discovery guards retained");
assert(html.includes("這件事還可以怎麼理解"), "04 fold is UNDERSTAND");
assert(app.includes("function generateUnderstandAnswer"), "answer re-reasons");
assert(!review.includes("CREATE TABLE") && !review.includes("ALTER TABLE"), "zero schema");
assert(mergeSrc.includes("understand"), "merge keeps understand bag");
assert(insightUnderstand.UNDERSTAND_REASON_SYSTEM.includes("Return JSON"), "UNDERSTAND system is tech JSON scaffold");
assert(!/不要空泛文青|禁止寫「你總是/.test(insightUnderstand.UNDERSTAND_REASON_SYSTEM), "UNDERSTAND system has no old tone rules");

function done(iso, journal) {
  return {
    date: iso,
    completedAt: `${iso}T10:00:00.000Z`,
    journal,
  };
}

const TODAY = "2026-09-01";

function reviewsFor(past) {
  return {
    [past.date]: done(past.date, past.journal),
  };
}

async function retrieve(todayJournal, past) {
  return retrieval.retrieveRelevantHistory({
    reviews: reviewsFor(past),
    currentDate: TODAY,
    currentJournal: todayJournal,
  });
}

function scriptedAi(reason, write) {
  return async (_msgs, stage) => {
    if (stage === "write") return write || reason;
    return reason;
  };
}

(async () => {
  if (fx.B && fx.B.today && fx.B.past) {
    const b = await retrieve(fx.B.today, fx.B.past);
    assert(Array.isArray(b.selectedPast), "history retrieval returns selectedPast");
  }

  if (fx.C && fx.C.today && fx.C.past) {
    const c = await retrieve(fx.C.today, fx.C.past);
    assert(Array.isArray(c.selectedPast), "history retrieval shape ok");
  }

  const open = await insightUnderstand.runUnderstandPipeline({
    callAi: scriptedAi(
      {
        stop: false,
        focus: { statement: "焦點一句", source: "raw", whyWorthThinking: "值得想" },
        past: { use: false },
        possibilities: [
          { id: "A", text: "可能一" },
          { id: "B", text: "可能二" },
        ],
        question: "你怎麼看這件事？",
        status: "ask",
      },
      {
        focusLine: "焦點一句",
        why: "值得想",
        pastNote: "",
        question: "你怎麼看這件事？",
        convergence: "",
      }
    ),
    ctx: {
      thanksText: "有吃飯",
      event: "朋友沒回訊。",
      mood: "平",
      bodyMindText: "胸口悶。",
    },
    mode: "open",
    step: "open",
  });
  assert(open.understand || open.status === "understand" || open.status === "silence", "open pipeline returns bag");
  if (open.understand) {
    assert(typeof open.understand.focus === "string" || open.understand.focus, "focus field present");
  }

  const stopped = await insightUnderstand.runUnderstandPipeline({
    callAi: scriptedAi({ stop: true, stopReason: "enough", focus: { statement: "", source: "raw", whyWorthThinking: "" }, question: null, status: "stop" }),
    ctx: {
      thanksText: "有吃飯",
      event: "普通一天。",
      mood: "平",
      bodyMindText: "還好。",
    },
    step: "open",
  });
  assert(stopped.status === "silence" || (stopped.understand && stopped.understand.stage === "stop"), "stop → silence stage");

  const merged = reviewMerge.mergeJournalObjects(
    { insight: { guide: { understand: { focus: "焦點", stage: "asked1" } } } },
    { insight: { guide: {} } }
  );
  assert(merged.insight.guide.understand && merged.insight.guide.understand.focus === "焦點", "merge keeps understand");

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

  console.log("insight understand scaffold tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
