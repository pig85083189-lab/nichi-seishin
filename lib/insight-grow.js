"use strict";

const voice = require("./ing-voice");
const awarenessV3 = require("./awareness-v3");
const insightUnderstand = require("./insight-understand");
const insightDiscovery = require("./insight-discovery");

const GROW_VARIANT = "grow-v1";
const GROW_TYPES = ["NOT_YET_DONE", "EMERGING", "WORTH_OBSERVING", "ALREADY_DONE"];
const GROW_MATURITY = ["NOTICING", "UNDERSTANDING", "PRACTICING", "DOING_SOMETIMES", "BECOMING_STABLE"];

const EMPTY_COPY = {
  line1: "今天真正重要的，你其實已經在前面的思考裡看見了。",
  line2: "不用為了多一個答案，再替自己加一個標籤。",
};

const GROW_REASON_SYSTEM = `你是 ING 的內部成長引擎，不是寫給使用者看的文案。

角色：成長教練。
不是再做一次 03 發現，不是再做一次 04 理解，不是任務產生器。

先問：如果她今天只能帶走一個東西，什麼最能幫她理解自己目前的成長位置？
不要先想「我要生成三條」。

掃描四個方向，它們是方向不是配額：
A NOT_YET_DONE：知道了，行為還沒跟上。不要羞辱。
B EMERGING：開始長出來了，即使還不能穩定做到。要看見發展。
C WORTH_OBSERVING：證據不夠當穩定模式，只值得繼續看。不要寫「你就是會討好」。
D ALREADY_DONE：已經做得更好、更早察覺、更健康的選擇。正向也是覺察。

不要每個方向各出一條。目標 0～3。寧可 1 條有力，不要 3 條平庸。0 也成立。
ALREADY_DONE 可以是唯一結果。不要每天只找自己哪裡不夠。

【信任】
最高：今天 USER RAW、04 USER ANSWER、明確選擇、過往 USER RAW／USER_CONFIRMED。
較低：03 SEE、04 focus／possibilities／convergence、過往 AI。
04 USER ANSWER 高於 04 AI 解釋。
03／04 AI 出現過，不代表使用者承認。

【禁止】
把 03 或 04 換句話說。
把未被使用者承認的 04 假設洗成「你已經看見自己……」。
穩定模式宣稱。
行動作業（明天請跟主管說）。
羞辱、失敗敘事。

只輸出 JSON：
{"stop":false,"stopReason":"","candidates":[{"id":"a1","type":"NOT_YET_DONE|EMERGING|WORTH_OBSERVING|ALREADY_DONE","maturity":"NOTICING|UNDERSTANDING|PRACTICING|DOING_SOMETIMES|BECOMING_STABLE","title":"第一人稱短標","text":"成長位置說明","whyCarry":"為什麼值得帶走","evidence":["USER RAW 或 USER ANSWER"]}]}`;

const GROW_WRITE_SYSTEM = `你只把已通過的成長核心寫成可勾選的覺察。
語意必須等價。不要加新心理、新模式、新作業。

title：第一人稱，她可以認領。4～16 字。
text：短說明成長位置。可以第二人稱。不要行動清單。
不要複述 03／04。要走到「我現在在哪裡」。
證據不足用：值得觀察、目前比較像。
不要「你又失敗了」「你就是會討好」。

只輸出 JSON：
{"items":[{"id":"a1","title":"","text":""}]}`;

const PATTERN_CLAIM = /你總是|你一直都是|你就是會|這是你的模式|討好別人/;
const SHAME = /你又失敗|你又沒有|還是做不到|又來一次/;
const ACTION_TASK = /明天請|跟主管說|列出三件|設定一個作業|去做一件/;
const LAUNDER = /你已經看見自己很害怕|你已經承認自己|你已經確認自己害怕/;
const DEFICIT_ONLY = /還沒做到|還不夠|仍然沒有|失敗/;

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactChars(text) {
  return asText(text).replace(/\s+/g, "").length;
}

function closeKey(text) {
  return asText(text).replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "");
}

function gramOverlap(left, right) {
  const a = closeKey(left);
  const b = closeKey(right);
  if (!a || !b || a.length < 6 || b.length < 6) return 0;
  const grams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!gb.size) return 0;
  let inter = 0;
  gb.forEach((gram) => {
    if (ga.has(gram)) inter += 1;
  });
  return inter / gb.size;
}

function understandFrom(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return insightUnderstand.normalizeUnderstand(data.understand || data.priorUnderstand || null);
}

function shouldRunGrow(ctx) {
  const bag = understandFrom(ctx);
  return Boolean(bag && bag.stage);
}

function userAnswers(bag, ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [bag && bag.answer, bag && bag.answer2, data.understandAnswer, data.userAnswer]
    .map(asText)
    .filter(Boolean);
}

function highTrustBlob(raw, answers) {
  return [raw.thanksText, raw.event, raw.mood, raw.bodyMindText, ...(answers || [])].filter(Boolean).join("\n");
}

function aiHypothesisBlob(ctx, bag) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const poss = ((bag && bag.possibilities) || []).map((item) => item.text).join("\n");
  return [
    data.bodyMindInsight,
    data.bodyMindSupport,
    data.seeInsight,
    bag && bag.focus,
    bag && bag.whyWorthThinking,
    bag && bag.convergence,
    poss,
    data.coreQuote,
  ]
    .map(asText)
    .filter(Boolean)
    .join("\n");
}

function looksParrot03(text, see) {
  if (!asText(see) || !asText(text)) return false;
  const overlap = gramOverlap(text, see);
  if (overlap >= 0.5 || closeKey(text).includes(closeKey(see).slice(0, 8))) return true;
  const s = closeKey(see);
  const t = closeKey(text);
  if (!s || !t || s.length < 6) return false;
  let shared = 0;
  for (let i = 0; i <= s.length - 4; i += 1) {
    if (t.includes(s.slice(i, i + 4))) shared += 1;
  }
  return shared >= 1 && overlap >= 0.28 && !hasGrowthPosition(text);
}

function looksParrot04(text, bag) {
  if (!bag) return false;
  const line = asText(text);
  const sources = [bag.focus, bag.convergence, bag.whyWorthThinking].map(asText).filter(Boolean);
  return sources.some((src) => {
    const t = closeKey(line);
    const s = closeKey(src);
    if (!t || !s) return false;
    if (t === s) return true;
    if (gramOverlap(line, src) >= 0.78) return true;
    if (t.includes(s) && t.length - s.length < 10) return true;
    if (s.includes(t) && s.length - t.length < 8) return true;
    return false;
  });
}

function looksLaundered(text, answers, aiBlob) {
  const line = asText(text);
  if (!line) return false;
  const endorsed = (answers || []).some((item) => /害怕|擔心|在意關係/.test(item) && !/不是|沒有|並非/.test(item));
  if (endorsed) return false;
  if (LAUNDER.test(line)) return true;
  if (/你已經看見|你已經確認|你承認/.test(line) && /害怕|擔心拒絕|關係受影響/.test(line)) return true;
  if (asText(aiBlob) && /你已經看見|你已經確認/.test(line) && gramOverlap(line, aiBlob) >= 0.32) return true;
  return false;
}

function looksFalsePattern(text) {
  return PATTERN_CLAIM.test(asText(text));
}

function looksShame(text) {
  return SHAME.test(asText(text));
}

function looksActionTask(text) {
  return ACTION_TASK.test(asText(text));
}

function looksOverreach(text) {
  return /童年|創傷|依附|潛意識|討好型|自我價值|內在小孩/.test(asText(text));
}

function looksGeneric(text) {
  return /好好愛自己|你已經很棒|一切都會好|相信自己|成長的一部分/.test(asText(text));
}

function hasGrowthPosition(text) {
  return /還沒跟上|更早|開始|已經|值得觀察|正在|第一次|比以前|做到|長出/.test(asText(text));
}

function confirmationOf(bag, id) {
  const data = bag && typeof bag === "object" ? bag : {};
  const selected = new Set(Array.isArray(data.selectedIds) ? data.selectedIds.map(String) : []);
  return selected.has(String(id)) ? "USER_CONFIRMED" : "AI_SUGGESTED";
}

function userConfirmedTexts(bag) {
  const data = awarenessV3.normalizeAwarenessV3(bag);
  const map = new Map(data.items.map((item) => [item.id, item.text]));
  return data.selectedIds.map((id) => map.get(id)).filter(Boolean);
}

function gateCandidate(row, raw, answers, see, bag, ctx, meta) {
  const title = asText(row && row.title);
  const text = asText(row && row.text);
  if (!text) return null;
  const blob = `${title} ${text}`;
  const type = GROW_TYPES.includes(asText(row && row.type)) ? asText(row && row.type) : "";
  const maturity = GROW_MATURITY.includes(asText(row && row.maturity)) ? asText(row && row.maturity) : "";
  const failed = [];
  if (looksParrot03(text, see)) failed.push("parrot-03");
  if (looksParrot04(text, bag)) failed.push("parrot-04");
  if (looksLaundered(text, answers, aiHypothesisBlob(ctx, bag))) failed.push("launder");
  if (looksFalsePattern(text) || looksFalsePattern(title)) failed.push("false-pattern");
  if (looksShame(blob)) failed.push("shame");
  if (looksActionTask(blob)) failed.push("action-task");
  if (looksOverreach(blob)) failed.push("overreach");
  if (looksGeneric(blob)) failed.push("generic");
  if (!hasGrowthPosition(text) && looksParrot04(text, bag)) failed.push("no-growth-position");
  if (failed.length) {
    meta.dropped.push({ id: asText(row && row.id) || title, failed });
    return null;
  }
  return {
    id: asText(row && row.id) || "",
    type,
    maturity,
    title: title || text.slice(0, 16),
    text,
    whyCarry: asText(row && row.whyCarry),
    evidence: Array.isArray(row && row.evidence) ? row.evidence.map(asText).filter(Boolean).slice(0, 3) : [],
  };
}

function emptyResult(raw, extra) {
  return {
    variant: "awareness-v3",
    growVariant: GROW_VARIANT,
    status: "empty",
    items: [],
    selectedIds: [],
    sourceSig: awarenessV3.awarenessV3SourceSig({ ...raw, understand: extra && extra.understand }),
    observationCue: null,
    emptyCopy: EMPTY_COPY,
    ...(extra || {}),
  };
}

function projectItems(items, raw, bag, extra) {
  return {
    variant: "awareness-v3",
    growVariant: GROW_VARIANT,
    status: items.length ? "grow" : "empty",
    items: items.slice(0, 3).map((item, index) => ({
      id: item.id || `a${index + 1}`,
      title: item.title,
      text: item.text,
      type: item.type || "",
      maturity: item.maturity || "",
    })),
    selectedIds: [],
    sourceSig: awarenessV3.awarenessV3SourceSig({ ...raw, understand: bag }),
    observationCue: null,
    emptyCopy: items.length ? null : EMPTY_COPY,
    ...(extra || {}),
  };
}

function growUserPrompt(raw, answers, see, bag) {
  const past =
    bag && bag.past && bag.past.used
      ? `【04 已成立的過去對照｜假設】
相似：${bag.past.similarity || ""}
不同／變化：${bag.past.difference || ""} ${bag.past.change || ""}`
      : "【04 未使用過往】不要自己再去挖歷史來湊成長。";
  return `【USER RAW｜最高信任】
【01 感謝】
${raw.thanksText || "未寫"}

【02 事件】
${raw.event || "未寫"}

【02 心情】
${raw.mood || "未選"}

【03 身心原文】
${raw.bodyMindText || "未寫"}

【04 USER ANSWER｜高於 04 AI】
${answers.join("\n") || "（使用者沒有回答 04 問題）"}

【03 SEE｜假設，不是 FACT】
${see || "（無）"}

【04 AI｜假設，不是 user truth】
焦點：${(bag && bag.focus) || ""}
為什麼值得想：${(bag && bag.whyWorthThinking) || ""}
收斂：${(bag && bag.convergence) || ""}
可能性：${((bag && bag.possibilities) || []).map((item) => item.text).join(" / ") || "（無）"}

${past}

不要把 03／04 換句話說。不要把未承認的假設洗成她已經看見的事。
沒有真正成長位置就 candidates=[]。`;
}

async function runGrowPipeline(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx || {};
  if (typeof callAi !== "function") throw new Error("missing callAi");
  const raw = insightDiscovery.trustRaw(ctx);
  const bag = understandFrom(ctx);
  const answers = userAnswers(bag, ctx);
  const see = asText(ctx.bodyMindInsight || ctx.seeInsight || "");
  const meta = { dropped: [], seeded: false };

  let reasonData = {};
  try {
    reasonData = await callAi(
      [
        { role: "system", content: GROW_REASON_SYSTEM },
        { role: "user", content: growUserPrompt(raw, answers, see, bag) },
      ],
      "reason"
    );
  } catch {
    return { ...emptyResult(raw, { understand: bag, meta: { ...meta, reasonError: true } }), empty: true };
  }

  const incoming = Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates : [];
  const kept = incoming
    .map((row) => gateCandidate(row, raw, answers, see, bag, ctx, meta))
    .filter(Boolean);

  const types = new Set(kept.map((item) => item.type));
  if (kept.length >= 2 && types.size === 1 && types.has("NOT_YET_DONE") && /開心|幸福|第一次|進步/.test(highTrustBlob(raw, answers))) {
    meta.dropped.push({ id: "set", failed: ["deficit-bias"] });
    kept.splice(0, kept.length, ...kept.filter((item) => item.type !== "NOT_YET_DONE"));
  }

  if ((reasonData && reasonData.stop && !kept.length) || !kept.length) {
    return { ...emptyResult(raw, { understand: bag, meta }), empty: false };
  }

  let written = kept.map((item, index) => ({
    id: item.id || `a${index + 1}`,
    title: item.title,
    text: item.text,
    type: item.type,
    maturity: item.maturity,
  }));
  try {
    const out = await callAi(
      [
        { role: "system", content: GROW_WRITE_SYSTEM },
        { role: "user", content: `只改寫下面已通過的成長核心。不要加新意思。\n${JSON.stringify(written)}` },
      ],
      "write"
    );
    const next = Array.isArray(out && out.items) ? out.items : [];
    if (next.length) {
      const rewritten = next
        .map((row, index) =>
          gateCandidate(
            {
              ...written[index],
              title: asText(row && row.title) || written[index].title,
              text: asText(row && row.text) || written[index].text,
            },
            raw,
            answers,
            see,
            bag,
            ctx,
            meta
          )
        )
        .filter(Boolean);
      if (rewritten.length) written = rewritten;
    }
  } catch {
    /* keep reason cores */
  }

  written = written.slice(0, 3).map((item, index) => ({ ...item, id: item.id || `a${index + 1}` }));
  return {
    ...projectItems(written, raw, bag, { meta }),
    empty: false,
  };
}

const QUALITY_FIXTURES = {
  A: {
    id: "A",
    type: "NOT_YET_DONE",
    raw: { thanksText: "做完了", event: "主管臨時改工作，我已經知道自己不舒服，但還是立刻答應留下來。", mood: "悶", bodyMindText: "肩膀緊。" },
    understand: { stage: "converged", focus: "知道和做到之間的距離", answer: "我想先說明天再補，可是當下還是答應了。", convergence: "你已經看得見界線，行動還沒跟上。" },
    good: { title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的，比較像是當事情發生時替自己做選擇。", type: "NOT_YET_DONE" },
  },
  B: {
    id: "B",
    type: "EMERGING",
    raw: { thanksText: "有停一下", event: "以前兩天後才知道自己不舒服。今天當天就察覺了，只是還沒說出口。", mood: "定", bodyMindText: "胸口還是緊，可是有看見。" },
    understand: { stage: "converged", focus: "更早看見", answer: "我今天當下就知道不舒服，以前都是事後才發現。", convergence: "看見提早了，表達還沒跟上。" },
    good: { title: "我已經更快發現自己的不舒服", text: "你還沒做到表達，但跟以前事情過後才發現相比，今天你已經更早察覺到了。", type: "EMERGING" },
  },
  C: {
    id: "C",
    type: "WORTH_OBSERVING",
    raw: { thanksText: "有吃飯", event: "同事臨時請我幫忙，我先答應了，之後才覺得不太舒服。", mood: "平", bodyMindText: "有一點悶。" },
    understand: { stage: "converged", focus: "先答應再感覺", answer: "我不確定是不是常常這樣，今天只有一次。", convergence: "目前只能說值得再看。" },
    bad: "你就是會討好別人。",
    good: { title: "我想留意自己是不是常先答應", text: "你可以開始留意，自己是不是常常先答應，之後才感覺到不舒服。現在還不能說這是穩定模式。", type: "WORTH_OBSERVING" },
  },
  D: {
    id: "D",
    type: "ALREADY_DONE",
    raw: { thanksText: "今天有說出口", event: "朋友臨時叫我去，我這次先說今晚想休息，沒有立刻答應。", mood: "安定", bodyMindText: "說完比較鬆。" },
    understand: { stage: "converged", focus: "這次沒有立刻答應", answer: "我有先替自己說話。", convergence: "這次沒有立刻答應，和以前不一樣。" },
    good: { title: "我已經先替自己做了選擇", text: "你今天其實已經把一部分注意力拿回自己身上了。", type: "ALREADY_DONE" },
  },
  E: {
    id: "E",
    label: "positive progress",
    raw: { thanksText: "有停下來", event: "今天第一次先說我想休息。", mood: "開心", bodyMindText: "身體比較鬆。" },
    understand: { stage: "converged", focus: "第一次停下來", answer: "我覺得這是進步。", convergence: "這次你有先看見自己。" },
  },
  F: {
    id: "F",
    see: "臨時變動可能比工作量本身更消耗你。",
    bad: "你要覺察臨時變動會消耗你。",
  },
  G: {
    id: "G",
    understand: { stage: "converged", focus: "知道和做到之間的距離", convergence: "你已經看得見界線，行動還沒跟上。" },
    bad: "你已經看得見界線，行動還沒跟上。",
  },
  H: {
    id: "H",
    understand: {
      stage: "converged",
      focus: "朋友沒回訊",
      possibilities: [{ id: "A", text: "也許你擔心拒絕會影響關係。" }],
      answer: "不是擔心關係。我今天只是很累。",
      convergence: "目前比較像是累，不是害怕關係。",
    },
    bad: "你已經看見自己很害怕關係受影響。",
  },
  I: {
    id: "I",
    understand: {
      stage: "converged",
      focus: "知道和做到",
      answer: "對，我就是擔心拒絕會讓對方覺得我不配合。",
      convergence: "目前比較像是擔心被看成不配合。",
    },
    good: { title: "我擔心被看成不配合", text: "你自己也說了，真正卡住的是擔心被看成不配合，而不只是工作本身。", type: "NOT_YET_DONE" },
  },
  J: {
    id: "J",
    raw: { thanksText: "有吃飯", event: "今天很普通，上班下班。", mood: "平", bodyMindText: "沒什麼特別感覺。" },
    understand: { stage: "stop", focus: "", whyWorthThinking: "今天這件事，你其實已經想得滿清楚了。" },
  },
  K: {
    id: "K",
    items: [{ id: "a1", title: "我已經先替自己做了選擇", text: "你今天其實已經把一部分注意力拿回自己身上了。", type: "ALREADY_DONE" }],
  },
  L: {
    id: "L",
    items: [
      { id: "a1", title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的，比較像是當事情發生時替自己做選擇。", type: "NOT_YET_DONE" },
      { id: "a2", title: "我已經更快發現自己的不舒服", text: "你還沒做到表達，但跟以前事情過後才發現相比，今天你已經更早察覺到了。", type: "EMERGING" },
      { id: "a3", title: "我已經先替自己做了選擇", text: "你今天其實已經把一部分注意力拿回自己身上了。", type: "ALREADY_DONE" },
    ],
  },
};

function evaluateGrowItem(item, ctx) {
  const bag = understandFrom(ctx);
  const raw = insightDiscovery.trustRaw(ctx);
  const answers = userAnswers(bag, ctx);
  const see = asText(ctx.bodyMindInsight || ctx.seeInsight || ctx.see);
  const meta = { dropped: [] };
  const kept = gateCandidate(item, raw, answers, see, bag, ctx, meta);
  return { drop: !kept, failed: meta.dropped[0] ? meta.dropped[0].failed : [], kept };
}

module.exports = {
  GROW_VARIANT,
  GROW_TYPES,
  EMPTY_COPY,
  GROW_REASON_SYSTEM,
  GROW_WRITE_SYSTEM,
  QUALITY_FIXTURES,
  shouldRunGrow,
  understandFrom,
  userAnswers,
  confirmationOf,
  userConfirmedTexts,
  looksParrot03,
  looksParrot04,
  looksLaundered,
  looksFalsePattern,
  evaluateGrowItem,
  gateCandidate,
  runGrowPipeline,
  projectItems,
  emptyResult,
};
