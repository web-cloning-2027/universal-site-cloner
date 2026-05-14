/**
 * Audit data model. The `audit` CLI subcommand reads a wet-test
 * output dir + a gold-standard dir, runs every registered check,
 * and writes AUDIT.json.
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
  goldDir: string;
  totalGaps: number;
  perCheck: Record<string, number>;
  gaps: Gap[];
}

export interface CheckContext {
  cloneManifest: Manifest;
  goldManifest: Manifest | null;
  cloneDir: string;
  goldDir: string;
}

export interface Check {
  readonly name: string;
  /** "what gap class does this check catch?" — one line. */
  readonly description: string;
  /**
   * Run the check and return any gaps. Throwing is forbidden — the
   * dispatcher unwraps errors and treats them as `blocker` gaps with
   * the check name as the cause.
   */
  run(ctx: CheckContext): Promise<Gap[]>;
}
