/**
 * Check: per-url-stalled
 * Catches gap class: a single URL hangs the entire crawl because the
 * analyzer pipeline (tab recursion / button probing / form extraction)
 * has no upper time bound.
 *
 * Reads queue-state.json. If lastSavedAt is more than 5 minutes
 * behind "now" AND the queue still has pending entries, that's a
 * stall signal — every healthy crawler must flush state at least
 * every 5 seconds (debounced, R12).
 *
 * R13 also requires that no URL silently disappears — a stall is the
 * same class of failure: a URL is "in flight" but not on its way to
 * a terminal state, and the operator wouldn't know without this
 * check.
 *
 * Note: this check runs post-hoc against a saved queue-state.json,
 * so the operator runs it after a crawl-that-never-finishes. The
 * fix is to add a per-URL TOTAL timeout to the Crawler so analyzers
 * can never wedge the run.
 *
 * Generic: every crawler must enforce per-URL completion budgets.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Check } from "../types.js";

const STALL_THRESHOLD_MS = 5 * 60 * 1000;

const check: Check = {
  name: "per-url-stalled",
  description:
    "queue-state.json lastSavedAt > 5min behind wall clock with pending URLs (analyzer wedged on a single URL)",
  async run(ctx) {
    const qsPath = resolve(ctx.cloneDir, "..", "queue-state.json");
    if (!existsSync(qsPath)) return [];
    let qs;
    try {
      qs = JSON.parse(readFileSync(qsPath, "utf-8"));
    } catch {
      return [];
    }
    const lastSavedAt = qs.lastSavedAt ? Date.parse(qs.lastSavedAt) : 0;
    const pending = (qs.pending || []).length;
    if (pending === 0) return [];
    const now = Date.now();
    if (now - lastSavedAt < STALL_THRESHOLD_MS) return [];
    const stalledMin = Math.round((now - lastSavedAt) / 60000);
    return [
      {
        id: "STALL-1",
        check: this.name,
        kind: "crawler-stalled",
        detail:
          `queue-state.json lastSavedAt is ${stalledMin} minutes old ` +
          `and ${pending} URLs are still pending. The Crawler likely ` +
          `wedged on a single URL — add a per-URL total-time budget ` +
          `to processOne (analyzer pipeline must abort after N seconds).`,
        severity: "blocker" as const,
        meta: { pending, stalledMinutes: stalledMin, lastSavedAt: qs.lastSavedAt },
      },
    ];
  },
};

export default check;
