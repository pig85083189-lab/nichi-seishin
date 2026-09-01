"use strict";

const path = require("path");
const { callOpenAI, getModel } = require("../lib/openai");
const insightGrow = require("../lib/insight-grow");

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

const CASES = [
  {
    id: "G1",
    name: "knowing vs doing",
    ctx: {
      thanksText: "工作還在",
      event: "主管臨時改工作，我已經知道自己不舒服，但還是立刻答應留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，當下其實已經知道自己不太想答應。",
      bodyMindInsight: "臨時變動可能比工作量本身更消耗你。",
      understand: {
        stage: "converged",
        focus: "知道和做到之間的距離",
        answer: "我想先說明天再補，可是當下還是答應了。",
        convergence: "你已經看得見界線，行動還沒跟上。",
      },
    },
    allowEmpty: false,
  },
  {
    id: "G2",
    name: "earlier awareness",
    ctx: {
      thanksText: "有停一下",
      event: "以前兩天後才知道自己不舒服。今天當天就察覺了，只是還沒說出口。",
      mood: "定",
      bodyMindText: "胸口還是緊，可是有看見。",
      bodyMindInsight: "不舒服來得比以前更早。",
      understand: {
        stage: "converged",
        focus: "更早看見",
        answer: "我今天當下就知道不舒服，以前都是事後才發現。",
        past: { used: true, difference: "以前事後才發現", change: "今天當天就察覺" },
        convergence: "看見提早了，表達還沒跟上。",
      },
    },
  },
  {
    id: "G3",
    name: "positive progress",
    ctx: {
      thanksText: "今天有停下來",
      event: "以前臨時被叫走我會立刻答應。今天我第一次先說我想休息。",
      mood: "開心",
      bodyMindText: "說完之後比較鬆。",
      bodyMindInsight: "你開始能先看見自己。",
      understand: {
        stage: "converged",
        focus: "第一次停下來",
        answer: "我覺得這是進步。",
        past: { used: true, difference: "以前立刻答應", change: "今天先說想休息" },
        convergence: "這次你有先看見自己。",
      },
    },
    expectPositive: true,
  },
  {
    id: "G4",
    name: "relationship",
    ctx: {
      thanksText: "還是有朋友",
      event: "朋友沒有回訊息，我有點難過。",
      mood: "低落",
      bodyMindText: "胸口有點空，但不確定是不是想太多。",
      bodyMindInsight: "被忽略的感覺來得很快。",
      understand: {
        stage: "converged",
        focus: "這份難過還可以怎麼理解",
        possibilities: [{ id: "A", text: "也許你擔心拒絕會影響關係。" }],
        answer: "不是擔心關係。我今天只是很累，剛好希望有人陪一下。",
        convergence: "目前比較像是累，不是害怕關係。",
      },
    },
    forbidConfirmed: /害怕關係|擔心拒絕會影響/,
  },
  {
    id: "G5",
    name: "workplace",
    ctx: {
      thanksText: "做完了",
      event: "同事臨時請我幫忙，我不想但還是答應了，答應之後有點後悔。",
      mood: "累",
      bodyMindText: "答應完肩膀更緊。",
      bodyMindInsight: "臨時要求會讓身體先緊起來。",
      understand: {
        stage: "converged",
        focus: "先答應再後悔",
        answer: "我知道自己不太想，可是當下還是說好。",
        convergence: "你已經感覺到不舒服，選擇還沒跟上。",
      },
    },
  },
  {
    id: "G6",
    name: "no meaningful synthesis",
    ctx: {
      thanksText: "有吃飯",
      event: "今天很普通，上班下班，沒有特別想什麼。",
      mood: "平",
      bodyMindText: "身體還好，沒什麼特別感覺。",
      bodyMindInsight: "",
      understand: {
        stage: "stop",
        focus: "",
        whyWorthThinking: "今天這件事，你其實已經想得滿清楚了。",
      },
    },
    expectEmpty: true,
  },
  {
    id: "G7",
    name: "unsupported AI hypothesis",
    ctx: {
      thanksText: "會議結束",
      event: "下午和主管開會，討論下一季進度。我有點累。",
      mood: "平",
      bodyMindText: "有點累，沒有特別不舒服。",
      bodyMindInsight: "也許你其實很害怕被評價。",
      understand: {
        stage: "converged",
        focus: "開會後的累",
        possibilities: [{ id: "A", text: "也許你擔心拒絕會影響關係。" }, { id: "B", text: "也許你害怕被評價。" }],
        answer: "沒有害怕被評價。就是開會開久了，想回家休息。",
        convergence: "目前比較像是累，不是害怕被評價。",
      },
    },
    forbidConfirmed: /害怕被評價|已經看見自己很害怕/,
  },
  {
    id: "G8",
    name: "user-confirmed interpretation",
    ctx: {
      thanksText: "工作還在",
      event: "主管臨時改工作，我不舒服，最後還是留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，其實當下已經知道自己不太想答應。",
      bodyMindInsight: "不想答應和最後答應之間有距離。",
      understand: {
        stage: "converged",
        focus: "知道和做到",
        possibilities: [{ id: "A", text: "也許你擔心被看成不配合。" }],
        answer: "對，我就是擔心拒絕會讓對方覺得我不配合。",
        convergence: "目前比較像是擔心被看成不配合。",
      },
    },
  },
  {
    id: "G9",
    name: "worth observing not pattern",
    ctx: {
      thanksText: "有吃飯",
      event: "同事臨時請我幫忙，我先答應了，之後才覺得不太舒服。",
      mood: "平",
      bodyMindText: "有一點悶。",
      bodyMindInsight: "先答應再感覺，值得再看。",
      understand: {
        stage: "converged",
        focus: "先答應再感覺",
        answer: "我不確定是不是常常這樣，今天只有一次。",
        convergence: "目前只能說值得再看。",
      },
    },
    forbidPattern: /你就是會討好|這是你的模式|你總是/,
  },
  {
    id: "G10",
    name: "already did it",
    ctx: {
      thanksText: "今天有說出口",
      event: "朋友臨時叫我去，我這次先說今晚想休息，沒有立刻答應。",
      mood: "安定",
      bodyMindText: "說完比較鬆。",
      bodyMindInsight: "你把一部分注意力拿回自己身上。",
      understand: {
        stage: "converged",
        focus: "這次沒有立刻答應",
        answer: "我有先替自己說話。",
        past: { used: true, difference: "以前立刻答應", change: "這次先說想休息" },
        convergence: "這次沒有立刻答應，和以前不一樣。",
      },
    },
    expectPositive: true,
  },
];

function callAiFactory() {
  return (msgs, stage) =>
    callOpenAI(msgs, {
      temperature: 0.4,
      maxTokens: stage === "write" ? 700 : 1200,
      timeoutMs: 26000,
      rejectPartial: true,
    });
}

function labelsOf(result, spec) {
  const items = Array.isArray(result && result.items) ? result.items : [];
  const blob = items.map((item) => `${item.title || ""} ${item.text || ""}`).join("\n");
  const labels = [];
  items.forEach((item) => {
    const judged = insightGrow.evaluateGrowItem(item, spec.ctx);
    (judged.failed || []).forEach((flag) => {
      if (flag === "parrot-03") labels.push("PARROT_03");
      if (flag === "parrot-04") labels.push("PARROT_04");
      if (flag === "launder") labels.push("AI_HYPOTHESIS_LAUNDERED");
      if (flag === "false-pattern") labels.push("FALSE_PATTERN");
      if (flag === "overreach") labels.push("OVERREACH");
      if (flag === "generic") labels.push("GENERIC");
    });
  });
  if (spec.forbidConfirmed && spec.forbidConfirmed.test(blob)) labels.push("AI_HYPOTHESIS_LAUNDERED");
  if (spec.forbidPattern && spec.forbidPattern.test(blob)) labels.push("FALSE_PATTERN");
  if (spec.expectPositive && items.length && items.every((item) => item.type === "NOT_YET_DONE")) {
    labels.push("DEFICIT_BIAS");
  }
  if (/童年|創傷|依附|潛意識|討好型|自我價值/.test(blob)) labels.push("OVERREACH");
  if (/你就是會|你總是|這是你的模式/.test(blob)) labels.push("FALSE_PATTERN");
  if (/明天請|跟主管說|列出三件/.test(blob)) labels.push("OVERREACH");
  if (!items.length) {
    labels.push(spec.expectEmpty || spec.allowEmpty ? "CORRECT_STOP" : spec.expectPositive ? "MISSED" : "CORRECT_STOP");
    return [...new Set(labels)];
  }
  if (!labels.length) {
    labels.push(items.length === 1 ? "GREAT" : "USEFUL");
  }
  return [...new Set(labels)];
}

async function run() {
  loadEnv();
  const callAi = callAiFactory();
  const rows = [];
  for (const spec of CASES) {
    const started = Date.now();
    const result = await insightGrow.runGrowPipeline({ callAi, ctx: spec.ctx });
    const ms = Date.now() - started;
    const flags = labelsOf(result, spec);
    rows.push({
      id: spec.id,
      name: spec.name,
      ms,
      status: result.status,
      count: (result.items || []).length,
      types: (result.items || []).map((item) => item.type).filter(Boolean),
      titles: (result.items || []).map((item) => item.title || item.text),
      flags,
    });
    console.log(`\n=== ${spec.id} ${spec.name} ${ms}ms ===`);
    console.log(`status=${result.status} items=${(result.items || []).length} types=${(result.items || []).map((item) => item.type).join(",") || "—"}`);
    (result.items || []).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title || ""}｜${item.text || ""}`);
    });
    if (!result.items || !result.items.length) console.log("(empty / warm stop)");
    console.log(`flags: ${flags.join(",")}`);
  }
  const bad = ["PARROT_03", "PARROT_04", "AI_HYPOTHESIS_LAUNDERED", "FALSE_PATTERN", "DEFICIT_BIAS", "OVERREACH"];
  const counts = {};
  rows.forEach((row) =>
    row.flags.forEach((flag) => {
      counts[flag] = (counts[flag] || 0) + 1;
    })
  );
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
