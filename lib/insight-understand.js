"use strict";

const voice = require("./ing-voice");
const reflectionV3 = require("./reflection-v3");
const insightDiscovery = require("./insight-discovery");
const thinkingCore = require("./insight-thinking-core");
const answerEngine = require("./ing-answer-engine");

const UNDERSTAND_VARIANT = "understand-v1";
const STAGES = ["stop", "asked1", "asked2", "converged"];

const STOP_COPY = {
  kicker: "",
  line1: "",
  line2: "",
};

const USER_STOP_COPY = {
  kicker: "",
  line1: "",
  line2: "",
};

const UNDERSTAND_REASON_SYSTEM = `Return JSON only for stage 04 UNDERSTAND reason.
No commentary outside JSON.

{"stop":false,"stopReason":"","focus":{"statement":"","source":"raw|see-hypothesis|history-compare|growth","whyWorthThinking":""},"past":{"use":false,"date":"","similarity":"","difference":"","change":"","connectionType":""},"possibilities":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"question":null,"status":"stop|ask"}`;

const UNDERSTAND_REREASON_SYSTEM = `Return JSON only for stage 04 UNDERSTAND after user answer.
No commentary outside JSON.

{"revised":false,"revisionNote":"","keepHistory":false,"enough":true,"question2":null,"convergence":"","status":"converge|ask2"}`;

const UNDERSTAND_WRITE_SYSTEM = `Return JSON only for stage 04 UNDERSTAND user-facing fields.
No commentary outside JSON.

{"focusLine":"","why":"","pastNote":"","question":null,"convergence":""}`;

const PATTERN_CLAIM = /你總是|你一直都是|你反覆|這是你的模式|這證明你一直|人生模式/;
const PATTERN_LANG = /平常|總是|常常|一向|一直都|通常|每次都|比以前|不像以前|跟之前不一樣|不太一樣|這個變化|你過去會|你習慣|你一直都是|跟你平常|你反覆|這是你的模式|你又|又來一次/;
const SEE_AS_FACT = /因為.?03|03 已經|身心覺察已經證明|這證明你|已經證明你/;
const FORCED_PROBLEM = /真正的問題是|你其實不快樂|陰影|你在逃避|你害怕被/;
const PSYCH_UPGRADE = /躲避感覺|逃避感覺|逃離那個感覺|其實是在逃避|害怕被忽略|被拋棄|敢做自己|真實的自己|壓抑真實/;
const LEADING_EXTRA = /你是不是太在意|你是不是害怕|你其實是因為|難道不是因為|是不是就是/;
const HISTORY_MENTION = /你之前|以前你|過往紀錄|上次你|歷史紀錄|前幾次你都|你平常|跟你平常|比以前|不像以前|跟之前/;
const UNCERTAINTY = /可能|也許|或許|好像|似乎|目前比較像|從今天|這次比較能確定/;

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

function seeHypothesis(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return asText(data.bodyMindInsight || data.seeInsight || data.seeHypothesis || "");
}

function rawBlob(raw) {
  return [raw.thanksText, raw.event, raw.mood, raw.bodyMindText, raw.userAnswer].filter(Boolean).join("\n");
}

function understandStep(body) {
  const data = body && typeof body === "object" ? body : {};
  const ctx = data.context && typeof data.context === "object" ? data.context : {};
  const step = asText(data.step || ctx.understandStep || ctx.step);
  return step === "answer" || step === "understand-answer" ? "answer" : "open";
}

function isUnderstandGuide(guide) {
  const data = guide && typeof guide === "object" ? guide : {};
  const bag = data.understand && typeof data.understand === "object" ? data.understand : null;
  if (!bag) return false;
  return Boolean(bag.stage || bag.focus || bag.whyWorthThinking || bag.convergence);
}

function understandIsComplete(value) {
  const bag = normalizeUnderstand(value && value.understand ? value.understand : value);
  if (!bag || !bag.stage) return false;
  if (bag.stage === "asked1" || bag.stage === "asked2") return false;
  return bag.stage === "converged" || bag.stage === "stop";
}

function normalizeUnderstand(raw) {
  const src = raw && typeof raw === "object" ? raw : null;
  if (!src) return null;
  const stage = STAGES.includes(asText(src.stage)) ? asText(src.stage) : "";
  const past = src.past && typeof src.past === "object" ? src.past : null;
  const possibilities = Array.isArray(src.possibilities)
    ? src.possibilities
        .map((item) => ({
          id: asText(item && item.id),
          text: asText(item && item.text),
        }))
        .filter((item) => item.text)
        .slice(0, 3)
    : [];
  const next = {
    variant: UNDERSTAND_VARIANT,
    stage,
    focus: asText(src.focus),
    whyWorthThinking: asText(src.whyWorthThinking),
    pastNote: asText(src.pastNote),
    past: past
      ? {
          used: Boolean(past.used || past.use),
          date: asText(past.date),
          similarity: asText(past.similarity),
          difference: asText(past.difference),
          change: asText(past.change),
          connectionType: asText(past.connectionType),
        }
      : null,
    possibilities,
    question: asText(src.question),
    answer: asText(src.answer),
    question2: asText(src.question2),
    answer2: asText(src.answer2),
    convergence: asText(src.convergence),
    revised: Boolean(src.revised),
    thinkingCore: thinkingCore.normalizeThinkingCore(src.thinkingCore),
    pastDrop: src.pastDrop && typeof src.pastDrop === "object"
      ? {
          date: asText(src.pastDrop.date),
          reason: asText(src.pastDrop.reason),
        }
      : null,
  };
  if (!next.pastDrop || (!next.pastDrop.date && !next.pastDrop.reason)) next.pastDrop = null;
  if (!next.stage && !next.focus && !next.whyWorthThinking && !next.convergence) return null;
  return next;
}

function pastHasUserEvidence(item) {
  const raw = item && item.userRaw && typeof item.userRaw === "object" ? item.userRaw : {};
  const confirmed = item && item.confirmed && typeof item.confirmed === "object" ? item.confirmed : {};
  return Boolean(
    asText(raw.event) ||
      asText(raw.bodyMindText) ||
      (Array.isArray(raw.extensionAnswers) && raw.extensionAnswers.some(asText)) ||
      (Array.isArray(confirmed.awareness) && confirmed.awareness.some(asText))
  );
}

function pastIsAiOnly(item) {
  const provenance = (item && item.provenance) || {};
  if (pastHasUserEvidence(item)) return false;
  return Boolean(provenance.aiHypothesis) && !provenance.userRaw && !provenance.userConfirmed;
}

function understandGatePast(selectedPast) {
  const retrieved = Array.isArray(selectedPast) ? selectedPast.filter((item) => item && item.date) : [];
  const used = retrieved
    .filter((item) => {
      if (pastIsAiOnly(item)) return false;
      if (!pastHasUserEvidence(item)) return false;
      const score = Number(item.score != null ? item.score : item.relevanceScore);
      if (Number.isFinite(score) && score < 3) return false;
      const type = asText(item.connectionType);
      if (type === "same-person" && score < 4) return false;
      return ["same-situation", "same-tension", "same-value", "same-boundary", "same-choice", "prior-success"].includes(type);
    })
    .slice(0, 1);
  return {
    retrieved,
    used,
    rejected: retrieved.filter((item) => !used.some((row) => row.date === item.date)),
  };
}

function formatPastBlock(used) {
  const item = Array.isArray(used) && used[0];
  if (!item) return "";
  const raw = item.userRaw && typeof item.userRaw === "object" ? item.userRaw : {};
  const confirmed = item.confirmed && typeof item.confirmed === "object" ? item.confirmed : {};
  const bits = [];
  if (raw.event) bits.push(`USER_RAW 事件：${asText(raw.event).slice(0, 120)}`);
  if (raw.bodyMindText) bits.push(`USER_RAW 身心：${asText(raw.bodyMindText).slice(0, 80)}`);
  if (Array.isArray(confirmed.awareness) && confirmed.awareness[0]) {
    bits.push(`USER_CONFIRMED：${asText(confirmed.awareness[0]).slice(0, 80)}`);
  }
  return `【可選過往｜假設，不是證明】
${item.date}｜${item.connectionType || "other-relevant"}
${bits.join("\n") || "（無 USER 證據，不要用）"}
沒有真正有用就不要用。不要寫「你一直都是這樣」。`;
}

function seeGroundedInRaw(see, raw) {
  const line = asText(see);
  if (!line) return false;
  const blob = rawBlob(raw);
  if (gramOverlap(line, blob) >= 0.28) return true;
  const leftover = closeKey(line.replace(/你可能|也許|或許|好像|值得留意|我注意到/g, ""));
  return leftover.length >= 6 && closeKey(blob).includes(leftover.slice(0, Math.min(8, leftover.length)));
}

function looksSeeParaphrase(focus, see) {
  if (!asText(focus) || !asText(see)) return false;
  return gramOverlap(focus, see) >= 0.62 || closeKey(focus).includes(closeKey(see).slice(0, 10));
}

function looksForcedPattern(text) {
  return PATTERN_CLAIM.test(asText(text)) || SEE_AS_FACT.test(asText(text));
}

function hasPatternEvidence(raw, usedPast) {
  if (Array.isArray(usedPast) && usedPast.some((item) => item && (item.date || item.used || (item.userRaw && item.userRaw.event)))) {
    return true;
  }
  const blob = rawBlob(raw || {});
  return /以前.{0,24}(會|都)|以前這種|比以前|跟以前|過去.{0,8}會|我一直|我習慣|第一次/.test(blob);
}

function looksUnsupportedPattern(text, raw, usedPast) {
  const line = asText(text);
  if (!line) return false;
  if (PATTERN_CLAIM.test(line)) return true;
  if (!PATTERN_LANG.test(line) && !HISTORY_MENTION.test(line)) return false;
  return !hasPatternEvidence(raw, usedPast);
}

function rewriteUnsupportedPattern(text, raw, usedPast) {
  const line = asText(text);
  if (!looksUnsupportedPattern(line, raw, usedPast)) return line;
  let next = line
    .replace(/這跟你平常立刻答應不太一樣[。.]?/g, "這次你沒有立刻答應。")
    .replace(/這跟你平常.{0,16}不太一樣/g, "這次")
    .replace(/跟你平常/g, "這次")
    .replace(/你平常/g, "這次你")
    .replace(/不像以前|跟之前不一樣|比以前|不太一樣/g, "")
    .replace(/這個變化/g, "這次")
    .replace(/平常|總是|常常|一向|通常|每次都/g, "")
    .replace(/一直都/g, "")
    .replace(/你過去會/g, "這次你")
    .replace(/你習慣/g, "這次")
    .replace(/你一直都是|這是你的模式|你反覆/g, "這次")
    .replace(/[，,]{2,}/g, "，")
    .replace(/\s{2,}/g, " ")
    .replace(/^，|，$/g, "")
    .trim();
  if (!next || looksUnsupportedPattern(next, raw, usedPast)) {
    const blob = `${rawBlob(raw || {})} ${next}`;
    if (/沒有立刻|先說|先問|再想/.test(blob)) return "這次你沒有立刻答應。";
  }
  return next || line;
}

function looksPsychologyUpgrade(answer, claim) {
  const a = asText(answer);
  const c = asText(claim);
  if (!a || !c) return false;
  if (/躲避感覺|逃避感覺|逃離那個感覺|其實是在逃避|躲避.*感覺/.test(c) && !/逃避|躲避感覺/.test(a)) return true;
  if (/害怕被忽略|被拋棄|自己不重要/.test(c) && /不是害怕被忽略|不是被忽略|今天.{0,8}累|只是累/.test(a)) return true;
  if (/敢做自己|真實的自己/.test(c) && !/敢做|真實的自己/.test(a) && /休息|講出來|想休息/.test(a)) return true;
  if (FORCED_PROBLEM.test(c) && !FORCED_PROBLEM.test(a)) return true;
  if (PSYCH_UPGRADE.test(c) && !PSYCH_UPGRADE.test(a) && /怕.{0,12}不配合|只是累|想休息/.test(a)) return true;
  return false;
}

function looksConflictsWithAnswer(answer, claim) {
  const a = asText(answer);
  const c = asText(claim);
  if (!a || !c) return false;
  if (/不是害怕被忽略/.test(a) && /害怕被忽略/.test(c) && !/不是|不一定|沒有/.test(c)) return true;
  if (/怕.{0,12}不配合/.test(a) && /不是在評估拒絕|不是.*不配合|躲避感覺|逃避感覺/.test(c)) return true;
  if (/累/.test(a) && /害怕被忽略/.test(c) && !/不一定|不是/.test(c)) return true;
  return false;
}

function groundedConvergenceFromAnswer(prior, answer) {
  const a = asText(answer);
  if (/怕.{0,12}不配合/.test(a)) {
    return "從你的回答來看，目前比較能確定的是：當下有點怕被看成不配合，所以還是答應了。";
  }
  if (/不是害怕被忽略/.test(a) && /累/.test(a)) {
    return "從你的回答來看，前面那個推測不太成立。比較像是今天累，剛好想有人在。";
  }
  if (/講出來|說出來/.test(a) && /不是焦慮|擔心掃興|想休息/.test(a)) {
    return "從你的回答來看，比較像是把想休息這件事說出來了，不是焦慮消失。";
  }
  if (/後悔/.test(a) && /(沒有?空間|衝出去|最重)/.test(a)) {
    return "從你的回答來看，目前比較能確定的是：當下幾乎沒有空間，話已經衝出去了，事後才後悔。這不是故事結束，而是『事後知道』和『當下還有沒有選擇』之間，還有一個距離。";
  }
  const short = a.replace(/。+$/g, "");
  if (compactChars(short) >= 6 && compactChars(short) <= 80) {
    return `從你的回答來看，目前比較能確定的是：${short}。`;
  }
  return "從你的回答來看，目前比較能確定的是你剛說的那件事。";
}

function looksPrematureClosure(text) {
  return /已[經经]是.{0,12}(能看到|看得到|看得懂)的全部|沒有再值得|到此為止|就這樣了|沒有更多可想|這已經夠了，?不用再/.test(asText(text));
}

function gatePostAnswerConvergence(claim, answer, raw, prior, meta) {
  return asText(claim) || groundedConvergenceFromAnswer(prior, answer);
}

function looksThinAmbiguous(raw) {
  const blob = rawBlob(raw || {});
  if (looksNoUnknownLeft(raw) || looksOrdinaryThin(raw)) return false;
  const emotion = /難過|失落|空|低落/.test(blob);
  const noExplicitCause = !/因為.{0,10}(怕|不配合|不被尊重)|原因是|我很清楚/.test(blob);
  return emotion && noExplicitCause;
}

function looksRawRestatement(text, raw) {
  const line = asText(text);
  if (!line) return false;
  const blob = rawBlob(raw || {});
  if (gramOverlap(line, blob) >= 0.42) return true;
  const eventHit = /沒回|沒有回|已讀|朋友/.test(line) && /沒回|沒有回|已讀|朋友/.test(blob);
  const emotionHit = /難過|失落|低落/.test(line) || (/空/.test(line) && /難過|失落|低落|空/.test(blob));
  const bodyHit = /胸口|空/.test(line) && /胸口|空/.test(blob);
  const noNewAngle = !/還可以怎麼|另一|或者|不一定|值得想/.test(line);
  return eventHit && emotionHit && bodyHit && noNewAngle;
}

function looksChangedResponsePast(item, raw) {
  const pastEvent = asText(item && item.userRaw && item.userRaw.event);
  const today = rawBlob(raw || {});
  if (!pastEvent || compactChars(pastEvent) < 8) return false;
  const pastYes = /立刻答應|還是答應|立刻說好/.test(pastEvent);
  const todayPause = /沒有立刻|先問|先說|今晚想休息|再想一週/.test(today);
  return pastYes && todayPause;
}

function deterministicPastCompare(item) {
  return {
    used: true,
    date: asText(item && item.date),
    similarity: "都碰到要不要立刻答應的情境",
    difference: "上次比較像立刻答應；這次有先停下來。",
    change: "反應不一樣了：這次沒有立刻開始做。",
    connectionType: asText(item && item.connectionType) || "same-situation",
  };
}

function looksNewAmbiguity(answer) {
  return /還說不清楚|不知道.{0,12}面對|不確定是|可是我還/.test(asText(answer)) && compactChars(answer) >= 12;
}

function looksSufficientAnswer(answer) {
  const a = asText(answer);
  if (compactChars(a) < 8) return false;
  if (looksNewAmbiguity(a)) return false;
  return /怕|因為|不想|比較像|不是.{0,12}是|想先|累|休息/.test(a);
}

function asksToLabelAlreadyExplained(q2, answer) {
  const q = asText(q2);
  const a = asText(answer);
  if (!q || !a) return false;
  if (/你說[『「]|這個[『「]/.test(q)) return true;
  const quoted = q.match(/[『「]([^』」]{4,})[』」]/g) || [];
  return quoted.some((chunk) => closeKey(a).includes(closeKey(chunk.replace(/[『「』」]/g, ""))));
}

function looksLeadingQuestion(text) {
  const q = asText(text);
  if (!q) return false;
  return reflectionV3.looksLeadingQuestion(q) || LEADING_EXTRA.test(q);
}

function whyAlreadyAnswered(question, raw) {
  const q = asText(question);
  const blob = rawBlob(raw);
  if (!q || !blob) return false;
  if (voice.looksAnswerAlreadyInInput(q, blob)) return true;
  if (/為什麼|什麼原因|怎麼會|當時為什麼/.test(q) && /因為|原因是|就是|怕.{0,16}所以|所以我/.test(blob)) return true;
  const qKey = closeKey(q.replace(/你|當時|為什麼|怎麼|是不是|嗎|呢/g, ""));
  if (qKey.length >= 8 && closeKey(blob).includes(qKey)) return true;
  return false;
}

function questionAlreadyAnswered(question, raw) {
  return whyAlreadyAnswered(question, raw);
}

function looksOrdinaryThin(raw) {
  const blob = rawBlob(raw);
  if (compactChars(blob) < 12) return true;
  const thin = /很普通|沒什麼特別|沒有特別想|上班下班|討論.{0,8}進度/.test(blob);
  const tension = /我不舒服|有點不舒服|不想|難過|第一次|沒有立刻|留下來|答應|拒絕|後悔|胸口|肩膀緊/.test(blob);
  return thin && !tension && compactChars(blob) < 80;
}

function looksNoUnknownLeft(raw, known) {
  const blob = rawBlob(raw);
  if (compactChars(blob) < 18) return false;
  if (answerEngine.userAskedToStop(raw)) return true;
  const closed = /原因我已經知道|我已經想清楚|我很清楚.{0,16}(為什麼|沒有要再)|沒有要再問|不想再分析/.test(blob);
  const leftoverTension = /可是|卻|不知道|說不清楚|還沒|不太想|不舒服但|沒有立刻|第一次|滾出去|搬出去/.test(blob);
  if (closed) return !leftoverTension;
  if (answerEngine.integratedReflectionSeed(raw) || answerEngine.understandFocusSeed(raw)) return false;
  return false;
}

function questionText(value) {
  if (value == null) return "";
  if (typeof value === "object") return asText(value.text || value.question || value.unknown);
  return asText(value);
}

function seedFocus(raw) {
  const blob = rawBlob(raw);
  if (looksNoUnknownLeft(raw) || looksOrdinaryThin(raw)) return null;
  const careReject = answerEngine.understandFocusSeed(raw);
  if (careReject) return careReject;
  const integrated = answerEngine.integratedUnderstandFocus(raw);
  if (integrated) return integrated;
  if (/感謝|謝謝/.test(blob) && /好好說話|想到別人|出現在|身邊的每一個人|別人可以更好/.test(blob)) {
    return {
      statement: "這幾件感謝裡，關心有沒有真的出現在對待裡。",
      source: "raw",
      whyWorthThinking: "感謝已經寫下了。值得再想的，也許是這份對待換到最親近、也最容易有情緒的人面前，還能不能成立。",
    };
  }
  if (/請我|打電話|家人聊天|有人聽/.test(blob) && /放鬆|鬆|開心/.test(blob)) {
    return {
      statement: "完成事情之後的鬆，和有人在的時刻，可能不是同一件事。",
      source: "raw",
      whyWorthThinking: "值得看的也許是：讓身體鬆下來的，比較像任務結束，還是比較像有人在。",
    };
  }
  if (/知道.{0,16}不想|不太想/.test(blob) && /答應|留下/.test(blob)) {
    return {
      statement: "知道不太想，和最後還是答應之間的距離。",
      source: "raw",
      whyWorthThinking: "你已經看見自己的不舒服。真正值得想的，也許不是為什麼又答應了，而是看見之後，什麼讓行動還沒跟上。",
    };
  }
  if (/立刻(答應|說好)/.test(blob) && /後悔|截止/.test(blob)) {
    return {
      statement: "知道手上有事，和最後還是立刻說好之間的距離。",
      source: "raw",
      whyWorthThinking: "你已經看見衝突。真正值得想的，也許是看見之後，什麼讓行動還沒跟上。",
    };
  }
  if (/最重的話|把話說完/.test(blob) && /吵|火|胸口熱/.test(blob)) {
    return {
      statement: "火上來時把話說完，和把最重的話說出去，可能不是同一件事。",
      source: "raw",
      whyWorthThinking: "妳把話說完了。值得看的也許是：那一秒比較像留下空間，還是比較像把最重的話送出去。",
    };
  }
  if (/沒有立刻(答應|說好)|第一次先說想休息|第一次.{0,10}(先說|想休息)/.test(blob) && !/先寫下來|寫下來再傳/.test(blob)) {
    return {
      statement: "今天真正值得看的，可能是你這次沒有立刻答應。",
      source: "growth",
      whyWorthThinking: "這次你沒有立刻答應。值得看看這個選擇，而不是急著替它下結論。",
    };
  }
  if (/先寫下來|寫下來再傳/.test(blob)) {
    return {
      statement: "先寫下來再傳，這次回應方式和直接衝出去不一樣。",
      source: "growth",
      whyWorthThinking: "值得看的也許是：什麼條件讓妳這次先停住、先寫，而不是立刻把話送出去。",
    };
  }
  if (/先答應|之後才/.test(blob) && /不舒服|悶/.test(blob)) {
    return {
      statement: "先答應、之後才不舒服——這個時間差。",
      source: "raw",
      whyWorthThinking: "值得想的也許是：下一次『先答應』出現時，什麼條件會讓妳先停一下。",
    };
  }
  if (/難過|空/.test(blob) && /不確定|想太多|有點/.test(blob)) {
    return {
      statement: "這份難過還可以怎麼理解。",
      source: "raw",
      whyWorthThinking: "難過出現了，但不只有一種解釋。值得先看，它比較接近什麼。",
    };
  }
  return null;
}

function seedQuestion(raw, focus) {
  const blob = rawBlob(raw);
  const focusLine = asText(focus && focus.statement);
  if (looksNoUnknownLeft(raw) || looksOrdinaryThin(raw)) return null;
  if (answerEngine.understandFocusSeed(raw) || (/滾出去|搬出去/.test(blob) && /媽媽|母親/.test(blob))) {
    return "真正讓妳難受的，比較像搬出去這件事本身，還是她說話的方式讓妳覺得被推開？";
  }
  if (answerEngine.integratedUnderstandFocus(raw)) {
    return "把感謝、今天發生的事和身體的感覺放在一起時，哪一段最影響妳今天的狀態，還是它們其實沒有直接關係？";
  }
  if (/感謝|謝謝/.test(blob) && /好好說話|想到別人|出現/.test(blob)) {
    return "如果換成最親近、也最容易讓妳有情緒的人，這份『好好說話』還一樣成立嗎？";
  }
  if (/最重的話|把話說完/.test(blob) && /吵|火|胸口/.test(blob)) {
    return "如果當下先把最重的那句話晚一步再說，妳覺得結果會比較接近妳要的，還是更難？";
  }
  if (/知道.{0,16}不想|不太想/.test(blob) && /答應/.test(blob)) {
    return "下一次『知道不太想』再出現時，什麼條件會讓妳不立刻答應？";
  }
  if (/沒有立刻答應|再想一週/.test(blob)) {
    return "如果壓力再大一點、對方更急一點，這份『再想一週』還站得住嗎？";
  }
  if (/先答應|之後才/.test(blob) && /不舒服|悶/.test(blob)) {
    return "下一次『先答應』出現時，什麼條件會讓妳先停一下，而不是事後才覺得不舒服？";
  }
  if (/先寫下來|寫下來再傳/.test(blob)) {
    return "如果當下情緒更急、沒有時間先寫，妳覺得自己還能留住這次的空間嗎？";
  }
  if (/第一次先說想休息|先說我想休息/.test(blob)) {
    return "如果叫妳走的人是更難拒絕的人，這份『先說想休息』還站得住嗎？";
  }
  if (/當眾打斷|太大驚小怪/.test(blob)) {
    return "如果當下沒有別人在場，妳對自己的火，還會一樣先轉成『是不是我想太多』嗎？";
  }
  if (/朋友|媽媽|家人/.test(blob) && /放鬆|請我|打電話/.test(blob) && /專案|自己做完/.test(blob)) {
    return "如果今天沒有那些有人的時刻，完成專案之後，身體還會一樣鬆嗎？";
  }
  if (focusLine && /距離|邊界|成立|對待|答應/.test(focusLine)) {
    return null;
  }
  return null;
}

function looksPositiveOnly(raw) {
  const blob = rawBlob(raw);
  return /開心|幸福|輕鬆|第一次沒有|開始比較能|有進步|終於停下來/.test(blob) && !/難受|生氣|委屈|崩潰|討厭/.test(blob);
}

function sanitizeQuestion(question, raw, meta) {
  const q = questionText(question);
  if (!q) return null;
  return q;
}

function gateFocus(focus, raw, known, see, meta, usedPast) {
  const statement = asText(focus && focus.statement);
  const why = asText(focus && focus.whyWorthThinking);
  if (!statement) return null;
  return {
    statement,
    source: asText(focus && focus.source) || "raw",
    whyWorthThinking: why,
  };
}

function gatePastFromReason(past, used, raw, meta) {
  const item = Array.isArray(used) && used[0];
  if (!item) {
    if (meta) meta.pastDrop = { date: "", reason: "" };
    return null;
  }
  const asked = past && typeof past === "object" ? past : {};
  const changed = looksChangedResponsePast(item, raw);
  if (asked.use === false && !changed) {
    if (meta) meta.pastDrop = { date: asText(item.date), reason: "IRRELEVANT_AFTER_REASONING" };
    return null;
  }
  if (asked.use !== true && asked.use !== false && !asText(asked.similarity) && !changed) {
    if (meta) meta.pastDrop = { date: asText(item.date), reason: "UNNECESSARY" };
    return null;
  }
  if (pastIsAiOnly(item) || !pastHasUserEvidence(item)) {
    meta.dropped.push({ id: "past", failed: ["ai-only-history"], stage: "js" });
    if (meta) meta.pastDrop = { date: asText(item.date), reason: "INSUFFICIENT_SIMILARITY" };
    return null;
  }
  if (asked.use === false && changed) {
    if (meta) meta.pastForced = "changed-response";
    return deterministicPastCompare(item);
  }
  const similarity = asText(asked.similarity) || (changed ? deterministicPastCompare(item).similarity : "");
  const difference = asText(asked.difference) || (changed ? deterministicPastCompare(item).difference : "");
  const change = asText(asked.change) || (changed ? deterministicPastCompare(item).change : "");
  if (looksForcedPattern(`${similarity} ${difference} ${change}`)) {
    meta.dropped.push({ id: "past", failed: ["false-pattern"], stage: "js" });
    if (meta) meta.pastDrop = { date: asText(item.date), reason: "IRRELEVANT_AFTER_REASONING" };
    return null;
  }
  if (meta) meta.pastDrop = null;
  return {
    used: true,
    date: asText(item.date),
    similarity,
    difference,
    change,
    connectionType: asText(item.connectionType || asked.connectionType),
  };
}

function gatePossibilities(list, raw, see, meta) {
  const rows = Array.isArray(list) ? list : [];
  return rows
    .map((item, index) => ({
      id: asText(item && item.id) || ["A", "B", "C"][index] || `p${index + 1}`,
      text: asText(item && item.text),
    }))
    .filter((item) => item.text)
    .slice(0, 3);
}

function writerMentionsHistoryWithoutPast(text, pastUsed, raw) {
  return false;
}

function silenceResult(raw, known, extra) {
  const stopReason = asText(extra && extra.meta && extra.meta.stopReason);
  const copy = stopReason === "user-requested-stop" ? USER_STOP_COPY : STOP_COPY;
  return {
    variant: "reflection-v3",
    status: "silence",
    discovery: null,
    knownByUser: known,
    coreQuote: "",
    questions: [],
    sourceSig: reflectionV3.reflectionV3SourceSig(raw),
    understand: {
      variant: UNDERSTAND_VARIANT,
      stage: "stop",
      focus: "",
      whyWorthThinking: copy.line1,
      pastNote: "",
      past: null,
      possibilities: [],
      question: "",
      answer: "",
      question2: "",
      answer2: "",
      convergence: copy.line2,
      revised: false,
    },
    ...(extra || {}),
  };
}

function projectUnderstand(bag, raw, known) {
  const data = normalizeUnderstand(bag) || bag;
  const stage = data.stage;
  const coreQuote = asText(data.convergence || data.focus);
  const liveQuestion = stage === "asked2" ? data.question2 : stage === "asked1" ? data.question : "";
  const status = stage === "stop" ? "silence" : "understand";
  return {
    variant: "reflection-v3",
    status,
    understand: data,
    knownByUser: known,
    coreQuote: status === "silence" ? "" : coreQuote,
    questions: liveQuestion
      ? [
          {
            id: stage === "asked2" ? "q2" : "q1",
            title: "",
            insight: coreQuote,
            question: liveQuestion,
            text: data.whyWorthThinking,
          },
        ]
      : [],
    discovery:
      status === "silence"
        ? null
        : {
            statement: coreQuote,
            why: data.whyWorthThinking,
            question: liveQuestion || null,
          },
    sourceSig: reflectionV3.reflectionV3SourceSig(raw),
  };
}

function reasonUserPrompt(raw, known, see, usedPast) {
  return `Return JSON for stage 04 UNDERSTAND reason from this context.

RAW:
thanks=${raw.thanksText || ""}
event=${raw.event || ""}
mood=${raw.mood || ""}
bodyMind=${raw.bodyMindText || ""}
${raw.userAnswer ? `userAnswer=${raw.userAnswer}` : ""}

KNOWN:
${known.map((item) => `- ${item.text}`).join("\n") || "-"}

SEE_HYPOTHESIS:
${see || ""}

PAST:
${formatPastBlock(usedPast)}`;
}

function rereasonUserPrompt(raw, known, see, prior, answer) {
  return `${reasonUserPrompt({ ...raw, userAnswer: answer }, known, see, prior && prior.past && prior.past.used ? [{ ...prior.past, userRaw: { event: prior.past.similarity } }] : [])}

PRIOR:
focus=${prior.focus || ""}
why=${prior.whyWorthThinking || ""}
possibilities=${(prior.possibilities || []).map((item) => item.text).join(" / ")}
question=${prior.question || prior.question2 || ""}
pastUsed=${prior.past && prior.past.used ? "yes" : "no"}

USER_ANSWER:
${answer}`;
}

function writeUserPrompt(core) {
  return `Return JSON for stage 04 UNDERSTAND user-facing fields from this core.
${JSON.stringify(core)}`;
}

function applyWriter(core, written, pastUsed, meta, raw) {
  const next = {
    focusLine: asText(written && written.focusLine) || core.focus,
    why: asText(written && written.why) || core.whyWorthThinking,
    pastNote: pastUsed ? asText(written && written.pastNote) || core.pastNote : "",
    question: written && written.question == null ? core.question : asText(written && written.question) || core.question,
    convergence: asText(written && written.convergence) || core.convergence,
  };
  if (!pastUsed) next.pastNote = "";
  return next;
}

async function runOpen(callAi, ctx, usedPast) {
  const raw = insightDiscovery.trustRaw(ctx);
  const known = insightDiscovery.buildKnownByUser(raw);
  const see = seeHypothesis(ctx);
  const gatedPast = understandGatePast(usedPast);
  const meta = { knownCount: known.length, dropped: [], challenged: [], step: "open", pastRetrieved: (usedPast || []).length, pastUsed: gatedPast.used.length };
  if (answerEngine.userAskedToStop(ctx)) {
    return { ...silenceResult(raw, known, { meta: { ...meta, stopReason: "user-requested-stop", calls: 0 } }), empty: false };
  }
  const explicitlyClosed = looksNoUnknownLeft(raw, known);
  const unresolvedTension = !explicitlyClosed && Boolean(answerEngine.integratedUnderstandFocus(raw) || answerEngine.understandFocusSeed(raw));
  if ((looksNoUnknownLeft(raw, known)) && !seeGroundedInRaw(see, raw) && !unresolvedTension) {
    return { ...silenceResult(raw, known, { meta: { ...meta, stopReason: "already-clear" } }), empty: false };
  }

  let reasonData = {};
  try {
    reasonData = await callAi(
      [
        { role: "system", content: UNDERSTAND_REASON_SYSTEM },
        { role: "user", content: reasonUserPrompt(raw, known, see, gatedPast.used) },
      ],
      "reason"
    );
  } catch {
    return { ...silenceResult(raw, known, { meta: { ...meta, reasonError: true } }), empty: true };
  }

  const modelStop = Boolean(reasonData && reasonData.stop);
  const prematureStop =
    unresolvedTension ||
    answerEngine.looksPrematureStop(`${asText(reasonData && reasonData.stopReason)} ${asText(reasonData && reasonData.focus && reasonData.focus.whyWorthThinking)}`);
  if (modelStop && looksNoUnknownLeft(raw, known) && !seeGroundedInRaw(see, raw) && !prematureStop) {
    return { ...silenceResult(raw, known, { meta: { ...meta, stopReason: asText(reasonData.stopReason) || "model-stop" } }), empty: false };
  }
  if (modelStop && prematureStop) {
    meta.ignoredPrematureStop = true;
  }

  let focus = gateFocus(reasonData && reasonData.focus, raw, known, see, meta, gatedPast.used);
  if (!focus) {
    const seeded = seedFocus(raw);
    focus = seeded ? gateFocus(seeded, raw, known, see, meta, gatedPast.used) : null;
    if (seeded && focus) meta.seededFocus = true;
  }
  if (!focus) {
    if (unresolvedTension) {
      const forced = seedFocus(raw);
      if (forced) {
        focus = forced;
        meta.seededFocus = true;
        meta.forcedUnresolvedFocus = true;
      }
    }
  }
  if (!focus) {
    return { ...silenceResult(raw, known, { meta }), empty: false };
  }

  const past = gatePastFromReason(reasonData && reasonData.past, gatedPast.used, raw, meta);
  let possibilities = gatePossibilities(reasonData && reasonData.possibilities, raw, see, meta);
  if (possibilities.length === 1 && /就是因為|一定是|證明你/.test(possibilities[0].text)) {
    meta.dropped.push({ id: "possibilities", failed: ["forced-one"], stage: "js" });
    possibilities.pop();
  }
  if (!possibilities.length && unresolvedTension) {
    possibilities = [
      { id: "A", text: "媽媽希望妳搬出去，可能是在擔心家裡反覆出現激烈爭吵。" },
      { id: "B", text: "對妳來說，那句話也可能像是在說『這個家不要我了』。" },
      { id: "C", text: "也可能兩邊都有一點，真正刺痛的是說話方式讓妳覺得被推開。" },
    ];
    meta.seededPossibilities = true;
  }
  let question = sanitizeQuestion(reasonData && reasonData.question, raw, meta);

  const core = {
    focus: focus.statement,
    whyWorthThinking: focus.whyWorthThinking,
    pastNote: past ? [past.similarity, past.difference, past.change].filter(Boolean).join(" ") : "",
    question,
    convergence: "",
    possibilities,
    past,
  };

  let written = {
    focusLine: focus.statement,
    why: focus.whyWorthThinking,
    pastNote: core.pastNote,
    question,
    convergence: "",
  };
  try {
    const out = await callAi(
      [
        { role: "system", content: UNDERSTAND_WRITE_SYSTEM },
        { role: "user", content: writeUserPrompt(core) },
      ],
      "write"
    );
    written = applyWriter(core, out, Boolean(past), meta, raw);
    written.question = sanitizeQuestion(written.question, raw, meta);
  } catch {
    /* keep core */
  }

  if (!written.question) {
    const seededQ = seedQuestion(raw, focus);
    const rescued = seededQ ? sanitizeQuestion(seededQ, raw, meta) : null;
    if (rescued) {
      written.question = rescued;
      meta.seededQuestion = true;
    }
  }

  if (looksForcedPattern(`${written.focusLine} ${written.why}`) || insightDiscovery.looksOverreach(written.focusLine, written.why)) {
    if (!unresolvedTension) {
      return { ...silenceResult(raw, known, { meta: { ...meta, writerFatal: true } }), empty: false };
    }
    meta.keptDespiteWriterFatal = true;
  }
  written.focusLine = rewriteUnsupportedPattern(written.focusLine, raw, past ? [past] : []);
  written.why = rewriteUnsupportedPattern(written.why, raw, past ? [past] : []);

  const stage = written.question ? "asked1" : "converged";
  let convergence = stage === "converged" ? written.convergence || written.why || written.focusLine : "";
  convergence = rewriteUnsupportedPattern(convergence, raw, past ? [past] : []);
  if (stage === "converged" && !written.question && looksThinAmbiguous(raw) && !unresolvedTension) {
    return { ...silenceResult(raw, known, { meta: { ...meta, stopReason: "thin-ambiguous" } }), empty: false };
  }

  const bag = {
    variant: UNDERSTAND_VARIANT,
    stage,
    focus: written.focusLine,
    whyWorthThinking: written.why,
    pastNote: written.pastNote,
    past,
    pastDrop: past ? null : meta.pastDrop || (gatedPast.used[0] ? { date: asText(gatedPast.used[0].date), reason: meta.pastDrop && meta.pastDrop.reason ? meta.pastDrop.reason : "UNNECESSARY" } : gatedPast.retrieved.length ? { date: asText(gatedPast.retrieved[0].date), reason: "INSUFFICIENT_SIMILARITY" } : null),
    possibilities,
    question: written.question || "",
    answer: "",
    question2: "",
    answer2: "",
    convergence,
    revised: false,
    thinkingCore: thinkingCore.coreFromSee(see, {
      interpretation: written.focusLine,
      whyWorthKnowing: written.why,
      status: "hypothesis",
      source: see ? "see" : "raw",
    }),
  };
  return {
    ...projectUnderstand(bag, raw, known),
    empty: false,
    meta,
  };
}

function q2Justified(reasonData, answer, raw, meta, prior) {
  if (!reasonData || reasonData.enough || reasonData.status === "converge") return null;
  const q2raw = questionText(reasonData.question2);
  if (!q2raw) return null;
  if (looksSufficientAnswer(answer) && !looksNewAmbiguity(answer)) {
    if (meta) meta.q2Skip = { knownAfterQ1: asText(answer), openUnknown: "", why: "answered" };
    return null;
  }
  if (asksToLabelAlreadyExplained(q2raw, answer)) {
    if (meta) meta.q2Skip = { knownAfterQ1: asText(answer), openUnknown: "", why: "label-choice" };
    return null;
  }
  const q2 = sanitizeQuestion(reasonData.question2, { ...raw, userAnswer: `${raw.userAnswer || ""}\n${answer}` }, meta);
  if (!q2) return null;
  if (!looksNewAmbiguity(answer) && gramOverlap(q2, answer) >= 0.4) return null;
  if (prior && prior.question && gramOverlap(q2, prior.question) >= 0.62) return null;
  const changed = Boolean(reasonData.revised) || looksNewAmbiguity(answer) || /不是|其實|另外|其他/.test(answer);
  if (!changed) return null;
  return q2;
}

async function runAnswer(callAi, ctx, priorInput) {
  const raw = insightDiscovery.trustRaw(ctx);
  const known = insightDiscovery.buildKnownByUser(raw);
  const see = seeHypothesis(ctx);
  const prior = normalizeUnderstand(priorInput || ctx.understand || ctx.priorUnderstand);
  const answer = asText(raw.userAnswer || ctx.userAnswer || ctx.answer);
  const meta = { knownCount: known.length, dropped: [], challenged: [], step: "answer", revised: false };
  if (!prior || !answer || compactChars(answer) < 4) {
    return { ...projectUnderstand(prior || { stage: "asked1", focus: "", whyWorthThinking: "" }, raw, known), empty: true, meta };
  }

  const answeredPrior = {
    ...prior,
    answer: prior.stage === "asked2" ? prior.answer : answer,
    answer2: prior.stage === "asked2" ? answer : prior.answer2,
  };

  let reasonData = {};
  try {
    reasonData = await callAi(
      [
        { role: "system", content: UNDERSTAND_REREASON_SYSTEM },
        { role: "user", content: rereasonUserPrompt(raw, known, see, answeredPrior, answer) },
      ],
      "reason"
    );
  } catch {
    const fallback = {
      ...answeredPrior,
      stage: "converged",
      convergence: thinkingCore.answerContradictsInterpretation(answer, answeredPrior.focus)
        ? groundedConvergenceFromAnswer(answeredPrior, answer)
        : answeredPrior.convergence || groundedConvergenceFromAnswer(answeredPrior, answer),
      question2: "",
      revised: thinkingCore.answerContradictsInterpretation(answer, answeredPrior.focus),
      thinkingCore: thinkingCore.reviseThinkingCore(answeredPrior.thinkingCore || thinkingCore.coreFromSee(see, { interpretation: answeredPrior.focus }), {
        answer,
        interpretation: groundedConvergenceFromAnswer(answeredPrior, answer),
        revised: true,
        revisionNote: "user-answer-overturned",
      }),
    };
    return { ...projectUnderstand(fallback, raw, known), empty: false, meta: { ...meta, reasonError: true } };
  }

  meta.revised = Boolean(reasonData && reasonData.revised);
  const allowQ2 = prior.stage !== "asked2";
  const q2 = allowQ2 ? q2Justified(reasonData, answer, raw, meta, prior) : null;
  let convergence = asText(reasonData && reasonData.convergence);
  if (looksForcedPattern(convergence) || insightDiscovery.looksOverreach(convergence, "") || SEE_AS_FACT.test(convergence)) {
    meta.dropped.push({ id: "convergence", failed: ["overreach"], stage: "js" });
    convergence = "";
  }
  convergence = gatePostAnswerConvergence(convergence, answer, raw, prior, meta);
  if (!UNCERTAINTY.test(convergence) && /一定是|就是你的|證明你/.test(convergence)) {
    convergence = `目前比較像是，${convergence.replace(/^你/, "這次你")}`;
  }

  const core = {
    focus: prior.focus,
    whyWorthThinking: prior.whyWorthThinking,
    pastNote: prior.past && prior.past.used ? prior.pastNote : "",
    question: q2,
    convergence: q2 ? "" : convergence || groundedConvergenceFromAnswer(prior, answer),
  };

  let written = {
    focusLine: prior.focus,
    why: prior.whyWorthThinking,
    pastNote: core.pastNote,
    question: q2,
    convergence: core.convergence,
  };
  try {
    const out = await callAi(
      [
        { role: "system", content: UNDERSTAND_WRITE_SYSTEM },
        { role: "user", content: writeUserPrompt({ ...core, answer, revised: meta.revised, revisionNote: asText(reasonData && reasonData.revisionNote) }) },
      ],
      "write"
    );
    written = applyWriter(core, out, Boolean(prior.past && prior.past.used), meta, raw);
    written.question = q2 ? sanitizeQuestion(written.question, { ...raw, userAnswer: answer }, meta) : null;
  } catch {
    /* keep */
  }

  if (!written.question) {
    written.convergence = gatePostAnswerConvergence(written.convergence || core.convergence, answer, raw, prior, meta);
  }

  const bag = {
    ...answeredPrior,
    stage: written.question ? "asked2" : "converged",
    question2: written.question || "",
    answer: prior.stage === "asked2" ? prior.answer : answer,
    answer2: prior.stage === "asked2" ? answer : answeredPrior.answer2,
    convergence: written.question ? "" : written.convergence || core.convergence,
    revised: meta.revised || /不是|其實/.test(answer),
    past: prior.past && prior.past.used ? prior.past : reasonData && reasonData.keepHistory === false ? null : prior.past,
    pastNote: prior.past && prior.past.used ? prior.pastNote : reasonData && reasonData.keepHistory === false ? "" : prior.pastNote,
    pastDrop: prior.pastDrop || null,
    thinkingCore: thinkingCore.reviseThinkingCore(prior.thinkingCore || thinkingCore.coreFromSee(see, { interpretation: prior.focus }), {
      answer,
      interpretation: written.question ? prior.focus : written.convergence || core.convergence,
      revised: meta.revised || thinkingCore.answerContradictsInterpretation(answer, prior.focus) || thinkingCore.answerContradictsInterpretation(answer, see),
    }),
  };
  return {
    ...projectUnderstand(bag, raw, known),
    empty: false,
    meta,
  };
}

async function runUnderstandPipeline(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx || {};
  if (typeof callAi !== "function") throw new Error("missing callAi");
  const step = opts.step === "answer" || understandStep({ context: ctx, step: opts.step }) === "answer" ? "answer" : "open";
  if (step === "answer") return runAnswer(callAi, ctx, opts.prior);
  return runOpen(callAi, ctx, opts.usedPast || ctx.usedPast || []);
}

const QUALITY_FIXTURES = {
  A: {
    id: "A",
    label: "already explained why",
    raw: {
      thanksText: "還能把事情做完",
      event: "主管臨時改工作，我不舒服，但怕他覺得我不配合，所以還是留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊，可是我知道自己為什麼答應。",
    },
    rejectQuestion: "你當時為什麼沒有拒絕？",
  },
  B: {
    id: "B",
    label: "same nouns different situation",
    today: {
      thanksText: "會議順利結束",
      event: "今天下午和主管開會，討論下一季的進度。",
      mood: "平",
      bodyMindText: "有點累，但沒有特別不舒服。",
    },
    past: {
      date: "2026-07-02",
      journal: {
        thanksText: "聚餐很好玩",
        event: "主管請大家吃飯，氣氛輕鬆，聊了很多無關工作的事。",
        mood: "開心",
        bodyMind: { text: "吃飽後很放鬆。" },
      },
    },
  },
  C: {
    id: "C",
    label: "different nouns same decision structure",
    today: {
      thanksText: "工作做完了",
      event: "主管臨時改工作，我不舒服但還是留下來。",
      mood: "悶",
      bodyMindText: "想回家，最後還是留下。",
    },
    past: {
      date: "2026-06-11",
      journal: {
        thanksText: "有人找我幫忙",
        event: "同事臨時請我幫忙，我不想但還是答應。",
        mood: "累",
        bodyMind: { text: "答應之後有點後悔。" },
      },
    },
  },
  D: {
    id: "D",
    label: "similar past but changed response",
    today: {
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
  },
  E: {
    id: "E",
    label: "no meaningful history",
    raw: {
      thanksText: "早餐很好吃",
      event: "今天第一次把想說的話寫下來再傳給對方。",
      mood: "安定",
      bodyMindText: "傳出去之後比較鬆。",
    },
  },
  F: {
    id: "F",
    label: "several explanations",
    raw: {
      thanksText: "還是有朋友",
      event: "朋友沒有回訊息，我有點難過。",
      mood: "低落",
      bodyMindText: "胸口有點空。",
    },
    forbid: /你害怕被忽略|一定是被拋棄/,
  },
  G: {
    id: "G",
    label: "answer overturns hypothesis",
    prior: {
      stage: "asked1",
      focus: "朋友沒回訊時，你好像特別怕自己不重要。",
      whyWorthThinking: "這次難過來得很快，值得看看是不是被忽略的感覺。",
      question: "這次的難過，比較接近被忽略，還是有別的原因？",
      possibilities: [{ id: "A", text: "害怕被忽略" }],
    },
    answer: "不是害怕被忽略。我今天本來就很累，只是剛好希望有人陪一下。",
  },
  H: {
    id: "H",
    label: "Q1 enough",
    prior: {
      stage: "asked1",
      focus: "知道不想答應，和最後還是答應之間的距離。",
      whyWorthThinking: "你已經看見界線，行動還沒跟上。",
      question: "如果當時不用考慮對方怎麼看你，你自己真正想怎麼處理？",
    },
    answer: "我想先說今晚做不完，明天再補。這樣就夠了。",
  },
  I: {
    id: "I",
    label: "Q2 allowed",
    prior: {
      stage: "asked1",
      focus: "知道不想答應，和最後還是答應之間的距離。",
      whyWorthThinking: "你已經看見界線，行動還沒跟上。",
      question: "如果當時不用考慮對方怎麼看你，你自己真正想怎麼處理？",
    },
    answer: "我想拒絕，可是我還說不清楚，拒絕了之後自己要面對什麼。",
  },
  J: {
    id: "J",
    label: "already clear",
    raw: {
      thanksText: "把話說完了",
      event: "我很清楚自己為什麼難過：他當眾打斷我，我覺得不被尊重。原因我已經知道了。",
      mood: "生氣",
      bodyMindText: "胸口熱，但我已經想清楚，沒有要再問自己為什麼。",
    },
  },
  K: {
    id: "K",
    label: "03 unsupported",
    raw: {
      thanksText: "吃了飯",
      event: "今天只是普通加班，把報告寫完。",
      mood: "平",
      bodyMindText: "有點肩頸緊。",
    },
    see: "你可能很害怕失去親密關係。",
  },
  L: {
    id: "L",
    label: "historical AI only",
    today: {
      thanksText: "做完了",
      event: "今天把簡報交出去。",
      mood: "平",
      bodyMindText: "還好。",
    },
    past: {
      date: "2026-04-09",
      journal: {
        thanksText: "交了",
        event: "交了一份資料。",
        mood: "平",
        bodyMind: { text: "還好。", insight: "你可能很在意選擇權，也一直討好別人。" },
        insight: { guide: { variant: "reflection-v3", coreQuote: "你一直討好別人。", questions: [] } },
      },
    },
  },
  M: {
    id: "M",
    label: "positive growth",
    raw: {
      thanksText: "今天有停下來",
      event: "以前臨時被叫走我會立刻答應。今天我第一次先說我想休息。",
      mood: "安定",
      bodyMindText: "說完之後比較鬆。",
    },
    forbid: /問題是|你其實還是|陰影|害怕被拋棄/,
  },
  N: {
    id: "N",
    label: "question already in RAW",
    raw: {
      thanksText: "撐完了",
      event: "我怕主管覺得我不配合，所以答應留下來。",
      mood: "悶",
      bodyMindText: "肩膀緊。",
    },
    rejectQuestion: "你當時為什麼沒有拒絕？",
  },
  O: {
    id: "O",
    label: "leading question",
    rejectQuestion: "你是不是太在意別人的感受？",
  },
};

function evaluateQuestion(question, rawInput) {
  const raw = insightDiscovery.trustRaw(rawInput || {});
  const leading = looksLeadingQuestion(question);
  const answered = questionAlreadyAnswered(question, raw);
  return { drop: leading || answered, leading, answered };
}

function evaluateFocusAgainstSee(focus, see, rawInput) {
  const raw = insightDiscovery.trustRaw(rawInput || {});
  const unsupported = Boolean(see) && looksSeeParaphrase(focus, see) && !seeGroundedInRaw(see, raw);
  const asFact = SEE_AS_FACT.test(asText(focus));
  return { drop: unsupported || asFact, unsupported, asFact };
}

module.exports = {
  UNDERSTAND_VARIANT,
  STOP_COPY,
  USER_STOP_COPY,
  UNDERSTAND_REASON_SYSTEM,
  UNDERSTAND_REREASON_SYSTEM,
  UNDERSTAND_WRITE_SYSTEM,
  QUALITY_FIXTURES,
  understandStep,
  isUnderstandGuide,
  understandIsComplete,
  normalizeUnderstand,
  understandGatePast,
  seeHypothesis,
  seeGroundedInRaw,
  looksSeeParaphrase,
  looksLeadingQuestion,
  questionAlreadyAnswered,
  looksNoUnknownLeft,
  looksOrdinaryThin,
  looksForcedPattern,
  looksUnsupportedPattern,
  rewriteUnsupportedPattern,
  looksPsychologyUpgrade,
  looksConflictsWithAnswer,
  gatePostAnswerConvergence,
  groundedConvergenceFromAnswer,
  looksThinAmbiguous,
  looksPrematureClosure,
  looksRawRestatement,
  looksChangedResponsePast,
  evaluateQuestion,
  evaluateFocusAgainstSee,
  q2Justified,
  runUnderstandPipeline,
  projectUnderstand,
  questionHasNewVariable: thinkingCore.questionHasNewVariable,
  looksShallowQuestion: thinkingCore.looksShallowQuestion,
  reviseThinkingCore: thinkingCore.reviseThinkingCore,
};
