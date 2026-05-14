/**
 * BFS queue with allowlist filtering, `:id`-style dedupe, and durable
 * state serialization (R11, R12).
 *
 * Behavior:
 *   - `push(url, from?)` normalizes the URL, applies dedupe rules,
 *     filters against the allowlist, skips if already-seen, and
 *     appends. Returns the canonical URL (or null if dropped).
 *   - `pop()` returns the next entry or null if empty.
 *   - `markTerminal(url, state, reason?)` records the URL's final
 *     disposition. After this, `pending` no longer contains it; the
 *     terminal map does.
 *   - `save()` writes `queue-state.json` to disk. Called on every
 *     state transition (debounced to every ~5s by the caller).
 *   - `load()` (static) reconstructs the queue from a saved file.
 *
 * No URL is ever silently lost. If `push()` returns null, the caller
 * MAY still record the URL in `terminal` with a reason ("disallowed",
 * "duplicate", "non-http") — this module doesn't enforce that policy
 * because some callers legitimately discover non-http schemes (mailto:,
 * javascript:) that aren't worth tracking.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  CrawlerConfig,
  DedupeRule,
  QueueEntry,
  QueueState,
  TerminalRecord,
  TerminalState,
} from "./types.js";

interface CompiledDedupeRule {
  source: string;
  re: RegExp;
  replace: string;
}

export class Queue {
  private pending: QueueEntry[] = [];
  private terminal: Record<string, TerminalRecord> = {};
  private seen: Set<string> = new Set();
  private allowlist: RegExp;
  private dedupeRules: CompiledDedupeRule[];
  private startedAt: string;
  private discoveredCount = 0;
  private processedCount = 0;

  constructor(private readonly config: CrawlerConfig) {
    this.allowlist = new RegExp(config.allowlistRegex);
    this.dedupeRules = (config.dedupe || []).map((r) => ({
      source: r.pattern,
      re: new RegExp(r.pattern),
      replace: r.replace,
    }));
    this.startedAt = new Date().toISOString();
  }

  /** Canonicalize a URL: drop hash, apply dedupe rules, then normalize. */
  canonicalize(rawUrl: string): string | null {
    // R10 template-leak filter: reject URLs whose query string still
    // contains an unresolved {TEMPLATE_PLACEHOLDER}. Generic across
    // sites — every page-template language can leak placeholders.
    if (/\{[A-Z_][A-Z0-9_]*\}/.test(rawUrl)) return null;
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    let canonical = url.toString();
    // Trim trailing slash except for root.
    if (canonical.endsWith("/") && url.pathname.length > 1) {
      canonical = canonical.replace(/\/$/, "");
    }

    // Apply dedupe rules FIRST — these match against the URL with its
    // original query string (incl. empty-value params like
    // &vehicle_id=&enquiry_source_id=). Reordering: dedupe → then
    // normalize, so the rule patterns can rely on the original shape.
    for (const rule of this.dedupeRules) {
      canonical = canonical.replace(rule.re, rule.replace);
    }

    // Now normalize the dedupe'd canonical:
    //   - Drop empty-value query params (key= with no value).
    //   - Drop a trailing `?` if no params survived.
    // This closes audit url-coverage drift where the same logical
    // leaf serialised differently across runs.
    try {
      const u2 = new URL(canonical);
      if (u2.search) {
        const params = new URLSearchParams(u2.search);
        const cleaned = new URLSearchParams();
        for (const [k, v] of params.entries()) {
          if (v === "" || v === undefined || v === null) continue;
          cleaned.append(k, v);
        }
        const cleanedStr = cleaned.toString();
        u2.search = cleanedStr ? "?" + cleanedStr : "";
      }
      canonical = u2.toString();
    } catch {
      // canonical might not parse if dedupe inserted weird text;
      // fall back to string trimming.
    }
    if (canonical.endsWith("?")) canonical = canonical.slice(0, -1);
    return canonical;
  }

  /** Returns true iff the URL is in the configured allowlist. */
  isAllowed(canonical: string): boolean {
    return this.allowlist.test(canonical);
  }

  /**
   * Push a URL into the queue. Returns the canonical form on accept,
   * null on drop (dedupe, allowlist miss, malformed, already-seen).
   */
  push(rawUrl: string, discoveredFrom?: string): string | null {
    const canonical = this.canonicalize(rawUrl);
    if (!canonical) return null;
    if (!this.isAllowed(canonical)) return null;
    if (this.seen.has(canonical)) return null;
    if (this.terminal[canonical]) return null;
    this.seen.add(canonical);
    this.pending.push({
      url: canonical,
      rawUrl,
      attempts: 0,
      discoveredFrom,
    });
    this.discoveredCount++;
    return canonical;
  }

  /** Pop the next entry, FIFO. Returns null if no work. */
  pop(): QueueEntry | null {
    return this.pending.shift() ?? null;
  }

  /** Push an entry back to the END of the queue for retry. */
  requeue(entry: QueueEntry): void {
    entry.attempts++;
    this.pending.push(entry);
  }

  markTerminal(url: string, state: TerminalState, reason?: string): void {
    this.terminal[url] = {
      url,
      terminalState: state,
      reason,
      finishedAt: new Date().toISOString(),
    };
    this.processedCount++;
  }

  state(): QueueState {
    return {
      startedAt: this.startedAt,
      lastSavedAt: new Date().toISOString(),
      pending: this.pending,
      terminal: this.terminal,
      discoveredCount: this.discoveredCount,
      processedCount: this.processedCount,
    };
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get terminalStates(): TerminalRecord[] {
    return Object.values(this.terminal);
  }

  /** Atomic save: write to tmp file, rename. Caller debounces calls. */
  save(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state(), null, 2));
    renameSync(tmp, path);
  }

  static load(config: CrawlerConfig, path: string): Queue {
    const q = new Queue(config);
    if (!existsSync(path)) return q;
    const data: QueueState = JSON.parse(readFileSync(path, "utf-8"));
    q.startedAt = data.startedAt;
    q.pending = data.pending;
    q.terminal = data.terminal;
    q.discoveredCount = data.discoveredCount;
    q.processedCount = data.processedCount;
    for (const e of data.pending) q.seen.add(e.url);
    for (const url of Object.keys(data.terminal)) q.seen.add(url);
    return q;
  }
}
