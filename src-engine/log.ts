/**
 * engine-progress.log writer (R19). Append-only, gitignored.
 *
 * Format: [ISO-timestamp] phase=X.Y action=<verb> result=<short>
 *
 * Roy reads the file when he wants. Never prints to chat, never blocks.
 *
 * Also exposes a debounced helper for state-save events (queue
 * persistence on every change, debounced ~5s per R12).
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface LogLine {
  phase: string; // e.g. "3.crawl", "5.diff"
  action: string; // verb, e.g. "url-captured", "judge-called", "retry"
  result: string; // short payload
  [extra: string]: string | number | undefined;
}

export class ProgressLog {
  private periodicTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;

  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) writeFileSync(path, "");
  }

  /** Write a single line synchronously. Never throws to the caller. */
  write(line: LogLine): void {
    const ts = new Date().toISOString();
    const extras = Object.entries(line)
      .filter(([k]) => !["phase", "action", "result"].includes(k))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ");
    const text =
      `[${ts}] phase=${line.phase} action=${line.action} ` +
      `result=${JSON.stringify(line.result)}` +
      (extras ? ` ${extras}` : "") +
      "\n";
    try {
      appendFileSync(this.path, text);
    } catch {
      // Don't crash the engine on a log failure.
    }
  }

  /** Heartbeat every 30s (R19). Idempotent — call repeatedly from a long loop. */
  heartbeat(phase: string, payload: Record<string, string | number>): void {
    const now = Date.now();
    if (now - this.lastHeartbeat < 30_000) return;
    this.lastHeartbeat = now;
    this.write({
      phase,
      action: "heartbeat",
      result: "alive",
      ...payload,
    });
  }
}
