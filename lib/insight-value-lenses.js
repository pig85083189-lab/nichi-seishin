"use strict";

const thinkingCore = require("./insight-thinking-core");
const answerEngine = require("./ing-answer-engine");

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactChars(text) {
  return asText(text).replace(/\s+/g, "").length;
}

function rawBlob(raw) {
  return [raw.thanksText, raw.event, raw.mood, raw.bodyMindText, raw.userAnswer].filter(Boolean).join("\n");
}

function splitLines(raw) {
  return rawBlob(raw)
    .split(/[。！？!?\n；;]+/)
    .map(asText)
    .filter((line) => compactChars(line) >= 3);
}

function isExtremelySparseInput(raw) {
  const blob = rawBlob(raw);
  const chars = compactChars(blob);
  if (chars < 6) return true;
  if (chars <= 12 && /^(還好|普通|累|不知道|沒有|無|平|還行|一般)[。！？]?$/.test(blob.replace(/\s+/g, ""))) return true;
  const lines = splitLines(raw);
  if (lines.length <= 1 && chars < 14) return true;
  return false;
}

function hasMeaningfulJournalContent(raw) {
  return !isExtremelySparseInput(raw);
}

function candidateAddsNovelValue(statement, raw) {
  const line = asText(statement);
  const blob = rawBlob(raw);
  if (!line || compactChars(line) < 10) return false;
  if (thinkingCore.looksLabelOnly(line, "")) return false;
  if (thinkingCore.looksShallowParaphrase(line, blob) && !thinkingCore.hasInterpretiveMove(line)) return false;
  if (thinkingCore.hasInterpretiveMove(line)) return true;
  if (thinkingCore.hasCalibratedHypothesis(line) && compactChars(line) >= 14) return true;
  if (thinkingCore.hasStructuralReading(line) && compactChars(line) >= 14 && thinkingCore.gramOverlap(line, blob) < 0.72) {
    return true;
  }
  return false;
}

function makeCandidate(id, type, statement, evidence, newInformation, whyItMatters, alternative) {
  return {
    id,
    type,
    statement,
    evidence: (Array.isArray(evidence) ? evidence : []).map(asText).filter(Boolean).slice(0, 6),
    newInformation: asText(newInformation),
    whyItMatters: asText(whyItMatters),
    alternative: asText(alternative),
    confidence: "medium",
    fallbackLens: true,
  };
}

function lensSaidVsMeant(raw) {
  const blob = rawBlob(raw);
  const lines = splitLines(raw);
  const hit = lines.find((line) => /讓我覺得|感覺她|感覺他|聽起來像|好像要|以為.*要/.test(line));
  if (!hit) return null;
  const said = lines.find((line) => /說|講|叫|問|吵|覺得.*影響|因為/.test(line) && line !== hit) || lines[0];
  if (!said || compactChars(said) < 6) return null;
  return makeCandidate(
    "lens-said-vs-meant",
    "CONTRAST",
    "也許值得分開看的，是她實際說的那句話，和那句話在你心裡變成什麼意思。",
    [said, hit],
    "使用者已寫出感受，但『說了什麼』和『對我意味著什麼』還沒被分開看",
    "這個分別本身就有幫助：不需要先判斷對方真正的意思，也能先看見自己怎麼接住了那句話。",
    "也可能兩邊其實接近，只是當下情緒放大了距離感。"
  );
}

function lensMotherConflict(raw) {
  const blob = rawBlob(raw);
  if (!/(媽|母親|媽媽)/.test(blob) || !/吵|吵架|爭|衝突/.test(blob)) return null;
  if (!/拋棄|心情|影響|不要我|離開|丟下/.test(blob)) return null;
  const lines = splitLines(raw);
  const said = lines.find((line) => /覺得|影響|吵架|常常|所以/.test(line));
  const felt = lines.find((line) => /拋棄|不要我|被丟下|被拋/.test(line));
  if (!felt) return null;
  return makeCandidate(
    "lens-mother-conflict",
    "CONTRAST",
    "有一個角度是：媽媽說的是她的心情被影響，而你心裡接住的，可能是另一種被拋下的感覺。",
    [said || lines[0], felt].filter(Boolean),
    "同一段衝突裡，『對方在說什麼』和『這對我意味著什麼』可能是兩件事",
    "這個分別本身就有用：先分開『她說了什麼』和『我聽成了什麼』，不必先判斷她的真正意圖。",
    "也可能兩邊其實接近，只是當下情緒放大了距離感。"
  );
}

function lensSocialRecoveryContrast(raw) {
  const blob = rawBlob(raw);
  const social = /朋友|同事|家人|吃飯|聊天|散步|陪|有人|開心|笑/.test(blob);
  const recovery = /累|疲|休息|躺|睡|回家只想|身體沉|想睡|晚/.test(blob);
  if (!social || !recovery) return null;
  const lines = splitLines(raw);
  const socialLines = lines.filter((line) => /朋友|吃飯|聊天|開心|笑|陪/.test(line));
  const restLines = lines.filter((line) => /累|休息|回家|睡|晚|沉|躺/.test(line));
  if (!socialLines.length || !restLines.length) return null;
  return makeCandidate(
    "lens-social-recovery",
    "CONTRAST",
    "如果把這幾件事放在一起看，今天好像同時有社交帶來的滋養，和身體需要回收能量的時段。",
    socialLines.slice(0, 2).concat(restLines.slice(0, 2)),
    "開心與疲累在同一天出現，還沒被連成一個節奏",
    "這不一定代表今天好或壞，而是值得看見：連結和恢復可能都在發生，只是不同時段。",
    "也可能只是剛好排在一起，沒有更深關係。"
  );
}

function lensDepletionNourishment(raw) {
  const blob = rawBlob(raw);
  const drain = /累|加班|趕|緊|沉|耗|煩|悶|火|熱|吵/.test(blob);
  const nourish = /開心|放鬆|笑|穩|舒服|輕鬆|感謝|謝謝|好吃|滿開心/.test(blob);
  if (!drain || !nourish) return null;
  const lines = splitLines(raw);
  const drainLines = lines.filter((line) => /累|加班|趕|緊|沉|煩|悶|火|吵/.test(line));
  const goodLines = lines.filter((line) => /開心|放鬆|笑|穩|舒服|輕鬆|感謝|好吃/.test(line));
  if (!drainLines.length || !goodLines.length) return null;
  return makeCandidate(
    "lens-deplete-nourish",
    "CONTRAST",
    "今天好像同時有讓你耗掉能量的事，也有真正補回來一點的時刻。",
    drainLines.slice(0, 2).concat(goodLines.slice(0, 2)),
    "耗與補分開寫了，還沒被放在同一天裡一起看",
    "值得留意：疲累不一定代表整個日子都糟，裡面可能還有別的支撐。",
    "也可能只是兩件剛好接在一起的事。"
  );
}

function lensGratitudeSharedQuality(raw) {
  const blob = rawBlob(raw);
  if (!/感謝|謝謝/.test(blob)) return null;
  const lines = splitLines(raw).filter((line) => /感謝|謝謝/.test(line));
  if (lines.length < 2) return null;
  const care = lines.some((line) => /好好說話|想到別人|出現在|陪伴|對待|身邊|每一個人/.test(line));
  if (!care) {
    return makeCandidate(
      "lens-gratitude-attention",
      "COMMON_THREAD",
      "妳今天特別寫下來的這幾件感謝，好像都在指向同一件你在意的事。",
      lines.slice(0, 4),
      "三件感謝並列，共享的方向還沒被說出來",
      "值得問的不是要不要更感恩，而是：為什麼是這幾件，而不是別的？",
      "也可能只是今天剛好想到這幾件。"
    );
  }
  return makeCandidate(
    "lens-gratitude-care",
    "COMMON_THREAD",
    "這幾件感謝裡，好像有一個共同方向：妳在意的是人和人之間怎麼被對照顧。",
    lines.slice(0, 4),
    "分開寫的感謝，共享的對待結構還沒被連起來",
    "如果把這幾件事放在一起看，今天被記下的可能不只是清單，而是關心有沒有真的出現。",
    "也可能只是習慣寫幾句感謝，沒有更深共同點。"
  );
}

function lensChoiceStrength(raw) {
  const blob = rawBlob(raw);
  if (!/第一次|沒有立刻|先說|先寫|把手機放下|再想一週|先停|延後|晚一點才/.test(blob)) return null;
  const lines = splitLines(raw).filter((line) => /第一次|沒有立刻|先說|先寫|放下|再想|先停|延後/.test(line));
  if (!lines.length) return null;
  return makeCandidate(
    "lens-choice-strength",
    "UNRECOGNIZED_STRENGTH",
    "這裡有一個滿有意思的地方：妳寫下的不只是結果，還有一次替自己多留一點空間的選擇。",
    lines.slice(0, 3),
    "過程寫了，但還沒被當成自己做得好的地方",
    "值得看見：改變有時不是變得更會，而是多了一個停一下的瞬間。",
    "也可能只是當天剛好有餘裕，不算穩定能力。"
  );
}

function lensWorkFrustration(raw) {
  const blob = rawBlob(raw);
  if (!/主管|同事|工作|會議|需求|加班|答應|重做|截止/.test(blob)) return null;
  if (!/不舒服|悶|煩|緊|後悔|不太想|立刻/.test(blob)) return null;
  const lines = splitLines(raw);
  return makeCandidate(
    "lens-work-gap",
    "CONTRAST",
    "妳已經看見自己的不舒服，和最後還是立刻答應之間，好像還有一段距離。",
    lines.slice(0, 4),
    "知道與做到之間的距離還沒被單獨看",
    "這不一定是在找問題，而是看見：不舒服先來，行動後到，中間可能還有一個位置。",
    "也可能當下真的沒有別的選擇。"
  );
}

function lensRelationshipConflict(raw) {
  const careReject = answerEngine.gratitudeCareVsRejectionSeed(raw);
  if (careReject) {
    return makeCandidate(
      "lens-care-vs-reject",
      "CONTRAST",
      careReject.statement,
      careReject.evidence,
      careReject.newInformation,
      careReject.whyItMatters,
      careReject.alternative
    );
  }
  const blob = rawBlob(raw);
  if (!/伴侶|男友|女友|吵架|吵完|火|胸口熱|媽媽|母親|滾出去|搬出去/.test(blob)) return null;
  const lines = splitLines(raw);
  if (/滾出去|搬出去/.test(blob) && /媽媽|母親/.test(blob)) {
    return makeCandidate(
      "lens-family-push",
      "CONTRAST",
      "也許值得分開看的，是『搬出去』這件事本身，和那句話讓妳覺得被推開的感覺。",
      lines.slice(0, 4),
      "事件寫了，但事情本身與被對待的方式還沒被分開看",
      "有一個角度是：真正刺痛的，不一定只是要不要搬，而是關係裡能不能被好好說話、被理解。",
      "也可能當下主要就是現實安排的衝突。"
    );
  }
  return makeCandidate(
    "lens-rel-conflict",
    "CONTRAST",
    "今天值得看的，也許不是誰對誰錯，而是在很在乎的關係裡，第一句話是不是直接被情緒決定。",
    lines.slice(0, 4),
    "爭執寫了，但『情緒怎麼進場』還沒被單獨看",
    "有一個角度是：把話說完，和把最重的話送出去，可能不是同一件事。",
    "也可能當下真的只能先說出來。"
  );
}

function lensOrdinaryDayAttention(raw) {
  const blob = rawBlob(raw);
  const lines = splitLines(raw);
  if (lines.length < 2 || compactChars(blob) < 16) return null;
  if (/吵|火|難過|第一次|沒有立刻|拋棄|主管|加班|不舒服/.test(blob)) return null;
  if (/感謝|謝謝/.test(blob) && lines.filter((line) => /感謝|謝謝/.test(line)).length >= 2) return null;
  const picked = lines.slice(0, 4);
  const theme = picked.find((line) => /開心|累|休息|吃|回家|上班|朋友/.test(line));
  if (!theme) return null;
  return makeCandidate(
    "lens-ordinary-attention",
    "COMMON_THREAD",
    "如果把今天寫下的幾段放在一起看，妳特別留意的，好像是生活如何在不同節奏之間切換。",
    picked,
    "幾段日常分開寫了，還沒被看成一整天的節奏",
    "即使沒有什麼戲劇性的事，也值得看見：這一天並不是空白，而是有它自己的流動。",
    "也可能只是普通安排，沒有特別意義。"
  );
}

function lensPositiveDayValue(raw) {
  const blob = rawBlob(raw);
  if (!/開心|幸福|很好|放鬆|輕鬆|安定|滿開心/.test(blob)) return null;
  if (/累|吵|火|難過|煩|悶/.test(blob)) return null;
  const lines = splitLines(raw).filter((line) => /開心|幸福|很好|放鬆|輕鬆|安定/.test(line));
  if (!lines.length) return null;
  return makeCandidate(
    "lens-positive-value",
    "ENERGY_SOURCE",
    "妳今天特別記下來的，好像不只是事情順利，而是某些時刻真的讓妳覺得值得。",
    lines.slice(0, 4),
    "好時刻寫了，但『什麼讓它值得』還沒被說出來",
    "有一個角度是：今天被看見的，可能是哪些時刻真的碰到了妳在意的地方。",
    "也可能只是普通的好心情，不需要再解讀。"
  );
}

function lensSupportDay(raw) {
  const blob = rawBlob(raw);
  if (!/朋友|家人|同事|陪|聊天|電話|請我|有人聽|出現在/.test(blob)) return null;
  if (!/開心|放鬆|鬆|輕|穩|好/.test(blob)) return null;
  const lines = splitLines(raw).filter((line) => /朋友|家人|同事|陪|聊天|電話|請|有人/.test(line));
  if (!lines.length) return null;
  return makeCandidate(
    "lens-support-day",
    "ENERGY_SOURCE",
    "今天真正讓妳比較好的時刻，好像都和有人在場有關。",
    lines.slice(0, 4),
    "有連結的時刻分開寫了，還沒被連成一條",
    "值得留意：讓妳補回來的，可能不只是事情本身，而是被陪著、被聽見。",
    "也可能只是剛好有人，不是特別需求。"
  );
}

function lensKnownCauseBodyNeed(raw) {
  const blob = rawBlob(raw);
  if (!/累|疲|沉|想躺|想睡|緊|熱/.test(blob)) return null;
  if (!/因為|所以|知道|趕|晚睡|加班|報告|喝水|喝到水/.test(blob)) return null;
  const lines = splitLines(raw);
  const cause = lines.find((line) => /因為|所以|趕|晚睡|加班|報告|知道/.test(line));
  const body = lines.find((line) => /沉|躺|睡|累|疲|緊|熱|喝水|喝到水/.test(line));
  if (!cause || !body) return null;
  return makeCandidate(
    "lens-cause-body",
    "CONTRAST",
    "今天的紀錄裡，疲累好像是主角；同時妳也有寫下身體現在的狀態。",
    [cause, body],
    "原因與身體細節分開寫了，還沒被放在一起看",
    "這不必講成能力或更深心理。值得看見的是：妳今天記的不只是『很累』，也有在留意身體現在怎麼樣。",
    "也可能只是順手寫兩句，沒有特別意思。"
  );
}

function lensClearCauseBodyRemain(raw) {
  const blob = rawBlob(raw);
  if (!/已經知道|已經想清楚|原因我已經|沒有要再/.test(blob)) return null;
  if (!/胸口|肩膀|胃|手震|臉熱|身體|熱|緊|沉/.test(blob)) return null;
  const lines = splitLines(raw);
  return makeCandidate(
    "lens-clear-body",
    "DISTINCTION",
    "妳在文字裡已經把原因說得很清楚；同時身體留下的感覺，可能還在，不一定要再用「為什麼」來解釋。",
    lines.slice(0, 4),
    "認知上的清楚，和身體上的感覺，還沒被分開看",
    "有一個角度是：就算原因已經知道，身體仍可能還在記得這件事。",
    "也可能身體只是當天的正常反應。"
  );
}

const LENS_BUILDERS = [
  lensMotherConflict,
  lensSaidVsMeant,
  lensClearCauseBodyRemain,
  lensKnownCauseBodyNeed,
  lensRelationshipConflict,
  lensWorkFrustration,
  lensSocialRecoveryContrast,
  lensDepletionNourishment,
  lensGratitudeSharedQuality,
  lensChoiceStrength,
  lensSupportDay,
  lensPositiveDayValue,
  lensOrdinaryDayAttention,
];

function buildFallbackCandidates(raw) {
  const candidates = [];
  const seen = new Set();
  LENS_BUILDERS.forEach((builder) => {
    const item = builder(raw);
    if (!item || !item.statement) return;
    const key = asText(item.statement).slice(0, 24);
    if (seen.has(key)) return;
    seen.add(key);
    if (candidateAddsNovelValue(item.statement, raw)) candidates.push(item);
  });
  return candidates;
}

module.exports = {
  asText,
  rawBlob,
  isExtremelySparseInput,
  hasMeaningfulJournalContent,
  candidateAddsNovelValue,
  buildFallbackCandidates,
};
