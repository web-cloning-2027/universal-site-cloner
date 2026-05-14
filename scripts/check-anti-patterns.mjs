#!/usr/bin/env node
/**
 * R20 enforcement: grep the repo for any pattern in anti-patterns.json.
 * Run from CI on every push. Exits non-zero on any match.
 *
 * Scope per pattern.context:
 *   "src"      → grep src-engine/ src/ scripts/
 *   "manifest" → grep wet-test-output/**.json if it exists
 *   "shipped"  → grep wet-test-output/ + src/ + src-engine/
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cfg = JSON.parse(
  readFileSync(resolve(repoRoot, "anti-patterns.json"), "utf-8"),
);

const scopes = {
  src: ["src/", "src-engine/", "scripts/"],
  manifest: ["wet-test-output/"],
  shipped: ["src/", "src-engine/", "scripts/", "wet-test-output/"],
};

let total = 0;
let failed = 0;

for (const p of cfg.patterns) {
  const targets = (scopes[p.context] || scopes.shipped).filter((dir) =>
    existsSync(resolve(repoRoot, dir)),
  );
  if (targets.length === 0) continue;

  // Detect regex form /.../ vs. literal
  let useRegex = false;
  let raw = p.pattern;
  if (raw.startsWith("/") && raw.endsWith("/") && raw.length > 2) {
    useRegex = true;
    raw = raw.slice(1, -1);
  }

  const flag = useRegex ? "-E" : "-F";
  const args = [
    "grep",
    "-rI",
    flag,
    "--",
    JSON.stringify(raw),
    ...targets,
  ].join(" ");

  let output = "";
  try {
    output = execSync(args, { cwd: repoRoot, encoding: "utf-8" });
  } catch (err) {
    // grep exits 1 when no match — that's success for us.
    output = err.stdout ? err.stdout.toString() : "";
  }

  total++;
  if (output.trim().length > 0) {
    failed++;
    console.error(`MATCH for anti-pattern "${p.pattern}" (gap ${p.addedBecauseOfGap}):`);
    console.error(output);
    console.error("---");
  }
}

if (failed > 0) {
  console.error(`anti-pattern check: ${failed}/${total} patterns matched. Failing.`);
  process.exit(1);
} else {
  console.log(`anti-pattern check: ${total} patterns, 0 matches. OK.`);
}
