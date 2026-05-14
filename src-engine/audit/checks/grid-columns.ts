/**
 * Check: grid-columns
 * Catches gap classes: grid-column-count, grid-column-label, missing-totals-row,
 *                     missing-filter-row, input-kind-mismatch.
 *
 * For every URL with a grid in both clone and gold, verify column
 * count + labels match, and that totals/filter rows agree. Includes
 * the V7.6 superset-acceptance (clone wider than gold if columns are
 * a superset, see GAP-22).
 */

import type { Check } from "../types.js";
import type { DataGrid } from "../../manifest.js";

const norm = (s: string) => s.trim().toLowerCase();

const check: Check = {
  name: "grid-columns",
  description: "grid column count + labels + totals/filter parity (V7 Gate 4 analog)",
  async run(ctx) {
    if (!ctx.goldManifest) return [];
    const goldMap = new Map<string, DataGrid[]>();
    for (const l of ctx.goldManifest.leaves) {
      goldMap.set(l.url, l.leafContent?.tables ?? []);
    }
    const gaps = [];
    let i = 1;
    for (const cloneLeaf of ctx.cloneManifest.leaves) {
      const goldGrids = goldMap.get(cloneLeaf.url);
      if (!goldGrids) continue;
      const cloneGrids = cloneLeaf.leafContent?.tables ?? [];
      // For each gold grid, find a clone grid whose columns are an exact match
      // OR a superset (V7.6 acceptance).
      for (const goldGrid of goldGrids) {
        const gSet = new Set(goldGrid.columns.map(norm));
        let matched = false;
        for (const cloneGrid of cloneGrids) {
          const cSet = new Set(cloneGrid.columns.map(norm));
          let isSuperset = true;
          for (const c of gSet) {
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
            detail: `gold grid (${goldGrid.columns.length} cols, first 5: ${goldGrid.columns.slice(0, 5).join("/")}) has no superset match in clone`,
            severity: "blocker" as const,
          });
        }
      }
      // Totals + filter row parity.
      const goldHasTotals = goldGrids.some((g) => g.hasTotals);
      const cloneHasTotals = cloneGrids.some((g) => g.hasTotals);
      if (goldHasTotals && !cloneHasTotals) {
        gaps.push({
          id: `GRID-${i++}`,
          check: this.name,
          kind: "missing-totals-row",
          url: cloneLeaf.url,
          detail: "gold has a totals row; clone does not",
          severity: "major" as const,
        });
      }
      const goldHasFilter = goldGrids.some((g) => g.hasFilterRow);
      const cloneHasFilter = cloneGrids.some((g) => g.hasFilterRow);
      if (goldHasFilter && !cloneHasFilter) {
        gaps.push({
          id: `GRID-${i++}`,
          check: this.name,
          kind: "missing-filter-row",
          url: cloneLeaf.url,
          detail: "gold has a filter row; clone does not",
          severity: "major" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
