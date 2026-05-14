## 2. GAP-CLASS-SYNTHESIS (notes/02-lessons-from-clickdealer.md)

### Unified Gap-Class Table

Derived from chronological synthesis of all 20 corpus B files (V5 earliest, R18 final). Later stages override earlier ones.

| Gap Class | Earliest Stage | Final Recommendation | Later-Revises-Earlier? | Generic Mechanism |
|---|---|---|---|---|
| **URL DISCOVERY** — only visible links crawled; hidden behind chevrons, kebabs, modals, XHR | GAP-REPORT-LIVE-VS-CLONE (critical #4) | Crawler must: (a) enumerate every `<a href>` in DOM; (b) click every `<button>` in observed action-menu or chevron to expand flyouts; (c) walk `:id` routes as patterns (dedupe numeric IDs); (d) recursively descend until queue empty. Concurrency pool (3-10 workers), resumable from checkpoint. | V7-EXHAUSTIVE-CRAWL strictly enforces: queue never caps, no sampling, :id-collapse only per config, every URL reaches terminal state | A site-cloning engine crawls by queue exhaustion: detect all reachable URLs via link-follow + button-click + pattern-based `:id` expansion. Requires stateful queue, not breadth-first samples. |
| **AUTH HANDOFF** — no cookie capture, session expires mid-crawl | FIX-PROMPT-V5 implied (topbar RS avatar dead) | Implement AuthStrategy interface: NoAuth, BasicAuth, CookieJarAuth, KeycloakHandoffAuth. Keycloak: (a) open login window once (R7b one-shot); (b) capture cookies + localStorage to state.json; (c) reuse state on every subsequent Playwright context. Fallback: test-retry loop with 401-detect + refresh. | R18 tightens: NO second auth handoff mid-run. If session expires, fix cookie-refresh logic, don't escalate. | Site-cloning engines support pluggable auth strategies. Keycloak: one-shot headful login window, persist auth state, auto-refresh with exponential backoff on 401. |
| **SECTION NAVIGATION COLLISION** — in-page generic tabs ("LIVE/DRAFT/SOLD") vs. secondary aside nav with live-named items ("Vehicle Vitals / P/Ex Vehicles"), zero overlap | GAP-REPORT-DEEP-10-LOOPS (gap A) | Delete in-page generic tabs AND their routes. Keep ONLY aside1 secondary nav with live-named items. Wire section-page sidebar click to flyout popover listing every sub-route. | SEND-NEXT-AUDIT-V7 + GAP-LOG-V6 confirm: fix applied, aside1 now responsive (md:block not xl:block), navigation fully fixed | Any CRM-style nav: choose ONE canonical sub-route naming (live-named preferred); delete redundant route sets; render in-page via sidebar flyout, not duplicate tab bar. |
| **RESPONSIVE BREAKPOINT MISMATCH** — aside1 hidden at 1024px (`hidden xl:block`), invisible on typical laptop | GAP-REPORT-DEEP-10-LOOPS (gap B) | Change `hidden xl:block` to `hidden lg:block` or `md:block`. `xl:` = 1280px; user screenshots showed 1024px. | V7-FINAL confirmed at V6 (GAP-LOG-V6): breakpoint changed, aside visible across intended viewports | Any sidebar nav: ensure responsive visibility across mobile (hidden), tablet (md:block), and desktop (lg:+ always visible). Test at 768px, 1024px, 1280px+. |
| **CONTENT FILTERING — sub-routes unfiltered** — /stock/sold-vehicles, /stock/ordered-vehicles show identical mock data (6 vehicles, all "Live" status) instead of filtering by their semantics | GAP-REPORT-DEEP-10-LOOPS (gap C) | Each sub-route URL must filter mockData: `status === 'sold'`, `status === 'ordered'`, etc. Same pattern for /customers/birthdays (filter by birthday month), /diary/today (date filter). | SEND-NEXT-AUDIT-V7 confirms applied and audited | Any paginated section-landing: filter mock data by the page's semantic meaning (status, date, category). Implement per-page via query param or route segment. |
| **WRONG CONTENT ON SUB-ROUTES** — /click-leads/enquiries renders users table; /click-leads/notifications has empty tbody | GAP-REPORT-DEEP-10-LOOPS (gap D) | Wire /click-leads/enquiries to mockEnquiries (not mockUsers). Populate /click-leads/notifications from mockNotifications. Per-route data selection error. | V7-FINAL fixed, audit verified | Any section-landing page: datasource must match the page's label and semantic purpose. Use route-name or query param to select the right mock entity. |
| **CHEVRON-IMPLIED SECOND-LEVEL ROUTES DO NOT EXIST** — live shows Click Leads → Enquiries with chevron (nested flyout implied), but /click-leads/enquiries/new, /assigned, /converted, /lost all 404 | GAP-REPORT-DEEP-10-LOOPS (gap E), V7-EXHAUSTIVE-CRAWL (Phase 1, recursive tab walk) | Build every nested route that live shows under a chevron parent. /click-leads/enquiries → /click-leads/enquiries/{new, assigned, converted, lost, sources}. Walk live recursively: for every item with chevron, expand and build nested routes. | V7-FINAL enforces recursion 3+ levels deep ("tabs inside tabs inside tabs"); R4 forbids skipping any depth | Site-cloning engines recursively discover and build nested navigation: click every chevron on the live site, enumerate child items, build routes for all of them. No depth limit. |
| **DUPLICATE FORMS — "ADD X" vs "NEW X"** — /stock/add-vehicles (19 fields) and /stock/new (36 fields) both exist, different field counts, neither canonical | FIX-PROMPT-V5 (gap 9), GAP-REPORT-DEEP-10-LOOPS (gap F) | Pick the live-named version as canonical (add-vehicles). Merge the richer field set from the generic version (new) into it. Delete the generic route. One form per entity, shared schema between Add and Edit views. | V7-FINAL lists as worked example (A12-A18 vehicle detail); R16 mandates surgical fix — delete the generic one, keep live-named. | Add/Edit form deduplication: when two routes serve the same entity with different field counts, the live-named one is canonical; merge field sets, delete generic route, share schema. |
| **BROKEN /click-leads/new** — one <input> element, zero form structure, unclear intent | FIX-PROMPT-V5 (gap 7) | Either delete it or build it as a proper "Add Lead" form with customer, vehicle, source, status, salesperson, notes fields. Current state is neither. | V6 walked it; V7-FINAL treats as worked example: properly structure every form or remove it. | Every form route must render a semantically complete form (2+ fields minimum) or be deleted. Single-field routes are incomplete and should be removed. |
| **DETAIL-PAGE TAB DEPTH INCONSISTENCY** — /stock/1 has 11 tabs, /customers/1 has 6, /click-leads/1 has 0 | FIX-PROMPT-V5 (gap 8), GAP-REPORT-DEEP-10-LOOPS (gap H) | Detail pages without tabs should be given tab stubs (OVERVIEW, ACTIVITY, COMMS, NOTES minimum). Per-entity detail tab sets must match live. | V7-FINAL specifies exact tab counts per entity (stock=11, customers=6, click-leads=4, etc.); R3 enforces exhaustive capture per entity | Detail pages normalize to a standard minimum tab set: OVERVIEW (metadata), ACTIVITY (history), COMMS (email/notes), and entity-specific tabs from live. Rebuild from manifest. |
| **MISSING ARIA-CURRENT on nav links** — aside1 styles active sub-route visually but doesn't carry `aria-current="page"` | FIX-PROMPT-V5 (gap 9) | Add `aria-current="page"` to the active aside1 link. Screen readers then announce the current page. | V5 fix applied, standard a11y requirement. | Any navigation sidebar: render active link with `aria-current="page"` for screen-reader announcement. |
| **FORM INPUTS MISSING <label> ASSOCIATIONS** — field titles rendered as `<div>` or `<span>`, not `<label for="...">` | FIX-PROMPT-V5 (gap 10) | Wrap field labels in `<label for="inputId">` or place `<input>` inside `<label>`. Every form field must have a label association. | V5 fix applied, audit in place. | Every form input: `<label htmlFor="fieldId">` + matching `<input id="fieldId">`. Required for a11y and form usability. |
| **GENERIC PLACEHOLDER SUB-ROUTES STILL ROUTABLE** — /stock/draft, /stock/live, /stock/sold, /stock/new all return 200 but orphaned from UI (gap A collision) | GAP-REPORT-DEEP-10-LOOPS (gap K) | Delete the generic routes after wiring the live-named ones. Every URL should be either discoverable from the UI or a deliberate endpoint. | SEND-NEXT-AUDIT-V7 confirms deletion after aside1 becomes canonical nav. | After navigation redesign: audit all routes. Delete orphan routes. Route inventory must match UI navigation tree exactly. |
| **THIN LANDING PAGES** — /profile, /help, /downloads, /signed-out are sparse (41–134 visible chars) even after JS hydration | FIX-PROMPT-V5 (gap 11), GAP-REPORT-DEEP-10-LOOPS (gap L) | /profile/details should render a real form (name, email, role, phone, last-login). Currently the DETAILS tab exists but renders nothing. Build landing pages with semantic content, not tab-only shells. | V7-FINAL: /profile/details becomes a SHAPE FORM landing page. | Section landing pages: if a page is meant to show content beyond a tab bar, rebuild it with that content (form fields, data, description). Empty tab shells are incomplete. |
| **NOTIFICATIONS DETAIL ROUTE MISSING** — /notifications lists 6 items but /notifications/[id] and /notifications/all 404 | FIX-PROMPT-V5 (gap 10), GAP-REPORT-DEEP-10-LOOPS (gap M) | Build /notifications/[id] with 6 mock notifications prerendered via generateStaticParams. /notifications/all as alias of /notifications. | V7-FINAL: every list with click targets must have detail routes. | List pages with clickable rows: build detail routes. If live has them, enumerate live detail; if not, use first-column identifier as detail key. |
| **TOPBAR TEXT MISMATCH** — search placeholder "Search routes, customers, vehicles, enquiries…" doesn't match live "Search the site…" | FIX-PROMPT-V5 (gap 12), GAP-REPORT-DEEP-10-LOOPS (gap N) | Change placeholder to "Search the site…". Notification badge "3" → "12". Small copy mismatches. | V5 fix applied; V7-FINAL audits copy parity. | Topbar: audit every placeholder, badge count, button label against live. Use exact copy from live site. |
| **DETAIL-PAGE FORM SECTIONS MISSING** — /stock/1 DETAILS tab should have 10 subsections (KEY INFORMATION, TRANSMISSION, ENGINE, etc.); clone renders 6-row key-value summary instead | V6 GAP-LOG (gap #2: SIV tab), V7-FINAL (B1-B9: all 9 tabs rewritten) | Every detail-page tab is either SHAPE FORM (multi-section editable form with right-rail sub-nav) or SHAPE GRID (wide data grid with filter/totals/actions). Replace all 6-row summaries with real shapes. | V7-FINAL root-pattern analysis: **one architectural fix** (DetailFormShape + DataGridShape) applied to every leaf. This is the single biggest gap class. | Detail-page tabs: for form-type tabs, implement SHAPE FORM (sections + right-rail sub-nav + fields). For list-type tabs, implement SHAPE GRID (columns + filter + totals + actions). No 6-row summaries. |
| **TABLE COLUMNS MISMATCH** — live /stock/list-vehicles has 20 cols; clone may have fewer or different labels | V6 GAP-LOG (gap #1: 20 cols required), V7-FINAL (A1: exact col list), SEND-NEXT-AUDIT-V7 (Gate 4: column floor) | Every list page must render AT LEAST the column count from live. If live has 20, clone minimum 20. Label every column exactly as live. Capture column labels from live table header text. | V7 baseline (Gate 4 + Gate 13 upgrades, R18): near-duplicate table dedup (Jaccard ≥0.85); clone can be SUPERSET of live columns (union when live has two near-duplicate tables). | Table capture and rebuild: enumerate exact live column count, labels, and order. Clone must match or exceed. If live shows two similar tables, collapse them in the clone to a single union. |
| **ACTION MENU MISMATCH** — live /stock/list-vehicles row actions: [SIV, Edit, EXP, Enq/Sell, Info, Sman, Images] (7 items); clone: [View details, Edit, Create enquiry] (3 items) | V6 GAP-LOG (gap #1: 7 actions required), V7-FINAL (A1: exact menu list), SEND-NEXT-AUDIT-V7 (audit-interactivity extension) | Capture every action menu from live. Map each label to its route or modal target. Clone must render the same menu items in the same order. | V7 enforces action-menu parity check: compare live menu item labels (case-insensitive, order-insensitive) against clone. | Action menus: capture every option from live. Build route or modal for each. Clone must list them all. Per-row actions table captures {label, destination, kind: route|modal|menu|download|dead}. |
| **FILTER ROW MISSING OR INCOMPLETE** — data grid should have filter row above table; clone may omit it or have fewer filters | V7-FINAL (A1, A4-A8: filter specs for each list), SEND-NEXT-AUDIT-V7 (Gate 5 extension: filter field count) | Every data-grid list page must have a filter row: 3-8 filter dropdowns + search + Refresh + Show/Hide Columns + Download CSV buttons. Capture filter field names from live. | V7 audits filter count: live=N, clone must have ≥N filters. | Data grids include filter row: capture live filter field labels and kind (select vs. text). Clone renders same filters above table. |
| **TOTALS ROW MISSING** — grid footer should sum price/amount columns and show row count | V7-FINAL (A8: "Footer row TOTAL with summed PRICE"), SEND-NEXT-AUDIT-V7 (Gate 5: totals-row parity) | List pages where live has totals footer must render totals row in clone. Columns to sum specified per page (e.g., PRICE, AMOUNT, TOTAL). Row count footer: "Number of Vehicles: NN". | V7 checks: hasTotalsRow in manifest, audits presence on clone. | Data grids: if live shows a totals row with summed columns, render it. Schema specifies which columns sum. Footer also shows entity count. |
| **MOCK DATA SEMANTICS — wrong filler values** — "Workshop lift servicing" in a NAME column, "Brake pad replacement" in RESET EMAIL, generic nonsense in people/currency/date columns | R18 SEND-NEXT-AUDIT-V7 (4 bug classes Roy spotted, Gate 11-14 gating) | Classify each column via judge("classify-column-semantic"): people → generate realistic names/emails; vehicle → use stock pool; currency → £-prefixed amounts; date → recent dates; status → context-aware values; identifier → realistic IDs. Banned filler strings (6 workshop/MOT phrases) trigger CI failure. | R18 Gate 11 upgraded to exempt em-dashes + empty-state rows; uses manifest field.kind + neighbor columns + page context to validate synth data. | Mock data generation: classify each column semantically. Populate with domain-appropriate filler (people pool for person columns, vehicle pool for vehicle columns, etc.). Enforce no banned generic placeholder strings. |
| **COLUMN-LABEL WHITESPACE STRIPPED** — captured "Reset Email" renders as "RESETEMAIL" (no space) | SEND-NEXT-AUDIT-V7 (Gate 12: column-label whitespace check) | Preserve internal whitespace in column labels. Only trim leading/trailing. Bug was `textContent.replace(/\s+/g, '')` stripping all spaces. Re-capture after fix. | Deterministic fix (no LLM call). Audit fails build on any stripped spaces. | Column capture: preserve internal whitespace. Normalize label text conservatively. Audit rejects labels that lost spaces. |
| **DUPLICATE / NEAR-DUPLICATE WRAPPER TABLES** — live has two 25–27-col tables with 24 columns in common (Jaccard ≥0.85); clone rendered both, causing duplication | SEND-NEXT-AUDIT-V7 (Gate 13: duplicate wrapper-table check, then upgraded in R18) | Filter captured tables: skip any table with empty rowCount or all-empty rows. For near-duplicate tables (same column signature or Jaccard ≥0.85), collapse to a single clone table with union of all columns. | V8 gate 13 upgraded: Jaccard similarity computes near-duplicate set; rebuild merges them. Clone renders single union table. | Table rebuild: detect and collapse duplicate/near-duplicate tables. Near-duplicate = same column signature or Jaccard ≥0.85. Output single table with column union. |
| **INFO BANNERS MISSING OR WRONG TEXT** — live shows "Please Note - Multiple users share reset email…"; clone omits banner or text doesn't match | SEND-NEXT-AUDIT-V7 (Gate 14: page info banner parity) | Capture page-level info banners from live (amber background, left border, alert icon). Render on clone at top of <main> above data grid or form. If captured, judge("judge-banner-equivalence") checks text match; if not equivalent, rebuild. | V8 Gate 14: detect yellow/alert divs on live; capture text + kind; rebuild with same styling + text. | Info banners: capture any alert/notice div on live page. Render on clone with same styling (amber background, icon). Audit checks text equivalence. |
| **INPUT KIND MISMATCH** — live has checkbox widget; clone renders `<input type="text">` with value as visible text | SEND-NEXT-AUDIT-V7 (Gate 16 NEW: input-kind / rendered-value parity) | Capture column `kind` from first body row's `<input type>`, `<select>`, `<textarea>` tag. Render matching widget on clone. Heuristic: checkbox-shaped column labels (Add Vehicle, Confirm Sale, Active Salesperson, etc.) always render `<input type=checkbox>` even if live captured as plain `<select>`. | V8 Gate 16 new; upgraded heuristic for checkbox-pattern labels. Uses manifest field.kind + label patterns + page context. | Forms and grids: capture input kind from live (checkbox, select, textarea, text, radio). Render matching widget. For ambiguous cases, use column-label pattern heuristics. |
| **SECTION-LANDING EXEMPTION — real gap hidden as "redesign"** — page is genuinely different (clone has different sidebar/topbar), but the gap-reporting exempts it without checking | R18 SEND-NEXT-AUDIT-V7 (judge-section-landing prompt) | For section-landing pages (home, diary, sales-enquiries, etc.), call judge("judge-section-landing") with live shape, clone shape, and diff ratio. LLM decides: keep-redesign (log reason), rebuild-1to1 (reclassify as leaf rebuild), or exempt-as-endpoint. Use LLM judgment, don't hide gaps behind exemptions. | R18 enforces: every exemption is justified by an LLM judge call + documented decision in `docs/decisions.md`. | Exemptions: when a leaf differs visibly, call an LLM judge to decide if it's a legitimate redesign or a gap needing rebuild. Document the decision. Never blanket-exempt. |
| **VISIT EVERY URL BEFORE DECLARING CLEAN** — audit counted routes; agent declared 100% coverage without driving every link | V7-EXHAUSTIVE-CRAWL (R3: fresh cold clone), SEND-NEXT-AUDIT-V7 (R11: no URL cap, no sampling, exhaustive queue) | Crawler must visit EVERY URL discovered, one by one, until queue empty. No caps (e.g., first 100). Concurrency pool (3-10 workers) is fine; exhaustion is not optional. Resumable checkpoints every 10 URLs in case of crash. | R11 enforces: queue-state.json tracks every URL to a terminal state (captured, 404, blocked, redirected, dead). No silent disappearances. | Crawlers must be exhaustive: BFS queue, no caps, parallel workers, checkpoints. Visit every URL, track terminal state, resume from crash. This is why ClickDealer audit takes 3-8 hours on first run; subsequent runs cache and take 10-30 min. |
| **AUDIT GATES NOT CATCHING GAPS** — audit passes (routes return 200, shape checkboxes pass) but user clicks through and finds broken content | V5 (audit-interactivity.mjs), V6 (audit-v6.mjs), V7-FINAL (audit-shapes.mjs + audit-nested-tabs.mjs), SEND-NEXT-AUDIT-V7 (10→14 gates with self-extending audit rule R4) | Implement stratified audit: Gate 1–10 baseline (coverage, leafContent, field/column/totals/stub/mock-placeholder/phase-skip); Gate 11–14 new (column-semantic, label-whitespace, duplicate-table, info-banner). Self-extending rule: every new gap class discovered adds a new check before the fix is applied. Audit grows stricter each loop, never looser. | R20 anti-patterns: maintain monotonic-grow ban list. Gaps that recur become permanent CI checks. | Audit gates are stratified and self-extending: every gap class becomes a permanent check. Build gate implementations BEFORE fixing the gap. Audit grows stricter, never looser. Examples: field-count floor (Gate 3), column-semantic mock (Gate 11), banner parity (Gate 14). |
| **JUDGE PROMPTS NOT SELF-TESTED** — new LLM judgment hook added but no test case to catch if the prompt breaks | R17 SEND-NEXT-AUDIT-V7 (per-prompt SELF-TEST gate) | Every prompt ships with test file `prompts/tests/<name>.test.json` containing { input, expected } or { input, expect: "<predicate>" } cases. CI runs `npm run test:prompts` before every merge. A prompt without passing self-test cannot land. | R17 and CI enforcement ensures prompt quality. | Judgment prompts: each prompt requires a co-located test file with ≥1 test case. CI enforces self-tests pass before merge. Schema validation also re-tested on every run. |
| **NO AUTONOMOUS LOOP CLOSURE** — engine gets stuck in escalations or ships unfinished-work markers because it has no way to decide "should this be fixed or exempted?" | R18 SEND-NEXT-AUDIT-V7 (full autonomy contract), FINAL-BUILD-PROMPT (R17 judge dispatcher, R18 no escalations except GitHub/auth) | Build LLM-judge infrastructure (Judge.ts dispatcher, 5-7 judgment prompts with schemas). Autonomy contract: R7 (only GitHub infra + one-shot auth escalations allowed); R17 (LLM judges handle every other decision); R18 (engine runs to completion with zero human input post-auth handoff). Judge calls are cached (input-tuple key) to avoid re-calling identical inputs. | R18 verification: `npm run verify:r18` checks: no unfinished-work markers, zero gaps in audit, zero blocked entries, zero judge-failures, cleanCrawls=2. | Autonomy: implement LLM judge dispatcher. Judge handles all ambiguous decisions (gap vs. design, rebuild scope, column semantics, etc.). Engine never escalates except GitHub/auth. Loop until cleanCrawls=2. |
| **PROGRESS INVISIBLE** — long-running crawl (3-8 hours) gives no feedback; Roy doesn't know if engine is stuck, sleeping, or working | R19 SEND-NEXT-AUDIT-V7 (PROGRESS LOGS) | Engine appends to `docs/research/engine-progress.log` every 30 seconds and on every state transition (URL captured, gap found, judge called, etc.). Format: `[ISO-timestamp] phase=X.Y action=<verb> result=<short>`. Roy reads log asynchronously; engine never prints to chat or pauses for ack. | R19 enforces: log is append-only, gitignored, updated frequently. No chat-blocking. | Progress reporting: append-only log, 30s heartbeat, state transitions logged. No chat prints. Human reads log asynchronously. |
| **REGRESSION RECURRENCE** — same bug fixed in V5 reappears in V7 because there's no ban list | R20 FINAL-BUILD-PROMPT (anti-patterns.json enforcement) | Maintain `anti-patterns.json` at repo root: a monotonic-grow list of string patterns / regexes that must NEVER appear in shipped code. Example: banned filler strings (6 workshop/MOT phrases). CI job greps code + manifests after every push; build fails on match. When Phase 5 finds a regression, ADD to anti-patterns.json before re-fixing the bug. | R20 CI enforcement ensures regressions don't recur. Anti-patterns grow monotonically; never delete. | Anti-pattern ban list: maintain a CI-checked list of values that must never reappear (placeholder strings, malformed output, etc.). When a regression is fixed, add its pattern to the ban list. Build fails on any match. |

---

## 3. GOLD-STANDARD-CAPABILITIES

### Per-Shape Components

**DetailFormShape.tsx** — renders multi-section editable form with right-rail sub-nav
- Props: `sections[] = {key, label, fields[], optional: rightRailLabel, primaryAction, enableCheckbox}`
- Fields: `{label, kind: "text"|"select"|"textarea"|"checkbox"|"readonly", value, options?, helpText?}`
- Renders: labeled `<section>` per sub-section, right-rail nav anchors, primary action button in header, optional enable-checkbox
- Example leaf: /stock/1/DETAILS tab (10 sections: KEY INFORMATION, TRANSMISSION, ENGINE, SECURITY, DIMENSIONS, WEIGHT & ECONOMY, ROAD FUND RATE, NCAP RATINGS, PRINTOUTS)
- Field count parity audit: manifest specifies 70+ fields; clone renders all

**DataGridShape.tsx** — renders 15–25 column data grid with filter row, totals, per-row actions
- Props: `columns[], rows[], filters[] of {label, kind: "select"|"text", options?}, perRowActions[] of {label, kind: "route"|"modal"|"menu", target?}, totals: {label, valuesByColumn}`
- Renders: filter row (3–8 filter inputs + Refresh + Show/Hide Columns + Download CSV); table with columns, per-row action column (kebab menu or inline buttons); `<tfoot>` totals row; entity count footer
- Example leaf: /stock/list-vehicles (20 cols, 7-item action menu [SIV, Edit, EXP, Enq/Sell, Info, Sman, Images], price totals, "Number of Vehicles: NN" footer)
- Column count parity audit: manifest specifies 20 columns; clone renders all 20, no fewer

**DataReportShape.tsx** — wrapper for grids that need page-level info banners
- Renders PageInfoBanner above the grid (amber background, left border, icon)
- Example: /dealers/users has banner "Please Note - Multiple users share reset email…"
- Info banner parity audit: Gate 14 checks text equivalence

**SectionPage.tsx** — renders section-landing page with secondary nav flyout
- Sidebar click opens popover listing all sub-routes for that section
- Example: Stock section → click Stock icon → flyout shows Vehicle Vitals, Add Vehicles, List Vehicles, etc.
- Sub-route wiring audit: manifests sub-nav link count and labels

### Audit-V7 Gate List (1–14, +16)

1. **Audit Coverage** — 193 leaves captured; manifest present
2. **LeafContent Presence** — 68 rebuilt-leaf entries have leafContent; 6 section-landing + 68 endpoint exempt from this requirement
3. **Field-Count Floor** — form leaves have ≥ manifest.minFields (default 3); rebuilt leaves ≥ live field count
4. **Table-Column Floor** — grid leaves have ≥ manifest.minColumns; near-duplicate tables (Jaccard ≥0.85) collapsed to union
5. **Totals-Row Parity** — leaves with `hasTotalsRow: true` render footer row with summed columns + entity count
6. **Stub-Shape Detection** — catches FormStubPage (placeholder, 3 generic fields) and GenericDetailView; flags as incomplete
7. **Mock-Placeholder Tightened** — detects repeated placeholder strings (row \d$ pattern), first-column values from BANNED vocabulary, status word in ≥5 columns
8. **Phase-Skip Detection** — leaves missing critical sub-sections or nested tabs are flagged
9. (Discontinued in V8)
10. **Visual Pixel Diff** — pixelmatch against live screenshots; threshold 12% (9 residual leaves at 12–25%, all due to redesigned sidebar/topbar)
11. **Column-Semantic Mock** — LLM judge classifies each column (people, vehicle, currency, date, status, identifier); synth data validates (em-dash exempt for date/currency, empty-state rows skipped)
12. **Column-Label Whitespace** — labels must preserve internal spaces (deterministic check, no LLM)
13. **Duplicate / Near-Duplicate Tables** — tables with identical column signature OR Jaccard ≥0.85 are collapsed to single clone table with column union
14. **Info-Banner Parity** — captured page-level banners (from <div class*=alert|warning>, etc.) are rendered; text equivalence checked via judge("judge-banner-equivalence")
16. **Input-Kind / Rendered-Value Parity** — column kind (checkbox, select, text, etc.) matches between live and clone; heuristic: checkbox-pattern column labels (Add Vehicle, Confirm Sale, etc.) always render `<input type=checkbox>`

### Manifest Schema Structure

Root: `{leaves: [{url, shape, kind, status, leafContent?, verification?, capturedAt?, updatedAt?, ...}], ...}`

Per leaf:
- `url` — canonical path (e.g., `/stock/list-vehicles`)
- `shape` — "form" | "grid" | "dashboard" | "detail" (has tabs)
- `kind` — "rebuilt-leaf" | "section-landing" | "endpoint" | "dynamic-detail"
- `leafContent` — captured metadata (for rebuilt-leaf only):
  - `sections` — for forms: [{label, fields: [{label, kind, defaultValue?, options?, ...}]}]
  - `gridColumns` — for grids: [{label, kind?, sortable?, hidden?}]
  - `columnKinds` — observed input types from live table first row (checkbox, select, text, etc.)
  - `pageInfoBanners` — [{text, kind, level}] if any
  - `tabs` — if detail page: [{label, shape, leafContent?, nestedTabs?: [...]}]
  - `actionMenu` — [{label, destination, kind}]
  - `filters` — for grids: [{label, kind, options?}]
  - `hasTotalsRow` — boolean
  - `rowCount` — seed count (6–50 per page type)
  - `bottomText` — footer line (e.g., "Number of Vehicles: NN")
- `verification` — "live-screenshot" | "blocked" (with reason) | "deferred" (with reason)
- `capturedAt` — ISO timestamp when leafContent was extracted
- `status` — "built" | "needs-rebuild" | "gap-recorded"

### Crawl / Capture / Rebuild Pipeline

1. **crawl-live.mjs** — BFS queue, every link + button, parallel Playwright pool (3–10 workers), auth-aware, resumable
   - Output: live-crawl-manifest.json (per-leaf: url, shape, leafContent, screenshot)

2. **crawl-clone.mjs** — same but against localhost:5200
   - Output: clone-crawl-manifest.json

3. **diff-crawls.mjs** — compares live vs. clone per-URL
   - Output: gap-ledger.json ({id, kind, url, detail, liveScreenshot, cloneScreenshot, severity, fixedAt, auditCheckAdded})

4. **capture-all-leafcontent.mjs** — drives live DMS for detailed field-by-field extraction
   - Navigates to each URL, parses forms (section headers + fields), tables (column labels + kinds), tabs, action menus, info banners
   - Output: enriched live-crawl-manifest with leafContent

5. **rebuild-leaf-from-manifest.mjs** — for each gap in ledger:
   - Read live leafContent + clone shape
   - Generate appropriate component (DetailFormShape, DataGridShape, DashboardShape)
   - Synth mock data per column semantics (judge("classify-column-semantic") calls cached)
   - Emit tsx file per leaf
   - Output: src/app/*/page.tsx files + updated manifest with kind:rebuilt-leaf

6. **audit-v7.mjs** — 14+ gates, self-extending
   - For each leaf: navigate, inspect DOM, run gates, emit gap records
   - Caches judge responses; collects statistics (calls per prompt, cache hit %, p50/p95 latency)
   - Output: audit-v7-runs/<timestamp>.json ({gates: [{gateId, failures: [...]}], stats})

### The 4 Bug Classes R18 Addressed (and How Engine Prevented Them)

1. **Column-Semantic Mismatch** — mock data ignores column meaning
   - Example: /dealers/users, NAME column showed "Workshop lift servicing" (a service task, not a person name)
   - Prevention: Gate 11 + judge("classify-column-semantic") runs before data synth. Synth pools (people, vehicle, currency, date) are used based on column semantics. Banned filler strings added to anti-patterns.json.

2. **Column-Label Whitespace Stripped** — "Reset Email" became "RESETEMAIL"
   - Example: /dealers/users header rendering
   - Prevention: Gate 12 (deterministic check) normalizes both captured and rendered labels; audit fails build on mismatch.

3. **Duplicate Wrapper Tables** — live had two 25–27 col tables with 24 overlapping columns; clone rendered both
   - Example: /dealers/users — live: 27 col + 25 col (96% overlap); clone: should be 1 table with 28 col union
   - Prevention: Gate 13 computes Jaccard similarity; rebuild-leaf-from-manifest.mjs collapses near-duplicate tables (≥0.85 Jaccard) into single union table.

4. **Missing Info Banners** — page-level alerts not rendered
   - Example: /dealers/users banner "Please Note - Multiple users share reset email…" was captured on live but not on clone
   - Prevention: Gate 14 checks presence + text equivalence (via judge("judge-banner-equivalence")). DataReportShape + DetailFormShape both render PageInfoBanner above content if leafContent.pageInfoBanners is non-empty.

---

