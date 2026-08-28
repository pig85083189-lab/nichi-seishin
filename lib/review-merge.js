(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiReviewMerge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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
    return (
      hasMeaningfulValue(guide.summary) ||
      hasMeaningfulValue(guide.awareness) ||
      hasMeaningfulValue(guide.selfSeen) ||
      hasMeaningfulValue(guide.takeaway) ||
      hasMeaningfulValue(guide.actions) ||
      hasMeaningfulValue(guide.title)
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

  function emptyExecutionChoiceBag() {
    return { sourceSig: "", options: [], selectedId: "", selectedIds: [], custom: "", followupQuestion: "", followupPlaceholder: "", generatedAt: "" };
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
      items.push({ id, text });
    });
    return items;
  }

  function normalizeExecutionChoiceBag(raw, options = {}) {
    const src = isPlainObject(raw) ? raw : {};
    const optionList = normalizeExecutionChoiceOptions(src.options || raw, options);
    const optionIds = new Set(optionList.map((item) => item.id));
    const selectedIds = normalizeExecutionSelectedIds(src, optionIds);
    return {
      sourceSig: String(src.sourceSig || "").trim(),
      options: optionList,
      selectedId: selectedIds[0] || "",
      selectedIds,
      custom: String(src.custom || "").trim(),
      followupQuestion: String(src.followupQuestion || "").trim(),
      followupPlaceholder: String(src.followupPlaceholder || "").trim(),
      generatedAt: String(src.generatedAt || "").trim(),
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
      Boolean(bag.followupQuestion)
    );
  }

  function selectedExecutionChoiceActions(value) {
    const bag = normalizeExecutionChoiceBag(value);
    const customId = EXEC_CHOICE_CUSTOM_ID;
    return bag.selectedIds
      .map((id) => {
        if (id === customId) {
          const text = String(bag.custom || "").trim();
          return text ? { id, text } : null;
        }
        const match = bag.options.find((item) => item.id === id);
        const text = match ? String(match.text || "").trim() : "";
        return text ? { id, text } : null;
      })
      .filter(Boolean);
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
      sourceSig: (b.options.length ? b.sourceSig : "") || a.sourceSig || b.sourceSig,
      options,
      selectedId: selectedIds[0] || "",
      selectedIds,
      custom: source.custom || a.custom,
      followupQuestion: b.followupQuestion || a.followupQuestion,
      followupPlaceholder: b.followupPlaceholder || a.followupPlaceholder,
      generatedAt: b.generatedAt || a.generatedAt,
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

  function mergeGuideObjects(older, newer) {
    if (!hasMeaningfulGuide(newer)) return hasMeaningfulGuide(older) ? older : newer;
    if (!hasMeaningfulGuide(older)) return newer;
    const a = isPlainObject(older) ? older : {};
    const b = isPlainObject(newer) ? newer : {};
    return {
      ...mergePlainObjects(a, b),
      rounds: mergeGuideRounds(a.rounds, b.rounds),
    };
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

  function mergeJournalObjects(older, newer) {
    if (!isPlainObject(newer)) return isPlainObject(older) ? older : newer;
    if (!isPlainObject(older)) return newer;
    const next = { ...older };
    Object.keys(newer).forEach((key) => {
      if (key === "insight") next.insight = mergeInsightObjects(older.insight, newer.insight);
      else if (key === "deep") next.deep = mergeDeepSlots(older.deep, newer.deep);
      else if (key === "deepPrompts") next.deepPrompts = pickFilled(older.deepPrompts, newer.deepPrompts);
      else if (key === "userMarks") next.userMarks = mergeUserMarks(older.userMarks, newer.userMarks);
      else if (key === "awarenessChoices" || key === "thinkChoices") next[key] = mergeChoiceBags(older[key], newer[key]);
      else if (key === "executionChoices") next[key] = mergeExecutionChoiceBags(older[key], newer[key]);
      else if (key === "manifestClose") next[key] = mergeManifestClose(older[key], newer[key]);
      else if (key === "manifestPlan") next[key] = mergeManifestPlan(older[key], newer[key]);
      else next[key] = pickFilled(older[key], newer[key]);
    });
    ["insight", "deep", "deepPrompts", "userMarks", "awarenessChoices", "thinkChoices", "executionChoices", "manifestClose", "manifestPlan"].forEach((key) => {
      const olderOk =
        key === "awarenessChoices" || key === "thinkChoices"
          ? hasMeaningfulChoices(older[key])
          : key === "executionChoices"
            ? hasMeaningfulExecutionChoices(older[key])
          : hasMeaningfulValue(older[key]);
      const nextOk =
        key === "awarenessChoices" || key === "thinkChoices"
          ? hasMeaningfulChoices(next[key])
          : key === "executionChoices"
            ? hasMeaningfulExecutionChoices(next[key])
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

  function applyHistoryArchiveFields(review, preferred, fallback) {
    if (!review || typeof review !== "object") return review;
    const rating = pickHistoryRating(preferred && preferred.historyRating, fallback && fallback.historyRating);
    const shortTitle = pickFilled(preferred && preferred.historyShortTitle, fallback && fallback.historyShortTitle);
    if (rating) review.historyRating = rating;
    else delete review.historyRating;
    if (hasMeaningfulValue(shortTitle)) review.historyShortTitle = String(shortTitle).trim();
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

  function pickCompletedProtected(left, right) {
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
    emptyExecutionChoiceBag,
    normalizeExecutionChoiceOptions,
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
    mergeInsightObjects,
    mergeThinkHistory,
    mergeJournalObjects,
    mergeUserMarks,
    pickReview,
    pickCompletedProtected,
    mergeReviewMaps,
    normalizeHistoryRating,
    pickHistoryRating,
    historyDeepThinkingSource,
    historyDeepThinkingView,
    visibleGuideRounds,
    reviewLooksEmpty,
    reviewIsFinalized,
  };
});
