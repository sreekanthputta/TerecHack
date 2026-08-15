import { AgentContextSchema, type TraceEventInput } from "@autobiz/shared";
import { IntClient, OrchClient } from "./http.js";
import { fixtureHealth } from "./fixtures.js";
import { toTick, type HealthReading } from "./health.js";
import {
  appendTick,
  errorsLast5m,
  loadState,
  p95,
  pruneSynthHashes,
  recentTicks,
  saveState,
  uptimePct,
} from "./state.js";

const AGENT = "service-watcher" as const;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
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

  const tick = toTick(reading);
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

  saveState(state);

  await emit({
    type: "result",
    content: `service-watcher tick t=${ctx.turn} status=${reading.status} uptime=${uptime}%`,
    ts: nowIso(),
  });
}

main().catch((err) => {
  console.error(err);
  // Fail-soft: never crash cron.
  process.exit(0);
});
