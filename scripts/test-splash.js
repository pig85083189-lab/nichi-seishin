const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(html.includes('id="splash"'), "CASE：Splash markup 在 index.html");
assert(html.includes("每天，看見自己一點。"), "CASE C：tagline 文案");
assert(css.includes("每天，看見自己一點。") || html.includes("splash__tagline"), "CASE C：tagline class");
assert(!html.includes("品牌精神") && !html.includes("產品主張") && !html.includes("愛，從我開始。"), "CASE D：沒有舊主張文案");
assert(!css.includes("品牌精神") && !app.includes("愛，從我開始。"), "CASE D：CSS/JS 無舊主張");

assert(css.includes("min(62vw, 365px)"), "CASE B：Logo 約縮小 13%");
assert(!css.includes("min(72vw, 420px)") || css.indexOf("min(72vw, 420px)") > css.indexOf(".logo"), "Splash logo 不再用舊尺寸");
assert(css.includes("padding:") && css.includes("10vh"), "CASE：Logo group 以底部 10vh padding 上移到約 45%");
assert(css.includes("splash__tagline") && css.includes("letter-spacing: 0.06em"), "CASE：tagline typography");
assert(css.includes("opacity: 0.7") || css.includes("to {\n    opacity: 0.7"), "CASE：tagline 低調 opacity");

assert(html.includes("class=\"is-booting\"") || html.includes("class='is-booting'") || html.includes("<html lang=\"zh-Hant\" class=\"is-booting\">"), "boot 時 html 深色底");
assert(css.includes("html.is-booting") && css.includes("#110e0c"), "CASE G：boot 背景蓋住白底");
assert(css.includes("100svh") && css.includes("100dvh"), "CASE G：viewport 高度覆蓋");
assert(css.includes("env(safe-area-inset-top"), "CASE G：safe-area");
assert(!/animation:\s*splashOut 2\.2s/.test(css) && !/animation:\s*splashOut 2\.2s/.test(html), "不再一載入就自動 fade out 2.2s");

assert(app.includes("function markSplashGateReady"), "CASE I／J：等 gate ready");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE J／K：登入／hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "CASE M：無 session 仍走本機 restore");
assert(app.includes("900") && app.includes("8000"), "CASE I：最短約 0.9s、最長 8s 保險");
assert(app.includes("splashLeave") || css.includes("splashLeave"), "CASE H：離場只做 opacity");
assert(!css.includes("splashOut"), "不再用舊 splashOut 時間軸");

assert(css.includes("prefers-reduced-motion") && /prefers-reduced-motion: reduce[\s\S]*splash__logo[\s\S]*animation:\s*none/.test(css), "CASE P：reduced motion 無 scale");
assert(html.includes("prefers-reduced-motion"), "CASE P：inline 也尊重 reduced motion");
assert(css.includes("max-width: min(100%, 420px)") || css.includes("min(62vw, 365px)"), "CASE Q：desktop Logo 有 max-width");

assert(app.includes("function loadReviewForDate"), "CASE M／N：journal restore 函式仍在");
assert(app.includes("function applyAppLocation"), "CASE O：route restore 仍在");
assert(app.includes("function reviewIsFinalized"), "CASE N：completed restore 機制仍在");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE R：無 schema");

assert(html.includes("app.css?v=202"), "cache css");
assert(html.includes("app.js?v=235"), "cache js");
assert(app.includes("clearBootingChrome"), "離場後拿掉 is-booting，App 不會卡深咖啡");

console.log("splash refinement tests passed");
