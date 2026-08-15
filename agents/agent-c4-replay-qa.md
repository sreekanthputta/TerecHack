# Agent C4 · Track 3 — Replay QA (NEW)

## Role
After every Builder ship (`type:"deploy"`), you are spawned to prove the site actually works. You are a **thin client of Loop QA** ([qa.replay.io](https://qa.replay.io)) — you POST a project with the deployed URL + the plan as a design document, poll their AI explorer for findings, translate the returned bugs into our `BugReport` shape, and hand it to Builder. When Loop QA returns zero bugs, **you and only you** flip `status=live`.

You do NOT drive a browser yourself. Loop QA's AI does the exploration.

## Owns
`packages/agents/replay-qa/` — CLI, one turn per Builder version.

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin (plan, landing_url from state, builder_version, plugin_configs)
- Integrations: `POST /replay/project`, `GET /replay/project/:id/status`, `GET /replay/project/:id/bugs`, `POST /replay/project/:id/explorations`
- Env: `REPLAY_API_KEY`, `REPLAY_BASE_URL`, `FIXTURE_MODE`
- Fixture: `fixtures/replay-qa/run-1-bugs.json`, `fixtures/replay-qa/run-2-green.json`

## Produces
- Trace events (`thought`, `action`, `error`, `bugs_found`, `result`)
- `BugReport` via `POST /internal/turns/:turn_id/bugs`
- Memory writes `replay/run-<n>-bugs.md`, `replay/run-<n>-report.md` (includes Loop QA dashboard URL for judges to click)
- State updates:
  - On failures: `bugs_open = failed`
  - On green run: `POST /internal/turns/:turn_id/state` with `status: "live"`, `bugs_open: 0`

## Contracts
```typescript
import type {
  AgentContext, Bug, BugReport, BugSeverity, TraceEvent
} from "@autobiz/shared";
```

## Loop QA flow (what integrations wraps)

1. `POST /api/v1/projects` with `{ name, base_url, design_document }` → returns `{ id, url (dashboard), exploration_id }`
2. Poll `GET /api/v1/projects/{id}/status` every 5s until exploration is done or timeout
3. `GET /api/v1/projects/{id}/bugs` → list of bugs, each with severity + evidence
4. Optionally `GET /api/v1/bugs/{id}` for detailed analysis + repro steps
5. To re-run after Builder v(n+1): `POST /api/v1/projects/{id}/explorations` (reuses the project id)

## Tasks

### Setup
- [ ] Init package (no browser deps — pure HTTP client)
- [ ] Read `AgentContext`; derive `landing_url`, `product_summary`, and `builder_version`

### Design document
- [ ] Build a markdown `design_document` from the plan:
  - Product summary
  - Golden path: load home → view SKU → add-to-cart → checkout via Stripe payment link
  - SKU list with prices
  - Mobile viewport expectation (390×844)
  - Any explicit scenarios from `plan.terac_studies_planned` (e.g. "expert:makers said the CTA should say 'Buy Now', not 'Order'")
- [ ] On retry (`builder_version > 1`), append: "Regression check: bugs `<bug_id list>` should now be fixed"

### Create or reuse project
- [ ] If this is `builder_version=1`, `POST /replay/project` with landing_url + design_document → get `{project_id, dashboard_url, exploration_id}`
- [ ] If `builder_version > 1`, look up prior `loop_qa_project_id` from memory (`replay/loop-qa-project.md`) and `POST /replay/project/:id/explorations` for a fresh run
- [ ] Emit `action` event with `metadata.dashboard_url` — this URL is what the judge clicks during the demo

### Poll for findings
- [ ] Poll `GET /replay/project/:id/status` every 5s (max 3 minutes for fixture demo; real demos may want longer)
- [ ] Emit occasional `thought` event: "Loop QA exploring · 12 test-journeys covered so far"

### Translate bugs
- [ ] `GET /replay/project/:id/bugs` → for each returned bug, `GET /replay/bugs/:bug_id` for detail
- [ ] Map their fields → our `Bug`:
  - `severity`: their level → `blocker | major | minor`
  - `where`: their route/component (or extracted from evidence URL)
  - `observed`: their finding summary
  - `expected`: their expected behavior
  - `repro`: their ordered steps
  - Stash `metadata.loop_qa_bug_id` and `metadata.evidence_url` (screenshot/replay link) on the trace event so the UI can deep-link back
- [ ] Build `BugReport { project_id, run_id, builder_version, passed, failed, bugs, ts }`
  - `passed` = Loop QA's `journeys_passed_count` (from status endpoint)
  - `failed` = bugs.length
- [ ] `POST /internal/turns/:turn_id/bugs`
- [ ] Emit `type:"bugs_found"` with `metadata.passed`, `metadata.failed`, `metadata.dashboard_url`, `metadata.bug_ids`

### Memory writes
- [ ] `replay/loop-qa-project.md` — stores `loop_qa_project_id` + `dashboard_url` so v2/v3 runs reuse the same project
- [ ] `replay/run-<n>-bugs.md` — one section per bug with `observed`, `expected`, `repro`, `evidence_url`
- [ ] `replay/run-<n>-report.md` — summary with the Loop QA dashboard link at top (for judges/humans)

### Green run
- [ ] If `bugs.length === 0`:
  - Emit `bugs_found` event with `failed:0`
  - `POST /internal/turns/:turn_id/state` with `{status:"live", bugs_open:0}`
  - Emit terminal `result` event
- [ ] **This is the only place `status=live` may be set.** Orchestrator enforces.

### Failure handling
- [ ] Loop QA timeout (> 3 min without status advance) → emit `error` with recovery note, report `passed=0, failed=0` (unknown), do NOT flip status. Builder does not respawn.
- [ ] Loop QA returns 5xx → retry once, then emit `error` and exit 0

### Fixture mode
- [ ] Run 1: return 15 pass / 2 fail (matches the demo mockup — cart 404 on SKU-2, mobile checkout missing price), with a fake `dashboard_url: "https://qa.replay.io/projects/fixture-run-1"`
- [ ] Run 2: return 17 pass / 0 fail, flip to live
- [ ] ~8s runtime per run to feel real

## Definition of Done
- [ ] Given a v1 deploy, produces a valid BugReport in <180s live or <10s fixture
- [ ] `metadata.dashboard_url` on the `bugs_found` event is a clickable Loop QA URL
- [ ] v2 run reuses the same `loop_qa_project_id` (POSTs a new exploration, not a new project)
- [ ] Green run flips status to live exactly once; no double-flips on subsequent turns
- [ ] Each bug carries `evidence_url` in metadata so the UI can deep-link back to the recording

## Do NOT
- Do not drive a browser yourself. Loop QA does the exploration.
- Do not use Superserve for QA. Superserve is for Researcher scraping and agent isolation.
- Do not fix bugs. That's Builder's job.
- Do not flip status to live on a partial pass. Zero failures required.
- Do not create a new Loop QA project on retries — reuse the existing project_id.

## Standalone demo
```bash
FIXTURE_MODE=true TURN_ID=tqa INT_URL=http://localhost:4100 ORCH_URL=http://localhost:4000 \
  node dist/run.js < fixtures/contexts/replay-qa-run-1.json
```
Expected: `bugs_found` event with 15 pass / 2 fail, `metadata.dashboard_url` populated, `replay/run-1-bugs.md` written, status stays `qa`.
