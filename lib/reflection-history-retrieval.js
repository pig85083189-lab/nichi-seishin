const crypto = require("crypto");
const reviewMerge = require("./review-merge");

const HISTORY_RETRIEVAL_VARIANT = "reflection-history-retrieval-v1";
const CANDIDATE_WINDOW = 90;
const STAGE1_TOP_MIN = 8;
const STAGE1_TOP_MAX = 12;
const STAGE1_TOP = 10;
const MIN_STAGE1_SCORE = 1.35;
const MIN_SELECTED_SCORE = 3;
const MAX_SELECTED = 3;
const CONNECTION_TYPES = [
  "same-person",
  "same-situation",
  "same-tension",
  "same-value",
  "same-boundary",
  "same-choice",
  "prior-success",
  "other-relevant",
];

const STOPWORDS = new Set([
  "今天",
  "昨天",
  "明天",
  "覺得",
  "事情",
  "自己",
  "真的",
  "有點",
  "因為",
  "所以",
  "可以",
  "沒有",
  "想要",
  "其實",
  "但是",
  "不是",
  "而是",
  "發現",
  "一個",
  "一種",
  "這個",
  "那個",
  "什麼",
  "還是",
  "只是",
  "已經",
  "比較",
  "開始",
  "一直",
  "可能",
  "好像",
  "也許",
  "或許",
  "值得",
  "繼續",
  "觀察",
  "然後",
  "如果",
  "還有",
  "就是",
  "這樣",
  "那樣",
  "時候",
  "現在",
  "之後",
  "之前",
  "一下",
  "一些",
  "很多",
  "非常",
  "有些",
  "不會",
  "不能",
  "不要",
  "知道",
  "感覺",
  "有點",
  "還好",
  "還是",
  "一下",
  "而已",
  "的話",
  "什麼",
  "怎麼",
  "為什麼",
  "怎樣",
]);

const PERSON_TERMS = [
  "伴侶",
  "男友",
  "女友",
  "老公",
  "老婆",
  "丈夫",
  "妻子",
  "家人",
  "媽媽",
  "爸爸",
  "母親",
  "父親",
  "父母",
  "爸媽",
  "小孩",
  "孩子",
  "同事",
  "主管",
  "老闆",
  "客戶",
  "朋友",
  "室友",
  "工作夥伴",
  "夥伴",
];

const TENSION_TERMS = [
  "理解",
  "被理解",
  "聽懂",
  "聽進去",
  "表達",
  "溝通",
  "說了也沒用",
  "講很多次",
  "說很多次",
  "沒被聽見",
  "沒被理解",
  "界線",
  "選擇",
  "選擇權",
  "決定",
];

const POSITIVE_TERMS = ["幸福", "安心", "自在", "被支持", "沒有壓力", "舒服", "輕鬆", "成就感", "被看見"];

const PATTERN_CLAIM = /你總是|你一直|你反覆|這是你的模式|這證明你一直|你的人生模式/;

const HISTORY_RERANK_SYSTEM = `你是「進行式 ING」的歷史相關性判斷者。

工作不是心理分析，也不是找模式。
只判斷：這筆過往紀錄，對理解今天這次思考，有沒有實際資訊價值。

【證據層級】
USER_RAW：使用者親自寫的原文。權重最高。
USER_CONFIRMED：使用者親自確認的內容。次高。
AI_HYPOTHESIS：過去或今天的 AI 解釋。只能當線索，不能當已確認事實。

【今天優先】
如果今天的 USER_RAW 明確否定某個過往 AI_HYPOTHESIS，今天優先。
不要用過去 AI 解釋來反駁今天原文。

【不要只找問題】
幸福、安心、自在、被支持也可以相關。
不要做成 problem detector。

【禁止】
不要寫「你總是／你一直／你反覆／這是你的模式」。
不要做診斷或人格標籤。
不要因為同一人物、同一常見詞就給高分。
表面文字像、意義不同：低分。
只有過去 AI 假設相似、使用者原文不支持：低分。

【分數】
0 unrelated
1 weak
2 possibly useful
3 clearly relevant
4 strongly relevant

只把真正有資訊價值的日子打 3 或 4。
不確定就給 2 或以下。
寧可 0 筆，不要硬湊。

【connectionType 只能是】
same-person
same-situation
same-tension
same-value
same-boundary
same-choice
prior-success
other-relevant

prior-success：過去有選過／寫過處理方式時可以標，但不要宣稱「這方法曾經有效」，除非有完成證據。

reason 只能說：這筆紀錄可能和今天有關，因為……
一句話，不要引用整篇日記。

只輸出 JSON：
{"items":[{"date":"YYYY-MM-DD","relevanceScore":0,"connectionType":"same-tension","reason":"..."}]}`;

function asText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return asText(value.text || value.title || value.answer || value.line || value.conclusion || value.plain || "");
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function compactText(value, max) {
  const text = asText(value);
  if (!text) return "";
  const limit = Number.isFinite(max) && max > 0 ? max : 180;
  return text.length > limit ? text.slice(0, limit) : text;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function journalOf(review) {
  return review && review.journal && typeof review.journal === "object" ? review.journal : {};
}

function guideOf(journal) {
  const insight = journal && journal.insight && typeof journal.insight === "object" ? journal.insight : {};
  const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
  return { insight, guide };
}

function thanksTextOf(journal, review) {
  const fromJournal = asText(journal && (journal.thanksText || journal.thanks));
  if (fromJournal) return fromJournal;
  return asText(review && review.gratitude);
}

function legacyUserAnswers(journal, review) {
  const out = [];
  const { guide } = guideOf(journal);
  const rounds = Array.isArray(guide.rounds) ? guide.rounds : [];
  rounds.forEach((round) => {
    const answer = asText(round && (round.answer || round.reply));
    if (answer) out.push(answer);
  });
  const thinkHistory = Array.isArray(review && review.thinkHistory) ? review.thinkHistory : [];
  thinkHistory.forEach((round) => {
    const answer = asText(round && (round.answer || round.userAnswer || round.reply));
    if (answer) out.push(answer);
  });
  const rawText = asText(review && review.rawText);
  if (rawText) out.push(rawText);
  return out;
}

function extensionAnswersOf(guide) {
  const ext =
    reviewMerge && typeof reviewMerge.normalizeReflectionExtension === "function"
      ? reviewMerge.normalizeReflectionExtension(guide && guide.extension)
      : { rounds: [] };
  return (ext.rounds || [])
    .map((round) => ({
      answer: asText(round.answer),
      selectedQuestion: asText(round.selectedQuestionText),
      deepConclusion: asText(round.deepConclusion),
      completed: Boolean(round.completedAt),
    }))
    .filter((item) => item.answer || item.selectedQuestion || item.deepConclusion);
}

function selectedAwareness(journal) {
  if (reviewMerge && typeof reviewMerge.selectedAwarenessV3Texts === "function") {
    return reviewMerge.selectedAwarenessV3Texts(journal && journal.awarenessV3).map(asText).filter(Boolean);
  }
  return [];
}

function unselectedAwareness(journal) {
  const bag =
    reviewMerge && typeof reviewMerge.normalizeAwarenessV3Bag === "function"
      ? reviewMerge.normalizeAwarenessV3Bag(journal && journal.awarenessV3)
      : { items: [], selectedIds: [] };
  const selected = new Set(bag.selectedIds || []);
  return (bag.items || [])
    .filter((item) => item && item.text && !selected.has(item.id))
    .map((item) => asText(item.text))
    .filter(Boolean);
}

function selectedActions(journal) {
  const out = [];
  if (reviewMerge && typeof reviewMerge.selectedExecutionChoiceActions === "function") {
    reviewMerge.selectedExecutionChoiceActions(journal && journal.executionChoices).forEach((item) => {
      if (item && item.text) out.push(asText(item.text));
    });
  }
  if (reviewMerge && typeof reviewMerge.selectedChoiceTexts === "function") {
    reviewMerge.selectedChoiceTexts(journal && journal.thinkChoices).forEach((text) => {
      const next = asText(text);
      if (next && !out.includes(next)) out.push(next);
    });
    reviewMerge.selectedChoiceTexts(journal && journal.awarenessChoices).forEach((text) => {
      const next = asText(text);
      if (next && !out.includes(next)) out.push(next);
    });
  }
  return out;
}

function actionHasCompletion(journal) {
  const bag =
    reviewMerge && typeof reviewMerge.normalizeExecutionChoiceBag === "function"
      ? reviewMerge.normalizeExecutionChoiceBag(journal && journal.executionChoices)
      : {};
  const deep = bag.deep && typeof bag.deep === "object" ? bag.deep : {};
  if (Array.isArray(deep.finalSelectedIds) && deep.finalSelectedIds.length) return true;
  if (Array.isArray(journal && journal.executionChecks) && journal.executionChecks.some(asText)) return true;
  return false;
}

function compactCandidate(review, date) {
  const journal = journalOf(review);
  const { insight, guide } = guideOf(journal);
  const body =
    reviewMerge && typeof reviewMerge.normalizeBodyMind === "function"
      ? reviewMerge.normalizeBodyMind(journal.bodyMind)
      : { text: asText(journal.bodyMind && journal.bodyMind.text), insight: "", support: "" };
  const v3 =
    guide.variant === "reflection-v3" || guide.coreQuote
      ? { coreQuote: asText(guide.coreQuote), questions: Array.isArray(guide.questions) ? guide.questions.map((item) => asText(item && item.text)).filter(Boolean) : [] }
      : { coreQuote: asText(guide.coreQuote || guide.quote), questions: [] };
  const extensions = extensionAnswersOf(guide);
  const organize = review && review.organize && typeof review.organize === "object" ? review.organize : {};
  const userRaw = {
    thanks: compactText(thanksTextOf(journal, review), 160),
    event: compactText(journal.event, 220),
    mood: compactText(journal.mood || journal.moodLabel, 40),
    bodyMindText: compactText(body.text, 220),
    extensionAnswers: extensions.map((item) => compactText(item.answer, 180)).filter(Boolean),
    legacyAnswers: legacyUserAnswers(journal, review).map((item) => compactText(item, 160)).filter(Boolean),
  };
  const confirmed = {
    awareness: selectedAwareness(journal).map((item) => compactText(item, 140)),
    selectedActions: selectedActions(journal).map((item) => compactText(item, 140)),
    selectedExtensionQuestions: extensions.map((item) => compactText(item.selectedQuestion, 140)).filter(Boolean),
  };
  const aiClues = {
    insight: compactText(body.insight || insight.psychology || insight.analysis || insight.conclusion, 140),
    support: compactText(body.support, 140),
    coreQuote: compactText(v3.coreQuote || guide.awareness || organize.quote || organize.summary, 140),
    questions: (v3.questions || []).slice(0, 3).map((item) => compactText(item, 80)),
    deepConclusion: extensions.map((item) => compactText(item.deepConclusion, 140)).filter(Boolean),
    unselectedAwareness: unselectedAwareness(journal).map((item) => compactText(item, 120)),
    organize: compactText(organize.summary || organize.insight || organize.psychology, 140),
  };
  return {
    date,
    userRaw,
    confirmed,
    aiClues,
    actionCompleted: actionHasCompletion(journal),
    finalized: Boolean(reviewMerge.reviewIsFinalized(review)),
  };
}

function layerBlob(layer) {
  if (!layer || typeof layer !== "object") return "";
  return Object.values(layer)
    .map((value) => (Array.isArray(value) ? value.join("\n") : asText(value)))
    .filter(Boolean)
    .join("\n");
}

function candidateHasContent(candidate) {
  if (!candidate) return false;
  return Boolean(layerBlob(candidate.userRaw) || layerBlob(candidate.confirmed) || layerBlob(candidate.aiClues));
}

function hashSig(parts) {
  return crypto.createHash("sha1").update(parts.filter(Boolean).join("\n")).digest("hex").slice(0, 20);
}

function candidateSignature(candidate) {
  return hashSig([
    candidate.date,
    layerBlob(candidate.userRaw),
    layerBlob(candidate.confirmed),
    layerBlob(candidate.aiClues),
  ]);
}

function tokenize(text) {
  const raw = asText(text).toLowerCase();
  if (!raw) return [];
  const tokens = [];
  const seen = new Set();
  const push = (token) => {
    const next = String(token || "").replace(/\s+/g, "").trim();
    if (!next || next.length < 2 || STOPWORDS.has(next) || seen.has(next)) return;
    if (/^[的了著過在是也又還很更]$/.test(next)) return;
    seen.add(next);
    tokens.push(next);
  };
  PERSON_TERMS.concat(TENSION_TERMS, POSITIVE_TERMS).forEach((term) => {
    if (raw.includes(term.toLowerCase())) push(term);
  });
  raw
    .split(/[^\u4e00-\u9fffA-Za-z0-9]+/)
    .forEach((chunk) => {
      if (!chunk) return;
      if (/^[A-Za-z0-9]+$/.test(chunk)) {
        if (chunk.length >= 3) push(chunk);
        return;
      }
      const compact = chunk.replace(/\s+/g, "");
      if (compact.length <= 4) {
        push(compact);
        return;
      }
      for (let size = 2; size <= 3; size += 1) {
        for (let i = 0; i <= compact.length - size; i += 1) push(compact.slice(i, i + size));
      }
    });
  return tokens;
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

function overlapCount(left, right) {
  let count = 0;
  left.forEach((token) => {
    if (right.has(token)) count += 1;
  });
  return count;
}

function sharedTerms(leftText, rightText) {
  const a = tokenSet(leftText);
  const b = tokenSet(rightText);
  const shared = [];
  a.forEach((token) => {
    if (b.has(token)) shared.push(token);
  });
  return shared;
}

function containsAny(text, terms) {
  const raw = asText(text);
  return terms.filter((term) => raw.includes(term));
}

function queryFromJournal(journal, options = {}) {
  const src = journal && typeof journal === "object" ? journal : {};
  const reviewLike = options.review && typeof options.review === "object" ? options.review : { journal: src };
  const base = compactCandidate(reviewLike, options.date || "");
  const ext = options.currentExtension && typeof options.currentExtension === "object" ? options.currentExtension : null;
  const selectedQuestion = asText(ext && (ext.selectedQuestionText || ext.selectedQuestion));
  const userAnswer = asText(ext && (ext.userAnswer || ext.answer));
  if (selectedQuestion) base.confirmed.selectedExtensionQuestions = [compactText(selectedQuestion, 140), ...base.confirmed.selectedExtensionQuestions];
  if (userAnswer) base.userRaw.extensionAnswers = [compactText(userAnswer, 180), ...base.userRaw.extensionAnswers];
  base.extension = {
    selectedQuestion: compactText(selectedQuestion, 140),
    userAnswer: compactText(userAnswer, 180),
    coreThread: compactText(ext && ext.coreThread, 80),
  };
  return base;
}

function querySignals(query) {
  const userRaw = [
    query.userRaw.thanks,
    query.userRaw.event,
    query.userRaw.bodyMindText,
    ...(query.userRaw.extensionAnswers || []),
    ...(query.userRaw.legacyAnswers || []),
    query.extension && query.extension.userAnswer,
  ]
    .filter(Boolean)
    .join("\n");
  const confirmed = [
    query.userRaw.mood,
    ...(query.confirmed.awareness || []),
    ...(query.confirmed.selectedActions || []),
    ...(query.confirmed.selectedExtensionQuestions || []),
    query.extension && query.extension.selectedQuestion,
  ]
    .filter(Boolean)
    .join("\n");
  const aiClues = [
    query.aiClues.insight,
    query.aiClues.support,
    query.aiClues.coreQuote,
    ...(query.aiClues.questions || []),
    ...(query.aiClues.deepConclusion || []),
    query.extension && query.extension.coreThread,
  ]
    .filter(Boolean)
    .join("\n");
  return { userRaw, confirmed, aiClues, all: [userRaw, confirmed, aiClues].filter(Boolean).join("\n") };
}

function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00`);
  const b = Date.parse(`${toIso}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function recencyBonus(candidateDate, currentDate) {
  const days = daysBetween(candidateDate, currentDate);
  if (days <= 7) return 0.35;
  if (days <= 30) return 0.22;
  if (days <= 90) return 0.1;
  return 0;
}

function scoreStage1(query, candidate, currentDate) {
  const q = querySignals(query);
  const cUser = layerBlob(candidate.userRaw);
  const cConfirmed = layerBlob(candidate.confirmed);
  const cAi = layerBlob(candidate.aiClues);
  const qUserTokens = tokenSet(q.userRaw);
  const qConfirmedTokens = tokenSet(q.confirmed);
  const qAiTokens = tokenSet(q.aiClues);
  const cUserTokens = tokenSet(cUser);
  const cConfirmedTokens = tokenSet(cConfirmed);
  const cAiTokens = tokenSet(cAi);
  const userOverlap = overlapCount(qUserTokens, cUserTokens);
  const confirmedOverlap = overlapCount(qUserTokens, cConfirmedTokens) + overlapCount(qConfirmedTokens, cConfirmedTokens);
  const aiOverlap = overlapCount(qUserTokens, cAiTokens) + overlapCount(qAiTokens, cAiTokens) + overlapCount(qAiTokens, cUserTokens);
  const personHits = containsAny(q.all, PERSON_TERMS).filter((term) => asText(cUser).includes(term) || asText(cConfirmed).includes(term));
  const tensionHits = containsAny(q.userRaw, TENSION_TERMS).filter((term) => cUser.includes(term) || cConfirmed.includes(term));
  const positiveHits = containsAny(q.userRaw, POSITIVE_TERMS).filter((term) => cUser.includes(term) || cConfirmed.includes(term));
  const reasons = [];
  let score = 0;
  if (userOverlap) {
    score += Math.min(4.2, userOverlap * 0.55);
    reasons.push(`user-raw-overlap:${userOverlap}`);
  }
  if (confirmedOverlap) {
    score += Math.min(2.8, confirmedOverlap * 0.7);
    reasons.push(`confirmed-overlap:${confirmedOverlap}`);
  }
  if (aiOverlap) {
    score += Math.min(0.9, aiOverlap * 0.12);
    reasons.push(`ai-clue:${aiOverlap}`);
  }
  if (personHits.length && (tensionHits.length || positiveHits.length || userOverlap >= 4)) {
    score += 1.1;
    reasons.push(`person+context:${personHits.slice(0, 2).join(",")}`);
  } else if (personHits.length) {
    score += 0.25;
    reasons.push(`person-only:${personHits.slice(0, 2).join(",")}`);
  }
  if (tensionHits.length) {
    score += 1.3;
    reasons.push(`tension:${tensionHits.slice(0, 2).join(",")}`);
  }
  if (positiveHits.length) {
    score += 1.1;
    reasons.push(`positive:${positiveHits.slice(0, 2).join(",")}`);
  }
  const recency = recencyBonus(candidate.date, currentDate);
  if (recency) {
    score += recency;
    reasons.push(`recency:+${recency}`);
  }
  return { score: Math.round(score * 100) / 100, reasons };
}

function extractFinalizedCandidates(reviews, currentDate, windowSize) {
  const map = reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {};
  const limit = Math.max(60, Math.min(120, Number(windowSize) || CANDIDATE_WINDOW));
  const today = String(currentDate || "").trim();
  const rows = [];
  Object.entries(map).forEach(([iso, review]) => {
    if (!isIsoDate(iso) || iso === today) return;
    if (!review || typeof review !== "object") return;
    if (!reviewMerge.reviewIsFinalized(review)) return;
    let candidate = null;
    try {
      candidate = compactCandidate(review, iso);
    } catch {
      return;
    }
    if (!candidateHasContent(candidate)) return;
    rows.push(candidate);
  });
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows.slice(0, limit);
}

function stage1Select(query, candidates, currentDate, topN) {
  const limit = Math.max(STAGE1_TOP_MIN, Math.min(STAGE1_TOP_MAX, Number(topN) || STAGE1_TOP));
  const ranked = candidates
    .map((candidate) => {
      const judged = scoreStage1(query, candidate, currentDate);
      return { ...candidate, stage1Score: judged.score, stage1Reasons: judged.reasons };
    })
    .filter((item) => item.stage1Score >= MIN_STAGE1_SCORE)
    .sort((a, b) => b.stage1Score - a.stage1Score || b.date.localeCompare(a.date));
  return ranked.slice(0, limit);
}

function polarity(text) {
  const raw = asText(text);
  const positive = containsAny(raw, POSITIVE_TERMS).length;
  const hard = /沒用|沒被理解|聽不懂|卡住|衝突|難受|委屈|生氣|壓力大/.test(raw);
  if (positive && !hard) return "positive";
  if (hard && !positive) return "hard";
  return "mixed";
}

function looksSemanticTrap(query, candidate) {
  const q = querySignals(query).userRaw;
  const c = layerBlob(candidate.userRaw);
  const shared = sharedTerms(q, c);
  const meaningful = shared.filter((token) => !STOPWORDS.has(token) && token.length >= 2);
  if (meaningful.length >= 3) return false;
  const qHard = /沒被理解|說了也沒用|講很多次|聽不懂/.test(q);
  const cEasy = /理解了一|終於理解|說了很多謝謝|菜單|數學|功課/.test(c);
  return qHard && cEasy;
}

function looksAiOnlyMatch(query, candidate) {
  const q = querySignals(query);
  const userHits = overlapCount(tokenSet(q.userRaw), tokenSet(layerBlob(candidate.userRaw)));
  const confirmedHits = overlapCount(tokenSet(q.userRaw + "\n" + q.confirmed), tokenSet(layerBlob(candidate.confirmed)));
  const aiHits = overlapCount(tokenSet(q.all), tokenSet(layerBlob(candidate.aiClues)));
  return aiHits >= 2 && userHits < 2 && confirmedHits < 1;
}

function looksContradiction(query, candidate) {
  const today = querySignals(query).userRaw;
  const pastAi = layerBlob(candidate.aiClues);
  if (!today || !pastAi) return false;
  if (/不是選擇權|沒有在意選擇|不是因為選擇/.test(today) && /選擇權/.test(pastAi)) return true;
  if (/沒有壓力|很自在|很安心/.test(today) && /你一直很焦慮|你總是很緊/.test(pastAi)) return true;
  return false;
}

function pickConnectionType(query, candidate, score) {
  const q = querySignals(query);
  const cUser = layerBlob(candidate.userRaw) + "\n" + layerBlob(candidate.confirmed);
  const personHits = containsAny(q.all, PERSON_TERMS).filter((term) => cUser.includes(term));
  const tensionHits = containsAny(q.userRaw, TENSION_TERMS).filter((term) => cUser.includes(term));
  const positiveHits = containsAny(q.userRaw, POSITIVE_TERMS).filter((term) => cUser.includes(term));
  const hasAction = (candidate.confirmed.selectedActions || []).length > 0;
  if (hasAction && score >= 3 && (tensionHits.length || personHits.length || positiveHits.length)) return "prior-success";
  if (personHits.length && tensionHits.length) return "same-person";
  if (/溝通|相處|聚餐|開會|旅行/.test(q.userRaw) && /溝通|相處|聚餐|開會|旅行/.test(cUser) && personHits.length) return "same-situation";
  if (tensionHits.length && !personHits.length) return "same-tension";
  if (/界線/.test(q.userRaw) && /界線/.test(cUser)) return "same-boundary";
  if (/選擇/.test(q.userRaw) && /選擇/.test(cUser) && !looksAiOnlyMatch(query, candidate)) return "same-choice";
  if (/價值|重要|值得/.test(q.userRaw) && /價值|重要|值得/.test(cUser)) return "same-value";
  if (positiveHits.length) return "other-relevant";
  if (personHits.length) return "same-person";
  return "other-relevant";
}

function localReason(query, candidate, type) {
  const q = querySignals(query);
  const cUser = layerBlob(candidate.userRaw);
  const personHits = containsAny(q.all, PERSON_TERMS).filter((term) => cUser.includes(term) || layerBlob(candidate.confirmed).includes(term));
  const tensionHits = containsAny(q.userRaw, TENSION_TERMS).filter((term) => cUser.includes(term) || layerBlob(candidate.confirmed).includes(term));
  if (type === "prior-success") return "這筆紀錄可能和今天有關，因為過去在相近情境裡曾選過一個處理方式。";
  if (type === "same-person" && tensionHits.length) return "這筆紀錄可能和今天有關，因為同一關係裡出現過相近的表達／被理解張力。";
  if (type === "same-tension") return "這筆紀錄可能和今天有關，因為雖然對象不同，但都碰到表達過卻沒被接住。";
  if (type === "other-relevant" && polarity(q.userRaw) === "positive") return "這筆紀錄可能和今天有關，因為都寫到比較自在、被支持的相處。";
  if (personHits.length) return "這筆紀錄可能和今天有關，因為出現相近的人物與情境線索。";
  return "這筆紀錄可能和今天有關，因為使用者原文有可對照的資訊。";
}

function sanitizeReason(reason) {
  const text = compactText(reason, 80);
  if (!text) return "這筆紀錄可能和今天有關。";
  if (PATTERN_CLAIM.test(text)) return "這筆紀錄可能和今天有關，因為內容上有可對照的張力或情境。";
  return text;
}

function sanitizeConnectionType(value) {
  return CONNECTION_TYPES.includes(String(value || "").trim()) ? String(value).trim() : "other-relevant";
}

function localRerank(query, candidates) {
  return candidates
    .map((candidate) => {
      if (looksContradiction(query, candidate) || looksSemanticTrap(query, candidate) || looksAiOnlyMatch(query, candidate)) {
        return { date: candidate.date, relevanceScore: 1, connectionType: "other-relevant", reason: "線索不足或只來自過去 AI 假設。", provenance: provenanceSummary(candidate) };
      }
      const q = querySignals(query);
      const userHits = overlapCount(tokenSet(q.userRaw), tokenSet(layerBlob(candidate.userRaw)));
      const confirmedHits = overlapCount(tokenSet(q.userRaw + "\n" + q.confirmed), tokenSet(layerBlob(candidate.confirmed)));
      const personHits = containsAny(q.all, PERSON_TERMS).filter((term) => layerBlob(candidate.userRaw).includes(term));
      const tensionHits = containsAny(q.userRaw, TENSION_TERMS).filter((term) => (layerBlob(candidate.userRaw) + layerBlob(candidate.confirmed)).includes(term));
      const positiveHits = containsAny(q.userRaw, POSITIVE_TERMS).filter((term) => (layerBlob(candidate.userRaw) + layerBlob(candidate.confirmed)).includes(term));
      const samePolarity = polarity(q.userRaw) === polarity(layerBlob(candidate.userRaw)) || polarity(q.userRaw) === "mixed";
      let score = 0;
      if (userHits >= 6 && (tensionHits.length || positiveHits.length)) score = 4;
      else if (confirmedHits >= 2 && (tensionHits.length || positiveHits.length)) score = 4;
      else if (userHits >= 3 && tensionHits.length) score = 3;
      else if (positiveHits.length && samePolarity && userHits >= 2) score = 3;
      else if (personHits.length && tensionHits.length && userHits >= 2) score = 4;
      else if (personHits.length && !tensionHits.length && !positiveHits.length) score = 1;
      else if (userHits >= 4) score = 2;
      else score = userHits >= 2 ? 2 : 1;
      if ((candidate.confirmed.selectedActions || []).length && score >= 3) {
        const type = "prior-success";
        return {
          date: candidate.date,
          relevanceScore: score,
          connectionType: type,
          reason: localReason(query, candidate, type),
          provenance: provenanceSummary(candidate),
        };
      }
      const type = pickConnectionType(query, candidate, score);
      return {
        date: candidate.date,
        relevanceScore: score,
        connectionType: type,
        reason: localReason(query, candidate, type),
        provenance: provenanceSummary(candidate),
      };
    })
    .filter((item) => item.relevanceScore >= MIN_SELECTED_SCORE)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.date.localeCompare(a.date))
    .slice(0, MAX_SELECTED);
}

function provenanceSummary(candidate) {
  return {
    userRaw: Boolean(layerBlob(candidate.userRaw)),
    userConfirmed: Boolean(layerBlob(candidate.confirmed)),
    aiHypothesis: Boolean(layerBlob(candidate.aiClues)),
  };
}

function compactForAi(candidate) {
  return {
    date: candidate.date,
    userRaw: candidate.userRaw,
    confirmed: candidate.confirmed,
    aiClues: {
      coreQuote: candidate.aiClues.coreQuote,
      deepConclusion: candidate.aiClues.deepConclusion,
      insight: candidate.aiClues.insight,
    },
    provenance: provenanceSummary(candidate),
  };
}

function historyRerankUserPrompt(query, candidates) {
  const q = querySignals(query);
  return `今天日期：${query.date || ""}

【今天 USER_RAW】
${compactText(q.userRaw, 500) || "（無）"}

【今天 USER_CONFIRMED / mood】
${compactText(q.confirmed, 240) || "（無）"}

【今天 AI_HYPOTHESIS｜僅線索】
${compactText(q.aiClues, 240) || "（無）"}

【候選過往紀錄】
${JSON.stringify(candidates.map(compactForAi))}

只判斷資訊價值。不要分析人格。不要硬湊 3 筆。`;
}

function normalizeRerankItems(raw, allowedDates) {
  const src = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(src.items) ? src.items : Array.isArray(raw) ? raw : [];
  const allowed = new Set(allowedDates);
  const seen = new Set();
  return list
    .map((item) => {
      const date = String((item && item.date) || "").trim();
      const score = Number(item && (item.relevanceScore != null ? item.relevanceScore : item.score));
      if (!allowed.has(date) || seen.has(date) || !Number.isFinite(score)) return null;
      seen.add(date);
      return {
        date,
        relevanceScore: Math.max(0, Math.min(4, Math.round(score))),
        connectionType: sanitizeConnectionType(item.connectionType),
        reason: sanitizeReason(item.reason),
      };
    })
    .filter(Boolean)
    .filter((item) => item.relevanceScore >= MIN_SELECTED_SCORE)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.date.localeCompare(a.date))
    .slice(0, MAX_SELECTED);
}

function sourceSignature(query, candidates) {
  return hashSig([
    HISTORY_RETRIEVAL_VARIANT,
    query.date,
    layerBlob(query.userRaw),
    layerBlob(query.confirmed),
    layerBlob(query.aiClues),
    query.extension && query.extension.userAnswer,
    query.extension && query.extension.selectedQuestion,
    ...candidates.map((item) => `${item.date}:${candidateSignature(item)}`),
  ]);
}

function publicSelectedPast(items, candidateMap) {
  return items.map((item) => ({
    date: item.date,
    score: item.relevanceScore,
    connectionType: item.connectionType,
    reason: sanitizeReason(item.reason),
    provenance: (candidateMap.get(item.date) && provenanceSummary(candidateMap.get(item.date))) || item.provenance || {},
  }));
}

function estimatePayloadBytes(query, candidates) {
  try {
    return Buffer.byteLength(JSON.stringify({ query: querySignals(query), candidates: candidates.map(compactForAi) }), "utf8");
  } catch {
    return 0;
  }
}

async function retrieveRelevantHistory(options) {
  const started = Date.now();
  const opts = options && typeof options === "object" ? options : {};
  const currentDate = String(opts.currentDate || "").trim();
  const timings = { extractMs: 0, stage1Ms: 0, stage2Ms: 0, totalMs: 0 };
  if (!isIsoDate(currentDate)) {
    return {
      selectedPast: [],
      debug: { currentDate, candidateCount: 0, stage1Top: [], selectedPast: [], timings, error: "invalid_date" },
    };
  }
  const extractStart = Date.now();
  const query = queryFromJournal(opts.currentJournal, {
    date: currentDate,
    review: { journal: opts.currentJournal, rawText: opts.rawText, gratitude: opts.gratitude },
    currentExtension: opts.currentExtension,
  });
  const candidates = extractFinalizedCandidates(opts.reviews, currentDate, opts.candidateWindow);
  timings.extractMs = Date.now() - extractStart;
  const stage1Start = Date.now();
  const stage1Top = stage1Select(query, candidates, currentDate, opts.stage1Top);
  timings.stage1Ms = Date.now() - stage1Start;
  const sourceSig = sourceSignature(query, stage1Top);
  if (opts.cachedSourceSig && opts.cachedSelectedPast && opts.cachedSourceSig === sourceSig) {
    timings.totalMs = Date.now() - started;
    return {
      selectedPast: opts.cachedSelectedPast,
      debug: {
        currentDate,
        candidateCount: candidates.length,
        stage1Top: stage1Top.map((item) => ({ date: item.date, score: item.stage1Score, reasons: item.stage1Reasons })),
        selectedPast: opts.cachedSelectedPast,
        sourceSig,
        cacheHit: true,
        timings,
        payloadBytes: estimatePayloadBytes(query, stage1Top),
      },
    };
  }
  const stage2Start = Date.now();
  let ranked = [];
  if (!stage1Top.length) {
    ranked = [];
  } else if (typeof opts.rerank === "function") {
    const raw = await opts.rerank(query, stage1Top);
    ranked = normalizeRerankItems(raw, stage1Top.map((item) => item.date)).map((item) => ({
      ...item,
      provenance: provenanceSummary(stage1Top.find((row) => row.date === item.date)),
    }));
  } else if (typeof opts.callAi === "function") {
    try {
      const raw = await opts.callAi([
        { role: "system", content: HISTORY_RERANK_SYSTEM },
        { role: "user", content: historyRerankUserPrompt(query, stage1Top) },
      ]);
      ranked = normalizeRerankItems(raw, stage1Top.map((item) => item.date)).map((item) => ({
        ...item,
        provenance: provenanceSummary(stage1Top.find((row) => row.date === item.date)),
      }));
      if (!ranked.length && raw && typeof raw === "object" && Array.isArray(raw.items) && raw.items.length === 0) {
        ranked = [];
      }
    } catch {
      ranked = localRerank(query, stage1Top);
    }
  } else {
    ranked = localRerank(query, stage1Top);
  }
  timings.stage2Ms = Date.now() - stage2Start;
  timings.totalMs = Date.now() - started;
  const candidateMap = new Map(stage1Top.map((item) => [item.date, item]));
  const selectedPast = publicSelectedPast(ranked, candidateMap);
  return {
    selectedPast,
    debug: {
      currentDate,
      candidateCount: candidates.length,
      stage1Top: stage1Top.map((item) => ({ date: item.date, score: item.stage1Score, reasons: item.stage1Reasons })),
      selectedPast,
      sourceSig,
      cacheHit: false,
      timings,
      payloadBytes: estimatePayloadBytes(query, stage1Top),
    },
  };
}

function internalRetrievalLine(selectedPast) {
  const count = Array.isArray(selectedPast) ? selectedPast.length : 0;
  return `Internal Retrieval · ${count} relevant day${count === 1 ? "" : "s"}`;
}

function isHistoryRetrievalRequest(body) {
  return String((body && body.mode) || "") === "history-retrieval";
}

function snippetsForSelectedPast(reviews, selectedPast) {
  const map = reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {};
  return (Array.isArray(selectedPast) ? selectedPast : [])
    .map((item) => {
      const date = String((item && item.date) || "").trim();
      if (!isIsoDate(date)) return null;
      let compact = null;
      try {
        compact = map[date] ? compactCandidate(map[date], date) : null;
      } catch {
        compact = null;
      }
      return {
        date,
        score: item.score != null ? item.score : item.relevanceScore,
        connectionType: item.connectionType || "",
        provenance: item.provenance || {},
        used: item.used,
        userRaw: compact
          ? {
              event: compact.userRaw.event,
              bodyMindText: compact.userRaw.bodyMindText,
              extensionAnswers: (compact.userRaw.extensionAnswers || []).slice(0, 1),
            }
          : {},
        confirmed: compact
          ? {
              awareness: (compact.confirmed.awareness || []).slice(0, 2),
              selectedActions: (compact.confirmed.selectedActions || []).slice(0, 1),
            }
          : {},
      };
    })
    .filter(Boolean);
}

module.exports = {
  HISTORY_RETRIEVAL_VARIANT,
  HISTORY_RERANK_SYSTEM,
  CANDIDATE_WINDOW,
  STAGE1_TOP,
  MIN_SELECTED_SCORE,
  MAX_SELECTED,
  CONNECTION_TYPES,
  compactCandidate,
  queryFromJournal,
  extractFinalizedCandidates,
  scoreStage1,
  stage1Select,
  localRerank,
  retrieveRelevantHistory,
  historyRerankUserPrompt,
  normalizeRerankItems,
  sourceSignature,
  internalRetrievalLine,
  isHistoryRetrievalRequest,
  snippetsForSelectedPast,
  reviewIsFinalized: reviewMerge.reviewIsFinalized,
};
