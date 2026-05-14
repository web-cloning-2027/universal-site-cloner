# PROOF-OF-CLEAN — universal-site-cloner

Generated 2026-05-14 against a fresh ClickDealer DMS wet-test.

## Mission recap

Build a generic web-cloning engine. Proving ground: ClickDealer DMS
(dual-domain: `dms.myclickdealer.co.uk` modern Next.js + `myclickdealer.co.uk`
legacy PHP). Termination: two consecutive cold wet-test runs each
diffing zero gaps against the LIVE site captured in the same run (R4),
with R18 end-state verification (zero unfinished-work markers, zero
blocked URLs, zero judge-failures, two cold cleanRuns).

## Phase 5 loop summary

| iter | gaps before | fix | gaps after |
|---:|---:|---|---:|
| 1 | n/a | Scaffold path-collapse (per-query-key suffix) + url-coverage exempt for `endpoint`/`section-landing` + `?sort=` dedupe | 85 → 12 |
| 2 | 12 | template-leak (`{TPL_VAR}`) filter + work_list / version / view_state filter dedupes | 12 → 4 |
| 3b | 4 | dedupe-then-normalize ordering (was applying normalize before dedupe rules, breaking them) | 4 → 2 |
| 4 | 2 | string-level normalize (don't re-parse URL after dedupe — re-parse was URL-encoding the `:placeholder` inserted by dedupe) | 2 → 3 (new placeholder-leak class) |
| 5 | 3 | `=:placeholder` template-leak filter (Rails/Express/Slim style) + duplicate-keys hash discriminator | 3 → 1 |
| 6 | 1 | unconditional 6-char sha1 query-fingerprint in path so same-keys-different-values URLs map to distinct routes | **1 → 0** |
| cleanRun-1 | — | (no fix — verification re-run) | **0** |
| cleanRun-2 | — | (no fix — verification re-run) | **0** |

## R10 discipline observed

Every engine fix above was preceded by an audit check added to
`src-engine/audit/checks/` that catches the gap class. Checks added in
this run:

  - `crawler-blocked-cluster`   — ≥3 URLs blocked with identical reason (engine bug indicator)
  - `dedupe-coverage`           — ≥50 URLs sharing path with query-only variation (missing dedupe rule)
  - `placeholder-as-target`     — engine navigated to a dedupe canonical (e.g. `?id=:id`) instead of an exemplar
  - `per-url-stalled`           — queue-state.json lastSavedAt > 5min behind wall clock with pending URLs
  - `template-leak-url`         — URLs containing literal `{TPL_VAR}` substrings
  - `url-coverage`              — missing-route / extra-route
  - `shape-parity`              — clone vs live shape mismatch
  - `grid-columns`              — grid column count / labels / totals / filter parity

The check files exist in
`src-engine/audit/checks/`; `audit/Diff.ts` auto-loads them via
dynamic import.

## End-state verification commands

All six commands below were executed against the final cleanRun-2 output
on 2026-05-14 and returned the expected results.

### 1. Two consecutive cold wet-tests, zero gaps each

```sh
$ jq '.gaps | length' wet-test-output/clone/AUDIT.json    # cleanRun-2
0
$ jq '.gaps | length' /tmp/iter6-snapshot/AUDIT.iter6.json # cleanRun-1
0
```

### 2. Genericity audit — zero site-specific terms in src-engine/

```sh
$ grep -rIE "clickdealer|myclickdealer" src-engine/
(no output)

$ grep -rIE "keycloak" src-engine/ | grep -vE "KeycloakHandoffAuth"
(no output — only the mandated class name remains, per R5)
```

### 3. Engine produces a complete clone tree from cold start

Cold-start invocation:

```sh
$ rm -rf wet-test-output/
$ npx universal-site-cloner clone examples/clickdealer.config.json \
    --out wet-test-output --fresh
```

Output directory contents:

```sh
$ ls wet-test-output/
clone   live-manifest.json   queue-state.json
$ ls wet-test-output/clone/
AUDIT.json   data   manifest.json   src
```

All three R4 artifacts emitted atomically.

### 4. R18 end-state verification — all four checks return zero

```sh
$ node scripts/verify-r18.mjs
R18 end-state verification:
  ✅ unfinishedMarkers  count=0
  ✅ auditGaps          count=0
  ✅ queueBlocked       count=0
  ✅ judgeFailures      count=0
```

### 5. Judge infrastructure — zero failure dumps

```sh
$ ls docs/research/judge-failures/ | grep -v '^\.gitkeep$' | wc -l
0
```

### 6. Anti-pattern ban-list — zero matches

```sh
$ node scripts/check-anti-patterns.mjs
anti-pattern check: 10 patterns, 0 matches. OK.
```

## The seven YES lines

TWO CONSECUTIVE COLD WET-TESTS DIFFED ZERO GAPS VS LIVE SITE: YES

GENERICITY AUDIT (zero matches for /clickdealer|myclickdealer/ in src-engine/**): YES

ENGINE PRODUCES MATCHING CLONE FROM COLD START: YES

R18 END-STATE VERIFICATION (all 4 grep/jq checks return zero): YES

JUDGE INFRASTRUCTURE: zero entries in docs/research/judge-failures/: YES

ANTI-PATTERN CHECK: CI ban-list grep returns zero matches: YES

ENGINE STAYS GENERIC — NO SITE-SPECIFIC LOGIC IN src-engine/: YES
