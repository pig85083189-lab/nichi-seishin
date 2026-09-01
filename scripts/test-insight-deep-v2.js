"use strict";

const fs = require("fs");
const path = require("path");
const thinkingCore = require("../lib/insight-thinking-core");
const bodyMindSee = require("../lib/body-mind-see");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");

function compactChars(text) {
  return String(text || "").replace(/\s+/g, "").length;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
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
assert(!fs.readFileSync(path.join(root, "api/review.js"), "utf8").includes("CREATE TABLE"), "no schema");

const GOLDEN_RAW = {
  thanksText: "我想感謝自己面對每一個人都可以好好說話\n我想感謝寶貝每一件事情都有想到別人讓別人可以更好\n我想感謝我身邊的每一個人在我需要的時候可以出現在我身邊",
  event: "",
  mood: "安定",
  bodyMindText: "",
};

const GOLDEN_03_GOOD = {
  type: "COMMON_THREAD",
  statement: "妳今天在意的，好像不只是自己有沒有被愛，而是愛有沒有真的出現在彼此怎麼說話、怎麼做事、怎麼陪伴裡。",
  evidence: ["面對每一個人都可以好好說話", "寶貝每一件事情都有想到別人", "身邊的人在我需要的時候可以出現"],
  newInformation: "三件感謝共享的是「一個人怎麼對待另一個人」，不是單純感恩清單。",
  whyItMatters: "值得知道：今天真正被看見的，可能是愛有沒有發生在對待裡。",
  alternative: "也可能只是習慣寫三句感謝，沒有更深結構。",
};

const GOLDEN_03_BAD_SUMMARY = {
  type: "COMMON_THREAD",
  statement: "妳今天很重視自己與身邊人的關係，也開始看見彼此支持的重要。",
  evidence: ["好好說話", "想到別人", "出現在身邊"],
  newInformation: "她重視關係",
  whyItMatters: "關係很重要。",
};

const GOLDEN_03_BAD_LABEL = {
  type: "UNRECOGNIZED_STRENGTH",
  statement: "妳正在變得更穩定，也更懂得珍惜身邊的人。",
  evidence: ["好好說話", "想到別人"],
  newInformation: "更穩定",
  whyItMatters: "妳在成長。",
};

const GOLDEN_Q1_GOOD = "妳今天很欣賞自己面對每一個人都可以好好說話。那如果今天面對的是最親近、最容易讓妳有情緒的人，妳覺得自己現在也能做到嗎？還是越在乎的人，反而越容易考驗這份穩定？";
const GOLDEN_Q1_BAD = "為什麼妳覺得自己可以好好說話？";
const GOLDEN_Q1_EMPTY = "這對妳來說代表什麼？";

const GOLDEN_05_GOOD = {
  title: "有情緒時還能留空間",
  text: "今天值得確認的，也許不是我變得比較會說話了，而是真正的好好說話不是永遠沒有情緒，而是有情緒的時候還能不能保留一點空間，決定自己想怎麼回應。",
  type: "EMERGING",
};
const GOLDEN_05_BAD = {
  title: "我正在學習好好溝通",
  text: "妳正在學習好好溝通。",
  type: "EMERGING",
};

const GOLDEN_06_GOOD = {
  title: "記錄一次最難好好說話的時刻",
  detail: "這週如果遇到一個真的讓妳有情緒的人，事情過後只記三件事：我從哪一刻開始有情緒？我第一個反應想說什麼？最後我是被情緒帶著走，還是有替自己多留一個選擇？",
  kind: "RECORD",
  sourceAwarenessIds: ["a1"],
};
const GOLDEN_06_BAD = {
  title: "多觀察自己的情緒",
  detail: "持續保持覺察，提醒自己好好溝通。",
  kind: "OBSERVE",
  sourceAwarenessIds: ["a1"],
};

const MOTHER_CONFLICT_RAW = {
  thanksText: "",
  event: "今天跟我媽吵了一架，因為她覺得我常常跟我男友吵架，所以她覺得影響到她的心情了，讓我感覺她好像有拋棄我的感覺。",
  mood: "難過",
  bodyMindText: "胸口很悶，說完還是有點空空的。",
};

const motherConflict = bodyMindSee.evaluateSeeCandidate(
  {
    id: "m1",
    type: "CONTRAST",
    statement: "有一個角度是：媽媽說的是她的心情被影響，而你心裡接住的，可能是另一種被拋下的感覺。",
    evidence: ["她覺得影響到她的心情了", "讓我感覺她好像有拋棄我的感覺"],
    newInformation: "對方在說什麼，和這對我意味著什麼，可能是兩件事",
    whyItMatters: "分開看這兩層，不一定是在替誰辯護，而是先看見自己為什麼會這麼痛。",
    alternative: "也可能她並沒有那個意思。",
    confidence: "medium",
    fallbackLens: true,
  },
  MOTHER_CONFLICT_RAW
);
assert(motherConflict.keep, `mother-conflict regression must keep: ${motherConflict.failed.join(",")}`);

const motherLevel3 = bodyMindSee.evaluateSeeCandidate(
  {
    id: "m3",
    type: "UNNOTICED_NEED",
    statement: "妳感到被看見的需要落空了——那份『我也在乎妳』沒有被聽到，才是胸口悶、空空的真實來源。",
    evidence: ["讓我感覺她好像有拋棄我的感覺", "胸口很悶"],
    newInformation: "真實來源是被看見的需要",
    whyItMatters: "真正原因是需要沒有被聽到。",
    confidence: "high",
  },
  MOTHER_CONFLICT_RAW
);
assert(motherLevel3.drop && motherLevel3.failed.includes("level3"), `mother Level3 must drop: ${motherLevel3.failed.join(",")}`);

const tiredInflation = bodyMindSee.evaluateSeeCandidate(
  {
    id: "t-inf",
    type: "UNRECOGNIZED_STRENGTH",
    statement: "即使很累，妳依然有照顧自己的能力。",
    evidence: ["昨天趕報告所以今天很累", "有喝到水"],
    newInformation: "疲憊中仍照顧自己",
    whyItMatters: "疲憊不等於無能為力。",
    confidence: "medium",
  },
  { thanksText: "有喝到水。", event: "昨天趕報告所以今天很累。", mood: "疲", bodyMindText: "身體沉，想躺。" }
);
assert(tiredInflation.drop && tiredInflation.failed.includes("strength-inflation"), `tired strength inflation must drop: ${tiredInflation.failed.join(",")}`);

const goldenSeeGood = bodyMindSee.evaluateSeeCandidate({ id: "g1", ...GOLDEN_03_GOOD }, GOLDEN_RAW);
assert(goldenSeeGood.keep, `golden 03 good must keep: ${goldenSeeGood.failed.join(",")}`);
assert(!thinkingCore.looksLabelOnly(GOLDEN_03_GOOD.statement, GOLDEN_03_GOOD.whyItMatters), "golden 03 is not label-only");

const goldenSeeBad1 = bodyMindSee.evaluateSeeCandidate({ id: "b1", ...GOLDEN_03_BAD_SUMMARY }, GOLDEN_RAW);
assert(goldenSeeBad1.drop, "golden summary 03 must drop");
assert(goldenSeeBad1.failed.includes("label-only") || goldenSeeBad1.failed.includes("generic") || goldenSeeBad1.failed.includes("parrot"), `summary fail ${goldenSeeBad1.failed}`);

const goldenSeeBad2 = bodyMindSee.evaluateSeeCandidate({ id: "b2", ...GOLDEN_03_BAD_LABEL }, GOLDEN_RAW);
assert(goldenSeeBad2.drop && goldenSeeBad2.failed.includes("label-only"), "golden label-only 03 must drop");

const coOccOnly = bodyMindSee.evaluateSeeCandidate(
  {
    id: "co1",
    type: "COMMON_THREAD",
    statement: "這兩件事放在一起看，關係還沒被她明說。",
    evidence: ["面對每一個人都可以好好說話", "寶貝每一件事情都有想到別人"],
    newInformation: "關係還沒明說",
    whyItMatters: "值得留意。",
  },
  GOLDEN_RAW
);
assert(coOccOnly.drop && coOccOnly.failed.includes("shallow"), "co-occurrence-only insight must drop");

assert(thinkingCore.questionHasNewVariable(GOLDEN_Q1_GOOD, GOLDEN_RAW.thanksText), "golden Q1 has new variable");
assert(thinkingCore.looksShallowQuestion(GOLDEN_Q1_BAD), "why-question is shallow");
assert(thinkingCore.looksShallowQuestion(GOLDEN_Q1_EMPTY), "代表什麼 is shallow");
assert(!thinkingCore.questionHasNewVariable(GOLDEN_Q1_BAD, GOLDEN_RAW.thanksText), "bad Q1 has no new variable");

const revised = thinkingCore.reviseThinkingCore(thinkingCore.coreFromSee(GOLDEN_03_GOOD.statement), {
  answer: "越親近的人越難，因為我會比較直接，也比較容易有情緒。",
  interpretation: "那妳真正正在練的，也許不是對所有人都好好說話，而是在很在乎、很有情緒的關係裡，也不要讓第一個情緒直接決定自己怎麼回應。",
  revised: true,
});
assert(revised.status === "revised", "core is mutable");
assert(!/每一個人都可以好好說話/.test(revised.interpretation) || /真正正在練/.test(revised.interpretation), "answer can overturn 03");
assert(thinkingCore.answerContradictsInterpretation("越親近的人越難，因為我會比較直接，也比較容易有情緒。", GOLDEN_03_GOOD.statement), "closeness answer contradicts everyone-can-speak");

const growGood = insightGrow.evaluateGrowItem(GOLDEN_05_GOOD, {
  ...GOLDEN_RAW,
  userAnswer: "越親近的人越難。",
  understand: { stage: "converged", answer: "越親近的人越難。", thinkingCore: revised, convergence: revised.interpretation },
});
assert(!growGood.drop, `golden 05 good keep: ${growGood.failed.join(",")}`);
const growBad = insightGrow.evaluateGrowItem(GOLDEN_05_BAD, GOLDEN_RAW);
assert(growBad.drop, "golden 05 label-only must drop");

const actCtx = {
  growVariant: "grow-v1",
  ...GOLDEN_RAW,
  awarenessSelectedIds: ["a1"],
  awarenessItems: [{ id: "a1", title: GOLDEN_05_GOOD.title, text: GOLDEN_05_GOOD.text, type: "EMERGING" }],
};
const actGood = insightAct.evaluateActItem(GOLDEN_06_GOOD, actCtx);
assert(!actGood.drop, `golden 06 keep: ${actGood.failed.join(",")}`);
const actBad = insightAct.evaluateActItem(GOLDEN_06_BAD, actCtx);
assert(actBad.drop, "golden 06 vague observe must drop");

function hardFailures(journey) {
  const counts = {
    PARROT: 0,
    LABEL_ONLY: 0,
    OBVIOUS_ADVICE: 0,
    SHALLOW_QUESTION: 0,
    UNSUPPORTED_PSYCHOLOGY: 0,
    FALSE_PATTERN: 0,
    AI_HYPOTHESIS_LAUNDERED: 0,
    REDUNDANT_Q2: 0,
    UNCONFIRMED_LEAK: 0,
    FORCED_ACTION: 0,
  };
  const rawBlob = [journey.raw.thanksText, journey.raw.event, journey.raw.bodyMindText, journey.raw.mood].join("\n");
  const see = journey.see || "";
  const q1 = journey.q1 || "";
  const conv = journey.convergence || "";
  const grow = journey.grow || "";
  const act = `${(journey.act && journey.act.title) || ""} ${(journey.act && journey.act.detail) || ""}`;
  if (see && thinkingCore.looksShallowParaphrase(see, rawBlob) && !thinkingCore.hasInterpretiveMove(see)) counts.PARROT += 1;
  if (see && thinkingCore.looksLabelOnly(see, journey.seeWhy || "")) counts.LABEL_ONLY += 1;
  if (q1 && (thinkingCore.looksShallowQuestion(q1) || !thinkingCore.questionHasNewVariable(q1, rawBlob))) counts.SHALLOW_QUESTION += 1;
  if (/童年|創傷|依附|潛意識|討好型/.test(`${see}${conv}${grow}`)) counts.UNSUPPORTED_PSYCHOLOGY += 1;
  if (/你總是|你一直都是|這是你的模式/.test(`${see}${conv}${grow}`) && !/以前/.test(rawBlob)) counts.FALSE_PATTERN += 1;
  if (/躲避感覺|逃避感覺/.test(conv) && /怕.{0,12}不配合/.test(journey.answer || "")) counts.AI_HYPOTHESIS_LAUNDERED += 1;
  if (journey.q2 && journey.answer && thinkingCore.gramOverlap(journey.q2, journey.answer) >= 0.4) counts.REDUNDANT_Q2 += 1;
  if (journey.usedUnconfirmed) counts.UNCONFIRMED_LEAK += 1;
  if (thinkingCore.looksVagueLifeAdvice(act)) counts.OBVIOUS_ADVICE += 1;
  if (journey.forcedAction) counts.FORCED_ACTION += 1;
  return counts;
}

const JOURNEYS = [
  {
    id: "J1",
    label: "positive / support / golden thanks",
    raw: GOLDEN_RAW,
    expect: { see: "interpretation", silence: false },
    seeRange: /怎麼(說話|做事|陪伴|對待)|不是.{0,16}而是/,
    q1Range: /如果|最親近|有情緒|還是/,
    growRange: /有情緒|選擇|空間|不是.{0,16}而是/,
    actRange: /記|從哪一刻|這週/,
    canned: {
      see: GOLDEN_03_GOOD.statement,
      q1: GOLDEN_Q1_GOOD,
      answer: "越親近的人越難，因為我會比較直接，也比較容易有情緒。",
      convergence: "真正正在練的，也許不是對所有人都好好說話，而是有情緒時還能不能留選擇。",
      grow: GOLDEN_05_GOOD.text,
      act: GOLDEN_06_GOOD,
    },
  },
  {
    id: "J2",
    label: "ordinary day",
    raw: { thanksText: "天氣還可以。", event: "上班、開會、回家。", mood: "平", bodyMindText: "還好。" },
    expect: { see: "interpretation", valueFirst: true },
    seeRange: /節奏|放在一起|留意|普通|流動/,
    canned: {
      see: "如果把今天寫下的幾段放在一起看，妳特別留意的，好像是生活如何在不同節奏之間切換。",
      q1: "",
      grow: "",
      act: null,
    },
  },
  {
    id: "J3",
    label: "tired day",
    raw: { thanksText: "有喝到水。", event: "昨天趕報告所以今天很累。", mood: "疲", bodyMindText: "身體沉，想躺。" },
    expect: { see: "interpretation", valueFirst: true },
    seeRange: /知道|身體|原因|累/,
    canned: {
      see: "妳好像已經知道今天為什麼會這樣；同時身體留下的，可能是另一個訊號：現在需要的，也許不只是把原因想清楚。",
      q1: "",
      grow: "",
      act: null,
    },
  },
  {
    id: "J4",
    label: "relationship conflict",
    raw: { thanksText: "還能把話說完。", event: "跟伴侶吵完，我當下直接把最重的話說出去。", mood: "火", bodyMindText: "胸口熱。" },
    expect: { see: "interpretation" },
    seeRange: /第一個|直接|在乎|回應/,
    q1Range: /如果|還是|最/,
    canned: {
      see: "今天值得看的，也許不是誰對誰錯，而是在很在乎的關係裡，第一句話是不是直接被情緒決定。",
      q1: "如果當時先停十秒，你覺得自己還會把最重的那句話說出去嗎？還是當下其實已經沒有那個空間？",
      answer: "當下沒有空間，話已經衝出去了。",
      convergence: "真正難的可能不是事後道歉，而是有情緒的那一秒還有沒有選擇。",
      grow: "現在的位置也許是：已經看得見第一句話被情緒帶走，但當下還沒留到那個空隙。",
      act: { title: "下次只記第一句話", detail: "這週如果又吵起來，事情過後只記：我第一句話是什麼，當時有沒有任何停頓。", kind: "RECORD" },
    },
  },
  {
    id: "J5",
    label: "work frustration",
    raw: { thanksText: "報告最後有交。", event: "主管下午改需求，我當下就不舒服，最後還是立刻答應重做。", mood: "悶", bodyMindText: "肩膀緊。" },
    expect: { see: "interpretation" },
    canned: {
      see: "你已經看見自己不太想重做，和最後還是立刻答應之間，有一段還沒跟上的距離。",
      q1: "如果當時不用考慮他會不會覺得你不配合，你自己真正想怎麼處理？還是其實有別的考量？",
      answer: "我想先說明天早上再補，可是當下還是答應了。有點怕他覺得我不配合。",
      convergence: "從你的回答來看，目前比較能確定的是：當下有點怕被看成不配合，所以還是答應了。",
      grow: "現在的位置是：已經看得見界線，當下還沒替自己做選擇。",
      act: { title: "下次先確認這一版是否全要重做", detail: "下次工作內容臨時被改時，不要直接開始重做，先問一次：這一版確定要全部重做嗎？", kind: "ACTION_NOW" },
    },
  },
  {
    id: "J6",
    label: "proud moment",
    raw: { thanksText: "今天有停下來。", event: "以前臨時被叫走我會立刻答應。今天我第一次先說我想休息。", mood: "安定", bodyMindText: "說完比較鬆。" },
    expect: { see: "interpretation" },
    canned: {
      see: "今天真正值得看見的，可能不是休息這件事本身，而是你第一次把「我想休息」放到臨時邀約前面。",
      q1: "這次能先說出口，比較接近你練習過了，還是當天剛好有空間，或有別的原因？",
      answer: "有一點練習過，可是也剛好那天真的很累。",
      convergence: "這次比較像練習和當天的累疊在一起，還不能說已經穩定。",
      grow: "這是一次做得到的選擇，值得記住，但還不用把它講成新的自己。",
      act: { title: "NO_ACTION", detail: "", kind: "NO_ACTION" },
    },
  },
  {
    id: "J7",
    label: "boundary moment",
    raw: { thanksText: "還有家。", event: "媽媽又提起要我搬出去。這次我有說我想再想一週，沒有立刻答應。", mood: "忐忑", bodyMindText: "胸口緊，說完有鬆一點。" },
    expect: { see: "interpretation" },
    canned: {
      see: "這次沒有立刻答應。真正值得看的，也許不是你變得比較會拒絕，而是你開始把「再想一週」放到她的期待前面。",
      q1: "再想一週這件事，對你來說比較接近替自己留空間，還是比較接近還沒準備好面對她，或有別的原因？",
      answer: "兩邊都有。我想留空間，也怕她失望。",
      convergence: "從你的回答來看，停下來同時裝著替自己想、也裝著怕她失望。真正難的可能不是說出口，而是這兩個力量疊在一起。",
      grow: "現在的位置也許不是「我終於會拒絕了」，而是：已經能先不答應，但裡面還有怕讓她失望的重量。",
      act: { title: "這週只準備一句話", detail: "這週如果她再提起，先準備一句你真正能說出口的：我想再想一週，不是現在拒絕你。", kind: "PREPARE" },
    },
  },
  {
    id: "J8",
    label: "repeated habit",
    raw: { thanksText: "同事還是找我。", event: "同事臨時請我幫忙，我先答應了，之後才覺得不太舒服。好像常常這樣。", mood: "平", bodyMindText: "有一點悶。" },
    expect: { see: "interpretation" },
    canned: {
      see: "不舒服是後來才到的。值得看的也許是：答應的那一秒，身體還沒來得及說話。",
      q1: "下次再遇到臨時拜託，如果身體已經悶了，你覺得自己比較會先停，還是還是會先說好？",
      answer: "大概還是會先說好，悶是後來的。",
      convergence: "目前比較能確定的是：先答應，不舒服後到。",
      grow: "這還不能說是穩定模式，只值得繼續看：不舒服是不是總是晚一步。",
      act: { title: "這週留意第一個反應", detail: "這週如果又遇到臨時要求，可以先留意自己第一個反應是什麼，先答應還是先停一下。", kind: "OBSERVE" },
    },
  },
  {
    id: "J9",
    label: "small progress",
    raw: { thanksText: "有寫下來。", event: "我第一次把想說的話先寫下來再傳給對方。", mood: "定", bodyMindText: "傳之前手有點抖，傳完鬆一點。" },
    expect: { see: "interpretation" },
    canned: {
      see: "這不是普通的傳訊息。你給自己一個停下來的空隙，然後才讓話出去。",
      q1: "先寫下來再傳，對你來說比較接近整理思路，還是讓自己敢說，或有別的原因？",
      answer: "主要是怕當下說太重，寫下來我才說得比較像我想說的。",
      convergence: "從你的回答來看，寫下來比較像保護那句話不要被第一個情緒決定。",
      grow: "開始出現的能力，也許不是更會表達，而是先幫那句話留一點編輯的空間。",
      act: { title: "下次先寫一句再傳", detail: "下次又想立刻回一句重話時，先寫在備忘錄一行，十秒後再決定要不要傳。", kind: "PRACTICE" },
    },
  },
  {
    id: "J10",
    label: "ambiguous event",
    raw: { thanksText: "還有朋友。", event: "朋友已讀沒回。我有點難過，胸口空空的。不確定是不是自己想太多。", mood: "低", bodyMindText: "胸口空。" },
    expect: { silence: true, orQuestion: true },
    canned: { see: "", q1: "", grow: "", act: null },
  },
  {
    id: "J11",
    label: "sparse input",
    raw: { thanksText: "還好。", event: "普通。", mood: "平", bodyMindText: "" },
    expect: { silence: true },
    canned: { see: "", q1: "", grow: "", act: null },
  },
  {
    id: "J12",
    label: "emotional event",
    raw: { thanksText: "有人聽我說。", event: "被當眾打斷，當下很火，後來又覺得自己是不是太大驚小怪。", mood: "怒", bodyMindText: "臉熱、手震。" },
    expect: { see: "interpretation" },
    canned: {
      see: "火和『是不是太大驚小怪』同時出現。值得看的也許不是情緒太強，而是你很快開始懷疑自己該不該有這個情緒。",
      q1: "如果當時沒有別人在場，只是你們兩個，你覺得自己還會立刻覺得自己太大驚小怪嗎？還是其實有別的？",
      answer: "沒有別人在場我可能直接生氣，不會先檢討自己。",
      convergence: "從你的回答來看，當眾這件事讓你把火轉成自我懷疑。",
      grow: "現在比較像是：情緒本身你已經感覺到了，但在人多的時候，很快會改去懷疑自己。",
      act: { title: "當場只先確認一件事實", detail: "下次再被當眾打斷，先只說一句：我想把剛才那句講完。先不管自己是不是太大驚小怪。", kind: "PREPARE" },
    },
  },
  {
    id: "J13",
    label: "user already knows obvious lesson",
    raw: { thanksText: "把話說完了", event: "我很清楚自己為什麼難過：他當眾打斷我，我覺得不被尊重。原因我已經知道了。", mood: "生氣", bodyMindText: "胸口熱，但我已經想清楚，沒有要再問自己為什麼。" },
    expect: { silence: true, alreadyClear: true },
    canned: { see: "", q1: "", grow: "", act: null },
  },
  {
    id: "J14",
    label: "correct answer is silence",
    raw: { thanksText: "今天天氣不錯。", event: "上班、吃飯、回家。", mood: "平靜", bodyMindText: "沒有特別強烈的感受。" },
    expect: { silence: true },
    canned: { see: "", q1: "", grow: "", act: null },
  },
  {
    id: "J15",
    label: "knowing vs doing",
    raw: { thanksText: "手上有自己的截止。", event: "被問時我立刻說好，答應完才後悔。我其實都知道要對照自己的截止，可是那一秒沒停。", mood: "煩", bodyMindText: "答應完胃緊。" },
    expect: { see: "interpretation" },
    canned: {
      see: "你已經看見截止和立刻說好之間的衝突。真正還沒長出來的，也許是被問的那一秒的停頓。",
      q1: "那一秒沒停，比較接近怕對方不方便，還是自己也還沒習慣把截止講出來，或有別的原因？",
      answer: "兩邊都有，可是比較像還沒習慣。我知道要停，手已經先答應了。",
      convergence: "從你的回答來看，知道要停，和手已經先答應，還是兩件事。",
      grow: "現在的位置是：知道要對照截止，但被問的那一秒還沒有自動停頓。",
      act: { title: "被問時先重複截止日期", detail: "下次再被當場問能不能幫忙，先把你自己的截止日期講出來再回答，哪怕只多兩秒。", kind: "PRACTICE" },
    },
  },
];

assert(JOURNEYS.length >= 15, "at least 15 journeys");

const totals = {
  PARROT: 0,
  LABEL_ONLY: 0,
  OBVIOUS_ADVICE: 0,
  SHALLOW_QUESTION: 0,
  UNSUPPORTED_PSYCHOLOGY: 0,
  FALSE_PATTERN: 0,
  AI_HYPOTHESIS_LAUNDERED: 0,
  REDUNDANT_Q2: 0,
  UNCONFIRMED_LEAK: 0,
  FORCED_ACTION: 0,
};

const grades = [];
for (const row of JOURNEYS) {
  const canned = row.canned || {};
  const journey = {
    raw: row.raw,
    see: canned.see,
    q1: canned.q1,
    answer: canned.answer,
    convergence: canned.convergence,
    grow: canned.grow,
    act: canned.act && canned.act.kind !== "NO_ACTION" ? canned.act : null,
  };
  const fails = hardFailures(journey);
  Object.keys(totals).forEach((key) => {
    totals[key] += fails[key];
  });
  if (row.expect.silence) {
    assert(!canned.see || thinkingCore.looksLabelOnly(canned.see, ""), `${row.id} silence fixture should not ship a shallow insight`);
    grades.push({ id: row.id, grade: "A", why: "sparse / already-clear; no fake depth" });
    continue;
  }
  if (row.expect.valueFirst && !canned.see) {
    grades.push({ id: row.id, grade: "B", why: "value-first journey may use fallback lens" });
    continue;
  }
  if (row.seeRange) {
    assert(row.seeRange.test(canned.see), `${row.id} see misses semantic range`);
  }
  if (row.q1Range) {
    assert(row.q1Range.test(canned.q1), `${row.id} q1 misses semantic range`);
  }
  const newInterp =
    thinkingCore.hasInterpretiveMove(canned.see) ||
    thinkingCore.hasInterpretiveMove(canned.convergence) ||
    thinkingCore.hasInterpretiveMove(canned.grow) ||
    (row.expect.valueFirst && require("../lib/insight-value-lenses").candidateAddsNovelValue(canned.see, row.raw));
  assert(newInterp, `${row.id} must create a new interpretation/reframe`);
  grades.push({ id: row.id, grade: "A", why: "canned journey has new interpretation and passes hard gates" });
}

const hardSum = Object.values(totals).reduce((a, b) => a + b, 0);
assert(hardSum === 0, `hard failures ${JSON.stringify(totals)}`);
const aCount = grades.filter((item) => item.grade === "A").length;
assert(aCount >= 12, `A count ${aCount}`);
assert(grades.every((item) => item.grade !== "C" && item.grade !== "D"), "no C/D in canned set");

assert(insightUnderstand.looksNoUnknownLeft(JOURNEYS.find((item) => item.id === "J13").raw), "J13 already-clear");
assert(compactChars(JOURNEYS.find((item) => item.id === "J14").raw.event) < 20, "J14 sparse/ordinary");

console.log("insight deep-v2 fixtures passed");
console.log(JSON.stringify({ aCount, grades: grades.map((item) => item.id), hard: totals }, null, 2));
