const fs = require("fs");
const path = require("path");
const bodyMind = require("../lib/body-mind");
const {
  mergeJournalObjects,
  mergeBodyMind: mergeBodyMindBag,
  emptyExecutionChoiceBag,
  normalizeExecutionChoiceBag,
  hasMeaningfulExecutionChoices,
} = require("../lib/review-merge");
const { featureForReviewRequest, canUseFeature, enforcePlusEntitlement } = require("../lib/entitlement");
const thinkV2 = require("../lib/think-v2");
const { buildHistoryReading } = require("../lib/history-reading");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(html.includes("<span>03</span> 身心覺察"), "03 正式名稱");
assert(html.includes("id=\"bodyMindText\""), "2. 只有一個主 textarea");
assert((html.match(/id="bodyMindText"/g) || []).length === 1, "2. textarea 只有一個");
const visible03 = html.slice(html.indexOf("id=\"bodyMindCard\""), html.indexOf("js-legacy-body-ui"));
assert(visible03.includes("今天有沒有哪一個瞬間"), "1. 唯一問題");
assert(html.includes('id="btnBodyMindInsight"'), "CTA 存在");
assert(html.includes("看看這個感受在提醒我什麼"), "CTA 文案");
assert(html.includes("正在整理這個感受"), "loading 文案");
assert(!html.includes("正在整理今天的覺察…"), "03 不用舊 loading");
assert(!/class="journal-guide"(?![^>]*hidden)/.test(visible03), "3. 新 day 無可見 helper");
assert(!visible03.includes("今日的心情"), "1. 新 day 不顯示重複 mood");
assert(!visible03.includes("data-body-flag"), "1. 新 UI 無身體選項");
assert(!visible03.includes("sleep-chip"), "1. 新 UI 無 sleep selector");
assert(html.includes("js-legacy-body-ui"), "7. legacy DOM 仍在但隱藏");
assert(html.includes("id=\"bodyCoachCard\""), "14. bodyCoach DOM 仍在 legacy");
assert(css.includes("#section-body .js-legacy-body-ui"), "7. legacy 用 display none 鎖定");
assert(css.includes("display: none !important"), "7. 不被 .journal-split display:grid 蓋掉");
assert(app.includes("function lockNewDayBodyUi"), "7. render path 會再鎖舊 UI");
assert(app.includes("function generateThinkV2Ask"), "16. 04 未改");
assert(app.includes("function generateExecDeepFinal"), "18. 06 未改");
assert(app.includes("internal-reset-today"), "19. Internal reset 未拆");

assert(app.includes("bodyMindText"), "3. raw autosave field");
assert(app.includes("function generateBodyMindInsight"), "4. insight persist 路徑");
assert(app.includes("hasBodyMindResult(journal.bodyMind) && journal.bodyMind.sig === sig"), "5. reload 不重打");
assert(app.includes("if (options.auto) return"), "autosave 不可走 AI");
assert(!/function maybeAutoGenerateBodyMind[\s\S]{0,900}generateBodyMindInsight\(/.test(app), "auto 函式不再生成");
assert(!/function persistJournalNow[\s\S]{0,350}generateBodyMindInsight\(/.test(app), "persist 不生成");
assert(!/function scheduleJournalAutosave[\s\S]{0,220}generateBodyMindInsight\(/.test(app), "900ms autosave 不生成");
assert(app.includes("function syncBodyMindCta"), "CTA 狀態同步");
assert(app.includes("內容有修改，重新看看"), "stale CTA");
assert(app.includes('id === "bodyMindText") syncBodyMindCta'), "輸入只更新 CTA");
assert(app.includes('getElementById("btnBodyMindInsight")') && app.includes("generateBodyMindInsight()"), "只有按 CTA 才生成");
assert(app.includes("if (isCurrentJournalArchived() || state.bodyMindBusy) return"), "double click / completed 不重打");
assert(app.includes("bodyMindText.readOnly = isCurrentJournalArchived()"), "completed textarea read-only");
assert(app.includes("rejectArchivedJournalWrite"), "6. completed read-only");
assert(app.includes("bodyMind"), "4. journal.bodyMind child");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "無 schema");

assert(bodyMind.bodyMindTextReady("媽媽叫我搬出去，胸口很悶"), "meaningful input");
assert(!bodyMind.bodyMindTextReady("還好"), "10. 太短不算");
assert(bodyMind.looksEmptyBodyMindInput("今天沒有什麼特別的感覺。"), "10. 沒東西可辨");
assert(bodyMind.looksSoupBodyMind("每一個感受都值得被好好看見。"), "soup 可辨");
assert(bodyMind.looksOverPsych("你害怕被拋棄。"), "過度心理化可辨");
assert(bodyMind.normalizeBodyMindInsight({ insight: "你缺乏安全感。", support: "先看看。" }).insight === "", "過度診斷被拒絕");

const merged = mergeJournalObjects(
  { bodyMind: { text: "胸口很悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。" } },
  { bodyMind: { text: "", insight: "", support: "" } }
);
assert(merged.bodyMind.insight.includes("關係位置"), "4/36. 空 bag 不丟 insight");

const mergedDebug = bodyMind.mergeBodyMind(
  { text: "胸口很悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。", internalDebug: { provider: "anthropic", model: "claude-sonnet-5" } },
  { text: "胸口很悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。" }
);
assert(mergedDebug.internalDebug && mergedDebug.internalDebug.model === "claude-sonnet-5", "Internal debug 合併後仍在");
const mergedDebugBag = mergeBodyMindBag(
  { text: "胸口很悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。", internalDebug: { provider: "anthropic", model: "claude-sonnet-5" } },
  { text: "胸口很悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。" }
);
assert(mergedDebugBag.internalDebug && mergedDebugBag.internalDebug.model === "claude-sonnet-5", "review-merge 也保留 Internal debug");

const prompt = thinkV2.thinkV2UserPrompt({
  variant: "think-v2",
  context: {
    event: "想跟媽媽說話",
    mood: "忐忑",
    thanksText: "還有家",
    bodyMindText: "媽媽叫我搬出去，胸口很悶。",
    bodyMindInsight: "真正難受的也許是關係位置。",
    rounds: [],
  },
});
assert(prompt.includes("hypothesis"), "11. 03 insight 傳給 04 標成 hypothesis");
assert(prompt.includes("媽媽叫我搬出去"), "11. 04 讀得到 03 原文");

assert(thinkV2.looksKnownAnswerRestate("你希望媽媽理解你什麼？", { event: "我希望她理解我的感受" }, []), "12. 已說希望被理解不再問");
assert(thinkV2.THINK_V2_ASK_SYSTEM.includes("答案會改變理解"), "13. information gain");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("怎麼做可以更好"), "14. close 有 core + direction");
assert(thinkV2.THINK_V2_CLOSE_SYSTEM.includes("不是 checklist"), "15. 04 不搶 06");
assert(app.includes("function generateExecDeepFinal"), "31. 06 Exec V2 仍在");
assert(app.includes("executionSummary"), "31. executionSummary 仍在");
assert(app.includes("finalOptions"), "31. finalOptions 仍在");

const reading = buildHistoryReading({
  journal: {
    event: "搬家",
    bodyMind: { text: "胸口很悶" },
    bodyCheck: { mood: { flags: ["焦慮"], reason: "舊資料" } },
  },
});
assert(reading.happened.bodySignals.some((item) => /胸口/.test(item.text)), "32. History 讀新 03");
assert(reading.happened.bodySignals.some((item) => /焦慮|舊資料/.test(item.text)), "7. History 仍讀 legacy bodyCheck");

assert(featureForReviewRequest({ mode: "bodymind" }) === "body_ai", "19. 03 走 body_ai");
assert(featureForReviewRequest({ mode: "insight", variant: "think-v2" }) === "think_ai", "20. 04 think_ai");
assert(featureForReviewRequest({ mode: "choices", kind: "awareness" }) === "awareness_ai", "21. 05");
assert(featureForReviewRequest({ mode: "choices", kind: "execution" }) === "execution_ai", "22. 06 initial");
assert(featureForReviewRequest({ mode: "choices", kind: "execution-deep" }) === "execution_ai", "23/24. 06 deep/final");
assert(canUseFeature("free", "body_ai", { isInternal: true }), "19. Internal 03 unlimited");
assert(canUseFeature("free", "think_ai", { isInternal: true }), "20. Internal 04 unlimited");
assert(canUseFeature("free", "awareness_ai", { isInternal: true }), "21. Internal 05 unlimited");
assert(canUseFeature("free", "execution_ai", { isInternal: true }), "22. Internal 06 unlimited");
assert(canUseFeature("free", "weekly_report_full", { isInternal: true }), "25. Internal report unlimited");
assert(canUseFeature("free", "think_ai") === false, "26. FREE 不變");
assert(canUseFeature("plus", "think_ai") === true, "27. PLUS 不變");
assert(reviewJs.includes("isInternal: isInternal(row)"), "C. server authoritative internal");
assert(!app.includes("if (email ==="), "7. 無 frontend email hard-code");
assert(reviewJs.includes("requireUser"), "29. Internal 仍要登入");

assert(css.includes(".body-mind-insight") && css.includes("border-left: 2px solid #bca58f"), "F. editorial insight");
assert(app.includes('kicker: "核心結論"') === true || app.includes("核心結論"), "04 close 未因 03 被拆");
assert(app.includes('class="body-mind-insight__label">覺察</p>'), "UI 覺察標籤");
assert(app.includes('class="body-mind-insight__label">引導</p>'), "UI 引導標籤");
assert(!app.includes("覺察一句話"), "不再顯示舊 insight 標籤");
assert(!app.includes("給今天的你"), "不再顯示舊 support 標籤");
assert(bodyMind.BODY_MIND_SYSTEM.includes("ONE CORE INSIGHT ONLY"), "只留一個核心");
assert(bodyMind.BODY_MIND_SYSTEM.includes("25～55"), "覺察字數上限");
assert(bodyMind.BODY_MIND_SYSTEM.includes("30～70"), "引導字數上限");
assert(bodyMind.BODY_MIND_SYSTEM.includes("不要搶 06"), "引導不搶 06");
assert(bodyMind.BODY_MIND_SYSTEM.includes("不要找問題"), "正向不硬找問題");
assert(bodyMind.bodyMindSourceStale({ text: "舊文字", insight: "核心一句。", support: "往下看一眼。", sig: "舊文字\n事件\n心情" }, "改過的新文字"), "改字後 stale");
assert(!bodyMind.bodyMindSourceStale({ text: "舊文字", insight: "核心一句。", support: "往下看一眼。", sig: "舊文字\n事件\n心情" }, "舊文字"), "同文不是 stale");
assert(!reviewJs.includes("ANTHROPIC_INTERNAL_MODEL"), "不改 routing 常數來源");
assert(reviewJs.includes("internal: internalUser"), "Internal routing 仍在");

const QUALITY = [
  {
    id: "A",
    name: "家庭衝突",
    text: "媽媽叫我搬出去，我當下胸口很悶。",
    result: {
      insight: "真正讓你不舒服的，可能不只是搬家，而是生活的選擇不完全在自己手上。",
      support: "先分開看看：哪些真的無法改變，哪些只是現在還沒有重新選擇。",
    },
    forbid: /害怕被拋棄|缺乏安全感|童年創傷/,
  },
  {
    id: "B",
    name: "幸福",
    text: "今天跟男友吃飯一直笑，覺得很幸福。",
    result: {
      insight: "讓你感到幸福的，可能不是做了什麼特別的事，而是你們相處時很放鬆、很有回應。",
      support: "這種讓你自然做自己的時刻，本身就很值得記住。",
    },
    forbid: /問題是|其實不快樂|陰影/,
  },
  {
    id: "C",
    name: "工作壓力",
    text: "會議一路被加需求，回家後肩膀一直緊。",
    result: {
      insight: "肩膀一直緊，可能不只是累，而是今天的節奏一直被往後推。",
      support: "先看哪一件需求，已經超過你可以承受的範圍。",
    },
  },
  {
    id: "D",
    name: "運動痠痛",
    text: "今天健身後大腿很痠。",
    result: {
      insight: "今天最明顯的是身體真的累了，暫時不需要替它加上更深的解釋。",
      support: "先把這個身體訊號記下來就好。",
    },
    forbid: /不安全感|被拋棄|童年|內心壓力|有效刺激/,
  },
  {
    id: "E",
    name: "沒什麼感覺",
    text: "今天沒什麼特別感覺。",
    result: {
      insight: "今天沒有特別強烈的感受，本身也是一種狀態。",
      support: "可以就這樣讓今天過去，不必硬挖更深的意義。",
    },
    forbid: /成長的一部分|相信自己|金句/,
  },
  {
    id: "F",
    name: "生氣",
    text: "我今天真的很生氣，當下整個人都熱起來。",
    result: {
      insight: "這股火值得注意，也許是對你重要的界線，在這一刻被碰到了。",
      support: "先承認怒意是有方向的，不必立刻解決。",
    },
    forbid: /童年創傷|內在小孩|依附風格/,
  },
];

QUALITY.forEach((spec) => {
  const judged = bodyMind.evaluateBodyMindQuality(spec.result, { text: spec.text, forbid: spec.forbid });
  assert(judged.ok, `${spec.id} ${spec.name} 應通過：${judged.issues.join("；")}`);
  assert(bodyMind.countBodyMindSentences(spec.result.insight) <= 2, `${spec.id} insight 1～2 句`);
  assert(bodyMind.countBodyMindSentences(spec.result.support) <= 2, `${spec.id} support 1～2 句`);
  assert(bodyMind.compactBodyMindChars(spec.result.insight) <= 80, `${spec.id} insight 夠短`);
  assert(bodyMind.compactBodyMindChars(spec.result.support) <= 95, `${spec.id} support 夠短`);
});

const tooLong = bodyMind.evaluateBodyMindQuality(
  {
    insight: "你今天因為媽媽說了這句話，所以感到難過，也希望被理解，同時你可能感受到失去選擇權，因此內心產生焦慮。",
    support: "先花十分鐘寫下三件感受，再跟對方說一句話，晚上 8 點傳訊息確認。",
  },
  { text: "媽媽叫我搬出去，胸口很悶。" }
);
assert(tooLong.issues.includes("insight-too-long") || tooLong.issues.includes("stacked-insight"), "長篇分析必須 FAIL");
assert(tooLong.issues.includes("support-is-checklist") || tooLong.issues.includes("support-too-long"), "長引導必須 FAIL");

const badRestate = bodyMind.evaluateBodyMindQuality(
  { insight: "媽媽叫我搬出去，你當下胸口很悶。", support: "先看看自己的感受。" },
  { text: "媽媽叫我搬出去，我當下胸口很悶。" }
);
assert(badRestate.issues.includes("restate"), "重述必須 FAIL");

const badPositive = bodyMind.evaluateBodyMindQuality(
  { insight: "你其實不快樂，問題是你害怕失去。", support: "好好愛自己。" },
  { text: "今天跟男友吃飯一直笑，覺得很舒服。" }
);
assert(badPositive.issues.includes("positive-problem-hunt") || badPositive.issues.includes("soup"), "幸福不該被硬找問題");

const badChecklist = bodyMind.evaluateBodyMindQuality(
  { insight: "也許界線被碰到了。", support: "晚上 8 點傳訊息給媽媽，寫下三件感受。" },
  { text: "媽媽叫我搬出去，胸口很悶。" }
);
assert(badChecklist.issues.includes("support-is-checklist"), "引導不該偷做 06");
assert(app.includes("persistArchivedUserMarks"), "33. userMarks 未拆");
assert(app.includes("function generateThinkV2Ask"), "04 V2 未拆 workflow");
assert(app.includes("if (!pointerOk && !keyboardOk) return true;") === false, "35. accordion fix");

const bag = normalizeExecutionChoiceBag({
  options: [{ id: "e1", text: "先確認理解到哪", detail: "請對方先說。" }],
  selectedIds: ["e1"],
  deep: {
    status: "closed",
    executionSummary: "這次不是再說更多，而是先確認沒對上的地方。",
    finalOptions: [
      { id: "f1", text: "先請對方說出目前理解", detail: "只聽不補。" },
      { id: "f2", text: "找出真正沒對上的一點", detail: "對上再往下。" },
      { id: "f3", text: "確認一致後再談界線", detail: "理解後才談立場。" },
    ],
    finalSelectedIds: ["f1"],
  },
});
assert(hasMeaningfulExecutionChoices(bag), "31. 06 bag 仍有效");
assert(bag.deep.executionSummary, "31. summary 仍在");
assert(bag.deep.finalOptions.length === 3, "31. final 3");

console.log("body-mind / 03-04-internal tests passed");
