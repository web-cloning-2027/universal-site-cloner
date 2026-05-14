import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(15000);

const probes = [
  '/', '/home', '/stock', '/stock/lookup/add', '/stock/list-vehicles',
  '/customers', '/sales-enquiries', '/dealers', '/dealers/users',
  '/click-leads', '/click-leads/performance-dashboard', '/reports', '/adverts',
  '/diary', '/accounts', '/after-sales', '/parts', '/marketing',
  '/most-visited', '/documents', '/reminders', '/notifications', '/extra-resources',
];
const results = [];
for (const p of probes) {
  const u = 'https://dms.myclickdealer.co.uk' + p;
  try {
    const r = await page.goto(u, { waitUntil: 'load', timeout: 12000 }).catch(() => null);
    const status = r ? r.status() : 0;
    const final = page.url();
    results.push({ path: p, status, final });
  } catch (e) {
    results.push({ path: p, status: 0, error: e.message.slice(0, 80) });
  }
  await page.waitForTimeout(150);
}
for (const r of results) {
  console.log(`${r.status || 'ERR'}\t${r.path}\t→ ${r.final || r.error || ''}`);
}
await browser.close();
