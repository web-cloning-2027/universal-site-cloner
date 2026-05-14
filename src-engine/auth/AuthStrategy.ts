/**
 * AuthStrategy — pluggable authentication for the crawler. (R5)
 *
 * The strategy is selected by the site config:
 *   { "auth": { "strategy": "KeycloakHandoffAuth", ... } }
 *
 * Each strategy is responsible for: producing a Playwright BrowserContext
 * that is logged-in to the target site. The engine never knows or cares
 * how the cookies got there.
 *
 * R7b is the only place a strategy is allowed to ask Roy in chat: the
 * ONE-SHOT initial handoff for a protected site. After that, the
 * strategy persists state.json under
 * `~/.config/universal-site-cloner-sessions/<configName>/state.json`
 * and reuses it silently on every subsequent run.
 */

import type { Browser, BrowserContext } from "playwright";

export interface AuthStrategyConfig {
  strategy: string;
  /** Strategy-specific options. */
  [key: string]: unknown;
}

export interface AuthHandoffPrompt {
  /** Markdown to print to the chat asking Roy to log in. */
  message: string;
  /** Where the strategy expects the user to land after login. */
  expectedPostLoginUrl?: string;
}

export interface AuthStrategy {
  readonly name: string;

  /**
   * Returns a Playwright BrowserContext authenticated to the target.
   * If first-time setup is needed (no state.json yet), the strategy
   * opens a headful window and uses `handoff` to prompt Roy. After
   * Roy confirms, the strategy captures cookies+localStorage to
   * state.json and reuses it forever.
   *
   * `handoff` is called by the strategy ONLY when no state.json exists
   * AND the strategy genuinely cannot proceed headless. The engine's
   * CLI implements `handoff` by printing to stdout and reading a
   * single line of confirmation. There is NO other interactive surface.
   */
  authenticate(args: {
    browser: Browser;
    workDir: string;
    configName: string;
    handoff: (prompt: AuthHandoffPrompt) => Promise<void>;
  }): Promise<BrowserContext>;
}
