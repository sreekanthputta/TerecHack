# CONTRACTS — LOCKED after Phase 0

> **Any change to this file requires all-track sign-off.** Adding or renaming a field breaks parallel work. If you feel the urge, follow the change protocol at the bottom instead.

Every track imports types from `packages/shared/` (published as `@autobiz/shared`). Do not redeclare these locally.

---

## 0. Runtime shape

Three processes. Each track owns exactly one process boundary.

| Port | Process       | Owner       | Deps                                    |
|------|---------------|-------------|-----------------------------------------|
| 3000 | Next.js UI    | Track 1     | Orchestrator SSE + REST                 |
| 4000 | Orchestrator  | Track 2     | SQLite, spawns agents (Tracks 3 & 4)    |
| 4100 | Integrations  | Track 5     | Terac, Stripe, Render, Linq, Superserve |

Agents (Tracks 3 & 4) are short-lived processes spawned by the orchestrator. They talk **back** to the orchestrator over HTTP (`POST /internal/turns/:turn_id/events`) — **not** stdout JSONL. They talk **out** to integrations via `http://localhost:4100`.

There is **no Redis, no message bus**. SQLite is the source of truth; SSE is the fan-out.

---

## 1. Shared TypeScript types

Location: `packages/shared/src/`. All fields are required unless marked `?:`.

### `agents.ts`

```typescript
export type AgentName =
  | "planner"           // reactive · runs at turn boundaries
  | "researcher"        // reactive
  | "builder"           // reactive · may be spawned as v1, v2, v3…
  | "verifier"          // reactive · owns Terac aggregation
  | "replay-qa"         // reactive · runs after every builder ship (NEW)
  | "revenue-watcher"   // cron · 30s tick
  | "service-watcher"   // cron · 60s tick (NEW)
  | "orchestrator";     // pseudo-agent for orchestrator-emitted events
```

### `events.ts` — TraceEvent

Everything the UI renders comes from here. Monotonic per-project `id` is assigned by the orchestrator on insert.

```typescript
export type TraceEventType =
  | "thought"           // internal reasoning, streamed live
  | "action"            // "I am doing X now"
  | "terac_call"        // sent a study to Terac
  | "terac_result"      // Terac responses landed (raw, un-aggregated)
  | "decision"          // Verifier picked a value; drives before/after card
  | "plan_update"       // BusinessPlan version bumped
  | "deploy"            // Render deploy succeeded, includes url
  | "bugs_found"        // Replay QA reported failures (NEW)
  | "bugs_fixed"        // Builder v2 shipped fixes for a bug list (NEW)
  | "health_check"      // Service Watcher tick (NEW)
  | "log_signal"        // Service Watcher spotted something in logs (NEW)
  | "sale"              // Revenue Watcher observed a charge
  | "pivot_absorbed"    // Orchestrator absorbed a message at turn boundary
  | "result"            // Agent finished, handoff payload attached
  | "error";            // Something failed; do not crash the project

export type TraceEvent = {
  id: number;                        // monotonic per project_id, set by orchestrator
  project_id: string;                // ULID
  turn: number;                      // 0-based; increments on each turn boundary
  agent: AgentName;
  agent_run_id: string;              // uuid, distinguishes builder v1 vs v2
  type: TraceEventType;
  content: string;                   // markdown-safe, <500 chars, human-readable
  ts: string;                        // ISO8601 UTC with Z suffix
  confidence?: number;               // 0.0–1.0, present on decision events
  metadata?: Record<string, unknown>;
};
```

### `plan.ts` — BusinessPlan

Planner outputs. Verifier can bump `version` on pivots. Everyone else reads it.

```typescript
export type AgentTask = {
  role: Exclude<AgentName, "orchestrator">;
  task: string;                      // one-sentence instruction
  depends_on?: string[];             // roles that must finish first
};

export type TeracStudyPlan = {
  topic: string;                     // "pricing" | "positioning" | "vendor-choice" | ...
  audience: string;                  // "general" | "expert:makers" | ...
  when: "before-build" | "post-mvp" | "on-uncertainty";
};

export type BusinessPlan = {
  project_id: string;
  version: number;                   // starts at 1, bumps on pivot
  goal: string;                      // one sentence, verbatim from owner
  vertical: string;                  // "print-on-demand" | "delivery-site" | ...
  agents: AgentTask[];
  budget_usd: number;
  terac_studies_planned: TeracStudyPlan[];
  owner_contact: {
    channel: "imessage" | "email";
    address: string;
  };
};
```

### `terac.ts` — TeracAsk + TeracRawResponse

**Terac client returns RAW responses only.** Aggregation belongs to Verifier.

```typescript
export type TeracAsk = {
  ask_id?: string;                   // filled by integrations layer
  project_id: string;
  question: string;
  audience: "general" | `expert:${string}`;
  options?: string[];                // multiple-choice; omit for open-ended
  target_responses: number;          // default from env
  why_asking: string;                // shown in UI + trace
};

export type TeracResponseItem = {
  answer: string;                    // if options given, one of them; else free text
  reasoning?: string;
  respondent_id?: string;            // opaque
};

export type TeracRawResponse = {
  ask_id: string;
  project_id: string;
  responses: TeracResponseItem[];
  received_at: string;               // ISO8601
};
```

### `decision.ts` — DecisionRecord

Verifier writes these after aggregating a `TeracRawResponse`. Drives the before/after card in the UI.

```typescript
export type DecisionSide = {
  value: unknown;                    // pricing number, headline string, vendor name, etc.
  confidence: number;
  reasoning: string;                 // 1–2 sentences
};

export type DecisionRecord = {
  project_id: string;
  decision_id: string;               // 8-char nanoid
  topic: string;                     // "pricing" | "vendor" | ...
  before: DecisionSide;
  after: DecisionSide;
  aggregate: string;                 // Verifier's <300-char verdict from Terac
  terac_ask_id?: string;             // null if not Terac-driven
  ts: string;
};
```

### `bugs.ts` — BugReport + Bug (NEW)

Replay QA writes a `BugReport`; the orchestrator hands it to Builder v(n+1).

```typescript
export type BugSeverity = "blocker" | "major" | "minor";

export type Bug = {
  bug_id: string;                    // 8-char nanoid
  severity: BugSeverity;
  where: string;                     // route or component, e.g. "/api/cart"
  observed: string;                  // "returned 404 on SKU-2"
  expected: string;                  // "return 200 with cart line"
  repro: string[];                   // ordered steps
};

export type BugReport = {
  project_id: string;
  run_id: string;                    // replay-qa agent_run_id
  builder_version: number;           // which builder ship was tested
  passed: number;
  failed: number;
  bugs: Bug[];
  ts: string;
};
```

### `state.ts` — BusinessState

What the UI fetches on load. Real-time updates come via SSE.

```typescript
export type ProjectStatus =
  | "planning"       // set on POST /api/business, cleared when Planner emits result
  | "researching"    // set by orchestrator when Researcher starts
  | "building"       // set by orchestrator when Builder starts
  | "qa"             // set by orchestrator when Replay QA starts (NEW)
  | "live"           // set by REPLAY QA on a green run (NEW rule)
  | "pivoting"       // set by orchestrator when a pivot message is queued
  | "error";         // set by any agent emitting a terminal error

export type BusinessState = {
  project_id: string;
  goal: string;
  status: ProjectStatus;
  plan_version: number;
  landing_url?: string;              // set by Builder on deploy
  stripe_payment_link?: string;
  stripe_balance_usd: number;        // maintained by Revenue Watcher
  charges_count: number;             // maintained by Revenue Watcher
  uptime_pct: number;                // maintained by Service Watcher (NEW)
  p95_latency_ms: number;            // maintained by Service Watcher (NEW)
  errors_last_5m: number;            // maintained by Service Watcher (NEW)
  builder_version: number;           // 1 on first ship, bumps on retry
  decisions_count: number;
  bugs_open: number;                 // Replay QA − Builder deltas (NEW)
  started_at: string;
  updated_at: string;
};
```

### `plugins.ts` — Plugin registry (NEW)

```typescript
export type PluginId =
  | "terac" | "stripe" | "anthropic"          // required tier
  | "render" | "linq" | "superserve" | "shopify"  // recommended
  | "cloudflare" | "twilio" | "sendgrid"          // optional
  | "ga4" | "etsy" | "meta_ads" | "amazon";       // analytics/optional

export type PluginTier = "required" | "recommended" | "optional";

export type PluginField = {
  key: string;                       // env var name, e.g. "STRIPE_RESTRICTED_KEY"
  label: string;                     // "Restricted API key"
  placeholder: string;               // "rk_live_..."
  secret: boolean;                   // masks on display
  required: boolean;
};

export type PluginDescriptor = {
  id: PluginId;
  name: string;
  tier: PluginTier;
  purpose: string;                   // one-liner
  used_by: AgentName[];              // which agents call it
  fields: PluginField[];
  scopes?: string[];                 // e.g. Shopify write_products
};

export type PluginConfig = {
  id: PluginId;
  connected: boolean;
  masked_preview: Record<string, string>;   // { STRIPE_RESTRICTED_KEY: "rk_live_••••4Fx2" }
  connected_at?: string;
  // NOTE: encrypted_values are NEVER returned to the UI. They live server-side only.
};
```

---

## 2. HTTP API — Orchestrator (:4000)

### Public (called by UI)

| Method | Path                             | Body                                                                | Response                | Notes |
|--------|----------------------------------|---------------------------------------------------------------------|-------------------------|-------|
| POST   | `/api/business`                  | `{idea, owner_contact?, idempotency_key}`                           | `{project_id}`          | Same `idempotency_key` returns same `project_id` for 24h |
| GET    | `/api/business/:id`              | —                                                                   | `BusinessState`         | |
| GET    | `/api/businesses`                | —                                                                   | `BusinessState[]`       | Newest first |
| GET    | `/api/business/:id/events`       | `?since=<event_id>&limit=200`                                       | `TraceEvent[]`          | Paged history |
| GET    | `/api/business/:id/decisions`    | —                                                                   | `DecisionRecord[]`      | |
| GET    | `/api/business/:id/memory`       | —                                                                   | `{files: MemoryFile[]}` | Reads md tree |
| POST   | `/api/business/:id/message`      | `{content}`                                                         | `{queued_for_turn}`     | Pivot / mid-flight message |
| GET    | `/api/plugins`                   | —                                                                   | `PluginDescriptor[]`    | Static catalog |
| GET    | `/api/plugins/config`            | —                                                                   | `PluginConfig[]`        | Masked only |
| PUT    | `/api/plugins/:id/config`        | `{fields: Record<string,string>}`                                   | `PluginConfig`          | Encrypts + stores |
| DELETE | `/api/plugins/:id/config`        | —                                                                   | `{ok:true}`             | Disconnect |

### SSE stream

`GET /api/business/:id/stream`

- Server sends `event: trace\ndata: <TraceEvent JSON>\n\n`
- Every event has `id: <TraceEvent.id>` (monotonic per project)
- Client sends `Last-Event-ID` header on reconnect → server replays events with `id > Last-Event-ID` before resuming live
- Heartbeat comment `: ping\n\n` every 15s
- SSE only carries `TraceEvent`. Decisions and state changes ride as `type: "decision"` / `type: "plan_update"` events; UI derives derived state.

### Internal (called by spawned agents — Tracks 3 & 4)

**Agents post events; they do not print JSONL to stdout.** Orchestrator assigns the monotonic `id` and fans out to SSE.

| Method | Path                                          | Body                          | Response         |
|--------|-----------------------------------------------|-------------------------------|------------------|
| POST   | `/internal/turns/:turn_id/events`             | `TraceEvent` (id ignored)     | `{id}`           |
| POST   | `/internal/turns/:turn_id/decisions`          | `DecisionRecord`              | `{ok:true}`      |
| POST   | `/internal/turns/:turn_id/plan`               | `BusinessPlan` (with version) | `{ok:true}`      |
| POST   | `/internal/turns/:turn_id/bugs`               | `BugReport`                   | `{ok:true}`      |
| POST   | `/internal/turns/:turn_id/state`              | `Partial<BusinessState>`      | `{ok:true}`      |
| POST   | `/internal/turns/:turn_id/memory`             | `{path, content}`             | `{ok:true}`      |
| GET    | `/internal/turns/:turn_id/context`            | —                             | `AgentContext`   |

`AgentContext` is what the orchestrator hands to a spawned agent on stdin (JSON, single line). Includes plan, memory paths, plugin masked configs, prior bugs (if Builder v≥2), and turn metadata. Agents authenticate by presenting the `turn_id` — the orchestrator refuses events for stale or unknown turns.

---

## 3. HTTP API — Integrations (:4100)

**Rule: Integrations returns raw provider data. Never aggregates. Never decides.**

| Method | Path                          | Caller           | Body                                                       | Response                              |
|--------|-------------------------------|------------------|------------------------------------------------------------|---------------------------------------|
| POST   | `/terac/ask`                  | Verifier         | `TeracAsk`                                                 | `{ask_id}`                            |
| GET    | `/terac/result/:ask_id`       | Verifier         | —                                                          | `TeracRawResponse` or `202 Pending`   |
| POST   | `/stripe/payment-link`        | Builder          | `{project_id, product_name, amount_usd?}`                  | `{url, id}`                           |
| GET    | `/stripe/charges/:project_id` | Revenue Watcher  | `?since=<iso>`                                             | `{charges:[…], balance_usd, count}`   |
| POST   | `/render/deploy`              | Builder          | `{project_id, html, name}`                                 | `{url, deploy_id}`                    |
| GET    | `/render/health/:project_id`  | Service Watcher  | —                                                          | `{status, latency_ms, checked_at}`    |
| GET    | `/render/logs/:project_id`    | Service Watcher  | `?since=<iso>&limit=50`                                    | `{lines:[…]}`                         |
| POST   | `/linq/notify`                | Verifier / Orch  | `{project_id, message, requires_approval?}`                | `{sid}`                               |
| POST   | `/superserve/session`         | Researcher       | `{ttl_sec?}`                                               | `{session_id, browser_ws_url}`        |
| DELETE | `/superserve/session/:id`     | Researcher       | —                                                          | `{ok:true}`                           |
| POST   | `/replay/project`             | Replay QA        | `{project_id, base_url, design_document}`                  | `{id, url, exploration_id}`           |
| GET    | `/replay/project/:id/status`  | Replay QA        | —                                                          | `{state, journeys_passed_count, journeys_total, updated_at}` |
| GET    | `/replay/project/:id/bugs`    | Replay QA        | —                                                          | `{bugs:[{id, severity, title, route, evidence_url}...]}` |
| GET    | `/replay/bugs/:bug_id`        | Replay QA        | —                                                          | `{id, severity, title, observed, expected, repro:[...], evidence_url, route}` |
| POST   | `/replay/project/:id/explorations` | Replay QA   | `{regression_notes?}`                                      | `{exploration_id}`                    |

**Loop QA note:** `/replay/*` endpoints wrap `qa.replay.io/api/v1`. Auth via `REPLAY_API_KEY` (Bearer, format `lqa_...`). Replay QA agent is the only caller. Superserve is not used here — Loop QA drives its own browsers.

**Stripe rule:** Orchestrator refuses to boot if `STRIPE_RESTRICTED_KEY` starts with `sk_`. Restricted keys only. Full stop.

---

## 4. SQLite schema

Single file `autobiz.db` at repo root, owned by orchestrator. Integrations opens read-only for balance/log caching. UI never touches the DB directly.

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,               -- always 'default' for hackathon
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,               -- ULID
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  goal TEXT NOT NULL,
  status TEXT NOT NULL,              -- ProjectStatus
  plan_version INTEGER NOT NULL DEFAULT 1,
  builder_version INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  landing_url TEXT,
  stripe_payment_link TEXT,
  stripe_balance_usd REAL NOT NULL DEFAULT 0,
  charges_count INTEGER NOT NULL DEFAULT 0,
  uptime_pct REAL NOT NULL DEFAULT 100,
  p95_latency_ms INTEGER NOT NULL DEFAULT 0,
  errors_last_5m INTEGER NOT NULL DEFAULT 0,
  decisions_count INTEGER NOT NULL DEFAULT 0,
  bugs_open INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE plans (
  project_id TEXT NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  json TEXT NOT NULL,                -- serialized BusinessPlan
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, version)
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- global; UI dedupes per project
  project_id TEXT NOT NULL REFERENCES projects(id),
  project_seq INTEGER NOT NULL,      -- monotonic per project_id (used by SSE)
  turn INTEGER NOT NULL,
  agent TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL,
  metadata TEXT,                     -- JSON
  ts TEXT NOT NULL
);
CREATE INDEX idx_events_project_seq ON events(project_id, project_seq);

CREATE TABLE decisions (
  decision_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  topic TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  aggregate TEXT NOT NULL,
  terac_ask_id TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE bugs (
  bug_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  builder_version INTEGER NOT NULL,
  severity TEXT NOT NULL,
  where_ TEXT NOT NULL,
  observed TEXT NOT NULL,
  expected TEXT NOT NULL,
  repro_json TEXT NOT NULL,
  fixed_in_version INTEGER,          -- null until Builder v(n+1) claims fix
  ts TEXT NOT NULL
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  from_role TEXT NOT NULL,           -- "owner" for pivots
  content TEXT NOT NULL,
  queued_for_turn INTEGER,           -- null once absorbed; then set to turn N
  absorbed_at TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE turns (
  turn_id TEXT PRIMARY KEY,          -- uuid
  project_id TEXT NOT NULL REFERENCES projects(id),
  turn INTEGER NOT NULL,
  agent TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL               -- "running" | "done" | "error"
);

CREATE TABLE plugin_configs (
  id TEXT PRIMARY KEY,               -- PluginId
  connected INTEGER NOT NULL,        -- 0 | 1
  encrypted_json TEXT,               -- AES-256-GCM, nonce + ciphertext base64
  masked_json TEXT NOT NULL,         -- safe to return to UI
  connected_at TEXT
);
```

---

## 5. Memory conventions

Memory is on disk as markdown, one file per fact/section. Structured for both humans (judges reading during the demo) and agents (grep + read).

### Tree

```
memory/
├── workspace/                       # shared across ALL projects for the owner
│   ├── owner_profile.md
│   ├── writing_voice.md
│   └── learned_patterns.md          # e.g. "print-on-demand ships fastest on X"
└── projects/
    └── <project_id>/
        ├── plan.md                  # human mirror of BusinessPlan (auto-regen on version bump)
        ├── research/
        │   ├── competitors.md
        │   ├── pricing.md
        │   └── audience.md
        ├── decisions/
        │   └── <decision_id>.md     # one file per DecisionRecord
        ├── build/
        │   └── v<n>-notes.md        # Builder's own notes per version
        ├── replay/
        │   ├── run-<n>-bugs.md      # Replay QA output for each run
        │   └── run-<n>-report.md
        └── ops/
            ├── uptime.md            # Service Watcher rolling summary
            └── revenue.md           # Revenue Watcher rolling summary
```

### File format

Every memory file starts with YAML frontmatter, then markdown.

```markdown
---
type: research | decision | bugs | plan | notes | ops
project_id: 01HXXXX...              # omit for workspace files
agent: researcher                    # who wrote it
turn: 3
ts: 2026-08-15T14:32:11Z
links: [../decisions/k3n2p9xa.md]    # relative paths to related files
---

# Human-readable heading

Prose the next agent (or judge) needs. Under ~2000 chars per file.
```

### Read/write rules

- **All agents** read: their project's memory tree + workspace memory (read-only unless they are Planner/Verifier).
- **Planner** writes: `plan.md`, `workspace/learned_patterns.md`.
- **Researcher** writes: `research/*.md`.
- **Builder** writes: `build/v<n>-notes.md`.
- **Verifier** writes: `decisions/*.md`, may append to `workspace/learned_patterns.md`.
- **Replay QA** writes: `replay/*.md`.
- **Revenue Watcher** writes: `ops/revenue.md` (upsert).
- **Service Watcher** writes: `ops/uptime.md` (upsert).
- Memory writes go through `POST /internal/turns/:turn_id/memory` — the orchestrator does the fs write. Agents never touch disk directly.

---

## 6. IDs, timestamps, conventions

| Thing         | Format                                        |
|---------------|-----------------------------------------------|
| `project_id`  | ULID (Crockford base32, 26 chars, sortable)   |
| `decision_id` | 8-char nanoid, lowercase                      |
| `bug_id`      | 8-char nanoid, lowercase                      |
| `turn_id`     | uuid v4                                       |
| `agent_run_id`| uuid v4                                       |
| `ask_id`      | whatever Terac returns                        |
| Timestamps    | ISO8601 UTC with `Z` suffix. Never epoch.     |

**Confidence:** `0.0` = no idea, `1.0` = certain. `< 0.6` triggers Verifier escalation (Terac study). `>= 0.6` proceeds silently.

**Trace event content:** Written for humans (judges read live). Under 500 chars. Present tense: "Searching Etsy top sellers", not "I will search…"

**Errors:** Emit `type: "error"` with recovery info. Do not crash the project. Verifier is the escalation path.

---

## 7. Status FSM — who sets what

Ownership is explicit so no two agents race the same field.

| Transition                   | Set by         | Trigger                                              |
|------------------------------|----------------|------------------------------------------------------|
| → `planning`                 | Orchestrator   | `POST /api/business`                                 |
| `planning → researching`     | Orchestrator   | Planner emits `type:"result"` with a plan            |
| `researching → building`     | Orchestrator   | Researcher emits `type:"result"` past Verifier check |
| `building → qa`              | Orchestrator   | Builder emits `type:"deploy"`                        |
| `qa → building`              | Orchestrator   | Replay QA emits `type:"bugs_found"` with `failed>0`  |
| `qa → live`                  | **Replay QA**  | Replay QA emits `type:"result"` on a green run       |
| `* → pivoting`               | Orchestrator   | Owner message queued, waiting for turn boundary      |
| `pivoting → planning`        | Orchestrator   | Turn boundary hit, planner respawned                 |
| `* → error`                  | Any agent      | Terminal error (rare — most errors are recoverable)  |

---

## 8. Turn boundary + pivot semantics

- A **turn** is one agent's run start-to-finish (successful or errored). `turns.turn` is a project-scoped counter that increments after each run.
- Owner messages posted via `POST /api/business/:id/message` are stored with `queued_for_turn = NULL`. When the current turn ends, the orchestrator:
  1. Reads all queued messages for this project.
  2. Sets `queued_for_turn = <next turn number>`.
  3. Emits a `pivot_absorbed` trace event.
  4. Passes them to the next agent (typically Planner) in `AgentContext.messages`.
- **Agents never see mid-turn messages.** This is the whole point of turn-based execution: no torn state.

---

## 9. Change protocol

If your track needs a schema change:

1. **Stop coding.**
2. Open a PR against `packages/shared/` with the proposed change.
3. Post `BLOCKED: <field> on <type>` in the shared thread.
4. Track leads sign off (or Sreekanth breaks tie).
5. Everyone re-pulls `shared/` and continues.

**Do not silently add fields. Do not use `metadata` as an escape hatch — that hides breakage.** The `metadata` field is for genuinely one-off provider data that never influences UI or downstream agents.
