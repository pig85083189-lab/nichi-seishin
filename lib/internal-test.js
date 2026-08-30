(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiInternalTest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_INTERNAL_TEST_RUNS = 20;

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function compactIso(value) {
    return String(value || "").trim();
  }

  function stampMs(value) {
    const parsed = Date.parse(compactIso(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function internalResetAtMs(review) {
    if (!review || typeof review !== "object") return 0;
    const fromReview = stampMs(review.internalResetAt);
    if (fromReview) return fromReview;
    const journal = isPlainObject(review.journal) ? review.journal : {};
    return stampMs(journal.internalResetAt);
  }

  function journalLooksMeaningful(journal) {
    if (!isPlainObject(journal)) return false;
    const text = [
      journal.thanks,
      journal.thanksText,
      journal.event,
      journal.mood,
      journal.bodyNote,
      journal.bodyMind && journal.bodyMind.text,
      journal.bodyMind && journal.bodyMind.insight,
      journal.smallestStep,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    if (text.length) return true;
    if (journal.insight && typeof journal.insight === "object" && (journal.insight.title || (journal.insight.guide && journal.insight.guide.rounds && journal.insight.guide.rounds.length))) {
      return true;
    }
    if (journal.awarenessChoices && Array.isArray(journal.awarenessChoices.options) && journal.awarenessChoices.options.length) return true;
    if (journal.executionChoices && Array.isArray(journal.executionChoices.options) && journal.executionChoices.options.length) return true;
    return false;
  }

  function snapshotWithoutRuns(journal) {
    if (!isPlainObject(journal)) return {};
    const next = { ...journal };
    delete next.internalTestRuns;
    return next;
  }

  function normalizeInternalTestRun(raw) {
    if (!isPlainObject(raw)) return null;
    const snapshot = isPlainObject(raw.snapshot) ? raw.snapshot : {};
    const journal = snapshotWithoutRuns(isPlainObject(snapshot.journal) ? snapshot.journal : snapshot);
    if (!raw.id && !journalLooksMeaningful(journal) && !compactIso(raw.completedAt)) return null;
    return {
      id: compactIso(raw.id) || `itr_${Math.random().toString(36).slice(2, 10)}`,
      createdAt: compactIso(raw.createdAt),
      completedAt: compactIso(raw.completedAt),
      snapshot: {
        journal,
        rawText: compactIso(snapshot.rawText),
        gratitude: compactIso(snapshot.gratitude),
        organize: snapshot.organize && typeof snapshot.organize === "object" ? snapshot.organize : null,
      },
    };
  }

  function normalizeInternalTestRuns(raw) {
    const list = Array.isArray(raw) ? raw.map(normalizeInternalTestRun).filter(Boolean) : [];
    const seen = new Set();
    const unique = [];
    list.forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      unique.push(item);
    });
    unique.sort((a, b) => Math.max(stampMs(b.completedAt), stampMs(b.createdAt)) - Math.max(stampMs(a.completedAt), stampMs(a.createdAt)));
    return unique.slice(0, MAX_INTERNAL_TEST_RUNS);
  }

  function mergeInternalTestRuns(older, newer) {
    return normalizeInternalTestRuns([...(Array.isArray(newer) ? newer : []), ...(Array.isArray(older) ? older : [])]);
  }

  function buildInternalTestSnapshot(review) {
    const data = review && typeof review === "object" ? review : {};
    const journal = snapshotWithoutRuns(isPlainObject(data.journal) ? data.journal : {});
    if (!journalLooksMeaningful(journal) && !compactIso(data.completedAt) && !compactIso(data.rawText)) return null;
    return {
      journal,
      rawText: compactIso(data.rawText),
      gratitude: compactIso(data.gratitude),
      organize: data.organize && typeof data.organize === "object" ? data.organize : null,
    };
  }

  function applyInternalTodayReset(review, options = {}) {
    const prev = review && typeof review === "object" ? review : {};
    const resetAt = compactIso(options.resetAt) || new Date().toISOString();
    const prevJournal = isPlainObject(prev.journal) ? prev.journal : {};
    const runs = normalizeInternalTestRuns(prevJournal.internalTestRuns);
    const snapshot = buildInternalTestSnapshot(prev);
    if (snapshot) {
      runs.unshift({
        id: compactIso(options.id) || `itr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: compactIso(prev.createdAt) || compactIso(prev.updatedAt) || resetAt,
        completedAt: compactIso(prev.completedAt),
        snapshot,
      });
    }
    const kept = normalizeInternalTestRuns(runs);
    return {
      date: compactIso(prev.date || options.date),
      userId: compactIso(prev.userId || options.userId),
      createdAt: resetAt,
      completedAt: "",
      organize: null,
      rawText: "",
      gratitude: "",
      selectedQuotes: [],
      selectedSfm: [],
      selectedThinkActions: [],
      selectedPractice: [],
      thinkHistory: [],
      historyRating: 0,
      historyShortTitle: "",
      internalResetAt: resetAt,
      journal: {
        internalTestRuns: kept,
        internalResetAt: resetAt,
      },
      updatedAt: resetAt,
    };
  }

  function canReopenCompletedForInternalReset(resetReview, completedReview) {
    const resetAt = internalResetAtMs(resetReview);
    if (!resetAt) return false;
    if (completedReview && compactIso(completedReview.completedAt) && resetAt < stampMs(completedReview.completedAt)) {
      return false;
    }
    return !compactIso(resetReview && resetReview.completedAt);
  }

  return {
    MAX_INTERNAL_TEST_RUNS,
    internalResetAtMs,
    journalLooksMeaningful,
    normalizeInternalTestRun,
    normalizeInternalTestRuns,
    mergeInternalTestRuns,
    buildInternalTestSnapshot,
    applyInternalTodayReset,
    canReopenCompletedForInternalReset,
    snapshotWithoutRuns,
  };
});
