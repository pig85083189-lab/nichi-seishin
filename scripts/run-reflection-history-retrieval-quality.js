const retrieval = require("../lib/reflection-history-retrieval");
const { spawnSync } = require("child_process");
const path = require("path");

const result = spawnSync(process.execPath, [path.join(__dirname, "test-reflection-history-retrieval.js")], {
  encoding: "utf8",
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status) process.exit(result.status);

console.log("\n--- Stage 2 prompt contract ---");
console.log("variant:", retrieval.HISTORY_RETRIEVAL_VARIANT);
console.log("window:", retrieval.CANDIDATE_WINDOW);
console.log("max selected:", retrieval.MAX_SELECTED, "min score:", retrieval.MIN_SELECTED_SCORE);
console.log("pattern claim blocked:", retrieval.HISTORY_RERANK_SYSTEM.includes("你總是"));
console.log("positive retrieval:", retrieval.HISTORY_RERANK_SYSTEM.includes("problem detector"));
