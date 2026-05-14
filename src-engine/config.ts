/**
 * Site config schema + loader.
 *
 * One config per site. Lives in examples/<name>.config.json. The
 * config declares:
 *   - auth strategy + its options
 *   - seed URLs
 *   - allowlist regex
 *   - :id-style dedupe rules
 *   - any site-specific hints (NOT logic — R2)
 *
 * R1: hardcoded site knowledge is forbidden in src-engine/. All
 * per-site adjustments go through the config.
 */

import { readFileSync } from "node:fs";
import type { AuthStrategyConfig } from "./auth/index.js";
import type { CrawlerConfig } from "./crawler/types.js";

export interface SiteConfig {
  /** Stable name; used to derive ~/.config/.../<name>/state.json. */
  name: string;
  /** Display label for chat handoff messages. */
  displayName?: string;
  /** Per-site auth (R5). */
  auth?: AuthStrategyConfig;
  /** Crawler settings (R11, R12). */
  crawler: CrawlerConfig;
  /** Classifier and renderer hints. Generic shape; opaque to engine. */
  hints?: {
    /** URLs that match this pattern are exempted as section-landings. */
    sectionLandingPatterns?: string[];
    /** URLs that match this pattern are exempted as endpoints (download/print/redirect). */
    endpointPatterns?: string[];
    /** Per-leaf shape overrides keyed by URL pattern. Last-match wins. */
    shapeOverrides?: { pattern: string; shape: string }[];
  };
  /** Visual-diff threshold percent. Default 12. R6 / Gate 10. */
  visualDiffThresholdPct?: number;
}

export function loadConfig(path: string): SiteConfig {
  const raw = readFileSync(path, "utf-8");
  const cfg = JSON.parse(raw) as SiteConfig;
  validate(cfg);
  return cfg;
}

function validate(cfg: SiteConfig): void {
  if (!cfg.name || typeof cfg.name !== "string") {
    throw new Error("config.name is required (used for session path).");
  }
  if (!cfg.crawler) {
    throw new Error("config.crawler is required.");
  }
  if (!Array.isArray(cfg.crawler.seedUrls) || cfg.crawler.seedUrls.length === 0) {
    throw new Error("config.crawler.seedUrls must be a non-empty array.");
  }
  if (!cfg.crawler.allowlistRegex || typeof cfg.crawler.allowlistRegex !== "string") {
    throw new Error("config.crawler.allowlistRegex is required (string).");
  }
  try {
    new RegExp(cfg.crawler.allowlistRegex);
  } catch (err) {
    throw new Error(`config.crawler.allowlistRegex is not a valid regex: ${String(err)}`);
  }
  for (const r of cfg.crawler.dedupe || []) {
    try {
      new RegExp(r.pattern);
    } catch (err) {
      throw new Error(`config.crawler.dedupe pattern "${r.pattern}" is not valid: ${String(err)}`);
    }
  }
}
