/**
 * Anthropic-flavored JudgeProvider. The dispatcher selects this when
 * LLM_PROVIDER=anthropic (the default).
 *
 * We use the @anthropic-ai/sdk directly. No streaming — judge calls
 * are point-in-time decisions.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { JudgeProvider } from "./types.js";

export class AnthropicJudgeProvider implements JudgeProvider {
  public readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(args: {
    model: string;
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const resp = await this.client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    });

    // Concatenate all text blocks. Other content types are dropped — the
    // schema validator will fail if a structured response was expected and
    // we got something else.
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
    };
  }
}
