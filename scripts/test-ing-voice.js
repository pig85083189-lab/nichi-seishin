const bodyMind = require("../lib/body-mind");
const reflectionV3 = require("../lib/reflection-v3");
const reflectionExt = require("../lib/reflection-extension");
const awarenessV3 = require("../lib/awareness-v3");
const executionV3 = require("../lib/execution-v3");
const voice = require("../lib/ing-voice");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(voice.GLOBAL_VOICE_BLOCK.includes("白話優先"), "global voice 存在");
assert(bodyMind.BODY_MIND_SYSTEM.includes("白話優先"), "03 接上 voice");
assert(reflectionV3.REFLECTION_V3_SYSTEM.includes("前因"), "04 要求前因");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("你剛剛說了什麼"), "Round 1 承接回答");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("progressive depth") || reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("NEXT LAYER"), "Round 2 往下一層");
assert(reflectionExt.REFLECTION_EXTENSION_CLOSE_SYSTEM.includes("看得懂的發現"), "deepConclusion 白話");
assert(awarenessV3.AWARENESS_V3_SYSTEM.includes("我會願意勾選") || awarenessV3.AWARENESS_V3_SYSTEM.includes("真人會說"), "05 像真人");
assert(executionV3.EXECUTION_V3_SYSTEM.includes("WHY THIS ACTION"), "06 要先說為什麼");
assert(!bodyMind.BODY_MIND_SYSTEM.includes("CREATE TABLE"), "03 無 schema");
assert(!reflectionV3.REFLECTION_V3_SYSTEM.includes("ALTER TABLE"), "04 無 schema");

const composed = reflectionV3.normalizeReflectionQuestions([
  {
    id: "q1",
    basis: "你今天提到，有人提醒你之後，你更確定自己現在努力的方向是對的。",
    question: "如果今天沒有這個提醒，你原本也會這麼相信自己的方向嗎？還是心裡其實還是會有一點不確定？",
  },
]);
assert(composed[0].text.includes("有人提醒"), "basis 會合成進 text");
assert(composed[0].text.includes("如果今天沒有這個提醒"), "question 仍在");
assert(!composed[0].basis, "persist 不另存 basis 欄");

const legacy = reflectionV3.normalizeReflectionQuestions([{ id: "q1", text: "舊資料只有 text，沒有 basis。" }]);
assert(legacy[0].text === "舊資料只有 text，沒有 basis。", "legacy text 可讀");

const action = executionV3.normalizeExecutionV3Actions([
  {
    id: "e1",
    title: "留下一件自己認可的進步",
    reason: "因為你今天發現，別人的肯定會讓你更確定自己的方向，所以這次可以先練習替自己留下證據。",
    detail: "不用寫很多，今天先留下一件你自己也認可的進步。",
  },
]);
assert(action[0].detail.includes("因為你今天發現"), "06 reason 合成進 detail");
assert(action[0].title.length < 24, "06 title 仍短");

const actionLegacy = executionV3.normalizeExecutionV3Actions([
  { id: "e1", title: "分清哪些真的不能改", detail: "列出居住安排裡不能控制的一件事。" },
]);
assert(actionLegacy[0].detail === "列出居住安排裡不能控制的一件事。", "06 legacy detail 可讀");

const CASE1_GOOD = bodyMind.evaluateBodyMindQuality(
  {
    insight: "明明身邊有人陪，你心裡還是有一小塊地方覺得孤單。",
    support: "有人陪和覺得孤單，其實可以同時存在。你不需要因為今天身邊有人，就覺得自己不應該有這個感受。",
  },
  { text: "今天明明很多人陪我，但還是有點孤單。" }
);
assert(CASE1_GOOD.ok, `CASE 1 白話應通過：${CASE1_GOOD.issues.join("；")}`);

const CASE1_BAD = bodyMind.evaluateBodyMindQuality(
  {
    insight: "你正在經歷外在陪伴與內在情感需求之間的落差。",
    support: "你需要學會先滿足自己的深層需求。",
  },
  { text: "今天明明很多人陪我，但還是有點孤單。" }
);
assert(!CASE1_BAD.ok, "CASE 1 診斷／抽象詞必須 FAIL");
assert(CASE1_BAD.issues.some((item) => item === "overpsych" || item === "jargon"), "CASE 1 抽象詞被擋");

const CASE2_GOOD = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "有人從旁邊點一下時，你會更容易覺得這次方向是對的。",
    questions: [
      {
        id: "q1",
        text: "你今天提到，有人提醒你之後，你更確定自己現在努力的方向是對的。如果今天沒有這個提醒，你原本也會這麼相信自己的方向嗎？還是心裡其實還是會有一點不確定？",
      },
      {
        id: "q2",
        text: "看到你寫這段，我會想到一件事：你比較在意的，是方向本身對不對，還是有人看見你正在走？",
      },
      {
        id: "q3",
        text: "前面你說到更確定了。如果把這件事再往裡面看一點，那個確定比較像『我知道自己在做什麼』，還是『有人幫我把不確定拿掉了』？",
      },
    ],
  },
  {
    context: {
      thanksText: "有人提醒我",
      event: "有人提醒我之後，我更確定自己現在努力的方向是對的。",
      mood: "踏實",
      bodyMindText: "聽完之後心裡比較定。",
    },
    requireContext: true,
  }
);
assert(CASE2_GOOD.ok, `CASE 2 有前因應通過：${CASE2_GOOD.issues.join("；")}`);

const CASE2_BAD = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "你的方向感有一部分建立於外部視角的確認。",
    questions: [
      { id: "q1", text: "如果沒有那位貴人的提點，你原本對自己努力方向的判斷，會跟現在一樣清楚嗎？" },
      { id: "q2", text: "你是否依賴外部肯定建立內在篤定？" },
      { id: "q3", text: "你真正的核心信念是什麼？" },
    ],
  },
  {
    context: {
      thanksText: "有人提醒我",
      event: "有人提醒我之後，我更確定自己現在努力的方向是對的。",
      mood: "踏實",
      bodyMindText: "聽完之後心裡比較定。",
    },
    requireContext: true,
  }
);
assert(!CASE2_BAD.ok, "CASE 2 突然提問／抽象詞必須 FAIL");
assert(CASE2_BAD.issues.some((item) => item.includes("missing-context") || item.includes("jargon") || item.includes("overpsych")), "CASE 2 缺前因或抽象詞");

const CASE3_GOOD = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "你剛剛把『想被記住』這件事否認了。所以我不再往那條線走；今天更值得看的，也許是當下真正卡住你的是什麼。" },
  { context: { selectedQuestion: "你有沒有一點希望自己被記住？", answer: "其實沒有想被記住的感覺。" } }
);
assert(CASE3_GOOD.ok, `CASE 3 接受否定應通過：${CASE3_GOOD.issues.join("；")}`);

const CASE3_BAD = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "這反映出你其實還是想被記住，只是自己還沒承認。" },
  { context: { selectedQuestion: "你有沒有一點希望自己被記住？", answer: "其實沒有想被記住的感覺。" } }
);
assert(!CASE3_BAD.ok, "CASE 3 繼續硬證明必須 FAIL");
assert(CASE3_BAD.issues.includes("rejected-hypothesis"), "CASE 3 否定後不可續寫原假設");

const CASE3_JARGON = reflectionExt.evaluateExtensionCloseQuality(
  { deepConclusion: "這反映出她目前仍高度依賴外部視角，而尚未建立完整的內在判準。" },
  { context: { selectedQuestion: "你有沒有一點希望自己被記住？", answer: "其實沒有想被記住的感覺。" } }
);
assert(!CASE3_JARGON.ok, "deepConclusion 抽象詞必須 FAIL");

const CASE4 = reflectionV3.evaluateReflectionV3Quality(
  {
    coreQuote: "今天值得留下的，也許是你真的覺得自己做得很好的那一刻。",
    questions: [
      { id: "q1", text: "你今天提到真的很開心，也覺得自己做得很好。讓今天這麼好的，最主要是哪一件事？" },
      { id: "q2", text: "看到你寫這段，我會想到：有哪些東西是你希望之後還能留下來的？" },
      { id: "q3", text: "前面你說自己做得很好。如果把這件事再看清楚一點，你覺得好在哪裡？" },
    ],
  },
  {
    context: {
      thanksText: "今天很順利",
      event: "今天真的很開心，也覺得自己做得很好。",
      mood: "開心",
      bodyMindText: "整個人都很輕。",
    },
    requireContext: true,
    forbid: /創傷|焦慮|害怕失去|陰影/,
  }
);
assert(CASE4.ok, `CASE 4 正向日應通過：${CASE4.issues.join("；")}`);

const CASE5_GOOD = bodyMind.evaluateBodyMindQuality(
  {
    insight: "今天最明顯的是肩頸真的痠了，暫時不需要替它加上更深的解釋。",
    support: "先把這個身體訊號記下來就好。",
  },
  { text: "今天肩頸很痠，可能昨天運動太多。" }
);
assert(CASE5_GOOD.ok, `CASE 5 身體不心理化應通過：${CASE5_GOOD.issues.join("；")}`);

const CASE5_BAD = bodyMind.evaluateBodyMindQuality(
  {
    insight: "肩頸痠痛說明你承受太多壓力。",
    support: "你需要先處理內心的焦慮。",
  },
  { text: "今天肩頸很痠，可能昨天運動太多。" }
);
assert(!CASE5_BAD.ok, "CASE 5 把身體心理化必須 FAIL");
assert(CASE5_BAD.issues.includes("physical-psychologized") || CASE5_BAD.issues.includes("overpsych"), "CASE 5 心理化被擋");

const CASE6_PROMPT = reflectionExt.formatRound1PastBlock([
  {
    date: "2026-07-12",
    connectionType: "same-tension",
    userRaw: { event: "有人提醒我之後比較確定方向" },
    confirmed: { awareness: ["我發現有人肯定時我會比較相信自己"] },
  },
]);
assert(CASE6_PROMPT.includes("不必炫耀記憶"), "CASE 6 歷史不必炫耀");
assert(CASE6_PROMPT.includes("不要寫日期翻舊帳"), "CASE 6 不翻舊帳");
assert(CASE6_PROMPT.includes("PAST USER RAW"), "CASE 6 歷史權重");
assert(!CASE6_PROMPT.includes("你 8/26 也有一樣的問題"), "CASE 6 不教模型點日期");

const CASE6_Q = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "有人點一下時比較容易相信自己",
    questions: [
      { id: "eq1", text: "你今天又提到，有人提醒之後會更確定方向。如果暫時沒有人從旁邊點一下，你自己會怎麼判斷這次有沒有走對？" },
      { id: "eq2", text: "這次和你之前某次提到的提醒有一點相似，但今天好像多了一個『更確定』。那個更確定，對你來說差在哪？" },
      { id: "eq3", text: "前面你說更確定了。我有點好奇，你比較需要別人幫你確認的，是方向對不對，還是自己已經做得夠好了？" },
    ],
  },
  {
    context: {
      thanksText: "有人提醒我",
      event: "有人提醒我之後，我更確定自己現在努力的方向是對的。",
      mood: "踏實",
      bodyMindText: "聽完之後心裡比較定。",
      usedPast: [{ date: "2026-07-12", connectionType: "same-tension" }],
    },
    requireContext: true,
  }
);
assert(CASE6_Q.ok, `CASE 6 歷史輔助題應通過：${CASE6_Q.issues.join("；")}`);

const noHistoryPrompt = reflectionExt.reflectionExtensionAskUserPrompt({
  context: {
    thanksText: "有人提醒我",
    event: "有人提醒我之後，我更確定自己現在努力的方向是對的。",
    mood: "踏實",
    bodyMindText: "聽完之後心裡比較定。",
  },
});
assert(noHistoryPrompt.includes("只讀今天"), "CASE 7 無歷史仍只讀今天");
assert(!noHistoryPrompt.includes("相關過往"), "CASE 7 沒 retrieved 就不要假裝有過往");
assert(reflectionExt.REFLECTION_EXTENSION_ASK_SYSTEM.includes("不要假裝你記得以前"), "CASE 7 不可假裝記得");

const CASE7 = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "有人點一下時比較容易相信自己",
    questions: [
      { id: "eq1", text: "你今天提到，有人提醒你之後更確定方向。如果沒有這個提醒，你自己會不會一樣確定？" },
      { id: "eq2", text: "看到你寫這段，我會想到：你比較在意的是方向對不對，還是有人看見你正在走？" },
      { id: "eq3", text: "前面你說更確定了。那個確定，比較像你本來就知道，還是提醒之後才比較敢信？" },
    ],
  },
  {
    context: {
      thanksText: "有人提醒我",
      event: "有人提醒我之後，我更確定自己現在努力的方向是對的。",
      mood: "踏實",
      bodyMindText: "聽完之後心裡比較定。",
    },
    requireContext: true,
  }
);
assert(CASE7.ok, `CASE 7 無歷史仍能出好題：${CASE7.issues.join("；")}`);
assert(!CASE7.issues.includes("false-memory"), "CASE 7 不可假裝知道以前");

const awarenessGood = awarenessV3.evaluateAwarenessV3Quality(
  {
    items: [
      { id: "a1", text: "我發現，當有人肯定我正在做的事情時，我會更相信自己真的走對了。" },
      { id: "a2", text: "我發現，我有時候會希望自己的心意真的有被對方放在心上。" },
      { id: "a3", text: "我發現，身邊有人陪和心裡覺得孤單，今天可以同時存在。" },
    ],
  },
  { context: { thanksText: "有人陪", event: "很多人陪我，但還是有點孤單。", mood: "悶", bodyMindText: "心裡有一小塊空。" } }
);
assert(awarenessGood.ok, `05 白話應通過：${awarenessGood.issues.join("；")}`);

const awarenessBad = awarenessV3.evaluateAwarenessV3Quality(
  {
    items: [
      { id: "a1", text: "我發現自己的方向感部分建立於外部視角所提供的確認。" },
      { id: "a2", text: "我發現自己存在被記憶與被看見的需求。" },
      { id: "a3", text: "我發現自己的自我價值感仍不穩定。" },
    ],
  },
  { context: { thanksText: "有人陪", event: "很多人陪我。", mood: "悶", bodyMindText: "孤單。" } }
);
assert(!awarenessBad.ok, "05 抽象詞必須 FAIL");

const execGood = executionV3.evaluateExecutionV3Quality(
  {
    actions: [
      {
        id: "e1",
        title: "留下一件自己認可的進步",
        detail: "因為你今天發現，別人的肯定會讓你更確定自己的方向，所以這次可以先練習替自己留下證據。今天先留下一件你自己也認可的進步。",
      },
      {
        id: "e2",
        title: "先看自己已經走過哪",
        detail: "因為你今天提到有人提醒後才比較確定，所以下一次不確定出現時，先回來看看自己已經走過哪些路。",
      },
      {
        id: "e3",
        title: "記下這次為什麼確定",
        detail: "因為你今天更確定方向了，所以用一句話記下『我為什麼覺得自己走對了』，不用寫很多。",
      },
    ],
  },
  {
    context: {
      awarenessSelected: ["我發現，當有人肯定我正在做的事情時，我會更相信自己真的走對了。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我發現，當有人肯定我正在做的事情時，我會更相信自己真的走對了。" }],
    },
    requireWhy: true,
  }
);
assert(execGood.ok, `06 有原因應通過：${execGood.issues.join("；")}`);

const round1 = reflectionExt.evaluateExtensionAskQuality(
  {
    coreThread: "有人確認時比較容易相信自己",
    questions: [
      { id: "eq1", text: "你剛剛說，就算自己已經努力一段時間，心裡還是會有一些不確定。那我想再陪你往裡面想一點：你最需要別人幫你確認的，通常是『我做得對不對』，還是『我其實已經做得夠好了』？" },
      { id: "eq2", text: "你剛剛說還是會有不確定。我有點好奇，那個不確定比較常出現在剛開始做的時候，還是已經做一段時間、正要再往前時？" },
      { id: "eq3", text: "前面你說還是會有一點不確定。如果暫時沒有人給你答案，你覺得自己比較難的是繼續走，還是先承認這份不確定可以先帶著？" },
    ],
  },
  {
    context: {
      thanksText: "有人提醒我",
      event: "有人提醒我之後，我更確定自己現在努力的方向是對的。",
      mood: "踏實",
      bodyMindText: "聽完之後心裡比較定。",
      priorRound: {
        answer: "對啊，還是會有不確定的感覺。",
        selectedQuestion: "如果今天沒有這個提醒，你原本也會這麼相信自己的方向嗎？",
        deepConclusion: "有人從旁邊肯定時，你會更容易相信自己。",
        coreThread: "有人確認時比較容易相信自己",
        questions: [{ text: "如果今天沒有這個提醒，你原本也會這麼相信自己的方向嗎？" }],
      },
    },
    requireContext: true,
  }
);
assert(round1.ok, `Round 1 承接回答應通過：${round1.issues.join("；")}`);

console.log("ing-voice fixtures ok");
