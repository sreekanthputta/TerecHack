# Agent E · Track 5 — Integrations

## Role
You own every third-party API. Expose a clean HTTP surface on `:4100` (see [CONTRACTS.md §3](../CONTRACTS.md)). Every other track calls you. You return raw provider data — **no aggregation, no decisions.** Verifier aggregates Terac. Watchers interpret Stripe / Render data.

## Owns
`packages/integrations/` — HTTP service + provider clients + plugin registry glue for the orchestrator to import.

**Do not write anywhere else.**

## Consumes
- `packages/shared/` — types
- Env vars from `.env` (see `.env.example`) — all provider keys
- Encrypted plugin values via a small helper the orchestrator imports (`decryptForPlugin(id)`)
- Fixtures: `fixtures/terac-responses/*.json`, `fixtures/stripe/charges.jsonl`, `fixtures/service/*`, `fixtures/render/deploy.json`

## Produces
- HTTP server on port `INTEGRATIONS_PORT` (default 4100), CORS-locked to orchestrator/UI hosts
- Seven provider clients under `src/clients/`: `terac`, `stripe`, `render`, `linq`, `superserve`, `replay` (Loop QA), `shopify` (optional)
- `FIXTURE_MODE=true` code path for every endpoint

## Contracts
Import from `@autobiz/shared`:
```typescript
import type {
  TeracAsk, TeracRawResponse, PluginId, PluginDescriptor
} from "@autobiz/shared";
```

**Golden rule of this package:** every function returns raw provider data. No aggregation. No interpretation.

---

## Tasks

### Setup
- [ ] Init `packages/integrations/` (TypeScript, Fastify/Express, native `fetch`, `zod`, `pino`, Stripe SDK)
- [ ] `.env` loader with defaults from `.env.example`
- [ ] Reject boot if `STRIPE_RESTRICTED_KEY` starts with `sk_`
- [ ] CORS: allow only `NEXT_PUBLIC_APP_URL` and `ORCH_URL`
- [ ] Structured logging; never log secrets (mask last-4 only)

### Terac endpoints
- [ ] `POST /terac/ask` — validate `TeracAsk` (zod), forward to Terac's create-study endpoint, return `{ask_id}`
- [ ] `GET /terac/result/:ask_id` — poll Terac's results endpoint
  - If pending → 202
  - If done → **return `TeracRawResponse` only**. No aggregate. Verifier does that.
- [ ] `FIXTURE_MODE=true`:
  - `POST /terac/ask` returns `{ask_id: "fixture-<hash>"}`
  - `GET /terac/result/...` after ~8s returns canned response from `fixtures/terac-responses/` matched by ask metadata topic
- [ ] Never persist Terac responses locally — cache in memory only, TTL 10 min

### Stripe endpoints
- [ ] `POST /stripe/payment-link` — creates product + payment link with restricted key
  - Body: `{project_id, product_name, amount_usd?}`
  - Returns `{url, id}`
  - Optional `amount_usd` omitted → customer-chooses-price
  - Store `{project_id → payment_link_id}` in memory + persist to a small json file `state/stripe.json` (so restarts survive)
- [ ] `GET /stripe/charges/:project_id?since=<iso>`
  - Reads Stripe `/v1/charges` filtered by payment_link_id, `created > since`
  - Returns `{charges: [{id, amount_usd, ts, product, status}...], balance_usd, count}`
- [ ] Refuse any call if `STRIPE_RESTRICTED_KEY` starts with `sk_`
- [ ] `FIXTURE_MODE=true`: payment link is a static `https://buy.stripe.com/test_demo/<slug>`; charges come from `fixtures/stripe/charges.jsonl` filtered by `since`

### Render endpoints
- [ ] `POST /render/deploy`
  - Body: `{project_id, html, name}`
  - Creates or updates a Render static site (idempotent per project_id); prefer Render Workflows to satisfy the track
  - Returns `{url, deploy_id}`
  - On failure: fallback writes `state/renders/<project_id>.html`, returns `file://` — never crash
- [ ] `GET /render/health/:project_id` — HEAD/GET the deployed URL, return `{status, latency_ms, checked_at}`
- [ ] `GET /render/logs/:project_id?since=<iso>&limit=50` — fetch recent logs from Render API, return `{lines: [{ts, level, message, path?, status?}...]}`
- [ ] `FIXTURE_MODE=true`: canned deploy_id / URL; health from `fixtures/service/health.json` (rotates by tick counter); logs from `fixtures/service/logs.jsonl`

### Linq endpoints
- [ ] `POST /linq/notify` — send iMessage via Linq API
  - Body: `{project_id, message, requires_approval?}`
  - When `requires_approval`, use Linq's iMessage App interactive card (👍/👎 tapback) — critical for the Linq track
  - Returns `{sid}`
- [ ] `POST /linq/webhook` — receive Linq events (approvals, replies)
  - Verify signature from `LINQ_WEBHOOK_SECRET`
  - Forward to orchestrator `POST /api/business/:project_id/message` with body `{content: "<approval or reply>"}` so it becomes a queued pivot message
- [ ] `FIXTURE_MODE=true`: `POST /linq/notify` logs and returns synthetic `sid`; webhook simulated by a `scripts/simulate-linq-approval.ts`

### Superserve endpoints
- [ ] `POST /superserve/session` — spin up (or reuse) a sandbox
  - Body: `{ttl_sec?}`
  - Returns `{session_id, browser_ws_url}` — Researcher connects Playwright to this WS for scraping
  - Pool size from `SUPERSERVE_POOL_SIZE`; pause sandboxes between calls to save cost (this earns the track)
- [ ] `DELETE /superserve/session/:id` — release sandbox
- [ ] `FIXTURE_MODE=true`: return synthetic ids; Researcher's Playwright wrapper detects fixture mode and skips real actions
- **Not used by Replay QA** — Loop QA (below) drives its own browsers.

### Loop QA (Replay) endpoints
Wraps `qa.replay.io/api/v1`. Auth: `Authorization: Bearer $REPLAY_API_KEY` (format `lqa_...`). Only Replay QA agent calls this.

- [ ] `POST /replay/project`
  - Body: `{project_id, base_url, design_document}`
  - Forward to Loop QA `POST /projects` with `{name: <project_id>, base_url, design_document}`
  - Returns `{id, url (dashboard), exploration_id}` — `url` is the judge-clickable Loop QA dashboard
  - Persist `{autobiz_project_id → loop_qa_project_id}` in memory + `state/loop-qa.json` (survives restart)
- [ ] `GET /replay/project/:id/status`
  - Proxy to Loop QA `GET /projects/{id}/status`
  - Returns `{state, journeys_passed_count, journeys_total, updated_at}` — state ∈ `queued | running | done | failed`
- [ ] `GET /replay/project/:id/bugs`
  - Proxy to Loop QA `GET /projects/{id}/bugs`
  - Returns `{bugs: [{id, severity, title, route, evidence_url}...]}` — normalize their severity levels to `blocker | major | minor`
- [ ] `GET /replay/bugs/:bug_id`
  - Proxy to Loop QA `GET /bugs/{id}` for full detail
  - Returns `{id, severity, title, observed, expected, repro:[...], evidence_url, route}`
- [ ] `POST /replay/project/:id/explorations`
  - Body: `{regression_notes?}`
  - Proxy to Loop QA `POST /projects/{id}/explorations` — reuses project for v2/v3 builder retries
  - Returns `{exploration_id}`
- [ ] `FIXTURE_MODE=true`:
  - `POST /replay/project` returns `{id:"fixture-lqa-1", url:"https://qa.replay.io/projects/fixture-run-1", exploration_id:"expl-1"}`
  - `GET /replay/project/:id/status` returns `done` after ~6s
  - `GET /replay/project/:id/bugs` returns 2 canned bugs on first exploration, 0 on second (from `fixtures/replay-qa/run-1-bugs.json`, `run-2-green.json`)
  - `GET /replay/bugs/:bug_id` returns detail from same fixture
- [ ] Refuse boot if `REPLAY_API_KEY` is unset and `FIXTURE_MODE !== "true"`
- [ ] Never log `REPLAY_API_KEY`; mask last-4 in structured logs

### Shopify (optional)
- [ ] `POST /shopify/product` — create a real product in the connected shop
- [ ] Gated on plugin `shopify` being connected (from plugin_configs)

### Plugin registry glue
- [ ] Export `getEnabledPlugins()` — reads `plugin_configs` from SQLite (via the orchestrator's exposed read helper OR a shared module), returns `PluginId[]`
- [ ] Export `getPluginSecrets(id)` — decrypts and returns raw values. **Only integrations calls this.** Orchestrator never decrypts.
- [ ] Every provider client checks its plugin's connection state before making calls; if disconnected and not fixture mode, return a clean error

### Balance/health cache (for UI liveness)
- [ ] Background job: for every `live` project, refresh Stripe balance every 15s and Render health every 30s, keeping an in-memory `lastKnown` map so cron agents get a fresh read on their tick
- [ ] Do not push to orchestrator directly — cron agents pull

---

## Definition of Done
- [ ] `FIXTURE_MODE=true npm run demo` prints "OK" for every provider
- [ ] Real mode: `POST /terac/ask` creates a real study; `GET /terac/result/:ask_id` returns raw responses (no `aggregate` string)
- [ ] `POST /stripe/payment-link` returns a real live-mode `https://buy.stripe.com/...` URL when connected
- [ ] `POST /render/deploy` returns a live `.onrender.com` URL
- [ ] `POST /linq/notify` with `requires_approval: true` produces a tap-to-approve iMessage card
- [ ] Superserve sessions are paused between agent turns (verifiable in Superserve dashboard)
- [ ] `STRIPE_RESTRICTED_KEY=sk_...` refuses boot with a clear error
- [ ] No secrets ever appear in logs

## Do NOT
- Do not aggregate Terac responses. Return raw. Verifier owns synthesis.
- Do not use Stripe secret `sk_` keys. Ever.
- Do not persist raw plugin secrets outside SQLite (which the orchestrator encrypts).
- Do not modify shared schemas.
- Do not write files outside `packages/integrations/` and the small `state/` scratch dir it owns.
- Do not proxy the orchestrator's public endpoints — you are outbound only.

## If stuck
- Terac auth failing? Confirm `TERAC_ORG_ID` matches the API key's org.
- Render first deploy slow? Pre-warm at boot with a hello-world static site.
- Linq webhook not receiving? Expose `:4100/linq/webhook` via ngrok for local dev.
- Superserve first session slow? Warm one at boot; keep pool size ≥ 1.

<!-- WORKTREE-SETUP:START -->
## Worktree setup

You work in `.claude/worktrees/agent-e-integrations/` on branch `feat/agent-e-integrations`. From that directory:

- **Only write files inside `packages/integrations/`.** Root files (`pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`, `tests/contracts/`) are frozen for Phase A. If you need a new runtime dep, add it via `pnpm --filter @autobiz/integrations add <dep>` — pnpm updates the root lockfile in your branch only.
- **Schema changes are forbidden here.** If your work needs to add a field to a shared type, STOP and follow [CONTRACTS.md §9](../CONTRACTS.md).
- **Merge gate** (must be green before push):
  ```bash
  pnpm --filter @autobiz/integrations build
  pnpm --filter @autobiz/integrations test:contracts
  ```
- **Commit cadence:** one commit per completed checkbox. Small commits, clear messages.
- **Push:** `git push -u origin feat/agent-e-integrations`
- **PR:** open against `main` when every checkbox is done and Definition of Done is met. The contract test suite re-runs on the PR branch — green = merge.
- **If your worktree gets stale**, rebase on `main`: `git fetch origin && git rebase origin/main`. Do not force-push shared branches.
<!-- WORKTREE-SETUP:END -->

## Standalone demo
```bash
cd packages/integrations
npm install && npm run build
FIXTURE_MODE=true npm run demo         # all providers OK, no keys needed
# Real mode:
npm run server                          # boots on :4100
curl -X POST :4100/terac/ask -H 'Content-Type: application/json' \
  -d '{"project_id":"test","question":"Would you buy X?","audience":"general","target_responses":5,"why_asking":"demo"}'
```

## Notes on track qualification
- **Terac (required):** all Terac calls go through this module. Raw responses only.
- **Best Render:** deploys use Render (preferably Workflows). Log the deploy id in trace metadata.
- **Best Superserve:** sandboxes paused between turns — judges can inspect billing.
- **Best Linq:** iMessage App interactive card with tapback, not SMS. Webhook wired to pivot messages.
- **Best Replay/Loop QA:** every Builder ship is inspected by Loop QA; dashboard URL in trace metadata so judges click through to the recording. v2+ reuses project.
- **Stripe:** restricted `rk_` keys only. Balance+Charges read scope + PaymentLinks write.
