# Agent A · Track 1 — Owner Console UI

## Role
Build the Next.js 15 owner console. Every pixel the judge sees is yours. You render, you do not think.

## Owns
`packages/ui/` — everything under it. **Do not write anywhere else.**

## Consumes
- `packages/shared/` — types only (read-only import)
- Orchestrator REST + SSE at `http://localhost:4000` (see [CONTRACTS.md §2](../CONTRACTS.md))
- Design tokens from `mockups/` (see "Design system — LOCKED" below)
- Fixtures for dev: `fixtures/traces/demo-3dprint.jsonl`, `fixtures/traces/demo-mugs.jsonl`
- Env vars: `NEXT_PUBLIC_APP_URL`, `UI_PORT`

## Produces
- Next.js 15 app on port 3000
- 6 pages (routes below)
- SSE client that survives refresh via `Last-Event-ID`
- No API server logic. UI reads state from orchestrator only.

## Contracts
Import verbatim from `@autobiz/shared`:
```typescript
import type {
  TraceEvent, BusinessState, DecisionRecord, BusinessPlan,
  BugReport, PluginDescriptor, PluginConfig, ProjectStatus, AgentName
} from "@autobiz/shared";
```

Fetch endpoints (never guess a URL — copy from CONTRACTS.md):
- `GET /api/businesses` → list
- `POST /api/business` with body `{idea, owner_contact?, idempotency_key}` → create
- `GET /api/business/:id` → BusinessState
- `GET /api/business/:id/stream` → SSE (with `Last-Event-ID` header on reconnect)
- `GET /api/business/:id/events?since=<id>&limit=200` → paged history
- `GET /api/business/:id/decisions` → DecisionRecord[]
- `GET /api/business/:id/memory` → `{files: MemoryFile[]}`
- `POST /api/business/:id/message` → queue pivot
- `GET /api/plugins` → catalog
- `GET /api/plugins/config` → masked configs
- `PUT /api/plugins/:id/config` → save (server encrypts)
- `DELETE /api/plugins/:id/config` → disconnect

---

## Design system — LOCKED

Reference implementation: `mockups/*.html`. **Every page must visually match.** Do not deviate on tokens.

### Tokens (put in `packages/ui/src/styles/tokens.css`)

```css
:root {
  --bg: #0A0A0A;
  --surface: #111112;
  --surface-2: #17171A;
  --border: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.10);
  --text: #E8E8EA;
  --text-dim: #9A9AA1;
  --text-faint: #6B6B72;
  --violet: #8B5CF6;
  --violet-glow: rgba(139,92,246,0.35);
  --emerald: #10B981;
  --amber: #F59E0B;
  --rose: #F43F5E;
  --cyan: #22D3EE;     /* Replay QA lane accent */
}
```

### Fonts
`Inter` (400/500/600/700) · `JetBrains Mono` (400/500/600) · `Instrument Serif` (regular + italic).
Loaded via `next/font` at the root layout. **Do not use system-ui.**

### Numerics
Every price, count, latency, or elapsed-time number gets `font-variant-numeric: tabular-nums;` via `.tabnum` class.

### Component classes
- `.card` — `bg-surface border border-white/[0.06] rounded-xl`
- `.pill` `.pill-live` `.pill-planning` `.pill-error` `.pill-cyan` `.pill-bug` `.pill-fix`
- `.dot-live` — pulsing 6×6 emerald dot (see `mockups/home.html`)
- `.btn` — violet primary
- `.mono` `.serif` `.tabnum` helpers
- `.subtle-radial` background for hero/landing
- `.accent-ring` for focused prompt input

### Agent lane colors (project page)
| Agent | Left accent |
|-------|-------------|
| planner | violet `--violet` |
| researcher | emerald `--emerald` |
| verifier | amber `--amber` |
| builder | text-dim white |
| replay-qa | cyan `--cyan` |
| revenue-watcher | emerald |
| service-watcher | amber |

---

## Routes

| Path | File | Mockup |
|------|------|--------|
| `/` | `app/(marketing)/page.tsx` | `mockups/landing.html` — public marketing, pricing, "Start Building" CTA links to `/home` |
| `/home` | `app/(app)/home/page.tsx` | `mockups/home.html` — dashboard: prompt input + project list |
| `/project/[id]` | `app/(app)/project/[id]/page.tsx` | `mockups/project.html` — live trace, decisions, agent lanes, ship&fix loop |
| `/project/[id]` (pivot drawer) | (drawer overlay on same page) | `mockups/pivot.html` — pivot message queued for turn boundary |
| `/project/[id]/memory` | `app/(app)/project/[id]/memory/page.tsx` | `mockups/memory.html` — md file tree viewer |
| `/settings` | `app/(app)/settings/page.tsx` | `mockups/settings.html` — plugin catalog + connect modals |

Marketing (`/`) has its own layout without the app chrome. Everything under `(app)` shares the top nav from `mockups/home.html`.

---

## SSE client — critical logic

Location: `packages/ui/src/hooks/useProjectStream.ts`

Requirements:
1. `EventSource` to `/api/business/:id/stream`.
2. Track last-seen event id. On reconnect (any error), open a new `EventSource` with `Last-Event-ID` header — use `@microsoft/fetch-event-source` or equivalent; native `EventSource` can't set headers.
3. On page load: fetch `GET /api/business/:id/events?limit=200` for history, then open the stream. Backfill any gap between history and first live event via `?since=<lastId>`.
4. **Refresh-safe:** navigating away and back must not double-render events or miss events.
5. Buffer events by `agent_run_id` so the UI can lay them out per lane.
6. Detect `type: "deploy"`, `bugs_found`, `bugs_fixed`, `decision`, `sale` for special rendering.

---

## Tasks

### Setup
- [ ] Init Next.js 15 (App Router, TypeScript, Tailwind) inside `packages/ui/`
- [ ] Add `@autobiz/shared` as workspace dep
- [ ] Wire `next/font` for Inter, JetBrains Mono, Instrument Serif
- [ ] Create `src/styles/tokens.css` and import in root layout
- [ ] Add root layout with dark background + font vars
- [ ] Confirm `npm run dev` boots on port from `UI_PORT` env

### Landing page `/`
- [ ] Port `mockups/landing.html` markup into `app/(marketing)/page.tsx`
- [ ] Sticky nav with backdrop-blur
- [ ] Hero + demo window (static content, no live data)
- [ ] Agent roster grid (7 cards including Replay QA, Service Watcher, dashed "custom" tile)
- [ ] Bug-fix loop feature strip
- [ ] Pricing tiers (Hobbyist $0 · Founder $49 featured · Scale $199)
- [ ] FAQ (6 questions)
- [ ] All "Start Building" CTAs link to `/home`

### Home page `/home`
- [ ] Port `mockups/home.html` markup
- [ ] Prompt input component
  - [ ] `⌘⏎` shortcut launches
  - [ ] Example chips populate input
  - [ ] On submit: `POST /api/business` with `idempotency_key` from `crypto.randomUUID()`
  - [ ] On response: `router.push(\`/project/\${project_id}\`)`
- [ ] Project list via `GET /api/businesses`
- [ ] Auto-refresh list every 5s (SWR or simple polling)
- [ ] Empty state hint at bottom

### Project page `/project/[id]`
- [ ] Port `mockups/project.html` layout (status bar, lanes, right column)
- [ ] Status bar: agents count, memory files, uptime%, turn, elapsed, status pill
- [ ] Agent lanes rendered from event buffer, grouped by `agent + agent_run_id`
- [ ] "Builder v2" style version pills when `agent_run_id` differs on same agent
- [ ] "Replay QA" lane with `bugs_found` / `bugs_fixed` rendering
- [ ] Decision card (before/after) — the money shot. Render on every `type:"decision"` event.
- [ ] Right column cards: Revenue (Stripe), Health (Service Watcher), Ship & fix loop, Memory
- [ ] "Pivot mid-flight" drawer overlay (see `mockups/pivot.html`)
  - [ ] Owner types → `POST /api/business/:id/message`
  - [ ] UI shows "queued for turn N+1" state, then absorbs on next `pivot_absorbed` event
- [ ] SSE hook wired, refresh-safe

### Memory page `/project/[id]/memory`
- [ ] Port `mockups/memory.html`
- [ ] Fetch `GET /api/business/:id/memory`
- [ ] File tree left, rendered markdown right
- [ ] Frontmatter parsed and shown as chips

### Settings page `/settings`
- [ ] Port `mockups/settings.html` sidebar + integrations grid
- [ ] Fetch `GET /api/plugins` (catalog) + `GET /api/plugins/config` (masked)
- [ ] Required / Recommended / More sections
- [ ] Connect modal per plugin:
  - [ ] Form fields from `PluginDescriptor.fields` (secret → password input)
  - [ ] On save: `PUT /api/plugins/:id/config`
  - [ ] UI never displays raw values, only masked previews returned by server
  - [ ] Show scopes if `PluginDescriptor.scopes` present
- [ ] Disconnect button → `DELETE /api/plugins/:id/config`
- [ ] Green "how keys are stored" note (AES-256, never returned to browser)

### Fixture / demo mode
- [ ] `scripts/dev-with-fixtures.ts` — reads `fixtures/traces/demo-3dprint.jsonl`, spins up a mock SSE server on 4000, replays events in real time. Enables `npm run demo` for the UI alone.
- [ ] Verify all pages render against the mock

### Polish
- [ ] Every price/count/latency uses `.tabnum`
- [ ] Every timestamp shows relative ("8m ago") + absolute on hover
- [ ] Every long URL truncates with middle-ellipsis
- [ ] All buttons have hover state matching mockups
- [ ] Escape closes modals and drawers
- [ ] No emojis in UI text unless explicitly in a memory md file
- [ ] Lighthouse a11y pass ≥ 90 on `/` and `/home`

---

## Definition of Done
- [ ] All six routes render against fixture mock without errors.
- [ ] Refreshing `/project/[id]` mid-stream does not lose or duplicate events (SSE resume works).
- [ ] `POST /api/business` with same `idempotency_key` twice pushes to same project.
- [ ] Pivot input queues, then shows absorbed state after the next `pivot_absorbed` event.
- [ ] Settings modal saves through `PUT /api/plugins/:id/config` and shows masked preview after save.
- [ ] Visual diff against `mockups/*.html` is negligible (spacing, colors, typography identical).
- [ ] `npm run demo` in `packages/ui/` runs against fixtures with zero external deps.

---

## Do NOT
- Do not add server routes to Next.js. UI is a pure client of the orchestrator.
- Do not decrypt or handle raw API keys. Server encrypts; UI only sees masked previews.
- Do not add loading spinners on the project page — the SSE stream is the loading state.
- Do not use WebSocket. SSE only.
- Do not import from other `packages/agents/*` or `packages/integrations/`.

## If stuck
- Missing field on `TraceEvent`? → Escalate per CONTRACTS.md §9. Do not add locally.
- Orchestrator not running? → Use fixture mock (`npm run demo`).
- Mockup ambiguous? → Preserve the mockup's exact classes and copy. Screenshot for tie-breakers.

<!-- WORKTREE-SETUP:START -->
## Worktree setup

You work in `.claude/worktrees/agent-a-ui/` on branch `feat/agent-a-ui`. From that directory:

- **Only write files inside `packages/ui/`.** Root files (`pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`, `tests/contracts/`) are frozen for Phase A. If you need a new runtime dep, add it via `pnpm --filter @autobiz/ui add <dep>` — pnpm updates the root lockfile in your branch only.
- **Schema changes are forbidden here.** If your work needs to add a field to a shared type, STOP and follow [CONTRACTS.md §9](../CONTRACTS.md).
- **Merge gate** (must be green before push):
  ```bash
  pnpm --filter @autobiz/ui build
  pnpm --filter @autobiz/ui test:contracts
  ```
- **Commit cadence:** one commit per completed checkbox. Small commits, clear messages.
- **Push:** `git push -u origin feat/agent-a-ui`
- **PR:** open against `main` when every checkbox is done and Definition of Done is met. The contract test suite re-runs on the PR branch — green = merge.
- **If your worktree gets stale**, rebase on `main`: `git fetch origin && git rebase origin/main`. Do not force-push shared branches.
<!-- WORKTREE-SETUP:END -->

## Standalone demo
```bash
cd packages/ui
npm run demo
# → boots UI on :3000, mock SSE on :4000, replays 3D-printer demo trace
```
