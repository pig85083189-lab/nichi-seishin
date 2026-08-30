const thinkV2 = require("../lib/think-v2");
const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const reviewJs = fs.readFileSync(path.join(__dirname, "..", "api/review.js"), "utf8");

assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("coreConclusion"), "close JSON 有 coreConclusion");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("blindSpot"), "close JSON 有 blindSpot");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("improvementDirection"), "close JSON 有 improvementDirection");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("semantic redundancy"), "close 有反重複");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("不是 checklist"), "04 不搶 06");
assert(!thinkV2.THINK_V2_ASK_SYSTEM.includes("coreConclusion"), "1～3 題 ask prompt 沒被改成 close");
assert(app.includes('kicker: "核心結論"'), "UI 核心結論");
assert(app.includes('kicker: "我沒看見的問題"'), "UI 盲點");
assert(app.includes('kicker: "怎麼做可以更好"'), "UI 改善方向");
assert(reviewJs.includes("不要把「我沒看見的問題」原句當成 05"), "05 不複製盲點");
assert(!reviewJs.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "不改 schema");

const legacy = thinkV2.normalizeThinkV2Close({
  title: "舊格式",
  stuck: "真正卡住的是理解與同意不是同一件事。",
  seen: "你說你希望媽媽理解你。",
  unknown: "",
  direction: "先分開確認她理解到哪裡，以及真正不同意的是哪一部分。",
});
assert(legacy.coreConclusion.includes("理解與同意"), "stuck → coreConclusion");
assert(legacy.improvementDirection.includes("分開確認"), "direction → improvementDirection");
assert(legacy.close.coreConclusion === legacy.coreConclusion, "close 物件相容");
assert(legacy.stuck === legacy.coreConclusion, "舊欄位仍可讀");

const dupe = thinkV2.normalizeThinkV2Close({
  coreConclusion: "你希望媽媽理解你。",
  blindSpot: "你可能沒有發現自己很希望媽媽理解你。",
  improvementDirection: "可以讓媽媽更理解你。",
});
assert(dupe.blindSpot === thinkV2.BLIND_SPOT_FALLBACK, "重複盲點改成保守 fallback");
assert(thinkV2.looksSemanticDuplicate("你希望媽媽理解你。", "你可能沒有發現自己很希望媽媽理解你。"), "反重複能抓到換句話說");

const checklist = thinkV2.normalizeThinkV2Close({
  coreConclusion: "卡住的是理解和同意被混在一起。",
  blindSpot: "理解感受和同意選擇本來就是兩件事。",
  improvementDirection: "1. 晚上 8 點傳訊息\n2. 寫下三件事\n3. 跟媽媽說「妳理解我嗎」",
});
assert(!checklist.improvementDirection, "checklist 不能當 04 改善方向");

const CASES = [
  {
    id: "A",
    name: "媽媽／被理解 vs 被同意",
    close: {
      coreConclusion: "真正讓你卡住的，不只是媽媽有沒有聽懂，而是即使彼此理解，最後仍可能做出不同選擇。",
      blindSpot: "你現在在努力確認她有沒有理解你，但真正還沒分開的是：理解你的感受，和同意你的選擇，本來就是兩件不同的事。",
      improvementDirection: "比起再次完整解釋自己的感受，下一步更值得先確認的是：媽媽現在到底理解到哪裡，以及你們真正不同意的是哪一部分。",
    },
    forbid: /內在小孩|童年|不安全感/,
  },
  {
    id: "B",
    name: "員工／交代 vs 完成標準",
    close: {
      coreConclusion: "卡住的不是你有沒有交代，而是「做到什麼程度才算完成」可能從來沒有對齊。",
      blindSpot: "你一直在看她有沒有照做，但還沒有確認你們對完成標準是不是同一件事。",
      improvementDirection: "比起再強調一次有交代過，更值得先把完成的樣子講清楚，再看落差在哪。",
    },
    forbid: /不用心|態度不好|人格/,
  },
  {
    id: "C",
    name: "伴侶／已經溝通很多次",
    close: {
      coreConclusion: "問題不一定是說得不夠多，而是彼此理解可能從沒對齊。",
      blindSpot: "你已經講過很多次，所以容易以為對方知道；但對方聽到的版本，可能跟你以為的不是同一件事。",
      improvementDirection: "下一步更值得先確認彼此目前理解到哪裡，而不是再完整解釋一次。",
    },
  },
  {
    id: "D",
    name: "工作／規格一直變",
    close: {
      coreConclusion: "停下來的不是執行力不夠，而是標準一直被改，所以不知道做到哪裡才算過關。",
      blindSpot: "你一直在怪自己沒往前走，但還沒分開：是自己拖著，還是完成線本身一直在移動。",
      improvementDirection: "比起再逼自己做完，更值得先確認這次真正不變的完成標準是什麼。",
    },
    forbid: /沒有執行力|逃避|內在小孩/,
  },
  {
    id: "E",
    name: "單純疲累",
    close: {
      coreConclusion: "今天能確認的核心就是身體累了，不必再往更深解釋。",
      blindSpot: "目前沒有明顯的心理盲點，今天更像是真的累了，不需要把疲憊解釋成更深的問題。",
      improvementDirection: "這件事目前沒有需要再被解釋得更深；先讓身體休息。",
    },
    forbid: /別人的需求放在自己前面|不安全感|內在小孩/,
  },
  {
    id: "F",
    name: "幸福的一天",
    close: {
      coreConclusion: "今天真正留下的，是相處時那種放鬆和有回應的感覺。",
      blindSpot: "今天不一定有需要修正的問題；比較容易忽略的反而是，讓你感到幸福的可能不是做了什麼特別的事，而是那種被接住的感覺。",
      improvementDirection: "值得留下的是這種相處方式，而不是急著找出還要改進的地方。",
    },
    forbid: /其實不快樂|陰影|問題是/,
  },
  {
    id: "G",
    name: "使用者已經知道答案",
    close: {
      coreConclusion: "你已經很清楚真正生氣的不是改 spec，而是答應過卻又改口。",
      blindSpot: "目前沒有明顯需要再往深處解讀的地方。",
      improvementDirection: "既然核心已經清楚，下一步是對準這個承諾被改口的點，而不是再分析自己為什麼生氣。",
    },
  },
  {
    id: "H",
    name: "客觀問題，不心理化",
    close: {
      coreConclusion: "房間熱到睡不好，心情差是跟著身體狀態來的。",
      blindSpot: "目前更需要確認事實，而不是再替這件事增加新的解釋。",
      improvementDirection: "先處理熱和睡眠，而不是把煩躁解釋成更深的性格問題。",
    },
    forbid: /不安全感|習慣忍耐|內在小孩/,
  },
  {
    id: "I",
    name: "evidence 不足",
    close: {
      coreConclusion: "目前能確認的只有：這件事讓你不舒服，但真正卡住的那一層還沒被說清楚。",
      blindSpot: "目前更需要確認事實，而不是再替這件事增加新的解釋。",
      improvementDirection: "下一步先把實際發生什麼補清楚，再決定要不要往更深看。",
    },
    forbid: /童年|依附|你通常/,
  },
  {
    id: "J",
    name: "03 hypothesis 被否定",
    close: {
      coreConclusion: "被當眾糾正之後，你自己說當下沒有特別的情緒反應，現在也還好。",
      blindSpot: "目前沒有明顯需要再往深處解讀的地方。",
      improvementDirection: "這件事目前沒有需要再被解釋得更深。",
    },
    forbid: /沒面子|問題解決模式|受傷/,
    rejected: [{ note: "使用者否定：不是，我完全沒有這種感覺。" }],
  },
];

CASES.forEach((spec) => {
  const judged = thinkV2.evaluateThinkV2Close(spec.close, { forbid: spec.forbid, rejected: spec.rejected });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
  assert(!thinkV2.looksChecklist(spec.close.improvementDirection), `${spec.id} 改善方向不是 checklist`);
  assert(!thinkV2.looksSemanticDuplicate(spec.close.coreConclusion, spec.close.blindSpot), `${spec.id} 盲點不是核心重述`);
  assert(!thinkV2.looksOverPsych(`${spec.close.coreConclusion}${spec.close.blindSpot}${spec.close.improvementDirection}`), `${spec.id} 不心理化`);
});

const badRepeat = thinkV2.evaluateThinkV2Close({
  coreConclusion: "你希望媽媽理解你。",
  blindSpot: "你可能沒有發現自己很希望媽媽理解你。",
  improvementDirection: "可以讓媽媽更理解你。",
});
assert(!badRepeat.ok && badRepeat.issues.includes("blind-restates-core"), "重複三段必須 FAIL");

const badTired = thinkV2.evaluateThinkV2Close(
  {
    coreConclusion: "今天工作很多，你真的很累。",
    blindSpot: "你可能習慣把別人的需求放在自己前面。",
    improvementDirection: "晚上 8 點傳訊息給主管，寫下三件明天要做的事。",
  },
  { forbid: /別人的需求放在自己前面/ }
);
assert(badTired.issues.includes("overpsych"), "疲累不該被心理化");
assert(badTired.issues.includes("improve-is-checklist"), "改善方向不該偷做 06");

const rejectedClose = thinkV2.normalizeThinkV2Close(
  {
    coreConclusion: "被糾正後你其實很在意沒面子。",
    blindSpot: "目前沒有明顯需要再往深處解讀的地方。",
    improvementDirection: "這件事目前沒有需要再被解釋得更深。",
  },
  {
    context: {
      rounds: [{ question: "那個被糾正的時刻，你當時的反應是什麼？", answer: "不是，我完全沒有這種感覺。" }],
    },
  }
);
assert(!/問題解決模式/.test(`${rejectedClose.coreConclusion}${rejectedClose.blindSpot}`), "被否定的模式標籤不能復活");

console.log("think v2 close structure tests passed");
