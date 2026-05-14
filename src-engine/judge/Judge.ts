/**
 * Judge dispatcher. R17 implementation.
 *
 *   const remediation = await judge({
 *     prompt: "scope-remediation",
 *     input: { gap, attemptsSoFar, currentDiff }
 *   });
 *
 * Each prompt lives at `prompts/<name>.md` (frontmatter + Task body)
 * and `prompts/schemas/<name>.schema.json`. Frontmatter overrides
 * are: model, max-tokens. The Task section is sent verbatim to the LLM
 * as the system prompt; the input is serialized as the user message.
 *
 * On validation failure we retry up to LLM_MAX_RETRIES (default 3),
 * including the previous response + validator errors in the next call.
 * If all retries fail we dump (input, response, errors, schema) to
 * docs/research/judge-failures/<ISO>.json and throw JudgeFailure.
 *
 * Identical inputs hit the cache. Cache lives in $WORKDIR/.judge-cache/.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Ajv, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import { JudgeCache, canonicalJson } from "./cache.js";
import {
  type JudgeCall,
  type JudgeMeta,
  type JudgeProvider,
  type JudgeResult,
  JudgeFailure,
} from "./types.js";

export interface JudgeConfig {
  repoRoot: string;
  workDir: string;
  /** Default model when prompt frontmatter doesn't override. */
  defaultModel: string;
  /** Default max-tokens when prompt frontmatter doesn't override. */
  defaultMaxTokens: number;
  maxRetries: number;
  provider: JudgeProvider;
}

interface PromptFile {
  frontmatter: Record<string, string>;
  task: string;
  raw: string;
}

function parseFrontmatter(raw: string): PromptFile {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    return { frontmatter: {}, task: raw, raw };
  }
  const fmRaw = m[1] ?? "";
  const body = m[2] ?? "";
  const fm: Record<string, string> = {};
  for (const line of fmRaw.split("\n")) {
    const cm = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (cm) fm[cm[1]!] = cm[2]!.trim();
  }
  // Extract the ## Task section. Stop at the next "## " heading.
  const taskMatch = body.match(/##\s+Task\s*\n([\s\S]*?)(?:\n##\s+|$)/);
  const task = taskMatch ? taskMatch[1]!.trim() : body.trim();
  return { frontmatter: fm, task, raw };
}

function loadPrompt(repoRoot: string, name: string): PromptFile {
  const path = resolve(repoRoot, "prompts", `${name}.md`);
  if (!existsSync(path)) {
    throw new Error(
      `Judge: prompt "${name}" not found at ${path}. ` +
        `Every judge() call requires a co-located prompts/<name>.md.`,
    );
  }
  return parseFrontmatter(readFileSync(path, "utf-8"));
}

function loadSchema(
  ajv: Ajv,
  repoRoot: string,
  name: string,
): ValidateFunction {
  const path = resolve(repoRoot, "prompts", "schemas", `${name}.schema.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Judge: schema "${name}" not found at ${path}. ` +
        `Every prompts/<name>.md requires prompts/schemas/<name>.schema.json.`,
    );
  }
  const schema = JSON.parse(readFileSync(path, "utf-8"));
  return ajv.compile(schema);
}

/**
 * Extract a JSON value from an LLM response. We tolerate models that
 * wrap JSON in markdown code fences; we do NOT tolerate prose around it.
 * The schema validator will reject anything malformed.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip code fence if present
  const fence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  const body = fence ? fence[1]! : trimmed;
  return JSON.parse(body);
}

function writeFailureDump(
  repoRoot: string,
  payload: {
    promptName: string;
    input: unknown;
    attempts: { response: string; validatorErrors: unknown }[];
    schema: unknown;
  },
): string {
  const dir = resolve(repoRoot, "docs/research/judge-failures");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = resolve(dir, `${stamp}__${payload.promptName}.json`);
  writeFileSync(dumpPath, JSON.stringify(payload, null, 2));
  return dumpPath;
}

export class Judge {
  private readonly cache: JudgeCache;
  private readonly ajv: Ajv;
  private readonly schemaCache = new Map<string, ValidateFunction>();

  constructor(public readonly config: JudgeConfig) {
    this.cache = new JudgeCache(resolve(config.workDir, ".judge-cache"));
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  private compileSchema(name: string): ValidateFunction {
    let v = this.schemaCache.get(name);
    if (!v) {
      v = loadSchema(this.ajv, this.config.repoRoot, name);
      this.schemaCache.set(name, v);
    }
    return v;
  }

  async call<I = unknown, O = unknown>(
    call: JudgeCall<I, O>,
  ): Promise<JudgeResult<O>> {
    const promptName = call.prompt;
    const startedAt = Date.now();

    if (!call.skipCache) {
      const hit = this.cache.get<O>(promptName, call.input);
      if (hit !== undefined) {
        return {
          result: hit,
          meta: {
            promptName,
            retries: 0,
            fromCache: true,
            latencyMs: Date.now() - startedAt,
          },
        };
      }
    }

    const prompt = loadPrompt(this.config.repoRoot, promptName);
    const validate = this.compileSchema(promptName);
    const model = prompt.frontmatter["model"] || this.config.defaultModel;
    const maxTokens = Number(
      prompt.frontmatter["max-tokens"] || this.config.defaultMaxTokens,
    );
    const maxRetries = call.maxRetries ?? this.config.maxRetries;
    const systemPrompt = `${prompt.task}\n\nRespond with a single JSON value matching the documented schema. No prose, no commentary.`;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    const attempts: { response: string; validatorErrors: unknown }[] = [];
    let lastResponseText = "";
    for (let retry = 0; retry <= maxRetries; retry++) {
      let userMessage = canonicalJson(call.input);
      if (retry > 0) {
        // Include prior attempt + validator errors per R17c.
        const prev = attempts[attempts.length - 1]!;
        userMessage =
          `Previous attempt (#${retry}) failed validation. ` +
          `Errors:\n${JSON.stringify(prev.validatorErrors, null, 2)}\n\n` +
          `Previous response:\n${prev.response}\n\n` +
          `Input:\n${userMessage}`;
      }

      const { text, inputTokens: it, outputTokens: ot } =
        await this.config.provider.complete({
          model,
          system: systemPrompt,
          user: userMessage,
          maxTokens,
        });
      lastResponseText = text;
      inputTokens = (inputTokens ?? 0) + (it ?? 0);
      outputTokens = (outputTokens ?? 0) + (ot ?? 0);

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch (err) {
        attempts.push({
          response: text,
          validatorErrors: [{ message: `JSON parse error: ${String(err)}` }],
        });
        continue;
      }

      const ok = validate(parsed);
      if (ok) {
        const result = parsed as O;
        if (!call.skipCache) this.cache.set(promptName, call.input, result);
        const meta: JudgeMeta = {
          promptName,
          retries: retry,
          fromCache: false,
          latencyMs: Date.now() - startedAt,
          inputTokens,
          outputTokens,
        };
        return { result, meta };
      }

      attempts.push({
        response: text,
        validatorErrors: validate.errors ?? [],
      });
    }

    // Persistent failure — dump and throw.
    const dumpPath = writeFailureDump(this.config.repoRoot, {
      promptName,
      input: call.input,
      attempts,
      schema: undefined, // schema is loaded by name; the .schema.json file is the source of truth
    });
    throw new JudgeFailure(
      promptName,
      lastResponseText,
      attempts[attempts.length - 1]?.validatorErrors,
      dumpPath,
    );
  }
}
