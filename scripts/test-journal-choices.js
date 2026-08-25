const {
  hasMeaningfulChoices,
  emptyChoiceBag,
  normalizeChoiceOptions,
  normalizeChoiceBag,
  selectedChoiceTexts,
  mergeChoiceBags,
  mergeJournalObjects,
  pickReview,
  historyDeepThinkingView,
  CHOICE_NONE_TEXT,
  CHOICE_MAX_SELECTED,
} = require("../lib/review-merge");
const { normalizeGeneratedChoiceOptions, CHOICES_AWARENESS_SYSTEM, CHOICES_THINK_SYSTEM } = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const empty = emptyChoiceBag();
assert(hasMeaningfulChoices(empty) === false, "空 choice bag 不可算有內容");
assert(empty.none !== false, "空 bag 不可帶 none:false，以免 cloud merge 誤判有內容");

const padded = normalizeChoiceOptions(
  [
    { id: "a1", text: "當別人主動表達在乎時，我會特別有感" },
    { id: "a2", text: "我真正被碰到的，可能不是事情本身，而是有人把我放在心上" },
    { id: "a3", text: "我開始發現，自己珍惜的是關係裡那些很小、很日常的陪伴" },
    { id: "a4", text: "我在感動之後，很容易接著擔心自己是不是不夠珍惜" },
    { id: "a5", text: "我好像比自己以為的更在意被放在心上" },
  ],
  { max: 4 }
);
assert(padded.length === 4, "最多 4 個，不可為了湊數收到 5 個");
assert(padded.every((item) => item.id !== "none"), "none 不在一般選項內");

const sparse = normalizeChoiceOptions(
  [
    { id: "a1", text: "當別人主動表達在乎時，我會特別有感" },
    { id: "a2", text: "我真正被碰到的，可能不是事情本身，而是有人把我放在心上" },
    { id: "a3", text: "我在感動之後，很容易接著擔心自己是不是不夠珍惜" },
  ],
  { max: 4 }
);
assert(sparse.length === 3, "只有 3 個能推導時就只留 3 個，不要湊滿");

const withNone = normalizeChoiceOptions([{ id: "none", text: CHOICE_NONE_TEXT }, { id: "a1", text: "當別人主動表達在乎時，我會特別有感" }]);
assert(withNone.every((item) => item.id !== "none"), "固定 none 選項不可進 options");

let bag = normalizeChoiceBag({
  options: sparse,
  selectedIds: ["a1", "a3", "a2"],
});
assert(bag.selectedIds.length === CHOICE_MAX_SELECTED, "最多選 2 個");
assert(bag.selectedIds.includes("a1") && bag.selectedIds.includes("a3"), "保留前兩個有效勾選");

bag = normalizeChoiceBag({
  options: sparse,
  selectedIds: ["a1"],
  none: true,
});
assert(bag.none === true, "允許 0 個：none");
assert(bag.selectedIds.length === 0, "none 與一般勾選互斥");

const zero = normalizeChoiceBag({ options: sparse, selectedIds: [] });
assert(zero.none !== true, "允許 0 個：什麼都不勾");
assert(selectedChoiceTexts(zero).length === 0, "0 個勾選時 selected texts 為空");

const older = {
  awarenessChoices: {
    sourceSig: "sig-a",
    options: sparse,
    selectedIds: ["a1"],
    generatedAt: "2026-08-25T01:00:00.000Z",
  },
  thinkChoices: {
    sourceSig: "sig-t",
    options: [
      { id: "t1", text: "我害怕的可能不是失去，而是來不及好好珍惜" },
      { id: "t2", text: "有些關係的重要，不需要等到失去才被看見" },
      { id: "t3", text: "我真正想留下的，也許不是某個結果，而是彼此有好好在一起的感覺" },
    ],
    selectedIds: ["t1"],
    generatedAt: "2026-08-25T01:00:00.000Z",
  },
};
const newerEmpty = {
  thanksText: "謝謝",
  awarenessChoices: emptyChoiceBag(),
  thinkChoices: emptyChoiceBag(),
};
const merged = mergeJournalObjects(older, newerEmpty);
assert(merged.awarenessChoices.selectedIds[0] === "a1", "跨裝置空 awarenessChoices 不可覆蓋舊勾選");
assert(merged.thinkChoices.selectedIds[0] === "t1", "跨裝置空 thinkChoices 不可覆蓋舊勾選");

const picked = pickReview(
  { date: "2026-08-25", journal: older, updatedAt: "2026-08-25T01:00:00.000Z" },
  { date: "2026-08-25", journal: newerEmpty, updatedAt: "2026-08-25T02:00:00.000Z" }
);
assert(picked.journal.awarenessChoices.selectedIds[0] === "a1", "pickReview 空資料不可覆蓋舊 choices");

const avoidThink = ["我害怕的可能不是失去，而是來不及好好珍惜", "有些關係的重要，不需要等到失去才被看見"];
const awareness = normalizeGeneratedChoiceOptions(
  {
    options: [
      { id: "a1", text: "我害怕的可能不是失去，而是來不及好好珍惜" },
      { id: "a2", text: "當別人主動表達在乎時，我會特別有感" },
      { id: "a3", text: "我真正被碰到的，可能不是事情本身，而是有人把我放在心上" },
      { id: "a4", text: "我好像比自己以為的，更在意有沒有被放在心上" },
    ],
  },
  "awareness",
  avoidThink
);
assert(awareness.every((item) => !avoidThink.includes(item.text)), "05 必須丟掉與 04 深度思考重複的句子");
assert(awareness.length >= 3, "去掉 04 重複後仍應留下 05 自己的句子");
assert(CHOICES_THINK_SYSTEM.includes("這件事背後，對我真正代表什麼"), "04 prompt 必須是意義層");
assert(CHOICES_THINK_SYSTEM.includes("不要依賴尚未生成的覺察結論"), "04 不可依賴 05");
assert(CHOICES_THINK_SYSTEM.includes("禁止寫成 05"), "04 不可搶 05 的自我覺察");
assert(CHOICES_AWARENESS_SYSTEM.includes("我看見了自己什麼"), "05 prompt 必須是看見自己");
assert(CHOICES_AWARENESS_SYSTEM.includes("發生在 04 深度思考之後"), "05 可以讀 04");
assert(CHOICES_AWARENESS_SYSTEM.includes("禁止寫成 04"), "05 不可再寫事情意義");

const paraphrased = normalizeChoiceOptions(
  [{ id: "a1", text: "我害怕的可能不是失去，好像是來不及好好珍惜" }],
  { avoid: ["我害怕的可能不是失去，而是來不及好好珍惜"] }
);
assert(paraphrased.length === 0, "05 去重不可只看前 12 字，換句話說也要擋");

const oldGuide = historyDeepThinkingView({
  journal: {
    insight: { guide: { rounds: [{ question: "Q1", answer: "A1" }] } },
  },
});
assert(oldGuide.kind === "guide", "沒有 thinkChoices 時仍顯示舊三輪");
assert(oldGuide.rounds[0].answer === "A1", "舊 awareness/guide.rounds 必須可顯示");

const newThink = historyDeepThinkingView({
  journal: {
    thinkChoices: {
      options: [
        { id: "t1", text: "我害怕的可能不是失去，而是來不及好好珍惜" },
        { id: "t2", text: "有些關係的重要，不需要等到失去才被看見" },
        { id: "t3", text: "我真正想留下的，也許不是某個結果，而是彼此有好好在一起的感覺" },
      ],
      selectedIds: ["t1"],
    },
    insight: {
      guide: {
        rounds: [{ question: "舊三輪 Q1", answer: "舊三輪 A1" }],
        awareness: "今天真正有感的是被放在心上。",
        selfSeen: "我看見自己害怕來不及珍惜。",
        takeaway: "有些愛不必等到失去才看見。",
      },
    },
  },
});
assert(newThink.kind === "thinkChoices", "新版 04 必須走 thinkChoices");
assert(newThink.selectedTexts[0].includes("來不及好好珍惜"), "新版必須顯示勾選句");
assert(!newThink.rounds || newThink.rounds.length === 0, "新版 choices 存在時 history 不可再帶舊 rounds");

console.log("journal choices tests passed");
