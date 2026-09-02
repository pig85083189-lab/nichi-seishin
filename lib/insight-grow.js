"use strict";

const voice = require("./ing-voice");
const awarenessV3 = require("./awareness-v3");
const insightUnderstand = require("./insight-understand");
const insightDiscovery = require("./insight-discovery");
const thinkingCore = require("./insight-thinking-core");
const answerEngine = require("./ing-answer-engine");

const GROW_VARIANT = "grow-v1";
const GROW_TYPES = ["NOT_YET_DONE", "EMERGING", "WORTH_OBSERVING", "ALREADY_DONE"];
const GROW_MATURITY = ["NOTICING", "UNDERSTANDING", "PRACTICING", "DOING_SOMETIMES", "BECOMING_STABLE"];

const EMPTY_COPY = {
  line1: "",
  line2: "",
};

const GROW_REASON_SYSTEM = `Return JSON only for stage 05 GROW candidates.
No commentary outside JSON.

{"stop":false,"stopReason":"","candidates":[{"id":"a1","type":"NOT_YET_DONE|EMERGING|WORTH_OBSERVING|ALREADY_DONE","maturity":"NOTICING|UNDERSTANDING|PRACTICING|DOING_SOMETIMES|BECOMING_STABLE","title":"string","text":"string","whyCarry":"string","evidence":["string"]}]}`;

const GROW_WRITE_SYSTEM = `Return JSON only for stage 05 GROW user-facing items.
No commentary outside JSON.

{"items":[{"id":"a1","title":"","text":""}]}`;

const PATTERN_CLAIM = /$a/;
const SHAME = /$a/;
const ACTION_TASK = /$a/;
const LAUNDER = /$a/;
const DEFICIT_ONLY = /$a/;

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
  if (answerEngine.userAskedToStop(ctx)) return false;
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
  if (answerEngine.looksFalseConfirm(line)) return true;
  if (LAUNDER.test(line)) return true;
  if (/你已經看見|你已經確認|你承認|妳已經看見/.test(line) && /害怕|擔心拒絕|關係受影響/.test(line)) return true;
  if (asText(aiBlob) && /你已經看見|你已經確認|妳已經看見/.test(line) && gramOverlap(line, aiBlob) >= 0.32) return true;
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
  return /還沒跟上|更早|開始|已經|值得觀察|正在|第一次|比以前|做到|長出|不是.{0,16}而是|選擇空間|有情緒/.test(asText(text));
}

function looksLabelOnlyGrowth(text) {
  return thinkingCore.looksLabelOnly(text, "") && !thinkingCore.hasInterpretiveMove(text);
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
  const type = GROW_TYPES.includes(asText(row && row.type)) ? asText(row && row.type) : "";
  const maturity = GROW_MATURITY.includes(asText(row && row.maturity)) ? asText(row && row.maturity) : "";
  return {
    id: asText(row && row.id) || "",
    type: type || "WORTH_OBSERVING",
    maturity: maturity || "NOTICING",
    title: title || text.slice(0, 16),
    text,
    whyCarry: asText(row && row.whyCarry),
    evidence: Array.isArray(row && row.evidence) ? row.evidence.map(asText).filter(Boolean).slice(0, 6) : [],
    bridge: Boolean(row && row.bridge),
  };
}

function shouldSkipGrow(raw) {
  return insightUnderstand.looksNoUnknownLeft(raw);
}

function seeIsSilent(see) {
  const line = asText(see);
  if (!line) return true;
  return /看得滿清楚|暫時沒有看到需要再被解讀|沒有一定要再解讀/.test(line);
}

function looksExplicitPhysicalLesson(raw) {
  const blob = [raw && raw.thanksText, raw && raw.event, raw && raw.mood, raw && raw.bodyMindText].filter(Boolean).join("\n");
  if (/晚睡|睡很晚|睡太晚|熬夜|昨天太晚睡|趕報告睡/.test(blob) && /累|疲|想睡|打瞌睡|眼睛乾|身體很沉/.test(blob)) return true;
  if (/走(了很多路|很遠|很久)|走路很多/.test(blob) && /腿|腳|膝/.test(blob) && /痠|痛|累/.test(blob)) return true;
  if (/健身|運動|重訓/.test(blob) && /肌肉|腿|肩/.test(blob) && /痠|痛/.test(blob)) return true;
  return false;
}

function looksObviousLessonRelabel(text, raw) {
  const line = asText(text);
  if (!line || !looksExplicitPhysicalLesson(raw)) return false;
  return /看見.{0,10}(疲憊|累|來源)|知道.{0,10}(來自哪裡|為什麼累)|疲憊來源|能察覺.{0,8}(累|疲)|停止了.{0,12}迴圈/.test(line);
}

function looksSilenceCascade(raw, bag, see, answers) {
  if ((answers || []).length) return false;
  if (!seeIsSilent(see)) return false;
  if (!bag || bag.stage !== "stop") return false;
  if (hasExplicitGrowthInRaw(raw, answers)) return false;
  if (insightUnderstand.looksOrdinaryThin(raw)) return true;
  if (looksExplicitPhysicalLesson(raw)) return true;
  if (insightUnderstand.looksNoUnknownLeft(raw)) return true;
  // Stop with silent 03 and no answer / no growth signal → do not invent growth labels.
  const conv = asText(bag.convergence);
  const focus = asText(bag.focus);
  if (!conv && !focus) return true;
  return false;
}

function hasExplicitGrowthInRaw(raw, answers) {
  const blob = highTrustBlob(raw, answers);
  if (/以前.{0,24}(會|都|立刻)|第一次|比以前|今天.{0,16}(先說|先問|沒有立刻)|沒有立刻答應|更快發現/.test(blob)) return true;
  return /立刻(答應|說好)/.test(blob) && /後悔|截止|不太想|不想重做/.test(blob);
}

function upstreamGrowthBridge(raw, answers, see, bag) {
  if (shouldSkipGrow(raw)) return null;
  const high = highTrustBlob(raw, answers);
  if (/不想再分析|原因我已經知道|沒有要再問/.test(high)) return null;
  if (bag && bag.stage === "stop" && !hasExplicitGrowthInRaw(raw, answers)) return null;

  if (/以前.{0,20}立刻|以前這種.{0,16}立刻/.test(high) && /今天.{0,24}(先說|沒有立刻|想休息)|先說今晚想休息/.test(high)) {
    return {
      title: "我今天有先停下來",
      text: "以前這種臨時邀約會立刻說好。今天你先說了自己想休息。",
      type: "ALREADY_DONE",
      maturity: "DOING_SOMETIMES",
      source: "raw-comparison",
      bridge: true,
    };
  }
  if (/截止|手上有自己/.test(high) && /立刻說好|立刻答應/.test(high) && /後悔/.test(high)) {
    return {
      title: "我看見衝突，卻還是答應了",
      text: "手上有自己的截止，還是立刻說好，答應完才後悔。現在的位置是：已經看得見衝突，當下還沒停下來。",
      type: "NOT_YET_DONE",
      maturity: "NOTICING",
      source: "raw",
      bridge: true,
    };
  }
  if (/知道.{0,12}不想|不太想/.test(high) && /立刻答應/.test(high)) {
    return {
      title: "我知道不想，卻還是答應了",
      text: "你當下已經知道自己不太想重做，最後還是立刻答應了。現在的位置是：已經看得見，行動還沒跟上。",
      type: "NOT_YET_DONE",
      maturity: "NOTICING",
      source: "raw",
      bridge: true,
    };
  }
  // Meaningful USER ANSWER: during-event impulse vs after-event regret / no choice space.
  if (
    (answers || []).length &&
    /後悔/.test(high) &&
    /(沒有?空間|衝出去|最重的話|把話說完|當下)/.test(high)
  ) {
    return {
      title: "事後知道，和當下還有沒有空間",
      text: "你已經能在事後看見那句話太重了。現在值得看的成長位置，也許是：情緒正在發生、話還要衝出去的那一秒，還有沒有一點選擇空間。",
      type: "NOT_YET_DONE",
      maturity: "NOTICING",
      source: "user-answer-gap",
      bridge: true,
    };
  }
  if (bag && bag.past && bag.past.used && (bag.past.change || bag.past.difference) && hasExplicitGrowthInRaw(raw, answers)) {
    const change = `${bag.past.difference || ""} ${bag.past.change || ""}`;
    if (insightUnderstand.looksPsychologyUpgrade && insightUnderstand.looksPsychologyUpgrade("", change)) return null;
    if (hasGrowthPosition(change) || /提早|不一樣|先說|先問|停下來/.test(change)) {
      return {
        title: "我這次的反應不一樣",
        text: asText(bag.past.difference) || asText(bag.past.change),
        type: "EMERGING",
        maturity: "NOTICING",
        source: "past-comparison",
        bridge: true,
      };
    }
  }
  if (/沒有立刻|先問|再想一週/.test(high) && hasExplicitGrowthInRaw(raw, answers) && !/平常|總是/.test(high)) {
    return {
      title: "我這次沒有立刻答應",
      text: "這次你沒有立刻答應，而是先替自己留了一點時間。",
      type: "EMERGING",
      maturity: "NOTICING",
      source: "raw",
      bridge: true,
    };
  }
  if (see && insightUnderstand.seeGroundedInRaw(see, raw) && /緊/.test(see) && /開口|說出/.test(see) && /緊/.test(high) && /休息|說/.test(high)) {
    return {
      title: "我帶著緊還是開口了",
      text: "說出口前胸口還是緊，你還是把想休息這件事說出來了。",
      type: "ALREADY_DONE",
      maturity: "NOTICING",
      source: "see-grounded",
      bridge: true,
    };
  }
  return null;
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
      bridge: Boolean(item.bridge),
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
      ? `past.similarity=${bag.past.similarity || ""}; past.difference=${bag.past.difference || ""}; past.change=${bag.past.change || ""}`
      : "past=none";
  const core = thinkingCore.normalizeThinkingCore(bag && bag.thinkingCore);
  return `Return JSON for stage 05 GROW candidates from this context.

RAW:
thanks=${raw.thanksText || ""}
event=${raw.event || ""}
mood=${raw.mood || ""}
bodyMind=${raw.bodyMindText || ""}

USER_ANSWER:
${answers.join("\n") || ""}

SEE:
${see || ""}

UNDERSTAND:
focus=${(bag && bag.focus) || ""}
why=${(bag && bag.whyWorthThinking) || ""}
convergence=${(bag && bag.convergence) || ""}
interpretation=${core.interpretation || ""}
${past}`;
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

  if (answerEngine.userAskedToStop(ctx)) {
    return { ...emptyResult(raw, { understand: bag, meta: { ...meta, skipReason: "user-requested-stop" } }), empty: false };
  }

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
        { role: "user", content: `Return JSON items from this core.\n${JSON.stringify(written)}` },
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
  looksLabelOnlyGrowth,
  evaluateGrowItem,
  gateCandidate,
  shouldSkipGrow,
  looksSilenceCascade,
  looksExplicitPhysicalLesson,
  upstreamGrowthBridge,
  runGrowPipeline,
  projectItems,
  emptyResult,
};
