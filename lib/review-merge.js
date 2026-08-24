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

  function mergeJournalObjects(older, newer) {
    if (!isPlainObject(newer)) return isPlainObject(older) ? older : newer;
    if (!isPlainObject(older)) return newer;
    const next = { ...older };
    Object.keys(newer).forEach((key) => {
      if (key === "insight") next.insight = mergeInsightObjects(older.insight, newer.insight);
      else if (key === "deep") next.deep = mergeDeepSlots(older.deep, newer.deep);
      else if (key === "deepPrompts") next.deepPrompts = pickFilled(older.deepPrompts, newer.deepPrompts);
      else if (key === "userMarks") next.userMarks = mergeUserMarks(older.userMarks, newer.userMarks);
      else next[key] = pickFilled(older[key], newer[key]);
    });
    ["insight", "deep", "deepPrompts", "userMarks"].forEach((key) => {
      if (hasMeaningfulValue(older[key]) && !hasMeaningfulValue(next[key])) next[key] = older[key];
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

  function reviewLooksEmpty(review) {
    if (!review || typeof review !== "object") return true;
    if (review.completedAt) return false;
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
    return next;
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
    pickFilled,
    mergeGuideRounds,
    mergeGuideObjects,
    mergeInsightObjects,
    mergeThinkHistory,
    mergeJournalObjects,
    mergeUserMarks,
    pickReview,
    mergeReviewMaps,
    historyDeepThinkingSource,
    historyDeepThinkingView,
    visibleGuideRounds,
    reviewLooksEmpty,
  };
});
