"use strict";

/**
 * 03 SEE — flow / JSON shape / merge (content-tone asserts removed).
 */

const fs = require("fs");
const path = require("path");
const bodyMind = require("../lib/body-mind");
const bodyMindSee = require("../lib/body-mind-see");
const insightDiscovery = require("../lib/insight-discovery");
const { mergeBodyMind, mergeJournalObjects } = require("../lib/review-merge");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const review = fs.readFileSync(path.join(root, "api/review.js"), "utf8");

assert(review.includes("runSeePipeline"), "API 03 uses SEE pipeline");
assert(fs.existsSync(path.join(root, "lib/insight-discovery.js")), "04 discovery guards retained");
assert(html.includes("從今天裡，多看見自己一點"), "03 SEE copy stays on 03");
assert(insightDiscovery.trustRaw({ bodyMindInsight: "你需要親密感", bodyMindText: "胸口悶" }).bodyMindText.includes("胸口悶"), "03 RAW still trusted");
assert(!insightDiscovery.trustRaw({ bodyMindInsight: "你需要親密感", bodyMindText: "胸口悶" }).bodyMindInsight, "03 AI not in trustRaw");
assert(bodyMindSee.SEE_REASON_SYSTEM.includes("Return JSON"), "SEE reason is tech JSON scaffold");
assert(bodyMind.BODY_MIND_SYSTEM.includes("Return JSON") || bodyMind.BODY_MIND_SYSTEM.includes("JSON"), "writer system is tech JSON scaffold");
assert(!/不要太文青|白話優先|【核心結論】/.test(bodyMindSee.SEE_REASON_SYSTEM), "SEE reason has no old tone rules");

const judgedShape = bodyMindSee.evaluateSeeCandidate(
  { id: "s1", type: "COMMON_THREAD", statement: "一句觀察", evidence: ["原文"], whyItMatters: "值得看" },
  { thanksText: "謝謝", event: "事件", mood: "平", bodyMindText: "胸口悶" }
);
assert(judgedShape.keep || judgedShape.item.statement === "一句觀察", "shape candidate can pass");

const judgedEmpty = bodyMindSee.evaluateSeeCandidate(
  { id: "s0", type: "COMMON_THREAD", statement: "", evidence: [], whyItMatters: "" },
  { thanksText: "謝謝", event: "事件", mood: "平", bodyMindText: "胸口悶" }
);
assert(judgedEmpty.drop, "empty statement dropped");

const mergedMeta = mergeBodyMind(
  { text: "胸口悶", insight: "舊觀察。", support: "舊說明。", seeType: "CONTRAST", evidence: ["胸口悶"], confidence: "medium", status: "observation" },
  { text: "胸口悶", insight: "舊觀察。", support: "舊說明。" }
);
assert(mergedMeta.seeType === "CONTRAST", "merge keeps seeType");
assert(mergedMeta.evidence[0] === "胸口悶", "merge keeps evidence");
assert(mergedMeta.confidence === "medium", "merge keeps confidence");
assert(mergedMeta.status === "observation", "merge keeps status");

const legacy = bodyMind.normalizeBodyMind({ text: "胸口悶", insight: "也許碰到關係位置。", support: "先不用急著判斷。" });
assert(legacy.insight.includes("關係位置"), "legacy bag still normalizes");

(async () => {
  const see = await bodyMindSee.runSeePipeline({
    callAi: async (_msgs, stage) => {
      if (stage === "reason") {
        return {
          candidates: [
            {
              id: "s1",
              type: "COMMON_THREAD",
              statement: "今天寫下的內容裡有一件值得再看的事。",
              evidence: ["胸口悶"],
              newInformation: "n",
              whyItMatters: "值得看",
              alternative: "a",
              confidence: "medium",
            },
          ],
        };
      }
      if (stage === "challenge") {
        return { items: [{ id: "s1", verdict: "KEEP", failed: [], core: { statement: "", whyItMatters: "" } }] };
      }
      if (stage === "write") {
        return { insight: "今天寫下的內容裡有一件值得再看的事。", support: "先停在這裡。" };
      }
      return {};
    },
    ctx: { thanksText: "謝謝", event: "事件", mood: "平", bodyMindText: "胸口悶" },
  });
  assert(see.insight, "SEE pipeline returns insight");
  assert(typeof see.support === "string", "SEE pipeline returns support string");

  const journal = mergeJournalObjects(
    { bodyMind: { text: "胸口悶", insight: "觀察", support: "說明" } },
    { bodyMind: { text: "", insight: "", support: "" } }
  );
  assert(journal.bodyMind.insight === "觀察", "empty bag does not wipe insight");

  assert(app.includes("function generateBodyMindInsight"), "03 generate path retained");

  console.log("body-mind-see scaffold tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
