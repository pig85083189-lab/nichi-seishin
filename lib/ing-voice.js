"use strict";

const answerEngine = require("./ing-answer-engine");

const ABSTRACT_JARGON = /內在判準|外部視角|存在重量|價值確認|情緒需求|心理機制|核心信念|內在篤定|深層需求|自我價值感|內在情感需求|外在陪伴與內在|方向感有一部分建立/;

const CONTEXT_HOOK = /你今天|你剛剛|你提到|你寫到|前面你|看到你寫|你說|從你剛剛|你有一句|你有寫|因為你今天|你選了|你之前|這次和你/;

const GLOBAL_VOICE_BLOCK = `【ING 語言｜所有區塊共同遵守】
你像一個真的把她今天寫的內容看完、很會陪她整理自己的人。
不是心理分析報告。不是老師。不是考卷。也不是一直給人生建議。

核心順序：
她寫了什麼 → 我從哪一段想到 → 我看見什麼 → 再問／接住／給下一步。
不可以突然給結論，再突然問問題。

白話優先。第一次看到的人必須看得懂，覺得「對耶／原來我是這樣／這題我真的想想看」，而不是「這句很深但我看不懂」。
禁止抽象詞：內在判準、外部視角、存在重量、價值確認、情緒需求、心理機制、核心信念、內在篤定、深層需求、自我價值感。
能用日常中文就用日常中文。

原話優先。可以自然寫「你今天提到」「你剛剛說」「我注意到你寫到」「前面你有說」。不一定逐字引用，但不能改變原意。禁止為了漂亮把她沒說過的意思塞進去。

推測必須保留不確定：會不會、有沒有可能、我有點好奇、聽起來好像、也許、你覺得呢。
不可以寫成事實，不可以替她定義自己。

每個問題都要有前因。她不該回去翻今天寫了什麼，才知道你為什麼問這題。
不要每天同一套模板「你今天提到 X。我注意到 Y。所以我想問 Z。」說法要自然一點。

即使內部有過往資料，也不必每一次明說「以前」。歷史只是幫你問得更好時，可以自然地問，不必炫耀記憶。不要寫日期翻舊帳。不要把歷史 AI 推測當成她的事實。

${answerEngine.ANSWER_ENGINE_VOICE}

送出前自檢：
1. 第一次看到的人，看得懂嗎？看不懂就改白話。
2. 她知道我為什麼會說這句／問這題嗎？不知道就補前因。
3. 這是她說的，還是我推測的？推測就要不確定。
4. 有沒有看起來很專業、其實可以更簡單的詞？有就換日常中文。
5. 這題前面有沒有鋪路？沒有就補。
6. 我是不是把探索做成行動建議了？有就回到探索。
7. 她剛剛有沒有否定我的推測？有就接受修正，不准繼續硬證明。`;

const USER_RAW_PROMPT_MAX = 4000;

const FULL_INPUT_READ_BLOCK = `【完整閱讀｜最高優先】
使用者原文必須整篇讀完。
原文裡的「...」「……」「…」只是停頓、語氣或思考中的呼吸，不是內容結束，也不是系統截斷。
一定要把省略號後面的句子讀完。
禁止說「寫到『其實...』就停住了」。
禁止把使用者的省略號當成 truncated content marker。
就算某一句看起來沒寫完，只要後面還有字，那些字都算進今天的原文。`;

const VALUE_ENGINE_BLOCK = `【洞察價值閘門｜VALUE TEST｜不過就刪。不要為了湊數而放行】
工作是幫她整理出她自己還沒說出口的東西。不是把她剛寫的話換句話說，再問一句答案很明顯的問題。

過關條件：看完之後，她不能覺得「對啊我自己就知道／所以呢／這不是我剛剛寫的嗎」。
每個 item 必須比 USER RAW 多一個新的關係，例如：
A+B→pattern、A+C→connection、today+改變、細節→真正在意的、正向經驗→可複製的成功模式。
只是 A→換句話說 A：刪。

優先順序：
1. 跨段連結
2. 正在發生的改變
3. 重複出現的模式
4. 多個細節共同揭示的在意
5. 值得保留的成功模式
6. 真正的拉扯／矛盾
7. 孤立單一事實（沒有新關係就刪）

刪除清單：
- 使用者已寫「幸福」，又說／又問「日常陪伴才是幸福嗎」
- 想睡 → 累；心情好跟想睡不衝突；想睡是不是做得夠多
- 開心 → 心情好；被照顧 → 覺得幸福；學很多 → 有成長
- 「你覺得呢」「這對你重要嗎」「你今天是不是很累」
- 只有 title 看起來有洞察、正文仍是重述

03 身體不是一定進 04。今天想睡、且沒連到行為／選擇／關係／長期 pattern：不要拿來做 04。

生成：先 5～8 個 candidate，刪掉沒過關的，只留 2～3 個。
寧願 2 個過關，也不要 3 個低價值。不要為了湊 3 把垃圾撿回來。
每個先 title + insight。question 可空。
有 question 時：回答之後她必須會多知道一件自己原本沒直接寫的事。否則不要問。

【title】
有觀點。約 4～14 字。不是分類名。title 不能拯救低價值正文。

【insight】
1～3 短句。先 evidence，再多一層關係。像人在整理生活。

【正向的一天】
不要硬找問題。可以看見正在做對什麼、哪個習慣值得保留、哪個成功模式可以複製。`;

function userRawForPrompt(value, max) {
  let text = String(value == null ? "" : value);
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return "";
  const limit = Number(max);
  const cap = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 8000) : USER_RAW_PROMPT_MAX;
  if (text.length <= cap) return text;
  const sliced = text.slice(0, cap);
  const cut = Math.max(sliced.lastIndexOf("\n"), sliced.lastIndexOf("。"), sliced.lastIndexOf("！"), sliced.lastIndexOf("？"));
  return (cut >= Math.floor(cap * 0.6) ? sliced.slice(0, cut + 1) : sliced).trimEnd();
}

function looksAbstractJargon(text) {
  return ABSTRACT_JARGON.test(String(text || ""));
}

function looksMissingQuestionContext(text) {
  const raw = String(text || "").trim();
  if (!raw) return true;
  if (CONTEXT_HOOK.test(raw)) return false;
  return /[？?]/.test(raw);
}

function composeQuestionWithBasis(item) {
  if (item == null) return "";
  if (typeof item === "string") return String(item).replace(/\s+/g, " ").trim();
  const question = String(item.question || item.text || "").replace(/\s+/g, " ").trim();
  const basis = String(item.basis || item.context || "").replace(/\s+/g, " ").trim();
  if (!basis) return question;
  if (!question) return basis;
  if (question.includes(basis) || basis.includes(question)) {
    return question.length >= basis.length ? question : basis;
  }
  const head = basis.slice(0, 10);
  if (head && question.includes(head)) return question;
  const glue = /[。！？!?]$/.test(basis) ? " " : "。";
  return `${basis}${glue}${question}`.replace(/\s+/g, " ").trim();
}

function composeInsightItem(item, index, idPrefix) {
  const prefix = idPrefix || "q";
  const n = Number(index);
  const fallbackId = `${prefix}${Number.isFinite(n) ? n + 1 : 1}`;
  if (item == null) return null;
  if (typeof item === "string") {
    const text = String(item).replace(/\s+/g, " ").trim();
    return text ? { id: fallbackId, text } : null;
  }
  if (typeof item !== "object") return null;
  const title = String(item.title || "").replace(/\s+/g, " ").trim();
  const insight = String(item.insight || "").replace(/\s+/g, " ").trim();
  let question = "";
  let text = "";
  if (insight) {
    question = String(item.question || item.prompt || "").replace(/\s+/g, " ").trim();
    if (question && (insight.includes(question) || question === insight)) {
      text = insight;
    } else if (question) {
      const glue = /[。！？!?]$/.test(insight) ? " " : "。";
      text = `${insight}${glue}${question}`.replace(/\s+/g, " ").trim();
    } else {
      text = insight;
    }
  } else {
    text = composeQuestionWithBasis(item);
  }
  if (!text) return null;
  const out = { id: String(item.id || fallbackId), text };
  if (title) out.title = title;
  if (insight) out.insight = insight;
  if (question) out.question = question;
  return out;
}

function looksCategoryTitle(text) {
  const raw = String(text || "").replace(/\s+/g, "").trim();
  return /^(幸福感|人際關係|自我成長|身體狀態|外部肯定|人際|成長|情緒|關係|覺察|行動|反思)$/.test(raw);
}

function looksFillerPhrase(text) {
  return /這是一個很值得思考的地方|這件事情其實很有意思|這也反映出一些值得關注的面向|很值得思考的地方|值得關注的面向|這很有意思|這值得深思/.test(
    String(text || "")
  );
}

function looksAnswerAlreadyInInput(question, source) {
  const qRaw = String(question || "");
  const src = String(source || "");
  if (!qRaw || !src) return false;
  return /你今天開心嗎|讓你覺得幸福嗎|陪你讓你幸福嗎|學習對你重要嗎|和 Baby 相處讓你覺得幸福嗎|這份幸福對你來說重要嗎|才是你真正注意的幸福|日常陪伴就是你的幸福|你今天是不是很累|這是不是幸福|心情很好跟想睡不衝突/.test(
    qRaw
  );
}

function looksStoppedAtEllipsis(text) {
  return /寫到[「『']?其實[\.。…⋯]{2,}[」』']?就停|停在[「『']?其實|只寫到[「『']?其實|寫到『其實|寫到「其實/.test(
    String(text || "")
  );
}

function looksReportConclusion(text) {
  return /第一輪只看到|第二輪更直接地說|第二輪更直接|第一輪.*第二輪更|從第一輪到第二輪|這一輪比上一輪更/.test(
    String(text || "")
  );
}

function hasCrossSectionOpportunity(ctx) {
  const data = ctx && typeof ctx === "object" ? ctx : {};
  const thanks = String(data.thanksText || data.thanks || "");
  const event = String(data.event || "");
  return /吃飯|聊天|切水果|陪伴|幸福|放在心上/.test(thanks) && /客人|照顧|帶給|感受|服務/.test(event);
}

function looksHasConnection(text) {
  return /也是你.*帶給|想帶給別人|自己最容易被打動|放在心上.*客人|幸福.*照顧|帶給別人的感覺/.test(String(text || ""));
}

function composeActionDetail(item) {
  const detail = String((item && (item.detail || item.body || item.description)) || "").replace(/\s+/g, " ").trim();
  const reason = String((item && (item.reason || item.basis || item.why)) || "").replace(/\s+/g, " ").trim();
  if (!reason) return detail;
  if (!detail) return reason;
  const head = reason.slice(0, Math.min(10, reason.length));
  if (head && detail.includes(head)) return detail;
  return `${reason} ${detail}`.replace(/\s+/g, " ").trim();
}

function looksRejectedHypothesisContinued(answer, output) {
  const a = String(answer || "");
  const o = String(output || "");
  if (!/其實沒有|沒有想|不是這樣|我不覺得/.test(a)) return false;
  const matched = a.match(/(?:其實沒有|沒有想|不是)([^。！？\n]{2,16})/);
  if (!matched) return false;
  const fragment = String(matched[1] || "").replace(/的感覺|的意思/g, "").trim();
  if (fragment.length < 2 || !o.includes(fragment)) return false;
  if (/你說|你剛剛|否認/.test(o) && /沒有|不是|否認/.test(o)) return false;
  return true;
}

function looksBareTrustYourself(text) {
  const raw = String(text || "");
  if (!/相信自己/.test(raw)) return false;
  return !/更相信自己|比較相信自己|才相信自己|會相信自己|相信自己的方向|相信自己真的|相信自己走|容易相信自己/.test(raw);
}

function looksPhysicalPsychologized(userText, insight) {
  const source = String(userText || "");
  if (!/痠|痛|感冒|沒睡|運動|健身|肩頸/.test(source)) return false;
  if (/壓力|焦慮|害怕|心情|內心|情緒|孤單|難過/.test(source)) return false;
  return /壓力|心理|內心|焦慮|承受太多|情感需求/.test(String(insight || ""));
}

module.exports = {
  ABSTRACT_JARGON,
  CONTEXT_HOOK,
  GLOBAL_VOICE_BLOCK,
  FULL_INPUT_READ_BLOCK,
  VALUE_ENGINE_BLOCK,
  USER_RAW_PROMPT_MAX,
  ANSWER_ENGINE_VOICE: answerEngine.ANSWER_ENGINE_VOICE,
  ANSWER_ENGINE_VERSION: answerEngine.ANSWER_ENGINE_VERSION,
  userRawForPrompt,
  looksAbstractJargon,
  looksMissingQuestionContext,
  composeQuestionWithBasis,
  composeInsightItem,
  composeActionDetail,
  looksRejectedHypothesisContinued,
  looksPhysicalPsychologized,
  looksBareTrustYourself,
  looksCategoryTitle,
  looksFillerPhrase,
  looksAnswerAlreadyInInput,
  looksStoppedAtEllipsis,
  looksReportConclusion,
  hasCrossSectionOpportunity,
  looksHasConnection,
};
