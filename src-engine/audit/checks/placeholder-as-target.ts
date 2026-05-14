/**
 * Check: placeholder-as-target
 * Catches gap class: engine navigated to a CANONICAL dedupe form
 * (e.g. `?id=:id`) instead of substituting back to a real exemplar URL.
 *
 * The dedupe rules in site config map raw URLs (`?id=12345`) to a
 * canonical form (`?id=:id`) so the queue doesn't process the same
 * leaf 500 times. But the canonical form is a DEDUPE KEY, not a
 * navigable URL — the live server returns 404/500 for it. The
 * Crawler must remember the rawUrl seen first for each canonical
 * and navigate to that exemplar.
 *
 * Reads queue-state.json. Flags any terminal URL containing `:<word>`
 * (the placeholder convention used by the config dedupe rules).
 *
 * Generic: every site-cloning engine that supports config-declared
 * `:id`-style dedupe must use this discipline.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Check } from "../types.js";

const PLACEHOLDER_IN_URL = /[?&/](?:[a-zA-Z_]+=)?:[a-z]+\b/;

const check: Check = {
  name: "placeholder-as-target",
  description:
    "URL canonicalised dedupe placeholder (:id, :ts, etc.) was navigated to as a literal URL",
  async run(ctx) {
    const qsPath = resolve(ctx.cloneDir, "..", "queue-state.json");
    if (!existsSync(qsPath)) return [];
    let qs;
    try {
      qs = JSON.parse(readFileSync(qsPath, "utf-8"));
    } catch {
      return [];
    }
    const gaps = [];
    let i = 1;
    for (const [url, rec] of Object.entries(
      qs.terminal || {} as Record<string, { terminalState?: string; reason?: string }>,
    )) {
      const r = rec as { terminalState?: string; reason?: string };
      if (!PLACEHOLDER_IN_URL.test(url)) continue;
      // It's a placeholder URL. If it was captured cleanly, that's
      // actually fine — but if it's blocked or navigation-failed, it's
      // the engine bug we're hunting.
      if (r.terminalState === "blocked" || r.terminalState === "404") {
        gaps.push({
          id: `PLACEHOLDER-${i++}`,
          check: this.name,
          kind: "placeholder-as-target",
          url,
          detail:
            `Engine attempted to navigate to dedupe placeholder URL '${url}'. ` +
            `The Crawler must use the rawUrl exemplar (the first real URL ` +
            `that matched the dedupe rule), not the canonical form.`,
          severity: "blocker" as const,
          meta: { reason: r.reason },
        });
      }
    }
    return gaps;
  },
};

export default check;
