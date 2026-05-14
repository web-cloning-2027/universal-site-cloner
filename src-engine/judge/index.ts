/**
 * Judge subsystem public entrypoint. Build it once on engine startup
 * (in cli.ts), then use it via `judge.call({ prompt, input })`.
 *
 * Env vars consumed (R17d):
 *   LLM_PROVIDER       default "anthropic"
 *   ANTHROPIC_API_KEY  required when provider=anthropic
 *   LLM_MODEL          default "claude-haiku-4-5-20251001"
 *   LLM_MAX_RETRIES    default 3
 *   LLM_MAX_TOKENS     default 1024
 *
 * `validateEnv()` is called on startup and throws if a required env var
 * is missing. Per R17d: never silently fall back to a non-LLM
 * heuristic for a path that requires judgment.
 */

import { AnthropicJudgeProvider } from "./anthropicProvider.js";
import { Judge, type JudgeConfig } from "./Judge.js";
import type { JudgeProvider } from "./types.js";

export { Judge } from "./Judge.js";
export type { JudgeConfig } from "./Judge.js";
export type { JudgeCall, JudgeResult, JudgeMeta, JudgeProvider } from "./types.js";
export { JudgeFailure } from "./types.js";

export function validateJudgeEnv(env: NodeJS.ProcessEnv = process.env): void {
  const provider = env.LLM_PROVIDER || "anthropic";
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is required (LLM_PROVIDER=anthropic). " +
          "Per R17d, never silently fall back to a non-LLM heuristic.",
      );
    }
  } else if (provider === "openai" || provider === "azure") {
    throw new Error(
      `LLM_PROVIDER="${provider}" is declared but no provider impl is shipped yet. ` +
        "Add src-engine/judge/<provider>Provider.ts and wire it in buildJudge() before use.",
    );
  } else {
    throw new Error(
      `Unknown LLM_PROVIDER="${provider}". Accepted: anthropic|openai|azure.`,
    );
  }
}

export function buildJudge(args: {
  repoRoot: string;
  workDir: string;
  env?: NodeJS.ProcessEnv;
}): Judge {
  const env = args.env ?? process.env;
  validateJudgeEnv(env);

  let provider: JudgeProvider;
  switch (env.LLM_PROVIDER || "anthropic") {
    case "anthropic":
      provider = new AnthropicJudgeProvider(env.ANTHROPIC_API_KEY!);
      break;
    default:
      // validateJudgeEnv already rejected anything else.
      throw new Error("unreachable");
  }

  const config: JudgeConfig = {
    repoRoot: args.repoRoot,
    workDir: args.workDir,
    defaultModel: env.LLM_MODEL || "claude-haiku-4-5-20251001",
    defaultMaxTokens: Number(env.LLM_MAX_TOKENS || 1024),
    maxRetries: Number(env.LLM_MAX_RETRIES || 3),
    provider,
  };
  return new Judge(config);
}
