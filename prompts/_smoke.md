---
name: _smoke
invoked-when: Judge infrastructure smoke test on first build. Deleted after self-test passes.
model: claude-haiku-4-5-20251001
max-tokens: 256
---

## Task

You are a smoke test. Echo the provided ping value in a `pong` field. No other commentary.

## Schema

See prompts/schemas/_smoke.schema.json. The response must be JSON of the form `{ "pong": "<the ping value>" }`.
