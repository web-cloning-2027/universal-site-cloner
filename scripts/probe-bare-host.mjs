import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
const probes = [
  'https://myclickdealer.co.uk/home.php',
  'https://myclickdealer.co.uk/diary.php',
  'https://myclickdealer.co.uk/user_list.php',
  'https://myclickdealer.co.uk/onetrue_list.php',
  'https://myclickdealer.co.uk/',
];
for (const u of probes) {
  try {
    const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const status = r ? r.status() : 0;
    const final = page.url();
    const onLogin = /sso|login|keycloak|auth\//.test(final);
    const title = await page.title();
    console.log(`  ${u} → ${status} final=${final} title="${title}" onLogin=${onLogin}`);
  } catch (e) {
    console.log(`  ${u} → ERR ${e.message.slice(0, 80)}`);
  }
}
await browser.close();
