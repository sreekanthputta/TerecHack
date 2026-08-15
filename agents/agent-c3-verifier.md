# Agent C3 — Verifier ⭐ (STAR OF THE DEMO)

## Role
You watch every other agent. When any of them produces a decision with `confidence < 0.6`, you STOP the pipeline, formulate a question, ask real humans via Terac, wait for the answers, aggregate them, and produce a `DecisionRecord` with a clear before/after. You are the reason this project wins.

This is the ONE agent judges will remember. Make it excellent.

## Owns
`packages/agents/verifier/` — long-running service, one instance per business_id, subscribed to the trace bus.

## Consumes
- `packages/shared/` — types
- `packages/integrations/terac.ts` — study creation + polling
- `packages/integrations/linq.ts` — optional owner alerts
- Env: `ANTHROPIC_API_KEY`, `TERAC_API_KEY`, `REDIS_URL`
- CLI args: `--business-id X`
- Fixtures: `fixtures/terac-responses/*.json` for offline dev

## Produces
- `TraceEvent`s on stdout (JSONL)
- `DecisionRecord`s posted to `POST http://localhost:4000/internal/decision`
- Optional plan patches posted to `POST http://localhost:4000/internal/plan-update`
- Optional owner alerts via `POST http://localhost:4100/linq/notify`

## Contracts (import from `packages/shared`)
- `TraceEvent`, `AgentName = "verifier"`
- `TeracAsk`, `TeracResponse`
- `DecisionRecord`, `DecisionSide`

---

## Tasks

### Setup

- [ ] Init `packages/agents/verifier/` with TypeScript, Anthropic SDK, `nanoid`
- [ ] Import shared types and integrations
- [ ] Add `bin` entry to package.json: `"verifier": "./dist/run.js"`

### Subscribe to trace bus

- [ ] Connect to Redis or in-memory bus (behind an env flag)
- [ ] Filter for `TraceEvent`s matching this `business_id`
- [ ] Watch specifically for events with `confidence !== undefined && confidence < 0.6`
- [ ] Also watch for events with `metadata.request_verifier: true` (explicit escalation)

### The verify() core loop

For each low-confidence event, run:

1. [ ] Emit `thought`: "Detected low confidence (0.5) on <topic>. Consulting real humans."
2. [ ] Build a `TeracAsk` using an LLM: given the low-confidence event's content, produce:
   - `question` — natural language, one sentence
   - `audience` — general or expert:<domain>
   - `options` if multiple-choice, else omit
   - `target_responses` — 10 for general, 5 for expert
   - `why_asking` — one sentence for the UI
3. [ ] Emit `terac_call` trace event with the full `TeracAsk` in metadata
4. [ ] POST to `http://localhost:4100/terac/ask` → get `ask_id`
5. [ ] Poll `GET /terac/result/:ask_id` every 5s until 200 (max 5 min)
6. [ ] Emit `terac_result` trace event with response count + aggregate
7. [ ] Ask LLM to synthesize: "Given original decision <X, confidence Y> and Terac responses <...>, produce a new decision. What changed? What's the new confidence?"
8. [ ] Build `DecisionRecord`:
   ```typescript
   {
     business_id, decision_id: nanoid(8), topic, ts,
     before: { value, confidence, reasoning },
     after:  { value, confidence, reasoning },
     terac_ask_id: ask_id
   }
   ```
9. [ ] POST decision to `/internal/decision`
10. [ ] Emit `decision` trace event summarizing the change
11. [ ] If the decision changes the plan (e.g. new price, different vendor), POST plan patch to `/internal/plan-update`

### Owner escalation (Linq)

- [ ] After producing a DecisionRecord, if `metadata.owner_should_know: true` or if the decision reverses the previous plan:
  - POST to `/linq/notify` with `{business_id, message: "<summary>. Approve or override?", requires_approval: true}`
  - Emit trace event: "Owner alerted via iMessage"

### Confidence threshold config

- [ ] Threshold defaults to `0.6` but reads `VERIFIER_THRESHOLD` env var
- [ ] Also honor an explicit trigger: `metadata.request_verifier: true`

### Fixture mode

- [ ] If `FIXTURE_MODE=1`:
  - Skip real Terac API — read from `fixtures/terac-responses/*.json` matched by topic
  - Simulate 8-second polling latency (feels real to judges, not too slow)
  - All other logic identical

### Deduplication

- [ ] Track topics already verified for this business — don't re-ask the same question in a loop
- [ ] Use `Set<string>` keyed by `topic + short-hash(question)`

### Graceful shutdown

- [ ] SIGINT handler: emit final `thought` "Shutting down", flush pending Terac polls, exit 0

---

## Definition of Done

- [ ] Given a trace event with confidence 0.5, Verifier produces a valid DecisionRecord within 60 seconds (fixture mode) or 5 minutes (live Terac)
- [ ] The DecisionRecord has BOTH before and after populated with real reasoning strings (not "N/A")
- [ ] `terac_call` and `terac_result` trace events fire in the right order with `why_asking` populated
- [ ] Plan patches are posted when a decision changes plan values
- [ ] Owner alerts fire when appropriate — visible in Linq preview panel in UI
- [ ] Two independent low-confidence events in the same business produce two separate DecisionRecords, not one merged

---

## Do NOT

- Write files outside `packages/agents/verifier/`
- Modify shared schemas
- Escalate every decision — respect the 0.6 threshold
- Skip the `before` field. Judges compare before/after. Missing `before` breaks the demo.
- Cache Terac responses across businesses — each ask is scoped
- Guess when Terac fails. Emit an error trace and preserve the low-confidence decision.

---

## If stuck

1. Terac API slow? In fixture mode you have canned responses. Use them, note in trace.
2. LLM struggling to build good TeracAsk questions? Provide it 2-3 few-shot examples in the prompt.
3. Bus subscription issues? Fall back to polling `GET /api/business/:id` every 3s and detecting new trace events.

---

## Standalone demo

```bash
cd packages/agents/verifier
npm install && npm run build
FIXTURE_MODE=1 node dist/run.js --business-id demo3dp
# In another terminal, emit a low-confidence trace:
curl -X POST http://localhost:4000/internal/trace -H 'Content-Type: application/json' -d '{
  "business_id":"demo3dp","agent":"researcher","type":"result",
  "content":"Top pick: cable organizers","ts":"2026-08-15T14:00:00Z",
  "confidence":0.5,
  "metadata":{"topic":"niche-viability","top_pick":"cable organizers"}
}'
```

Expected: Verifier logs trace events, "calls" Terac (fixture), returns a DecisionRecord with a clear before → after within ~10 seconds. UI shows the animated decision card.

---

## Why this agent matters

The demo money-shot is the moment on screen where:
1. Researcher: "Top pick: cable organizers, confidence 0.5"
2. Verifier: "Confidence too low. Asking 15 real makers via Terac."
3. **[10s pause, UI shows Terac icon pulsing]**
4. Verifier: "12/15 makers agree — cable organizers"
5. Decision card slides in: **BEFORE** (confidence 0.5, based on Etsy scraping) → **AFTER** (confidence 0.85, based on 15 real makers)

Every judge will understand what happened in that moment. That's the winning idea rendered visually. Prioritize this above all else.
