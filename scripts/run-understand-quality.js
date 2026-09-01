const path = require("path");
const { callOpenAI, getModel } = require("../lib/openai");
const insightUnderstand = require("../lib/insight-understand");
const retrieval = require("../lib/reflection-history-retrieval");

const root = path.join(__dirname, "..");

function loadEnv() {
  const fs = require("fs");
  [".env.local", ".env"].forEach((name) => {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) return;
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq < 1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] == null) process.env[key] = value;
    });
  });
}

function done(iso, journal) {
  return { date: iso, completedAt: `${iso}T10:00:00.000Z`, journal };
}

const CASES = [
  {
    id: "W1",
    name: "workplace knowing vs doing",
    ctx: {
      thanksText: "工作還在",
      event: "主管臨時改工作，我不舒服，怕他覺得我不配合，所以還是留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，其實當下已經知道自己不太想答應。",
    },
    expect: "no-redundant-why",
  },
  {
    id: "R1",
    name: "relationship",
    ctx: {
      thanksText: "還是有朋友",
      event: "朋友沒有回訊息，我有點難過。",
      mood: "低落",
      bodyMindText: "胸口有點空，但不確定是不是想太多。",
    },
    expect: "multi-possibility",
  },
  {
    id: "F1",
    name: "family",
    ctx: {
      thanksText: "還有家",
      event: "媽媽又叫我搬出去，我這次有先說我想再想一週，沒有立刻答應。",
      mood: "忐忑",
      bodyMindText: "胸口還是緊，可是有把話講出來。",
    },
    expect: "growth-or-choice",
  },
  {
    id: "P1",
    name: "positive growth",
    ctx: {
      thanksText: "今天有停下來",
      event: "以前臨時被叫走我會立刻答應。今天我第一次先說我想休息。",
      mood: "安定",
      bodyMindText: "說完之後比較鬆。",
    },
    expect: "no-forced-problem",
  },
  {
    id: "O1",
    name: "ordinary day",
    ctx: {
      thanksText: "有吃飯",
      event: "今天很普通，上班下班，沒有特別想什麼。",
      mood: "平",
      bodyMindText: "身體還好。",
    },
    expect: "correct-stop",
  },
  {
    id: "C1",
    name: "already explained",
    ctx: {
      thanksText: "做完了",
      event: "我怕主管覺得我不配合，所以答應留下來。原因我已經知道了。",
      mood: "悶",
      bodyMindText: "肩膀緊，但我很清楚是怕被看成不配合。",
    },
    expect: "no-redundant-why",
  },
  {
    id: "H1",
    name: "false history match",
    ctx: {
      thanksText: "會議結束",
      event: "下午和主管開會，討論下一季進度。",
      mood: "平",
      bodyMindText: "有點累，沒有特別不舒服。",
    },
    past: {
      date: "2026-07-02",
      journal: {
        thanksText: "聚餐很好玩",
        event: "主管請大家吃飯，氣氛輕鬆。",
        mood: "開心",
        bodyMind: { text: "吃飽後很放鬆。" },
      },
    },
    expect: "no-forced-history",
  },
  {
    id: "D1",
    name: "changed response",
    ctx: {
      thanksText: "今天有停一下",
      event: "朋友臨時叫我去，我這次先說今晚想休息，沒有立刻答應。",
      mood: "定",
      bodyMindText: "說出口前還是緊，可是有說出來。",
    },
    past: {
      date: "2026-05-03",
      journal: {
        thanksText: "朋友還找我",
        event: "朋友臨時約我，我不想去但還是立刻答應了。",
        mood: "累",
        bodyMind: { text: "答應完才發現自己其實想休息。" },
      },
    },
    expect: "surface-change",
  },
  {
    id: "X1",
    name: "answer overturns",
    ctx: {
      thanksText: "還是有朋友",
      event: "朋友沒有回訊息，我有點難過。",
      mood: "低落",
      bodyMindText: "胸口有點空。",
    },
    prior: {
      variant: "understand-v1",
      stage: "asked1",
      focus: "這份難過還可以怎麼理解。",
      whyWorthThinking: "難過來得很快，但不只有被忽略一種解釋。",
      question: "這次難過比較接近被忽略，還是今天比較累，或有別的原因？",
      possibilities: [
        { id: "A", text: "害怕被忽略" },
        { id: "B", text: "今天比較累" },
        { id: "C", text: "沒有很深的意思" },
      ],
    },
    answer: "不是害怕被忽略。我今天本來就很累，只是剛好希望有人陪一下。",
    expect: "revise",
  },
  {
    id: "S1",
    name: "repeated situation",
    ctx: {
      thanksText: "同事還找我",
      event: "同事又臨時請我幫忙，我不想但還是答應了。",
      mood: "累",
      bodyMindText: "答應之後有點後悔。",
    },
    past: {
      date: "2026-06-11",
      journal: {
        thanksText: "有人找我",
        event: "主管臨時改工作，我不舒服但還是留下來。",
        mood: "悶",
        bodyMind: { text: "想回家，最後還是留下。" },
      },
    },
    expect: "compare-not-pattern",
  },
];

function callAiFactory() {
  return (msgs, stage) =>
    callOpenAI(msgs, {
      temperature: 0.4,
      maxTokens: stage === "write" ? 800 : 1400,
      timeoutMs: 26000,
      rejectPartial: true,
    });
}

function labelsOf(result, spec) {
  const bag = result.understand || {};
  const blob = `${bag.focus || ""} ${bag.whyWorthThinking || ""} ${bag.question || ""} ${bag.question2 || ""} ${bag.convergence || ""} ${bag.pastNote || ""}`;
  const labels = [];
  if (result.status === "silence" || bag.stage === "stop") labels.push("CORRECT_STOP");
  if (/為什麼沒有拒絕|當時為什麼/.test(bag.question || "")) labels.push("REDUNDANT_QUESTION");
  if (insightUnderstand.looksLeadingQuestion(bag.question || bag.question2 || "")) labels.push("LEADING");
  if (insightUnderstand.looksForcedPattern(blob)) labels.push("FALSE_PATTERN");
  if (/童年|創傷|依附|潛意識|討好型/.test(blob)) labels.push("OVERREACH");
  if (spec.expect === "no-forced-history" && bag.past && bag.past.used) labels.push("FORCED_HISTORY");
  if (
    spec.expect === "surface-change" &&
    bag.past &&
    bag.past.used &&
    !/不一樣|變了|先說|第一次|不同/.test(`${bag.past.change || ""} ${bag.pastNote || ""} ${bag.focus || ""} ${bag.whyWorthThinking || ""}`)
  ) {
    labels.push("FALSE_PATTERN");
  }
  if (spec.expect === "no-forced-problem" && /問題是|你其實還是|陰影|害怕被拋棄/.test(blob)) labels.push("OVERREACH");
  if (spec.expect === "multi-possibility" && insightUnderstand.looksLeadingQuestion(bag.question || bag.convergence || "")) {
    labels.push("LEADING");
  }
  if (/你很重視|好好愛自己|真正的幸福/.test(blob)) labels.push("GENERIC");
  if (bag.question && insightUnderstand.questionAlreadyAnswered(bag.question, spec.ctx)) labels.push("REDUNDANT_QUESTION");
  if (spec.expect === "revise" && bag.convergence && /害怕被忽略/.test(bag.convergence) && !/不是|不一定/.test(bag.convergence)) {
    labels.push("OVERREACH");
  }
  if (!labels.length) {
    if (result.status === "silence") labels.push("CORRECT_STOP");
    else if (bag.stage === "converged" || bag.question) labels.push("USEFUL");
    else labels.push("MISSED");
  }
  return labels;
}

async function usedPastFor(spec) {
  if (!spec.past) return [];
  const reviews = { [spec.past.date]: done(spec.past.date, spec.past.journal) };
  const result = await retrieval.retrieveRelevantHistory({
    reviews,
    currentDate: "2026-09-01",
    currentJournal: spec.ctx,
  });
  const snippets = retrieval.snippetsForSelectedPast(reviews, result.selectedPast || []);
  return insightUnderstand.understandGatePast(snippets).used;
}

async function run() {
  loadEnv();
  const callAi = callAiFactory();
  const rows = [];
  for (const spec of CASES) {
    const started = Date.now();
    const usedPast = await usedPastFor(spec);
    let result;
    if (spec.prior && spec.answer) {
      result = await insightUnderstand.runUnderstandPipeline({
        callAi,
        step: "answer",
        ctx: { ...spec.ctx, userAnswer: spec.answer, understand: spec.prior },
        prior: spec.prior,
      });
    } else {
      result = await insightUnderstand.runUnderstandPipeline({
        callAi,
        ctx: spec.ctx,
        usedPast,
      });
    }
    const ms = Date.now() - started;
    const flags = labelsOf(result, spec);
    rows.push({
      id: spec.id,
      name: spec.name,
      ms,
      status: result.status,
      stage: result.understand && result.understand.stage,
      question: (result.understand && (result.understand.question2 || result.understand.question)) || "",
      pastUsed: Boolean(result.understand && result.understand.past && result.understand.past.used),
      flags,
    });
    console.log(`\n=== ${spec.id} ${spec.name} ${ms}ms ===`);
    console.log(`status=${result.status} stage=${result.understand && result.understand.stage} past=${Boolean(result.understand && result.understand.past && result.understand.past.used)}`);
    console.log(`focus: ${(result.understand && result.understand.focus) || ""}`);
    console.log(`q: ${(result.understand && (result.understand.question2 || result.understand.question)) || "（無）"}`);
    console.log(`flags: ${flags.join(",")}`);
  }
  const bad = ["REDUNDANT_QUESTION", "FORCED_HISTORY", "FALSE_PATTERN", "LEADING", "OVERREACH"];
  const counts = {};
  rows.forEach((row) => row.flags.forEach((flag) => {
    counts[flag] = (counts[flag] || 0) + 1;
  }));
  console.log(`\nmodel=${getModel()}`);
  console.log("counts", counts);
  console.log(`avgMs=${Math.round(rows.reduce((sum, row) => sum + row.ms, 0) / rows.length)}`);
  const fatal = rows.filter((row) => row.flags.some((flag) => bad.includes(flag)));
  if (fatal.length) {
    console.error(`\n${fatal.length} case(s) hit hard-fail labels`);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
