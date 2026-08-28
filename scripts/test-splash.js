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

assert(html.includes('id="splash"'), "CASE A：Splash markup 在 index.html");
assert(splashHtml.includes("splash__logo") && splashHtml.includes("進行式ING"), "CASE A：Logo 仍是主角");
assert(!html.includes("splash__tagline") && !html.includes("每天，看見自己一點。"), "CASE A：無 tagline");
assert(!css.includes("splash__tagline") && !css.includes("splashTaglineIn"), "CASE A：無 tagline CSS");
assert(!splashHtml.includes("愛，從我開始") && !splashHtml.includes("歡迎回來") && !splashHtml.includes("Loading"), "CASE A：Splash 無其他文案");

assert(splashCss.includes("width: 72vw") && splashCss.includes("max-width: 510px"), "CASE B：Logo 維持放大尺寸");
assert(splashCss.includes("height: auto") && !splashCss.includes("max-height"), "CASE B：aspect 由 height auto");
assert(!splashCss.includes("min(62vw, 365px)"), "CASE B：沒縮回舊尺寸");

assert(html.includes("splash__shine") && splashCss.includes(".splash__shine"), "CASE C：shine overlay");
assert(splashCss.includes("left: -25%") && splashCss.includes("left: 110%"), "CASE C：光線左→右掃過");
assert(/animation:\s*splashShine 750ms[\s\S]*1 forwards/.test(splashCss), "CASE C／H：shine 750ms 只播一次");
assert(splashCss.includes("skewX(-18deg)"), "CASE D：斜向反光");
assert(splashCss.includes("rgba(255, 245, 215, 0.9)"), "CASE D：暖金高光");
assert(splashCss.includes("rgba(255, 235, 190, 0.15)"), "CASE D：漸層兩側透明金");
assert(splashCss.includes("blur(3px)"), "CASE D：光帶柔化");

assert(splashCss.includes("brightness(1.15)"), "CASE E：Logo 微亮上限 1.15");
assert(!splashCss.includes("brightness(2)") && !splashCss.includes("brightness(1.18)"), "CASE E：不是白閃");

assert((splashHtml.match(/splash__sparkle--/g) || []).length === 2, "CASE F：正好 2 個 sparkle");
assert(splashCss.includes("splash__sparkle--a") && splashCss.includes("splash__sparkle--b"), "CASE F：兩顆星芒 class");
assert(splashCss.includes("top: 14%") && splashCss.includes("left: 9%"), "CASE F：sparkle 1 在 NG 圓形左上");
assert(splashCss.includes("top: 40%") && splashCss.includes("left: 70%"), "CASE F：sparkle 2 在進行式右側");
assert(splashCss.includes("#fff3d6"), "CASE G：暖金白星芒");
assert(/splashSparkle 240ms/.test(splashCss) && /splashSparkle 260ms/.test(splashCss), "CASE G：星芒短暫");

assert(!/animation:\s*[^;]*infinite/.test(splashCss), "CASE H：無 infinite");
assert(splashCss.includes("scale(0.97)"), "Logo 柔和出場 scale 0.97");
assert(!splashCss.includes("splashGlowIn"), "CASE：背景暖光不再跟著閃");
assert(splashCss.includes("overflow: hidden"), "CASE L：clip overflow，避免橫向捲動");

assert(app.includes("function markSplashGateReady"), "CASE O：等 gate ready");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE O：登入／hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "CASE O：無 session 仍走本機 restore");
assert(app.includes("const minMs = reduced ? 80 : 1200"), "reveal 約 1.2s 後才可離場");
assert(app.includes("const maxMs = reduced ? 600 : 8000"), "最長 8s 保險");
assert(app.includes("const leaveMs = reduced ? 120 : 280"), "CASE J：離場約 280ms");
assert(splashCss.includes("splashLeave 280ms"), "CASE J：CSS 離場 opacity");
assert(!css.includes("splashOut"), "不再用舊 splashOut");

assert(
  /prefers-reduced-motion: reduce[\s\S]*splashLogoFade/.test(splashCss),
  "CASE N：reduced motion Logo 只淡入"
);
assert(
  /prefers-reduced-motion: reduce[\s\S]*splash__shine[\s\S]*animation:\s*none/.test(splashCss),
  "CASE N：reduced 關閉 shine / sparkle"
);
assert(html.includes("prefers-reduced-motion") && html.includes("splashLogoFade"), "CASE N：inline 也尊重 reduced motion");

assert(app.includes("function loadReviewForDate"), "journal restore 仍在");
assert(app.includes("function applyAppLocation"), "route restore 仍在");
assert(app.includes("function reviewIsFinalized"), "completed restore 仍在");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "無 schema");

assert(html.includes("app.css?v=204"), "cache css");
assert(html.includes("app.js?v=237"), "cache js");
assert(app.includes("clearBootingChrome"), "離場後拿掉 is-booting");

console.log("splash shine reveal tests passed");
