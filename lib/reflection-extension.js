const reflectionV3 = require("./reflection-v3");
const voice = require("./ing-voice");
const insightReason = require("./insight-reason");

const REFLECTION_EXTENSION_VARIANT = "reflection-extension-v1";
const REFLECTION_EXTENSION_MAX_ROUNDS = 2;
const REFLECTION_EXTENSION_ANSWER_MIN = 8;

const REFLECTION_EXTENSION_ASK_SYSTEM = `${insightReason.WRITER_SYSTEM}

【延伸約束｜只寫 PASS，不要重新分析整天】
這不是再做一次 04 第一層。先沿 ONE CORE THREAD 寫。
TODAY FIRST。PAST SECOND。HISTORICAL VALUE CHECK：過往只在真的增加新理解時用。
不要讀過往日期。不要假裝你記得以前。不要把三篇過往各問一題。
Round 1 結構：你剛剛說了什麼 → 這讓我注意到什麼 → 因此再往下一層。
Round 2 是 NEXT LAYER，不是 PARALLEL ANGLE。不是把 Round 1 question 改寫。
第二輪：不要讀過往日期。不要引用歷史紀錄。
最高權重是 Round 1 USER ANSWER／user answer。internally 記得 ALREADY EXPLORED 與 UNRESOLVED TENSION。
progressive depth。每題因前因可以 40～180 字。有幾個 PASS 寫幾個，不要硬湊三題。
`;


const REFLECTION_EXTENSION_CLOSE_SYSTEM = `${voice.GLOBAL_VOICE_BLOCK}

${voice.FULL_INPUT_READ_BLOCK}

你是「進行式 ING」的延伸深度思考整理者。

使用者已經自己選了一題，並親自寫下回答。
現在根據這一題與她的回答，整理一個深度結論。

【這一版只讀今天】
不要讀過往日期。不要引用歷史紀錄。

【證據優先】
最高：她剛剛親自回答的文字。必須明顯反映 selected question + user answer。
其次：今天使用者原文。
若這是第二輪：同時看第一輪已經看見什麼，但不要重新總結整天。
再其次：03／04 的 AI 輸出。
不可以忽略她剛回答的內容，只重新分析 01～04。

【深度結論要回答】
經過這一題＋我的回答，這一輪真正看見的是什麼？
ONE CORE CONCLUSION。
它不是心理分析報告。
它應該是：把她剛剛回答的東西整理成一句她自己看得懂的發現。
一句她可以真的帶走。

不要：「這反映出她目前的方向確認仍高度依賴外部視角，而尚未建立完整的內在判準。」
不要：「第一輪只看到……第二輪更直接地說……」
要：「你不是一定要把所有不確定都消除掉，只是當有人從旁邊提醒你時，你會更容易相信自己的方向。」

她的最新回答永遠高於你先前的 inference。
如果她否定你前一個假設，結論必須跟著更新，不准繼續硬證明原 hypothesis。

若這是第二輪，要回答：
比第一輪再往下一層後，現在多看見了什麼？
不要把第一輪再說一遍。不要重新總結 01～04。

【不是什麼】
不是回答摘要，不是原文重述，不是把三個問題全部總結。
不是再補一堆心理分析，不是心靈雞湯。
不是行動建議，不是 05 的三個 awareness，不是 06 checklist。
不要替她做決定，不要叫她去做下一步。

【長度】
1～3 個短句。約 45～100 個中文字。
不要長篇文章。
evidence 不足時保持保守。

【DEPTH <= EVIDENCE】
不要發明童年、原生家庭、創傷、依附、討好型人格、自我價值低。
不要把 inference 寫成確定心理狀態。
若必須推論，用也許／可能／或許。

【正向】
幸福的一天不要硬找問題。可以看見她真正重視、想保留的狀態。

只輸出 JSON。繁體中文。
{
  "deepConclusion": ""
}`;

function compactLine(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const limit = Number(max) || 400;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function compactChars(text) {
  return String(text || "").replace(/\s+/g, "").trim().length;
}

function closeTextKey(text) {
  return String(text || "")
    .replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "")
    .trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isReflectionExtensionRequest(body) {
  return (
    body?.variant === REFLECTION_EXTENSION_VARIANT ||
    body?.context?.variant === REFLECTION_EXTENSION_VARIANT
  );
}

function reflectionExtensionStep(body) {
  const step = String((body && (body.step || (body.context && body.context.step))) || "").trim();
  return step === "close" ? "close" : "ask";
}

function emptyReflectionExtension() {
  return {
    variant: REFLECTION_EXTENSION_VARIANT,
    rounds: [],
  };
}

function normalizeExtensionQuestions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => voice.composeInsightItem(item, index, "eq"))
    .filter(Boolean)
    .slice(0, 3);
}

function extensionConclusionMeaningful(text) {
  return String(text || "").replace(/\s+/g, " ").trim().length > 0;
}

function isExtensionRoundCompleted(round) {
  if (!isPlainObject(round)) return false;
  return Boolean(extensionConclusionMeaningful(round.deepConclusion) && String(round.completedAt || "").trim());
}

function normalizeReflectionExtensionRound(raw, index) {
  const src = isPlainObject(raw) ? raw : {};
  const questions = normalizeExtensionQuestions(src.questions);
  const allowed = new Set(questions.map((item) => item.id));
  const selectedQuestionId = allowed.has(String(src.selectedQuestionId || "").trim())
    ? String(src.selectedQuestionId || "").trim()
    : "";
  const answer = String(src.answer || "").trim();
  const deepConclusion = String(src.deepConclusion || "").replace(/\s+/g, " ").trim();
  const completedAt = String(src.completedAt || "").trim();
  const answerSig = String(src.answerSig || "").trim();
  const sourceSig = String(src.sourceSig || "").trim();
  const selectedFromList = questions.find((item) => item.id === selectedQuestionId);
  return {
    id: String(src.id || "").trim() || `ext${index + 1}`,
    coreThread: compactLine(src.coreThread, 80),
    questions,
    selectedQuestionId,
    selectedQuestionText: compactLine(selectedFromList ? selectedFromList.text : src.selectedQuestionText, 480),
    answer,
    answerSig,
    deepConclusion,
    completedAt,
    sourceSig,
    stale: Boolean(src.stale),
    conclusionStale: Boolean(src.conclusionStale),
    retrieval: normalizeExtensionRetrieval(src.retrieval),
  };
}

function normalizeExtensionRetrievalRef(raw) {
  const item = raw && typeof raw === "object" ? raw : {};
  const date = String(item.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const provenance = item.provenance && typeof item.provenance === "object" ? item.provenance : {};
  return {
    date,
    score: Math.max(0, Math.min(4, Number(item.score != null ? item.score : item.relevanceScore) || 0)),
    connectionType: String(item.connectionType || "").trim(),
    provenance: {
      userRaw: Boolean(provenance.userRaw),
      userConfirmed: Boolean(provenance.userConfirmed),
      aiHypothesis: Boolean(provenance.aiHypothesis),
    },
    used: item.used !== false,
  };
}

function normalizeExtensionRetrieval(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const selectedPast = (Array.isArray(src.selectedPast) ? src.selectedPast : [])
    .map(normalizeExtensionRetrievalRef)
    .filter(Boolean)
    .slice(0, 3);
  const sourceSig = String(src.sourceSig || "").trim();
  if (!sourceSig && !selectedPast.length) return null;
  return { sourceSig, selectedPast };
}

function normalizeReflectionExtension(raw) {
  const src = isPlainObject(raw) ? raw : {};
  const rawRounds = Array.isArray(src.rounds) ? src.rounds : [];
  const rounds = rawRounds
    .map((item, index) => normalizeReflectionExtensionRound(item, index))
    .filter((item, index) => {
      const rawId = String((rawRounds[index] && rawRounds[index].id) || "").trim();
      return Boolean(rawId || item.questions.length || item.answer || item.deepConclusion || item.selectedQuestionId);
    })
    .slice(0, REFLECTION_EXTENSION_MAX_ROUNDS);
  return {
    variant: REFLECTION_EXTENSION_VARIANT,
    rounds,
  };
}

function upsertReflectionExtensionRound(extension, round) {
  const data = normalizeReflectionExtension(extension);
  const next = normalizeReflectionExtensionRound(round, data.rounds.length);
  const index = data.rounds.findIndex((item) => item.id && item.id === next.id);
  const rounds = data.rounds.slice();
  if (index >= 0) rounds[index] = normalizeReflectionExtensionRound({ ...rounds[index], ...next }, index);
  else rounds.push(next);
  return {
    variant: REFLECTION_EXTENSION_VARIANT,
    rounds: rounds.slice(0, REFLECTION_EXTENSION_MAX_ROUNDS),
  };
}

function hasMeaningfulReflectionExtension(raw) {
  const data = normalizeReflectionExtension(raw);
  return data.rounds.some(
    (item) => item.questions.length || item.answer || item.deepConclusion || item.selectedQuestionId || item.coreThread
  );
}

function completedExtensionRounds(raw) {
  return normalizeReflectionExtension(raw).rounds.filter(isExtensionRoundCompleted);
}

function completedExtensionCount(raw) {
  return completedExtensionRounds(raw).length;
}

function canStartExtensionRound2(persisted, options = {}) {
  const data = normalizeReflectionExtension(persisted);
  const completed = completedExtensionCount(data);
  if (Boolean(options.archived) || Boolean(options.busy)) return false;
  return completed === 1 && data.rounds.length >= 1;
}

function extensionDailyLimitReached(persisted) {
  return completedExtensionCount(persisted) >= REFLECTION_EXTENSION_MAX_ROUNDS;
}

function activeExtensionRound(raw) {
  const data = normalizeReflectionExtension(raw);
  const open = [...data.rounds].reverse().find((item) => !isExtensionRoundCompleted(item) && item.questions.length);
  return open || data.rounds[data.rounds.length - 1] || null;
}

function selectedExtensionQuestion(round) {
  const data = normalizeReflectionExtensionRound(round, 0);
  return data.questions.find((item) => item.id === data.selectedQuestionId) || null;
}

function extensionAnswerSig(answer) {
  return String(answer || "").replace(/\s+/g, " ").trim();
}

function extensionSourceSig(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const questions = Array.isArray(data.thinkQuestions || data.questions) ? data.thinkQuestions || data.questions : [];
  return [
    compactLine(data.thanksText || data.thanks, 240),
    compactLine(data.event, 240),
    String(data.mood || data.moodLabel || "").trim(),
    compactLine(data.bodyMindText || data.bodyNote, 400),
    compactLine(data.bodyMindInsight, 200),
    compactLine(data.bodyMindSupport, 200),
    compactLine(data.coreQuote || data.thinkCoreQuote, 200),
    questions
      .map((item) => String((item && (item.text || item.question)) || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("|"),
  ].join("\n");
}

function looksExtInfoGathering(text) {
  if (reflectionV3.looksInfoGathering(text)) return true;
  return /發生了什麼|你當時感覺如何|你當時是什麼感覺|你希望怎麼樣|對方做了什麼|對方當時做了|你為什麼會|為什麼會這樣|你希望對方|你真正想要的是什麼/.test(
    String(text || "")
  );
}

function looksExtLeading(text) {
  if (reflectionV3.looksLeadingQuestion(text)) return true;
  return /你其實不需要別人肯定|你應該接受|你應該離開|正確答案是放下|成熟的人應該|是不是該放下|是不是該離開|是不是其實不需要/.test(
    String(text || "")
  );
}

function looksActionAdvice(text) {
  return /下一步是|明天就|你可以試著|建議你先|先去做|行動清單|先寫一封|今天就去|立刻去|先開口跟對方/.test(String(text || ""));
}

function looksPatternClaim(text) {
  return /你總是|你一直|你反覆|這是你的模式|這再次證明|你的人生模式/.test(String(text || ""));
}

function looksFalseMemory(text) {
  return /你之前就曾經|你上次也|你以前也總是|你過去一直/.test(String(text || ""));
}

function isRound1Ask(body) {
  if (reflectionExtensionStep(body) !== "ask") return false;
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const prior = ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : null;
  return !prior || !String(prior.answer || "").trim();
}

function todayUserBlob(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [data.thanksText || data.thanks, data.event, data.bodyMindText || data.bodyNote, data.mood].filter(Boolean).join("\n");
}

function pastTrustedBlob(item) {
  const raw = item && item.userRaw && typeof item.userRaw === "object" ? item.userRaw : {};
  const confirmed = item && item.confirmed && typeof item.confirmed === "object" ? item.confirmed : {};
  return [
    raw.event,
    raw.bodyMindText,
    ...(Array.isArray(raw.extensionAnswers) ? raw.extensionAnswers : []),
    ...(Array.isArray(confirmed.awareness) ? confirmed.awareness : []),
    ...(Array.isArray(confirmed.selectedActions) ? confirmed.selectedActions : []),
  ]
    .filter(Boolean)
    .join("\n");
}

function pastHasTrustedEvidence(item) {
  const provenance = item && item.provenance && typeof item.provenance === "object" ? item.provenance : {};
  if (provenance.userRaw || provenance.userConfirmed) return true;
  return Boolean(pastTrustedBlob(item));
}

function pastIsAiOnly(item) {
  const provenance = item && item.provenance && typeof item.provenance === "object" ? item.provenance : {};
  return Boolean(provenance.aiHypothesis) && !provenance.userRaw && !provenance.userConfirmed && !pastTrustedBlob(item);
}

function todayContradictsPast(ctx, item) {
  const today = todayUserBlob(ctx);
  const pastAi = String((item && item.aiClue) || "");
  if (/不是選擇權|沒有在意選擇|不是因為選擇/.test(today) && /選擇權/.test(pastAi + JSON.stringify(item || {}))) return true;
  return false;
}

function pastAddsRound1Value(ctx, item) {
  if (!item || !item.date) return false;
  if (Number(item.score || item.relevanceScore || 0) < 3) return false;
  if (pastIsAiOnly(item) || !pastHasTrustedEvidence(item)) return false;
  if (todayContradictsPast(ctx, item)) return false;
  const today = todayUserBlob(ctx);
  const past = pastTrustedBlob(item);
  if (!past) return false;
  const todayPos = /自在|安心|幸福|被支持|沒有壓力|放鬆/.test(today) && !/沒用|沒被理解|卡住|衝突/.test(today);
  const pastHard = /沒被理解|說了也沒用|聽不懂|卡住/.test(past);
  if (todayPos && pastHard) return false;
  const type = String(item.connectionType || "");
  const sharedConcept = /理解|表達|溝通|界線|選擇|自在|安心|被支持|沒有壓力|聽懂|說了/;
  if (type === "same-person") return sharedConcept.test(today) && sharedConcept.test(past);
  return ["same-tension", "same-situation", "same-value", "same-boundary", "same-choice", "prior-success", "other-relevant"].includes(type);
}

function gateRound1Past(ctx, selectedPast) {
  const retrieved = Array.isArray(selectedPast) ? selectedPast.filter((item) => item && item.date) : [];
  const used = retrieved.filter((item) => pastAddsRound1Value(ctx, item)).slice(0, 3);
  return {
    retrieved,
    used,
    rejected: retrieved.filter((item) => !used.some((row) => row.date === item.date)),
  };
}

function persistableRound1Retrieval(sourceSig, gated) {
  const usedDates = new Set((gated && gated.used ? gated.used : []).map((item) => item.date));
  const selectedPast = (gated && gated.retrieved ? gated.retrieved : []).map((item) => ({
    date: item.date,
    score: item.score != null ? item.score : item.relevanceScore,
    connectionType: item.connectionType || "",
    provenance: item.provenance || {},
    used: usedDates.has(item.date),
  }));
  return normalizeExtensionRetrieval({
    sourceSig: sourceSig || "",
    selectedPast,
  }) || { sourceSig: String(sourceSig || "").trim(), selectedPast: [] };
}

function formatRound1PastBlock(used) {
  const rows = Array.isArray(used) ? used : [];
  if (!rows.length) return "";
  const lines = rows.map((item) => {
    const bits = [];
    const raw = item.userRaw && typeof item.userRaw === "object" ? item.userRaw : {};
    const confirmed = item.confirmed && typeof item.confirmed === "object" ? item.confirmed : {};
    if (raw.event || raw.bodyMindText) bits.push(`USER_RAW：${compactLine(raw.event || raw.bodyMindText, 80)}`);
    if (confirmed.awareness && confirmed.awareness[0]) bits.push(`USER_CONFIRMED：${compactLine(confirmed.awareness[0], 70)}`);
    if (confirmed.selectedActions && confirmed.selectedActions[0]) {
      bits.push(`USER_SELECTED 行動｜不是完成證據：${compactLine(confirmed.selectedActions[0], 70)}`);
    }
    return `${item.date}｜${item.connectionType || "other-relevant"}\n${bits.join("\n") || "（僅日期 reference）"}`;
  });
  return `【相關過往｜輔助，不是主體。TODAY FIRST。可以只用 0～1 筆】
先做 HISTORICAL VALUE CHECK。沒有新理解角度就不要用。
不要把下面每一筆各問一題。不要寫「你之前就曾經／你總是／你一直」。
不要把過往 AI 假設寫成使用者事實。不要宣稱上次行動有效。
即使使用過往，也不必每一次明說「以前」。不必炫耀記憶。不要寫日期翻舊帳。
PAST USER RAW > PAST USER CONFIRMED > PAST AI HYPOTHESIS。

${lines.join("\n\n")}`;
}

function compactRetrievalRefs(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const date = String((item && item.date) || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        date,
        score: Number(item.score != null ? item.score : item.relevanceScore) || 0,
        connectionType: String((item && item.connectionType) || "").trim(),
        used: item && item.used === true,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function formatInternalRetrievalLine(options) {
  const src = options && typeof options === "object" ? options : {};
  const retrieved = compactRetrievalRefs(src.retrieved || src.references || src.selectedPast);
  const used = Array.isArray(src.used) ? compactRetrievalRefs(src.used) : retrieved.filter((item) => item.used);
  const retrievedCount = Number.isFinite(Number(src.retrievedCount != null ? src.retrievedCount : src.count))
    ? Number(src.retrievedCount != null ? src.retrievedCount : src.count)
    : retrieved.length;
  const usedCount = Number.isFinite(Number(src.usedCount)) ? Number(src.usedCount) : used.length;
  const bits = used.map((item) => `${item.date}${item.connectionType ? ` ${item.connectionType}` : ""}`);
  return `Internal Retrieval · retrieved ${retrievedCount} · used ${usedCount}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
}

function looksSolutionJump(text) {
  return /怎麼讓別人|怎麼讓對方|怎麼讓人|如何讓別人|如何讓對方|要怎麼讓|怎麼溝通|如何溝通|怎麼改善|如何改善|怎麼做才|你可以怎麼做|有沒有別的方法讓|怎樣才能讓別人/.test(
    String(text || "")
  );
}

function looksRound2IgnoresAnswer(texts, answer) {
  const source = compactLine(answer, 240);
  if (!source) return false;
  const hits = (Array.isArray(texts) ? texts : []).filter((text) => threadOverlap(text, source) >= 2).length;
  return hits === 0;
}

function looksParallelAngle(texts, answer, today) {
  const source = compactLine(answer, 240);
  const day = compactLine(today, 240);
  if (!source) return false;
  const rows = Array.isArray(texts) ? texts : [];
  if (!rows.length) return false;
  const answerHits = rows.filter((text) => threadOverlap(text, source) >= 2).length;
  const todayHits = day ? rows.filter((text) => threadOverlap(text, day) >= 2).length : 0;
  return answerHits === 0 && todayHits >= 2;
}

function looksAwarenessList(text) {
  return /我看見了自己什麼|今天的三個覺察|三種覺察|我看見自己：|我可能看見了自己/.test(String(text || ""));
}

function looksSoupConclusion(text) {
  return reflectionV3.looksSoupQuote(text) || /一切都會過去|你已經很勇敢|好好愛自己|明天會更好/.test(String(text || ""));
}

function looksProblemHuntingPositive(source, blob) {
  if (!/幸福|一直笑|很開心|很舒服|很安心|很放鬆/.test(String(source || ""))) return false;
  return /創傷|害怕失去|依附|隱藏問題|其實不快樂|陰影/.test(String(blob || ""));
}

function questionTexts(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => String((item && (item.text || item.question || item)) || "").trim())
    .filter(Boolean);
}

function looksDuplicateAgainst(text, avoid) {
  return questionTexts(avoid).some((item) => {
    if (compactChars(text) >= compactChars(item) + 24) return false;
    return reflectionV3.looksSemanticDuplicate(text, item);
  });
}

function looksOverloadedQuestion(text) {
  const raw = String(text || "").trim();
  return (raw.match(/[？?]/g) || []).length >= 4;
}

function threadGrams(text) {
  const stop = /不是|自己|現在|還沒|因為|所以|也許|可能|或許|真的|一件|這份|這個|那樣|有沒有|還是|還會|比較|什麼|時候/;
  const key = closeTextKey(text);
  const set = new Set();
  for (let i = 0; i < key.length - 1; i += 1) {
    const gram = key.slice(i, i + 2);
    if (!stop.test(gram)) set.add(gram);
  }
  return set;
}

function threadOverlap(left, right) {
  const a = left instanceof Set ? left : threadGrams(left);
  const b = right instanceof Set ? right : threadGrams(right);
  let count = 0;
  a.forEach((gram) => {
    if (b.has(gram)) count += 1;
  });
  return count;
}

function looksThreadIgnored(texts, coreThread) {
  const thread = compactLine(coreThread, 80);
  if (!thread) return false;
  const core = threadGrams(thread);
  if (core.size < 2) return false;
  const hits = (Array.isArray(texts) ? texts : []).filter((text) => threadOverlap(text, core) >= 1).length;
  return hits === 0;
}

function userSourceBlob(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [data.thanksText || data.thanks, data.event, data.bodyMindText || data.bodyNote, data.coreQuote].filter(Boolean).join("\n");
}

function priorRoundBlob(ctx) {
  const prior = ctx && ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : {};
  return [
    questionTexts(prior.questions).join("\n"),
    prior.selectedQuestion || prior.selectedQuestionText,
    prior.answer,
    prior.deepConclusion,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeExtensionAskResult(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(src.items) && src.items.length ? src.items : src.questions;
  const questions = normalizeExtensionQuestions(list).filter(
    (item) => item.text && !reflectionV3.looksOverPsych(item.text)
  );
  return {
    coreThread: compactLine(src.coreThread || src.thread || src.core, 80),
    questions: questions.slice(0, 3),
  };
}

function normalizeExtensionCloseResult(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let deepConclusion = String(src.deepConclusion || src.conclusion || src.text || "").replace(/\s+/g, " ").trim();
  if (looksSoupConclusion(deepConclusion) || reflectionV3.looksOverPsych(deepConclusion) || looksActionAdvice(deepConclusion) || voice.looksReportConclusion(deepConclusion)) {
    deepConclusion = "";
  }
  return { deepConclusion };
}

function evaluateExtensionAskQuality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeExtensionAskResult(result);
  const questions = data.questions;
  const texts = questions.map((item) => item.text);
  const source = userSourceBlob(ctx);
  const layer = questionTexts(ctx.thinkQuestions || ctx.layerQuestions || ctx.questions);
  const priorRound = ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : {};
  const prior = questionTexts(ctx.priorQuestions)
    .concat(questionTexts(priorRound.questions))
    .concat(
      [
        ctx.priorSelected,
        ctx.priorConclusion,
        priorRound.selectedQuestion,
        priorRound.selectedQuestionText,
        priorRound.answer,
        priorRound.deepConclusion,
        priorRound.coreThread,
        priorRoundBlob(ctx),
      ].filter(Boolean)
    );
  const issues = [];
  if (questions.length < 1) issues.push("missing-questions");
  if (!data.coreThread) issues.push("missing-core-thread");
  if (looksThreadIgnored(texts, data.coreThread)) issues.push("thread-ignored");
  const isRound2 = Boolean(String(priorRound.answer || "").trim());
  texts.forEach((text, index) => {
    const chars = compactChars(text);
    if (looksExtInfoGathering(text)) issues.push(`q${index + 1}-info-gathering`);
    if (looksExtLeading(text)) issues.push(`q${index + 1}-leading`);
    if (reflectionV3.looksOverPsych(text)) issues.push(`q${index + 1}-overpsych`);
    if (looksOverloadedQuestion(text) || chars > 280) issues.push(`q${index + 1}-too-long`);
    if (chars && chars < 14) issues.push(`q${index + 1}-too-short`);
    if (voice.looksAbstractJargon(text)) issues.push(`q${index + 1}-jargon`);
    if (voice.looksFillerPhrase(text)) issues.push(`q${index + 1}-filler`);
    if (voice.looksAnswerAlreadyInInput((questions[index] && questions[index].question) || text, source)) {
      issues.push(`q${index + 1}-answer-in-input`);
    }
    if (options && options.requireContext && voice.looksMissingQuestionContext(text)) issues.push(`q${index + 1}-missing-context`);
    if (isRound2 && looksSolutionJump(text)) issues.push(`q${index + 1}-solution-jump`);
    if (looksDuplicateAgainst(text, layer)) issues.push(`q${index + 1}-repeat-layer`);
    if (looksDuplicateAgainst(text, prior)) issues.push(`q${index + 1}-repeat-prior`);
    if (priorRound.answer && reflectionV3.looksRestate(priorRound.answer, text)) issues.push(`q${index + 1}-repeat-answer`);
    if (priorRound.deepConclusion && reflectionV3.looksSemanticDuplicate(text, priorRound.deepConclusion)) {
      issues.push(`q${index + 1}-repeat-conclusion`);
    }
  });
  if (
    reflectionV3.looksSemanticDuplicate(texts[0], texts[1]) ||
    reflectionV3.looksSemanticDuplicate(texts[1], texts[2]) ||
    reflectionV3.looksSemanticDuplicate(texts[0], texts[2])
  ) {
    issues.push("duplicate-questions");
  }
  if (reflectionV3.looksOverPsych(texts.join(""))) issues.push("overpsych");
  if (looksProblemHuntingPositive(source, texts.join(""))) issues.push("positive-problem-hunt");
  if (voice.looksStoppedAtEllipsis(texts.join(""))) issues.push("ellipsis-stop");
  if (options && options.forbid && options.forbid.test(texts.join(""))) issues.push("unsupported");
  const knownCount = texts.filter((text) => looksExtInfoGathering(text)).length;
  if (knownCount >= 2) issues.push("info-gathering-heavy");
  if (isRound2 && looksRound2IgnoresAnswer(texts, priorRound.answer)) issues.push("ignores-answer");
  if (isRound2 && looksParallelAngle(texts, priorRound.answer, userSourceBlob(ctx))) issues.push("parallel-angle");
  if (isRound2 && texts.filter((text) => looksSolutionJump(text)).length >= 1) issues.push("solution-jump");
  if (texts.some(looksPatternClaim) || looksPatternClaim(data.coreThread)) issues.push("pattern-claim");
  if (texts.some(looksFalseMemory)) issues.push("false-memory");
  const usedPast = Array.isArray(ctx.usedPast) ? ctx.usedPast : [];
  if (usedPast.length >= 2) {
    const types = new Set(usedPast.map((item) => String((item && item.connectionType) || "")));
    const peopleHints = (texts.join("") + data.coreThread).match(/家人|工作|伴侶|同事|主管/g) || [];
    if (types.size >= 3 && new Set(peopleHints).size >= 3) issues.push("history-scattered");
  }
  return { ok: !issues.length, issues, questions, coreThread: data.coreThread };
}

function evaluateExtensionCloseQuality(result, options) {
  const ctx = (options && options.context) || options || {};
  const rawConclusion = String((result && (result.deepConclusion || result.conclusion || result.text)) || "");
  const data = normalizeExtensionCloseResult(result);
  const conclusion = data.deepConclusion;
  const answer = String(ctx.answer || "").trim();
  const selected = String(ctx.selectedQuestion || ctx.selectedQuestionText || "").trim();
  const issues = [];
  if (voice.looksReportConclusion(rawConclusion)) issues.push("report-tone");
  const chars = compactChars(conclusion);
  if (!conclusion) issues.push("missing-conclusion");
  if (chars && chars < 20) issues.push("conclusion-too-short");
  if (chars > 140) issues.push("conclusion-too-long");
  if (looksSoupConclusion(conclusion)) issues.push("conclusion-soup");
  if (looksActionAdvice(conclusion)) issues.push("conclusion-action");
  if (looksAwarenessList(conclusion)) issues.push("conclusion-awareness");
  if (reflectionV3.looksOverPsych(conclusion)) issues.push("overpsych");
  if (answer && reflectionV3.looksRestate(answer, conclusion)) issues.push("conclusion-is-summary");
  if (answer && !reflectionV3.looksRestate(answer, conclusion)) {
    const stop = /不是|自己|現在|還沒|因為|所以|也許|可能|或許|真的|一件|這份|這個|那樣/;
    const grams = (value) => {
      const text = closeTextKey(value);
      const set = new Set();
      for (let i = 0; i < text.length - 1; i += 1) {
        const gram = text.slice(i, i + 2);
        if (!stop.test(gram)) set.add(gram);
      }
      return set;
    };
    const ga = grams(answer);
    const gc = grams(conclusion);
    let inter = 0;
    gc.forEach((gram) => {
      if (ga.has(gram)) inter += 1;
    });
    const selectedHit = selected && closeTextKey(conclusion).includes(closeTextKey(selected).slice(0, 6));
    if (inter < 1 && !selectedHit) issues.push("conclusion-ignores-answer");
  }
  if (options && options.forbid && options.forbid.test(conclusion)) issues.push("unsupported");
  if (looksProblemHuntingPositive(userSourceBlob(ctx), conclusion)) issues.push("positive-problem-hunt");
  if (voice.looksAbstractJargon(conclusion)) issues.push("jargon");
  if (voice.looksRejectedHypothesisContinued(answer, conclusion)) issues.push("rejected-hypothesis");
  if (voice.looksReportConclusion(conclusion)) issues.push("report-tone");
  if (voice.looksFillerPhrase(conclusion)) issues.push("filler");
  const priorConclusion = String((ctx.priorRound && ctx.priorRound.deepConclusion) || ctx.priorConclusion || "").trim();
  if (priorConclusion && reflectionV3.looksSemanticDuplicate(conclusion, priorConclusion)) issues.push("conclusion-repeats-prior");
  return { ok: !issues.length, issues, deepConclusion: conclusion };
}

function formatPriorRound(ctx) {
  const prior = ctx && ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : null;
  if (!prior) return "";
  const questions = questionTexts(prior.questions);
  if (!questions.length && !prior.selectedQuestion && !prior.answer && !prior.deepConclusion && !prior.coreThread) return "";
  return `【第二輪｜最高權重。不要重新從 01～04 開始】
這是 NEXT LAYER，不是 PARALLEL ANGLE。
不要只是產生相關的另一個問題。
不要重新從整天內容找新主題。

第一輪她親自回答｜最高證據：
${voice.userRawForPrompt(prior.answer, 2000) || "無"}
第一輪深度結論｜其次：
${compactLine(prior.deepConclusion, 220) || "無"}
第一輪選中｜再其次：
${compactLine(prior.selectedQuestion || prior.selectedQuestionText, 200) || "無"}
第一輪核心：${compactLine(prior.coreThread, 80) || "無"}
第一輪其他題｜不要重問：
${questions.map((text, index) => `${index + 1}. ${text}`).join("\n") || "無"}

先找回答裡「已經確認了什麼」和「還沒真正解開的張力」。
coreThread 必須來自那個未解張力。
必須能完成：因為她第一輪回答了 ______，所以第二輪值得繼續探索的是 ______。
不要跳到怎麼做、怎麼讓別人知道、怎麼溝通。
每題先從第一輪回答裡找出一個新的看見，再問。不要假裝深。`;
}

function reflectionExtensionAskUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const layer = questionTexts(ctx.thinkQuestions || ctx.questions);
  const prior = formatPriorRound(ctx);
  const usedPast = Array.isArray(ctx.usedPast) ? ctx.usedPast : [];
  const pastBlock = !prior && usedPast.length ? formatRound1PastBlock(usedPast) : "";
  const intro = prior
    ? "這是第二次延伸。最高權重是第一輪 user answer。先從回答裡找出一個新的值得看見的東西，再往 NEXT LAYER。不要 PARALLEL ANGLE。不要把 Round 1 問題改寫。沒有真正新的 layer 就不要假裝深。不要重新從今天 01～04 找新主題。不要跳到怎麼做／怎麼讓別人知道。每個 item 先 title + insight，再 question。白話。推測不要寫成診斷。不要訪談。不要給結論。不要做 05／06。只讀今天。不要讀過往日期。"
    : pastBlock
      ? "請先找出今天最值得繼續往下的 ONE CORE THREAD。今天是主體。相關過往只在能增加新理解角度時當輔助。不要被歷史蓋過。不要把三篇過往各問一題。不要寫你總是／你之前就曾經。不必每一次明說以前。每個 item 先 title + insight，再 question。不要訪談。不要給結論。不要做 05／06。"
      : "請先找出今天最值得繼續往下的 ONE CORE THREAD，再產出三個同核心、不同角度的洞察。不要把三個主題塞進同一輪。每個 item 先 title + insight，最後才決定要不要 question。完整讀完 USER RAW。不要訪談。不要給結論。不要做 05／06。只讀今天。";
  return `${intro}

${prior}
${pastBlock}

【01 今日感謝｜${prior ? "次要" : "使用者原文"}】
${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}

【02 今日事件｜${prior ? "次要" : "使用者原文"}】
${voice.userRawForPrompt(ctx.event) || "未寫"}

【02 心情】
${String(ctx.mood || ctx.moodLabel || "").trim() || "未選"}

【03 身心覺察原文｜${prior ? "次要" : "使用者自己寫的"}】
${voice.userRawForPrompt(ctx.bodyMindText || ctx.bodyNote) || "未寫"}

【03 模型假設｜hypothesis，不是事實】
覺察：${compactLine(ctx.bodyMindInsight, 200) || "無"}
引導：${compactLine(ctx.bodyMindSupport, 200) || "無"}

【04 第一層｜已完成，ALREADY EXPLORED，不要重複】
核心金句：${compactLine(ctx.coreQuote || ctx.thinkCoreQuote, 200) || "無"}
深度反思：
${layer.map((text, index) => `0${index + 1} ${text}`).join("\n") || "無"}

若幸福／安心：不要硬找問題。
若只是累、客觀工作／環境問題：先保持客觀。
問題不能偷偷給答案。必須輸出 coreThread。三題必須能歸到同一核心。`;
}

function reflectionExtensionCloseUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const prior = ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : null;
  const priorBlock = prior && (prior.answer || prior.deepConclusion)
    ? `【第一輪已經看見｜不要重述整天】
核心：${compactLine(prior.coreThread, 80) || "無"}
結論：${compactLine(prior.deepConclusion, 200) || "無"}
回答：${voice.userRawForPrompt(prior.answer, 2000) || "無"}

第二輪結論只回答：比第一輪再往下一層後，現在多看見了什麼？`
    : "";
  return `請依使用者親自選的題與親自寫的回答，整理一個深度結論。必須明顯使用她的回答。不要摘要複述。不要把三題全部總結。不要給行動。不要做 05。只讀今天。
白話。一句她可以真的帶走的發現。不要寫成「第一輪只看到……第二輪更直接地說……」。
如果她否定你前一個假設，必須接受修正，不准繼續硬證明。

【她選的題】
${compactLine(ctx.selectedQuestion || ctx.selectedQuestionText, 480) || "未選"}

【她親自回答｜最高證據】
${voice.userRawForPrompt(ctx.answer, 2000) || "未寫"}

${priorBlock}

【今天原文｜次要】
感謝：${voice.userRawForPrompt(ctx.thanksText || ctx.thanks) || "未寫"}
事件：${voice.userRawForPrompt(ctx.event) || "未寫"}
身心：${voice.userRawForPrompt(ctx.bodyMindText || ctx.bodyNote) || "未寫"}
金句：${compactLine(ctx.coreQuote || ctx.thinkCoreQuote, 160) || "無"}

1～3 個短句。約 45～100 個中文字。ONE CORE CONCLUSION。`;
}

function reflectionExtensionGenerationAllowed(options) {
  return Boolean(options && options.confirmed === true && options.auto !== true);
}

function extensionAskAllowed(persisted, incomingRoundId) {
  const data = normalizeReflectionExtension(persisted);
  const completed = completedExtensionCount(data);
  const id = String(incomingRoundId || "").trim();
  if (id) {
    const existing = data.rounds.find((item) => item.id === id);
    if (existing && !isExtensionRoundCompleted(existing)) return true;
  }
  return completed < REFLECTION_EXTENSION_MAX_ROUNDS;
}

function extensionCloseAllowed(persisted, incomingRoundId) {
  const data = normalizeReflectionExtension(persisted);
  const completed = completedExtensionCount(data);
  const id = String(incomingRoundId || "").trim();
  const existing = id ? data.rounds.find((item) => item.id === id) : null;
  if (existing && isExtensionRoundCompleted(existing)) return true;
  return completed < REFLECTION_EXTENSION_MAX_ROUNDS;
}

function tighterExtensionLimit(cloud, client) {
  const a = normalizeReflectionExtension(cloud);
  const b = normalizeReflectionExtension(client);
  const usedOlder = new Set();
  const next = b.rounds.map((round, index) => {
    let matchIndex = a.rounds.findIndex((item, idx) => !usedOlder.has(idx) && item.id && item.id === round.id);
    if (matchIndex < 0 && index < a.rounds.length && !usedOlder.has(index)) matchIndex = index;
    if (matchIndex >= 0) {
      usedOlder.add(matchIndex);
      return normalizeReflectionExtensionRound({ ...a.rounds[matchIndex], ...round }, index);
    }
    return round;
  });
  a.rounds.forEach((round, index) => {
    if (
      !usedOlder.has(index) &&
      (round.questions.length || round.answer || round.deepConclusion || round.selectedQuestionId)
    ) {
      next.push(round);
    }
  });
  const rounds = next.slice(0, REFLECTION_EXTENSION_MAX_ROUNDS);
  return {
    completed: completedExtensionCount({ rounds }),
    cloud: a,
    client: b,
    rounds,
  };
}

function answerIsMeaningful(answer) {
  return compactChars(answer) >= REFLECTION_EXTENSION_ANSWER_MIN;
}

module.exports = {
  REFLECTION_EXTENSION_VARIANT,
  REFLECTION_EXTENSION_MAX_ROUNDS,
  REFLECTION_EXTENSION_ANSWER_MIN,
  REFLECTION_EXTENSION_ASK_SYSTEM,
  REFLECTION_EXTENSION_CLOSE_SYSTEM,
  isReflectionExtensionRequest,
  reflectionExtensionStep,
  emptyReflectionExtension,
  normalizeExtensionQuestions,
  normalizeReflectionExtensionRound,
  normalizeReflectionExtension,
  upsertReflectionExtensionRound,
  hasMeaningfulReflectionExtension,
  extensionConclusionMeaningful,
  isExtensionRoundCompleted,
  completedExtensionRounds,
  completedExtensionCount,
  canStartExtensionRound2,
  extensionDailyLimitReached,
  activeExtensionRound,
  selectedExtensionQuestion,
  extensionAnswerSig,
  extensionSourceSig,
  normalizeExtensionAskResult,
  normalizeExtensionCloseResult,
  evaluateExtensionAskQuality,
  evaluateExtensionCloseQuality,
  reflectionExtensionAskUserPrompt,
  reflectionExtensionCloseUserPrompt,
  reflectionExtensionGenerationAllowed,
  extensionAskAllowed,
  extensionCloseAllowed,
  tighterExtensionLimit,
  answerIsMeaningful,
  looksExtInfoGathering,
  looksExtLeading,
  looksActionAdvice,
  looksSolutionJump,
  looksPatternClaim,
  looksFalseMemory,
  isRound1Ask,
  gateRound1Past,
  persistableRound1Retrieval,
  formatRound1PastBlock,
  formatInternalRetrievalLine,
  compactRetrievalRefs,
  normalizeExtensionRetrieval,
};
