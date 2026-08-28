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

assert(!html.includes("<video"), "CASE A：無 video element");
assert(!splashHtml.includes("<video"), "CASE A：Splash 不播放 MP4");
assert(!html.includes("ing-splash"), "CASE A：不載入 Splash MP4 / poster");
assert(!app.includes("splashVideo") && !app.includes("bindSplashVideo"), "CASE A：無 Splash video runtime");
assert(!app.includes("freezeSplashVideo"), "無 video ended freeze");
assert(!fs.existsSync(path.join(root, "ing-splash.mp4")), "舊 v1 MP4 已移除");
assert(!fs.existsSync(path.join(root, "ing-splash-v2.mp4")), "v2 MP4 已移除");
assert(!fs.existsSync(path.join(root, "ing-splash-poster.jpg")), "舊 poster 已移除");
assert(!fs.existsSync(path.join(root, "ing-splash-v2-poster.jpg")), "v2 poster 已移除");

assert(splashHtml.includes("logo.png?v=3"), "CASE H：最新正式 Logo");
assert(splashHtml.includes('class="splash__logo"'), "Splash 主體是靜態 Logo");
assert(!splashHtml.includes("每天，看見自己一點") && !splashHtml.includes("Loading"), "CASE D：無 tagline / Loading");
assert(!splashHtml.includes("歡迎") && !splashHtml.includes("進度"), "無歡迎文字 / 進度條");

assert(!html.includes("splash__foil") && !splashCss.includes("splash__foil"), "CASE C：無 foil");
assert(!html.includes("splash__shine") && !splashCss.includes("splash__shine"), "CASE C：無掃光");
assert(!html.includes("splash__sparkle") && !splashCss.includes("splash__sparkle"), "CASE C：無 sparkle");
assert(!splashCss.includes("splashLogoIn") && !splashCss.includes("splashGlowIn"), "CASE B：無 Logo 入場動畫");
assert(!/animation:\s*[^;]*infinite/.test(splashCss), "CASE B：無 infinite");
assert(!splashCss.includes("brightness") && !splashCss.includes("scale("), "CASE B：無 pulse / scale");
assert(splashCss.includes("splashLeave 200ms"), "離場只做畫面 fade 200ms");
assert(!app.includes("const minMs"), "CASE E：無最低展示 timer");
assert(!/setTimeout\(tryDismissSplash/.test(app), "CASE E：無 timer 驅動離場");
assert(app.includes("if (!state.splashGateReady) return"), "CASE G：未 Ready 不離場");
assert(app.includes("refreshAuth().finally(() => markSplashGateReady())"), "CASE N：hydrate 完成才放行");
assert(app.includes("if (!hasStoredAuthSession())"), "無 session 仍走本機 restore");
assert(app.includes("function loadReviewForDate"), "journal restore");
assert(app.includes("function applyAppLocation"), "route restore");
assert(app.includes("function reviewIsFinalized"), "completed restore");
assert(!app.includes("CREATE TABLE") && !html.includes("ALTER TABLE"), "CASE O：無 schema");

assert(splashCss.includes("width: 72vw") && splashCss.includes("max-width: 510px"), "CASE I：維持放大 Logo");
assert(splashCss.includes("object-fit: contain"), "不裁切、不變形");
assert(splashCss.includes("mix-blend-mode: lighten"), "深色底顯示正式 Logo");
assert(splashCss.includes("env(safe-area-inset-bottom"), "CASE K：safe-area");
assert((app.match(/function initSplash/g) || []).length === 1, "只有一套 Splash");

assert(html.includes("app.css?v=208"), "cache css");
assert(html.includes("app.js?v=241"), "cache js");

console.log("splash static restore tests passed");
