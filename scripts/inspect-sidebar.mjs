import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('https://dms.myclickdealer.co.uk/', { waitUntil: 'domcontentloaded', timeout: 25000 });
// Wait LONGER for the sidebar to populate; scroll inside the sidebar to surface lazy items
await page.waitForTimeout(5000);
// Find the actual sidebar element
const sidebarSel = await page.evaluate(() => {
  const candidates = [
    ...document.querySelectorAll('aside, nav, [class*="sidebar" i]'),
  ];
  const c = candidates.find(c => {
    const r = c.getBoundingClientRect();
    return r.left < 50 && r.width > 100 && r.width < 350 && r.height > 400;
  });
  if (!c) return null;
  return {
    tag: c.tagName,
    cls: c.className.slice(0, 100),
    rect: { x: c.getBoundingClientRect().left, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height },
    items: [...c.querySelectorAll('a, button, [role="link"], [role="button"]')].map(el => ({
      tag: el.tagName,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      href: el.getAttribute('href') || '',
    })),
  };
});
console.log(JSON.stringify(sidebarSel, null, 2));
await browser.close();
