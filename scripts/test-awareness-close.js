const {
  renderCombinedHighlightedText,
  plainTextFromHighlightedHtml,
} = require("../lib/insight-highlight");
const { toInnerVoice, looksLikeAnalystVoice, compactLen } = require("../lib/text-integrity");
const { buildHistoryDisplayTitle } = require("../lib/history-summary");
const {
  CHECKLIST_AWARENESS_CHOICES_SYSTEM,
  normalizeAwarenessLine,
  normalizeAwarenessResult,
  normalizeCompactAwarenessResult,
  isCompactAwarenessResult,
} = require("../api/review");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const LONG_LINE = "我不是沒有行動，只是太習慣先看見自己做得不夠的那些地方";
const LONG_SEEN = "當事情沒有明顯進度時，我很容易開始懷疑自己是不是做得不夠，也會連帶覺得今天好像白白費了力氣。";

function mark(source, needle, color, id) {
  const start = source.indexOf(needle);
  return { text: needle, color, start, end: start + needle.length, id: id || `um_${needle}` };
}

const prompt = CHECKLIST_AWARENESS_CHOICES_SYSTEM;
assert(prompt.includes("核心覺察"), "CASE A：新 prompt 必須要求核心覺察");
assert(prompt.includes("我看見了"), "CASE A：新 prompt 必須要求我看見了");
assert(/gap["']?\s*:\s*["']{2}/.test(prompt.replace(/\s+/g, "")) || prompt.includes('"gap": ""'), "CASE N：prompt 要求 gap 空字串");
assert(prompt.includes("不要再增加第三層") || prompt.includes("不要再提問"), "CASE N：不可再出問答題");
assert(prompt.includes("你好像"), "prompt 必須明確禁止分析語氣");
assert(!prompt.includes("今晚留給自己的一個問題") || prompt.includes("question"), "舊四層問答不應再當主輸出");

const selectedClose = normalizeCompactAwarenessResult({
  line: "我需要的不是完美，而是進展感。",
  seen: "當事情沒有明顯進度時，我很容易開始懷疑自己是不是做得不夠。",
  gap: "這層不該留下。",
  question: "你今晚還想追問自己什麼？",
  echo: "近 7 天模式。",
  highlights: {
    line: [{ text: "進展感", color: "yellow" }],
    seen: [{ text: "懷疑自己", color: "pink" }],
  },
});
assert(isCompactAwarenessResult(selectedClose), "CASE A：新結果是 compact");
assert(selectedClose.line === "我需要的不是完美，而是進展感", "CASE A：核心覺察完整保留");
assert(selectedClose.seen.includes("懷疑自己是不是做得不夠"), "CASE A：我看見了完整保留");
assert(!selectedClose.gap && !selectedClose.question && !selectedClose.echo, "CASE N：沒有第三層／問答");
assert(selectedClose.highlights.line[0].text === "進展感", "CASE I：AI highlight 原樣保存");

assert(/^我/.test(selectedClose.line), "CASE B：核心覺察是第一人稱");
assert(!looksLikeAnalystVoice(selectedClose.line), "CASE B：不像分析開頭");
assert(!/你好像|你可能|也許你|你似乎|這代表|從你的回答可以看出/.test(`${selectedClose.line}${selectedClose.seen}`), "CASE B：沒有分析腔");

const rewritten = normalizeCompactAwarenessResult({
  line: "你好像正在尋找一種前進的證據。",
  seen: "從今天的事件可以看出，你對進度特別敏感。",
});
assert(rewritten.line.startsWith("我"), "CASE B：分析腔會收成內在語言");
assert(!rewritten.line.startsWith("你好像"), "CASE B：不再保留你好像");

const selectedRelated = normalizeCompactAwarenessResult({
  line: "我真正需要的，是被放在心上。",
  seen: "真正讓我有感的不是事情大小，而是對方有沒有主動想到我。",
});
assert(selectedRelated.line.includes("被放在心上"), "CASE C：結果必須對上使用者勾選的主題");
assert(selectedRelated.seen.includes("主動想到我"), "CASE C：補充句也要連回被碰到的地方");

const conservative = normalizeCompactAwarenessResult({
  line: "我先把今天真正有感的地方留下來。",
  seen: "今天先把真正有感的地方留下來就好，不必急著下更大的結論。",
});
assert(conservative.line && conservative.seen, "CASE D：沒有勾選也可以保守收束");
assert(!/人生意義|長期價值|關係哲學/.test(`${conservative.line}${conservative.seen}`), "CASE D：不亂推論到 06 層次");

assert(compactLen(LONG_LINE) > 24, "CASE E 測資：超過 24 字");
assert(normalizeAwarenessLine(LONG_LINE) === LONG_LINE, "CASE E：完整核心覺察不可 hard cut");
const longCompact = normalizeCompactAwarenessResult({ line: LONG_LINE, seen: LONG_SEEN });
assert(longCompact.line === LONG_LINE, "CASE E：normalize compact 也不切 line");
assert(compactLen(LONG_SEEN) > 45, "CASE F 測資：超過 45 字");
assert(longCompact.seen === LONG_SEEN, "CASE F：完整我看見了不可 hard cut");
assert(!String(normalizeAwarenessLine).includes(".slice(0,") && !/substring/.test(String(normalizeAwarenessLine)), "line helper 本身沒有硬切");

const historyTitle = buildHistoryDisplayTitle({
  journal: {
    awarenessResult: {
      line: "我需要的不是完美，而是進展感",
      seen: "當事情沒有明顯進度時，我很容易開始懷疑自己是不是做得不夠。",
      gap: "",
      question: "",
    },
  },
});
assert(historyTitle === "我需要的不是完美，而是進展感", "CASE G：歷史列表 display-only 優先核心覺察");

const old = normalizeAwarenessResult({
  seen: "今天你好像特別在意被放在心上。這比牛奶或關心本身更靠近你。你願意承認這一層，已經比只複述事件更深。",
  gap: "你選了「是」之後，睡眠不足卻仍想把事情做完，可能才是今天真正沒被說出口的模式。這不是指責，只是把線索放在一起看。",
  question: "如果沒有人看見你的努力，你還會願意為自己做這些事情嗎？",
  line: "被放在心上，比事情本身更靠近你",
});
assert(!isCompactAwarenessResult(old), "CASE H：舊四層不是 compact");
assert(old.gap && old.question, "CASE H：舊 gap／question 仍在");
assert(old.seen.includes("被放在心上"), "CASE H：舊 seen 仍可顯示");

const source = selectedClose.line;
const htmlI = renderCombinedHighlightedText(source, selectedClose.highlights.line, []);
assert(plainTextFromHighlightedHtml(htmlI) === source, "CASE I：AI highlight 不改正文");
assert(htmlI.includes("insight-highlight"), "CASE I：有 AI 反白標記");

const user = mark(source, "進展感", "tea");
const htmlJ = renderCombinedHighlightedText(source, [], [user]);
assert(plainTextFromHighlightedHtml(htmlJ) === source, "CASE J：userMark 不改正文");

const overlapUser = mark(source, "而是進展", "tea");
const overlap = renderCombinedHighlightedText(source, selectedClose.highlights.line, [overlapUser]);
assert(plainTextFromHighlightedHtml(overlap) === source, "CASE K：overlap 後 textContent === source");
assert(overlap.includes("insight-highlight") && overlap.includes("user-highlight"), "CASE K：部分重疊時 AI 與手動標記都還在");

assert(plainTextFromHighlightedHtml(overlap) === source, "CASE L：strip highlight span 後等於 source");

assert(!selectedClose.question, "CASE N：完成後沒有新的問答題欄位");

console.log("awareness-close tests passed");
