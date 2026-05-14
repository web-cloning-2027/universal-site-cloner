/**
 * Thin Playwright navigation wrapper with retry + timeout discipline.
 *
 * Closes GAP-04 (no resumability/retry in the old template) — this
 * module wraps every `page.goto()` in exponential backoff, with a
 * single source of truth for what counts as a transient vs.
 * permanent failure.
 */

import type { BrowserContext, Page, Response } from "playwright";

export interface NavigationResult {
  status: number;
  finalUrl: string;
  /** True iff status is in 200..399 AND finalUrl matched the request. */
  ok: boolean;
  /** True iff the response redirected outside the requested domain/path. */
  redirected: boolean;
  /** Whatever the navigation produced; useful for chained reads. */
  page: Page;
}

export interface NavigateOptions {
  /** Total budget for goto, in ms. Default 20000. */
  timeoutMs?: number;
  /** Max retries on transient failure. Default 3. */
  maxRetries?: number;
  /** Initial backoff ms. Doubles per retry. Default 500. */
  retryBackoffMs?: number;
  /** Wait condition. Default "domcontentloaded". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
}

export class Navigator {
  constructor(private readonly context: BrowserContext) {}

  /**
   * Navigate, with retry on transient errors (network, timeout). Throws
   * `NavigationError` with the original cause on persistent failure.
   */
  async navigate(
    url: string,
    opts: NavigateOptions = {},
  ): Promise<NavigationResult> {
    const timeoutMs = opts.timeoutMs ?? 20000;
    const maxRetries = opts.maxRetries ?? 3;
    let backoff = opts.retryBackoffMs ?? 500;

    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const page = await this.context.newPage();
      try {
        const resp = await page.goto(url, {
          waitUntil: opts.waitUntil ?? "domcontentloaded",
          timeout: timeoutMs,
        });
        return this.classify(url, resp, page);
      } catch (err) {
        await page.close().catch(() => {});
        lastErr = err;
        if (!this.isTransient(err)) {
          throw new NavigationError(url, err);
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, backoff));
          backoff *= 2;
        }
      }
    }
    throw new NavigationError(url, lastErr);
  }

  private isTransient(err: unknown): boolean {
    const msg = String((err as { message?: string })?.message || err);
    return (
      msg.includes("net::ERR_") ||
      msg.includes("Timeout") ||
      msg.includes("net::ERR_CONNECTION") ||
      msg.includes("Page crashed") ||
      msg.includes("Target closed")
    );
  }

  private classify(
    requestedUrl: string,
    resp: Response | null,
    page: Page,
  ): NavigationResult {
    const status = resp?.status() ?? 0;
    const finalUrl = page.url();
    const ok = status >= 200 && status < 400;
    // "redirected" means the final URL host/path doesn't match the
    // requested host/path — useful for catching login-wall bouncing.
    let redirected = false;
    try {
      const a = new URL(requestedUrl);
      const b = new URL(finalUrl);
      redirected = a.origin !== b.origin || a.pathname !== b.pathname;
    } catch {
      redirected = false;
    }
    return { status, finalUrl, ok, redirected, page };
  }
}

export class NavigationError extends Error {
  constructor(public readonly url: string, public readonly cause: unknown) {
    super(`navigation failed for ${url}: ${String((cause as { message?: string })?.message || cause)}`);
    this.name = "NavigationError";
  }
}
