import type { PluginDescriptor, PluginId } from "@autobiz/shared";

/**
 * Static catalog. Field lists mirror .env.example groupings. Do not add
 * `encrypted_values` or any secret shape here — this is UI-safe metadata.
 */
export const PLUGIN_CATALOG: PluginDescriptor[] = [
  {
    id: "terac",
    name: "Terac",
    tier: "required",
    purpose: "Human panel API for opinion studies",
    used_by: ["verifier"],
    fields: [
      { key: "TERAC_API_KEY", label: "API key", placeholder: "terac_sk_...", secret: true, required: true },
      { key: "TERAC_ORG_ID", label: "Org ID", placeholder: "org_...", secret: false, required: true },
      { key: "TERAC_PANEL_URL", label: "Panel URL", placeholder: "https://api.terac.dev/v1", secret: false, required: false },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    tier: "required",
    purpose: "Claude LLM for reasoning agents",
    used_by: ["planner", "researcher", "builder", "verifier", "replay-qa"],
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API key", placeholder: "sk-ant-...", secret: true, required: true },
      { key: "ANTHROPIC_MODEL", label: "Model", placeholder: "claude-opus-4-7", secret: false, required: false },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    tier: "required",
    purpose: "Payments — restricted rk_ key only",
    used_by: ["builder", "revenue-watcher"],
    fields: [
      { key: "STRIPE_RESTRICTED_KEY", label: "Restricted API key", placeholder: "rk_live_...", secret: true, required: true },
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Publishable key", placeholder: "pk_live_...", secret: false, required: false },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook secret", placeholder: "whsec_...", secret: true, required: false },
    ],
  },
  {
    id: "render",
    name: "Render",
    tier: "recommended",
    purpose: "Deploy target for generated landing sites",
    used_by: ["builder", "service-watcher"],
    fields: [
      { key: "RENDER_API_KEY", label: "API key", placeholder: "rnd_...", secret: true, required: true },
      { key: "RENDER_OWNER_ID", label: "Owner ID", placeholder: "own_...", secret: false, required: false },
    ],
  },
  {
    id: "linq",
    name: "Linq",
    tier: "recommended",
    purpose: "iMessage owner alerts",
    used_by: ["verifier", "orchestrator"],
    fields: [
      { key: "LINQ_API_KEY", label: "API key", placeholder: "linq_...", secret: true, required: true },
      { key: "LINQ_OWNER_PHONE", label: "Owner phone", placeholder: "+15551234567", secret: false, required: false },
    ],
  },
  {
    id: "superserve",
    name: "Superserve",
    tier: "recommended",
    purpose: "Sandbox browsers for scraping",
    used_by: ["researcher"],
    fields: [
      { key: "SUPERSERVE_API_KEY", label: "API key", placeholder: "ss_...", secret: true, required: true },
    ],
  },
  {
    id: "replay",
    name: "Loop QA (Replay.io)",
    tier: "recommended",
    purpose: "AI QA replays user journeys",
    used_by: ["replay-qa"],
    fields: [
      { key: "REPLAY_API_KEY", label: "API token", placeholder: "lqa_...", secret: true, required: true },
      { key: "REPLAY_BASE_URL", label: "Base URL", placeholder: "https://qa.replay.io/api/v1", secret: false, required: false },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    tier: "optional",
    purpose: "Real product listings as landing alternative",
    used_by: ["builder"],
    fields: [
      { key: "SHOPIFY_SHOP_DOMAIN", label: "Shop domain", placeholder: "yourshop.myshopify.com", secret: false, required: true },
      { key: "SHOPIFY_ADMIN_TOKEN", label: "Admin token", placeholder: "shpat_...", secret: true, required: true },
    ],
    scopes: ["write_products", "read_products"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    tier: "optional",
    purpose: "Custom domains + DNS",
    used_by: ["builder"],
    fields: [
      { key: "CLOUDFLARE_API_TOKEN", label: "API token", placeholder: "cf_token_...", secret: true, required: true },
      { key: "CLOUDFLARE_ZONE_ID", label: "Zone ID", placeholder: "zone_...", secret: false, required: false },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    tier: "optional",
    purpose: "SMS fallback",
    used_by: ["verifier"],
    fields: [
      { key: "TWILIO_ACCOUNT_SID", label: "Account SID", placeholder: "AC...", secret: false, required: true },
      { key: "TWILIO_AUTH_TOKEN", label: "Auth token", placeholder: "...", secret: true, required: true },
      { key: "TWILIO_FROM_NUMBER", label: "From number", placeholder: "+15551234567", secret: false, required: false },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    tier: "optional",
    purpose: "Email delivery",
    used_by: ["verifier"],
    fields: [
      { key: "SENDGRID_API_KEY", label: "API key", placeholder: "SG.token_...", secret: true, required: true },
      { key: "SENDGRID_FROM_EMAIL", label: "From email", placeholder: "hello@yourdomain.com", secret: false, required: false },
    ],
  },
  {
    id: "ga4",
    name: "GA4",
    tier: "optional",
    purpose: "Analytics",
    used_by: ["service-watcher"],
    fields: [
      { key: "GA4_MEASUREMENT_ID", label: "Measurement ID", placeholder: "G-XXXXXXXX", secret: false, required: true },
    ],
  },
  {
    id: "etsy",
    name: "Etsy",
    tier: "optional",
    purpose: "Etsy market research",
    used_by: ["researcher"],
    fields: [
      { key: "ETSY_API_KEY", label: "API key", placeholder: "etsy_...", secret: true, required: true },
    ],
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    tier: "optional",
    purpose: "Facebook/Instagram advertising",
    used_by: ["builder"],
    fields: [
      { key: "META_ACCESS_TOKEN", label: "Access token", placeholder: "meta_...", secret: true, required: true },
    ],
  },
  {
    id: "amazon",
    name: "Amazon Seller",
    tier: "optional",
    purpose: "Amazon product research",
    used_by: ["researcher"],
    fields: [
      { key: "AMAZON_SELLER_KEY", label: "Seller key", placeholder: "amzn_...", secret: true, required: true },
    ],
  },
];

const BY_ID = new Map<PluginId, PluginDescriptor>(PLUGIN_CATALOG.map((p) => [p.id, p] as const));

export function getPluginDescriptor(id: PluginId): PluginDescriptor | undefined {
  return BY_ID.get(id);
}
