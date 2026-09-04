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

const GOLDEN_THANKS = `我想感謝自己，今天雖然事情很多，還是有把該完成的事情一件一件做好。

我想感謝身邊的人，在我需要幫忙的時候願意支持我。

我想感謝今天發生的一些事情，讓我重新去想自己到底在意的是什麼。`;

const GOLDEN_EVENT = `今天跟一個很熟的人聊天，他無意間說了一句
「妳現在做得很好啊，感覺什麼事情都很順」。

我知道他沒有惡意，但聽到的當下其實有一點說不上來的感覺。

因為我突然想到，很多人看到的好像都是最後的結果，
可是其實中間有很多壓力、懷疑自己的時候，
還有很多事情是我自己慢慢撐過來的。

但我也發現自己很矛盾，
一方面希望自己的努力可以被看見，
一方面又會覺得，
我做這些事情本來就不是為了證明給別人看。

所以我也不知道為什麼那句話會讓我特別有感。`;

const GOLDEN_MODEL = {
  status: "observation",
  coreQuote: "我不是需要別人證明我做得很好，我只是也希望有人看見，我是怎麼一路走到這裡的。",
  reflections: [
    "聽到「妳現在很順」時會說不上來，不是因為對方惡意，而是那句話碰到了：別人看見結果，妳記得過程。",
    "這裡其實有兩件事被混在一起：希望努力被看見，和「不是為了證明給別人看才努力」。兩者可以同時成立。",
    "妳感謝自己把事情一件件做完，也感謝有人願意支持——今天在意的不只是被誇，而是這些支撐有沒有被理解。",
  ],
  optionalNewAngle:
    "換個角度看，「感覺什麼事情都很順」不一定是在否定妳過去的辛苦；有一個可能是：別人看見的「順」，正是妳已經把很多壓力消化成現在看起來的穩定。",
  evidence: ["感覺什麼事情都很順", "希望自己的努力可以被看見", "不是為了證明給別人看"],
};

jobs.push(
  check("Thinking Tools live inside SEE_SYSTEM as optional lenses (one-call)", () => {
    const sys = seeV2.SEE_SYSTEM;
    [
      "REALITY CHECK",
      "REFRAME LENS",
      "GUT DECODE",
      "THOUGHT ORGANIZER",
      "DECISION MIRROR",
      "ROOT QUESTION",
      "RISK SCAN",
      "NEXT MOVE",
    ].forEach((name) => assert.ok(sys.includes(name), `missing lens ${name}`));
    assert.ok(sys.includes("不要每次全用") || sys.includes("不是必做步驟"));
    assert.ok(sys.includes("不要對使用者說出工具名稱"));
    assert.ok(sys.includes("NEW ANGLE"));
    assert.ok(sys.includes("POSSIBILITY ≠ 刪除") || sys.includes("POSSIBILITY"));
    assert.ok(sys.includes("整份一起看"));
  })
);

jobs.push(
  check("Golden Test — empty 03 + deep contradiction journal maps to valuable SEE", async () => {
    let calls = 0;
    const out = await seeV2.runSeeV2({
      ctx: {
        thanksText: GOLDEN_THANKS,
        event: GOLDEN_EVENT,
        mood: "複雜",
        bodyMindText: "",
      },
      callAi: async () => {
        calls += 1;
        return GOLDEN_MODEL;
      },
    });
    assert.strictEqual(calls, 1, "still exactly one model call");
    assert.strictEqual(out.status, "observation");
    assert.strictEqual(out.meta.inputSources.bodyMind, false);
    assert.strictEqual(out.meta.inputSources.thanks, true);
    assert.strictEqual(out.meta.inputSources.event, true);
    assert.ok(out.meta.hasNewAngle);
    assert.ok(out.meta.reflectionCount >= 3);
    assert.ok(out.insight.includes("【今日金句】"));
    assert.ok(/看見|一路|證明|努力/.test(out.insight));
    assert.ok(!/所有努力都不會白費|相信自己就會發光|堅持就是成功/.test(out.insight));
    assert.ok(/有一個可能|換個角度看|也許/.test(out.support));
    assert.ok(/兩件|同時|看見|結果|過程|順/.test(out.support));
    assert.ok(!/REALITY CHECK|GUT DECODE|THOUGHT ORGANIZER/.test(`${out.insight}\n${out.support}`));
    // Expose for review printout
    global.__ING_V2_GOLDEN_OUTPUT__ = { insight: out.insight, support: out.support, meta: out.meta };
  })
);

Promise.all(jobs)
  .then(() => {
    console.log("\nALL AI V2 SEE FIXTURES PASSED");
    if (global.__ING_V2_GOLDEN_OUTPUT__) {
      console.log("\n===== GOLDEN TEST OUTPUT =====");
      console.log(global.__ING_V2_GOLDEN_OUTPUT__.insight);
      console.log("");
      console.log(global.__ING_V2_GOLDEN_OUTPUT__.support);
      console.log("===== END GOLDEN TEST OUTPUT =====\n");
    }
  })
  .catch((err) => {
    console.error("\nFAIL", err && err.stack ? err.stack : err);
    process.exit(1);
  });
