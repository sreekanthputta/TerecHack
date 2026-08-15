# Agent C2 — Builder

## Role
You take a validated business plan (product + niche + pricing decided by Researcher and Verifier) and produce a live landing page with a Stripe checkout button. You deploy it to Render and return the URL.

## Owns
`packages/agents/builder/` — standalone CLI that reads inputs, fills a template, deploys, emits trace events, exits.

## Consumes
- `packages/shared/` — types
- `packages/integrations/render.ts` — deploy helper
- `packages/integrations/stripe.ts` — payment link creator
- `fixtures/landing-templates/` — Handlebars-style HTML skeletons
- Env: `ANTHROPIC_API_KEY`, `RENDER_API_KEY`, `STRIPE_SECRET_KEY`
- CLI args: `--business-id X --product-json <path>`

## Produces
- Deployed landing page — returns `landing_url`
- Stripe payment link
- Trace events on stdout
- Final `result` event with `metadata: {landing_url, stripe_url, product}`

## Contracts (import from `packages/shared`)
- `TraceEvent`, `AgentName = "builder"`

---

## Tasks

### Setup

- [ ] Init `packages/agents/builder/` with TypeScript, Handlebars, Anthropic SDK
- [ ] Import shared types + integration modules

### CLI

- [ ] `run.js --business-id <id> --product-json <path>` reads product JSON:
  ```json
  {
    "name": "CableCraft",
    "tagline": "...",
    "product_name": "...",
    "price_usd": 12,
    "skus": [{"name":"...", "desc":"...", "image":"..."}]
  }
  ```
- [ ] Emit `thought`/`action` events for each step

### Template selection

- [ ] Choose one of the three fixture templates based on product data:
  - `minimal-product` — 1-3 SKUs
  - `story-first` — 1 SKU, long-form
  - `catalog` — 4+ SKUs
- [ ] Emit `action` event: "Selected template: minimal-product"

### Content generation

- [ ] LLM prompt: "Given this product, produce: hero headline, subheadline, 3-bullet value props, product descriptions."
- [ ] Force JSON output, validate with zod
- [ ] Fill Handlebars vars in template
- [ ] Emit `thought` events with each generated chunk

### Image handling

- [ ] For hackathon: use `https://picsum.photos/seed/<slug>/800/600` placeholders unless product JSON provides real images
- [ ] Do NOT try to generate real images — too slow, too flaky

### Stripe payment link

- [ ] Call `POST http://localhost:4100/stripe/payment-link` with `{business_id, product_name, amount_usd}`
- [ ] Get back `{url, id}` and inject into template as `{{stripe_url}}`
- [ ] Emit `action` event: "Created Stripe payment link"
- [ ] If integrations service down, fall back to `STRIPE_DEMO_PAYMENT_LINK` env var

### Render deploy

- [ ] Call `POST http://localhost:4100/render/deploy` with `{business_id, html, name}`
- [ ] Get back `{url}` — this is the landing page URL
- [ ] Emit `action`: "Deploying to Render…"
- [ ] Emit `result` with `metadata.landing_url` set
- [ ] If Render fails, fall back to writing the HTML to `/tmp/<business_id>.html` and returning `file://` URL. Better than crashing.

### Fixture mode

- [ ] If `FIXTURE_MODE=1`: skip real Stripe/Render calls, return canned URLs from fixture data, emit events with fake pacing

---

## Definition of Done

- [ ] `node dist/run.js --business-id demo3dp --product-json fixtures/products/cable-craft.json` produces a live public URL in <60s
- [ ] The URL renders a landing page with the product info, images, and a working "Buy Now" button
- [ ] Clicking Buy Now takes you to Stripe checkout (real Stripe if key present, fixture link otherwise)
- [ ] Emitted events tell a clean story: template selection → content generation → stripe → deploy → done
- [ ] Fixture mode runs in <5 seconds with no API keys

---

## Do NOT

- Write files outside `packages/agents/builder/`
- Design custom CSS from scratch — use Tailwind CDN via `<script>` for demo speed
- Try to generate images. Placeholders are fine.
- Deploy to any service other than Render (violates track)
- Modify shared schemas

---

## If stuck

1. Render API weird? The `render/deploy` integration can fall back to a Vercel deploy or GitHub Pages temp URL — but the winning story requires Render, so exhaust options first.
2. Stripe API failing? Use pre-created `STRIPE_DEMO_PAYMENT_LINK` for the demo. Note this openly in trace.
3. Content generation slow? Cache a "default hero" fallback in the template and skip the LLM for the first version.

---

## Standalone demo

```bash
cd packages/agents/builder
npm install && npm run build
FIXTURE_MODE=1 node dist/run.js --business-id demo3dp --product-json fixtures/products/cable-craft.json
```

Expected: prints ~6 JSONL trace events, ends with a `result` event carrying a `landing_url` metadata field. In live mode with API keys, the URL is real and clickable.
