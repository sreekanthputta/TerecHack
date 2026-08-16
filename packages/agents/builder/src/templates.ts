import Handlebars from "handlebars";
import type { TemplateId } from "./template.js";
import type { LandingCopy } from "./content.js";

const SHARED_CSS = `
  :root {
    --bg: #0b1020;
    --panel: #0f162e;
    --card: #ffffff;
    --fg: #0b1020;
    --muted: #5b6478;
    --line: #e6e8ef;
    --brand: #4f46e5;
    --brand-2: #06b6d4;
    --accent: #10b981;
    --radius: 16px;
    --shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    --shadow-lg: 0 24px 60px rgba(15, 23, 42, 0.22);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--fg);
    background: #f7f8fc;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; text-decoration: none; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
  .section { padding: 72px 0; }

  /* Nav */
  nav {
    position: sticky; top: 0; z-index: 20;
    background: rgba(255,255,255,0.85);
    backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--line);
  }
  nav .wrap { display: flex; align-items: center; justify-content: space-between; height: 64px; }
  .brand { font-weight: 800; font-size: 20px; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
  .brand .dot { width: 12px; height: 12px; border-radius: 50%; background: linear-gradient(135deg, var(--brand), var(--brand-2)); box-shadow: 0 0 0 4px rgba(79,70,229,0.12); }
  .nav-links { display: flex; align-items: center; gap: 22px; font-size: 15px; color: var(--muted); }
  .nav-links a:hover { color: var(--fg); }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 24px; border-radius: 999px; font-weight: 700; font-size: 15px;
    border: 1px solid transparent; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
  }
  .btn-primary { background: linear-gradient(135deg, var(--brand), var(--brand-2)); color: #fff; box-shadow: 0 8px 20px rgba(79,70,229,0.35); }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(79,70,229,0.45); }
  .btn-ghost { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.28); }
  .btn-ghost:hover { background: rgba(255,255,255,0.16); }
  .btn-dark { background: var(--fg); color: #fff; }
  .btn-dark:hover { transform: translateY(-1px); }
  .btn-block { width: 100%; justify-content: center; }

  /* Hero */
  .hero { position: relative; overflow: hidden; color: #fff; background: radial-gradient(1200px 500px at 80% -10%, rgba(6,182,212,0.35), transparent 60%), linear-gradient(160deg, #0b1020 0%, #17204a 55%, #221a4d 100%); }
  .hero .wrap { padding-top: 84px; padding-bottom: 96px; text-align: center; }
  .badge { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); font-size: 13px; font-weight: 600; letter-spacing: .02em; margin-bottom: 22px; }
  .badge .live { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px rgba(16,185,129,0.25); }
  .hero h1 { font-size: clamp(34px, 6vw, 60px); font-weight: 850; letter-spacing: -0.03em; line-height: 1.05; margin: 0 auto 18px; max-width: 15ch; background: linear-gradient(180deg,#fff, #cdd3ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero p.sub { font-size: clamp(16px, 2.4vw, 21px); color: #c7cce0; max-width: 60ch; margin: 0 auto 32px; }
  .hero .actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
  .trust-row { margin-top: 40px; display: flex; gap: 26px; justify-content: center; flex-wrap: wrap; color: #aab0cc; font-size: 14px; }
  .trust-row span { display: inline-flex; align-items: center; gap: 8px; }

  /* Section headings */
  .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 13px; font-weight: 700; color: var(--brand); text-align: center; }
  .section h2 { font-size: clamp(26px, 4vw, 38px); font-weight: 820; letter-spacing: -0.02em; text-align: center; margin: 10px auto 8px; max-width: 20ch; }
  .section .lede { text-align: center; color: var(--muted); max-width: 60ch; margin: 0 auto 44px; font-size: 17px; }

  /* Value props */
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
  .feature { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 26px; box-shadow: var(--shadow); transition: transform .15s ease, box-shadow .15s ease; }
  .feature:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .feature .ic { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-size: 20px; background: linear-gradient(135deg, rgba(79,70,229,0.12), rgba(6,182,212,0.12)); color: var(--brand); margin-bottom: 14px; }
  .feature p { color: var(--fg); font-weight: 600; }

  /* Products */
  .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 26px; }
  .product { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); transition: transform .15s ease, box-shadow .15s ease; display: flex; flex-direction: column; }
  .product:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
  .product img { width: 100%; height: 200px; object-fit: cover; display: block; background: #eef0f7; }
  .product .body { padding: 22px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .product .body h3 { font-size: 19px; font-weight: 780; letter-spacing: -0.01em; }
  .product .body .blurb { color: var(--muted); font-size: 15px; flex: 1; }
  .price { font-size: 26px; font-weight: 850; letter-spacing: -0.02em; }
  .price small { font-size: 14px; font-weight: 600; color: var(--muted); }

  /* Pricing card (single product) */
  .pricing { max-width: 460px; margin: 0 auto; }
  .pricing .card { background: var(--card); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow-lg); overflow: hidden; }
  .pricing .card-head { padding: 30px 30px 0; }
  .pricing .plan-name { font-weight: 800; font-size: 20px; }
  .pricing .amount { font-size: 52px; font-weight: 860; letter-spacing: -0.03em; margin: 10px 0 4px; }
  .pricing .amount small { font-size: 17px; font-weight: 600; color: var(--muted); }
  .pricing ul { list-style: none; padding: 22px 30px; display: grid; gap: 12px; }
  .pricing li { display: flex; gap: 12px; align-items: flex-start; color: var(--fg); font-size: 15px; }
  .pricing li .chk { color: var(--accent); font-weight: 800; }
  .pricing .card-foot { padding: 0 30px 30px; }
  .pricing .total { text-align: center; color: var(--muted); font-size: 14px; margin-top: 14px; }

  /* Footer */
  footer { border-top: 1px solid var(--line); padding: 40px 0; color: var(--muted); font-size: 14px; background: #fff; }
  footer .wrap { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .alt { background: #fff; }

  @media (max-width: 640px) {
    .section { padding: 52px 0; }
    .nav-links a:not(.btn) { display: none; }
  }
`;

const NAV = `
  <nav><div class="wrap">
    <div class="brand"><span class="dot"></span>{{brand_name}}</div>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#offer">Pricing</a>
      <a class="btn btn-dark" href="{{payment_url}}">{{cta_label}}</a>
    </div>
  </div></nav>`;

const HERO = `
  <header class="hero"><div class="wrap">
    <span class="badge"><span class="live"></span>Live now</span>
    <h1>{{hero}}</h1>
    <p class="sub">{{subheadline}}</p>
    <div class="actions">
      <a class="btn btn-primary" href="{{payment_url}}">{{cta_label}} &rarr;</a>
      <a class="btn btn-ghost" href="#features">See how it works</a>
    </div>
    <div class="trust-row">
      <span>&#9889; Ships in 48h</span>
      <span>&#128274; Secure Stripe checkout</span>
      <span>&#11088; Loved by early customers</span>
    </div>
  </div></header>`;

const FEATURES = `
  <section class="section" id="features"><div class="wrap">
    <div class="eyebrow">Why {{brand_name}}</div>
    <h2>Everything you need, nothing you don't</h2>
    <p class="lede">Built to get you to the good part faster.</p>
    <div class="features">
      {{#each value_props}}
      <div class="feature">
        <div class="ic">&#10003;</div>
        <p>{{this}}</p>
      </div>
      {{/each}}
    </div>
  </div></section>`;

const FOOTER = `
  <footer><div class="wrap">
    <div class="brand"><span class="dot"></span>{{brand_name}}</div>
    <div>&copy; {{brand_name}} — autonomously built &amp; deployed by AutoBusiness</div>
  </div></footer>`;

// Single product / service → hero + features + a focused pricing card.
const MINIMAL_PRODUCT = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{brand_name}} — {{hero}}</title><style>${SHARED_CSS}</style></head>
<body>
  ${NAV}
  ${HERO}
  ${FEATURES}
  <section class="section alt" id="offer"><div class="wrap">
    <div class="eyebrow">Get started</div>
    <h2>One simple plan</h2>
    <p class="lede">No surprises. Cancel anytime.</p>
    {{#with (lookup products 0)}}
    <div class="pricing">
      <div class="card">
        <div class="card-head">
          <div class="plan-name">{{name}}</div>
          <div class="amount"><span class="price">$\{{price_usd}}</span></div>
          <p class="blurb" style="color:var(--muted)">{{blurb}}</p>
        </div>
        <ul>
          {{#each ../value_props}}<li><span class="chk">&#10003;</span><span>{{this}}</span></li>{{/each}}
        </ul>
        <div class="card-foot">
          <a class="btn btn-primary btn-block" href="{{../payment_url}}">{{../cta_label}}</a>
          <p class="total" data-testid="total">Total due today: $\{{price_usd}}</p>
        </div>
      </div>
    </div>
    {{/with}}
  </div></section>
  ${FOOTER}
</body></html>`;

// A few SKUs → narrative hero, features, then a product row.
const STORY_FIRST = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{brand_name}} — {{hero}}</title><style>${SHARED_CSS}</style></head>
<body>
  ${NAV}
  ${HERO}
  ${FEATURES}
  <section class="section alt" id="offer"><div class="wrap">
    <div class="eyebrow">The lineup</div>
    <h2>Pick what fits you</h2>
    <p class="lede">Every option ships fast and checks out securely.</p>
    <div class="products">
      {{#each products}}
      <div class="product">
        <img src="{{lookup ../product_images @index}}" alt="{{name}}" loading="lazy" />
        <div class="body">
          <h3>{{name}}</h3>
          <p class="blurb">{{blurb}}</p>
          <div class="price" data-testid="total-{{@index}}">$\{{price_usd}}</div>
          <a class="btn btn-dark btn-block" href="{{../payment_url}}">{{../cta_label}}</a>
        </div>
      </div>
      {{/each}}
    </div>
  </div></section>
  ${FOOTER}
</body></html>`;

// Many SKUs → catalog grid up front, features below.
const CATALOG = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{brand_name}} — {{hero}}</title><style>${SHARED_CSS}</style></head>
<body>
  ${NAV}
  ${HERO}
  <section class="section" id="offer"><div class="wrap">
    <div class="eyebrow">Shop the collection</div>
    <h2>{{products.length}} products, ready to ship</h2>
    <p class="lede">Browse the full lineup below.</p>
    <div class="products">
      {{#each products}}
      <div class="product">
        <img src="{{lookup ../product_images @index}}" alt="{{name}}" loading="lazy" />
        <div class="body">
          <h3>{{name}}</h3>
          <p class="blurb">{{blurb}}</p>
          <div class="price" data-testid="total-{{@index}}">$\{{price_usd}}</div>
          <a class="btn btn-dark btn-block" href="{{../payment_url}}">{{../cta_label}}</a>
        </div>
      </div>
      {{/each}}
    </div>
  </div></section>
  ${FEATURES}
  ${FOOTER}
</body></html>`;

const REGISTRY: Record<TemplateId, string> = {
  "minimal-product": MINIMAL_PRODUCT,
  "story-first": STORY_FIRST,
  catalog: CATALOG,
};

export function renderTemplate(opts: {
  template: TemplateId;
  copy: LandingCopy;
  slug: string;
  payment_url: string;
  images?: string[];
}): string {
  const src = REGISTRY[opts.template];
  const compiled = Handlebars.compile(src, { noEscape: false });
  const images =
    opts.images && opts.images.length >= opts.copy.products.length
      ? opts.images
      : opts.copy.products.map(
          (_p, i) => `https://picsum.photos/seed/${opts.slug}-${i}/800/600`,
        );
  return compiled({
    ...opts.copy,
    payment_url: opts.payment_url,
    product_images: images,
  });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
}
