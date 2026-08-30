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
  MANIFEST_CLOSE_SYSTEM,
  MANIFEST_PLAN_SYSTEM,
  isCompactAwarenessResult,
  normalizeCompactAwarenessResult,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");

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
  "CASE A：相容 DOM 順序仍是 01–06 後接隱藏的舊 07"
);
assert(/id="section-manifest"\s+hidden/.test(html), "CASE A：07 區塊 hidden，不進今日主流程");

const foldMatch = app.match(/const JOURNAL_FOLD_IDS = \[([\s\S]*?)\];/);
assert(foldMatch, "JOURNAL_FOLD_IDS 必須存在");
const foldIds = [...foldMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
const foldCore = foldIds.filter((id) =>
  ["section-body", "section-insight", "section-deep", "section-aware", "section-exec", "section-manifest"].includes(id)
);
assert(
  JSON.stringify(foldCore) ===
    JSON.stringify(["section-body", "section-insight", "section-deep", "section-aware", "section-exec"]),
  "fold 順序以 06 執行力為最後一站"
);
assert(!foldIds.includes("section-manifest"), "JOURNAL_FOLD_IDS 不再含 section-manifest");

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
assert(app.includes("function generateThinkV2Ask"), "正式 04 主路徑已接 V2");
assert(app.includes("function generateThinkChoices"), "CURRENT 04 仍保留相容");

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
assert(EXECUTION_PROMPTS_SYSTEM.includes("最多 2 輪"), "CASE H：舊 execution Q&A 路徑仍最多 2 題");
assert(app.includes("const EXECUTION_PROMPT_MAX = 2"), "CASE H：runtime 最多 2 題");
assert(app.includes("function generateExecutionChoices"), "新版 06 走 executionChoices，不再預設出題");

assert(MANIFEST_PROMPTS_SYSTEM.includes("最多 2 題"), "CASE I：舊 07 prompts 路徑仍最多 2 題");
assert(MANIFEST_CLOSE_SYSTEM.includes("futureVision"), "CASE I：舊 close 路徑仍保留");
assert(MANIFEST_PLAN_SYSTEM.includes("3 到 6 個具體步驟") || MANIFEST_PLAN_SYSTEM.includes("3 到 6"), "CASE I：舊 plan prompt 仍保留相容");
assert(app.includes("generateManifestPlan"), "CASE I：舊 generateManifestPlan 仍保留");
assert(app.includes("function dailyManifestUiEnabled"), "CASE I：每日 07 UI 已停用開關");
assert(/function dailyManifestUiEnabled\(\) \{\s*return false;/.test(app), "CASE I：每日 07 UI 關閉");
assert(!html.includes("guide-07"), "CASE I：使用說明不再有 07");
assert(app.includes("priorThinkAwareContext(journal)"), "CASE I：舊 07 runtime 仍可讀前面資料");

assert(app.includes('"① 今天發生了什麼"'), "CASE J：歷史 01 是今天發生了什麼");
assert(app.includes('"② 我今天真正卡住的是什麼"'), "CASE J：歷史 02 是真正卡住的矛盾");
assert(app.includes('"③ 我今天看見了自己什麼"'), "CASE J：歷史 03 是新的自我理解");
assert(app.includes('"④ 我接下來要怎麼做"'), "CASE J：歷史 04 是行動");
assert(app.includes('"今日帶走的一句話"'), "CASE J：歷史最後留一句話");
assert(app.includes("查看當天完整紀錄"), "CASE J：深度思考原始對話可在 History 展開");
assert(!app.includes('"⑤ 覺察力"'), "CASE J：歷史不再把覺察力當獨立大章");
assert(!app.includes('"⑥ 執行力"'), "CASE J：歷史不再把執行力當獨立大章");
assert(app.includes('"顯化紀錄"'), "CASE J：舊顯化改標顯化紀錄，不再當 07");
assert(!app.includes('"⑦ 顯化力"'), "CASE J：歷史不再編號 07");
assert(app.includes("function journalHasManifestHistory"), "CASE J：新資料沒有 manifest 就不渲染空 07");
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

const thanksFold = html.slice(html.indexOf("id=\"section-thanks\""), html.indexOf("id=\"thanksFoldPanel\""));
const eventFold = html.slice(html.indexOf("id=\"section-event\""), html.indexOf("id=\"eventFoldPanel\""));
const bodyFold = html.slice(html.indexOf("id=\"section-body\""), html.indexOf("id=\"bodyFoldPanel\""));
const deepFold = html.slice(html.indexOf("id=\"section-deep\""), html.indexOf("id=\"deepFoldPanel\""));
const awareFold = html.slice(html.indexOf("id=\"section-aware\""), html.indexOf("id=\"awareFoldPanel\""));
const execFold = html.slice(html.indexOf("id=\"section-exec\""), html.indexOf("id=\"execFoldPanel\""));
assert(thanksFold.includes("把今天值得感謝的人、事、物留下來。"), "01 收合說明是意義不是操作");
assert(eventFold.includes("寫下今天真正碰到你的那件事與感受。"), "02 收合說明");
assert(bodyFold.includes("留意今天身體或心裡，特別有感覺的那一刻。"), "03 收合說明");
assert(html.includes("id=\"bodyMindText\""), "03 新版只有主 textarea");
assert(html.includes("js-legacy-body-ui") && html.includes("hidden"), "舊 03 mood／身體選項改為隱藏相容");
assert(deepFold.includes("看看這件事背後，對你真正代表什麼。"), "04 收合說明：理解這件事");
assert(!deepFold.includes("勾選即可"), "04 收合不混操作說明");
assert(awareFold.includes("經過今天這些事情，我看見了自己什麼。"), "05 收合說明：看見自己");
assert(!awareFold.includes("勾選即可"), "05 收合不混操作說明");
assert(execFold.includes("把今天的覺察，變成真正做得到的下一步。"), "06 收合說明");
assert(!execFold.includes("完成會同步到側邊欄"), "06 收合不寫系統同步");
assert(app.includes("選出最有感的 1～2 個就好。"), "04／05 勾選區上方輕提示");
assert(app.includes("function choiceListHtml") && app.slice(app.indexOf("function choiceListHtml"), app.indexOf("function renderAwarenessChoices")).includes("選出最有感的 1～2 個就好。"), "輕提示只在 04／05 choice list");

assert((html.match(/打字或用麥克風說都可以/g) || []).length >= 4, "語音提示：01／02／03／06 靜態輸入區有提示");
assert(html.includes("id=\"thanksText\"") && html.slice(html.indexOf("id=\"thanksText\""), html.indexOf("id=\"thanksText\"") + 400).includes("打字或用麥克風說都可以"), "01 感謝 textarea 旁有語音提示");
assert(html.includes("id=\"eventText\"") && html.slice(html.indexOf("id=\"eventText\""), html.indexOf("id=\"moodRow\"")).includes("打字或用麥克風說都可以"), "02 事件 textarea 旁有語音提示");
assert(!html.slice(html.indexOf("id=\"moodRow\""), html.indexOf("id=\"quickModules\"")).includes("打字或用麥克風說都可以"), "02 心情選擇不加語音提示");
assert(app.includes("function journalVoiceHintHtml") && app.includes("think-guide-answer") && app.includes("journalVoiceHintHtml()"), "動態書寫區沿用同一提示");
assert(!app.includes("getUserMedia") && !app.includes("webkitSpeechRecognition") && !app.includes("SpeechRecognition"), "不新增錄音／語音辨識 API");
assert(css.includes(".journal-voice-hint") && !html.includes("id=\"btnVoice") && !html.includes("語音輸入</button>"), "提示是輕量文字不是按鈕");

assert(thanksFold.includes("data-journal-fold") && eventFold.includes("data-journal-fold") && bodyFold.includes("data-journal-fold") && deepFold.includes("data-journal-fold") && awareFold.includes("data-journal-fold") && execFold.includes("data-journal-fold"), "01～06 header 都可點");
assert(html.includes('id="section-thanks"') && html.includes("journal-fold is-open"), "空畫面預設 01 展開");
assert(app.includes("function journalFoldPrefs") && app.includes('return { open: "section-thanks" }'), "新帳號 fold prefs 預設 01");
assert(!app.includes("if (!pointerOk && !keyboardOk) return true;"), "新帳號／iOS 點 header 不會被 pointerdown 門檻吃掉");

assert(!html.includes("CREATE TABLE") && !app.includes("ALTER TABLE"), "CASE T：沒有 schema SQL");
assert(!/UPDATE\s+reviews/i.test(app), "CASE T：沒有批次 UPDATE 舊 reviews");

console.log("journal flow order tests passed");
