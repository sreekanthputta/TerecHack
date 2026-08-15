import { AgentContextSchema, type TraceEventInput } from "@autobiz/shared";
import { IntClient, OrchClient } from "./http.js";
import { fixtureHealth, fixtureLogs } from "./fixtures.js";
import { toTick, type HealthReading } from "./health.js";
import { detect, sortBySeverity, toBugReport } from "./anomalies.js";
import { scan, totalErrors, type LogCluster } from "./logs.js";
import { renderUptimeMd } from "./memory.js";
import {
  appendTick,
  errorsLast5m,
  hasRecentSynthHash,
  loadState,
  p95,
  pruneSynthHashes,
  recentTicks,
  recordSynthHash,
  saveState,
  uptimePct,
} from "./state.js";

const AGENT = "service-watcher" as const;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchLines(
  ctx: ReturnType<typeof AgentContextSchema.parse>,
  cursor: number,
  since: string | null,
): Promise<string[]> {
  if (ctx.env.fixture_mode) return fixtureLogs(cursor);
  const int = new IntClient(ctx.env.integrations_url);
  const res = await int.logs(ctx.project_id, since, 50);
  return res.lines;
}

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const orch = new OrchClient(ctx.env.orchestrator_url, ctx.turn_id);
  const nowIso = () => new Date().toISOString();

  const base = {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  } as const;

  const emit = (partial: Omit<TraceEventInput, keyof typeof base>) =>
    orch.postEvent({ ...base, ...partial });

  let state = loadState(ctx.project_id);
  state = pruneSynthHashes(state, Date.now());

  const fixtureMode = ctx.env.fixture_mode;
  let reading: HealthReading;
  try {
    if (fixtureMode) {
      reading = fixtureHealth(state.fixture_cursor, nowIso());
    } else {
      const int = new IntClient(ctx.env.integrations_url);
      reading = await int.health(ctx.project_id);
    }
  } catch (err) {
    await emit({
      type: "error",
      content: `health check failed: ${(err as Error).message}`,
      ts: nowIso(),
    });
    saveState(state);
    return;
  }

  let clusters: LogCluster[] = [];
  try {
    const lines = await fetchLines(ctx, state.fixture_cursor, state.last_log_ts);
    clusters = scan(lines);
    state.last_log_ts = reading.checked_at;
  } catch (err) {
    await emit({
      type: "error",
      content: `logs fetch failed: ${(err as Error).message}`,
      ts: nowIso(),
    });
  }

  const errCount = totalErrors(clusters);
  const tick = toTick(reading, errCount);
  state = appendTick(state, tick);
  const window = recentTicks(state, 5);
  const uptime = uptimePct(window);
  const p95Latency = p95(window);
  const errors5m = errorsLast5m(state.ticks);

  await emit({
    type: "health_check",
    content: `t=${ctx.turn} status=${reading.status} latency=${reading.latency_ms}ms uptime=${uptime}% p95=${p95Latency}ms`,
    ts: nowIso(),
    metadata: {
      status: reading.status,
      latency_ms: reading.latency_ms,
      uptime_pct: uptime,
      p95_latency_ms: p95Latency,
      errors_last_5m: errors5m,
    },
  });

  for (const c of clusters) {
    await emit({
      type: "log_signal",
      content: `${c.kind} on ${c.endpoint} x${c.count}`,
      ts: nowIso(),
      metadata: {
        kind: c.kind,
        endpoint: c.endpoint,
        count: c.count,
        example_line: c.example,
      },
    });
  }

  try {
    await orch.postState({
      uptime_pct: uptime,
      p95_latency_ms: p95Latency,
      errors_last_5m: errors5m,
      updated_at: nowIso(),
    });
  } catch (err) {
    await emit({
      type: "error",
      content: `state patch failed: ${(err as Error).message}`,
      ts: nowIso(),
    });
  }

  const anomalies = sortBySeverity(
    detect({
      reading,
      clusters,
      window,
      uptimePct: uptime,
      p95Ms: p95Latency,
      errors5m,
    }),
  );

  const fresh = anomalies.filter((a) => !hasRecentSynthHash(state, a.hash));
  for (const a of fresh) {
    state = recordSynthHash(state, a.hash, nowIso());
  }

  if (fresh.length > 0) {
    const report = toBugReport({
      projectId: ctx.project_id,
      runId: ctx.agent_run_id,
      builderVersion: ctx.plan.version,
      anomalies: fresh,
    });
    try {
      await orch.postBugs(report);
      await emit({
        type: "bugs_found",
        content: `${fresh.length} anomaly bug(s) posted: ${fresh.map((a) => a.severity).join(",")}`,
        ts: nowIso(),
        metadata: { bug_ids: report.bugs.map((b) => b.bug_id) },
      });
    } catch (err) {
      await emit({
        type: "error",
        content: `bug report failed: ${(err as Error).message}`,
        ts: nowIso(),
      });
    }

    const critical = fresh.find((a) => a.criticalOutage);
    if (critical && !state.linq_notified_at) {
      try {
        const int = new IntClient(ctx.env.integrations_url);
        await int.linqNotify({
          project_id: ctx.project_id,
          channel: ctx.plan.owner_contact.channel,
          address: ctx.plan.owner_contact.address,
          message: `Outage on ${ctx.plan.goal}: ${critical.observed}`,
        });
        state.linq_notified_at = nowIso();
        await emit({
          type: "action",
          content: `linq notify owner via ${ctx.plan.owner_contact.channel}`,
          ts: nowIso(),
        });
      } catch (err) {
        await emit({
          type: "error",
          content: `linq notify failed: ${(err as Error).message}`,
          ts: nowIso(),
        });
      }
    } else if (!critical) {
      // Reset the outage-notify latch once we're back below blocker severity
      // so a future outage can page again.
      state.linq_notified_at = null;
    }
  } else {
    // No fresh anomalies this tick — if the previous outage has cleared, reset
    // the latch so the next incident can page.
    if (reading.status === "healthy") state.linq_notified_at = null;
  }

  try {
    const md = renderUptimeMd({
      projectId: ctx.project_id,
      ticks: state.ticks,
      incidents: clusters.map((c) => ({
        ts: reading.checked_at,
        summary: `${c.kind} on ${c.endpoint} x${c.count}`,
      })),
      uptimePct: uptime,
      p95: p95Latency,
      errors5m,
    });
    await orch.postMemory({
      scope: "project",
      path: "ops/uptime.md",
      content: md,
      mode: "upsert",
    });
  } catch (err) {
    await emit({
      type: "error",
      content: `memory upsert failed: ${(err as Error).message}`,
      ts: nowIso(),
    });
  }

  saveState(state);

  await emit({
    type: "result",
    content: `service-watcher tick t=${ctx.turn} status=${reading.status} uptime=${uptime}% errors=${errCount}`,
    ts: nowIso(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
