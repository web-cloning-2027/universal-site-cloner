import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const probes = [
  'https://myclickdealer.co.uk/home.php',
  'https://myclickdealer.co.uk/diary.php',
  'https://myclickdealer.co.uk/user_list.php',
  'https://myclickdealer.co.uk/onetrue_list.php',
  'https://myclickdealer.co.uk/sales_enquiries.php',
];
for (const u of probes) {
  try {
    const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = r ? r.status() : 0;
    const final = page.url();
    const onLogin = /sso|login|keycloak|id\.clickdealer/.test(final);
    const dom = await page.evaluate(() => {
      const title = document.title;
      const sidebarItems = [...document.querySelectorAll('aside a, #nav-cell a, ul#nav-list a, .menu a, .sidebar a')].slice(0, 10).map(a => a.textContent.trim());
      const hasMain = !!document.querySelector('main, #content, table');
      return { title, sidebarItems, hasMain };
    });
    console.log(`${status}  ${u}\n  final=${final} onLogin=${onLogin}\n  title="${dom.title}"\n  hasMain=${dom.hasMain}  sidebar=${JSON.stringify(dom.sidebarItems)}`);
  } catch (e) {
    console.log(`ERR  ${u}: ${e.message.slice(0, 80)}`);
  }
}
await browser.close();
