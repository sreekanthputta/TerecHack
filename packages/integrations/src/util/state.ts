import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * `state/` is the scratch dir owned by integrations. Small JSON files here
 * persist across restarts (fixture bookkeeping, payment-link -> project map,
 * loop-qa project map). Never store secrets here.
 */
const STATE_DIR = resolve(process.cwd(), "state");

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function statePath(rel: string): string {
  return resolve(STATE_DIR, rel);
}

export function readJson<T>(rel: string, fallback: T): T {
  const p = statePath(rel);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(rel: string, data: unknown): void {
  const p = statePath(rel);
  ensureDir(p);
  writeFileSync(p, JSON.stringify(data, null, 2));
}
