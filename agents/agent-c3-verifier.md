# Agent C3 · Track 3 — Verifier ⭐ (STAR OF THE DEMO)

## Role
When any agent emits a decision-shaped event with `confidence < 0.6` (or explicit `metadata.request_verifier: true`), you are spawned as a parallel turn. You formulate a `TeracAsk`, ping the integrations layer, poll for raw responses, **you (not the Terac client) aggregate** the answers, produce a `DecisionRecord` (before/after), and write it to memory. This is the money shot on stage.

**Aggregation ownership:** Terac client returns raw responses only (`TeracRawResponse`). Verifier alone synthesizes the human-readable `aggregate` string and `after` side of the decision.

## Owns
`packages/agents/verifier/` — CLI spawned per-decision (not long-running).

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin, plus `metadata.trigger_event` (the low-confidence event that spawned this turn) inserted by the orchestrator
- Integrations: `POST /terac/ask`, `GET /terac/result/:ask_id`, `POST /linq/notify`
- Env: `ANTHROPIC_API_KEY`, `TERAC_API_KEY`, `TERAC_DEFAULT_SAMPLE_SIZE`, `TERAC_DEFAULT_TIMEOUT_SEC`, `FIXTURE_MODE`
- Fixture: `fixtures/terac-responses/*.json`

## Produces
- Trace events: `thought`, `terac_call`, `terac_result`, `decision`
- `DecisionRecord` via `POST /internal/turns/:turn_id/decisions`
- Optional plan update via `POST /internal/turns/:turn_id/plan` (bumps version)
- Optional owner alert via integrations `POST /linq/notify`
- Memory write: `decisions/<decision_id>.md` with before/after and raw Terac responses appended
- May append lesson to `workspace/learned_patterns.md`
- Terminal `type:"result"`

## Contracts
```typescript
import type {
  AgentContext, TeracAsk, TeracRawResponse,
  DecisionRecord, DecisionSide, TraceEvent
} from "@autobiz/shared";
```

## Tasks

### Setup
- [ ] Init package (Anthropic SDK, `nanoid`, zod)
- [ ] Read `AgentContext`; extract `trigger_event` from context metadata

### Formulate the ask
- [ ] Prompt Claude with `trigger_event.content` + memory context → produce a `TeracAsk`:
  - `question` (one sentence)
  - `audience` (`general` or `expert:<domain>`)
  - `options` if multiple-choice
  - `target_responses` from env
  - `why_asking`
- [ ] Zod-validate; emit `terac_call` event with the ask embedded in metadata

### Call Terac
- [ ] `POST ${INT_URL}/terac/ask` → get `ask_id`
- [ ] Poll `GET ${INT_URL}/terac/result/:ask_id` every 5s (max `TERAC_DEFAULT_TIMEOUT_SEC`)
- [ ] Receive `TeracRawResponse` — DO NOT trust any aggregate from the wire

### Aggregate (Verifier owns this)
- [ ] Emit `terac_result` event with response count only
- [ ] Prompt Claude with raw responses → produce:
  - `aggregate` string (< 300 chars, quotable in UI)
  - new `after: DecisionSide` (value, confidence, reasoning)
- [ ] Build `DecisionRecord`:
  ```typescript
  {
    project_id, decision_id: nanoid(8), topic,
    before: /* from trigger_event */,
    after,
    aggregate,
    terac_ask_id: ask_id,
    ts: nowIso()
  }
  ```
- [ ] `POST /internal/turns/:turn_id/decisions`
- [ ] Emit `decision` trace event summarizing the swing
- [ ] Write `decisions/<decision_id>.md` with:
  - Frontmatter (`type: decision`, `terac_ask_id`, `topic`)
  - Before / After sections
  - Full raw Terac responses (for the memory viewer)

### Plan update
- [ ] If the decision changes a plan value (e.g. pricing, vertical, vendor), POST `/internal/turns/:turn_id/plan` with a new `BusinessPlan` version reflecting the change

### Owner alert
- [ ] If `metadata.owner_should_know: true` on the trigger event, or if the decision reverses a prior one, POST `/linq/notify` with `requires_approval: true`

### Dedup
- [ ] Look at recent decisions (via `AgentContext.memory.project` listing `decisions/`) — if same topic + similar question was answered within the last 3 turns, emit `thought` and skip. Prevents infinite verify loops.

### Fixture mode
- [ ] Look up canned response by `trigger_event.metadata.topic` in `fixtures/terac-responses/`
- [ ] Simulate ~8s poll latency (feels real on stage)

## Definition of Done
- [ ] Given a low-confidence trigger event, produces a complete `DecisionRecord` with both `before` and `after` populated with real reasoning in <30s (fixture) or <5m (live)
- [ ] `terac_call` → `terac_result` → `decision` sequence lands in order
- [ ] Aggregation happens client-side; no aggregate string comes from the integrations layer
- [ ] Two independent low-confidence events produce two separate `DecisionRecord`s
- [ ] Dedup prevents the same question re-asking within 3 turns
- [ ] `decisions/<decision_id>.md` renders cleanly in the memory viewer

## Do NOT
- Do not trust `TeracRawResponse` to carry an aggregate — that's your job.
- Do not skip the `before` side. The whole point is the swing.
- Do not modify shared schemas.
- Do not fire owner alerts for every decision. Only reversals or explicit `owner_should_know`.

## If stuck
- Terac timeout? Emit `error`, preserve the low-confidence decision as the outcome (before === after with `aggregate: "no human input received within timeout"`), continue.
- Claude refuses structured output? Retry once with schema-in-prompt reminder.

## Standalone demo
```bash
FIXTURE_MODE=true TURN_ID=tv INT_URL=http://localhost:4100 ORCH_URL=http://localhost:4000 \
  node dist/run.js < fixtures/contexts/verifier-3dp-niche.json
```
Expected: `thought → terac_call → terac_result → decision` in ~10s, decision card appears in UI.

## Why this agent matters
The single most memorable moment of the demo is Researcher confidence 0.5 → Verifier asks 15 real makers → decision card swings to confidence 0.85. Every judge understands what happened in that beat. Prioritize this above everything except the ship&fix loop.
