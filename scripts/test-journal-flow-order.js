const fs = require("fs");
const path = require("path");
const {
  mergeJournalObjects,
  emptyChoiceBag,
} = require("../lib/review-merge");
const {
  choicesUserPrompt,
  CHECKLIST_AWARENESS_CHOICES_SYSTEM,
  EXECUTION_PROMPTS_SYSTEM,
  MANIFEST_PROMPTS_SYSTEM,
  MANIFEST_PATHS_SYSTEM,
  isCompactAwarenessResult,
  normalizeCompactAwarenessResult,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const sectionOrder = [...html.matchAll(/id="(section-(?:thanks|event|body|insight|deep|aware|exec|manifest))"/g)].map(
  (item) => item[1]
);
assert(
  JSON.stringify(sectionOrder) ===
    JSON.stringify([
      "section-thanks",
      "section-event",
      "section-body",
      "section-insight",
      "section-deep",
      "section-aware",
      "section-exec",
      "section-manifest",
    ]),
  "CASE A：今日 DOM 順序必須是 01–03 → 深度 → 覺察 → 執行 → 顯化"
);

const foldMatch = app.match(/const JOURNAL_FOLD_IDS = \[([\s\S]*?)\];/);
assert(foldMatch, "JOURNAL_FOLD_IDS 必須存在");
const foldIds = [...foldMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
const foldCore = foldIds.filter((id) =>
  ["section-body", "section-insight", "section-deep", "section-aware", "section-exec", "section-manifest"].includes(id)
);
assert(
  JSON.stringify(foldCore) ===
    JSON.stringify(["section-body", "section-insight", "section-deep", "section-aware", "section-exec", "section-manifest"]),
  "fold 順序必須跟著新流程"
);

assert(html.includes("<span>04</span> 深度思考"), "畫面 04 是深度思考");
assert(html.includes("<span>05</span> 覺察力") || html.includes("<span>05</span>覺察"), "畫面 05 是覺察力");
assert(html.includes("<span>06</span> 執行力"), "畫面 06 是執行力");
assert(html.includes('id="guide-04"') && html.includes("深度思考"), "使用說明 04 是深度思考");
assert(html.includes('id="guide-05"') && html.includes("核心覺察"), "使用說明 05 是覺察力收束");

const thinkFn = app.slice(app.indexOf("async function generateThinkChoices"), app.indexOf("async function generateThinkChoicesClose"));
assert(!thinkFn.includes("state.awarenessChoices"), "CASE C：04 生成不可讀 awarenessChoices");
assert(!thinkFn.includes("awarenessResult"), "CASE C：04 生成不可讀 awarenessResult");
assert(thinkFn.includes("choicesContext(journal)"), "CASE B：04 只帶 01–03 context");

const awareFn = app.slice(app.indexOf("async function generateAwarenessChoices"), app.indexOf("async function generateThinkChoices"));
assert(awareFn.includes("thinkSelected"), "CASE D：05 生成可讀 04 勾選");
assert(awareFn.includes("thinkCloseAwareness") || awareFn.includes("thinkClose"), "CASE D：05 可讀 04 深度看見");

const thinkPrompt = choicesUserPrompt({
  mode: "choices",
  kind: "think",
  context: { thanksText: "謝謝晚餐", event: "回家看見熱湯", mood: "平靜" },
});
assert(thinkPrompt.includes("今日感謝"), "CASE B：04 user prompt 讀感謝");
assert(thinkPrompt.includes("不要等待尚未生成的覺察結論"), "CASE C：04 user prompt 無 circular wait");
assert(!thinkPrompt.includes("禁止改寫下面這些「我現在怎麼了」"), "CASE C：04 不再 avoid 05");

const awarePrompt = choicesUserPrompt({
  mode: "choices",
  kind: "awareness",
  avoid: ["我害怕的可能不是失去，而是來不及好好珍惜"],
  context: {
    thanksText: "謝謝晚餐",
    event: "回家看見熱湯",
    mood: "平靜",
    thinkSelected: ["我害怕的可能不是失去，而是來不及好好珍惜"],
    thinkCloseSelfSeen: "我看見自己珍惜被放在心上的感覺。",
  },
});
assert(awarePrompt.includes("【04 深度思考"), "CASE D：05 user prompt 含 04");
assert(awarePrompt.includes("我害怕的可能不是失去，而是來不及好好珍惜"), "CASE D：05 看得到 04 勾選原文");

assert(CHECKLIST_AWARENESS_CHOICES_SYSTEM.includes("核心覺察"), "CASE E：收束仍是核心覺察");
assert(CHECKLIST_AWARENESS_CHOICES_SYSTEM.includes("我看見了"), "CASE E：收束仍有我看見了");
assert(CHECKLIST_AWARENESS_CHOICES_SYSTEM.includes('"gap": ""'), "CASE F：gap 必須空");
assert(CHECKLIST_AWARENESS_CHOICES_SYSTEM.includes("剛在 05 勾選"), "05 close 編號已更新");

const compact = normalizeCompactAwarenessResult({
  line: "我在意的不是答案，而是有沒有被理解。",
  seen: "有時候我一直解釋自己，其實只是希望自己的感受先被接住。",
  gap: "不該留下",
  question: "今晚還想問自己什麼？",
  echo: "跨日",
});
assert(isCompactAwarenessResult(compact), "CASE E：新結果是 compact");
assert(!compact.gap && !compact.question && !compact.echo, "CASE F：沒有 gap／question");

assert(EXECUTION_PROMPTS_SYSTEM.includes("既然我已經看見這件事"), "CASE G：06 讀 04＋05 後問下一步");
assert(EXECUTION_PROMPTS_SYSTEM.includes("最多 2 輪"), "CASE H：06 最多 2 題");
assert(EXECUTION_PROMPTS_SYSTEM.includes("不要出第 3 題"), "CASE H：不可恢復第 3 題");
assert(app.includes("const EXECUTION_PROMPT_MAX = 2"), "CASE H：runtime 最多 2 題");

assert(MANIFEST_PROMPTS_SYSTEM.includes("最多 2 題"), "CASE I：07 最多 2 題");
assert(MANIFEST_PATHS_SYSTEM.includes("06 執行力"), "CASE I：07 不再把執行力叫 05");
assert(app.includes("priorThinkAwareContext(journal)"), "CASE I：07 可讀前面已完成資料");

assert(app.includes('"④ 深度思考"'), "CASE J：歷史 04 是深度思考");
assert(app.includes('"⑤ 覺察力"'), "CASE J：歷史 05 是覺察力");
assert(app.includes('"⑥ 執行力"'), "CASE J：歷史 06 是執行力");
assert(app.includes("historyDeepThinkingView") || app.includes("renderHistoryDeepThinking"), "CASE K：舊深度 fallback 仍在");
assert(app.includes("isCompactAwarenessResult") && app.includes("我可能忽略的地方"), "CASE L：舊四層 awareness 仍 fallback");

assert(app.includes("renderCombinedHighlightedText"), "CASE M／N／O：combined renderer 仍在");
assert(app.includes('"awareness.line"') && app.includes('"awareness.seen"'), "userMark field 保留 awareness.line／seen");
assert(app.includes('"think.title"') && app.includes('"think.awareness"'), "userMark field 保留 think.*");
assert(!/awarenessResult\.line\.slice\(0,\s*\d+\)/.test(app), "CASE P：沒有對 line 硬切");

const merged = mergeJournalObjects(
  {
    thinkChoices: {
      sourceSig: "sig",
      options: [{ id: "t1", text: "我害怕的可能不是失去，而是來不及好好珍惜" }],
      selectedIds: ["t1"],
      generatedAt: "2026-08-25T01:00:00.000Z",
    },
    awarenessChoices: {
      sourceSig: "sig",
      options: [{ id: "a1", text: "當別人主動表達在乎時，我會特別有感" }],
      selectedIds: ["a1"],
      generatedAt: "2026-08-25T01:00:00.000Z",
    },
  },
  { thinkChoices: emptyChoiceBag(), awarenessChoices: emptyChoiceBag() }
);
assert(merged.thinkChoices.selectedIds[0] === "t1", "CASE S：空 thinkChoices 不覆蓋");
assert(merged.awarenessChoices.selectedIds[0] === "a1", "CASE S：空 awarenessChoices 不覆蓋");

assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE T：沒有 schema SQL");
assert(!/UPDATE\s+reviews/i.test(app), "CASE T：沒有批次 UPDATE 舊 reviews");

console.log("journal flow order tests passed");
