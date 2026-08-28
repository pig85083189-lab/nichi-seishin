(function (root, factory) {
  const merge =
    (typeof require === "function"
      ? (function () {
          try {
            return require("./review-merge");
          } catch {
            return {};
          }
        })()
      : null) ||
    (root && root.NichiReviewMerge) ||
    {};
  const api = factory(merge);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiHistoryReading = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (merge) {
  "use strict";

  const STOP = new Set([
    "自己",
    "今天",
    "其實",
    "因為",
    "所以",
    "但是",
    "不是",
    "而是",
    "覺得",
    "發現",
    "一個",
    "一種",
    "這個",
    "那個",
    "什麼",
    "沒有",
    "可以",
    "還是",
    "只是",
    "已經",
    "真的",
    "比較",
    "開始",
    "一直",
    "可能",
    "好像",
    "也許",
    "值得",
    "繼續",
    "觀察",
  ]);

  function asText(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
    if (typeof value === "object") {
      return asText(value.text || value.title || value.deep || value.plain || value.conclusion || "");
    }
    return String(value).replace(/\s+/g, " ").trim();
  }

  function compactKey(text) {
    return String(text || "")
      .replace(/\s+/g, "")
      .replace(/[。！？!?，、；：:""「」『』（）()…·\-—～~]/g, "");
  }

  function fieldHighlights(bag, key) {
    if (!bag) return [];
    if (Array.isArray(bag)) return bag;
    if (typeof bag === "object" && Array.isArray(bag[key])) return bag[key];
    return [];
  }

  function nestedHighlights(bag, key) {
    if (!bag) return [];
    if (Array.isArray(bag)) return bag;
    return fieldHighlights(bag, key);
  }

  function thanksItems(journal) {
    const raw = journal && (journal.thanksText || journal.thanks);
    if (Array.isArray(raw)) return raw.map((item) => asText(item)).filter(Boolean);
    return String(raw || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function contentTokens(text) {
    const compact = compactKey(text);
    const tokens = [];
    for (let i = 0; i < compact.length - 1; i += 1) {
      const token = compact.slice(i, i + 2);
      if (STOP.has(token)) continue;
      tokens.push(token);
    }
    return tokens;
  }

  function ngramSet(text, size) {
    const compact = compactKey(text);
    const n = Math.min(size, compact.length);
    const out = new Set();
    if (n < 3) {
      if (compact) out.add(compact);
      return out;
    }
    for (let i = 0; i <= compact.length - n; i += 1) out.add(compact.slice(i, i + n));
    return out;
  }

  function overlapScore(left, right) {
    const a = compactKey(left);
    const b = compactKey(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const short = a.length <= b.length ? a : b;
    const long = a.length <= b.length ? b : a;
    if (short.length >= 8 && long.includes(short)) return short.length / long.length;
    const leftGrams = ngramSet(a, 4);
    const rightGrams = ngramSet(b, 4);
    if (!leftGrams.size || !rightGrams.size) return 0;
    let inter = 0;
    leftGrams.forEach((gram) => {
      if (rightGrams.has(gram)) inter += 1;
    });
    return inter / Math.min(leftGrams.size, rightGrams.size);
  }

  function looksLikeParaphrase(left, right) {
    const a = compactKey(left);
    const b = compactKey(right);
    if (!a || !b) return false;
    if (a === b) return true;
    const short = a.length <= b.length ? a : b;
    const long = a.length <= b.length ? b : a;
    if (short.length >= 8 && long.includes(short)) return true;
    for (let i = 0; i <= short.length - 8; i += 1) {
      if (long.includes(short.slice(i, i + 8))) return true;
    }
    if (overlapScore(left, right) >= 0.52) return true;
    const leftTokens = contentTokens(left);
    const rightTokens = contentTokens(right);
    if (leftTokens.length && rightTokens.length) {
      const rightSet = new Set(rightTokens);
      let shared = 0;
      const seen = new Set();
      leftTokens.forEach((token) => {
        if (seen.has(token) || !rightSet.has(token)) return;
        seen.add(token);
        shared += 1;
      });
      const ratio = shared / Math.min(new Set(leftTokens).size, new Set(rightTokens).size);
      if (ratio >= 0.62) return true;
    }
    return false;
  }

  function hasContrastGain(text) {
    return /不是.{0,24}而是|以為.{0,30}(其實|但)|原本.{0,30}(但|其實)|習慣告訴自己|表面上.{0,20}(其實|但)|一邊.{0,12}一邊/.test(
      String(text || "")
    );
  }

  const THEME_ATOMS = ["被看見", "被肯定", "被記得", "不夠好", "比較自己", "自己的節奏"];

  function sharedThemeAtoms(left, right) {
    const a = String(left || "");
    const b = String(right || "");
    return THEME_ATOMS.filter((atom) => a.includes(atom) && b.includes(atom));
  }

  function hasInformationGain(previousTexts, candidate) {
    const next = asText(candidate);
    if (!next) return false;
    const prev = (Array.isArray(previousTexts) ? previousTexts : [previousTexts]).map(asText).filter(Boolean);
    if (!prev.length) return true;
    if (prev.some((item) => compactKey(item) === compactKey(next))) return false;
    const paraphrases = prev.filter((item) => looksLikeParaphrase(item, next));
    if (paraphrases.length) {
      if (hasContrastGain(next) && !paraphrases.some(hasContrastGain) && overlapScore(paraphrases.join(""), next) < 0.78) {
        return true;
      }
      return false;
    }
    const blob = prev.join("");
    if (sharedThemeAtoms(blob, next).length && !hasContrastGain(next) && compactKey(next).length <= 40) {
      return false;
    }
    return true;
  }

  function piece(text, field, highlights) {
    const value = asText(text);
    if (!value) return null;
    return {
      text: value,
      field: String(field || "").trim(),
      highlights: Array.isArray(highlights) ? highlights : [],
    };
  }

  function pickDistinct(candidates, usedTexts, usedFields) {
    const texts = Array.isArray(usedTexts) ? usedTexts.slice() : [];
    const fields = usedFields instanceof Set ? usedFields : new Set(usedFields || []);
    const list = Array.isArray(candidates) ? candidates : [];
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (!item || !item.text) continue;
      if (item.field && fields.has(item.field)) continue;
      if (!hasInformationGain(texts, item.text)) continue;
      return item;
    }
    return null;
  }

  function looksLikeAnalysisNotAction(text) {
    const raw = asText(text);
    if (!raw) return true;
    if (/你其實|這代表你|你值得被|宇宙|正在提醒你|心理上/.test(raw)) return true;
    const hasActionCue = /明天|先|跟|寫|說|做|打|分享|放下|走|開始|練習|主動|不再|改成|打電話|告訴/.test(raw);
    if (raw.length > 90 && /因為|其實|代表/.test(raw) && !hasActionCue) return true;
    return false;
  }

  function guideOf(journal) {
    const insight = journal && journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
    return { insight, guide };
  }

  function awarenessResultOf(journal) {
    const raw = journal && journal.awarenessResult && typeof journal.awarenessResult === "object" ? journal.awarenessResult : {};
    const nested = raw.result && typeof raw.result === "object" ? raw.result : raw;
    return {
      seen: asText(nested.seen),
      gap: asText(nested.gap),
      line: asText(nested.line),
      question: asText(nested.question),
      highlights: nested.highlights && typeof nested.highlights === "object" ? nested.highlights : {},
    };
  }

  function lightBodySignals(journal) {
    const lines = [];
    const check = journal && journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : null;
    if (check) {
      const mood = check.mood && typeof check.mood === "object" ? check.mood : {};
      const moodFlags = Array.isArray(mood.flags) ? mood.flags.map(asText).filter(Boolean) : [];
      if (moodFlags.length || asText(mood.reason)) {
        lines.push({
          field: "bodyCheck.mood",
          text: `心情 ${moodFlags.join("、") || "平穩"}${asText(mood.reason) ? `｜${asText(mood.reason)}` : ""}`,
        });
      }
      const body = check.body && typeof check.body === "object" ? check.body : {};
      const bodyFlags = Array.isArray(body.flags) ? body.flags.map(asText).filter((item) => item && item !== "其他") : [];
      if (bodyFlags.length || asText(body.other) || asText(body.reason)) {
        const bodyLine = [...bodyFlags, asText(body.other)].filter(Boolean).join("、") || "狀態平穩";
        lines.push({
          field: "bodyCheck.body",
          text: `身體 ${bodyLine}${asText(body.reason) ? `｜${asText(body.reason)}` : ""}`,
        });
      }
      const sleep = check.sleep && typeof check.sleep === "object" ? check.sleep : {};
      if (asText(sleep.duration) || asText(sleep.quality) || asText(sleep.energy) || asText(sleep.reason)) {
        const bits = [];
        if (asText(sleep.duration)) bits.push(asText(sleep.duration));
        if (asText(sleep.quality)) bits.push(asText(sleep.quality));
        if (asText(sleep.energy)) bits.push(`起床精神${asText(sleep.energy)}`);
        if (asText(sleep.reason)) bits.push(asText(sleep.reason));
        lines.push({ field: "bodyCheck.sleep", text: `睡眠 ${bits.join("｜")}` });
      }
    }
    if (!lines.length && journal && journal.bodyTags) {
      const tags = Array.isArray(journal.bodyTags)
        ? journal.bodyTags.map(asText).filter(Boolean)
        : String(journal.bodyTags)
            .split(/[、,]/)
            .map((item) => item.trim())
            .filter(Boolean);
      if (tags.length) lines.push({ field: "bodyCheck.mood", text: tags.join("、") });
    }
    return lines;
  }

  function hasCoachLongform(journal) {
    const coach = journal && journal.bodyCoach && typeof journal.bodyCoach === "object" ? journal.bodyCoach : {};
    return Boolean(asText(coach.analysis) || asText(coach.notice) || (Array.isArray(coach.suggestions) && coach.suggestions.some(asText)));
  }

  function guideRounds(journal) {
    const { guide } = guideOf(journal);
    const raw = guide.rounds;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
      return Object.keys(raw)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => raw[key])
        .filter((item) => item && typeof item === "object");
    }
    return [];
  }

  function roundHasContent(round) {
    return Boolean(asText(round && (round.question || round.answer || round.hint)));
  }

  function collectActions(journal) {
    const selected =
      merge && typeof merge.selectedExecutionChoiceActions === "function"
        ? merge.selectedExecutionChoiceActions(journal && journal.executionChoices)
        : [];
    if (Array.isArray(selected) && selected.length) {
      return selected
        .map((item, index) => piece(item && item.text, index === 0 ? "exec.smallestStep" : `exec.selected.${index}`))
        .filter(Boolean);
    }
    const smallest = piece(journal && journal.smallestStep, "exec.smallestStep");
    if (smallest) return [smallest];
    const answers = Array.isArray(journal && journal.execution) ? journal.execution : [];
    const fromAnswers = answers.map((item, index) => piece(item, `exec.prompt.${index}.answer`)).filter(Boolean);
    if (fromAnswers.length) return fromAnswers.slice(0, 2);
    const cards = Array.isArray(journal && journal.executionCheckItems) ? journal.executionCheckItems : [];
    const fromCards = cards
      .map((item, index) =>
        piece(item && (item.title || item.text), `exec.item.${index}.title`, nestedHighlights(item && item.highlights, "title"))
      )
      .filter(Boolean);
    if (fromCards.length) return fromCards.slice(0, 2);
    const { guide } = guideOf(journal);
    const actions = Array.isArray(guide.actions) ? guide.actions : [];
    return actions
      .map((item, index) => {
        const text = asText(item);
        if (!text || looksLikeAnalysisNotAction(text)) return null;
        return piece(text, `think.action.${index}`, fieldHighlights(guide.highlights, "actions"));
      })
      .filter(Boolean)
      .slice(0, 2);
  }

  function stuckCandidates(journal, review, aware) {
    const { insight, guide } = guideOf(journal);
    const marks = guide.highlights && typeof guide.highlights === "object" ? guide.highlights : {};
    const insightMarks = insight.highlights && typeof insight.highlights === "object" ? insight.highlights : {};
    const list = [];
    list.push(piece(aware.gap, "awareness.gap", fieldHighlights(aware.highlights, "gap")));
    list.push(piece(guide.awareness || guide.summary, "think.awareness", fieldHighlights(marks, "awareness")));
    list.push(piece(insight.psychology || insight.analysis, "think.psychology", fieldHighlights(insightMarks, "psychology")));
    list.push(piece(insight.conclusion || insight.summary, "think.psychology", fieldHighlights(insightMarks, "psychology")));
    const thinkChoices =
      merge && typeof merge.selectedChoiceTexts === "function" ? merge.selectedChoiceTexts(journal && journal.thinkChoices) : [];
    (Array.isArray(thinkChoices) ? thinkChoices : []).forEach((text, index) => {
      list.push(piece(text, `think.choice.${index}`));
    });
    list.push(piece(aware.seen, "awareness.seen", fieldHighlights(aware.highlights, "seen")));
    const thinkHistory = Array.isArray(review && review.thinkHistory) ? review.thinkHistory : [];
    for (let i = thinkHistory.length - 1; i >= 0; i -= 1) {
      const round = thinkHistory[i] || {};
      const points = Array.isArray(round.points) ? round.points : [];
      const conclusion = asText(points[0] && points[0].conclusion) || asText(round.insight) || asText(round.conclusion);
      if (conclusion) {
        list.push(piece(conclusion, `thinkHistory.${i}.conclusion.0`));
        break;
      }
    }
    const deep = journal && journal.deep;
    const slots = Array.isArray(deep) ? deep : deep && typeof deep === "object" ? [deep] : [];
    if (slots[0]) {
      list.push(piece(slots[0].deep, "deep.0.deep"));
      list.push(piece(slots[0].plain, "deep.0.plain"));
    }
    return list.filter(Boolean);
  }

  function seenCandidates(journal, aware) {
    const { insight, guide } = guideOf(journal);
    const marks = guide.highlights && typeof guide.highlights === "object" ? guide.highlights : {};
    const insightMarks = insight.highlights && typeof insight.highlights === "object" ? insight.highlights : {};
    const list = [];
    list.push(piece(guide.selfSeen, "think.selfSeen", fieldHighlights(marks, "selfSeen")));
    list.push(piece(aware.seen, "awareness.seen", fieldHighlights(aware.highlights, "seen")));
    list.push(piece(insight.reflection, "think.reflection", fieldHighlights(insightMarks, "reflection")));
    const awareChoices =
      merge && typeof merge.selectedChoiceTexts === "function" ? merge.selectedChoiceTexts(journal && journal.awarenessChoices) : [];
    (Array.isArray(awareChoices) ? awareChoices : []).forEach((text, index) => {
      list.push(piece(text, `awareness.choice.${index}`));
    });
    return list.filter(Boolean);
  }

  function quoteCandidates(journal, aware) {
    const { guide } = guideOf(journal);
    const marks = guide.highlights && typeof guide.highlights === "object" ? guide.highlights : {};
    const list = [];
    list.push(piece(aware.line, "awareness.line", fieldHighlights(aware.highlights, "line")));
    list.push(piece(guide.takeaway, "think.takeaway", fieldHighlights(marks, "takeaway")));
    const quotes = Array.isArray(journal && journal.awarenessCheckItems)
      ? journal.awarenessCheckItems
      : Array.isArray(journal && journal.awarenessChecks)
        ? journal.awarenessChecks
        : [];
    if (quotes[0]) list.push(piece(quotes[0], "awareness.quote.0"));
    return list.filter(Boolean);
  }

  function hasDeepProcess(journal, review) {
    if (guideRounds(journal).some(roundHasContent)) return true;
    const thinkHistory = Array.isArray(review && review.thinkHistory) ? review.thinkHistory : [];
    if (thinkHistory.some((item) => asText(item && (item.question || item.reply || item.insight || item.title)))) return true;
    const deep = journal && journal.deep;
    const slots = Array.isArray(deep) ? deep : deep && typeof deep === "object" ? [deep] : [];
    if (slots.some((slot) => asText(slot && (slot.deep || slot.plain)))) return true;
    if (Array.isArray(journal && journal.deepPrompts) && journal.deepPrompts.length) return true;
    return false;
  }

  function hasAwareProcess(journal) {
    const answers = Array.isArray(journal && journal.awareness) ? journal.awareness : [];
    if (answers.some((item) => asText(item))) return true;
    const bag = journal && journal.awarenessChoices;
    if (merge && typeof merge.hasMeaningfulChoices === "function" && merge.hasMeaningfulChoices(bag)) return true;
    return false;
  }

  function buildHistoryReading(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const aware = awarenessResultOf(journal);
    const thanks = thanksItems(journal);
    const event = asText(journal.event);
    const mood = asText(journal.mood);
    const bodySignals = lightBodySignals(journal);
    const usedFields = new Set();
    const usedTexts = thanks.slice();

    const stuck = pickDistinct(stuckCandidates(journal, review, aware), usedTexts, usedFields);
    if (stuck) {
      usedFields.add(stuck.field);
      usedTexts.push(stuck.text);
    }

    const seen = pickDistinct(seenCandidates(journal, aware), [event, ...usedTexts], usedFields);
    if (seen) {
      usedFields.add(seen.field);
      usedTexts.push(seen.text);
    }

    const actions = collectActions(journal).filter((item) => {
      if (!item || usedFields.has(item.field)) return false;
      usedFields.add(item.field);
      return true;
    });

    const quote = pickDistinct(quoteCandidates(journal, aware), [], usedFields) || quoteCandidates(journal, aware)[0] || null;
    if (quote && quote.field) usedFields.add(quote.field);

    return {
      happened: {
        thanks,
        event,
        mood,
        bodySignals,
      },
      stuck,
      seen,
      actions,
      quote,
      usedFields: [...usedFields],
      archive: {
        hasDeepProcess: hasDeepProcess(journal, review),
        hasBodyCoach: hasCoachLongform(journal),
        hasAwareProcess: hasAwareProcess(journal),
        hasGuideRounds: guideRounds(journal).some(roundHasContent),
      },
    };
  }

  return {
    asText,
    compactKey,
    looksLikeParaphrase,
    hasInformationGain,
    hasContrastGain,
    lightBodySignals,
    buildHistoryReading,
  };
});
