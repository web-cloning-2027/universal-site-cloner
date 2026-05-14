/**
 * R7b dual-domain handoff for ClickDealer.
 *
 * The clone target spans TWO sites with different auth:
 *   - dms.myclickdealer.co.uk    NextAuth (modern UI, slim surface)
 *   - myclickdealer.co.uk         Keycloak (id.clickdealer.co.uk SSO,
 *                                 legacy PHP surface, ~414 routes)
 *
 * Roy logs into BOTH in the same browser session. state.json captures
 * both cookie sets. Same R7b one-shot rule per site.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const sentinel = '/tmp/auth-handoff-ready';
mkdirSync(dirname(statePath), { recursive: true });
if (existsSync(sentinel)) rmSync(sentinel);

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({
  // Preload the NextAuth state Roy already established
  storageState: existsSync(statePath) ? statePath : undefined,
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
console.log('[handoff] step 1 — verifying NextAuth state on dms.myclickdealer.co.uk');
await page.goto('https://dms.myclickdealer.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1000);

console.log('[handoff] step 2 — opening legacy myclickdealer.co.uk/home.php for Keycloak login');
await page.goto('https://myclickdealer.co.uk/home.php', { waitUntil: 'domcontentloaded', timeout: 30000 });
// If redirected to Keycloak (id.clickdealer.co.uk), Roy logs in there.
console.log('[handoff] current url after step 2 navigation:', page.url());

console.log('[handoff] waiting for ' + sentinel + ' (Roy completes the legacy login)');
const start = Date.now();
const maxWaitMs = 30 * 60 * 1000;
while (!existsSync(sentinel)) {
  if (Date.now() - start > maxWaitMs) { console.error('[handoff] timeout'); await browser.close(); process.exit(2); }
  await new Promise((r) => setTimeout(r, 2000));
}

// Save combined state
await ctx.storageState({ path: statePath });
console.log('[handoff] state.json SAVED (combined NextAuth + Keycloak)');

// Probes — informational only
for (const u of [
  'https://dms.myclickdealer.co.uk/',
  'https://myclickdealer.co.uk/home.php',
  'https://myclickdealer.co.uk/user_list.php',
]) {
  try {
    const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const s = r ? r.status() : 0;
    const final = page.url();
    const onLogin = /sso|login|keycloak|auth\//.test(final);
    console.log(`[probe] ${u} → ${s} final=${final} onLogin=${onLogin}`);
  } catch (e) { console.log(`[probe] ${u} → ERR ${e.message.slice(0, 80)}`); }
}
await browser.close();
rmSync(sentinel, { force: true });
console.log('[handoff] done');
