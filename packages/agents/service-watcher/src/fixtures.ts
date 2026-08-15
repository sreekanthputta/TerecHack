import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { HealthReading } from "./health.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, "..", "fixtures");

type HealthFixture = {
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  errors: number;
};

let healthCache: HealthFixture[] | null = null;
let logsCache: { tick: number; lines: string[] }[] | null = null;

function loadHealth(): HealthFixture[] {
  if (!healthCache) {
    healthCache = JSON.parse(readFileSync(join(FIXTURE_DIR, "health.json"), "utf8"));
  }
  return healthCache!;
}

function loadLogs(): { tick: number; lines: string[] }[] {
  if (!logsCache) {
    const raw = readFileSync(join(FIXTURE_DIR, "logs.jsonl"), "utf8");
    logsCache = raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  }
  return logsCache!;
}

export function fixtureHealth(cursor: number, checkedAt: string): HealthReading {
  const seq = loadHealth();
  const rec = seq[cursor % seq.length]!;
  return {
    status: rec.status,
    latency_ms: rec.latency_ms,
    checked_at: checkedAt,
  };
}

export function fixtureLogs(cursor: number): string[] {
  const seq = loadLogs();
  const rec = seq.find((r) => r.tick === cursor % seq.length);
  return rec ? rec.lines : [];
}

export function fixtureLen(): number {
  return loadHealth().length;
}
