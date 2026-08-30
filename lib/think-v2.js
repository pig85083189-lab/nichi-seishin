const THINK_V2_ASK_SYSTEM = `你是一面會提問的鏡子。不是心理師、不是測驗、不是分析師。

根據今天原文與真實問答，只問一個能讓思考往前的問題。
有些事情看清楚之後，沒有更深的東西需要被找出來。

【優先順序｜照這個想，不要每條都做一遍】
1. 尊重使用者已知、與已經否定的方向。被否定的假設已死亡。
2. 找目前真正不知道、且答案會改變理解的那一件事。
3. 使用者自己新說出的詞，優先於你原本想挖的方向。
4. 只有原文裡已有明顯矛盾，才指出落差。不要先塞兩個答案。
5. 沒有資訊增量就停。
6. Close 時不要比使用者說過的話更聰明。

【資訊增量｜第 3 題只看這個】
只有這些才值得再問：
- fork：有兩個合理解釋，答案會明顯改變核心理解
- userUnknown：使用者自己提出重要但還沒釐清的未知
- contradiction：明顯矛盾，而且前兩題還沒解開
- decisionFact：重大決定，還缺一個會影響判斷的事實
這些全部不夠：再深入、更了解感受／需要／代表什麼、讓答案更完整、再確認、問得更具體、探索背後意義。
不要把「希望被看見」再抽象成被放在心上、關係價值、更深需求。
有時候「我就是希望重要的人看見我的努力」已經完整。

【怎麼問】
短、直接、一次一件事。像一個很會想的人在聊天。
不要預設「A 還是 B」。只有兩邊都來自使用者原文，且分開會改變理解，才用二分。
observation 可空。能直接問就直接問。
禁止固定節奏：「當你說……的時候」「一方面……另一方面」「這是否意味著」「對你而言」「這背後代表」。
禁止：雞湯、診斷、人格／模式標籤、跨日的「你總是／你通常」、行動建議、替美好找陰影、把累或客觀問題心理化、問「要不要說／接下來怎麼做」。
幸福／感謝：問到具體瞬間或珍惜什麼就可以停。
疲憊／不想想：相信他，很快停。
客觀狀況（熱、沒睡、壞掉）：先當字面原因。
已說清楚的核心：不要硬挖。
重大決定：可釐清事實與未知。禁止告訴他該不該做。

【被否定】
若他說「不是」「完全沒有」「不是這個」「我沒有這種感覺」「不是我在意的」「跟這個沒關係」：
上一題假設標記為 REJECTED。下一題不能換句話再問，不能用更抽象的詞包裝，不能暗示他只是沒發現。除非他自己後來又提起。

【輪數】
第 1 題必問。readyToClose=false。
第 2 題：已清楚／只是累／只是客觀／幸福瞬間已說出口 → close。否則承接上一答新詞再問。
第 3 題預設 close。只有 gainKind 屬於 fork / userUnknown / contradiction / decisionFact 才問。否則 question=""。
第 3 題後一定結束。

只輸出 JSON。繁體中文。
question：一個白話疑問句，16-56 字。close 時 ""。
observation：可空。最多 24 字，只回扣原話。
hint：可空。最多 16 字。
unknown：若還問，寫那一個未知；否則 ""。
gainKind：none / fork / userUnknown / contradiction / decisionFact
userSignal：你承接的那句使用者原話；沒有則 ""
{
  "observation": "",
  "question": "",
  "hint": "",
  "unknown": "",
  "gainKind": "none",
  "userSignal": "",
  "readyToClose": false,
  "focus": "unknown"
}
focus：fact, interpretation, emotion, need, contradiction, reality, unknown, cherish, rest`;

const THINK_V2_CLOSE_SYSTEM = `你是一面鏡子。只把剛才被說出來的東西放在桌上。

CLOSE DEPTH <= EVIDENCE DEPTH
Close 的深度不能超過使用者實際說出的深度。不要比他更聰明。
有些事情看清楚之後，沒有更深的東西。不要補人格、模式、二次解讀。

不要提問、不要行動、不要雞湯、不要「你通常／你一直／長期以來」。
禁止：「問題解決模式」「二次解讀」「你習慣進入……」。

stuck：今天值得看的是什麼。1～2 句。可短。
seen：他說出了什麼。回扣原話。不要發明領悟。
unknown：只有他自己留下未知時才寫。不要創造。沒有就 ""。
title：8-16 字。具體。

幸福停在瞬間。疲憊可以停在「今天只是累」。
重大決定：若他自己說還沒想清楚／不知道還有沒有選擇，unknown 必須留下，不要清空。

只輸出 JSON。繁體中文。
{
  "title": "",
  "stuck": "",
  "seen": "",
  "unknown": ""
}`;

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 3;
const GAIN_FORK = "fork";
const GAIN_USER_UNKNOWN = "userUnknown";
const GAIN_CONTRADICTION = "contradiction";
const GAIN_DECISION = "decisionFact";
const GAIN_NONE = "none";
const VALID_GAIN = [GAIN_NONE, GAIN_FORK, GAIN_USER_UNKNOWN, GAIN_CONTRADICTION, GAIN_DECISION];

function compact(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const limit = max || 800;
  const chars = text.replace(/\s+/g, "");
  if (chars.length <= limit) return text;
  return `${text.slice(0, Math.max(8, limit))}…`;
}

function formatThanks(ctx) {
  const raw = String((ctx && ctx.thanksText) || "").trim();
  if (raw) return raw;
  const items = Array.isArray(ctx && ctx.thanks)
    ? ctx.thanks.map((item) => String(item || "").trim()).filter(Boolean)
    : String((ctx && ctx.thanks) || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
  if (!items.length) return "";
  return items.length === 1 ? items[0] : items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatBody(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const check = ctx.bodyCheck && typeof ctx.bodyCheck === "object" ? ctx.bodyCheck : null;
  if (!check) {
    const tags = Array.isArray(ctx.bodyTags) ? ctx.bodyTags.filter(Boolean).join("、") : "";
    const note = String(ctx.bodyNote || "").trim();
    if (!tags && !note) return "";
    return `身體狀態：${tags || "未選"}${note ? `\n身體在提醒我：${note}` : ""}`;
  }
  const groupLine = (label, group) => {
    const data = group && typeof group === "object" ? group : {};
    const flags = Array.isArray(data.flags) ? data.flags.filter((flag) => flag && flag !== "其他").join("、") : "";
    const extra = data.other ? `其他：${data.other}` : "";
    const bits = [flags, extra].filter(Boolean).join("；");
    if (!bits && !data.reason) return "";
    return `${label}：${bits || "未勾選"}${data.reason ? `；說明：${data.reason}` : ""}`;
  };
  const sleep = check.sleep && typeof check.sleep === "object" ? check.sleep : {};
  const sleepBits = [
    sleep.duration ? `時間 ${sleep.duration}` : "",
    sleep.quality ? `品質 ${sleep.quality}` : "",
    sleep.energy ? `起床精神 ${sleep.energy}` : "",
  ].filter(Boolean);
  const lines = [
    groupLine("今日心情檢核", check.mood),
    groupLine("今日身體檢核", check.body),
    sleepBits.length
      ? `昨晚睡眠：${sleepBits.join("、")}${sleep.reason ? `；說明：${sleep.reason}` : ""}`
      : groupLine("昨日睡眠檢核", sleep),
  ].filter(Boolean);
  return lines.join("\n");
}

function answeredRounds(rounds) {
  return (Array.isArray(rounds) ? rounds : []).filter(
    (item) => String(item && item.question || "").trim() && String(item && item.answer || "").trim()
  );
}

function formatRounds(rounds) {
  const list = answeredRounds(rounds);
  if (!list.length) return "（尚未開始提問）";
  return list
    .map((item, index) => {
      const denied = String(item.dropped || item.denied || "").trim();
      return `第 ${index + 1} 輪\n問：${String(item.question || "").trim()}\n答：${String(item.answer || "").trim()}${
        denied ? `\n使用者已否定／放下：${denied}` : ""
      }`;
    })
    .join("\n\n");
}

function isDenial(answer) {
  return /不是，?我完全沒有|完全沒有這種感覺|我沒有這種感覺|不是這個意思|不是這個|不是我在意的|跟這個沒關係|不是這樣/.test(
    String(answer || "")
  );
}

function significantWords(text) {
  return String(text || "")
    .replace(/[「」『』，。！？、：；\s?!,.'"]/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !/^(你|我|他|她|是|不是|還是|什麼|時候|這個|那個|自己|真的|比較|一下)$/.test(item));
}

function questionTopicKeys(question) {
  const text = String(question || "");
  const keys = [];
  [
    "反應",
    "感覺",
    "受傷",
    "沒面子",
    "懷疑自己",
    "執行力",
    "逃避",
    "接受",
    "焦慮",
    "害怕失去",
    "沒面子",
  ].forEach((key) => {
    if (text.includes(key)) keys.push(key);
  });
  return keys;
}

function rejectedHypotheses(rounds) {
  const list = answeredRounds(rounds);
  const rejected = [];
  const blob = list.map((item) => String(item.answer || "")).join("\n");
  if (/不是懷疑自己|沒有懷疑自己|我知道自己.{0,8}(努力|好|可以)|我不懷疑/.test(blob)) {
    rejected.push({ topic: "懷疑自己", note: "使用者並不懷疑自己的能力／價值。" });
  }
  if (/不是接受|沒有真的接受|只是忍|先忍|不是甘願/.test(blob)) {
    rejected.push({ topic: "已經接受", note: "使用者並不是已經真正接受。" });
  }
  if (/不是沒有執行力|不是懶|不是不想做|不是逃避|不是我沒執行力/.test(blob)) {
    rejected.push({ topic: "沒有執行力", note: "使用者否定「沒有執行力／逃避」。" });
  }
  list.forEach((item) => {
    if (!isDenial(item.answer)) return;
    const keys = questionTopicKeys(item.question);
    if (!keys.length) keys.push(...significantWords(item.question).slice(0, 3));
    keys.forEach((topic) => {
      rejected.push({
        topic,
        question: String(item.question || "").trim(),
        note: `使用者否定：「${compact(item.answer, 40)}」。假設「${compact(item.question, 40)}」已死亡。`,
      });
    });
  });
  return rejected;
}

function deniedAssumptions(rounds) {
  return rejectedHypotheses(rounds).map((item) => item.note);
}

function questionRevivesRejected(question, rounds) {
  const rejected = rejectedHypotheses(rounds);
  const q = String(question || "");
  if (!q || !rejected.length) return false;
  return rejected.some((item) => {
    const topic = String(item.topic || "");
    if (topic && q.includes(topic)) return true;
    const prev = String(item.question || "");
    if (!prev) return false;
    const shared = significantWords(prev).filter((word) => q.includes(word));
    return shared.length >= 2;
  });
}

function extractUnknownClauses(text) {
  return String(text || "")
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .filter((item) => /不知道|不確定|還沒想清楚|有沒有選擇|能忍到什麼程度/.test(item));
}

function userIntroducedSignals(rounds) {
  const list = answeredRounds(rounds);
  const last = list[list.length - 1];
  if (!last) return [];
  const answer = String(last.answer || "").trim();
  const prior = list
    .slice(0, -1)
    .map((item) => `${item.question} ${item.answer}`)
    .join("\n");
  const signals = [];
  extractUnknownClauses(answer).forEach((item) => signals.push(item));
  const quoted = answer.match(/「[^」]{2,24}」/g) || [];
  quoted.forEach((item) => signals.push(item.replace(/[「」]/g, "")));
  [
    /能忍到什麼程度/,
    /先忍下來/,
    /標準不清楚/,
    /怕做了又重來/,
    /不是第一次/,
    /理所當然/,
    /沒有明確跟他說過/,
    /只是希望他看見/,
    /下次.{0,8}講清楚/,
    /沒有受傷/,
    /就是熱到睡不好/,
    /怎樣算做完/,
  ].forEach((pattern) => {
    const matched = answer.match(pattern);
    if (matched) signals.push(matched[0]);
  });
  significantWords(answer).forEach((word) => {
    if (word.length >= 4 && !prior.includes(word) && !signals.includes(word)) signals.push(word);
  });
  return [...new Set(signals.filter(Boolean))];
}

function extractUserUnknowns(rounds) {
  const list = answeredRounds(rounds);
  if (!list.length) return [];
  return extractUnknownClauses(list[list.length - 1].answer);
}

function textBlob(ctx, body, rounds) {
  return [
    formatThanks(ctx),
    ctx && (ctx.event || ctx.text),
    body && body.text,
    ctx && ctx.mood,
    formatRounds(rounds),
  ]
    .map((item) => String(item || ""))
    .join("\n");
}

function looksTiredStop(blob) {
  return /不想(再)?(想|分析)|只是累|就是(身體)?累|先休息|沒有特別想挖|什麼都不想|今天先這樣|今天先休息/.test(blob);
}

function looksCherishStop(blob) {
  const warm = /開心|幸福|滿足|平靜|珍惜|感謝|喜歡/.test(blob);
  const grounded = /那一(下|刻|瞬間)|笑的|記住這種|真正珍惜|好好聊天/.test(blob);
  return warm && grounded;
}

function looksAlreadyClear(blob) {
  return /我知道我真正|我很清楚|真正生氣的不是|而是他答應|我很在意承諾|沒有特別還想挖|已經知道是/.test(blob);
}

function looksObjectiveStop(blob) {
  const physical = /冷氣|好熱|很熱|睡不好|壞掉|頭痛|塞車|房間/.test(blob);
  const enough = /沒有別的|就是熱|修冷氣|沒有更深|就是字面/.test(blob);
  return physical && (enough || /睡不好/.test(blob));
}

function heuristicEarlyClose(ctx, body, rounds) {
  const blob = textBlob(ctx, body, rounds);
  const answered = answeredRounds(rounds).length;
  if (answered < 1) return false;
  if (looksTiredStop(blob)) return true;
  if (looksObjectiveStop(blob)) return true;
  if (looksAlreadyClear(blob) && answered >= 1) return true;
  if (looksCherishStop(blob) && answered >= 1) return true;
  return false;
}

function looksLowGainShape(question) {
  const q = String(question || "");
  return (
    /意味著|背後代表|這背後|對你而言|對你來說真正|這是否|更了解|再確認|探索/.test(q) ||
    /努力本身.{0,6}還是|還是.{0,8}(背後|本身|意義)/.test(q) ||
    /你通常|你一直|長期以來/.test(q) ||
    /要不要說|說了也沒用|接下來(可以|該|要)/.test(q)
  );
}

function lastAnswerHasOpenUnknown(rounds) {
  const last = answeredRounds(rounds)[answeredRounds(rounds).length - 1];
  return last ? extractUnknownClauses(last.answer).length > 0 : false;
}

function lastAnswerHasAmbiguity(rounds) {
  const last = answeredRounds(rounds)[answeredRounds(rounds).length - 1];
  const answer = last ? String(last.answer || "") : "";
  return /不確定|不知道|還沒想清楚|還是/.test(answer);
}

function contradictionStillOpen(ctx, rounds) {
  const event = String((ctx && (ctx.event || ctx.text)) || "");
  const answers = answeredRounds(rounds)
    .map((item) => item.answer)
    .join("\n");
  const had = /接受|沒關係|自己知道就好/.test(event) && /生氣|火|失落|難過/.test(event);
  if (!had) return false;
  if (/不是真的接受|失落是因為|不懷疑|只是希望他看見|先忍下來/.test(answers)) return false;
  return true;
}

function majorDecisionMissingFact(ctx, rounds) {
  const blob = textBlob(ctx, null, rounds);
  if (!/辭職|離職|分手|搬家|很想走/.test(blob)) return false;
  const answers = answeredRounds(rounds)
    .map((item) => item.answer)
    .join("\n");
  const hasTrigger = /加了|不合理|發生|當下/.test(answers);
  const hasDuration = /不是第一次|只是今天|持續|太累想逃|真的要走/.test(answers);
  const hasChoice = /選擇|外面/.test(answers);
  if (answeredRounds(rounds).length >= 2) return !hasDuration || !hasChoice;
  return !hasTrigger;
}

function sharesSignal(question, signals) {
  const q = String(question || "");
  return signals.some((signal) => {
    const text = String(signal || "");
    if (text.length >= 4 && q.includes(text.slice(0, Math.min(6, text.length)))) return true;
    const words = significantWords(text).filter((word) => word.length >= 2);
    if (words.filter((word) => q.includes(word)).length >= 1) return true;
    if (/忍|程度/.test(text) && /忍|程度|接受|範圍|超過|情況/.test(q)) return true;
    if (/選擇|還沒想清楚|要走|想逃/.test(text) && /選擇|走|累|今天|持續|想清楚/.test(q)) return true;
    if (/不確定|重視|回應|放在心上/.test(text) && /重視|回應|知道|放在心上|沒聽到/.test(q)) return true;
    return false;
  });
}

function scoreInformationGain(options) {
  const question = String((options && options.question) || "").trim();
  const rounds = (options && options.rounds) || [];
  const ctx = (options && options.ctx) || {};
  const callIndex = Number(options && options.callIndex) || answeredRounds(rounds).length + 1;
  const claimed = VALID_GAIN.includes(options && options.gainKind) ? options.gainKind : GAIN_NONE;
  if (!question) return { score: 0, reason: "no-question", gainKind: GAIN_NONE };

  if (questionRevivesRejected(question, rounds)) {
    return { score: 0, reason: "rejected-hypothesis", gainKind: GAIN_NONE };
  }
  if (looksLowGainShape(question)) {
    return { score: 0, reason: "low-gain-shape", gainKind: GAIN_NONE };
  }

  const signals = userIntroducedSignals(rounds);
  const follows = sharesSignal(question, signals);
  const userUnknown = lastAnswerHasOpenUnknown(rounds);
  const forkLike = /還是/.test(question) && lastAnswerHasAmbiguity(rounds);
  const contradiction = contradictionStillOpen(ctx, rounds);
  const decisionGap = majorDecisionMissingFact(ctx, rounds);

  if (userUnknown && follows) {
    return { score: 2, reason: "user-unknown", gainKind: GAIN_USER_UNKNOWN };
  }
  if (contradiction && (follows || /接受|生氣|火|失落/.test(question))) {
    return { score: 2, reason: "open-contradiction", gainKind: GAIN_CONTRADICTION };
  }
  if (decisionGap && (follows || /今天|持續|選擇|不能接受|發生/.test(question))) {
    return { score: 2, reason: "decision-fact", gainKind: GAIN_DECISION };
  }
  if (claimed === GAIN_FORK && forkLike && lastAnswerHasAmbiguity(rounds)) {
    return { score: 2, reason: "fork", gainKind: GAIN_FORK };
  }

  const prevQ = answeredRounds(rounds).map((item) => item.question);
  const overlapPrev = prevQ.some((item) => significantWords(item).filter((word) => question.includes(word)).length >= 2);
  if (overlapPrev) return { score: 0, reason: "rephrase", gainKind: GAIN_NONE };
  if (callIndex >= 3) return { score: 1, reason: "more-specific", gainKind: GAIN_NONE };
  if (follows) return { score: 2, reason: "new-signal", gainKind: GAIN_USER_UNKNOWN };
  return { score: 1, reason: "specific", gainKind: claimed === GAIN_NONE ? GAIN_NONE : claimed };
}

function journalBlock(ctx, body) {
  const thanks = formatThanks(ctx);
  const event = String((ctx && (ctx.event || ctx.text)) || (body && body.text) || "").trim();
  const mood = String((ctx && ctx.mood) || "").trim();
  const bodyLine = formatBody(ctx);
  return `【今天的輸入｜只能引用這裡與問答裡出現過的事實】
今日感謝：
${thanks || "未寫"}
今日事件：${event || "（未寫）"}
心情：${mood || "未選"}
${bodyLine || "身體覺察：未填，不要硬編身體細節"}`;
}

function thinkV2CallIndex(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const answered = answeredRounds(ctx.rounds).length;
  const requested = Number(body && body.round || ctx.round) || 0;
  if (requested >= 1 && requested <= MAX_ROUNDS) return requested;
  return Math.min(MAX_ROUNDS, answered + 1);
}

function thinkV2UserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const rounds = Array.isArray(ctx.rounds) ? ctx.rounds : [];
  const answered = answeredRounds(rounds);
  const callIndex = thinkV2CallIndex(body);
  const last = answered[answered.length - 1];
  const lastAnswer = last ? String(last.answer || "").trim() : "";
  const rejected = rejectedHypotheses(rounds);
  const signals = userIntroducedSignals(rounds);
  const userUnknowns = extractUserUnknowns(rounds);
  const dialogue = `【到目前為止的完整問答｜必須承接上一答】
${formatRounds(rounds)}`;

  if (String(body && body.step || ctx.step || "ask") === "close") {
    return `只整理剛才被說出來的東西。深度不能超過證據。
使用者自己留下的未知必須保留；沒有就 unknown=""。不要寫模式／人格／你通常。

${journalBlock(ctx, body)}

${dialogue}

【已死亡的假設｜close 也不能寫回去】
${rejected.length ? rejected.map((item) => `- ${item.note}`).join("\n") : "（無）"}

【使用者自己留下的未知】
${userUnknowns.length ? userUnknowns.map((item) => `- ${item}`).join("\n") : "（沒有。unknown 必須是空字串）"}

已完成 ${answered.length} 輪。`;
  }

  const phase =
    callIndex === 1
      ? "第 1 題。readyToClose=false。優先 open question。不要先塞 A 還是 B。"
      : callIndex === 2
        ? "已答 1 題。若已清楚／只是累／只是客觀／幸福瞬間已出口：close。否則承接上一答新詞再問一題。"
        : `已答 ${answered.length} 題。預設 close。只有 fork / userUnknown / contradiction / decisionFact 才准第 3 題。把已知再抽象、再確認、要不要說、你通常：全部 close。`;

  const lastLine = lastAnswer
    ? `上一答：「${compact(lastAnswer, 160)}」。下一題優先抓他新說出的詞，不要跳回你自己的路線。`
    : "第 1 題。從今天原文找一個真正未知。讓他自己定義，不要先給兩個選項。";

  return `V2。${phase}

${lastLine}

【已死亡的假設｜禁止再問】
${rejected.length ? rejected.map((item) => `- ${item.note}`).join("\n") : "（無）"}

【使用者剛提出的新資訊｜下一題優先承接】
${signals.length ? signals.map((item) => `- ${item}`).join("\n") : "（這一輪還沒有新詞）"}

${journalBlock(ctx, body)}

${dialogue}

只輸出這一輪 JSON。不要給行動。`;
}

function shouldCloseThinkV2(options) {
  const answered = Number(options && options.answeredCount) || 0;
  const ready = Boolean(options && options.readyToClose);
  const hasQuestion = Boolean(String((options && options.question) || "").trim());
  const gain = Number(options && options.informationGain);
  if (answered >= MAX_ROUNDS) return true;
  if (answered >= 1 && ready && !hasQuestion) return true;
  if (Number(options && options.callIndex) >= MAX_ROUNDS) {
    if (!hasQuestion || gain !== 2) return true;
  }
  return false;
}

function clampQuestion(text) {
  let next = String(text || "").replace(/\s+/g, " ").trim();
  if (!next) return "";
  if (!/[？?]$/.test(next)) next = `${next.replace(/[。.!！]+$/g, "")}？`;
  return next;
}

function normalizeThinkV2Ask(raw, body) {
  const data = raw && typeof raw === "object" ? raw : {};
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const callIndex = thinkV2CallIndex(body);
  let question = clampQuestion(data.question || data.prompt || "");
  let readyToClose = Boolean(data.readyToClose || data.close);
  const unknown = String(data.unknown || "").replace(/\s+/g, " ").trim();
  const claimedGain = VALID_GAIN.includes(data.gainKind) ? data.gainKind : GAIN_NONE;
  const answered = answeredRounds(ctx.rounds).length;
  const gain = scoreInformationGain({
    question,
    rounds: ctx.rounds,
    ctx,
    callIndex,
    gainKind: claimedGain,
  });

  if (callIndex <= 1) readyToClose = false;
  if (callIndex === 2 && heuristicEarlyClose(ctx, body, ctx.rounds)) {
    readyToClose = true;
    question = "";
  }
  if (question && questionRevivesRejected(question, ctx.rounds) && callIndex >= 2) {
    readyToClose = true;
    question = "";
  }
  if (callIndex >= MAX_ROUNDS && gain.score !== 2) {
    readyToClose = true;
    question = "";
  }
  if (readyToClose) question = "";
  const finalGain = question
    ? gain
    : { score: 0, reason: readyToClose ? "close" : "empty", gainKind: GAIN_NONE };

  return {
    step: "ask",
    variant: "think-v2",
    callIndex,
    observation: String(data.observation || "").replace(/\s+/g, " ").trim().slice(0, 36),
    question,
    hint: String(data.hint || "").replace(/\s+/g, " ").trim().slice(0, 20),
    unknown: readyToClose ? "" : unknown,
    gainKind: question ? finalGain.gainKind : GAIN_NONE,
    userSignal: String(data.userSignal || "").replace(/\s+/g, " ").trim().slice(0, 40),
    informationGain: question ? finalGain.score : 0,
    informationGainReason: finalGain.reason,
    readyToClose,
    focus: String(data.focus || "").trim() || "unknown",
    answeredCount: answered,
  };
}

function stripInventedDepth(text) {
  return String(text || "")
    .replace(/[^。！？\n]*問題解決模式[^。！？\n]*[。！？]?/g, "")
    .replace(/[^。！？\n]*二次(解讀|情緒)[^。！？\n]*[。！？]?/g, "")
    .replace(/[^。！？\n]*你習慣(進入|性)?[^。！？\n]*[。！？]?/g, "")
    .replace(/[^。！？\n]*長期以來[^。！？\n]*[。！？]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeThinkV2Close(raw, body) {
  const data = raw && typeof raw === "object" ? raw : {};
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const stuck = stripInventedDepth(data.stuck || data.awareness || "");
  const seen = stripInventedDepth(data.seen || data.selfSeen || "");
  let unknown = stripInventedDepth(data.unknown || "");
  const hasRounds = Array.isArray(ctx.rounds);
  const userUnknowns = hasRounds ? extractUserUnknowns(ctx.rounds) : [];
  if (hasRounds) {
    if (!unknown && userUnknowns.length) unknown = userUnknowns.join("；");
    if (unknown && userUnknowns.length) {
      const grounded = userUnknowns.some((item) => unknown.includes(item.slice(0, 6)) || item.includes(unknown.slice(0, 6)));
      if (!grounded) unknown = userUnknowns.join("；");
    }
    if (unknown && !userUnknowns.length) unknown = "";
  }
  const title = String(data.title || "").replace(/\s+/g, " ").trim() || "今天真正值得看的那一層";
  return {
    step: "close",
    variant: "think-v2",
    title,
    stuck,
    seen,
    unknown,
    awareness: stuck,
    selfSeen: seen,
    takeaway: unknown,
    actions: [],
  };
}

function isThinkV2Request(body) {
  return body?.variant === "think-v2" || body?.context?.variant === "think-v2";
}

function thinkV2Step(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  return String(body?.step || ctx.step || "ask") === "close" ? "close" : "ask";
}

function thirdAskPreconditions(ctx, rounds) {
  return lastAnswerHasOpenUnknown(rounds) || contradictionStillOpen(ctx, rounds) || majorDecisionMissingFact(ctx, rounds);
}

function shouldSkipThinkV2Ask(body) {
  if (thinkV2Step(body) === "close") return false;
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const answered = answeredRounds(ctx.rounds).length;
  if (answered < 1) return false;
  if (heuristicEarlyClose(ctx, body, ctx.rounds)) return true;
  if (answered >= 2 && !thirdAskPreconditions(ctx, ctx.rounds)) return true;
  return false;
}

module.exports = {
  THINK_V2_ASK_SYSTEM,
  THINK_V2_CLOSE_SYSTEM,
  MIN_ROUNDS,
  MAX_ROUNDS,
  isThinkV2Request,
  thinkV2Step,
  thinkV2UserPrompt,
  thinkV2CallIndex,
  shouldCloseThinkV2,
  normalizeThinkV2Ask,
  normalizeThinkV2Close,
  answeredRounds,
  formatThanks,
  formatBody,
  deniedAssumptions,
  rejectedHypotheses,
  questionRevivesRejected,
  userIntroducedSignals,
  extractUserUnknowns,
  scoreInformationGain,
  shouldSkipThinkV2Ask,
  heuristicEarlyClose,
  thirdAskPreconditions,
};
