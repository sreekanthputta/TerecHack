import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type HealthTick = {
  ts: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  errors: number;
};

export type WatcherState = {
  project_id: string;
  fixture_cursor: number;
  last_log_ts: string | null;
  ticks: HealthTick[];
  synth_bug_hashes: { hash: string; ts: string }[];
  linq_notified_at: string | null;
};

const MAX_TICKS = 30;

function statePath(projectId: string): string {
  return join(tmpdir(), "autobiz", "service-watcher", `${projectId}.json`);
}

export function loadState(projectId: string): WatcherState {
  try {
    const raw = readFileSync(statePath(projectId), "utf8");
    const parsed = JSON.parse(raw) as WatcherState;
    if (parsed.project_id === projectId) return parsed;
  } catch {
    // fresh state below
  }
  return {
    project_id: projectId,
    fixture_cursor: 0,
    last_log_ts: null,
    ticks: [],
    synth_bug_hashes: [],
    linq_notified_at: null,
  };
}

export function saveState(s: WatcherState): void {
  const path = statePath(s.project_id);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2), "utf8");
}

export function appendTick(s: WatcherState, tick: HealthTick): WatcherState {
  const ticks = [...s.ticks, tick].slice(-MAX_TICKS);
  return { ...s, ticks };
}

export function recentTicks(s: WatcherState, n = 5): HealthTick[] {
  return s.ticks.slice(-n);
}

export function uptimePct(ticks: HealthTick[]): number {
  if (ticks.length === 0) return 100;
  const healthy = ticks.filter((t) => t.status === "healthy").length;
  return Math.round((healthy / ticks.length) * 10000) / 100;
}

export function p95(ticks: HealthTick[]): number {
  if (ticks.length === 0) return 0;
  const sorted = [...ticks].map((t) => t.latency_ms).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

export function errorsLast5m(ticks: HealthTick[]): number {
  return ticks.slice(-5).reduce((acc, t) => acc + t.errors, 0);
}

export function pruneSynthHashes(s: WatcherState, nowMs: number, ttlMs = 10 * 60_000): WatcherState {
  const synth_bug_hashes = s.synth_bug_hashes.filter(
    (h) => nowMs - new Date(h.ts).getTime() < ttlMs,
  );
  return { ...s, synth_bug_hashes };
}

export function hasRecentSynthHash(s: WatcherState, hash: string): boolean {
  return s.synth_bug_hashes.some((h) => h.hash === hash);
}

export function recordSynthHash(s: WatcherState, hash: string, ts: string): WatcherState {
  return { ...s, synth_bug_hashes: [...s.synth_bug_hashes, { hash, ts }] };
}
