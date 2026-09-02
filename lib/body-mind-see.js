"use strict";

const voice = require("./ing-voice");
const bodyMind = require("./body-mind");
const discovery = require("./insight-discovery");
const thinkingCore = require("./insight-thinking-core");
const valueLenses = require("./insight-value-lenses");
const answerEngine = require("./ing-answer-engine");

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

const SEE_REASON_SYSTEM = `你是 ING 的 03 SEE｜探索性反思引擎，不是保守分類器。

${answerEngine.ANSWER_ENGINE_VOICE}

任務：從使用者寫下的生活內容裡，主動找出她自己可能還沒注意到的東西。
成功標準：讓她有「欸，這個角度我自己沒想到」的感覺。
失敗：什麼都不敢說、或回覆「妳已經看得很清楚了」。

【必須先廣泛想】
對有意義的日記，先在內部用多個 lens 探索，盡量產出至少 5 個彼此不同的 candidate。
lens 示例（給你想，不要當標籤顯示）：
RELATIONSHIP / BOUNDARY / EXPECTATION / SELF-IMAGE / VALUE / FEAR / NEED /
CHOICE / CONTRADICTION / EMOTIONAL TRIGGER / MEANING / ASSUMPTION / IDENTITY /
BODY SIGNAL / POSITIVE CHANGE / PATTERN / ALTERNATIVE INTERPRETATION /
WHAT HURTS MOST / WHAT MATTERS MOST / WHAT USER MAY BE PROTECTING /
THANKS×EVENT×BODY（三類原文交叉）

然後依此排序，只交最強的幾條（至少 1，目標 3～5）：
1. 能不能讓她注意到新東西？
2. RAW 有沒有一點證據／觸發點？
3. 是否明顯不同於她已寫的話？
4. 值不值得成為下一步思考的入口？
選「最值得探索」的，不要選「最安全空白」的。

【三類整合｜最高優先】
若今天同時有【01 感謝】【02 事件】【03 身心】：
必須至少提出一個把三者放在一起看的假說。
禁止只讀感謝、只讀事件、或只讀身體不舒服。
禁止捏造原文沒出現的事實。
若感謝指向被好好對待，而事件指向被推開／被拒絕，優先做這個對比。

【假說 ≠ 幻覺】
你可以探索：可能的期待、需要、害怕、關係動力、界線、自我形象、價值、內在衝突、
情緒意義、遠近親疏、被評價／被拒絕、控制與責任、 disproportion 的刺痛、正向改變、優點、慾望。
你不可以：捏造她沒寫的具體事實、事件、人物、歷史。

【語言】
用探索語氣：有沒有一種可能／我會有點好奇／這裡也許可以再往下看一層／不一定是這樣，但有個角度值得感受。
不要用定論：真正的問題就是／這證明妳／妳一定是／妳其實一直都。

【禁止】
- 把 0 個 candidate 當成功（有意義內容時）
- 「今天的你好像已經看得滿清楚了」「暫時沒有看到需要再被解讀」「本身就是一種覺察」
- 複述她已寫的結論當新看見
- 把假說寫成既定事實
- 只根據感謝清單寫洞察，卻忽略事件與身心

statement 可以是觀察 + 更深一層可能詮釋；允許探索性問句語氣，但不要做成訪談清單。
每個 candidate：statement, evidence[], newInformation, whyItMatters, alternative, confidence, type
type 可用：CONTRAST / COMMON_THREAD / ENERGY_SOURCE / DRAIN_SOURCE / UNNOTICED_NEED / CHANGE / UNRECOGNIZED_STRENGTH / BETTER_NEXT_RESPONSE

只輸出 JSON：
{"candidates":[{"id":"s1","type":"CONTRAST","statement":"","evidence":[""],"newInformation":"","whyItMatters":"","alternative":"","confidence":"low|medium|high"}]}`;

const SEE_CHALLENGE_SYSTEM = `你是信任邊界檢查，不是刪減洞察的守門員。

只做兩件事：
1. 若捏造了原文沒有的具體事實／人物／歷史 → DROP 或 REVISE 刪掉捏造。
2. 若把假說寫成定論（真正的問題就是／這證明／妳一定是）→ REVISE 成探索語氣。

不要因為「比較深」「提到需要／害怕／自我形象」「不是最安全」就 DROP。
不要追求 0 個通過。
有用的探索假說 → KEEP。
只刪真正有害的：捏造事實、或未校準的定論。

只輸出 JSON：
{"items":[{"id":"s1","verdict":"KEEP|REVISE|DROP","parrotLikely":false,"reason":"","failed":[],"addonFailed":[],"core":{"statement":"","whyItMatters":""}}]}`;

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
  const integrated = answerEngine.integratedReflectionSeed(raw);
  const independent = collectIndependentMoments(raw);
  if (integrated && (list.length || independent.positive.length < 2)) {
    const hasContrast = list.some((row) => {
      const text = `${asText(row && row.statement)} ${asText(row && row.whyItMatters)}`;
      return asText(row && row.type).toUpperCase() === integrated.type && /感謝|謝謝|感恩/.test(text) && /身體|感覺/.test(text);
    });
    if (!hasContrast) list.push(integrated);
  }
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
  return /普通的一天|本身也是一種狀態|沒什麼特別|沒有特別強烈的感受|每一天都值得被看見|沒有一定要再解讀|不需要再提煉|無合格\s*core|已經完整|沒有被遺漏的角度|不需要再解讀/.test(
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

function looksUncalibratedCertainty(text) {
  const blob = asText(text);
  if (!blob) return false;
  if (/可能|也許|有沒有|不一定|值得|好奇|好像|或許|一個角度|我不確定|可以再看/.test(blob)) return false;
  return /真正的問題就是|這證明[妳你]|[妳你]一定是|[妳你]其實一直都|真正原因是|真實來源|這就證明/.test(blob);
}

function normalizeCandidate(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const typeRaw = asText(src.type).toUpperCase().replace(/[\s-]/g, "_");
  const type = SEE_TYPES.includes(typeRaw) ? typeRaw : "CONTRAST";
  const statement = stripEngineLeak(asText(src.statement || src.idea || src.insight));
  return {
    id: asText(src.id) || `s${index + 1}`,
    type,
    statement,
    evidence: (Array.isArray(src.evidence) ? src.evidence : []).map(asText).filter(Boolean).slice(0, 6),
    newInformation: stripEngineLeak(asText(src.newInformation || src.newInfo)),
    whyItMatters: stripEngineLeak(asText(src.whyItMatters || src.why || src.soWhat || src.support)),
    alternative: asText(src.alternative),
    confidence: /^(high|medium|low)$/.test(asText(src.confidence)) ? asText(src.confidence) : "low",
    fallbackLens: Boolean(src.fallbackLens),
  };
}

function seeChallenge(candidate, known, raw) {
  const failed = [];
  const item = normalizeCandidate(candidate, 0);
  if (!item.statement) failed.push("shape");
  // Trust boundary only: no exact parrot, no invented-fact overreach, no uncalibrated certainty-as-fact.
  if (discovery.looksExactKnown(item.statement, known, raw)) failed.push("known");
  if (seeParrotsExplicitConclusion(item.statement, known, raw)) failed.push("parrot");
  if (seeLooksOverreach(item.statement, item.whyItMatters) || bodyMind.looksOverPsych(`${item.statement}${item.whyItMatters}`)) {
    failed.push("overreach");
  }
  if (looksUncalibratedCertainty(`${item.statement} ${item.whyItMatters}`)) failed.push("certainty");
  if (thinkingCore.looksLabelOnly(item.statement, item.whyItMatters)) failed.push("label-only");
  if (seeLooksForcedThread(item) || seeLooksEngineLeak(`${item.statement} ${item.whyItMatters}`) || seeLooksNoValue(item.statement)) failed.push("generic");
  if (seeLooksActionChecklist(`${item.statement} ${item.whyItMatters}`)) failed.push("checklist");
  if (!item.evidence.length) {
    const blob = rawBlob(raw);
    if (blob) item.evidence = [asText(blob).slice(0, 40)];
  }
  if (!item.newInformation) item.newInformation = "一個她還沒明說、但值得再看的角度";
  if (!item.whyItMatters) item.whyItMatters = "值得用假設再感受一下，不必先當成定論。";
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
      const coreStatement = asText(row.core && row.core.statement);
      const coreWhy = asText(row.core && (row.core.whyItMatters || row.core.why));
      if (!coreStatement || seeLooksNoValue(coreStatement) || seeLooksEngineLeak(coreStatement) || looksUncalibratedCertainty(`${coreStatement} ${coreWhy}`)) {
        if (deterministicOk || (item.statement && !seeParrotsExplicitConclusion(item.statement, known, raw) && !seeLooksOverreach(item.statement, item.whyItMatters))) {
          kept.push(item);
        }
        return;
      }
      const seed = { ...item, statement: coreStatement, whyItMatters: coreWhy || item.whyItMatters };
      const judged = seeChallenge(seed, known, raw);
      if (judged.ok) {
        kept.push(judged.item);
        return;
      }
      if (deterministicOk) kept.push(item);
      return;
    }

    // Model DROP: never erase a soft-trust-passing exploratory hypothesis.
    const modelParrotConfirmed = row.parrotLikely === true && seeParrotsExplicitConclusion(item.statement, known, raw);
    if (modelParrotConfirmed) return;
    if (deterministicOk) {
      kept.push(item);
      return;
    }
    if (seeIsGroundedConnection(item, known, raw) || thinkingCore.hasCalibratedHypothesis(`${item.statement} ${item.whyItMatters}`)) {
      const revised = seeLooksOverreach(item.statement, item.whyItMatters) ? seeSalvageCore(item, known, raw) : item;
      if (revised && seeChallenge(revised, known, raw).ok && !seeParrotsExplicitConclusion(revised.statement, known, raw)) {
        kept.push(revised);
      }
    }
    // Even on DROP: keep exploratory hypothesis if it only fails soft/old gates.
    if (!kept.some((row) => row.id === item.id) && item.statement && !seeParrotsExplicitConclusion(item.statement, known, raw) && !seeLooksOverreach(item.statement, item.whyItMatters) && !looksUncalibratedCertainty(`${item.statement} ${item.whyItMatters}`)) {
      kept.push(item);
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
  const integrate =
    answerEngine.hasThanksEventBody(raw)
      ? `
【三類必須整合】
今天同時有感謝、事件、身心感受。至少一個 candidate 要把這三類放在一起看。
不可只讀感謝；不可略過事件與身體不舒服。`
      : "";
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
${hint}${integrate}

FACT_CO_OCCURRENCE != KNOWN_CONNECTION。兩件事實同時出現，不表示她已經建立關係。
不要使用 03 AI insight／support。
有實質內容時，必須提出至少 1 個（目標 3～5）可探索的 candidate。
不要輸出空 candidates 來表示「已經很清楚」。
只有極度空白、無法負責任探索的輸入，才輸出 {"candidates":[]}`;
}

function challengeUserPrompt(raw, known, candidates) {
  return `${reasonUserPrompt(raw, known)}

【CANDIDATES】
${JSON.stringify(candidates)}`;
}

function writerUserPrompt(raw, known, selected) {
  return `只把下面這個已通過的 SEE Core 寫成 03 覺察段落素材。必須語意等價。不要加新意思。不要問問題。不要做成 06 行動清單。
語氣溫柔、具體、穩定。先承接原文，再整理發現。不要硬湊沒有根據的三者關聯。
感恩清單只能來自今天感謝原文；沒有就 gratitude=[]。

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

function composeWrittenSee(raw, selected, writerOut, date) {
  const out = writerOut && typeof writerOut === "object" ? writerOut : {};
  if (asText(out.insight) && asText(out.support) && answerEngine.looksSeeFormat(`${out.insight}\n${out.support}`)) {
    return {
      insight: answerEngine.preserveMultiline(out.insight).replace(/\n/g, " ").replace(/\s+/g, " ").trim(),
      support: answerEngine.preserveMultiline(out.support),
    };
  }
  return answerEngine.composeSeeDocument({
    raw,
    core: selected,
    date,
    theme: out.theme,
    sectionTitle: out.sectionTitle || out.title,
    reception: out.reception,
    findings: out.findings,
    extension: out.extension,
    conclusion: out.conclusion || out.insight,
    quotes: out.quotes,
    gratitude: out.gratitude,
  });
}

function silenceResult(known, extra) {
  const sparse = extra && extra.raw && valueLenses.isExtremelySparseInput(extra.raw);
  const copy = sparse ? bodyMind.SEE_SPARSE_COPY : bodyMind.SEE_SPARSE_COPY;
  return {
    status: "silence",
    insight: copy.insight,
    support: copy.support,
    seeType: "",
    evidence: [],
    confidence: "",
    knownByUser: known,
    empty: true,
    thinkingCore: thinkingCore.EMPTY_CORE,
    ...(extra || {}),
  };
}

function tryFallbackLadder(raw, known, meta) {
  const ladder = valueLenses.buildFallbackCandidates(raw);
  meta.fallbackLadder = ladder.map((row) => row.id);
  for (const candidate of ladder) {
    const judged = seeChallenge(candidate, known, raw);
    meta.challenged.push({ id: judged.item.id, failed: judged.failed, stage: "fallback-ladder" });
    if (!judged.ok) {
      meta.dropped.push({ id: judged.item.id, failed: judged.failed, stage: "fallback-ladder" });
      continue;
    }
    if (seeParrotsExplicitConclusion(judged.item.statement, known, raw)) {
      meta.dropped.push({ id: judged.item.id, failed: ["parrot"], stage: "fallback-ladder" });
      continue;
    }
    meta.usedFallbackLadder = true;
    meta.fallbackLens = judged.item.id;
    return judged.item;
  }
  return null;
}

function writerAsCore(selected, written) {
  return {
    statement: asText(written && written.insight) || asText(written && written.statement),
    why: asText(written && written.support) || asText(written && written.why),
  };
}

function finalOutputFails(written, selected, known, raw) {
  const formatted = answerEngine.looksSeeFormat(`${written.insight || ""}\n${written.support || ""}`);
  const statement = asText(written.insight || written.statement);
  const support = formatted
    ? asText(selected && selected.whyItMatters)
    : asText(written.support || written.why);
  const checkStatement = formatted
    ? asText(selected && selected.statement) || statement.replace(/^主題[：:]\s*/, "")
    : statement;
  if (!statement) return true;
  if (!formatted && discovery.looksExactKnown(statement, known, raw)) return true;
  if (!formatted && seeParrotsExplicitConclusion(statement, known, raw)) return true;
  if (seeLooksNoValue(checkStatement) || seeLooksEngineLeak(`${checkStatement} ${support}`)) return true;
  if (seeLooksOverreach(checkStatement, support) || bodyMind.looksOverPsych(`${checkStatement}${support}`)) return true;
  if (looksUncalibratedCertainty(`${checkStatement} ${support}`)) return true;
  if (!formatted && seeLooksActionChecklist(asText(written.support || ""))) return true;
  if (!formatted && discovery.writerIntroducesMeaning(selected, writerAsCore(selected, { insight: statement, support: asText(written.support) }))) return true;
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
    meta.reasonError = true;
    reasonData = { candidates: [] };
  }

  const incoming = maybeSeedPositiveThread(
    Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates : [],
    raw
  );
  meta.reasonCount = Array.isArray(reasonData && reasonData.candidates) ? reasonData.candidates.length : 0;
  meta.seeded = incoming.some((row) => asText(row && row.id).indexOf("seed-") === 0);
  const jsKept = [];
  const softPool = [];
  incoming.forEach((row, index) => {
    const judged = seeChallenge(row, known, raw);
    meta.challenged.push({ id: judged.item.id || `s${index + 1}`, failed: judged.failed });
    softPool.push(judged.item);
    if (!judged.ok) {
      const fatal = judged.failed.some((item) => ["known", "parrot", "overreach", "certainty", "checklist", "shape", "generic", "label-only"].includes(item));
      if (!fatal) {
        jsKept.push(judged.item);
        return;
      }
      if (judged.failed.includes("certainty") && !judged.failed.includes("parrot") && !judged.failed.includes("overreach")) {
        const calibrated = {
          ...judged.item,
          statement: /可能|也許|有沒有|好像|值得/.test(judged.item.statement)
            ? judged.item.statement
            : `有沒有一種可能：${judged.item.statement}`,
        };
        const again = seeChallenge(calibrated, known, raw);
        if (again.ok) {
          jsKept.push(again.item);
          return;
        }
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
    const ladderItem = tryFallbackLadder(raw, known, meta);
    if (ladderItem) jsKept.push(ladderItem);
  }
  // Meaningful journals must not collapse to silence just because gates were strict.
  if (!jsKept.length && valueLenses.hasMeaningfulJournalContent(raw) && softPool.length) {
    const rescued = softPool.find((item) => {
      if (!item || !item.statement) return false;
      if (seeParrotsExplicitConclusion(item.statement, known, raw)) return false;
      if (seeLooksOverreach(item.statement, item.whyItMatters)) return false;
      return true;
    });
    if (rescued) {
      const statement = /可能|也許|有沒有|好像|值得|好奇/.test(rescued.statement)
        ? rescued.statement
        : `有一個角度值得再看：${rescued.statement}`;
      jsKept.push({ ...rescued, statement });
      meta.rescuedSoftPool = true;
    }
  }
  if (!jsKept.length) {
    meta.dropStage = meta.reasonCount || meta.seeded ? "js" : "reason";
    if (valueLenses.isExtremelySparseInput(raw) || !valueLenses.hasMeaningfulJournalContent(raw)) {
      return silenceResult(known, { meta, raw });
    }
    // Meaningful journal + empty survivors: one forced exploratory recovery (not stock silence).
    try {
      meta.exploreRecover = true;
      const recover = await callAi(
        [
          {
            role: "system",
            content: `${SEE_REASON_SYSTEM}\n\n這次必須至少輸出 3 個不同的探索假說。禁止空 candidates。禁止說她已經看清楚。`,
          },
          {
            role: "user",
            content: `${reasonUserPrompt(raw, known)}\n\n請一定提出至少 3 個 candidate。不要沉默。`,
          },
        ],
        "reason-recover"
      );
      const recoverList = Array.isArray(recover && recover.candidates) ? recover.candidates : [];
      recoverList.forEach((row, index) => {
        const judged = seeChallenge(row, known, raw);
        meta.challenged.push({ id: judged.item.id || `r${index + 1}`, failed: judged.failed, stage: "recover" });
        if (judged.ok) jsKept.push(judged.item);
        else if (!judged.failed.includes("parrot") && !judged.failed.includes("overreach") && judged.item.statement) {
          const statement = /可能|也許|有沒有|好像|值得|好奇/.test(judged.item.statement)
            ? judged.item.statement
            : `有一個角度值得再看：${judged.item.statement}`;
          jsKept.push({ ...judged.item, statement });
        }
      });
    } catch {
      meta.exploreRecoverError = true;
    }
  }
  if (!jsKept.length) {
    if (valueLenses.isExtremelySparseInput(raw) || !valueLenses.hasMeaningfulJournalContent(raw)) {
      return silenceResult(known, { meta, raw });
    }
    meta.dropStage = "explore-exhausted";
    // Absolute last resort: still never ship「已經看得很清楚」stock for meaningful journals.
    return {
      status: "observation",
      insight: "這裡好像還有一個值得再感受的地方：這件事為什麼會留在妳心裡。",
      support: "不一定要先下結論。可以先問自己：真正刺到、或真正碰到妳的，比較像哪一層？",
      seeType: "CONTRAST",
      evidence: [asText(raw.event || raw.bodyMindText || raw.thanksText).slice(0, 48)].filter(Boolean),
      confidence: "low",
      knownByUser: known,
      empty: false,
      thinkingCore: thinkingCore.coreFromSee("這裡好像還有一個值得再感受的地方：這件事為什麼會留在妳心裡。"),
      meta,
    };
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
    const ladderItem = tryFallbackLadder(raw, known, meta);
    if (ladderItem) {
      semanticKept.push(ladderItem);
    }
  }
  const selectedAfterLadder = seeSelectOne(semanticKept);
  if (!selectedAfterLadder) {
    meta.dropStage = skipChallenge ? "js" : "challenge";
    if (valueLenses.isExtremelySparseInput(raw) || !valueLenses.hasMeaningfulJournalContent(raw)) {
      return silenceResult(known, { meta, raw });
    }
    if (jsKept.length) {
      semanticKept = jsKept.slice();
    } else {
      return silenceResult(known, { meta, raw });
    }
  }
  let selectedFinal = seeSelectOne(semanticKept);
  if (!selectedFinal) {
    return silenceResult(known, { meta, raw });
  }

  let written = composeWrittenSee(raw, selectedFinal, null, asText(opts.date || ctx.date || ""));
  const canSkipWriter = skipWriter || (skipWriterIfReadable && coreIsUserReadable(selectedFinal));
  if (!canSkipWriter) {
    try {
      const out = await callAi(
        [
          { role: "system", content: SEE_WRITER_SYSTEM },
          { role: "user", content: writerUserPrompt(raw, known, selectedFinal) },
        ],
        "write"
      );
      meta.usedWriter = true;
      if (out && (asText(out.theme || out.insight || out.statement || out.conclusion))) {
        const next = composeWrittenSee(raw, selectedFinal, out, asText(opts.date || ctx.date || ""));
        const coreCheck = { insight: asText(out.conclusion || out.insight || selectedFinal.statement), support: asText(out.extension || out.reception || selectedFinal.whyItMatters) };
        if (discovery.writerIntroducesMeaning(selectedFinal, writerAsCore(selectedFinal, coreCheck)) || seeLooksOverreach(coreCheck.insight, coreCheck.support)) {
          meta.writerRejected = true;
        } else {
          written = next;
        }
      }
    } catch {
      /* keep composed core; do not retry */
    }
  }

  if (finalOutputFails(written, selectedFinal, known, raw)) {
    written = composeWrittenSee(raw, selectedFinal, null, asText(opts.date || ctx.date || ""));
    meta.writerRejected = true;
    if (finalOutputFails(written, selectedFinal, known, raw)) {
      const ladderItem = tryFallbackLadder(raw, known, meta);
      if (ladderItem && ladderItem.id !== selectedFinal.id) {
        selectedFinal = ladderItem;
        written = composeWrittenSee(raw, selectedFinal, null, asText(opts.date || ctx.date || ""));
      } else {
        meta.dropStage = "writer";
        return silenceResult(known, { meta, raw });
      }
    }
  }

  const projected = projectSeeOutput({
    status: "observation",
    insight: written.insight,
    support: written.support,
    seeType: selectedFinal.type,
    evidence: selectedFinal.evidence,
    confidence: selectedFinal.confidence,
    thinkingCore: thinkingCore.normalizeThinkingCore({
      facts: selectedFinal.evidence,
      interpretation: asText(selectedFinal.statement),
      alternative: selectedFinal.alternative,
      whyWorthKnowing: asText(selectedFinal.whyItMatters),
      status: "hypothesis",
      source: "see",
    }),
  });
  if (projected.status === "silence") {
    meta.dropStage = "writer";
    return silenceResult(known, { meta, raw });
  }
  if (!answerEngine.looksSeeFormat(`${projected.insight}\n${projected.support}`)) {
    projected.support = clipSeeText(projected.support, 160, 5);
    projected.insight = clipSeeText(projected.insight, 120, 3);
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
  tryFallbackLadder,
  composeWrittenSee,
  buildFallbackCandidates: valueLenses.buildFallbackCandidates,
  seeLooksNeedInference,
  looksLabelOnly: thinkingCore.looksLabelOnly,
};
