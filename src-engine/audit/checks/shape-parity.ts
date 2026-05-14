/**
 * Check: shape-parity
 * Catches gap class: shape-mismatch (V7's "live=form, clone=grid").
 *
 * For every URL that appears in BOTH manifests, the leafContent.shape
 * must match. Endpoint / section-landing pairs are exempt because they
 * carry no rendered structure.
 */

import type { Check } from "../types.js";

const check: Check = {
  name: "shape-parity",
  description: "leafContent.shape matches between clone and gold for shared URLs",
  async run(ctx) {
    if (!ctx.goldManifest) return [];
    const gold = new Map<string, string | undefined>();
    for (const l of ctx.goldManifest.leaves) gold.set(l.url, l.leafContent?.shape);
    const gaps = [];
    let i = 1;
    for (const cloneLeaf of ctx.cloneManifest.leaves) {
      const goldShape = gold.get(cloneLeaf.url);
      const cloneShape = cloneLeaf.leafContent?.shape;
      if (goldShape === undefined) continue;
      if (
        goldShape === "endpoint" ||
        goldShape === "section-landing" ||
        cloneShape === "endpoint" ||
        cloneShape === "section-landing"
      ) {
        continue;
      }
      if (goldShape !== cloneShape) {
        gaps.push({
          id: `SHAPE-${i++}`,
          check: this.name,
          kind: "shape-mismatch",
          url: cloneLeaf.url,
          detail: `gold=${goldShape}, clone=${cloneShape}`,
          severity: "blocker" as const,
        });
      }
    }
    return gaps;
  },
};

export default check;
