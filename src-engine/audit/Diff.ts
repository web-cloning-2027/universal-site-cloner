/**
 * Audit dispatcher. Loads every check file from
 * src-engine/audit/checks/ and runs them in parallel against
 * (cloneManifest, goldManifest).
 *
 * R10: the check set grows monotonically. Each new check lives in
 * its own file under checks/, with a leading comment that names the
 * gap class it catches. Adding a check is preferred to extending an
 * existing one — pull-request reviewers should be able to see "what
 * new gap class did this run learn about?" at a glance.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { AuditReport, Check, CheckContext, Gap } from "./types.js";
import type { Manifest } from "../manifest.js";

export class AuditEngine {
  private readonly checksDir: string;

  constructor(private readonly repoRoot: string) {
    this.checksDir = resolve(repoRoot, "src-engine/audit/checks");
  }

  async loadChecks(): Promise<Check[]> {
    if (!existsSync(this.checksDir)) return [];
    const files = readdirSync(this.checksDir).filter(
      (f) =>
        (f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".mjs")) &&
        !f.endsWith(".d.ts") &&
        !f.startsWith("_"),
    );
    const checks: Check[] = [];
    for (const f of files) {
      const url = pathToFileURL(resolve(this.checksDir, f)).href;
      const mod = await import(url);
      const exported = mod.default ?? mod.check;
      if (
        exported &&
        typeof exported === "object" &&
        typeof exported.name === "string" &&
        typeof exported.run === "function"
      ) {
        checks.push(exported as Check);
      }
    }
    return checks;
  }

  async run(args: {
    cloneDir: string;
    goldDir: string;
  }): Promise<AuditReport> {
    const cloneManifest = readManifest(args.cloneDir);
    const goldManifest = readManifestOrNull(args.goldDir);

    const ctx: CheckContext = {
      cloneManifest,
      goldManifest,
      cloneDir: args.cloneDir,
      goldDir: args.goldDir,
    };

    const checks = await this.loadChecks();
    const allGaps: Gap[] = [];
    const perCheck: Record<string, number> = {};

    for (const check of checks) {
      try {
        const gaps = await check.run(ctx);
        perCheck[check.name] = gaps.length;
        allGaps.push(...gaps);
      } catch (err) {
        const msg = (err as { message?: string })?.message || String(err);
        const gap: Gap = {
          id: `INFRA-${allGaps.length + 1}`,
          check: check.name,
          kind: "check-crashed",
          severity: "blocker",
          detail: msg,
        };
        allGaps.push(gap);
        perCheck[check.name] = (perCheck[check.name] || 0) + 1;
      }
    }

    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      cloneDir: args.cloneDir,
      goldDir: args.goldDir,
      totalGaps: allGaps.length,
      perCheck,
      gaps: allGaps,
    };
    return report;
  }

  static writeReport(report: AuditReport, outPath: string): void {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
  }
}

function readManifest(dir: string): Manifest {
  const path = resolve(dir, "manifest.json");
  if (!existsSync(path)) {
    throw new Error(
      `manifest.json not found at ${path}. ` +
        "Run `universal-site-cloner clone` first.",
    );
  }
  return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
}

function readManifestOrNull(dir: string): Manifest | null {
  const path = resolve(dir, "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
}
