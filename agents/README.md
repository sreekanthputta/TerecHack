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

## Assignments

| PRD | Agent | Owns |
|---|---|---|
| [`agent-a-ui.md`](./agent-a-ui.md) | A — UI | `packages/ui/` |
| [`agent-b-orchestrator.md`](./agent-b-orchestrator.md) | B — Orchestrator | `packages/orchestrator/` |
| [`agent-c1-researcher.md`](./agent-c1-researcher.md) | C1 — Researcher | `packages/agents/researcher/` |
| [`agent-c2-builder.md`](./agent-c2-builder.md) | C2 — Builder | `packages/agents/builder/` |
| [`agent-c3-verifier.md`](./agent-c3-verifier.md) | C3 — Verifier ⭐ | `packages/agents/verifier/` |
| [`agent-d-integrations.md`](./agent-d-integrations.md) | D — Integrations | `packages/integrations/` |

## Golden rules — every agent

1. Only write files inside your `Owns` directory. Zero exceptions.
2. Do not modify `packages/shared/`. If you need a schema change, stop and escalate.
3. Emit trace events for every meaningful action. Judges are reading them live.
4. Your package must run standalone via `npm run demo` against fixtures.
5. Commit after every completed task step. Small commits, clear messages.
6. If ambiguous, ship the smallest thing that satisfies the checkbox and move on.

## Timeline

- **Hour 0.0 – 0.75** — Phase 0 (contracts, fixtures, PRDs) done. No dev agents running yet.
- **Hour 0.75 – 5.75** — All six agents work in parallel. No cross-talk needed.
- **Hour 5.75 – 6.75** — Integration. See [`../INTEGRATION.md`](../INTEGRATION.md).
- **Hour 6.75 – 7.75** — Demo prep + rehearsal. See [`../DEMO.md`](../DEMO.md).

## How to launch a dev agent

### Via Claude Code (worktree pattern)

```bash
# From repo root
git worktree add ../autobiz-ui feature/ui
cd ../autobiz-ui
# Open Claude Code here. Give it:
"Read agents/agent-a-ui.md. Work through the Tasks checklist in order. Commit after each. Stop if blocked."
```

Repeat for each agent in its own worktree. They cannot touch each other's files.

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
