# STATUS — universal-site-cloner build progress

Living document, updated each session. Replaces "where did we leave
off?" — anyone resuming the build pulls this first.

## Mission

Build the generic web-cloning engine specified in the NEW-GENERIC-CLONER-REPO
prompt. Proving ground: ClickDealer DMS. Termination: two consecutive
cold wet-test runs where the engine-emitted clone tree diffs zero gaps
against the LIVE SITE capture from the SAME run (R4), with R18 end-state
verification (zero TODOs, zero blocked, zero judge-failures, two clean
cold runs).

**R4 update (2026-05-14)**: the existing hand-iterated
`/Users/roysharf/Desktop/websitr cloaning/clickdealer-clone` is a
LEARNING REFERENCE ONLY — never the pass/fail target. The diff
compares the engine's clone tree against the live-manifest.json
captured in the same wet-test invocation. Using the hand-clone would
let its known gaps (35-140 found in audit-v7) propagate silently.

## Phase board

| Phase | Status | Notes |
|---|---|---|
| 0 — workspace + repo + .gitignore | ✅ pushed | template history preserved as commit #1; remote=web-cloning-2027/universal-site-cloner |
| 1 — notes/01..03 | ✅ in `docs/research/notes/` | template audit, baseline-vs-gold catalog (30 GAP-NN rows), V1-V8 synthesis, engine design |
| 2.0 — judge infra + anti-patterns + CI | ✅ pushed | `src-engine/judge/` (dispatcher, cache, schema validation, retry, failure dump); `anti-patterns.json`; CI jobs (anti-pattern grep, genericity audit, prompt self-tests) |
| 2 — auth strategies (4 impls) | ✅ pushed | NoAuth, BasicAuth, CookieJarAuth, KeycloakHandoffAuth (one-shot R7b handoff, persists `~/.config/universal-site-cloner-sessions/<name>/state.json`) |
| 2 — Queue + Navigator + Crawler | ✅ pushed | BFS, allowlist regex, `:id` dedupe, resumable durable state (R12), exponential-backoff retry, full terminal-state tracking (R11) |
| 2 — Analyzer (8 modules) | ✅ pushed | LeafAnalyzer + FormExtractor + GridExtractor (with Jaccard ≥0.85 merge) + BannerExtractor + TabRecursor + ButtonProbe + ActionMenuProbe + classifyShape |
| 2 — Renderer (Scaffold + 5 shape templates) | ✅ pushed | emits Next.js routes + components per manifest; copies shape templates verbatim into output |
| 2 — Audit/Diff + 3 initial checks | ✅ pushed (R4-compliant) | `Diff.ts` + `checks/{url-coverage, shape-parity, grid-columns}.ts`; auto-loads via dynamic import; **diff target = LIVE-from-same-run, not hand-clone (R4)** |
| 2 — CLI | ✅ pushed (R4-compliant) | `clone <config> --out <dir> [--fresh]` + `audit --clone <dir> --live <path> [--reference <dir>] [--report-only] [--out <path>]` |
| 2 — examples + scope-remediation prompt | ✅ pushed | `examples/clickdealer.config.json` + `examples/simple-static-site.config.json`; `prompts/scope-remediation.md` + schema + test (action enum includes `mark-live-volatile`, not `mark-gold-quirk` per R4) |
| **3.1 — auth pre-check (R7b one-shot if needed)** | 🚧 **now** | verify `~/.config/universal-site-cloner-sessions/clickdealer/state.json`; probe `/dealers/users` → 200 + sidebar; re-handoff if stale (8-12h SSO rotation) |
| 3.2 — cold wet-test invocation | ⏳ blocked on 3.1 | `rm -rf wet-test-output/`; emit 3 artifacts atomically: `live-manifest.json`, `clone/`, `queue-state.json`; expect 3-8h first run |
| 3.3 — completion check | ⏳ blocked on 3.2 | `queue-state.json` blocked count must be 0 (R11) |
| 4 — diff engine clone vs same-run live | ⏳ blocked on Phase 3 | `audit --clone wet-test-output/clone --live wet-test-output/live-manifest.json`; **P4.2 R4 integrity check** before Phase 5 starts |
| 5 — loop until cleanRuns=2 | ⏳ blocked on Phase 4 | R10 check-first discipline (add check → confirm fail → fix → confirm pass); sticky-threshold=2 on first cold run, 3 thereafter; gap classification ∈ {ENGINE-GAP, CONFIG-GAP, LIVE-VOLATILE} (no "gold-quirk" — R4) |
| 6 — PROOF-OF-CLEAN.md | ⏳ blocked on Phase 5 | seven-line YES-only summary; line 1 = "DIFFED ZERO GAPS VS LIVE SITE: YES" |

## How to resume

```sh
cd "$WORKDIR"
git clone https://github.com/web-cloning-2027/universal-site-cloner.git
cd universal-site-cloner
git pull                       # always
cat docs/STATUS.md             # this file
cat docs/research/notes/03-engine-design.md   # the architectural plan
```

Next session: start at the next 🚧 row. Each module from
`notes/03-engine-design.md` maps a gap from `notes/01b-baseline-run.md`
or `notes/02-lessons-from-clickdealer.md` — commit body must reference
the GAP-NN it closes (R16).

## Decisions log

Lives at `docs/decisions.md`. Major decisions so far:

| date | decision | rationale |
|---|---|---|
| 2026-05-14 | Phase 1 baseline is derived from V1-V8 corpus, not a fresh skill re-run | Running the template's `/clone-website` skill against the live DMS end-to-end would itself take a multi-hour agent session and just reproduce V1's state. The synthesis already documents every gap class. R6 says decide-and-document when unsure. |
| 2026-05-14 | Engine code lives in `src-engine/`, not `src/` | `src/` is the original template's Next.js scaffold (preserved per R16). `src-engine/` is the new CLI-driven cloning engine. The engine GENERATES files into a sibling `src/`-shaped tree at `wet-test-output/`. |
| 2026-05-14 | TS module mode = Node16 for the engine | Top-level await, ESM imports of `.js` extensions, plays nicely with `tsx` for dev. Original Next.js TS config is unchanged. |

## R18 end-state verification (engine isn't done until all 4 pass)

```sh
grep -rIE "TODO|FIXME|XXX|HACK|Roy to verify|needs review|manual pass|to be reviewed|spot-check" src/ src-engine/ docs/ scripts/ examples/
# → zero matches

# R4: AUDIT.json comes from `audit --clone <dir> --live <live-manifest.json>`,
# i.e. engine clone vs same-run live capture. Not vs the hand clone.
jq '.gaps | length' "$WORKDIR/wet-test-output/clone/AUDIT.json"
# → 0

jq '[.[] | select(.terminalState=="blocked")] | length' "$WORKDIR/wet-test-output/queue-state.json"
# → 0

ls docs/research/judge-failures/ 2>/dev/null | wc -l
# → 0
```

Two consecutive cold runs satisfying all four = cleanRuns=2.
