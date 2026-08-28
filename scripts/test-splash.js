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

assert(!html.includes("<video"), "CASE G：無 video element");
assert(!html.includes("ing-splash"), "CASE G：不載入 Splash MP4");
assert(!app.includes("splashVideo") && !app.includes("bindSplashVideo"), "CASE G：無 Splash video runtime");
assert(!fs.existsSync(path.join(root, "ing-splash.mp4")), "舊 v1 MP4 已移除");
assert(!fs.existsSync(path.join(root, "ing-splash-v2.mp4")), "v2 MP4 已移除");

assert(splashHtml.includes("logo.png?v=3"), "CASE A：靜態正式 Logo");
assert(splashHtml.includes('class="splash__logo"'), "Splash 主體是靜態 Logo");
assert(!splashHtml.includes("每天，看見自己一點") && !splashHtml.includes("Loading"), "無 tagline / Loading");

assert(!splashCss.includes("splashLogoIn") && !splashCss.includes("splashGlowIn"), "CASE B：無 Logo 入場動畫");
assert(!/animation:\s*[^;]*infinite/.test(splashCss), "CASE B：無 infinite");
assert(!splashCss.includes("brightness") && !splashCss.includes("scale("), "CASE B：無 pulse / scale");
assert(!html.includes("splash__foil") && !html.includes("splash__shine") && !html.includes("splash__sparkle"), "無掃光閃爍");

assert(app.includes("const SPLASH_MIN_DURATION = 4000"), "CASE C：minimum 4000ms");
assert(app.includes("SPLASH_MIN_DURATION - splashLeaveMs()"), "hold = 4000 - fade，約 3600ms 開始淡出");
assert(app.includes("splashLeaveMs") && app.includes("? 120 : 400"), "CASE F：fade 400ms");
assert(splashCss.includes("splashLeave 400ms"), "CASE F：CSS fade 400ms");
assert(app.includes("if (elapsed < splashHoldMs()) return"), "未滿最短時間不離場");
assert(app.includes("if (!state.splashGateReady) return"), "CASE E：未 Ready 不強制進入");
assert(app.includes("window.setTimeout(tryDismissSplash, splashHoldMs())"), "最短時間到再檢查離場");
assert(!/setTimeout\(\s*\(\)\s*=>\s*(hideSplash|dismissSplash)/.test(app), "不是無條件 4 秒關閉");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE J：hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "無 session 仍走本機 restore");
assert(app.includes("function loadReviewForDate"), "journal restore");
assert(app.includes("function applyAppLocation"), "route restore");
assert(app.includes("function reviewIsFinalized"), "completed restore");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE K：無 schema");

assert(splashCss.includes("width: 72vw") && splashCss.includes("max-width: 510px"), "Logo 尺寸維持放大");
assert(splashCss.includes("object-fit: contain"), "不裁切、不變形");
assert((app.match(/function initSplash/g) || []).length === 1, "只有一套 Splash");

assert(html.includes("app.css?v=209"), "cache css");
assert(html.includes("app.js?v=242"), "cache js");

console.log("splash min duration tests passed");
