# Contracts — LOCKED after Phase 0

Any change to this file requires all-agent sign-off. Adding a field breaks parallel work.

Every dev agent imports types from `packages/shared/`. Do not redeclare these locally.

---

## 1. Shared TypeScript types

Location: `packages/shared/src/`

### `events.ts` — TraceEvent

Every agent emits these to the orchestrator. UI consumes them via WebSocket.

```typescript
export type AgentName =
  | "planner"
  | "researcher"
  | "builder"
  | "verifier"
  | "marketer"
  | "orchestrator";

export type TraceEventType =
  | "thought"        // internal reasoning, streamed live
  | "action"         // "I am doing X now"
  | "terac_call"     // I sent a study to Terac
  | "terac_result"   // Terac results came back
  | "decision"       // A decision was made or changed
  | "result"         // Task result / handoff
  | "error";         // Something failed, keep going

export type TraceEvent = {
  business_id: string;         // ULID or short UUID
  agent: AgentName;
  type: TraceEventType;
  content: string;             // markdown-safe, <500 chars
  ts: string;                  // ISO8601 (e.g. "2026-08-15T14:32:11Z")
  confidence?: number;         // 0.0-1.0, present on decisions
  metadata?: Record<string, unknown>;
};
```

### `plan.ts` — BusinessPlan

Planner outputs. Orchestrator spawns from. All agents read it read-only.

```typescript
export type AgentTask = {
  role: AgentName;
  task: string;                // one-sentence instruction
  depends_on?: string[];       // roles that must finish first
};

export type TeracStudyPlan = {
  topic: string;               // "pricing" | "positioning" | "vendor-choice" | ...
  audience: string;            // "general" | "expert:makers" | ...
  when: "before-build" | "post-mvp" | "on-uncertainty";
};

export type BusinessPlan = {
  business_id: string;
  goal: string;                // one sentence, verbatim from owner
  vertical: string;            // "print-on-demand" | "delivery-site" | ...
  agents: AgentTask[];
  budget_usd: number;
  terac_studies_planned: TeracStudyPlan[];
  owner_contact: {
    channel: "imessage" | "email";
    address: string;
  };
};
```

### `terac.ts` — TeracAsk + TeracResponse

```typescript
export type TeracAsk = {
  ask_id?: string;             // filled by integrations layer
  business_id: string;
  question: string;
  audience: "general" | `expert:${string}`;
  options?: string[];          // multiple-choice; omit for open-ended
  target_responses: number;    // default 10
  why_asking: string;          // shown in UI + trace
};

export type TeracResponseItem = {
  answer: string;              // if options given, one of them; else free text
  reasoning?: string;
};

export type TeracResponse = {
  ask_id: string;
  business_id: string;
  responses: TeracResponseItem[];
  aggregate: string;           // Verifier-produced verdict, <300 chars
};
```

### `decision.ts` — DecisionRecord

Drives the before/after UI card. **This is the money shot.**

```typescript
export type DecisionSide = {
  value: unknown;              // pricing number, headline string, vendor name, etc.
  confidence: number;
  reasoning: string;           // 1-2 sentences
};

export type DecisionRecord = {
  business_id: string;
  decision_id: string;
  topic: string;               // "pricing" | "vendor" | ...
  before: DecisionSide;
  after: DecisionSide;
  terac_ask_id?: string;       // null if not a Terac-driven change
  ts: string;
};
```

### `business.ts` — BusinessState

What the UI polls or receives on WebSocket connect.

```typescript
export type BusinessStatus =
  | "planning"
  | "researching"
  | "building"
  | "live"
  | "error";

export type BusinessState = {
  business_id: string;
  status: BusinessStatus;
  plan?: BusinessPlan;
  landing_url?: string;
  stripe_payment_link?: string;
  stripe_balance_usd?: number;
  decisions: DecisionRecord[];
  started_at: string;
};
```

---

## 2. HTTP API — Orchestrator

Base URL in dev: `http://localhost:4000`

| Method | Path | Caller | Payload | Response |
|---|---|---|---|---|
| `POST` | `/api/business` | UI | `{"idea": string, "owner_contact"?: {...}}` | `{"business_id": string}` |
| `GET`  | `/api/business/:id` | UI | — | `BusinessState` |
| `GET`  | `/api/businesses` | UI | — | `BusinessState[]` |
| `POST` | `/internal/trace` | Agents | `TraceEvent` | `{"ok": true}` |
| `POST` | `/internal/decision` | Verifier | `DecisionRecord` | `{"ok": true}` |
| `POST` | `/internal/plan-update` | Verifier | `{business_id, patch}` | `{"ok": true}` |
| `POST` | `/internal/status` | Any agent | `{business_id, status}` | `{"ok": true}` |

### WebSocket

`ws://localhost:4000/api/traces/:business_id`

Server → client only. Sends `TraceEvent` JSON messages as they arrive. Also sends `DecisionRecord` messages wrapped as:
```json
{"kind": "decision", "payload": DecisionRecord}
```
Regular trace events use:
```json
{"kind": "trace", "payload": TraceEvent}
```

---

## 3. Integrations HTTP API

Base URL in dev: `http://localhost:4100` (or import as library functions in-process; both allowed)

| Method | Path | Caller | Payload | Response |
|---|---|---|---|---|
| `POST` | `/terac/ask` | Verifier | `TeracAsk` | `{"ask_id": string}` |
| `GET`  | `/terac/result/:ask_id` | Verifier | — | `TeracResponse` or 202 if pending |
| `POST` | `/stripe/payment-link` | Orchestrator | `{business_id, product_name, amount_usd?}` | `{"url": string, "id": string}` |
| `GET`  | `/stripe/balance/:business_id` | Orchestrator | — | `{"balance_usd": number, "charges_count": number}` |
| `POST` | `/render/deploy` | Builder | `{business_id, html: string, name: string}` | `{"url": string}` |
| `POST` | `/linq/notify` | Verifier / Orchestrator | `{business_id, message, requires_approval?: boolean}` | `{"sid": string}` |

---

## 4. Environment variables

`.env.example` at repo root:

```
# LLM
ANTHROPIC_API_KEY=

# Terac (required)
TERAC_API_KEY=
TERAC_BASE_URL=https://api.terac.com

# Stripe
STRIPE_SECRET_KEY=              # restricted key rk_
STRIPE_DEMO_PAYMENT_LINK=       # fallback pre-created link

# Render
RENDER_API_KEY=
RENDER_OWNER_ID=

# Linq (iMessage)
LINQ_API_KEY=
LINQ_PHONE_NUMBER=
LINQ_WEBHOOK_SECRET=

# Superserve (Researcher sandbox)
SUPERSERVE_API_KEY=

# Bus
REDIS_URL=redis://localhost:6379

# Ports
ORCH_HTTP_PORT=4000
INT_HTTP_PORT=4100
UI_PORT=3000

# Owner
OWNER_IMESSAGE=+1XXXXXXXXXX
OWNER_EMAIL=putta.sreekanth1@gmail.com
```

---

## 5. Conventions

### IDs
- `business_id` — 8-char nanoid, lowercase. E.g. `k3n2p9xa`
- `decision_id` — 8-char nanoid, lowercase
- `ask_id` — whatever Terac returns; string

### Timestamps
- Always ISO8601 UTC with `Z` suffix. Never local time. Never epoch.

### Confidence scores
- `0.0` = no idea, `1.0` = certain
- `< 0.6` triggers Verifier escalation
- `>= 0.6` proceeds without human input

### Trace event content
- Written for humans (judges will read live). Not JSON dumps.
- Under 500 chars. Emit multiple events for long chains-of-thought.
- Use present tense: "Searching Etsy top sellers", not "I will search…"

### Errors
- Emit `type: "error"` trace events with recovery info in `content`. Do not crash the whole business.
- Verifier is the escalation path — on error, agents can request Verifier intervention via a trace event with `metadata.request_verifier: true`.

---

## 6. Change control

If a dev agent needs a schema change:
1. Stop coding.
2. Emit a `TraceEvent` or Slack message: `"BLOCKED: need field X on Y"`
3. Lead agent (or Sreekanth) approves and edits `packages/shared/`.
4. All dev agents re-pull `shared/` and continue.

**Do not silently add fields. Do not use `metadata` as an escape hatch for missing schema — that hides breakage.**
