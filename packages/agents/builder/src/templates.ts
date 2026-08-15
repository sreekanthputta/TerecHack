import Handlebars from "handlebars";
import type { TemplateId } from "./template.js";
import type { LandingCopy } from "./content.js";

const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { color: #111; background: #fafafa; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px; }
  header { padding: 48px 24px; text-align: center; }
  h1 { font-size: 40px; font-weight: 800; margin-bottom: 12px; }
  h2 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
  p.sub { font-size: 18px; color: #555; margin-bottom: 24px; }
  .cta { display: inline-block; padding: 14px 28px; border-radius: 8px; background: #111; color: #fff; text-decoration: none; font-weight: 600; }
  .cta:hover { opacity: 0.9; }
  .value-props { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 32px 0; }
  .value-prop { padding: 16px; background: #fff; border-radius: 8px; border: 1px solid #eee; }
  .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-top: 24px; }
  .product { background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #eee; }
  .product img { width: 100%; height: 200px; object-fit: cover; display: block; }
  .product .body { padding: 16px; }
  .product .price { font-weight: 700; margin: 8px 0; }
  .total { font-weight: 700; font-size: 20px; margin: 16px 0; }
  footer { text-align: center; padding: 32px; color: #999; font-size: 14px; }
`;

const MINIMAL_PRODUCT = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{brand_name}}</title><style>${SHARED_CSS}</style></head>
<body>
  <header>
    <h1>{{hero}}</h1>
    <p class="sub">{{subheadline}}</p>
    <a class="cta" href="{{payment_url}}">{{cta_label}}</a>
  </header>
  <div class="container">
    {{#with (lookup products 0)}}
    <div class="product">
      <img src="{{lookup ../product_images 0}}" alt="{{name}}" />
      <div class="body">
        <h2>{{name}}</h2>
        <p>{{blurb}}</p>
        <p class="price">$\{{price_usd}}</p>
        <p class="total" data-testid="total">Total: $\{{price_usd}}</p>
        <a class="cta" href="{{../payment_url}}">{{../cta_label}}</a>
      </div>
    </div>
    {{/with}}
    <div class="value-props">
      {{#each value_props}}<div class="value-prop">{{this}}</div>{{/each}}
    </div>
  </div>
  <footer>&copy; {{brand_name}} — built by AutoBusiness</footer>
</body></html>`;

const STORY_FIRST = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{brand_name}}</title><style>${SHARED_CSS}</style></head>
<body>
  <header>
    <h1>{{brand_name}}</h1>
    <p class="sub">{{hero}}</p>
    <p class="sub">{{subheadline}}</p>
    <a class="cta" href="{{payment_url}}">{{cta_label}}</a>
  </header>
  <div class="container">
    <div class="value-props">
      {{#each value_props}}<div class="value-prop">{{this}}</div>{{/each}}
    </div>
    <h2>Our products</h2>
    <div class="products">
      {{#each products}}
      <div class="product">
        <img src="{{lookup ../product_images @index}}" alt="{{name}}" />
        <div class="body">
          <h2>{{name}}</h2>
          <p>{{blurb}}</p>
          <p class="price">$\{{price_usd}}</p>
          <p class="total" data-testid="total-{{@index}}">$\{{price_usd}}</p>
          <a class="cta" href="{{../payment_url}}">Buy</a>
        </div>
      </div>
      {{/each}}
    </div>
  </div>
  <footer>&copy; {{brand_name}} — built by AutoBusiness</footer>
</body></html>`;

const CATALOG = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{brand_name}}</title><style>${SHARED_CSS}</style></head>
<body>
  <header>
    <h1>{{hero}}</h1>
    <p class="sub">{{subheadline}}</p>
    <a class="cta" href="{{payment_url}}">{{cta_label}}</a>
  </header>
  <div class="container">
    <h2>Shop the collection</h2>
    <div class="products">
      {{#each products}}
      <div class="product">
        <img src="{{lookup ../product_images @index}}" alt="{{name}}" />
        <div class="body">
          <h2>{{name}}</h2>
          <p>{{blurb}}</p>
          <p class="price">$\{{price_usd}}</p>
          <p class="total" data-testid="total-{{@index}}">$\{{price_usd}}</p>
          <a class="cta" href="{{../payment_url}}">Buy</a>
        </div>
      </div>
      {{/each}}
    </div>
    <div class="value-props">
      {{#each value_props}}<div class="value-prop">{{this}}</div>{{/each}}
    </div>
  </div>
  <footer>&copy; {{brand_name}} — built by AutoBusiness</footer>
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
