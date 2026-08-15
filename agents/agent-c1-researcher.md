# Agent C1 — Researcher

## Role
You research the market for a business idea. You browse the web (via Superserve sandbox) for real signals — trending products, pricing, competition, seasonality. You produce a research summary with a **confidence score**. Low confidence deliberately triggers the Verifier to ask Terac.

## Owns
`packages/agents/researcher/` — standalone CLI that reads a task, does research, emits trace events to stdout as JSONL, terminates when done.

## Consumes
- `packages/shared/` — types
- `packages/integrations/` — may import `superserve.ts` helper OR call over HTTP on `:4100`
- Env: `ANTHROPIC_API_KEY`, `SUPERSERVE_API_KEY`
- CLI args: `--business-id X --task "..."`
- Fixture: `fixtures/researcher-outputs/3dp-niches.json` — canned result for offline dev

## Produces
- JSONL trace events on stdout (parsed by orchestrator)
- Final result event with `type: "result"` and `content` = markdown research summary
- Structured payload in `metadata.research`:
  ```json
  {
    "candidates": [
      {"name": "cable organizers", "evidence": "...", "price_range": [10, 15], "monthly_sales_est": 200}
    ],
    "top_pick": "cable organizers",
    "confidence": 0.5
  }
  ```

## Contracts (import from `packages/shared`)
- `TraceEvent`, `AgentName = "researcher"`

---

## Tasks

### Setup

- [ ] Init `packages/agents/researcher/` with TypeScript, `commander` for CLI args, Anthropic SDK
- [ ] Import shared types
- [ ] Add `bin` entry to package.json: `"researcher": "./dist/run.js"`

### CLI shell

- [ ] `run.js --business-id <id> --task <task>` — read args
- [ ] Emit trace event on stdout: `{type:"thought", content:"Starting research: <task>", ...}`
- [ ] Emit an `action` event before each Superserve call
- [ ] Emit final `result` event and exit 0
- [ ] On error: emit `error` event and exit 1

### Trace helper

- [ ] Small `emitTrace(partial: Partial<TraceEvent>)` function that fills in `business_id`, `agent`, `ts`, prints JSONL to stdout, flushes

### Superserve browsing

- [ ] Wrapper: `browse(url)` → returns text content via Superserve sandbox
- [ ] Wrapper: `search(query)` → uses a search engine inside Superserve
- [ ] Handle timeouts (30s per call), retry once
- [ ] If Superserve unavailable and `FIXTURE_MODE=1`, load `fixtures/researcher-outputs/3dp-niches.json`

### LLM planning loop

- [ ] Prompt Claude: "You are a market researcher. Given task '<task>', produce a plan of 3-5 web searches or URL visits that will produce evidence."
- [ ] Emit `thought` events with reasoning
- [ ] Execute the plan step by step (each becomes an `action` event)
- [ ] After each source: `thought` event summarizing what was found

### Synthesis

- [ ] Feed all gathered content back to Claude with prompt: "Summarize findings. Rank 3 candidates. Give confidence 0-1 based on evidence quality."
- [ ] **IMPORTANT:** if evidence is thin, mixed, or from a single source, confidence MUST be < 0.6. Do not inflate.
- [ ] Emit `result` event with markdown summary + structured metadata

### Structured output

- [ ] Force JSON output for the structured payload — validate with zod against:
  ```typescript
  z.object({
    candidates: z.array(z.object({
      name: z.string(),
      evidence: z.string(),
      price_range: z.tuple([z.number(), z.number()]),
      monthly_sales_est: z.number().optional()
    })).min(1).max(5),
    top_pick: z.string(),
    confidence: z.number().min(0).max(1)
  })
  ```
- [ ] On zod failure, retry once with an explicit schema-in-prompt reminder

### Fixture mode

- [ ] If `FIXTURE_MODE=1`, skip real API calls
- [ ] Play back `fixtures/researcher-outputs/3dp-niches.json` with fake timing (500ms between events)
- [ ] Always yields confidence 0.5 in fixture mode (so Verifier engages during demo)

---

## Definition of Done

- [ ] `node dist/run.js --business-id test --task "3D printer niches"` produces valid JSONL, ends with a `result` event
- [ ] Every emitted event validates against `TraceEvent` schema
- [ ] Fixture mode runs offline in <5 seconds
- [ ] Real mode produces plausible research in <60 seconds
- [ ] Deliberately low confidence (0.4-0.6) when evidence is thin — no inflated 0.9s

---

## Do NOT

- Write files outside `packages/agents/researcher/`
- Emit anything to stdout except JSONL trace events (logs → stderr)
- Cache API keys or user data in files
- Modify shared schemas
- Return confidence > 0.7 without at least 3 corroborating sources

---

## If stuck

1. Superserve unavailable? Fall back to plain `fetch` + Cheerio for HTML parsing.
2. LLM refuses to output structured JSON? Explicitly say "return ONLY the JSON, no markdown fences" and retry.
3. Web sources blocking? Switch to Reddit + HN which are more scraper-friendly.

---

## Standalone demo

```bash
cd packages/agents/researcher
npm install && npm run build
FIXTURE_MODE=1 node dist/run.js --business-id demo3dp --task "Find 3 trending 3D-printable niches"
```

Expected stdout: ~8 JSONL lines, ending with a `result` event carrying structured metadata for 3 candidates and confidence around 0.5.
