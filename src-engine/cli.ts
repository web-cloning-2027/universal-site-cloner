#!/usr/bin/env node
/**
 * universal-site-cloner CLI.
 *
 *   universal-site-cloner clone <config.json>  --out <dir>  [--fresh]
 *   universal-site-cloner audit --clone <dir>  --live <path>
 *                              [--reference <dir>]  [--report-only]
 *                              [--out AUDIT.json]
 *
 * R4: the audit's diff target is the LIVE-SITE capture from the same
 * wet-test run (--live), NOT a hand-iterated clone. --reference is
 * report-only (any gaps surfaced are tagged minor and never gate
 * cleanRuns).
 *
 * Phase 3 hits `clone`. Phase 4 hits `audit`. Phase 5 loops both with
 * `--fresh` between cold runs.
 *
 * R7b — KeycloakHandoffAuth uses the `handoff` callback below to ask
 * Roy in stdout/stdin. That is the ONE allowed human interaction
 * outside GitHub PAT issues.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { Command } from "commander";
import { chromium } from "playwright";

import { buildAuthStrategy, type AuthHandoffPrompt } from "./auth/index.js";
import { LeafAnalyzer } from "./analyzer/index.js";
import { Crawler } from "./crawler/Crawler.js";
import { AuditEngine } from "./audit/Diff.js";
import { loadConfig } from "./config.js";
import { ProgressLog } from "./log.js";
import { Scaffold } from "./renderer/Scaffold.js";

async function readlineConfirm(message: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(message);
  // eslint-disable-next-line no-console
  console.log("Reply with 'logged in' (or any input) when done...");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolveFn) => {
    rl.question("> ", () => {
      rl.close();
      resolveFn();
    });
  });
}

async function cmdClone(args: {
  configPath: string;
  outDir: string;
  fresh?: boolean;
}): Promise<void> {
  const cfg = loadConfig(args.configPath);
  const outDir = resolve(args.outDir);
  const log = new ProgressLog(
    resolve(process.cwd(), "docs/research/engine-progress.log"),
  );
  log.write({ phase: "3.0", action: "clone-start", result: cfg.name, outDir });

  const auth = buildAuthStrategy(cfg.auth);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await auth.authenticate({
      browser,
      workDir: outDir,
      configName: cfg.name,
      handoff: async (prompt: AuthHandoffPrompt) => readlineConfirm(prompt.message),
    });
    log.write({ phase: "3.1", action: "auth-ok", result: auth.name });

    const analyzer = new LeafAnalyzer({ hints: cfg.hints });
    const crawler = new Crawler({
      configName: cfg.name,
      context,
      crawlerConfig: cfg.crawler,
      analyzer,
      workDir: outDir,
      log,
      fresh: args.fresh,
    });

    const { manifest, blockedCount } = await crawler.run();
    log.write({
      phase: "3.2",
      action: "crawl-done",
      result: `${manifest.leafCount}`,
      blocked: blockedCount,
    });

    // R4: emit live-manifest.json explicitly (this IS the live-site
    // capture from the same run; the audit will diff against it).
    writeFileSync(
      resolve(outDir, "live-manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    // R4 Phase 3 step 6b: render the clone tree under outDir/clone/.
    const cloneDir = resolve(outDir, "clone");
    const scaffold = new Scaffold({ manifest, outDir: cloneDir });
    const emit = scaffold.emit();

    // R4: re-capture what the renderer ACTUALLY emitted from the .tsx
    // source files (not what it was told to emit). This is the
    // engine's side of the diff — losses from shape selection or
    // component templating become visible.
    const { reCaptureCloneManifest } = await import("./renderer/reCapture.js");
    const cloneManifest = reCaptureCloneManifest(cloneDir, cfg.name);
    writeFileSync(
      resolve(cloneDir, "manifest.json"),
      JSON.stringify(cloneManifest, null, 2),
    );
    log.write({
      phase: "3.3",
      action: "scaffold-done",
      result: `${emit.routesEmitted} routes / ${emit.componentsEmitted} components`,
    });

    // Final R13 print.
    const finalState = JSON.parse(
      readFileSync(resolve(outDir, "queue-state.json"), "utf-8"),
    ) as {
      pending: unknown[];
      terminal: Record<string, { terminalState: string }>;
    };
    const hist: Record<string, number> = {};
    for (const t of Object.values(finalState.terminal)) {
      hist[t.terminalState] = (hist[t.terminalState] || 0) + 1;
    }
    // eslint-disable-next-line no-console
    console.log("terminal-state histogram:", hist);
    if (blockedCount > 0) {
      // eslint-disable-next-line no-console
      console.error(`NON-CLEAN: ${blockedCount} URLs in blocked state. See queue-state.json.`);
      process.exit(2);
    }
  } finally {
    await browser.close();
  }
}

async function cmdAudit(args: {
  cloneDir: string;
  liveManifestPath: string;
  referenceDir?: string;
  reportOnly?: boolean;
  out?: string;
}): Promise<void> {
  const auditOut = args.out ?? resolve(args.cloneDir, "AUDIT.json");
  const repoRoot = resolve(process.cwd());
  const engine = new AuditEngine(repoRoot);
  const report = await engine.run({
    cloneDir: resolve(args.cloneDir),
    liveManifestPath: resolve(args.liveManifestPath),
    referenceDir: args.referenceDir ? resolve(args.referenceDir) : undefined,
    reportOnly: args.reportOnly,
  });
  AuditEngine.writeReport(report, auditOut);
  const blocker = report.gaps.filter((g) => g.severity === "blocker").length;
  const major = report.gaps.filter((g) => g.severity === "major").length;
  // eslint-disable-next-line no-console
  console.log(
    `audit: ${report.totalGaps} gaps (blocker=${blocker} major=${major}) → ${auditOut}`,
  );
  if (report.totalGaps > 0) {
    for (const g of report.gaps.slice(0, 20)) {
      // eslint-disable-next-line no-console
      console.log(`  [${g.severity}] ${g.check}::${g.kind}  ${g.url || ""}  ${g.detail}`);
    }
    // R4: only blocker+major gate cleanRuns. Minor (incl. all
    // --report-only diffs against --reference) is informational.
    if (blocker + major > 0 && !args.reportOnly) {
      process.exit(2);
    }
  }
}

const program = new Command();
program
  .name("universal-site-cloner")
  .description("Generic web-cloning engine. R1-R21 of the build prompt.")
  .version("0.1.0");

program
  .command("clone")
  .argument("<config>", "site config JSON path")
  .requiredOption("--out <dir>", "wet-test output directory")
  .option("--fresh", "start a new crawl from zero, ignoring any queue-state.json", false)
  .action(async (config: string, opts: { out: string; fresh: boolean }) => {
    if (existsSync(opts.out) && opts.fresh) {
      // R3: rm -rf is the caller's job; we just ignore prior state.
      // eslint-disable-next-line no-console
      console.log(`--fresh: ignoring any prior queue-state.json in ${opts.out}`);
    }
    await cmdClone({ configPath: config, outDir: opts.out, fresh: opts.fresh });
  });

program
  .command("audit")
  .description(
    "diff engine clone tree vs same-run live-site capture (R4). " +
      "Optional --reference vs an existing hand-iterated clone is report-only.",
  )
  .requiredOption("--clone <dir>", "directory containing the emitted clone tree")
  .requiredOption("--live <path>", "path to live-manifest.json from the same run")
  .option("--reference <dir>", "optional reference clone dir (report-only)")
  .option("--report-only", "downgrade all gaps to minor; never exit nonzero")
  .option("--out <path>", "where to write AUDIT.json (default: <clone-dir>/AUDIT.json)")
  .action(
    async (opts: {
      clone: string;
      live: string;
      reference?: string;
      reportOnly?: boolean;
      out?: string;
    }) => {
      await cmdAudit({
        cloneDir: opts.clone,
        liveManifestPath: opts.live,
        referenceDir: opts.reference,
        reportOnly: opts.reportOnly,
        out: opts.out,
      });
    },
  );

await program.parseAsync(process.argv);
