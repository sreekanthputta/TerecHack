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

```bash
# From repo root
git worktree add ../autobiz-ui feature/ui
cd ../autobiz-ui
# Open Claude Code here. Give it:
#   "Read agents/agent-a-ui.md. Work through the Tasks checklist in order.
#    Commit after each. Stop if blocked."
```

Repeat for each PRD in its own worktree. They cannot touch each other's files.

### Via multiple humans

```bash
git checkout -b feature/ui         # or /orch, /researcher, ...
```

Each dev reads their assigned PRD and works the checklist.

## When your PRD is fully checked

1. Run `npm run demo` in your package. Must succeed.
2. Run any test scripts listed in Definition of Done.
3. Push your branch.
4. In team channel: `<agent> DONE, ready for integration.`
5. Stand by for Phase 2 merge.
