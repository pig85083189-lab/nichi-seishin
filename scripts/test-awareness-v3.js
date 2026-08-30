const fs = require("fs");
const path = require("path");
const awarenessV3 = require("../lib/awareness-v3");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes('id="btnAwarenessV3"'), "05 V3 CTA 存在");
assert(html.includes("看看今天真正看見了自己什麼"), "05 CTA 文案");
assert(app.includes("function generateAwarenessV3"), "V3 generate 存在");
assert(app.includes('variant: "awareness-v3"'), "request 帶 awareness-v3");
assert(app.includes("generateAwarenessV3({ confirmed: true })"), "只有 CTA confirmed 才生成");
assert(!/function persistJournalNow[\s\S]{0,280}generateAwarenessV3/.test(app), "autosave 不生成 05");
assert(!/function scheduleJournalAutosave[\s\S]{0,220}generateAwarenessV3/.test(app), "debounce 不生成 05");
assert(app.includes("function generateAwarenessChoices"), "legacy 05 未刪");
assert(app.includes("function generateJournalChecklist"), "legacy close 未刪");
assert(reviewJs.includes("awarenessV3.isAwarenessV3Request"), "review 接 05 V3");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "zero schema");
assert(app.includes("function generateBodyMindInsight"), "03 未拆");
assert(app.includes("function generateReflectionV3"), "04 未拆");

assert(awarenessV3.awarenessV3GenerationAllowed({ confirmed: true }), "confirmed 才允許");
assert(!awarenessV3.awarenessV3GenerationAllowed({}), "沒 confirmed 不允許");
assert(!awarenessV3.awarenessV3GenerationAllowed({ auto: true, confirmed: true }), "auto 不允許");

const QUALITY = [
  {
    id: "A",
    name: "家庭衝突",
    context: { thanksText: "還有地方住", event: "家裡環境讓我很不舒服，因為男友只能住這裡。", mood: "悶", bodyMindText: "一回客廳胸口就緊。", coreQuote: "也許值得看的是選擇正在被交換。", thinkQuestions: [{ text: "這個只能，是沒有選項，還是代價太高？" }] },
    result: { items: [
      { id: "a1", text: "我發現，真正讓我不舒服的不只是環境亂，而是我好像沒有生活選擇。" },
      { id: "a2", text: "我看見自己習慣先接受現況，再把不舒服往身體裡收。" },
      { id: "a3", text: "我很在意這段關係，所以才會把居住安排當成暫時不能動的事。" },
    ] },
    forbid: /童年創傷|依附|討好型人格/,
  },
  {
    id: "B",
    name: "伴侶幸福",
    context: { thanksText: "有他在", event: "跟男友吃飯一直笑，很幸福。", mood: "開心", bodyMindText: "整個人都很放鬆。", coreQuote: "放鬆本身或許比做了什麼更值得看。", thinkQuestions: [{ text: "讓你放鬆的是他做了什麼，還是你可以做自己？" }] },
    result: { items: [
      { id: "a1", text: "我發現，只要身邊的人讓我可以自然做自己，我其實很容易感受到幸福。" },
      { id: "a2", text: "我看見自己其實很珍惜那些沒有壓力、可以自在相處的時刻。" },
      { id: "a3", text: "今天的放鬆告訴我，被允許做自己時，我的身體會先知道。" },
    ] },
    forbid: /創傷|害怕失去|依附/,
  },
  {
    id: "C",
    name: "工作壓力",
    context: { thanksText: "總算做完一版", event: "員工交出來的東西和我要的標準差很多。", mood: "煩", bodyMindText: "太陽穴一直跳。", coreQuote: "今天卡住的也許是標準有沒有對上。", thinkQuestions: [{ text: "差很多，是技能、理解，還是決策權？" }] },
    result: { items: [
      { id: "a1", text: "我發現，真正讓我煩的是標準沒對上，而不只是這一版不好看。" },
      { id: "a2", text: "我看見自己一看到落差，身體會先緊起來，再開始想怎麼修。" },
      { id: "a3", text: "我很在意事情做到什麼程度才算夠，這個尺目前好像只有我自己拿著。" },
    ] },
    forbid: /害怕不被肯定|討好型人格/,
  },
  {
    id: "D",
    name: "已經溝通很多次",
    context: { thanksText: "我有開口", event: "這件事我已經跟對方說過很多次，對方還是這樣。", mood: "無力", bodyMindText: "一想到又要說，肩膀就沉。", coreQuote: "也許累的不是還沒表達，而是說了之後事情仍沒對上。", thinkQuestions: [{ text: "再說一次，是新的溝通，還是重複無效方法？" }] },
    result: { items: [
      { id: "a1", text: "我發現，我不是沒有表達，而是表達過後事情還是沒有對上。" },
      { id: "a2", text: "我看見自己一想到又要說一次，身體就先覺得累。" },
      { id: "a3", text: "我開始分得清：被聽懂，和對方願意改，其實不是同一件事。" },
    ] },
  },
  {
    id: "E",
    name: "自我懷疑",
    context: { thanksText: "還是交出去了", event: "簡報前一直覺得自己不夠好。", mood: "忐忑", bodyMindText: "手心一直濕。", coreQuote: "不夠好的念頭和交出去的行動，原來可以分開。", thinkQuestions: [{ text: "這個好的標準，是工作需要的，還是你拿來壓自己的？" }] },
    result: { items: [
      { id: "a1", text: "我發現，覺得不夠好的時候，我還是可以把事情交出去。" },
      { id: "a2", text: "我看見自己會用一個很高的尺先審判自己，再開始做事。" },
      { id: "a3", text: "今天真正值得認領的，也許是我已經完成了該交的那一步。" },
    ] },
  },
  {
    id: "F",
    name: "單純疲累",
    context: { thanksText: "終於下班", event: "今天工作很多，真的很累。", mood: "累", bodyMindText: "整個人都痠。", coreQuote: "今天最清楚的事實也許就是身體用完了。", thinkQuestions: [{ text: "如果先把今天只是累當真，有什麼解釋可以放下？" }] },
    result: { items: [
      { id: "a1", text: "我發現，今天最清楚的一件事就是我真的累了。" },
      { id: "a2", text: "我看見自己下班後，身體比腦袋更先說停。" },
      { id: "a3", text: "我很珍惜終於可以停下來的這段時間。" },
    ] },
    forbid: /童年|討好型人格|不安全感/,
  },
  {
    id: "G",
    name: "客觀問題",
    context: { thanksText: "冷氣終於來了", event: "辦公室冷氣壞掉，下午熱到沒辦法專心。", mood: "煩", bodyMindText: "頭有點昏。", coreQuote: "今天低落的主因很可能就是環境真的很難做事。", thinkQuestions: [{ text: "熱和沒專心，還需要再加什麼解釋嗎？" }] },
    result: { items: [
      { id: "a1", text: "我發現，環境不舒服時，我的專注力會先被抽走。" },
      { id: "a2", text: "我看見自己在客觀條件很差時，還是會先怪自己沒做好。" },
      { id: "a3", text: "今天值得認領的是：不是我不夠專心，是熱真的讓人很難做事。" },
    ] },
    forbid: /不安全感|討好/,
  },
  {
    id: "H",
    name: "evidence 不足",
    context: { thanksText: "平安", event: "今天有點怪怪的，說不上來。", mood: "平靜", bodyMindText: "就是有點空。", coreQuote: "今天還看不清楚，本身就可以先被承認。", thinkQuestions: [{ text: "這份空，比較像沒事，還是有事還沒命名？" }] },
    result: { items: [
      { id: "a1", text: "我發現，今天有一份說不上來的空，我還不想急著解釋。" },
      { id: "a2", text: "我看見自己在平安的日子裡，仍會注意身體有沒有哪裡不對勁。" },
      { id: "a3", text: "我可以先承認：有些感覺，今天只需要被看見，不必被定義。" },
    ] },
    forbid: /童年創傷|依附/,
  },
  {
    id: "I",
    name: "04 question 含 hypothesis",
    context: { thanksText: "有人聽我說", event: "開會時我講完沒人接話。", mood: "悶", bodyMindText: "胸口緊。", coreQuote: "也許卡住的是有沒有被接住。", thinkQuestions: [{ text: "你在意的其實是被某個重要的人理解嗎？" }] },
    result: { items: [
      { id: "a1", text: "我發現，講完沒人接話時，我會立刻覺得自己好像說錯了。" },
      { id: "a2", text: "我看見自己在安靜的房間裡，身體會先緊起來。" },
      { id: "a3", text: "我很在意自己說出去的話，有沒有在場上留下位置。" },
    ] },
    forbid: /我真正需要的是被重要的人理解/,
  },
  {
    id: "J",
    name: "03 hypothesis 不同",
    context: { thanksText: "還能回家", event: "加班到很晚，只覺得身體很累。", mood: "累", bodyMindText: "大腿和肩膀都很痠。", bodyMindInsight: "你可能在意選擇權。", bodyMindSupport: "先看看選擇是不是不在自己手上。", coreQuote: "今天最硬的事實仍是身體被拉太長。", thinkQuestions: [{ text: "還需要立刻談選擇權嗎？" }] },
    result: { items: [
      { id: "a1", text: "我發現，今天最清楚的是加班把身體拉太長了。" },
      { id: "a2", text: "我看見自己即使很痠，還是會先把工作做完再回家。" },
      { id: "a3", text: "我很珍惜終於能回家這件事，它比任何解釋都更具體。" },
    ] },
    forbid: /我就是失去選擇權|不安全感/,
  },
];

QUALITY.forEach((spec) => {
  const judged = awarenessV3.evaluateAwarenessV3Quality(spec.result, { context: spec.context, forbid: spec.forbid });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
});

const bad = awarenessV3.evaluateAwarenessV3Quality(
  {
    items: [
      { id: "a1", text: "你可能是一個對自己要求很高的人。" },
      { id: "a2", text: "我發現我真正需要的是被重要的人理解。" },
      { id: "a3", text: "我發現我真正需要的是被重要的人理解。" },
    ],
  },
  { context: { event: "開會沒人接話", bodyMindText: "胸口緊。", thinkQuestions: [{ text: "你在意的其實是被某個重要的人理解嗎？" }] } }
);
assert(bad.issues.includes("a1-second-person") || bad.issues.includes("duplicate-items"), "第二人稱／重複必須 FAIL");

console.log("awareness-v3 tests passed");
