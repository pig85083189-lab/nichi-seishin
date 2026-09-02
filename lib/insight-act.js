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
  line1: "這個覺察現在不用急著變成任務。",
  line2: "你已經在做了。今天先把這份改變記住，就很好。",
};

const WAIT_FOR_05_COPY = {
  line1: "還沒有確認的覺察。",
  line2: "先在 05 勾選或用自己的話完成覺察，才能整理下一步。",
};

const NO_CONFIRMED_COPY = WAIT_FOR_05_COPY;

const ACT_SYSTEM = `你是 ING 的行動教練，不是洞察產生器。

${answerEngine.ANSWER_ENGINE_VOICE}

先問：這份已確認的覺察，現在真的需要做什麼嗎？
再決定：ACTION_NOW / PRACTICE / OBSERVE / NO_ACTION。
若這份已確認覺察需要帶回生活，請整合今天已確認的覺察、事件、感謝與身心內容，給出 3 個不同且具體的行動。
NO_ACTION 是一等有效結果，但只能在已有 USER_CONFIRMED 覺察後才能判定。

【信任】
只能從 USER_CONFIRMED 05 覺察長出下一步。
未勾選的 05 是假設，禁止當成她已經知道／已經承認。
04 USER ANSWER 與今天原文只用來讓下一步具體，不要再開心理解釋。
不要說「因為你害怕權威」「我發現你其實……」。

【四種結果】
ACTION_NOW：今天／今晚／下次發生時能做的一小步。標題給使用者看：今天可以先做。
PRACTICE：可重複的行為，不是一次性作業。接下來可以慢慢練習。
OBSERVE / NOTICE：觀察一個具體時刻，不是「多觀察情緒」。
TEST：測試新的理解是否真的成立。
PREPARE：事先準備一句話／一個選擇。
RECORD：事情過後記幾件具體的事。
APPRECIATE：若 insight 與支持有關，做一個具體回應。
NO_ACTION：看見就夠了。不要為了有產出而派作業。

優先 LIFE EXPERIMENT：NOTICE / TEST / PRACTICE / PREPARE / RECORD / APPRECIATE。
拒絕：多觀察自己的情緒、保持覺察、好好溝通、持續保持覺察。
每一步都要同時：具體、夠小、有情境、她控制得了、連到已確認覺察。

【品質】
每一步都要同時讓她知道：什麼時候做、到時候做什麼。
必須她控制得了、夠小、貼今天情境。
拒絕主題句：建立界線、勇敢表達、學習拒絕、更愛自己、好好休息、相信自己。
重大決定（離職／分手／搬家／拒絕主管）改成低風險確認／觀察／釐清。
三個行動要分別照顧不同層次：① 當下可做的一小步、② 接下來可練習的方式、③ 可觀察或記錄的提醒。若前面內容不適合行動，才用 NO_ACTION；一旦決定給行動，就必須完整給 3 條，不能只給 1～2 條。
每一條都必須來自已確認覺察，並可用今天的事件、感謝、身心內容讓它更貼近生活；不要把未確認內容當成理由。

title：短、像下一步名稱。
detail：1～2 句。先用一句連回今天的內容，再清楚說何時做什麼。不要長分析。

只輸出 JSON：
{"decision":"ACTION_NOW|PRACTICE|OBSERVE|NOTICE|TEST|PREPARE|RECORD|APPRECIATE|NO_ACTION","noActionCopy":{"line1":"","line2":""},"actions":[{"id":"e1","kind":"ACTION_NOW|PRACTICE|OBSERVE|NOTICE|TEST|PREPARE|RECORD|APPRECIATE","title":"","detail":"","sourceAwarenessIds":["a1"]}]}`;

const GENERIC = /建立界線|勇敢表達|學習拒絕|更愛自己|好好休息|相信自己|照顧自己的感受|多關注自己的需求|好好愛自己|學習建立界線|好好溝通|放下吧/;
const WHEN = /下次|下一次|今天|今晚|明天|這週|本週|當下|睡前|臨時|再遇到|下回|當.{1,16}(時|的時候)|發生時/;
const WHAT = /先停|先確認|先問|問一次|寫下|留意|注意|說一句|說出|不要立刻|不要直接|停一下|核對|留下|只做一件|記三件|記下來|從哪一刻/;
const MAJOR = /立刻分手|馬上搬家|直接離職|切斷關係|跟他分手|辭職不幹|不要再聯絡|直接攤牌|跟對方攤牌|拒絕主管|拒絕加班(?!.*期限)/;
const NEW_PSYCH = /因為你害怕|因為你已經知道自己|你其實是|討好型|依附模式|潛意識|害怕權威|害怕被拋棄|自我價值低|內在小孩/;
const OVER_TASK = /每天記錄五|每天寫五|每天列出|連續七天|每天三次/;
const INSIGHT_VOICE = /我發現你|你其實還沒看見|真正的問題是/;

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
  const blob = `${title} ${detail}`;
  if (!title || !detail) return null;
  const kind = ACT_KINDS.includes(asText(row && row.kind)) ? asText(row && row.kind) : "";
  const failed = [];
  if (!looksTiedToConfirmed(blob, confirmed)) failed.push("unconfirmed");
  if (looksUnconfirmedLeak(blob, ctx)) failed.push("unconfirmed-leak");
  if (looksGenericTheme(blob)) failed.push("generic");
  if (thinkingCore.looksVagueLifeAdvice(blob)) failed.push("vague-observe");
  if (looksMissingWhen(blob)) failed.push("vague-when");
  if (looksMissingWhat(blob)) failed.push("vague-what");
  if (looksNewPsychology(blob)) failed.push("new-psychology");
  if (looksMajorRisk(blob)) failed.push("major-decision");
  if (looksOverTask(blob)) failed.push("over-task");
  const confirmedBlob = confirmed.map((item) => `${item.type || ""} ${item.title || ""} ${item.text || ""}`).join("\n");
  if (/ALREADY_DONE|已經.*休息|更能享受休息|已經把一部分注意力/.test(confirmedBlob) && /安排.{0,8}休息|強制|三十分鐘休息|再做一次/.test(blob)) {
    failed.push("over-task");
  }
  if (voice.looksAbstractJargon && voice.looksAbstractJargon(blob)) failed.push("jargon");
  if (failed.length) {
    meta.dropped.push({ id: asText(row && row.id) || title, failed });
    return null;
  }
  const sourceIds = Array.isArray(row && row.sourceAwarenessIds)
    ? row.sourceAwarenessIds.map(asText).filter((id) => confirmed.some((item) => item.id === id))
    : confirmed.map((item) => item.id);
  return {
    id: asText(row && row.id) || "",
    kind: kind || "PRACTICE",
    title,
    detail,
    text: title,
    sourceAwarenessIds: sourceIds.slice(0, 3),
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
    ...(extra || {}),
  };
}

function projectActions(actions, ctx, extra) {
  const raw = insightDiscovery.trustRaw ? insightDiscovery.trustRaw(ctx) : ctx;
  return {
    variant: "execution-v3",
    actVariant: ACT_VARIANT,
    status: actions.length ? "actions" : "no-action",
    actions: actions.slice(0, 3).map((item, index) => ({
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

function actUserPrompt(ctx, confirmed) {
  const raw = insightDiscovery.trustRaw(ctx);
  const bag = understandFrom(ctx);
  const answers = [bag && bag.answer, bag && bag.answer2].map(asText).filter(Boolean);
  return `【USER_CONFIRMED 05｜唯一可長出行動的來源】
${confirmed.map((item, index) => `${index + 1}. [${item.id}] ${item.title ? `${item.title}｜` : ""}${item.text}${item.type ? `（${item.type}）` : ""}`).join("\n")}

【04 USER ANSWER｜只作情境，不是新解釋】
${answers.join("\n") || "（無）"}

【今天 USER RAW｜讓下一步具體】
感謝：${raw.thanksText || "未寫"}
事件：${raw.event || "未寫"}
心情：${raw.mood || "未選"}
身心：${raw.bodyMindText || "未寫"}

【04 收斂｜低信任】
${asText(bag && bag.convergence) || "（無）"}

未勾選覺察不要出現在理由裡。
不要新心理學。不要主題句。沒有必要就 decision=NO_ACTION、actions=[]。
若 decision 不是 NO_ACTION，請輸出剛好 3 條：第 1 條是今天／下次當下可做的一小步；第 2 條是接下來可以慢慢練習的方式；第 3 條是可觀察、記錄或準備的提醒。三條不可重複，也不可湊空泛建議。
優先具體的生活實驗，不要抽象觀察。`;
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

  if (asText(data && data.decision) === "NO_ACTION" || (data && data.noAction && !Array.isArray(data.actions))) {
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
  const kept = incoming.map((row) => gateAction(row, ctx, confirmed, meta)).filter(Boolean).slice(0, 3);

  if (!kept.length) {
    return { ...emptyNoAction(ctx, { meta }), empty: false };
  }

  return { ...projectActions(kept, ctx, { meta }), empty: false };
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
