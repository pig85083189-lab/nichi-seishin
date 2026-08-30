const fs = require("fs");
const path = require("path");
const { mergeJournalObjects, hasMeaningfulInsight, hasMeaningfulGuide } = require("../lib/review-merge");
const { buildHistoryReading } = require("../lib/history-reading");
const { choicesUserPrompt } = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes("<span>04</span> 深度思考"), "畫面仍是 04 深度思考");
assert(!html.includes("CURRENT") && !html.includes("information gain"), "正式 UI 不出現 debug 字");
assert(html.includes("正在整理今天的問題"), "loading 文案是問題不是選項");
assert(app.includes("function generateThinkV2Ask") && app.includes("function submitThinkV2Answer") && app.includes("function generateThinkV2Close"), "V2 主路徑函式都在");
assert(app.includes("function generateThinkChoices") && app.includes("function generateThinkChoicesClose"), "CURRENT 04 仍保留");
assert(app.includes("CHOICES_THINK_SYSTEM") === false, "app 不內嵌 CURRENT prompt");
assert(reviewJs.includes("CHOICES_THINK_SYSTEM") && reviewJs.includes("THINK_CHOICES_CLOSE_SYSTEM"), "CURRENT prompt 仍在 API");
assert(app.includes('variant: "think-v2"'), "正式 request 帶 think-v2");
assert(app.includes("usesThinkV2Path"), "新日走 V2，舊 choices 走 CURRENT");
assert(app.includes("hasMeaningfulChoices(bag)"), "有舊勾選時不誤切 V2");
assert(app.includes("insight.guide") && app.includes('variant: "think-v2"'), "存在 guide jsonb 相容欄位");
assert(app.includes("persistJournalQuietly"), "仍走既有 autosave");
assert(app.includes("rejectArchivedJournalWrite"), "已完成不可重產");
assert(app.includes("persistArchivedUserMarks"), "userMarks 規則未拆");
assert(app.includes("thinkVariant: think.thinkVariant"), "05 可讀 V2 variant");
assert(app.includes("slice(-2)"), "05 只帶最後幾句使用者回答");
assert(app.includes("choicesBusy?.think") && app.includes("choicesBusy?.thinkClose"), "request lock 在");
assert(app.includes("thinkV2Closed(guide) && (guide.awareness || guide.selfSeen"), "close 可重入");
assert(app.includes("核心結論") && app.includes("我沒看見的問題") && app.includes("怎麼做可以更好"), "04 完成後三個固定區塊");
assert(app.includes("close: {") && app.includes("coreConclusion"), "persist close 物件");
assert(css.includes(".think-v2") && css.includes("overflow-wrap: anywhere"), "長問題可換行");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "schema 零修改");

const older = {
  insight: {
    guide: {
      variant: "think-v2",
      status: "asking",
      rounds: [{ question: "現在最想停在哪裡？", answer: "就是身體累。" }],
      awareness: "",
      selfSeen: "",
    },
  },
};
const newer = { insight: { guide: { variant: "think-v2", rounds: [], awareness: "", selfSeen: "" } } };
const merged = mergeJournalObjects(older, newer);
assert(hasMeaningfulInsight(merged.insight), "空的新 insight 不可覆蓋已有 V2");
assert(hasMeaningfulGuide(merged.insight.guide), "V2 rounds 在 merge 後仍在");
assert(merged.insight.guide.rounds[0].answer === "就是身體累。", "Q1 回答不會被空結構蓋掉");

const v2Aware = choicesUserPrompt({
  kind: "awareness",
  date: "2026-08-30",
  context: {
    thanksText: "撐完了",
    event: "今天真的好累",
    mood: "疲憊",
    thinkVariant: "think-v2",
    thinkSelected: ["就是身體累，不想分析。"],
    thinkCloseAwareness: "今天就是累了。",
    thinkCloseSelfSeen: "你說不想分析。",
    thinkCloseBlindSpot: "目前沒有明顯的心理盲點，今天更像是真的累了。",
  },
});
assert(v2Aware.includes("【04 深度思考"), "05 仍讀 04");
assert(v2Aware.includes("今天就是累了。"), "05 讀 V2 核心結論");
assert(v2Aware.includes("不要把「我沒看見的問題」原句當成 05"), "05 不直接複製盲點");
assert(v2Aware.includes("就是身體累，不想分析。"), "05 讀使用者自己說的");
assert(!v2Aware.includes("尚未勾選"), "V2 不走勾選空狀態");

const reading = buildHistoryReading({
  journal: {
    event: "冷氣壞掉，房間真的很熱。",
    mood: "煩躁",
    insight: { guide: { variant: "think-v2", awareness: "就是熱到睡不好。", selfSeen: "沒有別的。" } },
  },
});
assert(reading.stuck && reading.stuck.text.includes("熱"), "History ② 讀 V2 stuck");

const readingClose = buildHistoryReading({
  journal: {
    event: "媽媽叫我搬出去。",
    mood: "難過",
    insight: {
      guide: {
        variant: "think-v2",
        awareness: "舊 stuck 不該蓋過新 close。",
        close: { coreConclusion: "真正卡住的是理解與同意不是同一件事。", blindSpot: "你在確認她有沒有聽懂。", improvementDirection: "先分開理解和同意。" },
      },
    },
    awarenessResult: { line: "我看見自己一直在解釋。", seen: "我允許自己先停下來。" },
    executionChoices: { options: [{ id: "e1", text: "問媽媽現在理解到哪", detail: "具體問一句", selected: true }], selectedIds: ["e1"] },
  },
});
assert(readingClose.stuck && readingClose.stuck.text.includes("理解與同意"), "History ② 讀 coreConclusion");
assert(readingClose.seen && !String(readingClose.seen.text || "").includes("你在確認她有沒有聽懂"), "History ③ 不直接用 blindSpot");

console.log("think v2 wiring tests passed");
