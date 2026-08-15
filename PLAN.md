# AutoBusiness — Zero Human Company Hackathon Plan

**Event:** Terac Zero Human Company Hackathon — Aug 15, 2026
**Location:** Humanmade, 655 Bryant St, SF
**Hacking window:** 10:45 AM → 6:45 PM (8 hours)
**Team:** Sreekanth + N developer agents (parallel Claude Code sessions / worktrees)

---

## The pitch (memorize this)

> LLM agents hallucinate business decisions. Real founders ask real people.
> AutoBusiness gives agents the same instinct: when confidence drops below a threshold, they don't guess — they call Terac and let real humans decide.

Meta-platform. User types a business idea. Agents research, build the MVP, **QA-verify the build**, market it, take payments, and **monitor uptime + revenue** on cron. When agents are uncertain, they escalate real decisions to real humans via Terac. Owner sees a live SSE trace UI and gets iMessage alerts for big calls.

---

## Tracks stacked

| Track | Prize | How we qualify |
|---|---|---|
| Best Overall Project | $2500 | Meta-platform + Terac-decision protocol |
| Best Overall Agent-Run Company | $2500 | Demo business earns real Stripe revenue in the room |
| Best Linq | $1500 / $1000 | Owner console over iMessage; tap-to-approve on decisions |
| Best Band | $500 | One Band room per business, agents genuinely coordinate |
| Best Superserve | $1000 / $500 | Sandboxes per business + used by Replay QA |
| Best Render | $500 / $300 / $100 | Render hosts every generated business |
| Terac (required) | — | Native to architecture, drives real plan changes |

**Realistic take:** aim for 1–2 sponsor tracks + a shot at Best Overall.

---

## Demo business

**"3D printer sitting idle for a month — make me money."**

Physical, universal, memorable. Judges get it in 3 seconds. Agents:
- research trending Etsy niches
- ask Terac makers to validate viability
- generate 5 SKUs + product photos
- ask Terac general population to pick winners
- Builder v1 deploys a Shopify-lite storefront on Render
- **Replay QA hits every button/route in a Superserve browser — finds 2 bugs**
- Builder v2 ships fixes; Replay QA re-runs green → status flips to `live`
- Revenue Watcher tails Stripe on 30s tick; **Service Watcher** tails logs on 60s tick
- Linq iMessage owner alert on major decisions

Backup demo business (parallel spawn during demo): **"my roommate wants to sell ceramic mugs"** — proves the platform is generic, not hardcoded.

---

## Architecture at a glance

Three processes on three ports. Everything on disk (SQLite + memory md).

```
┌───────────── UI :3000 ─────────────┐    ┌── Integrations :4100 ──┐
│  Next.js 15 · SSE client           │    │  Terac · Stripe        │
│  6 pages (landing → home →         │◀───│  Render · Linq         │
│  project → pivot → memory →        │    │  Superserve            │
│  settings)                          │    │                        │
└─────────────────▲──────────────────┘    └───────────▲────────────┘
                  │ SSE + REST                        │ HTTP
                  │                                   │
             ┌────┴──────── Orchestrator :4000 ──────┴────┐
             │  Turn scheduler · SQLite · SSE fanout       │
             │  Spawns agents · owns memory writes         │
             └────┬─────────────────────────────┬──────────┘
                  │ spawns                       │ spawns
                  ▼                              ▼
        ┌── Reactive CLIs ──┐          ┌── Cron CLIs ──┐
        │  Planner          │          │  RevenueWatch │
        │  Researcher       │          │  ServiceWatch │
        │  Builder v1..vN   │          └───────────────┘
        │  Verifier         │
        │  Replay QA (NEW)  │
        └───────────────────┘
```

All agents post events to the orchestrator over HTTP (`POST /internal/turns/:turn_id/events`). No stdout JSONL. No Redis. No message bus. See [`CONTRACTS.md`](./CONTRACTS.md).

---

## The three phases

### Phase 0 — Central planning (0:00 – 0:45)
One person (or lead agent) locks contracts, fixtures, and env config. **No developer agents spawn until this is done.** Missing something here = collision at hour 7.

Artifacts produced:
- Repo skeleton committed to `main`
- `packages/shared/*` TypeScript types (locked, see CONTRACTS.md)
- HTTP + SSE API contract (locked)
- SQLite schema (locked)
- `.env.example` with every plugin key
- `fixtures/` with demo plan + trace playback + Terac responses + Replay QA bug report
- All PRD files (this folder)

### Phase 1 — Parallel dev (0:45 – 5:45)
**Five tracks work in isolation, one per package, each in its own git worktree.** No track touches another's package. `packages/shared/` is read-only after Phase 0.

| Track | Owner | Package | Depends on |
|-------|-------|---------|------------|
| 1 | UI | `packages/ui/` | shared types only |
| 2 | Orchestrator | `packages/orchestrator/` | shared types |
| 3 | Reactive agents | `packages/agents/{planner,researcher,builder,verifier,replay-qa}/` | shared + orchestrator context contract |
| 4 | Cron agents | `packages/agents/{revenue-watcher,service-watcher}/` | shared + orchestrator context contract |
| 5 | Integrations | `packages/integrations/` | shared types |

### Phase 2 — Integration (5:45 – 6:45)
Everyone merges to `main`. Fixed 60-min checklist in [`INTEGRATION.md`](./INTEGRATION.md).

### Phase 3 — Demo prep (6:45 – 7:45 mental buffer)
Rehearse 3×. Pre-launch a live Terac study 5 min before pitch. Fallback fixture playback ready in another tab. See [`DEMO.md`](./DEMO.md).

---

## Dependency graph

Tracks are designed to be **independently runnable** against fixtures. Real integration happens at Phase 2.

```
             ┌──────────────┐
             │  packages/   │  (locked after Phase 0)
             │  shared      │
             └──────┬───────┘
                    │  imported by all
       ┌────────────┼────────────┬──────────────┬───────────┐
       ▼            ▼            ▼              ▼           ▼
   Track 1      Track 2      Track 3        Track 4    Track 5
    (UI)      (Orch+DB)   (5 reactive)   (2 cron)    (Integrations)
       │            │            │              │           │
       │            │            └──────┬───────┘           │
       │            │                   │                    │
       │            │            can be run against          │
       │            │            orch mock during dev        │
       │            │                                        │
       └────────────┴─── SSE + REST + SQLite ────────────────┘
                       Phase 2 real integration
```

**How Track 1 (UI) works standalone:** consumes fixture SSE stream `fixtures/traces/demo-3dprint.jsonl` replayed by `scripts/replay-fixture.ts`.

**How Track 2 (Orch) works standalone:** exposes REST + SSE, but spawns stub agent processes from `fixtures/agents/stubs/` that just replay canned events.

**How Track 3/4 (agents) work standalone:** given a synthetic `AgentContext` on stdin (from `fixtures/contexts/*.json`), emit events to a local echo server (`scripts/mock-orch.sh`).

**How Track 5 (integrations) works standalone:** each plugin has a `FIXTURE_MODE=true` code path that returns canned data from `fixtures/plugins/*.json`.

---

## Repo layout

```
autobusiness/
├── packages/
│   ├── shared/                       ← types, schemas, constants (LOCKED)
│   ├── ui/                           ← Track 1
│   ├── orchestrator/                 ← Track 2
│   ├── agents/
│   │   ├── planner/                  ← Track 3
│   │   ├── researcher/               ← Track 3
│   │   ├── builder/                  ← Track 3 (runs as v1, v2, v3…)
│   │   ├── verifier/                 ← Track 3 (owns Terac aggregation)
│   │   ├── replay-qa/                ← Track 3 (NEW)
│   │   ├── revenue-watcher/          ← Track 4
│   │   └── service-watcher/          ← Track 4 (NEW)
│   └── integrations/                 ← Track 5
├── fixtures/
│   ├── plans/
│   ├── traces/
│   ├── contexts/
│   ├── plugins/
│   └── terac-responses/
├── scripts/
│   ├── mock-orch.sh
│   ├── replay-fixture.ts
│   └── integration-test.sh
├── memory/                           ← runtime, gitignored
├── autobiz.db                        ← runtime, gitignored
├── .env / .env.example
├── PLAN.md                           ← this file
├── CONTRACTS.md                      ← locked schemas
├── FIXTURES.md                       ← fixture data spec
├── INTEGRATION.md                    ← Phase 2 checklist
├── DEMO.md                           ← Phase 3 script
└── agents/                           ← PRDs
    ├── README.md
    ├── agent-a-ui.md
    ├── agent-b-orchestrator.md
    ├── agent-c0-planner.md
    ├── agent-c1-researcher.md
    ├── agent-c2-builder.md
    ├── agent-c3-verifier.md
    ├── agent-c4-replay-qa.md         ← NEW
    ├── agent-d1-revenue-watcher.md
    ├── agent-d2-service-watcher.md   ← NEW
    └── agent-e-integrations.md
```

---

## Golden rules (violate = lose the day)

1. **No shared writes after Phase 0.** Adding a field to `TraceEvent`? Stop, follow the change protocol in CONTRACTS.md §9.
2. **Every track owns exactly one directory.** No cross-package writes.
3. **Every track must be runnable standalone** against fixtures. `npm run demo` in any package must produce output without the rest of the system.
4. **Agents talk HTTP to the orchestrator.** No JSONL over stdout. No file drops. The `turn_id` in `AgentContext` is the auth token.
5. **Verifier owns Terac aggregation.** The Terac client returns raw responses only.
6. **Replay QA sets `status=live`.** No other agent flips that field.
7. **Stripe restricted keys only.** Orchestrator refuses to boot with `sk_`.
8. **The before/after Decision card + the bug-fix loop are the money shots.** If time is tight, cut anything else. Not these.
9. **Rehearse 3×.** Untested demos die on stage.

---

## Ralph loop for developer agents

Each agent PRD is designed for the ralph loop pattern:

```
while not done:
    read PRD file
    check progress checkboxes
    do the next unchecked step
    mark it complete
    commit
```

Every PRD is self-contained (no need to read other PRDs), resumable (progress = checkbox state in file), and has an explicit **DONE** definition. If a dev agent crashes mid-task, the next invocation picks up from the checkboxes.

Start with [`agents/README.md`](./agents/README.md).
