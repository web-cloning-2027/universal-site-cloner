/**
 * File-backed cache for judge() responses (R17c).
 *
 * Key = sha256(prompt-name + canonical-JSON(input))
 * Stored under $WORKDIR/.judge-cache/<key>.json
 *
 * The cache directory is gitignored. Roy clears it between cold runs
 * implicitly via `rm -rf wet-test-output` (the cache lives in WORKDIR
 * not WORKDIR/wet-test-output, so a fresh run can still warm-hit).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CacheEntry<O = unknown> {
  promptName: string;
  inputHash: string;
  storedAt: string; // ISO timestamp
  result: O;
}

/** Stable JSON stringify (sorted keys) for deterministic hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") +
    "}"
  );
}

export function cacheKey(promptName: string, input: unknown): string {
  return createHash("sha256")
    .update(promptName + "\0" + canonicalJson(input))
    .digest("hex");
}

export class JudgeCache {
  constructor(private readonly cacheDir: string) {
    mkdirSync(cacheDir, { recursive: true });
  }

  private filePath(key: string): string {
    return resolve(this.cacheDir, `${key}.json`);
  }

  get<O>(promptName: string, input: unknown): O | undefined {
    const key = cacheKey(promptName, input);
    const path = this.filePath(key);
    if (!existsSync(path)) return undefined;
    try {
      const entry = JSON.parse(readFileSync(path, "utf-8")) as CacheEntry<O>;
      return entry.result;
    } catch {
      return undefined;
    }
  }

  set<O>(promptName: string, input: unknown, result: O): void {
    const key = cacheKey(promptName, input);
    const entry: CacheEntry<O> = {
      promptName,
      inputHash: key,
      storedAt: new Date().toISOString(),
      result,
    };
    writeFileSync(this.filePath(key), JSON.stringify(entry, null, 2));
  }
}
