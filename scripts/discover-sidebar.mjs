/**
 * SPA sidebar discovery — clicks every distinct nav item (a/button) in
 * the sidebar AND in the right-rail subnav, captures URLs reached.
 *
 * Output: docs/research/discovered-urls.json
 *
 * Generic. The selector is "elements inside <aside> / nav[role=navigation]
 * / [class*=sidebar]" — common idiom across SPA admin UIs.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

const statePath = resolve(homedir(), '.config/universal-site-cloner-sessions/clickdealer/state.json');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ storageState: statePath, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(25000);

const root = 'https://dms.myclickdealer.co.uk/';
await page.goto(root, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

const discovered = new Set();
const queue = [];

async function snapshotNavItems() {
  return page.evaluate(() => {
    const sidebar = document.querySelector('aside, nav[role="navigation"], [class*="sidebar" i]');
    if (!sidebar) return [];
    const items = [...sidebar.querySelectorAll('a, button, [role="link"], [role="button"]')];
    return items.map((el, idx) => ({
      idx,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tag: el.tagName.toLowerCase(),
      href: el.getAttribute('href') || '',
      hasChevron: !!el.querySelector('[class*="chevron" i], svg'),
    }));
  });
}

const seen = new Set();
async function clickByText(text) {
  // Find the sidebar item by visible text and click it.
  const handle = await page.evaluateHandle((needle) => {
    const sidebar = document.querySelector('aside, nav[role="navigation"], [class*="sidebar" i]');
    const items = sidebar ? [...sidebar.querySelectorAll('a, button, [role="link"], [role="button"]')] : [];
    return items.find((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().startsWith(needle));
  }, text);
  if (!handle) return false;
  const el = handle.asElement();
  if (!el) return false;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ delay: 30 }).catch(() => {});
  await page.waitForTimeout(800);
  return true;
}

// Round 1: top-level sidebar items
const top = await snapshotNavItems();
console.log('top-level sidebar items:', top.length);
const topTexts = [...new Set(top.map(t => t.text).filter(Boolean))];
console.log('  texts:', topTexts);

for (const text of topTexts) {
  if (!text) continue;
  await page.goto(root, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const ok = await clickByText(text);
  if (!ok) continue;
  await page.waitForTimeout(800);
  const url = page.url();
  if (url !== root && url.startsWith('https://dms.myclickdealer.co.uk/')) {
    discovered.add(url);
    console.log('  ', text, '→', url);
  }
  // Round 2: peek at expanded sidebar items (if click toggled a submenu)
  const expanded = await snapshotNavItems();
  for (const ex of expanded) {
    if (!topTexts.includes(ex.text) && ex.text) {
      // Sub-item: click it
      await clickByText(ex.text);
      await page.waitForTimeout(700);
      const subUrl = page.url();
      if (subUrl !== root && subUrl.startsWith('https://dms.myclickdealer.co.uk/')) {
        discovered.add(subUrl);
        console.log('     →', ex.text, '→', subUrl);
      }
      // Go back to the parent so we can pick the next sibling
      await page.goto(root, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await clickByText(text);
      await page.waitForTimeout(500);
    }
  }
}

const outPath = 'docs/research/discovered-urls.json';
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify([...discovered].sort(), null, 2));
console.log('\ndiscovered', discovered.size, 'unique URLs → ' + outPath);
await browser.close();
