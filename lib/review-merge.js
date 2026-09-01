(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiReviewMerge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const InternalTest =
    (typeof require === "function" ? require("./internal-test") : null) ||
    (typeof globalThis !== "undefined" ? globalThis.NichiInternalTest : null) ||
    {};

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function hasMeaningfulValue(value) {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
    if (typeof value === "object") {
      return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
    }
    return false;
  }

  function hasMeaningfulGuideRound(round) {
    if (!isPlainObject(round)) return false;
    return (
      hasMeaningfulValue(round.question) ||
      hasMeaningfulValue(round.answer) ||
      hasMeaningfulValue(round.hint) ||
      hasMeaningfulValue(round.title) ||
      hasMeaningfulValue(round.reply)
    );
  }

  function hasMeaningfulGuide(guide) {
    if (!isPlainObject(guide)) return false;
    const rounds = Array.isArray(guide.rounds) ? guide.rounds : [];
    if (rounds.some(hasMeaningfulGuideRound)) return true;
    const close = guide.close && typeof guide.close === "object" ? guide.close : {};
    return (
      hasMeaningfulValue(guide.summary) ||
      hasMeaningfulValue(guide.awareness) ||
      hasMeaningfulValue(guide.selfSeen) ||
      hasMeaningfulValue(guide.takeaway) ||
      hasMeaningfulValue(guide.direction) ||
      hasMeaningfulValue(guide.actions) ||
      hasMeaningfulValue(guide.title) ||
      hasMeaningfulValue(close.coreConclusion) ||
      hasMeaningfulValue(close.blindSpot) ||
      hasMeaningfulValue(close.improvementDirection) ||
      hasMeaningfulValue(guide.coreQuote) ||
      ((guide.status === "silence" || guide.status === "empty") && hasMeaningfulValue(guide.sourceSig)) ||
      hasMeaningfulValue(guide.discovery && guide.discovery.statement) ||
      hasMeaningfulValue(guide.understand && (guide.understand.focus || guide.understand.convergence || guide.understand.whyWorthThinking)) ||
      ((guide.understand && (guide.understand.stage === "stop" || guide.understand.stage === "converged")) && hasMeaningfulValue(guide.sourceSig)) ||
      (Array.isArray(guide.questions) && guide.questions.some((item) => hasMeaningfulValue(item && (item.text || item.question || item)))) ||
      hasMeaningfulReflectionExtension(guide.extension)
    );
  }

  function hasMeaningfulInsightBlocks(insight) {
    if (!isPlainObject(insight)) return false;
    return (
      hasMeaningfulValue(insight.psychology) ||
      hasMeaningfulValue(insight.analysis) ||
      hasMeaningfulValue(insight.conclusion) ||
      hasMeaningfulValue(insight.summary) ||
      hasMeaningfulValue(insight.reflection) ||
      hasMeaningfulValue(insight.suggestions) ||
      hasMeaningfulValue(insight.takeaways) ||
      hasMeaningfulValue(insight.title) ||
      hasMeaningfulValue(insight.bodyLink)
    );
  }

  function hasMeaningfulInsight(insight) {
    if (!isPlainObject(insight)) return false;
    if (hasMeaningfulGuide(insight.guide)) return true;
    if (hasMeaningfulInsightBlocks(insight)) return true;
    return Object.keys(insight).some((key) => {
      if (key === "guide") return false;
      return hasMeaningfulValue(insight[key]);
    });
  }

  function hasMeaningfulThinkHistory(thinkHistory) {
    if (!Array.isArray(thinkHistory) || !thinkHistory.length) return false;
    return thinkHistory.some((item) => {
      if (!isPlainObject(item)) return hasMeaningfulValue(item);
      return (
        hasMeaningfulValue(item.question) ||
        hasMeaningfulValue(item.reply) ||
        hasMeaningfulValue(item.insight) ||
        hasMeaningfulValue(item.title) ||
        hasMeaningfulValue(item.actions) ||
        hasMeaningfulValue(item.stars) ||
        (Array.isArray(item.points) &&
          item.points.some((point) => hasMeaningfulValue(point && (point.conclusion || point))))
      );
    });
  }

  function hasMeaningfulDeepSlot(slot) {
    if (!isPlainObject(slot)) return hasMeaningfulValue(slot);
    return (
      hasMeaningfulValue(slot.plain) ||
      hasMeaningfulValue(slot.deep) ||
      hasMeaningfulValue(slot.followups) ||
      hasMeaningfulValue(slot.notes)
    );
  }

  function hasMeaningfulDeep(deep, deepPrompts) {
    if (Array.isArray(deep) && deep.some(hasMeaningfulDeepSlot)) return true;
    if (hasMeaningfulValue(deep) && !Array.isArray(deep)) return true;
    if (Array.isArray(deepPrompts) && deepPrompts.some((item) => hasMeaningfulValue(item))) return true;
    return false;
  }

  const CHOICE_NONE_ID = "none";
  const CHOICE_NONE_TEXT = "今天沒有特別符合我的選項";
  const CHOICE_MAX_SELECTED = 2;
  const CHOICE_OPTION_MIN = 3;
  const CHOICE_OPTION_MAX = 4;

  function emptyChoiceBag() {
    return { sourceSig: "", options: [], selectedIds: [], generatedAt: "" };
  }

  function choiceTextKey(text) {
    return String(text || "")
      .replace(/\s+/g, "")
      .replace(/[，。！？、：；「」『』（）()]/g, "");
  }

  function choicesLookSimilar(left, right) {
    const a = choiceTextKey(left);
    const b = choiceTextKey(right);
    if (!a || !b) return false;
    if (a === b) return true;
    const short = a.length <= b.length ? a : b;
    const long = a.length <= b.length ? b : a;
    if (short.length < 8) return false;
    for (let i = 0; i <= short.length - 8; i += 1) {
      if (long.includes(short.slice(i, i + 8))) return true;
    }
    return false;
  }

  function normalizeChoiceOptions(raw, options = {}) {
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.options)
        ? raw.options
        : [];
    const avoid = Array.isArray(options.avoid) ? options.avoid.map((item) => String(item || "").trim()).filter(Boolean) : [];
    const max = Math.min(CHOICE_OPTION_MAX, Math.max(0, Number(options.max) || CHOICE_OPTION_MAX));
    const items = [];
    const seen = new Set();
    list.forEach((item, index) => {
      if (items.length >= max) return;
      const text = String(item && typeof item === "object" ? item.text || item.label || item.title || "" : item || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text || text.length < 8 || text.length > 72) return;
      const idRaw = String(item && typeof item === "object" ? item.id || "" : "").trim();
      const id = idRaw && idRaw !== CHOICE_NONE_ID ? idRaw : `opt${index + 1}`;
      if (id === CHOICE_NONE_ID || text === CHOICE_NONE_TEXT) return;
      if (seen.has(id) || seen.has(text)) return;
      if (avoid.some((line) => choicesLookSimilar(line, text))) return;
      if (items.some((entry) => choicesLookSimilar(entry.text, text))) return;
      seen.add(id);
      seen.add(text);
      items.push({ id, text });
    });
    return items;
  }

  function normalizeChoiceBag(raw, options = {}) {
    const src = isPlainObject(raw) ? raw : {};
    const optionList = normalizeChoiceOptions(src.options || raw, options);
    const optionIds = new Set(optionList.map((item) => item.id));
    const none = Boolean(src.none) || (Array.isArray(src.selectedIds) && src.selectedIds.some((id) => String(id) === CHOICE_NONE_ID));
    const selectedIds = none
      ? []
      : (Array.isArray(src.selectedIds) ? src.selectedIds : [])
          .map((id) => String(id || "").trim())
          .filter((id) => id && id !== CHOICE_NONE_ID && optionIds.has(id))
          .filter((id, index, list) => list.indexOf(id) === index)
          .slice(0, CHOICE_MAX_SELECTED);
    const bag = {
      sourceSig: String(src.sourceSig || "").trim(),
      options: optionList,
      selectedIds,
      generatedAt: String(src.generatedAt || "").trim(),
    };
    if (none) bag.none = true;
    return bag;
  }

  function hasMeaningfulChoices(value) {
    if (!isPlainObject(value)) return false;
    const bag = normalizeChoiceBag(value);
    return bag.options.length > 0 || bag.selectedIds.length > 0 || bag.none === true;
  }

  function selectedChoiceTexts(value) {
    const bag = normalizeChoiceBag(value);
    if (bag.none) return [];
    const map = new Map(bag.options.map((item) => [item.id, item.text]));
    return bag.selectedIds.map((id) => map.get(id)).filter(Boolean);
  }

  const EXEC_CHOICE_CUSTOM_ID = "custom";
  const EXEC_CHOICE_CUSTOM_TEXT = "我想自己寫";
  const EXEC_CHOICE_OPTION_COUNT = 3;
  const EXEC_CHOICE_MAX_SELECTED = 3;

  function emptyExecDeep() {
    return { status: "", rounds: [], draftAnswer: "", refreshedAt: "", executionSummary: "", finalOptions: [], finalSelectedIds: [] };
  }

  function normalizeExecDeep(raw) {
    const src = isPlainObject(raw) ? raw : {};
    const rounds = (Array.isArray(src.rounds) ? src.rounds : [])
      .map((item, index) => {
        if (!isPlainObject(item)) return null;
        const question = String(item.question || "").trim();
        const answer = String(item.answer || "").trim();
        const placeholder = String(item.placeholder || "").trim();
        if (!question && !answer) return null;
        return {
          id: String(item.id || `d${index + 1}`).trim() || `d${index + 1}`,
          question,
          answer,
          placeholder,
        };
      })
      .filter(Boolean)
      .slice(0, 2);
    const asking = rounds.some((item) => item.question && !item.answer);
    const answeredAll = rounds.length > 0 && rounds.every((item) => item.answer) && !asking;
    const closed =
      String(src.status || "").trim() === "closed" ||
      (rounds.length >= 2 && answeredAll);
    let status = "";
    if (asking || (String(src.status || "").trim() === "asking" && !closed)) status = "asking";
    if (closed) status = "closed";
    const finalOptions = normalizeExecutionChoiceOptions(src.finalOptions || [], { max: 3 }).map((item, index) => ({
      ...item,
      id: /^f\d+$/.test(item.id) ? item.id : `f${index + 1}`,
    }));
    const finalIds = new Set(finalOptions.map((item) => item.id));
    const finalSelectedIds = (Array.isArray(src.finalSelectedIds) ? src.finalSelectedIds : [])
      .map((id) => String(id || "").trim())
      .filter((id, index, list) => id && finalIds.has(id) && list.indexOf(id) === index)
      .slice(0, 3);
    return {
      status,
      rounds,
      draftAnswer: String(src.draftAnswer || "").trim(),
      refreshedAt: String(src.refreshedAt || "").trim(),
      executionSummary: String(src.executionSummary || "").replace(/\s+/g, " ").trim(),
      finalOptions,
      finalSelectedIds,
    };
  }

  function hasExecDeepFinal(deep) {
    const data = normalizeExecDeep(deep);
    return Boolean(data.executionSummary) && data.finalOptions.length >= 3;
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

  function mergeExecDeep(older, newer) {
    if (!hasMeaningfulExecDeep(newer)) {
      return hasMeaningfulExecDeep(older) ? normalizeExecDeep(older) : emptyExecDeep();
    }
    if (!hasMeaningfulExecDeep(older)) return normalizeExecDeep(newer);
    const a = normalizeExecDeep(older);
    const b = normalizeExecDeep(newer);
    const finalOptions = b.finalOptions.length ? b.finalOptions : a.finalOptions;
    const optionIds = new Set(finalOptions.map((item) => item.id));
    const finalSelectedIds = (b.finalSelectedIds.length ? b.finalSelectedIds : a.finalSelectedIds).filter((id) => optionIds.has(id));
    return {
      status: b.status || a.status,
      rounds: mergeGuideRounds(a.rounds, b.rounds),
      draftAnswer: b.draftAnswer || a.draftAnswer,
      refreshedAt: b.refreshedAt || a.refreshedAt,
      executionSummary: b.executionSummary || a.executionSummary,
      finalOptions,
      finalSelectedIds,
    };
  }

  function emptyExecutionChoiceBag() {
    return { variant: "", sourceSig: "", options: [], selectedId: "", selectedIds: [], custom: "", followupQuestion: "", followupPlaceholder: "", generatedAt: "", deep: emptyExecDeep() };
  }

  function normalizeExecutionSelectedIds(src, optionIds) {
    const data = src && typeof src === "object" ? src : {};
    const ids = optionIds instanceof Set ? optionIds : new Set();
    const hasIdsField = Array.isArray(data.selectedIds);
    const rawList = hasIdsField && data.selectedIds.length
      ? data.selectedIds
      : (String(data.selectedId || "").trim()
        ? [String(data.selectedId).trim()]
        : (hasIdsField ? data.selectedIds : []));
    const next = [];
    rawList.forEach((id) => {
      const value = String(id || "").trim();
      if (!value || next.includes(value)) return;
      if (value !== EXEC_CHOICE_CUSTOM_ID && !ids.has(value)) return;
      if (next.length >= EXEC_CHOICE_MAX_SELECTED) return;
      next.push(value);
    });
    return next;
  }

  const EXEC_CHOICE_KINDS = ["observe", "verify", "review", "express", "boundary", "decide", "experiment", "act", "care"];

  function normalizeExecutionChoiceKind(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (EXEC_CHOICE_KINDS.includes(value)) return value;
    const mapped = {
      觀察: "observe",
      驗證: "verify",
      回顧: "review",
      表達: "express",
      界線: "boundary",
      決策: "decide",
      實驗: "experiment",
      行動: "act",
      自我照顧: "care",
    };
    return mapped[String(raw || "").trim()] || "";
  }

  function normalizeExecutionChoiceHorizon(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "week" || value === "this_week" || value === "這週" || value === "本週") return "week";
    if (value === "next" || value === "tomorrow" || value === "明天" || value === "下次") return "next";
    return "";
  }

  function clipExecutionChoiceDetail(raw, title) {
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const heading = String(title || "").replace(/\s+/g, " ").trim();
    if (heading && (text === heading || choicesLookSimilar(text, heading))) return "";
    const sentences = [];
    let buf = "";
    Array.from(text).forEach((ch) => {
      buf += ch;
      if ("。！？!?".includes(ch)) {
        const next = buf.trim();
        if (next) sentences.push(next);
        buf = "";
      }
    });
    if (buf.trim()) sentences.push(buf.trim());
    const kept = (sentences.length ? sentences.slice(0, 3) : [text]).join("");
    return kept.length > 420 ? kept.slice(0, 420) : kept;
  }

  function executionChoiceOptionExtras(item, title) {
    if (!item || typeof item !== "object") return {};
    const extras = {};
    const detail = clipExecutionChoiceDetail(item.detail || item.how || item.lead, title);
    if (detail) extras.detail = detail;
    const kind = normalizeExecutionChoiceKind(item.kind || item.type);
    if (kind) extras.kind = kind;
    const horizon = normalizeExecutionChoiceHorizon(item.horizon || item.when);
    if (horizon) extras.horizon = horizon;
    return extras;
  }

  function insightExecutionFallbackOptions(blob) {
    const text = String(blob || "");
    const exhausted = /睡不飽|失眠|熬夜|太累|疲憊|耗竭|精神不佳|睡眠不足|身體.*休息/.test(text);
    const boundary = /界線|只能接受|無法改變|不敢表達|被忽略|忍耐|臨界/.test(text);
    const work = /工作|任務|專案|截止|開會|拖延|忙碌|卡關/.test(text);
    const unseen = /希望被看見|沒有看見|沒被看見|自己知道就好|努力.{0,12}看見|看見我的努力/.test(text);
    const relate = /溝通|表達|對方|伴侶|吵架|關係/.test(text);
    const careOk = exhausted && !boundary && !work && !unseen && !relate;
    if (careOk) {
      return [
        {
          id: "e1",
          text: "今晚洗完澡後就直接準備上床",
          detail: "設一個固定關掉螢幕的時間。到點就把手機放到床以外，躺下就算完成。",
          kind: "care",
          horizon: "next",
        },
        {
          id: "e2",
          text: "先把明天只留一件必做",
          detail: "睡前寫下明天唯一非做不可的一件事，其他先不排。降低明天一醒來就被清單壓住的感覺。",
          kind: "decide",
          horizon: "next",
        },
        {
          id: "e3",
          text: "記下是哪一段最耗神",
          detail: "回想今天從什麼時候開始明顯沒電。只記時間和當時在做什麼，不用分析原因。",
          kind: "observe",
          horizon: "next",
        },
      ];
    }
    if (boundary) {
      return [
        {
          id: "e1",
          text: "記下真正不舒服的瞬間",
          detail: "下次環境再讓你明顯不舒服時，先不要急著告訴自己接受就好。寫下剛剛發生什麼、哪一個瞬間最受不了。",
          kind: "observe",
          horizon: "next",
        },
        {
          id: "e2",
          text: "對照自己能不能再繼續",
          detail: "回想一次以前也覺得只能接受的經驗，寫下當時讓你知道不能再繼續的具體訊號，再拿這週的生活來對照。",
          kind: "review",
          horizon: "week",
        },
        {
          id: "e3",
          text: "先標出這次能退的一步",
          detail: "寫下這週如果再碰到同樣情況，你願意少做或晚回的最小一件事。先寫，不必立刻宣布。",
          kind: "boundary",
          horizon: "next",
        },
      ];
    }
    if (work) {
      return [
        {
          id: "e1",
          text: "先推進卡住的那一件",
          detail: "明天一開始就只處理今天真正卡住的那件工作，先做到一個可以交出去的最小版本。",
          kind: "act",
          horizon: "next",
        },
        {
          id: "e2",
          text: "寫下做到哪裡算過關",
          detail: "今晚先寫下明天這件事做到哪個程度就算完成，避免又把範圍愈拉愈大。",
          kind: "decide",
          horizon: "next",
        },
        {
          id: "e3",
          text: "問清楚這次的完成標準",
          detail: "下次規格再改之前，先問對方：這次交出去時，哪三項必須對、哪一項可以之後再改。",
          kind: "verify",
          horizon: "next",
        },
      ];
    }
    if (unseen) {
      return [
        {
          id: "e1",
          text: "寫下希望被看見的那件",
          detail: "先寫一句你真正希望對方知道的話：你具體做了什麼、為什麼對你重要。先寫下來，不一定今晚就說出口。",
          kind: "express",
          horizon: "next",
        },
        {
          id: "e2",
          text: "觀察「自己知道就好」出現時",
          detail: "這週當你又想告訴自己「我自己知道就好」時，停一下，記下那一刻你其實希望被看見的是什麼。",
          kind: "observe",
          horizon: "week",
        },
        {
          id: "e3",
          text: "選一個最小的被看見方式",
          detail: "在「自己消化」和「一次講完」之間，選一個你明天做得到的：傳一句具體成果，或約一個短時間只講這一件。",
          kind: "experiment",
          horizon: "next",
        },
      ];
    }
    if (relate) {
      return [
        {
          id: "e1",
          text: "寫下最希望被理解的一件",
          detail: "再次談之前，先用一句話寫清楚：如果這次對方只理解一件事，你最希望是哪一件。避免又變成一次講很多。",
          kind: "decide",
          horizon: "next",
        },
        {
          id: "e2",
          text: "先確認對方理解到哪裡",
          detail: "下次談到這件事時，不要急著重新解釋。先請對方說說目前理解的是什麼，再補真正沒對上的那一段。",
          kind: "verify",
          horizon: "next",
        },
        {
          id: "e3",
          text: "分開理解與實際改變",
          detail: "寫下這次你真正期待的是：對方理解你的感受，還是實際做法有所改變。兩個答案需要的下一步不一樣。",
          kind: "review",
          horizon: "next",
        },
      ];
    }
    return [
      {
        id: "e1",
        text: "記下今天真正卡住的點",
        detail: "今晚用兩句話寫下：今天最卡住的是什麼，以及你還不確定的是哪一件。",
        kind: "observe",
        horizon: "next",
      },
      {
        id: "e2",
        text: "選一件明天能開始的",
        detail: "從今天寫下的內容裡，只圈一件你明天 10 分鐘內做得到的，寫下何時做、做到哪裡算完成。",
        kind: "act",
        horizon: "next",
      },
      {
        id: "e3",
        text: "留下今天真正有用的一句",
        detail: "把今天最不想忘掉的那個發現，寫成一句你可以明天對照的話。不是勵志，是你自己的原話。",
        kind: "review",
        horizon: "next",
      },
    ];
  }

  function normalizeExecutionChoiceOptions(raw, options = {}) {
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.options)
        ? raw.options
        : [];
    const avoid = Array.isArray(options.avoid) ? options.avoid.map((item) => String(item || "").trim()).filter(Boolean) : [];
    const max = Math.min(EXEC_CHOICE_OPTION_COUNT, Math.max(0, Number(options.max) || EXEC_CHOICE_OPTION_COUNT));
    const items = [];
    const seen = new Set();
    list.forEach((item, index) => {
      if (items.length >= max) return;
      const text = String(item && typeof item === "object" ? item.text || item.label || item.title || "" : item || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text || text.replace(/\s+/g, "").length < 6) return;
      const idRaw = String(item && typeof item === "object" ? item.id || "" : "").trim();
      const id = idRaw && idRaw !== EXEC_CHOICE_CUSTOM_ID && idRaw !== CHOICE_NONE_ID ? idRaw : `e${index + 1}`;
      if (id === EXEC_CHOICE_CUSTOM_ID || id === CHOICE_NONE_ID || text === EXEC_CHOICE_CUSTOM_TEXT || text === CHOICE_NONE_TEXT) return;
      if (seen.has(id) || seen.has(text)) return;
      if (avoid.some((line) => choicesLookSimilar(line, text))) return;
      if (items.some((entry) => choicesLookSimilar(entry.text, text))) return;
      seen.add(id);
      seen.add(text);
      items.push({ id, text, ...executionChoiceOptionExtras(item, text) });
    });
    return items;
  }

  function normalizeExecutionChoiceBag(raw, options = {}) {
    const src = isPlainObject(raw) ? raw : {};
    const optionList = normalizeExecutionChoiceOptions(src.options || raw, options);
    const optionIds = new Set(optionList.map((item) => item.id));
    const selectedIds = normalizeExecutionSelectedIds(src, optionIds);
    return {
      variant: String(src.variant || "").trim(),
      sourceSig: String(src.sourceSig || "").trim(),
      options: optionList,
      selectedId: selectedIds[0] || "",
      selectedIds,
      custom: String(src.custom || "").trim(),
      followupQuestion: String(src.followupQuestion || "").trim(),
      followupPlaceholder: String(src.followupPlaceholder || "").trim(),
      generatedAt: String(src.generatedAt || "").trim(),
      deep: normalizeExecDeep(src.deep),
    };
  }

  function hasMeaningfulExecutionChoices(value) {
    if (!isPlainObject(value)) return false;
    const bag = normalizeExecutionChoiceBag(value);
    return (
      bag.options.length > 0 ||
      bag.selectedIds.length > 0 ||
      Boolean(bag.selectedId) ||
      Boolean(bag.custom) ||
      Boolean(bag.followupQuestion) ||
      hasMeaningfulExecDeep(bag.deep)
    );
  }

  function selectedExecutionChoiceActions(value) {
    const bag = normalizeExecutionChoiceBag(value);
    const customId = EXEC_CHOICE_CUSTOM_ID;
    const original = bag.selectedIds
      .map((id) => {
        if (id === customId) {
          const text = String(bag.custom || "").trim();
          return text ? { id, text } : null;
        }
        const match = bag.options.find((item) => item.id === id);
        const text = match ? String(match.text || "").trim() : "";
        return text ? { id, text, ...executionChoiceOptionExtras(match, text) } : null;
      })
      .filter(Boolean);
    const finals = (bag.deep && Array.isArray(bag.deep.finalSelectedIds) ? bag.deep.finalSelectedIds : [])
      .map((id) => {
        const match = (bag.deep.finalOptions || []).find((item) => item.id === id);
        const text = match ? String(match.text || "").trim() : "";
        return text ? { id, text, ...executionChoiceOptionExtras(match, text) } : null;
      })
      .filter(Boolean);
    const merged = [];
    [...original, ...finals].forEach((item) => {
      if (merged.some((prev) => choicesLookSimilar(prev.text, item.text))) return;
      merged.push(item);
    });
    return merged;
  }

  function selectedExecutionChoiceText(value) {
    const actions = selectedExecutionChoiceActions(value);
    return actions[0] ? actions[0].text : "";
  }

  function mergeExecutionChoiceBags(older, newer) {
    if (!hasMeaningfulExecutionChoices(newer)) {
      return hasMeaningfulExecutionChoices(older) ? normalizeExecutionChoiceBag(older) : newer;
    }
    if (!hasMeaningfulExecutionChoices(older)) return normalizeExecutionChoiceBag(newer);
    const a = normalizeExecutionChoiceBag(older);
    const b = normalizeExecutionChoiceBag(newer);
    const options = b.options.length ? b.options : a.options;
    const optionIds = new Set(options.map((item) => item.id));
    const source = b.options.length || b.selectedIds.length || b.selectedId || b.custom || b.followupQuestion ? b : a;
    const selectedIds = normalizeExecutionSelectedIds(source, optionIds);
    return {
      variant: b.variant || a.variant,
      sourceSig: (b.options.length ? b.sourceSig : "") || a.sourceSig || b.sourceSig,
      options,
      selectedId: selectedIds[0] || "",
      selectedIds,
      custom: source.custom || a.custom,
      followupQuestion: b.followupQuestion || a.followupQuestion,
      followupPlaceholder: b.followupPlaceholder || a.followupPlaceholder,
      generatedAt: b.generatedAt || a.generatedAt,
      deep: mergeExecDeep(a.deep, b.deep),
    };
  }

  function mergeChoiceBags(older, newer) {
    if (!hasMeaningfulChoices(newer)) return hasMeaningfulChoices(older) ? normalizeChoiceBag(older) : newer;
    if (!hasMeaningfulChoices(older)) return normalizeChoiceBag(newer);
    const a = normalizeChoiceBag(older);
    const b = normalizeChoiceBag(newer);
    const options = b.options.length ? b.options : a.options;
    const optionIds = new Set(options.map((item) => item.id));
    const source = b.options.length || b.selectedIds.length || b.none ? b : a;
    const selectedIds = source.none
      ? []
      : source.selectedIds.filter((id) => optionIds.has(id)).slice(0, CHOICE_MAX_SELECTED);
    const bag = {
      sourceSig: (b.options.length ? b.sourceSig : "") || a.sourceSig || b.sourceSig,
      options,
      selectedIds,
      generatedAt: b.generatedAt || a.generatedAt,
    };
    if (source.none) bag.none = true;
    return bag;
  }

  function pickFilled(older, newer) {
    const olderOk = hasMeaningfulValue(older);
    const newerOk = hasMeaningfulValue(newer);
    if (olderOk && newerOk) {
      if (isPlainObject(older) && isPlainObject(newer)) return mergePlainObjects(older, newer);
      if (Array.isArray(older) && Array.isArray(newer)) return mergeArraysByIndex(older, newer);
      return newer;
    }
    if (newerOk) return newer;
    if (olderOk) return older;
    return newer === undefined ? older : newer;
  }

  function mergePlainObjects(older, newer) {
    const next = { ...older };
    Object.keys(newer || {}).forEach((key) => {
      next[key] = pickFilled(older ? older[key] : undefined, newer[key]);
    });
    return next;
  }

  function mergeArraysByIndex(older, newer) {
    const max = Math.max(older.length, newer.length);
    const next = [];
    for (let i = 0; i < max; i += 1) {
      next.push(pickFilled(older[i], newer[i]));
    }
    return next;
  }

  function mergeGuideRounds(olderRounds, newerRounds) {
    const older = Array.isArray(olderRounds) ? olderRounds : [];
    const newer = Array.isArray(newerRounds) ? newerRounds : [];
    if (!newer.length) return older;
    if (!older.length) return newer;

    const usedOlder = new Set();
    const next = newer.map((round, index) => {
      let match = null;
      let matchIndex = -1;
      if (isPlainObject(round) && hasMeaningfulValue(round.id)) {
        matchIndex = older.findIndex(
          (item, idx) => !usedOlder.has(idx) && isPlainObject(item) && item.id === round.id
        );
      }
      if (matchIndex < 0 && isPlainObject(round) && hasMeaningfulValue(round.question)) {
        matchIndex = older.findIndex(
          (item, idx) =>
            !usedOlder.has(idx) &&
            isPlainObject(item) &&
            String(item.question || "").trim() === String(round.question || "").trim()
        );
      }
      if (matchIndex < 0 && index < older.length && !usedOlder.has(index)) {
        matchIndex = index;
      }
      if (matchIndex >= 0) {
        usedOlder.add(matchIndex);
        match = older[matchIndex];
      }
      return isPlainObject(round) || isPlainObject(match)
        ? mergePlainObjects(isPlainObject(match) ? match : {}, isPlainObject(round) ? round : {})
        : pickFilled(match, round);
    });

    older.forEach((round, index) => {
      if (!usedOlder.has(index) && hasMeaningfulValue(round)) next.push(round);
    });
    return next;
  }

  const REFLECTION_EXTENSION_VARIANT = "reflection-extension-v1";
  const REFLECTION_EXTENSION_MAX_ROUNDS = 2;

  function emptyReflectionExtension() {
    return { variant: REFLECTION_EXTENSION_VARIANT, rounds: [] };
  }

  function normalizeReflectionExtensionQuestions(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((item, index) => {
        const title = String((item && item.title) || "").replace(/\s+/g, " ").trim();
        const insight = String((item && item.insight) || "").replace(/\s+/g, " ").trim();
        const question = insight ? String((item && item.question) || "").replace(/\s+/g, " ").trim() : "";
        const fallback = String((item && (item.text || (!insight && (item.question || item)))) || "").replace(/\s+/g, " ").trim();
        const text = insight
          ? (question && !insight.includes(question)
              ? `${insight}${/[。！？!?]$/.test(insight) ? " " : "。"}${question}`.replace(/\s+/g, " ").trim()
              : insight)
          : fallback;
        if (!text) return null;
        const out = { id: String((item && item.id) || `eq${index + 1}`), text };
        if (title) out.title = title;
        if (insight) out.insight = insight;
        if (question) out.question = question;
        return out;
      })
      .filter(Boolean)
      .slice(0, 3);
  }

  function isExtensionRoundCompleted(round) {
    if (!isPlainObject(round)) return false;
    return Boolean(
      String(round.deepConclusion || "").replace(/\s+/g, " ").trim() &&
        String(round.completedAt || "").trim()
    );
  }

  function normalizeReflectionExtensionRound(raw, index) {
    const src = isPlainObject(raw) ? raw : {};
    const questions = normalizeReflectionExtensionQuestions(src.questions);
    const allowed = new Set(questions.map((item) => item.id));
    const selectedQuestionId = allowed.has(String(src.selectedQuestionId || "").trim())
      ? String(src.selectedQuestionId || "").trim()
      : "";
    const answer = String(src.answer || "").trim();
    const deepConclusion = String(src.deepConclusion || "").replace(/\s+/g, " ").trim();
    const completedAt = String(src.completedAt || "").trim();
    const selectedFromList = questions.find((item) => item.id === selectedQuestionId);
    return {
      id: String(src.id || "").trim() || `ext${index + 1}`,
      coreThread: String(src.coreThread || "").replace(/\s+/g, " ").trim().slice(0, 80),
      questions,
      selectedQuestionId,
      selectedQuestionText: String((selectedFromList && selectedFromList.text) || src.selectedQuestionText || "")
        .replace(/\s+/g, " ")
        .trim(),
      answer,
      answerSig: String(src.answerSig || "").trim(),
      deepConclusion,
      completedAt,
      sourceSig: String(src.sourceSig || "").trim(),
      stale: Boolean(src.stale),
      conclusionStale: Boolean(src.conclusionStale),
      retrieval: normalizeReflectionRetrieval(src.retrieval),
    };
  }

  function normalizeReflectionRetrieval(raw) {
    const src = isPlainObject(raw) ? raw : {};
    const selectedPast = (Array.isArray(src.selectedPast) ? src.selectedPast : [])
      .map((item) => {
        const date = String((item && item.date) || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        const provenance = item.provenance && typeof item.provenance === "object" ? item.provenance : {};
        return {
          date,
          score: Math.max(0, Math.min(4, Number(item.score != null ? item.score : item.relevanceScore) || 0)),
          connectionType: String((item && item.connectionType) || "").trim(),
          provenance: {
            userRaw: Boolean(provenance.userRaw),
            userConfirmed: Boolean(provenance.userConfirmed),
            aiHypothesis: Boolean(provenance.aiHypothesis),
          },
          used: item.used !== false,
        };
      })
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
    return { variant: REFLECTION_EXTENSION_VARIANT, rounds };
  }

  function hasMeaningfulReflectionExtension(raw) {
    const data = normalizeReflectionExtension(raw);
    return data.rounds.some(
      (item) =>
        item.questions.length ||
        item.answer ||
        item.deepConclusion ||
        item.selectedQuestionId ||
        item.coreThread
    );
  }

  function upsertReflectionExtensionRound(extension, round) {
    const data = normalizeReflectionExtension(extension);
    const next = normalizeReflectionExtensionRound(round, data.rounds.length);
    const index = data.rounds.findIndex((item) => item.id && item.id === next.id);
    const rounds = data.rounds.slice();
    if (index >= 0) rounds[index] = normalizeReflectionExtensionRound({ ...rounds[index], ...next }, index);
    else rounds.push(next);
    return { variant: REFLECTION_EXTENSION_VARIANT, rounds: rounds.slice(0, REFLECTION_EXTENSION_MAX_ROUNDS) };
  }

  function completedExtensionCount(raw) {
    return normalizeReflectionExtension(raw).rounds.filter(isExtensionRoundCompleted).length;
  }

  function canStartExtensionRound2(persisted, options = {}) {
    const data = normalizeReflectionExtension(persisted);
    const completed = completedExtensionCount(data);
    if (Boolean(options && options.archived) || Boolean(options && options.busy)) return false;
    return completed === 1 && data.rounds.length >= 1;
  }

  function extensionDailyLimitReached(persisted) {
    return completedExtensionCount(persisted) >= REFLECTION_EXTENSION_MAX_ROUNDS;
  }

  function mergeReflectionExtensionRounds(olderRounds, newerRounds) {
    const older = (Array.isArray(olderRounds) ? olderRounds : []).map((item, index) => normalizeReflectionExtensionRound(item, index));
    const newer = (Array.isArray(newerRounds) ? newerRounds : []).map((item, index) => normalizeReflectionExtensionRound(item, index));
    if (!newer.length) return older.slice(0, REFLECTION_EXTENSION_MAX_ROUNDS);
    if (!older.length) return newer.slice(0, REFLECTION_EXTENSION_MAX_ROUNDS);
    const usedOlder = new Set();
    const next = newer.map((round, index) => {
      let matchIndex = older.findIndex((item, idx) => !usedOlder.has(idx) && item.id && item.id === round.id);
      if (matchIndex < 0 && index < older.length && !usedOlder.has(index)) matchIndex = index;
      if (matchIndex >= 0) {
        usedOlder.add(matchIndex);
        return normalizeReflectionExtensionRound(mergePlainObjects(older[matchIndex], round), index);
      }
      return round;
    });
    older.forEach((round, index) => {
      if (
        !usedOlder.has(index) &&
        (round.questions.length || round.answer || round.deepConclusion || round.selectedQuestionId)
      ) {
        next.push(round);
      }
    });
    return next.slice(0, REFLECTION_EXTENSION_MAX_ROUNDS);
  }

  function mergeReflectionExtension(older, newer) {
    const a = normalizeReflectionExtension(older);
    const b = normalizeReflectionExtension(newer);
    if (!b.rounds.length) return a.rounds.length ? a : emptyReflectionExtension();
    if (!a.rounds.length) return b;
    return {
      variant: REFLECTION_EXTENSION_VARIANT,
      rounds: mergeReflectionExtensionRounds(a.rounds, b.rounds),
    };
  }

  function firstLayerGuideFields(guide) {
    const data = isPlainObject(guide) ? guide : {};
    const questions = Array.isArray(data.questions)
      ? data.questions.filter((item) => hasMeaningfulValue(item && (item.text || item.question || item)))
      : [];
    return {
      variant: String(data.variant || "").trim(),
      status: String(data.status || "").trim(),
      coreQuote: String(data.coreQuote || "").replace(/\s+/g, " ").trim(),
      questions,
      sourceSig: String(data.sourceSig || "").trim(),
      discovery: data.discovery && typeof data.discovery === "object" ? data.discovery : null,
      understand: data.understand && typeof data.understand === "object" ? data.understand : null,
    };
  }

  function mergeGuideObjects(older, newer) {
    if (!hasMeaningfulGuide(newer)) return hasMeaningfulGuide(older) ? older : newer;
    if (!hasMeaningfulGuide(older)) return newer;
    const a = isPlainObject(older) ? older : {};
    const b = isPlainObject(newer) ? newer : {};
    const merged = {
      ...mergePlainObjects(a, b),
      rounds: mergeGuideRounds(a.rounds, b.rounds),
      extension: mergeReflectionExtension(a.extension, b.extension),
    };
    const prev = firstLayerGuideFields(a);
    if (!String(merged.variant || "").trim() && prev.variant) merged.variant = prev.variant;
    if (String(merged.status || "") !== "silence" && String(merged.status || "") !== "empty") {
      if (!String(merged.coreQuote || "").trim() && prev.coreQuote) merged.coreQuote = prev.coreQuote;
      if (!(Array.isArray(merged.questions) && merged.questions.some((item) => hasMeaningfulValue(item && (item.text || item.question || item)))) && prev.questions.length) {
        merged.questions = prev.questions;
      }
    }
    if (!String(merged.sourceSig || "").trim() && prev.sourceSig) merged.sourceSig = prev.sourceSig;
    if (!merged.understand && prev.understand) merged.understand = prev.understand;
    if (merged.retrieval) delete merged.retrieval;
    return merged;
  }

  function mergeInsightObjects(older, newer) {
    if (!hasMeaningfulInsight(newer)) return hasMeaningfulInsight(older) ? older : newer;
    if (!hasMeaningfulInsight(older)) return newer;
    const a = isPlainObject(older) ? older : {};
    const b = isPlainObject(newer) ? newer : {};
    const next = { ...a };
    Object.keys(b).forEach((key) => {
      if (key === "guide") next.guide = mergeGuideObjects(a.guide, b.guide);
      else next[key] = pickFilled(a[key], b[key]);
    });
    if (a.guide && !b.guide) next.guide = a.guide;
    return next;
  }

  function mergeThinkHistory(older, newer) {
    if (!hasMeaningfulThinkHistory(newer)) return hasMeaningfulThinkHistory(older) ? older : newer;
    if (!hasMeaningfulThinkHistory(older)) return newer;
    return mergeArraysByIndex(older, newer);
  }

  function mergeDeepSlots(older, newer) {
    if (!hasMeaningfulDeep(newer)) return hasMeaningfulDeep(older) ? older : newer;
    if (!hasMeaningfulDeep(older)) return newer;
    if (Array.isArray(older) && Array.isArray(newer)) return mergeArraysByIndex(older, newer);
    return pickFilled(older, newer);
  }

  function mergeManifestClose(older, newer) {
    const a = isPlainObject(older) ? older : {};
    const b = isPlainObject(newer) ? newer : {};
    const next = {
      futureVision: String(pickFilled(a.futureVision, b.futureVision) || "").trim(),
      approachStep: String(pickFilled(a.approachStep, b.approachStep) || "").trim(),
      manifestationStatement: String(
        pickFilled(a.manifestationStatement || a.sentence, b.manifestationStatement || b.sentence) || ""
      ).trim(),
      accepted: Boolean(a.accepted || b.accepted),
      addedToExec: Boolean(a.addedToExec || b.addedToExec),
    };
    if (
      next.futureVision ||
      next.approachStep ||
      next.manifestationStatement ||
      next.accepted ||
      next.addedToExec
    ) {
      return next;
    }
    return hasMeaningfulValue(newer) ? next : hasMeaningfulValue(older) ? next : newer == null ? older : newer;
  }

  function mergeManifestPlan(older, newer) {
    const asPlan = (value) => {
      const src = isPlainObject(value) ? value : {};
      const steps = (Array.isArray(src.steps) ? src.steps : []).map((item, index) => {
        if (!item || typeof item !== "object") {
          const title = String(item || "").trim();
          return title ? { id: `s${index + 1}`, title, detail: "", completed: false, taskAdded: false } : null;
        }
        const title = String(item.title || item.label || item.text || "").trim();
        if (!title) return null;
        return {
          id: String(item.id || "").trim() || `s${index + 1}`,
          title,
          detail: String(item.detail || item.note || "").trim(),
          completed: Boolean(item.completed || item.done),
          taskAdded: Boolean(item.taskAdded || item.addedToExec),
        };
      }).filter(Boolean);
      return { id: String(src.id || "").trim(), steps };
    };
    const a = asPlan(older);
    const b = asPlan(newer);
    if (!b.steps.length) return a.steps.length ? a : newer == null ? older : newer;
    if (!a.steps.length) return b;
    if (a.id && b.id && a.id === b.id) {
      const prev = new Map(a.steps.map((item) => [item.id, item]));
      return {
        id: b.id,
        steps: b.steps.map((item) => {
          const old = prev.get(item.id);
          return {
            ...item,
            completed: Boolean(item.completed || (old && old.completed)),
            taskAdded: Boolean(item.taskAdded || (old && old.taskAdded)),
          };
        }),
      };
    }
    return b;
  }

  function emptyBodyMind() {
    return {
      text: "",
      insight: "",
      support: "",
      generatedAt: "",
      sig: "",
      status: "",
      seeType: "",
      evidence: [],
      confidence: "",
      internalDebug: null,
    };
  }

  function normalizeSeeType(value) {
    const type = String(value || "").trim().toUpperCase().replace(/[\s-]/g, "_");
    return [
      "CONTRAST",
      "COMMON_THREAD",
      "ENERGY_SOURCE",
      "DRAIN_SOURCE",
      "UNNOTICED_NEED",
      "CHANGE",
      "UNRECOGNIZED_STRENGTH",
      "BETTER_NEXT_RESPONSE",
    ].includes(type)
      ? type
      : "";
  }

  function normalizeBodyMind(raw) {
    const src = isPlainObject(raw) ? raw : {};
    const debug = src.internalDebug && typeof src.internalDebug === "object" ? src.internalDebug : null;
    const status = String(src.status || "").trim().toLowerCase();
    const confidence = String(src.confidence || "").trim().toLowerCase();
    return {
      text: String(src.text || src.note || "").replace(/\s+/g, " ").trim(),
      insight: String(src.insight || "").replace(/\s+/g, " ").trim(),
      support: String(src.support || "").replace(/\s+/g, " ").trim(),
      generatedAt: String(src.generatedAt || "").trim(),
      sig: String(src.sig || "").trim(),
      status: status === "silence" || status === "observation" ? status : "",
      seeType: normalizeSeeType(src.seeType),
      evidence: Array.isArray(src.evidence)
        ? src.evidence.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 6)
        : [],
      confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "",
      internalDebug: debug && debug.model ? { provider: String(debug.provider || ""), model: String(debug.model || "") } : null,
    };
  }

  function hasMeaningfulBodyMind(value) {
    const data = normalizeBodyMind(value);
    return Boolean(data.text || data.insight || data.support);
  }

  function mergeBodyMind(older, newer) {
    if (!hasMeaningfulBodyMind(newer)) {
      return hasMeaningfulBodyMind(older) ? normalizeBodyMind(older) : emptyBodyMind();
    }
    if (!hasMeaningfulBodyMind(older)) return normalizeBodyMind(newer);
    const a = normalizeBodyMind(older);
    const b = normalizeBodyMind(newer);
    return {
      text: b.text || a.text,
      insight: b.insight || a.insight,
      support: b.support || a.support,
      generatedAt: b.generatedAt || a.generatedAt,
      sig: b.sig || a.sig,
      status: b.status || a.status,
      seeType: b.seeType || a.seeType,
      evidence: b.evidence.length ? b.evidence : a.evidence,
      confidence: b.confidence || a.confidence,
      internalDebug: b.internalDebug || a.internalDebug,
    };
  }

  function journalResetAtMs(journal) {
    if (typeof InternalTest.internalResetAtMs === "function") {
      return InternalTest.internalResetAtMs({ journal });
    }
    const parsed = Date.parse(journal && journal.internalResetAt ? journal.internalResetAt : "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function mergeInternalTestRuns(older, newer) {
    if (typeof InternalTest.mergeInternalTestRuns === "function") return InternalTest.mergeInternalTestRuns(older, newer);
    const list = [...(Array.isArray(newer) ? newer : []), ...(Array.isArray(older) ? older : [])];
    return list.slice(0, 20);
  }

  function emptyAwarenessV3() {
    return { variant: "awareness-v3", sourceSig: "", items: [], selectedIds: [], generatedAt: "", observationCue: null };
  }

  function normalizeObservationCue(raw) {
    const src = isPlainObject(raw) ? raw : {};
    const text = String(src.text || "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    return {
      text,
      selectedSig: String(src.selectedSig || "").trim(),
      generatedAt: String(src.generatedAt || "").trim(),
    };
  }

  function observationSelectedSig(selectedIds, selectedTexts) {
    const ids = (Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id || "").trim()).filter(Boolean).slice().sort();
    const texts = (Array.isArray(selectedTexts) ? selectedTexts : []).map((text) => String(text || "").replace(/\s+/g, " ").trim()).filter(Boolean);
    return `${ids.join(",")}\n${texts.join("|")}`;
  }

  function normalizeAwarenessV3Bag(raw) {
    const src = isPlainObject(raw) ? raw : {};
    const items = (Array.isArray(src.items) ? src.items : Array.isArray(src.options) ? src.options : [])
      .map((item, index) => {
        const text = String((item && (item.text || item.line || item)) || "").replace(/\s+/g, " ").trim();
        if (!text) return null;
        const title = String((item && item.title) || "").replace(/\s+/g, " ").trim();
        const out = { id: String((item && item.id) || `a${index + 1}`), text };
        if (title) out.title = title;
        if (item && item.type) out.type = String(item.type || "").trim();
        if (item && item.maturity) out.maturity = String(item.maturity || "").trim();
        return out;
      })
      .filter(Boolean)
      .slice(0, 3);
    const allowed = new Set(items.map((item) => item.id));
    return {
      variant: "awareness-v3",
      growVariant: String(src.growVariant || "").trim(),
      status: String(src.status || "").trim(),
      sourceSig: String(src.sourceSig || "").trim(),
      items,
      selectedIds: (Array.isArray(src.selectedIds) ? src.selectedIds : []).map((id) => String(id || "").trim()).filter((id) => allowed.has(id)),
      generatedAt: String(src.generatedAt || "").trim(),
      observationCue: normalizeObservationCue(src.observationCue),
      emptyCopy: src.emptyCopy && typeof src.emptyCopy === "object" ? src.emptyCopy : null,
    };
  }

  function isGrowAwarenessBag(data) {
    return data.growVariant === "grow-v1" || data.status === "grow" || data.status === "empty";
  }

  function hasAwarenessV3PersistableResult(value) {
    const data = normalizeAwarenessV3Bag(value);
    if (isGrowAwarenessBag(data)) return Boolean(data.sourceSig);
    return data.items.length > 0;
  }

  function hasMeaningfulAwarenessV3(value) {
    const data = normalizeAwarenessV3Bag(value);
    return data.items.length > 0 || Boolean(data.sourceSig);
  }

  function selectedAwarenessV3Texts(value) {
    const data = normalizeAwarenessV3Bag(value);
    const map = new Map(data.items.map((item) => [item.id, item.text]));
    return data.selectedIds.map((id) => map.get(id)).filter(Boolean);
  }

  function pickObservationCue(a, b, selectedIds, items) {
    const map = new Map((Array.isArray(items) ? items : []).map((item) => [item.id, item.text]));
    const texts = (Array.isArray(selectedIds) ? selectedIds : []).map((id) => map.get(id)).filter(Boolean);
    const sig = observationSelectedSig(selectedIds, texts);
    const stamp = (value) => {
      const parsed = Date.parse((value && value.generatedAt) || "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const ca = a && a.observationCue;
    const cb = b && b.observationCue;
    if (!selectedIds || !selectedIds.length) {
      return stamp(cb) >= stamp(ca) ? cb || ca || null : ca || cb || null;
    }
    if (cb && (!cb.selectedSig || cb.selectedSig === sig)) return cb;
    if (ca && (!ca.selectedSig || ca.selectedSig === sig)) return ca;
    return stamp(cb) >= stamp(ca) ? cb || ca || null : ca || cb || null;
  }

  function mergeAwarenessV3(older, newer) {
    const a = normalizeAwarenessV3Bag(older);
    const b = normalizeAwarenessV3Bag(newer);
    if (!hasAwarenessV3PersistableResult(b)) return hasAwarenessV3PersistableResult(a) ? a : b;
    if (!hasAwarenessV3PersistableResult(a)) return b;
    const stamp = (value) => {
      const parsed = Date.parse(value || "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const preferB = stamp(b.generatedAt) >= stamp(a.generatedAt) || (b.sourceSig && b.sourceSig !== a.sourceSig);
    const winner = preferB ? b : a;
    const selectedIds = b.selectedIds.length ? b.selectedIds : preferB && a.sourceSig === b.sourceSig ? a.selectedIds : preferB ? [] : a.selectedIds;
    return {
      ...winner,
      selectedIds,
      observationCue: isGrowAwarenessBag(winner) ? winner.observationCue || null : pickObservationCue(a, b, selectedIds, winner.items),
    };
  }

  function mergeJournalObjects(older, newer) {
    if (!isPlainObject(newer)) return isPlainObject(older) ? older : newer;
    if (!isPlainObject(older)) return newer;
    if (journalResetAtMs(newer) > journalResetAtMs(older)) {
      return {
        ...newer,
        internalTestRuns: mergeInternalTestRuns(older.internalTestRuns, newer.internalTestRuns),
        internalResetAt: newer.internalResetAt || older.internalResetAt || "",
      };
    }
    const next = { ...older };
    Object.keys(newer).forEach((key) => {
      if (key === "insight") next.insight = mergeInsightObjects(older.insight, newer.insight);
      else if (key === "deep") next.deep = mergeDeepSlots(older.deep, newer.deep);
      else if (key === "deepPrompts") next.deepPrompts = pickFilled(older.deepPrompts, newer.deepPrompts);
      else if (key === "userMarks") next.userMarks = mergeUserMarks(older.userMarks, newer.userMarks);
      else if (key === "awarenessChoices" || key === "thinkChoices") next[key] = mergeChoiceBags(older[key], newer[key]);
      else if (key === "executionChoices") next[key] = mergeExecutionChoiceBags(older[key], newer[key]);
      else if (key === "awarenessV3") next[key] = mergeAwarenessV3(older[key], newer[key]);
      else if (key === "bodyMind") next[key] = mergeBodyMind(older[key], newer[key]);
      else if (key === "manifestClose") next[key] = mergeManifestClose(older[key], newer[key]);
      else if (key === "manifestPlan") next[key] = mergeManifestPlan(older[key], newer[key]);
      else if (key === "internalTestRuns") next[key] = mergeInternalTestRuns(older[key], newer[key]);
      else next[key] = pickFilled(older[key], newer[key]);
    });
    ["insight", "deep", "deepPrompts", "userMarks", "awarenessChoices", "thinkChoices", "executionChoices", "manifestClose", "manifestPlan", "bodyMind", "awarenessV3"].forEach((key) => {
      const olderOk =
        key === "awarenessChoices" || key === "thinkChoices"
          ? hasMeaningfulChoices(older[key])
          : key === "executionChoices"
            ? hasMeaningfulExecutionChoices(older[key])
          : key === "bodyMind"
            ? hasMeaningfulBodyMind(older[key])
          : key === "awarenessV3"
            ? hasMeaningfulAwarenessV3(older[key])
          : hasMeaningfulValue(older[key]);
      const nextOk =
        key === "awarenessChoices" || key === "thinkChoices"
          ? hasMeaningfulChoices(next[key])
          : key === "executionChoices"
            ? hasMeaningfulExecutionChoices(next[key])
          : key === "bodyMind"
            ? hasMeaningfulBodyMind(next[key])
          : key === "awarenessV3"
            ? hasMeaningfulAwarenessV3(next[key])
          : hasMeaningfulValue(next[key]);
      if (olderOk && !nextOk) next[key] = older[key];
    });
    return next;
  }

  function mergeUserMarks(older, newer) {
    const helper = typeof globalThis !== "undefined" ? globalThis.NichiUserMark : null;
    if (helper && typeof helper.mergeUserMarks === "function") return helper.mergeUserMarks(older, newer);
    const asBag = (value) => {
      if (Array.isArray(value)) return { items: value.filter((item) => item && typeof item === "object"), updatedAt: "" };
      if (value && typeof value === "object") {
        return {
          items: Array.isArray(value.items) ? value.items.filter((item) => item && typeof item === "object") : [],
          updatedAt: String(value.updatedAt || "").trim(),
        };
      }
      return { items: [], updatedAt: "" };
    };
    const a = asBag(older);
    const b = asBag(newer);
    const stamp = (value) => {
      const parsed = Date.parse(value || "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    if (b.updatedAt && stamp(b.updatedAt) >= stamp(a.updatedAt)) return { items: b.items, updatedAt: b.updatedAt };
    if (b.items.length && !b.updatedAt) return { items: b.items, updatedAt: a.updatedAt };
    if (a.items.length || a.updatedAt) return a;
    return b;
  }

  function stampMs(value) {
    const raw = value && typeof value === "object" ? value.updatedAt || value.generatedAt || value.createdAt || "" : "";
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function newerStamp(left, right) {
    return stampMs(left) >= stampMs(right);
  }

  function completedAtMs(review) {
    const parsed = Date.parse(review && review.completedAt ? review.completedAt : "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function updatedAtMs(review) {
    const parsed = Date.parse(review && review.updatedAt ? review.updatedAt : "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function reviewIsFinalized(review) {
    if (!review || typeof review !== "object") return false;
    if (String(review.completedAt || "").trim()) return true;
    if (hasMeaningfulValue(review.organize)) return true;
    return false;
  }

  function normalizeHistoryRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const rounded = Math.round(n);
    if (rounded < 1 || rounded > 5) return 0;
    return rounded;
  }

  function pickHistoryRating(preferred, fallback) {
    return normalizeHistoryRating(preferred) || normalizeHistoryRating(fallback) || 0;
  }

  function metaStampMs(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeHistoryMeta(raw) {
    if (!isPlainObject(raw)) return null;
    const updatedAt = String(raw.updatedAt || "").trim();
    const important = raw.important === true;
    if (!important && !updatedAt) return null;
    return { important, updatedAt };
  }

  function pickHistoryMeta(preferred, fallback) {
    const a = normalizeHistoryMeta(preferred && preferred.historyMeta);
    const b = normalizeHistoryMeta(fallback && fallback.historyMeta);
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    return metaStampMs(a.updatedAt) >= metaStampMs(b.updatedAt) ? a : b;
  }

  function reviewIsHistoryImportant(review) {
    const meta = normalizeHistoryMeta(review && review.historyMeta);
    return Boolean(meta && meta.important === true);
  }

  function applyHistoryArchiveFields(review, preferred, fallback) {
    if (!review || typeof review !== "object") return review;
    const rating = pickHistoryRating(preferred && preferred.historyRating, fallback && fallback.historyRating);
    const shortTitle = pickFilled(preferred && preferred.historyShortTitle, fallback && fallback.historyShortTitle);
    const meta = pickHistoryMeta(preferred, fallback);
    if (rating) review.historyRating = rating;
    else delete review.historyRating;
    if (hasMeaningfulValue(shortTitle)) review.historyShortTitle = String(shortTitle).trim();
    if (meta) review.historyMeta = { important: Boolean(meta.important), updatedAt: meta.updatedAt };
    else delete review.historyMeta;
    return review;
  }

  function maxStampValue(left, right) {
    const a = String(left || "").trim();
    const b = String(right || "").trim();
    const am = Date.parse(a);
    const bm = Date.parse(b);
    const aOk = Number.isFinite(am);
    const bOk = Number.isFinite(bm);
    if (aOk && bOk) return am >= bm ? a : b;
    return a || b;
  }

  function mergeArchivedJournal(bodySource, other) {
    const base = isPlainObject(bodySource && bodySource.journal) ? { ...bodySource.journal } : {};
    const otherJournal = isPlainObject(other && other.journal) ? other.journal : {};
    base.userMarks = mergeUserMarks(base.userMarks, otherJournal.userMarks);
    return base;
  }

  function applyInternalResetPick(resetSide, other) {
    const runs = mergeInternalTestRuns(
      resetSide && resetSide.journal && resetSide.journal.internalTestRuns,
      other && other.journal && other.journal.internalTestRuns
    );
    const resetAt =
      (resetSide && (resetSide.internalResetAt || (resetSide.journal && resetSide.journal.internalResetAt))) ||
      "";
    return applyHistoryArchiveFields(
      {
        ...resetSide,
        completedAt: "",
        organize: null,
        internalResetAt: resetAt,
        journal: {
          ...(isPlainObject(resetSide && resetSide.journal) ? resetSide.journal : {}),
          internalTestRuns: runs,
          internalResetAt: resetAt,
        },
        updatedAt: maxStampValue(resetSide && resetSide.updatedAt, other && other.updatedAt),
        userId: (resetSide && resetSide.userId) || (other && other.userId) || "",
        date: (resetSide && resetSide.date) || (other && other.date),
      },
      resetSide,
      other
    );
  }

  function pickCompletedProtected(left, right) {
    const leftReset = typeof InternalTest.internalResetAtMs === "function" ? InternalTest.internalResetAtMs(left) : 0;
    const rightReset = typeof InternalTest.internalResetAtMs === "function" ? InternalTest.internalResetAtMs(right) : 0;
    const latestReset = Math.max(leftReset, rightReset);
    if (latestReset > 0) {
      const resetSide = leftReset >= rightReset ? left : right;
      const otherSide = resetSide === left ? right : left;
      const otherDoneAt = completedAtMs(otherSide);
      const resetDoneAt = completedAtMs(resetSide);
      if (!reviewIsFinalized(resetSide) && reviewIsFinalized(otherSide) && latestReset >= otherDoneAt) {
        return applyInternalResetPick(resetSide, otherSide);
      }
      if (reviewIsFinalized(resetSide) && resetDoneAt >= latestReset && otherDoneAt && otherDoneAt < latestReset) {
        return applyHistoryArchiveFields(
          {
            ...resetSide,
            journal: mergeJournalObjects(otherSide && otherSide.journal, resetSide.journal),
            updatedAt: maxStampValue(resetSide.updatedAt, otherSide && otherSide.updatedAt),
            userId: resetSide.userId || (otherSide && otherSide.userId) || "",
            date: resetSide.date || (otherSide && otherSide.date),
          },
          resetSide,
          otherSide
        );
      }
    }
    const leftDone = reviewIsFinalized(left);
    const rightDone = reviewIsFinalized(right);
    if (!leftDone && !rightDone) return null;
    let bodySource;
    let other;
    if (leftDone && !rightDone) {
      bodySource = left;
      other = right;
    } else if (rightDone && !leftDone) {
      bodySource = right;
      other = left;
    } else {
      const lc = completedAtMs(left);
      const rc = completedAtMs(right);
      if (lc !== rc) {
        bodySource = lc >= rc ? left : right;
      } else {
        const leftDelta = Math.abs(updatedAtMs(left) - (lc || updatedAtMs(left)));
        const rightDelta = Math.abs(updatedAtMs(right) - (rc || updatedAtMs(right)));
        bodySource = leftDelta <= rightDelta ? left : right;
      }
      other = bodySource === left ? right : left;
    }
    return applyHistoryArchiveFields(
      {
        ...bodySource,
        journal: mergeArchivedJournal(bodySource, other),
        gratitude: bodySource.gratitude,
        rawText: bodySource.rawText,
        organize: bodySource.organize || (other && other.organize) || null,
        completedAt: bodySource.completedAt || (other && other.completedAt) || "",
        selectedQuotes: bodySource.selectedQuotes,
        selectedSfm: bodySource.selectedSfm,
        selectedThinkActions: bodySource.selectedThinkActions,
        selectedPractice: bodySource.selectedPractice,
        thinkHistory: bodySource.thinkHistory,
        updatedAt: maxStampValue(bodySource.updatedAt, other && other.updatedAt),
        userId: bodySource.userId || (other && other.userId) || "",
        date: bodySource.date || (other && other.date),
      },
      bodySource,
      other
    );
  }

  function reviewLooksEmpty(review) {
    if (!review || typeof review !== "object") return true;
    if (reviewIsFinalized(review)) return false;
    if (hasMeaningfulValue(review.rawText) || hasMeaningfulValue(review.gratitude) || hasMeaningfulValue(review.organize)) {
      return false;
    }
    if (hasMeaningfulThinkHistory(review.thinkHistory)) return false;
    const journal = isPlainObject(review.journal) ? review.journal : {};
    if (hasMeaningfulInsight(journal.insight) || hasMeaningfulDeep(journal.deep, journal.deepPrompts)) return false;
    if (hasMeaningfulValue(journal)) return false;
    return true;
  }

  function pickReview(left, right) {
    if (!left) return right || null;
    if (!right) return left;
    const protectedReview = pickCompletedProtected(left, right);
    if (protectedReview) return protectedReview;
    const emptyL = reviewLooksEmpty(left);
    const emptyR = reviewLooksEmpty(right);
    if (emptyL && !emptyR) return right;
    if (emptyR && !emptyL) return left;
    const leftNewer = newerStamp(left, right);
    const newer = leftNewer ? left : right;
    const older = leftNewer ? right : left;
    const next = {
      ...older,
      ...newer,
      journal: mergeJournalObjects(older.journal, newer.journal),
      gratitude: pickFilled(older.gratitude, newer.gratitude),
      rawText: pickFilled(older.rawText, newer.rawText),
      organize: pickFilled(older.organize, newer.organize),
      completedAt: newer.completedAt || older.completedAt || "",
      selectedQuotes: pickFilled(older.selectedQuotes, newer.selectedQuotes),
      selectedSfm: pickFilled(older.selectedSfm, newer.selectedSfm),
      selectedThinkActions: pickFilled(older.selectedThinkActions, newer.selectedThinkActions),
      selectedPractice: pickFilled(older.selectedPractice, newer.selectedPractice),
      thinkHistory: mergeThinkHistory(older.thinkHistory, newer.thinkHistory),
      updatedAt: newer.updatedAt || older.updatedAt,
      userId: newer.userId || older.userId || "",
      date: newer.date || older.date,
    };
    if (hasMeaningfulInsight(older.journal && older.journal.insight) && !hasMeaningfulInsight(next.journal && next.journal.insight)) {
      next.journal = { ...(next.journal || {}), insight: older.journal.insight };
    }
    if (hasMeaningfulThinkHistory(older.thinkHistory) && !hasMeaningfulThinkHistory(next.thinkHistory)) {
      next.thinkHistory = older.thinkHistory;
    }
    return applyHistoryArchiveFields(next, newer, older);
  }

  function mergeReviewMaps(left, right) {
    const next = {};
    const dates = new Set([
      ...Object.keys(left && typeof left === "object" && !Array.isArray(left) ? left : {}),
      ...Object.keys(right && typeof right === "object" && !Array.isArray(right) ? right : {}),
    ]);
    dates.forEach((iso) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      const picked = pickReview(left && left[iso], right && right[iso]);
      if (picked && typeof picked === "object") next[iso] = picked;
    });
    return next;
  }

  function historyDeepThinkingSource(review) {
    const journal = review && isPlainObject(review.journal) ? review.journal : {};
    const insight = isPlainObject(journal.insight) ? journal.insight : {};
    if (hasMeaningfulChoices(journal.thinkChoices)) {
      return { kind: "thinkChoices", thinkChoices: journal.thinkChoices, insight, guide: insight.guide };
    }
    if (hasMeaningfulGuide(insight.guide)) {
      return { kind: "guide", insight, guide: insight.guide };
    }
    if (hasMeaningfulInsightBlocks(insight)) {
      return { kind: "blocks", insight };
    }
    if (hasMeaningfulThinkHistory(review && review.thinkHistory)) {
      return { kind: "thinkHistory", thinkHistory: review.thinkHistory };
    }
    if (hasMeaningfulDeep(journal.deep, journal.deepPrompts)) {
      return { kind: "deep", deep: journal.deep, deepPrompts: journal.deepPrompts };
    }
    return { kind: "none" };
  }

  function visibleGuideRounds(guide) {
    const rounds = isPlainObject(guide) && Array.isArray(guide.rounds) ? guide.rounds : [];
    return rounds.filter(hasMeaningfulGuideRound);
  }

  function historyDeepThinkingView(review) {
    const source = historyDeepThinkingSource(review);
    if (source.kind === "thinkChoices") {
      const bag = normalizeChoiceBag(source.thinkChoices);
      return {
        kind: "thinkChoices",
        options: bag.options.slice(),
        selectedIds: bag.selectedIds.slice(),
        none: Boolean(bag.none),
        selectedTexts: selectedChoiceTexts(bag),
        summary: String((source.guide && (source.guide.summary || source.guide.awareness)) || "").trim(),
        title: String((source.guide && source.guide.title) || (source.insight && source.insight.title) || "").trim(),
        selfSeen: String((source.guide && source.guide.selfSeen) || "").trim(),
        takeaway: String((source.guide && source.guide.takeaway) || "").trim(),
        rounds: [],
      };
    }
    if (source.kind === "guide") {
      return {
        kind: "guide",
        rounds: visibleGuideRounds(source.guide).map((round) => ({
          question: String(round.question || "").trim(),
          hint: String(round.hint || "").trim(),
          answer: String(round.answer || "").trim(),
        })),
        summary: String(source.guide.summary || source.guide.awareness || "").trim(),
        title: String(source.guide.title || source.insight.title || "").trim(),
      };
    }
    if (source.kind === "blocks") {
      const insight = source.insight;
      return {
        kind: "blocks",
        psychology: String(insight.psychology || insight.analysis || "").trim(),
        conclusion: String(insight.conclusion || insight.summary || "").trim(),
        reflection: String(insight.reflection || "").trim(),
        title: String(insight.title || "").trim(),
      };
    }
    if (source.kind === "thinkHistory") {
      return { kind: "thinkHistory", count: source.thinkHistory.length, thinkHistory: source.thinkHistory };
    }
    if (source.kind === "deep") {
      return { kind: "deep", deep: source.deep, deepPrompts: source.deepPrompts };
    }
    return { kind: "none" };
  }

  return {
    hasMeaningfulValue,
    hasMeaningfulGuide,
    hasMeaningfulGuideRound,
    hasMeaningfulInsight,
    hasMeaningfulInsightBlocks,
    hasMeaningfulThinkHistory,
    hasMeaningfulDeep,
    hasMeaningfulChoices,
    emptyChoiceBag,
    normalizeChoiceOptions,
    normalizeChoiceBag,
    selectedChoiceTexts,
    mergeChoiceBags,
    emptyExecDeep,
    normalizeExecDeep,
    hasExecDeepFinal,
    hasMeaningfulExecDeep,
    mergeExecDeep,
    emptyExecutionChoiceBag,
    normalizeExecutionChoiceOptions,
    executionChoiceOptionExtras,
    insightExecutionFallbackOptions,
    normalizeExecutionChoiceBag,
    hasMeaningfulExecutionChoices,
    selectedExecutionChoiceActions,
    selectedExecutionChoiceText,
    mergeExecutionChoiceBags,
    EXEC_CHOICE_CUSTOM_ID,
    EXEC_CHOICE_CUSTOM_TEXT,
    EXEC_CHOICE_OPTION_COUNT,
    EXEC_CHOICE_MAX_SELECTED,
    choicesLookSimilar,
    CHOICE_NONE_ID,
    CHOICE_NONE_TEXT,
    CHOICE_MAX_SELECTED,
    CHOICE_OPTION_MIN,
    CHOICE_OPTION_MAX,
    pickFilled,
    mergeGuideRounds,
    mergeGuideObjects,
    emptyReflectionExtension,
    normalizeReflectionExtension,
    hasMeaningfulReflectionExtension,
    upsertReflectionExtensionRound,
    completedExtensionCount,
    canStartExtensionRound2,
    extensionDailyLimitReached,
    isExtensionRoundCompleted,
    mergeReflectionExtension,
    mergeInsightObjects,
    mergeThinkHistory,
    emptyBodyMind,
    normalizeBodyMind,
    hasMeaningfulBodyMind,
    mergeBodyMind,
    emptyAwarenessV3,
    normalizeAwarenessV3Bag,
    normalizeObservationCue,
    observationSelectedSig,
    hasMeaningfulAwarenessV3,
    selectedAwarenessV3Texts,
    mergeAwarenessV3,
    mergeJournalObjects,
    mergeInternalTestRuns,
    mergeUserMarks,
    pickReview,
    pickCompletedProtected,
    mergeReviewMaps,
    normalizeHistoryRating,
    pickHistoryRating,
    normalizeHistoryMeta,
    pickHistoryMeta,
    reviewIsHistoryImportant,
    historyDeepThinkingSource,
    historyDeepThinkingView,
    visibleGuideRounds,
    reviewLooksEmpty,
    reviewIsFinalized,
  };
});
