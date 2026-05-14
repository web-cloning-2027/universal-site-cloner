/**
 * WizardShape — stepper-driven flow. Minimum-viable renders each panel
 * as a numbered step + back/next nav. Future sessions add per-step
 * validation, summary screen, and Step indicators from `wizardSteps`.
 */

type Field = { label: string; kind: string };
type Step = { label: string; fields: Field[] };

import { DetailFormShape } from "./DetailFormShape.template.js";

export function WizardShape({
  content,
}: {
  content: { h1?: string; panels?: Step[] };
}) {
  const steps = content.panels ?? [];
  return (
    <main className="p-6 space-y-5 bg-[color:var(--page,_white)] flex-1">
      {content.h1 ? <h1 className="text-2xl font-semibold">{content.h1}</h1> : null}
      <ol className="flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="size-5 rounded-full bg-gray-800 text-white flex items-center justify-center">{i + 1}</span>
            <span>{s.label || `Step ${i + 1}`}</span>
            {i < steps.length - 1 ? <span className="text-gray-400">→</span> : null}
          </li>
        ))}
      </ol>
      <DetailFormShape content={{ panels: steps }} />
      <div className="flex gap-2">
        <button type="button" className="px-3 py-1.5 rounded bg-gray-200 text-sm">Back</button>
        <button type="button" className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm">Next</button>
      </div>
    </main>
  );
}
