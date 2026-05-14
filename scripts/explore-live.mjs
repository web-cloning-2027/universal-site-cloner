import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('https://dms.myclickdealer.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1500);

// Enumerate every anchor / link element in the sidebar + main area
const linkSurvey = await page.evaluate(() => {
  // ALL clickable a/button/[role=link]
  const els = [...document.querySelectorAll('a[href], [role="link"]')];
  return els.map(el => ({
    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    href: el.getAttribute('href') || el.getAttribute('data-href') || '',
    inSidebar: !!el.closest('aside, nav[aria-label*="Primary" i], [class*="sidebar" i]'),
  })).filter(l => l.href && l.href !== '#');
});
console.log('total links:', linkSurvey.length);
console.log('sidebar links:', linkSurvey.filter(l => l.inSidebar).length);
console.log('sample:', linkSurvey.slice(0, 30));

// Try a handful of expected modern routes from the gold-standard clone
console.log('\n=== probing expected routes ===');
const probes = ['/home', '/diary', '/stock', '/stock/list-vehicles', '/customers', '/sales-enquiries', '/dealers/users', '/click-leads', '/reports', '/adverts'];
for (const p of probes) {
  const u = 'https://dms.myclickdealer.co.uk' + p;
  try {
    const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 12000 });
    const status = r ? r.status() : 0;
    const final = page.url();
    console.log(`  ${p} → ${status} (final=${final})`);
  } catch (e) {
    console.log(`  ${p} → ERR ${e.message.slice(0, 60)}`);
  }
}
await browser.close();
