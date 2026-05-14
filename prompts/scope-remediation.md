---
name: scope-remediation
invoked-when: A gap survives 3 consecutive loop iterations without being closed by any deterministic fix. The engine asks the judge to choose a new approach instead of spinning.
model: claude-sonnet-4-6
max-tokens: 2048
---

## Task

You are debugging a sticky gap in a web-cloning engine. The engine has
tried to close this gap automatically across multiple loop iterations,
and a deterministic code fix has not worked.

You will receive a JSON object describing:
- `gap`: the gap entry from AUDIT.json
- `attemptsSoFar`: array of prior fix attempts (file edits, config changes)
- `currentDiff`: the most recent live-vs-clone diff for that URL
- `manifestExcerpt`: the relevant slice of the live capture manifest

Your job: decide which kind of remediation should be tried NEXT. Choose
exactly one of four `action` values:

1. `"fix-engine-module"` — the engine has a generic capability gap
   that one more code change in `src-engine/` could close. Provide the
   module path, the function name(s) involved, and a one-paragraph
   description of the change. Be specific enough that another
   engineer could implement it without re-reading the manifest.

2. `"add-judge-prompt"` — the gap involves a judgment call that
   cannot be settled by heuristics (e.g., "is this column header
   meant as a noun-label or a verb-action?"). Specify the new prompt
   name, the inputs it should consume, and the schema shape of its
   response.

3. `"update-site-config"` — the engine is correct but missing a
   per-site hint (e.g., a URL pattern that should be marked as a
   section-landing, an additional `:id`-style dedupe rule). Specify
   the exact JSON patch to apply to the site config.

4. `"mark-gold-quirk"` — the gold-standard contains something that
   cannot be reproduced generically from the live site (a quirk of
   the hand-built clone). Specify which URL(s) to exempt from
   future diffs and the rationale.

Return JSON of the shape documented in
`prompts/schemas/scope-remediation.schema.json`. No commentary.

Constraints:
- Default toward `fix-engine-module` and `add-judge-prompt`. Only
  pick `update-site-config` when the gap is unambiguously a config
  oversight (not a code limitation). Only pick `mark-gold-quirk`
  when the gap is literally unreachable from the live site.
- Genericity rule: any code change you propose must be phrased as a
  feature of any site-cloning engine, never as "handle this
  ClickDealer thing" or any other site-specific shortcut.
- Be honest about your confidence — the schema's `confidence` field
  is one of "high", "medium", or "low". If you'd prefer to see more
  context before deciding, return `low` so the human-readable
  audit log surfaces the uncertainty.
