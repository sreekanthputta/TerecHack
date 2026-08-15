# Agent C0 · Track 3 — Planner

## Role
Read the owner's one-line idea (and any queued pivot messages), produce a `BusinessPlan` versioned JSON, write `memory/projects/<id>/plan.md`, exit.

## Owns
`packages/agents/planner/` — standalone CLI. Runs once per plan version (turn 0, then again on every pivot).

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin — includes owner idea, prior plan (if version > 1), absorbed `messages`, workspace memory paths, plugin masked configs
- Env: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `FIXTURE_MODE`, `TURN_ID`, `ORCH_URL`
- Fixtures: `fixtures/plans/3d-printer.json`, `fixtures/plans/ceramic-mugs.json`

## Produces
- Trace events posted via `POST ${ORCH_URL}/internal/turns/${TURN_ID}/events`
- New `BusinessPlan` posted via `POST /internal/turns/:turn_id/plan`
- Memory write via `POST /internal/turns/:turn_id/memory` at `plan.md`
- Optionally appends to `workspace/learned_patterns.md` when the pattern is genuinely reusable (e.g. "print-on-demand ships fastest via …")
- Terminal `type:"result"` event, then exit 0

## Contracts
```typescript
import type { AgentContext, BusinessPlan, TraceEvent } from "@autobiz/shared";
```

## Tasks

### Setup
- [ ] Init `packages/agents/planner/` (TypeScript, `commander`, Anthropic SDK, `zod`)
- [ ] Read `AgentContext` from stdin (single JSON line)
- [ ] Small helper `emit(partial)` that fills `id`/`ts`/`agent`/`turn`/`agent_run_id` and POSTs to `/internal/turns/:turn_id/events`

### LLM planning
- [ ] Prompt Claude with owner idea + workspace `learned_patterns.md` + absorbed messages (if v>1)
- [ ] Force JSON output validated against `BusinessPlan` (zod)
- [ ] Emit `thought` events for reasoning steps (< 500 chars each)
- [ ] If confidence in vertical or budget is thin → set the relevant agent tasks' `confidence` (via metadata) below 0.6 to seed Verifier engagement

### Plan write
- [ ] POST validated plan to `/internal/turns/:turn_id/plan` with `version = context.plan?.version + 1 || 1`
- [ ] Compose `plan.md` (human-readable mirror) and POST via memory endpoint

### Pivot flow
- [ ] If `context.messages` is non-empty and `context.plan` exists, treat as pivot: emit `thought` explaining the change, then produce v(n+1)
- [ ] Preserve `project_id`, `owner_contact` from prior plan
- [ ] Never delete history; version bumps are additive

### Fallback
- [ ] On LLM parse failure after one retry, emit `error` event, load fixture plan by keyword ("3d/printer" → 3d-printer.json, "mug" → ceramic-mugs.json), post it, exit 0. **Never crash.**

### Result
- [ ] Emit final `type:"result"` event with a one-line summary
- [ ] Exit 0

## Definition of Done
- [ ] Given idea "3d printer sitting idle", posts a valid v1 plan and `plan.md` in <15s
- [ ] Given a v1 plan + pivot message "actually let's do mug shop", posts v2 plan with new vertical
- [ ] FIXTURE_MODE run posts fixture plan in <3s with no external calls

## Do NOT
- Do not do research. Planner only sketches structure; Researcher validates.
- Do not directly call integrations.
- Do not write to memory paths outside your project.

## Standalone demo
```bash
cd packages/agents/planner
FIXTURE_MODE=true TURN_ID=t1 ORCH_URL=http://localhost:4000 \
  echo '{"turn_id":"t1","project_id":"demo","turn":0,"agent":"planner","agent_run_id":"r1","plan":null,"messages":[],"memory":{"workspace":[],"project":[]},"plugin_configs":[],"env":{"integrations_url":"http://localhost:4100","orchestrator_url":"http://localhost:4000","fixture_mode":true}}' \
  | node dist/run.js
```
