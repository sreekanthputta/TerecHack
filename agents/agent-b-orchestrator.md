# Agent B · Track 2 — Orchestrator + SQLite + SSE

## Role
The brain. You are the only process that touches SQLite. You expose REST + SSE to the UI. You spawn agents and hand each a signed `turn_id`. Agents post events back to you over HTTP; you assign monotonic ids and fan out to SSE.

**You do not do LLM thinking.** Planner is a spawned agent (see `agent-c0-planner.md`). You are pure plumbing + scheduling.

## Owns
`packages/orchestrator/` — Node.js + TypeScript service on port 4000. Also owns:
- `autobiz.db` (SQLite, at repo root)
- `memory/` tree writes (agents send content; you write to disk)

**Do not write anywhere else.**

## Consumes
- `packages/shared/` (types) — read-only
- `packages/agents/*/dist/run.js` — child processes you spawn
- `packages/integrations/` — call over HTTP on `:4100`
- `fixtures/plans/*.json` — fallback plans on Planner timeout
- Env: `ORCH_PORT`, `DATABASE_URL`, `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `FIXTURE_MODE`, all `TERAC_*` / `STRIPE_*` / `RENDER_*` / `LINQ_*` / plugin keys

## Produces
- REST server on `:4000` implementing all endpoints in [CONTRACTS.md §2](../CONTRACTS.md)
- SSE endpoint `GET /api/business/:id/stream` with `Last-Event-ID` resume
- SQLite schema per [CONTRACTS.md §4](../CONTRACTS.md)
- Turn scheduler: absorbs pivots at turn boundaries, respects `depends_on`
- Agent spawner: hands `AgentContext` on stdin, tracks child PIDs, kills on shutdown
- Memory writer: durable md files under `memory/`
- Plugin config store: encrypted at rest (AES-256-GCM)

## Contracts
Import verbatim from `@autobiz/shared`. See CONTRACTS.md §1. Never redeclare.

---

## Tasks

### Setup
- [ ] Init `packages/orchestrator/` (TypeScript, Fastify or Express, `better-sqlite3`, `zod`, `pino`, `ulid`, `nanoid`, `@microsoft/fetch-event-source` server-side alternative or hand-rolled SSE)
- [ ] Import shared types
- [ ] `.env` loader with defaults from `.env.example`. **Refuse to boot if `STRIPE_RESTRICTED_KEY` starts with `sk_`.**
- [ ] Structured logging (`pino`) with per-project child logger
- [ ] Graceful shutdown: SIGINT/SIGTERM kill all spawned children before exit

### SQLite bootstrap
- [ ] Create `db/migrate.ts` that runs the schema in CONTRACTS.md §4 exactly
- [ ] Idempotent: safe to run at every boot
- [ ] Insert `workspaces` row with id `default`, owner from `DEMO_OWNER_NAME` / `DEMO_OWNER_EMAIL`
- [ ] Wrap `better-sqlite3` in a small repo module (`db/repo.ts`) — no raw SQL in route handlers
- [ ] Use `PRAGMA journal_mode=WAL` for concurrent reads while writing

### Public REST API
Every endpoint validated via zod. Never trust the client.

- [ ] `POST /api/business` — body `{idea, owner_contact?, idempotency_key}`
  - Check `projects.idempotency_key` first; if hit within 24h, return existing `project_id`
  - Create `projects` row with `status=planning`, ULID id
  - Emit `pivot_absorbed`? No — this is initial. Emit an orchestrator-level trace event `type:"action"`, agent `"orchestrator"`, content `"project started: <idea>"`.
  - Spawn Planner as turn 0
  - Return `{project_id}`
- [ ] `GET /api/business/:id` — join `projects` + `business_state`, return `BusinessState`
- [ ] `GET /api/businesses` — return all, newest first
- [ ] `GET /api/business/:id/events?since=<id>&limit=200` — paged history from `events`
- [ ] `GET /api/business/:id/decisions` — from `decisions`
- [ ] `GET /api/business/:id/memory` — walk `memory/projects/<id>/**/*.md`, parse frontmatter, return `{files: MemoryFile[]}`
- [ ] `POST /api/business/:id/message` — body `{content}`. Insert into `messages` with `queued_for_turn=NULL`. Emit trace event `type:"action"` content `"owner queued: <content>"`. Return `{queued_for_turn: <current_turn+1>}`.
- [ ] `GET /api/plugins` — static catalog (see plugin registry section below)
- [ ] `GET /api/plugins/config` — return `PluginConfig[]` (masked only)
- [ ] `PUT /api/plugins/:id/config` — encrypt fields with AES-256-GCM (`ENCRYPTION_KEY`), store, return masked
- [ ] `DELETE /api/plugins/:id/config` — clear row, set `connected=0`

### SSE stream
- [ ] `GET /api/business/:id/stream` — Content-Type `text/event-stream`
- [ ] On connect, read `Last-Event-ID` header. If present, replay `events` rows with `project_seq > lastId` before subscribing to live feed.
- [ ] Every event framed as `id: <project_seq>\nevent: trace\ndata: <TraceEvent JSON>\n\n`
- [ ] Heartbeat comment `: ping\n\n` every 15s
- [ ] In-memory pub/sub keyed by `project_id`; each connection subscribes on open, unsubscribes on close
- [ ] Backpressure: if a client can't keep up, drop connection (client will reconnect with Last-Event-ID)

### Internal (agent-facing) API
- [ ] `POST /internal/turns/:turn_id/events` — validate turn is `running`, assign `project_seq = max(project_seq)+1 for that project`, insert, publish to SSE
- [ ] `POST /internal/turns/:turn_id/decisions` — insert `decisions`, bump `business_state.decisions_count`, also emit a synthetic trace event `type:"decision"` so UI sees it
- [ ] `POST /internal/turns/:turn_id/plan` — insert `plans` row with new `version`, bump `projects.plan_version`, emit `type:"plan_update"`
- [ ] `POST /internal/turns/:turn_id/bugs` — insert `bugs` rows, update `business_state.bugs_open`, emit `type:"bugs_found"`
- [ ] `POST /internal/turns/:turn_id/state` — merge `Partial<BusinessState>` into `business_state`. If `status="live"`, only accept when the calling agent is `replay-qa` (turn belongs to that agent).
- [ ] `POST /internal/turns/:turn_id/memory` — validate path is within the calling project's memory tree; write md file to disk. Reject writes to another project's tree.
- [ ] `GET /internal/turns/:turn_id/context` — return `AgentContext` JSON (see below)

### AgentContext (what agents receive)
```typescript
type AgentContext = {
  turn_id: string;
  project_id: string;
  turn: number;
  agent: AgentName;
  agent_run_id: string;
  plan: BusinessPlan;                   // current version
  prior_bugs?: Bug[];                   // populated for Builder v≥2
  messages: string[];                   // owner pivot messages absorbed this turn
  memory: { workspace: string[]; project: string[] };  // relative paths agents may read
  plugin_configs: PluginConfig[];       // masked previews only; real keys via /integrations
  env: {
    integrations_url: string;
    orchestrator_url: string;
    fixture_mode: boolean;
  };
};
```
Delivered as a single JSON line on stdin at spawn. Also available via `GET /internal/turns/:turn_id/context`.

### Turn scheduler
- [ ] A `turn_scheduler.ts` that owns the per-project run queue
- [ ] On project create → spawn Planner (turn 0), status `planning`
- [ ] When an agent's turn ends (child exits or emits `type:"result"`), scheduler:
  1. Absorbs queued `messages` for this project — set `queued_for_turn = next_turn`, emit `pivot_absorbed`
  2. Chooses next agent based on plan + status:
     - `planning` result → Researcher(s), status `researching`
     - `researching` result → Builder v1, status `building`
     - `building` deploy → Replay QA, status `qa`
     - Replay QA `bugs_found` with `failed>0` → Builder v(n+1) with `prior_bugs`, status `building`
     - Replay QA green → **do not spawn anything, status flips to `live` via internal/state call**
     - `pivot_absorbed` → Planner respawn with messages, plan version bumps
  3. Spawns cron agents (revenue-watcher, service-watcher) once status transitions to `live` (they run until project ends)
- [ ] Verifier is not on the linear path — it's triggered by any confidence<0.6 event. When such an event lands, spawn Verifier as a parallel turn (its own `turn_id`).
- [ ] Depends_on: never spawn an agent until upstream `type:"result"` events are in for all deps

### Agent spawner
- [ ] `spawn_agent(agent, project_id, extras)` creates a `turns` row (`status=running`), a `turn_id`, an `agent_run_id`, and forks `node packages/agents/<agent>/dist/run.js`
- [ ] Passes `AgentContext` as first line of stdin
- [ ] Sets env `ORCH_URL=http://localhost:4000`, `TURN_ID=<turn_id>`, `INT_URL=http://localhost:4100`
- [ ] Captures stdout to log file `logs/<project_id>/<turn>-<agent>.log` (for debugging; not routed to UI)
- [ ] On exit, marks turn `done` or `error`, then invokes scheduler
- [ ] Kill-on-shutdown: track PIDs, SIGTERM then SIGKILL after 5s

### Cron loop
- [ ] Separate scheduler for cron agents; spawn on interval per agent config:
  - `revenue-watcher` every 30s
  - `service-watcher` every 60s
- [ ] Only ticks while project status is `live`
- [ ] Each tick is a fresh turn with a fresh `turn_id`

### Plugin registry
- [ ] Static catalog in `src/plugins/catalog.ts` — one `PluginDescriptor` per `PluginId`. See CONTRACTS.md §1 `plugins.ts`.
- [ ] Field definitions mirror `.env.example` groupings (Required / Recommended / Optional).
- [ ] Encryption: use `node:crypto` AES-256-GCM. `ENCRYPTION_KEY` from env (32 bytes hex). Store as `{iv, tag, ciphertext}` base64 in `plugin_configs.encrypted_json`.
- [ ] Masking: last 4 chars of secret fields visible, e.g. `rk_live_••••4Fx2`.
- [ ] **DEMO_SETTINGS_MODE** — when `DEMO_SETTINGS_MODE=true`, return connected=true with hardcoded masked previews even if no real key is stored. Never break the UI during a demo.

### Idempotency
- [ ] `projects.idempotency_key` unique index. `POST /api/business` with dup key returns existing `project_id` for 24h.

### Fixture / demo mode
- [ ] `FIXTURE_MODE=true` → agent spawner instead spawns `fixtures/agents/stubs/<agent>.js` which replays canned events from `fixtures/traces/`
- [ ] Full demo flow runs without any external API calls

---

## Definition of Done
- [ ] `curl -X POST http://localhost:4000/api/business -d '{"idea":"3d printer idle","idempotency_key":"..."}'` returns `{project_id}` in <200ms
- [ ] Same `idempotency_key` twice returns the same `project_id`
- [ ] UI connects to SSE, receives history + live events, no gaps or duplicates on refresh
- [ ] Spawning Planner works: stdout captured, HTTP events land in `events` table with monotonic `project_seq`
- [ ] Turn scheduler correctly walks planning → researching → building → qa → building (bug fix) → qa → live for the 3D printer fixture
- [ ] Owner message posted via `POST /api/business/:id/message` is absorbed at the next turn boundary and shows as `pivot_absorbed`
- [ ] Replay QA green run flips `status=live`; no other agent can set that field
- [ ] `PUT /api/plugins/stripe/config` encrypts, stores, returns masked preview `rk_live_••••XXXX`; raw value is not returned
- [ ] `FIXTURE_MODE=true npm run demo` produces full fixture flow with zero external API calls
- [ ] Ctrl-C shuts down all children cleanly

---

## Do NOT
- Do not do LLM thinking. That's Planner/Verifier. You are plumbing.
- Do not write files outside `packages/orchestrator/`, `autobiz.db`, or `memory/`.
- Do not modify `packages/shared/`.
- Do not use stdout JSONL from agents as a control channel. Agents post HTTP; stdout is just logs.
- Do not add Redis, Kafka, or any external queue. SQLite + in-memory pub/sub.
- Do not authenticate agents with anything but `turn_id` — refuse events for unknown or ended turns.
- Do not return raw plugin values to any UI endpoint. Ever.

## If stuck
- Planner LLM failing? Return fallback plan from fixtures by keyword match, emit `type:"error"` with recovery note.
- Turn scheduler ambiguous? Defer to explicit deps in the plan; if unclear, spawn agents sequentially.
- SSE flakes? UI has its own retry with `Last-Event-ID`. Focus on `project_seq` monotonicity — that's the only correctness contract.

<!-- WORKTREE-SETUP:START -->
## Worktree setup

You work in `.claude/worktrees/agent-b-orch/` on branch `feat/agent-b-orch`. From that directory:

- **Only write files inside `packages/orchestrator/`.** Root files (`pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`, `tests/contracts/`) are frozen for Phase A. If you need a new runtime dep, add it via `pnpm --filter @autobiz/orchestrator add <dep>` — pnpm updates the root lockfile in your branch only.
- **Schema changes are forbidden here.** If your work needs to add a field to a shared type, STOP and follow [CONTRACTS.md §9](../CONTRACTS.md).
- **Merge gate** (must be green before push):
  ```bash
  pnpm --filter @autobiz/orchestrator build
  pnpm --filter @autobiz/orchestrator test:contracts
  ```
- **Commit cadence:** one commit per completed checkbox. Small commits, clear messages.
- **Push:** `git push -u origin feat/agent-b-orch`
- **PR:** open against `main` when every checkbox is done and Definition of Done is met. The contract test suite re-runs on the PR branch — green = merge.
- **If your worktree gets stale**, rebase on `main`: `git fetch origin && git rebase origin/main`. Do not force-push shared branches.
<!-- WORKTREE-SETUP:END -->

## Standalone demo
```bash
cd packages/orchestrator
npm install
FIXTURE_MODE=true npm run demo
# In another terminal:
curl -X POST http://localhost:4000/api/business \
  -H 'Content-Type: application/json' \
  -d '{"idea":"3d printer idle","idempotency_key":"demo-1"}'
# curl http://localhost:4000/api/business/<id>/stream    # SSE, watch events
```
Expected: full 60-event flow ending with `status=live`, Stripe balance $24, 2 bugs found + fixed, in ~90 seconds.
