/**
 * CookieJarAuth — load Playwright `state.json` from a path on disk.
 * The state.json may have been produced by KeycloakHandoffAuth or
 * by any external mechanism (manual export, `playwright codegen`, etc.).
 *
 * Config shape:
 *   { "strategy": "CookieJarAuth",
 *     "statePath": "~/.config/.../my-site/state.json" }
 *
 * Use case: a CI run that doesn't have a display, but you have a
 * state.json from a developer's earlier interactive handoff. Or to
 * point at a non-default storage location.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Browser, BrowserContext } from "playwright";
import type { AuthStrategy } from "./AuthStrategy.js";

export interface CookieJarAuthOptions {
  statePath: string;
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  return p;
}

export class CookieJarAuth implements AuthStrategy {
  public readonly name = "CookieJarAuth";

  constructor(private readonly opts: CookieJarAuthOptions) {}

  async authenticate(args: { browser: Browser }): Promise<BrowserContext> {
    const path = expandHome(this.opts.statePath);
    if (!existsSync(path)) {
      throw new Error(
        `CookieJarAuth: state.json not found at ${path}. ` +
          "Either produce it via KeycloakHandoffAuth on a development " +
          "machine, or check the path in your site config.",
      );
    }
    return args.browser.newContext({
      storageState: path,
      viewport: { width: 1440, height: 900 },
    });
  }
}
