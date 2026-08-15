# Agent C1 · Track 3 — Researcher

## Role
Given the plan, research the market. Browse via Superserve. Emit thought/action events; write research notes to memory; produce a `type:"result"` event with a structured payload the Builder will consume. **Set confidence honestly** — thin evidence → confidence < 0.6, which triggers Verifier.

## Owns
`packages/agents/researcher/` — standalone CLI. Runs once per turn.

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin (plan, plugin_configs)
- Integrations at `${INT_URL}`: `POST /superserve/session`, `DELETE /superserve/session/:id`
- Env: `ANTHROPIC_API_KEY`, `FIXTURE_MODE`, `TURN_ID`, `ORCH_URL`, `INT_URL`
- Fixture: `fixtures/researcher-outputs/3dp-niches.json`

## Produces
- Trace events + memory writes under `research/{competitors,pricing,audience}.md`
- Final `type:"result"` event with `metadata.research`:
  ```json
  {
    "candidates": [{"name":"cable organizers","evidence":"...","price_range":[10,15],"monthly_sales_est":200}],
    "top_pick": "cable organizers",
    "confidence": 0.5
  }
  ```

## Contracts
```typescript
import type { AgentContext, TraceEvent } from "@autobiz/shared";
```

## Tasks

### Setup
- [ ] Init package, TypeScript, Anthropic SDK, zod
- [ ] Read `AgentContext` from stdin
- [ ] Trace emit helper

### Browsing
- [ ] Wrapper `browse(url)` → open Superserve session, load page, return text; close on turn end
- [ ] Wrapper `search(query)` → same, via a search endpoint
- [ ] 30s timeouts, one retry
- [ ] `FIXTURE_MODE=true` → skip HTTP, replay fixture

### LLM plan-of-inquiry
- [ ] Prompt Claude: "Given plan.vertical=<X> and goal=<Y>, produce 3–5 sources to check"
- [ ] Emit `thought` events with reasoning
- [ ] Execute the plan; emit an `action` per source

### Memory writes
- [ ] After each source, `POST /internal/turns/:turn_id/memory` at `research/<slug>.md` with frontmatter
- [ ] Keep each file under ~2000 chars

### Synthesis + confidence
- [ ] Aggregate findings via Claude; produce structured JSON (zod-validated)
- [ ] **Rule:** `confidence >= 0.7` requires ≥3 corroborating sources. Otherwise cap at 0.6.
- [ ] Post final `type:"result"` event with `metadata.research`, `confidence` set at event top level

### Fixture mode
- [ ] Replays fixture with ~500ms between events, confidence 0.5 (guarantees Verifier fires in the demo)

## Definition of Done
- [ ] Real mode: valid result event in <60s
- [ ] Fixture mode: full flow in <5s, no network
- [ ] Zod-validated payload; no inflated confidence

## Do NOT
- Do not write files outside your package's memory scope.
- Do not skip the memory writes — Verifier and Builder read them.
- Do not close Superserve session before the turn ends.

<!-- WORKTREE-SETUP:START -->
## Worktree setup

You work in `.claude/worktrees/agent-c1-researcher/` on branch `feat/agent-c1-researcher`. From that directory:

- **Only write files inside `packages/agents/researcher/`.** Root files (`pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`, `tests/contracts/`) are frozen for Phase A. If you need a new runtime dep, add it via `pnpm --filter @autobiz/agent-researcher add <dep>` — pnpm updates the root lockfile in your branch only.
- **Schema changes are forbidden here.** If your work needs to add a field to a shared type, STOP and follow [CONTRACTS.md §9](../CONTRACTS.md).
- **Merge gate** (must be green before push):
  ```bash
  pnpm --filter @autobiz/agent-researcher build
  pnpm --filter @autobiz/agent-researcher test:contracts
  ```
- **Commit cadence:** one commit per completed checkbox. Small commits, clear messages.
- **Push:** `git push -u origin feat/agent-c1-researcher`
- **PR:** open against `main` when every checkbox is done and Definition of Done is met. The contract test suite re-runs on the PR branch — green = merge.
- **If your worktree gets stale**, rebase on `main`: `git fetch origin && git rebase origin/main`. Do not force-push shared branches.
<!-- WORKTREE-SETUP:END -->

## Standalone demo
```bash
FIXTURE_MODE=true TURN_ID=t2 ORCH_URL=http://localhost:4000 INT_URL=http://localhost:4100 \
  node dist/run.js < fixtures/contexts/researcher.json
```
