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

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
    /** When true, skip the primary diff and only run reference diff. */
    reportOnly?: boolean;
  }): Promise<AuditReport> {
    const cloneManifest = readManifestFromDir(args.cloneDir);
    const liveManifest = readManifestFromPath(args.liveManifestPath);
    const referenceManifest = args.referenceDir
      ? readManifestFromDirOrNull(args.referenceDir)
      : null;

    const checks = await this.loadChecks();

    // R4: TWO separate diff passes.
    //   1. Primary: cloneManifest vs liveManifest. These gaps gate
    //      cleanRuns.
    //   2. Reference (optional, when --reference is passed):
    //      cloneManifest vs referenceManifest. REPORT-ONLY — never
    //      gates cleanRuns. Gaps go into a separate `referenceGaps`
    //      field, NEVER merged into the primary `gaps` array.
    const primaryCtx: CheckContext = {
      cloneManifest,
      liveManifest,
      referenceManifest: null, // primary diff never sees reference
      cloneDir: args.cloneDir,
      liveManifestPath: args.liveManifestPath,
      referenceDir: undefined,
    };

    const primaryGaps: Gap[] = [];
    const perCheck: Record<string, number> = {};

    if (!args.reportOnly) {
      for (const check of checks) {
        try {
          const gaps = await check.run(primaryCtx);
          perCheck[check.name] = gaps.length;
          primaryGaps.push(...gaps);
        } catch (err) {
          const msg = (err as { message?: string })?.message || String(err);
          primaryGaps.push({
            id: `INFRA-${primaryGaps.length + 1}`,
            check: check.name,
            kind: "check-crashed",
            severity: "blocker",
            detail: msg,
          });
          perCheck[check.name] = (perCheck[check.name] || 0) + 1;
        }
      }
    }

    // Reference pass: cloneManifest vs referenceManifest, severity
    // downgraded to "minor" for all gaps. Held in a separate field.
    let referenceGaps: Gap[] | undefined;
    if (referenceManifest) {
      const refCtx: CheckContext = {
        cloneManifest,
        // Swap: the "live" side of the diff is the reference clone here.
        liveManifest: referenceManifest,
        referenceManifest: null,
        cloneDir: args.cloneDir,
        liveManifestPath: args.liveManifestPath,
        referenceDir: args.referenceDir,
      };
      referenceGaps = [];
      for (const check of checks) {
        try {
          const gaps = await check.run(refCtx);
          for (const g of gaps) g.severity = "minor"; // R4: never blocker
          referenceGaps.push(...gaps);
        } catch {
          // Reference-pass infrastructure errors are non-gating; ignore.
        }
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      cloneDir: args.cloneDir,
      liveManifestPath: args.liveManifestPath,
      referenceDir: args.referenceDir,
      // R4: totalGaps counts ONLY primary gaps. referenceGaps is
      // separate and informational.
      totalGaps: primaryGaps.length,
      perCheck,
      gaps: primaryGaps,
      ...(referenceGaps ? { referenceGaps } : {}),
    };
  }

  static writeReport(report: AuditReport, outPath: string): void {
    mkdirSync(dirname(outPath), { recursive: true });
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
  // R10 audit checks (engine-side: per-url-stalled, blocked-cluster,
  // placeholder-as-target, dedupe-coverage) only need queue-state.json
  // which is in dir/.. — they don't require a populated clone-manifest.
  // Return an empty manifest so those checks can still run when the
  // crawler aborted before scaffold-emit.
  return {
    generatedAt: new Date().toISOString(),
    configName: "(empty — no manifest emitted)",
    seedUrls: [],
    leafCount: 0,
    leaves: [],
  };
}

function readManifestFromPath(path: string): Manifest {
  if (!existsSync(path)) {
    // Same R10 rationale as readManifestFromDir: engine-side checks
    // can still run against queue-state.json alone. Return empty.
    return {
      generatedAt: new Date().toISOString(),
      configName: "(empty — no live-manifest emitted)",
      seedUrls: [],
      leafCount: 0,
      leaves: [],
    };
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
