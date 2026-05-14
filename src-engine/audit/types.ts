/**
 * Audit data model.
 *
 * R4: the diff target is the LIVE SITE captured in the same wet-test
 * run, NOT a hand-iterated reference clone. The CheckContext exposes:
 *   - cloneManifest: engine-emitted clone manifest (from wet-test-output/clone/)
 *   - liveManifest:  live-site capture from the SAME run (from wet-test-output/live-manifest.json)
 *   - referenceManifest?: an existing clone (e.g. clickdealer-clone) — REPORT-ONLY (R4)
 *
 * Checks compare cloneManifest ↔ liveManifest. Any check that touches
 * referenceManifest is opt-in and CANNOT gate cleanRuns.
 */

import type { Manifest } from "../manifest.js";

export type GapSeverity = "blocker" | "major" | "minor";

export interface Gap {
  id: string;
  check: string;
  kind: string;
  url?: string;
  detail: string;
  severity: GapSeverity;
  liveScreenshot?: string;
  cloneScreenshot?: string;
  meta?: Record<string, unknown>;
}

export interface AuditReport {
  generatedAt: string;
  cloneDir: string;
  liveManifestPath: string;
  referenceDir?: string;
  /** Count of gating gaps (gaps from clone-vs-live diff). */
  totalGaps: number;
  perCheck: Record<string, number>;
  /** Primary gaps: engine clone vs same-run live. THESE gate cleanRuns. */
  gaps: Gap[];
  /** Reference gaps: engine clone vs --reference hand-clone. REPORT-ONLY
   *  per R4 — never counted in totalGaps, never gate cleanRuns. */
  referenceGaps?: Gap[];
}

export interface CheckContext {
  cloneManifest: Manifest;
  /** R4: live capture from the same wet-test run. */
  liveManifest: Manifest;
  /** Optional reference clone manifest (e.g. clickdealer-clone). Report-only (R4). */
  referenceManifest?: Manifest | null;
  cloneDir: string;
  liveManifestPath: string;
  referenceDir?: string;
}

export interface Check {
  readonly name: string;
  /** "what gap class does this check catch?" — one line. */
  readonly description: string;
  /**
   * Run the check. Throwing is forbidden — the dispatcher catches
   * and converts to a `blocker` gap with the check name as the cause.
   */
  run(ctx: CheckContext): Promise<Gap[]>;
}
