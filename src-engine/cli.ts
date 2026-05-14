#!/usr/bin/env node
/**
 * universal-site-cloner CLI.
 *
 *   universal-site-cloner clone <config.json>  --out <dir>  [--fresh]
 *   universal-site-cloner audit <clone-dir> <gold-dir>      [--out AUDIT.json]
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

    writeFileSync(
      resolve(outDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    const scaffold = new Scaffold({ manifest, outDir });
    const emit = scaffold.emit();
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
  goldDir: string;
  out?: string;
}): Promise<void> {
  const auditOut = args.out ?? resolve(args.cloneDir, "AUDIT.json");
  const repoRoot = resolve(process.cwd());
  const engine = new AuditEngine(repoRoot);
  const report = await engine.run({
    cloneDir: resolve(args.cloneDir),
    goldDir: resolve(args.goldDir),
  });
  AuditEngine.writeReport(report, auditOut);
  // eslint-disable-next-line no-console
  console.log(`audit: ${report.totalGaps} gaps written to ${auditOut}`);
  if (report.totalGaps > 0) {
    for (const g of report.gaps.slice(0, 20)) {
      // eslint-disable-next-line no-console
      console.log(`  [${g.severity}] ${g.check}::${g.kind}  ${g.url || ""}  ${g.detail}`);
    }
    process.exit(report.gaps.some((g) => g.severity === "blocker") ? 2 : 1);
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
  .argument("<clone-dir>", "directory containing manifest.json from `clone`")
  .argument("<gold-dir>", "gold-standard directory")
  .option("--out <path>", "where to write AUDIT.json")
  .action(async (cloneDir: string, goldDir: string, opts: { out?: string }) => {
    await cmdAudit({ cloneDir, goldDir, out: opts.out });
  });

await program.parseAsync(process.argv);
