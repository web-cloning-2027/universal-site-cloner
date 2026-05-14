/**
 * classifyShape — closes GAP-05 (leaf-shape classification).
 *
 * Deterministic first-pass heuristic. Future revisions may delegate
 * to `judge({ prompt: "classify-leaf-shape", input })` when the
 * heuristic returns "ambiguous"; this is a PROMPT FIX that gets added
 * the first time the heuristic is wrong on a real leaf.
 *
 * Resolution rules (later wins on overlap):
 *   - has `<form>` with ≥ 5 input fields and ≤ 2 tables → "form"
 *   - has ≥ 1 table with ≥ 5 columns and ≤ 4 form fields → "grid"
 *   - has many KPI tiles / cards and few or no tables/forms → "dashboard"
 *   - has stepper / progress / next-prev buttons → "wizard"
 *   - else: "viewer"
 *
 * Each rule maps directly to one of the shapes the renderer knows
 * how to emit (see src-engine/renderer/shapes/).
 */

import type { DataGrid, FormSection, Button, LeafShape } from "../manifest.js";

export interface ClassifyShapeArgs {
  url: string;
  panels: FormSection[];
  tables: DataGrid[];
  buttons: Button[];
  shapeOverrides?: { pattern: string; shape: string }[];
}

export async function classifyShape(
  args: ClassifyShapeArgs,
): Promise<LeafShape> {
  for (const o of args.shapeOverrides ?? []) {
    if (new RegExp(o.pattern).test(args.url)) {
      return o.shape as LeafShape;
    }
  }
  const fieldCount = args.panels.reduce((a, p) => a + p.fields.length, 0);
  const widestGridCols = Math.max(0, ...args.tables.map((t) => t.columns.length));
  const hasWizard = args.buttons.some((b) =>
    /^(next|back|previous|step|finish)$/i.test(b.label.trim()),
  );

  if (hasWizard) return "wizard";
  if (fieldCount >= 5 && args.tables.length <= 2) return "form";
  if (widestGridCols >= 5 && fieldCount <= 4) return "grid";
  if (args.panels.length === 0 && args.tables.length === 0) return "viewer";
  // Mixed page with both forms and grids — call it dashboard.
  if (fieldCount > 0 && args.tables.length > 0) return "dashboard";
  return "viewer";
}
