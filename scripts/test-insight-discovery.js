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
assert(fs.existsSync(path.join(root, "lib/insight-discovery.js")), "discovery engine file retained");
assert(!review.includes("api/insight-lab.js"), "no extra lab function");
assert(app.includes("thinkGuideIsSilence"), "05/06 silence gate");
assert(html.includes("這件事還可以怎麼理解"), "04 UNDERSTAND copy");

const baby = insightDiscovery.QUALITY_FIXTURES.A;
const known = insightDiscovery.buildKnownByUser(insightDiscovery.trustRaw(baby.raw));
assert(known.some((item) => /幸福/.test(item.text)), "KNOWN locks stated happiness");
assert(known.some((item) => /聊/.test(item.text)), "KNOWN locks more talk");
assert(!known.some((item) => item.kind === "link"), "Baby A co-occurrence is not a KNOWN link");
assert(!JSON.stringify(known).includes("同一段把對話與幸福"), "no fact-co-occurrence link");
assert(!JSON.stringify(known).includes("選擇權"), "03 AI never enters KNOWN");

const explicitRaw = insightDiscovery.trustRaw({
  thanksText: "跟 Baby 多聊天讓我覺得幸福。",
  event: "今天很開心。",
  mood: "開心",
  bodyMindText: "身體還好。",
});
const explicitKnown = insightDiscovery.buildKnownByUser(explicitRaw);
assert(explicitKnown.some((item) => item.kind === "link"), "explicit 讓我覺得 becomes KNOWN link");
assert(insightDiscovery.hasExplicitConnectionLanguage(explicitRaw.thanksText), "explicit connection language detected");

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

  const noteRaw = insightDiscovery.trustRaw({
    thanksText: "今天沒有一直滑手機，下午把抽屜清完了。",
    event: "清抽屜時找到去年寫給自己的紙條，上面寫「少一點證明給別人看」。我當下停了一下，後來把那張紙夾回手帳。晚上本來想再改一版履歷，最後沒改。",
    mood: "平靜",
    bodyMindText: "清東西的時候手很忙，但肩膀比這週前幾天鬆。",
  });
  const noteKnown = insightDiscovery.buildKnownByUser(noteRaw);
  assert(!noteKnown.some((item) => item.kind === "link"), "note × resume co-occurrence is not KNOWN connection");
  const noteDiscovery = "你下午剛重新看到「少一點證明給別人看」，晚上原本想再改履歷，最後卻停下來了。這兩件事放在一起看，值得注意。";
  assert(!insightDiscovery.parrotLikely(noteDiscovery, noteKnown, noteRaw), "juxtaposition is not parrot");
  assert(
    !insightDiscovery.looksExactKnown(noteDiscovery, noteKnown, noteRaw),
    "A and B in RAW does not make the relationship known"
  );
  assert(
    insightDiscovery.looksExactKnown("手在忙，但肩膀比這週前幾天鬆。", noteKnown, noteRaw),
    "user-written 但 contrast stays KNOWN"
  );

  const bowlRaw = insightDiscovery.trustRaw({
    thanksText: "至少今天把話講完了。",
    event: "我知道我生氣不是因為碗，是因為每次都要我先開口。",
    mood: "鬆一點",
    bodyMindText: "胸口沒那麼緊了。",
  });
  const bowlKnown = insightDiscovery.buildKnownByUser(bowlRaw);
  assert(bowlKnown.some((item) => item.kind === "link"), "explicit 不是因為／是因為 is KNOWN");
  const bowlRestate = insightDiscovery.evaluateBadStatement("你真正生氣的是每次都要你先開口。", bowlRaw);
  assert(bowlRestate.drop, "explicit-cause restatement still DROP");

  const bossRaw = insightDiscovery.trustRaw({
    thanksText: "還是有把報告交出去。",
    event: "主管當眾改了我的數字，我當下沒說話，下午一直在重做表。下班前他又說其實早上那版就可以。我回家後一直想他到底要怎樣。",
    mood: "悶",
    bodyMindText: "太陽穴一直跳，肩膀往耳朵縮。",
  });
  const bossKnown = insightDiscovery.buildKnownByUser(bossRaw);
  const bossOverreach = {
    id: "c1",
    type: "CONTRAST",
    statement: "主管的兩個指令完全相反，但妳的身體反應沒有隨著他的後半句其實可以而鬆開，身體已經進入無法預測他的警報狀態。",
    evidence: ["主管當眾改了我的數字", "下班前他又說其實早上那版就可以", "我回家後一直想他到底要怎樣"],
    newInformation: "身體沒有因為其實可以而解除警報",
    whyItMatters: "這暗示她進入了無法預測他的狀態",
    confidence: "high",
  };
  const salvagedBoss = insightDiscovery.salvageCore(bossOverreach, bossKnown, bossRaw, {});
  assert(salvagedBoss, "Case 02 addon overreach salvages core");
  assert(!/警報|無法預測|解除警報/.test(`${salvagedBoss.statement} ${salvagedBoss.whyItMatters}`), "salvage strips body-alarm addon");

  const writerCore = {
    statement: "你說工作是為了生活品質，但自願加班到十一點，也連續三次放同事鴿子。",
    whyItMatters: "嘴上的理由和實際把時間給誰，現在對不上。",
    newInformation: "價值說法與行為落差",
  };
  assert(
    insightDiscovery.writerIntroducesMeaning(writerCore, {
      statement: writerCore.statement,
      why: "這個落差本身在耗能。不是工作累，而是自我欺騙在消耗你。",
    }),
    "Writer 自我欺騙 is new meaning"
  );

  const writerLocked = await insightDiscovery.runDiscoveryPipeline({
    ctx: {
      thanksText: "我一直跟自己說這份工作是為了生活品質。",
      event: "又自願加班到十一點。同事傳訊約週末爬山，我回他下次一定去，但其實已經第三次這樣回了。",
      mood: "疲憊",
      bodyMindText: "眼睛乾，脖子硬。",
    },
    callAi: async (messages, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "w1",
              type: "CONTRAST",
              statement: "你說工作是為了生活品質，但自願加班到十一點，也連續三次放同事鴿子。",
              evidence: ["我一直跟自己說這份工作是為了生活品質", "又自願加班到十一點", "已經第三次這樣回了"],
              newInformation: "價值說法與行為落差",
              whyItMatters: "嘴上的理由和實際把時間給誰，現在對不上。",
              confidence: "high",
            },
          ],
        };
      }
      if (stage === "challenge") return { items: [{ id: "w1", verdict: "KEEP", parrotLikely: false, failed: [], reason: "core" }] };
      return {
        statement: "你說工作是為了生活品質，但行動在縮水生活品質。",
        why: "不是工作累，而是自我欺騙在消耗你。",
        question: null,
      };
    },
  });
  assert(writerLocked.status === "discovery", "writer reject still keeps core");
  assert(!/自我欺騙/.test(`${writerLocked.discovery.statement} ${writerLocked.discovery.why}`), "final output has no 自我欺騙");

  const noteKept = await insightDiscovery.runDiscoveryPipeline({
    ctx: noteRaw,
    callAi: async (messages, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "n1",
              type: "CONNECTION",
              statement: noteDiscovery,
              evidence: ["少一點證明給別人看", "晚上本來想再改一版履歷，最後沒改"],
              newInformation: "這兩件事的關係她還沒明說",
              whyItMatters: "放在一起看，好像有個值得注意的地方。",
              confidence: "high",
            },
          ],
        };
      }
      if (stage === "challenge") {
        return {
          items: [
            {
              id: "n1",
              verdict: "DROP",
              parrotLikely: true,
              failed: ["known", "paraphrase", "parrot"],
              reason: "A and B both exist in RAW",
            },
          ],
        };
      }
      return { statement: noteDiscovery, why: "放在一起看，好像有個值得注意的地方。", question: null };
    },
  });
  assert(noteKept.status === "discovery", `co-occurrence must not force silence: ${noteKept.status}`);
  assert(noteKept.discovery && noteKept.discovery.type === "CONNECTION", "Case 09 direction stays CONNECTION");

  console.log("insight discovery fixtures", JSON.stringify(fixtureResults));
  console.log("insight discovery tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
