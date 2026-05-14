/**
 * Check: shape-parity
 * Catches gap class: shape-mismatch.
 *
 * R4: for every URL that appears in BOTH manifests, the
 * leafContent.shape on the engine clone must match the live capture.
 * Endpoint / section-landing pairs are exempt because they carry no
 * rendered structure.
 */

import type { Check } from "../types.js";

const check: Check = {
  name: "shape-parity",
  description:
    "leafContent.shape matches between engine clone and live capture for shared URLs",
  async run(ctx) {
    const live = new Map<string, string | undefined>();
    for (const l of ctx.liveManifest.leaves) {
      live.set(l.url, l.leafContent?.shape);
    }
    const gaps = [];
    let i = 1;
    for (const cloneLeaf of ctx.cloneManifest.leaves) {
      const liveShape = live.get(cloneLeaf.url);
      const cloneShape = cloneLeaf.leafContent?.shape;
      if (liveShape === undefined) continue;
      if (
        liveShape === "endpoint" ||
        liveShape === "section-landing" ||
        cloneShape === "endpoint" ||
        cloneShape === "section-landing"
      ) {
        continue;
      }
      if (liveShape !== cloneShape) {
        gaps.push({
          id: `SHAPE-${i++}`,
          check: this.name,
          kind: "shape-mismatch",
          url: cloneLeaf.url,
          detail: `live=${liveShape}, clone=${cloneShape}`,
          severity: "blocker" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
