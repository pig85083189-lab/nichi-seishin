"use strict";

const assert = require("assert");
const boundary = require("../lib/public-output-boundary");
const insightUnderstand = require("../lib/insight-understand");
const insightGrow = require("../lib/insight-grow");
const insightAct = require("../lib/insight-act");
const bodyMindSee = require("../lib/body-mind-see");

const HUGE_REASONER = [
  "【CORE】",
  "你是 ING 的內部思考引擎，不是寫給使用者看的文案。",
  "USER RAW｜最高信任",
  "LOCKED KNOWN_BY_USER",
  "PIPELINE SCHEMA REASONER JUDGE GATE MODEL INTERNAL",
  "possibilities: A B C",
  "thinkingCore status hypothesis",
  "a".repeat(400),
].join("\n");

function check(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

check("A normal concise Chinese exact preservation", () => {
  const line = "你其實已經把界線說出來了。";
  assert.strictEqual(boundary.sanitizePublicText(line, { maxChars: 96, fallback: "" }), line);
  const out = insightUnderstand.projectUnderstand(
    {
      stage: "asked1",
      focus: line,
      whyWorthThinking: "值得再看身體有沒有比較鬆。",
      question: "如果換成更親近的人，你還會這樣說嗎？",
      answer: "我比較在意被推開的感覺。",
      possibilities: [{ id: "A", text: "secret" }],
      thinkingCore: { interpretation: "secret" },
      pastDrop: { date: "x", reason: "y" },
    },
    { event: "e", mood: "m", thanksText: "t" },
    []
  );
  assert.strictEqual(out.understand.focus, line);
  assert.strictEqual(out.understand.answer, "我比較在意被推開的感覺。");
  assert.strictEqual(out.understand.possibilities, undefined);
  assert.strictEqual(out.understand.thinkingCore, undefined);
  assert.strictEqual(out.understand.pastDrop, undefined);
});

check("B meaningful moderately long Chinese preserved", () => {
  const why =
    "你其實已經把界線說出來了。值得再看的，是說出口之後身體有沒有比較鬆，還有那一刻你有沒有真正為自己留一點空間。";
  assert.ok(boundary.compactChars(why) > 50);
  assert.ok(boundary.compactChars(why) <= boundary.LIMITS.understandWhy);
  assert.strictEqual(
    boundary.sanitizePublicText(why, { maxChars: boundary.LIMITS.understandWhy, fallback: "FALLBACK" }),
    why
  );
});

check("C multi-sentence long output ends at natural sentence boundary", () => {
  const long = [
    "今天這件事裡，你其實已經把界線說出來了。",
    "值得再看的是說出口之後身體有沒有比較鬆。",
    "如果換成更親近的人，這個選擇還會不會一樣，也值得再確認一次。",
    "還有一層是，當下胸口緊的時候，你有沒有先為自己留一點空間，而不是立刻把最重的話送出去。",
    "最後也可以再問自己：這次停下來，比較像保護自己，還是比較像害怕關係受影響。",
  ].join("");
  assert.ok(boundary.compactChars(long) > boundary.LIMITS.understandWhy, String(boundary.compactChars(long)));
  const out = boundary.sanitizePublicText(long, {
    maxChars: boundary.LIMITS.understandWhy,
    fallback: "FALLBACK",
  });
  assert.ok(out);
  assert.ok(out !== "FALLBACK");
  assert.ok(/[。！？!?]$/.test(out), `expected sentence end, got: ${out}`);
  assert.ok(out.startsWith("今天這件事裡"), `should keep leading sentences, got: ${out}`);
  assert.ok(!out.includes("……"));
  assert.ok(boundary.compactChars(out) <= boundary.LIMITS.understandWhy);
});

check("C2 single oversized sentence cuts at clause boundary", () => {
  const one =
    "妳真正所在意的可能不是這件事本身，而是當妳發現媽媽其實也有她的擔心，並且那個擔心又和妳對關係的期待纏在一起，讓妳一時之間不知道該先保護自己還是先照顧別人的情緒。";
  assert.ok(boundary.compactChars(one) > 72);
  const out = boundary.sanitizePublicText(one, { maxChars: 72, fallback: "FALLBACK" });
  assert.ok(out && out !== "FALLBACK");
  assert.ok(!/情緒。$/.test(out) || boundary.compactChars(out) <= 72);
  assert.ok(!out.includes("……"));
  assert.ok(out.startsWith("妳真正所在意"));
  assert.ok(!/纏在一起，讓妳一時之間不知道該先保護自己還是先照顧別人的情緒/.test(out) || boundary.compactChars(out) <= 72);
});

check("D giant engine dump blocked", () => {
  const out = insightUnderstand.projectUnderstand(
    {
      stage: "asked1",
      focus: HUGE_REASONER,
      whyWorthThinking: "PIPELINE SCHEMA",
      question: "正常問題嗎？",
      answer: "使用者回答保留",
    },
    { event: "e", mood: "m", thanksText: "t" },
    []
  );
  assert.ok(!/內部思考|USER RAW|PIPELINE|【CORE】/.test(JSON.stringify(out)));
  assert.strictEqual(out.understand.answer, "使用者回答保留");
});

check("E past round-trip 04 → 05 still works", () => {
  const projected = insightUnderstand.projectUnderstand(
    {
      stage: "converged",
      focus: "你其實已經把界線說出來了。",
      whyWorthThinking: "值得再看身體有沒有比較鬆。",
      convergence: "這次你先停下來，而不是立刻答應。",
      past: {
        used: true,
        date: "2026-08-01",
        similarity: "都碰到要不要立刻答應的情境",
        difference: "上次比較像立刻答應；這次有先停下來。",
        change: "反應不一樣了：這次沒有立刻開始做。",
        connectionType: "same-situation",
      },
      answer: "我怕被覺得不配合。",
      possibilities: [{ id: "A", text: "should not round-trip" }],
      thinkingCore: { interpretation: "should not round-trip" },
    },
    { event: "開會", mood: "緊", thanksText: "謝謝自己" },
    []
  );
  const bag = projected.understand;
  assert.ok(bag.past && bag.past.used === true);
  assert.strictEqual(bag.past.date, "2026-08-01");
  assert.ok(bag.past.similarity);
  assert.ok(bag.past.difference);
  assert.ok(bag.past.change);
  assert.strictEqual(bag.past.connectionType, "same-situation");
  assert.strictEqual(bag.possibilities, undefined);
  assert.strictEqual(bag.thinkingCore, undefined);

  // Grow reads: past.used, past.similarity, past.difference, past.change (not connectionType).
  const pastBlock =
    bag.past && bag.past.used
      ? `相似：${bag.past.similarity}\n不同／變化：${bag.past.difference} ${bag.past.change}`
      : "";
  assert.ok(pastBlock.includes("都碰到要不要立刻答應"));
  assert.ok(pastBlock.includes("這次有先停下來"));
  assert.ok(!pastBlock.includes("should not round-trip"));

  const grown = insightGrow.projectItems(
    [
      {
        id: "a1",
        title: "開始先停一下",
        text: "這次你沒有立刻答應，已經多出一點選擇空間。",
        type: "EMERGING",
        maturity: "NOTICING",
      },
    ],
    { event: "開會", mood: "緊", thanksText: "謝謝自己" },
    bag,
    { meta: {} }
  );
  assert.strictEqual(grown.items.length, 1);
  assert.deepStrictEqual(grown.selectedIds, []);
});

check("F no internal reasoning in public response", () => {
  const out = insightUnderstand.projectUnderstand(
    {
      stage: "asked1",
      focus: "你其實已經把界線說出來了。",
      whyWorthThinking: "值得再看身體有沒有比較鬆。",
      question: "如果換成更親近的人，你還會這樣說嗎？",
      past: {
        used: true,
        date: "2026-08-01",
        similarity: "USER RAW 內部推理 dump",
        difference: "正常不同點。",
        change: "正常變化。",
        connectionType: "judge-secret-meta",
      },
      possibilities: [{ id: "A", text: "secret" }],
      thinkingCore: { interpretation: "secret" },
      pastDrop: { date: "x", reason: "GATE" },
    },
    { event: "e", mood: "m", thanksText: "t" },
    []
  );
  const json = JSON.stringify(out);
  assert.ok(!/"possibilities"/.test(json));
  assert.ok(!/"thinkingCore"/.test(json));
  assert.ok(!/"pastDrop"/.test(json));
  assert.ok(!/USER RAW|內部推理|judge-secret/.test(json));
  assert.strictEqual(out.understand.past.connectionType, "");
  assert.ok(!out.understand.past.similarity || !/USER RAW|內部推理/.test(out.understand.past.similarity));
});

check("03/06 still contract-safe", () => {
  const see = bodyMindSee.projectSeeOutput({
    status: "observation",
    insight: "你其實在守住自己的節奏。",
    support: "不一定要先下結論。",
    thinkingCore: { interpretation: "secret" },
  });
  assert.strictEqual(see.thinkingCore, undefined);
  const act = insightAct.projectActions(
    [
      { id: "e1", kind: "ACTION_NOW", title: "先喝一口水", detail: "開會前先讓身體停一下。", sourceAwarenessIds: ["a1"] },
      { id: "e2", kind: "PRACTICE", title: "寫下一句", detail: "用一句話記下真正想說的。", sourceAwarenessIds: ["a1"] },
      { id: "e3", kind: "OBSERVE", title: "觀察胸口", detail: "注意緊是什麼時候出現的。", sourceAwarenessIds: ["a1"] },
    ],
    {
      awarenessSelected: ["x"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "x" }],
    },
    { leadIn: "把這份覺察帶回生活。" }
  );
  assert.strictEqual(act.actions.length, 3);
  assert.deepStrictEqual(act.selectedIds, []);
});

console.log("\nALL FINAL BOUNDARY REVIEW FIXTURES PASSED");
console.log("LIMITS", boundary.LIMITS);
