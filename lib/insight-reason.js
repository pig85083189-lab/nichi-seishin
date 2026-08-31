"use strict";

const voice = require("./ing-voice");
const valueGate = require("./insight-value-gate");

const TYPE_RANK = {
  connection: 0,
  change: 1,
  pattern: 2,
  value: 3,
  success: 4,
  tension: 5,
};

const REASONING_SYSTEM = `你是內部推理引擎，不是寫給使用者看的教練。

不要寫 title。不要寫溫柔文案。不要問使用者問題。不要給結論文案。
只做推理，輸出結構化 JSON。

【閱讀】
必須完整讀完今天 01 感謝、02 事件／心情、03 身心覺察原文。
使用者今天已經寫完 01 感謝、02 事件、03 身心覺察。04 第一層只讀今天，不要使用歷史 retrieval。
省略號後面的句子也要讀。
03 的 AI insight／support 只是 hypothesis，不是 fact。
若有第一層 04、使用者選中的題、USER ANSWER、第一輪結論：一併讀。
歷史資料若出現，只是 clue，不能壓過今天。

【FACT】
facts 只能是使用者真的寫過的內容。不要把推論寫進 facts。

【KNOWN】
使用者已經明確知道或直接寫出的事。
例如她寫「我覺得很幸福」→ known：她知道自己覺得幸福。
KNOWN 不能當 final insight。

【TRIVIAL】
沒深入理解也能猜的常識。
想睡→累、被照顧→幸福、開心→心情好、學習→成長、做很多→很努力。
TRIVIAL 不准進 final，除非和其他 evidence 組成新的非顯而易見 connection。

【主動找｜優先順序】
1. CROSS-SECTION CONNECTION（兩段原本分開的內容之間的新關係）
2. CHANGE / PROGRESS（以前 vs 現在）
3. REPEATED PATTERN
4. VALUE revealed by multiple details（不是她自己寫的情緒詞）
5. SUCCESS PATTERN（正向的一天：什麼值得留下／複製）
6. REAL TENSION（真的有矛盾才找，不要硬找核心信念／不安全感）
7. isolated fact（通常淘汰）

有證據才連。沒有不准硬連。
03「想睡」若沒連到行為／選擇／關係／長期 pattern，不要拿來做 candidate。
正向的一天不要硬找陰影。

【candidates】
先產 5～8 個。每個必須有 evidence（fact id）、newInformation、userAlreadyKnows、trivial、confidence。
newInformation 必須不是 USER RAW 的換句話說。

【judged】
對每個 candidate 給 verdict：PASS / DROP / REVISE。
internally 評：novelty、specificity、usefulness、evidence、humanness、soWhat、paraphraseRisk、trivialRisk、overinferenceRisk，各 0–2。
SO WHAT：看完會不會是「對啊／所以呢／這不是我剛剛寫的嗎」？YES → DROP。
答案已在 USER RAW → DROP。
A→換句話說 A → DROP。
寫不出真正新 information → DROP。
推論超過證據（核心信念／依附／深層恐懼／人格）→ DROP。
REVISE 時提供 revisedIdea。

只輸出 JSON：
{
  "facts": [{ "id": "f1", "source": "01", "text": "" }],
  "known": [{ "text": "", "reason": "" }],
  "trivial": [{ "text": "", "reason": "" }],
  "patterns": [],
  "connections": [],
  "changes": [],
  "values": [],
  "tensions": [],
  "successPatterns": [],
  "candidates": [{
    "id": "c1",
    "type": "connection",
    "idea": "",
    "evidence": ["f1"],
    "userAlreadyKnows": false,
    "trivial": false,
    "confidence": "medium",
    "newInformation": ""
  }],
  "judged": [{
    "id": "c1",
    "verdict": "PASS",
    "novelty": 0,
    "specificity": 0,
    "usefulness": 0,
    "evidence": 0,
    "humanness": 0,
    "soWhat": 0,
    "paraphraseRisk": 0,
    "trivialRisk": 0,
    "overinferenceRisk": 0,
    "newInformation": "",
    "revisedIdea": "",
    "reason": ""
  }]
}`;

const WRITER_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

${voice.FULL_INPUT_READ_BLOCK}

${voice.VALUE_ENGINE_BLOCK}

你是「進行式 ING」的 Mentor Writer。
你只負責把已經通過價值審判的洞察，寫成使用者看得懂的白話。

不要重新分析整天。
不要發明新的洞察。
不要使用被標記為 KNOWN 或 TRIVIAL 的句子。
不要看被 DROP 的 candidate。
只寫 PASS candidates。

每個 item：title + insight；question 可空。
title = 這一段真正要讓她看見什麼。約 4～14 中文字。不是分類名。
insight = 1～3 短句。先 evidence，再 synthesis。
question 只有在回答後會多知道自己一件事時才問。最多一個問號。沒有就空字串。

QUALITY > COUNT。有幾個 PASS 就寫幾個。不要湊數。
OPEN THE THINKING，不是 LEAD TO AN ANSWER。
LEADING QUESTION CHECK：問題不能暗示比較成熟／正確／應該的答案。
如果原文出現沒關係／只能接受／算了：不要直接當成真正接受。那可能是還沒被檢查的結論。
金句若含推論，用也許／可能／或許。

禁止 unsupported：童年創傷、原生家庭、依附、討好型人格、自我價值低。
ANSWER-NOT-IN-INPUT：答案已在原文就不要問。

【金句 coreQuote】（04 第一層才需要）
一句，約 20～45 中文字。今天最值得帶走的核心。不是雞湯、不是摘要。

只輸出 JSON。繁體中文。
{
  "coreQuote": "",
  "coreThread": "",
  "items": [
    { "id": "q1", "title": "", "insight": "", "question": "" }
  ]
}`;

function compactLine(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const limit = Number(max) || 400;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function asList(raw) {
  return Array.isArray(raw) ? raw : [];
}

function asText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function factMap(facts) {
  const map = {};
  asList(facts).forEach((item, index) => {
    const id = asText(item && item.id) || `f${index + 1}`;
    const text = asText(item && item.text);
    if (text) map[id] = text;
  });
  return map;
}

function normalizeReasoning(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const judged = {};
  asList(src.judged).forEach((row) => {
    const id = asText(row && row.id);
    if (id) judged[id] = row;
  });
  return {
    facts: asList(src.facts),
    known: asList(src.known),
    trivial: asList(src.trivial),
    candidates: asList(src.candidates),
    judged,
  };
}

function knownBlob(reasoning) {
  return asList(reasoning.known)
    .map((item) => asText(item && (item.text || item)))
    .filter(Boolean)
    .join("\n");
}

function looksListedKnown(text, reasoning) {
  const blob = knownBlob(reasoning);
  if (!blob || !asText(text)) return false;
  return valueGate.looksNearParaphrase(text, blob) && !valueGate.hasNewRelation(text);
}

function scoreTotal(row) {
  const n = (key) => {
    const v = Number(row && row[key]);
    return Number.isFinite(v) ? v : 0;
  };
  return n("novelty") + n("specificity") + n("usefulness") + n("evidence") + n("humanness")
    - n("soWhat") - n("paraphraseRisk") - n("trivialRisk") - n("overinferenceRisk");
}

function prepareWriterInput(raw, ctx) {
  const reasoning = normalizeReasoning(raw);
  const facts = factMap(reasoning.facts);
  const dropReasons = [];
  const ranked = [];
  reasoning.candidates.forEach((item, index) => {
    const id = asText(item && item.id) || `c${index + 1}`;
    const row = reasoning.judged[id] || {};
    const verdict = asText(row.verdict).toUpperCase();
    const idea = asText(row.revisedIdea) || asText(item && item.idea);
    const info = asText(row.newInformation) || asText(item && item.newInformation);
    if (!idea) {
      dropReasons.push(`${id}:empty`);
      return;
    }
    if (item && (item.userAlreadyKnows || item.trivial)) {
      dropReasons.push(`${id}:marked-known-or-trivial`);
      return;
    }
    if (verdict === "DROP") {
      dropReasons.push(`${id}:${asText(row.reason) || "judge-drop"}`);
      return;
    }
    if (looksListedKnown(idea, reasoning) || looksListedKnown(info, reasoning)) {
      dropReasons.push(`${id}:known`);
      return;
    }
    const gated = valueGate.evaluateInsightCandidate(
      { id, insight: idea, question: "", text: idea },
      ctx
    );
    const infoOk = info && !valueGate.looksNearParaphrase(info, valueGate.userSourceBlob(ctx));
    if (!gated.ok && !infoOk) {
      dropReasons.push(`${id}:${(gated.issues || []).join("|") || "gate"}`);
      return;
    }
    if (gated.issues.includes("trivial-inference") || gated.issues.includes("forced-body") || gated.issues.includes("low-value-question")) {
      dropReasons.push(`${id}:${gated.issues.join("|")}`);
      return;
    }
    if (!infoOk && gated.issues.includes("no-new-information") && !valueGate.hasNewRelation(idea) && !valueGate.hasCrossEvidence(idea, valueGate.userSourceBlob(ctx))) {
      dropReasons.push(`${id}:no-new-information`);
      return;
    }
    const type = asText(item && item.type) || "connection";
    ranked.push({
      id,
      type,
      idea,
      newInformation: info || gated.newInformation || "new-relation",
      evidence: asList(item && item.evidence).map((fid) => facts[asText(fid)] || asText(fid)).filter(Boolean),
      rank: TYPE_RANK[type] == null ? 9 : TYPE_RANK[type],
      score: scoreTotal(row),
    });
  });
  ranked.sort((a, b) => a.rank - b.rank || b.score - a.score);
  const pass = ranked.slice(0, valueGate.MAX_INSIGHT_ITEMS);
  return {
    known: reasoning.known,
    trivial: reasoning.trivial,
    pass,
    candidateCount: reasoning.candidates.length,
    dropReasons: dropReasons.slice(0, 10),
  };
}

function compactMeta(pack, extra) {
  const data = pack && typeof pack === "object" ? pack : {};
  const more = extra && typeof extra === "object" ? extra : {};
  return {
    candidateCount: Number(data.candidateCount || 0),
    passCount: Array.isArray(data.pass) ? data.pass.length : 0,
    dropReasons: Array.isArray(data.dropReasons) ? data.dropReasons.slice(0, 8) : [],
    ...more,
  };
}

function todayRawBlock(ctx, priorNote) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const note = priorNote ? "次要" : "使用者原文";
  return `【01 今日感謝｜${note}】
${voice.userRawForPrompt(data.thanksText || data.thanks) || "未寫"}

【02 今日事件｜${note}】
${voice.userRawForPrompt(data.event) || "未寫"}

【02 心情】
${String(data.mood || data.moodLabel || "").trim() || "未選"}

【03 身心覺察原文｜${priorNote ? "次要" : "權重最高的身體文字"}】
${voice.userRawForPrompt(data.bodyMindText || data.bodyNote) || "未寫"}

【03 模型假設｜不是 fact】
覺察：${compactLine(data.bodyMindInsight, 200) || "無"}
引導：${compactLine(data.bodyMindSupport, 200) || "無"}`;
}

function layerBlock(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const questions = Array.isArray(data.thinkQuestions || data.questions) ? data.thinkQuestions || data.questions : [];
  if (!questions.length && !data.coreQuote) return "";
  return `【04 第一層｜AI，不是 user truth】
金句：${compactLine(data.coreQuote || data.thinkCoreQuote, 200) || "無"}
洞察：
${questions.map((item, index) => `${index + 1}. ${compactLine(item && (item.title ? `${item.title} ${item.insight || item.text || item}` : item.text || item), 220)}`).join("\n") || "無"}`;
}

function reasoningUserPrompt(body, kind) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const prior = ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : null;
  const usedPast = Array.isArray(ctx.usedPast) ? ctx.usedPast : [];
  const isExt = kind === "extension";
  const isRound2 = Boolean(prior && asText(prior.answer));
  let extra = "";
  if (isExt && isRound2) {
    extra = `這是延伸 Round 2。最高權重是 Round 1 USER ANSWER。
不要把 Round 1 問題改寫。不要平行換角度。從回答裡找新 pattern／contradiction／value／assumption／unexplored layer。
若回答已經很完整，candidate 可以很少、很簡單。不要抽象哲學。

【Round 1 USER ANSWER｜最高權重】
${voice.userRawForPrompt(prior.answer, 2000) || "無"}
【Round 1 結論】
${compactLine(prior.deepConclusion, 220) || "無"}
【Round 1 選中】
${compactLine(prior.selectedQuestion || prior.selectedQuestionText, 200) || "無"}`;
  } else if (isExt) {
    extra = `這是延伸 Round 1。最高權重：使用者選中的第一層問題 + 若已有回答則用回答。
不要只是把原問題問深。從今天＋（若有）回答裡找新 pattern／contradiction／value／assumption。
歷史只是 clue。TODAY USER RAW > CURRENT USER ANSWER > USER CONFIRMED HISTORY > PAST RAW > PAST AI HYPOTHESIS。
沒有過往就不要假裝記得。

${layerBlock(ctx)}
${usedPast.length ? `【相關過往｜clue only】\n${usedPast.map((item, index) => `${index + 1}. ${compactLine((item && (item.userRaw || item.text || item.reason)) || "", 180)}`).join("\n")}` : "沒有過往區塊。只讀今天。"}`;
  } else {
    extra = `這是 04 第一層。不要使用歷史 retrieval。只讀今天 01～03。
candidate 至少 5 個。final 不由此層直接寫給使用者。`;
  }
  return `請只做內部推理與審判。不要寫給使用者看的文案。

${extra}

${todayRawBlock(ctx, isRound2)}

禁止把「幸福／開心／想睡」的重述當 PASS。
禁止「日常陪伴就是幸福」「想睡所以累」「心情好跟想睡不衝突」。`;
}

function writerUserPrompt(body, pack, kind) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const prior = ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : null;
  const pass = Array.isArray(pack && pack.pass) ? pack.pass : [];
  const known = asList(pack && pack.known).map((item) => `- ${asText(item && item.text)}`).filter((line) => line.length > 3);
  const trivial = asList(pack && pack.trivial).map((item) => `- ${asText(item && item.text)}`).filter((line) => line.length > 3);
  const schema = kind === "extension"
    ? `{ "coreThread": "", "items": [{ "id": "eq1", "title": "", "insight": "", "question": "" }] }`
    : `{ "coreQuote": "", "items": [{ "id": "q1", "title": "", "insight": "", "question": "" }] }`;
  return `只把下面 PASS candidates 寫成白話。不要發明新洞察。不要重述 KNOWN。不要使用 TRIVIAL。
有 ${pass.length} 個 PASS，就寫 ${pass.length} 個 item。可以 1 個。不要湊。
question 可空。沒有值得問就空字串。

【KNOWN｜不要當 insight】
${known.join("\n") || "- （無）"}

【TRIVIAL｜不要當 insight】
${trivial.join("\n") || "- （無）"}

【PASS CANDIDATES】
${pass.map((item, index) => `${index + 1}. [${item.type}] ${item.idea}
   newInformation: ${item.newInformation}
   evidence: ${(item.evidence || []).join("／") || "（見原文）"}`).join("\n\n") || "（無。不要硬寫。）"}

${kind === "extension" && prior && asText(prior.answer) ? `Round 2：從第一輪回答往下一層。不要平行換題。\n回答：${voice.userRawForPrompt(prior.answer, 1200)}` : ""}

${todayRawBlock(ctx, Boolean(prior && prior.answer))}

只輸出 JSON：
${schema}`;
}

function reasoningRetryPrompt(pack) {
  const reasons = Array.isArray(pack && pack.dropReasons) ? pack.dropReasons : [];
  return `上一輪沒有 PASS。不要把 DROP 撿回來。
${reasons.map((line) => `- ${line}`).join("\n") || "- 全是 known／trivial／paraphrase"}

重新只找真正新的 connection／change／pattern／value。
若今天真的沒有：candidates 可留空 judged 全 DROP。不要硬挖。`;
}

function parseWriterResult(raw, kind) {
  const src = raw && typeof raw === "object" ? raw : {};
  if (kind === "extension") {
    return {
      coreThread: asText(src.coreThread || src.thread || src.core),
      items: Array.isArray(src.items) && src.items.length ? src.items : src.questions || [],
    };
  }
  return {
    coreQuote: asText(src.coreQuote || src.quote),
    items: Array.isArray(src.items) && src.items.length ? src.items : src.questions || [],
  };
}

async function runReasonWritePipeline(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx || {};
  const kind = opts.kind === "extension" ? "extension" : "layer";
  const reasonMessages = Array.isArray(opts.reasonMessages) ? opts.reasonMessages : [];
  if (typeof callAi !== "function") throw new Error("missing callAi");

  let rawReason = await callAi(reasonMessages, "reason");
  let pack = prepareWriterInput(rawReason, ctx);
  if (!pack.pass.length) {
    rawReason = await callAi(
      reasonMessages.concat([
        { role: "assistant", content: JSON.stringify({ candidateCount: pack.candidateCount, dropReasons: pack.dropReasons }) },
        { role: "user", content: reasoningRetryPrompt(pack) },
      ]),
      "reason-retry"
    );
    pack = prepareWriterInput(rawReason, ctx);
  }
  const meta = compactMeta(pack, { regenerated: pack.pass.length ? false : true });
  if (!pack.pass.length) {
    return { empty: true, written: null, pack, meta };
  }
  const writeMessages = [
    { role: "system", content: opts.writeSystem || WRITER_SYSTEM },
    { role: "user", content: writerUserPrompt({ context: ctx }, pack, kind) },
  ];
  const written = await callAi(writeMessages, "write");
  return { empty: false, written, pack, meta };
}

module.exports = {
  REASONING_SYSTEM,
  WRITER_SYSTEM,
  TYPE_RANK,
  normalizeReasoning,
  prepareWriterInput,
  compactMeta,
  reasoningUserPrompt,
  writerUserPrompt,
  reasoningRetryPrompt,
  parseWriterResult,
  runReasonWritePipeline,
};
