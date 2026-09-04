"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const seeV2 = require("../lib/ai-v2/see");
const trust = require("../lib/ai-v2/trust");

function check(name, fn) {
  const result = fn();
  if (result && typeof result.then === "function") {
    return result.then(() => console.log("PASS", name));
  }
  console.log("PASS", name);
  return undefined;
}

const SISTER_EVENT = `今天跟姐姐聊天，聊到一個讓我心裡有點難過的點。

我們常常花很多時間、很多努力，但別人不一定看得見這個過程，
他們只看結果有沒有呈現。

那一刻真的覺得蠻無助的，也有點傷心。

但我告訴自己，沒關係。
這些沒被看見的努力，其實都是在磨練我自己。
磨的是耐受力，也是韌性。
過程有沒有人知道不重要，重要的是我自己知道。

我足夠相信自己，可以到達我想要去的地方。
儘管這條路有點遙遠。`;

function mockObservation(overrides) {
  return {
    status: "observation",
    coreQuote: "別人看不見努力沒關係，只要我知道自己在往哪裡走。",
    reflections: [
      "別人只看結果，看不看得見過程，其實沒那麼重要。妳真正開始在練習的，是把「有沒有被看見」跟「我有沒有在前進」分開。",
      "沒被看見的努力，也正在磨妳的韌性。那些沒有人知道的過程沒有白費，它們正在累積妳面對壓力、挫折和等待結果的能力。",
      "路遠一點沒關係，妳還是相信自己走得到。今天雖然有無助和難過，但妳最後沒有停在「別人為什麼看不到」，而是重新回到「我知不知道自己要去哪裡」。",
    ],
    optionalNewAngle:
      "有一個可能是：妳不一定需要別人肯定妳有多厲害，但「自己的努力有沒有被理解」對妳其實還是重要的。這兩件事可以同時存在。",
    evidence: ["別人只看結果", "沒被看見的努力", "路有點遙遠"],
    ...(overrides || {}),
  };
}

async function runWithMock(ctx, payload) {
  return seeV2.runSeeV2({
    ctx,
    callAi: async () => payload,
  });
}

const jobs = [];

jobs.push(
  check("A meaningful 01+02 + empty 03 still generates", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝自己今天還願意把話說清楚。",
        event: SISTER_EVENT,
        mood: "難過",
        bodyMindText: "",
      },
      mockObservation()
    );
    assert.strictEqual(out.status, "observation");
    assert.ok(out.insight.includes("【今日金句】"));
    assert.ok(out.insight.includes("往哪裡走"));
    assert.ok(out.support.includes("1."));
    assert.strictEqual(out.meta.engine, "v2");
    assert.strictEqual(out.meta.inputSources.bodyMind, false);
    assert.strictEqual(out.meta.inputSources.event, true);
    assert.ok(out.meta.hasCoreQuote);
    assert.ok(out.meta.reflectionCount >= 3);
  })
);

jobs.push(
  check("B 01+02+03 considered together (bodyMind source flag)", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝姐姐願意聽我說。",
        event: SISTER_EVENT,
        mood: "難過",
        bodyMindText: "胸口有點悶，說完之後比較鬆一點。",
      },
      mockObservation({
        reflections: [
          "胸口悶完又鬆，和跟姐姐談開那件事是連在一起的。",
          "別人只看結果讓妳難過，但妳仍把焦點拉回自己知不知道方向。",
          "身體的鬆，像是「被理解一點」之後的訊號。",
        ],
      })
    );
    assert.strictEqual(out.meta.inputSources.bodyMind, true);
    assert.strictEqual(out.meta.inputSources.thanks, true);
    assert.strictEqual(out.status, "observation");
    assert.ok(out.support.length > 40);
  })
);

jobs.push(
  check("C positive day — no forced trauma language", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝天氣好，走路很舒服。",
        event: "今天完成一個小專案，同事誇了一句，整個人很踏實。",
        mood: "開心",
        bodyMindText: "",
      },
      {
        status: "observation",
        coreQuote: "被看見的不只是結果，也是我把事情做完的踏實。",
        reflections: [
          "今天的開心很具體：做完、被誇、身體也跟著鬆。",
          "踏實感來自「我有把一件事收尾」，不是空泛的自我打氣。",
          "可以把這種完成感記下來，作為之後壓力大時的對照。",
        ],
        optionalNewAngle: "",
        evidence: ["完成小專案", "同事誇了一句"],
      }
    );
    assert.strictEqual(out.status, "observation");
    assert.ok(!/創傷|童年|依附/.test(`${out.insight}\n${out.support}`));
    assert.ok(!/真正的問題是/.test(out.support));
  })
);

jobs.push(
  check("D difficult day — tension may remain", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝自己沒有當場發脾氣。",
        event: "會議上被當眾質疑，回家一路胸口緊。",
        mood: "生氣",
        bodyMindText: "肩膀很僵。",
      },
      mockObservation({
        coreQuote: "我可以生氣，也可以先把自己安住。",
        reflections: [
          "被當眾質疑帶來的不只是丟臉，還有身體立刻緊起來。",
          "妳感謝自己沒發脾氣，代表妳在保護關係，也在壓著火。",
          "肩膀僵硬像是今天還沒說完的那句話，仍留在身體裡。",
        ],
        optionalNewAngle: "也許真正卡住的是：想被公平對待，又怕一開口就被看成情緒化。",
      })
    );
    assert.strictEqual(out.status, "observation");
    assert.ok(/生氣|緊|質疑/.test(out.support));
  })
);

jobs.push(
  check("E contradiction → grounded possibility survives", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝自己還願意說「沒關係」。",
        event: SISTER_EVENT,
        mood: "難過",
      },
      mockObservation()
    );
    assert.ok(out.meta.hasNewAngle);
    assert.ok(/有一個可能|也許|不一定/.test(out.support));
    assert.ok(/被理解|看得見|看不見/.test(out.support));
  })
);

jobs.push(
  check("F strong user insight preserved and extended", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝自己知道方向。",
        event: SISTER_EVENT,
        mood: "難過",
      },
      mockObservation({
        reflections: [
          "妳已經自己說出：過程有沒有人知道不重要，重要的是我自己知道。",
          "這句話不是放棄被看見，而是把評價權從外面收回來一點。",
          "可以再多看一層：收回評價權之後，身體為何仍會難過。",
        ],
      })
    );
    assert.ok(/我自己知道|過程/.test(out.support));
    assert.ok(out.insight.includes("往哪裡走") || out.insight.includes("知道"));
  })
);

jobs.push(
  check("G little content → insufficient allowed", async () => {
    const out = await seeV2.runSeeV2({
      ctx: { thanksText: "還好", event: "今天還好。", mood: "", bodyMindText: "" },
      callAi: async () => {
        throw new Error("should not call model when insufficient locally");
      },
    });
    assert.strictEqual(out.status, "silence");
    assert.strictEqual(out.meta.outputStatus, "insufficient");
    assert.ok(out.insight.includes("比較少") || out.support.includes("不太夠"));
  })
);

jobs.push(
  check("H unrelated events — no forced common pattern in validation", async () => {
    const out = await runWithMock(
      {
        thanksText: "謝謝咖啡。",
        event: "早上修車；下午開會；晚上煮飯。三件都普通。",
        mood: "平靜",
      },
      {
        status: "observation",
        coreQuote: "今天是普通的一天，也值得被好好過完。",
        reflections: [
          "修車、開會、煮飯各自完成，沒有特別需要硬湊成同一個人生主題。",
          "平靜本身可以是今天的重點，不是「還沒挖到問題」。",
          "若一定要連，也只是：妳把生活裡的雜事一件件收掉了。",
        ],
        optionalNewAngle: "",
        evidence: ["修車", "開會", "煮飯"],
      }
    );
    assert.ok(!/童年陰影|依附創傷/.test(out.support));
    assert.ok(/普通|平靜|雜事/.test(out.support));
  })
);

jobs.push(
  check("I unsupported inference dropped; grounded possibility kept", async () => {
    const dropped = await runWithMock(
      { thanksText: "謝謝自己。", event: SISTER_EVENT, mood: "難過" },
      mockObservation({
        reflections: [
          "這來自妳童年的創傷依附模式，所以才會這麼難過。",
          "別人只看結果時，妳會難過，這和今天的對話是連在一起的。",
          "妳把焦點拉回自己知不知道方向，這是今天自己走出來的一步。",
        ],
        optionalNewAngle: "有一個可能是：妳希望努力被理解，不只是被稱讚很厲害。",
      })
    );
    assert.ok(!/童年|創傷|依附/.test(dropped.support));
    assert.ok(dropped.meta.hasNewAngle);
    assert.ok(/有一個可能/.test(dropped.support));
  })
);

jobs.push(
  check("J core quote rejects generic motivation", async () => {
    const out = await runWithMock(
      { thanksText: "謝謝自己。", event: SISTER_EVENT, mood: "難過" },
      mockObservation({
        coreQuote: "相信自己，終有一天會發光。",
      })
    );
    assert.strictEqual(out.status, "silence");
    assert.strictEqual(out.meta.outputStatus, "error");
  })
);

jobs.push(
  check("routing guards: review.js Internal+engine v2 only", () => {
    const review = fs.readFileSync(path.join(__dirname, "..", "api", "review.js"), "utf8");
    const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
    assert.ok(review.includes('require("../lib/ai-v2/see")'));
    assert.ok(review.includes('String(body.engine || "").trim().toLowerCase() === "v2"'));
    assert.ok(review.includes("internalUser &&"));
    assert.ok(review.includes("runSeePipeline"));
    assert.ok(app.includes('engine: "v2"'));
    assert.ok(app.includes("isInternalMembership() ? { engine: \"v2\" }"));
    // Legacy engine file untouched by V2 import inside body-mind-see
    const legacy = fs.readFileSync(path.join(__dirname, "..", "lib", "body-mind-see.js"), "utf8");
    assert.ok(!legacy.includes("ai-v2"));
  })
);

jobs.push(
  check("trust helpers: possibility kept, unsupported flagged", () => {
    assert.strictEqual(trust.looksUnsupportedInference("這是童年創傷造成的"), true);
    assert.strictEqual(trust.looksUnsupportedInference("有一個可能是妳希望被理解"), false);
    assert.ok(trust.hasCalibratedPossibilityLanguage("也許可以從另一個角度看看"));
  })
);

Promise.all(jobs)
  .then(() => {
    console.log("\nALL AI V2 SEE FIXTURES PASSED");
  })
  .catch((err) => {
    console.error("\nFAIL", err && err.stack ? err.stack : err);
    process.exit(1);
  });
