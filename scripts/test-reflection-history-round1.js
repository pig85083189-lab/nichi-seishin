const fs = require("fs");
const path = require("path");
const reflectionExt = require("../lib/reflection-extension");
const retrieval = require("../lib/reflection-history-retrieval");
const reviewMerge = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const extSrc = fs.readFileSync(path.join(root, "lib/reflection-extension.js"), "utf8");

const TODAY = {
  thanksText: "還能坐下來說話",
  event: "和伴侶溝通，覺得自己一直說了也沒用。",
  mood: "無力",
  bodyMindText: "胸口悶，講完還是像沒被理解。",
  coreQuote: "表達過，不代表被接住。",
  thinkQuestions: [{ text: "你說了之後，真正在等的是什麼？" }],
};

function past(date, extra) {
  return {
    date,
    score: 4,
    connectionType: extra.connectionType,
    provenance: extra.provenance || { userRaw: true, userConfirmed: false, aiHypothesis: false },
    userRaw: extra.userRaw || {},
    confirmed: extra.confirmed || {},
    aiClue: extra.aiClue || "",
    ...extra,
  };
}

const CASES = {
  A: past("2026-07-12", {
    connectionType: "same-person",
    userRaw: { event: "和伴侶又談了一次，我講了很多遍，對方還是沒聽進去。", bodyMindText: "還是沒被理解。" },
  }),
  B: past("2026-06-03", {
    connectionType: "same-tension",
    userRaw: { event: "工作夥伴那邊，我已經講很多次，但還是沒有被理解。", bodyMindText: "說了也沒用。" },
  }),
  C: past("2026-05-20", {
    connectionType: "same-person",
    userRaw: { event: "和伴侶一起去北海道旅行，風景很好，整天都很開心。", bodyMindText: "晚餐很好吃。" },
  }),
  D: past("2026-03-08", {
    connectionType: "other-relevant",
    score: 3,
    provenance: { userRaw: false, userConfirmed: false, aiHypothesis: true },
    userRaw: {},
    aiClue: "你可能很在意選擇權。",
  }),
  E: past("2026-02-14", {
    connectionType: "same-tension",
    provenance: { userRaw: true, userConfirmed: true, aiHypothesis: false },
    userRaw: { event: "開會時我把想法講完了。" },
    confirmed: { awareness: ["我已經溝通了，但不代表對方真的理解。"] },
  }),
  F: past("2026-02-02", {
    connectionType: "same-situation",
    userRaw: { event: "家庭聚餐沒有要解釋什麼，整個人很安心。", bodyMindText: "沒有壓力，也很自在、被支持。" },
  }),
  G: past("2026-01-22", {
    connectionType: "prior-success",
    provenance: { userRaw: true, userConfirmed: true, aiHypothesis: false },
    userRaw: { event: "和伴侶溝通卡住時，我先停下來寫下自己真正想說的。" },
    confirmed: { selectedActions: ["先寫下自己要說的，而不是當場解釋"] },
  }),
};

assert(html.includes("app.js?v=277"), "cache app");
assert(!app.includes("正在搜尋你的歷史紀錄"), "loading 不暴露 retrieval");
assert(!app.includes("找到 3 筆歷史"), "一般 UI 不暴露 retrieval");
assert(app.includes("internal-retrieval-debug"), "internal 才顯示 retrieval 筆數");
assert(app.includes("reportInternalRetrievalDebug"), "internal console 有 retrieved/used");
assert(app.includes("[ING][retrieval]"), "console 不 dump 日記原文");
assert(app.includes("if (!live && !retrieval) return"), "retrieved 0 / used 0 仍顯示");
assert(!app.includes("if (!live && !refs.length) return"), "不再因 empty selectedPast 隱藏 retrieval 行");
assert(app.includes("ext.rounds.find((item) => item && item.retrieval) || current || ext.rounds[0]"), "完成 Round 1 後仍讀 rounds[0].retrieval");
assert(app.includes("isInternalMembership()) return") && app.includes("internal-retrieval-debug"), "normal user 看不到 retrieval 行");
assert(!app.includes("paintInternalExtensionDebug"), "不恢復 Extension Debug");
assert(reflectionExt.formatInternalRetrievalLine({
  retrieved: [{ date: "2026-07-12", connectionType: "same-tension" }, { date: "2026-05-20", connectionType: "same-person" }],
  used: [{ date: "2026-07-12", connectionType: "same-tension" }],
}).includes("retrieved 2 · used 1 · 2026-07-12 same-tension"), "debug 可判斷 used date");
assert(reflectionExt.formatInternalRetrievalLine({ retrieved: [], used: [] }).includes("retrieved 0 · used 0"), "無歷史 debug 為 0");
assert(!reflectionExt.formatInternalRetrievalLine({
  retrieved: [{ date: "2026-07-12", connectionType: "same-tension", userRaw: { event: "秘密日記不該出現" } }],
  used: [{ date: "2026-07-12", connectionType: "same-tension" }],
}).includes("秘密日記"), "debug 不含私人原文");
assert(app.includes("retrieval: remote && remote.retrieval"), "Round 1 persist snapshot");
assert(app.includes("reflectionExtensionSourceSig(collectJournal())"), "stale 仍依今天 01～04");
assert(!/sourceSig[\s\S]{0,80}selectedPast/.test(app), "history 新增不讓已生成 Round 1 stale");
assert(reviewJs.includes("loadReviews(user.id)"), "server 只讀自己的 reviews");
assert(reviewJs.includes("stripRound1HistorySpoof"), "不信 client 歷史");
assert(reviewJs.includes("attachRound1RelevantHistory"), "ask 才 retrieval");
assert(!extSrc.includes("Pinecone") && !reviewJs.includes("pgvector"), "不做 vector DB");
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("不要讀過往日期"), "deepConclusion 不接歷史");
assert(extSrc.includes("不要讀過往日期") || reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("第二輪：不要讀過往日期"), "Round 2 先不接歷史");

const withoutPrompt = reflectionExt.reflectionExtensionAskUserPrompt({ context: TODAY });
assert(withoutPrompt.includes("只讀今天"), "H｜無歷史時退化成 Phase 4A");
assert(!withoutPrompt.includes("相關過往"), "H｜無 usedPast 不出現歷史區塊");

const withA = reflectionExt.reflectionExtensionAskUserPrompt({ context: { ...TODAY, usedPast: [CASES.A] } });
assert(withA.includes("TODAY FIRST") || withA.includes("今天是主體"), "WITH 仍今天優先");
assert(withA.includes("2026-07-12"), "A 進 prompt");
assert(withA.includes("USER_RAW"), "只引用可信層");
assert(withA.includes("不要把三篇過往各問一題") || reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("不要把三篇過往各問一題"), "禁止散題");

const gatedA = reflectionExt.gateRound1Past(TODAY, [CASES.A, CASES.C, CASES.D]);
assert(gatedA.used.some((item) => item.date === "2026-07-12"), "A 有資訊價值");
assert(!gatedA.used.some((item) => item.date === "2026-05-20"), "C 同人物不同主題不用");
assert(!gatedA.used.some((item) => item.date === "2026-03-08"), "D 只有 AI hypothesis 不用");

const gatedB = reflectionExt.gateRound1Past(TODAY, [CASES.B]);
assert(gatedB.used.some((item) => item.date === "2026-06-03"), "B 不同人物同 tension 可用");

const gatedE = reflectionExt.gateRound1Past(TODAY, [CASES.E]);
assert(gatedE.used.some((item) => item.date === "2026-02-14"), "E USER_CONFIRMED 可用");

const positiveToday = {
  thanksText: "家人在",
  event: "和家人相處沒有壓力，覺得很自在、被支持。",
  mood: "暖",
  bodyMindText: "整個人很安心。",
};
const gatedF = reflectionExt.gateRound1Past(positiveToday, [CASES.F, CASES.A]);
assert(gatedF.used.some((item) => item.date === "2026-02-02"), "F positive 可用");

const gatedG = reflectionExt.gateRound1Past(TODAY, [CASES.G]);
assert(gatedG.used.some((item) => item.date === "2026-01-22"), "G prior action 可當線索");
assert(reflectionExt.formatRound1PastBlock(gatedG.used).includes("不是完成證據"), "G 不宣稱有效");

const gatedH = reflectionExt.gateRound1Past(TODAY, []);
assert(gatedH.used.length === 0, "H 無相關 past → 0");

const gatedI = reflectionExt.gateRound1Past(TODAY, [CASES.A]);
assert(gatedI.used.length === 1, "I 只有 1 筆就用 1 筆");

const gatedJ = reflectionExt.gateRound1Past(TODAY, [CASES.A, CASES.B, CASES.E]);
assert(gatedJ.used.length === 3, "J 三筆都有價值可以都過 gate");

const gatedK = reflectionExt.gateRound1Past(TODAY, [CASES.A, CASES.C, CASES.D]);
assert(gatedK.used.length === 1 && gatedK.used[0].date === "2026-07-12", "K 3 筆只實際用 1 筆");

const denyToday = { ...TODAY, event: "今天加班把報告寫完。這不是選擇權的問題。", bodyMindText: "就是累。" };
const gatedL = reflectionExt.gateRound1Past(denyToday, [CASES.D]);
assert(gatedL.used.length === 0, "L 今天否定 past AI 時不用");

const persisted = reflectionExt.persistableRound1Retrieval("sig-a", gatedK);
assert(persisted.sourceSig === "sig-a", "persist sourceSig");
assert(persisted.selectedPast.every((item) => item.date && item.provenance), "只存 reference");
assert(persisted.selectedPast.find((item) => item.date === "2026-07-12").used === true, "標記 whetherUsed");
assert(persisted.selectedPast.find((item) => item.date === "2026-05-20").used === false, "未用的也只留 metadata");
assert(reviewMerge.normalizeReflectionExtension({
  rounds: [{ id: "ext1", questions: [{ id: "eq1", text: "一？" }, { id: "eq2", text: "二？" }, { id: "eq3", text: "三？" }], retrieval: persisted }],
}).rounds[0].retrieval.sourceSig === "sig-a", "merge 保留 retrieval，Round 2 不 crash");

assert(reflectionExt.isRound1Ask({ context: { variant: "reflection-extension-v1", step: "ask" } }), "無 prior 是 Round 1");
assert(!reflectionExt.isRound1Ask({ context: { variant: "reflection-extension-v1", step: "ask", priorRound: { answer: "我已經寫下真正想到的答案了。" } } }), "有回答是 Round 2");
assert(!reflectionExt.isRound1Ask({ context: { variant: "reflection-extension-v1", step: "close" } }), "close 不是 Round 1");

const goodWith = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "表達過與被改變不是同一件事",
    questions: [
      { id: "eq1", text: "當你覺得自己已經說清楚時，你期待的是對方理解，還是對方因此改變？" },
      { id: "eq2", text: "如果對方理解了但仍不改，你真正卡住的會變成什麼？" },
      { id: "eq3", text: "這兩件事被放在一起時，對你來說哪一件比較難以放下？" },
    ],
  },
  { context: { ...TODAY, usedPast: [CASES.A] } }
);
assert(goodWith.ok, `好的 WITH 題應通過：${goodWith.issues.join(",")}`);

const claim = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "你一直很在意被理解",
    questions: [
      { id: "eq1", text: "你是不是一直都很在意被理解？" },
      { id: "eq2", text: "你總是在重複同樣的溝通模式嗎？" },
      { id: "eq3", text: "你之前就曾經因為這件事很難過嗎？" },
    ],
  },
  { context: { ...TODAY, usedPast: [CASES.A] } }
);
assert(claim.issues.includes("pattern-claim"), "pattern claim 必須 FAIL");
assert(claim.issues.includes("false-memory"), "false memory 必須 FAIL");

const withoutQ = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "說清楚與對方改變被放在一起",
    questions: [
      { id: "eq1", text: "你覺得自己已經表達完時，真正難以放下的是沒被聽懂，還是沒看到改變？" },
      { id: "eq2", text: "如果對方聽懂了、但做法仍一樣，你還會不會覺得這次溝通白費？" },
      { id: "eq3", text: "這兩件事被當成同一件事時，對你來說哪一邊比較重？" },
    ],
  },
  { context: TODAY }
);
assert(withoutQ.ok, `WITHOUT 仍應維持 4A 品質：${withoutQ.issues.join(",")}`);

const report = [
  ["A", "同一人物＋同 tension", true, withA.includes("2026-07-12")],
  ["B", "不同人物＋same tension", true, gatedB.used.length === 1],
  ["C", "同人物不同主題", false, gatedA.used.every((item) => item.date !== "2026-05-20")],
  ["D", "只有 AI hypothesis", false, gatedA.used.every((item) => item.date !== "2026-03-08")],
  ["E", "USER_CONFIRMED", true, gatedE.used.length === 1],
  ["F", "positive", true, gatedF.used.some((item) => item.date === "2026-02-02")],
  ["G", "prior action 不宣稱有效", true, gatedG.used.length === 1],
  ["H", "無相關 past", false, withoutPrompt.includes("只讀今天")],
  ["I", "1 筆 strong", true, gatedI.used.length === 1],
  ["J", "3 筆 strong 可過 gate", true, gatedJ.used.length === 3],
  ["K", "3 筆只使用 1 筆", true, gatedK.used.length === 1],
  ["L", "today 否定 past AI", false, gatedL.used.length === 0],
];

console.log("reflection-history-round1 WITH vs WITHOUT");
report.forEach((row) => {
  console.log(`  ${row[0]} ${row[1]} → ${row[2] ? "WITH 可用" : "不該用"} ${row[3] ? "ok" : "FAIL"}`);
  assert(row[3], `case ${row[0]}`);
});

assert(retrieval.snippetsForSelectedPast, "snippets helper 不改 scoring core");
console.log("reflection-history-round1 tests passed");
