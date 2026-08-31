const reflectionV3 = require("./reflection-v3");

const REFLECTION_EXTENSION_VARIANT = "reflection-extension-v1";
const REFLECTION_EXTENSION_MAX_ROUNDS = 2;
const REFLECTION_EXTENSION_ANSWER_MIN = 8;

const REFLECTION_EXTENSION_ASK_SYSTEM = `你是「進行式 ING」的延伸深度思考整理者。

這不是再做一次 04 第一層。
第一層已經給過一句核心金句，以及三個深度反思問題。
使用者現在願意再往裡面看一層。

工作是：根據今天 01～04，找出 3 個真正值得她親自回答的、比第一層更深的問題。

【今天的定位】
第一層 04：今天真正值得重新思考的是什麼？
延伸：如果她願意再往裡面看一層，還有哪些角度值得她親自回答？

【這一版只讀今天】
只能使用今天 01 感謝、02 事件／心情、03 身心覺察、04 核心金句與第一層三題。
若有「上一輪延伸」，只能使用同一天剛剛完成的那一輪。
不要讀過往日期。不要假裝你記得以前。不要引用歷史紀錄。

【不是什麼】
不是再生成更多漂亮問題。
不是再做一次第一層 04。
不是你自己繼續分析、直接給結論。
不是 05 覺察，不是 06 行動。
不是訪談，不是補資料。

【證據優先】
1. 使用者今天親自寫的原文
2. 若有上一輪，她選過的題與親自回答
3. 03 insight／support、04 金句只是 hypothesis，不是已確認事實

【DEPTH <= EVIDENCE】
不要因為要「更深入」就開始童年、原生家庭、創傷、依附、討好型人格、自我價值低、害怕被拋棄。
除非使用者自己提供足夠 evidence。
深度 ≠ 心理化。

【生成前先 internally 檢查，不要輸出檢查過程】
1. 第一層已經問過什麼？
2. 今天哪些角度還沒探索？
3. 哪個 assumption 還沒被檢查？
4. 哪個 contradiction 還沒拆開？
5. 哪個 trade-off 還沒被看見？
6. 哪個 boundary / value / choice 還沒釐清？
7. 哪個「我以為我知道」其實值得再確認？

【禁止重複第一層】
三題不能只是 04.questions 換句話說、同一結論換問法、同一角度再問一次。
必須有 NEW INFORMATION VALUE。
若只是同一問題換字：DROP / REWRITE。

【若這是第二輪】
必須找第一輪還沒探索的方向。
不能重複第一層三題、第一輪三題、第一輪選中的題、第一輪深度結論已經處理的核心。
第二輪要有 NEW ANGLE。

【禁止 information-gathering】
不要退回訪談。
禁止：發生了什麼？你當時感覺如何？為什麼？你希望怎麼樣？對方做了什麼？
如果答案今天已經存在，不要再問。

【禁止 leading question】
OPEN THE THINKING，不是 LEAD TO AN ANSWER。
問題不能暗示：成熟的人應該怎樣、正確答案是放下、你其實不需要別人肯定、你應該接受、你應該離開。
至少兩種答案都必須合理成立。

【正向／幸福】
幸福的一天也可以延伸。不要硬找問題。
可以探索什麼條件讓她自在、什麼狀態值得保留、什麼時候最像自己、今天的幸福透露了她真正重視什麼。
不要 hard-code。不要拿獨處／沒有他來對照找陰影。

【疲累／客觀／evidence 不足】
工作很多、真的很累、沒有其他 evidence：可以承認今天可能就只是累。
客觀環境問題：先看條件、標準、決策權。不要立刻心理化。
evidence 不足時保持保守，不要發明心理故事。

【不要搶 05／06】
不要寫「我看見了自己什麼」。
不要給行動 checklist，不要替她做決定。

必須剛好三題。少一題就是失敗。
三題彼此也不能 semantic duplicate。

只輸出 JSON。繁體中文。
{
  "questions": [
    { "id": "eq1", "text": "" },
    { "id": "eq2", "text": "" },
    { "id": "eq3", "text": "" }
  ]
}`;

const REFLECTION_EXTENSION_CLOSE_SYSTEM = `你是「進行式 ING」的延伸深度思考整理者。

使用者已經自己選了一題，並親自寫下回答。
現在根據這一題與她的回答，整理一個深度結論。

【這一版只讀今天】
不要讀過往日期。不要引用歷史紀錄。

【證據優先】
最高：她剛剛親自回答的文字。必須明顯反映 selected question + user answer。
其次：今天使用者原文。
再其次：03／04 的 AI 輸出。
不可以忽略她剛回答的內容，只重新分析 01～04。

【深度結論要回答】
經過這一題與我的回答，我現在真正看見的是什麼？

【不是什麼】
不是回答摘要，不是原文重述，不是心靈雞湯。
不是行動建議，不是 05 的三個 awareness，不是 06 checklist。
不要替她做決定，不要叫她去做下一步。

【長度】
1～3 個短句。約 45～100 個中文字。
不要長篇文章。ONE CORE CONCLUSION。
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
    .map((item, index) => {
      const text = String((item && (item.text || item.question || item)) || "").replace(/\s+/g, " ").trim();
      if (!text) return null;
      return { id: String((item && item.id) || `eq${index + 1}`), text };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function isExtensionRoundCompleted(round) {
  if (!isPlainObject(round)) return false;
  return Boolean(
    String(round.deepConclusion || "").trim() &&
      String(round.completedAt || "").trim() &&
      String(round.selectedQuestionId || "").trim() &&
      compactChars(round.answer) >= REFLECTION_EXTENSION_ANSWER_MIN
  );
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
  const completed = Boolean(deepConclusion && completedAt && selectedQuestionId && compactChars(answer) >= REFLECTION_EXTENSION_ANSWER_MIN);
  return {
    id: String(src.id || "").trim() || `ext${index + 1}`,
    questions,
    selectedQuestionId,
    answer,
    answerSig,
    deepConclusion,
    completedAt: completed ? completedAt : "",
    sourceSig,
    stale: Boolean(src.stale),
    conclusionStale: Boolean(src.conclusionStale),
  };
}

function normalizeReflectionExtension(raw) {
  const src = isPlainObject(raw) ? raw : {};
  const rounds = (Array.isArray(src.rounds) ? src.rounds : [])
    .map((item, index) => normalizeReflectionExtensionRound(item, index))
    .filter((item) => item.questions.length || item.answer || item.deepConclusion)
    .slice(0, REFLECTION_EXTENSION_MAX_ROUNDS);
  return {
    variant: REFLECTION_EXTENSION_VARIANT,
    rounds,
  };
}

function hasMeaningfulReflectionExtension(raw) {
  const data = normalizeReflectionExtension(raw);
  return data.rounds.some(
    (item) => item.questions.length || item.answer || item.deepConclusion || item.selectedQuestionId
  );
}

function completedExtensionRounds(raw) {
  return normalizeReflectionExtension(raw).rounds.filter(isExtensionRoundCompleted);
}

function completedExtensionCount(raw) {
  return completedExtensionRounds(raw).length;
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

function looksAwarenessList(text) {
  return /我看見了自己什麼|今天的三個覺察|三種覺察|我看見自己：|我可能看見了自己/.test(String(text || ""));
}

function looksSoupConclusion(text) {
  return reflectionV3.looksSoupQuote(text) || /一切都會過去|相信自己|你已經很勇敢|好好愛自己|明天會更好/.test(String(text || ""));
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
  return questionTexts(avoid).some((item) => reflectionV3.looksSemanticDuplicate(text, item));
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
  const questions = normalizeExtensionQuestions(src.questions).filter(
    (item) => item.text && !reflectionV3.looksOverPsych(item.text)
  );
  return { questions: questions.slice(0, 3) };
}

function normalizeExtensionCloseResult(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let deepConclusion = String(src.deepConclusion || src.conclusion || src.text || "").replace(/\s+/g, " ").trim();
  if (looksSoupConclusion(deepConclusion) || reflectionV3.looksOverPsych(deepConclusion) || looksActionAdvice(deepConclusion)) {
    deepConclusion = "";
  }
  return { deepConclusion };
}

function evaluateExtensionAskQuality(result, options) {
  const ctx = (options && options.context) || options || {};
  const questions = normalizeExtensionQuestions(result && result.questions);
  const texts = questions.map((item) => item.text);
  const source = userSourceBlob(ctx);
  const layer = questionTexts(ctx.thinkQuestions || ctx.layerQuestions || ctx.questions);
  const prior = questionTexts(ctx.priorQuestions).concat(
    [ctx.priorSelected, ctx.priorConclusion, priorRoundBlob(ctx)].filter(Boolean)
  );
  const issues = [];
  if (questions.length < 3) issues.push("missing-questions");
  texts.forEach((text, index) => {
    if (looksExtInfoGathering(text)) issues.push(`q${index + 1}-info-gathering`);
    if (looksExtLeading(text)) issues.push(`q${index + 1}-leading`);
    if (reflectionV3.looksOverPsych(text)) issues.push(`q${index + 1}-overpsych`);
    if (looksDuplicateAgainst(text, layer)) issues.push(`q${index + 1}-repeat-layer`);
    if (looksDuplicateAgainst(text, prior)) issues.push(`q${index + 1}-repeat-prior`);
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
  if (options && options.forbid && options.forbid.test(texts.join(""))) issues.push("unsupported");
  const knownCount = texts.filter((text) => looksExtInfoGathering(text)).length;
  if (knownCount >= 2) issues.push("info-gathering-heavy");
  return { ok: !issues.length, issues, questions };
}

function evaluateExtensionCloseQuality(result, options) {
  const ctx = (options && options.context) || options || {};
  const data = normalizeExtensionCloseResult(result);
  const conclusion = data.deepConclusion;
  const answer = String(ctx.answer || "").trim();
  const selected = String(ctx.selectedQuestion || ctx.selectedQuestionText || "").trim();
  const issues = [];
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
  return { ok: !issues.length, issues, deepConclusion: conclusion };
}

function formatPriorRound(ctx) {
  const prior = ctx && ctx.priorRound && typeof ctx.priorRound === "object" ? ctx.priorRound : null;
  if (!prior) return "";
  const questions = questionTexts(prior.questions);
  if (!questions.length && !prior.selectedQuestion && !prior.answer && !prior.deepConclusion) return "";
  return `【同一天，上一輪延伸｜必須找還沒探索的方向】
上一輪候選：
${questions.map((text, index) => `${index + 1}. ${text}`).join("\n") || "無"}
上一輪選中：${compactLine(prior.selectedQuestion || prior.selectedQuestionText, 200) || "無"}
上一輪回答：${compactLine(prior.answer, 360) || "無"}
上一輪深度結論：${compactLine(prior.deepConclusion, 200) || "無"}`;
}

function reflectionExtensionAskUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const layer = questionTexts(ctx.thinkQuestions || ctx.questions);
  return `請依今天 01～04 產出三個比第一層更深、且不重複第一層的延伸問題。不要訪談。不要給結論。不要做 05／06。只讀今天。

【01 今日感謝｜使用者原文】
${compactLine(ctx.thanksText || ctx.thanks, 240) || "未寫"}

【02 今日事件｜使用者原文】
${compactLine(ctx.event, 320) || "未寫"}

【02 心情】
${String(ctx.mood || ctx.moodLabel || "").trim() || "未選"}

【03 身心覺察原文｜使用者自己寫的，權重最高】
${compactLine(ctx.bodyMindText || ctx.bodyNote, 400) || "未寫"}

【03 模型假設｜hypothesis，不是事實】
覺察：${compactLine(ctx.bodyMindInsight, 200) || "無"}
引導：${compactLine(ctx.bodyMindSupport, 200) || "無"}

【04 第一層｜已完成，不要重複】
核心金句：${compactLine(ctx.coreQuote || ctx.thinkCoreQuote, 200) || "無"}
深度反思：
${layer.map((text, index) => `0${index + 1} ${text}`).join("\n") || "無"}

${formatPriorRound(ctx)}

若幸福／安心：不要硬找問題。
若只是累、客觀工作／環境問題：先保持客觀。
問題不能偷偷給答案。三題必須有 NEW INFORMATION VALUE。`;
}

function reflectionExtensionCloseUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return `請依使用者親自選的題與親自寫的回答，整理一個深度結論。必須明顯使用她的回答。不要摘要複述。不要給行動。不要做 05。只讀今天。

【她選的題】
${compactLine(ctx.selectedQuestion || ctx.selectedQuestionText, 240) || "未選"}

【她親自回答｜最高證據】
${compactLine(ctx.answer, 500) || "未寫"}

【今天原文｜次要】
感謝：${compactLine(ctx.thanksText || ctx.thanks, 180) || "未寫"}
事件：${compactLine(ctx.event, 220) || "未寫"}
身心：${compactLine(ctx.bodyMindText || ctx.bodyNote, 220) || "未寫"}
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
  if (id && data.rounds.some((item) => item.id === id)) return true;
  return completed < REFLECTION_EXTENSION_MAX_ROUNDS && data.rounds.length < REFLECTION_EXTENSION_MAX_ROUNDS;
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
  return {
    completed: Math.max(completedExtensionCount(a), completedExtensionCount(b)),
    cloud: a,
    client: b,
    rounds: a.rounds.length || b.rounds.length ? [...a.rounds, ...b.rounds.filter((item) => !a.rounds.some((row) => row.id === item.id))] : [],
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
  hasMeaningfulReflectionExtension,
  isExtensionRoundCompleted,
  completedExtensionRounds,
  completedExtensionCount,
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
};
