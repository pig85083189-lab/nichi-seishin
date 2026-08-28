(function (root, factory) {
  const merge =
    (typeof require === "function" ? (function () {
      try {
        return require("./review-merge");
      } catch {
        return {};
      }
    })() : null) ||
    (root && root.NichiReviewMerge) ||
    {};
  const api = factory(merge);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiHistorySummary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (merge) {
  "use strict";

  const integrity =
    (typeof require === "function"
      ? (function () {
          try {
            return require("./text-integrity");
          } catch {
            return {};
          }
        })()
      : null) ||
    (typeof globalThis !== "undefined" && globalThis.NichiTextIntegrity) ||
    {};

  const FALLBACK_TITLE = "看看這一天留下的紀錄";
  const TITLE_MIN = 14;
  const TITLE_SOFT_MIN = 8;
  const TITLE_PREFERRED = 48;
  const TITLE_HARD_MAX = 80;
  const LIST_TITLE_MIN = 12;
  const LIST_TITLE_MAX = 24;
  const PRIMARY_HISTORY_CATEGORIES = ["自我覺察", "身心狀態", "人際關係", "感恩", "行動力"];
  const CATEGORY_ALIASES = {
    覺察: "自我覺察",
    今日覺察: "自我覺察",
    核心覺察: "自我覺察",
    自我價值: "自我覺察",
    學習成長: "自我覺察",
    成長: "自我覺察",
    親密關係: "人際關係",
    家庭: "人際關係",
    關係: "人際關係",
    伴侶: "人際關係",
    朋友: "人際關係",
    團隊: "人際關係",
    休息: "身心狀態",
    生活平衡: "身心狀態",
    睡眠: "身心狀態",
    健康: "身心狀態",
    身體: "身心狀態",
    幸福: "感恩",
    珍惜: "感恩",
    執行: "行動力",
    下一步: "行動力",
    目標: "行動力",
    工作成長: "行動力",
  };

  const THEME_QUOTES = [
    {
      id: "accompany",
      re: /陪伴|陪陪|空間|孤單|距離/,
      quotes: [
        "陪伴不是一直靠近，而是知道什麼時候給彼此空間",
        "真正的陪伴，是靠近的同時也懂得留下空間",
        "有些陪伴不需要很多話，願意出現就已經很重要",
      ],
    },
    {
      id: "family",
      re: /家人|爸爸|媽媽|父母|小孩|家庭/,
      quotes: [
        "對家人的陪伴，是靠近時也記得留下空間",
        "願意出現在家人身邊，本身就是一種愛的表達",
        "陪家人吃飯的時候，也看見彼此都需要被記得",
      ],
    },
    {
      id: "seen",
      re: /被看見|被記得|別人變好|價值|影響力|客人|變亮/,
      quotes: [
        "看見別人變好，也讓我看見自己的價值",
        "看見別人的改變，也重新看見了自己的影響力",
        "被記得的開心背後，其實是想確認自己有價值",
      ],
    },
    {
      id: "rest",
      re: /休息|睡眠|只睡|身體|疲憊|疲累|累了|照顧自己/,
      quotes: [
        "真正的休息，是開始聽見身體的需要",
        "在忙著完成事情時，也別忘了聽聽身體的聲音",
        "身體的提醒，其實是叫我先停下來照顧自己",
      ],
    },
    {
      id: "complete",
      re: /完成|成就|證明|很多事情|執行|下一步/,
      quotes: [
        "完成不是為了證明自己，而是讓想法慢慢成為現實",
        "事情做完很重要，把自己照顧好也一樣重要",
      ],
    },
    {
      id: "gratitude",
      re: /感恩|感謝|謝謝|付出愛|愛的能量/,
      quotes: [
        "付出愛與感恩，讓平凡的一天變得有意義",
        "愛的能量，是自己有能力創造出來的",
        "感恩不是裝飾，而是把平凡的一天看清楚",
      ],
    },
    {
      id: "compare",
      re: /比較|節奏|不夠好|證明自己/,
      quotes: [
        "比較讓我忘記節奏時，更要回到自己身上",
        "不必靠比較來確認自己，節奏本來就不一樣",
      ],
    },
    {
      id: "balance",
      re: /平衡|接納|慌張|距離之間/,
      quotes: [
        "在陪伴與距離之間，找到自己的平衡",
        "從慌張走到接納，我也開始找到自己的節奏",
      ],
    },
  ];

  const COMBO_QUOTES = [
    {
      ids: ["complete", "rest"],
      quotes: [
        "完成很多事情之外，也別忘了照顧自己的狀態",
        "在忙著完成事情時，也別忘了聽聽身體的聲音",
      ],
    },
    {
      ids: ["accompany", "family"],
      quotes: [
        "陪伴不是一直靠近，而是在需要時好好出現",
        "真正的陪伴，是靠近的同時也懂得留下空間",
      ],
    },
    {
      ids: ["seen", "gratitude"],
      quotes: [
        "看見別人變好，也讓我看見自己的價值",
        "付出之後被看見，其實也重新看見了自己",
      ],
    },
  ];

  const TAG_RULES = [
    { tag: "感恩", re: /感謝|感恩|謝謝|有它/ },
    { tag: "休息", re: /休息|放鬆|慢下來|停一下|不要硬撐/ },
    { tag: "自我價值", re: /價值|被看見|不夠好|比較|配得/ },
    { tag: "親密關係", re: /伴侶|男友|女友|愛人|親密|另一半/ },
    { tag: "家庭", re: /家人|媽媽|爸爸|父母|小孩|孩子|家庭/ },
    { tag: "人際關係", re: /朋友|同事|人際|關係|別人|他人|對方/ },
    { tag: "工作成長", re: /工作|職場|會議|業績|客戶|事業/ },
    { tag: "行動力", re: /執行|下一步|行動|最小的一步|開始做/ },
    { tag: "身心狀態", re: /身體|睡眠|疲憊|累|心情|情緒|疼痛|痠/ },
    { tag: "生活平衡", re: /平衡|照顧自己|節奏|過載|忙/ },
    { tag: "學習成長", re: /學習|成長|練習|進步/ },
    { tag: "自我覺察", re: /看見自己|覺察|我發現|原來我|自己的模式/ },
  ];

  function hasMeaningfulValue(value) {
    if (merge && typeof merge.hasMeaningfulValue === "function") return merge.hasMeaningfulValue(value);
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
    if (typeof value === "object") return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
    return Boolean(value);
  }

  function asText(value) {
    if (!hasMeaningfulValue(value)) return "";
    if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
    if (Array.isArray(value)) {
      return value
        .map((item) => asText(item && (item.text || item.title || item.conclusion || item)))
        .filter(Boolean)
        .join(" ");
    }
    if (typeof value === "object") {
      return asText(value.text || value.title || value.conclusion || value.line || value.seen || "");
    }
    return String(value).trim();
  }

  function compactLen(text) {
    return String(text || "").replace(/\s+/g, "").length;
  }

  function cleanTitleText(text) {
    return asText(text)
      .replace(/^[「『“"']+|[」』”"']+$/g, "")
      .replace(/[。！？!?…]+$/g, "")
      .trim();
  }

  function firstCompleteSentence(text) {
    const cleaned = cleanTitleText(text);
    if (!cleaned) return "";
    const match = cleaned.match(/^.+?[。！？!?]/);
    return cleanTitleText(match ? match[0] : cleaned);
  }

  function completeClauses(text) {
    const sentence = firstCompleteSentence(text);
    if (!sentence) return [];
    if (quoteLooksComplete(sentence) && compactLen(sentence) <= TITLE_HARD_MAX) {
      return [cleanTitleText(sentence)];
    }
    return [];
  }

  function looksLikeEventNarration(text) {
    const raw = cleanTitleText(text);
    if (!raw) return false;
    if (/^今天我/.test(raw)) return true;
    if (/今天(去|發生|做了|開會|吃飯|完成)|偶爾抽空|陪陪|很久沒有看到|客人臉|只睡/.test(raw)) return true;
    if (/去陪|去看|去吃|突然覺得他們|睡眠不足|硬把事情|還是硬|很有成就感/.test(raw)) return true;
    return false;
  }

  function looksLikeInsightQuote(text) {
    const raw = cleanTitleText(text);
    if (!raw || looksLikeEventNarration(raw)) return false;
    return /不是.{1,16}而是|而不是|真正的|也讓我看見|也重新看見|也別忘了|同時也|開始聽見|其實是|我開始看見|自己的(價值|節奏|需要|平衡|空間|狀態|影響力)|愛的能量|付出愛與感恩/.test(
      raw
    );
  }

  function canReuseSourceQuote(key, text) {
    const raw = cleanTitleText(text);
    if (!raw || looksLikeEventNarration(raw) || !quoteLooksComplete(raw)) return false;
    if (key === "takeaway" || key === "line") return true;
    return looksLikeInsightQuote(raw);
  }

  function quoteLooksComplete(text) {
    const raw = cleanTitleText(text);
    if (!raw) return false;
    if (typeof integrity.isFinishedThought === "function" && !integrity.isFinishedThought(raw)) return false;
    if (typeof integrity.isCompleteSentence !== "function") return true;
    if (integrity.isCompleteSentence(raw)) return true;
    if (typeof integrity.looksComplete === "function") return integrity.looksComplete(raw);
    return integrity.isCompleteSentence(`${raw}。`);
  }

  function scoreQuoteCandidate(text, sourceWeight) {
    const raw = cleanTitleText(text);
    const n = compactLen(raw);
    if (!raw || n > TITLE_HARD_MAX || n < 6) return 0;
    if (n < TITLE_SOFT_MIN && !quoteLooksComplete(raw)) return 0;
    if (!quoteLooksComplete(raw)) return 0;
    if (looksLikeEventNarration(raw)) return 0;
    let score = sourceWeight;
    if (looksLikeInsightQuote(raw)) score += 90;
    if (n >= TITLE_MIN && n <= TITLE_PREFERRED) score += 40;
    else if (n <= TITLE_HARD_MAX) score += 16;
    if (/^今天/.test(raw)) score -= 30;
    return score;
  }

  function stableIndex(seed, length) {
    if (!length) return 0;
    const raw = String(seed || "");
    let total = 0;
    for (let i = 0; i < raw.length; i += 1) total += raw.charCodeAt(i) * (i + 3);
    return total % length;
  }

  function countThemeHits(re, blob) {
    const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    return (String(blob || "").match(copy) || []).length;
  }

  function detectThemes(blob) {
    return THEME_QUOTES.map((theme) => ({
      id: theme.id,
      quotes: theme.quotes,
      count: countThemeHits(theme.re, blob),
    }))
      .filter((theme) => theme.count > 0)
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
  }

  function pickThemedQuote(themes, seed) {
    if (!themes.length) return "";
    const ids = themes.slice(0, 2).map((theme) => theme.id);
    const combo = COMBO_QUOTES.find((item) => item.ids.every((id) => ids.includes(id)));
    const pool = combo ? combo.quotes : themes[0].quotes;
    return pool[stableIndex(seed, pool.length)] || pool[0] || "";
  }

  function reviewSeed(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    return [review && review.date, journal.event, thanksText(journal), journal.insight && journal.insight.guide && journal.insight.guide.takeaway]
      .map(asText)
      .filter(Boolean)
      .join("|");
  }

  function insightSourceWeight(key) {
    if (key === "saved") return 120;
    if (key === "takeaway" || key === "selfSeen" || key === "awareness" || key === "line") return 110;
    if (key === "conclusion" || key === "summary" || key === "reflection" || key === "psychology") return 90;
    if (key === "think" || key === "deep" || key === "coach") return 80;
    return 20;
  }

  function collectInsightSources(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const insight = journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
    const aware = journal.awarenessResult && typeof journal.awarenessResult === "object" ? journal.awarenessResult : {};
    const coach = journal.bodyCoach && typeof journal.bodyCoach === "object" ? journal.bodyCoach : {};
    const compactAware = Boolean(asText(aware.line) && asText(aware.seen) && !asText(aware.gap) && !asText(aware.question));
    const rows = [
      [review && review.dailyReflectionTitle, "saved"],
      [journal.dailyReflectionTitle, "saved"],
      [guide.takeaway, "takeaway"],
      [insight.takeaway, "takeaway"],
      [guide.selfSeen, "selfSeen"],
      [insight.selfSeen, "selfSeen"],
      [guide.awareness, "awareness"],
      [insight.awareness, "awareness"],
      [aware.line, "line"],
      [compactAware ? "" : aware.seen, "awareness"],
      [insight.conclusion, "conclusion"],
      [insight.summary, "summary"],
      [guide.summary, "summary"],
      [insight.reflection, "reflection"],
      [insight.psychology, "psychology"],
      [insight.analysis, "psychology"],
      [coach.title, "coach"],
      ...thinkHistoryTexts(review).map((item) => [item, "think"]),
      ...deepTexts(journal).map((item) => [item, "deep"]),
    ];
    return rows
      .map(([value, key]) => ({ text: asText(value), key }))
      .filter((item) => item.text && !isGenericMood(item.text));
  }

  function bestExistingQuote(review) {
    let best = "";
    let bestScore = 0;
    collectInsightSources(review).forEach((item) => {
      const clauses = completeClauses(item.text);
      if (compactLen(item.text) <= TITLE_HARD_MAX) clauses.push(cleanTitleText(item.text));
      clauses.forEach((clause) => {
        if (!canReuseSourceQuote(item.key, clause)) return;
        let score = scoreQuoteCandidate(clause, insightSourceWeight(item.key));
        if (clause === cleanTitleText(item.text) && compactLen(clause) <= TITLE_HARD_MAX) score += 50;
        if (score > bestScore) {
          best = cleanTitleText(clause);
          bestScore = score;
        }
      });
    });
    return bestScore >= 80 ? best : "";
  }

  function dayBlob(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const insight = journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
    const aware = journal.awarenessResult && typeof journal.awarenessResult === "object" ? journal.awarenessResult : {};
    return [
      aware.seen,
      aware.line,
      guide.takeaway,
      guide.selfSeen,
      guide.awareness,
      guide.summary,
      insight.conclusion,
      insight.reflection,
      insight.psychology,
      thanksText(journal),
      journal.event,
      journal.bodyNote,
      journal.bodyCoach && journal.bodyCoach.title,
      journal.bodyCoach && journal.bodyCoach.analysis,
      journal.smallestStep,
      journal.execution,
      journal.manifest,
      thinkHistoryTexts(review).join(" "),
      deepTexts(journal).join(" "),
    ]
      .map(asText)
      .filter(Boolean)
      .join("\n");
  }

  function eventFallbackTitle(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const raw = cleanTitleText(firstCompleteSentence(journal.event));
    if (!raw || !/^我/.test(raw)) return "";
    if (looksLikeEventNarration(raw) || !quoteLooksComplete(raw)) return "";
    const n = compactLen(raw);
    if (n < TITLE_SOFT_MIN || n > TITLE_HARD_MAX) return "";
    return raw;
  }

  function shortenHistoryListTitle(text) {
    const raw = cleanTitleText(text);
    if (!raw) return "";
    const n = compactLen(raw);
    if (n <= LIST_TITLE_MAX) return raw;
    const parts = raw.split(/[，、；：:——–]+/).map((item) => cleanTitleText(item)).filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const next = acc ? `${acc}，${part}` : part;
      const len = compactLen(next);
      if (len <= LIST_TITLE_MAX) {
        acc = next;
        continue;
      }
      if (compactLen(acc) >= LIST_TITLE_MIN) return acc;
      if (compactLen(part) >= LIST_TITLE_MIN && compactLen(part) <= LIST_TITLE_MAX) return part;
      if (compactLen(part) > LIST_TITLE_MAX && compactLen(part) <= 32) return part;
      break;
    }
    if (compactLen(acc) >= 8) return acc;
    const sentence = firstCompleteSentence(raw);
    if (sentence && compactLen(sentence) <= LIST_TITLE_MAX) return sentence;
    if (parts[0] && compactLen(parts[0]) <= 32) return parts[0];
    return raw;
  }

  function buildHistoryListTitle(review) {
    const saved = cleanTitleText((review && review.historyShortTitle) || (review && review.journal && review.journal.historyShortTitle));
    if (saved && compactLen(saved) >= 4 && compactLen(saved) <= 40) return saved;
    const full = buildHistoryDisplayTitle(review);
    return shortenHistoryListTitle(full) || full || FALLBACK_TITLE;
  }

  function normalizeHistoryCategory(tag) {
    const raw = asText(tag);
    if (!raw) return "";
    if (PRIMARY_HISTORY_CATEGORIES.includes(raw)) return raw;
    return CATEGORY_ALIASES[raw] || "";
  }

  function buildHistoryDisplayTitle(review) {
    const existing = bestExistingQuote(review);
    if (existing) return existing;
    const fromEvent = eventFallbackTitle(review);
    if (fromEvent) return fromEvent;
    const themed = pickThemedQuote(detectThemes(dayBlob(review)), reviewSeed(review));
    if (themed) return themed;
    return FALLBACK_TITLE;
  }

  function isGenericMood(text) {
    return /^(今天)?很(開心|難過|累|忙|煩)$/.test(String(text || "").replace(/\s+/g, ""));
  }

  function thanksText(journal) {
    if (!journal || typeof journal !== "object") return "";
    if (asText(journal.thanksText)) return asText(journal.thanksText);
    return asText(journal.thanks);
  }

  function thinkHistoryTexts(review) {
    const list = Array.isArray(review && review.thinkHistory) ? review.thinkHistory : [];
    const out = [];
    list.forEach((item) => {
      if (!item || typeof item !== "object") return;
      out.push(item.title, item.insight, item.reply);
      (Array.isArray(item.points) ? item.points : []).forEach((point) => {
        out.push(point && (point.conclusion || point.title || point));
      });
    });
    return out.map(asText).filter(Boolean);
  }

  function deepTexts(journal) {
    const deep = journal && journal.deep;
    const slots = Array.isArray(deep) ? deep : deep && typeof deep === "object" ? [deep] : [];
    return slots
      .map((slot) => asText(slot && (slot.deep || slot.plain || slot.notes)))
      .filter(Boolean);
  }

  function pickTitle(review) {
    return buildHistoryDisplayTitle(review);
  }

  function blobForTags(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const insight = journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
    const parts = [
      pickTitle(review),
      guide.takeaway,
      guide.selfSeen,
      guide.awareness,
      insight.psychology,
      insight.conclusion,
      insight.reflection,
      thanksText(journal),
      journal.event,
      journal.mood,
      asText(journal.bodyNote),
      asText(journal.bodyTags),
      asText(journal.smallestStep),
      asText(journal.manifest),
      thinkHistoryTexts(review).join(" "),
      deepTexts(journal).join(" "),
    ];
    return parts.map(asText).filter(Boolean).join("\n");
  }

  function structuralTags(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const insight = journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const tags = [];
    if (hasMeaningfulValue(insight) || hasMeaningfulValue(review && review.thinkHistory) || hasMeaningfulValue(journal.deep)) {
      tags.push("自我覺察");
    }
    if (hasMeaningfulValue(journal.bodyCheck) || hasMeaningfulValue(journal.bodyCoach) || hasMeaningfulValue(journal.bodyTags)) {
      tags.push("身心狀態");
    }
    if (thanksText(journal)) tags.push("感恩");
    if (hasMeaningfulValue(journal.smallestStep) || hasMeaningfulValue(journal.execution) || hasMeaningfulValue(journal.executionCheckItems)) {
      tags.push("行動力");
    }
    return tags;
  }

  function collectRawHistoryTags(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const organize = review && review.organize && typeof review.organize === "object" ? review.organize : {};
    const saved = [review && review.dailyReflectionTags, journal.dailyReflectionTags, organize.tags, organize.themeCategory]
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map((item) => asText(item))
      .filter(Boolean);
    const blob = blobForTags(review);
    const fromRules = TAG_RULES.filter((rule) => rule.re.test(blob)).map((rule) => rule.tag);
    return [...saved, ...fromRules, ...structuralTags(review)];
  }

  function pickPrimaryCategories(review) {
    const next = [];
    collectRawHistoryTags(review).forEach((tag) => {
      const primary = normalizeHistoryCategory(tag);
      if (primary && !next.includes(primary) && next.length < 2) next.push(primary);
    });
    return next;
  }

  function pickHistoryKeywords(review) {
    const primaries = pickPrimaryCategories(review);
    const next = [];
    collectRawHistoryTags(review).forEach((tag) => {
      const raw = asText(tag);
      if (!raw || primaries.includes(raw) || PRIMARY_HISTORY_CATEGORIES.includes(raw) || next.includes(raw)) return;
      next.push(raw);
    });
    return next.slice(0, 8);
  }

  function pickTags(review) {
    return pickPrimaryCategories(review);
  }

  function stripSearchMarkup(text) {
    return String(text || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  function searchPiece(value) {
    return stripSearchMarkup(asText(value));
  }

  function pushSearch(parts, value) {
    const text = searchPiece(value);
    if (text) parts.push(text);
  }

  function compactSearchKey(text) {
    return stripSearchMarkup(text)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[。！？!?，、；：:""「」『』（）()\[\]【】…·\-—–～~.,/\\]/g, "");
  }

  function collectBodySearch(journal, parts) {
    const check = journal && journal.bodyCheck && typeof journal.bodyCheck === "object" ? journal.bodyCheck : {};
    const mood = check.mood && typeof check.mood === "object" ? check.mood : {};
    const body = check.body && typeof check.body === "object" ? check.body : {};
    const sleep = check.sleep && typeof check.sleep === "object" ? check.sleep : {};
    pushSearch(parts, mood.flags);
    pushSearch(parts, mood.reason);
    pushSearch(parts, body.flags);
    pushSearch(parts, body.other);
    pushSearch(parts, body.reason);
    if (searchPiece(sleep.duration) || searchPiece(sleep.quality) || searchPiece(sleep.energy) || searchPiece(sleep.reason)) {
      parts.push(
        ["睡眠", searchPiece(sleep.duration), searchPiece(sleep.quality), searchPiece(sleep.energy), searchPiece(sleep.reason)]
          .filter(Boolean)
          .join(" ")
      );
    }
    pushSearch(parts, journal && journal.bodyTags);
    pushSearch(parts, journal && journal.bodyNote);
    const coach = journal && journal.bodyCoach && typeof journal.bodyCoach === "object" ? journal.bodyCoach : {};
    pushSearch(parts, coach.title);
    pushSearch(parts, coach.analysis);
    pushSearch(parts, coach.notice);
    pushSearch(parts, coach.suggestions);
  }

  function collectGuideSearch(journal, parts) {
    const insight = journal && journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
    pushSearch(parts, insight.title);
    pushSearch(parts, insight.psychology);
    pushSearch(parts, insight.analysis);
    pushSearch(parts, insight.conclusion);
    pushSearch(parts, insight.summary);
    pushSearch(parts, insight.reflection);
    pushSearch(parts, insight.suggestions);
    pushSearch(parts, insight.takeaways);
    pushSearch(parts, guide.title);
    pushSearch(parts, guide.awareness);
    pushSearch(parts, guide.summary);
    pushSearch(parts, guide.selfSeen);
    pushSearch(parts, guide.takeaway);
    pushSearch(parts, guide.actions);
    const rounds = Array.isArray(guide.rounds) ? guide.rounds : [];
    rounds.forEach((round) => {
      if (!round || typeof round !== "object") return;
      pushSearch(parts, round.question);
      pushSearch(parts, round.answer);
      pushSearch(parts, round.hint);
    });
  }

  function collectAwareExecSearch(journal, parts) {
    const aware =
      journal && journal.awarenessResult && typeof journal.awarenessResult === "object" ? journal.awarenessResult : {};
    const nested = aware.result && typeof aware.result === "object" ? aware.result : aware;
    pushSearch(parts, nested.seen);
    pushSearch(parts, nested.gap);
    pushSearch(parts, nested.line);
    pushSearch(parts, nested.question);
    pushSearch(parts, journal && journal.awareness);
    pushSearch(parts, journal && journal.awarenessChecks);
    pushSearch(parts, journal && journal.awarenessCheckItems);
    if (merge && typeof merge.selectedChoiceTexts === "function") {
      pushSearch(parts, merge.selectedChoiceTexts(journal && journal.awarenessChoices));
      pushSearch(parts, merge.selectedChoiceTexts(journal && journal.thinkChoices));
    }
    pushSearch(parts, journal && journal.execution);
    pushSearch(parts, journal && journal.smallestStep);
    if (merge && typeof merge.selectedExecutionChoiceActions === "function") {
      (merge.selectedExecutionChoiceActions(journal && journal.executionChoices) || []).forEach((item) => {
        pushSearch(parts, item && (item.text || item.title));
      });
    }
    const execItems = Array.isArray(journal && journal.executionCheckItems) ? journal.executionCheckItems : [];
    execItems.forEach((item) => {
      pushSearch(parts, item && (item.title || item.text));
      pushSearch(parts, item && item.detail);
    });
  }

  function collectOrganizeSearch(review, parts) {
    const organize = review && review.organize && typeof review.organize === "object" ? review.organize : {};
    pushSearch(parts, organize.themeTitle);
    pushSearch(parts, organize.themeCategory);
    pushSearch(parts, organize.themeInsight);
    pushSearch(parts, organize.event);
    pushSearch(parts, organize.reflection);
    pushSearch(parts, organize.conclusion);
    pushSearch(parts, organize.gratitudeNote);
    pushSearch(parts, organize.quotes);
    pushSearch(parts, organize.tags);
    pushSearch(parts, organize.keywords);
    pushSearch(parts, organize.eventList);
    pushSearch(parts, organize.gratitudeList);
  }

  function buildHistorySearchText(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const parts = [];
    pushSearch(parts, review && review.date);
    pushSearch(parts, review && review.historyShortTitle);
    pushSearch(parts, review && review.journal && review.journal.historyShortTitle);
    pushSearch(parts, buildHistoryDisplayTitle(review));
    pushSearch(parts, buildHistoryListTitle(review));
    pushSearch(parts, thanksText(journal));
    pushSearch(parts, journal.event);
    pushSearch(parts, journal.mood);
    pushSearch(parts, review && review.rawText);
    pushSearch(parts, review && review.gratitude);
    collectBodySearch(journal, parts);
    collectGuideSearch(journal, parts);
    collectAwareExecSearch(journal, parts);
    thinkHistoryTexts(review).forEach((item) => pushSearch(parts, item));
    deepTexts(journal).forEach((item) => pushSearch(parts, item));
    collectOrganizeSearch(review, parts);
    pushSearch(parts, journal.dailyReflectionTags);
    pushSearch(parts, review && review.dailyReflectionTags);
    pickPrimaryCategories(review).forEach((item) => pushSearch(parts, item));
    pickHistoryKeywords(review).forEach((item) => pushSearch(parts, item));
    return parts.join("\n");
  }

  function historyMatchesQuery(review, query) {
    const needle = String(query || "").trim();
    if (!needle) return true;
    const hay = buildHistorySearchText(review);
    const lowerHay = hay.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    if (lowerHay.includes(lowerNeedle)) return true;
    const compactHay = compactSearchKey(hay);
    const compactNeedle = compactSearchKey(needle);
    return Boolean(compactNeedle) && compactHay.includes(compactNeedle);
  }

  function historyMatchesTag(review, tag) {
    const wanted = asText(tag);
    if (!wanted || wanted === "all") return true;
    if (wanted === "important") {
      if (merge && typeof merge.reviewIsHistoryImportant === "function") return merge.reviewIsHistoryImportant(review);
      return Boolean(review && review.historyMeta && review.historyMeta.important === true);
    }
    const primary = normalizeHistoryCategory(wanted) || wanted;
    if (!PRIMARY_HISTORY_CATEGORIES.includes(primary)) return false;
    if (pickPrimaryCategories(review).includes(primary)) return true;
    return collectRawHistoryTags(review).some((item) => normalizeHistoryCategory(item) === primary);
  }

  function getHistoryDailySummary(review) {
    const title = pickTitle(review) || FALLBACK_TITLE;
    const listTitle = buildHistoryListTitle(review) || title;
    const tags = pickPrimaryCategories(review);
    const rating = merge && typeof merge.normalizeHistoryRating === "function" ? merge.normalizeHistoryRating(review && review.historyRating) : 0;
    return {
      title,
      listTitle,
      tags,
      categories: tags,
      keywords: pickHistoryKeywords(review),
      rating,
    };
  }

  return {
    FALLBACK_TITLE,
    PRIMARY_HISTORY_CATEGORIES,
    LIST_TITLE_MIN,
    LIST_TITLE_MAX,
    getHistoryDailySummary,
    buildHistoryDisplayTitle,
    buildHistoryListTitle,
    shortenHistoryListTitle,
    normalizeHistoryCategory,
    pickPrimaryCategories,
    pickHistoryKeywords,
    historyMatchesTag,
    buildHistorySearchText,
    historyMatchesQuery,
  };
});
