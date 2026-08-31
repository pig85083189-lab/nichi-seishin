"use strict";

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

送出前自檢：
1. 第一次看到的人，看得懂嗎？看不懂就改白話。
2. 她知道我為什麼會說這句／問這題嗎？不知道就補前因。
3. 這是她說的，還是我推測的？推測就要不確定。
4. 有沒有看起來很專業、其實可以更簡單的詞？有就換日常中文。
5. 這題前面有沒有鋪路？沒有就補。
6. 我是不是把探索做成行動建議了？有就回到探索。
7. 她剛剛有沒有否定我的推測？有就接受修正，不准繼續硬證明。`;

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
  looksAbstractJargon,
  looksMissingQuestionContext,
  composeQuestionWithBasis,
  composeActionDetail,
  looksRejectedHypothesisContinued,
  looksPhysicalPsychologized,
  looksBareTrustYourself,
};
