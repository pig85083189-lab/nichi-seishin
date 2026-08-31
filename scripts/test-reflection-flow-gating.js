const fs = require("fs");
const path = require("path");
const reviewMerge = require("../lib/review-merge");
const awarenessV3 = require("../lib/awareness-v3");
const reflectionV3 = require("../lib/reflection-v3");
const executionV3 = require("../lib/execution-v3");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const QUESTIONS = [
  { id: "q1", text: "你說了之後，真正在等的是什麼？" },
  { id: "q2", text: "被理解，和對方必須同意，是同一件事嗎？" },
  { id: "q3", text: "如果這次沒被接住，你最不想習慣失去的是什麼？" },
];

const TODAY = {
  thanksText: "還能坐下來說話",
  event: "和伴侶溝通，覺得自己一直說了也沒用。",
  mood: "無力",
  bodyMind: {
    text: "胸口悶，講完還是像沒被理解。",
    insight: "真正累的也許不是沒說，而是說了之後沒被接住。",
    support: "先分開看看：你要的是被聽懂，還是對方必須同意。",
  },
};

const CORE_QUOTE = "表達過，不代表被接住。";

function firstLayerGuide(extra) {
  return {
    variant: "reflection-v3",
    status: "generated",
    coreQuote: CORE_QUOTE,
    questions: QUESTIONS,
    sourceSig: "thanks\nevent\nmood\nbody",
    generatedAt: "2026-08-31T02:00:00.000Z",
    ...(extra || {}),
  };
}

function todayJournal(extraGuide, extraJournal) {
  return {
    ...TODAY,
    insight: {
      title: "今日核心金句",
      conclusion: CORE_QUOTE,
      psychology: CORE_QUOTE,
      guide: firstLayerGuide(extraGuide),
    },
    ...(extraJournal || {}),
  };
}

function retrievalMeta(used) {
  return {
    sourceSig: "retrieval-should-not-enter-04-05-sig",
    selectedPast: used
      ? [
          {
            date: "2026-07-12",
            score: 4,
            connectionType: "same-tension",
            provenance: { userRaw: true, userConfirmed: false, aiHypothesis: false },
            used: true,
          },
        ]
      : [],
  };
}

function draftRound(retrieval) {
  return {
    id: "ext_draft",
    questions: [],
    selectedQuestionId: "",
    answer: "",
    retrieval: retrieval || { sourceSig: "x", selectedPast: [] },
  };
}

function askedRound(retrieval) {
  return {
    id: "ext_asked",
    coreThread: "被接住",
    questions: [
      { id: "eq1", text: "你要的是被聽懂，還是對方必須同意？" },
      { id: "eq2", text: "這次沒被接住，你先保護的是什麼？" },
      { id: "eq3", text: "如果先不要求對方改，你自己還想看哪一層？" },
    ],
    selectedQuestionId: "",
    answer: "",
    retrieval: retrieval || retrievalMeta(true),
  };
}

function awareReady(journal) {
  const guide = (journal.insight && journal.insight.guide) || {};
  return awarenessV3.awarenessV3Ready({
    thanksText: journal.thanksText,
    event: journal.event,
    mood: journal.mood,
    bodyMindText: journal.bodyMind && journal.bodyMind.text,
    coreQuote: guide.coreQuote,
    thinkQuestions: guide.questions,
  });
}

function thinkReady(journal) {
  return reflectionV3.reflectionV3Ready({
    thanksText: journal.thanksText,
    event: journal.event,
    mood: journal.mood,
    bodyMindText: journal.bodyMind && journal.bodyMind.text,
  });
}

function execReady(journal) {
  const v3 = journal.awarenessV3 || {};
  return executionV3.executionV3Ready({
    thanksText: journal.thanksText,
    event: journal.event,
    mood: journal.mood,
    bodyMindText: journal.bodyMind && journal.bodyMind.text,
    coreQuote: journal.insight && journal.insight.guide && journal.insight.guide.coreQuote,
    awarenessItems: v3.items || [],
    awarenessSelectedIds: v3.selectedIds || [],
  });
}

const layerOnly = todayJournal();
assert(thinkReady(layerOnly), "A: 01～03 complete → 04 ready");
assert(awareReady(layerOnly), "B: 04 first layer generated → 05 ready without extension");
assert(!reviewMerge.hasMeaningfulReflectionExtension({ rounds: [draftRound()] }), "draft id / retrieval 不算 extension complete");
assert(!reviewMerge.hasMeaningfulGuide({ extension: { rounds: [draftRound(retrievalMeta(true))] } }), "id-only extension 不可當成 04 complete");

const withEmptyExt = todayJournal({ extension: { variant: "reflection-extension-v1", rounds: [] } });
assert(awareReady(withEmptyExt), "B: 空 extension 仍可進 05");

const withDraft = todayJournal({ extension: { variant: "reflection-extension-v1", rounds: [draftRound(retrievalMeta(false))] } });
assert(awareReady(withDraft), "D: retrieved 0 / used 0 仍可進 05");

const withAsked0 = todayJournal({
  extension: { variant: "reflection-extension-v1", rounds: [askedRound(retrievalMeta(false))] },
});
assert(awareReady(withAsked0), "C/D: extension + retrieval metadata 仍可進 05");

const withAskedUsed = todayJournal({
  extension: { variant: "reflection-extension-v1", rounds: [askedRound(retrievalMeta(true))] },
});
assert(awareReady(withAskedUsed), "E: retrieved >0 / used >0 仍可進 05");

const draftNewer = {
  guide: {
    variant: "reflection-extension-v1",
    extension: { rounds: [draftRound(retrievalMeta(true))] },
    retrieval: retrievalMeta(true),
  },
};
const mergedKeepLayer = reviewMerge.mergeInsightObjects(layerOnly.insight, draftNewer);
assert(mergedKeepLayer.guide.coreQuote === CORE_QUOTE, "draft persist 不可覆蓋 coreQuote");
assert(mergedKeepLayer.guide.variant === "reflection-v3", "draft persist 不可覆蓋 variant");
assert(mergedKeepLayer.guide.questions.length === 3, "draft persist 不可覆蓋 questions");
assert(mergedKeepLayer.guide.sourceSig === layerOnly.insight.guide.sourceSig, "draft persist 不可覆蓋 04 sourceSig");
assert(awareReady({ ...layerOnly, insight: mergedKeepLayer }), "merge 後 05 仍 ready");

const askedNewer = {
  guide: {
    coreQuote: "",
    questions: [],
    sourceSig: "",
    extension: { rounds: [askedRound(retrievalMeta(true))] },
  },
};
const mergedAsked = reviewMerge.mergeGuideObjects(layerOnly.insight.guide, askedNewer);
assert(mergedAsked.coreQuote === CORE_QUOTE, "extension 更新必須 preserve coreQuote");
assert(mergedAsked.variant === "reflection-v3", "extension 更新必須 preserve variant");
assert(mergedAsked.questions.length === 3, "extension 更新必須 preserve questions");
assert(mergedAsked.sourceSig === layerOnly.insight.guide.sourceSig, "extension 更新必須 preserve 04 sourceSig");
assert(!mergedAsked.retrieval, "retrieval 不可升到 guide root");

const reload = reviewMerge.pickReview(
  { date: "2026-08-31", updatedAt: "2026-08-31T02:00:00.000Z", journal: layerOnly },
  {
    date: "2026-08-31",
    updatedAt: "2026-08-31T02:05:00.000Z",
    journal: todayJournal({ extension: { rounds: [askedRound(retrievalMeta(true))] } }),
  }
);
assert(reload.journal.insight.guide.coreQuote === CORE_QUOTE, "H: reload merge 保留 04");
assert(awareReady(reload.journal), "H: reload 後 05 仍 ready");
assert(thinkReady(reload.journal), "H: reload 後 04 gating 仍一致");

const generated05 = {
  ...withAskedUsed,
  awarenessV3: {
    variant: "awareness-v3",
    sourceSig: "aware-sig",
    items: [
      { id: "a1", text: "我發現自己真正在等的是被接住。" },
      { id: "a2", text: "我看見自己說完之後會先把不舒服往身體收。" },
      { id: "a3", text: "我很在意這段關係，所以才會一直再說一次。" },
    ],
    selectedIds: [],
  },
};
assert(execReady(generated05), "F: 05 generated / selectedIds=[] → 06 仍依 V3 規則可工作");
generated05.awarenessV3.selectedIds = ["a1"];
assert(execReady(generated05), "G: 05 selected awareness → 06 enable");

const legacy = {
  date: "2026-01-01",
  journal: {
    insight: {
      guide: {
        rounds: [{ question: "今天最卡住的是什麼？", answer: "說了也沒用。" }],
      },
    },
  },
};
assert(reviewMerge.hasMeaningfulGuide(legacy.journal.insight.guide), "I: legacy review 仍算有 guide");
assert(reviewMerge.historyDeepThinkingView(legacy).kind === "guide", "I: legacy review 不 crash");

const sigBase = {
  thanksText: TODAY.thanksText,
  event: TODAY.event,
  mood: TODAY.mood,
  bodyMindText: TODAY.bodyMind.text,
  bodyMindInsight: TODAY.bodyMind.insight,
  bodyMindSupport: TODAY.bodyMind.support,
  coreQuote: CORE_QUOTE,
  thinkQuestions: QUESTIONS,
};
const polluted = {
  ...sigBase,
  retrieval: retrievalMeta(true),
  selectedPast: retrievalMeta(true).selectedPast,
  used: 1,
  score: 4,
  connectionType: "same-tension",
  extension: { rounds: [askedRound(retrievalMeta(true))] },
};
assert(reflectionV3.reflectionV3SourceSig(sigBase) === reflectionV3.reflectionV3SourceSig(polluted), "04 sourceSig 不含 retrieval metadata");
assert(awarenessV3.awarenessV3SourceSig(sigBase) === awarenessV3.awarenessV3SourceSig(polluted), "05 sourceSig 不含 retrieval metadata");
assert(executionV3.executionV3SourceSig(sigBase) === executionV3.executionV3SourceSig(polluted), "06 sourceSig 不含 retrieval metadata");

const awareFn = app.slice(app.indexOf("function awarenessV3Ready"), app.indexOf("function usesAwarenessV3Path"));
assert(!/extension|selectedPast|retrieval|completedExtension/.test(awareFn), "05 ready 不看 extension / retrieval");
const execFn = app.slice(app.indexOf("function executionV3Ready"), app.indexOf("function syncExecV3Cta"));
assert(execFn.includes("awarenessV3Ready") || execFn.includes("items.length"), "06 ready 跟 05，不另開 extension gate");
assert(!/completedExtensionCount|thinkExtensionCompleted/.test(execFn), "06 ready 不要求 extension");
const renderThink = app.slice(app.indexOf("function renderThinkV3"), app.indexOf("async function generateReflectionV3"));
assert(renderThink.includes("syncAwareV3Cta()"), "04 render 後重算 05 CTA");
assert(renderThink.includes("syncExecV3Cta()"), "04 render 後重算 06 CTA");
assert(app.includes("coreQuote: prevGuide.coreQuote"), "applyThinkExtension preserve coreQuote");
assert(app.includes("questions: prevGuide.questions"), "applyThinkExtension preserve questions");
assert(app.includes("sourceSig: prevGuide.sourceSig"), "applyThinkExtension preserve sourceSig");
assert(app.includes("delete next.retrieval"), "04 normalize 不把 retrieval 留在 guide root");

assert(html.includes("app.js?v=269"), "cache app.js");
assert(html.includes("lib/review-merge.js?v=24"), "cache review-merge");

console.log("reflection-flow-gating tests passed");
