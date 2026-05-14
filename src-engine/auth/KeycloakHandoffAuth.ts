/**
 * KeycloakHandoffAuth — opens a headful browser, asks Roy to log in
 * ONCE via R7b, captures `state.json`, and reuses it forever.
 *
 * This is the ONLY place the engine is allowed to interact with a
 * human (R18). After the first run produces state.json, subsequent
 * runs reuse it silently — `authenticate()` returns immediately
 * without prompting.
 *
 * NOTE: per R1, this strategy is generic. It is named after Keycloak
 * because that is the most common SSO handoff shape, but it does not
 * encode any Keycloak-specific knowledge. It works for any
 * redirect-based SSO that puts cookies in the target's domain after
 * login. The only Keycloak-specific bit lives in the site config's
 * `loginUrl`.
 *
 * Config shape:
 *   { "strategy": "KeycloakHandoffAuth",
 *     "loginUrl": "https://target.example.com/login",
 *     "postLoginAnchor": "https://target.example.com/home"  // optional
 *   }
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright";
import type { AuthHandoffPrompt, AuthStrategy } from "./AuthStrategy.js";

export interface KeycloakHandoffOptions {
  loginUrl: string;
  postLoginAnchor?: string;
}

export class KeycloakHandoffAuth implements AuthStrategy {
  public readonly name = "KeycloakHandoffAuth";

  constructor(private readonly opts: KeycloakHandoffOptions) {}

  private stateFilePath(configName: string): string {
    return resolve(
      homedir(),
      ".config/universal-site-cloner-sessions",
      configName,
      "state.json",
    );
  }

  async authenticate(args: {
    browser: Browser;
    workDir: string;
    configName: string;
    handoff: (prompt: AuthHandoffPrompt) => Promise<void>;
  }): Promise<BrowserContext> {
    const statePath = this.stateFilePath(args.configName);

    // Fast path: reuse existing state.json silently.
    if (existsSync(statePath)) {
      return args.browser.newContext({
        storageState: statePath,
        viewport: { width: 1440, height: 900 },
      });
    }

    // First-time handoff (R7b). Spin up a headful Chrome so Roy can
    // see and interact with the login flow. The headless `browser`
    // passed in by the engine is for the crawl itself — we open a
    // separate headful browser only for this one-shot.
    const headful = await chromium.launch({
      channel: "chrome",
      headless: false,
    });
    try {
      const ctx = await headful.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await ctx.newPage();
      await page.goto(this.opts.loginUrl);

      await args.handoff({
        message:
          `Headful Chrome opened at ${this.opts.loginUrl}.\n` +
          "Please log in. Reply 'logged in' in chat when the post-login\n" +
          "page is fully loaded. You will only be asked this once for\n" +
          `the "${args.configName}" config (state.json will be persisted).`,
        expectedPostLoginUrl: this.opts.postLoginAnchor,
      });

      // After Roy confirms, persist storage state.
      mkdirSync(dirname(statePath), { recursive: true });
      await ctx.storageState({ path: statePath });
      await ctx.close();
    } finally {
      await headful.close();
    }

    // Now load the captured state into a fresh headless context for
    // the engine to use.
    return args.browser.newContext({
      storageState: statePath,
      viewport: { width: 1440, height: 900 },
    });
  }
}
