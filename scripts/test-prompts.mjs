#!/usr/bin/env node
/**
 * Runs every test JSON under prompts/tests/<name>.test.json against the
 * live Judge. Per R17's per-prompt SELF-TEST gate.
 *
 * Each test file is a JSON array of { name, input, expect } cases.
 * `expect` shape:
 *   { schemaOnly: true }                  — just validate schema passes
 *   { equals: <value> }                   — deep-equal check
 *   { predicate: "<JS expression>", description }
 *     — expression has `result`, `input` in scope; must evaluate truthy
 *
 * Exits 1 on any failure. CI uses this to gate merges.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const testsDir = resolve(repoRoot, "prompts/tests");
const workDir = resolve(repoRoot, ".prompt-test-workdir");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY not set — prompt self-tests require an API key.",
  );
  console.error("Set it locally or via CI secrets. Skipping is not allowed (R17).");
  process.exit(2);
}

// Use the engine's Judge via the compiled output if present, otherwise tsx.
let buildJudge;
try {
  ({ buildJudge } = await import(resolve(repoRoot, "dist/judge/index.js")));
} catch {
  // Fallback: register tsx so we can import .ts directly.
  const { register } = await import("node:module");
  register("tsx/esm", import.meta.url);
  ({ buildJudge } = await import(resolve(repoRoot, "src-engine/judge/index.ts")));
}

const judge = buildJudge({ repoRoot, workDir });
let failed = 0;
let passed = 0;

const testFiles = existsSync(testsDir)
  ? readdirSync(testsDir).filter((f) => f.endsWith(".test.json"))
  : [];
if (testFiles.length === 0) {
  console.log("(no prompt tests found)");
  process.exit(0);
}

for (const file of testFiles) {
  const promptName = basename(file, ".test.json");
  const cases = JSON.parse(readFileSync(resolve(testsDir, file), "utf-8"));
  for (const c of cases) {
    const label = `${promptName} :: ${c.name}`;
    try {
      const { result, meta } = await judge.call({
        prompt: promptName,
        input: c.input,
        // Always skip cache in tests so we exercise the validator on each run.
        skipCache: true,
      });

      const exp = c.expect || { schemaOnly: true };
      let pass = false;
      let reason = "";

      if (exp.schemaOnly) {
        pass = true;
      } else if ("equals" in exp) {
        pass = JSON.stringify(result) === JSON.stringify(exp.equals);
        if (!pass) reason = `expected ${JSON.stringify(exp.equals)}, got ${JSON.stringify(result)}`;
      } else if (exp.predicate) {
        // eslint-disable-next-line no-new-func
        const fn = new Function("result", "input", `return (${exp.predicate});`);
        pass = !!fn(result, c.input);
        if (!pass) reason = `predicate failed: ${exp.description || exp.predicate}`;
      } else {
        pass = false;
        reason = "no expect form provided";
      }

      if (pass) {
        passed++;
        console.log(`PASS  ${label}  retries=${meta.retries}  ${meta.fromCache ? "(cache)" : `(${meta.latencyMs}ms)`}`);
      } else {
        failed++;
        console.log(`FAIL  ${label}  ${reason}`);
      }
    } catch (err) {
      failed++;
      console.log(`FAIL  ${label}  ${err.message}`);
    }
  }
}

console.log(`\nresult: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
