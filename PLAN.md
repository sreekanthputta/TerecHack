# AutoBusiness — Zero Human Company Hackathon Plan

**Event:** Terac Zero Human Company Hackathon — Aug 15, 2026
**Location:** Humanmade, 655 Bryant St, SF
**Hacking window:** 10:45 AM → 6:45 PM (8 hours)
**Team:** Sreekanth + N developer agents (parallel Claude Code sessions / worktrees)

---

## The pitch (memorize this)

> LLM agents hallucinate business decisions. Real founders ask real people.
> AutoBusiness gives agents the same instinct: when confidence drops below a threshold, they don't guess — they call Terac and let real humans decide.

Meta-platform. User types a business idea. Agents research, build the MVP, market it, set up Stripe, take payments, and escalate real decisions to real humans via Terac. Owner sees a live trace UI and gets iMessage alerts for big calls.

---

## Tracks stacked

| Track | Prize | How we qualify |
|---|---|---|
| Best Overall Project | $2500 | Meta-platform + Terac-decision protocol |
| Best Overall Agent-Run Company | $2500 | Demo business earns real Stripe revenue in the room |
| Best Linq | $1500 / $1000 | Owner console over iMessage; tap-to-approve on decisions |
| Best Band | $500 | One Band room per business, agents genuinely coordinate |
| Best Superserve | $1000 / $500 | Sandboxes per business, agents pause between owner check-ins |
| Best Render | $500 / $300 / $100 | Render Workflows host generated businesses |
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
- deploy a Shopify-lite storefront on Render
- create Stripe payment link
- send iMessage owner alert on major decisions

Backup demo business (parallel spawn during demo): **"my roommate wants to sell ceramic mugs"** — proves the platform is generic, not hardcoded.

---

## The three phases

### Phase 0 — Central planning (0:00 – 0:45)
One person (or lead agent) locks contracts, fixtures, and env config. **No developer agents spawn until this is done.** Missing something here = collision at hour 7.

Artifacts produced:
- Repo skeleton committed to `main`
- `packages/shared/*` TypeScript types (locked)
- HTTP + WebSocket API contract (locked)
- `.env.example` with all keys
- `fixtures/` with demo plan + trace playback + Terac responses
- All PRD files (this repo)

### Phase 1 — Parallel dev (0:45 – 5:45)
Six developer agents work in isolation, one per package, each in its own git worktree:
- Agent A → Owner Console UI
- Agent B → Orchestrator + Planner LLM
- Agent C1 → Researcher agent
- Agent C2 → Builder agent
- Agent C3 → Verifier agent (star of the demo)
- Agent D → Integrations (Terac, Stripe, Render, Linq)

No agent touches another's package. Shared types are read-only after Phase 0.

### Phase 2 — Integration (5:45 – 6:45)
Everyone merges to `main`. Fixed 60-min checklist in [`INTEGRATION.md`](./INTEGRATION.md).

### Phase 3 — Demo prep (6:45 – 7:45 mental buffer)
Rehearse 3×. Pre-launch a live Terac study 5 min before pitch. Fallback fixture playback ready in another tab. See [`DEMO.md`](./DEMO.md).

---

## Repo layout

```
autobusiness/
├── packages/
│   ├── shared/          ← types, schemas, constants (LOCKED after Phase 0)
│   ├── ui/              ← Agent A
│   ├── orchestrator/    ← Agent B
│   ├── agents/
│   │   ├── researcher/  ← Agent C1
│   │   ├── builder/     ← Agent C2
│   │   └── verifier/    ← Agent C3
│   └── integrations/    ← Agent D
├── fixtures/
│   ├── plans/
│   ├── traces/
│   └── terac-responses/
├── scripts/
│   ├── mock-orchestrator.sh
│   └── integration-test.sh
├── .env.example
├── PLAN.md              ← this file
├── CONTRACTS.md         ← locked schemas
├── FIXTURES.md          ← fixture data spec
├── INTEGRATION.md       ← Phase 2 checklist
├── DEMO.md              ← Phase 3 script
└── agents/              ← ralphloop PRDs, one per developer agent
    ├── README.md
    ├── agent-a-ui.md
    ├── agent-b-orchestrator.md
    ├── agent-c1-researcher.md
    ├── agent-c2-builder.md
    ├── agent-c3-verifier.md
    └── agent-d-integrations.md
```

---

## Golden rules (violate = lose the day)

1. **No shared writes after Phase 0.** Adding a field to `TraceEvent`? Stop, notify the group, sign-off, then edit `shared/`.
2. **Every dev agent owns exactly one package.** No cross-package writes.
3. **Every dev agent must be runnable standalone** against fixtures. `npm run demo` in any package must produce output without the rest of the system.
4. **The Verifier + Terac before/after UI card is sacred.** If time is tight, cut anything else. Not this.
5. **Rehearse 3×.** Untested demos die on stage.

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
