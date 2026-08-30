const fs = require("fs");
const path = require("path");
const executionV3 = require("../lib/execution-v3");
const { selectedExecutionChoiceActions, mergeExecutionChoiceBags } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes('id="btnExecutionV3"'), "06 V3 CTA 存在");
assert(html.includes("把今天的覺察變成下一步"), "06 CTA 文案");
assert(app.includes("function generateExecutionV3"), "V3 generate 存在");
assert(app.includes('variant: "execution-v3"'), "request 帶 execution-v3");
assert(app.includes("generateExecutionV3({ confirmed: true })"), "只有 CTA confirmed 才生成");
assert(!/function persistJournalNow[\s\S]{0,280}generateExecutionV3/.test(app), "autosave 不生成 06");
assert(!/function executionV3SourceSig[\s\S]{0,500}observationCue/.test(app), "06 stale 不因 cue 改變");
assert(!/function generateExecutionV3[\s\S]{0,240}observationCue/.test(app), "06 生成不讀 cue");
assert(app.includes("function generateExecDeepAsk"), "legacy deep 未刪");
assert(app.includes("function generateExecDeepFinal"), "legacy final 未刪");
assert(app.includes("function generateExecutionChoices"), "legacy choices 未刪");
assert(reviewJs.includes("executionV3.isExecutionV3Request"), "review 接 06 V3");
assert(app.includes("syncSelectedExecutionToSidebar"), "task 接線仍在");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "zero schema");

assert(executionV3.executionV3GenerationAllowed({ confirmed: true }), "confirmed 才允許");
assert(!executionV3.executionV3GenerationAllowed({ auto: true, confirmed: true }), "auto 不允許");

const QUALITY = [
  {
    id: "A",
    name: "家庭衝突",
    context: {
      thanksText: "還有地方住",
      event: "因為男友只能住這裡。",
      mood: "悶",
      bodyMindText: "胸口緊。",
      awarenessSelected: ["我發現，真正讓我不舒服的不只是環境亂，而是我好像沒有生活選擇。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [
        { id: "a1", text: "我發現，真正讓我不舒服的不只是環境亂，而是我好像沒有生活選擇。" },
        { id: "a2", text: "我看見自己習慣先接受現況。" },
      ],
    },
    result: { actions: [
      { id: "e1", title: "分清哪些真的不能改", detail: "列出居住安排裡：不能控制、可以商量、可以自己決定的各一件事。" },
      { id: "e2", title: "寫下未來居住條件", detail: "不是立刻搬家，先寫自己最在意的三個條件。" },
      { id: "e3", title: "跟男友說一個具體感受", detail: "只說今天哪一個空間讓你胸口緊，不要求他立刻改。" },
    ] },
  },
  {
    id: "B",
    name: "伴侶幸福",
    context: {
      event: "吃飯一直笑，很幸福。",
      mood: "開心",
      bodyMindText: "很放鬆。",
      awarenessSelected: ["我發現，只要身邊的人讓我可以自然做自己，我其實很容易感受到幸福。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我發現，只要身邊的人讓我可以自然做自己，我其實很容易感受到幸福。" }],
    },
    result: { actions: [
      { id: "e1", title: "記下今天的放鬆條件", detail: "用三個詞寫下：什麼人、什麼節奏、什麼空間讓你能做自己。" },
      { id: "e2", title: "明天重現其中一件", detail: "選一個最小條件，明天刻意再安排一次。" },
      { id: "e3", title: "告訴他你珍惜什麼", detail: "用一句話讓他知道，不是要求，只是分享。" },
    ] },
    forbid: /分手|切斷/,
  },
  {
    id: "C",
    name: "工作壓力",
    context: {
      event: "員工交出來的東西差很多。",
      mood: "煩",
      awarenessSelected: ["我發現，真正讓我煩的是標準沒對上。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我發現，真正讓我煩的是標準沒對上。" }],
    },
    result: { actions: [
      { id: "e1", title: "寫出這一版的及格線", detail: "列出三個『夠好』的具體條件，明天開會只對這三項。" },
      { id: "e2", title: "對一次標準", detail: "用一個例子說明你要的完成度，而不是再說『差很多』。" },
      { id: "e3", title: "決定誰有最後決策", detail: "標出下次改檔前，誰可以拍板，避免來回修。" },
    ] },
  },
  {
    id: "D",
    name: "溝通過很多次",
    context: {
      event: "說過很多次，對方還是這樣。",
      awarenessSelected: ["我發現，我不是沒有表達，而是表達過後事情還是沒有對上。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我發現，我不是沒有表達，而是表達過後事情還是沒有對上。" }],
    },
    result: { actions: [
      { id: "e1", title: "停一下再說的循環", detail: "先寫下：再說一次，你預期會改變什麼。如果寫不出來，這次就先不說。" },
      { id: "e2", title: "分開理解和改變", detail: "列出『對方可能已經懂』和『對方還沒改』各一件證據。" },
      { id: "e3", title: "設一個再開口的條件", detail: "寫下什麼情況才值得再談，而不是一想到就重說。" },
    ] },
  },
  {
    id: "E",
    name: "自我懷疑",
    context: {
      event: "覺得自己不夠好，還是交了簡報。",
      awarenessSelected: ["我發現，覺得不夠好的時候，我還是可以把事情交出去。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我發現，覺得不夠好的時候，我還是可以把事情交出去。" }],
    },
    result: { actions: [
      { id: "e1", title: "留下已完成的證據", detail: "把今天交出去的三件具體成果寫下來，不評價好不好。" },
      { id: "e2", title: "分開標準和恐懼", detail: "寫一句：這次工作真正需要的標準是什麼。" },
      { id: "e3", title: "下次只改一處", detail: "若要再修，只選一個最影響理解的地方。" },
    ] },
  },
  {
    id: "F",
    name: "單純疲累",
    context: {
      event: "工作很多，真的很累。",
      awarenessSelected: ["我發現，今天最清楚的一件事就是我真的累了。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我發現，今天最清楚的一件事就是我真的累了。" }],
    },
    result: { actions: [
      { id: "e1", title: "先讓身體停下來", detail: "回家後先做一件恢復的事：洗澡或平躺十分鐘，不回工作訊息。" },
      { id: "e2", title: "明天少排一件", detail: "從行程裡刪掉一件可延後的事，讓身體有空檔。" },
      { id: "e3", title: "記下是量還是節奏", detail: "用一句話標出：今天累是因為件數，還是一直被打斷。" },
    ] },
    forbid: /早點睡|冥想|多愛自己/,
  },
  {
    id: "G",
    name: "客觀問題",
    context: {
      event: "冷氣壞了，熱到沒辦法專心。",
      awarenessSelected: ["今天值得認領的是：不是我不夠專心，是熱真的讓人很難做事。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "今天值得認領的是：不是我不夠專心，是熱真的讓人很難做事。" }],
    },
    result: { actions: [
      { id: "e1", title: "標出環境限制", detail: "寫下今天下午哪些工作其實被熱打斷，避免明天用同一套標準自責。" },
      { id: "e2", title: "準備一個退路", detail: "如果冷氣再壞，先選一個可移動的位子或時段。" },
      { id: "e3", title: "補做一件被打斷的事", detail: "只挑一件最重要的，在涼爽時段做完。" },
    ] },
  },
  {
    id: "H",
    name: "evidence 不足",
    context: {
      event: "有點怪怪的，說不上來。",
      awarenessSelected: [],
      awarenessSelectedIds: [],
      awarenessItems: [
        { id: "a1", text: "我發現，今天有一份說不上來的空。" },
        { id: "a2", text: "我可能其實很沒安全感。" },
      ],
    },
    result: { actions: [
      { id: "e1", title: "先記下身體事實", detail: "用一句話寫今天哪裡空、哪裡平靜，不解釋原因。" },
      { id: "e2", title: "明天再看一次", detail: "如果空還在，再決定要不要命名；今天不必下結論。" },
      { id: "e3", title: "做一件平常的小事", detail: "選一件低負擔的日常，讓今天先完整過完。" },
    ] },
    forbid: /不安全感/,
  },
  {
    id: "I",
    name: "未勾選不可當 confirmed",
    context: {
      event: "開會沒人接話。",
      awarenessSelected: ["我看見自己在安靜的房間裡，身體會先緊起來。"],
      awarenessSelectedIds: ["a2"],
      awarenessItems: [
        { id: "a1", text: "我發現我真正需要的是被重要的人理解。" },
        { id: "a2", text: "我看見自己在安靜的房間裡，身體會先緊起來。" },
      ],
    },
    result: { actions: [
      { id: "e1", title: "觀察下次身體訊號", detail: "下次會議若胸口緊，先記下時間和場合，不急著解釋成被理解。" },
      { id: "e2", title: "會後寫一句事實", detail: "只寫『我說完後現場安靜了多久』，不當成自己說錯。" },
      { id: "e3", title: "選一個低風險表達", detail: "若要再開口，只補一句具體資訊，不要求被接住。" },
    ] },
  },
  {
    id: "J",
    name: "重大決定不可越權",
    context: {
      event: "因為男友只能住這裡。",
      awarenessSelected: ["我好像沒有生活選擇。"],
      awarenessSelectedIds: ["a1"],
      awarenessItems: [{ id: "a1", text: "我好像沒有生活選擇。" }],
    },
    result: { actions: [
      { id: "e1", title: "列出能控制的一項", detail: "從居住安排裡找出一件你可以自己決定的小事。" },
      { id: "e2", title: "寫決策標準", detail: "寫下未來若要改變住所，你最在意的三個條件。" },
      { id: "e3", title: "先確認一個事實", detail: "問清楚目前租約或同住安排裡，哪一項真的不能改。" },
    ] },
    forbid: /立刻搬家|分手|離職/,
  },
];

QUALITY.forEach((spec) => {
  const judged = executionV3.evaluateExecutionV3Quality(spec.result, { context: spec.context, forbid: spec.forbid });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
});

const bad = executionV3.evaluateExecutionV3Quality(
  {
    actions: [
      { id: "e1", title: "好好溝通", detail: "相信自己，放下就好。" },
      { id: "e2", title: "立刻搬家", detail: "明天就搬出去。" },
      { id: "e3", title: "好好溝通", detail: "再溝通一次。" },
    ],
  },
  { context: { awarenessSelected: ["我好像沒有生活選擇。"], awarenessSelectedIds: ["a1"], awarenessItems: [{ id: "a1", text: "我好像沒有生活選擇。" }] } }
);
assert(bad.issues.includes("e1-generic") || bad.issues.includes("e2-major-decision") || bad.issues.includes("duplicate-actions"), "generic／重大決定必須 FAIL");

const bag = {
  variant: "execution-v3",
  options: [
    { id: "e1", text: "分清哪些真的不能改", detail: "列出不能控制的一件事。" },
    { id: "e2", text: "寫下未來居住條件", detail: "寫三個條件。" },
    { id: "e3", text: "說一個具體感受", detail: "只說一個空間。" },
  ],
  selectedIds: ["e1"],
};
const actions = selectedExecutionChoiceActions(bag);
assert(actions.length === 1 && actions[0].text === "分清哪些真的不能改", "勾選後可進既有 task 資料形狀");
assert(actions[0].detail, "detail 會跟著走");

const merged = mergeExecutionChoiceBags(bag, { options: [], selectedIds: [] });
assert(merged.options.length === 3, "空 bag 不可抹掉 V3 options");

console.log("execution-v3 tests passed");
