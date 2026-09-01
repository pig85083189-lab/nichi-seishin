"use strict";

const voice = require("./ing-voice");
const bodyMind = require("./body-mind");
const discovery = require("./insight-discovery");
const thinkingCore = require("./insight-thinking-core");

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
優先選最有價值的一條。正向觀察與張力觀察同等認真，不是比較少做正向。

使用者分別寫下多件開心／放鬆／有人／自己有選擇的時刻，只是 FACT_CO_OCCURRENCE。
除非她自己明說「都是因為連結／陪伴／有選擇／所以今天很好」，否則 COMMON_THREAD / ENERGY_SOURCE / UNRECOGNIZED_STRENGTH 仍可成立。
多件感謝若共享「怎麼對待另一個人／關心有沒有出現」的結構，可以提出 CALIBRATED HYPOTHESIS，不必等她自己寫出因果句。
不要推論「你需要陪伴」「你害怕孤單」「關係是你的核心需求」。
若多件好事沒有共享元素，不要硬湊共同主線。

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
statement 不要用問句。

每個 candidate 必須有：
statement, evidence[], newInformation, whyItMatters, confidence
另給 alternative：一個更普通、也可能成立的解釋。
newInformation 說不出來就不要列。

statement 必須是 INTERPRETATION（可為暫定假設），不是摘要，也不是標籤。
「妳很重視關係／更穩定／正在成長」若說不出結構與為什麼，就不要列。
並置兩件事實還不夠；要能回答：這可能代表什麼？
允許暫定語氣：好像／可能／也許／不確定是不是／有一個角度值得看。
不要求確定；要求有原文證據、一步推論、給她新透鏡。
interpretation 只是假設，後面 04 回答可以推翻它。

只輸出 JSON：
{"candidates":[{"id":"s1","type":"COMMON_THREAD","statement":"","evidence":[""],"newInformation":"","whyItMatters":"","alternative":"","confidence":"low|medium|high"}]}`;

const SEE_CHALLENGE_SYSTEM = `你要攻擊這些 candidate，不是幫忙圓。

先把每個 candidate 拆成：
SEE_CORE：有 USER RAW 證據、相對 KNOWN 是新的、不是複讀、知道這件事後她會更理解自己
INTERPRETATION_ADDON：心理標籤、沒被支持的因果、身體當心理證據、潛意識、討好、創傷、依附

FACT_CO_OCCURRENCE != KNOWN_CONNECTION
使用者分別寫下 A 和 B，並不是已經說「A 造成 B」。
把兩件獨立事實放在一起看，不是 paraphrase。
只有她自己明確建立的關係才是 KNOWN。
若 CORE 只是並置兩件她沒連起來的事實，且沒有寫成「就是因為 A 所以 B」→ KEEP 或 REVISE，不要當 parrot DROP。
多件分開的正向時刻共享一個她沒寫出的元素（連結、有選擇、她做得好）時，同樣不是 parrot。

對 CORE 問：
1. 她看到會不會說「對啊，我剛剛就寫了」？
2. evidence 是不是 USER RAW？
3. 知道這件事後，她會更理解自己嗎？
4. 是不是空話／真但顯而易見？
5. 有沒有過度心理化？
6. 是不是 LABEL_ONLY（更穩定／很在乎關係／正在成長）而沒有說清結構？

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
  const hits = list.filter((item) => {
    if (!item) return false;
    if (item.length <= 28) return true;
    if (blob.includes(item)) return true;
    if (gramOverlap(blob, item) >= 0.4) return true;
    const key = closeKey(item);
    return key.length >= 6 && closeKey(blob).includes(key.slice(0, Math.min(12, key.length)));
  });
  return hits.length >= Math.max(1, Math.ceil(list.length * 0.5));
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

function seeLooksNeedInference(statement) {
  return /你需要陪伴|你害怕孤單|你怕孤單|關係是你的核心需求|你其實需要人|你缺的是陪伴/.test(asText(statement));
}

function looksPositiveMoment(line) {
  return /開心|很好|放鬆|輕鬆|笑|幸福|很穩|比較穩|舒服|有選擇|自己(煮|做|選|決定)|沒有立刻|感謝|謝謝|好好說話|想到別人|出現在我身邊|請我喝|打電話|聊天|有人聽/.test(asText(line));
}

function looksConnectionMoment(line) {
  return /媽媽|爸爸|朋友|同事|伴侶|男友|女友|家人|聊天|電話|散步|吃飯|請我喝|陪|身邊|別人|每一個人|出現在|好好說話|想到別人|陪伴/.test(asText(line));
}

function looksAutonomyMoment(line) {
  return /自己(煮|做|選|決定|來)|我選|我決定|先不|我先把|沒有立刻答應|沒有被/.test(asText(line));
}

function looksGratitudeCareMoment(line) {
  const text = asText(line);
  if (!/感謝|謝謝/.test(text)) return false;
  return /好好說話|想到別人|出現在|身邊|陪伴|別人可以更好|每一個人|需要的時候/.test(text);
}

function collectIndependentMoments(raw) {
  const lines = [raw.thanksText, raw.event, raw.bodyMindText]
    .join("。")
    .split(/[。！？!?\n；;]+/)
    .map(asText)
    .filter((line) => compactChars(line) >= 4);
  const positive = lines.filter(looksPositiveMoment);
  const connection = positive.filter(looksConnectionMoment);
  const autonomy = positive.filter(looksAutonomyMoment);
  return { lines, positive, connection, autonomy };
}

function clipSeeText(text, maxChars, maxSentences) {
  const parts = asText(text)
    .split(/(?<=[。！？!?])/)
    .map(asText)
    .filter(Boolean);
  if (!parts.length) return asText(text);
  let next = parts.slice(0, Math.max(1, maxSentences || 4)).join("");
  const limit = Number(maxChars) || 110;
  if (compactChars(next) <= limit) return next;
  next = parts.slice(0, Math.min(2, parts.length)).join("");
  if (compactChars(next) <= limit) return next;
  next = parts[0] || next;
  if (compactChars(next) <= limit) return next;
  let count = 0;
  for (let i = 0; i < next.length; i += 1) {
    if (!/\s/.test(next[i])) count += 1;
    if (count >= limit && /[，。！？、；]/.test(next[i])) {
      return asText(next.slice(0, i + 1));
    }
  }
  return next;
}

function namedPeopleCause(raw) {
  return /都是因為.{0,24}(陪|有人|朋友|家人|連結)/.test(rawBlob(raw));
}

function maybeSeedPositiveThread(incoming, raw) {
  const list = Array.isArray(incoming) ? incoming.slice() : [];
  if (namedPeopleCause(raw)) return list;
  const hasPositiveType = list.some((row) => {
    const type = asText(row && row.type).toUpperCase().replace(/[\s-]/g, "_");
    const text = `${asText(row && row.statement)} ${asText(row && row.whyItMatters)}`;
    if (seeLooksEngineLeak(text) || seeLooksNoValue(asText(row && row.statement))) return false;
    return type === "ENERGY_SOURCE" || type === "COMMON_THREAD" || type === "UNRECOGNIZED_STRENGTH";
  });
  if (hasPositiveType) return list;
  const moments = collectIndependentMoments(raw);
  const gratitudeCare = moments.lines.filter(looksGratitudeCareMoment);
  if (gratitudeCare.length >= 2) {
    list.push({
      id: "seed-gratitude-care",
      type: "COMMON_THREAD",
      statement: "這幾件感謝裡，好像有一個共同方向：妳在意的是人和人之間怎麼被對待。",
      evidence: gratitudeCare.slice(0, 4),
      newInformation: "分開寫的感謝，共享的對待結構還沒被連起來",
      whyItMatters: "值得用假設來看：今天被寫下的，可能不只是感謝清單，而是關心有沒有出現在說話、做事和陪伴裡。",
      alternative: "也可能只是習慣寫幾句感謝，沒有更深共同點。",
      confidence: "medium",
    });
    return list;
  }
  if (moments.connection.length >= 2) {
    list.push({
      id: "seed-connect",
      type: "ENERGY_SOURCE",
      statement: "今天真正讓你補回能量的，好像都是那些有連結的時刻。",
      evidence: moments.connection.slice(0, 4),
      newInformation: "這幾段有人的時刻分開寫了，關係還沒被明說",
      whyItMatters: "值得留意：讓你特別好的，可能不是事情順利，而是有人在。",
      confidence: "medium",
    });
    return list;
  }
  if (moments.autonomy.length >= 2) {
    list.push({
      id: "seed-choice",
      type: "COMMON_THREAD",
      statement: "今天讓你比較穩的時候，好像都是那些你有選擇的時刻。",
      evidence: moments.autonomy.slice(0, 4),
      newInformation: "這幾次自己做決定分開寫了，還沒被連成一條",
      whyItMatters: "值得留意：比較穩的時候，常常跟著有選擇一起出現。",
      confidence: "medium",
    });
  }
  return list;
}

function coreIsUserReadable(item) {
  const statement = asText(item && item.statement);
  const why = asText(item && item.whyItMatters);
  if (compactChars(statement) < 12 || compactChars(statement) > 70) return false;
  if (countSeeSentences(statement) > 2) return false;
  if (compactChars(why) > 110 || countSeeSentences(why) > 4) return false;
  if (seeLooksOverreach(statement, why) || seeLooksNeedInference(statement)) return false;
  return true;
}

function countSeeSentences(text) {
  return asText(text)
    .split(/[。！？!?\n]+/)
    .map(asText)
    .filter(Boolean).length;
}

function seeLooksGeneric(statement) {
  return /身體(正在)?提醒你|允許自己(慢下來|休息)|好好愛自己|你需要照顧自己|休息也很重要|幸福藏在|學習愛自己|每一個感受都值得|成長的一部分|相信一切都是最好/.test(
    asText(statement)
  );
}

function seeLooksNoValue(statement) {
  return /普通的一天|本身也是一種狀態|沒什麼特別|沒有特別強烈的感受|每一天都值得被看見|沒有一定要再解讀|不需要再提煉/.test(
    asText(statement)
  );
}

function seeLooksEngineLeak(text) {
  return /LOCKED_KNOWN|KNOWN_BY_USER|無獨立\s*CORE|SEE_CORE|INTERPRETATION_ADDON|FACT_CO_OCCURRENCE|candidate 製造|這個連結是 candidate|不需要再提煉/.test(
    asText(text)
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
    /(?:今天.{0,10}好.{0,8}|過得好.{0,8})都是因為(.{2,36})/g,
    /都是因為(.{2,36})/g,
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

function seeLooksForcedThread(item) {
  if (!item || (item.type !== "COMMON_THREAD" && item.type !== "ENERGY_SOURCE")) return false;
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  const conn = evidence.filter(looksConnectionMoment);
  const auto = evidence.filter(looksAutonomyMoment);
  if (conn.length >= 2 || auto.length >= 2) return false;
  return /都指向|生活的熱愛|每一件小事都|其實都在說你|都是對生活/.test(`${item.statement} ${item.whyItMatters}`);
}

function seeParrotsExplicitConclusion(statement, known, raw) {
  if (discovery.parrotLikely(statement, known, raw)) return true;
  const blob = rawBlob(raw);
  const pairs = extractCausePairs(blob);
  if (pairs.some(([left, right]) => sharesCauseTopic(left, statement) && sharesCauseTopic(right, statement))) {
    return true;
  }
  if (/都是因為.{0,24}(陪|有人|朋友|家人|連結)/.test(blob) && /連結|陪伴|有人|聊天/.test(asText(statement))) {
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
  return hasRelationMarker(`${item.statement} ${item.newInformation}`) || item.type === "CONTRAST" || item.type === "COMMON_THREAD" || item.type === "ENERGY_SOURCE" || item.type === "UNRECOGNIZED_STRENGTH";
}

function stripAddonLanguage(text) {
  const units = asText(text)
    .split(/[。！？!?\n；;，,]+/)
    .map(asText)
    .filter(Boolean);
  const kept = units.filter((unit) => !seeLooksOverreach(unit, "") && !/身體在替你|潛意識|真正害怕/.test(unit) && !/[？?]/.test(unit));
  return kept.join("，");
}

function stripEngineLeak(text) {
  const parts = asText(text)
    .split(/(?<=[。！？!?])/)
    .map(asText)
    .filter(Boolean);
  return asText(parts.filter((part) => !seeLooksEngineLeak(part)).join(""));
}

function stripQuestionClauses(text) {
  const parts = asText(text)
    .split(/(?<=[。！？!?])/)
    .map(asText)
    .filter(Boolean);
  const kept = parts.filter((part) => !/[？?]/.test(part));
  return asText(kept.join("") || asText(text).replace(/[？?].*$/, ""));
}

function normalizeCandidate(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const type = asText(src.type).toUpperCase().replace(/[\s-]/g, "_");
  const statement = stripEngineLeak(stripQuestionClauses(asText(src.statement || src.idea || src.insight)));
  return {
    id: asText(src.id) || `s${index + 1}`,
    type: SEE_TYPES.includes(type) ? type : "",
    statement,
    evidence: (Array.isArray(src.evidence) ? src.evidence : []).map(asText).filter(Boolean).slice(0, 6),
    newInformation: stripEngineLeak(asText(src.newInformation || src.newInfo)),
    whyItMatters: stripEngineLeak(stripQuestionClauses(asText(src.whyItMatters || src.why || src.soWhat || src.support))),
    alternative: asText(src.alternative),
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
  if (seeLooksOverreach(item.statement, item.whyItMatters) || seeLooksNeedInference(item.statement) || bodyMind.looksOverPsych(`${item.statement}${item.whyItMatters}`)) {
    failed.push("overreach");
  }
  if (voice.looksPhysicalPsychologized(rawBlob(raw), item.statement)) failed.push("overreach");
  if (seeLooksGeneric(item.statement) || seeLooksNoValue(item.statement) || seeLooksForcedThread(item) || bodyMind.looksSoupBodyMind(item.statement) || seeLooksEngineLeak(`${item.statement} ${item.whyItMatters}`)) failed.push("generic");
  if (thinkingCore.looksLabelOnly(item.statement, item.whyItMatters)) failed.push("label-only");
  if (thinkingCore.looksCoOccurrenceOnly(item.statement, item.whyItMatters)) failed.push("shallow");
  if (!thinkingCore.interpretationHasDepth(item.statement, item.whyItMatters, rawBlob(raw))) failed.push("shallow");
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
  let statement = asText(stripAddonLanguage(item.statement));
  let why = asText(stripAddonLanguage(item.whyItMatters) || `原文同時寫了：${item.evidence.slice(0, 2).join("；")}`);
  if (!thinkingCore.hasCalibratedHypothesis(`${statement} ${why}`) && seeIsGroundedConnection(item, known, raw)) {
    statement = /好像|可能|也許|值得/.test(statement) ? statement : `有一個可能值得注意的角度：${statement}`;
    why = /好像|可能|也許|值得/.test(why) ? why : `這也許值得用假設來看：${why}`;
  }
  const revised = {
    ...item,
    statement,
    newInformation: asText(
      stripAddonLanguage(item.newInformation) ||
        (CONNECTING_TYPES.has(item.type) ? "這兩件事放在一起看，關係還沒被她明說" : item.newInformation)
    ),
    whyItMatters: why,
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
    const deterministicOk =
      seeChallenge(item, known, raw).ok &&
      !seeParrotsExplicitConclusion(item.statement, known, raw) &&
      !seeLooksOverreach(item.statement, item.whyItMatters) &&
      !thinkingCore.looksLabelOnly(item.statement, item.whyItMatters);

    if (verdict === "KEEP" && deterministicOk) {
      kept.push(item);
      return;
    }

    if (addonOnlyFailure(row) || verdict === "REVISE") {
      const coreStatement = stripQuestionClauses(asText(row.core && row.core.statement));
      const coreWhy = asText(row.core && (row.core.whyItMatters || row.core.why));
      const seed = coreStatement ? { ...item, statement: coreStatement, whyItMatters: coreWhy || item.whyItMatters } : item;
      const revised = seeSalvageCore(seed, known, raw);
      if (revised) {
        kept.push(revised);
        return;
      }
      // Salvage miss must not erase a JS-validated calibrated hypothesis.
      if (deterministicOk && (seeIsGroundedConnection(item, known, raw) || thinkingCore.hasCalibratedHypothesis(`${item.statement} ${item.whyItMatters}`))) {
        kept.push(item);
      }
      return;
    }

    // Model DROP: only erase when deterministic gates also fail, or parrot is independently confirmed.
    const modelParrotConfirmed = row.parrotLikely === true && seeParrotsExplicitConclusion(item.statement, known, raw);
    if (modelParrotConfirmed) return;
    if (deterministicOk && (seeIsGroundedConnection(item, known, raw) || thinkingCore.hasCalibratedHypothesis(`${item.statement} ${item.whyItMatters}`))) {
      kept.push(item);
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
  const moments = collectIndependentMoments(raw);
  let hint = "";
  if (moments.connection.length >= 2 || moments.autonomy.length >= 2) {
    const listed = (moments.connection.length >= 2 ? moments.connection : moments.autonomy)
      .slice(0, 6)
      .map((line) => `- ${line}`)
      .join("\n");
    hint = `
【分開寫下的正向時刻｜尚未等於已知連結】
${listed}
這些時刻同時出現，不代表她已經說出它們的共同點。
若有共享元素且她沒明說，可考慮 COMMON_THREAD / ENERGY_SOURCE / UNRECOGNIZED_STRENGTH。
若沒有共享元素，不要硬湊。不要推論你需要陪伴、害怕孤單、或關係是核心需求。`;
  }
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
${hint}

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
insight：1～2 短句，約 25～55 字。
support：2～4 短句，合計約 40～110 字。只說為什麼注意到、今天哪裡支持、可以繼續留意什麼。不要寫成 04 深思。

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
    thinkingCore: thinkingCore.EMPTY_CORE,
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
  if (seeLooksEngineLeak(`${statement} ${support}`)) return true;
  if (thinkingCore.looksLabelOnly(statement, support)) return true;
  if (seeLooksOverreach(statement, support) || bodyMind.looksOverPsych(`${statement}${support}`)) return true;
  if (voice.looksPhysicalPsychologized(rawBlob(raw), statement)) return true;
  if (seeLooksActionChecklist(support)) return true;
  if (bodyMind.looksQuestionOutput(`${statement}${support}`)) return true;
  if (discovery.writerIntroducesMeaning(selected, writerAsCore(selected, { insight: statement, support }))) return true;
  return false;
}

function projectSeeOutput(seen) {
  const src = seen && typeof seen === "object" ? seen : {};
  const silent = {
    insight: SEE_SILENCE_COPY.insight,
    support: SEE_SILENCE_COPY.support,
    status: "silence",
    seeType: "",
    evidence: [],
    confidence: "",
    thinkingCore: thinkingCore.EMPTY_CORE,
  };
  if (src.status === "silence" || !asText(src.insight)) return silent;
  const cleaned = bodyMind.normalizeBodyMindInsight({ insight: src.insight, support: src.support });
  if (!cleaned.insight) return silent;
  return {
    insight: cleaned.insight,
    support: cleaned.support || asText(src.support),
    status: "observation",
    seeType: SEE_TYPES.includes(asText(src.seeType).toUpperCase()) ? asText(src.seeType).toUpperCase() : "",
    evidence: (Array.isArray(src.evidence) ? src.evidence : []).map(asText).filter(Boolean).slice(0, 6),
    confidence: /^(high|medium|low)$/.test(asText(src.confidence)) ? asText(src.confidence) : "",
    thinkingCore: thinkingCore.normalizeThinkingCore(src.thinkingCore),
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
  const skipChallenge = opts.skipChallenge === true;
  const skipWriter = opts.skipWriter === true;
  const skipWriterIfReadable = opts.skipWriterIfReadable === true;
  if (typeof callAi !== "function") throw new Error("missing callAi");
  const raw = discovery.trustRaw(ctx);
  const known = discovery.buildKnownByUser(raw);
  const meta = {
    knownCount: known.length,
    challenged: [],
    dropped: [],
    writerRejected: false,
    dropStage: "",
    reasonCount: 0,
    usedChallenge: false,
    usedWriter: false,
  };

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
    meta.dropStage = "reason";
    return silenceResult(known, { meta });
  }

  const incoming = maybeSeedPositiveThread(
    Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates : [],
    raw
  );
  meta.reasonCount = Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates.length : 0;
  meta.seeded = incoming.some((row) => asText(row && row.id).indexOf("seed-") === 0);
  const jsKept = [];
  incoming.forEach((row, index) => {
    const judged = seeChallenge(row, known, raw);
    meta.challenged.push({ id: judged.item.id || `s${index + 1}`, failed: judged.failed });
    if (!judged.ok) {
      const fatal = judged.failed.some((item) =>
        ["known", "parrot", "evidence", "generic", "obvious", "label-only", "shape", "type", "checklist"].includes(item)
      );
      // shallow alone is salvageable / re-checkable; do not treat as hard fatal erase
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
    const fallbackSeed = maybeSeedPositiveThread([], raw).filter((row) => asText(row && row.id).indexOf("seed-") === 0);
    fallbackSeed.forEach((row, index) => {
      const judged = seeChallenge(row, known, raw);
      meta.challenged.push({ id: judged.item.id || `seed${index + 1}`, failed: judged.failed, stage: "seed-fallback" });
      if (judged.ok) {
        jsKept.push(judged.item);
        meta.seeded = true;
      }
    });
  }
  if (!jsKept.length) {
    meta.dropStage = meta.reasonCount || meta.seeded ? "js" : "reason";
    return silenceResult(known, { meta });
  }

  let semanticKept = jsKept;
  if (!skipChallenge) {
    meta.usedChallenge = true;
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
      // Challenge transport/parse failure must not erase JS-passed depth candidates.
      semanticKept = jsKept.filter((item) => seeChallenge(item, known, raw).ok);
      meta.challengeError = true;
    }
  }

  const selected = seeSelectOne(semanticKept);
  if (!selected) {
    meta.dropStage = skipChallenge ? "js" : "challenge";
    return silenceResult(known, { meta });
  }

  let written = {
    insight: clipSeeText(selected.statement, 70, 2),
    support: clipSeeText(selected.whyItMatters, 110, 4),
  };
  const canSkipWriter = skipWriter || (skipWriterIfReadable && coreIsUserReadable(selected));
  if (!canSkipWriter) {
    try {
      const out = await callAi(
        [
          { role: "system", content: SEE_WRITER_SYSTEM },
          { role: "user", content: writerUserPrompt(raw, known, selected) },
        ],
        "write"
      );
      meta.usedWriter = true;
      if (out && asText(out.insight || out.statement)) {
        const next = {
          insight: clipSeeText(asText(out.insight || out.statement), 70, 2),
          support: clipSeeText(asText(out.support || out.why || selected.whyItMatters), 110, 4),
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
  }

  if (finalOutputFails(written, selected, known, raw)) {
    written = {
      insight: clipSeeText(selected.statement, 70, 2),
      support: clipSeeText(selected.whyItMatters, 110, 4),
    };
    meta.writerRejected = true;
    if (finalOutputFails(written, selected, known, raw)) {
      meta.dropStage = "writer";
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
    thinkingCore: thinkingCore.normalizeThinkingCore({
      facts: selected.evidence,
      interpretation: written.insight,
      alternative: selected.alternative,
      whyWorthKnowing: written.support,
      status: "hypothesis",
      source: "see",
    }),
  });
  if (projected.status === "silence") {
    meta.dropStage = "writer";
    return silenceResult(known, { meta });
  }
  projected.support = clipSeeText(projected.support, 110, 4);
  projected.insight = clipSeeText(projected.insight, 70, 2);
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
      statement: "你今天做的，可能不只是延後回訊息，而是衝動先來時，你替自己換了一個節奏。",
      evidence: ["很想立刻回那則訊息", "最後我先把手機放下", "洗完比較鬆"],
      newInformation: "她寫了過程，但沒認出這是自己做得好的地方",
      whyItMatters: "值得看見：真正換過節奏的，也許不是回覆本身，而是中間那個停一下。",
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
  P1: {
    id: "P1",
    label: "Positive connection thread",
    ctx: {
      thanksText: "中午和朋友吃飯很開心。",
      event: "晚上跟家人聊天覺得很放鬆。後來跟伴侶散步，覺得今天很好。",
      mood: "開心",
      bodyMindText: "身體輕鬆。",
    },
    candidate: {
      id: "p1",
      type: "ENERGY_SOURCE",
      statement: "今天真正讓你補回能量的，好像都是那些有連結的時刻。",
      evidence: ["中午和朋友吃飯很開心", "晚上跟家人聊天覺得很放鬆", "後來跟伴侶散步，覺得今天很好"],
      newInformation: "她列了三段有人的時刻，但沒說這就是補能的來源",
      whyItMatters: "值得留意：讓你特別好的，可能不是事情順利，而是有人在。",
      confidence: "high",
    },
    expect: "keep",
  },
  P2: {
    id: "P2",
    label: "Positive autonomy thread",
    ctx: {
      thanksText: "中午自己決定去走那條路，比較順。",
      event: "下午會議我選了先聽完再回答，沒有立刻答應加班。晚上自己煮了麵。",
      mood: "平靜",
      bodyMindText: "比較穩。",
    },
    candidate: {
      id: "p2",
      type: "COMMON_THREAD",
      statement: "今天讓你比較穩的時候，好像都是那些你有選擇的時刻。",
      evidence: ["中午自己決定去走那條路，比較順", "沒有立刻答應加班", "晚上自己煮了麵"],
      newInformation: "她寫了幾次自己做決定，但沒連成一條",
      whyItMatters: "值得留意：比較穩的時候，常常跟著有選擇一起出現。",
      confidence: "high",
    },
    expect: "keep",
  },
  P3: {
    id: "P3",
    label: "Unrecognized positive change",
    ctx: {
      thanksText: "以前這種訊息我會立刻回很長。",
      event: "今天我先把手機放下，洗完澡才用短句子回。",
      mood: "平靜",
      bodyMindText: "洗完比較鬆。",
    },
    candidate: {
      id: "p3",
      type: "UNRECOGNIZED_STRENGTH",
      statement: "你今天做的，可能不只是回得比較短，而是衝動先來時，你替自己換了一個節奏。",
      evidence: ["以前這種訊息我會立刻回很長", "今天我先把手機放下", "洗完比較鬆"],
      newInformation: "她寫了不同做法，但沒把它寫成自己的進步",
      whyItMatters: "值得看見：真正改變的，也許不是回覆長短，而是中間那個停一下。",
      confidence: "high",
    },
    expect: "keep",
  },
  P4: {
    id: "P4",
    label: "Unrelated goods no thread",
    ctx: {
      thanksText: "今天天氣很好。中午那杯咖啡也很好喝。",
      event: "把專案做完了，心情不錯。",
      mood: "開心",
      bodyMindText: "身體還好。",
    },
    candidate: {
      id: "p4",
      type: "COMMON_THREAD",
      statement: "今天這些好事其實都指向你對生活的熱愛。",
      evidence: ["今天天氣很好", "中午那杯咖啡也很好喝", "把專案做完了"],
      newInformation: "好事都有共同意義",
      whyItMatters: "每一件小事都在說你熱愛生活。",
      confidence: "medium",
    },
    expect: "drop",
  },
  P5: {
    id: "P5",
    label: "Explicit good-day cause",
    ctx: {
      thanksText: "朋友、家人、同事都在。",
      event: "今天過得好，都是因為一直有人陪我。",
      mood: "開心",
      bodyMindText: "身體輕鬆。",
    },
    candidate: {
      id: "p5",
      type: "ENERGY_SOURCE",
      statement: "今天真正幫你補回能量的，好像都是那些有連結的時刻。",
      evidence: ["朋友、家人、同事都在", "今天過得好，都是因為一直有人陪我"],
      newInformation: "連結補能",
      whyItMatters: "陪伴讓你今天很好。",
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
  clipSeeText,
  collectIndependentMoments,
  maybeSeedPositiveThread,
  seeLooksNeedInference,
  looksLabelOnly: thinkingCore.looksLabelOnly,
};
