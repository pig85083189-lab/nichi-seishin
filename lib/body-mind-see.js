"use strict";

const voice = require("./ing-voice");
const bodyMind = require("./body-mind");
const discovery = require("./insight-discovery");

const SEE_TYPES = [
  "CONTRAST",
  "COMMON_THREAD",
  "ENERGY_SOURCE",
  "DRAIN_SOURCE",
  "UNNOTICED_NEED",
  "CHANGE",
  "UNRECOGNIZED_STRENGTH",
  "BETTER_NEXT_RESPONSE",
];

const CONNECTING_TYPES = new Set([
  "CONTRAST",
  "COMMON_THREAD",
  "ENERGY_SOURCE",
  "DRAIN_SOURCE",
  "CHANGE",
  "UNRECOGNIZED_STRENGTH",
  "UNNOTICED_NEED",
]);

const SEE_SILENCE_COPY = bodyMind.SEE_SILENCE_COPY;

const SEE_REASON_SYSTEM = `你是 ING 的內部觀察引擎，不是寫給使用者看的教練。

先在內部重建這一天，再決定有沒有值得她知道、但她自己還沒連起來的觀察。

內部先問：
1. 今天實際發生了什麼？
2. 什麼感覺好？
3. 什麼感覺不舒服？
4. 什麼看起來在給能量？
5. 什麼看起來在耗能量？
6. 使用者已經明白寫出了什麼？
7. 哪些事實分開寫了，但她自己沒連起來？
8. 有沒有有意義的對比？
9. 有沒有正向的改變？
10. 有沒有她做得好、卻沒認出的地方？
11. 若類似情境再來，有沒有哪個回應方式值得換一下？

搜尋方向（不是配額，不要每個都生）：
CONTRAST / COMMON_THREAD / ENERGY_SOURCE / DRAIN_SOURCE / UNNOTICED_NEED / CHANGE / UNRECOGNIZED_STRENGTH / BETTER_NEXT_RESPONSE

只找最多一件「她自己還沒注意到，但值得知道」的 candidate。
可以 0 個。0 是成功。不要為了完整而湊。
優先選最有價值的一條。正向觀察與問題觀察同等認真。

只讀 USER RAW。不要把 03 AI insight／support 當 FACT。
FACT_CO_OCCURRENCE != KNOWN_CONNECTION
A 和 B 都出現，不代表她已經建立 A↔B。
只有她自己用因果／讓我／我知道是因為／原來是因為，才算已知連結。
已知連結不要再包裝成新看見。

禁止：
複述她已寫的結論
創傷、依附、討好型、潛意識、自我價值、害怕失去、逃避、人格解釋
把身體當心理證據：「你的身體在替你說」「你其實真正害怕的是」「潛意識正在」
走路很多所以腿痠這類真但沒有新理解的話
明天請完成三個行動、checklist、06 執行

BETTER_NEXT_RESPONSE 只給方向，例如下次類似情境時可以多留意哪裡，不是行動清單。

每個 candidate 必須有：
statement, evidence[], newInformation, whyItMatters, confidence
newInformation 說不出來就不要列。

只輸出 JSON：
{"candidates":[{"id":"s1","type":"COMMON_THREAD","statement":"","evidence":[""],"newInformation":"","whyItMatters":"","confidence":"low|medium|high"}]}`;

const SEE_CHALLENGE_SYSTEM = `你要攻擊這些 candidate，不是幫忙圓。

先把每個 candidate 拆成：
SEE_CORE：有 USER RAW 證據、相對 KNOWN 是新的、不是複讀、知道這件事後她會更理解自己
INTERPRETATION_ADDON：心理標籤、沒被支持的因果、身體當心理證據、潛意識、討好、創傷、依附

FACT_CO_OCCURRENCE != KNOWN_CONNECTION
使用者分別寫下 A 和 B，並不是已經說「A 造成 B」。
把兩件獨立事實放在一起看，不是 paraphrase。
只有她自己明確建立的關係才是 KNOWN。
若 CORE 只是並置兩件她沒連起來的事實，且沒有寫成「就是因為 A 所以 B」→ KEEP 或 REVISE，不要當 parrot DROP。

對 CORE 問：
1. 她看到會不會說「對啊，我剛剛就寫了」？
2. evidence 是不是 USER RAW？
3. 知道這件事後，她會更理解自己嗎？
4. 是不是空話／真但顯而易見？
5. 有沒有過度心理化？

規則：
- CORE 不合格 → DROP。不要因為只剩 0 個就救回來。
- CORE 合格、只有 ADDON 不合格 → REVISE：刪掉 addon，只留 core。
- 明確因果沒被原文支持時，保持暫定語氣。
- 0 個通過是成功。

只輸出 JSON：
{"items":[{"id":"s1","verdict":"KEEP|REVISE|DROP","parrotLikely":false,"reason":"","failed":[],"addonFailed":["overreach"],"core":{"statement":"","whyItMatters":""}}]}`;

const SEE_WRITER_SYSTEM = bodyMind.BODY_MIND_SYSTEM;

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactChars(text) {
  return asText(text).replace(/\s+/g, "").length;
}

function closeKey(text) {
  return asText(text).replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "");
}

function rawBlob(raw) {
  return [raw.thanksText, raw.event, raw.mood, raw.bodyMindText, raw.userAnswer].filter(Boolean).join("\n");
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

function evidenceFromRaw(evidence, raw) {
  const blob = rawBlob(raw);
  const list = Array.isArray(evidence) ? evidence.map(asText).filter(Boolean) : [];
  if (!list.length) return false;
  return list.every((item) => gramOverlap(blob, item) >= 0.45 || blob.includes(item) || item.length <= 24);
}

function hasRelationMarker(text) {
  return /開始|反而|可是|卻|沒有對上|不一致|其實更|另一面|放在一起|可能有一個?連結|值得注意|值得留意|沒有跟著結束|剛好出現在同一天|表面上|不一定代表|好像都是|補回能量|沒認出|自己沒注意到/.test(
    asText(text)
  );
}

function seeLooksOverreach(statement, why) {
  const blob = `${asText(statement)} ${asText(why)}`;
  return /童年創傷|創傷|原生家庭|依附風格|依附|潛意識|自我價值|討好型|討好別人|內在小孩|逃避現實|在逃避|控制欲|恐懼被拋棄|害怕失去|害怕被拋棄|不安全感|人格障礙|自我欺騙|身體在替你說|身體告訴你其實|你其實真正害怕|真正害怕的是|神經系統|心理診斷|這是憂鬱|這是焦慮|people.?pleasing/.test(
    blob
  );
}

function seeLooksNoValue(statement) {
  return /普通的一天|本身也是一種狀態|沒什麼特別|沒有特別強烈的感受|每一天都值得被看見|沒有一定要再解讀/.test(
    asText(statement)
  );
}

function seeLooksGeneric(statement) {
  return /身體(正在)?提醒你|允許自己(慢下來|休息)|好好愛自己|你需要照顧自己|休息也很重要|幸福藏在|學習愛自己|每一個感受都值得|成長的一部分|相信一切都是最好/.test(
    asText(statement)
  );
}

function seeLooksObviousPhysical(statement, raw) {
  const src = rawBlob(raw);
  const out = asText(statement);
  if (!out || !src) return false;
  if (hasRelationMarker(out)) return false;
  const pairs = [
    { cause: /走(了很多路|很遠|很久)|走路很多/, effect: /腿|腳|膝/, felt: /痠|痛|累/ },
    { cause: /健身|運動|重訓/, effect: /肌肉|腿|肩/, felt: /痠|痛/ },
    { cause: /沒睡|睡太晚|熬夜|昨天太晚睡/, effect: /身體/, felt: /累|想睡|疲/ },
  ];
  return pairs.some((row) => row.cause.test(src) && row.felt.test(src) && row.cause.test(out) && row.felt.test(out));
}

function seeLooksActionChecklist(text) {
  return (
    bodyMind.looksChecklistSupport(text) ||
    /明天請|請完成三個|三個行動|列出.{0,6}步驟|接下來請你|請你明天/.test(asText(text))
  );
}

function extractCausePairs(text) {
  const src = asText(text);
  const pairs = [];
  const push = (left, right) => {
    const a = asText(left).replace(/^(因為|所以|於是)/, "");
    const b = asText(right).replace(/^(因為|所以|於是)/, "");
    if (compactChars(a) < 2 || compactChars(b) < 2) return;
    pairs.push([a, b]);
  };
  const patterns = [
    /(.{2,28}?)(?:，|、)?所以(.{2,28})/g,
    /因為(.{2,28})[，,]?所以(.{2,28})/g,
    /(?:我知道(?:自己)?)(.{2,28})是因為(.{2,28})/g,
    /不是因為(.{2,28})[，,]?是因為(.{2,28})/g,
    /(.{2,28}?)讓我覺得(.{2,28})/g,
  ];
  patterns.forEach((pattern) => {
    const re = new RegExp(pattern.source, "g");
    let match;
    while ((match = re.exec(src))) {
      push(match[1], match[match.length - 1]);
    }
  });
  return pairs;
}

function sharesCauseTopic(side, statement) {
  const part = asText(side);
  const out = asText(statement);
  if (!part || !out) return false;
  const a = closeKey(part);
  const b = closeKey(out);
  if (a.length >= 4 && (b.includes(a.slice(0, 4)) || b.includes(a.slice(-4)))) return true;
  let hits = 0;
  let total = 0;
  for (let i = 0; i < a.length - 1; i += 1) {
    total += 1;
    if (b.includes(a.slice(i, i + 2))) hits += 1;
  }
  if (total && hits / total >= 0.4) return true;
  if (/晚睡|沒睡|熬夜/.test(part) && /晚睡|沒睡|熬夜/.test(out)) return true;
  if (/累|疲|想睡/.test(part) && /累|疲|想睡/.test(out)) return true;
  return false;
}

function seeParrotsExplicitConclusion(statement, known, raw) {
  if (discovery.parrotLikely(statement, known, raw)) return true;
  const blob = rawBlob(raw);
  const pairs = extractCausePairs(blob);
  if (pairs.some(([left, right]) => sharesCauseTopic(left, statement) && sharesCauseTopic(right, statement))) {
    return true;
  }
  const links = (Array.isArray(known) ? known : []).filter((item) => item.kind === "link" || item.kind === "conclusion");
  return links.some((item) => {
    const parts = asText(item.text)
      .split(/→/)
      .map(asText)
      .filter((part) => compactChars(part) >= 2);
    if (parts.length < 2) return gramOverlap(item.text, statement) >= 0.45;
    return parts.every((part) => gramOverlap(part, statement) >= 0.4 || asText(statement).includes(part.slice(0, Math.min(4, part.length))));
  });
}

function seeIsGroundedConnection(item, known, raw) {
  if (!item || !CONNECTING_TYPES.has(item.type)) return false;
  if (!Array.isArray(item.evidence) || item.evidence.length < 2) return false;
  if (!evidenceFromRaw(item.evidence, raw)) return false;
  if (seeLooksGeneric(item.statement) || seeLooksObviousPhysical(item.statement, raw)) return false;
  if (seeParrotsExplicitConclusion(item.statement, known, raw) && discovery.hasExplicitConnectionLanguage(rawBlob(raw))) {
    return false;
  }
  return hasRelationMarker(`${item.statement} ${item.newInformation}`) || item.type === "CONTRAST" || item.type === "COMMON_THREAD";
}

function stripAddonLanguage(text) {
  const units = asText(text)
    .split(/[。！？!?\n；;，,]+/)
    .map(asText)
    .filter(Boolean);
  const kept = units.filter((unit) => !seeLooksOverreach(unit, "") && !/身體在替你|潛意識|真正害怕/.test(unit));
  return kept.join("，");
}

function normalizeCandidate(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const type = asText(src.type).toUpperCase().replace(/[\s-]/g, "_");
  return {
    id: asText(src.id) || `s${index + 1}`,
    type: SEE_TYPES.includes(type) ? type : "",
    statement: asText(src.statement || src.idea || src.insight),
    evidence: (Array.isArray(src.evidence) ? src.evidence : []).map(asText).filter(Boolean).slice(0, 6),
    newInformation: asText(src.newInformation || src.newInfo),
    whyItMatters: asText(src.whyItMatters || src.why || src.soWhat || src.support),
    confidence: /^(high|medium|low)$/.test(asText(src.confidence)) ? asText(src.confidence) : "low",
  };
}

function seeChallenge(candidate, known, raw) {
  const failed = [];
  const item = normalizeCandidate(candidate, 0);
  if (!item.statement) failed.push("shape");
  if (!SEE_TYPES.includes(item.type)) failed.push("type");
  if (discovery.looksExactKnown(item.statement, known, raw)) failed.push("known");
  if (seeParrotsExplicitConclusion(item.statement, known, raw)) failed.push("parrot");
  if (!item.evidence.length || !evidenceFromRaw(item.evidence, raw)) failed.push("evidence");
  if (seeLooksOverreach(item.statement, item.whyItMatters) || bodyMind.looksOverPsych(`${item.statement}${item.whyItMatters}`)) {
    failed.push("overreach");
  }
  if (voice.looksPhysicalPsychologized(rawBlob(raw), item.statement)) failed.push("overreach");
  if (seeLooksGeneric(item.statement) || seeLooksNoValue(item.statement) || bodyMind.looksSoupBodyMind(item.statement)) failed.push("generic");
  if (seeLooksObviousPhysical(item.statement, raw)) failed.push("obvious");
  if (!item.newInformation || discovery.looksExactKnown(item.newInformation, known, raw)) {
    if (seeIsGroundedConnection(item, known, raw)) {
      item.newInformation = item.newInformation || "這兩件事放在一起看，關係還沒被她明說";
    } else {
      failed.push("newInformation");
    }
  }
  if (!item.whyItMatters || seeLooksGeneric(item.whyItMatters)) failed.push("soWhat");
  if (item.type === "BETTER_NEXT_RESPONSE" && seeLooksActionChecklist(`${item.statement} ${item.whyItMatters}`)) {
    failed.push("checklist");
  }
  if (bodyMind.looksQuestionOutput(`${item.statement}${item.whyItMatters}`)) failed.push("question");
  return { ok: !failed.length, failed, item };
}

function seeSalvageCore(candidate, known, raw) {
  const item = normalizeCandidate(candidate, 0);
  const revised = {
    ...item,
    statement: asText(stripAddonLanguage(item.statement)),
    newInformation: asText(
      stripAddonLanguage(item.newInformation) ||
        (CONNECTING_TYPES.has(item.type) ? "這兩件事放在一起看，關係還沒被她明說" : item.newInformation)
    ),
    whyItMatters: asText(stripAddonLanguage(item.whyItMatters) || `原文同時寫了：${item.evidence.slice(0, 2).join("；")}`),
    salvaged: true,
  };
  if (compactChars(revised.statement) < 8) return null;
  if (seeLooksOverreach(revised.statement, revised.whyItMatters)) return null;
  const judged = seeChallenge(revised, known, raw);
  if (!judged.ok) return null;
  if (seeParrotsExplicitConclusion(revised.statement, known, raw)) return null;
  return judged.item;
}

function addonOnlyFailure(row) {
  const verdict = asText(row && row.verdict).toUpperCase();
  const failed = Array.isArray(row && row.failed) ? row.failed : [];
  const addonFailed = Array.isArray(row && row.addonFailed) ? row.addonFailed : [];
  if (verdict === "REVISE") return true;
  if (addonFailed.length && !failed.some((item) => ["known", "paraphrase", "parrot", "evidence", "generic", "obvious"].includes(item))) {
    return true;
  }
  return failed.length > 0 && failed.every((item) => item === "overreach" || item === "soWhat");
}

function applySemanticChallenge(candidates, challengeData, known, raw) {
  const rows = Array.isArray(challengeData && challengeData.items) ? challengeData.items : [];
  const byId = new Map(rows.map((row) => [asText(row && row.id), row]));
  const kept = [];
  candidates.forEach((item) => {
    const row = byId.get(item.id);
    if (!row) {
      kept.push(item);
      return;
    }
    const verdict = asText(row.verdict).toUpperCase();
    const failed = Array.isArray(row.failed) ? row.failed : [];
    const modelParrot = row.parrotLikely === true && !seeIsGroundedConnection(item, known, raw);
    if (verdict === "KEEP" && !modelParrot && !failed.length) {
      kept.push(item);
      return;
    }
    if (addonOnlyFailure(row) || verdict === "REVISE") {
      const coreStatement = asText(row.core && row.core.statement);
      const coreWhy = asText(row.core && (row.core.whyItMatters || row.core.why));
      const seed = coreStatement ? { ...item, statement: coreStatement, whyItMatters: coreWhy || item.whyItMatters } : item;
      const revised = seeSalvageCore(seed, known, raw);
      if (revised) kept.push(revised);
      return;
    }
    if (seeIsGroundedConnection(item, known, raw)) {
      const revised = seeLooksOverreach(item.statement, item.whyItMatters) ? seeSalvageCore(item, known, raw) : item;
      if (revised && seeChallenge(revised, known, raw).ok && !seeParrotsExplicitConclusion(revised.statement, known, raw)) {
        kept.push(revised);
      }
    }
  });
  return kept;
}

function scoreCandidate(item) {
  let score = 0;
  if (item.confidence === "high") score += 3;
  if (item.confidence === "medium") score += 2;
  if (item.evidence.length >= 2) score += 2;
  if (hasRelationMarker(`${item.statement} ${item.newInformation}`)) score += 2;
  if (item.type === "CONTRAST" || item.type === "COMMON_THREAD" || item.type === "ENERGY_SOURCE" || item.type === "UNRECOGNIZED_STRENGTH" || item.type === "CHANGE") {
    score += 2;
  }
  if (item.type === "UNNOTICED_NEED" || item.type === "BETTER_NEXT_RESPONSE") score += 1;
  return score;
}

function seeSelectOne(candidates) {
  const list = Array.isArray(candidates) ? candidates.slice() : [];
  if (!list.length) return null;
  list.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return list[0];
}

function reasonUserPrompt(raw, known) {
  return `【USER RAW｜唯一 FACT】
【01 感謝】
${raw.thanksText || "未寫"}

【02 事件】
${raw.event || "未寫"}

【02 心情】
${raw.mood || "未選"}

【03 身心覺察原文】
${raw.bodyMindText || "未寫"}
${raw.userAnswer ? `\n【使用者自己的回答】\n${raw.userAnswer}` : ""}

【LOCKED KNOWN_BY_USER｜觀察不得撞上】
${known.map((item) => `- ${item.text}`).join("\n") || "- （原文很短）"}

FACT_CO_OCCURRENCE != KNOWN_CONNECTION。兩件事實同時出現，不表示她已經建立關係。
不要使用 03 AI insight／support。
沒有真正值得再看見的東西就輸出 {"candidates":[]}`;
}

function challengeUserPrompt(raw, known, candidates) {
  return `${reasonUserPrompt(raw, known)}

【CANDIDATES】
${JSON.stringify(candidates)}`;
}

function writerUserPrompt(raw, known, selected) {
  return `只把下面這個已通過的 SEE Core 寫成 insight + support。必須語意等價。不要加新意思。不要問問題。不要做成 06 行動清單。

【SEE CORE】
${JSON.stringify({
    type: selected.type,
    statement: selected.statement,
    evidence: selected.evidence,
    newInformation: selected.newInformation,
    whyItMatters: selected.whyItMatters,
  })}

【KNOWN｜不可寫回去】
${known.map((item) => `- ${item.text}`).join("\n")}

【USER RAW】
${rawBlob(raw)}`;
}

function silenceResult(known, extra) {
  return {
    status: "silence",
    insight: SEE_SILENCE_COPY.insight,
    support: SEE_SILENCE_COPY.support,
    seeType: "",
    evidence: [],
    confidence: "",
    knownByUser: known,
    empty: true,
    ...(extra || {}),
  };
}

function writerAsCore(selected, written) {
  return {
    statement: asText(written && written.insight) || asText(written && written.statement),
    why: asText(written && written.support) || asText(written && written.why),
  };
}

function finalOutputFails(written, selected, known, raw) {
  const statement = asText(written.insight || written.statement);
  const support = asText(written.support || written.why);
  if (!statement) return true;
  if (discovery.looksExactKnown(statement, known, raw)) return true;
  if (seeParrotsExplicitConclusion(statement, known, raw)) return true;
  if (seeLooksGeneric(statement) || seeLooksNoValue(statement) || seeLooksObviousPhysical(statement, raw)) return true;
  if (seeLooksOverreach(statement, support) || bodyMind.looksOverPsych(`${statement}${support}`)) return true;
  if (voice.looksPhysicalPsychologized(rawBlob(raw), statement)) return true;
  if (seeLooksActionChecklist(support)) return true;
  if (bodyMind.looksQuestionOutput(`${statement}${support}`)) return true;
  if (discovery.writerIntroducesMeaning(selected, writerAsCore(selected, { insight: statement, support }))) return true;
  return false;
}

function projectSeeOutput(seen) {
  const src = seen && typeof seen === "object" ? seen : {};
  if (src.status === "silence" || !asText(src.insight)) {
    return {
      insight: SEE_SILENCE_COPY.insight,
      support: SEE_SILENCE_COPY.support,
      status: "silence",
      seeType: "",
      evidence: [],
      confidence: "",
    };
  }
  const cleaned = bodyMind.normalizeBodyMindInsight({ insight: src.insight, support: src.support });
  if (!cleaned.insight) {
    return {
      insight: SEE_SILENCE_COPY.insight,
      support: SEE_SILENCE_COPY.support,
      status: "silence",
      seeType: "",
      evidence: [],
      confidence: "",
    };
  }
  return {
    insight: cleaned.insight,
    support: cleaned.support || asText(src.support),
    status: "observation",
    seeType: SEE_TYPES.includes(asText(src.seeType).toUpperCase()) ? asText(src.seeType).toUpperCase() : "",
    evidence: (Array.isArray(src.evidence) ? src.evidence : []).map(asText).filter(Boolean).slice(0, 6),
    confidence: /^(high|medium|low)$/.test(asText(src.confidence)) ? asText(src.confidence) : "",
  };
}

function evaluateSeeCandidate(candidate, ctx) {
  const raw = discovery.trustRaw(ctx);
  const known = discovery.buildKnownByUser(raw);
  const judged = seeChallenge(candidate, known, raw);
  const parrot = seeParrotsExplicitConclusion(judged.item.statement, known, raw);
  return {
    drop: !judged.ok || parrot,
    keep: judged.ok && !parrot,
    failed: parrot && !judged.failed.includes("parrot") ? judged.failed.concat("parrot") : judged.failed,
    parrot,
    item: judged.item,
    known,
    raw,
  };
}

async function runSeePipeline(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx || {};
  if (typeof callAi !== "function") throw new Error("missing callAi");
  const raw = discovery.trustRaw(ctx);
  const known = discovery.buildKnownByUser(raw);
  const meta = { knownCount: known.length, challenged: [], dropped: [], writerRejected: false };

  let reasonData = {};
  try {
    reasonData = await callAi(
      [
        { role: "system", content: SEE_REASON_SYSTEM },
        { role: "user", content: reasonUserPrompt(raw, known) },
      ],
      "reason"
    );
  } catch {
    return silenceResult(known, { meta });
  }

  const incoming = Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates : [];
  const jsKept = [];
  incoming.forEach((row, index) => {
    const judged = seeChallenge(row, known, raw);
    meta.challenged.push({ id: judged.item.id || `s${index + 1}`, failed: judged.failed });
    if (!judged.ok) {
      const fatal = judged.failed.some((item) =>
        ["known", "parrot", "evidence", "generic", "obvious", "shape", "type", "checklist"].includes(item)
      );
      const salvaged = !fatal ? seeSalvageCore(judged.item, known, raw) : null;
      if (salvaged) {
        jsKept.push(salvaged);
        return;
      }
      meta.dropped.push({ id: judged.item.id, failed: judged.failed, stage: "js" });
      return;
    }
    jsKept.push(judged.item);
  });

  if (!jsKept.length) {
    return silenceResult(known, { meta });
  }

  let semanticKept = jsKept;
  try {
    const challenged = await callAi(
      [
        { role: "system", content: SEE_CHALLENGE_SYSTEM },
        { role: "user", content: challengeUserPrompt(raw, known, jsKept) },
      ],
      "challenge"
    );
    semanticKept = applySemanticChallenge(jsKept, challenged, known, raw);
    jsKept.forEach((item) => {
      if (!semanticKept.some((row) => row.id === item.id)) {
        meta.dropped.push({ id: item.id, failed: ["semantic"], stage: "model" });
      }
    });
  } catch {
    semanticKept = jsKept.filter((item) => item.confidence === "high" && item.evidence.length >= 2);
    meta.challengeError = true;
  }

  const selected = seeSelectOne(semanticKept);
  if (!selected) {
    return silenceResult(known, { meta });
  }

  let written = {
    insight: selected.statement,
    support: selected.whyItMatters,
  };
  try {
    const out = await callAi(
      [
        { role: "system", content: SEE_WRITER_SYSTEM },
        { role: "user", content: writerUserPrompt(raw, known, selected) },
      ],
      "write"
    );
    if (out && asText(out.insight || out.statement)) {
      const next = {
        insight: asText(out.insight || out.statement),
        support: asText(out.support || out.why || selected.whyItMatters),
      };
      if (discovery.writerIntroducesMeaning(selected, writerAsCore(selected, next)) || seeLooksOverreach(next.insight, next.support)) {
        meta.writerRejected = true;
      } else {
        written = next;
      }
    }
  } catch {
    /* keep selected core; do not retry */
  }

  if (finalOutputFails(written, selected, known, raw)) {
    written = { insight: selected.statement, support: selected.whyItMatters };
    meta.writerRejected = true;
    if (finalOutputFails(written, selected, known, raw)) {
      return silenceResult(known, { meta });
    }
  }

  const projected = projectSeeOutput({
    status: "observation",
    insight: written.insight,
    support: written.support,
    seeType: selected.type,
    evidence: selected.evidence,
    confidence: selected.confidence,
  });
  if (projected.status === "silence") {
    return silenceResult(known, { meta });
  }
  return {
    ...projected,
    knownByUser: known,
    empty: false,
    meta,
  };
}

const QUALITY_FIXTURES = {
  A: {
    id: "A",
    label: "Explicit conclusion parrot",
    ctx: {
      thanksText: "今天有起床。",
      event: "昨天太晚睡，所以今天很累。",
      mood: "平靜",
      bodyMindText: "身體很沉，一直想躺。",
    },
    candidate: {
      id: "a1",
      type: "DRAIN_SOURCE",
      statement: "你今天的疲累可能和昨天晚睡有關。",
      evidence: ["昨天太晚睡，所以今天很累", "身體很沉"],
      newInformation: "晚睡造成今天累",
      whyItMatters: "看見睡眠和疲累的關係。",
      confidence: "high",
    },
    expect: "drop",
  },
  B: {
    id: "B",
    label: "Unstated grounded connection",
    ctx: {
      thanksText: "中午自己煮了飯，吃完比較穩。",
      event: "晚上又加班到十一點，會議一直加需求。",
      mood: "疲憊",
      bodyMindText: "回家後肩膀很緊。",
    },
    candidate: {
      id: "b1",
      type: "CONTRAST",
      statement: "自己煮飯的午後，和加班到十一點後的肩膀緊，放在一起看，今天好像同時有補能和耗能的兩段。",
      evidence: ["中午自己煮了飯，吃完比較穩", "晚上又加班到十一點", "回家後肩膀很緊"],
      newInformation: "這兩段她沒有連起來",
      whyItMatters: "值得留意什麼在補、什麼在耗，而不是只覺得整天都累。",
      confidence: "high",
    },
    expect: "keep",
  },
  C: {
    id: "C",
    label: "Body tiredness only",
    ctx: {
      thanksText: "有喝到水。",
      event: "今天沒什麼特別的事。",
      mood: "平靜",
      bodyMindText: "身體特別累，一直想睡。",
    },
    candidate: {
      id: "c1",
      type: "UNNOTICED_NEED",
      statement: "你的身體在替你說，你其實害怕自己不夠好。",
      evidence: ["身體特別累，一直想睡"],
      newInformation: "疲累來自自我價值",
      whyItMatters: "潛意識正在用想睡逃避。",
      confidence: "high",
    },
    expect: "drop",
  },
  D: {
    id: "D",
    label: "Positive common thread",
    ctx: {
      thanksText: "早上跟媽媽通了電話，後來同事請我喝飲料，晚上又跟朋友散步聊了很久。",
      event: "今天工作普通，但跟人口頭上的往來都讓我很開心。",
      mood: "開心",
      bodyMindText: "身體輕鬆，回家後還想再傳訊息給朋友。",
    },
    candidate: {
      id: "d1",
      type: "ENERGY_SOURCE",
      statement: "今天真正幫你補回能量的，好像都是那些有連結的時刻。",
      evidence: ["早上跟媽媽通了電話", "同事請我喝飲料", "晚上又跟朋友散步聊了很久", "身體輕鬆"],
      newInformation: "她寫了多段連結，但沒說這就是補能的來源",
      whyItMatters: "值得繼續留意：讓你特別好的，可能不是事情順利，而是有人在。",
      confidence: "high",
    },
    expect: "keep",
  },
  E: {
    id: "E",
    label: "Ordinary day silence",
    ctx: {
      thanksText: "今天天氣不錯。",
      event: "上班、吃飯、回家。",
      mood: "平靜",
      bodyMindText: "今天沒什麼特別感覺。",
    },
    candidate: {
      id: "e1",
      type: "COMMON_THREAD",
      statement: "普通的一天本身也是一種狀態。",
      evidence: ["今天沒什麼特別感覺"],
      newInformation: "普通也有意義",
      whyItMatters: "每一天都值得被看見。",
      confidence: "low",
    },
    expect: "drop",
  },
  F: {
    id: "F",
    label: "Explicit causal restated",
    ctx: {
      thanksText: "還有家。",
      event: "我知道自己生氣不是因為碗，是因為每次都要我先開口。",
      mood: "生氣",
      bodyMindText: "胸口熱熱的。",
    },
    candidate: {
      id: "f1",
      type: "CONTRAST",
      statement: "真正讓你生氣的，不是碗，而是每次都要你先開口。",
      evidence: ["我知道自己生氣不是因為碗，是因為每次都要我先開口", "胸口熱熱的"],
      newInformation: "真正生氣的原因",
      whyItMatters: "她看見了關係裡的位置。",
      confidence: "high",
    },
    expect: "drop",
  },
  G: {
    id: "G",
    label: "Unrecognized strength",
    ctx: {
      thanksText: "下午本來很想立刻回那則訊息證明自己沒有錯。",
      event: "最後我先把手機放下，去洗了個澡，晚上才用比較短的句子回。",
      mood: "平靜",
      bodyMindText: "洗完比較鬆，沒有早上那麼衝。",
    },
    candidate: {
      id: "g1",
      type: "UNRECOGNIZED_STRENGTH",
      statement: "你今天其實已經先讓自己停一下，才回那則訊息，這件事你自己沒特別寫成優點。",
      evidence: ["很想立刻回那則訊息", "最後我先把手機放下", "洗完比較鬆"],
      newInformation: "她寫了過程，但沒認出這是自己做得好的地方",
      whyItMatters: "值得看見：衝動先來的時候，你今天有真正換過節奏。",
      confidence: "high",
    },
    expect: "keep",
  },
  H: {
    id: "H",
    label: "Better next response vs checklist",
    ctx: {
      thanksText: "同事還是來問我能不能幫忙。",
      event: "我又先說好，晚上才覺得自己快沒電。",
      mood: "疲憊",
      bodyMindText: "答應完身體就沈下去。",
    },
    direction: {
      id: "h1",
      type: "BETTER_NEXT_RESPONSE",
      statement: "下次遇到類似情況時，也許可以多留意自己是不是又先答應，才回頭感覺累。",
      evidence: ["我又先說好", "晚上才覺得自己快沒電", "答應完身體就沈下去"],
      newInformation: "先答應再累，她沒寫成下次可以換的方向",
      whyItMatters: "這不是行動清單，只是一個可以繼續留意的位置。",
      confidence: "medium",
    },
    checklist: {
      id: "h2",
      type: "BETTER_NEXT_RESPONSE",
      statement: "明天請完成三個行動，練習拒絕。",
      evidence: ["我又先說好", "晚上才覺得自己快沒電"],
      newInformation: "需要行動",
      whyItMatters: "晚上 8 點傳訊息給同事，寫下三件界線。",
      confidence: "high",
    },
  },
  I: {
    id: "I",
    label: "Overpsychology",
    ctx: {
      thanksText: "有吃飯。",
      event: "今天被主管多問了兩句。",
      mood: "忐忑",
      bodyMindText: "胃有點緊。",
    },
    candidate: {
      id: "i1",
      type: "UNNOTICED_NEED",
      statement: "這其實是童年創傷留下的依附，潛意識正在討好，因為你害怕失去。",
      evidence: ["被主管多問了兩句", "胃有點緊"],
      newInformation: "討好型人格",
      whyItMatters: "你的身體在替你說你自我價值不夠。",
      confidence: "high",
    },
    expect: "drop",
  },
};

module.exports = {
  SEE_TYPES,
  SEE_SILENCE_COPY,
  SEE_REASON_SYSTEM,
  SEE_CHALLENGE_SYSTEM,
  SEE_WRITER_SYSTEM,
  QUALITY_FIXTURES,
  runSeePipeline,
  projectSeeOutput,
  evaluateSeeCandidate,
  seeChallenge,
  seeParrotsExplicitConclusion,
  seeLooksOverreach,
  seeLooksActionChecklist,
  seeIsGroundedConnection,
};
