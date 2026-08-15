# Phase 2 — Integration checklist (60 min, hour 5:45 → 6:45)

Everyone stops parallel work. Sit in one room. Run this checklist top to bottom. Do not skip steps.

## Pre-integration (5 min)

- [ ] All six dev agents confirm "DONE, ready for integration" in team channel
- [ ] Everyone pushes their branch
- [ ] Someone (lead) creates integration branch `integration-1` off `main`
- [ ] `git merge feature/ui feature/orch feature/researcher feature/builder feature/verifier feature/integrations --no-ff`
- [ ] If conflicts: only allowed in `package.json` / `package-lock.json`. Anything else = someone violated the "own only your directory" rule. Fix and continue.

## Boot sequence (5 min)

Open 5 terminals. Start in this order:

- [ ] Terminal 1: `docker run -p 6379:6379 redis` (or `redis-server`)
- [ ] Terminal 2: `cd packages/integrations && npm run server` → confirm `:4100` health
- [ ] Terminal 3: `cd packages/orchestrator && npm start` → confirm `:4000` health
- [ ] Terminal 4: `cd packages/agents/verifier && node dist/run.js --business-id boot-check` (long-running)
- [ ] Terminal 5: `cd packages/ui && npm run dev` → open `http://localhost:3000`

## Smoke test — cold path (10 min)

- [ ] UI loads without errors
- [ ] Type in idea: "3d printer sitting idle for a month, make me money"
- [ ] Click Launch → business_id returned, trace panel activates
- [ ] Planner LLM produces a valid BusinessPlan (visible in traces)
- [ ] Researcher spawns, emits at least 5 trace events
- [ ] Researcher final result has confidence < 0.6 (fixture forces this)
- [ ] Verifier catches it, emits `terac_call` event
- [ ] Terac (real or fixture) returns response within reasonable time
- [ ] Verifier emits `terac_result` + posts DecisionRecord
- [ ] **UI shows the animated before/after decision card** ⭐ — if this doesn't work, everything else is secondary
- [ ] Builder spawns, generates content, deploys to Render
- [ ] `landing_url` appears in UI Business Status panel
- [ ] QR code renders
- [ ] Business status pill goes to LIVE

## Smoke test — Stripe (5 min)

- [ ] `stripe_payment_link` appears in UI
- [ ] Click it → opens real Stripe checkout page
- [ ] Test purchase with Stripe test card `4242 4242 4242 4242`
- [ ] Within 30s, UI Stripe balance counter increments
- [ ] Balance is polled from real Stripe restricted key

## Smoke test — Linq iMessage (5 min)

- [ ] Verifier triggers an owner alert on decision reversal
- [ ] iMessage arrives on `OWNER_IMESSAGE` phone
- [ ] Tapback 👍 → orchestrator receives approval webhook → trace event fires
- [ ] UI Owner Notifications panel shows the message + approval state

## Smoke test — multi-business (5 min)

- [ ] Type second idea: "my roommate wants to sell ceramic mugs"
- [ ] Second tab appears in UI trace panel
- [ ] Both businesses' traces stream independently, no cross-contamination
- [ ] Switching tabs shows correct traces per business

## Failure modes to check (10 min)

- [ ] Kill Verifier mid-flow → orchestrator continues without crashing, emits error trace
- [ ] Kill Redis → orchestrator falls back to in-memory bus, UI still works
- [ ] Kill integrations → agents fall back to fixture mode, still emit meaningful traces
- [ ] Force UI to fixture mode → replays `demo-happy-path.jsonl` cleanly (this is your demo escape hatch)

## Perf check (5 min)

- [ ] Full cold-start to LIVE takes < 3 min in fixture mode
- [ ] Full cold-start to LIVE takes < 8 min in live mode
- [ ] UI stays > 30fps during trace stream
- [ ] Memory usage: orchestrator < 500MB, UI < 300MB

## Merge to main (5 min)

- [ ] Squash-merge `integration-1` to `main`
- [ ] Tag `v1-integration-pass`
- [ ] Everyone pulls `main`
- [ ] Prepare `main` for demo — nothing merged after this without full team OK

## If integration fails at hour 6:45

**Ship the fixture demo.** UI in `FIXTURE_MODE=1` playing `demo-happy-path.jsonl` is a complete, coherent demo. Judges will not know it's replayed if the pacing is right. You still qualify for most tracks because the code is real, only the runtime data is canned.

If Verifier + Terac + Decision card work end-to-end but Builder/Render fail: skip live Render deploy, pre-open a static screenshot of the landing page + real Stripe link. Trace still tells the story.

If EVERYTHING fails: use the fixture playback, plus a screen-recording backup of an earlier successful run. Better than nothing.

## Post-integration

Move immediately to [`DEMO.md`](./DEMO.md). Rehearse 3× before pitching.
