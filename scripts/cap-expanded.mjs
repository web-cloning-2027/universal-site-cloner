import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();
const urls = ["/user_list", "/onetrue_list", "/sales_enquiries"];
for (const u of urls) {
  await page.goto("http://localhost:5300" + u, { waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(500);
  // Expand details
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "true"));
  });
  await page.waitForTimeout(200);
  const slug = u.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  await page.screenshot({ path: `/tmp/clone-expanded-${slug}.png` });
  console.log("captured:", slug);
}
await browser.close();
