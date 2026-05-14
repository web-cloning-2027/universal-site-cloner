/**
 * Audit dispatcher.
 *
 * R4: takes the engine's emitted clone manifest + the live-site
 * manifest captured in the SAME wet-test run. Optional reference
 * manifest (e.g. an existing hand-iterated clone) is REPORT-ONLY
 * and never gates cleanRuns.
 *
 * Loads every check file from src-engine/audit/checks/ and runs them
 * in sequence against (cloneManifest, liveManifest, referenceManifest?).
 *
 * R10: the check set grows monotonically. Each new check lives in its
 * own file under checks/, with a leading comment that names the gap
 * class it catches.
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
    liveManifestPath: string;
    referenceDir?: string;
    /** When true, skip the live comparison and only run reference checks. */
    reportOnly?: boolean;
  }): Promise<AuditReport> {
    const cloneManifest = readManifestFromDir(args.cloneDir);
    const liveManifest = readManifestFromPath(args.liveManifestPath);
    const referenceManifest = args.referenceDir
      ? readManifestFromDirOrNull(args.referenceDir)
      : null;

    const ctx: CheckContext = {
      cloneManifest,
      liveManifest,
      referenceManifest,
      cloneDir: args.cloneDir,
      liveManifestPath: args.liveManifestPath,
      referenceDir: args.referenceDir,
    };

    const checks = await this.loadChecks();
    const allGaps: Gap[] = [];
    const perCheck: Record<string, number> = {};

    for (const check of checks) {
      try {
        const gaps = await check.run(ctx);
        // R4: report-only checks (those that touch referenceManifest)
        // emit gaps tagged minor and do not gate cleanRuns. We don't
        // enforce that here — checks self-tag severity. CI / Phase 5
        // gating only counts blocker+major.
        if (args.reportOnly) {
          // Downgrade everything to minor when --report-only is set.
          for (const g of gaps) g.severity = "minor";
        }
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

    return {
      generatedAt: new Date().toISOString(),
      cloneDir: args.cloneDir,
      liveManifestPath: args.liveManifestPath,
      referenceDir: args.referenceDir,
      totalGaps: allGaps.length,
      perCheck,
      gaps: allGaps,
    };
  }

  static writeReport(report: AuditReport, outPath: string): void {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
  }
}

function readManifestFromDir(dir: string): Manifest {
  // Look for clone-manifest.json first, then manifest.json.
  for (const candidate of ["clone-manifest.json", "manifest.json"]) {
    const path = resolve(dir, candidate);
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
    }
  }
  throw new Error(
    `No manifest found in ${dir}. Expected clone-manifest.json or manifest.json. ` +
      "Run `universal-site-cloner clone` first.",
  );
}

function readManifestFromPath(path: string): Manifest {
  if (!existsSync(path)) {
    throw new Error(
      `live-manifest.json not found at ${path}. ` +
        "Pass --live <path> pointing at a wet-test-output/live-manifest.json.",
    );
  }
  return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
}

function readManifestFromDirOrNull(dir: string): Manifest | null {
  for (const candidate of ["live-manifest.json", "manifest.json"]) {
    const path = resolve(dir, candidate);
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
    }
  }
  return null;
}
