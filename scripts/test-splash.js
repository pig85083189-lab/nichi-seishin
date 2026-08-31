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

assert(!html.includes("<video"), "無 video");
assert(!html.includes("ing-splash"), "無 Splash MP4");
assert(!app.includes("splashVideo") && !app.includes("bindSplashVideo"), "無 video runtime");
assert(splashHtml.includes("logo.png?v=3") && splashHtml.includes('class="splash__logo"'), "CASE A：靜態正式 Logo");
assert(!splashHtml.includes("每天，看見自己一點") && !splashHtml.includes("Loading"), "無 tagline");

assert(!splashCss.includes("splashLogoIn") && !splashCss.includes("brightness") && !splashCss.includes("scale("), "CASE F：Logo 無動畫");
assert(splashCss.includes("width: 72vw") && splashCss.includes("max-width: 510px"), "CASE D：Logo 尺寸未改");
assert(splashCss.includes("translateY(-1.8vh)"), "視覺置中：往上微調");
assert(splashCss.includes("height: 100svh") && splashCss.includes("max-height: 100svh"), "iOS 用 svh 而非 inset 大視窗");
assert(!/^\s*inset:\s*0/m.test(splashCss), "Splash 不再 inset:0 吃 large viewport");

assert(app.includes("const SPLASH_MIN_DURATION = 2000"), "CASE E：minimum 2000ms");
assert(app.includes("return SPLASH_MIN_DURATION"), "2 秒是可見最短，不含 fade 扣除");
assert(app.includes("? 120 : 300") && splashCss.includes("splashLeave 300ms"), "fade 300ms");
assert(app.includes("function waitForAppPaint") && app.includes("requestAnimationFrame"), "CASE I：等 paint 再淡出");
assert(app.includes("waitForAppPaint().then(beginLeave)"), "先露出 App，再 fade Splash");
assert(app.includes("if (!state.splashGateReady) return"), "CASE K：未 Ready 不離場");
assert(app.includes("clearBootingChrome();") && app.includes("waitForAppPaint().then(beginLeave)"), "先清 booting 背景再 fade");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE O：hydrate 完成才放行");
assert(app.includes("function loadReviewForDate") && app.includes("function applyAppLocation"), "restore 保留");
assert(app.includes("function reviewIsFinalized"), "completed restore");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE P：無 schema");
assert(!/setTimeout\(\s*\(\)\s*=>\s*(hideSplash|dismissSplash)/.test(app), "不是無條件關閉");

assert(html.includes("app.css?v=228"), "cache css");
assert(html.includes("app.js?v=264"), "cache js");

console.log("splash position and transition tests passed");
