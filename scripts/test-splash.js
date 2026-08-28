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

assert(fs.existsSync(path.join(root, "ing-splash.mp4")), "CASE A：正式 MP4 存在");
assert(fs.existsSync(path.join(root, "ing-splash-poster.jpg")), "ended / reduced 用 last-frame poster");
assert(html.includes('id="splashVideo"') && html.includes("ing-splash.mp4"), "CASE A：HTML5 video 使用正式檔名");
assert(!html.includes("8月28日"), "正式程式無中文檔名");
assert(splashHtml.includes("<video"), "Splash 主畫面是 video");

assert(!html.includes("splash__foil") && !splashCss.includes("splash__foil"), "不再 CSS 模仿反光");
assert(!html.includes("splash__shine") && !splashCss.includes("splash__shine"), "不再掃光");
assert(!html.includes("splash__sparkle") && !splashCss.includes("splash__sparkle"), "不再星芒");
assert(!splashHtml.includes("每天，看見自己一點") && !splashHtml.includes("Loading"), "無 tagline / Loading");

assert(/\bmuted\b/.test(splashHtml) && splashHtml.includes("playsinline"), "CASE D：muted + playsinline");
assert(splashHtml.includes("webkit-playsinline"), "iOS playsinline");
assert(splashHtml.includes('preload="auto"') && splashHtml.includes("autoplay"), "preload auto + autoplay");
assert(!/\bcontrols\b/.test(splashHtml), "CASE N：無 controls");
assert(!/\bloop\b/.test(splashHtml), "CASE C：不 loop");
assert(splashCss.includes("object-fit: contain"), "CASE：contain 不裁 Logo");
assert(!splashCss.includes("object-fit: cover"), "不用 cover");
assert(splashCss.includes("max-width: 720px"), "Desktop max-width");

assert(app.includes("function freezeSplashVideo"), "CASE E：ended 停最後一幀");
assert(app.includes("function showSplashFallback"), "CASE J：error fallback");
assert(app.includes("function bindSplashVideo"), "video 綁定只在 initSplash");
assert(app.includes("const minMs = reduced ? 400 : 3500"), "CASE F／G：3.5s 開始淡出");
assert(app.includes("const leaveMs = reduced ? 120 : 500"), "CASE G：fade 500ms → 約 4s");
assert(splashCss.includes("splashLeave 500ms"), "CSS 離場 500ms");
assert(app.includes("const maxMs = reduced ? 600 : 8000"), "CASE H：未 Ready 不強制進");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE R：hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "無 session 仍走本機 restore");
assert((app.match(/function initSplash/g) || []).length === 1, "只有一套 Splash");
assert(!app.includes("bindSplashVideo(") || app.includes("bindSplashVideo(splash)"), "video 只在 startup 綁");

assert(splashCss.includes("is-static") && app.includes('classList.add("is-static")'), "CASE：reduced 顯示 last frame");
assert(splashCss.includes("is-fallback") && html.includes('id="splashFallback"') && app.includes("showSplashFallback"), "CASE J：靜態 Logo fallback");
assert(!/animation:\s*[^;]*infinite/.test(splashCss), "無 infinite");

assert(app.includes("function loadReviewForDate"), "journal restore");
assert(app.includes("function applyAppLocation"), "route restore");
assert(app.includes("function reviewIsFinalized"), "completed restore");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE S：無 schema");

assert(html.includes("app.css?v=206"), "cache css");
assert(html.includes("app.js?v=239"), "cache js");
assert(html.includes("ing-splash.mp4?v=1"), "cache video");

const mp4 = fs.statSync(path.join(root, "ing-splash.mp4"));
assert(mp4.size > 100000 && mp4.size < 2500000, "optimized MP4 大小合理");

console.log("splash video intro tests passed");
