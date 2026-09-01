"use strict";

const voice = require("./ing-voice");
const reflectionV3 = require("./reflection-v3");
const insightDiscovery = require("./insight-discovery");

const UNDERSTAND_VARIANT = "understand-v1";
const STAGES = ["stop", "asked1", "asked2", "converged"];

const STOP_COPY = {
  kicker: "這次我想陪你看的是",
  line1: "今天這件事，你其實已經想得滿清楚了。",
  line2: "沒有一定要再往下挖的地方，先這樣就很好。",
};

const UNDERSTAND_REASON_SYSTEM = `你是 ING 的內部思考引擎，不是寫給使用者看的文案。

角色：分析顧問 + 思考教練。
不是再做一次 03 發現。不是告訴她答案。
先判斷今天如果只深入想一件事，哪一件最能幫助她理解自己。
再判斷有沒有真正未知、而且只有她能答、答了會改變理解的問題。

【信任層級｜高→低】
1. 今天 USER RAW
2. 她明確的選擇／回答
3. 過往 USER RAW
4. 過往 USER_CONFIRMED
5. 今天 03 SEE｜只是假設
6. 過去 04 AI 解釋｜只是假設
7. 過往 AI inference｜只是假設

03 SEE 不是 FACT。不要寫「因為 03 已經證明」。
不要用「過去 AI 猜測 + 今天 AI 猜測」證明模式。
過往若沒有 USER RAW／USER_CONFIRMED，不能拿來證明今天的模式。

【焦點】
不要自動選最負面的事。不要硬找問題。正向發展也可以值得理解。
若焦點只是把 03 換句話說：DROP。
「我知道自己不太想／不舒服」不是已經想清楚。知道和做到之間仍可深想。
只有她明確說原因已經知道、沒有剩餘張力、或不想再分析時才 stop=true。
普通、沒有張力的一天可以 stop。不要為了有 04 而問。

【歷史】
過往是可選的。沒有真正有用的過去，就只用今天。
不要因為名詞相同就連。
先比相似、相異、反應有沒有變、覺察有沒有提早、選擇有沒有不同。
不要跳到「你一直都是這樣」。要能看見發展。

【多角度】
對焦點至少想：
A 最明顯的解釋
B 另一個合理的解釋
C 更單純／情境性的解釋
不要偷偷選定她的心理。

【問題】
問題存在，只因為：你不知道 + 只有她能答 + 答案會改變理解。
不要問原文已經回答的事。
不要誘導（你是不是太在意……）。
必須保留「其他原因／其他考量」的空間。
目標 0～2 題。不要為了流程硬問。
第一輪最多 1 題。第二題只在回答之後才考慮。

只輸出 JSON：
{"stop":false,"stopReason":"","focus":{"statement":"","source":"raw|see-hypothesis|history-compare|growth","whyWorthThinking":""},"past":{"use":false,"date":"","similarity":"","difference":"","change":"","connectionType":""},"possibilities":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"question":null,"status":"stop|ask"}`;

const UNDERSTAND_REREASON_SYSTEM = `你是 ING 的內部再思考引擎。

使用者剛剛親自回答了。這是最高信任證據之一。
你必須願意修正自己。

先問：
1. 回答支持原假設嗎？
2. 削弱了嗎？
3. 有沒有另一個解釋？
4. 歷史還相關嗎？
5. 現在夠理解了嗎？
6. 是否還有一個真正重要、且只有她能答的未知？

第二題只在同時成立時才問：
- 第一題回答改變或銳化了問題
AND 還有一個重要未知
AND 再答一次會實質加深理解

不要因為「流程還有下一輪」而問。夠了就 converge。
不要重複已經回答過的問題。
不要誘導。不要把 03 或過去 AI 升成 FACT。

只輸出 JSON：
{"revised":false,"revisionNote":"","keepHistory":false,"enough":true,"question2":null,"convergence":"","status":"converge|ask2"}`;

const UNDERSTAND_WRITE_SYSTEM = `你只負責把已經通過的思考核心，寫成給使用者看的短文。
語意必須等價。不要加新心理、新因果、新診斷。

使用者會先看到為什麼值得想，再決定要不要回答。
不要寫機械標籤：FOCUS、SIMILARITY、CONFIDENCE、PIPELINE、MODEL。
不要寫「你總是／你一直都是這樣／這是你的模式」。
03 只能當「這可能值得想」，不能當已證明。
沒有使用過往時，不要提以前、過往、上次紀錄。
證據不足時用：目前比較像是、從今天來看、這次比較能確定的是。

focusLine：這次想陪她看的那一件事。一句到兩句。
why：為什麼值得想。短、落地。
pastNote：只有真的用了過往才寫。要同時有相似與不一樣。可空。
question：通過的那一題，或 null。
convergence：若這輪已收斂才寫。不是診斷。

只輸出 JSON：
{"focusLine":"","why":"","pastNote":"","question":null,"convergence":""}`;

const PATTERN_CLAIM = /你總是|你一直都是|你反覆|這是你的模式|這證明你一直|人生模式/;
const SEE_AS_FACT = /因為.?03|03 已經|身心覺察已經證明|這證明你|已經證明你/;
const FORCED_PROBLEM = /真正的問題是|你其實不快樂|陰影|你在逃避|你害怕被/;
const LEADING_EXTRA = /你是不是太在意|你是不是害怕|你其實是因為|難道不是因為|是不是就是/;
const HISTORY_MENTION = /你之前|以前你|過往紀錄|上次你|歷史紀錄|前幾次你都/;
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
  };
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
  const closed = /原因我已經知道|我已經想清楚|我很清楚.{0,16}(為什麼|沒有要再)|沒有要再問|不想再分析/.test(blob);
  const leftoverTension = /可是|卻|不知道|說不清楚|還沒|不太想|不舒服但|沒有立刻|第一次/.test(blob);
  if (!closed) return false;
  if (leftoverTension) return false;
  return true;
}

function questionText(value) {
  if (value == null) return "";
  if (typeof value === "object") return asText(value.text || value.question || value.unknown);
  return asText(value);
}

function seedFocus(raw) {
  const blob = rawBlob(raw);
  if (looksNoUnknownLeft(raw) || looksOrdinaryThin(raw)) return null;
  if (/知道.{0,16}不想|不太想/.test(blob) && /答應|留下/.test(blob)) {
    return {
      statement: "知道不太想，和最後還是答應之間的距離。",
      source: "raw",
      whyWorthThinking: "你已經看見自己的不舒服。真正值得想的，也許不是為什麼又答應了，而是看見之後，什麼讓行動還沒跟上。",
    };
  }
  if (/第一次|沒有立刻/.test(blob)) {
    return {
      statement: "今天真正值得看的，可能是你這次沒有立刻答應。",
      source: "growth",
      whyWorthThinking: "這跟立刻答應不太一樣。值得看看這個變化，而不是把它說成又來一次。",
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

function looksPositiveOnly(raw) {
  const blob = rawBlob(raw);
  return /開心|幸福|輕鬆|第一次沒有|開始比較能|有進步|終於停下來/.test(blob) && !/難受|生氣|委屈|崩潰|討厭/.test(blob);
}

function sanitizeQuestion(question, raw, meta) {
  const q = questionText(question);
  if (!q) return null;
  if (questionAlreadyAnswered(q, raw)) {
    meta.dropped.push({ id: "q", failed: ["already-answered"], stage: "js" });
    return null;
  }
  if (looksLeadingQuestion(q)) {
    meta.dropped.push({ id: "q", failed: ["leading"], stage: "js" });
    return null;
  }
  if (insightDiscovery.looksGeneric(q, q) || /真正的幸福是什麼|你覺得呢\s*[？?]?$/.test(q)) {
    meta.dropped.push({ id: "q", failed: ["generic"], stage: "js" });
    return null;
  }
  if (insightDiscovery.looksOverreach && /童年|創傷|依附|潛意識|討好型/.test(q)) {
    meta.dropped.push({ id: "q", failed: ["overreach"], stage: "js" });
    return null;
  }
  if (/還是/.test(q) && !/別的|其他/.test(q)) {
    return `${q.replace(/[？?]\s*$/, "")}，還是有別的原因？`;
  }
  return q;
}

function gateFocus(focus, raw, known, see, meta) {
  const statement = asText(focus && focus.statement);
  const why = asText(focus && focus.whyWorthThinking);
  if (!statement) return null;
  if (looksForcedPattern(`${statement} ${why}`)) {
    meta.dropped.push({ id: "focus", failed: ["pattern-or-see-fact"], stage: "js" });
    return null;
  }
  if (insightDiscovery.looksOverreach(statement, why)) {
    meta.dropped.push({ id: "focus", failed: ["overreach"], stage: "js" });
    return null;
  }
  if (insightDiscovery.looksGeneric(statement, why)) {
    meta.dropped.push({ id: "focus", failed: ["generic"], stage: "js" });
    return null;
  }
  if (see && looksSeeParaphrase(statement, see) && !seeGroundedInRaw(see, raw)) {
    meta.dropped.push({ id: "focus", failed: ["see-unsupported"], stage: "js" });
    return null;
  }
  if (see && looksSeeParaphrase(statement, see) && !asText(why)) {
    meta.dropped.push({ id: "focus", failed: ["see-paraphrase"], stage: "js" });
    return null;
  }
  const advancing = /還可以怎麼|真正值得|之間的距離|不一樣|第一次|空隙|開始|值得看|陪你看|知道.*做到/.test(`${statement}${why}`);
  if (insightDiscovery.looksExactKnown(statement, known, raw) && !advancing) {
    meta.dropped.push({ id: "focus", failed: ["already-known"], stage: "js" });
    return null;
  }
  return {
    statement,
    source: asText(focus && focus.source) || "raw",
    whyWorthThinking: why,
  };
}

function gatePastFromReason(past, used, raw, meta) {
  const item = Array.isArray(used) && used[0];
  if (!item) return null;
  const asked = past && typeof past === "object" ? past : {};
  if (asked.use === false) return null;
  if (pastIsAiOnly(item) || !pastHasUserEvidence(item)) {
    meta.dropped.push({ id: "past", failed: ["ai-only-history"], stage: "js" });
    return null;
  }
  const similarity = asText(asked.similarity);
  const difference = asText(asked.difference);
  const change = asText(asked.change);
  if (looksForcedPattern(`${similarity} ${difference} ${change}`)) {
    meta.dropped.push({ id: "past", failed: ["false-pattern"], stage: "js" });
    return null;
  }
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
  const kept = rows
    .map((item, index) => ({
      id: asText(item && item.id) || ["A", "B", "C"][index] || `p${index + 1}`,
      text: asText(item && item.text),
    }))
    .filter((item) => item.text)
    .filter((item) => {
      if (looksForcedPattern(item.text) || insightDiscovery.looksOverreach(item.text, "")) {
        meta.dropped.push({ id: item.id, failed: ["possibility-overreach"], stage: "js" });
        return false;
      }
      if (see && looksSeeParaphrase(item.text, see) && !seeGroundedInRaw(see, raw) && /就是|證明|一定/.test(item.text)) {
        meta.dropped.push({ id: item.id, failed: ["see-as-fact"], stage: "js" });
        return false;
      }
      return true;
    })
    .slice(0, 3);
  return kept;
}

function writerMentionsHistoryWithoutPast(text, pastUsed) {
  return !pastUsed && HISTORY_MENTION.test(asText(text));
}

function silenceResult(raw, known, extra) {
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
      whyWorthThinking: STOP_COPY.line1,
      pastNote: "",
      past: null,
      possibilities: [],
      question: "",
      answer: "",
      question2: "",
      answer2: "",
      convergence: "",
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
  return `【USER RAW｜最高信任】
【01 感謝】
${raw.thanksText || "未寫"}

【02 事件】
${raw.event || "未寫"}

【02 心情】
${raw.mood || "未選"}

【03 身心覺察原文】
${raw.bodyMindText || "未寫"}
${raw.userAnswer ? `\n【使用者自己的回答｜高信任】\n${raw.userAnswer}` : ""}

【LOCKED KNOWN_BY_USER｜不要再問已經寫過的】
${known.map((item) => `- ${item.text}`).join("\n") || "- （原文很短）"}

【03 SEE｜假設，不是 FACT】
${see || "（無）"}
不要把它升成事實。可以當「這可能值得深入想」。

${formatPastBlock(usedPast)}

沒有真正值得更深想的未知，就 stop=true，question=null。`;
}

function rereasonUserPrompt(raw, known, see, prior, answer) {
  return `${reasonUserPrompt({ ...raw, userAnswer: answer }, known, see, prior && prior.past && prior.past.used ? [{ ...prior.past, userRaw: { event: prior.past.similarity } }] : [])}

【先前思考｜可修正】
焦點：${prior.focus || ""}
為什麼值得想：${prior.whyWorthThinking || ""}
可能性：${(prior.possibilities || []).map((item) => item.text).join(" / ")}
上一題：${prior.question || prior.question2 || ""}
過往是否使用：${prior.past && prior.past.used ? "是" : "否"}

【使用者剛剛的回答｜高信任】
${answer}

必須根據回答重新想。可以否定原假設。`;
}

function writeUserPrompt(core) {
  return `只把下面已通過的思考核心寫給使用者看。必須語意等價。不要加新意思。

【CORE】
${JSON.stringify(core)}`;
}

function applyWriter(core, written, pastUsed, meta) {
  const next = {
    focusLine: asText(written && written.focusLine) || core.focus,
    why: asText(written && written.why) || core.whyWorthThinking,
    pastNote: pastUsed ? asText(written && written.pastNote) || core.pastNote : "",
    question: written && written.question == null ? core.question : asText(written && written.question) || core.question,
    convergence: asText(written && written.convergence) || core.convergence,
  };
  const blob = `${next.focusLine} ${next.why} ${next.pastNote} ${next.convergence}`;
  if (looksForcedPattern(blob) || insightDiscovery.looksOverreach(next.focusLine, next.why) || writerMentionsHistoryWithoutPast(blob, pastUsed)) {
    meta.writerRejected = true;
    return {
      focusLine: core.focus,
      why: core.whyWorthThinking,
      pastNote: pastUsed ? core.pastNote : "",
      question: core.question,
      convergence: core.convergence,
    };
  }
  if (!pastUsed) next.pastNote = "";
  return next;
}

async function runOpen(callAi, ctx, usedPast) {
  const raw = insightDiscovery.trustRaw(ctx);
  const known = insightDiscovery.buildKnownByUser(raw);
  const see = seeHypothesis(ctx);
  const gatedPast = understandGatePast(usedPast);
  const meta = { knownCount: known.length, dropped: [], challenged: [], step: "open", pastRetrieved: (usedPast || []).length, pastUsed: gatedPast.used.length };
  if ((looksNoUnknownLeft(raw, known) || looksOrdinaryThin(raw)) && !seeGroundedInRaw(see, raw)) {
    return { ...silenceResult(raw, known, { meta: { ...meta, stopReason: looksOrdinaryThin(raw) ? "ordinary-thin" : "already-clear" } }), empty: false };
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

  if (reasonData && reasonData.stop && (looksNoUnknownLeft(raw, known) || looksOrdinaryThin(raw))) {
    return { ...silenceResult(raw, known, { meta: { ...meta, stopReason: asText(reasonData.stopReason) || "model-stop" } }), empty: false };
  }

  let focus = gateFocus(reasonData && reasonData.focus, raw, known, see, meta);
  if (!focus) {
    const seeded = seedFocus(raw);
    focus = seeded ? gateFocus(seeded, raw, known, see, meta) : null;
    if (seeded && focus) meta.seededFocus = true;
  }
  if (!focus) {
    return { ...silenceResult(raw, known, { meta }), empty: false };
  }

  const past = gatePastFromReason(reasonData && reasonData.past, gatedPast.used, raw, meta);
  const possibilities = gatePossibilities(reasonData && reasonData.possibilities, raw, see, meta);
  if (possibilities.length === 1 && /就是因為|一定是|證明你/.test(possibilities[0].text)) {
    meta.dropped.push({ id: "possibilities", failed: ["forced-one"], stage: "js" });
    possibilities.pop();
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
    written = applyWriter(core, out, Boolean(past), meta);
    written.question = sanitizeQuestion(written.question, raw, meta);
  } catch {
    /* keep core */
  }

  if (looksForcedPattern(`${written.focusLine} ${written.why}`) || insightDiscovery.looksOverreach(written.focusLine, written.why)) {
    return { ...silenceResult(raw, known, { meta: { ...meta, writerFatal: true } }), empty: false };
  }

  const stage = written.question ? "asked1" : "converged";
  const bag = {
    variant: UNDERSTAND_VARIANT,
    stage,
    focus: written.focusLine,
    whyWorthThinking: written.why,
    pastNote: written.pastNote,
    past,
    possibilities,
    question: written.question || "",
    answer: "",
    question2: "",
    answer2: "",
    convergence: stage === "converged" ? written.convergence || written.why || written.focusLine : "",
    revised: false,
  };
  return {
    ...projectUnderstand(bag, raw, known),
    empty: false,
    meta,
  };
}

function q2Justified(reasonData, answer, raw, meta) {
  if (!reasonData || reasonData.enough || reasonData.status === "converge") return null;
  const q2 = sanitizeQuestion(reasonData.question2, { ...raw, userAnswer: `${raw.userAnswer || ""}\n${answer}` }, meta);
  if (!q2) return null;
  const changed = Boolean(reasonData.revised) || /不是|其實|另外|其他|因為/.test(answer);
  const unknownRemains = Boolean(asText(reasonData.question2));
  if (!changed || !unknownRemains) return null;
  if (gramOverlap(q2, answer) >= 0.55) return null;
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
      convergence: answeredPrior.convergence || `從你剛說的來看，目前比較能確定的是：${answeredPrior.focus}`,
      question2: "",
    };
    return { ...projectUnderstand(fallback, raw, known), empty: false, meta: { ...meta, reasonError: true } };
  }

  meta.revised = Boolean(reasonData && reasonData.revised);
  const allowQ2 = prior.stage !== "asked2";
  const q2 = allowQ2 ? q2Justified(reasonData, answer, raw, meta) : null;
  let convergence = asText(reasonData && reasonData.convergence);
  if (looksForcedPattern(convergence) || insightDiscovery.looksOverreach(convergence, "") || SEE_AS_FACT.test(convergence)) {
    meta.dropped.push({ id: "convergence", failed: ["overreach"], stage: "js" });
    convergence = "";
  }
  if (!UNCERTAINTY.test(convergence) && /一定是|就是你的|證明你/.test(convergence)) {
    convergence = `目前比較像是，${convergence.replace(/^你/, "這次你")}`;
  }

  const core = {
    focus: prior.focus,
    whyWorthThinking: prior.whyWorthThinking,
    pastNote: prior.past && prior.past.used ? prior.pastNote : "",
    question: q2,
    convergence: q2 ? "" : convergence || prior.focus,
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
    written = applyWriter(core, out, Boolean(prior.past && prior.past.used), meta);
    written.question = q2 ? sanitizeQuestion(written.question, { ...raw, userAnswer: answer }, meta) : null;
  } catch {
    /* keep */
  }

  const bag = {
    ...answeredPrior,
    stage: written.question ? "asked2" : "converged",
    question2: written.question || "",
    answer: prior.stage === "asked2" ? prior.answer : answer,
    answer2: prior.stage === "asked2" ? answer : answeredPrior.answer2,
    convergence: written.question ? "" : written.convergence || core.convergence,
    revised: meta.revised,
    past: reasonData && reasonData.keepHistory === false ? null : prior.past,
    pastNote: reasonData && reasonData.keepHistory === false ? "" : prior.pastNote,
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
  looksForcedPattern,
  evaluateQuestion,
  evaluateFocusAgainstSee,
  q2Justified,
  runUnderstandPipeline,
  projectUnderstand,
};
