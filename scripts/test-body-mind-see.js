const fs = require("fs");
const path = require("path");
const bodyMind = require("../lib/body-mind");
const bodyMindSee = require("../lib/body-mind-see");
const insightDiscovery = require("../lib/insight-discovery");
const { mergeBodyMind, mergeJournalObjects } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const discoverySrc = fs.readFileSync(path.join(root, "lib/insight-discovery.js"), "utf8");

assert(review.includes("runSeePipeline"), "API 03 uses SEE pipeline");
assert(review.includes("runDiscoveryPipeline"), "04 discovery not removed");
assert(html.includes("今天有什麼是你可能還沒看見的"), "04 copy unchanged");
assert(html.includes("從今天裡，多看見自己一點"), "03 SEE CTA");
assert(!html.includes("這個瞬間在提醒我什麼"), "retired 03 framing");
assert(!discoverySrc.includes("bodyMind.insight") && !discoverySrc.includes("bodyMindInsight"), "trustRaw never reads 03 AI");
assert(insightDiscovery.trustRaw({ bodyMindInsight: "你需要親密感", bodyMindText: "胸口悶" }).bodyMindText.includes("胸口悶"), "03 RAW still trusted");
assert(!insightDiscovery.trustRaw({ bodyMindInsight: "你需要親密感", bodyMindText: "胸口悶" }).bodyMindInsight, "03 AI not in trustRaw");

const fx = bodyMindSee.QUALITY_FIXTURES;

const judgedA = bodyMindSee.evaluateSeeCandidate(fx.A.candidate, fx.A.ctx);
assert(judgedA.drop, `A must not parrot: ${judgedA.failed.join(",")}`);

const judgedB = bodyMindSee.evaluateSeeCandidate(fx.B.candidate, fx.B.ctx);
assert(judgedB.keep, `B grounded connection may survive: ${judgedB.failed.join(",")}`);

const judgedC = bodyMindSee.evaluateSeeCandidate(fx.C.candidate, fx.C.ctx);
assert(judgedC.drop && judgedC.failed.includes("overreach"), `C no psych from body: ${judgedC.failed.join(",")}`);

const judgedD = bodyMindSee.evaluateSeeCandidate(fx.D.candidate, fx.D.ctx);
assert(judgedD.keep, `D positive common thread allowed: ${judgedD.failed.join(",")}`);

const judgedE = bodyMindSee.evaluateSeeCandidate(fx.E.candidate, fx.E.ctx);
assert(judgedE.drop, `E ordinary filler must drop: ${judgedE.failed.join(",")}`);

const judgedF = bodyMindSee.evaluateSeeCandidate(fx.F.candidate, fx.F.ctx);
assert(judgedF.drop, `F explicit cause cannot be rediscovered: ${judgedF.failed.join(",")}`);

const judgedG = bodyMindSee.evaluateSeeCandidate(fx.G.candidate, fx.G.ctx);
assert(judgedG.keep, `G unrecognized strength may surface: ${judgedG.failed.join(",")}`);

const judgedHdir = bodyMindSee.evaluateSeeCandidate(fx.H.direction, fx.H.ctx);
assert(judgedHdir.keep, `H direction may survive: ${judgedHdir.failed.join(",")}`);
assert(!bodyMindSee.seeLooksActionChecklist(fx.H.direction.statement), "H direction is not a checklist");

const judgedHchk = bodyMindSee.evaluateSeeCandidate(fx.H.checklist, fx.H.ctx);
assert(judgedHchk.drop, `H checklist must fail: ${judgedHchk.failed.join(",")}`);
assert(bodyMindSee.seeLooksActionChecklist(`${fx.H.checklist.statement} ${fx.H.checklist.whyItMatters}`), "H checklist detected");

const judgedI = bodyMindSee.evaluateSeeCandidate(fx.I.candidate, fx.I.ctx);
assert(judgedI.drop, `I overpsych must fail: ${judgedI.failed.join(",")}`);
assert(bodyMindSee.seeLooksOverreach(fx.I.candidate.statement, fx.I.candidate.whyItMatters), "I labels are overreach");

["創傷", "依附", "討好", "潛意識", "people pleasing", "害怕失去"].forEach((label) => {
  assert(
    bodyMindSee.seeLooksOverreach(`這是你的${label}`, "自我價值不夠"),
    `overreach catches ${label}`
  );
});

const mergedMeta = mergeBodyMind(
  { text: "胸口悶", insight: "舊觀察。", support: "舊說明。", seeType: "CONTRAST", evidence: ["胸口悶"], confidence: "medium", status: "observation" },
  { text: "胸口悶", insight: "舊觀察。", support: "舊說明。" }
);
assert(mergedMeta.seeType === "CONTRAST", "merge keeps seeType");
assert(mergedMeta.evidence[0] === "胸口悶", "merge keeps evidence");
assert(mergedMeta.confidence === "medium", "merge keeps confidence");
assert(mergedMeta.status === "observation", "merge keeps status");

const legacy = bodyMind.normalizeBodyMind({ text: "胸口悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。" });
assert(legacy.insight.includes("關係位置"), "legacy bag still normalizes");
assert(legacy.status === "" && legacy.seeType === "" && Array.isArray(legacy.evidence), "legacy optional fields default empty");
assert(bodyMind.hasBodyMindResult(legacy), "legacy result still counts");

const silent = bodyMindSee.projectSeeOutput({ status: "silence" });
assert(silent.insight === bodyMind.SEE_SILENCE_COPY.insight, "silence insight");
assert(silent.support === bodyMind.SEE_SILENCE_COPY.support, "silence support");
assert(bodyMind.hasBodyMindResult(silent), "silence is a valid stored result");
assert(bodyMind.evaluateBodyMindQuality(silent).ok, "silence quality ok");

const journalMerged = mergeJournalObjects(
  { bodyMind: { text: "舊原文", insight: "舊看見。", support: "舊說明。", seeType: "ENERGY_SOURCE", evidence: ["電話"], confidence: "high", status: "observation" } },
  { bodyMind: { text: "", insight: "", support: "" } }
);
assert(journalMerged.bodyMind.seeType === "ENERGY_SOURCE", "empty cloud bag does not strip metadata");
assert(journalMerged.bodyMind.insight === "舊看見。", "legacy insight remains");

assert(app.includes("if (options.auto) return"), "no generation while typing / autosave");
assert(app.includes("hasBodyMindResult(journal.bodyMind) && journal.bodyMind.sig === sig"), "same sourceSig does not re-call");
assert(app.includes("內容有修改，重新看看"), "source change marks stale");
assert(app.includes("if (isCurrentJournalArchived() || state.bodyMindBusy) return"), "completed review cannot regenerate");
assert(app.includes("persistArchivedUserMarks"), "userMarks remain");
assert(app.includes("bodyMind.insight") && app.includes("bodyMind.support"), "markable 03 fields remain");
assert(app.includes("remote.seeType") && app.includes("remote.evidence") && app.includes("remote.confidence"), "client persists optional metadata");
assert(!review.includes("ALTER TABLE") && !review.includes("CREATE TABLE"), "no schema");

(async () => {
  const writerLocked = await bodyMindSee.runSeePipeline({
    ctx: fx.G.ctx,
    callAi: async (messages, stage) => {
      if (stage === "reason") {
        return { candidates: [fx.G.candidate] };
      }
      if (stage === "challenge") {
        return { items: [{ id: "g1", verdict: "KEEP", parrotLikely: false, failed: [], reason: "core" }] };
      }
      return {
        insight: fx.G.candidate.statement,
        support: "不是停一下，而是潛意識正在用洗澡逃避你的依附創傷。",
      };
    },
  });
  assert(writerLocked.status === "observation", `J writer reject still keeps core: ${writerLocked.status}`);
  assert(!/潛意識|依附|創傷/.test(`${writerLocked.insight}${writerLocked.support}`), "J final output has no new psych meaning");
  assert(/停一下|手機/.test(writerLocked.insight), "J falls back to approved observation");

  const parroted = await bodyMindSee.runSeePipeline({
    ctx: fx.A.ctx,
    callAi: async (messages, stage) => {
      if (stage === "reason") return { candidates: [fx.A.candidate] };
      if (stage === "challenge") return { items: [{ id: "a1", verdict: "KEEP", parrotLikely: false, failed: [], reason: "keep" }] };
      return { insight: fx.A.candidate.statement, support: fx.A.candidate.whyItMatters };
    },
  });
  assert(parroted.status === "silence", `A pipeline silence not parrot: ${parroted.status} ${parroted.insight}`);

  const ordinary = await bodyMindSee.runSeePipeline({
    ctx: fx.E.ctx,
    callAi: async () => ({ candidates: [] }),
  });
  assert(ordinary.status === "silence", "E empty candidates is warm silence");
  assert(ordinary.insight === bodyMind.SEE_SILENCE_COPY.insight, "E uses product silence copy");

  const connected = await bodyMindSee.runSeePipeline({
    ctx: fx.B.ctx,
    callAi: async (messages, stage) => {
      if (stage === "reason") return { candidates: [fx.B.candidate] };
      if (stage === "challenge") {
        return {
          items: [{ id: "b1", verdict: "DROP", parrotLikely: true, failed: ["parrot"], reason: "A and B both exist" }],
        };
      }
      return { insight: fx.B.candidate.statement, support: fx.B.candidate.whyItMatters };
    },
  });
  assert(connected.status === "observation", `B co-occurrence must not force silence: ${connected.status}`);

  console.log("body-mind SEE fixtures A-J passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
