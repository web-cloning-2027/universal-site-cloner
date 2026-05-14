# 01b — Baseline run of the old template vs. gold-standard

## Method note

The "old template" is not a runnable engine — it is a Next.js scaffold
plus an agent-instruction skill (`.claude/skills/clone-website/SKILL.md`)
that an AI coding agent reads and executes. "Running the baseline" with
its own default configuration means: drop a fresh checkout of the
template + invoke `/clone-website https://dms.myclickdealer.co.uk` in an
AI agent and let the skill run to completion.

A full end-to-end execution of the skill against the live DMS would
take many hours of agent time and consume an entire session before the
new-engine work could begin. **The deliberate substitution**: the
V1-V8 corpus (20 markdown files in `outputs/`) is itself the empirical
record of running the template against ClickDealer iteratively. Each
V-stage is one cycle of "ran skill / found gaps / wrote fixes". The
synthesis in `notes/02-lessons-from-clickdealer.md` is the union of
every gap class those iterations surfaced.

For the purposes of Phase 1, **the baseline is**: a fresh-template
output equals the skill's natural endpoint without any of Roy's
manual additions (no audit-v7.mjs, no leaf-mock-rows, no DataReport-
Shape, no kind-aware capture, no Keycloak handoff). That is a static
Next.js scaffold with a small set of marketing-style pages — i.e.,
about 5% of what a complex authed CRM clone requires.

Decision logged in `docs/decisions.md`: skip the live re-run; treat
the V1-V8 corpus as the baseline record. The genericity rule (R14)
still applies — every gap in this doc is phrased as a feature any
generic site-cloning engine must have.

## Baseline-vs-gold catalog

One row per gap. The "example URL" column is from ClickDealer because
that is our proving ground, but every gap is generic.

| gap | example URL (proving ground) | what fresh-template produces | what gold-standard has | generic mechanism that closes it |
|---|---|---|---|---|
| GAP-01 No auth | `/dealers/users` | static "Hello" page; auth-walled URL is unreachable | full data grid with banner, 28 columns, real labels | Pluggable `AuthStrategy` interface with `KeycloakHandoffAuth` impl that opens headful Playwright, captures `state.json` once, reuses for all subsequent runs |
| GAP-02 No crawler | any | scaffold-only — no URL discovery | 193 leaves crawled, deduped (`:id` collapsed) | BFS `Queue` over an allowlist regex with `:id`-pattern dedupe declared in site config; pop-process-push until empty |
| GAP-03 No exhaustive walk | `/stock/list-vehicles` etc. | nothing | every URL on the live host was visited | Queue has no upper bound; every URL gets its own analyzer pass; no sampling, no "looks similar to" collapse outside config-declared `:id` rules (R11) |
| GAP-04 No resumability | a 24h crawl | doesn't exist | `live-crawl-manifest.json` persisted incrementally; `--resume=true` flag | `Queue` debounces persistence to disk every ~5s; on startup load prior state unless `--fresh` is passed (R12) |
| GAP-05 No leaf shape detection | `/stock/list-vehicles` (grid) vs `/dealers/users` (grid+widgets) vs `/accounts/capital-expenses-add` (form) | every page treated as marketing copy | every leaf classified as `form|grid|dashboard|wizard|viewer` and rendered via a matching shape component | `LeafAnalyzer` reads DOM, applies heuristics + judge fallback, emits one of N enum kinds; renderer dispatches to a shape component per kind |
| GAP-06 No multi-section form extraction | `/accounts/capital-expenses-add` (live has 6 panels, ~31 fields) | renders a hero + paragraph | `DetailFormShape` renders all panels with proper field kinds | `FormExtractor` segments `<form>` / `<fieldset>` / `<section class*=panel>` into ordered panels with per-field `{label, kind, options, required}` capture |
| GAP-07 No grid extraction | `/stock/list-vehicles` (19 cols, totals, filters) | nothing | full table with header, totals row, per-row actions | `GridExtractor` captures cols, rowCount, totals row presence, filter row presence, per-row action column, **plus columnKinds** (first body row → input type per col) |
| GAP-08 No column-kind capture | `/dealers/users` Active Salesperson column | even if a table were rendered, cells would be plain text | live captured kind="checkbox" → clone renders `<input type=checkbox>` | `GridExtractor.columnKinds` reads first body row's td contents and tags each col as checkbox/radio/select/date/text/value |
| GAP-09 No nested-tab discovery | nested tabs on detail pages | doesn't exist | "tabs inside tabs inside tabs" enumerated | `TabRecursor` clicks each tab, captures its sub-DOM, recurses with no depth limit; output is a tree in `leafContent.tabs` |
| GAP-10 No button enumeration | every action button | doesn't exist | every `<button>`/`<a>` recorded with destination class | `ButtonProbe` clicks each button in an isolated tab, classifies result as `route|modal|menu|download|external|dead`, records destination |
| GAP-11 No action-menu enumeration | per-row "..." menus | doesn't exist | menu items captured per row | `ActionMenuProbe` opens each trigger, captures item list, closes menu cleanly |
| GAP-12 No info-banner capture | `/dealers/users` "Please Note - Multiple users share the same reset email…" | absent on clone | live banner appears verbatim above filter panel | `LeafAnalyzer.pageInfoBanners` captures `[role=alert]`, `[class*=alert\|notice\|warning\|banner]` and "Please Note …" paragraphs; renderer emits them above panels |
| GAP-13 No totals/filter row detection | `/reports/accounts/banking/bank-summary` | absent | totals row + filter row rendered | grid extractor checks for `tfoot`, `tr.totals`, `tr.row-totals`, filter row above thead |
| GAP-14 No section-landing classification | `/diary`, `/sales-enquiries`, `/click-leads` | every URL treated equally | section landings are hand-built and exempt from leaf gates | `kind:"section-landing"` marker in config or computed; audit Gate 2/3/4/5/7 are exempt for these |
| GAP-15 No endpoint classification | print/CSV/download URLs (e.g. `/aftersales_jobcard_print.php`) | crawler would 404 or hang | marked `kind:"endpoint"` and excluded from leaf gates | `mark-endpoints` step + URL-pattern rules in config (R2: per-site config OK) classify download/redirect/dynamic-detail URLs |
| GAP-16 No URL-pattern dedupe | `/vehicles/7917545`, `/vehicles/7917546`, … | each crawled separately | collapsed to `/vehicles/:id` | `Queue` reads `dedupe[]` rules from config, rewrites URLs before queueing |
| GAP-17 No clone-tree emission from manifest | every page | hand-coded by agent | every non-exempt leaf has `src/app/<path>/page.tsx` generated from the manifest | `renderer/Scaffold` walks the manifest and emits one route file + one component file per leaf, picking a shape per `kind` |
| GAP-18 No audit / diff | every page | doesn't exist | `audit-v7` 14 gates (1-8, 10-14, 16) | `audit/Diff` runs configurable checks per leaf, emits `AUDIT.json` with `gaps[]`; each check lives in `audit/checks/<name>.ts` |
| GAP-19 No self-extending audit | a new gap class shows up | doesn't exist | new check added before new gap is fixed | check directory is just files; engine auto-registers; R10 forces "add check, confirm fail, fix engine, confirm pass" sequence |
| GAP-20 No column-semantic mock | `/dealers/users` Manager column showed "£18,995" | doesn't exist | column-semantic classifier (people/vehicle/currency/date/status/ref) + matched mock pools | renderer's mock-row synthesizer classifies each column header and picks from a typed pool; em-dash fallback for unclassified |
| GAP-21 No column-label whitespace preservation | `<th>Reset<br>Email</th>` → "ResetEmail" | doesn't exist | space-preserving extractor | text-extraction treats `<br>` as space and collapses whitespace runs |
| GAP-22 No near-duplicate table merge | `/dealers/users` two tables: 27 cols + 25 cols sharing 24 | both kept or one dropped | merged to 28-col union | `GridExtractor` post-pass: tables with column-set Jaccard ≥ 0.85 are merged; clone audit accepts a clone table as a superset of a live table |
| GAP-23 No input-kind / value parity check | clone renders `<select>` "Roy Sharf" in a checkbox-shaped column | doesn't exist | Gate 16 catches kind drift | audit Gate `input-kind-vs-rendered-value` pairs tables by column sequence and compares per-col kind |
| GAP-24 No empty-state row skip in classification | empty-state "No legacy enquiries to display." trips date classifier | doesn't exist | empty-state rows (colspan-spanning) are skipped | classifier checks for "fewer cells than cols" rows + specific empty-state phrase patterns |
| GAP-25 No anti-pattern ban list | mock strings like "Workshop lift servicing" re-appearing | doesn't exist | `anti-patterns.json` + CI grep | R20 mechanism: monotonically-growing pattern list; CI fails on any match in src/manifest/shipped |
| GAP-26 No judgment hooks | "is column 'Date' actually a date or a label?" | doesn't exist | `judge()` calls with prompts | R17 `Judge` module with prompt + schema + 3-retry + cache + persistent-failure log |
| GAP-27 No visual diff | screenshots vs. clone screenshots | doesn't exist | Gate 10 pixelmatch with 12% threshold + section-landing exemption | `audit/checks/visual-diff.ts` runs pixelmatch, threshold from config, exempt section-landing |
| GAP-28 No queue-state persistence | crash mid-crawl | doesn't exist | every URL ends in one terminal state; `queue-state.json` persisted | `Queue.terminalStates[]` records `captured|404|redirected|blocked|dead` per URL; debounced flush; resume reads file (R11+R12) |
| GAP-29 No "scope-remediation" judge for sticky gaps | same gap fails 3 loops in a row | doesn't exist | the engine should call judge to scope a new approach | R17/Phase 5 stickiness breaker: `judge({ prompt: "scope-remediation", input: {...} })` returns `{ action: "fix-engine-module" \| "add-judge-prompt" \| "update-site-config" \| "mark-gold-quirk" }` |
| GAP-30 No anti-flake re-verify | one clean run is enough | doesn't exist | TWO consecutive cold clean runs (`cleanRuns=2`) | Phase 5 loop in CLI: after a clean run, `--fresh` re-run; both must be clean before exit |

## Coverage check

Section 2's gap-class table contains 30 entries. Every row above maps to
one or more of those classes. Section 4's engine-design names a module
for each. No gap from section 2 is missing a module.
