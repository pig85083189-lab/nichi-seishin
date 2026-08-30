const fs = require("fs");
const path = require("path");
const openai = require("../lib/openai");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const reviewJs = fs.readFileSync(path.join(root, "api/review.js"), "utf8");
const chatJs = fs.readFileSync(path.join(root, "api/chat.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const thinkV2 = fs.readFileSync(path.join(root, "lib/think-v2.js"), "utf8");
const bodyMind = fs.readFileSync(path.join(root, "lib/body-mind.js"), "utf8");
const execV2 = fs.readFileSync(path.join(root, "lib/exec-v2.js"), "utf8");

assert(openai.DEFAULT_CLAUDE_MODEL === "claude-haiku-4-5-20251001", "Normal default 仍是 Haiku 4.5");
assert(openai.INTERNAL_CLAUDE_MODEL === "claude-sonnet-5", "Internal 固定 Sonnet 5");
assert(openai.resolveClaudeModel() === openai.DEFAULT_CLAUDE_MODEL || openai.resolveClaudeModel() === (process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || openai.DEFAULT_CLAUDE_MODEL), "未標記 Internal 走預設");
assert(openai.resolveClaudeModel({ internal: true }) === "claude-sonnet-5", "Internal → sonnet 5");
assert(openai.resolveClaudeModel({ internal: false, model: "claude-sonnet-5" }) !== "claude-sonnet-5" || openai.resolveClaudeModel({ internal: false }) === openai.resolveClaudeModel({ model: "claude-sonnet-5" }), "client model 字串不能指定 Sonnet");
assert(openai.resolveClaudeModel({ model: "claude-sonnet-5" }) !== "claude-sonnet-5" || openai.resolveClaudeModel({}) === openai.resolveClaudeModel({ model: "claude-sonnet-5" }), "opts.model 被忽略");
assert(openai.getModel({ internal: true }) === (openai.usesClaude() ? "claude-sonnet-5" : openai.getModel()), "getModel internal 只在 Claude 路徑生效");

const haikuPayload = openai.buildClaudePayload(
  [{ role: "system", content: "sys" }, { role: "user", content: "hi" }],
  { temperature: 0.55, maxTokens: 800 },
  openai.DEFAULT_CLAUDE_MODEL
);
assert(haikuPayload.model === openai.DEFAULT_CLAUDE_MODEL, "Haiku payload 用 Haiku");
assert(haikuPayload.temperature === 0.55, "Haiku 仍傳 temperature");
assert(haikuPayload.max_tokens === 800, "Haiku max_tokens 不變");
assert(!haikuPayload.thinking, "Haiku 不傳 thinking");
assert(!haikuPayload.output_config, "Haiku 不傳 output_config");
assert(!("top_p" in haikuPayload) && !("top_k" in haikuPayload), "Haiku 不傳 top_p/top_k");

const sonnetPayload = openai.buildClaudePayload(
  [{ role: "system", content: "sys" }, { role: "user", content: "hi" }],
  { temperature: 0.55, maxTokens: 800, effort: "high" },
  openai.INTERNAL_CLAUDE_MODEL
);
assert(sonnetPayload.model === "claude-sonnet-5", "Sonnet payload 用 sonnet 5");
assert(!("temperature" in sonnetPayload), "Sonnet 不傳 temperature");
assert(!sonnetPayload.thinking, "Sonnet 不傳 manual extended thinking");
assert(!sonnetPayload.thinking || sonnetPayload.thinking.type !== "enabled", "Sonnet 不用 budget_tokens");
assert(sonnetPayload.output_config && sonnetPayload.output_config.effort === "high", "Sonnet 04 用 high effort");
assert(sonnetPayload.max_tokens >= 16000, "Sonnet max_tokens 預留 thinking");

const parsed = openai.extractClaudeText({
  content: [
    { type: "thinking", thinking: "hidden chain", text: "should not leak" },
    { type: "text", text: '{"ok":true}' },
  ],
});
assert(parsed === '{"ok":true}', "只取 type=text，不洩漏 thinking");

assert(reviewJs.includes("internal: internalUser"), "review 用 server isInternal 決定 model");
assert(reviewJs.includes("delete body.model"), "review 丟掉 client model");
assert(reviewJs.includes("delete body.internal"), "review 丟掉 client internal 旗標");
assert(reviewJs.includes("internalDebugMeta({ internal: true })"), "debug 顯示實際 Internal model");
assert(reviewJs.includes('effort:') && reviewJs.includes('"high"'), "04 Internal 明確 high effort");
assert(chatJs.includes("internal: internalUser"), "chat 也走 server routing");
assert(chatJs.includes("delete body.model"), "chat 丟掉 client model");
assert(chatJs.includes("delete body.internal"), "chat 丟掉 client internal");
assert(!reviewJs.includes("CREATE TABLE") && !reviewJs.includes("ALTER TABLE"), "zero schema");
assert(app.includes("function aiClientTimeout"), "Internal 可等較久，一般使用者 timeout 不變");
assert(!/postReview\(\{[\s\S]{0,200}model:\s*["']claude/.test(app), "frontend 不傳 model");

assert(thinkV2.includes("THINK_V2_CLOSE_SYSTEM") && thinkV2.includes("coreConclusion"), "04 prompt 檔未被這次改掉用途");
assert(bodyMind.includes("hypothesis") || bodyMind.includes("身心"), "03 lib 仍在");
assert(execV2.includes("executionChoicesUserPrompt"), "06 prompt 仍在");

const debugNormal = openai.internalDebugMeta();
const debugInternal = openai.internalDebugMeta({ internal: true });
assert(debugNormal.model, "normal debug 有 model");
if (openai.usesClaude()) {
  assert(debugNormal.model === openai.resolveClaudeModel(), "normal debug = Haiku path");
  assert(debugInternal.model === "claude-sonnet-5", "Internal debug = claude-sonnet-5");
}

console.log("internal model routing tests passed");
