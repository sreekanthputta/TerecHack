# Agent D2 · Track 4 — Service Watcher (NEW)

## Role
Every 60s while a project is `live`, health-check the deployed landing page (uptime, latency), pull recent Render logs, scan for anomaly signals (error spikes, 5xx bursts, request drops), and update `business_state.uptime_pct` / `p95_latency_ms` / `errors_last_5m`. On anomaly detection, escalate — either respawn Builder with a synthetic bug (fix loop) or Linq the owner for major incidents.

## Owns
`packages/agents/service-watcher/` — short-lived CLI, invoked every 60s.

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin
- Integrations: `GET /render/health/:project_id`, `GET /render/logs/:project_id?since=<iso>&limit=50`
- Env: `FIXTURE_MODE`, `TURN_ID`, `ORCH_URL`, `INT_URL`
- Fixture: `fixtures/service/health.json`, `fixtures/service/logs.jsonl`

## Produces
- Trace events: `health_check` per tick, `log_signal` for interesting log patterns, `error` on repeated failures
- State update `POST /internal/turns/:turn_id/state`: `uptime_pct`, `p95_latency_ms`, `errors_last_5m`
- Memory upsert `ops/uptime.md`
- On anomaly: post a synthetic `BugReport` via `/internal/turns/:turn_id/bugs` (triggers Builder retry)
- On outage: Linq notify owner
- Terminal `type:"result"`

## Contracts
```typescript
import type { AgentContext, Bug, BugReport, TraceEvent } from "@autobiz/shared";
```

## Tasks

### Setup
- [ ] Init package (no LLM required; heuristic scans + optional Claude for log summarization)
- [ ] Read `AgentContext`; extract rolling window state from `context.metadata` (last N ticks)

### Health check
- [ ] `GET ${INT_URL}/render/health/${project_id}` → `{status, latency_ms, checked_at}`
- [ ] Compute rolling uptime% over last 5 ticks (5 min window)
- [ ] Compute p95 latency over last 5 ticks
- [ ] Emit `type:"health_check"` with `metadata.status`, `metadata.latency_ms`

### Logs scan
- [ ] `GET ${INT_URL}/render/logs/${project_id}?since=<last_log_ts>&limit=50`
- [ ] Scan lines for:
  - `5xx` responses (count, cluster to endpoints)
  - Uncaught exceptions
  - Auth/redirect loops (301 → 301 chains)
  - Rate-limit / DDoS-like patterns
- [ ] For each cluster, emit `type:"log_signal"` with `content` describing the pattern, `metadata.count`, `metadata.example_line`
- [ ] Update `errors_last_5m`

### State + memory
- [ ] Post state update with new uptime_pct, p95_latency_ms, errors_last_5m
- [ ] Upsert `ops/uptime.md` with:
  - Rolling summary (last 30 min)
  - Notable incidents
  - Last N health checks (compact table)

### Anomaly escalation
- [ ] Rules:
  - `uptime_pct < 99` in last 5 min AND `status !== "healthy"` → **critical**: Linq notify + synthesize a `Bug` with `severity: "blocker"`, `where: "deployment"`, `observed: "<latest render status>"`, `expected: "healthy"`, `repro: ["GET /"]` → POST `BugReport` → orchestrator respawns Builder
  - `errors_last_5m > 10` clustered on one endpoint → **major bug**: synth `Bug { severity: "major", where: "<endpoint>", ... }` and post BugReport
  - `p95_latency_ms > 3000` sustained 3 ticks → **minor bug**: synth Bug, no owner alert
- [ ] Dedup: don't fire the same synthetic bug twice within 10 min (track via `metadata.recent_synth_bug_hashes`)

### Fixture mode
- [ ] Replay a scripted sequence:
  - Ticks 1–3: 100% up, low latency
  - Tick 4: `p95_latency_ms` spike, emit `log_signal`
  - Tick 5: recovery, back to healthy
- [ ] Persist cursor in metadata

## Definition of Done
- [ ] Given healthy service: `health_check` event, state updated, no bug reports fired
- [ ] Given a 5xx cluster in logs: `log_signal` event with cluster description, and a synth `Bug` posted
- [ ] Given full outage: Linq notify fires exactly once, `BugReport` triggers Builder retry
- [ ] Dedup prevents duplicate synth bugs
- [ ] Never crashes cron; failures emit `error` and exit 0

## Do NOT
- Do not modify status directly (except via legitimate state upsert on uptime metrics)
- Do not flip a project to error; escalate via BugReport/Linq instead
- Do not run when project is not `live`
- Do not fetch full logs (limit=50); orchestrator's disk is finite

## Standalone demo
```bash
FIXTURE_MODE=true TURN_ID=tsw INT_URL=http://localhost:4100 ORCH_URL=http://localhost:4000 \
  node dist/run.js < fixtures/contexts/service-watcher.json
```
Expected on the "spike" fixture tick: `health_check` + `log_signal` + posted synth Bug; on recovery ticks, just `health_check`.
