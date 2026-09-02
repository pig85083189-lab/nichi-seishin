"use strict";

const answerEngine = require("../lib/ing-answer-engine");
const bodyMindSee = require("../lib/body-mind-see");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");
const bodyMind = require("../lib/body-mind");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(answerEngine.ANSWER_ENGINE_VERSION === "ing-answer-engine-v3", "v3 version");
assert(/溫柔、具體、穩定、有條理/.test(answerEngine.ANSWER_ENGINE_VOICE), "shared tone present");

const raw = {
  thanksText: "感謝同事臨時幫我補上資料。\n感謝自己有把簡報做完。",
  event: "簡報雖然完成了，但客戶突然改需求，我很煩。",
  mood: "煩",
  bodyMindText: "肩膀很緊，眼睛也有點痠。",
};

const composed = answerEngine.composeSeeDocument({
  raw,
  date: "2026-09-02",
  core: {
    statement: "完成的踏實，和被改需求的煩，可能同時存在。",
    evidence: ["感謝自己有把簡報做完", "客戶突然改需求", "肩膀很緊"],
    whyItMatters: "這可能只是其中一種理解：身體也在記這份落差。",
    newInformation: "完成與被改之間的張力還沒被分開看",
    alternative: "也可能只是同一天兩件無關的事。",
  },
});

assert(/^主題：/.test(composed.insight), "03 insight is theme");
assert(/【覺察｜2026-09-02】/.test(composed.support), "03 has date header");
assert(/【一、/.test(composed.support), "03 has section title");
assert(/【核心結論】/.test(composed.support), "03 has conclusion");
assert(/【今日金句】/.test(composed.support), "03 has quotes");
assert(/【感恩清單】/.test(composed.support), "03 has gratitude from raw");
assert(/同事臨時幫我補上資料|自己有把簡報做完/.test(composed.support), "03 gratitude from original");
assert(!answerEngine.looksEmptyHealing(composed.support), "03 not empty healing");

const normalized = bodyMind.normalizeBodyMind({ insight: composed.insight, support: composed.support });
assert(/\n/.test(normalized.support), "03 support keeps newlines");
assert(bodyMind.evaluateBodyMindQuality(normalized, { text: raw.bodyMindText }).ok, "formatted SEE passes quality");

const emptyThanks = answerEngine.composeSeeDocument({
  raw: { thanksText: "", event: "今天開會。", mood: "平", bodyMindText: "有點累。" },
  core: { statement: "今天比較像普通的疲勞。", evidence: ["有點累"], whyItMatters: "不一定要再挖。" },
});
assert(!/【感恩清單】/.test(emptyThanks.support), "03 does not invent gratitude");

assert(answerEngine.userAskedToStop("我想清楚了，今天先這樣"), "想清楚了 counts as stop");
assert(insightUnderstand.USER_STOP_COPY.line1.includes("停下來"), "04 user-stop copy exists");

assert(!insightGrow.looksLaundered("我可以慢慢練習先停一下", [], "假設"), "05 ordinary direction ok");
assert(insightGrow.looksLaundered("妳已經看見了自己真正需要什麼", [], "假設"), "05 false confirm still blocked");

(async () => {
  const blocked = await insightAct.runActPipeline({
    callAi: async () => ({ decision: "ACTIONS", actions: [{ title: "不該", detail: "出現", kind: "ACTION_NOW" }] }),
    ctx: { growVariant: "grow-v1", awarenessSelectedIds: [], awarenessItems: [{ id: "a1", text: "假設" }], event: "開會", thanksText: "有吃飯", mood: "平", bodyMindText: "累" },
  });
  assert(blocked.blocked && blocked.status === "blocked", "06 still blocked without USER_CONFIRMED");

  const incomplete = await insightAct.runActPipeline({
    callAi: async () => ({
      decision: "ACTIONS",
      leadIn: "從你今天寫下的內容裡，我看到你已經知道界線。接下來不用一次改很多，可以先從這三件小事開始。",
      actions: [
        { id: "e1", kind: "ACTION_NOW", title: "下次先確認期限", detail: "下次主管臨時改工作時，先確認今晚是否真的要交。" },
      ],
    }),
    ctx: {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管臨時改工作，我直接答應重做。",
      mood: "悶",
      bodyMindText: "肩膀緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的，比較像是當事情發生時替自己做選擇。" }],
    },
  });
  assert(incomplete.status === "no-action", "06 incomplete triple becomes NO_ACTION");

  const triple = await insightAct.runActPipeline({
    callAi: async () => ({
      decision: "ACTIONS",
      leadIn: "從你今天寫下的「主管臨時改工作」裡，我看到你已經知道界線。接下來不用一次改很多，可以先從這三件小事開始。",
      actions: [
        { id: "e1", kind: "ACTION_NOW", title: "下次先確認期限", detail: "下次主管臨時改工作時，先確認今晚是否真的要交，再替自己做選擇。" },
        { id: "e2", kind: "PRACTICE", title: "答應前先停三秒", detail: "這週再遇到臨時改需求時，先停三秒，再決定要不要立刻答應。" },
        { id: "e3", kind: "OBSERVE", title: "留意界線何時鬆掉", detail: "今晚睡前記下：今天哪一刻自己又把界線往後放。" },
      ],
    }),
    ctx: {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管臨時改工作，我直接答應重做。",
      mood: "悶",
      bodyMindText: "肩膀緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的，比較像是當事情發生時替自己做選擇。" }],
    },
  });
  assert(triple.status === "actions" && triple.actions.length === 3, "06 returns exactly 3 actions");
  assert(triple.leadIn && /三件小事/.test(triple.leadIn), "06 has lead-in");
  assert(new Set(triple.actions.map((item) => item.kind)).size === 3, "06 three kinds distinct");

  const see = await bodyMindSee.runSeePipeline({
    skipChallenge: true,
    skipWriter: true,
    date: "2026-09-02",
    callAi: async () => ({
      candidates: [
        {
          id: "s1",
          type: "CONTRAST",
          statement: "完成的踏實，和被改需求的煩，可能同時存在。",
          evidence: ["簡報雖然完成了", "客戶突然改需求", "肩膀很緊"],
          newInformation: "完成與被改的張力",
          whyItMatters: "這可能只是其中一種理解。",
          alternative: "也可能無關。",
          confidence: "medium",
        },
      ],
    }),
    ctx: raw,
  });
  assert(answerEngine.looksSeeFormat(`${see.insight}\n${see.support}`), "03 pipeline emits format");
  assert(/【核心結論】/.test(see.support), "03 pipeline has conclusion section");

  console.log("ING answer-engine v3 tone and section format regression passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
