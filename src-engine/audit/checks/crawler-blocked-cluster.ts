/**
 * Check: crawler-blocked-cluster
 * Catches gap class: engine-side analyzer crash propagating into queue-state.
 *
 * If queue-state.json shows ≥3 URLs all blocked with the SAME `reason`
 * string, that's almost certainly an engine bug, not a per-URL flake.
 * Flag as a single blocker gap surfaced at audit time so it doesn't
 * silently inflate "blocked" counts on next runs.
 *
 * Why an audit check (R10 discipline): when the first wet-test surfaced
 * `SyntaxError: Unexpected token 'function'` on every legacy-DMS URL,
 * the obvious fix is the engine code. But per R10, we add the check
 * FIRST so a future regression of the same shape is caught
 * automatically at Phase 4, not Phase 5.
 *
 * Generic: no engine-internal selectors. Reads queue-state.json from
 * the same dir as the clone manifest.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Check } from "../types.js";

const check: Check = {
  name: "crawler-blocked-cluster",
  description: "cluster of identically-reasoned blocked URLs (engine bug indicator)",
  async run(ctx) {
    const qsPath = resolve(ctx.cloneDir, "..", "queue-state.json");
    if (!existsSync(qsPath)) return [];
    let qs;
    try {
      qs = JSON.parse(readFileSync(qsPath, "utf-8"));
    } catch {
      return [];
    }
    const blocked = Object.values(qs.terminal || {}).filter(
      (t) => (t as { terminalState?: string }).terminalState === "blocked",
    ) as { url: string; reason?: string }[];
    if (blocked.length < 3) return [];
    const reasonCounts = new Map<string, string[]>();
    for (const b of blocked) {
      const key = (b.reason || "(no reason)").slice(0, 120);
      if (!reasonCounts.has(key)) reasonCounts.set(key, []);
      reasonCounts.get(key)!.push(b.url);
    }
    const gaps = [];
    let i = 1;
    for (const [reason, urls] of reasonCounts) {
      if (urls.length >= 3) {
        gaps.push({
          id: `ENGINE-${i++}`,
          check: this.name,
          kind: "blocked-cluster",
          detail: `${urls.length} URLs blocked with identical reason. First reason fragment: "${reason}". Sample URLs: ${urls.slice(0, 3).join(", ")}`,
          severity: "blocker" as const,
          meta: { urls, reason },
        });
      }
    }
    return gaps;
  },
};

export default check;
