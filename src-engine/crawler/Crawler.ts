/**
 * Crawler orchestrator. Drives the Queue + Navigator + Analyzer to
 * exhaustively walk a site (R11) with durable state (R12), retry-on-
 * transient (R7-like, but for nav), and a single source of progress
 * truth (R13).
 *
 * Per R11: every URL ends in exactly one terminal state. There are
 * no quiet failures. The crawler enforces this — if an analyzer
 * throws or a navigation persistently fails, the URL is marked
 * `blocked` with the reason. It NEVER silently disappears.
 *
 * Per R13: prints to stdout every 25 processed URLs:
 *   "processed: N / discovered: M / blocked: K / queue: Q"
 * Also writes the heartbeat to engine-progress.log (R19).
 */

import { resolve } from "node:path";
import type { BrowserContext } from "playwright";

import type { LeafAnalyzer } from "../analyzer/LeafAnalyzer.js";
import type { ProgressLog } from "../log.js";
import type { Leaf, Manifest } from "../manifest.js";
import { Navigator, NavigationError } from "./Navigator.js";
import { Queue } from "./Queue.js";
import type { CrawlerConfig, TerminalState } from "./types.js";

export interface CrawlerArgs {
  configName: string;
  context: BrowserContext;
  crawlerConfig: CrawlerConfig;
  analyzer: LeafAnalyzer;
  workDir: string;
  log: ProgressLog;
  fresh?: boolean;
}

export interface CrawlResult {
  manifest: Manifest;
  blockedCount: number;
}

export class Crawler {
  private readonly queue: Queue;
  private readonly nav: Navigator;
  private readonly leaves: Leaf[] = [];
  private lastFlushAt = 0;
  private readonly statePath: string;

  constructor(private readonly args: CrawlerArgs) {
    this.statePath = resolve(args.workDir, "queue-state.json");
    this.queue = args.fresh
      ? new Queue(args.crawlerConfig)
      : Queue.load(args.crawlerConfig, this.statePath);
    this.nav = new Navigator(args.context);
    if (this.queue.pendingCount === 0 && this.queue.terminalStates.length === 0) {
      for (const url of args.crawlerConfig.seedUrls) {
        this.queue.push(url);
      }
    }
  }

  async run(): Promise<CrawlResult> {
    while (true) {
      const entry = this.queue.pop();
      if (!entry) break;
      try {
        // R11 + canonical/raw split: navigate to the raw exemplar (real
        // URL the server actually serves) but key terminal/dedupe state
        // by the canonical form. Closes "placeholder-as-target" engine
        // bug where the engine tried to fetch /diary.php?month=:m.
        await this.processOne(entry.url, entry.rawUrl);
      } catch (err) {
        const reason = (err as { message?: string })?.message || String(err);
        this.queue.markTerminal(entry.url, "blocked", reason);
        this.args.log.write({
          phase: "3.crawl",
          action: "url-blocked",
          result: entry.url,
          reason,
        });
      }
      this.maybeFlush();
      this.maybeProgress();
    }
    // Final flush, regardless.
    this.queue.save(this.statePath);

    const blocked = this.queue.terminalStates.filter(
      (t) => t.terminalState === "blocked",
    ).length;

    const manifest: Manifest = {
      generatedAt: new Date().toISOString(),
      configName: this.args.configName,
      seedUrls: this.args.crawlerConfig.seedUrls,
      leafCount: this.leaves.length,
      leaves: this.leaves,
    };
    return { manifest, blockedCount: blocked };
  }

  private async processOne(canonicalUrl: string, rawUrl: string): Promise<void> {
    // Always navigate to the rawUrl exemplar; never to the canonical
    // dedupe form (which contains ":id" / ":ts" placeholders the server
    // rejects). Terminal-state, manifest, and log keys remain the
    // canonical so dedupe semantics stay intact.
    const navTarget = rawUrl || canonicalUrl;
    const nav = await this.nav.navigate(navTarget, {
      maxRetries: this.args.crawlerConfig.maxRetries ?? 3,
      retryBackoffMs: this.args.crawlerConfig.retryBackoffMs ?? 500,
      timeoutMs: this.args.crawlerConfig.navigationTimeoutMs ?? 20000,
    }).catch((err: NavigationError) => {
      this.queue.markTerminal(canonicalUrl, "blocked", err.message);
      this.args.log.write({
        phase: "3.crawl",
        action: "nav-failed",
        result: canonicalUrl,
        reason: err.message,
      });
      return null;
    });
    if (!nav) return;

    try {
      let terminal: TerminalState = "captured";
      if (nav.status === 404) {
        terminal = "404";
      } else if (nav.redirected && !this.queue.isAllowed(nav.finalUrl)) {
        // Bounced out of the allowlist (e.g. to a login wall).
        terminal = "redirected";
      } else if (nav.status >= 500 && nav.status < 600) {
        terminal = "blocked";
      }

      if (terminal === "captured") {
        const leaf = await this.args.analyzer.analyze({
          url: canonicalUrl,
          status: nav.status,
          page: nav.page,
        });
        this.leaves.push(leaf);
        for (const childUrl of leaf.childUrls || []) {
          this.queue.push(childUrl, canonicalUrl);
        }
        this.queue.markTerminal(canonicalUrl, "captured");
        this.args.log.write({
          phase: "3.crawl",
          action: "url-captured",
          result: canonicalUrl,
        });
      } else {
        this.queue.markTerminal(canonicalUrl, terminal, `status=${nav.status}`);
        this.args.log.write({
          phase: "3.crawl",
          action: `url-${terminal}`,
          result: canonicalUrl,
        });
      }
    } finally {
      await nav.page.close().catch(() => {});
    }
  }

  private maybeFlush(): void {
    const now = Date.now();
    if (now - this.lastFlushAt < 5000) return;
    this.queue.save(this.statePath);
    this.lastFlushAt = now;
  }

  private maybeProgress(): void {
    const state = this.queue.state();
    const processed = state.processedCount;
    if (processed > 0 && processed % 25 === 0) {
      const blocked = this.queue.terminalStates.filter(
        (t) => t.terminalState === "blocked",
      ).length;
      // R13: loud and honest. Print to stdout.
      const line = `processed: ${processed} / discovered: ${state.discoveredCount} / blocked: ${blocked} / queue: ${state.pending.length}`;
      // eslint-disable-next-line no-console
      console.log(line);
    }
    this.args.log.heartbeat("3.crawl", {
      processed: state.processedCount,
      discovered: state.discoveredCount,
      pending: state.pending.length,
    });
  }
}
