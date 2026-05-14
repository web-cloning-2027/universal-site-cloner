/**
 * Crawler data model. Every URL the engine ever sees ends up in
 * `terminalState` exactly once — there are no silent disappearances
 * (R11).
 */

export type TerminalState =
  /** Crawl completed; manifest entry is populated. */
  | "captured"
  /** Page returned 404 (or matching not-found signal). */
  | "404"
  /** Navigation redirected outside the allowlist; tracked but not crawled. */
  | "redirected"
  /** Persistent error after all retries; reason captured. */
  | "blocked"
  /** Link target is not a navigable HTML page (binary download, etc.). */
  | "dead";

export interface QueueEntry {
  /** Canonical URL after `:id` collapse and other dedupe rules. */
  url: string;
  /** Original URL as discovered (kept for debugging). */
  rawUrl: string;
  /** Pop attempts so far (for retry backoff). */
  attempts: number;
  /** Where this URL came from. */
  discoveredFrom?: string;
}

export interface TerminalRecord {
  url: string;
  terminalState: TerminalState;
  reason?: string;
  finishedAt: string;
  /** Convenience: the manifest path if captured. */
  manifestEntry?: string;
}

export interface QueueState {
  startedAt: string;
  lastSavedAt: string;
  pending: QueueEntry[];
  terminal: Record<string, TerminalRecord>;
  /** Stats counter — derivable but useful for debug. */
  discoveredCount: number;
  processedCount: number;
}

export interface DedupeRule {
  pattern: string; // RegExp source
  replace: string;
}

export interface CrawlerConfig {
  seedUrls: string[];
  allowlistRegex: string; // RegExp source
  dedupe?: DedupeRule[];
  /** Initial backoff ms; doubles per retry. */
  retryBackoffMs?: number;
  maxRetries?: number;
  /** Per-URL navigation timeout in ms. Default 20000. */
  navigationTimeoutMs?: number;
  /** Force serial navigation (no per-URL parallelism). Default true. */
  serial?: boolean;
}
