# Shape components (templates)

These `.template.tsx` files are CONSUMED by the renderer's `Scaffold`
at clone time. They get copied into `<wet-test-output>/src/components/shapes/`
verbatim, so they must be self-contained and compile inside the
generated Next.js scaffold.

One file per leaf shape (per GAP-05's enum):

- `DetailFormShape.template.tsx`  — multi-section form (GAP-06)
- `DataGridShape.template.tsx`    — data grid w/ totals, filter, per-column kind (GAP-07, GAP-08, GAP-13)
- `DashboardShape.template.tsx`   — KPI tiles + secondary grids
- `WizardShape.template.tsx`      — stepper-driven flow
- `ViewerShape.template.tsx`      — read-only / unclassified fallback
- `BannerStrip.template.tsx`      — page-info banner row (GAP-12)

Each accepts `{ content: LeafContent }`. The `LeafContent` type comes
from the generated scaffold's data/types — the renderer also writes
that types module.
