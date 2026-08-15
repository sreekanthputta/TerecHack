# Agent D — Integrations (Terac, Stripe, Render, Linq, Superserve)

## Role
You own every third-party API. Every other agent calls into your package (as library or HTTP). You expose clean, small functions and a small HTTP server on `:4100` for the CLI agents to call.

## Owns
`packages/integrations/` — five modules + a thin HTTP wrapper.

## Consumes
- `packages/shared/` — types
- Env vars for every provider (see `.env.example`)
- Fixtures for offline mode

## Produces
- Library exports: `terac`, `stripe`, `render`, `linq`, `superserve` — each with 2-4 functions
- HTTP server on `:4100` implementing the endpoints in `CONTRACTS.md` §3
- `npm run demo` script that exercises each provider (real or fixture mode)

## Contracts (import from `packages/shared`)
- `TeracAsk`, `TeracResponse`
- `TraceEvent`

---

## Tasks

### Setup

- [ ] Init `packages/integrations/` with TypeScript, Express, native `fetch`, `zod`
- [ ] Import shared types
- [ ] Structured logger (pino)
- [ ] `.env` loader

### Terac module — `src/terac.ts`

- [ ] `askTerac(ask: TeracAsk): Promise<{ask_id: string}>`
  - POST to Terac's create-study endpoint (check Terac MCP docs in the Notion)
  - Store the returned study ID → return as `ask_id`
- [ ] `getTeracResult(ask_id: string): Promise<TeracResponse | null>`
  - Poll Terac's results endpoint
  - Return null if still pending
  - When >= `target_responses` collected OR study marked complete, format into `TeracResponse`
  - Use Claude to synthesize the `aggregate` field
- [ ] `FIXTURE_MODE=1` behavior:
  - `askTerac` returns `{ask_id: "fixture-<topic>-<business>"}`
  - `getTeracResult` reads `fixtures/terac-responses/<topic>-<business>.json` after 8s delay
- [ ] Emit relevant `TraceEvent`s on stderr for debugging

### Stripe module — `src/stripe.ts`

- [ ] `createPaymentLink(opts: {business_id, product_name, amount_usd?}): Promise<{url, id}>`
  - Uses Stripe Node SDK
  - Creates a product on the fly, then a payment link
  - If `amount_usd` omitted, use "customer chooses price" (per hackathon guide)
  - Store mapping `business_id → payment_link_id` in-memory
- [ ] `getBalance(business_id: string): Promise<{balance_usd, charges_count}>`
  - Reads Stripe charges filtered by the payment link ID
  - Sums successful charges
  - Uses the RESTRICTED key (read-only Balance + Charges) per hackathon rules
- [ ] Never expose or log the secret key. Log only `payment_link_id` + amounts.

### Render module — `src/render.ts`

- [ ] `deployStaticSite(opts: {business_id, html, name}): Promise<{url}>`
  - Uses Render API to create a static site OR update an existing one
  - Prefer creating a Render Workflow (satisfies "Best Render" track requirement)
  - Return the public `.onrender.com` URL
- [ ] Handle "site already exists" (idempotent — update, don't create dup)
- [ ] Fallback: write HTML to `/tmp/<business_id>.html` and return that file path if Render unavailable (log warning)

### Linq module — `src/linq.ts`

- [ ] `sendOwnerAlert(opts: {business_id, message, requires_approval?}): Promise<{sid}>`
  - Uses Linq API to send iMessage to `OWNER_IMESSAGE` env var
  - If `requires_approval`, use Linq's iMessage App card with 👍/👎 tapback options (per Linq hacker guide)
  - Return message SID
- [ ] `POST /linq/webhook` — receives Linq events (approvals, replies)
  - Verify `LINQ_WEBHOOK_SECRET`
  - Forward to orchestrator: `POST http://localhost:4000/api/business/:id/approval`

### Superserve module — `src/superserve.ts`

- [ ] `browse(url: string): Promise<{text, screenshot?}>`
  - Spins up (or reuses) a Superserve sandbox
  - Loads URL, returns text content
  - Pause sandbox between calls to save cost (per Superserve criteria — this is what earns the track)
- [ ] `search(query: string): Promise<{results: Array<{url, title, snippet}>}>`
- [ ] Session pool keyed by `business_id` — one sandbox per business, paused between agent turns
- [ ] Fallback if Superserve unavailable: use `fetch` + Cheerio for text extraction

### HTTP wrapper — `src/server.ts`

Expose endpoints from `CONTRACTS.md` §3. All are thin wrappers around the library functions.

- [ ] `POST /terac/ask` → `askTerac`
- [ ] `GET /terac/result/:ask_id` → `getTeracResult` (returns 202 if pending)
- [ ] `POST /stripe/payment-link` → `createPaymentLink`
- [ ] `GET /stripe/balance/:business_id` → `getBalance`
- [ ] `POST /render/deploy` → `deployStaticSite`
- [ ] `POST /linq/notify` → `sendOwnerAlert`
- [ ] `POST /linq/webhook` → webhook receiver

### Balance polling helper (for UI)

- [ ] Background job: every 15s, refresh Stripe balance for every active business_id, forward to orchestrator via `POST /internal/status` with `{stripe_balance_usd: ...}` update
- [ ] This makes the UI Stripe counter tick up live during the demo

---

## Definition of Done

- [ ] `npm run demo` in `packages/integrations/` exercises each provider (in fixture mode) and prints "OK" for each
- [ ] With real API keys, `curl -X POST :4100/terac/ask -d '{...}'` creates a real Terac study
- [ ] `curl -X POST :4100/stripe/payment-link -d '{"business_id":"test","product_name":"Test"}'` returns a real Stripe URL
- [ ] `curl -X POST :4100/render/deploy -d '{"html":"<h1>hi</h1>","name":"test","business_id":"test"}'` returns a live URL
- [ ] `curl -X POST :4100/linq/notify -d '{"business_id":"test","message":"hi","requires_approval":true}'` sends an iMessage that renders as an approval card
- [ ] Superserve sandbox is created, browses a URL, returns text, and pauses between calls

---

## Do NOT

- Write files outside `packages/integrations/`
- Store or log secret keys
- Skip Terac's `aggregate` synthesis — Verifier depends on it
- Use Stripe's live/full secret key. Restricted `rk_` only.
- Modify shared schemas

---

## If stuck

1. Terac auth issues? Confirm you have the API key from the opening ceremony Notion doc.
2. Render deploy slow? First deploy takes ~2 min; subsequent updates are ~30s. Warm up early.
3. Linq webhook not firing? Use ngrok to expose `:4100/linq/webhook` to the public internet.
4. Superserve first-run slow? Pre-warm one sandbox at boot.

---

## Standalone demo

```bash
cd packages/integrations
npm install && npm run build
FIXTURE_MODE=1 npm run demo
# Real mode (needs env keys):
npm run server
# curl -X POST :4100/terac/ask -H 'Content-Type: application/json' \
#   -d '{"business_id":"test","question":"Is this good?","audience":"general","target_responses":5,"why_asking":"testing"}'
```

Expected fixture: each module logs "OK". Expected real: real Terac study created, real Stripe link generated, real iMessage sent to `OWNER_IMESSAGE`.

---

## Notes on track qualification

- **Terac (required):** All Terac calls must go through this module. Real API in demo mode.
- **Best Render:** Deploy must go through Render Workflows, not a competitor. This is your track prize.
- **Best Superserve:** Pause the sandbox between agent turns. Judges may inspect billing to confirm you're not just leaving it running.
- **Best Linq:** Use iMessage Apps card (interactive card with tapback), not plain SMS. AgentPay integration bonus if time.
- **Stripe (for Agent-Run Company track):** Use the restricted key with Balance+Charges permissions only. Never the secret key.
