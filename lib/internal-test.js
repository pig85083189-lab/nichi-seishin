(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiInternalTest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_INTERNAL_TEST_RUNS = 20;
  const PIPELINE_TRACE_STORAGE_KEY = "ing_internal_pipeline_trace";
  const MAX_CODE_CHARS = 64;

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function getDefaultTraceStorage() {
    try {
      if (typeof localStorage !== "undefined" && localStorage) return localStorage;
    } catch (_err) {
      /* ignore */
    }
    return null;
  }

  function asTraceCode(value) {
    if (value == null) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text || text.length > MAX_CODE_CHARS) return null;
      return text;
    }
    return null;
  }

  function sanitizePresence(bag) {
    if (!isPlainObject(bag)) return null;
    return {
      focusPresent: Boolean(bag.focusPresent),
      focusLength: Number(bag.focusLength) || 0,
      whyPresent: Boolean(bag.whyPresent),
      whyLength: Number(bag.whyLength) || 0,
      questionPresent: Boolean(bag.questionPresent),
      questionLength: Number(bag.questionLength) || 0,
    };
  }

  function sanitizeBoundaryCodes(bag) {
    if (!isPlainObject(bag)) return {};
    const out = {};
    Object.keys(bag).forEach((key) => {
      const code = asTraceCode(bag[key]);
      if (typeof code === "string") out[key] = code;
    });
    return out;
  }

  function sanitizeSeeTrace(raw) {
    if (!isPlainObject(raw)) return null;
    const boundary = isPlainObject(raw.boundary) ? raw.boundary : {};
    const sources = isPlainObject(raw.inputSources) ? raw.inputSources : null;
    const out = {
      finalStatus: asTraceCode(raw.finalStatus) || "",
      insightPresent: Boolean(raw.insightPresent),
      boundary: {
        insight: asTraceCode(boundary.insight) || "",
        support: asTraceCode(boundary.support) || "",
      },
    };
    // V2 SEE structural extras (metadata only).
    if (asTraceCode(raw.engine)) out.engine = asTraceCode(raw.engine);
    if (sources) {
      out.inputSources = {
        thanks: Boolean(sources.thanks),
        event: Boolean(sources.event),
        mood: Boolean(sources.mood),
        bodyMind: Boolean(sources.bodyMind),
      };
    }
    if (raw.reflectionCount != null) out.reflectionCount = Number(raw.reflectionCount) || 0;
    if (raw.hasCoreQuote != null) out.hasCoreQuote = Boolean(raw.hasCoreQuote);
    if (raw.hasNewAngle != null) out.hasNewAngle = Boolean(raw.hasNewAngle);
    if (asTraceCode(raw.outputStatus)) out.outputStatus = asTraceCode(raw.outputStatus);
    return out;
  }

  function sanitizeUnderstandTrace(raw) {
    if (!isPlainObject(raw)) return null;
    return {
      reasonerStatus: asTraceCode(raw.reasonerStatus) || "",
      candidateCount: Number(raw.candidateCount) || 0,
      usableCandidateCount: Number(raw.usableCandidateCount) || 0,
      selectorStatus: asTraceCode(raw.selectorStatus) || "",
      coreSelected: Boolean(raw.coreSelected),
      writerAttempted: Boolean(raw.writerAttempted),
      writerStatus: asTraceCode(raw.writerStatus) || "",
      preBoundary: sanitizePresence(raw.preBoundary) || sanitizePresence({}),
      boundary: sanitizeBoundaryCodes(raw.boundary),
      postBoundary: sanitizePresence(raw.postBoundary) || sanitizePresence({}),
      projectionStatus: asTraceCode(raw.projectionStatus) || "",
      finalStage: asTraceCode(raw.finalStage) || "",
      finalStatus: asTraceCode(raw.finalStatus) || "",
      silenceReason: asTraceCode(raw.silenceReason),
    };
  }

  function sanitizeGrowTrace(raw) {
    if (!isPlainObject(raw)) return null;
    return {
      inputUnderstandStage: asTraceCode(raw.inputUnderstandStage) || "",
      inputUnderstandStop: Boolean(raw.inputUnderstandStop),
      candidateCountBefore: Number(raw.candidateCountBefore) || 0,
      itemCountAfterGate: Number(raw.itemCountAfterGate) || 0,
      itemCountAfterBoundary: Number(raw.itemCountAfterBoundary) || 0,
      finalStatus: asTraceCode(raw.finalStatus) || "",
      selectedIdsCount: Number(raw.selectedIdsCount) || 0,
      skipReason: asTraceCode(raw.skipReason),
    };
  }

  function sanitizeActTrace(raw) {
    if (!isPlainObject(raw)) return null;
    return {
      growStatus: asTraceCode(raw.growStatus) || "",
      selectedIdsCount: Number(raw.selectedIdsCount) || 0,
      executionAttempted: Boolean(raw.executionAttempted),
      finalStatus: asTraceCode(raw.finalStatus) || "",
      stopHeavyReason: asTraceCode(raw.stopHeavyReason),
      blockedReason: asTraceCode(raw.blockedReason),
    };
  }

  function extractPipelineTraces(reason) {
    if (!isPlainObject(reason)) return null;
    const seeTrace = sanitizeSeeTrace(reason.seeTrace);
    const understandTrace = sanitizeUnderstandTrace(reason.understandTrace);
    const growTrace = sanitizeGrowTrace(reason.growTrace);
    const actTrace = sanitizeActTrace(reason.actTrace);
    if (!seeTrace && !understandTrace && !growTrace && !actTrace) return null;
    return { seeTrace, understandTrace, growTrace, actTrace };
  }

  function readPipelineTrace(storage) {
    const store = storage || getDefaultTraceStorage();
    if (!store || typeof store.getItem !== "function") return null;
    try {
      const raw = store.getItem(PIPELINE_TRACE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  function clearPipelineTrace(storage) {
    const store = storage || getDefaultTraceStorage();
    if (!store || typeof store.removeItem !== "function") return;
    try {
      store.removeItem(PIPELINE_TRACE_STORAGE_KEY);
    } catch (_err) {
      /* ignore */
    }
  }

  /**
   * Retain ONLY structural pipeline traces from Internal `_internalReason`.
   * Merges latest per stage into one bag so 03→06 can be inspected together.
   */
  function retainPipelineTraceFromReason(reason, options = {}) {
    const extracted = extractPipelineTraces(reason);
    if (!extracted) return null;
    const store = options.storage || getDefaultTraceStorage();
    if (!store || typeof store.setItem !== "function") return null;

    const now = compactIso(options.timestamp) || new Date().toISOString();
    const prev = readPipelineTrace(store) || {};
    const next = {
      timestamp: now,
      stage: compactIso(prev.stage) || "",
      seeTrace: isPlainObject(prev.seeTrace) ? prev.seeTrace : undefined,
      understandTrace: isPlainObject(prev.understandTrace) ? prev.understandTrace : undefined,
      growTrace: isPlainObject(prev.growTrace) ? prev.growTrace : undefined,
      actTrace: isPlainObject(prev.actTrace) ? prev.actTrace : undefined,
      stageUpdatedAt: isPlainObject(prev.stageUpdatedAt) ? { ...prev.stageUpdatedAt } : {},
    };

    if (extracted.seeTrace) {
      next.seeTrace = extracted.seeTrace;
      next.stage = "see";
      next.stageUpdatedAt.see = now;
    }
    if (extracted.understandTrace) {
      next.understandTrace = extracted.understandTrace;
      next.stage = "understand";
      next.stageUpdatedAt.understand = now;
    }
    if (extracted.growTrace) {
      next.growTrace = extracted.growTrace;
      next.stage = "grow";
      next.stageUpdatedAt.grow = now;
    }
    if (extracted.actTrace) {
      next.actTrace = extracted.actTrace;
      next.stage = "act";
      next.stageUpdatedAt.act = now;
    }

    // Drop undefined keys for a compact stored JSON.
    Object.keys(next).forEach((key) => {
      if (next[key] === undefined) delete next[key];
    });

    try {
      store.setItem(PIPELINE_TRACE_STORAGE_KEY, JSON.stringify(next));
    } catch (_err) {
      return null;
    }
    return next;
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
    if (journal.insight && typeof journal.insight === "object") {
      const guide = journal.insight.guide && typeof journal.insight.guide === "object" ? journal.insight.guide : {};
      if (
        journal.insight.title ||
        (Array.isArray(guide.rounds) && guide.rounds.length) ||
        String(guide.coreQuote || "").trim() ||
        (guide.extension && Array.isArray(guide.extension.rounds) && guide.extension.rounds.length)
      ) {
        return true;
      }
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
    PIPELINE_TRACE_STORAGE_KEY,
    internalResetAtMs,
    journalLooksMeaningful,
    normalizeInternalTestRun,
    normalizeInternalTestRuns,
    mergeInternalTestRuns,
    buildInternalTestSnapshot,
    applyInternalTodayReset,
    canReopenCompletedForInternalReset,
    snapshotWithoutRuns,
    extractPipelineTraces,
    sanitizeSeeTrace,
    sanitizeUnderstandTrace,
    sanitizeGrowTrace,
    sanitizeActTrace,
    retainPipelineTraceFromReason,
    readPipelineTrace,
    clearPipelineTrace,
  };
});
