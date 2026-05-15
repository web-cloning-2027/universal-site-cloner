/**
 * ActionMenuProbe — closes GAP-11 (per-row action menu enumeration).
 *
 * Locates likely action-menu triggers (kebab/dots icon buttons,
 * dropdown toggles inside table rows), opens each one, captures the
 * resulting menu items, and closes it. Records the trigger label and
 * the item list for each menu.
 *
 * Generic: based on ARIA semantics and common dropdown idioms, not on
 * any site's class names.
 */

import type { Page } from "playwright";
import type { ActionMenu } from "../manifest.js";

const TRIGGER_SELECTOR = [
  "[aria-haspopup='menu']",
  "[data-bs-toggle='dropdown']",
  "button[aria-label*='actions' i]",
  "button[aria-label*='more' i]",
].join(", ");

export async function probeActionMenus(page: Page): Promise<ActionMenu[]> {
  const triggers = await page.$$(TRIGGER_SELECTOR);
  if (triggers.length === 0) return [];

  const out: ActionMenu[] = [];
  const seenMenus = new Set<string>();
  for (const trigger of triggers) {
    const label =
      (await trigger.getAttribute("aria-label")) ||
      ((await trigger.textContent()) || "").trim();
    if (!label) continue;
    try {
      await trigger.click({ timeout: 1500 });
      await page.waitForTimeout(80);
      const items = await page.$$eval(
        "[role='menuitem'], .dropdown-menu li > a, .dropdown-menu li > button",
        (els) =>
          els.map((e) => {
            const text = (e.textContent || "").trim();
            const href = (e as HTMLAnchorElement).href || undefined;
            return { label: text, destination: href };
          }),
      );
      // Close the menu by clicking elsewhere.
      await page.keyboard.press("Escape").catch(() => {});

      if (items.length === 0) continue;
      const sig = `${label}::${items.map((i) => i.label).join("|")}`;
      if (seenMenus.has(sig)) continue;
      seenMenus.add(sig);
      out.push({ trigger: label, items });
    } catch {
      // Menu didn't open — skip and continue.
    }
  }
  return out;
}
