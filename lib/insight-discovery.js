"use strict";

const voice = require("./ing-voice");
const reflectionV3 = require("./reflection-v3");

const DISCOVERY_TYPES = ["CONTRAST", "CONNECTION", "PATTERN", "CHANGE", "HIDDEN_CHOICE", "BLIND_SPOT"];
const SINGLE_DAY_OK = new Set(["CONTRAST", "CONNECTION", "HIDDEN_CHOICE", "BLIND_SPOT"]);
const HISTORY_ONLY = new Set(["PATTERN", "CHANGE"]);

const SILENCE_COPY = {
  kicker: "今天有什麼是你可能還沒看見的？",
  line1: "今天沒有一定要再解讀的地方。",
  line2: "有些日子，好好經歷與記下來，就已經足夠了。",
};

const DISCOVERY_REASON_SYSTEM = `你是 ING 的內部發現引擎，不是寫給使用者看的教練。

先讀 USER RAW 與已鎖定的 KNOWN_BY_USER。
不要把 KNOWN 再包裝成發現。
不要讀 03 AI hypothesis。那些不是 FACT。

FACT_CO_OCCURRENCE != KNOWN_CONNECTION
使用者把 A 和 B 都寫下來，不代表她已經建立 A↔B 的關係。
只有她自己用因果／讓我／我知道是因為／我發現有關／原來是因為／讓我想到，才算 KNOWN 關聯。

只找最多幾件「她自己還沒有明確寫出，但原文有證據」的 candidate。
可以 0 個。不要為了完整而湊。

CONNECTION 可以成立，當：
- 兩個端點都在 USER RAW
- 關係本身她沒有明說
- 不需要腦補隱藏心理也能成立
- 看見這個關係有用
因果沒被證明時，用暫定語氣：放在一起看、可能有一個連結、剛好出現在同一天。
不要寫成「你就是因為 A 所以 B」。

CONTRAST 只寫證據裡的落差。不要加身體警報、悔恨、無法預測、自我欺騙。

只允許 type：
CONTRAST / CONNECTION / PATTERN / CHANGE / HIDDEN_CHOICE / BLIND_SPOT
沒有跨日證據時，不要假裝 PATTERN 或 CHANGE。

每個 candidate 必須有：
statement, evidence[], newInformation, whyItMatters, confidence
newInformation 說不出來就不要列。

禁止：
複述她已寫的結論
把陪伴／幸福／想睡換句話說
心理診斷、創傷、依附、潛意識、自我欺騙
人生哲理、安慰、假深度問題

只輸出 JSON：
{"candidates":[{"id":"d1","type":"CONNECTION","statement":"","evidence":[""],"newInformation":"","whyItMatters":"","confidence":"low|medium|high","question":null}]}`;

const DISCOVERY_CHALLENGE_SYSTEM = `你要攻擊這些 candidate，不是幫忙圓。

先把每個 candidate 拆成：
DISCOVERY_CORE：有 USER RAW 證據、相對 KNOWN 是新的、不是複讀、有 SO WHAT 的觀察
INTERPRETATION_ADDON：心理標籤、沒被支持的因果、身體警報、悔恨、自我欺騙、潛意識

FACT_CO_OCCURRENCE != KNOWN_CONNECTION
使用者分別寫下 A 和 B，並不是已經說「A 造成 B」或「A 跟 B 有關」。
把兩件獨立事實放在一起看，不是 paraphrase。
「她沒有明說關係」是可以當 DISCOVERY 的理由，不是 DROP 的理由。
只有她自己明確建立的關係才是 KNOWN。
若 CORE 只是並置兩件她沒連起來的事實，且沒有寫成「就是因為 A 所以 B」→ KEEP 或 REVISE，不要當 parrot DROP。
例如她寫「跟 Baby 多聊天讓我覺得幸福」→「陪伴讓你幸福」仍是 PARROT。
例如她寫「我知道生氣不是因為碗，是因為每次都要我先開口」→再講一次真正生氣的原因仍是 PARROT。

對 CORE 問：
1. KNOWN？ 2. 換句話說？ 3. 「對啊我剛剛就寫了」？ 4. evidence 是不是 USER RAW？
5. 有沒有 new information？ 6. 所以呢？ 7. 是不是空話？ 8. 問題是否已回答？

對 ADDON 問：
有沒有腦補創傷／依附／害怕失去／逃避／自我價值／潛意識／自我欺騙／身體警報／無法預測／悔恨／真正想要？

規則：
- CORE 不合格 → DROP。不要因為只剩 0 個就救回來。
- CORE 合格、只有 ADDON 不合格 → REVISE：刪掉 addon，只留 core。不要整條 DROP。
- 明確因果沒被原文支持時，core 必須保持暫定語氣，不能改口成「就是因為 A 所以 B」。

只輸出 JSON：
{"items":[{"id":"d1","verdict":"KEEP|REVISE|DROP","parrotLikely":false,"reason":"","failed":[],"addonFailed":["overreach"],"core":{"statement":"","whyItMatters":""}}]}`;

const DISCOVERY_WRITER_SYSTEM = `你只負責把已經通過的 Discovery Core 寫成更順的中文。
只能：簡短、自然、保留證據、必要時降低確定語氣。
輸出必須和 Core 語意等價。

不能新增：因果解釋、道德判斷、人格判斷、心理標籤、隱藏動機、新張力、第二個發現。
不能寫「自我欺騙」「真正讓你」「依附」「創傷」「身體在警報」，除非 Core 裡已經有這些字。
不要把薄的內容寫成金句。
CONNECTION 若未證明因果，保持「放在一起看／可能有一個連結／不一定代表 A 造成 B」。

question 預設 null。只有原文沒回答、且回答會改變這個發現的理解時才問一句具體的話。
不要問「真正的幸福是什麼」「你願意允許自己嗎」。

只輸出 JSON：
{"statement":"","why":"","question":null}`;

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactChars(text) {
  return asText(text).replace(/\s+/g, "").length;
}

function closeKey(text) {
  return asText(text).replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "");
}

function trustRaw(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return {
    thanksText: voice.userRawForPrompt(data.thanksText || data.thanks || ""),
    event: voice.userRawForPrompt(data.event || ""),
    mood: asText(data.mood || data.moodLabel).slice(0, 40),
    bodyMindText: voice.userRawForPrompt(data.bodyMindText || data.bodyNote || ""),
    userAnswer: voice.userRawForPrompt((data.priorRound && data.priorRound.answer) || data.userAnswer || ""),
  };
}

function rawBlob(raw) {
  return [raw.thanksText, raw.event, raw.mood, raw.bodyMindText, raw.userAnswer].filter(Boolean).join("\n");
}

function splitClauses(text) {
  return asText(text)
    .split(/[。！？!?\n；;]+/)
    .map(asText)
    .filter((line) => compactChars(line) >= 4);
}

function hasHistory(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  if (Array.isArray(data.usedPast) && data.usedPast.length) return true;
  if (Array.isArray(data.selectedPast) && data.selectedPast.length) return true;
  return false;
}

function hasExplicitConnectionLanguage(text) {
  const line = asText(text);
  if (!line) return false;
  return /讓我覺得|讓我感到|讓我|所以我(?:覺得)?|因為我|於是我|害我|使我|因為.{1,36}所以|我知道(?:自己)?.{1,36}是因為|不是因為.{1,28}是因為|原來是因為|我發現.{1,36}(?:跟|和|與).{1,36}有關|這件事讓我(?:想到|意識到|看見)|我已經把.{1,24}連/.test(
    line
  );
}

function extractExplicitLinks(text, push, source) {
  const src = asText(text);
  if (!src) return;
  const patterns = [
    /(.{2,40}?)(讓我覺得|讓我感到|讓我|所以我(?:覺得)?|因為我|於是我|害我|使我)(.{2,40})/g,
    /因為(.{2,36})[，,]?所以(.{2,36})/g,
    /我知道(?:自己)?(.{2,36})是因為(.{2,36})/g,
    /不是因為(.{2,28})[，,]?是因為(.{2,36})/g,
    /原來是因為(.{2,40})/g,
    /我發現(.{2,36})(?:跟|和|與)(.{2,36})有關/g,
    /這件事讓我(?:想到|意識到|看見)(.{2,40})/g,
  ];
  patterns.forEach((pattern) => {
    const re = new RegExp(pattern.source, "g");
    let match;
    while ((match = re.exec(src))) {
      const left = asText(match[1]);
      const right = asText(match[match.length - 1]);
      if (compactChars(left) < 2 || compactChars(right) < 2) continue;
      push(`${left} → ${right}`, "link", source);
      push(`使用者已把「${left}」與「${right}」連在一起`, "link", source);
    }
  });
}

function buildKnownByUser(raw) {
  const items = [];
  const push = (text, kind, source) => {
    const line = asText(text);
    if (compactChars(line) < 2) return;
    if (items.some((row) => closeKey(row.text) === closeKey(line))) return;
    items.push({ text: line, kind, source });
  };

  splitClauses(raw.thanksText).forEach((line) => push(line, "stated", "01"));
  splitClauses(raw.event).forEach((line) => push(line, "stated", "02"));
  splitClauses(raw.bodyMindText).forEach((line) => push(line, "stated", "03"));
  splitClauses(raw.userAnswer).forEach((line) => push(line, "stated", "user-answer"));
  if (raw.mood) push(`心情是${raw.mood}`, "emotion", "02");

  const emotionHits = rawBlob(raw).match(/很幸福|感到幸福|覺得幸福|很開心|特別累|一直想睡|想睡覺|很難過|很生氣|很平靜/g) || [];
  emotionHits.forEach((hit) => push(`使用者明確表示：${hit}`, "emotion", "raw"));

  const feelRe = /我覺得(.{2,48})/g;
  [raw.thanksText, raw.event, raw.bodyMindText, raw.userAnswer].forEach((block, index) => {
    const source = ["01", "02", "03", "user-answer"][index];
    const text = asText(block);
    extractExplicitLinks(text, push, source);
    const feel = new RegExp(feelRe);
    let match;
    while ((match = feel.exec(text))) {
      push(`使用者自己的結論：${asText(match[1])}`, "conclusion", source);
    }
  });

  return items;
}

function knownBlob(known) {
  return (Array.isArray(known) ? known : []).map((item) => item.text).join("\n");
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

function hasNewRelationMarker(text) {
  return /開始|反而|可是|卻|沒有對上|不一致|說的是|做的是|選擇了|沒去做|其實更|另一面|放在一起|可能有一個?連結|值得注意|值得留意|沒有跟著結束|剛好出現在同一天|表面上|不一定代表/.test(
    asText(text)
  );
}

function looksLikeRelationDiscovery(text) {
  return /放在一起|這兩件事|可能有一個?連結|值得注意|值得留意|沒有跟著結束|剛好出現在同一天|表面上.{0,20}(但|卻)|最後卻|不一定代表/.test(
    asText(text)
  );
}

function looksExactKnown(statement, known, raw) {
  const text = asText(statement);
  if (!text) return true;
  const key = closeKey(text);
  const rawKey = closeKey(rawBlob(raw));
  if (key.length >= 8 && rawKey.includes(key)) return true;
  const list = Array.isArray(known) ? known : [];
  if (list.some((item) => closeKey(item.text).includes(key) && key.length >= 8)) return true;
  if (list.some((item) => gramOverlap(item.text, text) >= 0.78)) return true;
  if (
    (looksLikeRelationDiscovery(text) || hasNewRelationMarker(text)) &&
    list.some((item) => item.kind === "stated" && gramOverlap(item.text, text) >= 0.7)
  ) {
    return true;
  }
  if (looksLikeRelationDiscovery(text) || hasNewRelationMarker(text)) return false;
  return false;
}

function looksRestatementPredicate(statement) {
  return /你很重視|你很珍惜|你要珍惜|你需要|代表著?你|說明你|提醒你|就是你的|才是你真正|才是真正|對你很重要|你正在學習|你真正(生氣|想|要)|真正生氣的是/.test(
    asText(statement)
  );
}

function leftoverAfterPredicates(statement) {
  return asText(statement)
    .replace(/你很|你要|你需要|你正在|可能|也許|好像/g, "")
    .replace(/重視|珍惜|在乎|需要|代表著?|說明|提醒|學習愛自己|允許自己/g, "")
    .replace(/[的了著是]/g, "");
}

function looksObviousOverlap(statement, raw) {
  const leftover = leftoverAfterPredicates(statement);
  const key = closeKey(leftover);
  const src = closeKey(rawBlob(raw));
  if (!key || key.length < 4 || !src) return false;
  if (!looksRestatementPredicate(statement) && !/陪伴|小事|休息|同時存在/.test(statement)) return false;
  return src.includes(key) || gramOverlap(src, leftover) >= 0.62;
}

function looksGeneric(statement, question) {
  const blob = `${asText(statement)} ${asText(question)}`;
  return /可以同時存在|平凡.{0,8}(小事|日常).{0,8}(重要|幸福)|身體(正在)?提醒你|允許自己(慢下來|休息)|好好愛自己|你需要照顧自己|休息也很重要|幸福藏在|什麼才是真正|學習愛自己|陪伴讓你幸福|日常陪伴|親密關係讓你|讓你有成長|學習讓你有成長/.test(
    blob
  );
}

function looksOverreach(statement, why) {
  return /童年|創傷|原生家庭|依附|潛意識|自我價值|討好型|內在小孩|逃避現實|在逃避|控制欲|恐懼被拋棄|害怕失去|不安全感|人格|自我欺騙|身體.{0,8}警報|解除警報|無法預測|悔恨|神經系統|真正想要|真正讓你/.test(
    `${asText(statement)} ${asText(why)}`
  );
}

function looksPhilosophicalQuestion(question) {
  const q = asText(question);
  if (!q) return false;
  return /真正的幸福|幸福是什麼|願意允許自己|代表什麼|真正想要的是什麼|你覺得呢\s*[？?]?$/.test(q);
}

function isAddonUnit(unit) {
  const line = asText(unit);
  if (!line) return false;
  return (
    looksOverreach(line, "") ||
    /進入了某種|警報狀態|身體(沒有|不曾).{0,12}(鬆|放鬆|解除)|應該當下|悔恨迴圈/.test(line)
  );
}

function stripAddonLanguage(text) {
  const units = asText(text)
    .split(/[。！？!?\n；;，,]+/)
    .map(asText)
    .filter(Boolean);
  const kept = units.filter((unit) => !isAddonUnit(unit));
  return kept.join("，");
}

function restatesKnownLink(statement, known) {
  return (Array.isArray(known) ? known : [])
    .filter((item) => item.kind === "link" || item.kind === "conclusion")
    .some((item) => gramOverlap(item.text, statement) >= 0.52);
}

function isGroundedJuxtaposition(item, known, raw) {
  if (!item || !["CONNECTION", "CONTRAST", "HIDDEN_CHOICE"].includes(item.type)) return false;
  if (!Array.isArray(item.evidence) || item.evidence.length < 2) return false;
  if (!evidenceFromRaw(item.evidence, raw)) return false;
  if (looksGeneric(item.statement, item.question)) return false;
  if (restatesKnownLink(item.statement, known) && hasExplicitConnectionLanguage(rawBlob(raw))) return false;
  return (
    looksLikeRelationDiscovery(item.statement) ||
    hasNewRelationMarker(item.statement) ||
    item.type === "CONTRAST" ||
    item.type === "CONNECTION"
  );
}

function salvageCore(candidate, known, raw, ctx) {
  const item = normalizeCandidate(candidate, 0);
  const statement = stripAddonLanguage(item.statement);
  const why = stripAddonLanguage(item.whyItMatters);
  const info = stripAddonLanguage(item.newInformation);
  const revised = {
    ...item,
    statement: asText(statement),
    newInformation: asText(
      info || (item.type === "CONNECTION" || item.type === "CONTRAST" ? "這兩件事放在一起看，關係還沒被她明說" : item.newInformation)
    ),
    whyItMatters: asText(why || info || `原文同時寫了：${item.evidence.slice(0, 2).join("；")}`),
    salvaged: true,
  };
  if (compactChars(revised.statement) < 8) return null;
  if (looksOverreach(revised.statement, revised.whyItMatters) || looksOverreach(revised.newInformation, "")) return null;
  const judged = deterministicChallenge(revised, known, raw, ctx);
  if (!judged.ok) return null;
  if (parrotLikely(revised.statement, known, raw)) return null;
  return judged.item;
}

function evidenceFromRaw(evidence, raw) {
  const blob = rawBlob(raw);
  const list = Array.isArray(evidence) ? evidence.map(asText).filter(Boolean) : [];
  if (!list.length) return false;
  return list.every((item) => gramOverlap(blob, item) >= 0.45 || blob.includes(item) || item.length <= 24);
}

function normalizeCandidate(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const type = asText(src.type).toUpperCase().replace(/[\s-]/g, "_");
  return {
    id: asText(src.id) || `d${index + 1}`,
    type: DISCOVERY_TYPES.includes(type) ? type : "",
    statement: asText(src.statement || src.idea || src.insight),
    evidence: (Array.isArray(src.evidence) ? src.evidence : []).map(asText).filter(Boolean).slice(0, 6),
    newInformation: asText(src.newInformation || src.newInfo),
    whyItMatters: asText(src.whyItMatters || src.why || src.soWhat),
    confidence: /^(high|medium|low)$/.test(asText(src.confidence)) ? asText(src.confidence) : "low",
    question: asText(src.question) || null,
  };
}

function deterministicChallenge(candidate, known, raw, ctx) {
  const failed = [];
  const item = normalizeCandidate(candidate, 0);
  if (!item.statement) failed.push("shape");
  if (!DISCOVERY_TYPES.includes(item.type)) failed.push("type");
  if (HISTORY_ONLY.has(item.type) && !hasHistory(ctx)) failed.push("history-type");
  if (!SINGLE_DAY_OK.has(item.type) && !hasHistory(ctx) && item.type) failed.push("history-type");
  if (looksExactKnown(item.statement, known, raw)) failed.push("known");
  if (looksObviousOverlap(item.statement, raw)) failed.push("known");
  if (looksRestatementPredicate(item.statement) && looksObviousOverlap(item.statement, raw)) failed.push("paraphrase");
  if (!item.evidence.length || !evidenceFromRaw(item.evidence, raw)) failed.push("evidence");
  if (looksOverreach(item.statement, item.whyItMatters)) failed.push("overreach");
  if (looksGeneric(item.statement, item.question)) failed.push("generic");
  if (!item.newInformation || looksExactKnown(item.newInformation, known, raw)) failed.push("newInformation");
  if (!item.whyItMatters || looksGeneric(item.whyItMatters, "")) failed.push("soWhat");
  if (item.type === "BLIND_SPOT" && item.evidence.length < 2) failed.push("blind-spot");
  if (item.question) {
    if (looksPhilosophicalQuestion(item.question)) failed.push("question");
    if (voice.looksAnswerAlreadyInInput(item.question, rawBlob(raw))) failed.push("question");
  }
  return { ok: !failed.length, failed, item };
}

function parrotLikely(statement, known, raw) {
  if (looksExactKnown(statement, known, raw)) return true;
  if (looksObviousOverlap(statement, raw)) return true;
  if (looksRestatementPredicate(statement) && !hasNewRelationMarker(statement)) return true;
  if (restatesKnownLink(statement, known) && hasExplicitConnectionLanguage(rawBlob(raw)) && !looksLikeRelationDiscovery(statement)) {
    return true;
  }
  return false;
}

function addonOnlyFailure(row) {
  const verdict = asText(row && row.verdict).toUpperCase();
  const failed = Array.isArray(row && row.failed) ? row.failed : [];
  const addonFailed = Array.isArray(row && row.addonFailed) ? row.addonFailed : [];
  if (verdict === "REVISE") return true;
  if (addonFailed.length && !failed.some((item) => ["known", "paraphrase", "parrot", "evidence", "generic"].includes(item))) {
    return true;
  }
  return failed.length > 0 && failed.every((item) => item === "overreach" || item === "soWhat");
}

function applySemanticChallenge(candidates, challengeData, known, raw, ctx) {
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
    const modelParrot = row.parrotLikely === true && !isGroundedJuxtaposition(item, known, raw);
    if (verdict === "KEEP" && !modelParrot && !failed.length) {
      kept.push(item);
      return;
    }
    if (addonOnlyFailure(row) || verdict === "REVISE") {
      const coreStatement = asText(row.core && row.core.statement);
      const coreWhy = asText(row.core && (row.core.whyItMatters || row.core.why));
      const seed = coreStatement ? { ...item, statement: coreStatement, whyItMatters: coreWhy || item.whyItMatters } : item;
      const revised = salvageCore(seed, known, raw, ctx);
      if (revised) kept.push(revised);
      return;
    }
    if (isGroundedJuxtaposition(item, known, raw)) {
      const revised = looksOverreach(item.statement, item.whyItMatters) ? salvageCore(item, known, raw, ctx) : item;
      if (revised && deterministicChallenge(revised, known, raw, ctx).ok && !parrotLikely(revised.statement, known, raw)) {
        kept.push(revised);
      }
    }
  });
  return kept;
}

function writerIntroducesMeaning(core, written) {
  const approved = `${asText(core && core.statement)} ${asText(core && core.whyItMatters)} ${asText(core && core.newInformation)}`;
  const out = `${asText(written && written.statement)} ${asText(written && written.why)}`;
  const labels =
    out.match(
      /自我欺騙|依附|創傷|害怕失去|逃避現實|自我價值|潛意識|警報|無法預測|悔恨|真正讓你|真正想要|討好型|內在小孩|不安全感|心理上的釋放|心理狀態相關|某種釋放/
    ) || [];
  if (labels.some((label) => !approved.includes(label))) return true;
  if (/暗示|通常與/.test(out) && !/暗示|通常與/.test(approved)) return true;
  return false;
}

function scoreCandidate(item) {
  let score = 0;
  if (item.confidence === "high") score += 3;
  if (item.confidence === "medium") score += 2;
  if (item.evidence.length >= 2) score += 2;
  if (hasNewRelationMarker(`${item.statement} ${item.newInformation}`)) score += 2;
  if (item.type === "CONTRAST" || item.type === "CONNECTION") score += 1;
  if (item.type === "BLIND_SPOT") score -= 1;
  return score;
}

function selectOne(candidates) {
  const list = Array.isArray(candidates) ? candidates.slice() : [];
  if (!list.length) return null;
  list.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return list[0];
}

function questionGate(question, raw, discovery) {
  const q = asText(question);
  if (!q) return null;
  if (looksPhilosophicalQuestion(q)) return null;
  if (voice.looksAnswerAlreadyInInput(q, rawBlob(raw))) return null;
  const blob = rawBlob(raw);
  if (/為什麼|什麼原因|是什麼讓你/.test(q) && /因為|原因我已經|就是/.test(blob)) return null;
  if (discovery && gramOverlap(discovery.statement, q) < 0.12 && !asText(discovery.newInformation)) return null;
  return q;
}

function silenceResult(raw, known, extra) {
  return {
    status: "silence",
    discovery: null,
    knownByUser: known,
    coreQuote: "",
    questions: [],
    sourceSig: reflectionV3.reflectionV3SourceSig(raw),
    ...(extra || {}),
  };
}

function projectDiscovery(discovery, raw, known) {
  const question = discovery.question || null;
  return {
    status: "discovery",
    discovery,
    knownByUser: known,
    coreQuote: discovery.statement,
    questions: question
      ? [
          {
            id: "q1",
            title: "",
            insight: discovery.statement,
            question,
            text: discovery.why,
          },
        ]
      : [],
    sourceSig: reflectionV3.reflectionV3SourceSig(raw),
  };
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

【LOCKED KNOWN_BY_USER｜發現不得撞上】
${known.map((item) => `- ${item.text}`).join("\n") || "- （原文很短）"}

FACT_CO_OCCURRENCE != KNOWN_CONNECTION。兩件事實同時出現，不表示她已經建立關係。
不要使用 03 AI insight／support。
沒有真正新東西就輸出 {"candidates":[]}`;
}

function challengeUserPrompt(raw, known, candidates) {
  return `${reasonUserPrompt(raw, known)}

【CANDIDATES】
${JSON.stringify(candidates)}`;
}

function writerUserPrompt(raw, known, discovery) {
  return `只把下面這個已通過的 Discovery Core 寫成更順的中文。必須語意等價。不要加新意思。

【DISCOVERY CORE】
${JSON.stringify({
    type: discovery.type,
    statement: discovery.statement,
    evidence: discovery.evidence,
    newInformation: discovery.newInformation,
    whyItMatters: discovery.whyItMatters,
    question: discovery.question,
  })}

【KNOWN｜不可寫回去】
${known.map((item) => `- ${item.text}`).join("\n")}

【USER RAW】
${rawBlob(raw)}`;
}

async function runDiscoveryPipeline(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx || {};
  if (typeof callAi !== "function") throw new Error("missing callAi");
  const raw = trustRaw(ctx);
  const known = buildKnownByUser(raw);
  const meta = { knownCount: known.length, challenged: [], dropped: [], regenerated: false };

  let reasonData = {};
  try {
    reasonData = await callAi(
      [
        { role: "system", content: DISCOVERY_REASON_SYSTEM },
        { role: "user", content: reasonUserPrompt(raw, known) },
      ],
      "reason"
    );
  } catch {
    return { ...silenceResult(raw, known, { meta }), empty: true };
  }

  const incoming = Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates : [];
  const jsKept = [];
  incoming.forEach((row) => {
    const judged = deterministicChallenge(row, known, raw, ctx);
    meta.challenged.push({ id: judged.item.id, failed: judged.failed });
    if (!judged.ok) {
      const fatal = judged.failed.some((item) =>
        ["known", "paraphrase", "evidence", "generic", "shape", "type", "history-type", "blind-spot"].includes(item)
      );
      const salvaged = !fatal ? salvageCore(judged.item, known, raw, ctx) : null;
      if (salvaged) {
        jsKept.push(salvaged);
        return;
      }
      meta.dropped.push({ id: judged.item.id, failed: judged.failed, stage: "js" });
      return;
    }
    if (parrotLikely(judged.item.statement, known, raw)) {
      meta.dropped.push({ id: judged.item.id, failed: ["parrot"], stage: "js" });
      return;
    }
    jsKept.push(judged.item);
  });

  if (!jsKept.length) {
    return { ...silenceResult(raw, known, { meta }), empty: true };
  }

  let semanticKept = jsKept;
  try {
    const challenged = await callAi(
      [
        { role: "system", content: DISCOVERY_CHALLENGE_SYSTEM },
        { role: "user", content: challengeUserPrompt(raw, known, jsKept) },
      ],
      "challenge"
    );
    semanticKept = applySemanticChallenge(jsKept, challenged, known, raw, ctx);
    jsKept.forEach((item) => {
      if (!semanticKept.some((row) => row.id === item.id)) {
        meta.dropped.push({ id: item.id, failed: ["semantic"], stage: "model" });
      }
    });
  } catch {
    semanticKept = jsKept.filter(
      (item) => item.confidence === "high" && item.evidence.length >= 2 && hasNewRelationMarker(`${item.statement} ${item.newInformation}`)
    );
    meta.challengeError = true;
  }

  const selected = selectOne(semanticKept);
  if (!selected) {
    return { ...silenceResult(raw, known, { meta }), empty: true };
  }

  let written = {
    statement: selected.statement,
    why: selected.whyItMatters,
    question: selected.question,
  };
  try {
    const out = await callAi(
      [
        { role: "system", content: DISCOVERY_WRITER_SYSTEM },
        { role: "user", content: writerUserPrompt(raw, known, selected) },
      ],
      "write"
    );
    if (out && asText(out.statement)) {
      const next = {
        statement: asText(out.statement),
        why: asText(out.why || selected.whyItMatters),
        question: out.question == null ? null : asText(out.question),
      };
      if (writerIntroducesMeaning(selected, next) || looksOverreach(next.statement, next.why)) {
        meta.writerRejected = true;
      } else {
        written = next;
      }
    }
  } catch {
    /* keep selected core; do not retry */
  }

  if (
    looksExactKnown(written.statement, known, raw) ||
    looksGeneric(written.statement, written.question) ||
    looksOverreach(written.statement, written.why) ||
    parrotLikely(written.statement, known, raw) ||
    writerIntroducesMeaning(selected, written)
  ) {
    written = {
      statement: selected.statement,
      why: selected.whyItMatters,
      question: selected.question,
    };
    if (
      looksExactKnown(written.statement, known, raw) ||
      looksGeneric(written.statement, written.question) ||
      looksOverreach(written.statement, written.why) ||
      parrotLikely(written.statement, known, raw)
    ) {
      meta.dropped.push({ id: selected.id, failed: ["writer-parrot"], stage: "writer" });
      return { ...silenceResult(raw, known, { meta }), empty: true };
    }
  }

  const discovery = {
    id: selected.id,
    type: selected.type,
    statement: written.statement,
    why: written.why,
    evidence: selected.evidence,
    newInformation: selected.newInformation,
    confidence: selected.confidence,
    question: questionGate(written.question, raw, selected),
  };
  meta.passId = discovery.id;
  return {
    ...projectDiscovery(discovery, raw, known),
    empty: false,
    meta,
  };
}

const QUALITY_FIXTURES = {
  A: {
    id: "A",
    label: "Baby",
    raw: {
      thanksText: "最近每天都會做一些覺察，也發現跟 Baby 聊的東西變多了。今天我們又一起去吃拉麵，他還幫我切奇異果，我覺得這些很平凡的小事其實很幸福。",
      event: "今天心情很好。",
      mood: "開心",
      bodyMindText: "身體特別累，一直想睡。",
    },
    bad: [
      "你很重視幸福",
      "陪伴讓你幸福",
      "平凡小事很重要",
      "你要珍惜 Baby",
      "開心和累可以同時存在",
      "身體提醒你休息",
      "什麼才是真正的幸福",
    ],
  },
  B: {
    id: "B",
    label: "Insufficient",
    raw: {
      thanksText: "",
      event: "今天特別累，一直想睡。",
      mood: "平靜",
      bodyMindText: "一直想睡。",
    },
    expectSilence: true,
  },
  C: {
    id: "C",
    label: "Positive",
    raw: {
      thanksText: "今天工作順利，學到新東西。",
      event: "晚上跟喜歡的人吃飯，心情很好。",
      mood: "開心",
      bodyMindText: "身體很輕鬆。",
    },
    expectSilenceAllowed: true,
    forbid: /恐懼|依賴|壓力|害怕失去|不安全/,
  },
  D: {
    id: "D",
    label: "Contrast",
    raw: {
      thanksText: "我一直跟自己說家人最重要。",
      event: "這幾天加班到很晚，家人傳訊過來我都已讀不回。",
      mood: "平靜",
      bodyMindText: "肩膀緊緊的。",
    },
    expectType: "CONTRAST",
  },
  E: {
    id: "E",
    label: "Answered",
    raw: {
      thanksText: "今天把話講清楚了。",
      event: "我生氣是因為他當眾打斷我。原因我已經知道了，就是不被尊重。",
      mood: "生氣",
      bodyMindText: "胸口很熱。",
    },
    answeredQuestion: "你為什麼生氣？",
  },
  F: {
    id: "F",
    label: "Semantic Paraphrase",
    pairs: [
      { raw: { thanksText: "跟 Baby 多聊天讓我覺得幸福。", event: "今天很開心。", mood: "開心", bodyMindText: "身體還好。" }, statement: "你很重視和 Baby 的陪伴。" },
      { raw: { thanksText: "今天工作順利，學到新東西。", event: "把專案做完了。", mood: "平靜", bodyMindText: "有點累。" }, statement: "學習讓你有成長。" },
      { raw: { thanksText: "", event: "今天特別累，一直想睡。", mood: "平靜", bodyMindText: "一直想睡。" }, statement: "你的身體在提醒你休息。" },
      { raw: { thanksText: "晚上跟喜歡的人吃飯。", event: "心情很好。", mood: "開心", bodyMindText: "很放鬆。" }, statement: "親密關係讓你感到快樂。" },
      { raw: { thanksText: "我已經決定先不回那則訊息。", event: "先把手機放下。", mood: "平靜", bodyMindText: "比較鬆。" }, statement: "你決定先不回那則訊息。" },
    ],
  },
};

function evaluateBadStatement(statement, rawInput) {
  const raw = trustRaw(rawInput);
  const known = buildKnownByUser(raw);
  const judged = deterministicChallenge(
    {
      id: "bad",
      type: "CONNECTION",
      statement,
      evidence: splitClauses(rawBlob(raw)).slice(0, 2),
      newInformation: statement,
      whyItMatters: statement,
      confidence: "high",
    },
    known,
    raw,
    {}
  );
  const parrot = parrotLikely(statement, known, raw) || looksGeneric(statement, statement);
  return { drop: !judged.ok || parrot, failed: judged.failed, parrot };
}

module.exports = {
  DISCOVERY_TYPES,
  SILENCE_COPY,
  DISCOVERY_REASON_SYSTEM,
  DISCOVERY_CHALLENGE_SYSTEM,
  DISCOVERY_WRITER_SYSTEM,
  QUALITY_FIXTURES,
  trustRaw,
  buildKnownByUser,
  deterministicChallenge,
  parrotLikely,
  questionGate,
  selectOne,
  runDiscoveryPipeline,
  evaluateBadStatement,
  looksGeneric,
  looksExactKnown,
  hasExplicitConnectionLanguage,
  salvageCore,
  writerIntroducesMeaning,
  isGroundedJuxtaposition,
};
