"use strict";

/**
 * AI Engine V2.1 — 03 SEE
 * Clean rebuild. Does NOT import legacy SEE / Thinking Core / Gate / Lenses.
 */

const publicBoundary = require("../public-output-boundary");
const { SEE_OUTPUT_STATUS } = require("./types");
const trust = require("./trust");

const ENGINE = "v2";
const STAGE = "see";

const INSUFFICIENT_COPY = Object.freeze({
  insight: "【今日金句】\n今天留下的內容還比較少。",
  support: "目前還不太夠整理出有根據的覺察。你可以再多寫一點今天發生的事、感受，或身體的感覺，再試一次。",
});

const SEE_SYSTEM = `你是「進行式 ING」的 03 身心覺察（SEE）反思引擎。

任務：讀懂使用者今天寫下的全部內容，整理出今天真正的核心，並幫她看見自己可能還沒發現的地方。

成功感：
1.「它真的有看懂我今天寫的東西。」
2. 理想上還能有：「欸，這個角度我自己沒有想到。」

這不是：
- 身體檢查報告
- 心理診斷
- 問題強迫搜尋
- 雞湯 / 勵志文
- 單純摘要複述
- 只問問題不給整理

輸入是「一天的完整生活脈絡」。03 身心文字可有可無；沒有 03 也要讀 01+02+心情。整份一起看，不要分段各自分析。

【內部探索｜八個可選視窗｜不是必做步驟】
回答前，可依今天內容挑選有用的視窗來探索。不要每次全用。不要對使用者說出工具名稱。不要輸出八個區塊。

1. REALITY CHECK｜哪些是今天真的發生的事？哪些是感受？哪些是我對這件事的理解？不要否定情緒；目的是避免把解釋誤當事實。
2. REFRAME LENS｜換一個合理位置看，這件事還可能代表什麼？（例如：別人說「妳現在很順」不一定等於否定過去辛苦，也可能是妳已把很多困難消化成現在的穩定。）
3. GUT DECODE｜為什麼這句話／這件事特別有感？這個情緒可能碰到什麼在意的地方？不要診斷、不要發明創傷史。
4. THOUGHT ORGANIZER｜這裡是不是有兩件不同的事，被當成同一件？（例如：「希望努力被看見」≠「為了證明給別人看才努力」，兩者可同時存在。）
5. DECISION MIRROR｜這件事反映出她今天真正重視的是什麼？不要做成人格分類。
6. ROOT QUESTION｜她以為自己在問什麼？真正值得看的問題會不會是另一個？
7. RISK SCAN｜若照現在這個想法一直走，有沒有可能忽略另一件重要的事？不是災難預言，也不是硬找負面。
8. NEXT MOVE｜今天需要行動嗎？還是光是看見就夠？03 以覺察為主，不要硬塞行動作業。

探索後，只把「今天最值得被看見」且有根據的整理寫進答案。
目標不是「我能摘要什麼」，而是「今天值得幫她注意到什麼」。

【價值層次｜通常要有混合】
- MIRROR：準確反映她已表達的重要內容
- CONNECT：把今天不同段落連起來，看出合在一起才成立的意義
- NEW ANGLE：在內容撐得住時，給一個她可能還沒想到、且帶校準語氣的可能性
不要讓 3～5 則覺察全是複述。內容夠時，至少有一則朝 NEW ANGLE 前進。

認識論：
- FACT：使用者寫得出來的 → 可直接說
- POSSIBILITY：合理且有根據的解釋，但未確認 → 可提出，且必須用「有一個可能／也許／換個角度看／不一定是這樣，但……」等校準語氣
- UNSUPPORTED：虛構童年/創傷/人格/動機/沒寫過的事實 → 禁止
重要：POSSIBILITY ≠ 刪除。有根據的可能性要留下來；只有 UNSUPPORTED 才丟棄。

請輸出 JSON（只要 JSON）：
{
  "status": "observation" | "insufficient",
  "coreQuote": "一句今日核心金句（像使用者自己會說的話，貼近她的語言與情境，非勵志套話）",
  "reflections": ["覺察1", "覺察2", "覺察3"],
  "optionalNewAngle": "可選。Layer C 新角度；若無把握請空字串",
  "evidence": ["從原文抽出的短證據片語"]
}

寫作要求：
- 繁體中文、台灣口語自然、溫暖清楚有腦
- reflections 通常 3～5 則，職責不要全相同（可含：情緒、已理解、卡點、矛盾、需要、力量、價值、成長、關係動態、另一種解釋、值得接受的事）
- 正面日子不要硬找問題；中性日子不要硬變負面
- 至少有一部分是 CONNECT；在內容撐得住時給 NEW ANGLE（可用 optionalNewAngle 或 reflections 其中一則）
- 不要臨床腔、說教、過度鼓勵、空泛靈性、AI 腔摘要、反覆複述
- 不要無故說「你已經做得很好／這很不容易／給自己一點空間」
- status=insufficient 僅在內容真的太少、無法有根據地整理時使用`;

function asText(value) {
  return trust.asText(value);
}

function compactLen(text) {
  return publicBoundary.compactChars(text);
}

function truthyText(value) {
  return compactLen(asText(value)) >= 2;
}

function collectInput(ctx) {
  const src = ctx && typeof ctx === "object" ? ctx : {};
  const thanks = asText(src.thanksText || src.thanks || "");
  const event = asText(src.event || src.text || "");
  const mood = asText(src.mood || "");
  const bodyMind = asText(src.bodyMindText || src.bodyNote || "");
  return { thanks, event, mood, bodyMind };
}

function inputSources(input) {
  return {
    thanks: truthyText(input.thanks),
    event: truthyText(input.event),
    mood: truthyText(input.mood),
    bodyMind: truthyText(input.bodyMind),
  };
}

function meaningfulScore(input) {
  let score = 0;
  if (compactLen(input.thanks) >= 6) score += 2;
  else if (truthyText(input.thanks)) score += 1;
  if (compactLen(input.event) >= 12) score += 3;
  else if (truthyText(input.event)) score += 1;
  if (truthyText(input.mood)) score += 1;
  if (compactLen(input.bodyMind) >= 8) score += 2;
  else if (truthyText(input.bodyMind)) score += 1;
  return score;
}

function hasMeaningfulInput(input) {
  // Empty 03 alone must not block. Need enough from 01/02/mood/03 combined.
  return meaningfulScore(input) >= 3;
}

function buildUserPrompt(input) {
  const lines = [
    "以下是使用者今天的完整復盤內容。請整份一起讀完再整理。",
    "",
    "【01 感恩】",
    input.thanks || "（未填）",
    "",
    "【02 今日事件】",
    input.event || "（未填）",
    "",
    "【心情】",
    input.mood || "（未填）",
    "",
    "【03 身心覺察｜可選】",
    input.bodyMind || "（未填；請仍根據 01+02+心情整理）",
    "",
    "請輸出符合 schema 的 JSON。",
  ];
  return lines.join("\n");
}

function sanitizePublic(text, maxChars) {
  return publicBoundary.sanitizePublicText(text, {
    maxChars,
    multiline: true,
    fallback: "",
  });
}

function formatSupport(reflections, optionalNewAngle) {
  const blocks = [];
  (Array.isArray(reflections) ? reflections : []).forEach((line) => {
    const safe = sanitizePublic(line, 280);
    if (!safe) return;
    blocks.push(safe);
  });
  const numbered = blocks.map((line, index) => `${index + 1}.\n${line}`);
  if (asText(optionalNewAngle)) {
    const angleSafe = sanitizePublic(asText(optionalNewAngle), 320);
    if (angleSafe) numbered.push(`另外一個角度：\n${angleSafe}`);
  }
  return numbered.join("\n\n");
}

function toPublicDto(parsed) {
  const coreQuote = asText(parsed.coreQuote);
  const reflections = trust.filterUnsupportedLines(parsed.reflections).slice(0, 5);
  let optionalNewAngle = asText(parsed.optionalNewAngle);
  if (optionalNewAngle && trust.looksUnsupportedInference(optionalNewAngle)) {
    optionalNewAngle = "";
  }
  if (optionalNewAngle && !trust.hasCalibratedPossibilityLanguage(optionalNewAngle)) {
    // Soft calibration: prefix rather than drop a grounded angle.
    optionalNewAngle = `有一個可能是：${optionalNewAngle}`;
  }
  if (trust.looksGenericMotivation(coreQuote)) {
    return null;
  }
  const cleanedReflections = reflections.filter((line) => !trust.looksGenericMotivation(line));
  if (!coreQuote || cleanedReflections.length < 2) return null;

  const quoteSafe = sanitizePublic(coreQuote, publicBoundary.LIMITS.seeInsight || 140);
  if (!quoteSafe || trust.looksGenericMotivation(quoteSafe)) return null;
  // Keep label + newline so existing formatted bodyMind renderer can show theme + pre body.
  const insight = `【今日金句】\n${quoteSafe}`;
  const support = formatSupport(cleanedReflections, optionalNewAngle);
  if (!insight || !support || compactLen(support) < 12) return null;

  const evidence = (Array.isArray(parsed.evidence) ? parsed.evidence : [])
    .map((item) => asText(item))
    .filter(Boolean)
    .filter((item) => !trust.looksUnsupportedInference(item))
    .slice(0, 6)
    .map((item) => sanitizePublic(item, 40))
    .filter(Boolean);

  return {
    insight,
    support,
    status: SEE_OUTPUT_STATUS.OBSERVATION,
    seeType: "SEE_V2",
    evidence,
    confidence: cleanedReflections.length >= 3 ? "high" : "medium",
    _v2: {
      coreQuote,
      reflections: cleanedReflections,
      optionalNewAngle,
      hasNewAngle: Boolean(optionalNewAngle),
    },
  };
}

function insufficientPublic() {
  return {
    insight: INSUFFICIENT_COPY.insight,
    support: INSUFFICIENT_COPY.support,
    status: "silence",
    seeType: "",
    evidence: [],
    confidence: "",
  };
}

function buildMeta(input, extras) {
  const sources = inputSources(input);
  const bag = extras && typeof extras === "object" ? extras : {};
  const outputStatus = asText(bag.outputStatus) || SEE_OUTPUT_STATUS.ERROR;
  return {
    engine: ENGINE,
    stage: STAGE,
    inputSources: sources,
    reflectionCount: Number(bag.reflectionCount) || 0,
    hasCoreQuote: Boolean(bag.hasCoreQuote),
    hasNewAngle: Boolean(bag.hasNewAngle),
    outputStatus,
    // Compatible with existing Internal seeTrace retention sanitizer + V2 extras.
    seeTrace: {
      finalStatus: outputStatus === SEE_OUTPUT_STATUS.OBSERVATION ? "observation" : outputStatus,
      insightPresent: Boolean(bag.hasCoreQuote),
      boundary: {
        insight: asText(bag.boundaryInsight) || "pass",
        support: asText(bag.boundarySupport) || "pass",
      },
      engine: ENGINE,
      inputSources: sources,
      reflectionCount: Number(bag.reflectionCount) || 0,
      hasCoreQuote: Boolean(bag.hasCoreQuote),
      hasNewAngle: Boolean(bag.hasNewAngle),
      outputStatus,
    },
  };
}

function parseModelJson(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }
  return null;
}

async function runSeeV2(options) {
  const opts = options && typeof options === "object" ? options : {};
  const callAi = opts.callAi;
  const ctx = opts.ctx && typeof opts.ctx === "object" ? opts.ctx : {};
  const input = collectInput(ctx);

  if (typeof callAi !== "function") {
    throw new Error("missing callAi");
  }

  if (!hasMeaningfulInput(input)) {
    const pub = insufficientPublic();
    return {
      ...pub,
      meta: buildMeta(input, {
        outputStatus: SEE_OUTPUT_STATUS.INSUFFICIENT,
        reflectionCount: 0,
        hasCoreQuote: false,
        hasNewAngle: false,
      }),
      empty: true,
    };
  }

  let data = null;
  try {
    data = await callAi(
      [
        { role: "system", content: SEE_SYSTEM },
        { role: "user", content: buildUserPrompt(input) },
      ],
      "see"
    );
  } catch (_err) {
    const pub = insufficientPublic();
    return {
      ...pub,
      meta: buildMeta(input, {
        outputStatus: SEE_OUTPUT_STATUS.ERROR,
        reflectionCount: 0,
        hasCoreQuote: false,
        hasNewAngle: false,
      }),
      empty: true,
    };
  }

  const parsed = parseModelJson(data);
  if (!parsed) {
    const pub = insufficientPublic();
    return {
      ...pub,
      meta: buildMeta(input, {
        outputStatus: SEE_OUTPUT_STATUS.ERROR,
        reflectionCount: 0,
        hasCoreQuote: false,
        hasNewAngle: false,
      }),
      empty: true,
    };
  }

  if (asText(parsed.status) === "insufficient") {
    const pub = insufficientPublic();
    return {
      ...pub,
      meta: buildMeta(input, {
        outputStatus: SEE_OUTPUT_STATUS.INSUFFICIENT,
        reflectionCount: 0,
        hasCoreQuote: false,
        hasNewAngle: false,
      }),
      empty: true,
    };
  }

  const publicDto = toPublicDto(parsed);
  if (!publicDto) {
    const pub = insufficientPublic();
    return {
      ...pub,
      meta: buildMeta(input, {
        outputStatus: SEE_OUTPUT_STATUS.ERROR,
        reflectionCount: 0,
        hasCoreQuote: false,
        hasNewAngle: false,
      }),
      empty: true,
    };
  }

  const meta = buildMeta(input, {
    outputStatus: SEE_OUTPUT_STATUS.OBSERVATION,
    reflectionCount: publicDto._v2.reflections.length,
    hasCoreQuote: true,
    hasNewAngle: publicDto._v2.hasNewAngle,
    boundaryInsight: "pass",
    boundarySupport: "pass",
  });
  delete publicDto._v2;
  return {
    ...publicDto,
    meta,
    empty: false,
  };
}

module.exports = {
  ENGINE,
  STAGE,
  SEE_SYSTEM,
  collectInput,
  inputSources,
  hasMeaningfulInput,
  meaningfulScore,
  buildUserPrompt,
  toPublicDto,
  insufficientPublic,
  runSeeV2,
  formatSupport,
};
