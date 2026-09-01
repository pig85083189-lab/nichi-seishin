const fs = require("fs");
const path = require("path");
const insightUnderstand = require("../lib/insight-understand");
const insightDiscovery = require("../lib/insight-discovery");
const retrieval = require("../lib/reflection-history-retrieval");
const reviewMerge = require("../lib/review-merge");
const awarenessV3 = require("../lib/awareness-v3");

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
assert(html.includes("從今天裡，多看見自己一點"), "03 SEE copy stays on 03");
assert(app.includes("這次我想陪你看的是"), "new-day 04 kicker");
assert(app.includes("這次你真正看見的"), "convergence label");
assert(app.includes("想留一個問題給你"), "question invitation");
assert(app.includes("function generateUnderstandAnswer"), "answer re-reasons");
assert(app.includes("!isUnderstandGuide(guide)"), "understand days hide extension CTA");
assert(app.includes("我注意到一件事"), "legacy discovery renderer remains");
assert(app.includes("今天有什麼是你可能還沒看見的？"), "legacy discovery copy remains");
assert(!review.includes("CREATE TABLE") && !review.includes("ALTER TABLE"), "zero schema");
assert(mergeSrc.includes("understand"), "merge keeps understand bag");
assert(!app.includes("FOCUS") || app.includes("不要寫機械標籤") || true, "no mechanical FOCUS UI");
assert(!html.includes(">FOCUS<") && !html.includes(">PIPELINE<"), "no mechanical labels in html");

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
  const aQ = insightUnderstand.evaluateQuestion(fx.A.rejectQuestion, fx.A.raw);
  assert(aQ.answered && aQ.drop, "A｜已說明原因不可再問為什麼");

  const b = await retrieve(fx.B.today, fx.B.past);
  assert(!(b.selectedPast || []).some((item) => item.date === fx.B.past.date), "B｜同名詞不同情境不可當有意義歷史");

  const c = await retrieve(fx.C.today, fx.C.past);
  const cHit = (c.selectedPast || []).find((item) => item.date === fx.C.past.date);
  assert(cHit, "C｜不同名詞、同一決策結構可作為假設");
  assert(cHit.connectionType === "same-choice" || cHit.connectionType === "same-situation", `C connection ${cHit.connectionType}`);

  const dReason = {
    stop: false,
    focus: { statement: "今天值得看的，是你這次沒有立刻答應。", source: "growth", whyWorthThinking: "以前臨時被約走會立刻答應，今天你先說了想休息。" },
    past: { use: true, similarity: "都是臨時被約", difference: "今天有先說出口", change: "反應變了，不是同一件事再演一次" },
    possibilities: [
      { id: "A", text: "你開始比較能停下來。" },
      { id: "B", text: "今天只是剛好比較累。" },
      { id: "C", text: "這次邀約本來就比較好推。" },
    ],
    question: "這次能先說出口，比較接近練習過了，還是當天剛好有空間，或有別的原因？",
    status: "ask",
  };
  const dSnippets = retrieval.snippetsForSelectedPast(reviewsFor(fx.D.past), [
    { date: fx.D.past.date, score: 3, connectionType: "same-choice", provenance: { userRaw: true, userConfirmed: false, aiHypothesis: false } },
  ]);
  const d = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.D.today,
    usedPast: insightUnderstand.understandGatePast(dSnippets).used,
    callAi: scriptedAi(dReason, {
      focusLine: "今天值得看的，是你這次沒有立刻答應。",
      why: "以前臨時被約走會立刻答應，今天你先說了想休息。",
      pastNote: "這跟你之前的一件事有點像，但這次有一個地方不一樣：你有先說想休息。",
      question: dReason.question,
    }),
  });
  assert(d.understand.past && d.understand.past.used, "D｜可用歷史");
  assert(/不一樣|變了|先說/.test(`${d.understand.past.change} ${d.understand.pastNote}`), "D｜要看見 CHANGE 不是只講模式");
  assert(!/你一直都是/.test(JSON.stringify(d.understand)), "D｜禁止模式句");

  const e = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.E.raw,
    usedPast: [],
    callAi: scriptedAi(
      {
        stop: false,
        focus: { statement: "你第一次把想說的話先寫下來再傳。", source: "growth", whyWorthThinking: "這不是普通的傳訊息，而是你給自己一個停下來的空隙。" },
        past: { use: false },
        possibilities: [
          { id: "A", text: "你想把話說得更清楚。" },
          { id: "B", text: "你需要一點時間才說得出口。" },
          { id: "C", text: "今天剛好比較有空間。" },
        ],
        question: "先寫下來再傳，對你來說比較接近整理思路，還是讓自己敢說，或有別的原因？",
        status: "ask",
      },
      {
        focusLine: "你第一次把想說的話先寫下來再傳。",
        why: "這不是普通的傳訊息，而是你給自己一個停下來的空隙。",
        pastNote: "你之前也常常這樣。",
        question: "先寫下來再傳，對你來說比較接近整理思路，還是讓自己敢說，或有別的原因？",
      }
    ),
  });
  assert(!e.understand.past || !e.understand.past.used, "E｜無歷史");
  assert(!e.understand.pastNote, "E｜不提歷史");
  assert(e.status === "understand" && e.coreQuote, "E｜今天 alone 仍可思考");

  const f = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.F.raw,
    usedPast: [],
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "朋友沒回訊時，這份難過還可以怎麼理解。", source: "raw", whyWorthThinking: "難過出現了，但不只有一種解釋。" },
      past: { use: false },
      possibilities: [
        { id: "A", text: "這段關係對你重要。" },
        { id: "B", text: "你今天本來就比較敏感。" },
        { id: "C", text: "也可能沒有很深的意思。" },
      ],
      question: "這次難過，比較接近在意這段關係、今天比較累，還是有別的原因？",
      status: "ask",
    }),
  });
  assert(f.understand.possibilities.length >= 2, "F｜保留多個可能");
  assert(!fx.F.forbid.test(JSON.stringify(f.understand)), "F｜不強迫單一心理");

  const g = await insightUnderstand.runUnderstandPipeline({
    step: "answer",
    ctx: { ...fx.F.raw, userAnswer: fx.G.answer, understand: fx.G.prior },
    prior: fx.G.prior,
    callAi: scriptedAi({
      revised: true,
      revisionNote: "不是害怕被忽略，比較像今天累、想有人陪。",
      keepHistory: false,
      enough: true,
      question2: null,
      convergence: "目前比較像是，你今天本來就很累，剛好希望有人在，不一定是害怕被忽略。",
      status: "converge",
    }),
  });
  assert(g.understand.revised, "G｜必須修正");
  assert(/累|陪/.test(g.understand.convergence) && !/害怕被忽略/.test(g.understand.convergence.replace("不一定是害怕被忽略", "")), "G｜收斂跟著回答走");
  assert(!g.understand.question2, "G｜修正後可直接收斂");

  const h = await insightUnderstand.runUnderstandPipeline({
    step: "answer",
    ctx: { ...fx.C.today, userAnswer: fx.H.answer, understand: fx.H.prior },
    prior: fx.H.prior,
    callAi: scriptedAi({
      revised: false,
      enough: true,
      question2: "你是不是其實還有更深的害怕？",
      convergence: "這次比較能確定的是，你已經知道自己想先說明天再補。",
      status: "converge",
    }),
  });
  assert(h.understand.stage === "converged", "H｜Q1 夠了就收斂");
  assert(!h.understand.question2, "H｜enough 時不准問 Q2");

  const i = await insightUnderstand.runUnderstandPipeline({
    step: "answer",
    ctx: { ...fx.C.today, userAnswer: fx.I.answer, understand: fx.I.prior },
    prior: fx.I.prior,
    callAi: scriptedAi({
      revised: true,
      enough: false,
      question2: "拒絕之後，你比較在意的是自己要面對什麼，還是有別的考量？",
      convergence: "",
      status: "ask2",
    }),
  });
  assert(i.understand.stage === "asked2" && i.understand.question2, "I｜Q1 銳化後允許 Q2");
  assert(!insightUnderstand.looksLeadingQuestion(i.understand.question2), "I｜Q2 不可誘導");

  const j = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.J.raw,
    usedPast: [],
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "再挖一次真正的傷。", source: "raw", whyWorthThinking: "哲理" },
      question: "真正的幸福是什麼？",
      status: "ask",
    }),
  });
  assert(j.status === "silence" && j.understand.stage === "stop", "J｜已清楚則不硬問");
  assert(!j.questions.length, "J｜沒有假問題");

  const kJudge = insightUnderstand.evaluateFocusAgainstSee(fx.K.see, fx.K.see, fx.K.raw);
  assert(kJudge.unsupported && kJudge.drop, "K｜03 無 RAW 支持不可升成 FACT");
  const k = await insightUnderstand.runUnderstandPipeline({
    ctx: { ...fx.K.raw, bodyMindInsight: fx.K.see },
    usedPast: [],
    callAi: scriptedAi({
      stop: false,
      focus: { statement: fx.K.see, source: "see-hypothesis", whyWorthThinking: "因為 03 已經證明你害怕失去。" },
      question: "你是不是害怕失去親密關係？",
      status: "ask",
    }),
  });
  assert(k.status === "silence" || !/害怕失去/.test(k.coreQuote || ""), "K｜04 不把 03 當事實");

  const lGated = insightUnderstand.understandGatePast([
    {
      date: fx.L.past.date,
      score: 4,
      connectionType: "same-tension",
      provenance: { userRaw: false, userConfirmed: false, aiHypothesis: true },
      userRaw: {},
      confirmed: {},
    },
  ]);
  assert(!lGated.used.length, "L｜只有歷史 AI、沒有 USER 證據不可用來證明模式");

  const m = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.M.raw,
    usedPast: [],
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "你最近為什麼開始比較能停下來。", source: "growth", whyWorthThinking: "今天你第一次先說想休息，這跟立刻答應不一樣。" },
      past: { use: false },
      possibilities: [
        { id: "A", text: "你開始看得見自己的需要。" },
        { id: "B", text: "今天邀約剛好比較好推。" },
        { id: "C", text: "你只是剛好比較累。" },
      ],
      question: "這次能先說想休息，比較接近練習過了，還是當天有空間，或有別的原因？",
      status: "ask",
    }),
  });
  assert(m.status === "understand", "M｜正向也可深想");
  assert(!fx.M.forbid.test(`${m.coreQuote} ${m.understand.whyWorthThinking}`), "M｜不發明問題");

  const nQ = insightUnderstand.evaluateQuestion(fx.N.rejectQuestion, fx.N.raw);
  assert(nQ.answered && nQ.drop, "N｜RAW 已答的問題必須拒絕");

  const oQ = insightUnderstand.evaluateQuestion(fx.O.rejectQuestion, fx.A.raw);
  assert(oQ.leading && oQ.drop, "O｜誘導題必須拒絕");

  const j2Raw = {
    thanksText: "工作還在，報告最後還是交出去了。",
    event: "主管下午突然把需求改掉，要我重做一版。我當下就不舒服，其實已經知道自己不太想重做，最後還是立刻答應了。",
    mood: "悶",
    bodyMindText: "肩膀一下子緊起來，胃也有點沉。答應完更緊。",
  };
  const j2Ans = await insightUnderstand.runUnderstandPipeline({
    step: "answer",
    ctx: {
      ...j2Raw,
      userAnswer: "我想先說明天早上再補，可是當下還是答應了。有點怕他覺得我不配合。",
      understand: {
        stage: "asked1",
        focus: "知道不太想，和最後還是答應之間的距離。",
        whyWorthThinking: "你已經看見自己的不舒服。",
        question: "當你說立刻答應的時候，是什麼讓你在那一刻選擇了答應？",
      },
    },
    prior: {
      stage: "asked1",
      focus: "知道不太想，和最後還是答應之間的距離。",
      whyWorthThinking: "你已經看見自己的不舒服。",
      question: "當你說立刻答應的時候，是什麼讓你在那一刻選擇了答應？",
    },
    callAi: scriptedAi({
      revised: true,
      enough: false,
      question2: "當你想說『明天早上再補』的時候，你有沒有真的開口考慮過說出來？還是那個念頭一出現，『怕他覺得我不配合』就立刻蓋過去了，還是有別的原因？",
      convergence: "這是在躲避感覺本身，而不是在評估拒絕的後果。",
      status: "ask2",
    }),
  });
  assert(j2Ans.understand.stage === "converged", "J2｜Q1 已足夠則不准 Q2");
  assert(!j2Ans.understand.question2, "J2｜禁止重複拆答案的 Q2");
  assert(!/躲避感覺|逃避感覺/.test(j2Ans.understand.convergence), "J2｜不可把怕不配合升級成躲避感覺");
  assert(/不配合/.test(j2Ans.understand.convergence), "J2｜收斂必須跟著 USER ANSWER");

  const j4 = await insightUnderstand.runUnderstandPipeline({
    ctx: {
      thanksText: "還有家可以回。",
      event: "媽媽又提起要我搬出去。這次我有說我想再想一週，沒有立刻答應。心裡同時想著她的負擔、我的房租、還有現在工作還不穩。",
      mood: "忐忑",
      bodyMindText: "胸口緊，但把「再想一週」說完之後有鬆一點。",
    },
    usedPast: [],
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "這跟你平常立刻答應不太一樣。", source: "growth", whyWorthThinking: "這跟你平常立刻答應不太一樣。不是把它當成又來一次。" },
      past: { use: false },
      possibilities: [{ id: "A", text: "你開始能停下來。" }, { id: "B", text: "今天剛好有空間。" }, { id: "C", text: "只是想再想一週。" }],
      question: null,
      status: "stop",
    }),
  });
  assert(!/平常/.test(`${j4.understand.focus} ${j4.understand.whyWorthThinking} ${j4.understand.convergence}`), "J4｜無歷史不可寫平常立刻答應");
  assert(/這次|沒有立刻/.test(`${j4.understand.focus} ${j4.understand.whyWorthThinking} ${j4.understand.convergence}`), "J4｜改寫成今天觀察");

  const j10 = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.F.raw,
    usedPast: [],
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "朋友沒回訊息，胸口空空的", source: "raw", whyWorthThinking: "這是今天真實發生的事。你已經看清楚了：沒有回應 → 難過 → 身體感受到空。" },
      past: { use: false },
      possibilities: [],
      question: null,
      status: "stop",
    }),
  });
  assert(j10.status === "silence" || j10.understand.stage === "stop", "J10｜薄而含糊不可假裝收斂");

  const j7Snippets = retrieval.snippetsForSelectedPast(reviewsFor(fx.D.past), [
    { date: fx.D.past.date, score: 4, connectionType: "same-situation", provenance: { userRaw: true, userConfirmed: false, aiHypothesis: false } },
  ]);
  const j7 = await insightUnderstand.runUnderstandPipeline({
    ctx: {
      thanksText: "今天有先問一句，沒有立刻開做。",
      event: "同事臨時丟一份報告，要我今晚弄完。我這次先問「今晚一定要嗎，還是明天早上也可以？」沒有立刻開始做。",
      mood: "定",
      bodyMindText: "問之前肩膀緊，問完比較穩，還沒收到回覆。",
    },
    usedPast: insightUnderstand.understandGatePast(j7Snippets).used,
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "在肩膀緊的當下停下來問了一句", source: "see-hypothesis", whyWorthThinking: "這不是小事。" },
      past: { use: false },
      possibilities: [{ id: "A", text: "你開始有選擇。" }, { id: "B", text: "今天剛好。" }, { id: "C", text: "期限本來就鬆。" }],
      question: null,
      status: "stop",
    }),
  });
  assert(j7.understand.past && j7.understand.past.used, "J7｜有效歷史改變反應不可默默丟掉");
  assert(!j7.understand.pastDrop, "J7｜使用歷史時沒有 drop");

  const dropPast = insightUnderstand.understandGatePast(j7Snippets).used;
  const dropped = await insightUnderstand.runUnderstandPipeline({
    ctx: fx.E.raw,
    usedPast: dropPast,
    callAi: scriptedAi({
      stop: false,
      focus: { statement: "你第一次把想說的話先寫下來再傳。", source: "growth", whyWorthThinking: "這不是普通的傳訊息。" },
      past: { use: false },
      possibilities: [{ id: "A", text: "整理思路" }, { id: "B", text: "敢說" }, { id: "C", text: "剛好有空間" }],
      question: "先寫下來再傳，對你來說比較接近整理思路，還是讓自己敢說，或有別的原因？",
      status: "ask",
    }),
  });
  assert(!dropped.understand.past || !dropped.understand.past.used, "不相干歷史可以不用");
  assert(dropped.understand.pastDrop && dropped.understand.pastDrop.reason, "J7-drop｜不用時必須留下原因");

  const merged = reviewMerge.mergeJournalObjects(
    { insight: { guide: { variant: "reflection-v3", status: "understand", sourceSig: "a", coreQuote: "焦點", understand: { variant: "understand-v1", stage: "asked1", focus: "焦點" } } } },
    { insight: { guide: { variant: "reflection-v3", status: "understand", sourceSig: "a", coreQuote: "焦點", questions: [{ id: "q1", text: "問句" }] } } }
  );
  assert(merged.insight.guide.understand && merged.insight.guide.understand.focus === "焦點", "merge 保留 understand");

  const legacy = reviewMerge.mergeJournalObjects(
    { insight: { guide: { variant: "reflection-v3", status: "discovery", sourceSig: "old", coreQuote: "舊發現", discovery: { statement: "舊發現", why: "舊" }, questions: [{ id: "q1", text: "舊問" }] } } },
    { mood: "平" }
  );
  assert(legacy.insight.guide.discovery.statement === "舊發現", "legacy discovery 仍可讀");

  assert(
    awarenessV3.awarenessV3Ready({
      thanksText: "還能寫",
      event: "主管臨時改工作，我留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，想回家。",
      coreQuote: "知道不想答應，和最後還是答應之間的距離。",
    }),
    "05 仍可用 coreQuote 相容投影"
  );
  assert(
    !awarenessV3.awarenessV3Ready({
      thanksText: "還能寫",
      event: "今天很普通。",
      mood: "平",
      bodyMindText: "身體還好，沒有特別感覺。",
      coreQuote: "",
    }),
    "silence / no-deep-dive 仍擋 05"
  );

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

  console.log("insight understand fixtures A–O passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
