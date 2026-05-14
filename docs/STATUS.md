# STATUS — universal-site-cloner build progress

Living document, updated each session. Replaces "where did we leave
off?" — anyone resuming the build pulls this first.

## Mission

Build the generic web-cloning engine specified in the NEW-GENERIC-CLONER-REPO
prompt. Proving ground: ClickDealer DMS. Termination: two consecutive
cold wet-test runs against the gold-standard clone at
`/Users/roysharf/Desktop/websitr cloaning/clickdealer-clone` produce
zero gaps, with R18 end-state verification (zero TODOs, zero blocked,
zero judge-failures, two clean cold runs).

## Phase board

| Phase | Status | Notes |
|---|---|---|
| 0 — workspace + repo + .gitignore | ✅ pushed | template history preserved as commit #1; remote=web-cloning-2027/universal-site-cloner |
| 1 — notes/01..03 | ✅ in `docs/research/notes/` | template audit, baseline-vs-gold catalog (30 GAP-NN rows), V1-V8 synthesis, engine design |
| 2.0 — judge infra + anti-patterns + CI | ✅ pushed | `src-engine/judge/` (dispatcher, cache, schema validation, retry, failure dump); `anti-patterns.json`; CI jobs (anti-pattern grep, genericity audit, prompt self-tests) |
| 2 — auth strategies | 🚧 next | NoAuth, BasicAuth, CookieJarAuth, KeycloakHandoffAuth |
| 2 — Queue + Navigator + Crawler | 🚧 pending | BFS, allowlist, `:id` dedupe, resumable, exponential-backoff retry, terminal-state tracking |
| 2 — Analyzer (Leaf/Form/Grid/Tab/Button/ActionMenu) | 🚧 pending | shape classifier + extractors + recursive tab walker |
| 2 — Renderer (Scaffold + shapes) | 🚧 pending | emits Next.js routes + components per manifest |
| 2 — Audit/Diff + initial checks | 🚧 pending | check files in `src-engine/audit/checks/` |
| 2 — CLI | 🚧 pending | `universal-site-cloner clone <config>` + `audit <clone-dir> <gold-dir>` |
| 3 — cold wet-test vs ClickDealer | ⏳ blocked on Phase 2 | needs Keycloak one-shot auth handoff (R7b, only ask Roy this once) |
| 4 — diff vs gold | ⏳ blocked on Phase 3 | `audit/Diff` produces `wet-test-output/AUDIT.json` |
| 5 — loop until cleanRuns=2 | ⏳ blocked on Phase 4 | max 24h; sticky-gap breaker via `scope-remediation` prompt |
| 6 — PROOF-OF-CLEAN.md | ⏳ blocked on Phase 5 | six-line YES-only summary |

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
grep -rIE "TODO|FIXME|XXX|HACK|Roy to verify|needs review|manual pass|to be reviewed|spot-check" src/ docs/ scripts/ examples/
# → zero matches

jq '.gaps | length' "$WORKDIR/wet-test-output/AUDIT.json"
# → 0

jq '[.[] | select(.terminalState=="blocked")] | length' "$WORKDIR/wet-test-output/queue-state.json"
# → 0

ls docs/research/judge-failures/ 2>/dev/null | wc -l
# → 0
```

Two consecutive cold runs satisfying all four = cleanRuns=2.
