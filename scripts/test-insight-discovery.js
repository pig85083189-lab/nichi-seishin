const insightDiscovery = require("../lib/insight-discovery");
const reflectionV3 = require("../lib/reflection-v3");
const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
assert(review.includes("runDiscoveryPipeline"), "review hosts discovery engine");
assert(!review.includes("api/insight-lab.js"), "no extra lab function");
assert(app.includes("thinkGuideIsSilence"), "05/06 silence gate");
assert(html.includes("今天有什麼是你可能還沒看見的"), "04 copy");

const baby = insightDiscovery.QUALITY_FIXTURES.A;
const known = insightDiscovery.buildKnownByUser(insightDiscovery.trustRaw(baby.raw));
assert(known.some((item) => /幸福/.test(item.text)), "KNOWN locks stated happiness");
assert(known.some((item) => /聊/.test(item.text)), "KNOWN locks more talk");
assert(known.some((item) => item.kind === "link"), "KNOWN locks user-made link");
assert(!JSON.stringify(known).includes("選擇權"), "03 AI never enters KNOWN");

const poisoned = insightDiscovery.trustRaw({
  ...baby.raw,
  bodyMindInsight: "你需要親密感",
  bodyMindSupport: "允許自己被愛",
});
assert(!poisoned.bodyMindInsight && !insightDiscovery.buildKnownByUser(poisoned).some((item) => /親密感/.test(item.text)), "03 AI is not FACT");

const fixtureResults = {};

function mark(id, pass, detail) {
  fixtureResults[id] = { pass, detail };
  assert(pass, `${id}: ${detail}`);
}

const aBads = baby.bad.map((line) => ({ line, ...insightDiscovery.evaluateBadStatement(line, baby.raw) }));
mark("A", aBads.every((row) => row.drop), `BAD dropped ${aBads.filter((row) => row.drop).length}/${aBads.length}: ${aBads.map((row) => `${row.line}=${row.drop}`).join("; ")}`);

(async () => {
  const silenceAi = async () => ({ candidates: [] });
  const b = await insightDiscovery.runDiscoveryPipeline({
    ctx: insightDiscovery.QUALITY_FIXTURES.B.raw,
    callAi: silenceAi,
  });
  mark("B", b.status === "silence" && !b.discovery, `status=${b.status}`);

  const c = await insightDiscovery.runDiscoveryPipeline({
    ctx: insightDiscovery.QUALITY_FIXTURES.C.raw,
    callAi: async () => ({
      candidates: [
        {
          id: "neg",
          type: "BLIND_SPOT",
          statement: "你其實害怕失去這段關係。",
          evidence: ["吃飯"],
          newInformation: "恐懼",
          whyItMatters: "依賴",
          confidence: "high",
        },
      ],
    }),
  });
  mark("C", c.status === "silence" && !c.discovery && !/恐懼|依賴|害怕失去/.test(JSON.stringify(c.discovery || {})), `status=${c.status}`);

  const contrastRaw = insightDiscovery.QUALITY_FIXTURES.D.raw;
  const d = await insightDiscovery.runDiscoveryPipeline({
    ctx: contrastRaw,
    callAi: async (messages, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "d1",
              type: "CONTRAST",
              statement: "你說家人最重要，但這幾天家人傳訊過來，你都已讀不回。",
              evidence: ["我一直跟自己說家人最重要", "家人傳訊過來我都已讀不回"],
              newInformation: "說的價值和實際回訊對不上",
              whyItMatters: "值得看自己真正把時間給了什麼",
              confidence: "high",
            },
          ],
        };
      }
      if (stage === "challenge") return { items: [{ id: "d1", verdict: "KEEP", parrotLikely: false, failed: [], reason: "contrast" }] };
      if (stage === "write") {
        return {
          statement: "你說家人最重要，但這幾天家人傳訊時，你都已讀不回。",
          why: "嘴上的優先，和實際回訊的選擇，現在看起來不是同一件事。",
          question: null,
        };
      }
      throw new Error(stage);
    },
  });
  mark("D", d.status === "discovery" && d.discovery && d.discovery.type === "CONTRAST", `status=${d.status} type=${d.discovery && d.discovery.type}`);

  const eRaw = insightDiscovery.QUALITY_FIXTURES.E.raw;
  const eQ = insightDiscovery.questionGate(insightDiscovery.QUALITY_FIXTURES.E.answeredQuestion, insightDiscovery.trustRaw(eRaw), {
    statement: "當眾被打斷時，你立刻知道那是不被尊重。",
    newInformation: "原因已經被你自己命名",
  });
  const e = await insightDiscovery.runDiscoveryPipeline({
    ctx: eRaw,
    callAi: async (messages, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "e1",
              type: "CONNECTION",
              statement: "當眾被打斷時，你自己已經把怒氣連到不被尊重。",
              evidence: ["我生氣是因為他當眾打斷我", "就是不被尊重"],
              newInformation: "怒氣的原因已被你命名，不是待解謎題",
              whyItMatters: "再問為什麼生氣，只是把你寫過的話再問一次",
              confidence: "high",
              question: "你為什麼生氣？",
            },
          ],
        };
      }
      if (stage === "challenge") return { items: [{ id: "e1", verdict: "KEEP", parrotLikely: false, failed: [], reason: "ok" }] };
      return { statement: "當眾被打斷時，你自己已經把怒氣連到不被尊重。", why: "原因你寫出來了。", question: "你為什麼生氣？" };
    },
  });
  mark("E", eQ == null && (!e.discovery || e.discovery.question == null), `gate=${eQ} status=${e.status} q=${e.discovery && e.discovery.question}`);

  const fRows = insightDiscovery.QUALITY_FIXTURES.F.pairs.map((pair) => ({
    statement: pair.statement,
    ...insightDiscovery.evaluateBadStatement(pair.statement, pair.raw),
  }));
  mark("F", fRows.every((row) => row.drop), fRows.map((row) => `${row.statement}=${row.drop}`).join("; "));

  let calls = 0;
  const empty = await insightDiscovery.runDiscoveryPipeline({
    ctx: baby.raw,
    callAi: async () => {
      calls += 1;
      return { candidates: [] };
    },
  });
  assert(empty.status === "silence", "0 candidates → silence");
  assert(calls === 1, `0 pass must not retry, calls=${calls}`);

  const pattern = insightDiscovery.deterministicChallenge(
    {
      id: "p1",
      type: "PATTERN",
      statement: "你總是在累的時候還繼續工作。",
      evidence: ["想睡"],
      newInformation: "長期模式",
      whyItMatters: "你一直都是這樣",
      confidence: "high",
    },
    known,
    insightDiscovery.trustRaw(baby.raw),
    {}
  );
  assert(!pattern.ok && pattern.failed.includes("history-type"), "no history → no PATTERN");

  const sig = reflectionV3.reflectionV3SourceSig({ ...baby.raw, bodyMindInsight: "AI 假設" });
  assert(!sig.includes("AI 假設"), "04 sourceSig is USER RAW only");

  console.log("insight discovery fixtures", JSON.stringify(fixtureResults));
  console.log("insight discovery tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
