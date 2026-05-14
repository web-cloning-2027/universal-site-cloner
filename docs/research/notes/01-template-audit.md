## 1. TEMPLATE-AUDIT (notes/01-template-audit.md)

### Original Template Inventory

**File Structure**
- `README.md` — Marketing copy, 156 lines. Accurate, pitch-focused. Describes 5-phase pipeline clearly. **Strength**: clear voice and pedagogical structure.
- `AGENTS.md` — 66 lines. Agent instructions, code style (TS strict, PascalCase, Tailwind, mobile-first). **Strength**: enforces good discipline. **Weakness**: no mention of auth, multi-section forms, or data grids.
- `package.json` — Next.js 16, React 19, Tailwind v4, shadcn/ui, lucide-react. **Strength**: modern, clean stack. **Weakness**: no playwright, no @anthropic-ai/sdk, no ajv for schema validation.
- `.claude/skills/clone-website/SKILL.md` — 473 lines. Five-phase orchestrator (Recon → Foundation → Component Specs → Parallel Build → Assembly & QA). **Strength**: modular, proven on marketing sites. **Weakness**: assumes all URLs are visible, no auth handoff, no recursive tab discovery, no parallel crawler pool.

**CLI/Agent Command Files**
- `.cursor/commands/clone-website.md`, `.windsurf/workflows/clone-website.md`, etc. — Platform-specific sync'd copies of the skill. **Strength**: multi-platform support via sync scripts. **Weakness**: relies on `sync-skills.mjs` and `sync-agent-rules.sh` to stay in sync; errors here break all platforms.

**Documentation**
- `docs/research/INSPECTION_GUIDE.md` — Five-phase visual audit guide (screenshots, design tokens, components, layout, tech stack). **Strength**: thorough, teaches reverse-engineering principles. **Weakness**: no guidance on form field extraction, table column semantics, nested tabs, or mock-data classification.

**Source Code**
- `src/app/layout.tsx`, `src/app/page.tsx` — Standard Next.js App Router boilerplate. **Strength**: clean, minimal. **Weakness**: no sidebar, no section nav, no auth context.
- `src/components/ui/button.tsx` — Single shadcn primitive, Radix-based. **Strength**: extensible via `shadcn add`. **Weakness**: no pre-built form shapes, grids, or dashboards.
- `src/lib/utils.ts` — `cn()` utility (classnames merge). **Strength**: lightweight. **Weakness**: no date formatting, currency formatting, or mock-data pools.
- `package.json` — Missing: @anthropic-ai/sdk, ajv, playwright, pngjs/pixelmatch, fs-extra for file ops.

**Weaknesses for Enterprise Cloning**
1. **No auth strategy abstraction** — assumes public sites; ClickDealer requires Keycloak handoff, cookie jar persistence, 401-refresh mid-crawl.
2. **No deep navigation crawler** — walks visible links only; enterprise apps hide URLs behind chevrons, action menus, modals, XHR calls.
3. **No per-leaf content capture** — captures visual shape (sections, buttons) but not field-level metadata (label, kind, options, defaults, constraints).
4. **No form field parser** — doesn't extract `<select>` options, `<input type="...">`, `<textarea>` constraints, `<label for="">` associations.
5. **No table column analyzer** — doesn't classify columns by semantics (person, vehicle, currency, date, status); synth data becomes generic nonsense.
6. **No nested-tab recursion** — assumes flat page structures; enterprise detail pages have tabs-within-tabs 3+ levels deep.
7. **No manifest schema** — no structured output that describes what was captured (URL, shape, fields, columns, actions, tabs); hard to rebuild from this.
8. **No audit gates** — visual inspection only; no programmatic verification of field count parity, column labels, totals rows, banner presence, mock-data appropriateness.
9. **No LLM judgment dispatcher** — no way for autonomy loops to decide ambiguous cases (section redesign vs. gap?) without human input.
10. **No anti-pattern tracking** — regressions silently recur; no monotonic-grow ban list to prevent re-introducing old bugs.

**What the Template IS Good At**
- Multi-platform sync (Claude Code, Cursor, Windsurf, Copilot, etc.) — the sync infrastructure is solid.
- Modular 5-phase prose structure — each phase maps cleanly to agent responsibilities.
- shadcn/ui + Tailwind v4 foundation — proven, modern, responsive.
- Design token extraction for marketing sites — color, typography, spacing captured well from static pages.
- Asset download and icon extraction — public URLs and SVG conversion work.

---

