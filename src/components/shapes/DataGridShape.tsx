/**
 * DataGridShape — closes GAP-07/08/13 in the rendered output.
 *
 * Per-column rendering uses `columnKinds[ci]` (live capture) plus a
 * heuristic for known checkbox-shaped labels (Add Vehicle, Confirm
 * Sale, etc.). The heuristic is portable across CRMs — it matches
 * action-verb-style headers.
 *
 * The renderer (Scaffold) writes mock rows directly into the leaf
 * component, so this shape only renders what it's given.
 */

type Cell = string;
type ColumnKind =
  | "checkbox"
  | "radio"
  | "select"
  | "date"
  | "time"
  | "number"
  | "text"
  | "textarea"
  | "value";

type Grid = {
  columns: string[];
  columnKinds?: ColumnKind[];
  rowCount: number;
  hasTotals: boolean;
  hasFilterRow: boolean;
  firstRows?: Cell[][];
};

const CHECKBOX_HEAD_RE =
  /^(add\s+\w+|confirm\s+\w+|change\s+\w+|cancel\s+\w+|two[-\s]?factor|active\s+\w+|default\s+\w+|performance\s+\w+|block\b|hide\s+\w+|gallery|reset)\b/i;

function effectiveKind(label: string, captured?: ColumnKind): ColumnKind {
  if (captured && captured !== "value" && captured !== "text") return captured;
  if (CHECKBOX_HEAD_RE.test(label.toLowerCase())) return "checkbox";
  return captured ?? "value";
}

export function DataGridShape({
  content,
}: {
  content: { tables?: Grid[]; title?: string; h1?: string };
}) {
  return (
    <main className="p-6 space-y-5 bg-[color:var(--page,_white)] flex-1">
      {content.h1 ? <h1 className="text-2xl font-semibold">{content.h1}</h1> : null}
      {(content.tables ?? []).map((g, ti) => (
        <section key={ti} className="dms-panel-outer overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-white text-[11px] uppercase tracking-wide">
              <tr>
                {g.columns.map((c, i) => (
                  <th key={i} className="text-left px-3 py-2 font-bold whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(g.firstRows ?? []).map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-gray-50">
                  {g.columns.map((col, ci) => {
                    const cell = row[ci] ?? "";
                    const kind = effectiveKind(col, g.columnKinds?.[ci]);
                    if (kind === "checkbox") {
                      return (
                        <td key={ci} className="px-3 py-2">
                          <input type="checkbox" defaultChecked={(ri + ci) % 2 === 0} className="size-4" aria-label={col} />
                        </td>
                      );
                    }
                    if (kind === "radio") {
                      return (
                        <td key={ci} className="px-3 py-2">
                          <input type="radio" name={`row-${ri}-col-${ci}`} defaultChecked={ri === 0} className="size-4" />
                        </td>
                      );
                    }
                    if (kind === "select") {
                      return (
                        <td key={ci} className="px-3 py-2">
                          <select className="h-7 px-2 rounded border border-gray-300 bg-white text-xs">
                            <option>{cell || "—"}</option>
                          </select>
                        </td>
                      );
                    }
                    return <td key={ci} className="px-3 py-2">{cell}</td>;
                  })}
                </tr>
              ))}
            </tbody>
            {g.hasTotals ? (
              <tfoot>
                <tr className="border-t border-gray-300 bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-gray-700" colSpan={Math.max(1, g.columns.length - 1)}>Total</td>
                  <td className="px-3 py-2 text-right">—</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </section>
      ))}
    </main>
  );
}
