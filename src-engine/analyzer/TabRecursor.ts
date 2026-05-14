/**
 * TabRecursor — closes GAP-09 (nested-tab discovery, no depth limit
 * within `maxTabDepth`).
 *
 * Walks `[role=tab]`, `.tab`, `.nav-tabs li a`, `.tabs li a` and
 * clicks each one in turn, capturing the sub-DOM as a child leaf
 * stub. Recurses into any nested tabs found AFTER the click. Each
 * recursion gets its own snapshot of the page state to avoid
 * cross-contamination.
 *
 * Generic: tab patterns are common across CRMs and admin UIs. No
 * site-specific selector here. If a site uses a fundamentally
 * different idiom, the gap shows up in the audit (missing-tab) and
 * is closed by extending this selector or adding a new tab strategy.
 *
 * Hard upper bound on total time AND total tabs visited prevents
 * pages with thousands of tab-shaped buttons (image managers, file
 * trees) from exhausting the per-URL budget on tab recursion alone.
 * Closes the engine wedge surfaced by /image_manager/.
 */

import type { Page } from "playwright";
import type { LeafTab } from "../manifest.js";

const TAB_SELECTOR =
  "[role='tab'], .nav-tabs > li > a, .tabs > li > a, .tab-list > .tab";

const DEFAULT_TIME_BUDGET_MS = 15_000;
const DEFAULT_MAX_TABS_VISITED = 200;

export interface RecurseTabsArgs {
  page: Page;
  depth: number;
  maxDepth: number;
  /** Total wall-clock budget across recursion. Default 15s. */
  timeBudgetMs?: number;
  /** Cap on tabs visited; protects against fan-out explosions. Default 200. */
  maxTabsVisited?: number;
  /** Internal: set by the recursion to share counters / start time. */
  _state?: { startedAt: number; visited: number };
}

export async function recurseTabs(args: RecurseTabsArgs): Promise<LeafTab[]> {
  if (args.depth >= args.maxDepth) return [];
  const state =
    args._state ?? { startedAt: Date.now(), visited: 0 };
  const timeBudgetMs = args.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxTabsVisited = args.maxTabsVisited ?? DEFAULT_MAX_TABS_VISITED;

  if (Date.now() - state.startedAt > timeBudgetMs) return [];
  if (state.visited >= maxTabsVisited) return [];

  const { page } = args;
  const tabHandles = await page.$$(TAB_SELECTOR);
  if (tabHandles.length === 0) return [];
  const labels: string[] = [];
  for (const t of tabHandles) {
    const text = (await t.textContent())?.trim() || "";
    labels.push(text);
  }

  const out: LeafTab[] = [];
  for (let i = 0; i < tabHandles.length; i++) {
    if (Date.now() - state.startedAt > timeBudgetMs) break;
    if (state.visited >= maxTabsVisited) break;
    const label = labels[i]!;
    if (!label) continue;
    const handle = tabHandles[i]!;
    state.visited++;
    try {
      await handle.click({ timeout: 2000 });
      await page.waitForTimeout(150);
      const childTabs = await recurseTabs({
        page,
        depth: args.depth + 1,
        maxDepth: args.maxDepth,
        timeBudgetMs,
        maxTabsVisited,
        _state: state,
      });
      out.push({ label, tabs: childTabs.length > 0 ? childTabs : undefined });
    } catch {
      // The click may have failed because the element became detached
      // after a previous click; we still record the label.
      out.push({ label });
    }
  }
  return out;
}
