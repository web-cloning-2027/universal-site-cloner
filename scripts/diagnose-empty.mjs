import { chromium } from "playwright";
import { homedir } from "node:os";
import { resolve } from "node:path";
const statePath = resolve(homedir(), ".config/universal-site-cloner-sessions/clickdealer/state.json");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const { extractForm } = await import("/Users/roysharf/Desktop/websitr cloaning/new-cloner-build/universal-site-cloner/src-engine/analyzer/FormExtractor.ts");
const { extractGrids } = await import("/Users/roysharf/Desktop/websitr cloaning/new-cloner-build/universal-site-cloner/src-engine/analyzer/GridExtractor.ts");
const { extractBanners } = await import("/Users/roysharf/Desktop/websitr cloaning/new-cloner-build/universal-site-cloner/src-engine/analyzer/BannerExtractor.ts");
const { probeButtons } = await import("/Users/roysharf/Desktop/websitr cloaning/new-cloner-build/universal-site-cloner/src-engine/analyzer/ButtonProbe.ts");
await page.goto("https://myclickdealer.co.uk/user_list.php", { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(800);
const [panels, tables, banners, buttons] = await Promise.all([
  extractForm(page),
  extractGrids(page),
  extractBanners(page),
  probeButtons(page),
]);
console.log("panels:", panels.length, "first labels:", panels.slice(0,3).map(p => p.label));
console.log("tables:", tables.length, "first cols:", tables[0]?.columns?.slice(0,5));
console.log("banners:", banners.length);
console.log("buttons:", buttons.length, "first:", buttons.slice(0,3).map(b => b.label));
await browser.close();
