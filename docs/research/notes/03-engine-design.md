## 4. ENGINE-MODULE-DESIGN (notes/03-engine-design.md)

### Proposed Modular Architecture

#### Core Modules (src/)

**src/auth/**
- `AuthStrategy.ts` — interface: `authenticate() → Promise<{cookies, localStorage, headers?}>` and `isExpired() → boolean` and `refresh() → Promise<void>`
- `NoAuth.ts` — implements AuthStrategy (noop, public sites)
- `BasicAuth.ts` — HTTP Basic (username:password → base64 header)
- `CookieJarAuth.ts` — file-persisted state.json (`~/.config/clickdms-session/state.json`), auto-refresh on 401
- `KeycloakHandoffAuth.ts` — one-shot headful login (Playwright opens window, user logs in, engine captures auth state, closes window, resumes headless). Handles OIDC token refresh.
- Public interface: `authenticate({ strategy: "keycloak" | "cookie-jar" | "none", ...config })` → Promise<AuthContext>

**src/crawler/**
- `Queue.ts` — BFS task queue (URLPattern object: url, canonicalId, parentUrl, discoveredVia: "link"|"button"|"xhr"|"pattern"). Persistent queue state (every 5s debounced), resumable from checkpoint.
- `Navigator.ts` — Playwright context pool (default 3 workers), rate-limit (1 nav/500ms per worker), manages page lifecycle, catches 401/404, retries with exponential backoff (up to 5×).
- `discovery.ts` — extracts URLs from: `<a href>` links, `<button onclick>` handlers (click + extract), chevron flyouts (click to expand), form action attributes, xhr/fetch request URLs (via devtools protocol monitoring). Dedupes by `:id` collapse per site config.
- Public interface: `crawl({ startUrls, navigator, queue, authContext, config }) → AsyncIterator<{url, status, dom, screenshot, blockers?}>` yields each captured page

**src/analyzer/**
- `LeafAnalyzer.ts` — orchestrates field extraction: calls sub-analyzers (FormExtractor, GridExtractor, TabRecursor, etc.) on a single URL DOM; outputs {shape, leafContent}
- `FormExtractor.ts` — parses `<form>`, `<fieldset>`, `<section>` boundaries; extracts field label + kind + value + options (from `<select>`, radio groups, etc.). Handles legacy `<table><tr><td>` form layouts (sibling label cell detection). Outputs sections[] for DetailFormShape.
- `GridExtractor.ts` — parses `<table>` (or div-based grid masquerading as table); extracts headers (th text + columnKind from first-row td widget type); counts rows; detects totals/footer row (tfoot or class*="total"); detects filter row (5+ inputs above table). Outputs {gridColumns, columnKinds, hasTotalsRow, filterFields}.
- `TabRecursor.ts` — finds `<button role="tab">` or class patterns; clicks each (in headless clone, simulates click via DOM state change or URL nav); captures nested content; recurses 3+ levels if needed. Outputs {tabs: [{label, content, nestedTabs}]}.
- `ButtonProbe.ts` — for each visible `<button>`, simulates click (in a fresh tab), detects outcome: URL change (route), modal open (`[role="dialog"]` appears), menu open (`[role="menu"]`), download triggered, toast/notification, or no change (dead button). Outputs {label, destination, kind}.
- `ActionMenuProbe.ts` — detects per-row action column (last `<td>` of each row, or inline kebab button). Clicks to open menu; extracts menu items (labels + click targets). Outputs {label, destination, kind}[].
- `BannerDetector.ts` — finds alert/warning divs on page (css class patterns, semantic `<div role="alert">`, yellow/amber background, left border). Captures text + styling. Outputs {text, kind, level}[].
- Public interface: `analyze({ url, dom, authContext }) → Promise<{shape, leafContent}>` where shape is "form"|"grid"|"detail"|"dashboard", leafContent is structured metadata

**src/renderer/**
- `Scaffold.ts` — layout wrapper (sidebar, topbar, main content area, breadcrumbs). Manages navigation tree (from sidebar-tree.ts).
- `DetailFormShape.tsx` — React component, props {sections, tabs?, primaryAction?, breadcrumbs}. Renders right-rail sub-nav (links to each section, smooth scroll), labeled `<section>` per section with fields inside, primary action button top-right.
- `DataGridShape.tsx` — React component, props {columns, rows, filters, totalsByColumn, perRowActions, pageInfoBanner?}. Renders filter row, table, per-row action column (kebab menu), totals footer, entity count.
- `DashboardShape.tsx` — React component, props {widgets: {kpis: [], charts: [], leaderboards: []}}. Renders KPI cards (4+), chart wrapper, leaderboard table (with rank + name + value).
- `DataReportShape.tsx` — wraps DataGridShape; adds PageInfoBanner rendering above grid.
- `SectionPage.tsx` — renders secondary nav flyout (popover anchored to sidebar icon, back arrow, section title, list of sub-route links).
- `PageInfoBanner.tsx` — renders amber info banner with icon + text + optional action link.
- Public interface: every component accepts manifest-derived props; no hardcoded data

**src/judge/**
- `Judge.ts` — CLI entry dispatcher, reads prompts/ directory, manages API client (@anthropic-ai/sdk), calls specified prompt with input, validates response against schema, retries (up to 3×) with error injection, caches result (input-tuple key), writes failures to judge-failures/ on exhaustion.
  - `judge({ prompt: "classify-column-semantic", input: {...} }) → Promise<parsed-response>`
  - Env: LLM_PROVIDER, ANTHROPIC_API_KEY, LLM_MODEL, LLM_MAX_RETRIES
  - Cache location: `.judge-cache/` (gitignored, LRU, per-session)
- `cache.ts` — in-memory + file-backed LRU cache; key = sha256(prompt + JSON.stringify(input)); value = parsed response + metadata (called-at, retry-count)
- `schema-validator.ts` — AJV instance, validates responses; on failure, returns errors for injection into retry prompt
- `self-test.ts` — runs `prompts/tests/<name>.test.json` cases on `npm run test:prompts`; asserts validation passes + predicates hold
- Public interface: `judge()` is the only public function; everything else is internal

**src/audit/**
- `Diff.ts` — compares live vs. clone manifests per-URL, computes gap kind (missing-route, shape-mismatch, field-count, column-count, filter-missing, totals-missing, etc.)
- `checks/` — modular gate implementations (one file per gate):
  - `gate-coverage.ts` — leaf count ≥ threshold
  - `gate-leafcontent.ts` — rebuilt-leaf entries have leafContent
  - `gate-field-count.ts` — form fields ≥ manifest.minFields
  - `gate-grid-columns.ts` — grid columns ≥ manifest.minColumns (or superset if near-duplicate merge)
  - `gate-totals-row.ts` — totals row presence if hasTotalsRow
  - `gate-stub-shapes.ts` — FormStubPage / GenericDetailView not used
  - `gate-mock-placeholder.ts` — tightened pattern matching
  - `gate-phase-skip.ts` — nested tabs present if expected
  - `gate-visual-diff.ts` — pixelmatch threshold
  - `gate-column-semantic.ts` — synth data column-aware (calls judge, caches)
  - `gate-label-whitespace.ts` — deterministic check
  - `gate-duplicate-tables.ts` — Jaccard similarity, collapse near-duplicates
  - `gate-banner-parity.ts` — info banner presence + text (calls judge)
  - `gate-input-kind.ts` — widget type parity (calls judge on ambiguous cases)
- `Audit.ts` — orchestrator, runs all gates in sequence, collects results, emits gap-ledger.json, tracks gate-by-gate statistics (calls, cache hits, latency)
- Public interface: `audit({ manifest, ...config }) → Promise<{gaps: [], stats: {}}>`

**src/cli.ts**
- Entry point for `clone-website-router` and `clone-enterprise` skills.
- Phases:
  1. **Phase -1** (if running full engine): verify gold-standard (existing clone) is clean
  2. **Phase 0** — workspace + repo setup; verify GitHub auth; clone template to new repo
  3. **Phase 1** — visual recon (screenshots, design tokens, component specs) — delegates to original template's SKILL.md
  4. **Phase 1.5** — auth handoff (one-shot, R7b); navigator.authenticate(config.auth)
  5. **Phase 1.6** — enumerate sidebar (walk live section structure, all flyouts, all chevrons)
  6. **Phase 2** — parallel build (original template dispatch to worktrees)
  7. **Phase 2.5** — crawl live + capture leafContent for all URLs (Crawler + Analyzer + judge dispatcher)
  8. **Phase 3** — rebuild from manifest (Renderer components + mock-data synth)
  9. **Phase 4** — assemble + merge worktrees
  10. **Phase 4.5** — run audit-v7 (Audit orchestrator)
  11. **Phase 5** — if gaps found, call judge("judge-rebuild-needed") per gap, apply remediation, re-run audit (loop until cleanCrawls=2)
  12. **Phase 5.5** — scope-remediation loop (judge calls decide sticky gaps)
  13. **Phase 6** — final deliverables (V8-AUDIT-V7-COMPLETE.md, manifest, proof of R18)
  14. **Phase 6.5** — R18 end-state verification (grep for unfinished-work markers, jq gaps, check blocked entries, verify cleanCrawls=2)

---

### Initial Prompt Files (Phase 1 Gaps Only)

Only prompts that Phase 1 dry-test gaps actually require. All are generic (no ClickDealer hardcoding).

#### prompts/classify-target-shape.md
- **Invoked-when**: on entry, before routing to clone-website vs. clone-enterprise
- **Task**: read URL, attempt shallow crawl (3–5 pages), detect auth gate, count visible nav items, assess depth. Classify as "marketing" | "enterprise" | "hybrid".
- **Schema**: {decision: enum, confidence: 0–1, reasoning: string}

#### prompts/classify-column-semantic.md
- **Invoked-when**: during synth-data generation for each table column (Gate 11)
- **Task**: given column label, sample values from first row, neighbor column labels, page context — classify as "people" | "vehicle" | "currency" | "date" | "status" | "identifier" | "boolean" | "unclassified"
- **Schema**: {classification: enum, looksAppropriate: boolean, expectedExample: string, reasoning: string}

#### prompts/judge-section-landing.md
- **Invoked-when**: section-landing exemption decision (Phase 5, if a landing page differs visibly from live)
- **Task**: given live shape (url + leafContent), clone shape (visual inspection), diff ratio (pixelmatch %), decide: "keep-redesign" (log reason + log decision in docs/decisions.md) | "rebuild-1to1" (reclassify as rebuilt-leaf, re-run rebuild pipeline) | "exempt-as-endpoint" (mark kind:endpoint)
- **Schema**: {decision: enum, updatedLandingReason: string, reasoning: string}

#### prompts/judge-banner-equivalence.md
- **Invoked-when**: Gate 14 checks info banner text (Phase 4.5)
- **Task**: given live banner text + clone banner text + page context (e.g., "/dealers/users"), judge if text conveys the same warning/info equivalently (allow paraphrase, different phrasing but same meaning)
- **Schema**: {equivalent: boolean, reasoning: string}

#### prompts/judge-rebuild-needed.md
- **Invoked-when**: Phase 5 loop, sticky gap (failed Gate N for 3+ iterations)
- **Task**: given URL, list of changed fields, old leafContent, new leafContent from last fix attempt — judge if rebuild is needed and at what scope: "full" (entire leaf) | "fields-only" (edit field list, re-synth data) | "labels-only" (re-capture labels, rebuild with new labels) | "none" (skip, mark as endpoint)
- **Schema**: {rebuildNeeded: boolean, scope: enum, reasoning: string}

#### prompts/scope-remediation.md
- **Invoked-when**: Phase 5.5, after 3 failed rebuild loops for a single leaf
- **Task**: given leaf URL + history of failed fixes — propose remediation: "fix-engine-module" (point out which module is broken) | "add-judge-prompt" (describe what decision hook is missing) | "update-site-config" (e.g., add a CSS selector hint to config) | "mark-gold-quirk" (document as a known issue in the gold-standard that the engine won't fully resolve)
- **Schema**: {fix: enum, details: string}

---

### Anti-Patterns.json (Initial)

```json
{
  "version": 1,
  "patterns": [
    {
      "pattern": "Workshop lift servicing",
      "context": "src",
      "addedBecauseOfGap": "R18-MOCK-DATA-SEMANTICS",
      "rationale": "generic filler in wrong context; column-semantic synth must replace with domain-appropriate pool"
    },
    {
      "pattern": "Annual MOT compliance",
      "context": "src",
      "addedBecauseOfGap": "R18-MOCK-DATA-SEMANTICS",
      "rationale": "generic filler"
    },
    {
      "pattern": "Brake pad replacement",
      "context": "src",
      "addedBecauseOfGap": "R18-MOCK-DATA-SEMANTICS",
      "rationale": "generic filler"
    },
    {
      "pattern": "Customer aftercare check",
      "context": "src",
      "addedBecauseOfGap": "R18-MOCK-DATA-SEMANTICS",
      "rationale": "generic filler"
    },
    {
      "pattern": "Stock photography upload",
      "context": "src",
      "addedBecauseOfGap": "R18-MOCK-DATA-SEMANTICS",
      "rationale": "generic filler"
    },
    {
      "pattern": "Finance application review",
      "context": "src",
      "addedBecauseOfGap": "R18-MOCK-DATA-SEMANTICS",
      "rationale": "generic filler"
    }
  ]
}
```

---

### Key Design Decisions (Resolved V5→V8 Conflicts)

| Conflict | V5/V6 Position | V7 Position | V8 Final | Resolution in docs/decisions.md |
|---|---|---|---|---|
| Generic vs. live-named routes | Both existed (generic placeholder routes) | Delete generic, keep live-named | Delete generic, keep live-named (live-named is canonical UI path) | Live names are from domain experts; generic ones are scaffolding artifacts. Route naming must match live UI. |
| Form field count parity | Add forms smaller than Edit forms (19 vs. 36 fields on /stock) | Merge field sets; one canonical form | Merge field sets, shared schema between Add/Edit views | One form definition, two views (empty vs. pre-filled). Avoids drift. |
| Detail-page tab set | Tabs per entity inconsistent (stock=11, click-leads=0) | Every entity has standard tabs (OVERVIEW, ACTIVITY, COMMS, NOTES minimum) + entity-specific | Standard minimum set + live-specific tabs per entity | Consistency enables templating. Entity-specific tabs in manifest. |
| Section-landing exemption | Exemptions hidden gaps ("redesign" label) | Call judge() on every exemption; document decision | Exemptions only after judge("judge-section-landing") call, recorded in docs/decisions.md | Every exemption is transparent and justified. |
| Mock data generics | Generic placeholder strings everywhere | Classify each column via judge, populate from domain pools | Classified synth + banned-string CI check | Domain-appropriate filler prevents nonsensical data. Banned strings caught at build time. |
| Audit cleanup threshold | Audit flags structure, ignores content gaps | Audit gates content parity (fields, columns, labels, banners, input kinds) | 14+ gates, self-extending, stricter each loop | Content matters as much as structure. Audit grows stricter. |
| Autonomy escalations | Agent escalates to Roy for ambiguous cases | LLM judge handles judgment calls, R7 only escalates GitHub/auth | Full autonomy via judge dispatcher, zero human mid-run (except one-shot auth) | Engine must decide. Judge prompts replace human judgment. |

---

### R18 Verification Commands (Built into `npm run verify:r18`)

```bash
# 1. No unfinished-work markers
<R18 unfinished-work scan> \
  src/ docs/ scripts/ → zero matches

# 2. Zero gaps in audit
jq '.gaps | length' docs/research/audit-v7-runs/<latest>.json → 0

# 3. Zero blocked entries in crawler state
grep '"blocked"' docs/research/live-crawl-manifest.json → zero matches

# 4. Zero judge failures
ls docs/research/judge-failures/ 2>/dev/null | wc -l → 0

# 5. Two consecutive clean audit runs
jq '.runHistory[-1:] | map(.cleanCrawls)' docs/research/audit-v7-runs/summary.json → [2, 2]
```

All five must pass before declaring done.

---

## END FOUNDATIONAL RESEARCH

This synthesis is the phase-1 input for the universal-site-cloner build. Every gap class listed in section 2 is closed by at least one module in section 4. Later-stage revisions are resolved explicitly. The engine is designed to run autonomously after one-shot initial auth, with zero human mid-run escalations except GitHub infrastructure issues.
