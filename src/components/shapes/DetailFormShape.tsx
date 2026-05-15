/**
 * DetailFormShape — closes GAP-06 in the emitted output.
 *
 * Minimum-viable: renders each panel as a fieldset with its captured
 * fields. Per-field widget chosen from `kind`. Future sessions will
 * extend with the gold-standard's right-rail sub-nav, totals row,
 * submit-action footer, etc. — see notes/02-lessons-from-clickdealer.md.
 */

type Field = {
  label: string;
  kind: string;
  options?: string[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
};
type Panel = { label: string; fields: Field[] };

function Widget({ field }: { field: Field }) {
  const cls = "h-8 px-2 rounded border border-gray-300 bg-white text-sm";
  switch (field.kind) {
    case "checkbox":
      return <input type="checkbox" className="size-4" defaultChecked={!!field.defaultValue} />;
    case "radio":
      return <input type="radio" className="size-4" />;
    case "select":
      return (
        <select className={cls}>
          {(field.options ?? ["—"]).map((o, i) => <option key={i}>{o}</option>)}
        </select>
      );
    case "textarea":
      return <textarea className="min-h-[80px] rounded border border-gray-300 p-2 text-sm" defaultValue={field.defaultValue} />;
    case "date":
      return <input type="date" className={cls} defaultValue={field.defaultValue} />;
    case "number":
      return <input type="number" className={cls} defaultValue={field.defaultValue} />;
    default:
      return <input type="text" className={cls} defaultValue={field.defaultValue} placeholder={field.placeholder} />;
  }
}

export function DetailFormShape({
  content,
}: {
  content: { panels?: Panel[]; h1?: string };
}) {
  return (
    <main className="p-6 space-y-5 bg-[color:var(--page,_white)] flex-1">
      {content.h1 ? <h1 className="text-2xl font-semibold">{content.h1}</h1> : null}
      {(content.panels ?? []).map((p, pi) => (
        <section key={pi} className="dms-panel-outer rounded border border-gray-200 bg-white p-4">
          {p.label ? <h2 className="text-sm font-semibold text-gray-800 mb-3">{p.label}</h2> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {p.fields.map((f, fi) => (
              <label key={fi} className="flex flex-col gap-1 text-xs text-gray-600">
                <span>{f.label}{f.required ? " *" : ""}</span>
                <Widget field={f} />
              </label>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
