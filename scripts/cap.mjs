import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const urls = [
  "/home",
  "/user_list",
  "/onetrue_list",
  "/sales_enquiries",
  "/diary",
  "/aftersales_details/id-b8566e",
];
for (const u of urls) {
  try {
    const resp = await page.goto("http://localhost:5300" + u, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(800);
    const slug = u.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
    await page.screenshot({ path: `/tmp/clone-${slug}.png` });
    console.log(`${resp?.status() ?? 0}  ${u}  →  /tmp/clone-${slug}.png`);
  } catch (e) {
    console.log(`ERR  ${u}: ${e.message.slice(0,80)}`);
  }
}
await browser.close();
