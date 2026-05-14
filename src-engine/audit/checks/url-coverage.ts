/**
 * Check: url-coverage
 * Catches gap classes: missing-route, extra-route.
 *
 * R4: compares the engine-emitted clone manifest against the LIVE
 * capture from the same wet-test run.
 *
 * If a URL appears in the live manifest but NOT in the clone manifest
 * (or vice-versa), record a gap. extra-route is "minor" — most likely
 * a legitimate clone-side route the live doesn't have, but worth
 * surfacing.
 */

import type { Check } from "../types.js";

const check: Check = {
  name: "url-coverage",
  description:
    "missing-route / extra-route between engine clone and same-run live manifest",
  async run(ctx) {
    const cloneUrls = new Set(ctx.cloneManifest.leaves.map((l) => l.url));
    const liveUrls = new Set(ctx.liveManifest.leaves.map((l) => l.url));
    const gaps = [];
    let i = 1;
    for (const url of liveUrls) {
      if (!cloneUrls.has(url)) {
        gaps.push({
          id: `URL-${i++}`,
          check: this.name,
          kind: "missing-route",
          url,
          detail: `live has ${url}, clone is missing`,
          severity: "blocker" as const,
        });
      }
    }
    for (const url of cloneUrls) {
      if (!liveUrls.has(url)) {
        gaps.push({
          id: `URL-${i++}`,
          check: this.name,
          kind: "extra-route",
          url,
          detail: `clone has ${url}, live doesn't`,
          severity: "minor" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
