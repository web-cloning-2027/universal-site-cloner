/**
 * NoAuth — for public sites with no login wall. Default for any
 * config that omits the `auth` block.
 */

import type { Browser, BrowserContext } from "playwright";
import type { AuthStrategy } from "./AuthStrategy.js";

export class NoAuth implements AuthStrategy {
  public readonly name = "NoAuth";

  async authenticate(args: { browser: Browser }): Promise<BrowserContext> {
    return args.browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
  }
}
