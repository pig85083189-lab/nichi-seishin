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

assert(fs.existsSync(path.join(root, "ing-splash-v2.mp4")), "CASE A：正式 v2 MP4 存在");
assert(fs.existsSync(path.join(root, "ing-splash-v2-poster.jpg")), "ended / reduced 用 last-frame poster");
assert(!fs.existsSync(path.join(root, "ing-splash.mp4")), "CASE B：舊 MP4 已停止使用");
assert(!fs.existsSync(path.join(root, "ing-splash-poster.jpg")), "舊 poster 已停止使用");
assert(html.includes('id="splashVideo"') && html.includes("ing-splash-v2.mp4"), "CASE A：HTML5 video 使用 v2 檔名");
assert(!html.includes("ing-splash.mp4"), "CASE B：HTML 不再載入舊 MP4");
assert(!html.includes("ing-splash-poster.jpg"), "CASE B：HTML 不再載入舊 poster");
assert(!html.includes("8月28日"), "正式程式無中文檔名");
assert(splashHtml.includes("<video"), "Splash 主畫面是 video");

assert(!html.includes("splash__foil") && !splashCss.includes("splash__foil"), "不再 CSS 模仿反光");
assert(!html.includes("splash__shine") && !splashCss.includes("splash__shine"), "不再掃光");
assert(!html.includes("splash__sparkle") && !splashCss.includes("splash__sparkle"), "不再星芒");
assert(!splashCss.includes("lens") && !splashCss.includes("flare"), "不再 lens flare");
assert(!splashHtml.includes("每天，看見自己一點") && !splashHtml.includes("Loading"), "無 tagline / Loading");

assert(/\bmuted\b/.test(splashHtml) && splashHtml.includes("playsinline"), "CASE D：muted + playsinline");
assert(splashHtml.includes("webkit-playsinline"), "iOS playsinline");
assert(splashHtml.includes('preload="auto"') && splashHtml.includes("autoplay"), "preload auto + autoplay");
assert(!/\bcontrols\b/.test(splashHtml), "CASE N：無 controls");
assert(!/\bloop\b/.test(splashHtml), "CASE C：不 loop");
assert(splashCss.includes("object-fit: contain"), "CASE：contain 不裁 Logo");
assert(!splashCss.includes("object-fit: cover"), "不用 cover");
assert(splashCss.includes("max-width: 860px"), "Desktop max-width");

assert(app.includes("function freezeSplashVideo"), "CASE E：ended 停最後一幀");
assert(app.includes("function showSplashFallback"), "CASE J：error fallback");
assert(app.includes("function bindSplashVideo"), "video 綁定只在 initSplash");
assert(app.includes("const minMs = reduced ? 400 : 5000"), "CASE F／G：5.0s 完整播放");
assert(app.includes("const leaveMs = reduced ? 120 : 350"), "CASE G：fade 350ms");
assert(splashCss.includes("splashLeave 350ms"), "CSS 離場 350ms");
assert(app.includes("const maxMs = reduced ? 600 : 8000"), "CASE H：未 Ready 不強制進");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE R：hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "無 session 仍走本機 restore");
assert((app.match(/function initSplash/g) || []).length === 1, "只有一套 Splash");
assert(!app.includes("bindSplashVideo(") || app.includes("bindSplashVideo(splash)"), "video 只在 startup 綁");
assert(!app.includes("playbackRate"), "不放慢 playbackRate");

assert(splashCss.includes("is-static") && app.includes('classList.add("is-static")'), "CASE：reduced 顯示 last frame");
assert(splashCss.includes("is-fallback") && html.includes('id="splashFallback"') && app.includes("showSplashFallback"), "CASE J：靜態 Logo fallback");
assert(html.includes('id="splashFallback"') && html.includes("logo.png?v=3"), "fallback 用正式 ING Logo");
assert(!/animation:\s*[^;]*infinite/.test(splashCss), "無 infinite");

assert(app.includes("function loadReviewForDate"), "journal restore");
assert(app.includes("function applyAppLocation"), "route restore");
assert(app.includes("function reviewIsFinalized"), "completed restore");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE S：無 schema");

assert(html.includes("app.css?v=207"), "cache css");
assert(html.includes("app.js?v=240"), "cache js");
assert(html.includes("ing-splash-v2.mp4?v=1"), "cache video");

const mp4 = fs.statSync(path.join(root, "ing-splash-v2.mp4"));
assert(mp4.size > 20000 && mp4.size < 2500000, "optimized MP4 大小合理");

console.log("splash video intro tests passed");
