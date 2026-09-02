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
assert(html.includes("從今天裡，多看見自己一點"), "CTA 文案");
assert(html.includes("正在從今天裡多看一看"), "loading 文案");
assert(!html.includes("看看這個感受在提醒我什麼"), "不再用舊 CTA");
assert(!html.includes("這個瞬間在提醒我什麼"), "不再用瞬間提醒框架");
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
assert(app.includes('options.confirmed !== true') || app.includes("options.confirmed !== true"), "必須 confirmed 才生成");
assert(app.includes("if (options.auto) return"), "autosave 不可走 AI");
assert(!/function persistJournalNow[\s\S]{0,280}maybeAutoGenerateBodyMind/.test(app), "persist 不再接 03 AI");
assert(!/function persistJournalNow[\s\S]{0,280}generateBodyMindInsight/.test(app), "persist 不生成");
assert(!/function scheduleJournalAutosave[\s\S]{0,220}generateBodyMindInsight/.test(app), "900ms autosave 不生成");
assert(!/function scheduleJournalChecklists[\s\S]{0,500}generateBodyMindInsight/.test(app), "checklist debounce 不生成");
assert(!/function maybeAutoGenerateBodyCoach[\s\S]{0,220}generateBodyMindInsight/.test(app), "bodyCoach auto 不生成 03");
assert(!/function loadReviewForDate[\s\S]{0,900}generateBodyMindInsight/.test(app), "reload 不生成 03");
assert(!/function fillJournal[\s\S]{0,2200}generateBodyMindInsight/.test(app), "fillJournal 不生成 03");
assert((app.match(/generateBodyMindInsight\(/g) || []).length === 2, "generate 只定義一次＋CTA 呼叫一次");
assert(app.includes("generateBodyMindInsight({ confirmed: true })"), "只有 CTA 帶 confirmed");
assert(app.includes("liveEl.value"), "request 讀 click 當下 textarea");
assert(app.includes("currentText === text"), "stale response 會對過當下文字");
assert(app.includes("function syncBodyMindCta"), "CTA 狀態同步");
assert(app.includes("內容有修改，重新看看"), "stale CTA");
assert(app.includes('id === "bodyMindText") syncBodyMindCta'), "輸入只更新 CTA");
assert(app.includes("if (isCurrentJournalArchived() || state.bodyMindBusy) return"), "double click / completed 不重打");
assert(app.includes("bodyMindText.readOnly = isCurrentJournalArchived()"), "completed textarea read-only");
assert(html.includes("enterkeyhint=\"enter\""), "鍵盤 Go 不當成送出");
assert(html.includes("再多寫一點這個瞬間") === false || app.includes("再多寫一點這個瞬間"), "太短用低調提示");
assert(app.includes("rejectArchivedJournalWrite"), "6. completed read-only");
assert(app.includes("bodyMind"), "4. journal.bodyMind child");
assert(!app.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "無 schema");

assert(bodyMind.bodyMindTextReady("媽媽叫我搬出去，胸口很悶"), "meaningful input");
assert(!bodyMind.bodyMindTextReady("還好"), "10. 太短不算");
assert(bodyMind.looksEmptyBodyMindInput("今天沒有什麼特別的感覺。"), "10. 沒東西可辨");
assert(typeof bodyMind.looksSoupBodyMind === "function", "soup helper retained");
assert(typeof bodyMind.looksOverPsych === "function", "overpsych helper retained");
assert(bodyMind.normalizeBodyMindInsight({ insight: "你缺乏安全感。", support: "先看看。" }).insight.includes("安全感"), "insight passthrough (content gate cleared)");
assert(bodyMind.BODY_MIND_SYSTEM.includes("Return JSON") || bodyMind.BODY_MIND_SYSTEM.includes("JSON"), "03 system is tech JSON");
assert(!/白話優先|不要太文青|【核心結論】/.test(bodyMind.BODY_MIND_SYSTEM), "03 content tone cleared");

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
assert(app.includes('class="body-mind-insight__label">我注意到</p>'), "UI 觀察標籤");
assert(app.includes('class="body-mind-insight__label">為什麼這樣看</p>'), "UI 說明標籤");
assert(!app.includes('class="body-mind-insight__label">覺察</p>'), "不再用舊覺察標籤");
assert(!app.includes('class="body-mind-insight__label">引導</p>'), "不再用舊引導標籤");
assert(!app.includes("覺察一句話"), "不再顯示舊 insight 標籤");
assert(!app.includes("給今天的你"), "不再顯示舊 support 標籤");
assert(bodyMind.BODY_MIND_SYSTEM.includes("insight") && bodyMind.BODY_MIND_SYSTEM.includes("support"), "JSON fields insight/support");
assert(!/ONE CORE INSIGHT ONLY|25～55|不要搶 06|不要找問題/.test(bodyMind.BODY_MIND_SYSTEM), "old length/tone gates cleared");
assert(bodyMind.bodyMindSourceStale({ text: "舊文字", insight: "核心一句。", support: "往下看一眼。", sig: "舊文字\n事件\n心情" }, "改過的新文字"), "改字後 stale");
assert(!bodyMind.bodyMindSourceStale({ text: "舊文字", insight: "核心一句。", support: "往下看一眼。", sig: "舊文字\n事件\n心情" }, "舊文字"), "同文不是 stale");
assert(reviewJs.includes("runSeePipeline"), "03 走 SEE pipeline");
assert(reviewJs.includes("runUnderstandPipeline"), "04 UNDERSTAND 在");
assert(fs.existsSync(path.join(root, "lib/insight-discovery.js")), "discovery 未刪");
assert(!reviewJs.includes("ANTHROPIC_INTERNAL_MODEL"), "不改 routing 常數來源");
assert(reviewJs.includes("internal: internalUser"), "Internal routing 仍在");

const okShape = bodyMind.evaluateBodyMindQuality(
  { insight: "技術洞察", support: "技術說明" },
  { text: "胸口悶" }
);
assert(okShape.ok, "shape quality: insight+support ok");
const missing = bodyMind.evaluateBodyMindQuality({ insight: "", support: "只有說明" }, { text: "胸口悶" });
assert(missing.issues.includes("missing-insight"), "shape quality: missing insight");
const silenceOk = bodyMind.evaluateBodyMindQuality({ status: "silence", insight: "", support: "" }, { text: "還好" });
assert(silenceOk.ok, "silence status ok without fields");
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
