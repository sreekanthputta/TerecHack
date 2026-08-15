import { createHash } from "node:crypto";
import type { Bug, BugReport, BugSeverity } from "@autobiz/shared";
import type { LogCluster } from "./logs.js";
import type { HealthReading } from "./health.js";
import type { HealthTick } from "./state.js";

export type Anomaly = {
  severity: BugSeverity;
  where: string;
  observed: string;
  expected: string;
  repro: string[];
  criticalOutage: boolean;
  hash: string;
};

const MIN_UPTIME_PCT = 99;
const MAX_ERRORS_5M = 10;
const MAX_P95_MS = 3000;
const P95_SUSTAINED_TICKS = 3;

function hashOf(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

/**
 * Evaluate all anomaly rules. Returns 0..N anomalies sorted by severity.
 */
export function detect(args: {
  reading: HealthReading;
  clusters: LogCluster[];
  window: HealthTick[];
  uptimePct: number;
  p95Ms: number;
  errors5m: number;
}): Anomaly[] {
  const { reading, clusters, window, uptimePct: up, p95Ms, errors5m } = args;
  const out: Anomaly[] = [];

  // Rule 1: critical outage (uptime dropped AND current unhealthy)
  if (up < MIN_UPTIME_PCT && reading.status !== "healthy") {
    out.push({
      severity: "blocker",
      where: "deployment",
      observed: `${reading.status} (uptime=${up}%)`,
      expected: "healthy",
      repro: ["GET /"],
      criticalOutage: true,
      hash: hashOf(["outage", reading.status]),
    });
  }

  // Rule 2: major bug — errors cluster on one endpoint
  const heavyCluster = clusters.find(
    (c) => (c.kind === "5xx" || c.kind === "exception") && c.count > MAX_ERRORS_5M,
  );
  if (heavyCluster && errors5m > MAX_ERRORS_5M) {
    out.push({
      severity: "major",
      where: heavyCluster.endpoint,
      observed: `${heavyCluster.count} ${heavyCluster.kind} in last window; example: ${heavyCluster.example}`,
      expected: "2xx",
      repro: [heavyCluster.endpoint],
      criticalOutage: false,
      hash: hashOf(["cluster", heavyCluster.kind, heavyCluster.endpoint]),
    });
  }

  // Rule 3: minor — sustained p95 spike
  const highLat = window
    .slice(-P95_SUSTAINED_TICKS)
    .every((t) => t.latency_ms > MAX_P95_MS);
  if (window.length >= P95_SUSTAINED_TICKS && highLat && p95Ms > MAX_P95_MS) {
    out.push({
      severity: "minor",
      where: "deployment",
      observed: `p95=${p95Ms}ms sustained for ${P95_SUSTAINED_TICKS} ticks`,
      expected: `p95 < ${MAX_P95_MS}ms`,
      repro: ["GET /"],
      criticalOutage: false,
      hash: hashOf(["latency", String(Math.floor(p95Ms / 500))]),
    });
  }

  return out;
}

const SEV_RANK: Record<BugSeverity, number> = { blocker: 3, major: 2, minor: 1 };

export function toBug(a: Anomaly): Bug {
  return {
    bug_id: a.hash.slice(0, 8),
    severity: a.severity,
    where: a.where,
    observed: a.observed.slice(0, 500),
    expected: a.expected,
    repro: a.repro,
  };
}

export function toBugReport(args: {
  projectId: string;
  runId: string;
  builderVersion: number;
  anomalies: Anomaly[];
}): BugReport {
  return {
    project_id: args.projectId,
    run_id: args.runId,
    builder_version: Math.max(1, args.builderVersion),
    passed: 0,
    failed: args.anomalies.length,
    bugs: args.anomalies.map(toBug),
    ts: new Date().toISOString(),
  };
}

export function sortBySeverity(anomalies: Anomaly[]): Anomaly[] {
  return [...anomalies].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
}
