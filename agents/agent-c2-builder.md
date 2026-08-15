# Agent C2 · Track 3 — Builder (v1 + retry versions)

## Role
Take the validated plan + research + (if retry) `prior_bugs`, generate a landing page + Stripe payment link, deploy to Render. On retry runs (v ≥ 2), read `prior_bugs` from `AgentContext` and fix every one before re-shipping.

The same CLI is spawned multiple times per project; the orchestrator supplies the version via `AgentContext`. Read your `prior_bugs` list from the context; do not read the DB.

## Owns
`packages/agents/builder/` — standalone CLI.

## Consumes
- `packages/shared/` — types
- `AgentContext` from stdin: plan, research metadata, `prior_bugs?`, plugin_configs
- Integrations: `POST /stripe/payment-link`, `POST /render/deploy`
- `fixtures/landing-templates/` — Handlebars skeletons (minimal-product, story-first, catalog)
- Env: `ANTHROPIC_API_KEY`, `FIXTURE_MODE`, `TURN_ID`, `ORCH_URL`, `INT_URL`

## Produces
- Trace events + memory write `build/v<n>-notes.md`
- On successful deploy: `type:"deploy"` event with `metadata.landing_url`
- On retry: `type:"bugs_fixed"` event referencing which `bug_id`s were fixed
- Terminal `type:"result"`

## Contracts
```typescript
import type { AgentContext, Bug, TraceEvent } from "@autobiz/shared";
```

## Tasks

### Setup
- [ ] Init package (Handlebars, Anthropic SDK, zod)
- [ ] Read `AgentContext`; detect if this is v1 or v(n+1) by `AgentContext.prior_bugs` presence

### Template pick
- [ ] Choose template based on plan + research (SKU count)
- [ ] Emit `action` event with chosen template

### v1 flow
- [ ] Generate hero, subheadline, value props, product copy via Claude (JSON, zod-validated)
- [ ] Fill Handlebars, use `https://picsum.photos/seed/<slug>/800/600` placeholders unless real images provided
- [ ] Create Stripe payment link (restricted key only, integrations enforces)
- [ ] Deploy to Render
- [ ] Emit `type:"deploy"` with `landing_url`
- [ ] Write `build/v1-notes.md` (what was shipped, decisions taken)
- [ ] Post state update: `builder_version=1`, `landing_url`, `stripe_payment_link`

### v(n+1) retry flow
- [ ] Load `prior_bugs` from `AgentContext.prior_bugs`
- [ ] For each bug: emit `thought` explaining the fix approach
- [ ] Regenerate affected regions of the template only (don't reshuffle everything)
- [ ] Re-deploy to Render (new version, same subdomain)
- [ ] Emit `type:"bugs_fixed"` with `metadata.bug_ids = [<bug_id>...]`
- [ ] Write `build/v<n>-notes.md` listing each fixed bug
- [ ] Post state update: bump `builder_version`

### Failure handling
- [ ] Render deploy fails → emit `error`, retry once with backoff, fall back to writing to `/tmp/<project_id>.html` and returning `file://` URL as landing_url. Never crash.
- [ ] Stripe fails → use `STRIPE_DEMO_PAYMENT_LINK` env fallback if set; note in trace.

### Fixture mode
- [ ] Canned deploy URLs + fake pacing

## Definition of Done
- [ ] v1 real-mode run produces a live public URL with working "Buy Now" button in <60s
- [ ] v2 run receives 2 bugs in context and emits `bugs_fixed` with both `bug_id`s
- [ ] `builder_version` bumps correctly across runs
- [ ] Fixture mode < 5s, no network

## Do NOT
- Do not read from SQLite. Everything you need is in `AgentContext`.
- Do not set `status=live`. That's Replay QA's job.
- Do not use secret `sk_` Stripe keys. Restricted only (integrations enforces).

## Standalone demo
```bash
FIXTURE_MODE=true TURN_ID=t3 ORCH_URL=http://localhost:4000 INT_URL=http://localhost:4100 \
  node dist/run.js < fixtures/contexts/builder-v1.json
# for the retry flow:
node dist/run.js < fixtures/contexts/builder-v2-with-bugs.json
```
