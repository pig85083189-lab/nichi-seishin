const EXEC_DEEP_MAX = 2;

const GENERIC_ACTION_RE =
  /好好溝通|多愛自己|保持覺察|相信自己|多休息|冥想|感恩|早點睡|早點睡|放鬆一下|告訴自己沒關係|找時間想一想|跨出第一步|把事情做好|跟對方好好說|好好說話|多照顧自己|學習接納|試著放鬆|靜坐|轉念|喝杯水|愛自己一下|給自己肯定/;

const CARE_CONTEXT_RE = /太累|疲憊|耗竭|睡不飽|失眠|熬夜|睡眠不足|身體.*休息|只是累|很累/;

const EXECUTION_CHOICES_SYSTEM = `你是「進行式 ING」的行動整理者。讀懂今天 01～05 已經寫下來的內容，找出真正值得往前推進的地方，直接產生 3 個具體、可執行、有意義的行動。

這是 06 執行力。
04 已經理解今天真正卡在哪。05 已經幫使用者看懂自己。
你不要再做一次 04。不要分析人格。不要寫人生願景。那些是 07 顯化力。

不要再問一長串問題。

你的任務不是：
- 把使用者原話改寫成待辦
- 再問一長串問題
- 給 generic self-care 建議
- 讓今天感覺好一點

你的任務是讓使用者覺得：
「它真的有看懂我今天發生什麼，所以知道我接下來可以做什麼。」

【生成前先內部判斷，不要寫進 JSON】
A. 今天實際發生什麼？
B. 04 真正卡住的／看見的／尚未釐清的是什麼？
C. 05 核心覺察是什麼？
D. 使用者今天已經做過或說過自己做了什麼？
E. 哪三個不同角度的 NEXT STEP，能讓事情跟現在不一樣？

【優先讀】
1. 05 核心覺察、我看見了、使用者確認的內容
2. 04 真正卡點／seen／unresolved unknown，以及使用者自己回答的重要內容
3. 今日事件與使用者原話
4. 其他有必要的身心資訊

【固定產出 3 個行動】
必須剛好 3 個。三個要有不同推進角度，不要同一件事拆三句。
禁止近義重複，例如「早點睡／提早上床／不要太晚睡」算同一件事。
例如不要變成：寫下來／想一想／說出來，其實都在做同一件事。
可依情境選擇不同角度：釐清、驗證、觀察、溝通、界線、實際完成、小型實驗、決策準備、確認資訊、改變做法、復盤結果、身體照顧（真的相關才用）。不是固定每次套三類。

【每個行動必須】
1. 回扣今天真正發生的事情
2. 回扣 04／05 已經看見的核心
3. 使用者真的做得到
4. 明確知道要做什麼
5. 不能只是漂亮的概念
6. 不能只是把使用者原話換句話說
7. 不能重複今天已經做過的事情
8. 三個行動要有不同價值

text：約 8～18 個中文字，要看得懂「我要做什麼」。
detail：1～3 個短句，必須提供「怎麼做」或「做的時候要注意什麼」。不能只是解釋 title。

【禁止只是重複】
如果使用者寫「想跟媽媽好好說話」，禁止再給「跟媽媽好好說話／找時間溝通／表達感受」。
要給他還沒想到、能改變下一步的做法。

【禁止把已經做過的事再當下一步】
如果使用者已經說過、已經溝通過、已經做過：下一步必須是 NEXT STEP，不是 REPEAT PREVIOUS STEP。
例如已經說了但對方沒理解：不要再叫他去說。要問為什麼沒對上、下次改哪個方法、還缺什麼資訊。

【禁止 generic】
禁止單獨成為行動：好好溝通、多愛自己、保持覺察、相信自己、多休息、冥想、感恩、早點睡、放鬆一下、告訴自己沒關係、找時間想一想、跨出第一步、把事情做好、跟對方好好說、好好說話、多照顧自己、學習接納、試著放鬆、靜坐、轉念。
自我照顧（早睡、散步、靜坐、喝水、轉念、說感謝）只有在今天核心真的指向身體／休息／情緒恢復時才能當主行動。
如果核心是界線、關係、工作、選擇、被忽略、渴望被看見、努力沒被看見、不敢表達、反覆忍耐、無法改變的環境：禁止只用感恩、轉念、靜坐、喝水、早睡、相信自己來取代真正要面對的問題。
若核心是「很努力但重要的人沒有看見」：下一步優先是具體表達、確認自己的需求、觀察下次互動，而不是自我打氣。

【幸福的一天】
不要硬找問題，不要製造焦慮。行動可以是保存／延續真正有價值的生活行為。

【重大人生選擇】
禁止因為一次情緒事件就叫使用者分手、離職、搬家、斷絕關係、做重大財務決定。
若深度思考涉及這些：下一步優先是觀察、釐清、記錄、建立判斷標準、溝通、低風險實驗。目標是讓使用者更清楚，不是 AI 幫他決定人生。

不要問句。永遠不要輸出「我想自己寫」。
needFollowup 必須是 false。不要出追問。直接給 3 個行動。

只輸出 JSON：
{
  "needFollowup": false,
  "question": "",
  "placeholder": "",
  "options":[{"id":"e1","text":"...","detail":"...","kind":"observe","horizon":"next"}]
}
kind 可選：observe、verify、review、express、boundary、decide、experiment、act、care。
horizon 可選：next、week。
繁體中文`;

const EXEC_DEEP_ASK_SYSTEM = `你是「進行式 ING」的行動整理者。使用者已經有 3 個下一步，現在主動想把下一步想得更準。

這是 06 的深度思考，不是 04。
04 已經理解今天卡在哪。這裡只服務於：
- 行動
- 選擇
- 優先順序
- 尚未釐清的執行條件
- 真正希望改變的結果
- 可能阻礙執行的現實因素

禁止再問：
「你真正的感受是什麼？」
「這件事讓你想到什麼？」
「你為什麼會這樣？」
「這背後代表什麼？」

一次只出 1 個問題。短、直接、白話。答案必須有機會改變下一步。
不要為了完整而硬問。不要預設每次都二分。

【輪數】
最多 2 題。絕對沒有第 3 題。
第 1 題：問一個會讓這 3 個行動更準的未知。
第 2 題：只有當第 1 題答案之後，仍存在一個會真正改變 action 的重要未知，才問。否則 question=""，readyToClose=true。

只輸出 JSON。繁體中文。
{
  "question": "一個白話疑問句，16-56 字。結束時 \\"\\"",
  "placeholder": "可空。短提示",
  "readyToClose": false
}`;

const EXEC_DEEP_CLOSE_SYSTEM = `你是「進行式 ING」的行動整理者。使用者剛完成 06 深度思考。請一次產出最終結果。

同時回傳：
1. executionSummary：一句執行力總結
2. options：剛好 3 個最終行動

【executionSummary】
把深度思考後真正值得執行的核心，濃縮成一句簡單、直接、有重點的話。
不是鼓勵語、療癒語、金句、05 覺察重述、情緒安慰。
1 句。繁體中文。約 18～35 個中文字。超過 35 字就太長，再壓縮。
短、直接、有判斷。看完知道這次真正要往哪裡走。
是判斷，不是把三個行動縮成一句，也不是重講 05。
必須根據今天內容＋06 深度回答。
禁止：相信自己、勇敢踏出下一步、變得更好、好好照顧自己、透過溝通與覺察。
禁止 AI 腔、雞湯、空泛。

【options】
這 3 個不是原本行動換句話說。
必須吸收：今日事件、04 核心、05 覺察、原本 3 個行動、使用者選過哪些、Q1／Q2 回答、deep 裡新說出的資訊。
重新判斷：現在真正值得執行的 3 件事是什麼？
每個有 text（8～18 字）與 detail（1～3 短句，寫怎麼做）。
禁止 generic。禁止只重複原話。禁止把已經做過的事再當下一步。
三個要有不同推進價值。
重大決定不直接替使用者決定。
已經被使用者選入執行力、且仍然成立的方向：不要再產出幾乎一樣的句子。

只輸出 JSON：
{
  "executionSummary": "...",
  "options":[{"id":"f1","text":"...","detail":"...","kind":"act","horizon":"next"}]
}
繁體中文`;

const EXEC_DEEP_REFRESH_SYSTEM = EXEC_DEEP_CLOSE_SYSTEM;

function compactLine(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const limit = Number(max) || 220;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function isExecDeepRequest(body) {
  const kind = String(body?.kind || body?.scope || body?.step || "").trim().toLowerCase();
  const variant = String(body?.variant || body?.context?.variant || "").trim().toLowerCase();
  return kind === "execution-deep" || kind === "exec-deep" || variant === "exec-deep" || variant === "execution-deep";
}

function execDeepStep(body) {
  const step = String(body?.step || body?.context?.step || "").trim().toLowerCase();
  if (step === "refresh" || step === "close" || step === "final") return "close";
  return "ask";
}

function emptyExecDeep() {
  return { status: "", rounds: [], draftAnswer: "", refreshedAt: "", executionSummary: "", finalOptions: [], finalSelectedIds: [] };
}

function normalizeExecutionSummary(raw) {
  let text = String(raw || "").replace(/\s+/g, " ").trim().replace(/^「|」$/g, "").replace(/^"|"$/g, "");
  if (!text) return "";
  if (/相信自己|勇敢踏出|變得更好|好好照顧自己|透過溝通與覺察/.test(text)) return "";
  if (text.length > 48) text = text.slice(0, 48);
  return text;
}

function normalizeExecDeepRound(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const question = String(src.question || "").trim();
  const answer = String(src.answer || "").trim();
  const placeholder = String(src.placeholder || "").trim();
  if (!question && !answer) return null;
  return {
    id: String(src.id || `d${index + 1}`).trim() || `d${index + 1}`,
    question,
    answer,
    placeholder,
  };
}

function normalizeExecDeep(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rounds = (Array.isArray(src.rounds) ? src.rounds : [])
    .map((item, index) => normalizeExecDeepRound(item, index))
    .filter(Boolean)
    .slice(0, EXEC_DEEP_MAX);
  const asking = rounds.some((item) => item.question && !item.answer);
  const answeredAll = rounds.length > 0 && rounds.every((item) => item.answer) && !asking;
  const closed =
    String(src.status || "").trim() === "closed" ||
    rounds.length >= EXEC_DEEP_MAX && answeredAll;
  let status = "";
  if (asking || (String(src.status || "").trim() === "asking" && !closed)) status = "asking";
  if (closed) status = "closed";
  const finalOptions = (Array.isArray(src.finalOptions) ? src.finalOptions : Array.isArray(src.options) && src.executionSummary ? src.options : [])
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || item.title || "").trim();
      if (!text) return null;
      const next = { id: String(item.id || `f${index + 1}`).trim() || `f${index + 1}`, text };
      if (item.detail) next.detail = String(item.detail).trim();
      if (item.kind) next.kind = String(item.kind).trim();
      if (item.horizon) next.horizon = String(item.horizon).trim();
      return next;
    })
    .filter(Boolean)
    .slice(0, 3);
  const finalIds = new Set(finalOptions.map((item) => item.id));
  const finalSelectedIds = (Array.isArray(src.finalSelectedIds) ? src.finalSelectedIds : [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && finalIds.has(id));
  return {
    status,
    rounds,
    draftAnswer: String(src.draftAnswer || "").trim(),
    refreshedAt: String(src.refreshedAt || "").trim(),
    executionSummary: normalizeExecutionSummary(src.executionSummary),
    finalOptions,
    finalSelectedIds,
  };
}

function hasMeaningfulExecDeep(value) {
  const deep = normalizeExecDeep(value);
  return (
    deep.rounds.length > 0 ||
    Boolean(deep.draftAnswer) ||
    Boolean(deep.status) ||
    Boolean(deep.executionSummary) ||
    deep.finalOptions.length > 0
  );
}

function hasExecDeepFinal(deep) {
  const data = normalizeExecDeep(deep);
  return Boolean(data.executionSummary) && data.finalOptions.length >= 3;
}

function execDeepAnsweredRounds(deep) {
  return normalizeExecDeep(deep).rounds.filter((item) => String(item.answer || "").trim());
}

function execDeepCurrentQuestion(deep) {
  const data = normalizeExecDeep(deep);
  return data.rounds.find((item) => item.question && !String(item.answer || "").trim()) || null;
}

function execDeepClosed(deep) {
  const data = normalizeExecDeep(deep);
  if (data.status === "closed") return true;
  const answered = execDeepAnsweredRounds(data);
  return answered.length >= EXEC_DEEP_MAX;
}

function isCareContext(ctx) {
  const blob = [
    ctx && ctx.event,
    ctx && ctx.mood,
    ctx && ctx.awarenessLine,
    ctx && ctx.awarenessSeen,
    ctx && ctx.thinkCloseAwareness,
    ctx && ctx.thinkCloseSelfSeen,
    ...(asList(ctx && ctx.thinkSelected)),
  ]
    .join(" ");
  return CARE_CONTEXT_RE.test(blob);
}

function looksGenericExecAction(text, detail, ctx) {
  const blob = `${text || ""}${detail || ""}`;
  if (!GENERIC_ACTION_RE.test(blob)) return false;
  if (isCareContext(ctx) && /睡|休息|恢復|上床|關掉螢幕/.test(blob)) return false;
  return true;
}

function extractAlreadyDone(ctx) {
  const chunks = [
    ctx && ctx.event,
    ctx && ctx.alreadyDone,
    ...(asList(ctx && ctx.thinkSelected)),
    ...(asList(ctx && ctx.awarenessSelected)),
    ctx && ctx.thinkCloseAwareness,
    ctx && ctx.awarenessLine,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const lines = [];
  const re = /([^。！？\n]{4,80}(?:已經|說過|做了|試過|溝通過|表達過|寫過|處理過)[^。！？\n]{0,40}[。！？]?)/g;
  chunks.forEach((chunk) => {
    String(chunk)
      .split(/[\n]+/)
      .forEach((line) => {
        const text = line.trim();
        if (!text) return;
        if (/已經|說過|做了|試過|溝通過|表達過|寫過|處理過/.test(text)) lines.push(compactLine(text, 80));
        let match;
        re.lastIndex = 0;
        while ((match = re.exec(text))) {
          const piece = String(match[1] || "").trim();
          if (piece && !lines.includes(piece)) lines.push(compactLine(piece, 80));
        }
      });
  });
  return Array.from(new Set(lines)).slice(0, 6);
}

function looksParaphraseOfUser(userBlob, actionText) {
  const action = String(actionText || "").replace(/\s+/g, "").trim();
  const blob = String(userBlob || "").replace(/\s+/g, "").trim();
  if (!action || action.length < 6 || !blob) return false;
  if (blob.includes(action)) return true;
  const soft = action.replace(/先|再|一下|自己|真正|好好/g, "");
  return Boolean(soft.length >= 6 && blob.includes(soft));
}

function shouldSkipExecDeepAsk(deep, actions) {
  const data = normalizeExecDeep(deep);
  const answered = execDeepAnsweredRounds(data);
  if (answered.length >= EXEC_DEEP_MAX) return true;
  if (data.status === "closed") return true;
  if (answered.length < 1) return false;
  const last = String(answered[answered.length - 1].answer || "").trim();
  if (!last) return false;
  if (/還不[知道確定清]|還沒想|不確定|搞不清楚|兩個都|還是不知道/.test(last)) return false;
  if (last.replace(/\s+/g, "").length < 8) return false;
  const titles = (Array.isArray(actions) ? actions : [])
    .map((item) => String(item && (item.text || item.title) || "").trim())
    .filter(Boolean);
  const picked = titles.some((title) => last.includes(title.slice(0, 6)));
  const decided = /就選|先做|最想|最重要|第一個|第二個|第三個|如果做到/.test(last);
  const clear = /就是|我要|先把|下次/.test(last) && last.replace(/\s+/g, "").length >= 12;
  return picked || decided || clear;
}

function formatExecutionStory(ctx, body) {
  const thanks = String(ctx.thanksText || ctx.thanks || "").trim() || "未寫";
  const event = compactLine(ctx.event || (body && body.text), 800) || "（未寫）";
  const mood = String(ctx.mood || "").trim() || "未選";
  const bodyNote = [ctx.bodyNote, Array.isArray(ctx.bodyTags) ? ctx.bodyTags.join("、") : ""]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("／");
  return `今日感謝：
${thanks}
今日事件：${event}
心情：${mood}
身心：${bodyNote || "未寫"}`;
}

function executionChoicesUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const v2 = String(ctx.thinkVariant || "") === "think-v2";
  const already = extractAlreadyDone(ctx);
  const thinkSaid = asList(ctx.thinkSelected);
  const awarePicked = asList(ctx.awarenessSelected);
  const kept = asList(ctx.keptActions);
  return `請根據今天真正挖到的核心，固定生成 3 個下一步。不要先套模板。不要再分析人格。不要寫顯化願景。不要再問問題。needFollowup=false。

禁止只把使用者原話換句話說。禁止把已經做過的事再當下一步。禁止 generic self-care，除非今天核心真的是恢復。
三個行動必須有不同推進角度。每個 option 必須有 text（約 8～18 字）與 detail（1～3 個短句，寫怎麼做或做的時候要注意什麼）。

【05 核心覺察】${String(ctx.awarenessLine || "").trim() || "未寫"}
【05 我看見了】${String(ctx.awarenessSeen || "").trim() || "未寫"}
【05 使用者確認】
${awarePicked.length ? awarePicked.map((item, index) => `${index + 1}. ${item}`).join("\n") : "尚未確認"}

【04 ${v2 ? "真正卡住的" : "勾選／卡住的"}】${String(ctx.thinkCloseAwareness || "").trim() || "未寫"}
【04 今天看見的】${String(ctx.thinkCloseSelfSeen || "").trim() || "未寫"}
【04 尚未釐清】${String(ctx.thinkCloseTakeaway || "").trim() || "沒有"}
【04 使用者自己說出的】
${thinkSaid.length ? thinkSaid.map((item, index) => `${index + 1}. ${item}`).join("\n") : "尚未寫下"}

【今天已經做過或說過的｜禁止再當 next step】
${already.length ? already.map((item) => `- ${item}`).join("\n") : "未特別提到已經做過的事"}
${kept.length ? `【已選入執行力、不要改寫】\n${kept.map((item) => `- ${item}`).join("\n")}` : ""}

【今天的輸入】
${formatExecutionStory(ctx, body)}`;
}

function execDeepUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const actions = Array.isArray(ctx.actions) ? ctx.actions : [];
  const deep = normalizeExecDeep(ctx.deep);
  const answered = execDeepAnsweredRounds(deep);
  const round = answered.length + 1;
  const actionBlock = actions.length
    ? actions
        .map((item, index) => {
          const title = String(item && (item.text || item.title) || "").trim();
          const detail = String(item && item.detail || "").trim();
          return `${index + 1}. ${title}${detail ? `\n   ${detail}` : ""}`;
        })
        .join("\n")
    : "（尚無）";
  const qa = answered
    .map((item, index) => `Q${index + 1}：${item.question}\n回答：${item.answer}`)
    .join("\n\n");
  return `這是 06 深度思考第 ${round}/${EXEC_DEEP_MAX} 題。只問 1 題。答案必須有機會改變下一步。不要重做 04。

【現有 3 個行動】
${actionBlock}

【今天核心】
05：${compactLine(ctx.awarenessLine || ctx.awarenessSeen, 160) || "未寫"}
04 卡住：${compactLine(ctx.thinkCloseAwareness, 120) || "未寫"}
04 看見：${compactLine(ctx.thinkCloseSelfSeen, 120) || "未寫"}
事件：${compactLine(ctx.event || (body && body.text), 220) || "未寫"}

【已問過】
${qa || "（還沒問）"}

若上一答已經足以讓行動更清楚：question=""，readyToClose=true。
禁止第 3 題。`;
}

function execCloseUserPrompt(body) {
  const ctx = body && body.context && typeof body.context === "object" ? body.context : {};
  const kept = Array.isArray(ctx.keptActions) ? ctx.keptActions : [];
  const original = Array.isArray(ctx.actions) ? ctx.actions : [];
  const deep = normalizeExecDeep(ctx.deep);
  const qa = execDeepAnsweredRounds(deep)
    .map((item, index) => `Q${index + 1}：${item.question}\n回答：${item.answer}`)
    .join("\n\n");
  const list = (items) =>
    items.length
      ? items
          .map((item, index) => {
            const title = String(item && (item.text || item.title) || item || "").trim();
            const detail = String(item && item.detail || "").trim();
            return `${index + 1}. ${title}${detail ? `\n   ${detail}` : ""}`;
          })
          .join("\n")
      : "（無）";
  return `請一次產出最終執行力：executionSummary 一句＋剛好 3 個新的最終行動。
不要只是把原本 3 個換句話說。不要再問問題。
已選入執行力的行動不要再產出幾乎一樣的句子。

【原本 3 個行動】
${list(original)}

【已選入執行力】
${list(kept)}

【06 深度思考回答】
${qa || "（無）"}

${executionChoicesUserPrompt(body)}`;
}

function execRefreshUserPrompt(body) {
  return execCloseUserPrompt(body);
}

function mergeRefreshedExecOptions(currentOptions, selectedIds, incoming, customId) {
  const current = Array.isArray(currentOptions) ? currentOptions : [];
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).filter((id) => id && id !== (customId || "custom")));
  const kept = current.filter((item) => selected.has(item.id));
  const keptTexts = new Set(kept.map((item) => String(item.text || "").trim()));
  const next = kept.slice();
  (Array.isArray(incoming) ? incoming : []).forEach((item, index) => {
    if (next.length >= 3) return;
    const text = String(item && (item.text || item.title) || "").trim();
    if (!text || keptTexts.has(text)) return;
    let id = String(item && item.id || `e${index + 1}`).trim() || `e${index + 1}`;
    if (next.some((entry) => entry.id === id) || selected.has(id)) id = `n${next.length + 1}`;
    next.push({ ...item, id, text });
    keptTexts.add(text);
  });
  return next.slice(0, 3);
}

module.exports = {
  EXEC_DEEP_MAX,
  GENERIC_ACTION_RE,
  EXECUTION_CHOICES_SYSTEM,
  EXEC_DEEP_ASK_SYSTEM,
  EXEC_DEEP_CLOSE_SYSTEM,
  EXEC_DEEP_REFRESH_SYSTEM,
  isExecDeepRequest,
  execDeepStep,
  emptyExecDeep,
  normalizeExecDeep,
  hasMeaningfulExecDeep,
  hasExecDeepFinal,
  normalizeExecutionSummary,
  execDeepAnsweredRounds,
  execDeepCurrentQuestion,
  execDeepClosed,
  shouldSkipExecDeepAsk,
  looksGenericExecAction,
  looksParaphraseOfUser,
  extractAlreadyDone,
  isCareContext,
  executionChoicesUserPrompt,
  execDeepUserPrompt,
  execCloseUserPrompt,
  execRefreshUserPrompt,
  mergeRefreshedExecOptions,
  compactLine,
};
