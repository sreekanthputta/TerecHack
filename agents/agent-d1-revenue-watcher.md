# Agent D1 · Track 4 — Revenue Watcher

## Role
Every 30s while a project is `live`, poll Stripe for new charges. On new charge → emit `type:"sale"` trace event, upsert `business_state.stripe_balance_usd` and `charges_count`, append to `memory/projects/<id>/ops/revenue.md`. On big-first-sale, fire an owner alert via Linq.

## Owns
`packages/agents/revenue-watcher/` — short-lived CLI, invoked by the orchestrator every 30s.

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin — has `plugin_configs`, `landing_url`, plus `metadata.last_charge_ts` (orchestrator carries this forward)
- Integrations: `GET /stripe/charges/:project_id?since=<iso>`
- Env: `FIXTURE_MODE`, `TURN_ID`, `ORCH_URL`, `INT_URL`
- Fixture: `fixtures/stripe/charges.jsonl` — one line per fake charge, timed

## Produces
- Trace events (`action` on poll, `sale` per new charge, `error` on failure)
- State update via `POST /internal/turns/:turn_id/state` with new `stripe_balance_usd`, `charges_count`
- Memory upsert `ops/revenue.md` (rolling summary of last N charges + totals)
- Optional Linq notify on first-ever charge or milestone thresholds ($10, $100, $1000)
- Terminal `type:"result"`

## Contracts
```typescript
import type { AgentContext, TraceEvent } from "@autobiz/shared";
```

## Tasks

### Setup
- [ ] Init package (no LLM; pure pipe)
- [ ] Read `AgentContext`
- [ ] Extract `since = context.metadata?.last_charge_ts ?? project.started_at`

### Poll
- [ ] `GET ${INT_URL}/stripe/charges/${project_id}?since=${since}`
- [ ] Parse `{charges: [...], balance_usd, count}`
- [ ] If empty: emit one `action` "no new charges" event, post state upsert with unchanged values, exit 0

### On new charges
- [ ] For each charge (in order):
  - Emit `type:"sale"` with `metadata.amount_usd`, `metadata.charge_id`, `content: "$X sale on <sku or product>"`
- [ ] Post state upsert: `stripe_balance_usd = balance_usd`, `charges_count = count`
- [ ] Upsert `ops/revenue.md`:
  - Frontmatter with `updated_at`
  - Section: totals, last 10 charges (id, amount, ts, product)
  - Section: notable events (first sale, milestones)

### Milestones + owner alerts
- [ ] Persist milestone flags in metadata (orchestrator carries context.metadata forward across ticks). Fire Linq notify on:
  - First-ever charge
  - Balance crosses $10, $100, $1000, $10000
- [ ] Skip if the flag was already fired

### Failure
- [ ] Stripe API failure → emit `error`, state upsert with unchanged values, exit 0 (never crash cron)

### Fixture mode
- [ ] Read `fixtures/stripe/charges.jsonl`
- [ ] Return the next unread charge line per tick until exhausted; then no-ops
- [ ] Persist "cursor" via `metadata.fixture_cursor` in state upsert so subsequent ticks progress

## Definition of Done
- [ ] Given no new charges: single `action` event, state unchanged
- [ ] Given 2 new charges: 2 `sale` events, balance and count reflect them, `ops/revenue.md` updated
- [ ] First-ever charge triggers exactly one Linq notify; subsequent ticks do not re-fire
- [ ] Never crashes; on Stripe failure emits `error` and exits 0

## Do NOT
- Do not use secret `sk_` Stripe keys (integrations enforces `rk_` only)
- Do not modify `status`
- Do not run when project status is not `live` — orchestrator gates this
- Do not process more than 1 tick's worth per run — you are cron, not a batcher

<!-- WORKTREE-SETUP:START -->
## Worktree setup

You work in `.claude/worktrees/agent-d1-revenue-watcher/` on branch `feat/agent-d1-revenue-watcher`. From that directory:

- **Only write files inside `packages/agents/revenue-watcher/`.** Root files (`pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`, `tests/contracts/`) are frozen for Phase A. If you need a new runtime dep, add it via `pnpm --filter @autobiz/agent-revenue-watcher add <dep>` — pnpm updates the root lockfile in your branch only.
- **Schema changes are forbidden here.** If your work needs to add a field to a shared type, STOP and follow [CONTRACTS.md §9](../CONTRACTS.md).
- **Merge gate** (must be green before push):
  ```bash
  pnpm --filter @autobiz/agent-revenue-watcher build
  pnpm --filter @autobiz/agent-revenue-watcher test:contracts
  ```
- **Commit cadence:** one commit per completed checkbox. Small commits, clear messages.
- **Push:** `git push -u origin feat/agent-d1-revenue-watcher`
- **PR:** open against `main` when every checkbox is done and Definition of Done is met. The contract test suite re-runs on the PR branch — green = merge.
- **If your worktree gets stale**, rebase on `main`: `git fetch origin && git rebase origin/main`. Do not force-push shared branches.
<!-- WORKTREE-SETUP:END -->

## Standalone demo
```bash
FIXTURE_MODE=true TURN_ID=trw INT_URL=http://localhost:4100 ORCH_URL=http://localhost:4000 \
  node dist/run.js < fixtures/contexts/revenue-watcher.json
```
Expected: 1 or 2 `sale` events, `ops/revenue.md` written, balance updated.
