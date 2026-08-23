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

  const FALLBACK_TITLE = "看看這一天留下的紀錄";
  const TITLE_MIN = 12;
  const TITLE_MAX = 22;

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

  function clipReflectionTitle(text) {
    const cleaned = asText(text)
      .replace(/^[「『“"']+|[」』”"']+$/g, "")
      .replace(/[。！？!?…]+$/g, "")
      .trim();
    if (!cleaned) return "";
    let out = "";
    let count = 0;
    for (const ch of cleaned) {
      if (/\s/.test(ch)) {
        if (count) out += ch;
        continue;
      }
      if (count >= TITLE_MAX) break;
      out += ch;
      count += 1;
    }
    return out.replace(/[，、；：,.]+$/g, "").trim();
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

  function titleCandidates(review) {
    const journal = review && review.journal && typeof review.journal === "object" ? review.journal : {};
    const insight = journal.insight && typeof journal.insight === "object" ? journal.insight : {};
    const guide = insight.guide && typeof insight.guide === "object" ? insight.guide : {};
    const aware = journal.awarenessResult && typeof journal.awarenessResult === "object" ? journal.awarenessResult : {};
    const coach = journal.bodyCoach && typeof journal.bodyCoach === "object" ? journal.bodyCoach : {};
    const organize = review && review.organize && typeof review.organize === "object" ? review.organize : {};
    return [
      review && review.dailyReflectionTitle,
      journal.dailyReflectionTitle,
      guide.takeaway,
      insight.takeaway,
      guide.selfSeen,
      insight.selfSeen,
      guide.awareness,
      insight.awareness,
      insight.conclusion,
      insight.summary,
      guide.summary,
      insight.title,
      insight.reflection,
      insight.psychology,
      insight.analysis,
      aware.line,
      aware.seen,
      coach.title,
      ...thinkHistoryTexts(review),
      ...deepTexts(journal),
      organize.themeInsight,
      organize.conclusion,
      organize.themeTitle,
      thanksText(journal),
      journal.event,
    ]
      .map(asText)
      .filter((text) => text && !isGenericMood(text) && compactLen(text) >= 6);
  }

  function pickTitle(review) {
    const candidates = titleCandidates(review);
    for (const text of candidates) {
      const clipped = clipReflectionTitle(text);
      if (compactLen(clipped) >= 6) return compactLen(clipped) >= TITLE_MIN ? clipped : clipped;
    }
    return FALLBACK_TITLE;
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

  function pickTags(review) {
    const saved = review && review.dailyReflectionTags;
    const journalSaved = review && review.journal && review.journal.dailyReflectionTags;
    const preset = [saved, journalSaved]
      .flatMap((item) => (Array.isArray(item) ? item : []))
      .map((item) => asText(item))
      .filter(Boolean);
    if (preset.length) return [...new Set(preset)].slice(0, 3);

    const blob = blobForTags(review);
    const fromRules = TAG_RULES.filter((rule) => rule.re.test(blob)).map((rule) => rule.tag);
    const next = [];
    [...fromRules, ...structuralTags(review)].forEach((tag) => {
      if (tag && !next.includes(tag) && next.length < 3) next.push(tag);
    });
    return next;
  }

  function getHistoryDailySummary(review) {
    const title = pickTitle(review) || FALLBACK_TITLE;
    return {
      title,
      tags: pickTags(review),
    };
  }

  return {
    FALLBACK_TITLE,
    getHistoryDailySummary,
    clipReflectionTitle,
  };
});
