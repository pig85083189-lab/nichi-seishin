const reflectionV3 = require("./reflection-v3");

const REFLECTION_EXTENSION_VARIANT = "reflection-extension-v1";
const REFLECTION_EXTENSION_MAX_ROUNDS = 2;
const REFLECTION_EXTENSION_ANSWER_MIN = 8;

const REFLECTION_EXTENSION_ASK_SYSTEM = `你是「進行式 ING」的延伸深度思考整理者。

這不是再給三個不同的深度問題。
也不是再做一次 04 第一層。

工作是：
先找出今天最值得繼續往下看的 ONE CORE THREAD，
再從這個核心產生三個不同角度的問題。

三題可以不同角度，但必須明顯屬於同一條思考線。
看完三題，要能用一句話說：「這三題都在探索 ______。」
做不到就是失敗。不要把三個不同主題塞進同一輪。

【今天的定位】
第一層 04：今天真正值得重新思考的是什麼？
延伸：沿著一條核心，再往裡面看一層。

【這一版只讀今天】
第一輪：只能使用今天 01 感謝、02 事件／心情、03 身心覺察、04 核心金句與第一層三題。
第二輪：先用同一天第一輪的 selected question、user answer、deepConclusion、coreThread。
今天 01～04 是次要。
不要讀過往日期。不要假裝你記得以前。不要引用歷史紀錄。

【不是什麼】
不是再生成更多漂亮問題。
不是重新從 01～04 開始分析一次。
不是你自己繼續分析、直接給結論。
不是 05 覺察，不是 06 行動。
不是訪談，不是補資料。

【生成前先 internally 決定 ONE CORE THREAD，不要輸出思考過程】
第一輪：從今天 01～04 裡，只選一個最值得繼續往下的核心。
例如可能是：被看見 vs 自我價值、接受現況 vs 真正選擇、努力本身 vs 對結果的期待、表達過 vs 被理解、關係維持 vs 個人界線、成就感 vs 外界肯定。
不要 hard-code。不要三個主題並行。
第二輪：不要再從 01～04 另找新主題。coreThread 必須來自第一輪 user answer 裡「已經看見一部分，但還沒真正解開的張力」。

【三題：同核心、不同角度】
三題都必須圍繞這個 CORE THREAD。
可以分別是：拆開目前的 assumption、看另一個可能的解釋、看這個核心對她真正意味著什麼。
不要硬套格式。重點是三題明顯在深入同一件事。

【問題必須簡潔】
第一輪：每一題 1 句，約 30～70 個中文字。
第二輪：每一題 1 句，約 25～60 個中文字。
一題只處理 ONE thinking move。
不要在一題裡塞背景、假設、兩層解釋、三個子問題。
使用者要一眼知道：這題到底在問我什麼？

【證據優先】
第一輪：
1. 使用者今天親自寫的原文
2. 03 insight／support、04 金句只是 hypothesis
第二輪：
1. 第一輪 user answer（最高權重）
2. 第一輪 deepConclusion
3. 第一輪 selectedQuestion
4. 今天 01～04 最後
不要忽略她親自回答，又自己跑回原本假設。
不要重新從整天內容找新主題。

【DEPTH <= EVIDENCE】
不要因為要「更深入」就開始童年、原生家庭、創傷、依附、討好型人格、自我價值低、害怕被拋棄。
除非使用者自己提供足夠 evidence。
深度 ≠ 心理化。

【禁止重複第一層】
三題不能只是 04.questions 換句話說、同一結論換問法、同一角度再問一次。
必須有 NEW INFORMATION VALUE。
若只是同一問題換字：DROP / REWRITE。

【若這是第二輪｜必須是 NEXT LAYER，不是 PARALLEL ANGLE】
不要重新從 01～04 開始問。
不要只是產生「相關的另一個問題」。

生成前 internally 先回答，不要輸出過程：
A. 使用者在 Round 1 已經確認了什麼？
B. 這個回答裡還同時存在什麼矛盾、拉扯或未解部分？
C. 如果第一輪已經回答了一件事，接下來哪個問題真的會讓她再往下一層？

Round 2 的 coreThread 必須來自 B：已經看見一部分，但還沒真正解開的張力。

生成前必須能完成這句：
「因為使用者在第一輪回答了 ______，所以第二輪值得繼續探索的是 ______。」
如果第二個空格無法直接由第一個空格推導：不合格，REWRITE。

internally 建立：
ALREADY EXPLORED：第一輪 selected question、user answer、deepConclusion、第一輪 coreThread 已確定的部分、04 第一層三題。
UNRESOLVED TENSION：回答裡同時成立、但還沒拆開的矛盾／拉扯／未解部分。
第二輪只能從 UNRESOLVED TENSION 產生問題。

不要跳到平行主題。
例如她已說「即使沒有人看見，我還是知道自己的努力有價值」：
不要再問「那你要怎麼讓別人看到你的努力？」——那只是換一個相關主題。
值得問的是：既然價值已被自己確認，沒被看見時真正刺痛的又是什麼；或「我知道有價值」和「我仍希望重要的人看見」可以同時成立時，她真正想被看見的是哪一部分。
這只是 quality example，不 hard-code。

不要太快跳到解決方案：怎麼做、怎麼讓別人知道、怎麼溝通、怎麼改善。那些容易變成 06。
優先繼續拆：意義、期待、矛盾、價值、界線、選擇、需要、內外在標準。只有 evidence 支持時才用。

三題必須仍是 ONE NEXT CORE THREAD ＋ 3 different angles。
看完要能說：「這三題都是在往 ______ 再深入。」
做不到就是失敗。

不要再問她已經回答過的事。
不要把 conclusion 換句再說一次。
換詞、換句型、把已確認內容再問一次：DROP / REWRITE。
如果看起來只是「又根據今天的內容生了三題」：失敗。

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
  "coreThread": "",
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
若這是第二輪：同時看第一輪已經看見什麼，但不要重新總結整天。
再其次：03／04 的 AI 輸出。
不可以忽略她剛回答的內容，只重新分析 01～04。

【深度結論要回答】
經過這一題＋我的回答，這一輪真正看見的是什麼？
ONE CORE CONCLUSION。

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
  const selectedFromList = questions.find((item) => item.id === selectedQuestionId);
  return {
    id: String(src.id || "").trim() || `ext${index + 1}`,
    coreThread: compactLine(src.coreThread, 80),
    questions,
    selectedQuestionId,
    selectedQuestionText: compactLine(selectedFromList ? selectedFromList.text : src.selectedQuestionText, 200),
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

function looksOverloadedQuestion(text) {
  const raw = String(text || "").trim();
  if ((raw.match(/[？?]/g) || []).length >= 2) return true;
  return raw.split(/[，、；;]/).filter((part) => compactChars(part) >= 8).length >= 4;
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
  const questions = normalizeExtensionQuestions(src.questions).filter(
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
  if (looksSoupConclusion(deepConclusion) || reflectionV3.looksOverPsych(deepConclusion) || looksActionAdvice(deepConclusion)) {
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
  if (questions.length < 3) issues.push("missing-questions");
  if (!data.coreThread) issues.push("missing-core-thread");
  if (looksThreadIgnored(texts, data.coreThread)) issues.push("thread-ignored");
  const isRound2 = Boolean(String(priorRound.answer || "").trim());
  texts.forEach((text, index) => {
    const chars = compactChars(text);
    if (looksExtInfoGathering(text)) issues.push(`q${index + 1}-info-gathering`);
    if (looksExtLeading(text)) issues.push(`q${index + 1}-leading`);
    if (reflectionV3.looksOverPsych(text)) issues.push(`q${index + 1}-overpsych`);
    if (looksOverloadedQuestion(text) || chars > (isRound2 ? 64 : 78)) issues.push(`q${index + 1}-too-long`);
    if (chars && chars < (isRound2 ? 12 : 14)) issues.push(`q${index + 1}-too-short`);
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
  if (options && options.forbid && options.forbid.test(texts.join(""))) issues.push("unsupported");
  const knownCount = texts.filter((text) => looksExtInfoGathering(text)).length;
  if (knownCount >= 2) issues.push("info-gathering-heavy");
  if (isRound2 && looksRound2IgnoresAnswer(texts, priorRound.answer)) issues.push("ignores-answer");
  if (isRound2 && looksParallelAngle(texts, priorRound.answer, userSourceBlob(ctx))) issues.push("parallel-angle");
  if (isRound2 && texts.filter((text) => looksSolutionJump(text)).length >= 1) issues.push("solution-jump");
  return { ok: !issues.length, issues, questions, coreThread: data.coreThread };
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
${compactLine(prior.answer, 400) || "無"}
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
每題 25～60 字。三題都是在往同一個 next layer 再深入。`;
}

function reflectionExtensionAskUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const layer = questionTexts(ctx.thinkQuestions || ctx.questions);
  const prior = formatPriorRound(ctx);
  const intro = prior
    ? "這是第二次延伸。最高權重是第一輪 user answer。先找出回答裡已經確認、但還沒真正解開的張力，再往 NEXT LAYER。不要 PARALLEL ANGLE。不要重新從今天 01～04 找新主題。不要跳到怎麼做／怎麼讓別人知道。三題必須圍繞 ONE NEXT CORE THREAD。每題 1 句、約 25～60 字。不要訪談。不要給結論。不要做 05／06。只讀今天。"
    : "請先找出今天最值得繼續往下的 ONE CORE THREAD，再產出三個同核心、不同角度的延伸問題。不要把三個主題塞進同一輪。每題 1 句、約 30～70 字。不要訪談。不要給結論。不要做 05／06。只讀今天。";
  return `${intro}

${prior}

【01 今日感謝｜${prior ? "次要" : "使用者原文"}】
${compactLine(ctx.thanksText || ctx.thanks, 240) || "未寫"}

【02 今日事件｜${prior ? "次要" : "使用者原文"}】
${compactLine(ctx.event, 320) || "未寫"}

【02 心情】
${String(ctx.mood || ctx.moodLabel || "").trim() || "未選"}

【03 身心覺察原文｜${prior ? "次要" : "使用者自己寫的"}】
${compactLine(ctx.bodyMindText || ctx.bodyNote, 400) || "未寫"}

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
回答：${compactLine(prior.answer, 240) || "無"}

第二輪結論只回答：比第一輪再往下一層後，現在多看見了什麼？`
    : "";
  return `請依使用者親自選的題與親自寫的回答，整理一個深度結論。必須明顯使用她的回答。不要摘要複述。不要把三題全部總結。不要給行動。不要做 05。只讀今天。

【她選的題】
${compactLine(ctx.selectedQuestion || ctx.selectedQuestionText, 240) || "未選"}

【她親自回答｜最高證據】
${compactLine(ctx.answer, 500) || "未寫"}

${priorBlock}

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
  upsertReflectionExtensionRound,
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
  looksSolutionJump,
};
