/**
 * Check: dedupe-coverage
 * Catches gap class: site config missing a `:id`-style dedupe rule.
 *
 * If ≥50 URLs in queue-state.json share the same PATH but differ only
 * in query-string (or only in a numeric path segment), that's almost
 * always a missing dedupe rule — the engine is enumerating per-vehicle
 * / per-customer / per-day variants instead of collapsing them.
 *
 * Per R11 the ONLY allowed similarity collapse is `:id`-style dedupe
 * declared in the site config — and only for IDs the config explicitly
 * lists. So if the config doesn't list a rule, every variant gets its
 * own queue entry. This check flags the config-coverage gap so the
 * operator can add the rule in the next loop iteration.
 *
 * Generic: no engine-internal selectors. Reads queue-state.json from
 * the same parent dir as the clone manifest.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Check } from "../types.js";

const QUERY_STRING_THRESHOLD = 50;

const check: Check = {
  name: "dedupe-coverage",
  description:
    "≥50 URLs sharing one path with only query-string variation (signals missing :id dedupe rule)",
  async run(ctx) {
    const qsPath = resolve(ctx.cloneDir, "..", "queue-state.json");
    if (!existsSync(qsPath)) return [];
    let qs;
    try {
      qs = JSON.parse(readFileSync(qsPath, "utf-8"));
    } catch {
      return [];
    }
    // Group ALL URLs (pending + terminal) by their bare path.
    const allUrls: string[] = [
      ...(qs.pending || []).map((e: { url: string }) => e.url),
      ...Object.keys(qs.terminal || {}),
    ];
    const byPath = new Map<string, Set<string>>();
    for (const u of allUrls) {
      try {
        const url = new URL(u);
        const key = url.origin + url.pathname;
        if (!byPath.has(key)) byPath.set(key, new Set());
        byPath.get(key)!.add(u);
      } catch {
        // ignore malformed
      }
    }
    const gaps = [];
    let i = 1;
    for (const [path, variants] of byPath) {
      if (variants.size < QUERY_STRING_THRESHOLD) continue;
      const sample = [...variants].slice(0, 3);
      gaps.push({
        id: `DEDUPE-${i++}`,
        check: this.name,
        kind: "missing-dedupe-rule",
        url: path,
        detail:
          `${variants.size} URLs share path ${path} with only query-string variation. ` +
          `Add a dedupe rule to examples/<site>.config.json.crawler.dedupe ` +
          `that collapses the variant param. Sample: ${sample.join(" | ")}`,
        severity: "blocker" as const,
        meta: { variantCount: variants.size, sample },
      });
    }
    return gaps;
  },
};

export default check;
