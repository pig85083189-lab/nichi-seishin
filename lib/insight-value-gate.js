"use strict";

const MIN_INSIGHT_ITEMS = 2;
const MAX_INSIGHT_ITEMS = 3;

function compactChars(text) {
  return String(text || "").replace(/\s+/g, "").trim().length;
}

function closeTextKey(text) {
  return String(text || "")
    .replace(/[，。！？、；：:\s「」『』（）()…·\-—～~？?]/g, "")
    .trim();
}

function userSourceBlob(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  return [data.thanksText || data.thanks, data.event, data.bodyMindText || data.bodyNote].filter(Boolean).join("\n");
}

function itemInsightText(item) {
  if (!item) return "";
  if (typeof item === "string") return item.replace(/\s+/g, " ").trim();
  return String(item.insight || item.text || "").replace(/\s+/g, " ").trim();
}

function itemQuestionText(item) {
  if (!item || typeof item !== "object") return "";
  const insight = String(item.insight || "").replace(/\s+/g, " ").trim();
  if (insight) return String(item.question || "").replace(/\s+/g, " ").trim();
  const text = String(item.text || item.question || "").replace(/\s+/g, " ").trim();
  const mark = text.search(/[？?]/);
  if (mark < 0) return "";
  return text.slice(mark).replace(/\s+/g, " ").trim();
}

function hasNewRelation(text) {
  const raw = String(text || "");
  if (/不衝突|可以同時存在|同時存在/.test(raw) && /想睡|累|心情很好|開心/.test(raw) && !/選擇|關係|覺察|相處|參與|習慣/.test(raw)) {
    return false;
  }
  return /放在一起看|不只是有人陪|不只讓你|不只是陪伴|不只是環境|開始影響|走進關係|因此多了|反而記得|以前的你|跟以前|相處的方式|有參與在|正在改變|開始改變|可以複製|真正想帶給|自己最容易被打動|回應方式不一樣|比較像每天|不像突然|不是突然變|情緒過後|已經自己走到|多看見了|對方真的有參與|真正在意的可能不只/.test(
    raw
  );
}

function hasCrossEvidence(text, source) {
  const raw = String(text || "");
  const src = String(source || "");
  if (!raw || !src) return false;
  const domains = [
    /覺察|每天覺察|自我覺察/,
    /聊|相處|回應|關係互動/,
    /拉麵|奇異果|切水果|切奇異果/,
    /Baby|伴侶|他幫你/,
    /學習|閱讀|工作/,
    /客人|被照顧|帶給/,
    /阿嬤|體諒|換一個角度/,
  ];
  let hits = 0;
  domains.forEach((re) => {
    if (re.test(raw) && re.test(src)) hits += 1;
  });
  return hits >= 2;
}

function looksNearParaphrase(text, source) {
  const a = closeTextKey(source);
  const b = closeTextKey(text);
  if (!a || !b || b.length < 8) return false;
  if (hasNewRelation(text)) return false;
  if (a.includes(b) && b.length >= 12) return true;
  if (b.includes(a) && a.length > 10 && b.length / Math.max(a.length, 1) > 0.55) return true;
  const grams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size < 6 || gb.size < 6) return false;
  let inter = 0;
  gb.forEach((gram) => {
    if (ga.has(gram)) inter += 1;
  });
  return inter / gb.size >= 0.72;
}

function looksHappinessRestate(text, source) {
  if (!/幸福/.test(String(source || ""))) return false;
  if (!/幸福/.test(String(text || ""))) return false;
  if (hasNewRelation(text)) return false;
  return /日常|陪伴|一起|切|拉麵|奇異果|才是你真正|就是你的幸福|真正注意的幸福|才是幸福/.test(String(text || ""));
}

function looksTrivialInference(text, source) {
  const src = String(source || "");
  const raw = String(text || "");
  if (/想睡|想睡覺|特別想睡/.test(src) && /累|不衝突|做得夠多|單純就是累|身體在說|可能代表身體/.test(raw) && !hasNewRelation(raw)) {
    return true;
  }
  if (/(運動|健身).{0,12}痠/.test(src) && /身體疲勞|身體累了|肌肉/.test(raw) && !hasNewRelation(raw)) return true;
  if (/開心|一直笑/.test(src) && /心情好/.test(raw) && !hasNewRelation(raw)) return true;
  if (/學(了很多|習)|閱讀|工作/.test(src) && /有成長|變厲害|一直在學習/.test(raw) && !hasNewRelation(raw) && compactChars(raw) < 36) {
    return true;
  }
  if (/重視幸福|你很在意幸福/.test(raw) && /幸福/.test(src) && !hasNewRelation(raw)) return true;
  return looksHappinessRestate(raw, src);
}

function looksForcedBodyInsight(text, ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const body = String(data.bodyMindText || data.bodyNote || "");
  const rest = [data.thanksText || data.thanks, data.event].filter(Boolean).join("\n");
  const raw = String(text || "");
  const bodyIsSleep = /想睡|想睡覺|特別想睡/.test(body);
  const textIsSleep = /想睡|累|不衝突|做得夠多|身體在說|單純就是累/.test(raw);
  if (!bodyIsSleep || !textIsSleep) return false;
  if (/選擇|相處|習慣|關係|覺察|模式|參與/.test(raw) && /選擇|相處|習慣|關係|覺察|Baby|陪伴|聊天/.test(rest)) {
    return false;
  }
  return true;
}

function looksSoWhat(text, source) {
  const raw = String(text || "");
  const src = String(source || "");
  if (!raw) return true;
  if (looksTrivialInference(raw, src)) return true;
  if (looksNearParaphrase(raw, src)) return true;
  if (/日常陪伴可能就是你的幸福|日常陪伴就是你的幸福|身體可能累了|你很重視幸福/.test(raw) && !hasNewRelation(raw)) {
    return true;
  }
  return false;
}

function looksLowValueQuestion(question, source) {
  const q = String(question || "").replace(/\s+/g, " ").trim();
  if (!q) return false;
  if (
    /你今天開心嗎|讓你覺得幸福嗎|陪你讓你幸福嗎|學習對你重要嗎|和 Baby 相處讓你覺得幸福嗎|這份幸福對你來說重要嗎/.test(q)
  ) {
    return true;
  }
  if (
    /你覺得呢\s*[？?]?$|對你重要嗎|這件事情對你重要嗎|你今天是不是很累|日常陪伴就是幸福|日常陪伴就是你的幸福|才是你真正注意的幸福|想睡不衝突|做得夠多了|這是不是幸福|就是你的幸福嗎|幸福感？|身體可能累了嗎/.test(
      q
    )
  ) {
    return true;
  }
  if (/幸福/.test(String(source || "")) && /幸福嗎|幸福感|才是你真正注意的幸福/.test(q) && !/不一樣了|哪一次/.test(q)) {
    return true;
  }
  if (/想睡|特別想睡/.test(String(source || "")) && /累嗎|夠多了|單純就是累|身體在說/.test(q)) return true;
  return false;
}

function inferNewInformation(text, source) {
  const raw = String(text || "");
  const src = String(source || "");
  if (looksSoWhat(raw, src) || looksTrivialInference(raw, src) || looksNearParaphrase(raw, src)) return "";
  if (/走進關係|開始影響.*相處|覺察.*聊/.test(raw)) return "覺察正在改變關係互動";
  if (/不只是有人陪|有參與在你的日常|參與在你的日常/.test(raw)) return "在意的是對方參與日常，而不只是陪伴";
  if (hasNewRelation(raw)) return "new-relation";
  if (hasCrossEvidence(raw, src)) return "cross-section";
  return "";
}

function evaluateInsightCandidate(item, ctx) {
  const source = userSourceBlob(ctx);
  const insight = itemInsightText(item);
  const question = itemQuestionText(item);
  const blob = `${insight} ${question}`.trim();
  const issues = [];
  if (!insight) issues.push("empty");
  if (looksSoWhat(insight, source) || looksSoWhat(blob, source)) issues.push("so-what");
  if (looksTrivialInference(blob, source)) issues.push("trivial-inference");
  if (looksNearParaphrase(insight, source)) issues.push("near-paraphrase");
  if (looksForcedBodyInsight(blob, ctx)) issues.push("forced-body");
  if (looksLowValueQuestion(question, source)) issues.push("low-value-question");
  const newInformation = inferNewInformation(insight, source);
  if (!newInformation) issues.push("no-new-information");
  return {
    ok: !issues.length,
    issues,
    newInformation,
    item,
  };
}

function looksTautologyAwareness(text, source) {
  const raw = String(text || "").replace(/\s+/g, "");
  if (/我發現.{0,10}(開心|幸福|累).{0,16}\1/.test(raw)) return true;
  if (/開心的時候會覺得開心|幸福.*感到幸福|累的時候.*累|開心的時候會覺得開心/.test(raw)) return true;
  if (looksTrivialInference(text, source) && compactChars(raw) < 28) return true;
  return false;
}

function evaluateAwarenessCandidate(item, ctx) {
  const source = userSourceBlob(ctx);
  const text = itemInsightText(item) || String((item && item.text) || "").replace(/\s+/g, " ").trim();
  const think = Array.isArray(ctx && ctx.thinkQuestions) ? ctx.thinkQuestions : [];
  const thinkBlob = think.map((row) => String((row && (row.insight || row.text || row)) || "")).join("\n");
  const issues = [];
  if (!text) issues.push("empty");
  if (looksTautologyAwareness(text, source)) issues.push("so-what");
  if (looksTrivialInference(text, source)) issues.push("trivial-inference");
  if (thinkBlob && looksNearParaphrase(text, thinkBlob) && !hasNewRelation(text)) issues.push("copy-of-04");
  if (looksNearParaphrase(text, source) && !hasNewRelation(text) && !hasCrossEvidence(text, source)) {
    issues.push("no-new-information");
  }
  if (looksTautologyAwareness(text, source) && !issues.includes("no-new-information")) {
    issues.push("no-new-information");
  }
  return { ok: !issues.length, issues, newInformation: inferNewInformation(text, source), item };
}

function gateItems(list, ctx, kind) {
  const rows = Array.isArray(list) ? list : [];
  const judged = rows.map((item) => (kind === "awareness" ? evaluateAwarenessCandidate(item, ctx) : evaluateInsightCandidate(item, ctx)));
  const kept = judged.filter((row) => row.ok).map((row) => row.item);
  const dropped = judged.filter((row) => !row.ok);
  return {
    kept: kept.slice(0, MAX_INSIGHT_ITEMS),
    dropped,
    judged,
  };
}

function valueGateRetryPrompt(dropped, kind) {
  const lines = (Array.isArray(dropped) ? dropped : [])
    .map((row) => {
      const text = itemInsightText(row.item) || (row.item && row.item.text) || "";
      return `- ${String(text).slice(0, 80)} → ${((row.issues || []).join(",")) || "low-value"}`;
    })
    .filter(Boolean);
  const target = kind === "awareness" ? "第一人稱覺察" : "洞察 item";
  return `上一輪有些${target}沒過價值閘門，不要撿回來。
${lines.join("\n") || "- （低價值重述／想睡→累／答案已在原文的問題）"}

只輸出 2～3 個過關內容。寧願 2 個，不要湊第 3 個垃圾。
禁止：重述使用者已寫的幸福；想睡→累；心情好跟想睡不衝突；問「這是不是幸福／你是不是很累／你覺得呢」。
03 想睡若沒連到行為／選擇／關係／長期 pattern，不要放進 04。
優先：跨段連結、正在發生的改變、可重複的成功模式。`;
}

module.exports = {
  MIN_INSIGHT_ITEMS,
  MAX_INSIGHT_ITEMS,
  userSourceBlob,
  hasNewRelation,
  hasCrossEvidence,
  looksNearParaphrase,
  looksTrivialInference,
  looksHappinessRestate,
  looksForcedBodyInsight,
  looksSoWhat,
  looksLowValueQuestion,
  looksTautologyAwareness,
  inferNewInformation,
  evaluateInsightCandidate,
  evaluateAwarenessCandidate,
  gateItems,
  valueGateRetryPrompt,
};
