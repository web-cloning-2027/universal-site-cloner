/**
 * Type contracts for the LLM-backed Judge subsystem (R17).
 *
 * `judge({ prompt, input })` is the only entrypoint engine code uses
 * to resolve a non-deterministic decision. Behavior:
 *   - Loads `prompts/<name>.md` (frontmatter + Task body)
 *   - Loads `prompts/schemas/<name>.schema.json`
 *   - Calls the configured LLM provider with the input as user content
 *   - Validates the response against the schema
 *   - On validation failure: retries up to LLM_MAX_RETRIES (default 3)
 *     with the previous response + validator errors included in the next
 *     prompt
 *   - On persistent failure: writes a debug dump to
 *     docs/research/judge-failures/<ISO>.json and throws.
 *     This is an engine bug — fix the prompt or schema and rerun.
 *   - Caches successful results in $WORKDIR/.judge-cache/ keyed by
 *     (prompt-name + canonical-JSON of input).
 */

export interface JudgeCall<I = unknown, O = unknown> {
  prompt: string;
  input: I;
  /** Skip the cache for this call. Default false. */
  skipCache?: boolean;
  /** Per-call override of max retries. Default from env. */
  maxRetries?: number;
}

export interface JudgeMeta {
  promptName: string;
  retries: number;
  fromCache: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export type JudgeResult<O> = {
  result: O;
  meta: JudgeMeta;
};

export interface JudgeProvider {
  name: "anthropic" | "openai" | "azure";
  /**
   * Send a single chat-style message and get a string response. The
   * dispatcher already merged system + user + prior-attempt context.
   */
  complete(args: {
    model: string;
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<{ text: string; inputTokens?: number; outputTokens?: number }>;
}

export class JudgeFailure extends Error {
  constructor(
    public readonly promptName: string,
    public readonly lastResponse: string,
    public readonly validatorErrors: unknown,
    public readonly dumpPath: string,
  ) {
    super(
      `Judge failure for prompt "${promptName}" after retries exhausted. Dump: ${dumpPath}`,
    );
    this.name = "JudgeFailure";
  }
}
