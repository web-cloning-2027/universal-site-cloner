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
    // Endpoint + section-landing leaves are by-design absent from the
    // clone tree (Scaffold skips kind:"endpoint"; section-landings are
    // hand-built section pages, not auto-generated). Don't flag them
    // as missing-route.
    const cloneUrls = new Set(ctx.cloneManifest.leaves.map((l) => l.url));
    const exempt = (l: { kind?: string; leafContent?: { shape?: string } }) => {
      const k = l.kind || l.leafContent?.shape;
      return k === "endpoint" || k === "section-landing";
    };
    const liveLeaves = ctx.liveManifest.leaves;
    const liveExpectedUrls = new Set(
      liveLeaves.filter((l) => !exempt(l)).map((l) => l.url),
    );
    const liveAllUrls = new Set(liveLeaves.map((l) => l.url));
    const gaps = [];
    let i = 1;
    for (const url of liveExpectedUrls) {
      if (!cloneUrls.has(url)) {
        gaps.push({
          id: `URL-${i++}`,
          check: this.name,
          kind: "missing-route",
          url,
          detail: `live has ${url} (non-exempt leaf), clone is missing`,
          severity: "blocker" as const,
        });
      }
    }
    for (const url of cloneUrls) {
      if (!liveAllUrls.has(url)) {
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
