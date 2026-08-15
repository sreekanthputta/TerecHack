# Agent B — Orchestrator + Planner

## Role
You are the brain of the system. You expose HTTP endpoints to the UI, run the Planner LLM, spawn specialist agents (as child processes), route their trace events, and stream everything to the UI over WebSocket.

## Owns
`packages/orchestrator/` — Node.js + TypeScript service on port 4000.

## Consumes
- `packages/shared/` (types) — read-only
- `packages/agents/*/dist/run.js` — child processes you spawn (Researcher, Builder, Verifier)
- `packages/integrations/` — you may import as library or call over HTTP on `:4100`
- `fixtures/plans/*.json` — fallback plans when Planner LLM fails
- Env: `ANTHROPIC_API_KEY`, `REDIS_URL`, `ORCH_HTTP_PORT`, all owner contact vars

## Produces
- HTTP server on `:4000` implementing endpoints in `CONTRACTS.md` §2
- WebSocket server at `/api/traces/:business_id`
- Trace event bus (Redis pub/sub OR in-memory event emitter — both fine)
- Business state store (in-memory for hackathon; persist to `/tmp/autobiz-state.json`)
- `npm run demo` script that spawns fake agents and streams a scripted flow

## Contracts (import from `packages/shared`)
- `TraceEvent`, `TraceEventType`, `AgentName`
- `BusinessPlan`, `AgentTask`
- `BusinessState`, `BusinessStatus`
- `DecisionRecord`

---

## Tasks

### Setup

- [ ] Init `packages/orchestrator/` with TypeScript, Express (or Fastify), `ws`, `zod`
- [ ] Import types from `packages/shared/`
- [ ] `.env` loader with defaults from `.env.example`
- [ ] Structured logging (`pino`)

### HTTP API

- [ ] `POST /api/business` — body: `{idea: string, owner_contact?}` → creates `business_id`, kicks off Planner, returns `{business_id}`
- [ ] `GET  /api/business/:id` — returns `BusinessState`
- [ ] `GET  /api/businesses` — returns all `BusinessState[]`
- [ ] `POST /internal/trace` — accepts `TraceEvent` from agents, validates via zod, pushes to bus
- [ ] `POST /internal/decision` — accepts `DecisionRecord`, updates state, broadcasts to UI
- [ ] `POST /internal/plan-update` — Verifier can patch the current plan
- [ ] `POST /internal/status` — set business status
- [ ] `POST /api/business/:id/approval` — receives owner approve/deny from UI (Linq-style webhook)

### WebSocket

- [ ] `WS /api/traces/:business_id` — server → client
- [ ] On connect: replay all traces for that business_id, then subscribe to bus
- [ ] Broadcast both trace events (`{kind:"trace", payload}`) and decisions (`{kind:"decision", payload}`)
- [ ] Heartbeat every 15s to keep connection alive

### Trace bus

- [ ] Simple in-process EventEmitter keyed by `business_id`
- [ ] Fallback: Redis pub/sub if `REDIS_URL` is set and reachable
- [ ] All events also persisted to in-memory array so late-connecting UI sees history

### Planner LLM

- [ ] Prompt: "You are a business planner. Given the owner's idea, produce a BusinessPlan JSON matching this schema (paste schema). Ask at most ONE clarifying question if truly ambiguous, else produce plan."
- [ ] Model: `claude-sonnet-4-6`
- [ ] Output validated with zod against `BusinessPlan`
- [ ] Emit `TraceEvent`s for each reasoning step (streamed if using SDK streaming)
- [ ] On parse failure or timeout (>30s), fall back to `fixtures/plans/3d-printer.json` if the idea contains "3d" or "printer", else `fixtures/plans/ceramic-mugs.json` if "mug", else fail cleanly

### Agent spawner

- [ ] For each `AgentTask` in the plan, spawn a child process:
  - Researcher: `node packages/agents/researcher/dist/run.js --business-id X --task "..."`
  - Builder: same pattern
  - Verifier: long-running singleton per business — spawned first, listens for confidence < 0.6 events
- [ ] Child stdout is JSONL; each line is a `TraceEvent` → parse + push to bus
- [ ] Track child PIDs per business_id so you can kill them on error
- [ ] Respect `depends_on` — don't spawn until upstream agent emits a `type: "result"` event
- [ ] Verifier is always spawned first and stays running

### Business state store

- [ ] `Map<business_id, BusinessState>`
- [ ] Update on every trace event (specifically `type: "result"` and `type: "decision"` and `/internal/status`)
- [ ] Persist snapshot to `/tmp/autobiz-state.json` every 5s so demo survives a crash

### Owner notifications hook

- [ ] When a `TraceEvent` has `metadata.owner_alert: true`, forward via `POST http://localhost:4100/linq/notify`
- [ ] If `metadata.requires_approval: true`, include approve/deny buttons in the Linq message

### Fake-agents demo mode (fallback)

- [ ] `npm run demo` starts orchestrator + spawns fake agents that emit the `fixtures/traces/demo-happy-path.jsonl` events at real pacing
- [ ] UI can connect and see the whole demo flow without any real LLM calls
- [ ] Set env `FAKE_AGENTS=1`

---

## Definition of Done

- [ ] `curl -X POST http://localhost:4000/api/business -H 'Content-Type: application/json' -d '{"idea":"3d printer idle"}'` returns `{"business_id":"..."}` in <5s
- [ ] UI connects to WS and receives at least 10 real trace events before "LIVE" status
- [ ] Planner LLM produces a valid `BusinessPlan` for the 3D printer prompt in <15s
- [ ] Spawning a Researcher child process works: stdout JSONL is parsed and streamed to UI
- [ ] `FAKE_AGENTS=1 npm run demo` produces the full fixture flow with zero external API calls
- [ ] Ctrl-C shuts down all child processes cleanly

---

## Do NOT

- Write files outside `packages/orchestrator/`
- Modify `packages/shared/`
- Bake business logic into the orchestrator — you route events, you don't decide
- Add auth, users, or a database. This is a demo.
- Introduce Kafka/RabbitMQ/etc. In-memory + optional Redis is enough.

---

## If stuck

1. Planner LLM failing? Fall back to fixture plan by keyword match. UI won't care.
2. Child process spawn issues? Have agents export a `run()` function you can call in-process as a fallback.
3. WebSocket flakes? UI has fixture fallback. Focus on `/internal/trace` HTTP being solid.

---

## Standalone demo

```bash
cd packages/orchestrator
npm install
FAKE_AGENTS=1 npm run demo
# curl http://localhost:4000/api/business -X POST -d '{"idea":"3d printer idle"}'
# Watch trace events stream from ws://localhost:4000/api/traces/<id>
```

Expected: HTTP responds instantly, WS delivers the full 40-event fixture stream over ~40 seconds, business status transitions planning → researching → building → LIVE.
