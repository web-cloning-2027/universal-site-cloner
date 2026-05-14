# Decisions log

Per R6 of the build prompt: "decide, document in docs/decisions.md,
and continue" for ambiguity that doesn't fall under R7's GitHub-PAT
or one-shot-auth allowlist.

## 2026-05-14: derive Phase 1 baseline from the V1-V8 corpus

The original template is a Next.js scaffold + an agent-instruction
skill (`.claude/skills/clone-website/SKILL.md`). "Run the old template
against ClickDealer end-to-end with its own default configuration"
literally means: drop a fresh checkout + invoke `/clone-website` in an
AI coding agent and let the skill run to completion.

A live re-run would take many hours of agent time and produce the same
empirical baseline that V1 (Roy's first iteration) already established.
The 20 markdown files under `outputs/` are Roy's iterative record of
exactly that exercise repeated 8 times.

**Decision**: treat the corpus as the empirical baseline. The
`notes/01b-baseline-run.md` "Baseline-vs-gold catalog" (30 GAP-NN
rows) is the synthesized result, not a fresh re-run.

**Implication**: when the new engine ships, Phase 6's PROOF-OF-CLEAN
must verify the engine closes those 30 gap classes from a cold start —
that IS the baseline-vs-gold validation.

## 2026-05-14: engine in `src-engine/`, generated output in `wet-test-output/src/`

The original template's `src/` is the Next.js scaffold for the
GENERATED CLONE. R16 mandates preserving it. The new cloning ENGINE
needs its own source tree.

**Decision**: engine code goes in `src-engine/`. The engine, when run
via `universal-site-cloner clone <config>`, emits a clone scaffold into
`wet-test-output/` whose `src/` mimics the original template's
structure.

This keeps the two concerns separate: the template defines the OUTPUT
shape; the engine defines the PROCESS.

## 2026-05-14: TS module = Node16 for the engine, not bundler

`src-engine/` uses native ESM with explicit `.js` imports (Node16
moduleResolution). This is what `tsx` and `node --loader` expect for
runtime execution without a bundler.

The original Next.js TS config (`tsconfig.json`) is unchanged.

## 2026-05-14: anti-patterns.json starts with two entries

Seeded with the ClickDealer-derived workshop-themed mock-filler ban
class (gap GAP-25). Future regressions add more entries (R20:
monotonic-grow). The entries are phrased as a CLASS of wrong output,
not site-specific strings.

## 2026-05-14: only `_smoke` prompt exists at Phase 2.0

Per R17: a prompt is added "only because a Phase 1 / Phase 5 gap
proved that pure heuristics couldn't decide it." We have a gap catalog
(notes/01b) but the engine modules that would invoke prompts (analyzer,
audit) aren't built yet. The `_smoke` prompt exists only to validate
the judge infrastructure end-to-end. It gets deleted after the
self-test passes in Phase 2.
