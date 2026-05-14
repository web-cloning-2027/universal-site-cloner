/**
 * GridExtractor — closes GAP-07 (data grid capture), GAP-08 (per-column
 * input kind), GAP-13 (totals/filter rows), GAP-22 (near-duplicate
 * table merge).
 */

import type { Page } from "playwright";
import { TEXT_HELPERS } from "./text.js";
import type { DataGrid } from "../manifest.js";

export async function extractGrids(page: Page): Promise<DataGrid[]> {
  const script = `(() => {
    ${TEXT_HELPERS}
    const tables = [...document.querySelectorAll("main table")];
    return tables.map(t => {
      const headTh = [...t.querySelectorAll("thead th")];
      const cols = headTh.map(spaceyText);
      const bodyRows = [...t.querySelectorAll("tbody tr")];
      // First non-totals body row for kind capture.
      const firstDataRow = bodyRows.find(r => {
        const first = r.children[0];
        return first && !/^total/i.test((first.textContent || "").trim());
      });
      const columnKinds = firstDataRow
        ? [...firstDataRow.children].map(classifyInputKind)
        : [];
      const firstRows = bodyRows.slice(0, 3).map(r =>
        [...r.querySelectorAll("td")].map(spaceyText),
      );
      const hasTotals =
        !!t.querySelector("tfoot, tr.total, tr.totals, tr.totals-row, .row-totals");
      // Filter row: a tr above thead with inputs/selects, OR a row whose cells contain inputs/selects.
      const hasFilterRow = !!(
        t.querySelector("thead tr input, thead tr select, thead tr.filter, .filter-row") ||
        bodyRows.find(r => r.querySelector("input, select"))
      );
      return {
        columns: cols,
        columnKinds,
        rowCount: bodyRows.length,
        hasTotals,
        hasFilterRow,
        firstRows,
      };
    }).filter(g => g.columns.length > 0);
  })()`;
  const tables = (await page.evaluate(script)) as DataGrid[];
  return mergeNearDuplicates(tables);
}

/**
 * GAP-22: collapse tables whose column-set Jaccard ≥ 0.85 into a
 * single union table. Mirrors the audit-v7 Jaccard logic, applied at
 * capture time so the manifest already has the de-duped grid.
 */
function mergeNearDuplicates(tables: DataGrid[]): DataGrid[] {
  if (tables.length < 2) return tables;
  const merged: DataGrid[] = [];
  for (const t of tables) {
    const tSet = new Set(t.columns.filter(Boolean).map((c) => c.toLowerCase()));
    let idx = -1;
    for (let k = 0; k < merged.length; k++) {
      const m = merged[k]!;
      const mSet = new Set(
        m.columns.filter(Boolean).map((c) => c.toLowerCase()),
      );
      let inter = 0;
      for (const c of tSet) if (mSet.has(c)) inter++;
      const union = tSet.size + mSet.size - inter;
      const jaccard = union ? inter / union : 0;
      if (jaccard >= 0.85) {
        idx = k;
        break;
      }
    }
    if (idx === -1) {
      merged.push(t);
      continue;
    }
    // Union into the wider canonical table.
    const base = merged[idx]!;
    const newCols: string[] = [...base.columns];
    const newKinds = [...base.columnKinds];
    for (let i = 0; i < t.columns.length; i++) {
      const col = t.columns[i]!;
      if (!newCols.map((c) => c.toLowerCase()).includes(col.toLowerCase())) {
        newCols.push(col);
        newKinds.push(t.columnKinds[i] ?? "value");
      }
    }
    merged[idx] = {
      ...base,
      columns: newCols,
      columnKinds: newKinds,
      rowCount: Math.max(base.rowCount, t.rowCount),
      hasTotals: base.hasTotals || t.hasTotals,
      hasFilterRow: base.hasFilterRow || t.hasFilterRow,
    };
  }
  return merged;
}
