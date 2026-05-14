/**
 * Check: url-coverage
 * Catches gap classes: missing-route, extra-route (V7 Gate 1 analog).
 *
 * If a URL appears in the gold manifest but NOT in the clone manifest
 * with a captured terminal state, that's a missing-route gap.
 * Conversely, URLs in clone but not gold are flagged as extra-route
 * (severity minor — most likely a legit new addition, but logged).
 */

import type { Check } from "../types.js";

const check: Check = {
  name: "url-coverage",
  description: "missing-route / extra-route between clone and gold manifests",
  async run(ctx) {
    if (!ctx.goldManifest) return [];
    const cloneUrls = new Set(ctx.cloneManifest.leaves.map((l) => l.url));
    const goldUrls = new Set(ctx.goldManifest.leaves.map((l) => l.url));
    const gaps = [];
    let i = 1;
    for (const url of goldUrls) {
      if (!cloneUrls.has(url)) {
        gaps.push({
          id: `URL-${i++}`,
          check: this.name,
          kind: "missing-route",
          url,
          detail: `gold has ${url}, clone is missing`,
          severity: "blocker" as const,
        });
      }
    }
    for (const url of cloneUrls) {
      if (!goldUrls.has(url)) {
        gaps.push({
          id: `URL-${i++}`,
          check: this.name,
          kind: "extra-route",
          url,
          detail: `clone has ${url}, gold doesn't`,
          severity: "minor" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
