/**
 * Check: empty-leafcontent
 * Catches gap class: analyzer captured nothing meaningful for a leaf
 * that the engine classified as renderable (i.e. not endpoint /
 * section-landing). When a leaf has 0 panels, 0 tables, 0 buttons in
 * the LIVE manifest, the extractor's selectors aren't reaching the
 * page's actual content — almost always because the analyzer's
 * scoping (e.g. `main fieldset`) doesn't match the live DOM (e.g.
 * pre-HTML5 PHP sites with no <main>).
 *
 * Generic across sites: every cloning engine that promises "every
 * non-endpoint leaf has captured content" benefits from this check.
 *
 * R10: this check exists so a regression of the selector-scope class
 * surfaces in audit immediately, not after a manual eyeball.
 */

import type { Check } from "../types.js";

const check: Check = {
  name: "empty-leafcontent",
  description:
    "non-endpoint live leaf with zero panels + zero tables + zero buttons (extractor selector failure)",
  async run(ctx) {
    const gaps = [];
    let i = 1;
    for (const leaf of ctx.liveManifest.leaves) {
      const k = leaf.kind || leaf.leafContent?.shape;
      if (k === "endpoint" || k === "section-landing") continue;
      const lc = leaf.leafContent;
      if (!lc) continue;
      const panels = (lc.panels || []).length;
      const tables = (lc.tables || []).length;
      const buttons = (lc.buttons || []).length;
      if (panels + tables + buttons === 0) {
        gaps.push({
          id: `EMPTY-${i++}`,
          check: this.name,
          kind: "empty-leafcontent",
          url: leaf.url,
          detail:
            `LIVE leaf captured no panels/tables/buttons. ` +
            `Analyzer extractor selectors didn't reach page content. ` +
            `Likely cause: selector scope (e.g. 'main X') doesn't match this site's DOM root.`,
          severity: "blocker" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
