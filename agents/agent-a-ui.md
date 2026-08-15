# Agent A — Owner Console UI

## Role
You build the Owner Console — the single-page web app judges will look at for 3 straight minutes during the demo. This is the highest-visibility component. Prioritize polish.

## Owns
`packages/ui/` — Next.js 15 (App Router) app. Nothing else.

## Consumes
- `packages/shared/` (types) — read-only
- `fixtures/traces/demo-happy-path.jsonl` — for dev mode replay
- `fixtures/plans/3d-printer.json` — for dev mode initial state
- Live: `ws://localhost:4000/api/traces/:business_id`
- Live: `GET http://localhost:4000/api/business/:id`
- Env: `NEXT_PUBLIC_ORCH_URL` (defaults to `http://localhost:4000`)

## Produces
- Static-friendly Next.js app on `:3000`
- Four UI panels (see below)
- Standalone dev mode that replays fixtures with no backend

## Contracts (import from `packages/shared`)
- `TraceEvent`
- `DecisionRecord`
- `BusinessState`
- `BusinessPlan`

---

## Tasks

Work top-down. Check each box, commit, move on.

### Setup

- [ ] Scaffold Next.js 15 app in `packages/ui/` with TypeScript, Tailwind, App Router
- [ ] Install: `zustand` (state), `ws` (WebSocket client — native fine), `date-fns`, `lucide-react` (icons)
- [ ] Create `src/lib/shared.ts` re-exporting types from `packages/shared/`
- [ ] Add `npm run demo` script that starts UI with `FIXTURE_MODE=1`

### Layout — one screen, no routing

- [ ] Top bar: logo/name "AutoBusiness", input box "Describe your business idea…", "Launch" button
- [ ] Four-panel grid below, responsive:
  - **Left col (60%):** Agent Trace Stream, grouped by agent, live
  - **Right col (40%) top:** Business Status card (URL, QR, Stripe balance, status pill)
  - **Right col (40%) middle:** Decision Log (list of DecisionRecord cards)
  - **Right col (40%) bottom:** Owner Notifications (Linq iMessage previews)

### State management

- [ ] Zustand store `useBusinessStore`:
  ```typescript
  {
    businesses: Record<string, BusinessState>,
    traces: Record<string, TraceEvent[]>,  // per business_id
    activeBusinessId: string | null,
    connect(id): void,     // opens WS, dispatches on incoming
    createBusiness(idea): Promise<string>,  // POST /api/business
  }
  ```

### Idea input + business launch

- [ ] Input box wired to `createBusiness()` — calls `POST /api/business` with `{idea}`
- [ ] On success: switch active business, open WS
- [ ] Loading state while awaiting `business_id`
- [ ] Support multiple simultaneous businesses — tabs at top of trace panel

### Trace stream panel — the main event

- [ ] Group events by `agent`. Each agent gets a column or lane (planner, researcher, builder, verifier).
- [ ] Each event renders as a card:
  - Icon per `type` (thought=💭, action=⚙️, terac_call=👥, terac_result=✅, decision=🔀, result=📤, error=⚠️)
  - Timestamp (relative: "2s ago")
  - Confidence pill if present (color-coded: red <0.4, yellow 0.4-0.6, green >0.6)
  - Content markdown-rendered
- [ ] Auto-scroll to bottom on new event; pause auto-scroll when user scrolls up
- [ ] "Thought" events fade in with a subtle typewriter effect (500ms). Not longer — judges are watching pace.

### Decision Log panel — the money shot

- [ ] Render `DecisionRecord[]` newest-first
- [ ] Each DecisionRecord is a card with THREE columns:
  - **Before** — value, confidence pill, reasoning (grey/faded)
  - **arrow with Terac icon** — "N humans consulted"
  - **After** — value, confidence pill, reasoning (highlighted/green)
- [ ] Animate the card sliding in when it arrives
- [ ] Clicking the card expands to show Terac responses (from metadata)
- [ ] **This is the single most important visual in the demo. Make it beautiful.**

### Business Status card

- [ ] Status pill (planning / researching / building / **LIVE** / error) with color
- [ ] `landing_url` → clickable + QR code (use `qrcode.react`)
- [ ] `stripe_balance_usd` → big number, animate on change (`$0.00 → $12.00`)
- [ ] `stripe_payment_link` → "Copy link" button

### Owner Notifications panel

- [ ] Render mock iMessage bubbles (blue) for outgoing "owner alert" traces
- [ ] Approve/Deny buttons for `metadata.requires_approval: true` events
- [ ] Approve/Deny action → `POST /api/business/:id/approval` (endpoint owned by Orchestrator; Agent A only calls it)

### Fixture mode (CRITICAL)

- [ ] If `process.env.FIXTURE_MODE === "1"`:
  - Skip WS, load `fixtures/traces/demo-happy-path.jsonl`
  - Play events with pacing from `metadata.replay_delay_ms` (default 800ms between events)
  - Load `fixtures/plans/3d-printer.json` as active plan
  - Play a fake Stripe balance increment 20s in
- [ ] Add a hidden "Replay demo" button in dev — clicking it replays the fixture even in live mode. This is your demo escape hatch.

### Multi-business support

- [ ] Tabs above trace panel — one per active business
- [ ] Clicking a tab switches active traces + status card
- [ ] Adding a second business mid-session (during demo) must work smoothly

### Polish

- [ ] Dark mode by default, monospace font on trace content, tight spacing
- [ ] Loading skeletons for status panels while data is empty
- [ ] Empty states: "No businesses yet. Type an idea above."
- [ ] Favicon + tab title
- [ ] Add fixture "Replay" button somewhere subtle

---

## Definition of Done

- [ ] `npm run demo` in `packages/ui/` opens a UI that plays the fixture trace end-to-end with no backend
- [ ] Trace stream renders all 8 TraceEvent types with distinct visual treatment
- [ ] Decision card animation is smooth (60fps in Chrome)
- [ ] Live mode: connects to orchestrator WS, receives real events, no console errors
- [ ] Can create a business, watch it run, see decision cards appear, see Stripe balance change
- [ ] Second business can be added mid-session without breaking the first
- [ ] Renders correctly at 1440×900 (typical judge laptop) and on a projector at 1920×1080

---

## Do NOT

- Write files outside `packages/ui/`
- Change types in `packages/shared/`
- Add analytics, auth, or a backend
- Use experimental Tailwind features that break in prod build
- Introduce heavy chart libraries — this is a trace viewer, not a dashboard
- Ship with `console.log` spam

---

## If stuck

1. Try running against fixtures first. If fixture mode works, live mode is a connection issue not a UI issue.
2. If orchestrator WS isn't ready by hour 4, keep polishing fixture mode. That's still a winning demo.
3. If a schema change would unblock you — STOP. Emit blocker. Do not edit `packages/shared/`.

---

## Standalone demo

```bash
cd packages/ui
npm install
npm run demo
# Opens http://localhost:3000, autoplays fixtures/traces/demo-happy-path.jsonl
```

Expected output: full 40-event trace plays through in ~45 seconds, 2 decision cards animate in, Stripe balance climbs from $0 to $24, status pill goes planning → researching → building → LIVE.
