const fs = require("fs");
const path = require("path");
const internalTest = require("../lib/internal-test");
const { pickReview, mergeJournalObjects, reviewIsFinalized } = require("../lib/review-merge");
const { canUseFeature, enforcePlusEntitlement, featureForReviewRequest } = require("../lib/entitlement");
const { internalDebugMeta } = require("../lib/openai");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const chatJs = fs.readFileSync(path.join(root, "api/chat.js"), "utf8");

assert(html.includes("id=\"btnInternalResetToday\""), "1. Internal sees reset button markup");
assert(html.includes("重新測試今天"), "1. reset label");
assert(html.includes("id=\"internalResetModal\""), "1. confirm modal");
assert(app.includes("resetBtn.hidden = !(archived && isInternalMembership())"), "2. normal user does not see reset");
assert(!app.includes("if (email ==="), "no frontend email hard-code");

const completed = {
  date: "2026-08-30",
  userId: "u1",
  createdAt: "2026-08-30T01:00:00.000Z",
  completedAt: "2026-08-30T02:00:00.000Z",
  updatedAt: "2026-08-30T02:00:00.000Z",
  organize: { themeTitle: "完成" },
  journal: {
    thanksText: "還有家",
    event: "第一輪",
    mood: "平靜",
    bodyMind: { text: "胸口很悶", insight: "也許碰到關係。", support: "先看看。" },
    insight: { guide: { variant: "think-v2", status: "closed", rounds: [{ question: "Q", answer: "A" }] } },
    awarenessChoices: { options: [{ id: "a1", text: "看見" }], selectedIds: ["a1"] },
    executionChoices: { options: [{ id: "e1", text: "下一步" }], selectedIds: ["e1"] },
    userMarks: { items: [{ id: "m1", field: "event", text: "第一" }], updatedAt: "2026-08-30T02:00:00.000Z" },
  },
};

const reset1 = internalTest.applyInternalTodayReset(completed, { resetAt: "2026-08-30T03:00:00.000Z", date: "2026-08-30", userId: "u1" });
assert(!reset1.completedAt, "8/9. completedAt cleared");
assert(reset1.organize == null, "8. organize cleared");
assert(reset1.journal.internalTestRuns.length === 1, "5. snapshot saved");
assert(reset1.journal.internalTestRuns[0].snapshot.journal.event === "第一輪", "5. snapshot has journal");
assert(!reset1.journal.internalTestRuns[0].snapshot.journal.internalTestRuns, "snapshot does not nest runs");
assert(reset1.journal.internalResetAt === "2026-08-30T03:00:00.000Z", "reset stamp");
assert(!reset1.journal.event, "8. active flow cleared");
assert(!reset1.journal.bodyMind, "8. 03 cleared");
assert(!reset1.journal.insight, "8. 04 cleared");

const mergedReset = pickReview(completed, reset1);
assert(!mergedReset.completedAt, "3. Internal reset survives completed protection");
assert(mergedReset.journal.internalTestRuns.length === 1, "6. internalTestRuns preserved after merge");
assert(!reviewIsFinalized(mergedReset), "9. not finalized after reset");

const draftNoReset = { date: "2026-08-30", journal: { event: "偷改" }, updatedAt: "2026-08-30T04:00:00.000Z" };
const blocked = pickReview(completed, draftNoReset);
assert(blocked.completedAt === completed.completedAt, "18-20. normal draft cannot clear completed");
assert(blocked.journal.event === "第一輪", "18-20. FREE/PLUS/Trial one-a-day intact");

let cursor = reset1;
for (let i = 2; i <= 3; i += 1) {
  cursor = {
    ...cursor,
    completedAt: `2026-08-30T0${i + 3}:00:00.000Z`,
    organize: { themeTitle: `第${i}輪` },
    journal: {
      ...cursor.journal,
      event: `第${i}輪`,
      bodyMind: { text: `再寫${i}`, insight: "新的覺察", support: "給今天的你" },
      insight: { guide: { variant: "think-v2", status: "closed", rounds: [{ question: "Q", answer: "A" }] } },
      awarenessChoices: { options: [{ id: "a1", text: "看見" }] },
      executionChoices: { options: [{ id: "e1", text: "做" }], deep: { status: "closed", executionSummary: "總結", finalOptions: [{ id: "f1", text: "做" }] } },
    },
  };
  cursor = internalTest.applyInternalTodayReset(cursor, { resetAt: `2026-08-30T0${i + 4}:00:00.000Z`, date: "2026-08-30" });
}
assert(cursor.journal.internalTestRuns.length === 3, "10/11. third run same day keeps 3 snapshots");
assert(!cursor.completedAt, "11. third reset clears completedAt");
assert(!cursor.journal.bodyMind, "12. 03 can regenerate");
assert(!cursor.journal.insight, "13. 04 can regenerate");
assert(!cursor.journal.awarenessChoices, "14. 05 can regenerate");
assert(!cursor.journal.executionChoices, "15. 06 can regenerate");

let many = completed;
for (let i = 0; i < 22; i += 1) {
  many = internalTest.applyInternalTodayReset(
    {
      ...many,
      completedAt: `2026-08-30T10:00:00.000Z`,
      journal: { ...(many.journal || {}), event: `run-${i}`, internalTestRuns: many.journal.internalTestRuns },
    },
    { resetAt: `2026-08-30T10:${String(i).padStart(2, "0")}:00.000Z` }
  );
}
assert(many.journal.internalTestRuns.length === 20, "7. max 20");

const emptyNewer = mergeJournalObjects(
  { internalTestRuns: cursor.journal.internalTestRuns, event: "舊" },
  { internalTestRuns: [], internalResetAt: "2026-08-30T12:00:00.000Z" }
);
assert(emptyNewer.internalTestRuns.length >= 1, "6. merge keeps runs when reset newer");
assert(!emptyNewer.event, "reset journal wins emptied flow");

assert(reviewJs.includes("internal-reset-today"), "3. server reset route");
assert(reviewJs.includes("error: \"internal_required\""), "4. normal reset rejected");
assert(reviewJs.includes("isInternal(membershipRow)") || reviewJs.includes("internalUser = isInternal"), "reset uses isInternal(row)");
assert(reviewJs.includes("delete body.user_id"), "21. body.user_id not trusted");
assert(reviewJs.includes("requireUser"), "21. auth required");
assert(reviewJs.includes("_internalDebug"), "16. Internal debug attached");
assert(chatJs.includes("_internalDebug"), "16. chat debug attached");
assert(reviewJs.includes("if (payload && payload.ok === true && internalUser)"), "17. debug only when internal");
assert(app.includes("Internal Test ·"), "16. Internal UI model line");
assert(app.includes("if (!isInternalMembership() || !debug || !debug.model) return"), "17. normal UI hides model");

const debug = internalDebugMeta();
assert(debug.provider && debug.model, "16. actual runtime model metadata");
assert(internalDebugMeta({ internal: true }).model, "Internal debug 帶實際 model");
assert(reviewJs.includes("internal: internalUser"), "review routes model from isInternal(row)");
assert(reviewJs.includes("delete body.model"), "client cannot choose model");
assert(canUseFeature("free", "think_ai") === false, "18. FREE unchanged");
assert(canUseFeature("plus", "think_ai") === true, "19. PLUS unchanged");
assert(canUseFeature("plus", "think_ai", { isInternal: false }) === true, "20. Trial/PLUS object still plus");
assert(canUseFeature("free", "think_ai", { isInternal: true }) === true, "Internal unlimited still works");
assert(featureForReviewRequest({ mode: "bodymind" }) === "body_ai", "03 feature unchanged");
assert(app.includes("function generateExecDeepFinal"), "22/15. 06 final still there");
assert(app.includes("scheduleJournalAutosave.timer = setTimeout") || app.includes(", 900)"), "23. autosave still 900");
assert(app.includes("persistArchivedUserMarks"), "25. userMarks still there");
assert(app.includes("renderCombinedHighlightedText"), "25. dual highlights still there");
assert(html.includes("js-legacy-body-ui"), "24. History/legacy 03 still in DOM");
assert(!reviewJs.includes("ALTER TABLE") && !app.includes("CREATE TABLE"), "no schema change");

async function runEntitlement() {
  const freeRes = { status() { return this; }, json(payload) { this.payload = payload; return this; } };
  const denied = await enforcePlusEntitlement({
    feature: "think_ai",
    res: freeRes,
    supabaseReady: true,
    loadPlan: async () => ({ plan: "free", isInternal: false }),
  });
  assert(denied === false && freeRes.payload && freeRes.payload.error === "plus_required", "18. FREE still 403");
  const plusRes = { status() { return this; }, json() { return this; } };
  const plusOk = await enforcePlusEntitlement({
    feature: "think_ai",
    res: plusRes,
    supabaseReady: true,
    loadPlan: async () => ({ plan: "plus", isInternal: false }),
  });
  assert(plusOk === true, "19. PLUS still allowed");
}

runEntitlement().then(() => {
  console.log("internal test mode tests passed");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
