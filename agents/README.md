# Developer Agent PRDs — Ralph loop style

Each file in this directory is a self-contained brief for **one developer agent** (Claude Code session, Cursor tab, or human dev). Read your assigned PRD front-to-back before touching code.

## The ralph loop

Every PRD is designed for this pattern:

```
while not done:
    read PRD file (this file, front-to-back)
    look at the checkbox progress under "Tasks"
    find the next unchecked step
    do it
    check the box, commit
    if hit blocker → emit blocker to team channel, stop
```

Because the whole state lives in the checkboxes, an agent can crash, resume, or hand off without losing context. Every task step is small enough to complete in one iteration.

## PRD anatomy

Every PRD in this folder has the same sections in the same order:

1. **Role** — who you are, one line
2. **Owns** — the exact directory you write to. Do not write elsewhere.
3. **Consumes** — files, fixtures, env vars, shared types you may read
4. **Produces** — outputs (files, endpoints, trace events)
5. **Contracts** — imports you must use verbatim from `packages/shared/`
6. **Tasks** — numbered checklist with checkboxes. Do them in order.
7. **Definition of Done** — testable conditions
8. **Do NOT** — hard rules
9. **If stuck** — escalation path
10. **Standalone demo** — how to run just this package against fixtures

## The five tracks

Work is split into five parallel tracks. Each track is a directory owner; multiple PRDs may live under the same track (e.g. all reactive agents share Track 3's context contract).

| Track | Theme | PRDs | Package(s) |
|-------|-------|------|------------|
| **1** | UI | [`agent-a-ui.md`](./agent-a-ui.md) | `packages/ui/` |
| **2** | Orchestrator + DB | [`agent-b-orchestrator.md`](./agent-b-orchestrator.md) | `packages/orchestrator/` |
| **3** | Reactive agents | [`agent-c0-planner.md`](./agent-c0-planner.md), [`agent-c1-researcher.md`](./agent-c1-researcher.md), [`agent-c2-builder.md`](./agent-c2-builder.md), [`agent-c3-verifier.md`](./agent-c3-verifier.md), [`agent-c4-replay-qa.md`](./agent-c4-replay-qa.md) | `packages/agents/{planner,researcher,builder,verifier,replay-qa}/` |
| **4** | Cron agents | [`agent-d1-revenue-watcher.md`](./agent-d1-revenue-watcher.md), [`agent-d2-service-watcher.md`](./agent-d2-service-watcher.md) | `packages/agents/{revenue-watcher,service-watcher}/` |
| **5** | Integrations | [`agent-e-integrations.md`](./agent-e-integrations.md) | `packages/integrations/` |

## Golden rules — every dev agent

1. **Only write files inside your `Owns` directory. Zero exceptions.**
2. Do not modify `packages/shared/`. If you need a schema change, stop and escalate per [CONTRACTS.md §9](../CONTRACTS.md).
3. **All communication with the orchestrator is HTTP** (`POST /internal/turns/:turn_id/events`). No stdout JSONL. No file drops.
4. Emit trace events for every meaningful action. Judges are reading them live.
5. Your package must run standalone via `npm run demo` against fixtures.
6. Commit after every completed task step. Small commits, clear messages.
7. If ambiguous, ship the smallest thing that satisfies the checkbox and move on.

## Timeline

- **Hour 0.0 – 0.75** — Phase 0 (contracts, fixtures, PRDs) done. No dev agents running yet.
- **Hour 0.75 – 5.75** — All tracks work in parallel. No cross-talk needed.
- **Hour 5.75 – 6.75** — Integration. See [`../INTEGRATION.md`](../INTEGRATION.md).
- **Hour 6.75 – 7.75** — Demo prep + rehearsal. See [`../DEMO.md`](../DEMO.md).

## Dependency order (only for integration; dev can run in parallel)

```
Phase 0: shared/ + fixtures/  (must be done before any track starts)
    │
    ├── Track 1 (UI)              ── fixtures/traces/*.jsonl → SSE mock
    ├── Track 2 (Orch)            ── stub agents from fixtures/agents/stubs/
    ├── Track 3 (Reactive)        ── AgentContext from fixtures/contexts/*.json
    ├── Track 4 (Cron)            ── same context contract as Track 3
    └── Track 5 (Integrations)    ── FIXTURE_MODE=true returns canned data
```

Phase 2 wires them together — see [`../INTEGRATION.md`](../INTEGRATION.md).

## How to launch a dev agent

### Via Claude Code (worktree pattern) — recommended

Phase A locked the monorepo skeleton (types, stubs, contract tests, lockfile) on `main`. Each dev agent then works inside its own git worktree at `.claude/worktrees/<slug>/` on branch `feat/<slug>`. Slugs and branches:

| Slug | Branch | PRD | Package |
|------|--------|-----|---------|
| `agent-a-ui` | `feat/agent-a-ui` | `agent-a-ui.md` | `@autobiz/ui` |
| `agent-b-orch` | `feat/agent-b-orch` | `agent-b-orchestrator.md` | `@autobiz/orchestrator` |
| `agent-c0-planner` | `feat/agent-c0-planner` | `agent-c0-planner.md` | `@autobiz/agent-planner` |
| `agent-c1-researcher` | `feat/agent-c1-researcher` | `agent-c1-researcher.md` | `@autobiz/agent-researcher` |
| `agent-c2-builder` | `feat/agent-c2-builder` | `agent-c2-builder.md` | `@autobiz/agent-builder` |
| `agent-c3-verifier` | `feat/agent-c3-verifier` | `agent-c3-verifier.md` | `@autobiz/agent-verifier` |
| `agent-c4-replay-qa` | `feat/agent-c4-replay-qa` | `agent-c4-replay-qa.md` | `@autobiz/agent-replay-qa` |
| `agent-d1-revenue-watcher` | `feat/agent-d1-revenue-watcher` | `agent-d1-revenue-watcher.md` | `@autobiz/agent-revenue-watcher` |
| `agent-d2-service-watcher` | `feat/agent-d2-service-watcher` | `agent-d2-service-watcher.md` | `@autobiz/agent-service-watcher` |
| `agent-e-integrations` | `feat/agent-e-integrations` | `agent-e-integrations.md` | `@autobiz/integrations` |

Worktrees are created once from `main` by the coordinator:

```bash
for slug in agent-a-ui agent-b-orch agent-c0-planner agent-c1-researcher \
            agent-c2-builder agent-c3-verifier agent-c4-replay-qa \
            agent-d1-revenue-watcher agent-d2-service-watcher agent-e-integrations; do
  git worktree add ".claude/worktrees/$slug" -b "feat/$slug" main
done
```

Then, for each worktree, open a fresh Claude Code session there and hand it its PRD. Give it:

> Read `agents/<your-prd>.md`. You are in worktree `<slug>` on branch `feat/<slug>`. Only write inside `packages/<your-package>/`. Ralph-loop the Tasks checklist: read → do one → commit → repeat. Your merge gate is `pnpm --filter <pkg> test:contracts` green (run from the worktree root). When Definition of Done is met, push to `origin feat/<slug>` and stop.

Worktrees share the pnpm content-addressed store, so a `pnpm install` inside a fresh worktree is fast. `.claude/worktrees/` is gitignored — the branches live in git, but the worktree checkouts stay off-index.

### Merge gate (per package)

Before pushing your branch:

```bash
pnpm --filter <pkg> build
pnpm --filter <pkg> test:contracts
```

Both must be green. The PR will re-run the full contract suite (`pnpm test:contracts` at repo root) against your branch — green = merge.

## When your PRD is fully checked

1. Run `pnpm --filter <pkg> demo` (or `pnpm --filter <pkg> test:contracts`) in your worktree. Must succeed.
2. Verify any additional test scripts listed in Definition of Done.
3. `git push -u origin feat/<slug>`.
4. Open a PR against `main`. Title: `<slug>: <one-line summary>`.
5. Stand by for Phase 2 integration merge.
