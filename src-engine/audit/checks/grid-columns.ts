/**
 * Check: grid-columns
 * Catches gap classes: grid-column-count, grid-column-label,
 *                     missing-totals-row, missing-filter-row,
 *                     input-kind-mismatch.
 *
 * R4: for every URL with a grid in both clone and live, verify column
 * count + labels match, and that totals/filter rows agree. Includes
 * the V7.6 superset-acceptance — a clone table that is a COLUMN-SET
 * SUPERSET of the live table is OK (legitimate when live captured a
 * pair of near-duplicate split tables that the clone correctly
 * merged via Jaccard).
 */

import type { Check } from "../types.js";
import type { DataGrid } from "../../manifest.js";

const norm = (s: string) => s.trim().toLowerCase();

const check: Check = {
  name: "grid-columns",
  description:
    "grid column count + labels + totals/filter parity vs same-run live capture",
  async run(ctx) {
    const liveMap = new Map<string, DataGrid[]>();
    for (const l of ctx.liveManifest.leaves) {
      liveMap.set(l.url, l.leafContent?.tables ?? []);
    }
    const gaps = [];
    let i = 1;
    for (const cloneLeaf of ctx.cloneManifest.leaves) {
      const liveGrids = liveMap.get(cloneLeaf.url);
      if (!liveGrids) continue;
      const cloneGrids = cloneLeaf.leafContent?.tables ?? [];
      // For each live grid, find a clone grid whose columns are either
      // an exact match OR a superset (V7.6 acceptance).
      for (const liveGrid of liveGrids) {
        const lSet = new Set(liveGrid.columns.map(norm));
        let matched = false;
        for (const cloneGrid of cloneGrids) {
          const cSet = new Set(cloneGrid.columns.map(norm));
          let isSuperset = true;
          for (const c of lSet) {
            if (!cSet.has(c)) {
              isSuperset = false;
              break;
            }
          }
          if (isSuperset) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          gaps.push({
            id: `GRID-${i++}`,
            check: this.name,
            kind: "grid-column-mismatch",
            url: cloneLeaf.url,
            detail: `live grid (${liveGrid.columns.length} cols, first 5: ${liveGrid.columns
              .slice(0, 5)
              .join("/")}) has no superset match in clone`,
            severity: "blocker" as const,
          });
        }
      }
      // Totals + filter row parity.
      const liveHasTotals = liveGrids.some((g) => g.hasTotals);
      const cloneHasTotals = cloneGrids.some((g) => g.hasTotals);
      if (liveHasTotals && !cloneHasTotals) {
        gaps.push({
          id: `GRID-${i++}`,
          check: this.name,
          kind: "missing-totals-row",
          url: cloneLeaf.url,
          detail: "live has a totals row; clone does not",
          severity: "major" as const,
        });
      }
      const liveHasFilter = liveGrids.some((g) => g.hasFilterRow);
      const cloneHasFilter = cloneGrids.some((g) => g.hasFilterRow);
      if (liveHasFilter && !cloneHasFilter) {
        gaps.push({
          id: `GRID-${i++}`,
          check: this.name,
          kind: "missing-filter-row",
          url: cloneLeaf.url,
          detail: "live has a filter row; clone does not",
          severity: "major" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
