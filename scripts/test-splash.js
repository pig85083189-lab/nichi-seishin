const fs = require("fs");
const path = require("path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const splashHtml = html.slice(html.indexOf('id="splash"'), html.indexOf("class=\"topbar\""));
const splashCssStart = css.indexOf(".splash {");
const splashCssEnd = css.indexOf(".hidden {");
const splashCss = splashCssStart >= 0 && splashCssEnd > splashCssStart ? css.slice(splashCssStart, splashCssEnd) : "";

assert(html.includes('id="splash"'), "CASE：Splash markup 在 index.html");
assert(!html.includes("splash__tagline"), "CASE C：無 tagline class");
assert(!html.includes("每天，看見自己一點。"), "CASE C：tagline 文案已刪");
assert(!css.includes("splash__tagline") && !css.includes("splashTaglineIn"), "CASE C：無 tagline CSS / animation");
assert(!html.includes("splash__stage"), "不再為 tagline 留 stage 空白");
assert(!splashHtml.includes("愛，從我開始") && !splashHtml.includes("歡迎回來") && !splashHtml.includes("Loading"), "CASE D：Splash 無其他文案");
assert(!html.includes("品牌精神") && !html.includes("產品主張") && !html.includes("愛，從我開始。"), "CASE D：沒有舊主張文案");
assert(!css.includes("品牌精神") && !app.includes("愛，從我開始。"), "CASE D：CSS/JS 無舊主張");

assert(splashCss.includes("width: 72vw"), "CASE A／B：Logo width 72vw");
assert(splashCss.includes("max-width: 510px"), "CASE B／M：desktop max-width 510px");
assert(splashCss.includes("height: auto"), "CASE E：height auto 保 aspect");
assert(!splashCss.includes("max-height"), "CASE A／E：不再用 max-height 壓扁 Logo");
assert(!splashCss.includes("min(62vw, 365px)"), "不再用舊 Production 尺寸");
assert(!splashCss.includes("10vh"), "CASE：Logo 不再為 tagline 往上墊");
assert(splashCss.includes("align-items: center") && splashCss.includes("justify-content: center"), "CASE：視覺置中");

assert(html.includes("class=\"is-booting\"") || html.includes("<html lang=\"zh-Hant\" class=\"is-booting\">"), "boot 時 html 深色底");
assert(css.includes("html.is-booting") && css.includes("#110e0c"), "CASE J：boot 背景蓋住白底");
assert(css.includes("100svh") && css.includes("100dvh"), "CASE K：viewport 高度覆蓋");
assert(css.includes("env(safe-area-inset-top") && css.includes("env(safe-area-inset-bottom"), "CASE K：safe-area");
assert(!/animation:\s*splashOut 2\.2s/.test(css) && !/animation:\s*splashOut 2\.2s/.test(html), "不再一載入就自動 fade out 2.2s");

assert(splashCss.includes("brightness(1.18)"), "CASE G：微亮 brightness 1.18");
assert(!splashCss.includes("brightness(2)"), "CASE G：不是白閃");
assert(/animation:\s*splashLogoIn 1050ms ease-out 1 forwards/.test(splashCss), "CASE F：reveal 1050ms 只播一次");
assert(!/animation:\s*[^;]*infinite/.test(splashCss), "CASE F／G：無 infinite");
assert(splashCss.includes("scale(0.96)"), "CASE：入場 scale 0.96 → 1");
assert(splashCss.includes("rgba(156, 136, 121, 0.24)"), "暖光保持低調");

assert(app.includes("function markSplashGateReady"), "CASE I／J：等 gate ready");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE O／P：登入／hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "CASE P：無 session 仍走本機 restore");
assert(app.includes("const minMs = reduced ? 80 : 1050"), "CASE：最短約 1.05s 讓 reveal 播完");
assert(app.includes("const maxMs = reduced ? 600 : 8000"), "CASE：最長 8s 保險");
assert(app.includes("const leaveMs = reduced ? 120 : 280"), "CASE I：離場約 280ms");
assert(splashCss.includes("splashLeave 280ms"), "CASE I：CSS 離場 280ms opacity");
assert(!css.includes("splashOut"), "不再用舊 splashOut 時間軸");

assert(
  /prefers-reduced-motion: reduce[\s\S]*splash__logo[\s\S]*splashLogoFade/.test(splashCss),
  "CASE N：reduced motion 只淡入、無 scale pulse"
);
assert(html.includes("prefers-reduced-motion") && html.includes("splashLogoFade"), "CASE N：inline 也尊重 reduced motion");
assert(!/prefers-reduced-motion: reduce[\s\S]*splash__logo[\s\S]*scale\(/.test(splashCss.split("@media (prefers-reduced-motion: reduce)")[1] || ""), "CASE N：reduced 無 scale");

assert(app.includes("function loadReviewForDate"), "CASE Q／R：journal restore 函式仍在");
assert(app.includes("function applyAppLocation"), "route restore 仍在");
assert(app.includes("function reviewIsFinalized"), "CASE R：completed restore 機制仍在");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE S：無 schema");

assert(html.includes("app.css?v=203"), "cache css");
assert(html.includes("app.js?v=236"), "cache js");
assert(app.includes("clearBootingChrome"), "離場後拿掉 is-booting，App 不會卡深咖啡");

console.log("splash refinement tests passed");
