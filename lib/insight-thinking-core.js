"use strict";

function asText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function compactChars(text) {
  return asText(text).replace(/\s+/g, "").length;
}

function closeKey(text) {
  return asText(text).replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "");
}

function gramOverlap(left, right) {
  const a = closeKey(left);
  const b = closeKey(right);
  if (!a || !b || a.length < 6 || b.length < 6) return 0;
  const grams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!gb.size) return 0;
  let inter = 0;
  gb.forEach((gram) => {
    if (ga.has(gram)) inter += 1;
  });
  return inter / gb.size;
}

const LABEL_ONLY = /更穩定了|更懂得愛自己|開始重視自己|很在乎關係|很重視.{0,10}關係|正在成長|變得更成熟|更懂珍惜|開始看見彼此支持的重要|正在學習好好溝通|更能覺察自己的情緒|很重視自己與身邊人的關係/;

const INTERPRETIVE_MOVE = /不是.{0,28}而是|真正.{0,12}(在意|補|耗|練|出現|還沒)|怎麼(說話|做事|陪伴|對待|回應)|同時有|補能|耗能|有情緒時|越在乎|沒有人肯定|共同結構|一個人怎麼對待|保留.{0,6}空間|選擇空間|之間的距離|還沒跟上|第一句話|晚一步|那一秒|共享的是|代表什麼|可能不只是/;

const CALIBRATED_HYPOTHESIS = /好像|可能|也許|不確定是不是|值得留意|值得知道|值得注意|一個角度|放在一起看|有一個可能/;

const STRUCTURAL_READING = /共享|共同|結構|對待|放在心上|邊界|距離|選擇|回應|出現在|怎麼(說話|做事|陪伴|對待)|補回|耗|連結|知道.{0,12}(還沒|答應|跟上)|說出|留(下|著|一點)|不是.{0,28}而是|真正/;

const SHALLOW_QUESTION = /這對[妳你]來說代表什麼|為什麼[妳你]覺得自己|你真正想要的是什麼[？?]?$|這件事讓你學到什麼|為什麼[妳你]會這樣想[？?]?$/;

const THINKING_MOVE = /如果|還是|面對的是|最親近|有情緒|平靜時|沒有人肯定|換一個情境|真正需要練|失效|越在乎|條件不同|不是原本以為|第一次情緒|選擇空間|講不通|還成立|換成|容易讓|什麼情況下|什麼時候會|即使|就算|相比|對照|邊界|沒有人|別人回應|知道.{0,8}做到/;

const VAGUE_OBSERVE = /多觀察自己的情緒|持續保持覺察|保持覺察|提醒自己好好溝通|多觀察(?!.*從哪一刻)|好好溝通(?!.*一句)|照顧自己(?!.*具體)/;

const EMPTY_CORE = {
  facts: [],
  connections: [],
  interpretation: "",
  alternative: "",
  whyWorthKnowing: "",
  status: "empty",
  source: "",
  revised: false,
  revisionNote: "",
};

function hasInterpretiveMove(text) {
  return INTERPRETIVE_MOVE.test(asText(text));
}

function hasCalibratedHypothesis(text) {
  return CALIBRATED_HYPOTHESIS.test(asText(text));
}

function hasStructuralReading(text) {
  return STRUCTURAL_READING.test(asText(text)) || hasInterpretiveMove(text);
}

function looksLabelOnly(statement, why) {
  const blob = `${asText(statement)} ${asText(why)}`;
  if (!blob) return false;
  if (hasInterpretiveMove(blob) || (hasCalibratedHypothesis(blob) && hasStructuralReading(blob))) return false;
  return LABEL_ONLY.test(blob) || /正在變得|開始懂得|很在乎關係/.test(blob);
}

function looksShallowParaphrase(statement, rawBlob) {
  const line = asText(statement);
  const blob = asText(rawBlob);
  if (!line || !blob) return false;
  if (hasInterpretiveMove(line) || (hasCalibratedHypothesis(line) && hasStructuralReading(line))) return false;
  return gramOverlap(line, blob) >= 0.55;
}

function looksCoOccurrenceOnly(statement, why) {
  const blob = `${asText(statement)} ${asText(why)}`;
  if (!blob) return false;
  if (!/放在一起|還沒.{0,8}明說|分開寫|同時出現|關係還沒|兩件事/.test(blob)) return false;
  // Juxtaposition plus a calibrated structural reading is a hypothesis, not mere co-occurrence.
  if (hasInterpretiveMove(blob) || (hasCalibratedHypothesis(blob) && hasStructuralReading(blob))) return false;
  return true;
}

function interpretationHasDepth(statement, why, rawBlob) {
  const line = `${asText(statement)} ${asText(why)}`;
  if (compactChars(statement) < 10) return false;
  if (looksLabelOnly(statement, why)) return false;
  if (looksCoOccurrenceOnly(statement, why)) return false;
  if (looksShallowParaphrase(statement, rawBlob) && !hasStructuralReading(line)) return false;
  // Depth = grounded inferential move, not a required lexical slogan.
  if (hasInterpretiveMove(line)) return true;
  if (hasCalibratedHypothesis(line) && hasStructuralReading(line)) return true;
  if (hasCalibratedHypothesis(line) && compactChars(statement) >= 18 && !looksShallowParaphrase(statement, rawBlob)) return true;
  return false;
}

function looksShallowQuestion(question) {
  const q = asText(question);
  if (!q) return true;
  return SHALLOW_QUESTION.test(q) || /真正的幸福是什麼/.test(q);
}

function questionHasNewVariable(question, rawBlob) {
  const q = asText(question);
  if (!q || looksShallowQuestion(q)) return false;
  if (gramOverlap(q, rawBlob) >= 0.72) return false;
  if (THINKING_MOVE.test(q)) return true;
  // Boundary / contrast / condition tests without relying on one slogan set.
  const testsHypothesis =
    /如果|換成|還是|會不會|還能|成立|什麼時候|什麼情況|哪一種|相比|對照|即使|就算|越.+越|面對的是/.test(q);
  const introducesDimension =
    /最親近|有情緒|平靜|陌生人|工作|家裡|當下|之後|第一次|沒有人|肯定|回應|邊界|距離|容易|困難|別人|條件/.test(q);
  return testsHypothesis && introducesDimension;
}

function looksVagueLifeAdvice(text) {
  return VAGUE_OBSERVE.test(asText(text));
}

const LEVEL3_CLAIM = /真實來源|才是.{0,20}(真實)?來源|才是.{0,12}原因|真正原因是|真正害怕的是|其實真正害怕|其實[妳你]需要的是|[妳你]真正需要的是|被看見的需要|需要落空|沒有被聽到.{0,12}才是|這代表[妳你]一直|隱藏的(需要|動機|原因)|內心真正|才是胸口.{0,8}(悶|空)|才是.{0,8}難受/;

const STRENGTH_INFLATION = /照顧自己的能力|仍然有意識地照顧|疲憊不等於無能為力|即使.{0,10}(累|疲).{0,28}(能力|照顧|有意識|選擇)|最低能量.{0,16}(選擇|能力)|還在做對身體有益|不是被動退縮|兌現的執行力|快速決策並兌現|執行力/;

function looksLevel3Unsupported(statement, why, rawBlobText) {
  const blob = `${asText(statement)} ${asText(why)}`;
  const src = asText(rawBlobText);
  if (!LEVEL3_CLAIM.test(blob)) return false;
  // Only allow if the user herself framed the same hidden-need / true-source claim.
  if (/被看見的需要|需要落空|真實來源|真正需要|真正害怕|隱藏/.test(blob)) {
    if (!/被看見|需要被|真實來源|真正需要|真正害怕/.test(src)) return true;
  }
  if (/才是.{0,20}(真實)?來源|才是.{0,12}原因|真正原因是|沒有被聽到.{0,12}才是|才是胸口|才是.{0,8}難受/.test(blob)) {
    if (!/才是|真正原因|真實來源/.test(src)) return true;
  }
  if (/這代表[妳你]一直|隱藏的(需要|動機|原因)|內心真正/.test(blob)) return true;
  return LEVEL3_CLAIM.test(blob) && !LEVEL3_CLAIM.test(src);
}

function looksStrengthInflation(statement, why, rawBlobText) {
  const blob = `${asText(statement)} ${asText(why)}`;
  const src = asText(rawBlobText);
  if (!STRENGTH_INFLATION.test(blob)) return false;
  // Explicit progress / deliberate choice in RAW can support a strength reading.
  if (/第一次|沒有立刻|練習|我選|我決定|刻意|有意識地|先說|先寫|把手機放下|再想一週/.test(src)) return false;
  return true;
}

function estimateInferenceLevel(statement, why, rawBlobText) {
  const blob = `${asText(statement)} ${asText(why)}`;
  const src = asText(rawBlobText);
  if (!asText(statement)) return 0;
  if (looksLevel3Unsupported(statement, why, src)) return 3;
  if (looksShallowParaphrase(statement, src) && !hasInterpretiveMove(blob) && !hasCalibratedHypothesis(blob)) return 0;
  if (hasInterpretiveMove(blob) || (hasCalibratedHypothesis(blob) && hasStructuralReading(blob))) return 2;
  if (hasCalibratedHypothesis(blob) || hasStructuralReading(blob) || /分開看|放在一起|對比|同時|還是有|也有注意到/.test(blob)) return 1;
  if (gramOverlap(statement, src) >= 0.55) return 0;
  return 1;
}

function normalizeThinkingCore(raw) {
  const src = raw && typeof raw === "object" ? raw : null;
  if (!src) return { ...EMPTY_CORE };
  const status = /^(hypothesis|revised|empty)$/.test(asText(src.status)) ? asText(src.status) : asText(src.interpretation) ? "hypothesis" : "empty";
  const facts = Array.isArray(src.facts) ? src.facts.map(asText).filter(Boolean).slice(0, 8) : [];
  const connections = Array.isArray(src.connections) ? src.connections.map(asText).filter(Boolean).slice(0, 6) : [];
  const next = {
    facts,
    connections,
    interpretation: asText(src.interpretation || src.statement),
    alternative: asText(src.alternative),
    whyWorthKnowing: asText(src.whyWorthKnowing || src.whyItMatters || src.why),
    status: asText(src.interpretation || src.statement) ? status : "empty",
    source: asText(src.source),
    revised: Boolean(src.revised),
    revisionNote: asText(src.revisionNote),
  };
  if (!next.interpretation && !next.facts.length) return { ...EMPTY_CORE };
  return next;
}

function coreFromSee(see, extra) {
  const interpretation = asText(see);
  if (!interpretation) return { ...EMPTY_CORE };
  return normalizeThinkingCore({
    ...(extra && typeof extra === "object" ? extra : {}),
    interpretation,
    status: "hypothesis",
    source: "see",
  });
}

function answerContradictsInterpretation(answer, interpretation) {
  const a = asText(answer);
  const c = asText(interpretation);
  if (!a || !c) return false;
  if (/不是|沒有|並非|不太成立|其實不是/.test(a) && gramOverlap(a, c) >= 0.18) return true;
  if (/越親近.{0,8}越難|有情緒.{0,12}(比較|反而)/.test(a) && /每一個人都可以好好說話|對所有人都|好好說話|怎麼說話/.test(c)) return true;
  if (/怕.{0,12}不配合/.test(a) && /躲避感覺|逃避感覺/.test(c)) return true;
  if (/只是累|本來就很累/.test(a) && /害怕被忽略/.test(c)) return true;
  return false;
}

function reviseThinkingCore(core, update) {
  const prev = normalizeThinkingCore(core);
  const data = update && typeof update === "object" ? update : {};
  const answer = asText(data.answer);
  const nextInterpretation = asText(data.interpretation || data.convergence);
  const contradicted = answer && answerContradictsInterpretation(answer, prev.interpretation);
  const revised = Boolean(data.revised) || contradicted || (nextInterpretation && prev.interpretation && gramOverlap(nextInterpretation, prev.interpretation) < 0.45);
  if (!answer && !nextInterpretation) return prev;
  if (contradicted && !nextInterpretation) {
    return normalizeThinkingCore({
      ...prev,
      interpretation: compactChars(answer) <= 90 ? `從你的回答來看，${answer.replace(/。+$/, "")}。` : prev.interpretation,
      status: "revised",
      source: "user-answer",
      revised: true,
      revisionNote: asText(data.revisionNote) || "user-answer-overturned",
    });
  }
  return normalizeThinkingCore({
    ...prev,
    interpretation: nextInterpretation || prev.interpretation,
    alternative: asText(data.alternative) || prev.alternative,
    whyWorthKnowing: asText(data.whyWorthKnowing) || prev.whyWorthKnowing,
    status: revised ? "revised" : prev.status === "empty" ? "hypothesis" : prev.status,
    source: answer ? "user-answer" : prev.source || "see",
    revised,
    revisionNote: revised ? asText(data.revisionNote) || (contradicted ? "user-answer-overturned" : "reinterpreted") : prev.revisionNote,
  });
}

function currentInterpretation(core, fallback) {
  const data = normalizeThinkingCore(core);
  return data.interpretation || asText(fallback);
}

module.exports = {
  asText,
  compactChars,
  gramOverlap,
  EMPTY_CORE,
  looksLabelOnly,
  looksShallowParaphrase,
  looksCoOccurrenceOnly,
  interpretationHasDepth,
  looksShallowQuestion,
  questionHasNewVariable,
  looksVagueLifeAdvice,
  looksLevel3Unsupported,
  looksStrengthInflation,
  estimateInferenceLevel,
  hasInterpretiveMove,
  hasCalibratedHypothesis,
  hasStructuralReading,
  normalizeThinkingCore,
  coreFromSee,
  reviseThinkingCore,
  currentInterpretation,
  answerContradictsInterpretation,
};
