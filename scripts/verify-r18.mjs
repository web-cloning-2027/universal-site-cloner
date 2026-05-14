#!/usr/bin/env node
/**
 * R18 end-state verification.
 *
 *   1. No unfinished-work markers anywhere in src/, src-engine/,
 *      docs/, scripts/, examples/. The grep pattern matches a fixed
 *      vocabulary of "this is incomplete" tokens. Documentation files
 *      that DESCRIBE the patterns (without using them) are not flagged.
 *   2. wet-test-output/clone/AUDIT.json gap count == 0
 *   3. wet-test-output/queue-state.json blocked count == 0
 *   4. docs/research/judge-failures/ is empty
 *
 * Exits 0 if all 4 pass, 1 otherwise.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");

const checks = {};

// 1. Unfinished-work grep. Match the literal token followed by
//    : or whitespace-newline (filtering documentation-only mentions).
const PATTERN = "\\b(?:TODO|FIXME|XXX|HACK|spot-check|to be reviewed|manual pass|Roy to verify|needs review)\\b\\s*[:.]";
try {
  const out = execSync(
    `grep -rIEn '${PATTERN}' src/ src-engine/ docs/ scripts/ examples/ 2>/dev/null || true`,
    { cwd: repo, encoding: "utf-8" },
  );
  const lines = out.trim().split("\n").filter(Boolean);
  // Exclude self-references in this very script.
  const real = lines.filter(
    (l) => !l.startsWith("scripts/verify-r18.mjs"),
  );
  checks.unfinishedMarkers = { pass: real.length === 0, count: real.length, sample: real.slice(0, 5) };
} catch (err) {
  checks.unfinishedMarkers = { pass: false, error: String(err) };
}

// 2. AUDIT.json gap count.
const auditPath = resolve(repo, "wet-test-output/clone/AUDIT.json");
if (existsSync(auditPath)) {
  const audit = JSON.parse(readFileSync(auditPath, "utf-8"));
  const count = (audit.gaps || []).length;
  checks.auditGaps = { pass: count === 0, count };
} else {
  checks.auditGaps = { pass: false, error: "AUDIT.json missing — run audit first" };
}

// 3. queue-state.json blocked count.
const qsPath = resolve(repo, "wet-test-output/queue-state.json");
if (existsSync(qsPath)) {
  const qs = JSON.parse(readFileSync(qsPath, "utf-8"));
  const blocked = Object.values(qs.terminal || {}).filter(
    (t) => t.terminalState === "blocked",
  );
  checks.queueBlocked = { pass: blocked.length === 0, count: blocked.length };
} else {
  checks.queueBlocked = { pass: false, error: "queue-state.json missing — run clone first" };
}

// 4. judge-failures empty.
const jfDir = resolve(repo, "docs/research/judge-failures");
const jfFiles = existsSync(jfDir)
  ? readdirSync(jfDir).filter((f) => !f.startsWith("."))
  : [];
checks.judgeFailures = { pass: jfFiles.length === 0, count: jfFiles.length };

const allPass = Object.values(checks).every((c) => c.pass);
console.log("R18 end-state verification:");
for (const [k, v] of Object.entries(checks)) {
  const mark = v.pass ? "✅" : "❌";
  const detail =
    v.count !== undefined ? `count=${v.count}` : v.error || "";
  console.log(`  ${mark} ${k}  ${detail}`);
  if (!v.pass && v.sample) {
    for (const s of v.sample) console.log(`      ${s}`);
  }
}
process.exit(allPass ? 0 : 1);
