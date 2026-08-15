import type { HealthTick } from "./state.js";

export type IncidentNote = {
  ts: string;
  summary: string;
};

export function renderUptimeMd(args: {
  projectId: string;
  ticks: HealthTick[];
  incidents: IncidentNote[];
  uptimePct: number;
  p95: number;
  errors5m: number;
}): string {
  const { projectId, ticks, incidents, uptimePct: up, p95, errors5m } = args;
  const last30 = ticks.slice(-30);
  const now = new Date().toISOString();

  const summary = [
    `# Uptime — ${projectId}`,
    ``,
    `_Updated ${now}_`,
    ``,
    `## Rolling summary (last ${last30.length} ticks ≈ ${last30.length} min)`,
    ``,
    `- uptime: **${up}%**`,
    `- p95 latency: **${p95} ms**`,
    `- errors last 5m: **${errors5m}**`,
    ``,
    `## Notable incidents`,
    ``,
    incidents.length === 0
      ? "_none_"
      : incidents
          .slice(-10)
          .map((i) => `- \`${i.ts}\` ${i.summary}`)
          .join("\n"),
    ``,
    `## Recent health checks`,
    ``,
    "| ts | status | latency_ms | errors |",
    "|----|--------|-----------:|-------:|",
    ...last30
      .slice(-10)
      .map((t) => `| ${t.ts} | ${t.status} | ${t.latency_ms} | ${t.errors} |`),
    ``,
  ].join("\n");

  return summary;
}
