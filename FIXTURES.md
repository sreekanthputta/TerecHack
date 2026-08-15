# Fixtures — Offline dev data

Every dev agent must be able to run standalone against these files. If Terac / Stripe / LLM / Render is down, the agent still runs against fixtures.

Location: `fixtures/`

---

## `fixtures/plans/3d-printer.json`

Sample BusinessPlan for the demo business.

```json
{
  "business_id": "demo3dp",
  "goal": "I have a 3D printer idle for a month, make me money",
  "vertical": "print-on-demand",
  "agents": [
    { "role": "researcher", "task": "Find 3 trending 3D-printable niches on Etsy with <$25 price point and >200 monthly sales" },
    { "role": "verifier",   "task": "Validate researcher's niche picks with Terac makers audience", "depends_on": ["researcher"] },
    { "role": "builder",    "task": "Generate landing page for top niche with 3 SKU cards + Stripe checkout", "depends_on": ["verifier"] },
    { "role": "verifier",   "task": "A/B test 3 headlines with Terac general population before launch", "depends_on": ["builder"] }
  ],
  "budget_usd": 50,
  "terac_studies_planned": [
    { "topic": "niche-viability", "audience": "expert:makers",  "when": "before-build" },
    { "topic": "pricing",         "audience": "general",         "when": "on-uncertainty" },
    { "topic": "headline",        "audience": "general",         "when": "post-mvp" }
  ],
  "owner_contact": {
    "channel": "imessage",
    "address": "+1XXXXXXXXXX"
  }
}
```

## `fixtures/plans/ceramic-mugs.json`

Second business for the "spawn a parallel one during the demo" money-shot. Same shape, different goal:

```json
{
  "business_id": "demomug",
  "goal": "My roommate wants to sell ceramic mugs online",
  "vertical": "handmade-goods",
  "agents": [
    { "role": "researcher", "task": "Find ceramic mug pricing + top-selling styles on Etsy" },
    { "role": "verifier",   "task": "Validate style picks with Terac general audience", "depends_on": ["researcher"] },
    { "role": "builder",    "task": "Generate storefront with 3 mug SKUs", "depends_on": ["verifier"] }
  ],
  "budget_usd": 50,
  "terac_studies_planned": [
    { "topic": "style-preference", "audience": "general", "when": "before-build" }
  ],
  "owner_contact": { "channel": "imessage", "address": "+1XXXXXXXXXX" }
}
```

---

## `fixtures/traces/demo-happy-path.jsonl`

40-line trace stream. UI plays this back if live agents flake. One `TraceEvent` per line (JSONL, not JSON array). Written to be read live by judges — not dumps, human sentences.

Include beats in this order:
1. Planner: "Understood: 3D printer idle for a month. Drafting plan."
2. Planner decision emitted
3. Researcher: "Searching Etsy top sellers under $25…" (3-4 thought events)
4. Researcher result: 3 candidate niches with confidence 0.5 (deliberate — triggers Verifier)
5. Verifier: "Confidence 0.5 on niche viability. Asking 15 real makers via Terac."
6. Verifier terac_call event with why_asking populated
7. **10s pause** (simulate Terac latency)
8. Verifier terac_result: "12/15 makers say cable organizers > phone stands > planter pots"
9. Verifier decision: cable organizers, confidence 0.85 — DecisionRecord card animates
10. Builder: "Generating landing page 'CableCraft' with 3 SKUs…"
11. Builder deploys to Render, URL appears
12. Builder: "Creating Stripe payment link at $12/unit…"
13. Verifier: "Pre-launch headline A/B via Terac general pop, 20 responses."
14. Verifier decision: headline changed (this is the visible before/after)
15. Orchestrator: "Business is LIVE. QR code ready."
16. (mid-demo) Orchestrator: "New business spawned: ceramic-mugs"
17. Stripe balance ticks up $12 (real if possible; simulated event if not)
18. Linq: "iMessage sent to owner — DoorDash Drive vs USPS?"

---

## `fixtures/terac-responses/niche-viability-3dp.json`

Pre-recorded Terac response for the niche viability study. Verifier can consume this in dev mode without hitting the real Terac API.

```json
{
  "ask_id": "fixture-niche-3dp",
  "business_id": "demo3dp",
  "responses": [
    { "answer": "cable organizers", "reasoning": "sells year-round, low competition, forgiving prints" },
    { "answer": "cable organizers", "reasoning": "I sell these — best margin among the three" },
    { "answer": "phone stands", "reasoning": "saturated but proven" },
    { "answer": "cable organizers", "reasoning": "consumables, repeat buyers" },
    { "answer": "planter pots", "reasoning": "aesthetic appeal higher" },
    { "answer": "cable organizers", "reasoning": "fastest print, best $/hour" }
  ],
  "aggregate": "12/15 makers picked cable organizers, citing consistent demand and print efficiency. Phone stands second, planter pots least favored due to competition from ceramics."
}
```

## `fixtures/terac-responses/pricing-3dp.json`

```json
{
  "ask_id": "fixture-price-3dp",
  "business_id": "demo3dp",
  "responses": [
    { "answer": "$12" }, { "answer": "$10" }, { "answer": "$15" },
    { "answer": "$12" }, { "answer": "$12" }, { "answer": "$14" },
    { "answer": "$18 too high" }, { "answer": "$10-12" }, { "answer": "$12" },
    { "answer": "$15" }
  ],
  "aggregate": "Consensus around $12. 10/10 rejected $18. Median $12, range $10-15."
}
```

## `fixtures/terac-responses/headline-3dp.json`

```json
{
  "ask_id": "fixture-headline-3dp",
  "business_id": "demo3dp",
  "responses": [
    { "answer": "B", "reasoning": "specific benefit, not vague" },
    { "answer": "B" },
    { "answer": "B", "reasoning": "makes me want to click" },
    { "answer": "A" },
    { "answer": "B" },
    { "answer": "C", "reasoning": "funny but unclear what it is" },
    { "answer": "B" }
  ],
  "aggregate": "14/20 picked B ('Untangle your desk in 30 seconds — printed to order'). A won 4, C won 2. Reasoning centers on B's specificity."
}
```

---

## `fixtures/landing-templates/`

Pre-built HTML templates the Builder fills in with variables. Three skeletons — Builder picks one.

- `minimal-product/index.html.tmpl` — hero + 3 SKU grid + Stripe checkout button (Handlebars-style `{{product_name}}` vars)
- `story-first/index.html.tmpl` — long-form landing with one CTA
- `catalog/index.html.tmpl` — 6-slot product grid

Each template has a matching `assets/` dir with 2-3 placeholder images.

---

## `fixtures/README.md`

One-line index of every fixture file for humans skimming. Update this whenever a new fixture is added.

---

## Rules

1. **Fixtures are read-only during dev.** Agents load them, do not modify.
2. **Fixture IDs never collide with live IDs.** All fixture business_ids start with `demo` (`demo3dp`, `demomug`). Live IDs are 8-char nanoid, never starting with `demo`.
3. **Every fixture is committed.** No `.gitignore` on `fixtures/`.
4. **If real API results are dramatically different from fixtures**, update the fixture. Judges reading the trace will notice mismatches.
