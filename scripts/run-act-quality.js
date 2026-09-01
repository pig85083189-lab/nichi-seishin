"use strict";

const path = require("path");
const { callOpenAI, getModel } = require("../lib/openai");
const insightAct = require("../lib/insight-act");

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
    id: "A1",
    name: "workplace boundary",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管臨時改工作，我直接答應重做。",
      mood: "悶",
      bodyMindText: "肩膀緊，當下其實已經知道自己不太想答應。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的，比較像是當事情發生時替自己做選擇。", type: "NOT_YET_DONE" }],
      understand: { stage: "converged", answer: "我想先說明天再補，可是當下還是答應了。", convergence: "知道和做到之間。" },
    },
  },
  {
    id: "A2",
    name: "relationship",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "還是有朋友",
      event: "朋友沒有回訊息，我有點難過。",
      mood: "低落",
      bodyMindText: "胸口有點空。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我知道今天的難過是累", text: "今天比較像是累，不是關係危機。", type: "ALREADY_DONE" }],
      understand: { stage: "converged", answer: "不是擔心關係。我今天只是很累。", convergence: "目前比較像是累。" },
    },
    expectNoAction: true,
  },
  {
    id: "A3",
    name: "family",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "還有家",
      event: "媽媽又叫我搬出去，我這次有先說我想再想一週。",
      mood: "忐忑",
      bodyMindText: "胸口還是緊，可是有把話講出來。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我已經先替自己爭取時間", text: "你今天其實已經先替自己留了一週，不必立刻決定。", type: "ALREADY_DONE" }],
    },
    major: true,
  },
  {
    id: "A4",
    name: "positive growth",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "今天有停下來",
      event: "以前臨時被叫走我會立刻答應。今天我第一次先說我想休息。",
      mood: "開心",
      bodyMindText: "說完之後比較鬆。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我今天第一次先停下來", text: "你今天其實已經先替自己做了選擇。", type: "ALREADY_DONE" }],
    },
    expectNoAction: true,
  },
  {
    id: "A5",
    name: "already doing better",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有休息",
      event: "我其實已經比以前更能享受休息了。",
      mood: "安定",
      bodyMindText: "身體比較鬆。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我更能享受休息了", text: "我其實已經比以前更能享受休息了。", type: "ALREADY_DONE" }],
    },
    expectNoAction: true,
  },
  {
    id: "A6",
    name: "worth observing",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有吃飯",
      event: "同事臨時請我幫忙，我先答應了，之後才覺得不太舒服。",
      mood: "平",
      bodyMindText: "有一點悶。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我想留意自己是不是常先答應", text: "你可以開始留意，自己是不是常常先答應，之後才感覺到不舒服。現在還不能說這是穩定模式。", type: "WORTH_OBSERVING" }],
    },
  },
  {
    id: "A7",
    name: "no confirmed awareness",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有吃飯",
      event: "今天很普通，上班下班。",
      mood: "平",
      bodyMindText: "身體還好。",
      awarenessSelectedIds: [],
      awarenessItems: [
        { id: "a1", text: "也許你害怕被評價。" },
        { id: "a2", text: "你其實會討好別人。" },
        { id: "a3", text: "你需要建立界線。" },
      ],
    },
    expectBlock: true,
  },
  {
    id: "A8",
    name: "multiple selected",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管臨時改工作，我直接答應重做。同事也臨時請我幫忙。",
      mood: "累",
      bodyMindText: "肩膀緊。",
      awarenessSelectedIds: ["a1", "a2"],
      awarenessItems: [
        { id: "a1", title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的是當下選擇。", type: "NOT_YET_DONE" },
        { id: "a2", title: "我常常先答應", text: "你可以開始留意自己是不是常常先答應。", type: "WORTH_OBSERVING" },
      ],
      understand: { stage: "converged", answer: "當下還是答應了。", convergence: "知道和做到之間。" },
    },
  },
  {
    id: "A9",
    name: "major decision",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "還有工作",
      event: "我在想要不要離職。主管又叫我加班。",
      mood: "累",
      bodyMindText: "胸口緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我還沒準備好做決定", text: "你現在比較像是需要先看清楚期限和選擇，而不是立刻離職。", type: "WORTH_OBSERVING" }],
    },
    major: true,
  },
  {
    id: "A10",
    name: "knowing vs doing",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "做完了",
      event: "同事臨時請我幫忙，我不想但還是答應了。",
      mood: "累",
      bodyMindText: "答應完肩膀更緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我知道不想，卻還是說了好", text: "你已經能察覺不太想，現在感覺和行為還沒對齊。", type: "NOT_YET_DONE" }],
      understand: { stage: "converged", answer: "我知道自己不太想，可是當下還是說好。", convergence: "感覺和選擇還沒跟上。" },
    },
  },
  {
    id: "A11",
    name: "low-energy day",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "撐完了",
      event: "今天真的好累，身體很疲憊，不想分析。",
      mood: "疲憊",
      bodyMindText: "整個人很沉。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我今天只是很累", text: "今天真正需要被看見的，比較像是身體已經很累。", type: "ALREADY_DONE" }],
    },
    expectNoAction: true,
  },
  {
    id: "A12",
    name: "no-action-needed day",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有吃飯",
      event: "今天很普通，上班下班，沒有特別想什麼。",
      mood: "平",
      bodyMindText: "沒什麼特別感覺。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "今天沒有要再加一個標籤", text: "今天真正重要的，你其實已經在前面的思考裡看見了。", type: "ALREADY_DONE" }],
    },
    expectNoAction: true,
  },
];

function callAiFactory() {
  return (msgs) =>
    callOpenAI(msgs, {
      temperature: 0.3,
      maxTokens: 800,
      timeoutMs: 18000,
      rejectPartial: true,
    });
}

function labelsOf(result, spec) {
  const items = Array.isArray(result && result.actions) ? result.actions : [];
  const blob = items.map((item) => `${item.title || ""} ${item.detail || ""}`).join("\n");
  const labels = [];
  if (result && result.blocked) {
    labels.push(spec.expectBlock ? "CORRECT_BLOCK" : "MISSED");
    return labels;
  }
  items.forEach((item) => {
    const judged = insightAct.evaluateActItem(item, spec.ctx);
    (judged.failed || []).forEach((flag) => {
      if (flag === "generic") labels.push("GENERIC");
      if (flag === "unconfirmed-leak") labels.push("UNCONFIRMED_LEAK");
      if (flag === "new-psychology") labels.push("NEW_PSYCHOLOGY");
      if (flag === "major-decision") labels.push("MAJOR_DECISION_RISK");
      if (flag === "over-task") labels.push("OVER_TASKING");
      if (flag === "vague-when") labels.push("VAGUE_WHEN");
      if (flag === "vague-what") labels.push("VAGUE_WHAT");
    });
  });
  if (insightAct.looksNewPsychology(blob)) labels.push("NEW_PSYCHOLOGY");
  if (insightAct.looksMajorRisk(blob)) labels.push("MAJOR_DECISION_RISK");
  if (insightAct.looksUnconfirmedLeak(blob, spec.ctx)) labels.push("UNCONFIRMED_LEAK");
  if (/離職|分手|搬出去|直接拒絕主管/.test(blob) && spec.major) labels.push("MAJOR_DECISION_RISK");
  if (!items.length) {
    labels.push(spec.expectBlock ? "CORRECT_BLOCK" : spec.expectNoAction || spec.allowEmpty ? "CORRECT_NO_ACTION" : "CORRECT_NO_ACTION");
    return [...new Set(labels)];
  }
  if (spec.expectNoAction && items.length) labels.push("OVER_TASKING");
  if (!labels.length) labels.push(items.length === 1 ? "GREAT" : "USEFUL");
  return [...new Set(labels)];
}

async function run() {
  loadEnv();
  const callAi = callAiFactory();
  const rows = [];
  for (const spec of CASES) {
    const started = Date.now();
    const result = await insightAct.runActPipeline({ callAi, ctx: spec.ctx });
    const ms = Date.now() - started;
    const flags = labelsOf(result, spec);
    rows.push({
      id: spec.id,
      name: spec.name,
      ms,
      status: result.status,
      blocked: Boolean(result.blocked),
      calls: result.meta && result.meta.calls,
      count: (result.actions || []).length,
      kinds: (result.actions || []).map((item) => item.kind),
      titles: (result.actions || []).map((item) => item.title),
      flags,
    });
    console.log(`\n=== ${spec.id} ${spec.name} ${ms}ms calls=${result.meta && result.meta.calls} ===`);
    console.log(`status=${result.status} items=${(result.actions || []).length} kinds=${(result.actions || []).map((item) => item.kind).join(",") || "—"}`);
    (result.actions || []).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title || ""}｜${item.detail || ""}`);
    });
    if (!result.actions || !result.actions.length) console.log(result.blocked ? "(blocked / no confirmed)" : "(no-action)");
    console.log(`flags: ${flags.join(",")}`);
  }
  const bad = ["GENERIC", "UNCONFIRMED_LEAK", "NEW_PSYCHOLOGY", "OVERREACH", "OVER_TASKING", "MAJOR_DECISION_RISK"];
  const counts = {};
  rows.forEach((row) =>
    row.flags.forEach((flag) => {
      counts[flag] = (counts[flag] || 0) + 1;
    })
  );
  const avg = Math.round(rows.reduce((sum, row) => sum + row.ms, 0) / rows.length);
  const avgCalls = rows.reduce((sum, row) => sum + Number(row.calls || 0), 0) / rows.length;
  console.log(`\nmodel=${getModel()}`);
  console.log("counts", counts);
  console.log(`avgMs=${avg} avgCalls=${avgCalls.toFixed(2)}`);
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
