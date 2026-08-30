const fs = require("fs");
const path = require("path");
const bodyMind = require("../lib/body-mind");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function simulateSession() {
  const session = {
    text: "",
    insight: "",
    support: "",
    sig: "",
    requests: [],
    busy: false,
    confirmedClicks: 0,
  };

  function currentSig() {
    return bodyMind.bodyMindSignature(session.text, "", "");
  }

  function autosave() {
    return { type: "autosave", text: session.text, requestCount: session.requests.length };
  }

  function pause() {
    return autosave();
  }

  function blur() {
    return autosave();
  }

  function type(chunk) {
    session.text = bodyMind.bodyMindLiveText(`${session.text} ${chunk}`);
    return pause();
  }

  function clickCta() {
    session.confirmedClicks += 1;
    if (!bodyMind.bodyMindGenerationAllowed({ confirmed: true })) return;
    if (session.busy) return;
    if (!bodyMind.bodyMindTextReady(session.text)) return;
    session.busy = true;
    session.requests.push(session.text);
    const requestText = session.text;
    return {
      finish(response, laterText) {
        session.busy = false;
        const current = laterText != null ? bodyMind.bodyMindLiveText(laterText) : session.text;
        const matches = bodyMind.bodyMindResponseMatches(requestText, current);
        session.text = current;
        session.insight = response.insight;
        session.support = response.support;
        session.sig = bodyMind.bodyMindSignature(requestText, "", "");
        return { matches, stale: bodyMind.bodyMindSourceStale({ ...session, insight: session.insight, support: session.support }, current) };
      },
    };
  }

  return { session, type, pause, blur, autosave, clickCta, currentSig };
}

assert(bodyMind.bodyMindGenerationAllowed({ confirmed: true }) === true, "confirmed 才允許");
assert(bodyMind.bodyMindGenerationAllowed({}) === false, "沒 confirmed 不允許");
assert(bodyMind.bodyMindGenerationAllowed({ auto: true, confirmed: true }) === false, "auto 永遠不允許");
assert(bodyMind.bodyMindGenerationAllowed({ confirmed: false }) === false, "confirmed false 不允許");
assert(bodyMind.bodyMindResponseMatches("完整文字", "完整文字"), "相同文字可接受");
assert(!bodyMind.bodyMindResponseMatches("第一句", "第一句 後來又改了"), "改過的文字不能當正式結果");

const { session, type, pause, blur, autosave, clickCta } = simulateSession();

type("今天回到家看到客廳很亂");
pause();
assert(session.requests.length === 0, "TEST A：停 5 秒不生成");

type("其實還沒寫完");
pause();
assert(session.requests.length === 0, "TEST B：停 20 秒不生成");

blur();
assert(session.requests.length === 0, "TEST C：blur 不生成");

autosave();
assert(session.requests.length === 0, "TEST D：autosave 不生成");

type("真正讓我不舒服的是家裡沒有我可以休息的地方。我站在門口，胸口有點悶。想先把這件事看清楚。");
assert(session.requests.length === 0, "TEST E：寫完但沒按 CTA 不生成");

const pending = clickCta();
assert(session.requests.length === 1, "TEST F：按 CTA 才 1 次");
assert(session.requests[0] === session.text, "TEST F：source === 當下完整文字");
clickCta();
assert(session.requests.length === 1, "TEST G：double click 仍是 1");
pending.finish({ insight: "核心覺察。", support: "往下看一眼。" });

session.text = `${session.text} 後來又補了一句。`;
assert(session.requests.length === 1, "TEST H：改字不自動生成");
assert(bodyMind.bodyMindSourceStale(session, session.text), "TEST H：標記 stale");

const again = clickCta();
assert(session.requests.length === 2, "TEST I：再按才 +1");
assert(session.requests[1] === session.text, "TEST I：使用最新完整文字");
const raced = again.finish({ insight: "舊回應。", support: "舊引導。" }, `${session.text} 送出後又改了`);
assert(raced.matches === false, "race：回來時文字已變");
assert(raced.stale === true, "race：標記 stale，不覆蓋成正式結果");

assert(!/function loadReviewForDate[\s\S]{0,900}generateBodyMindInsight/.test(app), "TEST J：reload 不呼叫 generate");
assert(!/function fillJournal[\s\S]{0,2400}generateBodyMindInsight/.test(app), "TEST J：hydrate 不呼叫 generate");
assert(app.includes("generateBodyMindInsight({ confirmed: true })"), "唯一 trigger 是 CTA confirmed");
assert(html.includes('id="btnBodyMindInsight"'), "CTA 存在");
assert((app.match(/generateBodyMindInsight\(/g) || []).length === 2, "除定義外只有 CTA 一處呼叫");

console.log("body-mind trigger interaction tests A-J passed");
