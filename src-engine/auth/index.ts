/**
 * Auth strategy factory. Picks an implementation by `config.strategy`.
 */

import { BasicAuth, type BasicAuthOptions } from "./BasicAuth.js";
import { CookieJarAuth, type CookieJarAuthOptions } from "./CookieJarAuth.js";
import { KeycloakHandoffAuth, type KeycloakHandoffOptions } from "./KeycloakHandoffAuth.js";
import { NoAuth } from "./NoAuth.js";
import type { AuthStrategy, AuthStrategyConfig } from "./AuthStrategy.js";

export { NoAuth, BasicAuth, CookieJarAuth, KeycloakHandoffAuth };
export type { AuthStrategy, AuthStrategyConfig, AuthHandoffPrompt } from "./AuthStrategy.js";

export function buildAuthStrategy(
  config: AuthStrategyConfig | undefined,
): AuthStrategy {
  if (!config || !config.strategy) return new NoAuth();
  switch (config.strategy) {
    case "NoAuth":
      return new NoAuth();
    case "BasicAuth":
      return new BasicAuth(config as unknown as BasicAuthOptions);
    case "CookieJarAuth":
      return new CookieJarAuth(config as unknown as CookieJarAuthOptions);
    case "KeycloakHandoffAuth":
      return new KeycloakHandoffAuth(
        config as unknown as KeycloakHandoffOptions,
      );
    default:
      throw new Error(
        `Unknown auth strategy "${config.strategy}". Accepted: ` +
          "NoAuth | BasicAuth | CookieJarAuth | KeycloakHandoffAuth.",
      );
  }
}
