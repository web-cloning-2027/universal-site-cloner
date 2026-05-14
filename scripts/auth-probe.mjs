import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
if (!existsSync(statePath)) { console.error('NO_STATE'); process.exit(2); }
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// Probe an actual live URL (PHP form, deep authenticated content) — not the clone path.
const targets = [
  'https://dms.myclickdealer.co.uk/user_list.php',
  'https://dms.myclickdealer.co.uk/home.php',
];
const results = [];
for (const target of targets) {
  let r = { url: target, status: 0, finalUrl: '', sidebarPresent: false, hasContent: false, redirectedToLogin: false, error: null };
  try {
    const resp = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20000 });
    r.status = resp ? resp.status() : 0;
    r.finalUrl = page.url();
    r.redirectedToLogin = /sso|login|keycloak|auth\//.test(r.finalUrl);
    await page.waitForTimeout(500);
    const dom = await page.evaluate(() => {
      const sidebar = document.querySelector('aside, nav[aria-label*="Primary" i], #sidebar, .sidebar, [class*="sidebar" i], #menu, ul.nav');
      const sidebarText = sidebar ? (sidebar.textContent || '').toLowerCase() : '';
      return {
        sidebarPresent: !!sidebar && (sidebarText.includes('home') || sidebarText.includes('stock') || sidebarText.includes('dealers') || sidebarText.includes('reports')),
        hasContent: document.querySelectorAll('main, table, form, .panel-outer, .dms-panel-outer').length > 0,
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim() || '',
      };
    });
    r = { ...r, ...dom };
  } catch (e) { r.error = e.message; }
  results.push(r);
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
