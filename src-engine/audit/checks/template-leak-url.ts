/**
 * Check: template-leak-url
 * Catches gap class: a server-side template placeholder (e.g.
 * `{BACK_VEHICLE_ID}` from a PHP/Jinja/Smarty template) leaked into
 * an anchor href and the crawler queued it as a real URL.
 *
 * These URLs have literal `{...}` substrings — they were never
 * resolved at server-render time and are guaranteed-404 on
 * navigation. Engine must filter at Queue.push() time so they don't
 * pollute the manifest.
 *
 * This audit check catches them post-hoc against queue-state.json
 * so a regression of the queue-level filter surfaces immediately.
 *
 * Generic: any site whose templates fail to substitute can leak
 * placeholders into anchor hrefs. The check is server-side-template-
 * agnostic — it only checks for `{...}` literals.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Check } from "../types.js";

const TEMPLATE_LITERAL_RE = /\{[A-Z_][A-Z0-9_]*\}/;

const check: Check = {
  name: "template-leak-url",
  description:
    "URLs containing literal {TEMPLATE_PLACEHOLDER} substrings — server template failed to substitute",
  async run(ctx) {
    const qsPath = resolve(ctx.cloneDir, "..", "queue-state.json");
    if (!existsSync(qsPath)) return [];
    let qs;
    try {
      qs = JSON.parse(readFileSync(qsPath, "utf-8"));
    } catch {
      return [];
    }
    const allUrls = new Set<string>([
      ...(qs.pending || []).map((e: { url: string }) => e.url),
      ...Object.keys(qs.terminal || {}),
    ]);
    const gaps = [];
    let i = 1;
    for (const url of allUrls) {
      if (!TEMPLATE_LITERAL_RE.test(url)) continue;
      gaps.push({
        id: `TEMPLATE-${i++}`,
        check: this.name,
        kind: "template-leak-url",
        url,
        detail:
          `URL contains literal template placeholder. Add Queue-level ` +
          `filter that rejects URLs matching /{[A-Z_]+}/ at push() time.`,
        severity: "blocker" as const,
      });
    }
    return gaps;
  },
};

export default check;
