#!/usr/bin/env node
/**
 * R20 enforcement: walks the repo and tests every file's content
 * against each pattern in anti-patterns.json. Exits non-zero on any
 * match.
 *
 * Scope per pattern.context:
 *   "src"      → src-engine/, src/, scripts/
 *   "manifest" → wet-test-output/**.json
 *   "shipped"  → wet-test-output/ + src/ + src-engine/
 *
 * Uses Node's RegExp (full JS regex) instead of grep, so non-capturing
 * groups and lookarounds work. Per R20 the list is monotonic-grow —
 * this script only enforces, never relaxes.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
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

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".jsx", ".json", ".md", ".html", ".css", ".yml", ".yaml",
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = resolve(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(p, out);
    else if (s.isFile() && TEXT_EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

function compilePattern(raw) {
  if (raw.startsWith("/") && raw.endsWith("/") && raw.length > 2) {
    return new RegExp(raw.slice(1, -1));
  }
  // Literal — escape regex metachars.
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped);
}

let total = 0;
let failed = 0;

for (const p of cfg.patterns) {
  total++;
  const targets = (scopes[p.context] || scopes.shipped)
    .map((rel) => resolve(repoRoot, rel))
    .filter(existsSync);
  if (targets.length === 0) continue;
  let re;
  try {
    re = compilePattern(p.pattern);
  } catch (err) {
    console.error(`pattern "${p.pattern}" is invalid: ${String(err)}`);
    failed++;
    continue;
  }
  const matched = [];
  for (const dir of targets) {
    for (const file of walk(dir)) {
      // Don't recurse into anti-patterns.json itself.
      if (file.endsWith("anti-patterns.json")) continue;
      let body;
      try {
        body = readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      if (re.test(body)) matched.push(file.slice(repoRoot.length + 1));
    }
  }
  if (matched.length > 0) {
    failed++;
    console.error(
      `MATCH for anti-pattern "${p.pattern}" (gap ${p.addedBecauseOfGap}) in:`,
    );
    for (const f of matched.slice(0, 10)) console.error(`  ${f}`);
    if (matched.length > 10) console.error(`  ... and ${matched.length - 10} more`);
    console.error("---");
  }
}

if (failed > 0) {
  console.error(`anti-pattern check: ${failed}/${total} patterns matched. Failing.`);
  process.exit(1);
} else {
  console.log(`anti-pattern check: ${total} patterns, 0 matches. OK.`);
}
