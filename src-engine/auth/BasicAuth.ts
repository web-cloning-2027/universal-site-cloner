/**
 * BasicAuth — HTTP Basic for sites guarded by a 401 challenge.
 *
 * Config shape:
 *   { "strategy": "BasicAuth",
 *     "credentialsEnv": "MYSITE_BASIC_AUTH" }
 * where the env var contains "user:password".
 */

import type { Browser, BrowserContext } from "playwright";
import type { AuthStrategy } from "./AuthStrategy.js";

export interface BasicAuthOptions {
  credentialsEnv: string;
}

export class BasicAuth implements AuthStrategy {
  public readonly name = "BasicAuth";

  constructor(private readonly opts: BasicAuthOptions) {}

  async authenticate(args: { browser: Browser }): Promise<BrowserContext> {
    const creds = process.env[this.opts.credentialsEnv];
    if (!creds) {
      throw new Error(
        `BasicAuth: env var ${this.opts.credentialsEnv} is empty. ` +
          "Set it to 'user:password' before running.",
      );
    }
    const [username, ...rest] = creds.split(":");
    const password = rest.join(":");
    return args.browser.newContext({
      httpCredentials: { username: username || "", password },
      viewport: { width: 1440, height: 900 },
    });
  }
}
