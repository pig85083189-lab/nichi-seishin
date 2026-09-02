"use strict";

const voice = require("./ing-voice");
const executionV3 = require("./execution-v3");
const awarenessV3 = require("./awareness-v3");
const insightUnderstand = require("./insight-understand");
const insightDiscovery = require("./insight-discovery");
const thinkingCore = require("./insight-thinking-core");
const answerEngine = require("./ing-answer-engine");

const ACT_VARIANT = "act-v1";
const ACT_KINDS = ["ACTION_NOW", "PRACTICE", "OBSERVE", "NOTICE", "TEST", "PREPARE", "RECORD", "APPRECIATE"];

const NO_ACTION_COPY = {
  line1: "",
  line2: "",
};

const WAIT_FOR_05_COPY = {
  line1: "",
  line2: "",
};

const NO_CONFIRMED_COPY = WAIT_FOR_05_COPY;

const ACT_SYSTEM = `Return JSON only for stage 06 ACT.
Only produce actions from USER_CONFIRMED awareness items provided in the user message.
No commentary outside JSON.

{"decision":"ACTIONS|NO_ACTION","leadIn":"","noActionCopy":{"line1":"","line2":""},"actions":[{"id":"e1","kind":"ACTION_NOW|PRACTICE|OBSERVE|NOTICE|TEST|PREPARE|RECORD|APPRECIATE","title":"","detail":"","sourceAwarenessIds":["a1"]}]}`;

const GENERIC = /$a/;
const WHEN = /$a/;
const WHAT = /$a/;
const MAJOR = /$a/;
const NEW_PSYCH = /$a/;
const OVER_TASK = /$a/;
const INSIGHT_VOICE = /$a/;
const SLOT_ORDER = [
  { slot: "ACTION_NOW", kinds: ["ACTION_NOW"] },
  { slot: "PRACTICE", kinds: ["PRACTICE"] },
  { slot: "OBSERVE", kinds: ["OBSERVE", "NOTICE", "TEST", "PREPARE", "RECORD", "APPRECIATE"] },
];

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

function isGrowActContext(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return data.growVariant === "grow-v1" || data.awarenessGrowVariant === "grow-v1" || data.awarenessStatus === "grow" || data.awarenessStatus === "empty";
}

function shouldRunAct(ctx) {
  return isGrowActContext(ctx);
}

function understandFrom(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return insightUnderstand.normalizeUnderstand(data.understand || data.priorUnderstand || null);
}

function confirmedAwareness(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const bag = awarenessV3.normalizeAwarenessV3({
    items: data.awarenessItems || data.items || [],
    selectedIds: data.awarenessSelectedIds || data.selectedIds || [],
  });
  const selected = new Set(bag.selectedIds);
  const fromItems = bag.items.filter((item) => selected.has(item.id));
  if (fromItems.length) return fromItems;
  return (Array.isArray(data.awarenessSelected) ? data.awarenessSelected : [])
    .map((text, index) => ({ id: `a${index + 1}`, text: asText(text) }))
    .filter((item) => item.text);
}

function unselectedAwareness(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const bag = awarenessV3.normalizeAwarenessV3({
    items: data.awarenessItems || [],
    selectedIds: data.awarenessSelectedIds || [],
  });
  const selected = new Set(bag.selectedIds);
  return bag.items.filter((item) => item.text && !selected.has(item.id));
}

function looksGenericTheme(text) {
  return GENERIC.test(asText(text)) && !WHEN.test(text) && !WHAT.test(text);
}

function looksMissingWhen(text) {
  return !WHEN.test(asText(text));
}

function looksMissingWhat(text) {
  const line = asText(text);
  if (WHAT.test(line)) return false;
  if (GENERIC.test(line) || compactChars(line) < 12) return true;
  return /建立|表達|拒絕|愛自己|照顧感受|關注需求/.test(line) && !/確認|問|停|寫|留意|說/.test(line);
}

function looksNewPsychology(text) {
  return NEW_PSYCH.test(asText(text)) || INSIGHT_VOICE.test(asText(text));
}

function looksMajorRisk(text) {
  return MAJOR.test(asText(text)) || executionV3.looksMajorDecision(text);
}

function looksOverTask(text) {
  return OVER_TASK.test(asText(text));
}

function looksUnconfirmedLeak(text, ctx) {
  if (executionV3.looksUnselectedAsConfirmed) {
    /* use local */
  }
  const selected = confirmedAwareness(ctx).map((item) => item.text).join("\n");
  return unselectedAwareness(ctx).some((item) => {
    if (!item.text) return false;
    if (gramOverlap(text, item.text) >= 0.42 && gramOverlap(text, selected) < 0.28) return true;
    return closeKey(text).includes(closeKey(item.text).slice(0, 10)) && closeKey(item.text).length > 10;
  });
}

function looksTiedToConfirmed(text, confirmed) {
  if (!confirmed.length) return false;
  return confirmed.some((item) => gramOverlap(text, `${item.title || ""} ${item.text}`) >= 0.18 || /停|確認|留意|界線|答應|休息|不舒服|選擇/.test(text));
}

function gateAction(row, ctx, confirmed, meta) {
  const title = asText(row && row.title);
  const detail = asText(row && (row.detail || row.text));
  if (!title || !detail) {
    if (meta) meta.dropped.push({ id: asText(row && row.id) || title, failed: ["missing-fields"] });
    return null;
  }
  if (!confirmed.length) {
    if (meta) meta.dropped.push({ id: asText(row && row.id) || title, failed: ["no-confirmed"] });
    return null;
  }
  const kind = ACT_KINDS.includes(asText(row && row.kind)) ? asText(row && row.kind) : "PRACTICE";
  const sourceIds = Array.isArray(row && row.sourceAwarenessIds)
    ? row.sourceAwarenessIds.map(asText).filter((id) => confirmed.some((item) => item.id === id))
    : confirmed.map((item) => item.id);
  return {
    id: asText(row && row.id) || "",
    kind,
    title,
    detail,
    text: title,
    sourceAwarenessIds: sourceIds.slice(0, 8),
  };
}

function emptyBlocked(ctx, extra) {
  const raw = insightDiscovery.trustRaw ? insightDiscovery.trustRaw(ctx) : ctx;
  return {
    variant: "execution-v3",
    actVariant: ACT_VARIANT,
    status: "blocked",
    blocked: true,
    waitForGrow: true,
    actions: [],
    options: [],
    selectedIds: [],
    sourceSig: executionV3.executionV3SourceSig({ ...ctx, ...raw, growVariant: "grow-v1" }),
    noActionCopy: WAIT_FOR_05_COPY,
    ...(extra || {}),
  };
}

function emptyNoAction(ctx, extra) {
  const raw = insightDiscovery.trustRaw ? insightDiscovery.trustRaw(ctx) : ctx;
  return {
    variant: "execution-v3",
    actVariant: ACT_VARIANT,
    status: "no-action",
    actions: [],
    options: [],
    selectedIds: [],
    sourceSig: executionV3.executionV3SourceSig({ ...ctx, ...raw, growVariant: "grow-v1" }),
    noActionCopy: (extra && extra.noActionCopy) || NO_ACTION_COPY,
    leadIn: "",
    ...(extra || {}),
  };
}

function actUserPrompt(ctx, confirmed) {
  const raw = insightDiscovery.trustRaw(ctx);
  const bag = understandFrom(ctx);
  const answers = [bag && bag.answer, bag && bag.answer2].map(asText).filter(Boolean);
  return `Return JSON for stage 06 ACT from this context.

USER_CONFIRMED:
${confirmed.map((item, index) => `${index + 1}. [${item.id}] ${item.title ? `${item.title}｜` : ""}${item.text}${item.type ? `（${item.type}）` : ""}`).join("\n")}

USER_ANSWER:
${answers.join("\n") || "(none)"}

RAW:
thanks=${raw.thanksText || ""}
event=${raw.event || ""}
mood=${raw.mood || ""}
bodyMind=${raw.bodyMindText || ""}

understand.convergence=${asText(bag && bag.convergence) || ""}

decision=ACTIONS with actions[], or decision=NO_ACTION with actions=[].`;
}

function pickThreeActSlots(kept) {
  const pool = Array.isArray(kept) ? kept.slice() : [];
  return pool.map((item, index) => ({
    ...item,
    kind: ACT_KINDS.includes(asText(item.kind)) ? asText(item.kind) : "PRACTICE",
    id: item.id || `e${index + 1}`,
  }));
}

function projectActions(actions, ctx, extra) {
  const raw = insightDiscovery.trustRaw ? insightDiscovery.trustRaw(ctx) : ctx;
  const leadIn = asText(extra && extra.leadIn) || answerEngine.composeActLeadIn(confirmedAwareness(ctx), raw);
  return {
    variant: "execution-v3",
    actVariant: ACT_VARIANT,
    status: actions.length ? "actions" : "no-action",
    leadIn: actions.length ? leadIn : "",
    actions: actions.slice(0, 8).map((item, index) => ({
      id: item.id || `e${index + 1}`,
      title: item.title,
      detail: item.detail,
      text: item.title,
      kind: item.kind,
      actKind: item.kind,
      sourceAwarenessIds: item.sourceAwarenessIds || [],
    })),
    options: [],
    selectedIds: [],
    sourceSig: executionV3.executionV3SourceSig({ ...ctx, ...raw, growVariant: "grow-v1" }),
    noActionCopy: actions.length ? null : NO_ACTION_COPY,
    ...(extra || {}),
  };
}

async function runActPipeline(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx || {};
  const confirmed = confirmedAwareness(ctx);
  const meta = { dropped: [], calls: 1 };

  if (!confirmed.length) {
    return {
      ...emptyBlocked(ctx, { meta: { ...meta, calls: 0, blocked: true, reason: "NO_USER_CONFIRMED_AWARENESS" } }),
    };
  }

  if (typeof callAi !== "function") throw new Error("missing callAi");

  let data = {};
  try {
    data = await callAi(
      [
        { role: "system", content: ACT_SYSTEM },
        { role: "user", content: actUserPrompt(ctx, confirmed) },
      ],
      "act"
    );
  } catch {
    return { ...emptyNoAction(ctx, { meta: { ...meta, actError: true } }), empty: true };
  }

  if (
    asText(data && data.decision) === "NO_ACTION" ||
    (data && data.noAction && !Array.isArray(data.actions)) ||
    (Array.isArray(data && data.actions) && data.actions.length === 0 && /NO_ACTION/i.test(asText(data && data.decision)))
  ) {
    const copy = data && data.noActionCopy && typeof data.noActionCopy === "object" ? data.noActionCopy : NO_ACTION_COPY;
    return {
      ...emptyNoAction(ctx, {
        noActionCopy: { line1: asText(copy.line1) || NO_ACTION_COPY.line1, line2: asText(copy.line2) || NO_ACTION_COPY.line2 },
        meta,
      }),
      empty: false,
    };
  }

  const incoming = Array.isArray(data && data.actions) ? data.actions : [];
  const kept = incoming.map((row) => gateAction(row, ctx, confirmed, meta)).filter(Boolean);
  const slotted = pickThreeActSlots(kept);
  if (!slotted.length) {
    return { ...emptyNoAction(ctx, { meta }), empty: false };
  }

  const leadIn = asText(data && data.leadIn) || answerEngine.composeActLeadIn(confirmed, insightDiscovery.trustRaw(ctx));
  return { ...projectActions(slotted, ctx, { meta, leadIn }), empty: false };
}

function evaluateActItem(item, ctx) {
  const confirmed = confirmedAwareness(ctx);
  const meta = { dropped: [] };
  const kept = gateAction(item, ctx, confirmed, meta);
  return { drop: !kept, failed: meta.dropped[0] ? meta.dropped[0].failed : [], kept };
}

function actionConfirmationOf(bag, id) {
  const selected = new Set(Array.isArray(bag && bag.selectedIds) ? bag.selectedIds.map(String) : []);
  return selected.has(String(id)) ? "ACTION_CHOSEN" : "ACTION_SUGGESTED";
}

const QUALITY_FIXTURES = {
  A: {
    id: "A",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "工作還在",
      event: "主管臨時改工作，我直接答應重做。",
      mood: "悶",
      bodyMindText: "肩膀緊。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我知道界線，但行動還沒跟上", text: "你其實已經知道自己的界線，現在還沒跟上的，比較像是當事情發生時替自己做選擇。", type: "NOT_YET_DONE" }],
      understand: { stage: "converged", answer: "我想先說明天再補，可是當下還是答應了。", convergence: "知道和做到之間。" },
    },
    good: { title: "下次先確認這一版是否全要重做", detail: "下次工作內容臨時被改時，不要直接開始重做，先確認一次：『這一版確定要全部重做嗎？』", kind: "ACTION_NOW", sourceAwarenessIds: ["a1"] },
  },
  B: {
    id: "B",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有停一下",
      event: "今天當天就察覺不舒服，還沒說出口。",
      mood: "定",
      bodyMindText: "胸口緊，可是有看見。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我已經更快發現自己的不舒服", text: "你還沒做到表達，但今天你已經更早察覺到了。", type: "EMERGING" }],
    },
    good: { title: "下次先停一秒再回答", detail: "下次有人臨時提出要求時，不要立刻回答。先停一下，確認自己現在願不願意。", kind: "PRACTICE", sourceAwarenessIds: ["a1"] },
    badLeap: { title: "明天直接拒絕一件事", detail: "明天對主管說你再也不接受臨時改工作。", kind: "ACTION_NOW" },
  },
  C: {
    id: "C",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有吃飯",
      event: "同事臨時請我幫忙，我先答應了，之後才覺得不太舒服。",
      mood: "平",
      bodyMindText: "有一點悶。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我想留意自己是不是常先答應", text: "你可以開始留意，自己是不是常常先答應，之後才感覺到不舒服。現在還不能說這是穩定模式。", type: "WORTH_OBSERVING" }],
    },
    good: { title: "這週留意第一個反應", detail: "這週如果又遇到臨時要求，可以先留意自己第一個反應是什麼，先答應還是先停一下。", kind: "OBSERVE", sourceAwarenessIds: ["a1"] },
    bad: { title: "你就是會討好別人", detail: "你總是先答應，這是你的模式，明天開始練習拒絕。", kind: "ACTION_NOW" },
  },
  D: {
    id: "D",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "今天有說出口",
      event: "朋友臨時叫我去，我這次先說今晚想休息。",
      mood: "安定",
      bodyMindText: "說完比較鬆。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我已經先替自己做了選擇", text: "你今天其實已經把一部分注意力拿回自己身上了。", type: "ALREADY_DONE" }],
    },
  },
  E: {
    id: "E",
    ctx: {
      growVariant: "grow-v1",
      thanksText: "有休息",
      event: "我其實已經比以前更能享受休息了。",
      mood: "開心",
      bodyMindText: "身體比較鬆。",
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", title: "我更能享受休息了", text: "我其實已經比以前更能享受休息了。", type: "ALREADY_DONE" }],
    },
    badTask: { title: "明天安排三十分鐘休息", detail: "明天晚上強制安排三十分鐘休息時段。", kind: "ACTION_NOW" },
  },
};

module.exports = {
  ACT_VARIANT,
  ACT_KINDS,
  ACT_SYSTEM,
  NO_ACTION_COPY,
  NO_CONFIRMED_COPY,
  WAIT_FOR_05_COPY,
  QUALITY_FIXTURES,
  shouldRunAct,
  isGrowActContext,
  confirmedAwareness,
  unselectedAwareness,
  evaluateActItem,
  gateAction,
  actionConfirmationOf,
  runActPipeline,
  projectActions,
  pickThreeActSlots,
  emptyNoAction,
  emptyBlocked,
  looksGenericTheme,
  looksMissingWhen,
  looksMissingWhat,
  looksNewPsychology,
  looksMajorRisk,
  looksUnconfirmedLeak,
  looksVagueLifeAdvice: thinkingCore.looksVagueLifeAdvice,
};
