(function (root, factory) {
  const merge =
    (typeof require === "function"
      ? (function () {
          try {
            return require("./text-integrity");
          } catch {
            return {};
          }
        })()
      : null) ||
    (root && root.NichiTextIntegrity) ||
    {};
  const api = factory(merge);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.NichiBodyCoachInsight = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (textIntegrity) {
  "use strict";

  function asText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function compactLen(text) {
    return asText(text).replace(/\s+/g, "").length;
  }

  function sleepGroup(ctx) {
    const check = ctx && ctx.bodyCheck && typeof ctx.bodyCheck === "object" ? ctx.bodyCheck : {};
    const sleep = check.sleep && typeof check.sleep === "object" ? check.sleep : {};
    return {
      duration: asText(sleep.duration),
      quality: asText(sleep.quality),
      energy: asText(sleep.energy),
    };
  }

  function bodyFlags(ctx) {
    const check = ctx && ctx.bodyCheck && typeof ctx.bodyCheck === "object" ? ctx.bodyCheck : {};
    const body = check.body && typeof check.body === "object" ? check.body : {};
    const flags = Array.isArray(body.flags) ? body.flags : [];
    const tags = Array.isArray(ctx && ctx.bodyTags) ? ctx.bodyTags : [];
    return [...flags, ...tags, asText(body.other), asText(ctx && ctx.bodyNote)].map(asText).filter(Boolean);
  }

  function moodFlags(ctx) {
    const check = ctx && ctx.bodyCheck && typeof ctx.bodyCheck === "object" ? ctx.bodyCheck : {};
    const mood = check.mood && typeof check.mood === "object" ? check.mood : {};
    const flags = Array.isArray(mood.flags) ? mood.flags : [];
    return [...flags, asText(ctx && ctx.mood)].map(asText).filter(Boolean);
  }

  function dayBlob(ctx) {
    return [
      asText(ctx && ctx.mood),
      asText(ctx && (ctx.thanksText || ctx.thanks)),
      asText(ctx && ctx.event),
      asText(ctx && ctx.bodyNote),
      moodFlags(ctx).join(" "),
      bodyFlags(ctx).join(" "),
      Object.values(sleepGroup(ctx)).join(" "),
    ].join("\n");
  }

  function isSleepShort(duration) {
    return /少於5|5\s*[–-]\s*6/.test(asText(duration));
  }

  function isEnergyOk(energy) {
    return /不錯|普通|有精神|清醒|很好|精神好/.test(asText(energy));
  }

  function isEnergyTired(energy) {
    return /疲憊|很累|疲累|沒精神/.test(asText(energy));
  }

  function isPleasant(ctx) {
    return moodFlags(ctx).some((item) => /愉快|開心|很好|平靜|滿足/.test(item)) || /開心|很好|愉快/.test(dayBlob(ctx));
  }

  function hasConnection(blob) {
    return /媽媽|爸爸|寶貝|家人|陪伴|互動|關心|被關心/.test(blob);
  }

  function hasProgress(blob) {
    return /實現|完成|進展|落地|做到|逐漸/.test(blob);
  }

  function hasBodyTired(ctx) {
    return bodyFlags(ctx).some((item) => /疲勞|疲累|痠痛|累/.test(item)) || isEnergyTired(sleepGroup(ctx).energy);
  }

  function isSparse(ctx) {
    const blob = dayBlob(ctx);
    const sleep = sleepGroup(ctx);
    const hasStory = compactLen(asText(ctx && (ctx.event || ctx.thanks || ctx.thanksText))) >= 8;
    const hasSignal = isSleepShort(sleep.duration) || hasBodyTired(ctx) || isPleasant(ctx) || /焦慮|煩躁|低落/.test(blob);
    return !hasStory && !hasSignal;
  }

  function detectBodyCoachContrasts(ctx) {
    const blob = dayBlob(ctx);
    const sleep = sleepGroup(ctx);
    const found = [];
    if (isSleepShort(sleep.duration) && isEnergyOk(sleep.energy) && !isEnergyTired(sleep.energy)) {
      found.push("sleep-energy");
    }
    if ((hasProgress(blob) || /很多事情|完成很多/.test(blob)) && hasBodyTired(ctx) && isPleasant(ctx)) {
      found.push("done-tired");
    } else if ((hasProgress(blob) || /很多事情|完成很多/.test(blob)) && hasBodyTired(ctx)) {
      found.push("done-tired");
    }
    if (hasConnection(blob) && hasProgress(blob) && isPleasant(ctx)) {
      found.push("connection-progress");
    } else if (hasConnection(blob) && isPleasant(ctx) && compactLen(asText(ctx && ctx.event)) >= 8) {
      found.push("connection");
    }
    if (isPleasant(ctx) && compactLen(asText(ctx && ctx.event)) < 8 && !hasProgress(blob) && !isSleepShort(sleep.duration)) {
      found.push("quiet-joy");
    }
    if (isSparse(ctx)) found.push("sparse");
    return found;
  }

  function overlapRatio(left, right) {
    const a = asText(left).replace(/\s+/g, "");
    const b = asText(right).replace(/\s+/g, "");
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length >= 12 && b.includes(a)) return 0.9;
    if (b.length >= 12 && a.includes(b)) return 0.9;
    const grams = new Set();
    for (let i = 0; i < a.length - 3; i += 1) grams.add(a.slice(i, i + 4));
    let hit = 0;
    grams.forEach((gram) => {
      if (b.includes(gram)) hit += 1;
    });
    return grams.size ? hit / grams.size : 0;
  }

  function sectionsOverlapTooMuch(result) {
    const data = result && typeof result === "object" ? result : {};
    const pairs = [
      [data.title, data.analysis],
      [data.title, data.notice],
      [data.analysis, data.notice],
    ];
    return pairs.some(([left, right]) => overlapRatio(left, right) >= 0.42);
  }

  function looksLikeRestatement(text) {
    const raw = asText(text);
    if (!raw) return false;
    return /今天的開心來自|雖然睡眠時間較短，但精神狀態仍不錯|你今天心情很好[，,].*睡了|心情很好[，,].*睡了\s*5|請早點睡|睡眠不足[，,].*早點睡/.test(
      raw
    );
  }

  function buildLocalBodyCoach(ctx) {
    const contrasts = detectBodyCoachContrasts(ctx);
    const sleep = sleepGroup(ctx);
    let title = "今天的身心狀態相對平穩，目前沒有特別明顯的反差。";
    let analysis = "心情、身體與睡眠沒有突出的拉扯，資料本身比較平，先把今天的狀態看清楚即可。";
    let notice = "可以繼續觀察什麼情況下，自己的精神會特別好或特別疲累。不必為了有洞察而硬找問題。";
    let suggestions = [
      "今晚維持原本的收工節奏，不必另外增加任務。",
      "明早起來時，用一句話記下精神如何，方便之後對照。",
    ];

    if (contrasts.includes("sleep-energy")) {
      title = "睡得少不一定等於精神差，今天真正值得觀察的，是什麼讓你的身體有「休息到」的感覺。";
      analysis =
        "昨晚睡眠時間不長，品質也普通，但今天精神感受反而比預期好。這表示影響今天狀態的，可能不只是睡多久，睡眠品質與當下的心理狀態也連在一起。";
      notice =
        "睡眠時間短，精神卻不差。睡多久可能不是唯一變因，醒來後的身體感受，似乎更值得繼續觀察。";
      suggestions = [
        "睡前提早 15 分鐘進入休息狀態，先把節奏放慢，不要求自己立刻睡著。",
        "明早記錄「醒來精神」，而不只記錄自己睡了多久。",
      ];
    } else if (contrasts.includes("done-tired")) {
      title = "事情做完很有成就感，身體卻已經累了；今天值得一起看的，是滿足感和身體負荷有沒有對上。";
      analysis =
        "今天完成不少事情、心情也不錯，但身體已經出現疲累。心理上的滿足，和身體實際的能量，可能不是同一件事。";
      notice =
        "心理滿足和身體疲累同時出現時，完成感有時會蓋過身體的提醒。可以繼續觀察：是心情撐住了，還是身體其實需要先停下來。";
      suggestions = [
        "今晚只做最小的收工動作，做完就讓身體停下來。",
        "睡前把明天想做的事寫成一件就好，其餘先放下。",
      ];
    } else if (contrasts.includes("connection-progress")) {
      title = "真正讓今天變得踏實的，不是某一件大事，而是想做的事正在發生，在乎的人也都在身邊。";
      analysis =
        "被關心、與重要的人互動、事情逐漸有進展，這些加在一起，比較像連結感和進展感同時出現，而不只是單一事件讓你開心。";
      notice =
        "今天幾個讓你開心的時刻，都和「有人在」以及「事情正在發生」有關。這可能是之後值得繼續觀察的線索。";
      suggestions = [
        "今晚用一句話記下，今天哪一個進展最讓你踏實。",
        "睡前把這份踏實感留在心裡就好，不必再多做一件證明自己的事。",
      ];
    } else if (contrasts.includes("connection")) {
      title = "今天的正向感受裡，與重要的人互動明顯佔了一部分，這份連結感值得被看見。";
      analysis =
        "今天開心的時刻，比較常出現在被關心、有互動、有人在身邊的時候。心情變好，可能不只來自事情本身。";
      notice =
        "被主動關心似乎特別容易帶來安心。這不是結論，只是今天紀錄裡值得繼續觀察的線索。";
      suggestions = [
        "今晚若還有一點力氣，只回應一個你在乎的人就好。",
        "睡前把今天那份被連結的感覺記下一句，不用寫成長文。",
      ];
    } else if (contrasts.includes("quiet-joy")) {
      title = "沒有大事件，卻仍然覺得不錯。今天值得留下的，是這種平靜本身。";
      analysis = "今天沒有特別大的事情，心情卻仍偏穩。這種穩定不一定需要被解釋成成就。";
      notice = "可以繼續觀察：什麼時候即使事情不多，自己也會覺得踏實。";
      suggestions = [
        "今晚維持原本節奏即可，不必額外找事情完成。",
        "明早用一句話記下醒來時的感覺，方便之後對照。",
      ];
    } else if (contrasts.includes("sparse") || !contrasts.length) {
      title = "今天的身心狀態相對平穩，目前沒有特別明顯的反差。";
      analysis = "心情普通、睡眠與身體也沒有突出訊號。資料不足時，先平實看今天即可。";
      notice = "可以繼續觀察什麼情況下，自己的精神會特別好或特別疲累。不要為了洞察而硬找問題。";
    }

    if (sleep.quality && contrasts.includes("sleep-energy") && /普通|差/.test(sleep.quality)) {
      notice =
        "睡眠時間短，精神卻不差。睡多久可能不是唯一變因，睡眠品質與入睡前狀態，似乎更值得繼續觀察。";
    }

    return {
      title,
      analysis,
      notice,
      suggestions,
      contrasts,
    };
  }

  function keepCompleteField(text, max) {
    const cleaned = asText(text);
    if (!cleaned) return "";
    if (compactLen(cleaned) <= max) return cleaned;
    if (textIntegrity && typeof textIntegrity.splitSentences === "function") {
      const sentences = textIntegrity
        .splitSentences(cleaned)
        .filter((item) => !textIntegrity.isCompleteSentence || textIntegrity.isCompleteSentence(item));
      let out = "";
      let used = 0;
      sentences.forEach((part) => {
        const add = compactLen(part);
        if (used && used + add > max) return;
        if (!used && add > max) {
          out = part;
          used = add;
          return;
        }
        out += part;
        used += add;
      });
      if (out) return out;
    }
    return cleaned;
  }

  return {
    detectBodyCoachContrasts,
    buildLocalBodyCoach,
    sectionsOverlapTooMuch,
    looksLikeRestatement,
    keepCompleteField,
    dayBlob,
  };
});
